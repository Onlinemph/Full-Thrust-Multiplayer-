import { beforeEach, describe, expect, it } from 'vitest'

import {
  applyLobbyPick,
  applyRemoteSave,
  currentGame,
  currentJournal,
  currentLobby,
  currentSave,
  currentSetup,
  enterMatch,
  leaveMatch,
  lobbyAllReady,
  lobbyPick,
  lobbySetup,
  newGame,
  setMatchSide,
  setNetHooks,
  startMatch,
} from './store'
import { receive, type NetMessage } from './link'
import { designById, SHIP_DESIGNS } from '../data/ships'
import type { ShipDesign } from '../engine/types'

/**
 * The lobby: a match before its battle.
 *
 * The host holds the rules, each console picks its own fleet, a home-built
 * hull travels with the pick, and the battle the host starts is built from
 * all of it at turn 1 — which the guest receives as an ordinary sync.
 */
const frigate = SHIP_DESIGNS.find((d) => d.id === 'esu-frigate')!
const homeBuild: ShipDesign = { ...structuredClone(frigate), id: 'home-build', name: 'Home Build' }

describe('a match lobby', () => {
  beforeEach(() => {
    setNetHooks(null)
    leaveMatch()
    setMatchSide(null)
    newGame({ scenarioId: 'border-skirmish', seed: 21, forces: { a: ['esu-frigate'] } })
  })

  it('opens with the host, carrying the fleets the host had picked', () => {
    enterMatch('host', true)
    const lobby = currentLobby()
    expect(lobby).not.toBeNull()
    expect(lobby?.picks.a?.forceIds).toEqual(['esu-frigate'])
    expect(lobby?.picks.a?.ready).toBe(false)
    expect(currentSetup().forces).toBeUndefined()
    expect(currentSave().lobby).toBeDefined()
    expect(currentJournal()).toHaveLength(0)
  })

  it('builds the battle from the picks when the host starts it, and takes the lobby off', () => {
    enterMatch('host', true)
    lobbyPick('a', { forceIds: ['esu-frigate', 'esu-frigate', 'esu-frigate'], ready: true })
    lobbyPick('b', { forceIds: null, ready: true })
    expect(lobbyAllReady()).toBe(true)
    expect(startMatch()).toBe(true)
    expect(currentLobby()).toBeNull()
    expect(currentSave().lobby).toBeUndefined()
    expect(currentGame().turn).toBe(1)
    expect(currentGame().phase).toBe('orders')
    expect(currentGame().ships.filter((s) => s.side === 'a')).toHaveLength(3)
    // Side b kept the scenario's own force.
    const scenarioB = newGame({ scenarioId: 'border-skirmish', seed: 21 })
    void scenarioB
    expect(currentGame().ships.filter((s) => s.side === 'b').length).toBeGreaterThan(0)
  })

  it('will not start for a guest, and will not start twice', () => {
    enterMatch('guest', false)
    applyRemoteSave({ version: 1, setup: currentSetup(), actions: [], lobby: { picks: {} } })
    expect(currentLobby()).not.toBeNull()
    expect(startMatch()).toBe(false)
    expect(currentLobby()).not.toBeNull()
    // The host's start arrives as a sync with no lobby on it.
    applyRemoteSave({ version: 1, setup: currentSetup(), actions: [] })
    expect(currentLobby()).toBeNull()
    expect(startMatch()).toBe(false)
  })

  it('carries a home-built hull with the pick and embeds it in the battle', () => {
    enterMatch('host', true)
    // As the host's link would, on a guest's lobby-pick.
    applyLobbyPick('b', { forceIds: ['home-build'], ready: true, designs: [homeBuild] })
    expect(designById('home-build')?.name).toBe('Home Build')
    lobbyPick('a', { forceIds: null, ready: true })
    expect(startMatch()).toBe(true)
    const ships = currentGame().ships.filter((s) => s.side === 'b')
    expect(ships).toHaveLength(1)
    expect(ships[0]?.design.id).toBe('home-build')
    expect(currentSave().setup.customDesigns?.some((d) => d.id === 'home-build')).toBe(true)
  })

  it('lets the host change the rules, withdrawing everyone’s readiness', () => {
    enterMatch('host', true)
    lobbyPick('a', { forceIds: null, ready: true })
    lobbySetup({ emergencyThrust: true })
    expect(currentSetup().emergencyThrust).toBe(true)
    expect(currentLobby()?.picks.a?.ready).toBe(false)
    // A new scenario is a new table: the picks go back to the scenario's own.
    lobbyPick('a', { forceIds: ['esu-frigate'], ready: true })
    lobbySetup({ scenarioId: 'line-of-battle' })
    expect(currentSetup().scenarioId).toBe('line-of-battle')
    expect(currentLobby()?.picks.a?.forceIds).toBeNull()
    expect(currentGame().scenario).toBe('line-of-battle')
  })

  it('ignores a guest trying to change the rules', () => {
    enterMatch('guest', false)
    applyRemoteSave({ version: 1, setup: currentSetup(), actions: [], lobby: { picks: {} } })
    const before = currentSetup().emergencyThrust
    lobbySetup({ emergencyThrust: !before })
    expect(currentSetup().emergencyThrust).toBe(before)
  })

  it('sends a guest’s pick to the host, and the host answers with the lobby', () => {
    // The guest.
    const wire: NetMessage[] = []
    enterMatch('guest', false)
    applyRemoteSave({ version: 1, setup: currentSetup(), actions: [], lobby: { picks: {} } })
    setNetHooks({
      onAction: () => undefined,
      onUndo: () => undefined,
      onReplace: () => undefined,
      onLobbyPick: (side, pick) => wire.push({ kind: 'lobby-pick', side, pick }),
    })
    lobbyPick('b', { forceIds: ['esu-frigate'], ready: true })
    expect(wire).toHaveLength(1)
    expect(currentLobby()?.picks.b?.ready).toBe(true)
    setNetHooks(null)
    // The host, receiving it.
    leaveMatch()
    enterMatch('host', true)
    const replies: NetMessage[] = []
    receive(wire[0]!, 'host', (m) => replies.push(m))
    expect(currentLobby()?.picks.b?.forceIds).toEqual(['esu-frigate'])
    expect(replies[0]?.kind).toBe('sync')
    if (replies[0]?.kind === 'sync') expect(replies[0].saved.lobby?.picks.b?.ready).toBe(true)
  })

  it('is over when the match is left', () => {
    enterMatch('host', true)
    leaveMatch()
    expect(currentLobby()).toBeNull()
  })
})
