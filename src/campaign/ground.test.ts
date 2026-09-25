/**
 * The ground under the campaign: More Thrust's Full Thrust / Dirtside II
 * interface (pp. 15–18) read onto colonies and fleets, and a landing fought
 * on the Dirtside table and folded back (rules reading 2).
 *
 * The Marine contingent's figures are quoted from p. 17–18 of More Thrust;
 * the garrison is this repository's reading, and the tests hold it to what
 * README says it is.
 */

import { describe, expect, it } from 'vitest'
import { aiPlay } from '../dirtside/table/ai'
import { inDeploymentZone } from '../dirtside/table/game'
import { validateSetup } from '../dirtside/table/setupCheck'
import { depthInside, insideShape } from '../dirtside/table/terrain'
import { newStream } from '../dirtside/dice'
import { designById } from '../data/ships'
import type { ShipDesign } from '../engine/types'
import { applyMove, colonyById, createCampaign, journalEntry, taskForceById } from './campaign'
import { contingentTeams, garrisonOf, landingForce, landingSetup, landingShips, settlementStyleFor, sheafsOf, transitLosses } from './ground'
import { generateStarMap, systemAt } from './map'
import { CAMPAIGN_BANNED_SYSTEMS } from './turn'
import type { CampaignJournalEntry, CampaignMove, CampaignSetup, CampaignShip, CampaignState, Colony, Hex, StarMap } from './types'

const frigate = designById('intro-frigate')!
const heavyCruiser = designById('intro-heavy-cruiser')!
const withMass = (mass: number): ShipDesign => ({ ...frigate, mass })
const ship = (id: string, design: ShipDesign, patch: Partial<CampaignShip> = {}): CampaignShip => ({ id, name: id, designId: design.id, hullDamage: 0, armourDamage: [], coreDamage: [], systemsDamaged: [], foughtThisTurn: false, expendables: {}, ...patch })

const colonyWith = (patch: Partial<Colony> = {}): Colony => ({
  id: 'c1',
  name: 'Haven',
  owner: 'esu',
  systemId: 's1',
  bodyId: 'b1',
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
  stabilised: true,
  buildingBlocked: false,
  buildQueue: [],
  ...patch,
})

describe('Marine contingents (More Thrust pp. 17–18)', () => {
  it('holds mass × 4 CS of teams at 16 CS, frigates and larger, matching the printed contingents', () => {
    // Frigate 10, light cruiser 22, escort cruiser 26, heavy cruiser 32, battlecruiser 40, battleship 48, light carrier 70.
    expect([10, 22, 26, 32, 40, 48, 70].map((m) => contingentTeams(withMass(m)))).toEqual([2, 5, 6, 8, 10, 12, 17])
    expect(contingentTeams(withMass(8))).toBe(0)
    expect(contingentTeams({ ...frigate, weapons: [] })).toBe(0)
    // A merchant hull carries no Marines and fires no sheafs, whatever its guns.
    expect(contingentTeams({ ...withMass(60), group: 'civilian' })).toBe(0)
    expect(sheafsOf({ ...withMass(60), group: 'civilian' })).toBe(0)
  })

  it('fires one sheaf from an escort, two from a cruiser, three from a capital ship (13.4 classes)', () => {
    expect([8, 10, 44, 45, 90, 91].map((m) => sheafsOf(withMass(m)))).toEqual([0, 1, 1, 2, 2, 3])
  })

  it('lands powered teams in squads, odd teams as specialists, in platoons of four with the largest ship commanding', () => {
    const force = landingForce(landingShips([ship('dart', frigate), ship('endeavour', heavyCruiser), ship('dirk', frigate)]))
    // 88 × 4 / 16 = 22 teams, and 5 for each frigate: 32 teams, eight platoons.
    expect(force.units).toHaveLength(8)
    expect(force.units[0]!.commandUnit).toBe(true)
    expect(force.units.slice(1).every((u) => !u.commandUnit)).toBe(true)
    const elements = force.units.flatMap((u) => u.elements)
    expect(elements).toHaveLength(32)
    expect(elements.every((e) => e.infantry?.troops === 'powered')).toBe(true)
    expect(elements.slice(0, 22).every((e) => force.landed[e.id] === 'endeavour' && e.infantry!.team === 'rifle')).toBe(true)
    // Each frigate's fifth team is a specialist: the first an observer, the next an anti-armour team.
    expect(elements.filter((e) => e.infantry!.team !== 'rifle').map((e) => [force.landed[e.id], e.infantry!.team])).toEqual([
      ['dart', 'observer'],
      ['dirk', 'anti-armour'],
    ])
    expect(Object.keys(force.landed)).toHaveLength(32)
  })

  it('puts a ship’s losses on the ground and in transit against its contingent', () => {
    expect(landingShips([ship('d', frigate, { marinesLost: 3 })])[0]!.teams).toBe(2)
    expect(landingShips([ship('d', frigate, { marinesLost: 9 })])[0]!.teams).toBe(0)
  })
})

