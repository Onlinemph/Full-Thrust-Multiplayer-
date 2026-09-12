/**
 * Full Thrust: Project Continuum — terrain effects (17.1 – 17.11) and 12.11
 * "Knocked off course".
 *
 * Section 17 opens by admitting what it is: *"The following suggestions are
 * mostly pure space opera"*. It is written to a games master, not to a
 * program, and it names a great many quantities without saying how to measure
 * them. Everything measurable is here; everything else is listed under "Not
 * implemented, and why" in `docs/rules/terrain.md`, which is also where all
 * twenty-two readings are argued out. The code comments name them by number.
 *
 * Three things in this module will surprise a reader who knows the game:
 *
 *  - **A meteor swarm does not use the beam table.** 17.4 says the die's
 *    *"actual score rolled equaling the (penetrating) damage sustained"*, so a
 *    5 is five points straight into the hull. A cruiser crossing a swarm at
 *    velocity 12 throws 2D6 of penetrating damage for nothing.
 *  - **A dust cloud does.** 17.2's damage is *"as for beam weapons fire"* —
 *    one die on the 4.5 table, and standard screens do not help.
 *  - **Rock always wins.** 17.6 has no damage table: *"When any ship,
 *    regardless of its class, hits an asteroid, the ship is completely
 *    destroyed."* 16.7's ramming arithmetic does not apply, because a billion
 *    tons of rock has no hull boxes to multiply.
 *
 * Damage is *reported*, never applied, and no argument is ever mutated —
 * `gunboats.ts`'s contract, for the same reason: a battle has to replay from
 * its seed exactly.
 *
 * Section 17 is set in two columns and the extractor that produced
 * `continuum-rulebook-part2.txt` walked them interleaved. Every quotation
 * below is the reconstructed column; `docs/rules/terrain.md` shows the raw
 * interleave and defends the reconstruction.
 */

import {
  beamDamage,
  d6,
  rollD6,
  thresholdTarget,
  type Rng,
  type ScreenLevel,
} from './dice'
import { arcTo, distance, moveShip } from './geometry'
import type {
  Arc,
  Course,
  DamageMode,
  Point,
  ShipGroup,
  Streamlining,
  SystemKind,
} from './types'

const EPSILON = 1e-9

// ---------------------------------------------------------------------------
// Shared shapes and measurement
// ---------------------------------------------------------------------------

/**
 * Anything on the table with a position and a size (17.1, 17.4, 17.6).
 *
 * A radius is the only shape section 17 ever measures against: *"any line
 * between two ships that crosses any part of the asteroid is blocked"* for a
 * sphere, and for an irregular model *"a line between two ships is then
 * blocked if it crosses any part of the asteroid's base"* — a base is a disc.
 */
export interface TerrainBody {
  id: string
  position: Point
  /** Radius in MU. A base *"1 to 6 MU across"* is a radius of 0.5 to 3 (17.1). */
  radius: number
}

/** Shortest distance from a point to a line segment, in MU (2.1). */
function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared < EPSILON) return distance(point, a)
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared),
  )
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy })
}

/**
 * Shortest distance from a point to a whole movement path.
 *
 * A path is a polyline because 3.4 moves a turning ship in two legs — *"half
 * the distance on the old course, then the turn, then the rest on the new
 * one"* — and 17.6 tests *"its path during the Ship Movement Phase"*, which is
 * the track and not the chord. **[reading] 9.**
 */
function distanceToPath(point: Point, path: readonly Point[]): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY
  if (path.length === 1) return distance(point, path[0])
  let best = Number.POSITIVE_INFINITY
  for (let i = 1; i < path.length; i++) {
    best = Math.min(best, distanceToSegment(point, path[i - 1], path[i]))
  }
  return best
}

/**
 * How close a flown path came to a point.
 *
 * The path is a sequence of legs, so the answer is the nearest point on a
 * segment rather than the nearest waypoint: a ship that passes a rock in the
 * middle of a 12 MU run passed it, whatever the endpoints say.
 */
export function closestApproach(path: readonly Point[], point: Point): number {
  return distanceToPath(point, path)
}

/** Normalise any integer onto the twelve-point clock face (3.1). */
function clockPoint(value: number): Course {
  return ((((value - 1) % 12) + 12) % 12 + 1) as Course
}

/** Turn a course by `points`; positive is to starboard (3.1, 3.5). */
function turnBy(course: Course, points: number): Course {
  return clockPoint(course + Math.round(points))
}

/** Screen level as the 4.7 table understands it: never above 2. */
function clampScreens(level: number): ScreenLevel {
  return Math.max(0, Math.min(2, Math.round(level))) as ScreenLevel
}

// ---------------------------------------------------------------------------
// 12.11 Knocked off course (by Rich Mcgee)
// ---------------------------------------------------------------------------

/**
 * The highest direction die that shoves a ship to starboard (12.11).
 *
 * *"On a 1-3, immediately change the ship's facing by 30 degrees to starboard,
 * on a 4-6 change facing 30 degrees to port."* An even split of the die, but
 * the *low* half is starboard, which is the way round a reader guesses wrong.
 */
export const KNOCK_OFF_COURSE_STARBOARD_MAX = 3

/** Which way an uncommanded shove threw the ship (12.11). */
export type KnockDirection = 'starboard' | 'port'

/** One of 12.11's two checks — the facing, or (under vector) the heading. */
export interface CourseKnock {
  /** The number the die had to reach to fail the threshold (4.11). */
  target: number
  roll: number
  /** The die after 4.11's extra-row bonus and any DRM. */
  modified: number
  knocked: boolean
  /** The 1–3 / 4–6 die, rolled only when the threshold failed. */
  directionRoll: number | null
  direction: KnockDirection | null
  /** The clock course after the shove; unchanged when the threshold held. */
  course: Course
}

export interface KnockedOffCourseResult {
  facing: CourseKnock
  /**
   * 12.11's second check, present only when the caller supplied a vector
   * heading: *"the first check will change the facing of the ship as described
   * above. The second check determines whether the ship's heading changes."*
   */
  heading: CourseKnock | null
}

/**
 * A ship shaken off its heading by threshold damage (12.11).
 *
 * *"Whenever a ship passes a damage threshold, while using the cinematic
 * movement rules, after checking for systems failures make one further roll at
 * the same odds (so 6+ for first threshold, 5+ for second, etc.) to determine
 * if the ship has been knocked off course."*
 *
 * "At the same odds" is `dice.thresholdTarget`, which is why that number is
 * imported rather than re-derived: 4.11's ladder lives in exactly one place.
 * The same phrase carries 4.11's other modifier — *"crossing several rows in
 * one attack adds 1 to each die per extra row"* — into `extraRows`
 * (**[reading] 20**), and a Flawed Design's standing DRM into `drm`.
 *
 * Call this *after* `threshold.ts` has resolved the row, not instead of it.
 *
 * Dice are drawn in a fixed order so a battle replays: facing threshold,
 * facing direction, heading threshold, heading direction. A check that holds
 * draws no direction die.
 */
