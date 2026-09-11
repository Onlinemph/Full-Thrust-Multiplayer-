/**
 * Full Thrust: Project Continuum — geometry (2.1, 3.1, 4.2).
 *
 * Distances are Measurement Units. Courses and facings run on a twelve-point
 * clock face, so they are stored as clock numbers and only turned into angles
 * when something has to be drawn or measured.
 */

import { ARC_ORDER, type Arc, type Course, type Point } from './types'

/** Degrees per clock point (3.1). */
export const DEGREES_PER_POINT = 30

/** Degrees spanned by one fire arc (4.2). */
export const DEGREES_PER_ARC = 60

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

/**
 * Clock course to a compass bearing in degrees, measured clockwise from "up"
 * the table. Course 12 is 0 degrees, course 3 is 90, course 6 is 180.
 */
export function courseToDegrees(course: Course): number {
  return (course % 12) * DEGREES_PER_POINT
}

/** Normalise any integer to the 1–12 clock face. */
export function normaliseCourse(value: number): Course {
  const wrapped = ((value - 1) % 12 + 12) % 12 + 1
  return wrapped as Course
}

/** Turn a course by `points`; positive is to starboard (clockwise). */
export function turnCourse(course: Course, points: number): Course {
  return normaliseCourse(course + points)
}

/**
 * The shortest turn from one course to another, in clock points. Positive is
 * to starboard, negative to port; the result is in −6..6.
 */
export function courseDelta(from: Course, to: Course): number {
  let delta = (to - from) % 12
  if (delta > 6) delta -= 12
  if (delta < -6) delta += 12
  return delta
}

/** The unit vector a ship on this course travels along. */
export function courseVector(course: Course): Point {
  const radians = (courseToDegrees(course) * Math.PI) / 180
  // Screen coordinates: y grows downward, so "up the table" is −y.
  return { x: Math.sin(radians), y: -Math.cos(radians) }
}

/** Advance a point `distance` MU along a course. */
export function advance(from: Point, course: Course, distance: number): Point {
  const v = courseVector(course)
  return { x: from.x + v.x * distance, y: from.y + v.y * distance }
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Bearing from `a` to `b` in degrees clockwise from up the table. */
export function bearing(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI
  return (degrees + 360) % 360
}

// ---------------------------------------------------------------------------
// Fire arcs (4.2)
// ---------------------------------------------------------------------------

/**
 * Which of the six 60-degree arcs a target lies in, as seen from a ship at
 * `origin` facing `facing` (4.2).
 *
 * The forward arc straddles the bow — it runs 30 degrees either side of the
 * facing — and the rest follow clockwise: FS, AS, A, AP, FP.
 */
export function arcTo(origin: Point, facing: Course, target: Point): Arc {
  const relative = (bearing(origin, target) - courseToDegrees(facing) + 360 + 30) % 360
  const index = Math.floor(relative / DEGREES_PER_ARC) % 6
  return ARC_ORDER[index]
}

/** Whether a weapon covering `arcs` can bear on a target in `arc` (4.2). */
export function bearsOn(arcs: readonly Arc[], arc: Arc): boolean {
  return arcs.includes(arc)
}

/**
 * The arc a *target* presents to a shot coming from `origin` — the reverse
 * lookup, used by the optional rear-arc rule (4.10) and by armour facing.
 */
export function incomingArc(
  targetPosition: Point,
  targetFacing: Course,
  origin: Point,
): Arc {
  return arcTo(targetPosition, targetFacing, origin)
}

/** The three aft arcs, for the optional rear-arc attack rule (4.10). */
export const REAR_ARCS: readonly Arc[] = ['AS', 'A', 'AP']

export function isRearArcAttack(
  targetPosition: Point,
  targetFacing: Course,
  origin: Point,
): boolean {
  return REAR_ARCS.includes(incomingArc(targetPosition, targetFacing, origin))
}

// ---------------------------------------------------------------------------
// Range bands (4.3)
// ---------------------------------------------------------------------------

/** Standard beam range band (4.3). */
export const BEAM_RANGE_BAND = 12

/**
 * Which range band a target is in, counting from 1 at point-blank. `bandSize`
 * defaults to the standard 12 MU; pulse torpedoes, K-guns and the rest state
 * their own (5.14, 5.16).
 */
export function rangeBand(range: number, bandSize = BEAM_RANGE_BAND): number {
  if (range <= 0) return 1
  return Math.floor((range - 1e-9) / bandSize) + 1
}

/**
 * Dice a beam-type weapon of `weaponClass` rolls at `range` — its class, less
 * one die per range band beyond the first, and zero once it runs out (4.5).
 */
export function beamDiceAtRange(
  weaponClass: number,
  range: number,
  bandSize = BEAM_RANGE_BAND,
): number {
  return Math.max(0, weaponClass - (rangeBand(range, bandSize) - 1))
}

// ---------------------------------------------------------------------------
// Course changes during movement (3.4)
// ---------------------------------------------------------------------------

/**
 * Move a ship one turn under the cinematic rules (3.4).
 *
 * A course change is a sideways shove applied across the whole turn, so the
 * model is moved in two legs: half the distance on the old course, then the
 * turn, then the rest on the new one. An odd velocity rounds the *first* leg
 * down; an odd course change rounds the initial part of the turn down and the
 * mid-move part up.
 */
export function moveShip(
  from: Point,
  course: Course,
  velocity: number,
  turnPoints: number,
): { position: Point; course: Course } {
  if (turnPoints === 0) {
    return { position: advance(from, course, velocity), course }
  }
  const sign = Math.sign(turnPoints)
  const magnitude = Math.abs(turnPoints)
  const firstTurn = sign * Math.floor(magnitude / 2)
  const secondTurn = turnPoints - firstTurn

  const midCourse = turnCourse(course, firstTurn)
  const firstLeg = Math.floor(velocity / 2)
  const mid = advance(from, midCourse, firstLeg)

  const finalCourse = turnCourse(midCourse, secondTurn)
  return { position: advance(mid, finalCourse, velocity - firstLeg), course: finalCourse }
}
