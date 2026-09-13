import { useSyncExternalStore } from 'react'

import {
  actionSide,
  applyAction,
  clearReady,
  undoableInMatch,
  type ActionOutcome,
  type GameAction,
} from '../engine/actions'
import { shipsAwaitingDeployment, type GameState } from '../engine/game'
import {
  buildGame,
  CURRENT_RULES_VERSION,
  parseSavedGame,
  replayPartial,
  withEmbedded,
  type GameSetup,
  type SavedGame,
} from '../data/savedGame'
import { aiActions } from '../engine/ai'
import { aliveShipIds, clearFx, fxAfter, fxBefore, queueFx } from './fx'

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
  // On for a new battle, off in every file that was saved before it existed —
  // which is the whole point of it being a setup field. A rock that does
  // nothing to a ship that flies into it is not terrain, it is scenery.
  terrainHazards: true,
  // 10.3 calls them "optional but recommended" and every SSD in the book
  // prints the block, so a new table plays with them unless it says otherwise.
  coreSystems: true,
  // A 6' × 4' board is a knife fight at these ranges; half again is where
  // manoeuvre starts to matter. The scenario's own size is still on offer.
  tableScale: 1.5,
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
  // Sampled before, because a ship that dies to return fire in the same phase
  // would otherwise have nowhere left to have shot from.
  const before = fxBefore(game, action)
  const alive = aliveShipIds(game)
  const outcome = applyAction(game, action)
  journal.push(action)
  queueFx(before, fxAfter(game, action, alive))
  return outcome
}

// ---------------------------------------------------------------------------
// The computer's captains
// ---------------------------------------------------------------------------

/**
 * Phases the computer has already acted in, keyed `turn:phase:side`.
 *
 * The computer acts once when a phase opens, and its actions go through the
 * same `dispatch` a human's clicks do — so they are journalled, they replay,
 * and a player can undo the computer's turn. Held off the game state because it
 * is about this console's driver, not about the battle: a save that reached
 * another machine must not arrive thinking the AI has already moved.
 */
let aiActed = new Set<string>()

/**
 * Let the computer take its turn in the current phase.
 *
 * Called after every dispatch rather than on a timer, because the thing that
 * opens a phase is always an action. The `aiActed` guard is what stops it
 * recursing: the computer's own actions call back in here and find the phase
 * already done.
 */
function runAi(): void {
  const sides = setup.aiSides ?? []
  if (sides.length === 0) return
  // In an online match the computer is driven from one console only — the
  // creator's — or both ends would journal its orders twice.
  if (matchSide !== null && matchSide !== game.sides[0]?.id) return

  // 18.1's deployment alternates within one phase, so the computer has to be
  // able to act several times in the same turn and phase — once per placement.
  // The guard therefore keys on how far the deployment has got, and the loop
  // runs until nobody moves, which terminates because every deployment action
  // advances that counter and every other phase acts at most once per side.
  let guard = 200
  let acted = true
  while (acted && guard-- > 0) {
    acted = false
    for (const side of sides) {
      const key = aiKey(side)
      if (aiActed.has(key)) continue
      aiActed.add(key)
      const actions = aiActions(game, side)
      if (actions.length === 0) continue
      acted = true
      for (const action of actions) {
        applyJournaled(action)
        net?.onAction(action, journal.length)
      }
    }
  }
}

function aiKey(side: string): string {
  const deployment = game.deployment
  if (deployment && shipsAwaitingDeployment(game).length > 0) {
    return `${game.turn}:${game.phase}:${side}:d${deployment.order.length}:${deployment.placed.length}`
  }
  return `${game.turn}:${game.phase}:${side}`
}

/** Apply an action, journal it, autosave, notify. The only way state changes. */
export function dispatch(action: GameAction): ActionOutcome {
  if (matchSide !== null && action.type !== 'signal-ready') {
    const side = actionSide(game, action)
    // Actions with no side — advancing the shared sequence, choice scripts —
    // pass untouched. Sides the computer commands are driven from the creator's
    // console, which is the other exception.
    if (side !== null && side !== matchSide && !(setup.aiSides ?? []).includes(side)) {
      const denied: ActionOutcome = { refused: 'That fleet is not yours to command' }
      noteRefusal(denied)
      emit()
      return denied
    }
  }

  const outcome = applyJournaled(action)
  // A refused action changes nothing, so there is nothing to send, nothing to
  // save and no AI turn to run — but there is something to say.
  noteRefusal(outcome)
  if (outcome.refused === undefined) refusal = null
  net?.onAction(action, journal.length)
  runAi()
  autosave()
  emit()
  return outcome
}

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

/**
 * The last refusal, for the panel that shows it.
 *
 * `applyAction` has always answered a bad order with a sentence naming the rule
 * that refused it — *"a short-range tube may not be fired overloaded (5.14)"* —
 * and `dispatch` has always returned that sentence to a caller that threw it
 * away. Every button in the UI dispatches, so catching it here rather than at
 * a hundred call sites is what makes the whole engine's vocabulary reachable:
 * a click that does nothing now says why.
 *
 * The counter is what makes two identical refusals in a row visible as two —
 * a player who clicks the same dead button twice should see it flash twice.
 */
let refusal: { text: string; seq: number } | null = null
let refusalSeq = 0

function noteRefusal(outcome: ActionOutcome): void {
  if (outcome.refused === undefined) return
  refusalSeq += 1
  refusal = { text: outcome.refused, seq: refusalSeq }
}

/** Take the notice down — the player has read it, or acted since. */
export function clearRefusal(): void {
  if (refusal === null) return
  refusal = null
  emit()
}

/** The current refusal, for a test or a component that is not a hook. */
export function readRefusal(): { text: string; seq: number } | null {
  return refusal
}

export function useRefusal(): { text: string; seq: number } | null {
  useGameVersion()
  return refusal
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
  clearFx()
  aiActed = new Set()
  preview = null
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
  clearFx()
  aiActed = new Set()
  preview = null
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
  clearFx()
  aiActed = new Set()
  preview = null
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
  clearFx()
  aiActed = new Set()
  preview = null
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

/**
 * The battle as it should be drawn: the preview while one is up, otherwise the
 * live game. Everything that WRITES uses `game` directly, so scrubbing can
 * never be mistaken for playing.
 */
export function currentGame(): GameState {
  return preview ?? game
}

export function currentSetup(): GameSetup {
  return setup
}

export function journalLength(): number {
  return journal.length
}

/** The journal itself, for the replay scrubber. Read-only by convention. */
export function currentJournal(): readonly GameAction[] {
  return journal
}

// ---------------------------------------------------------------------------
// Replay preview
// ---------------------------------------------------------------------------

/**
 * An earlier moment of the battle, shown without discarding the present.
 *
 * Free, and only because a battle is (setup + journal): any earlier state is
 * the journal replayed to a shorter length, with the same seed drawing the same
 * dice. Nothing is snapshotted and nothing is unwound.
 *
 * Kept beside the live game rather than replacing it, so the preview can be
 * dropped instantly and no action taken while scrubbing can reach the record —
 * `dispatch` always applies to `game`, never to this.
 */
let preview: GameState | null = null

export function previewAt(count: number): void {
  preview =
    count >= journal.length
      ? null
      : replayPartial({ version: 1, setup, actions: journal }, count)
  emit()
}

export function stopPreview(): void {
  if (preview === null) return
  preview = null
  emit()
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
  return preview ?? game
}