export function resolveKnockedOffCourse(
  facing: Course,
  rowsLost: number,
  rng: Rng,
  opts: { extraRows?: number; drm?: number; heading?: Course } = {},
): KnockedOffCourseResult {
  const target = thresholdTarget(rowsLost)
  const bonus = (opts.extraRows ?? 0) + (opts.drm ?? 0)
  const shove = (course: Course): CourseKnock => {
    const roll = d6(rng)
    const modified = roll + bonus
    if (modified < target) {
      return { target, roll, modified, knocked: false, directionRoll: null, direction: null, course }
    }
    const directionRoll = d6(rng)
    const direction: KnockDirection =
      directionRoll <= KNOCK_OFF_COURSE_STARBOARD_MAX ? 'starboard' : 'port'
    return {
      target,
      roll,
      modified,
      knocked: true,
      directionRoll,
      direction,
      // 30 degrees is one clock point: `geometry.DEGREES_PER_POINT` is 30.
      course: turnBy(course, direction === 'starboard' ? 1 : -1),
    }
  }
  return {
    facing: shove(facing),
    heading: opts.heading === undefined ? null : shove(opts.heading),
  }
}

// ---------------------------------------------------------------------------
// 17.1 Planetoids and dense asteroid fields
// ---------------------------------------------------------------------------

/**
 * Base sizes 17.1 suggests for an irregular model: *"perhaps 1 to 6 MU across,
 * depending on the asteroid size"*. Diameters, so halve them for a radius.
 */
export const PLANETOID_BASE_DIAMETER = { min: 1, max: 6 } as const

/**
 * *"Fighters may still fly around the asteroid to attack as normal"* (17.1).
 *
 * Stated as a constant because it is the half of the blocking rule that gets
 * dropped: a blocked line stops every ship weapon, every missile *placement*
 * and both kinds of sensor scan, and stops fighters not at all.
 */
export const PLANETOIDS_BLOCK_FIGHTERS = false

/**
 * The bodies lying across the line between two models (17.1).
 *
 * *"Any line between two ships that crosses any part of the asteroid is
 * blocked. (Between center points of models, remember.)"* Centre to centre,
 * against the disc — the ships' own hulls have no size in this test, and
 * *"ships cannot block line of sight or line of fire"* at all.
 */
export function blockingBodies(
  from: Point,
  to: Point,
  bodies: readonly TerrainBody[],
): TerrainBody[] {
  return bodies.filter((body) => distanceToSegment(body.position, from, to) < body.radius - EPSILON)
}

/**
 * Whether one model can shoot at, or scan, another (17.1).
 *
 * The same predicate answers three questions, because 17.1 gives them one
 * answer: firing (*"those ships may not fire at each other with any
 * weapons"*), missile launch (*"or place missiles along that line"*) and
 * detection (*"sensor scans are also blocked by asteroids … this blocking
 * applies equally to active scan attempts as to passive"*).
 *
 * Not fighters — see `PLANETOIDS_BLOCK_FIGHTERS`.
 */
export function hasLineOfFire(
  from: Point,
  to: Point,
  bodies: readonly TerrainBody[],
): boolean {
  return blockingBodies(from, to, bodies).length === 0
}

/**
 * Optional damage points for an asteroid (17.1, "Damage to asteroids").
 *
 * *"The normal rules assume that asteroids cannot be destroyed … However, if
 * the players wish, they may give each asteroid a large damage point value
 * (perhaps 50 for a very small chunk, 100 for a larger one, etc.)"*. The
 * "etc." is the scenario's, and so is the decision to use the rule at all.
 */
export const ASTEROID_DAMAGE_POINTS = { verySmallChunk: 50, largerChunk: 100 } as const

/** One fragment of a shattered asteroid (17.1). */
export interface AsteroidChunk {
  /** Clock course it flies off on — see **[reading] 21** for the velocity. */
  course: Course
}

export interface AsteroidShatterResult {
  /** The 1D6 that set the number of chunks. */
  roll: number
  chunks: AsteroidChunk[]
}

/**
 * An asteroid shot to pieces (17.1).
 *
 * *"When an asteroid is reduced to zero damage, it disintegrates into 1D6
 * smaller chunks, which all move at random courses and speeds out from the
 * point of destruction. Try to avoid that lot. . ."*
 *
 * **[reading] 21:** a course is a clock point drawn uniformly from the twelve,
 * because that is the only representation of direction in the engine (3.1). No
 * velocity is rolled — "random speeds" names no range, no bound and no die
 * anywhere in the book, so the scenario sets them and this module does not
 * invent a number.
 */
export function shatterAsteroid(rng: Rng): AsteroidShatterResult {
  const roll = d6(rng)
  const chunks: AsteroidChunk[] = []
  for (let i = 0; i < roll; i++) chunks.push({ course: (rng.int(12) + 1) as Course })
  return { roll, chunks }
}

// ---------------------------------------------------------------------------
// 17.2 Dust or nebula clouds
// ---------------------------------------------------------------------------

/**
 * *"Travel through a cloud is restricted to a maximum safe velocity of 12"*
 * (17.2). At or below it a cloud costs a ship nothing but its aim.
 */
export const CLOUD_SAFE_VELOCITY = 12

/** *"On a 4-6 the shot may be fired as normal"* (17.2 rule 2). */
export const CLOUD_LOCK_ON_MINIMUM = 4

export interface CloudDamageResult {
  /** False when the ship was inside the safe velocity and no die was thrown. */
  rolled: boolean
  roll: number | null
  damage: number
  /** `standard`: 17.2 says armour and Advanced Screens do protect. */
  mode: DamageMode
  reason: string
}

/**
 * Damage for crossing a cloud too fast (17.2 rule 1).
 *
 * *"Any ship attempting to exceed this in a cloud will suffer potential damage
 * – roll 1 D6 and apply damage as for beam weapons fire. Standard Screens
 * offer no protection, but armor and Advanced Screens do."*
 *
 * **[reading] 1** puts that screens-and-armour sentence in 17.2 rather than in
 * 17.4, which is what makes `advancedScreens` meaningful here. **[reading] 2**
 * reads *"as for beam weapons fire"* as the 4.5 damage table only, without
 * 4.6's re-roll: a re-roll's damage *"ignores screens and armour"*, which would
 * contradict the sentence it is being read alongside. **[reading] 3** throws
 * one die per ship per turn, not one per 6 MU — 17.4, printed in the opposite
 * column, is the rule that counts dice by speed, and this one pointedly is not.
 */
export function cloudSpeedDamage(
  velocity: number,
  rng: Rng,
  opts: { screens?: ScreenLevel; advancedScreens?: boolean } = {},
): CloudDamageResult {
  if (velocity <= CLOUD_SAFE_VELOCITY) {
    return {
      rolled: false,
      roll: null,
      damage: 0,
      mode: 'standard',
      reason: `velocity ${velocity} is within the ${CLOUD_SAFE_VELOCITY} MU safe limit (17.2)`,
    }
  }
  const screens = opts.advancedScreens === true ? clampScreens(opts.screens ?? 0) : 0
  const roll = d6(rng)
  return {
    rolled: true,
    roll,
    damage: beamDamage(roll, screens),
    mode: 'standard',
    reason: '',
  }
}

/**
 * A cloud's screen bonus (17.2 rules 2 and 3): *"treat the target as having
 * one screen level higher than normal … (Screen levels above 2 remain at 2.)"*
 *
 * The cap is where the tactics are. An unscreened ship gains the 4s back; a
 * screen-1 ship gains only the 6s; a screen-2 ship gains nothing at all, so a
 * nebula is worth least to the ship that needed it least.
 */
export function attenuatedScreens(screens: ScreenLevel): ScreenLevel {
  return clampScreens(screens + 1)
}

export interface CloudLockOnResult {
  /** Null for fighters, which *"always lock on"* and so throw no die (17.2). */
  roll: number | null
  locked: boolean
  /** The screen level this shot resolves against, attenuation included. */
  screens: ScreenLevel
  reason: string
}

