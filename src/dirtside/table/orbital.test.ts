/**
 * Fire from orbit on the table: Dirtside's call for fire and its arrival
 * (pp. 38–39), Ortillery's deviation (p. 40), and More Thrust's figures for
 * starships in low orbit (p. 17) — sheafs by class, bombardment monitors,
 * the orbit window and the NUKE marker.
 */

import { describe, expect, it } from 'vitest'
import { newStream } from '../dice'
import { newVehicleDesign } from '../design'
import type { VehicleDesign } from '../types'
import { applyAction, createGame, replay, strikesDue } from './game'
import { NUKE_EXCLUSION, STRIKE_RADIUS, caughtBy, falloutBreach, nextOverhead, overhead, rollDeviation } from './orbital'
import type { Action, ElementSetup, GameSetup, GameState, OrbitalShip, Point, Refusal, SideId, TerrainFeature, UnitSetup } from './types'

const tank = (patch: Partial<VehicleDesign> = {}): VehicleDesign => ({
  ...newVehicleDesign('tank'),
  name: 'Tank',
  fireControl: 'basic',
  weapons: [{ id: 'hkp3', type: 'hkp', class: 3, mount: 'turret', barrels: 1 }],
  ...patch,
})

type Team = {
  troops: 'militia' | 'line' | 'powered'
  team: 'rifle' | 'apsw' | 'observer'
  at: Point
  dugIn?: boolean
}
interface UnitSpec {
  id: string
  side: SideId
  leadership?: UnitSetup['leadership']
  vehicles?: { at: Point; dugIn?: boolean; design?: VehicleDesign }[]
  infantry?: Team[]
}

const cruiser: OrbitalShip = {
  id: 'ship-1',
  name: 'Minerva',
  sheafs: 2,
  ortillery: 0,
}
const escort: OrbitalShip = {
  id: 'ship-2',
  name: 'Kestrel',
  sheafs: 1,
  ortillery: 0,
}
const monitor: OrbitalShip = {
  id: 'ship-3',
  name: 'Hammer',
  sheafs: 1,
  ortillery: 2,
}

function setupWith(
  units: UnitSpec[],
  opts: {
    seed?: number
    ships?: OrbitalShip[]
    window?: number | null
    terrain?: TerrainFeature[]
    attacker?: SideId
  } = {},
): GameSetup {
  const bySide = (side: SideId): UnitSetup[] =>
    units
      .filter((u) => u.side === side)
      .map((u) => {
        const elements: ElementSetup[] = []
        u.vehicles?.forEach((v, i) =>
          elements.push({
            id: `${u.id}-${i + 1}`,
            name: `${u.id}-${i + 1}`,
            vehicle: structuredClone(v.design ?? tank()),
            position: v.at,
            facing: side === 'north' ? 180 : 0,
            leader: i === 0,
            dugIn: v.dugIn,
          }),
        )
        u.infantry?.forEach((t, i) =>
          elements.push({
            id: `${u.id}-t${i + 1}`,
            name: `${u.id}-t${i + 1}`,
            infantry: { troops: t.troops, team: t.team },
            position: t.at,
            leader: elements.length === 0,
            dugIn: t.dugIn,
          }),
        )
        return {
          id: u.id,
          name: u.id,
          quality: 'regular',
          leadership: u.leadership ?? 2,
          elements,
        }
      })
  const setup: GameSetup = {
    name: 'orbit test',
    seed: opts.seed ?? 1,
    battle: opts.attacker ? 'attack-defence' : 'encounter',
    table: {
      width: 48,
      depth: 36,
      terrain: opts.terrain ?? [],
      objectives: [],
    },
    sides: [
      { id: 'north', name: 'North', units: bySide('north') },
      { id: 'south', name: 'South', units: bySide('south') },
    ],
    turnLimit: null,
  }
  if (opts.attacker) setup.attacker = opts.attacker
  if (opts.ships !== undefined || opts.window !== undefined) {
    const support: NonNullable<GameSetup['orbital']>[number] = {
      side: 'north',
      ships: opts.ships ?? [cruiser],
    }
    if (opts.window !== null) support.window = opts.window ?? 1
    setup.orbital = [support]
  }
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
  let state = play(createGame(setup), { kind: 'ready', side: 'north' }, { kind: 'ready', side: 'south' })
  if (state.phase === 'turn-start') state = must(applyAction(state, { kind: 'choose-first', side: state.chooser!, first }))
  return state
}

