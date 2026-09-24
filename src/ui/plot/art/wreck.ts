import { hashSeed, seededSequence } from '../seeded'
import type { HullExtent } from '../hullExtent'

/**
 * The wreck's own layout — tilt, drift and debris scatter — worked out once
 * and shared by both art styles, so a hull crossfading between them while
 * destroyed doesn't visibly jump: only the paint on top of this layout
 * differs per style (`Luminous.tsx`'s cracks, `Miniature.tsx`'s husk tone and
 * embers). Pure and seeded off the ship's own name, so it never reshuffles on
 * re-render (see `seeded.ts`).
 */
export interface WreckLayout {
  tilt: number
  debris: Array<{ x: number; y: number; r: number }>
}

export function wreckLayout(seedKey: string, extent: Pick<HullExtent, 'noseY' | 'tailY' | 'halfBeam'>): WreckLayout {
  const seed = hashSeed(`${seedKey}-wreck`)
  const rolls = seededSequence(seed, 1 + 4 * 3)
  const tilt = (rolls[0]! - 0.5) * 12
  const debrisCount = 3 + Math.floor((rolls[1] ?? 0) * 2)
  const span = Math.max(1, extent.tailY - extent.noseY)
  const debris = Array.from({ length: debrisCount }, (_, i) => {
    const base = 1 + i * 3
    const rx = rolls[base] ?? 0.5
    const ry = rolls[base + 1] ?? 0.5
    const rr = rolls[base + 2] ?? 0.5
    return {
      x: (rx - 0.5) * extent.halfBeam * 2.6,
      y: extent.noseY + ry * span,
      r: extent.halfBeam * (0.05 + rr * 0.11),
    }
  })
  return { tilt, debris }
}

/** Two random chords across the hull, stable per ship (luminous wreck spec). */
export function wreckCracks(
  seedKey: string,
  extent: Pick<HullExtent, 'noseY' | 'tailY' | 'halfBeam'>,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const length = Math.max(1, extent.tailY - extent.noseY)
  const rolls = seededSequence(hashSeed(`${seedKey}-wreck-crack`), 4)
  const top = extent.noseY + length * 0.1
  const bottom = extent.tailY - length * 0.1
  return [0, 1].map((i) => ({
    x1: (rolls[i * 2]! - 0.5) * extent.halfBeam * 1.8,
    y1: top,
    x2: (rolls[i * 2 + 1]! - 0.5) * extent.halfBeam * 1.8,
    y2: bottom,
  }))
}
