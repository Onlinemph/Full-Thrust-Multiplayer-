/**
 * The star map: hex geometry, FTL paths, the command-post limit and the system
 * generation tables of 6.2.1.
 *
 * The tables are the tests that matter — every boundary in `campaign.md` is
 * asserted here, including the two ranges the source gives Terran worlds — and
 * next to them sit the determinism tests, because a campaign that generated a
 * different map on a replay would not be a campaign at all.
 */

import { describe, expect, it } from 'vitest'
import {
  BASE_FTL_RATE,
  bodyCountForRoll,
  DENSE_ASTEROID_TRAIT_DRM,
  distanceToCommandPost,
  firstHexOutOfCommandRange,
  ftlLegs,
  ftlTurnsForPath,
  generateStarMap,
  generateSystem,
  hexAreAdjacent,
  hexDistance,
  hexEquals,
  hexesWithin,
  hexKey,
  hexNeighbours,
  hexPath,
  hexRing,
  isColonisable,
  isContiguousPath,
  MAX_FTL_RATE,
  MAX_HEXES_FROM_COMMAND_POST,
  mayOccupyHex,
  moonCountForRoll,
  nebulaLookup,
  parseHexKey,
  planetTraitForRoll,
  planetTypeForRoll,
  requiresControlledEnvironment,
  rollBodyCount,
  rollPlanetTrait,
  systemAt,
  systemFeatureForRoll,
} from './map'
import {
  draw,
  rollD100,
  rollD6,
  rollDice,
  rollDie,
  sampleAt,
  type Hex,
  type RandomStream,
} from './types'

// ---------------------------------------------------------------------------
// Dice a test can predict
// ---------------------------------------------------------------------------

/**
 * The first seed whose stream satisfies `predicate`. The campaign's die is
 * counter-based, so a test cannot hand it faces the way `ScriptedRng` does in
 * the tactical tests — it goes looking for a seed that rolls what it needs
 * instead, which exercises the real generator rather than a stand-in.
 */
function seedWhere(predicate: (stream: RandomStream) => boolean): number {
  for (let seed = 1; seed < 500_000; seed++) {
    if (predicate({ seed, cursor: 0 })) return seed
  }
  throw new Error('No seed satisfies the predicate')
}

const hex = (q: number, r: number): Hex => ({ q, r })

// ---------------------------------------------------------------------------
// The seeded stream
// ---------------------------------------------------------------------------

describe('the campaign stream', () => {
  it('depends on nothing but seed and position', () => {
    expect(sampleAt(12345, 7)).toBe(sampleAt(12345, 7))
    expect(sampleAt(12345, 7)).not.toBe(sampleAt(12345, 8))
    expect(sampleAt(12345, 7)).not.toBe(sampleAt(12346, 7))
  })

  it('advances the position it is given, and nothing else', () => {
    const stream: RandomStream = { seed: 99, cursor: 0 }
    const first = draw(stream)
    expect(stream.cursor).toBe(1)
    expect(first).toBe(sampleAt(99, 0))
    expect(draw(stream)).toBe(sampleAt(99, 1))
    expect(stream.cursor).toBe(2)
  })

  it('replays from a saved position', () => {
    const original: RandomStream = { seed: 4242, cursor: 0 }
    const rolls = rollDice(20, 100, original)
    // A campaign loaded from a file is exactly this: the same seed and the
    // cursor it was saved at.
    const resumed: RandomStream = { seed: 4242, cursor: 0 }
    expect(rollDice(20, 100, resumed)).toEqual(rolls)
    expect(resumed.cursor).toBe(original.cursor)
  })

  it('rolls dice inside their faces, and covers them', () => {
    const stream: RandomStream = { seed: 7, cursor: 0 }
    const seen = new Set<number>()
    for (let i = 0; i < 20_000; i++) {
      const roll = rollD100(stream)
      expect(roll).toBeGreaterThanOrEqual(1)
      expect(roll).toBeLessThanOrEqual(100)
      seen.add(roll)
    }
    expect(seen.size).toBe(100)

    const d6s = rollDice(6000, 6, { seed: 11, cursor: 0 })
    expect(Math.min(...d6s)).toBe(1)
    expect(Math.max(...d6s)).toBe(6)
    const mean = d6s.reduce((a, b) => a + b, 0) / d6s.length
    expect(mean).toBeGreaterThan(3.2)
    expect(mean).toBeLessThan(3.8)
  })

  it('rolls a die of any size', () => {
    const stream: RandomStream = { seed: 3, cursor: 0 }
    for (let i = 0; i < 500; i++) {
      const roll = rollDie(20, stream)
      expect(roll).toBeGreaterThanOrEqual(1)
      expect(roll).toBeLessThanOrEqual(20)
    }
  })
})

