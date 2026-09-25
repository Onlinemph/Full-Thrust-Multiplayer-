/**
 * The ground: terrain under a point, the line of sight of p. 4 and p. 20,
 * and the movement example of p. 25.
 */

import { describe, expect, it } from 'vitest'
import { depthInside, featureAt, insideShape, interiorPoint, lineOfSight, pathCost, shapeCentre, terrainAt, woodAt } from './terrain'
import type { Shape, TerrainFeature } from './types'

const wood: TerrainFeature = { id: 'w', terrain: 'light-woods', shape: { kind: 'circle', centre: { x: 20, y: 10 }, radius: 4 }, label: 'a wood' }
const hill: TerrainFeature = { id: 'h', terrain: 'hills', shape: { kind: 'circle', centre: { x: 20, y: 30 }, radius: 4 }, label: 'a hill' }
const road: TerrainFeature = { id: 'r', terrain: 'road', shape: { kind: 'path', points: [{ x: 0, y: 5 }, { x: 40, y: 5 }], width: 1 } }
const rough: TerrainFeature = { id: 'g', terrain: 'rough', shape: { kind: 'rect', x: 6, y: 6, width: 10, height: 10 } }

describe('terrain under a point', () => {
  it('reads the last feature listed, and open ground where there is none', () => {
    expect(terrainAt({ x: 20, y: 10 }, [wood])).toBe('light-woods')
    expect(terrainAt({ x: 1, y: 1 }, [wood])).toBe('open')
    expect(terrainAt({ x: 10, y: 5 }, [rough, road])).toBe('road')
  })

  it('tells a wood edge from its interior: the first inch in is the edge (p. 20)', () => {
    expect(woodAt({ x: 23.5, y: 10 }, [wood])?.where).toBe('edge')
    expect(woodAt({ x: 20, y: 10 }, [wood])?.where).toBe('within')
    expect(woodAt({ x: 30, y: 10 }, [wood])).toBeNull()
  })
})

