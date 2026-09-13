/**
 * Full Thrust: Project Continuum — the energy weapons of sections 5.2 – 5.13.
 *
 * Eleven weapon families share one skeleton — roll beam dice, read hits off the
 * 4.5 table, turn hits into damage — and differ in every detail hung on it: the
 * size of a range band, what one hit is worth, whether a natural 6 re-rolls,
 * what the damage meets on the way in. The skeleton is `dice.rollBeamVolley`,
 * so every family here scores its dice through the one table in the engine, and
 * this module only supplies the differences.
 *
 * The vocabulary matters and is the rulebook's own. A **die** is one D6 of a
 * mount's fire. A **hit** is what that die scores off the beam table (4.5, 4.7).
 * **Damage** is what a hit does, which is a different thing for every weapon
 * below: 1 point for a beam, 1D3 for a graser or phaser, 1D6 for a Heavy
 * Graser, one boarding party for a transporter beam, one threshold test for an
 * EMP projector. 5.9 fixes the usage — *"Transporter Beams generate a BD hits
 * … Every hit generated allows the player to send one unit of Marines"*.
 *
 * Rules are written out in full in `docs/rules/weapons-beams.md`.
 *
 * This module rolls dice and reports damage. It never touches ship state:
 * where the damage lands is `combat.ts`'s business (4.9), and so is arc and
 * FireCon bookkeeping (4.2, 4.4).
 */

import { d6, rollBeamVolley, type PdMode, type Rng, type ScreenLevel } from '../dice'
import { BEAM_RANGE_BAND, beamDiceAtRange, bearsOn } from '../geometry'
import type { SystemKind, WeaponClass, WeaponDef } from '../types'
import type { FiringContext, WeaponResult, WeaponSpec, WeaponSpecTable } from './contract'

// ---------------------------------------------------------------------------
// 5.2 Targeting systems — FireCon and Advanced FireCon
// ---------------------------------------------------------------------------

/**
 * A fire control fit (5.2). Not a weapon: it is permission to shoot, so it is
 * exported as data rather than as a `WeaponSpec`.
 */
export interface FireConSpec {
  kind: 'firecon' | 'advanced-firecon'
  label: string
  mass: number
  pointsPerMass: number
  points: number
  /** Targets this one system can direct fire at in a phase (4.4, 5.2). */
  targetsPerSystem: number
  /**
   * Die roll modifier the system grants its weapons. Zero for both fits: 5.2
   * gives neither a to-hit bonus, and the Advanced FireCon spends its extra
   * capability on targets tracked and detection range instead. Stated rather
   * than omitted so the absence is visible.
   */
  drm: number
  /** Detection/scan range in MU, where the fit has one (5.2). */
  scanRange?: number
}

/** Standard FireCon (5.2): one target per phase, mass 1, 4 points per mass. */
export const STANDARD_FIRECON: FireConSpec = {
  kind: 'firecon',
  label: 'FireCon',
  mass: 1,
  pointsPerMass: 4,
  points: 4,
  targetsPerSystem: 1,
  drm: 0,
}

/**
 * Advanced Fire Control (5.2): *"can track two separate targets each, acting
 * just like two normal FireCons"*, and *"can also track and scan enemy ships
 * out to a range of 72 MU for detection purposes"*.
 */
export const ADVANCED_FIRECON: FireConSpec = {
  kind: 'advanced-firecon',
  label: 'Advanced FireCon',
  mass: 1,
  pointsPerMass: 5,
  points: 5,
  targetsPerSystem: 2,
  drm: 0,
  scanRange: 72,
}

/**
 * Targets a ship may engage in one phase (4.4, 5.2). An AFC counts double.
 *
 * 5.2 makes the limit *per phase, not per turn*: *"a FireCon used to launch
 * missiles can also be used to direct other weapons in the Ship Fire Phase of
 * the same turn"*, so the caller works this out afresh in phases 3 and 11.
 */
export function fireConCapacity(standard: number, advanced: number): number {
  return (
    Math.max(0, standard) * STANDARD_FIRECON.targetsPerSystem +
    Math.max(0, advanced) * ADVANCED_FIRECON.targetsPerSystem
  )
}

/** The three things 5.2 spends a FireCon on, each *per phase*. */
export type FireConTask = 'ship-weapons' | 'needle-beam-system' | 'missile-launch'

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

/**
 * A firing context with the handful of extras this section's weapons ask about
 * (5.4, 5.8, 5.9, 5.13, and the defensive systems of 7.3, 7.16, 7.17, 7.20).
 *
 * Every field is optional, so a plain `FiringContext` is a valid
 * `BeamFiringContext` and the defaults are the ordinary case: standard screens,
 * no area screen, no holofield, no cloak, a shooter with basic sensor
 * information.
 */
export interface BeamFiringContext extends FiringContext {
  /**
   * 7.3: the target's screens are Advanced. Only matters to weapons that ignore
   * *standard* screens — here, EMP projectors.
   */
  advancedScreens?: boolean
  /**
   * 7.16: the target is inside a friendly area screen, which stacks one more
   * level (to a maximum of three) and stops penetrating weapons re-rolling when
   * the target's own screens are already level 2.
   */
  areaScreen?: boolean
  /** 7.17: the target is running a holofield (blocks needle-beam system kills). */
  holofield?: boolean
  /** 7.20: the target is under cloak (blocks needle-beam system kills). */
  targetCloaked?: boolean
  /** 5.13: the system this needle beam or needle-mode phaser is aimed at. */
  needleTarget?: string
  /**
   * 5.13: the shooter has at least basic sensor information on the target.
   * Without it *"rolls of a 6 do not damage the targeted system"*. Defaults to
   * true, which is the ordinary state of an unjammed shooter.
   */
  needleTargetingInfo?: boolean
  /** 5.13: the shooter's sensor fit, which sets the range at which it can still kill systems. */
  sensors?: { enhanced?: number; superior?: boolean }
  /** 5.9: what the transporter beam is doing this turn. Defaults to boarding. */
  transporterMode?: 'board' | 'commando-raid'
  /** 5.8: a phaser may fire as a needle beam of the same class, with an AFC. */
  phaserMode?: 'anti-ship' | 'needle'
  /** 5.2, 5.8: the firing ship has an Advanced FireCon to dedicate. */
  advancedFireCon?: boolean
}

/**
 * A weapon mount with the one property `WeaponDef` has no room for: the High
 * Intensity upgrade a Heavy Graser may be bought with (5.7). `WeaponVariant`
 * has no value for it and `types.ts` is not this module's to change, so the
 * flag is defined here. A plain `WeaponDef` is still a valid `BeamWeaponDef`.
 */
export interface BeamWeaponDef extends WeaponDef {
  /** 5.7: a High Intensity Graser (HiG) — *"weapons that re-roll on 6s"*. */
  highIntensity?: boolean
}

/** 5.7: Heavy Grasers are the one family here whose range band is not 12 MU. */
export const HEAVY_GRASER_RANGE_BAND = 18

/** 5.10: *"6 beam dice (BD\*) out to a range of 12 MU"*, whatever the mount's rating. */
export const GATLING_DICE = 6
export const GATLING_RANGE = 12

/** 5.11: *"The TPA generates 2 beam dice (BD\*) to a range of 24 MU"* — one 24 MU band. */
export const TWIN_PARTICLE_ARRAY_DICE = 2
export const TWIN_PARTICLE_ARRAY_RANGE = 24

/** 5.12: *"The Meson Projector generates 1 BD\* out to a range of 48 MU"*. */
export const MESON_PROJECTOR_DICE = 1
export const MESON_PROJECTOR_RANGE = 48

