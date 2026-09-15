import { canWeaponFire, enemiesOf, type GameState, type ShipState } from '../engine/game'
import { distance, arcTo, bearsOn } from '../engine/geometry'
import { maxRangeOf } from '../engine/weapons'
import {
  canMountFlak,
  projectileLine,
  FLAK_MARKER_RANGE,
} from '../engine/weapons/kinetics'
import { magazineFor } from '../data/magazines'
import { dispatch } from './store'
import type { WeaponDef } from '../engine/types'

/**
 * Phase 3, from the player's side of the table (6).
 *
 * Section 6 was reachable only by the computer: the engine had a launch action
 * and the screen had a paragraph explaining what missiles do. Everything a
 * player can launch is here, and each family launches the way its rule says —
 * a missile at a point, a rocket pod at a ship, a plasma bolt at a spot on the
 * table it will go off on regardless of who is standing there.
 */

export type AimingMount = {
  shipId: string
  weaponId: string
  /** 5.23's Spinal Mount is aimed like a bolt: at a point, not a ship. */
  kind: 'missile' | 'plasma-bolt' | 'spinal' | 'flak'
}

export interface OrdnancePanelProps {
  game: GameState
  /** The side taking its launches; null while nobody is nominated. */
  side: string | null
  aiming: AimingMount | null
  onAim: (mount: AimingMount | null) => void
}

const MISSILES = new Set([
  'heavy-missile',
  'salvo-missile-rack',
  'salvo-missile-launcher',
  'antimatter-missile',
])

function launchable(ship: ShipState): WeaponDef[] {
  return ship.design.weapons.filter((weapon) => {
    if (ship.destroyedSystems.has(weapon.id)) return false
    if (!canWeaponFire(ship, weapon.id)) return false
    return (
      MISSILES.has(weapon.weaponClass) ||
      weapon.weaponClass === 'rocket-pod' ||
      weapon.weaponClass === 'plasma-bolt-launcher' ||
      // 5.16: "At the beginning of the Launch Missile Phase" — a barraging
      // K-Gun belongs on this panel and nowhere else.
      (canMountFlak(weapon) && weapon.flak === true)
    )
  })
}

export function OrdnancePanel({ game, side, aiming, onAim }: OrdnancePanelProps) {
  const mine = game.ships.filter(
    (ship) => !ship.destroyed && !ship.offTable && (side === null || ship.side === side),
  )
  const armed = mine.filter((ship) => launchable(ship).length > 0)

  return (
    <div className="panel">
      <h3>Phase 3 · Launch ordnance</h3>
      <p style={{ color: 'var(--ink-dim)' }}>
        A missile is aimed at a point, not at a ship: it attacks whatever it finds within 6 MU of
        that point once everything has moved. The side with initiative launches last.
      </p>

      {armed.length === 0 ? (
        <p style={{ color: 'var(--ink-dim)' }}>Nothing left to launch.</p>
      ) : null}

      {armed.map((ship) => (
        <div key={ship.id} className="ordnance-ship">
          <b>{ship.name}</b>
          {launchable(ship).map((weapon) => {
            if (canMountFlak(weapon) && weapon.flak === true) {
              // 5.16's Blast Marker is a point up-range, so it is aimed the
              // way a missile is — and the marker is a tripwire, so where it
              // goes matters more than what is standing there now.
              const held = aiming?.weaponId === weapon.id
              return (
                <div key={weapon.id} className="ordnance-mount">
                  <span>{weapon.label} · Flak</span>
                  <span className="num">
                    {FLAK_MARKER_RANGE[projectileLine(weapon.variant)]} MU
                  </span>
                  <button
                    className={held ? 'primary' : undefined}
                    onClick={() =>
                      onAim(held ? null : { shipId: ship.id, weaponId: weapon.id, kind: 'flak' })
                    }
                  >
                    {held ? 'Click a point…' : 'Barrage'}
                  </button>
                  <span style={{ color: 'var(--ink-dim)' }}>
                    bursts on anything flying through, yours included (5.16)
                  </span>
                </div>
              )
            }
            if (weapon.weaponClass === 'rocket-pod') {
              // 6.7 picks a ship and rolls both rockets now, so the choice is
              // which hull rather than which patch of table.
              const reachable = enemiesOf(game, ship.side).filter((enemy) => {
                if (enemy.destroyed || enemy.offTable) return false
                const range = distance(ship.placement.position, enemy.placement.position)
                if (range > maxRangeOf(weapon)) return false
                return bearsOn(
                  weapon.arcs,
                  arcTo(ship.placement.position, ship.placement.facing, enemy.placement.position),
                )
              })
              return (
                <div key={weapon.id} className="ordnance-mount">
                  <span>{weapon.label}</span>
                  {reachable.length === 0 ? (
                    <span style={{ color: 'var(--ink-dim)' }}>nothing in arc</span>
                  ) : (
                    reachable.map((enemy) => (
                      <button
                        key={enemy.id}
                        onClick={() =>
                          dispatch({
                            type: 'fire-rocket-pod',
                            shipId: ship.id,
                            weaponId: weapon.id,
                            targetId: enemy.id,
                          })
                        }
                      >
                        {enemy.name}
                      </button>
                    ))
                  )}
                </div>
              )
            }

            const kind = weapon.weaponClass === 'plasma-bolt-launcher' ? 'plasma-bolt' : 'missile'
            const inHand = aiming?.shipId === ship.id && aiming.weaponId === weapon.id
            // 6.6: a launcher fires "provided ammunition is left in the
            // magazine", so the magazine's state is on the row with it.
            const magazine =
              weapon.weaponClass === 'salvo-missile-launcher'
                ? magazineFor(ship.design, weapon.id)
                : undefined
            const supply =
              weapon.weaponClass !== 'salvo-missile-launcher'
                ? null
                : magazine === undefined
                  ? { text: 'no magazine', ok: false }
                  : ship.destroyedSystems.has(magazine.id)
                    ? { text: `magazine ${magazine.id} knocked out`, ok: false }
                    : (ship.magazines.get(magazine.id) ?? []).length === 0
                      ? { text: `magazine ${magazine.id} empty`, ok: false }
                      : {
                          text: `magazine ${magazine.id}: ${(ship.magazines.get(magazine.id) ?? []).length} load${
                            (ship.magazines.get(magazine.id) ?? []).length === 1 ? '' : 's'
                          }`,
                          ok: true,
                        }
            return (
              <div key={weapon.id} className="ordnance-mount">
                <span>{weapon.label}</span>
                <button
                  className={inHand ? 'primary' : undefined}
                  disabled={supply !== null && !supply.ok}
                  title={supply !== null && !supply.ok ? `${supply.text} (6.6)` : undefined}
                  onClick={() => onAim(inHand ? null : { shipId: ship.id, weaponId: weapon.id, kind })}
                >
                  {inHand ? 'Click the table…' : 'Take aim'}
                </button>
                <span style={{ color: 'var(--ink-dim)' }}>{maxRangeOf(weapon)} MU</span>
                {supply !== null ? (
                  <span style={{ color: supply.ok ? 'var(--ink-dim)' : 'var(--warn)' }}>{supply.text}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
