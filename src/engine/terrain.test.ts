import { describe, expect, it } from 'vitest'

import { Rng, beamDamage, thresholdTarget } from './dice'
import {
  ASTEROID_DAMAGE_POINTS,
  ASTEROID_FIELD_DIAMETER,
  CLOUD_LOCK_ON_MINIMUM,
  CLOUD_SAFE_VELOCITY,
  COLLISION_AUTOMATIC_AVOIDANCE,
  COLLISION_INEVITABLE_ABOVE,
  DEBRIS_CLOUD_DIAMETER,
  DRIVE_ENTRY_DRM,
  GRAVITY_ZONE_STRENGTHS,
  KNOCK_OFF_COURSE_STARBOARD_MAX,
  METEOR_VELOCITY_PER_DIE,
  ORBIT_REENTRY_TOLERANCE,
  ORBIT_SAME_POINT_RANGE,
  ORBIT_TRACK_POINTS,
  PLANETOIDS_BLOCK_FIGHTERS,
  PLANETOID_BASE_DIAMETER,
  SIMPLE_ORBIT_BAND,
  SIMPLE_ORBIT_VELOCITY,
  SOLAR_FLARE_SAFE_SCORE,
  STREAMLINING_ENTRY_DRM,
  SUN_INNER_ZONE_STRENGTH,
  advanceOrbit,
  atmosphericEntryDrm,
  attenuatedScreens,
  blockingBodies,
  canFireFromOrbit,
  canReenterFromOrbit,
  cloudSpeedDamage,
  cloudTargetLock,
  collisionAvoidanceTarget,
  createDebrisCloud,
  createGravityWell,
  debrisCloudDiameter,
  debrisCloudExpired,
  deliberateLanding,
  excessDamage,
  explosionCheck,
  flareSystemKind,
  gravityArc,
  gravityTurnRange,
  gravityZoneAt,
  hasLineOfFire,
  inDebrisCloud,
  innermostZoneOnPath,
  meteorFieldDice,
  movingCollisionRisk,
  moveDebrisCloud,
  nearestOrbitMarker,
  orbitDecayCheck,
  orbitDepartureCourse,
  orbitFacing,
  orbitMarkerPosition,
  orbitMarkersAdjacent,
  orbitReentryDelay,
  orbitReentryPlacementLegal,
  orbitReentryTurn,
  orbitTrackArrival,
  orbitVelocityChange,
  resolveAtmosphericEntry,
  resolveCollision,
  resolveGravityZone,
  resolveKnockedOffCourse,
  resolveMeteorField,
  resolveSolarFlare,
  satelliteFacing,
  shatterAsteroid,
  simpleOrbitApproach,
  stationaryCollisionRisk,
  type OrbitTrack,
  type TerrainBody,
} from './terrain'
import type { Course, Point } from './types'

/**
 * Section 17 and 12.11, checked against their own prose.
 *
 * The numbers worth guarding are the ones a reader assumes they know: that
 * 17.4's meteor die is the damage rather than a beam hit, that 17.2's is a beam
 * hit rather than the damage, that 17.6 has no damage table at all, and that a
 * non-streamlined ship can never survive an atmospheric entry however lucky it
 * gets. Every **[reading]** in `docs/rules/terrain.md` that could have gone the
 * other way is asserted here in the direction the doc argues for.
 */

const SEEDS = Array.from({ length: 200 }, (_, i) => 0x7e11 + i * 977)

function at(x: number, y: number): Point {
  return { x, y }
}

/** JSON snapshot, for the purity assertions. */
function frozen<T>(value: T): string {
  return JSON.stringify(value)
}

// ---------------------------------------------------------------------------

