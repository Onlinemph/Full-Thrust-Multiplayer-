import type { GameState } from '../engine/game'
import { availableDamageControlParties, damageControlParties } from '../engine/game'
import { repairTargets } from '../engine/threshold'
import { dispatch } from './store'

/**
 * Damage control (10.4, phase 14).
 *
 * *"Up to three Damage Control Parties may work on repairing a single system,
 * and the system is repaired on a roll of equal to or less than the number of
 * parties assigned."* The choice of which system each party works on is the
 * whole rule — a ship with two parties and four things broken has to decide
 * whether to try two repairs at even odds or one at better ones — and until
 * now there was nowhere to make it. `damageControlPhase` skips any ship with
 * no assignment, so "Make repair rolls" repaired nothing at all.
 */
export function DamageControlPanel({
  game,
  viewingSide,
}: {
  game: GameState
  viewingSide: string | null
}) {
  const ships = game.ships
    .filter((ship) => !ship.destroyed && (viewingSide === null || ship.side === viewingSide))
    .map((ship) => ({ ship, targets: repairTargets(ship) }))
    .filter(({ targets }) => targets.length > 0)

  return (
    <div className="panel">
      <h3>Phase 14 · Damage control</h3>
      <p style={{ color: 'var(--ink-dim)' }}>
        Up to three parties may work one system, and it is repaired on a die at or below the
        number assigned. A party not put on anything does nothing.
      </p>

      {ships.length === 0 ? (
        <p style={{ color: 'var(--ink-faint)' }}>Nothing to repair.</p>
      ) : null}

      {ships.map(({ ship, targets }) => {
        const spare = availableDamageControlParties(ship)
        return (
          <div className="panel-block" key={ship.id}>
            <div className="panel-row">
              <b>{ship.name}</b>
              <span className="spacer" />
              <span className={`num${spare === 0 ? ' is-spent' : ''}`}>
                {spare} of {damageControlParties(ship)} free
              </span>
            </div>
            {targets.map((target) => {
              const on = ship.damageControl.find((a) => a.systemId === target.id)?.parties ?? 0
              return (
                <div className="panel-row" key={target.id}>
                  <span>{target.label}</span>
                  <span className="spacer" />
                  <span className="num" title="Parties on this system (10.4)">
                    {on}
                  </span>
                  <button
                    disabled={spare === 0 || on >= 3}
                    title={on >= 3 ? 'Three parties is the limit (10.4)' : undefined}
                    onClick={() =>
                      dispatch({
                        type: 'assign-damage-control',
                        shipId: ship.id,
                        systemId: target.id,
                        parties: 1,
                      })
                    }
                  >
                    +1
                  </button>
                  <span className="rule-detail">
                    {on === 0 ? 'nobody on it' : `repaired on a ${on} or less`}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}

      <button className="primary" onClick={() => dispatch({ type: 'resolve-damage-control' })}>
        Make repair rolls
      </button>
    </div>
  )
}
