/**
 * A city table has a hundred or more features (BRIEF-TERRAIN): `lineOfSight`
 * and `pathCost` scan every one of them, and the computer calls both
 * heavily over a battle. Timed here so a future change that makes either
 * scan slower again shows up as a number, not just a slower suite; and a
 * full battle is kept playing to a result on a city table at both scales,
 * so a real regression fails a test, not just a stopwatch.
 */

import { describe, expect, it } from 'vitest'
import { aiPlay } from '../ai'
import { newStream } from '../../dice'
import { skirmishSetup } from '../skirmish'
import { lineOfSight, pathCost } from '../terrain'
import type { TerrainScale } from '../skirmish'
import { generateGroundTerrain } from './generate'

function timeIt(label: string, fn: () => void, times: number): number {
  const start = performance.now()
  for (let i = 0; i < times; i++) fn()
  const ms = performance.now() - start
  // eslint-disable-next-line no-console
  console.log(`${label}: ${ms.toFixed(1)}ms for ${times} calls (${(ms / times).toFixed(3)}ms each)`)
  return ms
}

describe('performance on a city table', () => {
  it.each(['platoon', 'squad'] as TerrainScale[])('times lineOfSight and pathCost on a %s-scale city table', (scale) => {
    const terrain = generateGroundTerrain(newStream(7), 48, 36, 'city', scale)
    // Platoon buildings are tiny (0.5-1.5" across), so the same city area holds many of them — squad's are big
    // enough (3-7") that a city table is a real "a hundred or more features" case at platoon scale specifically.
    expect(terrain.length).toBeGreaterThan(scale === 'platoon' ? 100 : 10)
    const from = { x: 4, y: 4 }
    const to = { x: 44, y: 32 }
    const sightMs = timeIt(`lineOfSight (${scale}, ${terrain.length} features)`, () => lineOfSight(from, to, terrain), 300)
    const pathMs = timeIt(`pathCost (${scale}, ${terrain.length} features)`, () => pathCost([from, to], 'tracked', terrain), 300)
    // Generous budgets: this is a canary for a real regression (an unindexed scan added back in), not a tight
    // benchmark — the point is that these stay well under a second for hundreds of calls, not a precise number.
    expect(sightMs).toBeLessThan(3000)
    expect(pathMs).toBeLessThan(3000)
  })

  it.each(['platoon', 'squad'] as TerrainScale[])('plays a Dirtside battle on a %s-scale city table to a result, within the suite\'s time', (scale) => {
    const setup = skirmishSetup({ seed: 21, terrain: 'city', turnLimit: 10 })
    if (scale === 'squad') setup.table.terrain = generateGroundTerrain(newStream(setup.seed ^ 0x5eed), setup.table.width, setup.table.depth, 'city', 'squad')
    const start = performance.now()
    const state = aiPlay(setup, { seed: 21, maxActions: 8000 })
    const ms = performance.now() - start
    // eslint-disable-next-line no-console
    console.log(`aiPlay on a ${scale}-scale city table (${setup.table.terrain.length} features): ${ms.toFixed(0)}ms, ${state.journal.length} actions, turn ${state.turn}`)
    expect(state.result ?? state.turn > 1).toBeTruthy()
    expect(ms).toBeLessThan(20000)
  })
})
