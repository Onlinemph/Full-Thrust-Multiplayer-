import { useSyncExternalStore } from 'react'

import {
  actionSide,
  applyAction,
  undoableInMatch,
  type ActionOutcome,
  type GameAction,
} from '../engine/actions'
import { canShipFire, type GameState } from '../engine/game'
import {
  buildGame,
  CURRENT_RULES_VERSION,
  parseSavedGame,
  replayPartial,
  withEmbedded,
  type GameSetup,
  type Lobby,
  type LobbyPick,
  type SavedGame,
} from '../data/savedGame'
import { designById, setEmbeddedDesigns, SHIP_DESIGNS } from '../data/ships'
import type { ShipDesign } from '../engine/types'
import { aiActions } from '../engine/ai'
import { aliveShipIds, clearFx, fxAfter, fxBefore, queueFx } from './fx'

/**
 * The store journals every action it applies, so the battle on screen is always
 * (setup + journal) — and that record is what autosave writes, what undo
 * rewinds through, and what an exported battle file contains. The engine still
 * mutates in place; the UI subscribes to a version counter.
 */

const SAVE_KEY = 'ftpc.saved-game.v1'
/** The online match, kept apart from the battle on the home table. */
const MATCH_KEY = 'ftpc.match.v1'

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
  return {
    version: 1,
    setup: withEmbedded(setup),
    actions: journal,
    ...(lobby !== null ? { lobby } : {}),
  }
}

/** Where the battle on the table is written: its own slot, or the match's. */
let saveKey = SAVE_KEY