/**
 * Getting a lock through dust (17.2 rules 2 and 3).
 *
 * *"When attempting to fire at a ship in a dust cloud, or if the firing ship is
 * itself in a cloud, roll a D6 after nominating the target. On a roll of 1-3
 * the dust has prevented a successful target lock-on and the ship may not be
 * fired at."* Either end of the shot being in the cloud is enough, which is the
 * clause that catches players out: sitting in a nebula blinds you as much as it
 * hides you.
 *
 * *"Fighters always lock on, but treat the target as having one screen level
 * higher as for beam weapons"* — no die, but the attenuation still bites.
 *
 * **[reading] 4:** one die per target nomination, not per weapon, so a ship
 * with six mounts does not get six chances at the same target. **[reading] 5:**
 * `beamOrGraser` gates the attenuation, because 17.2 names *"beams or
 * Grasers"* and fighters and nothing else; the caller knows the weapon class,
 * this module is not allowed to import one.
 */
export function cloudTargetLock(
  rng: Rng,
  opts: { screens?: ScreenLevel; fighter?: boolean; beamOrGraser?: boolean } = {},
): CloudLockOnResult {
  const base = clampScreens(opts.screens ?? 0)
  const fighter = opts.fighter === true
  // Rule 3 attenuates for a fighter whether or not the caller flags a beam.
  const attenuates = fighter || opts.beamOrGraser === true
  const screens = attenuates ? attenuatedScreens(base) : base
  if (fighter) {
    return { roll: null, locked: true, screens, reason: '' }
  }
  const roll = d6(rng)
  const locked = roll >= CLOUD_LOCK_ON_MINIMUM
  return {
    roll,
    locked,
    screens,
    reason: locked ? '' : `dust prevented lock-on on a ${roll} (17.2)`,
  }
}

// ---------------------------------------------------------------------------
// 17.3 Solar flares
// ---------------------------------------------------------------------------

/** *"On a score of 4+ the system is undamaged"* (17.3). */
export const SOLAR_FLARE_SAFE_SCORE = 4

/** The two kinds of box a flare rolls against (17.3). */
export type FlareSystemKind = 'firecon' | 'sensor'

/** One system exposed to a flare. */
export interface FlareSystem {
  id: string
  kind: FlareSystemKind
}

/**
 * Classify an SSD system for 17.3. Returns null for everything a flare does
 * not touch — a flare takes out eyes, not guns, screens or drives.
 */
export function flareSystemKind(kind: SystemKind): FlareSystemKind | null {
  if (kind === 'firecon' || kind === 'advanced-firecon') return 'firecon'
  if (kind === 'enhanced-sensors' || kind === 'superior-sensors') return 'sensor'
  return null
}

export interface FlareSystemCheck {
  id: string
  kind: FlareSystemKind
  roll: number
  /** The die plus one per active screen level. */
  modified: number
  knockedOut: boolean
}

export interface SolarFlareResult {
  checks: FlareSystemCheck[]
  /** Ids to cross off, *"as if by a threshold check"* (17.3, 4.11). */
  knockedOut: string[]
}

/**
 * A ship caught in a solar flare (17.3).
 *
 * *"Any ship that is caught in a flare rolls a D6 for each of its FireCon and
 * sensor systems (if the advanced sensor rules are being used), adding 1 to the
 * score per active screen level. On a score of 4+ the system is undamaged;
 * otherwise it is knocked out as if by a threshold check."*
 *
 * Screens are a flat bonus here, not the 4.7 table: a screen-2 ship rolls 3+
 * and loses a FireCon only to a natural 1 or 2, while an unscreened one loses a
 * third of its fire control every time. `screens` is the level *in effect*, so
 * a generator that is off or dead contributes nothing — 17.3 says *"active"*.
 *
 * **[reading] 6:** the parenthetical governs sensors, not FireCons, so FireCons
 * are rolled for whether or not 12.2's advanced sensor rules are in play. Read
 * the other way, 17.3 would do nothing at all in a game not using an optional
 * rule from another section.
 *
 * Reports which systems fell; crossing them off is `game.ts`'s `destroySystem`,
 * because *"as if by a threshold check"* is 4.11's outcome and `threshold.ts`
 * owns it. Whether a flare happens at all is the scenario's call — 17.3 says
 * only *"perhaps diced for each turn"* and names no odds.
 */
export function resolveSolarFlare(
  systems: readonly FlareSystem[],
  screens: ScreenLevel,
  rng: Rng,
  opts: { advancedSensorRules?: boolean } = {},
): SolarFlareResult {
  const bonus = clampScreens(screens)
  const checks: FlareSystemCheck[] = []
  for (const system of systems) {
    if (system.kind === 'sensor' && opts.advancedSensorRules !== true) continue
    const roll = d6(rng)
    const modified = roll + bonus
    checks.push({
      id: system.id,
      kind: system.kind,
      roll,
      modified,
      knockedOut: modified < SOLAR_FLARE_SAFE_SCORE,
    })
  }
  return { checks, knockedOut: checks.filter((c) => c.knockedOut).map((c) => c.id) }
}

// ---------------------------------------------------------------------------
// 17.4 Asteroid fields, meteor swarms and debris
// ---------------------------------------------------------------------------

/**
 * *"These may cover areas of between 6 MU and 12 MU diameter (or other
 * shapes/sizes at players discretion)"* (17.4).
 */
export const ASTEROID_FIELD_DIAMETER = { min: 6, max: 12 } as const

/** *"1 D6 rolled for every full 6 MU of velocity"* (17.4). */
export const METEOR_VELOCITY_PER_DIE = 6

/**
 * Dice a ship throws for crossing a field (17.4).
 *
 * The printed ladder — *"Up to velocity 5 = no damage, 6-11 = 1 D6, 12-17 =
 * 2 D6, etc."* — and the printed formula are two separate sentences that could
 * have disagreed, and do not: the band edges are 6, 12 and 18, and 11 and 17
 * are the last velocities in their bands.
 */
export function meteorFieldDice(velocity: number): number {
  return Math.floor(Math.max(0, velocity) / METEOR_VELOCITY_PER_DIE)
}

export interface MeteorFieldResult {
  /** Faces as thrown; each one *is* its own damage. */
  dice: number[]
  normalDamage: number
  penetratingDamage: number
  mode: DamageMode
}

/**
 * A ship meeting an asteroid field, meteor swarm or debris field (17.4).
 *
 * *"Any ship that enters or is hit by such an asteroid field, meteor swarm, or
 * debris field has 1 D6 rolled for every full 6 MU of velocity, with the actual
 * score rolled equaling the (penetrating) damage sustained."*
 *
 * This is not the beam table and it is not a hit count: the face **is** the
 * damage, and it is penetrating, so 4.6 puts it past screens and armour alike.
 * Velocity 12 averages 7 points straight into the hull — a threshold point or
 * two on most designs, from terrain, with nobody shooting.
 *
 * 17.5's battle debris resolves through this same function: *"any ship
 * encountering the cloud treats it exactly as for the meteor and debris rules
 * given in the section above"*.
 */
export function resolveMeteorField(velocity: number, rng: Rng): MeteorFieldResult {
  const dice = rollD6(meteorFieldDice(velocity), rng)
  return {
    dice,
    normalDamage: 0,
    penetratingDamage: dice.reduce((sum, face) => sum + face, 0),
    mode: 'P',
  }
}

// ---------------------------------------------------------------------------
// 17.5 Battle debris
// ---------------------------------------------------------------------------

