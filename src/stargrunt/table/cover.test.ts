/**
 * The ground: cover grades and the majority rule (pp. 12–13), line of sight
 * and range between units (p. 11–12), and unit integrity (p. 11), against
 * the book's own worked examples and diagrams.
 */

import { describe, expect, it } from 'vitest'
import type { TerrainFeature } from '../types'
import {
  figureCoverGrade,
  isInIntegrity,
  lineOfSight,
  minEnclosingCircle,
  rangeBetweenUnits,
  terrainAt,
  terrainCoverGrade,
  unitCentre,
  unitCoverGrade,
  unitVisible,
  woodPostureOf,
} from './cover'

const wood: TerrainFeature = { id: 'w', terrain: 'light-woods', shape: { kind: 'circle', centre: { x: 20, y: 10 }, radius: 4 }, label: 'a wood' }
const hill: TerrainFeature = { id: 'h', terrain: 'hills', shape: { kind: 'circle', centre: { x: 20, y: 30 }, radius: 4 }, label: 'a slope' }

// A town (Dirtside p. 46, Stargrunt p. 22): one enclosing `urban` area — an irregular polygon, the shape
// `randomTerrain` is meant to lay one out as, not a rectangle — its buildings and a garden wall and
// hedge as pieces (`partOf` the town).
const town: TerrainFeature = {
  id: 'town',
  terrain: 'urban',
  shape: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 55, y: 2 }, { x: 60, y: 40 }, { x: 5, y: 38 }] },
  label: 'Anytown',
}
const townHouse: TerrainFeature = { id: 'house-1', terrain: 'building', shape: { kind: 'rect', x: 10, y: 10, width: 4, height: 4 }, partOf: 'town', label: 'a house' }
const gardenWall: TerrainFeature = { id: 'wall-1', terrain: 'wall', shape: { kind: 'path', points: [{ x: 10, y: 15 }, { x: 30, y: 15 }], width: 0.2 }, partOf: 'town', label: 'a garden wall' }
const gardenHedge: TerrainFeature = { id: 'hedge-1', terrain: 'hedge', shape: { kind: 'path', points: [{ x: 10, y: 25 }, { x: 30, y: 25 }], width: 0.3 }, label: 'a hedgerow' }
const wreck: TerrainFeature = { id: 'rubble-1', terrain: 'rubble', shape: { kind: 'rect', x: 34, y: 10, width: 3, height: 3 }, partOf: 'town', label: 'a wrecked building' }
// A thin, wall-like footprint stands in for a house's own outer wall, for the directional
// building-wall test (p. 12–13's "same directional test" for a solid structure).
const gardenShed: TerrainFeature = { id: 'shed', terrain: 'building', shape: { kind: 'rect', x: 20, y: 20, width: 8, height: 1 }, label: 'a shed wall' }

describe('terrain cover grades (pp. 12–13)', () => {
  it('gives soft cover to scrub and hard cover to rocky or built-up ground', () => {
    expect(terrainCoverGrade('open')).toBe('open')
    expect(terrainCoverGrade('road')).toBe('open')
    expect(terrainCoverGrade('cultivated')).toBe('open')
    expect(terrainCoverGrade('light-scrub')).toBe('soft')
    expect(terrainCoverGrade('rough')).toBe('hard')
    expect(terrainCoverGrade('hills')).toBe('hard')
    // Not one of Stargrunt's own eleven terrain types (spec 02 §2.4.1); folded into hills/slopes [reading].
    expect(terrainCoverGrade('mountains')).toBe('hard')
    expect(terrainCoverGrade('building')).toBe('hard')
    expect(terrainCoverGrade('rubble')).toBe('hard')
    // The town's own enclosing area, not a structure (Dirtside p. 46): its streets and yards, outside
    // every building, are open ground — Stargrunt reads a town as its pieces, not the blob (p. 22).
    expect(terrainCoverGrade('urban')).toBe('open')
    // Directional only (p. 12–13): never a blob grade of their own, see `figureCoverGrade` below.
    expect(terrainCoverGrade('wall')).toBe('open')
    expect(terrainCoverGrade('hedge')).toBe('open')
  })

  it('gives a wood edge soft cover, and treats within a wood as the more-protective case (p. 12, spec 01 §3.5)', () => {
    expect(woodPostureOf({ x: 23.5, y: 10 }, [wood])).toBe('edge')
    expect(woodPostureOf({ x: 20, y: 10 }, [wood])).toBe('within')
    expect(woodPostureOf({ x: 40, y: 10 }, [wood])).toBeNull()
  })
})

describe('a town read as its pieces, not the enclosing blob (p. 22, spec 02 §2.8.1)', () => {
  it('reads the piece under a point (a building, a piece of rubble) ahead of the town’s own bare ground', () => {
    expect(terrainAt({ x: 12, y: 12 }, [town, townHouse])).toBe('building')
    expect(terrainAt({ x: 35, y: 11 }, [town, wreck])).toBe('rubble')
  })

  it('reads a street or a yard — inside the town, outside every building — as the town’s own open ground', () => {
    expect(terrainAt({ x: 45, y: 30 }, [town, townHouse])).toBe('urban')
    expect(figureCoverGrade({ x: 45, y: 30 }, [town, townHouse])).toBe('open')
  })

  it('gives a figure inside a building hard cover regardless of where the piece sits, in a town or standing alone', () => {
    expect(figureCoverGrade({ x: 12, y: 12 }, [town, townHouse])).toBe('hard')
  })
})

