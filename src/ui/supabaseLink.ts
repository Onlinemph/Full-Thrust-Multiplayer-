import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'

import type { SavedGame } from '../data/savedGame'
import { applyRemoteSave, currentSave, setNetHooks } from './store'
import {
  attachLink,
  hangUp,
  netState,
  receive,
  setNetState,
  setTeardown,
  type Link,
  type NetMessage,
  type NetRole,
} from './link'

/**
 * Remote play through Supabase: a six-letter code instead of two pasted pages
 * of SDP, and a battle that survives a closed tab.
 *
 * The wire is a Realtime channel named after the match code — broadcast for
 * the messages, presence for who is on it — and the protocol on top of it is
 * `link.ts`, unchanged from the WebRTC wire. What Supabase adds beyond a
 * simpler handshake is a place to keep the battle: the host writes the saved
 * game to a `matches` row as it goes, so a guest who joins late, or either
 * player who comes back after a crash, starts from the record rather than
 * from nothing.
 *
 * Nothing on the server knows the rules. The row is the same JSON a battle
 * file holds — the setup and the list of actions — and the host's console
 * remains the ordering authority exactly as it is over WebRTC. The anon key
 * ships in the bundle, which is what it is for: the schema (`supabase/
 * schema.sql`) exposes three functions keyed on the code and no table access,
 * so the code is the only secret and holding it is what lets you play.
 */

const CHANNEL_EVENT = 'ftpc'
/** Letters and digits nobody confuses on a phone call: no O/0, I/1. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
/** How long after the last action the row is written: one write per burst. */
const PERSIST_DELAY_MS = 600

export function supabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)
}

let client: SupabaseClient | null = null
let injected: SupabaseClient | null = null

/** The client, made once. Tests hand one in; the app builds one from the env. */
function supabase(): SupabaseClient {
  if (injected) return injected
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase is not configured')
  client = createClient(url, key)
  return client
}

export function useSupabaseClientForTests(fake: SupabaseClient | null): void {
  injected = fake
}

export function newMatchCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length]
  }
  return code
}

/**
 * What a player typed, as a code: upper case, spaces and dashes dropped. The
 * alphabet has no O, 0, I, 1 or L, so none of those can be right; they are
 * dropped too rather than guessed at, and a code that comes out short is
 * refused with its length.
 */
export function normaliseCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/[OIL01]/g, '')
    .slice(0, CODE_LENGTH)
}

function looksLikeSave(value: unknown): value is SavedGame {
  return (
    typeof value === 'object' &&
    value !== null &&
    'setup' in value &&
    'actions' in value &&
    Array.isArray((value as { actions: unknown }).actions)
  )
}

// ---------------------------------------------------------------------------
// The channel
// ---------------------------------------------------------------------------

let channel: RealtimeChannel | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null
/** Set while we are closing on purpose, so the CLOSED status is not a fault. */
let closing = false

async function persist(code: string): Promise<void> {
  const { error } = await supabase().rpc('save_match', { p_code: code, p_saved: currentSave() })
  if (error) setNetState({ error: `Could not save the match: ${error.message}` })
}

function schedulePersist(code: string): void {
  if (persistTimer !== null) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void persist(code)
  }, PERSIST_DELAY_MS)
}

function closeChannel(): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  const open = channel
  channel = null
  if (open) {
    closing = true
    void open.unsubscribe().finally(() => {
      closing = false
    })
  }
}

/**
 * Open the match's channel and take it into service.
 *
 * Resolves once the channel is subscribed and the link attached; rejects if
 * the channel cannot be joined.
 */
function open(code: string, role: NetRole): Promise<void> {
  closeChannel()
  setNetState({ phase: 'connecting', role, transport: 'supabase', code, error: null })
  const ch = supabase().channel(`match:${code}`, {
    config: { broadcast: { self: false }, presence: { key: `${role}-${newMatchCode()}` } },
  })
  channel = ch
  setTeardown(closeChannel)

  const send = (message: NetMessage): void => {
    void ch.send({ type: 'broadcast', event: CHANNEL_EVENT, payload: message })
  }
  const link: Link = { send, close: closeChannel }

  ch.on('broadcast', { event: CHANNEL_EVENT }, ({ payload }: { payload: unknown }) => {
    if (typeof payload !== 'object' || payload === null || !('kind' in payload)) return
    receive(payload as NetMessage, role, send)
  })
  ch.on('presence', { event: 'sync' }, () => {
    setNetState({ peers: Object.keys(ch.presenceState()).length })
  })

  return new Promise<void>((resolve, reject) => {
    let settled = false
    ch.subscribe((status: string, err?: Error) => {
      if (status === 'SUBSCRIBED') {
        void ch.track({ role, joined: new Date().toISOString() })
        attachLink(link, role, 'supabase', { code })
        // The host keeps the row current so a late guest, or either player
        // after a crash, has the battle to come back to.
        if (role === 'host') {
          setNetHooks({
            onAction: (action, seq) => {
              send({ kind: 'action', seq, action })
              schedulePersist(code)
            },
            onUndo: (lengthAfter) => {
              send({ kind: 'undo', lengthAfter })
              schedulePersist(code)
            },
            onReplace: (saved) => {
              send({ kind: 'sync', saved })
              schedulePersist(code)
            },
          })
        }
        if (!settled) {
          settled = true
          resolve()
        }
        return
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        const reason = `The Supabase link failed${err ? `: ${err.message}` : ''}.`
        if (!settled) {
          settled = true
          reject(new Error(reason))
        } else {
          hangUp(reason)
        }
        return
      }
      if (status === 'CLOSED' && !closing && settled && netState().transport === 'supabase') {
        hangUp('The link closed.')
      }
    })
  })
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/** Host: put the battle on the table under a fresh code and wait on it. */
export async function createMatch(): Promise<void> {
  if (!supabaseConfigured() && injected === null) {
    setNetState({ error: 'Supabase is not configured for this build.' })
    return
  }
  hangUp(null)
  const code = newMatchCode()
  const { error } = await supabase().rpc('create_match', { p_code: code, p_saved: currentSave() })
  if (error) {
    hangUp(`Could not create the match: ${error.message}`)
    return
  }
  try {
    await open(code, 'host')
  } catch (failure) {
    hangUp(failure instanceof Error ? failure.message : 'Could not open the match.')
  }
}

/**
 * Join a match by its code — as the guest, or as the host coming back to a
 * match it created. The row is loaded first, so the battle is on the table
 * before the channel opens; if the host is on, a sync-request then brings in
 * whatever it has that the row does not yet.
 */
export async function joinMatch(input: string, role: NetRole = 'guest'): Promise<void> {
  if (!supabaseConfigured() && injected === null) {
    setNetState({ error: 'Supabase is not configured for this build.' })
    return
  }
  const code = normaliseCode(input)
  if (code.length !== CODE_LENGTH) {
    setNetState({ error: `A match code is ${CODE_LENGTH} letters and digits.` })
    return
  }
  hangUp(null)
  const { data, error } = await supabase().rpc('fetch_match', { p_code: code })
  if (error) {
    hangUp(`Could not look the match up: ${error.message}`)
    return
  }
  if (!looksLikeSave(data)) {
    hangUp(`No match under the code ${code}.`)
    return
  }
  applyRemoteSave(data)
  try {
    await open(code, role)
  } catch (failure) {
    hangUp(failure instanceof Error ? failure.message : 'Could not open the match.')
    return
  }
  if (role === 'guest') {
    void channel?.send({ type: 'broadcast', event: CHANNEL_EVENT, payload: { kind: 'sync-request' } })
  }
}
