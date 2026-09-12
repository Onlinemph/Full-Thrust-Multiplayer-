/**
 * Full Thrust: Project Continuum — special moves (section 16).
 *
 * Seven rules that share a page and nothing else. A thrust-0 hulk drifting on
 * a course written before the game; a ship rolling onto its back to bring its
 * undamaged broadside round; a salvage tug taking a dreadnought under tow; the
 * whole table sliding out from under a stern chase; a fleet running for the
 * edge; a shuttle coming alongside; and a captain who has decided to end the
 * argument with his bow.
 *
 * What holds them together is where they sit relative to `movement.ts`. Every
 * one of them is a thing a ship does *during* or *instead of* its ordinary
 * move, so none of them fly the ship. Rolling reduces a turning allowance it is
 * handed rather than computing one — half-rounded-down, advanced drives and the
 * rating-1 exception are 3.2 and 3.3, and they should exist once. Towing
 * derives a thrust rating and stops, because 16.3 says the linked pair moves
 * *"as if they were in a line-ahead squadron formation"* and leaves that to
 * 3.7. Ramming reports what the dice did and lets `combat.applyDamage` meet it
 * with armour (4.8, 4.9), exactly as `gunboats.ts` reports a squadron's fire.
 *
 * Only two of the seven touch dice at all — 16.5's disengagement and 16.7's
 * ram. Docking, which is the one people remember as a die roll, has none: it is
 * a geometry test and a two-turn clock.
 *
 * Every quotation is from *Full Thrust: Project Continuum* v1.1.4, section 16;
 * the prose, the tables and the reasoning behind each **[reading]** are in
 * `docs/rules/specialmoves.md`.
 */

import { d6, rollD6, type Rng } from './dice'
import { arcTo, distance, moveShip } from './geometry'
import type { Arc, Course, DamageMode, Point } from './types'

const EPSILON = 1e-9

// ---------------------------------------------------------------------------
// Declaring a special move (16.2, 16.6, 16.7)
// ---------------------------------------------------------------------------

/**
 * The special moves that have to be written down before anything moves.
 *
 * 16.2: *"the player simply writes 'Roll' in the movement orders for that
 * turn"*. 16.7: *"writes as part of movement orders that the ship is going to
 * attempt to ram"*. 16.6 requires the approach to be *"plotted"*. All three are
 * commitments made in phase 1 and paid for in phase 5, and none of them fit in
 * `MovementOrder`, which carries a turn, an acceleration and an emergency-thrust
 * flag and nothing else. This is the shape they should take alongside it.
 */
export interface SpecialMoveOrder {
  /** 16.2 — roll 180° about the long axis, or roll back upright. */
  roll?: boolean
  /** 16.7 — the ship this one intends to ram. */
  ram?: { targetId: string }
  /** 16.6 — the ship or starbase this one is closing on to dock. */
  dock?: { targetId: string }
  /** 16.6 — *"one full turn is also required to 'cast off' and undock"*. */
  castOff?: boolean
  /** 16.3 — the hull this one is establishing a tow link with. */
  tow?: { loadId: string }
}

// ---------------------------------------------------------------------------
// 16.1 Thrust 0 drives
// ---------------------------------------------------------------------------

/**
 * A thrust-0 ship, station or rock, on the course the scenario gave it (16.1).
 *
 * *"The controlling player, or scenario designer, determines the initial
 * position, course, and velocity before the game begins."* Nothing in a battle
 * changes any of the three, which is why this is a scenario record and not a
 * `MovementState`: there is no drive to damage and no order to write.
 */
export interface DriftingObject {
  id: string
  position: Point
  course: Course
  velocity: number
}

/**
 * Whether this thrust rating writes movement orders at all (16.1).
 *
 * *"Ships with thrust 0 drives, and any asteroids or similar object that have
 * significant movement relative to ships, never write orders."* A drive shot
 * down to 0 by threshold checks (4.11) is in the same position for the same
 * reason — 3.2 spends thrust on acceleration, deceleration and turning alike,
 * and it has none to spend.
 */
export function writesMovementOrders(thrust: number): boolean {
  return thrust > 0
}

/**
 * Sort key for the Ship Movement Phase (16.1): thrust-0 objects move *"before
 * all other ships"*, so 0 sorts ahead of 1.
 *
 * It matters more than it looks. Whether a drifting hulk crosses into the 3 MU
 * docking envelope (16.6), or a rock into a line of fire (17.1), is settled
 * before a single powered ship has moved.
 */
export function movementPriority(thrust: number): number {
  return writesMovementOrders(thrust) ? 1 : 0
}

/**
 * Order a mixed bag of movers for phase 5 (16.1). A new array; the input is
 * untouched, and the sort is stable, so ships keep whatever order the caller
 * had them in.
 */
export function orderForMovement<T>(units: readonly T[], thrustOf: (unit: T) => number): T[] {
  return [...units].sort((a, b) => movementPriority(thrustOf(a)) - movementPriority(thrustOf(b)))
}

/**
 * One turn of drift (16.1): *"the ship or asteroid moves along this
 * predetermined course"*.
 *
 * **[reading]** A predetermined course is one straight line, held for the whole
 * battle — 16.1 names *"position, course, and velocity"* in the singular and
 * gives no mechanism for any of them to change. The alternative is a scripted
 * path the designer wrote out turn by turn, which "predetermined" could equally
 * cover; it was rejected because the engine would have to invent a path format
 * to hold it, and because a scenario can drive a curve anyway by handing this
 * function a different course each turn.
 */
