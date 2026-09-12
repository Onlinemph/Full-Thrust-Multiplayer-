import { describe, expect, it } from 'vitest'

import {
  DEGREES_PER_CLOCK_POINT,
  ROTATION_COST,
  arcFromVectorShip,
  coastVector,
  courseBetween,
  courseUnitVector,
  createVectorState,
  formatVectorOrders,
  isPushOrder,
  isRotationOrder,
  mainDriveThrust,
  moveVector,
  moveVectorFleet,
  parseVectorOrders,
  roundVelocity,
  thrusterPoints,
  validateVectorOrders,
  vectorCollisionRisk,
  vectorCollisions,
  vectorOrderBudget,
  vectorStateFromCinematic,
  velocityVector,
  type VectorDrive,
  type VectorOrder,
  type VectorState,
} from './vectormovement'

/**
 * Section 12.12, checked against its own prose.
 *
 * 12.12 rolls no dice, so there is nothing here to seed: every rule in the
 * section is arithmetic, and the two worked figures are the only numbers the
 * book computes for us. They are asserted first, because a vector
 * implementation that disagrees with Figure 1 is wrong no matter what else it
 * does.
 *
 * The rest guards the places where the vector system quietly contradicts what
 * a section-3 reader thinks he knows: two thrust pools instead of one, a
 * rotation that costs the same at any angle, a push that has no forward
 * gear, a velocity that is re-measured rather than accumulated, and a
 * collision test that uses the chord rather than the track.
 */

const NORTH = 0
const EAST = 90

/** A thrust-6 cruiser: 6 main drive points, 3 manoeuvre points. */
const tr6: VectorDrive = { rating: 6, hits: 0 }

function ship(init: Partial<VectorState> & { facing?: 1 | 12 | 6 | 3 | 9 } = {}): VectorState {
  return createVectorState({
    position: init.position ?? { x: 0, y: 0 },
    facing: init.facing ?? 12,
    course: init.course ?? NORTH,
    velocity: init.velocity ?? 0,
  })
}

function orders(text: string): VectorOrder[] {
  const parsed = parseVectorOrders(text)
  expect(parsed.problems).toEqual([])
  return parsed.orders
}

// ---------------------------------------------------------------------------

describe('the book’s own two figures', () => {
  it('Figure 1: velocity 10, TP3 then MD6, finishes at velocity 12', () => {
    const start = ship({ velocity: 10 })
    const move = moveVector(start, orders('TP3, MD6'), tr6)

    // A → B: "the ship is moved along its present course by 10", to position B"
    expect(move.steps[0].position.x).toBeCloseTo(0, 9)
    expect(move.steps[0].position.y).toBeCloseTo(-10, 9)
    expect(move.steps[0].facing).toBe(12)

    // B → C: "it is then rotated 3 points (90 degrees) to PORT" — no movement.
    expect(move.steps[1].facing).toBe(9)
    expect(move.steps[1].position.y).toBeCloseTo(-10, 9)

    // C → D: "it is moved along its new facing by the amount of its Main Drive
    // burn, ie: 6", to its final position D"
    expect(move.end.position.x).toBeCloseTo(-6, 9)
    expect(move.end.position.y).toBeCloseTo(-10, 9)

    // "rounded to the nearest whole number it will be 12"
    expect(move.measured).toBeCloseTo(11.6619, 3)
    expect(move.end.velocity).toBe(12)
    expect(move.end.facing).toBe(9)
  })

  it('Figure 1’s new course is not a clockface direction', () => {
    const move = moveVector(ship({ velocity: 10 }), orders('TP3, MD6'), tr6)
    expect(move.end.course).toBeCloseTo(329.036, 3)
    // "the COURSE will usually NOT correspond exactly to a clockface direction"
    expect(move.end.course % DEGREES_PER_CLOCK_POINT).not.toBeCloseTo(0, 3)
  })

  it('Figure 2: velocity 6 and PS2 finishes at velocity 6, facing unchanged', () => {
    const move = moveVector(ship({ velocity: 6 }), orders('PS2'), tr6)

    expect(move.steps[0].position.y).toBeCloseTo(-6, 9)
    // "the ship's side thrusters fire to push it 2" to starboard … without
    // changing its facing"
    expect(move.end.position.x).toBeCloseTo(2, 9)
    expect(move.end.position.y).toBeCloseTo(-6, 9)
    expect(move.end.facing).toBe(12)

    // "rounded to the nearest whole number it will be 6"
    expect(move.measured).toBeCloseTo(6.3246, 3)
    expect(move.end.velocity).toBe(6)
    expect(move.end.course).toBeCloseTo(18.435, 3)
  })
})

