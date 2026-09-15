import type { ShipDesign } from '../engine/types'
import { Counter, counterRadius } from './Counter'

/**
 * The counter as the map will draw it, at a size a panel can show: the hull
 * with its guns, or the design's own picture where it has one.
 */
export function CounterPreview({ design, size = 80 }: { design: ShipDesign; size?: number }) {
  return (
    <svg
      className="counter-preview"
      viewBox="-40 -40 80 80"
      width={size}
      height={size}
      aria-label={`${design.name}, as a counter`}
    >
      <Counter
        position={{ x: 0, y: 0 }}
        facing={12}
        side="a"
        design={design}
        scale={30 / counterRadius(design.mass)}
        art={design.art}
      />
    </svg>
  )
}
