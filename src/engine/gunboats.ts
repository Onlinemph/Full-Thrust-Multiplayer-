/**
 * Full Thrust: Project Continuum — gunboats (section 9).
 *
 * 9.1 puts them exactly where they are hard to model: *"In design and tactical
 * use, they straddle the line between a very small ship, and a very large
 * fighter."* They fly like fighters — a squadron of six, moved without orders,
 * spending endurance to act — and they are shot at like ships, because
 * *"the larger size of gunboats means that they are engaged by anti-ship
 * weaponry more easily than fighters."*
 *
 * That split is why this is its own module rather than a fighter type. Every
 * number here differs from section 8's: 18 MU instead of 24, 9 MU of secondary
 * move instead of 12, 12 MU of fire control instead of 6. And the two
 * defensive rules invert the fighter ones — anti-ship fire is *better* against
 * a gunboat (one hit, one gunboat, no damage roll) and point defence is
 * *worse* (a PDS scores only on a 6).
 *
 * What is shared is deliberate: a gunboat's guns are ship guns. *"The weapons
 * in use on ships by the building empire may be modified to fit onto gunboat
 * hulls"*, so a Graser Gunboat's shot is resolved by the same Graser-1
 * resolver a ship's is, through the weapon registry. Only the Gatling Gunboat
 * has a profile of its own, because 9.2 gives it one.
 *
 * Damage is *reported*, never applied: how a gunboat's hits land on screens,
 * armour and hull is `combat.ts`'s business (4.8, 4.9).
 *
 * Every quotation is from *Full Thrust: Project Continuum* v1.1.4, sections 9.1
 * and 9.2; the prose is in `docs/rules/gunboats.md`.
 */

import { beamDamage, d6, rollBeamVolley, type Rng, type ScreenLevel } from './dice'
import { distance } from './geometry'
import { fireWeapon, type WeaponResult } from './weapons'
import type { Arc, Course, DamageMode, Point, WeaponDef } from './types'

// ---------------------------------------------------------------------------
// The squadron (9.1)
// ---------------------------------------------------------------------------

/** Gunboats in a full squadron: *"They operate in squadrons of six"* (9.1). */
export const GUNBOAT_SQUADRON_SIZE = 6

/** *"Gunboats have a speed of 18 MU, and move like fighters"* (9.1). */
export const GUNBOAT_MOVE = 18

/** *"a secondary move of 9 MU during the Fighter Secondary Movement Phase"* (9.1). */
export const GUNBOAT_SECONDARY_MOVE = 9

/** *"Gunboats have six points of combat endurance"* (9.1). */
export const GUNBOAT_CEF = 6

/**
 * *"slightly larger and more powerful fire control systems than those on
 * fighters, allowing them to engage targets up to 12 MU away"* (9.1).
 */
export const GUNBOAT_FIRE_CONTROL = 12

/** The Gatling Gunboat's short band, where it rolls its full six dice (9.2). */
export const GATLING_GUNBOAT_SHORT_RANGE = 6

/** *"Gunboat Racks are 18 mass for a squadron of 6 gunboats"* (9.1). */
export const GUNBOAT_RACK_MASS = 18

/** *"Bays are 24 mass and cost 0 points"* (9.1). */
export const GUNBOAT_BAY_MASS = 24

/**
 * *"if they jump or arrive within 6 MU of a 'massive object', they are
 * automatically destroyed"* (9.1).
 */
export const FTL_GUNBOAT_DISTORTION_RANGE = 6

/** The sixteen gunboat armaments catalogued in 9.2 and priced in 14.8. */
export type GunboatTypeId =
  | 'beam'
  | 'plasma'
  | 'graser'
  | 'gatling'
  | 'needle'
  | 'pulse-torpedo'
  | 'submunition'
  | 'mkp'
  | 'k-gun'
  | 'missile'
  | 'rocket'
  | 'point-defence'
  | 'ads'
  | 'scatterpack'
  | 'plasma-bomber'

/** The three modifications of 9.2 and 14.8, all priced per squadron. */
export type GunboatModifierId = 'ftl' | 'heavy' | 'ecm'

/** *"All weapons fire against the gunboat has a -1 DRM"* (9.2 Heavy). */
export const HEAVY_GUNBOAT_DRM = -1

