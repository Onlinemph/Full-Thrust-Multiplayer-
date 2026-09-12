/**
 * Full Thrust: Project Continuum — kinetic and exotic weapons, and the two
 * mountings that carry them (5.14 – 5.23).
 *
 * What holds this module together is not a shared damage table but a shared
 * *mechanism*: almost everything here is a projectile. A projectile rolls to
 * hit against a range-banded target number and then rolls damage separately,
 * where a beam rolls one die that is hit and damage at once (4.5). That split
 * is why these weapons ignore Standard Screens (7.2) — a screen defocuses a
 * beam, it does not stop a slug — and why Advanced Screens have to say
 * explicitly what they do to each of them (7.3).
 *
 * The rules are written out in full, with the numbers and their sources, in
 * `docs/rules/weapons-kinetic.md`.
 *
 * Two things this module deliberately does not do:
 *   - apply damage to a target. It reports what the dice did; `combat.ts`
 *     decides where the damage lands (4.8, 4.9).
 *   - spend ammunition. `fire()` refuses to shoot a mount whose `ammo` has run
 *     out, but a resolver is pure and never writes to a `WeaponDef` (see
 *     `weapons/contract.ts`); decrementing is the caller's job.
 */

import {
  d6,
  rollBeamVolley,
  type BeamVolley,
  type Rng,
  type ScreenLevel,
} from '../dice'
import { beamDiceAtRange, bearing, courseToDegrees, distance, rangeBand } from '../geometry'
import type {
  Arc,
  Course,
  DamageMode,
  Point,
  TurretDef,
  WeaponDef,
  WeaponVariant,
} from '../types'
import type { FiringContext, WeaponResult, WeaponSpec, WeaponSpecTable } from './contract'

// ---------------------------------------------------------------------------
// Context (what `FiringContext` does not carry)
// ---------------------------------------------------------------------------

/**
 * The extra facts a kinetic resolver needs (5.14 – 5.23).
 *
 * `FiringContext` describes a *beam* shot: range, arc, screen level, DRM. The
 * weapons in this file need four things it has no room for, so they are added
 * here as optional fields. Every one of them is optional, which means a plain
 * `FiringContext` is a valid `KineticContext` with all the options unset — no
 * cast is needed anywhere and nothing in the spine had to change.
 *
 * - `advancedScreens` says which *kind* of screen `targetScreens` counts.
 *   7.3 makes this unavoidable: the same level of screen does nothing at all
 *   to a Pulse Torpedo if it is Standard and −1 per damage die if it is
 *   Advanced.
 * - `targetMass` is what a Point Singularity Projector's damage scales on
 *   (5.23), and `targetVelocity` what a Gravitic Gun's does (5.20).
 * - the rest are per-turn weapon settings written in the Write Orders Phase
 *   (2.6 phase 1) — overload, VPT setting, Fusion Array mode — which have no
 *   home on `WeaponDef`.
 */
export interface KineticContext extends FiringContext {
  /** The target is a fighter, gunboat, missile or other small craft (5.23). */
  targetIsSmallCraft?: boolean
  /** 5.14: this Pulse Torpedo was ordered to fire overloaded this turn. */
  overloaded?: boolean
  /** 5.14: the setting a Variable Strength Pulse Torpedo is on this turn. */
  vptMode?: ProjectileLine
  /** 5.19: the mode a Fusion Array is configured in. */
  fusionMode?: FusionMode
  /**
   * 5.20: damage one Gravitic Gun hit does at a given target velocity. The
   * rulebook's speed/damage table is not in the source text (see the module
   * doc and `docs/rules/weapons-kinetic.md`), so it is injected rather than
   * guessed; without it a Gravitic Gun hit does 1 damage like a plain beam.
   */
  graviticDamagePerHit?: (targetVelocity: number) => number
}

/**
 * A `WeaponResult` with the one thing the contract has no field for: a weapon
 * that wrecked *itself* (5.14, the overloaded Pulse Torpedo misfire). It is a
 * subtype of `WeaponResult`, so a caller that does not know about it is
 * unaffected.
 */
export interface KineticWeaponResult extends WeaponResult {
  /**
   * 5.14: *"the Pulse Torpedo tube is destroyed and may not be repaired by
   * DCPs"* — the firing ship's own mount, not the target's.
   */
  launcherDestroyed?: boolean
}

/**
 * The Advanced Screen level in play against a projectile (7.3). A Standard
 * Screen is worth nothing against anything in this module, so it reads as 0.
 */
function advancedScreenLevel(ctx: KineticContext): ScreenLevel {
  return ctx.advancedScreens ? ctx.targetScreens : 0
}

/** Whether a magazine-fed or one-shot mount still has something to fire (6.6, 7.14). */
function hasShot(weapon: WeaponDef): boolean {
  return weapon.ammo === undefined || weapon.ammo > 0
}

/** A miss: dice were thrown, nothing arrived. */
function noDamage(mode: DamageMode, dice: number[], detail: string): WeaponResult {
  return { normalDamage: 0, penetratingDamage: 0, mode, dice, detail }
}

/** Bridge a rolled beam volley into the weapon contract (4.5 – 4.7). */
function beamVolleyResult(volley: BeamVolley, mode: DamageMode, label: string): WeaponResult {
  const faces = volley.dice.map((die) => die.natural)
  const tail =
    volley.penetratingDamage > 0 ? ` (+${volley.penetratingDamage} penetrating)` : ''
  return {
    normalDamage: volley.normalDamage,
    penetratingDamage: volley.penetratingDamage,
    mode,
    dice: faces,
    detail: `${label}: ${faces.join(',') || '—'} → ${volley.normalDamage + volley.penetratingDamage}${tail}`,
  }
}

/**
 * One D3 (5.14, 6.8). Full Thrust is a d6 game (1.7), so a D3 is a d6 halved
 * and rounded up — the only way to read three results off six faces that keeps
 * them equally likely.
 */
function d3(rng: Rng): { face: number; value: number } {
  const face = d6(rng)
  return { face, value: Math.ceil(face / 2) }
}

// ---------------------------------------------------------------------------
// The Projectile Weapon Hit Probability Table (5.14, 5.16, 5.18)
// ---------------------------------------------------------------------------

/**
 * Which line of the Projectile Weapon Hit Probability Table a mount reads
 * (5.14, 5.16). Short-range mounts are cheap and close-in, long-range ones
 * cost double the mass and reach one band further.
 */
export type ProjectileLine = 'short' | 'standard' | 'long'

/**
 * Width of one projectile range band, in MU.
 *
 * RECONSTRUCTED. The table itself is on page 153 of the rulebook and the text
 * extract we work from stops at page 80, so no line of it could be read. 6 MU
 * is what the rest of section 5 implies: the Fusion Array *"hits as a modified
 * projectile weapon"* (5.19) and its table is banded 0-6, 6-12, 12-18, …, and
 * the K-Gun Flak ranges (5.16) are 12/18/24 — multiples of 6, one band apart
 * per variant.
 */
export const PROJECTILE_BAND_MU = 6

/**
 * The Projectile Weapon Hit Probability Table (5.14, 5.16, 5.18): the die a
 * shot must reach, by 6 MU band, for each line. An entry past the end of a
 * line is out of range.
 *
 * RECONSTRUCTED — see `docs/rules/weapons-kinetic.md` for the full argument.
 * The reach of each line is read off 5.16's Flak barrage, which places its
 * Blast Marker *"up to 24 MU away for long range guns, 18 for standard and 12
 * for short"*; the barrage is fired by the gun, so that is how far the gun
 * shoots. Within a band every line is equally accurate, because the whole
 * trade the book describes between the three is mass for reach (a short K-3 is
 * mass 3 against a standard K-3's 5 and a long K-3's 10) — nowhere does it
 * describe a short-range mount as *more accurate* in close, only as cheaper.
 * Accuracy falls one point per band, which is the shape of every other ranged
 * table in the book (4.5, 5.19).
 *
 * Replace this one constant and every projectile weapon in the file follows.
 */
