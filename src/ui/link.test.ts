import { beforeEach, describe, expect, it } from 'vitest'

import type { NetMessage } from './link'
import { attachLink, hangUp, netState, receive } from './link'
import { currentGame, currentJournal, dispatch, newGame, setMatchSide } from './store'

/**
 * The protocol, run against nothing but a function.
 *
 * A wire is a wire; what has to be right is what each end does with a message
 * — and the one interesting case is two actions crossing, where the host's
 * record must win and the guest must ask for it.
 */
const SETUP = { scenarioId: 'border-skirmish', seed: 99 }

function shipOf(side: string): string {
  return currentGame().ships.find((ship) => ship.side === side)!.id
}

describe('the remote-play protocol', () => {
  beforeEach(() => {
    hangUp(null)
    setMatchSide(null)
    newGame(SETUP)
  })

  it('takes a guest action in arrival order and says nothing when the sequence agrees', () => {
    const sent: NetMessage[] = []
    const action = { type: 'plot-accel' as const, shipId: shipOf('b'), accel: 1 }
    receive({ kind: 'action', seq: currentJournal().length + 1, action }, 'host', (m) => sent.push(m))
    expect(currentJournal().at(-1)).toEqual(action)
    expect(sent).toEqual([])
  })

  it('as the host, ships a corrective sync when the guest predicted a different order', () => {
    const sent: NetMessage[] = []
    // The host has written something the guest has not seen yet.
    dispatch({ type: 'plot-accel', shipId: shipOf('a'), accel: 1 })
    const stale = currentJournal().length // the guest thinks its action lands here
    const action = { type: 'plot-accel' as const, shipId: shipOf('b'), accel: 1 }
    receive({ kind: 'action', seq: stale, action }, 'host', (m) => sent.push(m))
    // Appended anyway — the host is the authority — and the record shipped.
    expect(currentJournal().at(-1)).toEqual(action)
    expect(sent).toHaveLength(1)
    expect(sent[0].kind).toBe('sync')
  })

  it('as the guest, asks for a sync when an action arrives out of step', () => {
    const sent: NetMessage[] = []
    const action = { type: 'plot-accel' as const, shipId: shipOf('a'), accel: 1 }
    receive({ kind: 'action', seq: currentJournal().length + 5, action }, 'guest', (m) => sent.push(m))
    expect(sent).toEqual([{ kind: 'sync-request' }])
  })

  it('answers a sync request with the battle as it stands', () => {
    const sent: NetMessage[] = []
    dispatch({ type: 'plot-accel', shipId: shipOf('a'), accel: 2 })
    receive({ kind: 'sync-request' }, 'host', (m) => sent.push(m))
    expect(sent[0].kind).toBe('sync')
    if (sent[0].kind !== 'sync') return
    expect(sent[0].saved.actions).toHaveLength(currentJournal().length)
  })

  it('sends every dispatched action down an attached link, and the host opens with a sync', () => {
    const sent: NetMessage[] = []
    attachLink({ send: (m) => sent.push(m), close: () => undefined }, 'host', 'supabase', {
      code: 'ABC234',
    })
    expect(netState().phase).toBe('connected')
    expect(netState().code).toBe('ABC234')
    expect(sent[0].kind).toBe('sync')
    dispatch({ type: 'plot-accel', shipId: shipOf('a'), accel: 1 })
    expect(sent.at(-1)?.kind).toBe('action')
    hangUp(null)
    expect(netState().phase).toBe('idle')
    const before = sent.length
    dispatch({ type: 'plot-accel', shipId: shipOf('a'), accel: 0 })
    expect(sent).toHaveLength(before)
  })
})
