import { describe, expect, it } from 'vitest'

import { applyAction, setOptionalRules, type OptionalRules } from './actions'
import {
  advancePhase,
  createGame,
  createShipState,
  markHullBoxes,
  type GameState,
  type ShipState,
} from './game'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * What happens after the boarders win, and the three rules around it
 * (12.7 - 12.10).
 *
 * `resolve-boarding` set `ship.captured` and nothing anywhere read it: a prize
 * went on firing, moving and taking orders for the navy that had just lost it.
 * `boardingContinues`, `capturedShipDestroyed`, `boardersAtRiskInThreshold`,
 * `fleetMorale`, `strikeColorsCheck`, `nearestEnemyVessel`, `isCivilWar` and
 * `civilWarDrm` had no caller at all.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

function hull(id: string, side: string, over: Partial<ShipDesign> = {}): ShipState {
  return createShipState({
    id,
    side,
    design: { ...(designById('esu-heavy-cruiser') as ShipDesign), ...over },
    placement: { position: { x: side === 'a' ? 40 : 46, y: 40 }, facing: side === 'a' ? 3 : 9 },
    velocity: 4,
  })
}

function battle(rules: OptionalRules = {}, ships?: ShipState[]): GameState {
  const game = createGame({
    seed: 0x9ea1,
    sides: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }],
    table: { width: 96, height: 72 },
    ships: ships ?? [hull('mine', 'a'), hull('theirs', 'b')],
  })
  setOptionalRules(game, rules)
  return game
}

const shipOf = (game: GameState, id: string): ShipState =>
  game.ships.find((ship) => ship.id === id)!

describe('a prize (12.7)', () => {
  /** Put enough enemy parties aboard to carry her, and run phase 12. */
  function capture(game: GameState, id = 'mine'): ShipState {
    const ship = shipOf(game, id)
    ship.hullMarked = ship.design.hullBoxes - 1
    ship.marinesAboard = 0
    ship.damageControl = []
    ship.boarders = [{ side: ship.side === 'a' ? 'b' : 'a', parties: 12, landedTurn: 0 }]
    advanceTo(game, 'boarding')
    applyAction(game, { type: 'resolve-boarding' })
    return shipOf(game, id)
  }

  it('is carried, and remembers who took her', () => {
    const game = battle()
    const prize = capture(game)
    expect(prize.captured).toBe(true)
    expect(prize.capturedBy).toBe('b')
    expect(prize.destroyed, 'a prize is not a wreck').toBe(false)
  })

  it('takes no orders, does not move and does not fire', () => {
    const game = battle()
    capture(game)
    advanceTo(game, 'orders')
    expect(applyAction(game, { type: 'plot-accel', shipId: 'mine', accel: 1 }).refused).toMatch(
      /prize/,
    )
    advanceTo(game, 'move-ships')
    expect(applyAction(game, { type: 'move-ship', shipId: 'mine' }).refused).toMatch(/prize/)
    advanceTo(game, 'ship-fire')
    const weapon = shipOf(game, 'mine').design.weapons[0]
    expect(
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'mine',
        weaponId: weapon.id,
        targetId: 'theirs',
      }).refused,
    ).toMatch(/prize/)
  })

  it('dies to a single point of damage', () => {
    const game = battle()
    const prize = capture(game)
    expect(prize.destroyed).toBe(false)
    markHullBoxes(prize, 1)
    expect(prize.destroyed, '12.7: one point is enough to deny the enemy a prize').toBe(true)
  })

  it('is not destroyed by one point while she is still her own', () => {
    const game = battle()
    const ship = shipOf(game, 'mine')
    markHullBoxes(ship, 1)
    expect(ship.destroyed).toBe(false)
  })

  it('keeps fighting for herself after she leaves the table', () => {
    const game = battle()
    const ship = shipOf(game, 'mine')
    ship.boarders = [{ side: 'b', parties: 1, landedTurn: 0 }]
    ship.offTable = true
    advanceTo(game, 'boarding')
    applyAction(game, { type: 'resolve-boarding' })
    // 12.7: "If a ship jumps away into FTL with enemy boarders on board, the
    // battle for control of the ship continues."
    expect(game.log.some((entry) => entry.kind === 'boarding')).toBe(true)
  })
})

describe('parties in a threshold check (12.7)', () => {
  function crossARow(game: GameState, id: string, cause: 'weapons' | 'boarding'): void {
    const ship = shipOf(game, id)
    const rowSize = Math.ceil(ship.design.hullBoxes / ship.design.hullRows)
    markHullBoxes(ship, rowSize, cause)
    advanceTo(game, 'threshold')
    applyAction(game, { type: 'threshold-sweep' })
  }

  it('kills Marines and boarders when the damage came from weapons', () => {
    const game = battle()
    const ship = shipOf(game, 'mine')
    ship.marinesAboard = 6
    ship.boarders = [{ side: 'b', parties: 6, landedTurn: 0 }]
    crossARow(game, 'mine', 'weapons')
    const after = shipOf(game, 'mine')
    const survivors = after.boarders.reduce((sum, force) => sum + force.parties, 0)
    expect(after.marinesAboard + survivors, 'nobody was rolled for at all').toBeLessThan(12)
  })

  it('leaves both alone when the boarders themselves caused it', () => {
    const game = battle()
    const ship = shipOf(game, 'mine')
    ship.marinesAboard = 6
    ship.boarders = [{ side: 'b', parties: 6, landedTurn: 0 }]
    crossARow(game, 'mine', 'boarding')
    const after = shipOf(game, 'mine')
    expect(after.marinesAboard).toBe(6)
    expect(after.boarders[0].parties).toBe(6)
  })

  it('spares a party that landed this turn', () => {
    const game = battle()
    advanceTo(game, 'threshold')
    const ship = shipOf(game, 'mine')
    ship.marinesAboard = 0
    ship.boarders = [{ side: 'b', parties: 6, landedTurn: game.turn }]
    const rowSize = Math.ceil(ship.design.hullBoxes / ship.design.hullRows)
    markHullBoxes(ship, rowSize, 'weapons')
    applyAction(game, { type: 'threshold-sweep' })
    expect(shipOf(game, 'mine').boarders[0].parties).toBe(6)
  })
})

