import type { GameState, TableGate } from '../engine/game'
import { gateById, shipsAwaitingGateEntry, GATE_REACH } from '../engine/actions'
import { currentTransferMass, gateBearsOn, isGateActive } from '../engine/ftl'
import { distance } from '../engine/geometry'
import { currentThrust } from '../engine/game'
import { dispatch } from './store'

/**
 * Working a Jump Gate or Portal (11.9).
 *
 * Four things happen at a gate and they happen in three different phases: the
 * activation order in phase 1, the announcement and any entry in phase 5, and
 * the transfer out at the end of the turn. The panel shows whichever of them
 * the current phase allows, and nothing else — a gate that cannot be used
 * this phase should say so rather than offer a button that will be refused.
 *
 * The transfer table is printed here in full because it is the most inverted
 * roll in section 11: 1 is the good result and two thirds of the die destroys
 * the ship. A player who has read 11.4 will expect the opposite.
 */
export function GatePanel({
  game,
  viewingSide,
}: {
  game: GameState
  viewingSide: string | null
}) {
  if (game.gates.length === 0) return null
  return (
    <div className="panel">
      <h3>Gates (11.9)</h3>
      {game.gates.map((gate) => (
        <Gate key={gate.def.id} game={game} gate={gate} viewingSide={viewingSide} />
      ))}
    </div>
  )
}

function Gate({
  game,
  gate,
  viewingSide,
}: {
  game: GameState
  gate: TableGate
  viewingSide: string | null
}) {
  const name = gate.def.label ?? gate.def.id
  const active = isGateActive(gate.def, gate.state, game.turn)
  const capacity = currentTransferMass(gate.def, gate.state)
  // An open table shows both fleets, so it shows both fleets' business with
  // the gate; a side's own console shows only its own.
  const ours = (shipSide: string): boolean => viewingSide === null || shipSide === viewingSide
  // Who a Gate Activate order is written for. On an open table that is
  // whoever holds the gate, because they are the side it costs nothing.
  const side = viewingSide ?? gate.controllingSide ?? game.sides[0]?.id ?? null
  const last = game.phases[game.phases.length - 1]

  // Everything standing on the gate and pointed the right way — 11.9 lets a
  // gate have one working facing.
  const atGate = game.ships.filter(
    (ship) =>
      ours(ship.side) &&
      !ship.destroyed &&
      !ship.offTable &&
      ship.carriedBy === null &&
      distance(ship.placement.position, gate.def.position) <= GATE_REACH &&
      gateBearsOn(gate.def, ship.placement.position),
  )
  const waiting = shipsAwaitingGateEntry(game).filter(
    (ship) => ship.awaitingGate === gate.def.id && ours(ship.side),
  )

  return (
    <div className="panel-block">
      <div className="panel-row">
        <b>{name}</b>
        <span className="spacer" />
        <span style={{ color: active ? 'var(--screens)' : 'var(--ink-dim)' }}>
          {active ? 'active' : 'inactive'}
        </span>
        <span style={{ color: 'var(--ink-dim)' }}>
          {gate.def.natural
            ? 'natural — unlimited, and weapons fire cannot touch it'
            : `${capacity} transfer mass, ${gate.def.hullBoxes - gate.state.hullMarked}/${gate.def.hullBoxes} hull`}
        </span>
      </div>

      {!gate.def.natural && game.phase === 'orders' ? (
        <div className="panel-row">
          <label>
            <input
              type="checkbox"
              checked={gate.activationOrderedBy !== null}
              onChange={(event) =>
                dispatch({
                  type: 'plot-gate-activation',
                  gateId: gate.def.id,
                  side: side ?? '',
                  on: event.target.checked,
                })
              }
            />{' '}
            Gate Activate
          </label>
          <span className="spacer" />
          <span style={{ color: 'var(--ink-dim)' }}>
            {gate.controllingSide === side
              ? 'yours, so it comes on automatically next turn'
              : 'not yours — the defender rolls, and a 1, 2 or 3 delays it that many turns'}
          </span>
        </div>
      ) : null}

      {!gate.def.natural &&
      game.phase === 'move-ships' &&
      gate.activationOrderTurn === game.turn ? (
        <div className="panel-row">
          <span>Ordered on this turn</span>
          <span className="spacer" />
          <button
            className="primary"
            onClick={() => dispatch({ type: 'announce-gate-activation', gateId: gate.def.id })}
          >
            Announce
          </button>
        </div>
      ) : null}

      {game.phase === 'move-ships'
        ? waiting.map((ship) => (
            <div className="panel-row" key={ship.id}>
              <span>{ship.name}</span>
              <span className="spacer" />
              <span style={{ color: 'var(--ink-dim)' }}>waiting to come through</span>
              <button
                disabled={!active}
                onClick={() =>
                  dispatch({
                    type: 'gate-entry',
                    shipId: ship.id,
                    gateId: gate.def.id,
                    velocity: currentThrust(ship),
                    course: gate.def.facing === null ? ship.placement.facing : undefined,
                  })
                }
              >
                Come through
              </button>
            </div>
          ))
        : null}

      {game.phase === last && atGate.length > 0 ? (
        <div className="panel-row">
          <span>
            {atGate.length} ship{atGate.length === 1 ? '' : 's'} at the gate,{' '}
            {atGate.reduce((sum, ship) => sum + ship.design.mass, 0)} mass
          </span>
          <span className="spacer" />
          <button
            disabled={!active}
            onClick={() =>
              dispatch({
                type: 'gate-transfer',
                gateId: gate.def.id,
                // One fleet at a time: 11.9's capacity is shared across the
                // ships going through together, and two navies do not queue.
                shipIds: atGate
                  .filter((ship) => ship.side === atGate[0]?.side)
                  .map((ship) => ship.id),
              })
            }
          >
            Transfer out
          </button>
        </div>
      ) : null}

      {game.phase === last &&
      atGate.length > 0 &&
      (gate.state.ftlFailed || atGate.reduce((sum, s) => sum + s.design.mass, 0) > capacity) ? (
        <div className="panel-row">
          <span style={{ color: 'var(--warn)' }}>
            Over capacity: each ship rolls a D6 — 1 transfers, 2 backs out dead in space, 3 or
            more is destroyed (11.9).
          </span>
        </div>
      ) : null}

      {gate.pairedGateId && game.phase === 'move-ships'
        ? atGate.map((ship) => (
            <div className="panel-row" key={`hop-${ship.id}`}>
              <span>{ship.name}</span>
              <span className="spacer" />
              <button
                disabled={!active || ship.lastKnown?.turn === game.turn}
                onClick={() => dispatch({ type: 'portal-hop', shipId: ship.id, gateId: gate.def.id })}
              >
                Cross to {gateById(game, gate.pairedGateId ?? '')?.def.label ?? 'the far end'}
              </button>
            </div>
          ))
        : null}
    </div>
  )
}
