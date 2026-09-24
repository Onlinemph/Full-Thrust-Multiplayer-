/**
 * Built-up ground: a lone building, a hamlet or village strung along a
 * road, and a town or city — one `urban` area followed by its streets,
 * buildings and (in a city) rubble, every piece `partOf` the area (BRIEF-
 * TERRAIN's "the model"). Only the shapes are decided here; `generate.ts`
 * turns each into a `TerrainFeature` with a `terrain` and an id.
 */

import { bendingLine, type CurvedLine } from './pieces'
import { blob, bboxOf, chance, clamp, distance, lShapeLocal, obbOverlap, orientedRectPoints, pointAlongPolyline, range, rangeInt, type Obb } from './math'
import type { Point } from '../types'
import type { ScaleParams } from './scale'

export interface BuildingSpec {
  points: Point[]
  isL: boolean
}

function footprintPoints(cx: number, cy: number, w: number, h: number, angleDeg: number, rnd: () => number, lChance: number): BuildingSpec {
  const isL = chance(rnd, lChance)
  const angle = (angleDeg * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  let local: Point[]
  if (isL) {
    const notchW = w * range(rnd, 0.32, 0.55)
    const notchH = h * range(rnd, 0.32, 0.55)
    local = lShapeLocal(w, h, notchW, notchH, rangeInt(rnd, 0, 3))
  } else {
    local = orientedRectPoints(0, 0, w, h, 0)
  }
  return { points: local.map((p) => ({ x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos })), isL }
}

/**
 * One building, checked against every OBB already placed in the settlement
 * (`taken`, appended to on success) so no two ever overlap. A rotated
 * candidate that would poke outside its own cell falls back to unrotated,
 * which always fits by construction — the caller only ever offers a `w`×`h`
 * that already fits the cell.
 */
function place(taken: Obb[], cx: number, cy: number, w: number, h: number, angleDeg: number, rnd: () => number, opts: { lChance: number; margin: number; cell: { x0: number; x1: number; y0: number; y1: number } }): BuildingSpec | null {
  const candidate: Obb = { cx, cy, w, h, angle: (angleDeg * Math.PI) / 180 }
  const fits = (obb: Obb) => {
    const box = bboxOf(orientedRectPoints(obb.cx, obb.cy, obb.w, obb.h, obb.angle))
    return box.x0 >= opts.cell.x0 && box.x1 <= opts.cell.x1 && box.y0 >= opts.cell.y0 && box.y1 <= opts.cell.y1
  }
  const clashes = (obb: Obb) => taken.some((o) => obbOverlap(o, obb, opts.margin))
  let chosen = candidate
  if (!fits(candidate) || clashes(candidate)) {
    const upright: Obb = { ...candidate, angle: 0 }
    if (!fits(upright) || clashes(upright)) return null
    chosen = upright
  }
  taken.push(chosen)
  return footprintPoints(cx, cy, w, h, (chosen.angle * 180) / Math.PI, rnd, opts.lChance)
}

// ---------------------------------------------------------------------------
// A lone building, or a few strung along a road (a farm, a hamlet, a village).
// ---------------------------------------------------------------------------

export interface StandaloneBuildings {
  buildings: BuildingSpec[]
}

/**
 * Buildings strung along a stretch of road, close to its edge, alternating
 * sides, none overlapping. Each one stands on its own (Dirtside p. 46's
 * "isolated building"): a farm, an outbuilding, or the string of buildings
 * a village is modelled as — no enclosing urban area at this size.
 */
/**
 * Where along a polyline its points fall inside `clearY`'s band — the
 * narrowest arc-length window worth trying at all, since every candidate
 * outside it fails `standaloneBuildings`'s own deployment-strip check
 * anyway. Without this, a road that runs the whole table depth spends most
 * of its length (and most of the caller's placement attempts) approaching
 * or leaving the strip before ever reaching safe ground.
 */
function safeArcRange(points: readonly Point[], clearY: readonly [number, number]): [number, number] | null {
  let cum = 0
  let start: number | null = null
  let end: number | null = null
  for (let i = 0; i < points.length; i++) {
    if (i > 0) cum += distance(points[i - 1]!, points[i]!)
    const y = points[i]!.y
    if (y >= clearY[0] && y <= clearY[1]) {
      if (start === null) start = cum
      end = cum
    }
  }
  return start === null || end === null ? null : [start, end]
}

export function standaloneBuildings(
  rnd: () => number,
  roadPoints: Point[],
  count: number,
  scale: ScaleParams,
  opts: { startAt: number; endAt: number; roadWidth: number; clearY?: [number, number] },
): StandaloneBuildings {
  const taken: Obb[] = []
  const buildings: BuildingSpec[] = []
  let side = chance(rnd, 0.5) ? 1 : -1
  let [at, endAt] = [opts.startAt, opts.endAt]
  if (opts.clearY) {
    const safe = safeArcRange(roadPoints, opts.clearY)
    if (!safe) return { buildings }
    at = Math.max(at, safe[0])
    endAt = Math.min(endAt, safe[1])
  }
  let guard = 0
  while (at < endAt && buildings.length < count && guard++ < count * 30) {
    const { point, angle } = pointAlongPolyline(roadPoints, at)
    const nx = -Math.sin(angle)
    const ny = Math.cos(angle)
    const w = range(rnd, scale.building[0], scale.building[1])
    const h = range(rnd, scale.building[0] * 0.8, scale.building[1] * 0.8)
    const setback = opts.roadWidth / 2 + range(rnd, 0.3, 0.7) * (scale.building[1] / 1.5)
    const cx = point.x + nx * (setback + h / 2)
    const cy = point.y + ny * (setback + h / 2)
    const faceAngleDeg = (angle * 180) / Math.PI + (side > 0 ? 90 : -90) + range(rnd, -8, 8)
    const candidate: Obb = { cx, cy, w: w + 0.2, h: h + 0.2, angle: (faceAngleDeg * Math.PI) / 180 }
    // Kept clear of the deployment strips (p. 17's 6"), by the building's own worst-case corner, not just its centre.
    let clear = true
    if (opts.clearY) {
      const box = bboxOf(orientedRectPoints(cx, cy, candidate.w, candidate.h, candidate.angle))
      clear = box.y0 >= opts.clearY[0] && box.y1 <= opts.clearY[1]
    }
    if (clear && !taken.some((o) => obbOverlap(o, candidate, 0.15))) {
      taken.push(candidate)
      buildings.push(footprintPoints(cx, cy, w, h, faceAngleDeg, rnd, 0.2))
      // Half a building's own length or so: buildings alternate sides, so consecutive ones need not clear a
      // full building's width along the road, only past each other, which `obbOverlap` above already checked.
      at += range(rnd, scale.building[1] * 0.22, scale.building[1] * 0.45)
      side = -side
    } else {
      at += scale.building[0] * 0.3
    }
  }
  return { buildings }
}

// ---------------------------------------------------------------------------
// A street grid and the blocks it cuts the settlement into.
// ---------------------------------------------------------------------------

export interface Block {
  x: number
  y: number
  w: number
  h: number
}

export interface StreetGrid {
  blocks: Block[]
  hBands: CurvedLine[]
  vBands: CurvedLine[]
}

function streetGrid(rnd: () => number, bounds: { x: number; y: number; w: number; h: number }, scale: ScaleParams, blockRange: readonly [number, number]): StreetGrid {
  const streetWidth = range(rnd, scale.street[0], scale.street[1])
  const [minB, maxB] = blockRange
  const rowHeights: number[] = []
  for (let y = bounds.y; y < bounds.y + bounds.h - minB; ) {
    const h = Math.min(range(rnd, minB, maxB), bounds.y + bounds.h - y)
    rowHeights.push(h)
    y += h + streetWidth
  }
  const colWidths: number[] = []
  for (let x = bounds.x; x < bounds.x + bounds.w - minB; ) {
    const w = Math.min(range(rnd, minB, maxB), bounds.x + bounds.w - x)
    colWidths.push(w)
    x += w + streetWidth
  }
  const blocks: Block[] = []
  let y = bounds.y
  for (const h of rowHeights) {
    let x = bounds.x
    for (const w of colWidths) {
      blocks.push({ x, y, w, h })
      x += w + streetWidth
    }
    y += h + streetWidth
  }
  const hBands: CurvedLine[] = []
  let sy = bounds.y + rowHeights[0]! + streetWidth / 2
  for (let r = 0; r < rowHeights.length - 1; r++) {
    hBands.push({ points: [{ x: bounds.x, y: sy }, { x: bounds.x + bounds.w, y: sy }], width: streetWidth })
    sy += streetWidth + rowHeights[r + 1]!
  }
  const vBands: CurvedLine[] = []
  let sx = bounds.x + colWidths[0]! + streetWidth / 2
  for (let c = 0; c < colWidths.length - 1; c++) {
    vBands.push({ points: [{ x: sx, y: bounds.y }, { x: sx, y: bounds.y + bounds.h }], width: streetWidth })
    sx += streetWidth + colWidths[c + 1]!
  }
  return { blocks, hBands, vBands }
}

/** Buildings packed into one axis-aligned block, row by row, each with a little rotation jitter. */
function packBlock(rnd: () => number, block: Block, scale: ScaleParams, taken: Obb[], opts: { lChance: number; fillChance: number; margin: number }): BuildingSpec[] {
  const [minW, maxW] = scale.building
  const minH = minW * 0.75
  const maxH = maxW * 0.85
  const out: BuildingSpec[] = []
  let y = block.y + opts.margin
  while (y < block.y + block.h - opts.margin - minH) {
    const h = Math.min(range(rnd, minH, maxH), block.y + block.h - opts.margin - y)
    let x = block.x + opts.margin
    while (x < block.x + block.w - opts.margin - minW) {
      const w = Math.min(range(rnd, minW, maxW), block.x + block.w - opts.margin - x)
      if (w >= minW * 0.7 && chance(rnd, opts.fillChance)) {
        const cx = x + w / 2
        const cy = y + h / 2
        const angle = range(rnd, -6, 6)
        const cell = { x0: block.x + opts.margin * 0.4, x1: block.x + block.w - opts.margin * 0.4, y0: block.y + opts.margin * 0.4, y1: block.y + block.h - opts.margin * 0.4 }
        const spec = place(taken, cx, cy, w * 0.88, h * 0.88, angle, rnd, { lChance: opts.lChance, margin: 0.05, cell })
        if (spec) out.push(spec)
      }
      x += w + opts.margin
    }
    y += h + opts.margin
  }
  return out
}

/**
 * A jagged, broken outline in place of a standing block: what an artillery
 * mission or a fight leaves (Dirtside p. 46, Stargrunt p. 57). `blob`'s
 * noise (0.5) and lobe amount (0.32) can push a sample up to `1 + 0.5 +
 * 0.32` times its nominal radius (see `blob`'s own doc comment); the base
 * radius here is shrunk by that exact factor plus a small safety margin,
 * so the ruin never pokes out of its own block into the street.
 */
function ruinOutline(block: Block, rnd: () => number): Point[] {
  const cx = block.x + block.w / 2
  const cy = block.y + block.h / 2
  const shrink = 1 / 1.82 / 1.08
  return blob(cx, cy, block.w * 0.5 * shrink, block.h * 0.5 * shrink, rnd, { noise: 0.5, lobes: rangeInt(rnd, 4, 6), lobeAmt: 0.32, smooth: 1, points: rangeInt(rnd, 14, 20) })
}

// ---------------------------------------------------------------------------
// The urban area's own outline: a "rounded rectangle" around the block
// grid's bounding box, jittered outward only, so it is guaranteed to
// contain every block (and so every building and street) however the
// jitter falls. See src/dirtside/table/ground/settlement.test.ts.
// ---------------------------------------------------------------------------

export function urbanOutline(bounds: { x: number; y: number; w: number; h: number }, rnd: () => number, pad: number, jitter: number): Point[] {
  const x0 = bounds.x - pad
  const x1 = bounds.x + bounds.w + pad
  const y0 = bounds.y - pad
  const y1 = bounds.y + bounds.h + pad
  const midx = (x0 + x1) / 2
  const midy = (y0 + y1) / 2
  const out = () => rnd() * jitter
  return [
    { x: x0 - out(), y: y0 - out() },
    { x: midx, y: y0 - out() },
    { x: x1 + out(), y: y0 - out() },
    { x: x1 + out(), y: midy },
    { x: x1 + out(), y: y1 + out() },
    { x: midx, y: y1 + out() },
    { x: x0 - out(), y: y1 + out() },
    { x: x0 - out(), y: midy },
  ]
}

// ---------------------------------------------------------------------------
// A town or a city: the street grid, its blocks packed with buildings (a
// city knocks a fraction down to rubble instead), a main avenue that bends
// or cuts across, and the outline that encloses all of it.
// ---------------------------------------------------------------------------

export interface SettlementPiece {
  kind: 'street' | 'building' | 'rubble'
  points: Point[]
  width?: number
}

export interface Settlement {
  outline: Point[]
  bounds: { x: number; y: number; w: number; h: number }
  pieces: SettlementPiece[]
  /** The main through-road: a real, non-`partOf` feature so a major highway still reads as one (p. 26). */
  avenue: CurvedLine
  /** An open block near the middle, for a square (town) or a plaza and park (city) — left clear of buildings, on purpose. */
  squareBlock: Block | null
}

export function buildSettlement(rnd: () => number, bounds: { x: number; y: number; w: number; h: number }, style: 'village' | 'town' | 'city', scale: ScaleParams): Settlement {
  const grid = streetGrid(rnd, bounds, scale, style === 'city' ? scale.cityBlock : scale.block)
  const pieces: SettlementPiece[] = []
  for (const b of [...grid.hBands, ...grid.vBands]) pieces.push({ kind: 'street', points: b.points, width: b.width })
  const squareIndex = grid.blocks.length > 2 ? Math.floor(grid.blocks.length / 2) : -1
  const ruinChance = style === 'city' ? 0.22 : 0
  const fillChance = style === 'city' ? 0.94 : 0.88
  const lChance = style === 'city' ? 0.35 : 0.25
  const taken: Obb[] = []
  let squareBlock: Block | null = null
  grid.blocks.forEach((block, i) => {
    if (i === squareIndex) {
      squareBlock = block
      return
    }
    if (chance(rnd, ruinChance)) {
      pieces.push({ kind: 'rubble', points: ruinOutline(block, rnd) })
      return
    }
    // A block's inner margin: enough to keep a building off the street, not a whole street's own width —
    // a block sized only a little more than one building (a city's own, smaller blocks especially) still fits it.
    for (const spec of packBlock(rnd, block, scale, taken, { lChance, fillChance, margin: scale.building[0] * 0.15 })) pieces.push({ kind: 'building', points: spec.points })
  })
  const pad = scale.outlinePad
  const outline = urbanOutline(bounds, rnd, pad, pad * 0.8)
  // The avenue crosses the whole footprint corner to corner, so it always cuts across rather than skirting the edge.
  const corner = chance(rnd, 0.5)
  const a: Point = { x: bounds.x, y: corner ? bounds.y : bounds.y + bounds.h }
  const b: Point = { x: bounds.x + bounds.w, y: corner ? bounds.y + bounds.h : bounds.y }
  const raw = bendingLine(rnd, a, b, Math.min(bounds.w, bounds.h) * 0.18, range(rnd, scale.street[1], scale.street[1] * 1.6))
  // A Catmull-Rom spline can overshoot its control points a little; clamped back to `bounds` so the avenue never
  // reaches past the settlement's own footprint (and so never into a deployment strip generate.ts kept clear of it).
  const avenue: CurvedLine = { points: raw.points.map((p) => ({ x: clamp(p.x, bounds.x, bounds.x + bounds.w), y: clamp(p.y, bounds.y, bounds.y + bounds.h) })), width: raw.width }
  return { outline, bounds, pieces, avenue, squareBlock }
}
