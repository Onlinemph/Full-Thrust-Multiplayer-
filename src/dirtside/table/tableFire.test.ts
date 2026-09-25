/**
 * Dirtside's rules on the new terrain types (BRIEF-TERRAIN's "the model"):
 * a lone building blocks sight and gives soft cover by contact but does
 * not impede movement (p. 46); its ruin no longer blocks sight but still
 * gives cover by contact; a town's own buildings and streets are read as
 * one piece of urban ground, exactly as before, since Dirtside plays the
 * town, not its pieces (p. 46).
 */

import { describe, expect, it } from 'vitest'
import { newVehicleDesign } from '../design'
import type { InfantryElement, VehicleDesign } from '../types'
import { createGame } from './game'
import { infantryPosition, touchesCover, vehiclePosture } from './tableFire'
import { lineOfSight, pathCost } from './terrain'
import type { ElementSetup, GameSetup, Point, TerrainFeature, UnitSetup } from './types'

const tank: VehicleDesign = { ...newVehicleDesign('tank'), name: 'Tank', fireControl: 'basic', weapons: [] }

const barn: TerrainFeature = { id: 'barn', terrain: 'building', shape: { kind: 'polygon', points: [{ x: 20, y: 20 }, { x: 21, y: 20 }, { x: 21, y: 21 }, { x: 20, y: 21 }] }, label: 'barn' }
const ruin: TerrainFeature = { id: 'ruin', terrain: 'rubble', shape: { kind: 'polygon', points: [{ x: 30, y: 20 }, { x: 31, y: 20 }, { x: 31, y: 21 }, { x: 30, y: 21 }] }, label: 'ruin' }
const town: TerrainFeature = { id: 'town', terrain: 'urban', shape: { kind: 'polygon', points: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 18 }, { x: 10, y: 18 }] }, label: 'town' }
const house: TerrainFeature = { id: 'house', terrain: 'building', partOf: 'town', shape: { kind: 'polygon', points: [{ x: 12, y: 12 }, { x: 14, y: 12 }, { x: 14, y: 14 }, { x: 12, y: 14 }] } }

function setupWith(terrain: TerrainFeature[], positions: { id: string; at: Point; infantry?: InfantryElement }[]): GameSetup {
  const elements: ElementSetup[] = positions.map((p, i) => ({ id: p.id, name: p.id, position: p.at, facing: 0, leader: i === 0, ...(p.infantry ? { infantry: p.infantry } : { vehicle: structuredClone(tank) }) }))
  const unit: UnitSetup = { id: 'u1', name: 'Unit', quality: 'regular', leadership: 2, elements }
  return {
    name: 'test',
    seed: 1,
    battle: 'encounter',
    table: { width: 48, depth: 36, terrain, objectives: [] },
    sides: [
      { id: 'north', name: 'North', units: [unit] },
      { id: 'south', name: 'South', units: [] },
    ],
    turnLimit: null,
  }
}

describe("a lone building (Dirtside p. 46)", () => {
  it('blocks line of sight on its own footprint', () => {
    expect(lineOfSight({ x: 20.5, y: 17 }, { x: 20.5, y: 24 }, [barn]).clear).toBe(false)
    expect(lineOfSight({ x: 20.5, y: 17 }, { x: 20.5, y: 24 }, []).clear).toBe(true)
  })

  it('does not impede movement: every mobility family goes at normal on it, same as open ground', () => {
    const cost = pathCost([{ x: 19, y: 20.5 }, { x: 22, y: 20.5 }], 'tracked', [barn])
    expect(cost.blockedAt).toBeNull()
    expect(cost.legs.every((l) => l.going === 'normal')).toBe(true)
  })

  it('gives soft cover by contact, to a vehicle and to infantry', () => {
    const setup = setupWith([barn], [{ id: 'v', at: { x: 20, y: 20 } }, { id: 'i', at: { x: 20, y: 20 }, infantry: { troops: 'line', team: 'rifle' } }])
    const state = createGame(setup)
    expect(touchesCover(state, { x: 20, y: 20 })).toBe(true)
    expect(touchesCover(state, { x: 40, y: 20 })).toBe(false)
    expect(vehiclePosture(state, state.elements.v!, state.units.u1!)).toBe('soft-cover')
    expect(infantryPosition(state, state.elements.i!)).toBe('soft-cover')
  })
})

describe('a ruin (Dirtside p. 46: "no longer block line of sight... may still claim Cover in them")', () => {
  it('no longer blocks line of sight, but still gives cover by contact', () => {
    expect(lineOfSight({ x: 30.5, y: 17 }, { x: 30.5, y: 24 }, [ruin]).clear).toBe(true)
    const setup = setupWith([ruin], [{ id: 'i', at: { x: 30, y: 20 }, infantry: { troops: 'line', team: 'rifle' } }])
    const state = createGame(setup)
    expect(touchesCover(state, { x: 30, y: 20 })).toBe(true)
    expect(infantryPosition(state, state.elements.i!)).toBe('soft-cover')
  })

  it('impedes movement like rough ground for every mobility family', () => {
    const rough: TerrainFeature = { id: 'g', terrain: 'rough', shape: { kind: 'rect', x: 0, y: 0, width: 48, height: 36 } }
    for (const family of ['infantry', 'low-wheeled', 'high-wheeled', 'tracked', 'gev', 'grav', 'walker'] as const) {
      const onRough = pathCost([{ x: 5, y: 5 }, { x: 5, y: 6 }], family, [rough])
      const onRubble = pathCost([{ x: 30, y: 20 }, { x: 30, y: 21 }], family, [ruin])
      expect(onRubble.blockedAt === null).toBe(onRough.blockedAt === null)
      if (!onRubble.blockedAt) expect(onRubble.legs[0]!.going).toBe(onRough.legs[0]!.going)
    }
  })
})

describe("a town's own buildings (Dirtside p. 46: played as one urban area, not its pieces)", () => {
  it('reads as urban ground for cover and movement, not as a separate building', () => {
    const setup = setupWith([town, house], [{ id: 'i', at: { x: 13, y: 13 }, infantry: { troops: 'line', team: 'rifle' } }])
    const state = createGame(setup)
    expect(infantryPosition(state, state.elements.i!)).toBe('urban')
    expect(touchesCover(state, { x: 13, y: 13 })).toBe(true)
    // The town's own building does not, on its own, screen sight the way a lone building does — the urban area does.
    expect(lineOfSight({ x: 13, y: 13 }, { x: 13, y: 30 }, [town, house]).blockedBy?.id).toBe('town')
  })
})
