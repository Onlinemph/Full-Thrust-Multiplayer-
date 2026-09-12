/**
 * Full Thrust: Project Continuum — the Vector Movement System (12.12).
 *
 * *"This is a completely OPTIONAL alternative movement system, which players
 * may use instead of the standard FT movement rules described in the basic
 * rulebook."* An alternative, not a modifier: nothing in `movement.ts` is
 * touched, a scenario picks one model or the other, and 12.12 is explicit that
 * a game may run both at once — *"each ship simply follows the relevant rules
 * according to its own drive system."*
 *
 * Everything here follows from one sentence: *"under the VECTOR system the ship
 * may be moving one way and facing another."* COURSE is where the ship is
 * going, FACING is where its bow points, and they are different objects with
 * different types. FACING is a `Course` from `types.ts` — one of the twelve
 * clock points, because *"the FACING of a model should always be one of the 12
 * 'clockface' points"*. COURSE is a free direction in degrees, because *"the
 * mechanics of the vector movement mean that the COURSE will usually NOT
 * correspond exactly to a clockface direction"*. The unhelpful collision of
 * names is the book's; the doc comments say which is meant every time.
 *
 * Three consequences worth stating before the code:
 *
 *  - **Two thrust pools, not one.** Section 3 spends one rating on turning and
 *    accelerating together. 12.12 gives the main drive its full rating *and*
 *    half of it again in manoeuvring thrusters, *"in addition"*.
 *  - **Velocity is re-measured, never accumulated.** The turn ends with a tape
 *    measure laid between where the ship started and where it stopped, and the
 *    reading, *"rounded to the nearest whole inch"*, is next turn's speed. The
 *    positions in between are discarded.
 *  - **Fire arcs follow FACING.** 4.2 measures arcs off the bow, and under this
 *    system the bow is not the track. A vector ship can be running away with
 *    its target in the forward arc.
 *
 * Nothing in 12.12 rolls a die, so nothing here does. Every function is a pure
 * value-in/value-out transform: the caller's state is never mutated, which is
 * what lets a battle replay exactly.
 *
 * Every quotation is from *Full Thrust: Project Continuum* v1.1.4, section
 * 12.12; the prose, the worked figures and the reasoning behind each
 * **[reading]** are in `docs/rules/vectormovement.md`.
 */

import { arcTo, distance } from './geometry'
import type { Arc, Course, Placement, Point } from './types'

const EPSILON = 1e-9

// ---------------------------------------------------------------------------
// Clock geometry (12.12 "Course and Facing")
// ---------------------------------------------------------------------------

/** *"any of the 12 possible facing directions"* (12.12). */
export const CLOCK_POINTS = 12

/** *"TP2 indicates a rotation to port of 2 clock face points (ie: 60 degrees)"* (12.12). */
export const DEGREES_PER_CLOCK_POINT = 30

/** A push goes square across the hull — port or starboard of the facing (12.12). */
export const PUSH_BEARING_DEGREES: Readonly<Record<'PP' | 'PS' | 'PR', number>> = {
  PP: -90,
  PS: 90,
  PR: 180,
}

/** Normalise any integer onto the twelve-point clock face (12.12, 3.1). */
function clockPoint(value: number): Course {
  return (((((value - 1) % CLOCK_POINTS) + CLOCK_POINTS) % CLOCK_POINTS) + 1) as Course
}

/** A facing as a bearing in degrees clockwise from up the table. */
function facingDegrees(facing: Course): number {
  return (facing % CLOCK_POINTS) * DEGREES_PER_CLOCK_POINT
}

/**
 * The unit vector along a *free* direction, in degrees clockwise from up the
 * table — the course-marker arrow.
 *
 * `geometry.courseVector` does this for the twelve clock points; a vector
 * ship's course is not one of them, so it needs the continuous version. Screen
 * coordinates, so "up the table" is −y and the two agree at every clock point.
 */
export function courseUnitVector(courseDegrees: number): Point {
  const radians = (courseDegrees * Math.PI) / 180
  return { x: Math.sin(radians), y: -Math.cos(radians) }
}

