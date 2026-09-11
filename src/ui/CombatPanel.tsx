import { canWeaponFire, enemiesOf, engagedTargets, availableFireCons, type GameState, type ShipState } from '../engine/game'
import { arcTo, distance, isRearArcAttack, rangeBand } from '../engine/geometry'
import { maxRangeOf, needsFireCon } from '../engine/weapons'
import type { Arc, WeaponDef } from '../engine/types'
import { dispatch } from './store'

/**
 * Firing a ship's guns (phase 11).
 *
 * The decision a Full Thrust player makes here is not "shoot the thing" — it is
 * which of a handful of FireCon to spend on which target, and then which
 * weapons can actually bear on each (4.4, 4.2). So the panel is organised by
 * target rather than by weapon: pick who you are shooting at, and see exactly
 * what reaches them and what each gun will roll.
 */
export interface CombatPanelProps {
  game: GameState
  ship: ShipState
  /** Lets the map draw the arcs of whatever weapon is being considered. */
  onHoverWeapon?: (arcs: readonly Arc[] | undefined) => void
}

interface Reach {
  weapon: WeaponDef
  /** Null when it can fire; otherwise why it cannot. */
  blocked: string | null
  /** Dice it would roll, where that is a simple function of range (4.5). */
  dice: number
}

export function CombatPanel({ game, ship, onHoverWeapon }: CombatPanelProps) {
  const targets = enemiesOf(game, ship).filter((e) => !e.destroyed && !e.offTable)
  const engaged = engagedTargets(ship, game.phase)
  const fireCons = availableFireCons(ship, game.phase)

  if (targets.length === 0) {
    return (
      <div className="panel">
        <h3>Phase 11 · Fire</h3>
        <p style={{ color: 'var(--ink-dim)' }}>Nothing to shoot at.</p>
      </div>
    )
  }

  return (
    <div className="panel">
      <h3>Phase 11 · Fire</h3>
      <div className="panel-row">
        <span>FireCon free</span>
        <span className="spacer" />
        <span className="num" style={{ color: fireCons > 0 ? 'var(--screens)' : 'var(--warn)' }}>
          {fireCons}
        </span>
      </div>

      {targets
        .slice()
        .sort(
          (a, b) =>
            distance(ship.placement.position, a.placement.position) -
            distance(ship.placement.position, b.placement.position),
        )
        .map((target) => {
          const range = distance(ship.placement.position, target.placement.position)
          const arc = arcTo(ship.placement.position, ship.placement.facing, target.placement.position)
          const rear = isRearArcAttack(
            target.placement.position,
            target.placement.facing,
            ship.placement.position,
          )
          const reach = ship.design.weapons.map((weapon) => reachOf(ship, weapon, range, arc))
          const able = reach.filter((r) => r.blocked === null)
          const needsNew = !engaged.includes(target.id)

          return (
            <div key={target.id} className="target-block">
              <div className="panel-row">
                <span>{target.name}</span>
                <span className="spacer" />
                {/* The rear arc is the single biggest thing a gunner wants to
                    know before choosing a target (4.10). */}
                {rear ? <span className="rear-flag">REAR ARC</span> : null}
                <span className="num" title={`Range band ${rangeBand(range)}`}>
                  {range.toFixed(1)} MU
                </span>
                <span className="num arcs">{arc}</span>
              </div>

              {able.length === 0 ? (
                <p className="nothing-bears">Nothing bears on them.</p>
              ) : (
                <div className="ssd-systems">
                  {reach.map(({ weapon, blocked, dice }) => (
                    <button
                      key={weapon.id}
                      className={`system-chip weapon-fire${blocked ? ' is-blocked' : ''}`}
                      disabled={blocked !== null || (needsNew && fireCons <= 0 && needsFireCon(weapon))}
                      title={blocked ?? `${dice}D6 at ${range.toFixed(1)} MU`}
                      onMouseEnter={() => onHoverWeapon?.(weapon.arcs)}
                      onMouseLeave={() => onHoverWeapon?.(undefined)}
                      onClick={() =>
                        dispatch({
                          type: 'fire-weapon',
                          shipId: ship.id,
                          weaponId: weapon.id,
                          targetId: target.id,
                        })
                      }
                    >
                      {weapon.label}
                      {blocked ? null : <span className="num">{dice}D6</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

      <button onClick={() => dispatch({ type: 'pass-fire', shipId: ship.id })}>
        Hold fire this turn
      </button>
    </div>
  )
}

/** Whether a weapon can engage a target, and what it would roll (4.2 – 4.5). */
function reachOf(ship: ShipState, weapon: WeaponDef, range: number, arc: Arc): Reach {
  if (ship.destroyedSystems.has(weapon.id)) return { weapon, blocked: 'Knocked out', dice: 0 }
  // 2.6: a weapon fires once a turn, and point defence in phase 9 spends it.
  if (!canWeaponFire(ship, weapon.id)) return { weapon, blocked: 'Already fired', dice: 0 }
  if (!weapon.arcs.includes(arc)) return { weapon, blocked: `Cannot bear into ${arc}`, dice: 0 }
  const reach = maxRangeOf(weapon)
  if (reach === 0) return { weapon, blocked: 'Not implemented yet', dice: 0 }
  if (range > reach) return { weapon, blocked: `Out of range (${reach} MU)`, dice: 0 }
  // The beam pattern: one die per class, less one per band beyond the first
  // (4.5). Weapons that do not follow it still fire; the readout is a hint, and
  // the engine is the authority.
  return { weapon, blocked: null, dice: Math.max(1, weapon.rating - (rangeBand(range) - 1)) }
}