export interface GunboatType {
  id: GunboatTypeId
  label: string
  /** Points for one gunboat, as printed (9.2). */
  pointsEach: number
  /**
   * The mounts one gunboat carries, as ship weapons. A Beam Gunboat's pair is
   * two entries because 9.2 says *"2 class-1 beams"* — and both fire at the
   * same target, which is the squadron rule anyway.
   */
  mounts: readonly {
    weaponClass: WeaponDef['weaponClass']
    rating: number
    variant?: WeaponDef['variant']
  }[]
  /** Longest reach of its guns in MU (9.2). */
  range: number
  /** Whether it can be allocated as point defence (9.2 Gatling, PDS, ADS). */
  canPointDefend: boolean
  /**
   * 9.2: several types carry *"two 1-shot"* loads instead of a gun, and one
   * carries a salvo of four missiles. Null for a type that simply shoots.
   */
  payload: { kind: GunboatPayloadKind; shots: number } | null
  /** 9.2: an in-built ADFC, which the PDS, ADS and Scatterpack boats have. */
  adfc: boolean
  notes: string
}

/** The one-shot loads of 9.2, each fired in the phase its own section names. */
export type GunboatPayloadKind =
  | 'submunition'
  | 'mkp'
  | 'salvo-missile'
  | 'rocket'
  | 'scatterpack'
  | 'plasma-bomb'

/**
 * The gunboat catalogue of 9.2, as printed.
 *
 * The costs are quoted two ways — *"3 per mass (9 points each)"* — which fixes
 * a gunboat at mass 3, and the arithmetic holds for every entry: the Gatling's
 * *"5 per mass (15 points each)"* is the same mass at a dearer rate.
 */
