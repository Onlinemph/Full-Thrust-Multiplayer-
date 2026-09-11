/**
 * The economy: the production phase (6.5), the Subject Population rules (6.4),
 * the price schedule and the shipyard table.
 *
 * Every number asserted here is quoted from `docs/rules/campaign.md` in the
 * test's own name, so a change that breaks one of these is a change that broke
 * a rule rather than a refactor that broke a test.
 */

import { describe, expect, it } from 'vitest'
import type { ShipDesign } from '../engine/types'
import {
  activeFactories,
  ANCIENT_RUINS_TECH_POINTS,
  BIOLOGICALLY_RICH_RESEARCH_POINTS,
  capacityRating,
  colonisationRefusal,
  colonyOutput,
  emigrate,
  growPopulation,
  INTEGRATION_RP_PER_MILLION,
  integrationCost,
  landColonists,
  MINERAL_RICH_MULTIPLIER,
  POPULATION_GROWTH_DIVISOR,
  populationGrowth,
  PRICE_SCHEDULE,
  priceOf,
  produceAtColony,
  purchaseRefusal,
  requiredTechnology,
  rollUnrest,
  RP_PER_ACTIVE_FACTORY,
  RP_PER_MILLION_POPULATION,
  runIntegrationProgram,
  runProductionPhase,
  SHIPYARD_CAPACITY_RATINGS,
  SHIPYARD_THROUGHPUT_RATINGS,
  shipPrice,
  shipyardPrice,
  shipyardRefusal,
  shipyardTurns,
  SUBJECT_POPULATION_PENALTY,
  throughputRating,
  UNREST_MILLIONS_PER_DIE,
} from './economy'
import { rollD20, rollD6, type Colony, type PlanetaryBody, type RandomStream } from './types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** The first seed whose stream rolls what a test needs (see map.test.ts). */
function seedWhere(predicate: (stream: RandomStream) => boolean): number {
  for (let seed = 1; seed < 500_000; seed++) {
    if (predicate({ seed, cursor: 0 })) return seed
  }
  throw new Error('No seed satisfies the predicate')
}

/** A minimal design: only mass, streamlining and points matter to the economy. */
function design(overrides: Partial<ShipDesign> = {}): ShipDesign {
  return {
    id: 'test-cruiser',
    name: 'Test Cruiser',
    faction: 'test',
    group: 'cruiser',
    mass: 80,
    hullClass: 'average',
    hullRows: 4,
    hullBoxes: 24,
    drive: { thrust: 4, advanced: false },
    ftl: 'standard',
    streamlining: 'none',
    armour: { layers: [], regenerative: false },
    screens: { level: 1, generators: 1, advanced: false },
    weapons: [],
    turrets: [],
    systems: [],
    fighterBays: [],
    gunboats: [],
    damageControlParties: 1,
    marineParties: 0,
    points: 214,
    ...overrides,
  }
}

function body(overrides: Partial<PlanetaryBody> = {}): PlanetaryBody {
  return {
    id: 'sys-1-b1',
    name: 'Tau Ceti I',
    type: 'terran',
    trait: 'none',
    parentId: null,
    colonyId: 'col-1',
    ...overrides,
  }
}

