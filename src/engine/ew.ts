/**
 * Full Thrust: Project Continuum — electronic warfare, cloaks and the two
 * superweapons (7.17 – 7.25).
 *
 * Four things live here and they are only loosely related, which is the
 * rulebook's own grouping:
 *
 *   - the die roll modifiers and range penalties an attacker suffers for
 *     shooting at a Holofield or a cloaked ship (7.17), and the lock-on and
 *     sensor ranges ECM and Area ECM eat into (7.18, 7.19);
 *   - a per-ship cloak state machine for the three different cloaks (7.20 –
 *     7.22), which differ in what the cloaked ship may do, when it goes up and
 *     comes down, and what damage does to it;
 *   - the Nova Cannon and Wave Gun (7.23, 7.24) as `WeaponSpec`s, plus the
 *     template geometry neither of them can be resolved without;
 *   - the Reflex Field (7.25), which is a *defence* that answers damage after
 *     it has been rolled rather than before.
 *
 * Rules are written out in full in `docs/rules/ew-and-cloaks.md`, including the
 * readings taken where the text is ambiguous and the arithmetic showing why a
 * Holofield is exactly −1 DRM.
 *
 * Two boundaries. This module computes modifiers and states; it never applies
 * damage (that is `combat.ts`) and never decides which system a threshold check
 * knocked out (that is `threshold.ts`) — it only says what happens *when* the
 * cloak or the Wave Gun is the system that went.
 */

import { d6, rollD6, type Rng, type ScreenLevel } from './dice'
import { courseVector } from './geometry'
import type { Course, Point, WeaponClass, WeaponDef } from './types'
import type { FiringContext, WeaponResult, WeaponSpec, WeaponSpecTable } from './weapons/contract'

// ---------------------------------------------------------------------------
// 7.17 Holofield
// ---------------------------------------------------------------------------

/**
 * The Holofield's modifier to beam dice (7.17).
 *
 * 7.17 states the effect as a replacement table — *"will only score one hit on
 * a 5 or 6 with a re-roll for the 6 if applicable"* — but a Holofield ship can
 * carry no screens (*"cannot be combined with other screen or field
 * technology"*), so that table and the unscreened column of 4.7 shifted one
 * face agree on every die. 5.23 prints the same conclusion as a number when it
 * excuses spinal mounts: *"there is no -1 for Holofields"*.
 *
 * Expressing it as a DRM is what lets it travel in `FiringContext.drm` and
 * reach re-rolls for free, since `dice.rollBeamVolley` modifies every die it
 * throws but tests the re-roll on the natural face (4.6) — which is exactly
 * *"The Holofield will affect all re-rolls as well"*.
 */
export const HOLOFIELD_DRM = -1

/**
 * 7.17: *"Any ships firing at 6 MU or less will ignore Holofields."* Read as
 * lifting the whole clause — DRM, range penalty and needle-beam immunity —
 * because "ignore" is stated without qualification.
 */
export const HOLOFIELD_IGNORED_WITHIN_MU = 6

/**
 * 7.17: *"Weapons that do not use beam dice add 12mu to the range. If this
 * modifies the range beyond the weapons maximum range the shot automatically
 * misses."*
 */
export const HOLOFIELD_RANGE_PENALTY_MU = 12

/** 7.17: *"Their attack range is reduced by 1 MU"* for missiles and fighters. */
export const HOLOFIELD_LOCK_ON_PENALTY_MU = 1

// ---------------------------------------------------------------------------
// 7.18 ECM, 7.19 Area ECM
// ---------------------------------------------------------------------------

/**
 * 7.18, 7.19: *"The aggregate ECM level of a ship (its own plus any Area ECM)
 * cannot exceed 3."* Both sections state it, so it is a hard cap on the sum
 * rather than a cap on either fit.
 */
export const MAX_AGGREGATE_ECM_LEVEL = 3

/** 7.18: *"For every level of ECM your ship has subtracts 6 MU from the 'de-blip' range"*. */
export const ECM_SENSOR_PENALTY_MU = 6

/** 7.18: *"Every level of ECM reduces the lock-on range by 1 MU"*. */
export const ECM_LOCK_ON_PENALTY_MU = 1

/** 7.19: the Area ECM bubble, *"all allied ships within 6 MU"*. */
export const AREA_ECM_RADIUS = 6

/**
 * Base attack radius of a guided ordnance unit, before ECM and Holofields
 * (6.3, 8.9): *"6 MU of the marker (in any direction) then the missile(s) will
 * attack it"*, and a fighter group attacks *"within 6 MU"*.
 */
export const BASE_LOCK_ON_RANGE_MU = 6

/** A ship's total ECM level, own plus area cover, capped at 3 (7.18, 7.19). */
export function aggregateEcmLevel(ownLevel: number, areaLevel: number): number {
  const total = Math.max(0, ownLevel) + Math.max(0, areaLevel)
  return Math.min(MAX_AGGREGATE_ECM_LEVEL, total)
}

/**
 * An enemy sensor range after ECM (7.18).
 *
 * The base range is the caller's, not this module's: the de-blip and
 * information ranges are section 12's and section 12 is not in the rulebook
 * extract (`docs/rules/SOURCES.md`). The engine knows two detection ranges —
 * a FireCon's 54 MU and an Advanced FireCon's 72 MU (5.2, 7.4) — and either
 * may be passed in.
 */
export function ecmSensorRange(baseRangeMu: number, aggregateLevel: number): number {
  return Math.max(0, baseRangeMu - ECM_SENSOR_PENALTY_MU * Math.max(0, aggregateLevel))
}

/**
 * What a FireCon is being used for, when Area ECM is running (7.19).
 *
 * *"When Area ECM is turned on, the carrying ship cannot use its own FireCon
 * systems. The shorter-range FireCon systems in PDS, ADS, Scatterpacks,
 * Grapeshot, and ADFC still function normally."*
 */
export type FireConUser =
  | 'firecon'
  | 'advanced-firecon'
  | 'pds'
  | 'ads'
  | 'scattergun'
  | 'grapeshot'
  | 'adfc'
  | 'advanced-adfc'

/** The short-range fire controls 7.19 exempts from its own jamming. */
export const AREA_ECM_EXEMPT_FIRECONS: readonly FireConUser[] = [
  'pds',
  'ads',
  'scattergun',
  'grapeshot',
  'adfc',
  'advanced-adfc',
]

/**
 * Whether running Area ECM blinds this fire control (7.19). Only the ship's own
 * FireCons go down; the point-defence fits keep working, which is why an EW ship
 * can still defend itself while jamming.
 */
export function areaEcmBlocks(user: FireConUser): boolean {
  return !AREA_ECM_EXEMPT_FIRECONS.includes(user)
}

// ---------------------------------------------------------------------------
// The net modifier against a shot (7.17, 7.18, 7.20)
// ---------------------------------------------------------------------------

/**
 * The target's electronic-warfare state at the moment of the shot.
 *
 * Levels are what is *operational*, not what is fitted: ECM is one SSD box per
 * level and is *"lost progressively by damage"* (7.18), and a cloak that has
 * taken its boxes reads through `cloakMode`.
 */
export interface EwDefences {
  /** 7.17: a working Holofield. */
  holofield?: boolean
  /** 7.18: the target's own ECM levels still operational. */
  ecmLevel?: number
  /** 7.19: area cover from friendly Area ECM ships within 6 MU. */
  areaEcmLevel?: number
  /** 7.20 – 7.22: what the target's cloak is doing, from `cloakMode`. */
  cloak?: CloakMode
}

