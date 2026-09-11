import type { FighterGroupState, GameState, ShipState } from '../engine/game'
import { isExhausted, mainMoveAllowance, secondaryMoveAllowance } from '../engine/fighters'
import { distance } from '../engine/geometry'
import { dispatch } from './store'

/**
 * Flight operations (8).
 *
 * A carrier's wing is the one part of a Full Thrust fleet that is a resource
 * rather than a weapon: six fighters to a group, six points of Combat
 * Endurance between them, and every attack, every secondary move and every
 * evade spends one (8.13). A group that has run its endurance out can still
 * fly home but can do nothing on the way, so the CEF number is the one a
 * player plans around — which is why it is the largest thing on each row.
 *
 * Movement and attacks are not here: a group has no course and no written
 * order, so the only thing to say about a move is *where*, and that is said on
 * the table (8.5, 8.7). What is left for a panel is the decisions with no
 * point attached — launch, land, evade — and the state a player needs to make
 * them.
 */
export interface FlightPanelProps {
  game: GameState
  /** The carrier selected, if one is; otherwise every flight of every side. */
  ship?: ShipState
  selectedFlightId?: string | null
  onSelectFlight?: (flightId: string | null) => void
}

export function FlightPanel({
  game,
  ship,
  selectedFlightId = null,
  onSelectFlight,
}: FlightPanelProps) {
  const flights = ship
    ? game.fighterGroups.filter((g) => g.carrierId === ship.id || nearby(g, ship))
    : game.fighterGroups
  if (flights.length === 0) return null

  const phase = game.phase
  const tubes = ship
    ? ship.design.systems.filter((s) => s.kind === 'launch-tube' && !ship.destroyedSystems.has(s.id))
        .length
    : 0

  return (
    <div className="panel">
      <h3>Flight operations</h3>
      {ship && tubes > 0 ? (
        <p className="rule-detail">
          {tubes} launch tube{tubes === 1 ? '' : 's'} — {tubes} group{tubes === 1 ? '' : 's'} in or
          out a turn between them, and none at all if the carrier uses its drive (8.1, 8.2).
        </p>
      ) : null}
      {phase === 'move-fighters' || phase === 'secondary-fighter-moves' ? (
        <p className="rule-detail">
          Pick a group, then click the table to fly it — {' '}
          {phase === 'move-fighters' ? 'free' : '1 CEF'} (8.5).
        </p>
      ) : null}

      {flights.map((flight) => (
        <div
          key={flight.id}
          className={`panel-row flight-row${flight.id === selectedFlightId ? ' is-selected' : ''}`}
        >
          <button
            className="flight-pick"
            aria-pressed={flight.id === selectedFlightId}
            disabled={flight.status !== 'in-flight'}
            onClick={() => onSelectFlight?.(flight.id === selectedFlightId ? null : flight.id)}
          >
            <span className={`flight-strength num is-${flight.status}`}>{flight.strength}</span>
            <span className="flight-name">{flight.label}</span>
          </button>
          <span className="spacer" />
          {/* Endurance is the number a wing is planned around (8.13). */}
          <span
            className={`num flight-cef-readout${flight.cef === 0 ? ' is-spent' : ''}`}
            title="Combat Endurance Factors remaining (8.13)"
          >
            CEF {flight.cef}
          </span>

          {flight.status === 'aboard' && phase === 'move-fighters' ? (
            <button
              disabled={!flight.carrierId || flight.grounded}
              title={flight.grounded ? 'This group will not fly again (8.4, 8.16)' : undefined}
              onClick={() =>
                dispatch({
                  type: 'launch-flight',
                  carrierId: flight.carrierId ?? '',
                  flightId: flight.id,
                })
              }
            >
              Launch
            </button>
          ) : null}

          {/* 8.6: evasion answers announced ship fire, and nothing else — point
              defence cannot be evaded. */}
          {flight.status === 'in-flight' && phase === 'ship-fire' ? (
            <button
              disabled={isExhausted(flight) || flight.evading}
              title={isExhausted(flight) ? 'No endurance left (8.13)' : undefined}
              onClick={() => dispatch({ type: 'flight-evade', flightId: flight.id })}
            >
              {flight.evading ? 'Evading' : 'Evade'}
            </button>
          ) : null}

          {/* Landing is part of a fighter move, so it is offered in the phases
              a group can fly home in (8.1). */}
          {flight.status === 'in-flight' &&
          (phase === 'move-fighters' || phase === 'secondary-fighter-moves') &&
          flight.carrierId ? (
            <button
              disabled={!withinReach(flight, game, phase === 'secondary-fighter-moves')}
              title={reachNote(flight, game, phase === 'secondary-fighter-moves')}
              onClick={() =>
                dispatch({
                  type: 'recover-flight',
                  flightId: flight.id,
                  carrierId: flight.carrierId ?? '',
                })
              }
            >
              Land
            </button>
          ) : null}

          <span className={`flight-status is-${flight.status}`}>{describe(flight)}</span>
        </div>
      ))}
    </div>
  )
}

function describe(flight: FighterGroupState): string {
  if (flight.status === 'aboard') return flight.grounded ? 'written off' : 'in the bay'
  if (flight.status === 'destroyed') return 'lost'
  if (flight.evading) return 'evading'
  if (flight.engagedWith.length > 0) return 'dogfighting'
  return 'in flight'
}

/** A flight close enough to this carrier to be worth listing beside it. */
function nearby(flight: FighterGroupState, ship: ShipState): boolean {
  return (
    flight.status === 'in-flight' &&
    flight.side === ship.side &&
    distance(flight.position, ship.placement.position) <= 24
  )
}

/**
 * Whether the group can reach its carrier in this phase (8.1): "The fighter
 * group moves into contact with the carrier in the Fighter Movement Phase", so
 * the flight home is measured against the allowance of whichever phase it is.
 */
function withinReach(flight: FighterGroupState, game: GameState, secondary: boolean): boolean {
  const carrier = game.ships.find((s) => s.id === flight.carrierId)
  if (!carrier) return false
  const allowance = secondary
    ? secondaryMoveAllowance(flight)
    : mainMoveAllowance(flight, game.turn)
  return distance(flight.position, carrier.placement.position) <= allowance
}

function reachNote(flight: FighterGroupState, game: GameState, secondary: boolean): string {
  if (withinReach(flight, game, secondary)) {
    return secondary ? 'Lands on its secondary move — 1 CEF (8.1, 8.13)' : 'Lands this turn (8.1)'
  }
  return 'Too far from the carrier to land this turn (8.1)'
}
