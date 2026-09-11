/**
 * Ordnance (section 6).
 *
 * The rulebook's own worked example — two salvoes against one ship in 6.5 — is
 * the first test in the file and the one that matters most: it pins the lock-on
 * roll, both point-defence tables, overkill and 1D6-per-hit damage in one pass.
 * Everything after it tests one number or one sentence of section 6.
 *
 * Dice come from `ScriptedRng`, an `Rng` whose faces are written out in the
 * test, so a rulebook example can be replayed exactly rather than fished for
 * with seeds.
 */

import { describe, expect, it } from 'vitest'
import { Rng } from './dice'
import type { WeaponClass } from './types'
import {
  ANTIMATTER_BLAST_RADIUS,
  ANTIMATTER_FREE_FLIGHT_RANGE,
  ANTIMATTER_HITS_TO_KILL,
  ANTIMATTER_RANGE,
  MINES_MINIMUM_PER_RACK,
  MINE_ATTACK_DICE,
  MINE_DETECTION_RADIUS,
  MINE_MASS,
  MINE_POINTS,
  MISSILE_ATTACK_RADIUS,
  MISSILE_RANGE_EXTENDED,
  MISSILE_RANGE_STANDARD,
  MULTI_STAGE_MAX_LEG,
  MULTI_STAGE_MIN_LEG,
  MULTI_STAGE_RANGE_BONUS,
  ORDNANCE_MOUNTS,
  ORDNANCE_WEAPON_SPECS,
  PLASMA_BOLT_BLAST_RADIUS,
  PLASMA_BOLT_FIGHTER_RANGE,
  PLASMA_BOLT_PDS_DRM,
  PLASMA_BOLT_RANGE,
  ROCKETS_PER_POD,
  SALVO_SIZE,
  VECTOR_MISSILE_ATTACK_RADIUS,
  acquireMissileTargets,
  antimatterBlastDice,
  attackRadiusFor,
  canEngagePlasmaBolt,
  checkMagazine,
  clearMine,
  d3,
  distanceToPath,
  distanceToSegment,
  drawMagazineLoad,
  fireRocketPod,
  launchMissile,
  launchPlasmaBolt,
  layMines,
  magazineCapacity,
  magazineLoadMass,
  mineIsActive,
  minesTriggeredBy,
  missileLaunchRange,
  missileScreenDrm,
  missileTotalRange,
  moveOrdnanceMarkers,
  multiStageMass,
  multiStagePoints,
  nearestCourse,
  plasmaBoltLauncherLimit,
  plasmaBoltMass,
  plasmaBoltMayFire,
  plasmaScreenDrm,
  relocateMultiStageMarker,
  resolveAntimatterDetonation,
  resolveAntimatterRackExplosion,
  resolveHeavyMissileDamage,
  resolveMineAttack,
  resolveMissilePointDefence,
  resolveOrdnanceAttack,
  resolvePlasmaBoltDefence,
  resolvePlasmaBoltDetonation,
  resolvePlasmaBoltShapedCharge,
  resolveRocketDamage,
  resolveSalvoDamage,
  rocketPodToHit,
  type MineMarker,
  type MissileMarker,
  type OrdnanceScreens,
} from './ordnance'

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

/**
 * An `Rng` that hands back the D6 faces it was given, in order. `d6` reads
 * `floor(next() * 6) + 1`, so a face `f` is delivered as `(f - 0.5) / 6`.
 */
class ScriptedRng extends Rng {
  private faces: readonly number[]
  private index = 0

  constructor(faces: readonly number[]) {
    super(1)
    this.faces = faces
  }

  override next(): number {
    const face = this.faces[this.index]
    if (face === undefined) {
      throw new Error(`scripted RNG ran out of dice after ${this.index} rolls`)
    }
    this.index += 1
    return (face - 0.5) / 6
  }

  /** Dice not yet used — a test that leaves some has mis-modelled the roll. */
  get remaining(): number {
    return this.faces.length - this.index
  }
}

const NO_SCREENS: OrdnanceScreens = { level: 0, advanced: false }
const ADVANCED_1: OrdnanceScreens = { level: 1, advanced: true }
const ADVANCED_2: OrdnanceScreens = { level: 2, advanced: true }
const STANDARD_2: OrdnanceScreens = { level: 2, advanced: false }

/** The 180-degree field 6.6 gives every missile mounting. */
const MISSILE_ARCS = ['FP', 'F', 'FS'] as const

function salvoMarker(overrides: Partial<MissileMarker> = {}): MissileMarker {
  return {
    id: 'salvo-1',
    owner: 'red',
    sourceShipId: 'red-1',
    kind: 'salvo',
    grade: 'standard',
    missiles: SALVO_SIZE,
    position: { x: 0, y: 0 },
    facing: 12,
    launchedTurn: 1,
    rangeFlown: 20,
    endurance: 1,
    stagesRemaining: 0,
    hits: 0,
    targetShipId: null,
    ...overrides,
  }
}

function specOf(weaponClass: WeaponClass) {
  const spec = ORDNANCE_WEAPON_SPECS[weaponClass]
  if (!spec) throw new Error(`${weaponClass} has no ordnance spec`)
  return spec
}

// ---------------------------------------------------------------------------
// 6.5 — the rulebook's worked example
// ---------------------------------------------------------------------------