export const GUNBOAT_TYPES: Record<GunboatTypeId, GunboatType> = {
  beam: {
    id: 'beam',
    label: 'Beam Gunboat',
    pointsEach: 9,
    mounts: [
      { weaponClass: 'beam', rating: 1 },
      { weaponClass: 'beam', rating: 1 },
    ],
    range: 12,
    canPointDefend: false,
    payload: null,
    adfc: false,
    notes: '2 class-1 beams to 12 MU, both at the same target (9.2)',
  },
  plasma: {
    id: 'plasma',
    label: 'Plasma Gun Gunboat',
    pointsEach: 9,
    mounts: [{ weaponClass: 'plasma-cannon', rating: 1 }],
    range: 12,
    canPointDefend: false,
    payload: null,
    adfc: false,
    notes: '1 Plasma-1 to 12 MU (9.2)',
  },
  graser: {
    id: 'graser',
    label: 'Graser Gunboat',
    pointsEach: 9,
    mounts: [{ weaponClass: 'graser', rating: 1 }],
    range: 12,
    canPointDefend: false,
    payload: null,
    adfc: false,
    notes: '1 Graser-1 to 12 MU (9.2)',
  },
  gatling: {
    id: 'gatling',
    label: 'Gatling Gunboat',
    pointsEach: 15,
    // Resolved by `gatlingGunboatDice` rather than by the ship Gatling
    // resolver: 9.2 gives it two bands where 5.10 gives the ship battery one.
    mounts: [],
    range: 12,
    canPointDefend: true,
    payload: null,
    adfc: false,
    notes: '6 BD* to 6 MU or 2 BD* to 12 MU, forward 30° only; or once as a PDS (9.2)',
  },
  needle: {
    id: 'needle',
    label: 'Needle Gunboat',
    pointsEach: 9,
    mounts: [{ weaponClass: 'needle-beam', rating: 1 }],
    range: 12,
    canPointDefend: false,
    payload: null,
    adfc: false,
    notes: '1 Needle Beam to 12 MU (9.2)',
  },

  // --- the eleven types past the Needle Gunboat -------------------------
  'pulse-torpedo': {
    id: 'pulse-torpedo',
    label: 'Pulse Torpedo Gunboat',
    pointsEach: 12,
    mounts: [{ weaponClass: 'pulse-torpedo', rating: 1, variant: 'short' }],
    range: 12,
    canPointDefend: false,
    payload: null,
    adfc: false,
    notes:
      'One short-range Pulse Torpedo Launcher, hitting on 2+ to 4 MU, 3+ to 8 MU and 4+ to 12 MU (9.2)',
  },
  submunition: {
    id: 'submunition',
    label: 'Submunition Gunboat',
    pointsEach: 12,
    mounts: [],
    range: 12,
    canPointDefend: false,
    payload: { kind: 'submunition', shots: 2 },
    adfc: false,
    notes:
      'Two one-shot submunitions, 3 BD* to 6 MU or 2 BD* to 12 MU, ignoring screens; then it is unarmed (9.2)',
  },
  mkp: {
    id: 'mkp',
    label: 'MKP Gunboat',
    pointsEach: 15,
    mounts: [],
    range: 12,
    canPointDefend: false,
    payload: { kind: 'mkp', shots: 2 },
    adfc: false,
    notes: 'Two one-shot MKP packs: one hit on 4+, two on a 6, four points of AP a hit (9.2)',
  },
  'k-gun': {
    id: 'k-gun',
    label: 'K-Gun Gunboat',
    pointsEach: 12,
    mounts: [{ weaponClass: 'k-gun', rating: 2, variant: 'short' }],
    range: 12,
    canPointDefend: false,
    payload: null,
    adfc: false,
    notes:
      'One short-range K-2 hitting on 2+ to 4 MU, 3+ to 8 MU and 4+ to 12 MU; damage doubles on a following 1 or 2, armour-piercing (9.2)',
  },
  missile: {
    id: 'missile',
    label: 'Missile Gunboat',
    pointsEach: 12,
    mounts: [],
    range: 12,
    canPointDefend: false,
    payload: { kind: 'salvo-missile', shots: 4 },
    adfc: false,
    notes:
      'A salvo of four missiles, not six, launched inside 12 MU in the Ordnance Launch Phase for one CEF; they need not all go the same way (9.2)',
  },
  rocket: {
    id: 'rocket',
    label: 'Rocket Gunboat',
    pointsEach: 12,
    mounts: [],
    range: 12,
    canPointDefend: false,
    payload: { kind: 'rocket', shots: 4 },
    adfc: false,
    notes:
      'Four rockets hitting on 2+ to 6 MU and 3+ to 12 MU, all at one target, for one CEF (9.2)',
  },
  'point-defence': {
    id: 'point-defence',
    label: 'Point Defence Gunboat',
    pointsEach: 9,
    mounts: [],
    range: 6,
    canPointDefend: true,
    payload: null,
    adfc: true,
    notes:
      'Two PDS out to 6 MU, each able to take its own target, and it counts as carrying an ADFC (9.2)',
  },
  ads: {
    id: 'ads',
    label: 'Area Defence System Gunboat',
    pointsEach: 12,
    mounts: [],
    range: 12,
    canPointDefend: true,
    payload: null,
    adfc: true,
    notes:
      'One Area Defence Array: a die of point defence to 12 MU or two to 6 MU, and it counts as carrying an ADFC (9.2)',
  },
  scatterpack: {
    id: 'scatterpack',
    label: 'Scatterpack Gunboat',
    pointsEach: 15,
    mounts: [],
    range: 12,
    canPointDefend: true,
    payload: { kind: 'scatterpack', shots: 2 },
    adfc: true,
    notes:
      'Two one-shot Scatterpacks, separately targetable because each guides itself, with an in-built ADFC (9.2)',
  },
  'plasma-bomber': {
    id: 'plasma-bomber',
    label: 'Plasma Bomber Gunboat',
    pointsEach: 15,
    mounts: [],
    range: 0,
    canPointDefend: false,
    payload: { kind: 'plasma-bomb', shots: 2 },
    adfc: false,
    notes:
      'Two one-shot class-1 Plasma Bombs, *dropped* where the gunboat stands in the Ordnance Launch Phase rather than launched — it then has to fly clear of its own bomb (9.2)',
  },
}

export interface GunboatModifier {
  id: GunboatModifierId
  label: string
  /** Points for the whole squadron, as printed (9.2). */
  pointsPerSquadron: number
  notes: string
}

export const GUNBOAT_MODIFIERS: Record<GunboatModifierId, GunboatModifier> = {
  ftl: {
    id: 'ftl',
    label: 'FTL',
    pointsPerSquadron: 6,
    notes: 'Enters and leaves under its own FTL; cannot be carried in racks (9.2)',
  },
  heavy: {
    id: 'heavy',
    label: 'Heavy or Screened',
    pointsPerSquadron: 12,
    notes: 'All weapons fire against the squadron is at −1 DRM (9.2)',
  },
  ecm: {
    id: 'ecm',
    label: 'Electronic Warfare',
    // 14.8: "+3 points each per level of ECM (3 levels max) for the entire
    // squadron", so one level over six boats is 18 — priced per level below.
    pointsPerSquadron: 18,
    notes: 'Every level of ECM takes 1 MU off the lock-on range of missiles and fighters (9.2)',
  },
}

