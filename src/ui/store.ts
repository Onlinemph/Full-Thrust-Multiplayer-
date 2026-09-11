import { useSyncExternalStore } from 'react'

import {
  actionSide,
  applyAction,
  clearReady,
  everyoneReady,
  sidesAwaited,
  undoableInMatch,
  type ActionOutcome,
  type GameAction,
} from '../engine/actions'
import type { GameState } from '../engine/game'
import {
  buildGame,
  CURRENT_RULES_VERSION,
  parseSavedGame,
  replayPartial,
  withEmbedded,
  type GameSetup,
  type SavedGame,
} from '../data/savedGame'

/**
 * The store journals every action it applies, so the battle on screen is always
 * (setup + journal) — and that record is what autosave writes, what undo
 * rewinds through, and what an exported battle file contains. The engine still
 * mutates in place; the UI subscribes to a version counter.
 */

const SAVE_KEY = 'ftpc.saved-game.v1'

const DEFAULT_SETUP: GameSetup = {
  scenarioId: 'intro-fleet-engagement',
  seed: 0x7c0357,
  rulesVersion: CURRENT_RULES_VERSION,
}

let setup: GameSetup = DEFAULT_SETUP
let journal: GameAction[] = []
let game: GameState = restore()

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

/** For components watching something other than the game itself. */
export const subscribeStore = subscribe

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function saved(): SavedGame {
  return { version: 1, setup: withEmbedded(setup), actions: journal }
}

function autosave(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved()))
  } catch {
    // Quota, or a private window. The battle still plays; it just will not
    // survive a refresh. Not worth interrupting the game over.
  }
}

/** Boot: pick the autosaved battle back up, or open on the default scenario. */
function restore(): GameState {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(SAVE_KEY)
    if (raw) {
      const parsed = parseSavedGame(raw)
      if (typeof parsed !== 'string') {
        setup = parsed.setup
        journal = parsed.actions
        return replayPartial(parsed, parsed.actions.length)
      }
    }
  } catch {
    // A save that no longer replays, or corrupt storage, is discarded rather
    // than wedging the app shut.
  }
  setup = DEFAULT_SETUP
  journal = []
  return buildGame(setup)
}

// ---------------------------------------------------------------------------
// Online match identity
// ---------------------------------------------------------------------------

/**
 * The side this console speaks for in an online match, or null in hot-seat.
 * A console may not give orders to the other fleet: the view redaction always
 * discouraged it, but nothing refused it, and a joiner clicking around an enemy
 * panel could journal orders for ships that were never theirs — which reads to
 * both players as the game malfunctioning.
 */
let matchSide: string | null = null

export function setMatchSide(side: string | null): void {
  matchSide = side
  emit()
}

export function currentMatchSide(): string | null {
  return matchSide
}

/**
 * Hooks the network layer installs to mirror what happens here to the peer.
 * Null in hot-seat, which is why every call site uses optional chaining.
 */
export interface NetHooks {
  onAction: (action: GameAction, sequenceAfter: number) => void
  onUndo: (lengthAfter: number) => void
  onReplace: (saved: SavedGame) => void
}

let net: NetHooks | null = null

export function setNetHooks(hooks: NetHooks | null): void {
  net = hooks
}

/** The battle as a record, for shipping to a peer that has fallen behind. */
export function currentSave(): SavedGame {
  return saved()
}

// ---------------------------------------------------------------------------
// The mutation boundary
// ---------------------------------------------------------------------------

/**
 * The one place an action becomes part of the battle: apply, journal, autosave,
 * notify. Every path — the human, the computer, the remote peer — funnels
 * through here.
 */
function applyJournaled(action: GameAction): ActionOutcome {
  const outcome = applyAction(game, action)
  journal.push(action)
  return outcome
}