/**
 * Overkill on a dying ship (17.5): *"the amount of excess damage inflicted
 * (over that required to reduce the ship to zero points)"*.
 *
 * The worked example fixes the arithmetic: *"if a ship has 2 hull boxes left
 * and suffers a further 5 points of damage, a die roll of 5 - 2 = 3 or less
 * will cause it to explode."*
 *
 * **[reading] 8:** clamped at zero, so a ship brought to exactly zero never
 * explodes — a D6 cannot roll at or below 0, and overkill is the mechanism.
 */
export function excessDamage(damageInflicted: number, hullRemaining: number): number {
  return Math.max(0, damageInflicted - Math.max(0, hullRemaining))
}

export interface ExplosionCheck {
  excess: number
  /** Null when there was no overkill to roll against. */
  roll: number | null
  explodes: boolean
}

/**
 * Hulk or fireball (17.5).
 *
 * *"When a ship is destroyed by enemy fire … it may simply become a drifting
 * hulk, or it may actually explode into a cloud of debris. To determine if this
 * happens, note the amount of excess damage inflicted … and roll a D6. If the
 * score is less than or equal to the excess damage then the remains of the ship
 * explode."*
 *
 * At or **below** — the only roll in section 17 that wants a low die. An excess
 * of 3 is even money; an excess of 6 or more is certain, and the die is still
 * thrown so the log has one.
 */
export function explosionCheck(
  damageInflicted: number,
  hullRemaining: number,
  rng: Rng,
): ExplosionCheck {
  const excess = excessDamage(damageInflicted, hullRemaining)
  if (excess <= 0) return { excess, roll: null, explodes: false }
  const roll = d6(rng)
  return { excess, roll, explodes: roll <= excess }
}

/**
 * *"An exploding ship creates a cloud of debris 2 MU in diameter for an escort,
 * 4 MU for a cruiser, or 6 MU for a capital ship"* (17.5).
 */
export const DEBRIS_CLOUD_DIAMETER = { escort: 2, cruiser: 4, capital: 6 } as const

/**
 * Cloud size for a hull group (17.5).
 *
 * **[reading] 7:** 17.5 names three of `ShipGroup`'s six. A station and a
 * monster take the capital's 6 MU — 17.1 already files *"starbases, orbitals"*
 * under Really Big Things, and a monster is capital-sized by construction. A
 * civilian takes the cruiser's 4 MU, the middle of three bands, because the
 * group spans everything from a courier to a colony ship and the book never
 * sizes it.
 */
export function debrisCloudDiameter(group: ShipGroup): number {
  switch (group) {
    case 'escort':
      return DEBRIS_CLOUD_DIAMETER.escort
    case 'cruiser':
    case 'civilian':
      return DEBRIS_CLOUD_DIAMETER.cruiser
    default:
      return DEBRIS_CLOUD_DIAMETER.capital
  }
}

/** *"The debris cloud exists for only 1 turn after the explosion"* (17.5). */
export const DEBRIS_CLOUD_LIFETIME_TURNS = 1

/**
 * A drifting cloud of what used to be a ship (17.5).
 *
 * It keeps the dead ship's last vector: *"it moves on the same course and
 * velocity as the ship was travelling at the point of destruction"*.
 */
export interface DebrisCloud {
  id: string
  position: Point
  /** Diameter in MU, from `debrisCloudDiameter` (17.5). */
  diameter: number
  course: Course
  velocity: number
  /** The turn the ship blew up on. */
  createdTurn: number
}

export function createDebrisCloud(opts: {
  id: string
  position: Point
  course: Course
  velocity: number
  turn: number
  group?: ShipGroup
  diameter?: number
}): DebrisCloud {
  return {
    id: opts.id,
    position: { ...opts.position },
    diameter: opts.diameter ?? debrisCloudDiameter(opts.group ?? 'cruiser'),
    course: opts.course,
    velocity: opts.velocity,
    createdTurn: opts.turn,
  }
}

/**
 * Drift the cloud one turn along the dead ship's course (17.5).
 *
 * Straight ahead, so `moveShip` with no course change — the cloud has no drive
 * and writes no orders (16.1).
 */
export function moveDebrisCloud(cloud: DebrisCloud): DebrisCloud {
  return { ...cloud, position: moveShip(cloud.position, cloud.course, cloud.velocity, 0).position }
}

/**
 * *"After the one turn the debris is assumed to have spread out sufficiently to
 * present little risk to other ships, and is removed from play"* (17.5).
 *
 * A ship dies in phase 10 or 11, by which time that turn's movement is over, so
 * the cloud's single turn of danger is the one after the explosion and it is
 * gone before the turn after that.
 */
export function debrisCloudExpired(cloud: DebrisCloud, turn: number): boolean {
  return turn > cloud.createdTurn + DEBRIS_CLOUD_LIFETIME_TURNS
}

/** Whether a model is inside the cloud — centre point against the disc (17.6). */
export function inDebrisCloud(cloud: DebrisCloud, position: Point): boolean {
  return distance(cloud.position, position) <= cloud.diameter / 2 + EPSILON
}

// ---------------------------------------------------------------------------
// 17.6 Collisions
// ---------------------------------------------------------------------------

/** *"If the needed number for avoidance is 1 or less"* the ship is safe (17.6). */
export const COLLISION_AUTOMATIC_AVOIDANCE = 1

/** *"If the number is greater than 6, then a crash is inevitable"* (17.6). */
export const COLLISION_INEVITABLE_ABOVE = 6

/**
 * The number a ship must roll to miss an asteroid (17.6).
 *
 * *"Subtract the ship's total available thrust rating from its current
 * velocity. This number must be equaled or exceeded by the roll of 1D6 …
 * Ships with Advanced Drives double their engine rating."*
 *
 * **[reading] 10:** *"total available thrust rating"* is the drive's rating,
 * not the thrust left unspent this turn — the worked example uses a cruiser's
 * bare *"thrust rating of 4"* and never asks what its orders cost. A drive
 * knocked down by 4.11 does reduce the rating, so pass the effective one.
 */
export function collisionAvoidanceTarget(
  velocity: number,
  thrust: number,
  opts: { advancedDrive?: boolean } = {},
): number {
  const rating = Math.max(0, thrust) * (opts.advancedDrive === true ? 2 : 1)
  return velocity - rating
}

export interface CollisionResult {
  target: number
  /** Target 1 or less: no die is thrown and the ship is clear (17.6). */
  automatic: boolean
  /** Target above 6: no die is thrown and the ship is gone (17.6). */
  inevitable: boolean
  roll: number | null
  avoided: boolean
  destroyed: boolean
  reason: string
}

/**
 * Trying not to hit a billion tons of rock (17.6).
 *
 * There is no damage table here and 16.7's ramming arithmetic does not apply:
 * *"When any ship, regardless of its class, hits an asteroid, the ship is
 * completely destroyed. Ramming a billion tons of rock at any speed is not
 * recommended, even in a superdreadnought!"*
 */
export function resolveCollision(
  velocity: number,
  thrust: number,
  rng: Rng,
  opts: { advancedDrive?: boolean } = {},
): CollisionResult {
  const target = collisionAvoidanceTarget(velocity, thrust, opts)
  if (target <= COLLISION_AUTOMATIC_AVOIDANCE) {
    return {
      target,
      automatic: true,
      inevitable: false,
      roll: null,
      avoided: true,
      destroyed: false,
      reason: `avoidance number ${target} is 1 or less (17.6)`,
    }
  }
  if (target > COLLISION_INEVITABLE_ABOVE) {
    return {
      target,
      automatic: false,
      inevitable: true,
      roll: null,
      avoided: false,
      destroyed: true,
      reason: `avoidance number ${target} is above 6, a crash is inevitable (17.6)`,
    }
  }
  const roll = d6(rng)
  const avoided = roll >= target
  return {
    target,
    automatic: false,
    inevitable: false,
    roll,
    avoided,
    destroyed: !avoided,
    reason: avoided ? '' : `rolled ${roll} against ${target} (17.6)`,
  }
}

