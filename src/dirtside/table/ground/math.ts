/**
 * Shape maths for the ground generator: nothing here reads a rule or knows
 * a `TerrainType`. Ported from the design prototype (scratchpad
 * terrain-design/generator.js) so the same construction (a blob's radial
 * noise and lobes, Chaikin's corner-cutting, a Catmull-Rom spline through
 * waypoints, the separating-axis test for two rotated rectangles) produces
 * the engine's own `TerrainFeature` polygons and paths.
 *
 * Every function that needs randomness takes `rnd: () => number`, a uniform
 * draw in [0, 1). The generator that calls these always backs `rnd` with
 * `() => draw(stream)` against the table's own `DiceStream`, so the same
 * seed always lays out the same table (p. 17's replay guarantee) — nothing
 * here ever calls `Math.random`.
 */

import type { Point } from '../types'

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))
/** A uniform float in [lo, hi). */
export const range = (rnd: () => number, lo: number, hi: number): number => lo + rnd() * (hi - lo)
/** A uniform integer in [lo, hi]. */
export const rangeInt = (rnd: () => number, lo: number, hi: number): number => Math.floor(range(rnd, lo, hi + 1))
/** True with probability `p`. */
export const chance = (rnd: () => number, p: number): boolean => rnd() < p
/** One of a list, uniformly. */
export function choice<T>(rnd: () => number, list: readonly T[]): T {
  return list[Math.floor(rnd() * list.length) % list.length]!
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
}

export function bboxOf(points: readonly Point[]): Box {
  let x0 = Number.POSITIVE_INFINITY
  let x1 = Number.NEGATIVE_INFINITY
  let y0 = Number.POSITIVE_INFINITY
  let y1 = Number.NEGATIVE_INFINITY
  for (const p of points) {
    x0 = Math.min(x0, p.x)
    x1 = Math.max(x1, p.x)
    y0 = Math.min(y0, p.y)
    y1 = Math.max(y1, p.y)
  }
  return { x0, x1, y0, y1 }
}

/** The mean of a closed polygon's vertices: good enough as a centre for a roughly star-shaped blob. */
export function polygonCentroid(points: readonly Point[]): Point {
  let x = 0
  let y = 0
  for (const p of points) {
    x += p.x
    y += p.y
  }
  return { x: x / points.length, y: y / points.length }
}

/** Ray-casting point-in-polygon test, for keeping generated pieces apart and inside their settlement. */
export function pointInPolygon(pt: Point, poly: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    const crosses = a.y > pt.y !== b.y > pt.y
    if (!crosses) continue
    const xAt = ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x
    if (pt.x < xAt) inside = !inside
  }
  return inside
}

/**
 * Chaikin corner-cutting, `passes` times, on a closed polyline: each edge's
 * middle third replaces its two hard corners with a gentle curve. Turns a
 * jagged ring of sampled points into the smooth, organic outline of a
 * hand-drawn wargames terrain piece.
 */
export function chaikinClosed(points: readonly Point[], passes: number): Point[] {
  let pts: Point[] = points.slice()
  for (let p = 0; p < passes; p++) {
    const next: Point[] = []
    const n = pts.length
    for (let i = 0; i < n; i++) {
      const a = pts[i]!
      const b = pts[(i + 1) % n]!
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 })
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
    }
    pts = next
  }
  return pts
}

/**
 * A smooth, periodic "noise" function of an angle 0..2π: a handful of sine
 * harmonics at random phases and decreasing amplitude, normalised to
 * roughly [-1, 1]. A cheap, trivially-seedable stand-in for simplex noise —
 * exactly what a closed blob outline needs.
 */
export function radialNoise(rnd: () => number, harmonics: number): (theta: number) => number {
  const terms: { freq: number; phase: number; amp: number }[] = []
  for (let h = 2; h < 2 + harmonics; h++) terms.push({ freq: h, phase: range(rnd, 0, Math.PI * 2), amp: 1 / h })
  const norm = terms.reduce((s, t) => s + t.amp, 0)
  return (theta: number) => terms.reduce((s, t) => s + t.amp * Math.sin(t.freq * theta + t.phase), 0) / norm
}

/**
 * An irregular, closed, organic outline: a wood, a patch of rough ground, a
 * swamp, a hill. Samples points around an ellipse of radii (rx, ry), pushes
 * each one in or out by smooth periodic noise plus a few broad "lobes" (so
 * the shape reads as one blob with fingers, not a spiky star), then
 * Chaikin-smooths the result — the difference between a gear and a puddle.
 * Returns a closed polygon (first point not repeated), star-shaped around
 * (cx, cy): every ray from the centre crosses the outline exactly once,
 * which is what keeps every caller's clearance maths (a nominal radius
 * times a fixed overshoot) simple and correct.
 */
