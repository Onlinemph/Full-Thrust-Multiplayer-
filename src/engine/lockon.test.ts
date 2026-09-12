import { describe, expect, it } from 'vitest'

import { applyAction } from './actions'
import { Rng } from './dice'
import { rollSalvoLockOn } from './ordnance'
import { advancePhase, type GameState, type ShipState } from './game'
import { buildGame, CURRENT_RULES_VERSION } from '../data/savedGame'
import type { MissileMarker } from './ordnance'
import type { Phase } from './types'

/**
 * 6.4's lock-on roll (phase 10).
 *
 * *"The attacking player then rolls a D6 for each Salvo Missile marker. The
 * result is the number of missiles in the salvo that are actually on target."*
 *
 * `resolveMissilePointDefence` does the whole of 6.4 in one call and the live
 * phase 9 does not use it — it runs `defences.resolvePointDefence`, which
 * knows nothing about lock-on, and phase 10 then passed the surviving missile
 * count straight through as hits. So a salvo's own accuracy was never tested:
 * every missile that got past the guns hit, which on an average roll is about
 * twice what the rule allows.
 */

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) advancePhase(game)
}

function salvo(missiles: number, hits: number): MissileMarker {
  return {
    id: 'm1',
    owner: 'a',
    sourceShipId: 'shooter',
    kind: 'salvo',
    grade: 'standard',
    missiles,
    position: { x: 30, y: 24 },
    facing: 6,
    launchedTurn: 1,
    rangeFlown: 0,
    endurance: 2,
    stagesRemaining: 0,
    hits,
    targetShipId: null,
  }
}

describe('the roll itself', () => {
  it('measures the die against the salvo as launched, not what is left of it', () => {
    // Six missiles, two killed. The D6 is against six, and two of whatever it
    // finds on target were shot down on the way in.
    const results = new Set<number>()
    for (let seed = 0; seed < 24; seed += 1) {
      const { roll, lockOn, hits } = rollSalvoLockOn(salvo(4, 2), new Rng(seed))
      expect(lockOn).toBe(Math.min(6, roll))
      expect(hits).toBe(Math.max(0, Math.min(4, lockOn - 2)))
      results.add(hits)
    }
    // The whole point: it is not always four.
    expect(results.size).toBeGreaterThan(1)
    expect(Math.min(...results)).toBeLessThan(4)
  })

  it('never puts more on target than the salvo holds', () => {
    for (let seed = 0; seed < 24; seed += 1) {
      const { lockOn, hits } = rollSalvoLockOn(salvo(2, 0), new Rng(seed))
      expect(lockOn).toBeLessThanOrEqual(2)
      expect(hits).toBeLessThanOrEqual(2)
    }
  })

  it('always lets one through when nothing shot at it', () => {
    for (let seed = 0; seed < 24; seed += 1) {
      expect(rollSalvoLockOn(salvo(6, 0), new Rng(seed)).hits).toBeGreaterThanOrEqual(1)
    }
  })

  it('lets a salvo be stopped entirely by the guns plus a bad roll', () => {
    let stopped = 0
    for (let seed = 0; seed < 40; seed += 1) {
      if (rollSalvoLockOn(salvo(2, 4), new Rng(seed)).hits === 0) stopped += 1
    }
    expect(stopped).toBeGreaterThan(0)
  })
})

describe('in a battle', () => {
  /** A cruiser with a rack, a target with nothing to shoot the salvo down. */
  function launched(seed: number, rulesVersion?: number): { game: GameState; target: ShipState } {
    const game = buildGame({
      scenarioId: 'line-of-battle',
      seed,
      ...(rulesVersion === undefined ? {} : { rulesVersion }),
    })
    const shooter = game.ships.find((ship) =>
      ship.design.weapons.some((w) => w.weaponClass === 'salvo-missile-rack'),
    ) as ShipState
    const target = game.ships.find((ship) => ship.side !== shooter.side) as ShipState
    // Strip the target's guns so phase 9 kills nothing: the lock-on roll is
    // then the only thing between the salvo and the hull.
    for (const ship of game.ships) {
      if (ship.side === target.side) ship.design = { ...ship.design, systems: [] }
    }
    const rack = shooter.design.weapons.find((w) => w.weaponClass === 'salvo-missile-rack')
    if (!rack) throw new Error('no rack')
    // Close enough that the salvo is on top of the target the turn it flies:
    // 6.3 aims a missile at a point and it attacks what it finds there.
    shooter.placement = { position: { x: 30, y: 24 }, facing: 3 }
    shooter.velocity = 0
    target.placement = { position: { x: 34, y: 24 }, facing: 9 }
    target.velocity = 0
    advanceTo(game, 'launch-missiles')
    applyAction(game, {
      type: 'launch-ordnance',
      shipId: shooter.id,
      weaponId: rack.id,
      aimPoint: { ...target.placement.position },
    })
    advanceTo(game, 'ordnance-vs-ships')
    applyAction(game, { type: 'resolve-ordnance-attacks' })
    return { game, target }
  }

  it('rolls the die, so the damage a salvo does varies', () => {
    const marks = new Set<number>()
    for (let seed = 0; seed < 30; seed += 1) {
      const { target } = launched(seed, CURRENT_RULES_VERSION)
      marks.add(target.hullMarked + target.armourMarked.reduce((a, b) => a + b, 0))
    }
    expect(marks.size).toBeGreaterThan(1)
  })

  it('says so in the log', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const { game } = launched(seed, CURRENT_RULES_VERSION)
      if (game.log.some((entry) => /locks on|salvo/i.test(entry.text))) return
    }
    throw new Error('no salvo ever resolved')
  })

  it('does not roll it for a battle stamped under an older reading', () => {
    // An unstamped file replays on the reading it was fought under, where
    // every survivor hit. Same seed, more damage.
    let older = 0
    let current = 0
    for (let seed = 0; seed < 30; seed += 1) {
      older += damageIn(launched(seed))
      current += damageIn(launched(seed, CURRENT_RULES_VERSION))
    }
    expect(older).toBeGreaterThan(current)
  })
})

function damageIn(result: { target: ShipState }): number {
  return result.target.hullMarked + result.target.armourMarked.reduce((a, b) => a + b, 0)
}
