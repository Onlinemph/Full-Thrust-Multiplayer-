import { useSyncExternalStore } from 'react'

import { applyAction, createGame, replay } from '../../dirtside/table/game'
import type { Action, GameSetup, GameState, Refusal } from '../../dirtside/table/types'

/**
 * The Dirtside battle on this browser, kept as the fleet battle and the
 * campaign are: setup plus journal in one slot, replayed at boot, every
 * action journaled as it is taken. A refused action changes nothing and
 * is not journaled; the refusal goes back to the screen with its page.
 */

const SAVE_KEY = 'ftpc.dirtside.battle.v1'

export interface SavedDirtsideBattle {
  version: 1
  setup: GameSetup
  journal: Action[]
}

let saved: SavedDirtsideBattle | null = null
let state: GameState | null = null
let restored = false
let version = 0

/**
 * The last few actions with the states either side of them, for the screen
 * to show what just happened. States are never mutated after the door
 * returns them, so holding references is cheap. `generation` changes when
 * the battle is replaced (new, loaded, cleared, taken back) and the screen
 * should forget what it drew.
 */
export interface DirtsideTransition {
  id: number
  before: GameState
  action: Action
  after: GameState
}
const TRANSITIONS_KEPT = 40
let transitions: DirtsideTransition[] = []
let transitionId = 0
let generation = 0

function forget(): void {
  transitions = []
  generation += 1
}
const listeners = new Set<() => void>()

function emit(): void {
  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function persist(): void {
  try {
    if (saved) localStorage.setItem(SAVE_KEY, JSON.stringify(saved))
    else localStorage.removeItem(SAVE_KEY)
  } catch {
    // Quota, or a private window: the battle plays on and will not survive a refresh.
  }
}

export function parseSavedDirtsideBattle(text: string): SavedDirtsideBattle | string {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return 'Not a JSON file.'
  }
  if (!parsed || typeof parsed !== 'object') return 'Not a battle file.'
  const p = parsed as Partial<SavedDirtsideBattle>
  if (p.version !== 1 || !p.setup || !Array.isArray(p.journal)) return 'Not a Dirtside battle file.'
  if (!p.setup.table || !Array.isArray(p.setup.sides) || p.setup.sides.length !== 2) return 'The battle file has no table or sides.'
  return { version: 1, setup: p.setup, journal: p.journal }
}

function restore(): void {
  if (restored) return
  restored = true
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(SAVE_KEY)
    if (raw) {
      const parsed = parseSavedDirtsideBattle(raw)
      if (typeof parsed !== 'string') {
        saved = parsed
        state = replay(parsed.setup, parsed.journal)
      }
    }
  } catch {
    saved = null
    state = null
  }
}

export function currentDirtsideBattle(): GameState | null {
  restore()
  return state
}

export function useDirtsideBattle(): GameState | null {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  )
  return currentDirtsideBattle()
}

export function newDirtsideBattle(setup: GameSetup): void {
  restore()
  saved = { version: 1, setup, journal: [] }
  state = createGame(setup)
  forget()
  persist()
  emit()
}

/** The one door: apply an action, journal it, keep it. Returns the refusal, or null. */
export function dirtsideDispatch(action: Action): Refusal | null {
  restore()
  if (!saved || !state) return { ok: false, reason: 'No battle is under way.', page: 'p. 17' }
  const next = applyAction(state, action)
  if ('ok' in next) return next
  transitionId += 1
  transitions = [...transitions.slice(-(TRANSITIONS_KEPT - 1)), { id: transitionId, before: state, action, after: next }]
  state = next
  saved.journal.push(action)
  persist()
  emit()
  return null
}

/** Open a battle file. Returns an error sentence, or null on success. */
export function loadDirtsideBattle(text: string): string | null {
  restore()
  const parsed = parseSavedDirtsideBattle(text)
  if (typeof parsed === 'string') return parsed
  try {
    state = replay(parsed.setup, parsed.journal)
  } catch (error) {
    return `The journal does not replay: ${error instanceof Error ? error.message : String(error)}`
  }
  saved = parsed
  forget()
  persist()
  emit()
  return null
}

export function dirtsideBattleText(): string | null {
  restore()
  return saved ? JSON.stringify(saved, null, 2) : null
}

export function clearDirtsideBattle(): void {
  restore()
  saved = null
  state = null
  forget()
  persist()
  emit()
}

/** What the screen needs to draw what just happened: the recent transitions, and the battle's generation. */
export function dirtsideTransitions(): { generation: number; list: readonly DirtsideTransition[] } {
  return { generation, list: transitions }
}

/**
 * Whether the last action can be taken back honestly: it was a move, a
 * change of posture or a deployment; it drew nothing from the dice stream,
 * so the battle's future is unchanged; it did not hand play to the other
 * side, open a window or take an objective. Answered from the transition
 * kept for it, so it costs nothing to ask on every render.
 */
export function canTakeBackDirtside(): boolean {
  restore()
  if (!saved || !state) return false
  const last = transitions[transitions.length - 1]
  if (!last || last.after !== state) return false
  return honest(last.before, last.action, last.after)
}

function honest(before: GameState, action: Action, after: GameState): boolean {
  if (action.kind !== 'move' && action.kind !== 'posture' && action.kind !== 'deploy') return false
  if (before.rng.cursor !== after.rng.cursor || before.rng.seed !== after.rng.seed) return false
  if (before.toAct !== after.toAct || before.phase !== after.phase) return false
  if ((before.activation?.unitId ?? null) !== (after.activation?.unitId ?? null) || !!after.activation?.window) return false
  if (after.result) return false
  return Object.keys(after.objectives).every((id) => after.objectives[id]!.heldBy === before.objectives[id]?.heldBy)
}

/**
 * Take the last action back: the journal loses it and the battle is
 * replayed from the setup without it. Refused (false) unless
 * canTakeBackDirtside holds and the replay agrees, draw for draw.
 */
export function takeBackDirtside(): boolean {
  if (!canTakeBackDirtside() || !saved || !state) return false
  const journal = saved.journal.slice(0, -1)
  let back: GameState
  try {
    back = replay(saved.setup, journal)
  } catch {
    return false
  }
  if (back.rng.cursor !== state.rng.cursor || back.journal.length !== journal.length) return false
  const kept = transitions.slice(0, -1)
  saved = { ...saved, journal }
  state = back
  // The transitions before the one taken back still hold: their states are what was on the table.
  transitions = kept.length > 0 && kept[kept.length - 1]!.after.journal.length === journal.length ? kept.map((t, i) => (i === kept.length - 1 ? { ...t, after: back } : t)) : []
  generation += 1
  persist()
  emit()
  return true
}

/** A handle for a browser drive in development, as the battle and campaign stores offer. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __fullThrustDirtside?: unknown }).__fullThrustDirtside = {
    currentDirtsideBattle,
    dirtsideDispatch,
    newDirtsideBattle,
  }
}
