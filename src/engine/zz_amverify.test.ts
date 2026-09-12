import { describe, expect, it } from 'vitest'
import { applyAction, setRulesReading, rulesReading } from './actions'
import { createGame, createShipState, type GameState, type ShipState } from './game'
import { designById } from '../data/ships'
import { CURRENT_RULES_VERSION } from '../data/savedGame'
import type { Phase, ShipDesign } from './types'

function advanceTo(game: GameState, phase: Phase): void {
  let guard = 40
  while (game.phase !== phase && guard-- > 0) applyAction(game, { type: 'advance-phase' })
}
function ship(id: string, side: string, designId: string, at: {x:number;y:number}, facing = 3): ShipState {
  return createShipState({ id, side, design: designById(designId) as ShipDesign,
    placement: { position: at, facing: facing as ShipState['placement']['facing'] }, velocity: 0 })
}
function battle(ships: ShipState[], seed: number, reading = CURRENT_RULES_VERSION): GameState {
  const game = createGame({ seed, sides: [{ id: 'a' }, { id: 'b' }], table: { width: 160, height: 100 }, ships })
  setRulesReading(game, reading)
  return game
}

describe('claimed AM one-hit-kill', () => {
  for (const reading of [CURRENT_RULES_VERSION, 8, 1]) {
    it(`seeds 2,3,5,8 at reading ${reading}`, () => {
      for (const seed of [2, 3, 5, 8, 11, 17, 23, 41]) {
        const shooter = ship('shooter', 'b', 'tyrant-arsenal', { x: 38, y: 50 }, 9)
        const am = shooter.design.weapons.find((w) => w.weaponClass === 'antimatter-missile')!
        const game = battle([ship('mark', 'a', 'izotrope-heavy-cruiser', { x: 24, y: 50 }), shooter], seed, reading)
        expect(rulesReading(game)).toBe(reading)
        advanceTo(game, 'launch-missiles')
        applyAction(game, { type: 'launch-ordnance', shipId: 'shooter', weaponId: am.id, aimPoint: { x: 24, y: 50 } })
        if (game.ordnance.length === 0) { console.log(`reading=${reading} seed=${seed}: no marker launched`); continue }
        const before = game.ordnance[0]
        advanceTo(game, 'point-defence')
        const pre = { missiles: before.missiles, hits: before.hits, kind: before.kind }
        applyAction(game, { type: 'resolve-point-defence' })
        const post = game.ordnance[0]
        const pdLines = game.log.filter((e) => /point defence/.test(e.text)).map((e) => e.text)
        console.log(`reading=${reading} seed=${seed} pre=${JSON.stringify(pre)} postCount=${game.ordnance.length} post=${post ? JSON.stringify({missiles: post.missiles, hits: post.hits}) : 'GONE'} | ${pdLines.join(' || ')}`)
      }
    })
  }
})
