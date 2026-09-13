/**
 * Full Thrust: Project Continuum — cinematic movement (section 3).
 *
 * Everything a ship does between "write orders" and "move ships" lives here:
 * the thrust budget (3.2, 3.3), order validation and its written notation
 * (3.5), flying the order (3.4), emergency thrust and its dice (3.6),
 * squadrons (3.7), collisions (3.8) and leaving the table (3.9).
 *
 * The two-leg course-change geometry itself is `moveShip` in `geometry.ts`;
 * this module never restates that rounding rule, it calls it.
 *
 * The rules are written out in full, with quotations, in
 * `docs/rules/movement.md`.
 */

import { beamDamage, d6, type Rng } from './dice'
import { advance, courseVector, moveShip, turnCourse } from './geometry'
import { rollBudget, ROLL_THRUST_COST } from './specialmoves'
import type {
  Course,
  DriveDef,
  MovementOrder,
  Placement,
  Point,
  TurnDirection,
} from './types'

// ---------------------------------------------------------------------------
// Drive state (3.2, 3.3, 4.11)
// ---------------------------------------------------------------------------

/**
 * A main drive as it stands right now (3.2, 4.11).
 *
 * `DriveDef` in `types.ts` is what is *printed* on the SSD. A drive that has
 * failed a threshold check is running at half that, and every limit in section
 * 3 — including emergency thrust, which says so in as many words — works off
 * the current rating rather than the printed one. The two therefore have to be
 * different objects.
 */
export interface DriveState {
  /** Thrust rating as printed on the SSD (3.2). */
  rating: number
  /** Advanced drives may put their whole rating into a course change (3.3). */
  advanced: boolean
  /**
   * 'Destroyed' results the main drive has taken, from threshold checks (4.11)
   * or from emergency thrust (3.6). One halves it, two disable it.
   */
  hits: number
  /** Prior uses of emergency thrust this scenario — each is +1 die (3.6). */
  emergencyThrustUses: number
  /**
   * Whether the ship changed facing on the previous game turn. Only a rating-1
   * drive cares: it may not turn on consecutive turns (3.2).
   */
  turnedLastTurn: boolean
}

/** A fresh, undamaged drive from an SSD's printed figures (3.2, 3.3). */
export function driveFromDef(def: DriveDef): DriveState {
  return {
    rating: def.thrust,
    advanced: def.advanced,
    hits: 0,
    emergencyThrustUses: 0,
    turnedLastTurn: false,
  }
}

/**
 * The drive's *current* thrust rating (4.11).
 *
 * "When the drive first suffers a 'destroyed' roll on a threshold check it is
 * reduced to half the original thrust rating, provided it has a drive rating
 * above 1. If it is then hit a second time ... it is disabled completely. A
 * drive rated only 1 is immediately disabled by the first threshold failure."
 *
 * The rulebook does not say which way half rounds. Down is the only reading
 * under which the two sentences agree: half of 1 rounded down is 0, which is
 * precisely the "a drive rated only 1 is immediately disabled" clause, so that
 * clause is a restatement rather than an exception.
 */
export function currentThrust(drive: DriveState): number {
  if (drive.hits <= 0) return Math.max(0, drive.rating)
  if (drive.hits === 1) return Math.floor(Math.max(0, drive.rating) / 2)
  return 0
}

/**
 * Record `hits` further 'destroyed' results against the main drive (4.11, 3.6).
 * Capped at two, because two is already a dead drive and a third would have
 * nothing left to take away.
 */
export function applyDriveHits(drive: DriveState, hits: number): DriveState {
  return { ...drive, hits: Math.min(2, drive.hits + Math.max(0, hits)) }
}

// ---------------------------------------------------------------------------
// Ship movement state
// ---------------------------------------------------------------------------

/** Where a ship is, how fast it is going, and what its drive can still do. */
export interface MovementState {
  placement: Placement
  /** Velocity in MU at the start of the turn (3.1). */
  velocity: number
  drive: DriveState
}

/**
 * The order a ship flies when it was given none, or when what it was given is
 * impossible (3.5): "Any ship with no orders will move straight ahead at an
 * unchanged speed, as will any that are given impossible orders."
 */
export const STRAIGHT_AHEAD: MovementOrder = { turn: null, accel: 0 }

// ---------------------------------------------------------------------------
// Thrust budget (3.2, 3.3, 3.6)
// ---------------------------------------------------------------------------

/** Signed clock points for a turn leg: starboard is clockwise, i.e. positive. */
function signedTurn(leg: { direction: TurnDirection; points: number } | null | undefined): number {
  if (!leg || leg.points === 0) return 0
  return leg.direction === 'starboard' ? leg.points : -leg.points
}

