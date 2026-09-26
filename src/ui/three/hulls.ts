/**
 * Ship hulls for the 3D view, extruded from the same silhouette the 2D
 * counter draws.
 *
 * `counterSilhouette` (`../ssd/layout`) runs the same layout the SSD sheet
 * does and hands back a flat outline in a ±`COUNTER_EXTENT` box — the very
 * path the 2D `Counter` fills in as a `<path>`. Rather than model a second
 * fleet by hand, this parses that path's own `M`/`L`/`Q` commands (the only
 * commands `hullPath` ever writes — see `hullExtent.ts`'s comment) into a
 * `THREE.Shape` and extrudes it: bevelled plating, a lit trim outline in the
 * side colour, and — for a spinal-mount design — a raised keel bar over
 * 5.23's barrel. A cruiser reads as the same cruiser across the switch,
 * because it is the same outline.
 *
 * Geometry is cached per hull class (`design.id`): every ship built to the
 * same design shares one set of buffers, because `counterRadius(mass)` and
 * the silhouette are both functions of the *design*, not the instance —
 * materials are per ship, since damage and cloaks change them.
 */
import { BufferGeometry, EdgesGeometry, ExtrudeGeometry, Shape, Vector2 } from 'three'
import type { ShipDesign } from '../../engine/types'
import { hullExtent } from '../plot/hullExtent'
import { COUNTER_EXTENT, counterSilhouette } from '../ssd/layout'

/**
 * Parse an outline written as `M x y (L x y)+ Z` or `M x y (Q cx cy x y)+ Z`
 * (`hullPath`'s own two forms — a curved hull's edges are quadratics, every
 * other edge treatment is straight lines, never both) into a `Shape`, in the
 * path's own coordinates. A quadratic is sampled rather than carried through
 * as a curve command, both because `ExtrudeGeometry` sees the same polygon
 * either way and because it lets the whole outline be checked and, if it
 * winds the way an SVG path winds (clockwise, y down the page) rather than
 * the way three's front-facing cap expects (counter-clockwise), reversed
 * once here instead of everywhere this module builds geometry from it.
 */
function shapeFromPath(d: string): Shape {
  const tokens = d.match(/[MLQZ]|-?\d+(?:\.\d+)?/g) ?? []
  const points: Vector2[] = []
  let cmd = ''
  let cursor = new Vector2()
  let i = 0
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    const t = tokens[i]
    if (t === 'M' || t === 'L' || t === 'Q' || t === 'Z') {
      cmd = t
      i += 1
      if (cmd === 'Z') continue
    }
    if (cmd === 'M' || cmd === 'L') {
      cursor = new Vector2(num(), num())
      points.push(cursor.clone())
    } else if (cmd === 'Q') {
      const c = new Vector2(num(), num())
      const end = new Vector2(num(), num())
      const steps = 8
      for (let s = 1; s <= steps; s += 1) {
        const u = s / steps
        const v = (1 - u) ** 2
        const w = 2 * (1 - u) * u
        const z = u ** 2
        points.push(new Vector2(v * cursor.x + w * c.x + z * end.x, v * cursor.y + w * c.y + z * end.y))
      }
      cursor = end
    } else {
      i += 1
    }
  }
  if (signedArea(points) < 0) points.reverse()
  return new Shape(points)
}

function signedArea(points: readonly Vector2[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

/**
 * Fold the extrude's own XY-plane, +Z-extrusion shape into the board's XZ
 * plane, nose toward −Z: rotate a quarter turn about X (the path's Y — nose
 * negative, tail positive, per `hullExtent` — becomes world Z, matching
 * `headingToYaw`'s convention exactly, no flip needed), then re-centre the
 * slab vertically and scale from path units down to MU.
 */
function foldAndScale(geo: BufferGeometry, rawDepth: number, scale: number): BufferGeometry {
  geo.rotateX(Math.PI / 2)
  geo.translate(0, rawDepth / 2, 0)
  geo.scale(scale, scale, scale)
  geo.computeVertexNormals()
  return geo
}

export interface HullGeometry {
  /** The bevelled plating, extruded from the hull's own outline. */
  plating: BufferGeometry
  /** A lit outline over the plating's edges, drawn in the side colour. */
  trim: BufferGeometry
  /** 5.23's barrel as a raised bar down the keel, world-local, or null unarmed with one. */
  spine: { z1: number; z2: number } | null
  /** Stern mount points for the drive glow, world-local (x, z). Empty for a station or a driveless hull. */
  engineMounts: ReadonlyArray<{ x: number; z: number }>
  /** Half the hull's own length (nose to tail), in MU. */
  halfLength: number
  /** Top of the plating above the board plane, in MU — where a badge or ring can sit clear of it. */
  top: number
  /** True for a hull with no bow to point (a station, or a ship with no drive) — `counterSilhouette`'s own flag. */
  radial: boolean
}

const cache = new Map<string, HullGeometry>()

/**
 * A hull's geometry, sized to `radius` — `counterRadius(design.mass)`, the
 * same reach the 2D counter draws at (`../Counter.tsx`) — and cached by
 * `design.id`, since every ship built to this class is the same shape.
 */
export function buildHull(design: ShipDesign, radius: number): HullGeometry {
  const cached = cache.get(design.id)
  if (cached) return cached

  const silhouette = counterSilhouette(design)
  const extent = hullExtent(silhouette)
  const k = radius / COUNTER_EXTENT

  // Thickness is a modest fraction of the ship's own on-table reach, floored
  // so the smallest hull in play still reads as a solid, not a wafer.
  const worldDepth = Math.min(0.42, Math.max(0.12, radius * 0.16))
  const rawDepth = worldDepth / k
  const bevel = rawDepth * 0.32

  const platingRaw = new ExtrudeGeometry(shapeFromPath(silhouette.path), {
    depth: rawDepth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 2,
    curveSegments: 1,
  })
  const plating = foldAndScale(platingRaw, rawDepth, k)
  plating.userData.shared = true

  const trim = new EdgesGeometry(plating, 24)
  trim.userData.shared = true

  const spine = silhouette.spine
    ? { z1: silhouette.spine.y1 * k, z2: silhouette.spine.y2 * k }
    : null

  const engineMounts =
    silhouette.radial || design.drive.thrust <= 0
      ? []
      : extent.halfBeam < 90
        ? [{ x: 0, z: extent.tailY * k }]
        : [
            { x: -extent.halfBeam * 0.42 * k, z: extent.tailY * k },
            { x: extent.halfBeam * 0.42 * k, z: extent.tailY * k },
          ]

  const geometry: HullGeometry = {
    plating,
    trim,
    spine,
    engineMounts,
    halfLength: ((extent.tailY - extent.noseY) / 2) * k,
    top: rawDepth * k + bevel * k * 2,
    radial: silhouette.radial,
  }
  cache.set(design.id, geometry)
  return geometry
}