/**
 * One D3 (5.6, 5.8), rolled the way a table rolls it: a D6 halved, rounding up.
 * The rulebook never says how to roll a D3, and halving the die that is already
 * in your hand is what players do — it also keeps every face in the battle log
 * a real D6 face.
 */
export function d3(rng: Rng): number {
  return Math.ceil(d6(rng) / 2)
}

/**
 * Whether a mount can bear on the target (4.2).
 *
 * A turreted weapon is exempt: 5.22 makes the turret's facing — recorded in
 * orders and revealed after movement — the arc that matters, and only fire
 * control knows it, so the resolver does not second-guess it.
 */
function canBear(weapon: WeaponDef, ctx: FiringContext): boolean {
  if (weapon.turretId) return true
  return bearsOn(weapon.arcs, ctx.arc)
}

/** Screen level in effect against this weapon (4.7, 7.3). */
function screensAgainst(
  ctx: BeamFiringContext,
  opts: { ignoresStandardScreens?: boolean; ignoresAllScreens?: boolean } = {},
): ScreenLevel {
  if (opts.ignoresAllScreens) return 0
  // 7.3: a weapon that ignores *standard* screens is still scored "as if they
  // were beams" against Advanced Screens, because it rolls a combined hit and
  // damage die. 5.4 claims immunity to Standard screens only.
  if (opts.ignoresStandardScreens && ctx.advancedScreens !== true) return 0
  return ctx.targetScreens
}

/**
 * Whether a (P) weapon still gets its re-rolls (4.6, 7.16).
 *
 * 7.16: *"In the case of ships with level two screens being protected by an
 * area screen weapons that would normally penetrate do not get their re-rolls."*
 */
function rerollsAllowed(ctx: BeamFiringContext): boolean {
  return !(ctx.areaScreen === true && ctx.targetScreens >= 2)
}

/** Hits scored by one volley of beam dice, split by whether a re-roll threw them. */
interface HitVolley {
  /** Natural faces in the order thrown: the initial dice, then any re-rolls. */
  faces: number[]
  /** Hits from the initial dice — what screens and armour may still answer. */
  normalHits: number
  /** Hits from re-roll dice, which ignore screens and armour (4.6). */
  penetratingHits: number
}

/**
 * Throw `count` beam dice and count the hits (4.5 – 4.7).
 *
 * `dice.rollBeamVolley` already applies the 4.7 table, the DRM, and the 4.6
 * re-roll rule (natural 6 only, re-rolls scored unscreened); its damage numbers
 * *are* hit counts for the weapons in this module that pay more than a point
 * per hit.
 */
function rollHits(
  count: number,
  screens: ScreenLevel,
  ctx: BeamFiringContext,
  penetrating: boolean,
): HitVolley {
  const volley = rollBeamVolley(count, screens, ctx.rng, { drm: ctx.drm, penetrating })
  return {
    faces: volley.dice.map((die) => die.natural),
    normalHits: volley.normalDamage,
    penetratingHits: volley.penetratingDamage,
  }
}

/** Damage dice for the weapons that roll damage separately from the hit (5.6 – 5.8). */
function rollDamage(hits: number, size: 'd3' | 'd6', rng: Rng): { faces: number[]; total: number } {
  const faces: number[] = []
  let total = 0
  for (let i = 0; i < hits; i++) {
    const face = d6(rng)
    faces.push(face)
    total += size === 'd3' ? Math.ceil(face / 2) : face
  }
  return { faces, total }
}

function screenNote(screens: ScreenLevel): string {
  return screens === 0 ? 'unscreened' : `screen-${screens}`
}

// ---------------------------------------------------------------------------
// 5.3 Beam weapons (P)
// ---------------------------------------------------------------------------

/**
 * Beam battery (5.3) — the baseline every other weapon here is described
 * against. Class dice on 12 MU bands (4.5), 1 damage per hit, natural 6s
 * re-roll and their damage bypasses screens and armour (4.6).
 */
export const BEAM_SPEC: WeaponSpec = {
  weaponClass: 'beam',
  label: 'Beam battery',
  damageMode: 'P',
  maxRange: (rating: number) => rating * BEAM_RANGE_BAND,
  fire(weapon: BeamWeaponDef, ctx: BeamFiringContext): WeaponResult | null {
    const dice = beamDiceAtRange(weapon.rating, ctx.range)
    if (dice <= 0 || !canBear(weapon, ctx)) return null
    const screens = screensAgainst(ctx)
    const hits = rollHits(dice, screens, ctx, rerollsAllowed(ctx))
    return {
      normalDamage: hits.normalHits,
      penetratingDamage: hits.penetratingHits,
      mode: 'P',
      dice: hits.faces,
      detail:
        `Beam-${weapon.rating} ${dice}D6 vs ${screenNote(screens)}: ${hits.faces.join(',')} → ` +
        `${hits.normalHits} damage, ${hits.penetratingHits} penetrating`,
    }
  },
  // 7.12: "Beam-1 systems, K-1 guns and other small weapons are dual purpose".
  // The contract has one mode per class, so the rating test lives in
  // `canPointDefend` — a Beam-3 may not point-defend.
  pointDefence: 'beam-1',
  requiresFireCon: true,
}

/**
 * Whether this particular mount may be used for point defence (5.4, 5.7, 7.12).
 *
 * `WeaponSpec.pointDefence` is declared per weapon class, but the rulebook
 * grants the ability per *mount*: only Beam-1s (7.12) and EMP-1s (5.4) of their
 * families can do it, while every Gatling Battery, TPA, Meson Projector and
 * Phaser can.
 */
export function canPointDefend(weapon: WeaponDef): boolean {
  switch (weapon.weaponClass) {
    case 'beam':
    case 'emp':
      return weapon.rating === 1
    case 'gatling':
    case 'twin-particle-array':
    case 'meson-projector':
    case 'phaser':
      return true
    default:
      // 5.5 plasma "cannot be effectively used in defensive fire mode"; 5.7
      // "Heavy Graser-1s cannot be used for point defense"; 5.9 transporters
      // "cannot be used in defensive fire"; 5.6 and 5.13 grant nothing.
      return false
  }
}

// ---------------------------------------------------------------------------
// 5.4 EMP Projectors / Ion Cannons
// ---------------------------------------------------------------------------

/**
 * A system an EMP hit may be allocated to (5.4). `drive` and `turret` are not
 * `SystemKind`s — the drive lives on `ShipDesign.drive` and turrets in
 * `ShipDesign.turrets` — so the union is widened here rather than in types.ts.
 */
export type EmpTargetKind = SystemKind | 'drive' | 'turret'

/**
 * 5.4: *"The systems that can be affected are: drives, FTL, FireCon, screens,
 * turrets, ECM, Area ECM, any fields (Stealth, Holofield), and cloaking
 * systems."*
 *
 * The list is closed — anything not on it takes no EMP test. The Reflex Field
 * (7.25) is deliberately absent: 5.4 names Stealth and Holofield as the fields
 * it means, and 7.25 calls the reflex field *"a variation on conventional
 * screen technology"* rather than one of them.
 */
export const EMP_VULNERABLE_SYSTEMS: readonly EmpTargetKind[] = [
  'drive',
  'ftl-drive',
  'firecon',
  'advanced-firecon',
  'screen-generator',
  'turret',
  'ecm',
  'area-ecm',
  'stealth-field',
  'holofield',
  'cloaking-device',
  'cloaking-field',
  'tuffley-cloak',
]

/** Whether an EMP hit may be allocated to this kind of system (5.4). */
export function isEmpVulnerable(kind: EmpTargetKind): boolean {
  return EMP_VULNERABLE_SYSTEMS.includes(kind)
}

