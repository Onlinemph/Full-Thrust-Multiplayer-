/**
 * The campaign as a game: setup, the move journal, the eight-phase turn and
 * the bridge to the table (campaign.md).
 *
 * Every figure asserted here is quoted from `docs/rules/campaign.md`: the
 * price schedule, the production arithmetic, the plot lead a force without an
 * admiral is held to, the meeting matrix. The battle is fought by the
 * computers and its end state checked against the campaign's hulls.
 */

import { describe, expect, it } from 'vitest'
import { applyAction, type GameAction } from '../engine/actions'
import { buildGame, type SavedGame } from '../data/savedGame'
import { designById } from '../data/ships'
import { autoplay } from '../engine/playtest/autoplay'
import {
  BATTLE_SIDE_IDS,
  CAMPAIGN_BATTLE_TURNS,
  PHASE_GUIDE,
  applyMove,
  battleSetup,
  colonyById,
  commandPostsOf,
  createCampaign,
  journalEntry,
  playerById,
  plotLeadOf,
  replayCampaign,
  researchBudgetOf,
  systemById,
  taskForceById,
} from './campaign'
import { generateStarMap, hexKey, systemAt } from './map'
import { CAMPAIGN_BANNED_SYSTEMS, phasesForTurn } from './turn'
import type {
  CampaignJournalEntry,
  CampaignMove,
  CampaignPhase,
  CampaignSetup,
  CampaignState,
  Hex,
  PurchaseItem,
  StarMap,
} from './types'

const hex = (q: number, r: number): Hex => ({ q, r })

// Two homes two parsecs apart, a third star two parsecs from the first.
const STARS = [hex(0, 0), hex(2, 0), hex(0, 2), hex(-2, 1), hex(3, -2)]
const RADIUS = 4

/** The first seed whose map suits the test, searched the way intel.test.ts searches for dice. */
function seedWhere(pred: (map: StarMap) => boolean, stars: readonly Hex[], radius: number): number {
  for (let seed = 1; seed < 200_000; seed++) {
    const map = generateStarMap({ seed, cursor: 0 }, { starHexes: [...stars], radius })
    if (pred(map)) return seed
  }
  throw new Error('no seed gives that map')
}

function plainHome(map: StarMap, at: Hex): boolean {
  const system = systemAt(map, at)
  if (!system || system.feature !== 'standard') return false
  const home = system.bodies.find((b) => b.type === 'terran')
  return home !== undefined && home.trait === 'none'
}

function colonisable(map: StarMap, at: Hex): boolean {
  const system = systemAt(map, at)
  if (!system || system.feature === 'nebula') return false
  return system.bodies.some(
    (b) => (b.type === 'terran' || b.type === 'sub-terran' || b.type === 'minimal-terran') && b.trait !== 'hazardous',
  )
}

const SEED = seedWhere(
  (map) => plainHome(map, hex(0, 0)) && plainHome(map, hex(2, 0)) && colonisable(map, hex(0, 2)),
  STARS,
  RADIUS,
)

const TERRA_FLEET = [
  { designId: 'intro-heavy-cruiser', name: 'Endeavour' },
  { designId: 'intro-frigate', name: 'Dart' },
  { designId: 'intro-frigate', name: 'Dirk' },
]
const ESU_FLEET = [
  { designId: 'esu-light-cruiser', name: 'Kirov' },
  { designId: 'esu-destroyer', name: 'Grozny' },
  { designId: 'esu-frigate', name: 'Storozhevoy' },
]

function twoPlayers(overrides: Partial<CampaignSetup> = {}, esuComputer = false): CampaignSetup {
  return {
    seed: SEED,
    starHexes: STARS,
    radius: RADIUS,
    players: [
      { id: 'terra', name: 'Terra', faction: 'New Anglian Confederation', home: hex(0, 0), startingShips: TERRA_FLEET, startingTransports: 20 },
      { id: 'esu', name: 'Eurasia', faction: 'Eurasian Solar Union', home: hex(2, 0), startingShips: ESU_FLEET, startingTransports: 20, computer: esuComputer },
    ],
    bannedSystems: [...CAMPAIGN_BANNED_SYSTEMS],
    ...overrides,
  }
}

function onePlayer(overrides: Partial<CampaignSetup> = {}): CampaignSetup {
  const base = twoPlayers(overrides)
  return { ...base, players: [base.players[0]!] }
}

