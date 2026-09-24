/**
 * The automatic baseline layout (p. 17): a force that fits along its
 * baseline stands exactly where it always has, and a larger one wraps into
 * rows inside its deployment zone instead of running off the table.
 */

import { describe, expect, it } from 'vitest'
import { bookExample } from '../data/examples'
import { draw, newStream } from '../dice'
import { autoLayout, createGame, inDeploymentZone } from './game'
import { defaultForces, skirmishSetup, type UnitSpec } from './skirmish'
import { distance } from './terrain'
import type { GameSetup, Point } from './types'

/** The layout as it was before rows: one line, 1.5″ apart, 2″ between units, 3″ in. */
function oneLine(setup: GameSetup): Record<string, Point> {
  const out: Record<string, Point> = {}
  for (const side of setup.sides) {
    let x = 2
    for (const unit of side.units) {
      for (const el of unit.elements) {
        out[el.id] = side.id === 'north' ? { x, y: 3 } : { x, y: setup.table.depth - 3 }
        x += 1.5
      }
      x += 2
    }
  }
  return out
}

/** Every element's base (0.9″ across) is on the table. */
const basesOnTable = (setup: GameSetup, at: Record<string, Point>) => Object.values(at).every((p) => p.x - 0.45 >= 0 && p.x + 0.45 <= setup.table.width)

const positions = (setup: GameSetup): Record<string, Point> => {
  const state = createGame(setup)
  return Object.fromEntries(Object.values(state.elements).map((e) => [e.id, e.position]))
}

const mbt = bookExample('book-mbt')!
const tanks = (name: string, count: number): UnitSpec => ({ name, quality: 'regular', leadership: 2, vehicle: mbt, count })
const rifles = (name: string, teams: number): UnitSpec => ({ name, quality: 'regular', leadership: 2, infantry: { troops: 'line', teams: Array.from({ length: teams }, (_, i) => (i === teams - 1 ? 'apsw' : 'rifle')) } })

describe('the automatic baseline layout', () => {
  it('leaves the book skirmish where it always stood', () => {
    const setup = skirmishSetup({ seed: 7 })
    expect(positions(setup)).toEqual(oneLine(setup))
  })

  it('leaves the first-battle preset where it always stood', () => {
    const force = [{ ...tanks('Tank Platoon', 3), commandUnit: true }, rifles('Rifle Platoon', 4)]
    const setup = skirmishSetup({ seed: 3, width: 36, depth: 24, north: force, south: force })
    expect(positions(setup)).toEqual(oneLine(setup))
  })

  it('leaves every layout whose bases were all on the table unchanged', () => {
    const stream = newStream(20260924)
    /** 1 to n. */
    const pick = (n: number) => Math.floor(draw(stream) * n) + 1
    let fitted = 0
    for (let trial = 0; trial < 400; trial++) {
      const width = 24 + 2 * pick(36)
      const depth = 24 + 2 * pick(24)
      const force = (): UnitSpec[] => Array.from({ length: pick(9) }, (_, i) => (pick(3) === 1 ? rifles(`Rifles ${i}`, 1 + pick(6)) : tanks(`Tanks ${i}`, pick(5))))
      const setup = skirmishSetup({ seed: trial, width, depth, north: force(), south: force() })
      const before = oneLine(setup)
      if (!basesOnTable(setup, before)) continue
      fitted++
      expect(positions(setup)).toEqual(before)
    }
    // The sample must hold plenty of layouts that fit, or the test proves nothing.
    expect(fitted).toBeGreaterThan(100)
  })

  it('keeps an explicitly placed element where the setup put it', () => {
    const setup = skirmishSetup({ seed: 1 })
    const el = setup.sides[0]!.units[0]!.elements[0]!
    el.position = { x: 20, y: 5 }
    expect(createGame(setup).elements[el.id]!.position).toEqual({ x: 20, y: 5 })
  })

  it('wraps a ten-unit force into rows inside its deployment zone', () => {
    const north = [...defaultForces().north, ...Array.from({ length: 6 }, (_, i) => tanks(`Unit ${i + 5}`, 3))]
    const setup = skirmishSetup({ seed: 11, north })
    const state = createGame(setup)
    const els = Object.values(state.elements)
    expect(basesOnTable(setup, Object.fromEntries(els.map((e) => [e.id, e.position])))).toBe(true)
    for (const e of els) expect(inDeploymentZone(setup, e.sideId, e.position)).toBe(true)
    // Seven units in a row 1.5″ in, the other three 4.5″ in, with room for the tags between.
    const first = (unit: string) => state.elements[state.units[unit]!.elementIds[0]!]!.position
    expect(first('north-1')).toEqual({ x: 2, y: 1.5 })
    expect(first('north-7')).toEqual({ x: 42.5, y: 1.5 })
    expect(first('north-8')).toEqual({ x: 2, y: 4.5 })
    // The south, which fits, is untouched.
    for (const e of els.filter((e) => e.sideId === 'south')) expect(e.position).toEqual(oneLine(setup)[e.id])
    // No two elements share a spot.
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) expect(distance(els[i]!.position, els[j]!.position)).toBeGreaterThanOrEqual(1.5 - 1e-9)
  })

  it('never splits a unit across rows when it fits in one', () => {
    const north = Array.from({ length: 12 }, (_, i) => tanks(`Unit ${i + 1}`, 4))
    const setup = skirmishSetup({ seed: 5, width: 36, north })
    const at = autoLayout(setup, setup.sides[0]!)
    for (const unit of setup.sides[0]!.units) expect(new Set(unit.elements.map((e) => at[e.id]!.y)).size).toBe(1)
    expect(basesOnTable(setup, at)).toBe(true)
  })

  it('runs a force too big for its zone off the table, for the setup to refuse', () => {
    const north = Array.from({ length: 40 }, (_, i) => tanks(`Unit ${i + 1}`, 4))
    const setup = skirmishSetup({ seed: 9, width: 24, north })
    const state = createGame(setup)
    const outside = Object.values(state.elements).filter((e) => e.sideId === 'north' && !inDeploymentZone(setup, 'north', e.position))
    expect(outside.length).toBeGreaterThan(0)
    for (const e of Object.values(state.elements)) if (e.sideId === 'north') expect(e.position.y).toBeLessThanOrEqual(6)
  })
})
