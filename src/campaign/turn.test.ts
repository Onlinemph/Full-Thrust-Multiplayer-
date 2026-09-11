/**
 * The campaign turn (campaign.md "Turn sequence", 6.1, 6.3, 6.4, 6.5) and the
 * research tables (8).
 *
 * The order matrix, the research tables and the planetary rules are all printed
 * in full in campaign.md, so each one is tested against its own printed figures
 * — a change that breaks a test here is a change that broke a rule.
 */

import { describe, expect, it } from 'vitest'
import { setEmbeddedScenario, startScenario, INTRODUCTORY_VICTORY } from '../data/scenarios'
import { designById } from '../data/ships'
import { campaignRng, sampleAt } from './intel'
import {
  BASE_FTL_RATE,
  MAX_FTL_RATE,
  acquisitionCost,
  effectiveCost,
  ftlRate,
  meetsItemRequirement,
  resolveResearch,
  techById,
  technologiesIn,
  type TechId,
} from './research'
import {
  CAMPAIGN_BANNED_SYSTEMS,
  CAMPAIGN_PHASE_ORDER,
  CAMPAIGN_TABLE,
  COMMAND_POST_RANGE,
  HAZARDOUS_STABILISATION_RP,
  INTEGRATION_COST_PER_MILLION,
  MOVE_PHASE,
  PRODUCTION_INTERVAL,
  SUBJECT_POPULATION_OUTPUT_PENALTY,
  adminPhase,
  advanceCampaignPhase,
  canColonise,
  captureColony,
  colonise,
  discoveryPhase,
  engagementScenario,
  engagementSetup,
  explorationHazardCheck,
  explorationPhase,
  ftlRateFor,
  ftlStepCost,
  fleetInitiativeModifier,
  hexDistance,
  integrate,
  integrationCost,
  isProductionTurn,
  moveIsInPhase,
  orbitalBombardment,
  phasesForTurn,
  planEngagement,
  planetaryPhase,
  plotDestination,
  productionPhase,
  repairBetweenTurns,
  requiredPlotLead,
  resolveAssault,
  resolveMeeting,
  siegeStatus,
  startCampaignClock,
  subjectPopulationCost,
  unrestCheck,
  validateFtlPlot,
  type CampaignBattleForce,
  type Colony,
  type FleetOrder,
  type FtlPlot,
  type Hex,
  type TaskForceProfile,
} from './turn'

// A seed search, as in intel.test.ts: the stream is keyed by position, so a
// test asks for the seed whose opening draws are the faces it wants.
function seedYielding(faces: readonly number[]): number {
  for (let seed = 1; seed < 20_000_000; seed++) {
    let matches = true
    for (let i = 0; i < faces.length; i++) {
      // Read through the stream's own sampler, so a change to it re-derives the
      // seed rather than silently rolling different faces.
      if (Math.floor(sampleAt(seed, i) * 6) + 1 !== faces[i]) {
        matches = false
        break
      }
    }
    if (matches) return seed
  }
  throw new Error(`no seed produces ${faces.join(',')}`)
}

const hex = (q: number, r: number): Hex => ({ q, r })

// ---------------------------------------------------------------------------
// The eight phases
// ---------------------------------------------------------------------------