/** The one shot being modified. */
export interface EwShot {
  /** Actual range in MU, before any of this (2.1). */
  range: number
  /**
   * 7.17: the weapon rolls beam dice (4.5). True for beams, grasers, phasers,
   * gatlings and the rest of 5.3 – 5.13; false for the projectile to-hit tables
   * of 5.14, 5.16, 5.18 and 5.19.
   */
  usesBeamDice: boolean
  /** 5.23, 6.8, 7.17: an area-of-effect weapon — spinal mounts, PBLs and the
   *  two superweapons below — which ignores Holofields entirely. */
  areaEffect?: boolean
  /** 7.17: *"Graviton Beams … ignore Holofields"*. */
  gravitonBeam?: boolean
  /** 5.13: a needle beam, or a phaser firing in needle mode (5.8). */
  needleBeam?: boolean
  /** The mount's own maximum range, for the Holofield's automatic miss (7.17). */
  maxRange?: number
}

/** One line of the modifier stack, for the battle log and the UI. */
export interface EwModifier {
  label: string
  /** Change to the die roll (1.7). */
  drm?: number
  /** Range in MU the shot is treated as being at, after this line. */
  effectiveRange?: number
}

/** Everything 7.17 – 7.22 does to one shot. */
export interface EwFireEffect {
  /** Net die roll modifier — what `FiringContext.drm` should carry. */
  drm: number
  /** The range the shot is resolved at (7.17 +12 MU, 7.20 doubling). */
  effectiveRange: number
  /** 7.17: the modified range is past the mount's maximum, so the shot misses. */
  autoMiss: boolean
  /** 7.21, 7.22: the target is not on the table and cannot be shot at at all. */
  untargetable: boolean
  /** 5.13, 7.17, 7.20: whether a needle beam may still pick a system. */
  mayTargetSystems: boolean
  modifiers: EwModifier[]
}

/**
 * The net effect of the target's EW fit on one shot (7.17, 7.18, 7.20).
 *
 * Stacking, which is the question 7.17 – 7.19 spend most of their words on:
 * ECM contributes **no** to-hit modifier (7.18 lists two effects and neither is
 * one), a Holofield contributes −1, a Cloaking Device −2, and the two can never
 * meet because 7.20 forbids a cloak *"combined with any fields or screens"* and
 * 7.17 forbids a Holofield combined with *"other screen or field technology"*.
 * So the stack is always a single source, and the module adds rather than
 * taking the best of — if an illegal fit is handed in, it says what that fit
 * would do rather than silently picking a winner. `validateEwFit` is where
 * illegality is reported.
 */
export function ewFireEffect(shot: EwShot, defences: EwDefences): EwFireEffect {
  const modifiers: EwModifier[] = []
  const cloak = defences.cloak ?? 'none'
  let drm = 0
  let effectiveRange = shot.range
  let mayTargetSystems = true

  // 7.21: a totally cloaked ship has been taken off the table. There is no shot
  // to modify, so this is reported rather than turned into a very large DRM.
  if (cloak === 'total') {
    return {
      drm: 0,
      effectiveRange: shot.range,
      autoMiss: true,
      untargetable: true,
      mayTargetSystems: false,
      modifiers: [{ label: 'Target is under a Cloaking Field (7.21): not on the table' }],
    }
  }

  if (cloak === 'partial') {
    // 7.20: "All direct fire weapons are considered to be at twice the actual
    // range to the target and are at -2 DRM including re-rolls for penetrating
    // weapons." The doubling is applied to the actual range before any other
    // range penalty, which is the order the sentence reads in.
    effectiveRange = shot.range * 2
    drm += CLOAK_DRM
    mayTargetSystems = false
    modifiers.push({ label: 'Cloaking Device (7.20)', drm: CLOAK_DRM, effectiveRange })
  }

  const holofieldApplies =
    (defences.holofield ?? false) &&
    shot.range > HOLOFIELD_IGNORED_WITHIN_MU &&
    !(shot.areaEffect ?? false) &&
    !(shot.gravitonBeam ?? false)

  if (holofieldApplies) {
    if (shot.usesBeamDice) {
      drm += HOLOFIELD_DRM
      modifiers.push({ label: 'Holofield (7.17)', drm: HOLOFIELD_DRM })
    } else {
      effectiveRange += HOLOFIELD_RANGE_PENALTY_MU
      modifiers.push({
        label: 'Holofield (7.17): +12 MU to the range',
        effectiveRange,
      })
    }
    // 7.17: "Needle Beams and similar weapons, are ineffective against a ship
    // protected by Holofields."
    if (shot.needleBeam) mayTargetSystems = false
  }

  const autoMiss = shot.maxRange !== undefined && effectiveRange > shot.maxRange
  if (autoMiss) {
    modifiers.push({
      label: `Modified range ${effectiveRange} MU is past the mount's ${shot.maxRange} MU: no shot (7.17, 7.20)`,
    })
  }

  return { drm, effectiveRange, autoMiss, untargetable: false, mayTargetSystems, modifiers }
}

/**
 * The number `FiringContext.drm` wants (7.17, 7.20).
 *
 * A convenience over `ewFireEffect` for callers that only need the modifier and
 * have already dealt with range themselves.
 */
export function netEwDrm(shot: EwShot, defences: EwDefences): number {
  return ewFireEffect(shot, defences).drm
}

/** What kind of miniature fire control is trying to lock on (7.17, 7.18). */
export type LockOnSeeker = 'missile' | 'fighter' | 'gunboat' | 'rocket'

/**
 * The range at which missiles, fighters and gunboats can still attack (7.17,
 * 7.18, 7.19), or `null` when they cannot lock at all.
 *
 * 7.17 and 7.18 agree on the arithmetic from both ends: a Holofield takes 1 MU,
 * every ECM level takes 1 MU, and together *"a net -4 MU range reduction"*
 * against three levels of ECM — *"this would reduce fighter/missile lock-on
 * range to 2 MU"* from a base of 6.
 *
 * Rockets are exempt. 7.18 says so outright — *"ECM has no effect on rockets"* —
 * and 6.7 has them fly straight in on a to-hit table rather than locking on, so
 * the Holofield's −1 MU has nothing to bite on either.
 */
export function lockOnRange(
  seeker: LockOnSeeker,
  defences: EwDefences,
  baseRangeMu: number = BASE_LOCK_ON_RANGE_MU,
): number | null {
  // 7.20: "Missiles and fighters will not lock at all."
  if ((defences.cloak ?? 'none') !== 'none') return null
  if (seeker === 'rocket') return baseRangeMu
  const ecm = aggregateEcmLevel(defences.ecmLevel ?? 0, defences.areaEcmLevel ?? 0)
  const holofield = (defences.holofield ?? false) ? HOLOFIELD_LOCK_ON_PENALTY_MU : 0
  return Math.max(0, baseRangeMu - ECM_LOCK_ON_PENALTY_MU * ecm - holofield)
}

// ---------------------------------------------------------------------------
// 7.20 – 7.22 Cloaks
// ---------------------------------------------------------------------------

/** The three cloaks, by the `SystemKind` ids `types.ts` already carries. */
export type CloakKind = 'cloaking-device' | 'cloaking-field' | 'tuffley-cloak'

/**
 * What a cloak is doing.
 *
 * - `partial` is 7.20's Cloaking Device: the model stays on the table and can
 *   be shot at, badly.
 * - `total` is 7.21's Cloaking Field and 7.22's Tuffley Cloak: the model is off
 *   the table and cannot be interacted with at all.
 */
export type CloakMode = 'none' | 'partial' | 'total'

/** 7.20: *"are at -2 DRM including re-rolls for penetrating weapons"*. */
export const CLOAK_DRM = -2

/** 7.20: *"the ship velocity may not exceed a speed of 24 without voiding the Cloaking Device"*. */
export const CLOAK_MAX_VELOCITY = 24

