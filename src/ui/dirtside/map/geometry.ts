import { FACTORS_PER_INCH, type Going, type MobilityFamily, goingOf, mobilityFamily } from '../../../dirtside/data/mobility'
import { inDeploymentZone } from '../../../dirtside/table/game'
import { WOOD_EDGE, WOODS, depthInside, distance, featureAt, insideShape } from '../../../dirtside/table/terrain'
import type { GameSetup, Point, Shape, SideId, TerrainFeature } from '../../../dirtside/table/types'
import type { InfantryElement, VehicleDesign } from '../../../dirtside/types'

/**
 * The table map's arithmetic: nothing here decides a rule. Shapes inset for
 * contour lines, polylines cut where the going changes, how far a vehicle
 * could get in a straight line for what it has left, and which silhouette a
 * design is drawn with.
 */

export const pts = (points: readonly Point[]) => points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ')
export const round = (n: number) => Math.round(n * 1000) / 1000

/** A stable number from a feature id, so a field's furrows and a town's blocks stay put between renders. */
export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A small seeded generator for decoration only (never for a rule). */
export function decorRandom(seed: number): () => number {
  let s = seed || 1
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The mean of a polygon's own vertices: cheap and adequate for a roughly star-shaped generated blob or footprint. */
export function polygonCentroid(points: readonly Point[]): Point {
  let x = 0
  let y = 0
  for (const p of points) {
    x += p.x
    y += p.y
  }
  return { x: x / points.length, y: y / points.length }
}

/**
 * A shape shrunk by `by` inches, or null once nothing is left of it. A
 * polygon has no straight-skeleton offset here (hard to keep from
 * self-intersecting on a concave outline); scaling every vertex toward the
 * centroid by the same fraction is the cheap stand-in that matches this
 * file's existing precision level and never crosses itself for a
 * star-shaped outline, which is everything the generator produces.
 */
export function insetShape(shape: Shape, by: number): Shape | null {
  if (shape.kind === 'circle') return shape.radius - by > 0.05 ? { ...shape, radius: shape.radius - by } : null
  if (shape.kind === 'rect') return shape.width - 2 * by > 0.1 && shape.height - 2 * by > 0.1 ? { kind: 'rect', x: shape.x + by, y: shape.y + by, width: shape.width - 2 * by, height: shape.height - 2 * by } : null
  if (shape.kind === 'polygon') {
    const c = polygonCentroid(shape.points)
    const avgR = shape.points.reduce((s, p) => s + distance(p, c), 0) / shape.points.length
    if (avgR - by < 0.3) return null
    const scale = (avgR - by) / avgR
    return { kind: 'polygon', points: shape.points.map((p) => ({ x: c.x + (p.x - c.x) * scale, y: c.y + (p.y - c.y) * scale })) }
  }
  return null
}

/** The middle of a feature, where its name goes: a polygon's own centroid, not a path's midpoint trick. */
export function centreOf(shape: Shape): Point {
  if (shape.kind === 'circle') return shape.centre
  if (shape.kind === 'rect') return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }
  if (shape.kind === 'polygon') return polygonCentroid(shape.points)
  const i = Math.floor((shape.points.length - 1) / 2)
  const a = shape.points[i]!
  const b = shape.points[Math.min(i + 1, shape.points.length - 1)]!
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * An approximate "pole of inaccessibility" for a polygon: the grid point
 * furthest inside its own boundary, a safer label spot than the centroid
 * for a lobed or crescent outline (a wood with a waist, an L-shaped block)
 * where the centroid itself can land outside the shape or hard against an
 * edge. Coarse on purpose — a wargames label, not a cartographic one — and
 * cheap enough for the handful of area features (rural blobs, fields, one
 * urban outline a settlement) that ever call it; buildings and rubble never
 * do, they carry no label of their own (see `terrain.tsx`'s `placeLabels`).
 */
export function interiorLabelPoint(shape: Extract<Shape, { kind: 'polygon' }>): Point {
  const pts = shape.points
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const p of pts) {
    x0 = Math.min(x0, p.x)
    x1 = Math.max(x1, p.x)
    y0 = Math.min(y0, p.y)
    y1 = Math.max(y1, p.y)
  }
  const step = Math.max(0.35, (x1 - x0) / 18)
  let best: Point | null = null
  let bestD = -1
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      const p = { x, y }
      if (!insideShape(p, shape)) continue
      let d = Infinity
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!
        const b = pts[(i + 1) % pts.length]!
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len2 = dx * dx + dy * dy
        const t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
        d = Math.min(d, distance(p, { x: a.x + t * dx, y: a.y + t * dy }))
      }
      if (d > bestD) {
        bestD = d
        best = p
      }
    }
  }
  return best ?? polygonCentroid(pts)
}

