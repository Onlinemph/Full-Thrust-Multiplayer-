import { canShipFire, canWeaponFire, enemiesOf, engagedTargets, availableFireCons, type GameState, type ShipState } from '../engine/game'
import { arcTo, bearsOn, distance, isRearArcAttack, rangeBand } from '../engine/geometry'
import { maxRangeOf, needsFireCon } from '../engine/weapons'
import { arcsWhenInverted } from '../engine/specialmoves'
import { effectiveScreenLevel, novaArmedOn, optional, waveGunCharge } from '../engine/actions'
import { WAVE_GUN_CHARGE_TARGET } from '../engine/ew'
import { PDS_RANGE } from '../engine/defences'
import type { Arc, WeaponDef } from '../engine/types'
import {
  isSpinalMount,
  spinalCanFire,
  spinalSize,
  SPINAL_MOUNT_PROFILE,
} from '../engine/weapons/kinetics'
import type { AimingMount } from './OrdnancePanel'
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
  /** 5.23's Spinal Mount is laid on a point, so it goes in hand like a bolt. */
  aiming?: AimingMount | null
  onAim?: (mount: AimingMount | null) => void
}

interface Reach {
  weapon: WeaponDef
  /** Null when it can fire; otherwise why it cannot. */
  blocked: string | null
  /** Dice it would roll, where that is a simple function of range (4.5). */
  dice: number
}

