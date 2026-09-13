/**
 * Full Thrust: Project Continuum — flight operations, fighters (section 8).
 *
 * Fighters are the one subsystem in the game that has its own movement phases,
 * its own attack phase, its own defensive phase and its own economy (Combat
 * Endurance Factors). That is why it lives in its own module: almost nothing in
 * here is shared with ship gunnery beyond the beam table itself.
 *
 * The engine models the *group*, never the individual fighter (8, intro:
 * "Fighters operate in groups of 1 to 6 craft, with each group moving and
 * firing as a single unit"), so a group's strength is just a count and losses
 * are subtracted from it.
 *
 * Every rule reference is to *Full Thrust: Project Continuum* v1.1.4, April
 * 2017; the prose is quoted in `docs/rules/fighters.md`, which is what this
 * file is checked against.
 *
 * Damage is *reported*, never applied: how a fighter's hits land on screens,
 * armour and hull is `combat.ts`'s business (4.8, 4.9), exactly as for a
 * weapon resolver.
 */

import {
  beamDamage,
  d6,
  pointDefenceKills,
  rollBeamVolley,
  type PdMode,
  type Rng,
  type ScreenLevel,
} from './dice'
import { arcTo, distance } from './geometry'
import type { Arc, Course, DamageMode, Point } from './types'

// ---------------------------------------------------------------------------
// Dice helpers the fighter rules need and `dice.ts` does not provide
// ---------------------------------------------------------------------------

/**
 * A three-sided die (1.7): "simply roll a d6, with 1-2 =1, 3-4=2, and 5-6=3".
 * Graser fighters roll one per hit (8.15).
 */
export function d3(rng: Rng): number {
  return Math.ceil(d6(rng) / 2)
}

/**
 * Clamp a die roll after its modifier (1.7): "A DRM cannot increase the result
 * of a die roll above 6 or decrease it below 1."
 */
function applyDrm(face: number, drm: number): number {
  return Math.max(1, Math.min(6, face + drm))
}

/** What a volley of fighter dice did. Faces are the *natural* rolls, in order. */
export interface FighterVolley {
  /** Natural faces in the order rolled, re-rolls included. */
  dice: number[]
  /** Damage (or kills) screens and armour may absorb. */
  normalDamage: number
  /** Re-roll damage (or kills), which ignores screens and armour (4.6). */
  penetratingDamage: number
}

/**
 * Roll fighter dice on the beam table (8.9, 8.10, 4.5 – 4.7).
 *
 * Delegates straight to `rollBeamVolley` when there is no modifier, which is
 * the common case and keeps one implementation of the table. With a modifier it
 * rolls locally, because 1.7 says "In situations where a re-roll is allowed …
 * the DRM will not normally be applied to the re-roll as well" and
 * `rollBeamVolley` carries its DRM into the re-roll. The re-roll test is on the
 * *natural* face either way (4.6), which is what makes the Light Fighter table
 * of 8.15 come out as printed: a natural 5 modified to a 6 scores two kills but
 * earns no extra die.
 */
export function rollFighterVolley(
  diceCount: number,
  screens: ScreenLevel,
  rng: Rng,
  opts: { drm?: number; reroll?: boolean } = {},
): FighterVolley {
  const drm = opts.drm ?? 0
  const reroll = opts.reroll ?? true

  if (drm === 0) {
    const volley = rollBeamVolley(diceCount, screens, rng, { penetrating: reroll })
    return {
      dice: volley.dice.map((die) => die.natural),
      normalDamage: volley.normalDamage,
      penetratingDamage: volley.penetratingDamage,
    }
  }

  const dice: number[] = []
  let normalDamage = 0
  let penetratingDamage = 0

  const resolve = (isReroll: boolean): void => {
    const natural = d6(rng)
    dice.push(natural)
    // The modifier belongs to the shot, not to the penetrating follow-up (1.7).
    const modified = isReroll ? natural : applyDrm(natural, drm)
    // A re-roll has already burned through the screen, so it scores unscreened
    // (4.6) — the same convention `rollBeamVolley` uses.
    const damage = beamDamage(modified, isReroll ? 0 : screens)
    if (isReroll) penetratingDamage += damage
    else normalDamage += damage
    if (reroll && natural === 6) resolve(true)
  }

  for (let i = 0; i < diceCount; i++) resolve(false)
  return { dice, normalDamage, penetratingDamage }
}

/**
 * Kills scored by a volley of fighter dice against other fighters (8.10):
 * "inflict casualties as for Beam-1 fire against an unscreened target: 4 or 5
 * kills one fighter, 6 kills two fighters and re-roll." A kill is a point of
 * unscreened beam damage, so the two halves of the volley simply add.
 */
export function rollFighterKills(
  diceCount: number,
  rng: Rng,
  opts: { drm?: number; reroll?: boolean } = {},
): { dice: number[]; kills: number } {
  const volley = rollFighterVolley(diceCount, 0, rng, {
    drm: opts.drm ?? 0,
    reroll: opts.reroll ?? true,
  })
  return { dice: volley.dice, kills: volley.normalDamage + volley.penetratingDamage }
}

/**
 * Return fire from a group that has burned all its endurance (8.13): "A group
 * that is engaged in a dogfight by an enemy group after exhausting its CEF may
 * return fire, but only scores one kill on rolls of 6." That is its own table,
 * not a modifier on the usual one — there is no re-roll and a 6 scores one.
 */
export function rollExhaustedReturnFire(
  diceCount: number,
  rng: Rng,
): { dice: number[]; kills: number } {
  const dice: number[] = []
  let kills = 0
  for (let i = 0; i < diceCount; i++) {
    const face = d6(rng)
    dice.push(face)
    if (face === 6) kills += 1
  }
  return { dice, kills }
}

/**
 * A point-defence die against fighters, with a modifier (8.8, 8.15).
 *
 * `dice.ts`'s `pointDefenceKills` has no DRM parameter, and Heavy Fighters
 * (−1), Light Fighters (+1) and light missiles (+1) all need one, so this
 * delegates when there is no modifier and rolls the same table locally when
 * there is. The re-roll keys on the natural 6 and is itself unmodified (1.7,
 * 4.6).
 */
function rollModifiedPointDefence(
  dice: number,
  mode: PdMode,
  drm: number,
  rng: Rng,
  opts: { heavyMissile?: boolean } = {},
): { rolls: number[]; kills: number } {
  if (drm === 0) return pointDefenceKills(dice, mode, rng, opts)
  const heavy = opts.heavyMissile ?? false
  const rolls: number[] = []
  let kills = 0

  const resolve = (isReroll: boolean): void => {
    const natural = d6(rng)
    rolls.push(natural)
    const face = isReroll ? natural : applyDrm(natural, drm)
    if (heavy) {
      if (mode === 'pds' ? face >= 5 : face === 6) kills += 1
      return
    }
    if (mode === 'pds') {
      if (face === 6) kills += 2
      else if (face >= 4) kills += 1
    } else {
      if (face === 6) kills += 1
      else if (face === 5) kills += 1
    }
    if (natural === 6) resolve(true)
  }

  for (let i = 0; i < dice; i++) resolve(false)
  return { rolls, kills }
}

// ---------------------------------------------------------------------------
// The catalogue (8.15)
// ---------------------------------------------------------------------------

/** Base fighter types — the frames a group is built on (8.15). */
export type FighterTypeId =
  | 'standard'
  | 'interceptor'
  | 'attack'
  | 'torpedo'
  | 'graser'
  | 'plasma'
  | 'mkp'
  | 'missile'
  | 'multi-role'
  | 'assault-shuttle'

/**
 * Modifications, marked "(+Mod)" in 8.14: "Some fighter 'systems' here are
 * actually modifications applied to any fighter type." These stack onto a base
 * type and are *not* types in their own right, which is why the book can price
 * "Fast standard fighters" at 4 (= standard 3 + fast 1) without listing them
 * separately in the catalogue.
 *
 * `light` is grouped here rather than with the base types because 8.15 prices
 * it off whatever role it flies ("18 for standard, 24 for attack, etc.") and
 * lets it take the Fast, Interceptor and Attack options.
 */
export type FighterModifierId = 'heavy' | 'fast' | 'long-range' | 'ftl' | 'robot' | 'light'

/**
 * Beams or cannon (8.15): "If equipped with beams they inflict BD* hits. If
 * equipped with cannon they inflict BD hits (do not re-roll 6s), but ignore the
 * effects of screens."
 */
export type FighterArmament = 'beam' | 'cannon'

/** How a hit from a fighter gun is scored (8.15). */
export type FighterHitKind =
  /** One damage point per hit — the plain beam/cannon fighter. */
  | 'single'
  /** Graser fighters: "each hit inflicting 1d3 damage, semi-AP". */
  | 'd3-sap'
  /** Plasma fighters: "1d6-2 - screens/DRM hits with rerolls on a 6". */
  | 'plasma'

/** One of a fighter type's two gun profiles (8.15). */
export interface FighterGunProfile {
  /** Die roll modifier on every attack die. */
  drm: number
  /** Endurance the gun burns when fired (8.13, 8.15). */
  cef: number
  hit: FighterHitKind
  /** Range in MU. 6 for everything but the Missile Fighter's salvo (8.7). */
  range: number
}

/** One-shot payloads certain types carry (8.15). */
export type FighterPayloadKind = 'pulse-torpedo' | 'mkp' | 'salvo-missile' | 'boarding'

/** A base fighter type as catalogued in 8.15. */
export interface FighterType {
  id: FighterTypeId
  label: string
  /** Fighters in a full-strength group (8, intro). Light raises it to 8. */
  groupSize: number
  /** Combat Endurance Factors at full fuel (8, intro; 8.13). */
  cef: number
  /** Main move in MU (8.5). */
  move: number
  /** Secondary move in MU (8.5) — 12 for every type, Fast included. */
  secondaryMove: number
  pointsPerFighter: number
  /** Per wing of six. Assault Shuttles are priced per wing only (8.15). */
  pointsPerWing: number
  /** How it attacks ships. Null for the Assault Shuttle, which boards. */
  antiShip: FighterGunProfile | null
  /** How it attacks fighters, missiles and other ordnance. */
  antiFighter: FighterGunProfile
  /** 8.12: "Attack or Torpedo Fighters cannot intercept missiles". */
  canInterceptMissiles: boolean
  armaments: FighterArmament[]
  payload: FighterPayloadKind | null
  notes: string
}

/** Standard fighter range, and the general fighter attack range (8.7). */
export const FIGHTER_ATTACK_RANGE = 6

/** Missile Fighter fire-control range for its salvo (8.15). */
export const MISSILE_FIGHTER_RANGE = 12

/** Standard main move (8.5) and secondary move (8.5). */
export const FIGHTER_MOVE = 24
export const FIGHTER_SECONDARY_MOVE = 12

const gun = (
  drm: number,
  hit: FighterHitKind = 'single',
  cef = 1,
  range = FIGHTER_ATTACK_RANGE,
): FighterGunProfile => ({ drm, cef, hit, range })

/**
 * The fighter catalogue of 8.15, cross-checked against the price table at
 * 14.7. Costs are quoted per fighter and per wing exactly as printed, and
 * every printed pair is consistent with six to a wing (3×6=18, 4×6=24, 6×6=36,
 * 7×6=42, 5×6=30, 1×6=6).
 *
 * The Light Fighter is the one that looks wrong and is not: 14.7 prices it "4
 * each, 18 for standard wing, 24 for attack" while a Light group is eight
 * craft. The per-wing figures are the ones that bind, and they are the same as
 * an ordinary wing's — which is why the Light modification costs nothing per
 * fighter here and simply changes the group's size and its endurance.
 */
