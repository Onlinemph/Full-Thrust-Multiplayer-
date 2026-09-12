import { useState } from 'react'

import type { GameState, ShipState } from '../engine/game'
import {
  applyOrder,
  driveFromDef,
  formatOrder,
  standardTurnAllowance,
  thrustBudget,
  validateOrder,
  type MovementState,
} from '../engine/movement'
import {
  collisionAvoidanceTarget,
  meteorFieldDice,
  stationaryCollisionRisk,
  CLOUD_SAFE_VELOCITY,
} from '../engine/terrain'
import { currentThrust } from '../engine/game'
import {
  antimatterChargesAboard,
  carriedHulls,
  isJumpPointDisoriented,
  novaArmedOn,
  optional,
  stealthLevelOf,
  waveGunCharge,
} from '../engine/actions'
import { WAVE_GUN_CHARGE_TARGET } from '../engine/ew'
import { coursesMatched, TOW_LINK_TURNS, TOW_MATCH_RANGE } from '../engine/specialmoves'
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
  // 7.23: at most one, "mounted in the spinal core of a capital ship".
  const novaCannon = ship.design.weapons.find(
    (weapon) => weapon.weaponClass === 'nova-cannon' && !ship.destroyedSystems.has(weapon.id),
  )
  const waveGun = ship.design.weapons.find(
    (weapon) => weapon.weaponClass === 'wave-gun' && !ship.destroyedSystems.has(weapon.id),
  )
  // 7.9: charges still aboard and unexploded. A ship with none has nothing to
  // write a detonate order about.
  // 16.3's candidates: matched course, matched velocity, inside 3 MU, and not
  // already on somebody else's line.
  const towable = game.ships.filter((other) => {
    if (other.id === ship.id || other.side !== ship.side) return false
    if (other.destroyed || other.offTable || other.tow !== null) return false
    return coursesMatched(
      { position: ship.placement.position, facing: ship.placement.facing, velocity: ship.velocity },
      { position: other.placement.position, facing: other.placement.facing, velocity: other.velocity },
    ).matched
  })
  // 7.9, counted the way the engine counts it: a charge a needle beam shot
  // out is not there to set off, and neither is one that has already gone.
  const charges = antimatterChargesAboard(game, ship)
  // 16.6: anything on the table that is not this ship and not a wreck.
  const dockable = game.ships.filter(
    (other) => other.id !== ship.id && !other.destroyed && !other.offTable,
  )
  const hazards = plottedHazards(game, ship, order, movement)

  const setTurn = (direction: TurnDirection | null, points: number) =>
    dispatch({ type: 'plot-turn', shipId: ship.id, direction, points })

  const setSecondTurn = (direction: TurnDirection | null, points: number) =>
    dispatch({ type: 'plot-second-turn', shipId: ship.id, direction, points })

  const setAccel = (accel: number) => dispatch({ type: 'plot-accel', shipId: ship.id, accel })

  const orbitBody = ship.orbit
    ? game.terrain.find((feature) => feature.id === ship.orbit?.featureId)
    : undefined

  // 12.12 replaces 3.5's order and nothing else: "a completely OPTIONAL
  // alternative movement system, which players may use instead of the standard
  // FT movement rules". Everything written *beside* the movement order in phase
  // 1 — a cloak, a Reflex Field, mines, an armed Nova Cannon, a charging Wave
  // Gun, detonate orders, a turret facing — is section 5, 6, 7 and 16 and is
  // untouched by it. So under vector the movement half is dropped and the rest
  // of the phase stays where it is; a vector battle that hid it made six rules
  // unreachable at once.
  const vector = optional(game).movementSystem === 'vector'

  return (
    <div className="panel order-panel">
      <h3>{vector ? 'Declared with the order' : 'Orders'}</h3>

      {vector ? null : (
      <>
      {/* 17.8: "the ship does not have to have any course change orders written
          for it." The turn and thrust controls below still work, and the
          throttle still means something — it is how a ship leaves — but the
          course is the track's now. */}
      {orbitBody ? (
        <div className="panel-row">
          <span>
            In orbit round {orbitBody.label ?? 'the planet'}, marker {ship.orbit?.marker}
          </span>
          <span className="spacer" />
          <span style={{ color: 'var(--ink-dim)' }}>
            {orbitBody.orbit?.speed ?? 0} point{Math.abs(orbitBody.orbit?.speed ?? 0) === 1 ? '' : 's'} a turn
          </span>
        </div>
      ) : null}

      <div className="order-notation" aria-live="polite">
        {orbitBody ? 'carried round the track (17.8)' : formatOrder(order, ship.velocity)}
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

      {/* 3.5's double course change: "A ship making a double course change
          always makes the first course change before moving and the second at
          the half way point." The point of it is `P1 S1` — a sidestep that
          resumes the original course "at some distance to port" — so it is
          offered as soon as there is a first turn to bend back from. */}
      {order.turn ? (
        <div className="panel-row">
          <span>Then</span>
          <span className="spacer" />
          <button
            disabled={!editable}
            onClick={() => setSecondTurn('port', (order.secondTurn?.points ?? 0) + 1)}
          >
            ◀ Port
          </button>
          <span className="num">
            {order.secondTurn
              ? `${order.secondTurn.direction === 'port' ? 'P' : 'S'}${order.secondTurn.points}`
              : '—'}
          </span>
          <button
            disabled={!editable}
            onClick={() => setSecondTurn('starboard', (order.secondTurn?.points ?? 0) + 1)}
          >
            Starboard ▶
          </button>
          <button
            disabled={!editable || !order.secondTurn}
            onClick={() => setSecondTurn(null, 0)}
          >
            None
          </button>
          <span style={{ color: 'var(--ink-dim)' }}>at the half way point (3.5)</span>
        </div>
      ) : null}

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
      </>
      )}

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

      {/* 7.23: the Nova Cannon is armed here, with the movement orders, because
          arming it IS the ship's turn — "it may not apply any thrust to
          accelerate or maneuver, it may not fire any other weapons, and even
          its screens do not function for that turn". */}
      {novaCannon ? (
        <div className="panel-row">
          <label>
            <input
              type="checkbox"
              checked={novaArmedOn(game, ship)}
              onChange={(event) =>
                dispatch({
                  type: 'arm-nova-cannon',
                  shipId: ship.id,
                  weaponId: novaCannon.id,
                  on: event.target.checked,
                })
              }
            />{' '}
            Arm the {novaCannon.label}
          </label>
          <span className="spacer" />
          <span style={{ color: 'var(--warn)' }}>
            no thrust, no other weapons, no screens (7.23)
          </span>
        </div>
      ) : null}

      {/* 7.24: "Each turn that the player orders the weapon to charge, roll one
          D6 and write the result down; when the accumulated rolls reach six or
          more the weapon is fully charged." Charging costs the ship nothing
          else — it may thrust, turn and shoot in the same turn. */}
      {waveGun ? (
        <div className="panel-row">
          <span>{waveGun.label}</span>
          <span className="spacer" />
          <span
            className="num"
            style={{
              color:
                waveGunCharge(game, ship, waveGun.id) >= WAVE_GUN_CHARGE_TARGET
                  ? 'var(--screens)'
                  : 'var(--ink-dim)',
            }}
          >
            {waveGunCharge(game, ship, waveGun.id)} / {WAVE_GUN_CHARGE_TARGET}
          </span>
          <button
            onClick={() =>
              dispatch({ type: 'charge-wave-gun', shipId: ship.id, weaponId: waveGun.id })
            }
          >
            Charge
          </button>
          <span className="rule-detail">
            {waveGunCharge(game, ship, waveGun.id) >= WAVE_GUN_CHARGE_TARGET
              ? 'ready — and a knocked-out capacitor takes the hull with it (7.24)'
              : 'one die a turn, and the charge is what the hull takes if it is shot out (7.24)'}
          </span>
        </div>
      ) : null}

      {/* 3.7: the squadron this ship is in, and the way out of it. Forming one
          is a fleet-level choice and lives in the phase panel; leaving is a
          per-ship one and lives here. */}
      {ship.squadronId !== null ? (
        <div className="panel-row">
          <span>Squadron</span>
          <span className="spacer" />
          <span style={{ color: 'var(--ink-dim)' }}>
            {ship.squadronFormation?.replace('-', ' ')}
            {ship.squadronSharedBase ? ' · one stand' : ''}
          </span>
          <button
            disabled={!editable}
            title="A squadron is broken at the start of the turn, before orders (3.7)"
            onClick={() => dispatch({ type: 'break-squadron', squadronId: ship.squadronId! })}
          >
            Break
          </button>
        </div>
      ) : null}

      {/* 16.3: "the two ships must be within 3 MU of each other and either
          both halted, or both moving at the same velocity and course facing."
          A hull that matches is offered; one that does not is not. */}
      {ship.tow !== null ? (
        <div className="panel-row">
          <span>Under tow</span>
          <span className="spacer" />
          <span style={{ color: 'var(--ink-dim)' }}>
            {ship.tow.linked
              ? 'linked — it goes where the line takes it'
              : `${ship.tow.turnsSpent} of ${TOW_LINK_TURNS[ship.tow.rig]} turns`}
          </span>
          <button
            disabled={!editable}
            onClick={() => dispatch({ type: 'release-tow', loadId: ship.id })}
          >
            Let go
          </button>
        </div>
      ) : towable.length > 0 ? (
        <div className="panel-row">
          <span>Take in tow</span>
          <span className="spacer" />
          {towable.map((load) => (
            <button
              key={load.id}
              disabled={!editable}
              title={`${TOW_MATCH_RANGE} MU and a matched course — ${load.name} qualifies (16.3)`}
              onClick={() => dispatch({ type: 'begin-tow', tugId: ship.id, loadId: load.id })}
            >
              {load.name}
            </button>
          ))}
        </div>
      ) : null}

      {/* 7.4: the Stealth-2 trade. Passive keeps the second level of stealth
          and caps targeting at 24 MU; active buys the full 54 MU FireCon range
          and drops the ship to Stealth-1 while it lasts. */}
      {stealthLevelOf(ship) >= 2 || ship.activeScan ? (
        <div className="panel-row">
          <label>
            <input
              type="checkbox"
              disabled={!editable}
              checked={ship.activeScan}
              onChange={(event) =>
                dispatch({ type: 'set-active-scan', shipId: ship.id, on: event.target.checked })
              }
            />{' '}
            Go active
          </label>
          <span className="spacer" />
          <span style={{ color: ship.activeScan ? 'var(--warn)' : 'var(--ink-dim)' }}>
            {ship.activeScan
              ? 'Stealth-1 while it lasts, and 54 MU of FireCon (7.4)'
              : 'passive: Stealth-2, and nothing beyond 24 MU (7.4)'}
          </span>
        </div>
      ) : null}

      {/* 7.9: "A ship may write 'detonate' orders during phase 1. At the
          beginning of phase 13 just before threshold checks are rolled, the
          ship explodes." A last resort, and the panel says what it costs. */}
      {charges > 0 ? (
        <div className="panel-row">
          <label>
            <input
              type="checkbox"
              checked={ship.detonateOrderedTurn === game.turn}
              onChange={(event) =>
                dispatch({ type: 'plot-detonate', shipId: ship.id, on: event.target.checked })
              }
            />{' '}
            Detonate {charges > 1 ? `${charges} charges` : 'the charge'}
          </label>
          <span className="spacer" />
          <span style={{ color: 'var(--warn)' }}>
            {3 * charges}D6 within 1 MU, {2 * charges} within 2, {charges} within 3 — and the ship
            goes with it (7.9)
          </span>
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

      {/* 17.9: "a ship that has unused thrust points for changing course may
          use them to change the gravity zone turn." A magnitude only — the
          direction is never the player's, it is always towards the centre. */}
      {gravityWellNear(game, ship) ? (
        <div className="panel-row">
          <span>Fight the well</span>
          <span className="spacer" />
          <button
            disabled={!editable || (ship.gravityTurn ?? 0) <= 0}
            onClick={() =>
              dispatch({
                type: 'plot-gravity-turn',
                shipId: ship.id,
                points: Math.max(0, (ship.gravityTurn ?? 0) - 1),
              })
            }
          >
            −
          </button>
          <span className="num">{ship.gravityTurn ?? 0}</span>
          <button
            disabled={!editable}
            onClick={() =>
              dispatch({
                type: 'plot-gravity-turn',
                shipId: ship.id,
                points: (ship.gravityTurn ?? 0) + 1,
              })
            }
          >
            +
          </button>
          <span style={{ color: 'var(--ink-dim)' }}>
            thrust spent on the turn the well makes for you (17.9)
          </span>
        </div>
      ) : null}

      {ship.orbit ? (
        <div className="panel-row">
          <label>
            <input
              type="checkbox"
              disabled={!editable}
              checked={ship.landing}
              onChange={(event) =>
                dispatch({ type: 'plot-landing', shipId: ship.id, on: event.target.checked })
              }
            />{' '}
            Land
          </label>
          <span className="spacer" />
          {/* 17.11 is 17.8's decaying orbit done on purpose: the ship has to
              slow below orbital velocity either way, and this is what decides
              whether that is a landing or the atmosphere. */}
          <span style={{ color: 'var(--ink-dim)' }}>
            {ship.design.streamlining === 'none'
              ? 'not streamlined — this is an uncontrolled entry'
              : 'slow below orbital velocity to come down'}
          </span>
        </div>
      ) : null}

      {/* 5.22: "During the Write Orders Phase the facing of each turret must
          be recorded." A turret with no facing takes any arc it covers, which
          is what an unrecorded turret does; writing one narrows it to a single
          60-degree arc for the turn. */}
      {ship.design.turrets.map((turret) => (
        <div className="panel-row" key={turret.id}>
          <span>Turret {turret.id}</span>
          <span className="spacer" />
          {turret.arcs.map((arc) => (
            <button
              key={arc}
              className={ship.turretFacings.get(turret.id) === arc ? 'primary' : undefined}
              disabled={!editable}
              onClick={() =>
                dispatch({
                  type: 'plot-turret-facing',
                  shipId: ship.id,
                  turretId: turret.id,
                  facing: ship.turretFacings.get(turret.id) === arc ? null : arc,
                })
              }
            >
              {arc}
            </button>
          ))}
          <span style={{ color: 'var(--ink-dim)' }}>
            {ship.turretFacings.has(turret.id) ? 'trained' : 'free to traverse'}
          </span>
        </div>
      ))}

      {/* 11.10: "Ships exiting a jump point function as if they have taken a
          bridge critical hit until the next turn." Worth saying out loud —
          the ship is not steering and the order written here will not be
          flown. */}
      {isJumpPointDisoriented(game, ship) ? (
        <div className="panel-row">
          <span style={{ color: 'var(--warn)' }}>
            Disorientated by the jump point — out of control until next turn (11.10)
          </span>
        </div>
      ) : null}

      {/* 11.7: a rider lets go in orders, and flies its own move in phase 5. */}
      {ship.carriedBy !== null ? (
        <div className="panel-row">
          <span>Riding {game.ships.find((s) => s.id === ship.carriedBy)?.name ?? 'a Mothership'}</span>
          <span className="spacer" />
          <button
            disabled={!editable}
            onClick={() => dispatch({ type: 'detach-hull', shipId: ship.id })}
          >
            Detach
          </button>
        </div>
      ) : null}

      {/* 11.7: "Damage received can be applied to either the Mothership or
          battleriders at the choice of the defending player." */}
      {carriedHulls(game, ship.id).length > 0 ? (
        <div className="panel-row">
          <label>
            Damage goes on{' '}
            <select
              aria-label={`${ship.name} damage allocation`}
              value={ship.damageSink?.id ?? ''}
              onChange={(event) =>
                dispatch({
                  type: 'nominate-damage-sink',
                  shipId: ship.id,
                  sinkId: event.target.value === '' ? null : event.target.value,
                })
              }
            >
              <option value="">{ship.name}</option>
              {carriedHulls(game, ship.id).map((rider) => (
                <option key={rider.id} value={rider.id}>
                  {rider.name}
                </option>
              ))}
            </select>
          </label>
          <span className="spacer" />
          <span style={{ color: 'var(--ink-dim)' }}>
            riders share the screens, not the armour (11.7)
          </span>
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

      {ship.dock.phase !== 'free' ? (
        <div className="panel-row">
          <span>Docking</span>
          <span className="spacer" />
          <span style={{ color: 'var(--screens)' }}>
            {ship.dock.phase === 'approach-held'
              ? 'station held — docked next turn'
              : ship.dock.phase === 'docked'
                ? 'docked'
                : 'casting off'}
          </span>
          {ship.dock.phase === 'docked' ? (
            <button
              disabled={!editable}
              onClick={() => dispatch({ type: 'plot-cast-off', shipId: ship.id })}
            >
              Cast off
            </button>
          ) : null}
        </div>
      ) : dockable.length > 0 ? (
        <div className="panel-row">
          <span>Dock</span>
          <span className="spacer" />
          <select
            aria-label="Docking target"
            disabled={!editable}
            value={ship.dockTargetId ?? ''}
            onChange={(event) =>
              dispatch({
                type: 'plot-dock',
                shipId: ship.id,
                targetId: event.target.value || null,
              })
            }
          >
            <option value="">nobody</option>
            {dockable.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {ship.dockTargetId ? (
        <p style={{ color: 'var(--ink-dim)', margin: 0 }}>
          End the turn within 3 MU and either stopped dead, if the target is, or on exactly its
          course and velocity if it is not (16.6).
        </p>
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

      {hazards.map((warning) => (
        <p key={warning} style={{ color: 'var(--damage)', margin: '0.4rem 0 0' }}>
          {warning}
        </p>
      ))}

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

/**
 * What this plot flies through (17.2, 17.4, 17.6).
 *
 * 17.6 destroys the ship outright and gives it one roll to avoid that, so the
 * number it has to beat belongs in front of the player while the order is
 * still being written. A ship that dies in phase 5 for something it could not
 * see in phase 1 reads as a bug, whatever the rulebook says.
 */
/**
 * Whether this ship is close enough to a gravity well for 17.9 to be about
 * anything. The zones are the feature's own radius bands, so "near" is a
 * generous multiple of the radius rather than an exact zone test — the panel
 * offers the control, and `resolveGravity` decides what the thrust buys.
 */
function gravityWellNear(game: GameState, ship: ShipState): boolean {
  if (optional(game).terrainHazards !== true) return false
  return game.terrain.some(
    (feature) =>
      (feature.kind === 'planet' || feature.kind === 'planetoid') &&
      Math.hypot(
        feature.position.x - ship.placement.position.x,
        feature.position.y - ship.placement.position.y,
      ) <=
        feature.radius * 3,
  )
}

function plottedHazards(
  game: GameState,
  ship: ShipState,
  order: MovementOrder,
  movement: MovementState,
): string[] {
  if (optional(game).terrainHazards !== true) return []
  if (game.terrain.length === 0) return []

  const result = applyOrder(movement, order)
  const path = [ship.placement.position, ...result.legs.map((leg) => leg.to)]
  const out: string[] = []
  for (const feature of game.terrain) {
    const body = { id: feature.id, position: feature.position, radius: feature.radius }
    if (!stationaryCollisionRisk(path, body)) continue
    const name = feature.label ?? feature.kind.replace('-', ' ')
    if (feature.kind === 'planet' || feature.kind === 'planetoid') {
      const need = collisionAvoidanceTarget(result.velocity, currentThrust(ship), {
        advancedDrive: ship.design.drive.advanced,
      })
      out.push(
        need <= 1
          ? `This track crosses ${name}, but at this speed the helm can make it (17.6).`
          : need > 6
            ? `This track crosses ${name} and cannot be flown at velocity ${result.velocity}: a crash is certain (17.6).`
            : `This track crosses ${name}. ${need}+ on a D6 to miss it, or the ship is destroyed (17.6).`,
      )
    } else if (feature.kind === 'dust-cloud' || feature.kind === 'nebula') {
      if (result.velocity > CLOUD_SAFE_VELOCITY) {
        out.push(
          `Through ${name} above ${CLOUD_SAFE_VELOCITY} MU: one die of damage, standard screens no help (17.2).`,
        )
      }
    } else if (feature.kind === 'asteroid-field' || feature.kind === 'debris') {
      const dice = meteorFieldDice(result.velocity)
      if (dice > 0) {
        out.push(`Through ${name} at velocity ${result.velocity}: ${dice}D6 penetrating (17.4).`)
      }
    }
  }
  return out
}

/** Current turn magnitude, so the buttons step it up rather than reset it. */
function turnPoints(order: MovementOrder): number {
  return order.turn?.points ?? 0
}