/**
 * The number an EMP threshold test must reach (5.4).
 *
 * *"A single EMP hit requires a threshold test on a 6, two hits require a test
 * on a 5+, and three or more hits require a test on a 4+."* The count is the
 * target ship's **total** EMP hits for the turn, because *"EMP hits from
 * multiple ships can be combined to produce more dramatic effects"* — not one
 * mount's hits.
 */
export function empThresholdTarget(hitsThisTurn: number): number {
  if (hitsThisTurn <= 0) return Infinity
  if (hitsThisTurn === 1) return 6
  if (hitsThisTurn === 2) return 5
  return 4
}

/** One line of the attacker's allocation of EMP hits to systems (5.4). */
export interface EmpAllocation {
  systemId: string
  kind: EmpTargetKind
  /** Hits placed on this system; each one is a separate test. */
  hits: number
}

/** What the EMP tests did to one system (5.4, 4.11). */
export interface EmpTestResult {
  systemId: string
  kind: EmpTargetKind
  /** The number each die had to reach. */
  target: number
  rolls: number[]
  /** Faces after the +1 per hull row crossed in phases 11 and 12. */
  modified: number[]
  /**
   * Tests failed. A drive needs two to be disabled outright (4.11: the first
   * failure halves its thrust), which is why this is a count and not a flag.
   */
  failures: number
  knockedOut: boolean
}

/**
 * Resolve a turn's EMP threshold tests on one target ship (5.4).
 *
 * `totalHits` sets the difficulty and caps the allocation: *"The number of
 * systems that can be affected is equal to the total number of EMP hits
 * delivered that turn. The attacker … chooses the allocation."*
 * `hullRowsCrossed` is the +1 DRM: *"Modify the roll by +1 for each row of hull
 * boxes checked off in phase 11 and 12"*.
 *
 * Throws when the allocation spends hits the attack never scored, or puts them
 * on a system 5.4 does not expose — both are malformed orders, not unlucky
 * ones.
 */
export function resolveEmpTests(
  totalHits: number,
  allocation: readonly EmpAllocation[],
  hullRowsCrossed: number,
  rng: Rng,
): EmpTestResult[] {
  const allocated = allocation.reduce((sum, entry) => sum + entry.hits, 0)
  if (allocated > totalHits) {
    throw new RangeError(`resolveEmpTests: ${allocated} hits allocated but only ${totalHits} scored`)
  }
  const illegal = allocation.find((entry) => !isEmpVulnerable(entry.kind))
  if (illegal) {
    throw new RangeError(`resolveEmpTests: ${illegal.kind} is not an EMP-vulnerable system (5.4)`)
  }

  const target = empThresholdTarget(totalHits)
  return allocation.map((entry) => {
    const rolls: number[] = []
    const modified: number[] = []
    let failures = 0
    for (let i = 0; i < entry.hits; i++) {
      const roll = d6(rng)
      const result = roll + hullRowsCrossed
      rolls.push(roll)
      modified.push(result)
      if (result >= target) failures += 1
    }
    return {
      systemId: entry.systemId,
      kind: entry.kind,
      target,
      rolls,
      modified,
      failures,
      knockedOut: failures > 0,
    }
  })
}

/**
 * An EMP-1 in point defence (5.4): *"EMP-1s can be used in point defense like a
 * beam 1, inflicting a BD hits with a -1 DRM."*
 *
 * The beam-1 PD die of 8.8 kills on 5 or 6 and re-rolls on a 6; with −1 on each
 * face only a natural 6 still kills, and it still re-rolls, because 4.6 tests
 * the natural face. Against a heavy missile, where 6.4 already needs a 6, the
 * modifier leaves nothing that can kill — that falls out of the arithmetic and
 * is left standing rather than patched.
 *
 * `dice.pointDefenceKills` takes no DRM, so the die is rolled here.
 */
export function empPointDefence(
  dice: number,
  rng: Rng,
  opts: { heavyMissile?: boolean } = {},
): { rolls: number[]; kills: number } {
  const needed = opts.heavyMissile ?? false ? 6 : 5
  const rolls: number[] = []
  let kills = 0

  const resolve = (): void => {
    const natural = d6(rng)
    rolls.push(natural)
    if (natural - 1 >= needed) kills += 1
    if (natural === 6) resolve()
  }

  for (let i = 0; i < dice; i++) resolve()
  return { rolls, kills }
}

/**
 * EMP Projector / Ion Cannon (5.4). Beam dice and beam ranges, but the hits do
 * no hull damage at all — they buy threshold tests, which `resolveEmpTests`
 * rolls once every attacker's EMP fire on the target has been added up.
 */
export const EMP_SPEC: WeaponSpec = {
  weaponClass: 'emp',
  label: 'EMP projector',
  // The mode never bites, since EMP inflicts no damage for armour to answer;
  // AP records 5.4's "They also ignore Standard screens and armor".
  damageMode: 'AP',
  maxRange: (rating: number) => rating * BEAM_RANGE_BAND,
  fire(weapon: BeamWeaponDef, ctx: BeamFiringContext): WeaponResult | null {
    const dice = beamDiceAtRange(weapon.rating, ctx.range)
    if (dice <= 0 || !canBear(weapon, ctx)) return null
    const screens = screensAgainst(ctx, { ignoresStandardScreens: true })
    const hits = rollHits(dice, screens, ctx, rerollsAllowed(ctx))
    const total = hits.normalHits + hits.penetratingHits
    return {
      normalDamage: 0,
      penetratingDamage: 0,
      mode: 'AP',
      dice: hits.faces,
      // 5.4: "The number of systems that can be affected is equal to the total
      // number of EMP hits delivered that turn."
      disruption: { systemsOffline: total },
      detail:
        `EMP-${weapon.rating} ${dice}D6 vs ${screenNote(screens)}: ${hits.faces.join(',')} → ` +
        `${total} EMP hit(s), threshold test on ${empThresholdTarget(total)}+`,
    }
  },
  // 5.4: EMP-1s only — `canPointDefend` applies the rating test, and
  // `empPointDefence` applies the −1 DRM the mode string cannot carry.
  pointDefence: 'beam-1',
  requiresFireCon: true,
}

// ---------------------------------------------------------------------------
// 5.5 Plasma Cannon
// ---------------------------------------------------------------------------

/**
 * Hits one plasma die scores (5.5): *"1d6-2 (plus an additional -1 per level of
 * screen) hits, with each hit inflicting 1 damage"*. A 3 is 1 hit, a 4 is 2, a
 * 5 is 3, a 6 is 4.
 */
export function plasmaHits(face: number, screenLevels: number): number {
  return Math.max(0, face - 2 - screenLevels)
}

/**
 * Screen levels against a plasma cannon (5.5, 7.16).
 *
 * 7.16 stacks an area screen on top of the target's own to a maximum of three,
 * and says *"Plasma weapons would be at -3 on their die rolls"* at that
 * ceiling — which is exactly 5.5's −1 per level, counted over three levels.
 */
function plasmaScreenLevels(ctx: BeamFiringContext): number {
  return Math.min(3, ctx.targetScreens + (ctx.areaScreen === true ? 1 : 0))
}

/**
 * Plasma Cannon (5.5). Class dice on 12 MU bands like a beam, but each die is
 * read as 1D6−2 hits rather than off the 4.7 table.
 *
 * *"on a 6 it inflicts 4 hits, penetrates, and gets a reroll"* is read as the
 * ordinary (P) designation of 4.6: the 6's own four points land on armour like
 * any other die, and it is the re-roll dice whose damage ignores screens and
 * armour. The other reading — that the 6's four points themselves bypass armour
 * — would make the plasma cannon strictly better against armour than every
 * other (P) weapon in the book, which nothing in 5.5 suggests.
 */