export function CombatPanel({ game, ship, onHoverWeapon, aiming, onAim }: CombatPanelProps) {
  const targets = enemiesOf(game, ship).filter((e) => !e.destroyed && !e.offTable)
  const engaged = engagedTargets(ship, game.phase)
  const fireCons = availableFireCons(ship, game.phase)
  // 4.2's optional exception: a ship that spent no thrust at all may shoot
  // through its own drive plume this turn.
  const aftOpen = optional(game).aftArcFire === true && ship.thrustUsed === 0

  // 11.9: an artificial gate is a structure with hull boxes, and knocking
  // them off takes its transfer mass down with them. A natural one "cannot be
  // destroyed by normal weapons fire", so it is not offered.
  const gates = game.gates.filter((gate) => !gate.def.natural && gate.state.hullMarked < gate.def.hullBoxes)

  // 7.23: an armed Nova Cannon is the ship's whole turn. Everything else the
  // panel could offer is already refused, so the panel offers one button.
  const novaCannon = ship.design.weapons.find(
    (weapon) => weapon.weaponClass === 'nova-cannon' && !ship.destroyedSystems.has(weapon.id),
  )
  if (novaCannon && novaArmedOn(game, ship)) {
    return (
      <div className="panel">
        <h3>Phase 11 · Fire</h3>
        <p style={{ color: 'var(--ink-dim)' }}>
          {ship.name} has its whole reactor in the {novaCannon.label}. It fires down the bow line at
          everything the template crosses, and nothing else on the hull fires at all (7.23).
        </p>
        <div className="panel-row">
          <span>Bow line</span>
          <span className="spacer" />
          <button
            className="primary"
            disabled={!canWeaponFire(ship, novaCannon.id)}
            onClick={() =>
              dispatch({ type: 'fire-nova-cannon', shipId: ship.id, weaponId: novaCannon.id })
            }
          >
            Fire the {novaCannon.label}
          </button>
        </div>
        <p className="rule-detail">
          The round is thrown 6 MU ahead and sweeps to 24 behind a 2 MU template for 6D6, then to 48
          behind a 4 MU one for 4D6, then to 72 behind a 6 MU one for 2D6, and burns out. Neither
          screens nor armour answer any of it, and it does not ask whose ships are in the way.
        </p>
      </div>
    )
  }

  // 7.24: a charged Wave Gun is a choice, not a mount in the fire plan. Firing
  // it costs every other gun on the hull for the turn and opens the forward
  // screens, so it gets its own row above the targets rather than a button
  // beside a beam.
  const waveGun = ship.design.weapons.find(
    (weapon) => weapon.weaponClass === 'wave-gun' && !ship.destroyedSystems.has(weapon.id),
  )
  const waveCharge = waveGun ? waveGunCharge(game, ship, waveGun.id) : 0

  // 2.6: a ship's fire is one activation. Once play has moved on to another
  // ship this one is finished for the turn, so the panel says so rather than
  // offering buttons that will be refused.
  if (!canShipFire(ship)) {
    return (
      <div className="panel">
        <h3>Phase 11 · Fire</h3>
        <p style={{ color: 'var(--ink-dim)' }}>
          {ship.name} has had its fire this turn: 2.6 gives a ship one firing activation, and play
          has moved on.
        </p>
      </div>
    )
  }

  // 5.23: a Spinal Mount is not fired at a target, it is laid down a line.
  // It gets its own row above the target list, because picking a ship for it
  // is the wrong gesture — the beam catches whatever the line crosses.
  const spinals = ship.design.weapons.filter(
    (weapon) => isSpinalMount(weapon) && !ship.destroyedSystems.has(weapon.id),
  )

  const shootableRocks = game.terrain.filter(
    (feature) =>
      feature.damagePoints !== undefined && (feature.damageTaken ?? 0) < feature.damagePoints,
  )

  if (
    targets.length === 0 &&
    gates.length === 0 &&
    spinals.length === 0 &&
    shootableRocks.length === 0 &&
    !waveGun
  ) {
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
        {/* 4.4: "each FireCon can be allocated to one enemy target". Firing
            claims one implicitly, which is enough most turns — but a ship that
            wants to hold a FireCon for a target it has not shot at yet, or that
            claimed one by mistake, needs to be able to say so. */}
        <button
          disabled={engaged.length === 0}
          title={
            engaged.length === 0
              ? 'Nothing engaged this phase'
              : `Release ${engaged.length} target${engaged.length === 1 ? '' : 's'} (4.4)`
          }
          onClick={() => dispatch({ type: 'clear-firecons', shipId: ship.id })}
        >
          Release
        </button>
      </div>

      {waveGun ? (
        <div className="panel-row">
          <span>{waveGun.label}</span>
          <span className="spacer" />
          <span
            className="num"
            style={{ color: waveCharge >= WAVE_GUN_CHARGE_TARGET ? 'var(--screens)' : 'var(--warn)' }}
          >
            {waveCharge} / {WAVE_GUN_CHARGE_TARGET}
          </span>
          <button
            className={waveCharge >= WAVE_GUN_CHARGE_TARGET ? 'primary' : undefined}
            disabled={waveCharge < WAVE_GUN_CHARGE_TARGET || ship.weaponsFired.size > 0}
            title={
              waveCharge < WAVE_GUN_CHARGE_TARGET
                ? 'The capacitors are not full yet (7.24)'
                : ship.weaponsFired.size > 0
                  ? '7.24 wants the whole turn, and something has already fired'
                  : '36 MU down the bow line, and nothing else on the hull fires this turn'
            }
            onClick={() =>
              dispatch({ type: 'fire-wave-gun', shipId: ship.id, weaponId: waveGun.id })
            }
          >
            {waveCharge >= WAVE_GUN_CHARGE_TARGET ? 'Let it go' : 'Charging'}
          </button>
          <span className="rule-detail">
            4D6 to 12 MU, 3D6 to 24, 2D6 to 36 — no armour, no standard screens, and the ship is
            open through its own bow arc for the turn (7.24)
          </span>
        </div>
      ) : null}

      {spinals.map((weapon) => {
        const lastFired = ship.weaponLastFiredTurn.get(weapon.id) ?? null
        const ready = spinalCanFire(lastFired, game.turn)
        const held = aiming?.weaponId === weapon.id
        return (
          <div className="panel-row" key={weapon.id}>
            <span>{weapon.label}</span>
            <span className="spacer" />
            <span className="num">{SPINAL_MOUNT_PROFILE[spinalSize(weapon)].range} MU</span>
            <button
              className={held ? 'primary' : undefined}
              disabled={!ready || !canWeaponFire(ship, weapon.id)}
              title={
                ready
                  ? 'Click a point on the table; the beam catches everything it crosses'
                  : `Fired on turn ${lastFired} — a Spinal Mount reloads every other turn (5.23)`
              }
              onClick={() =>
                onAim?.(held ? null : { shipId: ship.id, weaponId: weapon.id, kind: 'spinal' })
              }
            >
              {held ? 'Click a point…' : ready ? 'Lay the beam' : 'Reloading'}
            </button>
            <span className="rule-detail">
              30° off the bow, and the ship holds course next turn (5.23)
            </span>
          </div>
        )
      })}

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
          const reach = ship.design.weapons.map((weapon) =>
            reachOf(ship, weapon, range, arc, aftOpen),
          )
          const able = reach.filter((r) => r.blocked === null)
          const needsNew = !engaged.includes(target.id)

          return (
            <div key={target.id} className="target-block">
              <div className="panel-row">
                <span>{target.name}</span>
                <span className="spacer" />
                {/* Engaging before firing is 4.4's own order of events, and it
                    is what lets a ship hold a FireCon on a target it means to
                    shoot with a later mount. */}
                {needsNew && fireCons > 0 ? (
                  <button
                    onClick={() =>
                      dispatch({ type: 'assign-firecon', shipId: ship.id, targetId: target.id })
                    }
                  >
                    Engage
                  </button>
                ) : null}
                {!needsNew ? <span className="rear-flag">ENGAGED</span> : null}
                {/* The rear arc is the single biggest thing a gunner wants to
                    know before choosing a target (4.10). */}
                {rear ? <span className="rear-flag">REAR ARC</span> : null}
                <span className="num" title={`Range band ${rangeBand(range)}`}>
                  {range.toFixed(1)} MU
                </span>
                <span className="num arcs">{arc}</span>
              </div>

              {/* 7.12: "Point Defense Systems can only be fired against ships
                  without an operational screen/field (of any type) or any
                  remaining armor boxes — i.e. undamaged warships are not
                  vulnerable to such light weapons." So the row appears only
                  when the target is stripped, which is exactly when a player
                  would think to look for it. */}
              {softTarget(ship, target) ? (
                <div className="ssd-systems">
                  {antiShipPd(ship, target).map((mount) => (
                    <button
                      key={mount.id}
                      className="system-chip weapon-fire"
                      title={`One die at ${range.toFixed(1)} MU; a 6 puts one point through (7.12)`}
                      onClick={() =>
                        dispatch({
                          type: 'fire-point-defence',
                          shipId: ship.id,
                          systemId: mount.id,
                          targetId: target.id,
                        })
                      }
                    >
                      {mount.label}
                      <span className="num">1D6</span>
                    </button>
                  ))}
                </div>
              ) : null}

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
                      onMouseEnter={() =>
                        onHoverWeapon?.(arcsWhenInverted(weapon.arcs, ship.rollStatus.inverted))
                      }
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

      {/* 17.1: a rock the scenario gave a damage track to. "The normal rules
          assume that asteroids cannot be destroyed", so the row exists only
          for the ones a scenario opted in. */}
      {game.terrain
        .filter(
          (feature) =>
            feature.damagePoints !== undefined &&
            (feature.damageTaken ?? 0) < feature.damagePoints,
        )
        .map((feature) => {
          const range = Math.max(
            0,
            distance(ship.placement.position, feature.position) - feature.radius,
          )
          const arc = arcTo(ship.placement.position, ship.placement.facing, feature.position)
          const reach = ship.design.weapons.map((weapon) => reachOf(ship, weapon, range, arc, aftOpen))
          if (reach.every((r) => r.blocked !== null)) return null
          const left = (feature.damagePoints ?? 0) - (feature.damageTaken ?? 0)
          return (
            <div key={feature.id} className="target-block">
              <div className="panel-row">
                <span>{feature.label ?? feature.id}</span>
                <span className="spacer" />
                <span style={{ color: 'var(--ink-dim)' }}>
                  {left}/{feature.damagePoints} rock
                </span>
                <span className="num">{range.toFixed(1)} MU</span>
                <span className="num arcs">{arc}</span>
              </div>
              <div className="ssd-systems">
                {reach.map(({ weapon, blocked, dice }) => (
                  <button
                    key={weapon.id}
                    className={`system-chip weapon-fire${blocked ? ' is-blocked' : ''}`}
                    disabled={blocked !== null}
                    title={blocked ?? `${dice}D6 at ${range.toFixed(1)} MU`}
                    onClick={() =>
                      dispatch({
                        type: 'fire-at-terrain',
                        shipId: ship.id,
                        weaponId: weapon.id,
                        terrainId: feature.id,
                      })
                    }
                  >
                    {weapon.label}
                    {blocked ? null : <span className="num">{dice}D6</span>}
                  </button>
                ))}
              </div>
            </div>
          )
        })}

      {gates.map((gate) => {
        const range = distance(ship.placement.position, gate.def.position)
        const arc = arcTo(ship.placement.position, ship.placement.facing, gate.def.position)
        const reach = ship.design.weapons.map((weapon) => reachOf(ship, weapon, range, arc, aftOpen))
        if (reach.every((r) => r.blocked !== null)) return null
        const name = gate.def.label ?? gate.def.id
        return (
          <div key={gate.def.id} className="target-block">
            <div className="panel-row">
              <span>{name}</span>
              <span className="spacer" />
              <span style={{ color: 'var(--ink-dim)' }}>
                {gate.def.hullBoxes - gate.state.hullMarked}/{gate.def.hullBoxes} hull
              </span>
              <span className="num">{range.toFixed(1)} MU</span>
              <span className="num arcs">{arc}</span>
            </div>
            <div className="ssd-systems">
              {reach.map(({ weapon, blocked, dice }) => (
                <button
                  key={weapon.id}
                  className={`system-chip weapon-fire${blocked ? ' is-blocked' : ''}`}
                  disabled={blocked !== null || (!engaged.includes(gate.def.id) && fireCons <= 0 && needsFireCon(weapon))}
                  title={blocked ?? `${dice}D6 at ${range.toFixed(1)} MU`}
                  onClick={() =>
                    dispatch({
                      type: 'fire-at-gate',
                      shipId: ship.id,
                      weaponId: weapon.id,
                      gateId: gate.def.id,
                    })
                  }
                >
                  {weapon.label}
                  {blocked ? null : <span className="num">{dice}D6</span>}
                </button>
              ))}
            </div>
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
function reachOf(
  ship: ShipState,
  weapon: WeaponDef,
  range: number,
  arc: Arc,
  aftOpen: boolean,
): Reach {
  if (ship.destroyedSystems.has(weapon.id)) return { weapon, blocked: 'Knocked out', dice: 0 }
  // 2.6: a weapon fires once a turn, and point defence in phase 9 spends it.
  if (!canWeaponFire(ship, weapon.id)) return { weapon, blocked: 'Already fired', dice: 0 }
  // 16.2: the arcs the gun actually covers, which are mirrored while the ship
  // is inverted. The rose drawn on the map is mirrored the same way, so what a
  // player sees lit is what the engine will accept.
  if (!arcsWhenInverted(weapon.arcs, ship.rollStatus.inverted).includes(arc)) {
    return { weapon, blocked: `Cannot bear into ${arc}`, dice: 0 }
  }
  // 4.2: "No ship may fire offensive weaponry through its aft arc due to the
  // interference of the ship's main drive."
  if (arc === 'A' && !aftOpen) return { weapon, blocked: 'Blocked by the drive (4.2)', dice: 0 }
  const reach = maxRangeOf(weapon)
  if (reach === 0) return { weapon, blocked: 'Not implemented yet', dice: 0 }
  if (range > reach) return { weapon, blocked: `Out of range (${reach} MU)`, dice: 0 }
  // The beam pattern: one die per class, less one per band beyond the first
  // (4.5). Weapons that do not follow it still fire; the readout is a hint, and
  // the engine is the authority.
  return { weapon, blocked: null, dice: Math.max(1, weapon.rating - (rangeBand(range) - 1)) }
}

/**
 * Whether 7.12 will let point defence be fired at this hull.
 *
 * *"Point Defense Systems can only be fired against ships without an
 * operational screen/field (of any type) or any remaining armor boxes – i.e.
 * undamaged warships are not vulnerable to such light weapons."* Read as
 * neither: the gloss that follows settles it, since an undamaged warship has
 * both and must not be a legal target.
 */
function softTarget(ship: ShipState, target: ShipState): boolean {
  if (target.cloaked || target.reflexFieldActive) return false
  if (effectiveScreenLevel(target) > 0) return false
  if (distance(ship.placement.position, target.placement.position) > PDS_RANGE) return false
  return target.design.armour.layers.every(
    (boxes, layer) => boxes - (target.armourMarked[layer] ?? 0) <= 0,
  )
}

/** The PDS and ADS mounts that bear on a stripped hull and have not fired (7.12, 7.13). */
function antiShipPd(ship: ShipState, target: ShipState): Array<{ id: string; label: string }> {
  const arc = arcTo(ship.placement.position, ship.placement.facing, target.placement.position)
  return ship.design.systems
    .filter(
      (system) =>
        (system.kind === 'pds' || system.kind === 'ads') &&
        !ship.destroyedSystems.has(system.id) &&
        canWeaponFire(ship, system.id) &&
        bearsOn(system.arcs ?? PD_ALL_ARCS, arc),
    )
    .map((system) => ({ id: system.id, label: system.label }))
}

/** 4.2 gives point defence "all-round (6-arc) fire capabilities" by default. */
const PD_ALL_ARCS: readonly Arc[] = ['F', 'FS', 'AS', 'A', 'AP', 'FP']