export const PROJECTILE_HIT_TABLE: Record<ProjectileLine, readonly number[]> = {
  short: [2, 3],
  standard: [2, 3, 4],
  long: [2, 3, 4, 5],
}

/** Longest range a projectile line reaches, in MU (5.16). */
export function projectileMaxRange(line: ProjectileLine): number {
  return PROJECTILE_HIT_TABLE[line].length * PROJECTILE_BAND_MU
}

/**
 * The number a projectile must roll to hit at this range, or null when the
 * range is past the end of its line (5.14, 5.16).
 *
 * A range that falls exactly on a band boundary — 6 MU, 12 MU — is in the
 * *nearer* band, which is how `geometry.rangeBand` reads it and how a player
 * measuring "0 to 6 MU" reads their own tape.
 */
export function projectileToHit(line: ProjectileLine, range: number): number | null {
  const band = rangeBand(range, PROJECTILE_BAND_MU)
  const table = PROJECTILE_HIT_TABLE[line]
  return band <= table.length ? table[band - 1] : null
}

/** One roll on the projectile table (5.14). */
export interface ProjectileShot {
  /** The die as thrown (1.7). */
  face: number
  /** After DRMs from ECM, holofields and the rest (1.7). */
  modified: number
  /** The number needed. */
  target: number
  hit: boolean
}

/**
 * Roll one projectile to hit (5.14, 5.16, 5.18). Returns null when the target
 * is out of range, which is not the same as a miss — a miss still costs a
 * Boarding Torpedo out of the magazine (5.18).
 */
export function rollProjectileHit(
  line: ProjectileLine,
  range: number,
  rng: Rng,
  drm = 0,
): ProjectileShot | null {
  const target = projectileToHit(line, range)
  if (target === null) return null
  const face = d6(rng)
  const modified = face + drm
  return { face, modified, target, hit: modified >= target }
}

/** The table line a mount of this variant reads (5.14, 5.16). */
export function projectileLine(variant: WeaponVariant): ProjectileLine {
  if (variant === 'short') return 'short'
  if (variant === 'long') return 'long'
  return 'standard'
}

/**
 * 5.14: an overloaded Pulse Torpedo *"uses the Projectile Weapon Hit Table of
 * the next smaller class of weapon"* — long reads standard, standard reads
 * short. Null for a short-range mount, which *"may not be fired overloaded"*.
 */
export function overloadedLine(line: ProjectileLine): ProjectileLine | null {
  if (line === 'long') return 'standard'
  if (line === 'standard') return 'short'
  return null
}

// ---------------------------------------------------------------------------
// 5.14 Pulse Torpedoes (SAP)
// ---------------------------------------------------------------------------

/** Mass of a Pulse Torpedo mount by variant and arc count (5.14). */
export function pulseTorpedoMass(variant: WeaponVariant, arcs: number): number {
  const count = Math.max(1, Math.min(3, Math.floor(arcs)))
  switch (variant) {
    // "LR Pulse Torpedo mass 8 1 arc, +2 mass per additional arc".
    case 'long':
      return 8 + 2 * (count - 1)
    // "SR Pulse Torpedo mass 2 1 arc, +1 mass for 2 additional arcs" — the
    // upgrade is sold once and buys both extra arcs, so 2 arcs and 3 arcs cost
    // the same. A player buying 2 arcs pays for the pack and takes 3.
    case 'short':
      return count === 1 ? 2 : 3
    // "VPTs are mass 8 1 arc, +2 mass per additional arc".
    case 'variable':
      return 8 + 2 * (count - 1)
    // "Pulse Torpedo mass 4 1 arc, +1 mass per additional arc".
    default:
      return 4 + (count - 1)
  }
}

/**
 * 5.14: *"To fire a Pulse Torpedo overloaded it must be noted in the orders
 * and the Pulse Torpedo may not have fired in the previous turn."* Short-range
 * tubes are barred outright.
 *
 * `firedLastTurn` covers the eject rule too — an overload that is loaded and
 * not fired *"is ejected by the crew and counts as having fired"*, so the
 * caller records the turn either way.
 */
export function canFireOverloaded(weapon: WeaponDef, firedLastTurn: boolean): boolean {
  if (weapon.weaponClass !== 'pulse-torpedo') return false
  if (weapon.variant === 'short' || weapon.variant === 'variable') return false
  return !firedLastTurn
}

/** 5.14: the overloaded warhead's damage modifier. */
export const OVERLOAD_DAMAGE_DRM = 2

/**
 * Fire one Pulse Torpedo tube (5.14).
 *
 * Standard: hit on the mount's own line, then 1D6 damage, SAP, ignoring
 * Standard Screens and −1 per level of Advanced Screen (7.3).
 *
 * Overloaded (`ctx.overloaded`): the mount reads the next line down, the
 * damage die takes +2 (*"giving a damage range between 3 and 8"*) and the
 * damage becomes AP. A natural 1 on that die calls for a second die, and a
 * second 1 wrecks the tube for good.
 *
 * The misfire check hangs off the *damage* roll, so it is only made on a hit —
 * 5.14 orders it that way: *"If the Pulse Torpedo hits, roll a 1D6 … If the
 * Pulse Torpedo rolls a 1, roll a second 1D6."*
 */
export function firePulseTorpedo(
  weapon: WeaponDef,
  ctx: KineticContext,
): KineticWeaponResult | null {
  if (weapon.variant === 'variable') return fireVariablePulseTorpedo(weapon, ctx)

  const base = projectileLine(weapon.variant)
  const overloaded = ctx.overloaded === true
  const line = overloaded ? overloadedLine(base) : base
  // A short-range tube ordered to overload simply cannot: 5.14 bars it.
  if (line === null) return null

  const shot = rollProjectileHit(line, ctx.range, ctx.rng, ctx.drm)
  if (shot === null) return null
  const mode: DamageMode = overloaded ? 'AP' : 'SAP'
  const label = `${overloaded ? 'Overloaded ' : ''}Pulse Torpedo (${line}) needs ${shot.target}+`
  if (!shot.hit) return noDamage(mode, [shot.face], `${label}: rolled ${shot.face} — miss`)

  const screens = advancedScreenLevel(ctx)
  const drm = (overloaded ? OVERLOAD_DAMAGE_DRM : 0) - screens
  const damageDie = d6(ctx.rng)
  // 7.3: "Negative damage is treated as zero; the target ship cannot regain
  // damage points!"
  const damage = Math.max(0, damageDie + drm)
  const dice = [shot.face, damageDie]

  let launcherDestroyed = false
  if (overloaded && damageDie === 1) {
    const confirm = d6(ctx.rng)
    dice.push(confirm)
    launcherDestroyed = confirm === 1
  }

  const result: KineticWeaponResult = {
    normalDamage: damage,
    penetratingDamage: 0,
    mode,
    dice,
    detail: `${label}: hit on ${shot.face}, damage ${damageDie}${drm !== 0 ? `${drm > 0 ? '+' : ''}${drm}` : ''} = ${damage} ${mode}${launcherDestroyed ? ' — TUBE DESTROYED' : ''}`,
  }
  if (launcherDestroyed) result.launcherDestroyed = true
  return result
}

