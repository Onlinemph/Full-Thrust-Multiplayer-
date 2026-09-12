import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { advancePhase, createGame, createShipState, damageControlParties, availableDamageControlParties, type GameState, type ShipState } from './game'
import { repairTargets, DRIVE_SYSTEM_ID } from './threshold'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * Damage control as a decision (10.4, phase 14).
 *
 * `damageControlPhase` skips any ship with nothing assigned, and nothing ever
 * assigned: "Make repair rolls" repaired nothing at all, in every battle, from
 * the moment the phase was written. The choice 10.4 is *about* — two parties
 * and four things broken, so two repairs at even odds or one at better ones —
 * had nowhere to be made.
 */

function repairable(): { game: GameState; ship: ShipState } {
  const ship = createShipState({
    id: 'hurt',
    side: 'a',
    design: designById('esu-heavy-cruiser') as ShipDesign,
    placement: { position: { x: 20, y: 20 }, facing: 3 },
  })
  const game = createGame({
    seed: 0xd0c,
    sides: [{ id: 'a' }, { id: 'b' }],
    ships: [ship],
  })
  return { game, ship }
}

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

describe('what can be repaired', () => {
  it('is nothing on an undamaged hull', () => {
    const { ship } = repairable()
    expect(repairTargets(ship)).toEqual([])
  })

  it('offers a knocked-out system by its printed label', () => {
    const { ship } = repairable()
    const firecon = ship.design.systems.find((s) => s.kind === 'firecon')
    if (!firecon) throw new Error('no firecon')
    ship.destroyedSystems.add(firecon.id)
    expect(repairTargets(ship).map((t) => t.id)).toContain(firecon.id)
    expect(repairTargets(ship).find((t) => t.id === firecon.id)?.label).toBe(firecon.label)
  })

  it('offers the main drive, which is a ladder rather than a symbol', () => {
    const { ship } = repairable()
    ship.driveHits = 2
    const drive = repairTargets(ship).find((t) => t.id === DRIVE_SYSTEM_ID)
    expect(drive).toBeDefined()
    expect(drive?.label).toContain('2 hits')
  })

  it('leaves out what a needle beam took (5.13)', () => {
    const { ship } = repairable()
    const firecon = ship.design.systems.find((s) => s.kind === 'firecon')
    if (!firecon) throw new Error('no firecon')
    ship.destroyedSystems.add(firecon.id)
    ship.unrepairable.add(firecon.id)
    expect(repairTargets(ship).map((t) => t.id)).not.toContain(firecon.id)
  })

  it('offers nothing on a hull with no crew left', () => {
    const { ship } = repairable()
    ship.driveHits = 1
    ship.ongoing.push({
      id: 'ls',
      source: 'life-support-failed',
      appliedTurn: 1,
      expiresAfterTurn: null,
      note: 'crew gone',
    })
    expect(repairTargets(ship)).toEqual([])
  })
})

describe('assigning parties (10.4)', () => {
  it('puts a party on a system and repairs it in the phase', () => {
    const { game, ship } = repairable()
    ship.driveHits = 1
    advanceTo(game, 'damage-control')
    expect(
      applyAction(game, {
        type: 'assign-damage-control',
        shipId: ship.id,
        systemId: DRIVE_SYSTEM_ID,
        parties: 1,
      }).refused,
    ).toBeUndefined()
    expect(ship.damageControl).toHaveLength(1)
    applyAction(game, { type: 'resolve-damage-control' })
    expect(game.log.some((entry) => entry.kind === 'damage-control')).toBe(true)
    // Assignments are spent whether or not the roll succeeded.
    expect(ship.damageControl).toEqual([])
  })

  it('repairs nothing when nobody was assigned, which is what used to happen every turn', () => {
    const { game, ship } = repairable()
    ship.driveHits = 1
    advanceTo(game, 'damage-control')
    applyAction(game, { type: 'resolve-damage-control' })
    expect(game.log.some((entry) => entry.kind === 'damage-control')).toBe(false)
    expect(ship.driveHits).toBe(1)
  })

  it('stops at three parties on one system', () => {
    const { game, ship } = repairable()
    ship.driveHits = 1
    advanceTo(game, 'damage-control')
    for (let i = 0; i < 5; i += 1) {
      applyAction(game, {
        type: 'assign-damage-control',
        shipId: ship.id,
        systemId: DRIVE_SYSTEM_ID,
        parties: 1,
      })
    }
    expect(ship.damageControl[0]?.parties).toBeLessThanOrEqual(3)
  })

  it('cannot assign parties the ship does not have', () => {
    const { game, ship } = repairable()
    ship.driveHits = 1
    advanceTo(game, 'damage-control')
    const total = damageControlParties(ship)
    for (let i = 0; i < total; i += 1) {
      applyAction(game, {
        type: 'assign-damage-control',
        shipId: ship.id,
        systemId: `spare-${i}`,
        parties: 1,
      })
    }
    expect(availableDamageControlParties(ship)).toBe(0)
    const refusal = applyAction(game, {
      type: 'assign-damage-control',
      shipId: ship.id,
      systemId: DRIVE_SYSTEM_ID,
      parties: 1,
    })
    expect(refusal.refused).toContain('Not enough damage control parties')
  })

  it('is refused outside phase 14', () => {
    const { game, ship } = repairable()
    ship.driveHits = 1
    const refusal = applyAction(game, {
      type: 'assign-damage-control',
      shipId: ship.id,
      systemId: DRIVE_SYSTEM_ID,
      parties: 1,
    })
    expect(refusal.refused).toContain('phase 14')
  })

  it('actually gets the drive back, given enough tries', () => {
    // Three parties repair on a 1, 2 or 3 — half the time.
    let repaired = 0
    for (let seed = 0; seed < 20; seed += 1) {
      const ship = createShipState({
        id: 'hurt',
        side: 'a',
        design: designById('esu-heavy-cruiser') as ShipDesign,
        placement: { position: { x: 20, y: 20 }, facing: 3 },
      })
      ship.driveHits = 1
      const game = createGame({ seed, sides: [{ id: 'a' }], ships: [ship] })
      advanceTo(game, 'damage-control')
      applyAction(game, {
        type: 'assign-damage-control',
        shipId: ship.id,
        systemId: DRIVE_SYSTEM_ID,
        parties: 3,
      })
      applyAction(game, { type: 'resolve-damage-control' })
      if (ship.driveHits === 0) repaired += 1
    }
    expect(repaired).toBeGreaterThan(0)
    expect(repaired).toBeLessThan(20)
  })
})
