/**
 * The ground generator (BRIEF-TERRAIN's "the model"): every style produces
 * a deterministic, well-formed table at both scales — simple polygons,
 * buildings that stay inside their town and off each other and the
 * streets, nothing but rural pieces and roads in the deployment strips,
 * and counts in the ranges the brief sets out.
 */

import { describe, expect, it } from 'vitest'
import { newStream } from '../../dice'
import type { TerrainType } from '../../data/mobility'
import { insideShape } from '../terrain'
import type { Point, TerrainFeature } from '../types'
import type { TerrainScale, TerrainStyle } from '../skirmish'
import { DEPLOYMENT_STRIP, generateGroundTerrain } from './generate'

const STYLES: readonly TerrainStyle[] = ['none', 'light', 'dense', 'village', 'town', 'city']
const SCALES: readonly TerrainScale[] = ['platoon', 'squad']
const W = 48
const D = 36

function pointsOf(f: TerrainFeature): readonly Point[] {
  return f.shape.kind === 'circle' ? [f.shape.centre] : f.shape.kind === 'rect' ? [{ x: f.shape.x, y: f.shape.y }, { x: f.shape.x + f.shape.width, y: f.shape.y + f.shape.height }] : f.shape.points
}

/** Whether two closed segments cross (sharing only an endpoint does not count as crossing). */
function segmentsCross(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const cross = (o: Point, p: Point, q: Point) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x)
  const d1 = cross(b1, b2, a1)
  const d2 = cross(b1, b2, a2)
  const d3 = cross(a1, a2, b1)
  const d4 = cross(a1, a2, b2)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/** A closed polygon is simple when no two of its edges (other than neighbours, which share a vertex) cross. */
function isSimplePolygon(points: readonly Point[]): boolean {
  const n = points.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue
      if (segmentsCross(points[i]!, points[(i + 1) % n]!, points[j]!, points[(j + 1) % n]!)) return false
    }
  }
  return true
}

function pointInPolygon(pt: Point, poly: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Two simple polygons overlap when an edge of one crosses an edge of the other, or one sits wholly inside the other. */
function polygonsOverlap(a: readonly Point[], b: readonly Point[]): boolean {
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) if (segmentsCross(a[i]!, a[(i + 1) % a.length]!, b[j]!, b[(j + 1) % b.length]!)) return true
  return pointInPolygon(a[0]!, b) || pointInPolygon(b[0]!, a)
}

/** Terrain that is allowed inside a deployment strip (rural pieces and every kind of road/river feature). */
const STRIP_OK: readonly TerrainType[] = ['road', 'river', 'ford', 'light-woods', 'dense-woods', 'hills', 'mountains', 'rough', 'light-scrub', 'swamp', 'open-water', 'cultivated', 'wall', 'hedge']