/**
 * Collision risk against a body that never moves (17.6).
 *
 * *"If the asteroid is stationary … then a ship risks collision with the
 * asteroid if its path during the Ship Movement Phase crosses any edge of the
 * asteroid."* The whole path, both legs of a 3.4 turn (**[reading] 9**), and
 * *"use the base or model edges of the asteroid and the center point of the
 * ship model … not the edges of the ship model"*.
 */
export function stationaryCollisionRisk(
  shipPath: readonly Point[],
  body: TerrainBody,
): boolean {
  return distanceToPath(body.position, shipPath) <= body.radius + EPSILON
}

/**
 * Collision risk against a body under way (17.6).
 *
 * Two tests, and neither of them is the one people assume:
 *
 * *"• The movement path of the asteroid brings it into contact with a ship at
 * any point. (This is before the ship itself has moved, at the beginning of the
 * Ship Movement Phase.) • The final position of a ship after making its move is
 * inside the asteroid."*
 *
 * So the asteroid sweeps ships up where they were *standing*, and then catches
 * anyone who parks inside it. What it does not do is sweep them along their own
 * tracks: *"collisions do not occur if the movement paths of the asteroid and
 * ship merely cross"*. That is stated twice, and it is what makes both
 * movements predictable enough for 17.6 to say you have only yourself to blame.
 */
export function movingCollisionRisk(
  asteroidPath: readonly Point[],
  asteroidRadius: number,
  shipBefore: Point,
  shipAfter: Point,
): boolean {
  if (asteroidPath.length === 0) return false
  if (distanceToPath(shipBefore, asteroidPath) <= asteroidRadius + EPSILON) return true
  const end = asteroidPath[asteroidPath.length - 1]
  return distance(shipAfter, end) <= asteroidRadius + EPSILON
}

// ---------------------------------------------------------------------------
// 17.7 Planets — the orbital table
// ---------------------------------------------------------------------------

/**
 * *"…and within 6 MU of the same distance from the diagonally opposite corner
 * edge"* (17.7).
 */
export const ORBIT_REENTRY_TOLERANCE = 6

/**
 * Turns a ship spends round the far side of the planet (17.7).
 *
 * *"Thrust 0 or 1 ships cannot enter until the 5th turn after exiting, thrust 2
 * to 4 until the 4th, and thrust 5 or greater the 3rd."*
 */
export function orbitReentryDelay(thrust: number): number {
  if (thrust <= 1) return 5
  if (thrust <= 4) return 4
  return 3
}

/**
 * Earliest turn a ship that left the table on `exitTurn` may come back (17.7).
 *
 * **[reading] 11:** *"the 5th turn after exiting"* is `exitTurn + 5`, taken
 * literally, rather than counting the exit turn as the first of the five.
 */
export function orbitReentryTurn(exitTurn: number, thrust: number): number {
  return exitTurn + orbitReentryDelay(thrust)
}

export function canReenterFromOrbit(exitTurn: number, thrust: number, turn: number): boolean {
  return turn >= orbitReentryTurn(exitTurn, thrust)
}

/**
 * The placement half of 17.7, as far as it can be checked here.
 *
 * *"The ship can enter again by being placed before orders on the opposite
 * edge, at the same velocity and course, and within 6 MU of the same distance
 * from the diagonally opposite corner edge."*
 *
 * `GameState` has no table bounds, so which edge is "opposite" and where the
 * corners are cannot be answered in this engine; the caller measures both
 * distances and this function applies the tolerance. The velocity and course
 * are the ones recorded at exit, unchanged — a lap of the planet is not a
 * chance to re-plot.
 */
export function orbitReentryPlacementLegal(
  exitCornerDistance: number,
  entryCornerDistance: number,
): boolean {
  return Math.abs(exitCornerDistance - entryCornerDistance) <= ORBIT_REENTRY_TOLERANCE + EPSILON
}

// ---------------------------------------------------------------------------
// 17.8 Medium scale
// ---------------------------------------------------------------------------

/** *"The edge of the planet is the orbit track and should be marked with 12
 *  clock face points"* (17.8) — the same twelve as a course (3.1). */
export const ORBIT_TRACK_POINTS = 12

/**
 * *"If you do allow hostile ships within the same point, they may fire at each
 * other as if at 1 MU range, through any arc the firing ship chooses"* (17.8).
 */
export const ORBIT_SAME_POINT_RANGE = 1

/**
 * An orbit track at medium scale (17.8).
 *
 * Two quite different numbers, and the section reuses the word "velocity" for
 * one of them: `orbitalVelocity` is an MU velocity a ship must hold, and
 * `orbitSpeed` is clock points travelled per turn round the track.
 *
 * **[reading] 12:** the track's *"entry velocity"* and the *"orbital
 * velocity"* used everywhere afterwards are one number. Read as two, "orbital
 * velocity" would be undefined at its first use.
 */
export interface OrbitTrack {
  center: Point
  /** *"The edge of the planet is the orbit track"* (17.8). */
  radius: number
  /** MU velocity that holds the track — the *"entry velocity"* (17.8). */
  orbitalVelocity: number
  /** Clock points per turn; negative runs anticlockwise. */
  orbitSpeed: number
}

/** Where a numbered marker sits on the track (17.8). */
export function orbitMarkerPosition(track: OrbitTrack, marker: Course): Point {
  return moveShip(track.center, marker, track.radius, 0).position
}

/**
 * *"…is placed at the nearest marker point"* (17.8).
 *
 * Measured against all twelve markers rather than by converting an angle,
 * because "nearest marker point" is literally what the rule asks for. Ties go
 * to the lower clock number, so the answer is the same on every replay.
 */
export function nearestOrbitMarker(track: OrbitTrack, position: Point): Course {
  let best: Course = 1
  let bestDistance = Number.POSITIVE_INFINITY
  for (let marker = 1; marker <= ORBIT_TRACK_POINTS; marker++) {
    const d = distance(position, orbitMarkerPosition(track, marker as Course))
    if (d < bestDistance - EPSILON) {
      bestDistance = d
      best = marker as Course
    }
  }
  return best
}

/**
 * One turn's travel round the track (17.8): *"moves the ship by a number of
 * points equal to the orbit speed"*. No orders are written for it — *"the ship
 * does not have to have any course change orders written for it"*.
 */
export function advanceOrbit(marker: Course, orbitSpeed: number): Course {
  return clockPoint(marker + orbitSpeed)
}

/**
 * Which way a ship in orbit points (17.8).
 *
 * *"If using cinematic movement, ships in orbit face forward in the closest
 * course facing to the orbit path at that point."*
 *
 * **[reading] 13:** the tangent to a circle is perpendicular to the radius, and
 * a quarter of a twelve-point clock is exactly three points, so the "closest"
 * facing is exact rather than approximate: three points ahead of the marker
 * going clockwise, three behind going anticlockwise.
 */
export function orbitFacing(marker: Course, orbitSpeed: number): Course {
  return clockPoint(marker + (orbitSpeed < 0 ? -3 : 3))
}