/**
 * Fire a Variable Strength Pulse Torpedo (5.14).
 *
 * One launcher, three settings chosen in the Write Orders Phase, and the
 * setting picks both the table line and the warhead:
 *
 * - long: LR line, 1D3 SAP, bypasses Standard Screens;
 * - standard: standard line, 1D6 SAP, bypasses Standard Screens;
 * - short: SR line, 1D6+2 AP, *"will bypass both Standard and Advanced
 *   Screens"* — the only weapon in the section that ignores screens outright.
 *
 * 5.14: *"If a setting is not selected it is assumed the VPT is set to
 * standard."*
 */
export function fireVariablePulseTorpedo(
  weapon: WeaponDef,
  ctx: KineticContext,
): WeaponResult | null {
  if (weapon.weaponClass !== 'pulse-torpedo') return null
  const setting = ctx.vptMode ?? 'standard'
  const shot = rollProjectileHit(setting, ctx.range, ctx.rng, ctx.drm)
  if (shot === null) return null

  const mode: DamageMode = setting === 'short' ? 'AP' : 'SAP'
  const label = `VPT (${setting}) needs ${shot.target}+`
  if (!shot.hit) return noDamage(mode, [shot.face], `${label}: rolled ${shot.face} — miss`)

  // The short setting bypasses Advanced Screens as well, so it takes no
  // screen penalty at all; the other two take 7.3's −1 per level.
  const screens = setting === 'short' ? 0 : advancedScreenLevel(ctx)

  if (setting === 'long') {
    const roll = d3(ctx.rng)
    const damage = Math.max(0, roll.value - screens)
    return {
      normalDamage: damage,
      penetratingDamage: 0,
      mode,
      dice: [shot.face, roll.face],
      detail: `${label}: hit on ${shot.face}, 1D3 = ${roll.value}${screens > 0 ? ` −${screens}` : ''} → ${damage} SAP`,
    }
  }

  const bonus = setting === 'short' ? 2 : 0
  const damageDie = d6(ctx.rng)
  const damage = Math.max(0, damageDie + bonus - screens)
  return {
    normalDamage: damage,
    penetratingDamage: 0,
    mode,
    dice: [shot.face, damageDie],
    detail: `${label}: hit on ${shot.face}, 1D6 = ${damageDie}${bonus ? `+${bonus}` : ''}${screens > 0 ? ` −${screens}` : ''} → ${damage} ${mode}`,
  }
}

// ---------------------------------------------------------------------------
// 5.15 Turreted Submunition Pack (P)
// ---------------------------------------------------------------------------

/** 5.15: *"3 BD hits to 6 MU, 2 BD to 12 MU, and 1 BD to 18 MU"*. */
export const SUBMUNITION_DICE: readonly number[] = [3, 2, 1]
export const SUBMUNITION_BAND_MU = 6

/**
 * Fire a Submunition Pack (5.15).
 *
 * A one-shot pack of beam dice with re-rolls that ignores Standard Screens.
 * Against Advanced Screens it is the weapon 7.3 has in mind when it says
 * *"SMPs and similar weapons that ignore Standard Screens and roll a combined
 * hit and damage D6 are affected by Advanced Screens as if they were beams"*,
 * so the Advanced level goes straight into the beam table.
 */
export function fireSubmunitionPack(weapon: WeaponDef, ctx: KineticContext): WeaponResult | null {
  if (!hasShot(weapon)) return null
  const band = rangeBand(ctx.range, SUBMUNITION_BAND_MU)
  if (band > SUBMUNITION_DICE.length) return null
  const dice = SUBMUNITION_DICE[band - 1]
  const volley = rollBeamVolley(dice, advancedScreenLevel(ctx), ctx.rng, {
    drm: ctx.drm,
    penetrating: true,
  })
  return beamVolleyResult(volley, 'P', `Submunition Pack ${dice}BD* at ${ctx.range} MU`)
}

// ---------------------------------------------------------------------------
// 5.16 K-Guns (AP)
// ---------------------------------------------------------------------------

/**
 * Mass of a K-Gun by class, variant and arc count (5.16).
 *
 * The printed table is followed rather than the parenthetical rules of thumb
 * where the two disagree: *"Short range K-Guns are half the mass, rounded up"*
 * would make an SRK-1 mass 1, but the table prints 1.5 and then sells them
 * *"in pairs for 3 mass"*, so 1.5 it is.
 */
export function kGunMass(rating: number, variant: WeaponVariant, arcs: number): number {
  const line = projectileLine(variant)
  const count = Math.max(1, Math.floor(arcs))
  if (rating === 1) {
    // K-1s are 6-arc mounts as standard; there is no cheaper narrow version.
    return line === 'short' ? 1.5 : line === 'long' ? 4 : 2
  }
  if (rating === 2) {
    if (line === 'short') return 2 // "SRK-2 mass 2 2 arcs" — flat, both arcs included.
    if (line === 'long') return count >= 2 ? 8 : 6 // "+2 mass for an additional arc"
    return count >= 2 ? 4 : 3 // "+1 mass for an additional arc"
  }
  const standard: Record<number, number> = { 3: 5, 4: 8, 5: 11, 6: 14 }
  const base = standard[rating] ?? 0
  if (line === 'short') {
    const shortTable: Record<number, number> = { 3: 3, 4: 4, 5: 6, 6: 7 }
    return shortTable[rating] ?? Math.ceil(base / 2)
  }
  if (line === 'long') return base * 2
  return base
}

/**
 * Whether a K-Gun hit doubles its damage (5.16).
 *
 * *"Roll a d6, if the result is equal to or less than the class of the K-Gun,
 * the damage done is doubled. A roll of a 6 is always a failure"*, and
 * Advanced Screens *"deduct the advanced screen level from the class of the
 * K-gun to give the final number for the die roll"* — so a K-4 against level-2
 * Advanced Screens doubles on 1-2, and a K-1 or K-2 against them cannot double
 * at all.
 */
export function kGunDoubles(rating: number, advancedScreens: number, roll: number): boolean {
  if (roll === 6) return false
  return roll <= rating - advancedScreens
}

/**
 * Fire a K-Gun (5.16).
 *
 * Hit on the projectile table, then damage equal to the gun's class, doubled
 * on the doubling roll. All of it is AP: *"the hypervelocity slugs easily punch
 * through most armor"*. Standard Screens do nothing; Advanced Screens only
 * make doubling harder — they do not reduce the base damage, which is why the
 * doubling roll is the only place `advancedScreenLevel` appears here.
 */
export function fireKGun(weapon: WeaponDef, ctx: KineticContext): WeaponResult | null {
  const line = projectileLine(weapon.variant)
  const shot = rollProjectileHit(line, ctx.range, ctx.rng, ctx.drm)
  if (shot === null) return null
  const label = `K-${weapon.rating} (${line}) needs ${shot.target}+`
  if (!shot.hit) return noDamage('AP', [shot.face], `${label}: rolled ${shot.face} — miss`)

  const screens = advancedScreenLevel(ctx)
  const doubleRoll = d6(ctx.rng)
  const doubled = kGunDoubles(weapon.rating, screens, doubleRoll)
  const damage = doubled ? weapon.rating * 2 : weapon.rating
  return {
    normalDamage: damage,
    penetratingDamage: 0,
    mode: 'AP',
    dice: [shot.face, doubleRoll],
    detail: `${label}: hit on ${shot.face}, doubling ${doubleRoll} vs ${weapon.rating - screens} → ${damage} AP${doubled ? ' (doubled)' : ''}`,
  }
}

