/**
 * Rural terrain pieces: the irregular outlines and curving lines that
 * replace the old generator's circles, one rect and three dead-straight
 * road segments (BRIEF-TERRAIN's "the model"). Each function only builds
 * the shape; `generate.ts` decides where on the table it goes and wraps it
 * in a `TerrainFeature`.
 */

import { blob, catmullRom, clamp, lerp, pointAlongPolyline, polylineLength, range, rangeInt } from './math'
import type { Point } from '../types'

/** A wood, a patch of rough ground, a swamp or a hill's own footprint: an organic blob. */
export function pieceOutline(cx: number, cy: number, rx: number, ry: number, rnd: () => number, opts: { noise?: number; lobes?: number; lobeAmt?: number } = {}): Point[] {
  return blob(cx, cy, rx, ry, rnd, { noise: opts.noise ?? 0.32, lobes: opts.lobes ?? rangeInt(rnd, 2, 4), lobeAmt: opts.lobeAmt })
}

/**
 * A field: a rectangle whose four corners are each nudged independently
 * (never a perfect parallelogram) then rotated — the skewed quadrilateral
 * the model calls for, in place of the old generator's axis-aligned rect.
 */
export function fieldQuad(cx: number, cy: number, w: number, h: number, rnd: () => number): Point[] {
  const angle = range(rnd, 0, Math.PI * 2)
  const skew = 0.22
  const corners = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ].map((p) => ({ x: p.x + range(rnd, -skew, skew) * w, y: p.y + range(rnd, -skew, skew) * h }))
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return corners.map((p) => ({ x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos }))
}

export interface CurvedLine {
  points: Point[]
  width: number
}

export interface RiverLine extends CurvedLine {
  ford: { point: Point; angle: number }
}

/** A meandering river crossing the table top to bottom, with one point picked as a ford. */
export function riverLine(rnd: () => number, tableW: number, tableH: number, opts: { width?: number; fordAt?: number } = {}): RiverLine {
  const waypoints = rangeInt(rnd, 5, 7)
  const startX = range(rnd, tableW * 0.12, tableW * 0.35)
  const endX = range(rnd, tableW * 0.55, tableW * 0.88)
  const wander = tableW * 0.11
  const controls: Point[] = []
  for (let i = 0; i <= waypoints; i++) {
    const t = i / waypoints
    const meander = Math.sin(t * Math.PI * range(rnd, 1.8, 2.6) + i) * wander + range(rnd, -wander * 0.4, wander * 0.4)
    controls.push({ x: clamp(lerp(startX, endX, t) + meander, 1.5, tableW - 1.5), y: t * tableH })
  }
  const points = catmullRom(controls, 8)
  const fordT = opts.fordAt ?? range(rnd, 0.28, 0.72)
  const ford = pointAlongPolyline(points, polylineLength(points) * fordT)
  return { points, width: opts.width ?? range(rnd, 1.2, 1.8), ford }
}

/** A curving road across the table: the same construction as a river, gentler (roads don't meander as hard as water). */
export function roadLine(rnd: () => number, tableW: number, tableH: number, opts: { x?: number; width?: number } = {}): CurvedLine {
  const waypoints = rangeInt(rnd, 4, 6)
  const baseX = opts.x ?? range(rnd, tableW * 0.25, tableW * 0.75)
  const wander = tableW * 0.06
  const controls: Point[] = []
  for (let i = 0; i <= waypoints; i++) {
    const t = i / waypoints
    const w = Math.sin(t * Math.PI * range(rnd, 1.2, 1.8) + i * 0.7) * wander
    controls.push({ x: clamp(baseX + w, 1, tableW - 1), y: t * tableH })
  }
  return { points: catmullRom(controls, 8), width: opts.width ?? 1 }
}

/** A short bending line between two points — a settlement's main avenue, or a street that cuts across at an angle. */
export function bendingLine(rnd: () => number, a: Point, b: Point, bend: number, width: number): CurvedLine {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  // Perpendicular offset at the midpoint, so the line is straight only in the degenerate `bend = 0` case.
  const nx = -dy / len
  const ny = dx / len
  const k = range(rnd, -bend, bend)
  const mid = { x: mx + nx * k, y: my + ny * k }
  return { points: catmullRom([a, mid, b], 10), width }
}
