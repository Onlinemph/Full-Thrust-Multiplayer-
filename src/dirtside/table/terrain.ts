/**
 * Dirtside II — the ground: which terrain a point is on, whether a line
 * between two elements is clear (p. 4, p. 20), and what a path costs a
 * mobility type in movement factors (pp. 25–26).
 *
 * Features are circles, rectangles and wide polylines because that is what
 * a scenario can be typed in as; the rules only ever ask "is this point in
 * it" and "does this line cross it".
 */

import { FACTORS_PER_INCH, type Going, type MobilityFamily, type TerrainType, goingOf } from '../data/mobility'
import type { Point, Shape, TerrainFeature } from './types'

export const MAX_SIGHT = 60
/** How far into a wood an element may stand and still count as on its edge (p. 20). */
export const WOOD_EDGE = 1
/** Terrain that blocks a line of sight when the line passes through it (p. 4, p. 20). */
export const BLOCKS_SIGHT: readonly TerrainType[] = ['light-woods', 'dense-woods', 'urban', 'hills', 'mountains']
export const WOODS: readonly TerrainType[] = ['light-woods', 'dense-woods']
export const HIGH_GROUND: readonly TerrainType[] = ['hills', 'mountains']

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Degrees clockwise from north, 0–360. */
export function bearing(from: Point, to: Point): number {
  const deg = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI
  return ((deg % 360) + 360) % 360
}

/** The smallest angle between two headings, 0–180. */
export function angleBetween(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360
  return d > 180 ? 360 - d : d
}

export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  if (length < 1e-9) return distance(point, a)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length))
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy })
}

export function insideShape(point: Point, shape: Shape): boolean {
  switch (shape.kind) {
    case 'circle':
      return distance(point, shape.centre) <= shape.radius
    case 'rect':
      return point.x >= shape.x && point.x <= shape.x + shape.width && point.y >= shape.y && point.y <= shape.y + shape.height
    case 'path':
      for (let i = 1; i < shape.points.length; i++) if (distanceToSegment(point, shape.points[i - 1]!, shape.points[i]!) <= shape.width / 2) return true
      return false
  }
}

/** Distance from a point inside a shape to its boundary (0 outside). */
export function depthInside(point: Point, shape: Shape): number {
  if (!insideShape(point, shape)) return 0
  switch (shape.kind) {
    case 'circle':
      return shape.radius - distance(point, shape.centre)
    case 'rect':
      return Math.min(point.x - shape.x, shape.x + shape.width - point.x, point.y - shape.y, shape.y + shape.height - point.y)
    case 'path': {
      let nearest = Number.POSITIVE_INFINITY
      for (let i = 1; i < shape.points.length; i++) nearest = Math.min(nearest, distanceToSegment(point, shape.points[i - 1]!, shape.points[i]!))
      return shape.width / 2 - nearest
    }
  }
}

/** The feature under a point: the last one listed wins, roads and rivers over areas. */
export function featureAt(point: Point, features: readonly TerrainFeature[]): TerrainFeature | null {
  let found: TerrainFeature | null = null
  for (const feature of features) if (insideShape(point, feature.shape)) found = feature
  return found
}

export function terrainAt(point: Point, features: readonly TerrainFeature[]): TerrainType {
  return featureAt(point, features)?.terrain ?? 'open'
}

/** The wood an element stands in, and whether it is on the edge or within (p. 20). */
export function woodAt(point: Point, features: readonly TerrainFeature[]): { feature: TerrainFeature; where: 'edge' | 'within' } | null {
  for (let i = features.length - 1; i >= 0; i--) {
    const feature = features[i]!
    if (!WOODS.includes(feature.terrain)) continue
    const depth = depthInside(point, feature.shape)
    if (depth <= 0) continue
    return { feature, where: depth <= WOOD_EDGE ? 'edge' : 'within' }
  }
  return null
}

export function onHighGround(point: Point, features: readonly TerrainFeature[]): boolean {
  return features.some((f) => HIGH_GROUND.includes(f.terrain) && insideShape(point, f.shape))
}

/** Sample points along a segment every `step` inches, both ends included. */
export function samplesAlong(a: Point, b: Point, step = 0.25): Point[] {
  const length = distance(a, b)
  const n = Math.max(1, Math.ceil(length / step))
  const out: Point[] = []
  for (let i = 0; i <= n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n })
  return out
}

export interface SightResult {
  clear: boolean
  /** What blocked it, if anything. */
  blockedBy: TerrainFeature | null
  reason: string | null
  range: number
}