/**
 * Damage boxes per cloak (7.20 – 7.22).
 *
 * The Cloaking Field's two are the reason it degrades rather than dies: *"If one
 * of its damage boxes has been checked off for any reason the cloak operates as
 * a standard cloak."* `threshold.ts` already knows this count (it rolls for both
 * boxes, 7.21); it is repeated here because this module has to say what one lost
 * box *means*.
 */
export const CLOAK_BOXES: Record<CloakKind, number> = {
  'cloaking-device': 1,
  'cloaking-field': 2,
  'tuffley-cloak': 1,
}

/** Why a cloak came down without being ordered to (7.20). */
export type CloakVoidReason = 'over-speed' | 'damaged'

/**
 * One ship's cloak, as it stands (7.20 – 7.22).
 *
 * Every field is readonly and every transition returns a new state: a cloak is
 * a small thing whose history matters for replay, and a pure state lets
 * `game.ts` keep it wherever it likes.
 */
export interface CloakState {
  readonly kind: CloakKind
  /** Damage boxes checked off (7.21). */
  readonly boxesLost: number
  readonly active: boolean
  /**
   * The mode the cloak is actually running in, fixed when it went up.
   *
   * It is not always `cloakCapability`: 7.20 has a cloak killed by a threshold
   * check keep the ship hidden until *"the end of the turn"*, so a destroyed
   * cloak goes on running for the rest of the turn it died in. Null whenever the
   * cloak is down.
   */
  readonly runningMode: CloakMode | null
  /** Turns of cloak still owed by the written order (7.20, 7.21). */
  readonly turnsRemaining: number
  /** An order written this turn, waiting for the movement phase to act on it. */
  readonly ordered: number | null
  /** 7.21: where the stationary marker went down when a total cloak closed. */
  readonly entryPoint: Point | null
  /** 7.20: *"the ship uncloaks at the end of the turn"* after a threshold hit. */
  readonly decloakAtEndOfTurn: boolean
  readonly voidedBy: CloakVoidReason | null
}

/** An undamaged, inactive cloak of this type (7.20 – 7.22). */
export function createCloakState(kind: CloakKind): CloakState {
  return {
    kind,
    boxesLost: 0,
    active: false,
    runningMode: null,
    turnsRemaining: 0,
    ordered: null,
    entryPoint: null,
    decloakAtEndOfTurn: false,
    voidedBy: null,
  }
}

/**
 * What this cloak could still do if switched on (7.20 – 7.22).
 *
 * A Cloaking Field with one box gone *"operates as a standard cloak"*; a Tuffley
 * Cloak *"does not have a 'damaged level'. If the Tuffley Cloak is damaged it
 * ceases to function."*
 */
export function cloakCapability(state: CloakState): CloakMode {
  const boxes = CLOAK_BOXES[state.kind]
  if (state.boxesLost >= boxes) return 'none'
  if (state.kind === 'cloaking-device') return 'partial'
  // Cloaking Field with one of its two boxes checked: degraded to 7.20.
  if (state.boxesLost > 0) return 'partial'
  return 'total'
}

/** What the cloak is doing right now — `none` unless it is actually up. */
export function cloakMode(state: CloakState): CloakMode {
  return state.active ? state.runningMode ?? 'none' : 'none'
}

/**
 * Whether a cloak goes up at the *start* of the movement phase (7.21, 7.22) or
 * at the end of it (7.20).
 *
 * 7.21: *"At the start of its movement for that turn, the ship model is removed
 * from the table"*. 7.20: *"Ships will cloak and uncloak at the end of the Ship
 * Movement Phase."* Both come down at the end of the movement phase.
 */
export function cloakRaisesAtStartOfMovement(state: CloakState): boolean {
  return cloakCapability(state) === 'total'
}

/**
 * Write the order to cloak (7.20, 7.21).
 *
 * *"the player must note this in orders for that turn, and the number of turns
 * the ship is to remain cloaked, e.g. 3 turns"* — the count is declared in
 * advance and cannot be changed later, which is what stops a ship *"choosing to
 * de-cloak just because a juicy target has wandered into range"* (7.21).
 *
 * Throws rather than refusing quietly: ordering a dead cloak or a zero-turn
 * cloak is a caller bug, and a silent no-op in phase 1 would only surface as a
 * ship mysteriously visible in phase 11.
 */
export function orderCloak(state: CloakState, turns: number): CloakState {
  if (!Number.isInteger(turns) || turns < 1) {
    throw new RangeError(`orderCloak: a cloak order is a whole number of turns, got ${turns}`)
  }
  if (cloakCapability(state) === 'none') {
    throw new RangeError(`orderCloak: this ${state.kind} has been destroyed and cannot cloak`)
  }
  return { ...state, ordered: turns }
}

/** Cancel an order written this turn but not yet acted on (phase 1, 2.6). */
export function cancelCloakOrder(state: CloakState): CloakState {
  return { ...state, ordered: null }
}

/**
 * Phase 5, before the ship moves: a total cloak closes here (7.21, 7.22).
 *
 * *"At the start of its movement for that turn, the ship model is removed from
 * the table and a marker of some kind is placed to mark its location on entering
 * cloaked mode."* The marker is the ship's position at that instant and it stays
 * put until the ship comes back.
 */
export function cloakStartOfMovement(state: CloakState, position: Point): CloakState {
  if (state.ordered === null || state.active) return state
  if (!cloakRaisesAtStartOfMovement(state)) return state
  return {
    ...state,
    active: true,
    runningMode: cloakCapability(state),
    turnsRemaining: state.ordered,
    ordered: null,
    entryPoint: { ...position },
    voidedBy: null,
  }
}

/**
 * What `cloakEndOfMovement` needs to know about the ship it belongs to. Only
 * the velocity: a partial cloak leaves the model on the table (7.20), so unlike
 * `cloakStartOfMovement` there is no marker to place.
 */
export interface CloakMovementContext {
  /** Velocity after this turn's movement (3.2) — the 7.20 speed limit. */
  velocity: number
}

/**
 * Phase 5, after the ship has moved (7.20).
 *
 * Three things happen here, in this order:
 *
 *  1. a partial cloak ordered this turn goes up — *"Ships will cloak and uncloak
 *     at the end of the Ship Movement Phase"*;
 *  2. an already-active cloak spends one of its ordered turns, and comes down
 *     when they run out;
 *  3. a partial cloak carrying too much way is voided — *"the ship velocity may
 *     not exceed a speed of 24 without voiding the Cloaking Device"*.
 *
 * A cloak that went up this phase does not also tick this phase, so "3 turns"
 * buys three turns of cover: a Device ordered in turn 1 is cloaked for the fire
 * phases of turns 1, 2 and 3 and decloaks at the end of turn 4's movement, the
 * same point in the turn at which it cloaked. A Field, which went up at the
 * *start* of turn 1's movement, does tick that turn and so gets three unseen
 * moves (7.21).
 */
export function cloakEndOfMovement(state: CloakState, ctx: CloakMovementContext): CloakState {
  let next = state
  let raisedNow = false

  if (next.ordered !== null && !next.active && !cloakRaisesAtStartOfMovement(next)) {
    next = {
      ...next,
      active: true,
      runningMode: cloakCapability(next),
      turnsRemaining: next.ordered,
      ordered: null,
      entryPoint: null,
      voidedBy: null,
    }
    raisedNow = true
  }

  if (next.active && !raisedNow) {
    const remaining = next.turnsRemaining - 1
    next = remaining <= 0 ? decloak(next, null) : { ...next, turnsRemaining: remaining }
  }

  // 7.20's speed limit is checked after the cloak is up, so a ship that cloaks
  // while already travelling faster than 24 voids it the moment it closes.
  if (next.active && cloakMode(next) === 'partial' && ctx.velocity > CLOAK_MAX_VELOCITY) {
    next = decloak(next, 'over-speed')
  }

  // An order names "that turn" (7.20), so one the movement phase could not act
  // on is spent rather than carried forward. A total cloak's order is consumed
  // by `cloakStartOfMovement`, which runs earlier in the same phase.
  if (next.ordered !== null) next = { ...next, ordered: null }

  return next
}

