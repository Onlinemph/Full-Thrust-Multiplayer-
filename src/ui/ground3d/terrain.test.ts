import { Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import type { TerrainFeature } from '../../dirtside/table/types'
import { DIRTSIDE_SCALE } from './space'
import { TerrainLayer } from './terrain'

/** A hill big enough to swallow a building placed at its centre. */
const HILL: TerrainFeature = { id: 'hills-1', terrain: 'hills', shape: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } }
const BUILDING_ON_HILL: TerrainFeature = { id: 'building-1', terrain: 'building', shape: { kind: 'rect', x: 4, y: 4, width: 2, height: 2 } }
const BUILDING_FLAT: TerrainFeature = { id: 'building-2', terrain: 'building', shape: { kind: 'rect', x: 20, y: 20, width: 2, height: 2 } }

// Buildings are merged across the whole table into one walls mesh and one
// mesh per roof colour (R5), not a group per feature, so each test below
// builds a table with exactly one building and reads the merged walls mesh's
// own bounding box straight off `layer.group` — the terrain findable by name.
function findMesh(layer: TerrainLayer, name: string) {
  return layer.group.children.find((c) => c.name === name) as Mesh | undefined
}

describe('TerrainLayer / hill overlap (R1)', () => {
  it('stands a building whose footprint is inside a hill on the hill\'s own terrace, not at table height 0', () => {
    const layer = new TerrainLayer()
    layer.update({ table: { width: 30, depth: 30 }, features: [HILL, BUILDING_ON_HILL], now: 0 }, DIRTSIDE_SCALE)
    const onHill = layer.heightAt({ x: 5, y: 5 })
    expect(onHill).toBeGreaterThan(0)

    const walls = findMesh(layer, 'terrain:buildings-walls')
    expect(walls).toBeDefined()
    walls!.geometry.computeBoundingBox()
    const minY = walls!.geometry.boundingBox!.min.y
    // Before the fix every building extruded from world Y 0 regardless of
    // the hill beneath it; the walls' own base must now sit at the hill's
    // terrace height instead of being buried in it.
    expect(minY).toBeCloseTo(onHill, 5)
  })

  it('still stands a building on bare ground at table height 0', () => {
    const layer = new TerrainLayer()
    layer.update({ table: { width: 30, depth: 30 }, features: [HILL, BUILDING_FLAT], now: 0 }, DIRTSIDE_SCALE)
    const walls = findMesh(layer, 'terrain:buildings-walls')
    expect(walls).toBeDefined()
    walls!.geometry.computeBoundingBox()
    expect(walls!.geometry.boundingBox!.min.y).toBeCloseTo(0, 5)
  })
})

describe('TerrainLayer / building merge (R5)', () => {
  it('draws every building as a single merged walls mesh and one mesh per roof colour, not a mesh per building', () => {
    const buildings: TerrainFeature[] = Array.from({ length: 40 }, (_, i) => ({
      id: `building-${i}`,
      terrain: 'building',
      shape: { kind: 'rect', x: (i % 10) * 3, y: Math.floor(i / 10) * 3, width: 2, height: 2 },
    }))
    const layer = new TerrainLayer()
    layer.update({ table: { width: 40, depth: 40 }, features: buildings, now: 0 }, DIRTSIDE_SCALE)
    const walls = layer.group.children.filter((c) => c.name === 'terrain:buildings-walls')
    const roofs = layer.group.children.filter((c) => c.name === 'terrain:buildings-roofs')
    // One walls mesh for all 40 buildings (they share one fixed colour), and
    // at most the 3 warm roof tones this partOf-less batch can ever pick —
    // never one mesh (let alone two) per building.
    expect(walls.length).toBe(1)
    expect(roofs.length).toBeGreaterThan(0)
    expect(roofs.length).toBeLessThanOrEqual(3)
  })
})