describe('12.11 knocked off course', () => {
  it('rolls at 4.11’s odds: 6+ at the first threshold, 5+ at the second', () => {
    for (const rows of [1, 2, 3, 4, 5]) {
      const result = resolveKnockedOffCourse(12, rows, new Rng(1))
      expect(result.facing.target).toBe(thresholdTarget(rows))
    }
    expect(resolveKnockedOffCourse(12, 1, new Rng(1)).facing.target).toBe(6)
    expect(resolveKnockedOffCourse(12, 2, new Rng(1)).facing.target).toBe(5)
    expect(resolveKnockedOffCourse(12, 3, new Rng(1)).facing.target).toBe(4)
  })

  it('throws the ship to starboard on 1–3 and to port on 4–6, one clock point', () => {
    let starboard = 0
    let port = 0
    for (const seed of SEEDS) {
      const result = resolveKnockedOffCourse(12, 3, new Rng(seed))
      if (!result.facing.knocked) {
        expect(result.facing.directionRoll).toBeNull()
        expect(result.facing.course).toBe(12)
        continue
      }
      const die = result.facing.directionRoll as number
      if (die <= KNOCK_OFF_COURSE_STARBOARD_MAX) {
        expect(result.facing.direction).toBe('starboard')
        // 30 degrees to starboard from course 12 is course 1.
        expect(result.facing.course).toBe(1)
        starboard += 1
      } else {
        expect(result.facing.direction).toBe('port')
        expect(result.facing.course).toBe(11)
        port += 1
      }
    }
    expect(starboard).toBeGreaterThan(0)
    expect(port).toBeGreaterThan(0)
  })

  it('carries 4.11’s extra-row bonus into the roll — [reading] 20', () => {
    // At the first threshold the bare target is 6, so only a natural 6 knocks.
    // Two extra rows put +2 on the die, so a 4 is enough.
    let knockedWithBonus = 0
    let knockedBare = 0
    for (const seed of SEEDS) {
      if (resolveKnockedOffCourse(12, 1, new Rng(seed)).facing.knocked) knockedBare += 1
      if (resolveKnockedOffCourse(12, 1, new Rng(seed), { extraRows: 2 }).facing.knocked) {
        knockedWithBonus += 1
      }
    }
    expect(knockedWithBonus).toBeGreaterThan(knockedBare)
    // Every bare failure is still a failure with the bonus: the bonus only helps.
    for (const seed of SEEDS) {
      const bare = resolveKnockedOffCourse(12, 1, new Rng(seed)).facing
      const bonus = resolveKnockedOffCourse(12, 1, new Rng(seed), { extraRows: 2 }).facing
      expect(bonus.modified).toBe(bare.roll + 2)
      if (bare.knocked) expect(bonus.knocked).toBe(true)
    }
  })

  it('checks the heading only when a vector heading is supplied', () => {
    expect(resolveKnockedOffCourse(12, 3, new Rng(4)).heading).toBeNull()
    const vector = resolveKnockedOffCourse(12, 3, new Rng(4), { heading: 6 })
    expect(vector.heading).not.toBeNull()
    expect([5, 6, 7]).toContain(vector.heading?.course)
  })

  it('wraps the clock rather than running off it', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const fromOne = resolveKnockedOffCourse(1, 5, new Rng(seed)).facing.course
      expect(fromOne).toBeGreaterThanOrEqual(1)
      expect(fromOne).toBeLessThanOrEqual(12)
      const fromTwelve = resolveKnockedOffCourse(12, 5, new Rng(seed)).facing.course
      expect(fromTwelve).toBeGreaterThanOrEqual(1)
      expect(fromTwelve).toBeLessThanOrEqual(12)
    }
  })
})

// ---------------------------------------------------------------------------

describe('17.1 planetoids block lines, not fighters', () => {
  const rock: TerrainBody = { id: 'rock', position: at(10, 0), radius: 3 }

  it('blocks a line that crosses the disc and passes one that clears it', () => {
    expect(hasLineOfFire(at(0, 0), at(20, 0), [rock])).toBe(false)
    expect(hasLineOfFire(at(0, 10), at(20, 10), [rock])).toBe(true)
    expect(blockingBodies(at(0, 0), at(20, 0), [rock]).map((b) => b.id)).toEqual(['rock'])
  })

  it('measures centre point to centre point, so a graze at the radius is clear', () => {
    // The line y = 3 is tangent to a radius-3 disc centred on (10, 0).
    expect(hasLineOfFire(at(0, 3), at(20, 3), [rock])).toBe(true)
    expect(hasLineOfFire(at(0, 2.9), at(20, 2.9), [rock])).toBe(false)
  })

  it('does not extend the block past the ends of the line', () => {
    // Both ships on the near side: the rock is beyond them, not between them.
    expect(hasLineOfFire(at(0, 0), at(4, 0), [rock])).toBe(true)
  })

  it('lets fighters through — the half of the rule that gets dropped', () => {
    expect(PLANETOIDS_BLOCK_FIGHTERS).toBe(false)
  })

  it('carries 17.1’s printed base sizes and damage values', () => {
    expect(PLANETOID_BASE_DIAMETER).toEqual({ min: 1, max: 6 })
    expect(ASTEROID_DAMAGE_POINTS.verySmallChunk).toBe(50)
    expect(ASTEROID_DAMAGE_POINTS.largerChunk).toBe(100)
  })

  it('shatters into 1D6 chunks on clock courses, with no invented speed', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const shatter = shatterAsteroid(new Rng(seed))
      expect(shatter.roll).toBeGreaterThanOrEqual(1)
      expect(shatter.roll).toBeLessThanOrEqual(6)
      expect(shatter.chunks).toHaveLength(shatter.roll)
      for (const chunk of shatter.chunks) {
        expect(chunk.course).toBeGreaterThanOrEqual(1)
        expect(chunk.course).toBeLessThanOrEqual(12)
        expect(Object.keys(chunk)).toEqual(['course'])
      }
    }
  })
})

// ---------------------------------------------------------------------------