/** Advance a point `mu` movement units along a free direction. */
function advanceAlong(from: Point, courseDegrees: number, mu: number): Point {
  const unit = courseUnitVector(courseDegrees)
  return { x: from.x + unit.x * mu, y: from.y + unit.y * mu }
}

/**
 * The direction of the tape measure, in degrees clockwise from up the table.
 *
 * *"place the tape measure or rule between the course marker and the ship's
 * final position"*, then *"move the course marker up to the stand of the model
 * again, with its arrow pointing in the direction of the ship's new COURSE -
 * i.e.: parallel to the tape-measure"* (12.12).
 */
export function courseBetween(from: Point, to: Point): number {
  const degrees = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI
  return (degrees + 360) % 360
}

/**
 * *"this (rounded to the nearest whole inch or other movement unit) is the
 * ship's final VELOCITY for the turn"* (12.12).
 *
 * **[reading] 5**: half rounds away from zero. 6.5 becomes 7, which is what a
 * player with a ruler does; banker's rounding is the alternative and is fairer
 * over a long game, but nobody measures that way. The rounding bites every
 * turn on the whole velocity, so a ship can shed or gain up to half an MU a
 * turn for nothing — 12.12 accepts exactly that: *"even doing it this way is an
 * oversimplification of the true mechanics - but we feel it is close enough for
 * game purposes!"*
 */
export function roundVelocity(measured: number): number {
  return Math.max(0, Math.round(measured))
}

// ---------------------------------------------------------------------------
// The ship's vector (12.12 "Course and Facing")
// ---------------------------------------------------------------------------

/**
 * Where a ship is, where its bow points, where it is going and how fast.
 *
 * Extends `Placement` so a vector ship draws and fires like any other: the
 * `facing` a renderer or `arcTo` reads is the bow, exactly as in a cinematic
 * game. What is new is that `course` is no longer the same number.
 */
export interface VectorState extends Placement {
  /**
   * COURSE — the course-marker arrow, in degrees clockwise from up the table.
   * Deliberately *not* a `Course`: *"the COURSE will usually NOT correspond
   * exactly to a clockface direction"* (12.12).
   */
  course: number
  /**
   * VELOCITY — the number in the "V" box on the order sheet, in whole MU
   * (12.12). Always non-negative; a ship going the other way has a different
   * course, not a negative speed.
   */
  velocity: number
}

/** A fresh vector state, with the course normalised and the velocity clamped. */
export function createVectorState(init: {
  position: Point
  facing: Course
  course?: number
  velocity?: number
}): VectorState {
  return {
    position: { x: init.position.x, y: init.position.y },
    facing: init.facing,
    course: normaliseDegrees(init.course ?? facingDegrees(init.facing)),
    velocity: Math.max(0, init.velocity ?? 0),
  }
}

/**
 * A cinematic ship's state read as a vector one (12.12).
 *
 * *"It is perfectly possible to mix both vector and cinematic movement in the
 * same game"*, and a cinematic ship is simply the special case where course and
 * facing agree — which is how 12.12 opens: *"Under the standard Cinematic FT
 * movement, a ship will always be facing in the same direction that it is
 * moving"*.
 *
 * There is no conversion the other way. A vector ship's course is not a clock
 * point, and rounding one onto the clock face to hand it to `movement.ts` would
 * be inventing a rule the book does not have.
 */
export function vectorStateFromCinematic(placement: Placement, velocity: number): VectorState {
  return createVectorState({ ...placement, velocity })
}

/** The ship's velocity as a displacement vector in MU per turn. */
export function velocityVector(state: VectorState): Point {
  const unit = courseUnitVector(state.course)
  return { x: unit.x * state.velocity, y: unit.y * state.velocity }
}

/**
 * Which fire arc a target lies in, as seen from a vector ship (4.2, 12.12).
 *
 * A one-line composition that exists because the mistake it prevents is the
 * commonest one in the system: arcs are measured off the FACING, and under
 * vector movement the facing has nothing to do with the direction of travel.
 */