function colony(overrides: Partial<Colony> = {}): Colony {
  return {
    id: 'col-1',
    name: 'New Tokyo',
    owner: 'esu',
    systemId: 'sys-1',
    bodyId: 'sys-1-b1',
    population: { loyal: 10, subject: 0 },
    factories: 0,
    factoriesOffline: 0,
    defences: { pdu: 0, advancedPdu: 0, planetShield: false },
    shipyards: [],
    stockpileRp: 0,
    integrationCredit: 0,
    commandPost: false,
    underSiege: false,
    capturedIdlePhases: 0,
    stabilised: false,
    buildingBlocked: false,
    buildQueue: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// The price schedule
// ---------------------------------------------------------------------------

describe('the price schedule', () => {
  it('prices a ship at its Combat Points Value, one RP per Full Thrust point', () => {
    expect(shipPrice(design({ points: 214 }))).toBe(214)
    expect(shipPrice(design({ points: 37.5 }))).toBe(37.5)
    expect(priceOf({ kind: 'starship', designId: 'test-cruiser' }, { design: () => design() })).toBe(214)
    expect(() => priceOf({ kind: 'starship', designId: 'nope' }, { design: () => undefined })).toThrow()
  })

  it('is the table as printed', () => {
    expect(priceOf({ kind: 'colony-transport' })).toBe(50)
    expect(priceOf({ kind: 'scout-drone' })).toBe(150)
    expect(priceOf({ kind: 'factory' })).toBe(2000)
    expect(priceOf({ kind: 'pdu' })).toBe(200)
    expect(priceOf({ kind: 'advanced-pdu' })).toBe(500)
    expect(priceOf({ kind: 'planet-shield' })).toBe(1500)
    // Stated in prose rather than in the table.
    expect(priceOf({ kind: 'command-post' })).toBe(0)
    expect(priceOf({ kind: 'hazard-stabilisation' })).toBe(500)
    expect(priceOf({ kind: 'admiral' })).toBe(100)
    expect(priceOf({ kind: 'drop-pod' })).toBe(50)
    expect(priceOf({ kind: 'sleeper-spy' })).toBe(100)
    expect(priceOf({ kind: 'counter-espionage' })).toBe(200)
  })

  it('gates the four items that need a technology', () => {
    expect(requiredTechnology({ kind: 'factory' })).toBe('industrial')
    expect(requiredTechnology({ kind: 'pdu' })).toBe('pdu')
    expect(requiredTechnology({ kind: 'advanced-pdu' })).toBe('advanced-pdu')
    expect(requiredTechnology({ kind: 'planet-shield' })).toBe('planet-shield')
    expect(requiredTechnology({ kind: 'colony-transport' })).toBeNull()
    expect(requiredTechnology({ kind: 'starship', designId: 'x' })).toBeNull()
    expect(PRICE_SCHEDULE['scout-drone'].requires).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Shipyards
// ---------------------------------------------------------------------------

describe('shipyards', () => {
  it('is the table as printed', () => {
    expect(SHIPYARD_THROUGHPUT_RATINGS.map((r) => [r.rating, r.rp, r.mass])).toEqual([
      [10, 250, 25],
      [30, 500, 150],
      [50, 1000, 250],
      [70, 2000, 350],
      [100, 3000, 400],
      [125, 3750, 500],
    ])
    expect(SHIPYARD_CAPACITY_RATINGS.map((r) => [r.rating, r.rp, r.mass])).toEqual([
      [25, 250, 50],
      [50, 500, 100],
      [100, 1000, 200],
      [200, 2000, 400],
      [300, 3000, 500],
      [400, 4000, 600],
    ])
    expect(throughputRating(70)?.rp).toBe(2000)
    expect(capacityRating(400)?.mass).toBe(600)
    expect(throughputRating(11)).toBeUndefined()
  })

  it('costs the two ratings added together', () => {
    expect(shipyardPrice({ throughput: 50, capacity: 100, orbital: true })).toEqual({
      rp: 2000,
      mass: 450,
    })
    expect(() => shipyardPrice({ throughput: 44, capacity: 100, orbital: true })).toThrow()
    expect(() => shipyardPrice({ throughput: 50, capacity: 44, orbital: true })).toThrow()
  })

  it('halves a planetary yard on a breathable world', () => {
    const planetary = shipyardPrice({ throughput: 50, capacity: 100, orbital: false, breathableWorld: true })
    expect(planetary.rp).toBe(1000)
    // Orbital yards, and planetary yards on worlds you need a suit for, pay in full.
    expect(shipyardPrice({ throughput: 50, capacity: 100, orbital: true, breathableWorld: true }).rp).toBe(2000)
    expect(shipyardPrice({ throughput: 50, capacity: 100, orbital: false }).rp).toBe(2000)
  })

  it('processes its first rating in RP a turn', () => {
    // A 214-point cruiser out of a 10 RP yard is a 22-turn job.
    expect(shipyardTurns({ throughput: 10 }, 214)).toBe(22)
    expect(shipyardTurns({ throughput: 125 }, 214)).toBe(2)
    expect(shipyardTurns({ throughput: 125 }, 0)).toBe(1)
  })

  it('builds nothing bigger than its second rating', () => {
    const yard = { throughput: 50, capacity: 100, orbital: true }
    expect(shipyardRefusal(yard, design({ mass: 100 }))).toBeNull()
    expect(shipyardRefusal(yard, design({ mass: 101 }))).toMatch(/masses 101/)
  })

  it('lets a planetary yard build only what can leave the atmosphere', () => {
    const planetary = { throughput: 50, capacity: 100, orbital: false }
    expect(shipyardRefusal(planetary, design({ streamlining: 'none' }))).toMatch(/atmosphere/)
    expect(shipyardRefusal(planetary, design({ streamlining: 'partial' }))).toBeNull()
    expect(shipyardRefusal(planetary, design({ streamlining: 'full' }))).toBeNull()
    // An orbital yard does not care.
    expect(shipyardRefusal({ ...planetary, orbital: true }, design({ streamlining: 'none' }))).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Population growth (6.5)
// ---------------------------------------------------------------------------

describe('population growth (6.5)', () => {
  it('is +1M per 5M on a Terran world and +1M per 10M on a Sub-Terran one', () => {
    expect(POPULATION_GROWTH_DIVISOR.terran).toBe(5)
    expect(POPULATION_GROWTH_DIVISOR['sub-terran']).toBe(10)
    expect(populationGrowth(5, 'terran')).toBe(1)
    expect(populationGrowth(12, 'terran')).toBe(2)
    expect(populationGrowth(4, 'terran')).toBe(0)
    expect(populationGrowth(25, 'sub-terran')).toBe(2)
  })

  it('grows nothing anywhere else', () => {
    for (const type of ['minimal-terran', 'barren', 'gas-giant', 'special-anomaly'] as const) {
      expect(POPULATION_GROWTH_DIVISOR[type]).toBeNull()
      expect(populationGrowth(100, type)).toBe(0)
    }
  })

  it('grows each cohort on its own count', () => {
    const c = colony({ population: { loyal: 10, subject: 5 } })
    expect(growPopulation(c, body({ type: 'terran' }))).toEqual({ loyal: 2, subject: 1 })
    expect(c.population).toEqual({ loyal: 12, subject: 6 })
  })
})

// ---------------------------------------------------------------------------
// Industrial output (6.5) and the Subject Population penalty (6.4)
// ---------------------------------------------------------------------------

describe('industrial output (6.5)', () => {
  it('is 50 RP a million plus 50 RP an active factory', () => {
    expect(RP_PER_MILLION_POPULATION).toBe(50)
    expect(RP_PER_ACTIVE_FACTORY).toBe(50)
    const out = colonyOutput(colony({ population: { loyal: 10, subject: 0 }, factories: 2 }), body())
    expect(out.populationRp).toBe(500)
    expect(out.factoryRp).toBe(100)
    expect(out.grossRp).toBe(600)
    expect(out.netRp).toBe(600)
  })

  it('counts only factories that are active', () => {
    const c = colony({ factories: 5, factoriesOffline: 2 })
    expect(activeFactories(c)).toBe(3)
    expect(colonyOutput(c, body()).factoryRp).toBe(150)
  })

  it('doubles on a mineral rich world', () => {
    expect(MINERAL_RICH_MULTIPLIER).toBe(2)
    const out = colonyOutput(
      colony({ population: { loyal: 10, subject: 0 }, factories: 2 }),
      body({ trait: 'mineral-rich' }),
    )
    expect(out.mineralRich).toBe(true)
    expect(out.grossRp).toBe(1200)
  })

  it('costs a captor 75% of everything a freshly taken colony makes', () => {
    expect(SUBJECT_POPULATION_PENALTY).toBe(0.75)
    // Every inhabitant is a subject the moment the colony falls, which is the
    // rule verbatim: the owner loses three quarters of the whole output.
    const out = colonyOutput(colony({ population: { loyal: 0, subject: 10 }, factories: 2 }), body())
    expect(out.grossRp).toBe(600)
    expect(out.subjectPenaltyRp).toBe(450)
    expect(out.netRp).toBe(150)
  })

  it('retreats as the subjects are integrated', () => {
    const half = colonyOutput(colony({ population: { loyal: 5, subject: 5 }, factories: 2 }), body())
    expect(half.grossRp).toBe(600)
    expect(half.subjectPenaltyRp).toBe(225) // 0.75 x 600 x half the population
    expect(half.netRp).toBe(375)

    const none = colonyOutput(colony({ population: { loyal: 10, subject: 0 } }), body())
    expect(none.subjectPenaltyRp).toBe(0)
  })

  it('still generates RP under siege (6.4)', () => {
    const besieged = colony({ underSiege: true, population: { loyal: 10, subject: 0 } })
    expect(colonyOutput(besieged, body()).netRp).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// Unrest and integration (6.4)
// ---------------------------------------------------------------------------

describe('unrest (6.4)', () => {
  it('rolls one die per 5M of Subject Population', () => {
    expect(UNREST_MILLIONS_PER_DIE).toBe(5)
    const quiet = rollUnrest(colony({ population: { loyal: 10, subject: 4 } }), { seed: 1, cursor: 0 })
    expect(quiet.dice).toHaveLength(0)
    expect(quiet.riots).toBe(0)

    const stream: RandomStream = { seed: 1, cursor: 0 }
    const big = rollUnrest(colony({ population: { loyal: 0, subject: 12 } }), stream)
    expect(big.dice).toHaveLength(2)
  })

  it('costs 1d6 x 100 RP on a 1, and blocks building next phase', () => {
    // A seed whose first die riots and whose second sets the bill.
    const seed = seedWhere((stream) => rollD6(stream) === 1)
    const bill = rollD6({ seed, cursor: 1 })

    const c = colony({ population: { loyal: 0, subject: 5 } })
    const result = rollUnrest(c, { seed, cursor: 0 })
    expect(result.dice).toEqual([1])
    expect(result.riots).toBe(1)
    expect(result.rpLost).toBe(bill * 100)
    expect(result.buildingBlocked).toBe(true)
    expect(c.buildingBlocked).toBe(true)
  })

  it('leaves a quiet colony alone', () => {
    const seed = seedWhere((stream) => rollD6(stream) !== 1)
    const c = colony({ population: { loyal: 0, subject: 5 } })
    const result = rollUnrest(c, { seed, cursor: 0 })
    expect(result.riots).toBe(0)
    expect(result.rpLost).toBe(0)
    expect(c.buildingBlocked).toBe(false)
  })
})

describe('the Integration Program (6.4)', () => {
  it('runs 100 RP per million', () => {
    expect(INTEGRATION_RP_PER_MILLION).toBe(100)
    expect(integrationCost(3)).toBe(300)
    expect(integrationCost(0)).toBe(0)
  })

  it('converts Subject Population to Loyal, and banks the remainder', () => {
    const c = colony({ population: { loyal: 2, subject: 10 } })
    const first = runIntegrationProgram(c, 350)
    expect(first.millionsConverted).toBe(3)
    expect(c.population).toEqual({ loyal: 5, subject: 7 })
    expect(first.credit).toBe(50)
    expect(first.rpAccepted).toBe(350)

    // The 50 left on account buys the next million when another 50 arrives.
    const second = runIntegrationProgram(c, 50)
    expect(second.millionsConverted).toBe(1)
    expect(c.population).toEqual({ loyal: 6, subject: 6 })
    expect(c.integrationCredit).toBe(0)
  })

  it('hands back RP there is nobody left to spend on', () => {
    const c = colony({ population: { loyal: 0, subject: 2 } })
    const result = runIntegrationProgram(c, 500)
    expect(result.millionsConverted).toBe(2)
    expect(result.rpAccepted).toBe(200)
    expect(result.rpRefunded).toBe(300)
    expect(c.integrationCredit).toBe(0)
    expect(c.population).toEqual({ loyal: 2, subject: 0 })
  })
})

// ---------------------------------------------------------------------------
// Emigration
// ---------------------------------------------------------------------------

describe('emigration', () => {
  it('lifts a million colonists per transport, at 50 RP a transport', () => {
    const c = colony({ population: { loyal: 10, subject: 0 } })
    const result = emigrate(c, 4)
    expect(result.millions).toBe(4)
    expect(result.transports).toBe(4)
    expect(result.transportRp).toBe(200)
    expect(c.population.loyal).toBe(6)
  })

  it('cannot lift people who are not there', () => {
    const c = colony({ population: { loyal: 3, subject: 8 } })
    expect(emigrate(c, 10).millions).toBe(3)
    expect(c.population.loyal).toBe(0)
    // Subject Population only moves if the GM says so.
    expect(emigrate(c, 2, { subjects: true }).millions).toBe(2)
    expect(c.population.subject).toBe(6)
    expect(emigrate(c, -5).millions).toBe(0)
  })

  it('lands colonists as loyal population at the far end', () => {
    const c = colony({ population: { loyal: 1, subject: 0 } })
    expect(landColonists(c, 20)).toBe(20)
    expect(c.population.loyal).toBe(21)
  })
})

// ---------------------------------------------------------------------------
// The production phase (6.5)
// ---------------------------------------------------------------------------

describe('the production phase (6.5)', () => {
  it('grows the population first, then takes output on what grew', () => {
    const c = colony({ population: { loyal: 10, subject: 0 }, factories: 1 })
    const result = produceAtColony(c, body({ type: 'terran' }), { seed: 1, cursor: 0 })
    // 10M grows to 12M, which is what the 50 RP a million is paid on.
    expect(result.populationGrowth).toEqual({ loyal: 2, subject: 0 })
    expect(result.output.populationRp).toBe(600)
    expect(result.rpBanked).toBe(650)
    expect(c.stockpileRp).toBe(650)
  })

  it('pays a research point for a biologically rich world and a tech point for ruins', () => {
    expect(BIOLOGICALLY_RICH_RESEARCH_POINTS).toBe(1)
    expect(ANCIENT_RUINS_TECH_POINTS).toBe(1)
    const bio = produceAtColony(colony(), body({ trait: 'biologically-rich' }), { seed: 1, cursor: 0 })
    expect(bio.researchPoints).toBe(1)
    expect(bio.techPoints).toBe(0)
    const ruins = produceAtColony(colony(), body({ trait: 'ancient-ruins' }), { seed: 1, cursor: 0 })
    expect(ruins.techPoints).toBe(1)
  })

  it('rolls 1d20 on a hazardous world and loses a factory on a 1', () => {
    const disaster = seedWhere((stream) => rollD20(stream) === 1)
    const c = colony({ factories: 3, population: { loyal: 10, subject: 0 } })
    const result = produceAtColony(c, body({ trait: 'hazardous' }), { seed: disaster, cursor: 0 })
    expect(result.hazardRoll).toBe(1)
    expect(result.factoriesDestroyed).toBe(1)
    expect(c.factories).toBe(2)
    // The factory that blew up does not also pay out this phase.
    expect(result.output.activeFactories).toBe(2)

    const safe = seedWhere((stream) => rollD20(stream) !== 1)
    const quiet = colony({ factories: 3 })
    const result2 = produceAtColony(quiet, body({ trait: 'hazardous' }), { seed: safe, cursor: 0 })
    expect(result2.factoriesDestroyed).toBe(0)
    expect(quiet.factories).toBe(3)
  })

  it('rolls no hazard die anywhere else', () => {
    const stream: RandomStream = { seed: 3, cursor: 0 }
    const result = produceAtColony(colony(), body({ trait: 'none' }), stream)
    expect(result.hazardRoll).toBeNull()
    expect(stream.cursor).toBe(0)
  })

  it('gives a captured colony nothing for one production phase (6.4)', () => {
    const c = colony({ capturedIdlePhases: 1, population: { loyal: 0, subject: 10 }, factories: 2 })
    const silent = produceAtColony(c, body({ trait: 'ancient-ruins' }), { seed: 1, cursor: 0 })
    expect(silent.silencedByCapture).toBe(true)
    expect(silent.rpBanked).toBe(0)
    expect(silent.techPoints).toBe(0)
    expect(c.stockpileRp).toBe(0)
    // The people still grow, and the debt is paid off.
    expect(silent.populationGrowth.subject).toBe(2)
    expect(c.capturedIdlePhases).toBe(0)

    const next = produceAtColony(c, body({ trait: 'ancient-ruins' }), { seed: 1, cursor: 0 })
    expect(next.silencedByCapture).toBe(false)
    expect(next.rpBanked).toBeGreaterThan(0)
    expect(next.techPoints).toBe(1)
  })

  it('totals a phase by player, and replays it exactly', () => {
    const build = (): Array<{ colony: Colony; body: PlanetaryBody }> => [
      {
        colony: colony({ id: 'a', owner: 'esu', population: { loyal: 10, subject: 0 }, factories: 1 }),
        body: body({ trait: 'biologically-rich' }),
      },
      {
        colony: colony({ id: 'b', owner: 'esu', population: { loyal: 0, subject: 20 } }),
        body: body({ trait: 'hazardous' }),
      },
      {
        colony: colony({ id: 'c', owner: 'nac', population: { loyal: 5, subject: 0 } }),
        body: body({ type: 'sub-terran', trait: 'ancient-ruins' }),
      },
    ]

    const first = build()
    const streamA: RandomStream = { seed: 8080, cursor: 0 }
    const reportA = runProductionPhase(first, streamA)

    expect(Object.keys(reportA.byPlayer).sort()).toEqual(['esu', 'nac'])
    expect(reportA.byPlayer.esu.rp).toBe(
      reportA.colonies.filter((c) => c.owner === 'esu').reduce((sum, c) => sum + c.rpBanked, 0),
    )
    expect(reportA.byPlayer.esu.researchPoints).toBe(1)
    expect(reportA.byPlayer.nac.techPoints).toBe(1)

    // Same seed, same colonies, same phase — down to the hazard die.
    const second = build()
    const streamB: RandomStream = { seed: 8080, cursor: 0 }
    expect(runProductionPhase(second, streamB)).toEqual(reportA)
    expect(streamB.cursor).toBe(streamA.cursor)
    expect(second.map((e) => e.colony)).toEqual(first.map((e) => e.colony))
  })
})

// ---------------------------------------------------------------------------
// What may be bought, and where (6.2.1, 6.4)
// ---------------------------------------------------------------------------

describe('what a colony may buy (6.4)', () => {
  it('refuses an item whose technology has not been researched', () => {
    expect(purchaseRefusal(colony(), { kind: 'factory' }, [])).toMatch(/industrial/)
    expect(purchaseRefusal(colony(), { kind: 'factory' }, ['industrial'])).toBeNull()
    expect(purchaseRefusal(colony(), { kind: 'colony-transport' }, [])).toBeNull()
  })

  it('lets a besieged colony build defences but not starships or a command post', () => {
    const besieged = colony({ underSiege: true })
    expect(purchaseRefusal(besieged, { kind: 'starship', designId: 'x' }, [])).toMatch(/siege/)
    expect(purchaseRefusal(besieged, { kind: 'command-post' }, [])).toMatch(/siege/)
    expect(purchaseRefusal(besieged, { kind: 'pdu' }, ['pdu'])).toBeNull()
  })

  it('blocks building for a phase after a riot', () => {
    const rioting = colony({ buildingBlocked: true })
    expect(purchaseRefusal(rioting, { kind: 'pdu' }, ['pdu'])).toMatch(/unrest/)
  })
})

describe('what may be colonised (6.2.1)', () => {
  it('refuses a gas giant and leaves an anomaly to the GM', () => {
    expect(colonisationRefusal(body({ type: 'gas-giant' }), [], false)).toMatch(/gas giant/)
    expect(colonisationRefusal(body({ type: 'special-anomaly' }), [], false)).toMatch(/anomaly/)
  })

  it('needs C.E.T. for a barren world', () => {
    expect(colonisationRefusal(body({ type: 'barren' }), [], false)).toMatch(/Controlled Environment/)
    expect(colonisationRefusal(body({ type: 'barren' }), ['controlled-environment'], false)).toBeNull()
  })

  it('needs 500 RP of stabilisation for a hazardous world', () => {
    expect(colonisationRefusal(body({ trait: 'hazardous' }), [], false)).toMatch(/500 RP/)
    expect(colonisationRefusal(body({ trait: 'hazardous' }), [], true)).toBeNull()
    expect(colonisationRefusal(body({ type: 'terran', trait: 'none' }), [], false)).toBeNull()
  })
})