/** 5.16: a K-1 used as point defence fires *"with a -1 DRM"*. */
export const K_GUN_PD_DRM = -1

/**
 * Whether this mount may put up point defence into this arc (5.16, 7.12).
 *
 * Only K-1s are dual purpose, and unlike a PDS — which 7.12 lets fire into any
 * arc *"including the rear arc"* — a K-1 *"cannot fire into the aft arc of the
 * ship"*.
 */
export function kGunCanPointDefend(weapon: WeaponDef, arc: Arc): boolean {
  if (weapon.weaponClass !== 'k-gun' || weapon.rating !== 1) return false
  if (arc === 'A') return false
  return weapon.arcs.includes(arc)
}

/** A rolled clutch of point-defence dice (7.12, 8.8). */
export interface PointDefenceVolley {
  rolls: number[]
  kills: number
}

/**
 * Point-defence dice with a DRM (7.12, 8.8, 5.16).
 *
 * `dice.pointDefenceKills` scores a PDS die but takes no modifier, and both
 * the K-1 and the Flak barrage are −1, so the scoring is repeated here with
 * the DRM in it. The re-roll test is on the *natural* six, because 4.6 is
 * general about it: *"Re-rolls are made for a natural (unmodified) 6 only"* —
 * a natural six at −1 kills one rather than two, and still re-rolls.
 */
export function rollPointDefenceDice(dice: number, rng: Rng, drm = 0): PointDefenceVolley {
  const rolls: number[] = []
  let kills = 0
  const resolve = (): void => {
    const face = d6(rng)
    rolls.push(face)
    const modified = face + drm
    if (modified >= 6) kills += 2
    else if (modified >= 4) kills += 1
    if (face === 6) resolve()
  }
  for (let i = 0; i < dice; i++) resolve()
  return { rolls, kills }
}

/** One K-1 firing as point defence (5.16): a single PDS die at −1. */
export function fireKGunPointDefence(rng: Rng): PointDefenceVolley {
  return rollPointDefenceDice(1, rng, K_GUN_PD_DRM)
}

// --- Flak ammunition / barrage fire (5.16) ---------------------------------

/** 5.16: the Flak round *"will detonate against any fighter or missile … within 2 MU"*. */
export const FLAK_BLAST_RADIUS_MU = 2

/** 5.16: the barrage's dice are thrown *"at a -1 DRM"*. */
export const FLAK_DRM = -1

/**
 * How far up-range a Blast Marker may be placed (5.16): *"up to 24 MU away for
 * long range guns, 18 for standard and 12 for short"*. These three numbers are
 * also the only statement in the source text of how far a K-Gun shoots, which
 * is where `PROJECTILE_HIT_TABLE`'s reach comes from.
 */
export const FLAK_MARKER_RANGE: Record<ProjectileLine, number> = {
  short: 12,
  standard: 18,
  long: 24,
}

/** 5.16: *"K-Guns of class 2 or larger can be equipped to fire"* Flak. */
export function canMountFlak(weapon: WeaponDef): boolean {
  return weapon.weaponClass === 'k-gun' && weapon.rating >= 2
}

/**
 * Resolve a Flak barrage against one fighter or missile marker caught in the
 * blast (5.16): *"a number of PDS dice equal to the class of the gun that fired
 * the barrage (at a -1 DRM)"*.
 *
 * Against a Salvo Missile marker the kills are banked, not applied: 5.16 has
 * the player *"roll to see how many hits the Flak barrage scores on the missile
 * marker and keep track of it until the Missile Attack Phase. Then subtract
 * that from the number of missiles that lock on."*
 */
export function rollFlakBarrage(rating: number, rng: Rng): PointDefenceVolley {
  return rollPointDefenceDice(rating, rng, FLAK_DRM)
}

/**
 * A ship caught in a Flak blast (5.16): *"If a ship, friendly or enemy, is
 * within the blast range it will take a single point of damage on a roll of
 * 1."* One die per ship, not per gun-class die.
 */
export function rollFlakShipHit(rng: Rng): { roll: number; damage: number } {
  const roll = d6(rng)
  return { roll, damage: roll === 1 ? 1 : 0 }
}

/** Whether a point sits inside a Blast Marker's radius (5.16). */
export function flakCatchesPoint(marker: Point, position: Point): boolean {
  return distance(marker, position) <= FLAK_BLAST_RADIUS_MU
}

/**
 * Whether something *"travelling through"* the blast is caught (5.16) — a
 * fighter group's or missile's whole move is tested, not just where it stopped,
 * which is the point of placing the marker in the Launch Missile Phase before
 * anything moves.
 */
export function flakCatchesPath(marker: Point, from: Point, to: Point): boolean {
  return distanceToSegment(marker, from, to) <= FLAK_BLAST_RADIUS_MU
}

/** Shortest distance from a point to a line segment, in MU. */
function distanceToSegment(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return distance(point, from)
  const t = Math.max(
    0,
    Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared),
  )
  return distance(point, { x: from.x + t * dx, y: from.y + t * dy })
}

// ---------------------------------------------------------------------------
// 5.17 Multiple Kinetic Penetrators
// ---------------------------------------------------------------------------

/** 5.17: *"An MKP has a range of 12 MU, and hits on a roll of 4+."* */
export const MKP_RANGE_MU = 12
export const MKP_HIT_ON = 4
/** 5.17: *"Each hit inflicts 4 points of damage (AP)."* */
export const MKP_DAMAGE_PER_HIT = 4

/**
 * Fire a Multiple Kinetic Penetrator (5.17).
 *
 * One shot, one die: 4+ hits, and *"on a roll of a 6 it hits twice"*. Its
 * damage is flat, so neither kind of screen touches it — 5.17 says plainly
 * *"As projectiles, MKPs ignore screens"*, and 7.3's Advanced Screen rules
 * both bite on a *damage die*, of which the MKP rolls none.
 */
export function fireMkp(weapon: WeaponDef, ctx: KineticContext): WeaponResult | null {
  if (!hasShot(weapon)) return null
  if (ctx.range > MKP_RANGE_MU) return null
  const face = d6(ctx.rng)
  const modified = face + ctx.drm
  const hits = modified >= 6 ? 2 : modified >= MKP_HIT_ON ? 1 : 0
  const damage = hits * MKP_DAMAGE_PER_HIT
  return {
    normalDamage: damage,
    penetratingDamage: 0,
    mode: 'AP',
    dice: [face],
    detail: `MKP needs ${MKP_HIT_ON}+: rolled ${face} → ${hits} hit(s), ${damage} AP`,
  }
}

// ---------------------------------------------------------------------------
// 5.18 Boarding Torpedoes
// ---------------------------------------------------------------------------

/** 5.18: a hit places *"two 'Marine' markers … on the enemy ship"*. */
export const BOARDING_TORPEDO_MARINES = 2

/**
 * Fire a Boarding Torpedo (5.18).
 *
 * Standard projectile line — *"There are no long-range or short-range versions
 * available"* — and on a hit *"one point of damage to the target's hull,
 * bypassing any armor"*, plus two boarding parties.
 *
 * That single point is reported as `penetratingDamage` rather than
 * `normalDamage`: the contract's normal pile is what armour may absorb, and
 * 4.9's AP rule would put one point per layer *on* the armour, which is the
 * opposite of what 5.18 asks for. (On a ship with shell armour, `combat.ts`
 * still lands penetrating damage on the next layer in rather than the hull —
 * as close as the engine's damage pipeline gets to "bypassing any armor".)
 *
 * A miss still returns a result, because a Boarding Torpedo is expended
 * *"every time it fires, hit or miss"*; only an empty magazine or an
 * out-of-range target returns null.
 */