export const PLASMA_CANNON_SPEC: WeaponSpec = {
  weaponClass: 'plasma-cannon',
  label: 'Plasma cannon',
  damageMode: 'P',
  maxRange: (rating: number) => rating * BEAM_RANGE_BAND,
  fire(weapon: BeamWeaponDef, ctx: BeamFiringContext): WeaponResult | null {
    const dice = beamDiceAtRange(weapon.rating, ctx.range)
    if (dice <= 0 || !canBear(weapon, ctx)) return null
    const screens = plasmaScreenLevels(ctx)
    const penetrating = rerollsAllowed(ctx)
    const faces: number[] = []
    let normalDamage = 0
    let penetratingDamage = 0

    const resolve = (isReroll: boolean): void => {
      const natural = d6(ctx.rng)
      // Clamped as `dice.rollBeamVolley` clamps: a DRM shifts the face, it does
      // not invent a seventh side (1.7, 4.6).
      const face = Math.max(1, Math.min(6, natural + ctx.drm))
      // 4.6: a re-roll "is assumed to have already penetrated the screen", so
      // the screen penalty comes off re-roll dice entirely.
      const hits = plasmaHits(face, isReroll ? 0 : screens)
      faces.push(natural)
      if (isReroll) penetratingDamage += hits
      else normalDamage += hits
      if (penetrating && natural === 6) resolve(true)
    }

    for (let i = 0; i < dice; i++) resolve(false)
    return {
      normalDamage,
      penetratingDamage,
      mode: 'P',
      dice: faces,
      detail:
        `Plasma-${weapon.rating} ${dice}D6 vs ${screenNote(ctx.targetScreens)}` +
        `${screens !== ctx.targetScreens ? ` +area (−${screens})` : ''}: ${faces.join(',')} → ` +
        `${normalDamage} damage, ${penetratingDamage} penetrating`,
    }
  },
  // 5.5: "Plasma Cannon cannot be effectively used in defensive fire mode."
  requiresFireCon: true,
}

// ---------------------------------------------------------------------------
// 5.6 Standard Grasers (SAP) and 5.8 Phasers (SAP)
// ---------------------------------------------------------------------------

/**
 * Resolve a graser- or phaser-style volley (5.6, 5.8): BD\* hits on 12 MU
 * bands, each hit worth 1D3 of semi-armour-piercing damage.
 *
 * Returned as one `WeaponResult` per hit when `perHit` is set, so that
 * `combat.applyVolley` halves each hit against armour on its own — which is
 * what 4.9 asks for (*"If a SAP hit inflicts multiple points of damage, then
 * half is applied to the armor"*) and what a single aggregated result cannot
 * express.
 */
function fireD3Sap(
  weapon: BeamWeaponDef,
  ctx: BeamFiringContext,
): { faces: number[]; normalHits: number[]; penetratingHits: number[] } | null {
  const dice = beamDiceAtRange(weapon.rating, ctx.range)
  if (dice <= 0 || !canBear(weapon, ctx)) return null
  const screens = screensAgainst(ctx)
  const hits = rollHits(dice, screens, ctx, rerollsAllowed(ctx))
  const normal = rollDamage(hits.normalHits, 'd3', ctx.rng)
  const penetrating = rollDamage(hits.penetratingHits, 'd3', ctx.rng)
  return {
    faces: [...hits.faces, ...normal.faces, ...penetrating.faces],
    normalHits: normal.faces.map((face) => Math.ceil(face / 2)),
    penetratingHits: penetrating.faces.map((face) => Math.ceil(face / 2)),
  }
}

function sapResult(
  rolled: { faces: number[]; normalHits: number[]; penetratingHits: number[] },
  headline: string,
): WeaponResult {
  const normalDamage = rolled.normalHits.reduce((a, b) => a + b, 0)
  const penetratingDamage = rolled.penetratingHits.reduce((a, b) => a + b, 0)
  return {
    normalDamage,
    penetratingDamage,
    mode: 'SAP',
    dice: rolled.faces,
    detail:
      `${headline}: hits ${rolled.normalHits.length}+${rolled.penetratingHits.length}P → ` +
      `${normalDamage} damage, ${penetratingDamage} penetrating`,
  }
}

/**
 * Standard Graser (5.6). *"a Graser-3 would inflict 3 BD\* to 12 MU, 2 BD\* to
 * 24 MU, and 1 BD\* to 36 MU, with each hit doing 1d3 damage semi-AP."*
 */
export const GRASER_SPEC: WeaponSpec = {
  weaponClass: 'graser',
  label: 'Graser',
  damageMode: 'SAP',
  maxRange: (rating: number) => rating * BEAM_RANGE_BAND,
  fire(weapon: BeamWeaponDef, ctx: BeamFiringContext): WeaponResult | null {
    const rolled = fireD3Sap(weapon, ctx)
    if (!rolled) return null
    return sapResult(rolled, `Graser-${weapon.rating} vs ${screenNote(screensAgainst(ctx))}`)
  },
  requiresFireCon: true,
}

/**
 * Phaser (5.8). Anti-ship fire is a standard graser of the same class; the
 * needle-beam, PDS and ADS modes are the rest of 5.8 and are selected through
 * `BeamFiringContext.phaserMode` and `canPointDefend`.
 *
 * Needle mode *"if the ship also mounts an Advanced FireCon (AFC)"* — without
 * one the resolver refuses the shot rather than quietly firing anti-ship.
 */
export const PHASER_SPEC: WeaponSpec = {
  weaponClass: 'phaser',
  label: 'Phaser',
  damageMode: 'SAP',
  maxRange: (rating: number) => rating * BEAM_RANGE_BAND,
  fire(weapon: BeamWeaponDef, ctx: BeamFiringContext): WeaponResult | null {
    if (ctx.phaserMode === 'needle') {
      if (ctx.advancedFireCon !== true) return null
      return fireNeedleBeam(weapon, ctx, 'Phaser')
    }
    const rolled = fireD3Sap(weapon, ctx)
    if (!rolled) return null
    return sapResult(rolled, `Phaser-${weapon.rating} vs ${screenNote(screensAgainst(ctx))}`)
  },
  // 5.8: "each mount may be used as a single PDS instead of firing in anti-ship
  // mode" — a full PDS die, and an ADS instead where a dedicated AFC exists.
  pointDefence: 'pds',
  requiresFireCon: true,
}

/**
 * A graser, phaser or Heavy Graser volley as one `WeaponResult` per hit (4.9).
 *
 * `WeaponResult` carries a single aggregate `normalDamage`, so `combat.ts`
 * halves a whole mount's fire against armour once. 4.9 halves *each hit*: two
 * graser hits of 3 should put 2 + 2 on armour, not 3. Feeding this array to
 * `combat.applyVolley` gets the rule-exact answer. Returns null when the mount
 * cannot fire, and an empty array when it fires and misses.
 */
export function fireSapHits(weapon: BeamWeaponDef, ctx: BeamFiringContext): WeaponResult[] | null {
  if (weapon.weaponClass === 'heavy-graser') return fireHeavyGraserHits(weapon, ctx)
  const rolled = fireD3Sap(weapon, ctx)
  if (!rolled) return null
  const label = weapon.weaponClass === 'phaser' ? 'Phaser' : 'Graser'
  const out: WeaponResult[] = []
  rolled.normalHits.forEach((damage, index) =>
    out.push({
      normalDamage: damage,
      penetratingDamage: 0,
      mode: 'SAP',
      dice: index === 0 ? rolled.faces : [],
      detail: `${label}-${weapon.rating} hit ${index + 1}: ${damage} damage (1D3, SAP)`,
    }),
  )
  rolled.penetratingHits.forEach((damage, index) =>
    out.push({
      normalDamage: 0,
      penetratingDamage: damage,
      mode: 'SAP',
      dice: [],
      detail: `${label}-${weapon.rating} penetrating hit ${index + 1}: ${damage} damage (1D3)`,
    }),
  )
  return out
}

