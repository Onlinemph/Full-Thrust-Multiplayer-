import { useCallback, useEffect, useRef, useState } from 'react'

import { applyOrder, driveFromDef, type MovementState } from '../engine/movement'
import type { GameState, ShipState } from '../engine/game'
import { BEAM_RANGE_BAND } from '../engine/geometry'
import type { Point } from '../engine/types'
import { ArcRose } from './ArcRose'
import { useFx } from './useFx'
import { Counter } from './Counter'
import { dispatch } from './store'

/**
 * The plotting surface.
 *
 * Pan and zoom over an SVG. Everything drawn on it is something a player would
 * draw on a real table: the counters, the course each ship has plotted for this
 * turn, range rings around the selected ship, and the fire arcs of whatever
 * weapon is in hand.
 *
 * Fighter groups are flown here rather than from a panel, because a group has
 * no course and no written order — "a fighter group can move any distance up
 * to the maximum allowed and in any direction" (8.5) — so the only thing a
 * player can say about a move is *where*, and the only place to say it is the
 * table. Pick a group, click where it should go; with one picked, clicking an
 * enemy is the attack declaration of 8.7.
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
  /** The fighter group in hand, if any (8.5). */
  selectedFlightId?: string | null
  onSelectFlight?: (flightId: string | null) => void
}

const SIDE_CLASS: Record<string, 'a' | 'b' | 'c'> = { a: 'a', b: 'b', c: 'c' }