/**
 * The course a ship takes when it accelerates out of orbit (17.8): *"in a
 * straight line at the clock face heading that is the closest tangent to its
 * orbital path"* — the same tangent it was already facing.
 */
export function orbitDepartureCourse(marker: Course, orbitSpeed: number): Course {
  return orbitFacing(marker, orbitSpeed)
}

/**
 * A satellite or starbase in orbit (17.8), which faces the other way entirely:
 * *"always face 'away' from the center of the planet"*. A station at marker 4
 * faces course 4, outward, whatever the orbit speed.
 */
export function satelliteFacing(marker: Course): Course {
  return marker
}

/** *"Ships at the point immediately in front or behind"* (17.8). */
export function orbitMarkersAdjacent(a: Course, b: Course): boolean {
  const delta = (((b - a) % 12) + 12) % 12
  return delta === 1 || delta === 11
}

/**
 * Whether a ship in orbit may shoot at something (17.8).
 *
 * *"Ships in orbit may fire at any ships outside the orbit track, or at ships
 * at the point immediately in front or behind."* Everything off the track is
 * fair game; on the track, only the two neighbouring markers — and the shooter's
 * own marker, under the optional rule that lets hostiles share one
 * (`ORBIT_SAME_POINT_RANGE`).
 */
export function canFireFromOrbit(
  shooterMarker: Course,
  target: { inOrbit: boolean; marker?: Course },
): boolean {
  if (!target.inOrbit) return true
  if (target.marker === undefined) return false
  return target.marker === shooterMarker || orbitMarkersAdjacent(shooterMarker, target.marker)
}

/**
 * Whether a move meets the orbit track (17.8): *"A ship enters orbit with any
 * movement that intersects the orbit track."*
 *
 * The track is a circle, so the test is whether the closest approach of the
 * flown path reaches it. A ship that begins the move already inside the track
 * cannot meet it on the way in — it is under the track, not crossing it — and
 * a ship already in orbit is not flying a path at all.
 */
export function pathMeetsOrbitTrack(track: OrbitTrack, path: readonly Point[]): boolean {
  if (path.length === 0) return false
  if (distance(track.center, path[0]) < track.radius - EPSILON) return false
  return distanceToPath(track.center, path) <= track.radius + EPSILON
}

/** What happens to a ship whose move meets the orbit track (17.8). */
export type OrbitArrival = 'in-orbit' | 'decaying' | 'uncontrolled-entry'

/**
 * Arriving at the track (17.8).
 *
 * *"A ship enters orbit with any movement that intersects the orbit track at
 * the entry velocity … If the ship hits the orbital distance at less than the
 * orbital velocity, it will enter an automatically decaying orbit and start to
 * enter the atmosphere. If it arrives with greater than the correct velocity it
 * will ram straight into the atmosphere in an uncontrolled entry – you have
 * been warned!"*
 *
 * Too slow is survivable and too fast is not, which is the opposite of the
 * intuition most players bring to it.
 */
export function orbitTrackArrival(velocity: number, track: OrbitTrack): OrbitArrival {
  if (velocity < track.orbitalVelocity) return 'decaying'
  if (velocity > track.orbitalVelocity) return 'uncontrolled-entry'
  return 'in-orbit'
}

/** What a velocity change does to a ship already in orbit (17.8). */
export type OrbitStatus = 'in-orbit' | 'decaying' | 'leaves-orbit'

/**
 * Changing speed in orbit (17.8).
 *
 * *"Any velocity change will cause the ship to leave orbit, either down or up.
 * … If the ship decelerates to less than the orbital velocity, its orbit will
 * decay and it will start to enter the atmosphere. If it accelerates to above
 * the orbital velocity it will leave orbit and move normally."*
 */
export function orbitVelocityChange(velocity: number, track: OrbitTrack): OrbitStatus {
  if (velocity < track.orbitalVelocity) return 'decaying'
  if (velocity > track.orbitalVelocity) return 'leaves-orbit'
  return 'in-orbit'
}

export interface OrbitDecayCheck {
  target: number
  roll: number
  modified: number
  /** True when the orbit has decayed and the ship is entering atmosphere. */
  decayed: boolean
}

/**
 * Holding an orbit after being hit (17.8).
 *
 * *"Any ship that suffers a drive or bridge threshold failure while in orbit
 * must make a second threshold check to stay in orbit. If this too fails, the
 * ship orbit has decayed and it enters the atmosphere."*
 *
 * "A second threshold check" is 4.11's, at the row's own odds, so the target
 * comes from `dice.thresholdTarget` and a roll at or above it fails — the same
 * arithmetic 12.11 uses, for the same reason.
 *
 * Only call it when the drive or the bridge has already gone; a FireCon lost to
 * a threshold check does not shake a ship out of orbit.
 */
export function orbitDecayCheck(
  rowsLost: number,
  rng: Rng,
  opts: { extraRows?: number; drm?: number } = {},
): OrbitDecayCheck {
  const target = thresholdTarget(rowsLost)
  const roll = d6(rng)
  const modified = roll + (opts.extraRows ?? 0) + (opts.drm ?? 0)
  return { target, roll, modified, decayed: modified >= target }
}

// ---------------------------------------------------------------------------
// 17.9 Large scale
// ---------------------------------------------------------------------------

/**
 * *"The outer zone is strength 1, the middle strength 2, and the innermost 4"*
 * (17.9). Outermost first, which is the order a ship meets them.
 */
export const GRAVITY_ZONE_STRENGTHS = [1, 2, 4] as const

/** *"Treat a sun as a large planet with an extra inner zone of strength 8"* (17.9). */
export const SUN_INNER_ZONE_STRENGTH = 8

/** *"Three concentric gravity zones, each extending the radius by at least 1 MU"* (17.9). */
export const GRAVITY_ZONE_MIN_WIDTH = 1

export interface GravityZone {
  strength: number
  /** Outer edge of the zone, measured from the well's centre. */
  radius: number
}

/** A planet or sun at large scale, with its zones (17.9). */
export interface GravityWell {
  center: Point
  /** The body's own disc: *"small disks up to several MU in diameter"* (17.9). */
  radius: number
  /** Outermost first — the order a ship crosses them coming in. */
  zones: GravityZone[]
}

/**
 * Build a well and its zones (17.9).
 *
 * *"A planet is surrounded by three concentric gravity zones, each extending
 * the radius by at least 1 MU. The outer zone is strength 1, the middle
 * strength 2, and the innermost 4. For large planets increase the radius of the
 * zones; treat a sun as a large planet with an extra inner zone of strength 8."*
 *
 * `zoneWidth` is the "at least 1 MU" — widen it for a large planet, which is
 * how 17.9 says to make one big.
 */
export function createGravityWell(
  center: Point,
  radius: number,
  opts: { sun?: boolean; zoneWidth?: number } = {},
): GravityWell {
  const width = Math.max(GRAVITY_ZONE_MIN_WIDTH, opts.zoneWidth ?? GRAVITY_ZONE_MIN_WIDTH)
  // Innermost first while building, so a sun's extra zone slots under the 4.
  const strengths: number[] = opts.sun === true
    ? [SUN_INNER_ZONE_STRENGTH, ...[...GRAVITY_ZONE_STRENGTHS].reverse()]
    : [...GRAVITY_ZONE_STRENGTHS].reverse()
  const zones = strengths.map((strength, index) => ({
    strength,
    radius: radius + width * (index + 1),
  }))
  return { center: { ...center }, radius, zones: zones.reverse() }
}