export function driftForward(object: DriftingObject): DriftingObject {
  const { position } = moveShip(object.position, object.course, object.velocity, 0)
  return { ...object, position }
}

// ---------------------------------------------------------------------------
// 16.2 Rolling ships
// ---------------------------------------------------------------------------

/** *"The roll expends 1 thrust factor which comes off the turning allowance"* (16.2). */
export const ROLL_THRUST_COST = 1

/** What a roll leaves the ship to manoeuvre with (16.2). */
export interface RollBudget {
  canRoll: boolean
  /** Thrust points left for turning and for changing velocity. */
  thrustRemaining: number
  /** The turning sub-allowance after the roll's point has been charged to it. */
  turnAllowance: number
  reason: string
}

/**
 * Charge a roll against the turn's thrust (16.2).
 *
 * The sentence alone is ambiguous; the worked example is not. *"A thrust-4
 * ship, normally capable of 2 points of turn, could only turn 1 point if it
 * also rolled that move; but would still be able to use its other two thrust
 * factors to accelerate or decelerate as normal."* That is 1 for the roll + 1
 * for the turn + 2 for acceleration = 4, so the roll is one point out of the
 * total and the column it is charged to is the turning allowance. Not free, and
 * not two points.
 *
 * `turnAllowance` is passed in rather than derived: half-rounded-down (3.2), the
 * advanced-drive exception (3.3) and the rating-1 exception all live in
 * `movement.standardTurnAllowance`, and re-deriving them here would be a second
 * copy of section 3 to keep in step.
 *
 * **[reading]** A ship whose turning allowance is already 0 — a rating-1 drive
 * that turned last turn, or a thrust-2 drive halved by a threshold check — may
 * still roll; the charge simply floors at zero. Read as a prerequisite instead
 * ("no allowance, nothing for the point to come off"), the rule would lock the
 * manoeuvre out of exactly the battered ship 16.2 says it is for: *"very useful
 * when ships start to lose systems due to damage"*. A ship with no thrust at
 * all cannot roll, because there is no factor to spend.
 */
export function rollBudget(thrust: number, turnAllowance: number): RollBudget {
  if (thrust < ROLL_THRUST_COST) {
    return {
      canRoll: false,
      thrustRemaining: Math.max(0, thrust),
      turnAllowance: Math.max(0, turnAllowance),
      reason: 'a roll costs 1 thrust factor and the drive has none (16.2)',
    }
  }
  return {
    canRoll: true,
    thrustRemaining: thrust - ROLL_THRUST_COST,
    turnAllowance: Math.max(0, turnAllowance - ROLL_THRUST_COST),
    reason: '',
  }
}

/**
 * Whether the ship is inverted, and when it last turned over (16.2).
 *
 * *"An inverted ship may roll back 'upright' in any subsequent turn, or may
 * remain inverted as long as the player wishes"* — so this is a standing
 * condition, not a per-turn flag, and nothing clears it at the top of a turn.
 */
export interface RollStatus {
  inverted: boolean
  /** Game turn of the last roll, for the marker beside the model. */
  rolledOnTurn: number | null
}

export const UPRIGHT: RollStatus = { inverted: false, rolledOnTurn: null }

/** Perform the roll (16.2) — it toggles, because rolling back upright is the same manoeuvre. */
export function rollShip(status: RollStatus, turn: number): RollStatus {
  return { inverted: !status.inverted, rolledOnTurn: turn }
}

/**
 * The arc a mounting covers once the ship is upside down (16.2): *"the port
 * batteries now bear to starboard and vice versa"*.
 *
 * A mirror through the long axis, so bow and stern arcs map to themselves and
 * the four flank arcs swap in pairs. Being a mirror it is its own inverse,
 * which is why `weaponBears` may mirror either the weapon's arcs or the arc the
 * target is seen in and get the same answer.
 */
const MIRRORED_ARC: Record<Arc, Arc> = {
  F: 'F',
  FS: 'FP',
  AS: 'AP',
  A: 'A',
  AP: 'AS',
  FP: 'FS',
}

export function mirrorArc(arc: Arc): Arc {
  return MIRRORED_ARC[arc]
}

/** A mounting's effective arcs in its current attitude (16.2, 4.2). */
export function arcsWhenInverted(arcs: readonly Arc[], inverted: boolean): Arc[] {
  return inverted ? arcs.map(mirrorArc) : [...arcs]
}

/**
 * Whether a weapon bears on a target, with the ship's attitude taken into
 * account (16.2, 4.2).
 *
 * *"Rolling has no effect on combat (except that the port batteries now bear to
 * starboard and vice versa)"* — so the range, the dice and the target's own
 * facing are all untouched, and the single change is which side the guns are
 * on. The target's bearing comes from `arcTo` as it always does; only the
 * comparison flips.
 */
export function weaponBears(
  arcs: readonly Arc[],
  origin: Point,
  facing: Course,
  target: Point,
  inverted: boolean,
): boolean {
  const seen = arcTo(origin, facing, target)
  return arcs.includes(inverted ? mirrorArc(seen) : seen)
}

/**
 * Course changes are written for the model, not for the inverted ship (16.2):
 * *"an order written for a port turn will still turn the model to the left,
 * even though to the inverted ship this would actually be a starboard turn.
 * Keeping to this convention should avoid a lot of confusion and arguments."*
 *
 * Which is why no movement function in this engine takes an `inverted`
 * argument. The identity below exists to make the convention something a test
 * can assert rather than something a reader has to notice is missing.
 */
