/**
 * Stargrunt II — a harness that plays both sides with random legal actions.
 * Not a player: a way to shake the engine (every refusal it meets is a
 * legal state the screen may reach) and to prove that a journal replays,
 * following the shape of Dirtside's own `table/autoplay.ts`.
 */

import { draw, newStream, type DiceStream } from '../dice'
import { allowedActions, applyAction, assaultMoves, canBeHit, canPass, createGame, figuresOf, fit, actionsLeft } from './game'
import type { Action, FigureMove, GameSetup, GameState, Point, SideId, UnitState } from '../types'

export interface AutoplayOptions {
  seed: number
  maxTurns?: number
  maxActions?: number
}

export interface AutoplayReport {
  state: GameState
  actions: number
  refusals: number
}

const pick = <T>(items: readonly T[], stream: DiceStream): T => items[Math.floor(draw(stream) * items.length)]!

function randomPoint(state: GameState, from: Point, reach: number, stream: DiceStream): Point {
  const angle = draw(stream) * Math.PI * 2
  const dist = reach * (0.2 + draw(stream) * 0.8)
  return {
    x: Math.max(0.5, Math.min(state.setup.table.width - 0.5, from.x + Math.cos(angle) * dist)),
    y: Math.max(0.5, Math.min(state.setup.table.depth - 0.5, from.y + Math.sin(angle) * dist)),
  }
}

function enemyUnits(state: GameState, side: SideId): UnitState[] {
  return Object.values(state.units).filter((u) => u.sideId !== side && figuresOf(state, u).some(canBeHit))
}

function movesFor(state: GameState, unit: UnitState, stream: DiceStream, reach: number): FigureMove[] {
  const figures = figuresOf(state, unit).filter(fit)
  const moving = figures.filter(() => draw(stream) < 0.85)
  const chosen = moving.length > 0 ? moving : figures.slice(0, 1)
  return chosen.map((f) => ({ figureId: f.id, path: [randomPoint(state, f.position, reach, stream)] }))
}

