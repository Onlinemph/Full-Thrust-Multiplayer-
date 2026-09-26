/**
 * DIRTSIDE'S OWN FILE — the move-plot arithmetic `overlays.ts` needs
 * (the reach ring, the plotted path split by going), copied from
 * `ui/dirtside/map/geometry.ts`'s own `reachPolygon`/`splitByLegs` rather
 * than imported, so `ground3d/` never depends on Dirtside's flat-map UI
 * (the same reasoning `models.ts` gives for copying `silhouetteOf`). Every
 * rule these lean on — `pathCost`, `goingOf`, `featureAt`, `insideShape`,
 * `depthInside` — is the engine's own, imported unchanged.
 */
import { FACTORS_PER_INCH, type Going, type MobilityFamily, goingOf } from '../../../dirtside/data/mobility'
import { WOOD_EDGE, WOODS, depthInside, distance, featureAt } from '../../../dirtside/table/terrain'
import type { Point, TerrainFeature } from '../../../dirtside/table/types'

function distanceToBox(p: Point, box: { x0: number; y0: number; x1: number; y1: number }): number {
  const dx = Math.max(box.x0 - p.x, 0, p.x - box.x1)
  const dy = Math.max(box.y0 - p.y, 0, p.y - box.y1)
  return Math.hypot(dx, dy)
}

function boundsOf(shape: TerrainFeature['shape']): { x0: number; y0: number; x1: number; y1: number } {
  if (shape.kind === 'circle') return { x0: shape.centre.x - shape.radius, y0: shape.centre.y - shape.radius, x1: shape.centre.x + shape.radius, y1: shape.centre.y + shape.radius }
  if (shape.kind === 'rect') return { x0: shape.x, y0: shape.y, x1: shape.x + shape.width, y1: shape.y + shape.height }
  const pad = shape.kind === 'path' ? shape.width / 2 : 0
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of shape.points) {
    x0 = Math.min(x0, p.x - pad)
    y0 = Math.min(y0, p.y - pad)
    x1 = Math.max(x1, p.x + pad)
    y1 = Math.max(y1, p.y + pad)
  }
  return { x0, y0, x1, y1 }
}

function nearbyFeatures(from: Point, range: number, features: readonly TerrainFeature[]): TerrainFeature[] {
  return features.filter((f) => distanceToBox(from, boundsOf(f.shape)) <= range)
}

function reachCost(from: Point, to: Point, family: MobilityFamily, features: readonly TerrainFeature[], budget: number, opts: { amphibious?: boolean; travel?: boolean }): { blocked: boolean; factors: number } {
  const step = 0.5
  const len = distance(from, to)
  const n = Math.max(1, Math.ceil(len / step))
  const segLen = len / n
  let factors = 0
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
    const feature = featureAt(point, features)
    const terrain = feature?.terrain ?? 'open'
    let going = goingOf(family, terrain, opts.amphibious)
    if (going === 'easy' && !opts.travel) going = 'normal'
    if (going === 'impassable') {
      const wood = feature && WOODS.includes(feature.terrain) ? depthInside(point, feature.shape) : Number.POSITIVE_INFINITY
      if (wood <= WOOD_EDGE) going = 'poor'
      else return { blocked: true, factors }
    }
    factors += segLen * FACTORS_PER_INCH[going]
    if (factors > budget + 1e-6) return { blocked: false, factors }
  }
  return { blocked: false, factors }
}

/** How far a vehicle could get from `from` for `budget` factors, in every direction — the reach ring's own polygon. */
export function reachPolygon(from: Point, budget: number, family: MobilityFamily, features: readonly TerrainFeature[], opts: { amphibious?: boolean; travel?: boolean } = {}, rays = 40): Point[] {
  if (budget <= 0.01) return []
  const longest = budget * (opts.travel ? 2 : 1)
  const nearby = nearbyFeatures(from, longest, features)
  const out: Point[] = []
  for (let r = 0; r < rays; r++) {
    const angle = (r / rays) * Math.PI * 2
    const dir = { x: Math.sin(angle), y: -Math.cos(angle) }
    const end = (len: number) => ({ x: from.x + dir.x * len, y: from.y + dir.y * len })
    const fits = (len: number) => {
      const cost = reachCost(from, end(len), family, nearby, budget, opts)
      return !cost.blocked && cost.factors <= budget + 1e-6
    }
    let lo = 0
    let hi = longest
    if (fits(hi)) lo = hi
    else
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid
        else hi = mid
      }
    out.push(end(lo))
  }
  return out
}

function pointAlong(points: readonly Point[], at: number): Point {
  let left = at
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const d = distance(a, b)
    if (left <= d || i === points.length - 1) {
      const t = d < 1e-9 ? 0 : Math.min(1, left / d)
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    left -= d
  }
  return points[0] ?? { x: 0, y: 0 }
}

/** The plotted path cut into runs of one going each — the same runs the 2D `MovePlot` colours stretch by stretch. */
export function splitByLegs(points: readonly Point[], legs: ReadonlyArray<{ going: Going; length: number }>): Array<{ going: Going; points: Point[] }> {
  const out: Array<{ going: Going; points: Point[] }> = []
  if (points.length < 2) return out
  const at: number[] = [0]
  for (let i = 1; i < points.length; i++) at.push(at[i - 1]! + distance(points[i - 1]!, points[i]!))
  let start = 0
  for (const leg of legs) {
    const end = start + leg.length
    const run: Point[] = [pointAlong(points, start)]
    for (let i = 1; i < points.length - 1; i++) if (at[i]! > start + 1e-6 && at[i]! < end - 1e-6) run.push(points[i]!)
    run.push(pointAlong(points, end))
    const last = out[out.length - 1]
    if (last && last.going === leg.going) last.points.push(...run.slice(1))
    else out.push({ going: leg.going, points: run })
    start = end
  }
  return out
}

/** Where a side may still deploy, as a band of the table's depth — `ui/dirtside/map/geometry.ts`'s own `deploymentBand`. */
export function deploymentBand(inZone: (point: Point) => boolean, depth: number, width: number): { y0: number; y1: number } | null {
  const x = width / 2
  let y0: number | null = null
  let y1: number | null = null
  for (let y = 0; y <= depth + 1e-9; y += 0.25) {
    if (!inZone({ x, y })) continue
    if (y0 === null) y0 = y
    y1 = y
  }
  return y0 === null || y1 === null ? null : { y0, y1 }
}
