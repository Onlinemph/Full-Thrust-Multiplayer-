/**
 * The ground generator: a seeded spread of irregular terrain for every
 * style (`none`, `light`, `dense`, `village`, `town`, `city`) at both
 * scales (BRIEF-TERRAIN's "the model"). `randomTerrain` in `../skirmish`
 * is a thin wrapper over `generateGroundTerrain`; `../../../campaign/
 * ground.ts` calls `buildSettlement` directly to plant a colony's own town.
 *
 * Every draw comes from the `DiceStream` passed in, in a fixed order, so
 * the same seed always lays out the same table (p. 17's replay guarantee).
 */

import { draw, type DiceStream } from '../../dice'
import type { TerrainScale, TerrainStyle } from '../skirmish'
import type { Point, Shape, TerrainFeature } from '../types'
import { bboxOf, chance, distance, range, rangeInt } from './math'
import { fieldQuad, pieceOutline, riverLine, roadLine } from './pieces'
import { SCALE, type ScaleParams } from './scale'
import { buildSettlement, standaloneBuildings, type Settlement } from './settlement'

/**
 * Matches `game.ts`'s `DEPLOY_DEPTH` (p. 17): the 6" nearest each baseline
 * stays clear of anything but rural pieces and roads, so this module keeps
 * its own copy rather than import the engine's — a generator has no
 * business depending on the rules module that plays the result.
 */
export const DEPLOYMENT_STRIP = 6

type RuralKind = 'light-woods' | 'dense-woods' | 'hills' | 'rough' | 'light-scrub' | 'swamp' | 'cultivated'

/** The rural kinds `light`/`dense`/`village` cycle through, in the old generator's own order (p. 25–26's terrain list). */
const RURAL_KINDS: readonly RuralKind[] = ['light-woods', 'hills', 'rough', 'light-woods', 'light-scrub', 'dense-woods', 'hills', 'cultivated', 'swamp', 'light-woods', 'rough']

const PIECE_LABEL: Record<Exclude<RuralKind, 'cultivated'>, string> = { 'light-woods': 'woods', 'dense-woods': 'woods', hills: 'hill', rough: 'rough ground', 'light-scrub': 'scrub', swamp: 'swamp' }

/**
 * A built `Settlement` (from `buildSettlement`) as real `TerrainFeature`s:
 * the enclosing `urban` area under `id`, then every piece `partOf` it —
 * streets, buildings, a city's rubble — a park in its open square/plaza
 * block if it has one, and last the main avenue, not `partOf` anything, so
 * a major highway keeps its own going straight through the town (p. 26).
 * Exported so `src/campaign/ground.ts` can plant a colony's own town with
 * the same shapes `generateGroundTerrain`'s `town`/`city` styles use.
 */
export function settlementFeatures(id: string, label: string, st: Settlement, nextId: (stem: string) => string): TerrainFeature[] {
  const out: TerrainFeature[] = [{ id, terrain: 'urban', shape: { kind: 'polygon', points: st.outline }, label }]
  for (const piece of st.pieces) {
    if (piece.kind === 'street') out.push({ id: nextId('street'), terrain: 'road', shape: { kind: 'path', points: piece.points, width: piece.width! }, partOf: id })
    else if (piece.kind === 'building') out.push({ id: nextId('building'), terrain: 'building', shape: { kind: 'polygon', points: piece.points }, partOf: id })
    else out.push({ id: nextId('rubble'), terrain: 'rubble', shape: { kind: 'polygon', points: piece.points }, partOf: id })
  }
  if (st.squareBlock) {
    const b = st.squareBlock
    const inset = Math.min(b.w, b.h) * 0.12
    const park: Shape = { kind: 'rect', x: b.x + inset, y: b.y + inset, width: b.w - inset * 2, height: b.h - inset * 2 }
    // Not `partOf`: a real patch of ground, so both games read the square as an open park/plaza, not a building.
    out.push({ id: nextId('park'), terrain: 'rough', shape: park, label: 'park' })
  }
  out.push({ id: nextId('avenue'), terrain: 'road', majorHighway: true, shape: { kind: 'path', points: st.avenue.points, width: st.avenue.width }, label: 'high street' })
  return out
}