export const FIGHTER_TYPES: Record<FighterTypeId, FighterType> = {
  standard: {
    id: 'standard',
    label: 'Standard Fighter',
    groupSize: 6,
    cef: 6,
    move: FIGHTER_MOVE,
    secondaryMove: FIGHTER_SECONDARY_MOVE,
    pointsPerFighter: 3,
    pointsPerWing: 18,
    antiShip: gun(0),
    antiFighter: gun(0),
    canInterceptMissiles: true,
    armaments: ['beam', 'cannon'],
    payload: null,
    notes:
      '8.15: "Against ships a full strength fighter wing (6 fighters) inflicts 6 BD* hits. ' +
      'Against other fighters or missiles, they inflict 6 BD* hits."',
  },
  interceptor: {
    id: 'interceptor',
    label: 'Interceptor',
    groupSize: 6,
    cef: 6,
    move: FIGHTER_MOVE,
    secondaryMove: FIGHTER_SECONDARY_MOVE,
    pointsPerFighter: 3,
    pointsPerWing: 18,
    antiShip: gun(-2),
    antiFighter: gun(1),
    canInterceptMissiles: true,
    armaments: ['beam', 'cannon'],
    payload: null,
    notes:
      '8.15: "BD* hits with a -2 DRM against ships, and BD* hits with a +1 DRM against ' +
      'fighters, missiles and ordnance."',
  },
  attack: {
    id: 'attack',
    label: 'Attack Fighter',
    groupSize: 6,
    cef: 6,
    move: FIGHTER_MOVE,
    secondaryMove: FIGHTER_SECONDARY_MOVE,
    pointsPerFighter: 4,
    pointsPerWing: 24,
    antiShip: gun(1),
    antiFighter: gun(-2),
    // 8.12: "Attack or Torpedo Fighters cannot intercept missiles".
    canInterceptMissiles: false,
    armaments: ['beam', 'cannon'],
    payload: null,
    notes:
      '8.15: "+1 DRM against ships … one damage point with rolls of 3 or 4, and two damage ' +
      'points with 5 or 6" on an unscreened target; -2 DRM against fighters.',
  },
  torpedo: {
    id: 'torpedo',
    label: 'Torpedo Fighter',
    groupSize: 6,
    cef: 6,
    move: FIGHTER_MOVE,
    secondaryMove: FIGHTER_SECONDARY_MOVE,
    pointsPerFighter: 6,
    pointsPerWing: 36,
    antiShip: gun(-2),
    antiFighter: gun(-2),
    canInterceptMissiles: false,
    armaments: ['beam', 'cannon'],
    payload: 'pulse-torpedo',
    notes:
      '8.15: one-shot Pulse Torpedo Launcher, range 6 MU, hits on 4+, damage equal to the die ' +
      'roll, ignores screens, SAP. Secondary beams at -2 DRM cannot fire the same turn.',
  },
  graser: {
    id: 'graser',
    label: 'Graser Fighter',
    groupSize: 6,
    cef: 6,
    move: FIGHTER_MOVE,
    secondaryMove: FIGHTER_SECONDARY_MOVE,
    pointsPerFighter: 7,
    pointsPerWing: 42,
    // "Firing the Graser is very energy intensive, and drains 2 points of CEF."
    antiShip: gun(0, 'd3-sap', 2),
    antiFighter: gun(-2),
    canInterceptMissiles: true,
    armaments: ['cannon'],
    payload: null,
    notes:
      '8.15: "A full strength wing delivers 6 BD* hits with the Graser against ships, with each ' +
      'hit inflicting 1d3 damage, semi-AP." Secondary cannon at -2 DRM against fighters.',
  },
  plasma: {
    id: 'plasma',
    label: 'Plasma Fighter',
    groupSize: 6,
    cef: 6,
    move: FIGHTER_MOVE,
    secondaryMove: FIGHTER_SECONDARY_MOVE,
    pointsPerFighter: 7,
    pointsPerWing: 42,
    antiShip: gun(0, 'plasma', 2),
    antiFighter: gun(-2),
    canInterceptMissiles: true,
    armaments: ['cannon'],
    payload: null,
    notes:
      '8.15: "they inflict 1d6-2 - screens/DRM hits with rerolls on a 6". -2 DRM against ' +
      'fighters. Firing "consumes 2 points of combat endurance".',
  },
  mkp: {
    id: 'mkp',
    label: 'MKP Fighter',
    groupSize: 6,
    cef: 6,
    move: FIGHTER_MOVE,
    secondaryMove: FIGHTER_SECONDARY_MOVE,
    pointsPerFighter: 6,
    pointsPerWing: 36,
    antiShip: gun(-2),
    antiFighter: gun(-2),
    canInterceptMissiles: true,
    armaments: ['beam', 'cannon'],
    payload: 'mkp',
    notes:
      '8.15: one-shot Multiple Kinetic Penetrators, range 6 MU, "1 hit on 4+, 2 hits on a 6, and ' +
      'each hit inflicts 4 points of AP damage". Secondary guns at -2 DRM, not the same turn.',
  },
  missile: {
    id: 'missile',
    label: 'Missile Fighter',
    groupSize: 6,
    cef: 6,
    move: FIGHTER_MOVE,
    secondaryMove: FIGHTER_SECONDARY_MOVE,
    pointsPerFighter: 4,
    pointsPerWing: 24,
    antiShip: gun(-2),
    antiFighter: gun(-2),
    canInterceptMissiles: true,
    armaments: ['beam', 'cannon'],
    payload: 'salvo-missile',
    notes:
      '8.15: one-shot Salvo Missile launched in phase 3 from up to 12 MU; the group "must not be ' +
      'engaged by other fighters at time of launch". Secondary guns at -2 DRM, 6 MU.',
  },
  'multi-role': {
    id: 'multi-role',
    label: 'Multi-Role Fighter',
    groupSize: 6,
    cef: 6,
    move: FIGHTER_MOVE,
    secondaryMove: FIGHTER_SECONDARY_MOVE,
    pointsPerFighter: 5,
    pointsPerWing: 30,
    // Until a loadout is chosen the MRF flies as a standard fighter (8.15).
    antiShip: gun(0),
    antiFighter: gun(0),
    canInterceptMissiles: true,
    armaments: ['beam', 'cannon'],
    payload: null,
    notes:
      '8.15: "the fighter can launch and fight as a standard fighter, Interceptor, or Attack ' +
      'Fighter", reconfigured while re-arming in a hangar bay.',
  },
  'assault-shuttle': {
    id: 'assault-shuttle',
    label: 'Assault Shuttle',
    groupSize: 6,
    cef: 6,
    move: FIGHTER_MOVE,
    secondaryMove: FIGHTER_SECONDARY_MOVE,
    // 8.15 quotes only "6 points per wing"; 14.7's table gives both figures,
    // "1 point each, 6 per wing", and they agree.
    pointsPerFighter: 1,
    pointsPerWing: 6,
    antiShip: null,
    antiFighter: gun(-2),
    canInterceptMissiles: true,
    armaments: ['cannon'],
    payload: 'boarding',
    notes:
      '8.15: "one-use attack craft designed to deliver Marines and Boarding Parties onto enemy ' +
      'ships … Standard Screens will not stop this attack but Advanced Screens will."',
  },
}

/** A "(+Mod)" entry from 8.15 — a modification, not a type of its own. */
export interface FighterModifier {
  id: FighterModifierId
  label: string
  /** Cost change per fighter. Negative for Robot (8.15). */
  pointsPerFighter: number
  /** Base types this may not be combined with (8.15 Light). */
  excludes: FighterModifierId[]
  notes: string
}

/**
 * The modifications of 8.15. Each stacks onto a base type; the pre-priced
 * combinations in the text confirm the arithmetic — Fast standard 4 = 3 + 1,
 * Long Range standard 4 = 3 + 1, Standard Robot 2 = 3 − 1.
 */
export const FIGHTER_MODIFIERS: Record<FighterModifierId, FighterModifier> = {
  heavy: {
    id: 'heavy',
    label: 'Heavy',
    pointsPerFighter: 3,
    excludes: ['light'],
    notes:
      '8.15: "Point defense weapons, including other fighters, suffer a -1 DRM when engaging ' +
      'Heavy Fighters. Scatterpacks and Interceptor Pods do 1d3 hits, not 1d6."',
  },
  fast: {
    id: 'fast',
    label: 'Fast',
    pointsPerFighter: 1,
    excludes: [],
    notes:
      '8.15: "The base move of a Fast Fighter is increased from 24 MU to 36 MU … the range of ' +
      'this [secondary] move is limited to 12 MU."',
  },
  'long-range': {
    id: 'long-range',
    label: 'Long Range',
    pointsPerFighter: 1,
    excludes: ['light'],
    notes:
      '8.15: "The fighter has 9 points of combat endurance, not the normal 6. This modification ' +
      'can only be applied once."',
  },
  ftl: {
    id: 'ftl',
    label: 'FTL',
    pointsPerFighter: 1,
    excludes: [],
    notes:
      '8.15: "may begin the game deployed within 6 MU of their carrier instead of having to be ' +
      'launched … However, 1 point of endurance will be checked off."',
  },
  robot: {
    id: 'robot',
    label: 'Robot',
    pointsPerFighter: -1,
    excludes: [],
    notes:
      '8.15: takes its secondary move "at the end of the end of phase 4 after all fighters and ' +
      'missiles have made their moves"; immune to the fighter morale rules (8.17).',
  },
  light: {
    id: 'light',
    label: 'Light',
    // "Light Fighters cost the same as other fighter types. 18 for standard,
    // 24 for attack, etc." — the wing price is the role's, for eight craft.
    pointsPerFighter: 0,
    excludes: ['heavy', 'long-range'],
    notes:
      '8.15: eight to a group, four CEF, and "Any attack at a group of Light Fighters gets a +1 ' +
      'bonus".',
  },
}

/** Base types a Light group may be built on (8.15). */
const LIGHT_ALLOWED_TYPES: readonly FighterTypeId[] = ['standard', 'interceptor', 'attack', 'missile']

/** Roles a Multi-Role Fighter may be configured as (8.15). */
export const MULTI_ROLE_LOADOUTS: readonly FighterTypeId[] = ['standard', 'interceptor', 'attack']

/**
 * A built fighter group's derived stats: the base type with every modification
 * folded in (8.15). This is what the rest of the module reads, so nothing has
 * to re-derive "is it Light" at each call site.
 */
export interface FighterProfile {
  typeId: FighterTypeId
  modifiers: readonly FighterModifierId[]
  label: string
  groupSize: number
  cef: number
  move: number
  secondaryMove: number
  /** Points for a full-strength group. */
  points: number
  antiShip: FighterGunProfile | null
  antiFighter: FighterGunProfile
  canInterceptMissiles: boolean
  payload: FighterPayloadKind | null
  /**
   * Modifier a *light* point-defence weapon or another fighter suffers when
   * shooting at this group: −1 Heavy, +1 Light (8.15).
   */
  defenceDrm: number
  heavy: boolean
  light: boolean
  fast: boolean
  longRange: boolean
  robot: boolean
  ftl: boolean
}

/**
 * Check a build against 8.15's compatibility rules. Returns the problems found,
 * empty when the build is legal — "Heavy, Torpedo, and Long Range options are
 * not available for Light Fighters", and Long Range "can only be applied once".
 */
export function validateFighterBuild(
  typeId: FighterTypeId,
  modifiers: readonly FighterModifierId[],
): string[] {
  const problems: string[] = []
  const seen = new Set<FighterModifierId>()
  for (const id of modifiers) {
    if (seen.has(id)) problems.push(`${FIGHTER_MODIFIERS[id].label} may only be applied once (8.15)`)
    seen.add(id)
  }
  // Exclusions are recorded on both sides of the pair, so report each pair once.
  const reported = new Set<string>()
  for (const id of seen) {
    for (const clash of FIGHTER_MODIFIERS[id].excludes) {
      if (!seen.has(clash)) continue
      const key = [id, clash].sort().join('+')
      if (reported.has(key)) continue
      reported.add(key)
      problems.push(
        `${FIGHTER_MODIFIERS[id].label} cannot be combined with ${FIGHTER_MODIFIERS[clash].label} (8.15)`,
      )
    }
  }
  if (seen.has('light') && !LIGHT_ALLOWED_TYPES.includes(typeId)) {
    problems.push(`Light Fighters may not be built as ${FIGHTER_TYPES[typeId].label} (8.15)`)
  }
  return problems
}

/**
 * Fold a base type and its modifications into one profile (8.15).
 *
 * The one arithmetic judgement here: a modification priced "+1 per fighter
 * (+6 per wing)" is charged per *fighter*, so a Light wing of eight pays eight.
 * The book only ever prints the per-wing figure for wings of six.
 */
