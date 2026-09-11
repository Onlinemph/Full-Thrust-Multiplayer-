import { describe, expect, it } from 'vitest'

import { hullRowBounds } from './combat'
import { createShipState, hullRowBoundaries } from './game'
import { hullRows as ssdHullRows } from '../ui/Ssd'
import { SHIP_DESIGNS } from '../data/ships'
import type { HullRows } from './types'

/**
 * Cross-module agreement.
 *
 * The hull track is split into rows in three places — the damage pipeline, the
 * game state, and the ship form on screen — because each needs it for something
 * different. They must agree exactly: the row boundary IS the threshold point
 * (4.11), so a form that draws the rows one way while the engine checks them
 * another would show a player the wrong number for the next check, which is the
 * single number they plan around.
 *
 * No single module's own tests can catch this, which is why it is its own file.
 */
describe('hull rows', () => {
  it('are split the same way by the engine, the state and the form', () => {
    for (const design of SHIP_DESIGNS) {
      const ship = createShipState({
        id: 't',
        side: 'a',
        design,
        placement: { position: { x: 0, y: 0 }, facing: 12 },
      })

      const fromCombat = hullRowBounds(design.hullBoxes, design.hullRows)
      const fromState = hullRowBoundaries(ship)
      const fromForm = ssdHullRows(design.hullBoxes, design.hullRows)

      // The form yields row sizes; the other two yield cumulative boundaries.
      const formBounds: number[] = []
      let running = 0
      for (const size of fromForm) formBounds.push((running += size))

      expect(fromState, design.id).toEqual(fromCombat)
      expect(formBounds, design.id).toEqual(fromCombat)
      expect(fromCombat[fromCombat.length - 1], design.id).toBe(design.hullBoxes)
    }
  })

  it('never loses or invents a box, at any size or row count', () => {
    for (let boxes = 3; boxes <= 130; boxes++) {
      for (const rows of [3, 4, 5, 6] as HullRows[]) {
        if (boxes < rows) continue
        const sizes = ssdHullRows(boxes, rows)
        expect(sizes, `${boxes}/${rows}`).toHaveLength(rows)
        expect(sizes.reduce((a, b) => a + b, 0), `${boxes}/${rows}`).toBe(boxes)
        expect(Math.min(...sizes), `${boxes}/${rows}`).toBeGreaterThan(0)
        expect(hullRowBounds(boxes, rows)[rows - 1], `${boxes}/${rows}`).toBe(boxes)
      }
    }
  })
})
