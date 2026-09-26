/**
 * The 3D view's coordinate system and palette.
 *
 * One world unit is one Measurement Unit (2.1), so the tape measure means the
 * same in both views. The board lies in the XZ plane: board x is world X,
 * board y (screen-down on the flat map) is world Z, and up is +Y. Full
 * Thrust is played flat — 3.1's facing has no pitch or roll of its own — so a
 * ship's course only ever turns it about Y: `courseToDegrees` already gives
 * clockwise-from-up degrees exactly as the 2D map draws it, and
 * `headingToYaw` turns that into three's own right-handed Y rotation for a
 * hull modelled nose toward −Z.
 *
 * Nothing here knows about three.js objects beyond vectors, so the pure parts
 * of the view (layout, colours, geometry maths) can be tested in node.
 */
import { Vector3 } from 'three'

export const DEG = Math.PI / 180

/** Height ships (and their shadows/labels) ride above the board plane, in MU — a slight bob, since 3.1 is played flat. */
export const HULL_ALTITUDE = 0.32

export function toWorld(p: { x: number; y: number }, altitude = 0): Vector3 {
  return new Vector3(p.x, altitude, p.y)
}

/** Board heading (degrees, 0 = up the table/north, clockwise) to a Y rotation in radians. */
export function headingToYaw(heading: number): number {
  return -heading * DEG
}

/** The point `distance` MU from `origin` along a board heading, in world (x, z). */
export function alongHeading(origin: { x: number; z: number }, heading: number, distance: number) {
  return {
    x: origin.x + Math.sin(heading * DEG) * distance,
    z: origin.z - Math.cos(heading * DEG) * distance,
  }
}

/**
 * The side colours, matching `tokens.css`'s `--side-a`/`--side-b`/`--side-c`.
 * A fourth or later side (uncommon — most battles are two-sided) falls back
 * to the neutral grey rather than repeating a colour a real side is using.
 */
export const SIDE_COLOR: Record<'a' | 'b' | 'c' | 'neutral', number> = {
  a: 0x64d2ff,
  b: 0xffc24a,
  c: 0xb79cff,
  neutral: 0x8b97b0,
}

export function sideColorOf(side: string): number {
  return SIDE_COLOR[side as 'a' | 'b' | 'c'] ?? SIDE_COLOR.neutral
}

/** Screen bands, the same thresholds `effectiveScreenLevel`'s 0–2 already gives (7.5). */
export function screenBandColor(level: number): number {
  if (level >= 2) return 0x56d2a0
  if (level === 1) return 0xffc247
  return 0x8b97b0
}

/** Hull plating wash by damage fraction (boxes marked / hull boxes), same read as the 2D counter's own tint. */
export function damageTint(fraction: number): number {
  if (fraction >= 1) return 0x1c1c22
  if (fraction >= 0.75) return 0x5e1a14
  if (fraction >= 0.5) return 0x55241a
  if (fraction >= 0.25) return 0x4a2f1c
  if (fraction > 0) return 0x3a3348
  return 0x2a3550
}

/**
 * Where the camera should sit to frame the whole board from a given
 * elevation, looking at its centre. Pure maths so it can be tested.
 */
export function framingDistance(width: number, height: number, fovDeg: number, aspect: number): number {
  const vFov = fovDeg * DEG
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
  const byHeight = height / 2 / Math.tan(vFov / 2)
  const byWidth = width / 2 / Math.tan(hFov / 2)
  // A touch of air round the edge, so the board does not kiss the frame.
  return Math.max(byHeight, byWidth) * 1.08
}
