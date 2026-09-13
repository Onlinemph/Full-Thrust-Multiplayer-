/**
 * Full Thrust: Project Continuum — ordnance (section 6).
 *
 * Every other weapon in the game is fired and resolved inside one phase. A
 * missile is not: it is **launched in phase 3**, sits on the table as a marker
 * while **ships move in phase 5**, **finds a target in phase 7**, is **shot at
 * in phase 9** and only **attacks in phase 10** (2.6). The marker therefore
 * outlives every phase that touches it, which is why this module owns a state
 * object — `MissileMarker` — where the beam weapons own none.
 *
 * The functions below are named for what they do and their JSDoc says which
 * phase calls them, so `game.ts` can hang each one on the right hook of the
 * sequence of play without this module knowing anything about game state.
 *
 * Rules are written out in full in `docs/rules/ordnance.md`.
 *
 * As with the direct-fire weapons, nothing here applies damage to a ship:
 * an attack returns a `WeaponResult` and `combat.applyDamage` decides where
 * it lands, because that depends on the target's armour and hull, not on the
 * missile (4.9).
 */

import {
  d6,
  pointDefenceKills,
  rollBeamVolley,
  rollD6,
  type PdMode,
  type Rng,
  type ScreenLevel,
} from './dice'
import { advancedScreenDamageDie, stealthMaxRange, type StealthLevel } from './defences'
import { arcTo, bearing, bearsOn, distance, incomingArc, normaliseCourse } from './geometry'
import type { Arc, Course, Point, WeaponClass, WeaponVariant } from './types'
import type { WeaponResult, WeaponSpec, WeaponSpecTable } from './weapons/contract'

// ---------------------------------------------------------------------------
// Small tools the spine does not carry
// ---------------------------------------------------------------------------

/**
 * One D3, for rocket (6.7) and shaped-charge plasma bolt (6.8) damage.
 *
 * `dice.ts` has no D3 because nothing in sections 4 and 5 needs one. Rolled
 * the way it is rolled at the table: a D6 halved and rounded up, so 1-2 → 1,
 * 3-4 → 2, 5-6 → 3. Reported as the D6 face so the battle log can show the
 * die that was actually thrown.
 */
export function d3(rng: Rng): { face: number; value: number } {
  const face = d6(rng)
  return { face, value: Math.ceil(face / 2) }
}

/**
 * The clock facing nearest to the direction `from` → `to` (6.6).
 *
 * A multi-stage missile marker *"has a facing, which must be the nearest clock
 * facing to the direction from the launching ship to the missile marker"*, and
 * the next turn's 60-degree front arc is measured off it.
 */
export function nearestCourse(from: Point, to: Point): Course {
  return normaliseCourse(Math.round(bearing(from, to) / 30))
}

/**
 * Shortest distance from a point to a line segment.
 *
 * 6.9 fires a mine at every ship that enters its radius *"at any point during
 * movement, not just at the end of a move"*, so the mine test is against the
 * ship's whole path and not against where it stopped. `geometry.ts` measures
 * point to point only.
 */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return distance(point, a)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy })
}

/** Shortest distance from a point to a path of one or more legs (3.4, 6.9). */
export function distanceToPath(point: Point, path: readonly Point[]): number {
  if (path.length === 0) return Infinity
  if (path.length === 1) return distance(point, path[0])
  let best = Infinity
  for (let i = 1; i < path.length; i++) {
    best = Math.min(best, distanceToSegment(point, path[i - 1], path[i]))
  }
  return best
}

// ---------------------------------------------------------------------------
// The numbers (6.2 – 6.10)
// ---------------------------------------------------------------------------

/** 6.2: *"Normally there are six missiles in one salvo"*. */
export const SALVO_SIZE = 6

/** 6.3: the point of aim may be *"up to a maximum range of 24 MU"*. */
export const MISSILE_RANGE_STANDARD = 24

/** 6.3: *"or 36 MU for extended range missiles"*. */
export const MISSILE_RANGE_EXTENDED = 36

/** 6.6: *"The extra stage increases the range by 24 MU"*. */
export const MULTI_STAGE_RANGE_BONUS = 24

/** 6.6: a two-stage marker is placed *"between 16 and 24 MU"* every turn. */
export const MULTI_STAGE_MIN_LEG = 16
export const MULTI_STAGE_MAX_LEG = 24

/** 6.6: the antimatter *"rack has 3-arc coverage, with a range of 18 MU"*. */
export const ANTIMATTER_RANGE = 18

/** 6.3: *"an enemy ship within 6 MU of the marker (in any direction)"*. */
export const MISSILE_ATTACK_RADIUS = 6

/** 6.3 optional: *"only within 3 MU of a vector drive ship"*. */
export const VECTOR_MISSILE_ATTACK_RADIUS = 3

/** 6.6: *"Three hits will disrupt the warhead"*. */
export const ANTIMATTER_HITS_TO_KILL = 3

/** 6.6: 3D6 at ground zero, and the blast reaches 3 MU. */
export const ANTIMATTER_WARHEAD_DICE = 3
export const ANTIMATTER_BLAST_RADIUS = 3

/** 6.6: a fused missile in free flight may be shot at *"within 3 MU range"*. */
export const ANTIMATTER_FREE_FLIGHT_RANGE = 3

/** 6.7: *"The Rocket Pod fires TWO rockets at the target ship."* */
export const ROCKETS_PER_POD = 2

/** 6.7: the to-hit table, longest band last. */
export const ROCKET_POD_TO_HIT: ReadonlyArray<{ range: number; hitsOn: number }> = [
  { range: 6, hitsOn: 2 },
  { range: 12, hitsOn: 3 },
  { range: 18, hitsOn: 4 },
]

/** 6.7: *"Rocket Pods can be fired at gunboats. They suffer a -1 DRM"*. */
export const ROCKET_POD_GUNBOAT_DRM = -1

/** 6.8: a detonation point *"out to a range of 30 MU"*. */
export const PLASMA_BOLT_RANGE = 30

/** 6.8: *"PBLs explode with a blast radius of 6 MU (12 MU diameter)"*. */
export const PLASMA_BOLT_BLAST_RADIUS = 6

/** 6.8: *"a PBL may only fire every other turn"*. */
export const PLASMA_BOLT_FIRE_INTERVAL = 2

/** 6.8: *"one 1 launcher per 50 mass of ship"*. */
export const PLASMA_BOLT_MASS_PER_LAUNCHER = 50

/** 6.8: *"PDS fire suffers a -2 DRM, so they only score hits on a die roll of a 6"*. */
export const PLASMA_BOLT_PDS_DRM = -2

/** 6.8: fighters may engage a bolt *"if they are within 6 MU"*. */
export const PLASMA_BOLT_FIGHTER_RANGE = 6

/** 6.9: *"The detection range of a mine is 3 MU."* */
export const MINE_DETECTION_RADIUS = 3

/** 6.9: *"Roll 4D6 and apply damage as for normal beam fire"*. */
export const MINE_ATTACK_DICE = 4

// ---------------------------------------------------------------------------
// Markers (6.3, 6.6, 6.7)
// ---------------------------------------------------------------------------

/** The ordnance families that leave a marker on the table (6.3, 6.7 – 6.9). */
export type OrdnanceKind = 'salvo' | 'heavy' | 'antimatter' | 'rocket' | 'plasma-bolt' | 'mine'

/** 6.2: *"There are two grades of missile available: standard and extended range"*. */
export type MissileGrade = 'standard' | 'extended'

/**
 * A missile, salvo or rocket marker in flight (6.3).
 *
 * Side ids are plain strings so this module never has to import the game
 * state; `game.ts` uses the same convention.
 */
export interface MissileMarker {
  id: string
  /** The side that launched it (6.3). */
  owner: string
  sourceShipId: string
  /** The launcher this came out of, so a rack can be crossed off (6.6). */
  sourceWeaponId?: string
  kind: 'salvo' | 'heavy' | 'antimatter' | 'rocket'
  grade: MissileGrade
  /**
   * Missiles left on the marker. Six for a full salvo (6.2); one for a Heavy
   * or antimatter missile, which are *"fired individually"*; one or two for a
   * rocket pod's hits (6.7).
   */
  missiles: number
  position: Point
  /**
   * The marker's facing. Only a multi-stage marker uses it — the next leg must
   * lie *"within the 60° front arc of the marker"* (6.6) — but every marker
   * carries one so the type does not fork.
   */
  facing: Course
  launchedTurn: number
  /** MU flown since launch, against the mount's total range (6.3, 6.6). */
  rangeFlown: number
  /**
   * Turns of flight left (6.6 *"duration"*). One for an ordinary missile: it
   * seeks once and, finding nothing, is *"removed from play"* (6.3). Two for a
   * two-stage missile, whose extra stage *"increases the … 'duration' by 1
   * turn"*.
   */
  endurance: number
  /** Stages left to fly, so a two-stage marker knows it may re-aim (6.6). */
  stagesRemaining: number
  /** Point-defence hits taken. Only an antimatter warhead survives one (6.6). */
  hits: number
  /** Set in phase 7 once the marker has found something to attack (6.3). */
  targetShipId: string | null
  /**
   * 6.7: a rocket *"hit[s] in the arc visible at the moment of launch. This
   * will affect which defensive weapons are in arc."* Stored as the arc of the
   * **target** the rockets are sitting in.
   */
  attackArc?: Arc
  /**
   * 8.15: a Light Missile Fighter *"must mount a light missile instead. The
   * light missile is more easily destroyed, and so all PDS or fighter attacks
   * against light missiles are at +1 to the die roll."*
   *
   * Only a fighter salvo can be light, and only markers carry it, so it is
   * optional: an ordinary launcher never sets it.
   */
  light?: boolean
}

