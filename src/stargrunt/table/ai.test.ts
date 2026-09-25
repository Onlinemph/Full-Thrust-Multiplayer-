/**
 * The computer at the table: it finishes battles without a stall or a
 * refusal, its journals replay, it beats a side that never acts, and it
 * takes cover and objectives more than autoplay's random legal play.
 */

import { describe, expect, it } from 'vitest'
import { aiAction, aiPlay } from './ai'
import { autoplay } from './autoplay'
import { figureCoverGrade } from './cover'
import { alive, applyAction, canPass, createGame, replay } from './game'
import { defaultSkirmish } from './skirmish'
import { newStream } from '../dice'
import { otherSide, type Action, type GameSetup, type GameState, type SideId, type SideSetup } from '../types'

/** One figure a side, on a wide table, with the given terrain and positions — just enough of a `GameSetup` to put a single unit within reach of a single piece of cover and nothing else worth doing (the enemy stands far enough off that no shot or charge is ever in range, so seeking cover is the only thing `planActivation` has to offer). */
function coverSeekingSetup(terrain: GameSetup['table']['terrain'], northAt: { x: number; y: number }, southAt: { x: number; y: number }): GameSetup {
  return {
    name: 'test',
    seed: 1,
    battle: 'encounter',
    table: { width: 60, depth: 40, terrain, objectives: [] },
    sides: [
      {
        id: 'north',
        name: 'North',
        motivation: 'medium',
        units: [{ id: 'n1', name: 'n1', quality: 'regular', leadership: 2, armour: 'partial-light', mobility: 'foot', commandLevel: 'squad', figures: [{ id: 'n1-f1', smallArm: 'advanced-rifle', leader: true, position: northAt }] }],
      },
      {
        id: 'south',
        name: 'South',
        motivation: 'medium',
        units: [{ id: 's1', name: 's1', quality: 'regular', leadership: 2, armour: 'partial-light', mobility: 'foot', commandLevel: 'squad', figures: [{ id: 's1-f1', smallArm: 'advanced-rifle', leader: true, position: southAt }] }],
      },
    ],
    turnLimit: 10,
  }
}

/** Drives a battle with the computer on both sides, one activation at a time, and returns the first `move` action `side` itself issues — the point at which it declared where it wants to go. */
function firstMoveBy(setup: GameSetup, side: SideId, seed: number, cap = 60): Extract<Action, { kind: 'move' }> {
  let state = createGame(setup)
  const stream = newStream(seed)
  for (let n = 0; n < cap && !state.result; n++) {
    const toAct: SideId | null = state.phase === 'deployment' ? (!state.sides.north.ready ? 'north' : 'south') : state.toAct
    if (!toAct) break
    const action = aiAction(state, toAct, stream)
    if (!action) break
    if (action.kind === 'move' && action.side === side) return action
    const next = applyAction(state, action)
    if ('ok' in next) throw new Error(`refused: ${next.reason} (${next.page})`)
    state = next
  }
  throw new Error(`${side} never issued a move`)
}

/** A trimmed skirmish (HQ plus one squad a side, instead of HQ plus three) so many seeds run quickly while still exercising every part of the engine. */
function smallSetup(seed: number, turnLimit = 6): GameSetup {
  const base = defaultSkirmish({ seed, turnLimit })
  const trim = (side: SideSetup): SideSetup => ({ ...side, units: side.units.slice(0, 2) })
  return { ...base, sides: [trim(base.sides[0]), trim(base.sides[1])] }
}

/** A side that deploys, lets the other side choose first, and otherwise never activates a unit — the "never acts" opponent. */
function passiveAction(state: GameState, side: SideId): Action | null {
  if (state.result) return null
  if (state.phase === 'deployment') return state.sides[side].ready ? null : { kind: 'ready', side }
  if (state.toAct !== side) return null
  if (state.phase === 'turn-start') return { kind: 'choose-first', side, first: otherSide(side) }
  if (state.activation) return { kind: 'end-activation', side }
  return canPass(state, side) ? { kind: 'pass', side } : { kind: 'done', side }
}

/** Drives a battle turn by turn, asserting every action `applyAction` accepts is never a refusal. */
function playToEnd(setup: GameSetup, actionFor: (state: GameState, side: SideId) => Action | null, cap = 4000): GameState {
  let state = createGame(setup)
  for (let n = 0; n < cap && !state.result; n++) {
    const side: SideId | null = state.phase === 'deployment' ? (!state.sides.north.ready ? 'north' : 'south') : state.toAct
    if (!side) break
    const action = actionFor(state, side)
    if (!action) break
    const next = applyAction(state, action)
    expect('ok' in next).toBe(false)
    state = next as GameState
  }
  return state
}