export function orderedTurnIsUnaffectedByRoll<T>(turn: T, _inverted: boolean): T {
  return turn
}

// ---------------------------------------------------------------------------
// 16.3 Towing ships
// ---------------------------------------------------------------------------

/** *"The two ships must be within 3 MU of each other"* (16.3). */
export const TOW_MATCH_RANGE = 3

/**
 * *"A ship equipped for towing as part of its normal duties"* versus
 * *"any other ship"* (16.3).
 */
export type TowRig = 'equipped' | 'improvised'

/**
 * Complete turns to establish one link (16.3).
 *
 * **[reading]** *"One complete turn for each ship"* is per ship and
 * sequentially: a purpose-built tug taking three hulks under tow spends three
 * turns, one link at a time. The alternative — one turn covering the whole
 * group — was rejected because the clause is drawn in contrast with the
 * improvised tug's *"two complete turns"* for a single hull, so the thing being
 * counted is the link.
 */
export const TOW_LINK_TURNS: Record<TowRig, number> = { equipped: 1, improvised: 2 }

/** *"Any other ship … can only tow a single ship"* (16.3). */
export const IMPROVISED_TOW_LIMIT = 1

/** Everything matching courses depends on (16.3). */
export interface TowVector {
  position: Point
  facing: Course
  velocity: number
}

export interface TowMatch {
  matched: boolean
  range: number
  reason: string
}

/**
 * Whether the two ships have matched courses (16.3).
 *
 * *"The two ships must be within 3 MU of each other and either both halted, or
 * both moving at the same velocity and course facing."* Two branches, and the
 * halted one asks nothing about facing — a stopped ship has a heading only in
 * the sense that its bow points somewhere.
 *
 * Checked afresh every turn while the link is being established, because
 * *"if either ship changes velocity or facing during this time without an exact
 * match by the other ship … the link is broken"*. Two ships on identical
 * facings at identical velocities hold a constant separation, so re-testing the
 * 3 MU costs nothing in exact play and catches the pair that was never in range.
 */
export function coursesMatched(tug: TowVector, load: TowVector): TowMatch {
  const range = distance(tug.position, load.position)
  if (range > TOW_MATCH_RANGE + EPSILON) {
    return {
      matched: false,
      range,
      reason: `${range.toFixed(1)} MU apart, beyond the ${TOW_MATCH_RANGE} MU needed to match courses (16.3)`,
    }
  }
  if (tug.velocity !== load.velocity) {
    return { matched: false, range, reason: 'velocities do not match exactly (16.3)' }
  }
  // "Either both halted, or both moving at the same velocity and course
  // facing" — the facing test belongs to the moving branch alone.
  if (tug.velocity !== 0 && tug.facing !== load.facing) {
    return { matched: false, range, reason: 'course facings do not match exactly (16.3)' }
  }
  return { matched: true, range, reason: '' }
}

/** A tow link, from the turn it is begun to the turn it is made (16.3). */
export interface TowLink {
  tugId: string
  loadId: string
  rig: TowRig
  /** Complete turns of matched courses banked so far. */
  turnsSpent: number
  linked: boolean
}

/**
 * Begin establishing a link (16.3): *"At the start of a turn (before the Ship
 * Movement Phase) where the two ships have matched courses, the towing ship can
 * begin establishing a link."*
 */
export function beginTowLink(tugId: string, loadId: string, rig: TowRig): TowLink {
  return { tugId, loadId, rig, turnsSpent: 0, linked: false }
}

/** What happened to the pair over one turn of link-establishing (16.3). */
export interface TowTurn {
  /** `coursesMatched` for this turn. */
  matched: boolean
  /**
   * Hull boxes the *towed* ship put into the tug this turn. The rule names the
   * shooter: *"if the target ship fires any weapon against the other"*.
   */
  hullDamageToTug: number
}

export interface TowProgress {
  link: TowLink
  broken: boolean
  reason: string
}

/**
 * Carry a link forward one turn (16.3).
 *
 * *"If either ship changes velocity or facing during this time without an exact
 * match by the other ship, or if the target ship fires any weapon against the
 * other and inflicts at least one hull box of damage, the link is broken and
 * the procedure must be restarted from the beginning."*
 *
 * Two numbers in that sentence are exact and easy to soften by accident. It is
 * *hull* boxes, so a volley entirely absorbed by screens or armour breaks
 * nothing and one box breaks everything; and it is *from the beginning*, so a
 * broken link resets to zero turns rather than pausing.
 *
 * **[reading]** The break clause is one-directional. *"The target ship"* — the
 * prize — shoots *"the other"* — the tug. A tug firing on its own tow does not
 * break its link. The symmetric reading (any shot between the pair) is tidier
 * and defensible, but it invents a rule the text does not contain; the clause
 * is plainly about a hulk resisting capture.
 *
 * **[reading]** The break conditions apply only while the link is being
 * established, not for the life of the tow. *"During this time"* scopes them to
 * the procedure, and *"restarted from the beginning"* is a statement about the
 * procedure too. Reading them as permanent would need a rule for what happens
 * to a moving, linked pair when the link parts, and 16.3 gives none — so a
 * finished link is left alone here and the integrator may sever it by scenario.
 */