/** Course points an order spends, counting both legs of a double change (3.5). */
export function orderTurnPoints(order: MovementOrder): number {
  return Math.abs(order.turn?.points ?? 0) + Math.abs(order.secondTurn?.points ?? 0)
}

/** True when the order is a double course change rather than a single one (3.5). */
export function isDoubleCourseChange(order: MovementOrder): boolean {
  return (order.secondTurn?.points ?? 0) > 0
}

/**
 * Course points the ship may spend without emergency thrust (3.2, 3.3).
 *
 * Half the current rating rounded down, or the whole rating for an advanced
 * drive. Rating 1 is the documented exception: half of 1 is 0, yet 3.2 says
 * such a ship "can change facing by 1 point, but not on consecutive game
 * turns", so the allowance is 1 — and 0 if it turned last turn. That exception
 * is written against the *rating*, so it bites a thrust-2 drive that has been
 * halved to 1 just as it bites a printed thrust-1 drive.
 */
export function standardTurnAllowance(drive: DriveState): number {
  const rating = currentThrust(drive)
  if (rating === 1) return drive.turnedLastTurn ? 0 : 1
  return drive.advanced ? rating : Math.floor(rating / 2)
}

/**
 * Extra thrust points emergency thrust buys (3.6): "additional thrust points
 * equal to 50% of the drive's current rating, rounded down".
 */
export function emergencyThrustBonus(drive: DriveState): number {
  return Math.floor(currentThrust(drive) / 2)
}

/** How one order's thrust is split, and what the drive allows (3.2, 3.3, 3.6). */
export interface ThrustBudget {
  /** Rating as printed on the SSD (3.2). */
  printedRating: number
  /** Rating after drive damage — every limit below is computed off this (4.11). */
  rating: number
  advanced: boolean
  /** Whether the order declares emergency thrust (3.6). */
  emergencyThrust: boolean
  /** Total thrust points the ship may spend this turn. */
  available: number
  /** The most of `available` that may go on course changes. */
  turnAllowance: number
  /** Points spent turning, both legs of a double change included. */
  turnPoints: number
  /** Points spent changing velocity — one point per MU (3.2). */
  velocityPoints: number
  /** The one point a roll costs, or zero (16.2). */
  rollPoints: number
  totalUsed: number
  /** Points left unspent. Negative means the order overruns the drive. */
  remaining: number
}

/**
 * Break an order down against a drive (3.2).
 *
 * "The thrust rating of the ship is the combined acceleration, deceleration,
 * and course changing that can be performed in one turn" — so accel and turn
 * come out of one pot, and the turn also has its own sub-cap.
 */
export function thrustBudget(order: MovementOrder, drive: DriveState): ThrustBudget {
  const rating = currentThrust(drive)
  const emergencyThrust = order.emergencyThrust === true
  const available = emergencyThrust ? rating + emergencyThrustBonus(drive) : rating
  const standard = standardTurnAllowance(drive)
  // 3.6 lifts the half-rating cap on turning but names no replacement, so the
  // only remaining ceiling is the budget itself. Turning more than six points
  // one way is never worth doing anyway — the short way round is cheaper.
  const beforeRoll = emergencyThrust ? Math.max(standard, available) : standard

  // 16.2: a roll "expends 1 thrust factor which comes off the turning
  // allowance". `specialmoves.rollBudget` owns that arithmetic; here it is
  // simply one more claim on the same pot, so the thrust pips in the order
  // panel show the roll spent alongside the turn and the acceleration.
  const rollPoints = order.roll === true ? ROLL_THRUST_COST : 0
  const turnAllowance = rollPoints > 0 ? rollBudget(available, beforeRoll).turnAllowance : beforeRoll

  const turnPoints = orderTurnPoints(order)
  const velocityPoints = Math.abs(order.accel)
  const totalUsed = turnPoints + velocityPoints + rollPoints

  return {
    printedRating: drive.rating,
    rating,
    advanced: drive.advanced,
    emergencyThrust,
    available,
    turnAllowance,
    turnPoints,
    velocityPoints,
    rollPoints,
    totalUsed,
    remaining: available - totalUsed,
  }
}

// ---------------------------------------------------------------------------
// Order validation (3.5)
// ---------------------------------------------------------------------------

/** Why an order is impossible (3.5). */
export type OrderViolation =
  /** The order spends more thrust than the drive has (3.2). */
  | 'thrust-exceeded'
  /** More thrust went on the course change than the drive allows (3.2, 3.3). */
  | 'turn-exceeded'
  /** "Ships may not have negative velocities" (3.1). */
  | 'negative-velocity'
  /** The main drive is out; the ship coasts (4.11). */
  | 'drive-disabled'
  /** A rating-1 drive may not change facing on consecutive turns (3.2). */
  | 'consecutive-turn'
  /** Not a well-formed order at all — fractional or negative components. */
  | 'malformed'

