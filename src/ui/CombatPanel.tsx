import { useState } from 'react'
import { canShipFire, canWeaponFire, enemiesOf, engagedTargets, availableFireCons, type GameState, type ShipState } from '../engine/game'
import { arcTo, distance, isRearArcAttack, rangeBand } from '../engine/geometry'
import { maxRangeOf, needsFireCon } from '../engine/weapons'
import { arcsWhenInverted } from '../engine/specialmoves'
import {
  antiShipPdMounts,
  novaArmedOn,
  optional,
  pointDefenceCanEngage,
  waveGunCharge,
} from '../engine/actions'
import { WAVE_GUN_CHARGE_TARGET } from '../engine/ew'
import { PLASMA_BOLT_RANGE } from '../engine/ordnance'
import { COMMANDO_RAID_FORBIDDEN } from '../engine/weapons/beams'
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
  /** Whether this console commands the ship; a sheet only, otherwise. */
  canCommand?: boolean
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

/** One shot in the declaration: a weapon, and what it is at. */
interface PlannedShot {
  targetId: string
  kind: 'ship' | 'flight' | 'gunboats'
  label: string
}

export function CombatPanel({
  game,
  ship,
  canCommand = true,
  onHoverWeapon,
  aiming,
  onAim,
}: CombatPanelProps) {
  const targets = enemiesOf(game, ship).filter((e) => !e.destroyed && !e.offTable)
  /* 2.6 phase 11: "The player must declare all the fire for his ship, before
     any dice are rolled." So a weapon is clicked onto a target to declare it,
     the declaration is read back, and one button rolls the lot. The plan is
     this console's until it is fired; the panel is keyed by ship, so picking
     another ship starts a fresh sheet. */
  const [plan, setPlan] = useState<Record<string, PlannedShot>>({})
  const declare = (weaponId: string, shot: PlannedShot) =>
    setPlan((current) => {
      const next = { ...current }
      if (next[weaponId]?.targetId === shot.targetId) delete next[weaponId]
      else next[weaponId] = shot
      return next
    })
  const fireVolley = () => {
    const shots = Object.entries(plan).map(([weaponId, shot]) => ({
      weaponId,
      targetId: shot.targetId,
      kind: shot.kind,
    }))
    const outcome = dispatch({ type: 'fire-volley', shipId: ship.id, shots })
    if (outcome.refused === undefined) setPlan({})
  }
  // 2.6: "Starting with the player who won initiative, each player alternates
  // in firing … one ship." Whose turn it is decides whether the plan can be
  // fired now, and the panel says so rather than letting the engine refuse.
  const turn = game.fire.side
  const myTurn = turn === null || turn === ship.side
  const turnName = turn === null ? null : (game.sides.find((s) => s.id === turn)?.name ?? turn)
  const declared = Object.keys(plan).length
  const mayFire = canCommand && myTurn
  const engaged = engagedTargets(ship, game.phase)
  const fireCons = availableFireCons(ship, game.phase)
  // 4.2's optional exception: a ship that spent no thrust at all may shoot
  // through its own drive plume this turn.
  const aftOpen = optional(game).aftArcFire === true && ship.thrustUsed === 0
  // 5.9: the transporters that could mount a commando raid, and the system
  // each target is currently lined up for.
  const raiders = ship.design.weapons.filter(
    (weapon) => weapon.weaponClass === 'transporter' && !ship.destroyedSystems.has(weapon.id),
  )
  const [raidSystems, setRaidSystems] = useState<Record<string, string>>({})

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
      {!myTurn ? (
        <p className="fire-turn">
          {turnName}&rsquo;s turn to fire a ship. Yours comes round after theirs (2.6).
        </p>
      ) : null}
      {!canCommand ? (
        <p className="fire-turn">This ship is not yours to fire.</p>
      ) : null}
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

      {/* The declaration, read back before the dice: what is aimed at what,
          and one button for all of it (2.6). */}
      <div className="fire-plan">
        {declared === 0 ? (
          <span style={{ color: 'var(--ink-dim)' }}>
            Click a weapon under a target to declare it. Nothing rolls until the whole plan is fired.
          </span>
        ) : (
          <ul className="fire-plan-list">
            {Object.entries(plan).map(([weaponId, shot]) => (
              <li key={weaponId}>
                <span>{ship.design.weapons.find((w) => w.id === weaponId)?.label ?? weaponId}</span>
                <span className="fire-plan-at">at {shot.label}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="panel-row" style={{ background: 'none', padding: 0 }}>
          <button
            className="primary"
            disabled={!mayFire || declared === 0}
            title={
              !myTurn
                ? `${turnName}'s turn to fire (2.6)`
                : declared === 0
                  ? 'Nothing declared yet'
                  : 'Roll the whole declaration; the ship is then done for the turn (2.6)'
            }
            onClick={fireVolley}
          >
            Fire {declared > 0 ? `${declared} shot${declared === 1 ? '' : 's'}` : ''}
          </button>
          <button
            disabled={!mayFire}
            title="Take the ship's turn without firing (2.6)"
            onClick={() => dispatch({ type: 'pass-fire', shipId: ship.id })}
          >
            Hold fire
          </button>
        </div>
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
              {pointDefenceCanEngage(game, ship, target) ? (
                <div className="ssd-systems">
                  {antiShipPdMounts(game, ship, target).map((mount) => (
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

              {/* 5.9's commando raid: "instead of attempting to capture the
                  ship they can attempt to destroy a single system". ONLY
                  Marines, never a Damage Control Party, and never against a
                  Core system or an antimatter charge. */}
              {raiders.length > 0 && ship.marinesAboard > 0 ? (
                <div className="panel-row">
                  <span>Commando raid</span>
                  <span className="spacer" />
                  <select
                    aria-label={`System to raid aboard ${target.name}`}
                    value={raidSystems[target.id] ?? ''}
                    onChange={(event) =>
                      setRaidSystems((current) => ({ ...current, [target.id]: event.target.value }))
                    }
                  >
                    <option value="">pick a system…</option>
                    {target.design.systems
                      .filter(
                        (system) =>
                          !target.destroyedSystems.has(system.id) &&
                          !COMMANDO_RAID_FORBIDDEN.includes(system.kind),
                      )
                      .map((system) => (
                        <option key={system.id} value={system.id}>
                          {system.label}
                        </option>
                      ))}
                  </select>
                  {raiders.map((weapon) => (
                    <button
                      key={`raid-${weapon.id}`}
                      disabled={
                        !raidSystems[target.id] ||
                        !canWeaponFire(ship, weapon.id) ||
                        range > maxRangeOf(weapon) ||
                        !weapon.arcs.includes(arc)
                      }
                      title={`${weapon.label}: one Marine party against one system (5.9)`}
                      onClick={() =>
                        dispatch({
                          type: 'commando-raid',
                          shipId: ship.id,
                          weaponId: weapon.id,
                          targetId: target.id,
                          systemId: raidSystems[target.id] ?? '',
                        })
                      }
                    >
                      {weapon.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* 6.8's optional shaped charge: the launcher used as a gun,
                  1D3 a class, SAP, and Standard Screens do nothing to it. Its
                  own row because it spends the launcher's every-other-turn
                  shot rather than placing a marker. */}
              {optional(game).shapedCharges === true ? (
                <div className="ssd-systems">
                  {ship.design.weapons
                    .filter(
                      (weapon) =>
                        weapon.weaponClass === 'plasma-bolt-launcher' &&
                        !ship.destroyedSystems.has(weapon.id) &&
                        range <= PLASMA_BOLT_RANGE &&
                        weapon.arcs.includes(arc),
                    )
                    .map((weapon) => (
                      <button
                        key={`charge-${weapon.id}`}
                        className="system-chip weapon-fire"
                        title={`${weapon.rating}D3 Semi-Armour Piercing at ${range.toFixed(1)} MU (6.8)`}
                        onClick={() =>
                          dispatch({
                            type: 'fire-shaped-charge',
                            shipId: ship.id,
                            weaponId: weapon.id,
                            targetId: target.id,
                          })
                        }
                      >
                        {weapon.label} charge
                        <span className="num">{weapon.rating}D3</span>
                      </button>
                    ))}
                </div>
              ) : null}

              {able.length === 0 ? (
                <p className="nothing-bears">Nothing bears on them.</p>
              ) : (
                <div className="ssd-systems">
                  {reach.map(({ weapon, blocked, dice }) => {
                    const here = plan[weapon.id]?.targetId === target.id
                    const elsewhere = plan[weapon.id] !== undefined && !here
                    return (
                      <button
                        key={weapon.id}
                        className={`system-chip weapon-fire${blocked ? ' is-blocked' : ''}${
                          here ? ' is-planned' : elsewhere ? ' is-elsewhere' : ''
                        }`}
                        disabled={!canCommand || blocked !== null}
                        title={
                          blocked ??
                          (here
                            ? 'Declared at this target — click to take it off'
                            : elsewhere
                              ? `Declared at ${plan[weapon.id]?.label}; click to move it here`
                              : `${dice}D6 at ${range.toFixed(1)} MU — click to declare`)
                        }
                        onMouseEnter={() =>
                          onHoverWeapon?.(arcsWhenInverted(weapon.arcs, ship.rollStatus.inverted))
                        }
                        onMouseLeave={() => onHoverWeapon?.(undefined)}
                        onClick={() =>
                          declare(weapon.id, { targetId: target.id, kind: 'ship', label: target.name })
                        }
                      >
                        {weapon.label}
                        {blocked ? null : <span className="num">{dice}D6</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

      {/* 9.1: "Direct Fire Anti-ship weapons may fire at gunboats normally,
          with each HIT destroying ONE gunboat. In the case of weapons that do
          multiple points of damage ... do not roll damage." So a Beam-3 at
          close range really does kill three boats. */}
      {game.gunboatSquadrons
        .filter(
          (squadron) =>
            squadron.side !== ship.side &&
            squadron.status === 'in-flight' &&
            squadron.boats.length > 0,
        )
        .map((squadron) => {
          const range = distance(ship.placement.position, squadron.position)
          const arc = arcTo(ship.placement.position, ship.placement.facing, squadron.position)
          const reach = ship.design.weapons.map((weapon) =>
            reachOf(ship, weapon, range, arc, aftOpen),
          )
          if (reach.every((r) => r.blocked !== null)) return null
          return (
            <div key={squadron.id} className="target-block">
              <div className="panel-row">
                <span>{squadron.label}</span>
                <span className="spacer" />
                <span style={{ color: 'var(--ink-dim)' }}>{squadron.boats.length} boats</span>
                <span className="num">{range.toFixed(1)} MU</span>
                <span className="num arcs">{arc}</span>
              </div>
              <div className="ssd-systems">
                {reach.map(({ weapon, blocked, dice }) => {
                  const here = plan[weapon.id]?.targetId === squadron.id
                  const elsewhere = plan[weapon.id] !== undefined && !here
                  return (
                    <button
                      key={weapon.id}
                      className={`system-chip weapon-fire${blocked ? ' is-blocked' : ''}${
                        here ? ' is-planned' : elsewhere ? ' is-elsewhere' : ''
                      }`}
                      disabled={!canCommand || blocked !== null}
                      title={blocked ?? `${dice}D6, and every hit kills a boat (9.1) — click to declare`}
                      onClick={() =>
                        declare(weapon.id, { targetId: squadron.id, kind: 'gunboats', label: squadron.label })
                      }
                    >
                      {weapon.label}
                      {blocked ? null : <span className="num">{dice}D6</span>}
                    </button>
                  )
                })}
              </div>
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