describe('losses in transit (More Thrust p. 18)', () => {
  it('gives each team aboard a chance equal to the share of hull lost, and rolls damage only once', () => {
    expect(transitLosses(ship('d', heavyCruiser), heavyCruiser, newStream(1))).toEqual({ lost: 0, chance: 0 })
    // 13 of 26 hull boxes gone: each of 22 teams at 50%.
    let lost = 0
    for (let seed = 1; seed <= 200; seed++) {
      const r = transitLosses(ship('e', heavyCruiser, { hullDamage: 13 }), heavyCruiser, newStream(seed))
      expect(r.chance).toBeCloseTo(0.5, 9)
      lost += r.lost
    }
    expect(lost / (200 * 22)).toBeGreaterThan(0.45)
    expect(lost / (200 * 22)).toBeLessThan(0.55)
    // Rolled at 13 already, now at 20: the new 7 over the 13 left.
    expect(transitLosses(ship('e', heavyCruiser, { hullDamage: 20, marineLossRolledAt: 13 }), heavyCruiser, newStream(3)).chance).toBeCloseTo(7 / 13, 9)
    expect(transitLosses(ship('e', heavyCruiser, { hullDamage: 13, marineLossRolledAt: 13 }), heavyCruiser, newStream(3))).toEqual({ lost: 0, chance: 0 })
  })
})