/** The innermost zone at a given distance from the centre, or null outside (17.9). */
export function gravityZoneAtDistance(well: GravityWell, range: number): GravityZone | null {
  let found: GravityZone | null = null
  for (const zone of well.zones) {
    if (range <= zone.radius + EPSILON) found = zone
  }
  return found
}

export function gravityZoneAt(well: GravityWell, point: Point): GravityZone | null {
  return gravityZoneAtDistance(well, distance(well.center, point))
}

/**
 * *"Pause the ship in the innermost zone contacted"* (17.9) — the deepest zone
 * the ship's whole path reaches, not the one it happens to end in.
 */
export function innermostZoneOnPath(
  well: GravityWell,
  path: readonly Point[],
): GravityZone | null {
  return gravityZoneAtDistance(well, distanceToPath(well.center, path))
}

/** 17.9's three cases, as the six arcs of 4.2 can express them. */
export type GravityArc = 'fore' | 'aft' | 'port' | 'starboard'

/**
 * Where the planet's centre lies relative to the ship (17.9).
 *
 * **[reading] 14:** 17.9 names fore, aft and "a port or starboard arc"; the
 * engine has 4.2's six 60° arcs and nothing else. `F` is fore, `A` is aft, and
 * the four beam arcs are the sides — the only mapping that leaves all three of
 * the rule's cases reachable.
 */
export function gravityArc(shipPosition: Point, facing: Course, center: Point): GravityArc {
  const arc: Arc = arcTo(shipPosition, facing, center)
  if (arc === 'F') return 'fore'
  if (arc === 'A') return 'aft'
  return arc === 'FS' || arc === 'AS' ? 'starboard' : 'port'
}

/**
 * How far a ship may argue with a gravity turn (17.9).
 *
 * *"A ship that has unused thrust points for changing course may use them to
 * change the gravity zone turn. In Figure 37, the ship changes course by 2. If
 * it were a ship with thrust 4 drive and had not changed course, it could
 * increase this up to 4 or decrease it down to none."*
 *
 * **[reading] 16:** the printed example is the constraint. Base 2 with thrust 4
 * gives "up to 4", not up to 6, so the ceiling is the greater of the zone
 * strength and the unused thrust rather than their sum; the floor is what the
 * thrust can cancel. When a worked example and an obvious mechanic disagree,
 * the example is the rule.
 */
export function gravityTurnRange(
  zoneStrength: number,
  unusedThrust: number,
): { min: number; max: number } {
  const base = Math.max(0, Math.round(zoneStrength))
  const thrust = Math.max(0, Math.round(unusedThrust))
  return {
    min: Math.max(0, base - thrust),
    max: Math.min(Math.max(base, thrust), base + thrust),
  }
}

export interface GravityEffect {
  zone: GravityZone | null
  arc: GravityArc | null
  /** Velocity after the zone, never below zero (**[reading] 22**). */
  velocity: number
  velocityChange: number
  /** Course change in clock points; positive is to starboard (3.1). */
  turnPoints: number
  facing: Course
  /** Thrust the ship spent arguing with the turn (17.9). */
  thrustSpent: number
  /**
   * *"The ship is considered to make a partial orbit within the zone while
   * changing course, so cannot collide with the planet or enter another zone
   * even if the straight line path would indicate otherwise"* (17.9). A rule,
   * not colour: without it a beam pass at a sun would chain through four zones
   * in one move.
   *
   * **[reading] 23:** the immunity is scoped to *"while changing course"*, so
   * it belongs to the port and starboard branches and to no other. A ship that
   * dives straight at the centre makes no partial orbit — it makes a dive —
   * and 17.9 is not saying that the way to survive a planet is to aim at it.
   * A ship that cancels its turn entirely by spending thrust has bought the
   * same straight line and pays for it the same way.
   */
  shielded: boolean
  /**
   * *"If the ship ends the Ship Movement Phase in a gravity zone, apply the
   * changes in velocity and course to the start of the next turn movement
   * instead"* (17.9).
   */
  timing: 'now' | 'next-turn'
}

/**
 * A ship falling through a gravity zone (17.9).
 *
 * *"• If the center is in the fore arc of the ship, add the zone strength to
 * the ship velocity. • If the center is in the aft arc, subtract the zone
 * strength from velocity. • If the center is in a port or starboard arc, add
 * half the zone strength to the velocity, and turn the ship towards the center
 * by a number of points equal to the strength of the zone."*
 *
 * Pass `path` to find *"the innermost zone contacted"* over the whole move;
 * without it the ship's current position decides. `turnPoints` is the magnitude
 * the player wants after spending thrust, clamped to `gravityTurnRange` — the
 * direction is never the player's, it is always towards the centre.
 *
 * **[reading] 15:** half the zone strength rounds down, so the strength-1 outer
 * zone turns a ship a point and adds no speed at all. **[reading] 22:** an aft
 * pass cannot drive velocity below zero; 3.2 has no reverse.
 */
export function resolveGravityZone(
  ship: { position: Point; facing: Course; velocity: number },
  well: GravityWell,
  opts: {
    path?: readonly Point[]
    endsInZone?: boolean
    turnPoints?: number
    unusedThrust?: number
  } = {},
): GravityEffect {
  const zone = opts.path ? innermostZoneOnPath(well, opts.path) : gravityZoneAt(well, ship.position)
  if (zone === null) {
    return {
      zone: null,
      arc: null,
      velocity: ship.velocity,
      velocityChange: 0,
      turnPoints: 0,
      facing: ship.facing,
      thrustSpent: 0,
      shielded: false,
      timing: 'now',
    }
  }

  const arc = gravityArc(ship.position, ship.facing, well.center)
  let velocityChange = 0
  let magnitude = 0
  if (arc === 'fore') velocityChange = zone.strength
  else if (arc === 'aft') velocityChange = -zone.strength
  else {
    velocityChange = Math.floor(zone.strength / 2)
    magnitude = zone.strength
  }

  let thrustSpent = 0
  if (magnitude > 0 && opts.turnPoints !== undefined) {
    const range = gravityTurnRange(magnitude, opts.unusedThrust ?? 0)
    const wanted = Math.max(range.min, Math.min(range.max, Math.round(opts.turnPoints)))
    thrustSpent = Math.abs(wanted - magnitude)
    magnitude = wanted
  }

  const signed = arc === 'starboard' ? magnitude : arc === 'port' ? -magnitude : 0
  return {
    zone,
    arc,
    velocity: Math.max(0, ship.velocity + velocityChange),
    velocityChange,
    turnPoints: signed,
    facing: turnBy(ship.facing, signed),
    thrustSpent,
    // [reading] 23: no course change, no partial orbit, no immunity.
    shielded: magnitude > 0,
    timing: opts.endsInZone === true ? 'next-turn' : 'now',
  }
}

// ---------------------------------------------------------------------------
// 17.10 The super simple and totally unrealistic way
// ---------------------------------------------------------------------------

/**
 * *"Ships desiring to make orbit must be travelling at a thrust no greater than
 * 8 and no less than 6"* (17.10).
 *
 * **[reading] 17:** "travelling at a thrust" is a velocity. A ship travels at a
 * velocity; a thrust rating is what its drive can change that velocity by
 * (3.2), and the rest of the rule is about where the approach takes the ship.
 */
export const SIMPLE_ORBIT_VELOCITY = { min: 6, max: 8 } as const

/**
 * *"Their course must also bring them within 3" of the objective but no closer
 * than 2". That is the 3" gravity well mentioned earlier"* (17.10).
 *
 * **[reading] 18:** the inch marks are MU. 17.10 is the only place in section
 * 17 that measures in inches, and one MU is one inch on a standard table (2.1).
 */