describe('course and facing are different things', () => {
  it('a rotation changes the facing and never the course', () => {
    // "Note that a ROTATION changes the ship's FACING only, and never its COURSE."
    const move = moveVector(ship({ velocity: 6 }), orders('TS3'), tr6)
    expect(move.end.facing).toBe(3)
    expect(move.end.course).toBeCloseTo(NORTH, 9)
    expect(move.end.velocity).toBe(6)
  })

  it('a push changes the course and never the facing', () => {
    // "Note that a PUSH changes the ship's COURSE (and/or VELOCITY) only, and
    // never its FACING."
    const move = moveVector(ship({ velocity: 6 }), orders('PP3'), tr6)
    expect(move.end.facing).toBe(12)
    expect(move.end.course).not.toBeCloseTo(NORTH, 3)
  })

  it('fire arcs follow the bow, not the track', () => {
    // A ship running south with its bow north still has the north in its
    // forward arc (4.2 measures off the facing; 12.12 unbolts it from course).
    const fleeing = createVectorState({
      position: { x: 0, y: 0 },
      facing: 12,
      course: 180,
      velocity: 10,
    })
    expect(arcFromVectorShip(fleeing, { x: 0, y: -20 })).toBe('F')
    expect(arcFromVectorShip(fleeing, { x: 0, y: 20 })).toBe('A')
  })

  it('a cinematic ship converts in as the case where the two agree', () => {
    const converted = vectorStateFromCinematic({ position: { x: 5, y: 5 }, facing: 3 }, 8)
    expect(converted.course).toBe(90)
    expect(converted.facing).toBe(3)
    expect(velocityVector(converted).x).toBeCloseTo(8, 9)
    expect(velocityVector(converted).y).toBeCloseTo(0, 9)
  })
})

describe('the two thrust pools (12.12 “Manuvering Thrusters”)', () => {
  it('gives thrusters half the rating, rounded down — [reading] 1', () => {
    const points = (rating: number) => thrusterPoints({ rating, hits: 0 })
    expect(points(6)).toBe(3) // the book's own example
    expect(points(4)).toBe(2) // the book's own example
    expect(points(0)).toBe(0)
    expect(points(1)).toBe(0)
    expect(points(2)).toBe(1)
    expect(points(3)).toBe(1)
    expect(points(5)).toBe(2)
    expect(points(8)).toBe(4)
    expect(points(10)).toBe(5)
  })

  it('leaves a thrust-1 ship unable to rotate or push at all', () => {
    // "ships with low thrust ratings may prove VERY unmanoeuvrable under the
    // vector system" — half of 1, rounded down, is none.
    const tr1: VectorDrive = { rating: 1, hits: 0 }
    expect(thrusterPoints(tr1)).toBe(0)
    expect(validateVectorOrders(orders('TP1'), tr1).legal).toBe(false)
    expect(validateVectorOrders(orders('PS1'), tr1).legal).toBe(false)
    expect(validateVectorOrders(orders('MD1'), tr1).legal).toBe(true)
    expect(validateVectorOrders(orders('MD2'), tr1).legal).toBe(false)
  })

  it('spends thrusters in addition to a full main drive burn', () => {
    // "thruster use is allowed in addition to applying full available thrust
    // with the main drive - so that a ship with a Thrust Rating of 4 could
    // apply 2 points of thruster use and still use all 4 thrust points"
    const tr4: VectorDrive = { rating: 4, hits: 0 }
    const budget = vectorOrderBudget(orders('MD4, PS2'), tr4)
    expect(budget.mainDriveUsed).toBe(4)
    expect(budget.thrusterUsed).toBe(2)
    expect(budget.legal).toBe(true)
    // Six points of effect out of a rating of four; section 3 would allow four.
    expect(budget.mainDriveUsed + budget.thrusterUsed).toBe(6)
  })

  it('halves thruster power again when the drive is damaged', () => {
    // "when the main drive takes damage, thruster power is halved or lost
    // accordingly" — off the current rating, not the printed one (4.11, 10.1).
    expect(mainDriveThrust({ rating: 6, hits: 1 })).toBe(3)
    expect(thrusterPoints({ rating: 6, hits: 1 })).toBe(1)
    expect(thrusterPoints({ rating: 6, hits: 2 })).toBe(0)
    expect(mainDriveThrust({ rating: 6, hits: 2 })).toBe(0)
    // A rating-1 drive is disabled by its first hit, not halved to 1.
    expect(mainDriveThrust({ rating: 1, hits: 1 })).toBe(0)
    // A thrust-2 ship loses its only manoeuvre point to one hit.
    expect(thrusterPoints({ rating: 2, hits: 0 })).toBe(1)
    expect(thrusterPoints({ rating: 2, hits: 1 })).toBe(0)
  })
})

