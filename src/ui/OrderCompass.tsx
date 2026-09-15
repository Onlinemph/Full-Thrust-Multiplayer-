import type { ShipState } from '../engine/game'
import {
  driveFromDef,
  formatOrder,
  thrustBudget,
  validateOrder,
  type MovementState,
} from '../engine/movement'
import type { MovementOrder, TurnDirection } from '../engine/types'
import { dispatch } from './store'

/**
 * The order, written on the table.
 *
 * 3.5's order is a course change and a throttle setting, and the panel on the
 * right has always taken both — but the panel is a form, and a form is the
 * long way round for a decision a player makes by looking at the ship. This
 * puts the decision where the ship is: click a counter and a ring of course
 * changes appears around it, port to the left, starboard to the right, with
 * the throttle underneath. One click writes the turn, the track redraws, and
 * the next click is the next ship.
 *
 * Nothing here the panel cannot do, and nothing the panel does that this
 * cannot undo: every button ends in the same `dispatch` the panel uses, so
 * the journal does not know which was used. Rolls, emergency thrust and the
 * rest of phase 1's declarations stay in the panel, where there is room to
 * explain them.
 *
 * 3.5's double course change is here as well, as a second ring outside the
 * first once a first turn is written and the drive has points to spare:
 * *"A ship with a sufficient thrust rating may make a double course change
 * in one turn ... always makes the first course change before moving and the
 * second at the half way point, even if the first change is greater than the
 * second."* The outer ring is the second change, so `P2` on the inner ring
 * and `S2` on the outer is the sidestep the rule exists for.
 */
export interface OrderCompassProps {
  ship: ShipState
  /** The ship's centre on the plotting surface, in pixels. */
  x: number
  y: number
  /** The counter's radius in pixels: the ring is drawn clear of the hull. */
  clearance: number
  /** 17.8: a ship on an orbit track has no course of its own to change. */
  onTrack: boolean
  /** Whether the sheet may be written on at all. */
  editable: boolean
  /** 3.5's commonest order: straight on at the same speed, then the next ship. */
  onHold: () => void
  onNext: () => void
  /** Whether there is another of our ships still without orders. */
  moreToWrite: boolean
  /**
   * The order the pointer is resting on, for the map to draw as a ghost track
   * before it is written; null when the pointer leaves.
   */
  onPreview?: (order: MovementOrder | null) => void
}

const BLANK: MovementOrder = { turn: null, accel: 0 }

/** Buttons round the ring, so many degrees apart, starting so far from the bow. */
const FIRST_TURN_DEGREES = 33
const TURN_SPACING_DEGREES = 30
/** 3.2's "short way round": more than six points one way is never worth writing. */
const MAX_TURN = 6

function ringPoint(degrees: number, radius: number): { left: number; top: number } {
  const radians = (degrees * Math.PI) / 180
  return { left: radius * Math.sin(radians), top: -radius * Math.cos(radians) }
}