// ---------------------------------------------------------------------------
// Hex geometry
// ---------------------------------------------------------------------------

describe('hex geometry', () => {
  it('round-trips a hex through its key', () => {
    for (const h of [hex(0, 0), hex(3, -4), hex(-12, 7)]) {
      expect(parseHexKey(hexKey(h))).toEqual(h)
    }
    expect(() => parseHexKey('not-a-hex')).toThrow()
  })

  it('measures distance in parsecs', () => {
    expect(hexDistance(hex(0, 0), hex(0, 0))).toBe(0)
    expect(hexDistance(hex(0, 0), hex(3, 0))).toBe(3)
    expect(hexDistance(hex(0, 0), hex(0, -3))).toBe(3)
    // Axial (2, -1) is two steps east and one north-east on the cube axes.
    expect(hexDistance(hex(0, 0), hex(2, -1))).toBe(2)
    expect(hexDistance(hex(-2, 5), hex(1, 1))).toBe(4)
  })

  it('gives six neighbours, each one hex away', () => {
    const neighbours = hexNeighbours(hex(2, -3))
    expect(neighbours).toHaveLength(6)
    expect(new Set(neighbours.map(hexKey)).size).toBe(6)
    for (const n of neighbours) {
      expect(hexDistance(hex(2, -3), n)).toBe(1)
      expect(hexAreAdjacent(hex(2, -3), n)).toBe(true)
    }
  })

  it('rings and discs are the shapes hex maps have', () => {
    for (let radius = 1; radius <= 5; radius++) {
      const ring = hexRing(hex(1, 1), radius)
      expect(ring).toHaveLength(6 * radius)
      for (const h of ring) expect(hexDistance(hex(1, 1), h)).toBe(radius)
      expect(new Set(ring.map(hexKey)).size).toBe(6 * radius)

      const disc = hexesWithin(hex(1, 1), radius)
      expect(disc).toHaveLength(1 + 3 * radius * (radius + 1))
      for (const h of disc) expect(hexDistance(hex(1, 1), h)).toBeLessThanOrEqual(radius)
    }
    expect(hexRing(hex(0, 0), 0)).toEqual([hex(0, 0)])
  })

  it('draws a contiguous path that starts and ends where it was told', () => {
    const pairs: Array<[Hex, Hex]> = [
      [hex(0, 0), hex(4, 0)],
      [hex(0, 0), hex(3, -6)],
      [hex(-2, 4), hex(5, -3)],
      [hex(7, 7), hex(7, 7)],
      [hex(0, 0), hex(2, -1)],
    ]
    for (const [from, to] of pairs) {
      const path = hexPath(from, to)
      expect(hexEquals(path[0], from)).toBe(true)
      expect(hexEquals(path[path.length - 1], to)).toBe(true)
      expect(path).toHaveLength(hexDistance(from, to) + 1)
      expect(isContiguousPath(path)).toBe(true)
    }
  })

  it('draws the same path every time, edge cases included', () => {
    // A line straight down a hex edge is the case that could round either way;
    // the epsilon settles it, and it has to settle it the same way for ever.
    const ties: Array<[Hex, Hex]> = [
      [hex(0, 0), hex(2, -1)],
      [hex(0, 0), hex(-2, 1)],
      [hex(0, 0), hex(1, -2)],
      [hex(0, 0), hex(3, -3)],
    ]
    for (const [from, to] of ties) {
      expect(hexPath(from, to)).toEqual(hexPath(from, to))
    }
    // Which way the tie falls is arbitrary; that it always falls the same way
    // is not, so the answer is written down here.
    expect(hexPath(hex(0, 0), hex(2, -1)).map(hexKey)).toEqual(['0,0', '1,0', '2,-1'])
  })
})

