import { ARC_ORDER } from '../../engine/types'
import type { Arc } from '../../engine/types'

/**
 * Which way a mounting bears, as a six-wedge rose.
 *
 * Where a symbol sits on the hull says roughly where it points, but roughly is
 * not enough: a chase gun that fires only dead ahead and a forward battery that
 * covers the whole front half both sit at the bow, and the difference between
 * them decides whether a ship can shoot at all after a turn. The rose says it
 * exactly — one wedge per arc, in the arcs' own clockwise order from the bow
 * (4.2) — and it says it in a shape, which reads at a glance where three
 * letters do not.
 */

function corner(degrees: number, radius: number): string {
  const radians = (degrees * Math.PI) / 180
  const x = radius * Math.sin(radians)
  const y = -radius * Math.cos(radians)
  return `${x.toFixed(2)} ${y.toFixed(2)}`
}

export interface ArcRoseProps {
  arcs: readonly Arc[]
  x: number
  y: number
  radius: number
}

export function ArcRose({ arcs, x, y, radius }: ArcRoseProps) {
  const bearing = new Set(arcs)
  return (
    <g className="ssd-rose" transform={`translate(${x} ${y})`}>
      {/* Backed in the sheet's own paper colour so the rose reads over
          whatever part of the symbol it happens to overlap. */}
      <circle className="ssd-rose-back" r={radius} />
      {ARC_ORDER.map((arc, index) =>
        bearing.has(arc) ? (
          <path
            key={arc}
            className="ssd-rose-arc"
            d={`M 0 0 L ${corner(index * 60 - 30, radius)} L ${corner(index * 60 + 30, radius)} Z`}
          />
        ) : null,
      )}
      <circle className="ssd-rose-ring" r={radius} />
    </g>
  )
}