export function fighterProfile(
  typeId: FighterTypeId,
  modifiers: readonly FighterModifierId[] = [],
): FighterProfile {
  const base = FIGHTER_TYPES[typeId]
  const has = (id: FighterModifierId): boolean => modifiers.includes(id)

  const light = has('light')
  const groupSize = light ? 8 : base.groupSize
  const cef = light ? 4 : has('long-range') ? 9 : base.cef
  const move = has('fast') ? 36 : base.move

  let points = base.pointsPerWing
  for (const id of new Set(modifiers)) {
    points += FIGHTER_MODIFIERS[id].pointsPerFighter * groupSize
  }

  // 8.15 Heavy: "-1 DRM when engaging Heavy Fighters"; Light: "+1 bonus".
  const defenceDrm = (has('heavy') ? -1 : 0) + (light ? 1 : 0)

  const labelParts = modifiers.map((id) => FIGHTER_MODIFIERS[id].label)
  return {
    typeId,
    modifiers: [...modifiers],
    label: [...labelParts, base.label].join(' '),
    groupSize,
    cef,
    move,
    secondaryMove: base.secondaryMove,
    points,
    antiShip: base.antiShip,
    antiFighter: base.antiFighter,
    canInterceptMissiles: base.canInterceptMissiles,
    payload: base.payload,
    defenceDrm,
    heavy: has('heavy'),
    light,
    fast: has('fast'),
    longRange: has('long-range'),
    robot: has('robot'),
    ftl: has('ftl'),
  }
}

// ---------------------------------------------------------------------------
// The group
// ---------------------------------------------------------------------------

/** Where a group is in its life cycle (8.1, 8.16). */
export type FighterGroupStatus = 'aboard' | 'in-flight' | 'destroyed'

/** Standing orders for the turn (8.6). */
export type FighterMission = 'free' | 'screen' | 'pursuit'

/** Pilot quality (8.18, optional). */
export type PilotQuality = 'average' | 'ace' | 'turkey'

/**
 * A fighter group in play (8). Six craft at full strength, eight if Light,
 * with its own fuel state and its own idea of who it is fighting.
 */
export interface FighterGroup {
  id: string
  side: string
  typeId: FighterTypeId
  modifiers: FighterModifierId[]
  armament: FighterArmament
  /** Multi-Role loadout chosen at re-arm (8.15); null outside that type. */
  loadout: FighterTypeId | null
  /** Carrier it flies from, or null once the carrier is gone (8.1). */
  carrierId: string | null
  status: FighterGroupStatus
  position: Point
  /** "A fighter group does have a facing, which need not be … the direction of movement" (8.5). */
  facing: Course
  /** Fighters left (8.13). */
  strength: number
  /** Combat Endurance Factors left (8.13). */
  cef: number
  pilots: PilotQuality
  /** 8.18: an Ace dies last, unless an enemy Ace singles him out. */
  aceKilled: boolean
  mission: FighterMission
  /** Ship or group being screened or pursued (8.6). */
  escorting: string | null
  launchedTurn: number | null
  movedThisTurn: boolean
  secondaryMovedThisTurn: boolean
  /** 8.6: an evading group is missed by every further ship weapon this turn. */
  evading: boolean
  attackedThisTurn: boolean
  /** Enemy group ids this one is locked with (8.7: "engaged"). */
  engagedWith: string[]
  /** 8.15: the one-shot payload has been fired. */
  payloadSpent: boolean
  /** 8.16: earliest turn it may launch again; null while none is pending. */
  readyTurn: number | null
  /** 8.4 / 8.16: it may not be launched again at all this game. */
  grounded: boolean
}

/** Options for building a group; everything else takes its catalogue default. */
export interface FighterGroupOptions {
  id: string
  side: string
  typeId: FighterTypeId
  modifiers?: FighterModifierId[]
  armament?: FighterArmament
  loadout?: FighterTypeId | null
  carrierId?: string | null
  position?: Point
  facing?: Course
  strength?: number
  cef?: number
  pilots?: PilotQuality
  status?: FighterGroupStatus
}

/**
 * Build a fighter group at full strength and full fuel (8, intro: six craft and
 * "six Combat Endurance Factors (CEF) per standard fighter group").
 */
export function createFighterGroup(opts: FighterGroupOptions): FighterGroup {
  const profile = fighterProfile(opts.typeId, opts.modifiers ?? [])
  return {
    id: opts.id,
    side: opts.side,
    typeId: opts.typeId,
    modifiers: [...(opts.modifiers ?? [])],
    armament: opts.armament ?? FIGHTER_TYPES[opts.typeId].armaments[0],
    loadout: opts.loadout ?? null,
    carrierId: opts.carrierId ?? null,
    status: opts.status ?? 'aboard',
    position: opts.position ?? { x: 0, y: 0 },
    facing: opts.facing ?? 12,
    strength: opts.strength ?? profile.groupSize,
    cef: opts.cef ?? profile.cef,
    pilots: opts.pilots ?? 'average',
    aceKilled: false,
    mission: 'free',
    escorting: null,
    launchedTurn: null,
    movedThisTurn: false,
    secondaryMovedThisTurn: false,
    evading: false,
    attackedThisTurn: false,
    engagedWith: [],
    payloadSpent: false,
    readyTurn: null,
    grounded: false,
  }
}

/**
 * The type a group actually flies as (8.15): a Multi-Role Fighter takes the
 * gun profile of whichever of Standard, Interceptor or Attack it was armed as
 * the last time it re-armed.
 */
export function effectiveType(group: FighterGroup): FighterTypeId {
  if (group.typeId === 'multi-role' && group.loadout) return group.loadout
  return group.typeId
}

/** The derived stats a group is flying on right now (8.15). */
export function groupProfile(group: FighterGroup): FighterProfile {
  const profile = fighterProfile(effectiveType(group), group.modifiers)
  // A Multi-Role group keeps its own cost and never becomes a different type
  // for points purposes (8.15: "Multi-Role Fighters cost 5 each, or 30 per wing").
  if (group.typeId === 'multi-role') {
    const own = fighterProfile('multi-role', group.modifiers)
    return { ...profile, typeId: 'multi-role', label: own.label, points: own.points }
  }
  return profile
}

/**
 * Is the group flying with cannon rather than beams (8.15)?
 *
 * "Standard fighters can be equipped with either beams or cannon. If equipped
 * with beams they inflict BD* hits. If equipped with cannon they inflict BD hits
 * (do not re-roll 6s), but ignore the effects of screens."
 *
 * [reading] This is the *purchase option* the book offers Standard, Interceptor,
 * Attack, Torpedo, MKP, Missile and Multi-Role fighters — the types listed with
 * two armaments. It is not every weapon the book happens to call a cannon: 8.15
 * says a Graser Fighter's "secondary cannon … inflict only BD* hits with a -2
 * DRM", re-roll included, so those keep the star. The loss of the re-roll
 * follows the fighter's dice wherever they are BD*, dogfights included, because
 * 8.15 states it as a property of the armament and not of the target.
 */
export function isCannonArmed(group: FighterGroup): boolean {
  return group.armament === 'cannon' && FIGHTER_TYPES[effectiveType(group)].armaments.length > 1
}

/** A group with no fighters left is gone (8.13). */
export function isDestroyed(group: FighterGroup): boolean {
  return group.strength <= 0 || group.status === 'destroyed'
}

/**
 * 8.13: "When all combat endurance is exhausted, the group may still move
 * normally (though it may make no secondary moves) but may not make any
 * attacks."
 */
export function isExhausted(group: FighterGroup): boolean {
  return group.cef <= 0
}

/** 8.7: "Any fighters attacking or being attacked are engaged." */
export function isEngaged(group: FighterGroup): boolean {
  return group.engagedWith.length > 0
}

/**
 * 8.18: "in normal losses the ACE in a group will always be the LAST fighter
 * left surviving", so an Ace is present while the group has anyone left and has
 * not been shot out of the sky by a rival Ace.
 */
export function hasAce(group: FighterGroup): boolean {
  return group.pilots === 'ace' && !group.aceKilled && group.strength > 0
}

/** Take casualties. Returns a new group; a group at zero is destroyed. */
export function applyFighterLosses(group: FighterGroup, losses: number): FighterGroup {
  const strength = Math.max(0, group.strength - Math.max(0, losses))
  return {
    ...group,
    strength,
    status: strength === 0 ? 'destroyed' : group.status,
  }
}

/** Burn endurance (8.13). Never drops below zero. */
export function spendCef(group: FighterGroup, amount: number): FighterGroup {
  return { ...group, cef: Math.max(0, group.cef - Math.max(0, amount)) }
}

/** Clear the per-turn flags at the top of a turn. */
export function beginFighterTurn(group: FighterGroup): FighterGroup {
  return {
    ...group,
    movedThisTurn: false,
    secondaryMovedThisTurn: false,
    evading: false,
    attackedThisTurn: false,
    engagedWith: [],
  }
}

// ---------------------------------------------------------------------------
// 8.1 – 8.4 Launch, scramble, recovery, combat landings
// ---------------------------------------------------------------------------

/** What the carrier's flight deck can do this turn (8.1, 8.2, 8.4). */
export interface CarrierFlightState {
  /** Operational launch tubes / flight decks (8.1). */
  launchFacilities: number
  /** Launches and recoveries already made this turn — they share the pool. */
  facilitiesUsed: number
  /** The carrier used the main drive this turn (8.1, 8.2). */
  usedThrust: boolean
  /** The tube is fitted with catapults (8.2, 13.12). */
  catapults: boolean
}

/** Why a launch or recovery was refused. */
export interface FlightOperationCheck {
  allowed: boolean
  reason: string
}

const OK: FlightOperationCheck = { allowed: true, reason: '' }

/**
 * May this group launch this turn (8.1, 8.2, 8.16)?
 *
 * 8.2 is the hard gate: "if the ship applied thrust that turn it may not launch
 * any fighters unless the tube/flight deck has been upgraded with catapults".
 * 8.1's "A ship that is launching fighters cannot use the main drive" is the
 * same rule stated from the carrier's side, so one check covers both.
 */
export function canLaunch(
  group: FighterGroup,
  carrier: CarrierFlightState,
  turn: number,
): FlightOperationCheck {
  if (group.status !== 'aboard') return { allowed: false, reason: 'group is not aboard (8.1)' }
  if (group.grounded) return { allowed: false, reason: 'group may not be re-launched this game (8.4, 8.16)' }
  if (group.readyTurn !== null && turn < group.readyTurn) {
    return { allowed: false, reason: `group is re-arming until turn ${group.readyTurn} (8.16)` }
  }
  if (carrier.usedThrust && !carrier.catapults) {
    return { allowed: false, reason: 'carrier applied thrust and has no catapults (8.2)' }
  }
  if (carrier.facilitiesUsed >= carrier.launchFacilities) {
    return { allowed: false, reason: 'no operational launch tube / flight deck free (8.1)' }
  }
  return OK
}

/** The outcome of a launch attempt. */
export interface LaunchResult {
  group: FighterGroup
  launched: boolean
  reason: string
  /** Facility slots consumed on the carrier (8.1). */
  facilitiesUsed: number
}

/**
 * Launch a group (8.1).
 *
 * "Launching fighters move before all others in that game turn" is phase
 * ordering and belongs to `game.ts`; what this function records is the half
 * move, because "Move distance on the launch turn is only half normal,
 * representing time lost for successive launches and/or to form up" — which is
 * read off `mainMoveAllowance` for as long as `launchedTurn` is this turn.
 */
export function launchFighterGroup(
  group: FighterGroup,
  carrier: CarrierFlightState,
  turn: number,
  at: Point,
  facing: Course = group.facing,
): LaunchResult {
  const check = canLaunch(group, carrier, turn)
  if (!check.allowed) return { group, launched: false, reason: check.reason, facilitiesUsed: 0 }
  return {
    group: {
      ...group,
      status: 'in-flight',
      position: at,
      facing,
      launchedTurn: turn,
      readyTurn: null,
      movedThisTurn: false,
      secondaryMovedThisTurn: false,
    },
    launched: true,
    reason: '',
    facilitiesUsed: 1,
  }
}

/**
 * FTL Fighters may skip the launch entirely (8.15 FTL): "FTL Fighters may begin
 * the game deployed within 6 MU of their carrier instead of having to be
 * launched if the player wishes. However, 1 point of endurance will be checked
 * off to represent the fuel used in getting to the battle area."
 */
export const FTL_FIGHTER_DEPLOY_RANGE = 6

