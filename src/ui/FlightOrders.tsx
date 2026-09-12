import { useState } from 'react'

import type { FighterGroupState, GameState } from '../engine/game'
import { flightOrders, type FlightOrder } from '../engine/flightorders'
import { dispatch } from './store'

/**
 * The orders a fighter group can be given that are not "fly there"
 * (8.3 – 8.18).
 *
 * `FlightPanel` covers what a group *is* — strength, endurance, and the three
 * decisions every group has: launch, evade, land. This covers the fifteen that
 * only some groups have in only some phases: a Multi-Role group re-arming in
 * the bay, an Assault Shuttle going for a hull, an Ace picking out a system, a
 * faster group declining a dogfight.
 *
 * Which of them are on offer is rules work and lives in
 * `engine/flightorders.ts`, where it is tested. This file is the rendering:
 * an order with targets gets a picker, an order without gets a button.
 */
export function FlightOrders({
  game,
  flight,
}: {
  game: GameState
  flight: FighterGroupState
}) {
  const orders = flightOrders(game, flight)
  if (orders.length === 0) return null
  return (
    <div className="flight-orders">
      {orders.map((order) => (
        <OrderRow key={order.kind} order={order} />
      ))}
    </div>
  )
}

function OrderRow({ order }: { order: FlightOrder }) {
  const [choice, setChoice] = useState('')

  if (order.options.length === 0) {
    if (!order.action) return null
    const action = order.action
    return (
      <div className="panel-row">
        <span>{order.label}</span>
        <span className="spacer" />
        <button disabled={order.disabled} onClick={() => dispatch(action)}>
          Go
        </button>
        <span className="rule-detail">{order.hint}</span>
      </div>
    )
  }

  const picked = order.options.find((option) => option.id === choice) ?? order.options[0]
  if (!picked) return null
  return (
    <div className="panel-row">
      <label>
        {order.label}{' '}
        <select
          aria-label={order.label}
          value={picked.id}
          onChange={(event) => setChoice(event.target.value)}
        >
          {order.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <button disabled={order.disabled} onClick={() => dispatch(picked.action)}>
        Go
      </button>
      <span className="spacer" />
      <span className="rule-detail">{order.hint}</span>
    </div>
  )
}
