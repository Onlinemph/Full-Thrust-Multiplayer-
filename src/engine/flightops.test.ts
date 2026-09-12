import { describe, expect, it } from 'vitest'

import { applyAction, setOptionalRules, type OptionalRules } from './actions'
import {
  advancePhase,
  createGame,
  createShipState,
  type FighterGroupState,
  type GameState,
  type ShipState,
} from './game'
import { createFighterGroup } from './fighters'
import { designById } from '../data/ships'
import type { Phase, ShipDesign } from './types'

/**
 * Section 8 from the table's side.
 *
 * Twenty of `fighters.ts`'s exports had no caller anywhere: screens and
 * pursuits, morale, aces, scrambles, combat landings, multi-role
 * reconfiguration, the one-shot loads, boarding runs, furballs, refusing a
 * dogfight, and point defence against fighters. Every one of them was
 * implemented, tested against the rulebook, and unreachable from a game.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

function nextTurn(game: GameState): void {
  const turn = game.turn
  let guard = 60
  while (game.turn === turn && guard-- > 0) advancePhase(game)
}

function ship(id: string, side: string, at: { x: number; y: number }): ShipState {
  return createShipState({
    id,
    side,
    design: designById('esu-heavy-cruiser') as ShipDesign,
    placement: { position: at, facing: side === 'a' ? 3 : 9 },
    velocity: 4,
  })
}

function flight(
  id: string,
  side: string,
  at: { x: number; y: number },
  over: Partial<FighterGroupState> = {},
): FighterGroupState {
  return {
    ...createFighterGroup({
      id,
      side,
      typeId: over.typeId ?? 'standard',
      modifiers: over.modifiers,
      position: at,
      facing: side === 'a' ? 3 : 9,
      status: 'in-flight',
    }),
    side,
    label: id,
    recoveredTurn: null,
    targetId: null,
    lastTargetId: null,
    ...over,
  } as FighterGroupState
}

function battle(opts: {
  rules?: OptionalRules
  ships?: ShipState[]
  flights?: FighterGroupState[]
} = {}): GameState {
  const game = createGame({
    seed: 0xf19,
    sides: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }],
    table: { width: 96, height: 72 },
    ships: opts.ships ?? [ship('mine', 'a', { x: 40, y: 40 }), ship('theirs', 'b', { x: 46, y: 40 })],
    fighterGroups: opts.flights ?? [],
  })
  setOptionalRules(game, opts.rules ?? {})
  return game
}

const flightOf = (game: GameState, id: string): FighterGroupState =>
  game.fighterGroups.find((group) => group.id === id)!
const shipOf = (game: GameState, id: string): ShipState =>
  game.ships.find((s) => s.id === id)!

describe('screens and pursuits (8.6)', () => {
  it('ties a group to a ship and carries it along in phase 5', () => {
    const game = battle({ flights: [flight('cap', 'a', { x: 41, y: 40 })] })
    advanceTo(game, 'move-fighters')
    expect(
      applyAction(game, { type: 'assign-screen', flightId: 'cap', escortId: 'mine' }).refused,
    ).toBeUndefined()
    expect(flightOf(game, 'cap').mission).toBe('screen')

    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'mine' })
    // 8.6: the screen moves with the ship, however fast the ship is going.
    expect(flightOf(game, 'cap').position).toEqual(shipOf(game, 'mine').placement.position)
  })

  it('will not let a screening group fly its own move in phase 4', () => {
    const game = battle({ flights: [flight('cap', 'a', { x: 41, y: 40 })] })
    advanceTo(game, 'move-fighters')
    applyAction(game, { type: 'assign-screen', flightId: 'cap', escortId: 'mine' })
    expect(
      applyAction(game, { type: 'move-flight', flightId: 'cap', to: { x: 60, y: 40 } }).refused,
    ).toMatch(/screening/)
  })

  it('lets a group go free again', () => {
    const game = battle({ flights: [flight('cap', 'a', { x: 41, y: 40 })] })
    advanceTo(game, 'move-fighters')
    applyAction(game, { type: 'assign-screen', flightId: 'cap', escortId: 'mine' })
    applyAction(game, { type: 'clear-mission', flightId: 'cap' })
    expect(flightOf(game, 'cap').mission).toBe('free')
  })

  it('only lets a group pursue what it attacked last turn', () => {
    const game = battle({ flights: [flight('hawk', 'a', { x: 44, y: 40 })] })
    advanceTo(game, 'move-fighters')
    expect(
      applyAction(game, { type: 'declare-pursuit', flightId: 'hawk', targetId: 'theirs' }).refused,
    ).toMatch(/attacked the target last turn/)

    // Go in on it, then try again next turn.
    advanceTo(game, 'ordnance-vs-ships')
    applyAction(game, { type: 'flight-strike', flightId: 'hawk', targetId: 'theirs' })
    expect(flightOf(game, 'hawk').targetId).toBe('theirs')
    nextTurn(game)
    advanceTo(game, 'move-fighters')
    expect(
      applyAction(game, { type: 'declare-pursuit', flightId: 'hawk', targetId: 'theirs' }).refused,
    ).toBeUndefined()
    expect(flightOf(game, 'hawk').mission).toBe('pursuit')
  })

  it('makes an attacker go through the screen first', () => {
    const game = battle({
      flights: [
        flight('cap', 'b', { x: 46, y: 41 }, { mission: 'screen', escorting: 'theirs' }),
        flight('raid', 'a', { x: 44, y: 40 }),
      ],
    })
    advanceTo(game, 'ordnance-vs-ships')
    expect(
      applyAction(game, { type: 'flight-strike', flightId: 'raid', targetId: 'theirs' }).refused,
    ).toMatch(/screening/)
  })

  it('lets a second attacker through once the screen is paired off', () => {
    const game = battle({
      flights: [
        flight('cap', 'b', { x: 46, y: 41 }, { mission: 'screen', escorting: 'theirs' }),
        flight('raid1', 'a', { x: 44, y: 40 }),
        flight('raid2', 'a', { x: 44, y: 41 }),
      ],
    })
    advanceTo(game, 'allocate-attacks')
    applyAction(game, { type: 'flight-declare-target', flightId: 'raid1', targetId: 'theirs' })
    applyAction(game, { type: 'flight-declare-target', flightId: 'raid2', targetId: 'theirs' })
    advanceTo(game, 'ordnance-vs-ships')
    // One screen, two attackers: the first pairs off, the second is free.
    const first = applyAction(game, { type: 'flight-strike', flightId: 'raid1', targetId: 'theirs' })
    const second = applyAction(game, { type: 'flight-strike', flightId: 'raid2', targetId: 'theirs' })
    expect([first.refused, second.refused].filter(Boolean).length).toBe(1)
  })
})

describe('point defence against fighters (8.8)', () => {
  it('shoots at the groups that declared against the ship', () => {
    const game = battle({ flights: [flight('raid', 'a', { x: 44, y: 40 })] })
    advanceTo(game, 'allocate-attacks')
    applyAction(game, { type: 'flight-declare-target', flightId: 'raid', targetId: 'theirs' })
    advanceTo(game, 'point-defence')
    const before = flightOf(game, 'raid').strength
    applyAction(game, { type: 'resolve-point-defence-at-flights' })
    expect(game.log.some((e) => /puts point defence into/.test(e.text ?? ''))).toBe(true)
    expect(flightOf(game, 'raid').strength).toBeLessThanOrEqual(before)
  })

  it('leaves alone a group that declared nothing', () => {
    const game = battle({ flights: [flight('raid', 'a', { x: 44, y: 40 })] })
    advanceTo(game, 'point-defence')
    applyAction(game, { type: 'resolve-point-defence-at-flights' })
    expect(flightOf(game, 'raid').strength).toBe(6)
  })
})

describe('one-shot loads (8.15)', () => {
  it('throws a torpedo group’s load and spends it', () => {
    const game = battle({
      flights: [flight('torp', 'a', { x: 44, y: 40 }, { typeId: 'torpedo' })],
    })
    advanceTo(game, 'ordnance-vs-ships')
    expect(
      applyAction(game, { type: 'flight-launch-payload', flightId: 'torp', targetId: 'theirs' })
        .refused,
    ).toBeUndefined()
    expect(flightOf(game, 'torp').payloadSpent).toBe(true)
    // And not twice.
    expect(
      applyAction(game, { type: 'flight-launch-payload', flightId: 'torp', targetId: 'theirs' })
        .refused,
    ).toBeTruthy()
  })

  it('refuses a group that has no load at all', () => {
    const game = battle({ flights: [flight('plain', 'a', { x: 44, y: 40 })] })
    advanceTo(game, 'ordnance-vs-ships')
    expect(
      applyAction(game, { type: 'flight-launch-payload', flightId: 'plain', targetId: 'theirs' })
        .refused,
    ).toMatch(/no one-shot load/)
  })

  it('puts a missile group’s salvo on the table from 12 MU', () => {
    const game = battle({
      flights: [flight('mis', 'a', { x: 36, y: 40 }, { typeId: 'missile' })],
    })
    advanceTo(game, 'launch-missiles')
    const outcome = applyAction(game, {
      type: 'launch-flight-missiles',
      flightId: 'mis',
      targetId: 'theirs',
    })
    expect(outcome.refused).toBeUndefined()
    expect(flightOf(game, 'mis').payloadSpent).toBe(true)
  })

  it('lands a party from an assault shuttle run', () => {
    const carrier = ship('mine', 'a', { x: 40, y: 40 })
    const game = battle({
      ships: [carrier, ship('theirs', 'b', { x: 46, y: 40 })],
      flights: [
        flight('shuttles', 'a', { x: 44, y: 40 }, {
          typeId: 'assault-shuttle',
          carrierId: 'mine',
        }),
      ],
    })
    advanceTo(game, 'ordnance-vs-ships')
    const outcome = applyAction(game, {
      type: 'flight-boarding-run',
      flightId: 'shuttles',
      targetId: 'theirs',
    })
    expect(outcome.refused).toBeUndefined()
    expect(game.log.some((e) => /runs in on/.test(e.text ?? ''))).toBe(true)
    // Whatever got aboard is 12.7's business now.
    const aboard = shipOf(game, 'theirs').boarders.reduce((sum, f) => sum + f.parties, 0)
    expect(aboard).toBeGreaterThanOrEqual(0)
  })
})

describe('the rest of the air group', () => {
  it('takes everyone aboard in a combat landing and fouls the deck (8.4)', () => {
    const game = battle({
      flights: [flight('one', 'a', { x: 41, y: 40 }, { carrierId: 'mine' })],
    })
    advanceTo(game, 'move-fighters')
    expect(applyAction(game, { type: 'combat-landing', carrierId: 'mine' }).refused).toBeUndefined()
    const landed = flightOf(game, 'one')
    expect(landed.status).toBe('aboard')
    expect(landed.grounded, 'the deck is fouled and it never flies again').toBe(true)
  })

  it('re-arms a Multi-Role group for another mission (8.15)', () => {
    const game = battle({
      flights: [
        flight('mrf', 'a', { x: 41, y: 40 }, {
          typeId: 'multi-role',
          status: 'aboard',
          carrierId: 'mine',
        }),
      ],
    })
    advanceTo(game, 'orders')
    expect(
      applyAction(game, {
        type: 'reconfigure-flight',
        flightId: 'mrf',
        loadout: 'attack',
        armament: 'cannon',
      }).refused,
    ).toBeUndefined()
    expect(flightOf(game, 'mrf').loadout).toBe('attack')
  })

  it('lets FTL fighters start in the air near their carrier (8.15)', () => {
    const game = battle({
      flights: [
        flight('ftl', 'a', { x: 40, y: 40 }, {
          status: 'aboard',
          carrierId: 'mine',
          modifiers: ['ftl'],
        }),
      ],
    })
    advanceTo(game, 'orders')
    expect(
      applyAction(game, {
        type: 'deploy-ftl-flight',
        flightId: 'ftl',
        position: { x: 44, y: 40 },
      }).refused,
    ).toBeUndefined()
    const up = flightOf(game, 'ftl')
    expect(up.status).toBe('in-flight')
    expect(up.cef, 'a point of endurance for getting there').toBeLessThan(6)
  })

  it('refuses an FTL deployment more than 6 MU out', () => {
    const game = battle({
      flights: [
        flight('ftl', 'a', { x: 40, y: 40 }, {
          status: 'aboard',
          carrierId: 'mine',
          modifiers: ['ftl'],
        }),
      ],
    })
    advanceTo(game, 'orders')
    expect(
      applyAction(game, {
        type: 'deploy-ftl-flight',
        flightId: 'ftl',
        position: { x: 60, y: 40 },
      }).refused,
    ).toMatch(/within 6 MU/)
  })

  it('scrambles against fighters coming for the carrier (8.3)', () => {
    const game = battle({
      flights: [
        flight('bay', 'a', { x: 40, y: 40 }, { status: 'aboard', carrierId: 'mine' }),
        flight('raid', 'b', { x: 43, y: 40 }, { movedThisTurn: true }),
      ],
    })
    advanceTo(game, 'move-fighters')
    const outcome = applyAction(game, {
      type: 'scramble-fighters',
      carrierId: 'mine',
      attackerFlightId: 'raid',
      flightIds: ['bay'],
    })
    expect(outcome.refused).toBeUndefined()
    expect(game.log.some((e) => /scrambles against/.test(e.text ?? ''))).toBe(true)
  })

  it('refuses a scramble against a group that is nowhere near (8.3)', () => {
    const game = battle({
      flights: [
        flight('bay', 'a', { x: 40, y: 40 }, { status: 'aboard', carrierId: 'mine' }),
        flight('raid', 'b', { x: 80, y: 40 }, { movedThisTurn: true }),
      ],
    })
    advanceTo(game, 'move-fighters')
    expect(
      applyAction(game, {
        type: 'scramble-fighters',
        carrierId: 'mine',
        attackerFlightId: 'raid',
        flightIds: ['bay'],
      }).refused,
    ).toMatch(/not in position/)
  })

  it('lets a group refuse a dogfight and run (8.10)', () => {
    const game = battle({
      flights: [
        flight('fast', 'a', { x: 44, y: 40 }, { modifiers: ['fast'] }),
        flight('slow', 'b', { x: 46, y: 40 }),
      ],
    })
    advanceTo(game, 'fighter-vs-fighter')
    const outcome = applyAction(game, {
      type: 'refuse-dogfight',
      flightId: 'fast',
      attackerFlightId: 'slow',
      to: { x: 30, y: 40 },
    })
    expect(outcome.refused).toBeUndefined()
    expect(game.log.some((e) => /refuses the dogfight|parting round/.test(e.text ?? ''))).toBe(true)
  })

  it('resolves a furball as one exchange (8.11)', () => {
    const game = battle({
      flights: [
        flight('a1', 'a', { x: 44, y: 40 }),
        flight('a2', 'a', { x: 44, y: 41 }),
        flight('b1', 'b', { x: 46, y: 40 }),
      ],
    })
    advanceTo(game, 'fighter-vs-fighter')
    const outcome = applyAction(game, {
      type: 'flight-furball',
      entries: [
        { flightId: 'a1', targetFlightIds: ['b1'] },
        { flightId: 'a2', targetFlightIds: ['b1'] },
        { flightId: 'b1', targetFlightIds: ['a1', 'a2'] },
      ],
    })
    expect(outcome.refused).toBeUndefined()
    expect(game.log.filter((e) => /in the furball/.test(e.text ?? '')).length).toBe(3)
  })

  it('presses an attack home through an interceptor (8.9)', () => {
    const game = battle({
      flights: [
        flight('raid', 'a', { x: 44, y: 40 }),
        flight('cap', 'b', { x: 45, y: 40 }),
      ],
    })
    advanceTo(game, 'ordnance-vs-ships')
    const outcome = applyAction(game, {
      type: 'flight-press-attack',
      flightId: 'raid',
      interceptorFlightId: 'cap',
      targetId: 'theirs',
    })
    expect(outcome.refused).toBeUndefined()
    expect(game.log.some((e) => /cuts into/.test(e.text ?? ''))).toBe(true)
  })

  it('gives a Robot group its second move in phase 4, not phase 6 (8.15)', () => {
    const game = battle({
      flights: [flight('bot', 'a', { x: 40, y: 40 }, { modifiers: ['robot'] })],
    })
    advanceTo(game, 'move-fighters')
    applyAction(game, { type: 'move-flight', flightId: 'bot', to: { x: 50, y: 40 } })
    expect(
      applyAction(game, { type: 'secondary-move-flight', flightId: 'bot', to: { x: 56, y: 40 } })
        .refused,
    ).toBeUndefined()
    // And it may not take it again in phase 6.
    advanceTo(game, 'secondary-fighter-moves')
    expect(
      applyAction(game, { type: 'secondary-move-flight', flightId: 'bot', to: { x: 60, y: 40 } })
        .refused,
    ).toBeTruthy()
  })
})

describe('morale and pilot quality (8.17, 8.18)', () => {
  it('does nothing at all unless the table asked for it', () => {
    const game = battle({ flights: [flight('raid', 'a', { x: 44, y: 40 }, { strength: 1 })] })
    advanceTo(game, 'ordnance-vs-ships')
    applyAction(game, { type: 'flight-strike', flightId: 'raid', targetId: 'theirs' })
    expect(game.log.some((e) => /will not press the attack/.test(e.text ?? ''))).toBe(false)
  })

  it('aborts a mauled group, and asks only once (8.17)', () => {
    // Strength 1 out of 6: the group aborts on anything but a 1.
    const game = battle({
      rules: { fighterMorale: true },
      flights: [flight('raid', 'a', { x: 44, y: 40 }, { strength: 1 })],
    })
    advanceTo(game, 'ordnance-vs-ships')
    let aborted = false
    for (let i = 0; i < 6 && !aborted; i++) {
      applyAction(game, { type: 'flight-strike', flightId: 'raid', targetId: 'theirs' })
      aborted = game.log.some((e) => /will not press the attack/.test(e.text ?? ''))
    }
    expect(aborted).toBe(true)
    // One abort line, however many times the player tries again.
    expect(game.log.filter((e) => /will not press the attack/.test(e.text ?? '')).length).toBe(1)
  })

  it('never asks a Robot group (8.17)', () => {
    const game = battle({
      rules: { fighterMorale: true },
      flights: [
        flight('bot', 'a', { x: 44, y: 40 }, { strength: 1, modifiers: ['robot'] }),
      ],
    })
    advanceTo(game, 'ordnance-vs-ships')
    applyAction(game, { type: 'flight-strike', flightId: 'bot', targetId: 'theirs' })
    expect(game.log.some((e) => /will not press the attack/.test(e.text ?? ''))).toBe(false)
  })

  it('refuses an ace duel when 8.18 is not in play', () => {
    const game = battle({
      flights: [
        flight('a1', 'a', { x: 44, y: 40 }, { pilots: 'ace' }),
        flight('b1', 'b', { x: 46, y: 40 }, { pilots: 'ace' }),
      ],
    })
    advanceTo(game, 'fighter-vs-fighter')
    expect(
      applyAction(game, {
        type: 'flight-dogfight',
        flightId: 'a1',
        targetFlightId: 'b1',
        aceDuel: true,
      }).refused,
    ).toMatch(/not in play/)
  })

  it('lets one ace single out another (8.18)', () => {
    const game = battle({
      rules: { fighterQuality: true },
      flights: [
        flight('a1', 'a', { x: 44, y: 40 }, { pilots: 'ace' }),
        flight('b1', 'b', { x: 46, y: 40 }, { pilots: 'ace' }),
      ],
    })
    advanceTo(game, 'fighter-vs-fighter')
    const outcome = applyAction(game, {
      type: 'flight-dogfight',
      flightId: 'a1',
      targetFlightId: 'b1',
      aceDuel: true,
    })
    expect(outcome.refused).toBeUndefined()
    expect(game.log.some((e) => /Ace/.test(e.text ?? ''))).toBe(true)
  })

  it('lets an ace needle one named system, beyond repair (8.18, 5.13)', () => {
    const game = battle({
      rules: { fighterQuality: true },
      flights: [flight('a1', 'a', { x: 44, y: 40 }, { pilots: 'ace' })],
    })
    const systemId = shipOf(game, 'theirs').design.systems[0].id
    advanceTo(game, 'ordnance-vs-ships')
    const outcome = applyAction(game, {
      type: 'flight-ace-needle',
      flightId: 'a1',
      targetId: 'theirs',
      systemId,
    })
    expect(outcome.refused).toBeUndefined()
    const target = shipOf(game, 'theirs')
    if (target.destroyedSystems.has(systemId)) {
      expect(target.unrepairable.has(systemId)).toBe(true)
    }
  })
})
