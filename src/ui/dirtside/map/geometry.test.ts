import { describe, expect, it } from 'vitest'

import { bookExample } from '../../../dirtside/data/examples'
import { skirmishSetup } from '../../../dirtside/table/skirmish'
import { distance, pathCost } from '../../../dirtside/table/terrain'
import type { TerrainFeature } from '../../../dirtside/table/types'
import { centreOf, clearestSpot, deploymentBand, fitLabel, insetShape, nearbyFeatures, pointAlong, reachPolygon, silhouetteOf, splitByLegs, textWidth } from './geometry'
import { fitFrame, keepInSight } from './useTableView'

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

  it('keeps only the features a reach ring could actually touch, by their own bounding box', () => {
    const near: TerrainFeature = { id: 'n', terrain: 'rough', shape: { kind: 'circle', centre: { x: 5, y: 0 }, radius: 1 } }
    const far: TerrainFeature = { id: 'f', terrain: 'rough', shape: { kind: 'circle', centre: { x: 50, y: 0 }, radius: 1 } }
    // A polygon's own bounding box, not its centre, decides it — a big shape reaching toward the origin
    // counts even though most of it (and its mean-of-vertices centre) sits well past the range.
    const reaching: TerrainFeature = { id: 'r', terrain: 'rough', shape: { kind: 'polygon', points: [{ x: 9, y: -20 }, { x: 40, y: -20 }, { x: 40, y: 20 }, { x: 9, y: 20 }] } }
    const kept = nearbyFeatures({ x: 0, y: 0 }, 10, [near, far, reaching])
    expect(kept.map((f) => f.id).sort()).toEqual(['n', 'r'])
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

  it('finds a polygon its own centroid, not a path-style midpoint', () => {
    // A square: the mean of its own corners is exactly its middle.
    const square = { kind: 'polygon' as const, points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }] }
    expect(centreOf(square)).toEqual({ x: 2, y: 2 })
  })

  it('insets shapes until nothing is left', () => {
    expect(insetShape({ kind: 'circle', centre: { x: 0, y: 0 }, radius: 3 }, 1)).toMatchObject({ radius: 2 })
    expect(insetShape({ kind: 'circle', centre: { x: 0, y: 0 }, radius: 1 }, 1)).toBeNull()
    expect(insetShape({ kind: 'rect', x: 0, y: 0, width: 4, height: 2 }, 1)).toBeNull()
    // A polygon insets by scaling toward its own centroid: a 4"-radius-ish square shrunk by 1" stays centred and simple.
    const square = { kind: 'polygon' as const, points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }] }
    const inner = insetShape(square, 1)
    expect(inner?.kind).toBe('polygon')
    if (inner?.kind === 'polygon') {
      const c = centreOf(inner)
      expect(c.x).toBeCloseTo(4)
      expect(c.y).toBeCloseTo(4)
      for (const p of inner.points) expect(Math.max(Math.abs(p.x - 4), Math.abs(p.y - 4))).toBeLessThan(4)
    }
    // Shrunk past its own radius: nothing left.
    expect(insetShape(square, 10)).toBeNull()
  })

  it('estimates lettering width without a page to measure in', () => {
    expect(textWidth('N1★', 11)).toBeGreaterThan(15)
    expect(textWidth('LIGHT WOODS', 10.5, { display: true, spacing: 0.12 })).toBeGreaterThan(textWidth('LIGHT WOODS', 10.5))
  })

  it('fits a margin label to its room: whole, fewer words, cut short, bare, or not at all', () => {
    const rear = (n: string) => `${n} REAR AREA`
    const name = 'EPSILON ERIDANI I-B GARRISON'
    const full = textWidth(rear(name), 8.5)
    expect(fitLabel(name, rear, 'REAR AREA', full + 1, 8.5)).toBe(rear(name))
    expect(fitLabel(name, rear, 'REAR AREA', textWidth(rear('EPSILON ERIDANI'), 8.5) + 1, 8.5)).toBe(rear('EPSILON ERIDANI'))
    const cut = fitLabel(name, rear, 'REAR AREA', textWidth(rear('EPSILO'), 8.5) + 1, 8.5)
    expect(cut).toMatch(/^EPS.*… REAR AREA$/)
    expect(fitLabel(name, rear, 'REAR AREA', textWidth('REAR AREA', 8.5) + 1, 8.5)).toBe('REAR AREA')
    expect(fitLabel(name, rear, 'REAR AREA', 10, 8.5)).toBeNull()
  })

  it('puts a label where it covers nothing, or where it covers least', () => {
    const box = (x: number) => ({ x0: x, y0: 0, x1: x + 2, y1: 1 })
    const spots = [{ at: 0, box: box(0) }, { at: 5, box: box(5) }, { at: 10, box: box(10) }]
    expect(clearestSpot(spots, [box(0.5), box(4.5)])?.at).toBe(10)
    expect(clearestSpot(spots, [box(0.5), box(4.5), box(10.5), box(9.5)])?.at).toBe(0)
    expect(clearestSpot([], [box(0)])).toBeUndefined()
  })

  it('fits the whole table and its margins in the pane, centred', () => {
    const m = { left: 1, right: 1, top: 1, bottom: 1 }
    // A wide pane: the height decides the scale and the table is centred across.
    const wide = fitFrame(48, 48, { w: 1000, h: 500, left: 0, top: 0 }, m)
    expect(wide.ppi).toBeCloseTo(10)
    expect(wide.y).toBeCloseTo(-1)
    expect(wide.x + 1000 / wide.ppi / 2).toBeCloseTo(24)
    // The pane loses 15 px at the top: the frame follows the screen until the table's own edge reaches the pane's.
    const tall = fitFrame(48, 48, { w: 500, h: 500, left: 0, top: 0 }, m)
    const shrunk = { w: 500, h: 485, left: 0, top: 15 }
    const followed = { ...tall, y: tall.y + 15 / tall.ppi }
    expect(keepInSight(followed, shrunk, 48, 48, m).y).toBeCloseTo(0)
    // A few pixels only: the margins take it and nothing moves on screen.
    const nudged = { ...tall, y: tall.y + 4 / tall.ppi }
    expect(keepInSight(nudged, { w: 500, h: 496, left: 0, top: 4 }, 48, 48, m).y).toBeCloseTo(nudged.y)
    // Not yet measured: a scale to start from, the table at the corner.
    expect(fitFrame(48, 48, { w: 0, h: 0, left: 0, top: 0 }, m)).toEqual({ x: -1, y: -1, ppi: 20 })
  })
})