export function fireBoardingTorpedo(weapon: WeaponDef, ctx: KineticContext): WeaponResult | null {
  if (!hasShot(weapon)) return null
  const shot = rollProjectileHit('standard', ctx.range, ctx.rng, ctx.drm)
  if (shot === null) return null
  const label = `Boarding Torpedo needs ${shot.target}+`
  if (!shot.hit) return noDamage('AP', [shot.face], `${label}: rolled ${shot.face} — miss`)
  return {
    normalDamage: 0,
    penetratingDamage: 1,
    mode: 'AP',
    dice: [shot.face],
    detail: `${label}: hit on ${shot.face} → 1 damage to hull, ${BOARDING_TORPEDO_MARINES} Marine markers`,
    boarders: BOARDING_TORPEDO_MARINES,
  }
}

// ---------------------------------------------------------------------------
// 5.19 Fusion Array
// ---------------------------------------------------------------------------

/** The two configurations of a Fusion Array (5.19). */
export type FusionMode = 'flare' | 'torpedo'

/** One row of a Fusion Array table: the number needed and the dice it earns. */
export interface FusionRow {
  hitsOn: number
  dice: number
}

/**
 * The Fusion Array tables (5.19), by 6 MU band out to 36 MU.
 *
 * The Flare is easy to hit with and feeble up close and the Torpedo is the
 * mirror image, and in both the number needed and the dice earned rise
 * together — a Flare that hits at 30-36 MU needs a 6 and throws 6 BD*.
 */
export const FUSION_BAND_MU = 6

export const FUSION_ARRAY_TABLE: Record<FusionMode, readonly FusionRow[]> = {
  flare: [
    { hitsOn: 1, dice: 1 },
    { hitsOn: 2, dice: 2 },
    { hitsOn: 3, dice: 3 },
    { hitsOn: 4, dice: 4 },
    { hitsOn: 5, dice: 5 },
    { hitsOn: 6, dice: 6 },
  ],
  torpedo: [
    { hitsOn: 6, dice: 6 },
    { hitsOn: 5, dice: 5 },
    { hitsOn: 4, dice: 4 },
    { hitsOn: 3, dice: 3 },
    { hitsOn: 2, dice: 2 },
    { hitsOn: 1, dice: 1 },
  ],
}

/**
 * Which mode a Fusion Array is in (5.19).
 *
 * The mode is a standing configuration — *"The array must be configured before
 * combat begins"* — so it rides on `WeaponDef.variant`, where `long` is the
 * long-legged Torpedo and everything else is the Flare. An array that has spent
 * a turn off line switching modes passes the new mode in the context instead.
 */
export function fusionArrayMode(weapon: WeaponDef, ctx: KineticContext): FusionMode {
  if (ctx.fusionMode) return ctx.fusionMode
  return weapon.variant === 'long' ? 'torpedo' : 'flare'
}

/**
 * Fire a Fusion Array (5.19).
 *
 * It *"fires and hits as a modified projectile weapon, yet does damage in
 * BD*"*, so there are two rolls: one against the table, then a beam volley
 * with re-rolls. Standard Screens are ignored; *"Advanced Screens will prevent
 * damage the same way they would against beam weapons"*, so the Advanced level
 * goes into the beam table.
 *
 * The DRM is spent on the to-hit roll only. The damage dice are a separate
 * roll from the hit, so putting ECM on both would charge the attacker twice
 * for one jammer.
 */
export function fireFusionArray(weapon: WeaponDef, ctx: KineticContext): WeaponResult | null {
  const mode = fusionArrayMode(weapon, ctx)
  const table = FUSION_ARRAY_TABLE[mode]
  const band = rangeBand(ctx.range, FUSION_BAND_MU)
  if (band > table.length) return null
  const row = table[band - 1]
  const face = d6(ctx.rng)
  const modified = face + ctx.drm
  const label = `Fusion ${mode} needs ${row.hitsOn}+`
  if (modified < row.hitsOn) {
    return noDamage('P', [face], `${label}: rolled ${face} — miss`)
  }
  const volley = rollBeamVolley(row.dice, advancedScreenLevel(ctx), ctx.rng, {
    penetrating: true,
  })
  const result = beamVolleyResult(volley, 'P', `${label}: hit on ${face}, ${row.dice}BD*`)
  return { ...result, dice: [face, ...result.dice] }
}

/**
 * A Fusion Array shooting at a fighter group (5.19): *"both the Flare and
 * Fusion Torpedo deliver a single hit, on a 6+ destroying one fighter"* —
 * one die whatever the range or mode. This is offensive fire at a group
 * (4.4 charges a FireCon for it), not point defence.
 */
export function rollFusionArrayVsFighters(rng: Rng, drm = 0): { roll: number; kills: number } {
  const roll = d6(rng)
  return { roll, kills: roll + drm >= 6 ? 1 : 0 }
}

// ---------------------------------------------------------------------------
// 5.20 Gravitic Guns
// ---------------------------------------------------------------------------

/**
 * Fire a Gravitic Gun (5.20).
 *
 * *"Gravitic Guns generate beam dice, and hit like a normal beam weapon"*, so
 * they take the standard 12 MU band per class (4.3, 4.5) and screens of either
 * kind cut them as they would a beam (7.3). The section heading carries no (P)
 * and the text never says BD*, so — reading 4.6's *"If a beam type weapon does
 * not cause re-rolls it will be designated simply BD"* — there are no re-rolls.
 *
 * The one number this resolver cannot get right is the damage: *"The damage
 * inflicted by the hits depends on the speed of the target"* and the source
 * text gives no table for it. Rather than invent one, each hit does 1 point —
 * a plain beam — unless the caller supplies `graviticDamagePerHit`, which is
 * where that table goes when it is found.
 */
export function fireGraviticGun(weapon: WeaponDef, ctx: KineticContext): WeaponResult | null {
  const dice = beamDiceAtRange(weapon.rating, ctx.range)
  if (dice <= 0) return null
  const volley = rollBeamVolley(dice, ctx.targetScreens, ctx.rng, {
    drm: ctx.drm,
    penetrating: false,
  })
  const perHit = ctx.graviticDamagePerHit ? ctx.graviticDamagePerHit(ctx.targetVelocity ?? 0) : 1
  const faces = volley.dice.map((die) => die.natural)
  const damage = volley.normalDamage * perHit
  return {
    normalDamage: damage,
    penetratingDamage: 0,
    mode: 'standard',
    dice: faces,
    detail: `Grav-${weapon.rating} ${dice}BD vs screen-${ctx.targetScreens}: ${faces.join(',') || '—'} → ${volley.normalDamage} hit(s) × ${perHit} = ${damage}`,
  }
}

// ---------------------------------------------------------------------------
// 5.21 Pulsers (P)
// ---------------------------------------------------------------------------

/** The three settings a Pulser can be configured to before a battle (5.21). */
export type PulserSetting = 'short' | 'medium' | 'long'

/**
 * 5.21: *"Set as a short range weapon a Pulser generates 6 BD* to 12 MU. Set as
 * a medium range weapon a Pulser generates 2 BD* to 24 MU. Set as a long range
 * weapon a Pulser generates 1 BD* to 48 MU."*
 *
 * Each setting is a single range band — the dice do not fall off with range,
 * they simply stop at the stated distance.
 */
