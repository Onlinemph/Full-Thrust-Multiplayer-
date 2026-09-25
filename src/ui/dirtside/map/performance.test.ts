/**
 * The move-plot "how far can I get" ring (BRIEF-TERRAIN): a city table has a
 * hundred or more features, most of them a unit's own hundred-plus buildings
 * away — except that at platoon scale a city block is small enough that a
 * unit standing in the middle of one still has most of the table's own
 * features within a normal move's reach, which is the worst case timed here.
 * `reachPolygon` (`geometry.ts`) is UI-only: it drives the interactive ring,
 * recomputed on every selection change or drag update, so a real regression
 * here is a real dropped frame, not just a slower test suite.
 */

import { describe, expect, it } from 'vitest'
import { newStream } from '../../../dirtside/dice'
import { generateGroundTerrain } from '../../../dirtside/table/ground/generate'
import type { TerrainScale } from '../../../dirtside/table/skirmish'
import { reachPolygon } from './geometry'

function timeIt(label: string, fn: () => void, times: number): number {
  const start = performance.now()
  for (let i = 0; i < times; i++) fn()
  const ms = (performance.now() - start) / times
  // eslint-disable-next-line no-console
  console.log(`${label}: ${ms.toFixed(2)}ms/call`)
  return ms
}

describe('reachPolygon on a city table', () => {
  it.each(['platoon', 'squad'] as TerrainScale[])('stays close to the ~30ms budget at %s scale, from the middle of town', (scale) => {
    const terrain = generateGroundTerrain(newStream(7), 48, 36, 'city', scale)
    expect(terrain.length).toBeGreaterThan(scale === 'platoon' ? 100 : 10)
    // Dead centre of the table: a city spans most of the main battle area, so this is the worst case for
    // "how many of the table's own features sit within reach of this one unit", not a favourable one.
    const from = { x: 24, y: 18 }
    const budget = 15
    const ms = timeIt(`reachPolygon (${scale}, ${terrain.length} features)`, () => reachPolygon(from, budget, 'tracked', terrain, {}, 48), 10)
    // A generous canary, not a tight benchmark (this file's own convention, see ground/performance.test.ts):
    // the point is catching a real regression (the feature-list filter or the coarser cost check removed),
    // not pinning an exact number that varies with the machine running it.
    expect(ms).toBeLessThan(60)
  })
})