export function advanceTowLink(link: TowLink, turn: TowTurn): TowProgress {
  if (link.linked) return { link, broken: false, reason: '' }

  if (!turn.matched) {
    return {
      link: { ...link, turnsSpent: 0 },
      broken: true,
      reason: 'courses no longer match exactly; the procedure restarts from the beginning (16.3)',
    }
  }
  if (turn.hullDamageToTug >= 1) {
    return {
      link: { ...link, turnsSpent: 0 },
      broken: true,
      reason: 'the tow put at least one hull box into the towing ship (16.3)',
    }
  }

  const turnsSpent = link.turnsSpent + 1
  return {
    link: { ...link, turnsSpent, linked: turnsSpent >= TOW_LINK_TURNS[link.rig] },
    broken: false,
    reason: '',
  }
}

/** Whether this tug may take another hull in tow (16.3). */
export function canTakeAnotherInTow(
  rig: TowRig,
  alreadyInTow: number,
): { allowed: boolean; reason: string } {
  if (rig === 'improvised' && alreadyInTow >= IMPROVISED_TOW_LIMIT) {
    return { allowed: false, reason: 'a ship not equipped for towing can only tow a single ship (16.3)' }
  }
  return { allowed: true, reason: '' }
}

/** The thrust the linked ships have between them (16.3). */
export interface LinkedDrive {
  /** Tug mass × tug drive rating. */
  availableThrust: number
  /** Every linked hull, the tug's own included. */
  combinedMass: number
  /** The pair's thrust rating, rounded down. */
  thrust: number
  /**
   * True when the rating rounds to 0: *"the tow can still succeed, but the time
   * required will be many hours or days, outside the time frame of a Full
   * Thrust battle"*. Not a failure — the pair simply coasts.
   */
  outsideBattleTimeframe: boolean
}

/**
 * The linked pair's thrust rating (16.3).
 *
 * *"Multiply the mass of the towing ship by its main drive rating: this is the
 * available thrust. Divide the available thrust by the combined mass of the
 * linked ships and round down to the nearest whole number."*
 *
 * The book's own worked example, which the tests pin: a mass-80 thrust-4
 * salvage ship on a mass-160 dreadnought is 80 × 4 = 320 over 80 + 160 = 240,
 * 1.5, **rating 1**. Two traps in that: the tug's own mass is in the
 * denominator, because it is dragging itself along too; and it rounds down, so
 * a tug barely out of its depth gets nothing at all.
 *
 * The result is a *rating*, so section 3 applies to it unchanged — a linked
 * rating of 1 gets 3.2's rating-1 exception, one point of facing change and not
 * on consecutive turns, which is a fair description of towing a dreadnought.
 */
export function linkedDriveRating(
  tug: { mass: number; thrust: number },
  load: readonly { mass: number }[],
): LinkedDrive {
  const availableThrust = tug.mass * tug.thrust
  const combinedMass = load.reduce((sum, hull) => sum + hull.mass, tug.mass)
  const thrust = combinedMass > 0 ? Math.floor(availableThrust / combinedMass) : 0
  return {
    availableThrust,
    combinedMass,
    thrust,
    outsideBattleTimeframe: thrust === 0,
  }
}

// ---------------------------------------------------------------------------
// 16.4 Moving table
// ---------------------------------------------------------------------------

export type TableEdge = 'top' | 'bottom' | 'left' | 'right'

export const TABLE_EDGES: readonly TableEdge[] = ['top', 'bottom', 'left', 'right']

export interface TableBounds {
  width: number
  height: number
}

/**
 * The offset that slides the action back off an edge (16.4): *"move every ship
 * and object in play a certain agreed distance back towards the opposite table
 * edge"*.
 *
 * The argument is the edge the fleet is *crowding*; the offset points the other
 * way. Table coordinates follow `geometry.ts`, where y grows downward, so the
 * top edge is y = 0.
 *
 * **[reading]** The distance stays with the players. 16.4 says *"a certain
 * agreed distance"* and names no number, so the caller supplies it; defaulting
 * it to something plausible would have been an invented number wearing a rule's
 * clothes.
 */
export function tableShift(crowding: TableEdge, distanceBack: number): Point {
  switch (crowding) {
    case 'top':
      return { x: 0, y: distanceBack }
    case 'bottom':
      return { x: 0, y: -distanceBack }
    case 'left':
      return { x: distanceBack, y: 0 }
    case 'right':
      return { x: -distanceBack, y: 0 }
  }
}

/**
 * Slide the table under everything on it (16.4).
 *
 * *"Effectively you can think of it as extending the playing area under the
 * ships. (All things are relative, as someone once said.)"* The only property
 * that matters is the one that must not change: because the same offset is
 * applied to every object, every range, bearing and arc in the game is
 * identical afterwards.
 */
export function shiftTable<T extends { position: Point }>(
  objects: readonly T[],
  offset: Point,
): T[] {
  return objects.map((object) => ({
    ...object,
    position: { x: object.position.x + offset.x, y: object.position.y + offset.y },
  }))
}

/**
 * The edge the whole action has drifted into, if any (16.4): *"if you find that
 * all ships in the action are starting to get very close to one end or side of
 * the table"*.
 *
 * **[reading]** *"Very close"* is the players' call, so `margin` is an argument
 * and the engine names no threshold of its own. "All ships" is read strictly —
 * one straggler at the far end and the table does not move, which is the point,
 * since the shift is only free of consequences while nobody is about to be
 * pushed off the other side. Where a fleet is cornered and two edges qualify,
 * the tighter one wins.
 */
