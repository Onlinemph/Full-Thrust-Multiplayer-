/**
 * Turning a table `Shape` (circle, rect, path or polygon — `dirtside/table/
 * types.ts`) into real geometry standing on the board: a flat-topped prism
 * for a hill terrace or a building's walls, a flat slab for a roof cap or a
 * paved patch, a ribbon for a road/river/wall/hedge's centreline-and-width,
 * and a gabled roof for a rectangular building.
 *
 * Every shape is read exactly as the engine and the 2D map already read it
 * (`insideShape`, `insetShape`, `depthInside` — `dirtside/table/terrain.ts`
 * and `ui/dirtside/map/geometry.ts`); this file only ever turns their output
 * into a `THREE.BufferGeometry`, in table inches, laid flat on the board
 * before anything raises it.
 *
 * `toWorld`'s mapping is world (x, y, z) = (table x, height, table y). A
 * `THREE.Shape` extrudes along its local Z, so every helper here builds the
 * 2D shape as (x, -y) and rotates the result -90° about X — that turns
 * local Z (the extrusion's own height) into world Y and local -Y (this
 * shape's own y before the flip) into world Z, i.e. exactly `toWorld`. Winds
 * of either hand happen (a rect and a polygon are not wound the same way by
 * every generator), so every surface here is meant to be drawn with a
 * double-sided material rather than chase that by hand.
 */
import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape as ThreeShape, ShapeGeometry, Vector2, Vector3 } from 'three'
import type { Point, Shape } from '../../dirtside/table/types'

const CIRCLE_SEGMENTS = 28

/** The shape's own outline as table points — what an extrude or a ribbon is built from. */
export function footprintPoints(shape: Shape): Point[] {
  switch (shape.kind) {
    case 'circle': {
      const out: Point[] = []
      for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
        const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2
        out.push({ x: shape.centre.x + Math.cos(a) * shape.radius, y: shape.centre.y + Math.sin(a) * shape.radius })
      }
      return out
    }
    case 'rect':
      return [
        { x: shape.x, y: shape.y },
        { x: shape.x + shape.width, y: shape.y },
        { x: shape.x + shape.width, y: shape.y + shape.height },
        { x: shape.x, y: shape.y + shape.height },
      ]
    case 'polygon':
      return shape.points
    case 'path':
      return ribbonPolygon(shape.points, shape.width)
  }
}

/** A polyline of the given width as a closed outline: one side out, the other back — a road, a river, a wall, a hedge. */
export function ribbonPolygon(points: readonly Point[], width: number): Point[] {
  if (points.length < 2) return []
  const half = width / 2
  const left: Point[] = []
  const right: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const prev = points[i - 1] ?? points[i]!
    const next = points[i + 1] ?? points[i]!
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const p = points[i]!
    left.push({ x: p.x + nx * half, y: p.y + ny * half })
    right.push({ x: p.x - nx * half, y: p.y - ny * half })
  }
  return [...left, ...right.reverse()]
}

function shape2D(points: readonly Point[]): ThreeShape {
  return new ThreeShape(points.map((p) => new Vector2(p.x, -p.y)))
}

/** A flat-topped, flat-bottomed prism standing on the board from `baseY` to `topY` (a hill terrace, a building's walls). */
export function prism(points: readonly Point[], baseY: number, topY: number): BufferGeometry {
  const height = topY - baseY
  if (points.length < 3 || height <= 1e-6) return new BufferGeometry()
  const geo = new ExtrudeGeometry(shape2D(points), { depth: height, bevelEnabled: false, curveSegments: 1 })
  geo.rotateX(-Math.PI / 2)
  if (baseY !== 0) geo.translate(0, baseY, 0)
  geo.computeVertexNormals()
  return geo
}

/** A flat slab at one height — a roof cap, a paved patch, a stretch of road or river surface. */
export function flatSlab(points: readonly Point[], y: number): BufferGeometry {
  if (points.length < 3) return new BufferGeometry()
  const geo = new ShapeGeometry(shape2D(points))
  geo.rotateX(-Math.PI / 2)
  if (y !== 0) geo.translate(0, y, 0)
  geo.computeVertexNormals()
  return geo
}

/**
 * A gabled roof over a (near-)rectangular building: the ridge runs parallel
 * to the footprint's longer pair of edges, at the midline between them,
 * lifted `ridgeY` above the four corners at `eaveY` — two sloped rectangles
 * and the two triangular gable ends they leave at each short edge.
 */
