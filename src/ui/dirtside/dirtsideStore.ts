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
  persist()
  emit()
}

/** The one door: apply an action, journal it, keep it. Returns the refusal, or null. */
export function dirtsideDispatch(action: Action): Refusal | null {
  restore()
  if (!saved || !state) return { ok: false, reason: 'No battle is under way.', page: 'p. 17' }
  const next = applyAction(state, action)
  if ('ok' in next) return next
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
  persist()
  emit()
}

/** A handle for a browser drive in development, as the battle and campaign stores offer. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __fullThrustDirtside?: unknown }).__fullThrustDirtside = {
    currentDirtsideBattle,
    dirtsideDispatch,
  }
}