// ---------------------------------------------------------------------------
// 5.7 Heavy Grasers (SAP)
// ---------------------------------------------------------------------------

function rollHeavyGraser(
  weapon: BeamWeaponDef,
  ctx: BeamFiringContext,
): { faces: number[]; normal: number[]; penetrating: number[]; screens: ScreenLevel } | null {
  const dice = beamDiceAtRange(weapon.rating, ctx.range, HEAVY_GRASER_RANGE_BAND)
  if (dice <= 0 || !canBear(weapon, ctx)) return null
  const screens = screensAgainst(ctx)
  // 5.7: "Heavy Grasers are not penetrating weapons and do not re-roll on a 6",
  // unless bought as a High Intensity Graser.
  const penetrating = weapon.highIntensity === true && rerollsAllowed(ctx)
  const hits = rollHits(dice, screens, ctx, penetrating)
  const normal = rollDamage(hits.normalHits, 'd6', ctx.rng)
  const extra = rollDamage(hits.penetratingHits, 'd6', ctx.rng)
  return {
    faces: [...hits.faces, ...normal.faces, ...extra.faces],
    normal: normal.faces,
    penetrating: extra.faces,
    screens,
  }
}

function fireHeavyGraserHits(
  weapon: BeamWeaponDef,
  ctx: BeamFiringContext,
): WeaponResult[] | null {
  const rolled = rollHeavyGraser(weapon, ctx)
  if (!rolled) return null
  const kind = weapon.highIntensity === true ? 'HiG' : 'Heavy Graser'
  const out: WeaponResult[] = []
  rolled.normal.forEach((damage, index) =>
    out.push({
      normalDamage: damage,
      penetratingDamage: 0,
      mode: 'SAP',
      dice: index === 0 ? rolled.faces : [],
      detail: `${kind}-${weapon.rating} hit ${index + 1}: ${damage} damage (1D6, SAP)`,
    }),
  )
  rolled.penetrating.forEach((damage, index) =>
    out.push({
      normalDamage: 0,
      penetratingDamage: damage,
      mode: 'SAP',
      dice: [],
      detail: `${kind}-${weapon.rating} penetrating hit ${index + 1}: ${damage} damage (1D6)`,
    }),
  )
  return out
}

/**
 * Heavy Graser (5.7). *"The range bands for Heavy Grasers are 18 MU, not 12, so
 * a class 2 Heavy Graser rolls 2D6 at 0-18 MU, 1D6 at up to 36 MU."* Hits are
 * scored off the ordinary 4.7 table — 5.7 restates it verbatim — and *"each hit
 * from a Heavy Graser inflicts 1D6 points of damage"*, semi-armour-piercing.
 *
 * A plain Heavy Graser does not re-roll; the High Intensity upgrade
 * (`BeamWeaponDef.highIntensity`) does.
 */
export const HEAVY_GRASER_SPEC: WeaponSpec = {
  weaponClass: 'heavy-graser',
  label: 'Heavy graser',
  damageMode: 'SAP',
  maxRange: (rating: number) => rating * HEAVY_GRASER_RANGE_BAND,
  fire(weapon: BeamWeaponDef, ctx: BeamFiringContext): WeaponResult | null {
    const rolled = rollHeavyGraser(weapon, ctx)
    if (!rolled) return null
    const normalDamage = rolled.normal.reduce((a, b) => a + b, 0)
    const penetratingDamage = rolled.penetrating.reduce((a, b) => a + b, 0)
    const kind = weapon.highIntensity === true ? 'HiG' : 'Heavy Graser'
    return {
      normalDamage,
      penetratingDamage,
      mode: 'SAP',
      dice: rolled.faces,
      detail:
        `${kind}-${weapon.rating} vs ${screenNote(rolled.screens)}: ` +
        `${rolled.normal.length} hit(s) → ${normalDamage} damage` +
        (rolled.penetrating.length > 0 ? `, ${penetratingDamage} penetrating` : ''),
    }
  },
  // 5.7: "Heavy Graser-1s cannot be used for point defense."
  requiresFireCon: true,
}

// ---------------------------------------------------------------------------
// 5.9 Transporter Beams
// ---------------------------------------------------------------------------

/** The six results of the Marine commando raid table (5.9). */
export type CommandoRaidOutcome =
  /** 1: *"Nothing happens. The Transporter technician is unable to lock onto the target system."* */
  | 'no-lock'
  /** 2–3: transported aboard, could not reach the system, killed. */
  | 'lost'
  /** 4: could not reach the system, returned on a second roll of 4+. */
  | 'withdrawn'
  /** 4: could not reach the system, failed the 4+ and were killed. */
  | 'withdrawn-killed'
  /** 5: system destroyed, marines killed in the process. */
  | 'destroyed-marines-lost'
  /** 6: system destroyed, marines returned safely. */
  | 'destroyed-marines-returned'

/** The raid table as printed (5.9), for the rules log and the UI. */
export const COMMANDO_RAID_TABLE: Record<number, string> = {
  1: 'Nothing happens. The Transporter technician is unable to lock onto the target system.',
  2: 'The Marines transport onto the ship but are unable to reach the target system and are killed.',
  3: 'The Marines transport onto the ship but are unable to reach the target system and are killed.',
  4: 'The Marines transport onto the ship but are unable to reach the target system. On a 4+ they return to the ship otherwise they are killed.',
  5: 'The Marines transport aboard and destroy the target system but are killed in the process.',
  6: 'The Marines transport aboard and destroy the target system and return safely to the ship.',
}

/** What one commando raid did (5.9). */
export interface CommandoRaidResult {
  roll: number
  /** The second D6 the "4" result calls for, if it was rolled. */
  returnRoll?: number
  outcome: CommandoRaidOutcome
  /** *"If successful the system is destroyed and may not be repaired during the battle."* */
  systemDestroyed: boolean
  /** The boarding party was spent leaving the ship (every result but the 1). */
  marinesSent: boolean
  /** The boarding party did not come home. */
  marinesLost: boolean
  detail: string
}

/**
 * One Marine commando raid (5.9).
 *
 * On a 1 the party never transports — *"Nothing happens"* — so it is not spent
 * and may be used again. On a 4 it is spent and survives only on a second roll
 * of 4 or more.
 */
export function commandoRaid(rng: Rng): CommandoRaidResult {
  const roll = d6(rng)
  const base = { roll, detail: `${roll}: ${COMMANDO_RAID_TABLE[roll]}` }
  switch (roll) {
    case 1:
      return { ...base, outcome: 'no-lock', systemDestroyed: false, marinesSent: false, marinesLost: false }
    case 2:
    case 3:
      return { ...base, outcome: 'lost', systemDestroyed: false, marinesSent: true, marinesLost: true }
    case 4: {
      const returnRoll = d6(rng)
      const returned = returnRoll >= 4
      return {
        ...base,
        returnRoll,
        outcome: returned ? 'withdrawn' : 'withdrawn-killed',
        systemDestroyed: false,
        marinesSent: true,
        marinesLost: !returned,
        detail: `${base.detail} Return roll ${returnRoll}: ${returned ? 'returned' : 'killed'}.`,
      }
    }
    case 5:
      return {
        ...base,
        outcome: 'destroyed-marines-lost',
        systemDestroyed: true,
        marinesSent: true,
        marinesLost: true,
      }
    default:
      return {
        ...base,
        outcome: 'destroyed-marines-returned',
        systemDestroyed: true,
        marinesSent: true,
        marinesLost: false,
      }
  }
}

