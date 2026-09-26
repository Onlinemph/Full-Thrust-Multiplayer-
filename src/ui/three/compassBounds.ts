/**
 * Where the 3D order compass overlay (`OrderCompass.tsx`, planted over the
 * canvas by `BattleView3D.tsx`) is allowed to sit, so it is always fully
 * usable rather than partly hidden under the HUD or off the canvas edge (R6).
 *
 * `OrderCompass.tsx` sizes itself off the `clearance` it is handed: the first
 * ring is `radius = max(48, clearance + 32)`, the second ('then') ring is
 * `radius + 32`, and the throttle pill and Hold/Next row sit at
 * `thenRadius + 36`/`+70`. In 3D, `clearance` comes from a perspective
 * projection and grows without bound as the camera closes in — at
 * `OrbitControls.minDistance` a selected hull can fill most of the canvas —
 * so both the size fed in and the placement have to be capped independently
 * of whatever the camera is doing.
 */

/** However close the camera gets, the ring's own radius never grows past what this clearance gives it. */
export const COMPASS_MAX_CLEARANCE = 46

/** A compass button's own rough half-footprint, so a ring's buttons — not just the ring line — clear an edge. */
const BUTTON_HALF = 16

function compassRadius(clearance: number): number {
  return Math.max(48, clearance + 32)
}

export interface CompassMargins {
  top: number
  bottom: number
  side: number
}

/**
 * The clear space the compass needs on every side of its own centre point,
 * at a given (uncapped) clearance — `hudClearance` folds in whatever the HUD
 * drawn over the canvas needs kept clear above it (`BattleView3D.tsx`'s own
 * camera-preset row and help text), so the top margin serves both jobs at
 * once rather than the compass and the HUD each reasoning about the other.
 */
export function compassMargins(clearance: number, hudClearance: number): CompassMargins {
  const radius = compassRadius(Math.min(clearance, COMPASS_MAX_CLEARANCE))
  const thenRadius = radius + 32
  return {
    top: Math.max(thenRadius + BUTTON_HALF, hudClearance),
    bottom: thenRadius + 70 + BUTTON_HALF * 2,
    side: thenRadius + BUTTON_HALF,
  }
}

export interface CompassPoint {
  x: number
  y: number
  clearance: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}

/**
 * Where the compass should actually be drawn for a canvas of this size, and
 * with what clearance — clamped fully inside it whenever a compass that size
 * can fit at all; `null` when even the minimum cannot, so a caller can fall
 * back to a "zoom out to plot" hint instead of a control silently missing
 * part of itself.
 */
export function fitCompass(point: CompassPoint, width: number, height: number, hudClearance: number): CompassPoint | null {
  const margins = compassMargins(point.clearance, hudClearance)
  const fits = width >= margins.side * 2 + 20 && height >= margins.top + margins.bottom + 20
  if (!fits) return null
  return {
    x: clamp(point.x, margins.side, width - margins.side),
    y: clamp(point.y, margins.top, height - margins.bottom),
    clearance: Math.min(point.clearance, COMPASS_MAX_CLEARANCE),
  }
}
