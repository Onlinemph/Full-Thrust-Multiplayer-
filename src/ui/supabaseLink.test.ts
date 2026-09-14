import { beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { SavedGame } from '../data/savedGame'
import { hangUp, netState } from './link'
import { currentGame, currentJournal, currentSave, dispatch, newGame, setMatchSide } from './store'
import {
  createMatch,
  joinMatch,
  newMatchCode,
  normaliseCode,
  useSupabaseClientForTests,
} from './supabaseLink'

/**
 * The Supabase wire against a fake project: the three functions the schema
 * exposes and a channel that records what was sent and lets a test push a
 * message in from the other console.
 */
interface FakeChannel {
  name: string
  sent: unknown[]
  handlers: Map<string, (payload: { payload: unknown }) => void>
  tracked: unknown[]
  status: string
  deliver(payload: unknown): void
}

function fakeProject() {
  const rows = new Map<string, SavedGame>()
  const rpc: Array<[string, Record<string, unknown>]> = []
  const channels: FakeChannel[] = []
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      rpc.push([name, args])
      switch (name) {
        case 'create_match':
          rows.set(String(args.p_code), args.p_saved as SavedGame)
          return Promise.resolve({ data: null, error: null })
        case 'fetch_match':
          return Promise.resolve({ data: rows.get(String(args.p_code)) ?? null, error: null })
        case 'save_match':
          rows.set(String(args.p_code), args.p_saved as SavedGame)
          return Promise.resolve({ data: null, error: null })
        default:
          return Promise.resolve({ data: null, error: { message: `no such function ${name}` } })
      }
    },
    channel(name: string) {
      const ch: FakeChannel & Record<string, unknown> = {
        name,
        sent: [],
        handlers: new Map(),
        tracked: [],
        status: 'closed',
        deliver(payload: unknown) {
          ch.handlers.get('broadcast')?.({ payload })
        },
        on(kind: string, _filter: unknown, handler: (payload: { payload: unknown }) => void) {
          ch.handlers.set(kind, handler)
          return ch
        },
        subscribe(callback: (status: string) => void) {
          ch.status = 'SUBSCRIBED'
          callback('SUBSCRIBED')
          return ch
        },
        send(message: unknown) {
          ch.sent.push(message)
          return Promise.resolve('ok')
        },
        track(state: unknown) {
          ch.tracked.push(state)
          return Promise.resolve('ok')
        },
        presenceState() {
          return { me: [], them: [] }
        },
        unsubscribe() {
          ch.status = 'closed'
          return Promise.resolve('ok')
        },
      }
      channels.push(ch)
      return ch
    },
  }
  return { client: client as unknown as SupabaseClient, rows, rpc, channels }
}

const SETUP = { scenarioId: 'border-skirmish', seed: 5 }

describe('remote play through Supabase', () => {
  beforeEach(() => {
    hangUp(null)
    setMatchSide(null)
    newGame(SETUP)
  })

  it('mints codes from an alphabet with nothing confusable in it', () => {
    for (let i = 0; i < 200; i += 1) expect(newMatchCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    expect(normaliseCode(' abc-234 ')).toBe('ABC234')
    expect(normaliseCode('ab0c1234')).toBe('ABC234')
  })

  it('creates a match: the battle goes up under a code and the channel opens as host', async () => {
    const project = fakeProject()
    useSupabaseClientForTests(project.client)
    await createMatch()
    const [name, args] = project.rpc[0]
    expect(name).toBe('create_match')
    expect(String(args.p_code)).toMatch(/^[A-Z2-9]{6}$/)
    expect((args.p_saved as SavedGame).setup.seed).toBe(SETUP.seed)
    expect(netState().phase).toBe('connected')
    expect(netState().role).toBe('host')
    expect(netState().transport).toBe('supabase')
    expect(netState().code).toBe(String(args.p_code))
    expect(project.channels[0].name).toBe(`match:${String(args.p_code)}`)
    // The host opens with a sync, and each action goes down the channel.
    const first = project.channels[0].sent[0] as { payload: { kind: string } }
    expect(first.payload.kind).toBe('sync')
    dispatch({ type: 'plot-accel', shipId: currentGame().ships[0].id, accel: 1 })
    const last = project.channels[0].sent.at(-1) as { payload: { kind: string } }
    expect(last.payload.kind).toBe('action')
    useSupabaseClientForTests(null)
    hangUp(null)
  })

  it('joins a match: the row is the battle, and the host is asked for anything newer', async () => {
    const project = fakeProject()
    useSupabaseClientForTests(project.client)
    // Somebody else's battle is on the server under a code.
    const theirs = { ...currentSave(), setup: { ...currentSave().setup, seed: 777 } }
    project.rows.set('QWERTY', theirs)
    newGame(SETUP)
    await joinMatch('qwerty')
    expect(netState().phase).toBe('connected')
    expect(netState().role).toBe('guest')
    expect(currentGame().seed).toBe(777)
    const sent = project.channels[0].sent as Array<{ payload: { kind: string } }>
    expect(sent.some((m) => m.payload.kind === 'sync-request')).toBe(true)
    // An action from the host lands in the journal.
    const ship = currentGame().ships.find((s) => s.side === 'a')!
    project.channels[0].deliver({
      kind: 'action',
      seq: currentJournal().length + 1,
      action: { type: 'plot-accel', shipId: ship.id, accel: 1 },
    })
    expect(ship.order?.accel).toBe(1)
    useSupabaseClientForTests(null)
    hangUp(null)
  })

  it('refuses a code nobody holds, and a code of the wrong length', async () => {
    const project = fakeProject()
    useSupabaseClientForTests(project.client)
    await joinMatch('ZZZZZZ')
    expect(netState().phase).toBe('failed')
    expect(netState().error).toMatch(/ZZZZZZ/)
    await joinMatch('AB')
    expect(netState().error).toMatch(/6 letters/)
    useSupabaseClientForTests(null)
    hangUp(null)
  })
})
