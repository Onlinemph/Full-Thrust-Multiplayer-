import type { ShipState } from '../engine/game'
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

export function OrderPanel({ ship, editable, emergencyThrustAllowed }: OrderPanelProps) {
  const order = ship.order ?? BLANK
  const movement = movementStateOf(ship)
  const budget = thrustBudget(order, movement.drive)
  const check = validateOrder(order, movement)
  const turnCap = standardTurnAllowance(movement.drive)

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