export const PULSER_PROFILE: Record<PulserSetting, { dice: number; range: number }> = {
  short: { dice: 6, range: 12 },
  medium: { dice: 2, range: 24 },
  long: { dice: 1, range: 48 },
}

/** Mass of a Pulser mount by arc count (5.21): 1 arc 2, 3 arcs 3, 6 arcs 4. */
export function pulserMass(arcs: number): number {
  if (arcs >= 6) return 4
  if (arcs >= 3) return 3
  return 2
}

/** The setting a Pulser mount is configured to, read off its variant (5.21). */
export function pulserSetting(variant: WeaponVariant): PulserSetting {
  if (variant === 'short') return 'short'
  if (variant === 'long') return 'long'
  return 'medium'
}

/** 5.21: *"In PDS mode the Pulser delivers a single dice of point defense fire."* */
export const PULSER_PD_DICE = 1

/**
 * Whether a Pulser may put up point defence into this arc (5.21).
 *
 * *"In PDS mode the Pulser is limited to the fire arcs of the weapon mount, but
 * if the arcs permit it may fire into the aft arc of the ship."* The later
 * sentence — *"A Pulser configured for short range cannot use its beam dice for
 * defensive fire"* — is read as a clarification rather than a ban: every Pulser
 * gets the one PD die, and what a short Pulser may not do is throw its six beam
 * dice at fighters.
 */
export function pulserCanPointDefend(weapon: WeaponDef, arc: Arc): boolean {
  return weapon.weaponClass === 'pulser' && weapon.arcs.includes(arc)
}

/** Fire a Pulser (5.21): flat beam dice with re-rolls out to its set range. */
export function firePulser(weapon: WeaponDef, ctx: KineticContext): WeaponResult | null {
  const setting = pulserSetting(weapon.variant)
  const profile = PULSER_PROFILE[setting]
  if (ctx.range > profile.range) return null
  const volley = rollBeamVolley(profile.dice, ctx.targetScreens, ctx.rng, {
    drm: ctx.drm,
    penetrating: true,
  })
  return beamVolleyResult(volley, 'P', `Pulser (${setting}) ${profile.dice}BD*`)
}

// ---------------------------------------------------------------------------
// 5.22 Turrets
// ---------------------------------------------------------------------------

/** How many arcs a turret can be built to bear into (5.22). */
export type TurretArcCount = 2 | 3 | 4 | 5 | 6

/**
 * The turret capacity trade (5.22): mass of weapons that one mass of turret
 * carries, by the number of arcs the turret bears into.
 *
 * *"6 arc turret: 1 mass of turret holds 2 mass of weapons. 5 arc turret: …3.
 * 4 arc turret: …4. 3 arc turret: …5. 2 arc turret: …6."* Coverage is bought
 * with capacity: the same one mass of machinery either sweeps the sky or lifts
 * a big gun, never both.
 */
export const TURRET_CAPACITY: Record<TurretArcCount, number> = {
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 2,
}

/** 5.22: *"Turrets cost 3 per mass."* */
export const TURRET_COST_PER_MASS = 3

/**
 * Mass of the turret needed to carry `weaponMass` of guns into `arcs` arcs
 * (5.22): *"When determining turret size, round all fractions up."*
 */
export function turretMass(weaponMass: number, arcs: TurretArcCount): number {
  return Math.ceil(weaponMass / TURRET_CAPACITY[arcs])
}

/** Points for a turret of this size (5.22). */
export function turretPoints(mass: number): number {
  return mass * TURRET_COST_PER_MASS
}

/** 5.22: *"A ship is limited to one turret per size 50 mass of ship."* */
export function maxTurrets(shipMass: number): number {
  return Math.floor(shipMass / 50)
}

/**
 * The arcs a weapon can be brought to bear into once it is in a turret (5.22).
 *
 * The turret replaces the weapon's own arcs rather than adding to them: a
 * single-arc K-4 in a 4-arc turret can be swung into any of four arcs, but
 * *"Weapons with more than 1 arc that are mounted in a turret lose their
 * additional arcs"*, so a 3-arc mount in a 2-arc turret is narrowed to two.
 * A weapon that is not in this turret keeps what it has.
 */
export function turretMountedArcs(weapon: WeaponDef, turret: TurretDef): Arc[] {
  if (weapon.turretId !== turret.id) return [...weapon.arcs]
  return [...turret.arcs]
}

/**
 * The arc a turret's weapons actually fire into this turn (5.22).
 *
 * *"During the Write Orders Phase the facing of each turret must be recorded"*
 * and *"The weapons in a turret can fire into the single 60-degree arc that the
 * turret is facing"* — so with a facing recorded there is exactly one arc, and
 * without one the turret is still free to take any arc it covers. A turret
 * knocked out by a threshold check or a Needle Beam *"remains stuck in its
 * current facing until repaired"*: pass that facing and it still shoots there.
 */
export function turretFiringArcs(turret: TurretDef, facing?: Arc): Arc[] {
  if (facing === undefined) return [...turret.arcs]
  return turret.arcs.includes(facing) ? [facing] : []
}

// ---------------------------------------------------------------------------
// 5.23 Spinal Mounts
// ---------------------------------------------------------------------------

/** The three sizes every Spinal Mount is built in (5.23). */
export type SpinalSize = 'small' | 'medium' | 'large'

/**
 * 5.23: *"Small 8 mass / 24 MU / 1 MU beam width; Medium 16 / 36 / 1.5;
 * Large 32 / 48 / 2."*
 *
 * The dice never fall off with range — *"The tight focus of the beam means that
 * little power is lost with distance, so Spinal Mounts deliver the same number
 * of damage dice along their entire range"* — so size buys reach and width,
 * not firepower.
 */
export const SPINAL_MOUNT_PROFILE: Record<
  SpinalSize,
  { mass: number; range: number; beamWidth: number }
> = {
  small: { mass: 8, range: 24, beamWidth: 1 },
  medium: { mass: 16, range: 36, beamWidth: 1.5 },
  large: { mass: 32, range: 48, beamWidth: 2 },
}

/** 5.23: a Spinal Mount's arc is *"half the normal width (30 degrees)"*. */
export const SPINAL_ARC_DEGREES = 30

/** 5.23: *"A ship may only mount up to 16 mass of Spinal Mount weapon per 50 mass of ship."* */
export const SPINAL_MASS_PER_50 = 16

/**
 * Spinal Mount mass a hull may carry (5.23), which the rulebook checks with
 * *"a battleship (mass 101-150) could mount up to three Medium Spinal
 * Mounts"* — 150 mass buys 48, which is three Mediums.
 */
export function maxSpinalMountMass(shipMass: number): number {
  return Math.floor(shipMass / 50) * SPINAL_MASS_PER_50
}

/**
 * The size of a Spinal Mount as fitted (5.23). `rating` carries it — 1 Small,
 * 2 Medium, 3 Large — and a design that leaves the rating off is read off the
 * mount's mass instead, since the three masses are unmistakable.
 */
export function spinalSize(weapon: WeaponDef): SpinalSize {
  if (weapon.rating === 1) return 'small'
  if (weapon.rating === 2) return 'medium'
  if (weapon.rating === 3) return 'large'
  if (weapon.mass >= SPINAL_MOUNT_PROFILE.large.mass) return 'large'
  if (weapon.mass >= SPINAL_MOUNT_PROFILE.medium.mass) return 'medium'
  return 'small'
}

