/**
 * Movement (Chapter 9, pp. 22–24): base mobility and its encumbered shift,
 * Combat and Travel move distances, the terrain-effects table for the two
 * infantry mobility families, and how far a given allowance carries a
 * figure along a path — each against the book's own numbers.
 */

import { describe, expect, it } from 'vitest'
import type { TerrainFeature } from '../types'
import { advanceAlongPath, combatMoveInches, movementGoing, normalMoveInches, pathCost, travelMoveInches } from './movement'

describe('Normal Movement (p. 22)', () => {
  it('moves up to base mobility per action, twice that on both actions', () => {
    expect(normalMoveInches('foot', 1)).toBe(6)
    expect(normalMoveInches('foot', 2)).toBe(12)
    expect(normalMoveInches('very-light', 1)).toBe(8)
    expect(normalMoveInches('fast-power', 2)).toBe(24)
  })

  it('shifts one die type down when encumbered: normal troops move 4" instead of 6" (p. 22)', () => {
    expect(normalMoveInches('foot', 1, true)).toBe(4)
  })
})

describe('Combat Movement (p. 22)', () => {
  it('doubles the die roll', () => {
    expect(combatMoveInches(4)).toBe(8)
    expect(combatMoveInches(6)).toBe(12)
    expect(combatMoveInches(1)).toBe(2)
  })
})

describe('Travel Movement (p. 24): doubling is per action spent, not a flat x2', () => {
  it('moves 4x base mobility across both actions', () => {
    expect(travelMoveInches('foot', 1)).toBe(12)
    expect(travelMoveInches('foot', 2)).toBe(24)
  })
})

describe('terrain effects on mobility (pp. 22–23)', () => {
  it('gives Normal Infantry Clear open/scrub/slopes/roads, Poor rough/cultivated/swamp/woods, Difficult a river, Impassable open water', () => {
    expect(movementGoing('infantry', 'open')).toBe('clear')
    expect(movementGoing('infantry', 'light-scrub')).toBe('clear')
    expect(movementGoing('infantry', 'hills')).toBe('clear') // "slopes" (p. 22)
    expect(movementGoing('infantry', 'road')).toBe('clear')
    expect(movementGoing('infantry', 'rough')).toBe('poor')
    expect(movementGoing('infantry', 'cultivated')).toBe('poor')
    expect(movementGoing('infantry', 'swamp')).toBe('poor')
    expect(movementGoing('infantry', 'light-woods')).toBe('poor')
    expect(movementGoing('infantry', 'dense-woods')).toBe('poor')
    expect(movementGoing('infantry', 'river')).toBe('difficult')
    expect(movementGoing('infantry', 'open-water')).toBe('impassable')
    expect(movementGoing('infantry', 'open-water', true)).toBe('poor') // amphibious
  })

  it('gives Power-Armoured Infantry Clear rough/cultivated too, Difficult wading open water, Impassable only unless amphibious', () => {
    expect(movementGoing('power-armour', 'rough')).toBe('clear')
    expect(movementGoing('power-armour', 'cultivated')).toBe('clear')
    expect(movementGoing('power-armour', 'swamp')).toBe('poor')
    expect(movementGoing('power-armour', 'light-woods')).toBe('poor')
    expect(movementGoing('power-armour', 'open-water')).toBe('difficult')
    // Amphibious removes the Difficult wading case too [reading, spec 02 §2.4.3].
    expect(movementGoing('power-armour', 'open-water', true)).toBe('poor')
  })

  it('reads a town’s own streets and yards as Clear, once its buildings are read as their own pieces (spec 02 §2.8.1)', () => {
    expect(movementGoing('infantry', 'urban')).toBe('clear')
    expect(movementGoing('power-armour', 'urban')).toBe('clear')
  })

  it('folds mountains into the same going as hills/slopes [reading]: not one of Stargrunt’s own terrain types', () => {
    expect(movementGoing('infantry', 'mountains')).toBe('clear')
  })

  it('gives a building interior Poor for a trooper on foot and Difficult for power armour [reading]', () => {
    expect(movementGoing('infantry', 'building')).toBe('poor')
    expect(movementGoing('power-armour', 'building')).toBe('difficult')
  })

  it('reads rubble as this family’s own Rough/Broken going (a wrecked building is rocks and broken masonry, Stargrunt p. 57)', () => {
    expect(movementGoing('infantry', 'rubble')).toBe('poor')
    expect(movementGoing('power-armour', 'rubble')).toBe('clear')
  })

  it('charges Difficult to clamber over a wall or push through a hedge [reading]: the digest gives no numeric crossing cost, only for hiding behind one', () => {
    expect(movementGoing('infantry', 'wall')).toBe('difficult')
    expect(movementGoing('infantry', 'hedge')).toBe('difficult')
    expect(movementGoing('power-armour', 'wall')).toBe('difficult')
  })
})

