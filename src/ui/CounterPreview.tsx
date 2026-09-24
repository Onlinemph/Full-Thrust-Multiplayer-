import type { ShipDesign } from '../engine/types'
import { Counter, counterRadius } from './Counter'

/**
 * Below this box size, a preview shows the luminous style rather than the
 * painted one: a tiny fixed chip (the fleet picker, a roster row) has no room
 * for panel lines and turret barrels to read as anything but noise, and the
 * crisp glowing outline holds up far better at a few dozen pixels. A larger
 * box (the library head, the Shipyard's own preview) shows the painted style
 * the map itself would once a player zoomed in that far.
 */
const PAINTED_FROM_SIZE = 40

/**
 * The counter as the map will draw it, at a size a panel can show: the hull
 * with its guns, or the design's own picture where it has one.
 *
 * Every design draws at the same fixed 30-unit radius here regardless of
 * mass, so a corvette and a dreadnought fill the same box (review finding
 * `code #1`) — `sizeFloor={false}` skips the live map's minimum-pixel-size
 * boost, which is keyed to `scale` alone and would otherwise grow faster for
 * a heavy hull's much smaller per-mass `scale` than for a light one's,
 * breaking exactly the uniform sizing this component exists to give.
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
        sizeFloor={false}
        artStyle={size >= PAINTED_FROM_SIZE ? 'miniature' : 'luminous'}
      />
    </svg>
  )
}
