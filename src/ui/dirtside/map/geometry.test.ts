import { describe, expect, it } from 'vitest'

import { bookExample } from '../../../dirtside/data/examples'
import { skirmishSetup } from '../../../dirtside/table/skirmish'
import { distance, pathCost } from '../../../dirtside/table/terrain'
import type { TerrainFeature } from '../../../dirtside/table/types'
import { blocksIn, deploymentBand, insetShape, pointAlong, reachPolygon, silhouetteOf, splitByLegs, textWidth } from './geometry'

describe('the map geometry', () => {
  it('cuts a path into runs of the same going, end to end', () => {
    const wood: TerrainFeature = { id: 'w', terrain: 'light-woods', shape: { kind: 'rect', x: 4, y: -2, width: 4, height: 4 } }
    const path = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 12, y: 0 },
    ]
    const cost = pathCost(path, 'tracked', [wood])
    const runs = splitByLegs(path, cost.legs)
    expect(runs.map((r) => r.going)).toEqual(['normal', 'difficult', 'normal'])
    expect(runs[0]!.points[0]).toEqual({ x: 0, y: 0 })
    expect(runs[2]!.points[runs[2]!.points.length - 1]!.x).toBeCloseTo(12)
    // The middle run keeps the waypoint it passes through.
    expect(runs[1]!.points.some((p) => p.x === 6)).toBe(true)
  })

  it('finds a point along a polyline', () => {
    expect(pointAlong([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }], 5)).toEqual({ x: 3, y: 2 })
  })

  it('reaches as far as the factors go, and no further than the going allows', () => {
    const from = { x: 20, y: 20 }
    const open = reachPolygon(from, 6, 'tracked', [], {}, 8)
    for (const p of open) expect(distance(from, p)).toBeCloseTo(6, 1)
    // Travel mode on open ground: a GEV's easy going is half a factor an inch.
    const gev = reachPolygon(from, 6, 'gev', [], { travel: true }, 8)
    for (const p of gev) expect(distance(from, p)).toBeCloseTo(12, 1)
    // A dense wood a tracked vehicle cannot pass stops the ray at its edge, give or take the first inch.
    const wood: TerrainFeature = { id: 'd', terrain: 'dense-woods', shape: { kind: 'rect', x: 22, y: 10, width: 10, height: 20 } }
    const east = reachPolygon(from, 10, 'tracked', [wood], {}, 4)[1]!
    expect(east.x).toBeGreaterThan(21.5)
    expect(east.x).toBeLessThan(23.1)
    const cost = pathCost([from, east], 'tracked', [wood])
    expect(cost.blockedAt).toBeNull()
    expect(cost.factors).toBeLessThanOrEqual(10 + 1e-6)
  })

  it('draws each side’s deployment zone from the rule', () => {
    const setup = skirmishSetup({ seed: 1 })
    expect(deploymentBand(setup, 'north')).toEqual({ y0: 0, y1: 6 })
    expect(deploymentBand(setup, 'south')).toEqual({ y0: 30, y1: 36 })
    setup.battle = 'attack-defence'
    setup.attacker = 'north'
    expect(deploymentBand(setup, 'south')).toEqual({ y0: 12, y1: 36 })
  })

  it('knows a tank from a carrier from a hover tank', () => {
    expect(silhouetteOf(bookExample('book-mbt')!)).toMatchObject({ gear: 'tracks', body: 'turret' })
    expect(silhouetteOf(bookExample('book-micv')!)).toMatchObject({ gear: 'skirt', body: 'ifv' })
    expect(silhouetteOf(bookExample('book-deimos')!)).toMatchObject({ gear: 'skirt', body: 'turret' })
    expect(silhouetteOf(bookExample('book-wheeled-apc')!).gear).toBe('wheels')
  })

  it('lays out buildings inside a town and keeps them put', () => {
    const shape = { kind: 'rect' as const, x: 10, y: 10, width: 8, height: 6 }
    const a = blocksIn(shape, 'village-3')
    expect(a.length).toBeGreaterThan(4)
    expect(blocksIn(shape, 'village-3')).toEqual(a)
    for (const b of a) {
      expect(b.x).toBeGreaterThanOrEqual(10)
      expect(b.y + b.h).toBeLessThanOrEqual(16)
    }
  })

  it('insets shapes until nothing is left', () => {
    expect(insetShape({ kind: 'circle', centre: { x: 0, y: 0 }, radius: 3 }, 1)).toMatchObject({ radius: 2 })
    expect(insetShape({ kind: 'circle', centre: { x: 0, y: 0 }, radius: 1 }, 1)).toBeNull()
    expect(insetShape({ kind: 'rect', x: 0, y: 0, width: 4, height: 2 }, 1)).toBeNull()
  })

  it('estimates lettering width without a page to measure in', () => {
    expect(textWidth('N1★', 11)).toBeGreaterThan(15)
    expect(textWidth('LIGHT WOODS', 10.5, { display: true, spacing: 0.12 })).toBeGreaterThan(textWidth('LIGHT WOODS', 10.5))
  })
})
