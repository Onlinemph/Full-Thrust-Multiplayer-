import { ARC_ORDER, type Arc, type Course } from '../engine/types'
import { courseToDegrees, DEGREES_PER_ARC } from '../engine/geometry'

/**
 * The six 60-degree fire arcs of a ship, drawn as a compass rose (4.2).
 *
 * Used in two places, which is why it takes everything as props rather than
 * reading a ship: on the map, oriented to a hull's facing and lit up to show
 * where a weapon can bear; and in the ship designer, where a weapon's arcs are
 * chosen by clicking the wedges.
 *
 * Arcs are laid out clockwise from the bow — F, FS, AS, A, AP, FP — and the
 * forward arc straddles the facing, running 30 degrees either side of it.
 */
export interface ArcRoseProps {
  /** Where the bow points. Leave at 12 for a rose drawn nose-up. */
  facing?: Course
  /** Arcs to light up — a weapon's coverage. */
  lit?: readonly Arc[]
  /** Arc drawn as the live one, e.g. the arc the target is actually in. */
  target?: Arc | null
  radius?: number
  /** Set to make the wedges clickable, for the designer. */
  onToggle?: (arc: Arc) => void
  /** Labels the arcs. Off on the map, where there is no room. */
  labels?: boolean
}

/**
 * SVG path for one 60-degree wedge, centred on the origin.
 *
 * The wedge is drawn from `start` clockwise by one arc. Sixty degrees is under
 * a half-circle, so the arc flag is always 0 — no need to compute it.
 */
function wedgePath(startDegrees: number, radius: number): string {
  const toXY = (deg: number): [number, number] => {
    const rad = (deg * Math.PI) / 180
    // Screen coordinates: y grows downward, so 0 degrees is −y.
    return [Math.sin(rad) * radius, -Math.cos(rad) * radius]
  }
  const [x1, y1] = toXY(startDegrees)
  const [x2, y2] = toXY(startDegrees + DEGREES_PER_ARC)
  return `M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(
    2,
  )} ${y2.toFixed(2)} Z`
}

export function ArcRose({
  facing = 12,
  lit = [],
  target = null,
  radius = 48,
  onToggle,
  labels = false,
}: ArcRoseProps) {
  // The forward arc is centred on the facing, so the rose starts half an arc
  // anticlockwise of it.
  const base = courseToDegrees(facing) - DEGREES_PER_ARC / 2

  return (
    <g className="arc-rose" role={onToggle ? 'group' : 'presentation'}>
      {ARC_ORDER.map((arc, index) => {
        const isLit = lit.includes(arc)
        const isTarget = target === arc
        const classes = ['arc-wedge']
        if (isLit) classes.push('is-lit')
        if (isTarget) classes.push('is-target')
        return (
          <path
            key={arc}
            className={classes.join(' ')}
            d={wedgePath(base + index * DEGREES_PER_ARC, radius)}
            opacity={isTarget ? 0.35 : isLit ? 0.18 : 0.05}
            onClick={onToggle ? () => onToggle(arc) : undefined}
            style={onToggle ? { cursor: 'pointer' } : undefined}
          >
            {onToggle ? <title>{`${arc} arc`}</title> : null}
          </path>
        )
      })}
      {labels
        ? ARC_ORDER.map((arc, index) => {
            const mid = ((base + index * DEGREES_PER_ARC + DEGREES_PER_ARC / 2) * Math.PI) / 180
            const r = radius * 0.68
            return (
              <text
                key={arc}
                className="range-label"
                x={(Math.sin(mid) * r).toFixed(2)}
                y={(-Math.cos(mid) * r).toFixed(2)}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {arc}
              </text>
            )
          })
        : null}
    </g>
  )
}