/** North's command tank and an observer team, south's rifle platoon in the open 16" off. */
const field = (given: Parameters<typeof setupWith>[1] = {}) => {
  const opts = { ships: [cruiser], ...given }
  return setupWith(
    [
      {
        id: 'n1',
        side: 'north',
        vehicles: [{ at: { x: 20, y: 4 } }, { at: { x: 22, y: 4 } }],
      },
      {
        id: 'n2',
        side: 'north',
        infantry: [
          { troops: 'line', team: 'observer', at: { x: 30, y: 4 } },
          { troops: 'line', team: 'rifle', at: { x: 31, y: 4 } },
        ],
      },
      {
        id: 's1',
        side: 'south',
        infantry: [
          { troops: 'line', team: 'rifle', at: { x: 20, y: 20 } },
          { troops: 'line', team: 'rifle', at: { x: 21, y: 20 } },
          { troops: 'line', team: 'rifle', at: { x: 22, y: 20 } },
        ],
      },
      { id: 's2', side: 'south', vehicles: [{ at: { x: 40, y: 30 } }] },
    ],
    opts,
  )
}

const call = (elementId: string, aim: Point, shipId = cruiser.id, attack: 'sheaf' | 'pbm' = 'sheaf'): Action => ({
  kind: 'call-orbital',
  side: 'north',
  elementId,
  shipId,
  attack,
  aim,
})

/** The first seed on which `n1`'s leader gets an answer at leadership 2 (D8, 6+). */
function answeredSeed(
  make: (seed: number) => GameSetup,
  unit = 'n1',
  elementId = 'n1-1',
  aim: Point = { x: 21, y: 20 },
  shipId = cruiser.id,
  attack: 'sheaf' | 'pbm' = 'sheaf',
): { seed: number; state: GameState } {
  for (let seed = 1; seed < 400; seed++) {
    const state = play(battle(make(seed)), { kind: 'activate', side: 'north', unitId: unit }, call(elementId, aim, shipId, attack))
    if (state.orbit!.strikes.length > 0) return { seed, state }
  }
  throw new Error('no seed answered')
}

describe('the orbit window (More Thrust p. 17)', () => {
  it('rolls a D6 as the game opens for the first turn overhead, then every sixth turn', () => {
    const rolled = new Set<number>()
    for (let seed = 1; seed <= 60; seed++) {
      const state = createGame(field({ seed, window: null }))
      const first = state.orbit!.windows.north!
      expect(first).toBeGreaterThanOrEqual(1)
      expect(first).toBeLessThanOrEqual(6)
      rolled.add(first)
      expect(state.log.some((l) => l.text.includes(`the D6 rolls ${first}`) && l.page === 'More Thrust p. 17')).toBe(true)
    }
    expect(rolled.size).toBe(6)
    const state = createGame(field({ window: 3 }))
    expect([1, 2, 3, 4, 8, 9, 10, 15].map((t) => overhead(state, 'north', t))).toEqual([false, false, true, false, false, true, false, true])
    expect(overhead(state, 'south', 3)).toBe(false)
    expect(nextOverhead(state, 'north', 4)).toBe(9)
  })

  it('leaves a battle without ships in orbit exactly as it was', () => {
    const plain = createGame(field({ ships: [] }))
    expect(plain.orbit).toBeNull()
    expect(plain.rng).toEqual(newStream(1))
  })

  it('refuses a call on a turn the ships are not overhead', () => {
    const state = play(battle(field({ window: 2 })), {
      kind: 'activate',
      side: 'north',
      unitId: 'n1',
    })
    const r = refused(applyAction(state, call('n1-1', { x: 21, y: 20 })))
    expect(r.page).toBe('More Thrust p. 17')
    expect(r.reason).toContain('turn 2')
  })
})

