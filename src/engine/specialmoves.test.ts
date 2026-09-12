import { describe, expect, it } from 'vitest'

import { Rng, d6 } from './dice'
import { distance } from './geometry'
import {
  DISENGAGE_THRUST_BONUS,
  DOCKING_RANGE,
  IMPROVISED_TOW_LIMIT,
  RAM_CONTACT_RANGE,
  RAM_NERVE_TARGET,
  ROLL_THRUST_COST,
  TOW_LINK_TURNS,
  TOW_MATCH_RANGE,
  UNDOCKED,
  UPRIGHT,
  advanceTowLink,
  arcsWhenInverted,
  automaticRamSurcharge,
  beginTowLink,
  canManoeuvre,
  canTakeAnotherInTow,
  completeCastOff,
  completeDocking,
  coursesMatched,
  crowdedEdge,
  disengagementSucceeds,
  dockingApproach,
  driftForward,
  fasterFleetBonus,
  holdApproach,
  isDocked,
  leavingTableIsRetreat,
  linkedDriveRating,
  mirrorArc,
  movementPriority,
  orderCastOff,
  orderForMovement,
  orderedTurnIsUnaffectedByRoll,
  ramDamage,
  ramSucceeds,
  readyToDisengage,
  resolveDisengagement,
  resolveRam,
  rollBudget,
  rollShip,
  shiftTable,
  tableShift,
  weaponBears,
  withinRammingContact,
  writesMovementOrders,
  type DisengagingShip,
  type DriftingObject,
  type TowVector,
} from './specialmoves'
import type { Arc, Course } from './types'

/**
 * Section 16, checked against its own prose.
 *
 * Four kinds of test earn their place here. The book's two worked examples —
 * the salvage ship's tow rating and the corvette that rams a heavy cruiser —
 * because they are the only places the author shows his arithmetic. The
 * boundaries, because every distance in this section is a "within" and every
 * contest turns on which side a tie falls. The [reading]s, because each one
 * could have gone the other way and the test is what records which way it
 * went. And purity, because a replay depends on it.
 */

const at = (x: number, y: number) => ({ x, y })

// ---------------------------------------------------------------------------
// 16.1 Thrust 0 drives
// ---------------------------------------------------------------------------

describe('thrust 0 drives (16.1)', () => {
  const rock: DriftingObject = { id: 'rock', position: at(0, 0), course: 3, velocity: 6 }

  it('writes no orders at thrust 0, and does at thrust 1', () => {
    expect(writesMovementOrders(0)).toBe(false)
    expect(writesMovementOrders(1)).toBe(true)
    // A drive shot out under 4.11 is in the same position for the same reason.
    expect(writesMovementOrders(0)).toBe(false)
  })

  it('moves before all other ships', () => {
    const units = [
      { id: 'cruiser', thrust: 4 },
      { id: 'hulk', thrust: 0 },
      { id: 'escort', thrust: 6 },
      { id: 'asteroid', thrust: 0 },
    ]
    expect(orderForMovement(units, (u) => u.thrust).map((u) => u.id)).toEqual([
      'hulk',
      'asteroid',
      'cruiser',
      'escort',
    ])
    expect(movementPriority(0)).toBeLessThan(movementPriority(1))
  })

  it('leaves the caller’s order alone within each group, and the caller’s array alone', () => {
    const units = [
      { id: 'a', thrust: 0 },
      { id: 'b', thrust: 0 },
      { id: 'c', thrust: 2 },
    ]
    expect(orderForMovement(units, (u) => u.thrust).map((u) => u.id)).toEqual(['a', 'b', 'c'])
    expect(units.map((u) => u.id)).toEqual(['a', 'b', 'c'])
  })

  it('drifts in a straight line at a constant speed [reading]', () => {
    // The predetermined course is one line, held for the battle: after three
    // turns the rock is 18 MU along course 3 and still on course 3.
    let drifting = rock
    for (let turn = 0; turn < 3; turn++) drifting = driftForward(drifting)
    expect(drifting.course).toBe(3)
    expect(drifting.velocity).toBe(6)
    expect(distance(rock.position, drifting.position)).toBeCloseTo(18, 6)
    // Course 3 is "right" on the clock face, so the drift is along +x.
    expect(drifting.position.x).toBeCloseTo(18, 6)
    expect(drifting.position.y).toBeCloseTo(0, 6)
  })

  it('does not move a halted object, and never mutates the one it is given', () => {
    const station: DriftingObject = { id: 'base', position: at(5, 5), course: 12, velocity: 0 }
    expect(driftForward(station).position).toEqual(at(5, 5))
    driftForward(rock)
    expect(rock.position).toEqual(at(0, 0))
  })
})

