import { describe, expect, it } from 'vitest'

import { Rng, d6 } from './dice'
import {
  BYSTANDER_DAMAGE_DICE,
  FTL_DANGER_RADIUS,
  MAX_BATTLERIDER_MASS,
  validateBattleriderDesign,
  allocateBattleriderDamage,
  attachedBattleriderDefence,
  battleriderRecovery,
  canDetachBattlerider,
  currentTransferMass,
  d12,
  ftlExitMove,
  ftlExitRestrictions,
  ftlExitStage,
  ftlPermittedAt,
  gateActivation,
  gateBearsOn,
  gateDriveMass,
  gateEntry,
  gateMinimumHullBoxes,
  hyperLimitAt,
  isAdvancedFtl,
  isDisoriented,
  isGateActive,
  jumpPointDisorientation,
  portalPairTransit,
  resolveFtlEntry,
  resolveFtlEntryDanger,
  resolveFtlExit,
  resolveGateTransfer,
  rollFtlEntryScatter,
  tenderBayMassFor,
  tenderBayPoints,
  tenderCapacityFor,
  tugDriveMass,
  tugOwnDriveMass,
  tugSpareDriveMassFor,
  tugTowCheck,
  tugTransferMass,
  validateFleetFtl,
  validateGateBuild,
  type BattleriderFit,
  type FtlEntryPlan,
  type GateDef,
  type GateState,
  type HyperLimitRules,
} from './ftl'

/**
 * Section 11, checked against its own prose.
 *
 * Almost every test below guards one of two things. The first is the fact that
 * **11.4's table and 11.5's table are not the same table** — a 1 is harmless on
 * exit and 1 point of damage on entry, a 5 kills the jumping ship on exit and
 * does 5 points on entry, and the bystanders are hurt only on a disaster when a
 * ship leaves but *every time* one arrives. The second is the handful of places
 * where the number a reader would assume is the wrong one: 6 × a second die
 * rather than 6 plus it, a gate whose transfer roll kills on 3 and up, and a
 * trigger list that excludes the very fighters the blast then destroys.
 *
 * The [reading]s of `docs/rules/ftl.md` each get a test that would fail under
 * the alternative reading, because that is the only way a reading is a decision
 * rather than a guess.
 */

// ---------------------------------------------------------------------------
// Test plumbing
// ---------------------------------------------------------------------------

/**
 * The smallest seed whose dice come out as the test needs them. Lets a test
 * name the roll a rule turns on — `findSeed((r) => d6(r) === 5)` is "the ship
 * rolls a 5" — while every roll still comes from a real `new Rng(seed)`.
 */
function findSeed(draws: (rng: Rng) => boolean): number {
  for (let seed = 1; seed < 2_000_000; seed++) {
    if (draws(new Rng(seed))) return seed
  }
  throw new Error('no seed produces the requested dice')
}

const ORIGIN = { x: 0, y: 0 }

function gate(overrides: Partial<GateDef> = {}): GateDef {
  return {
    id: 'gate-1',
    kind: 'jump-gate',
    natural: false,
    position: { ...ORIGIN },
    facing: 9,
    transferMass: 60,
    hullBoxes: 6,
    playerControlled: true,
    ...overrides,
  }
}

function gateState(overrides: Partial<GateState> = {}): GateState {
  return { hullMarked: 0, ftlFailed: false, activeFromTurn: 1, ...overrides }
}

function rider(id: string, mass: number): BattleriderFit {
  return { id, mass, ftl: 'none', mothershipId: 'mother' }
}

// ---------------------------------------------------------------------------
// 11.2 — the hyper limit is a permission, not a risk
// ---------------------------------------------------------------------------