/** 9.2: *"Every level of ECM reduces the lock-on range by 1 MU"*. */
export const ECM_GUNBOAT_LOCK_ON_PENALTY_MU = 1
export const MAX_GUNBOAT_ECM_LEVELS = 3

export type GunboatStatus = 'aboard' | 'in-flight' | 'destroyed'

/**
 * A gunboat squadron in play.
 *
 * `boats` is a list rather than a count because 9.1 says so outright: *"You
 * are not required to make all the gunboats in a squadron the same. You may
 * mix and match types and weapons as you wish"*. Casualties come off this
 * list, and which entry goes is a die roll — *"the owning player should roll
 * randomly"* — so the list is the strength.
 */
export interface GunboatSquadron {
  id: string
  side: string
  /** Ship carrying the rack or bay, or null once it is gone. */
  carrierId: string | null
  label: string
  boats: GunboatTypeId[]
  modifiers: GunboatModifierId[]
  status: GunboatStatus
  position: Point
  facing: Course
  /** Combat endurance left (9.1). */
  cef: number
  launchedTurn: number | null
  recoveredTurn: number | null
  movedThisTurn: boolean
  secondaryMovedThisTurn: boolean
  attackedThisTurn: boolean
  /** 8.6, applied to gunboats by 9.1's "same rules as for fighters". */
  evading: boolean
  targetId: string | null
}

export interface GunboatSquadronOptions {
  id: string
  side: string
  label?: string
  boats?: GunboatTypeId[]
  modifiers?: GunboatModifierId[]
  carrierId?: string | null
  position?: Point
  facing?: Course
  status?: GunboatStatus
  cef?: number
}

/** A full squadron of six, fuelled, in its rack (9.1). */
export function createGunboatSquadron(opts: GunboatSquadronOptions): GunboatSquadron {
  const boats =
    opts.boats ?? (Array(GUNBOAT_SQUADRON_SIZE).fill('beam') as GunboatTypeId[])
  return {
    id: opts.id,
    side: opts.side,
    carrierId: opts.carrierId ?? null,
    label: opts.label ?? opts.id,
    boats: [...boats],
    modifiers: [...(opts.modifiers ?? [])],
    status: opts.status ?? 'aboard',
    position: opts.position ?? { x: 0, y: 0 },
    facing: opts.facing ?? 12,
    cef: opts.cef ?? GUNBOAT_CEF,
    launchedTurn: null,
    recoveredTurn: null,
    movedThisTurn: false,
    secondaryMovedThisTurn: false,
    attackedThisTurn: false,
    evading: false,
    targetId: null,
  }
}

export function squadronStrength(squadron: GunboatSquadron): number {
  return squadron.boats.length
}

export function isSquadronDestroyed(squadron: GunboatSquadron): boolean {
  return squadron.boats.length === 0
}

/** *"All gunboats expend 1 combat endurance point to fire their main weapon"* (9.1). */
export function isSquadronExhausted(squadron: GunboatSquadron): boolean {
  return squadron.cef <= 0
}

export function hasModifier(squadron: GunboatSquadron, id: GunboatModifierId): boolean {
  return squadron.modifiers.includes(id)
}

/** Clear the per-turn flags at the top of a turn. */
export function beginGunboatTurn(squadron: GunboatSquadron): GunboatSquadron {
  return {
    ...squadron,
    movedThisTurn: false,
    secondaryMovedThisTurn: false,
    attackedThisTurn: false,
    evading: false,
  }
}

export function spendGunboatCef(squadron: GunboatSquadron, amount: number): GunboatSquadron {
  return { ...squadron, cef: Math.max(0, squadron.cef - Math.max(0, amount)) }
}

/**
 * Points for a squadron as built (9.1, 9.2).
 *
 * Per gunboat for the hulls, per squadron for the modifications, exactly as
 * printed — which means a squadron shot down to two boats still cost what six
 * cost, and a mixed squadron costs the sum of its parts.
 */
export function squadronPoints(
  boats: readonly GunboatTypeId[],
  modifiers: readonly GunboatModifierId[] = [],
): number {
  let points = boats.reduce((sum, id) => sum + GUNBOAT_TYPES[id].pointsEach, 0)
  for (const id of new Set(modifiers)) points += GUNBOAT_MODIFIERS[id].pointsPerSquadron
  return points
}