export function gableRoof(corners: readonly [Point, Point, Point, Point], eaveY: number, ridgeY: number): BufferGeometry {
  const [p0, p1, p2, p3] = corners
  const len01 = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  const len12 = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  // The ridge runs parallel to the longer pair of edges (`eaveA`/`eaveB`, in perimeter order), each end at
  // the midpoint of one of the two shorter edges — `ridgeNearA` beside `eaveA`'s second corner, `ridgeNearB`
  // beside its first, the same pairing `eaveB`'s own corners fall into (checked for both edge pairings: a
  // quad's opposite corners share a gable edge with the same rotational sense either way round).
  const long01 = len01 >= len12
  const eaveA: readonly [Point, Point] = long01 ? [p0, p1] : [p1, p2]
  const eaveB: readonly [Point, Point] = long01 ? [p2, p3] : [p3, p0]
  const ridgeNearB = long01 ? mid(p3, p0) : mid(p0, p1)
  const ridgeNearA = long01 ? mid(p1, p2) : mid(p2, p3)
  const v = (p: Point, y: number) => new Vector3(p.x, y, p.y)
  const a0 = v(eaveA[0], eaveY)
  const a1 = v(eaveA[1], eaveY)
  const b0 = v(eaveB[0], eaveY)
  const b1 = v(eaveB[1], eaveY)
  const rA = v(ridgeNearA, ridgeY)
  const rB = v(ridgeNearB, ridgeY)
  // Slope over `eaveA` (quad a0,a1,rA,rB), the opposite slope over `eaveB` (quad b0,b1,rB,rA), and the two
  // triangular gable ends (each a short edge's two corners meeting the ridge point raised above its middle).
  const tris: Vector3[] = [a0, a1, rA, a0, rA, rB, b0, b1, rB, b0, rB, rA, a1, b0, rA, b1, a0, rB]
  const pos = new Float32Array(tris.length * 3)
  tris.forEach((p, i) => {
    pos[i * 3] = p.x
    pos[i * 3 + 1] = p.y
    pos[i * 3 + 2] = p.z
  })
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  return geo
}

/** A stable number from a feature id (`ui/dirtside/map/geometry.ts`'s own `hash`), so its clutter stays put between rebuilds. */
export function hashId(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A small seeded generator for decoration only (never for a rule) — `ui/dirtside/map/geometry.ts`'s own `decorRandom`. */
export function decorRandom(seed: number): () => number {
  let s = seed || 1
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A footprint's own centroid — what `terrain.ts` looks `heightAt` up at to stand a feature on a hill's terrace. */
export function centroidOf(points: readonly Point[]): Point {
  let x = 0
  let y = 0
  for (const p of points) {
    x += p.x
    y += p.y
  }
  return { x: x / points.length, y: y / points.length }
}

/**
 * A shape shrunk by `by` inches, or null once nothing is left of it —
 * `ui/dirtside/map/geometry.ts`'s own `insetShape`, copied rather than
 * imported so this folder never depends on Dirtside's own UI files: every
 * vertex scales toward the centroid by the same fraction, the cheap
 * stand-in the 2D map already uses for its own contour rings, which never
 * crosses itself for the star-shaped outlines the generator produces. Used
 * here to build a hill's terraces (`terrain.ts`) exactly as the 2D map
 * builds its contour lines.
 */
export function insetShape(shape: Shape, by: number): Shape | null {
  if (shape.kind === 'circle') return shape.radius - by > 0.05 ? { ...shape, radius: shape.radius - by } : null
  if (shape.kind === 'rect') return shape.width - 2 * by > 0.1 && shape.height - 2 * by > 0.1 ? { kind: 'rect', x: shape.x + by, y: shape.y + by, width: shape.width - 2 * by, height: shape.height - 2 * by } : null
  if (shape.kind === 'polygon') {
    const c = centroidOf(shape.points)
    const avgR = shape.points.reduce((s, p) => s + Math.hypot(p.x - c.x, p.y - c.y), 0) / shape.points.length
    if (avgR - by < 0.3) return null
    const scale = (avgR - by) / avgR
    return { kind: 'polygon', points: shape.points.map((p) => ({ x: c.x + (p.x - c.x) * scale, y: c.y + (p.y - c.y) * scale })) }
  }
  return null
}

/**
 * A geometry stripped down to `position` + `normal` alone, de-indexed —
 * what every geometry entering a `BufferGeometryUtils.mergeGeometries()`
 * bucket needs (R5): `prism`/`flatSlab` (indexed, with a `uv`) and
 * `gableRoof` (raw triangles, no `uv`) are not otherwise mergeable together,
 * since `mergeGeometries` refuses a batch whose entries disagree on either.
 */
export function normalizeForMerge(geo: BufferGeometry): BufferGeometry {
  const src = geo.index ? geo.toNonIndexed() : geo
  const out = new BufferGeometry()
  const position = src.getAttribute('position')
  if (position) out.setAttribute('position', position)
  const normal = src.getAttribute('normal')
  if (normal) out.setAttribute('normal', normal)
  else out.computeVertexNormals()
  return out
}

/** A shape's rough bounding box in table inches, for scattering clutter (trees, rocks, rubble) inside it. */
export function boundsOf(points: readonly Point[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of points) {
    if (p.x < x0) x0 = p.x
    if (p.y < y0) y0 = p.y
    if (p.x > x1) x1 = p.x
    if (p.y > y1) y1 = p.y
  }
  return { x0, y0, x1, y1 }
}