export function crowdedEdge(
  positions: readonly Point[],
  table: TableBounds,
  margin: number,
): TableEdge | null {
  if (positions.length === 0) return null

  const worstDistanceTo = (edge: TableEdge): number => {
    let worst = 0
    for (const p of positions) {
      const gap =
        edge === 'top' ? p.y
        : edge === 'bottom' ? table.height - p.y
        : edge === 'left' ? p.x
        : table.width - p.x
      if (gap > worst) worst = gap
    }
    return worst
  }

  let best: TableEdge | null = null
  let bestGap = Infinity
  for (const edge of TABLE_EDGES) {
    const gap = worstDistanceTo(edge)
    if (gap <= margin + EPSILON && gap < bestGap) {
      best = edge
      bestGap = gap
    }
  }
  return best
}

/**
 * Whether flying off the edge means leaving the battle (3.9, 16.4).
 *
 * 3.9: *"This is usually considered a retreat from the battle unless using the
 * moving table rules (section 16.4)"* — and 16.5 hangs off exactly this switch,
 * because it is the moving table that makes a pursuit possible at all.
 */
export function leavingTableIsRetreat(movingTable: boolean): boolean {
  return !movingTable
}

// ---------------------------------------------------------------------------
// 16.5 Disengaging from battle
// ---------------------------------------------------------------------------

/** *"If one player has any ship that has a higher thrust … add 2 to the die roll"* (16.5). */
export const DISENGAGE_THRUST_BONUS = 2

/** One ship of the fleet trying to get away (16.5). */
export interface DisengagingShip {
  onTable: boolean
  /** The edge it left by, once it is off. */
  exitEdge: TableEdge | null
  /** Current thrust rating (4.11), not the printed one. */
  thrust: number
}

/**
 * Whether the abstract disengagement may be rolled yet (16.5).
 *
 * *"The disengaging player's ships must all move off the table via the same
 * table edge; until the last ship has left the table, the battle will continue
 * as normal."* Two conditions in one sentence, and a fleet that split across
 * two edges fails the second even with every ship clear.
 */
export function readyToDisengage(
  ships: readonly DisengagingShip[],
): { ready: boolean; edge: TableEdge | null; reason: string } {
  if (ships.length === 0) {
    return { ready: false, edge: null, reason: 'no ships are disengaging (16.5)' }
  }
  if (ships.some((ship) => ship.onTable)) {
    return { ready: false, edge: null, reason: 'the battle continues until the last ship has left the table (16.5)' }
  }
  const edges = new Set(ships.map((ship) => ship.exitEdge))
  if (edges.has(null)) {
    return { ready: false, edge: null, reason: 'a ship left the table without an edge recorded (16.5)' }
  }
  if (edges.size > 1) {
    return { ready: false, edge: null, reason: 'the ships must all leave by the same table edge (16.5)' }
  }
  return { ready: true, edge: ships[0].exitEdge, reason: '' }
}

/**
 * The speed bonus (16.5): *"If one player has any ship that has a higher thrust
 * than all opposing ships, then add 2 to the die roll."*
 *
 * A comparison of maxima, and a strict one, so at most one side can ever hold
 * it — which is what *"if one player has"* expects. The book's example is
 * exactly this: thrust-8 escorts against a fleet with *"nothing with a thrust
 * above 6"*.
 *
 * **[reading]** Ships only, at their current ratings. Fighters and gunboats
 * have speeds in MU rather than thrust ratings and 16.5 says *"ship"*; a
 * crippled drive counts at what it can actually do (4.11), because the whole
 * clause is a question about who can outrun whom. An empty fleet on either side
 * scores nothing rather than winning by vacuous truth — with no opposing ships
 * there is no chase to be faster than.
 */
export function fasterFleetBonus(mine: readonly number[], theirs: readonly number[]): number {
  if (mine.length === 0 || theirs.length === 0) return 0
  return Math.max(...mine) > Math.max(...theirs) ? DISENGAGE_THRUST_BONUS : 0
}

/**
 * Who wins the disengagement (16.5): *"If the final total of the player who is
 * trying to disengage is equal to or higher than their opponent's roll, they
 * have successfully disengaged."*
 *
 * **Ties go to the runner.** With no bonus in play that is 21 of 36 outcomes —
 * 58% — and it is deliberate: the alternative on offer is playing out a stern
 * chase nobody wants to play. Split out from the dice so the tie can be
 * enumerated over all 36 pairs rather than sampled.
 */
export function disengagementSucceeds(disengagingTotal: number, pursuingTotal: number): boolean {
  return disengagingTotal >= pursuingTotal
}

export interface DisengagementResult {
  disengagingRoll: number
  pursuingRoll: number
  disengagingBonus: number
  pursuingBonus: number
  disengagingTotal: number
  pursuingTotal: number
  disengaged: boolean
  /** *"The pursuing player may elect to continue pursuit"* — an offer, not a consequence. */
  pursuitAvailable: boolean
  detail: string
}

/**
 * Roll the abstract disengagement (16.5).
 *
 * *"When all the ships are off the table edge, each player rolls a D6."* The
 * disengaging player's die is drawn first — the book does not order them and
 * something has to, or a replay is not a replay.
 *
 * A failed attempt is not the end: *"the fleeing player may then attempt the
 * disengagement again by leaving the opposite edge of the new playing area"*,
 * with fresh dice and no memory of this one.
 */