/** A mine marker on the table (6.9, 6.10). */
export interface MineMarker {
  id: string
  owner: string
  sourceShipId: string
  position: Point
  /** 6.10: a mine is inert until *"the game turn after"* the one it was laid in. */
  laidTurn: number
}

// ---------------------------------------------------------------------------
// Screens against ordnance (6.5, 6.8, 7.3)
// ---------------------------------------------------------------------------

/**
 * The screens a target has up, as ordnance sees them (6.5, 7.3).
 *
 * Missiles care about two different things: standard screens do nothing at all
 * to them, while Advanced Screens subtract from every damage die. A plasma
 * bolt is the other way round — 6.8 gives *"each level of screen (2 maximum)"*
 * a −1 whether the screen is advanced or not.
 */
export interface OrdnanceScreens {
  level: ScreenLevel
  /** 7.3: Advanced Screens *"also protect against … missiles"*. */
  advanced: boolean
}

/**
 * The DRM Advanced Screens put on each missile damage die (6.5, 7.3).
 *
 * 6.5: *"Standard Screens have no effect on missiles. Advanced level-1 Screens
 * subtract 1 from each damage roll, Advanced level-2 Screens subtract 2."*
 */
export function missileScreenDrm(screens: OrdnanceScreens): number {
  if (!screens.advanced || screens.level === 0) return 0
  return -screens.level
}

/**
 * The DRM screens put on each plasma bolt damage die (6.8).
 *
 * 6.8 names no screen type — *"Each level of screen (2 maximum) provides a -1
 * DRM to each die of plasma damage"* — so standard screens count here where
 * they would not against a missile.
 */
export function plasmaScreenDrm(screens: OrdnanceScreens): number {
  if (screens.level === 0) return 0
  return -screens.level
}

/** Sum a handful of damage dice under a per-die DRM, flooring each at zero. */
function damageFromDice(faces: readonly number[], drm: number): number {
  // 7.3: "Negative damage is treated as zero; the target ship cannot regain
  // damage points!" — so the floor is per die, not on the total.
  return faces.reduce((total, face) => total + Math.max(0, face + drm), 0)
}

// ---------------------------------------------------------------------------
// Phase 3 — launching missiles (6.3, 6.6)
// ---------------------------------------------------------------------------

/** Why a launch could not be made (6.3, 6.6). */
export type LaunchRefusal =
  | 'out-of-arc'
  | 'out-of-range'
  /** 6.6: a two-stage marker must go *"at least 16 MU each turn"*. */
  | 'inside-minimum-range'
  /** 6.3: the aim point is *"obstructed by any asteroids, planets…"*. */
  | 'obstructed'
  /** 6.3: *"An operational FireCon is necessary to launch"*. */
  | 'no-firecon'
  | 'no-ammunition'
  /** 6.6: extended range missiles may not be multi-stage. */
  | 'er-cannot-be-multi-stage'
  /** 6.6: a two-stage marker has no stages left to fly. */
  | 'no-stages-left'

/** Where the launching ship is and which way it points (6.3). */
export interface LaunchOrigin {
  position: Point
  facing: Course
}

/** One launch order, written in phase 3 (6.3). */
export interface MissileLaunchRequest {
  /** Id for the marker this will create. */
  id: string
  owner: string
  sourceShipId: string
  sourceWeaponId?: string
  kind: 'salvo' | 'heavy' | 'antimatter'
  grade: MissileGrade
  /** 1, or 2 for the optional multi-stage missile (6.6). */
  stages?: 1 | 2
  origin: LaunchOrigin
  /** 6.6: *"All missiles have 3 arcs"* — which three is the mounting's business. */
  arcs: readonly Arc[]
  /** The intended point of aim (6.3). */
  aim: Point
  turn: number
  /** Missiles on the marker; a full salvo is six (6.2). */
  missiles?: number
  obstructed?: boolean
  /**
   * FireCons still unspent this phase (5.2, 6.3). 5.2 counts them *"per phase,
   * not per turn"*, so a FireCon spent launching is free again in phase 11.
   */
  fireConsAvailable: number
}

export interface MissileLaunchResult {
  marker: MissileMarker | null
  refusal: LaunchRefusal | null
  /** 5.2: one FireCon per launch, or none when the launch was refused. */
  fireConsSpent: number
  detail: string
}

/**
 * Longest range at which a missile's point of aim may be placed (6.3, 6.6).
 *
 * A two-stage missile is capped at its 24 MU leg on the turn it is fired even
 * though its total range is 48 MU: 6.6 places the first marker *"between 16 and
 * 24 MU from the launching ship"* and only the following turn adds the rest.
 */
export function missileLaunchRange(
  kind: 'salvo' | 'heavy' | 'antimatter',
  grade: MissileGrade,
  stages = 1,
): number {
  if (kind === 'antimatter') return ANTIMATTER_RANGE
  if (stages > 1) return MULTI_STAGE_MAX_LEG
  return grade === 'extended' ? MISSILE_RANGE_EXTENDED : MISSILE_RANGE_STANDARD
}

/** Total distance a missile may fly over its whole life (6.3, 6.6). */
export function missileTotalRange(
  kind: 'salvo' | 'heavy' | 'antimatter',
  grade: MissileGrade,
  stages = 1,
): number {
  const base = missileLaunchRange(kind, grade, 1)
  return base + (stages - 1) * MULTI_STAGE_RANGE_BONUS
}

/**
 * Launch one missile or salvo — **phase 3** (6.3).
 *
 * The marker goes down at the point of aim and stays there: 6.3 is explicit
 * that *"the missile salvo marker is left in place while all ships are
 * moved"*. Nothing about the target is known yet, and deliberately so — the
 * seeker only looks around in phase 7.
 */
export function launchMissile(request: MissileLaunchRequest): MissileLaunchResult {
  const stages = request.stages ?? 1
  const refuse = (refusal: LaunchRefusal, detail: string): MissileLaunchResult => ({
    marker: null,
    refusal,
    fireConsSpent: 0,
    detail,
  })

  if (stages > 1 && request.grade === 'extended') {
    // 6.6: "Only standard missiles may be multistage, not ER".
    return refuse('er-cannot-be-multi-stage', 'ER missiles may not be multi-stage')
  }
  if (request.fireConsAvailable < 1) {
    return refuse('no-firecon', 'no operational FireCon left this phase')
  }
  if (request.obstructed) return refuse('obstructed', 'the point of aim is obstructed')

  const range = distance(request.origin.position, request.aim)
  const maxRange = missileLaunchRange(request.kind, request.grade, stages)
  if (range > maxRange) {
    return refuse('out-of-range', `${range.toFixed(1)} MU exceeds the ${maxRange} MU launch range`)
  }
  if (stages > 1 && range < MULTI_STAGE_MIN_LEG) {
    return refuse(
      'inside-minimum-range',
      `a two-stage missile must be aimed at least ${MULTI_STAGE_MIN_LEG} MU out`,
    )
  }

  const arc = arcTo(request.origin.position, request.origin.facing, request.aim)
  if (!bearsOn(request.arcs, arc)) {
    return refuse('out-of-arc', `the point of aim lies in the ${arc} arc`)
  }

  const marker: MissileMarker = {
    id: request.id,
    owner: request.owner,
    sourceShipId: request.sourceShipId,
    sourceWeaponId: request.sourceWeaponId,
    kind: request.kind,
    grade: request.grade,
    missiles: request.missiles ?? (request.kind === 'salvo' ? SALVO_SIZE : 1),
    position: request.aim,
    facing: nearestCourse(request.origin.position, request.aim),
    launchedTurn: request.turn,
    rangeFlown: range,
    // 6.6: the extra stage adds a turn of duration; everything else gets the
    // one turn 6.3 allows it before the launch is "wasted".
    endurance: stages,
    stagesRemaining: stages - 1,
    hits: 0,
    targetShipId: null,
  }
  return {
    marker,
    refusal: null,
    fireConsSpent: 1,
    detail: `${request.kind} missile marker placed ${range.toFixed(1)} MU out in the ${arc} arc`,
  }
}

/**
 * Fly a two-stage marker's second leg — **phase 3 of a later turn** (6.6).
 *
 * 6.6: *"in the Missile Launch Phase of the following turn the missile marker
 * is placed at the intended point of aim, anywhere from 16 to 24 MU within the
 * 60° front arc of the marker."* The 60-degree front arc of the marker is
 * exactly `geometry.arcTo(...) === 'F'`, which is why the marker carries a
 * facing at all.
 *
 * No FireCon is spent: 6.3 requires one to *launch*, and this missile is
 * already in flight.
 */