export function arcFromVectorShip(state: VectorState, target: Point): Arc {
  return arcTo(state.position, state.facing, target)
}

function normaliseDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

// ---------------------------------------------------------------------------
// The drive and its two pools (12.12 "Main Drive Thrust", "Manuvering Thrusters")
// ---------------------------------------------------------------------------

/**
 * The main drive as it stands, for vector purposes (12.12, 4.11, 10.1).
 *
 * *"the thrust level shown in the ship's drive icon is the rating used for the
 * main drive"* — the same rating a cinematic ship uses, because *"any given
 * ship design may be used with either movement system without modification"*.
 *
 * `movement.DriveState` carries the same two numbers and four more that only
 * section 3 needs (advanced drives, emergency thrust history, whether the ship
 * turned last turn — none of which 12.12 has any use for). This module may not
 * import it, so it takes the two fields it reads. An integrator holding a real
 * `DriveState` can pass `{ rating, hits }` straight through.
 */
export interface VectorDrive {
  /** Thrust rating as printed in the drive icon (12.12). */
  rating: number
  /** 'Destroyed' results the main drive has taken (4.11, 10.1). */
  hits: number
}

/**
 * The main drive's current rating (12.12, 4.11, 10.1).
 *
 * One 'destroyed' result halves the printed rating and a rating-1 drive is
 * disabled outright by its first; two disable any drive. Half rounds down,
 * which is the only reading under which those two sentences agree — the long
 * version of the argument is on `movement.currentThrust`, whose answer this
 * matches exactly.
 */
export function mainDriveThrust(drive: VectorDrive): number {
  const rating = Math.max(0, drive.rating)
  if (drive.hits <= 0) return rating
  if (drive.hits === 1) return Math.floor(rating / 2)
  return 0
}

/**
 * Manoeuvre points the thrusters have this turn (12.12).
 *
 * *"The power available to the ship's thrusters is equal to half the thrust
 * rating of the main drive - so a ship with a main drive TR of 6 would have 3
 * manoeuvre points available"*, and *"when the main drive takes damage,
 * thruster power is halved or lost accordingly"* — so this halves the *current*
 * rating, after 4.11 has had its way with it.
 *
 * **[reading] 1**: half rounds down. 12.12 gives only even examples (6 → 3,
 * 4 → 2). Rounding up would hand a thrust-1 ship a manoeuvre point, and a
 * thrust-1 ship that can rotate freely is not the ship 12.12 warns about when
 * it says *"ships with low thrust ratings may prove VERY unmanoeuvrable under
 * the vector system"*. Down also matches 3.6 (*"rounded down"*) and 4.11.
 *
 * The consequence is worth reading twice: **a thrust-1 ship has no manoeuvre
 * points at all** — it can neither rotate nor push, only burn 1 MU a turn along
 * a facing it can never change.
 */
export function thrusterPoints(drive: VectorDrive): number {
  return Math.floor(mainDriveThrust(drive) / 2)
}

// ---------------------------------------------------------------------------
// Orders (12.12 "Order Sequence")
// ---------------------------------------------------------------------------

/**
 * The six things a vector order sheet can say (12.12).
 *
 * There is no forward push. *"Pushes may be made to PORT, STARBOARD or
 * REVERSE"*, and going faster along the bow is the main drive's job.
 */
export type VectorOrderKind = 'MD' | 'TP' | 'TS' | 'PP' | 'PS' | 'PR'

export const VECTOR_ORDER_KINDS: readonly VectorOrderKind[] = ['MD', 'TP', 'TS', 'PP', 'PS', 'PR']

export const VECTOR_ORDER_LABELS: Readonly<Record<VectorOrderKind, string>> = {
  MD: 'Main drive burn',
  TP: 'Turn to port',
  TS: 'Turn to starboard',
  PP: 'Push to port',
  PS: 'Push to starboard',
  PR: 'Push in reverse',
}

