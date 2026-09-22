/**
 * The game on the table, against the printed rules: deployment and the
 * activation sequence (pp. 17–19), opportunity fire (p. 20), confidence
 * (pp. 21–24), movement (pp. 25–27), fire (pp. 28–32) and the infantry's
 * own fire (pp. 33–36).
 */

import { describe, expect, it } from 'vitest'
import { newVehicleDesign } from '../design'
import type { DirectFireWeapon, VehicleDesign } from '../types'
import { applyAction, canPass, createGame, isOrganised, replay, unactivatedUnits } from './game'
import { planTableShot } from './tableFire'
import type { Action, ElementSetup, GameSetup, GameState, Point, Refusal, SideId, TerrainFeature, UnitSetup } from './types'

const gun = (type: DirectFireWeapon['type'], cls: DirectFireWeapon['class'], mount: DirectFireWeapon['mount'] = 'turret'): DirectFireWeapon => ({ id: `${type}${cls}`, type, class: cls, mount, barrels: 1 })

/** A medium tank: HKP/3 in a turret, basic fire control, armour 3, fast tracked (12"). */
const tank = (patch: Partial<VehicleDesign> = {}): VehicleDesign => ({ ...newVehicleDesign('tank'), name: 'Tank', fireControl: 'basic', weapons: [gun('hkp', 3)], ...patch })
/** A fast GEV with a fixed MDC/2, for the fixed-mount rules. */
const gev = (): VehicleDesign => ({ ...newVehicleDesign('gev'), name: 'GEV', size: 2, mobility: 'fast-gev', armour: 2, fireControl: 'basic', weapons: [gun('mdc', 2, 'fixed')] })

interface UnitSpec {
  id: string
  side: SideId
  name?: string
  quality?: UnitSetup['quality']
  leadership?: UnitSetup['leadership']
  confidence?: UnitSetup['confidence']
  commandUnit?: boolean
  vehicles?: { design: VehicleDesign; at: Point; facing?: number; dugIn?: boolean }[]
  infantry?: { troops: 'militia' | 'line' | 'powered'; team: 'rifle' | 'apsw' | 'observer'; at: Point }[]
}

function setupWith(units: UnitSpec[], opts: { terrain?: TerrainFeature[]; objectives?: GameSetup['table']['objectives']; seed?: number; turnLimit?: number | null } = {}): GameSetup {
  const bySide = (side: SideId): UnitSetup[] =>
    units
      .filter((u) => u.side === side)
      .map((u) => {
        const elements: ElementSetup[] = []
        u.vehicles?.forEach((v, i) => elements.push({ id: `${u.id}-${i + 1}`, name: `${u.id}-${i + 1}`, vehicle: structuredClone(v.design), position: v.at, facing: v.facing ?? (side === 'north' ? 180 : 0), leader: i === 0, dugIn: v.dugIn }))
        u.infantry?.forEach((t, i) => elements.push({ id: `${u.id}-t${i + 1}`, name: `${u.id}-t${i + 1}`, infantry: { troops: t.troops, team: t.team }, position: t.at, facing: side === 'north' ? 180 : 0, leader: elements.length === 0 }))
        const unit: UnitSetup = { id: u.id, name: u.name ?? u.id, quality: u.quality ?? 'regular', leadership: u.leadership ?? 2, elements }
        if (u.confidence) unit.confidence = u.confidence
        if (u.commandUnit) unit.commandUnit = true
        return unit
      })
  return {
    name: 'test',
    seed: opts.seed ?? 1,
    battle: 'encounter',
    table: { width: 48, depth: 36, terrain: opts.terrain ?? [], objectives: opts.objectives ?? [] },
    sides: [
      { id: 'north', name: 'North', units: bySide('north') },
      { id: 'south', name: 'South', units: bySide('south') },
    ],
    turnLimit: opts.turnLimit === undefined ? null : opts.turnLimit,
  }
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

/** Deploy both sides where the setup put them, and let `first` activate first. */
function battle(setup: GameSetup, first: SideId = 'north'): GameState {
  let state = play(createGame(setup), { kind: 'ready', side: 'north' }, { kind: 'ready', side: 'south' })
  if (state.phase === 'turn-start') state = must(applyAction(state, { kind: 'choose-first', side: state.chooser!, first }))
  return state
}

const lastLog = (state: GameState, n = 1) => state.log.slice(-n).map((l) => l.text).join(' | ')
/** Close an opportunity window the other side was offered, declining it. */
const settle = (state: GameState): GameState => (state.activation?.window ? must(applyAction(state, { kind: 'decline-opportunity', side: state.activation.window.sideId })) : state)
/** A move, with any opportunity window declined. */
const mv = (state: GameState, side: SideId, elementId: string, path: Point[]): GameState => settle(must(applyAction(state, { kind: 'move', side, elementId, path })))

/** Two tank platoons facing each other across open ground at 20". */
const openField = () =>
  setupWith([
    { id: 'n1', side: 'north', commandUnit: true, vehicles: [{ design: tank(), at: { x: 10, y: 4 } }, { design: tank(), at: { x: 12, y: 4 } }, { design: tank(), at: { x: 14, y: 4 } }] },
    { id: 'n2', side: 'north', vehicles: [{ design: tank(), at: { x: 30, y: 4 } }, { design: tank(), at: { x: 32, y: 4 } }] },
    { id: 's1', side: 'south', commandUnit: true, vehicles: [{ design: tank(), at: { x: 10, y: 24 } }, { design: tank(), at: { x: 12, y: 24 } }, { design: tank(), at: { x: 14, y: 24 } }] },
  ])

describe('deployment (p. 17)', () => {
  it('refuses a deployment beyond 6" of the baseline and accepts one within', () => {
    const state = createGame(openField())
    expect(refused(applyAction(state, { kind: 'deploy', side: 'north', elementId: 'n1-1', position: { x: 10, y: 7 }, facing: 180 })).page).toBe('p. 17')
    const next = must(applyAction(state, { kind: 'deploy', side: 'north', elementId: 'n1-1', position: { x: 10, y: 5.5 }, facing: 90 }))
    expect(next.elements['n1-1']!.position).toEqual({ x: 10, y: 5.5 })
    expect(next.elements['n1-1']!.facing).toBe(90)
  })

  it('starts turn 1 when both sides are ready, and the side with fewer units chooses (p. 18)', () => {
    const state = play(createGame(openField()), { kind: 'ready', side: 'north' }, { kind: 'ready', side: 'south' })
    expect(state.turn).toBe(1)
    expect(state.phase).toBe('turn-start')
    expect(state.chooser).toBe('south')
    expect(refused(applyAction(state, { kind: 'choose-first', side: 'north', first: 'north' })).page).toBe('p. 18')
    const on = must(applyAction(state, { kind: 'choose-first', side: 'south', first: 'north' }))
    expect(on.phase).toBe('activation')
    expect(on.toAct).toBe('north')
  })
})

describe('the activation sequence (pp. 17–19)', () => {
  it('alternates activations, inverts the marker, and ends the turn when both are spent', () => {
    let state = battle(openField())
    state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'end-activation', side: 'north' })
    expect(state.units['n1']!.activated).toBe(true)
    expect(state.toAct).toBe('south')
    expect(refused(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n2' })).page).toBe('p. 18')
    state = play(state, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' })
    // South has nothing left: north continues.
    expect(state.toAct).toBe('north')
    state = play(state, { kind: 'activate', side: 'north', unitId: 'n2' }, { kind: 'end-activation', side: 'north' })
    expect(state.turn).toBe(2)
    expect(state.phase).toBe('turn-start')
    expect(Object.values(state.units).every((u) => !u.activated)).toBe(true)
  })

  it('lets only the side with fewer unactivated units pass, and then the other activates twice (p. 17)', () => {
    let state = battle(openField(), 'south')
    expect(canPass(state, 'south')).toBe(true)
    expect(refused(applyAction(battle(openField(), 'north'), { kind: 'pass', side: 'north' })).page).toBe('p. 17')
    state = must(applyAction(state, { kind: 'pass', side: 'south' }))
    expect(state.toAct).toBe('north')
    state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'end-activation', side: 'north' })
    expect(state.toAct).toBe('north')
    state = play(state, { kind: 'activate', side: 'north', unitId: 'n2' }, { kind: 'end-activation', side: 'north' })
    expect(state.toAct).toBe('south')
  })

  it('a side may declare itself done, leaving its units unactivated for opportunity fire (p. 18)', () => {
    let state = battle(openField())
    state = must(applyAction(state, { kind: 'done', side: 'north' }))
    expect(state.toAct).toBe('south')
    expect(unactivatedUnits(state, 'north')).toHaveLength(2)
  })
})

