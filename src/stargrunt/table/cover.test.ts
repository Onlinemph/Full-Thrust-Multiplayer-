/**
 * The ground: cover grades and the majority rule (pp. 12–13), line of sight
 * and range between units (p. 11–12), and unit integrity (p. 11), against
 * the book's own worked examples and diagrams.
 */

import { describe, expect, it } from 'vitest'
import type { TerrainFeature } from '../types'
import {
  isInIntegrity,
  lineOfSight,
  minEnclosingCircle,
  rangeBetweenUnits,
  terrainCoverGrade,
  unitCentre,
  unitCoverGrade,
  unitVisible,
  woodPostureOf,
} from './cover'

const wood: TerrainFeature = { id: 'w', terrain: 'light-woods', shape: { kind: 'circle', centre: { x: 20, y: 10 }, radius: 4 }, label: 'a wood' }
const hill: TerrainFeature = { id: 'h', terrain: 'hills', shape: { kind: 'circle', centre: { x: 20, y: 30 }, radius: 4 }, label: 'a slope' }

describe('terrain cover grades (pp. 12–13)', () => {
  it('gives soft cover to scrub and hard cover to rocky or built-up ground', () => {
    expect(terrainCoverGrade('open')).toBe('open')
    expect(terrainCoverGrade('road')).toBe('open')
    expect(terrainCoverGrade('cultivated')).toBe('open')
    expect(terrainCoverGrade('light-scrub')).toBe('soft')
    expect(terrainCoverGrade('rough')).toBe('hard')
    expect(terrainCoverGrade('hills')).toBe('hard')
    expect(terrainCoverGrade('urban')).toBe('hard')
    // Not one of Stargrunt's own eleven terrain types (spec 02 §2.4.1); folded into hills/slopes [reading].
    expect(terrainCoverGrade('mountains')).toBe('hard')
  })

  it('gives a wood edge soft cover, and treats within a wood as the more-protective case (p. 12, spec 01 §3.5)', () => {
    expect(woodPostureOf({ x: 23.5, y: 10 }, [wood])).toBe('edge')
    expect(woodPostureOf({ x: 20, y: 10 }, [wood])).toBe('within')
    expect(woodPostureOf({ x: 40, y: 10 }, [wood])).toBeNull()
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