/**
 * One written order. `points` is thrust points for a burn or a push — one point
 * to the movement unit — and clock points of heading change for a rotation,
 * which costs one manoeuvre point however large it is.
 */
export interface VectorOrder {
  kind: VectorOrderKind
  points: number
}

/** *"ONE maneuver point from the thrusters allows the ship to be rotated by any desired number of facing points"* (12.12). */
export const ROTATION_COST = 1

/** *"It requires ONE maneuver point of thrust applied to displace the ship by one movement unit"* (12.12). */
export const PUSH_COST_PER_MU = 1

export function isRotationOrder(kind: VectorOrderKind): boolean {
  return kind === 'TP' || kind === 'TS'
}

export function isPushOrder(kind: VectorOrderKind): boolean {
  return kind === 'PP' || kind === 'PS' || kind === 'PR'
}

/**
 * Read an order sheet as written (12.12).
 *
 * *"PUSH orders should be written as PP (Push to Port), PS (Push to Starboard)
 * or PR (Push in Reverse), again followed by the number of thrust points
 * applied"*; rotations as TP/TS and burns as MD. The book's own examples are
 * `TP3, MD6` and `MD6, TP2`, and the sequence is the rule, so the list comes
 * back in the order it was written.
 */
export function parseVectorOrders(text: string): { orders: VectorOrder[]; problems: string[] } {
  const orders: VectorOrder[] = []
  const problems: string[] = []
  // Tolerate "MD 6" as well as "MD6"; the book always writes the latter.
  const joined = text.replace(/([A-Za-z]{2})\s+(?=\d)/g, '$1')
  for (const token of joined.split(/[\s,;]+/)) {
    if (token === '') continue
    const match = /^(MD|TP|TS|PP|PS|PR)(\d+)$/i.exec(token)
    if (!match) {
      problems.push(`"${token}" is not a vector order (12.12)`)
      continue
    }
    orders.push({
      kind: match[1].toUpperCase() as VectorOrderKind,
      points: Number.parseInt(match[2], 10),
    })
  }
  return { orders, problems }
}

/** The order sheet as the book writes it: `TP3, MD6`. */
export function formatVectorOrders(orders: readonly VectorOrder[]): string {
  return orders.map((order) => `${order.kind}${order.points}`).join(', ')
}

// ---------------------------------------------------------------------------
// What a turn's orders cost (12.12 "Combining Maneuvers")
// ---------------------------------------------------------------------------

/** How one order sheet spends the ship's two pools (12.12). */
export interface VectorOrderBudget {
  /** Printed rating, before drive damage. */
  printedRating: number
  /** Main drive rating after drive damage — the ceiling on MD (4.11). */
  rating: number
  /** Manoeuvre points the thrusters have: half `rating`, rounded down. */
  thrusterAvailable: number
  /** Thrust points spent on main drive burns, across every MD written. */
  mainDriveUsed: number
  /** Rotations written. At most one is legal. */
  rotations: number
  /** Pushes written. At most one is legal — a PP and a PS is two, not one. */
  pushes: number
  /** Manoeuvre points the rotations cost: one each, whatever the angle. */
  rotationPoints: number
  /** Manoeuvre points the pushes cost: one per MU displaced. */
  pushPoints: number
  /** Total manoeuvre points spent. */
  thrusterUsed: number
  /** Manoeuvre points left. Negative means the sheet overruns the thrusters. */
  thrusterRemaining: number
  legal: boolean
  problems: string[]
}

/**
 * Price an order sheet against the drive (12.12).
 *
 * *"a ship may combine both ROTATION and PUSH uses of its maneuvering thrusters
 * in a single game turn, but no more than ONE of each, provided the TOTAL of
 * maneuver points expended does not exceed the total available"* — three
 * separate limits, plus the main drive's own rating.
 *
 * **[reading] 3**: the number of main-drive burns is not capped, only their
 * total. *"no more than ONE of each"* is scoped by its own sentence to uses
 * *"of its maneuvering thrusters"*, and the main drive is not one. So
 * `MD3, TS3, MD3` is legal on a thrust-6 ship and `MD4, MD3` is not. The
 * alternative — one MD per turn, which both worked figures happen to show —
 * would gut the order-sequence rule the book is emphatic about, on the strength
 * of two examples illustrating something else. Either way the rating is still
 * the ceiling, so the ship gains no thrust from it.
 *
 * **[reading] 8**: a zero-point order is not an order. `TP0` costs nothing and
 * is not the turn's one rotation, because 12.12 prices the rotation and there
 * is none.
 */