export function deployFtlFighters(
  group: FighterGroup,
  carrierPosition: Point,
  at: Point,
  facing: Course = group.facing,
): LaunchResult {
  const profile = groupProfile(group)
  if (!profile.ftl) return { group, launched: false, reason: 'not an FTL fighter (8.15)', facilitiesUsed: 0 }
  if (distance(carrierPosition, at) > FTL_FIGHTER_DEPLOY_RANGE) {
    return { group, launched: false, reason: 'deployment must be within 6 MU of the carrier (8.15)', facilitiesUsed: 0 }
  }
  const deployed = spendCef({ ...group, status: 'in-flight', position: at, facing, launchedTurn: null }, 1)
  return { group: deployed, launched: true, reason: '', facilitiesUsed: 0 }
}

/** The five outcomes of a scramble roll (8.3). */
export type ScrambleOutcome =
  /** 1 — "one complete fighter bay … is out of action for the rest of the game". */
  | 'bay-wrecked'
  /** 2–3 — "no groups may be launched this turn". */
  | 'no-launch'
  /** 4 — "one group gets away but too late to intercept the attackers". */
  | 'too-late'
  /** 5 — "one group scrambles in time to intercept". */
  | 'intercept'
  /** 6 — "TWO groups manage to scramble in time to intercept the attackers". */
  | 'double-intercept'

export interface ScrambleResult {
  roll: number
  outcome: ScrambleOutcome
  /** Groups that actually get into the air. */
  groupsLaunched: number
  /** True when the scrambled group(s) may dogfight before the attackers fire. */
  interceptsInTime: boolean
  /** True on a 4: the attackers hit the carrier first, then are engaged (8.3). */
  attackersFireFirst: boolean
  /** CEF a scrambled group launches with — half fuel while re-arming (8.3). */
  cefOnLaunch: number
  reason: string
}

/**
 * Scramble fighters against an attacking fighter group (8.3).
 *
 * This is "the only time that fighter launches may take place when they have
 * not been pre-planned", and only "when the opponent has just moved one or more
 * fighter groups into position to attack the carrier itself"; the caller owes
 * that precondition. "Also the ship may not 'scramble' any fighters if it
 * applied thrust."
 *
 * `launchCapacity` is the carrier's normal per-turn launch capacity, because a
 * 6 only scrambles two groups "for ships which have the ability to launch two
 * or more groups in a turn".
 */
export function scrambleFighters(
  rng: Rng,
  opts: {
    carrierUsedThrust: boolean
    launchCapacity: number
    /** The groups aboard are mid-re-arm, so they launch on half fuel (8.3). */
    rearming?: boolean
    /** Profile of the group(s) being scrambled, for the half-fuel figure. */
    profile?: FighterProfile
  },
): ScrambleResult {
  const profile = opts.profile ?? fighterProfile('standard')
  // "If the scrambling fighters are in the process of rearming they launch with
  // only half the fuel load" — the book's own worked figures (6 → 3, 9 → 4)
  // show the half rounds down.
  const cefOnLaunch = opts.rearming ? Math.floor(profile.cef / 2) : profile.cef

  if (opts.carrierUsedThrust) {
    return {
      roll: 0,
      outcome: 'no-launch',
      groupsLaunched: 0,
      interceptsInTime: false,
      attackersFireFirst: true,
      cefOnLaunch,
      reason: 'the ship may not scramble any fighters if it applied thrust (8.3)',
    }
  }

  const roll = d6(rng)
  if (roll === 1) {
    return {
      roll,
      outcome: 'bay-wrecked',
      groupsLaunched: 0,
      interceptsInTime: false,
      attackersFireFirst: true,
      cefOnLaunch,
      reason: 'launch tube mishap: one fighter bay and its fighters are out for the game (8.3)',
    }
  }
  if (roll <= 3) {
    return {
      roll,
      outcome: 'no-launch',
      groupsLaunched: 0,
      interceptsInTime: false,
      attackersFireFirst: true,
      cefOnLaunch,
      reason: 'no groups may be launched this turn (8.3)',
    }
  }
  if (roll === 4) {
    return {
      roll,
      outcome: 'too-late',
      groupsLaunched: 1,
      interceptsInTime: false,
      attackersFireFirst: true,
      cefOnLaunch,
      reason: 'one group gets away too late; it may dogfight only after the attackers fire (8.3)',
    }
  }
  if (roll === 5) {
    return {
      roll,
      outcome: 'intercept',
      groupsLaunched: 1,
      interceptsInTime: true,
      attackersFireFirst: false,
      cefOnLaunch,
      reason: 'one group scrambles in time to intercept (8.3)',
    }
  }
  // A 6 launches two, but only if the carrier could normally launch two (8.3).
  const groupsLaunched = Math.min(2, Math.max(1, opts.launchCapacity))
  return {
    roll,
    outcome: groupsLaunched >= 2 ? 'double-intercept' : 'intercept',
    groupsLaunched,
    interceptsInTime: true,
    attackersFireFirst: false,
    cefOnLaunch,
    reason:
      groupsLaunched >= 2
        ? 'two groups scramble in time to intercept (8.3)'
        : 'a 6 scrambles two groups, but this carrier can only launch one per turn (8.3)',
  }
}

/**
 * May this group be recovered this turn (8.1)? Recovery draws on the same pool
 * of tubes as launching, and the carrier "must move at a constant course and
 * velocity for that turn" — which is the same no-thrust condition as a launch.
 */
export function canRecover(group: FighterGroup, carrier: CarrierFlightState): FlightOperationCheck {
  if (group.status !== 'in-flight') return { allowed: false, reason: 'group is not in flight (8.1)' }
  if (carrier.usedThrust && !carrier.catapults) {
    return { allowed: false, reason: 'carrier must hold a constant course and velocity to recover (8.1)' }
  }
  if (carrier.facilitiesUsed >= carrier.launchFacilities) {
    return { allowed: false, reason: 'no operational launch tube / flight deck free (8.1)' }
  }
  return OK
}

/** The three re-arm outcomes of 8.16. */
export type RearmOutcome = 'lost' | 'standard' | 'crash-turnaround'

export interface RearmResult {
  roll: number
  outcome: RearmOutcome
  /**
   * Earliest turn the group may launch again, or null when it never may.
   * Recovered in turn T: a 6 releases it in T+1, a 2–5 in T+2 ("rearmed after
   * 1 full turn, so it may launch in the second turn after recovery").
   */
  readyTurn: number | null
}

/** Roll the re-arm die for a group just recovered in `turn` (8.16). */
export function rollRearm(rng: Rng, turn: number): RearmResult {
  const roll = d6(rng)
  if (roll === 1) return { roll, outcome: 'lost', readyTurn: null }
  if (roll === 6) return { roll, outcome: 'crash-turnaround', readyTurn: turn + 1 }
  return { roll, outcome: 'standard', readyTurn: turn + 2 }
}

/**
 * 8.16: "If depleted groups are combined to make full strength groups, roll for
 * each partial group and the worst case result applies to the entire new
 * group." Worst is "lost", then the later ready turn.
 */
export function worstRearm(results: readonly RearmResult[]): RearmResult {
  if (results.length === 0) throw new Error('worstRearm needs at least one roll (8.16)')
  return results.reduce((worst, candidate) => {
    if (candidate.readyTurn === null) return candidate
    if (worst.readyTurn === null) return worst
    return candidate.readyTurn > worst.readyTurn ? candidate : worst
  })
}

export interface RecoveryResult {
  group: FighterGroup
  recovered: boolean
  reason: string
  rearm: RearmResult | null
  facilitiesUsed: number
}

/**
 * Recover a group onto its carrier and roll for re-arming (8.1, 8.16).
 *
 * "The fighter group moves into contact with the carrier in the Fighter
 * Movement Phase", so the caller has already flown it home; this is the landing
 * itself.
 */
export function recoverFighterGroup(
  group: FighterGroup,
  carrier: CarrierFlightState,
  turn: number,
  rng: Rng,
): RecoveryResult {
  const check = canRecover(group, carrier)
  if (!check.allowed) {
    return { group, recovered: false, reason: check.reason, rearm: null, facilitiesUsed: 0 }
  }
  const rearm = rollRearm(rng, turn)
  const profile = groupProfile(group)
  return {
    group: {
      ...group,
      status: 'aboard',
      launchedTurn: null,
      // Refuelled and rearmed (8.16); a "lost" group never flies again.
      cef: profile.cef,
      payloadSpent: false,
      engagedWith: [],
      evading: false,
      attackedThisTurn: false,
      readyTurn: rearm.readyTurn,
      grounded: rearm.outcome === 'lost',
    },
    recovered: true,
    reason: '',
    rearm,
    facilitiesUsed: 1,
  }
}

/**
 * Re-configure a Multi-Role Fighter while it is being re-armed (8.15): "When
 * Multi-Role Fighters are being refueled and rearmed in a hangar bay, they may
 * be reconfigured for another mission. This takes place simultaneously with the
 * refueling."
 */
export function reconfigureMultiRole(
  group: FighterGroup,
  loadout: FighterTypeId,
  armament: FighterArmament,
): { group: FighterGroup; changed: boolean; reason: string } {
  if (group.typeId !== 'multi-role') {
    return { group, changed: false, reason: 'only Multi-Role Fighters re-configure (8.15)' }
  }
  if (group.status !== 'aboard') {
    return { group, changed: false, reason: 'reconfiguration happens in a hangar bay (8.15)' }
  }
  if (!MULTI_ROLE_LOADOUTS.includes(loadout)) {
    return { group, changed: false, reason: 'MRF loadouts are standard, Interceptor or Attack (8.15)' }
  }
  return { group: { ...group, loadout, armament }, changed: true, reason: '' }
}

export interface CombatLandingResult {
  groups: FighterGroup[]
  landed: number
  /** Every recovered group is grounded for the game (8.4). */
  deckFouled: boolean
  /** 8.4: hangar-bay critical hits add +1 to the collateral damage rolls. */
  collateralDrm: number
  allowed: boolean
  reason: string
}

/**
 * A combat landing (8.4): "a carrier may simply recover all of its fighters in
 * one turn. However, these are not normal organized landings but a frantic
 * recovery that 'fouls' the deck. The carrier may not launch any recovered
 * fighters for the rest of the game."
 *
 * The collateral damage rolls themselves are the hangar-bay critical hits of
 * 10.2 and belong to the threshold module; 8.4 only supplies the +1, which is
 * handed back here.
 */
export function combatLanding(
  groups: readonly FighterGroup[],
  opts: { carrierUsedThrust: boolean; hangarCriticalHits: number },
): CombatLandingResult {
  if (opts.carrierUsedThrust) {
    return {
      groups: [...groups],
      landed: 0,
      deckFouled: false,
      collateralDrm: 0,
      allowed: false,
      reason: 'ships that applied thrust may not conduct combat landings (8.4)',
    }
  }
  const inFlight = groups.filter((group) => group.status === 'in-flight')
  const landedGroups = groups.map((group) =>
    group.status === 'in-flight'
      ? { ...group, status: 'aboard' as const, launchedTurn: null, grounded: true, engagedWith: [] }
      : group,
  )
  return {
    groups: landedGroups,
    landed: inFlight.length,
    deckFouled: inFlight.length > 0,
    collateralDrm: opts.hangarCriticalHits > 0 ? 1 : 0,
    allowed: true,
    reason: '',
  }
}

/**
 * 8.4: "A ship that launches or recovers fighters cannot use an ADFC (section
 * 7) in that turn." Exported so `defences.ts` can ask without importing the
 * whole flight-operations model.
 */
export function adfcLockedOut(carrier: { launchedThisTurn: boolean; recoveredThisTurn: boolean }): boolean {
  return carrier.launchedThisTurn || carrier.recoveredThisTurn
}

// ---------------------------------------------------------------------------
// 8.5 Movement
// ---------------------------------------------------------------------------

/**
 * How far a group may move in the main Fighter Movement Phase (8.5, 8.1).
 *
 * 24 MU as standard, 36 for a Fast group, and half that on the turn it
 * launched: "Move distance on the launch turn is only half normal".
 */
export function mainMoveAllowance(group: FighterGroup, turn: number): number {
  const profile = groupProfile(group)
  return group.launchedTurn === turn ? profile.move / 2 : profile.move
}