/** A campaign at the console: every move journalled, refused or not, as the store would. */
class Table {
  readonly state: CampaignState
  readonly moves: CampaignJournalEntry[] = []
  constructor(readonly setup: CampaignSetup) {
    this.state = createCampaign(setup)
  }
  play(move: CampaignMove): string | undefined {
    this.moves.push(journalEntry(this.state, this.moves.length + 1, move))
    return applyMove(this.state, move).refused
  }
  /** A move that must be accepted. */
  must(move: CampaignMove): void {
    const refused = this.play(move)
    if (refused) throw new Error(`${move.kind} refused: ${refused}`)
  }
  endPhase(): string | undefined {
    return this.play({ kind: 'end-phase', player: null })
  }
  runTo(turn: number, phase: CampaignPhase): void {
    for (let guard = 0; guard < 200; guard++) {
      if (this.state.turn === turn && this.state.phase === phase) return
      if (this.state.turn > turn) throw new Error(`Turn ${turn} is behind us`)
      const refused = this.endPhase()
      if (refused) throw new Error(`end-phase refused at turn ${this.state.turn} ${this.state.phase}: ${refused}`)
    }
    throw new Error('runTo never arrived')
  }
  logText(): string {
    return this.state.log.map((l) => l.text).join('\n')
  }
}

const homeFleetTo = (player: string, to: Hex, from: Hex, turn: number): CampaignMove => ({
  kind: 'plot-move',
  player,
  taskForce: `${player}-tf-1`,
  legs: [{ turn, from, to }],
})

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('createCampaign', () => {
  it('stands up turn one: the map, a home colony with its post and yard, the home fleet with its transports', () => {
    const state = createCampaign(twoPlayers())
    expect(state.turn).toBe(1)
    expect(state.phase).toBe('ftl-movement')
    expect(Object.keys(state.map.systems)).toHaveLength(STARS.length)
    expect(state.players.map((p) => p.id)).toEqual(['terra', 'esu'])

    const home = colonyById(state, 'terra-home')!
    expect(home.owner).toBe('terra')
    expect(home.population).toEqual({ loyal: 10, subject: 0 })
    expect(home.factories).toBe(2)
    expect(home.commandPost).toBe(true)
    expect(home.shipyards).toEqual([{ id: 'terra-yard-1', throughput: 30, capacity: 100, orbital: true }])
    expect(home.stockpileRp).toBe(0)
    const system = systemById(state, home.systemId)!
    expect(hexKey(system.hex)).toBe('0,0')
    expect(system.exploredBy).toContain('terra')
    expect(system.bodies.find((b) => b.id === home.bodyId)?.colonyId).toBe(home.id)

    const fleet = taskForceById(state, 'terra-tf-1')!
    expect(fleet.name).toBe('Terra Home Fleet')
    expect(hexKey(fleet.hex)).toBe('0,0')
    expect(fleet.ships.map((s) => s.name)).toEqual(['Endeavour', 'Dart', 'Dirk'])
    expect(fleet.ships.every((s) => s.hullDamage === 0 && s.systemsDamaged.length === 0)).toBe(true)
    expect(fleet.transports).toBe(20)
    expect(fleet.order).toBe('engage')
    expect(fleet.ftlRate).toBe(2)
    expect(playerById(state, 'terra')!.knownSystems).toEqual([home.systemId])
    expect(state.log[state.log.length - 1]!.text).toMatch(/^The campaign begins: Terra, Eurasia/)
  })

  it('refuses a home hex with no star in it', () => {
    const setup = twoPlayers()
    setup.players[0]!.home = hex(1, 0)
    expect(() => createCampaign(setup)).toThrow(/holds no star/)
  })

  it("takes the GM's home figures from the setup", () => {
    const state = createCampaign(onePlayer({ home: { population: 4, factories: 0, shipyard: { throughput: 10, capacity: 50 } } }))
    const home = colonyById(state, 'terra-home')!
    expect(home.population.loyal).toBe(4)
    expect(home.factories).toBe(0)
    expect(home.shipyards[0]).toMatchObject({ throughput: 10, capacity: 50 })
  })

  it('has a line of guidance for each of the eight phases', () => {
    expect(Object.keys(PHASE_GUIDE).sort()).toEqual([...phasesForTurn(4)].sort())
  })
})

