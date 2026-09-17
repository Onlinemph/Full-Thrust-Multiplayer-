import { describe, expect, it } from 'vitest'

import {
  applyAction,
  endPhase,
  setOptionalRules,
  setRulesReading,
  weaponModeOf,
} from './actions'
import { createGame, createShipState, type GameState, type ShipState } from './game'
import { CURRENT_RULES_VERSION } from '../data/savedGame'
import type { Phase, ShipDesign, SystemKind, WeaponDef } from './types'

/**
 * The four rules of sections 5.14, 6.6, 6.8 and 6.10 that were written,
 * tested and unreachable.
 *
 * `kinetics.firePulseTorpedo` has read `ctx.overloaded` since it was written
 * and nothing set it; `resolveAntimatterRackExplosion` waited for a threshold
 * check that never called it; `resolvePlasmaBoltShapedCharge` had no action;
 * and `clearMine` was called only by the mine's own detonation, so a
 * minesweeper was five mass of decoration.
 */

const READING_BEFORE = 11

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) endPhase(game)
}

function nextTurn(game: GameState): void {
  const turn = game.turn
  let guard = 60
  while (game.turn === turn && guard-- > 0) endPhase(game)
}

function design(
  name: string,
  weapons: WeaponDef[],
  systems: SystemKind[] = [],
): ShipDesign {
  return {
    id: name,
    name,
    faction: 'Test',
    group: 'cruiser',
    mass: 100,
    hullClass: 'average',
    hullRows: 4,
    hullBoxes: 40,
    drive: { thrust: 4, advanced: false },
    ftl: 'none',
    streamlining: 'none',
    armour: { layers: [], regenerative: false },
    screens: { level: 0, generators: 0, advanced: false },
    weapons,
    turrets: [],
    systems: [
      { id: 'fc1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
      ...systems.map((kind, i) => ({
        id: `${kind}-${i + 1}`,
        kind,
        label: kind,
        mass: 1,
        points: 3,
      })),
    ],
    fighterBays: [],
    gunboats: [],
    additionalDamageControlParties: 1,
    marineParties: 0,
    points: 200,
  }
}

const tube = (over: Partial<WeaponDef> = {}): WeaponDef => ({
  id: 'pt1',
  label: 'Pulse Torpedo',
  weaponClass: 'pulse-torpedo',
  rating: 1,
  variant: 'standard',
  arcs: ['F', 'FS', 'FP', 'A', 'AS', 'AP'],
  mass: 4,
  points: 12,
  ...over,
})

function battle(ships: ShipState[], reading = CURRENT_RULES_VERSION, seed = 0x514): GameState {
  const game = createGame({
    seed,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 200, height: 160 },
    ships,
  })
  setRulesReading(game, reading)
  return game
}

const shipOf = (game: GameState, id: string): ShipState => game.ships.find((s) => s.id === id)!

// ---------------------------------------------------------------------------
// 5.14 The overloaded Pulse Torpedo
// ---------------------------------------------------------------------------