describe('the computer at the table', () => {
  it('plays computer-vs-computer skirmishes on many seeds without a stall or a refusal, and every journal replays exactly', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const setup = smallSetup(seed, 5)
      const stream = newStream(seed * 31 + 7)
      const state = playToEnd(setup, (s, side) => aiAction(s, side, stream))
      expect(state.result).not.toBeNull()
      const again = replay(setup, state.journal)
      expect(again).toEqual(state)
    }
  })

  it('beats a side that never activates a unit, on most seeds', () => {
    let wins = 0
    const seeds = Array.from({ length: 24 }, (_, i) => i + 1)
    for (const seed of seeds) {
      const smartSide: SideId = seed % 2 === 0 ? 'north' : 'south'
      const setup = smallSetup(seed, 8)
      const stream = newStream(seed * 17 + 3)
      const state = playToEnd(setup, (s, side) => (side === smartSide ? aiAction(s, side, stream) : passiveAction(s, side)))
      expect(state.result).not.toBeNull()
      if (state.result!.winner === smartSide) wins += 1
    }
    expect(wins / seeds.length).toBeGreaterThanOrEqual(0.8)
  })

  it('takes cover and holds objectives measurably more than autoplay\'s random legal play', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => i + 1)
    const coverFraction = (state: GameState) => {
      const figs = Object.values(state.figures).filter(alive)
      if (figs.length === 0) return 0
      const covered = figs.filter((f) => figureCoverGrade(f.position, state.setup.table.terrain) !== 'open').length
      return covered / figs.length
    }
    const objectivesClaimed = (state: GameState) => Object.values(state.objectives).filter((o) => o.heldBy !== null).length

    let smartCover = 0
    let smartObjectives = 0
    let randomCover = 0
    let randomObjectives = 0
    for (const seed of seeds) {
      const setup = smallSetup(seed, 6)
      const smart = aiPlay(setup, { seed: seed * 3 + 1 })
      const random = autoplay(setup, { seed: seed * 3 + 1, maxTurns: 6, maxActions: 3000 }).state
      smartCover += coverFraction(smart)
      smartObjectives += objectivesClaimed(smart)
      randomCover += coverFraction(random)
      randomObjectives += objectivesClaimed(random)
    }
    expect(smartCover / seeds.length).toBeGreaterThan(randomCover / seeds.length)
    expect(smartObjectives / seeds.length).toBeGreaterThanOrEqual(randomObjectives / seeds.length)
  })

  it('is deterministic: the same seed gives the same journal', () => {
    const setup = smallSetup(5, 6)
    const a = aiPlay(setup, { seed: 555 })
    const b = aiPlay(setup, { seed: 555 })
    expect(a.journal).toEqual(b.journal)
    expect(a.result).toEqual(b.result)
  })

  describe('seeking hard cover in buildings and behind walls (p. 12–13)', () => {
    it('heads for a building when standing in the open with nothing more pressing to do', () => {
      const house = { id: 'house', terrain: 'building' as const, shape: { kind: 'rect' as const, x: 14, y: 8, width: 4, height: 4 } }
      const setup = coverSeekingSetup([house], { x: 10, y: 10 }, { x: 58, y: 10 })
      const move = firstMoveBy(setup, 'north', 42)
      const dest = move.moves[0]!.path[move.moves[0]!.path.length - 1]!
      // The building's own centre (16, 10): the computer heads straight into it, not merely nearby.
      expect(dest.x).toBeCloseTo(16, 0)
      expect(dest.y).toBeCloseTo(10, 0)
    })

    it('heads for the sheltered side of a wall, facing the nearest enemy, not merely the wall itself', () => {
      const wall = { id: 'wall', terrain: 'wall' as const, shape: { kind: 'path' as const, points: [{ x: 20, y: 10 }, { x: 20, y: 30 }], width: 0.2 } }
      // The enemy stands east of the wall; the computer starts west of it too, so the correct side to
      // shelter on (away from the enemy) is the same side it is already on.
      const setup = coverSeekingSetup([wall], { x: 10, y: 20 }, { x: 58, y: 20 })
      const move = firstMoveBy(setup, 'north', 7)
      const dest = move.moves[0]!.path[move.moves[0]!.path.length - 1]!
      // West of the wall (x < 20, the side away from the enemy), and close enough to it (within
      // WALL_HEDGE_REACH) that the directional cover test in `cover.ts` actually grants cover there —
      // not the wall's own line (x = 20) or, worse, its exposed east side.
      expect(dest.x).toBeLessThan(20)
      expect(dest.x).toBeGreaterThan(18)
      expect(dest.y).toBeCloseTo(20, 0)
    })
  })
})
