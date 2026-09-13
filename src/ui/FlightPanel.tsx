import type {
  FighterGroupState,
  GameState,
  GunboatSquadronState,
  ShipState,
} from '../engine/game'
import { isExhausted, mainMoveAllowance, secondaryMoveAllowance } from '../engine/fighters'
import {
  GUNBOAT_MOVE,
  GUNBOAT_SECONDARY_MOVE,
  isSquadronExhausted,
} from '../engine/gunboats'
import { distance } from '../engine/geometry'
import { combatLandingAvailable } from '../engine/flightorders'
import { FlightOrders } from './FlightOrders'
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
  const squadrons = ship
    ? game.gunboatSquadrons.filter((g) => g.carrierId === ship.id || nearby(g, ship))
    : game.gunboatSquadrons
  if (flights.length === 0 && squadrons.length === 0) return null

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

      {/* 8.4: "the carrier may perform a combat landing" — everyone down at
          once, and the deck is fouled for the rest of the game. A carrier's
          order rather than a group's, which is why it is not on the rows. */}
      {ship && combatLandingAvailable(game, ship.id) ? (
        <div className="panel-row">
          <span>Combat landing</span>
          <span className="spacer" />
          <button onClick={() => dispatch({ type: 'combat-landing', carrierId: ship.id })}>
            Everyone down
          </button>
          <span style={{ color: 'var(--warn)' }}>fouls the deck for the game (8.4)</span>
        </div>
      ) : null}

      {flights.map((flight) => (
        <div
          key={flight.id}
          className={`panel-row flight-row${flight.id === selectedFlightId ? ' is-selected' : ''}`}
        >
          {/* A group in the bay is selectable too: 8.15's re-arming and the
              FTL groups' pre-deployment are orders given to a group that has
              not launched, and a disabled row put both out of reach. */}
          <button
            className="flight-pick"
            aria-pressed={flight.id === selectedFlightId}
            title={flight.label}
            disabled={flight.status === 'destroyed'}
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

      {/* Everything a group can be told to do that is not "fly there". Shown
          for the selected group only: fifteen controls on every row would bury
          the three that matter most turns. */}
      {selectedFlightId
        ? flights
            .filter((flight) => flight.id === selectedFlightId)
            .map((flight) => <FlightOrders key={`orders-${flight.id}`} game={game} flight={flight} />)
        : null}

      {squadrons.length > 0 ? (
        <>
          <h4>Gunboats</h4>
          <p className="rule-detail">
            Six to a squadron, 18 MU a move and 12 MU of fire control — but anti-ship guns kill one
            gunboat per hit, and a rack cannot take a squadron back (9.1).
          </p>
          {squadrons.map((squadron) => (
            <div
              key={squadron.id}
              className={`panel-row flight-row${
                squadron.id === selectedFlightId ? ' is-selected' : ''
              }`}
            >
              <button
                className="flight-pick"
                aria-pressed={squadron.id === selectedFlightId}
                title={squadron.label}
                disabled={squadron.status !== 'in-flight'}
                onClick={() =>
                  onSelectFlight?.(squadron.id === selectedFlightId ? null : squadron.id)
                }
              >
                <span className={`flight-strength num is-${squadron.status}`}>
                  {squadron.boats.length}
                </span>
                <span className="flight-name">{squadron.label}</span>
              </button>
              <span className="spacer" />
              <span
                className={`num flight-cef-readout${squadron.cef === 0 ? ' is-spent' : ''}`}
                title="Combat endurance remaining (9.1)"
              >
                CEF {squadron.cef}
              </span>

              {squadron.status === 'aboard' && phase === 'move-fighters' ? (
                <button
                  disabled={!squadron.carrierId}
                  onClick={() =>
                    dispatch({
                      type: 'launch-gunboats',
                      carrierId: squadron.carrierId ?? '',
                      squadronId: squadron.id,
                    })
                  }
                >
                  Launch
                </button>
              ) : null}

              {squadron.status === 'in-flight' &&
              (phase === 'move-fighters' || phase === 'secondary-fighter-moves') &&
              squadron.carrierId ? (
                <button
                  disabled={!squadronCanLand(squadron, game, phase === 'secondary-fighter-moves')}
                  title={squadronLandNote(squadron, game, phase === 'secondary-fighter-moves')}
                  onClick={() =>
                    dispatch({
                      type: 'recover-gunboats',
                      squadronId: squadron.id,
                      carrierId: squadron.carrierId ?? '',
                    })
                  }
                >
                  Land
                </button>
              ) : null}

              {/* 9.2's FTL modification, and the risk 9.1 attaches to it: "if
                  there is a ship, planet, asteroid or other object sufficient
                  to cause distortion where the Gunboat engages its FTL, the
                  gunboat is destroyed". Six MU, and the squadron's own fleet
                  counts. */}
              {squadron.status === 'in-flight' && squadron.modifiers.includes('ftl') ? (
                <button
                  title="Jump out — destroyed if anything is within 6 MU (9.1)"
                  onClick={() => dispatch({ type: 'gunboat-ftl-exit', squadronId: squadron.id })}
                >
                  Jump out
                </button>
              ) : null}

              <span className={`flight-status is-${squadron.status}`}>
                {squadron.status === 'aboard'
                  ? 'on the rack'
                  : squadron.status === 'destroyed'
                    ? 'lost'
                    : 'in flight'}
              </span>
            </div>
          ))}
        </>
      ) : null}
    </div>
  )
}

/**
 * Whether the squadron can get home this phase, and whether home will take it.
 *
 * Both halves matter: 9.1 says only a bay recovers gunboats — *"Gunboats
 * cannot be refueled or rearmed in combat using their carrying rack"* — so a
 * tender with racks alone launches its squadrons once and that is that.
 */
function squadronCanLand(
  squadron: GunboatSquadronState,
  game: GameState,
  secondary: boolean,
): boolean {
  const carrier = game.ships.find((s) => s.id === squadron.carrierId)
  if (!carrier) return false
  if (!carrier.design.systems.some((system) => system.kind === 'gunboat-bay')) return false
  if (secondary && isSquadronExhausted(squadron)) return false
  const allowance = secondary ? GUNBOAT_SECONDARY_MOVE : GUNBOAT_MOVE
  return distance(squadron.position, carrier.placement.position) <= allowance
}

function squadronLandNote(
  squadron: GunboatSquadronState,
  game: GameState,
  secondary: boolean,
): string {
  const carrier = game.ships.find((s) => s.id === squadron.carrierId)
  if (carrier && !carrier.design.systems.some((system) => system.kind === 'gunboat-bay')) {
    return 'A rack cannot take a squadron back; only a gunboat bay can (9.1)'
  }
  if (squadronCanLand(squadron, game, secondary)) {
    return secondary ? 'Lands on its secondary move — 1 CEF (9.1)' : 'Lands this turn (9.1)'
  }
  return 'Too far from the carrier to land this turn (9.1)'
}

function describe(flight: FighterGroupState): string {
  if (flight.status === 'aboard') return flight.grounded ? 'written off' : 'in the bay'
  if (flight.status === 'destroyed') return 'lost'
  if (flight.evading) return 'evading'
  if (flight.engagedWith.length > 0) return 'dogfighting'
  return 'in flight'
}

/** Small craft close enough to this ship to be worth listing beside it. */
function nearby(
  craft: { status: string; side: string; position: { x: number; y: number } },
  ship: ShipState,
): boolean {
  return (
    craft.status === 'in-flight' &&
    craft.side === ship.side &&
    distance(craft.position, ship.placement.position) <= 24
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