/**
 * 5.9: *"If a ship runs out of Damage Control Parties and Marines, it may no
 * longer use transporters."* A commando raid needs a Marine party specifically:
 * *"ONLY Marines may be used for such actions"*.
 */
export function canUseTransporters(
  marineParties: number,
  damageControlParties: number,
  mode: 'board' | 'commando-raid' = 'board',
): boolean {
  if (mode === 'commando-raid') return marineParties > 0
  return marineParties + damageControlParties > 0
}

/**
 * 5.9: *"Marines may not be sent to attack any Core or otherwise protected
 * systems, such as Antimatter Suicide Bombs"*.
 */
export const COMMANDO_RAID_FORBIDDEN: readonly string[] = ['core-systems', 'antimatter-charge']

/** A transporter beam's fire, with the raid detail a `WeaponResult` has no room for (5.9). */
export interface TransporterFireResult {
  result: WeaponResult
  /** Boarding parties the hits delivered, for a capture attempt under 12.7. */
  hits: number
  /** The raid, when the mount was used for one. */
  raid?: CommandoRaidResult
}

function fireTransporter(
  weapon: BeamWeaponDef,
  ctx: BeamFiringContext,
): TransporterFireResult | null {
  const dice = beamDiceAtRange(weapon.rating, ctx.range)
  if (dice <= 0 || !canBear(weapon, ctx)) return null
  // 5.9: "Marines may not be sent to attack any Core or otherwise protected
  // systems" — an illegal raid order, refused outright rather than rolled.
  if (
    ctx.transporterMode === 'commando-raid' &&
    (ctx.needleTarget === undefined || COMMANDO_RAID_FORBIDDEN.includes(ctx.needleTarget))
  ) {
    return null
  }
  const screens = screensAgainst(ctx)
  // 5.9: "generate a BD hits (no rerolls)" — plain BD, so no re-roll on a 6.
  const hits = rollHits(dice, screens, ctx, false)
  const scored = hits.normalHits
  const head = `TB-${weapon.rating} ${dice}D6 vs ${screenNote(screens)}: ${hits.faces.join(',')} → ${scored} hit(s)`

  if (ctx.transporterMode !== 'commando-raid') {
    return {
      hits: scored,
      result: {
        normalDamage: 0,
        penetratingDamage: 0,
        mode: 'standard',
        dice: hits.faces,
        boarders: scored,
        detail: `${head}, ${scored} boarding part(ies) sent`,
      },
    }
  }

  // 5.9: "Any ONE hit from each Transporter Beam sends over ONE Marine Boarding
  // Party" — a mount mounts one raid however many hits it scored.
  if (scored < 1) {
    return {
      hits: 0,
      result: {
        normalDamage: 0,
        penetratingDamage: 0,
        mode: 'standard',
        dice: hits.faces,
        detail: `${head}, no raid`,
      },
    }
  }
  const raid = commandoRaid(ctx.rng)
  return {
    hits: scored,
    raid,
    result: {
      normalDamage: 0,
      penetratingDamage: 0,
      mode: 'standard',
      dice: hits.faces,
      boarders: raid.marinesSent ? 1 : 0,
      targetedSystems: raid.systemDestroyed && ctx.needleTarget ? [ctx.needleTarget] : undefined,
      detail: `${head}. Commando raid — ${raid.detail}`,
    },
  }
}

/**
 * Fire a transporter beam and get the raid detail too (5.9).
 *
 * `WeaponSpec.fire` can only hand back a `WeaponResult`, which has nowhere to
 * say whether the boarding party came home; this is the entry point for a
 * caller that needs to know.
 */
export function fireTransporterBeam(
  weapon: BeamWeaponDef,
  ctx: BeamFiringContext,
): TransporterFireResult | null {
  return fireTransporter(weapon, ctx)
}

/**
 * Transporter Beam (5.9). Beam dice and beam ranges, screens as normal, but
 * *"no rerolls"* and no damage: every hit is one Marine or Damage Control Party
 * put aboard the target, either to take the ship (12.7) or to mount a commando
 * raid on one system.
 */
export const TRANSPORTER_SPEC: WeaponSpec = {
  weaponClass: 'transporter',
  label: 'Transporter beam',
  // Nothing to absorb: the hits deliver people, not energy.
  damageMode: 'standard',
  maxRange: (rating: number) => rating * BEAM_RANGE_BAND,
  fire(weapon: BeamWeaponDef, ctx: BeamFiringContext): WeaponResult | null {
    return fireTransporter(weapon, ctx)?.result ?? null
  },
  // 5.9: "They cannot be used to target fighters, gunboats or other ordnance,
  // and thus cannot be used in defensive fire."
  requiresFireCon: true,
}

// ---------------------------------------------------------------------------
// 5.10 – 5.12 Fixed-dice beam mounts
// ---------------------------------------------------------------------------

/**
 * The Gatling Battery, Twin Particle Array and Meson Projector are all a fixed
 * number of BD\* over a single range band, so they share one resolver.
 */
function fireFixedBeam(
  weapon: BeamWeaponDef,
  ctx: BeamFiringContext,
  config: { dice: number; range: number; label: string },
): WeaponResult | null {
  if (ctx.range > config.range || !canBear(weapon, ctx)) return null
  const screens = screensAgainst(ctx)
  const hits = rollHits(config.dice, screens, ctx, rerollsAllowed(ctx))
  return {
    normalDamage: hits.normalHits,
    penetratingDamage: hits.penetratingHits,
    mode: 'P',
    dice: hits.faces,
    detail:
      `${config.label} ${config.dice}D6 vs ${screenNote(screens)}: ${hits.faces.join(',')} → ` +
      `${hits.normalHits} damage, ${hits.penetratingHits} penetrating`,
  }
}

/**
 * Gatling Battery (5.10): *"6 beam dice (BD\*) out to a range of 12 MU. These
 * dice must all be directed at the same target."* No class and no range bands —
 * the mount's rating is not used.
 *
 * Its aft-arc clause (*"may not fire in anti-ship mode into the aft arc"*) is
 * the general ban of 4.2, enforced by `combat.planFireControl`, which also
 * already exempts point-defence fire.
 */
export const GATLING_SPEC: WeaponSpec = {
  weaponClass: 'gatling',
  label: 'Gatling battery',
  damageMode: 'P',
  maxRange: () => GATLING_RANGE,
  fire(weapon: BeamWeaponDef, ctx: BeamFiringContext): WeaponResult | null {
    return fireFixedBeam(weapon, ctx, { dice: GATLING_DICE, range: GATLING_RANGE, label: 'Gatling' })
  },
  // 5.10: "may also be used as a PDS, at which point it fully follows the rules
  // for PDS", limited to the mount's arcs.
  pointDefence: 'pds',
  requiresFireCon: true,
}

/**
 * Twin Particle Array (5.11): *"2 beam dice (BD\*) to a range of 24 MU"* — one
 * 24 MU band, so it does not shed a die at 12 MU the way a Beam-2 would.
 */
export const TWIN_PARTICLE_ARRAY_SPEC: WeaponSpec = {
  weaponClass: 'twin-particle-array',
  label: 'Twin particle array',
  damageMode: 'P',
  maxRange: () => TWIN_PARTICLE_ARRAY_RANGE,
  fire(weapon: BeamWeaponDef, ctx: BeamFiringContext): WeaponResult | null {
    return fireFixedBeam(weapon, ctx, {
      dice: TWIN_PARTICLE_ARRAY_DICE,
      range: TWIN_PARTICLE_ARRAY_RANGE,
      label: 'TPA',
    })
  },
  pointDefence: 'pds',
  requiresFireCon: true,
}