export interface OrderValidation {
  legal: boolean
  violations: OrderViolation[]
  budget: ThrustBudget
  /** Velocity the ship would be on after the order (3.1). */
  newVelocity: number
}

function isWholeNonNegative(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

/**
 * Is this order legal for this ship's drive and current velocity? (3.2, 3.5)
 *
 * An illegal order is not an error to reject at the table — 3.5 says the ship
 * flies straight ahead at unchanged speed instead — so callers get the reasons
 * back for the log and `applyOrder` does the substitution.
 */
export function validateOrder(order: MovementOrder, ship: MovementState): OrderValidation {
  const budget = thrustBudget(order, ship.drive)
  const violations: OrderViolation[] = []

  const malformed =
    !Number.isInteger(order.accel) ||
    (order.turn !== null && order.turn !== undefined && !isWholeNonNegative(order.turn.points)) ||
    (order.secondTurn !== null &&
      order.secondTurn !== undefined &&
      !isWholeNonNegative(order.secondTurn.points))
  if (malformed) violations.push('malformed')

  if (budget.rating === 0 && budget.totalUsed > 0) {
    violations.push('drive-disabled')
  } else {
    if (budget.totalUsed > budget.available) violations.push('thrust-exceeded')
    if (budget.turnPoints > budget.turnAllowance) {
      // A rating-1 drive that turned last turn has an allowance of 0, and the
      // reason a player wants to see is the consecutive-turn rule, not a bare
      // "too much turning" (3.2).
      if (budget.rating === 1 && ship.drive.turnedLastTurn && !budget.emergencyThrust) {
        violations.push('consecutive-turn')
      } else {
        violations.push('turn-exceeded')
      }
    }
  }

  const newVelocity = ship.velocity + order.accel
  if (newVelocity < 0) violations.push('negative-velocity')

  return {
    legal: violations.length === 0,
    violations,
    budget,
    newVelocity: Math.max(0, newVelocity),
  }
}

/**
 * Cut an order down to something the drive can actually fly (3.5, 3.6).
 *
 * The rulebook leaves re-plotting to the player — this is the engine's default
 * for the cases where nobody is there to re-plot: after a failed emergency
 * thrust roll, or for an AI-controlled ship. The course change is preserved
 * first, because where a ship is pointing decides its fire arcs and whether it
 * stays on the table; leftover budget then goes to the velocity change.
 */
export function clampOrder(order: MovementOrder, ship: MovementState): MovementOrder {
  const drive = ship.drive
  const rating = currentThrust(drive)
  const turnAllowance = standardTurnAllowance(drive)

  // 16.2: a roll is an attitude, not a course change, and it survives the
  // re-plot as long as the drive has one point to spend on it. It is charged
  // before anything else because the ship turns over at the start of its move.
  const roll = order.roll === true && rating >= ROLL_THRUST_COST
  const spentOnRoll = roll ? ROLL_THRUST_COST : 0

  let turnLeft = Math.max(0, Math.min(turnAllowance - spentOnRoll, rating - spentOnRoll))
  const clampLeg = (
    leg: { direction: TurnDirection; points: number } | null | undefined,
  ): { direction: TurnDirection; points: number } | null => {
    if (!leg || leg.points <= 0) return null
    const points = Math.min(Math.floor(leg.points), turnLeft)
    turnLeft -= points
    return points > 0 ? { direction: leg.direction, points } : null
  }

  const turn = clampLeg(order.turn)
  const secondTurn = clampLeg(order.secondTurn)
  const spentOnTurn = (turn?.points ?? 0) + (secondTurn?.points ?? 0)

  const accelRoom = rating - spentOnRoll - spentOnTurn
  const wanted = Math.trunc(order.accel)
  const magnitude = Math.min(Math.abs(wanted), Math.max(0, accelRoom))
  let accel = Math.sign(wanted) * magnitude
  // "Ships may not have negative velocities" (3.1): a deceleration can only go
  // as far as a dead stop.
  if (ship.velocity + accel < 0) accel = -ship.velocity

  return { turn, secondTurn, accel, emergencyThrust: false, roll }
}

// ---------------------------------------------------------------------------
// Flying the order (3.1, 3.4, 3.5)
// ---------------------------------------------------------------------------

/** One straight stretch of a turn's movement, for drawing and for the log. */
export interface MovementLeg {
  from: Point
  to: Point
  /** The course flown on this leg (3.4). */
  course: Course
  distance: number
}

export interface MovementResult {
  /** The order as written by the player. */
  ordered: MovementOrder
  /** The order actually flown — `STRAIGHT_AHEAD` if the plot was impossible (3.5). */
  flown: MovementOrder
  legal: boolean
  violations: OrderViolation[]
  budget: ThrustBudget
  /** Where the ship ends up, facing its new course (3.1). */
  placement: Placement
  /** Velocity after the order, which is also the distance just flown (3.1). */
  velocity: number
  legs: MovementLeg[]
  /** Drive with `turnedLastTurn` rolled forward, ready for next turn (3.2). */
  drive: DriveState
}

function straightLeg(from: Point, course: Course, distance: number): MovementLeg {
  return { from, to: advance(from, course, distance), course, distance }
}

/**
 * Fly one order's path (3.4, 3.5).
 *
 * A single course change is `moveShip` — half the change before moving, the
 * rest at the midpoint, odd numbers rounding down then up. A *double* course
 * change overrides that split: 3.5 says the ship "always makes the first course
 * change before moving and the second at the half way point, even if the first
 * change is greater than the second", so the player's split is flown as
 * written and `moveShip` cannot express it.
 */
function flyPath(
  from: Point,
  course: Course,
  velocity: number,
  order: MovementOrder,
): { position: Point; course: Course; legs: MovementLeg[] } {
  const firstLegDistance = Math.floor(velocity / 2)
  const secondLegDistance = velocity - firstLegDistance

  if (isDoubleCourseChange(order)) {
    const midCourse = turnCourse(course, signedTurn(order.turn))
    const first = straightLeg(from, midCourse, firstLegDistance)
    const finalCourse = turnCourse(midCourse, signedTurn(order.secondTurn))
    const second = straightLeg(first.to, finalCourse, secondLegDistance)
    return { position: second.to, course: finalCourse, legs: [first, second] }
  }

  const points = signedTurn(order.turn)
  const moved = moveShip(from, course, velocity, points)
  if (points === 0) {
    return {
      position: moved.position,
      course: moved.course,
      legs: [straightLeg(from, course, velocity)],
    }
  }

  // `moveShip` owns the rounding; the midpoint is reconstructed here only so
  // the path can be drawn, and the final leg is anchored on `moveShip`'s
  // answer so the two can never disagree.
  const sign = Math.sign(points)
  const midCourse = turnCourse(course, sign * Math.floor(Math.abs(points) / 2))
  const mid = advance(from, midCourse, firstLegDistance)
  return {
    position: moved.position,
    course: moved.course,
    legs: [
      { from, to: mid, course: midCourse, distance: firstLegDistance },
      { from: mid, to: moved.position, course: moved.course, distance: secondLegDistance },
    ],
  }
}

/**
 * Apply a movement order and hand back the new placement and velocity
 * (3.1, 3.4, 3.5).
 *
 * The distance flown is the velocity *after* acceleration: "Velocity changes
 * take effect immediately at the beginning of each game turn: a ship ordered to
 * change from 8 MU to 12 MU velocity moves the full 12 MU in that turn" (3.1).
 * An impossible order is replaced by straight ahead at unchanged speed (3.5).
 */
export function applyOrder(ship: MovementState, order: MovementOrder): MovementResult {
  const validation = validateOrder(order, ship)
  const flown = validation.legal ? order : STRAIGHT_AHEAD
  const velocity = Math.max(0, ship.velocity + flown.accel)

  const path = flyPath(ship.placement.position, ship.placement.facing, velocity, flown)
  const turned = orderTurnPoints(flown) > 0

  return {
    ordered: order,
    flown,
    legal: validation.legal,
    violations: validation.violations,
    budget: validation.budget,
    // 3.1: "the course and facing are always identical" under cinematic movement.
    placement: { position: path.position, facing: path.course },
    velocity,
    legs: path.legs,
    drive: { ...ship.drive, turnedLastTurn: turned },
  }
}

// ---------------------------------------------------------------------------
// Written order notation (3.5)
// ---------------------------------------------------------------------------

/** An order as read off an order sheet (3.5). */
export interface ParsedOrder {
  /** The velocity written in front of the order, if any. */
  startVelocity: number | null
  /** The velocity written after the colon, if any. */
  finalVelocity: number | null
  order: MovementOrder
}

function legToNotation(leg: { direction: TurnDirection; points: number } | null | undefined): string {
  if (!leg || leg.points <= 0) return ''
  return (leg.direction === 'port' ? 'P' : 'S') + String(leg.points)
}

/**
 * Write an order in the rulebook's notation (3.5): "an order of `8P2+4: 12`
 * would indicate a ship with an initial velocity of 8 making a two point turn
 * to port (P), plus acceleration of 4 MU, with a new final velocity of 12".
 *
 * The trailing ` ET` is this engine's marker for emergency thrust; 3.6 gives it
 * no notation of its own.
 */
export function formatOrder(order: MovementOrder, startVelocity: number): string {
  const turns = legToNotation(order.turn) + legToNotation(order.secondTurn)
  const accel = order.accel === 0 ? '' : (order.accel > 0 ? '+' : '-') + String(Math.abs(order.accel))
  const et = order.emergencyThrust === true ? ' ET' : ''
  // 16.2 says to write "Roll" in the order and gives no shorthand; R keeps the
  // line the same shape as the rest of the notation.
  const roll = order.roll === true ? ' R' : ''
  const final = Math.max(0, startVelocity + order.accel)
  return `${startVelocity}${turns}${accel}${et}${roll}: ${final}`
}

const ORDER_PATTERN = /^\s*(\d+)?\s*((?:[ps]\s*\d+\s*){0,2})([+-]\s*\d+)?\s*(et)?\s*(?::\s*(\d+))?\s*$/i
const TURN_LEG_PATTERN = /([ps])\s*(\d+)/gi

/**
 * Read a written order (3.5). Returns `null` for anything that is not an order
 * — including three or more turn legs, since 3.5 allows at most a *double*
 * course change.
 */
export function parseOrder(text: string): ParsedOrder | null {
  const match = ORDER_PATTERN.exec(text)
  if (!match) return null

  const legs: Array<{ direction: TurnDirection; points: number }> = []
  const turnText = match[2] ?? ''
  TURN_LEG_PATTERN.lastIndex = 0
  let legMatch = TURN_LEG_PATTERN.exec(turnText)
  while (legMatch !== null) {
    const points = Number(legMatch[2])
    if (points > 0) {
      legs.push({ direction: legMatch[1].toLowerCase() === 'p' ? 'port' : 'starboard', points })
    }
    legMatch = TURN_LEG_PATTERN.exec(turnText)
  }
  if (legs.length > 2) return null

  const accelText = match[3]
  const accel = accelText === undefined ? 0 : Number(accelText.replace(/\s+/g, ''))

  const order: MovementOrder = {
    turn: legs[0] ?? null,
    secondTurn: legs[1] ?? null,
    accel,
    emergencyThrust: match[4] !== undefined,
  }

  return {
    startVelocity: match[1] === undefined ? null : Number(match[1]),
    finalVelocity: match[5] === undefined ? null : Number(match[5]),
    order,
  }
}

// ---------------------------------------------------------------------------
// Emergency thrust (3.6, optional)
// ---------------------------------------------------------------------------

/** Why each emergency-thrust die is being rolled (3.6). */
export interface EmergencyThrustDice {
  /** "Thrust points over rating - Plus 1 die." */
  overRating: boolean
  /** "Thrust points to turn over 1/2 rating - Plus 1 die." */
  overTurnLimit: boolean
  /** "Each prior use of ET during the current scenario - Plus 1 die." */
  priorUses: number
  dice: number
  /**
   * Whether the order actually pushes past a standard limit. A plot that stays
   * inside the drive's normal allowances is not a use of ET however it is
   * flagged, so it does not add a die to any later attempt.
   */
  isUse: boolean
}

/**
 * Count the dice an emergency-thrust attempt rolls (3.6).
 *
 * The second trigger is written as "over 1/2 rating", which is the normal
 * turning allowance of a *standard* drive. For an advanced drive 3.3 already
 * grants the full rating for turning at no risk, so the trigger is read here as
 * "over the drive's normal turning allowance". For a standard drive the two
 * readings are the same number.
 */
export function emergencyThrustDice(
  order: MovementOrder,
  drive: DriveState,
): EmergencyThrustDice {
  const rating = currentThrust(drive)
  const turnPoints = orderTurnPoints(order)
  const totalUsed = turnPoints + Math.abs(order.accel)

  const overRating = totalUsed > rating
  const overTurnLimit = turnPoints > standardTurnAllowance(drive)
  const priorUses = Math.max(0, drive.emergencyThrustUses)
  // A plot that stays inside the drive's normal allowances is not an attempt at
  // emergency thrust however it is flagged, so it rolls nothing and costs the
  // ship nothing on a later attempt (3.6).
  const isUse = overRating || overTurnLimit
  const dice = isUse ? (overRating ? 1 : 0) + (overTurnLimit ? 1 : 0) + priorUses : 0

  return { overRating, overTurnLimit, priorUses, dice, isUse }
}

/**
 * Score one emergency-thrust die (3.6): "scored as beam dice (i.e. 1-3 results
 * in 0, 4-5 results in 1, and 6 results in 2 but with NO re-roll)".
 *
 * That is the unscreened beam table exactly, so it is read off `beamDamage`
 * rather than copied. `rollBeamVolley` is deliberately *not* used: it would
 * re-roll the sixes, and the rule says not to.
 */
export function emergencyThrustScore(face: number): number {
  return beamDamage(face, 0)
}

/** The four rows of the emergency thrust chart (3.6). */
export type EmergencyThrustOutcome =
  /** 0 — "completely successful with no damage to the main drive". */
  | 'clean'
  /** 1 — "successful, but main drive takes damage as if it had failed a threshold roll". */
  | 'success-damaged'
  /** 2-3 — "ET fails, and main drive takes damage as if it had failed a threshold roll". */
  | 'failed'
  /** 4+ — "ET fails, and main drive takes damage as if it had failed TWO threshold rolls". */
  | 'failed-badly'

/** Read the emergency thrust chart for a total (3.6). */
export function emergencyThrustOutcome(total: number): EmergencyThrustOutcome {
  if (total <= 0) return 'clean'
  if (total === 1) return 'success-damaged'
  if (total <= 3) return 'failed'
  return 'failed-badly'
}

export interface EmergencyThrustResult {
  dice: EmergencyThrustDice
  rolls: number[]
  scores: number[]
  total: number
  outcome: EmergencyThrustOutcome
  /** False means the plot stands as written. */
  mustReplot: boolean
  /** Threshold-check failures the main drive takes (3.6, 4.11). */
  driveHits: number
  /** The drive after the attempt: damage applied, use counted (3.6). */
  drive: DriveState
}

/**
 * Roll for an emergency thrust attempt (3.6).
 *
 * "Immediately after Step 1 - Write Orders, dice are rolled for any ship using
 * ET to determine if it was successful and/or the ship's main drive was
 * damaged" — so this runs in phase 1 of the sequence of play, before
 * initiative.
 *
 * A failure means the ship "must immediately re-plot its movement using
 * standard thrust limitations"; `clampOrder` against the returned drive is the
 * engine's default re-plot. The drive returned already carries the ET damage,
 * because the damage and the failure are announced together, so the re-plot is
 * budgeted against the drive as it now is.
 */
export function rollEmergencyThrust(
  order: MovementOrder,
  drive: DriveState,
  rng: Rng,
): EmergencyThrustResult {
  const dice = emergencyThrustDice(order, drive)
  const rolls: number[] = []
  const scores: number[] = []
  for (let i = 0; i < dice.dice; i++) {
    const face = d6(rng)
    rolls.push(face)
    scores.push(emergencyThrustScore(face))
  }
  const total = scores.reduce((a, b) => a + b, 0)
  const outcome = emergencyThrustOutcome(total)
  const driveHits = outcome === 'clean' ? 0 : outcome === 'failed-badly' ? 2 : 1

  const damaged = applyDriveHits(drive, driveHits)
  return {
    dice,
    rolls,
    scores,
    total,
    outcome,
    mustReplot: outcome === 'failed' || outcome === 'failed-badly',
    driveHits,
    drive: {
      ...damaged,
      emergencyThrustUses: drive.emergencyThrustUses + (dice.isUse ? 1 : 0),
    },
  }
}

// ---------------------------------------------------------------------------
// Squadron operations (3.7)
// ---------------------------------------------------------------------------

/** The formations 3.7 recognises. */
export type SquadronFormation =
  | 'line-ahead'
  | 'line-abreast'
  | 'wedge'
  | 'diamond'
  /** "one large ship surrounded by a ring of up to six escorts". */
  | 'escort-ring'

export interface SquadronMember {
  id: string
  placement: Placement
  drive: DriveState
}

export interface Squadron {
  id: string
  formation: SquadronFormation
  members: SquadronMember[]
  /** Velocity of the squadron as a body (3.7 — they move on one order). */
  velocity: number
  /**
   * Models sharing a single stand: "Players mounting a squadron in such a way
   * would write a single order for the whole group but may not split the group
   * up" (3.7).
   */
  sharedBase?: boolean
}

export type SquadronViolation =
  /** "A squadron is two to four ships" — or one plus up to six escorts. */
  | 'bad-size'
  /** "Squadrons cannot mix ships with standard and Advanced Drives." */
  | 'mixed-drive-types'
  | 'empty'

/** Check a squadron's composition against 3.7. */
export function validateSquadron(squadron: Squadron): {
  legal: boolean
  violations: SquadronViolation[]
} {
  const violations: SquadronViolation[] = []
  const count = squadron.members.length
  if (count === 0) {
    violations.push('empty')
  } else {
    const max = squadron.formation === 'escort-ring' ? 7 : 4
    if (count < 2 || count > max) violations.push('bad-size')
    const advanced = squadron.members[0].drive.advanced
    if (squadron.members.some((m) => m.drive.advanced !== advanced)) {
      violations.push('mixed-drive-types')
    }
  }
  return { legal: violations.length === 0, violations }
}

/**
 * The drive the squadron's single order is written against (3.7):
 * "Squadron acceleration/deceleration and turning is restricted to that of the
 * ship with the lowest drive rating in the squadron."
 *
 * "Lowest drive rating" is taken as the lowest *current* rating — drive damage
 * is exactly the "engine damage" the straggler clause at the end of 3.7 has in
 * mind. The consecutive-turn restriction binds the squadron if it binds any
 * member, and prior ET uses are the highest among them, both because a squadron
 * can only fly what its worst ship can fly.
 */
export function squadronDrive(squadron: Squadron): DriveState {
  const members = squadron.members
  if (members.length === 0) {
    return { rating: 0, advanced: false, hits: 0, emergencyThrustUses: 0, turnedLastTurn: false }
  }
  let rating = Infinity
  let uses = 0
  let turnedLastTurn = false
  for (const member of members) {
    rating = Math.min(rating, currentThrust(member.drive))
    uses = Math.max(uses, member.drive.emergencyThrustUses)
    turnedLastTurn = turnedLastTurn || member.drive.turnedLastTurn
  }
  return {
    rating,
    advanced: members[0].drive.advanced,
    // The rating above is already the current one, so the squadron's synthetic
    // drive starts undamaged; individual members keep their own hit counts.
    hits: 0,
    emergencyThrustUses: uses,
    turnedLastTurn,
  }
}

/** Longitudinal (along course) and lateral (starboard-positive) offsets. */
function toFrame(offset: Point, course: Course): { along: number; across: number } {
  const ahead = courseVector(course)
  const starboard = courseVector(turnCourse(course, 3))
  return {
    along: offset.x * ahead.x + offset.y * ahead.y,
    across: offset.x * starboard.x + offset.y * starboard.y,
  }
}

function fromFrame(frame: { along: number; across: number }, course: Course, origin: Point): Point {
  const ahead = courseVector(course)
  const starboard = courseVector(turnCourse(course, 3))
  return {
    x: origin.x + ahead.x * frame.along + starboard.x * frame.across,
    y: origin.y + ahead.y * frame.along + starboard.y * frame.across,
  }
}

/**
 * Pick the ship that moves to the order (3.7).
 *
 * "For ships in line ahead, always move the lead ship according to orders with
 * the others staying in formation behind it. For ships in other formations, the
 * lead ship is the ship that has to move furthest, which is the leftmost for
 * starboard turns, the rightmost for port."
 *
 * Left and right are read from the squadron's own point of view, looking along
 * its course: in a starboard turn the port flank sweeps the wider arc, so the
 * leftmost — most to port — ship leads. With no turn there is no wider arc, so
 * the ship at the front leads, as in line ahead.
 */
export function squadronLead(squadron: Squadron, order: MovementOrder): SquadronMember {
  const members = squadron.members
  if (members.length === 0) throw new Error('a squadron has to have ships in it (3.7)')
  const course = members[0].placement.facing
  const frames = members.map((member) => ({
    member,
    frame: toFrame(
      {
        x: member.placement.position.x - members[0].placement.position.x,
        y: member.placement.position.y - members[0].placement.position.y,
      },
      course,
    ),
  }))

  const points = signedTurn(order.turn) || signedTurn(order.secondTurn)
  if (squadron.formation === 'line-ahead' || points === 0) {
    return frames.reduce((best, e) => (e.frame.along > best.frame.along ? e : best)).member
  }
  // Positive `across` is to starboard, i.e. the right of the formation.
  return points > 0
    ? frames.reduce((best, e) => (e.frame.across < best.frame.across ? e : best)).member
    : frames.reduce((best, e) => (e.frame.across > best.frame.across ? e : best)).member
}

export interface SquadronMovementResult {
  lead: MovementResult
  leadId: string
  /** Every member's new placement, the lead included. */
  placements: Array<{ id: string; placement: Placement }>
  velocity: number
  /**
   * Members whose own drive could not have flown the order. On a shared base
   * they are "considered destroyed" (3.7); otherwise they have simply fallen
   * out of formation.
   */
  stragglers: string[]
}

/**
 * Move a squadron on one order (3.7).
 *
 * "The lead ship moves as normal, while the others maintain the same relative
 * position to it throughout the maneuver." Keeping the relative position is
 * read as a rigid-body move: each follower holds its offset in the lead's own
 * frame, so a line-ahead squadron stays in line ahead behind the lead's new
 * heading rather than sliding sideways.
 */
export function moveSquadron(squadron: Squadron, order: MovementOrder): SquadronMovementResult {
  const lead = squadronLead(squadron, order)
  const drive = squadronDrive(squadron)
  const result = applyOrder(
    { placement: lead.placement, velocity: squadron.velocity, drive },
    order,
  )

  const startCourse = lead.placement.facing
  const placements = squadron.members.map((member) => {
    if (member.id === lead.id) return { id: member.id, placement: result.placement }
    const frame = toFrame(
      {
        x: member.placement.position.x - lead.placement.position.x,
        y: member.placement.position.y - lead.placement.position.y,
      },
      startCourse,
    )
    return {
      id: member.id,
      placement: {
        position: fromFrame(frame, result.placement.facing, result.placement.position),
        facing: result.placement.facing,
      },
    }
  })

  // A member can only keep station if its own drive could have flown what the
  // squadron just flew (3.7).
  const spent = result.budget.totalUsed
  const turnPoints = result.budget.turnPoints
  const stragglers = squadron.members
    .filter((member) => {
      const rating = currentThrust(member.drive)
      return rating < spent || turnPoints > standardTurnAllowance(member.drive)
    })
    .map((member) => member.id)

  return { lead: result, leadId: lead.id, placements, velocity: result.velocity, stragglers }
}

// ---------------------------------------------------------------------------
// Collisions (3.8)
// ---------------------------------------------------------------------------

/**
 * Tidy up ships that finished movement on top of each other (3.8): "If two ship
 * models would actually be touching at the end of all movement, they should
 * simply be arranged as closely as possible."
 *
 * Purely cosmetic. Ranges are measured from the centre of the model (4.2), and
 * the engine's own positions are authoritative, so this returns *display*
 * positions and changes nothing about the game state. Deterministic: ships are
 * pushed apart along the line between them, and two ships on exactly the same
 * point are separated along the first ship's facing so the result does not
 * depend on floating-point noise.
 */
export function arrangeTouchingShips(
  ships: ReadonlyArray<{ id: string; placement: Placement }>,
  minSeparation: number,
  passes = 4,
): Array<{ id: string; position: Point }> {
  const out = ships.map((s) => ({ id: s.id, position: { ...s.placement.position } }))
  if (minSeparation <= 0) return out

  for (let pass = 0; pass < passes; pass++) {
    let moved = false
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i].position
        const b = out[j].position
        let dx = b.x - a.x
        let dy = b.y - a.y
        let gap = Math.hypot(dx, dy)
        if (gap >= minSeparation) continue
        if (gap === 0) {
          const nudge = courseVector(ships[i].placement.facing)
          // Push along the facing's beam so the pair ends up abeam, not nose to tail.
          dx = -nudge.y
          dy = nudge.x
          gap = 1
        }
        const push = (minSeparation - gap) / 2 / gap
        a.x -= dx * push
        a.y -= dy * push
        b.x += dx * push
        b.y += dy * push
        moved = true
      }
    }
    if (!moved) break
  }
  return out
}