describe('6.5 worked example: two salvoes against one ship', () => {
  // "The defender chooses to use the PDS alone against one incoming salvo, and
  // the 2 Beam-1 batteries to combine fire against the second salvo."
  it('first salvo: PDS rolls a 6, kills both missiles that locked on', () => {
    // PDS die 6 (kills two, re-rolls — "there is no point" but it is rolled),
    // the re-roll, then the attacker's lock-on of 2.
    const rng = new ScriptedRng([6, 1, 2])
    const result = resolveMissilePointDefence({
      marker: salvoMarker({ id: 'salvo-a' }),
      allocations: [{ sourceId: 'pds-1', mode: 'pds', dice: 1 }],
      rng,
    })
    expect(result.lockOn).toBe(2)
    expect(result.kills).toBe(2)
    expect(result.hits).toBe(0)
    expect(result.destroyed).toBe(true)
    expect(rng.remaining).toBe(0)
  })

  it('second salvo: two Beam-1 dice roll 4 and 6, the re-roll gets a 2 — one kill', () => {
    const rng = new ScriptedRng([4, 6, 2, 5])
    const result = resolveMissilePointDefence({
      marker: salvoMarker({ id: 'salvo-b' }),
      allocations: [{ sourceId: 'beams', mode: 'beam-1', dice: 2 }],
      rng,
    })
    expect(result.dice).toEqual([4, 6, 2, 5])
    expect(result.kills).toBe(1)
    expect(result.lockOn).toBe(5)
    // "The end result is that four missiles of the second salvo get past all
    // the defenses."
    expect(result.hits).toBe(4)
  })

  it('four missiles rolling 3, 1, 3 and 6 do 13 points of SAP damage', () => {
    const rng = new ScriptedRng([3, 1, 3, 6])
    const damage = resolveSalvoDamage(4, NO_SCREENS, rng)
    // "missile hits don't re-roll so this gives a grand total of 13 damage
    // points to the target ship."
    expect(damage.dice).toEqual([3, 1, 3, 6])
    expect(damage.normalDamage).toBe(13)
    expect(damage.penetratingDamage).toBe(0)
    // "If the ship has four boxes of armor, 4 points of damage will be taken on
    // the armor and the remaining 9 on the hull boxes" — SAP would put half
    // rounded up (7) on armour, but only 4 boxes exist. `combat.applyDamage`
    // does that split; what this module owes it is the mode and the total.
    expect(damage.mode).toBe('SAP')
  })

  it('plays end to end on one seeded stream', () => {
    const rng = new ScriptedRng([6, 1, 2, 4, 6, 2, 5, 3, 1, 3, 6])
    const first = resolveMissilePointDefence({
      marker: salvoMarker({ id: 'salvo-a' }),
      allocations: [{ sourceId: 'pds-1', mode: 'pds', dice: 1 }],
      rng,
    })
    const second = resolveMissilePointDefence({
      marker: salvoMarker({ id: 'salvo-b' }),
      allocations: [{ sourceId: 'beams', mode: 'beam-1', dice: 2 }],
      rng,
    })
    const damage = resolveOrdnanceAttack(second.marker, second.hits, NO_SCREENS, rng)
    expect(first.hits).toBe(0)
    expect(second.hits).toBe(4)
    expect(damage?.normalDamage).toBe(13)
    expect(rng.remaining).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 6.3 — launching
// ---------------------------------------------------------------------------

describe('6.3 launching missiles (phase 3)', () => {
  const origin = { position: { x: 0, y: 0 }, facing: 12 as const }
  const request = {
    id: 'm1',
    owner: 'red',
    sourceShipId: 'red-1',
    kind: 'salvo' as const,
    grade: 'standard' as const,
    origin,
    arcs: MISSILE_ARCS,
    aim: { x: 0, y: -24 },
    turn: 1,
    fireConsAvailable: 1,
  }

  it('places the marker up to 24 MU out for a standard missile', () => {
    expect(missileLaunchRange('salvo', 'standard')).toBe(MISSILE_RANGE_STANDARD)
    const result = launchMissile(request)
    expect(result.refusal).toBeNull()
    expect(result.marker?.position).toEqual({ x: 0, y: -24 })
    expect(result.marker?.missiles).toBe(SALVO_SIZE)
    expect(result.fireConsSpent).toBe(1)
  })

  it('refuses an aim point beyond 24 MU', () => {
    const result = launchMissile({ ...request, aim: { x: 0, y: -24.5 } })
    expect(result.refusal).toBe('out-of-range')
    expect(result.marker).toBeNull()
    expect(result.fireConsSpent).toBe(0)
  })

  it('gives extended range missiles 36 MU', () => {
    expect(missileLaunchRange('salvo', 'extended')).toBe(MISSILE_RANGE_EXTENDED)
    const inRange = launchMissile({ ...request, grade: 'extended', aim: { x: 0, y: -36 } })
    const tooFar = launchMissile({ ...request, grade: 'extended', aim: { x: 0, y: -37 } })
    expect(inRange.refusal).toBeNull()
    expect(tooFar.refusal).toBe('out-of-range')
  })

  it('gives an antimatter missile 18 MU', () => {
    expect(missileLaunchRange('antimatter', 'standard')).toBe(ANTIMATTER_RANGE)
    const result = launchMissile({ ...request, kind: 'antimatter', aim: { x: 0, y: -19 } })
    expect(result.refusal).toBe('out-of-range')
  })

  it('refuses an aim point outside the launcher arcs', () => {
    // Dead astern of a ship facing 12: the A arc, which no missile mount covers.
    const result = launchMissile({ ...request, aim: { x: 0, y: 24 } })
    expect(result.refusal).toBe('out-of-arc')
  })

  it('needs an operational FireCon', () => {
    const result = launchMissile({ ...request, fireConsAvailable: 0 })
    expect(result.refusal).toBe('no-firecon')
  })

  it('refuses an obstructed point of aim', () => {
    expect(launchMissile({ ...request, obstructed: true }).refusal).toBe('obstructed')
  })

  it('leaves the marker in place while ships move (phase 5)', () => {
    const launched = launchMissile(request)
    const marker = launched.marker
    expect(marker).not.toBeNull()
    if (!marker) return
    const [moved] = moveOrdnanceMarkers([marker])
    expect(moved.position).toEqual(marker.position)
    expect(moved.rangeFlown).toBe(marker.rangeFlown)
  })
})

// ---------------------------------------------------------------------------
// 6.3 — the seeker
// ---------------------------------------------------------------------------

describe('6.3 seeker: the marker attacks the closest enemy within 6 MU', () => {
  const marker = salvoMarker({ position: { x: 0, y: 0 } })

  it('takes the closest of several enemy ships', () => {
    const result = acquireMissileTargets(
      [marker],
      [
        { id: 'blue-far', owner: 'blue', position: { x: 5, y: 0 } },
        { id: 'blue-near', owner: 'blue', position: { x: 3, y: 0 } },
      ],
    )
    expect(result.acquisitions).toEqual([
      { markerId: 'salvo-1', targetShipId: 'blue-near', range: 3 },
    ])
    // "Move the missile marker next to the target ship."
    expect(result.markers[0].position).toEqual({ x: 3, y: 0 })
  })

  it('ignores friendly ships', () => {
    const result = acquireMissileTargets(
      [marker],
      [{ id: 'red-2', owner: 'red', position: { x: 1, y: 0 } }],
    )
    expect(result.acquisitions).toHaveLength(0)
    expect(result.removed).toHaveLength(1)
  })

  it('removes the marker when nothing is within 6 MU — the launch is wasted', () => {
    const result = acquireMissileTargets(
      [marker],
      [{ id: 'blue-1', owner: 'blue', position: { x: MISSILE_ATTACK_RADIUS + 0.5, y: 0 } }],
    )
    expect(result.markers).toHaveLength(0)
    expect(result.removed[0].id).toBe('salvo-1')
  })

  it('attacks at exactly 6 MU', () => {
    const result = acquireMissileTargets(
      [marker],
      [{ id: 'blue-1', owner: 'blue', position: { x: MISSILE_ATTACK_RADIUS, y: 0 } }],
    )
    expect(result.acquisitions).toHaveLength(1)
  })

  it('uses the optional 3 MU radius against a vector-movement ship', () => {
    const targets = [{ id: 'blue-1', owner: 'blue', position: { x: 4, y: 0 }, vectorMovement: true }]
    expect(acquireMissileTargets([marker], targets).acquisitions).toHaveLength(0)
    const closer = [{ id: 'blue-1', owner: 'blue', position: { x: 3, y: 0 }, vectorMovement: true }]
    expect(acquireMissileTargets([marker], closer).acquisitions).toHaveLength(1)
  })

  it('keeps a two-stage marker in flight when it finds nothing', () => {
    const twoStage = salvoMarker({ endurance: 2, stagesRemaining: 1 })
    const result = acquireMissileTargets([twoStage], [])
    expect(result.removed).toHaveLength(0)
    expect(result.markers[0].endurance).toBe(1)
    // A second empty turn does finish it.
    const again = acquireMissileTargets(result.markers, [])
    expect(again.markers).toHaveLength(0)
    expect(again.removed).toHaveLength(1)
  })

  it('leaves a rocket marker on the ship it was fired at', () => {
    const rocket = salvoMarker({ kind: 'rocket', missiles: 2, targetShipId: 'blue-1' })
    const result = acquireMissileTargets([rocket], [])
    expect(result.markers[0].targetShipId).toBe('blue-1')
    expect(result.removed).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 6.4 — point defence
// ---------------------------------------------------------------------------

describe('6.4 point defence against salvo missiles', () => {
  const defend = (faces: number[], dice: number, mode: 'pds' | 'beam-1' | 'fighter') =>
    resolveMissilePointDefence({
      marker: salvoMarker(),
      allocations: [{ sourceId: 'pd', mode, dice }],
      rng: new ScriptedRng(faces),
    })

  it('PDS kills one on a 4 or a 5', () => {
    expect(defend([4, 1], 1, 'pds').kills).toBe(1)
    expect(defend([5, 1], 1, 'pds').kills).toBe(1)
    expect(defend([3, 1], 1, 'pds').kills).toBe(0)
  })

  it('PDS kills two on a 6 and re-rolls', () => {
    // 6 (two kills) → re-roll 4 (one more) → re-roll ends, then the lock-on.
    expect(defend([6, 4, 1], 1, 'pds').kills).toBe(3)
  })

  it('a Beam-1 or fighter kills one on a 5 or 6, re-rolling the 6', () => {
    expect(defend([5, 1], 1, 'beam-1').kills).toBe(1)
    expect(defend([4, 1], 1, 'beam-1').kills).toBe(0)
    expect(defend([6, 6, 1, 1], 1, 'beam-1').kills).toBe(2)
  })

  it('a K-1 point-defends at −1, so a natural 6 kills one instead of two', () => {
    const result = resolveMissilePointDefence({
      marker: salvoMarker(),
      allocations: [{ sourceId: 'k1', mode: 'pds', dice: 1, drm: -1 }],
      rng: new ScriptedRng([6, 1, 1]),
    })
    // Modified to a 5, so one kill — but the natural 6 still earns the re-roll.
    expect(result.kills).toBe(1)
    expect(result.dice).toEqual([6, 1, 1])
  })

  it('turns the lock-on D6 into missiles on target, capped at the salvo', () => {
    const full = defend([1, 6], 1, 'pds')
    expect(full.lockOn).toBe(6)
    const short = resolveMissilePointDefence({
      marker: salvoMarker({ missiles: 3 }),
      allocations: [],
      rng: new ScriptedRng([6]),
    })
    expect(short.lockOn).toBe(3)
  })

  it('subtracts kills from the lock-on and never lets overkill travel', () => {
    // Two PDS dice roll 6 and 6: four kills against a lock-on of two.
    const result = resolveMissilePointDefence({
      marker: salvoMarker(),
      allocations: [{ sourceId: 'pds', mode: 'pds', dice: 2 }],
      rng: new ScriptedRng([6, 1, 6, 1, 2]),
    })
    expect(result.kills).toBe(4)
    expect(result.hits).toBe(0)
  })

  it('lets at least one missile through when there are no defences at all', () => {
    const result = resolveMissilePointDefence({
      marker: salvoMarker(),
      allocations: [],
      lockOnDrm: -6,
      rng: new ScriptedRng([3]),
    })
    expect(result.lockOn).toBe(0)
    expect(result.hits).toBe(1)
  })

  it('counts kills scored elsewhere — a scattergun or a flak barrage', () => {
    const result = resolveMissilePointDefence({
      marker: salvoMarker(),
      allocations: [],
      preKills: 2,
      rng: new ScriptedRng([5]),
    })
    expect(result.kills).toBe(2)
    expect(result.hits).toBe(3)
  })

  it('subtracts one from a missile fighter salvo per fighter lost before launch', () => {
    const result = resolveMissilePointDefence({
      marker: salvoMarker(),
      allocations: [],
      lockOnDrm: -2,
      rng: new ScriptedRng([5]),
    })
    expect(result.lockOn).toBe(3)
  })
})

describe('6.4 point defence against Heavy Missiles', () => {
  const heavy = salvoMarker({ kind: 'heavy', missiles: 1, id: 'hm-1' })

  it('a PDS kills it on a 5 or 6 and nothing else', () => {
    const kill = resolveMissilePointDefence({
      marker: heavy,
      allocations: [{ sourceId: 'pds', mode: 'pds', dice: 1 }],
      rng: new ScriptedRng([5]),
    })
    expect(kill.destroyed).toBe(true)
    expect(kill.hits).toBe(0)
    expect(kill.lockOn).toBeNull()

    const miss = resolveMissilePointDefence({
      marker: heavy,
      allocations: [{ sourceId: 'pds', mode: 'pds', dice: 1 }],
      rng: new ScriptedRng([4]),
    })
    expect(miss.destroyed).toBe(false)
    expect(miss.hits).toBe(1)
  })

  it('a Beam-1 or fighter needs a 6', () => {
    const five = resolveMissilePointDefence({
      marker: heavy,
      allocations: [{ sourceId: 'b1', mode: 'beam-1', dice: 1 }],
      rng: new ScriptedRng([5]),
    })
    expect(five.destroyed).toBe(false)
    const six = resolveMissilePointDefence({
      marker: heavy,
      allocations: [{ sourceId: 'b1', mode: 'beam-1', dice: 1 }],
      rng: new ScriptedRng([6]),
    })
    expect(six.destroyed).toBe(true)
  })

  it('does not re-roll a 6 against a Heavy Missile', () => {
    const rng = new ScriptedRng([6])
    const result = resolveMissilePointDefence({
      marker: heavy,
      allocations: [{ sourceId: 'pds', mode: 'pds', dice: 1 }],
      rng,
    })
    expect(result.dice).toEqual([6])
    expect(rng.remaining).toBe(0)
  })

  it('takes three hits to disrupt an antimatter warhead', () => {
    const am = salvoMarker({ kind: 'antimatter', missiles: 1, id: 'am-1' })
    const twoHits = resolveMissilePointDefence({
      marker: am,
      allocations: [{ sourceId: 'pds', mode: 'pds', dice: 2 }],
      rng: new ScriptedRng([5, 6]),
    })
    expect(twoHits.marker.hits).toBe(2)
    expect(twoHits.destroyed).toBe(false)

    const third = resolveMissilePointDefence({
      marker: twoHits.marker,
      allocations: [{ sourceId: 'pds', mode: 'pds', dice: 1 }],
      rng: new ScriptedRng([5]),
    })
    expect(third.marker.hits).toBe(ANTIMATTER_HITS_TO_KILL)
    expect(third.destroyed).toBe(true)
  })
})

describe('6.4 fighters flying point defence', () => {
  it('rolls one die per fighter and an extra D6 for each kill', () => {
    // Six fighters: 5, then five blanks — one kill. The extra die is a 6, so a
    // fighter dies with the missile. Then the lock-on.
    const rng = new ScriptedRng([5, 1, 1, 1, 1, 1, 6, 4])
    const result = resolveMissilePointDefence({
      marker: salvoMarker(),
      allocations: [{ sourceId: 'vf-1', mode: 'fighter', dice: 6 }],
      rng,
    })
    expect(result.kills).toBe(1)
    expect(result.fighterLosses).toEqual([{ sourceId: 'vf-1', lost: 1 }])
    expect(result.lockOn).toBe(4)
    expect(result.hits).toBe(3)
    expect(rng.remaining).toBe(0)
  })

  it('loses no fighter when the extra die is not a 6', () => {
    const result = resolveMissilePointDefence({
      marker: salvoMarker(),
      allocations: [{ sourceId: 'vf-1', mode: 'fighter', dice: 1 }],
      rng: new ScriptedRng([5, 5, 4]),
    })
    expect(result.kills).toBe(1)
    expect(result.fighterLosses).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 6.5 — damage
// ---------------------------------------------------------------------------

describe('6.5 missile damage', () => {
  it('rolls 1D6 per salvo missile that hits, SAP, with no re-rolls', () => {
    const rng = new ScriptedRng([6, 6, 6])
    const result = resolveSalvoDamage(3, NO_SCREENS, rng)
    expect(result.normalDamage).toBe(18)
    expect(result.mode).toBe('SAP')
    expect(rng.remaining).toBe(0)
  })

  it('rolls 3D6 for a Heavy Missile', () => {
    const result = resolveHeavyMissileDamage(NO_SCREENS, new ScriptedRng([4, 5, 6]))
    expect(result.dice).toHaveLength(3)
    expect(result.normalDamage).toBe(15)
    expect(result.mode).toBe('SAP')
  })

  it('standard screens have no effect on missiles', () => {
    expect(missileScreenDrm(STANDARD_2)).toBe(0)
    const result = resolveSalvoDamage(3, STANDARD_2, new ScriptedRng([1, 2, 6]))
    expect(result.normalDamage).toBe(9)
  })

  it('advanced level-1 screens subtract 1 from each damage roll', () => {
    expect(missileScreenDrm(ADVANCED_1)).toBe(-1)
    const result = resolveSalvoDamage(3, ADVANCED_1, new ScriptedRng([6, 1, 3]))
    expect(result.normalDamage).toBe(5 + 0 + 2)
  })

  it('advanced level-2 screens subtract 2, and never heal the target', () => {
    expect(missileScreenDrm(ADVANCED_2)).toBe(-2)
    const result = resolveSalvoDamage(3, ADVANCED_2, new ScriptedRng([1, 2, 6]))
    expect(result.normalDamage).toBe(0 + 0 + 4)
  })

  it('blunts a Heavy Missile the same way', () => {
    const result = resolveHeavyMissileDamage(ADVANCED_2, new ScriptedRng([4, 5, 6]))
    expect(result.normalDamage).toBe(2 + 3 + 4)
  })

  it('does nothing when no missile got through', () => {
    expect(resolveOrdnanceAttack(salvoMarker(), 0, NO_SCREENS, new ScriptedRng([]))).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 6.6 — multi-stage missiles
// ---------------------------------------------------------------------------

describe('6.6 multi-stage missiles', () => {
  const origin = { position: { x: 0, y: 0 }, facing: 12 as const }
  const twoStage = {
    id: 'ms-1',
    owner: 'red',
    sourceShipId: 'red-1',
    kind: 'salvo' as const,
    grade: 'standard' as const,
    stages: 2 as const,
    origin,
    arcs: MISSILE_ARCS,
    aim: { x: 0, y: -20 },
    turn: 1,
    fireConsAvailable: 1,
  }

  it('adds 24 MU of range and a turn of duration', () => {
    expect(missileTotalRange('salvo', 'standard', 2)).toBe(MISSILE_RANGE_STANDARD + 24)
    const result = launchMissile(twoStage)
    expect(result.marker?.endurance).toBe(2)
    expect(result.marker?.stagesRemaining).toBe(1)
  })

  it('places the first marker between 16 and 24 MU', () => {
    expect(launchMissile({ ...twoStage, aim: { x: 0, y: -15 } }).refusal).toBe(
      'inside-minimum-range',
    )
    expect(launchMissile({ ...twoStage, aim: { x: 0, y: -MULTI_STAGE_MIN_LEG } }).refusal).toBeNull()
    expect(launchMissile({ ...twoStage, aim: { x: 0, y: -MULTI_STAGE_MAX_LEG } }).refusal).toBeNull()
    expect(launchMissile({ ...twoStage, aim: { x: 0, y: -25 } }).refusal).toBe('out-of-range')
  })

  it('faces the marker at the nearest clock point to its line of flight', () => {
    expect(nearestCourse({ x: 0, y: 0 }, { x: 0, y: -20 })).toBe(12)
    expect(nearestCourse({ x: 0, y: 0 }, { x: 20, y: 0 })).toBe(3)
    expect(launchMissile(twoStage).marker?.facing).toBe(12)
  })

  it('refuses an ER multi-stage missile', () => {
    expect(launchMissile({ ...twoStage, grade: 'extended' }).refusal).toBe(
      'er-cannot-be-multi-stage',
    )
  })

  it('flies the second leg 16–24 MU inside the marker’s 60° front arc', () => {
    const marker = launchMissile(twoStage).marker
    expect(marker).not.toBeNull()
    if (!marker) return

    const ahead = relocateMultiStageMarker(marker, { x: 0, y: -40 })
    expect(ahead.refusal).toBeNull()
    expect(ahead.marker?.rangeFlown).toBe(40)
    expect(ahead.marker?.stagesRemaining).toBe(0)

    expect(relocateMultiStageMarker(marker, { x: 0, y: -30 }).refusal).toBe('inside-minimum-range')
    expect(relocateMultiStageMarker(marker, { x: 0, y: -50 }).refusal).toBe('out-of-range')
    // 20 MU away on a bearing of 60 degrees — the marker's FS arc, not its F.
    expect(relocateMultiStageMarker(marker, { x: 17.32, y: -30 }).refusal).toBe('out-of-arc')
  })

  it('will not fly a leg it has no stage for', () => {
    const single = salvoMarker({ stagesRemaining: 0 })
    expect(relocateMultiStageMarker(single, { x: 0, y: -20 }).refusal).toBe('no-stages-left')
  })
})

// ---------------------------------------------------------------------------
// 6.6 — mountings, magazines and cost
// ---------------------------------------------------------------------------

describe('6.6 mountings and magazines', () => {
  it('carries a standard salvo load in 2 mass and an ER load in 3', () => {
    expect(magazineLoadMass({ grade: 'standard' })).toBe(2)
    expect(magazineLoadMass({ grade: 'extended' })).toBe(3)
    expect(magazineCapacity(8, 'standard')).toBe(4)
    expect(magazineCapacity(8, 'extended')).toBe(2)
  })

  it('packs the rulebook’s mass-8 magazine exactly as the example does', () => {
    // "4 standard salvoes, or 1 standard and 2 ER salvoes."
    const fourStandard = checkMagazine(8, [
      { grade: 'standard' },
      { grade: 'standard' },
      { grade: 'standard' },
      { grade: 'standard' },
    ])
    expect(fourStandard).toMatchObject({ massUsed: 8, wasted: 0, faults: [] })

    const mixed = checkMagazine(8, [
      { grade: 'standard' },
      { grade: 'extended' },
      { grade: 'extended' },
    ])
    expect(mixed).toMatchObject({ massUsed: 8, wasted: 0, faults: [] })

    // "A 2 standard and 1 ER load is also allowed, but wastes 1 space."
    const wasteful = checkMagazine(8, [
      { grade: 'standard' },
      { grade: 'standard' },
      { grade: 'extended' },
    ])
    expect(wasteful).toMatchObject({ massUsed: 7, wasted: 1, faults: [] })
  })

  it('refuses an overfilled magazine', () => {
    const over = checkMagazine(8, Array.from({ length: 5 }, () => ({ grade: 'standard' as const })))
    expect(over.faults).toContain('over-capacity')
  })

  it('refuses a magazine mixing plain and multi-stage loads', () => {
    const mixed = checkMagazine(12, [
      { grade: 'standard' },
      { grade: 'standard', multiStage: true },
    ])
    expect(mixed.faults).toContain('mixed-stages')
    expect(magazineLoadMass({ grade: 'standard', multiStage: true })).toBe(4)
  })

  it('refuses an ER multi-stage load', () => {
    const bad = checkMagazine(10, [{ grade: 'extended', multiStage: true }])
    expect(bad.faults).toContain('er-cannot-be-multi-stage')
  })

  it('only feeds the launchers wired to that magazine', () => {
    const magazine = {
      id: 'mag-1',
      mass: 4,
      loads: [{ grade: 'standard' as const }, { grade: 'standard' as const }],
      launcherIds: ['sml-1'],
    }
    expect(drawMagazineLoad(magazine, 'sml-2').refusal).toBe('not-fed')
    const first = drawMagazineLoad(magazine, 'sml-1')
    expect(first.refusal).toBeNull()
    expect(first.magazine.loads).toHaveLength(1)
    const second = drawMagazineLoad(first.magazine, 'sml-1')
    const empty = drawMagazineLoad(second.magazine, 'sml-1')
    expect(empty.refusal).toBe('no-ammunition')
  })

  it('prices an extra stage at +2 mass and double points', () => {
    expect(multiStageMass(4)).toBe(6)
    expect(multiStagePoints(12)).toBe(24)
  })

  it('records the masses section 6 actually prints, and no others', () => {
    const byKey = (key: string) => ORDNANCE_MOUNTS.find((mount) => mount.key === key)
    expect(byKey('salvo-missile-rack')?.mass).toBe(4)
    expect(byKey('salvo-missile-launcher')?.mass).toBe(3)
    expect(byKey('antimatter-missile')).toMatchObject({ mass: 2, pointsPerMass: 5, arcs: 3 })
    expect(byKey('rocket-pod')).toMatchObject({ mass: 1, points: 3 })
    expect(byKey('mine-rack')?.mass).toBe(2)
    // Numbers the text extract loses in a figure caption are null, not guessed.
    expect(byKey('salvo-missile-rack-er')?.mass).toBeNull()
    expect(byKey('heavy-missile')?.mass).toBeNull()
    // "All missiles have 3 arcs."
    for (const key of ['salvo-missile-rack', 'salvo-missile-launcher', 'antimatter-missile']) {
      expect(byKey(key)?.arcs).toBe(3)
    }
  })
})

// ---------------------------------------------------------------------------
// 6.6 — antimatter missiles
// ---------------------------------------------------------------------------

describe('6.6 antimatter missiles', () => {
  it('throws 3D6 at 1 MU, 2D6 at 2 MU and 1D6 at 3 MU', () => {
    expect(antimatterBlastDice(3, 0)).toBe(3)
    expect(antimatterBlastDice(3, 1)).toBe(3)
    expect(antimatterBlastDice(3, 1.5)).toBe(2)
    expect(antimatterBlastDice(3, 2)).toBe(2)
    expect(antimatterBlastDice(3, 3)).toBe(1)
    expect(antimatterBlastDice(3, 3.1)).toBe(0)
  })

  it('loses a die and a MU of radius for every point-defence hit', () => {
    expect(antimatterBlastDice(2, 1)).toBe(2)
    expect(antimatterBlastDice(2, 2)).toBe(1)
    expect(antimatterBlastDice(2, 2.5)).toBe(0)
    expect(antimatterBlastDice(1, 1)).toBe(1)
    expect(antimatterBlastDice(1, 1.5)).toBe(0)
    expect(antimatterBlastDice(0, 0)).toBe(0)
  })

  it('detonates at full strength, blunted by a die per screen level', () => {
    // Target ship at ground zero (3 dice), a screened ship 2 MU out (2 dice at
    // −1 each), and a missile salvo 3 MU out (1 die, and it is destroyed).
    const rng = new ScriptedRng([6, 5, 4, 6, 1, 2])
    const blast = resolveAntimatterDetonation(
      { x: 0, y: 0 },
      0,
      [
        { id: 'blue-1', position: { x: 0, y: 0 }, kind: 'ship', screens: NO_SCREENS },
        { id: 'blue-2', position: { x: 0, y: 2 }, kind: 'ship', screens: ADVANCED_1 },
        { id: 'salvo-x', position: { x: 0, y: 3 }, kind: 'ordnance', screens: NO_SCREENS },
        { id: 'blue-3', position: { x: 0, y: 4 }, kind: 'ship', screens: NO_SCREENS },
      ],
      rng,
    )
    expect(blast.strength).toBe(3)
    expect(blast.effects).toHaveLength(3)
    expect(blast.effects[0]).toMatchObject({ targetId: 'blue-1', damage: 15 })
    expect(blast.effects[1]).toMatchObject({ targetId: 'blue-2', damage: 5 + 0 })
    expect(blast.effects[2]).toMatchObject({ targetId: 'salvo-x', damage: 2, destroyed: true })
    expect(rng.remaining).toBe(0)
  })

  it('does nothing at all after three hits', () => {
    const blast = resolveAntimatterDetonation(
      { x: 0, y: 0 },
      ANTIMATTER_HITS_TO_KILL,
      [{ id: 'blue-1', position: { x: 0, y: 0 }, kind: 'ship', screens: NO_SCREENS }],
      new ScriptedRng([]),
    )
    expect(blast.strength).toBe(0)
    expect(blast.effects).toHaveLength(0)
  })

  it('explodes on the rack for 1D6, plus 1D6 to anything within 1 MU', () => {
    const rng = new ScriptedRng([5, 3])
    const blast = resolveAntimatterRackExplosion(
      { id: 'red-1', position: { x: 0, y: 0 } },
      [
        { id: 'red-1', position: { x: 0, y: 0 }, kind: 'ship', screens: NO_SCREENS },
        { id: 'red-2', position: { x: 0, y: 1 }, kind: 'ship', screens: NO_SCREENS },
        { id: 'red-3', position: { x: 0, y: 2 }, kind: 'ship', screens: NO_SCREENS },
      ],
      rng,
    )
    // Straight to the hull: "Screens and armor will not protect a ship from its
    // own exploding missiles."
    expect(blast.hullDamage).toBe(5)
    expect(blast.nearby).toHaveLength(1)
    expect(blast.nearby[0]).toMatchObject({ targetId: 'red-2', damage: 3 })
    expect(rng.remaining).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 6.7 — rocket pods
// ---------------------------------------------------------------------------

describe('6.7 rocket pods', () => {
  const origin = { position: { x: 0, y: 0 }, facing: 12 as const }
  const request = {
    id: 'rp-1',
    owner: 'red',
    sourceShipId: 'red-1',
    origin,
    arcs: ['F'] as const,
    target: { id: 'blue-1', position: { x: 0, y: -5 }, facing: 12 as const },
    turn: 1,
  }

  it('hits on 2+ inside 6 MU, 3+ inside 12, 4+ inside 18 and not at all beyond', () => {
    expect(rocketPodToHit(6)).toBe(2)
    expect(rocketPodToHit(6.1)).toBe(3)
    expect(rocketPodToHit(12)).toBe(3)
    expect(rocketPodToHit(12.1)).toBe(4)
    expect(rocketPodToHit(18)).toBe(4)
    expect(rocketPodToHit(18.1)).toBeNull()
  })

  it('fires two rockets and makes a marker of the hits', () => {
    const result = fireRocketPod(request, new ScriptedRng([1, 2]))
    expect(result.rolls).toHaveLength(ROCKETS_PER_POD)
    expect(result.hits).toBe(1)
    expect(result.marker?.missiles).toBe(1)
    expect(result.marker?.targetShipId).toBe('blue-1')
  })

  it('makes no marker when both rockets miss', () => {
    const result = fireRocketPod(
      { ...request, target: { ...request.target, position: { x: 0, y: -15 } } },
      new ScriptedRng([2, 3]),
    )
    expect(result.hits).toBe(0)
    expect(result.marker).toBeNull()
  })

  it('takes a −1 DRM against a gunboat', () => {
    const result = fireRocketPod(
      { ...request, target: { ...request.target, kind: 'gunboat' } },
      new ScriptedRng([2, 3]),
    )
    // Needing 2+, the −1 turns the 2 into a miss and leaves the 3 a hit.
    expect(result.hits).toBe(1)
  })

  it('records the arc the rockets came in through', () => {
    // The target is running away from the launcher, so they arrive astern.
    const result = fireRocketPod(request, new ScriptedRng([6, 6]))
    expect(result.marker?.attackArc).toBe('A')
  })

  it('refuses a target out of range or out of arc', () => {
    expect(
      fireRocketPod(
        { ...request, target: { ...request.target, position: { x: 0, y: -20 } } },
        new ScriptedRng([]),
      ).refusal,
    ).toBe('out-of-range')
    expect(
      fireRocketPod(
        { ...request, target: { ...request.target, position: { x: 0, y: 5 } } },
        new ScriptedRng([]),
      ).refusal,
    ).toBe('out-of-arc')
  })

  it('does 1D3 of SAP damage per rocket', () => {
    const damage = resolveRocketDamage(2, NO_SCREENS, new ScriptedRng([1, 4]))
    expect(damage.normalDamage).toBe(1 + 2)
    expect(damage.mode).toBe('SAP')
    expect(d3(new ScriptedRng([5])).value).toBe(3)
  })

  it('is shot down like a salvo missile, with no lock-on roll', () => {
    const rocket = salvoMarker({ kind: 'rocket', missiles: 2, targetShipId: 'blue-1' })
    const rng = new ScriptedRng([4])
    const result = resolveMissilePointDefence({
      marker: rocket,
      allocations: [{ sourceId: 'pds', mode: 'pds', dice: 1 }],
      rng,
    })
    expect(result.lockOn).toBeNull()
    expect(result.kills).toBe(1)
    expect(result.hits).toBe(1)
    expect(rng.remaining).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 6.8 — plasma bolt launchers
// ---------------------------------------------------------------------------

describe('6.8 plasma bolt launchers', () => {
  it('allows one launcher per 50 mass of ship', () => {
    expect(plasmaBoltLauncherLimit(50)).toBe(1)
    expect(plasmaBoltLauncherLimit(51)).toBe(2)
    expect(plasmaBoltLauncherLimit(100)).toBe(2)
    expect(plasmaBoltLauncherLimit(101)).toBe(3)
    expect(plasmaBoltLauncherLimit(150)).toBe(3)
  })

  it('costs 3 mass per class, plus the class again for each extra arc', () => {
    expect(plasmaBoltMass(1, 1)).toBe(3)
    expect(plasmaBoltMass(1, 3)).toBe(5)
    expect(plasmaBoltMass(2, 1)).toBe(6)
    expect(plasmaBoltMass(2, 3)).toBe(10)
    expect(plasmaBoltMass(6, 1)).toBe(18)
  })

  it('fires only every other turn', () => {
    expect(plasmaBoltMayFire(null, 1)).toBe(true)
    expect(plasmaBoltMayFire(1, 2)).toBe(false)
    expect(plasmaBoltMayFire(1, 3)).toBe(true)
  })

  const request = {
    id: 'pbl-1',
    owner: 'red',
    sourceShipId: 'red-1',
    boltClass: 3,
    origin: { position: { x: 0, y: 0 }, facing: 12 as const },
    arcs: ['F'] as const,
    aim: { x: 0, y: -30 },
    turn: 3,
  }

  it('places the detonation marker out to 30 MU inside the arc', () => {
    expect(PLASMA_BOLT_RANGE).toBe(30)
    const ok = launchPlasmaBolt(request)
    expect(ok.refusal).toBeNull()
    expect(ok.bolt).toMatchObject({ boltClass: 3, strength: 3 })
    expect(launchPlasmaBolt({ ...request, aim: { x: 0, y: -31 } }).refusal).toBe('out-of-range')
    expect(launchPlasmaBolt({ ...request, aim: { x: 0, y: 10 } }).refusal).toBe('out-of-arc')
    expect(launchPlasmaBolt({ ...request, obstructed: true }).refusal).toBe('obstructed')
    expect(launchPlasmaBolt({ ...request, lastFiredTurn: 2 }).refusal).toBe('reloading')
  })

  it('is hit by a PDS only on a natural 6', () => {
    const bolt = { ...request, position: request.aim, strength: 3, launchedTurn: 3 }
    const result = resolvePlasmaBoltDefence(
      bolt,
      [{ sourceId: 'pds', kind: 'pds', dice: 3 }],
      new ScriptedRng([4, 5, 6]),
    )
    expect(result.hits).toBe(1)
    expect(result.bolt.strength).toBe(2)
    expect(result.destroyed).toBe(false)
  })

  it('takes one strength from a scattergun on a 4 or 5 and two on a 6, with no re-roll', () => {
    const bolt = { ...request, position: request.aim, strength: 4, launchedTurn: 3 }
    const rng = new ScriptedRng([4, 6])
    const result = resolvePlasmaBoltDefence(
      bolt,
      [{ sourceId: 'sg', kind: 'scattergun', dice: 2 }],
      rng,
    )
    expect(result.hits).toBe(3)
    expect(result.bolt.strength).toBe(1)
    expect(rng.remaining).toBe(0)
  })

  it('is destroyed by one hit when it is class 1', () => {
    const bolt = { ...request, boltClass: 1, position: request.aim, strength: 1, launchedTurn: 3 }
    const result = resolvePlasmaBoltDefence(
      bolt,
      [{ sourceId: 'pds', kind: 'pds', dice: 1 }],
      new ScriptedRng([6]),
    )
    expect(result.destroyed).toBe(true)
  })

  it('bars class-1 beams from engaging a plasma bolt', () => {
    expect(canEngagePlasmaBolt('beam-1')).toBe(false)
    expect(canEngagePlasmaBolt('pds')).toBe(true)
    expect(canEngagePlasmaBolt('fighter')).toBe(true)
  })

  it('does 1D6 per surviving class to everything within 6 MU, screens at −1 a level', () => {
    const bolt = {
      id: 'pbl-1',
      owner: 'red',
      sourceShipId: 'red-1',
      position: { x: 0, y: 0 },
      boltClass: 3,
      strength: 2,
      launchedTurn: 3,
    }
    const rng = new ScriptedRng([6, 1])
    const blast = resolvePlasmaBoltDetonation(
      bolt,
      [
        { id: 'blue-1', position: { x: 0, y: 3 }, kind: 'ship', screens: STANDARD_2 },
        { id: 'salvo-x', position: { x: 0, y: 5 }, kind: 'ordnance', screens: NO_SCREENS },
        { id: 'blue-2', position: { x: 0, y: 7 }, kind: 'ship', screens: NO_SCREENS },
      ],
      rng,
    )
    expect(blast.effects).toHaveLength(2)
    // Standard screens *do* count against a plasma bolt: 6 − 2 and 1 − 2 → 4.
    expect(blast.effects[0]).toMatchObject({ targetId: 'blue-1', damage: 4 })
    expect(blast.effects[1]).toMatchObject({ targetId: 'salvo-x', destroyed: true, damage: 0 })
    expect(rng.remaining).toBe(0)
  })

  it('turns each die of plasma damage into 1D6 fighter casualties', () => {
    const bolt = {
      id: 'pbl-1',
      owner: 'red',
      sourceShipId: 'red-1',
      position: { x: 0, y: 0 },
      boltClass: 2,
      strength: 2,
      launchedTurn: 3,
    }
    const rng = new ScriptedRng([3, 4])
    const blast = resolvePlasmaBoltDetonation(
      bolt,
      [{ id: 'vf-1', position: { x: 0, y: 2 }, kind: 'fighter-group', screens: NO_SCREENS }],
      rng,
    )
    expect(blast.effects[0]).toMatchObject({ targetId: 'vf-1', damage: 7 })
    expect(rng.remaining).toBe(0)
  })

  it('does nothing once its strength is gone', () => {
    const bolt = {
      id: 'pbl-1',
      owner: 'red',
      sourceShipId: 'red-1',
      position: { x: 0, y: 0 },
      boltClass: 2,
      strength: 0,
      launchedTurn: 3,
    }
    const blast = resolvePlasmaBoltDetonation(
      bolt,
      [{ id: 'blue-1', position: { x: 0, y: 1 }, kind: 'ship', screens: NO_SCREENS }],
      new ScriptedRng([]),
    )
    expect(blast.effects).toHaveLength(0)
  })

  it('does 1D3 per class as a shaped charge, SAP', () => {
    const result = resolvePlasmaBoltShapedCharge(3, true, NO_SCREENS, new ScriptedRng([1, 3, 6]))
    expect(result.normalDamage).toBe(1 + 2 + 3)
    expect(result.mode).toBe('SAP')
    expect(resolvePlasmaBoltShapedCharge(3, false, NO_SCREENS, new ScriptedRng([])).normalDamage).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 6.9, 6.10 — mines
// ---------------------------------------------------------------------------

describe('6.9 mines', () => {
  const mine: MineMarker = {
    id: 'mine-1',
    owner: 'red',
    sourceShipId: 'red-1',
    position: { x: 0, y: 0 },
    laidTurn: 1,
  }

  it('is inert on the turn it is laid and live the turn after', () => {
    expect(mineIsActive(mine, 1)).toBe(false)
    expect(mineIsActive(mine, 2)).toBe(true)
  })

  it('fires at a ship that passes within 3 MU at any point of its move', () => {
    // The ship starts and ends 10 MU away but drives straight over the mine.
    const track = {
      shipId: 'blue-1',
      owner: 'blue',
      path: [
        { x: -10, y: 0 },
        { x: 10, y: 0 },
      ],
    }
    expect(distanceToPath(mine.position, track.path)).toBe(0)
    const triggers = minesTriggeredBy([mine], [track], 2)
    expect(triggers).toEqual([{ mineId: 'mine-1', shipId: 'blue-1', approach: 0 }])
  })

  it('does not fire at a ship that stays outside 3 MU', () => {
    const track = {
      shipId: 'blue-1',
      owner: 'blue',
      path: [
        { x: -10, y: MINE_DETECTION_RADIUS + 1 },
        { x: 10, y: MINE_DETECTION_RADIUS + 1 },
      ],
    }
    expect(minesTriggeredBy([mine], [track], 2)).toHaveLength(0)
  })

  it('ignores its own side and stays asleep until it is active', () => {
    const friendly = {
      shipId: 'red-2',
      owner: 'red',
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }
    expect(minesTriggeredBy([mine], [friendly], 2)).toHaveLength(0)
    const enemy = { ...friendly, shipId: 'blue-1', owner: 'blue' }
    expect(minesTriggeredBy([mine], [enemy], 1)).toHaveLength(0)
  })

  it('fires once, at whichever enemy came closest', () => {
    const near = {
      shipId: 'blue-near',
      owner: 'blue',
      path: [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    }
    const far = {
      shipId: 'blue-far',
      owner: 'blue',
      path: [
        { x: 2.5, y: 0 },
        { x: 2.5, y: 1 },
      ],
    }
    const triggers = minesTriggeredBy([mine], [far, near], 2)
    expect(triggers).toHaveLength(1)
    expect(triggers[0].shipId).toBe('blue-near')
  })

  it('rolls 4D6 as beam fire, re-rolling a natural 6', () => {
    // 4 → 1, 5 → 1, 6 → 2 and a re-roll of 5 → 1 penetrating, 1 → 0.
    const rng = new ScriptedRng([4, 5, 6, 5, 1])
    const result = resolveMineAttack(0, rng)
    expect(MINE_ATTACK_DICE).toBe(4)
    expect(result.normalDamage).toBe(4)
    expect(result.penetratingDamage).toBe(1)
    expect(result.mode).toBe('P')
    expect(rng.remaining).toBe(0)
  })

  it('is reduced by screens like any other beam', () => {
    const screened = resolveMineAttack(2, new ScriptedRng([4, 4, 5, 5]))
    // Level-2 screens: a 4 scores nothing and a 5 scores one.
    expect(screened.normalDamage).toBe(2)
  })

  it('comes off the table once it has gone off', () => {
    expect(clearMine([mine], 'mine-1')).toHaveLength(0)
    expect(clearMine([mine], 'mine-2')).toHaveLength(1)
  })
})

describe('6.10 minelaying (phase 5)', () => {
  const request = {
    id: 'mine-1',
    owner: 'red',
    sourceShipId: 'red-1',
    position: { x: 3, y: 4 },
    turn: 2,
  }

  it('drops one mine per minelayer system, crossing off a load each time', () => {
    const result = layMines(
      [request, { ...request, id: 'mine-2' }, { ...request, id: 'mine-3' }],
      { layers: 2, loads: 5 },
    )
    expect(result.mines).toHaveLength(2)
    expect(result.loadsRemaining).toBe(3)
    expect(result.refused).toBe(1)
    expect(result.mines[0].laidTurn).toBe(2)
  })

  it('drops nothing once the magazine is empty', () => {
    const result = layMines([request], { layers: 2, loads: 0 })
    expect(result.mines).toHaveLength(0)
    expect(result.refused).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// The weapon registry's view (contract.ts)
// ---------------------------------------------------------------------------

describe('ordnance in the weapon registry', () => {
  it('marks every section 6 mount as ordnance, launched in phase 3', () => {
    for (const weaponClass of [
      'heavy-missile',
      'salvo-missile-rack',
      'salvo-missile-launcher',
      'antimatter-missile',
      'rocket-pod',
      'plasma-bolt-launcher',
      'mine-rack',
    ] as const) {
      const spec = specOf(weaponClass)
      expect(spec.ordnance).toBe(true)
      // Nothing in section 6 is fired in phase 11.
      expect(spec.fire({} as never, {} as never)).toBeNull()
    }
  })

  it('needs a FireCon only for the three systems 6.3 names', () => {
    expect(specOf('heavy-missile').requiresFireCon).toBe(true)
    expect(specOf('salvo-missile-rack').requiresFireCon).toBe(true)
    expect(specOf('salvo-missile-launcher').requiresFireCon).toBe(true)
    expect(specOf('rocket-pod').requiresFireCon).toBe(false)
    expect(specOf('plasma-bolt-launcher').requiresFireCon).toBe(false)
    expect(specOf('mine-rack').requiresFireCon).toBe(false)
  })

  it('reports the launch range of each mount', () => {
    expect(specOf('salvo-missile-launcher').maxRange(1, 'standard')).toBe(24)
    expect(specOf('salvo-missile-launcher').maxRange(1, 'extended')).toBe(36)
    expect(specOf('salvo-missile-rack').maxRange(1, 'two-stage')).toBe(48)
    expect(specOf('antimatter-missile').maxRange(1, 'standard')).toBe(18)
    expect(specOf('rocket-pod').maxRange(1, 'standard')).toBe(18)
    expect(specOf('plasma-bolt-launcher').maxRange(1, 'standard')).toBe(30)
    // A minelayer has no launch range: mines go down on the ship's own course.
    expect(specOf('mine-rack').maxRange(1, 'standard')).toBe(0)
  })

  it('calls missiles SAP and a mine penetrating', () => {
    expect(specOf('heavy-missile').damageMode).toBe('SAP')
    expect(specOf('rocket-pod').damageMode).toBe('SAP')
    expect(specOf('mine-rack').damageMode).toBe('P')
  })
})

// ---------------------------------------------------------------------------
// The numbers, straight off the page
// ---------------------------------------------------------------------------

describe('section 6 constants', () => {
  it('keeps the ranges and radii the rulebook prints', () => {
    expect(MISSILE_RANGE_STANDARD).toBe(24)
    expect(MISSILE_RANGE_EXTENDED).toBe(36)
    expect(MISSILE_ATTACK_RADIUS).toBe(6)
    expect(VECTOR_MISSILE_ATTACK_RADIUS).toBe(3)
    expect(MULTI_STAGE_MIN_LEG).toBe(16)
    expect(MULTI_STAGE_MAX_LEG).toBe(24)
    expect(MULTI_STAGE_RANGE_BONUS).toBe(24)
    expect(ANTIMATTER_RANGE).toBe(18)
    expect(ANTIMATTER_BLAST_RADIUS).toBe(3)
    expect(ANTIMATTER_FREE_FLIGHT_RANGE).toBe(3)
    expect(ANTIMATTER_HITS_TO_KILL).toBe(3)
    expect(PLASMA_BOLT_BLAST_RADIUS).toBe(6)
    expect(PLASMA_BOLT_FIGHTER_RANGE).toBe(6)
    expect(PLASMA_BOLT_PDS_DRM).toBe(-2)
    expect(MINE_DETECTION_RADIUS).toBe(3)
    expect(SALVO_SIZE).toBe(6)
    expect(ROCKETS_PER_POD).toBe(2)
  })

  it('prices a mine at 1 mass and 2 points, two to a rack', () => {
    expect(MINE_MASS).toBe(1)
    expect(MINE_POINTS).toBe(2)
    expect(MINES_MINIMUM_PER_RACK).toBe(2)
  })

  it('gives every level of screen a −1 against a plasma bolt, advanced or not', () => {
    expect(plasmaScreenDrm(STANDARD_2)).toBe(-2)
    expect(plasmaScreenDrm(ADVANCED_1)).toBe(-1)
    expect(plasmaScreenDrm(NO_SCREENS)).toBe(0)
  })

  it('hands each target its own attack radius', () => {
    expect(attackRadiusFor({ id: 'a', owner: 'blue', position: { x: 0, y: 0 } })).toBe(6)
    expect(
      attackRadiusFor({ id: 'a', owner: 'blue', position: { x: 0, y: 0 }, vectorMovement: true }),
    ).toBe(3)
  })

  it('measures to a leg of a move, not just to its ends', () => {
    expect(distanceToSegment({ x: 0, y: 0 }, { x: -5, y: 2 }, { x: 5, y: 2 })).toBe(2)
    expect(distanceToSegment({ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 4 })).toBe(5)
    expect(distanceToPath({ x: 0, y: 0 }, [{ x: 3, y: 4 }])).toBe(5)
  })
})
