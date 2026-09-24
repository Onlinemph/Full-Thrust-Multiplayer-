import { ARC_ORDER, type Arc } from '../engine/types'
import type { GameState, ShipState } from '../engine/game'
import { courseToDegrees, DEGREES_PER_ARC } from '../engine/geometry'
import { describeReady, fireArcs } from './fireArcs'

/**
 * The firing arcs, drawn on the table (4.2).
 *
 * Phase 1 has its compass; this is phase 11's. A ring of six wedges round the
 * selected ship, turned to its heading, each saying what bears into that arc
 * — "B3 ×2, B2" — and how many enemy hulls are standing in it. A wedge with
 * nothing to fire is dim; one with a target in it is marked. Resting the
 * pointer on a wedge lights the arc across the whole table and picks out the
 * mounts that bear into it on the panel, which is the question a gunner is
 * asking: "what can I hit them with?"
 *
 * Like the compass it is HTML over the plot, positioned by the map at the
 * counter's screen point, and it reads only; every shot is still declared on
 * the panel, and the journal never sees it. It takes no pointer events at
 * all: the map works out which wedge the pointer is on from its position
 * (`roseRing`), so a counter standing under the ring, or the point in front
 * of the bow a Spinal Mount is laid to, is still there to be clicked. When
 * the wedges took the pointer themselves, they swallowed those clicks — the
 * next ship to fire sat under the last one's rose and could not be picked.
 */
export interface FireRoseProps {
  game: GameState
  ship: ShipState
  x: number
  y: number
  /** The counter's radius in pixels: the rose is drawn clear of the hull. */
  clearance: number
  /** Pixels per MU, from the map's zoom (ships-map #13: the rose shrinks a
   *  little at low zoom, so it reaches fewer neighbours it doesn't need to). */
  scale: number
  /** The arc the pointer is on, lit on the rose too. */
  litArc: Arc | null
}

/** Roughly the app's own default fit-to-table zoom (the mock's own measurement). */
const ROSE_ZOOM_REFERENCE = 10

/**
 * The ring the wedges occupy, in pixels from the counter's centre: clear of
 * the hull and of the name written under it, and up to 58 deep. The map uses
 * the same ring to tell which wedge the pointer is on.
 *
 * The floor shrinks a little as the player zooms out (ships-map #13) — never
 * below three quarters of its full size, which is as far as the wedge text
 * stays legible — so the rose reaches fewer of an ordinary formation's
 * neighbours at the zoom a battle actually opens at.
 */
export function roseRing(clearance: number, scale: number): { inner: number; outer: number } {
  const zoom = Math.max(0.75, Math.min(1, scale / ROSE_ZOOM_REFERENCE))
  const inner = Math.max(44 * zoom, clearance + 28 * zoom)
  return { inner, outer: inner + 58 * zoom }
}

/** Where a wedge's label goes: the wedge's middle, so far out. */
function polar(degrees: number, radius: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180
  return { x: Math.sin(radians) * radius, y: -Math.cos(radians) * radius }
}

function wedgePath(startDegrees: number, inner: number, outer: number): string {
  const a = polar(startDegrees, outer)
  const b = polar(startDegrees + DEGREES_PER_ARC, outer)
  const c = polar(startDegrees + DEGREES_PER_ARC, inner)
  const d = polar(startDegrees, inner)
  return (
    `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${outer} ${outer} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} ` +
    `L ${c.x.toFixed(2)} ${c.y.toFixed(2)} A ${inner} ${inner} 0 0 0 ${d.x.toFixed(2)} ${d.y.toFixed(2)} Z`
  )
}

export function FireRose({ game, ship, x, y, clearance, scale, litArc }: FireRoseProps) {
  const summaries = fireArcs(game, ship)
  const { inner, outer } = roseRing(clearance, scale)
  const base = courseToDegrees(ship.placement.facing) - DEGREES_PER_ARC / 2
  const size = outer * 2 + 4

  return (
    <div
      className="fire-rose"
      style={{ left: x, top: y }}
      role="group"
      aria-label={`Fire arcs of ${ship.name}`}
    >
      {/* Inline geometry, because the plot styles every svg under it as the
          plot itself — full width, pinned to the corner — and a rose given
          that treatment is a rose of no size at all. */}
      <svg
        width={size}
        height={size}
        viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
        style={{
          position: 'absolute',
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          transform: 'none',
          overflow: 'visible',
        }}
      >
        {ARC_ORDER.map((arc, index) => {
          const summary = summaries[index]!
          const start = base + index * DEGREES_PER_ARC
          const mid = start + DEGREES_PER_ARC / 2
          const at = polar(mid, (inner + outer) / 2)
          const armed = summary.ready.length > 0
          const classes = ['fire-wedge']
          if (armed) classes.push('is-armed')
          if (summary.targets.length > 0) classes.push('has-target')
          if (litArc === arc) classes.push('is-lit')
          const names = describeReady(summary.ready)
          const title = `${arc}: ${
            armed ? `${names}, out to ${summary.reach} MU` : 'nothing bears'
          }${summary.spent > 0 ? `; ${summary.spent} spent or knocked out` : ''}${
            summary.targets.length > 0
              ? ` — ${summary.targets.map((t) => `${t.name} at ${t.range.toFixed(1)} MU`).join(', ')}`
              : ''
          }`
          return (
            <g key={arc} className={classes.join(' ')} aria-label={title}>
              <path d={wedgePath(start, inner, outer)} />
              <text
                className="fire-wedge-arc"
                x={at.x.toFixed(1)}
                y={(at.y - 9).toFixed(1)}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {arc}
              </text>
              <text
                className="fire-wedge-guns"
                x={at.x.toFixed(1)}
                y={(at.y + 5).toFixed(1)}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {armed ? names.length > 11 ? `${summary.ready.length} mounts` : names : '—'}
              </text>
              {summary.targets.length > 0 ? (
                <text
                  className="fire-wedge-targets"
                  x={at.x.toFixed(1)}
                  y={(at.y + 18).toFixed(1)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {'◆'.repeat(Math.min(summary.targets.length, 4))}
                  {summary.targets.length > 4 ? '+' : ''}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
