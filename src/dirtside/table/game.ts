/**
 * Dirtside II — the game on the table (Chapters 4–8): deployment, the
 * integrated activation sequence, movement, fire, opportunity fire, the
 * confidence tests that fire provokes, rallying, repairs, objectives and
 * the end of the game.
 *
 * `applyAction` is the one door. It refuses with the page, or returns the
 * next state with the action journaled and the log extended. Every die
 * comes from the state's stream, so `replay(setup, journal)` rebuilds any
 * position exactly.
 */

import { mobilityFamily } from '../data/mobility'
import { APSW_RANGE, validityAgainstInfantry, validityOf } from '../data/weapons'
import { INFANTRY_KILL_TOTAL, drawChits, firefightValidity, resolveInfantryHit, resolveVehicleHit } from '../chits'
import { newStream, roll, rollD6 } from '../dice'
import { describeInfantryHit, describeVehicleHit, fireShot, narrateShot } from '../fire'
import { CONFIDENCE_LABELS, CONFIDENCE_LEVELS_INDEX, QUALITY_DIE, THREAT, casualtyThreat, confidenceTest, lowerConfidence, raiseConfidence, rallyTest, reactionTest, restrictionsOf } from './confidence'
import { baseMovement, infantryPosition, planTableShot, resolveChitShot, rifleRange, type TableShotPlan, teamFiresRanged, touchesCover, unitKind } from './tableFire'
import { bearing, distance, distanceToSegment, lineOfSight, onTable, pathCost, terrainAt, woodAt } from './terrain'
import { ATTACK_LABELS, NUKE_EXCLUSION, OFF_TABLE_CALL, STRIKE_CHITS, callDie, caughtBy, falloutBreach, nextOverhead, orbitalShips, overhead, rollDeviation, strikeArmour, strikeValidity, attacksLeft } from './orbital'
import {
  type Action,
  type ActivationElement,
  type ActivationState,
  type ElementState,
  type GameSetup,
  type GameState,
  type LogEntry,
  type OrbitalStrike,
  type Point,
  type Refusal,
  type ShotOrder,
  type SideId,
  type UnitState,
  otherSide,
  refuse,
} from './types'
import { stepDie } from '../data/weapons'

/** Deploy within this many inches of your own baseline (p. 17). */
export const DEPLOY_DEPTH = 6
/** Unit integrity distances (p. 23). */
export const INTEGRITY = { infantry: 2, armour: 3 } as const
/** A move over an objective takes it (p. 17): this close to the marker. */
export const OBJECTIVE_REACH = 1
/** Evasive movement uses at least this share of the movement factors (p. 27). */
export const EVASIVE_SHARE = 0.75

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function baselineY(setup: GameSetup, side: SideId): number {
  return side === 'north' ? 0 : setup.table.depth
}

/** Where a side may deploy (p. 17). */
export function inDeploymentZone(setup: GameSetup, side: SideId, point: Point): boolean {
  if (!onTable(point, setup.table)) return false
  const depth = setup.table.depth
  const attacker = setup.battle === 'attack-defence' ? (setup.attacker ?? 'north') : null
  if (attacker && side !== attacker) {
    // The defender: the main battle area and its own rear area.
    return attacker === 'north' ? point.y >= depth / 3 : point.y <= (2 * depth) / 3
  }
  return side === 'north' ? point.y <= DEPLOY_DEPTH : point.y >= depth - DEPLOY_DEPTH
}

export function createGame(setup: GameSetup): GameState {
  const elements: Record<string, ElementState> = {}
  const units: Record<string, UnitState> = {}
  // Prepared positions are the defender's, in an attack/defence battle (p. 20).
  const defends = (side: SideId) => setup.battle === 'attack-defence' && side !== (setup.attacker ?? 'north')
  for (const side of setup.sides) {
    let x = 2
    for (const unit of side.units) {
      const ids: string[] = []
      let leader: string | null = null
      for (const el of unit.elements) {
        const auto: Point = side.id === 'north' ? { x, y: 3 } : { x, y: setup.table.depth - 3 }
        x += 1.5
        elements[el.id] = {
          id: el.id,
          unitId: unit.id,
          sideId: side.id,
          name: el.name ?? el.vehicle?.name ?? `${unit.name} ${el.infantry?.team ?? ''} team`,
          vehicle: el.vehicle,
          infantry: el.infantry,
          position: el.position ?? auto,
          facing: el.facing ?? (side.id === 'north' ? 180 : 0),
          destroyed: false,
          damaged: false,
          immobilised: false,
          systemsDown: false,
          systemsDownAt: null,
          dugIn: !!el.dugIn && defends(side.id),
          posture: 'none',
          wood: null,
          woodEntry: null,
        }
        ids.push(el.id)
        if (el.leader && !leader) leader = el.id
      }
      x += 2
      units[unit.id] = {
        id: unit.id,
        sideId: side.id,
        name: unit.name,
        quality: unit.quality,
        leadership: unit.leadership,
        confidence: unit.confidence ?? 'CO',
        commandUnit: !!unit.commandUnit,
        leaderElementId: leader ?? ids[0] ?? null,
        elementIds: ids,
        activated: false,
        underFire: false,
        panic: false,
        contacted: false,
        firstLossTaken: false,
        evasive: false,
        strength: ids.length,
        casualties: 0,
      }
    }
  }
  for (const el of Object.values(elements)) el.wood = woodAt(el.position, setup.table.terrain)?.where ?? null
  const defender = setup.battle === 'attack-defence' ? otherSide(setup.attacker ?? 'north') : null
  const objectives: GameState['objectives'] = {}
  for (const o of setup.table.objectives) objectives[o.id] = { heldBy: defender }
  const state: GameState = {
    setup,
    rng: newStream(setup.seed),
    turn: 0,
    phase: 'deployment',
    elements,
    units,
    sides: {
      north: { id: 'north', name: setup.sides.find((s) => s.id === 'north')?.name ?? 'North', ready: false, done: false, commandLost: false, commandLostTurn: null },
      south: { id: 'south', name: setup.sides.find((s) => s.id === 'south')?.name ?? 'South', ready: false, done: false, commandLost: false, commandLostTurn: null },
    },
    toAct: null,
    chooser: null,
    activation: null,
    activationCount: 0,
    owed: 0,
    objectives,
    prepared: [],
    orbit: null,
    journal: [],
    log: [{ turn: 0, side: null, text: `${setup.name}: deployment. ${setup.battle === 'encounter' ? 'Both sides deploy within 6" of their baselines.' : `${state0Name(setup, defender!)} defends and deploys first.`}`, page: 'p. 17' }],
    result: null,
  }
  // Ships in orbit (More Thrust p. 17): a D6 as the game opens is the turn they are first overhead.
  const supports = (setup.orbital ?? []).filter((s) => s.ships.length > 0)
  if (supports.length > 0) {
    state.orbit = { windows: {}, spent: {}, strikes: [], nukes: [], count: 0 }
    for (const support of supports) {
      if (state.orbit.windows[support.side] !== undefined) continue
      const rolled = support.window === undefined
      const first = support.window ?? rollD6(state.rng)
      state.orbit.windows[support.side] = first
      const names = supports.filter((s) => s.side === support.side).flatMap((s) => s.ships.map((ship) => ship.name))
      log(state, support.side, `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} in low orbit${rolled ? `: the D6 rolls ${first}` : ''}, overhead on turn ${first} and every sixth turn after.`, 'More Thrust p. 17')
    }
  }
  return state
}

