/**
 * Cinematic movement (section 3).
 *
 * Every worked example printed in section 3 of the rulebook is a test here, and
 * they are labelled with the rule they come from so a failure can be read
 * straight against the book.
 */

import { describe, expect, it } from 'vitest'

import { Rng } from './dice'
import { advance, moveShip } from './geometry'
import type { MovementOrder, Placement, Point } from './types'
import {
  applyDriveHits,
  applyOrder,
  arrangeTouchingShips,
  clampOrder,
  currentThrust,
  departureEdge,
  driveFromDef,
  emergencyThrustBonus,
  emergencyThrustDice,
  emergencyThrustOutcome,
  emergencyThrustScore,
  formatOrder,
  isOffTable,
  moveSquadron,
  orderTurnPoints,
  parseOrder,
  rollEmergencyThrust,
  rollTableReentry,
  squadronDrive,
  squadronLead,
  standardTurnAllowance,
  STRAIGHT_AHEAD,
  thrustBudget,
  validateSquadron,
  type DriveState,
  type Squadron,
  type SquadronFormation,
} from './movement'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * An `Rng` that hands back a scripted sequence of d6 faces, so the rulebook's
 * worked examples ("if the rolls resulted in 2 ... and 3 ...") can be tested as
 * written rather than by hunting for a seed.
 */
class ScriptedRng extends Rng {
  private faces: number[]
  private index = 0

  constructor(faces: number[]) {
    super(1)
    this.faces = faces
  }

  override next(): number {
    const face = this.faces[this.index]
    if (face === undefined) throw new Error('ScriptedRng ran out of scripted faces')
    this.index += 1
    // `d6` reads `Math.floor(next() * 6) + 1`, so land inside the face's slice.
    return (face - 1) / 6 + 1e-6
  }
}

function drive(rating: number, extra: Partial<DriveState> = {}): DriveState {
  return {
    rating,
    advanced: false,
    hits: 0,
    emergencyThrustUses: 0,
    turnedLastTurn: false,
    ...extra,
  }
}

function ship(
  position: Point,
  facing: Placement['facing'],
  velocity: number,
  driveState: DriveState,
) {
  return { placement: { position, facing }, velocity, drive: driveState }
}

const ORIGIN: Point = { x: 0, y: 0 }

function port(points: number): MovementOrder['turn'] {
  return { direction: 'port', points }
}

function starboard(points: number): MovementOrder['turn'] {
  return { direction: 'starboard', points }
}

function closeTo(actual: Point, expected: Point, precision = 6): void {
  expect(actual.x).toBeCloseTo(expected.x, precision)
  expect(actual.y).toBeCloseTo(expected.y, precision)
}

// ---------------------------------------------------------------------------
// 3.1 Ship movement
// ---------------------------------------------------------------------------

describe('3.1 ship movement', () => {
  it('moves the full distance of its current velocity', () => {
    const result = applyOrder(ship(ORIGIN, 12, 8, drive(4)), STRAIGHT_AHEAD)
    expect(result.velocity).toBe(8)
    closeTo(result.placement.position, { x: 0, y: -8 })
    expect(result.legs).toHaveLength(1)
    expect(result.legs[0].distance).toBe(8)
  })

  it('applies a velocity change immediately: 8 MU ordered to 12 MU moves 12 MU', () => {
    // 3.1: "a ship ordered to change from 8 MU to 12 MU velocity moves the full
    // 12 MU in that turn."
    const result = applyOrder(ship(ORIGIN, 12, 8, drive(4)), { turn: null, accel: 4 })
    expect(result.velocity).toBe(12)
    closeTo(result.placement.position, { x: 0, y: -12 })
  })

  it('keeps course and facing identical', () => {
    const result = applyOrder(ship(ORIGIN, 3, 6, drive(6)), { turn: starboard(2), accel: 0 })
    expect(result.placement.facing).toBe(5)
    expect(result.legs[result.legs.length - 1].course).toBe(5)
  })

  it('refuses to decelerate past a dead stop', () => {
    // 3.1: "Ships may not have negative velocities."
    const result = applyOrder(ship(ORIGIN, 12, 3, drive(6)), { turn: null, accel: -4 })
    expect(result.legal).toBe(false)
    expect(result.violations).toContain('negative-velocity')
    expect(result.velocity).toBe(3)
  })

  it('allows a deceleration to exactly zero', () => {
    const result = applyOrder(ship(ORIGIN, 12, 3, drive(6)), { turn: null, accel: -3 })
    expect(result.legal).toBe(true)
    expect(result.velocity).toBe(0)
    closeTo(result.placement.position, ORIGIN)
  })
})

// ---------------------------------------------------------------------------
// 3.2 Thrust ratings
// ---------------------------------------------------------------------------