export function relocateMultiStageMarker(
  marker: MissileMarker,
  aim: Point,
): { marker: MissileMarker | null; refusal: LaunchRefusal | null; detail: string } {
  if (marker.stagesRemaining < 1) {
    return { marker: null, refusal: 'no-stages-left', detail: 'the missile has no stage left' }
  }
  const leg = distance(marker.position, aim)
  if (leg < MULTI_STAGE_MIN_LEG) {
    return {
      marker: null,
      refusal: 'inside-minimum-range',
      detail: `a multi-stage missile "must always be moved at least ${MULTI_STAGE_MIN_LEG} MU each turn"`,
    }
  }
  if (leg > MULTI_STAGE_MAX_LEG) {
    return {
      marker: null,
      refusal: 'out-of-range',
      detail: `${leg.toFixed(1)} MU exceeds the ${MULTI_STAGE_MAX_LEG} MU leg`,
    }
  }
  if (arcTo(marker.position, marker.facing, aim) !== 'F') {
    return {
      marker: null,
      refusal: 'out-of-arc',
      detail: 'the point of aim lies outside the marker’s 60° front arc',
    }
  }
  return {
    marker: {
      ...marker,
      position: aim,
      // The last leg's direction becomes the new facing. 6.6 only defines a
      // facing at launch because only one extra stage exists, but keeping it
      // pointed the way it is travelling is what the rule does on turn one.
      facing: nearestCourse(marker.position, aim),
      rangeFlown: marker.rangeFlown + leg,
      stagesRemaining: marker.stagesRemaining - 1,
    },
    refusal: null,
    detail: `two-stage marker flies a further ${leg.toFixed(1)} MU`,
  }
}

// ---------------------------------------------------------------------------
// Phase 5 — markers hold station, mines are laid and detonate (6.3, 6.9, 6.10)
// ---------------------------------------------------------------------------

/**
 * Move ordnance markers during ship movement — **phase 5** (6.3).
 *
 * They do not move. 6.3: *"The missile salvo marker is left in place while all
 * ships are moved."* The only marker that ever changes position between
 * launch and attack is the multi-stage one, and it does so in phase 3 of the
 * following turn (`relocateMultiStageMarker`), not here.
 *
 * The function exists so the sequence of play has a hook to call at phase 5 and
 * so the rule is written down somewhere other than a comment; it copies the
 * markers rather than returning the same array, to keep the phase pure.
 */
export function moveOrdnanceMarkers(markers: readonly MissileMarker[]): MissileMarker[] {
  return markers.map((marker) => ({ ...marker }))
}

/** One mine the player has asked to drop this turn (6.10). */
export interface MinelayingRequest {
  id: string
  owner: string
  sourceShipId: string
  /** Anywhere along the ship's course this turn (6.10). */
  position: Point
  turn: number
}

export interface MinelayingResult {
  mines: MineMarker[]
  /** Loads left in the minelayer's magazine after the drop (6.10). */
  loadsRemaining: number
  refused: number
  detail: string
}

/**
 * Drop mines during the ship's own movement — **phase 5** (6.10).
 *
 * 6.10: *"Each minelayer system fitted may deploy one mine per turn, so a ship
 * with two mine systems may drop two markers during its movement"*, and *"Ships
 * dropping mines are moved first"* so the drop cannot answer the enemy's move.
 * Both limits are the caller's to enforce in the order it moves ships; what is
 * enforced here is the magazine: *"as each one is deployed, cross out one load
 * on the minelayer magazine symbol."*
 *
 * `layers` is the number of minelayer systems still working, which caps the
 * drops at one each.
 */
export function layMines(
  requests: readonly MinelayingRequest[],
  opts: { layers: number; loads: number },
): MinelayingResult {
  const allowed = Math.max(0, Math.min(requests.length, opts.layers, opts.loads))
  const mines = requests.slice(0, allowed).map<MineMarker>((request) => ({
    id: request.id,
    owner: request.owner,
    sourceShipId: request.sourceShipId,
    position: request.position,
    laidTurn: request.turn,
  }))
  return {
    mines,
    loadsRemaining: opts.loads - mines.length,
    refused: requests.length - mines.length,
    detail: `${mines.length} mine marker(s) laid, ${opts.loads - mines.length} load(s) left`,
  }
}

/**
 * Whether a mine will go off yet (6.10).
 *
 * 6.10: *"A mine marker does not become active until the game turn after the
 * one in which it is deployed."*
 */
export function mineIsActive(mine: MineMarker, turn: number): boolean {
  return turn > mine.laidTurn
}

/** A ship's movement this turn, as the mine rules see it (3.4, 6.9). */
export interface MovementTrack {
  shipId: string
  owner: string
  /** Start, any mid-move turn point, and end — the legs of the move (3.4). */
  path: readonly Point[]
}

export interface MineTrigger {
  mineId: string
  shipId: string
  /** Closest approach in MU, for the log. */
  approach: number
}

/**
 * Which mines a turn's movement sets off — **phase 5** (6.9).
 *
 * 6.9: *"All enemy vessels that enter the radius from the mine marker, at any
 * point during movement, not just at the end of a move, will be detected and
 * fired on by the mine."* So the test is against the whole path, and a ship
 * that passes through the radius and out the other side still gets shot at.
 *
 * A mine fires once and is then gone — *"After a mine has detonated, remove its
 * marker from the table at the end of the movement phase"* — so each mine
 * appears at most once in the result, against the ship that came closest.
 */
export function minesTriggeredBy(
  mines: readonly MineMarker[],
  tracks: readonly MovementTrack[],
  turn: number,
): MineTrigger[] {
  const triggers: MineTrigger[] = []
  for (const mine of mines) {
    if (!mineIsActive(mine, turn)) continue
    let best: MineTrigger | null = null
    for (const track of tracks) {
      if (track.owner === mine.owner) continue // 6.9: "All enemy vessels"
      const approach = distanceToPath(mine.position, track.path)
      if (approach > MINE_DETECTION_RADIUS) continue
      if (!best || approach < best.approach) {
        best = { mineId: mine.id, shipId: track.shipId, approach }
      }
    }
    if (best) triggers.push(best)
  }
  return triggers
}

/**
 * Resolve one mine's detonation — **phase 5** (6.9).
 *
 * 6.9: *"Roll 4D6 and apply damage as for normal beam fire, reducing
 * accordingly if the target is screened."* Taken literally, so the dice are
 * penetrating: a beam's natural 6 re-rolls (4.6) and 6.9 calls the warhead *"a
 * focused pulse of energy … similar damage to a close range hit from a beam
 * weapon"*. A mine is a beam, and beams in this game penetrate.
 */
export function resolveMineAttack(screens: ScreenLevel, rng: Rng): WeaponResult {
  const volley = rollBeamVolley(MINE_ATTACK_DICE, screens, rng, { penetrating: true })
  return {
    normalDamage: volley.normalDamage,
    penetratingDamage: volley.penetratingDamage,
    mode: 'P',
    dice: volley.dice.map((die) => die.natural),
    detail:
      `Mine ${MINE_ATTACK_DICE}D6: ${volley.dice.map((die) => die.natural).join(',')} → ` +
      `${volley.normalDamage} damage, ${volley.penetratingDamage} penetrating`,
  }
}

/**
 * Take a mine off the table (6.9, 6.10).
 *
 * Used both for a mine that has just detonated — *"remove its marker from the
 * table at the end of the movement phase"* — and for one *"cleared by a
 * minesweeping system"*. The sweeper's own range and die roll are nowhere in
 * the rulebook extract, so nothing is rolled here; see `docs/rules/ordnance.md`.
 */
export function clearMine(mines: readonly MineMarker[], mineId: string): MineMarker[] {
  return mines.filter((mine) => mine.id !== mineId)
}

// ---------------------------------------------------------------------------
// Phase 7 — the seeker (6.3)
// ---------------------------------------------------------------------------

/** A ship a missile marker might home on (6.3). */
export interface SeekerTarget {
  id: string
  owner: string
  position: Point
  /**
   * 6.3 optional: against a vector-movement ship the attack radius drops to
   * 3 MU, *"even in a scenario that calls for the mixing of vector and
   * cinematic movement ships"*, so the radius belongs to the target.
   */
  vectorMovement?: boolean
  /**
   * 7.4: *"The reduction of effective range also applies to missile lock-on
   * range."* A Stealth-1 hull is found only inside 5 MU, a Stealth-2 hull only
   * inside 4 — and 3 MU shrinks the same way under vector movement.
   */
  stealth?: StealthLevel
  /**
   * The radius electronic warfare leaves for a seeker (7.17 – 7.20), before
   * stealth scales it: a Holofield takes 1 MU, each ECM level takes 1 MU, and
   * `null` is 7.20's *"Missiles and fighters will not lock at all"*. Left
   * undefined the plain 6 MU (or 3 under vector) stands.
   */
  lockOn?: number | null
}

export interface Acquisition {
  markerId: string
  targetShipId: string
  /** Range at which the seeker found it, before the marker is moved in. */
  range: number
}

export interface AcquisitionResult {
  /** Markers still in play, with `targetShipId` and position updated. */
  markers: MissileMarker[]
  /** Markers whose launch was wasted and which leave the table (6.3). */
  removed: MissileMarker[]
  acquisitions: Acquisition[]
  detail: string[]
}

/**
 * The radius within which this target may be attacked (6.3, 7.4, 7.17 – 7.20),
 * or `null` when no seeker can lock on it at all.
 *
 * The order matters and follows the direct-fire stack: electronic warfare
 * subtracts its MU from the plain radius first, and stealth scales what is
 * left, so a Holofield ship is found at 5 MU and a Stealth-1 Holofield ship at
 * 4.17.
 */