// ---------------------------------------------------------------------------
// 16.2 Rolling ships
// ---------------------------------------------------------------------------

describe('rolling ships (16.2)', () => {
  it('costs one thrust factor, taken off the turning allowance — the book’s thrust-4 ship', () => {
    expect(ROLL_THRUST_COST).toBe(1)
    // "A thrust-4 ship, normally capable of 2 points of turn, could only turn 1
    // point if it also rolled that move; but would still be able to use its
    // other two thrust factors to accelerate or decelerate as normal."
    const budget = rollBudget(4, 2)
    expect(budget.canRoll).toBe(true)
    expect(budget.turnAllowance).toBe(1)
    expect(budget.thrustRemaining).toBe(3)
    // 1 roll + 1 turn + 2 accel = 4.
    expect(budget.thrustRemaining - budget.turnAllowance).toBe(2)
  })

  it('cannot be done with no thrust at all', () => {
    const dead = rollBudget(0, 0)
    expect(dead.canRoll).toBe(false)
    expect(dead.reason).toContain('1 thrust factor')
  })

  it('can still be done with the turning allowance already spent to zero [reading]', () => {
    // A rating-1 drive that turned last turn has an allowance of 0 under 3.2.
    // The charge floors rather than forbidding the roll — 16.2 exists for the
    // damaged ship.
    const budget = rollBudget(1, 0)
    expect(budget.canRoll).toBe(true)
    expect(budget.turnAllowance).toBe(0)
    expect(budget.thrustRemaining).toBe(0)
  })

  it('swaps port and starboard, and leaves bow and stern alone', () => {
    expect(mirrorArc('FP')).toBe('FS')
    expect(mirrorArc('FS')).toBe('FP')
    expect(mirrorArc('AP')).toBe('AS')
    expect(mirrorArc('AS')).toBe('AP')
    expect(mirrorArc('F')).toBe('F')
    expect(mirrorArc('A')).toBe('A')
  })

  it('is its own inverse, which is why rolling back upright restores the arcs', () => {
    const arcs: Arc[] = ['F', 'FS', 'AS', 'A', 'AP', 'FP']
    for (const arc of arcs) expect(mirrorArc(mirrorArc(arc))).toBe(arc)
    expect(arcsWhenInverted(arcsWhenInverted(arcs, true), true)).toEqual(arcs)
    expect(arcsWhenInverted(arcs, false)).toEqual(arcs)
  })

  it('brings the port battery to bear on a starboard target', () => {
    // Ship at the origin facing 12; the target sits 60 degrees off the bow to
    // starboard, which is the FS arc (4.2).
    const origin = at(0, 0)
    const target = at(10 * Math.sin(Math.PI / 3), -10 * Math.cos(Math.PI / 3))
    const portBroadside: Arc[] = ['FP', 'AP']

    expect(weaponBears(portBroadside, origin, 12, target, false)).toBe(false)
    expect(weaponBears(portBroadside, origin, 12, target, true)).toBe(true)

    // And the starboard battery loses the target it had.
    const starboardBroadside: Arc[] = ['FS', 'AS']
    expect(weaponBears(starboardBroadside, origin, 12, target, false)).toBe(true)
    expect(weaponBears(starboardBroadside, origin, 12, target, true)).toBe(false)
  })

  it('leaves a forward-arc mounting bearing whichever way up the ship is', () => {
    const origin = at(0, 0)
    const deadAhead = at(0, -10)
    expect(weaponBears(['F'], origin, 12, deadAhead, false)).toBe(true)
    expect(weaponBears(['F'], origin, 12, deadAhead, true)).toBe(true)
  })

  it('does not mirror the movement order, only the arcs', () => {
    // "An order written for a port turn will still turn the model to the left."
    const order = { direction: 'port' as const, points: 2 }
    expect(orderedTurnIsUnaffectedByRoll(order, true)).toEqual(order)
    expect(orderedTurnIsUnaffectedByRoll(order, false)).toEqual(order)
    // While the arcs, in the same breath, do flip.
    expect(mirrorArc('FP')).not.toBe('FP')
  })

  it('is a standing condition, toggled by rolling again', () => {
    const inverted = rollShip(UPRIGHT, 3)
    expect(inverted.inverted).toBe(true)
    expect(inverted.rolledOnTurn).toBe(3)
    const upright = rollShip(inverted, 7)
    expect(upright.inverted).toBe(false)
    expect(upright.rolledOnTurn).toBe(7)
    // The original value is untouched.
    expect(UPRIGHT.inverted).toBe(false)
    expect(inverted.rolledOnTurn).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 16.3 Towing ships
// ---------------------------------------------------------------------------

describe('towing ships (16.3)', () => {
  const halted = (x: number, facing: Course = 12): TowVector => ({
    position: at(x, 0),
    facing,
    velocity: 0,
  })
  const running = (x: number, facing: Course = 12, velocity = 4): TowVector => ({
    position: at(x, 0),
    facing,
    velocity,
  })

  it('matches courses at exactly 3 MU but not beyond', () => {
    expect(TOW_MATCH_RANGE).toBe(3)
    expect(coursesMatched(halted(0), halted(3)).matched).toBe(true)
    const tooFar = coursesMatched(halted(0), halted(3.5))
    expect(tooFar.matched).toBe(false)
    expect(tooFar.reason).toContain('3 MU')
  })

  it('asks nothing about facing when both ships are halted', () => {
    // "Either both halted, or both moving at the same velocity and course
    // facing" — the facing clause belongs to the moving branch.
    expect(coursesMatched(halted(0, 12), halted(2, 4)).matched).toBe(true)
  })

  it('demands an exact facing and velocity match once they are moving', () => {
    expect(coursesMatched(running(0, 12, 4), running(2, 12, 4)).matched).toBe(true)
    expect(coursesMatched(running(0, 12, 4), running(2, 1, 4)).matched).toBe(false)
    expect(coursesMatched(running(0, 12, 4), running(2, 12, 5)).matched).toBe(false)
    // One halted and one moving is not a match either.
    expect(coursesMatched(halted(0), running(2)).matched).toBe(false)
  })

  it('reproduces the salvage ship’s thrust rating', () => {
    // "Mass 80 × thrust 4 = 320 available thrust. Dividing this by the combined
    // mass of 80 + 160 = 240 gives 320 ÷ 240 = 1.5, thrust rating 1."
    const linked = linkedDriveRating({ mass: 80, thrust: 4 }, [{ mass: 160 }])
    expect(linked.availableThrust).toBe(320)
    expect(linked.combinedMass).toBe(240)
    expect(linked.thrust).toBe(1)
    expect(linked.outsideBattleTimeframe).toBe(false)
  })

  it('counts the tug’s own mass in the denominator, and rounds down', () => {
    // Divide by the tow alone and the same ship reads thrust 2; divide by the
    // pair and round down and it reads 1. Both traps in one assertion.
    expect(320 / 160).toBe(2)
    expect(linkedDriveRating({ mass: 80, thrust: 4 }, [{ mass: 160 }]).thrust).toBe(1)
  })

  it('adds every hull in the tow to the combined mass', () => {
    const linked = linkedDriveRating({ mass: 100, thrust: 6 }, [{ mass: 50 }, { mass: 50 }])
    expect(linked.combinedMass).toBe(200)
    expect(linked.availableThrust).toBe(600)
    expect(linked.thrust).toBe(3)
  })

  it('treats a rating that rounds to zero as a slow tow, not a failed one', () => {
    const linked = linkedDriveRating({ mass: 20, thrust: 2 }, [{ mass: 200 }])
    expect(linked.thrust).toBe(0)
    expect(linked.outsideBattleTimeframe).toBe(true)
  })

  it('links in one turn when equipped for towing and two when improvised', () => {
    expect(TOW_LINK_TURNS.equipped).toBe(1)
    expect(TOW_LINK_TURNS.improvised).toBe(2)
    const good = { matched: true, hullDamageToTug: 0 }

    const tug = advanceTowLink(beginTowLink('tug', 'hulk', 'equipped'), good)
    expect(tug.link.linked).toBe(true)

    const first = advanceTowLink(beginTowLink('cruiser', 'hulk', 'improvised'), good)
    expect(first.link.linked).toBe(false)
    expect(first.link.turnsSpent).toBe(1)
    expect(advanceTowLink(first.link, good).link.linked).toBe(true)
  })

  it('breaks on a single hull box and holds on none', () => {
    // "Inflicts at least one hull box of damage" — a volley entirely soaked by
    // screens or armour breaks nothing.
    const part = beginTowLink('cruiser', 'hulk', 'improvised')
    const held = advanceTowLink(part, { matched: true, hullDamageToTug: 0 })
    expect(held.broken).toBe(false)
    expect(held.link.turnsSpent).toBe(1)

    const shot = advanceTowLink(held.link, { matched: true, hullDamageToTug: 1 })
    expect(shot.broken).toBe(true)
    expect(shot.link.linked).toBe(false)
  })

  it('restarts a broken link from the beginning rather than pausing it', () => {
    const part = advanceTowLink(beginTowLink('cruiser', 'hulk', 'improvised'), {
      matched: true,
      hullDamageToTug: 0,
    })
    expect(part.link.turnsSpent).toBe(1)
    const broken = advanceTowLink(part.link, { matched: false, hullDamageToTug: 0 })
    expect(broken.broken).toBe(true)
    expect(broken.link.turnsSpent).toBe(0)
    // And the whole two turns must be spent again.
    const again = advanceTowLink(broken.link, { matched: true, hullDamageToTug: 0 })
    expect(again.link.linked).toBe(false)
  })

  it('leaves a finished link alone [reading]', () => {
    // "During this time" scopes the break conditions to the establishing turns.
    const linked = advanceTowLink(beginTowLink('tug', 'hulk', 'equipped'), {
      matched: true,
      hullDamageToTug: 0,
    }).link
    expect(linked.linked).toBe(true)
    const after = advanceTowLink(linked, { matched: false, hullDamageToTug: 6 })
    expect(after.broken).toBe(false)
    expect(after.link).toEqual(linked)
  })

  it('limits an improvised tug to a single ship', () => {
    expect(IMPROVISED_TOW_LIMIT).toBe(1)
    expect(canTakeAnotherInTow('improvised', 0).allowed).toBe(true)
    expect(canTakeAnotherInTow('improvised', 1).allowed).toBe(false)
    expect(canTakeAnotherInTow('equipped', 3).allowed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 16.4 Moving table
// ---------------------------------------------------------------------------

describe('the moving table (16.4)', () => {
  const fleet = [
    { id: 'a', position: at(10, 10) },
    { id: 'b', position: at(40, 25) },
    { id: 'c', position: at(70, 5) },
  ]

  it('changes nothing about the geometry of the battle', () => {
    // "All things are relative, as someone once said."
    const shifted = shiftTable(fleet, tableShift('top', 24))
    for (let i = 0; i < fleet.length; i++) {
      for (let j = i + 1; j < fleet.length; j++) {
        expect(distance(shifted[i].position, shifted[j].position)).toBeCloseTo(
          distance(fleet[i].position, fleet[j].position),
          9,
        )
      }
    }
  })

  it('pushes everything back towards the opposite edge', () => {
    expect(tableShift('top', 10)).toEqual(at(0, 10))
    expect(tableShift('bottom', 10)).toEqual(at(0, -10))
    expect(tableShift('left', 10)).toEqual(at(10, 0))
    expect(tableShift('right', 10)).toEqual(at(-10, 0))
  })

  it('returns new objects and leaves the originals where they were', () => {
    const shifted = shiftTable(fleet, tableShift('left', 5))
    expect(shifted[0].position).toEqual(at(15, 10))
    expect(fleet[0].position).toEqual(at(10, 10))
    expect(shifted[0]).not.toBe(fleet[0])
  })

  it('reports an edge only when every ship is inside the margin [reading]', () => {
    const table = { width: 180, height: 120 }
    const crowding = [at(6, 40), at(10, 60), at(3, 80)]
    expect(crowdedEdge(crowding, table, 12)).toBe('left')
    // One straggler at the far end and the table stays put.
    expect(crowdedEdge([...crowding, at(150, 60)], table, 12)).toBe(null)
    expect(crowdedEdge([], table, 12)).toBe(null)
  })

  it('picks the tighter edge when a fleet has run into a corner', () => {
    const table = { width: 180, height: 120 }
    // Every ship is within 20 of the left edge and within 10 of the top.
    const cornered = [at(18, 8), at(12, 4), at(20, 9)]
    expect(crowdedEdge(cornered, table, 25)).toBe('top')
  })

  it('is what decides whether leaving the table is a retreat (3.9)', () => {
    expect(leavingTableIsRetreat(false)).toBe(true)
    expect(leavingTableIsRetreat(true)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 16.5 Disengaging from battle
// ---------------------------------------------------------------------------

describe('disengaging from battle (16.5)', () => {
  const gone = (thrust: number, edge: DisengagingShip['exitEdge'] = 'left'): DisengagingShip => ({
    onTable: false,
    exitEdge: edge,
    thrust,
  })

  it('waits for the last ship, and for one edge', () => {
    expect(readyToDisengage([gone(4), { onTable: true, exitEdge: null, thrust: 4 }]).ready).toBe(
      false,
    )
    const split = readyToDisengage([gone(4, 'left'), gone(6, 'top')])
    expect(split.ready).toBe(false)
    expect(split.reason).toContain('same table edge')
    const clean = readyToDisengage([gone(4), gone(6)])
    expect(clean.ready).toBe(true)
    expect(clean.edge).toBe('left')
  })

  it('gives +2 to the fleet with the fastest ship — the book’s 8 against 6', () => {
    expect(DISENGAGE_THRUST_BONUS).toBe(2)
    expect(fasterFleetBonus([8, 4, 4], [6, 6, 2])).toBe(2)
    expect(fasterFleetBonus([6, 6, 2], [8, 4, 4])).toBe(0)
  })

  it('gives it to nobody when the best ratings tie', () => {
    // The comparison is strict, so at most one side can ever hold the bonus.
    expect(fasterFleetBonus([6, 2], [6, 6])).toBe(0)
    expect(fasterFleetBonus([6, 6], [6, 2])).toBe(0)
  })

  it('gives it to nobody when a side has no ships [reading]', () => {
    expect(fasterFleetBonus([8], [])).toBe(0)
    expect(fasterFleetBonus([], [8])).toBe(0)
  })

  it('lets the runner win the tie — 21 of the 36 pairs', () => {
    // "Equal to or higher" is a getaway. This is the number a reader reverses.
    let away = 0
    for (let mine = 1; mine <= 6; mine++) {
      for (let theirs = 1; theirs <= 6; theirs++) {
        if (disengagementSucceeds(mine, theirs)) away++
      }
    }
    expect(away).toBe(21)
    expect(disengagementSucceeds(3, 3)).toBe(true)
    expect(disengagementSucceeds(3, 4)).toBe(false)
  })

  it('rolls the disengaging player’s die first', () => {
    // Fixed so a replay is a replay; the book does not order the two dice.
    const expected = d6(new Rng(2))
    const result = resolveDisengagement([4], [4], new Rng(2))
    expect(result.disengagingRoll).toBe(expected)
    expect(result.disengagingRoll).toBe(5)
    expect(result.pursuingRoll).toBe(2)
    expect(result.disengaged).toBe(true)
    expect(result.pursuitAvailable).toBe(false)
  })

  it('offers the pursuit when the pursuer rolls higher', () => {
    // Seed 9 gives 2 then 6, and neither fleet is faster than the other.
    const result = resolveDisengagement([4], [4], new Rng(9))
    expect(result.disengagingTotal).toBe(2)
    expect(result.pursuingTotal).toBe(6)
    expect(result.disengaged).toBe(false)
    expect(result.pursuitAvailable).toBe(true)
    expect(result.detail).toContain('stern chase')
  })

  it('adds the bonus into the total, not beside it', () => {
    // Seed 11 rolls 4 and 4: a tie the disengager would win anyway, so give the
    // pursuer the faster fleet and watch the +2 turn it over.
    const result = resolveDisengagement([4], [8], new Rng(11))
    expect(result.disengagingRoll).toBe(4)
    expect(result.pursuingRoll).toBe(4)
    expect(result.pursuingBonus).toBe(DISENGAGE_THRUST_BONUS)
    expect(result.pursuingTotal).toBe(6)
    expect(result.disengaged).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 16.6 Docking
// ---------------------------------------------------------------------------

describe('docking (16.6)', () => {
  const starbase = { position: at(0, 0), facing: 12 as const, velocity: 0 }
  const convoy = { position: at(0, 0), facing: 3 as const, velocity: 6 }

  it('docks at exactly 3 MU and not a hair further', () => {
    expect(DOCKING_RANGE).toBe(3)
    expect(dockingApproach({ position: at(3, 0), facing: 12, velocity: 0 }, starbase).met).toBe(true)
    const wide = dockingApproach({ position: at(3.2, 0), facing: 12, velocity: 0 }, starbase)
    expect(wide.met).toBe(false)
    expect(wide.reason).toContain('3 MU')
  })

  it('requires a dead stop against a stationary target, and nothing about facing [reading]', () => {
    // "If the target is stationary, the ship must also come to a dead stop."
    const stopped = dockingApproach({ position: at(2, 0), facing: 7, velocity: 0 }, starbase)
    expect(stopped.met).toBe(true)
    expect(stopped.targetStationary).toBe(true)

    const drifting = dockingApproach({ position: at(2, 0), facing: 12, velocity: 1 }, starbase)
    expect(drifting.met).toBe(false)
    expect(drifting.reason).toContain('dead stop')
  })

  it('requires both course and velocity against a moving target', () => {
    expect(dockingApproach({ position: at(2, 0), facing: 3, velocity: 6 }, convoy).met).toBe(true)
    expect(dockingApproach({ position: at(2, 0), facing: 3, velocity: 5 }, convoy).met).toBe(false)
    expect(dockingApproach({ position: at(2, 0), facing: 4, velocity: 6 }, convoy).met).toBe(false)
    // The docking ship being stopped is no help at all when the target is not.
    expect(dockingApproach({ position: at(2, 0), facing: 3, velocity: 0 }, convoy).met).toBe(false)
  })

  it('docks on the following turn, not the turn of the approach [reading]', () => {
    const held = holdApproach(UNDOCKED, 'base', 4)
    expect(held.phase).toBe('approach-held')
    expect(isDocked(held)).toBe(false)
    // Same turn: nothing happens.
    expect(completeDocking(held, 4).phase).toBe('approach-held')
    const docked = completeDocking(held, 5)
    expect(isDocked(docked)).toBe(true)
    expect(docked.targetId).toBe('base')
  })

  it('spends a full turn casting off before it may manoeuvre [reading]', () => {
    const docked = completeDocking(holdApproach(UNDOCKED, 'base', 1), 2)
    expect(canManoeuvre(docked)).toBe(false)

    const letting = orderCastOff(docked, 5)
    expect(letting.phase).toBe('casting-off')
    expect(canManoeuvre(letting)).toBe(false)
    expect(completeCastOff(letting, 5).phase).toBe('casting-off')

    const free = completeCastOff(letting, 6)
    expect(free.phase).toBe('free')
    expect(free.targetId).toBe(null)
    expect(canManoeuvre(free)).toBe(true)
  })

  it('will not cast off a ship that is not docked, or dock one already docked', () => {
    expect(orderCastOff(UNDOCKED, 3)).toBe(UNDOCKED)
    const docked = completeDocking(holdApproach(UNDOCKED, 'base', 1), 2)
    expect(holdApproach(docked, 'other', 3)).toBe(docked)
    expect(completeDocking(docked, 9)).toBe(docked)
  })

  it('never mutates the status it is given', () => {
    const held = holdApproach(UNDOCKED, 'base', 4)
    completeDocking(held, 5)
    expect(held.phase).toBe('approach-held')
    expect(UNDOCKED.phase).toBe('free')
  })
})

// ---------------------------------------------------------------------------
// 16.7 Ramming
// ---------------------------------------------------------------------------

describe('ramming (16.7)', () => {
  const attacker = { position: at(0, 0), thrust: 4, hullBoxes: 2 }
  const target = { position: at(1, 0), thrust: 4, hullBoxes: 16 }

  it('needs the ships inside 2 MU, or the models touching', () => {
    expect(RAM_CONTACT_RANGE).toBe(2)
    expect(withinRammingContact(at(0, 0), at(2, 0)).within).toBe(true)
    expect(withinRammingContact(at(0, 0), at(2.4, 0)).within).toBe(false)
    // "Or models touching in the case of large ship models."
    expect(withinRammingContact(at(0, 0), at(9, 0), true).within).toBe(true)
  })

  it('needs a 6, by default', () => {
    expect(RAM_NERVE_TARGET).toBe(6)
    // Seed 9 opens with a 2.
    const result = resolveRam(attacker, target, new Rng(9))
    expect(result.outcome).toBe('lost-nerve')
    expect(result.nerveRoll).toBe(2)
    expect(result.damage).toBe(null)
  })

  it('lets the target evade on a tie', () => {
    // Seed 143 rolls 6, 3, 3: the nerve holds, the contest ties, the ram misses.
    const result = resolveRam(attacker, target, new Rng(143))
    expect(result.nerveRoll).toBe(6)
    expect(result.attackerTotal).toBe(7)
    expect(result.targetTotal).toBe(7)
    expect(result.outcome).toBe('evaded')
    expect(result.damage).toBe(null)
  })

  it('gives the attacker 15 of the 36 evasion pairs at equal thrust', () => {
    let contacts = 0
    for (let mine = 1; mine <= 6; mine++) {
      for (let theirs = 1; theirs <= 6; theirs++) {
        if (ramSucceeds(mine, theirs)) contacts++
      }
    }
    expect(contacts).toBe(15)
    expect(ramSucceeds(4, 4)).toBe(false)
    expect(ramSucceeds(5, 4)).toBe(true)
  })

  it('adds each ship’s own thrust to its die', () => {
    // Seed 143's 3 and 3 again, but the attacker is nimble and the target is a
    // cripple, so the same dice now make contact.
    const result = resolveRam(
      { ...attacker, thrust: 6 },
      { ...target, thrust: 0 },
      new Rng(143),
    )
    expect(result.attackerTotal).toBe(9)
    expect(result.targetTotal).toBe(3)
    expect(result.outcome).toBe('contact')
  })

  it('reproduces the corvette and the heavy cruiser', () => {
    // "The corvette player rolls a 4, which inflicts 8 points of damage on the
    // cruiser. The cruiser owner rolls a 3, thus doing 48 points to the
    // corvette." Seed 13 rolls 4 then 3.
    const damage = ramDamage(2, 16, new Rng(13))
    expect(damage.attackerRoll).toBe(4)
    expect(damage.targetRoll).toBe(3)
    expect(damage.damageToTarget).toBe(8)
    expect(damage.damageToAttacker).toBe(48)
  })

  it('multiplies by the roller’s own hull boxes and lands it on the other ship', () => {
    // Mass is nowhere in the formula: the corvette's 4 is worth 8 because the
    // corvette has 2 boxes left, not because the cruiser has 16.
    expect(ramDamage(2, 16, new Rng(13)).damageToTarget).toBe(4 * 2)
    expect(ramDamage(16, 2, new Rng(13)).damageToTarget).toBe(4 * 16)
  })

  it('reads both hull totals as they stood before contact', () => {
    // Applied in sequence the cruiser would be on 8 boxes and return 3 × 8 = 24.
    // The book says 48, so the exchange is simultaneous.
    const damage = ramDamage(2, 16, new Rng(13))
    expect(damage.damageToAttacker).toBe(48)
    expect(damage.damageToAttacker).not.toBe(24)
  })

  it('reports the damage rather than applying it, as ordinary damage [reading]', () => {
    const before = { ...attacker }
    const result = resolveRam({ ...attacker, thrust: 10 }, { ...target, thrust: 0 }, new Rng(119), {
      nerveTarget: 1,
    })
    expect(result.outcome).toBe('contact')
    expect(result.damage?.mode).toBe('standard')
    expect(attacker).toEqual(before)
  })

  it('rolls nothing when the ships are out of range [reading]', () => {
    // The die is only drawn when it can change something, so the RNG stream is
    // exactly where it started.
    const rng = new Rng(13)
    const result = resolveRam(attacker, { ...target, position: at(30, 0) }, rng)
    expect(result.outcome).toBe('out-of-range')
    expect(result.nerveRoll).toBe(null)
    expect(result.range).toBeCloseTo(30, 6)
    expect(d6(rng)).toBe(d6(new Rng(13)))
  })

  it('rolls no nerve die for a ship that rams automatically [reading]', () => {
    // "Any ship that can automatically attempt to ram" — the first die drawn is
    // the attacker's evasion, so seed 119's 6 is spent on the contest.
    const result = resolveRam({ ...attacker, thrust: 10 }, { ...target, thrust: 0 }, new Rng(119), {
      nerveTarget: 1,
    })
    expect(result.nerveRoll).toBe(null)
    expect(result.attackerEvasionRoll).toBe(6)
    expect(result.targetEvasionRoll).toBe(5)
  })

  it('honours a nerve roll the players have agreed down', () => {
    // Seed 119 opens with a 6, so lower the bar and it still passes; seed 9
    // opens with a 2, which a 2+ scenario would let through.
    expect(resolveRam(attacker, target, new Rng(9), { nerveTarget: 2 }).outcome).not.toBe(
      'lost-nerve',
    )
    expect(resolveRam(attacker, target, new Rng(9), { nerveTarget: 3 }).outcome).toBe('lost-nerve')
  })

  it('runs the four dice in a fixed order', () => {
    // Nerve, attacker's evasion, target's evasion, then both damage dice with
    // the attacker's first. Seed 119 is 6, 5, 2, 6, 3.
    const result = resolveRam(attacker, target, new Rng(119))
    expect(result.nerveRoll).toBe(6)
    expect(result.attackerEvasionRoll).toBe(5)
    expect(result.targetEvasionRoll).toBe(2)
    expect(result.outcome).toBe('contact')
    expect(result.damage?.attackerRoll).toBe(6)
    expect(result.damage?.targetRoll).toBe(3)
    expect(result.damage?.damageToTarget).toBe(12)
    expect(result.damage?.damageToAttacker).toBe(48)
  })

  it('prices an automatic rammer at its mass, as a floor', () => {
    // "An extra cost of at least +1 per mass of the ship."
    expect(automaticRamSurcharge(80)).toBe(80)
    expect(automaticRamSurcharge(0)).toBe(0)
  })
})
