import { describe, expect, it } from 'vitest'

import { applyAction, type GameAction } from '../engine/actions'
import type { GameState } from '../engine/game'
import {
  buildGame,
  parseSavedGame,
  replayGame,
  replayPartial,
  withEmbedded,
  type GameSetup,
  type SavedGame,
} from './savedGame'
import { HEAVY_CRUISER } from './ships'

/**
 * The architecture's load-bearing claim: a battle is (setup + actions) and
 * nothing else, so replaying the journal reconstructs the game exactly, dice
 * included. Save/resume, undo and remote play are all consequences of that, so
 * these tests are the ones that matter most in the repository.
 */

const SETUP: GameSetup = { scenarioId: 'intro-fleet-engagement', seed: 0x7c0357 }

/** A turn's worth of play: orders, initiative, and everybody moves. */
function playATurn(game: GameState): GameAction[] {
  const actions: GameAction[] = []
  const take = (action: GameAction) => {
    applyAction(game, action)
    actions.push(action)
  }

  const mine = game.ships.filter((s) => s.side === 'a')
  take({ type: 'plot-turn', shipId: mine[0].id, direction: 'port', points: 1 })
  take({ type: 'plot-accel', shipId: mine[0].id, accel: 2 })
  take({ type: 'plot-accel', shipId: mine[1].id, accel: -1 })
  take({ type: 'advance-phase' })
  take({ type: 'roll-initiative' })
  take({ type: 'advance-phase' })
  for (const ship of game.ships) take({ type: 'move-ship', shipId: ship.id })
  return actions
}

/** Everything about a game that a replay must reproduce exactly. */
function fingerprint(game: GameState): string {
  return JSON.stringify({
    turn: game.turn,
    phase: game.phase,
    initiative: game.initiative,
    ships: game.ships.map((ship) => ({
      id: ship.id,
      position: ship.placement.position,
      facing: ship.placement.facing,
      velocity: ship.velocity,
      hull: ship.hullMarked,
      armour: ship.armourMarked,
      destroyed: [...ship.destroyedSystems].sort(),
      driveHits: ship.driveHits,
    })),
    log: game.log.map((entry) => `${entry.seq}:${entry.text}:${(entry.dice ?? []).join(',')}`),
  })
}

describe('a battle is (setup + actions)', () => {
  it('replays to exactly the same state, dice included', () => {
    const first = buildGame(SETUP)
    const actions = playATurn(first)

    const replayed = replayGame({ version: 1, setup: SETUP, actions })
    expect(fingerprint(replayed)).toBe(fingerprint(first))
  })

  it('replays the same way however many times it is replayed', () => {
    const actions = playATurn(buildGame(SETUP))
    const a = replayGame({ version: 1, setup: SETUP, actions })
    const b = replayGame({ version: 1, setup: SETUP, actions })
    expect(fingerprint(a)).toBe(fingerprint(b))
  })

  it('gives a different battle for a different seed', () => {
    // If it did not, the seed would not be reaching the dice.
    const actions = playATurn(buildGame(SETUP))
    const a = replayGame({ version: 1, setup: SETUP, actions })
    const b = replayGame({ version: 1, setup: { ...SETUP, seed: 12345 }, actions })
    expect(fingerprint(a)).not.toBe(fingerprint(b))
  })
})

describe('undo', () => {
  it('rewinds by exact replay, so a rewound roll comes back the same', () => {
    const game = buildGame(SETUP)
    const actions = playATurn(game)

    // The state one action before the end...
    const before = replayPartial({ version: 1, setup: SETUP, actions }, actions.length - 1)
    // ...then that last action again. It must land exactly as it did the first
    // time, or undo would be a way to fish for a better die roll.
    applyAction(before, actions[actions.length - 1])
    expect(fingerprint(before)).toBe(fingerprint(game))
  })

  it('rewinds to every intermediate point consistently', () => {
    const actions = playATurn(buildGame(SETUP))
    for (let n = 0; n <= actions.length; n++) {
      const a = replayPartial({ version: 1, setup: SETUP, actions }, n)
      const b = replayPartial({ version: 1, setup: SETUP, actions }, n)
      expect(fingerprint(a)).toBe(fingerprint(b))
    }
  })
})

describe('refused actions', () => {
  it('change nothing and are refused identically on replay', () => {
    const game = buildGame(SETUP)
    const ship = game.ships[0]
    const before = fingerprint(game)

    // Moving in the orders phase is illegal, and journalling the refusal has to
    // be harmless: the journal records what the player tried, not only what
    // worked.
    const illegal: GameAction = { type: 'move-ship', shipId: ship.id }
    const outcome = applyAction(game, illegal)
    expect(outcome.refused).toBeTruthy()
    expect(fingerprint(game)).toBe(before)

    const replayed = replayGame({ version: 1, setup: SETUP, actions: [illegal] })
    expect(fingerprint(replayed)).toBe(before)
  })

  it('refuses an order for a ship that does not exist', () => {
    const game = buildGame(SETUP)
    expect(applyAction(game, { type: 'plot-accel', shipId: 'nope', accel: 1 }).refused).toBeTruthy()
  })
})

describe('battle files', () => {
  it('round-trips through JSON', () => {
    const game = buildGame(SETUP)
    const actions = playATurn(game)
    const saved: SavedGame = { version: 1, setup: withEmbedded(SETUP), actions }

    const parsed = parseSavedGame(JSON.stringify(saved))
    expect(typeof parsed).not.toBe('string')
    if (typeof parsed === 'string') throw new Error(parsed)

    expect(fingerprint(replayGame(parsed))).toBe(fingerprint(game))
  })

  it('says what is wrong rather than throwing', () => {
    expect(parseSavedGame('not json')).toMatch(/invalid JSON/)
    expect(parseSavedGame('{"version":9}')).toMatch(/not supported/)
    expect(parseSavedGame('{"version":1,"setup":{}}')).toMatch(/no scenario/)
    expect(parseSavedGame('{"version":1,"setup":{"scenarioId":"x","seed":1},"actions":[]}')).toMatch(
      /will not replay/,
    )
  })

  it('embeds a custom design so the file opens on a machine that lacks it', () => {
    const custom = { ...HEAVY_CRUISER, id: 'custom-hull', name: 'Private Design' }
    const setup: GameSetup = {
      ...SETUP,
      scenarioId: 'custom-battle',
      customScenario: {
        id: 'custom-battle',
        name: 'Custom',
        briefing: '',
        objective: '',
        table: { width: 72, height: 48 },
        victory: { damaged: 0.25, crippled: 0.5, destroyed: 1, disengaged: 1 },
        sides: [
          {
            id: 'a',
            name: 'A',
            force: [{ designId: 'custom-hull', position: { x: 10, y: 10 }, facing: 6 }],
          },
          {
            id: 'b',
            name: 'B',
            force: [{ designId: 'intro-frigate', position: { x: 10, y: 38 }, facing: 12 }],
          },
        ],
      },
      customDesigns: [custom],
    }

    const embedded = withEmbedded(setup)
    expect(embedded.customDesigns?.map((d) => d.id)).toEqual(['custom-hull'])
    // The canon frigate is not embedded — it is already on every machine.
    expect(embedded.customDesigns).toHaveLength(1)
    expect(embedded.customScenario?.id).toBe('custom-battle')

    // And the whole thing replays from the file alone.
    const parsed = parseSavedGame(JSON.stringify({ version: 1, setup: embedded, actions: [] }))
    if (typeof parsed === 'string') throw new Error(parsed)
    expect(replayGame(parsed).ships.map((s) => s.design.name)).toContain('Private Design')
  })
})