/**
 * 5.23: *"Spinal Mounts may only be fired every other turn"*. `lastFiredTurn`
 * is null for a mount that has not fired yet.
 */
export function spinalCanFire(lastFiredTurn: number | null, turn: number): boolean {
  return lastFiredTurn === null || turn - lastFiredTurn >= 2
}

/**
 * 5.23: *"The turn after a Spinal Mount if fired a ship cannot maneuver at all,
 * apply thrust, nor can it charge its FTL drive."* True on exactly the turn
 * after the shot.
 */
export function spinalLocksShip(lastFiredTurn: number | null, turn: number): boolean {
  return lastFiredTurn !== null && turn === lastFiredTurn + 1
}

/**
 * Whether an aim point lies in the 30-degree spinal arc (5.23).
 *
 * *"Spinal Mounts must face forward … and have a fire arc that is half the
 * normal width"*, so the beam may be laid anywhere within 15 degrees either
 * side of the bow. The aim point may be *"an 'empty point of space'"* — it does
 * not have to be a ship.
 */
export function isInSpinalArc(origin: Point, facing: Course, aim: Point): boolean {
  const relative = ((bearing(origin, aim) - courseToDegrees(facing)) % 360 + 360) % 360
  const offset = relative > 180 ? 360 - relative : relative
  return offset <= SPINAL_ARC_DEGREES / 2
}

/**
 * Whether a model is caught in the beam (5.23): *"Spinal Mounts all fire a beam
 * of energy that can hit any model caught within"*, and *"If multiple ships are
 * within the beam area, they all sustain the same number of dice of hits"*.
 *
 * The beam is a swathe of the mount's own width laid from the firing ship to
 * the aim point and on to the end of its range, so a model is caught when it
 * lies within half that width of the line and no further down it than the
 * weapon reaches. Missiles, fighters, gunboats and Plasma Bolts are caught the
 * same way, *"there is no negative DRM for shooting anti-ship weapons at small
 * targets"*.
 */
export function spinalBeamCatches(
  origin: Point,
  aim: Point,
  target: Point,
  size: SpinalSize,
): boolean {
  const profile = SPINAL_MOUNT_PROFILE[size]
  const dx = aim.x - origin.x
  const dy = aim.y - origin.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return false
  const ux = dx / length
  const uy = dy / length
  const along = (target.x - origin.x) * ux + (target.y - origin.y) * uy
  if (along < 0 || along > profile.range) return false
  const across = Math.abs((target.x - origin.x) * -uy + (target.y - origin.y) * ux)
  return across <= profile.beamWidth / 2
}

/** 5.23: *"Beam Spinal Mounts generate 12 BD* hits within the beam area."* */
export const SPINAL_BEAM_DICE = 12

/**
 * Fire a Beam Spinal Mount (5.23).
 *
 * Twelve penetrating beam dice at any range inside the beam, and *"Screens have
 * their normal effect on these hits"*. 5.23 also has the mount ignore *"the
 * range reduction of Stealth and DRM of Holofields"*, which is the caller's
 * business: `ctx.drm` should reach here without either of those in it.
 */
export function fireSpinalBeam(weapon: WeaponDef, ctx: KineticContext): WeaponResult | null {
  const profile = SPINAL_MOUNT_PROFILE[spinalSize(weapon)]
  if (ctx.range > profile.range) return null
  const volley = rollBeamVolley(SPINAL_BEAM_DICE, ctx.targetScreens, ctx.rng, {
    drm: ctx.drm,
    penetrating: true,
  })
  return beamVolleyResult(volley, 'P', `Beam Spinal Mount ${SPINAL_BEAM_DICE}BD*`)
}

/** 5.23: *"They generate 6 Plasma Cannon dice within the beam area."* */
export const SPINAL_PLASMA_DICE = 6

/**
 * Fire a Plasma Spinal Mount (5.23).
 *
 * *"These inflict 1d6-2-screens hits to all targets within the beam area, with
 * rerolls on sixes"* — the Plasma Cannon table of 5.5, where a 3 is one hit
 * and a 6 is four hits, penetrates, and re-rolls. Each hit is one damage
 * point. *"Note that there is no -1 for Holofields, which are ignored by area
 * of effect weapons."*
 *
 * The re-roll dice are scored without the screen subtraction and their damage
 * is penetrating, because 4.6 has a re-roll *"assumed to have already
 * penetrated the screen"*.
 */
export function firePlasmaSpinal(weapon: WeaponDef, ctx: KineticContext): WeaponResult | null {
  const profile = SPINAL_MOUNT_PROFILE[spinalSize(weapon)]
  if (ctx.range > profile.range) return null
  const rolled = rollPlasmaDice(SPINAL_PLASMA_DICE, ctx.targetScreens, ctx.rng, ctx.drm)
  return {
    normalDamage: rolled.normalDamage,
    penetratingDamage: rolled.penetratingDamage,
    mode: 'P',
    dice: rolled.faces,
    detail: `Plasma Spinal Mount ${SPINAL_PLASMA_DICE}D6 vs screen-${ctx.targetScreens}: ${rolled.faces.join(',')} → ${rolled.normalDamage}+${rolled.penetratingDamage}P hits`,
  }
}

/** A rolled clutch of Plasma Cannon dice (5.5, 5.23). */
export interface PlasmaVolley {
  faces: number[]
  normalDamage: number
  penetratingDamage: number
}

/**
 * Plasma Cannon dice (5.5, as used by the Plasma Spinal Mount, 5.23): each die
 * inflicts `1d6 − 2 − screens` hits, minimum none, and a natural 6 inflicts
 * four, penetrates and re-rolls.
 *
 * This lives here rather than being imported from the Plasma Cannon module
 * because the Plasma Spinal Mount is part of section 5.23 and has to be
 * resolvable on its own.
 */
export function rollPlasmaDice(
  count: number,
  screens: ScreenLevel,
  rng: Rng,
  drm = 0,
): PlasmaVolley {
  const faces: number[] = []
  let normalDamage = 0
  let penetratingDamage = 0

  const resolve = (isReroll: boolean): void => {
    const face = d6(rng)
    faces.push(face)
    const modified = Math.max(1, Math.min(6, face + drm))
    const hits = Math.max(0, modified - 2 - (isReroll ? 0 : screens))
    if (isReroll) penetratingDamage += hits
    else normalDamage += hits
    if (face === 6) resolve(true)
  }

  for (let i = 0; i < count; i++) resolve(false)
  return { faces, normalDamage, penetratingDamage }
}

/** 5.23: *"The PSP only generates 2 BD (no rerolls) of hits along its flight path."* */
export const PSP_DICE = 2

/**
 * Damage dice one PSP hit inflicts on a ship (5.23): *"the damage per hit is
 * 1d6 per 50 mass of ship. … The bigger the ship is, the worse the damage
 * inflicted."* One die per complete 50 mass, and never fewer than one, so an
 * escort is not immune.
 *
 * The rulebook's own example — *"if two hits were scored against a mass 100 BC
 * it would suffer 2d6 damage"* — works out to 4d6 under this reading. The
 * example cannot be squared with the rule it illustrates: 2d6 is what you get
 * from *either* half of "1d6 per hit per 50 mass" taken alone, never from both
 * together. The rule sentence is the rule, and the scaling is the whole point
 * of the weapon, so the sentence wins and the example is read as an arithmetic
 * slip. See `docs/rules/weapons-kinetic.md`.
 */
export function pspDamageDicePerHit(targetMass: number): number {
  return Math.max(1, Math.floor(targetMass / 50))
}