/** Meson Projector (5.12): *"1 BD\* out to a range of 48 MU"*, one band. */
export const MESON_PROJECTOR_SPEC: WeaponSpec = {
  weaponClass: 'meson-projector',
  label: 'Meson projector',
  damageMode: 'P',
  maxRange: () => MESON_PROJECTOR_RANGE,
  fire(weapon: BeamWeaponDef, ctx: BeamFiringContext): WeaponResult | null {
    return fireFixedBeam(weapon, ctx, {
      dice: MESON_PROJECTOR_DICE,
      range: MESON_PROJECTOR_RANGE,
      label: 'Meson',
    })
  },
  pointDefence: 'pds',
  requiresFireCon: true,
}

// ---------------------------------------------------------------------------
// 5.13 Needle Beams
// ---------------------------------------------------------------------------

/**
 * 5.13: *"Needle Beams can be used to target any system that appears on the SSD
 * (the only exceptions being Stealth Hulls, Biotech generators and Core
 * Systems)."*
 */
export const NEEDLE_BEAM_FORBIDDEN_TARGETS: readonly string[] = [
  'stealth-hull',
  'biotech-generator',
  'core-systems',
]

/** A shooter's sensor fit, as far as needle-beam targeting cares (5.13). */
export interface NeedleSensorFit {
  /** Enhanced Sensors fitted (13.13). Two of them stand in for Superior Sensors. */
  enhanced?: number
  /** Superior Sensors fitted (13.13). */
  superior?: boolean
}

/**
 * Whether the shooter can still pick out a system at this range (5.13).
 *
 * *"For a ship to use Needle Beams effectively beyond 12 MU it must have
 * Enhanced Sensors. If the weapon is fired at a target more than 24 MU it must
 * mount either Superior Sensors or two Enhanced Sensors."*
 *
 * Failing the requirement does not stop the shot: 5.13 spells out the
 * degradation for a shooter without even basic information — *"While it can
 * still do a point of damage to the target, rolls of a 6 do not damage the
 * targeted system"* — and "effectively" is the same word it uses here, so the
 * same penalty is applied.
 */
export function needleSensorsSuffice(range: number, sensors: NeedleSensorFit = {}): boolean {
  const enhanced = sensors.enhanced ?? 0
  if (range <= BEAM_RANGE_BAND) return true
  if (range <= 2 * BEAM_RANGE_BAND) return enhanced >= 1 || sensors.superior === true
  return sensors.superior === true || enhanced >= 2
}

/**
 * Whether a natural 6 will actually destroy the nominated system (5.13, 7.17,
 * 7.20). Everything that fails here still leaves the point of damage standing.
 */
function needleCanKillSystems(ctx: BeamFiringContext): boolean {
  if (ctx.needleTarget === undefined) return false
  if (NEEDLE_BEAM_FORBIDDEN_TARGETS.includes(ctx.needleTarget)) return false
  // 5.13: without basic sensor information "rolls of a 6 do not damage the
  // targeted system".
  if (ctx.needleTargetingInfo === false) return false
  if (!needleSensorsSuffice(ctx.range, ctx.sensors ?? {})) return false
  // 7.17: "Needle Beams and similar weapons, are ineffective against a ship
  // protected by Holofields" — but "Any ships firing at 6 MU or less will
  // ignore Holofields".
  if (ctx.holofield === true && ctx.range > 6) return false
  // 7.20: "Needle Beams may not target any specific systems while the ship is
  // under cloak."
  if (ctx.targetCloaked === true) return false
  return true
}

/**
 * Resolve needle-beam fire (5.13), also used by a phaser in needle mode (5.8).
 *
 * *"On a roll of 4+ they inflict a single point of damage. On a roll of a
 * natural 6 they inflict a single point of damage, and destroy the targeted
 * system."* The point of damage is scored on the **modified** face, the system
 * kill on the **natural** one — 4.6 reads a natural face for exactly this kind
 * of extra effect, and 5.13's own "rolls of a 6 do not damage the targeted
 * system" clause is written about the natural face.
 *
 * A mount nominates one system (5.2 charges a FireCon per *"single ship
 * system"*), so a second natural 6 from the same mount still does its point of
 * damage but has nothing left to destroy.
 */
function fireNeedleBeam(
  weapon: BeamWeaponDef,
  ctx: BeamFiringContext,
  label: string,
): WeaponResult | null {
  const dice = beamDiceAtRange(weapon.rating, ctx.range)
  if (dice <= 0 || !canBear(weapon, ctx)) return null
  const canKill = needleCanKillSystems(ctx)
  const faces: number[] = []
  let damage = 0
  let sixes = 0

  for (let i = 0; i < dice; i++) {
    const natural = d6(ctx.rng)
    const modified = Math.max(1, Math.min(6, natural + ctx.drm))
    faces.push(natural)
    if (modified >= 4) damage += 1
    if (natural === 6) sixes += 1
  }

  const destroyed = canKill && sixes > 0
  return {
    normalDamage: damage,
    penetratingDamage: 0,
    // 5.13 exempts needle beams from screens only; armour is never mentioned,
    // so the point of damage meets it like any other (4.8).
    mode: 'standard',
    dice: faces,
    targetedSystems: destroyed && ctx.needleTarget ? [ctx.needleTarget] : undefined,
    detail:
      `${label}-${weapon.rating} ${dice}D6 (screens ignored): ${faces.join(',')} → ${damage} damage` +
      (sixes > 0
        ? destroyed
          ? `, ${ctx.needleTarget} destroyed`
          : `, ${sixes} natural 6 but no system kill`
        : ''),
  }
}

/**
 * Needle Beam (5.13). Class dice on 12 MU bands, unaffected by screens of any
 * kind, 1 point of damage on a 4+ and the nominated system destroyed on a
 * natural 6 — permanently: *"Systems destroyed by Needle Beam fired cannot be
 * repaired by Damage Control Parties."*
 */