function state0Name(setup: GameSetup, side: SideId): string {
  return setup.sides.find((s) => s.id === side)?.name ?? side
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const functional = (e: ElementState) => !e.destroyed
export const mobile = (e: ElementState) => !e.destroyed && !e.immobilised

export function elementsOf(state: GameState, unit: UnitState): ElementState[] {
  return unit.elementIds.map((id) => state.elements[id]!)
}

export function unitsOf(state: GameState, side: SideId): UnitState[] {
  return Object.values(state.units).filter((u) => u.sideId === side)
}

/** Units still on the table: at least one element not knocked out. */
export function liveUnits(state: GameState, side: SideId): UnitState[] {
  return unitsOf(state, side).filter((u) => elementsOf(state, u).some(functional))
}

export function unactivatedUnits(state: GameState, side: SideId): UnitState[] {
  return liveUnits(state, side).filter((u) => !u.activated)
}

export function nearestEnemyDistance(state: GameState, side: SideId, point: Point): number {
  let best = Number.POSITIVE_INFINITY
  for (const e of Object.values(state.elements)) if (e.sideId !== side && functional(e)) best = Math.min(best, distance(point, e.position))
  return best
}

/** Whether every mobile element has a unit-mate within the integrity distance (p. 23). */
export function isOrganised(state: GameState, unit: UnitState, positions: Record<string, Point> = {}): boolean {
  const members = elementsOf(state, unit).filter(mobile)
  if (members.length < 2) return true
  const limit = INTEGRITY[unitKind(state, unit)]
  const at = (e: ElementState) => positions[e.id] ?? e.position
  return members.every((e) => members.some((o) => o !== e && distance(at(e), at(o)) <= limit + 1e-9))
}

export function commandUnitOf(state: GameState, side: SideId): UnitState | null {
  return unitsOf(state, side).find((u) => u.commandUnit && elementsOf(state, u).some(functional)) ?? null
}

/** In cover for the shaken-infantry test (p. 22): dug in, in a wood, or in urban terrain. */
function inCover(state: GameState, e: ElementState, at: Point = e.position): boolean {
  if (e.dugIn && at === e.position) return true
  return woodAt(at, state.setup.table.terrain) !== null || terrainAt(at, state.setup.table.terrain) === 'urban'
}

export function canPass(state: GameState, side: SideId): boolean {
  return state.phase === 'activation' && state.toAct === side && !state.activation && unactivatedUnits(state, side).length < unactivatedUnits(state, otherSide(side)).length
}

export function objectiveValues(state: GameState): Record<SideId, number> {
  const values: Record<SideId, number> = { north: 0, south: 0 }
  for (const o of state.setup.table.objectives) {
    const held = state.objectives[o.id]?.heldBy
    if (held) values[held] += o.value
  }
  return values
}

// ---------------------------------------------------------------------------
// The door
// ---------------------------------------------------------------------------

export function applyAction(before: GameState, action: Action): GameState | Refusal {
  if (before.result) return refuse('The battle is over.', 'p. 17')
  const state = structuredClone(before)
  const outcome = dispatch(state, action)
  if (outcome) return outcome
  state.journal.push(action)
  return state
}

export function replay(setup: GameSetup, journal: readonly Action[]): GameState {
  let state = createGame(setup)
  for (const action of journal) {
    const next = applyAction(state, action)
    if ('ok' in next) throw new Error(`replay refused ${action.kind}: ${next.reason} (${next.page})`)
    state = next
  }
  return state
}

function log(state: GameState, side: SideId | null, text: string, page?: string): void {
  const entry: LogEntry = { turn: state.turn, side, text }
  if (page) entry.page = page
  state.log.push(entry)
}

function dispatch(state: GameState, action: Action): Refusal | null {
  switch (action.kind) {
    case 'deploy':
      return deploy(state, action)
    case 'ready':
      return ready(state, action.side)
    case 'choose-first':
      return chooseFirst(state, action.side, action.first)
    case 'activate':
      return activate(state, action.side, action.unitId)
    case 'move':
      return move(state, action)
    case 'posture':
      return posture(state, action.side, action.elementId, action.posture)
    case 'fire':
      return fire(state, action.side, action.shots)
    case 'repair':
      return repair(state, action.side, action.elementId)
    case 'rally':
      return rally(state, action.side, action.unitId)
    case 'regroup':
      return regroup(state, action.side, action.intoUnitId)
    case 'end-activation':
      return endActivation(state, action.side)
    case 'opportunity-fire':
      return opportunityFire(state, action.side, action.unitId, action.shots)
    case 'decline-opportunity':
      return declineOpportunity(state, action.side, !!action.forActivation)
    case 'pass':
      return pass(state, action.side)
    case 'done':
      return done(state, action.side)
    case 'call-orbital':
      return callOrbital(state, action)
    case 'orbital-strike':
      return orbitalStrike(state, action.side)
    case 'declare-end':
      return declareEnd(state, action.side)
  }
}

// ---------------------------------------------------------------------------
// Deployment and the turn
// ---------------------------------------------------------------------------

function deploy(state: GameState, action: Extract<Action, { kind: 'deploy' }>): Refusal | null {
  if (state.phase !== 'deployment') return refuse('Deployment is over.', 'p. 17')
  if (state.sides[action.side].ready) return refuse('This side has finished deploying.', 'p. 17')
  const el = state.elements[action.elementId]
  if (!el || el.sideId !== action.side) return refuse('Not one of your elements.', 'p. 17')
  if (!inDeploymentZone(state.setup, action.side, action.position)) return refuse(state.setup.battle === 'encounter' || action.side === state.setup.attacker ? `Deploy within ${DEPLOY_DEPTH}" of your own baseline.` : "The defender deploys in the main battle area and its own rear area.", 'p. 17')
  el.position = { x: action.position.x, y: action.position.y }
  el.facing = ((action.facing % 360) + 360) % 360
  el.wood = woodAt(el.position, state.setup.table.terrain)?.where ?? null
  return null
}

function ready(state: GameState, side: SideId): Refusal | null {
  if (state.phase !== 'deployment') return refuse('Deployment is over.', 'p. 17')
  state.sides[side].ready = true
  log(state, side, `${state.sides[side].name} is deployed.`)
  if (state.sides.north.ready && state.sides.south.ready) startTurn(state)
  return null
}

function startTurn(state: GameState): void {
  state.turn += 1
  state.phase = 'turn-start'
  state.activation = null
  state.owed = 0
  if (state.orbit) state.orbit.spent = {}
  for (const unit of Object.values(state.units)) unit.activated = false
  for (const side of Object.values(state.sides)) side.done = false
  const north = liveUnits(state, 'north').length
  const south = liveUnits(state, 'south').length
  if (north === 0 || south === 0) {
    finish(state, north === 0 && south === 0 ? 'draw' : north === 0 ? 'south' : 'north', 'the other side has no unit left on the table')
    return
  }
  let chooser: SideId
  if (north !== south) chooser = north < south ? 'north' : 'south'
  else {
    // Equal numbers: the book leaves it to the players; a die each, the higher chooses.
    let a = 0
    let b = 0
    while (a === b) {
      a = rollD6(state.rng)
      b = rollD6(state.rng)
    }
    chooser = a > b ? 'north' : 'south'
    log(state, null, `Turn ${state.turn}: equal units on the table; ${state.sides.north.name} rolls ${a}, ${state.sides.south.name} ${b}.`, 'p. 18')
  }
  state.chooser = chooser
  state.toAct = chooser
  log(state, null, `Turn ${state.turn}. ${state.sides[chooser].name} has ${north === south ? 'won the roll and' : 'fewer units and'} chooses who activates first.`, 'p. 18')
}

function chooseFirst(state: GameState, side: SideId, first: SideId): Refusal | null {
  if (state.phase !== 'turn-start') return refuse('The turn has started.', 'p. 18')
  if (state.chooser !== side) return refuse(`${state.sides[state.chooser!].name} chooses this turn.`, 'p. 18')
  state.phase = 'activation'
  state.toAct = first
  log(state, side, `${state.sides[side].name} has ${state.sides[first].name} activate first.`, 'p. 18')
  settleTurnFlow(state, first, false)
  return null
}

/**
 * Hand the next activation to whoever it belongs to (p. 17–19): a passed
 * side is owed two in succession; a side with nothing left, or that has
 * declared itself done, is skipped; when nobody can act the turn ends.
 */
function settleTurnFlow(state: GameState, current: SideId, justActed: boolean): void {
  if (state.result) return
  const can = (s: SideId) => canActivate(state, s) || strikesDue(state, s).length > 0
  const other = otherSide(current)
  if (justActed && state.owed > 0) state.owed -= 1
  let next: SideId | null
  if (justActed && state.owed > 0 && can(current)) next = current
  else if (justActed) next = can(other) ? other : can(current) ? current : null
  else next = can(current) ? current : can(other) ? other : null
  if (next === null) {
    endTurn(state)
    return
  }
  if (next !== current) state.owed = 0
  state.toAct = next
}

/** A side that has not declared itself done and still has a unit to activate (p. 18). */
function canActivate(state: GameState, side: SideId): boolean {
  return !state.sides[side].done && unactivatedUnits(state, side).length > 0
}

/**
 * Orbital fire the side has called that is due to arrive (p. 39): the
 * opponent has made an activation since, or has none left to make this turn.
 */
export function strikesDue(state: GameState, side: SideId): OrbitalStrike[] {
  if (!state.orbit) return []
  const opponentFinished = !canActivate(state, otherSide(side))
  return state.orbit.strikes.filter((s) => s.side === side && (s.opponentActed || opponentFinished))
}

/** An activation by `side` is over: fire the other side called is now due (p. 39). */
function activationMade(state: GameState, side: SideId): void {
  for (const strike of state.orbit?.strikes ?? []) if (strike.side !== side) strike.opponentActed = true
}

function mustBringDownFire(state: GameState, side: SideId): Refusal | null {
  return strikesDue(state, side).length > 0 ? refuse('The orbital fire you called is due: bring it down first.', 'p. 39') : null
}

function endTurn(state: GameState): void {
  log(state, null, `Turn ${state.turn} ends: every command marker is turned face up.`, 'p. 19')
  const limit = state.setup.turnLimit
  if (limit !== null && state.turn >= limit) {
    const values = objectiveValues(state)
    finish(state, values.north === values.south ? 'draw' : values.north > values.south ? 'north' : 'south', `turn ${limit} is over`)
    return
  }
  startTurn(state)
}

function finish(state: GameState, winner: SideId | 'draw', reason: string): void {
  const values = objectiveValues(state)
  state.result = { winner, reason, values }
  state.phase = 'ended'
  state.toAct = null
  state.activation = null
  log(state, null, winner === 'draw' ? `A draw: ${reason}. Objectives ${values.north} to ${values.south}.` : `${state.sides[winner].name} wins: ${reason}. Objectives ${values.north} to ${values.south}.`, 'p. 17')
}

function pass(state: GameState, side: SideId): Refusal | null {
  if (state.phase !== 'activation' || state.toAct !== side || state.activation) return refuse('Not your activation to pass.', 'p. 17')
  const due = mustBringDownFire(state, side)
  if (due) return due
  if (!canPass(state, side)) return refuse('A player may pass only with fewer unactivated units than the opponent.', 'p. 17')
  const other = otherSide(side)
  state.owed = 2
  state.toAct = other
  log(state, side, `${state.sides[side].name} passes; ${state.sides[other].name} must activate two units in succession.`, 'p. 17')
  return null
}

function done(state: GameState, side: SideId): Refusal | null {
  if (state.phase !== 'activation' || state.toAct !== side || state.activation) return refuse('Not your activation to give up.', 'p. 18')
  const due = mustBringDownFire(state, side)
  if (due) return due
  state.sides[side].done = true
  log(state, side, `${state.sides[side].name} makes no more activations this turn.`, 'p. 18')
  settleTurnFlow(state, side, false)
  return null
}

/** The third of the table adjoining a side's baseline (p. 17). */
export function inRearArea(setup: GameSetup, side: SideId, point: Point): boolean {
  const depth = setup.table.depth
  return side === 'north' ? point.y <= depth / 3 : point.y >= (2 * depth) / 3
}

function declareEnd(state: GameState, side: SideId): Refusal | null {
  if (state.phase === 'deployment' || state.phase === 'ended') return refuse('The battle is not under way.', 'p. 17')
  const setup = state.setup
  if (setup.battle === 'attack-defence' && side !== (setup.attacker ?? 'north')) return refuse('In an attack/defence battle only the attacker may declare game end.', 'p. 17')
  const total = setup.table.objectives.length
  const mine = setup.table.objectives.filter((o) => state.objectives[o.id]?.heldBy === side)
  if (total === 0 || mine.length * 2 <= total) return refuse('Game end may be declared only while holding more than half of the objective markers.', 'p. 17')
  if (setup.battle === 'encounter' && !mine.some((o) => inRearArea(setup, otherSide(side), o.position))) return refuse("Game end in an encounter needs at least one marker held in the opponent's rear area.", 'p. 17')
  const values = objectiveValues(state)
  finish(state, values.north === values.south ? 'draw' : values.north > values.south ? 'north' : 'south', `${state.sides[side].name} declares game end holding ${mine.length} of ${total} objectives`)
  return null
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

function activate(state: GameState, side: SideId, unitId: string): Refusal | null {
  if (state.phase !== 'activation') return refuse('No activations now.', 'p. 18')
  if (state.toAct !== side) return refuse(`It is ${state.sides[state.toAct!].name}'s activation.`, 'p. 18')
  if (state.activation) return refuse('An activation is under way; end it first.', 'p. 18')
  const due = mustBringDownFire(state, side)
  if (due) return due
  const unit = state.units[unitId]
  if (!unit || unit.sideId !== side) return refuse('Not one of your units.', 'p. 18')
  if (unit.activated) return refuse(`${unit.name} has used its activation this turn.`, 'p. 18')
  if (!elementsOf(state, unit).some(functional)) return refuse(`${unit.name} has no element left.`, 'p. 18')
  if (unit.panic) {
    unit.panic = false
    unit.activated = true
    unit.underFire = false
    state.activationCount += 1
    log(state, side, `${unit.name} spends its activation recovering from panic.`, 'p. 23')
    activationMade(state, side)
    settleTurnFlow(state, side, true)
    return null
  }
  unit.evasive = false
  const elements: Record<string, ActivationElement> = {}
  for (const e of elementsOf(state, unit)) elements[e.id] = { startPosition: { ...e.position }, factorsUsed: 0, moved: false, fired: false, firedBeforeMoving: false, evasive: false, travel: false }
  state.activation = { unitId, sideId: side, elements, moveTest: null, advanceTest: null, effectiveness: null, window: null, windowsWaived: false, repairTried: [] }
  log(state, side, `${unit.name} activates${unit.underFire ? ' (under fire)' : ''}.`, 'p. 18')
  return null
}

function activeUnit(state: GameState, side: SideId): { unit: UnitState; activation: ActivationState } | Refusal {
  const activation = state.activation
  if (state.phase !== 'activation' || !activation) return refuse('No unit is activated.', 'p. 18')
  if (activation.sideId !== side) return refuse('Not your activation.', 'p. 18')
  if (activation.window) return refuse(`${state.sides[activation.window.sideId].name} is deciding on opportunity fire.`, 'p. 20')
  return { unit: state.units[activation.unitId]!, activation }
}

function move(state: GameState, action: Extract<Action, { kind: 'move' }>): Refusal | null {
  const got = activeUnit(state, action.side)
  if ('ok' in got) return got
  const { unit, activation } = got
  const el = state.elements[action.elementId]
  if (!el || el.unitId !== unit.id) return refuse('That element is not in the activated unit.', 'p. 18')
  const record = activation.elements[el.id]!
  if (el.destroyed) return refuse(`${el.name} is knocked out.`, 'p. 30')
  if (el.immobilised) return refuse(`${el.name} is immobilised.`, 'p. 30')
  if (action.path.length === 0) return refuse('A move needs somewhere to go.', 'p. 25')
  if (activation.moveTest === 'failed') return refuse(`${unit.name} failed its reaction test to move under fire.`, 'p. 24')
  if (action.travel && record.fired) return refuse('An element that has fired is deployed for action and cannot claim travel mode.', 'p. 25')
  if (action.travel && unit.underFire) return refuse('A unit under fire cannot claim travel mode.', 'p. 25')
  const kind = unitKind(state, unit)
  const restrictions = restrictionsOf(unit.confidence, kind)
  const end = action.path[action.path.length - 1]!
  for (const p of action.path) if (!onTable(p, state.setup.table)) return refuse('The move leaves the table.', 'p. 17')
  const enemyBefore = nearestEnemyDistance(state, action.side, el.position)
  const enemyAfter = nearestEnemyDistance(state, action.side, end)
  const advancing = enemyAfter < enemyBefore - 1e-9
  if (restrictions.mustWithdraw) {
    const base = baselineY(state.setup, action.side)
    if (Math.abs(end.y - base) >= Math.abs(el.position.y - base) - 1e-9) return refuse(`${unit.name} is routed and must withdraw towards its baseline.`, 'p. 22')
  }
  if (restrictions.noAdvance && advancing) return refuse(`${unit.name} is ${CONFIDENCE_LABELS[unit.confidence].toLowerCase()} and may not advance towards the enemy.`, 'p. 22')
  // The turn the command unit is lost, no unit may be given a change of orders: read as no move ending nearer the enemy (p. 24).
  if (advancing && state.sides[action.side].commandLostTurn === state.turn) return refuse(`${state.sides[action.side].name}'s command unit was lost this turn: no new offensive until the next turn.`, 'p. 24')

  // Reaction tests before the move (pp. 22–24): under fire, and shaken
  // infantry advancing or leaving cover. Threat levels are not cumulative:
  // whatever applies to this one move is a single test at the highest (p. 23).
  const leavingCover = inCover(state, el) && !inCover(state, el, end)
  const needsMoveTest = unit.underFire && activation.moveTest === null
  const needsAdvanceTest = restrictions.advanceTest && (advancing || leavingCover)
  if (needsAdvanceTest && activation.advanceTest === 'failed') return refuse(`${unit.name} failed its reaction test to advance this activation.`, 'p. 22')
  if (needsMoveTest || (needsAdvanceTest && activation.advanceTest === null)) {
    const threats: number[] = []
    const reasons: string[] = []
    if (needsMoveTest) {
      threats.push(kind === 'infantry' ? THREAT.infantryUnderFireMoving : THREAT.vehiclesUnderFireMoving)
      reasons.push('under fire')
    }
    if (needsAdvanceTest && activation.advanceTest === null) {
      threats.push(THREAT.shakenInfantryAdvancing)
      reasons.push(advancing ? 'shaken and advancing' : 'shaken and leaving cover')
    }
    const threat = Math.max(...threats)
    const test = reactionTest(unit.quality, unit.leadership, threat, state.rng)
    if (needsMoveTest) activation.moveTest = test.passed ? 'passed' : 'failed'
    if (needsAdvanceTest) activation.advanceTest = test.passed ? 'passed' : 'failed'
    log(state, action.side, `${unit.name}, ${reasons.join(' and ')}, tests to move at +${threat}: D${test.die} rolls ${test.roll} against ${test.needed} — ${test.passed ? 'it moves' : 'the troops stay put'}.`, needsMoveTest ? 'p. 24' : 'p. 22')
    if (!test.passed) return null
  }

  const family = el.vehicle ? mobilityFamily(el.vehicle.mobility) : 'infantry'
  const bmf = baseMovement(el)
  if (bmf <= 0) return refuse(`${el.name} has no ground movement.`, 'p. 25')
  const allowance = el.damaged ? bmf / 2 : bmf
  const cap = record.firedBeforeMoving ? Math.min(allowance, bmf / 2) : allowance
  // Powered infantry take open water as poor going where other infantry cannot enter it (p. 26): the amphibious exception in the table.
  const wades = !!el.vehicle?.amphibious || el.infantry?.troops === 'powered'
  const cost = pathCost([el.position, ...action.path], family, state.setup.table.terrain, { amphibious: wades, travel: !!action.travel })
  if (cost.blockedAt) return refuse(`${cost.blockedBy?.replace('-', ' ')} is impassable to ${el.name}.`, 'p. 25')
  // An element on the edge of a wood it cannot pass leaves straight out by the point it entered (p. 25).
  if (el.woodEntry) {
    const first = action.path[0]!
    if (distance(first, el.woodEntry) > 0.5) return refuse(`${el.name} took cover at the treeline and must move straight back out through the point it entered.`, 'p. 25')
    if (cost.intoWood) return refuse(`${el.name} may not move along the wood; it leaves the way it came.`, 'p. 25')
  }
  if (record.factorsUsed + cost.factors > cap + 1e-9) {
    const why = record.firedBeforeMoving ? 'having fired without the movement penalty, it may move at most half its base movement' : el.damaged ? 'a damaged vehicle moves at half speed' : `its base movement is ${bmf}`
    return refuse(`That path costs ${cost.factors.toFixed(1)} factors and ${el.name} has ${(cap - record.factorsUsed).toFixed(1)} left: ${why}.`, record.firedBeforeMoving ? 'p. 28' : el.damaged ? 'p. 30' : 'p. 25')
  }
  if (action.evasive) {
    if (!el.vehicle || !['fast-gev', 'grav'].includes(el.vehicle.mobility)) return refuse('Only fast GEVs and grav vehicles move evasively.', 'p. 26')
    if (cost.legs.some((l) => l.going !== 'easy' && l.going !== 'normal')) return refuse('Evasive movement needs easy or normal going all the way.', 'p. 27')
  }
  // Integrity: a disorganised unit moves only to close up (p. 23) — each
  // element that moves must end within integrity distance of a unit-mate.
  if (!isOrganised(state, unit)) {
    const limit = INTEGRITY[kind]
    const mates = elementsOf(state, unit).filter((o) => o.id !== el.id && mobile(o))
    if (mates.length > 0 && !mates.some((o) => distance(o.position, end) <= limit + 1e-9)) return refuse(`${unit.name} is disorganised: this move must bring ${el.name} back within ${limit}" of the unit.`, 'p. 23')
  }

  const crater = falloutBreach(el, action.path, state.orbit?.nukes ?? [])
  if (crater) return refuse(`${el.name} is not protected against the fallout and may not come within ${NUKE_EXCLUSION}" of an orbital strike's ground zero.`, 'More Thrust p. 17')

  const wasDugIn = el.dugIn
  const from = { ...el.position }
  el.position = { ...end }
  const last = action.path.length >= 2 ? action.path[action.path.length - 2]! : from
  el.facing = action.facing !== undefined ? ((action.facing % 360) + 360) % 360 : cost.length > 0 ? bearing(last, end) : el.facing
  // A prepared position stays on the table when it is left, and either side may re-occupy it (p. 20).
  if (wasDugIn && !state.prepared.some((q) => distance(q, from) < 0.01)) state.prepared.push(from)
  el.dugIn = state.prepared.some((q) => distance(q, end) <= 0.5)
  el.posture = 'none'
  el.woodEntry = cost.intoWood ? (el.woodEntry ?? cost.woodEntry ?? { ...from }) : null
  el.wood = woodAt(el.position, state.setup.table.terrain)?.where ?? null
  record.factorsUsed += cost.factors
  record.moved = true
  if (action.evasive) record.evasive = true
  if (action.travel) record.travel = true
  const legs = cost.legs.map((l) => `${l.length.toFixed(1)}" ${l.terrain.replace('-', ' ')} (${l.going})`).join(', ')
  log(state, action.side, `${el.name} moves ${cost.length.toFixed(1)}" for ${cost.factors.toFixed(1)} of ${cap} factors: ${legs}${action.evasive ? '; evading' : ''}${action.travel ? '; travel mode' : ''}${wasDugIn ? '; leaves its prepared position' : ''}${el.dugIn ? '; occupies a prepared position' : ''}.`, 'p. 25')
  if (el.wood === 'within') log(state, action.side, `${el.name} is within the wood: it can neither fire nor be fired on.`, 'p. 20')
  takeObjectives(state, action.side, [record.startPosition, ...action.path].slice(-(action.path.length + 1)), el)
  openWindow(state, activation, el)
  return null
}

function takeObjectives(state: GameState, side: SideId, path: Point[], el: ElementState): void {
  for (const o of state.setup.table.objectives) {
    let near = false
    for (let i = 1; i < path.length; i++) if (distanceToSegment(o.position, path[i - 1]!, path[i]!) <= OBJECTIVE_REACH) near = true
    if (path.length === 1 && distance(o.position, path[0]!) <= OBJECTIVE_REACH) near = true
    if (!near) continue
    const held = state.objectives[o.id]!
    if (held.heldBy === side) continue
    held.heldBy = side
    log(state, side, `${el.name} takes objective ${o.id} (value ${o.value}).`, 'p. 17')
  }
}

/** After a move, the other side may fire on the moving unit (p. 20) if it has a unit that could. */
function openWindow(state: GameState, activation: ActivationState, moved: ElementState): void {
  if (activation.windowsWaived) return
  const enemy = otherSide(activation.sideId)
  const could = unactivatedUnits(state, enemy).some((u) => {
    if (u.panic || u.evasive) return false
    if (!restrictionsOf(u.confidence, unitKind(state, u)).returnFire) return false
    return elementsOf(state, u).some((e) => functional(e) && !e.systemsDown && lineOfSight(e.position, moved.position, state.setup.table.terrain).clear)
  })
  if (!could) return
  activation.window = { sideId: enemy, movedElementId: moved.id }
  state.toAct = enemy
}

function declineOpportunity(state: GameState, side: SideId, forActivation: boolean): Refusal | null {
  const activation = state.activation
  if (!activation?.window || activation.window.sideId !== side) return refuse('No opportunity fire is offered to you.', 'p. 20')
  activation.window = null
  if (forActivation) activation.windowsWaived = true
  state.toAct = activation.sideId
  return null
}

function opportunityFire(state: GameState, side: SideId, unitId: string, shots: ShotOrder[]): Refusal | null {
  const activation = state.activation
  if (!activation?.window || activation.window.sideId !== side) return refuse('No opportunity fire is offered to you.', 'p. 20')
  const unit = state.units[unitId]
  if (!unit || unit.sideId !== side) return refuse('Not one of your units.', 'p. 20')
  if (unit.activated) return refuse(`${unit.name} has used its activation and cannot fire opportunity fire.`, 'p. 20')
  if (shots.length === 0) return refuse('Name at least one shot.', 'p. 20')
  for (const s of shots) {
    const t = state.elements[s.targetId]
    if (!t || t.unitId !== activation.unitId) return refuse('Opportunity fire is against the unit being moved.', 'p. 20')
    const f = state.elements[s.elementId]
    if (!f || f.unitId !== unit.id) return refuse('Every firer must belong to the unit firing.', 'p. 20')
    // "Able to engage the moving unit with direct-fire weaponry" (p. 20): guns and IAVRs, not a firefight's rifles and APSWs.
    if (s.weapon.kind !== 'direct' && s.weapon.kind !== 'iavr') return refuse('Opportunity fire is direct fire: guns and IAVRs, not a firefight.', 'p. 20')
  }
  const outcome = resolveVolley(state, side, unit, shots, { opportunity: true })
  if (outcome) return outcome
  unit.activated = true
  unit.underFire = false
  state.activationCount += 1
  log(state, side, `${unit.name}'s command marker is inverted: opportunity fire was its activation.`, 'p. 20')
  activation.window = null
  state.toAct = activation.sideId
  return null
}

function posture(state: GameState, side: SideId, elementId: string, next: ElementState['posture']): Refusal | null {
  const got = activeUnit(state, side)
  if ('ok' in got) return got
  const el = state.elements[elementId]
  if (!el || el.unitId !== got.unit.id) return refuse('That element is not in the activated unit.', 'p. 18')
  if (!el.vehicle) return refuse('Only a vehicle goes hull down or turret down.', 'p. 29')
  if (el.destroyed) return refuse(`${el.name} is knocked out.`, 'p. 30')
  if (el.systemsDown) return refuse(`${el.name} is systems down and may take no action but moving.`, 'p. 30')
  if (next !== 'none' && !touchesCover(state, el.position)) return refuse('Cover is claimed by contact with a hilltop, ridgeline, wood edge or buildings.', 'p. 20')
  el.posture = next
  if (next !== 'none') log(state, side, `${el.name} goes ${next.replace('-', ' ')}.`, 'p. 29')
  return null
}

function repair(state: GameState, side: SideId, elementId: string): Refusal | null {
  const got = activeUnit(state, side)
  if ('ok' in got) return got
  const el = state.elements[elementId]
  if (!el || el.unitId !== got.unit.id) return refuse('That element is not in the activated unit.', 'p. 18')
  if (el.destroyed) return refuse(`${el.name} is knocked out.`, 'p. 30')
  if (!el.systemsDown) return refuse(`${el.name}'s systems are up.`, 'p. 32')
  if (el.systemsDownAt !== null && el.systemsDownAt >= state.activationCount) return refuse('Repairs are attempted in an activation after the one in which the damage was done.', 'p. 32')
  if (got.activation.repairTried.includes(el.id)) return refuse(`${el.name} has tried once this activation.`, 'p. 32')
  got.activation.repairTried.push(el.id)
  const need = el.vehicle?.backupSystems ? 3 : 6
  const rolled = rollD6(state.rng)
  if (rolled >= need) {
    el.systemsDown = false
    el.systemsDownAt = null
  }
  log(state, side, `${el.name} tries to bring its systems back: D6 rolls ${rolled}, needing ${need}${el.vehicle?.backupSystems ? ' with backup systems' : ''} — ${rolled >= need ? 'systems up' : 'still down'}.`, el.vehicle?.backupSystems ? 'p. 45' : 'p. 32')
  return null
}

function rally(state: GameState, side: SideId, unitId: string): Refusal | null {
  if (state.phase !== 'activation' || state.toAct !== side || state.activation) return refuse('Rallying takes an activation of your own.', 'p. 24')
  const unit = state.units[unitId]
  if (!unit || unit.sideId !== side) return refuse('Not one of your units.', 'p. 24')
  if (unit.activated) return refuse(`${unit.name} has used its activation this turn.`, 'p. 24')
  if (unit.confidence === 'CO') return refuse(`${unit.name} is already confident.`, 'p. 24')
  const command = commandUnitOf(state, side)
  if (!command || state.sides[side].commandLost) return refuse('Without a command unit on the table no rallying may be attempted.', 'p. 24')
  if (command.id === unit.id) return refuse('The command unit rallies other units.', 'p. 24')
  const test = rallyTest(unit.quality, unit.leadership, command.leadership, state.rng)
  if (test.passed) unit.confidence = raiseConfidence(unit.confidence)
  unit.activated = true
  unit.underFire = false
  state.activationCount += 1
  log(state, side, `${command.name} rallies ${unit.name}: D${test.die} rolls ${test.roll} against ${test.needed} — ${test.passed ? `confidence rises to ${CONFIDENCE_LABELS[unit.confidence]}` : 'no change'}. The attempt was ${unit.name}'s activation.`, 'p. 24')
  settleTurnFlow(state, side, true)
  return null
}

/**
 * Regrouping (p. 24): the activated, depleted unit has moved within
 * integrity distance of another unit that has not yet activated; both
 * activations are spent and the two become one unit with the better
 * leadership, the quality of the larger, and the average confidence
 * rounded towards the worse.
 */
function regroup(state: GameState, side: SideId, intoUnitId: string): Refusal | null {
  const got = activeUnit(state, side)
  if ('ok' in got) return got
  const { unit, activation } = got
  const into = state.units[intoUnitId]
  if (!into || into.sideId !== side || into.id === unit.id) return refuse('Regroup with another unit of your own.', 'p. 24')
  if (into.activated) return refuse(`${into.name} has already activated this turn; the regrouping waits until the next turn.`, 'p. 24')
  if (!elementsOf(state, into).some(functional)) return refuse(`${into.name} has no element left.`, 'p. 24')
  if (Object.values(activation.elements).some((r) => r.fired)) return refuse('A unit that regroups may not perform a combat action as well as its movement.', 'p. 24')
  const mine = elementsOf(state, unit).filter(functional)
  const theirs = elementsOf(state, into).filter(functional)
  const limit = INTEGRITY[unitKind(state, into)]
  if (!mine.every((e) => theirs.some((o) => distance(e.position, o.position) <= limit + 1e-9))) return refuse(`Every element must be within ${limit}" of ${into.name} to regroup.`, 'p. 24')
  const larger = theirs.length >= mine.length ? into : unit
  const leadership = Math.min(unit.leadership, into.leadership) as UnitState['leadership']
  const average = Math.ceil((CONFIDENCE_LEVELS_INDEX[unit.confidence] + CONFIDENCE_LEVELS_INDEX[into.confidence]) / 2)
  const confidence = lowerConfidence('CO', average)
  const wasQuality = into.quality
  into.quality = larger.quality
  into.leadership = leadership
  into.confidence = confidence
  into.strength += unit.strength
  into.casualties += unit.casualties
  into.underFire = into.underFire || unit.underFire
  into.contacted = into.contacted || unit.contacted
  into.firstLossTaken = into.firstLossTaken || unit.firstLossTaken
  for (const e of elementsOf(state, unit)) {
    e.unitId = into.id
    into.elementIds.push(e.id)
  }
  delete state.units[unit.id]
  into.activated = true
  into.underFire = false
  state.activation = null
  state.activationCount += 1
  log(state, side, `${unit.name} regroups into ${into.name}: ${into.elementIds.filter((id) => functional(state.elements[id]!)).length} elements, ${into.quality === wasQuality ? into.quality : `${into.quality} (the larger unit's)`} ${into.leadership}, ${CONFIDENCE_LABELS[confidence]}. Both activations are spent.`, 'p. 24')
  settleTurnFlow(state, side, true)
  return null
}

function endActivation(state: GameState, side: SideId): Refusal | null {
  const got = activeUnit(state, side)
  if ('ok' in got) return got
  const { unit, activation } = got
  const members = elementsOf(state, unit).filter(mobile)
  const evaders = members.filter((e) => activation.elements[e.id]?.evasive)
  if (evaders.length > 0) {
    if (evaders.length !== members.length) return refuse('Either every element of the unit evades or none does.', 'p. 27')
    for (const e of evaders) {
      const record = activation.elements[e.id]!
      if (record.factorsUsed < EVASIVE_SHARE * baseMovement(e) - 1e-9) return refuse(`${e.name} must use at least 75% of its movement to evade.`, 'p. 27')
    }
    unit.evasive = true
    log(state, side, `${unit.name} is evading until its next activation.`, 'p. 27')
  }
  unit.activated = true
  // "Invert the Command Marker and then remove any UNDER FIRE markers" (p. 19); the same when an activation is spent any other way.
  unit.underFire = false
  state.activation = null
  state.activationCount += 1
  log(state, side, `${unit.name} ends its activation; its command marker is inverted.`, 'p. 19')
  activationMade(state, side)
  settleTurnFlow(state, side, true)
  return null
}

// ---------------------------------------------------------------------------
// Fire
// ---------------------------------------------------------------------------

function fire(state: GameState, side: SideId, shots: ShotOrder[]): Refusal | null {
  const got = activeUnit(state, side)
  if ('ok' in got) return got
  if (shots.length === 0) return refuse('Name at least one shot.', 'p. 28')
  for (const s of shots) {
    const f = state.elements[s.elementId]
    if (!f || f.unitId !== got.unit.id) return refuse('Every firer must belong to the activated unit.', 'p. 18')
  }
  return resolveVolley(state, side, got.unit, shots, { opportunity: false })
}

interface UnitHit {
  unit: UnitState
  hit: Set<string>
  leaderDestroyed: boolean
  antiPersonnel: boolean
  attacked: boolean
  /** Caught in an artillery beaten zone (p. 39). */
  bombarded?: boolean
}

/**
 * A volley: every shot is planned before any is resolved (p. 28), then
 * each is rolled in turn, a shot at a target already knocked out being
 * wasted. Afterwards the units hit take their tests (p. 23–24).
 */
function resolveVolley(state: GameState, side: SideId, unit: UnitState, shots: ShotOrder[], opts: { opportunity: boolean }): Refusal | null {
  const activation = opts.opportunity ? null : state.activation
  const seen = new Set<string>()
  const plans: TableShotPlan[] = []
  for (const order of shots) {
    if (seen.has(order.elementId)) return refuse('An element fires one weapon system per combat action.', 'p. 18')
    seen.add(order.elementId)
    const plan = planTableShot(state, order, { activation: activation ? activation.elements[order.elementId]! : null, opportunity: opts.opportunity })
    if (!plan.ok) return plan
    plans.push(plan)
  }

  // Infantry fire effectiveness (p. 33): the unit rolls once, before it draws.
  const infantryShots = plans.filter((p) => p.kind === 'chits' && p.weapon !== 'iavr' && !!p.firer.infantry)
  let cap = Number.POSITIVE_INFINITY
  let ineffective = false
  if (infantryShots.length > 0) {
    let eff = activation?.effectiveness ?? null
    if (!eff) {
      const base = QUALITY_DIE[unit.quality]
      const die = unit.underFire ? (stepDie(base, -1) ?? 4) : base
      const rolled = roll(die, state.rng)
      const result = rolled < unit.leadership ? 'ineffective' : rolled < 2 * unit.leadership ? 'partial' : 'full'
      // Half of the elements in range and able to fire (p. 33): counted over the whole unit, not the shots named so far.
      const eligible = Math.max(infantryShots.length, eligibleFirefighters(state, unit, activation))
      eff = { die, roll: rolled, result, cap: result === 'partial' ? Math.ceil(eligible / 2) : null, used: 0 }
      if (activation) activation.effectiveness = eff
      log(state, side, `${unit.name} checks fire effectiveness: D${die}${unit.underFire ? ' (under fire)' : ''} rolls ${rolled} against leadership ${unit.leadership} — ${result === 'full' ? 'fully effective' : result === 'partial' ? `partially effective, ${eff.cap} element${eff.cap === 1 ? '' : 's'} may draw` : 'ineffective: no casualties, but the target is under fire'}.`, 'p. 33')
    }
    ineffective = eff.result === 'ineffective'
    cap = eff.cap === null ? Number.POSITIVE_INFINITY : Math.max(0, eff.cap - eff.used)
  }

  const hits = new Map<string, UnitHit>()
  const touch = (target: ElementState) => {
    const u = state.units[target.unitId]!
    let h = hits.get(u.id)
    if (!h) {
      h = { unit: u, hit: new Set(), leaderDestroyed: false, antiPersonnel: false, attacked: false }
      hits.set(u.id, h)
    }
    return h
  }
  const casualty = (target: ElementState, h: UnitHit, before: { damaged: boolean; destroyed: boolean }) => {
    if ((target.damaged && !before.damaged) || (target.destroyed && !before.destroyed)) h.hit.add(target.id)
    if (target.destroyed && !before.destroyed && h.unit.leaderElementId === target.id) h.leaderDestroyed = true
  }

  for (const plan of plans) {
    const firer = plan.firer
    const target = state.elements[plan.target.id]!
    const record = activation?.elements[firer.id]
    if (record) {
      record.fired = true
      if (!record.moved) record.firedBeforeMoving = true
    }
    const h = touch(target)
    h.attacked = true
    if (target.destroyed) {
      log(state, side, `${firer.name} fires at ${target.name}, already out of action: the shot is wasted.`, 'p. 28')
      continue
    }
    const before = { damaged: target.damaged, destroyed: target.destroyed }
    if (plan.kind === 'direct') {
      if (target.infantry) h.antiPersonnel = true
      const result = fireShot(plan.shot, state.rng)
      if ('ok' in result) return result
      for (const line of narrateShot(result)) log(state, side, `${firer.name} → ${target.name}: ${line}`, 'p. 29')
      if (result.kind === 'vehicle' && plan.plan.weapon.type === 'slam' && plan.plan.band !== 'close' && result.hits > 0) slamSplash(state, side, plan, result.hits, hits, touch, casualty)
      if (result.kind === 'vehicle') {
        const o = result.outcome
        if (o.knockedOut) {
          target.destroyed = true
          target.damaged = false
          target.immobilised = false
          target.systemsDown = false
        } else {
          if (o.damaged) target.damaged = true
          if (o.immobilised) target.immobilised = true
          if (o.systemsDown) {
            target.systemsDown = true
            target.systemsDownAt = state.activationCount
          }
        }
        if (o.firerSystemsDown) {
          firer.systemsDown = true
          firer.systemsDownAt = state.activationCount
        }
      } else if (result.killed) target.destroyed = true
    } else {
      // Rifles, APSW, IAVR.
      const isInfantryFire = plan.weapon !== 'iavr' && !!firer.infantry
      if (plan.weapon !== 'iavr') h.antiPersonnel = true
      if (isInfantryFire && (ineffective || cap <= 0)) {
        log(state, side, `${firer.name} fires at ${target.name}: ${ineffective ? 'ineffective fire, no chits drawn' : 'beyond the partially effective half, no chits drawn'}.`, 'p. 33')
        continue
      }
      if (isInfantryFire) {
        cap -= 1
        if (activation?.effectiveness) activation.effectiveness.used += 1
      }
      const result = resolveChitShot(plan, state.rng)
      if (result.infantry) {
        log(state, side, `${firer.name} → ${target.name} (${plan.weapon}): ${describeInfantryHit(result.infantry)}`, plan.weapon === 'iavr' ? 'p. 36' : 'p. 33')
        if (result.infantry.killed) target.destroyed = true
      } else if (result.vehicle) {
        log(state, side, `${firer.name} → ${target.name} (${plan.weapon}): ${describeVehicleHit(result.vehicle)}`, 'p. 36')
        const v = result.vehicle
        if (v.knockedOut) target.destroyed = true
        else {
          if (v.damaged) target.damaged = true
          if (v.immobilised) target.immobilised = true
          if (v.systemsDown) {
            target.systemsDown = true
            target.systemsDownAt = state.activationCount
          }
        }
      }
    }
    casualty(target, h, before)
  }

  for (const h of hits.values()) afterAttack(state, h)
  return null
}

/** Rifle and APSW teams of the unit able to fire now: not yet fired, an enemy in range and in sight (p. 33). */
function eligibleFirefighters(state: GameState, unit: UnitState, activation: ActivationState | null): number {
  const enemies = Object.values(state.elements).filter((e) => e.sideId !== unit.sideId && functional(e))
  let count = 0
  for (const el of elementsOf(state, unit)) {
    if (!functional(el) || !el.infantry || !teamFiresRanged(el)) continue
    if (activation?.elements[el.id]?.fired) continue
    const reach = el.infantry.team === 'apsw' ? APSW_RANGE : rifleRange(el.infantry.troops)
    if (enemies.some((t) => distance(el.position, t.position) <= reach && lineOfSight(el.position, t.position, state.setup.table.terrain).clear)) count += 1
  }
  return count
}

/**
 * A SLAM salvo that hit at medium or long range may also hit any other
 * element within 1" or 2" of its target (p. 30): a D6 each, 5+ at medium,
 * 6 at long, and a hit draws the SLAM's chits. Infantry caught this way
 * draw chits equal to the class (p. 36).
 */
function slamSplash(state: GameState, side: SideId, plan: Extract<TableShotPlan, { kind: 'direct' }>, salvos: number, hits: Map<string, UnitHit>, touch: (t: ElementState) => UnitHit, casualty: (t: ElementState, h: UnitHit, before: { damaged: boolean; destroyed: boolean }) => void): void {
  const weapon = plan.plan.weapon
  const band = plan.plan.band
  const radius = band === 'medium' ? 1 : 2
  const need = band === 'medium' ? 5 : 6
  const target = state.elements[plan.target.id]!
  const nearby = Object.values(state.elements).filter((e) => e.id !== target.id && !e.destroyed && distance(e.position, target.position) <= radius)
  if (nearby.length === 0) return
  void hits
  for (let salvo = 0; salvo < salvos; salvo++) {
    for (const other of nearby) {
      if (other.destroyed) continue
      const rolled = rollD6(state.rng)
      if (rolled < need) {
        log(state, side, `${other.name}, ${distance(other.position, target.position).toFixed(1)}" from the salvo's target: D6 rolls ${rolled}, needs ${need} — missed.`, 'p. 30')
        continue
      }
      const h = touch(other)
      h.attacked = true
      const before = { damaged: other.damaged, destroyed: other.destroyed }
      const chits = drawChits(weapon.class, state.rng)
      if (other.vehicle) {
        const aspect = angleBetweenFacing(other, target)
        const armour = aspect === 'front' ? other.vehicle.armour : Math.max(0, other.vehicle.armour - 1)
        const hit = resolveVehicleHit(chits, validityOf('slam', band, { reactive: other.vehicle.armourSpecial === 'reactive' }), armour)
        log(state, side, `${other.name} is caught in the salvo (D6 ${rolled}): ${describeVehicleHit(hit)}`, 'p. 30')
        if (hit.knockedOut) other.destroyed = true
        else {
          if (hit.damaged) other.damaged = true
          if (hit.immobilised) other.immobilised = true
          if (hit.systemsDown) {
            other.systemsDown = true
            other.systemsDownAt = state.activationCount
          }
        }
      } else if (other.infantry) {
        h.antiPersonnel = true
        const validity = validityAgainstInfantry('slam') ?? firefightValidity(infantryPosition(state, other))
        const hit = resolveInfantryHit(chits, validity, INFANTRY_KILL_TOTAL[other.infantry.troops])
        log(state, side, `${other.name} is caught in the salvo (D6 ${rolled}): ${describeInfantryHit(hit)}`, 'p. 36')
        if (hit.killed) other.destroyed = true
      }
      casualty(other, h, before)
    }
  }
}

/** Which face of `other` the salvo strikes: from the direction of the salvo's target, as a stand-in for the firer. */
function angleBetweenFacing(other: ElementState, from: ElementState): 'front' | 'side' {
  const a = Math.abs((((bearing(other.position, from.position) - other.facing) % 360) + 540) % 360) - 180
  return Math.abs(a) <= 45 ? 'front' : 'side'
}

// ---------------------------------------------------------------------------
// Fire from orbit (pp. 38–40; More Thrust p. 17)
// ---------------------------------------------------------------------------

/**
 * A call for fire from a ship overhead (p. 38): the unit's commander or a
 * specialist observer, in sight of the aim point, as that element's combat
 * action; a D12 for an observer, D10/D8/D6 for a commander of leadership
 * 1/2/3, and off-table fire answers on 6 or more. Answered, the impact
 * marker goes down and the ship's attack is spent; the fire arrives after
 * the opponent's next activation (p. 39).
 *
 * [reading] More Thrust says a ship may fire "at any point on the
 * battlefield"; that is its reach, as all artillery reaches the whole table
 * (p. 37). Ortillery is otherwise an off-table battery (p. 40), so the call
 * is made as for one.
 */
function callOrbital(state: GameState, action: Extract<Action, { kind: 'call-orbital' }>): Refusal | null {
  const got = activeUnit(state, action.side)
  if ('ok' in got) return got
  const { unit, activation } = got
  const orbit = state.orbit
  const ship = orbitalShips(state, action.side).find((s) => s.id === action.shipId)
  if (!orbit || !ship) return refuse('No ship in orbit answers to your side.', 'More Thrust p. 17')
  const el = state.elements[action.elementId]
  if (!el || el.unitId !== unit.id) return refuse('The caller must belong to the activated unit.', 'p. 18')
  if (!functional(el)) return refuse(`${el.name} is out of action.`, 'p. 30')
  if (unit.leaderElementId !== el.id && el.infantry?.team !== 'observer') return refuse('Fire is called by a unit commander or a specialist observer team.', 'p. 38')
  if (el.systemsDown) return refuse(`${el.name}'s systems are down.`, 'p. 31')
  const record = activation.elements[el.id]!
  if (record.fired) return refuse(`${el.name} has taken its combat action.`, 'p. 18')
  if (record.travel) return refuse(`${el.name} moved in travel mode and cannot take a combat action.`, 'p. 25')
  if (restrictionsOf(unit.confidence, unitKind(state, unit)).noFire) return refuse(`${unit.name} is routed and takes no combat action.`, 'p. 22')
  if (!overhead(state, action.side)) {
    const next = nextOverhead(state, action.side)
    return refuse(`The ships are not overhead this turn${next ? `; next on turn ${next}` : ''}.`, 'More Thrust p. 17')
  }
  if (attacksLeft(state, ship)[action.attack] <= 0) return refuse(action.attack === 'pbm' ? `${ship.name} has no ortillery left to fire this turn.` : `${ship.name} has fired its sheafs this turn.`, 'More Thrust p. 17')
  if (!onTable(action.aim, state.setup.table)) return refuse('Aim at a point on the table.', 'p. 38')
  const sight = lineOfSight(el.position, action.aim, state.setup.table.terrain)
  if (!sight.clear) return refuse(`${el.name} cannot see the aim point: ${sight.reason}.`, 'p. 38')

  record.fired = true
  if (!record.moved) record.firedBeforeMoving = true
  const die = callDie(el, unit.leadership)
  const rolled = roll(die, state.rng)
  const who = el.infantry?.team === 'observer' ? 'the observer' : `leadership ${unit.leadership}`
  if (rolled < OFF_TABLE_CALL) {
    log(state, action.side, `${el.name} calls ${ship.name} for ${ATTACK_LABELS[action.attack]}: D${die} (${who}) rolls ${rolled}, needs ${OFF_TABLE_CALL} — no answer.`, 'p. 38')
    return null
  }
  const spent = orbit.spent[ship.id] ?? { sheafs: 0, ortillery: 0 }
  if (action.attack === 'sheaf') spent.sheafs += 1
  else spent.ortillery += 1
  orbit.spent[ship.id] = spent
  orbit.count += 1
  orbit.strikes.push({ id: `strike-${orbit.count}`, side: action.side, shipId: ship.id, attack: action.attack, aim: { ...action.aim }, calledBy: el.id, turn: state.turn, opponentActed: false })
  log(state, action.side, `${el.name} calls ${ship.name} for ${ATTACK_LABELS[action.attack]}: D${die} (${who}) rolls ${rolled} — the impact marker goes down at (${action.aim.x.toFixed(1)}, ${action.aim.y.toFixed(1)}); the fire arrives after the next enemy activation.`, 'p. 38')
  return null
}

/**
 * The fire arrives (pp. 39–40, More Thrust p. 17): each strike that is due
 * deviates on the clock and the D6-against-D8, then every element within its
 * beaten zone draws three chits (a sheaf) or four (ortillery) as HEF if
 * infantry and MAK if a vehicle; a NUKE marker is left at ground zero. It is
 * the side's turn, as activating the battery would be.
 */
function orbitalStrike(state: GameState, side: SideId): Refusal | null {
  if (state.phase !== 'activation' || state.toAct !== side) return refuse('Not your turn.', 'p. 18')
  if (state.activation) return refuse('An activation is under way; end it first.', 'p. 39')
  const due = strikesDue(state, side)
  if (due.length === 0) return refuse('No orbital fire is due.', 'p. 39')
  const orbit = state.orbit!
  for (const strike of due) {
    const ship = orbitalShips(state, side).find((s) => s.id === strike.shipId)
    const name = ship?.name ?? 'The ship'
    const dev = rollDeviation(strike.aim, state.rng)
    log(state, side, `${name}'s ${ATTACK_LABELS[strike.attack]} arrives: the clock rolls ${dev.clock}, D6 ${dev.d6} against D8 ${dev.d8} — ${dev.inches === 0 ? 'on the aim point' : `${dev.inches}" off towards ${dev.clock} o'clock`}.`, 'p. 40')
    const hits = new Map<string, UnitHit>()
    for (const target of caughtBy(state, dev.impact, strike.attack)) {
      const u = state.units[target.unitId]!
      let h = hits.get(u.id)
      if (!h) {
        h = { unit: u, hit: new Set(), leaderDestroyed: false, antiPersonnel: false, attacked: true, bombarded: true }
        hits.set(u.id, h)
      }
      const before = { damaged: target.damaged, destroyed: target.destroyed }
      const validity = strikeValidity(target)
      if (validity === null) {
        log(state, side, `${target.name} is dug in: MAK is ineffective against it.`, 'p. 29')
        continue
      }
      const chits = drawChits(STRIKE_CHITS[strike.attack], state.rng)
      if (target.infantry) {
        h.antiPersonnel = true
        const result = resolveInfantryHit(chits, validity, INFANTRY_KILL_TOTAL[target.infantry.troops])
        log(state, side, `${target.name} (HEF): ${describeInfantryHit(result)}`, 'p. 39')
        if (result.killed) target.destroyed = true
      } else {
        const result = resolveVehicleHit(chits, validity, strikeArmour(target))
        log(state, side, `${target.name} (MAK, top armour ${strikeArmour(target)}): ${describeVehicleHit(result)}`, 'p. 39')
        if (result.knockedOut) {
          target.destroyed = true
          target.damaged = false
          target.immobilised = false
          target.systemsDown = false
        } else {
          if (result.damaged) target.damaged = true
          if (result.immobilised) target.immobilised = true
          if (result.systemsDown) {
            target.systemsDown = true
            target.systemsDownAt = state.activationCount
          }
        }
      }
      if ((target.damaged && !before.damaged) || (target.destroyed && !before.destroyed)) h.hit.add(target.id)
      if (target.destroyed && !before.destroyed && u.leaderElementId === target.id) h.leaderDestroyed = true
    }
    if (hits.size === 0) log(state, side, 'Nothing is caught in the beaten zone.', 'p. 39')
    orbit.nukes.push(dev.impact)
    log(state, side, `A NUKE marker is left at ground zero: unprotected troops and vehicles may not come within ${NUKE_EXCLUSION}" of it for the rest of the game.`, 'More Thrust p. 17')
    for (const h of hits.values()) afterAttack(state, h)
  }
  orbit.strikes = orbit.strikes.filter((s) => !due.includes(s))
  activationMade(state, side)
  settleTurnFlow(state, side, true)
  return null
}

/** Markers and tests after one attack on a unit (pp. 23–24). */
function afterAttack(state: GameState, h: UnitHit): void {
  const unit = h.unit
  const side = unit.sideId
  const kind = unitKind(state, unit)
  const hit = h.hit.size
  // Under fire (p. 24): infantry by anti-personnel fire, vehicles only when
  // hurt; any unit with an element in an artillery beaten zone (p. 39).
  if ((kind === 'infantry' && h.antiPersonnel) || hit > 0 || h.bombarded) {
    if (!unit.underFire) log(state, side, `${unit.name} is under fire.`, 'p. 24')
    unit.underFire = true
  }
  // Panic (p. 23): a green unit's first contact.
  if (!unit.contacted) {
    unit.contacted = true
    if (unit.quality === 'green') {
      const test = reactionTest(unit.quality, unit.leadership, THREAT.panic, state.rng)
      if (!test.passed) unit.panic = true
      log(state, side, `${unit.name}, green, meets the enemy for the first time: D${test.die} rolls ${test.roll} against ${test.needed} — ${test.passed ? 'it holds' : 'it panics'}.`, 'p. 23')
    }
  }
  // Dismounted infantry under artillery attack test at +0 (p. 23), whatever it cost them; the highest threat is the one taken.
  const shelled = !!h.bombarded && kind === 'infantry'
  if (hit === 0 && !shelled) return
  unit.casualties += hit
  const casualties = hit > 0 ? casualtyThreat({ hit, total: unit.casualties, strength: unit.strength, firstLossTaken: unit.firstLossTaken, leaderDestroyed: h.leaderDestroyed }) : null
  if (hit > 0) unit.firstLossTaken = true
  const threat = shelled ? Math.max(casualties ?? THREAT.bombardmentOnInfantry, THREAT.bombardmentOnInfantry) : casualties
  if (threat !== null) {
    const test = confidenceTest(unit.quality, unit.leadership, threat, state.rng)
    const from = unit.confidence
    if (test.drop > 0) unit.confidence = lowerConfidence(unit.confidence, test.drop)
    log(state, side, `${unit.name} tests confidence at +${threat}${h.leaderDestroyed ? ' (leader destroyed)' : ''}: D${test.die} rolls ${test.roll} against ${test.needed} — ${test.drop === 0 ? 'holds' : `drops ${test.drop === 2 ? 'two levels' : 'a level'} from ${CONFIDENCE_LABELS[from]} to ${CONFIDENCE_LABELS[unit.confidence]}`}.`, 'p. 22')
  }
  if (h.leaderDestroyed) {
    const next = elementsOf(state, unit).find(functional)
    unit.leaderElementId = next?.id ?? null
    if (next) {
      const rolled = rollD6(state.rng)
      const shift = rolled <= 3 ? 1 : rolled === 6 ? -1 : 0
      const was = unit.leadership
      unit.leadership = Math.max(1, Math.min(3, unit.leadership + shift)) as UnitState['leadership']
      log(state, side, `${next.name} takes command of ${unit.name}: D6 rolls ${rolled}, leadership ${was} becomes ${unit.leadership}.`, 'p. 23')
    }
  }
  // Loss of the command unit (p. 24): the designated command vehicle (its leader element) destroyed, or the whole unit: every unit of the force drops a level.
  if (unit.commandUnit && (h.leaderDestroyed || !elementsOf(state, unit).some(functional)) && !state.sides[side].commandLost) {
    state.sides[side].commandLost = true
    state.sides[side].commandLostTurn = state.turn
    for (const u of unitsOf(state, side)) u.confidence = lowerConfidence(u.confidence, 1)
    log(state, side, `${state.sides[side].name}'s command unit is lost: every unit drops a level of confidence, and no rallying is possible.`, 'p. 24')
  }
}
