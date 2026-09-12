import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { hullRowBounds } from './combat'
import { advancePhase, createGame, createShipState, hullRowBoundaries } from './game'
import { hullRows as ssdHullRows } from '../ui/Ssd'
import { SHIP_DESIGNS } from '../data/ships'
import type { HullRows, ShipDesign } from './types'

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

/**
 * Boarding parties, from the gun to the SSD.
 *
 * Four modules have to agree for a marine to end up aboard an enemy ship: the
 * weapon resolver says how many got across (5.9, 5.18), `combat.ts` carries
 * the count out of the damage pipeline, `actions.ts` writes it onto the
 * target, and `game.ts` holds it. Each is right on its own and the marines
 * still vanish if any link drops the field, which is exactly the kind of gap
 * a per-module test cannot see.
 */
describe('boarding parties', () => {
  const boarder = (id: string): ShipDesign => ({
    id,
    name: id,
    faction: 'Test',
    group: 'cruiser',
    mass: 80,
    hullClass: 'average',
    hullRows: 4,
    hullBoxes: 24,
    drive: { thrust: 4, advanced: false },
    ftl: 'none',
    streamlining: 'none',
    armour: { layers: [], regenerative: false },
    screens: { level: 0, generators: 0, advanced: false },
    weapons: [
      {
        id: 'bt1',
        label: 'Boarding Torpedo',
        weaponClass: 'boarding-torpedo',
        rating: 1,
        variant: 'standard',
        arcs: ['F', 'FS', 'FP', 'A', 'AS', 'AP'],
        mass: 3,
        points: 9,
      },
    ],
    turrets: [],
    systems: [{ id: 'fc1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 }],
    fighterBays: [],
    gunboats: [],
    additionalDamageControlParties: 1,
    marineParties: 4,
    points: 100,
  })

  it('fight the crew when phase 12 comes round', () => {
    // The other half of the chain: parties land, then 12.7 resolves. Before
    // the back half of the rulebook could be read this phase was a stub that
    // only listed who was aboard.
    const game = createGame({
      seed: 4,
      sides: [{ id: 'a' }, { id: 'b' }],
      ships: [
        createShipState({
          id: 'boarder',
          side: 'a',
          design: boarder('Boarder'),
          placement: { position: { x: 0, y: 0 }, facing: 6 },
        }),
        createShipState({
          id: 'prize',
          side: 'b',
          design: boarder('Prize'),
          placement: { position: { x: 0, y: 6 }, facing: 12 },
        }),
      ],
    })
    const prize = game.ships[1]
    prize.boarders = [{ side: 'a', parties: 4, landedTurn: 1 }]
    let guard = 40
    while (game.phase !== 'boarding' && guard-- > 0) advancePhase(game)
    const before = prize.boarders[0].parties
    expect(applyAction(game, { type: 'resolve-boarding' }).refused).toBeUndefined()

    const after = prize.boarders.reduce((sum, p) => sum + p.parties, 0)
    const hurt = prize.hullMarked > 0
    // Something has to have happened: the crew killed some, or the survivors
    // opened up the hull, or both.
    expect(after < before || hurt, 'phase 12 did nothing at all').toBe(true)
    expect(game.log.some((entry) => entry.kind === 'boarding')).toBe(true)
  })

  it('land on the ship they were fired at, stamped with the turn', () => {
    // Fire enough torpedoes across enough seeds that at least one connects:
    // 5.18 uses the projectile to-hit table, so a single shot can miss.
    let landed = 0
    let stamped = 0
    for (let seed = 0; seed < 30; seed++) {
      const game = createGame({
        seed,
        sides: [{ id: 'a' }, { id: 'b' }],
        ships: [
          createShipState({
            id: 'boarder',
            side: 'a',
            design: boarder('Boarder'),
            placement: { position: { x: 0, y: 0 }, facing: 6 },
          }),
          createShipState({
            id: 'prize',
            side: 'b',
            design: boarder('Prize'),
            placement: { position: { x: 0, y: 6 }, facing: 12 },
          }),
        ],
      })
      let guard = 40
      while (game.phase !== 'ship-fire' && guard-- > 0) advancePhase(game)
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'boarder',
        weaponId: 'bt1',
        targetId: 'prize',
      })
      const prize = game.ships[1]
      const aboard = prize.boarders.reduce((sum, party) => sum + party.parties, 0)
      if (aboard > 0) {
        landed += aboard
        if (prize.boarders.every((p) => p.side === 'a' && p.landedTurn === game.turn)) stamped += 1
      }
    }
    expect(landed, 'no boarding torpedo in thirty ever put anyone aboard').toBeGreaterThan(0)
    expect(stamped).toBeGreaterThan(0)
  })
})