describe('movement (pp. 25–27)', () => {
  it('moves within the base movement factor and refuses beyond it', () => {
    let state = battle(openField())
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const far = refused(applyAction(state, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 17 }] }))
    expect(far.page).toBe('p. 25')
    expect(far.reason).toMatch(/base movement is 12/)
    // Six inches along the line, staying within integrity of the platoon.
    state = mv(state, 'north', 'n1-1', [{ x: 16, y: 4 }])
    expect(state.elements['n1-1']!.position).toEqual({ x: 16, y: 4 })
    expect(state.elements['n1-1']!.facing).toBe(90)
    expect(state.activation!.elements['n1-1']!.factorsUsed).toBeCloseTo(6, 1)
    // A second leg spends the rest; a third is refused.
    state = mv(state, 'north', 'n1-1', [{ x: 16, y: 10 }])
    expect(state.elements['n1-1']!.facing).toBe(180)
    expect(refused(applyAction(state, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 16, y: 11 }] })).page).toBe('p. 25')
  })

  it('a damaged vehicle moves at half speed (p. 30), and one that fired first may move only half (p. 28)', () => {
    const setup = openField()
    let state = battle(setup)
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const damaged = structuredClone(state)
    damaged.elements['n1-1']!.damaged = true
    expect(refused(applyAction(damaged, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 11 }] })).page).toBe('p. 30')
    must(applyAction(damaged, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 10 }] }))
    // Fire first at the southern tanks, 20" away: then at most 6".
    const fired = must(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-1', weapon: { kind: 'direct', weaponId: 'hkp3' }, targetId: 's1-1' }] }))
    expect(fired.activation!.elements['n1-1']!.firedBeforeMoving).toBe(true)
    expect(refused(applyAction(fired, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 11 }] })).page).toBe('p. 28')
    must(applyAction(fired, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 10 }] }))
  })

  it('keeps a disorganised unit from moving except back into integrity (p. 23)', () => {
    const setup = setupWith([
      { id: 'n1', side: 'north', vehicles: [{ design: tank(), at: { x: 10, y: 4 } }, { design: tank(), at: { x: 20, y: 4 } }] },
      { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 10, y: 34 } }] },
    ])
    let state = battle(setup)
    expect(isOrganised(state, state.units['n1']!)).toBe(false)
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 10 }] })).page).toBe('p. 23')
    state = must(applyAction(state, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 18, y: 4 }] }))
    expect(isOrganised(state, state.units['n1']!)).toBe(true)
  })

  it('takes an objective moved over (p. 17) and leaves a prepared position behind (p. 20)', () => {
    const setup = setupWith(
      [
        { id: 'n1', side: 'north', vehicles: [{ design: tank(), at: { x: 10, y: 4 }, dugIn: true }] },
        { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 40, y: 34 } }] },
      ],
      { objectives: [{ id: 'A', position: { x: 10, y: 12 }, value: 3, drawnBy: 'south' }] },
    )
    let state = battle(setup)
    state = mv(must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' })), 'north', 'n1-1', [{ x: 10, y: 14 }])
    expect(state.objectives['A']!.heldBy).toBe('north')
    expect(state.elements['n1-1']!.dugIn).toBe(false)
    expect(lastLog(state, 2)).toMatch(/takes objective A/)
  })

  it('a routed unit must withdraw towards its baseline and broken armour may not advance (p. 22)', () => {
    const setup = setupWith([
      { id: 'n1', side: 'north', confidence: 'RO', vehicles: [{ design: tank(), at: { x: 10, y: 10 } }] },
      { id: 'n2', side: 'north', confidence: 'BR', vehicles: [{ design: tank(), at: { x: 30, y: 10 } }] },
      { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 20, y: 34 } }] },
    ])
    let state = battle(setup)
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 14 }] })).reason).toMatch(/withdraw/)
    expect(refused(applyAction(state, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 14, y: 10 }] })).reason).toMatch(/withdraw/)
    state = mv(state, 'north', 'n1-1', [{ x: 10, y: 4 }])
    state = play(state, { kind: 'end-activation', side: 'north' }, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' }, { kind: 'activate', side: 'north', unitId: 'n2' })
    expect(refused(applyAction(state, { kind: 'move', side: 'north', elementId: 'n2-1', path: [{ x: 30, y: 14 }] })).page).toBe('p. 22')
    must(applyAction(state, { kind: 'move', side: 'north', elementId: 'n2-1', path: [{ x: 30, y: 6 }] }))
  })

  it('a unit under fire tests before it moves; failing the test spends the attempt (p. 24)', () => {
    // Find seeds where the test passes and fails.
    const outcomes = new Set<string>()
    for (let seed = 1; seed < 40 && outcomes.size < 2; seed++) {
      const setup = openField()
      setup.seed = seed
      let state = battle(setup)
      state.units['n1']!.underFire = true
      state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 10 }] })
      const moved = state.elements['n1-1']!.position.y === 10
      expect(state.log.some((l) => /tests to move/.test(l.text) && l.page === 'p. 24')).toBe(true)
      if (moved) {
        expect(state.activation!.moveTest).toBe('passed')
        outcomes.add('passed')
      } else {
        expect(state.activation!.moveTest).toBe('failed')
        expect(refused(applyAction(state, { kind: 'move', side: 'north', elementId: 'n1-2', path: [{ x: 12, y: 10 }] })).page).toBe('p. 24')
        outcomes.add('failed')
      }
    }
    expect(outcomes.size).toBe(2)
  })
})