export function attackRadiusFor(target: SeekerTarget): number | null {
  const base = target.vectorMovement ? VECTOR_MISSILE_ATTACK_RADIUS : MISSILE_ATTACK_RADIUS
  const afterEw = target.lockOn === undefined ? base : target.lockOn
  if (afterEw === null) return null
  return stealthMaxRange(afterEw, target.stealth ?? 0)
}

/**
 * Point every marker at the closest enemy ship — **phase 7** (6.3).
 *
 * 6.3: *"If after ship movement there is an enemy ship within 6 MU of the
 * marker (in any direction) then the missile(s) will attack it. If there is
 * more than one potential enemy target within 6 MU then the missiles will go
 * for the closest of them."* The owner gets no say: the seeker takes the
 * closest, and if two are exactly equidistant the first in the list wins,
 * which is as arbitrary as the table's own tie-break.
 *
 * A marker that finds nothing spends one turn of endurance. For an ordinary
 * missile that is its only turn — *"the missile launch was wasted and the
 * marker is removed from play"* — while a two-stage missile *"is not removed"*
 * and waits to be re-aimed in phase 3 (6.6).
 *
 * A rocket marker never seeks: 6.7 places it *"next to the ship"* it was fired
 * at, and it keeps that target.
 */
export function acquireMissileTargets(
  markers: readonly MissileMarker[],
  targets: readonly SeekerTarget[],
  opts: { hostile?: (marker: MissileMarker, target: SeekerTarget) => boolean } = {},
): AcquisitionResult {
  const hostile = opts.hostile ?? ((marker, target) => marker.owner !== target.owner)
  const kept: MissileMarker[] = []
  const removed: MissileMarker[] = []
  const acquisitions: Acquisition[] = []
  const detail: string[] = []

  for (const marker of markers) {
    if (marker.kind === 'rocket') {
      kept.push({ ...marker })
      continue
    }
    let best: { target: SeekerTarget; range: number } | null = null
    for (const target of targets) {
      if (!hostile(marker, target)) continue
      const radius = attackRadiusFor(target)
      if (radius === null) continue
      const range = distance(marker.position, target.position)
      if (range > radius) continue
      if (!best || range < best.range) best = { target, range }
    }
    if (best) {
      // 6.3: "Move the missile marker next to the target ship". Adjacency has
      // no further effect in the rules, so the marker is simply put on it.
      kept.push({ ...marker, targetShipId: best.target.id, position: best.target.position })
      acquisitions.push({ markerId: marker.id, targetShipId: best.target.id, range: best.range })
      detail.push(`${marker.id} locks on ${best.target.id} at ${best.range.toFixed(1)} MU`)
      continue
    }
    const endurance = marker.endurance - 1
    if (endurance > 0) {
      kept.push({ ...marker, endurance, targetShipId: null })
      detail.push(`${marker.id} finds nothing and flies on (${endurance} turn(s) of flight left)`)
    } else {
      removed.push({ ...marker, endurance: 0, targetShipId: null })
      detail.push(`${marker.id} finds no target within range — launch wasted`)
    }
  }
  return { markers: kept, removed, acquisitions, detail }
}

// ---------------------------------------------------------------------------
// Phase 9 — point defence against missiles (6.4)
// ---------------------------------------------------------------------------

/**
 * One point-defence weapon (or group of fighters) shooting at one marker (6.4).
 *
 * 6.4 makes the allocation a decision taken *"first"*, before any dice: *"the
 * defending player must first decide what defenses to allocate against each
 * Heavy Missile or Salvo Missile marker."* The engine therefore takes the
 * allocation as input and only rolls.
 */
export interface PointDefenceAllocation {
  /** The firing system or fighter group, so fighter losses can be attributed. */
  sourceId: string
  mode: PdMode
  /** Dice this entry rolls. A full fighter group rolls six (6.4). */
  dice: number
  /** 5.16: a K-1 point-defends *"like a Beam-1 … but with a -1 DRM"*. */
  drm?: number
}

export interface MissilePointDefenceInput {
  marker: MissileMarker
  allocations: readonly PointDefenceAllocation[]
  /**
   * Kills already scored by systems that roll their own way and are resolved
   * elsewhere: a scattergun's flat *"1d6 hits"* (7.14), or a flak barrage's
   * hits carried over from phase 3 (5.16).
   */
  preKills?: number
  /**
   * DRM on the salvo's lock-on die. Missile fighters *"roll a D6 and subtract 1
   * for each fighter that was destroyed prior to launch"* (8.15).
   */
  lockOnDrm?: number
  rng: Rng
}

export interface MissilePointDefenceResult {
  /** The marker after defensive fire: missiles left, hits taken. */
  marker: MissileMarker
  /** 6.4: the attacker's D6, *"the number of missiles … actually on target"*. */
  lockOn: number | null
  kills: number
  /** Missiles that get through to attack in phase 10 (6.4). */
  hits: number
  /** True when a Heavy or antimatter missile was stopped outright (6.4, 6.6). */
  destroyed: boolean
  /** 6.4: fighters lost to the extra D6 rolled for each kill they scored. */
  fighterLosses: Array<{ sourceId: string; lost: number }>
  dice: number[]
  detail: string
}

/**
 * Roll one allocation's point-defence dice (6.4).
 *
 * With no DRM this is exactly `dice.pointDefenceKills`, the one place the 6.4
 * and 8.8 tables live. A modified die — the K-1's −1 (5.16) — is rolled here
 * instead, because that function takes no DRM. The re-roll is still earned by
 * the **natural** 6, following 4.6: a modifier changes what a die scores, not
 * whether it explodes.
 */
function rollAllocation(
  allocation: PointDefenceAllocation,
  heavyMissile: boolean,
  rng: Rng,
): { rolls: number[]; kills: number } {
  const drm = allocation.drm ?? 0
  if (drm === 0) {
    return pointDefenceKills(allocation.dice, allocation.mode, rng, { heavyMissile })
  }
  const rolls: number[] = []
  let kills = 0
  const resolve = (): void => {
    const natural = d6(rng)
    rolls.push(natural)
    const face = Math.max(1, Math.min(6, natural + drm))
    if (heavyMissile) {
      // 6.4 gives no re-roll at all against a Heavy Missile.
      if (allocation.mode === 'pds' ? face >= 5 : face === 6) kills += 1
      return
    }
    if (allocation.mode === 'pds') {
      if (face === 6) kills += 2
      else if (face >= 4) kills += 1
    } else if (face >= 5) {
      kills += 1
    }
    if (natural === 6) resolve()
  }
  for (let i = 0; i < allocation.dice; i++) resolve()
  return { rolls, kills }
}

/**
 * 6.4's lock-on roll, for a salvo that has already run the gauntlet — **phase 10**.
 *
 * > *"The attacking player then rolls a D6 for each Salvo Missile marker. The
 * > result is the number of missiles in the salvo that are actually on target.
 * > Subtract the number of missiles killed from the D6 score that the attacker
 * > rolled. Any positive number is the number of missiles that actually get
 * > through the defenses and hit the target."*
 *
 * `resolveMissilePointDefence` does the whole of 6.4 in one call, defensive
 * fire and lock-on together, and the engine's live phase 9 does not use it —
 * it runs `defences.resolvePointDefence`, which knows nothing about lock-on.
 * So the roll has to be made where the salvo arrives, on the survivors and the
 * count already killed.
 *
 * The salvo is `missiles + hits`: phase 9 subtracts its kills from `missiles`
 * and adds them to `hits`, and 6.4 measures the D6 against the salvo as
 * launched, not against what is left of it.
 */
export function rollSalvoLockOn(
  marker: MissileMarker,
  rng: Rng,
  drm = 0,
): { roll: number; lockOn: number; hits: number } {
  const salvo = marker.missiles + marker.hits
  const roll = d6(rng)
  const lockOn = Math.max(0, Math.min(salvo, roll + drm))
  let hits = Math.max(0, Math.min(marker.missiles, lockOn - marker.hits))
  // "If there are no defenses at all, at least one missile in a salvo will
  // always get through." Unconditional, so it is written down even though a
  // D6 cannot roll zero.
  if (marker.hits === 0) hits = Math.max(hits, Math.min(1, marker.missiles))
  return { roll, lockOn, hits }
}

/**
 * Resolve point defence against one marker — **phase 9** (6.4).
 *
 * Two tables, and which one applies is the whole difference between a salvo and
 * a Heavy Missile:
 *
 *   Salvo    PDS 4-5 kills one, 6 kills two and re-rolls; Beam-1 or fighter
 *            kills one on 5-6, re-rolling a 6. The attacker then rolls one D6
 *            for the marker and *"any positive number"* left after the kills
 *            gets through.
 *   Heavy    PDS kills on 5 or 6, Beam-1 or fighter on a 6, and one kill is
 *            the end of it. An antimatter warhead takes three (6.6).
 *
 * Dice order follows 6.4's own order — defensive fire, then the lock-on roll —
 * which is only visible with a seeded RNG, and the two are independent anyway.
 */