/**
 * Check a squadron against 9.1 and 9.2. Empty when the build is legal.
 *
 * The two hard rules: a squadron is six or fewer, and *"FTL Gunboats cannot be
 * carried in racks"*, so an FTL squadron riding a rack is an illegal fit
 * rather than a tactical choice.
 */
export function validateGunboatBuild(
  boats: readonly GunboatTypeId[],
  modifiers: readonly GunboatModifierId[] = [],
  opts: { carriedOnRack?: boolean } = {},
): string[] {
  const problems: string[] = []
  if (boats.length === 0) problems.push('a squadron needs at least one gunboat (9.1)')
  if (boats.length > GUNBOAT_SQUADRON_SIZE) {
    problems.push(`a squadron is ${GUNBOAT_SQUADRON_SIZE} gunboats at most (9.1)`)
  }
  const seen = new Set<GunboatModifierId>()
  for (const id of modifiers) {
    if (seen.has(id)) problems.push(`${GUNBOAT_MODIFIERS[id].label} may only be applied once (9.2)`)
    seen.add(id)
  }
  if (seen.has('ftl') && opts.carriedOnRack === true) {
    problems.push('FTL Gunboats cannot be carried in racks (9.2)')
  }
  return problems
}

// ---------------------------------------------------------------------------
// Movement (9.1)
// ---------------------------------------------------------------------------

export interface GunboatMoveResult {
  squadron: GunboatSquadron
  moved: boolean
  distance: number
  reason: string
}

const EPSILON = 1e-9

/**
 * The main move (9.1): 18 MU, in any direction, no orders written. Unlike a
 * fighter there is no half-move on the launch turn — 9.1 says gunboats *"are
 * launched at the same time as other ordnance/fighters"* and nothing about
 * forming up, and 8.1's half move is written about fighters leaving a tube.
 * **[reading]** stated here so it is visible rather than assumed.
 */
export function moveGunboatSquadron(
  squadron: GunboatSquadron,
  to: Point,
  facing: Course = squadron.facing,
): GunboatMoveResult {
  if (squadron.status !== 'in-flight') {
    return { squadron, moved: false, distance: 0, reason: 'squadron is not in flight (9.1)' }
  }
  const travelled = distance(squadron.position, to)
  if (travelled > GUNBOAT_MOVE + EPSILON) {
    return {
      squadron,
      moved: false,
      distance: travelled,
      reason: `move of ${travelled.toFixed(1)} MU exceeds the ${GUNBOAT_MOVE} MU allowance (9.1)`,
    }
  }
  return {
    squadron: { ...squadron, position: to, facing, movedThisTurn: true },
    moved: true,
    distance: travelled,
    reason: '',
  }
}

/**
 * The secondary move (9.1): *"It can also be used to make a secondary move of
 * 9 MU during the Fighter Secondary Movement Phase"* — "it" being the
 * endurance, so the move costs one.
 */
export function secondaryMoveGunboatSquadron(
  squadron: GunboatSquadron,
  to: Point,
  facing: Course = squadron.facing,
): GunboatMoveResult {
  if (squadron.status !== 'in-flight') {
    return { squadron, moved: false, distance: 0, reason: 'squadron is not in flight (9.1)' }
  }
  if (isSquadronExhausted(squadron)) {
    return { squadron, moved: false, distance: 0, reason: 'no combat endurance left (9.1)' }
  }
  const travelled = distance(squadron.position, to)
  if (travelled > GUNBOAT_SECONDARY_MOVE + EPSILON) {
    return {
      squadron,
      moved: false,
      distance: travelled,
      reason: `secondary move of ${travelled.toFixed(1)} MU exceeds ${GUNBOAT_SECONDARY_MOVE} MU (9.1)`,
    }
  }
  const moved = spendGunboatCef(
    { ...squadron, position: to, facing, secondaryMovedThisTurn: true },
    1,
  )
  return { squadron: moved, moved: true, distance: travelled, reason: '' }
}

/**
 * An FTL gunboat arriving or departing (9.1, 9.2).
 *
 * *"if there is a ship, planet, asteroid or other object sufficient to cause
 * distortion where the Gunboat engages its FTL, the gunboat is destroyed"*, and
 * 9.1 puts a number on "where": within 6 MU.
 */
export function ftlTransitDestroys(
  at: Point,
  massiveObjects: readonly Point[],
): boolean {
  return massiveObjects.some(
    (object) => distance(at, object) <= FTL_GUNBOAT_DISTORTION_RANGE + EPSILON,
  )
}

