import { describe, expect, it } from 'vitest'

import { Rng } from './dice'
import {
  CAPTURED_SHIP_DAMAGE_TO_DESTROY,
  CIVIL_WAR_DIRECT_FIRE_DRM,
  CORE_SYSTEM_STRIKE_DRM,
  FLEET_MORALE_WITHDRAWAL_FRACTION,
  MARINE_KILL_TARGET,
  MAX_DCPS_PER_TARGET,
  boardersAtRiskInThreshold,
  boardingContinues,
  boardingUnits,
  capturedShipDestroyed,
  civilWarDrm,
  dcpRepelTarget,
  fleetMorale,
  isCivilWar,
  nearestEnemyVessel,
  resolveBoardingCombat,
  strikeColorsCheck,
  strikeColorsTarget,
  validateBoardingPlan,
  type BoardedShip,
  type BoardingForce,
  type BoardingPlan,
} from './boarding'

/**
 * Sections 12.7 – 12.10, checked against their own prose.
 *
 * The rules worth guarding are the ones a reader half-remembers and gets
 * wrong: six DCPs throw two dice and not six, step 1 is *not* simultaneous
 * while step 2 is, a boarder that fought the Marines wrecks nothing even if it
 * wins, and "fails this roll" in 12.9 means rolling the threshold score rather
 * than missing it.
 */

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

/**
 * An `Rng` that hands out the faces it was given, in order. `d6` reads the
 * generator through `int(6)`, so a face `f` is the fraction `(f - 1) / 6`
 * nudged clear of the boundary.
 */
class ScriptedRng extends Rng {
  private readonly faces: number[]
  private index = 0

  constructor(faces: number[]) {
    super(1)
    this.faces = faces
  }

  override next(): number {
    const face = this.faces[this.index]
    if (face === undefined) throw new Error(`scripted RNG ran out of dice after ${this.index}`)
    this.index += 1
    return (face - 1) / 6 + 1e-9
  }

  get used(): number {
    return this.index
  }
}

function ship(over: Partial<BoardedShip> = {}): BoardedShip {
  return { side: 'udg', hullRemaining: 20, damageControlParties: 6, marines: 2, ...over }
}

function force(parties: number, over: Partial<BoardingForce> = {}): BoardingForce {
  return { side: 'ikv', parties, landedTurn: 1, ...over }
}

/** Unit ids are `boarder:<group>:<n>`, n counting from one. */
const u = (n: number, group = 0) => `boarder:${group}:${n}`

// ---------------------------------------------------------------------------
// The counters on the deck (12.7)
// ---------------------------------------------------------------------------