describe('rotation costs one point at any angle', () => {
  it('charges the same for 30 degrees and 180', () => {
    expect(vectorOrderBudget(orders('TP1'), tr6).thrusterUsed).toBe(ROTATION_COST)
    expect(vectorOrderBudget(orders('TP6'), tr6).thrusterUsed).toBe(ROTATION_COST)
    // "regardless of the thrust rating of its drives" — a thrust-2 ship with
    // its single manoeuvre point can still spin end for end.
    expect(validateVectorOrders(orders('TS6'), { rating: 2, hits: 0 }).legal).toBe(true)
  })

  it('turns port anticlockwise and starboard clockwise, wrapping the clock', () => {
    const spin = (text: string) => moveVector(ship(), orders(text), tr6).end.facing
    expect(spin('TP3')).toBe(9)
    expect(spin('TS3')).toBe(3)
    expect(spin('TP1')).toBe(11)
    expect(spin('TS1')).toBe(1)
    // TP7 and TS5 land on the same facing and cost the same.
    expect(spin('TP7')).toBe(spin('TS5'))
    expect(spin('TS12')).toBe(12)
    expect(vectorOrderBudget(orders('TS12'), tr6).thrusterUsed).toBe(1)
  })
})

describe('pushes (12.12 “Thruster Pushes”)', () => {
  it('names the effect, not the thruster', () => {
    // "a push of 3 with the port-side thrusters will shift the ship 3" to
    // starboard … we always use the direction of the EFFECT"
    const toStarboard = moveVector(ship(), orders('PS3'), tr6).end.position
    expect(toStarboard.x).toBeCloseTo(3, 9)
    const toPort = moveVector(ship(), orders('PP3'), tr6).end.position
    expect(toPort.x).toBeCloseTo(-3, 9)
  })

  it('has no forward gear', () => {
    // "Pushes may be made to PORT, STARBOARD or REVERSE" — and nothing else.
    expect(parseVectorOrders('PF3').problems).toHaveLength(1)
    expect(parseVectorOrders('PF3').orders).toEqual([])
  })

  it('costs one manoeuvre point per movement unit', () => {
    expect(vectorOrderBudget(orders('PS3'), tr6).thrusterUsed).toBe(3)
    expect(validateVectorOrders(orders('PS4'), tr6).legal).toBe(false)
  })

  it('reverses relative to the FACING, not the course — [reading] 2', () => {
    // Bow north, drifting east at 8. PR2 fires the retros along the hull axis,
    // which is southward: it barely touches the ship's speed.
    const drifting = createVectorState({
      position: { x: 0, y: 0 },
      facing: 12,
      course: EAST,
      velocity: 8,
    })
    const move = moveVector(drifting, orders('PR2'), tr6)
    expect(move.end.position.x).toBeCloseTo(8, 9)
    expect(move.end.position.y).toBeCloseTo(2, 9)
    expect(move.end.velocity).toBe(8)
    // The rejected reading — reverse along the COURSE — would have braked the
    // ship to (6, 0) and velocity 6.
    expect(move.end.position.x).not.toBeCloseTo(6, 3)
  })

  it('brakes exactly as the gloss says when the bow is on the course', () => {
    // The case the "slow the ship down" gloss describes: both readings agree.
    const move = moveVector(ship({ velocity: 8 }), orders('PR3'), tr6)
    expect(move.end.position.y).toBeCloseTo(-5, 9)
    expect(move.end.velocity).toBe(5)
    expect(move.end.course).toBeCloseTo(NORTH, 9)
  })

  it('takes its direction from the facing at that moment in the sequence', () => {
    // A rotation written before the push sends the push somewhere else.
    const before = moveVector(ship({ velocity: 6 }), orders('TS3, PS2'), tr6).end.position
    const after = moveVector(ship({ velocity: 6 }), orders('PS2, TS3'), tr6).end.position
    // TS3 first: facing 3, so starboard is due south (+y).
    expect(before.x).toBeCloseTo(0, 9)
    expect(before.y).toBeCloseTo(-4, 9)
    // PS2 first: facing still 12, so starboard is due east (+x).
    expect(after.x).toBeCloseTo(2, 9)
    expect(after.y).toBeCloseTo(-6, 9)
  })
})