/** The point `at` inches along a polyline. */
export function pointAlong(points: readonly Point[], at: number): Point {
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

/**
 * A polyline cut into runs of the same going, from the legs a path cost
 * reports in path order: what the move plot colours stretch by stretch.
 */
export function splitByLegs(points: readonly Point[], legs: ReadonlyArray<{ going: Going; length: number }>): Array<{ going: Going; points: Point[] }> {
  const out: Array<{ going: Going; points: Point[] }> = []
  if (points.length < 2) return out
  // Cumulative distance of every vertex.
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

/** A shape's own axis-aligned bounding box, padded for a path's width: cheap, UI-side only (terrain.ts keeps its own for the engine's hot loops). */
function boundsOf(shape: Shape): { x0: number; y0: number; x1: number; y1: number } {
  if (shape.kind === 'circle') return { x0: shape.centre.x - shape.radius, y0: shape.centre.y - shape.radius, x1: shape.centre.x + shape.radius, y1: shape.centre.y + shape.radius }
  if (shape.kind === 'rect') return { x0: shape.x, y0: shape.y, x1: shape.x + shape.width, y1: shape.y + shape.height }
  const pad = shape.kind === 'path' ? shape.width / 2 : 0
  let x0 = Number.POSITIVE_INFINITY
  let y0 = Number.POSITIVE_INFINITY
  let x1 = Number.NEGATIVE_INFINITY
  let y1 = Number.NEGATIVE_INFINITY
  for (const p of shape.points) {
    x0 = Math.min(x0, p.x - pad)
    y0 = Math.min(y0, p.y - pad)
    x1 = Math.max(x1, p.x + pad)
    y1 = Math.max(y1, p.y + pad)
  }
  return { x0, y0, x1, y1 }
}

/** Distance from a point to the nearest point of a box, 0 if the point is inside it. */
function distanceToBox(p: Point, box: { x0: number; y0: number; x1: number; y1: number }): number {
  const dx = Math.max(box.x0 - p.x, 0, p.x - box.x1)
  const dy = Math.max(box.y0 - p.y, 0, p.y - box.y1)
  return Math.hypot(dx, dy)
}

/**
 * Features whose own bounding box comes within `range` of `from`: a cheap
 * once-per-call filter for anything (a reach ring, a sight band) about to
 * scan the feature list many times over, shared by both games' `reachPolygon`
 * (Dirtside's below, Stargrunt's own in `ui/stargrunt/map/geometry.ts`,
 * which needs its own `pathCost` but not its own copy of this filter).
 */
export function nearbyFeatures<F extends TerrainFeature>(from: Point, range: number, features: readonly F[]): F[] {
  return features.filter((f) => distanceToBox(from, boundsOf(f.shape)) <= range)
}

/**
 * A single straight segment's cost, in the same terms `pathCost` (terrain.ts)
 * charges it — `featureAt`'s going, easy only in travel mode, a wood a
 * mobility type can't enter stopping the ray at its edge — but built only
 * for what `reachPolygon`'s own binary search actually asks, "does this
 * length fit under budget", never the full leg-by-leg breakdown `pathCost`
 * reports. That lets it do two things `pathCost` itself can't, without
 * touching `pathCost` or its callers: stop the moment the answer is known
 * (most of a blocked ray is spent well short of the segment's own end, and
 * `pathCost` has no reason to stop early when nothing's asking for one), and
 * sample at half-inch steps rather than a quarter — half the points, for a
 * ring that only ever needs to look right, not survey-accurate. Together
 * these are what keep this ring under budget on a city table (BRIEF-TERRAIN,
 * ~30ms): filtering the feature list first (`nearbyFeatures`, above) cuts
 * how much each sample scans, this cuts how many samples and how many of
 * the ray's `pathCost`-equivalent calls ever run at all.
 */
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

/**
 * How far a vehicle could get from `from` along each of `rays` straight
 * lines for `budget` movement factors: the reach the move plot draws. Each
 * ray is found by halving on `reachCost` (above), so woods, roads and water
 * bend it exactly as a move would be charged.
 *
 * `pathCost` itself already skips a far-off feature cheaply (`insideShape`
 * caches its own bounding box), but on a city table most of a hundred-plus
 * buildings can still sit within reach of a unit standing in the middle of
 * town — `nearbyFeatures` trims the list once regardless, and `reachCost`'s
 * own early exit and coarser step do the rest (BRIEF-TERRAIN: this ring
 * stays under ~30ms even on a city table).
 */
export function reachPolygon(from: Point, budget: number, family: MobilityFamily, features: readonly TerrainFeature[], opts: { amphibious?: boolean; travel?: boolean } = {}, rays = 48): Point[] {
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
      // 7 halvings is well past what a drawn ring can show (budget/128, under a tenth of an inch at a
      // normal move) — a visual polygon has no use for the extra two steps' precision, and this loop is
      // the one repeated 48 times a call (BRIEF-TERRAIN's ~30ms budget on a city table).
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid
        else hi = mid
      }
    out.push(end(lo))
  }
  return out
}