export const SIMPLE_ORBIT_BAND = { inner: 2, outer: 3 } as const

export type SimpleOrbitOutcome = 'orbit' | 'flies-past' | 'destroyed'

/**
 * The whole of 17.10 in one function.
 *
 * *"If the ship is beyond the 3" it will go past the objective and not make
 * orbit. If it is closer than 2" it will be caught in the gravity well and
 * crash (i.e. it is destroyed). Remember all measurements are taken from the
 * model's stem."*
 *
 * Both band edges are inclusive: the failure clauses are strictly *"beyond the
 * 3""* and *"closer than 2""*, so exactly 2 and exactly 3 both make orbit.
 *
 * **[reading] 19:** the crash is keyed to distance alone, so a ship at the
 * wrong speed still dies inside 2 MU; in the safe band at the wrong speed it
 * simply flies past, since those are the only two failures 17.10 names.
 */
export function simpleOrbitApproach(
  velocity: number,
  closestApproach: number,
): SimpleOrbitOutcome {
  if (closestApproach < SIMPLE_ORBIT_BAND.inner - EPSILON) return 'destroyed'
  if (closestApproach > SIMPLE_ORBIT_BAND.outer + EPSILON) return 'flies-past'
  if (velocity < SIMPLE_ORBIT_VELOCITY.min || velocity > SIMPLE_ORBIT_VELOCITY.max) {
    return 'flies-past'
  }
  return 'orbit'
}

// ---------------------------------------------------------------------------
// 17.11 Atmospheric entry
// ---------------------------------------------------------------------------

/** How badly the main drive is hurt, on 4.11's two-step ladder. */
export type DriveCondition = 'intact' | 'damaged' | 'knocked-out'

/**
 * *"• If the ship is non-streamlined, add 4. • If partially streamlined, no
 * modifier. • If fully streamlined, subtract 2."* (17.11)
 *
 * The fit itself is 13.11's: partial costs 5% of the ship's mass, full 10%.
 */
export const STREAMLINING_ENTRY_DRM: Record<Streamlining, number> = {
  none: 4,
  partial: 0,
  full: -2,
}

/**
 * *"Add 1 if the ship's drive is damaged (half normal thrust), or add 3 if
 * drive knocked-out"* (17.11) — 4.11's first and second drive hits.
 */
export const DRIVE_ENTRY_DRM: Record<DriveCondition, number> = {
  intact: 0,
  damaged: 1,
  'knocked-out': 3,
}

export interface AtmosphericEntryInput {
  streamlining: Streamlining
  /** Velocity on entry. */
  velocity?: number
  /** The world's orbital velocity (17.8); the excess is what costs. */
  orbitalVelocity?: number
  drive?: DriveCondition
}

/**
 * The modifiers on an uncontrolled entry (17.11), summed.
 *
 * *"Add 1 for every 1 point of velocity in excess of entry orbital velocity"* —
 * excess only, so arriving slow costs nothing extra; the slow arrival is what
 * put the ship here in the first place (17.8's decaying orbit).
 */
export function atmosphericEntryDrm(input: AtmosphericEntryInput): number {
  const excess = Math.max(0, (input.velocity ?? 0) - (input.orbitalVelocity ?? 0))
  return (
    STREAMLINING_ENTRY_DRM[input.streamlining] +
    excess +
    DRIVE_ENTRY_DRM[input.drive ?? 'intact']
  )
}

/** 17.11's three outcomes. */
export type AtmosphericEntryOutcome = 'crash-lands' | 'burns-up-crew-escape' | 'burns-up'

export interface AtmosphericEntryResult {
  drm: number
  roll: number
  modified: number
  outcome: AtmosphericEntryOutcome
}

/**
 * A ship falling into atmosphere without meaning to (17.11).
 *
 * *"On a final result of 2 or less, the ship manages to miraculously survive a
 * ballistic entry, and crash-lands on the planetary surface. … On a final score
 * of 3 to 5, the ship burns up in the upper atmosphere, but there is enough
 * time for any interface craft (shuttles, drop ships, etc.), fighters, or life
 * pods on board to launch. … On a final score of 6 or above, the ship burns up
 * and all crew, passengers, and equipment on board are lost."*
 *
 * Do the arithmetic before trusting the odds. A non-streamlined hull starts at
 * +4 on a D6, so its best possible total is 5 and it can never crash-land: it
 * is dead, and the only question is whether the fighters get off. Even a fully
 * streamlined ship at −2 needs a 4 or less once it is two points over orbital
 * velocity.
 */
export function resolveAtmosphericEntry(
  input: AtmosphericEntryInput,
  rng: Rng,
): AtmosphericEntryResult {
  const drm = atmosphericEntryDrm(input)
  const roll = d6(rng)
  const modified = roll + drm
  const outcome: AtmosphericEntryOutcome =
    modified <= 2 ? 'crash-lands' : modified <= 5 ? 'burns-up-crew-escape' : 'burns-up'
  return { drm, roll, modified, outcome }
}

export type LandingOutcome = 'lands' | 'crash-landing' | 'uncontrolled-entry'

export interface LandingResult {
  outcome: LandingOutcome
  reason: string
}

/**
 * Putting a ship down on purpose (17.11).
 *
 * *"To make a deliberate safe atmospheric entry, a ship must first enter orbit
 * as described above and then decelerate to less than orbital velocity. A fully
 * streamlined (capable of aero braking or gliding) ship can land provided it
 * has some main drive thrust. A partially streamlined ship can land if it has
 * main drive thrust at least equal to the planet gravity in Earth Gs; if it has
 * insufficient thrust it will make a crash landing with the effects being up to
 * the individual scenario."*
 *
 * Note how cheap full streamlining makes this: *"some main drive thrust"* is
 * any thrust at all, on any world, while a partially streamlined hull has to
 * out-push the gravity it is landing in. That is what 13.11's extra 5% of mass
 * buys.
 *
 * `uncontrolled-entry` means the ship has no deliberate entry available and
 * falls to `resolveAtmosphericEntry` instead. What a crash landing costs is
 * *"up to the individual scenario"*, twice over, so it is reported and not
 * resolved.
 */
export function deliberateLanding(input: {
  streamlining: Streamlining
  /** Main drive thrust actually available (4.11 may have halved it). */
  thrust: number
  /** The world's surface gravity in Earth Gs — a scenario property. */
  gravityG?: number
  /** Whether the ship has decelerated below orbital velocity (17.8). */
  belowOrbitalVelocity: boolean
}): LandingResult {
  if (input.streamlining === 'none') {
    return {
      outcome: 'uncontrolled-entry',
      reason: 'only a fully or partially streamlined ship may enter atmosphere deliberately (17.11)',
    }
  }
  if (!input.belowOrbitalVelocity) {
    return {
      outcome: 'uncontrolled-entry',
      reason: 'a ship must enter orbit and decelerate below orbital velocity first (17.11)',
    }
  }
  if (input.streamlining === 'full') {
    return input.thrust > 0
      ? { outcome: 'lands', reason: '' }
      : { outcome: 'crash-landing', reason: 'a fully streamlined ship needs some main drive thrust (17.11)' }
  }
  const gravity = input.gravityG ?? 1
  return input.thrust >= gravity
    ? { outcome: 'lands', reason: '' }
    : {
        outcome: 'crash-landing',
        reason: `partial streamlining needs thrust of at least the planet's ${gravity}G (17.11)`,
      }
}