describe('combining manoeuvres (12.12 “Combining Maneuvers”)', () => {
  it('allows one rotation and one push inside the thruster budget', () => {
    // "a ship with (say) 3 maneuver points … make a rotation (using up 1
    // thruster point), then apply a main drive burn, then use the remaining 2
    // maneuver points for a 2" thruster push"
    const budget = vectorOrderBudget(orders('TS1, MD6, PS2'), tr6)
    expect(budget.rotationPoints).toBe(1)
    expect(budget.pushPoints).toBe(2)
    expect(budget.thrusterUsed).toBe(3)
    expect(budget.thrusterRemaining).toBe(0)
    expect(budget.legal).toBe(true)
    expect(validateVectorOrders(orders('TS1, MD6, PS3'), tr6).legal).toBe(false)
  })

  it('refuses a second rotation or a second push', () => {
    const twoTurns = vectorOrderBudget(orders('TP1, TS1'), tr6)
    expect(twoTurns.rotations).toBe(2)
    expect(twoTurns.legal).toBe(false)
    expect(twoTurns.problems.join(' ')).toContain('ONE of each')
    // A push to port and a push to starboard is two pushes, not one.
    const twoPushes = vectorOrderBudget(orders('PP1, PS1'), tr6)
    expect(twoPushes.pushes).toBe(2)
    expect(twoPushes.legal).toBe(false)
  })

  it('caps main drive burns by their total, not their number — [reading] 3', () => {
    expect(validateVectorOrders(orders('MD3, TS3, MD3'), tr6).legal).toBe(true)
    expect(vectorOrderBudget(orders('MD3, TS3, MD3'), tr6).mainDriveUsed).toBe(6)
    expect(validateVectorOrders(orders('MD4, MD3'), tr6).legal).toBe(false)
    // And the split burn genuinely differs from the single one it was split
    // from, which is why the reading matters.
    const split = moveVector(ship({ velocity: 4 }), orders('MD3, TS3, MD3'), tr6).end
    const whole = moveVector(ship({ velocity: 4 }), orders('MD6, TS3'), tr6).end
    expect(split.facing).toBe(whole.facing)
    expect(split.position.x).not.toBeCloseTo(whole.position.x, 3)
  })

  it('treats a zero-point order as no order at all — [reading] 8', () => {
    const budget = vectorOrderBudget(orders('TP0, TS2, MD0'), { rating: 2, hits: 0 })
    expect(budget.rotations).toBe(1)
    expect(budget.thrusterUsed).toBe(1)
    expect(budget.legal).toBe(true)
    // And it leaves no trace in the flown sequence.
    const move = moveVector(ship({ velocity: 4 }), orders('TP0, TS2'), tr6)
    expect(move.steps).toHaveLength(2)
  })
})