export const NEEDLE_BEAM_SPEC: WeaponSpec = {
  weaponClass: 'needle-beam',
  label: 'Needle beam',
  damageMode: 'standard',
  maxRange: (rating: number) => rating * BEAM_RANGE_BAND,
  fire(weapon: BeamWeaponDef, ctx: BeamFiringContext): WeaponResult | null {
    return fireNeedleBeam(weapon, ctx, 'NB')
  },
  // 5.2: "an operational FireCon ... for each ... Needle Beam weapons against a
  // single ship system", and 5.13: "A FireCon must be designated for every
  // Needle Beam target, though multiple Needle Beams firing at the same target
  // may share a FireCon."
  requiresFireCon: true,
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

/** Every energy weapon of 5.3 – 5.13, keyed by `WeaponClass`. */
export const BEAM_WEAPON_SPECS: WeaponSpecTable = {
  beam: BEAM_SPEC,
  emp: EMP_SPEC,
  'plasma-cannon': PLASMA_CANNON_SPEC,
  graser: GRASER_SPEC,
  'heavy-graser': HEAVY_GRASER_SPEC,
  phaser: PHASER_SPEC,
  transporter: TRANSPORTER_SPEC,
  gatling: GATLING_SPEC,
  'twin-particle-array': TWIN_PARTICLE_ARRAY_SPEC,
  'meson-projector': MESON_PROJECTOR_SPEC,
  'needle-beam': NEEDLE_BEAM_SPEC,
}

/** The point-defence mode a mount uses, or null when it may not point-defend. */
export function pointDefenceModeFor(weapon: WeaponDef): PdMode | null {
  if (!canPointDefend(weapon)) return null
  return BEAM_WEAPON_SPECS[weapon.weaponClass]?.pointDefence ?? null
}

// ---------------------------------------------------------------------------
// Mounts: mass and cost (5.3 – 5.13)
// ---------------------------------------------------------------------------

/** One buyable mounting, as the weapon's own section prints it (5.3 – 5.13). */
export interface MountOption {
  /** The numeric class, or 1 for the classless mounts of 5.10 – 5.12. */
  rating: number
  mass: number
  arcs: number
  /** Extra mass per additional arc, where the section prices arcs one at a time. */
  extraArcMass?: number
  /** A fixed arc upgrade, where the section sells one instead (e.g. "+1 for 3 additional arcs"). */
  arcUpgrade?: { toArcs: number; extraMass: number }
  /** Arc ceiling, where the section sets one (5.13: needle beams, 3 arcs maximum). */
  maxArcs?: number
  note?: string
}

/** The mounts and price of one weapon family (5.3 – 5.13). */
export interface MountTable {
  weaponClass: WeaponClass
  pointsPerMass: number
  options: MountOption[]
}

/**
 * Mass and points for every mounting in 5.3 – 5.13, as printed.
 *
 * The construction tables (section 14) are the authority for a whole ship's
 * cost; this is the same data as its own section states it, so that a weapon
 * resolver and its price never drift apart.
 */
export const BEAM_FAMILY_MOUNTS: Record<string, MountTable> = {
  beam: {
    weaponClass: 'beam',
    pointsPerMass: 3,
    options: [
      { rating: 1, mass: 1, arcs: 6 },
      { rating: 2, mass: 2, arcs: 3, arcUpgrade: { toArcs: 6, extraMass: 1 } },
      { rating: 2, mass: 1, arcs: 2, note: 'Broadside beam — port or starboard pair only (5.3)' },
      { rating: 3, mass: 4, arcs: 1, extraArcMass: 1 },
      { rating: 4, mass: 8, arcs: 1, extraArcMass: 2 },
      { rating: 5, mass: 16, arcs: 1, extraArcMass: 4 },
    ],
  },
  emp: {
    weaponClass: 'emp',
    pointsPerMass: 3,
    options: [
      { rating: 1, mass: 1, arcs: 6 },
      { rating: 2, mass: 2, arcs: 3, arcUpgrade: { toArcs: 6, extraMass: 1 } },
      { rating: 3, mass: 4, arcs: 1, extraArcMass: 1 },
      { rating: 4, mass: 8, arcs: 1, extraArcMass: 2 },
    ],
  },
  'plasma-cannon': {
    weaponClass: 'plasma-cannon',
    pointsPerMass: 3,
    options: [
      { rating: 1, mass: 1, arcs: 3 },
      { rating: 1, mass: 2, arcs: 6 },
      { rating: 2, mass: 4, arcs: 3, arcUpgrade: { toArcs: 6, extraMass: 2 } },
      { rating: 3, mass: 8, arcs: 1, extraArcMass: 2 },
      { rating: 4, mass: 16, arcs: 1, extraArcMass: 4 },
    ],
  },
  graser: {
    weaponClass: 'graser',
    pointsPerMass: 3,
    options: [
      { rating: 1, mass: 1, arcs: 3 },
      { rating: 1, mass: 2, arcs: 6 },
      { rating: 2, mass: 4, arcs: 3, arcUpgrade: { toArcs: 6, extraMass: 2 } },
      { rating: 3, mass: 8, arcs: 1, extraArcMass: 2 },
      { rating: 4, mass: 16, arcs: 1, extraArcMass: 4 },
    ],
  },
  'heavy-graser': {
    weaponClass: 'heavy-graser',
    // 5.7: "Heavy Grasers cost 3 points per mass (4 points per mass for HiGs)".
    pointsPerMass: 3,
    options: [
      { rating: 1, mass: 2, arcs: 1 },
      { rating: 1, mass: 3, arcs: 3 },
      { rating: 1, mass: 4, arcs: 6 },
      { rating: 2, mass: 9, arcs: 1, extraArcMass: 3 },
      { rating: 3, mass: 24, arcs: 1, extraArcMass: 6 },
    ],
  },
  phaser: {
    weaponClass: 'phaser',
    // 5.8: "3 points per mass +2 for each weapon. (6 points per mass if ship has AFC)".
    pointsPerMass: 3,
    options: [
      { rating: 1, mass: 1, arcs: 3 },
      { rating: 1, mass: 2, arcs: 6 },
      { rating: 2, mass: 4, arcs: 3, arcUpgrade: { toArcs: 6, extraMass: 2 } },
      { rating: 3, mass: 8, arcs: 1, extraArcMass: 2 },
      { rating: 4, mass: 16, arcs: 1, extraArcMass: 4 },
    ],
  },
  transporter: {
    weaponClass: 'transporter',
    pointsPerMass: 3,
    options: [
      { rating: 1, mass: 1, arcs: 6 },
      { rating: 2, mass: 2, arcs: 3, arcUpgrade: { toArcs: 6, extraMass: 1 } },
      { rating: 3, mass: 4, arcs: 1, extraArcMass: 1 },
      { rating: 4, mass: 8, arcs: 1, extraArcMass: 2 },
    ],
  },
  gatling: {
    weaponClass: 'gatling',
    pointsPerMass: 4,
    options: [
      { rating: 1, mass: 2, arcs: 1 },
      { rating: 1, mass: 3, arcs: 3 },
      { rating: 1, mass: 4, arcs: 6 },
      { rating: 1, mass: 5, arcs: 2, note: 'Broadside pair: 5 mass buys two 2-arc batteries (5.10)' },
    ],
  },
  'twin-particle-array': {
    weaponClass: 'twin-particle-array',
    pointsPerMass: 4,
    options: [
      { rating: 1, mass: 2, arcs: 1 },
      { rating: 1, mass: 3, arcs: 3 },
      { rating: 1, mass: 4, arcs: 6 },
      { rating: 1, mass: 5, arcs: 2, note: 'Broadside pair: 5 mass buys two 2-arc arrays (5.11)' },
    ],
  },
  'meson-projector': {
    weaponClass: 'meson-projector',
    pointsPerMass: 4,
    options: [
      { rating: 1, mass: 2, arcs: 1 },
      { rating: 1, mass: 3, arcs: 3 },
      { rating: 1, mass: 4, arcs: 6 },
    ],
  },
  'needle-beam': {
    weaponClass: 'needle-beam',
    pointsPerMass: 3,
    options: [
      { rating: 1, mass: 2, arcs: 2, extraArcMass: 1, maxArcs: 3 },
      { rating: 2, mass: 4, arcs: 1, extraArcMass: 2, maxArcs: 3 },
      { rating: 3, mass: 8, arcs: 1, extraArcMass: 4, maxArcs: 3 },
      { rating: 4, mass: 16, arcs: 1, extraArcMass: 8, maxArcs: 3 },
    ],
  },
}

/**
 * Points for one mount of `mass` (5.3 – 5.13).
 *
 * Two families break the flat rate. A HiG is 4 points per mass instead of 3
 * (5.7). A phaser is *"3 points per mass +2 for each weapon"*, or 6 per mass on
 * a ship with an Advanced FireCon — and the AFC rate *replaces* the +2 rather
 * than adding to it, which is what 5.8's own example shows: a mass-4 Phaser-2
 * costs 14, or 24 with an AFC.
 */
export function mountPoints(
  weaponClass: WeaponClass,
  mass: number,
  opts: { highIntensity?: boolean; shipHasAdvancedFireCon?: boolean } = {},
): number {
  const table = BEAM_FAMILY_MOUNTS[weaponClass]
  if (!table) throw new RangeError(`mountPoints: ${weaponClass} is not an energy weapon of 5.3 – 5.13`)
  if (weaponClass === 'heavy-graser' && opts.highIntensity === true) return mass * 4
  if (weaponClass === 'phaser') {
    return opts.shipHasAdvancedFireCon === true ? mass * 6 : mass * table.pointsPerMass + 2
  }
  return mass * table.pointsPerMass
}