describe('the garrison (reading)', () => {
  it('stands dug-in PDU platoons, dug-in tanks for advanced PDUs, and a militia team a loyal million', () => {
    const { units, roles } = garrisonOf(colonyWith({ defences: { pdu: 2, advancedPdu: 1, planetShield: false }, population: { loyal: 12, subject: 5 } }))
    expect(units.map((u) => u.name)).toEqual(['PDU 1', 'PDU 2', 'Advanced PDU 1', 'Haven Militia 1st Company', 'Haven Militia 2nd Company', 'Haven Militia 3rd Company'])
    expect(units[0]!.commandUnit).toBe(true)
    expect(units[0]!.elements.map((e) => e.infantry!.team)).toEqual(['rifle', 'rifle', 'rifle', 'apsw', 'anti-armour'])
    expect(units[0]!.elements.every((e) => e.dugIn && e.infantry!.troops === 'line')).toBe(true)
    expect(units[2]!.quality).toBe('veteran')
    expect(units[2]!.elements.every((e) => e.dugIn && e.vehicle?.name === 'Medium Battle Tank')).toBe(true)
    expect(units.slice(3).map((u) => u.elements.length)).toEqual([5, 5, 2])
    expect(units.slice(3).every((u) => u.quality === 'green')).toBe(true)
    expect(roles).toEqual({ 'pdu-1': 'pdu', 'pdu-2': 'pdu', 'apdu-1': 'advanced-pdu', 'militia-1': 'militia', 'militia-2': 'militia', 'militia-3': 'militia' })
    expect(garrisonOf(colonyWith({ population: { loyal: 60, subject: 0 } })).units.flatMap((u) => u.elements)).toHaveLength(20)
    expect(garrisonOf(colonyWith({ population: { loyal: 0, subject: 8 } })).units).toHaveLength(0)
  })

  it('sets up a table the p. 17 quotas accept, everyone in their deployment zone, with the ships overhead', () => {
    for (const seed of [1, 2, 3, 40, 99]) {
      const plan = landingSetup({
        seed,
        name: 'test',
        colony: colonyWith({ defences: { pdu: 3, advancedPdu: 2, planetShield: false }, population: { loyal: 14, subject: 0 } }),
        ships: landingShips([ship('endeavour', heavyCruiser), ship('dart', frigate)]),
        attackerName: 'Terra Marines',
        defenderName: 'Haven garrison',
        computers: ['south'],
      })
      expect(validateSetup(plan.setup)).toEqual([])
      expect(plan.setup).toMatchObject({ battle: 'attack-defence', attacker: 'north', turnLimit: 8, aiSides: ['south'] })
      for (const side of plan.setup.sides) for (const unit of side.units) for (const el of unit.elements) expect(inDeploymentZone(plan.setup, side.id, el.position!)).toBe(true)
      expect(plan.setup.orbital).toEqual([{ side: 'north', ships: [{ id: 'endeavour', name: 'endeavour', sheafs: 2, ortillery: 0 }, { id: 'dart', name: 'dart', sheafs: 1, ortillery: 0 }] }])
      const town = plan.setup.table.terrain.find((f) => f.terrain === 'urban' && f.label === 'Haven')!
      expect(town).toBeDefined()
      // A generated settlement, not a bare rectangle: real buildings and streets stand inside it (BRIEF-TERRAIN).
      const pieces = plan.setup.table.terrain.filter((f) => f.partOf === town.id)
      expect(pieces.some((f) => f.terrain === 'building')).toBe(true)
      expect(pieces.some((f) => f.terrain === 'road')).toBe(true)
      for (const f of pieces) for (const p of (f.shape as { points: { x: number; y: number }[] }).points) expect(insideShape(p, town.shape)).toBe(true)
      // A defender in the town stands within its first inch, where it can see out and be seen (p. 20).
      for (const el of plan.setup.sides[1].units.flatMap((u) => u.elements)) if (insideShape(el.position!, town.shape)) expect(depthInside(el.position!, town.shape)).toBeLessThanOrEqual(1)
    }
  })

  it("styles the colony's town from its population and factories: a thin outpost a village, a settled world a town, a heavily populated one a city", () => {
    expect(settlementStyleFor(colonyWith({ population: { loyal: 2, subject: 0 }, factories: 0 }))).toBe('village')
    expect(settlementStyleFor(colonyWith({ population: { loyal: 10, subject: 0 }, factories: 2 }))).toBe('town')
    expect(settlementStyleFor(colonyWith({ population: { loyal: 60, subject: 0 }, factories: 2 }))).toBe('city')
    expect(settlementStyleFor(colonyWith({ population: { loyal: 2, subject: 0 }, factories: 8 }))).toBe('city')
    // A subject population still builds the place up, whoever it now flies for.
    expect(settlementStyleFor(colonyWith({ population: { loyal: 2, subject: 10 }, factories: 0 }))).toBe('town')
  })

  it('finds every unit its own ground however big the fleet or the garrison', () => {
    const tender = withMass(292)
    const plan = landingSetup({
      seed: 7,
      name: 'big',
      colony: colonyWith({ defences: { pdu: 40, advancedPdu: 5, planetShield: false }, population: { loyal: 100, subject: 0 } }),
      ships: [1, 2, 3, 4].map((n) => ({ ship: ship(`t${n}`, tender), design: tender, teams: contingentTeams(tender) })),
      attackerName: 'Marines',
      defenderName: 'Garrison',
      computers: [],
    })
    // Four mass-292 ships: 73 teams each, 73 platoons; 45 platoons of PDUs and four militia companies.
    expect(plan.setup.sides[0].units).toHaveLength(73)
    expect(plan.setup.sides[1].units).toHaveLength(49)
    const seen = new Set<string>()
    for (const side of plan.setup.sides)
      for (const unit of side.units)
        for (const el of unit.elements) {
          const key = `${el.position!.x.toFixed(3)},${el.position!.y.toFixed(3)}`
          expect(seen.has(key)).toBe(false)
          seen.add(key)
          expect(inDeploymentZone(plan.setup, side.id, el.position!)).toBe(true)
        }
  })
})

// ---------------------------------------------------------------------------
// A landing in a campaign
// ---------------------------------------------------------------------------

const hex = (q: number, r: number): Hex => ({ q, r })
const STARS = [hex(0, 0), hex(2, 0), hex(0, 2), hex(-2, 1), hex(3, -2)]

function plainHome(map: StarMap, at: Hex): boolean {
  const system = systemAt(map, at)
  const home = system?.bodies.find((b) => b.type === 'terran')
  return !!system && system.feature === 'standard' && home !== undefined && home.trait === 'none'
}

const SEED = (() => {
  for (let seed = 1; seed < 200_000; seed++) {
    const map = generateStarMap({ seed, cursor: 0 }, { starHexes: [...STARS], radius: 4 })
    if (plainHome(map, hex(0, 0)) && plainHome(map, hex(2, 0))) return seed
  }
  throw new Error('no seed')
})()