export function resolveDisengagement(
  disengagingThrusts: readonly number[],
  pursuingThrusts: readonly number[],
  rng: Rng,
): DisengagementResult {
  const disengagingBonus = fasterFleetBonus(disengagingThrusts, pursuingThrusts)
  const pursuingBonus = fasterFleetBonus(pursuingThrusts, disengagingThrusts)

  const disengagingRoll = d6(rng)
  const pursuingRoll = d6(rng)
  const disengagingTotal = disengagingRoll + disengagingBonus
  const pursuingTotal = pursuingRoll + pursuingBonus
  const disengaged = disengagementSucceeds(disengagingTotal, pursuingTotal)

  return {
    disengagingRoll,
    pursuingRoll,
    disengagingBonus,
    pursuingBonus,
    disengagingTotal,
    pursuingTotal,
    disengaged,
    pursuitAvailable: !disengaged,
    detail:
      `disengaging ${disengagingRoll}${disengagingBonus ? `+${disengagingBonus}` : ''} = ${disengagingTotal} ` +
      `vs pursuing ${pursuingRoll}${pursuingBonus ? `+${pursuingBonus}` : ''} = ${pursuingTotal} → ` +
      (disengaged ? 'away clean' : 'pursuit may continue as a stern chase'),
  }
}

// ---------------------------------------------------------------------------
// 16.6 Docking
// ---------------------------------------------------------------------------

/** *"Within 3 MU of the target ship/starbase at the end of the turn"* (16.6). */
export const DOCKING_RANGE = 3

/**
 * Where a ship is in the docking clock (16.6).
 *
 * `approach-held` is the end of the turn the conditions were met on;
 * `docked` is *"the following turn"*; `casting-off` is the *"one full turn"*
 * undocking costs.
 */
export type DockPhase = 'free' | 'approach-held' | 'docked' | 'casting-off'

export interface DockVector {
  position: Point
  facing: Course
  velocity: number
}

export interface DockApproach {
  met: boolean
  range: number
  /** Which branch of the rule applied — the target's state decides, not the ship's. */
  targetStationary: boolean
  reason: string
}

/**
 * Test the approach at the end of movement (16.6).
 *
 * *"The ship's movement orders must be plotted so that it ends up within 3 MU
 * of the target ship/starbase at the end of the turn. If the target is
 * stationary, the ship must also come to a dead stop, otherwise it must exactly
 * match both course and velocity with the target ship or starbase at the end of
 * the turn."*
 *
 * Which branch applies is decided by the *target*, not by the docking ship.
 * Range is between model centres, the convention 4.2 and 17.1 use for
 * everything else, and it is a "within", so exactly 3.0 MU docks.
 *
 * **[reading]** Against a stationary target the facing is free. The rule asks
 * only for a dead stop, and asks for a course match in the *"otherwise"* branch
 * — the two are alternatives joined by "otherwise", not a general rule with an
 * addition. A halted ship has no course to match anyway: at velocity 0 its
 * facing is an orientation, not a heading.
 */
export function dockingApproach(ship: DockVector, target: DockVector): DockApproach {
  const range = distance(ship.position, target.position)
  const targetStationary = target.velocity === 0

  if (range > DOCKING_RANGE + EPSILON) {
    return {
      met: false,
      range,
      targetStationary,
      reason: `${range.toFixed(1)} MU from the target, beyond the ${DOCKING_RANGE} MU docking envelope (16.6)`,
    }
  }
  if (targetStationary) {
    if (ship.velocity !== 0) {
      return { met: false, range, targetStationary, reason: 'the target is stationary, so the ship must come to a dead stop (16.6)' }
    }
    return { met: true, range, targetStationary, reason: '' }
  }
  if (ship.velocity !== target.velocity) {
    return { met: false, range, targetStationary, reason: 'velocity does not exactly match the target (16.6)' }
  }
  if (ship.facing !== target.facing) {
    return { met: false, range, targetStationary, reason: 'course does not exactly match the target (16.6)' }
  }
  return { met: true, range, targetStationary, reason: '' }
}

export interface DockStatus {
  phase: DockPhase
  targetId: string | null
  /** Game turn the current phase began on. */
  sinceTurn: number | null
}

export const UNDOCKED: DockStatus = { phase: 'free', targetId: null, sinceTurn: null }

/** Record a successful approach at the end of the turn it was flown (16.6). */
export function holdApproach(status: DockStatus, targetId: string, turn: number): DockStatus {
  if (status.phase !== 'free') return status
  return { phase: 'approach-held', targetId, sinceTurn: turn }
}

/**
 * *"On the following turn, the ship may be considered docked"* (16.6).
 *
 * **[reading]** The match is spent once, not renewed: the approach flown on
 * turn N earns docked status on turn N+1 without the 3 MU and matched-velocity
 * test being flown a second time. Read the other way, docking would be a
 * two-turn manoeuvre under fire rather than a one-turn manoeuvre with a
 * one-turn delay. The sentence is written as a statement about the ship's
 * condition, and the author names a duration explicitly when he means one —
 * *"one full turn is also required to cast off"*, in the very next line.
 */
export function completeDocking(status: DockStatus, turn: number): DockStatus {
  if (status.phase !== 'approach-held' || status.sinceTurn === null) return status
  if (turn <= status.sinceTurn) return status
  return { ...status, phase: 'docked', sinceTurn: turn }
}

