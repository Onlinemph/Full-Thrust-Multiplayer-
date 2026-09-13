import { useCallback, useEffect, useRef, useState } from 'react'

import {
  applyOrder,
  arrangeTouchingShips,
  driveFromDef,
  type MovementState,
} from '../engine/movement'

/**
 * How far apart two counters have to be before they stop reading as one ship.
 *
 * 3.8 gives no number — *"arranged as closely as possible"* is a table
 * instruction about physical models — so this is the smallest counter's
 * diameter, which is what "touching" means on the plot.
 */
const TOUCHING_SEPARATION = 1.6
import { stationaryCollisionRisk } from '../engine/terrain'
import { shipsAwaitingDeployment, vectorStateOf } from '../engine/game'
import { moveVector } from '../engine/vectormovement'
import { flakMarkers, novaBursts, optional } from '../engine/actions'
import { isGateActive } from '../engine/ftl'
import { FLAK_BLAST_RADIUS_MU } from '../engine/weapons/kinetics'
import { NOVA_SWEEPS } from '../engine/ew'
import type { GameState, ShipState } from '../engine/game'
import { advance, courseVector, BEAM_RANGE_BAND } from '../engine/geometry'
import type { Course, Point } from '../engine/types'
import type { TerrainKind } from '../engine/game'
import { ArcRose } from './ArcRose'
import { useFx } from './useFx'
import { Counter, counterRadius } from './Counter'
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
  /**
   * While 18.1's deployment is running, the course and velocity a click on
   * bare table gives the selected ship. Absent when there is no deployment.
   */
  deployWith?: { facing: Course; velocity: number } | null
  /**
   * The ordnance mount in hand in phase 3, if any (6.3, 6.8). A missile and a
   * plasma bolt are both aimed at a point on the table rather than at a ship,
   * so the aim is a click on bare table like a fighter's move is.
   */
  aimWith?: {
    shipId: string
    weaponId: string
    kind: 'missile' | 'plasma-bolt' | 'spinal' | 'flak'
  } | null
  /** Called once the aim point is taken, so the launcher leaves the hand. */
  onAimed?: () => void
  /**
   * 18.1: *"The defender can also place a planet or similar terrain feature."*
   * Set while the defender has the feature in hand; a click on bare table puts
   * it down. Absent in every battle that is not offensive/defensive.
   */
  placingTerrain?: { sideId: string; kind: TerrainKind; radius: number } | null
  /** Called once the feature is placed, so it leaves the hand. */
  onTerrainPlaced?: () => void
  /**
   * A ship waiting off the table that a click on bare table puts back
   * (3.9, 17.7). Both rules place it *"before orders"*, at an edge.
   */
  returnWith?: string | null
  onReturned?: () => void
}

const SIDE_CLASS: Record<string, 'a' | 'b' | 'c'> = { a: 'a', b: 'b', c: 'c' }