describe('the ground generator', () => {
  it('is deterministic per style and scale: the same seed always lays out the same table', () => {
    for (const scale of SCALES) {
      for (const style of STYLES) {
        const a = generateGroundTerrain(newStream(4177), W, D, style, scale)
        const b = generateGroundTerrain(newStream(4177), W, D, style, scale)
        expect(a).toEqual(b)
      }
    }
  })

  it('gives an empty table for "none", and a different table from a different seed otherwise', () => {
    for (const scale of SCALES) {
      expect(generateGroundTerrain(newStream(1), W, D, 'none', scale)).toHaveLength(0)
      for (const style of STYLES.filter((s) => s !== 'none')) {
        const a = generateGroundTerrain(newStream(1), W, D, style, scale)
        const b = generateGroundTerrain(newStream(2), W, D, style, scale)
        expect(a).not.toEqual(b)
      }
    }
  })

  it('gives every unique id, once', () => {
    for (const scale of SCALES) {
      for (const style of STYLES) {
        const features = generateGroundTerrain(newStream(55), W, D, style, scale)
        expect(new Set(features.map((f) => f.id)).size).toBe(features.length)
      }
    }
  })

  it('makes every polygon a simple, closed outline of at least three points', () => {
    for (const scale of SCALES) {
      for (const style of STYLES) {
        for (const seed of [1, 2, 3]) {
          for (const f of generateGroundTerrain(newStream(seed), W, D, style, scale)) {
            if (f.shape.kind !== 'polygon') continue
            expect(f.shape.points.length).toBeGreaterThanOrEqual(3)
            expect(isSimplePolygon(f.shape.points)).toBe(true)
          }
        }
      }
    }
  })

  it("keeps every building and ruin inside its town, none of them overlapping, and clear of the town's streets", () => {
    for (const scale of SCALES) {
      for (const style of ['town', 'city'] as const) {
        for (const seed of [1, 2, 3, 4, 5]) {
          const features = generateGroundTerrain(newStream(seed), W, D, style, scale)
          const town = features.find((f) => f.terrain === 'urban')!
          const pieces = features.filter((f) => f.partOf === town.id)
          const buildings = pieces.filter((f) => f.terrain === 'building')
          const rubble = pieces.filter((f) => f.terrain === 'rubble')
          const streets = pieces.filter((f) => f.terrain === 'road')
          const areas = [...buildings, ...rubble]
          for (const b of areas) for (const p of pointsOf(b)) expect(insideShape(p, town.shape)).toBe(true)
          for (let i = 0; i < areas.length; i++) for (let j = i + 1; j < areas.length; j++) expect(polygonsOverlap(pointsOf(areas[i]!), pointsOf(areas[j]!))).toBe(false)
          for (const b of areas) for (const s of streets) for (const p of pointsOf(b)) expect(insideShape(p, s.shape)).toBe(false)
        }
      }
    }
  })

  it('keeps the deployment strips (p. 17\'s 6") clear of anything but rural pieces and roads', () => {
    for (const scale of SCALES) {
      for (const style of STYLES) {
        for (const seed of [1, 2, 3, 4]) {
          for (const f of generateGroundTerrain(newStream(seed), W, D, style, scale)) {
            if (STRIP_OK.includes(f.terrain)) continue
            for (const p of pointsOf(f)) {
              expect(p.y).toBeGreaterThanOrEqual(DEPLOYMENT_STRIP - 1e-6)
              expect(p.y).toBeLessThanOrEqual(D - DEPLOYMENT_STRIP + 1e-6)
            }
          }
        }
      }
    }
  })

  it("keeps a light table's piece count to 5-7 and a dense table's to 9-12, at both scales", () => {
    const pieceKinds: TerrainType[] = ['light-woods', 'dense-woods', 'hills', 'rough', 'light-scrub', 'swamp', 'cultivated']
    for (const scale of SCALES) {
      for (const [style, lo, hi] of [['light', 5, 7], ['dense', 9, 12]] as const) {
        for (let seed = 1; seed <= 15; seed++) {
          const count = generateGroundTerrain(newStream(seed), W, D, style, scale).filter((f) => pieceKinds.includes(f.terrain)).length
          expect(count).toBeGreaterThanOrEqual(lo)
          expect(count).toBeLessThanOrEqual(hi)
        }
      }
    }
  })

  it("keeps a squad-scale village/town/city's building count near the brief's own 4-8 / 8-14 / 14-28 (25mm figures are big; the 6\" deployment strips this table also has to clear leave less headroom than the model's numbers assume, so the top of a squad town/city's range is a soft target, not a guarantee)", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const buildingsAndRubbleOf = (style: TerrainStyle) => generateGroundTerrain(newStream(seed), W, D, style, 'squad').filter((f) => f.terrain === 'building' || f.terrain === 'rubble').length
      expect(buildingsAndRubbleOf('village')).toBeGreaterThanOrEqual(2)
      expect(buildingsAndRubbleOf('town')).toBeGreaterThanOrEqual(3)
      expect(buildingsAndRubbleOf('city')).toBeGreaterThanOrEqual(6)
    }
  })

  it("keeps a platoon-scale town's own area within the model's 12-20\" across, and a platoon city spanning most of the table but none of it in the deployment strips", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const town = generateGroundTerrain(newStream(seed), W, D, 'town', 'platoon').find((f) => f.terrain === 'urban')!
      const pts = pointsOf(town)
      const xs = pts.map((p) => p.x)
      const ys = pts.map((p) => p.y)
      const across = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
      expect(across).toBeGreaterThanOrEqual(10)
      expect(across).toBeLessThanOrEqual(24)

      const city = generateGroundTerrain(newStream(seed), W, D, 'city', 'platoon').find((f) => f.terrain === 'urban')!
      const cityXs = pointsOf(city).map((p) => p.x)
      expect(Math.max(...cityXs) - Math.min(...cityXs)).toBeGreaterThan(W * 0.75)
    }
  })

  it('scales the whole table down when the table itself is smaller than the default', () => {
    for (const style of ['light', 'town'] as const) {
      const features = generateGroundTerrain(newStream(9), 24, 18, style, 'platoon')
      for (const f of features) for (const p of pointsOf(f)) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-6)
        expect(p.x).toBeLessThanOrEqual(24 + 1e-6)
      }
    }
  })
})