describe('17.2 dust and nebula clouds', () => {
  it('is free at the safe velocity and costs a die one point over it', () => {
    expect(CLOUD_SAFE_VELOCITY).toBe(12)
    expect(cloudSpeedDamage(12, new Rng(3)).rolled).toBe(false)
    expect(cloudSpeedDamage(12, new Rng(3)).damage).toBe(0)
    expect(cloudSpeedDamage(13, new Rng(3)).rolled).toBe(true)
  })

  it('reads the die off the 4.5 beam table, not at face value', () => {
    for (const seed of SEEDS) {
      const result = cloudSpeedDamage(13, new Rng(seed))
      expect(result.damage).toBe(beamDamage(result.roll as number, 0))
    }
  })

  it('throws exactly one die and never re-rolls a six — [reading] 2', () => {
    // A penetrating volley could reach 4+ damage off one initial die. The
    // reading says a cloud is the table, not a (P) weapon, so 2 is the ceiling.
    let sixes = 0
    for (const seed of SEEDS) {
      const result = cloudSpeedDamage(20, new Rng(seed))
      expect(result.damage).toBeLessThanOrEqual(2)
      if (result.roll === 6) {
        sixes += 1
        expect(result.damage).toBe(2)
      }
    }
    expect(sixes).toBeGreaterThan(0)
  })

  it('gives standard screens nothing and Advanced Screens their level — [reading] 1', () => {
    for (const seed of SEEDS) {
      const standard = cloudSpeedDamage(13, new Rng(seed), { screens: 2 })
      const advanced = cloudSpeedDamage(13, new Rng(seed), { screens: 2, advancedScreens: true })
      expect(standard.damage).toBe(beamDamage(standard.roll as number, 0))
      expect(advanced.damage).toBe(beamDamage(advanced.roll as number, 2))
    }
    // And the damage is `standard` mode, so armour still answers it.
    expect(cloudSpeedDamage(13, new Rng(1)).mode).toBe('standard')
  })

  it('adds one screen level and caps at two', () => {
    expect(attenuatedScreens(0)).toBe(1)
    expect(attenuatedScreens(1)).toBe(2)
    expect(attenuatedScreens(2)).toBe(2)
  })

  it('fails lock-on on 1–3 and passes on 4–6', () => {
    expect(CLOUD_LOCK_ON_MINIMUM).toBe(4)
    for (const seed of SEEDS) {
      const result = cloudTargetLock(new Rng(seed))
      expect(result.locked).toBe((result.roll as number) >= 4)
    }
  })

  it('attenuates only for beams, grasers and fighters — [reading] 5', () => {
    const plain = cloudTargetLock(new Rng(9), { screens: 1 })
    expect(plain.screens).toBe(1)
    const beam = cloudTargetLock(new Rng(9), { screens: 1, beamOrGraser: true })
    expect(beam.screens).toBe(2)
  })

  it('lets a fighter lock on without a die, and still attenuates it', () => {
    const fighter = cloudTargetLock(new Rng(9), { screens: 0, fighter: true })
    expect(fighter.roll).toBeNull()
    expect(fighter.locked).toBe(true)
    expect(fighter.screens).toBe(1)
  })

  it('rolls one die per nomination, not one per weapon — [reading] 4', () => {
    // Two calls on the same Rng draw two different dice, so the caller that
    // rolls per weapon gets a different answer; the contract is one call.
    const rng = new Rng(0x5151)
    const first = cloudTargetLock(rng)
    const second = cloudTargetLock(rng)
    expect(typeof first.roll).toBe('number')
    expect(typeof second.roll).toBe('number')
  })
})

// ---------------------------------------------------------------------------

