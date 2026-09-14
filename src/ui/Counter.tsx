import { courseToDegrees } from '../engine/geometry'
import type { Course, Point, ShipDesign } from '../engine/types'
import { COUNTER_EXTENT, counterSilhouette } from './ssd/layout'

/**
 * A ship counter on the plotting surface.
 *
 * The same hull as the ship's own sheet, at a twentieth of the size. Not a
 * likeness of it and not a second drawing of the same idea: `counterSilhouette`
 * runs the same layout the sheet does and hands back the same outline, so a
 * ship that reads as a long streamlined needle on paper reads as one on the
 * table, a broadside ship carries its sponsons, a carrier its flight deck, and
 * a starbase reads as the octagon it is drawn as.
 *
 * The guns come with it. At the size a counter usually is, each battery is a
 * bar across the hull where the sheet drew its row — a bow battery a bar at
 * the bow, a broadside a bar down each flank — and once the map is zoomed in
 * far enough for a dot per gun to mean something, it is dots per gun. The bow
 * is filled in whatever the size, because which way it points is the one thing
 * a player must never have to guess (3.1, 4.2, 4.10).
 *
 * Presentational and prop-driven: it knows nothing about game state, so the
 * map, the fleet picker and the designer can all draw the same counter.
 */
export interface CounterProps {
  position: Point
  facing: Course
  side: 'a' | 'b' | 'c'
  /** The hull. Its mass sets the counter's size (2.3), its build the shape. */
  design: ShipDesign
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

/**
 * Below this many pixels of half-length, a dot per gun is a smear and the
 * batteries are drawn as bars instead.
 */
const DOTS_FROM_PX = 34
/** A gun's dot and a battery's bar, in the counter's ±1000 box. */
const DOT_RADIUS = 58
const BAR_WIDTH = 95

export function Counter({
  position,
  facing,
  side,
  design,
  label,
  selected = false,
  destroyed = false,
  cloaked = false,
  inverted = false,
  scale,
  art,
  onClick,
}: CounterProps) {
  const r = counterRadius(design.mass) * scale
  const x = position.x * scale
  const y = position.y * scale
  const silhouette = counterSilhouette(design)
  const shrink = r / COUNTER_EXTENT

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
        <g transform={`scale(${shrink.toFixed(5)})`}>
          <path className="hull" d={silhouette.path} />
          {silhouette.bow !== '' ? <path className="counter-bow" d={silhouette.bow} /> : null}
          {silhouette.spine !== null ? (
            <line
              className="counter-spinal"
              x1={0}
              y1={silhouette.spine.y1}
              x2={0}
              y2={silhouette.spine.y2}
            />
          ) : null}
          {/* A gun is drawn the size the sheet drew it: a Beam-4 is a dot
              twice the area of a Beam-1, and a battery of big guns is a
              heavier bar than a battery of small ones. */}
          {r >= DOTS_FROM_PX
            ? silhouette.guns.map((gun, i) => (
                <circle
                  key={i}
                  className="counter-gun"
                  cx={gun.x}
                  cy={gun.y}
                  r={(DOT_RADIUS * gun.weight).toFixed(0)}
                />
              ))
            : silhouette.bars.map((bar, i) => (
                <line
                  key={i}
                  className={`counter-battery is-${bar.kind}`}
                  x1={bar.x0}
                  y1={bar.y}
                  x2={bar.x1}
                  y2={bar.y}
                  strokeWidth={(BAR_WIDTH * bar.weight).toFixed(0)}
                />
              ))}
          {r >= DOTS_FROM_PX
            ? silhouette.bars
                .filter((bar) => bar.kind === 'bay')
                .map((bar, i) => (
                  <line
                    key={`bay-${i}`}
                    className="counter-battery is-bay"
                    x1={bar.x0}
                    y1={bar.y}
                    x2={bar.x1}
                    y2={bar.y}
                    strokeWidth={BAR_WIDTH}
                  />
                ))
            : null}
        </g>
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