/** 17.8: the track is "marked with 12 clock face points". */
const CLOCK_POINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export function MapView({
  game,
  table,
  selectedId,
  onSelect,
  viewingSide,
  litArcs,
  placingTerrain = null,
  onTerrainPlaced,
  selectedFlightId = null,
  onSelectFlight,
  deployWith = null,
  aimWith = null,
  onAimed,
  returnWith = null,
  onReturned,
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
    if (!start) return
    const placing = deployWith !== null && selectedId !== null
    if (!(flight || squadron) && !placing && aimWith === null && returnWith === null) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return
    const box = host.current?.getBoundingClientRect()
    if (!box) return
    const to = {
      x: (event.clientX - box.left - originX) / scale,
      y: (event.clientY - box.top - originY) / scale,
    }
    // A ship coming back onto the table wants an edge, and nothing else in
    // phase 1 wants a bare-table click at all (3.9, 17.7).
    if (returnWith) {
      dispatch({ type: 'return-to-table', shipId: returnWith, position: to })
      onReturned?.()
      return
    }
    // An aim point is what a launcher wants and nothing else does, so a mount
    // in hand takes the click ahead of everything (6.3, 6.8).
    if (aimWith) {
      dispatch(
        aimWith.kind === 'plasma-bolt'
          ? { type: 'launch-plasma-bolt', shipId: aimWith.shipId, weaponId: aimWith.weaponId, aimPoint: to }
          : // 5.23: a Spinal Mount is laid on a point and catches everything
            // in the swathe, so it is aimed like a bolt rather than clicked
            // onto a ship.
            aimWith.kind === 'spinal'
            ? { type: 'fire-spinal-mount', shipId: aimWith.shipId, weaponId: aimWith.weaponId, aimPoint: to }
            : aimWith.kind === 'flak'
              ? { type: 'fire-flak-barrage', shipId: aimWith.shipId, weaponId: aimWith.weaponId, aimPoint: to }
              : { type: 'launch-ordnance', shipId: aimWith.shipId, weaponId: aimWith.weaponId, aimPoint: to },
      )
      onAimed?.()
      return
    }
    // 18.1's feature goes down before the fleets do, and it is the one thing
    // on the table that is nobody's ship, so it takes the click first.
    if (placingTerrain) {
      dispatch({
        type: 'place-terrain',
        sideId: placingTerrain.sideId,
        kind: placingTerrain.kind,
        position: to,
        radius: placingTerrain.radius,
      })
      onTerrainPlaced?.()
      return
    }
    // 18.1 is placement, not movement, so it wins the bare-table click while
    // it is running — there is nothing to fly yet.
    if (placing && selectedId) {
      dispatch({
        type: 'deploy-ship',
        shipId: selectedId,
        position: to,
        facing: deployWith.facing,
        velocity: deployWith.velocity,
      })
      return
    }
    flyTo(to)
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
    // A group can be selected while it is still in the bay, so that its
    // re-arming and pre-deployment orders are reachable (8.15). It cannot be
    // flown from there.
    if (!flight || flight.status !== 'in-flight') return
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
  const vector = optional(game).movementSystem === 'vector'

  // 3.8: "if two ship models would actually be touching at the end of all
  // movement, they should simply be arranged as closely as possible." Purely a
  // drawing nicety — ranges are measured from the centre of the model (4.2) and
  // the engine's positions are untouched — but two counters in the same square
  // read as one ship, and the top one takes every click.
  const drawnAt = new Map(
    arrangeTouchingShips(
      game.ships
        .filter((ship) => visible(ship, viewingSide))
        .map((ship) => ({
          id: ship.id,
          placement: { ...ship.placement, position: riderOffset(game, ship) },
        })),
      TOUCHING_SEPARATION,
    ).map((placed) => [placed.id, placed.position] as const),
  )

  const tracks = game.ships
    .filter((ship) => !ship.destroyed && !ship.offTable && (vector ? ship.vectorOrders : ship.order))
    .filter((ship) => visible(ship, viewingSide))
    .map((ship) => {
      if (vector) {
        // 12.12: the flown sequence is bookkeeping — a model "does NOT indicate
        // that the ship actually occupies that point at any time" — so the
        // sequence is drawn faint and the chord, which is the line a collision
        // is tested against, is drawn as the track.
        const flown = moveVector(vectorStateOf(ship), ship.vectorOrders ?? [], {
          rating: ship.design.drive.thrust,
          hits: ship.driveHits,
        })
        return {
          ship,
          legs: [{ to: flown.chord.to }],
          steps: flown.steps.map((step) => step.position),
          hazard:
            optional(game).terrainHazards === true &&
            game.terrain.some((feature) =>
              stationaryCollisionRisk([flown.chord.from, flown.chord.to], {
                id: feature.id,
                position: feature.position,
                radius: feature.radius,
              }),
            ),
        }
      }
      const movement: MovementState = {
        placement: ship.placement,
        velocity: ship.velocity,
        drive: { ...driveFromDef(ship.design.drive), hits: ship.driveHits },
      }
      const result = applyOrder(movement, ship.order as NonNullable<typeof ship.order>)
      // 17: whether this plot flies through something. Drawn on the track
      // rather than written in a panel, because the thing a player is judging
      // is a line on a map.
      const hazard =
        optional(game).terrainHazards === true &&
        game.terrain.some((feature) =>
          stationaryCollisionRisk(
            [ship.placement.position, ...result.legs.map((leg) => leg.to)],
            { id: feature.id, position: feature.position, radius: feature.radius },
          ),
        )
      return { ship, legs: result.legs, steps: null, hazard }
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

          {/* 18.1's deployment zones, while there is still a ship to place.
              Drawn under everything, because the thing on top of it is the
              counter the player is about to drag into it. */}
          {game.deployment && shipsAwaitingDeployment(game).length > 0
            ? Object.values(game.deployment.zones).map((zone) => (
                <rect
                  key={`zone-${zone.sideId}`}
                  className={`deployment-zone side-${SIDE_CLASS[zone.sideId] ?? 'c'}`}
                  x={zone.area.minX * scale}
                  y={zone.area.minY * scale}
                  width={Math.max(1, (zone.area.maxX - zone.area.minX) * scale)}
                  height={Math.max(1, (zone.area.maxY - zone.area.minY) * scale)}
                />
              ))
            : null}

          {game.terrain.map((feature) => (
            <circle
              key={feature.id}
              className={feature.kind === 'planet' ? 'terrain-body' : 'terrain-cloud'}
              cx={feature.position.x * scale}
              cy={feature.position.y * scale}
              r={feature.radius * scale}
            />
          ))}

          {/* 11.9's gates. Drawn as a ring with a tick on the entry facing,
              because "the marker or model should be clearly marked to show
              which way it is oriented" — and a player who cannot see which
              side of the gate bears on them cannot use it. */}
          {game.gates.map((gate) => {
            const active = isGateActive(gate.def, gate.state, game.turn)
            const at = gate.def.position
            const r = 2.4 * scale
            const nose =
              gate.def.facing === null ? null : advance(at, gate.def.facing, 3.6)
            return (
              <g key={gate.def.id}>
                <circle
                  className={
                    `gate is-${gate.def.kind}` + (active ? '' : ' is-inactive')
                  }
                  cx={at.x * scale}
                  cy={at.y * scale}
                  r={r}
                />
                {nose ? (
                  <line
                    className={`gate is-${gate.def.kind}` + (active ? '' : ' is-inactive')}
                    x1={at.x * scale}
                    y1={at.y * scale}
                    x2={nose.x * scale}
                    y2={nose.y * scale}
                  />
                ) : null}
                <text className="gate-label" x={at.x * scale} y={(at.y + 4.4) * scale}>
                  {gate.def.label ?? gate.def.id}
                </text>
              </g>
            )
          })}

          {/* 17.8's orbit track: the planet's own edge, marked with the twelve
              clock points a ship is placed on. Without the markers the rule is
              invisible — a player cannot see which point is "immediately in
              front or behind". */}
          {game.terrain
            .filter((feature) => feature.orbit)
            .flatMap((feature) =>
              CLOCK_POINTS.map((marker) => {
                const at = advance(feature.position, marker, feature.radius)
                return (
                  <circle
                    key={`${feature.id}-m${marker}`}
                    className="orbit-marker"
                    cx={at.x * scale}
                    cy={at.y * scale}
                    r={Math.max(1.5, 0.6 * scale)}
                  />
                )
              }),
            )}

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

          {tracks.map(({ ship, legs, steps, hazard }) => (
            <g key={`track-${ship.id}`}>
              {steps ? (
                <polyline
                  className="track-sequence"
                  points={[
                    `${ship.placement.position.x * scale},${ship.placement.position.y * scale}`,
                    ...steps.map((p) => `${p.x * scale},${p.y * scale}`),
                  ].join(' ')}
                />
              ) : null}
              <polyline
                className={hazard ? 'track is-hazard' : 'track'}
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
              // A mine sits still and a plasma bolt is a place rather than a
              // thing on its way somewhere, so neither reads as a missile.
              className={`missile-marker is-${marker.kind}`}
              cx={marker.position.x * scale}
              cy={marker.position.y * scale}
              r={marker.kind === 'plasma-bolt' ? 5 : 3}
            />
          ))}

          {/* 7.23's nova template: the swept band, drawn as a capsule from the
              start of this generation's sweep to its end at the template's own
              radius. It is the one thing on the table a player has to see to
              plan around — it is coming through in a straight line for three
              turns, and it does not care whose ships are in the lane. */}
          {novaBursts(game).map((burst, index) => {
            const sweep = NOVA_SWEEPS[burst.stage]
            const unit = courseVector(burst.course)
            const from = {
              x: (burst.origin.x + unit.x * sweep.fromMu) * scale,
              y: (burst.origin.y + unit.y * sweep.fromMu) * scale,
            }
            const to = {
              x: (burst.origin.x + unit.x * sweep.toMu) * scale,
              y: (burst.origin.y + unit.y * sweep.toMu) * scale,
            }
            return (
              <line
                key={`nova-${index}`}
                className="nova-sweep"
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                strokeWidth={sweep.diameter * scale}
              />
            )
          })}

          {/* 5.16's Blast Marker. Drawn at its true 2 MU radius, because the
              thing a player has to read off the table is which lane is now
              lethal — and 5.16 does not ask whose fighters fly down it. */}
          {flakMarkers(game).map((marker) => (
            <circle
              key={marker.id}
              className={`flak-marker side-${marker.side}`}
              cx={marker.position.x * scale}
              cy={marker.position.y * scale}
              r={FLAK_BLAST_RADIUS_MU * scale}
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

          {/* 12.12's course marker: "an arrow marker placed next to the model,
              indicating the direction of the ship's current COURSE". Without
              it a vector board cannot be read at all, because the counter is
              pointing somewhere else. */}
          {vector
            ? game.ships
                .filter((ship) => !ship.destroyed && !ship.offTable)
                .filter((ship) => visible(ship, viewingSide))
                .map((ship) => {
                  const state = vectorStateOf(ship)
                  const length = Math.max(3, state.velocity) * scale
                  return (
                    <g
                      key={`course-${ship.id}`}
                      className={`course-marker side-${SIDE_CLASS[ship.side] ?? 'c'}`}
                      transform={
                        `translate(${ship.placement.position.x * scale} ` +
                        `${ship.placement.position.y * scale}) rotate(${state.course})`
                      }
                    >
                      <line x1={0} y1={0} x2={0} y2={-length} />
                      <path d={`M 0 ${-length} l -3 6 l 3 -2 l 3 2 Z`} />
                    </g>
                  )
                })
            : null}

          {game.ships
            .filter((ship) => visible(ship, viewingSide))
            .map((ship) => (
              <Counter
                key={ship.id}
                position={drawnAt.get(ship.id) ?? riderOffset(game, ship)}
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
/**
 * Where an attached battlerider is drawn (11.7).
 *
 * A rider holds the Mothership's exact station, which on a real table is one
 * model with riders clipped to its flanks and here would be two counters in
 * the same place — the top one unclickable and the bottom one invisible. They
 * are nudged clear so the player can see what is riding what and pick either.
 */
function riderOffset(game: GameState, ship: ShipState): Point {
  if (ship.carriedBy === null) return ship.placement.position
  const carrier = game.ships.find((other) => other.id === ship.carriedBy)
  if (!carrier) return ship.placement.position
  const siblings = game.ships.filter((other) => other.carriedBy === ship.carriedBy)
  const index = siblings.findIndex((other) => other.id === ship.id)
  // Clamped to the flanks: perpendicular to the Mothership's heading, one
  // counter's width clear of both hulls, alternating port and starboard so a
  // second pair sits outboard of the first.
  const gap = counterRadius(carrier.design.mass) + counterRadius(ship.design.mass) + 0.6
  const beam = (Math.floor(index / 2) + 1) * gap * (index % 2 === 0 ? -1 : 1)
  const heading = ((carrier.placement.facing % 12) * Math.PI) / 6
  return {
    x: carrier.placement.position.x + beam * Math.cos(heading),
    y: carrier.placement.position.y + beam * Math.sin(heading),
  }
}

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
  // A hull that is not on the table has no counter on it. 11.5's inbound
  // ships and 11.9's ships waiting behind a gate are listed in their phase's
  // panel instead, and a hull that flew off the edge (3.9) has gone. Drawing
  // them at whatever station they were last written at put four counters on
  // top of a Jump Gate before anybody had come through it.
  if (ship.offTable) return false
  if (viewingSide === null) return true
  if (!ship.cloaked) return true
  return ship.side === viewingSide
}