/**
 * The secondary move allowance (8.5): 12 MU for every type — "Fast Fighters may
 * also may a secondary endurance move, but like normal fighters the range of
 * this move is limited to 12 MU."
 */
export function secondaryMoveAllowance(group: FighterGroup): number {
  return groupProfile(group).secondaryMove
}

export interface FighterMoveResult {
  group: FighterGroup
  moved: boolean
  distance: number
  reason: string
}

/**
 * Move a group in phase 4 (8.5): "a fighter group can move any distance up to
 * the maximum allowed and in any direction, without needing to write orders or
 * record course and velocity". Costs no endurance — "Normal movement during the
 * first Fighter Movement Phase does not consume combat endurance factors"
 * (8.13).
 */
export function moveFighterGroup(
  group: FighterGroup,
  to: Point,
  turn: number,
  facing: Course = group.facing,
): FighterMoveResult {
  if (group.status !== 'in-flight') {
    return { group, moved: false, distance: 0, reason: 'group is not in flight (8.5)' }
  }
  const travelled = distance(group.position, to)
  const allowance = mainMoveAllowance(group, turn)
  if (travelled > allowance + 1e-9) {
    return {
      group,
      moved: false,
      distance: travelled,
      reason: `move of ${travelled.toFixed(1)} MU exceeds the ${allowance} MU allowance (8.5)`,
    }
  }
  return {
    group: { ...group, position: to, facing, movedThisTurn: true },
    moved: true,
    distance: travelled,
    reason: '',
  }
}

/**
 * Move a group in phase 6 (8.5): "up to 12 MU … even if the group moved its
 * full distance in the first Fighter Movement Phase. Any fighter group that
 * makes this secondary move immediately expends 1 CEF."
 *
 * Refused when the group has already been dogfought: "it may not be taken if
 * the group has already been engaged in a dogfight by another group."
 */
export function secondaryMoveFighterGroup(
  group: FighterGroup,
  to: Point,
  facing: Course = group.facing,
): FighterMoveResult {
  if (group.status !== 'in-flight') {
    return { group, moved: false, distance: 0, reason: 'group is not in flight (8.5)' }
  }
  if (isExhausted(group)) {
    return { group, moved: false, distance: 0, reason: 'no combat endurance left for a secondary move (8.13)' }
  }
  if (isEngaged(group)) {
    return { group, moved: false, distance: 0, reason: 'already engaged in a dogfight this turn (8.5)' }
  }
  const travelled = distance(group.position, to)
  const allowance = secondaryMoveAllowance(group)
  if (travelled > allowance + 1e-9) {
    return {
      group,
      moved: false,
      distance: travelled,
      reason: `secondary move of ${travelled.toFixed(1)} MU exceeds ${allowance} MU (8.5)`,
    }
  }
  const moved = spendCef({ ...group, position: to, facing, secondaryMovedThisTurn: true }, 1)
  return { group: moved, moved: true, distance: travelled, reason: '' }
}

/**
 * 8.15 Robot: a Robot group "take[s] their secondary (endurance-burning) move at
 * the end of the end of phase 4 after all fighters and missiles have made their
 * moves. This means that Robot Fighters cannot react to ship movement." The
 * move itself is the ordinary secondary move; only its slot in the sequence
 * differs, which `game.ts` reads off this predicate.
 */
export function takesSecondaryMoveInPhaseFour(group: FighterGroup): boolean {
  return groupProfile(group).robot
}

// ---------------------------------------------------------------------------
// 8.6 Screens, pursuits, ship fire and evading
// ---------------------------------------------------------------------------

/** How close a screening group must stay to its charge (8.6, "adjacent"). */
export const SCREEN_ADJACENCY = 1

/**
 * Assign a group as a close escort (8.6): "the fighter group must remain
 * adjacent to the ship it is escorting at all times. If it is moved further
 * away, then it has broken off from its escorting duties."
 *
 * `alreadyScreenedBy` carries the ids of groups screening *this* group, because
 * "Fighter cannot screen fighters which are they themselves screening."
 */
export function assignScreen(
  group: FighterGroup,
  escortId: string,
  opts: { alreadyScreenedBy?: readonly string[] } = {},
): { group: FighterGroup; assigned: boolean; reason: string } {
  if (opts.alreadyScreenedBy?.includes(escortId)) {
    return { group, assigned: false, reason: 'fighters cannot screen fighters that screen them (8.6)' }
  }
  return { group: { ...group, mission: 'screen', escorting: escortId }, assigned: true, reason: '' }
}

/**
 * Declare a pursuit (8.6): "A fighter group that attacked an enemy ship or an
 * enemy screening fighter group last turn can declare it is pursuing the ship."
 */
export function declarePursuit(
  group: FighterGroup,
  targetId: string,
  opts: { attackedTargetLastTurn: boolean },
): { group: FighterGroup; assigned: boolean; reason: string } {
  if (!opts.attackedTargetLastTurn) {
    return { group, assigned: false, reason: 'only a group that attacked the target last turn may pursue (8.6)' }
  }
  return { group: { ...group, mission: 'pursuit', escorting: targetId }, assigned: true, reason: '' }
}

/**
 * Move a screening or pursuing group with the ship it is tied to, in phase 5
 * (8.6): "Screening fighters can exceed the normal fighter movement allowance if
 * the ship they are screening is moving faster than the fighters could normally
 * move." No allowance check, therefore, and no endurance cost.
 */
export function moveWithEscortedShip(
  group: FighterGroup,
  shipPosition: Point,
  facing: Course = group.facing,
): FighterMoveResult {
  if (group.mission === 'free') {
    return { group, moved: false, distance: 0, reason: 'group is not screening or pursuing (8.6)' }
  }
  const travelled = distance(group.position, shipPosition)
  return {
    group: { ...group, position: shipPosition, facing, movedThisTurn: true },
    moved: true,
    distance: travelled,
    reason: '',
  }
}

/**
 * Has a screening group drifted off station (8.6)? A group that has is no longer
 * screening: "If it is moved further away, then it has broken off from its
 * escorting duties, and no longer functions in a screening role."
 */
export function screenHasBrokenOff(group: FighterGroup, escortPosition: Point): boolean {
  return group.mission === 'screen' && distance(group.position, escortPosition) > SCREEN_ADJACENCY + 1e-9
}

/**
 * Pair attacking groups off against a fighter screen (8.6): "Each group of
 * screening fighters must be engaged by at least one attacking fighter group,
 * but once this condition has been satisfied any further uncommitted attacking
 * groups may fire on the escorted ship."
 *
 * Returns the minimum legal commitment — one attacker per screen, in the order
 * given — and which attackers are then free. The worked example is three screens
 * and four attackers: three pair off, the fourth attacks the transport.
 */
export function assignScreenEngagements(
  attackers: readonly string[],
  screens: readonly string[],
): { pairings: Array<{ attackerId: string; screenId: string }>; freeAttackers: string[] } {
  const pairings: Array<{ attackerId: string; screenId: string }> = []
  const paired = Math.min(attackers.length, screens.length)
  for (let i = 0; i < paired; i++) pairings.push({ attackerId: attackers[i], screenId: screens[i] })
  return { pairings, freeAttackers: attackers.slice(paired) }
}

export interface ShipFireAtFightersResult {
  rolls: number[]
  kills: number
  group: FighterGroup
  /** True when the group evaded and the fire automatically missed (8.6). */
  evaded: boolean
  reason: string
}

/**
 * Ship weapons firing at a fighter group in the Ship Fire Phase (8.6).
 *
 * "Ship to ship weapons roll 1D6 only against fighter groups, regardless of
 * range band or normal damage inflicted. A roll of 6 kills one fighter, no
 * re-roll." So `weapons` is the number of mounts firing, not a dice count read
 * off the beam table.
 *
 * Only unengaged groups may be shot at, and each group targeted needs its own
 * FireCon — both are the caller's checks, since FireCon allocation lives with
 * the ship.
 *
 * A Light group's +1 applies here: 8.15 says "*Any* attack at a group of Light
 * Fighters gets a +1 bonus", and the list of point-defence mounts that follows
 * is an illustration, not a restriction. [reading] A Heavy group's −1 does not:
 * "Heavy anti-ship weapons used in defensive fire (beams, K-1) have only their
 * normal -1 DRM … it does little against a full strength anti-ship weapon."
 */
export function shipFireAtFighters(
  group: FighterGroup,
  weapons: number,
  rng: Rng,
): ShipFireAtFightersResult {
  if (group.evading) {
    return {
      rolls: [],
      kills: 0,
      group,
      evaded: true,
      reason: 'the group is evading: ship weapons automatically miss (8.6)',
    }
  }
  const profile = groupProfile(group)
  const drm = profile.light ? 1 : 0
  const rolls: number[] = []
  let kills = 0
  for (let i = 0; i < weapons; i++) {
    const face = d6(rng)
    rolls.push(face)
    if (applyDrm(face, drm) === 6) kills += 1
  }
  const capped = Math.min(kills, group.strength)
  return { rolls, kills: capped, group: applyFighterLosses(group, capped), evaded: false, reason: '' }
}

/**
 * Evade announced ship fire (8.6): "the fighter group can choose to evade the
 * attack by spending a CEF. Choosing to evade automatically negates the attack
 * against the fighter group and any further ship weapon fire in that turn.
 * Evading does not cancel any casualties already inflicted."
 *
 * There is no evading point defence — "Point defense fire cannot be evaded."
 */
export function evadeShipFire(group: FighterGroup): { group: FighterGroup; evaded: boolean; reason: string } {
  if (group.evading) return { group, evaded: true, reason: 'already evading this turn (8.6)' }
  if (isExhausted(group)) {
    return { group, evaded: false, reason: 'no combat endurance left to evade (8.13)' }
  }
  return { group: spendCef({ ...group, evading: true }, 1), evaded: true, reason: '' }
}

// ---------------------------------------------------------------------------
// 8.7 Target selection
// ---------------------------------------------------------------------------

/** The three forward 60-degree arcs (4.2) that make up a fighter's 180° (8.7). */
export const FRONT_ARCS: readonly Arc[] = ['FP', 'F', 'FS']

/**
 * Is a point inside the group's front 180° arc (8.7)? A target in base contact
 * is always in arc, since there is no bearing to measure.
 */
export function inFrontArc(group: FighterGroup, target: Point): boolean {
  if (distance(group.position, target) < 1e-9) return true
  return FRONT_ARCS.includes(arcTo(group.position, group.facing, target))
}

/** What a group is allowed to shoot at this turn (8.7). */
export type FighterTargetKind = 'ship' | 'fighter' | 'missile'

/**
 * May the group declare an attack (8.7)?
 *
 * "a fighter group may declare an attack against any ship, missile marker, or
 * other fighter group within 6 MU and within its front 180° arc. All fighters in
 * the group must engage the same target."
 *
 * The only range exception in the section is the Missile Fighter's salvo, whose
 * fire control reaches 12 MU (8.15); its guns are still 6 MU.
 */
export function canDeclareAttack(
  group: FighterGroup,
  target: Point,
  opts: {
    kind: FighterTargetKind
    payloadAttack?: boolean
    /**
     * The reach electronic warfare leaves this group against this target
     * (7.17 – 7.20), in place of the printed 6 or 12 MU; `null` is 7.20's
     * *"Missiles and fighters will not lock at all"*.
     */
    lockOn?: number | null
  } = { kind: 'ship' },
): FlightOperationCheck {
  if (group.status !== 'in-flight' || isDestroyed(group)) {
    return { allowed: false, reason: 'group is not in flight (8.7)' }
  }
  if (isExhausted(group)) {
    return { allowed: false, reason: 'no combat endurance left: the group may not attack (8.13)' }
  }
  const profile = groupProfile(group)
  const payloadAttack = opts.payloadAttack ?? false
  const printed =
    payloadAttack && profile.payload === 'salvo-missile' ? MISSILE_FIGHTER_RANGE : FIGHTER_ATTACK_RANGE
  if (opts.lockOn === null) {
    return { allowed: false, reason: 'nothing can lock on that target (7.20)' }
  }
  const range = opts.lockOn ?? printed
  const measured = distance(group.position, target)
  if (measured > range + 1e-9) {
    return { allowed: false, reason: `target is ${measured.toFixed(1)} MU away, beyond ${range} MU (8.7)` }
  }
  if (!inFrontArc(group, target)) {
    return { allowed: false, reason: 'target is outside the front 180 degree arc (8.7)' }
  }
  if (opts.kind === 'missile' && !profile.canInterceptMissiles) {
    return { allowed: false, reason: 'Attack and Torpedo Fighters cannot intercept missiles (8.12)' }
  }
  return OK
}