export function MapView({
  game,
  table,
  selectedId,
  onSelect,
  viewingSide,
  litArcs,
  selectedFlightId = null,
  onSelectFlight,
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

  /* Pixels per MU: fit the whole table with a margin, so a battle opens with
     both fleets on screen and nothing touching the edge. */
  const MARGIN = 24
  const fit = Math.min(
    (size.width - MARGIN * 2) / table.width,
    (size.height - MARGIN * 2) / table.height,
  )
  const scale = Math.max(0.5, fit) * zoom
  // Centre the table, then apply the player's pan on top.
  const originX = (size.width - table.width * scale) / 2 + pan.x
  const originY = (size.height - table.height * scale) / 2 + pan.y

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

  /**
   * A click on bare table, as opposed to the end of a pan.
   *
   * Four pixels of slop, because a pointer always moves a little between down
   * and up and a player who meant to click should not have their fighters
   * refuse to move for it.
   */
  const onPointerUp = (event: React.PointerEvent) => {
    const start = drag.current
    drag.current = null
    if (!start || !(flight || squadron)) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return
    const box = host.current?.getBoundingClientRect()
    if (!box) return
    flyTo({
      x: (event.clientX - box.left - originX) / scale,
      y: (event.clientY - box.top - originY) / scale,
    })
  }

  const flight = selectedFlightId
    ? game.fighterGroups.find((group) => group.id === selectedFlightId)
    : undefined
  const squadron = selectedFlightId
    ? game.gunboatSquadrons.find((group) => group.id === selectedFlightId)
    : undefined

  /** Where a click on bare table sends the group in hand (8.5, 9.1). */
  const flyTo = (to: Point) => {
    if (squadron) {
      // A squadron uses one action for both phases: 9.1 gives it 18 MU on the
      // fighter move and 9 on the secondary, and the handler reads which.
      if (game.phase === 'move-fighters' || game.phase === 'secondary-fighter-moves') {
        dispatch({ type: 'move-gunboats', squadronId: squadron.id, to })
      }
      return
    }
    if (!flight) return
    if (game.phase === 'move-fighters') dispatch({ type: 'move-flight', flightId: flight.id, to })
    else if (game.phase === 'secondary-fighter-moves') {
      dispatch({ type: 'secondary-move-flight', flightId: flight.id, to })
    }
  }

  /**
   * Clicking an enemy with a group in hand declares the attack the phase
   * allows (8.7): a dogfight in phase 8, an attack run once point defence has
   * had its say. Anything else falls through to ordinary ship selection.
   */
  const declareAgainstShip = (shipId: string): boolean => {
    const attacker = flight ?? squadron
    if (!attacker) return false
    const target = game.ships.find((s) => s.id === shipId)
    if (!target || target.side === attacker.side) return false
    if (game.phase !== 'ordnance-vs-ships' && game.phase !== 'ship-fire') return false
    dispatch(
      squadron
        ? { type: 'gunboat-attack', squadronId: squadron.id, targetId: shipId }
        : { type: 'flight-strike', flightId: attacker.id, targetId: shipId },
    )
    return true
  }

  const selected = selectedId ? game.ships.find((s) => s.id === selectedId) : undefined
  const effects = useFx()

  /**
   * The track each ship has plotted for this turn (3.4), drawn as the two legs
   * the cinematic rules actually move it through — a straight line from start
   * to finish would hide the very turn the player just plotted.
   *
   * Computed on every render rather than memoised, and deliberately: the engine
   * mutates ship state in place, so `game` is the same object from one render
   * to the next and any dependency array built from it would never invalidate.
   * The work is a few applyOrder calls over the ships on the table, which is
   * far cheaper than the bug that memoising it caused.
   */
  const tracks = game.ships
    .filter((ship) => !ship.destroyed && !ship.offTable && ship.order)
    .filter((ship) => visible(ship, viewingSide))
    .map((ship) => {
      const movement: MovementState = {
        placement: ship.placement,
        velocity: ship.velocity,
        drive: { ...driveFromDef(ship.design.drive), hits: ship.driveHits },
      }
      const result = applyOrder(movement, ship.order as NonNullable<typeof ship.order>)
      return { ship, legs: result.legs }
    })

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
        <defs>
          <pattern
            id="mu-grid"
            width={BEAM_RANGE_BAND * scale}
            height={BEAM_RANGE_BAND * scale}
            patternUnits="userSpaceOnUse"
          >
            <path
              className="plot-grid-line"
              d={`M ${BEAM_RANGE_BAND * scale} 0 L 0 0 0 ${BEAM_RANGE_BAND * scale}`}
              fill="none"
            />
          </pattern>
        </defs>
        <g transform={`translate(${originX} ${originY})`}>
          {/* The table, gridded at the beam range band, and its edge — which a
              ship can cross to leave the battle (3.9). */}
          <rect
            className="plot-grid"
            x={0}
            y={0}
            width={table.width * scale}
            height={table.height * scale}
          />
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

          {effects.map((fx) =>
            fx.from ? (
              <line
                key={fx.id}
                className={`shot is-${fx.kind}`}
                x1={fx.from.x * scale}
                y1={fx.from.y * scale}
                x2={fx.to.x * scale}
                y2={fx.to.y * scale}
                style={{ animationDelay: `${fx.delay}ms` }}
              />
            ) : (
              <circle
                key={fx.id}
                className="hit-burst"
                cx={fx.to.x * scale}
                cy={fx.to.y * scale}
                r={(fx.kind === 'destroyed' ? 8 : 4) * Math.max(1, scale / 8)}
                style={{ animationDelay: `${fx.delay}ms`, transformOrigin: `${fx.to.x * scale}px ${fx.to.y * scale}px` }}
              />
            ),
          )}

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
                inverted={ship.rollStatus.inverted}
                scale={scale}
                art={ship.design.art}
                onClick={() => {
                  if (declareAgainstShip(ship.id)) return
                  onSelect(ship.id === selectedId ? null : ship.id)
                }}
              />
            ))}

          {/* Gunboats: bigger counters than a wing, because a gunboat is
              closer to a small ship than to a fighter (9.1) — and the number
              inside is boats left, not fighters. */}
          {stackFlights(
            game.gunboatSquadrons.filter((squad) => squad.status === 'in-flight'),
          ).map(({ group, nudge }) => (
            <g
              key={group.id}
              className={`flight-group is-${SIDE_CLASS[group.side] ?? 'c'}`}
              transform={`translate(${group.position.x * scale + nudge.x} ${
                group.position.y * scale + nudge.y
              })`}
              role="button"
              aria-label={`${group.label}, ${group.boats.length} gunboats, ${group.cef} CEF`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onSelectFlight?.(group.id === selectedFlightId ? null : group.id)}
            >
              <rect
                className={`gunboat-marker${group.cef === 0 ? ' is-spent' : ''}${
                  group.id === selectedFlightId ? ' is-selected' : ''
                }`}
                x={-8}
                y={-8}
                width={16}
                height={16}
              />
              <text className="flight-cef" y={4}>
                {group.boats.length}
              </text>
              {group.id === selectedFlightId ? (
                <text className="counter-label" y={19} textAnchor="middle">
                  {group.cef > 0 ? `CEF ${group.cef}` : 'spent'}
                </text>
              ) : null}
            </g>
          ))}

          {stackFlights(game.fighterGroups.filter((group) => group.status === 'in-flight')).map(
            ({ group, nudge }) => (
              <g
                key={group.id}
                className={`flight-group is-${SIDE_CLASS[group.side] ?? 'c'}`}
                transform={`translate(${group.position.x * scale + nudge.x} ${
                  group.position.y * scale + nudge.y
                })`}
                role="button"
                aria-label={`${group.label}, ${group.strength} fighters, ${group.cef} CEF`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  if (flight && group.side !== flight.side && game.phase === 'fighter-vs-fighter') {
                    dispatch({
                      type: 'flight-dogfight',
                      flightId: flight.id,
                      targetFlightId: group.id,
                    })
                    return
                  }
                  onSelectFlight?.(group.id === selectedFlightId ? null : group.id)
                }}
              >
                {/* Strength inside, endurance beneath: a group is read as "how
                    many are left" and "how much they can still do" (8.9, 8.13).
                    Drawn after the ships, because a wing that has just left the
                    tube is on top of its carrier and would be painted over. */}
                <circle
                  className={`flight-marker${group.cef === 0 ? ' is-spent' : ''}${
                    group.id === selectedFlightId ? ' is-selected' : ''
                  }`}
                  r={7}
                />
                <text className="flight-cef" y={3}>
                  {group.strength}
                </text>
                {/* The endurance caption only on the group in hand: several
                    groups launch from the same tube and sit on the same point,
                    and three captions on one spot read as none. The panel
                    lists every group's CEF regardless. */}
                {group.id === selectedFlightId ? (
                  <text className="counter-label" y={17} textAnchor="middle">
                    {group.cef > 0 ? `CEF ${group.cef}` : 'spent'}
                  </text>
                ) : null}
              </g>
            ),
          )}
        </g>
      </svg>
    </div>
  )
}

/**
 * Groups sharing a point, fanned out so you can see there is more than one.
 *
 * Several groups launch from the same tube in the same phase and genuinely are
 * in the same place until someone flies them, so the offset is a drawing
 * nicety and nothing else: the group's position is untouched, and a click on a
 * fanned marker still moves the group from where it really is.
 */
function stackFlights<T extends { id: string; position: Point }>(
  groups: readonly T[],
): Array<{ group: T; nudge: Point }> {
  const seen = new Map<string, number>()
  return groups.map((group) => {
    const key = `${Math.round(group.position.x * 10)}:${Math.round(group.position.y * 10)}`
    const index = seen.get(key) ?? 0
    seen.set(key, index + 1)
    if (index === 0) return { group, nudge: { x: 0, y: 0 } }
    const angle = (index * 2 * Math.PI) / 6
    return { group, nudge: { x: Math.cos(angle) * 9, y: Math.sin(angle) * 9 } }
  })
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