export function vectorOrderBudget(
  orders: readonly VectorOrder[],
  drive: VectorDrive,
): VectorOrderBudget {
  const rating = mainDriveThrust(drive)
  const thrusterAvailable = thrusterPoints(drive)
  const problems: string[] = []

  let mainDriveUsed = 0
  let rotations = 0
  let pushes = 0
  let pushPoints = 0

  for (const order of orders) {
    const label = `${order.kind}${order.points}`
    if (!Number.isInteger(order.points) || order.points < 0) {
      problems.push(`${label} is not a whole number of points (12.12)`)
      continue
    }
    if (order.points === 0) continue
    if (order.kind === 'MD') {
      mainDriveUsed += order.points
    } else if (isRotationOrder(order.kind)) {
      rotations += 1
    } else {
      pushes += 1
      pushPoints += order.points * PUSH_COST_PER_MU
    }
  }

  const rotationPoints = rotations * ROTATION_COST
  const thrusterUsed = rotationPoints + pushPoints

  if (mainDriveUsed > rating) {
    problems.push(
      `main drive burns total ${mainDriveUsed}, above the drive's rating of ${rating} (12.12)`,
    )
  }
  if (rotations > 1) {
    problems.push(`${rotations} rotations written; "no more than ONE of each" (12.12)`)
  }
  if (pushes > 1) {
    problems.push(`${pushes} pushes written; "no more than ONE of each" (12.12)`)
  }
  if (thrusterUsed > thrusterAvailable) {
    problems.push(
      `thrusters spend ${thrusterUsed} manoeuvre points of ${thrusterAvailable} available (12.12)`,
    )
  }

  return {
    printedRating: Math.max(0, drive.rating),
    rating,
    thrusterAvailable,
    mainDriveUsed,
    rotations,
    pushes,
    rotationPoints,
    pushPoints,
    thrusterUsed,
    thrusterRemaining: thrusterAvailable - thrusterUsed,
    legal: problems.length === 0,
    problems,
  }
}

/** Whether an order sheet is legal, and why not (12.12). */
export function validateVectorOrders(
  orders: readonly VectorOrder[],
  drive: VectorDrive,
): { legal: boolean; problems: string[] } {
  const budget = vectorOrderBudget(orders, drive)
  return { legal: budget.legal, problems: budget.problems }
}

// ---------------------------------------------------------------------------
// Moving (12.12 "Moving Ships Under The Vector System")
// ---------------------------------------------------------------------------

/** One leg of the movement sequence: the free vector, then each written order. */
export interface VectorStep {
  /** `'vector'` is the starting-vector leg every ship flies first. */
  kind: 'vector' | VectorOrderKind
  points: number
  /** Where the model stands after this leg. */
  position: Point
  /** Where the bow points after this leg. */
  facing: Course
  detail: string
}

export interface VectorMoveResult {
  start: VectorState
  /** Position, facing, new course and new velocity at the end of the turn. */
  end: VectorState
  /**
   * The whole sequence, starting-vector leg first. Bookkeeping only: 12.12 says
   * the model *"does NOT indicate that the ship actually occupies that point at
   * any time"*. Do not test collisions against it — use `chord`.
   */
  steps: VectorStep[]
  /**
   * The tape-measure line, start position to finishing position. This, and only
   * this, is what a collision is tested against (12.12).
   */
  chord: { from: Point; to: Point }
  /** The tape reading before it is rounded to the "V" box. */
  measured: number
  /** How the order sheet priced out. */
  budget: VectorOrderBudget
  /** False when the sheet was over budget and the ship coasted instead. */
  legal: boolean
  problems: string[]
}

