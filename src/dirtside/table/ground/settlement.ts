/**
 * Built-up ground: a lone building, a hamlet or village strung along a
 * road, and a town or city — one `urban` area followed by its streets,
 * buildings and (in a city) rubble, every piece `partOf` the area (BRIEF-
 * TERRAIN's "the model"). Only the shapes are decided here; `generate.ts`
 * turns each into a `TerrainFeature` with a `terrain` and an id.
 *
 * BRIEF-SETTLE's second pass: a town or city is a grid of varied, elongated
 * blocks (each row of blocks splitting its own columns independently, so
 * the grid never lines up into a perfect checkerboard), cut apart by a mix
 * of wide streets and narrow lanes; each block is filled with buildings
 * terraced along its two long, street-facing edges, not one small box
 * dropped in the middle of a big cell. Squad scale sizes the whole grid to
 * its own target building count (`ScaleParams.sizeByCount`); platoon scale
 * still fills whatever footprint it is given.
 */

import type { CurvedLine } from './pieces'
import { bboxOf, catmullRom, chance, choice, clamp, distance, lShapeLocal, obbOverlap, orientedRectPoints, pointAlongPolyline, range, rangeInt, type Obb } from './math'
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

/**
 * Buildings strung along a road, alternating sides. Each side keeps its
 * own arc-length cursor rather than one shared one: a building on the
 * road's other side sits far enough away laterally (its own setback plus
 * half its depth) that it never needs to clear the one just placed, only
 * the previous building on ITS OWN side does — tracking that separately
 * packs both sides at their own natural spacing instead of one side
 * waiting on the other's, which used to leave most of a road's own length
 * to failed, too-close retries rather than to buildings.
 */
export function standaloneBuildings(
  rnd: () => number,
  roadPoints: Point[],
  count: number,
  scale: ScaleParams,
  opts: { startAt: number; endAt: number; roadWidth: number; clearY?: [number, number] },
): StandaloneBuildings {
  const taken: Obb[] = []
  const buildings: BuildingSpec[] = []
  let [startAt, endAt] = [opts.startAt, opts.endAt]
  if (opts.clearY) {
    const safe = safeArcRange(roadPoints, opts.clearY)
    if (!safe) return { buildings }
    startAt = Math.max(startAt, safe[0])
    endAt = Math.min(endAt, safe[1])
  }
  const cursor: Record<'1' | '-1', number> = { '1': startAt, '-1': startAt }
  let guard = 0
  while (buildings.length < count && guard++ < count * 40) {
    const side = cursor['1'] <= cursor['-1'] ? 1 : -1
    const key = side === 1 ? '1' : '-1'
    const at = cursor[key]
    if (at >= endAt) break
    const { point, angle } = pointAlongPolyline(roadPoints, at)
    const nx = -Math.sin(angle)
    const ny = Math.cos(angle)
    // `faceAngleDeg` below (roadAngle ± 90°) turns the local x-axis to face `(nx, ny)`, the road's own
    // normal, and the local y-axis along it — so `across` (the setback direction) is the local x-extent
    // and `along` (how much of the road's own length the building takes up) is the local y-extent, in
    // the same (w, h) order `footprintPoints`/`orientedRectPoints` already take them in.
    const across = range(rnd, scale.building[0], scale.building[1])
    const along = range(rnd, scale.building[0] * 0.8, scale.building[1] * 0.8)
    const setback = opts.roadWidth / 2 + range(rnd, 0.3, 0.7) * (scale.building[1] / 1.5)
    const cx = point.x + side * nx * (setback + across / 2)
    const cy = point.y + side * ny * (setback + across / 2)
    const faceAngleDeg = (angle * 180) / Math.PI + (side > 0 ? 90 : -90) + range(rnd, -8, 8)
    const candidate: Obb = { cx, cy, w: across + 0.2, h: along + 0.2, angle: (faceAngleDeg * Math.PI) / 180 }
    // Kept clear of the deployment strips (p. 17's 6"), by the building's own worst-case corner, not just its centre.
    let clear = true
    if (opts.clearY) {
      const box = bboxOf(orientedRectPoints(cx, cy, candidate.w, candidate.h, candidate.angle))
      clear = box.y0 >= opts.clearY[0] && box.y1 <= opts.clearY[1]
    }
    if (clear && !taken.some((o) => obbOverlap(o, candidate, 0.15))) {
      taken.push(candidate)
      buildings.push(footprintPoints(cx, cy, across, along, faceAngleDeg, rnd, 0.2))
      cursor[key] = at + along + range(rnd, 0.25, 0.55)
    } else {
      cursor[key] = at + scale.building[0] * 0.3
    }
  }
  return { buildings }
}