describe('the turn sequence', () => {
  it('is the eight phases campaign.md numbers', () => {
    expect(CAMPAIGN_PHASE_ORDER).toEqual([
      'ftl-movement',
      'exploration',
      'exploration-risk',
      'discovery',
      'combat',
      'planetary',
      'admin',
      'production',
    ])
  })

  it('produces every 4th turn and no other', () => {
    expect(PRODUCTION_INTERVAL).toBe(4)
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(isProductionTurn)).toEqual([
      false, false, false, true, false, false, false, true,
    ])
    expect(phasesForTurn(3)).toHaveLength(7)
    expect(phasesForTurn(3)).not.toContain('production')
    expect(phasesForTurn(4)).toHaveLength(8)
    expect(phasesForTurn(4)).toContain('production')
  })

  it('runs admin straight into the next turn when there is no production phase', () => {
    const clock = startCampaignClock(1)
    expect(clock.phase).toBe('ftl-movement')
    clock.phase = 'admin'
    advanceCampaignPhase(clock)
    expect(clock).toEqual({ turn: 2, phase: 'ftl-movement' })
  })

  it('runs admin into production on a 4th turn', () => {
    const clock = { turn: 4, phase: 'admin' as const }
    advanceCampaignPhase(clock)
    expect(clock).toEqual({ turn: 4, phase: 'production' })
    advanceCampaignPhase(clock)
    expect(clock).toEqual({ turn: 5, phase: 'ftl-movement' })
  })

  it('files each move under the phase it belongs to', () => {
    expect(MOVE_PHASE['plot-ftl']).toBe('ftl-movement')
    expect(MOVE_PHASE.assault).toBe('planetary')
    expect(MOVE_PHASE.research).toBe('production')
    expect(moveIsInPhase({ kind: 'bombard', colonyId: 'c1', batteries: 2 }, { turn: 1, phase: 'planetary' })).toBe(true)
    expect(moveIsInPhase({ kind: 'bombard', colonyId: 'c1', batteries: 2 }, { turn: 1, phase: 'admin' })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// FTL movement (6.1)
// ---------------------------------------------------------------------------

describe('FTL movement (6.1)', () => {
  const force = (over: Partial<TaskForceProfile> = {}): TaskForceProfile => ({
    id: 'tf-1',
    owner: 'esu',
    scout: false,
    admiral: 2,
    ftlRate: 2,
    ...over,
  })

  const plot = (over: Partial<FtlPlot> = {}): FtlPlot => ({
    taskForceId: 'tf-1',
    plottedOnTurn: 1,
    executeOnTurn: 3,
    path: [hex(0, 0), hex(1, 0), hex(2, 0)],
    order: 'ftl-move',
    ...over,
  })

  const openSpace = { nebulae: [], commandPosts: [hex(0, 0)] }

  it('measures hexes the way the strategic map does', () => {
    expect(hexDistance(hex(0, 0), hex(0, 0))).toBe(0)
    expect(hexDistance(hex(0, 0), hex(1, 0))).toBe(1)
    expect(hexDistance(hex(0, 0), hex(3, 0))).toBe(3)
    expect(hexDistance(hex(0, 0), hex(2, -1))).toBe(2)
  })

  it('starts at 2 hexes a turn and research raises it to 8', () => {
    expect(ftlRateFor([])).toBe(BASE_FTL_RATE)
    expect(BASE_FTL_RATE).toBe(2)
    expect(ftlRateFor(['speed-5'])).toBe(5)
    expect(ftlRateFor(['speed-3', 'speed-8'])).toBe(MAX_FTL_RATE)
  })

  it('demands the pre-plotting lead the admiral command level sets', () => {
    expect(requiredPlotLead(force({ admiral: 1 }))).toBe(1)
    expect(requiredPlotLead(force({ admiral: 2 }))).toBe(2)
    expect(requiredPlotLead(force({ admiral: 3 }))).toBe(3)
    expect(requiredPlotLead(force({ admiral: null }))).toBe(3)
    // "Scouts always plot 1 turn ahead" whoever, if anyone, is aboard.
    expect(requiredPlotLead(force({ scout: true, admiral: null }))).toBe(1)
  })

  it('refuses a plot written too late for its admiral', () => {
    const late = validateFtlPlot(plot({ executeOnTurn: 2 }), force({ admiral: 2 }), openSpace)
    expect(late.legal).toBe(false)
    expect(late.reasons[0]).toContain('must be plotted 2 turn(s) ahead')

    expect(validateFtlPlot(plot(), force({ admiral: 2 }), openSpace).legal).toBe(true)
    expect(validateFtlPlot(plot({ executeOnTurn: 2 }), force({ admiral: 1 }), openSpace).legal).toBe(true)
  })

  it('refuses a route that skips a hex', () => {
    const jump = validateFtlPlot(plot({ path: [hex(0, 0), hex(2, 0)] }), force(), openSpace)
    expect(jump.legal).toBe(false)
    expect(jump.reasons.join(' ')).toContain('not to an adjacent hex')
  })

  it('refuses a route longer than the FTL rate', () => {
    const long = validateFtlPlot(
      plot({ path: [hex(0, 0), hex(1, 0), hex(2, 0), hex(3, 0)] }),
      force({ ftlRate: 2 }),
      openSpace,
    )
    expect(long.cost).toBe(3)
    expect(long.legal).toBe(false)
    expect(long.reasons.join(' ')).toContain('against an FTL rate of 2')
  })

  it('reports where a plot leaves the force', () => {
    expect(plotDestination(plot())).toEqual(hex(2, 0))
  })

  describe('gas and dust clouds', () => {
    const nebula = { nebulae: [hex(1, 0), hex(2, 0)], commandPosts: [hex(0, 0)] }

    it('costs a full turn per hex inside', () => {
      expect(ftlStepCost(true, 4)).toBe(4)
      expect(ftlStepCost(false, 4)).toBe(1)
    })

    it('lets a fleet enter one nebula hex and no further', () => {
      const enter = validateFtlPlot(
        plot({ path: [hex(0, 0), hex(1, 0)] }),
        force({ ftlRate: 4 }),
        nebula,
      )
      expect(enter.cost).toBe(4)
      expect(enter.legal).toBe(true)

      const through = validateFtlPlot(
        plot({ path: [hex(0, 0), hex(1, 0), hex(2, 0)] }),
        force({ ftlRate: 4 }),
        nebula,
      )
      expect(through.cost).toBe(8)
      expect(through.legal).toBe(false)
    })

    it('may only be entered from an adjacent hex, never on a run-up', () => {
      // Two clear hexes and then the cloud: the full-turn entry cost can no
      // longer be paid, which is the run-up the rule forbids.
      const runUp = validateFtlPlot(
        plot({ path: [hex(-1, 0), hex(0, 0), hex(1, 0)] }),
        force({ ftlRate: 4 }),
        nebula,
      )
      expect(runUp.cost).toBe(1 + 4)
      expect(runUp.legal).toBe(false)
    })

    it('lets a fleet out at normal speed', () => {
      const exit = validateFtlPlot(
        plot({ path: [hex(1, 0), hex(0, 0), hex(-1, 0)] }),
        force({ ftlRate: 4 }),
        nebula,
      )
      expect(exit.cost).toBe(2)
      expect(exit.legal).toBe(true)
    })
  })

  describe('the command post leash', () => {
    const posts = { nebulae: [], commandPosts: [hex(0, 0)] }

    it('stops a fleet 8 hexes out', () => {
      expect(COMMAND_POST_RANGE).toBe(8)
      const inside = validateFtlPlot(
        plot({ path: [hex(7, 0), hex(8, 0)] }),
        force({ ftlRate: 2 }),
        posts,
      )
      expect(inside.legal).toBe(true)

      const outside = validateFtlPlot(
        plot({ path: [hex(8, 0), hex(9, 0)] }),
        force({ ftlRate: 2 }),
        posts,
      )
      expect(outside.legal).toBe(false)
      expect(outside.reasons.join(' ')).toContain('from a friendly command post')
    })

    it('does not leash a scout', () => {
      const scoutPlot = validateFtlPlot(
        plot({ path: [hex(8, 0), hex(9, 0)], executeOnTurn: 2 }),
        force({ scout: true, ftlRate: 2 }),
        posts,
      )
      expect(scoutPlot.legal).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// The order matrix (6.1)
// ---------------------------------------------------------------------------

describe('the Engage / Stand Off / FTL Move matrix (6.1)', () => {
  const kinds = (intruder: FleetOrder): string[] =>
    (['engage', 'stand-off', 'ftl-move'] as FleetOrder[]).map((defender) => resolveMeeting(intruder, defender).kind)

  it('reads off the table exactly as printed', () => {
    expect(kinds('engage')).toEqual(['even', 'even', 'pursuit'])
    expect(kinds('stand-off')).toEqual(['even', 'none', 'none'])
    expect(kinds('ftl-move')).toEqual(['pursuit', 'none', 'none'])
  })

  it('names the side that meant to fight as the pursuer', () => {
    expect(resolveMeeting('engage', 'ftl-move').pursuer).toBe('intruder')
    expect(resolveMeeting('ftl-move', 'engage').pursuer).toBe('defender')
    expect(resolveMeeting('engage', 'engage').pursuer).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Exploration, exploration risk and discovery
// ---------------------------------------------------------------------------

describe('exploration and discovery', () => {
  it('rolls for a hex once and never again', () => {
    const rng = campaignRng(11)
    let calls = 0
    const generate = (at: Hex): { hex: Hex; feature: 'standard' } => {
      calls += 1
      return { hex: at, feature: 'standard' }
    }
    const found = explorationPhase([hex(1, 0), hex(2, 0), hex(1, 0)], [hex(2, 0)], generate, rng)
    expect(found).toHaveLength(1)
    expect(found[0].hex).toEqual(hex(1, 0))
    expect(calls).toBe(1)
  })

  it('puts a dense asteroid field at -1 on the hazard roll', () => {
    const plain = explorationHazardCheck(campaignRng(21))
    const rough = explorationHazardCheck(campaignRng(21), { denseAsteroidField: true })
    expect(rough.modifier).toBe(-1)
    expect(rough.total).toBe(plain.total - 1)
    // campaign.md prints the modifier but not the table, so a target is the
    // caller's to state and the check says nothing without one.
    expect(plain.safe).toBeNull()
    expect(explorationHazardCheck(campaignRng(21), { target: 2 }).safe).toBe(true)
  })

  it('runs every declared detection check in the order declared', () => {
    const rng = campaignRng(31)
    const findings = discoveryPhase(
      [
        { observerId: 'tf-1', targetId: 'tf-2', context: { distance: 1 } },
        { observerId: 'tf-1', targetId: 'tf-3', context: { distance: 9 } },
      ],
      rng,
    )
    expect(findings).toHaveLength(2)
    expect(findings[0].result.attempted).toBe(true)
    expect(findings[1].result.attempted).toBe(false)
    // One check drew dice; the out-of-range one drew none.
    expect(rng.cursor).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// From a campaign engagement to a tactical battle
// ---------------------------------------------------------------------------

describe('a campaign battle is a Scenario', () => {
  const esu: Omit<CampaignBattleForce, 'role'> = {
    id: 'a',
    name: 'Eurasian Solar Union',
    order: 'engage',
    admiral: 1,
    ships: [{ designId: 'intro-heavy-cruiser', name: 'Kirov' }, { designId: 'intro-frigate' }],
  }
  const nac: Omit<CampaignBattleForce, 'role'> = {
    id: 'b',
    name: 'New Anglian Confederation',
    order: 'engage',
    admiral: 3,
    ships: [{ designId: 'intro-heavy-cruiser' }],
  }

  it('produces no battle, and draws no dice, when the orders say so', () => {
    const rng = campaignRng(41)
    const none = planEngagement(hex(0, 0), 'standard', { ...esu, order: 'stand-off' }, { ...nac, order: 'ftl-move' }, rng)
    expect(none).toBeNull()
    expect(rng.cursor).toBe(0)
  })

  it('draws the battle seed from the campaign stream, so the battle replays with it', () => {
    const first = planEngagement(hex(1, 1), 'standard', esu, nac, campaignRng(42))
    const again = planEngagement(hex(1, 1), 'standard', esu, nac, campaignRng(42))
    expect(again?.seed).toBe(first?.seed)
    expect(first?.seed).toBeGreaterThan(0)
  })

  it('deploys an even battle as two fleets facing each other', () => {
    const engagement = planEngagement(hex(2, -1), 'standard', esu, nac, campaignRng(43))
    expect(engagement?.kind).toBe('even')
    const scenario = engagementScenario(engagement!)

    expect(scenario.table).toEqual(CAMPAIGN_TABLE)
    expect(scenario.victory).toEqual(INTRODUCTORY_VICTORY)
    expect(scenario.sides.map((side) => side.id)).toEqual(['a', 'b'])
    expect(scenario.sides[0].force).toHaveLength(2)
    expect(scenario.sides[0].force[0].facing).toBe(6)
    expect(scenario.sides[1].force[0].facing).toBe(12)
    expect(scenario.sides[0].force[0].name).toBe('Kirov')
    // A fleet caught in transit arrives with way on, at its drive rating.
    expect(scenario.sides[0].force[0].velocity).toBe(designById('intro-heavy-cruiser')?.drive.thrust)
  })

  it('deploys a pursuit as a stern chase with the quarry ahead', () => {
    const engagement = planEngagement(hex(0, 0), 'standard', esu, { ...nac, order: 'ftl-move' }, campaignRng(44))
    expect(engagement?.kind).toBe('pursuit')
    expect(engagement?.pursuer).toBe('intruder')

    const scenario = engagementScenario(engagement!)
    // The quarry — the side that wrote FTL Move — deploys first and ahead.
    expect(scenario.sides[0].id).toBe('b')
    expect(scenario.sides[1].id).toBe('a')
    expect(scenario.sides[0].force[0].facing).toBe(12)
    expect(scenario.sides[1].force[0].facing).toBe(12)
    expect(scenario.sides[0].force[0].position.y).toBeLessThan(scenario.sides[1].force[0].position.y)
  })

  it('states the admiral fleet initiative, which the tactical roll cannot take', () => {
    const engagement = planEngagement(hex(0, 0), 'nebula', esu, nac, campaignRng(45))!
    expect(fleetInitiativeModifier(engagement.forces[0])).toBe(1)
    expect(fleetInitiativeModifier(engagement.forces[1])).toBe(-1)
    const scenario = engagementScenario(engagement)
    expect(scenario.briefing).toContain('+1 fleet initiative')
    expect(scenario.briefing).toContain('gas and dust cloud')
  })

  it('bans the three systems the campaign bars from ship design', () => {
    const engagement = planEngagement(hex(0, 0), 'standard', esu, nac, campaignRng(46))!
    const setup = engagementSetup(engagement)
    expect(setup.seed).toBe(engagement.seed)
    expect(setup.bannedSystems).toEqual([...CAMPAIGN_BANNED_SYSTEMS])
    expect(setup.bannedSystems).toEqual(['reflex-field', 'cloaking-field', 'wave-gun'])
    expect(setup.customScenario?.id).toBe(engagement.id)
  })

  it('opens in the real rules engine', () => {
    const engagement = planEngagement(hex(3, 0), 'standard', esu, nac, campaignRng(47))!
    const scenario = engagementScenario(engagement)
    setEmbeddedScenario(scenario)
    try {
      const game = startScenario(scenario.id, { seed: engagement.seed })
      expect(game.ships).toHaveLength(3)
      expect(game.ships.filter((ship) => ship.side === 'a')).toHaveLength(2)
      expect(game.sides.map((side) => side.name)).toEqual([esu.name, nac.name])
      expect(game.turn).toBe(1)
    } finally {
      setEmbeddedScenario(null)
    }
  })
})

// ---------------------------------------------------------------------------
// The planetary phase (6.4)
// ---------------------------------------------------------------------------

function colony(over: Partial<Colony> = {}): Colony {
  return {
    id: 'c1',
    hex: hex(0, 0),
    owner: 'esu',
    planetType: 'terran',
    planetTrait: 'none',
    population: 10,
    subjectPopulation: 0,
    factories: 2,
    pdu: 0,
    advancedPdu: 0,
    planetShield: false,
    shipyard: false,
    commandPost: true,
    underSiege: false,
    productionBlockedPhases: 0,
    buildingBlocked: false,
    ...over,
  }
}

describe('the planetary phase (6.4)', () => {
  it('takes starships and the command post off a besieged colony, and nothing else', () => {
    const besieged = siegeStatus(colony(), 1)
    expect(besieged).toEqual({
      underSiege: true,
      canBuildStarships: false,
      canBuildDefences: true,
      generatesRp: true,
      actsAsCommandPost: false,
    })
    expect(siegeStatus(colony(), 0).canBuildStarships).toBe(true)
    expect(siegeStatus(colony(), 0).actsAsCommandPost).toBe(true)
  })

  it('turns a conquered colony into subject population that produces nothing for a phase', () => {
    const taken = captureColony(colony({ population: 12, underSiege: true }), 'nac')
    expect(taken.owner).toBe('nac')
    expect(taken.subjectPopulation).toBe(12)
    expect(taken.productionBlockedPhases).toBe(1)
    expect(taken.underSiege).toBe(false)
  })

  it('costs its owner 75% of a subject colony industrial output', () => {
    expect(SUBJECT_POPULATION_OUTPUT_PENALTY).toBe(0.75)
    expect(subjectPopulationCost(800)).toBe(600)
  })

  it('converts subjects at 100 RP a million', () => {
    expect(INTEGRATION_COST_PER_MILLION).toBe(100)
    expect(integrationCost(4)).toBe(400)
    const taken = captureColony(colony({ population: 6 }), 'nac')
    expect(integrate(taken, 4, 400)).toEqual({ converted: 4, spent: 400 })
    expect(taken.subjectPopulation).toBe(2)
    // A programme can only convert what it can pay for.
    expect(integrate(taken, 2, 150).converted).toBe(1)
  })

  it('removes a million population per ortillery battery per turn', () => {
    const world = colony({ population: 10, subjectPopulation: 10 })
    expect(orbitalBombardment(world, 3)).toEqual({ killed: 3 })
    expect(world.population).toBe(7)
    expect(world.subjectPopulation).toBe(7)
    expect(orbitalBombardment(world, 100).killed).toBe(7)
    expect(world.population).toBe(0)
  })

  it('is stopped by an intact planet shield', () => {
    const shielded = colony({ planetShield: true })
    expect(orbitalBombardment(shielded, 5)).toEqual({ killed: 0, refusedReason: 'planet shield intact' })
    expect(shielded.population).toBe(10)
  })

  it('gates colonisation on planet type, trait and technology', () => {
    expect(canColonise('gas-giant', 'none', []).allowed).toBe(false)
    expect(canColonise('anomaly', 'none', []).allowed).toBe(false)
    expect(canColonise('barren', 'none', []).allowed).toBe(false)
    expect(canColonise('barren', 'none', ['controlled-environment']).allowed).toBe(true)
    expect(canColonise('terran', 'hazardous', []).stabilisation).toBe(HAZARDOUS_STABILISATION_RP)
    expect(HAZARDOUS_STABILISATION_RP).toBe(500)
  })

  it('lands a million colonists per transport', () => {
    const founded = colonise(
      { colonyId: 'c2', hex: hex(1, 0), owner: 'esu', planetType: 'sub-terran', planetTrait: 'none', transports: 4 },
      [],
      0,
    )
    expect(founded.colony?.population).toBe(4)
    expect(founded.spent).toBe(0)

    const unaffordable = colonise(
      { colonyId: 'c3', hex: hex(2, 0), owner: 'esu', planetType: 'terran', planetTrait: 'hazardous', transports: 4 },
      [],
      200,
    )
    expect(unaffordable.colony).toBeNull()
    expect(unaffordable.refusedReason).toContain('500')
  })

  it('repulses an assault while the defences or the orbit still hold', () => {
    const defended = colony({ pdu: 2 })
    expect(resolveAssault(defended, { attacker: 'nac', marineParties: 4, defendingWarshipsInSystem: 0 }).outcome).toBe(
      'repulsed',
    )
    expect(
      resolveAssault(colony(), { attacker: 'nac', marineParties: 4, defendingWarshipsInSystem: 2 }).reason,
    ).toContain('orbit')
    expect(resolveAssault(colony(), { attacker: 'nac', marineParties: 0, defendingWarshipsInSystem: 0 }).reason).toContain(
      'no troops',
    )
    expect(resolveAssault(colony({ planetShield: true }), { attacker: 'nac', marineParties: 4, defendingWarshipsInSystem: 0 }).outcome).toBe('repulsed')
  })

  it('conquers a colony whose orbit is clear and whose works are down', () => {
    const world = colony({ population: 8 })
    const result = resolveAssault(world, { attacker: 'nac', marineParties: 2, defendingWarshipsInSystem: 0 })
    expect(result.outcome).toBe('conquered')
    expect(world.owner).toBe('nac')
    expect(world.subjectPopulation).toBe(8)
  })

  it('marks sieges, then bombards, then lands', () => {
    const worlds = [colony({ id: 'c1', population: 9 }), colony({ id: 'c2' })]
    const result = planetaryPhase(worlds, {
      enemyWarships: { c1: 3 },
      bombard: [{ colonyId: 'c1', batteries: 2 }],
      assault: [{ colonyId: 'c1', attacker: 'nac', marineParties: 2, defendingWarshipsInSystem: 0 }],
    })
    expect(result.sieges).toHaveLength(2)
    expect(result.sieges[0].status.underSiege).toBe(true)
    expect(result.sieges[0].status.canBuildStarships).toBe(false)
    expect(worlds[1].underSiege).toBe(false)
    expect(result.bombardments[0].result.killed).toBe(2)
    expect(result.assaults[0].result.outcome).toBe('conquered')
    expect(worlds[0].owner).toBe('nac')
    // The siege ends with the capture: the besiegers own the place now.
    expect(worlds[0].underSiege).toBe(false)
    // The bombardment ran before the landing, so the subjects are the survivors.
    expect(worlds[0].subjectPopulation).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// Admin (6.3, 6.4) and production (6.5)
// ---------------------------------------------------------------------------

describe('the admin phase', () => {
  it('rolls one unrest die per full 5M of subject population', () => {
    const quiet = colony({ subjectPopulation: 4 })
    const rng = campaignRng(61)
    expect(unrestCheck(quiet, rng).dice).toHaveLength(0)
    expect(rng.cursor).toBe(0)

    const restless = colony({ subjectPopulation: 12 })
    expect(unrestCheck(restless, campaignRng(61)).dice).toHaveLength(2)
  })

  it('costs 1d6 x 100 RP per 1 rolled, and blocks building next phase', () => {
    const restless = colony({ subjectPopulation: 10 })
    // First die 1 (a disturbance), its cost die 3, then a quiet 5.
    const result = unrestCheck(restless, campaignRng(seedYielding([1, 3, 5])))
    expect(result.dice).toEqual([1, 5])
    expect(result.disturbances).toBe(1)
    expect(result.cost).toBe(300)
    expect(result.buildingBlocked).toBe(true)
    expect(restless.buildingBlocked).toBe(true)
  })

  it('repairs systems between turns, but hull only at a shipyard', () => {
    const rested = { id: 's1', foughtThisTurn: false, systemDamage: 3, hullDamage: 5, armourDamage: 2, coreDamage: 1, atShipyard: false }
    expect(repairBetweenTurns(rested).systemsRepaired).toBe(3)
    expect(rested.systemDamage).toBe(0)
    expect(rested.hullDamage).toBe(5)

    const fought = { id: 's2', foughtThisTurn: true, systemDamage: 3, hullDamage: 5, armourDamage: 2, coreDamage: 1, atShipyard: true }
    const repaired = repairBetweenTurns(fought)
    expect(repaired.systemsRepaired).toBe(0)
    expect(fought.systemDamage).toBe(3)
    expect(fought.hullDamage).toBe(0)
    expect(fought.armourDamage).toBe(0)
    expect(fought.coreDamage).toBe(0)
  })

  it('checks unrest only where there are subjects to be restless', () => {
    const worlds = [colony({ id: 'c1', subjectPopulation: 10 }), colony({ id: 'c2', subjectPopulation: 0 })]
    const result = adminPhase(worlds, [], campaignRng(71))
    expect(result.unrest.map((entry) => entry.colonyId)).toEqual(['c1'])
  })
})

describe('the production phase (6.5)', () => {
  it('gives a captured colony nothing for one phase, then lets it produce', () => {
    const taken = captureColony(colony(), 'nac')
    const first = productionPhase([taken])[0]
    expect(first.produces).toBe(false)
    expect(taken.productionBlockedPhases).toBe(0)

    const second = productionPhase([taken])[0]
    expect(second.produces).toBe(true)
  })

  it('clears an unrest building block after the phase it blocked', () => {
    const restless = colony({ buildingBlocked: true })
    expect(productionPhase([restless])[0].canBuildDefences).toBe(false)
    expect(restless.buildingBlocked).toBe(false)
    expect(productionPhase([restless])[0].canBuildDefences).toBe(true)
  })

  it('does not let a besieged colony build starships', () => {
    const besieged = colony({ underSiege: true })
    const eligibility = productionPhase([besieged])[0]
    expect(eligibility.canBuildStarships).toBe(false)
    expect(eligibility.canBuildDefences).toBe(true)
    expect(eligibility.produces).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Research (8)
// ---------------------------------------------------------------------------

describe('the research tables (8)', () => {
  it('prices ship speed exactly as tabled', () => {
    const costs = (['speed-3', 'speed-4', 'speed-5', 'speed-6', 'speed-7', 'speed-8'] as TechId[]).map(
      (id) => techById(id).cost,
    )
    expect(costs).toEqual([15, 40, 55, 65, 75, 80])
    expect(effectiveCost('speed-4', ['speed-3'])).toBe(30)
    expect(effectiveCost('speed-5', ['speed-4'])).toBe(40)
    expect(effectiveCost('speed-6', ['speed-5'])).toBe(50)
    expect(effectiveCost('speed-7', ['speed-6'])).toBe(60)
    expect(effectiveCost('speed-8', ['speed-7'])).toBe(70)
    // The discount is for the step below, not for any step at all.
    expect(effectiveCost('speed-8', ['speed-3'])).toBe(80)
  })

  it('prices weapons and technology exactly as tabled', () => {
    expect(technologiesIn('weapons').map((tech) => tech.cost)).toEqual([25, 55, 130])
    expect(effectiveCost('advanced-pdu', ['pdu'])).toBe(40)
    expect(effectiveCost('planet-shield', ['advanced-pdu'])).toBe(130)

    expect(effectiveCost('controlled-environment', [])).toBe(25)
    expect(effectiveCost('industrial', [])).toBe(25)
    expect(effectiveCost('improved-industrial', [])).toBe(55)
    expect(effectiveCost('improved-industrial', ['industrial'])).toBe(40)
    expect(effectiveCost('robotic-industry', [])).toBe(100)
    expect(effectiveCost('robotic-industry', ['industrial'])).toBe(85)
  })

  it('charges a traded technology 25% and a salvaged one half', () => {
    expect(acquisitionCost('planet-shield', [], 'trade')).toBe(33)
    expect(acquisitionCost('planet-shield', [], 'salvage')).toBe(65)
    // The discount a predecessor earns is applied before the fraction is taken.
    expect(acquisitionCost('advanced-pdu', [], 'trade')).toBe(14)
    expect(acquisitionCost('advanced-pdu', ['pdu'], 'trade')).toBe(10)
    expect(acquisitionCost('advanced-pdu', ['pdu'], 'salvage')).toBe(20)
  })

  it('raises the FTL rate to the best step held, capped at 8', () => {
    expect(ftlRate([])).toBe(2)
    expect(ftlRate(['speed-6'])).toBe(6)
    expect(ftlRate(['speed-3', 'speed-4', 'speed-8'])).toBe(8)
  })

  it('gates the price schedule on the technology it names', () => {
    expect(meetsItemRequirement('factory', [])).toBe(false)
    expect(meetsItemRequirement('factory', ['industrial'])).toBe(true)
    expect(meetsItemRequirement('colony-transport', [])).toBe(true)
  })

  it('pays in full from a single phase pool, in the order asked', () => {
    const resolution = resolveResearch([], [{ techId: 'speed-3' }, { techId: 'speed-4' }, { techId: 'pdu' }], 50)
    // 15 for the first step, then 30 because the first is now held: 45 of 50.
    expect(resolution.spent).toBe(45)
    expect(resolution.remaining).toBe(5)
    expect(resolution.acquired.map((entry) => entry.cost)).toEqual([15, 30])
    expect(resolution.refused).toEqual([{ techId: 'pdu', reason: 'costs 25 RP; 5 RP pooled' }])
    expect(resolution.known).toEqual(['speed-3', 'speed-4'])
  })

  it('refuses to sell a faction what it already knows', () => {
    const resolution = resolveResearch(['pdu'], [{ techId: 'pdu' }], 1000)
    expect(resolution.spent).toBe(0)
    expect(resolution.refused[0].reason).toBe('already known')
  })
})
