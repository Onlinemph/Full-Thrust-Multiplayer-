import { useState } from 'react'

import type { GameState, ShipState } from '../engine/game'
import {
  driveFromDef,
  formatOrder,
  standardTurnAllowance,
  thrustBudget,
  validateOrder,
  type MovementState,
} from '../engine/movement'
import type { MovementOrder, TurnDirection } from '../engine/types'
import { dispatch } from './store'

/**
 * Writing a movement order (3.5).
 *
 * On the table this is a line of shorthand on a scrap of paper — `8P2+4: 12`,
 * meaning a ship at velocity 8 turns 2 points to port, adds 4 thrust and ends
 * at velocity 12. The panel shows that line as you build it, because it is what
 * a Full Thrust player already knows how to read, and because seeing it makes
 * the thrust arithmetic obvious.
 */
export interface OrderPanelProps {
  game: GameState
  ship: ShipState
  /** Orders are written in phase 1 only (2.6). */
  editable: boolean
  emergencyThrustAllowed: boolean
}

const BLANK: MovementOrder = { turn: null, accel: 0 }

function movementStateOf(ship: ShipState): MovementState {
  return {
    placement: ship.placement,
    velocity: ship.velocity,
    drive: { ...driveFromDef(ship.design.drive), hits: ship.driveHits },
  }
}

