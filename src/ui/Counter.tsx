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
  /**
   * Rolled 180° on its long axis (16.2): *"a marker is placed by the model to
   * indicate its inverted condition"*. Here the marker is a bar across the
   * hull, because the one thing it has to say is that this ship's port guns
   * are firing to starboard.
   */
  inverted?: boolean
  /** Pixels per MU, from the map's zoom. */
  scale: number
  /** Custom counter art, drawn nose-up and fitted to the counter. */
  art?: string
  onClick?: () => void
}

/**
 * Counter size in MU from hull mass.
 *
 * Two constraints fix this. It must be compressed — mass runs from about 10 to
 * 300 in play and a counter thirty times another's size would be unusable — and
 * it must stay small against the ranges, because a counter that reads as
 * several MU across makes a 12 MU range band look like nothing. The cube root
 * handles the first; the coefficient handles the second, putting a mass-20
 * frigate at about 1.2 MU and a mass-300 dreadnought at about 3, which is
 * roughly what the miniatures look like on a real table.
 */
export function counterRadius(mass: number): number {
  return 0.45 * Math.cbrt(Math.max(1, mass))
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
  inverted = false,
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
  if (inverted) classes.push('is-inverted')

  return (
    <g
      className={classes.join(' ')}
      transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${courseToDegrees(facing)})`}
      onClick={onClick}
      role={onClick ? 'button' : 'img'}
      aria-label={
        label
          ? `${label}, facing ${facing} o'clock${inverted ? ', inverted' : ''}`
          : undefined
      }
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
      {inverted ? (
        /* A bar across the beam. It rotates with the hull on purpose: the bar
           lies along the axis the ship has turned over about, which is the
           thing being marked (16.2). */
        <line
          className="counter-inverted"
          x1={(-r * 0.95).toFixed(2)}
          y1={(r * 0.15).toFixed(2)}
          x2={(r * 0.95).toFixed(2)}
          y2={(r * 0.15).toFixed(2)}
        />
      ) : null}
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