export function resolveMissilePointDefence(
  input: MissilePointDefenceInput,
): MissilePointDefenceResult {
  const { marker, rng } = input
  const allocations = input.allocations
  const preKills = input.preKills ?? 0
  const heavy = marker.kind === 'heavy' || marker.kind === 'antimatter'

  const dice: number[] = []
  const fighterLosses: Array<{ sourceId: string; lost: number }> = []
  let kills = preKills

  for (const allocation of allocations) {
    const rolled = rollAllocation(allocation, heavy, rng)
    dice.push(...rolled.rolls)
    kills += rolled.kills
    if (allocation.mode === 'fighter' && rolled.kills > 0) {
      // 6.4: "For each Salvo Missile or Heavy Missile killed by a fighter roll
      // an additional D6: on a roll of 6 the fighter is destroyed as well."
      // One die per kill scored — the engine cannot yet know which kills will
      // turn out to be overkill, and neither can the pilot.
      let lost = 0
      for (let i = 0; i < rolled.kills; i++) {
        const face = d6(rng)
        dice.push(face)
        if (face === 6) lost += 1
      }
      if (lost > 0) fighterLosses.push({ sourceId: allocation.sourceId, lost })
    }
  }

  if (heavy) {
    const hitsTaken = marker.hits + kills
    const needed = marker.kind === 'antimatter' ? ANTIMATTER_HITS_TO_KILL : 1
    const destroyed = hitsTaken >= needed
    return {
      marker: { ...marker, hits: hitsTaken, missiles: destroyed ? 0 : marker.missiles },
      lockOn: null,
      kills,
      hits: destroyed ? 0 : marker.missiles,
      destroyed,
      fighterLosses,
      dice,
      detail:
        `${marker.kind} missile takes ${kills} point-defence hit(s) ` +
        `(${hitsTaken}/${needed}) — ${destroyed ? 'stopped' : 'still coming'}`,
    }
  }

  if (marker.kind === 'rocket') {
    // 6.7: rockets "can be shot down by point defense weapons as if they were
    // conventional missiles", but the to-hit dice at launch have already said
    // how many are coming, so there is no lock-on roll to make.
    const through = Math.max(0, marker.missiles - kills)
    return {
      marker: { ...marker, missiles: through, hits: marker.hits + kills },
      lockOn: null,
      kills,
      hits: through,
      destroyed: through === 0,
      fighterLosses,
      dice,
      detail: `${marker.missiles} rocket(s) incoming, ${kills} shot down, ${through} through`,
    }
  }

  const lockOnRoll = d6(rng)
  dice.push(lockOnRoll)
  // 6.4: the D6 "is the number of missiles in the salvo that are actually on
  // target" — never more than the salvo holds.
  const lockOn = Math.max(0, Math.min(marker.missiles, lockOnRoll + (input.lockOnDrm ?? 0)))
  let hits = Math.max(0, lockOn - kills)
  if (allocations.length === 0 && preKills === 0) {
    // 6.4: "If there are no defenses at all, at least one missile in a salvo
    // will always get through." A D6 cannot roll zero, so this floor only bites
    // when something outside 6.4 has cut the lock-on — but the promise is
    // unconditional, so it is written down.
    hits = Math.max(hits, Math.min(1, marker.missiles))
  }
  return {
    marker: { ...marker, hits: marker.hits + kills },
    lockOn,
    kills,
    hits,
    destroyed: hits === 0,
    fighterLosses,
    dice,
    detail: `salvo locks on ${lockOn}, point defence kills ${kills}, ${hits} through`,
  }
}

// ---------------------------------------------------------------------------
// Phase 10 — missiles and rockets attack (6.5, 6.7)
// ---------------------------------------------------------------------------

/**
 * Damage from the salvo missiles that got through — **phase 10** (6.5).
 *
 * 6.5: *"Each missile in a salvo that hits the target ship inflicts 1D6 of SAP
 * damage."* The dice do not re-roll — the worked example is explicit: *"missile
 * hits don't re-roll"* — so a natural 6 is worth six damage and nothing more.
 */
export function resolveSalvoDamage(
  hits: number,
  screens: OrdnanceScreens,
  rng: Rng,
): WeaponResult {
  const drm = missileScreenDrm(screens)
  const faces = rollD6(Math.max(0, hits), rng)
  const damage = damageFromDice(faces, drm)
  return {
    normalDamage: damage,
    penetratingDamage: 0,
    mode: 'SAP',
    dice: faces,
    detail:
      `${hits} salvo missile(s) hit for ${faces.join(',') || '-'}` +
      `${drm ? ` (${drm} per die from advanced screens)` : ''} → ${damage} SAP damage`,
  }
}

/**
 * A Heavy Missile's warhead — **phase 10** (6.5).
 *
 * 6.5: *"Each Heavy Missile inflicts 3D6 of damage on the target. (As usual,
 * half rounded up can be taken on armor, the remainder on the hull.)"* — which
 * is the SAP rule of 4.9, so `combat.applyDamage` splits it.
 */
export function resolveHeavyMissileDamage(screens: OrdnanceScreens, rng: Rng): WeaponResult {
  const drm = missileScreenDrm(screens)
  const faces = rollD6(3, rng)
  const damage = damageFromDice(faces, drm)
  return {
    normalDamage: damage,
    penetratingDamage: 0,
    mode: 'SAP',
    dice: faces,
    detail:
      `Heavy Missile 3D6: ${faces.join(',')}` +
      `${drm ? ` (${drm} per die from advanced screens)` : ''} → ${damage} SAP damage`,
  }
}

/**
 * Rockets that reached the ship — **phase 10** (6.7).
 *
 * 6.7: *"Rockets do 1d3 damage (Semi-AP) each."* Advanced screens subtract from
 * each die here as they do from any other missile, on the strength of 7.3's
 * general rule for *"Pulse Torpedoes, missiles, and other weapons that are
 * unaffected by Standard Screens"* — a rocket is a missile, and 6.7 gives it no
 * exemption.
 */
export function resolveRocketDamage(
  rockets: number,
  screens: OrdnanceScreens,
  rng: Rng,
): WeaponResult {
  const drm = missileScreenDrm(screens)
  const faces: number[] = []
  let damage = 0
  for (let i = 0; i < Math.max(0, rockets); i++) {
    const roll = d3(rng)
    faces.push(roll.face)
    damage += Math.max(0, roll.value + drm)
  }
  return {
    normalDamage: damage,
    penetratingDamage: 0,
    mode: 'SAP',
    dice: faces,
    detail: `${rockets} rocket(s) × 1D3 → ${damage} SAP damage`,
  }
}

/**
 * Resolve one marker's attack — **phase 10** (6.5, 6.6, 6.7).
 *
 * The dispatcher `game.ts` calls with whatever `resolveMissilePointDefence`
 * left of the marker. An antimatter missile does not come through here: its
 * warhead is a blast, not a hit, and is resolved by
 * `resolveAntimatterDetonation`.
 */
export function resolveOrdnanceAttack(
  marker: MissileMarker,
  hits: number,
  screens: OrdnanceScreens,
  rng: Rng,
): WeaponResult | null {
  if (hits <= 0) return null
  switch (marker.kind) {
    case 'salvo':
      return resolveSalvoDamage(hits, screens, rng)
    case 'heavy':
      return resolveHeavyMissileDamage(screens, rng)
    case 'rocket':
      return resolveRocketDamage(hits, screens, rng)
    case 'antimatter':
      // 6.6: the antimatter warhead is a blast with a radius, so it cannot be
      // expressed as one target's WeaponResult.
      return null
  }
}

// ---------------------------------------------------------------------------
// Antimatter missiles (6.6)
// ---------------------------------------------------------------------------

/** Anything that can be caught in a blast (6.6, 6.8). */
export interface BlastTarget {
  id: string
  position: Point
  kind: 'ship' | 'fighter-group' | 'gunboat' | 'ordnance'
  screens: OrdnanceScreens
}

export interface BlastEffect {
  targetId: string
  range: number
  dice: number[]
  damage: number
  /** 6.8: *"Missiles and gunboats are destroyed."* */
  destroyed: boolean
}

/**
 * Dice an antimatter warhead throws at a given range (6.6).
 *
 * At full strength: *"3d6 damage to the target ship and any other unit within 1
 * mu … 2d6 damage to any ship or unit within 2 MU, and 1d6 damage to any ship
 * or unit within 3 MU."* Every point-defence hit *"reduces the warhead strength
 * by 1d6 and the blast radius by 1 MU"*, so the staircase keeps its shape as it
 * shrinks: a warhead of strength `s` reaches `s` MU and throws `s` dice at the
 * centre, one fewer for each MU out.
 */
export function antimatterBlastDice(strength: number, range: number): number {
  if (strength <= 0) return 0
  const band = Math.max(1, Math.ceil(range))
  if (band > strength) return 0
  return strength - (band - 1)
}

/**
 * Detonate an antimatter missile — **phase 10** (6.6).
 *
 * `hitsTaken` is what point defence managed: three *"will disrupt the warhead
 * sufficiently to prevent any meaningful explosion"*, so the blast is nothing.
 * Screens *"apply a -1 DRM to each die … per level of screen"*, whatever kind
 * of screen they are.
 *
 * Missiles and mines caught in the blast are destroyed. 6.6 gives no mechanic
 * for that, only the intent — the missile may be fused *"to try and destroy
 * large waves of incoming missiles, or blow holes in dense minefields"* — so
 * the reading follows 6.8's blast, which does say it: *"Missiles and gunboats
 * are destroyed."*
 */