// ---------------------------------------------------------------------------
// 8.8 Point defence against fighters
// ---------------------------------------------------------------------------

/**
 * A mount firing in the anti-fighter point-defence role (8.8, 7.12 – 7.15).
 * An ADS "fires like a PDS" (7.13) and is passed as `pds`, once at up to 12 MU
 * or twice inside 6 MU.
 */
export type AntiFighterMount = 'pds' | 'beam-1' | 'grapeshot' | 'scattergun'

export interface PointDefenceResult {
  mount: AntiFighterMount
  rolls: number[]
  kills: number
}

export interface PointDefenceVolleyResult {
  results: PointDefenceResult[]
  /** Kills after the overkill cap of 8.8. */
  kills: number
  /** Kills the dice scored before the cap — "wasted" shots (8.8). */
  rawKills: number
  group: FighterGroup
}

/**
 * Resolve a ship's point defence against one attacking fighter group (8.8).
 *
 * "For each point defense weapon firing:
 *   • A PDS rolls a D6 and kills one fighter on 4 or 5. A 6 kills two fighters
 *     and re-roll the die.
 *   • A Beam-1 rolls a D6 and kills one fighter on 5 or 6, with a re-roll on 6.
 *   • Grapeshot rolls four D6 with results as for PDS."
 *
 * A Scattergun is not a die on this table at all: it "inflict[s] 1d6 hits on
 * fighters …, 1d3 hits on Heavy Fighters" (7.14), and "Scatterguns and
 * Interceptor Pods kill d6+1 Light Fighters" (8.15).
 *
 * Heavy and Light both bend the table: "Point defense weapons, including other
 * fighters, suffer a -1 DRM when engaging Heavy Fighters"; "PDS systems, Class 1
 * Beam Batteries, Class 1 K-Guns, Spicules, and Pulsers in Point Defense Mode
 * all get the +1 modifier" against Light Fighters. [reading] The Heavy −1 is
 * withheld from the Beam-1 because 8.15 says full-strength anti-ship weapons in
 * defensive fire keep "only their normal -1 DRM" — the Beam-1's own harsher 5–6
 * table *is* that normal −1.
 *
 * "'Wasted' shots when point defense fire kills more fighters than are in the
 * group may not be reallocated to other groups", so the total is capped.
 */
export function pointDefenceAgainstFighters(
  group: FighterGroup,
  mounts: readonly AntiFighterMount[],
  rng: Rng,
): PointDefenceVolleyResult {
  const profile = groupProfile(group)
  const results: PointDefenceResult[] = []
  let rawKills = 0

  for (const mount of mounts) {
    if (mount === 'scattergun') {
      // 7.14 / 8.15: a fixed number of hits, not a point-defence die.
      const face = d6(rng)
      const hits = profile.heavy ? Math.ceil(face / 2) : profile.light ? face + 1 : face
      results.push({ mount, rolls: [face], kills: hits })
      rawKills += hits
      continue
    }
    const mode: PdMode = mount === 'beam-1' ? 'beam-1' : 'pds'
    // The Heavy −1 spares the Beam-1; the Light +1 applies to everything.
    const drm = (profile.heavy && mount !== 'beam-1' ? -1 : 0) + (profile.light ? 1 : 0)
    const dice = mount === 'grapeshot' ? 4 : 1
    const roll = rollModifiedPointDefence(dice, mode, drm, rng)
    results.push({ mount, rolls: roll.rolls, kills: roll.kills })
    rawKills += roll.kills
  }

  const kills = Math.min(rawKills, group.strength)
  return { results, kills, rawKills, group: applyFighterLosses(group, kills) }
}

// ---------------------------------------------------------------------------
// 8.9 Attack runs
// ---------------------------------------------------------------------------

/** What the fighters are shooting at (4.7, 7.3). */
export interface FighterTargetShip {
  screens: ScreenLevel
  /**
   * 7.3 Advanced Screens. Cannon "ignore Standard Screens" (8.9); [reading]
   * against an advanced screen the level still applies, because 8.9 names
   * Standard screens specifically.
   */
  advancedScreens?: boolean
  /** 4.10 optional rear-arc rule; fighters "gain no advantage" (8.9). */
  rearArc?: boolean
}

export interface AttackRunResult {
  group: FighterGroup
  /** Natural faces rolled, in order. */
  dice: number[]
  /** Damage screens and armour may absorb (4.8). */
  normalDamage: number
  /** Damage straight to the hull (4.6, 4.9). */
  penetratingDamage: number
  mode: DamageMode
  /** Endurance burned (8.13). */
  cefSpent: number
  detail: string
  fired: boolean
  reason: string
}

/**
 * The number of dice a group rolls in a normal attack (8.9, 8.18).
 *
 * "roll 1D6 per remaining fighter in the group", plus the Ace's extra die:
 * "the group gets ONE EXTRA DIE during all normal attacks – so a full strength
 * group of six fighters including an Ace would roll SEVEN dice instead of the
 * usual 6".
 */
export function attackDiceCount(group: FighterGroup): number {
  return group.strength + (hasAce(group) ? 1 : 0)
}

/**
 * Resolve a fighter group's attack run against a ship (8.9).
 *
 * "For each group attacking a ship, roll 1D6 per remaining fighter in the group.
 * Hits and damage are scored per die using the same procedure as Beam-1 weapon
 * fire (section 4): Fighters that use beams are affected by screens, and re-roll
 * for penetrating damage on a 6. Fighters that use cannon ignore Standard
 * Screens, and do not re-roll on a die roll of 6."
 *
 * Graser and Plasma fighters read their own tables from 8.15, so this dispatches
 * on the type's hit kind.
 *
 * `aceSpecialAttack` withholds the Ace's contribution, because 8.18 makes them
 * exclusive: "in this case the rest of the group does NOT get the 'extra' die".
 * Call `aceNeedleAttack` for the Ace's own die.
 */
export function resolveAttackRun(
  group: FighterGroup,
  target: FighterTargetShip,
  rng: Rng,
  opts: { aceSpecialAttack?: boolean } = {},
): AttackRunResult {
  const empty = (reason: string): AttackRunResult => ({
    group,
    dice: [],
    normalDamage: 0,
    penetratingDamage: 0,
    mode: 'standard',
    cefSpent: 0,
    detail: '',
    fired: false,
    reason,
  })

  const profile = groupProfile(group)
  const gunProfile = profile.antiShip
  if (!gunProfile) return empty('this type has no anti-ship gun; it makes a boarding run (8.15)')
  if (isDestroyed(group)) return empty('the group has been destroyed')
  if (isExhausted(group)) return empty('no combat endurance left: the group may not attack (8.13)')

  // "Firing the Graser is very energy intensive, and drains 2 points of combat
  // endurance" (8.15) — [reading] the group must have the full cost available.
  const cost = group.attackedThisTurn ? 0 : gunProfile.cef
  if (cost > group.cef) {
    return empty(`firing costs ${gunProfile.cef} CEF and the group has ${group.cef} (8.15)`)
  }

  const aceSpecial = opts.aceSpecialAttack ?? false
  // 8.18: the Ace's die is spent on the needle shot instead of the volley, and
  // the rest of the group loses the extra die too.
  const diceCount = aceSpecial ? Math.max(0, group.strength - 1) : attackDiceCount(group)

  // 8.9: cannon ignore Standard Screens; advanced screens still bite [reading].
  const cannon = isCannonArmed(group)
  const advanced = target.advancedScreens ?? false
  const screens: ScreenLevel = cannon && !advanced ? 0 : target.screens
  // 8.9: "Fighters that use cannon … do not re-roll on a die roll of 6."
  const reroll = !cannon
  const drm = gunProfile.drm

  if (gunProfile.hit === 'plasma') {
    const volley = rollPlasmaFighterVolley(diceCount, target.screens, rng, drm)
    return {
      group: markAttacked(group, cost),
      dice: volley.dice,
      normalDamage: volley.normalDamage,
      penetratingDamage: volley.penetratingDamage,
      mode: 'standard',
      cefSpent: cost,
      detail: `${diceCount} plasma dice (1d6-2-screens), ${volley.normalDamage}+${volley.penetratingDamage} damage`,
      fired: true,
      reason: '',
    }
  }

  const volley = rollFighterVolley(diceCount, screens, rng, { drm, reroll })

  if (gunProfile.hit === 'd3-sap') {
    // 8.15 Graser: "6 BD* hits … with each hit inflicting 1d3 damage, semi-AP".
    let normalDamage = 0
    let penetratingDamage = 0
    for (let i = 0; i < volley.normalDamage; i++) normalDamage += d3(rng)
    for (let i = 0; i < volley.penetratingDamage; i++) penetratingDamage += d3(rng)
    return {
      group: markAttacked(group, cost),
      dice: volley.dice,
      normalDamage,
      penetratingDamage,
      mode: 'SAP',
      cefSpent: cost,
      detail: `${diceCount} graser dice, ${volley.normalDamage + volley.penetratingDamage} hits at 1d3 SAP`,
      fired: true,
      reason: '',
    }
  }

  return {
    group: markAttacked(group, cost),
    dice: volley.dice,
    normalDamage: volley.normalDamage,
    penetratingDamage: volley.penetratingDamage,
    mode: 'standard',
    cefSpent: cost,
    detail: `${diceCount} ${cannon ? 'cannon' : 'beam'} dice${drm ? ` at ${drm > 0 ? '+' : ''}${drm}` : ''}, ${volley.normalDamage}+${volley.penetratingDamage} damage`,
    fired: true,
    reason: '',
  }
}

function markAttacked(group: FighterGroup, cost: number): FighterGroup {
  return spendCef({ ...group, attackedThisTurn: true }, cost)
}

/**
 * Plasma Fighter dice (8.15, 5.5): "they inflict 1d6-2 - screens/DRM hits with
 * rerolls on a 6", each hit one damage point.
 *
 * [reading] 8.15 describes the fighter weapon without 5.5's "penetrates", so the
 * die's own hits are ordinary damage and only the re-roll penetrates, exactly as
 * a beam's does (4.6). The re-roll is scored unscreened and unmodified (1.7).
 */
export function rollPlasmaFighterVolley(
  diceCount: number,
  screens: ScreenLevel,
  rng: Rng,
  drm = 0,
): FighterVolley {
  const dice: number[] = []
  let normalDamage = 0
  let penetratingDamage = 0

  const resolve = (isReroll: boolean): void => {
    const natural = d6(rng)
    dice.push(natural)
    const face = isReroll ? natural : applyDrm(natural, drm)
    const hits = Math.max(0, face - 2 - (isReroll ? 0 : screens))
    if (isReroll) penetratingDamage += hits
    else normalDamage += hits
    if (natural === 6) resolve(true)
  }

  for (let i = 0; i < diceCount; i++) resolve(false)
  return { dice, normalDamage, penetratingDamage }
}

/**
 * A group that presses home its attack run while being dogfought (8.9): "the
 * fighters attacking the ship have the choice of either breaking off the attack
 * and engaging in a dogfight, or continuing the attack. In the latter case, the
 * 'intercepting' fighter group fires as if in a dogfight, and the survivors
 * carry out the attack against the ship."
 *
 * The exchange is one-sided by design: only the interceptor rolls.
 */
export function resolveInterceptedAttackRun(
  attacker: FighterGroup,
  interceptor: FighterGroup,
  target: FighterTargetShip,
  rng: Rng,
): { attacker: FighterGroup; interceptorKills: number; interceptorDice: number[]; run: AttackRunResult } {
  const attackerProfile = groupProfile(attacker)
  const interceptorProfile = groupProfile(interceptor)
  const drm =
    interceptorProfile.antiFighter.drm +
    attackerProfile.defenceDrm +
    (interceptor.pilots === 'turkey' ? -1 : 0)
  const dice = isExhausted(interceptor)
    ? rollExhaustedReturnFire(attackDiceCount(interceptor), rng)
    : rollFighterKills(attackDiceCount(interceptor), rng, { drm, reroll: !isCannonArmed(interceptor) })
  const kills = Math.min(dice.kills, attacker.strength)
  const survivors = applyFighterLosses(attacker, kills)
  const run = resolveAttackRun(survivors, target, rng)
  return {
    attacker: run.fired ? run.group : survivors,
    interceptorKills: kills,
    interceptorDice: dice.dice,
    run,
  }
}