/** One legal-shaped action for whoever is to act, or null if the game is over. */
export function chooseAction(state: GameState, stream: DiceStream): Action | null {
  if (state.result) return null
  if (state.phase === 'deployment') {
    const side: SideId = !state.sides.north.ready ? 'north' : 'south'
    return { kind: 'ready', side }
  }
  if (state.phase === 'turn-start') {
    const side = state.chooser!
    return { kind: 'choose-first', side, first: draw(stream) < 0.5 ? 'north' : 'south' }
  }
  const side = state.toAct
  if (!side) return null
  const activation = state.activation

  if (activation) {
    const unit = state.units[activation.unitId]!
    const allowed = allowedActions(state)
    const ready = Object.entries(allowed)
      .filter(([, r]) => r.ok)
      .map(([k]) => k) as (keyof typeof allowed)[]
    if (ready.length === 0 || actionsLeft(state) === 0) return { kind: 'end-activation', side }

    // Weight away from a bare end-activation so units actually do things.
    const pool = ready.filter((k) => k !== 'end-activation')
    const kind = pool.length > 0 && draw(stream) < 0.92 ? pick(pool, stream) : pick(ready, stream)

    switch (kind) {
      case 'move': {
        const mode = draw(stream) < 0.7 ? 'normal' : draw(stream) < 0.7 ? 'combat' : 'travel'
        const reach = mode === 'travel' ? 16 : mode === 'combat' ? 12 : 8
        return { kind: 'move', side, mode, moves: movesFor(state, unit, stream, reach) }
      }
      case 'fire': {
        const enemies = enemyUnits(state, side)
        if (enemies.length === 0) return { kind: 'end-activation', side }
        const targetUnitId = pick(enemies, stream).id
        const supportFigures = figuresOf(state, unit).filter((f) => fit(f) && f.supportWeapon && !unit.firedThisTurn.includes(f.id))
        const canSmallArms = !unit.firedThisTurn.includes('small-arms') && figuresOf(state, unit).some(fit)
        if (supportFigures.length > 0 && (!canSmallArms || draw(stream) < 0.35)) {
          const figureId = pick(supportFigures, stream).id
          return { kind: 'fire', side, targetUnitId, with: { kind: 'support', figureId } }
        }
        const joinSupport = supportFigures.length > 0 && draw(stream) < 0.4 ? [pick(supportFigures, stream).id] : []
        return { kind: 'fire', side, targetUnitId, with: { kind: 'small-arms', supportFigureIds: joinSupport } }
      }
      case 'close-assault': {
        const enemies = enemyUnits(state, side)
        if (enemies.length === 0) return { kind: 'end-activation', side }
        const target = pick(enemies, stream)
        // Legal-shaped moves (each figure's path ending in base contact, p. 41) instead of a hand-rolled
        // single point every named figure walks to — `assaultMoves` is the same default the screen and
        // the computer player use.
        const moves = assaultMoves(state, unit.id, target.id)
        if (moves.length === 0) return { kind: 'end-activation', side }
        return { kind: 'close-assault', side, targetUnitId: target.id, moves, ifShort: draw(stream) < 0.5 ? 'stay' : 'withdraw' }
      }
      case 'reorganise':
        return { kind: 'reorganise', side }
      case 'remove-suppression':
        return { kind: 'remove-suppression', side }
      case 'go-in-position':
        return { kind: 'go-in-position', side }
      case 'leave-position':
        return { kind: 'leave-position', side }
      case 'recover-panic':
        return { kind: 'recover-panic', side }
      case 'transfer': {
        const subs = Object.values(state.units).filter((u) => u.commanderId === unit.id && figuresOf(state, u).some((f) => f.status !== 'dead'))
        if (subs.length === 0) return { kind: 'end-activation', side }
        return { kind: 'transfer', side, receiverUnitId: pick(subs, stream).id }
      }
      case 'rally': {
        const targets = Object.values(state.units).filter((u) => u.commanderId === unit.id && u.confidence !== 'CO' && figuresOf(state, u).some((f) => f.status !== 'dead'))
        if (targets.length === 0) return { kind: 'end-activation', side }
        return { kind: 'rally', side, targetUnitId: pick(targets, stream).id }
      }
      case 'end-activation':
        return { kind: 'end-activation', side }
    }
  }

  // Between activations.
  const units = Object.values(state.units).filter((u) => u.sideId === side && !u.activated && figuresOf(state, u).some((f) => f.status !== 'dead'))
  if (units.length === 0) return { kind: 'done', side }
  if (canPass(state, side) && draw(stream) < 0.15) return { kind: 'pass', side }
  if (draw(stream) < 0.02) return { kind: 'done', side }
  return { kind: 'activate', side, unitId: pick(units, stream).id }
}

/** Play until the game ends or the caps are met. A refused action is retried with a fresh choice, ending the activation (or the turn) after too many. */
export function autoplay(setup: GameSetup, opts: AutoplayOptions): AutoplayReport {
  let state = createGame(setup)
  const stream = newStream(opts.seed)
  let actions = 0
  let refusals = 0
  let stuck = 0
  const maxActions = opts.maxActions ?? 4000
  const maxTurns = opts.maxTurns ?? 8
  while (!state.result && actions < maxActions && state.turn <= maxTurns) {
    let action = chooseAction(state, stream)
    if (!action) break
    let next = applyAction(state, action)
    if ('ok' in next) {
      refusals += 1
      stuck += 1
      if (stuck > 20) {
        const side = state.toAct!
        const fallback: Action = state.activation ? { kind: 'end-activation', side } : { kind: 'done', side }
        next = applyAction(state, fallback)
        if ('ok' in next) throw new Error(`autoplay cannot progress: ${next.reason} (${next.page}) after ${action.kind}`)
      } else continue
    }
    stuck = 0
    state = next
    actions += 1
  }
  return { state, actions, refusals }
}
