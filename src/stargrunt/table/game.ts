/**
 * Stargrunt II — the battle itself (Chapters 5–8, 14–15): deployment, the
 * alternating activation sequence, the twelve actions a unit's two-action
 * activation can spend, fire and close assault applied to figures, the
 * confidence cascades they provoke, suppression, panic, loss of leaders,
 * objectives and the end of the battle.
 *
 * `applyAction` is the one door, exactly as `src/dirtside/table/game.ts`'s:
 * it clones the state, dispatches, and either refuses with a page or
 * journals the action and returns the next state. Every die comes from the
 * state's own stream, so `replay(setup, journal)` rebuilds any battle
 * exactly.
 *
 * Round 1's `checks.ts`, `fire.ts`, `assault.ts`, `medical.ts`, `cover.ts`,
 * `movement.ts` and `data/` are read-only: this file calls them and works
 * around whatever they don't cover (see the round's report for what and
 * why). `types.ts` is likewise read-only; where its shape doesn't leave
 * room for a rule (transferring an activation, the extra figures a close
 * assault's pairing-off leaves over), this file adopts and documents a
 * reading rather than changing the contract.
 */

import {
  allocateHit,
  allocationDie,
  coverShiftedArmourDie,
  fireSquadSmallArms,
  fireSupportWeaponAlone,
  rangeDie,
  type CoverGrade as FireCoverGrade,
  type DispersedFireResult,
  type RangeDieResult,
} from '../fire'
import {
  attemptCloseAssaultReaction,
  assaultOdds,
  assaultRoundEndTest,
  attackerReactionAfterFdf,
  closeCombatCasualtyRoll,
  defenderStandTest,
  defenderStandThreatLevel,
  finalDefensiveFireGate,
  interpretFinalDefensiveFire,
  pairOff,
  resolveCloseCombatRound,
  whoTestsFirst,
  type CloseCombatCasualtyRoll,
  type CloseCombatFighter,
} from '../assault'
import { treatWounded } from '../medical'
import {
  attemptGoInPosition,
  attemptRally,
  attemptRemovePanic,
  attemptRemoveSuppression,
  attemptTransfer,
  commandLevelsBypassed,
  confidenceTest,
  confidenceThreatLevel,
  lowerConfidence,
  panicTest,
  raiseConfidence,
  reactionTest,
  reactionThreatLevel,
  replacementLeaderRoll,
  type ConfidenceCircumstances,
} from '../checks'
import { armourDie, fireValueToDie, rangeBandInches, smallArmProfile, supportWeaponProfile } from '../data/weapons'
import { newStream, rollDie, type DiceStream, type DieType } from '../dice'
import {
  distance,
  figureCoverGrade,
  isInIntegrity,
  lineOfFire,
  rangeBetweenUnits,
  unitCentre,
  unitCoverGrade,
  unitVisible,
  woodPostureOf,
  type CoverGrade,
} from './cover'
import { advanceAlongPath, combatMoveDie, combatMoveInches, normalMoveInches, pathCost, travelMoveInches, type PathCost } from './movement'
import { bearing, onTable } from '../../dirtside/table/terrain'
import {
  QUALITY_DIE,
  otherSide,
  refuse,
  type Action,
  type ActivationState,
  type Confidence,
  type FigureMove,
  type FigureState,
  type FigureStatus,
  type FireWith,
  type GameSetup,
  type GameState,
  type LogEntry,
  type Point,
  type Refusal,
  type SideId,
  type SideSetup,
  type SmallArmProfile,
  type UnitState,
} from '../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Deploy within this many inches of your own baseline, matching Dirtside's own pregame deployment depth (p. 17 of that game). [reading, spec 01 §4.1/§9.4]: Stargrunt's own text reads an Encounter battle as having no pregame deployment sub-phase at all — forces simply enter over their baseline during turn 1 — but the brief asks this round to build `deploy`/`ready` and `inDeploymentZone` exactly as Dirtside's engine shapes them, so both battle types get a Dirtside-style deployment phase for engine consistency; see the round's report. */
export const DEPLOY_DEPTH = 6
/** A move over an objective takes it, reused from Dirtside (p. 17 of that game) since Stargrunt's own chapters give no generic marker-and-value model of its own (spec 01 §4.2) — with the added "no enemy nearer" condition the spec flags for this game. */
export const OBJECTIVE_REACH = 1

// ---------------------------------------------------------------------------
// Setup and layout
// ---------------------------------------------------------------------------

export function baselineY(setup: GameSetup, side: SideId): number {
  return side === 'north' ? 0 : setup.table.depth
}

/** Where a side may deploy (mirrors Dirtside's own `inDeploymentZone`, p. 17 of that game). */
export function inDeploymentZone(setup: GameSetup, side: SideId, point: Point): boolean {
  if (!onTable(point, setup.table)) return false
  const depth = setup.table.depth
  const attacker = setup.battle === 'attack-defence' ? (setup.attacker ?? 'north') : null
  if (attacker && side !== attacker) return attacker === 'north' ? point.y >= depth / 3 : point.y <= (2 * depth) / 3
  return side === 'north' ? point.y <= DEPLOY_DEPTH : point.y >= depth - DEPLOY_DEPTH
}

const AUTO_ROWS = [1.5, 3, 4.5, 6]
const AUTO_SINGLE_ROW = [3]
const AUTO_START = 1
const FIGURE_SPACING = 1
const UNIT_GAP = 2

/** The automatic baseline layout for figures the setup leaves out, one row per side unless it overflows into the deployment band (the same shape as Dirtside's own `autoLayout`). */
export function autoLayout(setup: GameSetup, side: SideSetup): Record<string, Point> {
  const place = (rows: readonly number[]) => {
    const out: Record<string, Point> = {}
    const fits = (x: number) => x <= setup.table.width - AUTO_START
    let row = 0
    let x = AUTO_START
    let overflow = false
    const nextRow = () => {
      if (row >= rows.length - 1) overflow = true
      else {
        row += 1
        x = AUTO_START
      }
    }
    for (const unit of side.units) {
      const span = FIGURE_SPACING * Math.max(0, unit.figures.length - 1)
      if (x > AUTO_START && !fits(x + span)) nextRow()
      for (const figure of unit.figures) {
        if (x > AUTO_START && !fits(x)) nextRow()
        const back = rows[row]!
        out[figure.id] = side.id === 'north' ? { x, y: back } : { x, y: setup.table.depth - back }
        x += FIGURE_SPACING
      }
      x += UNIT_GAP
    }
    return { out, overflow }
  }
  const single = place(AUTO_SINGLE_ROW)
  return single.overflow ? place(AUTO_ROWS).out : single.out
}

export function createGame(setup: GameSetup): GameState {
  const figures: Record<string, FigureState> = {}
  const units: Record<string, UnitState> = {}
  for (const side of setup.sides) {
    const auto = autoLayout(setup, side)
    for (const unitSetup of side.units) {
      const figureIds: string[] = []
      let leaderId: string | null = null
      for (const f of unitSetup.figures) {
        figures[f.id] = {
          id: f.id,
          unitId: unitSetup.id,
          sideId: side.id,
          name: f.name ?? `${unitSetup.name} trooper`,
          position: f.position ?? auto[f.id] ?? { x: 0, y: baselineY(setup, side.id) },
          smallArm: f.smallArm,
          supportWeapon: f.supportWeapon ?? null,
          armour: f.armour ?? unitSetup.armour,
          role: f.role ?? 'trooper',
          status: 'ok',
        }
        figureIds.push(f.id)
        if (f.leader && !leaderId) leaderId = f.id
      }
      units[unitSetup.id] = {
        id: unitSetup.id,
        sideId: side.id,
        name: unitSetup.name,
        quality: unitSetup.quality,
        leadership: unitSetup.leadership,
        confidence: unitSetup.confidence ?? 'CO',
        motivation: unitSetup.motivation ?? side.motivation,
        armour: unitSetup.armour,
        mobility: unitSetup.mobility,
        commandLevel: unitSetup.commandLevel,
        commanderId: unitSetup.commanderId ?? null,
        figureIds,
        leaderId: leaderId ?? figureIds[0] ?? null,
        activated: false,
        suppression: 0,
        everSuppressed: false,
        everHit: false,
        inPosition: false,
        travelling: false,
        panic: false,
        panicTested: false,
        firedThisTurn: [],
        transfersThisTurn: 0,
        firedOnBy: {},
      }
    }
  }
  const defender = setup.battle === 'attack-defence' ? otherSide(setup.attacker ?? 'north') : null
  const objectives: GameState['objectives'] = {}
  for (const o of setup.table.objectives) objectives[o.id] = { heldBy: defender }
  return {
    setup,
    rng: newStream(setup.seed),
    turn: 0,
    phase: 'deployment',
    figures,
    units,
    sides: {
      north: { name: setup.sides.find((s) => s.id === 'north')?.name ?? 'North', ready: false, done: false },
      south: { name: setup.sides.find((s) => s.id === 'south')?.name ?? 'South', ready: false, done: false },
    },
    toAct: null,
    chooser: null,
    activation: null,
    owed: 0,
    objectives,
    journal: [],
    log: [
      {
        turn: 0,
        side: null,
        text: `${setup.name}: deployment. ${setup.battle === 'encounter' ? `Both sides deploy within ${DEPLOY_DEPTH}" of their baselines.` : 'The defender deploys first.'}`,
        page: 'p. 14',
      },
    ],
    result: null,
  }
}

// ---------------------------------------------------------------------------
// Queries (the API screen and computer player call)
// ---------------------------------------------------------------------------

/** Able to act (p. 8): status 'ok'. A wounded, stabilised or dead figure cannot fight, move on its own initiative, or be counted a shooter — only a target. */
export const fit = (figure: FigureState): boolean => figure.status === 'ok'
/** Still on the table at all, even wounded or stabilised. */
export const alive = (figure: FigureState): boolean => figure.status !== 'dead'
/** A legal target for an incoming hit's allocation (p. 36): ok or already wounded (a second wound kills); stabilised and dead figures are out of it. */
export const canBeHit = (figure: FigureState): boolean => figure.status === 'ok' || figure.status === 'wounded'

export function figuresOf(state: GameState, unit: UnitState): FigureState[] {
  return unit.figureIds.map((id) => state.figures[id]!)
}

export function unitsOf(state: GameState, side: SideId): UnitState[] {
  return Object.values(state.units).filter((u) => u.sideId === side)
}

/** Units still on the table: at least one figure not removed. */
export function liveUnits(state: GameState, side: SideId): UnitState[] {
  return unitsOf(state, side).filter((u) => figuresOf(state, u).some(alive))
}