// ---------------------------------------------------------------------------
// Ships leaving the table (3.9)
// ---------------------------------------------------------------------------

/** The playing area, in MU (2.1). */
export interface TableBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Which side of the playing area a ship left by (3.9). */
export type TableEdge = 'top' | 'bottom' | 'left' | 'right'

/** Is the ship off the playing area? (3.9) */
export function isOffTable(position: Point, bounds: TableBounds): boolean {
  return (
    position.x < bounds.minX ||
    position.x > bounds.maxX ||
    position.y < bounds.minY ||
    position.y > bounds.maxY
  )
}

/**
 * The side the ship left by (3.9): "Ships will always re-enter play from the
 * same side of the playing area as they left."
 *
 * A ship that goes out past a corner is credited to whichever edge it overshot
 * furthest, which is the side a player would put the model back on.
 */
export function departureEdge(position: Point, bounds: TableBounds): TableEdge | null {
  if (!isOffTable(position, bounds)) return null
  const overshoot: Array<{ edge: TableEdge; by: number }> = [
    { edge: 'left', by: bounds.minX - position.x },
    { edge: 'right', by: position.x - bounds.maxX },
    { edge: 'top', by: bounds.minY - position.y },
    { edge: 'bottom', by: position.y - bounds.maxY },
  ]
  return overshoot.reduce((best, e) => (e.by > best.by ? e : best)).edge
}

export interface TableReentry {
  roll: number
  /** False on 1-3: "the ship may not return to play during the game" (3.9). */
  returns: boolean
  /** The first turn the ship may re-enter on, or null if it is gone for good. */
  reentryTurn: number | null
  edge: TableEdge | null
}

/**
 * The optional re-entry roll for a ship that flew off the table (3.9).
 *
 * "roll 1 die: on a roll of 1, 2, or 3; the ship may not return to play during
 * the game. A roll of 4, 5, or 6 indicates the ship may re-enter the table
 * after the equivalent number of turns have elapsed (e.g. 5 turns if a 5 is
 * rolled)."
 *
 * "After the equivalent number of turns have elapsed" is read as missing
 * exactly that many turns: a ship that leaves during turn 3 on a roll of 5 is
 * absent for turns 4 to 8 and may come back on turn 9. Without this rule a
 * ship leaving the table is simply a retreat from the battle.
 */
export function rollTableReentry(
  rng: Rng,
  departureTurn: number,
  edge: TableEdge | null = null,
): TableReentry {
  const roll = d6(rng)
  const returns = roll >= 4
  return {
    roll,
    returns,
    reentryTurn: returns ? departureTurn + roll + 1 : null,
    edge,
  }
}