export function OrderCompass({
  ship,
  x,
  y,
  clearance,
  onTrack,
  editable,
  onHold,
  onNext,
  moreToWrite,
  onPreview,
}: OrderCompassProps) {
  const order = ship.order ?? BLANK
  const movement: MovementState = {
    placement: ship.placement,
    velocity: ship.velocity,
    drive: { ...driveFromDef(ship.design.drive), hits: ship.driveHits },
  }
  const budget = thrustBudget(order, movement.drive)
  const check = validateOrder(order, movement)
  const written = ship.order !== null
  // What the drive allows for turning this turn, roll and emergency thrust
  // already taken into account (3.2, 3.3, 3.6, 16.2).
  const allowance = onTrack ? 0 : Math.min(MAX_TURN, Math.max(0, budget.turnAllowance))
  // The ring has to clear the counter, and it has to have room for the
  // buttons on it; a frigate's ring is not smaller than a hand can use.
  const radius = Math.max(48, clearance + 32)

  const thenTo = (direction: TurnDirection | null, points: number) =>
    dispatch({ type: 'plot-second-turn', shipId: ship.id, direction, points })
  const turnTo = (direction: TurnDirection | null, points: number) => {
    // A second change needs a first to bend back from, and both come out of
    // the same allowance: straight ahead takes the second leg off with it,
    // and a first leg the second no longer fits beside takes it off too.
    const second = order.secondTurn?.points ?? 0
    if (second > 0 && (direction === null || points + second > allowance)) thenTo(null, 0)
    dispatch({ type: 'plot-turn', shipId: ship.id, direction, points })
  }
  const accelTo = (accel: number) => dispatch({ type: 'plot-accel', shipId: ship.id, accel })

  // The outer ring: what is left for a second change once the first is
  // written, capped by the turning allowance and by the whole budget (3.2).
  const firstPoints = order.turn?.points ?? 0
  const thenAllowance =
    onTrack || firstPoints === 0
      ? 0
      : Math.max(
          // What is written stays offered, so it can be seen and taken off.
          order.secondTurn?.points ?? 0,
          Math.min(
            MAX_TURN,
            allowance - firstPoints,
            budget.available - firstPoints - Math.abs(order.accel) - budget.rollPoints,
          ),
        )
  const thenRadius = radius + 32

  // Whether one more point of throttle either way still fits the drive (3.2).
  const fits = (accel: number) =>
    budget.turnPoints + Math.abs(accel) + budget.rollPoints <= budget.available
  const canSlow = ship.velocity + order.accel > 0 && (order.accel > 0 || fits(order.accel - 1))
  const canSpeed = order.accel < 0 || fits(order.accel + 1)

  const turnButton = (direction: TurnDirection, points: number) => {
    const on = order.turn?.direction === direction && order.turn.points === points
    const sign = direction === 'port' ? -1 : 1
    const at = ringPoint(sign * (FIRST_TURN_DEGREES + (points - 1) * TURN_SPACING_DEGREES), radius)
    return (
      <button
        key={`${direction}${points}`}
        className={`compass-btn${on ? ' is-on' : ''}`}
        style={{ left: at.left, top: at.top }}
        disabled={!editable}
        title={`${points} point${points === 1 ? '' : 's'} to ${direction} (3.5)`}
        aria-pressed={on}
        onClick={() => turnTo(direction, points)}
        onPointerEnter={() => onPreview?.({ ...order, turn: { direction, points } })}
        onPointerLeave={() => onPreview?.(null)}
      >
        {direction === 'port' ? 'P' : 'S'}
        {points}
      </button>
    )
  }

  const thenButton = (direction: TurnDirection, points: number) => {
    const on = order.secondTurn?.direction === direction && order.secondTurn.points === points
    const sign = direction === 'port' ? -1 : 1
    const at = ringPoint(
      sign * (FIRST_TURN_DEGREES + (points - 1) * TURN_SPACING_DEGREES),
      thenRadius,
    )
    return (
      <button
        key={`then-${direction}${points}`}
        className={`compass-btn is-then${on ? ' is-on' : ''}`}
        style={{ left: at.left, top: at.top }}
        disabled={!editable}
        title={`Then ${points} point${points === 1 ? '' : 's'} to ${direction} at the half way point (3.5)`}
        aria-pressed={on}
        onClick={() => thenTo(on ? null : direction, on ? 0 : points)}
        onPointerEnter={() => onPreview?.({ ...order, secondTurn: { direction, points } })}
        onPointerLeave={() => onPreview?.(null)}
      >
        {direction === 'port' ? 'P' : 'S'}
        {points}
      </button>
    )
  }

  const straightOn = written && !order.turn
  const hasSecond = (order.secondTurn?.points ?? 0) > 0
  const notation = onTrack ? 'on the track' : formatOrder(order, ship.velocity)

  return (
    <div
      className="compass"
      style={{ left: x, top: y }}
      role="group"
      aria-label={`Orders for ${ship.name}`}
      // A click on the compass is an order, not the start of a pan: the plot
      // under it must not hear the pointer at all.
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div className="compass-ring" style={{ width: radius * 2, height: radius * 2 }} />

      {onTrack ? null : (
        <button
          className={`compass-btn compass-straight${straightOn ? ' is-on' : ''}`}
          style={ringPoint(0, radius)}
          disabled={!editable}
          title="Straight ahead (3.5)"
          aria-pressed={straightOn}
          onClick={() => turnTo(null, 0)}
          onPointerEnter={() => onPreview?.({ ...order, turn: null })}
          onPointerLeave={() => onPreview?.(null)}
        >
          ▲
        </button>
      )}
      {Array.from({ length: allowance }, (_, i) => turnButton('port', i + 1))}
      {Array.from({ length: allowance }, (_, i) => turnButton('starboard', i + 1))}

      {/* 3.5's second course change, made at the half way point: a second
          ring outside the first, offered once there is a first turn to bend
          back from and thrust left to do it with. */}
      {thenAllowance > 0 ? (
        <>
          <div
            className="compass-ring is-then"
            style={{ width: thenRadius * 2, height: thenRadius * 2 }}
          />
          <button
            className={`compass-btn compass-then-label${hasSecond ? ' is-clear' : ''}`}
            style={ringPoint(0, thenRadius)}
            disabled={!editable || !hasSecond}
            title={
              hasSecond
                ? 'Take the second course change off (3.5)'
                : 'Then, at the half way point: a second course change (3.5)'
            }
            onClick={() => thenTo(null, 0)}
            onPointerEnter={() => (hasSecond ? onPreview?.({ ...order, secondTurn: null }) : undefined)}
            onPointerLeave={() => onPreview?.(null)}
          >
            {hasSecond ? '×' : 'then'}
          </button>
          {Array.from({ length: thenAllowance }, (_, i) => thenButton('port', i + 1))}
          {Array.from({ length: thenAllowance }, (_, i) => thenButton('starboard', i + 1))}
        </>
      ) : null}

      {/* The throttle: the velocity the ship is on and the one it will be on,
          with one thrust point either way per click (3.2). */}
      <div className="compass-pill" style={{ left: 0, top: (thenAllowance > 0 ? thenRadius : radius) + 36 }}>
        <button
          disabled={!editable || !canSlow}
          title="One point slower (3.2)"
          onClick={() => accelTo(order.accel - 1)}
          onPointerEnter={() => onPreview?.({ ...order, accel: order.accel - 1 })}
          onPointerLeave={() => onPreview?.(null)}
        >
          −
        </button>
        <span className={`num${written ? '' : ' is-unwritten'}`} title={notation}>
          {ship.velocity} → {check.newVelocity}
        </span>
        <button
          disabled={!editable || !canSpeed}
          title="One point faster (3.2)"
          onClick={() => accelTo(order.accel + 1)}
          onPointerEnter={() => onPreview?.({ ...order, accel: order.accel + 1 })}
          onPointerLeave={() => onPreview?.(null)}
        >
          +
        </button>
        <span className="compass-thrust num" title="Thrust spent of the drive's rating">
          {budget.totalUsed}/{budget.available}
        </span>
      </div>

      <div className="compass-actions" style={{ left: 0, top: (thenAllowance > 0 ? thenRadius : radius) + 70 }}>
        {editable ? (
          <button
            className={written ? undefined : 'primary'}
            title="Straight ahead at the same speed, and on to the next ship (3.5)"
            onClick={onHold}
          >
            Hold course
          </button>
        ) : null}
        {moreToWrite ? (
          <button
            className={written ? 'primary' : undefined}
            title="The next ship still without orders"
            onClick={onNext}
          >
            Next ship ▸
          </button>
        ) : null}
      </div>
    </div>
  )
}