/**
 * Fly one ship for one turn (12.12).
 *
 * *"ALWAYS start by moving it according to its starting vector … at this stage,
 * LEAVE THE COURSE MARKER IN ITS STARTING POSITION. Now apply any thrust (main
 * drive and/or thrusters) indicated in the ship's orders, making sure to apply
 * each effect in the sequence it is written down."* Then the tape measure goes
 * between the marker and the finishing position, and its reading and direction
 * are next turn's velocity and course.
 *
 * The order sequence is the whole point: *"If the player writes TP2, MD6 …
 * If, on the other hand, the order is written MD6, TP2 … the result will be VERY
 * different"*. Orders are therefore flown as a list, in order, and a rotation
 * written before a push changes where the push goes.
 *
 * **[reading] 4**: an order sheet that breaks the budget is flown as an empty
 * one. 12.12 has no penalty clause; 3.5 does, for the other system — *"Any ship
 * with no orders will move straight ahead at an unchanged speed, as will any
 * that are given impossible orders"* — and under vector movement that phrase
 * has an exact meaning, namely the starting vector with no thrust applied. The
 * result carries `legal: false` and the reasons. Refusing the move and handing
 * the state back, which is what most functions in this engine do with an
 * impossible request, is wrong here: a ship under vector movement cannot
 * decline to move.
 */
export function moveVector(
  state: VectorState,
  orders: readonly VectorOrder[],
  drive: VectorDrive,
): VectorMoveResult {
  const budget = vectorOrderBudget(orders, drive)
  const flown = budget.legal ? orders : []

  const from: Point = { x: state.position.x, y: state.position.y }
  const startVelocity = Math.max(0, state.velocity)

  let position = advanceAlong(from, state.course, startVelocity)
  let facing = state.facing

  const steps: VectorStep[] = [
    {
      kind: 'vector',
      points: startVelocity,
      position,
      facing,
      detail: `starting vector: ${startVelocity} MU on course ${state.course.toFixed(1)}°`,
    },
  ]

  for (const order of flown) {
    if (order.points === 0) continue
    switch (order.kind) {
      case 'MD':
        // "MD4 will move the ship 4" in the direction of its present facing."
        position = advanceAlong(position, facingDegrees(facing), order.points)
        break
      case 'TP':
        // "a rotation to port of 2 clock face points"; port is anticlockwise.
        facing = clockPoint(facing - order.points)
        break
      case 'TS':
        facing = clockPoint(facing + order.points)
        break
      default:
        // "Pushes may only be applied directly to port, starboard or rearward
        // relative to the ship's facing at that moment."
        //
        // **[reading] 2**: that includes PR. The sentence introducing it says
        // "backwards relative to its current heading", but "heading" is used
        // nowhere else in 12.12 as a defined term and the paragraph's own last
        // sentence says facing. The retros are bolted to the hull pointing
        // along its axis, so they push along the axis wherever the ship is
        // drifting. Rejected: PR reverses along the COURSE, a true brake — the
        // gloss "to slow the ship down" reads that way, but the two readings
        // agree in exactly the case that gloss describes, facing on course.
        position = advanceAlong(
          position,
          facingDegrees(facing) + PUSH_BEARING_DEGREES[order.kind],
          order.points,
        )
        break
    }
    steps.push({
      kind: order.kind,
      points: order.points,
      position,
      facing,
      detail: `${VECTOR_ORDER_LABELS[order.kind]} ${order.points}`,
    })
  }

  const measured = distance(from, position)
  // **[reading] 7**: a ship that finished where it started has no tape-measure
  // direction, so the course marker keeps pointing where it was.
  const course = measured > EPSILON ? courseBetween(from, position) : state.course

  return {
    start: { ...state, position: from },
    end: { position, facing, course, velocity: roundVelocity(measured) },
    steps,
    chord: { from, to: position },
    measured,
    budget,
    legal: budget.legal,
    problems: budget.problems,
  }
}

