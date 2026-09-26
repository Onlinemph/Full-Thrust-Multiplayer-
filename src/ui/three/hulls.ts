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
import { BufferGeometry, CylinderGeometry, EdgesGeometry, ExtrudeGeometry, Shape, Vector2 } from 'three'
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
  /** Half the hull's own widest beam, in MU — for anything shaped round the hull rather than along its keel (a screen shell). */
  halfBeam: number
  /** Top of the plating above the board plane, in MU — where a badge or ring can sit clear of it. */
  top: number
  /** True for a hull with no bow to point (a station, or a ship with no drive) — `counterSilhouette`'s own flag. */
  radial: boolean
  /**
   * A little relief so the hull is not a single flat plate: a raised
   * ridge/deckhouse sized off the hull's own footprint (bigger for a bigger
   * ship). World-local, sitting on top of the plating.
   */
  superstructure: BufferGeometry
  /** Where `superstructure` sits, world-local, and its own top surface (for a bridge strip or mast to clear it). */
  superstructureAt: { x: number; z: number; top: number }
  /** A handful of running-light points along the hull's outer edge, world-local (x, z). */
  navLights: ReadonlyArray<{ x: number; z: number }>
}

const cache = new Map<string, HullGeometry>()

/**
 * A raised ridge/deckhouse on top of the plating — the little relief a flat
 * silhouette does not give on its own, so a hull reads as a built thing
 * rather than one extruded plate. An elongated, tapered block set a touch
 * aft of amidships for a hull with a bow to point (a keel spine, roughly
 * where a bridge sits); a squat drum for a station, which has no keel to run
 * one along. Sized off the hull's own footprint (`radius` — `hullGeometry`'s
 * own MU reach), so a frigate's ridge and a dreadnought's are each
 * proportionate to their own hull rather than to a shared constant.
 */
function buildSuperstructure(
  radial: boolean,
  halfBeam: number,
  halfLength: number,
  top: number,
  radius: number,
): { geo: BufferGeometry; z: number; structureTop: number } {
  const height = Math.max(0.045, Math.min(radius * 0.34, radius * 0.16 + 0.03))
  const footprint = radial ? Math.min(halfBeam, radius) * 0.55 : Math.min(halfBeam * 0.58, radius * 0.34)
  const length = radial ? footprint : Math.min(halfLength * 0.85, radius * 1.35)
  const segments = radial ? 10 : 4
  // A quarter-turn `thetaStart` on a four-gon lines its flat faces up with
  // the hull's own local axes instead of leaving a corner pointing down the
  // keel — the same trick a low-poly box-from-a-cylinder always needs.
  const geo = new CylinderGeometry(footprint * 0.72, footprint, height, segments, 1, false, radial ? 0 : Math.PI / 4)
  if (!radial) geo.scale(1, 1, length / Math.max(0.001, footprint))
  geo.translate(0, height / 2, 0)
  geo.userData.shared = true
  return { geo, z: radial ? 0 : halfLength * 0.12, structureTop: top + height }
}

/** A few running-light points along the hull's outer edge — bow, and both quarters — world-local (x, z). */
function buildNavLights(
  radial: boolean,
  halfBeam: number,
  noseZ: number,
  tailZ: number,
): Array<{ x: number; z: number }> {
  if (radial) {
    return [
      { x: halfBeam * 0.92, z: 0 },
      { x: -halfBeam * 0.92, z: 0 },
    ]
  }
  const midZ = (noseZ + tailZ) / 2
  return [
    { x: 0, z: noseZ * 0.94 },
    { x: -halfBeam * 0.85, z: midZ },
    { x: halfBeam * 0.85, z: midZ },
  ]
}

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

  const halfBeamMU = extent.halfBeam * k
  const halfLengthMU = ((extent.tailY - extent.noseY) / 2) * k
  const topMU = rawDepth * k + bevel * k * 2
  const structure = buildSuperstructure(silhouette.radial, halfBeamMU, halfLengthMU, topMU, radius)

  const geometry: HullGeometry = {
    plating,
    trim,
    spine,
    engineMounts,
    halfLength: halfLengthMU,
    halfBeam: halfBeamMU,
    top: topMU,
    radial: silhouette.radial,
    superstructure: structure.geo,
    superstructureAt: { x: 0, z: structure.z, top: structure.structureTop },
    navLights: buildNavLights(silhouette.radial, halfBeamMU, extent.noseY * k, extent.tailY * k),
  }
  cache.set(design.id, geometry)
  return geometry
}