export function generateGroundTerrain(stream: DiceStream, width: number, depth: number, style: TerrainStyle, scaleName: TerrainScale = 'platoon'): TerrainFeature[] {
  if (style === 'none') return []
  const rnd = () => draw(stream)
  const scale = SCALE[scaleName]
  const features: TerrainFeature[] = []
  let counter = 0
  const nextId = (stem: string) => `${stem}-${(counter += 1)}`

  // A loose registry of circular clearances (an area feature's centre and inflated radius), so later pieces —
  // rural or built-up — keep apart from earlier ones without a full polygon-overlap test (features may kiss, not stack).
  const placedAreas: { x: number; y: number; r: number }[] = []
  const fitsArea = (cx: number, cy: number, r: number, pad = 0.6) => placedAreas.every((p) => distance({ x: cx, y: cy }, { x: p.x, y: p.y }) > r + p.r + pad)
  const reserve = (cx: number, cy: number, r: number) => placedAreas.push({ x: cx, y: cy, r })

  function blobFeature(kind: Exclude<RuralKind, 'cultivated'>, cx: number, cy: number, r: number): TerrainFeature {
    const squash = range(rnd, kind === 'hills' ? 0.8 : 0.7, 1)
    const noise = kind === 'hills' ? 0.22 : kind === 'light-scrub' ? 0.4 : 0.32
    return { id: nextId(kind), terrain: kind, shape: { kind: 'polygon', points: pieceOutline(cx, cy, r, r * squash, rnd, { noise }) }, label: PIECE_LABEL[kind] }
  }

  function fieldFeature(cx: number, cy: number, fw: number, fh: number): { feature: TerrainFeature; points: Point[] } {
    const points = fieldQuad(cx, cy, fw, fh, rnd)
    return { feature: { id: nextId('field'), terrain: 'cultivated', shape: { kind: 'polygon', points }, label: 'fields' }, points }
  }

  /** A wall or a hedge tracing a field's own boundary, offset out a little (Stargrunt pp. 12–13; squad scale only). */
  function hedgeAround(points: readonly Point[]) {
    if (!scale.wallsAndHedges || !chance(rnd, 0.4)) return
    const c = { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length }
    const out = 0.3
    const ring = points.map((p) => {
      const d = distance(p, c) || 1
      return { x: p.x + ((p.x - c.x) / d) * out, y: p.y + ((p.y - c.y) / d) * out }
    })
    const closed = [...ring, ring[0]!]
    const terrain = chance(rnd, 0.5) ? 'wall' : 'hedge'
    features.push({ id: nextId(terrain), terrain, shape: { kind: 'path', points: closed, width: 0.15 } })
  }

  /** Scatters `count` area pieces, cycling `kinds`, each clear of every area feature placed so far. */
  function scatterPieces(count: number, kinds: readonly RuralKind[]) {
    let placed = 0
    let guard = 0
    while (placed < count && guard++ < count * 200) {
      const kind = kinds[placed % kinds.length]!
      if (kind === 'cultivated') {
        const [flo, fhi] = scale.field
        const fw = range(rnd, flo * 1.7, fhi * 1.9)
        const fh = range(rnd, flo * 1.3, fhi * 1.5)
        const half = Math.hypot(fw, fh) / 2
        if (half * 2 + 2 >= Math.min(width, depth)) continue
        const cx = range(rnd, half + 1, width - half - 1)
        const cy = range(rnd, half + 1, depth - half - 1)
        if (!fitsArea(cx, cy, half, 0.3)) continue
        reserve(cx, cy, half)
        const { feature, points } = fieldFeature(cx, cy, fw, fh)
        features.push(feature)
        hedgeAround(points)
        placed++
        continue
      }
      const [lo, hi] = scale.piece
      const r = range(rnd, lo, hi)
      // Rural pieces have no non-overlap rule to keep (only a settlement's own buildings and streets do): a
      // looser clearance than `BLOB_OVERSHOOT`'s exact worst case is enough to keep them apart in the ordinary
      // case while still fitting the model's own 9–12-piece "dense" count on this table.
      const clear = r * 1.15 + 0.3
      if (clear * 2 >= Math.min(width, depth)) continue
      const cx = range(rnd, clear, width - clear)
      const cy = range(rnd, clear, depth - clear)
      if (!fitsArea(cx, cy, clear, 0.3)) continue
      reserve(cx, cy, clear)
      features.push(blobFeature(kind, cx, cy, r))
      placed++
    }
  }

  function roadFeature(opts: { x?: number } = {}): { feature: TerrainFeature; points: Point[] } {
    const line = roadLine(rnd, width, depth, opts)
    return { feature: { id: nextId('road'), terrain: 'road', shape: { kind: 'path', points: line.points, width: line.width }, label: 'road' }, points: line.points }
  }

  function riverFeatures(): { features: TerrainFeature[]; startX: number } {
    const r = riverLine(rnd, width, depth)
    const river: TerrainFeature = { id: nextId('river'), terrain: 'river', shape: { kind: 'path', points: r.points, width: r.width }, label: 'river' }
    const { point, angle } = r.ford
    const nx = -Math.sin(angle)
    const ny = Math.cos(angle)
    const half = r.width / 2 + 0.6
    const ford: TerrainFeature = {
      id: nextId('ford'),
      terrain: 'ford',
      shape: { kind: 'path', points: [{ x: point.x + nx * half, y: point.y + ny * half }, { x: point.x - nx * half, y: point.y - ny * half }], width: 0.6 },
      label: 'ford',
    }
    return { features: [river, ford], startX: r.points[0]!.x }
  }

  /** Standalone buildings strung along a road, kept clear of the deployment strips, each reserved into `placedAreas`. */
  function loneBuildings(roadPoints: Point[], count: number, roadLen: number): TerrainFeature[] {
    const { buildings } = standaloneBuildings(rnd, roadPoints, count, scale, {
      startAt: roadLen * 0.08,
      endAt: roadLen * 0.92,
      roadWidth: 1,
      clearY: [DEPLOYMENT_STRIP + 0.5, depth - DEPLOYMENT_STRIP - 0.5],
    })
    return buildings.map((b) => {
      const box = bboxOf(b.points)
      reserve((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, Math.hypot(box.x1 - box.x0, box.y1 - box.y0) / 2)
      return { id: nextId('building'), terrain: 'building' as const, shape: { kind: 'polygon', points: b.points }, label: 'building' }
    })
  }

  function pushSettlement(id: string, label: string, st: Settlement) {
    features.push(...settlementFeatures(id, label, st, nextId))
  }

  if (style === 'light' || style === 'dense') {
    const count = style === 'light' ? rangeInt(rnd, 5, 7) : rangeInt(rnd, 9, 12)
    let riverStartX: number | undefined
    if (style === 'dense' && chance(rnd, 0.7)) {
      const river = riverFeatures()
      features.push(...river.features)
      riverStartX = river.startX
    }
    scatterPieces(count, RURAL_KINDS)
    const { feature: road, points: roadPoints } = roadFeature(riverStartX === undefined ? {} : { x: riverStartX })
    features.push(road)
    const roadLen = roadPoints.reduce((s, p, i) => (i ? s + distance(p, roadPoints[i - 1]!) : 0), 0)
    if (style === 'light' && chance(rnd, 0.4)) features.push(...loneBuildings(roadPoints, 1, roadLen))
    if (style === 'dense') features.push(...loneBuildings(roadPoints, rangeInt(rnd, 2, 4), roadLen))
  } else if (style === 'village') {
    scatterPieces(rangeInt(rnd, 5, 7), RURAL_KINDS)
    const { feature: road, points: roadPoints } = roadFeature({ x: range(rnd, width * 0.35, width * 0.65) })
    const roadLen = roadPoints.reduce((s, p, i) => (i ? s + distance(p, roadPoints[i - 1]!) : 0), 0)
    features.push(...loneBuildings(roadPoints, rangeInt(rnd, 4, 8), roadLen))
    features.push(road)
    scatterPieces(rangeInt(rnd, 1, 2), ['cultivated'])
  } else {
    // town or city: one settlement, its bounds chosen to keep clear of both deployment strips (p. 17's 6").
    // Matches `buildSettlement`'s own `urbanOutline` call: pad plus its outward-only jitter (0.8 × pad), with a
    // small safety margin so a Catmull-Rom sample along the avenue can never overshoot into the strip either.
    const padMax = scale.outlinePad * 1.85
    const edgeMargin = 1.5
    let bounds: { x: number; y: number; w: number; h: number }
    if (style === 'city') {
      // "Across most of the main battle area but not the deployment strips": the full width, and the whole
      // strip-to-strip band less the safety margin above — never widened past that even for a very deep table.
      const w = Math.max(0, width - edgeMargin * 2)
      const h = Math.max(0, depth - DEPLOYMENT_STRIP * 2 - padMax * 2)
      bounds = { x: edgeMargin, y: DEPLOYMENT_STRIP + padMax, w, h }
    } else {
      const w = Math.min(range(rnd, scale.settlement[0], scale.settlement[1]), Math.max(0, width - edgeMargin * 2))
      // Capped to what the strip-to-strip band actually has room for — drawing `h` from the settlement range
      // alone (as wide as 33.6" at squad scale) and only clamping `y` afterwards let the town's *far* edge run
      // past the strip even though its near edge stayed clear of it.
      const availableH = Math.max(0, depth - DEPLOYMENT_STRIP * 2 - padMax * 2)
      const h = Math.min(range(rnd, scale.settlement[0] * 0.6, scale.settlement[1] * 0.8), availableH)
      const x = range(rnd, edgeMargin, Math.max(edgeMargin, width - edgeMargin - w))
      const yLo = DEPLOYMENT_STRIP + padMax
      const yHi = Math.max(yLo, depth - DEPLOYMENT_STRIP - padMax - h)
      bounds = { x, y: range(rnd, yLo, yHi), w, h }
    }
    const id = nextId(style)
    const st = buildSettlement(rnd, bounds, style, scale)
    pushSettlement(id, style, st)
    reserve(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, Math.hypot(bounds.w, bounds.h) / 2 + padMax)
    if (style === 'town') scatterPieces(rangeInt(rnd, 2, 4), ['light-woods', 'hills', 'rough', 'cultivated'])
    else if (chance(rnd, 0.6)) features.push(...riverFeatures().features)
  }

  return features
}

export type { ScaleParams }
export { SCALE }
