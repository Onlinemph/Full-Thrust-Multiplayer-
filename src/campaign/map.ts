/**
 * Stellar Imperium — the star map: hex geometry, FTL paths, and the system
 * generator of 6.2.1.
 *
 * One hex is one parsec (Scale) and hexes are stored in axial coordinates, so
 * distance is arithmetic and a hex is two integers in a save file rather than a
 * pair of screen positions. Nothing here draws anything.
 *
 * The generator is `campaign.md`'s tables and nothing else. The tables are
 * transcribed as data, ranges included, so they can be read against the book —
 * including the two ranges the source gives Terran worlds, 01–20 and 92–100.
 *
 * **The order rolls are drawn in is part of the replay contract.** A campaign
 * replays by re-running its moves over the same seeded stream, so a change to
 * which die is drawn first silently rewrites every existing campaign. Add rolls
 * at the end of a sequence, never in the middle.
 */

import {
  rollD100,
  rollD6,
  type Hex,
  type HexKey,
  type PlanetaryBody,
  type PlanetTrait,
  type PlanetType,
  type RandomStream,
  type StarMap,
  type StarSystem,
  type SystemFeature,
  type SystemId,
} from './types'

// ---------------------------------------------------------------------------
// Hex geometry
// ---------------------------------------------------------------------------

/** A hex flattened to its record key, `"q,r"` (see `StarMap.systems`). */
export function hexKey(hex: Hex): HexKey {
  return `${hex.q},${hex.r}`
}

/** The inverse of `hexKey`; throws on anything that is not one. */
export function parseHexKey(key: HexKey): Hex {
  const [q, r] = key.split(',').map(Number)
  if (!Number.isFinite(q) || !Number.isFinite(r)) throw new Error(`Not a hex key: ${key}`)
  return { q, r }
}

/** Two hexes are the same hex. */
export function hexEquals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r
}

/** Vector addition, for stepping a hex in a direction. */
export function hexAdd(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r }
}

/**
 * The six axial directions, clockwise from due east. A hex map has no "up", so
 * the order is a convention — it is fixed only so that `hexNeighbours` returns
 * the same order every time and a replay that iterates neighbours is stable.
 */
export const HEX_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

/** The hex one step from `hex` in direction `index` (0–5, see HEX_DIRECTIONS). */
export function hexNeighbour(hex: Hex, index: number): Hex {
  const dir = HEX_DIRECTIONS[((index % 6) + 6) % 6]
  return hexAdd(hex, dir)
}

/** All six adjacent hexes, in `HEX_DIRECTIONS` order. */
export function hexNeighbours(hex: Hex): Hex[] {
  return HEX_DIRECTIONS.map((dir) => hexAdd(hex, dir))
}

/**
 * Distance in hexes — the number of parsecs an FTL move has to cover (6.1).
 * Axial distance through the cube identity `s = -q - r`.
 */
export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  const ds = -dq - dr
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds))
}

/** Adjacency, which is what "may only be entered from an adjacent hex" tests (6.1). */
export function hexAreAdjacent(a: Hex, b: Hex): boolean {
  return hexDistance(a, b) === 1
}

/** The ring of hexes exactly `radius` from `centre`; radius 0 is the centre itself. */
export function hexRing(centre: Hex, radius: number): Hex[] {
  if (radius <= 0) return [{ ...centre }]
  const out: Hex[] = []
  // Walk out along one direction, then round the six sides of the ring.
  let hex = hexAdd(centre, { q: HEX_DIRECTIONS[4].q * radius, r: HEX_DIRECTIONS[4].r * radius })
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      out.push(hex)
      hex = hexNeighbour(hex, side)
    }
  }
  return out
}

/** Every hex within `radius` of `centre`, centre included. */
export function hexesWithin(centre: Hex, radius: number): Hex[] {
  const out: Hex[] = []
  for (let q = -radius; q <= radius; q++) {
    const from = Math.max(-radius, -q - radius)
    const to = Math.min(radius, -q + radius)
    for (let r = from; r <= to; r++) out.push({ q: centre.q + q, r: centre.r + r })
  }
  return out
}

/**
 * Round a fractional cube coordinate to the hex it lies in. Used only by
 * `hexPath`; the two are kept together because the rounding rule *is* the path.
 */
function cubeRound(q: number, r: number): Hex {
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  return { q: rq, r: rr }
}

/**
 * The hexes an FTL move passes through, from `from` to `to` inclusive (6.1).
 *
 * A line that runs exactly along a hex edge could round either way, and a
 * campaign that rounded it differently on a replay would move a fleet through a
 * different system — so the interpolation is nudged by a tiny epsilon, the same
 * trick `geometry.rangeBand` uses on a range that lands exactly on a band
 * boundary. The nudge decides the tie once, here, for good.
 */