describe('directional cover from a wall, a hedge, and a building’s own wall (p. 12–13)', () => {
  it('gives a wall hard cover from the far side only, exactly as the book’s own diagram has it (Squad A)', () => {
    const behind = { x: 20, y: 14 } // just north of the wall (y = 15)
    expect(figureCoverGrade(behind, [gardenWall], { x: 20, y: 30 })).toBe('hard') // firer south of the wall
    expect(figureCoverGrade(behind, [gardenWall], { x: 20, y: 0 })).toBe('open') // firer on the same side
    expect(figureCoverGrade(behind, [gardenWall])).toBe('open') // no firer in mind: no directional bonus
  })

  it('gives a hedge soft cover, the same way, never hard', () => {
    const behind = { x: 20, y: 24 } // just north of the hedge (y = 25)
    expect(figureCoverGrade(behind, [gardenHedge], { x: 20, y: 40 })).toBe('soft')
    expect(figureCoverGrade(behind, [gardenHedge], { x: 20, y: 0 })).toBe('open')
  })

  it('claims a wall’s cover only in contact with it — standing well back of it gives up the benefit even facing the right way', () => {
    const wellBack = { x: 20, y: 12 } // 3" back of the wall (y = 15), on the sheltered side
    expect(figureCoverGrade(wellBack, [gardenWall], { x: 20, y: 30 })).toBe('open')
  })

  it('gives the same hard cover to a figure standing in contact just outside a building’s own wall, directionally', () => {
    const outside = { x: 24, y: 21.3 } // just south of the shed (y 20–21), not inside its footprint
    expect(figureCoverGrade(outside, [gardenShed], { x: 24, y: 0 })).toBe('hard') // firer on the far (north) side
    expect(figureCoverGrade(outside, [gardenShed], { x: 24, y: 40 })).toBe('open') // firer on the figure’s own side
  })

  it('gives rubble hard cover unconditionally, like rough ground, with no directional test', () => {
    expect(figureCoverGrade({ x: 35, y: 11 }, [wreck])).toBe('hard')
    expect(figureCoverGrade({ x: 35, y: 11 }, [wreck], { x: 100, y: 100 })).toBe('hard')
  })
})

describe('the majority rule for mixed cover (p. 12)', () => {
  it('takes whichever grade a strict majority of figures are in', () => {
    expect(unitCoverGrade(['hard', 'hard', 'hard', 'hard', 'soft', 'soft'])).toBe('hard')
    expect(unitCoverGrade(['open', 'open', 'open', 'open', 'hard'])).toBe('open')
  })

  it('defaults an exact even split to the less protective cover (book’s own example: 3 hard/3 soft → soft)', () => {
    expect(unitCoverGrade(['hard', 'hard', 'hard', 'soft', 'soft', 'soft'])).toBe('soft')
  })

  it('confirms the book’s other worked split the other way: 4 hard/2 soft → hard', () => {
    expect(unitCoverGrade(['hard', 'hard', 'hard', 'hard', 'soft', 'soft'])).toBe('hard')
  })

  it('falls back to the least protective grade present on a three-way tie [reading, generalising p. 12]', () => {
    expect(unitCoverGrade(['open', 'soft', 'hard'])).toBe('open')
  })
})

describe('unit visibility (p. 11–12): at least half seen makes the whole unit a target', () => {
  it('counts exactly half as visible', () => {
    expect(unitVisible([true, true, true, false, false, false])).toBe(true)
  })

  it('fails a unit less than half seen', () => {
    expect(unitVisible([true, true, false, false, false, false])).toBe(false)
  })
})