// ---------------------------------------------------------------------------
// The turn
// ---------------------------------------------------------------------------

describe('the turn', () => {
  it('runs the seven phases of an ordinary turn and the eight of a production turn', () => {
    const t = new Table(onePlayer())
    const seen: string[] = [t.state.phase]
    while (t.state.turn === 1) {
      expect(t.endPhase()).toBeUndefined()
      if (t.state.turn === 1) seen.push(t.state.phase)
    }
    expect(seen).toEqual([...phasesForTurn(1)])
    expect(t.state.turn).toBe(2)
    expect(t.logText()).toContain('Turn 2 begins')
    t.runTo(4, 'production')
    expect(phasesForTurn(4)).toContain('production')
    t.endPhase()
    expect(t.state).toMatchObject({ turn: 5, phase: 'ftl-movement' })
  })

  it('holds a force without an admiral to plotting three turns ahead, and checks the legs', () => {
    const t = new Table(twoPlayers())
    expect(plotLeadOf(t.state, taskForceById(t.state, 'terra-tf-1')!)).toBe(3)
    expect(t.play(homeFleetTo('terra', hex(2, 0), hex(0, 0), 3))).toMatch(/must plot 3 turns ahead/)
    expect(t.play(homeFleetTo('terra', hex(2, 0), hex(1, 0), 4))).toMatch(/starts at 1,0, but the force will be at 0,0/)
    expect(t.play(homeFleetTo('terra', hex(3, 0), hex(0, 0), 4))).toMatch(/further than 2 hexes a turn allows/)
    expect(t.play({ kind: 'plot-move', player: 'terra', taskForce: 'esu-tf-1', legs: [] })).toMatch(/not yours/)
    expect(t.play(homeFleetTo('terra', hex(2, 0), hex(0, 0), 4))).toBeUndefined()
    expect(taskForceById(t.state, 'terra-tf-1')!.plot).toEqual([{ turn: 4, from: hex(0, 0), to: hex(2, 0) }])
  })

  it('keeps a warship within 8 hexes of a command post, and lets a scout go beyond (6.1)', () => {
    const stars = [hex(0, 0)]
    const seed = seedWhere((map) => plainHome(map, hex(0, 0)), stars, 12)
    const t = new Table(onePlayer({ seed, starHexes: stars, radius: 12 }))
    const legs = [0, 2, 4, 6, 8].map((q, i) => ({ turn: 4 + i, from: hex(q, 0), to: hex(q + 2, 0) }))
    expect(t.play({ kind: 'plot-move', player: 'terra', taskForce: 'terra-tf-1', legs })).toMatch(/9,0 is more than 8 hexes from a friendly command post/)
    t.must({ kind: 'form-task-force', player: 'terra', taskForce: 'terra-scout', name: 'Picket', hex: hex(0, 0), ships: [], scout: true })
    const scout = taskForceById(t.state, 'terra-scout')!
    expect(plotLeadOf(t.state, scout)).toBe(1)
    const early = legs.map((leg, i) => ({ ...leg, turn: 2 + i }))
    expect(t.play({ kind: 'plot-move', player: 'terra', taskForce: 'terra-scout', legs: early })).toBeUndefined()
    expect(t.play({ kind: 'plot-move', player: 'terra', taskForce: 'terra-scout', legs: [{ turn: 2, from: hex(0, 0), to: hex(13, 0) }] })).toMatch(/further than/)
  })

  it('flies the plot on its turn, explores where it lands, and clears the plot', () => {
    const t = new Table(twoPlayers())
    t.must(homeFleetTo('terra', hex(2, 0), hex(0, 0), 4))
    t.runTo(3, 'admin')
    expect(hexKey(taskForceById(t.state, 'terra-tf-1')!.hex)).toBe('0,0')
    t.runTo(4, 'exploration')
    const fleet = taskForceById(t.state, 'terra-tf-1')!
    expect(hexKey(fleet.hex)).toBe('2,0')
    expect(fleet.movedTurn).toBe(4)
    expect(fleet.plot).toEqual([])
    const there = systemAt(t.state.map, hex(2, 0))!
    expect(there.exploredBy).toEqual(['esu', 'terra'])
    expect(playerById(t.state, 'terra')!.knownSystems).toContain(there.id)
    expect(t.logText()).toMatch(new RegExp(`Terra Home Fleet arrives at ${there.name} \\(6\\.1\\)`))
    expect(t.logText()).toMatch(new RegExp(`Terra Home Fleet explores ${there.name}`))
  })

  it('listens for every enemy force within four hexes in the discovery phase (8)', () => {
    const t = new Table(twoPlayers())
    t.runTo(1, 'discovery')
    const rolls = t.state.log.filter((l) => l.phase === 'discovery' && /listens for .* at 2 hexes/.test(l.text))
    expect(rolls).toHaveLength(2)
  })

  it('transfers ships between forces in a hex, and drops a force left with nothing', () => {
    const t = new Table(onePlayer())
    t.must({ kind: 'form-task-force', player: 'terra', taskForce: 'terra-tf-2', name: 'Escorts', hex: hex(0, 0), ships: ['terra-ship-2', 'terra-ship-3'], scout: false })
    expect(taskForceById(t.state, 'terra-tf-1')!.ships.map((s) => s.name)).toEqual(['Endeavour'])
    expect(taskForceById(t.state, 'terra-tf-2')!.ships.map((s) => s.name)).toEqual(['Dart', 'Dirk'])
    t.must({ kind: 'transfer-ships', player: 'terra', from: 'terra-tf-1', to: 'terra-tf-2', ships: ['terra-ship-1'] })
    // The transports ride with the last ship out of the home fleet.
    expect(taskForceById(t.state, 'terra-tf-1')).toBeUndefined()
    expect(taskForceById(t.state, 'terra-tf-2')!.transports).toBe(20)
    expect(t.play({ kind: 'form-task-force', player: 'terra', taskForce: 'terra-tf-2', name: 'Again', hex: hex(0, 0), ships: [], scout: false })).toMatch(/taken/)
  })
})