describe('17.3 solar flares', () => {
  const systems = [
    { id: 'fc1', kind: 'firecon' as const },
    { id: 'fc2', kind: 'firecon' as const },
    { id: 's1', kind: 'sensor' as const },
  ]

  it('spares a system on 4+, and screens add straight to the score', () => {
    expect(SOLAR_FLARE_SAFE_SCORE).toBe(4)
    for (const seed of SEEDS) {
      const result = resolveSolarFlare(systems, 1, new Rng(seed), { advancedSensorRules: true })
      for (const check of result.checks) {
        expect(check.modified).toBe(check.roll + 1)
        expect(check.knockedOut).toBe(check.modified < 4)
      }
    }
  })

  it('makes a screen-2 ship nearly flare-proof and an unscreened one is not', () => {
    let bare = 0
    let screened = 0
    for (const seed of SEEDS) {
      bare += resolveSolarFlare(systems, 0, new Rng(seed)).knockedOut.length
      screened += resolveSolarFlare(systems, 2, new Rng(seed)).knockedOut.length
    }
    expect(bare).toBeGreaterThan(screened)
    // Screen 2 means 3+ survives, so only a natural 1 or 2 costs a system.
    expect(screened).toBeGreaterThan(0)
  })

  it('rolls for FireCons always and for sensors only under 12.2 — [reading] 6', () => {
    const without = resolveSolarFlare(systems, 0, new Rng(11))
    expect(without.checks.map((c) => c.id)).toEqual(['fc1', 'fc2'])
    const with12 = resolveSolarFlare(systems, 0, new Rng(11), { advancedSensorRules: true })
    expect(with12.checks.map((c) => c.id)).toEqual(['fc1', 'fc2', 's1'])
  })

  it('classifies the SSD system kinds a flare touches, and nothing else', () => {
    expect(flareSystemKind('firecon')).toBe('firecon')
    expect(flareSystemKind('advanced-firecon')).toBe('firecon')
    expect(flareSystemKind('enhanced-sensors')).toBe('sensor')
    expect(flareSystemKind('superior-sensors')).toBe('sensor')
    expect(flareSystemKind('pds')).toBeNull()
    expect(flareSystemKind('screen-generator')).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe('17.4 asteroid fields, meteor swarms and debris', () => {
  it('matches the printed ladder at every band edge', () => {
    expect(METEOR_VELOCITY_PER_DIE).toBe(6)
    expect(meteorFieldDice(0)).toBe(0)
    expect(meteorFieldDice(5)).toBe(0)
    expect(meteorFieldDice(6)).toBe(1)
    expect(meteorFieldDice(11)).toBe(1)
    expect(meteorFieldDice(12)).toBe(2)
    expect(meteorFieldDice(17)).toBe(2)
    expect(meteorFieldDice(18)).toBe(3)
  })

  it('makes the face the damage, not a beam hit', () => {
    for (const seed of SEEDS) {
      const result = resolveMeteorField(12, new Rng(seed))
      expect(result.dice).toHaveLength(2)
      expect(result.penetratingDamage).toBe(result.dice[0] + result.dice[1])
      expect(result.normalDamage).toBe(0)
      expect(result.mode).toBe('P')
    }
    // The number nobody expects: two dice can do twelve points through armour.
    const worst = SEEDS.map((s) => resolveMeteorField(12, new Rng(s)).penetratingDamage)
    expect(Math.max(...worst)).toBeGreaterThan(8)
  })

  it('costs a slow ship nothing at all', () => {
    const result = resolveMeteorField(5, new Rng(2))
    expect(result.dice).toEqual([])
    expect(result.penetratingDamage).toBe(0)
  })

  it('carries the printed field sizes', () => {
    expect(ASTEROID_FIELD_DIAMETER).toEqual({ min: 6, max: 12 })
  })
})

// ---------------------------------------------------------------------------

describe('17.5 battle debris', () => {
  it('reproduces the book’s worked example: 5 damage onto 2 boxes is an excess of 3', () => {
    expect(excessDamage(5, 2)).toBe(3)
    for (const seed of SEEDS) {
      const check = explosionCheck(5, 2, new Rng(seed))
      expect(check.excess).toBe(3)
      expect(check.explodes).toBe((check.roll as number) <= 3)
    }
  })

  it('never explodes a ship killed exactly — [reading] 8', () => {
    const check = explosionCheck(4, 4, new Rng(1))
    expect(check.excess).toBe(0)
    expect(check.roll).toBeNull()
    expect(check.explodes).toBe(false)
    expect(excessDamage(2, 6)).toBe(0)
  })

  it('always explodes on an excess of six, and still records the die', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const check = explosionCheck(10, 4, new Rng(seed))
      expect(check.excess).toBe(6)
      expect(check.explodes).toBe(true)
      expect(typeof check.roll).toBe('number')
    }
  })

  it('sizes the cloud by hull group, with [reading] 7 for the three 17.5 skips', () => {
    expect(DEBRIS_CLOUD_DIAMETER).toEqual({ escort: 2, cruiser: 4, capital: 6 })
    expect(debrisCloudDiameter('escort')).toBe(2)
    expect(debrisCloudDiameter('cruiser')).toBe(4)
    expect(debrisCloudDiameter('capital')).toBe(6)
    expect(debrisCloudDiameter('station')).toBe(6)
    expect(debrisCloudDiameter('monster')).toBe(6)
    expect(debrisCloudDiameter('civilian')).toBe(4)
  })

  it('drifts on the dead ship’s vector and is gone one turn later', () => {
    const cloud = createDebrisCloud({
      id: 'wreck',
      position: at(0, 0),
      course: 3,
      velocity: 8,
      turn: 4,
      group: 'capital',
    })
    expect(cloud.diameter).toBe(6)
    const drifted = moveDebrisCloud(cloud)
    // Course 3 is to the right of the table (geometry.courseVector).
    expect(drifted.position.x).toBeCloseTo(8)
    expect(drifted.position.y).toBeCloseTo(0)
    expect(cloud.position).toEqual(at(0, 0))

    expect(debrisCloudExpired(cloud, 4)).toBe(false)
    expect(debrisCloudExpired(cloud, 5)).toBe(false)
    expect(debrisCloudExpired(cloud, 6)).toBe(true)
  })

  it('catches ships inside the disc, measured on the radius', () => {
    const cloud = createDebrisCloud({
      id: 'w',
      position: at(0, 0),
      course: 12,
      velocity: 0,
      turn: 1,
      group: 'cruiser',
    })
    expect(inDebrisCloud(cloud, at(1.9, 0))).toBe(true)
    expect(inDebrisCloud(cloud, at(2, 0))).toBe(true)
    expect(inDebrisCloud(cloud, at(2.1, 0))).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('17.6 collisions', () => {
  it('reproduces the printed example: thrust 4 at velocity 9 needs a 5', () => {
    expect(collisionAvoidanceTarget(9, 4)).toBe(5)
    for (const seed of SEEDS) {
      const result = resolveCollision(9, 4, new Rng(seed))
      expect(result.target).toBe(5)
      expect(result.avoided).toBe((result.roll as number) >= 5)
      expect(result.destroyed).toBe(!result.avoided)
    }
  })

  it('doubles the engine rating for an Advanced Drive', () => {
    expect(collisionAvoidanceTarget(9, 4, { advancedDrive: true })).toBe(1)
    expect(collisionAvoidanceTarget(14, 4, { advancedDrive: true })).toBe(6)
  })

  it('skips the die at both ends of the ladder', () => {
    expect(COLLISION_AUTOMATIC_AVOIDANCE).toBe(1)
    expect(COLLISION_INEVITABLE_ABOVE).toBe(6)

    const safe = resolveCollision(5, 4, new Rng(1))
    expect(safe.target).toBe(1)
    expect(safe.automatic).toBe(true)
    expect(safe.roll).toBeNull()
    expect(safe.destroyed).toBe(false)

    const doomed = resolveCollision(11, 4, new Rng(1))
    expect(doomed.target).toBe(7)
    expect(doomed.inevitable).toBe(true)
    expect(doomed.roll).toBeNull()
    expect(doomed.destroyed).toBe(true)

    // 6 is still rollable — only *above* 6 is inevitable.
    expect(resolveCollision(10, 4, new Rng(1)).inevitable).toBe(false)
  })

  it('destroys outright: there is no damage table for hitting rock', () => {
    const result = resolveCollision(12, 0, new Rng(1))
    expect(Object.keys(result)).not.toContain('damage')
    expect(result.destroyed).toBe(true)
  })

  it('tests the ship’s whole two-leg path against a stationary body — [reading] 9', () => {
    const rock: TerrainBody = { id: 'r', position: at(6, -4), radius: 2 }
    // Straight from (0,0) to (12,0): the rock is 4 MU off, clear.
    expect(stationaryCollisionRisk([at(0, 0), at(12, 0)], rock)).toBe(false)
    // A 3.4 turn that dog-legs through the rock's neighbourhood is not.
    expect(stationaryCollisionRisk([at(0, 0), at(6, -5), at(12, 0)], rock)).toBe(true)
  })

  it('sweeps a moving asteroid over ships where they stood, not along their tracks', () => {
    const path = [at(0, 0), at(20, 0)]
    // Sitting on the asteroid's track before it moves: caught.
    expect(movingCollisionRisk(path, 2, at(10, 1), at(10, 40))).toBe(true)
    // Parking inside the asteroid's final position: caught.
    expect(movingCollisionRisk(path, 2, at(0, 50), at(21, 0))).toBe(true)
    // Paths that merely cross, with the ship elsewhere at both ends: clear.
    expect(movingCollisionRisk(path, 2, at(10, 40), at(10, -40))).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('17.7 the orbital table', () => {
  it('holds a ship away for 5, 4 or 3 turns by thrust', () => {
    expect(orbitReentryDelay(0)).toBe(5)
    expect(orbitReentryDelay(1)).toBe(5)
    expect(orbitReentryDelay(2)).toBe(4)
    expect(orbitReentryDelay(4)).toBe(4)
    expect(orbitReentryDelay(5)).toBe(3)
    expect(orbitReentryDelay(10)).toBe(3)
  })

  it('counts the delay from the turn of exit — [reading] 11', () => {
    expect(orbitReentryTurn(3, 0)).toBe(8)
    expect(canReenterFromOrbit(3, 0, 7)).toBe(false)
    expect(canReenterFromOrbit(3, 0, 8)).toBe(true)
    expect(canReenterFromOrbit(3, 6, 6)).toBe(true)
  })

  it('allows 6 MU of slop on the corner distance', () => {
    expect(ORBIT_REENTRY_TOLERANCE).toBe(6)
    expect(orbitReentryPlacementLegal(20, 26)).toBe(true)
    expect(orbitReentryPlacementLegal(20, 14)).toBe(true)
    expect(orbitReentryPlacementLegal(20, 26.5)).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('17.8 medium scale orbits', () => {
  const track: OrbitTrack = {
    center: at(0, 0),
    radius: 10,
    orbitalVelocity: 6,
    orbitSpeed: 2,
  }

  it('lays twelve markers on the planet’s edge, on the clock face', () => {
    expect(ORBIT_TRACK_POINTS).toBe(12)
    const twelve = orbitMarkerPosition(track, 12)
    expect(twelve.x).toBeCloseTo(0)
    expect(twelve.y).toBeCloseTo(-10)
    const three = orbitMarkerPosition(track, 3)
    expect(three.x).toBeCloseTo(10)
    expect(three.y).toBeCloseTo(0)
  })

  it('places an arriving ship at the nearest marker', () => {
    expect(nearestOrbitMarker(track, at(0.5, -20))).toBe(12)
    expect(nearestOrbitMarker(track, at(30, 1))).toBe(3)
    expect(nearestOrbitMarker(track, at(-30, 0))).toBe(9)
  })

  it('moves the orbit speed in clock points, wrapping the face', () => {
    expect(advanceOrbit(11, 2)).toBe(1)
    expect(advanceOrbit(1, -2)).toBe(11)
    expect(advanceOrbit(6, 0)).toBe(6)
  })

  it('faces the exact tangent, three points round — [reading] 13', () => {
    expect(orbitFacing(12, 2)).toBe(3)
    expect(orbitFacing(12, -2)).toBe(9)
    expect(orbitFacing(11, 1)).toBe(2)
    // Leaving orbit uses the same tangent it was already flying.
    expect(orbitDepartureCourse(12, 2)).toBe(orbitFacing(12, 2))
  })

  it('points a satellite outward instead, whatever the orbit speed', () => {
    expect(satelliteFacing(4)).toBe(4)
    expect(satelliteFacing(9)).toBe(9)
  })

  it('knows which markers are immediately in front and behind', () => {
    expect(orbitMarkersAdjacent(12, 1)).toBe(true)
    expect(orbitMarkersAdjacent(12, 11)).toBe(true)
    expect(orbitMarkersAdjacent(1, 12)).toBe(true)
    expect(orbitMarkersAdjacent(12, 2)).toBe(false)
    expect(orbitMarkersAdjacent(12, 12)).toBe(false)
  })

  it('lets an orbiting ship shoot outward freely and along the track barely', () => {
    expect(canFireFromOrbit(12, { inOrbit: false })).toBe(true)
    expect(canFireFromOrbit(12, { inOrbit: true, marker: 1 })).toBe(true)
    expect(canFireFromOrbit(12, { inOrbit: true, marker: 11 })).toBe(true)
    expect(canFireFromOrbit(12, { inOrbit: true, marker: 12 })).toBe(true)
    expect(canFireFromOrbit(12, { inOrbit: true, marker: 3 })).toBe(false)
    expect(ORBIT_SAME_POINT_RANGE).toBe(1)
  })

  it('is unforgiving upward and survivable downward on arrival', () => {
    expect(orbitTrackArrival(6, track)).toBe('in-orbit')
    expect(orbitTrackArrival(5, track)).toBe('decaying')
    expect(orbitTrackArrival(7, track)).toBe('uncontrolled-entry')
  })

  it('drops a decelerating ship out of orbit and releases an accelerating one', () => {
    expect(orbitVelocityChange(6, track)).toBe('in-orbit')
    expect(orbitVelocityChange(5, track)).toBe('decaying')
    expect(orbitVelocityChange(7, track)).toBe('leaves-orbit')
  })

  it('makes a second threshold check at the row’s own odds', () => {
    for (const rows of [1, 2, 3]) {
      const check = orbitDecayCheck(rows, new Rng(7))
      expect(check.target).toBe(thresholdTarget(rows))
      expect(check.decayed).toBe(check.modified >= check.target)
    }
  })
})

// ---------------------------------------------------------------------------

describe('17.9 large scale gravity zones', () => {
  const planet = createGravityWell(at(0, 0), 2, { zoneWidth: 1 })

  it('builds three zones of 1, 2 and 4, outermost first', () => {
    expect(GRAVITY_ZONE_STRENGTHS).toEqual([1, 2, 4])
    expect(planet.zones.map((z) => z.strength)).toEqual([1, 2, 4])
    expect(planet.zones.map((z) => z.radius)).toEqual([5, 4, 3])
  })

  it('gives a sun an extra inner zone of 8', () => {
    const sun = createGravityWell(at(0, 0), 2, { sun: true, zoneWidth: 1 })
    expect(SUN_INNER_ZONE_STRENGTH).toBe(8)
    expect(sun.zones.map((z) => z.strength)).toEqual([1, 2, 4, 8])
    expect(sun.zones.map((z) => z.radius)).toEqual([6, 5, 4, 3])
  })

  it('reports the innermost zone at a point, and nothing outside the well', () => {
    expect(gravityZoneAt(planet, at(4.5, 0))?.strength).toBe(1)
    expect(gravityZoneAt(planet, at(3.5, 0))?.strength).toBe(2)
    expect(gravityZoneAt(planet, at(2.5, 0))?.strength).toBe(4)
    expect(gravityZoneAt(planet, at(6, 0))).toBeNull()
  })

  it('pauses the ship in the innermost zone its path reaches, not the one it ends in', () => {
    // Skimming through the middle zone and out again the far side.
    const path = [at(-8, 3.5), at(8, 3.5)]
    expect(innermostZoneOnPath(planet, path)?.strength).toBe(2)
    // The same move judged only by its endpoint would find nothing at all.
    expect(gravityZoneAt(planet, at(8, 3.5))).toBeNull()
  })

  it('maps 17.9’s three cases onto the six arcs of 4.2 — [reading] 14', () => {
    expect(gravityArc(at(0, 0), 12, at(0, -10))).toBe('fore')
    expect(gravityArc(at(0, 0), 12, at(0, 10))).toBe('aft')
    expect(gravityArc(at(0, 0), 12, at(10, 0))).toBe('starboard')
    expect(gravityArc(at(0, 0), 12, at(-10, 0))).toBe('port')
  })

  it('adds the strength ahead, subtracts it astern and halves it abeam', () => {
    // Course 12 is "up the table", i.e. −y: a ship below the planet is diving
    // at it, and one above it is running away.
    const fore = resolveGravityZone({ position: at(0, 3.5), facing: 12, velocity: 20 }, planet)
    expect(fore.arc).toBe('fore')
    expect(fore.velocityChange).toBe(2)
    expect(fore.velocity).toBe(22)
    expect(fore.turnPoints).toBe(0)

    const aft = resolveGravityZone({ position: at(0, -3.5), facing: 12, velocity: 20 }, planet)
    expect(aft.arc).toBe('aft')
    expect(aft.velocityChange).toBe(-2)
    expect(aft.velocity).toBe(18)

    const abeam = resolveGravityZone({ position: at(-3.5, 0), facing: 12, velocity: 20 }, planet)
    expect(abeam.arc).toBe('starboard')
    expect(abeam.velocityChange).toBe(1)
    expect(abeam.turnPoints).toBe(2)
    expect(abeam.facing).toBe(2)
  })

  it('rounds half the strength down, so the outer zone adds no speed — [reading] 15', () => {
    const outer = resolveGravityZone({ position: at(-4.5, 0), facing: 12, velocity: 20 }, planet)
    expect(outer.zone?.strength).toBe(1)
    expect(outer.velocityChange).toBe(0)
    expect(outer.turnPoints).toBe(1)
  })

  it('turns towards the centre, never away', () => {
    const toPort = resolveGravityZone({ position: at(3.5, 0), facing: 12, velocity: 10 }, planet)
    expect(toPort.arc).toBe('port')
    expect(toPort.turnPoints).toBe(-2)
    expect(toPort.facing).toBe(10)
  })

  it('will not drive velocity below zero — [reading] 22', () => {
    const sun = createGravityWell(at(0, 0), 2, { sun: true, zoneWidth: 1 })
    const braked = resolveGravityZone({ position: at(0, -2.5), facing: 12, velocity: 3 }, sun)
    expect(braked.zone?.strength).toBe(8)
    expect(braked.velocityChange).toBe(-8)
    expect(braked.velocity).toBe(0)
  })

  it('reproduces the figure-37 thrust range: base 2, thrust 4, "up to 4 or down to none" — [reading] 16', () => {
    expect(gravityTurnRange(2, 4)).toEqual({ min: 0, max: 4 })
    expect(gravityTurnRange(2, 0)).toEqual({ min: 2, max: 2 })
    expect(gravityTurnRange(2, 1)).toEqual({ min: 1, max: 2 })
    expect(gravityTurnRange(8, 4)).toEqual({ min: 4, max: 8 })
  })

  it('spends thrust on the difference and clamps a greedy request', () => {
    const ship = { position: at(-3.5, 0), facing: 12 as Course, velocity: 20 }
    const cancelled = resolveGravityZone(ship, planet, { turnPoints: 0, unusedThrust: 4 })
    expect(cancelled.turnPoints).toBe(0)
    expect(cancelled.thrustSpent).toBe(2)
    expect(cancelled.facing).toBe(12)

    const greedy = resolveGravityZone(ship, planet, { turnPoints: 6, unusedThrust: 4 })
    expect(greedy.turnPoints).toBe(4)
    expect(greedy.thrustSpent).toBe(2)

    const noThrust = resolveGravityZone(ship, planet, { turnPoints: 0, unusedThrust: 0 })
    expect(noThrust.turnPoints).toBe(2)
    expect(noThrust.thrustSpent).toBe(0)
  })

  it('shields the partial orbit from collisions and from a second zone', () => {
    const inZone = resolveGravityZone({ position: at(0, -2.5), facing: 12, velocity: 10 }, planet)
    expect(inZone.shielded).toBe(true)
    const clear = resolveGravityZone({ position: at(0, -50), facing: 12, velocity: 10 }, planet)
    expect(clear.shielded).toBe(false)
    expect(clear.zone).toBeNull()
    expect(clear.velocity).toBe(10)
  })

  it('defers the change to the next turn when the ship stops in a zone', () => {
    const ship = { position: at(0, -3.5), facing: 12 as Course, velocity: 20 }
    expect(resolveGravityZone(ship, planet).timing).toBe('now')
    expect(resolveGravityZone(ship, planet, { endsInZone: true }).timing).toBe('next-turn')
  })
})

// ---------------------------------------------------------------------------

describe('17.10 the super simple way', () => {
  it('takes the band edges inclusively', () => {
    expect(SIMPLE_ORBIT_BAND).toEqual({ inner: 2, outer: 3 })
    expect(simpleOrbitApproach(7, 2)).toBe('orbit')
    expect(simpleOrbitApproach(7, 3)).toBe('orbit')
    expect(simpleOrbitApproach(7, 2.5)).toBe('orbit')
    expect(simpleOrbitApproach(7, 1.99)).toBe('destroyed')
    expect(simpleOrbitApproach(7, 3.01)).toBe('flies-past')
  })

  it('needs velocity 6 to 8 — [reading] 17', () => {
    expect(SIMPLE_ORBIT_VELOCITY).toEqual({ min: 6, max: 8 })
    expect(simpleOrbitApproach(6, 2.5)).toBe('orbit')
    expect(simpleOrbitApproach(8, 2.5)).toBe('orbit')
    expect(simpleOrbitApproach(5, 2.5)).toBe('flies-past')
    expect(simpleOrbitApproach(9, 2.5)).toBe('flies-past')
  })

  it('kills anything inside the well whatever its speed — [reading] 19', () => {
    expect(simpleOrbitApproach(1, 1)).toBe('destroyed')
    expect(simpleOrbitApproach(20, 1)).toBe('destroyed')
    // But the wrong speed in the safe band only means no orbit.
    expect(simpleOrbitApproach(20, 2.5)).toBe('flies-past')
  })
})

// ---------------------------------------------------------------------------

describe('17.11 atmospheric entry', () => {
  it('carries the printed modifiers', () => {
    expect(STREAMLINING_ENTRY_DRM).toEqual({ none: 4, partial: 0, full: -2 })
    expect(DRIVE_ENTRY_DRM).toEqual({ intact: 0, damaged: 1, 'knocked-out': 3 })
  })

  it('counts only the velocity in excess of the orbital velocity', () => {
    expect(atmosphericEntryDrm({ streamlining: 'full', velocity: 6, orbitalVelocity: 6 })).toBe(-2)
    expect(atmosphericEntryDrm({ streamlining: 'full', velocity: 9, orbitalVelocity: 6 })).toBe(1)
    // Arriving slow costs nothing extra: the slow arrival is why it is here.
    expect(atmosphericEntryDrm({ streamlining: 'full', velocity: 2, orbitalVelocity: 6 })).toBe(-2)
    expect(
      atmosphericEntryDrm({ streamlining: 'none', velocity: 8, orbitalVelocity: 6, drive: 'knocked-out' }),
    ).toBe(9)
  })

  it('reads 2-or-less, 3-to-5 and 6-plus off the results table', () => {
    for (const seed of SEEDS) {
      const result = resolveAtmosphericEntry({ streamlining: 'full' }, new Rng(seed))
      expect(result.drm).toBe(-2)
      expect(result.modified).toBe(result.roll - 2)
      const expected =
        result.modified <= 2 ? 'crash-lands' : result.modified <= 5 ? 'burns-up-crew-escape' : 'burns-up'
      expect(result.outcome).toBe(expected)
    }
  })

  it('never lets an unstreamlined hull crash-land — the arithmetic forbids it', () => {
    const outcomes = new Set(
      SEEDS.map((s) => resolveAtmosphericEntry({ streamlining: 'none' }, new Rng(s)).outcome),
    )
    // +4 on a D6 is 5 to 10: crash-landing needs 2 or less and is unreachable.
    expect(outcomes.has('crash-lands')).toBe(false)
    expect(outcomes.has('burns-up-crew-escape')).toBe(true)
    expect(outcomes.has('burns-up')).toBe(true)
  })

  it('still kills a fully streamlined ship two points over orbital velocity more often than not', () => {
    const burned = SEEDS.filter(
      (s) =>
        resolveAtmosphericEntry(
          { streamlining: 'full', velocity: 8, orbitalVelocity: 6 },
          new Rng(s),
        ).outcome !== 'crash-lands',
    ).length
    expect(burned).toBeGreaterThan(SEEDS.length / 3)
  })

  it('lands a fully streamlined ship on any thrust at all, and a partial one on gravity', () => {
    expect(
      deliberateLanding({ streamlining: 'full', thrust: 1, belowOrbitalVelocity: true }).outcome,
    ).toBe('lands')
    expect(
      deliberateLanding({ streamlining: 'full', thrust: 0, belowOrbitalVelocity: true }).outcome,
    ).toBe('crash-landing')
    expect(
      deliberateLanding({
        streamlining: 'partial',
        thrust: 2,
        gravityG: 2,
        belowOrbitalVelocity: true,
      }).outcome,
    ).toBe('lands')
    expect(
      deliberateLanding({
        streamlining: 'partial',
        thrust: 1,
        gravityG: 2,
        belowOrbitalVelocity: true,
      }).outcome,
    ).toBe('crash-landing')
  })

  it('sends an unstreamlined or still-fast ship to the uncontrolled table', () => {
    expect(
      deliberateLanding({ streamlining: 'none', thrust: 6, belowOrbitalVelocity: true }).outcome,
    ).toBe('uncontrolled-entry')
    expect(
      deliberateLanding({ streamlining: 'full', thrust: 6, belowOrbitalVelocity: false }).outcome,
    ).toBe('uncontrolled-entry')
  })
})

// ---------------------------------------------------------------------------

describe('purity', () => {
  it('never mutates what it is handed', () => {
    const ship = { position: at(0, -3.5), facing: 12 as Course, velocity: 20 }
    const well = createGravityWell(at(0, 0), 2, { zoneWidth: 1 })
    const cloud = createDebrisCloud({
      id: 'c',
      position: at(1, 2),
      course: 3,
      velocity: 4,
      turn: 1,
      group: 'escort',
    })
    const bodies: TerrainBody[] = [{ id: 'r', position: at(5, 0), radius: 2 }]
    const path = [at(0, 0), at(10, 0)]

    const before = frozen({ ship, well, cloud, bodies, path })
    resolveGravityZone(ship, well, { path, turnPoints: 0, unusedThrust: 4, endsInZone: true })
    moveDebrisCloud(cloud)
    blockingBodies(at(0, 0), at(10, 0), bodies)
    stationaryCollisionRisk(path, bodies[0])
    movingCollisionRisk(path, 2, at(0, 0), at(10, 0))
    resolveMeteorField(18, new Rng(1))
    resolveKnockedOffCourse(12, 3, new Rng(1), { heading: 6 })
    resolveSolarFlare([{ id: 'fc', kind: 'firecon' }], 1, new Rng(1))
    expect(frozen({ ship, well, cloud, bodies, path })).toBe(before)
  })

  it('replays identically from the same seed', () => {
    const once = resolveMeteorField(18, new Rng(0xbeef))
    const twice = resolveMeteorField(18, new Rng(0xbeef))
    expect(once).toEqual(twice)

    const flareA = resolveSolarFlare(
      [
        { id: 'a', kind: 'firecon' },
        { id: 'b', kind: 'sensor' },
      ],
      1,
      new Rng(0xbeef),
      { advancedSensorRules: true },
    )
    const flareB = resolveSolarFlare(
      [
        { id: 'a', kind: 'firecon' },
        { id: 'b', kind: 'sensor' },
      ],
      1,
      new Rng(0xbeef),
      { advancedSensorRules: true },
    )
    expect(flareA).toEqual(flareB)
  })
})
