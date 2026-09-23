/**
 * Interface landings (p. 43): craft wait in orbit with their units off the
 * table, come down any number to an activation at least 12" from the
 * nearest enemy in sight, assault landers unloading at once and dropships
 * in a later activation, and craft lost to fire from the ground.
 */

import { describe, expect, it } from 'vitest'
import { newVehicleDesign } from '../design'
import type { VehicleDesign } from '../types'
import { aiPlay } from './ai'
import { applyAction, createGame, functional, replay } from './game'
import { planTableShot } from './tableFire'
import type { Action, ElementSetup, GameSetup, GameState, InterfaceCraft, Point, Refusal, SideId, TerrainFeature, UnitSetup } from './types'

const tank = (): VehicleDesign => ({ ...newVehicleDesign('tank'), name: 'Tank', fireControl: 'basic', weapons: [{ id: 'hkp3', type: 'hkp', class: 3, mount: 'turret', barrels: 1 }] })

interface Spec {
  id: string
  side: SideId
  vehicles?: Point[]
  infantry?: Point[]
}

function setupWith(units: Spec[], craft: InterfaceCraft[], opts: { terrain?: TerrainFeature[]; defence?: GameSetup['landingDefence']; seed?: number } = {}): GameSetup {
  const bySide = (side: SideId): UnitSetup[] =>
    units
      .filter((u) => u.side === side)
      .map((u) => {
        const elements: ElementSetup[] = []
        u.vehicles?.forEach((at, i) => elements.push({ id: `${u.id}-${i + 1}`, name: `${u.id}-${i + 1}`, vehicle: tank(), position: at, facing: side === 'north' ? 180 : 0, leader: i === 0 }))
        u.infantry?.forEach((at, i) => elements.push({ id: `${u.id}-t${i + 1}`, name: `${u.id}-t${i + 1}`, infantry: { troops: 'line', team: 'rifle' }, position: at, leader: elements.length === 0 }))
        return { id: u.id, name: u.id, quality: 'regular', leadership: 2, elements }
      })
  const setup: GameSetup = {
    name: 'landing test',
    seed: opts.seed ?? 1,
    battle: 'attack-defence',
    attacker: 'north',
    table: { width: 48, depth: 36, terrain: opts.terrain ?? [], objectives: [] },
    sides: [
      { id: 'north', name: 'North', units: bySide('north') },
      { id: 'south', name: 'South', units: bySide('south') },
    ],
    turnLimit: null,
    craft,
  }
  if (opts.defence) setup.landingDefence = opts.defence
  return setup
}

const must = (result: GameState | Refusal): GameState => {
  if ('ok' in result) throw new Error(`refused: ${result.reason} (${result.page})`)
  return result
}
const refused = (result: GameState | Refusal): Refusal => {
  if (!('ok' in result)) throw new Error('not refused')
  return result
}
const play = (state: GameState, ...actions: Action[]): GameState => actions.reduce((s, a) => must(applyAction(s, a)), state)

function battle(setup: GameSetup, first: SideId = 'north'): GameState {
  let state = play(createGame(setup), { kind: 'ready', side: 'south' }, { kind: 'ready', side: 'north' })
  if (state.phase === 'turn-start') state = must(applyAction(state, { kind: 'choose-first', side: state.chooser!, first }))
  return state
}

/** North: a tank platoon on the table, a rifle platoon in a lander and a tank platoon in a dropship. South: a rifle platoon at (24, 24). */
const standard = (opts: Parameters<typeof setupWith>[2] = {}) =>
  setupWith(
    [
      { id: 'n1', side: 'north', vehicles: [{ x: 10, y: 3 }, { x: 12, y: 3 }] },
      { id: 'n2', side: 'north', infantry: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] },
      { id: 'n3', side: 'north', vehicles: [{ x: 0, y: 0 }, { x: 0, y: 0 }] },
      { id: 's1', side: 'south', infantry: [{ x: 24, y: 24 }, { x: 25, y: 24 }, { x: 26, y: 24 }] },
    ],
    [
      { id: 'lander', side: 'north', name: 'Lander 1', kind: 'lander', unitIds: ['n2'] },
      { id: 'drop', side: 'north', name: 'Dropship 1', kind: 'dropship', unitIds: ['n3'] },
    ],
    opts,
  )