function decloak(state: CloakState, reason: CloakVoidReason | null): CloakState {
  return {
    ...state,
    active: false,
    runningMode: null,
    turnsRemaining: 0,
    entryPoint: null,
    decloakAtEndOfTurn: false,
    voidedBy: reason,
  }
}

/**
 * Check off cloak damage boxes (7.20, 7.21).
 *
 * *"When making threshold checks roll for BOTH damage boxes"* (7.21), so
 * `threshold.ts` may hand two at once. A cloak that loses its last box takes the
 * ship out of cloak, but not instantly: 7.20 fixes the timing at *"the ship
 * uncloaks at the end of the turn"*, which is the only timing the three sections
 * print and is therefore used for all of them.
 *
 * A Cloaking Field that loses only its first box keeps running — it just runs as
 * a standard cloak from now on, which falls out of `cloakCapability` without a
 * transition of its own.
 */
export function applyCloakDamage(state: CloakState, boxes = 1): CloakState {
  if (boxes <= 0) return state
  const boxesLost = Math.min(CLOAK_BOXES[state.kind], state.boxesLost + boxes)
  const next: CloakState = { ...state, boxesLost }
  if (boxesLost >= CLOAK_BOXES[state.kind]) {
    // Dead. An inactive cloak simply stops being an option; an active one keeps
    // the ship hidden until the end of the turn (7.20), so `runningMode` is
    // left alone and only the decloak is scheduled.
    return next.active
      ? { ...next, decloakAtEndOfTurn: true, voidedBy: 'damaged', ordered: null }
      : { ...next, ordered: null }
  }
  // 7.21: a Cloaking Field that loses one box "operates as a standard cloak" —
  // "for any reason", so the downgrade bites at once rather than at the end of
  // the turn, which is the timing 7.20 reserves for a cloak that has *failed*.
  return next.active ? { ...next, runningMode: cloakCapability(next) } : next
}

/** End of the turn: a cloak knocked out in phase 13 comes down now (7.20). */
export function cloakEndOfTurn(state: CloakState): CloakState {
  if (!state.decloakAtEndOfTurn) return state
  return decloak(state, state.voidedBy ?? 'damaged')
}

/** Everything a cloaked ship may not do, and what its enemies may not do to it. */
export interface CloakRestrictions {
  /** 7.21: a totally cloaked ship's model is off the table. */
  onTable: boolean
  /** 7.20: *"it cannot launch or land fighters"*. */
  mayLaunchOrRecoverFighters: boolean
  /** 7.20: *"fire its weapons"*. */
  mayFireWeapons: boolean
  /** 7.20: *"enter hyperspace"* (11). */
  mayEnterFtl: boolean
  /** 7.20: *"receive communications"* — no orders from the flagship (3.7). */
  mayReceiveCommunications: boolean
  /** 7.20: *"or raise its screens"* (7.2). */
  mayRaiseScreens: boolean
  /** 7.20: *"Area ECM will not function as well"* (7.19). */
  areaEcmFunctions: boolean
  /** 7.20: *"The ship does not gain any bonuses for stealth while the cloak is active"* (7.4, 7.5). */
  stealthApplies: boolean
  /** 7.20: *"If the ship strikes a planet or other large solid object … the ship is destroyed"*. */
  destroyedByCollision: boolean
  /** 7.20: velocity ceiling, or null where the cloak sets none. */
  maxVelocity: number | null
  /** 7.20: *"Missiles and fighters will not lock at all"*. */
  enemyOrdnanceMayLock: boolean
  /** 5.13, 7.20: *"Needle Beams may not target any specific systems"*. */
  enemyNeedleBeamsMayTargetSystems: boolean
}

/**
 * What a cloak forbids (7.20 – 7.22).
 *
 * 7.21 and 7.22 list no prohibitions of their own beyond being blind, so the
 * total cloak inherits 7.20's list — it is strictly more cut off than a Device,
 * being off the table entirely — with one exception: the velocity limit. 7.20
 * states it of the Cloaking Device, 7.21 and 7.22 never mention speed, and a
 * ship that is not on the table has no measurable speed for an enemy to catch it
 * at. A Field degraded to one box *"operates as a standard cloak"* and picks the
 * limit back up along with everything else 7.20 says.
 */
export function cloakRestrictions(mode: CloakMode): CloakRestrictions {
  if (mode === 'none') {
    return {
      onTable: true,
      mayLaunchOrRecoverFighters: true,
      mayFireWeapons: true,
      mayEnterFtl: true,
      mayReceiveCommunications: true,
      mayRaiseScreens: true,
      areaEcmFunctions: true,
      stealthApplies: true,
      destroyedByCollision: false,
      maxVelocity: null,
      enemyOrdnanceMayLock: true,
      enemyNeedleBeamsMayTargetSystems: true,
    }
  }
  return {
    onTable: mode === 'partial',
    mayLaunchOrRecoverFighters: false,
    mayFireWeapons: false,
    mayEnterFtl: false,
    mayReceiveCommunications: false,
    mayRaiseScreens: false,
    areaEcmFunctions: false,
    stealthApplies: false,
    destroyedByCollision: true,
    maxVelocity: mode === 'partial' ? CLOAK_MAX_VELOCITY : null,
    enemyOrdnanceMayLock: false,
    enemyNeedleBeamsMayTargetSystems: false,
  }
}

/** Whether this velocity keeps a cloak up (7.20). */
export function cloakVelocityLegal(mode: CloakMode, velocity: number): boolean {
  const limit = cloakRestrictions(mode).maxVelocity
  return limit === null || velocity <= limit
}

// ---------------------------------------------------------------------------
// Template geometry, shared by the Nova Cannon and the Wave Gun (7.23, 7.24)
// ---------------------------------------------------------------------------

/**
 * Where a target stands relative to a template's line of flight.
 *
 * `along` is its distance up the line from the origin (negative behind), and
 * `across` its perpendicular offset. `toSweep` is the distance from the target
 * to the segment the template's centre actually travelled, which is what the
 * contact test needs — a template touches everything within its radius of that
 * segment, including at the two ends where it starts and stops.
 */
export interface SweepGeometry {
  along: number
  across: number
  toSweep: number
}

/**
 * Measure a target against a template sweep (7.23, 7.24).
 *
 * `geometry.ts` has no point-to-segment distance, so this module defines its
 * own; everything else — the course vector, the clock face — comes from there.
 */
export function sweepGeometry(
  origin: Point,
  course: Course,
  fromMu: number,
  toMu: number,
  target: Point,
): SweepGeometry {
  const unit = courseVector(course)
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  const along = dx * unit.x + dy * unit.y
  // The perpendicular component, taken as a magnitude: which side of the line
  // the target sits on makes no difference to a circular template.
  const across = Math.abs(dx * -unit.y + dy * unit.x)
  const overshoot = along < fromMu ? fromMu - along : along > toMu ? along - toMu : 0
  return { along, across, toSweep: Math.hypot(overshoot, across) }
}

/** Whether a template of `diameter` MU sweeping `fromMu`→`toMu` touches the target. */
export function templateContacts(
  origin: Point,
  course: Course,
  fromMu: number,
  toMu: number,
  diameter: number,
  target: Point,
): boolean {
  return sweepGeometry(origin, course, fromMu, toMu, target).toSweep <= diameter / 2
}

/** A clutch of damage dice and what they came to (6.5, 7.23, 7.24). */
export interface DamageRoll {
  faces: number[]
  damage: number
}

