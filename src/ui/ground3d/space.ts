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

/** Board heading (degrees, 0 = up the table/north, clockwise) to a Y rotation in radians. */
export function headingToYaw(heading: number): number {
  return -heading * DEG
}

/**
 * Where the camera should sit to frame the whole board from a given
 * elevation, looking at its centre — identical maths to `three/space.ts`'s
 * own `framingDistance`.
 */
export function framingDistance(width: number, depth: number, fovDeg: number, aspect: number): number {
  const vFov = fovDeg * DEG
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
  const byDepth = depth / 2 / Math.tan(vFov / 2)
  const byWidth = width / 2 / Math.tan(hFov / 2)
  return Math.max(byDepth, byWidth) * 1.08
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