describe('order sequence (12.12 “Order Sequence”)', () => {
  it('gives VERY different answers for TP2, MD6 and MD6, TP2', () => {
    const turnFirst = moveVector(ship({ velocity: 10 }), orders('TP2, MD6'), tr6)
    const burnFirst = moveVector(ship({ velocity: 10 }), orders('MD6, TP2'), tr6)

    expect(turnFirst.end.position.x).toBeCloseTo(-5.19615, 4)
    expect(turnFirst.end.position.y).toBeCloseTo(-13, 4)
    expect(turnFirst.end.velocity).toBe(14)

    expect(burnFirst.end.position.x).toBeCloseTo(0, 9)
    expect(burnFirst.end.position.y).toBeCloseTo(-16, 9)
    expect(burnFirst.end.velocity).toBe(16)

    // Same orders, same points, same final facing — six MU and two MU/turn apart.
    expect(turnFirst.end.facing).toBe(burnFirst.end.facing)
    const apart = Math.hypot(
      turnFirst.end.position.x - burnFirst.end.position.x,
      turnFirst.end.position.y - burnFirst.end.position.y,
    )
    expect(apart).toBeCloseTo(6, 6)
  })

  it('always flies the starting vector first, before any order', () => {
    const move = moveVector(ship({ velocity: 7 }), orders('MD2'), tr6)
    expect(move.steps[0].kind).toBe('vector')
    expect(move.steps[0].position.y).toBeCloseTo(-7, 9)
    expect(move.steps[1].kind).toBe('MD')
    expect(move.end.position.y).toBeCloseTo(-9, 9)
  })
})

describe('measuring the new vector (12.12 “Moving Ships”)', () => {
  it('rounds the tape reading to the nearest whole MU — [reading] 5', () => {
    expect(roundVelocity(6.4)).toBe(6)
    expect(roundVelocity(6.5)).toBe(7)
    expect(roundVelocity(6.6)).toBe(7)
    expect(roundVelocity(0.4)).toBe(0)
    expect(roundVelocity(0)).toBe(0)
  })

  it('re-measures the velocity rather than accumulating it', () => {
    // Figure 2 repeated. Turn one costs nothing in speed because the push is
    // square to the course; turn two does not, because after turn one the
    // course has moved and the same push now has a forward component.
    const first = moveVector(ship({ velocity: 6 }), orders('PS2'), tr6)
    expect(first.end.velocity).toBe(6)
    const second = moveVector(first.end, orders('PS2'), tr6)
    expect(second.end.velocity).toBe(7)
  })

  it('decelerates by turning the bow backwards and burning', () => {
    // "To DECELERATE using the main drive … the ship must be turned so that it
    // is pointing 'backwards' relative to its current course."
    const backwards = createVectorState({
      position: { x: 0, y: 0 },
      facing: 6,
      course: NORTH,
      velocity: 4,
    })
    const move = moveVector(backwards, orders('MD4'), tr6)
    expect(move.end.position.x).toBeCloseTo(0, 9)
    expect(move.end.position.y).toBeCloseTo(0, 9)
    expect(move.end.velocity).toBe(0)
  })

  it('keeps the old course when the ship finishes where it started — [reading] 7', () => {
    // Running east at 5 with the bow due west: MD5 puts the ship back on the
    // course marker, so the tape measure has no direction to be parallel to
    // and the arrow keeps pointing east.
    const stopping = createVectorState({
      position: { x: 7, y: -2 },
      facing: 9,
      course: EAST,
      velocity: 5,
    })
    const move = moveVector(stopping, orders('MD5'), tr6)
    expect(move.measured).toBeCloseTo(0, 9)
    expect(move.end.velocity).toBe(0)
    expect(move.end.course).toBeCloseTo(EAST, 9)
    expect(move.end.facing).toBe(9)

    // A ship that was already stationary and wrote nothing keeps it too.
    const drift = coastVector(
      createVectorState({ position: { x: 3, y: 4 }, facing: 1, course: 123.4, velocity: 0 }),
    )
    expect(drift.end.velocity).toBe(0)
    expect(drift.end.course).toBeCloseTo(123.4, 9)
    expect(drift.end.position).toEqual({ x: 3, y: 4 })
  })

  it('turns the marker even when the displacement rounds away to zero', () => {
    // A burn that very nearly cancels the starting vector: 0.26 MU of real
    // displacement, which rounds to velocity 0 but still has a direction. The
    // ship then sits still on a course it is not travelling, which is harmless
    // — velocity 0 moves nothing — but the arrow must not be left behind.
    const nearlyStopping = createVectorState({
      position: { x: 0, y: 0 },
      facing: 7,
      course: 15,
      velocity: 1,
    })
    const move = moveVector(nearlyStopping, orders('MD1'), tr6)
    expect(move.measured).toBeCloseTo(0.261, 3)
    expect(move.end.velocity).toBe(0)
    expect(move.end.course).toBeCloseTo(292.5, 6)
  })
})