// ---------------------------------------------------------------------------
// Meetings (6.1)
// ---------------------------------------------------------------------------

describe('a meeting', () => {
  it('is an even battle when both mean to engage, with the arrival as intruder', () => {
    const t = new Table(twoPlayers())
    t.must(homeFleetTo('terra', hex(2, 0), hex(0, 0), 4))
    t.runTo(4, 'combat')
    expect(t.state.battles).toHaveLength(1)
    const battle = t.state.battles[0]!
    expect(battle).toMatchObject({
      id: 'battle-4-2,0',
      kind: 'even',
      pursuer: null,
      resolved: false,
      sides: [
        { playerId: 'terra', taskForceIds: ['terra-tf-1'], role: 'intruder' },
        { playerId: 'esu', taskForceIds: ['esu-tf-1'], role: 'defender' },
      ],
    })
    expect(battle.systemId).toBe(systemAt(t.state.map, hex(2, 0))!.id)
    expect(t.endPhase()).toMatch(/1 battle still to fight/)
  })

  it('is no battle when the intruder stands off and the defender is under way', () => {
    const t = new Table(twoPlayers())
    t.must(homeFleetTo('terra', hex(2, 0), hex(0, 0), 4))
    t.must({ kind: 'set-order', player: 'terra', taskForce: 'terra-tf-1', order: 'stand-off' })
    t.must({ kind: 'set-order', player: 'esu', taskForce: 'esu-tf-1', order: 'ftl-move' })
    t.runTo(4, 'combat')
    expect(t.state.battles).toHaveLength(0)
    expect(t.logText()).toMatch(/Terra and Eurasia pass each other at .* without a fight/)
    expect(t.endPhase()).toBeUndefined()
  })

  it('is a pursuit when the intruder engages a defender that means to move on', () => {
    const t = new Table(twoPlayers())
    t.must(homeFleetTo('terra', hex(2, 0), hex(0, 0), 4))
    t.must({ kind: 'set-order', player: 'esu', taskForce: 'esu-tf-1', order: 'ftl-move' })
    t.runTo(4, 'combat')
    expect(t.state.battles[0]).toMatchObject({ kind: 'pursuit', pursuer: 'intruder' })
  })
})

// ---------------------------------------------------------------------------
// The bridge to the table
// ---------------------------------------------------------------------------