/** Declare the cast-off (16.6): *"one full turn is also required to 'cast off' and undock again"*. */
export function orderCastOff(status: DockStatus, turn: number): DockStatus {
  if (status.phase !== 'docked') return status
  return { ...status, phase: 'casting-off', sinceTurn: turn }
}

/**
 * Finish undocking (16.6).
 *
 * **[reading]** The cast-off turn is spent casting off — *"after which the ship
 * may maneuver as normal"* puts free manoeuvre after the full turn, so the ship
 * plots no move on the turn it is letting go. The alternative, that the ship
 * undocks and moves in the same turn, makes the clause say nothing at all.
 */
export function completeCastOff(status: DockStatus, turn: number): DockStatus {
  if (status.phase !== 'casting-off' || status.sinceTurn === null) return status
  if (turn <= status.sinceTurn) return status
  return { phase: 'free', targetId: null, sinceTurn: null }
}

export function isDocked(status: DockStatus): boolean {
  return status.phase === 'docked'
}

/** Only a free ship writes an ordinary movement order (16.6). */
export function canManoeuvre(status: DockStatus): boolean {
  return status.phase === 'free'
}

// ---------------------------------------------------------------------------
// 16.7 Ramming
// ---------------------------------------------------------------------------

/** *"Only on a roll of 6 may the ramming attempt proceed"* (16.7) — a default, not a constant. */
export const RAM_NERVE_TARGET = 6

/** *"The ship must end the movement within 2 MU of the intended target ship"* (16.7). */
export const RAM_CONTACT_RANGE = 2

/**
 * What a ship that rams automatically should cost (16.7, Ramming ability).
 *
 * *"Any ship that can automatically attempt to ram should have an extra cost of
 * at least +1 per mass of the ship."* A floor rather than a price, and it buys
 * only the waiver of the nerve roll — a scenario that merely softens the roll
 * to 5+ for a fanatical race is an agreement between players and costs nothing
 * in the text.
 */
export function automaticRamSurcharge(mass: number): number {
  return Math.max(0, mass)
}

/**
 * *"In order to attempt the ram, the ship must end the movement within 2 MU of
 * the intended target ship (or models touching in the case of large ship
 * models)"* (16.7).
 *
 * `modelsTouching` is that parenthesis: with big models the physical test
 * replaces the measured one, and a table where the hulls are in contact
 * satisfies the rule however the centres measure.
 */
export function withinRammingContact(
  attacker: Point,
  target: Point,
  modelsTouching = false,
): { within: boolean; range: number } {
  const range = distance(attacker, target)
  return { within: modelsTouching || range <= RAM_CONTACT_RANGE + EPSILON, range }
}

/**
 * The evasion contest (16.7): *"If the attacker ends up with the highest total,
 * the ram is successful … If the target's total is equal or higher, it has
 * evaded the ramming attempt."*
 *
 * **A tie is an evasion.** Between equal-thrust ships the attacker takes 15 of
 * 36, 41.7%, which with the one-in-six nerve roll puts a declared ram on
 * target 5 times in 72. Split out from the dice so those 36 pairs can be
 * enumerated in a test instead of sampled.
 */
export function ramSucceeds(attackerTotal: number, targetTotal: number): boolean {
  return attackerTotal > targetTotal
}

/** A ship in a ram, as the rule needs to see it (16.7). */
export interface RamShip {
  position: Point
  /** Current thrust rating (4.11) — a shot-out drive is both a worse rammer and easier to hit. */
  thrust: number
  /** Hull boxes remaining *before* contact. */
  hullBoxes: number
}

export interface RamDamageReport {
  attackerRoll: number
  targetRoll: number
  /** Attacker's die × attacker's remaining hull boxes. */
  damageToTarget: number
  /** Target's die × target's remaining hull boxes. */
  damageToAttacker: number
  mode: DamageMode
}

/**
 * The exchange (16.7): *"each player rolls another D6 and multiplies the result
 * by the current (remaining) hull boxes that the ship has. The final result of
 * this is the number of damage points inflicted on the other ship."*
 *
 * Both halves are counter-intuitive, and the book's example is the proof of
 * each. A corvette on 2 of 3 boxes rams an undamaged 16-box heavy cruiser:
 *
 * - The multiplier is the roller's **own** remaining boxes and the product
 *   lands on the **other** ship. Mass appears nowhere; a big healthy hull is a
 *   heavy hammer. *"The corvette player rolls a 4, which inflicts 8 points of
 *   damage on the cruiser"* — 4 × 2, not 4 × 16.
 * - Both counts are read **before** the ram. Applied in sequence the cruiser
 *   would be on 8 boxes and would return 3 × 8 = 24; the book says *"the
 *   cruiser owner rolls a 3, thus doing 48 points to the corvette"*. So the
 *   exchange is simultaneous. That is arithmetic, not a reading.
 *
 * **[reading]** The damage is reported as ordinary damage — `mode: 'standard'`,
 * so `combat.applyDamage` meets it with armour in the usual way (4.8, 4.9).
 * 16.7 speaks only of *"damage points"* and never mentions screens, armour or
 * the damage modes; screens do not enter into it either way, since 4.7's
 * screens modify beam *dice* and a ram produces a total with no dice to modify.
 * The alternative was `'AP'` — a collision arguably shears through plate, and
 * it is the more evocative reading — rejected because 4.9's modes are something
 * a weapon *declares*, ramming declares none, and inventing armour-piercing
 * here would silently double the deadliest attack in the book against exactly
 * the ships built to survive it.
 *
 * Both dice are drawn together, the attacker's first.
 */