export function blob(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rnd: () => number,
  opts: { points?: number; lobes?: number; noise?: number; lobeAmt?: number; rotation?: number; smooth?: number } = {},
): Point[] {
  const n = opts.points ?? rangeInt(rnd, 24, 40)
  const lobes = opts.lobes ?? rangeInt(rnd, 2, 4)
  const noiseAmt = opts.noise ?? 0.32
  const lobeAmt = opts.lobeAmt ?? 0.2
  const rotation = opts.rotation ?? range(rnd, 0, Math.PI * 2)
  const noise = radialNoise(rnd, 5)
  const lobePhase = range(rnd, 0, Math.PI * 2)
  const raw: Point[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const wobble = noise(t) * noiseAmt + Math.cos(lobes * t + lobePhase) * lobeAmt
    const r = Math.max(0.32, 1 + wobble)
    const ang = t + rotation
    raw.push({ x: cx + Math.cos(ang) * rx * r, y: cy + Math.sin(ang) * ry * r })
  }
  const passes = opts.smooth ?? 2
  return passes > 0 ? chaikinClosed(raw, passes) : raw
}

/**
 * `blob()`'s noise and lobes can push its outline up to roughly this factor
 * past the nominal radius passed in. Every caller that reserves clearance
 * for a blob (so it neither runs off the table edge nor stacks on its
 * neighbour) reserves against this inflated radius, not the nominal one.
 */
export const BLOB_OVERSHOOT = 1.55

/**
 * Uniform Catmull-Rom spline through a polyline's control points: turns a
 * handful of waypoints into a fluid curve (a meandering river, a curving
 * road, a bending street) without a curve-fitting library. `samplesPerSeg`
 * points are generated between each pair of controls.
 */
export function catmullRom(points: readonly Point[], samplesPerSeg: number): Point[] {
  if (points.length < 3) return points.slice()
  const pad = [points[0]!, ...points, points[points.length - 1]!]
  const out: Point[] = []
  for (let i = 1; i < pad.length - 2; i++) {
    const p0 = pad[i - 1]!
    const p1 = pad[i]!
    const p2 = pad[i + 1]!
    const p3 = pad[i + 2]!
    for (let s = i === 1 ? 0 : 1; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg
      const t2 = t * t
      const t3 = t2 * t
      const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)
      const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
      out.push({ x, y })
    }
  }
  out.push(points[points.length - 1]!)
  return out
}

export function polylineLength(points: readonly Point[]): number {
  let d = 0
  for (let i = 1; i < points.length; i++) d += distance(points[i - 1]!, points[i]!)
  return d
}

/** The point (and heading, in radians) a given distance along a polyline. */
export function pointAlongPolyline(points: readonly Point[], at: number): { point: Point; angle: number } {
  let left = at
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const d = distance(a, b)
    if (left <= d || i === points.length - 1) {
      const t = d < 1e-9 ? 0 : clamp(left / d, 0, 1)
      return { point: { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }, angle: Math.atan2(b.y - a.y, b.x - a.x) }
    }
    left -= d
  }
  return { point: points[0]!, angle: 0 }
}

/** The four corners of a `w`×`h` rectangle centred at (cx, cy), rotated `angle` radians clockwise. */
export function orientedRectPoints(cx: number, cy: number, w: number, h: number, angle: number): Point[] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ].map((p) => ({ x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos }))
}

/**
 * An L-shaped footprint: a `w`×`h` rectangle with a `notchW`×`notchH` bite
 * out of one corner (0=NW, 1=NE, 2=SE, 3=SW), centred at the origin. Local
 * (unrotated) points; the caller rotates and places them.
 */
export function lShapeLocal(w: number, h: number, notchW: number, notchH: number, corner: number): Point[] {
  const x0 = -w / 2
  const y0 = -h / 2
  const x1 = w / 2
  const y1 = h / 2
  const nx = corner === 0 || corner === 3 ? x0 + notchW : x1 - notchW
  const ny = corner === 0 || corner === 1 ? y0 + notchH : y1 - notchH
  if (corner === 0) return [{ x: nx, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: ny }, { x: nx, y: ny }]
  if (corner === 1) return [{ x: x0, y: y0 }, { x: nx, y: y0 }, { x: nx, y: ny }, { x: x1, y: ny }, { x: x1, y: y1 }, { x: x0, y: y1 }]
  if (corner === 2) return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: ny }, { x: nx, y: ny }, { x: nx, y: y1 }, { x: x0, y: y1 }]
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: nx, y: y1 }, { x: nx, y: ny }, { x: x0, y: ny }]
}

export interface Obb {
  cx: number
  cy: number
  w: number
  h: number
  /** Radians. */
  angle: number
}

/** Separating-axis test for two rotated rectangles, with an optional clearance margin added to both. */
export function obbOverlap(a: Obb, b: Obb, margin = 0): boolean {
  const axes = (r: Obb) => [
    { x: Math.cos(r.angle), y: Math.sin(r.angle) },
    { x: -Math.sin(r.angle), y: Math.cos(r.angle) },
  ]
  const corners = (r: Obb) => orientedRectPoints(r.cx, r.cy, r.w + margin * 2, r.h + margin * 2, r.angle)
  const ca = corners(a)
  const cb = corners(b)
  for (const axis of [...axes(a), ...axes(b)]) {
    const proj = (pts: Point[]) => pts.map((p) => p.x * axis.x + p.y * axis.y)
    const pa = proj(ca)
    const pb = proj(cb)
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false
  }
  return true
}
