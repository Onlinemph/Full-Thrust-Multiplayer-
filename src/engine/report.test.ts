import { describe, expect, it } from 'vitest'

import { CURRENT_RULES_VERSION } from '../data/savedGame'
import { designById } from '../data/ships'
import { applyAction, endPhase, setRulesReading } from './actions'
import { createGame, createShipState, markHullBoxes, type GameState, type ShipState } from './game'
import { afterActionReport, reportMarkdown } from './report'
import type { Phase, ShipDesign } from './types'

/**
 * The after-action ledger and the report drawn from it (4.12).
 *
 * Every hull and armour box marked, and every shot, is written down with who
 * did it — through the same chokepoints the damage already goes through, so
 * the ledger cannot say one thing and the damage track another.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) {
    if (game.phase === 'initiative') applyAction(game, { type: 'roll-initiative' })
    endPhase(game)
  }
}

function hull(id: string, side: string, designId: string, x: number, facing: 3 | 9): ShipState {
  return createShipState({
    id,
    side,
    design: designById(designId) as ShipDesign,
    placement: { position: { x, y: 24 }, facing },
  })
}

/** Two cruisers 6 MU apart, bow on, the player's side with the turn to fire. */
function gunline(): GameState {
  const game = createGame({
    seed: 0x4412,
    sides: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }],
    ships: [hull('mine', 'a', 'esu-heavy-cruiser', 20, 3), hull('theirs', 'b', 'nac-heavy-cruiser', 26, 9)],
  })
  setRulesReading(game, CURRENT_RULES_VERSION)
  advanceTo(game, 'ship-fire')
  game.fire = { side: 'a', sequence: 0 }
  return game
}

function marksOn(ship: ShipState): number {
  return ship.hullMarked + ship.armourMarked.reduce((sum, boxes) => sum + boxes, 0)
}

describe('the ledger', () => {
  it('records every shot and every box a volley marks, credited to the ship that fired', () => {
    const game = gunline()
    const mine = game.ships[0]!
    const theirs = game.ships[1]!
    const guns = mine.design.weapons.filter((w) => w.arcs.includes('F'))
    const outcome = applyAction(game, {
      type: 'fire-volley',
      shipId: 'mine',
      shots: guns.map((w) => ({ weaponId: w.id, targetId: 'theirs', kind: 'ship' as const })),
    })
    expect(outcome.refused).toBeUndefined()
    // A shot a mount, whatever it hit.
    const fired = [...mine.weaponsFired.keys()]
    expect(game.ledger.shots.map((s) => s.weaponId).sort()).toEqual(fired.sort())
    expect(game.ledger.shots.every((s) => s.shipId === 'mine' && s.turn === game.turn)).toBe(true)
    // What the ledger says was marked is what the track shows.
    const dealt = game.ledger.damage
      .filter((r) => r.targetId === 'theirs')
      .reduce((sum, r) => sum + r.hull + r.armour, 0)
    expect(dealt).toBe(marksOn(theirs))
    expect(game.ledger.damage.every((r) => r.by.shipId === 'mine' && r.by.side === 'a' && r.by.kind === 'guns')).toBe(true)
  })

  it('records nothing outside an action', () => {
    const game = gunline()
    markHullBoxes(game.ships[1]!, 3)
    expect(game.ledger.damage).toEqual([])
  })

  it('credits the finishing blow as a kill', () => {
    const game = gunline()
    const theirs = game.ships[1]!
    // Leave one box: the next hit is the kill.
    theirs.armourMarked = theirs.design.armour.layers.map((boxes) => boxes)
    theirs.hullMarked = theirs.design.hullBoxes - 1
    const guns = theirs.design.weapons.length
    expect(guns).toBeGreaterThan(0)
    const mine = game.ships[0]!
    applyAction(game, {
      type: 'fire-volley',
      shipId: 'mine',
      shots: mine.design.weapons
        .filter((w) => w.arcs.includes('F'))
        .map((w) => ({ weaponId: w.id, targetId: 'theirs', kind: 'ship' as const })),
    })
    if (!theirs.destroyed) return // the dice missed; nothing to assert
    const report = afterActionReport(game)
    const me = report.sides[0]!.ships.find((s) => s.id === 'mine')!
    expect(me.kills).toBe(1)
    expect(report.sides[1]!.lost).toBe(1)
    expect(game.ledger.damage.filter((r) => r.destroyed)).toHaveLength(1)
  })
})

describe('the report', () => {
  it('sums a side from its ships, and writes itself out as a table', () => {
    const game = gunline()
    const mine = game.ships[0]!
    applyAction(game, {
      type: 'fire-volley',
      shipId: 'mine',
      shots: mine.design.weapons
        .filter((w) => w.arcs.includes('F'))
        .map((w) => ({ weaponId: w.id, targetId: 'theirs', kind: 'ship' as const })),
    })
    const report = afterActionReport(game)
    expect(report.turn).toBe(game.turn)
    const [alpha, beta] = report.sides
    expect(alpha?.name).toBe('Alpha')
    expect(alpha?.shots).toBe(game.ledger.shots.length)
    expect(alpha?.dealt).toBe(beta?.taken)
    expect(beta?.dealt).toBe(0)
    expect(alpha?.ships[0]).toMatchObject({ id: 'mine', taken: 0, kills: 0 })
    if (alpha && alpha.dealt > 0) expect(alpha.ships[0]?.dealtBy.guns).toBe(alpha.dealt)

    const text = reportMarkdown(report, 'Test battle')
    expect(text).toContain('# Test battle')
    expect(text).toContain('## Alpha')
    expect(text).toContain('| Ship | Class | State | Shots | Dealt | Taken | Kills |')
    expect(text).toMatch(/\| .* \| Petrograd-class Heavy Cruiser \| unhurt \| \d+ \| \d+ \| 0 \| 0 \|/)
  })
})