/**
 * Fire a Point Singularity Projector (5.23).
 *
 * Two beam dice with no re-rolls give the *hits* — 4 or 5 is one hit, 6 is two
 * — and *"The damage from a PSP is armor piercing, and is not affected by
 * screens of any type"*, so the hit dice are read unscreened. Each hit is 1
 * damage against small craft and `1d6 per 50 mass` against a ship.
 */
export function firePsp(weapon: WeaponDef, ctx: KineticContext): WeaponResult | null {
  const profile = SPINAL_MOUNT_PROFILE[spinalSize(weapon)]
  if (ctx.range > profile.range) return null
  // Screens of any type are ignored, so the hit dice are rolled as unscreened.
  const volley = rollBeamVolley(PSP_DICE, 0, ctx.rng, { drm: ctx.drm, penetrating: false })
  const hits = volley.normalDamage
  const faces = volley.dice.map((die) => die.natural)

  if (ctx.targetIsSmallCraft) {
    return {
      normalDamage: hits,
      penetratingDamage: 0,
      mode: 'AP',
      dice: faces,
      detail: `PSP ${PSP_DICE}BD: ${faces.join(',')} → ${hits} hit(s), 1 damage each`,
    }
  }

  const perHit = pspDamageDicePerHit(ctx.targetMass ?? 50)
  const damageFaces: number[] = []
  let damage = 0
  for (let i = 0; i < hits * perHit; i++) {
    const face = d6(ctx.rng)
    damageFaces.push(face)
    damage += face
  }
  return {
    normalDamage: damage,
    penetratingDamage: 0,
    mode: 'AP',
    dice: [...faces, ...damageFaces],
    detail: `PSP ${PSP_DICE}BD: ${faces.join(',')} → ${hits} hit(s) × ${perHit}D6 = ${damage} AP`,
  }
}

// ---------------------------------------------------------------------------
// Costs (5.14 – 5.23)
// ---------------------------------------------------------------------------

/**
 * Points per mass for every system in this module (5.14 – 5.23). Mass comes
 * off each weapon's own table; these are the multipliers the sections state.
 */
export const KINETIC_COST_PER_MASS = {
  'pulse-torpedo': 3,
  /** 5.14: a Variable Strength tube is 5 per mass, not 3. */
  'variable-pulse-torpedo': 5,
  /** 5.14: *"The overload upgrade costs +1 point per mass."* */
  'pulse-torpedo-overload': 1,
  'submunition-pack': 3,
  'k-gun': 4,
  mkp: 4,
  'boarding-torpedo': 3,
  'fusion-array': 3,
  'gravitic-gun': 3,
  pulser: 5,
  turret: 3,
  'spinal-beam': 4,
  'spinal-plasma': 4,
  'spinal-psp': 5,
} as const

/** 5.16: *"For an additional 2 points a K-Gun may be equipped with Flak ammunition."* */
export const FLAK_UPGRADE_POINTS = 2

// ---------------------------------------------------------------------------
// The spec table
// ---------------------------------------------------------------------------

/**
 * Every kinetic and exotic weapon of sections 5.14 – 5.23, ready for
 * `weapons/index.ts` to collect (see `weapons/contract.ts`).
 *
 * `requiresFireCon` is true throughout: 5.2 needs one for *"Firing ship weapons
 * (not point defense) at a single ship or fighter group"*, and 5.23 is explicit
 * that even a Spinal Mount aimed at empty space *"still requires a FireCon"*.
 * Point-defence use of a K-1 or a Pulser is free, which is `combat.ts`'s
 * business, not the spec's.
 */
export const KINETIC_WEAPON_SPECS: WeaponSpecTable = {
  'pulse-torpedo': {
    weaponClass: 'pulse-torpedo',
    label: 'Pulse Torpedo',
    damageMode: 'SAP',
    maxRange: (_rating, variant) =>
      projectileMaxRange(variant === 'variable' ? 'long' : projectileLine(variant)),
    fire: firePulseTorpedo,
    requiresFireCon: true,
  },
  'submunition-pack': {
    weaponClass: 'submunition-pack',
    label: 'Turreted Submunition Pack',
    damageMode: 'P',
    maxRange: () => SUBMUNITION_DICE.length * SUBMUNITION_BAND_MU,
    fire: fireSubmunitionPack,
    requiresFireCon: true,
  },
  'k-gun': {
    weaponClass: 'k-gun',
    label: 'K-Gun',
    damageMode: 'AP',
    maxRange: (_rating, variant) => projectileMaxRange(projectileLine(variant)),
    fire: fireKGun,
    // 5.16: only a K-1 may do this, and only outside the aft arc — see
    // `kGunCanPointDefend`, which the caller checks before offering the option.
    pointDefence: 'pds',
    requiresFireCon: true,
  },
  mkp: {
    weaponClass: 'mkp',
    label: 'Multiple Kinetic Penetrator',
    damageMode: 'AP',
    maxRange: () => MKP_RANGE_MU,
    fire: fireMkp,
    requiresFireCon: true,
  },
  'boarding-torpedo': {
    weaponClass: 'boarding-torpedo',
    label: 'Boarding Torpedo',
    damageMode: 'AP',
    maxRange: () => projectileMaxRange('standard'),
    fire: fireBoardingTorpedo,
    requiresFireCon: true,
  },
  'fusion-array': {
    weaponClass: 'fusion-array',
    label: 'Fusion Array',
    damageMode: 'P',
    maxRange: () => FUSION_ARRAY_TABLE.flare.length * FUSION_BAND_MU,
    fire: fireFusionArray,
    requiresFireCon: true,
  },
  'gravitic-gun': {
    weaponClass: 'gravitic-gun',
    label: 'Gravitic Gun',
    damageMode: 'standard',
    maxRange: (rating) => rating * 12,
    fire: fireGraviticGun,
    requiresFireCon: true,
  },
  pulser: {
    weaponClass: 'pulser',
    label: 'Pulser',
    damageMode: 'P',
    maxRange: (_rating, variant) => PULSER_PROFILE[pulserSetting(variant)].range,
    fire: firePulser,
    pointDefence: 'pds',
    requiresFireCon: true,
  },
  'spinal-beam': {
    weaponClass: 'spinal-beam',
    label: 'Beam Spinal Mount',
    damageMode: 'P',
    maxRange: (rating) => spinalRangeForRating(rating),
    fire: fireSpinalBeam,
    requiresFireCon: true,
  },
  'spinal-plasma': {
    weaponClass: 'spinal-plasma',
    label: 'Plasma Spinal Mount',
    damageMode: 'P',
    maxRange: (rating) => spinalRangeForRating(rating),
    fire: firePlasmaSpinal,
    requiresFireCon: true,
  },
  'spinal-psp': {
    weaponClass: 'spinal-psp',
    label: 'Point Singularity Projector',
    damageMode: 'AP',
    maxRange: (rating) => spinalRangeForRating(rating),
    fire: firePsp,
    requiresFireCon: true,
  },
}

/** Range of a Spinal Mount by rating (5.23): 1 Small, 2 Medium, 3 Large. */
function spinalRangeForRating(rating: number): number {
  if (rating >= 3) return SPINAL_MOUNT_PROFILE.large.range
  if (rating === 2) return SPINAL_MOUNT_PROFILE.medium.range
  return SPINAL_MOUNT_PROFILE.small.range
}

/** One spec by class, for callers that hold a `WeaponDef` and nothing else. */
export function kineticSpecFor(weapon: WeaponDef): WeaponSpec | undefined {
  return KINETIC_WEAPON_SPECS[weapon.weaponClass]
}