describe('the cost of a path (p. 22)', () => {
  it('charges Normal Infantry 8 movement factors for 4" through Swamp (Poor)', () => {
    const swamp: TerrainFeature = { id: 's', terrain: 'swamp', shape: { kind: 'rect', x: 0, y: 0, width: 20, height: 20 } }
    expect(pathCost([{ x: 0, y: 5 }, { x: 4, y: 5 }], 'foot', [swamp]).factors).toBeCloseTo(8, 1)
  })

  it('stops at open water for infantry, impassable', () => {
    const water: TerrainFeature = { id: 'w', terrain: 'open-water', shape: { kind: 'rect', x: 10, y: 0, width: 20, height: 20 } }
    const cost = pathCost([{ x: 0, y: 5 }, { x: 20, y: 5 }], 'foot', [water])
    expect(cost.blockedBy).toBe('open-water')
    expect(cost.blockedAt?.x).toBeCloseTo(10, 0)
    expect(cost.blockedAt?.y).toBe(5)
  })

  it('only charges the extra cost of a river for the stretch that actually crosses it, not the whole path ("crossing only", spec 02 §2.4.3)', () => {
    const river: TerrainFeature = { id: 'r', terrain: 'river', shape: { kind: 'path', points: [{ x: 10, y: -5 }, { x: 10, y: 25 }], width: 1 } }
    const clear = pathCost([{ x: 0, y: 5 }, { x: 20, y: 5 }], 'foot', []).factors
    const crossing = pathCost([{ x: 0, y: 5 }, { x: 20, y: 5 }], 'foot', [river]).factors
    // A ~1" difficult crossing adds a little over the 20" clear-ground baseline, nowhere near
    // what treating the whole 20" as Difficult (x3, i.e. 60) would cost.
    expect(crossing).toBeGreaterThan(clear)
    expect(crossing).toBeLessThan(clear + 5)
  })

  it('charges Poor infantry going through a building’s interior, and Difficult for power armour', () => {
    const house: TerrainFeature = { id: 'h', terrain: 'building', shape: { kind: 'rect', x: 0, y: 0, width: 4, height: 20 } }
    expect(pathCost([{ x: 2, y: 0 }, { x: 2, y: 4 }], 'foot', [house]).factors).toBeCloseTo(8, 1) // 4" at Poor (x2)
    expect(pathCost([{ x: 2, y: 0 }, { x: 2, y: 4 }], 'fast-power', [house]).factors).toBeCloseTo(12, 1) // 4" at Difficult (x3)
  })

  it('reads a town’s pieces, not its own bare ground: a building inside costs Poor, a street between buildings Clear (p. 22, spec 02 §2.8.1)', () => {
    // A town's own enclosing area is an irregular polygon (as `randomTerrain` lays one out), not a rectangle.
    const town: TerrainFeature = { id: 'town', terrain: 'urban', shape: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 40, y: 1 }, { x: 39, y: 40 }, { x: 1, y: 39 }] } }
    const house: TerrainFeature = { id: 'house-1', terrain: 'building', shape: { kind: 'rect', x: 10, y: 0, width: 4, height: 20 }, partOf: 'town' }
    const throughHouse = pathCost([{ x: 12, y: 0 }, { x: 12, y: 4 }], 'foot', [town, house]).factors
    const alongStreet = pathCost([{ x: 25, y: 0 }, { x: 25, y: 4 }], 'foot', [town, house]).factors
    expect(throughHouse).toBeCloseTo(8, 1) // 4" at Poor (x2), the building piece, not the town’s own Clear ground
    expect(alongStreet).toBeCloseTo(4, 1) // 4" at Clear (x1): a street, outside every building
  })
})

describe('how far a path gets on a given allowance', () => {
  it('reaches the end of the path when the allowance covers it exactly', () => {
    const swamp: TerrainFeature = { id: 's', terrain: 'swamp', shape: { kind: 'rect', x: 0, y: 0, width: 20, height: 20 } }
    const progress = advanceAlongPath([{ x: 0, y: 5 }, { x: 4, y: 5 }], 8, 'foot', [swamp])
    expect(progress.ranOutOfAllowance).toBe(false)
    expect(progress.distanceCovered).toBeCloseTo(4, 1)
    expect(progress.factorsSpent).toBeCloseTo(8, 1)
    expect(progress.reached.x).toBeCloseTo(4, 1)
  })

  it('stops partway through when the allowance runs out first', () => {
    const swamp: TerrainFeature = { id: 's', terrain: 'swamp', shape: { kind: 'rect', x: 0, y: 0, width: 20, height: 20 } }
    // 4" of swamp costs 8 factors; with only 4 factors the figure gets half way, 2".
    const progress = advanceAlongPath([{ x: 0, y: 5 }, { x: 4, y: 5 }], 4, 'foot', [swamp])
    expect(progress.ranOutOfAllowance).toBe(true)
    expect(progress.distanceCovered).toBeCloseTo(2, 1)
    expect(progress.reached.x).toBeCloseTo(2, 1)
  })

  it('stops a non-amphibious figure at the edge of open water regardless of remaining allowance', () => {
    const water: TerrainFeature = { id: 'w', terrain: 'open-water', shape: { kind: 'rect', x: 10, y: 0, width: 20, height: 20 } }
    const progress = advanceAlongPath([{ x: 0, y: 5 }, { x: 20, y: 5 }], 100, 'foot', [water])
    expect(progress.blockedBy).toBe('open-water')
    expect(progress.reached.x).toBeCloseTo(10, 0)
  })

  it('lets an amphibious power-armoured figure wade through at Poor cost instead of being stopped', () => {
    const water: TerrainFeature = { id: 'w', terrain: 'open-water', shape: { kind: 'rect', x: 10, y: 0, width: 4, height: 20 } }
    // Plenty of allowance: 4" clear + 4" water at Poor (x2) + 2" clear is at most 4+8+2=14 factors either side of quantisation.
    const progress = advanceAlongPath([{ x: 6, y: 5 }, { x: 16, y: 5 }], 30, 'fast-power', [water], { amphibious: true })
    expect(progress.ranOutOfAllowance).toBe(false)
    expect(progress.blockedBy).toBeNull()
    expect(progress.reached.x).toBeCloseTo(16, 0)
  })
})
