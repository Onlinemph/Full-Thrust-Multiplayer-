/**
 * Electronic warfare, cloaks and the two superweapons (7.17 – 7.25).
 *
 * 7.17 – 7.25 print only two pieces of arithmetic and both are tests here:
 * 7.17's *"Holofields can be combined with up to 3 levels ECM; this would reduce
 * fighter/missile lock-on range to 2 MU"* (with 7.18's *"a net -4 MU range
 * reduction"* said from the other side), and 7.20's *"For example a 100 mass
 * ship would pay 50 points for a Cloaking Device"*. Everything else is the
 * printed tables — the beam-dice equivalence of the Holofield's replacement
 * table, the three nova templates, the three wave-gun bands, the reflex field's
 * D6 — checked die by die.
 */

import { describe, expect, it } from 'vitest'

import { Rng, beamDamage, rollBeamVolley } from './dice'
import {
  AREA_ECM_RADIUS,
  BANNABLE_SYSTEMS,
  BASE_LOCK_ON_RANGE_MU,
  CLOAK_BOXES,
  CLOAK_DRM,
  CLOAK_MAX_VELOCITY,
  DEFAULT_CAMPAIGN_BANS,
  EW_COSTS,
  EW_WEAPON_SPECS,
  HOLOFIELD_DRM,
  MAX_AGGREGATE_ECM_LEVEL,
  NOVA_ARMING_DISTANCE_MU,
  NOVA_SWEEPS,
  NOVA_TOTAL_RANGE_MU,
  REFLEX_FIELD_RESTRICTIONS,
  WAVE_GUN_BANDS,
  WAVE_GUN_CHARGE_TARGET,
  WAVE_GUN_FIRING_RESTRICTIONS,
  WAVE_GUN_RANGE_MU,
  advanceNovaBursts,
  aggregateEcmLevel,
  applyCloakDamage,
  areaEcmBlocks,
  armNovaCannon,
  chargeWaveGun,
  cloakCapability,
  cloakEndOfMovement,
  cloakEndOfTurn,
  cloakMode,
  cloakPoints,
  cloakMass,
  cloakRestrictions,
  cloakStartOfMovement,
  cloakVelocityLegal,
  createCloakState,
  createNovaCannonState,
  createWaveGunState,
  dischargeWaveGun,
  ecmSensorRange,
  ewFireEffect,
  fireNovaCannon,
  isEnergyWeapon,
  isSystemBanned,
  isWaveGunCharged,
  lockOnRange,
  netEwDrm,
  novaArmingLost,
  novaContact,
  orderCloak,
  rollNovaDamage,
  rollReflexField,
  rollWaveGunDamage,
  templateContacts,
  validateEwFit,
  waveGunBandAt,
  waveGunContact,
  waveGunKnockOutDamage,
  type CloakKind,
  type CloakState,
  type EwFiringContext,
  type EwShot,
} from './ew'
import type { Course, Point, WeaponDef } from './types'

// ---------------------------------------------------------------------------
// Test scaffolding
// ---------------------------------------------------------------------------

/**
 * An `Rng` that hands back a scripted list of d6 faces, so a table can be
 * replayed die for die. `Rng.int(6)` is `floor(next() * 6)`, so a face `f` is
 * produced by a value just above `(f - 1) / 6`.
 */
class ScriptedRng extends Rng {
  private readonly faces: readonly number[]
  private index = 0

  constructor(faces: readonly number[]) {
    super(1)
    this.faces = faces
  }

  override next(): number {
    const face = this.faces[this.index] ?? 1
    this.index += 1
    return (face - 1) / 6 + 1e-9
  }

  get consumed(): number {
    return this.index
  }
}

const at = (x: number, y: number): Point => ({ x, y })

/** A shot that rolls beam dice at `range`, with nothing else going on. */
const beamShot = (range: number, extra: Partial<EwShot> = {}): EwShot => ({
  range,
  usesBeamDice: true,
  ...extra,
})

const spinalUp: Course = 12

function mount(id: string, weaponClass: WeaponDef['weaponClass']): WeaponDef {
  return {
    id,
    label: id,
    weaponClass,
    rating: 1,
    variant: 'standard',
    arcs: ['F'],
    mass: 20,
    points: 60,
  }
}