// ---------------------------------------------------------------------------
// 8.15 one-shot payloads
// ---------------------------------------------------------------------------

export interface PayloadResult {
  group: FighterGroup
  rolls: number[]
  hits: number
  damage: number
  mode: DamageMode
  cefSpent: number
  fired: boolean
  reason: string
}

/**
 * Launch a Torpedo Fighter group's Pulse Torpedoes (8.15).
 *
 * "The Pulse Torpedoes may also be launched for 1 point of endurance. These have
 * a range 6 MU … The Pulse Torpedoes hit on a 4+, and do damage equal to their
 * die roll. So a roll of a '5' would both hit and inflict 5 points of damage. As
 * these are Pulse Torpedoes, they ignore screens and inflict Semi-Armor Piercing
 * damage." One torpedo per surviving fighter; "they must all be fired on the
 * same turn, and at the same target."
 */
export function launchPulseTorpedoes(group: FighterGroup, rng: Rng): PayloadResult {
  const profile = groupProfile(group)
  const blocked = payloadCheck(group, profile, 'pulse-torpedo')
  if (blocked) return blocked
  const rolls: number[] = []
  let hits = 0
  let damage = 0
  for (let i = 0; i < group.strength; i++) {
    const face = d6(rng)
    rolls.push(face)
    if (face >= 4) {
      hits += 1
      damage += face
    }
  }
  return {
    group: spendCef({ ...group, payloadSpent: true, attackedThisTurn: true }, 1),
    rolls,
    hits,
    damage,
    mode: 'SAP',
    cefSpent: 1,
    fired: true,
    reason: '',
  }
}

/**
 * Launch an MKP Fighter group's Multiple Kinetic Penetrators (8.15, 5.17).
 *
 * "They have a range of 6 MU, and inflict damage just like a ship-mounted MKP
 * (1 hit on 4+, 2 hits on a 6, and each hit inflicts 4 points of AP damage)."
 */
export const MKP_DAMAGE_PER_HIT = 4

export function launchFighterMkps(group: FighterGroup, rng: Rng): PayloadResult {
  const profile = groupProfile(group)
  const blocked = payloadCheck(group, profile, 'mkp')
  if (blocked) return blocked
  const rolls: number[] = []
  let hits = 0
  for (let i = 0; i < group.strength; i++) {
    const face = d6(rng)
    rolls.push(face)
    if (face === 6) hits += 2
    else if (face >= 4) hits += 1
  }
  return {
    group: spendCef({ ...group, payloadSpent: true, attackedThisTurn: true }, 1),
    rolls,
    hits,
    damage: hits * MKP_DAMAGE_PER_HIT,
    mode: 'AP',
    cefSpent: 1,
    fired: true,
    reason: '',
  }
}

function payloadCheck(
  group: FighterGroup,
  profile: FighterProfile,
  kind: FighterPayloadKind,
): PayloadResult | null {
  const fail = (reason: string): PayloadResult => ({
    group,
    rolls: [],
    hits: 0,
    damage: 0,
    mode: 'standard',
    cefSpent: 0,
    fired: false,
    reason,
  })
  if (profile.payload !== kind) return fail(`this group carries no ${kind} payload (8.15)`)
  if (group.payloadSpent) return fail('the one-shot payload has already been fired (8.15)')
  if (isDestroyed(group)) return fail('the group has been destroyed')
  if (group.cef < 1) return fail('no combat endurance left to launch the payload (8.13)')
  // 8.15: "These fighters cannon fire their secondary weapons and the MKPs in
  // the same turn"; the Torpedo Fighter carries the same restriction.
  if (group.attackedThisTurn) return fail('the group already fired its secondary guns this turn (8.15)')
  return null
}

export interface FighterMissileLaunchResult {
  group: FighterGroup
  /** Missiles in the salvo — one per surviving fighter (8.15). */
  salvoSize: number
  /** The lock-on die and how many missiles actually track (8.15). */
  lockOnRoll: number
  lockedOn: number
  /** Light Missile Fighters carry light missiles: +1 to every attack on them. */
  lightMissiles: boolean
  cefSpent: number
  fired: boolean
  reason: string
}

/**
 * Launch a Missile Fighter group's salvo in phase 3 (8.15).
 *
 * "The missile fighter must approach within 12 MU of an enemy ship before it can
 * provide enough tracking data to safely launch its missiles. It also must not
 * be engaged by other fighters at time of launch." … "Launching the missiles
 * consumes one Combat Endurance Factor (CEF)."
 *
 * Lock-on: "To determine how many missiles lock on to the target ship roll a D6
 * and subtract 1 for each fighter that was destroyed prior to launch."
 * [reading] "destroyed prior to launch" is read as the fighters missing from the
 * group, since that is what a player can read off the counter.
 */
export function launchFighterMissiles(
  group: FighterGroup,
  rangeToTarget: number,
  rng: Rng,
): FighterMissileLaunchResult {
  const profile = groupProfile(group)
  const fail = (reason: string): FighterMissileLaunchResult => ({
    group,
    salvoSize: 0,
    lockOnRoll: 0,
    lockedOn: 0,
    lightMissiles: profile.light,
    cefSpent: 0,
    fired: false,
    reason,
  })
  if (profile.payload !== 'salvo-missile') return fail('this group carries no fighter missiles (8.15)')
  if (group.payloadSpent) return fail('the salvo has already been launched (8.15)')
  if (isDestroyed(group)) return fail('the group has been destroyed')
  if (group.cef < 1) return fail('no combat endurance left to launch the salvo (8.13)')
  if (isEngaged(group)) return fail('the group is engaged by other fighters and may not launch (8.15)')
  if (rangeToTarget > MISSILE_FIGHTER_RANGE + 1e-9) {
    return fail(`target is ${rangeToTarget.toFixed(1)} MU away, beyond the 12 MU launch range (8.15)`)
  }

  const lost = profile.groupSize - group.strength
  const lockOnRoll = d6(rng)
  const lockedOn = Math.max(0, Math.min(group.strength, lockOnRoll - lost))
  return {
    group: spendCef({ ...group, payloadSpent: true }, 1),
    salvoSize: group.strength,
    lockOnRoll,
    lockedOn,
    lightMissiles: profile.light,
    cefSpent: 1,
    fired: true,
    reason: '',
  }
}

export interface BoardingRunResult {
  group: FighterGroup
  rolls: number[]
  /** Boarding parties or Marines put aboard the target (8.15, 12.7). */
  landed: number
  /** Parties lost to "automated defenses, bad timing or some other mishap". */
  lost: number
  blockedByScreens: boolean
  fired: boolean
  reason: string
}

/**
 * Resolve an Assault Shuttle boarding run (8.15).
 *
 * "Standard Screens will not stop this attack but Advanced Screens will. The
 * shuttles are fired upon by PDS as normal with the survivors may attempt to
 * 'land' one Boarding Party (DCP) or Marine by rolling a 3+. (Marines get a +1
 * DRM). Failed rolls results in a casualty." Point defence has already been
 * resolved by the time this is called, so `group.strength` is the survivors.
 *
 * The boarding action itself is 12.7 and is resolved elsewhere.
 */
export function resolveBoardingRun(
  group: FighterGroup,
  rng: Rng,
  opts: { marines?: boolean; advancedScreens?: boolean } = {},
): BoardingRunResult {
  const profile = groupProfile(group)
  if (profile.payload !== 'boarding') {
    return {
      group,
      rolls: [],
      landed: 0,
      lost: 0,
      blockedByScreens: false,
      fired: false,
      reason: 'only Assault Shuttles make boarding runs (8.15)',
    }
  }
  if (opts.advancedScreens) {
    return {
      group,
      rolls: [],
      landed: 0,
      lost: 0,
      blockedByScreens: true,
      fired: false,
      reason: 'Advanced Screens stop an Assault Shuttle attack (8.15)',
    }
  }
  const drm = opts.marines ? 1 : 0
  const rolls: number[] = []
  let landed = 0
  for (let i = 0; i < group.strength; i++) {
    const face = d6(rng)
    rolls.push(face)
    if (applyDrm(face, drm) >= 3) landed += 1
  }
  return {
    group: spendCef({ ...group, payloadSpent: true, attackedThisTurn: true }, 1),
    rolls,
    landed,
    lost: group.strength - landed,
    blockedByScreens: false,
    fired: true,
    reason: '',
  }
}

// ---------------------------------------------------------------------------
// 8.10, 8.11 Dogfights
// ---------------------------------------------------------------------------

/** One group's part in a dogfight (8.11): who it shoots at, and how it did. */
export interface DogfightEntry {
  group: FighterGroup
  /** Ids of enemy groups this one fires at; several means a split (8.11). */
  targets: string[]
}

export interface DogfightSideResult {
  groupId: string
  dice: number[]
  kills: number
  /** Kills allocated per enemy group id (8.11). */
  allocation: Record<string, number>
  /** True when the group was shooting off the exhausted table (8.13). */
  exhausted: boolean
  cefSpent: number
}

export interface DogfightResult {
  sides: DogfightSideResult[]
  /** Every participating group after casualties, in the order given. */
  groups: FighterGroup[]
}

/**
 * Divide kills between several targets "as equally as possible" (8.11).
 *
 * The rule leaves the remainder's destination to the player; the engine gives it
 * to the earlier-declared targets so the result is reproducible.
 */
export function splitKills(kills: number, targets: number): number[] {
  if (targets <= 0) return []
  const base = Math.floor(kills / targets)
  const remainder = kills % targets
  return Array.from({ length: targets }, (_, i) => base + (i < remainder ? 1 : 0))
}

/**
 * Resolve a dogfight between any number of groups (8.10, 8.11).
 *
 * "All fire between fighter groups in a dogfight is considered simultaneous.
 * Roll 1D6 per fighter and inflict casualties as for Beam-1 fire against an
 * unscreened target: 4 or 5 kills one fighter, 6 kills two fighters and
 * re-roll." Simultaneity is why every group rolls against the *pre-combat*
 * strengths and losses are applied only at the end — the book's own example
 * spells it out: "all four fighters get to engage even though three have been
 * hit".
 *
 * In a furball, "all groups engaged in the dogfight may fire only once per turn,
 * but may choose to attack just one enemy group or to split their kills between
 * two or more" (8.11).
 *
 * [reading] When a group splits its fire, the single roll needs one defensive
 * modifier; the engine takes the most protective of the declared targets (the
 * lowest DRM), since the rule offers no tie-break and one roll cannot carry two
 * modifiers.
 */
export function resolveMultiGroupDogfight(entries: readonly DogfightEntry[], rng: Rng): DogfightResult {
  const byId = new Map<string, FighterGroup>()
  for (const entry of entries) byId.set(entry.group.id, entry.group)

  const sides: DogfightSideResult[] = []
  const damage = new Map<string, number>()

  for (const entry of entries) {
    const { group, targets } = entry
    const profile = groupProfile(group)
    const live = targets.filter((id) => byId.has(id))
    if (isDestroyed(group) || live.length === 0) {
      sides.push({ groupId: group.id, dice: [], kills: 0, allocation: {}, exhausted: false, cefSpent: 0 })
      continue
    }

    // 8.15 / 8.18: the group's own anti-fighter DRM, the target's protection,
    // and the Turkey penalty, which applies "when they are engaged in a
    // dogfight with other fighters".
    const targetDrms = live.map((id) => groupProfile(byId.get(id) as FighterGroup).defenceDrm)
    const defenceDrm = Math.min(...targetDrms)
    const turkey = group.pilots === 'turkey' ? -1 : 0
    const drm = profile.antiFighter.drm + defenceDrm + turkey

    const exhausted = isExhausted(group)
    const dice = attackDiceCount(group)
    const roll = exhausted
      ? rollExhaustedReturnFire(dice, rng)
      : rollFighterKills(dice, rng, { drm, reroll: !isCannonArmed(group) })

    const shares = splitKills(roll.kills, live.length)
    const allocation: Record<string, number> = {}
    live.forEach((id, index) => {
      const target = byId.get(id) as FighterGroup
      const already = damage.get(id) ?? 0
      // Overkill is wasted, not passed on (8.8's principle, applied here).
      const dealt = Math.min(shares[index], Math.max(0, target.strength - already))
      allocation[id] = dealt
      damage.set(id, already + dealt)
    })

    sides.push({
      groupId: group.id,
      dice: roll.dice,
      kills: Object.values(allocation).reduce((a, b) => a + b, 0),
      allocation,
      exhausted,
      cefSpent: exhausted ? 0 : 1,
    })
  }

  const groups = entries.map((entry) => {
    const side = sides.find((s) => s.groupId === entry.group.id)
    const engagedWith = new Set(entry.targets)
    for (const other of entries) {
      if (other.targets.includes(entry.group.id)) engagedWith.add(other.group.id)
    }
    const spent = spendCef(
      { ...entry.group, attackedThisTurn: true, engagedWith: [...engagedWith] },
      side ? side.cefSpent : 0,
    )
    return applyFighterLosses(spent, damage.get(entry.group.id) ?? 0)
  })

  return { sides, groups }
}