/** Apply an action, journal it, autosave, notify. The only way state changes. */
export function dispatch(action: GameAction): ActionOutcome {
  if (matchSide !== null && action.type !== 'signal-ready') {
    const side = actionSide(game, action)
    // Actions with no side — advancing the shared sequence, choice scripts —
    // pass untouched. Sides the computer commands are driven from the creator's
    // console, which is the other exception.
    if (side !== null && side !== matchSide && !(setup.aiSides ?? []).includes(side)) {
      return { refused: 'That fleet is not yours to command' }
    }
  }

  const outcome = applyJournaled(action)
  autosave()
  net?.onAction(action, journal.length)
  emit()
  return outcome
}

/**
 * An action arriving from the peer.
 *
 * `sequenceAfter` is the sender's journal length once they applied it. If ours
 * disagrees, the two actions crossed on the wire. The host is the ordering
 * authority: it appends in arrival order regardless and ships a corrective
 * sync; a guest that notices the disagreement asks for one. Either way both
 * ends converge on the host's record.
 */
export function applyRemoteAction(
  action: GameAction,
  sequenceAfter: number,
  authoritative: boolean,
): 'applied' | 'mismatch' {
  const expected = journal.length + 1
  if (!authoritative && sequenceAfter !== expected) return 'mismatch'
  applyJournaled(action)
  autosave()
  emit()
  return sequenceAfter === expected ? 'applied' : 'mismatch'
}

/** An undo arriving from the peer. */
export function applyRemoteUndo(lengthAfter: number, authoritative: boolean): 'applied' | 'mismatch' {
  if (!authoritative && lengthAfter !== journal.length - 1) return 'mismatch'
  if (journal.length === 0) return 'mismatch'
  journal = journal.slice(0, -1)
  game = replayPartial({ version: 1, setup, actions: journal }, journal.length)
  clearReady(game)
  autosave()
  emit()
  return lengthAfter === journal.length ? 'applied' : 'mismatch'
}

/** The whole battle, replacing whatever is here. The host's record wins. */
export function applyRemoteSave(next: SavedGame): void {
  setup = next.setup
  journal = next.actions
  game = replayPartial(next, next.actions.length)
  clearReady(game)
  autosave()
  emit()
}

/**
 * Take back the last action by exact replay. Dice included: the journal is
 * truncated and the battle rebuilt from the setup, so a rewound volley re-rolls
 * to the same faces and undo cannot be used to fish for a better result.
 */
export function undo(): boolean {
  if (journal.length === 0) return false
  const last = journal[journal.length - 1]
  if (matchSide !== null && !undoableInMatch(last)) return false

  journal = journal.slice(0, -1)
  game = replayPartial({ version: 1, setup, actions: journal }, journal.length)
  clearReady(game)
  autosave()
  net?.onUndo(journal.length)
  emit()
  return true
}

export function canUndo(): boolean {
  if (journal.length === 0) return false
  return matchSide === null || undoableInMatch(journal[journal.length - 1])
}

/** Start a new battle. Discards the one in progress. */
export function newGame(next: GameSetup): void {
  setup = { rulesVersion: CURRENT_RULES_VERSION, ...next }
  journal = []
  game = buildGame(setup)
  autosave()
  net?.onReplace(saved())
  emit()
}

/** Load a battle file. Returns an error string, or null on success. */
export function loadGame(text: string): string | null {
  const parsed = parseSavedGame(text)
  if (typeof parsed === 'string') return parsed
  setup = parsed.setup
  journal = parsed.actions
  game = replayPartial(parsed, parsed.actions.length)
  autosave()
  net?.onReplace(saved())
  emit()
  return null
}

/** The battle as a file, ready to download. */
export function exportGame(): string {
  return JSON.stringify(saved(), null, 2)
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function currentGame(): GameState {
  return game
}

export function currentSetup(): GameSetup {
  return setup
}

export function journalLength(): number {
  return journal.length
}

export function awaitingSides(): string[] {
  return sidesAwaited(game)
}

export function phaseClosed(): boolean {
  return everyoneReady(game)
}

/**
 * Subscribe a component to the battle.
 *
 * The engine mutates in place, so the snapshot returned is a version counter
 * rather than the game itself — React re-renders when the number changes, and
 * components read the live game through `currentGame()`.
 */
export function useGameVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  )
}

/** The game, re-read on every change. */
export function useGame(): GameState {
  useGameVersion()
  return game
}
