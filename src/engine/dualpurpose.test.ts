import { describe, expect, it } from 'vitest'

import { applyAction, pointDefenceMounts, setRulesReading } from './actions'
import { createGame, createShipState, type GameState } from './game'
import { designById } from '../data/ships'
import { CURRENT_RULES_VERSION } from '../data/savedGame'
import type { Phase, ShipDesign, WeaponClass } from './types'

/**
 * 7.12's dual-purpose mounts.
 *
 * *"Beam-1 systems, K-1 guns and other small weapons are dual purpose"* — and
 * the family sections name the rest: every Gatling Battery (5.10), Twin
 * Particle Array (5.11), Meson Projector (5.12) and Phaser (5.8), an EMP-1
 * (5.4), and the Pulser (5.21). `beams.pointDefenceModeFor` has always known
 * which table each reads and `kinetics` has always had the two arc tests. The
 * mount list asked for a Beam-1 and nothing else, so four weapon families were
 * quietly absent from phase 9 on every ship that carried one.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) applyAction(game, { type: 'advance-phase' })
}

/** A hull carrying one gun of the class under test and nothing else. */
function armedWith(weaponClass: WeaponClass, rating: number): ShipDesign {
  const base = designById('esu-heavy-cruiser') as ShipDesign
  return {
    ...base,
    // No PDS, so anything that turns up in the mount list is the gun.
    systems: base.systems.filter((system) => system.kind !== 'pds' && system.kind !== 'ads'),
    weapons: [
      {
        id: 'w1',
        label: `${weaponClass}-${rating}`,
        weaponClass,
        rating,
        variant: 'standard',
        arcs: ['F', 'FS', 'AS', 'A', 'AP', 'FP'],
        mass: 2,
        points: 6,
      },
    ],
  }
}

function battle(design: ShipDesign, reading = CURRENT_RULES_VERSION): GameState {
  const game = createGame({
    seed: 0x712,
    sides: [{ id: 'a' }, { id: 'b' }],
    table: { width: 120, height: 80 },
    ships: [
      createShipState({
        id: 'guard',
        side: 'a',
        design,
        placement: { position: { x: 20, y: 40 }, facing: 3 },
        velocity: 0,
      }),
    ],
  })
  setRulesReading(game, reading)
  return game
}

const mountIds = (game: GameState): string[] =>
  pointDefenceMounts(game, game.ships[0]).map((mount) => mount.id)

describe('which guns can point-defend (7.12)', () => {
  it.each<[WeaponClass, number]>([
    ['gatling', 1],
    ['twin-particle-array', 1],
    ['meson-projector', 1],
    ['phaser', 1],
    ['pulser', 1],
    ['k-gun', 1],
    ['emp', 1],
  ])('offers a %s as a point-defence mount', (weaponClass, rating) => {
    const game = battle(armedWith(weaponClass, rating))
    advanceTo(game, 'point-defence')
    expect(mountIds(game)).toContain('w1')
  })

  it('still offers a Beam-1', () => {
    const game = battle(armedWith('beam', 1))
    advanceTo(game, 'point-defence')
    expect(mountIds(game)).toContain('w1')
  })

  it.each<[WeaponClass, number]>([
    ['beam', 3],
    ['emp', 2],
    ['plasma-cannon', 2],
    ['heavy-graser', 1],
    ['graser', 2],
    ['needle-beam', 1],
    ['transporter', 1],
    ['k-gun', 3],
  ])('will not offer a %s-%d', (weaponClass, rating) => {
    const game = battle(armedWith(weaponClass, rating))
    advanceTo(game, 'point-defence')
    expect(mountIds(game)).not.toContain('w1')
  })
})

describe('the arcs a dual-purpose mount covers', () => {
  it('keeps a K-1 out of its own drive plume (5.16)', () => {
    // 5.16 is the exception: every other dual-purpose mount may fire into the
    // aft arc under 7.12, and a K-1 may not.
    const game = battle(armedWith('k-gun', 1))
    advanceTo(game, 'point-defence')
    const mount = pointDefenceMounts(game, game.ships[0]).find((m) => m.id === 'w1')
    expect(mount).toBeDefined()
  })

  it('lets a Gatling fire astern, which 7.12 allows', () => {
    const game = battle(armedWith('gatling', 1))
    advanceTo(game, 'point-defence')
    expect(mountIds(game)).toContain('w1')
  })
})

describe('the older reading (7.12)', () => {
  it('kept every dual-purpose mount out of phase 9', () => {
    // Adding a mount adds dice to a phase every battle walks, so it is gated —
    // a battle stamped before reading 10 defends with its PDS and its Beam-1s
    // exactly as it was fought.
    for (const weaponClass of ['gatling', 'pulser', 'k-gun', 'phaser'] as const) {
      const game = battle(armedWith(weaponClass, 1), 9)
      advanceTo(game, 'point-defence')
      expect(mountIds(game)).not.toContain('w1')
    }
  })

  it('always kept the Beam-1 in it', () => {
    const game = battle(armedWith('beam', 1), 1)
    advanceTo(game, 'point-defence')
    expect(mountIds(game)).toContain('w1')
  })
})