// ---------------------------------------------------------------------------
// FTL movement (6.1)
// ---------------------------------------------------------------------------

describe('FTL movement (6.1)', () => {
  const clear = (): boolean => false

  it('starts at 2 hexes a turn and stops at 8', () => {
    expect(BASE_FTL_RATE).toBe(2)
    expect(MAX_FTL_RATE).toBe(8)
  })

  it('spends a turn per rate hexes of clear space', () => {
    const path = hexPath(hex(0, 0), hex(5, 0))
    expect(ftlTurnsForPath(path, 2, clear)).toBe(3)
    expect(ftlLegs(path, 2, clear).map((leg) => leg.length)).toEqual([2, 2, 1])
    expect(ftlTurnsForPath(path, 5, clear)).toBe(1)
    expect(ftlTurnsForPath(path, 8, clear)).toBe(1)
    expect(ftlTurnsForPath(hexPath(hex(0, 0), hex(0, 0)), 2, clear)).toBe(0)
  })

  it('refuses a rate that cannot move', () => {
    expect(() => ftlLegs(hexPath(hex(0, 0), hex(1, 0)), 0, clear)).toThrow()
  })

  it('costs a full turn per hex inside a cloud, and is entered from adjacent only', () => {
    // Hexes 2 and 3 of a five-hex run are cloud.
    const path = hexPath(hex(0, 0), hex(4, 0))
    const cloud = (h: Hex): boolean => h.q === 2 || h.q === 3
    const legs = ftlLegs(path, 3, cloud).map((leg) => leg.map((h) => h.q))

    // Turn 1 covers hex 1 and then stops on the threshold: the cloud may only
    // be entered from an adjacent hex, and the fleet has already moved.
    expect(legs[0]).toEqual([1])
    // Turn 2 enters the cloud and that is the whole turn. So does turn 3.
    expect(legs[1]).toEqual([2])
    expect(legs[2]).toEqual([3])
    // Turn 4 leaves at normal speed.
    expect(legs[3]).toEqual([4])
    expect(legs).toHaveLength(4)
  })

  it('leaves a cloud at normal speed', () => {
    // The force starts inside the cloud; only the hex it starts in is cloud.
    const path = hexPath(hex(0, 0), hex(3, 0))
    const cloud = (h: Hex): boolean => h.q === 0
    expect(ftlLegs(path, 3, cloud).map((leg) => leg.length)).toEqual([3])
  })

  it('reads cloud hexes off the map', () => {
    const stream: RandomStream = { seed: 5150, cursor: 0 }
    const map = generateStarMap(stream, { radius: 3, starHexes: [hex(0, 0), hex(1, 0)] })
    const isNebula = nebulaLookup(map)
    expect(isNebula(hex(0, 0))).toBe(systemAt(map, hex(0, 0))?.feature === 'nebula')
    // A hex with no system in it is empty space, not a cloud.
    expect(isNebula(hex(9, 9))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Command posts (6.1)
// ---------------------------------------------------------------------------

describe('the command-post limit (6.1)', () => {
  const posts = [hex(0, 0), hex(10, 0)]

  it('is eight hexes', () => {
    expect(MAX_HEXES_FROM_COMMAND_POST).toBe(8)
  })

  it('measures to the nearest friendly post', () => {
    expect(distanceToCommandPost(hex(9, 0), posts)).toBe(1)
    expect(distanceToCommandPost(hex(0, 0), [])).toBeNull()
  })

  it('lets a fleet out to eight hexes and no further', () => {
    expect(mayOccupyHex(hex(8, 0), [hex(0, 0)], false)).toBe(true)
    expect(mayOccupyHex(hex(9, 0), [hex(0, 0)], false)).toBe(false)
    expect(mayOccupyHex(hex(0, -8), [hex(0, 0)], false)).toBe(true)
  })

  it('lets a scout go anywhere, including where there is no post at all', () => {
    expect(mayOccupyHex(hex(40, -20), [hex(0, 0)], true)).toBe(true)
    expect(mayOccupyHex(hex(1, 0), [], true)).toBe(true)
    expect(mayOccupyHex(hex(1, 0), [], false)).toBe(false)
  })

  it('checks the whole plot, not just where it ends', () => {
    // Out to 9 hexes and back inside: the destination is legal, the path is not.
    const out = hexPath(hex(0, 0), hex(9, 0))
    const back = hexPath(hex(9, 0), hex(6, 0)).slice(1)
    const path = [...out, ...back]
    expect(mayOccupyHex(path[path.length - 1], [hex(0, 0)], false)).toBe(true)
    expect(firstHexOutOfCommandRange(path, [hex(0, 0)], false)).toEqual(hex(9, 0))
    expect(firstHexOutOfCommandRange(path, [hex(0, 0)], true)).toBeNull()
    expect(firstHexOutOfCommandRange(hexPath(hex(0, 0), hex(8, 0)), [hex(0, 0)], false)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The generation tables (6.2.1)
// ---------------------------------------------------------------------------

describe('system features (6.2.1)', () => {
  it('is the table as printed', () => {
    expect(systemFeatureForRoll(1)).toBe('standard')
    expect(systemFeatureForRoll(60)).toBe('standard')
    expect(systemFeatureForRoll(61)).toBe('nebula')
    expect(systemFeatureForRoll(75)).toBe('nebula')
    expect(systemFeatureForRoll(76)).toBe('dense-asteroid-field')
    expect(systemFeatureForRoll(90)).toBe('dense-asteroid-field')
    expect(systemFeatureForRoll(91)).toBe('multiple-star')
    // "91-00": the hundredth roll is 100 here.
    expect(systemFeatureForRoll(100)).toBe('multiple-star')
  })
})

describe('planet types (6.2.1)', () => {
  it('is the table as printed, both Terran ranges included', () => {
    for (let roll = 1; roll <= 20; roll++) expect(planetTypeForRoll(roll)).toBe('terran')
    for (let roll = 21; roll <= 31; roll++) expect(planetTypeForRoll(roll)).toBe('sub-terran')
    for (let roll = 32; roll <= 42; roll++) expect(planetTypeForRoll(roll)).toBe('minimal-terran')
    for (let roll = 43; roll <= 56; roll++) expect(planetTypeForRoll(roll)).toBe('barren')
    for (let roll = 57; roll <= 89; roll++) expect(planetTypeForRoll(roll)).toBe('gas-giant')
    for (let roll = 90; roll <= 91; roll++) expect(planetTypeForRoll(roll)).toBe('special-anomaly')
    // The source's second Terran range, 92-100, which is left as it is printed.
    for (let roll = 92; roll <= 100; roll++) expect(planetTypeForRoll(roll)).toBe('terran')

    const terran = Array.from({ length: 100 }, (_, i) => planetTypeForRoll(i + 1)).filter(
      (type) => type === 'terran',
    )
    expect(terran).toHaveLength(29)
  })

  it('says what may be colonised', () => {
    expect(isColonisable('terran')).toBe(true)
    expect(isColonisable('sub-terran')).toBe(true)
    expect(isColonisable('minimal-terran')).toBe(true)
    expect(isColonisable('barren')).toBe(true)
    expect(isColonisable('gas-giant')).toBe(false)
    expect(isColonisable('special-anomaly')).toBe(false)
    expect(requiresControlledEnvironment('barren')).toBe(true)
    expect(requiresControlledEnvironment('terran')).toBe(false)
  })
})

describe('planet traits (6.2.1)', () => {
  it('is the table as printed', () => {
    expect(planetTraitForRoll(1)).toBe('none')
    expect(planetTraitForRoll(70)).toBe('none')
    expect(planetTraitForRoll(71)).toBe('mineral-rich')
    expect(planetTraitForRoll(82)).toBe('mineral-rich')
    expect(planetTraitForRoll(83)).toBe('biologically-rich')
    expect(planetTraitForRoll(88)).toBe('biologically-rich')
    expect(planetTraitForRoll(89)).toBe('hazardous')
    expect(planetTraitForRoll(94)).toBe('hazardous')
    expect(planetTraitForRoll(95)).toBe('ancient-ruins')
    expect(planetTraitForRoll(98)).toBe('ancient-ruins')
    expect(planetTraitForRoll(99)).toBe('unique')
    expect(planetTraitForRoll(100)).toBe('unique')
  })

  it('clamps a roll the +20 pushed past the end of the table', () => {
    expect(DENSE_ASTEROID_TRAIT_DRM).toBe(20)
    expect(planetTraitForRoll(119)).toBe('unique')
    expect(planetTraitForRoll(0)).toBe('none')
  })

  it('adds 20 in a dense asteroid field and nowhere else', () => {
    // A natural 60 is None on a plain system and Mineral rich at +20.
    const seed = seedWhere((stream) => rollD100(stream) === 60)
    expect(rollPlanetTrait({ seed, cursor: 0 }, 'standard')).toBe('none')
    expect(rollPlanetTrait({ seed, cursor: 0 }, 'dense-asteroid-field')).toBe('mineral-rich')
    expect(rollPlanetTrait({ seed, cursor: 0 }, 'nebula')).toBe('none')
    expect(rollPlanetTrait({ seed, cursor: 0 }, 'multiple-star')).toBe('none')
  })
})

describe('planetary bodies (6.2.1)', () => {
  it('is 1d6: 1-4 one body, 5 two, 6 three', () => {
    expect([1, 2, 3, 4, 5, 6].map(bodyCountForRoll)).toEqual([1, 1, 1, 1, 2, 3])
  })

  it('gives a gas giant 1d6-3 moons, minimum none', () => {
    expect([1, 2, 3, 4, 5, 6].map(moonCountForRoll)).toEqual([0, 0, 0, 1, 2, 3])
  })

  it('rolls a second 1d6 of bodies for a binary or trinary star', () => {
    const seed = seedWhere((stream) => rollD6(stream) === 6 && rollD6(stream) === 5)
    expect(rollBodyCount({ seed, cursor: 0 }, 'standard')).toBe(3)
    // 6 gives three bodies, the additional 5 gives two more.
    expect(rollBodyCount({ seed, cursor: 0 }, 'multiple-star')).toBe(5)

    const stream: RandomStream = { seed, cursor: 0 }
    rollBodyCount(stream, 'standard')
    expect(stream.cursor).toBe(1)
    const twin: RandomStream = { seed, cursor: 0 }
    rollBodyCount(twin, 'multiple-star')
    expect(twin.cursor).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// The generator (6.2.1)
// ---------------------------------------------------------------------------

describe('the system generator (6.2.1)', () => {
  const generate = (seed: number) =>
    generateSystem({ seed, cursor: 0 }, { id: 'sys-1', name: 'Tau Ceti', hex: hex(0, 0) })

  it('generates the same system from the same position, for ever', () => {
    for (const seed of [1, 2, 99, 4242, 65535]) {
      expect(generate(seed)).toEqual(generate(seed))
    }
    // And the same rolls land in the same place whatever the cursor started at.
    const a: RandomStream = { seed: 77, cursor: 12 }
    const b: RandomStream = { seed: 77, cursor: 12 }
    expect(generateSystem(a, { id: 's', name: 'S', hex: hex(1, 1) })).toEqual(
      generateSystem(b, { id: 's', name: 'S', hex: hex(1, 1) }),
    )
    expect(a.cursor).toBe(b.cursor)
    expect(a.cursor).toBeGreaterThan(12)
  })

  it('obeys the tables over a few hundred systems', () => {
    let sawGasGiant = false
    let sawMoon = false
    let sawMultipleStar = false

    for (let seed = 1; seed <= 400; seed++) {
      const system = generate(seed)
      expect(system.bodies.length).toBeGreaterThanOrEqual(1)
      expect(new Set(system.bodies.map((b) => b.id)).size).toBe(system.bodies.length)

      const primaries = system.bodies.filter((b) => b.parentId === null)
      // 1d6 gives at most 3 bodies; a multiple star rolls a second 1d6.
      expect(primaries.length).toBeLessThanOrEqual(system.feature === 'multiple-star' ? 6 : 3)
      if (system.feature === 'multiple-star' && primaries.length > 3) sawMultipleStar = true

      for (const body of system.bodies) {
        // "d100 per non-gas-giant for a trait": a gas giant never has one.
        if (body.type === 'gas-giant') {
          sawGasGiant = true
          expect(body.trait).toBe('none')
          const moons = system.bodies.filter((b) => b.parentId === body.id)
          expect(moons.length).toBeLessThanOrEqual(3)
          if (moons.length > 0) sawMoon = true
        }
        if (body.parentId !== null) {
          const parent = system.bodies.find((b) => b.id === body.parentId)
          // Moons are moons of gas giants, and of nothing else.
          expect(parent?.type).toBe('gas-giant')
          expect(parent?.parentId).toBeNull()
          sawMoon = sawMoon || true
        }
      }
    }

    expect(sawGasGiant).toBe(true)
    expect(sawMoon).toBe(true)
    expect(sawMultipleStar).toBe(true)
  })

  it('draws exactly the rolls the section calls for', () => {
    // Feature, body count, then per body a type, a trait unless it is a gas
    // giant, and a moon count if it is — with a type and trait for each moon.
    for (let seed = 1; seed <= 60; seed++) {
      const stream: RandomStream = { seed, cursor: 0 }
      const system = generateSystem(stream, { id: 's', name: 'S', hex: hex(0, 0) })

      let expected = 1 + (system.feature === 'multiple-star' ? 2 : 1)
      for (const body of system.bodies) {
        expected += 1 // its type
        if (body.type === 'gas-giant') {
          // Gas giants roll no trait but do roll for moons. Moons of moons are
          // not rolled for: the recursion stops at one level.
          if (body.parentId === null) expected += 1
        } else {
          expected += 1 // its trait
        }
      }
      expect(stream.cursor).toBe(expected)
    }
  })

  it('names bodies by the system, and moons by their planet', () => {
    const seed = seedWhere((stream) => {
      const system = generateSystem(stream, { id: 's', name: 'Tau Ceti', hex: hex(0, 0) })
      return system.bodies.some((b) => b.parentId !== null)
    })
    const system = generateSystem({ seed, cursor: 0 }, { id: 'sys-1', name: 'Tau Ceti', hex: hex(0, 0) })
    const moon = system.bodies.find((b) => b.parentId !== null)
    const parent = system.bodies.find((b) => b.id === moon?.parentId)
    expect(parent?.name.startsWith('Tau Ceti ')).toBe(true)
    expect(moon?.name.startsWith(`${parent?.name}-`)).toBe(true)
    expect(moon?.id.startsWith(`${parent?.id}-m`)).toBe(true)
  })

  it('starts every system unexplored and unwatched', () => {
    const system = generate(31)
    expect(system.exploredBy).toEqual([])
    expect(system.counterEspionage).toEqual({})
    expect(system.bodies.every((b) => b.colonyId === null)).toBe(true)
  })
})

describe('the star map', () => {
  it('generates one system per star hex, in the order the setup lists them', () => {
    const hexes = [hex(0, 0), hex(2, -1), hex(-3, 1)]
    const stream: RandomStream = { seed: 2024, cursor: 0 }
    const map = generateStarMap(stream, { radius: 6, starHexes: hexes, nameFor: (_, i) => `Star ${i}` })

    expect(map.radius).toBe(6)
    expect(Object.keys(map.systems)).toHaveLength(3)
    for (const h of hexes) {
      const system = systemAt(map, h)
      expect(system).toBeDefined()
      expect(system && hexEquals(system.hex, h)).toBe(true)
    }
    expect(systemAt(map, hex(5, 5))).toBeUndefined()
    expect(systemAt(map, hex(0, 0))?.name).toBe('Star 0')

    // Same seed, same map — the whole point.
    const twin = generateStarMap({ seed: 2024, cursor: 0 }, { radius: 6, starHexes: hexes, nameFor: (_, i) => `Star ${i}` })
    expect(twin).toEqual(map)
  })
})