function autosave(): void {
  try {
    localStorage.setItem(saveKey, JSON.stringify(saved()))
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

/**
 * Whether a match is on: the battle on the table is the match's, and the
 * battle that was on the table before it is waiting in its own slot.
 */
let inMatch = false
/** The home table's battle while a match is on: what comes back afterwards. */
let homeSave: SavedGame | null = null
/** Which end of the match this console is, while one is on. */
let matchRole: 'host' | 'guest' | null = null
/**
 * The match's lobby, while it has one: the host settles the rules and each
 * console picks its own fleet, and the battle starts when the host says so.
 * Null once the battle is on, and always null off-line.
 */
let lobby: Lobby | null = null

/**
 * Sit down at a match (2.6, online).
 *
 * The battle on the home table goes to its slot untouched, so a match played
 * in the middle of a solo campaign costs nothing. The host's match starts as
 * every battle should — turn 1, phase 1, from the setup as the table has it,
 * with the ready gate on so a phase ends when both consoles say so; the
 * guest's table is about to be replaced by the host's record. Each console
 * commands one side by default, the host the first and the guest the second,
 * and can pick another in the panel.
 */
export function enterMatch(role: 'host' | 'guest', fresh: boolean): void {
  if (!inMatch) {
    autosave()
    homeSave = saved()
    inMatch = true
    saveKey = MATCH_KEY
  }
  matchRole = role
  if (fresh) {
    // A new match opens in its lobby. Whatever fleets the host had picked on
    // the home table are the opening picks, and each console can change its
    // own; the rules are the host's draft until the battle starts.
    const picks: Lobby['picks'] = {}
    for (const [side, ids] of Object.entries(setup.forces ?? {})) {
      if (ids) picks[side] = { forceIds: [...ids], ready: false, designs: designsFor(ids) }
    }
    lobby = { picks }
    setup = { ...setup, readyGate: true, aiSides: [], forces: undefined, customDesigns: undefined }
    journal = []
    game = buildGame(setup)
    embedLobbyDesigns()
    clearFx()
    preview = null
  }
  const sides = game.sides.map((side) => side.id)
  matchSide = role === 'host' ? (sides[0] ?? null) : (sides[1] ?? sides[0] ?? null)
  autosave()
  emit()
}

/** Leave the match: the home table's battle comes back. */
export function leaveMatch(): void {
  if (!inMatch) return
  inMatch = false
  saveKey = SAVE_KEY
  matchSide = null
  matchRole = null
  lobby = null
  const home = homeSave
  homeSave = null
  if (home !== null) {
    try {
      setup = home.setup
      journal = home.actions
      game = replayPartial(home, home.actions.length)
      clearFx()
      preview = null
    } catch {
      // The home battle would not replay; the match's stays on the table.
    }
  }
  emit()
}

export function isInMatch(): boolean {
  return inMatch
}

/**
 * The side this console commands has to be a side the table has. A scenario
 * change in the lobby, or a record arriving from the host, can rebuild the
 * game with different sides; a console left pointing at one that is gone
 * could command nothing. It goes back to the role's default seat.
 */
function settleMatchSide(): void {
  if (matchRole === null || matchSide === null) return
  const sides = game.sides.map((side) => side.id)
  if (sides.includes(matchSide)) return
  matchSide = matchRole === 'host' ? (sides[0] ?? null) : (sides[1] ?? sides[0] ?? null)
}

export function currentMatchRole(): 'host' | 'guest' | null {
  return matchRole
}

// ---------------------------------------------------------------------------
// The lobby
// ---------------------------------------------------------------------------

export function currentLobby(): Lobby | null {
  return lobby
}

export function useLobby(): Lobby | null {
  useGameVersion()
  return lobby
}

/** The designs a pick names that the roster does not carry: they travel with it. */
function designsFor(ids: readonly string[]): ShipDesign[] {
  const out: ShipDesign[] = []
  for (const id of ids) {
    if (SHIP_DESIGNS.some((d) => d.id === id) || out.some((d) => d.id === id)) continue
    const design = designById(id)
    if (design) out.push(structuredClone(design))
  }
  return out
}

/** Every design the lobby's picks brought with them, so ids resolve here. */
function lobbyDesigns(): ShipDesign[] {
  const out: ShipDesign[] = []
  for (const pick of Object.values(lobby?.picks ?? {})) {
    for (const design of pick?.designs ?? []) {
      if (!out.some((d) => d.id === design.id)) out.push(design)
    }
  }
  return out
}

/**
 * Make the other console's home-built hulls resolvable on this one. Rebuilding
 * the game sets the embedded designs from the setup, which has none until the
 * battle starts, so this is re-done after every rebuild while the lobby is on.
 */
function embedLobbyDesigns(): void {
  if (lobby !== null) setEmbeddedDesigns(lobbyDesigns())
}

/**
 * The host changes the rules. Every console's readiness is withdrawn: what
 * they said they were ready for is no longer what is on the table.
 */
export function lobbySetup(patch: Partial<GameSetup>): void {
  if (lobby === null || matchRole !== 'host') return
  const scenarioChanged = patch.scenarioId !== undefined && patch.scenarioId !== setup.scenarioId
  setup = { ...setup, ...patch, readyGate: true, aiSides: [], forces: undefined }
  game = buildGame(setup)
  settleMatchSide()
  // Only the new table's sides keep a seat in the lobby.
  const sides = new Set(game.sides.map((side) => side.id))
  const picks: Lobby['picks'] = {}
  for (const [side, pick] of Object.entries(lobby.picks)) {
    if (!pick || !sides.has(side)) continue
    picks[side] = scenarioChanged ? { forceIds: null, ready: false } : { ...pick, ready: false }
  }
  lobby = { picks }
  embedLobbyDesigns()
  clearFx()
  preview = null
  autosave()
  net?.onReplace(saved())
  emit()
}

/**
 * This console picks a side's fleet, or says it is ready. The host records
 * it and tells the guest; the guest records it for itself and tells the
 * host, whose record then comes back as the one that stands.
 */
export function lobbyPick(side: string, pick: { forceIds: string[] | null; ready: boolean }): void {
  if (lobby === null) return
  const full: LobbyPick = {
    forceIds: pick.forceIds === null ? null : [...pick.forceIds],
    ready: pick.ready,
    designs: pick.forceIds === null ? undefined : designsFor(pick.forceIds),
  }
  if (full.designs !== undefined && full.designs.length === 0) delete full.designs
  applyLobbyPick(side, full)
  if (matchRole === 'host') net?.onReplace(saved())
  else net?.onLobbyPick?.(side, full)
}

/** A pick arriving — from the other console, or made here. */
export function applyLobbyPick(side: string, pick: LobbyPick): void {
  if (lobby === null) return
  lobby = { picks: { ...lobby.picks, [side]: pick } }
  embedLobbyDesigns()
  autosave()
  emit()
}

/** Every side of the scenario has said it is ready. */
export function lobbyAllReady(): boolean {
  if (lobby === null) return false
  return game.sides.every((side) => lobby?.picks[side.id]?.ready === true)
}

/**
 * The host starts the battle: the picks become the setup's forces, the
 * designs they brought are embedded, and the record becomes a battle at
 * turn 1 — which the guest receives as a sync with no lobby on it.
 */
export function startMatch(): boolean {
  if (lobby === null || matchRole !== 'host') return false
  const forces: Record<string, string[]> = {}
  for (const [side, pick] of Object.entries(lobby.picks)) {
    if (pick?.forceIds) forces[side] = [...pick.forceIds]
  }
  const designs = lobbyDesigns()
  setup = {
    ...setup,
    rulesVersion: CURRENT_RULES_VERSION,
    forces: Object.keys(forces).length > 0 ? forces : undefined,
    customDesigns: designs.length > 0 ? designs : undefined,
  }
  lobby = null
  journal = []
  game = buildGame(setup)
  clearFx()
  preview = null
  autosave()
  net?.onReplace(saved())
  emit()
  return true
}

export function currentMatchSide(): string | null {
  return matchSide
}

/**
 * The sides this console commands, or null for every side on the table.
 *
 * Three ways to sit at this screen. Two people sharing it command everything
 * and look through whichever eyes they choose — null. One person in an online
 * match commands the side they joined as. One person against the computer
 * commands every side the computer does not fly, and the computer's fleet is
 * no more theirs to order about than a remote opponent's would be: its orders
 * are refused, and its view is not on offer.
 */
export function commandedSides(): string[] | null {
  if (matchSide !== null) return [matchSide]
  const ai = setup.aiSides ?? []
  if (ai.length === 0) return null
  return game.sides.map((side) => side.id).filter((id) => !ai.includes(id))
}

/** Whether this console may give a side orders. */
export function commands(side: string): boolean {
  const mine = commandedSides()
  return mine === null || mine.includes(side)
}

/**
 * Hooks the network layer installs to mirror what happens here to the peer.
 * Null in hot-seat, which is why every call site uses optional chaining.
 */
export interface NetHooks {
  onAction: (action: GameAction, sequenceAfter: number) => void
  onUndo: (lengthAfter: number) => void
  onReplace: (saved: SavedGame) => void
  /** A guest's fleet pick or readiness, for the host to record. */
  onLobbyPick?: (side: string, pick: LobbyPick) => void
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
 * Let the computer take its turn in the current phase.
 *
 * Called after every dispatch rather than on a timer, because the thing that
 * opens a phase is always an action. Each computer side is asked what it
 * wants to do and asked again while its last answer got something taken:
 * 18.1's deployment alternates within one phase, 2.6's fire phase hands out
 * one ship at a time, and a strike that kills its target leaves the next
 * group wanting a new one. The planners are written to have nothing more to
 * say once their work is done, which is what ends the loop — and a bound on
 * the rounds is what ends it if one of them has not been.
 */
function runAi(): void {
  const sides = setup.aiSides ?? []
  if (sides.length === 0) return
  // In an online match the computer is driven from one console only — the
  // creator's — or both ends would journal its orders twice.
  if (matchSide !== null && matchSide !== game.sides[0]?.id) return

  for (let round = 0; round < 60; round += 1) {
    let progressed = false
    for (const side of sides) {
      const actions = aiActions(game, side)
      if (actions.length === 0) continue
      const sequence = game.fire.sequence
      let taken = 0
      for (const action of actions) {
        const outcome = applyJournaled(action)
        net?.onAction(action, journal.length)
        if (outcome.refused === undefined) taken += 1
      }
      if (taken > 0) progressed = true
      // 2.6: in phase 11 the computer's turn holds everyone else's. If nothing
      // it tried was taken — a volley refused for a reason the plan could not
      // see — it holds fire with a ship instead, so play moves on rather than
      // waiting on a console that has already had its say.
      if (game.phase === 'ship-fire' && game.fire.side === side && game.fire.sequence === sequence && taken === 0) {
        for (const ship of game.ships) {
          if (ship.side !== side || ship.captured || !canShipFire(ship)) continue
          const held: GameAction = { type: 'pass-fire', shipId: ship.id }
          const outcome = applyJournaled(held)
          net?.onAction(held, journal.length)
          if (outcome.refused === undefined) {
            progressed = true
            break
          }
        }
      }
    }
    if (!progressed) break
  }
}

/** Apply an action, journal it, autosave, notify. The only way state changes. */
export function dispatch(action: GameAction): ActionOutcome {
  if (action.type !== 'signal-ready') {
    const side = actionSide(game, action)
    const ai = setup.aiSides ?? []
    // Actions with no side — advancing the shared sequence, choice scripts —
    // pass untouched. Online, sides the computer commands are driven from the
    // creator's console, which is the one exception to "not yours". Against the
    // computer at one screen there is no exception: the computer's own actions
    // never come through here (`runAi` journals them directly), so anything
    // for its fleet that does is a player reaching across the table.
    const denied: string | null =
      side === null
        ? null
        : matchSide !== null
          ? side !== matchSide && !ai.includes(side)
            ? 'That fleet is not yours to command'
            : null
          : ai.includes(side)
            ? 'The computer commands that fleet'
            : null
    if (denied !== null) {
      const outcome: ActionOutcome = { refused: denied }
      noteRefusal(outcome)
      emit()
      return outcome
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

/**
 * A refusal the table makes before any action is written: a click outside the
 * reach of what is in hand. Same notice, same place, so the player reads it
 * the same way as one the engine sent back.
 */
export function refuseAtTable(text: string): void {
  refusalSeq += 1
  refusal = { text, seq: refusalSeq }
  emit()
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
  autosave()
  emit()
  return lengthAfter === journal.length ? 'applied' : 'mismatch'
}

/** The whole battle, replacing whatever is here. The host's record wins. */
export function applyRemoteSave(next: SavedGame): void {
  setup = next.setup
  journal = next.actions
  game = replayPartial(next, next.actions.length)
  lobby = inMatch && next.lobby !== undefined ? next.lobby : null
  settleMatchSide()
  embedLobbyDesigns()
  clearFx()
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
  clearFx()
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

/**
 * A handle for a browser drive in development: a script at the console reads
 * the battle the way the panels do, and can act through the same door. Not
 * built into the app — `import.meta.env.DEV` is false in a production build —
 * and nothing in the app reads it.
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __fullThrust?: unknown }).__fullThrust = { currentGame, currentSetup, dispatch }
}