// ---------------------------------------------------------------------------
// 7.23 Spinal Mount Nova Cannon
// ---------------------------------------------------------------------------

/** Which of the three template generations a burst is on (7.23). */
export type NovaStage = 1 | 2 | 3

/** One generation of the nova template: where it sweeps, how big, how hard. */
export interface NovaSweep {
  /** Distance from the firing ship at which the sweep starts, in MU. */
  fromMu: number
  toMu: number
  /** Template diameter in MU. */
  diameter: number
  /** D6 of damage anything it touches suffers. */
  damageDice: number
}

/** 7.23: *"hurled out to 6 MU in front of the ship (its minimum arming distance)"*. */
export const NOVA_ARMING_DISTANCE_MU = 6

/**
 * The three sweeps (7.23).
 *
 * Turn one: *"Place a 2 MU diameter template at the arming point (6 MU from the
 * ship's bow) and then move the template 18 MU outward … At the end of its total
 * 24 MU move, the template is left in place"* — 6 + 18 = the 24 MU the book
 * counts from the bow. Turn two: *"the 2 MU template is replaced by a 4 MU one,
 * which is then moved 24 MU along its original course"*, for 4D6. Turn three: a
 * 6 MU template, *"another 24 MU"*, 2D6, and then it burns out.
 *
 * Distances are all from the firing ship's position *at the moment it fired*,
 * because the template is *"left in place on the table"* between sweeps while
 * the ship is free to move on.
 */
export const NOVA_SWEEPS: Record<NovaStage, NovaSweep> = {
  1: { fromMu: NOVA_ARMING_DISTANCE_MU, toMu: 24, diameter: 2, damageDice: 6 },
  2: { fromMu: 24, toMu: 48, diameter: 4, damageDice: 4 },
  3: { fromMu: 48, toMu: 72, diameter: 6, damageDice: 2 },
}

/** The farthest a nova burst ever reaches (7.23): 24 + 24 + 24 MU. */
export const NOVA_TOTAL_RANGE_MU = NOVA_SWEEPS[3].toMu

/** A live nova reaction on the table (7.23). */
export interface NovaBurst {
  /** The firing ship's position when it fired; all distances run from here. */
  origin: Point
  /** The bow's course when it fired — *"in whatever direction the ship's bow is pointing"*. */
  course: Course
  /** The generation about to sweep, or that has just swept. */
  stage: NovaStage
}

/** The Nova Cannon as fitted to a ship: its arming order and its live bursts. */
export interface NovaCannonState {
  /** 7.23: armed in this turn's orders, so the ship is powered down. */
  armed: boolean
  bursts: NovaBurst[]
}

export function createNovaCannonState(): NovaCannonState {
  return { armed: false, bursts: [] }
}

/**
 * What arming the Nova Cannon costs the ship for the turn (7.23).
 *
 * *"the ship may not expend any other power at all for that turn: it may not
 * apply any thrust to accelerate or maneuver, it may not fire any other weapons,
 * and even its screens do not function for that turn!"*
 */
export interface NovaPowerDown {
  mayApplyThrust: boolean
  mayChangeCourse: boolean
  mayFireOtherWeapons: boolean
  screensFunction: boolean
}

/** Note the Nova Cannon in this turn's orders (7.23, phase 1). */
export function armNovaCannon(state: NovaCannonState): NovaCannonState {
  return { ...state, armed: true }
}

/**
 * Fire the armed Nova Cannon (7.23), putting a stage-1 burst on the table.
 *
 * Throws if it was not armed: the arming is written in orders a phase earlier
 * and a shot without it is a caller bug, not a rules situation.
 */
export function fireNovaCannon(
  state: NovaCannonState,
  origin: Point,
  course: Course,
): NovaCannonState {
  if (!state.armed) {
    throw new RangeError('fireNovaCannon: the Nova Cannon was not armed in this turn’s orders (7.23)')
  }
  return { armed: false, bursts: [...state.bursts, { origin: { ...origin }, course, stage: 1 }] }
}

/**
 * The turn ended without the shot (7.23).
 *
 * *"If the Nova Cannon is then not fired that turn, for any reason, then its
 * 'arming' is lost and it must be re-armed the next turn the player wishes to
 * use it."* The ship still paid for the turn; it simply has nothing to show.
 */
export function novaArmingLost(state: NovaCannonState): NovaCannonState {
  return { ...state, armed: false }
}

/**
 * Age every live burst one generation (7.23), *"On the next turn, at the start
 * of the firing phase"*. A burst that has already made its third sweep *"exhausts
 * its fuel and burns out – the template is removed from play"*.
 */
export function advanceNovaBursts(state: NovaCannonState): NovaCannonState {
  const bursts: NovaBurst[] = []
  for (const burst of state.bursts) {
    if (burst.stage >= 3) continue
    bursts.push({ ...burst, stage: (burst.stage + 1) as NovaStage })
  }
  return { ...state, bursts }
}

/** Whether this burst's current sweep touches a target, and where it stands. */
export function novaContact(
  burst: NovaBurst,
  target: Point,
): { contact: boolean; geometry: SweepGeometry } {
  const sweep = NOVA_SWEEPS[burst.stage]
  const geometry = sweepGeometry(burst.origin, burst.course, sweep.fromMu, sweep.toMu, target)
  return { contact: geometry.toSweep <= sweep.diameter / 2, geometry }
}

/**
 * Roll a nova sweep's damage (7.23): *"6D6 of damage"*, then 4D6, then 2D6, all
 * of it Penetrating with *"neither type of screen nor armor"* having any effect.
 */
export function rollNovaDamage(stage: NovaStage, rng: Rng): DamageRoll {
  const faces = rollD6(NOVA_SWEEPS[stage].damageDice, rng)
  return { faces, damage: faces.reduce((total, face) => total + face, 0) }
}

// ---------------------------------------------------------------------------
// 7.24 Wave Gun
// ---------------------------------------------------------------------------

/** One band of the expanding wave front (7.24). */
export interface WaveGunBand {
  fromMu: number
  toMu: number
  diameter: number
  damageDice: number
}

/**
 * The wave front, which lives one turn only (7.24).
 *
 * *"Its full range is 36 MU. Over the first 12 MU, move a 2 MU diameter template
 * along the line of fire, at 12-24 MU the template expands to 3 MU diameter and
 * then from 24-36 MU it expands again to 4 MU diameter … Any ship touched by the
 * template during its flight suffers damage: 4D6 at 0-12 MU range, 3D6 at 12-24
 * MU and 2D6 at 24-36 MU."*
 */
export const WAVE_GUN_BANDS: readonly WaveGunBand[] = [
  { fromMu: 0, toMu: 12, diameter: 2, damageDice: 4 },
  { fromMu: 12, toMu: 24, diameter: 3, damageDice: 3 },
  { fromMu: 24, toMu: 36, diameter: 4, damageDice: 2 },
]

export const WAVE_GUN_RANGE_MU = 36

/** 7.24: *"when the accumulated rolls reach six or more the weapon is fully charged"*. */
export const WAVE_GUN_CHARGE_TARGET = 6

/** The capacitors (7.24). */
export interface WaveGunState {
  /** Accumulated charge dice, *"write the result down"*. */
  charge: number
}

export function createWaveGunState(): WaveGunState {
  return { charge: 0 }
}

/**
 * One turn's charging (7.24): *"Each turn that the player orders the weapon to
 * charge, roll one D6 and write the result down"*.
 *
 * The accumulated total is not capped at 6 — the book says *"six or more"* and
 * has the charge matter again if the weapon is knocked out, so an over-charged
 * capacitor is a bigger bang when it goes.
 */
export function chargeWaveGun(
  state: WaveGunState,
  rng: Rng,
): { state: WaveGunState; roll: number; charged: boolean } {
  const roll = d6(rng)
  const charge = state.charge + roll
  return { state: { charge }, roll, charged: charge >= WAVE_GUN_CHARGE_TARGET }
}