/** Where a side may set up, as a band of the table's depth, read off the deployment rule itself (p. 17). */
export function deploymentBand(setup: GameSetup, side: SideId): { y0: number; y1: number } | null {
  const x = setup.table.width / 2
  let y0: number | null = null
  let y1: number | null = null
  for (let y = 0; y <= setup.table.depth + 1e-9; y += 0.25) {
    if (!inDeploymentZone(setup, side, { x, y })) continue
    if (y0 === null) y0 = y
    y1 = y
  }
  return y0 === null || y1 === null ? null : { y0, y1 }
}

// ---------------------------------------------------------------------------
// Lettering
// ---------------------------------------------------------------------------

let measure: CanvasRenderingContext2D | null | undefined
const widths = new Map<string, number>()

/**
 * The width in pixels of a line of map lettering, measured in the font the
 * page actually has, so a chip's box fits its words; an estimate erring wide
 * where there is no page to measure in.
 */
export function textWidth(text: string, size: number, opts: { bold?: boolean; display?: boolean; spacing?: number } = {}): number {
  const bold = opts.bold ?? true
  const key = `${text}|${size}|${bold ? 1 : 0}|${opts.display ? 1 : 0}|${opts.spacing ?? 0}`
  const known = widths.get(key)
  if (known !== undefined) return known
  if (measure === undefined) {
    try {
      measure = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
    } catch {
      measure = null
    }
  }
  let w: number
  if (measure) {
    const family = getComputedStyle(document.documentElement).getPropertyValue(opts.display ? '--font-display' : '--font-body').trim() || 'sans-serif'
    measure.font = `${bold ? 700 : 400} ${size}px ${family}`
    w = measure.measureText(text).width
  } else {
    w = [...text].reduce((sum, ch) => sum + (ch === ' ' ? 0.35 : /[A-Z0-9%]/.test(ch) ? 0.75 : /[il.,·:'"|]/.test(ch) ? 0.34 : 0.64), 0) * size
  }
  w += (opts.spacing ?? 0) * size * text.length
  widths.set(key, w)
  return w
}

/**
 * A label that must fit a length in pixels: the full wording with the name,
 * then with the name's last words dropped ("NORTHERN FORCE" to "NORTHERN"),
 * then with the name cut short, then the wording without it, then nothing.
 */
export function fitLabel(name: string, wording: (name: string) => string, bare: string | null, maxPx: number, size: number, opts: { bold?: boolean; spacing?: number } = {}): string | null {
  const fits = (t: string) => textWidth(t, size, opts) <= maxPx
  const full = wording(name)
  if (fits(full)) return full
  const words = name.split(' ')
  for (let n = words.length - 1; n >= 1; n--) {
    const fewer = wording(words.slice(0, n).join(' '))
    if (fits(fewer)) return fewer
  }
  for (let n = name.length - 1; n >= 4; n--) {
    const cut = wording(`${name.slice(0, n).trimEnd()}…`)
    if (fits(cut)) return cut
  }
  return bare !== null && fits(bare) ? bare : null
}

/** A box on the table, in inches. */
export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/** Of the places a label could go, the first that covers nothing, else the one that covers least; ties go to the earlier. */
export function clearestSpot<T extends { box: Box }>(candidates: readonly T[], obstacles: readonly Box[]): T | undefined {
  let best: T | undefined
  let bestHits = Number.POSITIVE_INFINITY
  for (const c of candidates) {
    let hits = 0
    for (const o of obstacles) if (overlaps(c.box, o)) hits++
    if (hits === 0) return c
    if (hits < bestHits) {
      best = c
      bestHits = hits
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Silhouettes
// ---------------------------------------------------------------------------

/** What carries the model: the running gear drawn under its body. */
export type Gear = 'tracks' | 'wheels' | 'skirt' | 'grav' | 'legs' | 'rotor' | 'wings' | 'hull'
/** What sits on top: the part that tells a tank from a carrier from a gun. */
export type Body = 'turret' | 'carrier' | 'ifv' | 'artillery' | 'air-defence' | 'plain'

export interface Silhouette {
  gear: Gear
  body: Body
  /** A family name for the legend and the tooltip: "tank", "carrier", "hover tank". */
  label: string
}

/** Which silhouette a vehicle design is drawn with, from its mobility, weapons, transport and artillery. */
export function silhouetteOf(design: VehicleDesign): Silhouette {
  const m = design.mobility
  let gear: Gear
  if (m === 'vtol') gear = 'rotor'
  else if (m === 'aerospace') gear = 'wings'
  else if (m === 'boat' || m === 'hydrofoil') gear = 'hull'
  else {
    const family = mobilityFamily(m)
    gear = family === 'tracked' ? 'tracks' : family === 'gev' ? 'skirt' : family === 'grav' ? 'grav' : family === 'walker' ? 'legs' : 'wheels'
  }
  const armed = design.weapons.length > 0 || design.missiles.length > 0
  const carries = design.transport.lineTeams + design.transport.poweredTeams > 0
  let body: Body
  if (design.artillery) body = 'artillery'
  else if (!armed && (design.ads || design.lad > 0)) body = 'air-defence'
  else if (carries) body = design.weapons.length > 0 ? 'ifv' : 'carrier'
  else if (design.weapons.length > 0) body = 'turret'
  else if (design.ads || design.lad > 0) body = 'air-defence'
  else body = 'plain'
  const gearWord: Record<Gear, string> = { tracks: '', wheels: 'wheeled ', skirt: 'hover ', grav: 'grav ', legs: 'walker ', rotor: 'VTOL ', wings: 'aerospace ', hull: 'boat ' }
  const bodyWord: Record<Body, string> = { turret: 'tank', carrier: 'carrier', ifv: 'fighting carrier', artillery: 'artillery', 'air-defence': 'air defence', plain: 'vehicle' }
  const label = gear === 'legs' ? (body === 'carrier' ? 'transport walker' : 'combat walker') : gear === 'rotor' || gear === 'wings' ? `${gearWord[gear]}${body === 'turret' ? 'gunship' : bodyWord[body]}`.trim() : `${gearWord[gear]}${bodyWord[body]}`
  return { gear, body, label }
}

/** A plain name for an infantry element: "line rifle team", "powered anti-armour team". */
export function infantryLabel(inf: InfantryElement): string {
  const team = { rifle: 'rifle', apsw: 'support weapon', assault: 'assault', observer: 'observer', 'anti-armour': 'anti-armour', 'air-defence': 'air-defence', engineer: 'engineer' }[inf.team]
  return `${inf.cavalry ? 'mounted ' : ''}${inf.troops} ${team} team`
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

// `blocksIn` used to scatter decorative roof rectangles inside a single big
// `urban` rect/circle, invented by the renderer and read by no rule. Now
// that a settlement's buildings are real `TerrainFeature`s (`terrain:
// 'building'`) drawn by `Feature`'s own `'building'` case, this whole
// subdivision step is superseded, not merely replaced — retired rather than
// grown a polygon branch (BRIEF-TERRAIN, `terrain-design/impact.md` §7).
