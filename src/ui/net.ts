import { attachLink, hangUp, receive, setNetState, setTeardown, type Link, type NetMessage, type NetRole } from './link'

export { hangUp, useNet } from './link'
export type { NetPhase, NetRole, NetState, NetTransport } from './link'

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
 * The protocol — ordering, the host's authority, the corrective sync — lives
 * in `link.ts` and is shared with the Supabase transport; this file is the
 * wire and nothing else.
 */

let pc: RTCPeerConnection | null = null
let channel: RTCDataChannel | null = null

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

/** Drop the connection and the channel, whatever state they were in. */
function closeAll(): void {
  channel?.close()
  channel = null
  pc?.close()
  pc = null
}

function attach(ch: RTCDataChannel, role: NetRole): void {
  channel = ch
  const link: Link = { send, close: closeAll }
  ch.onopen = () => attachLink(link, role, 'rtc', { peers: 2 })
  ch.onclose = () => hangUp('The link closed.')
  ch.onerror = () => hangUp('The link failed.')
  ch.onmessage = (event) => {
    let message: NetMessage
    try {
      message = JSON.parse(String(event.data)) as NetMessage
    } catch {
      return
    }
    receive(message, role, send)
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
    setTeardown(closeAll)
    attach(pc.createDataChannel('ftpc'), 'host')
    await pc.setLocalDescription(await pc.createOffer())
    await gathered(pc)
    const description = pc.localDescription
    if (!description) throw new Error('no local description')
    setNetState({
      phase: 'inviting',
      role: 'host',
      transport: 'rtc',
      code: encode(description),
      error: null,
    })
  } catch {
    hangUp('Could not create an invite — this browser may not support WebRTC.')
  }
}

/** Host: take the guest's reply code and complete the link. */
export async function acceptReply(code: string): Promise<void> {
  const desc = decode(code)
  if (!pc || !desc || desc.type !== 'answer') {
    setNetState({ error: 'That is not a reply code.' })
    return
  }
  try {
    await pc.setRemoteDescription(desc)
  } catch {
    setNetState({ error: 'That reply does not match this invite.' })
  }
}

/** Guest: take an invite code and produce the reply to hand back. */
export async function joinInvite(code: string): Promise<void> {
  const desc = decode(code)
  if (!desc || desc.type !== 'offer') {
    setNetState({ error: 'That is not an invite code.' })
    return
  }
  hangUp(null)
  try {
    pc = newConnection()
    setTeardown(closeAll)
    pc.ondatachannel = (event) => attach(event.channel, 'guest')
    await pc.setRemoteDescription(desc)
    await pc.setLocalDescription(await pc.createAnswer())
    await gathered(pc)
    const description = pc.localDescription
    if (!description) throw new Error('no local description')
    setNetState({
      phase: 'replying',
      role: 'guest',
      transport: 'rtc',
      code: encode(description),
      error: null,
    })
  } catch {
    hangUp('Could not answer that invite.')
  }
}
