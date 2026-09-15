import type { ShipDesign, WeaponDef } from '../engine/types'
import { ALL_ARCS } from '../data/buildCatalog'
import { boughtArcs, catalogueEntryFor, fitArcs, mountingFor } from '../data/arcs'
import { canMountFlak, FLAK_UPGRADE_POINTS } from '../engine/weapons/kinetics'

/**
 * The weapons already on the hull (4.2, 5.22, 6.6).
 *
 * The shipyard could add a mounting and never show it again: the grid of
 * add-buttons wrote a `WeaponDef` into the design and there was no row for it
 * afterwards, so a mount could not be removed, its arcs could not be chosen,
 * it could not be put in a turret, and a one-shot rack could not be told how
 * many shots it carried. Four of section 5 and 6's rules need a fitted weapon
 * to be editable before they can be built at all.
 *
 * Arcs are the interesting one. 4.2 sells a mounting *by the number of arcs*
 * it covers and leaves which arcs to the designer — a three-arc beam is a
 * forward battery or a broadside depending on where you point it, at the same
 * price — so the count is fixed by what was bought and the choice is free.
 * The count is read off the price (`boughtArcs`), never off the arcs chosen
 * so far: taking an arc off a three-arc mounting leaves a three-arc mounting
 * with a slot free, and a wider mounting is bought from the row itself.
 */
export function FittedWeapons({
  design,
  edit,
}: {
  design: ShipDesign
  edit: (patch: Partial<ShipDesign>) => void
}) {
  if (design.weapons.length === 0) {
    return <p className="rule-detail">Nothing fitted yet.</p>
  }

  const replace = (id: string, patch: Partial<WeaponDef>) =>
    edit({ weapons: design.weapons.map((w) => (w.id === id ? { ...w, ...patch } : w)) })

  return (
    <div className="fitted-weapons">
      {design.weapons.map((weapon) => (
        <div className="fitted-row" key={weapon.id}>
          <div className="panel-row">
            <b>{weapon.label}</b>
            <span className="spacer" />
            <span className="num">{weapon.mass}m</span>
            <span className="num">{weapon.points}p</span>
            <button
              title="Take it off the hull"
              onClick={() => edit({ weapons: design.weapons.filter((w) => w.id !== weapon.id) })}
            >
              Remove
            </button>
          </div>

          {/* 4.2: the mounting is bought by arc count; which arcs is free. */}
          {(() => {
            const entry = catalogueEntryFor(weapon)
            const mounting = mountingFor(weapon)
            const bought = boughtArcs(weapon)
            const chosen = weapon.arcs.length
            const full = chosen >= bought
            return (
              <div className="panel-row arc-picker">
                {entry !== undefined && mounting !== undefined && entry.mountings.length > 1 ? (
                  <select
                    aria-label={`${weapon.label} mounting`}
                    title="How many arcs the mounting is bought to cover (4.2); the price follows"
                    value={mounting.arcs}
                    onChange={(event) => {
                      const next = entry.mountings.find((m) => m.arcs === Number(event.target.value))
                      if (!next) return
                      replace(weapon.id, {
                        mass: next.mass,
                        points: next.points,
                        arcs: fitArcs(weapon.arcs, next.arcs),
                      })
                    }}
                  >
                    {entry.mountings.map((m) => (
                      <option key={m.arcs} value={m.arcs}>
                        {m.arcs}-arc — {m.mass} mass, {m.points} pts
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rule-detail">{bought}-arc</span>
                )}
                {ALL_ARCS.map((arc) => {
                  const on = weapon.arcs.includes(arc)
                  return (
                    <button
                      key={arc}
                      className={`arc-chip${on ? ' is-on' : ''}`}
                      disabled={!on && full}
                      title={
                        on
                          ? `Take ${arc} off — the mounting keeps its ${bought} arcs to fill`
                          : full
                            ? `Bought as a ${bought}-arc mounting: take one off first, or buy a wider one`
                            : `Cover ${arc}`
                      }
                      onClick={() =>
                        replace(weapon.id, {
                          arcs: on ? weapon.arcs.filter((a) => a !== arc) : [...weapon.arcs, arc],
                        })
                      }
                    >
                      {arc}
                    </button>
                  )
                })}
                <span
                  className="num arc-count"
                  style={{ color: full ? 'var(--ink-dim)' : 'var(--warn)' }}
                  title={full ? 'Every arc bought is covered' : `${bought - chosen} bought and not yet placed`}
                >
                  {chosen}/{bought}
                </span>
              </div>
            )
          })()}

          {/* 5.22: a turret widens what a mounting can bear on, at the cost of
              the turret's own mass. A mount belongs to at most one. */}
          {design.turrets.length > 0 ? (
            <div className="panel-row">
              <label>
                Turret{' '}
                <select
                  aria-label={`${weapon.label} turret`}
                  value={weapon.turretId ?? ''}
                  onChange={(event) =>
                    replace(weapon.id, { turretId: event.target.value || undefined })
                  }
                >
                  <option value="">fixed mounting</option>
                  {design.turrets.map((turret) => (
                    <option key={turret.id} value={turret.id}>
                      {turret.id} ({turret.capacity} mass)
                    </option>
                  ))}
                </select>
              </label>
              <span className="spacer" />
              <span className="rule-detail">
                a turret bears through every arc it can traverse (5.22)
              </span>
            </div>
          ) : null}

          {/* 5.16: "For an additional 2 points a K-Gun may be equipped with
              Flak ammunition. All the K-Guns on a ship (except K-1s) must be
              so equipped" — so the toggle loads the whole battery at once. */}
          {canMountFlak(weapon) ? (
            <div className="panel-row">
              <label>
                <input
                  type="checkbox"
                  checked={weapon.flak === true}
                  onChange={(event) => {
                    const on = event.target.checked
                    edit({
                      weapons: design.weapons.map((w) =>
                        canMountFlak(w)
                          ? {
                              ...w,
                              flak: on ? true : undefined,
                              points: w.points + (on ? FLAK_UPGRADE_POINTS : -FLAK_UPGRADE_POINTS),
                            }
                          : w,
                      ),
                    })
                  }}
                />{' '}
                Flak ammunition
              </label>
              <span className="spacer" />
              <span className="rule-detail">
                +{FLAK_UPGRADE_POINTS} points a gun, and every K-Gun above class 1 takes it (5.16)
              </span>
            </div>
          ) : null}

          {/* 6.6: "Once fired, it is crossed off and cannot be used again." */}
          {weapon.ammo !== undefined ? (
            <div className="panel-row">
              <span className="rule-detail">Shots</span>
              <span className="spacer" />
              <span className="num">{weapon.ammo}</span>
              <span className="rule-detail">
                crossed off when it fires — the mounting is the missile (6.6)
              </span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