function campaign(rulesVersion?: number): CampaignSetup {
  return {
    seed: SEED,
    ...(rulesVersion === undefined ? {} : { rulesVersion }),
    starHexes: STARS,
    radius: 4,
    players: [
      { id: 'terra', name: 'Terra', faction: 'New Anglian Confederation', home: hex(0, 0), startingShips: [{ designId: 'intro-heavy-cruiser', name: 'Endeavour' }, { designId: 'intro-frigate', name: 'Dart' }], startingTransports: 0 },
      { id: 'esu', name: 'Eurasia', faction: 'Eurasian Solar Union', home: hex(2, 0), startingShips: [{ designId: 'intro-frigate', name: 'Storozhevoy' }], startingTransports: 0 },
    ],
    bannedSystems: [...CAMPAIGN_BANNED_SYSTEMS],
  }
}

class Console {
  readonly state: CampaignState
  readonly moves: CampaignJournalEntry[] = []
  constructor(readonly setup: CampaignSetup) {
    this.state = createCampaign(setup)
  }
  play(move: CampaignMove): string | undefined {
    this.moves.push(journalEntry(this.state, this.moves.length + 1, move))
    return applyMove(this.state, move).refused
  }
  must(move: CampaignMove): void {
    const refused = this.play(move)
    if (refused) throw new Error(`${move.kind} refused: ${refused}`)
  }
  log(): string {
    return this.state.log.map((l) => l.text).join('\n')
  }
}

/** Terra's fleet over Eurasia's home in the planetary phase, Eurasia's ships gone. */
function overEurasia(rulesVersion = 2, colony: Partial<Colony> = {}): Console {
  const c = new Console(campaign(rulesVersion))
  c.state.taskForces = c.state.taskForces.filter((tf) => tf.owner === 'terra')
  taskForceById(c.state, 'terra-tf-1')!.hex = hex(2, 0)
  Object.assign(colonyById(c.state, 'esu-home')!, colony)
  c.state.phase = 'planetary'
  return c
}

const assault: CampaignMove = { kind: 'assault', player: 'terra', colony: 'esu-home', taskForce: 'terra-tf-1' }