describe('line of sight (p. 4, p. 20)', () => {
  it('is blocked by a wood between two elements and clear beside it', () => {
    expect(lineOfSight({ x: 10, y: 10 }, { x: 30, y: 10 }, [wood]).clear).toBe(false)
    expect(lineOfSight({ x: 10, y: 20 }, { x: 30, y: 20 }, [wood]).clear).toBe(true)
  })

  it('lets an element on the edge of a wood see out and be seen, but not one within', () => {
    expect(lineOfSight({ x: 23.5, y: 10 }, { x: 35, y: 10 }, [wood]).clear).toBe(true)
    expect(lineOfSight({ x: 35, y: 10 }, { x: 23.5, y: 10 }, [wood]).clear).toBe(true)
    const within = lineOfSight({ x: 35, y: 10 }, { x: 20, y: 10 }, [wood])
    expect(within.clear).toBe(false)
    expect(within.reason).toMatch(/within a wood/)
  })

  it('is blocked by high ground unless one end stands on it, and high ground sees over woods', () => {
    expect(lineOfSight({ x: 10, y: 30 }, { x: 30, y: 30 }, [hill]).clear).toBe(false)
    expect(lineOfSight({ x: 20, y: 30 }, { x: 30, y: 30 }, [hill]).clear).toBe(true)
    // From the hill, across the wood, to open ground beyond: the wood does not block.
    expect(lineOfSight({ x: 20, y: 30 }, { x: 20, y: 0 }, [hill, wood]).clear).toBe(true)
  })

  it('reaches 60" and no further', () => {
    expect(lineOfSight({ x: 0, y: 0 }, { x: 60, y: 0 }, []).clear).toBe(true)
    expect(lineOfSight({ x: 0, y: 0 }, { x: 61, y: 0 }, []).reason).toMatch(/60"/)
  })
})

describe('the cost of a path (p. 25)', () => {
  it('charges the tank of the worked example 8 factors: 4" of road, 2" of open, 2" of rough', () => {
    // Slow tracked: road easy (in travel mode), open normal, rough poor (p. 25).
    const features: TerrainFeature[] = [{ id: 'g', terrain: 'rough', shape: { kind: 'rect', x: 20, y: 0, width: 20, height: 20 } }, road]
    expect(pathCost([{ x: 10, y: 5 }, { x: 14, y: 5 }], 'tracked', features, { travel: true }).factors).toBeCloseTo(2, 1)
    expect(pathCost([{ x: 14, y: 8 }, { x: 16, y: 8 }], 'tracked', features, { travel: true }).factors).toBeCloseTo(2, 1)
    expect(pathCost([{ x: 20, y: 8 }, { x: 22, y: 8 }], 'tracked', features, { travel: true }).factors).toBeCloseTo(4, 1)
    // All together, off the road's own edge: 2 + 2 + 4.
    const whole = pathCost([{ x: 10, y: 5 }, { x: 14, y: 5 }, { x: 14, y: 5.5 }, { x: 14, y: 7.5 }, { x: 16, y: 7.5 }, { x: 20, y: 7.5 }, { x: 22, y: 7.5 }], 'tracked', features, { travel: true })
    expect(whole.legs.map((l) => l.going)).toEqual(['easy', 'normal', 'poor'])
  })

  it('counts easy going as normal unless in travel mode', () => {
    expect(pathCost([{ x: 0, y: 5 }, { x: 10, y: 5 }], 'tracked', [road]).factors).toBeCloseTo(10, 1)
    expect(pathCost([{ x: 0, y: 5 }, { x: 10, y: 5 }], 'tracked', [road], { travel: true }).factors).toBeCloseTo(5, 1)
  })

  it('gives an ordinary road through a town the urban going, and a major highway the road going (p. 26)', () => {
    const town: TerrainFeature = { id: 't', terrain: 'urban', shape: { kind: 'rect', x: 10, y: 0, width: 10, height: 10 } }
    const street: TerrainFeature = { id: 's', terrain: 'road', shape: { kind: 'path', points: [{ x: 0, y: 5 }, { x: 30, y: 5 }], width: 1 } }
    expect(terrainAt({ x: 15, y: 5 }, [town, street])).toBe('urban')
    expect(terrainAt({ x: 15, y: 5 }, [town, { ...street, majorHighway: true }])).toBe('road')
    expect(terrainAt({ x: 5, y: 5 }, [town, street])).toBe('road')
  })

  it('lets low-mobility wheels cross a river only at a ford, and powered infantry wade open water (p. 26)', () => {
    const river: TerrainFeature = { id: 'r', terrain: 'river', shape: { kind: 'path', points: [{ x: 20, y: 0 }, { x: 20, y: 40 }], width: 1 } }
    const ford: TerrainFeature = { id: 'f', terrain: 'ford', shape: { kind: 'circle', centre: { x: 20, y: 10 }, radius: 1 } }
    expect(pathCost([{ x: 18, y: 20 }, { x: 22, y: 20 }], 'low-wheeled', [river, ford]).blockedBy).toBe('river')
    expect(pathCost([{ x: 18, y: 10 }, { x: 22, y: 10 }], 'low-wheeled', [river, ford]).blockedAt).toBeNull()
    const lake: TerrainFeature = { id: 'l', terrain: 'open-water', shape: { kind: 'circle', centre: { x: 30, y: 30 }, radius: 3 } }
    expect(pathCost([{ x: 26, y: 30 }, { x: 30, y: 30 }], 'infantry', [lake]).blockedBy).toBe('open-water')
    expect(pathCost([{ x: 26, y: 30 }, { x: 30, y: 30 }], 'infantry', [lake], { amphibious: true }).blockedAt).toBeNull()
  })

  it('stops at impassable ground, but lets a wheeled vehicle into the edge of a wood', () => {
    const blocked = pathCost([{ x: 10, y: 10 }, { x: 20, y: 10 }], 'gev', [wood])
    expect(blocked.blockedAt).not.toBeNull()
    expect(blocked.blockedBy).toBe('light-woods')
    const edge = pathCost([{ x: 10, y: 10 }, { x: 16.5, y: 10 }], 'high-wheeled', [wood])
    expect(edge.blockedAt).toBeNull()
    expect(edge.intoWood).toBe(true)
  })
})

describe('irregular polygons and town pieces', () => {
  const blob: Shape = { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 6, y: 1 }, { x: 7, y: 5 }, { x: 3, y: 7 }, { x: -1, y: 4 }] }

  it('tests a point inside and outside an irregular outline, and how deep inside it is', () => {
    expect(insideShape({ x: 3, y: 3 }, blob)).toBe(true)
    expect(insideShape({ x: 8, y: 8 }, blob)).toBe(false)
    expect(insideShape({ x: 6.9, y: 1.2 }, blob)).toBe(false)
    expect(depthInside({ x: 3, y: 3 }, blob)).toBeGreaterThan(2)
    expect(depthInside({ x: 8, y: 8 }, blob)).toBe(0)
  })

  it('reads a town as urban ground for Dirtside and as its buildings for squad scale', () => {
    const town: TerrainFeature = { id: 'town', terrain: 'urban', shape: { kind: 'polygon', points: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 18 }, { x: 10, y: 18 }] } }
    const house: TerrainFeature = { id: 'house', terrain: 'building', partOf: 'town', shape: { kind: 'polygon', points: [{ x: 12, y: 12 }, { x: 14, y: 12 }, { x: 14, y: 14 }, { x: 12, y: 14 }] } }
    const lone: TerrainFeature = { id: 'barn', terrain: 'building', shape: { kind: 'rect', x: 30, y: 30, width: 1, height: 1 } }
    const features = [town, house, lone]
    expect(featureAt({ x: 13, y: 13 }, features)?.id).toBe('town')
    expect(featureAt({ x: 13, y: 13 }, features, { pieces: true })?.id).toBe('house')
    expect(featureAt({ x: 16, y: 16 }, features, { pieces: true })?.id).toBe('town')
    expect(featureAt({ x: 30.5, y: 30.5 }, features)?.id).toBe('barn')
    // A lone building screens; a town's own buildings leave Dirtside's sight to the town area.
    expect(lineOfSight({ x: 30.5, y: 27 }, { x: 30.5, y: 34 }, features).clear).toBe(false)
    expect(lineOfSight({ x: 5, y: 13 }, { x: 25, y: 13 }, features).blockedBy?.id).toBe('town')
  })

  it('lets nobody see through a lone building, even an element standing in it (p. 46: no edge to see out of)', () => {
    const barn: TerrainFeature = { id: 'barn', terrain: 'building', shape: { kind: 'rect', x: 10, y: 10, width: 1, height: 1 } }
    expect(lineOfSight({ x: 10.5, y: 10.5 }, { x: 10.5, y: 30 }, [barn]).clear).toBe(false)
    expect(lineOfSight({ x: 10.5, y: 5 }, { x: 10.5, y: 30 }, [barn]).clear).toBe(false)
  })

  it('finds a point inside a concave outline whose middle falls in its notch', () => {
    // An L whose vertex mean lies in the cut-away corner.
    const ell: Shape = { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 10 }, { x: 0, y: 10 }] }
    expect(insideShape(shapeCentre(ell), ell)).toBe(false)
    expect(insideShape(interiorPoint(ell), ell)).toBe(true)
  })
})