describe('fire on the table (pp. 28–32)', () => {
  it('resolves a volley, marks the element as having made its combat action, and refuses a second weapon (p. 18)', () => {
    let state = battle(openField())
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    state = must(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-1', weapon: { kind: 'direct', weaponId: 'hkp3' }, targetId: 's1-1' }, { elementId: 'n1-2', weapon: { kind: 'direct', weaponId: 'hkp3' }, targetId: 's1-1' }] }))
    expect(state.activation!.elements['n1-1']!.fired).toBe(true)
    expect(state.log.filter((l) => /HKP\/3 at medium range/.test(l.text))).toHaveLength(2)
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-1', weapon: { kind: 'apsw' }, targetId: 's1-3' }] })).page).toBe('p. 18')
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-3', weapon: { kind: 'direct', weaponId: 'hkp3' }, targetId: 's1-3' }, { elementId: 'n1-3', weapon: { kind: 'direct', weaponId: 'hkp3' }, targetId: 's1-2' }] })).page).toBe('p. 18')
  })

  it('a fixed mount fires only before moving and only through its 30° arc (p. 11, p. 18)', () => {
    // n1-2 faces 160°: the target at 10,20 bears 180°, 20° off — outside 15° either side.
    const setup = setupWith([
      { id: 'n1', side: 'north', vehicles: [{ design: gev(), at: { x: 10, y: 4 }, facing: 180 }, { design: gev(), at: { x: 10, y: 6 }, facing: 160 }, { design: gev(), at: { x: 10, y: 8 }, facing: 170 }] },
      { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 10, y: 20 } }] },
    ])
    let state = battle(setup)
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-2', weapon: { kind: 'direct', weaponId: 'mdc2' }, targetId: 's1-1' }] })).reason).toMatch(/30°/)
    must(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-3', weapon: { kind: 'direct', weaponId: 'mdc2' }, targetId: 's1-1' }] }))
    const moved = must(applyAction(state, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 8 }] }))
    const after = moved.activation!.window ? must(applyAction(moved, { kind: 'decline-opportunity', side: 'south' })) : moved
    expect(refused(applyAction(after, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-1', weapon: { kind: 'direct', weaponId: 'mdc2' }, targetId: 's1-1' }] })).page).toBe('p. 18')
    must(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-1', weapon: { kind: 'direct', weaponId: 'mdc2' }, targetId: 's1-1' }] }))
  })

  it('needs a line of sight: a wood between blocks, an element within a wood cannot be shot (p. 4, p. 20)', () => {
    const wood: TerrainFeature = { id: 'w', terrain: 'light-woods', shape: { kind: 'circle', centre: { x: 10, y: 14 }, radius: 4 }, label: 'the wood' }
    const setup = setupWith(
      [
        { id: 'n1', side: 'north', vehicles: [{ design: tank(), at: { x: 10, y: 4 } }] },
        { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 10, y: 24 } }, { design: tank(), at: { x: 10, y: 14 } }] },
      ],
      { terrain: [wood] },
    )
    let state = battle(setup)
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-1', weapon: { kind: 'direct', weaponId: 'hkp3' }, targetId: 's1-1' }] })).page).toBe('p. 4')
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-1', weapon: { kind: 'direct', weaponId: 'hkp3' }, targetId: 's1-2' }] })).reason).toMatch(/within a wood/)
  })

  it('applies the hit, marks a vehicle unit under fire only when hurt, and tests confidence (pp. 22–24)', () => {
    // Enough seeds to see a knock-out: a close-range HKP/3 volley from three tanks.
    let seen = false
    for (let seed = 1; seed < 60 && !seen; seed++) {
      const setup = setupWith(
        [
          { id: 'n1', side: 'north', vehicles: [{ design: tank({ fireControl: 'superior' }), at: { x: 10, y: 4 } }, { design: tank({ fireControl: 'superior' }), at: { x: 12, y: 4 } }, { design: tank({ fireControl: 'superior' }), at: { x: 14, y: 4 } }] },
          { id: 's1', side: 'south', vehicles: [{ design: tank({ armour: 1 }), at: { x: 10, y: 12 } }, { design: tank({ armour: 1 }), at: { x: 12, y: 12 } }, { design: tank({ armour: 1 }), at: { x: 14, y: 12 } }, { design: tank({ armour: 1 }), at: { x: 16, y: 12 } }] },
        ],
        { seed },
      )
      let state = battle(setup)
      state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'fire', side: 'north', shots: ['n1-1', 'n1-2', 'n1-3'].map((id) => ({ elementId: id, weapon: { kind: 'direct' as const, weaponId: 'hkp3' }, targetId: 's1-1' })) })
      const target = state.elements['s1-1']!
      const unit = state.units['s1']!
      if (target.destroyed || target.damaged) {
        seen = true
        expect(unit.underFire).toBe(true)
        expect(unit.casualties).toBe(1)
        expect(unit.firstLossTaken).toBe(true)
        // The first loss is +1; the leader's destruction +3 (s1-1 leads the unit).
        expect(state.log.some((l) => (target.destroyed ? /tests confidence at \+3 \(leader destroyed\)/ : /tests confidence at \+1/).test(l.text))).toBe(true)
        if (target.destroyed) expect(state.log.some((l) => /takes command/.test(l.text))).toBe(true)
      } else {
        expect(unit.underFire).toBe(false)
        expect(unit.casualties).toBe(0)
      }
    }
    expect(seen).toBe(true)
  })

  it('a wasted shot at a target already knocked out is still resolved as declared (p. 28)', () => {
    let state = battle(openField())
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    state.elements['s1-1']!.destroyed = true
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-1', weapon: { kind: 'direct', weaponId: 'hkp3' }, targetId: 's1-1' }] })).reason).toMatch(/already out of action/)
  })
})

