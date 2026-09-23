/**
 * The play screen's reading of the table: what just happened, the marks it
 * leaves on the map, the log grouped for reading, and taking back a move
 * only when it drew nothing from the dice.
 */

import { describe, expect, it } from 'vitest'

import { applyAction, createGame } from '../../../dirtside/table/game'
import { skirmishSetup } from '../../../dirtside/table/skirmish'
import type { Action, GameState } from '../../../dirtside/table/types'
import { canTakeBackDirtside, currentDirtsideBattle, dirtsideDispatch, dirtsideTransitions, newDirtsideBattle, takeBackDirtside } from '../dirtsideStore'
import { unitCodes } from '../unitCodes'
import { describeAction, groupLog, logKind, marksOf, parseChits, parseDice, recapGroups } from './journal'
import { shortReason } from './words'

const step = (state: GameState, action: Action): GameState => {
  const next = applyAction(state, action)
  if ('ok' in next) throw new Error(next.reason)
  return next
}

/** A skirmish to turn 1's first activation, the south choosing. */
function toFirstPick(): GameState {
  let s = createGame(skirmishSetup({ seed: 4242, terrain: 'light' }))
  s = step(s, { kind: 'ready', side: 'north' })
  s = step(s, { kind: 'ready', side: 'south' })
  return step(s, { kind: 'choose-first', side: s.chooser!, first: s.chooser! })
}

describe('what just happened', () => {
  it('reads a move as a line and a trail from where the element stood', () => {
    let s = toFirstPick()
    const side = s.toAct!
    const unit = Object.values(s.units).find((u) => u.sideId === side)!
    s = step(s, { kind: 'activate', side, unitId: unit.id })
    const el = s.elements[unit.leaderElementId!]!
    const to = { x: el.position.x, y: el.position.y + (side === 'north' ? 4 : -4) }
    const action: Action = { kind: 'move', side, elementId: el.id, path: [to] }
    const after = step(s, action)
    const event = describeAction(s, action, after, unitCodes(s))
    expect(event.lines.some((l) => l.tone === 'move' && /moved 4\.0″/.test(l.text))).toBe(true)
    expect(event.title).toMatch(/^[NS]1 /)
    const marks = marksOf(s, action, after)
    expect(marks).toEqual([{ kind: 'move', side, path: [el.position, to] }])
  })

  it('groups goes from their activation and sums each up in a line', () => {
    let s = toFirstPick()
    const side = s.toAct!
    const unit = Object.values(s.units).find((u) => u.sideId === side)!
    const events = []
    for (const action of [{ kind: 'activate', side, unitId: unit.id }, { kind: 'end-activation', side }] as Action[]) {
      const after = step(s, action)
      events.push(describeAction(s, action, after, unitCodes(s)))
      s = after
    }
    const groups = recapGroups(events)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.headline).toMatch(/held its ground/)
  })

  it('parses the chits and the dice the log prints', () => {
    expect(parseChits('MBT 1 → X: Drew RED 1, T, YELLOW 2: 3 valid against armour 3 — knocked out.')).toEqual([
      { label: 'RED 1', colour: 'red' },
      { label: 'T', colour: 'special' },
      { label: 'YELLOW 2', colour: 'yellow' },
    ])
    expect(parseDice('A → B: Firer rolled 4; target rolled 1 — hit.')).toBe('rolled 4 against 1')
    expect(logKind('A → B: Drew RED 1: 1 valid against armour 3 — knocked out.')).toBe('damage')
    expect(logKind('Tank 1 moves 5.0" for 5.0 of 12 factors: 5.0" open (normal).')).toBe('move')
    expect(shortReason('An APSW reaches 12"; the target is at 18.2".')).toBe('18.2″ > 12″')
    expect(shortReason('No line of sight: hills in the way.')).toBe('no line of sight')
  })

  it('groups the log by turn and by activation, keeping every line', () => {
    let s = toFirstPick()
    const side = s.toAct!
    const unit = Object.values(s.units).find((u) => u.sideId === side)!
    s = step(s, { kind: 'activate', side, unitId: unit.id })
    s = step(s, { kind: 'end-activation', side })
    const turns = groupLog(s.log)
    expect(turns.map((t) => t.turn)).toEqual([0, 1])
    const block = turns[1]!.blocks.find((b) => b.unit === unit.name)!
    expect(block.side).toBe(side)
    expect(turns.flatMap((t) => t.blocks.flatMap((b) => b.entries)).length).toBe(s.log.length)
  })
})

describe('taking back a move', () => {
  it('takes back a deployment that drew nothing, by replaying the journal without it', () => {
    newDirtsideBattle(skirmishSetup({ seed: 7, terrain: 'light' }))
    const s = currentDirtsideBattle()!
    const el = Object.values(s.elements).find((e) => e.sideId === 'north')!
    expect(dirtsideDispatch({ kind: 'deploy', side: 'north', elementId: el.id, position: { x: el.position.x + 1, y: 3 }, facing: 180 })).toBeNull()
    expect(canTakeBackDirtside()).toBe(true)
    expect(takeBackDirtside()).toBe(true)
    const back = currentDirtsideBattle()!
    expect(back.journal).toHaveLength(0)
    expect(back.elements[el.id]!.position).toEqual(el.position)
    expect(dirtsideTransitions().list).toHaveLength(0)
  })

  it('refuses once the dice have been rolled or the other side is to act', () => {
    newDirtsideBattle(skirmishSetup({ seed: 7, terrain: 'light' }))
    expect(dirtsideDispatch({ kind: 'ready', side: 'north' })).toBeNull()
    expect(canTakeBackDirtside()).toBe(false)
    expect(dirtsideDispatch({ kind: 'ready', side: 'south' })).toBeNull()
    expect(canTakeBackDirtside()).toBe(false)
    expect(takeBackDirtside()).toBe(false)
  })
})