export function isWaveGunCharged(state: WaveGunState): boolean {
  return state.charge >= WAVE_GUN_CHARGE_TARGET
}

/** 7.24: *"Firing the Wave Gun totally discharges the capacitors"*. */
export function dischargeWaveGun(): WaveGunState {
  return { charge: 0 }
}

/**
 * What the carrying ship suffers when the Wave Gun is knocked out (7.24).
 *
 * *"If the Wave Gun is knocked out by a threshold roll or a Needle Beam hit while
 * it is charging or charged, the carrying ship suffers damage equal to the
 * current charge in the weapon's capacitors."* An empty capacitor does nothing,
 * which is why charging is a decision and not a default.
 */
export function waveGunKnockOutDamage(state: WaveGunState): number {
  return Math.max(0, state.charge)
}

/** What the firing ship gives up for the turn (7.24). */
export interface WaveGunFiringRestrictions {
  mayApplyThrust: boolean
  mayChangeCourse: boolean
  mayFireOtherWeapons: boolean
  /** *"counts as being unscreened through its entire frontal arc"* while firing. */
  screensFunctionForward: boolean
}

/**
 * 7.24, which is deliberately a shorter list than the Nova Cannon's: *"Note that
 * a ship fitted with a Wave Gun may apply thrust or change course in the same
 * turn that it fires the weapon, unlike the Nova Cannon."*
 */
export const WAVE_GUN_FIRING_RESTRICTIONS: WaveGunFiringRestrictions = {
  mayApplyThrust: true,
  mayChangeCourse: true,
  mayFireOtherWeapons: false,
  screensFunctionForward: false,
}

/**
 * The band a target at this distance along the line of fire falls in (7.24), or
 * null past 36 MU. A distance exactly on a boundary is in the nearer band, which
 * is how `geometry.rangeBand` reads 12 MU and how a player reads *"0-12 MU"*.
 */
export function waveGunBandAt(alongMu: number): WaveGunBand | null {
  if (alongMu < 0 || alongMu > WAVE_GUN_RANGE_MU) return null
  return WAVE_GUN_BANDS.find((band) => alongMu <= band.toMu) ?? null
}

/**
 * Whether the wave front touches a target, and in which band (7.24).
 *
 * The template only ever expands, so the band that matters is the one the target
 * stands in and the radius used is that band's — the reading a player takes when
 * they lay a tape along the line of fire and read the bracket off it.
 */
export function waveGunContact(
  origin: Point,
  course: Course,
  target: Point,
): { contact: boolean; band: WaveGunBand | null; geometry: SweepGeometry } {
  const geometry = sweepGeometry(origin, course, 0, WAVE_GUN_RANGE_MU, target)
  const band = waveGunBandAt(geometry.along)
  if (!band) return { contact: false, band: null, geometry }
  return { contact: geometry.across <= band.diameter / 2, band, geometry }
}

/**
 * Roll a wave front's damage (7.24).
 *
 * *"Advanced Screens affect Wave Gun damage rolls (-1 DRM per level), but will
 * ignore Standard Screens and armor"*, and 7.3's *"Negative damage is treated as
 * zero; the target ship cannot regain damage points!"* floors each die.
 */
export function rollWaveGunDamage(
  band: WaveGunBand,
  advancedScreenLevel: ScreenLevel,
  rng: Rng,
): DamageRoll {
  const faces = rollD6(band.damageDice, rng)
  const damage = faces.reduce((total, face) => total + Math.max(0, face - advancedScreenLevel), 0)
  return { faces, damage }
}

// ---------------------------------------------------------------------------
// The two superweapons as WeaponSpecs (7.23, 7.24)
// ---------------------------------------------------------------------------

/**
 * The firing context these two want beyond `FiringContext` (7.23, 7.24).
 *
 * A plain `FiringContext` is still valid: the defaults are a first-generation
 * nova sweep and a target with no Advanced Screens.
 */
export interface EwFiringContext extends FiringContext {
  /**
   * 7.23: which template generation is passing over the target. `ctx.range` for
   * a Nova Cannon is the target's distance *along the burst's line of flight
   * from the burst's origin* — which `novaContact` measures — and not its range
   * from the firing ship, because on later turns the ship has moved and the
   * template has not.
   */
  novaStage?: NovaStage
  /** 7.3, 7.24: the target's Advanced Screen level, the only screen a Wave Gun feels. */
  advancedScreenLevel?: ScreenLevel
}

/**
 * Both weapons fire on the centre line, so the only arc either can bear in is
 * the forward one (4.2, 7.23, 7.24). Whether the *template* actually touches the
 * target is `novaContact` / `waveGunContact`'s question, exactly as a spinal
 * mount's beam width is `weapons/kinetics.ts`'s (5.23).
 *
 * An SSD that leaves the arcs blank is read as bow-line, since 7.23 says the
 * weapon fires *"not just through the fore arc, but actually on the center line
 * of the ship only"* and a blank arc list cannot mean "no arcs at all".
 */
function bearsForward(weapon: WeaponDef, ctx: FiringContext): boolean {
  if (ctx.arc !== 'F') return false
  return weapon.arcs.length === 0 || weapon.arcs.includes('F')
}

/**
 * 7.23 Spinal Mount Nova Cannon.
 *
 * Needs no FireCon: 5.23 requires one to aim a spinal mount at a point in space,
 * but a Nova Cannon is not aimed at anything — *"the weapon fires in whatever
 * direction the ship's bow is pointing"* — and there is no to-hit roll to
 * direct. Everything the template touches is hit.
 */
export const NOVA_CANNON_SPEC: WeaponSpec = {
  weaponClass: 'nova-cannon',
  label: 'Spinal Mount Nova Cannon',
  // "Damage from a Nova Cannon is Penetrating damage; neither type of screen nor
  // armor has any effect" (7.23). The whole pile is reported as penetrating
  // because that is the only pile combat.ts sends past the outer armour layer;
  // see docs/rules/ew-and-cloaks.md for what that still costs against shell
  // armour (7.7).
  damageMode: 'P',
  maxRange: () => NOVA_TOTAL_RANGE_MU,
  fire(weapon: WeaponDef, ctx: EwFiringContext): WeaponResult | null {
    const stage = ctx.novaStage ?? 1
    const sweep = NOVA_SWEEPS[stage]
    if (!bearsForward(weapon, ctx)) return null
    if (ctx.range < sweep.fromMu || ctx.range > sweep.toMu) return null
    const rolled = rollNovaDamage(stage, ctx.rng)
    return {
      normalDamage: 0,
      penetratingDamage: rolled.damage,
      mode: 'P',
      dice: rolled.faces,
      detail: `Nova Cannon stage ${stage} (${sweep.diameter} MU template): ${sweep.damageDice}D6 ${rolled.faces.join(',')} → ${rolled.damage} penetrating`,
    }
  },
  requiresFireCon: false,
}

/**
 * 7.24 Wave Gun.
 *
 * `ctx.range` is the target's distance along the line of fire, which is the same
 * thing as its range from the firing ship here — unlike the Nova Cannon, the
 * burst *"has a life of only one turn"* and never outlives the shot.
 */