export function hexPath(from: Hex, to: Hex): Hex[] {
  const steps = hexDistance(from, to)
  if (steps === 0) return [{ ...from }]
  const epsilon = 1e-6
  const out: Hex[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const q = from.q + (to.q - from.q + epsilon) * t
    const r = from.r + (to.r - from.r + epsilon) * t
    out.push(cubeRound(q, r))
  }
  return out
}

/** True when every consecutive pair of a path is adjacent — a plot that flies. */
export function isContiguousPath(path: readonly Hex[]): boolean {
  for (let i = 1; i < path.length; i++) {
    if (!hexAreAdjacent(path[i - 1], path[i])) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// FTL movement (6.1)
// ---------------------------------------------------------------------------

/** Base FTL rate, in hexes a turn (6.1). */
export const BASE_FTL_RATE = 2

/** The fastest FTL research can buy (6.1, and the ship-speed table in 8). */
export const MAX_FTL_RATE = 8

/**
 * Split a path into the hexes travelled each turn (6.1).
 *
 * A turn buys `rate` hexes of clear space. A gas or dust cloud costs a full
 * turn per hex inside, and may only be entered from an adjacent hex — read here
 * as: the step into the cloud must be the first step of a turn, so a fleet that
 * has already moved this turn waits on the threshold and enters next turn.
 * Leaving a cloud is at normal speed, so the hex *out* of a cloud costs one
 * hex of the turn's rate like any other.
 *
 * The first entry of `path` is where the force starts and is not part of any
 * leg; each returned leg is the hexes entered on that turn.
 */
export function ftlLegs(
  path: readonly Hex[],
  rate: number,
  isNebula: (hex: Hex) => boolean,
): Hex[][] {
  if (rate < 1) throw new Error(`FTL rate must be at least 1 hex a turn, got ${rate}`)
  const legs: Hex[][] = []
  let index = 0
  while (index < path.length - 1) {
    const leg: Hex[] = []
    let points = rate
    while (points > 0 && index < path.length - 1) {
      const next = path[index + 1]
      if (isNebula(next)) {
        if (leg.length > 0) break
        leg.push(next)
        index += 1
        points = 0
      } else {
        leg.push(next)
        index += 1
        points -= 1
      }
    }
    legs.push(leg)
  }
  return legs
}

/** Turns a path takes at a given FTL rate (6.1). */
export function ftlTurnsForPath(
  path: readonly Hex[],
  rate: number,
  isNebula: (hex: Hex) => boolean,
): number {
  return ftlLegs(path, rate, isNebula).length
}

// ---------------------------------------------------------------------------
// Command posts (6.1)
// ---------------------------------------------------------------------------

/**
 * "Ships other than scouts may not move further than 8 hexes from a friendly
 * command post" (6.1). Command posts are free and may be established on any
 * controlled colony; the home system has one from the start.
 */
export const MAX_HEXES_FROM_COMMAND_POST = 8

/** Distance to the nearest friendly command post, or null if there are none. */
export function distanceToCommandPost(hex: Hex, posts: readonly Hex[]): number | null {
  let best: number | null = null
  for (const post of posts) {
    const distance = hexDistance(hex, post)
    if (best === null || distance < best) best = distance
  }
  return best
}

/** Whether a hex is inside the 8-hex command radius of any friendly post (6.1). */
export function withinCommandRange(hex: Hex, posts: readonly Hex[]): boolean {
  const distance = distanceToCommandPost(hex, posts)
  return distance !== null && distance <= MAX_HEXES_FROM_COMMAND_POST
}

/**
 * Whether a task force may be at a hex at all (6.1). A scout may go anywhere;
 * everything else must stay within 8 hexes of a friendly command post — which
 * means a player with no command post anywhere may move nothing but scouts.
 */
export function mayOccupyHex(hex: Hex, posts: readonly Hex[], scout: boolean): boolean {
  return scout || withinCommandRange(hex, posts)
}

/**
 * Check a whole plotted path against the command-post limit (6.1). The limit is
 * on where a force *is*, so every hex it passes through has to be legal, not
 * just the destination. Returns the first illegal hex, or null if the path is
 * legal throughout.
 */
export function firstHexOutOfCommandRange(
  path: readonly Hex[],
  posts: readonly Hex[],
  scout: boolean,
): Hex | null {
  if (scout) return null
  for (const hex of path) {
    if (!withinCommandRange(hex, posts)) return hex
  }
  return null
}

// ---------------------------------------------------------------------------
// The system generation tables (6.2.1)
// ---------------------------------------------------------------------------

/**
 * One row of a d100 table: the inclusive range as the book prints it, and what
 * it gives. The book writes a hundredth roll as "00"; `rollD100` returns 100,
 * so `91–00` is stored as 91–100.
 */
export interface D100Row<T> {
  min: number
  max: number
  value: T
}

/** Look a roll up in a d100 table. Rolls off the end take the last row. */
export function lookupD100<T>(table: readonly D100Row<T>[], roll: number): T {
  for (const row of table) {
    if (roll >= row.min && roll <= row.max) return row.value
  }
  return table[table.length - 1].value
}

/**
 * System features (6.2.1, d100).
 *
 * | 01–60 Standard | 61–75 Gas/dust cloud | 76–90 Dense asteroid field |
 * | 91–00 Binary/trinary star |
 */
export const SYSTEM_FEATURE_TABLE: readonly D100Row<SystemFeature>[] = [
  { min: 1, max: 60, value: 'standard' },
  { min: 61, max: 75, value: 'nebula' },
  { min: 76, max: 90, value: 'dense-asteroid-field' },
  { min: 91, max: 100, value: 'multiple-star' },
]

/**
 * Planet types (6.2.1, d100).
 *
 * Terran has two ranges in the source — 01–20 and 92–100 — which is
 * transcribed as printed rather than tidied into one, because the tidying
 * would be a rules change and the two ranges are what the book rolls on.
 */
export const PLANET_TYPE_TABLE: readonly D100Row<PlanetType>[] = [
  { min: 1, max: 20, value: 'terran' },
  { min: 21, max: 31, value: 'sub-terran' },
  { min: 32, max: 42, value: 'minimal-terran' },
  { min: 43, max: 56, value: 'barren' },
  { min: 57, max: 89, value: 'gas-giant' },
  { min: 90, max: 91, value: 'special-anomaly' },
  { min: 92, max: 100, value: 'terran' },
]

/**
 * Planet traits (6.2.1, d100, +20 in a dense asteroid field).
 *
 * | 01–70 None | 71–82 Mineral rich | 83–88 Biologically rich |
 * | 89–94 Hazardous | 95–98 Ancient ruins | 99–00 Unique |
 */
export const PLANET_TRAIT_TABLE: readonly D100Row<PlanetTrait>[] = [
  { min: 1, max: 70, value: 'none' },
  { min: 71, max: 82, value: 'mineral-rich' },
  { min: 83, max: 88, value: 'biologically-rich' },
  { min: 89, max: 94, value: 'hazardous' },
  { min: 95, max: 98, value: 'ancient-ruins' },
  { min: 99, max: 100, value: 'unique' },
]

/** A dense asteroid field adds 20 to every planet trait roll in the system (6.2.1). */
export const DENSE_ASTEROID_TRAIT_DRM = 20

/** The system feature a d100 gives (6.2.1). */
export function systemFeatureForRoll(roll: number): SystemFeature {
  return lookupD100(SYSTEM_FEATURE_TABLE, roll)
}

/** The planet type a d100 gives (6.2.1). */
export function planetTypeForRoll(roll: number): PlanetType {
  return lookupD100(PLANET_TYPE_TABLE, roll)
}

/**
 * The planet trait a d100 gives (6.2.1). The roll is clamped to the table: a
 * dense asteroid field's +20 can push a 99 to 119, which is still Unique.
 */
export function planetTraitForRoll(roll: number): PlanetTrait {
  return lookupD100(PLANET_TRAIT_TABLE, Math.max(1, Math.min(100, roll)))
}

/** Planetary bodies from one 1d6: 1–4 gives 1 body, 5 gives 2, 6 gives 3 (6.2.1). */
export function bodyCountForRoll(die: number): number {
  if (die >= 6) return 3
  if (die === 5) return 2
  return 1
}

/** A gas giant's moons: 1d6 − 3, minimum 0, each a new body (6.2.1). */
export function moonCountForRoll(die: number): number {
  return Math.max(0, die - 3)
}

/** Gas giants cannot be colonised (6.2.1); a special anomaly is the GM's to rule on. */
export function isColonisable(type: PlanetType): boolean {
  return type === 'terran' || type === 'sub-terran' || type === 'minimal-terran' || type === 'barren'
}

/** A barren world needs Controlled Environment Technology to colonise (6.2.1). */
export function requiresControlledEnvironment(type: PlanetType): boolean {
  return type === 'barren'
}

// ---------------------------------------------------------------------------
// The system generator (6.2.1)
// ---------------------------------------------------------------------------

/** Roll the system feature (6.2.1). */
export function rollSystemFeature(stream: RandomStream): SystemFeature {
  return systemFeatureForRoll(rollD100(stream))
}

/**
 * Roll the number of planetary bodies (6.2.1): one 1d6 through the body table,
 * and for a binary or trinary star "an additional 1d6 planetary bodies" — read
 * as a second roll on the same table, which is the table the phrase names, and
 * added to the first.
 */
export function rollBodyCount(stream: RandomStream, feature: SystemFeature): number {
  let count = bodyCountForRoll(rollD6(stream))
  if (feature === 'multiple-star') count += bodyCountForRoll(rollD6(stream))
  return count
}

/** Roll a planet type (6.2.1). */
export function rollPlanetType(stream: RandomStream): PlanetType {
  return planetTypeForRoll(rollD100(stream))
}

/**
 * Roll a planet trait (6.2.1), at +20 if the system is a dense asteroid field.
 * Gas giants do not roll — the instruction is "d100 per non-gas-giant for a
 * trait" — so `generateSystem` never calls this for one.
 */
export function rollPlanetTrait(stream: RandomStream, feature: SystemFeature): PlanetTrait {
  const natural = rollD100(stream)
  const drm = feature === 'dense-asteroid-field' ? DENSE_ASTEROID_TRAIT_DRM : 0
  return planetTraitForRoll(natural + drm)
}

/** Roman numerals for body names — planets are numbered, moons are lettered. */
function roman(n: number): string {
  const numerals: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let rest = n
  let out = ''
  for (const [value, numeral] of numerals) {
    while (rest >= value) {
      out += numeral
      rest -= value
    }
  }
  return out
}

/** What `generateSystem` needs that the dice do not decide. */
export interface SystemGenerationOptions {
  id: SystemId
  name: string
  hex: Hex
}

/**
 * Generate one system (6.2.1) — feature, bodies, types, moons and traits.
 *
 * Rolls are drawn in the order the section states them: the feature, the body
 * count, then for each body its type, and for a gas giant its moons before the
 * next body is rolled. A gas giant moon that is itself a gas giant carries no
 * moons of its own — the rule makes moons "a new body" with no stated floor, so
 * the recursion is stopped at one level rather than left unbounded.
 */
export function generateSystem(stream: RandomStream, opts: SystemGenerationOptions): StarSystem {
  const feature = rollSystemFeature(stream)
  const count = rollBodyCount(stream, feature)

  const bodies: PlanetaryBody[] = []
  for (let i = 0; i < count; i++) {
    const id = `${opts.id}-b${i + 1}`
    const name = `${opts.name} ${roman(i + 1)}`
    const type = rollPlanetType(stream)
    const body: PlanetaryBody = {
      id,
      name,
      type,
      trait: type === 'gas-giant' ? 'none' : rollPlanetTrait(stream, feature),
      parentId: null,
      colonyId: null,
    }
    bodies.push(body)
    if (type !== 'gas-giant') continue

    const moons = moonCountForRoll(rollD6(stream))
    for (let m = 0; m < moons; m++) {
      const moonType = rollPlanetType(stream)
      bodies.push({
        id: `${id}-m${m + 1}`,
        name: `${name}-${String.fromCharCode(97 + m)}`,
        type: moonType,
        trait: moonType === 'gas-giant' ? 'none' : rollPlanetTrait(stream, feature),
        parentId: id,
        colonyId: null,
      })
    }
  }

  return {
    id: opts.id,
    name: opts.name,
    hex: opts.hex,
    feature,
    bodies,
    exploredBy: [],
    counterEspionage: {},
  }
}

/** What `generateStarMap` needs that the dice do not decide. */
export interface StarMapOptions {
  /** Hexes that hold a star. `campaign.md` states no map-layout rule, so this
   *  comes from the campaign setup, not from a die. */
  starHexes: readonly Hex[]
  /** Hexes within this distance of the origin are on the map. */
  radius: number
  /** System names, by index into `starHexes`. */
  nameFor?: (hex: Hex, index: number) => string
}

/**
 * Generate every system on a map (6.2.1), in the order `starHexes` lists them —
 * which fixes the order rolls are drawn in, and so the map a seed produces.
 */
export function generateStarMap(stream: RandomStream, opts: StarMapOptions): StarMap {
  const systems: Record<HexKey, StarSystem> = {}
  opts.starHexes.forEach((hex, index) => {
    const name = opts.nameFor?.(hex, index) ?? `System ${index + 1}`
    systems[hexKey(hex)] = generateSystem(stream, { id: `sys-${index + 1}`, name, hex })
  })
  return { radius: opts.radius, systems }
}

/** The system in a hex, if there is one. */
export function systemAt(map: StarMap, hex: Hex): StarSystem | undefined {
  return map.systems[hexKey(hex)]
}

/** Whether a hex is a gas or dust cloud — the shape `ftlLegs` asks for (6.1). */
export function nebulaLookup(map: StarMap): (hex: Hex) => boolean {
  return (hex) => systemAt(map, hex)?.feature === 'nebula'
}
