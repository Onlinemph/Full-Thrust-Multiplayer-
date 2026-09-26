/**
 * The ground 3D view's coordinate system: table inches to world units, one
 * for one, exactly as `src/ui/three/space.ts` keeps one Measurement Unit as
 * one world unit. The table lies in the XZ plane — table x is world X,
 * table y (screen-down on the flat map, running from the north baseline to
 * the south) is world Z — and up is +Y. Dirtside and Stargrunt are played
 * flat, so a facing (degrees clockwise from north/up-the-table) only ever
 * turns a model about Y.
 *
 * Nothing here knows about three.js objects beyond vectors, so the pure
 * parts of the view (layout, scale, geometry maths) can be tested in node —
 * `space.test.ts` covers the round trip and the framing maths.
 */
import { Vector3 } from 'three'
import type { Point } from '../../dirtside/table/types'

export const DEG = Math.PI / 180

export function toWorld(p: Point, y = 0): Vector3 {
  return new Vector3(p.x, y, p.y)
}

/** The table point under a world (x, z) — `y` (height) is not wanted back: `heightAt` gives it from the point alone. */
export function fromWorldXZ(x: number, z: number): Point {
  return { x, y: z }
}

/**
 * A board point snapped to the quarter-inch grid both 2D `TableMap`s already
 * snap every click to (`Math.round(at.x * 4) / 4`, `dirtside/TableMap.tsx`
 * and `stargrunt/TableMap.tsx`) — so a click at the same table spot resolves
 * to the identical point whichever view is on screen (R2), instead of the
 * raw float a 3D raycast hit gives back.
 */
export function snapToGrid(p: Point): Point {
  return { x: Math.round(p.x * 4) / 4, y: Math.round(p.y * 4) / 4 }
}

/** Board heading (degrees, 0 = up the table/north, clockwise) to a Y rotation in radians. */
export function headingToYaw(heading: number): number {
  return -heading * DEG
}

/**
 * Where the camera should sit to frame the whole board from a near-vertical
 * top-down look, looking at its centre — identical maths to
 * `three/space.ts`'s own `framingDistance`. Only ever right for a look this
 * close to straight down: it assumes every corner is (near enough)
 * equidistant from the camera, which stops holding once the camera tilts
 * down toward the board — see `elevatedFramingDistance` for that case (R9).
 */
export function framingDistance(width: number, depth: number, fovDeg: number, aspect: number): number {
  const vFov = fovDeg * DEG
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
  const byDepth = depth / 2 / Math.tan(vFov / 2)
  const byWidth = width / 2 / Math.tan(hFov / 2)
  return Math.max(byDepth, byWidth) * 1.08
}

/**
 * Where the camera should sit, at a given elevation above the board's own
 * plane, to keep every one of its four corners inside frame (R9's fix):
 * `framingDistance`'s flat width/depth trig treats every corner as
 * (near enough) equidistant from the camera, true only for a near-vertical
 * look. Tilted down at a shallow elevation (the Tilt and, more sharply, the
 * Low camera preset) the board's near edge sits markedly closer to the
 * camera than its far edge, so it subtends a wider angle than that flat
 * trig budgets for — a unit near the table's own edge (exactly where a
 * side's deployment strip is) could fall outside the frame entirely.
 *
 * `GroundScene`'s camera always sits on the ray through the board's centre
 * at this elevation, looking back at that centre, so its local axes are
 * fixed regardless of distance: right is world +X (the camera never rolls),
 * and a board corner's camera-space horizontal offset is just its raw X
 * offset from centre, while its vertical offset only depends on elevation
 * and its Z offset from centre (never on distance). That makes the minimum
 * distance for every corner to stay within a padded field of view solvable
 * directly, without a numeric search — the derivation is the geometry above.
 */
export function elevatedFramingDistance(width: number, depth: number, fovDeg: number, aspect: number, elevationDeg: number, pad = 1.15): number {
  const vFov = fovDeg * DEG
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
  const tanH = Math.tan(hFov / 2 / pad)
  const tanV = Math.tan(vFov / 2 / pad)
  const e = elevationDeg * DEG
  const sinE = Math.sin(e)
  const cosE = Math.cos(e)
  const hw = width / 2
  const hd = depth / 2
  // The near corners (south, toward the camera) are always the tight ones:
  // their horizontal need is `hw / tanH + cosE * hd`, their vertical need
  // `hd * (sinE / tanV + cosE)` — the far corners need strictly less of
  // either, so the near pair alone sets the distance.
  const byWidth = hw / tanH + cosE * hd
  const byDepth = hd * (sinE / tanV + cosE)
  return Math.max(byWidth, byDepth)
}

/**
 * How tall things stand, by the table's own figure scale (BRIEF-GROUND-3D:
 * "take the vertical scale from the table's scale"). Dirtside's 6mm models
 * stand on a low, terraced countryside; Stargrunt's 25mm figures stand
 * among buildings and hills built taller for it. Every height below is
 * inches of world space, the same unit the table is measured in.
 */
export interface GroundScale {
  name: '6mm' | '25mm'
  /** Rise per hill terrace (BRIEF-GROUND-3D's "terraces from inset outlines"). */
  hillStep: number
  /** How far each terrace insets from the one below it. */
  hillTerraceWidth: number
  /** Terraces above the base level, at most (a small field feature never needs many). */
  hillMaxTerraces: number
  /** Height of one building storey. */
  buildingStorey: number
  /** How far a gabled roof's ridge rises above its eaves. */
  roofRise: number
  treeHeight: number
  treeRadius: number
  trunkHeight: number
  wallHeight: number
  hedgeHeight: number
  rubbleHeight: number
  /** How far a river/open-water's surface sits below table level. */
  waterSink: number
  /** How far a road/ford is lifted above bare ground, so it never z-fights it. */
  roadLift: number
}

export const DIRTSIDE_SCALE: GroundScale = {
  name: '6mm',
  hillStep: 0.32,
  hillTerraceWidth: 1.1,
  hillMaxTerraces: 3,
  buildingStorey: 0.42,
  roofRise: 0.28,
  treeHeight: 0.55,
  treeRadius: 0.3,
  trunkHeight: 0.16,
  wallHeight: 0.11,
  hedgeHeight: 0.16,
  rubbleHeight: 0.2,
  waterSink: 0.05,
  roadLift: 0.012,
}

export const STARGRUNT_SCALE: GroundScale = {
  name: '25mm',
  hillStep: 0.85,
  hillTerraceWidth: 2.4,
  hillMaxTerraces: 4,
  buildingStorey: 1.6,
  roofRise: 0.9,
  treeHeight: 2.1,
  treeRadius: 0.85,
  trunkHeight: 0.5,
  wallHeight: 0.42,
  hedgeHeight: 0.5,
  rubbleHeight: 0.55,
  waterSink: 0.12,
  roadLift: 0.018,
}

/** Whether this browser can draw WebGL at all — `three/BattleView3D.tsx`'s own check. */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}