describe('3.2 thrust ratings', () => {
  it('lets a thrust-4 ship spend 4 on velocity alone', () => {
    const budget = thrustBudget({ turn: null, accel: 4 }, drive(4))
    expect(budget.available).toBe(4)
    expect(budget.turnAllowance).toBe(2)
    expect(budget.totalUsed).toBe(4)
    expect(budget.remaining).toBe(0)
  })

  it('lets a thrust-4 ship turn 2 and still change velocity by 2', () => {
    // 3.2: "could apply up to 2 points of thrust to course changes and still be
    // able to make a 2 MU change to velocity in the same turn."
    const result = applyOrder(ship(ORIGIN, 12, 6, drive(4)), { turn: port(2), accel: 2 })
    expect(result.legal).toBe(true)
    expect(result.budget.turnPoints).toBe(2)
    expect(result.budget.velocityPoints).toBe(2)
    expect(result.budget.totalUsed).toBe(4)
  })

  it('will not let a thrust-4 ship put 3 points into a course change', () => {
    // 3.2: "The ship cannot however, apply more than 2 of its available thrust
    // points to changing course."
    const result = applyOrder(ship(ORIGIN, 12, 6, drive(4)), { turn: port(3), accel: 1 })
    expect(result.legal).toBe(false)
    expect(result.violations).toContain('turn-exceeded')
  })

  it('worked example: thrust 6, 3 points, course 10 turns to 7 to port and 1 to starboard', () => {
    // 3.2: "A ship with thrust rating of 6 decides to apply 3 points (its
    // available maximum) to altering course. The ship is currently traveling on
    // course 10; if it is to turn to port ... ending up on course 7. Should the
    // turn be made to starboard ... the final course will be 1."
    const toPort = applyOrder(ship(ORIGIN, 10, 8, drive(6)), { turn: port(3), accel: 0 })
    expect(toPort.legal).toBe(true)
    expect(toPort.placement.facing).toBe(7)

    const toStarboard = applyOrder(ship(ORIGIN, 10, 8, drive(6)), { turn: starboard(3), accel: 0 })
    expect(toStarboard.legal).toBe(true)
    expect(toStarboard.placement.facing).toBe(1)
  })

  it('halves the turn allowance rounding down', () => {
    expect(standardTurnAllowance(drive(5))).toBe(2)
    expect(standardTurnAllowance(drive(6))).toBe(3)
    expect(standardTurnAllowance(drive(0))).toBe(0)
  })

  describe('the thrust-1 exception', () => {
    it('lets a thrust-1 ship change facing by one point', () => {
      const result = applyOrder(ship(ORIGIN, 12, 4, drive(1)), { turn: port(1), accel: 0 })
      expect(result.legal).toBe(true)
      expect(result.placement.facing).toBe(11)
      expect(result.drive.turnedLastTurn).toBe(true)
    })

    it('forbids the turn on consecutive game turns', () => {
      const result = applyOrder(
        ship(ORIGIN, 12, 4, drive(1, { turnedLastTurn: true })),
        { turn: port(1), accel: 0 },
      )
      expect(result.legal).toBe(false)
      expect(result.violations).toContain('consecutive-turn')
      expect(result.placement.facing).toBe(12)
    })

    it('clears the flag after a turn straight ahead', () => {
      const after = applyOrder(
        ship(ORIGIN, 12, 4, drive(1, { turnedLastTurn: true })),
        STRAIGHT_AHEAD,
      )
      expect(after.drive.turnedLastTurn).toBe(false)
      expect(standardTurnAllowance(after.drive)).toBe(1)
    })

    it('will not let a thrust-1 ship both turn and change velocity', () => {
      const result = applyOrder(ship(ORIGIN, 12, 4, drive(1)), { turn: port(1), accel: 1 })
      expect(result.legal).toBe(false)
      expect(result.violations).toContain('thrust-exceeded')
    })
  })

  it('gives a thrust-0 drive no budget at all', () => {
    const result = applyOrder(ship(ORIGIN, 12, 4, drive(0)), { turn: port(1), accel: 0 })
    expect(result.legal).toBe(false)
    expect(result.violations).toContain('drive-disabled')
  })
})

// ---------------------------------------------------------------------------
// 3.3 Advanced drives
// ---------------------------------------------------------------------------

describe('3.3 advanced drives', () => {
  it('may spend its whole rating on a course change', () => {
    expect(standardTurnAllowance(drive(6, { advanced: true }))).toBe(6)
    expect(standardTurnAllowance(drive(6))).toBe(3)
  })

  it('worked example: a thrust-6 advanced drive turns a full 180 degrees', () => {
    // 3.3: "A ship with an advanced drive with a thrust rating of 6 could
    // actually make a full 180 about-face in a single turn, though its path
    // would in fact be an L-shaped maneuver rather than a turn in place."
    const result = applyOrder(
      ship(ORIGIN, 12, 8, drive(6, { advanced: true })),
      { turn: starboard(6), accel: 0 },
    )
    expect(result.legal).toBe(true)
    expect(result.placement.facing).toBe(6)
    // L-shaped: two legs on different courses, not a pivot in place.
    expect(result.legs).toHaveLength(2)
    expect(result.legs[0].course).toBe(3)
    expect(result.legs[1].course).toBe(6)
    closeTo(result.placement.position, { x: 4, y: 4 })
  })

  it('does not widen the total budget', () => {
    const result = applyOrder(
      ship(ORIGIN, 12, 8, drive(6, { advanced: true })),
      { turn: starboard(6), accel: 2 },
    )
    expect(result.legal).toBe(false)
    expect(result.violations).toContain('thrust-exceeded')
  })

  it('refuses a 6-point turn from a standard thrust-6 drive', () => {
    const result = applyOrder(ship(ORIGIN, 12, 8, drive(6)), { turn: starboard(6), accel: 0 })
    expect(result.legal).toBe(false)
    expect(result.violations).toContain('turn-exceeded')
  })
})