function context(range: number, extra: Partial<EwFiringContext> = {}): EwFiringContext {
  return {
    range,
    arc: 'F',
    targetScreens: 0,
    rearArc: false,
    drm: 0,
    rng: new Rng(1),
    ...extra,
  }
}

// ---------------------------------------------------------------------------
// 7.17 Holofield
// ---------------------------------------------------------------------------

describe('7.17 Holofield', () => {
  it('is exactly the -1 DRM 5.23 names: "only score one hit on a 5 or 6"', () => {
    // 7.17's replacement table against an unscreened target (a Holofield ship
    // can have no screens), face by face.
    const table: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 1 }
    for (const face of [1, 2, 3, 4, 5, 6]) {
      const modified = Math.max(1, Math.min(6, face + HOLOFIELD_DRM))
      expect(beamDamage(modified, 0)).toBe(table[face])
    }
  })

  it('leaves the natural 6 its re-roll, and modifies the re-roll too', () => {
    // Natural 6, re-rolled 6, then a 3: the 6s each score 1 instead of 2 and the
    // re-roll chain continues on the natural face (4.6).
    const volley = rollBeamVolley(1, 0, new ScriptedRng([6, 6, 3]), {
      drm: netEwDrm(beamShot(24), { holofield: true }),
      penetrating: true,
    })
    expect(volley.normalDamage).toBe(1)
    expect(volley.penetratingDamage).toBe(1)
    expect(volley.dice).toHaveLength(3)
  })

  it('is ignored by anything firing at 6 MU or less', () => {
    expect(netEwDrm(beamShot(6), { holofield: true })).toBe(0)
    expect(netEwDrm(beamShot(6.5), { holofield: true })).toBe(HOLOFIELD_DRM)
  })

  it('adds 12 MU to a weapon that does not roll beam dice, and can make it miss', () => {
    const inRange = ewFireEffect(
      { range: 12, usesBeamDice: false, maxRange: 36 },
      { holofield: true },
    )
    expect(inRange.effectiveRange).toBe(24)
    expect(inRange.autoMiss).toBe(false)
    expect(inRange.drm).toBe(0)

    const past = ewFireEffect({ range: 30, usesBeamDice: false, maxRange: 36 }, { holofield: true })
    expect(past.effectiveRange).toBe(42)
    expect(past.autoMiss).toBe(true)
  })

  it('is ignored by graviton beams and by area-effect weapons (5.23)', () => {
    expect(netEwDrm(beamShot(24, { gravitonBeam: true }), { holofield: true })).toBe(0)
    expect(netEwDrm(beamShot(24, { areaEffect: true }), { holofield: true })).toBe(0)
  })

  it('makes needle beams ineffective, but not inside 6 MU', () => {
    expect(
      ewFireEffect(beamShot(18, { needleBeam: true }), { holofield: true }).mayTargetSystems,
    ).toBe(false)
    expect(
      ewFireEffect(beamShot(4, { needleBeam: true }), { holofield: true }).mayTargetSystems,
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 7.18 ECM and 7.19 Area ECM
// ---------------------------------------------------------------------------

describe('7.18 ECM / 7.19 Area ECM', () => {
  it('carries no to-hit modifier of its own', () => {
    // 7.18 lists two effects: enemy sensor range and ordnance lock-on. Neither
    // is a DRM, and the -1 players remember belongs to the Holofield.
    expect(netEwDrm(beamShot(24), { ecmLevel: 3 })).toBe(0)
    expect(netEwDrm(beamShot(24), { ecmLevel: 2, areaEcmLevel: 1 })).toBe(0)
  })

  it('caps the aggregate of own and area ECM at 3', () => {
    expect(aggregateEcmLevel(2, 1)).toBe(3)
    expect(aggregateEcmLevel(3, 3)).toBe(MAX_AGGREGATE_ECM_LEVEL)
    expect(aggregateEcmLevel(0, 0)).toBe(0)
  })

  it('subtracts 6 MU of enemy sensor range per level', () => {
    // 54 MU is the FireCon range 7.4 names; the base is the caller's, since the
    // de-blip table itself is in section 12 and not in the extract.
    expect(ecmSensorRange(54, 2)).toBe(42)
    expect(ecmSensorRange(54, 3)).toBe(36)
    expect(ecmSensorRange(12, 3)).toBe(0)
  })

  it('blinds the carrying ship’s own FireCons but not its point defence', () => {
    expect(areaEcmBlocks('firecon')).toBe(true)
    expect(areaEcmBlocks('advanced-firecon')).toBe(true)
    for (const user of ['pds', 'ads', 'scattergun', 'grapeshot', 'adfc', 'advanced-adfc'] as const) {
      expect(areaEcmBlocks(user)).toBe(false)
    }
  })

  it('covers allies out to 6 MU', () => {
    expect(AREA_ECM_RADIUS).toBe(6)
  })
})

describe('lock-on ranges (7.17, 7.18)', () => {
  it('reproduces 7.17’s worked example: 3 ECM plus a Holofield leaves 2 MU', () => {
    expect(BASE_LOCK_ON_RANGE_MU).toBe(6)
    expect(lockOnRange('missile', { holofield: true, ecmLevel: 3 })).toBe(2)
    expect(lockOnRange('fighter', { holofield: true, ecmLevel: 3 })).toBe(2)
    // 7.18 states the same thing as a total: "a net -4 MU range reduction".
    expect(BASE_LOCK_ON_RANGE_MU - (lockOnRange('gunboat', { holofield: true, ecmLevel: 3 }) ?? 0)).toBe(4)
  })

  it('takes 1 MU per ECM level and 1 MU for a Holofield', () => {
    expect(lockOnRange('missile', { ecmLevel: 1 })).toBe(5)
    expect(lockOnRange('missile', { ecmLevel: 2, areaEcmLevel: 1 })).toBe(3)
    expect(lockOnRange('missile', { holofield: true })).toBe(5)
    // The aggregate cap still applies: four levels of ECM only take three.
    expect(lockOnRange('missile', { ecmLevel: 4 })).toBe(3)
  })

  it('leaves rockets alone: "ECM has no effect on rockets"', () => {
    expect(lockOnRange('rocket', { ecmLevel: 3, holofield: true })).toBe(BASE_LOCK_ON_RANGE_MU)
  })

  it('lets nothing lock on to a cloaked ship at all', () => {
    expect(lockOnRange('missile', { cloak: 'partial' })).toBeNull()
    expect(lockOnRange('fighter', { cloak: 'total' })).toBeNull()
    // Even a rocket, which is exempt from ECM, has nothing to fly at.
    expect(lockOnRange('rocket', { cloak: 'partial' })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 7.20 – 7.22 Cloaks
// ---------------------------------------------------------------------------

describe('7.20 Cloaking Device: what an attacker suffers', () => {
  it('doubles the range and applies -2, re-rolls included', () => {
    const effect = ewFireEffect(beamShot(10), { cloak: 'partial' })
    expect(effect.drm).toBe(CLOAK_DRM)
    expect(effect.effectiveRange).toBe(20)
    expect(effect.untargetable).toBe(false)

    // The DRM reaches re-roll dice because dice.rollBeamVolley modifies every
    // die it throws: a natural 6 re-rolled into a 6 scores 1 instead of 2.
    const volley = rollBeamVolley(1, 0, new ScriptedRng([6, 6, 1]), {
      drm: effect.drm,
      penetrating: true,
    })
    expect(volley.normalDamage).toBe(1)
    expect(volley.penetratingDamage).toBe(1)
  })

  it('stops needle beams picking a system', () => {
    expect(ewFireEffect(beamShot(8, { needleBeam: true }), { cloak: 'partial' }).mayTargetSystems).toBe(
      false,
    )
  })
})

describe('7.21 Cloaking Field: what an attacker suffers', () => {
  it('cannot be shot at at all', () => {
    const effect = ewFireEffect(beamShot(10), { cloak: 'total' })
    expect(effect.untargetable).toBe(true)
    expect(effect.autoMiss).toBe(true)
    expect(effect.drm).toBe(0)
  })
})

describe('cloak state machine (7.20 – 7.22)', () => {
  const order = (kind: CloakKind, turns: number): CloakState => {
    const state = createCloakState(kind)
    return { ...state, ordered: turns }
  }

  it('raises a Cloaking Device at the end of the movement phase and keeps it up three turns', () => {
    // Ordered "3 turns" in turn 1: cloaked for the fire phases of turns 1, 2
    // and 3, decloaking at the same point in turn 4 at which it cloaked.
    let state = order('cloaking-device', 3)
    state = cloakStartOfMovement(state, at(0, 0))
    expect(cloakMode(state)).toBe('none') // 7.20 cloaks at the *end* of movement

    state = cloakEndOfMovement(state, { velocity: 8 })
    expect(cloakMode(state)).toBe('partial') // turn 1
    expect(state.turnsRemaining).toBe(3)
    expect(state.entryPoint).toBeNull() // the model stays on the table

    state = cloakEndOfMovement(state, { velocity: 8 })
    expect(cloakMode(state)).toBe('partial') // turn 2
    state = cloakEndOfMovement(state, { velocity: 8 })
    expect(cloakMode(state)).toBe('partial') // turn 3
    state = cloakEndOfMovement(state, { velocity: 8 })
    expect(cloakMode(state)).toBe('none') // turn 4: down
    expect(state.turnsRemaining).toBe(0)
  })

  it('raises a Cloaking Field at the start of movement and marks where it went', () => {
    let state = order('cloaking-field', 3)
    state = cloakStartOfMovement(state, at(10, -4))
    expect(cloakMode(state)).toBe('total')
    expect(state.entryPoint).toEqual({ x: 10, y: -4 })
    expect(cloakRestrictions(cloakMode(state)).onTable).toBe(false)

    // Three unseen moves, then it comes back at the end of the third.
    state = cloakEndOfMovement(state, { velocity: 30 })
    expect(cloakMode(state)).toBe('total')
    state = cloakEndOfMovement(state, { velocity: 30 })
    expect(cloakMode(state)).toBe('total')
    state = cloakEndOfMovement(state, { velocity: 30 })
    expect(cloakMode(state)).toBe('none')
    expect(state.entryPoint).toBeNull()
  })

  it('degrades a damaged Cloaking Field to a standard cloak, and kills it on the second box', () => {
    expect(CLOAK_BOXES['cloaking-field']).toBe(2)
    let state = createCloakState('cloaking-field')
    expect(cloakCapability(state)).toBe('total')
    state = applyCloakDamage(state)
    expect(cloakCapability(state)).toBe('partial')
    state = applyCloakDamage(state)
    expect(cloakCapability(state)).toBe('none')
  })

  it('kills a Tuffley Cloak with its single box: "If the Tuffley Cloak is damaged it ceases to function"', () => {
    expect(CLOAK_BOXES['tuffley-cloak']).toBe(1)
    const state = applyCloakDamage(createCloakState('tuffley-cloak'))
    expect(cloakCapability(state)).toBe('none')
  })

  it('keeps a ship hidden until the end of the turn when a threshold check kills the cloak', () => {
    let state = cloakEndOfMovement(order('cloaking-device', 3), { velocity: 4 })
    expect(cloakMode(state)).toBe('partial')

    state = applyCloakDamage(state) // phase 13
    expect(cloakMode(state)).toBe('partial') // "uncloaks at the end of the turn"
    expect(state.decloakAtEndOfTurn).toBe(true)

    state = cloakEndOfTurn(state)
    expect(cloakMode(state)).toBe('none')
    expect(state.voidedBy).toBe('damaged')
  })

  it('voids a Cloaking Device above velocity 24, and only above it', () => {
    expect(CLOAK_MAX_VELOCITY).toBe(24)
    const atLimit = cloakEndOfMovement(order('cloaking-device', 3), { velocity: 24 })
    expect(cloakMode(atLimit)).toBe('partial')

    const overLimit = cloakEndOfMovement(order('cloaking-device', 3), { velocity: 25 })
    expect(cloakMode(overLimit)).toBe('none')
    expect(overLimit.voidedBy).toBe('over-speed')

    expect(cloakVelocityLegal('partial', 25)).toBe(false)
    // 7.21 and 7.22 set no speed limit, and a ship off the table has no
    // measurable speed to catch it at.
    expect(cloakVelocityLegal('total', 40)).toBe(true)
  })

  it('refuses an order for a destroyed cloak or a zero-turn cloak', () => {
    const dead = applyCloakDamage(createCloakState('cloaking-device'))
    expect(() => orderCloak(dead, 2)).toThrow(/destroyed/)
    expect(() => orderCloak(createCloakState('cloaking-device'), 0)).toThrow(/whole number/)
    expect(orderCloak(createCloakState('cloaking-device'), 3).ordered).toBe(3)
  })

  it('forbids everything 7.20 lists while a cloak is up', () => {
    const partial = cloakRestrictions('partial')
    expect(partial).toMatchObject({
      onTable: true,
      mayFireWeapons: false,
      mayLaunchOrRecoverFighters: false,
      mayEnterFtl: false,
      mayReceiveCommunications: false,
      mayRaiseScreens: false,
      areaEcmFunctions: false,
      stealthApplies: false,
      destroyedByCollision: true,
      enemyOrdnanceMayLock: false,
      enemyNeedleBeamsMayTargetSystems: false,
    })
    expect(cloakRestrictions('total').onTable).toBe(false)
    expect(cloakRestrictions('none').mayFireWeapons).toBe(true)
  })
})

describe('cloak mass and points (7.20 – 7.22)', () => {
  it('charges 7.20’s worked example: "a 100 mass ship would pay 50 points"', () => {
    expect(cloakPoints('cloaking-device', 100)).toBe(50)
    expect(cloakMass('cloaking-device', 100)).toBe(1)
  })

  it('charges a Cloaking Field the ship’s mass, and a Tuffley Cloak the same for ten times the mass', () => {
    expect(cloakPoints('cloaking-field', 100)).toBe(100)
    expect(cloakMass('cloaking-field', 100)).toBe(1)
    expect(cloakMass('tuffley-cloak', 100)).toBe(10)
    expect(cloakPoints('tuffley-cloak', 100)).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// 7.23 Nova Cannon
// ---------------------------------------------------------------------------

describe('7.23 Spinal Mount Nova Cannon', () => {
  it('prints the three templates as the book does', () => {
    expect(NOVA_ARMING_DISTANCE_MU).toBe(6)
    expect(NOVA_SWEEPS[1]).toEqual({ fromMu: 6, toMu: 24, diameter: 2, damageDice: 6 })
    expect(NOVA_SWEEPS[2]).toEqual({ fromMu: 24, toMu: 48, diameter: 4, damageDice: 4 })
    expect(NOVA_SWEEPS[3]).toEqual({ fromMu: 48, toMu: 72, diameter: 6, damageDice: 2 })
    // "its total 24 MU move" on the first turn, then 24 and 24 more.
    expect(NOVA_SWEEPS[1].toMu - NOVA_SWEEPS[1].fromMu).toBe(18)
    expect(NOVA_TOTAL_RANGE_MU).toBe(72)
  })

  it('touches everything within the template’s radius of its line of flight', () => {
    const burst = { origin: at(0, 0), course: spinalUp, stage: 1 as const }
    // Dead ahead at 12 MU: hit.
    expect(novaContact(burst, at(0, -12)).contact).toBe(true)
    // 0.9 MU off the line: still inside the 2 MU template.
    expect(novaContact(burst, at(0.9, -12)).contact).toBe(true)
    // 2 MU off: outside it.
    expect(novaContact(burst, at(2, -12)).contact).toBe(false)
    // 3 MU ahead: inside the 6 MU arming distance, so the round has not gone off.
    expect(novaContact(burst, at(0, -3)).contact).toBe(false)
    // Astern: the template goes forwards only.
    expect(novaContact(burst, at(0, 12)).contact).toBe(false)
  })

  it('ages one generation a turn and burns out after the third', () => {
    let state = armNovaCannon(createNovaCannonState())
    expect(state.armed).toBe(true)
    state = fireNovaCannon(state, at(0, 0), spinalUp)
    expect(state.armed).toBe(false)
    expect(state.bursts[0].stage).toBe(1)

    state = advanceNovaBursts(state)
    expect(state.bursts[0].stage).toBe(2)
    state = advanceNovaBursts(state)
    expect(state.bursts[0].stage).toBe(3)
    state = advanceNovaBursts(state)
    expect(state.bursts).toHaveLength(0)
  })

  it('loses its arming if the shot is not taken', () => {
    const armed = armNovaCannon(createNovaCannonState())
    expect(novaArmingLost(armed).armed).toBe(false)
    expect(() => fireNovaCannon(createNovaCannonState(), at(0, 0), spinalUp)).toThrow(/not armed/)
  })

  it('rolls 6D6, then 4D6, then 2D6', () => {
    const first = new ScriptedRng([6, 6, 6, 6, 6, 6])
    expect(rollNovaDamage(1, first).damage).toBe(36)
    expect(first.consumed).toBe(6) // six dice, not a beam volley with re-rolls
    expect(rollNovaDamage(2, new ScriptedRng([1, 2, 3, 4])).damage).toBe(10)
    expect(rollNovaDamage(3, new ScriptedRng([5, 5])).damage).toBe(10)
  })

  it('is penetrating: "neither type of screen nor armor has any effect"', () => {
    const spec = EW_WEAPON_SPECS['nova-cannon']
    expect(spec).toBeDefined()
    if (!spec) return
    const shielded = spec.fire(mount('nova', 'nova-cannon'), {
      ...context(12, { rng: new ScriptedRng([4, 4, 4, 4, 4, 4]) }),
      targetScreens: 2,
    })
    expect(shielded).not.toBeNull()
    expect(shielded?.normalDamage).toBe(0)
    expect(shielded?.penetratingDamage).toBe(24)
    expect(shielded?.mode).toBe('P')
  })

  it('will not fire inside its arming distance, past its reach, or off the centre line', () => {
    const spec = EW_WEAPON_SPECS['nova-cannon']
    if (!spec) throw new Error('nova cannon spec missing')
    const weapon = mount('nova', 'nova-cannon')
    expect(spec.fire(weapon, context(4))).toBeNull()
    expect(spec.fire(weapon, context(25))).toBeNull() // past the stage-1 sweep
    expect(spec.fire(weapon, { ...context(12), arc: 'FS' })).toBeNull()
    expect(spec.maxRange(1, 'standard')).toBe(72)
    expect(spec.requiresFireCon).toBe(false)

    // Stage 2 reaches where stage 1 could not.
    expect(spec.fire(weapon, context(30, { novaStage: 2 }))).not.toBeNull()
  })

  it('costs 20 mass and 60 points', () => {
    expect(EW_COSTS.novaCannon).toEqual({ mass: 20, points: 60 })
  })
})

// ---------------------------------------------------------------------------
// 7.24 Wave Gun
// ---------------------------------------------------------------------------

describe('7.24 Wave Gun', () => {
  it('prints the three bands as the book does', () => {
    expect(WAVE_GUN_RANGE_MU).toBe(36)
    expect(WAVE_GUN_BANDS).toEqual([
      { fromMu: 0, toMu: 12, diameter: 2, damageDice: 4 },
      { fromMu: 12, toMu: 24, diameter: 3, damageDice: 3 },
      { fromMu: 24, toMu: 36, diameter: 4, damageDice: 2 },
    ])
    expect(waveGunBandAt(12)?.damageDice).toBe(4) // a boundary reads to the nearer band
    expect(waveGunBandAt(12.5)?.damageDice).toBe(3)
    expect(waveGunBandAt(36)?.damageDice).toBe(2)
    expect(waveGunBandAt(36.5)).toBeNull()
  })

  it('charges a D6 a turn until the total reaches six or more', () => {
    expect(WAVE_GUN_CHARGE_TARGET).toBe(6)
    const rng = new ScriptedRng([2, 3, 4])
    let state = createWaveGunState()
    let step = chargeWaveGun(state, rng)
    state = step.state
    expect(step.roll).toBe(2)
    expect(step.charged).toBe(false)
    step = chargeWaveGun(state, rng)
    state = step.state
    expect(state.charge).toBe(5)
    expect(isWaveGunCharged(state)).toBe(false)
    step = chargeWaveGun(state, rng)
    state = step.state
    expect(state.charge).toBe(9)
    expect(step.charged).toBe(true)

    // "Firing the Wave Gun totally discharges the capacitors."
    expect(dischargeWaveGun().charge).toBe(0)
  })

  it('hurts its own ship for the charge in the capacitors when it is knocked out', () => {
    expect(waveGunKnockOutDamage({ charge: 5 })).toBe(5)
    expect(waveGunKnockOutDamage({ charge: 0 })).toBe(0)
  })

  it('lets the firing ship manoeuvre, unlike the Nova Cannon', () => {
    expect(WAVE_GUN_FIRING_RESTRICTIONS.mayApplyThrust).toBe(true)
    expect(WAVE_GUN_FIRING_RESTRICTIONS.mayChangeCourse).toBe(true)
    expect(WAVE_GUN_FIRING_RESTRICTIONS.mayFireOtherWeapons).toBe(false)
    expect(WAVE_GUN_FIRING_RESTRICTIONS.screensFunctionForward).toBe(false)
  })

  it('touches only what the expanding template covers', () => {
    const origin = at(0, 0)
    // 30 MU out the template is 4 MU across, so 1.9 MU off the line is a hit
    // and 3 MU off is not.
    expect(waveGunContact(origin, spinalUp, at(1.9, -30)).contact).toBe(true)
    expect(waveGunContact(origin, spinalUp, at(3, -30)).contact).toBe(false)
    // 6 MU out it is only 2 MU across.
    expect(waveGunContact(origin, spinalUp, at(0.9, -6)).contact).toBe(true)
    expect(waveGunContact(origin, spinalUp, at(1.4, -6)).contact).toBe(false)
    // Past 36 MU there is no burst left.
    expect(waveGunContact(origin, spinalUp, at(0, -40)).contact).toBe(false)
    expect(waveGunContact(origin, spinalUp, at(0, -30)).band?.damageDice).toBe(2)
  })

  it('takes -1 per level of Advanced Screens on each damage die, floored at zero', () => {
    const band = WAVE_GUN_BANDS[0]
    expect(rollWaveGunDamage(band, 0, new ScriptedRng([6, 5, 4, 3])).damage).toBe(18)
    expect(rollWaveGunDamage(band, 1, new ScriptedRng([6, 5, 4, 3])).damage).toBe(14)
    expect(rollWaveGunDamage(band, 2, new ScriptedRng([6, 5, 4, 3])).damage).toBe(10)
    // 7.3: "Negative damage is treated as zero".
    expect(rollWaveGunDamage(band, 2, new ScriptedRng([1, 1, 1, 2])).damage).toBe(0)
  })

  it('ignores standard screens and armour when it fires', () => {
    const spec = EW_WEAPON_SPECS['wave-gun']
    if (!spec) throw new Error('wave gun spec missing')
    const weapon = mount('wave', 'wave-gun')
    const result = spec.fire(weapon, {
      ...context(30, { rng: new ScriptedRng([6, 6]) }),
      targetScreens: 2,
    })
    expect(result?.penetratingDamage).toBe(12)
    expect(result?.normalDamage).toBe(0)
    expect(result?.mode).toBe('AP')

    // The same shot against Advanced Screens loses a point a die.
    const advanced = context(30, { rng: new ScriptedRng([6, 6]), advancedScreenLevel: 2 })
    const screened = spec.fire(weapon, advanced)
    expect(screened?.penetratingDamage).toBe(8)

    expect(spec.fire(weapon, context(37))).toBeNull()
    expect(spec.fire(weapon, { ...context(10), arc: 'A' })).toBeNull()
    expect(spec.maxRange(1, 'standard')).toBe(36)
  })

  it('costs 12 mass and 36 points', () => {
    expect(EW_COSTS.waveGun).toEqual({ mass: 12, points: 36 })
  })
})

describe('template geometry (7.23, 7.24)', () => {
  it('measures to the swept segment, so the caps of the sweep count too', () => {
    // A 2 MU template sweeping 6 → 24 MU: a target 5.5 MU out and dead ahead is
    // 0.5 MU from where the template started, so it is touched.
    expect(templateContacts(at(0, 0), spinalUp, 6, 24, 2, at(0, -5.5))).toBe(true)
    expect(templateContacts(at(0, 0), spinalUp, 6, 24, 2, at(0, -4.5))).toBe(false)
    expect(templateContacts(at(0, 0), spinalUp, 6, 24, 2, at(0, -24.5))).toBe(true)
    expect(templateContacts(at(0, 0), spinalUp, 6, 24, 2, at(0, -26))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 7.25 Reflex Field
// ---------------------------------------------------------------------------

describe('7.25 Reflex Field', () => {
  it('reads the D6 table off the page', () => {
    const cases: Array<[number, number, number]> = [
      // face, damage to target, damage reflected at the firing ship
      [1, 7, 0],
      [2, 4, 0], // half of 7, rounded up
      [3, 0, 0],
      [4, 0, 0],
      [5, 0, 4], // half, rounded up, back at the shooter
      [6, 0, 7],
    ]
    for (const [face, toTarget, toAttacker] of cases) {
      const result = rollReflexField(7, new ScriptedRng([face]))
      expect(result.roll).toBe(face)
      expect(result.toTarget).toBe(toTarget)
      expect(result.toAttacker).toBe(toAttacker)
      expect(result.fightersDestroyed).toBe(false)
    }
  })

  it('burns the fighters that scored, on a 5 or 6 against a group', () => {
    for (const face of [5, 6]) {
      const result = rollReflexField(9, new ScriptedRng([face]), { fighterGroup: true })
      expect(result.fightersDestroyed).toBe(true)
      expect(result.toTarget).toBe(0)
      expect(result.toAttacker).toBe(0)
    }
    // 1-4 behave exactly as they do against a ship.
    const absorbed = rollReflexField(9, new ScriptedRng([3]), { fighterGroup: true })
    expect(absorbed.toTarget).toBe(0)
    expect(absorbed.fightersDestroyed).toBe(false)
    const halved = rollReflexField(9, new ScriptedRng([2]), { fighterGroup: true })
    expect(halved.toTarget).toBe(5)
  })

  it('silences the ship carrying it', () => {
    expect(REFLEX_FIELD_RESTRICTIONS).toEqual({
      mayFireWeapons: false,
      mayLaunchOrRecoverFighters: false,
      mayMoveAndManoeuvre: true,
    })
  })

  it('answers energy weapons only', () => {
    for (const energy of ['beam', 'graser', 'phaser', 'gatling', 'pulser', 'gravitic-gun'] as const) {
      expect(isEnergyWeapon(energy)).toBe(true)
    }
    for (const kinetic of [
      'emp',
      'pulse-torpedo',
      'k-gun',
      'mkp',
      'fusion-array',
      'salvo-missile-rack',
      'rocket-pod',
      'plasma-bolt-launcher',
      'nova-cannon',
      'wave-gun',
    ] as const) {
      expect(isEnergyWeapon(kinetic)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Fit legality and bans
// ---------------------------------------------------------------------------

describe('fit legality (7.17 – 7.20)', () => {
  it('will not put a Holofield next to a screen, a field or a cloak', () => {
    expect(validateEwFit({ holofield: true, screenLevel: 1 })[0]).toMatch(/7\.17/)
    expect(validateEwFit({ holofield: true, stealthFieldLevel: 1 })[0]).toMatch(/7\.17/)
    expect(validateEwFit({ holofield: true, areaScreen: true })[0]).toMatch(/7\.17/)
    expect(validateEwFit({ holofield: true, ecmLevel: 3 })).toEqual([])
  })

  it('will not put a cloak next to a screen or a field', () => {
    expect(validateEwFit({ cloak: 'cloaking-device', screenLevel: 2 })[0]).toMatch(/7\.20/)
    expect(validateEwFit({ cloak: 'cloaking-field' })).toEqual([])
  })

  it('caps aggregate ECM at 3', () => {
    expect(validateEwFit({ ecmLevel: 2, areaEcmLevel: 2 })[0]).toMatch(/aggregate ECM/)
    expect(validateEwFit({ ecmLevel: 2, areaEcmLevel: 1 })).toEqual([])
  })
})

describe('bannable systems', () => {
  it('lists every optional system of 7.20 – 7.25', () => {
    expect(BANNABLE_SYSTEMS.map((system) => system.id)).toEqual([
      'cloaking-device',
      'cloaking-field',
      'tuffley-cloak',
      'nova-cannon',
      'wave-gun',
      'reflex-field',
    ])
    for (const system of BANNABLE_SYSTEMS) expect(system.rule).toMatch(/^7\.2[0-5]$/)
  })

  it('bans the campaign three by default, and each one individually', () => {
    expect([...DEFAULT_CAMPAIGN_BANS].sort()).toEqual(
      ['cloaking-field', 'reflex-field', 'wave-gun'].sort(),
    )
    expect(isSystemBanned('wave-gun', DEFAULT_CAMPAIGN_BANS)).toBe(true)
    expect(isSystemBanned('nova-cannon', DEFAULT_CAMPAIGN_BANS)).toBe(false)
    // A group that only bans one of them still gets the other two.
    expect(isSystemBanned('cloaking-field', ['reflex-field'])).toBe(false)
  })
})
