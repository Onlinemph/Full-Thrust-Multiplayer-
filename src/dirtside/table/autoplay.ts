/**
 * Dirtside II — a harness that plays both sides with random legal actions.
 * Not a player: a way to shake the engine (every refusal it meets is a
 * legal state the screen may reach) and to prove that a journal replays.
 */

import { type DiceStream, draw, newStream } from '../dice'
import { applyAction, canPass, commandUnitOf, createGame, elementsOf, functional, mobile, unactivatedUnits } from './game'
import { baseMovement, planTableShot, teamFiresRanged } from './tableFire'
import type { Action, ElementState, GameSetup, GameState, Point, ShotOrder, SideId, WeaponChoice } from './types'

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

function weaponsOf(el: ElementState): WeaponChoice[] {
  const out: WeaponChoice[] = []
  if (el.vehicle) {
    for (const w of el.vehicle.weapons) out.push({ kind: 'direct', weaponId: w.id })
    out.push({ kind: 'apsw' })
  }
  if (el.infantry && teamFiresRanged(el)) {
    out.push(el.infantry.team === 'apsw' ? { kind: 'apsw' } : { kind: 'rifles' })
    if (el.infantry.team === 'rifle') out.push({ kind: 'iavr' })
  }
  return out
}

/** Shots a unit could take now: for each element, the first weapon and target the planner accepts. */
function volleyFor(state: GameState, unitId: string, targets: ElementState[], opportunity: boolean, stream: DiceStream): ShotOrder[] {
  const unit = state.units[unitId]!
  const shots: ShotOrder[] = []
  const activation = !opportunity ? state.activation : null
  for (const el of elementsOf(state, unit)) {
    if (!functional(el)) continue
    const record = activation?.elements[el.id] ?? null
    if (record?.fired) continue
    const nearest = [...targets].filter(functional).sort((a, b) => Math.hypot(a.position.x - el.position.x, a.position.y - el.position.y) - Math.hypot(b.position.x - el.position.x, b.position.y - el.position.y)).slice(0, 4)
    let chosen: ShotOrder | null = null
    for (const target of nearest) {
      for (const weapon of weaponsOf(el)) {
        const order: ShotOrder = { elementId: el.id, weapon, targetId: target.id }
        const plan = planTableShot(state, order, { activation: record, opportunity })
        if (plan.ok) {
          chosen = order
          break
        }
      }
      if (chosen) break
    }
    if (chosen && draw(stream) < 0.9) shots.push(chosen)
  }
  return shots
}

/** One legal action for whoever is to act, or null if the game is over. */
export function chooseAction(state: GameState, stream: DiceStream): Action | null {
  if (state.result) return null
  if (state.phase === 'deployment') {
    const side: SideId = !state.sides.north.ready ? 'north' : 'south'
    return { kind: 'ready', side }
  }
  const side = state.toAct
  if (!side) return null
  if (state.phase === 'turn-start') return { kind: 'choose-first', side, first: draw(stream) < 0.5 ? 'north' : 'south' }
  const activation = state.activation
  if (activation?.window) {
    if (draw(stream) < 0.35) return { kind: 'decline-opportunity', side, forActivation: draw(stream) < 0.3 }
    const movingUnit = state.units[activation.unitId]!
    const candidates = unactivatedUnits(state, side).filter((u) => !u.panic && !u.evasive)
    for (const unit of candidates) {
      const shots = volleyFor(state, unit.id, elementsOf(state, movingUnit), true, stream)
      if (shots.length > 0) return { kind: 'opportunity-fire', side, unitId: unit.id, shots }
    }
    return { kind: 'decline-opportunity', side, forActivation: true }
  }
  if (activation) {
    const unit = state.units[activation.unitId]!
    const enemies = Object.values(state.elements).filter((e) => e.sideId !== side && functional(e))
    // Repairs first.
    for (const el of elementsOf(state, unit)) if (functional(el) && el.systemsDown && !activation.repairTried.includes(el.id) && draw(stream) < 0.8) return { kind: 'repair', side, elementId: el.id }
    // Moves: an element that has not moved, towards the enemy mostly.
    const movers = elementsOf(state, unit).filter((e) => mobile(e) && !activation.elements[e.id]!.moved)
    if (movers.length > 0 && draw(stream) < 0.75 && activation.moveTest !== 'failed') {
      const el = pick(movers, stream)
      const reach = Math.max(1, baseMovement(el) * (el.damaged ? 0.5 : 1) * (0.3 + draw(stream) * 0.7))
      const nearest = enemies.sort((a, b) => Math.hypot(a.position.x - el.position.x, a.position.y - el.position.y) - Math.hypot(b.position.x - el.position.x, b.position.y - el.position.y))[0]
      let angle = draw(stream) * Math.PI * 2
      if (nearest && draw(stream) < 0.7) angle = Math.atan2(nearest.position.y - el.position.y, nearest.position.x - el.position.x) + (draw(stream) - 0.5) * 1.2
      const target: Point = {
        x: Math.max(0.5, Math.min(state.setup.table.width - 0.5, el.position.x + Math.cos(angle) * reach)),
        y: Math.max(0.5, Math.min(state.setup.table.depth - 0.5, el.position.y + Math.sin(angle) * reach)),
      }
      return { kind: 'move', side, elementId: el.id, path: [target] }
    }
    const shots = volleyFor(state, unit.id, enemies, false, stream)
    if (shots.length > 0 && draw(stream) < 0.9) return { kind: 'fire', side, shots }
    return { kind: 'end-activation', side }
  }
  // Between activations.
  const units = unactivatedUnits(state, side)
  if (units.length === 0) return { kind: 'done', side }
  if (canPass(state, side) && draw(stream) < 0.25) return { kind: 'pass', side }
  const command = commandUnitOf(state, side)
  const shaky = units.filter((u) => u.confidence !== 'CO' && command && u.id !== command.id)
  if (shaky.length > 0 && draw(stream) < 0.3) return { kind: 'rally', side, unitId: pick(shaky, stream).id }
  if (draw(stream) < 0.03) return { kind: 'done', side }
  const total = state.setup.table.objectives.length
  const held = Object.values(state.objectives).filter((o) => o.heldBy === side).length
  if (total > 0 && held * 2 > total && draw(stream) < 0.1) return { kind: 'declare-end', side }
  return { kind: 'activate', side, unitId: pick(units, stream).id }
}

/** Play until the game ends or the caps are met. A refused action is retried with a fresh choice, ending the activation after too many. */
export function autoplay(setup: GameSetup, opts: AutoplayOptions): AutoplayReport {
  let state = createGame(setup)
  const stream = newStream(opts.seed)
  let actions = 0
  let refusals = 0
  let stuck = 0
  const maxActions = opts.maxActions ?? 4000
  const maxTurns = opts.maxTurns ?? 6
  while (!state.result && actions < maxActions && state.turn <= maxTurns) {
    let action = chooseAction(state, stream)
    if (!action) break
    let next = applyAction(state, action)
    if ('ok' in next) {
      refusals += 1
      stuck += 1
      if (stuck > 12) {
        // Break out of whatever is stuck: end the activation, or give up the turn.
        const side = state.toAct!
        action = state.activation?.window ? { kind: 'decline-opportunity', side, forActivation: true } : state.activation ? { kind: 'end-activation', side } : { kind: 'done', side }
        next = applyAction(state, action)
        if ('ok' in next) throw new Error(`autoplay cannot progress: ${next.reason} (${next.page}) after ${action.kind}`)
      } else continue
    }
    stuck = 0
    state = next
    actions += 1
  }
  return { state, actions, refusals }
}