describe('calling for fire (p. 38)', () => {
  it('lets a unit commander or an observer call, and nobody else', () => {
    const state = play(battle(field()), {
      kind: 'activate',
      side: 'north',
      unitId: 'n1',
    })
    expect(refused(applyAction(state, call('n1-2', { x: 21, y: 20 }))).page).toBe('p. 38')
    expect(refused(applyAction(state, call('s1-t1', { x: 21, y: 20 }))).page).toBe('p. 18')
    const leader = must(applyAction(state, call('n1-1', { x: 21, y: 20 })))
    expect(leader.log.at(-1)!.text).toMatch(/D8 \(leadership 2\) rolls \d/)
    const observer = play(battle(field()), { kind: 'activate', side: 'north', unitId: 'n2' }, call('n2-t1', { x: 21, y: 20 }))
    expect(observer.log.at(-1)!.text).toMatch(/D12 \(the observer\) rolls \d/)
  })

  it('needs sight of the aim point, a point on the table, and the element’s combat action', () => {
    const wood: TerrainFeature = {
      id: 'w',
      terrain: 'dense-woods',
      shape: { kind: 'rect', x: 10, y: 10, width: 28, height: 4 },
    }
    const state = play(battle(field({ terrain: [wood] })), {
      kind: 'activate',
      side: 'north',
      unitId: 'n1',
    })
    expect(refused(applyAction(state, call('n1-1', { x: 21, y: 20 }))).reason).toContain('cannot see')
    expect(refused(applyAction(state, call('n1-1', { x: 60, y: 20 }))).page).toBe('p. 38')
    const once = must(applyAction(state, call('n1-1', { x: 21, y: 6 })))
    expect(refused(applyAction(once, call('n1-1', { x: 21, y: 6 }))).page).toBe('p. 18')
  })

  it('spends nothing when the call goes unanswered, and one attack when answered', () => {
    let failed: GameState | null = null
    for (let seed = 1; seed < 100 && !failed; seed++) {
      const state = play(battle(field({ seed })), { kind: 'activate', side: 'north', unitId: 'n1' }, call('n1-1', { x: 21, y: 20 }))
      if (state.orbit!.strikes.length === 0) failed = state
    }
    expect(failed!.log.at(-1)!.text).toContain('no answer')
    expect(failed!.orbit!.spent[cruiser.id]).toBeUndefined()
    expect(failed!.activation!.elements['n1-1']!.fired).toBe(true)
    const { state } = answeredSeed((seed) => field({ seed }))
    expect(state.orbit!.spent[cruiser.id]).toEqual({ sheafs: 1, ortillery: 0 })
    expect(state.orbit!.strikes[0]).toMatchObject({
      side: 'north',
      shipId: cruiser.id,
      attack: 'sheaf',
      aim: { x: 21, y: 20 },
      opponentActed: false,
    })
  })

  it('gives an escort one sheaf a turn and a cruiser two; ortillery only to a monitor', () => {
    const { state } = answeredSeed((seed) => field({ seed, ships: [escort] }), 'n1', 'n1-1', { x: 21, y: 20 }, escort.id)
    const again = play(
      state,
      { kind: 'end-activation', side: 'north' },
      { kind: 'activate', side: 'south', unitId: 's2' },
      { kind: 'end-activation', side: 'south' },
      { kind: 'orbital-strike', side: 'north' },
      { kind: 'activate', side: 'south', unitId: 's1' },
      { kind: 'end-activation', side: 'south' },
    )
    const r = refused(applyAction(play(again, { kind: 'activate', side: 'north', unitId: 'n2' }), call('n2-t1', { x: 30, y: 20 }, escort.id)))
    expect(r.reason).toContain('fired its sheafs')
    const state2 = play(battle(field({ ships: [cruiser] })), {
      kind: 'activate',
      side: 'north',
      unitId: 'n1',
    })
    expect(refused(applyAction(state2, call('n1-1', { x: 21, y: 20 }, cruiser.id, 'pbm'))).reason).toContain('no ortillery')
  })
})