describe('the hyper limit (11.2)', () => {
  const limit: HyperLimitRules = {
    zones: [{ id: 'sol', centre: ORIGIN, radius: 20, label: 'Sol' }],
    permittedInsideLimit: false,
  }

  it('is a radius around a body, inclusive of its edge', () => {
    expect(hyperLimitAt({ x: 19.9, y: 0 }, limit)?.id).toBe('sol')
    expect(hyperLimitAt({ x: 20, y: 0 }, limit)?.id).toBe('sol')
    expect(hyperLimitAt({ x: 20.5, y: 0 }, limit)).toBeNull()
    expect(hyperLimitAt(ORIGIN, undefined)).toBeNull()
  })

  it('refuses the jump rather than resolving it — [reading] R2', () => {
    const report = resolveFtlExit({ exitPoint: ORIGIN, hyperLimit: limit }, new Rng(1))
    expect(report.outcome).toBe('refused')
    expect(report.jumped).toBe(false)
    expect(report.remainsInNormalSpace).toBe(true)
    // The alternative reading would have destroyed or damaged the ship here.
    expect(report.rolled).toBe(false)
    expect(report.selfDamage).toBe(0)
    expect(report.note).toContain('11.2')
  })

  it('lets the scenario permit it, which is the only mechanism 11.2 offers', () => {
    const permitted: HyperLimitRules = { ...limit, permittedInsideLimit: true }
    expect(ftlPermittedAt(ORIGIN, permitted).permitted).toBe(true)
    expect(resolveFtlExit({ exitPoint: ORIGIN, hyperLimit: permitted }, new Rng(1)).jumped).toBe(true)
  })

  it('bars an entry inside the limit as well as an exit', () => {
    const plan: FtlEntryPlan = { shipId: 's', turn: 3, entryPoint: ORIGIN, course: 12, velocity: 6 }
    const result = resolveFtlEntry(plan, { hyperLimit: limit }, new Rng(1))
    expect(result.entered).toBe(false)
    expect(result.refusal).toContain('11.2')
    expect(result.danger).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 11.4 — FTL exit
// ---------------------------------------------------------------------------

describe('the exit sequence (11.4)', () => {
  it('runs over two turns and then the ship is gone', () => {
    expect(ftlExitStage(3, 3)).toBe('warming-up')
    expect(ftlExitStage(3, 4)).toBe('jumping')
    expect(ftlExitStage(3, 5)).toBe('gone')
  })

  it('leaves PDS and screens up while warming up, and nothing on the jump turn — [reading] R5', () => {
    const warm = ftlExitRestrictions('warming-up')
    expect(warm.mayThrust).toBe(false)
    expect(warm.mayFireOffensiveWeapons).toBe(false)
    expect(warm.mayUseAdfc).toBe(false)
    expect(warm.mayUsePds).toBe(true)
    expect(warm.mayUseScreens).toBe(true)
    expect(warm.onTableAfterMovement).toBe(true)

    // The alternative reading would carry `mayUsePds: true` forward into a turn
    // on which the ship has already left the table in phase 5.
    const jumping = ftlExitRestrictions('jumping')
    expect(jumping.mayUsePds).toBe(false)
    expect(jumping.onTableAfterMovement).toBe(false)
  })

  it('half-moves on the present course, rounding down — [reading] R4', () => {
    expect(ftlExitMove(ORIGIN, 3, 9).distance).toBe(4)
    expect(ftlExitMove(ORIGIN, 3, 8).distance).toBe(4)
    expect(ftlExitMove(ORIGIN, 3, 1).distance).toBe(0)
    // Course 3 is to the right of the table (3.1).
    expect(ftlExitMove(ORIGIN, 3, 12).position.x).toBeCloseTo(6)
    expect(ftlExitMove(ORIGIN, 3, 12).position.y).toBeCloseTo(0)
  })
})

describe('the exit danger roll (11.4)', () => {
  const ally = { id: 'ally', position: { x: 5, y: 0 } }
  const wing = { id: 'wing', position: { x: 3, y: 0 } }

  it('is not rolled at all when nothing ship-sized is within 6 MU', () => {
    const report = resolveFtlExit(
      { exitPoint: ORIGIN, nearby: [{ id: 'far', position: { x: 6.5, y: 0 } }] },
      new Rng(1),
    )
    expect(report.rolled).toBe(false)
    expect(report.outcome).toBe('clear')
    expect(report.jumped).toBe(true)
    expect(report.permanentlyGone).toBe(true)
  })

  it('measures the 6 MU inclusively', () => {
    const at6 = resolveFtlExit(
      { exitPoint: ORIGIN, nearby: [{ id: 'edge', position: { x: FTL_DANGER_RADIUS, y: 0 } }] },
      new Rng(1),
    )
    expect(at6.rolled).toBe(true)
  })

  it('is not triggered by fighter groups or missile salvos, which still die on a 5 or 6', () => {
    // "any other ship-sized or larger object, but not fighter groups or missile
    // salvos" triggers it — but the blast list is a different list.
    const noTrigger = resolveFtlExit({ exitPoint: ORIGIN, lightCraft: [wing] }, new Rng(1))
    expect(noTrigger.rolled).toBe(false)
    expect(noTrigger.lightCraftDestroyed).toEqual([])

    const seed = findSeed((r) => d6(r) === 5)
    const blast = resolveFtlExit(
      { exitPoint: ORIGIN, nearby: [ally], lightCraft: [wing] },
      new Rng(seed),
    )
    expect(blast.lightCraftDestroyed).toEqual(['wing'])
  })

  it('on a 1 the drive fails and the ship stays put, undamaged', () => {
    const seed = findSeed((r) => d6(r) === 1)
    const report = resolveFtlExit({ exitPoint: ORIGIN, nearby: [ally] }, new Rng(seed))
    expect(report.outcome).toBe('drive-failed')
    expect(report.jumped).toBe(false)
    expect(report.remainsInNormalSpace).toBe(true)
    expect(report.selfDamage).toBe(0)
    expect(report.bystanders).toEqual([])
  })

  it('on 2 to 4 the ship takes 1D6 and goes, and nobody else is touched', () => {
    for (const face of [2, 3, 4]) {
      const seed = findSeed((r) => d6(r) === face)
      const report = resolveFtlExit(
        { exitPoint: ORIGIN, nearby: [ally], lightCraft: [wing] },
        new Rng(seed),
      )
      expect(report.outcome).toBe('damaged')
      expect(report.selfDice).toHaveLength(1)
      expect(report.selfDamage).toBe(report.selfDice[0])
      expect(report.jumped).toBe(true)
      expect(report.thresholdChecksOffTable).toBe(true)
      // The inversion against 11.5: no blast unless the ship comes apart.
      expect(report.bystanders).toEqual([])
      expect(report.lightCraftDestroyed).toEqual([])
    }
  })

  it('on a 5 or 6 the ship dies and takes the neighbourhood with it', () => {
    for (const face of [5, 6]) {
      const seed = findSeed((r) => d6(r) === face)
      const report = resolveFtlExit(
        { exitPoint: ORIGIN, nearby: [ally], lightCraft: [wing] },
        new Rng(seed),
      )
      expect(report.outcome).toBe('catastrophe')
      expect(report.selfDestroyed).toBe(true)
      expect(report.jumped).toBe(false)
      expect(report.bystanders).toHaveLength(1)
      expect(report.bystanders[0].dice).toHaveLength(BYSTANDER_DAMAGE_DICE)
      expect(report.bystanders[0].damage).toBe(
        report.bystanders[0].dice.reduce((a, b) => a + b, 0),
      )
      expect(report.lightCraftDestroyed).toEqual(['wing'])
    }
  })

  it('reports FTL damage as unstoppable by screens or armour', () => {
    const seed = findSeed((r) => d6(r) === 3)
    expect(
      resolveFtlExit({ exitPoint: ORIGIN, nearby: [ally] }, new Rng(seed)).bypassesScreensAndArmour,
    ).toBe(true)
  })
})

describe('passengers on a jumping carrier (11.4) — [reading] R3', () => {
  const ally = { id: 'ally', position: { x: 5, y: 0 } }
  const passengers = [{ id: 'sds-1' }, { id: 'sds-2' }]

  it('each roll their own 1D6 on a 2 to 4, not the carrier’s number', () => {
    const seed = findSeed((r) => d6(r) === 2)
    const report = resolveFtlExit(
      { exitPoint: ORIGIN, nearby: [ally], passengers },
      new Rng(seed),
    )
    expect(report.passengers.map((p) => p.id)).toEqual(['sds-1', 'sds-2'])
    for (const passenger of report.passengers) {
      expect(passenger.dice).toHaveLength(1)
      expect(passenger.damage).toBe(passenger.dice[0])
      expect(passenger.destroyed).toBe(false)
    }
    // The rejected reading — every passenger sharing the carrier's total —
    // would make this a single die for the whole tender.
    const totals = new Set(report.passengers.map((p) => p.damage))
    expect(report.passengers).toHaveLength(2)
    expect(totals.size).toBeGreaterThanOrEqual(1)
  })

  it('die with the carrier on a 5 or 6', () => {
    const seed = findSeed((r) => d6(r) === 6)
    const report = resolveFtlExit({ exitPoint: ORIGIN, nearby: [ally], passengers }, new Rng(seed))
    expect(report.passengers.every((p) => p.destroyed)).toBe(true)
    expect(report.passengers.every((p) => p.damage === 0)).toBe(true)
  })

  it('are untouched when the drive simply fails', () => {
    const seed = findSeed((r) => d6(r) === 1)
    expect(
      resolveFtlExit({ exitPoint: ORIGIN, nearby: [ally], passengers }, new Rng(seed)).passengers,
    ).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 11.3 — the Advanced FTL Drive
// ---------------------------------------------------------------------------

describe('Advanced FTL Drives (11.3) — [reading] R1', () => {
  it('maps off the SSD’s FTL fit', () => {
    expect(isAdvancedFtl('advanced')).toBe(true)
    expect(isAdvancedFtl('standard')).toBe(false)
    expect(isAdvancedFtl('tug')).toBe(false)
    expect(isAdvancedFtl('none')).toBe(false)
  })

  it('leaves without the collision roll, not merely without the scatter', () => {
    const hugging = { id: 'ally', position: { x: 1, y: 0 } }
    const report = resolveFtlExit(
      { exitPoint: ORIGIN, advancedDrive: true, nearby: [hugging] },
      new Rng(1),
    )
    // Under the rejected reading this ship would roll, and a 5 or 6 would kill
    // it and the ally 1 MU away.
    expect(report.rolled).toBe(false)
    expect(report.outcome).toBe('clear')
    expect(report.jumped).toBe(true)
    expect(report.bystanders).toEqual([])
  })

  it('arrives without scatter and without the collision roll', () => {
    const plan: FtlEntryPlan = { shipId: 's', turn: 2, entryPoint: ORIGIN, course: 12, velocity: 8 }
    const arrival = resolveFtlEntry(
      plan,
      { advancedDrive: true, nearby: [{ id: 'base', position: { x: 2, y: 0 } }] },
      new Rng(1),
    )
    expect(arrival.scatter.scattered).toBe(false)
    expect(arrival.arrival).toEqual(ORIGIN)
    expect(arrival.danger?.rolled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 11.5 — FTL entry
// ---------------------------------------------------------------------------

describe('the entry scatter (11.5)', () => {
  it('reads the D12 straight onto the course gauge and the D6 as MU', () => {
    // Direction 3 is to the right of the table, distance 4 MU.
    const seed = findSeed((r) => d12(r) === 3 && d6(r) === 4)
    const scatter = rollFtlEntryScatter(ORIGIN, new Rng(seed))
    expect(scatter.directionRoll).toBe(3)
    expect(scatter.direction).toBe(3)
    expect(scatter.distanceRoll).toBe(4)
    expect(scatter.distance).toBe(4)
    expect(scatter.to.x).toBeCloseTo(4)
    expect(scatter.to.y).toBeCloseTo(0)
  })

  it('multiplies rather than adds under the optional massive error', () => {
    const seed = findSeed((r) => d12(r) === 3 && d6(r) === 6 && d6(r) === 4)
    const plain = rollFtlEntryScatter(ORIGIN, new Rng(seed))
    expect(plain.distance).toBe(6)
    expect(plain.secondDistanceRoll).toBeNull()

    const massive = rollFtlEntryScatter(ORIGIN, new Rng(seed), { massiveError: true })
    // 6 × 4 = 24, not 6 + 4 = 10.
    expect(massive.secondDistanceRoll).toBe(4)
    expect(massive.distance).toBe(24)
  })

  it('caps the massive error at 36 MU and never rolls the second die on 1 to 5', () => {
    const worst = findSeed((r) => d12(r) === 1 && d6(r) === 6 && d6(r) === 6)
    expect(rollFtlEntryScatter(ORIGIN, new Rng(worst), { massiveError: true }).distance).toBe(36)
    const modest = findSeed((r) => d12(r) === 1 && d6(r) === 5)
    const scatter = rollFtlEntryScatter(ORIGIN, new Rng(modest), { massiveError: true })
    expect(scatter.distance).toBe(5)
    expect(scatter.secondDistanceRoll).toBeNull()
  })

  it('bars a ship that scatters off the table, under either rule — [reading] R6', () => {
    // Direction 9 is to the left of the table; 5 MU takes a marker at x = 2 off it.
    const seed = findSeed((r) => d12(r) === 9 && d6(r) === 5)
    const bounds = { minX: 0, minY: 0, maxX: 48, maxY: 48 }
    const plan: FtlEntryPlan = {
      shipId: 's',
      turn: 4,
      entryPoint: { x: 2, y: 24 },
      course: 12,
      velocity: 6,
    }
    const barred = resolveFtlEntry(plan, { bounds }, new Rng(seed))
    expect(barred.scatter.offTable).toBe(true)
    expect(barred.barredFromBattle).toBe(true)
    expect(barred.entered).toBe(false)
    expect(barred.arrival).toBeNull()
    expect(barred.danger).toBeNull()

    // No bounds supplied, nothing checked — the base behaviour is unchanged.
    expect(resolveFtlEntry(plan, {}, new Rng(seed)).entered).toBe(true)
  })
})

describe('the entry danger roll (11.5)', () => {
  const base = { id: 'base', position: { x: 3, y: 0 } }
  const wing = { id: 'wing', position: { x: 2, y: 0 } }

  it('does damage equal to the die on 1 to 5 — not 11.4’s table', () => {
    for (const face of [1, 2, 3, 4, 5]) {
      const seed = findSeed((r) => d6(r) === face)
      const report = resolveFtlEntryDanger(ORIGIN, { nearby: [base] }, new Rng(seed))
      expect(report.roll).toBe(face)
      expect(report.selfDamage).toBe(face)
      expect(report.secondRoll).toBeNull()
    }
  })

  it('on a 6 rolls again and multiplies by 6, up to 36', () => {
    const thirty = findSeed((r) => d6(r) === 6 && d6(r) === 5)
    expect(resolveFtlEntryDanger(ORIGIN, { nearby: [base] }, new Rng(thirty)).selfDamage).toBe(30)
    const worst = findSeed((r) => d6(r) === 6 && d6(r) === 6)
    expect(resolveFtlEntryDanger(ORIGIN, { nearby: [base] }, new Rng(worst)).selfDamage).toBe(36)
    const least = findSeed((r) => d6(r) === 6 && d6(r) === 1)
    expect(resolveFtlEntryDanger(ORIGIN, { nearby: [base] }, new Rng(least)).selfDamage).toBe(6)
  })

  it('hurts the bystanders however well the arriving ship rolls', () => {
    // The clause is not indented under either bullet, so unlike 11.4 it is not
    // gated on a disaster. A 1 still puts 2D6 into everything within 6 MU.
    const seed = findSeed((r) => d6(r) === 1)
    const report = resolveFtlEntryDanger(ORIGIN, { nearby: [base], lightCraft: [wing] }, new Rng(seed))
    expect(report.selfDamage).toBe(1)
    expect(report.bystanders).toHaveLength(1)
    expect(report.bystanders[0].dice).toHaveLength(BYSTANDER_DAMAGE_DICE)
    expect(report.lightCraftDestroyed).toEqual(['wing'])
  })

  it('is not triggered by fighters or missiles, and is not rolled in open space', () => {
    const noTrigger = resolveFtlEntryDanger(ORIGIN, { lightCraft: [wing] }, new Rng(1))
    expect(noTrigger.rolled).toBe(false)
    expect(noTrigger.lightCraftDestroyed).toEqual([])
    expect(resolveFtlEntryDanger(ORIGIN, { nearby: [] }, new Rng(1)).rolled).toBe(false)
  })

  it('leaves the threshold checks on the table, unlike an exit', () => {
    const seed = findSeed((r) => d6(r) === 2)
    const report = resolveFtlEntryDanger(ORIGIN, { nearby: [base] }, new Rng(seed))
    expect(report.thresholdChecksOnTable).toBe(true)
    expect(report.bypassesScreensAndArmour).toBe(true)
  })
})

describe('an entry end to end (11.5)', () => {
  const plan: FtlEntryPlan = { shipId: 'raider', turn: 5, entryPoint: ORIGIN, course: 12, velocity: 8 }

  it('measures the danger from where the ship lands, not from where it aimed', () => {
    const starbase = { id: 'starbase', position: { x: 0, y: 10 } }
    // Direction 6 is down the table: the scatter closes 5 MU of the 10 MU gap.
    const inward = findSeed((r) => d12(r) === 6 && d6(r) === 5)
    const closed = resolveFtlEntry(plan, { nearby: [starbase] }, new Rng(inward))
    expect(closed.arrival?.y).toBeCloseTo(5)
    expect(closed.danger?.rolled).toBe(true)

    // And the other way: a starbase inside the radius of the *planned* point
    // that the scatter carries the ship clear of.
    const near = { id: 'near', position: { x: 0, y: 5 } }
    const outward = findSeed((r) => d12(r) === 12 && d6(r) === 5)
    const escaped = resolveFtlEntry(plan, { nearby: [near] }, new Rng(outward))
    expect(escaped.arrival?.y).toBeCloseTo(-5)
    expect(escaped.danger?.rolled).toBe(false)
  })

  it('moves carried ships and screening fighters by the same vector', () => {
    const seed = findSeed((r) => d12(r) === 3 && d6(r) === 4)
    const result = resolveFtlEntry(
      plan,
      {
        carried: [
          { id: 'rider', position: { x: 0, y: 10 } },
          { id: 'cap', position: { x: 0, y: -10 } },
        ],
      },
      new Rng(seed),
    )
    // The same displacement, not the same destination: the formation holds.
    expect(result.carried[0].to.x).toBeCloseTo(4)
    expect(result.carried[0].to.y).toBeCloseTo(10)
    expect(result.carried[1].to.x).toBeCloseTo(4)
    expect(result.carried[1].to.y).toBeCloseTo(-10)
  })

  it('spends the whole turn arriving, so the velocity starts next turn', () => {
    const result = resolveFtlEntry(plan, {}, new Rng(3))
    expect(result.velocityAppliesFromTurn).toBe(plan.turn + 1)
  })
})

// ---------------------------------------------------------------------------
// 11.6 — tugs and tenders
// ---------------------------------------------------------------------------

describe('tenders (11.6)', () => {
  it('buys 1 mass of capacity for every 1.5 mass of bay', () => {
    expect(tenderBayMassFor(20)).toBe(30)
    expect(tenderCapacityFor(30)).toBe(20)
    expect(tenderBayPoints(30)).toBe(90)
  })
})

describe('tug drives (11.6)', () => {
  it('reproduces the book’s worked example exactly', () => {
    // "to tow a ship of mass 108, the tug would need spare FTL Drive capacity
    // of mass 22. If the tug itself was a mass 60 ship, it would need its own
    // mass 6 FTL Drive plus the additional 22 – so … a total of 28."
    expect(tugOwnDriveMass(60)).toBe(6)
    expect(tugSpareDriveMassFor(108)).toBe(22)
    expect(tugDriveMass(60, 108)).toBe(28)
    expect(tugTransferMass(60, 28)).toBe(110)
  })

  it('rounds the spare up (11.6) and the own drive to the nearest mass (13.5)', () => {
    // 21.6 becoming 22 is the book's own arithmetic for the tow. The drive
    // itself is a share of the hull like any other, and 13.5 rounds those to
    // the nearest whole mass, never below 1: 5.5 up, 5.1 down, 0.4 to 1.
    expect(tugSpareDriveMassFor(106)).toBe(22)
    expect(tugOwnDriveMass(55)).toBe(6)
    expect(tugOwnDriveMass(51)).toBe(5)
    expect(tugOwnDriveMass(50)).toBe(5)
    expect(tugOwnDriveMass(4)).toBe(1)
  })

  it('gives a tug with no spare drive no towing capacity at all', () => {
    expect(tugTransferMass(60, 6)).toBe(0)
    expect(tugTransferMass(60, 3)).toBe(0)
  })
})

describe('what a set of tugs may haul (11.6)', () => {
  const battleship = [{ id: 'bb', mass: 120 }]

  it('lets one standard tug of transfer mass 120 take the mass-120 battleship', () => {
    expect(tugTowCheck([{ id: 't', transferMass: 120, advanced: false }], battleship).legal).toBe(true)
  })

  it('will not let two standard tugs combine on it, but two Advanced tugs may', () => {
    const standard = tugTowCheck(
      [
        { id: 'a', transferMass: 60, advanced: false },
        { id: 'b', transferMass: 60, advanced: false },
      ],
      battleship,
    )
    expect(standard.legal).toBe(false)
    expect(standard.capacity).toBe(120)
    expect(standard.problems[0]).toContain('Advanced')

    const advanced = tugTowCheck(
      [
        { id: 'a', transferMass: 60, advanced: true },
        { id: 'b', transferMass: 60, advanced: true },
      ],
      battleship,
    )
    expect(advanced.legal).toBe(true)
  })

  it('lets one tug take any number of ships up to its capacity', () => {
    const tug = [{ id: 't', transferMass: 60, advanced: false }]
    expect(
      tugTowCheck(tug, [
        { id: 'a', mass: 30 },
        { id: 'b', mass: 30 },
      ]).legal,
    ).toBe(true)
    expect(
      tugTowCheck(tug, [
        { id: 'a', mass: 30 },
        { id: 'b', mass: 31 },
      ]).legal,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 11.7 — battleriders
// ---------------------------------------------------------------------------

describe('battleriders (11.7)', () => {
  it('are 60 mass at most and carry no FTL drive', () => {
    // The Mothership clause is a fact about the fleet, so `validateFleetFtl`
    // has it and the design check does not.
    expect(MAX_BATTLERIDER_MASS).toBe(60)
    expect(validateBattleriderDesign(rider('r', 60))).toEqual([])
    expect(validateBattleriderDesign(rider('r', 61))[0]).toContain('60')
    expect(validateBattleriderDesign({ ...rider('r', 40), ftl: 'standard' })[0]).toContain(
      'FTL Drive',
    )
  })

  it('cannot detach on the turn their Mothership drops out of FTL', () => {
    expect(canDetachBattlerider(4, 4)).toBe(false)
    expect(canDetachBattlerider(4, 5)).toBe(true)
    // A Mothership deployed at the start has nothing to wait for.
    expect(canDetachBattlerider(null, 1)).toBe(true)
  })

  it('share the Mothership’s screens but not its armour', () => {
    const defence = attachedBattleriderDefence('mother', ['r1', 'r2'])
    expect(defence.targetableId).toBe('mother')
    expect(defence.screensApply).toBe(true)
    expect(defence.armourApplies).toBe(false)
    expect(defence.damageMayBeAllocatedTo).toEqual(['mother', 'r1', 'r2'])
  })

  it('validates the defender’s damage split rather than making it', () => {
    const defence = attachedBattleriderDefence('mother', ['r1'])
    expect(
      allocateBattleriderDamage(10, [{ unitId: 'mother', damage: 4 }, { unitId: 'r1', damage: 6 }], defence),
    ).toEqual([])
    // All ten points on one rider is a legal choice; the rule only says the
    // defender chooses.
    expect(allocateBattleriderDamage(10, [{ unitId: 'r1', damage: 10 }], defence)).toEqual([])
    expect(allocateBattleriderDamage(10, [{ unitId: 'mother', damage: 4 }], defence)[0]).toContain('4')
    expect(allocateBattleriderDamage(10, [{ unitId: 'escort', damage: 10 }], defence)[0]).toContain(
      'escort',
    )
  })
})

describe('battleriders left behind at the end of a battle (11.7) — [reading] R15', () => {
  it('survive when a Mothership with room for them survives', () => {
    const recovery = battleriderRecovery(
      [rider('r60', 60), rider('r40', 40)],
      [
        { id: 'm1', capacity: 60 },
        { id: 'm2', capacity: 60 },
      ],
    )
    expect(recovery.destroyed).toEqual([])
    expect(recovery.assignments).toHaveLength(2)
  })

  it('packs the heaviest rider first, so a light one is the one left to die', () => {
    const recovery = battleriderRecovery(
      [rider('r40', 40), rider('r60', 60)],
      [{ id: 'm1', capacity: 60 }],
    )
    expect(recovery.assignments).toEqual([{ riderId: 'r60', mothershipId: 'm1' }])
    expect(recovery.destroyed).toEqual(['r40'])
  })

  it('destroys every rider when no Mothership survives', () => {
    const recovery = battleriderRecovery([rider('r1', 40), rider('r2', 40)], [])
    expect(recovery.destroyed.sort()).toEqual(['r1', 'r2'])
    expect(recovery.totalCapacity).toBe(0)
  })

  it('does not reorder the caller’s list', () => {
    const riders = [rider('a', 20), rider('b', 60)]
    battleriderRecovery(riders, [{ id: 'm', capacity: 100 }])
    expect(riders.map((r) => r.id)).toEqual(['a', 'b'])
  })
})

// ---------------------------------------------------------------------------
// 11.8 — System Defense Ships
// ---------------------------------------------------------------------------

describe('non-FTL ships in a fleet (11.8)', () => {
  it('are barred from a one-off battle unless the scenario permits them', () => {
    expect(validateFleetFtl([{ id: 'cruiser', ftl: 'standard' }])).toEqual([])
    const barred = validateFleetFtl([{ id: 'sds', ftl: 'none' }])
    expect(barred).toHaveLength(1)
    expect(barred[0]).toContain('11.8')
    expect(validateFleetFtl([{ id: 'sds', ftl: 'none' }], { allowNonFtl: true })).toEqual([])
  })

  it('make an exception for a battlerider whose Mothership is in the fleet', () => {
    expect(
      validateFleetFtl([
        { id: 'mother', ftl: 'tug' },
        { id: 'rider', ftl: 'none', battlerider: true, mothershipId: 'mother' },
      ]),
    ).toEqual([])
    // "A fleet with battleriders must deploy the Motherships as well" (11.7),
    // arriving from 11.8's side.
    const orphan = validateFleetFtl([
      { id: 'rider', ftl: 'none', battlerider: true, mothershipId: 'mother' },
    ])
    expect(orphan[0]).toContain('Mothership')
  })

  it('reject a battlerider that has paid for an FTL drive', () => {
    const problems = validateFleetFtl([{ id: 'rider', ftl: 'standard', battlerider: true }])
    expect(problems[0]).toContain('do not carry an FTL Drive')
  })
})

// ---------------------------------------------------------------------------
// 11.9 — gates: construction and damage
// ---------------------------------------------------------------------------

describe('building a gate (11.9)', () => {
  it('makes a Portal ten times the drive of a Jump Gate of the same throughput', () => {
    expect(gateDriveMass('jump-gate', 60)).toBe(6)
    expect(gateDriveMass('portal', 60)).toBe(60)
  })

  it('needs hull boxes worth at least 10% of the transfer mass, rounded up', () => {
    expect(gateMinimumHullBoxes(60)).toBe(6)
    expect(gateMinimumHullBoxes(61)).toBe(7)
  })

  it('exempts natural gates from all of it', () => {
    expect(validateGateBuild(gate({ natural: true, hullBoxes: 0, transferMass: 0 }), 0)).toEqual([])
  })

  it('reports an under-powered or under-built artificial gate', () => {
    expect(validateGateBuild(gate(), 6)).toEqual([])
    expect(validateGateBuild(gate(), 5)[0]).toContain('FTL Drive')
    expect(validateGateBuild(gate({ hullBoxes: 5 }), 6)[0]).toContain('hull boxes')
  })
})

describe('a damaged gate’s capacity (11.9) — [reading] R13', () => {
  it('follows the book’s worked example', () => {
    const g = gate({ transferMass: 60, hullBoxes: 6 })
    expect(currentTransferMass(g, gateState())).toBe(60)
    expect(currentTransferMass(g, gateState({ hullMarked: 1 }))).toBe(50)
    expect(currentTransferMass(g, gateState({ hullMarked: 2 }))).toBe(40)
    expect(currentTransferMass(g, gateState({ hullMarked: 6 }))).toBe(0)
  })

  it('rounds a fractional remainder down', () => {
    // 10 × 2/3 = 6.67; the gate cannot handle the seventh point of mass.
    const g = gate({ transferMass: 10, hullBoxes: 3 })
    expect(currentTransferMass(g, gateState({ hullMarked: 1 }))).toBe(6)
  })

  it('treats a natural gate as unlimited', () => {
    expect(currentTransferMass(gate({ natural: true }), gateState({ hullMarked: 99 }))).toBe(
      Number.POSITIVE_INFINITY,
    )
  })
})

// ---------------------------------------------------------------------------
// 11.9 — gates: activation and facing
// ---------------------------------------------------------------------------

describe('activating a gate (11.9)', () => {
  it('is automatic for a controlled gate, but still only usable next turn — [reading] R10', () => {
    const result = gateActivation(gate({ playerControlled: true }), 4, new Rng(1))
    expect(result.rolled).toBe(false)
    expect(result.activeFromTurn).toBe(5)
  })

  it('delays an uncontrolled gate by the die on 1, 2 or 3', () => {
    for (const face of [1, 2, 3]) {
      const seed = findSeed((r) => d6(r) === face)
      const result = gateActivation(gate({ playerControlled: false }), 4, new Rng(seed))
      expect(result.roll).toBe(face)
      expect(result.delayTurns).toBe(face)
      expect(result.activeFromTurn).toBe(5 + face)
    }
  })

  it('succeeds immediately on 4, 5 or 6 — which is still the following turn', () => {
    for (const face of [4, 5, 6]) {
      const seed = findSeed((r) => d6(r) === face)
      const result = gateActivation(gate({ playerControlled: false }), 4, new Rng(seed))
      expect(result.delayTurns).toBe(0)
      // The rejected reading would make this 4 — faster than one's own gate.
      expect(result.activeFromTurn).toBe(5)
    }
  })

  it('needs no activation at a natural jump point', () => {
    const result = gateActivation(gate({ natural: true }), 4, new Rng(1))
    expect(result.rolled).toBe(false)
    expect(result.activeFromTurn).toBe(4)
    expect(isGateActive(gate({ natural: true }), gateState({ activeFromTurn: null }), 1)).toBe(true)
  })

  it('is not usable before the turn it comes up', () => {
    const g = gate()
    expect(isGateActive(g, gateState({ activeFromTurn: null }), 9)).toBe(false)
    expect(isGateActive(g, gateState({ activeFromTurn: 5 }), 4)).toBe(false)
    expect(isGateActive(g, gateState({ activeFromTurn: 5 }), 5)).toBe(true)
  })
})

describe('a gate’s single facing (11.9) — [reading] R12', () => {
  it('accepts a ship anywhere in the 60° forward arc, not one exact heading', () => {
    const g = gate({ facing: 12 })
    expect(gateBearsOn(g, { x: 0, y: -10 })).toBe(true)
    // 20° off the bow: the same arc, and a different clock course.
    expect(gateBearsOn(g, { x: 3.6, y: -10 })).toBe(true)
    expect(gateBearsOn(g, { x: 0, y: 10 })).toBe(false)
    expect(gateBearsOn(g, { x: 10, y: 0 })).toBe(false)
  })

  it('accepts anything at a gate usable from any angle', () => {
    const any = gate({ facing: null })
    expect(gateBearsOn(any, { x: 0, y: 10 })).toBe(true)
    expect(gateBearsOn(any, { x: -10, y: -10 })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 11.9 — gates: transferring out
// ---------------------------------------------------------------------------

describe('transferring out through a gate (11.9)', () => {
  const ships = [{ id: 's1', mass: 30 }, { id: 's2', mass: 30 }]

  it('refuses a gate that has not been activated', () => {
    const result = resolveGateTransfer(gate(), gateState({ activeFromTurn: null }), ships, 3, new Rng(1))
    expect(result.refused).toContain('activated')
    expect(result.ships).toEqual([])
  })

  it('transfers cleanly when the load exactly equals the capacity — [reading] R8', () => {
    // "exceeds" read as "is at least": a transfer mass of 60 handles 60 mass.
    const result = resolveGateTransfer(gate(), gateState(), ships, 3, new Rng(1))
    expect(result.capacity).toBe(60)
    expect(result.load).toBe(60)
    expect(result.clean).toBe(true)
    expect(result.rolled).toBe(false)
    expect(result.ships.map((s) => s.outcome)).toEqual(['transferred', 'transferred'])
  })

  it('rolls when an undamaged gate is simply overloaded — [reading] R9', () => {
    const overload = [...ships, { id: 's3', mass: 1 }]
    const result = resolveGateTransfer(gate(), gateState(), overload, 3, new Rng(1))
    expect(result.clean).toBe(false)
    expect(result.rolled).toBe(true)
    expect(result.ships).toHaveLength(3)
  })

  it('rolls when the gate’s FTL has failed a threshold check, however light the load', () => {
    const result = resolveGateTransfer(
      gate(),
      gateState({ ftlFailed: true }),
      [{ id: 's1', mass: 1 }],
      3,
      new Rng(1),
    )
    expect(result.rolled).toBe(true)
    expect(result.note).toContain('threshold')
  })

  it('kills on a 3 or higher — 1 is the good result, not the bad one', () => {
    const seed = findSeed((r) => d6(r) === 1 && d6(r) === 2 && d6(r) === 3 && d6(r) === 6)
    const result = resolveGateTransfer(
      gate({ transferMass: 10 }),
      gateState(),
      [
        { id: 'lucky', mass: 30 },
        { id: 'prudent', mass: 30 },
        { id: 'lost', mass: 30 },
        { id: 'gone', mass: 30 },
      ],
      3,
      new Rng(seed),
    )
    expect(result.ships.map((s) => s.outcome)).toEqual([
      'transferred',
      'backed-out',
      'destroyed',
      'destroyed',
    ])
  })

  it('leaves a ship that backs out on the gate at rest', () => {
    const seed = findSeed((r) => d6(r) === 2)
    const g = gate({ transferMass: 1, position: { x: 12, y: 30 } })
    const result = resolveGateTransfer(g, gateState(), [{ id: 's', mass: 30 }], 3, new Rng(seed))
    expect(result.ships[0].outcome).toBe('backed-out')
    expect(result.ships[0].position).toEqual({ x: 12, y: 30 })
    expect(result.ships[0].velocity).toBe(0)
    // A copy, not a handle on the gate's own position.
    result.ships[0].position!.x = 0
    expect(g.position.x).toBe(12)
  })
})

// ---------------------------------------------------------------------------
// 11.9 — gates: transferring in
// ---------------------------------------------------------------------------

describe('entering the table through a gate (11.9)', () => {
  it('places the ship on the gate facing 180° from it and runs its velocity', () => {
    // The book's own parenthesis: a gate facing 9 emits on course 3.
    const result = gateEntry(gate({ facing: 9 }), { velocity: 8, driveRating: 8 })
    expect(result.placed).toBe(true)
    expect(result.course).toBe(3)
    expect(result.position.x).toBeCloseTo(8)
    expect(result.position.y).toBeCloseTo(0)
    expect(result.origin).toEqual(ORIGIN)
  })

  it('caps the ordered velocity at the ship’s main drive rating', () => {
    expect(gateEntry(gate(), { velocity: 6, driveRating: 6 }).placed).toBe(true)
    const refused = gateEntry(gate(), { velocity: 7, driveRating: 6 })
    expect(refused.placed).toBe(false)
    expect(refused.reason).toContain('drive rating')
  })

  it('needs a course nominated at a gate usable from any angle', () => {
    const any = gate({ facing: null })
    expect(gateEntry(any, { velocity: 4, driveRating: 6 }).placed).toBe(false)
    const chosen = gateEntry(any, { velocity: 4, driveRating: 6, course: 6 })
    expect(chosen.placed).toBe(true)
    expect(chosen.course).toBe(6)
    expect(chosen.position.y).toBeCloseTo(4)
  })

  it('never scatters, however far the ship travels', () => {
    const a = gateEntry(gate(), { velocity: 6, driveRating: 6 })
    const b = gateEntry(gate(), { velocity: 6, driveRating: 6 })
    expect(a).toEqual(b)
  })
})

describe('a Portal with both ends on the table (11.9)', () => {
  const portalA = gate({ id: 'pa', kind: 'portal', position: { x: 0, y: 0 }, facing: 9 })
  const portalB = gate({ id: 'pb', kind: 'portal', position: { x: 30, y: 30 }, facing: 12 })

  it('carries the ship’s velocity across untouched', () => {
    const result = portalPairTransit(portalA, portalB, 14)
    expect(result.placed).toBe(true)
    expect(result.velocity).toBe(14)
    // Facing 12 emits on course 6, down the table.
    expect(result.course).toBe(6)
    expect(result.position.x).toBeCloseTo(30)
    expect(result.position.y).toBeCloseTo(44)
  })

  it('refuses a pair of Jump Gates, which are not linked', () => {
    const result = portalPairTransit(gate({ id: 'ga' }), gate({ id: 'gb' }), 10)
    expect(result.placed).toBe(false)
    expect(result.reason).toContain('not linked')
  })
})

// ---------------------------------------------------------------------------
// 11.10 — natural jump points
// ---------------------------------------------------------------------------

describe('jump point disorientation (11.10) — [reading] R14', () => {
  it('lasts exactly to the end of the turn of exit', () => {
    const effect = jumpPointDisorientation(4)
    expect(effect.outOfControl).toBe(true)
    expect(effect.appliedTurn).toBe(4)
    expect(effect.expiresAfterTurn).toBe(4)
    expect(isDisoriented(effect, 4)).toBe(true)
    expect(isDisoriented(effect, 5)).toBe(false)
  })

  it('rolls no die, so 10.3’s permanent result can never happen', () => {
    // The rejected reading rolls 10.3's D6, which on a 6 is out of control for
    // the rest of the game — which 11.10's "until the next turn" denies.
    const a = jumpPointDisorientation(2)
    const b = jumpPointDisorientation(2)
    expect(a).toEqual(b)
    expect(a.expiresAfterTurn - a.appliedTurn).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Determinism and purity
// ---------------------------------------------------------------------------

describe('the module is pure and replays exactly', () => {
  it('gives the same battle twice from the same seed', () => {
    const context = {
      exitPoint: ORIGIN,
      nearby: [{ id: 'a', position: { x: 2, y: 0 } }, { id: 'b', position: { x: 4, y: 0 } }],
      lightCraft: [{ id: 'cap', position: { x: 1, y: 0 } }],
      passengers: [{ id: 'sds' }],
    }
    expect(resolveFtlExit(context, new Rng(0x11a7))).toEqual(resolveFtlExit(context, new Rng(0x11a7)))

    const plan: FtlEntryPlan = { shipId: 's', turn: 2, entryPoint: ORIGIN, course: 12, velocity: 6 }
    const entry = { nearby: [{ id: 'base', position: { x: 3, y: 0 } }], massiveError: true }
    expect(resolveFtlEntry(plan, entry, new Rng(0x5c47))).toEqual(
      resolveFtlEntry(plan, entry, new Rng(0x5c47)),
    )
  })

  it('does not touch anything it is handed', () => {
    const nearby = [{ id: 'a', position: { x: 2, y: 0 } }]
    const passengers = [{ id: 'sds' }]
    const plan: FtlEntryPlan = { shipId: 's', turn: 2, entryPoint: { x: 5, y: 5 }, course: 12, velocity: 6 }
    const carried = [{ id: 'r', position: { x: 5, y: 9 } }]
    const g = gate()
    const state = gateState()

    const before = JSON.stringify({ nearby, passengers, plan, carried, g, state })
    resolveFtlExit({ exitPoint: ORIGIN, nearby, passengers }, new Rng(4))
    resolveFtlEntry(plan, { nearby, carried, massiveError: true }, new Rng(4))
    resolveGateTransfer(g, state, [{ id: 's', mass: 100 }], 3, new Rng(4))
    gateEntry(g, { velocity: 6, driveRating: 6 })
    expect(JSON.stringify({ nearby, passengers, plan, carried, g, state })).toBe(before)
  })
})