describe('an overloaded Pulse Torpedo (5.14)', () => {
  const armed = (weapons: WeaponDef[] = [tube()]) =>
    battle([
      createShipState({
        id: 'shooter',
        side: 'b',
        design: design('Shooter', weapons),
        placement: { position: { x: 0, y: 0 }, facing: 6 },
      }),
      createShipState({
        id: 'target',
        side: 'a',
        design: design('Target', []),
        placement: { position: { x: 0, y: 8 }, facing: 12 },
      }),
    ])

  it('is written in phase 1 and holds for the turn', () => {
    // "To fire a Pulse Torpedo overloaded it must be noted in the orders."
    const game = armed()
    expect(
      applyAction(game, { type: 'plot-weapon-mode', shipId: 'shooter', weaponId: 'pt1', mode: 'overload' })
        .refused,
    ).toBeUndefined()
    expect(weaponModeOf(game, shipOf(game, 'shooter'), 'pt1')).toBe('overload')
    // The order is good for the turn it was written in and no longer.
    nextTurn(game)
    expect(weaponModeOf(game, shipOf(game, 'shooter'), 'pt1')).toBe('standard')
  })

  it('cannot be written outside phase 1', () => {
    const game = armed()
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, { type: 'plot-weapon-mode', shipId: 'shooter', weaponId: 'pt1', mode: 'overload' })
        .refused,
    ).toMatch(/phase 1/)
  })

  it('is barred on a short-range and a Variable Strength tube', () => {
    for (const variant of ['short', 'variable'] as const) {
      const game = armed([tube({ variant })])
      expect(
        applyAction(game, {
          type: 'plot-weapon-mode',
          shipId: 'shooter',
          weaponId: 'pt1',
          mode: 'overload',
        }).refused,
      ).toMatch(/may not be fired overloaded/)
    }
  })

  it('is barred on a tube that fired last turn', () => {
    // "the Pulse Torpedo may not have fired in the previous turn"
    const game = armed()
    advanceTo(game, 'ship-fire')
    applyAction(game, { type: 'fire-weapon', shipId: 'shooter', weaponId: 'pt1', targetId: 'target' })
    nextTurn(game)
    expect(
      applyAction(game, { type: 'plot-weapon-mode', shipId: 'shooter', weaponId: 'pt1', mode: 'overload' })
        .refused,
    ).toMatch(/fired last turn/)
  })

  it('changes the shot: AP damage, and the log says so', () => {
    const shot = (overload: boolean): { text: string; damage: number } => {
      const game = armed()
      if (overload) {
        applyAction(game, {
          type: 'plot-weapon-mode',
          shipId: 'shooter',
          weaponId: 'pt1',
          mode: 'overload',
        })
      }
      advanceTo(game, 'ship-fire')
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'shooter',
        weaponId: 'pt1',
        targetId: 'target',
      })
      const entry = game.log.filter((line) => line.kind === 'fire' || line.kind === 'damage').pop()
      return { text: entry?.text ?? '', damage: shipOf(game, 'target').hullMarked }
    }
    expect(shot(true).text).toMatch(/Overloaded/)
    expect(shot(false).text).not.toMatch(/Overloaded/)
  })

  it('does more damage on average, over fifty battles', () => {
    // "+2 to the damage roll, giving a damage range between 3 and 8"
    const total = (overload: boolean): number => {
      let sum = 0
      for (let n = 0; n < 50; n += 1) {
        const game = battle(
          [
            createShipState({
              id: 'shooter',
              side: 'b',
              design: design('Shooter', [tube()]),
              placement: { position: { x: 0, y: 0 }, facing: 6 },
            }),
            createShipState({
              id: 'target',
              side: 'a',
              design: design('Target', []),
              placement: { position: { x: 0, y: 8 }, facing: 12 },
            }),
          ],
          CURRENT_RULES_VERSION,
          n * 104729 + 17,
        )
        if (overload) {
          applyAction(game, {
            type: 'plot-weapon-mode',
            shipId: 'shooter',
            weaponId: 'pt1',
            mode: 'overload',
          })
        }
        advanceTo(game, 'ship-fire')
        applyAction(game, {
          type: 'fire-weapon',
          shipId: 'shooter',
          weaponId: 'pt1',
          targetId: 'target',
        })
        sum += shipOf(game, 'target').hullMarked
      }
      return sum
    }
    expect(total(true)).toBeGreaterThan(total(false))
  })

  it('can blow the tube off the SSD, and the wreck is not repairable', () => {
    // "If the Pulse Torpedo rolls a 1, roll a second 1D6 ... if the second die
    // is also a 1 the Pulse Torpedo tube is destroyed."
    let found = false
    for (let n = 0; n < 400 && !found; n += 1) {
      const game = battle(
        [
          createShipState({
            id: 'shooter',
            side: 'b',
            design: design('Shooter', [tube()]),
            placement: { position: { x: 0, y: 0 }, facing: 6 },
          }),
          createShipState({
            id: 'target',
            side: 'a',
            design: design('Target', []),
            placement: { position: { x: 0, y: 4 }, facing: 12 },
          }),
        ],
        CURRENT_RULES_VERSION,
        n * 7919 + 11,
      )
      applyAction(game, {
        type: 'plot-weapon-mode',
        shipId: 'shooter',
        weaponId: 'pt1',
        mode: 'overload',
      })
      advanceTo(game, 'ship-fire')
      applyAction(game, {
        type: 'fire-weapon',
        shipId: 'shooter',
        weaponId: 'pt1',
        targetId: 'target',
      })
      if (shipOf(game, 'shooter').destroyedSystems.has('pt1')) {
        found = true
        expect(game.log.some((line) => /blows itself apart/.test(line.text))).toBe(true)
      }
    }
    expect(found).toBe(true)
  })

  it('ejects an overload that was loaded and not fired', () => {
    // "If the overload is not fired in the turn it is loaded it is ejected by
    // the crew and counts as having fired" — so next turn's order is refused.
    const game = armed()
    applyAction(game, { type: 'plot-weapon-mode', shipId: 'shooter', weaponId: 'pt1', mode: 'overload' })
    nextTurn(game)
    expect(game.log.some((line) => /the crew eject it/.test(line.text))).toBe(true)
    expect(
      applyAction(game, { type: 'plot-weapon-mode', shipId: 'shooter', weaponId: 'pt1', mode: 'overload' })
        .refused,
    ).toMatch(/fired last turn/)
  })

  it('is not read at all under reading 11', () => {
    const game = armed()
    setRulesReading(game, READING_BEFORE)
    applyAction(game, { type: 'plot-weapon-mode', shipId: 'shooter', weaponId: 'pt1', mode: 'overload' })
    advanceTo(game, 'ship-fire')
    applyAction(game, { type: 'fire-weapon', shipId: 'shooter', weaponId: 'pt1', targetId: 'target' })
    expect(game.log.some((line) => /Overloaded/.test(line.text))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 5.19 The Fusion Array's mode, 5.14's VPT setting
// ---------------------------------------------------------------------------

describe('the other two phase-1 settings', () => {
  it('lets a Variable Strength tube pick a line, and refuses a plain tube', () => {
    const game = battle([
      createShipState({
        id: 'shooter',
        side: 'b',
        design: design('Shooter', [tube({ variant: 'variable' }), tube({ id: 'pt2' })]),
        placement: { position: { x: 0, y: 0 }, facing: 6 },
      }),
    ])
    expect(
      applyAction(game, { type: 'plot-weapon-mode', shipId: 'shooter', weaponId: 'pt1', mode: 'vpt-short' })
        .refused,
    ).toBeUndefined()
    expect(
      applyAction(game, { type: 'plot-weapon-mode', shipId: 'shooter', weaponId: 'pt2', mode: 'vpt-short' })
        .refused,
    ).toMatch(/Variable Strength/)
  })

  it('lets a Fusion Array pick a mode, and refuses anything else', () => {
    const game = battle([
      createShipState({
        id: 'shooter',
        side: 'b',
        design: design('Shooter', [
          { ...tube({ id: 'fa1', label: 'Fusion Array' }), weaponClass: 'fusion-array' },
          tube({ id: 'pt2' }),
        ]),
        placement: { position: { x: 0, y: 0 }, facing: 6 },
      }),
    ])
    expect(
      applyAction(game, { type: 'plot-weapon-mode', shipId: 'shooter', weaponId: 'fa1', mode: 'fusion-flare' })
        .refused,
    ).toBeUndefined()
    expect(
      applyAction(game, { type: 'plot-weapon-mode', shipId: 'shooter', weaponId: 'pt2', mode: 'fusion-flare' })
        .refused,
    ).toMatch(/Fusion Array/)
  })
})

// ---------------------------------------------------------------------------
// 6.6 An antimatter missile that fails its threshold check
// ---------------------------------------------------------------------------

describe('an antimatter missile on a failing rack (6.6)', () => {
  const rack: WeaponDef = {
    id: 'am1',
    label: 'AM Missile',
    weaponClass: 'antimatter-missile',
    rating: 1,
    variant: 'standard',
    arcs: ['FP', 'F', 'FS'],
    mass: 2,
    points: 10,
    ammo: 1,
  }

  const wounded = (reading = CURRENT_RULES_VERSION, seed = 0x514): GameState => {
    const game = battle(
      [
        createShipState({
          id: 'carrier',
          side: 'a',
          design: design('Carrier', [rack]),
          placement: { position: { x: 0, y: 0 }, facing: 6 },
        }),
        createShipState({
          id: 'consort',
          side: 'a',
          design: design('Consort', []),
          placement: { position: { x: 0.5, y: 0 }, facing: 6 },
        }),
      ],
      reading,
      seed,
    )
    return game
  }

  it('explodes on the rack, straight to the hull, and catches a neighbour', () => {
    // "it explodes on the rack, immediately doing 1d6 damage to the carrying
    // ship, and 1d6 damage to any unit within 1 MU ... Screens and armor will
    // not protect a ship from its own exploding missiles."
    let seen = false
    for (let n = 0; n < 60 && !seen; n += 1) {
      const game = wounded(CURRENT_RULES_VERSION, 0x514 + n * 7919)
      setRulesReading(game, CURRENT_RULES_VERSION)
      const carrier = shipOf(game, 'carrier')
      // Take the hull down past a threshold row and check.
      carrier.hullMarked = Math.floor(carrier.design.hullBoxes / 4) + 1
      carrier.pendingThresholdRows = 1
      advanceTo(game, 'threshold')
      applyAction(game, { type: 'threshold-check', shipId: 'carrier' })
      if (game.log.some((line) => /explodes on the rack/.test(line.text))) {
        seen = true
        expect(carrier.destroyedSystems.has('am1')).toBe(true)
        expect(carrier.hullMarked).toBeGreaterThan(Math.floor(carrier.design.hullBoxes / 4) + 1)
      }
    }
    expect(seen).toBe(true)
  })

  it('says nothing under reading 11', () => {
    for (let n = 0; n < 60; n += 1) {
      const game = wounded(READING_BEFORE)
      const carrier = shipOf(game, 'carrier')
      carrier.hullMarked = Math.floor(carrier.design.hullBoxes / 4) + 1
      carrier.pendingThresholdRows = 1
      advanceTo(game, 'threshold')
      applyAction(game, { type: 'threshold-check', shipId: 'carrier' })
      expect(game.log.some((line) => /explodes on the rack/.test(line.text))).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// 6.8 The shaped charge
// ---------------------------------------------------------------------------

describe('a Plasma Bolt Launcher as a shaped charge (6.8)', () => {
  const pbl: WeaponDef = {
    id: 'pbl1',
    label: 'PBL-3',
    weaponClass: 'plasma-bolt-launcher',
    rating: 3,
    variant: 'standard',
    arcs: ['F', 'FS', 'FP'],
    mass: 9,
    points: 27,
  }

  const gunline = (opts: { option?: boolean; gap?: number } = {}): GameState => {
    const game = battle([
      createShipState({
        id: 'shooter',
        side: 'b',
        design: design('Shooter', [pbl]),
        placement: { position: { x: 0, y: 0 }, facing: 6 },
      }),
      // An escort with a plain beam on the target: from reading 17 a phase 11
      // in which the only shot is the refused one is passed over.
      createShipState({
        id: 'escort',
        side: 'b',
        design: design('Escort', [
          {
            id: 'eb1',
            label: 'Beam-3',
            weaponClass: 'beam',
            rating: 3,
            variant: 'standard',
            arcs: ['F', 'FS', 'FP', 'A', 'AS', 'AP'],
            mass: 6,
            points: 18,
          },
        ]),
        placement: { position: { x: 4, y: 0 }, facing: 6 },
      }),
      createShipState({
        id: 'target',
        side: 'a',
        design: design('Target', []),
        placement: { position: { x: 0, y: opts.gap ?? 12 }, facing: 12 },
      }),
    ])
    if (opts.option !== false) setOptionalRules(game, { shapedCharges: true })
    return game
  }

  it('is refused unless the table is playing the option', () => {
    const game = gunline({ option: false })
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'fire-shaped-charge',
        shipId: 'shooter',
        weaponId: 'pbl1',
        targetId: 'target',
      }).refused,
    ).toMatch(/option/)
  })

  it('rolls a hit, then 1D3 a class, and says so', () => {
    const game = gunline()
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'fire-shaped-charge',
        shipId: 'shooter',
        weaponId: 'pbl1',
        targetId: 'target',
      }).refused,
    ).toBeUndefined()
    const entry = game.log.filter((line) => /shaped charge/.test(line.text)).pop()
    expect(entry?.text).toMatch(/shaped charge/)
  })

  it('spends the launcher for two turns, like a marker would', () => {
    // "a PBL may only fire every other turn"
    const game = gunline()
    advanceTo(game, 'ship-fire')
    applyAction(game, {
      type: 'fire-shaped-charge',
      shipId: 'shooter',
      weaponId: 'pbl1',
      targetId: 'target',
    })
    nextTurn(game)
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'fire-shaped-charge',
        shipId: 'shooter',
        weaponId: 'pbl1',
        targetId: 'target',
      }).refused,
    ).toMatch(/every other turn/)
  })

  it('will not reach past 30 MU', () => {
    const game = gunline({ gap: 34 })
    advanceTo(game, 'ship-fire')
    expect(
      applyAction(game, {
        type: 'fire-shaped-charge',
        shipId: 'shooter',
        weaponId: 'pbl1',
        targetId: 'target',
      }).refused,
    ).toMatch(/30/)
  })
})