export const WAVE_GUN_SPEC: WeaponSpec = {
  weaponClass: 'wave-gun',
  label: 'Wave Gun',
  // "will ignore Standard Screens and armor" (7.24). Advanced Screens are
  // already in the damage roll as a per-die DRM, so nothing is left for armour
  // to answer; AP is the mode that names armour bypass.
  damageMode: 'AP',
  maxRange: () => WAVE_GUN_RANGE_MU,
  fire(weapon: WeaponDef, ctx: EwFiringContext): WeaponResult | null {
    if (!bearsForward(weapon, ctx)) return null
    const band = waveGunBandAt(ctx.range)
    if (!band) return null
    const screens = ctx.advancedScreenLevel ?? 0
    const rolled = rollWaveGunDamage(band, screens, ctx.rng)
    return {
      normalDamage: 0,
      penetratingDamage: rolled.damage,
      mode: 'AP',
      dice: rolled.faces,
      detail: `Wave Gun ${band.fromMu}-${band.toMu} MU (${band.diameter} MU template): ${band.damageDice}D6 ${rolled.faces.join(',')}${screens > 0 ? ` -${screens}/die` : ''} → ${rolled.damage}`,
    }
  },
  requiresFireCon: false,
}

/** The weapons of 7.23 and 7.24, for the `weapons/index.ts` registry. */
export const EW_WEAPON_SPECS: WeaponSpecTable = {
  'nova-cannon': NOVA_CANNON_SPEC,
  'wave-gun': WAVE_GUN_SPEC,
}

// ---------------------------------------------------------------------------
// 7.25 Reflex Field
// ---------------------------------------------------------------------------

/** What one Reflex Field die did (7.25). */
export type ReflexOutcome =
  /** 1: *"the field has no effect: full damage is applied to the target ship as normal"*. */
  | 'no-effect'
  /** 2: *"the target receives only half the normal damage, rounded up"*. */
  | 'half'
  /** 3–4: *"the field absorbs all the damage and none is applied to the target"*. */
  | 'absorbed'
  /** 5: *"no damage is applied to the target, but half (Rounded up) is reflected back"*. */
  | 'reflect-half'
  /** 6: *"the field reflects the full damage back to the firing ship"*. */
  | 'reflect-full'

/** The 7.25 table, by die face. */
export const REFLEX_FIELD_TABLE: Record<number, ReflexOutcome> = {
  1: 'no-effect',
  2: 'half',
  3: 'absorbed',
  4: 'absorbed',
  5: 'reflect-half',
  6: 'reflect-full',
}

/** What the Reflex Field costs its own ship for the turn (7.25). */
export interface ReflexFieldRestrictions {
  mayFireWeapons: boolean
  mayLaunchOrRecoverFighters: boolean
  mayMoveAndManoeuvre: boolean
}

/**
 * 7.25: *"the carrying ship may not use any weaponry of its own that turn,
 * thought it may move and maneuver normally. Other specialized actions, e.g.
 * launching or recovering fighters, are also prohibited while the field is
 * active."*
 */
export const REFLEX_FIELD_RESTRICTIONS: ReflexFieldRestrictions = {
  mayFireWeapons: false,
  mayLaunchOrRecoverFighters: false,
  mayMoveAndManoeuvre: true,
}

/** How a Reflex Field answered one attack (7.25). */
export interface ReflexFieldResult {
  roll: number
  outcome: ReflexOutcome
  /** Damage that still reaches the target ship. */
  toTarget: number
  /** Damage thrown back at the firing ship. */
  toAttacker: number
  /**
   * 7.25, fighters only: *"On a roll of 5 or 6, each fighter that inflicts any
   * damage is destroyed by the reflected energy."* The caller knows which
   * fighters scored; this only says that the energy came back at them.
   */
  fightersDestroyed: boolean
}

/**
 * Roll the Reflex Field against one attack's damage (7.25).
 *
 * *"roll for hits and damage in the normal way"* first — this takes that total —
 * *"and rolls 1 D6"*. One roll answers one attacking unit's damage: the fighter
 * clause insisting on *"a single D6 for the entire group"* is what fixes the
 * granularity, since a group is many attackers rolling many dice.
 *
 * Halves round **up**, twice stated: *"half the normal damage, rounded up"* and
 * *"half (Rounded up) is reflected back"*.
 */
export function rollReflexField(
  damage: number,
  rng: Rng,
  opts: { fighterGroup?: boolean } = {},
): ReflexFieldResult {
  const roll = d6(rng)
  const outcome = REFLEX_FIELD_TABLE[roll]
  const total = Math.max(0, damage)
  const half = Math.ceil(total / 2)
  const fighters = opts.fighterGroup ?? false

  switch (outcome) {
    case 'no-effect':
      return { roll, outcome, toTarget: total, toAttacker: 0, fightersDestroyed: false }
    case 'half':
      return { roll, outcome, toTarget: half, toAttacker: 0, fightersDestroyed: false }
    case 'absorbed':
      return { roll, outcome, toTarget: 0, toAttacker: 0, fightersDestroyed: false }
    case 'reflect-half':
      // Against a fighter group the reflected energy has no ship to return to,
      // so it lands on the fighters instead: "each fighter that inflicts any
      // damage is destroyed". The target still takes nothing, which is what
      // rolls of 5 and 6 do in the main table.
      return fighters
        ? { roll, outcome, toTarget: 0, toAttacker: 0, fightersDestroyed: true }
        : { roll, outcome, toTarget: 0, toAttacker: half, fightersDestroyed: false }
    case 'reflect-full':
      return fighters
        ? { roll, outcome, toTarget: 0, toAttacker: 0, fightersDestroyed: true }
        : { roll, outcome, toTarget: 0, toAttacker: total, fightersDestroyed: false }
  }
}

/**
 * Whether a weapon is an "energy weapon" for the Reflex Field (7.25).
 *
 * *"'Energy weapon' includes beams, Grasers, fighters, and any other weapon
 * affected by Standard Screens"*, which 7.2 defines from the other end —
 * *"Screens only protect against fire from beams and similar weapons such as
 * Grasers and fighters"*. So the list is read off each weapon's own section and
 * the exceptions are the weapons that say they ignore Standard Screens: EMP
 * projectors (5.4), Pulse Torpedoes (5.14), Submunition Packs (5.15), K-Guns
 * (5.16), MKPs (5.17), Boarding Torpedoes (5.18), Fusion Arrays (5.19), Point
 * Singularity Projectors (5.23), and all ordnance (6.5, 6.7, 6.8) — plus the two
 * superweapons above, which state their own relationship with screens.
 *
 * Fighters are energy attackers too but are not a `WeaponClass`; they reach
 * `rollReflexField` through its `fighterGroup` option.
 */
export function isEnergyWeapon(weaponClass: WeaponClass): boolean {
  return !NON_ENERGY_WEAPONS.has(weaponClass)
}

const NON_ENERGY_WEAPONS: ReadonlySet<WeaponClass> = new Set<WeaponClass>([
  'emp',
  'pulse-torpedo',
  'submunition-pack',
  'k-gun',
  'mkp',
  'boarding-torpedo',
  'fusion-array',
  'spinal-psp',
  'nova-cannon',
  'wave-gun',
  'heavy-missile',
  'salvo-missile-rack',
  'salvo-missile-launcher',
  'antimatter-missile',
  'rocket-pod',
  'plasma-bolt-launcher',
])

// ---------------------------------------------------------------------------
// Mass, points and legality (7.17 – 7.25)
// ---------------------------------------------------------------------------

/**
 * Mass and points for the systems of 7.17 – 7.25, as printed.
 *
 * Fractions are left unrounded, as `defences.ts` leaves screen mass unrounded:
 * how a shipyard rounds is the construction table's business (13, 14), not this
 * module's.
 */