function meetingAtEurasia(esuComputer = false): Table {
  const t = new Table(twoPlayers({}, esuComputer))
  t.must(homeFleetTo('terra', hex(2, 0), hex(0, 0), 4))
  t.runTo(4, 'combat')
  return t
}

describe('a campaign battle', () => {
  it("opens the table with the campaign's fleets, bans, seed, and the computer on a computer side", () => {
    const t = meetingAtEurasia(true)
    const battle = t.state.battles[0]!
    const setup = battleSetup(t.state, battle, t.setup)
    expect(setup.seed).toBe(battle.seed)
    expect(setup.cpv).toBe(false)
    expect(setup.bannedSystems).toEqual([...CAMPAIGN_BANNED_SYSTEMS])
    expect(setup.aiSides).toEqual(['b'])
    expect(setup.customScenario?.turnLimit).toBe(CAMPAIGN_BATTLE_TURNS)
    expect(setup.customScenario?.name).toMatch(/turn 4$/)
    const game = buildGame(setup)
    expect(game.ships.filter((s) => s.side === 'a').map((s) => s.name)).toEqual(['Endeavour', 'Dart', 'Dirk'])
    expect(game.ships.filter((s) => s.side === 'b').map((s) => s.name)).toEqual(['Kirov', 'Grozny', 'Storozhevoy'])
  })

  it('folds a fought battle back onto the hulls, names the winner, and frees the phase', () => {
    const t = meetingAtEurasia()
    const battle = t.state.battles[0]!
    const setup = battleSetup(t.state, battle, t.setup)
    const saved = autoplay(setup, { maxTurns: 6 })
    expect(saved.actions.length).toBeGreaterThan(0)

    // The end state the battle file replays to, read independently of the fold.
    const game = buildGame(saved.setup)
    for (const action of saved.actions as GameAction[]) applyAction(game, action)

    expect(t.play({ kind: 'resolve-battle', battle: battle.id, savedGame: JSON.stringify(saved) })).toBeUndefined()
    expect(battle.resolved).toBe(true)
    expect(battle.winner === null || battle.winner === 'terra' || battle.winner === 'esu').toBe(true)
    expect(t.logText()).toMatch(/The battle of .* is fought over \d+ turns?/)

    battle.sides.forEach((side, index) => {
      const tactical = game.ships.filter((s) => s.side === BATTLE_SIDE_IDS[index])
      const standing = tactical.filter((s) => !s.destroyed && !s.captured)
      const hulls = side.taskForceIds.flatMap((id) => taskForceById(t.state, id)?.ships ?? [])
      expect(hulls.map((h) => h.name)).toEqual(standing.map((s) => s.name))
      standing.forEach((fought, i) => {
        const hull = hulls[i]!
        expect(hull.hullDamage).toBe(fought.hullMarked)
        expect(hull.armourDamage).toEqual(fought.armourMarked)
        expect(hull.systemsDamaged).toEqual([...fought.destroyedSystems])
        expect(hull.foughtThisTurn).toBe(true)
      })
    })

    // A fight, not a formality: hulls came back marked or did not come back.
    const hulls = t.state.taskForces.flatMap((tf) => tf.ships)
    expect(game.turn).toBeGreaterThan(1)
    expect(hulls.filter((h) => h.hullDamage > 0).length + (6 - hulls.length)).toBeGreaterThan(0)

    expect(t.play({ kind: 'resolve-battle', battle: battle.id, savedGame: JSON.stringify(saved) })).toMatch(/has been fought/)
    expect(t.endPhase()).toBeUndefined()
    expect(t.state.phase).toBe('planetary')
  })

  it('refuses a battle file that is not this battle', () => {
    const t = meetingAtEurasia()
    const battle = t.state.battles[0]!
    const setup = battleSetup(t.state, battle, t.setup)
    const other: SavedGame = { version: 1, setup: { ...setup, seed: setup.seed + 1 }, actions: [] }
    expect(t.play({ kind: 'resolve-battle', battle: battle.id, savedGame: JSON.stringify(other) })).toMatch(/seed differs/)
    expect(t.play({ kind: 'resolve-battle', battle: battle.id, savedGame: '{not json' })).toMatch(/invalid JSON/)
    expect(t.play({ kind: 'resolve-battle', battle: 'battle-9-9,9', savedGame: JSON.stringify(other) })).toMatch(/No such battle/)
    expect(battle.resolved).toBe(false)
  })

  it('mends system damage between turns, and hull damage only in a friendly yard (6.3)', () => {
    const t = new Table(twoPlayers())
    const [endeavour] = taskForceById(t.state, 'terra-tf-1')!.ships
    endeavour!.systemsDamaged = ['beam-1']
    endeavour!.hullDamage = 3
    const [kirov] = taskForceById(t.state, 'esu-tf-1')!.ships
    kirov!.systemsDamaged = ['beam-1']
    kirov!.hullDamage = 2
    kirov!.foughtThisTurn = true
    taskForceById(t.state, 'esu-tf-1')!.hex = hex(3, -2) // away from any yard
    t.runTo(1, 'admin')
    expect(endeavour).toMatchObject({ systemsDamaged: [], hullDamage: 0 })
    expect(kirov).toMatchObject({ systemsDamaged: ['beam-1'], hullDamage: 2 })
    expect(t.logText()).toContain('Endeavour makes good 4 of its damage in the yard (6.3)')
  })
})

