import type { FighterGroupState, GameState, ShipState } from '../engine/game'
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
 * What a group can do depends on the phase, so the panel offers only what the
 * phase allows. The launch limit is the carrier's launch tubes (8.2), and
 * recovery is half that unless the carrier accepts a combat landing (8.4).
 */
export interface FlightPanelProps {
  game: GameState
  /** The carrier selected, if one is; otherwise every flight of every side. */
  ship?: ShipState
}

export function FlightPanel({ game, ship }: FlightPanelProps) {
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
          {tubes} launch tube{tubes === 1 ? '' : 's'} — {tubes} group
          {tubes === 1 ? '' : 's'} out a turn, {Math.max(1, Math.floor(tubes / 2))} back in (8.2,
          8.4).
        </p>
      ) : null}

      {flights.map((flight) => (
        <div key={flight.id} className="panel-row flight-row">
          <span className={`flight-strength num is-${flight.status}`}>{flight.strength}</span>
          <span className="flight-name">{flight.label}</span>
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
              disabled={!flight.carrierId}
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

          {flight.status === 'in-flight' && phase === 'fighter-vs-fighter' ? (
            <button
              disabled={flight.cef === 0}
              title={flight.cef === 0 ? 'No endurance left (8.13)' : undefined}
              onClick={() => dispatch({ type: 'flight-evade', flightId: flight.id })}
            >
              Evade
            </button>
          ) : null}

          {/* Recovery happens on the fighter move, not in a phase of its own:
              a group flies back to its carrier and lands, and landing under
              fire is a combat landing (8.1, 8.4). */}
          {flight.status === 'in-flight' &&
          phase === 'secondary-fighter-moves' &&
          flight.carrierId ? (
            <button
              onClick={() =>
                dispatch({
                  type: 'recover-flight',
                  flightId: flight.id,
                  carrierId: flight.carrierId ?? '',
                })
              }
            >
              Recover
            </button>
          ) : null}

          <span className={`flight-status is-${flight.status}`}>
            {flight.status === 'aboard'
              ? 'in the bay'
              : flight.status === 'destroyed'
                ? 'lost'
                : flight.dogfightWith
                  ? 'dogfighting'
                  : 'in flight'}
          </span>
        </div>
      ))}
    </div>
  )
}

/** A flight close enough to this carrier to be worth listing beside it. */
function nearby(flight: FighterGroupState, ship: ShipState): boolean {
  return (
    flight.status === 'in-flight' &&
    flight.side === ship.side &&
    distance(flight.position, ship.placement.position) <= 24
  )
}