// ---------------------------------------------------------------------------
// Launch and recovery (9.1)
// ---------------------------------------------------------------------------

/** What the carrying ship can do this turn (9.1). */
export interface GunboatCarrierState {
  /** Racks aboard, each holding one squadron of six (9.1). */
  racks: number
  /** Boat bays large enough to take a whole squadron back (9.1). */
  bays: number
  /** Racks and bays already used this turn. */
  used: number
}

export interface GunboatOperationCheck {
  allowed: boolean
  reason: string
}

const ALLOWED: GunboatOperationCheck = { allowed: true, reason: '' }

/**
 * May the squadron launch (9.1)? Gunboats *"are launched at the same time as
 * other ordnance/fighters"* — off a rack, which needs no tube and imposes none
 * of 8.2's thrust restrictions, because a rack is hull-mounted and the boats
 * fly themselves off it.
 */
export function canLaunchSquadron(
  squadron: GunboatSquadron,
  carrier: GunboatCarrierState,
): GunboatOperationCheck {
  if (squadron.status !== 'aboard') return { allowed: false, reason: 'squadron is not aboard (9.1)' }
  if (isSquadronDestroyed(squadron)) return { allowed: false, reason: 'the squadron is gone' }
  if (carrier.used >= carrier.racks + carrier.bays) {
    return { allowed: false, reason: 'no rack or bay free this turn (9.1)' }
  }
  return ALLOWED
}

export function launchGunboatSquadron(
  squadron: GunboatSquadron,
  carrier: GunboatCarrierState,
  turn: number,
  at: Point,
  facing: Course = squadron.facing,
): { squadron: GunboatSquadron; launched: boolean; reason: string } {
  const check = canLaunchSquadron(squadron, carrier)
  if (!check.allowed) return { squadron, launched: false, reason: check.reason }
  return {
    squadron: {
      ...squadron,
      status: 'in-flight',
      position: at,
      facing,
      launchedTurn: turn,
      movedThisTurn: false,
      secondaryMovedThisTurn: false,
    },
    launched: true,
    reason: '',
  }
}

/**
 * May the squadron land (9.1)?
 *
 * The rule that bites: *"Gunboats cannot be refueled or rearmed in combat
 * using their carrying rack"*. Only a boat bay takes them back — *"Gunboat-
 * carrying ships with a boat bay of sufficient size to recover the whole
 * squadron may use that boat bay to retrieve and rearm gunboats during
 * combat"* — so a ship with racks alone launches its squadron once and that is
 * the squadron's war.
 */
export function canRecoverSquadron(
  squadron: GunboatSquadron,
  carrier: GunboatCarrierState,
): GunboatOperationCheck {
  if (squadron.status !== 'in-flight') {
    return { allowed: false, reason: 'squadron is not in flight (9.1)' }
  }
  if (carrier.bays <= 0) {
    return { allowed: false, reason: 'a rack cannot take a squadron back; only a boat bay can (9.1)' }
  }
  if (carrier.used >= carrier.bays) {
    return { allowed: false, reason: 'no boat bay free this turn (9.1)' }
  }
  return ALLOWED
}

export function recoverGunboatSquadron(
  squadron: GunboatSquadron,
  carrier: GunboatCarrierState,
  turn: number,
): { squadron: GunboatSquadron; recovered: boolean; reason: string } {
  const check = canRecoverSquadron(squadron, carrier)
  if (!check.allowed) return { squadron, recovered: false, reason: check.reason }
  return {
    squadron: {
      ...squadron,
      status: 'aboard',
      launchedTurn: null,
      recoveredTurn: turn,
      // "retrieve and rearm" (9.1) — a bay refuels as well as recovers.
      cef: GUNBOAT_CEF,
      evading: false,
      attackedThisTurn: false,
      targetId: null,
    },
    recovered: true,
    reason: '',
  }
}

// ---------------------------------------------------------------------------
// Attacking (9.1, 9.2)
// ---------------------------------------------------------------------------

/** What the squadron is shooting at, as its guns need to see it. */
export interface GunboatTarget {
  screens: ScreenLevel
  /** Range in MU from the squadron to the target. */
  range: number
  /** The arc the squadron's shot falls in, for weapons that care. */
  arc?: Arc
}