export function resolveAntimatterDetonation(
  centre: Point,
  hitsTaken: number,
  targets: readonly BlastTarget[],
  rng: Rng,
): { strength: number; effects: BlastEffect[]; detail: string } {
  const strength = Math.max(0, ANTIMATTER_WARHEAD_DICE - hitsTaken)
  const effects: BlastEffect[] = []
  for (const target of targets) {
    const range = distance(centre, target.position)
    const diceCount = antimatterBlastDice(strength, range)
    if (diceCount === 0) continue
    const faces = rollD6(diceCount, rng)
    const damage = damageFromDice(faces, -target.screens.level)
    effects.push({
      targetId: target.id,
      range,
      dice: faces,
      damage,
      destroyed: target.kind === 'ordnance' || target.kind === 'gunboat',
    })
  }
  return {
    strength,
    effects,
    detail:
      strength === 0
        ? 'antimatter warhead disrupted — no meaningful explosion'
        : `antimatter warhead detonates at strength ${strength}, ${effects.length} unit(s) in the blast`,
  }
}

/**
 * An antimatter missile that fails its threshold check (6.6).
 *
 * 6.6: *"If an Antimatter Missile fails a threshold test it explodes on the
 * rack, immediately doing 1d6 damage to the carrying ship, and 1d6 damage to any
 * unit within 1 MU … Screens and armor will not protect a ship from its own
 * exploding missiles."*
 *
 * The carrier's damage is returned as a plain number of hull points rather than
 * a `WeaponResult`, precisely because it must **not** go through
 * `combat.applyDamage`: there is no armour or screen step to run.
 */
export function resolveAntimatterRackExplosion(
  carrier: { id: string; position: Point },
  nearby: readonly BlastTarget[],
  rng: Rng,
): { hullDamage: number; dice: number[]; nearby: BlastEffect[]; detail: string } {
  const carrierRoll = d6(rng)
  const effects: BlastEffect[] = []
  for (const target of nearby) {
    if (target.id === carrier.id) continue
    const range = distance(carrier.position, target.position)
    if (range > 1) continue
    const face = d6(rng)
    effects.push({
      targetId: target.id,
      range,
      dice: [face],
      // The rack blast is the same antimatter fire as the warhead, so screens
      // blunt it the same way (6.6).
      damage: advancedScreenDamageDie(face, target.screens.level),
      destroyed: target.kind === 'ordnance' || target.kind === 'gunboat',
    })
  }
  return {
    hullDamage: carrierRoll,
    dice: [carrierRoll],
    nearby: effects,
    detail: `antimatter missile explodes on the rack for ${carrierRoll} damage to ${carrier.id}`,
  }
}

// ---------------------------------------------------------------------------
// Rocket pods (6.7)
// ---------------------------------------------------------------------------

/**
 * The die a rocket must beat at this range (6.7), or null out of range.
 *
 *   up to 6 MU → 2+, up to 12 MU → 3+, up to 18 MU → 4+
 */
export function rocketPodToHit(range: number): number | null {
  for (const band of ROCKET_POD_TO_HIT) {
    if (range <= band.range) return band.hitsOn
  }
  return null
}

export interface RocketPodRequest {
  id: string
  owner: string
  sourceShipId: string
  sourceWeaponId?: string
  origin: LaunchOrigin
  arcs: readonly Arc[]
  target: { id: string; position: Point; facing: Course; kind?: 'ship' | 'gunboat' }
  turn: number
}

export interface RocketPodResult {
  marker: MissileMarker | null
  refusal: LaunchRefusal | null
  rolls: number[]
  hits: number
  detail: string
}

/**
 * Fire a rocket pod — **phase 3** (6.7).
 *
 * Not a seeker: *"Select an enemy ship within range and firing arc of the rocket
 * pod. The Rocket Pod fires TWO rockets at the target ship."* Both dice are
 * rolled now and the hits become a marker sitting on the target, to be shot at
 * in phase 9 and to attack in phase 10 with everything else.
 *
 * No FireCon: 6.3 requires one for Heavy Missiles, SMRs and SMLs, and a rocket
 * pod is none of those.
 */
export function fireRocketPod(request: RocketPodRequest, rng: Rng): RocketPodResult {
  const range = distance(request.origin.position, request.target.position)
  const toHit = rocketPodToHit(range)
  if (toHit === null) {
    return {
      marker: null,
      refusal: 'out-of-range',
      rolls: [],
      hits: 0,
      detail: `${range.toFixed(1)} MU is beyond a rocket pod's 18 MU`,
    }
  }
  const arc = arcTo(request.origin.position, request.origin.facing, request.target.position)
  if (!bearsOn(request.arcs, arc)) {
    return {
      marker: null,
      refusal: 'out-of-arc',
      rolls: [],
      hits: 0,
      detail: `the target lies in the ${arc} arc`,
    }
  }

  const drm = request.target.kind === 'gunboat' ? ROCKET_POD_GUNBOAT_DRM : 0
  const rolls: number[] = []
  let hits = 0
  for (let i = 0; i < ROCKETS_PER_POD; i++) {
    const face = d6(rng)
    rolls.push(face)
    if (face + drm >= toHit) hits += 1
  }

  // 6.7: the rockets "hit in the arc visible at the moment of launch", which is
  // the arc of the *target* that the launching ship is standing in.
  const attackArc = incomingArc(
    request.target.position,
    request.target.facing,
    request.origin.position,
  )
  const marker: MissileMarker | null =
    hits > 0
      ? {
          id: request.id,
          owner: request.owner,
          sourceShipId: request.sourceShipId,
          sourceWeaponId: request.sourceWeaponId,
          kind: 'rocket',
          grade: 'standard',
          missiles: hits,
          position: request.target.position,
          facing: nearestCourse(request.origin.position, request.target.position),
          launchedTurn: request.turn,
          rangeFlown: range,
          endurance: 1,
          stagesRemaining: 0,
          hits: 0,
          targetShipId: request.target.id,
          attackArc,
        }
      : null
  return {
    marker,
    refusal: null,
    rolls,
    hits,
    detail: `rocket pod at ${range.toFixed(1)} MU needs ${toHit}+${drm ? ` (${drm} DRM)` : ''}: ${rolls.join(',')} → ${hits} hit(s)`,
  }
}

// ---------------------------------------------------------------------------
// Plasma Bolt Launchers (6.8)
// ---------------------------------------------------------------------------

/** A plasma bolt in flight, from launch to detonation (6.8). */
export interface PlasmaBolt {
  id: string
  owner: string
  sourceShipId: string
  sourceWeaponId?: string
  position: Point
  /** The launcher's class, 1 to 6 (6.8). */
  boltClass: number
  /** Class less the hits it has taken; at 0 the bolt is destroyed (6.8). */
  strength: number
  launchedTurn: number
}

/**
 * How many launchers a hull may carry (6.8).
 *
 * *"a ship can mount only one 1 launcher per 50 mass of ship. So a mass 101-150
 * ship could mount 3 launchers, while a mass 1-50 ship could only mount 1."*
 */
export function plasmaBoltLauncherLimit(shipMass: number): number {
  return Math.max(0, Math.ceil(shipMass / PLASMA_BOLT_MASS_PER_LAUNCHER))
}

/**
 * Mass of one launcher (6.8).
 *
 * *"PBL mass is equal to 3 mass per class + 1 mass x class per extra arc (max
 * three arcs)"* — so a class-3 PBL is 9 mass in one arc, 12 in two, 15 in three.
 */
export function plasmaBoltMass(boltClass: number, arcs: number): number {
  const extraArcs = Math.max(0, Math.min(3, arcs) - 1)
  return boltClass * 3 + boltClass * extraArcs
}

/**
 * Whether a launcher may fire this turn (6.8).
 *
 * *"a PBL may only fire every other turn"* — so a launcher that fired on turn 3
 * is ready again on turn 5.
 */
export function plasmaBoltMayFire(lastFiredTurn: number | null, turn: number): boolean {
  return lastFiredTurn === null || turn - lastFiredTurn >= PLASMA_BOLT_FIRE_INTERVAL
}

export interface PlasmaBoltRequest {
  id: string
  owner: string
  sourceShipId: string
  sourceWeaponId?: string
  boltClass: number
  origin: LaunchOrigin
  arcs: readonly Arc[]
  aim: Point
  turn: number
  lastFiredTurn?: number | null
  /** 6.8 places the marker *"within arc and line of sight of the launcher"*. */
  obstructed?: boolean
}

/**
 * Place a plasma bolt's detonation marker — **phase 3** (6.8).
 *
 * *"The PBL is fired during the Ordnance Launch Phase. A marker showing the
 * detonation point is placed anywhere within arc and line of sight of the
 * launcher, out to a range of 30 MU."*
 */
