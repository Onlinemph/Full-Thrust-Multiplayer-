import type { CounterSilhouette } from '../ssd/layout'

/**
 * The hull's own reach, read back out of the path `counterSilhouette()`
 * already drew rather than asked of the engine a second time.
 *
 * `layout.ts` is read-only from here, and its own `CounterSilhouette` does not
 * carry the hull's bounding box — only the finished outline. But the outline
 * *is* the shape, in every hull group from a needle-nosed escort to a radial
 * station, so measuring the path's own numbers back out is more honest than
 * re-deriving a bow/stern split from the design a second way. `path` only ever
 * uses `M`/`L`/`Q`, so every number in it is half of an x,y pair — walking it
 * two at a time is exact, not an approximation.
 */
export interface HullExtent {
  /** The bow's own tip, negative (up the counter's local box). */
  noseY: number
  /** The stern's own end, positive. */
  tailY: number
  /** Half the hull's widest beam. */
  halfBeam: number
}

const NUMBER = /-?\d+(?:\.\d+)?/g
const CACHE = new WeakMap<CounterSilhouette, HullExtent>()

function pathExtent(d: string): HullExtent {
  const numbers = d.match(NUMBER)
  if (!numbers || numbers.length < 2) return { noseY: -1000, tailY: 1000, halfBeam: 600 }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    const x = Number(numbers[i])
    const y = Number(numbers[i + 1])
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { noseY: minY, tailY: maxY, halfBeam: Math.max(maxX, -minX) }
}

export function hullExtent(silhouette: CounterSilhouette): HullExtent {
  const cached = CACHE.get(silhouette)
  if (cached) return cached
  const extent = pathExtent(silhouette.path)
  CACHE.set(silhouette, extent)
  return extent
}