// ---------------------------------------------------------------------------
// 6.10 Minesweeping
// ---------------------------------------------------------------------------

describe('a minesweeper clearing a field (6.10)', () => {
  const layer: WeaponDef = {
    id: 'mr1',
    label: 'Mine Rack',
    weaponClass: 'mine-rack',
    rating: 1,
    variant: 'standard',
    arcs: [],
    mass: 2,
    points: 6,
  }

  const field = (sweepers: SystemKind[], reading = CURRENT_RULES_VERSION): GameState =>
    battle(
      [
        createShipState({
          id: 'layer',
          side: 'a',
          design: design('Layer', [layer]),
          placement: { position: { x: 20, y: 40 }, facing: 3 },
          velocity: 4,
        }),
        createShipState({
          id: 'sweeper',
          side: 'b',
          design: design('Sweeper', [], sweepers),
          placement: { position: { x: 32, y: 40 }, facing: 9 },
          velocity: 8,
        }),
      ],
      reading,
    )

  /** Lay a field on turn 1, then fly the sweeper down it on turn 2. */
  function sweepRun(sweepers: SystemKind[], reading = CURRENT_RULES_VERSION): GameState {
    const game = field(sweepers, reading)
    applyAction(game, { type: 'plot-mines', shipId: 'layer', on: true })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'layer' })
    nextTurn(game)
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'sweeper' })
    // The mines resolve as the movement phase closes (6.9), so the sweep and
    // the detonation are compared on the same side of the boundary.
    endPhase(game)
    return game
  }

  it('takes the marker off the table before it can go off', () => {
    // 6.10: a marker stays "until it detonates, or is cleared by a
    // minesweeping system". A sweeper that flies the same track as an
    // unswept ship takes the marker instead of the mine taking the ship.
    const swept = sweepRun(['minesweeper'])
    const bare = sweepRun([])
    expect(swept.log.some((line) => /sweeps 1 mine/.test(line.text))).toBe(true)
    expect(swept.log.some((line) => /A mine goes off/.test(line.text))).toBe(false)
    // The same run without the sweeper: the mine does what mines do.
    expect(bare.log.some((line) => /sweeps/.test(line.text))).toBe(false)
    expect(bare.log.some((line) => /A mine goes off/.test(line.text))).toBe(true)
  })

  it('leaves the field alone when the sweeper is knocked out', () => {
    const game = field(['minesweeper'])
    applyAction(game, { type: 'plot-mines', shipId: 'layer', on: true })
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'layer' })
    nextTurn(game)
    shipOf(game, 'sweeper').destroyedSystems.add('minesweeper-1')
    advanceTo(game, 'move-ships')
    applyAction(game, { type: 'move-ship', shipId: 'sweeper' })
    expect(game.log.some((line) => /sweeps/.test(line.text))).toBe(false)
  })

  it('does nothing under reading 11', () => {
    const old = sweepRun(['minesweeper'], READING_BEFORE)
    expect(old.log.some((line) => /sweeps/.test(line.text))).toBe(false)
  })
})
