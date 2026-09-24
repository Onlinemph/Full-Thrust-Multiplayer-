import type { ShipDesign } from '../../../engine/types'
import type { CounterSilhouette } from '../../ssd/layout'
import type { HullExtent } from '../hullExtent'

/**
 * Pure geometry shared by both counter art styles (`Luminous.tsx`,
 * `Miniature.tsx`) — nothing here draws anything, it only works out where
 * things go, so the two styles agree on layout and diverge only on paint.
 */

/** A gun's dot and a battery's bar, in the counter's ±1000 box. */
export const DOT_RADIUS = 58
export const BAR_WIDTH = 95

/**
 * Below this many pixels of half-length, a dot per gun is a smear and the
 * batteries are drawn as bars instead. Shared by both styles: the luminous
 * style's own dot/bar cutover, and the painted style's mid/full LOD line.
 */
export const DOTS_FROM_PX = 34

/** 1/2/3 engine pods for escort/cruiser/capital-and-up (ships-map #4). */
export function enginePodCount(design: ShipDesign): number {
  if (design.group === 'escort') return 1
  if (design.group === 'cruiser') return 2
  return 3
}

export interface EnginePod {
  x: number
  y: number
}

export function enginePods(
  count: number,
  extent: Pick<HullExtent, 'tailY' | 'halfBeam'>,
  length: number,
): EnginePod[] {
  const podY = extent.tailY - length * 0.05
  const spread = extent.halfBeam * 0.5
  return Array.from({ length: count }, (_, i) => ({
    x: count === 1 ? 0 : (i / (count - 1)) * 2 * spread - spread,
    y: podY,
  }))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * A mount's bearing, standing in for its true arc bisector (painted spec,
 * "Turret bearing"): `planShip`'s own `station()` already placed `(x, y)` by
 * arc, so the radial vector from the hull's local origin through the mount is
 * a fair proxy for a barrel's paint direction — not something to key gameplay
 * off, just where to point the drawn gun.
 */
export function gunBearingDegrees(x: number, y: number): number {
  return (Math.atan2(x, -y) * 180) / Math.PI
}

/** Every weapon and battery row's own y, in local units — what a bridge tower must clear. */
function armedRowYs(silhouette: CounterSilhouette): number[] {
  return [...silhouette.guns.map((g) => g.y), ...silhouette.bars.map((b) => b.y)]
}

/** How far `y` sits from the nearest real weapon or battery row. */
export function clearanceAt(y: number, silhouette: CounterSilhouette): number {
  const rows = armedRowYs(silhouette)
  if (rows.length === 0) return Infinity
  return Math.min(...rows.map((gy) => Math.abs(y - gy)))
}

/**
 * Where the painted style's bridge tower sits (miniature spec, "Bridge
 * tower"): the fixed candidate that clears every real gun/bar row by the
 * most, since the tower is pure decoration and must never sit on a weapon —
 * that glyph's position is game data, the tower's is not.
 */
export function chooseBridgeY(
  candidates: readonly number[],
  silhouette: CounterSilhouette,
): { y: number; clearance: number } {
  let best = candidates[0]!
  let bestClearance = -Infinity
  for (const y of candidates) {
    const c = clearanceAt(y, silhouette)
    if (c > bestClearance) {
      bestClearance = c
      best = y
    }
  }
  return { y: best, clearance: bestClearance }
}
