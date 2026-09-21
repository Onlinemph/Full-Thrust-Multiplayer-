/**
 * The campaign, as a battle is: a setup, a journal of moves, and one function
 * that applies a move to the state (campaign.md, turn sequence).
 *
 * The rules live in the modules beside this one — the map and its d100
 * tables, the economy, research, admirals and intelligence, the meeting
 * matrix and the bridge to the tactical layer — and this is what stands them
 * up as a game: `createCampaign` builds turn one from a setup, `applyMove`
 * is the one door every change goes through, and `end-phase` is the move
 * that turns the clock and runs whatever a phase does of its own accord
 * (fleets arrive, systems are explored, meetings become battles, sieges
 * fall, yards work, colonies produce).
 *
 * A move carries ids and choices, never a price or a roll, so replaying the
 * journal over the setup rebuilds the campaign exactly; refused moves are
 * journalled and do nothing, as in a battle.
 */

import { applyAction, type GameAction } from '../engine/actions'
import type { GameState, TerrainFeature } from '../engine/game'
import type { ShipDesign } from '../engine/types'
import { CURRENT_RULES_VERSION, buildGame, parseSavedGame, type GameSetup } from '../data/savedGame'
import { designById } from '../data/ships'
import { scoreBattle } from '../engine/victory'
import { INTRODUCTORY_VICTORY } from '../data/scenarios'
import {
  colonisationRefusal,
  priceOf,
  purchaseRefusal,
  rollUnrest,
  runIntegrationProgram,
  runProductionPhase,
  shipyardRefusal,
  PRICE_SCHEDULE,
} from './economy'
import {
  detectionCheck,
  effectiveCommandLevel,
  plotAheadTurns,
  recruitAdmiral,
  rollAdmiralCasualty,
  DETECTION_RANGE,
  type CommandLevel,
  type SensorGrade,
} from './intel'
import {
  ftlTurnsForPath,
  generateStarMap,
  hexDistance,
  hexKey,
  hexPath,
  nebulaLookup,
  systemAt,
  withinCommandRange,
} from './map'
import { effectiveCost, ftlRate } from './research'
import {
  advanceCampaignPhase,
  engagementScenario,
  explorationHazardCheck,
  phasesForTurn,
  resolveMeeting,
  CAMPAIGN_BANNED_SYSTEMS,
  type CampaignBattleForce,
  type CampaignEngagement,
} from './turn'
import { draw } from './types'
import type {
  Admiral,
  CampaignJournalEntry,
  CampaignLogEntry,
  CampaignMove,
  CampaignPhase,
  CampaignSetup,
  CampaignShip,
  CampaignState,
  Colony,
  Hex,
  PendingBattle,
  PlayerId,
  PlayerState,
  SavedCampaign,
  StarSystem,
  TaskForce,
  TaskForceOrder,
} from './types'

export const CAMPAIGN_RULES_VERSION = 1

/** The home colony the rules leave to the GM: ten million people, two factories, a modest orbital yard. */
export const HOME_DEFAULTS = {
  population: 10,
  factories: 2,
  shipyard: { throughput: 30, capacity: 100 },
} as const

/** What a campaign battle is fought to, in turns, when nothing ends it sooner. */
export const CAMPAIGN_BATTLE_TURNS = 12

export interface MoveOutcome {
  refused?: string
}

const OK: MoveOutcome = {}
const refuse = (why: string): MoveOutcome => ({ refused: why })

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** Names for the stars, in the order the setup lists them. */
const STAR_NAMES = [
  'Tau Ceti', 'Epsilon Eridani', 'Procyon', 'Sirius', 'Altair', 'Vega', 'Fomalhaut', 'Arcturus',
  'Capella', 'Aldebaran', 'Pollux', 'Regulus', 'Spica', 'Antares', 'Deneb', 'Rigel', 'Bellatrix',
  'Mirach', 'Alcor', 'Mizar', 'Alkaid', 'Dubhe', 'Merak', 'Castor', 'Denebola', 'Algol', 'Achernar',
  'Canopus', 'Hadar', 'Acrux', 'Gacrux', 'Shaula', 'Sargas', 'Nunki', 'Kaus', 'Ankaa', 'Diphda',
  'Menkar', 'Alnilam', 'Saiph', 'Wezen', 'Adhara', 'Naos', 'Avior', 'Suhail', 'Alphard', 'Zosma',
  'Vindemiatrix', 'Izar', 'Alphecca', 'Unukalhai', 'Rasalhague', 'Eltanin', 'Sheliak', 'Albireo',
  'Sadr', 'Enif', 'Scheat', 'Markab', 'Alderamin', 'Errai', 'Caph', 'Schedar', 'Ruchbah', 'Almach',
  'Hamal', 'Sheratan', 'Zaurak', 'Cursa', 'Nihal', 'Arneb', 'Furud', 'Muliphein', 'Gomeisa',
]

/** Turn one of a campaign, from its setup. */
export function createCampaign(setup: CampaignSetup): CampaignState {
  const rng = { seed: setup.seed >>> 0, cursor: 0 }
  const map = generateStarMap(rng, {
    starHexes: setup.starHexes,
    radius: setup.radius,
    nameFor: (_hex, index) => STAR_NAMES[index] ?? `System ${index + 1}`,
  })
  const state: CampaignState = {
    rulesVersion: setup.rulesVersion ?? CAMPAIGN_RULES_VERSION,
    seed: setup.seed,
    turn: 1,
    phase: 'ftl-movement',
    rng,
    map,
    players: [],
    colonies: [],
    taskForces: [],
    admirals: [],
    battles: [],
    log: [],
  }
  const home = { ...HOME_DEFAULTS, ...setup.home, shipyard: { ...HOME_DEFAULTS.shipyard, ...setup.home?.shipyard } }

  for (const entry of setup.players) {
    const system = systemAt(map, entry.home)
    if (!system) throw new Error(`${entry.name}'s home hex ${hexKey(entry.home)} holds no star`)
    // "a home system holding at least one habitable planet" (Economy): the
    // GM's guarantee, so a home rolled without one is given one, and the
    // ruling is on the record.
    let body = system.bodies.find((b) => b.type === 'terran') ?? system.bodies.find((b) => b.type === 'sub-terran' || b.type === 'minimal-terran')
    if (!body) {
      body = system.bodies[0]
      if (!body) {
        body = { id: `${system.id}-b1`, name: `${system.name} I`, type: 'terran', trait: 'none', parentId: null, colonyId: null }
        system.bodies.push(body)
      } else {
        body.type = 'terran'
        body.trait = body.trait === 'hazardous' ? 'none' : body.trait
      }
      note(state, 'note', `${system.name} is ${entry.name}'s home, so ${body.name} is a terran world by the GM's ruling (Economy)`)
    }
    system.exploredBy.push(entry.id)

    const player: PlayerState = {
      id: entry.id,
      name: entry.name,
      faction: entry.faction,
      rp: 0,
      researchPoints: 0,
      techPoints: 0,
      technologies: [],
      homeSystemId: system.id,
      knownSystems: [system.id],
      intel: [],
      espionagePenalty: 0,
    }
    state.players.push(player)

    const colony: Colony = {
      id: `${entry.id}-home`,
      name: body.name,
      owner: entry.id,
      systemId: system.id,
      bodyId: body.id,
      population: { loyal: home.population, subject: 0 },
      factories: home.factories,
      factoriesOffline: 0,
      defences: { pdu: 0, advancedPdu: 0, planetShield: false },
      shipyards: [{ id: `${entry.id}-yard-1`, throughput: home.shipyard.throughput, capacity: home.shipyard.capacity, orbital: true }],
      stockpileRp: 0,
      integrationCredit: 0,
      commandPost: true,
      underSiege: false,
      capturedIdlePhases: 0,
      stabilised: true,
      buildingBlocked: false,
      buildQueue: [],
    }
    body.colonyId = colony.id
    state.colonies.push(colony)

    const ships: CampaignShip[] = entry.startingShips.map((ship, index) => {
      const design = designById(ship.designId)
      if (!design) throw new Error(`Unknown ship design: ${ship.designId}`)
      return newShip(`${entry.id}-ship-${index + 1}`, ship.name || `${design.name} ${index + 1}`, design)
    })
    state.taskForces.push({
      id: `${entry.id}-tf-1`,
      name: `${entry.name} Home Fleet`,
      owner: entry.id,
      hex: { ...entry.home },
      ships,
      order: 'engage',
      admiralId: null,
      scout: false,
      plot: [],
      ftlRate: ftlRate(player.technologies),
      transports: entry.startingTransports,
      movedTurn: null,
    })
  }
  note(state, 'note', `The campaign begins: ${state.players.map((p) => p.name).join(', ')} on a map of ${Object.keys(map.systems).length} stars`)
  return state
}