describe('opportunity fire (p. 20)', () => {
  it('opens a window after an enemy element moves in sight, and the firing unit spends its activation', () => {
    let state = battle(openField())
    state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 10 }] })
    expect(state.activation!.window).toEqual({ sideId: 'south', movedElementId: 'n1-1' })
    expect(state.toAct).toBe('south')
    expect(refused(applyAction(state, { kind: 'move', side: 'north', elementId: 'n1-2', path: [{ x: 12, y: 10 }] })).page).toBe('p. 20')
    expect(refused(applyAction(state, { kind: 'opportunity-fire', side: 'south', unitId: 's1', shots: [{ elementId: 's1-1', weapon: { kind: 'direct', weaponId: 'hkp3' }, targetId: 'n2-1' }] })).reason).toMatch(/unit being moved/)
    state = must(applyAction(state, { kind: 'opportunity-fire', side: 'south', unitId: 's1', shots: [{ elementId: 's1-1', weapon: { kind: 'direct', weaponId: 'hkp3' }, targetId: 'n1-1' }] }))
    expect(state.units['s1']!.activated).toBe(true)
    expect(state.activation!.window).toBeNull()
    expect(state.toAct).toBe('north')
    // South has no unit left to fire: no further windows. (A sideways step: if the salvo killed the
    // command vehicle, north may not start a new offensive this turn, p. 24.)
    state = must(applyAction(state, { kind: 'move', side: 'north', elementId: 'n1-2', path: [{ x: 13, y: 3.5 }] }))
    expect(state.activation!.window).toBeNull()
  })

  it('can be waived for the rest of the activation', () => {
    let state = battle(openField())
    state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 10 }] }, { kind: 'decline-opportunity', side: 'south', forActivation: true })
    state = must(applyAction(state, { kind: 'move', side: 'north', elementId: 'n1-2', path: [{ x: 12, y: 9 }] }))
    expect(state.activation!.window).toBeNull()
    expect(state.toAct).toBe('north')
  })
})