/**
 * Line of sight (p. 4, p. 20): a straight line that touches no raised ground,
 * building or wood between the two, and no further than 60". An element on
 * the edge of a wood sees out of it and is seen; the first inch of the line
 * inside a feature either end stands in is that element's own cover. An
 * element on high ground sees over woods and buildings, not over other high
 * ground. An element within a wood neither sees nor is seen.
 */
export function lineOfSight(from: Point, to: Point, features: readonly TerrainFeature[]): SightResult {
  const range = distance(from, to)
  if (range > MAX_SIGHT) return { clear: false, blockedBy: null, reason: `beyond the 60" sensor limit`, range }
  const fromWood = woodAt(from, features)
  const toWood = woodAt(to, features)
  if (fromWood?.where === 'within') return { clear: false, blockedBy: fromWood.feature, reason: 'the firer is within a wood', range }
  if (toWood?.where === 'within') return { clear: false, blockedBy: toWood.feature, reason: 'the target is within a wood', range }
  const fromHigh = onHighGround(from, features)
  const toHigh = onHighGround(to, features)
  const samples = samplesAlong(from, to, 0.2)
  for (const feature of features) {
    if (!BLOCKS_SIGHT.includes(feature.terrain)) continue
    const high = HIGH_GROUND.includes(feature.terrain)
    const fromIn = insideShape(from, feature.shape)
    const toIn = insideShape(to, feature.shape)
    if (high && (fromIn || toIn)) continue
    if (!high && (fromHigh || toHigh)) continue
    for (const sample of samples) {
      if (!insideShape(sample, feature.shape)) continue
      // The ends stand in their own cover: an edge is the first inch in.
      if (fromIn && distance(sample, from) <= WOOD_EDGE) continue
      if (toIn && distance(sample, to) <= WOOD_EDGE) continue
      return { clear: false, blockedBy: feature, reason: `${feature.label ?? feature.terrain} in the way`, range }
    }
  }
  return { clear: true, blockedBy: null, reason: null, range }
}

export interface PathCost {
  factors: number
  length: number
  /** Where the path became impassable, if it did. */
  blockedAt: Point | null
  blockedBy: TerrainType | null
  /** The goings met, in order, for the log. */
  legs: { terrain: TerrainType; going: Going; length: number }[]
  /** The path enters a wood the mobility type cannot pass, beyond its edge. */
  intoWood: boolean
}

/**
 * The cost of a path in movement factors (p. 25): each inch costs the
 * factors of the going the mobility type meets there — half on easy going
 * in travel mode, one on normal, two on poor, three on difficult. An
 * impassable stretch stops the move where it starts, except that a wood the
 * type cannot enter may be entered to its edge (p. 25), at the cost of poor
 * going.
 */
export function pathCost(path: readonly Point[], family: MobilityFamily, features: readonly TerrainFeature[], opts: { amphibious?: boolean; travel?: boolean } = {}): PathCost {
  const out: PathCost = { factors: 0, length: 0, blockedAt: null, blockedBy: null, legs: [], intoWood: false }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!
    const b = path[i]!
    const samples = samplesAlong(a, b, 0.25)
    for (let s = 1; s < samples.length; s++) {
      const from = samples[s - 1]!
      const to = samples[s]!
      const step = distance(from, to)
      // The going of each quarter-inch is the ground it arrives on.
      const feature = featureAt(to, features)
      const terrain = feature?.terrain ?? 'open'
      let going = goingOf(family, terrain, opts.amphibious)
      if (going === 'easy' && !opts.travel) going = 'normal'
      if (going === 'impassable') {
        const wood = feature && WOODS.includes(feature.terrain) ? depthInside(to, feature.shape) : Number.POSITIVE_INFINITY
        if (wood <= WOOD_EDGE) {
          going = 'poor'
          out.intoWood = true
        } else {
          out.blockedAt = from
          out.blockedBy = terrain
          return out
        }
      }
      const factors = step * FACTORS_PER_INCH[going]
      out.factors += factors
      out.length += step
      const last = out.legs[out.legs.length - 1]
      if (last && last.terrain === terrain && last.going === going) last.length += step
      else out.legs.push({ terrain, going, length: step })
    }
  }
  out.factors = Math.round(out.factors * 1000) / 1000
  out.length = Math.round(out.length * 1000) / 1000
  return out
}

/** Whether a point is on the table. */
export function onTable(point: Point, table: { width: number; depth: number }): boolean {
  return point.x >= 0 && point.x <= table.width && point.y >= 0 && point.y <= table.depth
}