export function launchPlasmaBolt(
  request: PlasmaBoltRequest,
): { bolt: PlasmaBolt | null; refusal: LaunchRefusal | 'reloading' | null; detail: string } {
  if (!plasmaBoltMayFire(request.lastFiredTurn ?? null, request.turn)) {
    return { bolt: null, refusal: 'reloading', detail: 'a PBL may only fire every other turn' }
  }
  if (request.obstructed) {
    return { bolt: null, refusal: 'obstructed', detail: 'no line of sight to the detonation point' }
  }
  const range = distance(request.origin.position, request.aim)
  if (range > PLASMA_BOLT_RANGE) {
    return {
      bolt: null,
      refusal: 'out-of-range',
      detail: `${range.toFixed(1)} MU exceeds the ${PLASMA_BOLT_RANGE} MU marker range`,
    }
  }
  const arc = arcTo(request.origin.position, request.origin.facing, request.aim)
  if (!bearsOn(request.arcs, arc)) {
    return { bolt: null, refusal: 'out-of-arc', detail: `the aim point lies in the ${arc} arc` }
  }
  return {
    bolt: {
      id: request.id,
      owner: request.owner,
      sourceShipId: request.sourceShipId,
      sourceWeaponId: request.sourceWeaponId,
      position: request.aim,
      boltClass: request.boltClass,
      strength: request.boltClass,
      launchedTurn: request.turn,
    },
    refusal: null,
    detail: `class-${request.boltClass} plasma bolt placed ${range.toFixed(1)} MU out`,
  }
}

/** What may shoot at a plasma bolt (6.8). */
export type PlasmaBoltDefenceKind = 'pds' | 'fighter' | 'scattergun'

export interface PlasmaBoltDefence {
  sourceId: string
  kind: PlasmaBoltDefenceKind
  dice: number
}

/**
 * Whether a point-defence mount may engage a plasma bolt at all (6.8).
 *
 * *"Class 1 beams and class 1 K-guns may NOT be used in their secondary PDS role
 * against Plasma Bolts"* — so a `beam-1` mode mount is out, and only a purpose
 * built PDS, a fighter or a scattergun can try.
 */
export function canEngagePlasmaBolt(mode: PdMode): boolean {
  return mode !== 'beam-1'
}

/**
 * Shoot at a plasma bolt — **phase 9** (6.8).
 *
 *   PDS         −2 DRM, *"so they only score hits on a die roll of a 6"*
 *   Fighter     within 6 MU, *"roll for each fighter as if it was a PDS"* — a 6
 *   Scattergun  *"roll like a 'beam' die, removing 1 strength … on a 4 or 5
 *               result, and 2 strength classes on a 6 (NO reroll)"*
 *
 * *"Each hit on the PBL reduces its strength by 1. So a class 1 PBL is destroyed
 * by a single hit, while a huge class 6 will take 6 points of damage."*
 */
export function resolvePlasmaBoltDefence(
  bolt: PlasmaBolt,
  defences: readonly PlasmaBoltDefence[],
  rng: Rng,
): { bolt: PlasmaBolt; hits: number; rolls: number[]; destroyed: boolean; detail: string } {
  const rolls: number[] = []
  let hits = 0
  for (const defence of defences) {
    for (let i = 0; i < defence.dice; i++) {
      const face = d6(rng)
      rolls.push(face)
      if (defence.kind === 'scattergun') {
        if (face === 6) hits += 2
        else if (face >= 4) hits += 1
      } else if (face === 6) {
        // Both the PDS at −2 and the fighter come down to a natural 6.
        hits += 1
      }
    }
  }
  const strength = Math.max(0, bolt.strength - hits)
  return {
    bolt: { ...bolt, strength },
    hits,
    rolls,
    destroyed: strength === 0,
    detail: `class-${bolt.boltClass} bolt takes ${hits} hit(s) → strength ${strength}`,
  }
}

/**
 * Detonate a plasma bolt — **phase 10** (6.8).
 *
 * *"Plasma Bolts do 1d6 damage per class to every target within the blast
 * radius … Roll for each target separately, as the randomness of the blast may
 * bathe targets in more or less plasma."* Damage is by the bolt's surviving
 * strength, not its printed class, because *"each hit … reduces its strength by
 * 1"*.
 *
 * *"Fighters and Heavy Fighters take 1d6 casualties per dice of plasma damage.
 * Missiles and gunboats are destroyed."* The fighter casualty dice are rolled
 * here and reported as `damage`; how many fighters that removes is the fighter
 * module's business.
 */
export function resolvePlasmaBoltDetonation(
  bolt: PlasmaBolt,
  targets: readonly BlastTarget[],
  rng: Rng,
): { effects: BlastEffect[]; detail: string } {
  const effects: BlastEffect[] = []
  if (bolt.strength <= 0) {
    return { effects, detail: 'the plasma bolt was destroyed before it could detonate' }
  }
  for (const target of targets) {
    const range = distance(bolt.position, target.position)
    if (range > PLASMA_BOLT_BLAST_RADIUS) continue
    if (target.kind === 'ordnance' || target.kind === 'gunboat') {
      effects.push({ targetId: target.id, range, dice: [], damage: 0, destroyed: true })
      continue
    }
    if (target.kind === 'fighter-group') {
      // 6.8: "Fighters and Heavy Fighters take 1d6 casualties per dice of
      // plasma damage." The bolt throws one die per surviving class, so the
      // group rolls that many casualty dice — the plasma damage itself is never
      // worked out for a fighter, only converted. `damage` is the casualty
      // count; capping it at the group's strength is the fighter module's job.
      const casualties = rollD6(bolt.strength, rng)
      effects.push({
        targetId: target.id,
        range,
        dice: casualties,
        damage: casualties.reduce((total, face) => total + face, 0),
        destroyed: false,
      })
      continue
    }
    const faces = rollD6(bolt.strength, rng)
    effects.push({
      targetId: target.id,
      range,
      dice: faces,
      damage: damageFromDice(faces, plasmaScreenDrm(target.screens)),
      destroyed: false,
    })
  }
  return {
    effects,
    detail: `class-${bolt.boltClass} bolt detonates at strength ${bolt.strength}, ${effects.length} unit(s) in the blast`,
  }
}

/**
 * A plasma bolt fired as a shaped charge (6.8, optional).
 *
 * *"A hit will generate 1D3 points of damage per size class of the Plasma Bolt.
 * Standard Screens will have no effect but Advanced Screens will at -1 DRM for
 * each level of screens. Damage is Semi-Armor Piercing."*
 *
 * The to-hit roll is **not** implemented: it uses the Projectile Weapon Hit
 * Probability Table, which 5.16 places on *"page 153"*, and the rulebook text
 * extract stops at page 80. The caller therefore says whether the shot hit;
 * everything after that is here.
 */
export function resolvePlasmaBoltShapedCharge(
  boltClass: number,
  hit: boolean,
  screens: OrdnanceScreens,
  rng: Rng,
): WeaponResult {
  if (!hit) {
    return { normalDamage: 0, penetratingDamage: 0, mode: 'SAP', dice: [], detail: 'shaped charge missed' }
  }
  const drm = missileScreenDrm(screens)
  const faces: number[] = []
  let damage = 0
  for (let i = 0; i < boltClass; i++) {
    const roll = d3(rng)
    faces.push(roll.face)
    damage += Math.max(0, roll.value + drm)
  }
  return {
    normalDamage: damage,
    penetratingDamage: 0,
    mode: 'SAP',
    dice: faces,
    detail: `class-${boltClass} shaped charge ${boltClass}D3 → ${damage} SAP damage`,
  }
}

// ---------------------------------------------------------------------------
// Mountings, magazines and cost (6.6 – 6.9)
// ---------------------------------------------------------------------------

/** 6.6: *"mass 2 for a standard salvo, mass 3 for ER"*. */
export const MAGAZINE_LOAD_MASS: Record<MissileGrade, number> = {
  standard: 2,
  extended: 3,
}

/**
 * 6.6 prices magazine space at section 6's usual rate — the table gives a
 * standard salvo load as "2 mass, 3 per mass" — so a magazine costs three
 * points for every mass of loads it carries.
 */
export const MAGAZINE_POINTS_PER_MASS = 3

/** 6.6: an extra stage *"increases the mass by 2 and doubles the points cost"*. */
export const MULTI_STAGE_EXTRA_MASS = 2

/** One missile load sitting in a magazine (6.6). */
export interface MagazineLoad {
  grade: MissileGrade
  /** 6.6 optional: a multi-stage load. ER loads may not be. */
  multiStage?: boolean
}

/** Mass one load takes up in a magazine (6.6). */
export function magazineLoadMass(load: MagazineLoad): number {
  return MAGAZINE_LOAD_MASS[load.grade] + (load.multiStage ? MULTI_STAGE_EXTRA_MASS : 0)
}

/**
 * How many loads of one grade a magazine of this mass holds (6.6).
 *
 * *"Each magazine has a mass rating, which determines the number of Salvo
 * Missile loads carried"* — so a mass 8 magazine is *"4 standard salvoes"*.
 */
export function magazineCapacity(mass: number, grade: MissileGrade = 'standard'): number {
  return Math.floor(mass / MAGAZINE_LOAD_MASS[grade])
}

/** A magazine as fitted, and the launchers it feeds (6.6). */
export interface MagazineState {
  id: string
  mass: number
  loads: MagazineLoad[]
  /**
   * 6.6: *"any one launcher system may only be fed from one magazine, though a
   * single magazine may feed more than one launcher."*
   */
  launcherIds: string[]
}

export type MagazineFault = 'over-capacity' | 'mixed-stages' | 'er-cannot-be-multi-stage'