export function OrderPanel({ game, ship, editable, emergencyThrustAllowed }: OrderPanelProps) {
  /* 7.20 makes the player commit to a number of turns before switching the
     cloak on, so the count has to be chosen first and is local to the form. */
  const [cloakTurns, setCloakTurns] = useState(3)
  const order = ship.order ?? BLANK
  const movement = movementStateOf(ship)
  const budget = thrustBudget(order, movement.drive)
  const check = validateOrder(order, movement)
  const turnCap = standardTurnAllowance(movement.drive)
  const rammable = game.ships.filter(
    (other) => other.side !== ship.side && !other.destroyed && !other.offTable,
  )
  const hasMines = ship.design.weapons.some((weapon) => weapon.weaponClass === 'mine-rack')

  const setTurn = (direction: TurnDirection | null, points: number) =>
    dispatch({ type: 'plot-turn', shipId: ship.id, direction, points })

  const setAccel = (accel: number) => dispatch({ type: 'plot-accel', shipId: ship.id, accel })

  return (
    <div className="panel order-panel">
      <h3>Orders</h3>

      <div className="order-notation" aria-live="polite">
        {formatOrder(order, ship.velocity)}
      </div>

      {/* One pip per thrust point, filled as it is spent. The heavier edge is
          the half-rating mark: turning may use at most half the drive (3.2). */}
      <div className="thrust-budget" aria-label="Thrust spent">
        {Array.from({ length: Math.max(budget.available, budget.totalUsed) }, (_, i) => {
          const classes = ['thrust-pip']
          if (i < budget.totalUsed) classes.push('is-spent')
          if (i + 1 === turnCap) classes.push('is-turn-limit')
          // Points past the (damaged) rating are emergency thrust (3.6).
          if (i >= budget.rating) classes.push('is-emergency')
          return <span key={i} className={classes.join(' ')} />
        })}
        <span className="num" style={{ marginLeft: '0.5rem', color: 'var(--ink-dim)' }}>
          {budget.totalUsed}/{budget.available}
        </span>
      </div>

      <div className="panel-row">
        <span>Turn</span>
        <span className="spacer" />
        <button disabled={!editable} onClick={() => setTurn('port', turnPoints(order) + 1)}>
          ◀ Port
        </button>
        <span className="num">
          {order.turn ? `${order.turn.direction === 'port' ? 'P' : 'S'}${order.turn.points}` : '—'}
        </span>
        <button disabled={!editable} onClick={() => setTurn('starboard', turnPoints(order) + 1)}>
          Starboard ▶
        </button>
        <button disabled={!editable || !order.turn} onClick={() => setTurn(null, 0)}>
          Straight
        </button>
      </div>

      <div className="panel-row">
        <span>Velocity</span>
        <span className="spacer" />
        <button disabled={!editable} onClick={() => setAccel(order.accel - 1)}>
          −
        </button>
        <span className="num">
          {ship.velocity} → {check.newVelocity}
        </span>
        <button disabled={!editable} onClick={() => setAccel(order.accel + 1)}>
          +
        </button>
      </div>

      {/* 16.2. It sits with the turn and the velocity because it is charged
          against the same thrust and shown in the same pip row, and because
          the question a player is answering is a manoeuvre question. */}
      <div className="panel-row">
        <label>
          <input
            type="checkbox"
            disabled={!editable}
            checked={order.roll === true}
            onChange={(event) =>
              dispatch({ type: 'plot-roll', shipId: ship.id, on: event.target.checked })
            }
          />{' '}
          Roll
        </label>
        <span className="spacer" />
        <span style={{ color: ship.rollStatus.inverted ? 'var(--warn)' : 'var(--ink-dim)' }}>
          {ship.rollStatus.inverted ? 'inverted — P and S swapped' : '1 thrust, off the turn'}
        </span>
      </div>

      {emergencyThrustAllowed ? (
        <div className="panel-row">
          <label>
            <input
              type="checkbox"
              disabled={!editable}
              checked={Boolean(order.emergencyThrust)}
              onChange={(event) =>
                dispatch({
                  type: 'plot-emergency-thrust',
                  shipId: ship.id,
                  on: event.target.checked,
                })
              }
            />{' '}
            Emergency thrust
          </label>
          <span className="spacer" />
          {/* 3.6: the drive is run at up to 150% and may be damaged for it. */}
          <span style={{ color: 'var(--warn)' }}>up to 150%, drive at risk</span>
        </div>
      ) : null}

      {/* Everything else 2.6 phase 1 asks for. These are written beside the
          movement order, not in it, and each one is a commitment the ship
          cannot take back once the turn starts: a cloak with its duration
          declared in advance (7.20), a Reflex Field that costs the ship its
          guns (7.25), mines that pull it early in the movement phase (6.9),
          an FTL exit that takes two turns (11.4), and a ram (16.7). */}
      <h4>Declared with the order</h4>

      {ship.cloak ? (
        <div className="panel-row">
          <label>
            <input
              type="checkbox"
              disabled={!editable}
              checked={ship.cloak.ordered !== null || ship.cloaked}
              onChange={(event) =>
                dispatch({
                  type: 'set-cloak',
                  shipId: ship.id,
                  on: event.target.checked,
                  turns: cloakTurns,
                })
              }
            />{' '}
            Cloak
          </label>
          <span className="spacer" />
          <label className="code-field" style={{ flexDirection: 'row', gap: '0.3rem' }}>
            turns
            <input
              type="number"
              min={1}
              max={9}
              value={cloakTurns}
              disabled={!editable}
              onChange={(event) => setCloakTurns(Math.max(1, Number(event.target.value)))}
              style={{ width: '3.5rem' }}
            />
          </label>
        </div>
      ) : null}

      {ship.design.systems.some((system) => system.kind === 'reflex-field') ? (
        <div className="panel-row">
          <label>
            <input
              type="checkbox"
              disabled={!editable}
              checked={ship.reflexFieldActive}
              onChange={(event) =>
                dispatch({ type: 'set-reflex-field', shipId: ship.id, on: event.target.checked })
              }
            />{' '}
            Reflex Field
          </label>
          <span className="spacer" />
          <span style={{ color: 'var(--warn)' }}>no weapons this turn</span>
        </div>
      ) : null}

      {hasMines ? (
        <div className="panel-row">
          <label>
            <input
              type="checkbox"
              disabled={!editable}
              checked={ship.layingMines}
              onChange={(event) =>
                dispatch({ type: 'plot-mines', shipId: ship.id, on: event.target.checked })
              }
            />{' '}
            Lay mines
          </label>
          <span className="spacer" />
          {/* 2.6 phase 5: mine layers move after the fixed paths and before
              everyone else, so declaring it changes when the ship moves. */}
          <span style={{ color: 'var(--ink-dim)' }}>moves early in phase 5</span>
        </div>
      ) : null}

      {ship.design.ftl !== 'none' ? (
        <div className="panel-row">
          <label>
            <input
              type="checkbox"
              disabled={!editable || (ship.cloaked && ship.ftlWarmupTurn === null)}
              checked={ship.ftlWarmupTurn !== null}
              onChange={(event) =>
                dispatch({ type: 'plot-ftl-exit', shipId: ship.id, on: event.target.checked })
              }
            />{' '}
            Jump out
          </label>
          <span className="spacer" />
          <span style={{ color: 'var(--warn)' }}>
            {ship.ftlWarmupTurn === null
              ? 'two turns, no thrust, no guns'
              : `spinning up since turn ${ship.ftlWarmupTurn}`}
          </span>
        </div>
      ) : null}

      {rammable.length > 0 ? (
        <>
          <div className="panel-row">
            <span>Ram</span>
            <span className="spacer" />
            <select
              aria-label="Ram target"
              disabled={!editable}
              value={ship.ramTargetId ?? ''}
              onChange={(event) =>
                dispatch({
                  type: 'plot-ram',
                  shipId: ship.id,
                  targetId: event.target.value || null,
                })
              }
            >
              <option value="">nobody</option>
              {rammable.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}
                </option>
              ))}
            </select>
          </div>
          {/* 16.7 charges both hulls the same way, so the warning is about
              this ship as much as about the target. */}
          {ship.ramTargetId ? (
            <p style={{ color: 'var(--damage)', margin: 0 }}>
              Both ships take D6 damage per hull box of the other.
            </p>
          ) : null}
        </>
      ) : null}

      {!check.legal ? (
        <p style={{ color: 'var(--damage)', margin: '0.4rem 0 0' }}>{check.violations[0]}</p>
      ) : null}

      {editable ? (
        <button onClick={() => dispatch({ type: 'clear-order', shipId: ship.id })}>
          Clear order
        </button>
      ) : null}
    </div>
  )
}

/** Current turn magnitude, so the buttons step it up rather than reset it. */
function turnPoints(order: MovementOrder): number {
  return order.turn?.points ?? 0
}