/**
 * A ship with no orders (12.12, 3.5).
 *
 * Momentum is not an order: *"ALWAYS start by moving it according to its
 * starting vector"*. A drifting hulk, a ship whose captain wrote nothing and a
 * thrust-0 object (16.1) all do this and nothing else.
 */
export function coastVector(state: VectorState): VectorMoveResult {
  return moveVector(state, [], { rating: 0, hits: 0 })
}

/** One ship's turn, for a fleet move. */
export interface VectorFleetEntry {
  id: string
  state: VectorState
  orders: readonly VectorOrder[]
  drive: VectorDrive
}

/**
 * Move a whole fleet (12.12).
 *
 * *"Once the orders are written by all players, all ships are moved
 * simultaneously in accordance with their starting vectors and any relevant
 * manoeuvre orders."* Simultaneously, so there is no initiative ordering inside
 * the vector move as there is in cinematic phase 5: every ship is flown off its
 * own starting state and no ship can see where another one ended up. That is
 * why this is a map and not a fold.
 */
export function moveVectorFleet(
  entries: readonly VectorFleetEntry[],
): Record<string, VectorMoveResult> {
  const out: Record<string, VectorMoveResult> = {}
  for (const entry of entries) {
    out[entry.id] = moveVector(entry.state, entry.orders, entry.drive)
  }
  return out
}

// ---------------------------------------------------------------------------
// Collisions (12.12 "Collisions")
// ---------------------------------------------------------------------------

/**
 * *"any objects on the board that are deemed big enough to pose a collision
 * risk, such as asteroids or very large space installations"* (12.12).
 *
 * **[reading] 6**: a disc. 12.12 says only *"intersects with the object"* and
 * leaves the shape to whatever is on the table; a radius is the only shape
 * section 17 measures against either — 17.1 puts an asteroid's base at *"1 to 6
 * MU across"* — so a disc keeps the two sections measuring the same thing.
 * `terrain.TerrainBody` is the same three fields, and this exists only because
 * it lives in `terrain.ts` rather than in the spine.
 */
export interface VectorCollisionBody {
  id: string
  position: Point
  /** Radius in MU. */
  radius: number
}

/** Shortest distance from a point to a line segment, in MU. */
function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared < EPSILON) return distance(point, a)
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared),
  )
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy })
}

/**
 * Whether the turn's chord runs through a body (12.12).
 *
 * *"such a risk will only occur if the line between the ship's STARTING and
 * FINAL positions intersects with the object. In effect, it is this line … that
 * most nearly approximates the 'true' path followed by the ship during the turn
 * - the position of the ship model at any other time during the movement
 * sequence is merely for calculation purposes and does NOT indicate that the
 * ship actually occupies that point at any time."*
 *
 * This is the one place 12.12 overrides another section outright. 17.6 tests
 * *"its path during the Ship Movement Phase"* and `terrain.ts` reads that as the
 * whole polyline; under vector movement the polyline is a calculation aid the
 * ship never occupied. So a rock the model visibly ploughed through on the
 * first leg of a dogleg is no collision if the chord misses it, and a rock in
 * the open water inside the dogleg is a collision if the chord crosses it.
 */
export function vectorCollisionRisk(from: Point, to: Point, body: VectorCollisionBody): boolean {
  return distanceToSegment(body.position, from, to) <= body.radius + EPSILON
}

/**
 * Every body this turn's chord runs through (12.12).
 *
 * **[reading] 9**: risk is reported, not resolved. 12.12 says when a collision
 * risk *occurs* and stops there; the avoidance number, the die and the crash
 * are 17.6, which `terrain.collisionAvoidanceTarget` and
 * `terrain.resolveCollision` already implement off the ship's velocity and
 * thrust rating. Resolving it here would put a second copy of that table in the
 * repository.
 */
export function vectorCollisions(
  move: VectorMoveResult,
  bodies: readonly VectorCollisionBody[],
): VectorCollisionBody[] {
  return bodies.filter((body) => vectorCollisionRisk(move.chord.from, move.chord.to, body))
}