export const EW_COSTS = {
  /** 7.17: *"Holofields require 10% of ships mass. They cost 5 per mass."* */
  holofield: { massFraction: 0.1, pointsPerMass: 5 },
  /** 7.18: *"ECM is 1 mass per level, and costs 3 per mass."* */
  ecm: { massPerLevel: 1, pointsPerMass: 3 },
  /** 7.19: *"Area ECM is 2 mass per level, and costs 3 per mass."* */
  areaEcm: { massPerLevel: 2, pointsPerMass: 3 },
  /** 7.20: *"A standard Cloaking Device is 1 mass … 50% of the ships mass"*. */
  cloakingDevice: { mass: 1, pointsAsShipMassFraction: 0.5 },
  /** 7.21: *"A Cloaking Field is 1 mass. The point cost is equal to the mass of the ship."* */
  cloakingField: { mass: 1, pointsAsShipMassFraction: 1 },
  /** 7.22: *"The mass of the Tuffley Cloak is 10% of the ships mass and cost 10 points per mass."* */
  tuffleyCloak: { massFraction: 0.1, pointsPerMass: 10 },
  /** 7.23: *"A Nova Cannon is 20 mass and costs 60 points"*. */
  novaCannon: { mass: 20, points: 60 },
  /** 7.24: *"A Wave Gun is 12 mass and costs 36 points."* */
  waveGun: { mass: 12, points: 36 },
  /** 7.25: *"A Reflex Field is 10% of the ships mass and costs 6 points per mass"*. */
  reflexField: { massFraction: 0.1, pointsPerMass: 6 },
} as const

/** Mass a cloak of this type costs on a hull of `shipMass` (7.20 – 7.22). */
export function cloakMass(kind: CloakKind, shipMass: number): number {
  if (kind === 'tuffley-cloak') return shipMass * EW_COSTS.tuffleyCloak.massFraction
  return kind === 'cloaking-field' ? EW_COSTS.cloakingField.mass : EW_COSTS.cloakingDevice.mass
}

/**
 * Points a cloak costs on a hull of `shipMass` (7.20 – 7.22).
 *
 * 7.20's own worked example: *"For example a 100 mass ship would pay 50 points
 * for a Cloaking Device."* The Tuffley Cloak lands on the same number as the
 * Cloaking Field — 10% of the hull at 10 points a mass is the hull's mass in
 * points — for ten times the mass, which is the trade 7.22 is offering.
 */
export function cloakPoints(kind: CloakKind, shipMass: number): number {
  switch (kind) {
    case 'cloaking-device':
      return shipMass * EW_COSTS.cloakingDevice.pointsAsShipMassFraction
    case 'cloaking-field':
      return shipMass * EW_COSTS.cloakingField.pointsAsShipMassFraction
    case 'tuffley-cloak':
      return cloakMass(kind, shipMass) * EW_COSTS.tuffleyCloak.pointsPerMass
  }
}

/** A ship's electronic-warfare fit, for the legality checks of 7.17 – 7.20. */
export interface EwFit {
  holofield?: boolean
  /** Standard or Advanced screen level (7.2, 7.3). */
  screenLevel?: number
  /** Covered by a friendly Area Screen (7.16) — also "field technology". */
  areaScreen?: boolean
  /** Stealth *Field* level (7.5). A Stealth *Hull* (7.4) is neither screen nor field. */
  stealthFieldLevel?: number
  ecmLevel?: number
  areaEcmLevel?: number
  cloak?: CloakKind | null
}

/**
 * Fit legality (7.17, 7.18, 7.19, 7.20). Returns one string per violation, so a
 * ship designer can show them all at once; an empty array is a legal fit.
 *
 * A Stealth *Hull* is deliberately not a violation: 7.17 bars *"other screen or
 * field technology"* and a hull treatment is neither. 7.20 bars a cloak
 * *"combined with any fields or screens"* and then separately says the ship gets
 * no stealth benefit while cloaked — which would be a strange thing to write if
 * the hull could not be there at all.
 */
export function validateEwFit(fit: EwFit): string[] {
  const problems: string[] = []
  const screens = (fit.screenLevel ?? 0) > 0 || (fit.areaScreen ?? false)
  const stealthField = (fit.stealthFieldLevel ?? 0) > 0

  if (fit.holofield && (screens || stealthField || fit.cloak)) {
    problems.push('7.17: "Holofields cannot be combined with other screen or field technology"')
  }
  if (fit.cloak && (screens || stealthField || fit.holofield)) {
    problems.push('7.20: "The Cloaking Device may not be combined with any fields or screens"')
  }
  const ecm = (fit.ecmLevel ?? 0) + (fit.areaEcmLevel ?? 0)
  if (ecm > MAX_AGGREGATE_ECM_LEVEL) {
    problems.push(
      `7.18: "The aggregate ECM level of a ship (its own plus any Area ECM) cannot exceed 3" — this fit is ${ecm}`,
    )
  }
  return problems
}

// ---------------------------------------------------------------------------
// Bannable systems
// ---------------------------------------------------------------------------

/**
 * One optional system a group may switch off (7.20 – 7.25).
 *
 * The rulebook asks for exactly this before 7.23: *"We strongly recommend that
 * these systems are used with discretion, and then only with the express
 * agreement of all players. They are not recommended for games where there is any
 * kind of competitive element in play or in fleet design."*
 */
export interface BannableSystem {
  /** `SystemKind` for the defensive fits, `WeaponClass` for the two guns. */
  id: string
  label: string
  /** The rule that defines it, e.g. "7.23". */
  rule: string
  /** Banned by the campaign these rules are played under, unless told otherwise. */
  bannedInCampaign: boolean
  why: string
}

/**
 * Every system in this module a scenario or campaign may switch off, each
 * individually toggleable (7.20 – 7.25).
 *
 * Nothing here bans anything on its own: a scenario passes the set it wants to
 * `isSystemBanned`. The campaign layer's own list
 * (`campaign/turn.ts` `CAMPAIGN_BANNED_SYSTEMS`) uses the same three ids, which
 * is why they are `SystemKind`/`WeaponClass` strings rather than a private
 * enumeration.
 */
export const BANNABLE_SYSTEMS: readonly BannableSystem[] = [
  {
    id: 'cloaking-device',
    label: 'Cloaking Device',
    rule: '7.20',
    bannedInCampaign: false,
    why: 'The partial cloak: the ship stays on the table and can still be shot at.',
  },
  {
    id: 'cloaking-field',
    label: 'Cloaking Field',
    rule: '7.21',
    bannedInCampaign: true,
    why: 'Total invisibility with no counter-play: the model leaves the table for a declared number of turns.',
  },
  {
    id: 'tuffley-cloak',
    label: 'Tuffley Cloak',
    rule: '7.22',
    bannedInCampaign: false,
    why: '7.22: "included here for those players wishing to use the original rules … should do so with caution".',
  },
  {
    id: 'nova-cannon',
    label: 'Spinal Mount Nova Cannon',
    rule: '7.23',
    bannedInCampaign: false,
    why: '7.23: "probably the single most deadly system available" — 6D6 penetrating through everything on its line.',
  },
  {
    id: 'wave-gun',
    label: 'Wave Gun',
    rule: '7.24',
    bannedInCampaign: true,
    why: 'A 36 MU line attack that ignores standard screens and armour, chargeable in advance.',
  },
  {
    id: 'reflex-field',
    label: 'Reflex Field',
    rule: '7.25',
    bannedInCampaign: true,
    why: 'Returns a beam volley to its sender on a 5 or 6, which no other system in the game can answer.',
  },
]

/**
 * The three the campaign bans by default — the same ids and the same order as
 * `campaign/turn.ts` `CAMPAIGN_BANNED_SYSTEMS`, derived from
 * `BANNABLE_SYSTEMS` so the two cannot drift apart.
 */
export const DEFAULT_CAMPAIGN_BANS: readonly string[] = BANNABLE_SYSTEMS.filter(
  (system) => system.bannedInCampaign,
).map((system) => system.id)

/** Whether a scenario's ban list forbids this system id. */
export function isSystemBanned(id: string, bans: Iterable<string>): boolean {
  for (const banned of bans) if (banned === id) return true
  return false
}
