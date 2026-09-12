import { useEffect, useState } from 'react'

import type { ShipState } from '../engine/game'
import { currentThrust } from '../engine/game'
import {
  formatVectorOrders,
  mainDriveThrust,
  parseVectorOrders,
  thrusterPoints,
  vectorOrderBudget,
  VECTOR_ORDER_KINDS,
  VECTOR_ORDER_LABELS,
  type VectorOrderKind,
} from '../engine/vectormovement'
import { dispatch } from './store'

/**
 * Writing a vector order sheet (12.12).
 *
 * A text field, because that is what the sheet is: *"TP2, MD6"* written in a
 * box, and *"each effect is applied to the ship strictly IN THE ORDER THEY ARE
 * WRITTEN DOWN BY THE PLAYER"*. A row of buttons that built the list would hide
 * the one thing a player has to see, which is the sequence — `MD6, TP2` and
 * `TP2, MD6` are different moves and the book says so twice.
 *
 * The buttons are there to say what the six orders are, and they append.
 */
export interface VectorOrderPanelProps {
  ship: ShipState
  /** Orders are written in phase 1 only (2.6). */
  editable: boolean
}

export function VectorOrderPanel({ ship, editable }: VectorOrderPanelProps) {
  const written = formatVectorOrders(ship.vectorOrders ?? [])
  const [text, setText] = useState(written)

  // The engine is the record: an undo, a replay or the other console's action
  // changes the sheet underneath this field and the field has to follow.
  useEffect(() => setText(written), [written, ship.id])

  const drive = { rating: ship.design.drive.thrust, hits: ship.driveHits }
  const parsed = parseVectorOrders(text)
  const budget = vectorOrderBudget(parsed.orders, drive)
  const problems = [...parsed.problems, ...budget.problems]

  const commit = (next: string) => {
    setText(next)
    const read = parseVectorOrders(next)
    if (read.problems.length > 0) return
    dispatch({ type: 'plot-vector-orders', shipId: ship.id, orders: read.orders })
  }

  const append = (kind: VectorOrderKind) => {
    const points = kind === 'MD' ? Math.max(1, budget.rating - budget.mainDriveUsed) : 1
    commit(text.trim() === '' ? `${kind}${points}` : `${text.trim()}, ${kind}${points}`)
  }

  return (
    <div className="panel order-panel">
      <h3>Orders · vector</h3>

      <div className="order-notation" aria-live="polite">
        {text.trim() === '' ? 'no orders — coast on the starting vector' : text}
      </div>

      <div className="panel-row">
        <span>Main drive</span>
        <span className="spacer" />
        <span className="num">
          {budget.mainDriveUsed}/{mainDriveThrust(drive)}
        </span>
      </div>

      <div className="panel-row">
        <span>Thrusters</span>
        <span className="spacer" />
        <span className="num">
          {budget.thrusterUsed}/{thrusterPoints(drive)}
        </span>
      </div>

      {thrusterPoints(drive) === 0 ? (
        <p style={{ color: 'var(--warn)', margin: '0.2rem 0 0' }}>
          {currentThrust(ship) === 0
            ? 'The drive is out. This ship coasts on its vector and cannot turn.'
            : 'Half of this drive rounds to nothing: it can burn along the bow but never change ' +
              'where the bow points (12.12).'}
        </p>
      ) : null}

      <label className="code-field">
        Order sheet
        <input
          type="text"
          aria-label="Vector order sheet"
          value={text}
          disabled={!editable}
          placeholder="TP3, MD6"
          onChange={(event) => commit(event.target.value)}
        />
      </label>

      <div className="design-list">
        {VECTOR_ORDER_KINDS.map((kind) => (
          <button
            key={kind}
            className="design-chip"
            disabled={!editable}
            title={VECTOR_ORDER_LABELS[kind]}
            onClick={() => append(kind)}
          >
            {kind}
          </button>
        ))}
      </div>

      {problems.length > 0 ? (
        <p style={{ color: 'var(--damage)', margin: '0.4rem 0 0' }}>{problems[0]}</p>
      ) : null}

      {editable ? (
        <button onClick={() => commit('')}>Clear order</button>
      ) : null}
    </div>
  )
}
