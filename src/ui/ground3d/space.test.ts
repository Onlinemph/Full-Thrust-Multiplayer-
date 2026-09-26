import { describe, expect, it } from 'vitest'
import { elevatedFramingDistance, framingDistance, snapToGrid } from './space'

describe('snapToGrid (R2)', () => {
  it('rounds a raw 3D raycast hit to the same quarter-inch grid the 2D maps snap clicks to', () => {
    expect(snapToGrid({ x: 18.87944256464234, y: 5.01 })).toEqual({ x: 19, y: 5 })
    expect(snapToGrid({ x: 18.9, y: 5.13 })).toEqual({ x: 19, y: 5.25 })
  })

  it('leaves an already-on-grid point unchanged', () => {
    expect(snapToGrid({ x: 12.25, y: 7.5 })).toEqual({ x: 12.25, y: 7.5 })
  })
})

/**
 * Re-derives whether a board corner actually lands inside the camera's own
 * field of view at a given elevation and distance — independent maths from
 * `elevatedFramingDistance`'s own derivation, so this test would catch a
 * mistake in that formula rather than just restate it. Mirrors exactly how
 * `GroundScene.setPreset` places the camera: on the ray through the board's
 * centre at `elevationDeg`, `distance` away, looking back at that centre.
 */
function cornerInFrame(width: number, depth: number, fovDeg: number, aspect: number, elevationDeg: number, distance: number, corner: { x: number; z: number }): boolean {
  const e = elevationDeg * (Math.PI / 180)
  const sinE = Math.sin(e)
  const cosE = Math.cos(e)
  const dx = corner.x - width / 2
  const dz = corner.z - depth / 2
  // Camera-space axes for this family of camera positions: right is world
  // +X, forward is (0, -sinE, -cosE), up is (0, cosE, -sinE) (derived
  // independently in the test rather than imported).
  const zC = distance - cosE * dz
  const xC = dx
  const yC = -sinE * dz
  if (zC <= 0) return false
  const vFov = fovDeg * (Math.PI / 180)
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
  return Math.abs(Math.atan(xC / zC)) <= hFov / 2 && Math.abs(Math.atan(yC / zC)) <= vFov / 2
}

describe('elevatedFramingDistance (R9)', () => {
  const FOV = 42
  const aspect = 16 / 9

  it('keeps every corner of a wide table inside frame at the Tilt elevation', () => {
    const width = 48
    const depth = 36
    const d = elevatedFramingDistance(width, depth, FOV, aspect, 42)
    for (const x of [0, width]) {
      for (const z of [0, depth]) {
        expect(cornerInFrame(width, depth, FOV, aspect, 42, d, { x, z })).toBe(true)
      }
    }
  })

  it('keeps every corner inside frame at the Low elevation, where the flat top-down distance does not', () => {
    const width = 48
    const depth = 36
    const flat = framingDistance(width, depth, FOV, aspect)
    const corners = [
      { x: 0, z: 0 },
      { x: width, z: 0 },
      { x: 0, z: depth },
      { x: width, z: depth },
    ]
    // R9's own repro: the flat top-down distance, scaled down for a "closer"
    // low camera, leaves the near corners outside the frame.
    const flatFailsSomewhere = corners.some((c) => !cornerInFrame(width, depth, FOV, aspect, 13, flat * 0.55, c))
    expect(flatFailsSomewhere).toBe(true)

    const d = elevatedFramingDistance(width, depth, FOV, aspect, 13)
    for (const c of corners) expect(cornerInFrame(width, depth, FOV, aspect, 13, d, c)).toBe(true)
  })

  it('scales up with the board size at a fixed elevation', () => {
    const small = elevatedFramingDistance(24, 18, FOV, aspect, 42)
    const large = elevatedFramingDistance(96, 72, FOV, aspect, 42)
    expect(large).toBeGreaterThan(small)
  })
})