export interface GunboatAttackResult {
  squadron: GunboatSquadron
  /** Every natural face rolled, in the order the boats fired. */
  dice: number[]
  normalDamage: number
  penetratingDamage: number
  mode: DamageMode
  /** One line per gunboat that fired. */
  shots: Array<{ type: GunboatTypeId; detail: string }>
  cefSpent: number
  fired: boolean
  reason: string
}

/**
 * The Gatling Gunboat's dice (9.2): *"6 BD\* against a single target within
 * 6 MU, or 2BD\* at 12 MU"*.
 */
export function gatlingGunboatDice(range: number): number {
  if (range <= GATLING_GUNBOAT_SHORT_RANGE + EPSILON) return 6
  if (range <= GUNBOAT_FIRE_CONTROL + EPSILON) return 2
  return 0
}

/**
 * May the squadron declare an attack (9.1)?
 *
 * One target for the whole squadron when it is a ship — *"The entire gunboat
 * squadron must all target the same enemy ship"* — and 12 MU of fire control.
 */
export function canSquadronAttack(
  squadron: GunboatSquadron,
  range: number,
): GunboatOperationCheck {
  if (squadron.status !== 'in-flight' || isSquadronDestroyed(squadron)) {
    return { allowed: false, reason: 'squadron is not in flight (9.1)' }
  }
  if (squadron.attackedThisTurn) {
    return { allowed: false, reason: 'the squadron has already fired this turn (9.1)' }
  }
  if (isSquadronExhausted(squadron)) {
    return { allowed: false, reason: 'no combat endurance left to fire (9.1)' }
  }
  if (range > GUNBOAT_FIRE_CONTROL + EPSILON) {
    return {
      allowed: false,
      reason: `target is ${range.toFixed(1)} MU away, beyond ${GUNBOAT_FIRE_CONTROL} MU of fire control (9.1)`,
    }
  }
  return ALLOWED
}

/**
 * Resolve the squadron's attack on a ship (9.1, 9.2).
 *
 * Each gunboat fires its own guns, and those guns are ship guns: a Graser
 * Gunboat's shot goes through the same Graser-1 resolver a cruiser's does.
 * That is not a shortcut — 9.1 says the weapons *are* the fleet's ship weapons
 * fitted to a small hull, so anything else would be a second graser.
 *
 * *"All gunboats expend 1 combat endurance point to fire their main weapon"*,
 * and the squadron fires once, so the cost is one CEF for the squadron.
 */
export function resolveGunboatAttack(
  squadron: GunboatSquadron,
  target: GunboatTarget,
  rng: Rng,
): GunboatAttackResult {
  const check = canSquadronAttack(squadron, target.range)
  const empty: GunboatAttackResult = {
    squadron,
    dice: [],
    normalDamage: 0,
    penetratingDamage: 0,
    mode: 'standard',
    shots: [],
    cefSpent: 0,
    fired: false,
    reason: check.reason,
  }
  if (!check.allowed) return empty

  const dice: number[] = []
  const shots: GunboatAttackResult['shots'] = []
  let normalDamage = 0
  let penetratingDamage = 0
  // A squadron can mix graser and plasma boats, and their damage is scored
  // differently. Reporting the mix as `standard` would tell `combat.ts` to
  // meet all of it with armour; reporting it as the sharpest mode present
  // would tell it to bypass armour for hits that should not. So the whole
  // volley is reported as standard damage plus whatever each resolver marked
  // penetrating, which is what every mixed source in the engine does.
  const arc: Arc = target.arc ?? 'F'

  for (const type of squadron.boats) {
    const profile = GUNBOAT_TYPES[type]
    if (type === 'gatling') {
      const count = gatlingGunboatDice(target.range)
      if (count === 0) {
        shots.push({ type, detail: 'Gatling Gunboat out of range' })
        continue
      }
      const volley = rollBeamVolley(count, target.screens, rng, { penetrating: true })
      dice.push(...volley.dice.map((die) => die.natural))
      normalDamage += volley.normalDamage
      penetratingDamage += volley.penetratingDamage
      shots.push({
        type,
        detail: `Gatling Gunboat ${count}BD* → ${volley.normalDamage}+${volley.penetratingDamage}P`,
      })
      continue
    }

    for (const mount of profile.mounts) {
      const weapon: WeaponDef = {
        id: `${squadron.id}-${type}`,
        label: profile.label,
        weaponClass: mount.weaponClass,
        rating: mount.rating,
        variant: mount.variant ?? 'standard',
        arcs: [arc],
        mass: 0,
        points: 0,
      }
      const result = fireWeapon(weapon, {
        range: target.range,
        arc,
        targetScreens: target.screens,
        rearArc: false,
        drm: 0,
        rng,
      })
      if ('refused' in result) {
        shots.push({ type, detail: `${profile.label}: ${result.refused}` })
        continue
      }
      collect(result)
      shots.push({ type, detail: result.detail })
    }
  }

  function collect(result: WeaponResult): void {
    dice.push(...result.dice)
    normalDamage += result.normalDamage
    penetratingDamage += result.penetratingDamage
  }

  return {
    squadron: spendGunboatCef({ ...squadron, attackedThisTurn: true }, 1),
    dice,
    normalDamage,
    penetratingDamage,
    mode: 'standard',
    shots,
    cefSpent: 1,
    fired: true,
    reason: '',
  }
}