describe('coasting and impossible orders — [reading] 4', () => {
  it('flies an over-budget order sheet as an empty one', () => {
    const move = moveVector(ship({ velocity: 8 }), orders('MD9, TP2'), tr6)
    expect(move.legal).toBe(false)
    expect(move.problems.length).toBeGreaterThan(0)
    // Straight ahead at an unchanged speed: the starting vector, no thrust.
    expect(move.steps).toHaveLength(1)
    expect(move.end.position.y).toBeCloseTo(-8, 9)
    expect(move.end.velocity).toBe(8)
    expect(move.end.facing).toBe(12)
    expect(move.end.course).toBeCloseTo(NORTH, 9)
  })

  it('coasts a ship with no orders and no drive', () => {
    const hulk = createVectorState({
      position: { x: 10, y: 10 },
      facing: 4,
      course: EAST,
      velocity: 5,
    })
    const move = coastVector(hulk)
    expect(move.legal).toBe(true)
    expect(move.end.position.x).toBeCloseTo(15, 9)
    expect(move.end.position.y).toBeCloseTo(10, 9)
    expect(move.end.velocity).toBe(5)
    expect(move.end.facing).toBe(4)
  })
})

describe('collisions (12.12 “Collisions”)', () => {
  const dogleg = () => moveVector(ship({ velocity: 10 }), orders('TP3, MD6'), tr6)

  it('ignores a rock the model ploughed through on the way', () => {
    // Figure 1's first leg runs from (0,0) to (0,-10) — straight through this
    // asteroid — but "the position of the ship model at any other time during
    // the movement sequence … does NOT indicate that the ship actually
    // occupies that point at any time".
    const onTheLeg = { id: 'rock', position: { x: 0, y: -9 }, radius: 1 }
    expect(vectorCollisions(dogleg(), [onTheLeg])).toEqual([])
  })

  it('catches a rock on the chord the model never went near', () => {
    // Dead centre of the A→D line, three MU clear of either leg.
    const onTheChord = { id: 'rock', position: { x: -3, y: -5 }, radius: 1 }
    expect(vectorCollisions(dogleg(), [onTheChord]).map((body) => body.id)).toEqual(['rock'])
  })

  it('measures the body as a disc — [reading] 6', () => {
    const from = { x: 0, y: 0 }
    const to = { x: 10, y: 0 }
    expect(vectorCollisionRisk(from, to, { id: 'a', position: { x: 5, y: 2 }, radius: 2 })).toBe(true)
    expect(vectorCollisionRisk(from, to, { id: 'b', position: { x: 5, y: 3 }, radius: 2 })).toBe(false)
    // The segment ends where the ship stops; a rock beyond it is not on the line.
    expect(vectorCollisionRisk(from, to, { id: 'c', position: { x: 14, y: 0 }, radius: 2 })).toBe(false)
    expect(vectorCollisionRisk(from, to, { id: 'd', position: { x: 11, y: 0 }, radius: 2 })).toBe(true)
  })

  it('reports the risk and resolves nothing — [reading] 9', () => {
    const bodies = [
      { id: 'near', position: { x: -3, y: -5 }, radius: 1 },
      { id: 'far', position: { x: 40, y: 40 }, radius: 3 },
    ]
    const hits = vectorCollisions(dogleg(), bodies)
    expect(hits).toHaveLength(1)
    // The body is handed back unchanged; nothing here rolls to avoid it (17.6).
    expect(hits[0]).toBe(bodies[0])
  })
})

