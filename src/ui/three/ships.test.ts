import { describe, expect, it } from 'vitest'
import { designById } from '../../data/ships'
import { createShipState, type ShipState } from '../../engine/game'
import { damageLevelOf } from '../../engine/victory'
import type { ShipDesign } from '../../engine/types'
import { sensorSafeLevel } from './ships'

const design = designById('esu-heavy-cruiser') as ShipDesign

/** Rows of one box each, so `hullMarked` and rows-gone are the same number. */
const ROW_SIZES = Array.from({ length: design.hullBoxes }, () => 1)

function hull(hullMarked: number): ShipState {
  const ship = createShipState({
    id: 's',
    side: 'a',
    design,
    placement: { position: { x: 0, y: 0 }, facing: 12 },
    hullRowSizes: ROW_SIZES,
  })
  ship.hullMarked = hullMarked
  return ship
}

/** Every offensive weapon and FireCon knocked out — 12.1's own classified fit-out detail. */
function withFitOutGone(ship: ShipState): ShipState {
  for (const weapon of design.weapons) ship.destroyedSystems.add(weapon.id)
  for (const system of design.systems) {
    if (system.kind === 'firecon' || system.kind === 'advanced-firecon') ship.destroyedSystems.add(system.id)
  }
  return ship
}

describe('sensorSafeLevel (R1: the sensor rules keep fit-out-derived crippled a secret)', () => {
  it('agrees with the full rule when only hull rows drive the result', () => {
    const untouched = hull(0)
    expect(sensorSafeLevel(untouched)).toBe('unhurt')
    expect(sensorSafeLevel(untouched)).toBe(damageLevelOf(untouched))

    const oneRow = hull(1)
    expect(sensorSafeLevel(oneRow)).toBe('damaged')
    expect(sensorSafeLevel(oneRow)).toBe(damageLevelOf(oneRow))

    const twoRows = hull(2)
    expect(sensorSafeLevel(twoRows)).toBe('crippled')
    expect(sensorSafeLevel(twoRows)).toBe(damageLevelOf(twoRows))
  })

  it('does not call a ship crippled from a destroyed fit-out alone, unlike the full rule', () => {
    const ship = withFitOutGone(hull(0))
    // The full, fit-out-aware rule (what the flat map's Ssd/BattleResult use
    // once fog no longer applies) does call this crippled — that is the
    // secret the sensor rules keep from an opposing side mid-battle.
    expect(damageLevelOf(ship)).toBe('crippled')
    // The hull track alone shows nothing wrong: no boxes marked at all.
    expect(sensorSafeLevel(ship)).toBe('unhurt')
  })

  it('still reads "damaged" from a genuinely public hull box, fit-out gone or not', () => {
    const ship = withFitOutGone(hull(1))
    expect(sensorSafeLevel(ship)).toBe('damaged')
  })

  it('reports a destroyed hull the same as the full rule — destruction is never classified', () => {
    const ship = hull(design.hullBoxes)
    ship.destroyed = true
    expect(sensorSafeLevel(ship)).toBe('destroyed')
    expect(sensorSafeLevel(ship)).toBe(damageLevelOf(ship))
  })
})