// ---------------------------------------------------------------------------
// A street grid whose blocks vary row to row: each row of blocks splits its
// own columns independently (so the grid never lines up into a perfect
// checkerboard the way one shared column layout would), cut apart by a mix
// of streets and narrower lanes, with the odd block merged into a bigger
// neighbour.
// ---------------------------------------------------------------------------

export interface Block {
  x: number
  y: number
  w: number
  h: number
}

interface AxisSplit {
  sizes: number[]
  gaps: number[]
}

/** How often two neighbouring cells merge into one bigger block instead of a street between them. */
/**
 * Merging a block's length axis just makes a longer terraced row — its own
 * fill scales with it. Merging the depth axis instead leaves a much taller
 * block that a two-row terrace still only fronts on its top and bottom
 * edges, wasting most of the extra depth as an oversized yard — so it
 * merges far less often.
 */
const MERGE_CHANCE_LENGTH = 0.18
const MERGE_CHANCE_DEPTH = 0.04

/**
 * `total` inches cut into blocks of `[lo, hi]` each (occasionally two or
 * three merged into one bigger block), separated by gaps `gapPicker` draws
 * one at a time — a lane or a street's width, mixed. Always at least one
 * block; the last one absorbs whatever is left over, so the run fills
 * `total` exactly rather than leaving a dead strip at the end.
 */
function splitAxis(rnd: () => number, total: number, lo: number, hi: number, gapPicker: () => number, mergeChance: number): AxisSplit {
  const sizes: number[] = []
  const gaps: number[] = []
  let used = 0
  while (true) {
    let size = Math.min(range(rnd, lo, hi), Math.max(0, total - used))
    while (chance(rnd, mergeChance) && used + size + lo < total) size = Math.min(size + range(rnd, lo, hi), total - used)
    sizes.push(size)
    used += size
    if (total - used < lo * 0.6) break
    const gap = gapPicker()
    if (used + gap >= total) break
    gaps.push(gap)
    used += gap
  }
  sizes[sizes.length - 1]! += Math.max(0, total - used)
  return { sizes, gaps }
}

/** A lane or a street's width, mixed evenly — the finer gaps that cut a block grid apart alongside the main streets. */
function gapPicker(rnd: () => number, scale: ScaleParams): () => number {
  return () => (chance(rnd, 0.5) ? range(rnd, scale.lane[0], scale.lane[1]) : range(rnd, scale.street[0], scale.street[1]))
}

interface Grid {
  blocks: Block[]
  hBands: CurvedLine[]
  vBands: CurvedLine[]
}

/**
 * Rows across `bounds.h`, each row's own columns split independently across
 * `width` (which may be narrower than `bounds.w`, so a modest settlement
 * does not stretch its streets across the table it is only using part of).
 * `lengthRange`/`depthRange` are a block's long (street-frontage) and short
 * axes — `cityLengthRange`/`cityDepthRange` for a tighter city grid.
 */
function buildGrid(rnd: () => number, origin: Point, width: number, maxHeight: number, lengthRange: readonly [number, number], depthRange: readonly [number, number], scale: ScaleParams): Grid {
  const gaps = gapPicker(rnd, scale)
  const rows = splitAxis(rnd, maxHeight, depthRange[0], depthRange[1], gaps, MERGE_CHANCE_DEPTH)
  const blocks: Block[] = []
  const hBands: CurvedLine[] = []
  const vBands: CurvedLine[] = []
  let y = origin.y
  for (let r = 0; r < rows.sizes.length; r++) {
    const h = rows.sizes[r]!
    const cols = splitAxis(rnd, width, lengthRange[0], lengthRange[1], gaps, MERGE_CHANCE_LENGTH)
    let x = origin.x
    for (let c = 0; c < cols.sizes.length; c++) {
      const w = cols.sizes[c]!
      blocks.push({ x, y, w, h })
      x += w
      if (c < cols.gaps.length) {
        const gw = cols.gaps[c]!
        // Drawn a hair short of the row's own top and bottom, not flush to them: a path's own "inside" test
        // caps its ends round (BRIEF-SETTLE's build renders it that way too), so a band flush to the row
        // edge would bulge its rounded cap into whatever sits just past that edge in the row next door —
        // a different row's own, independently split columns, so nothing there is guaranteed clear of it.
        const inset = Math.min(gw / 2, h * 0.4)
        vBands.push({ points: [{ x: x + gw / 2, y: y + inset }, { x: x + gw / 2, y: y + h - inset }], width: gw })
        x += gw
      }
    }
    y += h
    if (r < rows.gaps.length) {
      const gh = rows.gaps[r]!
      const inset = Math.min(gh / 2, width * 0.4)
      hBands.push({ points: [{ x: origin.x + inset, y: y + gh / 2 }, { x: origin.x + width - inset, y: y + gh / 2 }], width: gh })
      y += gh
    }
  }
  return { blocks, hBands, vBands }
}