describe('a landing (rules reading 2)', () => {
  it('stamps new campaigns with reading 2 only when asked, so older files replay as they were played', () => {
    expect(createCampaign(campaign()).rulesVersion).toBe(1)
    expect(createCampaign(campaign(2)).rulesVersion).toBe(2)
    const old = overEurasia(1)
    old.must(assault)
    expect(old.state.landings).toHaveLength(0)
    expect(colonyById(old.state, 'esu-home')!.owner).toBe('terra')
  })

  it('turns an assault into a landing waiting on the Dirtside table, and holds the phase until it is fought', () => {
    const c = overEurasia(2, { defences: { pdu: 1, advancedPdu: 0, planetShield: false } })
    c.must(assault)
    expect(c.state.landings).toHaveLength(1)
    const landing = c.state.landings[0]!
    expect(landing).toMatchObject({ id: `landing-1-esu-home`, attacker: 'terra', defender: 'esu', taskForceId: 'terra-tf-1', resolved: false })
    // 22 teams from the heavy cruiser and 5 from the frigate.
    expect(Object.keys(landing.landed)).toHaveLength(27)
    expect(landing.garrison).toMatchObject({ 'pdu-1': 'pdu', 'militia-1': 'militia', 'militia-2': 'militia' })
    expect(c.log()).toMatch(/lands 27 Marine teams on .* in 7 platoons, against Eurasia's garrison of 3, with 2 ships overhead/)
    expect(c.play({ kind: 'end-phase', player: null })).toMatch(/1 landing still to fight/)
    expect(c.play(assault)).toMatch(/already been made/)
  })

  it('lands a task force once a turn, not on two colonies of one system at the same time', () => {
    const c = overEurasia(2, { defences: { pdu: 1, advancedPdu: 0, planetShield: false } })
    const home = colonyById(c.state, 'esu-home')!
    c.state.colonies.push({ ...structuredClone(home), id: 'esu-second', name: `${home.name} Second` })
    c.must(assault)
    expect(c.play({ ...assault, colony: 'esu-second' })).toMatch(/already landed its troops this turn, on /)
    expect(c.state.landings).toHaveLength(1)
  })

  it('refuses a landing through an intact planet shield, and one with no Marines aboard', () => {
    expect(overEurasia(2, { defences: { pdu: 0, advancedPdu: 0, planetShield: true } }).play(assault)).toMatch(/planet shield is intact/)
    const c = overEurasia(2)
    for (const s of taskForceById(c.state, 'terra-tf-1')!.ships) s.marinesLost = 99
    expect(c.play(assault)).toMatch(/no Marines to land, and no ground unit aboard that can come down from orbit \(More Thrust p\. 17, Dirtside p\. 43\)/)
  })

  it('takes a colony nobody defends at once', () => {
    const c = overEurasia(2, { population: { loyal: 0, subject: 6 } })
    c.must(assault)
    expect(c.state.landings).toHaveLength(0)
    expect(colonyById(c.state, 'esu-home')!.owner).toBe('terra')
    expect(c.log()).toMatch(/nobody stands against them/)
  })

  it('rolls transit losses once as the troops go down, and replaces the Marines at a friendly yard', () => {
    const c = overEurasia(2)
    const endeavour = taskForceById(c.state, 'terra-tf-1')!.ships[0]!
    endeavour.hullDamage = 13
    c.must(assault)
    expect(c.log()).toMatch(/Endeavour has lost 50% of its hull: \d+ Marine teams? lost in transit \(More Thrust p\. 18\)/)
    expect(endeavour.marineLossRolledAt).toBe(13)
    const lost = endeavour.marinesLost ?? 0
    expect(Object.values(c.state.landings[0]!.landed).filter((id) => id === endeavour.id)).toHaveLength(22 - lost)
  })

  it('folds the battle back: the ground to the winner, Marines struck off, a broken PDU lost, and the journal replays', () => {
    let taken = 0
    let held = 0
    for (const pdu of [0, 2, 4]) {
      const c = overEurasia(2, { defences: { pdu, advancedPdu: pdu > 0 ? 1 : 0, planetShield: false } })
      c.must(assault)
      const landing = c.state.landings[0]!
      const game = aiPlay(landing.setup, { seed: pdu + 1 })
      expect(game.result).not.toBeNull()
      c.must({ kind: 'resolve-landing', landing: landing.id, savedBattle: JSON.stringify({ version: 1, setup: landing.setup, journal: game.journal }) })
      expect(landing.resolved).toBe(true)
      const colony = colonyById(c.state, 'esu-home')!
      const dead = Object.entries(landing.landed).filter(([id]) => game.elements[id]!.destroyed)
      const struck = taskForceById(c.state, 'terra-tf-1')!.ships.reduce((sum, s) => sum + (s.marinesLost ?? 0), 0)
      expect(struck).toBe(dead.length)
      if (game.result!.winner === 'north') {
        taken += 1
        expect(landing.winner).toBe('terra')
        expect(colony).toMatchObject({ owner: 'terra', capturedIdlePhases: 1, defences: { pdu: 0, advancedPdu: 0 } })
      } else {
        held += 1
        expect(colony.owner).toBe('esu')
        expect(colony.defences.pdu).toBeLessThanOrEqual(pdu)
      }
      expect(c.play({ kind: 'resolve-landing', landing: landing.id, savedBattle: '{}' })).toMatch(/has been fought/)
      // The same start and the same moves come to the same campaign: the fold-back is deterministic.
      const again = overEurasia(2, { defences: { pdu, advancedPdu: pdu > 0 ? 1 : 0, planetShield: false } })
      for (const entry of c.moves) again.play(entry.move)
      expect(JSON.stringify(again.state)).toBe(JSON.stringify(c.state))
    }
    expect(taken + held).toBe(3)
  })

  it('refuses a battle file from another landing, and reads an unfinished battle by who holds the ground', () => {
    const c = overEurasia(2)
    c.must(assault)
    const landing = c.state.landings[0]!
    expect(c.play({ kind: 'resolve-landing', landing: landing.id, savedBattle: JSON.stringify({ setup: { ...landing.setup, seed: landing.seed + 1 }, journal: [] }) })).toMatch(/seed differs/)
    expect(c.play({ kind: 'resolve-landing', landing: landing.id, savedBattle: 'not json' })).toMatch(/not JSON/)
    // Nothing fought at all: the garrison still holds every objective.
    c.must({ kind: 'resolve-landing', landing: landing.id, savedBattle: JSON.stringify({ setup: landing.setup, journal: [] }) })
    expect(landing.winner).toBe('esu')
    expect(colonyById(c.state, 'esu-home')!.owner).toBe('esu')
    expect(c.log()).toMatch(/the garrison holds/)
  })
})