describe('the boarders aboard (12.7)', () => {
  it('flattens groups into individually targetable counters', () => {
    // "Each enemy Boarding Party or Marine must be targeted separately" (12.7),
    // so a group of four is four things to shoot at, not one.
    const units = boardingUnits([force(4)])
    expect(units).toHaveLength(4)
    expect(units.map((unit) => unit.id)).toEqual([u(1), u(2), u(3), u(4)])
  })

  it('does not treat the ship’s own parties as invaders', () => {
    const units = boardingUnits([force(2), force(3, { side: 'udg' })], { ownerSide: 'udg' })
    expect(units).toHaveLength(2)
    expect(units.every((unit) => unit.side === 'ikv')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// The defenders' tables (12.7)
// ---------------------------------------------------------------------------

describe('the crew’s damage control roll (12.7)', () => {
  it('is 6, then 5+, then 4+ as parties pool onto one boarder', () => {
    // "One DCP will kill … on a die roll of '6', two DCPs will kill it on a 5
    // or 6, and three DCPs will kill it on a 4+" (12.7).
    expect(dcpRepelTarget(1)).toBe(6)
    expect(dcpRepelTarget(2)).toBe(5)
    expect(dcpRepelTarget(3)).toBe(4)
  })

  it('stops improving after three, and never rolls for nobody', () => {
    expect(MAX_DCPS_PER_TARGET).toBe(3)
    expect(dcpRepelTarget(4)).toBe(dcpRepelTarget(3))
    expect(dcpRepelTarget(10)).toBe(4)
    // Seven on a d6: an unassigned boarder is not rolled for at all.
    expect(dcpRepelTarget(0)).toBe(7)
  })

  it('throws one die per target, not one per party', () => {
    // The book's own example: six DCPs, three on each of two boarders, and
    // "The player rolls a 2 and a 5" — two dice.
    const rng = new ScriptedRng([2, 5])
    const result = resolveBoardingCombat(
      ship({ marines: 0 }),
      [force(2)],
      { dcps: [{ targetId: u(1), parties: 3 }, { targetId: u(2), parties: 3 }] },
      rng,
    )
    expect(rng.used).toBe(2)
    expect(result.repelRolls).toHaveLength(2)
    expect(result.dcpsCommitted).toBe(6)
  })

  it('a single party needs the 6 that three parties do not', () => {
    const one = resolveBoardingCombat(
      ship({ marines: 0 }),
      [force(1)],
      { dcps: [{ targetId: u(1), parties: 1 }] },
      new ScriptedRng([5]),
    )
    const three = resolveBoardingCombat(
      ship({ marines: 0 }),
      [force(1)],
      { dcps: [{ targetId: u(1), parties: 3 }] },
      new ScriptedRng([5]),
    )
    expect(one.repelRolls[0].killed).toBe(false)
    expect(three.repelRolls[0].killed).toBe(true)
  })
})

describe('the Marines’ table (12.7)', () => {
  it('kills on a 4+ in both directions', () => {
    expect(MARINE_KILL_TARGET).toBe(4)
    // One defending Marine on one boarder: a 3 misses, a 4 kills.
    const miss = resolveBoardingCombat(
      ship(),
      [force(1)],
      { marines: [{ targetId: u(1), marines: 1 }] },
      new ScriptedRng([3]),
    )
    const kill = resolveBoardingCombat(
      ship(),
      [force(1)],
      { marines: [{ targetId: u(1), marines: 1 }] },
      new ScriptedRng([4]),
    )
    expect(miss.attackersKilled).toEqual([])
    expect(kill.attackersKilled).toEqual([u(1)])
  })

  it('cannot kill more defending Marines than are embarked', () => {
    // Three boarders all roll 6 against a ship carrying one Marine.
    const result = resolveBoardingCombat(
      ship({ marines: 1 }),
      [force(3)],
      { engageMarines: [u(1), u(2), u(3)] },
      new ScriptedRng([6, 6, 6]),
    )
    expect(result.defendingMarinesLost).toBe(1)
    expect(result.assaultRolls.map((roll) => roll.killedMarine)).toEqual([true, false, false])
  })
})

// ---------------------------------------------------------------------------
// The procedure and its sequencing (12.7)
// ---------------------------------------------------------------------------

describe('the phase 12 procedure (12.7)', () => {
  it('step 1 is not simultaneous: a boarder the DCPs kill never acts again', () => {
    // "Remove any enemy Boarding Party or Marine casualties" comes before
    // step 2, so this boarder throws no assault die and wrecks nothing.
    const rng = new ScriptedRng([6])
    const result = resolveBoardingCombat(
      ship({ marines: 0 }),
      [force(1)],
      { dcps: [{ targetId: u(1), parties: 1 }] },
      rng,
    )
    expect(result.attackersKilled).toEqual([u(1)])
    expect(result.hullDamage).toBe(0)
    expect(result.survivors).toEqual([])
    expect(rng.used).toBe(1)
  })

  it('a boarder the DCPs kill in step 1 never reaches the Marines it was sent for', () => {
    // The other half of "Remove any enemy Boarding Party or Marine casualties":
    // this boarder was allocated to the Marines in step 1 and dies before
    // step 2, so it throws no assault die and the Marines take no losses.
    const rng = new ScriptedRng([6])
    const result = resolveBoardingCombat(
      ship({ marines: 2 }),
      [force(1)],
      { engageMarines: [u(1)], dcps: [{ targetId: u(1), parties: 1 }] },
      rng,
    )
    expect(rng.used).toBe(1)
    expect(result.assaultRolls).toEqual([])
    expect(result.defendingMarinesLost).toBe(0)
  })

  it('step 2 is simultaneous: a boarder killed by Marines still kills one', () => {
    // "Combat and kills inflicted are simultaneous" (12.7). The defending
    // Marine rolls a 6 and the boarder rolls a 6; both die.
    const result = resolveBoardingCombat(
      ship({ marines: 1 }),
      [force(1)],
      { engageMarines: [u(1)], marines: [{ targetId: u(1), marines: 1 }] },
      new ScriptedRng([6, 6]),
    )
    expect(result.attackersKilled).toEqual([u(1)])
    expect(result.defendingMarinesLost).toBe(1)
    expect(result.hullDamage).toBe(0)
  })

  it('step 3 pays out on the step 1 allocation, not on who won step 2', () => {
    // "The other surviving Marine does not eliminate a box since it was
    // engaged against the ships defending Marines" (12.7's example) — even
    // though this ship has no Marines left to be engaged with.
    const result = resolveBoardingCombat(
      ship({ marines: 0 }),
      [force(2)],
      { engageMarines: [u(1)] },
      new ScriptedRng([1]),
    )
    expect(result.hullDamage).toBe(1)
    expect(result.survivors[0].parties).toBe(2)
  })

  it('boarders cannot touch the DCPs; the hull is the only way at the crew', () => {
    // "Attacking Boarding Parties or Marines cannot target and kill the ship's
    // DCPs; they can only kill the crew by destroying hull boxes" (12.7).
    // Four boarders throw themselves at a crew with no Marines aboard: the
    // dice are thrown and nothing at all happens to the defenders.
    const result = resolveBoardingCombat(
      ship({ marines: 0, damageControlParties: 6 }),
      [force(4)],
      { engageMarines: [u(1), u(2), u(3), u(4)] },
      new ScriptedRng([6, 6, 6, 6]),
    )
    expect(result.defendingMarinesLost).toBe(0)
    expect(result.hullDamage).toBe(0)
    expect(result.dcpsCommitted).toBe(0)
  })

  it('replays the book’s worked example die for die', () => {
    // 4 IKV Marines aboard the Wulkan (6 DCPs, 2 Marines). Two boarders go for
    // the Marines, two for the hull; 3 DCPs on each hull-attacker and one
    // Marine on each of the others. "The player rolls a 2 and a 5, killing one
    // Marine … The IKV Marines wipe out the Wulkans with only one loss …
    // The IKV Marine assigned to attacking hull boxes has survived, and now
    // destroys one hull box."
    const plan: BoardingPlan = {
      engageMarines: [u(3), u(4)],
      dcps: [
        { targetId: u(1), parties: 3 },
        { targetId: u(2), parties: 3 },
      ],
      marines: [
        { targetId: u(3), marines: 1 },
        { targetId: u(4), marines: 1 },
      ],
    }
    const rng = new ScriptedRng([
      2, 5, // step 1: the two DCP pools
      5, 1, // step 2: the Wulkan's two Marines
      6, 4, // step 2: the two IKV Marines who engaged them
    ])
    const result = resolveBoardingCombat(ship(), [force(4)], plan, rng)

    expect(rng.used).toBe(6)
    expect(result.repelRolls.map((roll) => roll.killed)).toEqual([false, true])
    expect(result.defendingMarinesLost).toBe(2)
    expect(result.attackersKilled).toEqual([u(2), u(3)])
    expect(result.hullDamage).toBe(1)
    expect(result.captured).toBe(false)
    expect(result.dcpsCommitted).toBe(6)
    expect(result.survivors).toEqual([{ side: 'ikv', parties: 2, landedTurn: 1 }])
  })

  it('wastes a defending Marine whose target the DCPs already killed [reading]', () => {
    // Allocation is made once, in step 1, and step 1 removes its casualties
    // first. No die is thrown for a Marine with nothing left to shoot at.
    const rng = new ScriptedRng([6])
    const result = resolveBoardingCombat(
      ship(),
      [force(1)],
      {
        dcps: [{ targetId: u(1), parties: 3 }],
        marines: [{ targetId: u(1), marines: 1 }],
      },
      rng,
    )
    expect(rng.used).toBe(1)
    expect(result.marineDefenceRolls[0]).toEqual({
      targetId: u(1),
      rolls: [],
      killed: false,
      wasted: true,
    })
  })

  it('reports the DCPs it spent, so phase 14 cannot spend them again', () => {
    // The Quick Reference Sheet's phase 14: "Damage Control assignments for DC
    // parties not used to repel boarders."
    const result = resolveBoardingCombat(
      ship({ damageControlParties: 4, marines: 0 }),
      [force(2)],
      { dcps: [{ targetId: u(1), parties: 3 }, { targetId: u(2), parties: 3 }] },
      new ScriptedRng([1, 1]),
    )
    // Only four parties exist, so only four go in — the second pool gets one.
    expect(result.dcpsCommitted).toBe(4)
    expect(result.repelRolls.map((roll) => roll.parties)).toEqual([3, 1])
    expect(result.repelRolls[1].needed).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// Capture (12.7)
// ---------------------------------------------------------------------------

describe('capture (12.7)', () => {
  it('is what "destroyed by Boarding Parties" means', () => {
    const result = resolveBoardingCombat(
      ship({ hullRemaining: 3, marines: 0 }),
      [force(5)],
      {},
      new ScriptedRng([]),
    )
    expect(result.hullDamage).toBe(5)
    expect(result.captured).toBe(true)
  })

  it('is decided on the last box exactly', () => {
    // Five boarders against five boxes: the ship is taken, not nearly taken.
    const exact = resolveBoardingCombat(
      ship({ hullRemaining: 5, marines: 0 }),
      [force(5)],
      {},
      new ScriptedRng([]),
    )
    expect(exact.hullDamage).toBe(5)
    expect(exact.captured).toBe(true)
  })

  it('needs the last box, not merely a lot of them', () => {
    const result = resolveBoardingCombat(
      ship({ hullRemaining: 6, marines: 0 }),
      [force(5)],
      {},
      new ScriptedRng([]),
    )
    expect(result.captured).toBe(false)
  })

  it('leaves a prize one point of damage from being scuttled', () => {
    // "A single point of damage is sufficient to destroy the captured ship."
    expect(CAPTURED_SHIP_DAMAGE_TO_DESTROY).toBe(1)
    expect(capturedShipDestroyed(1)).toBe(true)
    expect(capturedShipDestroyed(0)).toBe(false)
  })

  it('keeps the fight running until everyone is dead or the ship is taken', () => {
    // "If a ship jumps away into FTL with enemy boarders on board, the battle
    // for control of the ship continues" (12.7) — position is irrelevant.
    expect(boardingContinues('udg', [force(1)])).toBe(true)
    expect(boardingContinues('udg', [force(1)], true)).toBe(false)
    expect(boardingContinues('udg', [force(0)])).toBe(false)
    expect(boardingContinues('udg', [force(3, { side: 'udg' })])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Threshold interaction (12.7)
// ---------------------------------------------------------------------------

describe('boarders and threshold checks (12.7)', () => {
  it('are safe from a threshold test their own hull damage caused', () => {
    // "Marines and Boarding Parties cannot be killed in a threshold test
    // caused by boarding combat."
    expect(boardersAtRiskInThreshold(force(2, { landedTurn: 1 }), 'boarding', 5)).toBe(false)
  })

  it('are at risk from one caused by weapons fire', () => {
    expect(boardersAtRiskInThreshold(force(2, { landedTurn: 1 }), 'weapons', 2)).toBe(true)
  })

  it('are immune on the turn they landed, however hard the ship is shot', () => {
    // "they cannot be lost to threshold checks caused on the turn they boarded
    // the ship."
    expect(boardersAtRiskInThreshold(force(2, { landedTurn: 4 }), 'weapons', 4)).toBe(false)
    expect(boardersAtRiskInThreshold(force(2, { landedTurn: 3 }), 'weapons', 4)).toBe(true)
  })

  it('tags its own damage so the caller knows which kind of check follows', () => {
    const result = resolveBoardingCombat(ship({ marines: 0 }), [force(1)], {}, new ScriptedRng([]))
    expect(result.thresholdCause).toBe('boarding')
  })
})

// ---------------------------------------------------------------------------
// The plan (12.7 step 1)
// ---------------------------------------------------------------------------

describe('validating an allocation (12.7)', () => {
  const boarders = [force(2)]

  it('passes a legal plan silently', () => {
    expect(
      validateBoardingPlan(ship(), boarders, {
        engageMarines: [u(2)],
        dcps: [{ targetId: u(1), parties: 3 }],
        marines: [{ targetId: u(2), marines: 2 }],
      }),
    ).toEqual([])
  })

  it('refuses a fourth DCP on one boarder', () => {
    const problems = validateBoardingPlan(ship(), boarders, {
      dcps: [{ targetId: u(1), parties: 4 }],
    })
    expect(problems.join(' ')).toContain('at most 3 DCPs')
  })

  it('refuses parties and Marines the ship does not have', () => {
    const problems = validateBoardingPlan(ship({ damageControlParties: 2, marines: 1 }), boarders, {
      dcps: [{ targetId: u(1), parties: 3 }],
      marines: [{ targetId: u(2), marines: 2 }],
    })
    expect(problems).toHaveLength(2)
    expect(problems.join(' ')).toContain('only 2 are available')
    expect(problems.join(' ')).toContain('only 1 are embarked')
  })

  it('refuses an allocation against a boarder who is not aboard', () => {
    const problems = validateBoardingPlan(ship(), boarders, {
      dcps: [{ targetId: u(9), parties: 1 }],
    })
    expect(problems.join(' ')).toContain('no boarding party')
  })
})

// ---------------------------------------------------------------------------
// Purity and replay
// ---------------------------------------------------------------------------

describe('the module reports, it does not apply', () => {
  it('leaves everything it was handed untouched', () => {
    const boarders = [Object.freeze(force(3))]
    Object.freeze(boarders)
    const state = Object.freeze(ship())
    const plan = Object.freeze({ engageMarines: [u(1)] })
    const result = resolveBoardingCombat(state, boarders, plan, new Rng(11))
    expect(boarders[0].parties).toBe(3)
    expect(state.hullRemaining).toBe(20)
    // The hull damage is reported, not marked off.
    expect(result.hullDamage).toBeGreaterThan(0)
    expect(state.hullRemaining).toBe(20)
  })

  it('replays identically from the same seed', () => {
    const run = () =>
      resolveBoardingCombat(
        ship(),
        [force(4)],
        {
          engageMarines: [u(1), u(2)],
          dcps: [{ targetId: u(3), parties: 2 }],
          marines: [{ targetId: u(4), marines: 2 }],
        },
        new Rng(0x5c07),
      )
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })
})

// ---------------------------------------------------------------------------
// Fleet morale (12.8)
// ---------------------------------------------------------------------------

describe('fleet morale (12.8)', () => {
  it('breaks at exactly half the fleet’s mass', () => {
    // "the loss of 50% of a player's overall force (calculated in mass of
    // ships destroyed) would be enough" — enough, so half is the trigger.
    expect(FLEET_MORALE_WITHDRAWAL_FRACTION).toBe(0.5)
    const half = fleetMorale([
      { mass: 100, destroyed: true },
      { mass: 100, destroyed: false },
    ])
    expect(half.fraction).toBe(0.5)
    expect(half.withdraw).toBe(true)
  })

  it('holds just below it', () => {
    const report = fleetMorale([
      { mass: 49, destroyed: true },
      { mass: 51, destroyed: false },
    ])
    expect(report.withdraw).toBe(false)
  })

  it('counts mass, not hulls', () => {
    // Half the ships, nowhere near half the fleet: a screen of escorts is
    // cheap to lose and a battleship is not.
    const report = fleetMorale([
      { mass: 10, destroyed: true },
      { mass: 90, destroyed: false },
    ])
    expect(report.lostMass).toBe(10)
    expect(report.withdraw).toBe(false)
  })

  it('counts a captured hull as lost, and a withdrawal as not [reading]', () => {
    const captured = fleetMorale([
      { mass: 100, destroyed: false, captured: true },
      { mass: 100, destroyed: false },
    ])
    expect(captured.withdraw).toBe(true)
    expect(fleetMorale(
      [
        { mass: 100, destroyed: false, captured: true },
        { mass: 100, destroyed: false },
      ],
      { countCaptured: false },
    ).withdraw).toBe(false)

    const withdrawn = fleetMorale([
      { mass: 100, destroyed: false, offTable: true },
      { mass: 100, destroyed: false },
    ])
    expect(withdrawn.withdraw).toBe(false)
  })

  it('takes the scenario’s own level when one is written in', () => {
    // "the level of losses to force a withdrawal should be written into the
    // scenario when it is designed" (12.8).
    const report = fleetMorale([
      { mass: 30, destroyed: true },
      { mass: 70, destroyed: false },
    ], { fraction: 0.25 })
    expect(report.threshold).toBe(0.25)
    expect(report.withdraw).toBe(true)
  })

  it('does not break a fleet that does not exist', () => {
    const report = fleetMorale([])
    expect(report.fraction).toBe(0)
    expect(report.withdraw).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Striking the colors (12.9)
// ---------------------------------------------------------------------------

describe('striking the colors (12.9)', () => {
  it('uses the threshold ladder, restated by 12.9 itself', () => {
    // "6 the first time, 5 or 6 the second, etc."
    expect(strikeColorsTarget(1)).toBe(6)
    expect(strikeColorsTarget(2)).toBe(5)
    expect(strikeColorsTarget(3)).toBe(4)
    expect(strikeColorsTarget(5)).toBe(2)
    expect(strikeColorsTarget(6)).toBe(2)
    // No rows crossed, no roll that can reach it.
    expect(strikeColorsTarget(0)).toBe(7)
  })

  it('strikes on the score that would lose a system, not on missing it [reading]', () => {
    // The trap in "if the ship fails this roll": failing is rolling the 6.
    const struck = [1, 2, 3, 4, 5, 6].map(
      (face) => strikeColorsCheck({ rowsLost: 1 }, new ScriptedRng([face])).struck,
    )
    expect(struck).toEqual([false, false, false, false, false, true])
  })

  it('never surrenders on the first row under the Core System variant [reading]', () => {
    // "Players may prefer to roll as if for a Core System threshold check, in
    // which case ships will never surrender on the first row of damage."
    expect(CORE_SYSTEM_STRIKE_DRM).toBe(-1)
    for (const face of [1, 2, 3, 4, 5, 6]) {
      const result = strikeColorsCheck(
        { rowsLost: 1, mode: 'core-system' },
        new ScriptedRng([face]),
      )
      expect(result.struck).toBe(false)
    }
    // It is a −1, not a skipped row: the second row still surrenders on a 6.
    expect(
      strikeColorsCheck({ rowsLost: 2, mode: 'core-system' }, new ScriptedRng([6])).struck,
    ).toBe(true)
  })

  it('carries the extra rows of a multi-row hit onto the die', () => {
    // 4.11's "+1 per extra row", which 12.9 inherits with "the normal scores".
    expect(strikeColorsCheck({ rowsLost: 1 }, new ScriptedRng([5])).struck).toBe(false)
    expect(strikeColorsCheck({ rowsLost: 1, extraRows: 1 }, new ScriptedRng([5])).struck).toBe(true)
  })

  it('surrenders to the ship that was named as nearest', () => {
    const result = strikeColorsCheck({ rowsLost: 3, captorSide: 'ikv' }, new ScriptedRng([6]))
    expect(result.struck).toBe(true)
    expect(result.surrenderTo).toBe('ikv')
  })

  it('does not roll at all when the crew expects no quarter', () => {
    // "it is very unlikely that any human ship would even attempt to surrender
    // to a Kra'Vak or vice-versa" (12.9). No die is thrown, so no die is spent.
    const rng = new ScriptedRng([6])
    const result = strikeColorsCheck(
      { rowsLost: 5, captorSide: 'kravak', noQuarterWith: ['kravak'] },
      rng,
    )
    expect(result.rolled).toBeNull()
    expect(result.struck).toBe(false)
    expect(rng.used).toBe(0)
    expect(result.reason).toContain('kravak')
  })
})

describe('the nearest enemy vessel (12.9)', () => {
  const at = (x: number, side: string, id: string) => ({ id, side, position: { x, y: 0 } })

  it('is the nearest, and is an enemy', () => {
    const found = nearestEnemyVessel({ x: 0, y: 0 }, 'udg', [
      at(2, 'udg', 'friend'),
      at(9, 'ikv', 'far'),
      at(4, 'ikv', 'near'),
    ])
    expect(found?.id).toBe('near')
    expect(found?.distance).toBe(4)
  })

  it('breaks a tie by the caller’s order, never by a die', () => {
    const found = nearestEnemyVessel({ x: 0, y: 0 }, 'udg', [at(5, 'ikv', 'a'), at(5, 'ikv', 'b')])
    expect(found?.id).toBe('a')
  })

  it('has nobody to surrender to when the enemy has left', () => {
    expect(nearestEnemyVessel({ x: 0, y: 0 }, 'udg', [at(1, 'udg', 'friend')])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Civil wars (12.10)
// ---------------------------------------------------------------------------

describe('civil wars (12.10)', () => {
  it('needs both fleets to be one navy’s ships [reading]', () => {
    expect(isCivilWar(['nac', 'nac'], ['nac'])).toBe(true)
    expect(isCivilWar(['nac'], ['nsl'])).toBe(false)
    // One mercenary hull and the rule is off for everyone.
    expect(isCivilWar(['nac', 'nsl'], ['nac'])).toBe(false)
    expect(isCivilWar([], ['nac'])).toBe(false)
  })

  it('is +1 on direct fire, and on nothing else [reading]', () => {
    expect(CIVIL_WAR_DIRECT_FIRE_DRM).toBe(1)
    expect(civilWarDrm(true, 'direct-fire')).toBe(1)
    expect(civilWarDrm(true, 'ordnance')).toBe(0)
    expect(civilWarDrm(true, 'point-defence')).toBe(0)
    expect(civilWarDrm(true, 'fighter')).toBe(0)
    expect(civilWarDrm(false, 'direct-fire')).toBe(0)
  })
})