describe('the fleet moves at once', () => {
  it('flies every ship off its own starting state', () => {
    const a = { id: 'a', state: ship({ velocity: 6 }), orders: orders('PS2'), drive: tr6 }
    const b = {
      id: 'b',
      state: createVectorState({ position: { x: 20, y: 0 }, facing: 6, course: 180, velocity: 4 }),
      orders: orders('MD4'),
      drive: tr6,
    }
    const together = moveVectorFleet([a, b])
    const reversed = moveVectorFleet([b, a])
    expect(Object.keys(together).sort()).toEqual(['a', 'b'])
    expect(together.a.end).toEqual(reversed.a.end)
    expect(together.b.end).toEqual(reversed.b.end)
    expect(together.a.end).toEqual(moveVector(a.state, a.orders, a.drive).end)
    expect(together.b.end.velocity).toBe(8)
  })
})

describe('the written order sheet', () => {
  it('round-trips the book’s own notation', () => {
    expect(formatVectorOrders(orders('TP3, MD6'))).toBe('TP3, MD6')
    expect(formatVectorOrders(orders('MD6, TP2'))).toBe('MD6, TP2')
    expect(formatVectorOrders(orders('PR3'))).toBe('PR3')
  })

  it('reads case and spacing loosely but keeps the order written', () => {
    const parsed = parseVectorOrders('ts1 md 6  pp2')
    expect(parsed.problems).toEqual([])
    expect(parsed.orders).toEqual([
      { kind: 'TS', points: 1 },
      { kind: 'MD', points: 6 },
      { kind: 'PP', points: 2 },
    ])
  })

  it('names what it could not read', () => {
    const parsed = parseVectorOrders('TP2, WOMBAT, MD3')
    expect(parsed.orders).toHaveLength(2)
    expect(parsed.problems[0]).toContain('WOMBAT')
  })

  it('sorts rotations from pushes', () => {
    expect(isRotationOrder('TP')).toBe(true)
    expect(isRotationOrder('TS')).toBe(true)
    expect(isRotationOrder('MD')).toBe(false)
    expect(isPushOrder('PR')).toBe(true)
    expect(isPushOrder('TS')).toBe(false)
  })

  it('rejects fractional and negative points', () => {
    const budget = vectorOrderBudget([{ kind: 'MD', points: 2.5 }], tr6)
    expect(budget.legal).toBe(false)
    expect(vectorOrderBudget([{ kind: 'PS', points: -1 }], tr6).legal).toBe(false)
  })
})

describe('the module’s own geometry', () => {
  it('agrees with the engine’s clock convention', () => {
    const at = (degrees: number) => courseUnitVector(degrees)
    expect(at(0).x).toBeCloseTo(0, 9)
    expect(at(0).y).toBeCloseTo(-1, 9)
    expect(at(90).x).toBeCloseTo(1, 9)
    expect(at(90).y).toBeCloseTo(0, 9)
    expect(at(180).y).toBeCloseTo(1, 9)
    expect(at(270).x).toBeCloseTo(-1, 9)
  })

  it('reads a bearing back off two points', () => {
    expect(courseBetween({ x: 0, y: 0 }, { x: 0, y: -5 })).toBeCloseTo(0, 9)
    expect(courseBetween({ x: 0, y: 0 }, { x: 5, y: 0 })).toBeCloseTo(90, 9)
    expect(courseBetween({ x: 0, y: 0 }, { x: 0, y: 5 })).toBeCloseTo(180, 9)
    expect(courseBetween({ x: 0, y: 0 }, { x: -5, y: 0 })).toBeCloseTo(270, 9)
  })
})

describe('purity', () => {
  it('never touches what it is handed', () => {
    const state = ship({ velocity: 10 })
    const written = orders('TP3, MD6')
    const drive: VectorDrive = { rating: 6, hits: 0 }
    const stateBefore = structuredClone(state)
    const ordersBefore = structuredClone(written)
    const driveBefore = structuredClone(drive)

    const move = moveVector(state, written, drive)
    expect(state).toEqual(stateBefore)
    expect(written).toEqual(ordersBefore)
    expect(drive).toEqual(driveBefore)

    // And the result does not alias the input position.
    move.end.position.x = 999
    expect(state.position.x).toBe(0)
    expect(move.start.position.x).toBe(0)
  })

  it('replays identically', () => {
    const state = ship({ velocity: 9 })
    const written = orders('TS2, MD5, PP1')
    const once = moveVector(state, written, tr6)
    const twice = moveVector(state, written, tr6)
    expect(once.end).toEqual(twice.end)
    expect(once.measured).toBe(twice.measured)
  })
})