describe('craft in orbit (p. 43)', () => {
  it('keeps the units aboard off the table: not deployable, not targetable, not activatable', () => {
    const start = createGame(standard())
    expect(start.elements['n2-t1']!.aboard).toBe('lander')
    expect(functional(start.elements['n2-t1']!)).toBe(false)
    expect(refused(applyAction(start, { kind: 'deploy', side: 'north', elementId: 'n3-1', position: { x: 5, y: 3 }, facing: 180 })).page).toBe('p. 43')
    const s = battle(standard())
    expect(refused(applyAction(s, { kind: 'activate', side: 'north', unitId: 'n2' })).page).toBe('p. 18')
    const plan = planTableShot(s, { elementId: 's1-t1', weapon: { kind: 'rifles' }, targetId: 'n3-1' }, { activation: null, opportunity: true })
    expect(plan.ok).toBe(false)
  })
})

describe('landing (p. 43)', () => {
  it('lands any number of craft as one activation, 12" or more from the nearest enemy in sight', () => {
    const s = battle(standard())
    const close = refused(applyAction(s, { kind: 'land-craft', side: 'north', landings: [{ craftId: 'lander', at: { x: 24, y: 14 } }] }))
    expect(close.page).toBe('p. 43')
    expect(close.reason).toContain('12"')
    const after = play(s, { kind: 'land-craft', side: 'north', landings: [{ craftId: 'lander', at: { x: 24, y: 11 } }, { craftId: 'drop', at: { x: 10, y: 10 } }] })
    // One activation: the turn passes to south.
    expect(after.toAct).toBe('south')
    expect(after.craft['lander']!.status).toBe('empty')
    expect(after.craft['drop']!.status).toBe('landed')
    // The lander's platoon is out and on the table beside it.
    for (const id of ['n2-t1', 'n2-t2', 'n2-t3']) {
      const el = after.elements[id]!
      expect(el.aboard).toBeNull()
      expect(Math.hypot(el.position.x - 24, el.position.y - 11)).toBeLessThan(3)
    }
    // The dropship's platoon is still aboard.
    expect(after.elements['n3-1']!.aboard).toBe('drop')
  })

  it('lets a craft land nearer an enemy that cannot see the spot', () => {
    const wood: TerrainFeature = { id: 'w', terrain: 'dense-woods', shape: { kind: 'rect', x: 18, y: 17, width: 14, height: 3 } }
    const s = battle(standard({ terrain: [wood] }))
    must(applyAction(s, { kind: 'land-craft', side: 'north', landings: [{ craftId: 'lander', at: { x: 24, y: 14 } }] }))
  })

  it('refuses open water, a spot off the table, and a craft landed twice', () => {
    const lake: TerrainFeature = { id: 'l', terrain: 'open-water', shape: { kind: 'circle', centre: { x: 8, y: 8 }, radius: 3 } }
    const s = battle(standard({ terrain: [lake] }))
    expect(refused(applyAction(s, { kind: 'land-craft', side: 'north', landings: [{ craftId: 'drop', at: { x: 8, y: 8 } }] })).reason).toContain('open water')
    expect(refused(applyAction(s, { kind: 'land-craft', side: 'north', landings: [{ craftId: 'drop', at: { x: 60, y: 8 } }] })).page).toBe('p. 43')
    expect(refused(applyAction(s, { kind: 'land-craft', side: 'north', landings: [{ craftId: 'drop', at: { x: 14, y: 8 } }, { craftId: 'drop', at: { x: 20, y: 8 } }] })).reason).toContain('only once')
  })

  it('unloads a dropship in a later activation, as a full activation of its own', () => {
    let s = battle(standard())
    s = play(s, { kind: 'land-craft', side: 'north', landings: [{ craftId: 'drop', at: { x: 10, y: 10 } }] })
    s = play(s, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' })
    expect(s.toAct).toBe('north')
    const out = play(s, { kind: 'unload', side: 'north', craftId: 'drop' })
    expect(out.craft['drop']!.status).toBe('empty')
    expect(out.elements['n3-1']!.aboard).toBeNull()
    expect(out.toAct).toBe('north') // south has nothing left to activate this turn
    expect(refused(applyAction(out, { kind: 'unload', side: 'north', craftId: 'drop' })).page).toBe('p. 43')
    // The unloaded platoon has its activation still to make.
    must(applyAction(out, { kind: 'activate', side: 'north', unitId: 'n3' }))
  })

  it('loses craft to the defence on its score while the defending unit is in action', () => {
    let lost = 0
    let through = 0
    for (let seed = 1; seed <= 60; seed++) {
      const s = battle(standard({ seed, defence: [{ unitId: 's1', needs: 5 }] }))
      const after = play(s, { kind: 'land-craft', side: 'north', landings: [{ craftId: 'drop', at: { x: 10, y: 10 } }] })
      if (after.craft['drop']!.status === 'lost') {
        lost += 1
        expect(after.elements['n3-1']!.destroyed).toBe(true)
        expect(after.log.some((l) => /shot down/.test(l.text))).toBe(true)
      } else through += 1
    }
    // A third of craft fall on 5+.
    expect(lost).toBeGreaterThan(10)
    expect(through).toBeGreaterThan(25)
    // With the defending unit gone, nothing fires.
    const s = battle(standard({ defence: [{ unitId: 's1', needs: 2 }] }))
    const gone = structuredClone(s)
    for (const id of ['s1-t1', 's1-t2', 's1-t3']) gone.elements[id]!.destroyed = true
    const after = must(applyAction(gone, { kind: 'land-craft', side: 'north', landings: [{ craftId: 'drop', at: { x: 10, y: 10 } }] }))
    expect(after.craft['drop']!.status).toBe('landed')
  })

  it('does not end the battle while a side still has units in orbit', () => {
    const setup = setupWith(
      [
        { id: 'n1', side: 'north', vehicles: [{ x: 10, y: 3 }] },
        { id: 'n2', side: 'north', infantry: [{ x: 0, y: 0 }] },
        { id: 's1', side: 'south', infantry: [{ x: 24, y: 24 }] },
      ],
      [{ id: 'lander', side: 'north', name: 'Lander 1', kind: 'lander', unitIds: ['n2'] }],
    )
    const s = battle(setup)
    const wiped = structuredClone(s)
    wiped.elements['n1-1']!.destroyed = true
    // North's table force is gone but a lander is still up: the turn ends and the next begins.
    const next = play(wiped, { kind: 'done', side: 'north' }, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' })
    expect(next.turn).toBe(2)
    expect(next.result).toBeNull()
    // With the lander lost as well, north is beaten when the turn turns.
    const empty = structuredClone(wiped)
    empty.craft['lander']!.status = 'lost'
    empty.elements['n2-t1']!.destroyed = true
    const over = play(empty, { kind: 'done', side: 'north' }, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' })
    expect(over.result?.winner).toBe('south')
  })

  it('lets the computer bring its craft down and unload them, and replays the battle exactly', () => {
    for (const seed of [2, 9, 21]) {
      const setup = standard({ seed, defence: [{ unitId: 's1', needs: 6 }] })
      const state = aiPlay({ ...setup, turnLimit: 6 }, { seed })
      expect(state.log.some((l) => /touches down|shot down/.test(l.text))).toBe(true)
      const again = replay({ ...setup, turnLimit: 6 }, state.journal)
      expect(again.elements).toEqual(state.elements)
      expect(again.craft).toEqual(state.craft)
    }
  })
})