function newShip(id: string, name: string, design: ShipDesign): CampaignShip {
  return {
    id,
    name,
    designId: design.id,
    hullDamage: 0,
    armourDamage: design.armour.layers.map(() => 0),
    coreDamage: [],
    systemsDamaged: [],
    foughtThisTurn: false,
    expendables: {},
  }
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

export function replayCampaign(saved: SavedCampaign): CampaignState {
  const state = createCampaign(saved.setup)
  for (const entry of saved.moves) applyMove(state, entry.move)
  return state
}

/** The journal entry a move makes, stamped with where in the turn it was made. */
export function journalEntry(state: CampaignState, seq: number, move: CampaignMove): CampaignJournalEntry {
  return { seq, turn: state.turn, phase: state.phase, move }
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function playerById(state: CampaignState, id: PlayerId): PlayerState | undefined {
  return state.players.find((p) => p.id === id)
}

export function taskForceById(state: CampaignState, id: string): TaskForce | undefined {
  return state.taskForces.find((tf) => tf.id === id)
}

export function colonyById(state: CampaignState, id: string): Colony | undefined {
  return state.colonies.find((c) => c.id === id)
}

export function systemById(state: CampaignState, id: string): StarSystem | undefined {
  return Object.values(state.map.systems).find((s) => s.id === id)
}

export function taskForcesAt(state: CampaignState, hex: Hex): TaskForce[] {
  return state.taskForces.filter((tf) => hexKey(tf.hex) === hexKey(hex))
}

export function coloniesOf(state: CampaignState, player: PlayerId): Colony[] {
  return state.colonies.filter((c) => c.owner === player)
}

/** Friendly command posts, as hexes: colonies with a post that is not under siege (6.1, 6.4). */
export function commandPostsOf(state: CampaignState, player: PlayerId): Hex[] {
  return coloniesOf(state, player)
    .filter((c) => c.commandPost && !c.underSiege)
    .map((c) => systemById(state, c.systemId)?.hex)
    .filter((hex): hex is Hex => hex !== undefined)
}

function admiralOf(state: CampaignState, tf: TaskForce): Admiral | null {
  return tf.admiralId ? (state.admirals.find((a) => a.id === tf.admiralId) ?? null) : null
}

/** The commanding admiral's level as it counts this turn (7). */
export function commandLevelOf(state: CampaignState, tf: TaskForce): CommandLevel | null {
  const admiral = admiralOf(state, tf)
  if (!admiral) return null
  return effectiveCommandLevel({
    id: admiral.id,
    name: admiral.name,
    faction: admiral.owner,
    level: admiral.level,
    injuredFor: admiral.injuredUntilTurn !== null && admiral.injuredUntilTurn > state.turn ? 1 : 0,
    dead: admiral.dead,
  })
}

/** How many turns ahead this force must plot (6.1, 7). */
export function plotLeadOf(state: CampaignState, tf: TaskForce): number {
  return tf.scout ? 1 : plotAheadTurns(commandLevelOf(state, tf))
}

function designOf(ship: CampaignShip): ShipDesign {
  const design = designById(ship.designId)
  if (!design) throw new Error(`Unknown ship design: ${ship.designId}`)
  return design
}

function isWarship(ship: CampaignShip): boolean {
  return designOf(ship).weapons.length > 0
}

function note(state: CampaignState, kind: string, text: string): void {
  const entry: CampaignLogEntry = { seq: state.log.length + 1, turn: state.turn, phase: state.phase, kind, text }
  state.log.push(entry)
}

/** The whole RP a player can put to research: the pool and every colony's stockpile (6.5). */
export function researchBudgetOf(state: CampaignState, player: PlayerState): number {
  return player.rp + coloniesOf(state, player.id).reduce((sum, c) => sum + c.stockpileRp, 0)
}

function spendPooled(state: CampaignState, player: PlayerState, rp: number): void {
  let left = rp
  const fromPool = Math.min(player.rp, left)
  player.rp -= fromPool
  left -= fromPool
  for (const colony of coloniesOf(state, player.id)) {
    if (left <= 0) break
    const take = Math.min(colony.stockpileRp, left)
    colony.stockpileRp -= take
    left -= take
  }
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

export function applyMove(state: CampaignState, move: CampaignMove): MoveOutcome {
  switch (move.kind) {
    case 'plot-move':
      return plotMove(state, move)
    case 'set-order': {
      const tf = own(state, move.player, move.taskForce)
      if (typeof tf === 'string') return refuse(tf)
      tf.order = move.order
      note(state, 'move', `${tf.name} stands to ${orderLabel(move.order)}`)
      return OK
    }
    case 'form-task-force':
      return formTaskForce(state, move)
    case 'transfer-ships':
      return transferShips(state, move)
    case 'assign-admiral':
      return assignAdmiral(state, move)
    case 'explore-system': {
      const tf = own(state, move.player, move.taskForce)
      if (typeof tf === 'string') return refuse(tf)
      const system = systemAt(state.map, tf.hex)
      if (!system || system.id !== move.system) return refuse(`${tf.name} is not in that system`)
      explore(state, tf, system)
      return OK
    }
    case 'detection-check':
      return detect(state, move.player, move.taskForce, move.target, true)
    case 'found-colony':
      return foundColony(state, move)
    case 'establish-command-post': {
      if (state.phase !== 'planetary') return refuse('Command posts are established in the planetary phase')
      const colony = colonyById(state, move.colony)
      if (!colony || colony.owner !== move.player) return refuse('Not your colony')
      if (colony.underSiege) return refuse(`${colony.name} is under siege and cannot act as a command post (6.4)`)
      colony.commandPost = true
      note(state, 'move', `A command post is established at ${colony.name} (6.1)`)
      return OK
    }
    case 'emigrate':
      return refuse('Emigration is not in this reading: colonists travel in transports bought at a colony')
    case 'integration-program': {
      if (state.phase !== 'planetary') return refuse('Integration is paid for in the planetary phase')
      const colony = colonyById(state, move.colony)
      if (!colony || colony.owner !== move.player) return refuse('Not your colony')
      if (move.rp <= 0 || move.rp > colony.stockpileRp) return refuse(`${colony.name} holds ${colony.stockpileRp} RP`)
      const result = runIntegrationProgram(colony, move.rp)
      colony.stockpileRp -= result.rpAccepted
      note(state, 'move', `${colony.name} integrates ${result.millionsConverted} million for ${result.rpAccepted} RP (6.4)`)
      return OK
    }
    case 'bombard':
      return bombard(state, move)
    case 'assault':
      return assault(state, move)
    case 'purchase':
      return purchase(state, move)
    case 'cancel-build': {
      const colony = colonyById(state, move.colony)
      if (!colony || colony.owner !== move.player) return refuse('Not your colony')
      const at = colony.buildQueue.findIndex((o) => o.id === move.order)
      if (at < 0) return refuse('No such order')
      const [order] = colony.buildQueue.splice(at, 1)
      const refund = order!.rpRequired - order!.rpPaid
      colony.stockpileRp += refund
      note(state, 'move', `${colony.name} cancels a build and recovers ${refund} RP`)
      return OK
    }
    case 'allocate-shipyard':
      return refuse('Yards allocate themselves: a hull goes to the first yard that can build it')
    case 'research':
      return research(state, move)
    case 'trade-technology':
      return refuse('Trading technology is not in this reading')
    case 'recruit-admiral':
      return recruit(state, move)
    case 'espionage':
    case 'counter-espionage':
    case 'sabotage':
      return refuse('Espionage is not in this reading')
    case 'resolve-battle':
      return resolveBattle(state, move.battle, move.savedGame)
    case 'end-phase':
      return endPhase(state)
    case 'gm-ruling': {
      for (const [key, value] of Object.entries(move.effects)) {
        const [what, id] = key.split(':')
        if (what === 'rp' && id) {
          const colony = colonyById(state, id)
          if (colony) colony.stockpileRp = Math.max(0, colony.stockpileRp + value)
        }
      }
      note(state, 'note', `GM: ${move.note}`)
      return OK
    }
  }
}

function orderLabel(order: TaskForceOrder): string {
  return order === 'engage' ? 'engage' : order === 'stand-off' ? 'stand off' : 'move on by FTL'
}

function own(state: CampaignState, player: PlayerId, taskForce: string): TaskForce | string {
  const tf = taskForceById(state, taskForce)
  if (!tf) return 'No such task force'
  if (tf.owner !== player) return `${tf.name} is not yours`
  return tf
}

// --- FTL movement (6.1) ------------------------------------------------------

function plotMove(state: CampaignState, move: Extract<CampaignMove, { kind: 'plot-move' }>): MoveOutcome {
  const tf = own(state, move.player, move.taskForce)
  if (typeof tf === 'string') return refuse(tf)
  const player = playerById(state, move.player)!
  const lead = plotLeadOf(state, tf)
  const rate = ftlRate(player.technologies)
  const nebula = nebulaLookup(state.map)
  const posts = commandPostsOf(state, move.player)
  let at = tf.hex
  let turn = state.turn + lead - 1
  for (const [i, leg] of move.legs.entries()) {
    if (leg.turn <= state.turn + lead - 1) {
      return refuse(`${tf.name} must plot ${lead} turn${lead === 1 ? '' : 's'} ahead: leg ${i + 1} is for turn ${leg.turn} (6.1, 7)`)
    }
    if (leg.turn <= turn) return refuse(`Legs must run turn by turn: leg ${i + 1} is for turn ${leg.turn} after turn ${turn}`)
    if (hexKey(leg.from) !== hexKey(at)) return refuse(`Leg ${i + 1} starts at ${hexKey(leg.from)}, but the force will be at ${hexKey(at)}`)
    const path = hexPath(leg.from, leg.to)
    if (path.length > 1 && ftlTurnsForPath(path, rate, nebula) > 1) {
      return refuse(`Leg ${i + 1} is further than ${rate} hexes a turn allows (a cloud costs a whole turn) (6.1)`)
    }
    if (!tf.scout) {
      for (const hex of path) {
        if (!withinCommandRange(hex, posts)) {
          return refuse(`${hexKey(hex)} is more than 8 hexes from a friendly command post (6.1)`)
        }
      }
    }
    if (hexDistance({ q: 0, r: 0 }, leg.to) > state.map.radius) return refuse(`${hexKey(leg.to)} is off the map`)
    at = leg.to
    turn = leg.turn
  }
  tf.plot = move.legs.map((leg) => ({ turn: leg.turn, from: { ...leg.from }, to: { ...leg.to } }))
  note(state, 'move', move.legs.length === 0 ? `${tf.name} clears its plot` : `${tf.name} plots ${move.legs.length} leg${move.legs.length === 1 ? '' : 's'} to ${hexKey(at)} by turn ${turn} (6.1)`)
  return OK
}

function formTaskForce(state: CampaignState, move: Extract<CampaignMove, { kind: 'form-task-force' }>): MoveOutcome {
  if (taskForceById(state, move.taskForce)) return refuse('That task force id is taken')
  const sources = taskForcesAt(state, move.hex).filter((tf) => tf.owner === move.player)
  if (sources.length === 0) return refuse(`You have nothing at ${hexKey(move.hex)}`)
  const ships: CampaignShip[] = []
  for (const id of move.ships) {
    const from = sources.find((tf) => tf.ships.some((s) => s.id === id))
    if (!from) return refuse(`Ship ${id} is not yours at ${hexKey(move.hex)}`)
    ships.push(from.ships.find((s) => s.id === id)!)
  }
  if (ships.length === 0 && !move.scout) return refuse('A task force needs at least one ship')
  for (const from of sources) from.ships = from.ships.filter((s) => !move.ships.includes(s.id))
  const player = playerById(state, move.player)!
  state.taskForces.push({
    id: move.taskForce,
    name: move.name,
    owner: move.player,
    hex: { ...move.hex },
    ships,
    order: 'engage',
    admiralId: null,
    scout: move.scout,
    plot: [],
    ftlRate: ftlRate(player.technologies),
    transports: 0,
    movedTurn: null,
  })
  dropEmpty(state)
  note(state, 'move', `${move.name} forms at ${hexKey(move.hex)} with ${ships.length} ship${ships.length === 1 ? '' : 's'}`)
  return OK
}

function transferShips(state: CampaignState, move: Extract<CampaignMove, { kind: 'transfer-ships' }>): MoveOutcome {
  const from = own(state, move.player, move.from)
  if (typeof from === 'string') return refuse(from)
  const to = own(state, move.player, move.to)
  if (typeof to === 'string') return refuse(to)
  if (hexKey(from.hex) !== hexKey(to.hex)) return refuse('Ships transfer between task forces in the same hex')
  for (const id of move.ships) {
    if (!from.ships.some((s) => s.id === id)) return refuse(`${from.name} has no ship ${id}`)
  }
  const moving = from.ships.filter((s) => move.ships.includes(s.id))
  from.ships = from.ships.filter((s) => !move.ships.includes(s.id))
  to.ships.push(...moving)
  // Transports ride with the ships that leave a convoy behind them.
  if (from.ships.length === 0 && from.transports > 0) {
    to.transports += from.transports
    from.transports = 0
  }
  dropEmpty(state)
  note(state, 'move', `${moving.length} ship${moving.length === 1 ? '' : 's'} pass from ${from.name} to ${to.name}`)
  return OK
}

/** A task force with nothing in it is no task force. */
function dropEmpty(state: CampaignState): void {
  for (const tf of [...state.taskForces]) {
    if (tf.ships.length === 0 && tf.transports === 0 && !tf.scout) {
      state.taskForces = state.taskForces.filter((other) => other !== tf)
      for (const battle of state.battles) {
        for (const side of battle.sides) side.taskForceIds = side.taskForceIds.filter((id) => id !== tf.id)
      }
    }
  }
}

function assignAdmiral(state: CampaignState, move: Extract<CampaignMove, { kind: 'assign-admiral' }>): MoveOutcome {
  const tf = own(state, move.player, move.taskForce)
  if (typeof tf === 'string') return refuse(tf)
  if (move.admiral === null) {
    tf.admiralId = null
    note(state, 'move', `${tf.name} sails without a flag`)
    return OK
  }
  const admiral = state.admirals.find((a) => a.id === move.admiral)
  if (!admiral || admiral.owner !== move.player) return refuse('Not your admiral')
  if (admiral.dead) return refuse(`${admiral.name} is dead`)
  for (const other of state.taskForces) if (other.admiralId === admiral.id) other.admiralId = null
  tf.admiralId = admiral.id
  note(state, 'move', `${admiral.name} (Level ${admiral.level}) hoists a flag in ${tf.name} (7)`)
  return OK
}

// --- Exploration and discovery (6.2.1, 8) ----------------------------------

function explore(state: CampaignState, tf: TaskForce, system: StarSystem): void {
  if (system.exploredBy.includes(tf.owner)) return
  system.exploredBy.push(tf.owner)
  const player = playerById(state, tf.owner)
  if (player && !player.knownSystems.includes(system.id)) player.knownSystems.push(system.id)
  const bodies = system.bodies.filter((b) => b.parentId === null).length
  note(state, 'roll', `${tf.name} explores ${system.name}: a ${system.feature.replace(/-/g, ' ')} with ${bodies} bod${bodies === 1 ? 'y' : 'ies'} (6.2.1)`)
}

function bestSensorsOf(tf: TaskForce): SensorGrade {
  let best: SensorGrade = 'none'
  for (const ship of tf.ships) {
    for (const system of designOf(ship).systems) {
      if (system.kind === 'superior-sensors') return 'superior'
      if (system.kind === 'enhanced-sensors') best = 'advanced'
    }
  }
  return best
}

function detect(state: CampaignState, player: PlayerId, observerId: string, targetId: string, voluntary: boolean): MoveOutcome {
  const observer = own(state, player, observerId)
  if (typeof observer === 'string') return refuse(observer)
  const target = taskForceById(state, targetId)
  if (!target || target.owner === player) return refuse('No such enemy task force')
  const distance = hexDistance(observer.hex, target.hex)
  const stealth = target.ships.length > 0 && target.ships.every((s) => designOf(s).systems.some((sys) => sys.kind === 'stealth-hull'))
  const result = detectionCheck(
    {
      distance,
      admiral: commandLevelOf(state, observer),
      sensors: bestSensorsOf(observer),
      allTargetsStealthHulled: stealth,
      nebula: systemAt(state.map, target.hex)?.feature === 'nebula',
    },
    state.rng,
  )
  if (!result.attempted) return refuse(result.refusedReason ?? 'Out of range')
  const who = playerById(state, player)!
  if (result.success) {
    who.intel = who.intel.filter((r) => r.subjectId !== target.id)
    who.intel.push({
      turn: state.turn,
      subjectId: target.id,
      subjectOwner: target.owner,
      detail: 'ship-count',
      shipIds: [],
      shipCount: target.ships.length,
      note: `${target.ships.length} ship${target.ships.length === 1 ? '' : 's'}${target.transports > 0 ? ` and ${target.transports} transports` : ''}`,
    })
  }
  note(state, 'roll', `${observer.name} ${voluntary ? 'checks for' : 'listens for'} ${target.name} at ${distance} hex${distance === 1 ? '' : 'es'}: ${result.dice?.join('+')}${result.modifier ? ` ${result.modifier > 0 ? '+' : ''}${result.modifier}` : ''} = ${result.total}, ${result.success ? 'detected' : 'nothing'} (8)`)
  return OK
}

// --- Planetary (6.4) -------------------------------------------------------

function foundColony(state: CampaignState, move: Extract<CampaignMove, { kind: 'found-colony' }>): MoveOutcome {
  if (state.phase !== 'planetary') return refuse('Colonists land in the planetary phase')
  if (colonyById(state, move.colony)) return refuse('That colony id is taken')
  const system = systemById(state, move.system)
  if (!system) return refuse('No such system')
  const body = system.bodies.find((b) => b.id === move.body)
  if (!body) return refuse('No such body')
  if (body.colonyId) return refuse(`${body.name} is already settled`)
  const player = playerById(state, move.player)
  if (!player) return refuse('No such player')
  if (!system.exploredBy.includes(move.player)) return refuse(`${system.name} has not been explored`)
  const why = colonisationRefusal(body, player.technologies, false)
  if (why) return refuse(`${body.name}: ${why}`)
  const convoys = taskForcesAt(state, system.hex).filter((tf) => tf.owner === move.player && tf.transports > 0)
  const aboard = convoys.reduce((sum, tf) => sum + tf.transports, 0)
  if (move.transports <= 0) return refuse('Land at least one transport')
  if (aboard < move.transports) return refuse(`Only ${aboard} transport${aboard === 1 ? '' : 's'} at ${system.name}`)
  if (taskForcesAt(state, system.hex).some((tf) => tf.owner !== move.player && tf.ships.some(isWarship))) {
    return refuse('Enemy warships hold the orbit')
  }
  let left = move.transports
  for (const tf of convoys) {
    const take = Math.min(tf.transports, left)
    tf.transports -= take
    left -= take
    if (left === 0) break
  }
  const colony: Colony = {
    id: move.colony,
    name: body.name,
    owner: move.player,
    systemId: system.id,
    bodyId: body.id,
    population: { loyal: move.transports, subject: 0 },
    factories: 0,
    factoriesOffline: 0,
    defences: { pdu: 0, advancedPdu: 0, planetShield: false },
    shipyards: [],
    stockpileRp: 0,
    integrationCredit: 0,
    commandPost: false,
    underSiege: false,
    capturedIdlePhases: 0,
    stabilised: body.trait !== 'hazardous',
    buildingBlocked: false,
    buildQueue: [],
  }
  body.colonyId = colony.id
  state.colonies.push(colony)
  dropEmpty(state)
  note(state, 'move', `${player.name} lands ${move.transports} million on ${body.name} (6.4)`)
  return OK
}

function orbitHeldBy(state: CampaignState, hex: Hex, player: PlayerId): boolean {
  const here = taskForcesAt(state, hex)
  const enemies = here.some((tf) => tf.owner !== player && tf.ships.some(isWarship))
  const mine = here.some((tf) => tf.owner === player && tf.ships.some(isWarship))
  return mine && !enemies
}

function bombard(state: CampaignState, move: Extract<CampaignMove, { kind: 'bombard' }>): MoveOutcome {
  if (state.phase !== 'planetary') return refuse('Bombardment is a planetary-phase act')
  const tf = own(state, move.player, move.taskForce)
  if (typeof tf === 'string') return refuse(tf)
  const colony = colonyById(state, move.colony)
  if (!colony) return refuse('No such colony')
  if (colony.owner === move.player) return refuse('That is your own colony')
  const system = systemById(state, colony.systemId)!
  if (hexKey(tf.hex) !== hexKey(system.hex)) return refuse(`${tf.name} is not at ${system.name}`)
  if (!orbitHeldBy(state, system.hex, move.player)) return refuse('The orbit is contested')
  if (colony.defences.planetShield) return refuse(`${colony.name}'s planet shield stops the bombardment`)
  const batteries = tf.ships.reduce((sum, s) => sum + designOf(s).systems.filter((sys) => sys.kind === 'ortillery' && !s.systemsDamaged.includes(sys.id)).length, 0)
  if (batteries === 0) return refuse(`${tf.name} carries no ortillery (12.6)`)
  let killed = 0
  for (let i = 0; i < batteries; i += 1) {
    if (colony.population.loyal > 0) colony.population.loyal -= 1
    else if (colony.population.subject > 0) colony.population.subject -= 1
    else break
    killed += 1
  }
  note(state, 'move', `${tf.name} bombards ${colony.name}: ${killed} million killed (6.4)`)
  return OK
}

function assault(state: CampaignState, move: Extract<CampaignMove, { kind: 'assault' }>): MoveOutcome {
  if (state.phase !== 'planetary') return refuse('Assaults are made in the planetary phase')
  const tf = own(state, move.player, move.taskForce)
  if (typeof tf === 'string') return refuse(tf)
  const colony = colonyById(state, move.colony)
  if (!colony) return refuse('No such colony')
  if (colony.owner === move.player) return refuse('That is your own colony')
  const system = systemById(state, colony.systemId)!
  if (hexKey(tf.hex) !== hexKey(system.hex)) return refuse(`${tf.name} is not at ${system.name}`)
  if (!orbitHeldBy(state, system.hex, move.player)) return refuse('The defender still holds the orbit')
  const marines = tf.ships.reduce((sum, s) => sum + designOf(s).marineParties, 0)
  if (marines === 0) return refuse(`${tf.name} carries no Marines`)
  if (colony.defences.planetShield) {
    note(state, 'move', `${tf.name} assaults ${colony.name} and is repulsed: the planet shield is intact`)
    return OK
  }
  // [reading] The rules say PDUs repulse a landing and nothing about how
  // they are reduced. Here a landing that brings more Marine parties than
  // the defences are worth — one a PDU, two an advanced PDU — overwhelms
  // them and takes the colony; fewer are repulsed and the defences stand.
  const needed = colony.defences.pdu + 2 * colony.defences.advancedPdu + 1
  if (marines < needed) {
    note(state, 'move', `${tf.name} lands ${marines} Marine part${marines === 1 ? 'y' : 'ies'} on ${colony.name} and is repulsed by its defences (${needed} needed)`)
    return OK
  }
  const former = playerById(state, colony.owner)
  colony.owner = move.player
  colony.population = { loyal: 0, subject: colony.population.loyal + colony.population.subject }
  colony.defences = { pdu: 0, advancedPdu: 0, planetShield: false }
  colony.commandPost = false
  colony.underSiege = false
  colony.capturedIdlePhases = 1
  colony.buildQueue = []
  colony.integrationCredit = 0
  const player = playerById(state, move.player)
  if (player && !player.knownSystems.includes(system.id)) player.knownSystems.push(system.id)
  note(state, 'battle', `${tf.name} storms ${colony.name}: taken from ${former?.name ?? 'nobody'} with ${colony.population.subject} million now subject (6.4)`)
  return OK
}

// --- Purchasing (Price schedule, Shipyards) --------------------------------

function purchase(state: CampaignState, move: Extract<CampaignMove, { kind: 'purchase' }>): MoveOutcome {
  if (state.phase !== 'production') return refuse('Things are bought in the production phase, every fourth turn')
  const colony = colonyById(state, move.colony)
  if (!colony || colony.owner !== move.player) return refuse('Not your colony')
  const player = playerById(state, move.player)!
  const quantity = Math.max(1, Math.floor(move.quantity))
  const item = move.item
  if (item.kind === 'hazard-stabilisation' || item.kind === 'drop-pod' || item.kind === 'sleeper-spy' || item.kind === 'counter-espionage') {
    return refuse(`${item.kind} is not in this reading`)
  }
  if (item.kind === 'admiral') return refuse('Recruit an admiral by name (recruit-admiral)')
  if (item.kind === 'command-post') {
    colony.commandPost = true
    note(state, 'move', `A command post is established at ${colony.name} (6.1)`)
    return OK
  }
  const why = purchaseRefusal(colony, item, player.technologies)
  if (why) return refuse(why)
  const body = systemById(state, colony.systemId)?.bodies.find((b) => b.id === colony.bodyId)
  const breathable = body?.type === 'terran'
  let design: ShipDesign | undefined
  if (item.kind === 'starship') {
    design = designById(item.designId)
    if (!design) return refuse('No such design')
    const banned = [...design.systems.map((s) => s.kind), ...design.weapons.map((w) => w.weaponClass)].find((k) => CAMPAIGN_BANNED_SYSTEMS.includes(k))
    if (banned) return refuse(`${design.name} carries a ${banned}, which the campaign bans`)
    const yard = colony.shipyards.find((y) => shipyardRefusal(y, design!) === null)
    if (!yard) {
      const reasons = colony.shipyards.map((y) => shipyardRefusal(y, design!)).filter((r): r is string => r !== null)
      return refuse(reasons[0] ?? `${colony.name} has no shipyard`)
    }
  }
  if (item.kind === 'planet-shield' && colony.defences.planetShield) return refuse(`${colony.name} already has a planet shield`)
  if (item.kind === 'colony-transport' && colony.population.loyal < quantity + 1) {
    return refuse(`${colony.name} cannot spare ${quantity} million colonists`)
  }
  const each = priceOf(item, { design: (id) => designById(id), breathableWorld: breathable })
  const cost = each * quantity
  if (cost > colony.stockpileRp) return refuse(`${quantity > 1 ? `${quantity} × ` : ''}${each} RP, and ${colony.name} holds ${colony.stockpileRp}`)
  colony.stockpileRp -= cost

  switch (item.kind) {
    case 'starship': {
      const yard = colony.shipyards.find((y) => shipyardRefusal(y, design!) === null)!
      for (let i = 0; i < quantity; i += 1) {
        colony.buildQueue.push({ id: `${colony.id}-build-${state.log.length + 1}-${i}`, item, rpRequired: each, rpPaid: 0, shipyardId: yard.id })
      }
      note(state, 'move', `${colony.name} lays down ${quantity} × ${design!.name} at ${cost} RP; the yard works ${yard.throughput} RP a turn (Shipyards)`)
      return OK
    }
    case 'colony-transport': {
      colony.population.loyal -= quantity
      convoyAt(state, player, systemById(state, colony.systemId)!.hex).transports += quantity
      note(state, 'move', `${colony.name} embarks ${quantity} million in ${quantity} transport${quantity === 1 ? '' : 's'} (Economy)`)
      return OK
    }
    case 'scout-drone': {
      for (let i = 0; i < quantity; i += 1) {
        const n = state.taskForces.filter((tf) => tf.owner === player.id && tf.scout).length + 1
        state.taskForces.push({
          id: `${player.id}-scout-${state.log.length + 1}-${i}`,
          name: `${player.name} Scout ${n}`,
          owner: player.id,
          hex: { ...systemById(state, colony.systemId)!.hex },
          ships: [],
          order: 'ftl-move',
          admiralId: null,
          scout: true,
          plot: [],
          ftlRate: ftlRate(player.technologies),
          transports: 0,
          movedTurn: null,
        })
      }
      note(state, 'move', `${colony.name} launches ${quantity} scout drone${quantity === 1 ? '' : 's'} (Price schedule)`)
      return OK
    }
    case 'factory':
      colony.factories += quantity
      colony.factoriesOffline += quantity
      note(state, 'move', `${colony.name} builds ${quantity} factor${quantity === 1 ? 'y' : 'ies'}, online next production phase (6.5)`)
      return OK
    case 'pdu':
      colony.defences.pdu += quantity
      note(state, 'move', `${colony.name} emplaces ${quantity} PDU`)
      return OK
    case 'advanced-pdu':
      colony.defences.advancedPdu += quantity
      note(state, 'move', `${colony.name} emplaces ${quantity} advanced PDU`)
      return OK
    case 'planet-shield':
      colony.defences.planetShield = true
      note(state, 'move', `${colony.name} raises a planet shield`)
      return OK
    case 'shipyard':
      for (let i = 0; i < quantity; i += 1) {
        colony.shipyards.push({ id: `${colony.id}-yard-${colony.shipyards.length + 1}`, throughput: item.throughput, capacity: item.capacity, orbital: item.orbital })
      }
      note(state, 'move', `${colony.name} builds ${quantity} ${item.orbital ? 'orbital' : 'planetary'} yard${quantity === 1 ? '' : 's'} (${item.throughput}/${item.capacity})`)
      return OK
    default:
      return OK
  }
}

/** The player's convoy at a hex: the task force transports join, made if there is none. */
function convoyAt(state: CampaignState, player: PlayerState, hex: Hex): TaskForce {
  const here = taskForcesAt(state, hex).filter((tf) => tf.owner === player.id && !tf.scout)
  const existing = here.find((tf) => tf.ships.length > 0) ?? here[0]
  if (existing) return existing
  const tf: TaskForce = {
    id: `${player.id}-tf-${state.taskForces.length + 1}-${state.log.length + 1}`,
    name: `${player.name} Convoy`,
    owner: player.id,
    hex: { ...hex },
    ships: [],
    order: 'ftl-move',
    admiralId: null,
    scout: false,
    plot: [],
    ftlRate: ftlRate(player.technologies),
    transports: 0,
    movedTurn: null,
  }
  state.taskForces.push(tf)
  return tf
}

function research(state: CampaignState, move: Extract<CampaignMove, { kind: 'research' }>): MoveOutcome {
  if (state.phase !== 'production') return refuse('Research is paid for in the production phase (8)')
  const player = playerById(state, move.player)
  if (!player) return refuse('No such player')
  if (player.technologies.includes(move.technology)) return refuse(`${move.technology} is already known`)
  const cost = effectiveCost(move.technology, player.technologies)
  const budget = researchBudgetOf(state, player)
  if (cost > budget) return refuse(`${move.technology} costs ${cost} RP; ${budget} RP can be pooled (8)`)
  spendPooled(state, player, cost)
  player.technologies.push(move.technology)
  for (const tf of state.taskForces) if (tf.owner === player.id) tf.ftlRate = ftlRate(player.technologies)
  note(state, 'move', `${player.name} researches ${move.technology} for ${cost} RP (8)`)
  return OK
}

function recruit(state: CampaignState, move: Extract<CampaignMove, { kind: 'recruit-admiral' }>): MoveOutcome {
  if (state.phase !== 'production') return refuse('Admirals are recruited in the production phase (7)')
  const colony = colonyById(state, move.colony)
  if (!colony || colony.owner !== move.player) return refuse('Not your colony')
  if (state.admirals.some((a) => a.id === move.admiral)) return refuse('That admiral id is taken')
  const cost = PRICE_SCHEDULE.admiral.rp
  if (colony.stockpileRp < cost) return refuse(`An admiral costs ${cost} RP; ${colony.name} holds ${colony.stockpileRp}`)
  colony.stockpileRp -= cost
  const result = recruitAdmiral(state.rng, { id: move.admiral, name: move.name, faction: move.player })
  state.admirals.push({ id: move.admiral, name: move.name, owner: move.player, level: result.admiral.level, dead: false, injuredUntilTurn: null })
  note(state, 'roll', `${move.name} is commissioned at ${colony.name}: rolled ${result.roll}, Level ${result.admiral.level} (7)`)
  return OK
}

// ---------------------------------------------------------------------------
// The turn (Turn sequence)
// ---------------------------------------------------------------------------

function endPhase(state: CampaignState): MoveOutcome {
  if (state.phase === 'combat') {
    const open = state.battles.filter((b) => !b.resolved)
    if (open.length > 0) return refuse(`${open.length} battle${open.length === 1 ? '' : 's'} still to fight`)
  }
  const before = { turn: state.turn, phase: state.phase }
  advanceCampaignPhase(state)
  if (state.turn !== before.turn) note(state, 'phase', `Turn ${state.turn} begins`)
  enterPhase(state)
  return OK
}

/** What a phase does of its own accord as it opens (Turn sequence). */
function enterPhase(state: CampaignState): void {
  switch (state.phase) {
    case 'ftl-movement':
      return moveFleets(state)
    case 'exploration':
      for (const tf of state.taskForces) {
        const system = systemAt(state.map, tf.hex)
        if (system) explore(state, tf, system)
      }
      return
    case 'exploration-risk':
      for (const tf of state.taskForces) {
        if (tf.movedTurn !== state.turn) continue
        const system = systemAt(state.map, tf.hex)
        if (system?.feature !== 'dense-asteroid-field') continue
        const check = explorationHazardCheck(state.rng, { denseAsteroidField: true })
        note(state, 'roll', `${tf.name} threads the dense asteroid field at ${system.name}: ${check.dice.join('+')} ${check.modifier} = ${check.total} (6.2.1; the GM rules on the hazard)`)
      }
      return
    case 'discovery':
      for (const observer of state.taskForces) {
        for (const target of state.taskForces) {
          if (target.owner === observer.owner) continue
          if (hexDistance(observer.hex, target.hex) > DETECTION_RANGE) continue
          detect(state, observer.owner, observer.id, target.id, false)
        }
      }
      return
    case 'combat':
      return findMeetings(state)
    case 'planetary':
      for (const colony of state.colonies) {
        const hex = systemById(state, colony.systemId)?.hex
        if (!hex) continue
        const besieged = taskForcesAt(state, hex).some((tf) => tf.owner !== colony.owner && tf.ships.some(isWarship))
        if (besieged && !colony.underSiege) note(state, 'note', `${colony.name} is under siege (6.4)`)
        if (!besieged && colony.underSiege) note(state, 'note', `The siege of ${colony.name} is lifted`)
        colony.underSiege = besieged
      }
      return
    case 'admin':
      return admin(state)
    case 'production':
      return produce(state)
  }
}

function moveFleets(state: CampaignState): void {
  for (const tf of state.taskForces) {
    for (const ship of tf.ships) ship.foughtThisTurn = false
    const due = tf.plot.filter((leg) => leg.turn === state.turn)
    tf.plot = tf.plot.filter((leg) => leg.turn > state.turn)
    for (const leg of due) {
      if (hexKey(leg.from) !== hexKey(tf.hex)) {
        note(state, 'move', `${tf.name} is at ${hexKey(tf.hex)}, not ${hexKey(leg.from)}: its plot is abandoned`)
        tf.plot = []
        break
      }
      tf.hex = { ...leg.to }
      tf.movedTurn = state.turn
      const system = systemAt(state.map, tf.hex)
      note(state, 'move', `${tf.name} arrives at ${system ? system.name : hexKey(tf.hex)} (6.1)`)
    }
  }
}

/** The order a player's forces in a hex fight under: the boldest of them (6.1). */
function sideOrder(forces: readonly TaskForce[]): TaskForceOrder {
  if (forces.some((tf) => tf.order === 'engage')) return 'engage'
  if (forces.some((tf) => tf.order === 'stand-off')) return 'stand-off'
  return 'ftl-move'
}

function findMeetings(state: CampaignState): void {
  const byHex = new Map<string, TaskForce[]>()
  for (const tf of state.taskForces) {
    if (tf.ships.length === 0) continue
    const key = hexKey(tf.hex)
    byHex.set(key, [...(byHex.get(key) ?? []), tf])
  }
  for (const [key, here] of byHex) {
    const owners = [...new Set(here.map((tf) => tf.owner))]
    if (owners.length < 2) continue
    // Whoever arrived this turn intrudes on whoever was there; if everyone
    // arrived at once, the first listed defends the ground.
    const arrived = owners.filter((owner) => here.filter((tf) => tf.owner === owner).every((tf) => tf.movedTurn === state.turn))
    const intruderId = arrived.length > 0 && arrived.length < owners.length ? arrived[0]! : owners[1]!
    const defenderId = owners.find((owner) => owner !== intruderId)!
    if (owners.length > 2) note(state, 'note', `Three fleets meet at ${key}; ${playerById(state, intruderId)?.name} and ${playerById(state, defenderId)?.name} fight first`)
    const intruders = here.filter((tf) => tf.owner === intruderId)
    const defenders = here.filter((tf) => tf.owner === defenderId)
    const meeting = resolveMeeting(sideOrder(intruders), sideOrder(defenders))
    const system = systemAt(state.map, intruders[0]!.hex)
    if (meeting.kind === 'none') {
      note(state, 'note', `${playerById(state, intruderId)?.name} and ${playerById(state, defenderId)?.name} pass each other at ${system?.name ?? key} without a fight (6.1)`)
      continue
    }
    const seed = Math.floor(draw(state.rng) * 0x7fffffff)
    const battle: PendingBattle = {
      id: `battle-${state.turn}-${key}`,
      hex: { ...intruders[0]!.hex },
      systemId: system?.id ?? null,
      kind: meeting.kind,
      sides: [
        { playerId: intruderId, taskForceIds: intruders.map((tf) => tf.id), role: 'intruder' },
        { playerId: defenderId, taskForceIds: defenders.map((tf) => tf.id), role: 'defender' },
      ],
      pursuer: meeting.pursuer,
      seed,
      resolved: false,
    }
    state.battles.push(battle)
    note(state, 'battle', `${playerById(state, intruderId)?.name} meets ${playerById(state, defenderId)?.name} at ${system?.name ?? key}: ${meeting.kind === 'pursuit' ? 'a pursuit' : 'an even battle'} (6.1)`)
  }
}

function admin(state: CampaignState): void {
  for (const colony of state.colonies) {
    if (colony.population.subject < 5) continue
    const unrest = rollUnrest(colony, state.rng)
    if (unrest.riots > 0) {
      const paid = Math.min(colony.stockpileRp, unrest.rpLost)
      colony.stockpileRp -= paid
      note(state, 'roll', `Unrest at ${colony.name}: ${unrest.riots} riot${unrest.riots === 1 ? '' : 's'} cost ${paid} RP and block building next phase (6.4)`)
    }
  }
  for (const tf of state.taskForces) {
    const hex = tf.hex
    const port = state.colonies.some((c) => c.owner === tf.owner && c.shipyards.length > 0 && hexKey(systemById(state, c.systemId)!.hex) === hexKey(hex))
    for (const ship of tf.ships) {
      let mended = 0
      if (!ship.foughtThisTurn && ship.systemsDamaged.length > 0) {
        mended += ship.systemsDamaged.length
        ship.systemsDamaged = []
      }
      if (port && (ship.hullDamage > 0 || ship.armourDamage.some((n) => n > 0) || ship.coreDamage.length > 0)) {
        mended += ship.hullDamage + ship.armourDamage.reduce((a, b) => a + b, 0) + ship.coreDamage.length
        ship.hullDamage = 0
        ship.armourDamage = ship.armourDamage.map(() => 0)
        ship.coreDamage = []
      }
      if (mended > 0) note(state, 'note', `${ship.name} makes good ${mended} of its damage${port ? ' in the yard' : ''} (6.3)`)
    }
  }
  for (const admiral of state.admirals) {
    if (admiral.injuredUntilTurn !== null && admiral.injuredUntilTurn <= state.turn) {
      admiral.injuredUntilTurn = null
      note(state, 'note', `${admiral.name} returns to duty (7)`)
    }
  }
  // Yards work every turn (Shipyards): the first hull each yard has in hand
  // takes its throughput in RP, and a hull paid up is delivered.
  for (const colony of state.colonies) {
    for (const yard of colony.shipyards) {
      const order = colony.buildQueue.find((o) => o.shipyardId === yard.id && o.rpPaid < o.rpRequired)
      if (!order) continue
      order.rpPaid = Math.min(order.rpRequired, order.rpPaid + yard.throughput)
      if (order.rpPaid < order.rpRequired) continue
      colony.buildQueue = colony.buildQueue.filter((o) => o !== order)
      if (order.item.kind !== 'starship') continue
      const design = designById(order.item.designId)
      if (!design) continue
      const player = playerById(state, colony.owner)!
      const n = state.taskForces.filter((tf) => tf.owner === player.id).flatMap((tf) => tf.ships).filter((s) => s.designId === design.id).length + 1
      const ship = newShip(`${player.id}-ship-${state.log.length + 1}`, `${design.name} ${n}`, design)
      convoyAt(state, player, systemById(state, colony.systemId)!.hex).ships.push(ship)
      note(state, 'note', `${colony.name} delivers ${ship.name}`)
    }
  }
}

function produce(state: CampaignState): void {
  const entries = state.colonies
    .map((colony) => ({ colony, body: systemById(state, colony.systemId)?.bodies.find((b) => b.id === colony.bodyId) }))
    .filter((entry): entry is { colony: Colony; body: NonNullable<typeof entry.body> } => entry.body !== undefined)
  const report = runProductionPhase(entries, state.rng)
  for (const result of report.colonies) {
    const colony = colonyById(state, result.colonyId)!
    note(state, 'production', result.silencedByCapture
      ? `${colony.name} produces nothing for its new owner this phase (6.4)`
      : `${colony.name} produces ${result.rpBanked} RP${result.factoriesDestroyed > 0 ? '; a factory is lost to the world' : ''} (6.5)`)
    colony.factoriesOffline = 0
    colony.buildingBlocked = false
  }
  for (const [playerId, totals] of Object.entries(report.byPlayer)) {
    const player = playerById(state, playerId)
    if (!player) continue
    player.researchPoints += totals.researchPoints
    player.techPoints += totals.techPoints
  }
}

// ---------------------------------------------------------------------------
// The bridge: a pending battle as a battle, and a fought battle folded back
// ---------------------------------------------------------------------------

/** Tactical side ids for the two sides of a campaign battle: the intruder is 'a'. */
export const BATTLE_SIDE_IDS = ['a', 'b'] as const

function engagementOf(state: CampaignState, battle: PendingBattle): CampaignEngagement {
  const system = battle.systemId ? systemById(state, battle.systemId) : undefined
  const forces = battle.sides.map((side, index): CampaignBattleForce => {
    const player = playerById(state, side.playerId)!
    const tfs = side.taskForceIds.map((id) => taskForceById(state, id)).filter((tf): tf is TaskForce => tf !== undefined)
    const levels = tfs.map((tf) => commandLevelOf(state, tf)).filter((l): l is CommandLevel => l !== null)
    return {
      id: BATTLE_SIDE_IDS[index]!,
      name: player.name,
      role: side.role,
      order: sideOrder(tfs),
      admiral: levels.length > 0 ? (Math.min(...levels) as CommandLevel) : null,
      ships: tfs.flatMap((tf) => tf.ships.map((ship) => ({ designId: ship.designId, name: ship.name }))),
    }
  })
  return {
    id: battle.id,
    hex: battle.hex,
    kind: battle.kind === 'pursuit' ? 'pursuit' : 'even',
    pursuer: battle.pursuer,
    feature: system?.feature ?? 'standard',
    seed: battle.seed,
    forces: [forces[0]!, forces[1]!],
  }
}

/**
 * The setup the tactical engine opens a campaign battle from: the engagement's
 * scenario, its seed, the campaign's bans, the system's terrain, and the
 * computer at the helm of any side a computer plays. Ships come in as they
 * stand in the campaign: a hull that limped away from the last fight limps
 * into this one.
 */
export function battleSetup(state: CampaignState, battle: PendingBattle, setup: CampaignSetup): GameSetup {
  const engagement = engagementOf(state, battle)
  const scenario = engagementScenario(engagement, { turnLimit: CAMPAIGN_BATTLE_TURNS })
  const system = battle.systemId ? systemById(state, battle.systemId) : undefined
  const terrain: TerrainFeature[] = []
  const { width, height } = scenario.table
  if (system?.feature === 'nebula') terrain.push({ id: 'cloud', kind: 'dust-cloud', position: { x: width / 2, y: height / 2 }, radius: 14, label: `${system.name} cloud` })
  if (system?.feature === 'dense-asteroid-field') {
    terrain.push(
      { id: 'rocks-1', kind: 'asteroid-field', position: { x: width * 0.3, y: height * 0.45 }, radius: 6, label: 'Asteroids' },
      { id: 'rocks-2', kind: 'asteroid-field', position: { x: width * 0.65, y: height * 0.55 }, radius: 7, label: 'Asteroids' },
    )
  }
  if (terrain.length > 0) scenario.terrain = terrain
  scenario.name = `${scenario.name}: ${system?.name ?? hexKey(battle.hex)}, turn ${state.turn}`
  const computers = battle.sides
    .map((side, index) => (setup.players.find((p) => p.id === side.playerId)?.computer ? BATTLE_SIDE_IDS[index]! : null))
    .filter((id): id is 'a' | 'b' => id !== null)
  return {
    scenarioId: scenario.id,
    seed: battle.seed,
    rulesVersion: CURRENT_RULES_VERSION,
    customScenario: scenario,
    bannedSystems: [...CAMPAIGN_BANNED_SYSTEMS],
    // The campaign prices in RP, and one Full Thrust point is one RP (Economy).
    cpv: false,
    terrainHazards: true,
    coreSystems: true,
    tableScale: 1,
    aiSides: computers,
  }
}

/** The state of the ships as the battle left them, written onto the campaign's hulls. */
function resolveBattle(state: CampaignState, battleId: string, savedGame: string): MoveOutcome {
  if (state.phase !== 'combat') return refuse('Battles are resolved in the combat phase')
  const battle = state.battles.find((b) => b.id === battleId)
  if (!battle) return refuse('No such battle')
  if (battle.resolved) return refuse('That battle has been fought')
  const parsed = parseSavedGame(savedGame)
  if (typeof parsed === 'string') return refuse(parsed)
  if (parsed.setup.seed !== battle.seed) return refuse('That battle file is not this battle: the seed differs')
  const game = buildGame(parsed.setup)
  for (const action of parsed.actions as GameAction[]) applyAction(game, action)
  foldBack(state, battle, game)
  return OK
}

function foldBack(state: CampaignState, battle: PendingBattle, game: GameState): void {
  const losses: string[] = []
  battle.sides.forEach((side, index) => {
    const tactical = game.ships.filter((ship) => ship.side === BATTLE_SIDE_IDS[index])
    const forces = side.taskForceIds.map((id) => taskForceById(state, id)).filter((tf): tf is TaskForce => tf !== undefined)
    const hulls = forces.flatMap((tf) => tf.ships.map((ship) => ({ tf, ship })))
    hulls.forEach(({ tf, ship }, i) => {
      const fought = tactical[i]
      if (!fought) return
      ship.foughtThisTurn = true
      if (fought.destroyed || fought.captured) {
        tf.ships = tf.ships.filter((s) => s !== ship)
        losses.push(ship.name)
        const admiral = admiralOf(state, tf)
        if (admiral && tf.ships.length === 0) admiralCasualty(state, admiral, `${ship.name} was lost`)
        return
      }
      ship.hullDamage = fought.hullMarked
      ship.armourDamage = [...fought.armourMarked]
      ship.systemsDamaged = [...fought.destroyedSystems]
      ship.coreDamage = [
        ...(fought.core.bridgeDestroyed ? ['bridge'] : []),
        ...(fought.core.lifeSupportDestroyed ? ['life-support'] : []),
        ...(fought.core.powerCoreDestroyed ? ['power-core'] : []),
      ]
      const admiral = admiralOf(state, tf)
      if (admiral && i === 0 && fought.core.bridgeDestroyed) admiralCasualty(state, admiral, `${ship.name} took a bridge hit`)
    })
  })
  const score = scoreBattle(game, INTRODUCTORY_VICTORY, { cpv: false, battleOver: true })
  const winnerSide = score.winner
  const winnerIndex = winnerSide === null ? -1 : BATTLE_SIDE_IDS.indexOf(winnerSide as 'a' | 'b')
  battle.resolved = true
  battle.winner = winnerIndex >= 0 ? battle.sides[winnerIndex]!.playerId : null
  const system = battle.systemId ? systemById(state, battle.systemId) : undefined
  const winner = battle.winner ? playerById(state, battle.winner)?.name : null
  note(state, 'battle', `The battle of ${system?.name ?? hexKey(battle.hex)} is fought over ${game.turn - 1} turn${game.turn === 2 ? '' : 's'}: ${winner ? `${winner} has the better of it` : 'a draw'}${losses.length > 0 ? `; lost: ${losses.join(', ')}` : ''}`)
  dropEmpty(state)
}

function admiralCasualty(state: CampaignState, admiral: Admiral, why: string): void {
  const shadow = { id: admiral.id, name: admiral.name, faction: admiral.owner, level: admiral.level, injuredFor: 0, dead: admiral.dead }
  const result = rollAdmiralCasualty(shadow, state.rng)
  if (result.outcome === 'dead') admiral.dead = true
  if (result.outcome === 'injured') admiral.injuredUntilTurn = state.turn + result.turns
  note(state, 'roll', `${why}: ${admiral.name} rolls ${result.roll}, ${result.outcome === 'dead' ? 'killed' : result.outcome === 'injured' ? `injured for ${result.turns} turn${result.turns === 1 ? '' : 's'}` : 'unharmed'} (7)`)
}

/** What each phase asks of the players, for the console. */
export const PHASE_GUIDE: Record<CampaignPhase, string> = {
  'ftl-movement': 'Plotted legs due this turn have been flown. Write new plots and set standing orders for the turns ahead.',
  exploration: 'Every system a task force sits in has been explored for its owner.',
  'exploration-risk': 'Hazard rolls for forces that came through a dense asteroid field are on the log for the GM to rule on.',
  discovery: 'Detection checks against every enemy force within four hexes have been rolled. Voluntary checks may be added.',
  combat: 'Meetings have become battles. Fight each one on the table, or let the computers fight it, before the phase ends.',
  planetary: 'Land colonists, establish command posts, bombard and assault, pay for integration.',
  admin: 'Unrest and repairs are done. The turn is recorded.',
  production: 'Colonies have produced. Spend their stockpiles: hulls, transports, factories, defences, yards, admirals; pool RP for research.',
}

export { phasesForTurn }
