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
 * Remote play with no server.
 *
 * Two browsers open a WebRTC data channel to each other; the invitation and the
 * reply travel as copy-paste codes — the SDP offer and answer — so a static
 * host serves the whole thing and nobody needs an account. Once linked, every
 * action a player dispatches is sent to the peer and both journals grow in
 * step: the same determinism that powers save and undo is what keeps two
 * machines showing the same battle.
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

type NetMessage =
  | { kind: 'sync'; saved: SavedGame }
  | { kind: 'action'; seq: number; action: GameAction }
  | { kind: 'undo'; lengthAfter: number }
  | { kind: 'sync-request' }

export type NetRole = 'host' | 'guest'

export type NetPhase =
  | 'idle'
  | 'inviting' // host: offer made, waiting for the reply code
  | 'replying' // guest: answer made, waiting for the channel
  | 'connected'
  | 'closed'
  | 'failed'

export interface NetState {
  phase: NetPhase
  role: NetRole | null
  /** The code to hand to the other player, when one is ready. */
  code: string | null
  error: string | null
}

let state: NetState = { phase: 'idle', role: null, code: null, error: null }
let pc: RTCPeerConnection | null = null
let channel: RTCDataChannel | null = null

let version = 0
const listeners = new Set<() => void>()

function set(next: Partial<NetState>): void {
  state = { ...state, ...next }
  version += 1
  for (const listener of listeners) listener()
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
// Signalling codes
// ---------------------------------------------------------------------------

/** SDP is plain text; base64 makes it safe to paste through a chat app. */
function encode(desc: RTCSessionDescription): string {
  return btoa(JSON.stringify({ type: desc.type, sdp: desc.sdp }))
}

function decode(code: string): RTCSessionDescriptionInit | null {
  try {
    const parsed = JSON.parse(atob(code.trim())) as RTCSessionDescriptionInit
    return parsed.type && parsed.sdp ? parsed : null
  } catch {
    return null
  }
}

/**
 * Wait for ICE gathering so the code carries its candidates inline — there is
 * no channel to trickle them through yet. A short timeout settles for whatever
 * has gathered when the STUN server is slow or blocked; on the same network the
 * host candidates alone are enough.
 */
function gathered(conn: RTCPeerConnection): Promise<void> {
  if (conn.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      conn.removeEventListener('icegatheringstatechange', check)
      clearTimeout(timer)
      resolve()
    }
    const check = () => {
      if (conn.iceGatheringState === 'complete') done()
    }
    const timer = setTimeout(done, 3000)
    conn.addEventListener('icegatheringstatechange', check)
  })
}

function newConnection(): RTCPeerConnection {
  // A public STUN server lets two home connections find each other. Without
  // reachability — or across the nastier NATs — same-network play still works.
  return new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
}

// ---------------------------------------------------------------------------
// The link
// ---------------------------------------------------------------------------

function send(message: NetMessage): void {
  if (channel?.readyState === 'open') channel.send(JSON.stringify(message))
}

function attach(ch: RTCDataChannel, role: NetRole): void {
  channel = ch
  ch.onopen = () => {
    set({ phase: 'connected', role, code: null, error: null })
    // The host's battle is the one both ends start from.
    if (role === 'host') send({ kind: 'sync', saved: currentSave() })
    setNetHooks({
      onAction: (action, seq) => send({ kind: 'action', seq, action }),
      onUndo: (lengthAfter) => send({ kind: 'undo', lengthAfter }),
      onReplace: (saved) => send({ kind: 'sync', saved }),
    })
  }
  ch.onclose = () => hangUp('The link closed.')
  ch.onerror = () => hangUp('The link failed.')
  ch.onmessage = (event) => {
    let message: NetMessage
    try {
      message = JSON.parse(String(event.data)) as NetMessage
    } catch {
      return
    }
    receive(message, role)
  }
}

function receive(message: NetMessage, role: NetRole): void {
  switch (message.kind) {
    case 'sync':
      applyRemoteSave(message.saved)
      return
    case 'action':
      if (role === 'host') {
        // Authority: append in arrival order, and if the guest predicted a
        // different order, ship them the record that now stands.
        applyRemoteAction(message.action, message.seq, true)
        if (message.seq !== journalLength()) send({ kind: 'sync', saved: currentSave() })
      } else if (applyRemoteAction(message.action, message.seq, false) === 'mismatch') {
        send({ kind: 'sync-request' })
      }
      return
    case 'undo':
      if (role === 'host') {
        applyRemoteUndo(message.lengthAfter, true)
        if (message.lengthAfter !== journalLength()) send({ kind: 'sync', saved: currentSave() })
      } else if (applyRemoteUndo(message.lengthAfter, false) === 'mismatch') {
        send({ kind: 'sync-request' })
      }
      return
    case 'sync-request':
      send({ kind: 'sync', saved: currentSave() })
      return
  }
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/** Host: produce the invite code to hand to the other player. */
export async function hostInvite(): Promise<void> {
  hangUp(null)
  try {
    pc = newConnection()
    attach(pc.createDataChannel('ftpc'), 'host')
    await pc.setLocalDescription(await pc.createOffer())
    await gathered(pc)
    const description = pc.localDescription
    if (!description) throw new Error('no local description')
    set({ phase: 'inviting', role: 'host', code: encode(description), error: null })
  } catch {
    hangUp('Could not create an invite — this browser may not support WebRTC.')
  }
}

/** Host: take the guest's reply code and complete the link. */
export async function acceptReply(code: string): Promise<void> {
  const desc = decode(code)
  if (!pc || !desc || desc.type !== 'answer') {
    set({ error: 'That is not a reply code.' })
    return
  }
  try {
    await pc.setRemoteDescription(desc)
  } catch {
    set({ error: 'That reply does not match this invite.' })
  }
}

/** Guest: take an invite code and produce the reply to hand back. */
export async function joinInvite(code: string): Promise<void> {
  const desc = decode(code)
  if (!desc || desc.type !== 'offer') {
    set({ error: 'That is not an invite code.' })
    return
  }
  hangUp(null)
  try {
    pc = newConnection()
    pc.ondatachannel = (event) => attach(event.channel, 'guest')
    await pc.setRemoteDescription(desc)
    await pc.setLocalDescription(await pc.createAnswer())
    await gathered(pc)
    const description = pc.localDescription
    if (!description) throw new Error('no local description')
    set({ phase: 'replying', role: 'guest', code: encode(description), error: null })
  } catch {
    hangUp('Could not answer that invite.')
  }
}

/** Close the link. `reason` null is a deliberate hang-up rather than a fault. */
export function hangUp(reason: string | null): void {
  setNetHooks(null)
  channel?.close()
  channel = null
  pc?.close()
  pc = null
  set({
    phase: reason === null ? 'idle' : 'failed',
    role: null,
    code: null,
    error: reason,
  })
}
