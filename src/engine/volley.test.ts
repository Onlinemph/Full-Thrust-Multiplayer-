import { describe, expect, it } from 'vitest'

import { CURRENT_RULES_VERSION } from '../data/savedGame'
import { designById } from '../data/ships'
import { applyAction, endPhase, setRulesReading } from './actions'
import { createGame, createShipState, type GameState, type ShipState } from './game'
import type { Phase, ShipDesign } from './types'

/**
 * One declaration, every kind of shot (2.6, 5.23, 7.12).
 *
 * A ship's fire is one declaration rolled together, and the turn passes the
 * moment its fire opens. So a point-defence rake or a Spinal Mount fired on
 * its own, ahead of the guns, is not a smaller volley: it opens the ship's
 * fire, hands the turn to the other side, and if they then fire a ship the
 * guns never get their go. The volley carries both kinds so that a console
 * never has to fire them apart.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) {
    if (game.phase === 'initiative') applyAction(game, { type: 'roll-initiative' })
    endPhase(game)
  }
}

/**
 * A hull with nothing between its guns and a rake — no armour, no screens
 * (7.12) — and enough hull to be alive after the spinal beam goes through.
 */
const STRIPPED: ShipDesign = {
  id: 'stripped',
  name: 'Stripped Hull',
  faction: 'Test',
  group: 'cruiser',
  mass: 80,
  hullClass: 'average',
  hullRows: 4,
  hullBoxes: 24,
  drive: { thrust: 2, advanced: false },
  ftl: 'none',
  streamlining: 'none',
  armour: { layers: [], regenerative: false },
  screens: { level: 0, generators: 0, advanced: false },
  weapons: [
    {
      id: 'b1',
      label: 'Beam-1',
      weaponClass: 'beam',
      rating: 1,
      variant: 'standard',
      arcs: ['F', 'FS', 'AS', 'A', 'AP', 'FP'],
      mass: 1,
      points: 3,
    },
  ],
  turrets: [],
  systems: [{ id: 'fc-1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 }],
  fighterBays: [],
  gunboats: [],
  additionalDamageControlParties: 0,
  marineParties: 0,
  points: 0,
}

function hull(id: string, side: string, design: ShipDesign, x: number, facing: 3 | 9): ShipState {
  return createShipState({ id, side, design, placement: { position: { x, y: 24 }, facing } })
}

/** A lance cruiser 5 MU short of a stripped hull, bow on, with the turn to fire. */
function gunline(): GameState {
  const lance = designById('aethelgard-cruiser') as ShipDesign
  const game = createGame({
    seed: 0x523,
    sides: [{ id: 'a' }, { id: 'b' }],
    ships: [
      hull('mine', 'a', lance, 20, 3),
      // 7.12's rake reaches 6 MU, so the stripped hull sits at 5.
      hull('theirs', 'b', STRIPPED, 25, 9),
      hull('escort', 'b', STRIPPED, 40, 9),
    ],
  })
  setRulesReading(game, CURRENT_RULES_VERSION)
  advanceTo(game, 'ship-fire')
  game.fire = { side: 'a', sequence: 0 }
  return game
}

function mounts(game: GameState) {
  const mine = game.ships.find((ship) => ship.id === 'mine')!
  const spinal = mine.design.weapons.find((w) => w.weaponClass === 'spinal-beam')!
  const beam = mine.design.weapons.find((w) => w.weaponClass === 'beam' && w.arcs.includes('F'))!
  const pds = mine.design.systems.find((s) => s.kind === 'pds')!
  return { mine, spinal, beam, pds }
}

describe('a volley with a rake and a laid spinal beam in it', () => {
  it('fires all three kinds as one declaration and passes the turn once', () => {
    const game = gunline()
    const { mine, spinal, beam, pds } = mounts(game)
    const outcome = applyAction(game, {
      type: 'fire-volley',
      shipId: 'mine',
      shots: [
        { weaponId: spinal.id, targetId: '', kind: 'spinal', aim: { x: 25, y: 24 } },
        { weaponId: pds.id, targetId: 'theirs', kind: 'point-defence' },
        { weaponId: beam.id, targetId: 'theirs', kind: 'ship' },
      ],
    })
    expect(outcome.refused).toBeUndefined()
    // Nothing in the volley was turned away: a refused shot is logged as
    // "<ship> — <mount>: <why>".
    expect(game.log.filter((entry) => entry.text.startsWith(`${mine.name} — `))).toEqual([])
    expect(mine.weaponLastFiredTurn.get(spinal.id)).toBe(game.turn)
    expect(mine.weaponsFired.has(beam.id)).toBe(true)
    expect(mine.weaponsFired.has(pds.id)).toBe(true)
    expect(mine.hasFiredThisTurn).toBe(true)
    // One ship's fire, so one change of turn (2.6).
    expect(game.fire).toEqual({ side: 'b', sequence: 1 })
  })

  it('shows why the plan has to carry them: a rake fired alone gives the turn away', () => {
    const game = gunline()
    const { mine, beam, pds } = mounts(game)
    expect(
      applyAction(game, {
        type: 'fire-point-defence',
        shipId: 'mine',
        systemId: pds.id,
        targetId: 'theirs',
      }).refused,
    ).toBeUndefined()
    expect(game.fire.side).toBe('b')
    // The other side takes its go with a ship of its own …
    expect(
      applyAction(game, {
        type: 'fire-volley',
        shipId: 'theirs',
        shots: [{ weaponId: 'b1', targetId: 'mine', kind: 'ship' }],
      }).refused,
    ).toBeUndefined()
    // … and the lance cruiser's guns are still loaded, and stay so.
    const late = applyAction(game, {
      type: 'fire-volley',
      shipId: 'mine',
      shots: [{ weaponId: beam.id, targetId: 'theirs', kind: 'ship' }],
    })
    expect(late.refused).toMatch(/has had its fire/)
    expect(mine.weaponsFired.has(beam.id)).toBe(false)
  })
})