describe('confidence, rallying and repairs (pp. 22–24, p. 32)', () => {
  it('rallies through the command unit as the rallied unit\'s activation (p. 24)', () => {
    const outcomes = new Set<string>()
    for (let seed = 1; seed < 40 && outcomes.size < 2; seed++) {
      const setup = openField()
      setup.seed = seed
      setup.sides[0]!.units[1]!.confidence = 'BR'
      let state = battle(setup)
      expect(refused(applyAction(state, { kind: 'rally', side: 'north', unitId: 'n1' })).reason).toMatch(/rallies other units|already confident/)
      state = must(applyAction(state, { kind: 'rally', side: 'north', unitId: 'n2' }))
      expect(state.units['n2']!.activated).toBe(true)
      expect(state.toAct).toBe('south')
      outcomes.add(state.units['n2']!.confidence)
      expect(['SH', 'BR']).toContain(state.units['n2']!.confidence)
    }
    expect(outcomes).toEqual(new Set(['SH', 'BR']))
  })

  it('refuses rallying without a command unit on the table (p. 24)', () => {
    const setup = openField()
    setup.sides[0]!.units[1]!.confidence = 'SH'
    setup.sides[0]!.units[0]!.commandUnit = false
    const state = battle(setup)
    expect(refused(applyAction(state, { kind: 'rally', side: 'north', unitId: 'n2' })).page).toBe('p. 24')
  })

  it('repairs systems in a later activation on a 6, or 3+ with backup systems (p. 32, p. 45)', () => {
    const setup = openField()
    setup.sides[0]!.units[0]!.elements[1]!.vehicle!.backupSystems = true
    let state = battle(setup)
    state.elements['n1-1']!.systemsDown = true
    state.elements['n1-1']!.systemsDownAt = 0
    state.elements['n1-2']!.systemsDown = true
    state.elements['n1-2']!.systemsDownAt = 0
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'repair', side: 'north', elementId: 'n1-1' })).page).toBe('p. 32')
    state = play(state, { kind: 'end-activation', side: 'north' }, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' }, { kind: 'activate', side: 'north', unitId: 'n2' }, { kind: 'end-activation', side: 'north' })
    // Turn 2: the tanks may try.
    state = must(applyAction(state, { kind: 'choose-first', side: state.chooser!, first: 'north' }))
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    state = must(applyAction(state, { kind: 'repair', side: 'north', elementId: 'n1-1' }))
    expect(lastLog(state)).toMatch(/needing 6/)
    state = must(applyAction(state, { kind: 'repair', side: 'north', elementId: 'n1-2' }))
    expect(lastLog(state)).toMatch(/needing 3 with backup systems/)
    const again = refused(applyAction(state, { kind: 'repair', side: 'north', elementId: 'n1-1' }))
    expect(again.reason).toMatch(state.elements['n1-1']!.systemsDown ? /once this activation/ : /systems are up/)
  })

  it('a green unit tests for panic on first contact (p. 23)', () => {
    const outcomes = new Set<boolean>()
    for (let seed = 1; seed < 40 && outcomes.size < 2; seed++) {
      const setup = setupWith(
        [
          { id: 'n1', side: 'north', vehicles: [{ design: tank(), at: { x: 10, y: 4 } }] },
          { id: 's1', side: 'south', quality: 'green', leadership: 3, vehicles: [{ design: tank(), at: { x: 10, y: 20 } }] },
        ],
        { seed },
      )
      let state = battle(setup)
      state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-1', weapon: { kind: 'direct', weaponId: 'hkp3' }, targetId: 's1-1' }] })
      expect(state.units['s1']!.contacted).toBe(true)
      expect(state.log.some((l) => /meets the enemy for the first time/.test(l.text))).toBe(true)
      outcomes.add(state.units['s1']!.panic)
    }
    expect(outcomes).toEqual(new Set([true, false]))
  })
})