describe('the fire arriving (pp. 39–40)', () => {
  it('arrives after the opponent’s next activation, as the caller’s turn, and must be brought down first', () => {
    const { state } = answeredSeed((seed) => field({ seed }))
    let s = play(state, { kind: 'end-activation', side: 'north' })
    expect(s.toAct).toBe('south')
    expect(strikesDue(s, 'north')).toHaveLength(0)
    s = play(s, { kind: 'activate', side: 'south', unitId: 's2' }, { kind: 'end-activation', side: 'south' })
    expect(s.toAct).toBe('north')
    expect(strikesDue(s, 'north')).toHaveLength(1)
    expect(refused(applyAction(s, { kind: 'activate', side: 'north', unitId: 'n2' })).page).toBe('p. 39')
    expect(refused(applyAction(s, { kind: 'done', side: 'north' })).page).toBe('p. 39')
    expect(refused(applyAction(s, { kind: 'rally', side: 'north', unitId: 'n2' })).page).toBe('p. 39')
    const after = play(s, { kind: 'orbital-strike', side: 'north' })
    expect(after.orbit!.strikes).toHaveLength(0)
    expect(after.orbit!.nukes).toHaveLength(1)
    expect(after.toAct).toBe('south')
    expect(after.log.some((l) => l.page === 'p. 40' && l.text.includes('arrives'))).toBe(true)
    expect(after.log.some((l) => l.text.includes('NUKE marker'))).toBe(true)
  })

  it('is due at once when the opponent has nothing left to activate this turn', () => {
    const make = (seed: number) =>
      setupWith(
        [
          { id: 'n1', side: 'north', vehicles: [{ at: { x: 20, y: 4 } }] },
          { id: 'n2', side: 'north', vehicles: [{ at: { x: 30, y: 4 } }] },
          {
            id: 's1',
            side: 'south',
            infantry: [{ troops: 'line', team: 'rifle', at: { x: 20, y: 20 } }],
          },
        ],
        { seed, ships: [cruiser] },
      )
    for (let seed = 1; seed < 200; seed++) {
      let s = battle(make(seed), 'south')
      s = play(s, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' }, { kind: 'activate', side: 'north', unitId: 'n1' }, call('n1-1', { x: 20, y: 20 }))
      if (s.orbit!.strikes.length === 0) continue
      s = play(s, { kind: 'end-activation', side: 'north' })
      // South is spent: the fire is due and north must bring it down before n2 moves.
      expect(s.toAct).toBe('north')
      expect(strikesDue(s, 'north')).toHaveLength(1)
      s = play(s, { kind: 'orbital-strike', side: 'north' })
      expect(s.orbit!.strikes).toHaveLength(0)
      return
    }
    throw new Error('no seed answered')
  })

  it('draws three chits a sheaf for every element in the zone, HEF on infantry and MAK on vehicles', () => {
    const { state } = answeredSeed((seed) => field({ seed }))
    const s = play(
      state,
      { kind: 'end-activation', side: 'north' },
      { kind: 'activate', side: 'south', unitId: 's2' },
      { kind: 'end-activation', side: 'south' },
      { kind: 'orbital-strike', side: 'north' },
    )
    const impact = s.orbit!.nukes[0]!
    const caught = Object.values(state.elements).filter((e) => Math.hypot(e.position.x - impact.x, e.position.y - impact.y) <= STRIKE_RADIUS.sheaf + 1e-9)
    const drawn = s.log.filter((l) => l.page === 'p. 39' && /\((HEF|MAK)/.test(l.text))
    expect(drawn).toHaveLength(caught.length)
    for (const line of drawn) expect(line.text).toContain('(HEF)')
  })

  it('leaves dug-in vehicles untouched by MAK and reads dug-in infantry on red only', () => {
    const make = (seed: number) =>
      setupWith(
        [
          { id: 'n1', side: 'north', vehicles: [{ at: { x: 20, y: 4 } }] },
          {
            id: 's1',
            side: 'south',
            vehicles: [{ at: { x: 20, y: 20 }, dugIn: true }],
          },
          {
            id: 's2',
            side: 'south',
            infantry: [
              {
                troops: 'line',
                team: 'rifle',
                at: { x: 21, y: 20 },
                dugIn: true,
              },
            ],
          },
        ],
        { seed, ships: [monitor], attacker: 'north' },
      )
    for (let seed = 1; seed < 300; seed++) {
      let s = battle(make(seed))
      if (s.toAct !== 'north') continue
      s = play(s, { kind: 'activate', side: 'north', unitId: 'n1' }, call('n1-1', { x: 20.5, y: 20 }, monitor.id, 'pbm'))
      if (s.orbit!.strikes.length === 0) continue
      s = play(s, { kind: 'end-activation', side: 'north' }, { kind: 'activate', side: 'south', unitId: 's2' }, { kind: 'end-activation', side: 'south' }, { kind: 'orbital-strike', side: 'north' })
      const impact = s.orbit!.nukes[0]!
      if (Math.hypot(impact.x - 20.5, impact.y - 20) > 3) continue
      expect(s.log.some((l) => l.text.includes('s1-1 is dug in: MAK is ineffective') && l.page === 'p. 29')).toBe(true)
      expect(s.elements['s1-1']!.damaged || s.elements['s1-1']!.destroyed).toBe(false)
      // Vehicles take an under-fire marker only when hurt (p. 24).
      expect(s.units['s1']!.underFire).toBe(false)
      return
    }
    throw new Error('no seed landed close')
  })

  it('makes bombarded infantry test confidence at +0 even without a casualty (p. 23)', () => {
    let seen = false
    for (let seed = 1; seed < 200 && !seen; seed++) {
      const got = (() => {
        try {
          return answeredSeed((s) => field({ seed: s + seed * 1000 })).state
        } catch {
          return null
        }
      })()
      if (!got) continue
      const s = play(
        got,
        { kind: 'end-activation', side: 'north' },
        { kind: 'activate', side: 'south', unitId: 's2' },
        { kind: 'end-activation', side: 'south' },
        { kind: 'orbital-strike', side: 'north' },
      )
      const tested = s.log.find((l) => l.text.startsWith('s1 tests confidence'))
      const lost = ['s1-t1', 's1-t2', 's1-t3'].some((id) => s.elements[id]!.destroyed)
      if (tested && !lost) {
        expect(tested.text).toContain('at +0')
        expect(s.units['s1']!.underFire).toBe(true)
        seen = true
      }
    }
    expect(seen).toBe(true)
  })
})

describe('deviation (p. 40)', () => {
  it('moves the marker the D8’s excess over the D6 towards the clock face, twelve up the table', () => {
    let deviated = 0
    for (let seed = 1; seed <= 300; seed++) {
      const d = rollDeviation({ x: 24, y: 18 }, newStream(seed))
      const moved = Math.hypot(d.impact.x - 24, d.impact.y - 18)
      expect(d.inches).toBe(d.d8 > d.d6 ? d.d8 - d.d6 : 0)
      expect(moved).toBeCloseTo(d.inches, 9)
      if (d.inches === 0) continue
      deviated += 1
      const angle = ((Math.atan2(d.impact.x - 24, -(d.impact.y - 18)) * 180) / Math.PI + 360) % 360
      expect(angle).toBeCloseTo((d.clock * 30) % 360, 6)
    }
    // The D8 beats the D6 in 23 of 48 pairs.
    expect(deviated / 300).toBeGreaterThan(0.35)
    expect(deviated / 300).toBeLessThan(0.62)
  })
})

describe('the beaten zone and the crater (More Thrust p. 17)', () => {
  it('catches elements within 2" of a sheaf and within 4" of ortillery', () => {
    const state = createGame(field({ ships: [monitor] }))
    const impact = { x: 21, y: 23 }
    const ids = (attack: 'sheaf' | 'pbm') =>
      caughtBy(state, impact, attack)
        .map((e) => e.id)
        .sort()
    expect(ids('sheaf')).toEqual([])
    expect(ids('pbm')).toEqual(['s1-t1', 's1-t2', 's1-t3'])
  })

  it('keeps unprotected troops 2" from ground zero; powered troops and armour may go in', () => {
    const state = createGame(
      setupWith([
        {
          id: 'n1',
          side: 'north',
          infantry: [
            { troops: 'line', team: 'rifle', at: { x: 10, y: 10 } },
            { troops: 'powered', team: 'rifle', at: { x: 11, y: 10 } },
          ],
        },
        { id: 's1', side: 'south', vehicles: [{ at: { x: 30, y: 30 } }] },
      ]),
    )
    const nuke = { x: 10, y: 14 }
    const line = state.elements['n1-t1']!
    const powered = state.elements['n1-t2']!
    expect(falloutBreach(line, [{ x: 10, y: 13 }], [nuke])).toEqual(nuke)
    expect(falloutBreach(line, [{ x: 10, y: 18 }], [nuke])).toEqual(nuke)
    expect(falloutBreach(line, [{ x: 14, y: 10 }], [nuke])).toBeNull()
    expect(falloutBreach(powered, [{ x: 11, y: 14 }], [nuke])).toBeNull()
    const inside = { ...line, position: { x: 10, y: 13 } }
    expect(falloutBreach(inside, [{ x: 10, y: 11 }], [nuke])).toBeNull()
    expect(falloutBreach(inside, [{ x: 10, y: 13.5 }], [nuke])).toEqual(nuke)
    expect(NUKE_EXCLUSION).toBe(2)
  })

  it('refuses the move on the table, with the page', () => {
    const state = play(battle(field()), { kind: 'activate', side: 'north', unitId: 'n2' })
    const hot = structuredClone(state)
    hot.orbit!.nukes = [{ x: 31, y: 7.5 }]
    const r = refused(applyAction(hot, { kind: 'move', side: 'north', elementId: 'n2-t2', path: [{ x: 31, y: 6 }] }))
    expect(r.page).toBe('More Thrust p. 17')
    expect(r.reason).toContain('2"')
    must(applyAction(hot, { kind: 'move', side: 'north', elementId: 'n2-t2', path: [{ x: 33, y: 4 }] }))
  })

  it('replays a battle with orbital fire exactly', () => {
    const { seed, state } = answeredSeed((s) => field({ seed: s }))
    const s = play(
      state,
      { kind: 'end-activation', side: 'north' },
      { kind: 'activate', side: 'south', unitId: 's2' },
      { kind: 'end-activation', side: 'south' },
      { kind: 'orbital-strike', side: 'north' },
    )
    const again = replay(field({ seed }), s.journal)
    expect(again.elements).toEqual(s.elements)
    expect(again.orbit).toEqual(s.orbit)
    expect(again.rng).toEqual(s.rng)
  })
})
