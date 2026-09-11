import { courseToDegrees } from '../engine/geometry'
import type { Course, Point } from '../engine/types'

/**
 * A ship counter on the plotting surface.
 *
 * An arrowhead, because the one thing a player must read off a counter at a
 * glance is which way the bow points — every course change, every fire arc and
 * the rear-arc rule all hang off it (3.1, 4.2, 4.10).
 *
 * Presentational and prop-driven: it knows nothing about game state, so the
 * map, the fleet picker and the designer can all draw the same counter.
 */
export interface CounterProps {
  position: Point
  facing: Course
  side: 'a' | 'b' | 'c'
  /** Hull mass, which sets the counter's size (2.3). */
  mass: number
  label?: string
  selected?: boolean
  destroyed?: boolean
  /** Drawn as an outline: visible to its own side, not to the enemy (7.20). */
  cloaked?: boolean
  /** Pixels per MU, from the map's zoom. */
  scale: number
  /** Custom counter art, drawn nose-up and fitted to the counter. */
  art?: string
  onClick?: () => void
}

/**
 * Counter size in MU from hull mass.
 *
 * Deliberately compressed: mass runs from about 10 to 300 in practice, and a
 * counter thirty times another's size would be unusable. The cube root keeps a
 * superdreadnought visibly four times a corvette and no more — which is about
 * what the miniatures look like on a real table anyway.
 */
export function counterRadius(mass: number): number {
  return 1.6 * Math.cbrt(Math.max(1, mass))
}

export function Counter({
  position,
  facing,
  side,
  mass,
  label,
  selected = false,
  destroyed = false,
  cloaked = false,
  scale,
  art,
  onClick,
}: CounterProps) {
  const r = counterRadius(mass) * scale
  const x = position.x * scale
  const y = position.y * scale

  const classes = ['counter', `side-${side}`]
  if (selected) classes.push('is-selected')
  if (destroyed) classes.push('is-destroyed')
  if (cloaked) classes.push('is-cloaked')

  return (
    <g
      className={classes.join(' ')}
      transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${courseToDegrees(facing)})`}
      onClick={onClick}
      role={onClick ? 'button' : 'img'}
      aria-label={label ? `${label}, facing ${facing} o'clock` : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {art ? (
        <image
          href={art}
          x={-r}
          y={-r}
          width={r * 2}
          height={r * 2}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        /* An arrowhead with a notched tail, so the bow is unambiguous even at
           the smallest counter size. Drawn nose-up; the group rotates it. */
        <path
          className="hull"
          d={`M 0 ${(-r).toFixed(2)}
              L ${(r * 0.72).toFixed(2)} ${(r * 0.85).toFixed(2)}
              L 0 ${(r * 0.42).toFixed(2)}
              L ${(-r * 0.72).toFixed(2)} ${(r * 0.85).toFixed(2)} Z`}
        />
      )}
      {label ? (
        /* Counter-rotated, so the name stays horizontal however the ship is
           heading — a label that turns with the hull is unreadable. */
        <text
          className="counter-label"
          transform={`rotate(${-courseToDegrees(facing)})`}
          y={r + 11}
          textAnchor="middle"
        >
          {label}
        </text>
      ) : null}
    </g>
  )
}