describe('infantry fire (pp. 33–36)', () => {
  const troops = () =>
    setupWith([
      { id: 'n1', side: 'north', infantry: [{ troops: 'line', team: 'rifle', at: { x: 10, y: 4 } }, { troops: 'line', team: 'rifle', at: { x: 11, y: 4 } }, { troops: 'line', team: 'apsw', at: { x: 12, y: 4 } }, { troops: 'line', team: 'observer', at: { x: 13, y: 4 } }] },
      { id: 's1', side: 'south', infantry: [{ troops: 'militia', team: 'rifle', at: { x: 10, y: 9 } }, { troops: 'militia', team: 'rifle', at: { x: 11, y: 9 } }] },
      { id: 's2', side: 'south', vehicles: [{ design: tank({ armour: 0 }), at: { x: 25, y: 9 } }, { design: tank(), at: { x: 10, y: 7 } }] },
    ])

  it('rolls fire effectiveness once, and refuses rifles beyond 6", an observer team, and an APSW beyond 12"', () => {
    let state = battle(troops())
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-t4', weapon: { kind: 'rifles' }, targetId: 's1-t1' }] })).page).toBe('p. 13')
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-t1', weapon: { kind: 'rifles' }, targetId: 's2-1' }] })).reason).toMatch(/reach 6"/)
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-t3', weapon: { kind: 'apsw' }, targetId: 's2-1' }] })).reason).toMatch(/12"/)
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-t1', weapon: { kind: 'rifles' }, targetId: 's2-2' }] })).page).toBe('p. 36')
    state = must(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-t1', weapon: { kind: 'rifles' }, targetId: 's1-t1' }, { elementId: 'n1-t2', weapon: { kind: 'rifles' }, targetId: 's1-t2' }, { elementId: 'n1-t3', weapon: { kind: 'apsw' }, targetId: 's1-t1' }] }))
    expect(state.activation!.effectiveness).not.toBeNull()
    expect(state.log.filter((l) => /checks fire effectiveness/.test(l.text))).toHaveLength(1)
    expect(state.units['s1']!.underFire).toBe(true)
    const eff = state.activation!.effectiveness!
    // A draw, or a shot wasted on an element the previous draw removed.
    const resolved = state.log.filter((l) => /Drew |the shot is wasted/.test(l.text)).length
    if (eff.result === 'ineffective') expect(resolved).toBe(0)
    else if (eff.result === 'partial') expect(resolved).toBe(2)
    else expect(resolved).toBe(3)
  })

  it('fires an IAVR at a vehicle within 4" and refuses beyond (p. 36)', () => {
    let state = battle(troops())
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-t1', weapon: { kind: 'iavr' }, targetId: 's2-1' }] })).reason).toMatch(/4"/)
    state = must(applyAction(state, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-t1', weapon: { kind: 'iavr' }, targetId: 's2-2' }] }))
    expect(state.log.some((l) => /\(iavr\)/.test(l.text) && l.page === 'p. 36')).toBe(true)
    expect(state.activation!.effectiveness).toBeNull()
  })
})

describe('the end of the game (p. 17)', () => {
  it('ends on the turn limit with the objectives decided by value', () => {
    const setup = setupWith(
      [
        { id: 'n1', side: 'north', vehicles: [{ design: tank(), at: { x: 10, y: 4 } }] },
        { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 40, y: 34 } }] },
      ],
      { objectives: [{ id: 'A', position: { x: 10, y: 12 }, value: 3, drawnBy: 'north' }, { id: 'B', position: { x: 40, y: 20 }, value: 1, drawnBy: 'south' }], turnLimit: 1 },
    )
    let state = battle(setup, 'north')
    state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 12 }] })
    if (state.activation?.window) state = must(applyAction(state, { kind: 'decline-opportunity', side: 'south' }))
    state = play(state, { kind: 'end-activation', side: 'north' }, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' })
    expect(state.result?.winner).toBe('north')
    expect(state.result?.values).toEqual({ north: 3, south: 0 })
  })

  it('lets a side holding more than half the markers, one in the enemy rear area, declare the end, and replays the journal', () => {
    const setup = setupWith(
      [
        { id: 'n1', side: 'north', vehicles: [{ design: tank(), at: { x: 10, y: 14 } }] },
        { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 40, y: 34 } }] },
      ],
      { objectives: [{ id: 'A', position: { x: 10, y: 25 }, value: 2, drawnBy: 'north' }] },
    )
    let state = battle(setup, 'north')
    expect(refused(applyAction(state, { kind: 'declare-end', side: 'north' })).page).toBe('p. 17')
    // Holding only a marker in its own rear area is not enough, however many that is.
    const ownRear = structuredClone(state)
    ownRear.setup.table.objectives = [{ id: 'B', position: { x: 30, y: 10 }, value: 1, drawnBy: 'north' }]
    ownRear.objectives = { B: { heldBy: 'north' } }
    expect(refused(applyAction(ownRear, { kind: 'declare-end', side: 'north' })).reason).toMatch(/rear area/)
    state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 25 }] })
    if (state.activation?.window) state = must(applyAction(state, { kind: 'decline-opportunity', side: 'south' }))
    state = play(state, { kind: 'end-activation', side: 'north' }, { kind: 'declare-end', side: 'north' })
    expect(state.result?.winner).toBe('north')
    const again = replay(setup, state.journal)
    expect(again).toEqual(state)
  })

  it('in an attack/defence battle only the attacker declares the end, and only the defender starts dug in (p. 17, p. 20)', () => {
    const setup = setupWith(
      [
        { id: 'n1', side: 'north', vehicles: [{ design: tank(), at: { x: 10, y: 4 }, dugIn: true }] },
        { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 40, y: 20 }, dugIn: true }] },
      ],
      { objectives: [{ id: 'A', position: { x: 30, y: 30 }, value: 2, drawnBy: 'south' }] },
    )
    setup.battle = 'attack-defence'
    setup.attacker = 'north'
    const state = battle(setup, 'north')
    expect(state.objectives['A']!.heldBy).toBe('south')
    expect(state.elements['n1-1']!.dugIn).toBe(false)
    expect(state.elements['s1-1']!.dugIn).toBe(true)
    expect(refused(applyAction(state, { kind: 'declare-end', side: 'south' })).reason).toMatch(/only the attacker/)
    // The encounter version: nobody defends, nobody starts dug in.
    const open = setupWith([{ id: 'n1', side: 'north', vehicles: [{ design: tank(), at: { x: 10, y: 4 }, dugIn: true }] }, { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 40, y: 34 } }] }])
    expect(createGame(open).elements['n1-1']!.dugIn).toBe(false)
  })
})

describe('cover on the table (p. 20)', () => {
  const hill: TerrainFeature = { id: 'h', terrain: 'hills', shape: { kind: 'circle', centre: { x: 10, y: 8 }, radius: 3 }, label: 'a hill' }

  it('hull down is claimed only in contact with cover', () => {
    const setup = setupWith(
      [
        { id: 'n1', side: 'north', vehicles: [{ design: tank(), at: { x: 10, y: 4 } }, { design: tank(), at: { x: 10, y: 6 } }] },
        { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 40, y: 34 } }] },
      ],
      { terrain: [hill] },
    )
    let state = battle(setup)
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'posture', side: 'north', elementId: 'n1-1', posture: 'hull-down' })).page).toBe('p. 20')
    state = must(applyAction(state, { kind: 'posture', side: 'north', elementId: 'n1-2', posture: 'hull-down' }))
    expect(state.elements['n1-2']!.posture).toBe('hull-down')
  })

  it('infantry behind a hilltop are in soft cover: red chits only against them', () => {
    const setup = setupWith(
      [
        { id: 'n1', side: 'north', infantry: [{ troops: 'line', team: 'rifle', at: { x: 10, y: 3 } }] },
        { id: 's1', side: 'south', infantry: [{ troops: 'line', team: 'rifle', at: { x: 10, y: 7 } }, { troops: 'line', team: 'rifle', at: { x: 14, y: 3 } }] },
      ],
      { terrain: [hill] },
    )
    let state = battle(setup)
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const plan = planTableShot(state, { elementId: 'n1-t1', weapon: { kind: 'rifles' }, targetId: 's1-t1' }, { activation: state.activation!.elements['n1-t1']!, opportunity: false })
    expect(plan.ok && plan.kind === 'chits' && plan.validity).toBe('RED')
    const open = planTableShot(state, { elementId: 'n1-t1', weapon: { kind: 'rifles' }, targetId: 's1-t2' }, { activation: state.activation!.elements['n1-t1']!, opportunity: false })
    expect(open.ok && open.kind === 'chits' && open.validity).toBe('R/Y')
  })

  it('a prepared position left behind can be re-occupied by either side', () => {
    const setup = setupWith(
      [
        { id: 'n1', side: 'north', vehicles: [{ design: tank(), at: { x: 10, y: 15 }, dugIn: true }] },
        { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 10, y: 24 } }] },
      ],
      { terrain: [] },
    )
    setup.battle = 'attack-defence'
    setup.attacker = 'south'
    let state = battle(setup, 'north')
    expect(state.elements['n1-1']!.dugIn).toBe(true)
    state = mv(must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' })), 'north', 'n1-1', [{ x: 10, y: 10 }])
    expect(state.elements['n1-1']!.dugIn).toBe(false)
    expect(state.prepared).toEqual([{ x: 10, y: 15 }])
    state = play(state, { kind: 'end-activation', side: 'north' }, { kind: 'activate', side: 'south', unitId: 's1' })
    state = mv(state, 'south', 's1-1', [{ x: 10, y: 15 }])
    expect(state.elements['s1-1']!.dugIn).toBe(true)
  })
})

