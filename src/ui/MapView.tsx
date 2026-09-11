import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { applyOrder, driveFromDef, type MovementState } from '../engine/movement'
import type { GameState, ShipState } from '../engine/game'
import { BEAM_RANGE_BAND } from '../engine/geometry'
import type { Point } from '../engine/types'
import { ArcRose } from './ArcRose'
import { Counter } from './Counter'

/**
 * The plotting surface.
 *
 * Pan and zoom over an SVG. Everything drawn on it is something a player would
 * draw on a real table: the counters, the course each ship has plotted for this
 * turn, range rings around the selected ship, and the fire arcs of whatever
 * weapon is in hand.
 */
export interface MapViewProps {
  game: GameState
  table: { width: number; height: number }
  selectedId: string | null
  onSelect: (shipId: string | null) => void
  /** Which side's eyes we are looking through; null is the open table. */
  viewingSide: string | null
  /** Arcs to light up on the selected ship — the weapon currently in hand. */
  litArcs?: readonly ('F' | 'FS' | 'AS' | 'A' | 'AP' | 'FP')[]
}

const SIDE_CLASS: Record<string, 'a' | 'b' | 'c'> = { a: 'a', b: 'b', c: 'c' }

export function MapView({
  game,
  table,
  selectedId,
  onSelect,
  viewingSide,
  litArcs,
}: MapViewProps) {
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 960, height: 640 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  useEffect(() => {
    const element = host.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect
      setSize({ width: box.width, height: box.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  /* Pixels per MU: fit the whole table by default, so a battle opens with both
     fleets on screen rather than at an arbitrary magnification. */
  const fit = Math.min(size.width / table.width, size.height / table.height)
  const scale = fit * zoom

  const onWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault()
    setZoom((z) => Math.min(6, Math.max(0.5, z * (event.deltaY < 0 ? 1.12 : 1 / 1.12))))
  }, [])

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const start = drag.current
    if (!start) return
    setPan({
      x: start.panX + (event.clientX - start.x),
      y: start.panY + (event.clientY - start.y),
    })
  }

  const onPointerUp = () => {
    drag.current = null
  }

  const selected = selectedId ? game.ships.find((s) => s.id === selectedId) : undefined

  /**
   * The track each ship has plotted for this turn (3.4), drawn as the two legs
   * the cinematic rules actually move it through — a straight line from start
   * to finish would hide the very turn the player just plotted.
   */
  const tracks = useMemo(() => {
    return game.ships
      .filter((ship) => !ship.destroyed && !ship.offTable && ship.order)
      .filter((ship) => visible(ship, viewingSide))
      .map((ship) => {
        const movement: MovementState = {
          placement: ship.placement,
          velocity: ship.velocity,
          drive: { ...driveFromDef(ship.design.drive), hits: ship.driveHits },
        }
        const result = applyOrder(movement, ship.order!)
        return { ship, legs: result.legs }
      })
  }, [game, game.turn, viewingSide])

  return (
    <div
      className="plot"
      ref={host}
      style={{ ['--mu' as string]: `${scale}px` }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="application"
      aria-label="Plotting surface"
    >
      <svg>
        <g transform={`translate(${pan.x} ${pan.y})`}>
          {/* The table edge. A ship that crosses it has left the battle (3.9). */}
          <rect
            x={0}
            y={0}
            width={table.width * scale}
            height={table.height * scale}
            fill="none"
            stroke="var(--line)"
            strokeWidth={1}
          />

          {game.terrain.map((feature) => (
            <circle
              key={feature.id}
              className={feature.kind === 'planet' ? 'terrain-body' : 'terrain-cloud'}
              cx={feature.position.x * scale}
              cy={feature.position.y * scale}
              r={feature.radius * scale}
            />
          ))}

          {/* Range rings on the selected ship, at the beam band boundaries
              (4.3). Drawn under the counters so they never obscure a hull. */}
          {selected
            ? [1, 2, 3].map((band) => (
                <circle
                  key={band}
                  className="range-ring"
                  cx={selected.placement.position.x * scale}
                  cy={selected.placement.position.y * scale}
                  r={BEAM_RANGE_BAND * band * scale}
                />
              ))
            : null}

          {/* Fire arcs of the weapon in hand, on the selected ship only — six
              overlapping fans would be unreadable. */}
          {selected && litArcs?.length ? (
            <g
              transform={`translate(${selected.placement.position.x * scale} ${
                selected.placement.position.y * scale
              })`}
            >
              <ArcRose
                facing={selected.placement.facing}
                lit={litArcs}
                radius={BEAM_RANGE_BAND * 3 * scale}
              />
            </g>
          ) : null}

          {tracks.map(({ ship, legs }) => (
            <g key={`track-${ship.id}`}>
              <polyline
                className="track"
                points={[
                  `${ship.placement.position.x * scale},${ship.placement.position.y * scale}`,
                  ...legs.map((leg) => `${leg.to.x * scale},${leg.to.y * scale}`),
                ].join(' ')}
              />
              {legs.length > 0 ? (
                <circle
                  className="track-end"
                  cx={legs[legs.length - 1].to.x * scale}
                  cy={legs[legs.length - 1].to.y * scale}
                  r={3}
                />
              ) : null}
            </g>
          ))}

          {game.ordnance.map((marker) => (
            <circle
              key={marker.id}
              className="missile-marker"
              cx={marker.position.x * scale}
              cy={marker.position.y * scale}
              r={3}
            />
          ))}

          {game.fighterGroups
            .filter((group) => group.status === 'in-flight')
            .map((group) => (
              <g
                key={group.id}
                transform={`translate(${group.position.x * scale} ${group.position.y * scale})`}
              >
                <circle className="flight-marker" r={6} />
                <text className="flight-cef" y={3}>
                  {group.strength}
                </text>
              </g>
            ))}

          {game.ships
            .filter((ship) => visible(ship, viewingSide))
            .map((ship) => (
              <Counter
                key={ship.id}
                position={ship.placement.position}
                facing={ship.placement.facing}
                side={SIDE_CLASS[ship.side] ?? 'c'}
                mass={ship.design.mass}
                label={ship.name}
                selected={ship.id === selectedId}
                destroyed={ship.destroyed}
                cloaked={ship.cloaked}
                scale={scale}
                art={ship.design.art}
                onClick={() => onSelect(ship.id === selectedId ? null : ship.id)}
              />
            ))}
        </g>
      </svg>
    </div>
  )
}

/**
 * Whether a ship is on this console's map.
 *
 * A cloaked ship is drawn as a ghost to its own side and not at all to the
 * enemy (7.20). On the open table — hot-seat with nobody hiding anything —
 * everything is drawn.
 */
function visible(ship: ShipState, viewingSide: string | null): boolean {
  if (viewingSide === null) return true
  if (!ship.cloaked) return true
  return ship.side === viewingSide
}