// ---------------------------------------------------------------------------
// Production, purchases, research, admirals (6.5, Price schedule, 7, 8)
// ---------------------------------------------------------------------------

describe('production', () => {
  it('banks output on turn 4: growth first, then 50 RP a million and 50 a factory', () => {
    const t = new Table(onePlayer())
    t.runTo(4, 'production')
    const home = colonyById(t.state, 'terra-home')!
    // 10 million grow by 1 per 5 to 12; 12 × 50 + 2 factories × 50 = 700.
    expect(home.population.loyal).toBe(12)
    expect(home.stockpileRp).toBe(700)
    expect(t.logText()).toMatch(/produces 700 RP \(6\.5\)/)
  })

  it('buys in the production phase only, at the price schedule, within the technology known', () => {
    const t = new Table(onePlayer())
    const buy = (item: PurchaseItem, quantity = 1) =>
      t.play({ kind: 'purchase', player: 'terra', colony: 'terra-home', item, quantity })
    expect(buy({ kind: 'pdu' })).toMatch(/production phase/)
    t.runTo(4, 'production')
    const home = colonyById(t.state, 'terra-home')!
    const player = playerById(t.state, 'terra')!
    expect(buy({ kind: 'factory' })).toMatch(/needs industrial technology/)
    expect(buy({ kind: 'pdu' })).toMatch(/needs pdu technology/)

    expect(t.play({ kind: 'research', player: 'terra', technology: 'pdu' })).toBeUndefined()
    expect(player.technologies).toEqual(['pdu'])
    expect(home.stockpileRp).toBe(675)
    expect(buy({ kind: 'pdu' })).toBeUndefined()
    expect(home.defences.pdu).toBe(1)
    expect(home.stockpileRp).toBe(475)

    const corvette = designById('esu-corvette')!
    expect(buy({ kind: 'starship', designId: 'esu-corvette' })).toBeUndefined()
    expect(home.stockpileRp).toBe(475 - corvette.points)
    expect(home.buildQueue).toHaveLength(1)
    expect(home.buildQueue[0]).toMatchObject({ rpRequired: corvette.points, rpPaid: 0, shipyardId: 'terra-yard-1' })
    expect(buy({ kind: 'starship', designId: 'esu-battlecruiser' })).toMatch(/masses 130; the yard builds up to 100/)
    expect(buy({ kind: 'starship', designId: 'izotrope-wavegun' })).toMatch(/carries a wave-gun, which the campaign bans/)

    expect(buy({ kind: 'colony-transport' }, 2)).toBeUndefined()
    expect(home.population.loyal).toBe(10)
    expect(taskForceById(t.state, 'terra-tf-1')!.transports).toBe(22)
    expect(buy({ kind: 'scout-drone' })).toBeUndefined()
    expect(t.state.taskForces.filter((tf) => tf.scout)).toHaveLength(1)
    const left = 475 - corvette.points - 100 - 150
    expect(home.stockpileRp).toBe(left)
    expect(buy({ kind: 'planet-shield' })).toMatch(/needs planet-shield technology/)

    expect(t.play({ kind: 'research', player: 'terra', technology: 'pdu' })).toMatch(/already known/)
    expect(t.play({ kind: 'research', player: 'terra', technology: 'planet-shield' })).toBeUndefined()
    expect(researchBudgetOf(t.state, player)).toBe(left - 130)
    expect(t.play({ kind: 'research', player: 'terra', technology: 'robotic-industry' })).toMatch(/costs 100 RP; \d+ RP can be pooled/)
    expect(t.play({ kind: 'research', player: 'terra', technology: 'speed-3' })).toBeUndefined()
    expect(taskForceById(t.state, 'terra-tf-1')!.ftlRate).toBe(3)
  })

  it('commissions an admiral for 100 RP and lets the flag set the plot lead (7)', () => {
    const t = new Table(onePlayer())
    expect(t.play({ kind: 'recruit-admiral', player: 'terra', colony: 'terra-home', admiral: 'nelson', name: 'Nelson' })).toMatch(/production phase/)
    t.runTo(4, 'production')
    t.must({ kind: 'recruit-admiral', player: 'terra', colony: 'terra-home', admiral: 'nelson', name: 'Nelson' })
    expect(colonyById(t.state, 'terra-home')!.stockpileRp).toBe(600)
    const nelson = t.state.admirals.find((a) => a.id === 'nelson')!
    expect([1, 2, 3]).toContain(nelson.level)
    expect(t.logText()).toMatch(/Nelson is commissioned at .*: rolled [1-6], Level [123] \(7\)/)
    t.must({ kind: 'assign-admiral', player: 'terra', taskForce: 'terra-tf-1', admiral: 'nelson' })
    expect(plotLeadOf(t.state, taskForceById(t.state, 'terra-tf-1')!)).toBe(nelson.level)
    expect(t.play({ kind: 'assign-admiral', player: 'terra', taskForce: 'terra-tf-1', admiral: 'nobody' })).toMatch(/Not your admiral/)
  })

  it('works the yard at its throughput a turn and delivers the hull to the fleet in orbit (Shipyards)', () => {
    const t = new Table(onePlayer())
    t.runTo(4, 'production')
    const corvette = designById('esu-corvette')!
    t.must({ kind: 'purchase', player: 'terra', colony: 'terra-home', item: { kind: 'starship', designId: 'esu-corvette' }, quantity: 1 })
    const turns = Math.ceil(corvette.points / 30)
    t.runTo(4 + turns - 1, 'admin')
    expect(colonyById(t.state, 'terra-home')!.buildQueue[0]!.rpPaid).toBe(30 * (turns - 1))
    t.runTo(4 + turns, 'admin')
    const home = colonyById(t.state, 'terra-home')!
    expect(home.buildQueue).toEqual([])
    const fleet = taskForceById(t.state, 'terra-tf-1')!
    expect(fleet.ships).toHaveLength(4)
    expect(fleet.ships[3]).toMatchObject({ designId: 'esu-corvette', name: `${corvette.name} 1`, hullDamage: 0 })
    expect(t.logText()).toContain(`delivers ${corvette.name} 1`)
  })
})