describe('the edge of a wood a vehicle cannot enter (p. 25)', () => {
  it('is left straight back out by the point of entry', () => {
    const wood: TerrainFeature = { id: 'w', terrain: 'light-woods', shape: { kind: 'circle', centre: { x: 10, y: 14 }, radius: 4 }, label: 'the wood' }
    const setup = setupWith(
      [
        { id: 'n1', side: 'north', vehicles: [{ design: gev(), at: { x: 10, y: 6 } }] },
        { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 40, y: 34 } }] },
      ],
      { terrain: [wood] },
    )
    let state = battle(setup)
    state = mv(must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' })), 'north', 'n1-1', [{ x: 10, y: 10.5 }])
    expect(state.elements['n1-1']!.wood).toBe('edge')
    // The entry is the last quarter-inch outside the treeline.
    expect(state.elements['n1-1']!.woodEntry?.x).toBe(10)
    expect(Math.abs((state.elements['n1-1']!.woodEntry?.y ?? 0) - 10)).toBeLessThanOrEqual(0.3)
    state = play(state, { kind: 'end-activation', side: 'north' }, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' })
    state = must(applyAction(state, { kind: 'choose-first', side: state.chooser!, first: 'north' }))
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 13, y: 11 }] })).page).toBe('p. 25')
    state = mv(state, 'north', 'n1-1', [{ x: 10, y: 10 }, { x: 10, y: 6 }])
    expect(state.elements['n1-1']!.woodEntry).toBeNull()
  })
})

describe('one reaction test per move, at the highest threat (p. 23)', () => {
  it('a shaken, under-fire infantry unit advancing rolls once', () => {
    const setup = setupWith([
      { id: 'n1', side: 'north', confidence: 'SH', infantry: [{ troops: 'line', team: 'rifle', at: { x: 10, y: 4 } }] },
      { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 10, y: 30 } }] },
    ])
    let state = battle(setup)
    state.units['n1']!.underFire = true
    state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'move', side: 'north', elementId: 'n1-t1', path: [{ x: 10, y: 6 }] })
    const tests = state.log.filter((l) => /tests to move at \+1/.test(l.text))
    expect(tests).toHaveLength(1)
    expect(tests[0]!.text).toMatch(/under fire and shaken and advancing/)
    expect(state.activation!.moveTest).not.toBeNull()
    expect(state.activation!.advanceTest).toBe(state.activation!.moveTest)
  })
})

describe('opportunity fire weapons (p. 20)', () => {
  it('a fixed mount may fire opportunity fire into its front arc; rifles may not', () => {
    const setup = setupWith([
      { id: 'n1', side: 'north', vehicles: [{ design: tank(), at: { x: 10, y: 4 } }] },
      { id: 's1', side: 'south', vehicles: [{ design: gev(), at: { x: 10, y: 24 }, facing: 0 }], infantry: [{ troops: 'line', team: 'rifle', at: { x: 12, y: 24 } }] },
    ])
    let state = battle(setup)
    state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'move', side: 'north', elementId: 'n1-1', path: [{ x: 10, y: 12 }] })
    expect(state.activation!.window?.sideId).toBe('south')
    expect(refused(applyAction(state, { kind: 'opportunity-fire', side: 'south', unitId: 's1', shots: [{ elementId: 's1-t1', weapon: { kind: 'rifles' }, targetId: 'n1-1' }] })).reason).toMatch(/direct fire/)
    state = must(applyAction(state, { kind: 'opportunity-fire', side: 'south', unitId: 's1', shots: [{ elementId: 's1-1', weapon: { kind: 'direct', weaponId: 'mdc2' }, targetId: 'n1-1' }] }))
    expect(state.units['s1']!.activated).toBe(true)
  })
})

describe('regrouping (p. 24)', () => {
  it('merges the activated unit into an unactivated one it has closed up with', () => {
    const setup = setupWith([
      { id: 'n1', side: 'north', quality: 'veteran', leadership: 2, confidence: 'BR', vehicles: [{ design: tank(), at: { x: 10, y: 4 } }, { design: tank(), at: { x: 12, y: 4 } }] },
      { id: 'n2', side: 'north', quality: 'regular', leadership: 3, confidence: 'ST', vehicles: [{ design: tank(), at: { x: 20, y: 4 } }, { design: tank(), at: { x: 22, y: 4 } }, { design: tank(), at: { x: 24, y: 4 } }] },
      // The enemy to the west, so closing up eastward is not advancing for the broken unit.
      { id: 's1', side: 'south', vehicles: [{ design: tank(), at: { x: 2, y: 34 } }] },
    ])
    let state = battle(setup)
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'regroup', side: 'north', intoUnitId: 'n2' })).reason).toMatch(/within 3"/)
    state = mv(state, 'north', 'n1-1', [{ x: 18, y: 4 }])
    state = mv(state, 'north', 'n1-2', [{ x: 18, y: 6 }])
    state = must(applyAction(state, { kind: 'regroup', side: 'north', intoUnitId: 'n2' }))
    // The book's example: veteran 2 broken joins regular 3 steady — regular 2, shaken.
    const merged = state.units['n2']!
    expect(state.units['n1']).toBeUndefined()
    expect(merged.quality).toBe('regular')
    expect(merged.leadership).toBe(2)
    expect(merged.confidence).toBe('SH')
    expect(merged.elementIds).toHaveLength(5)
    expect(merged.activated).toBe(true)
    expect(state.activation).toBeNull()
    expect(state.elements['n1-1']!.unitId).toBe('n2')
  })
})