// ---------------------------------------------------------------------------
// 3.4 Making course changes
// ---------------------------------------------------------------------------

describe('3.4 making course changes', () => {
  it('worked example A: course 3, velocity 10, three points to port', () => {
    // 3.4: "the ship is turned one point to port (half the total course change,
    // rounded down) bringing it to course 2. It is then moved half its velocity
    // - 5 MU - along course 2, then turned again through two course points,
    // bringing it round to course 12 as intended. Finally, the ship completes
    // its movement by travelling its remaining 5 MU along course 12."
    const result = applyOrder(ship(ORIGIN, 3, 10, drive(6)), { turn: port(3), accel: 0 })

    expect(result.legal).toBe(true)
    expect(result.legs).toHaveLength(2)
    expect(result.legs[0].course).toBe(2)
    expect(result.legs[0].distance).toBe(5)
    expect(result.legs[1].course).toBe(12)
    expect(result.legs[1].distance).toBe(5)
    expect(result.placement.facing).toBe(12)

    const mid = advance(ORIGIN, 2, 5)
    closeTo(result.legs[0].to, mid)
    closeTo(result.placement.position, advance(mid, 12, 5))
  })

  it('worked example B: course 7, velocity 6, +5 to velocity 11, one point to starboard', () => {
    // 3.4: "At the start of its movement the ship does not alter course (half of
    // one being rounded down to zero), so it moves half its distance (5 MU after
    // rounding down) along course 7. Now the ship makes its one point of turn to
    // course 8, and then moves the remaining 6 MU."
    const result = applyOrder(ship(ORIGIN, 7, 6, drive(6)), { turn: starboard(1), accel: 5 })

    expect(result.legal).toBe(true)
    expect(result.velocity).toBe(11)
    expect(result.legs).toHaveLength(2)
    expect(result.legs[0].course).toBe(7)
    expect(result.legs[0].distance).toBe(5)
    expect(result.legs[1].course).toBe(8)
    expect(result.legs[1].distance).toBe(6)
    expect(result.placement.facing).toBe(8)
  })

  it('agrees with geometry.moveShip, which owns the rounding rule', () => {
    for (const velocity of [0, 1, 5, 8, 11]) {
      for (const points of [-5, -3, -1, 0, 1, 2, 4]) {
        const order: MovementOrder = {
          turn: points === 0 ? null : points > 0 ? starboard(points) : port(-points),
          accel: 0,
        }
        const result = applyOrder(
          ship(ORIGIN, 12, velocity, drive(12, { advanced: true })),
          order,
        )
        const expected = moveShip(ORIGIN, 12, velocity, points)
        closeTo(result.placement.position, expected.position)
        expect(result.placement.facing).toBe(expected.course)
      }
    }
  })

  it('rounds an odd velocity down on the first leg and up on the second', () => {
    const result = applyOrder(ship(ORIGIN, 12, 9, drive(6)), { turn: starboard(2), accel: 0 })
    expect(result.legs[0].distance).toBe(4)
    expect(result.legs[1].distance).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// 3.5 Orders
// ---------------------------------------------------------------------------

describe('3.5 orders', () => {
  it('worked example: writes 8P2+4: 12', () => {
    // 3.5: "an order of 8P2+4: 12 would indicate a ship with an initial velocity
    // of 8 making a two point turn to port (P), plus acceleration of 4 MU, with
    // a new final velocity of 12 (8+4)."
    expect(formatOrder({ turn: port(2), accel: 4 }, 8)).toBe('8P2+4: 12')
  })

  it('worked example: reads 8P2+4: 12 back', () => {
    const parsed = parseOrder('8P2+4: 12')
    expect(parsed).not.toBeNull()
    expect(parsed?.startVelocity).toBe(8)
    expect(parsed?.finalVelocity).toBe(12)
    expect(parsed?.order.turn).toEqual({ direction: 'port', points: 2 })
    expect(parsed?.order.secondTurn).toBeNull()
    expect(parsed?.order.accel).toBe(4)
  })

  it('reads a deceleration and a bare velocity', () => {
    expect(parseOrder('8-3: 5')?.order.accel).toBe(-3)
    const bare = parseOrder('8: 8')
    expect(bare?.order.turn).toBeNull()
    expect(bare?.order.accel).toBe(0)
  })

  it('reads the double course change P1 S1', () => {
    const parsed = parseOrder('P1 S1')
    expect(parsed?.order.turn).toEqual({ direction: 'port', points: 1 })
    expect(parsed?.order.secondTurn).toEqual({ direction: 'starboard', points: 1 })
    expect(orderTurnPoints(parsed?.order ?? STRAIGHT_AHEAD)).toBe(2)
  })

  it('round-trips through the notation', () => {
    for (const text of ['8P2+4: 12', '6S3-2: 4', '10P1S1: 10', '4S3+3 ET: 7']) {
      const parsed = parseOrder(text)
      expect(parsed).not.toBeNull()
      expect(formatOrder(parsed?.order ?? STRAIGHT_AHEAD, parsed?.startVelocity ?? 0)).toBe(text)
    }
  })

  it('rejects three course changes and plain nonsense', () => {
    expect(parseOrder('8P1S1P1: 8')).toBeNull()
    expect(parseOrder('hard a-port')).toBeNull()
  })

  it('flies straight ahead at unchanged speed when the order is impossible', () => {
    // 3.5: "Any ship with no orders will move straight ahead at an unchanged
    // speed, as will any that are given impossible orders, such as one that
    // would exceed the ship's thrust rating."
    const result = applyOrder(ship(ORIGIN, 12, 8, drive(4)), { turn: port(2), accel: 6 })
    expect(result.legal).toBe(false)
    expect(result.violations).toContain('thrust-exceeded')
    expect(result.flown).toEqual(STRAIGHT_AHEAD)
    expect(result.velocity).toBe(8)
    expect(result.placement.facing).toBe(12)
    closeTo(result.placement.position, { x: 0, y: -8 })
  })

  describe('halted ships', () => {
    it('pivots without moving, still capped at half the drive rating', () => {
      // 3.5: "A halted ship is still restricted to pivoting no more than half the
      // drive rating."
      const result = applyOrder(ship(ORIGIN, 12, 0, drive(4)), { turn: starboard(2), accel: 0 })
      expect(result.legal).toBe(true)
      expect(result.placement.facing).toBe(2)
      closeTo(result.placement.position, ORIGIN)
      expect(result.velocity).toBe(0)
    })

    it('will not pivot further than the allowance', () => {
      const result = applyOrder(ship(ORIGIN, 12, 0, drive(4)), { turn: starboard(3), accel: 0 })
      expect(result.legal).toBe(false)
      expect(result.violations).toContain('turn-exceeded')
    })
  })

  describe('double course change', () => {
    it('worked example: P1 S1 resumes the original course, displaced to port', () => {
      // 3.5: "The ship in Figure 6 has orders P1 S1 to first turn to port and
      // then back to starboard, resuming the original course but at some
      // distance to port."
      const result = applyOrder(ship(ORIGIN, 12, 8, drive(4)), {
        turn: port(1),
        secondTurn: starboard(1),
        accel: 0,
      })

      expect(result.legal).toBe(true)
      expect(result.placement.facing).toBe(12)
      expect(result.legs).toHaveLength(2)
      expect(result.legs[0].course).toBe(11)
      expect(result.legs[1].course).toBe(12)
      // Course 12 is up the table, so port is the −x side.
      expect(result.placement.position.x).toBeLessThan(0)
      closeTo(result.placement.position, advance(advance(ORIGIN, 11, 4), 12, 4))
    })

    it('makes the first change in full before moving, even when it is the larger', () => {
      // 3.5: "always makes the first course change before moving and the second
      // at the half way point, even if the first change is greater than the
      // second."
      const result = applyOrder(ship(ORIGIN, 12, 8, drive(6)), {
        turn: starboard(2),
        secondTurn: port(1),
        accel: 0,
      })
      expect(result.legs[0].course).toBe(2)
      expect(result.legs[1].course).toBe(1)
      expect(result.placement.facing).toBe(1)
    })

    it('charges both legs against the course-change allowance', () => {
      const result = applyOrder(ship(ORIGIN, 12, 8, drive(4)), {
        turn: port(2),
        secondTurn: starboard(1),
        accel: 0,
      })
      expect(result.budget.turnPoints).toBe(3)
      expect(result.legal).toBe(false)
      expect(result.violations).toContain('turn-exceeded')
    })
  })
})

// ---------------------------------------------------------------------------
// 4.11 Drive damage, which gives a drive its *current* rating
// ---------------------------------------------------------------------------

describe('4.11 main drive damage', () => {
  it('halves the rating on the first threshold failure and disables it on the second', () => {
    const d = drive(4)
    expect(currentThrust(d)).toBe(4)
    const once = applyDriveHits(d, 1)
    expect(currentThrust(once)).toBe(2)
    const twice = applyDriveHits(once, 1)
    expect(currentThrust(twice)).toBe(0)
  })

  it('rounds the halving down', () => {
    expect(currentThrust(applyDriveHits(drive(5), 1))).toBe(2)
    expect(currentThrust(applyDriveHits(drive(3), 1))).toBe(1)
  })

  it('disables a rating-1 drive on the first failure', () => {
    // 4.11: "A drive rated only 1 is immediately disabled by the first threshold
    // failure."
    expect(currentThrust(applyDriveHits(drive(1), 1))).toBe(0)
  })

  it('recomputes every limit off the current rating', () => {
    const damaged = applyDriveHits(drive(4), 1)
    const budget = thrustBudget({ turn: null, accel: 3 }, damaged)
    expect(budget.printedRating).toBe(4)
    expect(budget.rating).toBe(2)
    expect(budget.available).toBe(2)
    expect(budget.turnAllowance).toBe(1)
    expect(budget.remaining).toBe(-1)
  })

  it('builds a drive state from the printed SSD figures', () => {
    const d = driveFromDef({ thrust: 6, advanced: true })
    expect(d.rating).toBe(6)
    expect(d.advanced).toBe(true)
    expect(currentThrust(d)).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// 3.6 Emergency thrust
// ---------------------------------------------------------------------------

describe('3.6 emergency thrust', () => {
  it('worked example: a main drive of 4 may use up to 6, a main drive of 3 up to 4', () => {
    // 3.6: "a ship with a main drive of 4 could use up to 6, or a ship with a
    // main drive of 3 could use up to 4."
    expect(emergencyThrustBonus(drive(4))).toBe(2)
    expect(thrustBudget({ turn: null, accel: 6, emergencyThrust: true }, drive(4)).available).toBe(6)
    expect(emergencyThrustBonus(drive(3))).toBe(1)
    expect(thrustBudget({ turn: null, accel: 4, emergencyThrust: true }, drive(3)).available).toBe(4)
  })

  it('worked example: a thrust-6 drive, normally limited to 3 for turning, may use 6', () => {
    // 3.6: "a ship with a main drive of 6, which would normally be allowed only
    // 3 thrust points for turning, could then use 6."
    const plain = applyOrder(ship(ORIGIN, 12, 8, drive(6)), { turn: port(6), accel: 0 })
    expect(plain.legal).toBe(false)

    const et = applyOrder(ship(ORIGIN, 12, 8, drive(6)), {
      turn: port(6),
      accel: 0,
      emergencyThrust: true,
    })
    expect(et.legal).toBe(true)
    expect(et.budget.turnAllowance).toBeGreaterThanOrEqual(6)
    expect(et.placement.facing).toBe(6)
  })

  it('works off the current rating, not the printed one', () => {
    // A thrust-4 drive halved by a threshold check (4.11) has a current rating
    // of 2, so ET buys it 1 more point, not 2.
    const damaged = applyDriveHits(drive(4), 1)
    expect(emergencyThrustBonus(damaged)).toBe(1)
    const budget = thrustBudget({ turn: port(2), accel: 1, emergencyThrust: true }, damaged)
    expect(budget.rating).toBe(2)
    expect(budget.available).toBe(3)
    expect(budget.totalUsed).toBe(3)
    expect(budget.remaining).toBe(0)
  })

  it('scores its dice as unscreened beam dice with no re-roll', () => {
    // 3.6: "1-3 results in 0, 4-5 results in 1, and 6 results in 2 but with NO
    // re-roll."
    expect([1, 2, 3, 4, 5, 6].map(emergencyThrustScore)).toEqual([0, 0, 0, 1, 1, 2])
  })

  it('reads the chart', () => {
    expect(emergencyThrustOutcome(0)).toBe('clean')
    expect(emergencyThrustOutcome(1)).toBe('success-damaged')
    expect(emergencyThrustOutcome(2)).toBe('failed')
    expect(emergencyThrustOutcome(3)).toBe('failed')
    expect(emergencyThrustOutcome(4)).toBe('failed-badly')
    expect(emergencyThrustOutcome(9)).toBe('failed-badly')
  })

  describe('the heavy cruiser, main drive 4, plotting P3+3', () => {
    const cruiser = drive(4)
    const plot: MovementOrder = {
      turn: port(3),
      accel: 3,
      emergencyThrust: true,
    }

    it('rolls 2 dice: over rating, and over half the rating for turning', () => {
      // 3.6: "The ship has used more thrust points than its rating (+1 die), and
      // has applied more than 1/2 of its rating to turn (+1 die). Thus, the ship
      // rolls 2 dice."
      const dice = emergencyThrustDice(plot, cruiser)
      expect(dice.overRating).toBe(true)
      expect(dice.overTurnLimit).toBe(true)
      expect(dice.priorUses).toBe(0)
      expect(dice.dice).toBe(2)
    })

    it('example 1: rolls of 2 and 3 give 0 — moves as plotted, no damage', () => {
      const result = rollEmergencyThrust(plot, cruiser, new ScriptedRng([2, 3]))
      expect(result.rolls).toEqual([2, 3])
      expect(result.scores).toEqual([0, 0])
      expect(result.total).toBe(0)
      expect(result.outcome).toBe('clean')
      expect(result.mustReplot).toBe(false)
      expect(result.driveHits).toBe(0)
      expect(currentThrust(result.drive)).toBe(4)
    })

    it('example 2: rolls of 1 and 5 give 1 — moves as plotted, drive halved', () => {
      // 3.6: "the ship would move as plotted, but would also halve its main
      // drive rating as if it had failed a threshold check."
      const result = rollEmergencyThrust(plot, cruiser, new ScriptedRng([1, 5]))
      expect(result.scores).toEqual([0, 1])
      expect(result.total).toBe(1)
      expect(result.outcome).toBe('success-damaged')
      expect(result.mustReplot).toBe(false)
      expect(result.driveHits).toBe(1)
      expect(currentThrust(result.drive)).toBe(2)
    })

    it('example 3: rolls of 4 and 5 give 2 — must re-plot, drive halved', () => {
      // 3.6: "then the ship must re-plot its movement, adhering to normal thrust
      // limitations and it takes threshold damage as above."
      const result = rollEmergencyThrust(plot, cruiser, new ScriptedRng([4, 5]))
      expect(result.scores).toEqual([1, 1])
      expect(result.total).toBe(2)
      expect(result.outcome).toBe('failed')
      expect(result.mustReplot).toBe(true)
      expect(result.driveHits).toBe(1)
      expect(currentThrust(result.drive)).toBe(2)
    })

    it('example 4: two sixes give 4 — must re-plot, drive destroyed', () => {
      // 3.6: "it takes damage as if it had failed TWO thresholds (essentially
      // destroying the main drive)."
      const result = rollEmergencyThrust(plot, cruiser, new ScriptedRng([6, 6]))
      expect(result.scores).toEqual([2, 2])
      expect(result.total).toBe(4)
      expect(result.outcome).toBe('failed-badly')
      expect(result.mustReplot).toBe(true)
      expect(result.driveHits).toBe(2)
      expect(currentThrust(result.drive)).toBe(0)
    })

    it('never re-rolls a six', () => {
      // Two dice in, two dice out — `rollBeamVolley` would have rolled more.
      const result = rollEmergencyThrust(plot, cruiser, new ScriptedRng([6, 6]))
      expect(result.rolls).toHaveLength(2)
    })

    it('example 5: next turn, S3+1 within the rating still rolls 2 dice', () => {
      // 3.6: "If, on the following turn, the same ship plotted 'S3+1,' using its
      // regular limit of 4 thrust points, but using more than half for turning
      // (+1 die), it would again roll 2 dice because it is the ship's second
      // attempt at using ET (+1 die) in the scenario."
      const afterOneUse = drive(4, { emergencyThrustUses: 1 })
      const next: MovementOrder = { turn: starboard(3), accel: 1, emergencyThrust: true }
      const dice = emergencyThrustDice(next, afterOneUse)
      expect(dice.overRating).toBe(false)
      expect(dice.overTurnLimit).toBe(true)
      expect(dice.priorUses).toBe(1)
      expect(dice.dice).toBe(2)
    })

    it('counts each attempt as a prior use', () => {
      const result = rollEmergencyThrust(plot, cruiser, new ScriptedRng([2, 3]))
      expect(result.drive.emergencyThrustUses).toBe(1)
      const second = rollEmergencyThrust(plot, result.drive, new ScriptedRng([1, 1, 1]))
      expect(second.dice.dice).toBe(3)
      expect(second.drive.emergencyThrustUses).toBe(2)
    })

    it('rolls nothing for a plot that stays inside the standard limits', () => {
      const inside: MovementOrder = { turn: port(2), accel: 2, emergencyThrust: true }
      const dice = emergencyThrustDice(inside, cruiser)
      expect(dice.isUse).toBe(false)
      expect(dice.dice).toBe(0)
      const result = rollEmergencyThrust(inside, cruiser, new ScriptedRng([]))
      expect(result.outcome).toBe('clean')
      expect(result.drive.emergencyThrustUses).toBe(0)
    })
  })

  it('re-plots a failed attempt against the drive as it now is', () => {
    // 3.6: "A ship that fails in its attempt to use ET must immediately re-plot
    // its movement using standard thrust limitations."
    const cruiser = ship(ORIGIN, 12, 8, drive(4))
    const plot: MovementOrder = { turn: port(3), accel: 3, emergencyThrust: true }
    const roll = rollEmergencyThrust(plot, cruiser.drive, new ScriptedRng([4, 5]))
    expect(roll.mustReplot).toBe(true)

    const replot = clampOrder(plot, { ...cruiser, drive: roll.drive })
    // Current rating 2: one point of turn, one of acceleration, and no ET.
    expect(replot.turn).toEqual({ direction: 'port', points: 1 })
    expect(replot.accel).toBe(1)
    expect(replot.emergencyThrust).toBe(false)

    const flown = applyOrder({ ...cruiser, drive: roll.drive }, replot)
    expect(flown.legal).toBe(true)
    expect(flown.velocity).toBe(9)
  })

  it('clamps an over-ambitious plot for a healthy drive too', () => {
    const clamped = clampOrder(
      { turn: port(4), secondTurn: starboard(2), accel: 5 },
      ship(ORIGIN, 12, 8, drive(6)),
    )
    expect(clamped.turn).toEqual({ direction: 'port', points: 3 })
    expect(clamped.secondTurn).toBeNull()
    expect(clamped.accel).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 3.7 Squadron operations
// ---------------------------------------------------------------------------

describe('3.7 squadron operations', () => {
  function squadron(
    formation: SquadronFormation,
    positions: Point[],
    ratings: number[],
    velocity = 8,
    advanced: boolean[] = [],
  ): Squadron {
    return {
      id: 'sq',
      formation,
      velocity,
      members: positions.map((position, i) => ({
        id: `s${i}`,
        placement: { position, facing: 12 as Placement['facing'] },
        drive: drive(ratings[i], { advanced: advanced[i] ?? false }),
      })),
    }
  }

  it('is two to four ships, or one big ship and up to six escorts', () => {
    const five = squadron(
      'line-abreast',
      [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 0 }, { x: 12, y: 0 }, { x: 16, y: 0 }],
      [4, 4, 4, 4, 4],
    )
    expect(validateSquadron(five).violations).toContain('bad-size')

    const ring = squadron(
      'escort-ring',
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: -4, y: 0 },
        { x: 0, y: 4 },
        { x: 0, y: -4 },
        { x: 3, y: 3 },
        { x: -3, y: 3 },
      ],
      [4, 4, 4, 4, 4, 4, 4],
    )
    expect(validateSquadron(ring).legal).toBe(true)
  })

  it('cannot mix standard and advanced drives', () => {
    const mixed = squadron(
      'wedge',
      [{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: -4, y: 4 }],
      [6, 6, 6],
      8,
      [true, false, false],
    )
    expect(validateSquadron(mixed).violations).toContain('mixed-drive-types')
  })

  it('is restricted to the lowest drive rating in the squadron', () => {
    // 3.7: "Squadron acceleration/deceleration and turning is restricted to that
    // of the ship with the lowest drive rating in the squadron."
    const sq = squadron('line-ahead', [{ x: 0, y: -8 }, { x: 0, y: 0 }], [6, 2])
    expect(currentThrust(squadronDrive(sq))).toBe(2)

    const tooFast = moveSquadron(sq, { turn: null, accel: 4 })
    expect(tooFast.lead.legal).toBe(false)
    expect(tooFast.velocity).toBe(8)
  })

  it('counts drive damage against the squadron limit', () => {
    const sq = squadron('line-ahead', [{ x: 0, y: -8 }, { x: 0, y: 0 }], [6, 6])
    sq.members[1].drive = applyDriveHits(sq.members[1].drive, 1)
    expect(currentThrust(squadronDrive(sq))).toBe(3)
  })

  it('leads a line-ahead squadron from the front', () => {
    // Course 12 is up the table, so the front ship has the smallest y.
    const sq = squadron('line-ahead', [{ x: 0, y: 0 }, { x: 0, y: -6 }, { x: 0, y: 6 }], [4, 4, 4])
    expect(squadronLead(sq, { turn: port(1), accel: 0 }).id).toBe('s1')
  })

  it('leads from the leftmost ship on a starboard turn, the rightmost on a port turn', () => {
    // 3.7: "the lead ship is the ship that has to move furthest, which is the
    // leftmost for starboard turns, the rightmost for port."
    const sq = squadron(
      'line-abreast',
      [{ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }],
      [4, 4, 4],
    )
    expect(squadronLead(sq, { turn: starboard(1), accel: 0 }).id).toBe('s0')
    expect(squadronLead(sq, { turn: port(1), accel: 0 }).id).toBe('s2')
  })

  it('keeps the formation rigid through a course change', () => {
    // 3.7: "the others maintain the same relative position to it throughout the
    // maneuver."
    const sq = squadron(
      'line-abreast',
      [{ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }],
      [4, 4, 4],
    )
    const moved = moveSquadron(sq, { turn: starboard(2), accel: 0 })
    expect(moved.leadId).toBe('s0')
    expect(moved.lead.placement.facing).toBe(2)

    const before = sq.members.map((m) => m.placement.position)
    const after = moved.placements.map((p) => p.placement.position)
    for (let i = 0; i < before.length; i++) {
      for (let j = i + 1; j < before.length; j++) {
        expect(Math.hypot(after[i].x - after[j].x, after[i].y - after[j].y)).toBeCloseTo(
          Math.hypot(before[i].x - before[j].x, before[i].y - before[j].y),
          6,
        )
      }
      expect(after[i]).not.toEqual(before[i])
      expect(moved.placements[i].placement.facing).toBe(2)
    }
  })

  it('leaves a healthy squadron with no stragglers', () => {
    const sq = squadron('line-ahead', [{ x: 0, y: -8 }, { x: 0, y: 0 }], [4, 4])
    const moved = moveSquadron(sq, { turn: port(2), accel: 2 })
    expect(moved.lead.legal).toBe(true)
    expect(moved.stragglers).toEqual([])
  })

  it('lets a ship with a dead drive coast along in formation', () => {
    const sq = squadron('line-ahead', [{ x: 0, y: -8 }, { x: 0, y: 0 }], [4, 4])
    const damaged: Squadron = {
      ...sq,
      members: [sq.members[0], { ...sq.members[1], drive: applyDriveHits(sq.members[1].drive, 2) }],
    }
    const moved = moveSquadron(damaged, STRAIGHT_AHEAD)
    expect(moved.stragglers).toEqual([])
  })

  it('marks a member whose drive is too weak for the order as a straggler', () => {
    // 3.7: "If any single ship cannot keep up with the rest of group due to
    // engine damage or some other issue it is considered destroyed."
    const sq = squadron('line-ahead', [{ x: 0, y: -8 }, { x: 0, y: 0 }], [6, 6])
    // The squadron plots to its full shared limit, then one ship loses half its
    // drive between plotting and moving.
    const order: MovementOrder = { turn: port(3), accel: 3 }
    const damaged: Squadron = {
      ...sq,
      members: [sq.members[0], { ...sq.members[1], drive: applyDriveHits(sq.members[1].drive, 1) }],
    }
    const moved = moveSquadron(damaged, order)
    expect(moved.stragglers).toEqual(['s1'])
  })
})

// ---------------------------------------------------------------------------
// 3.8 Collisions
// ---------------------------------------------------------------------------

describe('3.8 collisions', () => {
  it('lets ships pass through one another with no effect', () => {
    // 3.8: "Ships can freely move 'through' both friendly and enemy ships and
    // fighter groups."
    const a = applyOrder(ship({ x: 0, y: 0 }, 12, 10, drive(4)), STRAIGHT_AHEAD)
    const b = applyOrder(ship({ x: 0, y: -10 }, 6, 10, drive(4)), STRAIGHT_AHEAD)
    closeTo(a.placement.position, { x: 0, y: -10 })
    closeTo(b.placement.position, { x: 0, y: 0 })
    expect(a.legal && b.legal).toBe(true)
  })

  it('arranges touching models as closely as possible, without touching game state', () => {
    // 3.8: "If two ship models would actually be touching at the end of all
    // movement, they should simply be arranged as closely as possible."
    const ships = [
      { id: 'a', placement: { position: { x: 5, y: 5 }, facing: 12 as Placement['facing'] } },
      { id: 'b', placement: { position: { x: 5, y: 5 }, facing: 12 as Placement['facing'] } },
      { id: 'c', placement: { position: { x: 40, y: 40 }, facing: 12 as Placement['facing'] } },
    ]
    const laid = arrangeTouchingShips(ships, 2)

    expect(Math.hypot(laid[0].position.x - laid[1].position.x, laid[0].position.y - laid[1].position.y))
      .toBeCloseTo(2, 6)
    closeTo(laid[2].position, { x: 40, y: 40 })
    // The authoritative positions are untouched: ranges are still centre to centre.
    closeTo(ships[0].placement.position, { x: 5, y: 5 })
    closeTo(ships[1].placement.position, { x: 5, y: 5 })
  })

  it('leaves ships that are already clear alone', () => {
    const ships = [
      { id: 'a', placement: { position: { x: 0, y: 0 }, facing: 12 as Placement['facing'] } },
      { id: 'b', placement: { position: { x: 10, y: 0 }, facing: 12 as Placement['facing'] } },
    ]
    const laid = arrangeTouchingShips(ships, 2)
    closeTo(laid[0].position, { x: 0, y: 0 })
    closeTo(laid[1].position, { x: 10, y: 0 })
  })
})

// ---------------------------------------------------------------------------
// 3.9 Ships leaving the table
// ---------------------------------------------------------------------------

describe('3.9 ships leaving the table', () => {
  const table = { minX: 0, minY: 0, maxX: 72, maxY: 48 }

  it('knows when a ship has flown off the playing area', () => {
    expect(isOffTable({ x: 36, y: 24 }, table)).toBe(false)
    expect(isOffTable({ x: 36, y: -1 }, table)).toBe(true)
    expect(isOffTable({ x: 73, y: 24 }, table)).toBe(true)
  })

  it('remembers which side it left by', () => {
    // 3.9: "Ships will always re-enter play from the same side of the playing
    // area as they left."
    expect(departureEdge({ x: 36, y: -5 }, table)).toBe('top')
    expect(departureEdge({ x: 36, y: 60 }, table)).toBe('bottom')
    expect(departureEdge({ x: -2, y: 24 }, table)).toBe('left')
    expect(departureEdge({ x: 90, y: 24 }, table)).toBe('right')
    expect(departureEdge({ x: 36, y: 24 }, table)).toBeNull()
    // Out past a corner: the edge it overshot furthest.
    expect(departureEdge({ x: 74, y: -20 }, table)).toBe('top')
  })

  it('a roll of 1 to 3 keeps the ship out of the game', () => {
    for (const face of [1, 2, 3]) {
      const result = rollTableReentry(new ScriptedRng([face]), 3, 'left')
      expect(result.roll).toBe(face)
      expect(result.returns).toBe(false)
      expect(result.reentryTurn).toBeNull()
      expect(result.edge).toBe('left')
    }
  })

  it('a roll of 4 to 6 brings it back after that many turns', () => {
    // 3.9: "A roll of 4, 5, or 6 indicates the ship may re-enter the table after
    // the equivalent number of turns have elapsed (e.g. 5 turns if a 5 is
    // rolled)." Read as missing exactly that many turns.
    const result = rollTableReentry(new ScriptedRng([5]), 3, 'right')
    expect(result.returns).toBe(true)
    expect(result.reentryTurn).toBe(9)
    expect(rollTableReentry(new ScriptedRng([4]), 1).reentryTurn).toBe(6)
    expect(rollTableReentry(new ScriptedRng([6]), 1).reentryTurn).toBe(8)
  })
})