/**
 * Check a magazine's load-out against 6.6.
 *
 * The mass 8 example is the test: 4 standard fits exactly; 1 standard + 2 ER
 * fits exactly; *"A 2 standard and 1 ER load is also allowed, but wastes 1
 * space in the magazine."* So overfilling is a fault and underfilling is merely
 * waste.
 *
 * *"a magazine may only carry either regular missiles or multi-stage missiles,
 * not a mixture."*
 */
export function checkMagazine(
  mass: number,
  loads: readonly MagazineLoad[],
): { massUsed: number; wasted: number; faults: MagazineFault[] } {
  const massUsed = loads.reduce((total, load) => total + magazineLoadMass(load), 0)
  const faults: MagazineFault[] = []
  if (massUsed > mass) faults.push('over-capacity')
  const multiStage = loads.filter((load) => load.multiStage).length
  if (multiStage > 0 && multiStage < loads.length) faults.push('mixed-stages')
  if (loads.some((load) => load.multiStage && load.grade === 'extended')) {
    faults.push('er-cannot-be-multi-stage')
  }
  return { massUsed, wasted: Math.max(0, mass - massUsed), faults }
}

/**
 * Draw one load for a launcher — **phase 3** (6.6).
 *
 * *"A Salvo Missile Launcher (SML) may fire one salvo per turn provided
 * ammunition is left in the magazine."* A launcher may only draw from the
 * magazine that feeds it: *"if one launcher is lost while it still has missiles
 * in its dedicated magazine, those missiles are useless, they cannot be fired by
 * another undamaged launcher that was not originally fed from that magazine."*
 */
export function drawMagazineLoad(
  magazine: MagazineState,
  launcherId: string,
): { magazine: MagazineState; load: MagazineLoad | null; refusal: 'no-ammunition' | 'not-fed' | null } {
  if (!magazine.launcherIds.includes(launcherId)) {
    return { magazine, load: null, refusal: 'not-fed' }
  }
  if (magazine.loads.length === 0) {
    return { magazine, load: null, refusal: 'no-ammunition' }
  }
  const [load, ...rest] = magazine.loads
  return { magazine: { ...magazine, loads: rest }, load, refusal: null }
}

/**
 * One buyable ordnance mounting, as section 6 prints it.
 *
 * `mass: null` marks a number the rulebook text extract does not carry — see
 * `docs/rules/ordnance.md`. Nothing here is guessed.
 */
export interface OrdnanceMount {
  key: string
  label: string
  weaponClass: WeaponClass
  mass: number | null
  pointsPerMass: number | null
  /** A flat price, where the section gives one instead of a rate. */
  points?: number
  arcs: number
  note?: string
}

/** Every ordnance mounting section 6 prices (6.6 – 6.9). */
export const ORDNANCE_MOUNTS: readonly OrdnanceMount[] = [
  {
    key: 'salvo-missile-rack',
    label: 'Salvo Missile Rack (single shot)',
    weaponClass: 'salvo-missile-rack',
    mass: 4,
    pointsPerMass: 3,
    arcs: 3,
    note: '6.6: "Single shot SMLs are 4 mass"; one-shot, one system for threshold checks',
  },
  {
    key: 'salvo-missile-rack-er',
    label: 'Salvo Missile Rack, extended range (single shot)',
    weaponClass: 'salvo-missile-rack',
    mass: null,
    pointsPerMass: 3,
    arcs: 3,
    note: '6.6 names "Extended range single shot SMLs" but the mass is lost in the figure caption',
  },
  {
    key: 'salvo-missile-launcher',
    label: 'Salvo Missile Launcher',
    weaponClass: 'salvo-missile-launcher',
    mass: 3,
    pointsPerMass: 3,
    arcs: 3,
    note: '6.6: fed by a magazine, one salvo per turn',
  },
  {
    key: 'heavy-missile',
    label: 'Heavy Missile rack',
    weaponClass: 'heavy-missile',
    mass: null,
    pointsPerMass: 3,
    arcs: 3,
    note: '6.6 prices SMLs and magazine loads but never the Heavy Missile rack itself',
  },
  {
    key: 'antimatter-missile',
    label: 'Antimatter Missile (rack mounted)',
    weaponClass: 'antimatter-missile',
    mass: 2,
    pointsPerMass: 5,
    arcs: 3,
    note: '6.6: "Rack-mounted Antimatter Missile mass 2, 3 arcs"; range 18 MU',
  },
  {
    key: 'rocket-pod',
    label: 'Rocket Pod',
    weaponClass: 'rocket-pod',
    mass: 1,
    pointsPerMass: null,
    points: 3,
    arcs: 1,
    note: '6.7: "Mass 1 and cost 3 points"; one shot, two rockets',
  },
  {
    key: 'mine-rack',
    label: 'Mine Rack',
    weaponClass: 'mine-rack',
    mass: 2,
    pointsPerMass: 3,
    arcs: 0,
    note: '6.9: mines are 1 mass and 2 points each, minimum 2 per rack',
  },
]

/** 6.9: *"Mines are 1 mass and cost 2 points each. (2 mines min per rack)"*. */
export const MINE_MASS = 1
export const MINE_POINTS = 2
export const MINES_MINIMUM_PER_RACK = 2

/**
 * Points for a mounting once the multi-stage option is taken (6.6).
 *
 * *"An extra stage … increases the mass by 2 and doubles the points cost."*
 */
export function multiStagePoints(basePoints: number): number {
  return basePoints * 2
}

/** Mass for a mounting once the multi-stage option is taken (6.6). */
export function multiStageMass(baseMass: number): number {
  return baseMass + MULTI_STAGE_EXTRA_MASS
}

// ---------------------------------------------------------------------------
// The weapon registry's view of ordnance (contract.ts)
// ---------------------------------------------------------------------------

/**
 * Longest range at which an ordnance mount can put a marker (6.3, 6.6 – 6.9).
 *
 * This is what the targeting code and the AI ask for. It is the *launch* range,
 * not the missile's reach: a salvo aimed 24 MU out still attacks anything that
 * ends up within 6 MU of the marker (6.3).
 */
function ordnanceMaxRange(weaponClass: WeaponClass, variant: WeaponVariant): number {
  switch (weaponClass) {
    case 'antimatter-missile':
      return ANTIMATTER_RANGE
    case 'rocket-pod':
      return ROCKET_POD_TO_HIT[ROCKET_POD_TO_HIT.length - 1].range
    case 'plasma-bolt-launcher':
      return PLASMA_BOLT_RANGE
    case 'mine-rack':
      // 6.10: mines are laid on the ship's own course; there is no launch range.
      return 0
    default:
      if (variant === 'two-stage') return MISSILE_RANGE_STANDARD + MULTI_STAGE_RANGE_BONUS
      return variant === 'extended' ? MISSILE_RANGE_EXTENDED : MISSILE_RANGE_STANDARD
  }
}

function ordnanceSpec(
  weaponClass: WeaponClass,
  label: string,
  opts: { requiresFireCon: boolean; damageMode: WeaponSpec['damageMode'] },
): WeaponSpec {
  return {
    weaponClass,
    label,
    damageMode: opts.damageMode,
    maxRange: (_rating: number, variant: WeaponVariant) => ordnanceMaxRange(weaponClass, variant),
    // Ordnance is launched in phase 3 and resolves in phase 10, so there is
    // nothing for the phase 11 firing pipeline to do with it (2.6). The launch
    // functions above are the entry points.
    fire: () => null,
    requiresFireCon: opts.requiresFireCon,
    ordnance: true,
  }
}

/**
 * Section 6's entries in the weapon registry.
 *
 * Registered so that arcs, ranges, FireCon needs and the `ordnance` flag are
 * answerable from `weapons/index.ts` like any other mount; `fire()` always
 * returns null, because no ordnance is fired in phase 11.
 *
 * 6.3 fixes which of these need a FireCon: *"An operational FireCon is
 * necessary to launch Heavy Missiles, Salvo Missile Racks, or Salvo Missile
 * Launchers"* — and nothing else in section 6 is on that list.
 */
export const ORDNANCE_WEAPON_SPECS: WeaponSpecTable = {
  'heavy-missile': ordnanceSpec('heavy-missile', 'Heavy Missile', {
    requiresFireCon: true,
    damageMode: 'SAP',
  }),
  'salvo-missile-rack': ordnanceSpec('salvo-missile-rack', 'Salvo Missile Rack', {
    requiresFireCon: true,
    damageMode: 'SAP',
  }),
  'salvo-missile-launcher': ordnanceSpec('salvo-missile-launcher', 'Salvo Missile Launcher', {
    requiresFireCon: true,
    damageMode: 'SAP',
  }),
  'antimatter-missile': ordnanceSpec('antimatter-missile', 'Antimatter Missile', {
    requiresFireCon: true,
    damageMode: 'SAP',
  }),
  'rocket-pod': ordnanceSpec('rocket-pod', 'Rocket Pod', {
    requiresFireCon: false,
    damageMode: 'SAP',
  }),
  'plasma-bolt-launcher': ordnanceSpec('plasma-bolt-launcher', 'Plasma Bolt Launcher', {
    requiresFireCon: false,
    damageMode: 'standard',
  }),
  'mine-rack': ordnanceSpec('mine-rack', 'Mine Rack', {
    requiresFireCon: false,
    damageMode: 'P',
  }),
}
