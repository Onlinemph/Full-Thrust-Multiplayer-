import { useSyncExternalStore } from 'react'

import type { GameAction } from '../engine/actions'
import type { SavedGame } from '../data/savedGame'
import {
  applyRemoteAction,
  applyRemoteSave,
  applyRemoteUndo,
  currentSave,
  journalLength,
  setNetHooks,
} from './store'

/**
 * Remote play: the protocol, apart from the wire.
 *
 * Two consoles keep one battle in step by exchanging actions, and the rules
 * for doing that do not depend on how the bytes travel. This module is those
 * rules — the messages, the host's authority over ordering, the corrective
 * sync — and a `Link` is whatever carries them: a WebRTC data channel
 * (`net.ts`), a Supabase Realtime channel (`supabaseLink.ts`), or a pair of
 * functions in a test.
 *
 * **Ordering.** Full Thrust is turn-based and its phases are strictly ordered,
 * so collisions are rare — but two actions can still cross on the wire. Every
 * action carries the sender's journal length after applying it; a receiver
 * whose journal disagrees has detected the crossing. The HOST is the ordering
 * authority: it appends the guest's action in arrival order and ships a
 * corrective sync, which is just a battle file. A guest that detects a mismatch
 * asks for one. Either way both ends converge on the host's record.
 *
 * **Hidden information** is the same honour system the printed game runs on.
 * Each end holds the whole state and renders only its own side's view — which
 * is what two players at a table do with each other's SSDs when the sensor
 * rules are in play (2.6). A referee-grade server could come later; it is not
 * what the tabletop game does either.
 */

export type NetMessage =
  | { kind: 'sync'; saved: SavedGame }
  | { kind: 'action'; seq: number; action: GameAction }
  | { kind: 'undo'; lengthAfter: number }
  | { kind: 'sync-request' }

export type NetRole = 'host' | 'guest'

/** How the two consoles are joined. */
export type NetTransport = 'rtc' | 'supabase'

export type NetPhase =
  | 'idle'
  | 'inviting' // host: offer made, waiting for the reply code
  | 'replying' // guest: answer made, waiting for the channel
  | 'connecting' // the channel is being opened
  | 'connected'
  | 'closed'
  | 'failed'

export interface NetState {
  phase: NetPhase
  role: NetRole | null
  transport: NetTransport | null
  /** The code to hand to the other player, when one is ready. */
  code: string | null
  error: string | null
  /** Consoles on the channel, this one included, where the wire can count. */
  peers: number
}

/** What carries the messages. */
export interface Link {
  send(message: NetMessage): void
  close(): void
}

const IDLE: NetState = { phase: 'idle', role: null, transport: null, code: null, error: null, peers: 0 }

let state: NetState = IDLE
let version = 0
const listeners = new Set<() => void>()

export function setNetState(next: Partial<NetState>): void {
  state = { ...state, ...next }
  version += 1
  for (const listener of listeners) listener()
}

export function netState(): NetState {
  return state
}

export function useNet(): NetState {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version,
    () => version,
  )
  return state
}

// ---------------------------------------------------------------------------
// The protocol
// ---------------------------------------------------------------------------

/**
 * Handle one message from the other console.
 *
 * `reply` is how this end answers — a sync, or a request for one — and is
 * passed in rather than read from the active link so the protocol can be run
 * against nothing but a function in a test.
 */
export function receive(message: NetMessage, role: NetRole, reply: (message: NetMessage) => void): void {
  switch (message.kind) {
    case 'sync':
      applyRemoteSave(message.saved)
      return
    case 'action':
      if (role === 'host') {
        // Authority: append in arrival order, and if the guest predicted a
        // different order, ship them the record that now stands.
        applyRemoteAction(message.action, message.seq, true)
        if (message.seq !== journalLength()) reply({ kind: 'sync', saved: currentSave() })
      } else if (applyRemoteAction(message.action, message.seq, false) === 'mismatch') {
        reply({ kind: 'sync-request' })
      }
      return
    case 'undo':
      if (role === 'host') {
        applyRemoteUndo(message.lengthAfter, true)
        if (message.lengthAfter !== journalLength()) reply({ kind: 'sync', saved: currentSave() })
      } else if (applyRemoteUndo(message.lengthAfter, false) === 'mismatch') {
        reply({ kind: 'sync-request' })
      }
      return
    case 'sync-request':
      reply({ kind: 'sync', saved: currentSave() })
      return
  }
}

// ---------------------------------------------------------------------------
// The active link
// ---------------------------------------------------------------------------

let active: Link | null = null
/** Whatever the transport needs torn down on hang-up before there is a link. */
let teardown: (() => void) | null = null

/**
 * Take a link into service: the store's hooks send through it, and the host
 * hands the guest the battle to start from.
 */
export function attachLink(
  link: Link,
  role: NetRole,
  transport: NetTransport,
  opts: { code?: string | null; peers?: number } = {},
): void {
  active = link
  setNetState({
    phase: 'connected',
    role,
    transport,
    code: opts.code ?? null,
    error: null,
    peers: opts.peers ?? state.peers,
  })
  // The host's battle is the one both ends start from.
  if (role === 'host') link.send({ kind: 'sync', saved: currentSave() })
  setNetHooks({
    onAction: (action, seq) => link.send({ kind: 'action', seq, action }),
    onUndo: (lengthAfter) => link.send({ kind: 'undo', lengthAfter }),
    onReplace: (saved) => link.send({ kind: 'sync', saved }),
  })
}

/** The transport's own cleanup, run on hang-up whether or not a link was made. */
export function setTeardown(fn: (() => void) | null): void {
  teardown = fn
}

/** Close the link. `reason` null is a deliberate hang-up rather than a fault. */
export function hangUp(reason: string | null): void {
  setNetHooks(null)
  const link = active
  active = null
  link?.close()
  const cleanup = teardown
  teardown = null
  cleanup?.()
  setNetState({
    ...IDLE,
    phase: reason === null ? 'idle' : 'failed',
    error: reason,
  })
}