// ---------------------------------------------------------------------------
// The planetary phase (6.4)
// ---------------------------------------------------------------------------

describe('the planetary phase', () => {
  it('lands colonists from the transports on an explored world, and posts a command there', () => {
    const t = new Table(onePlayer())
    const target = systemAt(t.state.map, hex(0, 2))!
    const body = target.bodies.find((b) => (b.type === 'terran' || b.type === 'sub-terran' || b.type === 'minimal-terran') && b.trait !== 'hazardous')!
    const land = (transports: number) => t.play({ kind: 'found-colony', player: 'terra', colony: 'terra-eden', system: target.id, body: body.id, transports })
    expect(land(5)).toMatch(/planetary phase/)
    t.must(homeFleetTo('terra', hex(0, 2), hex(0, 0), 4))
    t.runTo(4, 'planetary')
    expect(land(30)).toMatch(/Only 20 transports/)
    expect(land(5)).toBeUndefined()
    const eden = colonyById(t.state, 'terra-eden')!
    expect(eden).toMatchObject({ owner: 'terra', systemId: target.id, bodyId: body.id, population: { loyal: 5, subject: 0 }, commandPost: false })
    expect(body.colonyId).toBe('terra-eden')
    expect(taskForceById(t.state, 'terra-tf-1')!.transports).toBe(15)
    expect(land(1)).toMatch(/taken|already settled/)
    t.must({ kind: 'establish-command-post', player: 'terra', colony: 'terra-eden' })
    expect(commandPostsOf(t.state, 'terra').map(hexKey)).toEqual(['0,0', '0,2'])
    // Founded before the turn's production phase, so it produces this very
    // turn: 5 million grow by 1 per 5 (terran), 1 per 10 (sub-terran) or not
    // at all, then bank 50 RP a million.
    t.runTo(4, 'production')
    const first = eden.population.loyal * 50
    expect(eden.stockpileRp).toBe(first)
    t.runTo(8, 'production')
    expect(eden.stockpileRp).toBe(first + eden.population.loyal * 50)
  })

  it('takes a colony by storm when the Marines outnumber its defences, and the captured produce nothing next phase', () => {
    const marines = TERRA_FLEET.reduce((sum, s) => sum + designById(s.designId)!.marineParties, 0)
    expect(marines).toBe(4)
    const storm = (pdu: number): Table => {
      const t = new Table(twoPlayers())
      t.state.taskForces = t.state.taskForces.filter((tf) => tf.owner === 'terra')
      taskForceById(t.state, 'terra-tf-1')!.hex = hex(2, 0)
      colonyById(t.state, 'esu-home')!.defences.pdu = pdu
      t.state.phase = 'planetary'
      t.must({ kind: 'assault', player: 'terra', colony: 'esu-home', taskForce: 'terra-tf-1' })
      return t
    }
    const repulsed = storm(4)
    expect(colonyById(repulsed.state, 'esu-home')!.owner).toBe('esu')
    expect(repulsed.logText()).toMatch(/lands 4 Marine parties on .* and is repulsed by its defences \(5 needed\)/)

    const taken = storm(3)
    const prize = colonyById(taken.state, 'esu-home')!
    expect(prize).toMatchObject({ owner: 'terra', population: { loyal: 0, subject: 10 }, capturedIdlePhases: 1, commandPost: false, defences: { pdu: 0 } })
    expect(taken.logText()).toMatch(/storms .*: taken from Eurasia with 10 million now subject/)
    expect(taken.play({ kind: 'bombard', player: 'terra', colony: 'esu-home', taskForce: 'terra-tf-1' })).toMatch(/your own colony/)
    taken.runTo(4, 'production')
    expect(prize.stockpileRp).toBe(0)
    expect(taken.logText()).toMatch(/produces nothing for its new owner this phase \(6\.4\)/)
    expect(colonyById(taken.state, 'terra-home')!.stockpileRp).toBe(700)
  })

  it('refuses a bombardment without ortillery and an assault from a contested orbit', () => {
    const t = new Table(twoPlayers())
    taskForceById(t.state, 'terra-tf-1')!.hex = hex(2, 0)
    t.state.phase = 'planetary'
    expect(t.play({ kind: 'assault', player: 'terra', colony: 'esu-home', taskForce: 'terra-tf-1' })).toMatch(/still holds the orbit/)
    t.state.taskForces = t.state.taskForces.filter((tf) => tf.owner === 'terra')
    expect(t.play({ kind: 'bombard', player: 'terra', colony: 'esu-home', taskForce: 'terra-tf-1' })).toMatch(/carries no ortillery/)
  })
})

// ---------------------------------------------------------------------------
// The journal
// ---------------------------------------------------------------------------

describe('the journal', () => {
  it('replays to the same campaign, refused moves and fought battles included', () => {
    const t = meetingAtEurasia()
    t.play(homeFleetTo('esu', hex(0, 0), hex(2, 0), 2)) // refused: too soon
    const battle = t.state.battles[0]!
    const saved = autoplay(battleSetup(t.state, battle, t.setup), { maxTurns: 4 })
    t.must({ kind: 'resolve-battle', battle: battle.id, savedGame: JSON.stringify(saved) })
    t.runTo(4, 'production')
    t.play({ kind: 'research', player: 'terra', technology: 'speed-3' })
    t.play({ kind: 'recruit-admiral', player: 'esu', colony: 'esu-home', admiral: 'makarov', name: 'Makarov' })
    t.runTo(5, 'exploration')

    const replayed = replayCampaign({ version: 1, setup: t.setup, moves: t.moves })
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(t.state))
    expect(replayed.rng.cursor).toBeGreaterThan(0)
  })
})