// ---------------------------------------------------------------------------
// Being shot at (9.1)
// ---------------------------------------------------------------------------

/**
 * Anti-ship fire against a squadron (9.1).
 *
 * *"Direct Fire Anti-ship weapons may fire at gunboats normally, with each HIT
 * destroying ONE gunboat. In the case of weapons that do multiple points of
 * damage (Grasers or Pulse Torps for example) do not roll damage."*
 *
 * So the caller counts *hits*, not damage — a Graser-3's three hits kill three
 * gunboats however much damage they would have done to a hull. `hits` is that
 * count; the Heavy modification's −1 has already been applied to the dice that
 * produced it, which is why it is not applied again here.
 */
export function directFireKills(squadron: GunboatSquadron, hits: number, rng: Rng): {
  squadron: GunboatSquadron
  killed: number
  lost: GunboatTypeId[]
} {
  return killRandomly(squadron, hits, rng)
}

/**
 * Point defence against a squadron (9.1).
 *
 * The inverse of the anti-ship rule: *"Gunboats are well armored against
 * lighter PDS type weapons. PDS weapons engage gunboats like Plasma Bolts only
 * scoring one hit on a 6."* A scattergun is the exception — *"Scatterguns/
 * Interceptor Pods cause 1 BD\* of hits"* — which is one beam die read as
 * kills, re-roll included.
 */
export type GunboatPdMount = 'pds' | 'scattergun'

export interface GunboatPointDefenceResult {
  squadron: GunboatSquadron
  rolls: number[]
  killed: number
  lost: GunboatTypeId[]
}

export function pointDefenceAgainstGunboats(
  squadron: GunboatSquadron,
  mounts: readonly GunboatPdMount[],
  rng: Rng,
): GunboatPointDefenceResult {
  const drm = hasModifier(squadron, 'heavy') ? HEAVY_GUNBOAT_DRM : 0
  const rolls: number[] = []
  let kills = 0

  for (const mount of mounts) {
    if (mount === 'pds') {
      const face = d6(rng)
      rolls.push(face)
      if (clamp(face + drm) >= 6) kills += 1
      continue
    }
    // 1 BD*: the beam table read as kills, with the natural 6 re-rolling.
    let again = true
    while (again) {
      const face = d6(rng)
      rolls.push(face)
      kills += beamDamage(clamp(face + drm), 0)
      again = face === 6
    }
  }

  const result = killRandomly(squadron, kills, rng)
  return { squadron: result.squadron, rolls, killed: result.killed, lost: result.lost }
}

/**
 * Take casualties off the squadron (9.1): *"To determine which gunboat(s) in a
 * squadron are destroyed the owning player should roll randomly."*
 *
 * It matters in a mixed squadron, which 9.1 explicitly allows: losing the
 * Needle Gunboat is a different loss from losing a Beam Gunboat, and letting
 * the owner choose would mean the expensive boats always died last.
 */
function killRandomly(
  squadron: GunboatSquadron,
  count: number,
  rng: Rng,
): { squadron: GunboatSquadron; killed: number; lost: GunboatTypeId[] } {
  const boats = [...squadron.boats]
  const lost: GunboatTypeId[] = []
  const kills = Math.min(Math.max(0, Math.floor(count)), boats.length)
  for (let i = 0; i < kills; i++) {
    const index = rng.int(boats.length)
    lost.push(boats[index])
    boats.splice(index, 1)
  }
  return {
    squadron: {
      ...squadron,
      boats,
      status: boats.length === 0 ? 'destroyed' : squadron.status,
    },
    killed: kills,
    lost,
  }
}

function clamp(face: number): number {
  return Math.max(1, Math.min(6, face))
}