describe('striking the colors (12.9)', () => {
  it('never happens unless the table asked for it', () => {
    const game = battle()
    const ship = shipOf(game, 'mine')
    for (let turn = 0; turn < 6; turn++) {
      markHullBoxes(ship, Math.ceil(ship.design.hullBoxes / ship.design.hullRows))
      advanceTo(game, 'threshold')
      applyAction(game, { type: 'threshold-sweep' })
      if (ship.destroyed) break
      advanceTo(game, 'orders')
    }
    expect(shipOf(game, 'mine').captured).toBe(false)
  })

  it('hands the ship to the nearest enemy when she strikes', () => {
    // Enough rows to make the roll easy: at the third the target is 4+.
    const game = battle({ strikeColors: true })
    const ship = shipOf(game, 'mine')
    let struck = false
    for (let turn = 0; turn < 8 && !struck; turn++) {
      markHullBoxes(ship, Math.ceil(ship.design.hullBoxes / ship.design.hullRows))
      advanceTo(game, 'threshold')
      applyAction(game, { type: 'threshold-sweep' })
      struck = shipOf(game, 'mine').captured
      if (shipOf(game, 'mine').destroyed) break
      advanceTo(game, 'orders')
    }
    expect(struck, 'eight hull rows and she never once considered it').toBe(true)
    expect(shipOf(game, 'mine').capturedBy).toBe('b')
    expect(game.log.some((entry) => /strikes her colors/.test(entry.text ?? ''))).toBe(true)
  })
})

describe('fleet morale (12.8)', () => {
  it('says so once, when half the mass is gone', () => {
    const game = battle({}, [hull('a1', 'a'), hull('a2', 'a'), hull('b1', 'b')])
    shipOf(game, 'a1').destroyed = true
    advanceTo(game, 'threshold')
    applyAction(game, { type: 'threshold-sweep' })
    const said = game.log.filter((entry) => /enough for a commander to break off/.test(entry.text ?? ''))
    expect(said.length).toBe(1)
    expect(said[0].side).toBe('a')

    // And not again on the next sweep.
    advanceTo(game, 'orders')
    advanceTo(game, 'threshold')
    applyAction(game, { type: 'threshold-sweep' })
    expect(
      game.log.filter((entry) => /enough for a commander to break off/.test(entry.text ?? '')).length,
    ).toBe(1)
  })

  it('counts a prize as lost', () => {
    const game = battle({}, [hull('a1', 'a'), hull('a2', 'a'), hull('b1', 'b')])
    shipOf(game, 'a1').captured = true
    advanceTo(game, 'threshold')
    applyAction(game, { type: 'threshold-sweep' })
    expect(game.log.some((entry) => /enough for a commander to break off/.test(entry.text ?? ''))).toBe(
      true,
    )
  })
})

describe('civil war (12.10)', () => {
  function shots(rules: OptionalRules, designs: [string, string]): number {
    const game = createGame({
      seed: 0x0c1,
      sides: [{ id: 'a' }, { id: 'b' }],
      table: { width: 96, height: 72 },
      ships: [
        createShipState({
          id: 'mine',
          side: 'a',
          design: designById(designs[0]) as ShipDesign,
          placement: { position: { x: 40, y: 40 }, facing: 3 },
        }),
        createShipState({
          id: 'theirs',
          side: 'b',
          design: designById(designs[1]) as ShipDesign,
          placement: { position: { x: 46, y: 40 }, facing: 9 },
        }),
      ],
    })
    setOptionalRules(game, rules)
    advanceTo(game, 'ship-fire')
    let damage = 0
    for (const weapon of shipOf(game, 'mine').design.weapons) {
      if (!weapon.arcs.includes('F')) continue
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'mine',
        weaponId: weapon.id,
        targetId: 'theirs',
      })
    }
    const target = shipOf(game, 'theirs')
    damage = target.hullMarked + target.armourMarked.reduce((sum, n) => sum + n, 0)
    return damage
  }

  it('helps two fleets of the same navy', () => {
    const same = ['esu-heavy-cruiser', 'esu-battlecruiser'] as [string, string]
    expect(shots({ civilWar: true }, same)).toBeGreaterThan(shots({}, same))
  })

  it('does nothing when the navies differ, even with the rule on', () => {
    const mixed = ['esu-heavy-cruiser', 'nac-battlecruiser'] as [string, string]
    expect(shots({ civilWar: true }, mixed)).toBe(shots({}, mixed))
  })
})