describe('a SLAM salvo at medium or long range (p. 30)', () => {
  it('may catch other elements within 1" of the target on a 5 or 6, drawing the SLAM\'s chits', () => {
    const slamTank = tank({ fireControl: 'superior', weapons: [gun('slam', 4)] })
    let caught = false
    for (let seed = 1; seed < 60 && !caught; seed++) {
      const setup = setupWith(
        [
          { id: 'n1', side: 'north', vehicles: [{ design: slamTank, at: { x: 10, y: 4 } }] },
          // 20" away: medium range for a SLAM (12/24/36). Two elements 0.8" from the target, and one 3" off.
          { id: 's1', side: 'south', vehicles: [{ design: tank({ armour: 1 }), at: { x: 10, y: 24 } }, { design: tank({ armour: 1 }), at: { x: 10.8, y: 24 } }, { design: tank({ armour: 1 }), at: { x: 13, y: 24 } }], infantry: [{ troops: 'line', team: 'rifle', at: { x: 10, y: 24.7 } }] },
        ],
        { seed },
      )
      let state = battle(setup)
      state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-1', weapon: { kind: 'direct', weaponId: 'slam4' }, targetId: 's1-1' }] })
      const splash = state.log.filter((l) => /from the salvo's target|caught in the salvo/.test(l.text))
      const hit = state.log.some((l) => /— hit\.|hits\./.test(l.text))
      if (!hit) {
        expect(splash).toHaveLength(0)
        continue
      }
      // Two elements in the danger area (the vehicle beside and the team behind), never the one 3" off.
      expect(splash).toHaveLength(2)
      expect(splash.every((l) => !/s1-3/.test(l.text))).toBe(true)
      if (splash.some((l) => /caught in the salvo/.test(l.text))) caught = true
    }
    expect(caught).toBe(true)
  })
})

describe('the fire-effectiveness cap counts the whole platoon (p. 33)', () => {
  it('halves the elements in range and able to fire, not the shots named', () => {
    // Four rifle teams in range; a partial result caps draws at two even when one shot is named at a time.
    for (let seed = 1; seed < 60; seed++) {
      const setup = setupWith(
        [
          { id: 'n1', side: 'north', leadership: 3, infantry: [{ troops: 'line', team: 'rifle', at: { x: 10, y: 4 } }, { troops: 'line', team: 'rifle', at: { x: 11, y: 4 } }, { troops: 'line', team: 'rifle', at: { x: 12, y: 4 } }, { troops: 'line', team: 'rifle', at: { x: 13, y: 4 } }] },
          { id: 's1', side: 'south', infantry: [{ troops: 'militia', team: 'rifle', at: { x: 11, y: 8 } }] },
        ],
        { seed },
      )
      let state = battle(setup)
      state = play(state, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'fire', side: 'north', shots: [{ elementId: 'n1-t1', weapon: { kind: 'rifles' }, targetId: 's1-t1' }] })
      const eff = state.activation!.effectiveness!
      if (eff.result !== 'partial') continue
      expect(eff.cap).toBe(2)
      return
    }
    throw new Error('no partial result in 60 seeds')
  })
})

describe('loss of the command unit (p. 24)', () => {
  it('drops every unit a level when the command vehicle is destroyed', () => {
    let state = battle(openField())
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    // s1-1 leads the southern command unit; strike it down by hand and settle the attack's bookkeeping through a volley.
    let seen = false
    for (let seed = 1; seed < 80 && !seen; seed++) {
      const setup = openField()
      setup.seed = seed
      setup.sides[0]!.units[0]!.elements.forEach((e) => (e.vehicle!.fireControl = 'superior'))
      setup.sides[1]!.units[0]!.elements.forEach((e) => (e.vehicle!.armour = 0))
      let s = battle(setup)
      s = play(s, { kind: 'activate', side: 'north', unitId: 'n1' }, { kind: 'fire', side: 'north', shots: ['n1-1', 'n1-2', 'n1-3'].map((id) => ({ elementId: id, weapon: { kind: 'direct' as const, weaponId: 'hkp3' }, targetId: 's1-1' })) })
      if (s.elements['s1-1']!.destroyed) {
        seen = true
        expect(s.sides.south.commandLost).toBe(true)
        expect(s.log.some((l) => /command unit is lost/.test(l.text))).toBe(true)
        expect(s.units['s1']!.confidence).not.toBe('CO')
        // No new offensive for the rest of the turn: the other southern units may not close on the enemy.
        s = play(s, { kind: 'end-activation', side: 'north' }, { kind: 'activate', side: 'south', unitId: 's1' })
        const mover = ['s1-2', 's1-3'].find((id) => !s.elements[id]!.destroyed)!
        expect(refused(applyAction(s, { kind: 'move', side: 'south', elementId: mover, path: [{ x: s.elements[mover]!.position.x, y: 20 }] })).page).toBe('p. 24')
      }
    }
    expect(seen).toBe(true)
  })
})