// ---------------------------------------------------------------------------
// A block's buildings: platoon packs a plain grid of small cells; squad
// terraces two rows of buildings along a block's long edges, gardens
// between their backs.
// ---------------------------------------------------------------------------

/** Buildings packed into one axis-aligned block, row by row, each with a little rotation jitter (platoon scale). */
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
 * Buildings terraced edge to edge (a small party-wall gap, not a whole
 * building's worth) along one edge of a block, frontage on the block's own
 * boundary: `edgeY`, growing inward by `inward` (+1 down from a top edge,
 * -1 up from a bottom edge). Depth varies building to building — mostly a
 * shallow terrace, occasionally a deeper one — capped so it can never cross
 * into the block's own far edge. Stops at `cap` buildings, so a block only
 * ever contributes what a settlement still needs of its own target count.
 */
function fillStrip(rnd: () => number, x0: number, x1: number, edgeY: number, inward: 1 | -1, maxDepth: number, scale: ScaleParams, taken: Obb[], lChance: number, cap: number): BuildingSpec[] {
  const specs: BuildingSpec[] = []
  const [lo, hi] = scale.building
  let x = x0
  while (x < x1 - lo * 0.55 && specs.length < cap) {
    const w = Math.min(range(rnd, lo, hi), x1 - x)
    if (w < lo * 0.55) break
    const deep = chance(rnd, 0.16)
    const depth = Math.min(range(rnd, lo * 0.62, hi * 0.72) * (deep ? range(rnd, 1.3, 1.6) : 1), maxDepth)
    const cx = x + w / 2
    const cy = edgeY + (inward * depth) / 2
    const obb: Obb = { cx, cy, w, h: depth, angle: 0 }
    if (depth > lo * 0.4 && !taken.some((o) => obbOverlap(o, obb, 0.08))) {
      taken.push(obb)
      specs.push(footprintPoints(cx, cy, w, depth, 0, rnd, lChance))
    }
    x += w + range(rnd, 0.1, 0.3)
  }
  return specs
}

/**
 * A block's own two terraced rows, backs to the middle: buildings line the
 * top and bottom edges (a block is always built wider than it is deep, see
 * `buildGrid`'s length/depth axes), a garden's width of open ground between
 * their backs — the yards BRIEF-SETTLE calls for, sometimes walled or
 * hedged (`wallLine`, added by the caller). Stops once `cap` buildings are
 * down, so the settlement's own running total governs, not the block's raw
 * capacity.
 */
function terraceBlock(rnd: () => number, block: Block, scale: ScaleParams, taken: Obb[], lChance: number, cap: number): { specs: BuildingSpec[]; yard: { y0: number; y1: number } | null } {
  const margin = 0.18
  const x0 = block.x + margin
  const x1 = block.x + block.w - margin
  const usableH = block.h - margin * 2
  const minYard = Math.min(1.1, usableH * 0.18)
  const half = (usableH - minYard) / 2
  if (half < scale.building[0] * 0.45 || cap <= 0) {
    // Too shallow for two backed rows: one row taking most of the depth instead.
    const specs = fillStrip(rnd, x0, x1, block.y + margin, 1, Math.max(0.4, usableH - 0.3), scale, taken, lChance, cap)
    return { specs, yard: null }
  }
  const topCap = Math.ceil(cap / 2)
  const top = fillStrip(rnd, x0, x1, block.y + margin, 1, half, scale, taken, lChance, topCap)
  const bottom = fillStrip(rnd, x0, x1, block.y + block.h - margin, -1, half, scale, taken, lChance, cap - top.length)
  return { specs: [...top, ...bottom], yard: { y0: block.y + margin + half, y1: block.y + block.h - margin - half } }
}

/**
 * A jagged, broken outline in place of a standing building: what an
 * artillery mission or a fight leaves (Dirtside p. 46, Stargrunt p. 57).
 * BRIEF-SETTLE: "cut notches, not lobes" — the building's own corners stay
 * put (the ruin still reads as that footprint), each edge between them bitten
 * into once or twice, a hand-broken outline rather than the smooth,
 * star-shaped blob a radial-noise wobble gives. Every bite is inward only —
 * a building is placed with only a thin safety margin off its street or its
 * neighbour, so a ruin standing in its place must never reach out past that
 * footprint; the renderer draws the "rubble spilling past it" BRIEF-SETTLE
 * also asks for as a purely visual halo instead (`terrain.tsx`'s `Ruin`).
 */
function ruinOutline(footprint: readonly Point[], rnd: () => number, size: number): Point[] {
  const n = footprint.length
  const edges = footprint.map((a, i) => distance(a, footprint[(i + 1) % n]!))
  // One bound for every bite, from the TIGHTEST part of the whole footprint (an L-shape's own notch corner
  // is close quarters even when the building's overall size is not) — so a bite anywhere can never reach far
  // enough to cross a nearby edge, wherever the nearest one happens to be.
  const cap = Math.min(size, ...edges) * 0.17
  const out: Point[] = []
  for (let i = 0; i < n; i++) {
    const a = footprint[i]!
    const b = footprint[(i + 1) % n]!
    out.push(a)
    const len = edges[i]!
    if (len < size * 0.28) continue
    const ex = b.x - a.x
    const ey = b.y - a.y
    // Outward unit normal for this (consistently wound) footprint: rotate the edge vector -90°.
    const nx = ey / len
    const ny = -ex / len
    const cuts = rangeInt(rnd, 1, len > size * 0.75 ? 2 : 1)
    for (let s = 1; s <= cuts; s++) {
      const t = s / (cuts + 1)
      const base = { x: a.x + ex * t, y: a.y + ey * t }
      const mag = -range(rnd, cap * 0.35, cap * 0.8)
      out.push({ x: base.x + nx * mag, y: base.y + ny * mag })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// The urban area's own outline: a padded box around the block grid's
// bounding box, jittered outward only (so it is guaranteed to contain every
// block, however the jitter falls — see settlement.test.ts), with a few
// extra points along each side for a lightly irregular, hand-drawn edge.
// `outline[0]`/`outline[1]` (a corner, then the middle of the top edge) are
// a fixed contract `src/campaign/ground.ts` reads its town's front edge
// off; every point after that is free to add texture.
// ---------------------------------------------------------------------------

export function urbanOutline(bounds: { x: number; y: number; w: number; h: number }, rnd: () => number, pad: number, jitter: number): Point[] {
  const x0 = bounds.x - pad
  const x1 = bounds.x + bounds.w + pad
  const y0 = bounds.y - pad
  const y1 = bounds.y + bounds.h + pad
  const midx = (x0 + x1) / 2
  const midy = (y0 + y1) / 2
  const out = () => rnd() * jitter
  // Two extra points along a side, each independently jittered outward, between its two named ends.
  const along = (a: Point, b: Point): Point[] => [0.35, 0.68].map((t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }))
  const corner = (x: number, y: number): Point => ({ x: x + (x < midx ? -1 : 1) * out(), y: y + (y < midy ? -1 : 1) * out() })
  const top: Point = { x: midx, y: y0 - out() }
  const nw = corner(x0, y0)
  const ne = corner(x1, y0)
  const se = corner(x1, y1)
  const sw = corner(x0, y1)
  const right: Point = { x: x1 + out(), y: midy }
  const bottom: Point = { x: midx, y: y1 + out() }
  const left: Point = { x: x0 - out(), y: midy }
  return [nw, top, ...along(top, ne), ne, ...along(ne, right), right, ...along(right, se), se, bottom, ...along(bottom, sw), sw, ...along(sw, left), left, ...along(left, nw)]
}

// ---------------------------------------------------------------------------
// A town or a city: the block grid, its blocks terraced or packed with
// buildings (some knocked to rubble), a main avenue that bends and enters
// and leaves by the settlement's own edges, and the outline that encloses
// all of it.
// ---------------------------------------------------------------------------

export interface SettlementPiece {
  kind: 'street' | 'building' | 'rubble' | 'wall' | 'hedge'
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

/** How many buildings (and rubble) a style is built up to, at squad scale — BRIEF-SETTLE's own counts on a 48×36 table. */
function targetCount(rnd: () => number, style: 'village' | 'town' | 'city', scale: ScaleParams): number {
  const [lo, hi] = style === 'city' ? scale.cityBuildings : style === 'town' ? scale.townBuildings : scale.villageBuildings
  return rangeInt(rnd, lo, hi)
}

interface FilledGrid {
  grid: Grid
  pieces: SettlementPiece[]
  squareBlock: Block | null
  placed: number
}

/** The block grid over `origin`/`width`/`height`, its streets, and every block's buildings (or a city's rubble) — one settlement's worth of pieces, `target` buildings and no more once `scale.sizeByCount`. */
function fillGrid(rnd: () => number, origin: Point, width: number, height: number, lengthRange: readonly [number, number], depthRange: readonly [number, number], scale: ScaleParams, style: 'village' | 'town' | 'city', target: number): FilledGrid {
  const grid = buildGrid(rnd, origin, width, height, lengthRange, depthRange, scale)
  const pieces: SettlementPiece[] = []
  for (const b of [...grid.hBands, ...grid.vBands]) pieces.push({ kind: 'street', points: b.points, width: b.width })

  const squareIndex = grid.blocks.length > 2 ? Math.floor(grid.blocks.length / 2) : -1
  const ruinBlockChance = style === 'city' ? 0.16 : 0
  const ruinPieceChance = style === 'city' ? 0.07 : style === 'town' ? 0.02 : 0
  const fillChance = style === 'city' ? 0.92 : style === 'village' ? 0.6 : 0.85
  const lChance = style === 'city' ? 0.32 : style === 'village' ? 0.15 : 0.22
  const taken: Obb[] = []
  let squareBlock: Block | null = null
  let placed = 0
  grid.blocks.forEach((block, i) => {
    if (i === squareIndex) {
      squareBlock = block
      return
    }
    if (scale.sizeByCount && placed >= target) return
    const ruinedBlock = chance(rnd, ruinBlockChance)
    let specs: BuildingSpec[]
    let yard: { y0: number; y1: number } | null = null
    if (scale.sizeByCount) {
      const cap = Math.max(0, target - placed)
      const t = terraceBlock(rnd, block, scale, taken, lChance, cap)
      specs = t.specs
      yard = t.yard
    } else {
      specs = packBlock(rnd, block, scale, taken, { lChance, fillChance, margin: scale.building[0] * 0.15 })
    }
    placed += specs.length
    for (const spec of specs) {
      const ruined = ruinedBlock || chance(rnd, ruinPieceChance)
      if (ruined) {
        const box = bboxOf(spec.points)
        pieces.push({ kind: 'rubble', points: ruinOutline(spec.points, rnd, Math.min(box.x1 - box.x0, box.y1 - box.y0)) })
      } else {
        pieces.push({ kind: 'building', points: spec.points })
      }
    }
    // A garden wall or hedge behind the terraces, bounding the yard between their backs (Stargrunt pp. 12–13; squad scale only).
    if (yard && scale.wallsAndHedges && chance(rnd, 0.55)) {
      const my = (yard.y0 + yard.y1) / 2
      const kind = chance(rnd, 0.5) ? 'wall' : 'hedge'
      pieces.push({ kind, points: [{ x: block.x + 0.2, y: my }, { x: block.x + block.w - 0.2, y: my }], width: 0.15 })
    }
  })
  return { grid, pieces, squareBlock, placed }
}

export function buildSettlement(rnd: () => number, bounds: { x: number; y: number; w: number; h: number }, style: 'village' | 'town' | 'city', scale: ScaleParams): Settlement {
  // A town sized to its own (smaller) target count still needs tight blocks to stay compact rather than
  // spreading nearly as wide as a city's own envelope to reach that count with fewer, bigger blocks — so
  // squad always builds with the city's own tighter block axes; platoon, filling whatever it is given rather
  // than sizing to a count, keeps the visual difference BRIEF-TERRAIN's model draws between a town's blocks
  // and a city's own smaller ones.
  const useCityBlocks = style === 'city' || scale.sizeByCount
  const lengthRange = useCityBlocks ? scale.cityBlockLength : scale.blockLength
  const depthRange = useCityBlocks ? scale.cityBlockDepth : scale.blockDepth
  const gapMid = (scale.lane[0] + scale.lane[1] + scale.street[0] + scale.street[1]) / 4
  const target = scale.sizeByCount ? targetCount(rnd, style, scale) : Number.POSITIVE_INFINITY

  let width = bounds.w
  let filled: FilledGrid
  if (scale.sizeByCount) {
    // Grown, not guessed: a real grid is built and filled at an honest width, widened and tried again
    // whenever it falls short — the depth band is used in full from the start (rows are cheap; the main
    // battle area's width is the one thing actually short of room), so only the width that this particular
    // target and this particular seed's own block sizes really need ever gets built. This is what keeps a
    // town's own footprint down near its own building count instead of stretching towards a city's (BRIEF-
    // SETTLE's complaint that a squad town's main road "cuts straight across the whole table").
    const avgLen = (lengthRange[0] + lengthRange[1]) / 2
    width = Math.min(bounds.w, avgLen * 1.5 + gapMid)
    let guard = 0
    while (true) {
      filled = fillGrid(rnd, bounds, width, bounds.h, lengthRange, depthRange, scale, style, target)
      if (filled.placed >= target || width >= bounds.w - 1e-6 || guard++ > 14) break
      width = Math.min(bounds.w, width + avgLen + gapMid)
    }
    // A random slice of whatever width went unused, so a town does not always sit flush against the
    // envelope's own left edge — pure cosmetics: nothing about capacity depends on where it lands.
    const dx = range(rnd, 0, Math.max(0, bounds.w - width))
    if (dx > 0) {
      for (const b of filled.grid.blocks) b.x += dx
      for (const p of filled.pieces) p.points = p.points.map((pt) => ({ x: pt.x + dx, y: pt.y }))
    }
  } else {
    filled = fillGrid(rnd, bounds, bounds.w, bounds.h, lengthRange, depthRange, scale, style, target)
  }
  const { grid, pieces, squareBlock } = filled

  // The settlement's own bounding box is the block grid's tight bbox, not the (possibly much larger) placement
  // box the caller offered — squad's own target-sized grid should read as its own size, not the whole table
  // (BRIEF-SETTLE: no more "cuts straight across the whole table").
  const tight = grid.blocks.length ? bboxOf(grid.blocks.flatMap((b) => [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h }])) : { x0: bounds.x, x1: bounds.x + bounds.w, y0: bounds.y, y1: bounds.y + bounds.h }
  const realBounds = { x: tight.x0, y: tight.y0, w: tight.x1 - tight.x0, h: tight.y1 - tight.y0 }
  const pad = scale.outlinePad
  const outline = urbanOutline(realBounds, rnd, pad, pad * 0.8)

  // The avenue enters and leaves by the settlement's own edges — two points on two different sides, not always
  // opposite corners — and bends properly (two inner control points), capped to `scale.avenue`'s own width.
  const perim = { n: { x: range(rnd, realBounds.x, realBounds.x + realBounds.w), y: realBounds.y }, s: { x: range(rnd, realBounds.x, realBounds.x + realBounds.w), y: realBounds.y + realBounds.h }, w: { x: realBounds.x, y: range(rnd, realBounds.y, realBounds.y + realBounds.h) }, e: { x: realBounds.x + realBounds.w, y: range(rnd, realBounds.y, realBounds.y + realBounds.h) } }
  const sides = ['n', 's', 'w', 'e'] as const
  const from = choice(rnd, sides)
  const to = choice(rnd, sides.filter((s) => s !== from))
  const a = perim[from]
  const b = perim[to]
  const bendAmt = Math.min(realBounds.w, realBounds.h) * range(rnd, 0.12, 0.22)
  const mx1 = a.x + (b.x - a.x) * 0.33
  const my1 = a.y + (b.y - a.y) * 0.33
  const mx2 = a.x + (b.x - a.x) * 0.67
  const my2 = a.y + (b.y - a.y) * 0.67
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const nx = -(b.y - a.y) / len
  const ny = (b.x - a.x) / len
  const k1 = range(rnd, -bendAmt, bendAmt)
  const k2 = range(rnd, -bendAmt, bendAmt)
  const raw = catmullRom([a, { x: mx1 + nx * k1, y: my1 + ny * k1 }, { x: mx2 + nx * k2, y: my2 + ny * k2 }, b], 10)
  const avenueWidth = range(rnd, scale.avenue[0], scale.avenue[1])
  const avenue: CurvedLine = { points: raw.map((p) => ({ x: clamp(p.x, realBounds.x, realBounds.x + realBounds.w), y: clamp(p.y, realBounds.y, realBounds.y + realBounds.h) })), width: avenueWidth }

  return { outline, bounds: realBounds, pieces, avenue, squareBlock }
}