/**
 * The two-group case of 8.10, which is what nearly every dogfight is. Both
 * groups fire simultaneously at each other.
 */
export function resolveDogfight(a: FighterGroup, b: FighterGroup, rng: Rng): DogfightResult {
  return resolveMultiGroupDogfight(
    [
      { group: a, targets: [b.id] },
      { group: b, targets: [a.id] },
    ],
    rng,
  )
}

export interface DogfightRefusalResult {
  /** The refusing group got away without a shot being fired. */
  withdrew: boolean
  /** 8.10: the attacker's free round of attack rolls. */
  freeRound: { dice: number[]; kills: number } | null
  defender: FighterGroup
  attacker: FighterGroup
  reason: string
}

/**
 * A group declines a dogfight (8.10).
 *
 * "If one player moves a group into base contact with an enemy group, and the
 * opponent does not wish to engage in the dogfight, the enemy group may move
 * away provided it has not already moved that turn. If it does not have a higher
 * speed (maximum move) the attacking group gets a free round of attack rolls
 * before contact is broken."
 */
export function refuseDogfight(
  attacker: FighterGroup,
  defender: FighterGroup,
  rng: Rng,
  turn: number,
): DogfightRefusalResult {
  if (defender.movedThisTurn) {
    return {
      withdrew: false,
      freeRound: null,
      defender,
      attacker,
      reason: 'the group has already moved this turn and cannot refuse the dogfight (8.10)',
    }
  }
  const defenderSpeed = mainMoveAllowance(defender, turn)
  const attackerSpeed = mainMoveAllowance(attacker, turn)
  if (defenderSpeed > attackerSpeed) {
    return { withdrew: true, freeRound: null, defender, attacker, reason: '' }
  }

  const attackerProfile = groupProfile(attacker)
  const defenderProfile = groupProfile(defender)
  const drm =
    attackerProfile.antiFighter.drm +
    defenderProfile.defenceDrm +
    (attacker.pilots === 'turkey' ? -1 : 0)
  const exhausted = isExhausted(attacker)
  const roll = exhausted
    ? rollExhaustedReturnFire(attackDiceCount(attacker), rng)
    : rollFighterKills(attackDiceCount(attacker), rng, { drm, reroll: !isCannonArmed(attacker) })
  const kills = Math.min(roll.kills, defender.strength)

  return {
    withdrew: true,
    freeRound: { dice: roll.dice, kills },
    defender: applyFighterLosses(defender, kills),
    attacker: spendCef({ ...attacker, attackedThisTurn: true }, exhausted ? 0 : 1),
    reason: '',
  }
}

// ---------------------------------------------------------------------------
// 8.12 Interception of missiles
// ---------------------------------------------------------------------------

/** What the group is trying to shoot down (6.4, 8.12). */
export interface MissileTarget {
  kind: 'salvo' | 'heavy'
  /** Missiles in the salvo, or 1 for a Heavy Missile. */
  count: number
  /** 8.15: light missiles take +1 on every PDS or fighter attack against them. */
  light?: boolean
}

export interface InterceptionResult {
  group: FighterGroup
  rolls: number[]
  /** Missiles killed, after the overkill cap of 6.4. */
  kills: number
  rawKills: number
  /** The "did the fighter die too?" rolls, one per kill (6.4). */
  casualtyRolls: number[]
  losses: number
  cefSpent: number
  intercepted: boolean
  reason: string
}

/**
 * A fighter group intercepts missiles (8.12, 6.4).
 *
 * "A fighter group may attempt to intercept and engage any missile or salvo that
 * is within 6 MU and front 180° arc of it at the end of either the fighter's
 * main or secondary movement." Eligibility: "Attack or Torpedo Fighters cannot
 * intercept missiles; neither can any fighter group that has exhausted its
 * combat endurance."
 *
 * Dice are 6.4's: against a salvo "Each Beam-1 or fighter rolls a D6, killing
 * one missile on a roll of 5 or 6, with a re-roll on 6"; against a Heavy Missile
 * a fighter "kills the missile on a roll of 6".
 *
 * The price: "For each Salvo Missile or Heavy Missile killed by a fighter roll an
 * additional D6: on a roll of 6 the fighter is destroyed as well."
 */
export function interceptMissiles(
  group: FighterGroup,
  target: MissileTarget,
  rng: Rng,
): InterceptionResult {
  const profile = groupProfile(group)
  const fail = (reason: string): InterceptionResult => ({
    group,
    rolls: [],
    kills: 0,
    rawKills: 0,
    casualtyRolls: [],
    losses: 0,
    cefSpent: 0,
    intercepted: false,
    reason,
  })
  if (isDestroyed(group)) return fail('the group has been destroyed')
  if (!profile.canInterceptMissiles) {
    return fail('Attack and Torpedo Fighters cannot intercept missiles (8.12)')
  }
  if (isExhausted(group)) return fail('the group has exhausted its combat endurance (8.12)')

  // 8.18: a Turkey group's -1 applies when it tries "to intercept missiles,
  // PPTs etc."; 8.15: light missiles are easier to kill.
  const drm = (group.pilots === 'turkey' ? -1 : 0) + (target.light ? 1 : 0)
  const dice = attackDiceCount(group)
  const roll = rollModifiedPointDefence(dice, 'fighter', drm, rng, {
    heavyMissile: target.kind === 'heavy',
  })
  const kills = Math.min(roll.kills, target.count)

  const casualtyRolls: number[] = []
  let losses = 0
  for (let i = 0; i < kills; i++) {
    const face = d6(rng)
    casualtyRolls.push(face)
    if (face === 6) losses += 1
  }
  losses = Math.min(losses, group.strength)

  const after = applyFighterLosses(
    spendCef({ ...group, attackedThisTurn: true }, 1),
    losses,
  )
  return {
    group: after,
    rolls: roll.rolls,
    kills,
    rawKills: roll.kills,
    casualtyRolls,
    losses,
    cefSpent: 1,
    intercepted: true,
    reason: '',
  }
}

// ---------------------------------------------------------------------------
// 8.17 Fighter morale (optional)
// ---------------------------------------------------------------------------

export interface MoraleResult {
  /** False when the rule does not bite — full strength, or a Robot group. */
  applies: boolean
  roll: number | null
  /** True when the attack goes in. */
  attacks: boolean
  reason: string
}

/**
 * The optional fighter morale check (8.17). Off unless a scenario turns it on:
 * "The rules for fighter morale are not used."
 *
 * "Any fighter group that has lost one or more members must roll a D6 before
 * making an attack. If the roll is less than or equal to the number of fighters
 * remaining in the group, the attack is carried out; if greater … they abort
 * this attack and do not fire. Any group that fails an attack roll is not
 * considered to have expended combat endurance for that turn."
 *
 * "Robot Fighters are always immune to the morale rules."
 */
export function fighterMoraleCheck(group: FighterGroup, rng: Rng): MoraleResult {
  const profile = groupProfile(group)
  if (profile.robot) {
    return { applies: false, roll: null, attacks: true, reason: 'Robot Fighters are immune to morale (8.17)' }
  }
  if (group.strength >= profile.groupSize) {
    return { applies: false, roll: null, attacks: true, reason: 'the group is at full strength (8.17)' }
  }
  const roll = d6(rng)
  return {
    applies: true,
    roll,
    attacks: roll <= group.strength,
    reason: roll <= group.strength ? '' : 'the group aborts the attack and spends no endurance (8.17)',
  }
}

// ---------------------------------------------------------------------------
// 8.18 Aces and Turkeys (optional)
// ---------------------------------------------------------------------------

/**
 * Roll a group's pilot quality at the start of the game (8.18): "if a 6 is
 * rolled, the group contains an Ace; a roll of 1 indicates the group is a Turkey
 * group. Rolls of 2 – 5 give normal, average groups."
 */
export function rollPilotQuality(rng: Rng): { roll: number; quality: PilotQuality } {
  const roll = d6(rng)
  if (roll === 6) return { roll, quality: 'ace' }
  if (roll === 1) return { roll, quality: 'turkey' }
  return { roll, quality: 'average' }
}

export interface AceNeedleResult {
  roll: number
  /** Needle Beams always do "a single point of damage" on 4+ (5.13). */
  damage: number
  /** A natural 6 also destroys the named system (5.13, 8.18). */
  systemDestroyed: boolean
  fired: boolean
  reason: string
}

/**
 * The Ace's specific system attack (8.18, 5.13).
 *
 * "the Ace may choose to attack as a Needle Beam instead of his normal attack –
 * in this case he may choose to target ONE SPECIFIC SYSTEM on the ship being
 * attacked, rolling just ONE die and treating the attack as a Needle Beam shot."
 *
 * The Needle Beam die (5.13): "On a roll of 4+ they inflict a single point of
 * damage. On a roll of a natural 6 they inflict a single point of damage, and
 * destroy the targeted system." Needle Beams are "not affected by screens", and
 * what they destroy "cannot be repaired by Damage Control Parties".
 *
 * Call this together with `resolveAttackRun(..., { aceSpecialAttack: true })`,
 * which withholds the two dice the Ace would otherwise have contributed.
 */
export function aceNeedleAttack(group: FighterGroup, rng: Rng): AceNeedleResult {
  if (!hasAce(group)) {
    return { roll: 0, damage: 0, systemDestroyed: false, fired: false, reason: 'no Ace in this group (8.18)' }
  }
  const roll = d6(rng)
  return {
    roll,
    damage: roll >= 4 ? 1 : 0,
    systemDestroyed: roll === 6,
    fired: true,
    reason: '',
  }
}

export interface AceDuelResult {
  roll: number
  /** True when the enemy Ace was shot down (8.18). */
  aceKilled: boolean
  defender: FighterGroup
  fired: boolean
  reason: string
}

/**
 * An Ace singles out an opposing Ace in a dogfight (8.18): "an Ace may either
 * add an extra die to the group's overall attack, OR may choose to specifically
 * target an opposing Ace if there is one present in the other group – in this
 * case he rolls just one die as normal."
 *
 * "The only case in which an Ace may be killed before other members of the group
 * is if he is specifically targeted by an opposing Ace in an enemy group", so
 * this is the one thing that sets `aceKilled` without emptying the group.
 */
export function aceDuel(attacker: FighterGroup, defender: FighterGroup, rng: Rng): AceDuelResult {
  if (!hasAce(attacker)) {
    return { roll: 0, aceKilled: false, defender, fired: false, reason: 'no Ace in the attacking group (8.18)' }
  }
  if (!hasAce(defender)) {
    return { roll: 0, aceKilled: false, defender, fired: false, reason: 'no opposing Ace to target (8.18)' }
  }
  const attackerProfile = groupProfile(attacker)
  const defenderProfile = groupProfile(defender)
  const drm = attackerProfile.antiFighter.drm + defenderProfile.defenceDrm
  const roll = rollFighterKills(1, rng, { drm, reroll: !isCannonArmed(attacker) })
  const killed = roll.kills > 0
  return {
    roll: roll.dice[0],
    aceKilled: killed,
    defender: killed ? applyFighterLosses({ ...defender, aceKilled: true }, 1) : defender,
    fired: true,
    reason: '',
  }
}