export function ramDamage(
  attackerHullBoxes: number,
  targetHullBoxes: number,
  rng: Rng,
): RamDamageReport {
  const [attackerRoll, targetRoll] = rollD6(2, rng)
  return {
    attackerRoll,
    targetRoll,
    damageToTarget: attackerRoll * Math.max(0, attackerHullBoxes),
    damageToAttacker: targetRoll * Math.max(0, targetHullBoxes),
    mode: 'standard',
  }
}

/** How far a declared ram got (16.7). */
export type RamOutcome = 'out-of-range' | 'lost-nerve' | 'evaded' | 'contact'

export interface RamResult {
  outcome: RamOutcome
  range: number
  /** The number the nerve roll had to make, 6 unless the players agreed otherwise. */
  nerveTarget: number
  /** Null when no die was drawn — out of range, or an automatic rammer. */
  nerveRoll: number | null
  attackerEvasionRoll: number | null
  targetEvasionRoll: number | null
  attackerTotal: number | null
  targetTotal: number | null
  damage: RamDamageReport | null
  detail: string
}

export interface RamOptions {
  /**
   * *"Players may agree that certain game scenarios and/or certain races
   * tactics may make ramming attacks more likely, and hence reduce this
   * required die roll for them"* (16.7, Ramming ability). 1 or less is a ship
   * that rams automatically, and 16.7 prices that at `automaticRamSurcharge`.
   */
  nerveTarget?: number
  /** *"Or models touching in the case of large ship models"* (16.7). */
  modelsTouching?: boolean
}

/**
 * Resolve a declared ram, end of the Ship Movement Phase (16.7).
 *
 * Four gates, all of which must fall: declared in the movement orders before
 * anything moved, ended the move inside 2 MU, made the nerve roll, and beat the
 * target in the evasion contest. Only then does anything take damage — and then
 * both ships do.
 *
 * **[reading]** A die is drawn only when it can change something. Out of range,
 * the nerve roll is skipped rather than rolled and thrown away; a `nerveTarget`
 * of 1 or less is automatic and rolls nothing. The book presents the D6 first
 * and the range requirement second, so a literal reading rolls either way — the
 * outcome is identical, but the *replay* is not, because every die drawn
 * advances the seeded RNG and shifts every later roll in the battle. Rolling
 * only for decisions keeps the stream tied to events that happened.
 *
 * Die order: nerve, attacker's evasion, target's evasion, then both damage
 * dice. As with 16.5 the book does not order them and something must.
 *
 * Damage is reported, not applied. *"The result is one vaporized corvette, and
 * a badly damaged cruiser"* is the caller's conclusion to draw.
 */
export function resolveRam(
  attacker: RamShip,
  target: RamShip,
  rng: Rng,
  opts: RamOptions = {},
): RamResult {
  const nerveTarget = opts.nerveTarget ?? RAM_NERVE_TARGET
  const contact = withinRammingContact(attacker.position, target.position, opts.modelsTouching)

  const empty = {
    range: contact.range,
    nerveTarget,
    nerveRoll: null,
    attackerEvasionRoll: null,
    targetEvasionRoll: null,
    attackerTotal: null,
    targetTotal: null,
    damage: null,
  }

  if (!contact.within) {
    return {
      ...empty,
      outcome: 'out-of-range',
      detail: `ram declared but the ship ended ${contact.range.toFixed(1)} MU away, outside ${RAM_CONTACT_RANGE} MU (16.7)`,
    }
  }

  // An automatically-ramming ship (16.7, Ramming ability) has no nerve to test.
  const nerveRoll = nerveTarget <= 1 ? null : d6(rng)
  if (nerveRoll !== null && nerveRoll < nerveTarget) {
    return {
      ...empty,
      outcome: 'lost-nerve',
      nerveRoll,
      detail: `nerve roll ${nerveRoll}, needed ${nerveTarget}: the attempt does not proceed (16.7)`,
    }
  }

  const attackerEvasionRoll = d6(rng)
  const targetEvasionRoll = d6(rng)
  const attackerTotal = attackerEvasionRoll + attacker.thrust
  const targetTotal = targetEvasionRoll + target.thrust

  const contested = {
    ...empty,
    nerveRoll,
    attackerEvasionRoll,
    targetEvasionRoll,
    attackerTotal,
    targetTotal,
  }

  if (!ramSucceeds(attackerTotal, targetTotal)) {
    return {
      ...contested,
      outcome: 'evaded',
      detail:
        `attacker ${attackerEvasionRoll}+${attacker.thrust} = ${attackerTotal} vs ` +
        `target ${targetEvasionRoll}+${target.thrust} = ${targetTotal}: evaded (16.7)`,
    }
  }

  const damage = ramDamage(attacker.hullBoxes, target.hullBoxes, rng)
  return {
    ...contested,
    outcome: 'contact',
    damage,
    detail:
      `attacker ${attackerEvasionRoll}+${attacker.thrust} = ${attackerTotal} vs ` +
      `target ${targetEvasionRoll}+${target.thrust} = ${targetTotal}: contact — ` +
      `${damage.attackerRoll}×${attacker.hullBoxes} = ${damage.damageToTarget} onto the target, ` +
      `${damage.targetRoll}×${target.hullBoxes} = ${damage.damageToAttacker} onto the attacker (16.7)`,
  }
}