export function unactivatedUnits(state: GameState, side: SideId): UnitState[] {
  return liveUnits(state, side).filter((u) => !u.activated)
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

/** 0, 1 or 2 for the unit now activated (0 with no activation under way). */
export function actionsLeft(state: GameState): 0 | 1 | 2 {
  if (!state.activation) return 0
  return (2 - state.activation.actionsTaken) as 0 | 1 | 2
}

export function nearestEnemyDistance(state: GameState, side: SideId, point: Point): number {
  let best = Number.POSITIVE_INFINITY
  for (const f of Object.values(state.figures)) if (f.sideId !== side && alive(f)) best = Math.min(best, distance(point, f.position))
  return best
}

function unitPosition(state: GameState, unit: UnitState): Point {
  return unitCentre(figuresOf(state, unit).filter(alive).map((f) => f.position))
}

function unitCover(state: GameState, unit: UnitState): CoverGrade {
  const figs = figuresOf(state, unit).filter(alive)
  return unitCoverGrade(figs.map((f) => figureCoverGrade(f.position, state.setup.table.terrain)))
}

function figureVisibility(state: GameState, from: Point, target: UnitState): boolean[] {
  return figuresOf(state, target)
    .filter(alive)
    .map((f) => lineOfFire(from, f.position, state.setup.table.terrain).clear)
}

function isOrganised(state: GameState, unit: UnitState): boolean {
  return isInIntegrity(figuresOf(state, unit).filter(alive).map((f) => f.position))
}

function isPowerArmoured(f: FigureState): boolean {
  return f.armour === 'light-power' || f.armour === 'heavy-power'
}

/** Close-combat weapon shift (p. 42): a pistol +1, a shotgun +2. [reading]: the contract has no dedicated melee-weapon field, so this is read off each figure's carried small arm — no edged weapons exist in `SmallArmKind`, so that +1 case never triggers yet. */
function weaponShiftFor(f: FigureState): 0 | 1 | 2 {
  if (f.smallArm === 'assault-shotgun') return 2
  if (f.smallArm === 'light-autopistol' || f.smallArm === 'heavy-autopistol') return 1
  return 0
}

/** The unit's restrictions from its confidence and suppression, in words (for the screen). */
export function threatNow(state: GameState, unitId: string): string {
  const unit = state.units[unitId]
  if (!unit) return 'Unknown unit.'
  const notes: string[] = []
  if (unit.panic) notes.push('Panicked: no action but trying to recover.')
  if (!isOrganised(state, unit)) notes.push('Disorganised: must reorganise before anything else.')
  if (unit.suppression > 0) notes.push(`Suppressed (${unit.suppression}): only reorganise in cover, remove suppression, or a leader action.`)
  if (unit.travelling) notes.push('Travel-formed: may only move or reorganise.')
  if (unit.confidence === 'SH') notes.push('Shaken: a reaction test is needed to leave cover or advance on the enemy.')
  if (unit.confidence === 'BR') notes.push('Broken: must move to the nearest cover; fires only once fired upon; a close assault against it routs it outright.')
  if (unit.confidence === 'RO') notes.push('Routed: must withdraw towards its baseline; will not fire; surrenders if penned within 12" of the enemy.')
  if (notes.length === 0) notes.push(`${CONFIDENCE_LABELS[unit.confidence]}: no restrictions.`)
  return notes.join(' ')
}

const CONFIDENCE_LABELS: Record<Confidence, string> = { CO: 'Confident', ST: 'Steady', SH: 'Shaken', BR: 'Broken', RO: 'Routed' }

// ---------------------------------------------------------------------------
// The door
// ---------------------------------------------------------------------------

export function applyAction(before: GameState, action: Action): GameState | Refusal {
  if (before.result) return refuse('The battle is over.', 'p. 15')
  const state = structuredClone(before)
  const outcome = dispatch(state, action)
  if (outcome) return outcome
  state.journal.push(action)
  if (!state.result) checkBattleEnd(state)
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

function log(state: GameState, side: SideId | null, text: string, page?: string, dice?: number[]): void {
  const entry: LogEntry = { turn: state.turn, side, text }
  if (page) entry.page = page
  if (dice && dice.length > 0) entry.dice = dice
  state.log.push(entry)
}

function dispatch(state: GameState, action: Action): Refusal | null {
  switch (action.kind) {
    case 'ready':
      return ready(state, action.side)
    case 'deploy':
      return deploy(state, action)
    case 'choose-first':
      return chooseFirst(state, action.side, action.first)
    case 'activate':
      return activate(state, action.side, action.unitId)
    case 'end-activation':
      return endActivationAction(state, action.side)
    case 'pass':
      return pass(state, action.side)
    case 'done':
      return done(state, action.side)
    case 'move':
      return move(state, action)
    case 'fire':
      return fire(state, action)
    case 'close-assault':
      return closeAssault(state, action)
    case 'reorganise':
      return reorganise(state, action)
    case 'remove-suppression':
      return removeSuppression(state, action.side)
    case 'go-in-position':
      return goInPosition(state, action.side)
    case 'leave-position':
      return leavePosition(state, action.side)
    case 'transfer':
      return transfer(state, action)
    case 'rally':
      return rally(state, action)
    case 'recover-panic':
      return recoverPanic(state, action.side)
  }
}

// ---------------------------------------------------------------------------
// Deployment and the turn (Chapters 5–6, pp. 14–15)
// ---------------------------------------------------------------------------

function deploy(state: GameState, action: Extract<Action, { kind: 'deploy' }>): Refusal | null {
  if (state.phase !== 'deployment') return refuse('Deployment is over.', 'p. 14')
  if (state.sides[action.side].ready) return refuse('This side has finished deploying.', 'p. 14')
  const f = state.figures[action.figureId]
  if (!f || f.sideId !== action.side) return refuse('Not one of your figures.', 'p. 14')
  if (!inDeploymentZone(state.setup, action.side, action.position)) return refuse('Deploy inside your own deployment zone.', 'p. 14')
  f.position = { x: action.position.x, y: action.position.y }
  return null
}

function ready(state: GameState, side: SideId): Refusal | null {
  if (state.phase !== 'deployment') return refuse('Deployment is over.', 'p. 14')
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
  // `done` means no more activations this turn (p. 15), so it lapses with the turn
  state.sides.north.done = false
  state.sides.south.done = false
  for (const unit of Object.values(state.units)) {
    unit.activated = false
    unit.firedThisTurn = []
    unit.transfersThisTurn = 0
  }
  const north = liveUnits(state, 'north').length
  const south = liveUnits(state, 'south').length
  if (north === 0 || south === 0) {
    finish(state, north === 0 && south === 0 ? 'draw' : north === 0 ? 'south' : 'north', 'the other side has no unit left on the table')
    return
  }
  let chooser: SideId
  if (north !== south) chooser = north < south ? 'north' : 'south'
  else {
    let a = 0
    let b = 0
    while (a === b) {
      a = rollDie(6, state.rng)
      b = rollDie(6, state.rng)
    }
    chooser = a > b ? 'north' : 'south'
    log(state, null, `Turn ${state.turn}: equal units on the table; ${state.sides.north.name} rolls ${a}, ${state.sides.south.name} ${b}.`, 'p. 15')
  }
  state.chooser = chooser
  state.toAct = chooser
  log(state, null, `Turn ${state.turn}. ${state.sides[chooser].name} has ${north === south ? 'won the roll and' : 'fewer units and'} chooses who activates first.`, 'p. 15')
}

function chooseFirst(state: GameState, side: SideId, first: SideId): Refusal | null {
  if (state.phase !== 'turn-start') return refuse('The turn has started.', 'p. 15')
  if (state.chooser !== side) return refuse(`${state.sides[state.chooser!].name} chooses this turn.`, 'p. 15')
  state.phase = 'activation'
  state.toAct = first
  log(state, side, `${state.sides[side].name} has ${state.sides[first].name} activate first.`, 'p. 15')
  return null
}

function canActivate(state: GameState, side: SideId): boolean {
  return !state.sides[side].done && unactivatedUnits(state, side).length > 0
}

/** Hand the next activation to whoever it belongs to (p. 15): a passed side is owed two in a row; a side with nothing left, or that has declared itself done, is skipped; when nobody can act the turn ends. */
function settleTurnFlow(state: GameState, current: SideId, justActed: boolean): void {
  if (state.result) return
  const other = otherSide(current)
  if (justActed && state.owed > 0) state.owed -= 1
  let next: SideId | null
  if (justActed && state.owed > 0 && canActivate(state, current)) next = current
  else if (justActed) next = canActivate(state, other) ? other : canActivate(state, current) ? current : null
  else next = canActivate(state, current) ? current : canActivate(state, other) ? other : null
  if (next === null) {
    endTurn(state)
    return
  }
  if (next !== current) state.owed = 0
  state.toAct = next
}

function endTurn(state: GameState): void {
  log(state, null, `Turn ${state.turn} ends: every activation marker turns face up.`, 'p. 15')
  const limit = state.setup.turnLimit
  if (limit !== null && state.turn >= limit) {
    updateObjectives(state)
    const values = objectiveValues(state)
    finish(state, values.north === values.south ? 'draw' : values.north > values.south ? 'north' : 'south', `turn ${limit} is over`)
    return
  }
  startTurn(state)
}

function finish(state: GameState, winner: SideId | 'draw', reason: string): void {
  // A side can be wiped out or broken by fire, which never calls `updateObjectives` on its own
  // (only `move`/`reorganise`/close-assault outcomes do) — recompute here so a side that no longer
  // holds any figure near an objective is never scored as still holding it (p. 14, p. 17).
  updateObjectives(state)
  const values = objectiveValues(state)
  state.result = { winner, reason, values }
  state.phase = 'ended'
  state.toAct = null
  state.activation = null
  log(state, null, winner === 'draw' ? `A draw: ${reason}. Objectives ${values.north} to ${values.south}.` : `${state.sides[winner].name} wins: ${reason}. Objectives ${values.north} to ${values.south}.`, 'p. 15')
}

/** A side whose every unit is broken, routed or gone loses outright, checked after every action (not only at the turn's end). */
function checkBattleEnd(state: GameState): void {
  if (state.phase === 'deployment' || state.phase === 'turn-start') return
  const beaten = (side: SideId) => {
    const units = unitsOf(state, side)
    if (units.length === 0) return false
    return units.every((u) => !figuresOf(state, u).some(alive) || u.confidence === 'BR' || u.confidence === 'RO')
  }
  const north = beaten('north')
  const south = beaten('south')
  if (north || south) finish(state, north && south ? 'draw' : north ? 'south' : 'north', 'the other side is broken, routed or gone')
}

function pass(state: GameState, side: SideId): Refusal | null {
  if (state.phase !== 'activation' || state.toAct !== side || state.activation) return refuse('Not your activation to pass.', 'p. 15')
  if (!canPass(state, side)) return refuse('A side may pass only with fewer unactivated units than the opponent.', 'p. 15')
  const other = otherSide(side)
  state.owed = 2
  state.toAct = other
  log(state, side, `${state.sides[side].name} passes; ${state.sides[other].name} must activate two units in a row.`, 'p. 15')
  return null
}

function done(state: GameState, side: SideId): Refusal | null {
  if (state.phase !== 'activation' || state.toAct !== side || state.activation) return refuse('Not your activation to give up.', 'p. 15')
  state.sides[side].done = true
  log(state, side, `${state.sides[side].name} makes no more activations this turn.`, 'p. 15')
  settleTurnFlow(state, side, false)
  return null
}

// ---------------------------------------------------------------------------
// Activation (Chapter 6–7, pp. 15–18)
// ---------------------------------------------------------------------------

function activate(state: GameState, side: SideId, unitId: string): Refusal | null {
  if (state.phase !== 'activation') return refuse('No activations now.', 'p. 15')
  if (state.toAct !== side) return refuse(`It is ${state.sides[state.toAct!].name}'s activation.`, 'p. 15')
  if (state.activation) return refuse('An activation is under way; end it first.', 'p. 15')
  const unit = state.units[unitId]
  if (!unit || unit.sideId !== side) return refuse('Not one of your units.', 'p. 15')
  if (unit.activated) return refuse(`${unit.name} has activated this turn.`, 'p. 15')
  if (!figuresOf(state, unit).some(alive)) return refuse(`${unit.name} has no figures left.`, 'p. 15')
  state.activation = { unitId, sideId: side, actionsTaken: 0, transferredBy: null }
  log(state, side, `${unit.name} activates${unit.panic ? ' (panicked)' : unit.suppression > 0 ? ` (suppressed x${unit.suppression})` : ''}.`, 'p. 15')
  return null
}

function activeUnit(state: GameState, side: SideId): { unit: UnitState; activation: ActivationState } | Refusal {
  const activation = state.activation
  if (state.phase !== 'activation' || !activation) return refuse('No unit is activated.', 'p. 15')
  if (activation.sideId !== side) return refuse('Not your activation.', 'p. 15')
  return { unit: state.units[activation.unitId]!, activation }
}

function advanceActivation(state: GameState, unit: UnitState, activation: ActivationState, actionsUsed: 1 | 2): void {
  activation.actionsTaken = Math.min(2, activation.actionsTaken + actionsUsed) as 0 | 1 | 2
  if (activation.actionsTaken >= 2) finishActivation(state, unit)
}

function finishActivation(state: GameState, unit: UnitState): void {
  unit.activated = true
  const side = unit.sideId
  state.activation = null
  log(state, side, `${unit.name} ends its activation.`, 'p. 15')
  settleTurnFlow(state, side, true)
}

function endActivationAction(state: GameState, side: SideId): Refusal | null {
  const got = activeUnit(state, side)
  if ('ok' in got) return got
  finishActivation(state, got.unit)
  return null
}

/**
 * What confidence, suppression, panic and travel formation forbid for the
 * unit now activated (pp. 18, 21, 24) — checked once, at the top of every
 * action, so each handler need not repeat it. Close assault's own
 * confidence bar (BROKEN/ROUTED may not attempt one, p. 41) is left to
 * `assault.ts`'s own refusal.
 */
function restrictionRefusal(state: GameState, unit: UnitState, kind: Action['kind'], targetUnitId?: string): Refusal | null {
  if (unit.panic) return kind === 'recover-panic' ? null : refuse(`${unit.name} is panicked and can attempt only to recover.`, 'p. 21')
  // [reading]: a disorganised unit's forced-reorganise-first rule (p. 11) and suppression's own
  // "reorganise only in cover" rule (p. 18) can otherwise deadlock a unit disorganised AND suppressed
  // in the open — neither action would be legal, and nothing could ever free it. Removing suppression
  // doesn't require repositioning, so it stays open as the escape valve; everything else still waits.
  if (!isOrganised(state, unit) && kind !== 'reorganise' && kind !== 'remove-suppression') return refuse(`${unit.name} is disorganised and must reorganise first.`, 'p. 11')
  // The same deadlock class hits a unit that is travel-formed AND suppressed in the open: 'move' is
  // barred by suppression, 'reorganise' is barred by suppression-in-the-open, so 'remove-suppression'
  // must stay open here too, or the unit can never act again for the rest of the battle (p. 24 itself
  // expects exactly this sequence: shake off the marker, then reorganise out of column).
  if (unit.travelling && kind !== 'move' && kind !== 'reorganise' && kind !== 'remove-suppression') return refuse(`${unit.name} is travel-formed and may only move or reorganise.`, 'p. 24')
  if (unit.suppression > 0) {
    const allowed: Action['kind'][] = ['reorganise', 'remove-suppression', 'transfer', 'rally']
    if (!allowed.includes(kind)) return refuse(`${unit.name} is suppressed: only reorganise in cover, remove suppression, or a leader action.`, 'p. 18')
    if (kind === 'reorganise' && unitCover(state, unit) === 'open') return refuse(`${unit.name} is suppressed in the open and cannot reorganise.`, 'p. 18')
  }
  if (kind === 'fire') {
    if (unit.confidence === 'RO') return refuse(`${unit.name} is routed and will not fire.`, 'p. 21')
    if (unit.confidence === 'BR') {
      // A broken unit only fires back at whoever actually fired on it (p. 21) — per-target, not a
      // once-ever unlock; `targetUnitId` is absent for the advisory `allowedActions` call, which asks
      // only whether firing at SOME enemy is possible at all.
      const recently = (id: string) => (unit.firedOnBy[id] ?? Number.NEGATIVE_INFINITY) >= state.turn - 1
      const mayFire = targetUnitId ? recently(targetUnitId) : Object.keys(unit.firedOnBy).some(recently)
      if (!mayFire) return refuse(`${unit.name} is broken and fires only on an enemy that has fired on it recently.`, 'p. 21')
    }
  }
  if (kind === 'close-assault') {
    if (unit.confidence === 'BR' || unit.confidence === 'RO') return refuse(`${unit.name} is ${unit.confidence === 'BR' ? 'broken' : 'routed'} and may not close assault.`, 'p. 41')
    // A close assault "is assumed to use up both actions of the unit... the unit cannot expend one
    // action on something else and then close-assault with its second action" (p. 41).
    if (actionsLeft(state) < 2) return refuse(`${unit.name} must close assault with both of its actions.`, 'p. 41')
  }
  return null
}

// ---------------------------------------------------------------------------
// Move (Chapter 9, pp. 22–24)
// ---------------------------------------------------------------------------

function move(state: GameState, action: Extract<Action, { kind: 'move' }>): Refusal | null {
  const got = activeUnit(state, action.side)
  if ('ok' in got) return got
  const { unit, activation } = got
  if (action.moves.length === 0) return refuse('A move needs at least one figure.', 'p. 22')
  for (const m of action.moves) {
    const f = state.figures[m.figureId]
    if (!f || f.unitId !== unit.id) return refuse('Every figure must belong to the activated unit.', 'p. 22')
    if (!fit(f)) return refuse(`${f.name} cannot move.`, 'p. 22')
    if (m.path.length === 0) return refuse('Give at least one waypoint.', 'p. 22')
    if (m.path.some((p) => !onTable(p, state.setup.table))) return refuse('The move leaves the table.', 'p. 14')
  }
  const restriction = restrictionRefusal(state, unit, 'move')
  if (restriction) return restriction
  if (action.mode === 'travel' && unit.suppression > 0) return refuse(`${unit.name} is suppressed and cannot form for travel.`, 'p. 24')
  if (unit.travelling && action.mode !== 'travel') return refuse(`${unit.name} is travel-formed; reorganise before moving any other way.`, 'p. 24')

  const startCentre = unitPosition(state, unit)
  const declaredEnd = unitCentre(action.moves.map((m) => m.path[m.path.length - 1]!))
  const enemyBefore = nearestEnemyDistance(state, unit.sideId, startCentre)
  const enemyAfter = nearestEnemyDistance(state, unit.sideId, declaredEnd)
  const advancing = enemyAfter < enemyBefore - 1e-9

  if (unit.confidence === 'RO') {
    const base = baselineY(state.setup, unit.sideId)
    if (Math.abs(declaredEnd.y - base) >= Math.abs(startCentre.y - base) - 1e-9) return refuse(`${unit.name} is routed and must withdraw towards its baseline.`, 'p. 21')
  }
  if (unit.confidence === 'BR') {
    const inCoverNow = unitCover(state, unit) !== 'open'
    const endGrades = action.moves.map((m) => figureCoverGrade(m.path[m.path.length - 1]!, state.setup.table.terrain))
    const endsInOpen = unitCoverGrade(endGrades) === 'open'
    if (!inCoverNow && endsInOpen) return refuse(`${unit.name} is broken and must move to the nearest cover.`, 'p. 21')
    if (inCoverNow && enemyAfter <= enemyBefore + 1e-9) return refuse(`${unit.name} is broken and may leave cover only to withdraw from the enemy.`, 'p. 21')
  }

  let inPositionCleared = false
  if (unit.inPosition) {
    const t = reactionTest(unit.quality, unit.leadership, reactionThreatLevel('move-without-removing-in-position'), state.rng)
    log(state, action.side, `${unit.name}, in position, tries to move without standing down first: D${QUALITY_DIE[unit.quality]} rolls ${t.roll} against ${t.target} — ${t.passed ? 'it moves' : 'it stays put'}.`, 'p. 13', [t.roll])
    if (!t.passed) {
      advanceActivation(state, unit, activation, 1)
      return null
    }
    inPositionCleared = true
  }

  if (unit.confidence === 'SH') {
    const inCoverNow = unitCover(state, unit) !== 'open'
    const endGrades = action.moves.map((m) => figureCoverGrade(m.path[m.path.length - 1]!, state.setup.table.terrain))
    const leavesCover = inCoverNow && unitCoverGrade(endGrades) === 'open'
    if (advancing || leavesCover) {
      const t = reactionTest(unit.quality, unit.leadership, reactionThreatLevel('shaken-leaves-cover'), state.rng)
      log(state, action.side, `${unit.name}, shaken, tests to ${leavesCover ? 'leave cover' : 'advance'}: D${QUALITY_DIE[unit.quality]} rolls ${t.roll} against ${t.target} — ${t.passed ? 'it moves' : 'the troops stay put'}.`, 'p. 21', [t.roll])
      if (!t.passed) {
        advanceActivation(state, unit, activation, 1)
        return null
      }
    }
  }

  const mobility = unit.mobility
  let allowanceInches: number
  const dice: number[] = []
  if (action.mode === 'normal') allowanceInches = normalMoveInches(mobility, 1)
  else if (action.mode === 'travel') allowanceInches = travelMoveInches(mobility, 1)
  else {
    const rolled = rollDie(combatMoveDie(mobility), state.rng)
    dice.push(rolled)
    allowanceInches = combatMoveInches(rolled)
  }

  const lines: string[] = []
  for (const m of action.moves) {
    const f = state.figures[m.figureId]!
    const path = [f.position, ...m.path]
    const cost = pathCost(path, mobility, state.setup.table.terrain)
    if (!cost.blockedAt && cost.factors <= allowanceInches + 1e-9) {
      f.position = { ...path[path.length - 1]! }
      lines.push(`${f.name} reaches its mark, ${cost.length.toFixed(1)}"`)
    } else {
      const progress = advanceAlongPath(path, allowanceInches, mobility, state.setup.table.terrain)
      f.position = { ...progress.reached }
      lines.push(`${f.name} moves ${progress.distanceCovered.toFixed(1)}"${progress.blockedAt ? `, blocked by ${progress.blockedBy}` : cost.blockedAt ? '' : ', short of its mark'}`)
    }
  }
  if (inPositionCleared) unit.inPosition = false
  if (action.mode === 'travel') unit.travelling = true

  log(state, action.side, `${unit.name} makes a ${action.mode} move${dice.length ? `: D${combatMoveDie(mobility)} rolls ${dice[0]}, ${allowanceInches}" this action` : ''}: ${lines.join('; ')}.`, 'p. 22', dice)

  updateObjectives(state)
  advanceActivation(state, unit, activation, 1)
  return null
}

/** Objectives held by proximity (Dirtside's own rule, reused per the brief), with the added [reading] that a marker is held only while no enemy figure stands nearer to it. */
function updateObjectives(state: GameState): void {
  for (const o of state.setup.table.objectives) {
    const distFor = (side: SideId) => {
      let best = Number.POSITIVE_INFINITY
      for (const f of Object.values(state.figures)) if (f.sideId === side && alive(f)) best = Math.min(best, distance(f.position, o.position))
      return best
    }
    const north = distFor('north')
    const south = distFor('south')
    const rec = state.objectives[o.id]!
    let holder: SideId | null = rec.heldBy
    if (north <= OBJECTIVE_REACH && north < south - 1e-9) holder = 'north'
    else if (south <= OBJECTIVE_REACH && south < north - 1e-9) holder = 'south'
    if (holder !== rec.heldBy) {
      rec.heldBy = holder
      if (holder) log(state, holder, `Objective ${o.id} (value ${o.value}) is taken.`, 'p. 17')
    }
  }
}

// ---------------------------------------------------------------------------
// Reorganise, in position, suppression (pp. 13, 17–18)
// ---------------------------------------------------------------------------

function reorganise(state: GameState, action: Extract<Action, { kind: 'reorganise' }>): Refusal | null {
  const got = activeUnit(state, action.side)
  if ('ok' in got) return got
  const { unit, activation } = got
  const restriction = restrictionRefusal(state, unit, 'reorganise')
  if (restriction) return restriction

  if (action.moves && action.moves.length > 0) {
    for (const m of action.moves) {
      const f = state.figures[m.figureId]
      if (!f || f.unitId !== unit.id) return refuse('Every figure must belong to the activated unit.', 'p. 17')
      if (!fit(f)) return refuse(`${f.name} cannot reposition.`, 'p. 17')
      if (m.path.some((p) => !onTable(p, state.setup.table))) return refuse('Reorganising cannot move a figure off the table.', 'p. 14')
    }
    const allowance = normalMoveInches(unit.mobility, 1)
    for (const m of action.moves) {
      const f = state.figures[m.figureId]!
      const path = [f.position, ...m.path]
      const cost = pathCost(path, unit.mobility, state.setup.table.terrain)
      if (!cost.blockedAt && cost.factors <= allowance + 1e-9) f.position = { ...path[path.length - 1]! }
      else {
        const progress = advanceAlongPath(path, allowance, unit.mobility, state.setup.table.terrain)
        f.position = { ...progress.reached }
      }
    }
  }

  if (unit.inPosition) {
    const inCover = unitCover(state, unit) !== 'open'
    const t = attemptGoInPosition(unit.quality, unit.leadership, inCover, state.rng)
    log(state, action.side, `${unit.name} tries to stay in position while it reorganises: D${QUALITY_DIE[unit.quality]} rolls ${t.roll} against ${t.target} — ${t.passed ? 'still in position' : 'the marker is lost'}.`, 'p. 13', [t.roll])
    if (!t.passed) unit.inPosition = false
  }

  const wounded = figuresOf(state, unit).filter((f) => f.status === 'wounded').map((f) => f.id)
  if (wounded.length > 0) {
    const hasMedic = figuresOf(state, unit).some((f) => f.role === 'medic' && f.status !== 'dead')
    const results = treatWounded(wounded, hasMedic, false, state.rng)
    for (const id of wounded) {
      const r = results[id]!
      const f = state.figures[id]!
      const outcome: FigureStatus = r.outcome === 'dead' ? 'dead' : r.outcome === 'stabilised' ? 'stabilised' : 'ok'
      f.status = outcome
      log(state, action.side, `${f.name} is treated: D6 rolls ${r.roll}${r.bonus ? `+${r.bonus}` : ''} = ${r.total} — ${r.outcome}.`, 'p. 39', [r.roll])
    }
  }

  if (unit.travelling) {
    unit.travelling = false
    log(state, action.side, `${unit.name} reforms out of travel column.`, 'p. 24')
  }

  log(state, action.side, `${unit.name} reorganises.`, 'p. 17')
  updateObjectives(state)
  advanceActivation(state, unit, activation, 1)
  return null
}

function removeSuppression(state: GameState, side: SideId): Refusal | null {
  const got = activeUnit(state, side)
  if ('ok' in got) return got
  const { unit, activation } = got
  const restriction = restrictionRefusal(state, unit, 'remove-suppression')
  if (restriction) return restriction
  if (unit.suppression <= 0) return refuse(`${unit.name} is not suppressed.`, 'p. 18')
  const t = attemptRemoveSuppression(unit.quality, unit.leadership, state.rng)
  log(state, side, `${unit.name} tries to shake off suppression: D${QUALITY_DIE[unit.quality]} rolls ${t.roll} against ${unit.leadership} — ${t.passed ? 'one marker gone' : 'still pinned'}.`, 'p. 18', [t.roll])
  if (t.passed) unit.suppression = Math.max(0, unit.suppression - 1) as UnitState['suppression']
  advanceActivation(state, unit, activation, 1)
  return null
}

function goInPosition(state: GameState, side: SideId): Refusal | null {
  const got = activeUnit(state, side)
  if ('ok' in got) return got
  const { unit, activation } = got
  const restriction = restrictionRefusal(state, unit, 'go-in-position')
  if (restriction) return restriction
  if (unit.inPosition) return refuse(`${unit.name} is already in position.`, 'p. 13')
  const inCover = unitCover(state, unit) !== 'open'
  const t = attemptGoInPosition(unit.quality, unit.leadership, inCover, state.rng)
  log(state, side, `${unit.name} goes in position${inCover ? ' in cover' : ' in the open'}: D${QUALITY_DIE[unit.quality]} rolls ${t.roll} against ${t.target} — ${t.passed ? 'in position' : 'stays exposed'}.`, 'p. 13', [t.roll])
  if (t.passed) unit.inPosition = true
  advanceActivation(state, unit, activation, 1)
  return null
}

function leavePosition(state: GameState, side: SideId): Refusal | null {
  const got = activeUnit(state, side)
  if ('ok' in got) return got
  const { unit, activation } = got
  const restriction = restrictionRefusal(state, unit, 'leave-position')
  if (restriction) return restriction
  if (!unit.inPosition) return refuse(`${unit.name} is not in position.`, 'p. 13')
  unit.inPosition = false
  log(state, side, `${unit.name} stands down from position, automatically.`, 'p. 13')
  advanceActivation(state, unit, activation, 1)
  return null
}

// ---------------------------------------------------------------------------
// Communications, transfer, rally, panic recovery (pp. 16–17, 21)
// ---------------------------------------------------------------------------

function transfer(state: GameState, action: Extract<Action, { kind: 'transfer' }>): Refusal | null {
  const got = activeUnit(state, action.side)
  if ('ok' in got) return got
  const { unit, activation } = got
  const restriction = restrictionRefusal(state, unit, 'transfer')
  if (restriction) return restriction
  const receiver = state.units[action.receiverUnitId]
  if (!receiver || receiver.sideId !== unit.sideId) return refuse('Not one of your units.', 'p. 16')
  if (receiver.commanderId !== unit.id) return refuse(`${unit.name} does not command ${receiver.name}.`, 'p. 16')
  if (!figuresOf(state, receiver).some(alive)) return refuse(`${receiver.name} has no figures left.`, 'p. 16')
  if (unit.transfersThisTurn >= 2) return refuse(`${unit.name} has already attempted two transfers this turn.`, 'p. 16')

  const commanderFig = unit.leaderId ? state.figures[unit.leaderId] : undefined
  const receiverFig = (receiver.leaderId ? state.figures[receiver.leaderId] : undefined) ?? figuresOf(state, receiver).find(alive)
  const dist = commanderFig && receiverFig ? distance(commanderFig.position, receiverFig.position) : Number.POSITIVE_INFINITY
  const levels = commandLevelsBypassed(unit.commandLevel, receiver.commandLevel)
  const result = attemptTransfer(unit.quality, unit.leadership, receiver.leadership, dist, levels, state.rng)
  unit.transfersThisTurn += 1
  const dice = result.comm ? [result.comm.roll] : []
  log(
    state,
    action.side,
    `${unit.name} tries to transfer an activation to ${receiver.name}${result.auto ? ' (within 6", automatic)' : `: D${result.comm!.die} rolls ${result.comm!.roll} against ${result.comm!.target}`} — ${result.ok ? 'received' : 'jammed'}.`,
    'p. 16',
    dice,
  )

  if (!result.ok) {
    advanceActivation(state, unit, activation, 1)
    return null
  }
  // [reading, contract limitation]: `ActivationState` carries a single `transferredBy` back-link, not a resumable stack of paused
  // budgets, so a transfer here spends the commander's whole activation (rather than the book's "one of his two actions") and hands
  // the receiver a fresh one immediately, same side keeping the floor. See the round's report.
  unit.activated = true
  state.activation = { unitId: receiver.id, sideId: receiver.sideId, actionsTaken: 0, transferredBy: unit.id }
  log(state, receiver.sideId, `${receiver.name} activates at once, on ${unit.name}'s order.`, 'p. 16')
  return null
}

function rally(state: GameState, action: Extract<Action, { kind: 'rally' }>): Refusal | null {
  const got = activeUnit(state, action.side)
  if ('ok' in got) return got
  const { unit, activation } = got
  const restriction = restrictionRefusal(state, unit, 'rally')
  if (restriction) return restriction
  const target = state.units[action.targetUnitId]
  if (!target || target.sideId !== unit.sideId || target.id === unit.id) return refuse('Rally another unit of your own.', 'p. 17')
  if (target.confidence === 'CO') return refuse(`${target.name} is already confident.`, 'p. 17')
  if (target.commanderId !== unit.id) return refuse(`${unit.name} does not command ${target.name}.`, 'p. 17')
  if (!figuresOf(state, target).some(alive)) return refuse(`${target.name} has no figures left.`, 'p. 17')

  const commanderFig = unit.leaderId ? state.figures[unit.leaderId] : undefined
  const targetFig = (target.leaderId ? state.figures[target.leaderId] : undefined) ?? figuresOf(state, target).find(alive)
  const dist = commanderFig && targetFig ? distance(commanderFig.position, targetFig.position) : Number.POSITIVE_INFINITY
  const levels = commandLevelsBypassed(unit.commandLevel, target.commandLevel)
  const result = attemptRally(unit.quality, unit.leadership, target.quality, target.leadership, dist, levels, state.rng)
  const dice = [...(result.comm ? [result.comm.roll] : []), ...(result.rally ? [result.rally.roll] : [])]
  const parts: string[] = []
  if (result.comm) parts.push(`comms D${result.comm.die} rolls ${result.comm.roll} vs ${result.comm.target}`)
  if (result.rally) parts.push(`rally D${QUALITY_DIE[target.quality]} rolls ${result.rally.roll} vs ${result.rally.target}`)
  log(state, action.side, `${unit.name} rallies ${target.name}${result.auto ? ' (within 6")' : ''}: ${parts.join('; ') || 'no communication'} — ${result.ok ? 'confidence rises' : 'no change'}.`, 'p. 17', dice)
  if (result.ok) target.confidence = raiseConfidence(target.confidence)
  advanceActivation(state, unit, activation, 1)
  return null
}

function recoverPanic(state: GameState, side: SideId): Refusal | null {
  const got = activeUnit(state, side)
  if ('ok' in got) return got
  const { unit, activation } = got
  if (!unit.panic) return refuse(`${unit.name} is not panicked.`, 'p. 21')
  const result = attemptRemovePanic(unit.quality, unit.leadership, state.rng)
  log(
    state,
    side,
    `${unit.name} tries to recover from panic: D${QUALITY_DIE[unit.quality]} rolls ${result.roll} against ${result.target} — ${result.passed ? 'recovers' : 'still panicked'}${result.lostConfidence ? ', and the scare costs a confidence level' : ''}.`,
    'p. 21',
    [result.roll],
  )
  if (result.passed) unit.panic = false
  if (result.lostConfidence) unit.confidence = lowerConfidence(unit.confidence, 1)
  advanceActivation(state, unit, activation, 2)
  return null
}

function panicCheck(state: GameState, unit: UnitState): void {
  // Regular troops only test for Panic against a Terror-provoking attack (p. 21), which this engine
  // does not yet model (no Terror mechanic exists) — so a Regular unit never tests on ordinary fire or
  // an ordinary close assault, same as Veteran and Elite.
  if (unit.panicTested || unit.quality === 'veteran' || unit.quality === 'elite' || unit.quality === 'regular') return
  if (!figuresOf(state, unit).some(alive)) return
  unit.panicTested = true
  const t = panicTest(unit.quality, unit.leadership, state.rng)
  log(state, unit.sideId, `${unit.name} meets the enemy for the first time: D${QUALITY_DIE[unit.quality]} rolls ${t.roll} against ${t.target} — ${t.passed ? 'it holds' : 'it panics'}.`, 'p. 21', [t.roll])
  if (!t.passed) unit.panic = true
}

/** Confidence and its cascades from one attack on a unit (pp. 10, 20): suppression, casualties, the leader falling, and the replacement roll. */
function afterAttack(state: GameState, unit: UnitState, circumstances: { suppressed: boolean; casualties: number; leaderLost: boolean }): void {
  const firstSuppression = circumstances.suppressed && !unit.everSuppressed
  if (circumstances.suppressed) {
    unit.suppression = Math.min(3, unit.suppression + 1) as UnitState['suppression']
    unit.everSuppressed = true
  }
  if (circumstances.casualties > 0) unit.everHit = true
  if (circumstances.leaderLost) {
    unit.suppression = Math.min(3, unit.suppression + 1) as UnitState['suppression']
    const roll = replacementLeaderRoll(unit.leadership, state.rng)
    unit.leadership = roll.leadership
    unit.leaderId = figuresOf(state, unit).find(fit)?.id ?? null
    log(state, unit.sideId, `${unit.name}'s leader falls; command passes: D6 rolls ${roll.roll}, leadership becomes ${roll.leadership}.`, 'p. 10', [roll.roll])
  }

  const survivors = figuresOf(state, unit).filter(alive).length
  const circ: ConfidenceCircumstances = {
    firstSuppressed: firstSuppression,
    tookCasualties: circumstances.casualties > 0,
    moreCasualtiesThanSurvivors: circumstances.casualties > 0 && circumstances.casualties > survivors,
    leaderCasualty: circumstances.leaderLost,
    untreatedCasualties: figuresOf(state, unit).filter((f) => f.status === 'wounded').length,
  }
  const threat = confidenceThreatLevel(unit.motivation, circ)
  if (threat === 'not-required') return
  const test = confidenceTest(unit.quality, unit.leadership, threat, state.rng)
  const before = unit.confidence
  if (test.drop > 0) unit.confidence = lowerConfidence(unit.confidence, test.drop)
  log(state, unit.sideId, `${unit.name} tests confidence at +${threat}: D${QUALITY_DIE[unit.quality]} rolls ${test.roll} against ${test.target} — ${test.drop === 0 ? 'holds' : `drops ${test.drop === 2 ? 'two levels' : 'a level'} from ${before} to ${unit.confidence}`}.`, 'p. 20', [test.roll])
}

// ---------------------------------------------------------------------------
// Fire (Chapter 14, pp. 33–37)
// ---------------------------------------------------------------------------

interface FirerAssembly {
  firingFigureIds: string[]
  profiles: SmallArmProfile[]
  supportDice: DieType[]
  impact: DieType
  closeOnly: boolean
  weaponKey: string
}

function assembleFire(state: GameState, unit: UnitState, fireWith: FireWith): FirerAssembly | Refusal {
  if (fireWith.kind === 'small-arms') {
    if (unit.firedThisTurn.includes('small-arms')) return refuse(`${unit.name}'s small arms have fired this turn.`, 'p. 33')
    const supportIds = fireWith.supportFigureIds ?? []
    for (const id of supportIds) {
      const f = state.figures[id]
      if (!f || f.unitId !== unit.id) return refuse('Every supporting figure must belong to the firing unit.', 'p. 35')
      if (!fit(f)) return refuse(`${f.name} cannot fire.`, 'p. 35')
      if (!f.supportWeapon) return refuse(`${f.name} has no support weapon.`, 'p. 35')
      if (unit.firedThisTurn.includes(id)) return refuse(`${f.name}'s weapon has fired this turn.`, 'p. 33')
    }
    const supportSet = new Set(supportIds)
    const shooters = figuresOf(state, unit)
      .filter(fit)
      .filter((f) => !supportSet.has(f.id))
    if (shooters.length === 0 && supportSet.size === 0) return refuse(`${unit.name} has no one able to fire.`, 'p. 34')
    const profiles = shooters.map((f) => smallArmProfile(f.smallArm))
    const supportDice = [...supportSet].map((id) => supportWeaponProfile(state.figures[id]!.supportWeapon!).firepowerDie)
    const impact = profiles[0]?.impact ?? supportWeaponProfile(state.figures[[...supportSet][0]!]!.supportWeapon!).impact
    const closeOnly = profiles.length > 0 && profiles.every((p) => p.closeOnly)
    return { firingFigureIds: shooters.map((f) => f.id), profiles, supportDice, impact, closeOnly, weaponKey: 'small-arms' }
  }
  const f = state.figures[fireWith.figureId]
  if (!f || f.unitId !== unit.id) return refuse('The firer must belong to the activated unit.', 'p. 37')
  if (!fit(f)) return refuse(`${f.name} cannot fire.`, 'p. 37')
  if (!f.supportWeapon) return refuse(`${f.name} has no support weapon.`, 'p. 37')
  if (unit.firedThisTurn.includes(f.id)) return refuse(`${f.name}'s weapon has fired this turn.`, 'p. 33')
  const w = supportWeaponProfile(f.supportWeapon)
  return { firingFigureIds: [f.id], profiles: [], supportDice: [w.firepowerDie], impact: w.impact, closeOnly: false, weaponKey: f.id }
}

function fire(state: GameState, action: Extract<Action, { kind: 'fire' }>): Refusal | null {
  const got = activeUnit(state, action.side)
  if ('ok' in got) return got
  const { unit, activation } = got
  const restriction = restrictionRefusal(state, unit, 'fire', action.targetUnitId)
  if (restriction) return restriction
  const target = state.units[action.targetUnitId]
  if (!target || target.sideId === unit.sideId) return refuse('Fire on an enemy unit.', 'p. 33')
  const targetFigs = figuresOf(state, target).filter(canBeHit)
  if (targetFigs.length === 0) return refuse(`${target.name} has no one left to hit.`, 'p. 33')

  const assembly = assembleFire(state, unit, action.with)
  if ('ok' in assembly) return assembly

  const firerCentre = unitPosition(state, unit)
  const targetCentre = unitPosition(state, target)
  const sight = lineOfFire(firerCentre, targetCentre, state.setup.table.terrain)
  const visible = unitVisible(figureVisibility(state, firerCentre, target))
  if (!sight.clear && !visible) return refuse(`No line of sight to ${target.name}: ${sight.reason}.`, 'p. 11')
  if (woodPostureOf(targetCentre, state.setup.table.terrain) === 'within') return refuse(`${target.name} is within a wood: direct fire cannot reach it.`, 'p. 12')

  const range = rangeBetweenUnits(firerCentre, targetCentre)
  const band = rangeBandInches(unit.quality)
  const cover = unitCover(state, target)
  const shapeFigures = targetFigs.map((f) => ({ armourDie: armourDie(f.armour) }))
  const fireTarget = { cover: cover as FireCoverGrade, inPosition: target.inPosition, figures: shapeFigures }

  const result: DispersedFireResult =
    action.with.kind === 'small-arms'
      ? fireSquadSmallArms(unit.quality, assembly.profiles, range, band, fireTarget, assembly.supportDice, state.rng)
      : fireSupportWeaponAlone(unit.quality, supportWeaponProfile(state.figures[action.with.figureId]!.supportWeapon!), range, band, fireTarget, state.rng)

  unit.firedThisTurn.push(assembly.weaponKey)
  // A support weapon that joins squad small arms is spent too (p. 33, p. 35): it may not then fire
  // again alone this turn. `assembly.weaponKey` alone only ever records the 'small-arms' sentinel.
  if (action.with.kind === 'small-arms') unit.firedThisTurn.push(...(action.with.supportFigureIds ?? []))
  // A broken target now counts this firer among the enemies it may shoot back at (p. 21).
  target.firedOnBy[unit.id] = state.turn

  const weaponLabel = assembly.weaponKey === 'small-arms' ? 'small arms' : `${state.figures[assembly.weaponKey]!.name}'s support weapon`
  if ('impossible' in result.rangeDie) {
    log(state, action.side, `${unit.name} fires ${weaponLabel} at ${target.name}, ${range.toFixed(1)}": ${result.rangeDie.reason === 'over-d12' ? 'beyond effective range' : 'beyond close range'} — automatically ineffective.`, 'p. 35')
    advanceActivation(state, unit, activation, 1)
    return null
  }
  if (!result.fireEffect) {
    advanceActivation(state, unit, activation, 1)
    return null
  }

  const dice: number[] = [result.fireEffect.targetRoll, ...result.fireEffect.firerRolls]
  if (result.potentialHits?.extraRoll) dice.push(result.potentialHits.extraRoll)
  for (const h of result.hits) dice.push(h.allocationRoll, h.penetration.impactRoll, h.penetration.armourRoll)

  let leaderJustLost = false
  const casualtiesCount = Object.keys(result.figureResults).length
  for (const [idxStr, outcome] of Object.entries(result.figureResults)) {
    const f = targetFigs[Number(idxStr)]!
    f.status = outcome
    if (target.leaderId === f.id) leaderJustLost = true
  }

  const firerDiceLog = [QUALITY_DIE[unit.quality], ...(assembly.profiles.length > 0 ? [fireValueToDie(assembly.profiles.reduce((s, p) => s + p.firepower, 0))] : []), ...assembly.supportDice]
  log(
    state,
    action.side,
    `${unit.name} fires ${weaponLabel} (${firerDiceLog.map((d) => `D${d}`).join('+')} vs D${result.rangeDie.die}) at ${target.name}, ${range.toFixed(1)}": ${result.fireEffect.effect}${casualtiesCount > 0 ? `, ${casualtiesCount} casualt${casualtiesCount === 1 ? 'y' : 'ies'}` : ''}.`,
    'p. 35',
    dice,
  )

  panicCheck(state, target)
  afterAttack(state, target, { suppressed: result.suppressed, casualties: casualtiesCount, leaderLost: leaderJustLost })

  advanceActivation(state, unit, activation, 1)
  return null
}

// ---------------------------------------------------------------------------
// Close assault (Chapter 15, pp. 41–43)
// ---------------------------------------------------------------------------

function applyCloseCombatCasualty(state: GameState, figureId: string, result: CloseCombatCasualtyRoll): void {
  const f = state.figures[figureId]!
  f.status = result.outcome === 'dead' ? 'dead' : result.outcome === 'wounded' ? 'wounded' : result.outcome === 'stunned-recovers' ? 'ok' : 'dead'
}

/** Once every down figure's severity is settled (p. 42–43), check each side's leader once — not per figure, so a leader appointed mid-resolution can't itself be "lost" a second time from a casualty that had already happened before the appointment. A leader lost this way owes the same mandatory "leader becomes a casualty" Confidence Test as one lost to fire (p. 10) — this suppression/test still applies even to a HIGH-motivation unit. */
function checkLeaderAfterAssault(state: GameState, unit: UnitState): void {
  if (unit.leaderId && fit(state.figures[unit.leaderId]!)) return
  unit.suppression = Math.min(3, unit.suppression + 1) as UnitState['suppression']
  const roll = replacementLeaderRoll(unit.leadership, state.rng)
  unit.leadership = roll.leadership
  unit.leaderId = figuresOf(state, unit).find(fit)?.id ?? null
  log(state, unit.sideId, `${unit.name}'s leader falls in the assault: D6 rolls ${roll.roll}, leadership becomes ${roll.leadership}.`, 'p. 10', [roll.roll])
  const threat = confidenceThreatLevel(unit.motivation, { leaderCasualty: true })
  if (threat === 'not-required') return
  const test = confidenceTest(unit.quality, unit.leadership, threat, state.rng)
  const before = unit.confidence
  if (test.drop > 0) unit.confidence = lowerConfidence(unit.confidence, test.drop)
  log(state, unit.sideId, `${unit.name} tests confidence at +${threat}: D${QUALITY_DIE[unit.quality]} rolls ${test.roll} against ${test.target} — ${test.drop === 0 ? 'holds' : `drops ${test.drop === 2 ? 'two levels' : 'a level'} from ${before} to ${unit.confidence}`}.`, 'p. 20', [test.roll])
}

interface CloseCombatOutcome {
  attackerDown: string[]
  defenderDown: string[]
  winner: 'attacker' | 'defender'
}

/** Pairing off's leftover figures need a decision the contract's `Action` gives no field for (p. 41–42's "the defender/attacker chooses"); resolved here by drawing from the state's own stream instead, using `fire.ts`'s own figure-allocation die. */
function autoExtraAssignments(count: number, fewLen: number, rng: DiceStream): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const die = allocationDie(fewLen)
    out.push(allocateHit(fewLen, rollDie(die, rng)))
  }
  return out
}

function runCloseCombat(state: GameState, attacker: UnitState, defender: UnitState, attackerFigureIds: readonly string[]): CloseCombatOutcome {
  // First-round cover bonus (p. 42) only when the defenders are actually in cover, in position, or
  // occupying field defences (no field-defence model yet) — never in the open.
  const defenderInCover = unitCover(state, defender) !== 'open' || defender.inPosition
  let attackerStanding = [...attackerFigureIds]
  let defenderStanding = figuresOf(state, defender)
    .filter(fit)
    .map((f) => f.id)
  const attackerDown: string[] = []
  const defenderDown: string[] = []
  let attackerCasOverall = 0
  let defenderCasOverall = 0
  let round = 1

  for (;;) {
    const fewLen = Math.min(attackerStanding.length, defenderStanding.length)
    const extraCount = Math.abs(attackerStanding.length - defenderStanding.length)
    const extraAssignments = autoExtraAssignments(extraCount, fewLen, state.rng)
    const pairing = pairOff(attackerStanding, defenderStanding, extraAssignments)
    const fighters: CloseCombatFighter[] = [
      ...attackerStanding.map((id) => {
        const f = state.figures[id]!
        return { id, quality: attacker.quality, weaponShift: weaponShiftFor(f), powerArmoured: isPowerArmoured(f), opponents: pairing.fights[id]! }
      }),
      ...defenderStanding.map((id) => {
        const f = state.figures[id]!
        return { id, quality: defender.quality, weaponShift: weaponShiftFor(f), powerArmoured: isPowerArmoured(f), firstRoundCoverBonus: round === 1 && defenderInCover, opponents: pairing.fights[id]! }
      }),
    ]
    const result = resolveCloseCombatRound(fighters, state.rng)
    const roundAttackerDown = result.downIds.filter((id) => attackerStanding.includes(id))
    const roundDefenderDown = result.downIds.filter((id) => defenderStanding.includes(id))
    attackerDown.push(...roundAttackerDown)
    defenderDown.push(...roundDefenderDown)
    attackerStanding = attackerStanding.filter((id) => !roundAttackerDown.includes(id))
    defenderStanding = defenderStanding.filter((id) => !roundDefenderDown.includes(id))
    attackerCasOverall += roundAttackerDown.length
    defenderCasOverall += roundDefenderDown.length
    log(state, attacker.sideId, `Close combat round ${round}: ${roundAttackerDown.length} of ${attacker.name} and ${roundDefenderDown.length} of ${defender.name} go down.`, 'p. 42')

    if (attackerStanding.length === 0 || defenderStanding.length === 0) {
      const winner: 'attacker' | 'defender' = attackerStanding.length === 0 && defenderStanding.length === 0 ? (attackerCasOverall <= defenderCasOverall ? 'attacker' : 'defender') : attackerStanding.length === 0 ? 'defender' : 'attacker'
      return { attackerDown, defenderDown, winner }
    }

    const firstRole = round <= 2 ? whoTestsFirst(roundAttackerDown.length, roundDefenderDown.length) : whoTestsFirst(attackerCasOverall, defenderCasOverall)
    const order: Array<'attacker' | 'defender'> = firstRole === 'attacker' ? ['attacker', 'defender'] : ['defender', 'attacker']
    let broken: 'attacker' | 'defender' | null = null
    for (const role of order) {
      const u = role === 'attacker' ? attacker : defender
      const roundCas = role === 'attacker' ? roundAttackerDown.length : roundDefenderDown.length
      const t = assaultRoundEndTest(u.quality, u.leadership, roundCas, state.rng)
      const before = u.confidence
      if (t.drop > 0) u.confidence = lowerConfidence(u.confidence, t.drop)
      log(state, u.sideId, `${u.name} tests to keep fighting at +${roundCas}: D${QUALITY_DIE[u.quality]} rolls ${t.roll} against ${t.target} — ${t.fellBack ? `falls back from ${before}` : 'holds'}.`, 'p. 42', [t.roll])
      if (t.fellBack) {
        broken = role
        break
      }
    }
    if (broken) return { attackerDown, defenderDown, winner: broken === 'attacker' ? 'defender' : 'attacker' }
    round += 1
  }
}

function withdrawUnit(state: GameState, u: UnitState, awayFrom: Point): void {
  const back = Math.max(6, normalMoveInches(u.mobility, 1))
  for (const f of figuresOf(state, u).filter(alive)) {
    const dx = f.position.x - awayFrom.x
    const dy = f.position.y - awayFrom.y
    const len = Math.hypot(dx, dy) || 1
    const brg = bearing(awayFrom, f.position)
    const rad = (brg * Math.PI) / 180
    const nx = f.position.x + (len > 1e-6 ? dx / len : Math.sin(rad)) * back
    const ny = f.position.y + (len > 1e-6 ? dy / len : -Math.cos(rad)) * back
    f.position = { x: Math.max(0, Math.min(state.setup.table.width, nx)), y: Math.max(0, Math.min(state.setup.table.depth, ny)) }
  }
}

/** The small-arms-plus-support-weapons assembly for Final Defensive Fire (p. 43): every fit defending figure shoots, support weapons joining exactly as an ordinary small-arms fire action would (p. 35) — FDF gives the defenders no choice to hold any of it back. */
function assembleFdf(state: GameState, defender: UnitState): { profiles: SmallArmProfile[]; supportDice: DieType[]; impact: DieType } {
  const shooters = figuresOf(state, defender).filter(fit)
  const supportFigs = shooters.filter((f) => f.supportWeapon)
  const supportSet = new Set(supportFigs.map((f) => f.id))
  const riflemen = shooters.filter((f) => !supportSet.has(f.id))
  const profiles = riflemen.map((f) => smallArmProfile(f.smallArm))
  const supportDice = supportFigs.map((f) => supportWeaponProfile(f.supportWeapon!).firepowerDie)
  const impact = profiles[0]?.impact ?? (supportFigs[0] ? supportWeaponProfile(supportFigs[0].supportWeapon!).impact : 4)
  return { profiles, supportDice, impact }
}

function closeAssault(state: GameState, action: Extract<Action, { kind: 'close-assault' }>): Refusal | null {
  const got = activeUnit(state, action.side)
  if ('ok' in got) return got
  const { unit, activation } = got
  const restriction = restrictionRefusal(state, unit, 'close-assault')
  if (restriction) return restriction
  const target = state.units[action.targetUnitId]
  if (!target || target.sideId === unit.sideId) return refuse('Close assault an enemy unit.', 'p. 41')

  // `planAssault` is the one source of truth for whether this charge is even legal (a fit defender to
  // fight, every path ending in base contact, the target within the reach of two combat moves) — the
  // handler refuses with exactly its refusal rather than re-deriving these checks (per the round's brief).
  const plan = planAssault(state, unit.id, target.id, action.moves)
  if ('ok' in plan) return plan

  // `restrictionRefusal` above already bars BROKEN/ROUTED, so `attemptCloseAssaultReaction`'s own
  // confidence gate (the same rule, in `assault.ts`) can never actually refuse here; the check stays to
  // narrow the type rather than to do further work.
  const attempt = attemptCloseAssaultReaction(unit.quality, unit.leadership, unit.confidence, state.rng)
  if (!attempt.ok) return attempt
  log(state, action.side, `${unit.name} nerves itself to close assault ${target.name}: D${QUALITY_DIE[unit.quality]} rolls ${attempt.roll} against ${attempt.target} — ${attempt.passed ? 'it charges' : 'it balks'}.`, 'p. 41', [attempt.roll])
  if (!attempt.passed) {
    // "the unit loses its first action but may still use its second action for something else (it may
    // not retry the close-assault that activation)" (p. 41) — the second action's own restriction check
    // sees `actionsLeft(state) < 2` and refuses another close-assault attempt on its own.
    advanceActivation(state, unit, activation, 1)
    return null
  }

  const attackerFigureIds = action.moves.map((m) => m.figureId)
  const startPositions: Record<string, Point> = {}
  for (const id of attackerFigureIds) startPositions[id] = { ...state.figures[id]!.position }

  const stand = defenderStandTest(target.quality, target.leadership, target.confidence, plan.odds, false, state.rng)
  panicCheck(state, target)

  let defenderFellBack = false
  if (stand.autoRout) {
    target.confidence = 'RO'
    log(state, target.sideId, `${target.name}, already broken, routs rather than stand.`, 'p. 41')
    defenderFellBack = true
  } else if (stand.drop > 0) {
    const before = target.confidence
    target.confidence = lowerConfidence(target.confidence, stand.drop)
    log(state, target.sideId, `${target.name} tests to stand at +${plan.standThreat}: D${QUALITY_DIE[target.quality]} rolls ${stand.roll} against ${stand.target} — falls back from ${before} to ${target.confidence}.`, 'p. 41', [stand.roll])
    defenderFellBack = true
  } else {
    log(state, target.sideId, `${target.name} stands to receive the charge at +${plan.standThreat}: D${QUALITY_DIE[target.quality]} rolls ${stand.roll} against ${stand.target} — holds.`, 'p. 41', [stand.roll])
  }

  if (defenderFellBack) {
    // Uncontested: the defender gives up the ground outright, so the attackers simply occupy it (p. 41)
    // — no combat move is rolled for this.
    const attackerCentre = unitCentre(attackerFigureIds.map((id) => state.figures[id]!.position))
    withdrawUnit(state, target, attackerCentre)
    for (const m of action.moves) state.figures[m.figureId]!.position = { ...m.path[m.path.length - 1]! }
    updateObjectives(state)
    advanceActivation(state, unit, activation, 2)
    return null
  }

  // The defender stands: the attacker's Combat Move for the first action (p. 41), each named figure
  // advancing along its own declared path with the roll's allowance (terrain costs as `move` charges
  // them). [reading]: a figure's declared path is read as a single leg toward its contact point in the
  // overwhelmingly common case (`assaultMoves`/`planAssault`'s own defaults, and what the screen is
  // expected to hand in); a longer, multi-waypoint path is advanced the same way `move` does, without
  // trying to reconstruct exactly which waypoint a roll that fell short of the whole path stopped short
  // of, since Close Assault gives no second declaration to correct for it anyway.
  const mobility = unit.mobility
  const die = combatMoveDie(mobility)
  const positions: Record<string, Point> = {}
  const remainingPaths: Record<string, Point[]> = {}
  for (const m of action.moves) {
    positions[m.figureId] = { ...state.figures[m.figureId]!.position }
    remainingPaths[m.figureId] = [...m.path]
  }
  const advance = (allowanceInches: number): void => {
    for (const id of attackerFigureIds) {
      const rest = remainingPaths[id]!
      if (rest.length === 0) continue
      const path = [positions[id]!, ...rest]
      const cost = pathCost(path, mobility, state.setup.table.terrain)
      if (!cost.blockedAt && cost.factors <= allowanceInches + 1e-9) {
        positions[id] = { ...rest[rest.length - 1]! }
        remainingPaths[id] = []
      } else {
        const progress = advanceAlongPath(path, allowanceInches, mobility, state.setup.table.terrain)
        positions[id] = { ...progress.reached }
      }
    }
  }
  const writePositions = (): void => {
    for (const id of attackerFigureIds) state.figures[id]!.position = { ...positions[id]! }
  }
  const contactFigures = (): string[] => {
    const defenderPositions = figuresOf(state, target)
      .filter(fit)
      .map((f) => f.position)
    return attackerFigureIds.filter((id) => defenderPositions.some((p) => distance(positions[id]!, p) <= CONTACT_REACH + 1e-9))
  }

  const roll1 = rollDie(die, state.rng)
  const allowance1 = combatMoveInches(roll1)
  advance(allowance1)
  writePositions()
  log(state, action.side, `${unit.name} makes its Combat Move to close: D${die} rolls ${roll1}, ${allowance1}".`, 'p. 41', [roll1])

  let contacted = contactFigures()

  if (contacted.length === 0) {
    // Short (p. 43): Final Defensive Fire. The defenders, having already passed their stand test, take
    // a free small-arms action at the attackers, whether or not they have activated this turn — a
    // suppressed defender must first pass a Reaction Test at TL = its suppression markers, or it never
    // fires at all.
    const gate = finalDefensiveFireGate(target.suppression)
    let fdfHappened = !gate.needsReactionTest
    if (gate.needsReactionTest) {
      const t = reactionTest(target.quality, target.leadership, gate.threatLevel, state.rng)
      log(
        state,
        target.sideId,
        `${target.name}, suppressed, tries to give final defensive fire: D${QUALITY_DIE[target.quality]} rolls ${t.roll} against ${t.target} — ${t.passed ? 'they fire' : 'too pinned to react'}.`,
        'p. 43',
        [t.roll],
      )
      fdfHappened = t.passed
    }

    let fdfCasualties = 0
    if (fdfHappened) {
      const fdf = assembleFdf(state, target)
      const attackerCentreNow = unitCentre(attackerFigureIds.map((id) => positions[id]!))
      const defenderCentre = unitPosition(state, target)
      const range = rangeBetweenUnits(defenderCentre, attackerCentreNow)
      const band = rangeBandInches(target.quality)
      const attackerCover = unitCoverGrade(attackerFigureIds.map((id) => figureCoverGrade(positions[id]!, state.setup.table.terrain)))
      const fdfTargetFigures = attackerFigureIds.map((id) => ({ armourDie: armourDie(state.figures[id]!.armour) }))
      const fdfTarget = { cover: attackerCover as FireCoverGrade, inPosition: false, figures: fdfTargetFigures }
      const fdfResult = fireSquadSmallArms(target.quality, fdf.profiles, range, band, fdfTarget, fdf.supportDice, state.rng)

      const fdfDice: number[] = fdfResult.fireEffect ? [fdfResult.fireEffect.targetRoll, ...fdfResult.fireEffect.firerRolls] : []
      if (fdfResult.potentialHits?.extraRoll) fdfDice.push(fdfResult.potentialHits.extraRoll)
      for (const h of fdfResult.hits) fdfDice.push(h.allocationRoll, h.penetration.impactRoll, h.penetration.armourRoll)

      // "there is no normal SUPPRESSION result used... if the fire fails to score actual casualties,
      // then there is no effect" (p. 43) — only `figureResults` (actual wounds/kills) count here.
      fdfCasualties = interpretFinalDefensiveFire(fdfResult).casualties
      for (const [idxStr, outcome] of Object.entries(fdfResult.figureResults)) state.figures[attackerFigureIds[Number(idxStr)]!]!.status = outcome
      unit.firedOnBy[target.id] = state.turn // the attacker has now been fired on by this defender (p. 21)
      const rangeWord = 'impossible' in fdfResult.rangeDie ? (fdfResult.rangeDie.reason === 'over-d12' ? 'beyond effective range' : 'beyond close range') : null
      const effectWord = rangeWord ?? (fdfCasualties > 0 ? `${fdfCasualties} casualt${fdfCasualties === 1 ? 'y' : 'ies'}` : 'no effect')
      log(state, target.sideId, `${target.name} gives final defensive fire at ${unit.name}, ${range.toFixed(1)}": ${effectWord}.`, 'p. 43', fdfDice)
      if (fdfResult.fireEffect && fdfResult.fireEffect.effect !== 'no-effect') panicCheck(state, unit)
    }

    if (fdfCasualties > 0) {
      const reaction = attackerReactionAfterFdf(unit.quality, unit.leadership, fdfCasualties, state.rng)
      log(
        state,
        action.side,
        `${unit.name} tests reaction under final defensive fire at +${fdfCasualties}: D${QUALITY_DIE[unit.quality]} rolls ${reaction.roll} against ${reaction.target} — ${reaction.passed ? 'presses on' : 'falls back'}.`,
        'p. 43',
        [reaction.roll],
      )
      if (!reaction.passed) {
        // [reading]: back to where the assault started, one of the two choices the book gives ("the
        // nearest cover, or to the point it started the assault from") — the simpler of the two, and
        // one `applyAction` can always resolve without a further terrain search.
        for (const id of attackerFigureIds) state.figures[id]!.position = { ...startPositions[id]! }
        unit.suppression = Math.min(3, unit.suppression + 1) as UnitState['suppression']
        log(state, action.side, `${unit.name} abandons the assault and pulls back, suppressed.`, 'p. 43')
        advanceActivation(state, unit, activation, 2)
        return null
      }
    }

    // No casualties, or the reaction test passed: the second action rolls the Combat Move again, the
    // figures carrying on from wherever the first roll left them (p. 43).
    const roll2 = rollDie(die, state.rng)
    const allowance2 = combatMoveInches(roll2)
    advance(allowance2)
    writePositions()
    log(state, action.side, `${unit.name} rolls its Combat Move again: D${die} rolls ${roll2}, ${allowance2}".`, 'p. 43', [roll2])
    contacted = contactFigures()

    if (contacted.length === 0) {
      const ifShort = action.ifShort ?? 'stay'
      if (ifShort === 'withdraw') {
        for (const id of attackerFigureIds) state.figures[id]!.position = { ...startPositions[id]! }
        unit.suppression = Math.min(3, unit.suppression + 1) as UnitState['suppression']
        log(state, action.side, `${unit.name} still falls short and gives up the assault, suppressed.`, 'p. 43')
      } else {
        log(state, action.side, `${unit.name} still falls short and holds where the dash left it.`, 'p. 43')
      }
      advanceActivation(state, unit, activation, 2)
      return null
    }
  }

  // Contact (p. 41): the figures that reached fight; any others sit this round out where their roll
  // left them.
  const outcome = runCloseCombat(state, unit, target, contacted)

  for (const id of outcome.attackerDown) {
    const r = closeCombatCasualtyRoll(outcome.winner === 'attacker', state.rng)
    applyCloseCombatCasualty(state, id, r)
    log(state, unit.sideId, `${state.figures[id]!.name} was put down: D6 rolls ${r.roll} — ${r.outcome}.`, 'p. 42', [r.roll])
  }
  for (const id of outcome.defenderDown) {
    const r = closeCombatCasualtyRoll(outcome.winner === 'defender', state.rng)
    applyCloseCombatCasualty(state, id, r)
    log(state, target.sideId, `${state.figures[id]!.name} was put down: D6 rolls ${r.roll} — ${r.outcome}.`, 'p. 42', [r.roll])
  }
  checkLeaderAfterAssault(state, unit)
  checkLeaderAfterAssault(state, target)

  const winnerUnit = outcome.winner === 'attacker' ? unit : target
  const loserUnit = outcome.winner === 'attacker' ? target : unit
  withdrawUnit(state, loserUnit, unitPosition(state, winnerUnit))
  log(state, action.side, `${winnerUnit.name} wins the close assault; ${loserUnit.name} falls back.`, 'p. 43')

  updateObjectives(state)
  advanceActivation(state, unit, activation, 2)
  return null
}

// ---------------------------------------------------------------------------
// Advisory API for the screen and the computer player
// ---------------------------------------------------------------------------

export type AllowedActionKind = Exclude<Action['kind'], 'ready' | 'deploy' | 'choose-first' | 'activate' | 'pass' | 'done'>

const ALLOWED_ACTION_KINDS: readonly AllowedActionKind[] = ['move', 'fire', 'close-assault', 'reorganise', 'remove-suppression', 'go-in-position', 'leave-position', 'transfer', 'rally', 'recover-panic', 'end-activation']

/** For the unit now activated, each action kind with `{ ok: true }` or the refusal it would meet, so the screen can grey a button out with its reason without trying it. */
export function allowedActions(state: GameState): Record<AllowedActionKind, { ok: true } | Refusal> {
  const out = {} as Record<AllowedActionKind, { ok: true } | Refusal>
  const activation = state.activation
  const unit = activation ? state.units[activation.unitId]! : null
  for (const kind of ALLOWED_ACTION_KINDS) {
    out[kind] = coarseCheck(state, unit, activation, kind)
  }
  return out
}

function coarseCheck(state: GameState, unit: UnitState | null, activation: ActivationState | null, kind: AllowedActionKind): { ok: true } | Refusal {
  if (!unit || !activation) return refuse('No unit is activated.', 'p. 15')
  if (kind !== 'end-activation' && actionsLeft(state) <= 0) return refuse('No actions left this activation.', 'p. 15')
  // `end-activation` is dispatched by `endActivationAction`, which never calls `restrictionRefusal` at
  // all — ending an activation is always legal, whatever the unit's panic/suppression/disorganisation/
  // travel state, so the advisory API must not claim otherwise for the one action a restricted unit can
  // always take.
  if (kind !== 'end-activation') {
    const restriction = restrictionRefusal(state, unit, kind)
    if (restriction) return restriction
  }
  switch (kind) {
    case 'move':
      return figuresOf(state, unit).some(fit) ? { ok: true } : refuse(`${unit.name} has no one able to move.`, 'p. 22')
    case 'fire': {
      const hasWeapon =
        (!unit.firedThisTurn.includes('small-arms') && figuresOf(state, unit).some(fit)) ||
        figuresOf(state, unit).some((f) => f.supportWeapon && fit(f) && !unit.firedThisTurn.includes(f.id))
      if (!hasWeapon) return refuse(`${unit.name} has no weapon left to fire this turn.`, 'p. 33')
      return Object.values(state.units).some((u) => u.sideId !== unit.sideId && figuresOf(state, u).some(canBeHit)) ? { ok: true } : refuse('No target left.', 'p. 33')
    }
    case 'close-assault':
      return Object.values(state.units).some((u) => u.sideId !== unit.sideId && figuresOf(state, u).some(fit)) ? { ok: true } : refuse('No target left.', 'p. 41')
    case 'reorganise':
      return { ok: true }
    case 'remove-suppression':
      return unit.suppression > 0 ? { ok: true } : refuse(`${unit.name} is not suppressed.`, 'p. 18')
    case 'go-in-position':
      return unit.inPosition ? refuse(`${unit.name} is already in position.`, 'p. 13') : { ok: true }
    case 'leave-position':
      return unit.inPosition ? { ok: true } : refuse(`${unit.name} is not in position.`, 'p. 13')
    case 'transfer': {
      const subs = Object.values(state.units).filter((u) => u.commanderId === unit.id && figuresOf(state, u).some(alive))
      if (subs.length === 0) return refuse(`${unit.name} has no subordinate to transfer to.`, 'p. 16')
      if (unit.transfersThisTurn >= 2) return refuse(`${unit.name} has already attempted two transfers this turn.`, 'p. 16')
      return { ok: true }
    }
    case 'rally': {
      const targets = Object.values(state.units).filter((u) => u.commanderId === unit.id && u.confidence !== 'CO' && figuresOf(state, u).some(alive))
      return targets.length > 0 ? { ok: true } : refuse('No unit to rally.', 'p. 17')
    }
    case 'recover-panic':
      return unit.panic ? { ok: true } : refuse(`${unit.name} is not panicked.`, 'p. 21')
    case 'end-activation':
      return { ok: true }
  }
}

export interface MoveAllowanceResult {
  /** Inches allowed this one action; null for combat move, whose distance is rolled (`die` names the die instead). */
  inches: number | null
  die?: DieType
}

/** Inches (or the combat die) one action of the given mode grants a figure. */
export function moveAllowance(state: GameState, figureId: string, mode: 'normal' | 'combat' | 'travel'): MoveAllowanceResult {
  const f = state.figures[figureId]
  if (!f) return { inches: 0 }
  const unit = state.units[f.unitId]!
  if (mode === 'normal') return { inches: normalMoveInches(unit.mobility, 1) }
  if (mode === 'travel') return { inches: travelMoveInches(unit.mobility, 1) }
  return { inches: null, die: combatMoveDie(unit.mobility) }
}

export interface MovePlan {
  cost: PathCost
  allowance: MoveAllowanceResult
  /** Whether the declared allowance (for normal/travel) covers the whole path; always false for combat move, whose actual roll is unknown ahead of time. */
  reaches: boolean
}

/** How far a figure gets along a path, and what it costs, without rolling (for normal/travel; combat move's distance is random). */
export function planMove(state: GameState, figureId: string, path: readonly Point[], mode: 'normal' | 'combat' | 'travel'): MovePlan {
  const f = state.figures[figureId]!
  const unit = state.units[f.unitId]!
  const cost = pathCost([f.position, ...path], unit.mobility, state.setup.table.terrain)
  const allowance = moveAllowance(state, figureId, mode)
  const reaches = allowance.inches !== null && !cost.blockedAt && cost.factors <= allowance.inches + 1e-9
  return { cost, allowance, reaches }
}

export interface FirePlan {
  range: number
  rangeBandInches: number
  rangeDie: RangeDieResult
  firerDice: DieType[]
  impact: DieType
  targetCover: CoverGrade
  targetInPosition: boolean
  /** Exactly one firer die exceeding the target's roll (suppression only). */
  pMinor: number
  /** Two or more firer dice exceeding (fully effective). */
  pMajor: number
  /** Approximate: the expected number of potential hits that penetrate armour, by linearity of expectation — it does not model two hits landing on the same figure (an [reading], per the brief's "or a fixed seeded sample if exact is too slow"; exact would need a full per-figure allocation enumeration). */
  expectedCasualties: number
}

function fireValueOf(profiles: readonly SmallArmProfile[]): number {
  return profiles.reduce((s, p) => s + p.firepower, 0)
}

/** Every distinct (exceeding-count, dice-sum) outcome of a set of dice against one target roll, exact by enumeration. */
function fireOddsAgainstRoll(firerDice: readonly DieType[], t: number): { minor: number; major: number; expectedSumGivenMajor: number } {
  let dist = new Map<string, number>([['0,0', 1]])
  for (const d of firerDice) {
    const next = new Map<string, number>()
    for (const [key, p] of dist) {
      const [c, s] = key.split(',').map(Number) as [number, number]
      for (let v = 1; v <= d; v++) {
        const nk = `${c + (v > t ? 1 : 0)},${s + v}`
        next.set(nk, (next.get(nk) ?? 0) + p / d)
      }
    }
    dist = next
  }
  let minor = 0
  let major = 0
  let sumGivenMajor = 0
  for (const [key, p] of dist) {
    const [c, s] = key.split(',').map(Number) as [number, number]
    if (c === 1) minor += p
    else if (c >= 2) {
      major += p
      sumGivenMajor += p * s
    }
  }
  return { minor, major, expectedSumGivenMajor: sumGivenMajor }
}

function penetrationChance(impact: DieType, armour: DieType): number {
  let hits = 0
  for (let i = 1; i <= impact; i++) for (let a = 1; a <= armour; a++) if (i > a) hits += 1
  return hits / (impact * armour)
}

/** The range, dice and odds of a fire action, without rolling (p. 33–36), by enumerating every die outcome exactly. */
export function planFire(state: GameState, unitId: string, targetUnitId: string, fireWith: FireWith): FirePlan | Refusal {
  const unit = state.units[unitId]
  const target = state.units[targetUnitId]
  if (!unit || !target) return refuse('Unknown unit.', 'p. 33')
  const assembly = assembleFire(state, unit, fireWith)
  if ('ok' in assembly) return assembly

  const firerCentre = unitPosition(state, unit)
  const targetCentre = unitPosition(state, target)
  const range = rangeBetweenUnits(firerCentre, targetCentre)
  const band = rangeBandInches(unit.quality)
  const cover = unitCover(state, target)
  const rd = rangeDie(range, band, cover, target.inPosition, assembly.closeOnly)
  const firerDice: DieType[] = [QUALITY_DIE[unit.quality], ...(assembly.profiles.length > 0 ? [fireValueToDie(fireValueOf(assembly.profiles))] : []), ...assembly.supportDice]

  if ('impossible' in rd) return { range, rangeBandInches: band, rangeDie: rd, firerDice, impact: assembly.impact, targetCover: cover, targetInPosition: target.inPosition, pMinor: 0, pMajor: 0, expectedCasualties: 0 }

  let pMinor = 0
  let pMajor = 0
  let expectedPotentialHits = 0
  for (let t = 1; t <= rd.die; t++) {
    const { minor, major, expectedSumGivenMajor } = fireOddsAgainstRoll(firerDice, t)
    pMinor += minor / rd.die
    pMajor += major / rd.die
    expectedPotentialHits += expectedSumGivenMajor / rd.die / rd.die
  }
  const targetFigs = figuresOf(state, target).filter(canBeHit)
  const pPenetrate = targetFigs.length > 0 ? targetFigs.reduce((s, f) => s + penetrationChance(assembly.impact, coverShiftedArmourDie(armourDie(f.armour), cover)), 0) / targetFigs.length : 0
  const expectedCasualties = expectedPotentialHits * pPenetrate

  return { range, rangeBandInches: band, rangeDie: rd, firerDice, impact: assembly.impact, targetCover: cover, targetInPosition: target.inPosition, pMinor, pMajor, expectedCasualties }
}

// ---------------------------------------------------------------------------
// Close assault planning (pp. 41, 43)
// ---------------------------------------------------------------------------

/** Figure bases touch when their centres are this close (25mm bases on an inch scale). */
export const CONTACT_GAP = 1
/** A combat move ending this close to a defender counts as base contact. */
export const CONTACT_REACH = 1.25

/** Two contact points closer than this read as figures standing on top of one another (p. 41's own diagram never draws them that way); `assaultMoves` keeps every pair — two attackers, or an attacker and a defender other than its own — at least this far apart. */
const MIN_FIGURE_GAP = 0.8

/**
 * Where each fit figure of an attacking unit would charge to (p. 41): one attacker to each defender
 * first, nearest first, the rest going to whichever defender they are nearest, each ending in base
 * contact on its own side of its opponent. Figures sharing a defender fan out evenly around it (wide
 * enough apart that no two land within `MIN_FIGURE_GAP`), and any point that would still crowd a
 * *different* defender's figure, or another attacker's, is nudged further round the circle. The screen
 * and the computer start from this; a player may change any path as long as it still ends in contact.
 */
export function assaultMoves(state: GameState, unitId: string, targetUnitId: string): FigureMove[] {
  const unit = state.units[unitId]
  const target = state.units[targetUnitId]
  if (!unit || !target) return []
  const attackers = figuresOf(state, unit).filter(fit)
  const defenders = figuresOf(state, target).filter(fit)
  if (attackers.length === 0 || defenders.length === 0) return []
  const centre = unitCentre(defenders.map((d) => d.position))
  const order = [...attackers].sort((a, b) => distance(a.position, centre) - distance(b.position, centre))
  const posOf = new Map(attackers.map((a) => [a.id, a.position]))

  // Pass 1 (p. 41-42): one attacker to each defender first; the rest to whichever defender they are
  // nearest, forming the groups that will fight together.
  const groupOf = new Map<string, string[]>()
  for (const d of defenders) groupOf.set(d.id, [])
  order.forEach((a, i) => {
    const free = defenders.filter((d) => groupOf.get(d.id)!.length === 0)
    const pool = i < defenders.length && free.length > 0 ? free : defenders
    const d = pool.reduce((best, x) => (distance(a.position, x.position) < distance(a.position, best.position) ? x : best))
    groupOf.get(d.id)!.push(a.id)
  })

  // Pass 2: place each group's figures around their own defender, spaced apart, then nudge away from
  // any point (a foreign defender, or an already-placed attacker) it would otherwise crowd.
  const placed: Point[] = []
  const endFor = new Map<string, Point>()
  for (const d of defenders) {
    const ids = groupOf.get(d.id)!
    const n = ids.length
    if (n === 0) continue
    const others = defenders.filter((o) => o.id !== d.id)
    const angles = ids.map((id) => {
      const p = posOf.get(id)!
      return Math.atan2(p.y - d.position.y, p.x - d.position.x)
    })
    const baseAngle = Math.atan2(
      angles.reduce((s, a) => s + Math.sin(a), 0),
      angles.reduce((s, a) => s + Math.cos(a), 0),
    )
    // A lone attacker keeps the plain contact gap, aimed straight from where it stands; several
    // sharing a defender fan out on a slightly wider ring, spaced far enough apart (chord = 2·r·sinθ/2)
    // to clear `MIN_FIGURE_GAP`, but never past `CONTACT_REACH` (planAssault's own reach check).
    const radius = n === 1 ? CONTACT_GAP : Math.min(CONTACT_REACH - 0.05, 1.2)
    const minStep = n === 1 ? 0 : 2 * Math.asin(Math.min(1, MIN_FIGURE_GAP / (2 * radius)))
    const step = n === 1 ? 0 : Math.max(minStep, (2 * Math.PI) / Math.max(n, 6))
    const baseStep = step > 1e-6 ? step / 2 : Math.PI / 6
    ids.forEach((attackerId, k) => {
      const startAngle = baseAngle + (k - (n - 1) / 2) * step
      let angle = startAngle
      let r = radius
      let end = { x: d.position.x + Math.cos(angle) * r, y: d.position.y + Math.sin(angle) * r }
      // Search both ways round the circle first (a crowded neighbour usually clears on one side or the
      // other); only once that's exhausted does standing a little further out (still short of
      // `CONTACT_REACH`) get tried, for the rare cluster too tight to route around at all.
      for (let attempt = 1; attempt <= 16; attempt++) {
        const crowdsOtherDefender = others.some((o) => distance(end, o.position) < MIN_FIGURE_GAP)
        const crowdsAnAttacker = placed.some((p) => distance(end, p) < MIN_FIGURE_GAP)
        if (!crowdsOtherDefender && !crowdsAnAttacker) break
        const dir = attempt % 2 === 1 ? 1 : -1
        const mag = Math.ceil(attempt / 2)
        angle = startAngle + dir * mag * baseStep
        if (attempt > 10) r = Math.min(CONTACT_REACH - 0.05, radius + (attempt - 10) * 0.1)
        end = { x: d.position.x + Math.cos(angle) * r, y: d.position.y + Math.sin(angle) * r }
      }
      const clamped = { x: Math.max(0.25, Math.min(state.setup.table.width - 0.25, end.x)), y: Math.max(0.25, Math.min(state.setup.table.depth - 0.25, end.y)) }
      placed.push(clamped)
      endFor.set(attackerId, clamped)
    })
  }
  return order.map((a) => ({ figureId: a.id, path: [endFor.get(a.id)!] }))
}

export interface AssaultPlan {
  moves: FigureMove[]
  /** Movement-factor cost of each figure's path, in the order of `moves`; Infinity where terrain blocks it. */
  costs: number[]
  /** The combat-move die the unit rolls each action (p. 22). */
  die: DieType
  /** Inches of movement factor one roll gives at most (the die's top score, doubled). */
  maxOneRoll: number
  /** The chance the first roll brings at least one figure into contact (p. 41). */
  pContactFirst: number
  /** The chance of contact by the second roll, if final defensive fire does not turn the charge back (p. 43). */
  pContactSecond: number
  /** Attacker to defender odds, power armour counting double (p. 41). */
  odds: number
  /** The threat level the defender's stand test will be taken at (p. 41). */
  standThreat: number
}

/**
 * A close assault before it is tried: the paths (the default contact paths unless given), what they
 * cost, the chance of reaching the defenders on the first roll and by the second, and the odds. A
 * refusal when the target cannot be charged at all: not an enemy, nobody to fight, a path that does
 * not end in contact, or defenders beyond the reach of two combat moves.
 */
export function planAssault(state: GameState, unitId: string, targetUnitId: string, moves?: readonly FigureMove[]): AssaultPlan | Refusal {
  const unit = state.units[unitId]
  const target = state.units[targetUnitId]
  if (!unit || !target) return refuse('Unknown unit.', 'p. 41')
  if (target.sideId === unit.sideId) return refuse('Close assault an enemy unit.', 'p. 41')
  const defenders = figuresOf(state, target).filter(fit)
  if (defenders.length === 0) return refuse(`${target.name} has no one left to fight.`, 'p. 41')
  const plan = moves ? [...moves] : assaultMoves(state, unitId, targetUnitId)
  if (plan.length === 0) return refuse(`${unit.name} has no one able to charge.`, 'p. 41')
  const costs: number[] = []
  for (const m of plan) {
    const f = state.figures[m.figureId]
    if (!f || f.unitId !== unit.id || !fit(f)) return refuse('Every charging figure must be a fit member of the unit.', 'p. 41')
    if (m.path.length === 0) return refuse('Give each charging figure a path.', 'p. 41')
    if (m.path.some((p) => !onTable(p, state.setup.table))) return refuse('The combat move leaves the table.', 'p. 14')
    const end = m.path[m.path.length - 1]!
    if (!defenders.some((d) => distance(end, d.position) <= CONTACT_REACH + 1e-9)) return refuse(`${f.name}'s charge must end in base contact with ${target.name}.`, 'p. 41')
    const cost = pathCost([f.position, ...m.path], unit.mobility, state.setup.table.terrain)
    costs.push(cost.blockedAt ? Number.POSITIVE_INFINITY : cost.factors)
  }
  const die = combatMoveDie(unit.mobility)
  const maxOneRoll = combatMoveInches(die)
  const nearest = Math.min(...costs)
  if (!(nearest <= 2 * maxOneRoll + 1e-9)) return refuse(`${target.name} is beyond the reach of two combat moves (${2 * maxOneRoll}" at most).`, 'p. 41')
  let first = 0
  let second = 0
  for (let r1 = 1; r1 <= die; r1++) {
    if (combatMoveInches(r1) >= nearest - 1e-9) {
      first += 1 / die
      second += 1 / die
      continue
    }
    for (let r2 = 1; r2 <= die; r2++) if (combatMoveInches(r1 + r2) >= nearest - 1e-9) second += 1 / die / die
  }
  const paCount = (ids: readonly string[]) => ids.filter((id) => isPowerArmoured(state.figures[id]!)).length
  const attackerIds = plan.map((m) => m.figureId)
  const defenderIds = defenders.map((d) => d.id)
  const odds = assaultOdds(attackerIds.length, paCount(attackerIds), defenderIds.length, paCount(defenderIds))
  return { moves: plan, costs, die, maxOneRoll, pContactFirst: first, pContactSecond: second, odds, standThreat: defenderStandThreatLevel(odds, false) }
}