describe('line of sight and range between units (p. 11–12)', () => {
  it('is blocked by a wood and clear beside it', () => {
    expect(lineOfSight({ x: 10, y: 10 }, { x: 30, y: 10 }, [wood]).clear).toBe(false)
    expect(lineOfSight({ x: 10, y: 20 }, { x: 30, y: 20 }, [wood]).clear).toBe(true)
  })

  it('lets an edge figure see out and be seen, but blocks a figure within', () => {
    expect(lineOfSight({ x: 23.5, y: 10 }, { x: 35, y: 10 }, [wood]).clear).toBe(true)
    const within = lineOfSight({ x: 35, y: 10 }, { x: 20, y: 10 }, [wood])
    expect(within.clear).toBe(false)
    expect(within.reason).toMatch(/within a wood/)
  })

  it('is blocked by high ground unless one end stands on it', () => {
    expect(lineOfSight({ x: 10, y: 30 }, { x: 30, y: 30 }, [hill]).clear).toBe(false)
    expect(lineOfSight({ x: 20, y: 30 }, { x: 30, y: 30 }, [hill]).clear).toBe(true)
  })

  it('has no distance limit in normal conditions, unlike Dirtside’s 60" sensor cap [reading, spec 01 §3.2]', () => {
    expect(lineOfSight({ x: 0, y: 0 }, { x: 61, y: 0 }, []).clear).toBe(true)
    expect(lineOfSight({ x: 0, y: 0 }, { x: 200, y: 0 }, []).clear).toBe(true)
  })

  it('measures a group’s centre as the mean of its figures, and range as the distance between two units’ centres', () => {
    const centre = unitCentre([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 6 }])
    expect(centre).toEqual({ x: 2, y: 2 })
    expect(rangeBetweenUnits({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

describe('line of sight through and out of buildings (p. 11)', () => {
  const houseA: TerrainFeature = { id: 'a', terrain: 'building', shape: { kind: 'rect', x: 10, y: 10, width: 4, height: 4 } }
  const houseB: TerrainFeature = { id: 'b', terrain: 'building', shape: { kind: 'rect', x: 30, y: 10, width: 4, height: 4 } }
  const houseC: TerrainFeature = { id: 'c', terrain: 'building', shape: { kind: 'rect', x: 20, y: 10, width: 4, height: 4 } }

  it('is blocked by a building standing between the two, and clear beside it', () => {
    expect(lineOfSight({ x: 5, y: 12 }, { x: 35, y: 12 }, [houseA]).clear).toBe(false)
    expect(lineOfSight({ x: 5, y: 20 }, { x: 35, y: 20 }, [houseA]).clear).toBe(true)
  })

  it('lets a figure inside a building see out through its own walls, at the windows [reading], not merely to its edge', () => {
    // Deep inside a 4"-wide building, over WOOD_EDGE (1") from every wall — a wood's edge allowance
    // would wrongly block this; a building's own walls do not block their own occupant at all.
    expect(lineOfSight({ x: 12, y: 12 }, { x: 25, y: 12 }, [houseA]).clear).toBe(true)
  })

  it('is seen from outside through its own walls too: the same building, the other end of the same line', () => {
    expect(lineOfSight({ x: 25, y: 12 }, { x: 12, y: 12 }, [houseA]).clear).toBe(true)
  })

  it('does not see through a second building: each side’s own walls are transparent to it, but a third building on the line still blocks it', () => {
    // Firer inside houseA, target inside houseB: each side’s own building is exempt, and nothing else
    // is on the line, so the shot is clear.
    expect(lineOfSight({ x: 12, y: 12 }, { x: 32, y: 12 }, [houseA, houseB]).clear).toBe(true)
    // The same shot with a third building, houseC, sitting on the line between them (neither side’s own):
    // that one still blocks it.
    expect(lineOfSight({ x: 12, y: 12 }, { x: 32, y: 12 }, [houseA, houseB, houseC]).clear).toBe(false)
  })

  it('is never blocked by rubble, a wall, or a hedge, only by a standing building', () => {
    expect(lineOfSight({ x: 0, y: 11.5 }, { x: 50, y: 11.5 }, [wreck]).clear).toBe(true)
    expect(lineOfSight({ x: 0, y: 15 }, { x: 40, y: 15 }, [gardenWall]).clear).toBe(true)
    expect(lineOfSight({ x: 0, y: 25 }, { x: 40, y: 25 }, [gardenHedge]).clear).toBe(true)
  })

  it('is not blocked by the town’s own enclosing area, only by the buildings inside it (p. 22: no area-urban type of its own)', () => {
    expect(lineOfSight({ x: 5, y: 5 }, { x: 55, y: 35 }, [town]).clear).toBe(true)
  })
})

describe('the smallest enclosing circle', () => {
  it('is the diametral circle for two points', () => {
    const c = minEnclosingCircle([{ x: 0, y: 0 }, { x: 6, y: 0 }])
    expect(c.radius * 2).toBeCloseTo(6, 6)
  })

  it('is the circumcircle when three points need it', () => {
    // An equilateral triangle of side 6: circumradius = side / sqrt(3).
    const c = minEnclosingCircle([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 3 * Math.sqrt(3) }])
    expect(c.radius).toBeCloseTo(6 / Math.sqrt(3), 6)
  })
})

describe('unit integrity (p. 11, spec 01 §3.1)', () => {
  it('is satisfied by a chain of 2" gaps longer than the 6" circle (book’s own diagram, Squad A)', () => {
    const column = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }, { x: 8, y: 0 }]
    expect(isInIntegrity(column)).toBe(true)
  })

  it('is satisfied by a loose group inside a 6" diameter circle even when no two figures are within 2" (book’s own diagram, Squad B)', () => {
    const cluster = [{ x: 3, y: 0 }, { x: -3, y: 0 }, { x: 0, y: 3 }, { x: 0, y: -3 }]
    expect(isInIntegrity(cluster)).toBe(true)
  })

  it('is broken by a figure that is neither within the 6" circle nor within 2" of any other figure', () => {
    const scattered = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 10 }]
    expect(isInIntegrity(scattered)).toBe(false)
  })

  it('treats a single figure, or none, as always in integrity', () => {
    expect(isInIntegrity([{ x: 0, y: 0 }])).toBe(true)
    expect(isInIntegrity([])).toBe(true)
  })
})
