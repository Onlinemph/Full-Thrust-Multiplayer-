/**
 * The battle, against the printed rules: deployment and the turn (pp.
 * 14–15), the twelve actions (pp. 16–18), suppression (p. 18), confidence
 * and reaction (pp. 19–21), fire (pp. 33–37), close assault (pp. 41–43),
 * objectives and the end of the battle.
 */

import { describe, expect, it } from 'vitest'
import { newStream, rollDie, type DieType } from '../dice'
import {
  actionsLeft,
  allowedActions,
  applyAction,
  assaultMoves,
  canPass,
  createGame,
  liveUnits,
  objectiveValues,
  planFire,
  planMove,
  replay,
  threatNow,
  unactivatedUnits,
} from './game'
import type {
  Action,
  ArmourKind,
  CommandLevel,
  Confidence,
  FireWith,
  GameSetup,
  GameState,
  Leadership,
  MobilityKind,
  Motivation,
  Point,
  Quality,
  Refusal,
  SideId,
  SmallArmKind,
  SupportWeaponKind,
  TerrainFeature,
  UnitSetup,
} from '../types'

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

interface FigureSpec {
  id: string
  at: Point
  smallArm?: SmallArmKind
  supportWeapon?: SupportWeaponKind
  armour?: ArmourKind
  role?: 'trooper' | 'medic' | 'observer' | 'comms' | 'sniper'
  leader?: boolean
}

interface UnitSpec {
  id: string
  side: SideId
  name?: string
  quality?: Quality
  leadership?: Leadership
  confidence?: Confidence
  motivation?: Motivation
  armour?: ArmourKind
  mobility?: MobilityKind
  commandLevel?: CommandLevel
  commanderId?: string
  figures: FigureSpec[]
}

function setupWith(
  units: UnitSpec[],
  opts: { width?: number; depth?: number; seed?: number; turnLimit?: number | null; objectives?: GameSetup['table']['objectives']; terrain?: GameSetup['table']['terrain'] } = {},
): GameSetup {
  const bySide = (side: SideId): UnitSetup[] =>
    units
      .filter((u) => u.side === side)
      .map((u) => ({
        id: u.id,
        name: u.name ?? u.id,
        quality: u.quality ?? 'regular',
        leadership: u.leadership ?? 2,
        confidence: u.confidence,
        motivation: u.motivation,
        armour: u.armour ?? 'partial-light',
        mobility: u.mobility ?? 'foot',
        commandLevel: u.commandLevel ?? 'squad',
        commanderId: u.commanderId,
        figures: u.figures.map((f) => ({
          id: f.id,
          smallArm: f.smallArm ?? 'advanced-rifle',
          supportWeapon: f.supportWeapon,
          armour: f.armour,
          role: f.role,
          leader: f.leader,
          position: f.at,
        })),
      }))
  return {
    name: 'test',
    seed: opts.seed ?? 1,
    battle: 'encounter',
    table: { width: opts.width ?? 48, depth: opts.depth ?? 36, terrain: opts.terrain ?? [], objectives: opts.objectives ?? [] },
    sides: [
      { id: 'north', name: 'North', motivation: 'medium', units: bySide('north') },
      { id: 'south', name: 'South', motivation: 'medium', units: bySide('south') },
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

/** Both sides ready, `first` chosen to activate first (whether or not it was the chooser). */
function battle(setup: GameSetup, first: SideId = 'north'): GameState {
  let state = play(createGame(setup), { kind: 'ready', side: 'north' }, { kind: 'ready', side: 'south' })
  if (state.phase === 'turn-start') state = must(applyAction(state, { kind: 'choose-first', side: state.chooser!, first }))
  return state
}

const lastLog = (state: GameState, n = 1) =>
  state.log
    .slice(-n)
    .map((l) => l.text)
    .join(' | ')

/** Brute-forces a `GameSetup.seed` whose battle stream's very first die roll of `die` is `want` — the same technique `checks.test.ts` uses, one level up. */
function seedForFirstRoll(die: DieType, want: number, from = 1): number {
  for (let seed = from; seed < 200_000; seed++) if (rollDie(die, newStream(seed)) === want) return seed
  throw new Error(`no seed rolls ${want} on a D${die}`)
}

/** Brute-forces a `GameSetup.seed` for which building the battle and playing `actions` leads to a state `accept`s. */
function seedWhere(build: (seed: number) => GameSetup, actions: (state: GameState) => Action[], accept: (state: GameState) => boolean, tries = 4000): { seed: number; state: GameState } {
  for (let seed = 1; seed <= tries; seed++) {
    const setup = build(seed)
    let state = battle(setup)
    let ok = true
    for (const a of actions(state)) {
      const next = applyAction(state, a)
      if ('ok' in next) {
        ok = false
        break
      }
      state = next
    }
    if (ok && accept(state)) return { seed, state }
  }
  throw new Error('no seed satisfies the predicate')
}

// ---------------------------------------------------------------------------
// Deployment (pp. 14)
// ---------------------------------------------------------------------------

describe('deployment (p. 14)', () => {
  it('places figures where the setup put them, and lets deploy reposition within the zone only', () => {
    const setup = setupWith([
      { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 5, y: 3 }, leader: true }] },
      { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 5, y: 33 }, leader: true }] },
    ])
    const state = createGame(setup)
    expect(state.figures['n1-f1']!.position).toEqual({ x: 5, y: 3 })
    expect(refused(applyAction(state, { kind: 'deploy', side: 'north', figureId: 'n1-f1', position: { x: 5, y: 12 } })).page).toBe('p. 14')
    const moved = must(applyAction(state, { kind: 'deploy', side: 'north', figureId: 'n1-f1', position: { x: 8, y: 1 } }))
    expect(moved.figures['n1-f1']!.position).toEqual({ x: 8, y: 1 })
    expect(refused(applyAction(moved, { kind: 'deploy', side: 'south', figureId: 'n1-f1', position: { x: 8, y: 1 } })).page).toBe('p. 14')
  })

  it('starts turn 1 once both sides ready, the side with fewer units choosing first (p. 15)', () => {
    const setup = setupWith([
      { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 5, y: 3 }, leader: true }] },
      { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 5, y: 33 }, leader: true }] },
      { id: 's2', side: 'south', figures: [{ id: 's2-f1', at: { x: 10, y: 33 }, leader: true }] },
    ])
    const state = play(createGame(setup), { kind: 'ready', side: 'north' }, { kind: 'ready', side: 'south' })
    expect(state.turn).toBe(1)
    expect(state.phase).toBe('turn-start')
    expect(state.chooser).toBe('north')
    expect(refused(applyAction(state, { kind: 'choose-first', side: 'south', first: 'south' })).page).toBe('p. 15')
    const on = must(applyAction(state, { kind: 'choose-first', side: 'north', first: 'south' }))
    expect(on.phase).toBe('activation')
    expect(on.toAct).toBe('south')
  })
})

// ---------------------------------------------------------------------------
// The turn (p. 15)
// ---------------------------------------------------------------------------

describe('the turn (p. 15)', () => {
  const twoEach = () =>
    setupWith([
      { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 5, y: 3 }, leader: true }] },
      { id: 'n2', side: 'north', figures: [{ id: 'n2-f1', at: { x: 10, y: 3 }, leader: true }] },
      { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 5, y: 33 }, leader: true }] },
      { id: 's2', side: 'south', figures: [{ id: 's2-f1', at: { x: 10, y: 33 }, leader: true }] },
    ])

  it('alternates activations and ends the turn once both sides are spent', () => {
    let state = battle(twoEach(), 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    state = must(applyAction(state, { kind: 'end-activation', side: 'north' }))
    expect(state.toAct).toBe('south')
    state = must(applyAction(state, { kind: 'activate', side: 'south', unitId: 's1' }))
    state = must(applyAction(state, { kind: 'end-activation', side: 'south' }))
    expect(state.toAct).toBe('north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n2' }))
    state = must(applyAction(state, { kind: 'end-activation', side: 'north' }))
    state = must(applyAction(state, { kind: 'activate', side: 'south', unitId: 's2' }))
    state = must(applyAction(state, { kind: 'end-activation', side: 'south' }))
    expect(state.turn).toBe(2)
    expect(unactivatedUnits(state, 'north').length).toBe(2)
  })

  it('lets only the side with fewer unactivated units pass, and the other then owes two in a row', () => {
    // North has one unit, South two: North always has fewer, and may pass its very first turn.
    const setup = setupWith([
      { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 5, y: 3 }, leader: true }] },
      { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 5, y: 33 }, leader: true }] },
      { id: 's2', side: 'south', figures: [{ id: 's2-f1', at: { x: 10, y: 33 }, leader: true }] },
    ])
    let state = battle(setup, 'north')
    expect(canPass(state, 'north')).toBe(true)
    expect(canPass(state, 'south')).toBe(false)
    state = must(applyAction(state, { kind: 'pass', side: 'north' }))
    expect(state.owed).toBe(2)
    expect(state.toAct).toBe('south')
    state = must(applyAction(state, { kind: 'activate', side: 'south', unitId: 's1' }))
    state = must(applyAction(state, { kind: 'end-activation', side: 'south' }))
    expect(state.toAct).toBe('south')
    state = must(applyAction(state, { kind: 'activate', side: 'south', unitId: 's2' }))
    state = must(applyAction(state, { kind: 'end-activation', side: 'south' }))
    expect(state.toAct).toBe('north')
  })

  it('a side may declare itself done, leaving units unactivated', () => {
    let state = battle(twoEach(), 'north')
    state = must(applyAction(state, { kind: 'done', side: 'north' }))
    expect(state.toAct).toBe('south')
    expect(unactivatedUnits(state, 'north').length).toBe(2)
  })

  it('done lasts only the turn: the next turn the side activates again', () => {
    let state = battle(twoEach(), 'north')
    state = play(state, { kind: 'done', side: 'north' }, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' }, { kind: 'activate', side: 'south', unitId: 's2' }, { kind: 'end-activation', side: 'south' })
    expect(state.turn).toBe(2)
    expect(state.sides.north.done).toBe(false)
    state = must(applyAction(state, { kind: 'choose-first', side: state.chooser!, first: 'south' }))
    state = play(state, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' })
    expect(state.toAct).toBe('north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(state.activation?.unitId).toBe('n1')
  })

  it('the turn end phase clears activation markers and per-turn weapon/transfer tallies', () => {
    let state = battle(twoEach(), 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    state.units['n1']!.firedThisTurn.push('small-arms')
    state.units['n1']!.transfersThisTurn = 1
    state = must(applyAction(state, { kind: 'end-activation', side: 'north' }))
    state = play(state, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' }, { kind: 'activate', side: 'north', unitId: 'n2' }, { kind: 'end-activation', side: 'north' }, { kind: 'activate', side: 'south', unitId: 's2' }, { kind: 'end-activation', side: 'south' })
    expect(state.turn).toBe(2)
    expect(state.units['n1']!.activated).toBe(false)
    expect(state.units['n1']!.firedThisTurn).toEqual([])
    expect(state.units['n1']!.transfersThisTurn).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Move (Chapter 9, pp. 22–24)
// ---------------------------------------------------------------------------

describe('move (pp. 22–24)', () => {
  const oneEachFarApart = (mobility: MobilityKind = 'foot') =>
    setupWith(
      [
        { id: 'n1', side: 'north', mobility, figures: [{ id: 'n1-f1', at: { x: 5, y: 3 }, leader: true }] },
        { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 5, y: 33 }, leader: true }] },
        { id: 's2', side: 'south', figures: [{ id: 's2-f1', at: { x: 10, y: 33 }, leader: true }] },
      ],
      { seed: 1 },
    )

  it('a normal move covers the path when within the base allowance, and stops short beyond it', () => {
    let state = battle(oneEachFarApart(), 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const within = must(applyAction(state, { kind: 'move', side: 'north', mode: 'normal', moves: [{ figureId: 'n1-f1', path: [{ x: 9, y: 3 }] }] }))
    expect(within.figures['n1-f1']!.position).toEqual({ x: 9, y: 3 })

    let far = battle(oneEachFarApart(), 'north')
    far = must(applyAction(far, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const beyond = must(applyAction(far, { kind: 'move', side: 'north', mode: 'normal', moves: [{ figureId: 'n1-f1', path: [{ x: 20, y: 3 }] }] }))
    expect(beyond.figures['n1-f1']!.position.x).toBeCloseTo(11, 5) // base mobility 6" from x=5
  })

  it('refuses a move by a figure not in the activated unit, and one that leaves the table', () => {
    let state = battle(oneEachFarApart(), 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'move', side: 'north', mode: 'normal', moves: [{ figureId: 's1-f1', path: [{ x: 6, y: 3 }] }] })).page).toBe('p. 22')
    expect(refused(applyAction(state, { kind: 'move', side: 'north', mode: 'normal', moves: [{ figureId: 'n1-f1', path: [{ x: -5, y: 3 }] }] })).page).toBe('p. 14')
  })

  it("combat movement rolls the mobility die, doubles it, and stops at the declared destination once it's reached (p. 22)", () => {
    // foot mobility (baseInches 6) rolls a D6; a roll of 6 -> 12" covers a 9"-away destination and stops there.
    const seed = seedForFirstRoll(6, 6)
    const setup = { ...oneEachFarApart(), seed }
    let state = battle(setup, 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const moved = must(applyAction(state, { kind: 'move', side: 'north', mode: 'combat', moves: [{ figureId: 'n1-f1', path: [{ x: 14, y: 3 }] }] }))
    expect(moved.figures['n1-f1']!.position).toEqual({ x: 14, y: 3 })
    expect(lastLog(moved)).toMatch(/D6 rolls 6/)
  })

  it('travel mode sets the unit travel-formed, restricting it to move or reorganise only (p. 24)', () => {
    let state = battle(oneEachFarApart(), 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    state = must(applyAction(state, { kind: 'move', side: 'north', mode: 'travel', moves: [{ figureId: 'n1-f1', path: [{ x: 6, y: 3 }] }] }))
    expect(state.units['n1']!.travelling).toBe(true)
    state = must(applyAction(state, { kind: 'end-activation', side: 'north' }))
    state = play(state, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'end-activation', side: 'south' }, { kind: 'activate', side: 'south', unitId: 's2' }, { kind: 'end-activation', side: 'south' })
    expect(state.phase).toBe('turn-start')
    state = must(applyAction(state, { kind: 'choose-first', side: state.chooser!, first: 'north' }))
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } })).page).toBe('p. 24')
    const reorganised = must(applyAction(state, { kind: 'reorganise', side: 'north' }))
    expect(reorganised.units['n1']!.travelling).toBe(false)
  })

  it('planMove and moveAllowance report normal movement without rolling', () => {
    const setup = oneEachFarApart()
    const state = createGame(setup)
    const allowance = planMove(state, 'n1-f1', [{ x: 20, y: 3 }], 'normal')
    expect(allowance.allowance.inches).toBe(6)
    expect(allowance.reaches).toBe(false)
    const close = planMove(state, 'n1-f1', [{ x: 9, y: 3 }], 'normal')
    expect(close.reaches).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Fire (Chapter 14, pp. 33–37)
// ---------------------------------------------------------------------------

describe('fire (pp. 33–37)', () => {
  const facingOff = (gap = 10) =>
    setupWith([
      {
        id: 'n1',
        side: 'north',
        figures: [
          { id: 'n1-f1', at: { x: 10, y: 10 }, leader: true },
          { id: 'n1-f2', at: { x: 11, y: 10 }, supportWeapon: 'saw' },
          { id: 'n1-f3', at: { x: 12, y: 10 } },
        ],
      },
      {
        id: 's1',
        side: 'south',
        figures: [
          { id: 's1-f1', at: { x: 10, y: 10 + gap }, leader: true },
          { id: 's1-f2', at: { x: 11, y: 10 + gap } },
        ],
      },
    ])

  it('resolves squad small arms against a dispersed target and marks the weapon fired this turn', () => {
    let state = battle(facingOff(6), 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const fired = must(applyAction(state, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } }))
    expect(fired.units['n1']!.firedThisTurn).toContain('small-arms')
    expect(refused(applyAction(fired, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } })).page).toBe('p. 33')
  })

  it('a support weapon fires alone and locks itself, not the small arms', () => {
    let state = battle(facingOff(6), 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const fired = must(applyAction(state, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'support', figureId: 'n1-f2' } }))
    expect(fired.units['n1']!.firedThisTurn).toEqual(['n1-f2'])
    expect(refused(applyAction(fired, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'support', figureId: 'n1-f2' } })).page).toBe('p. 33')
    const alsoSmallArms = must(applyAction(fired, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } }))
    expect(alsoSmallArms.units['n1']!.firedThisTurn).toEqual(['n1-f2', 'small-arms'])
  })

  it('automatically ineffective past D12, with no dice drawn from the stream, at a very long range (p. 35)', () => {
    let state = battle(facingOff(200), 'north')
    const before = state.rng.cursor
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const fired = must(applyAction(state, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } }))
    expect(lastLog(fired)).toMatch(/automatically ineffective/)
    expect(fired.rng.cursor).toBe(before)
  })

  it('needs a line of sight: a blocking wood refuses the shot', () => {
    const blocked = facingOff(20)
    blocked.table.terrain.push({ id: 't1', terrain: 'dense-woods', shape: { kind: 'rect', x: 5, y: 15, width: 15, height: 4 } } as GameSetup['table']['terrain'][number])
    let state = battle(blocked, 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } })).page).toBe('p. 11')
  })

  it('a routed unit will not fire, and a broken one only on an enemy that has fired on it recently (p. 21)', () => {
    // A spare, confident north unit keeps the side from being instantly beaten by n1's own bad confidence,
    // so the fire refusal itself is what's under test.
    const withSpare = () => {
      const setup = facingOff(6)
      setup.sides[0].units.push({ id: 'n2', name: 'n2', quality: 'regular', leadership: 2, armour: 'partial-light', mobility: 'foot', commandLevel: 'squad', figures: [{ id: 'n2-f1', smallArm: 'advanced-rifle', leader: true, position: { x: 30, y: 10 } }] })
      setup.sides[1].units.push({ id: 's2', name: 's2', quality: 'regular', leadership: 2, armour: 'partial-light', mobility: 'foot', commandLevel: 'squad', figures: [{ id: 's2-f1', smallArm: 'advanced-rifle', leader: true, position: { x: 30, y: 16 } }] })
      return setup
    }
    let state = battle(withSpare(), 'north')
    state.units['n1']!.confidence = 'RO'
    // Activating a routed unit is itself still legal (it must attempt to withdraw); only firing is barred.
    let ok = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(ok, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } })).page).toBe('p. 21')

    // Broken and never fired on at all: fire is refused on every enemy, s1 included.
    let brState = battle(withSpare(), 'north')
    brState.units['n1']!.confidence = 'BR'
    let br = must(applyAction(brState, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(br, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } })).page).toBe('p. 21')
    expect(allowedActions(br)['fire'].ok).toBe(false)

    // Fired on by s1 (this turn): it may fire back on s1, but not on s2, who never fired on it (p. 21) —
    // a per-target rule, not a once-ever unlock.
    br.units['n1']!.firedOnBy['s1'] = br.turn
    expect(allowedActions(br)['fire'].ok).toBe(true) // some enemy is a legal target, advisory-wise
    expect('ok' in applyAction(br, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } })).toBe(false)
    expect(refused(applyAction(br, { kind: 'fire', side: 'north', targetUnitId: 's2', with: { kind: 'small-arms' } })).page).toBe('p. 21')

    // Fired on by s1 last turn, but not since: still counts (p. 21, [reading]: this turn or last).
    let stale = must(applyAction(brState, { kind: 'activate', side: 'north', unitId: 'n1' }))
    stale.units['n1']!.firedOnBy['s1'] = stale.turn - 1
    expect('ok' in applyAction(stale, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } })).toBe(false)

    // Fired on two turns ago: too stale, refused again.
    let old = must(applyAction(brState, { kind: 'activate', side: 'north', unitId: 'n1' }))
    old.units['n1']!.firedOnBy['s1'] = old.turn - 2
    expect(refused(applyAction(old, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } })).page).toBe('p. 21')
  })

  it('fire records who fired on the target, for the broken-unit fire-back rule (p. 21)', () => {
    let state = battle(facingOff(6), 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const fired = must(applyAction(state, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } }))
    expect(fired.units['s1']!.firedOnBy['n1']).toBe(fired.turn)
  })

  it('planFire reports the range die and odds without rolling', () => {
    const state = createGame(facingOff(6))
    const plan = planFire(state, 'n1', 's1', { kind: 'small-arms' } as FireWith)
    expect('ok' in plan).toBe(false)
    if (!('ok' in plan)) {
      expect(plan.range).toBeCloseTo(6, 1) // between the firer's and target's own multi-figure centres, not exactly the gap
      expect(plan.pMajor).toBeGreaterThan(0)
      expect(plan.expectedCasualties).toBeGreaterThan(0)
    }
  })

  it('reads a wall’s cover directionally against the actual firer (p. 12–13): the firer’s own position is threaded through fire and planFire alike', () => {
    const wall = [{ id: 'w1', terrain: 'wall', shape: { kind: 'path', points: [{ x: 5, y: 13 }, { x: 15, y: 13 }], width: 0.2 } }] as GameSetup['table']['terrain']
    const target = { id: 's1', side: 'south' as const, figures: [{ id: 's1-f1', at: { x: 10, y: 14 }, leader: true }] }

    // North of the wall, firing south across it at a target standing in contact just beyond it: hard cover.
    const sheltered = createGame(setupWith([{ id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] }, target], { terrain: wall }))
    const behindWall = planFire(sheltered, 'n1', 's1', { kind: 'small-arms' } as FireWith)
    expect('ok' in behindWall).toBe(false)
    if (!('ok' in behindWall)) expect(behindWall.targetCover).toBe('hard')

    // The same wall, the same target, but a firer on the target's own side of it: no cover at all.
    const exposed = createGame(setupWith([{ id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 10, y: 20 }, leader: true }] }, target], { terrain: wall }))
    const sameSide = planFire(exposed, 'n1', 's1', { kind: 'small-arms' } as FireWith)
    expect('ok' in sameSide).toBe(false)
    if (!('ok' in sameSide)) expect(sameSide.targetCover).toBe('open')

    // `fire` itself reads the same directional cover, not just the advisory `planFire` (via the shared
    // `unitCover` helper both call): confirm the actual shot resolves without a refusal either way.
    let activated = must(applyAction(battle(setupWith([{ id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] }, target], { terrain: wall }), 'north'), { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect('ok' in applyAction(activated, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Suppression (p. 18)
// ---------------------------------------------------------------------------

describe('suppression (p. 18)', () => {
  const suppressedSquad = () =>
    setupWith([
      { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }, { id: 'n1-f2', at: { x: 11, y: 10 } }] },
      { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 20 }, leader: true }] },
    ])

  it("limits a suppressed unit's actions to reorganise in cover, remove suppression, or a leader action", () => {
    let state = battle(suppressedSquad(), 'north')
    state.units['n1']!.suppression = 2
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'move', side: 'north', mode: 'normal', moves: [{ figureId: 'n1-f1', path: [{ x: 11, y: 10 } as Point] }] })).page).toBe('p. 18')
    expect(refused(applyAction(state, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } })).page).toBe('p. 18')
    const allowed = allowedActions(state)
    expect(allowed['remove-suppression'].ok).toBe(true)
    expect(allowed['move'].ok).toBe(false)
  })

  it('a suppressed unit in the open cannot reorganise, but the same unit in cover can', () => {
    let state = battle(suppressedSquad(), 'north')
    state.units['n1']!.suppression = 1
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'reorganise', side: 'north' })).page).toBe('p. 18')
  })

  it('a suppressed unit behind a wall facing the enemy counts as in cover and may reorganise', () => {
    const wall: TerrainFeature = { id: 'wall', terrain: 'wall', shape: { kind: 'path', points: [{ x: 0, y: 10.5 }, { x: 40, y: 10.5 }], width: 0.2 } }
    const setup = setupWith(
      [
        { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }, { id: 'n1-f2', at: { x: 11, y: 10 } }] },
        { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 30 }, leader: true }] },
      ],
      { terrain: [wall] },
    )
    let state = battle(setup, 'north')
    state.units['n1']!.suppression = 1
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect('ok' in applyAction(state, { kind: 'reorganise', side: 'north' })).toBe(false)
  })

  it('removing one marker takes its own action and roll, up to twice a turn', () => {
    let state = battle(suppressedSquad(), 'north')
    state.units['n1']!.suppression = 2
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const once = must(applyAction(state, { kind: 'remove-suppression', side: 'north' }))
    const twice = must(applyAction(once, { kind: 'remove-suppression', side: 'north' }))
    expect(twice.units['n1']!.suppression).toBeLessThanOrEqual(2)
    expect(twice.activation).toBeNull() // both actions spent
  })
})

// ---------------------------------------------------------------------------
// In position (p. 13)
// ---------------------------------------------------------------------------

describe('in position (p. 13)', () => {
  const soloSquad = () =>
    setupWith([
      { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] },
      { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 20 }, leader: true }] },
    ])

  it('leaving position is automatic, and moving in position without leaving it first needs a reaction test', () => {
    let state = battle(soloSquad(), 'north')
    state.units['n1']!.inPosition = true
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const left = must(applyAction(state, { kind: 'leave-position', side: 'north' }))
    expect(left.units['n1']!.inPosition).toBe(false)

    let state2 = battle(soloSquad(), 'north')
    state2.units['n1']!.inPosition = true
    state2 = must(applyAction(state2, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const moved = must(applyAction(state2, { kind: 'move', side: 'north', mode: 'normal', moves: [{ figureId: 'n1-f1', path: [{ x: 12, y: 10 }] }] }))
    expect(lastLog(moved, 2)).toMatch(/tries to move without standing down/)
  })
})

// ---------------------------------------------------------------------------
// Reorganise, transfer, rally, panic (pp. 16–17, 21)
// ---------------------------------------------------------------------------

describe('reorganise (p. 17)', () => {
  it('treats every current casualty in the unit, and restores integrity', () => {
    let state = battle(
      setupWith([
        { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }, { id: 'n1-f2', at: { x: 40, y: 10 } }] },
        { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 20 }, leader: true }] },
      ]),
      'north',
    )
    state.figures['n1-f1']!.status = 'wounded'
    expect(liveUnits(state, 'north').length).toBe(1)
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const done = must(applyAction(state, { kind: 'reorganise', side: 'north' }))
    expect(['ok', 'stabilised', 'dead']).toContain(done.figures['n1-f1']!.status)
    expect(lastLog(done, 2)).toMatch(/is treated/)
  })
})

describe('transfer and rally (pp. 16–17)', () => {
  const hqAndSquad = () =>
    setupWith([
      { id: 'n-hq', side: 'north', commandLevel: 'platoon', figures: [{ id: 'n-hq-f1', at: { x: 10, y: 10 }, leader: true }] },
      { id: 'n-sq', side: 'north', commanderId: 'n-hq', confidence: 'SH', figures: [{ id: 'n-sq-f1', at: { x: 12, y: 10 }, leader: true }] },
      { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 30 }, leader: true }] },
    ])

  it('transfers an activation to a subordinate within 6", automatically, and it acts at once', () => {
    let state = battle(hqAndSquad(), 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n-hq' }))
    const transferred = must(applyAction(state, { kind: 'transfer', side: 'north', receiverUnitId: 'n-sq' }))
    expect(transferred.activation?.unitId).toBe('n-sq')
    expect(transferred.units['n-hq']!.activated).toBe(true)
    expect(lastLog(transferred, 2)).toMatch(/automatic/)
  })

  it('refuses a transfer to a unit it does not command', () => {
    let state = battle(hqAndSquad(), 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n-sq' }))
    expect(refused(applyAction(state, { kind: 'transfer', side: 'north', receiverUnitId: 'n-hq' })).page).toBe('p. 16')
  })

  it('rallying raises confidence a level on success, and refuses a target already confident', () => {
    const { state } = (() => {
      const found = seedWhere(
        (seed) => ({ ...hqAndSquad(), seed }),
        () => [{ kind: 'activate', side: 'north', unitId: 'n-hq' }, { kind: 'rally', side: 'north', targetUnitId: 'n-sq' }],
        (s) => s.units['n-sq']!.confidence === 'ST',
      )
      return found
    })()
    expect(state.units['n-sq']!.confidence).toBe('ST')
    const co = must(applyAction(battle(hqAndSquad(), 'north'), { kind: 'activate', side: 'north', unitId: 'n-hq' }))
    co.units['n-sq']!.confidence = 'CO'
    expect(refused(applyAction(co, { kind: 'rally', side: 'north', targetUnitId: 'n-sq' })).page).toBe('p. 17')
  })
})

describe('panic (p. 21)', () => {
  it('is limited to trying to recover, which costs the whole activation', () => {
    let state = battle(
      setupWith([
        { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] },
        { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 30 }, leader: true }] },
      ]),
      'north',
    )
    state.units['n1']!.panic = true
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'reorganise', side: 'north' })).page).toBe('p. 21')
    const recovered = must(applyAction(state, { kind: 'recover-panic', side: 'north' }))
    expect(recovered.activation).toBeNull()
  })

  it('a green unit tests for panic on first contact, once ever', () => {
    const found = seedWhere(
      (seed) =>
        setupWith(
          [
            { id: 'n1', side: 'north', quality: 'green', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] },
            { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 16 }, leader: true }] },
          ],
          { seed },
        ),
      () => [{ kind: 'done', side: 'north' }, { kind: 'activate', side: 'south', unitId: 's1' }, { kind: 'fire', side: 'south', targetUnitId: 'n1', with: { kind: 'small-arms' } }],
      (s) => s.units['n1']!.panicTested,
    )
    expect(found.state.units['n1']!.panicTested).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Close assault (pp. 41–43)
// ---------------------------------------------------------------------------

describe('close assault (pp. 41–43)', () => {
  const chargeSetup = () =>
    setupWith([
      {
        id: 'n1',
        side: 'north',
        quality: 'veteran',
        figures: [
          { id: 'n1-f1', at: { x: 10, y: 10 }, leader: true },
          { id: 'n1-f2', at: { x: 11, y: 10 } },
          { id: 'n1-f3', at: { x: 12, y: 10 } },
          { id: 'n1-f4', at: { x: 13, y: 10 } },
        ],
      },
      { id: 's1', side: 'south', quality: 'untrained', figures: [{ id: 's1-f1', at: { x: 10, y: 12 }, leader: true }] },
    ])

  it('may not be attempted at broken or routed confidence (p. 41)', () => {
    // A second, confident north unit keeps this side from being instantly beaten by n1's own BR confidence,
    // so the close-assault refusal itself is what's under test here.
    const setup = setupWith([
      { id: 'n1', side: 'north', quality: 'veteran', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] },
      { id: 'n2', side: 'north', figures: [{ id: 'n2-f1', at: { x: 20, y: 10 }, leader: true }] },
      { id: 's1', side: 'south', quality: 'untrained', figures: [{ id: 's1-f1', at: { x: 10, y: 12 }, leader: true }] },
    ])
    let state = battle(setup, 'north')
    state.units['n1']!.confidence = 'BR'
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(refused(applyAction(state, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves: [{ figureId: 'n1-f1', path: [{ x: 10, y: 12 }] }] })).page).toBe('p. 41')
  })

  it('a defender already broken routs automatically rather than stand (p. 41)', () => {
    // A Veteran unit's threat-0 reaction test to charge (~80% per the book's own die) is what has to pass
    // first; brute-force a seed where it does, so the mechanic under test is reliably reached.
    let after: GameState | null = null
    for (let seed = 1; seed <= 200 && !after; seed++) {
      let state = battle({ ...chargeSetup(), seed }, 'north')
      state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
      state.units['s1']!.confidence = 'BR'
      const attempt = applyAction(state, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves: [{ figureId: 'n1-f1', path: [{ x: 10, y: 12 }] }] })
      const next = must(attempt)
      if (!lastLog(next, 6).includes('it balks')) after = next
    }
    expect(after).not.toBeNull()
    expect(after!.units['s1']!.confidence).toBe('RO')
    expect(lastLog(after!, 5)).toMatch(/routs rather than stand/)
  })

  it('resolves a lopsided assault to a winner, with the loser falling back (p. 42–43)', () => {
    let state = battle(chargeSetup(), 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const result = must(
      applyAction(state, {
        kind: 'close-assault',
        side: 'north',
        targetUnitId: 's1',
        moves: [
          { figureId: 'n1-f1', path: [{ x: 10, y: 12 }] },
          { figureId: 'n1-f2', path: [{ x: 10, y: 12 }] },
          { figureId: 'n1-f3', path: [{ x: 10, y: 12 }] },
          { figureId: 'n1-f4', path: [{ x: 10, y: 12 }] },
        ],
      }),
    )
    const text = result.log.map((l) => l.text).join(' | ')
    // Either the attacker balked (a Veteran's threat-0 reaction rarely fails) or the assault ran to a conclusion.
    if (/it balks/.test(text)) return
    expect(text).toMatch(/wins the close assault|routs rather than stand|falls back from/)
  })

  it('a failed reaction test to charge costs only the first action; the second is free for something else, not a retry (p. 41)', () => {
    let state = battle(
      setupWith([
        { id: 'n1', side: 'north', quality: 'untrained', leadership: 3, confidence: 'SH', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] },
        { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 12 }, leader: true }] },
      ]),
      'north',
    )
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    // Threat +3 (SH) against leadership 3 needs a roll over 6 on an Untrained D4: impossible, so this always balks.
    const after = must(applyAction(state, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves: [{ figureId: 'n1-f1', path: [{ x: 10, y: 12 }] }] }))
    expect(lastLog(after)).toMatch(/it balks/)
    expect(after.activation).not.toBeNull()
    expect(actionsLeft(after)).toBe(1)
    expect(refused(applyAction(after, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves: [{ figureId: 'n1-f1', path: [{ x: 10, y: 12 }] }] })).page).toBe('p. 41')
    const usedSecond = must(applyAction(after, { kind: 'reorganise', side: 'north' }))
    expect(usedSecond.activation).toBeNull()
  })

  it('refuses a target beyond the reach of two combat moves, and a path that does not end in base contact (p. 41)', () => {
    let state = battle(
      setupWith([
        { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 10, y: 5 }, leader: true }] },
        { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 34 }, leader: true }] },
      ]),
      'north',
    )
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    // 29" away: beyond 24" (two D6 combat moves, doubled, at best).
    expect(refused(applyAction(state, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves: [{ figureId: 'n1-f1', path: [{ x: 10, y: 34 }] }] })).page).toBe('p. 41')
    // Close enough, but the declared path ends nowhere near the defender.
    expect(refused(applyAction(state, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves: [{ figureId: 'n1-f1', path: [{ x: 40, y: 5 }] }] })).page).toBe('p. 41')
  })

  it('the defender withdrawing on a failed stand test: the attackers occupy the vacated ground uncontested, no Combat Move rolled (p. 41)', () => {
    const setup = () =>
      setupWith([
        {
          id: 'n1',
          side: 'north',
          quality: 'elite',
          leadership: 1,
          confidence: 'CO',
          figures: [
            { id: 'n1-f1', at: { x: 10, y: 10 }, leader: true },
            { id: 'n1-f2', at: { x: 11, y: 10 } },
            { id: 'n1-f3', at: { x: 12, y: 10 } },
            { id: 'n1-f4', at: { x: 13, y: 10 } },
          ],
        },
        { id: 's1', side: 'south', quality: 'untrained', leadership: 3, confidence: 'CO', figures: [{ id: 's1-f1', at: { x: 10, y: 12 }, leader: true }] },
      ])
    const moves = [
      { figureId: 'n1-f1', path: [{ x: 10, y: 12 }] },
      { figureId: 'n1-f2', path: [{ x: 10, y: 12 }] },
      { figureId: 'n1-f3', path: [{ x: 10, y: 12 }] },
      { figureId: 'n1-f4', path: [{ x: 10, y: 12 }] },
    ]
    let after: GameState | null = null
    // 4:1 odds (standThreat 4) against an Untrained D4 defender (leadership 3) can never pass (target 7):
    // only the attacker's own Elite threat-0 charge roll (near-certain, but not the impossible roll of 1) gates this.
    for (let seed = 1; seed <= 300 && !after; seed++) {
      let state = battle({ ...setup(), seed }, 'north')
      state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
      const next = must(applyAction(state, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves }))
      if (!lastLog(next, 8).includes('it balks')) after = next
    }
    expect(after).not.toBeNull()
    const text = after!.log.map((l) => l.text).join(' | ')
    expect(text).toMatch(/falls back from/)
    expect(text).not.toMatch(/Combat Move to close/)
    for (const m of moves) expect(after!.figures[m.figureId]!.position).toEqual(m.path[0])
    expect(after!.activation).toBeNull()
  })

  it('contact on the first Combat Move roll: the figures that reached fight it out at once, with no Final Defensive Fire (p. 41–42)', () => {
    const setup = () =>
      setupWith([
        { id: 'n1', side: 'north', quality: 'elite', leadership: 1, confidence: 'CO', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] },
        {
          id: 's1',
          side: 'south',
          quality: 'regular',
          leadership: 1,
          confidence: 'CO',
          figures: [
            { id: 's1-f1', at: { x: 10, y: 12 }, leader: true },
            { id: 's1-f2', at: { x: 11, y: 12 } },
            { id: 's1-f3', at: { x: 9, y: 12 } },
            { id: 's1-f4', at: { x: 10, y: 13 } },
          ],
        },
      ])
    // Exactly 2" from the target figure: even the worst Combat Move roll (D6 rolls 1, 2") reaches it.
    const moves = [{ figureId: 'n1-f1', path: [{ x: 10, y: 12 }] }]
    let after: GameState | null = null
    for (let seed = 1; seed <= 300 && !after; seed++) {
      let state = battle({ ...setup(), seed }, 'north')
      state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
      const next = must(applyAction(state, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves }))
      const text = next.log.map((l) => l.text).join(' | ')
      if (/it charges/.test(text) && /stands to receive the charge/.test(text)) after = next
    }
    expect(after).not.toBeNull()
    const text = after!.log.map((l) => l.text).join(' | ')
    expect(text).toMatch(/Combat Move to close: D6 rolls/)
    expect(text).not.toMatch(/final defensive fire/)
    expect(text).toMatch(/wins the close assault|falls back from/)
    expect(after!.figures['n1-f1']!.position).toEqual({ x: 10, y: 12 })
  })

  it('short on the first roll: Final Defensive Fire that inflicts a casualty turns the attacker back, suppressed (p. 43)', () => {
    const setup = () =>
      setupWith([
        { id: 'n1', side: 'north', quality: 'untrained', leadership: 1, confidence: 'CO', armour: 'battledress', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] },
        {
          id: 's1',
          side: 'south',
          quality: 'regular',
          leadership: 1,
          confidence: 'CO',
          figures: [
            { id: 's1-f1', at: { x: 10, y: 23 }, leader: true },
            { id: 's1-f2', at: { x: 11, y: 23 } },
            { id: 's1-f3', at: { x: 9, y: 23 } },
            { id: 's1-f4', at: { x: 10, y: 24 } },
          ],
        },
      ])
    // 13" away: no single Combat Move roll (max 12") can ever reach it, so the first roll always falls short.
    const moves = [{ figureId: 'n1-f1', path: [{ x: 10, y: 23 }] }]
    let after: GameState | null = null
    for (let seed = 1; seed <= 6000 && !after; seed++) {
      let state = battle({ ...setup(), seed }, 'north')
      state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
      const next = must(applyAction(state, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves }))
      if (next.log.some((l) => l.text.includes('abandons the assault and pulls back'))) after = next
    }
    expect(after).not.toBeNull()
    const text = after!.log.map((l) => l.text).join(' | ')
    expect(text).toMatch(/gives final defensive fire.*casualt/)
    expect(text).toMatch(/tests reaction under final defensive fire.*falls back/)
    expect(after!.units['n1']!.suppression).toBe(1)
    expect(after!.figures['n1-f1']!.position).toEqual({ x: 10, y: 10 }) // back to where the assault started
    expect(after!.activation).toBeNull()
  }, 20_000)

  it('short, Final Defensive Fire that never gets off a shot (a suppressed defender fails its reaction test), then contact on the second roll (p. 43)', () => {
    const setup = () =>
      setupWith([
        { id: 'n1', side: 'north', quality: 'elite', leadership: 1, confidence: 'CO', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] },
        {
          id: 's1',
          side: 'south',
          quality: 'untrained',
          leadership: 1,
          confidence: 'CO',
          figures: [
            { id: 's1-f1', at: { x: 10, y: 33 }, leader: true },
            { id: 's1-f2', at: { x: 11, y: 33 } },
            { id: 's1-f3', at: { x: 9, y: 33 } },
            { id: 's1-f4', at: { x: 10, y: 34 } },
          ],
        },
      ])
    // 23" away: always short of a single roll (max 12"), but only the rare (6,6) pair of rolls covers it in two.
    const moves = [{ figureId: 'n1-f1', path: [{ x: 10, y: 33 }] }]
    let after: GameState | null = null
    for (let seed = 1; seed <= 4000 && !after; seed++) {
      let state = battle({ ...setup(), seed }, 'north')
      state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
      // An Untrained defender, leadership 1, at 3 suppression markers can never pass its TL-3 reaction
      // test (target 4, D4 max 4): Final Defensive Fire never actually gets a shot off.
      state.units['s1']!.suppression = 3
      const next = must(applyAction(state, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves }))
      const text = next.log.map((l) => l.text).join(' | ')
      if (/rolls its Combat Move again/.test(text) && !/still falls short/.test(text)) after = next
    }
    expect(after).not.toBeNull()
    const text = after!.log.map((l) => l.text).join(' | ')
    expect(text).toMatch(/too pinned to react/)
    expect(text).not.toMatch(/final defensive fire at/) // the gated attempt never actually fires
    expect(text).toMatch(/wins the close assault|falls back from/)
  }, 20_000)

  it('still short after both rolls: \'stay\' leaves the figures where the dash ended, \'withdraw\' sends them back suppressed, as if the reaction test had failed (p. 43)', () => {
    const setup = () =>
      setupWith([
        { id: 'n1', side: 'north', quality: 'elite', leadership: 1, confidence: 'CO', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] },
        {
          id: 's1',
          side: 'south',
          quality: 'untrained',
          leadership: 1,
          confidence: 'CO',
          figures: [
            { id: 's1-f1', at: { x: 10, y: 33 }, leader: true },
            { id: 's1-f2', at: { x: 11, y: 33 } },
            { id: 's1-f3', at: { x: 9, y: 33 } },
            { id: 's1-f4', at: { x: 10, y: 34 } },
          ],
        },
      ])
    const moves = [{ figureId: 'n1-f1', path: [{ x: 10, y: 33 }] }]
    let base: GameState | null = null
    for (let seed = 1; seed <= 4000 && !base; seed++) {
      let state = battle({ ...setup(), seed }, 'north')
      state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
      state.units['s1']!.suppression = 3
      const stay = must(applyAction(state, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves, ifShort: 'stay' }))
      if (lastLog(stay, 2).includes('still falls short')) base = state
    }
    expect(base).not.toBeNull()

    const stay = must(applyAction(base!, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves, ifShort: 'stay' }))
    expect(lastLog(stay, 2)).toMatch(/holds where the dash left it/)
    expect(stay.units['n1']!.suppression).toBe(0)
    expect(stay.figures['n1-f1']!.position).not.toEqual({ x: 10, y: 10 })
    expect(stay.activation).toBeNull()

    // The identical seed, replayed with the other choice: the same two rolls, a different outcome.
    const withdraw = must(applyAction(base!, { kind: 'close-assault', side: 'north', targetUnitId: 's1', moves, ifShort: 'withdraw' }))
    expect(lastLog(withdraw, 2)).toMatch(/gives up the assault, suppressed/)
    expect(withdraw.units['n1']!.suppression).toBe(1)
    expect(withdraw.figures['n1-f1']!.position).toEqual({ x: 10, y: 10 })
    expect(withdraw.activation).toBeNull()
  }, 20_000)

  describe('assaultMoves (p. 41)', () => {
    const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

    it('keeps every default contact point at least 0.8" from every other attacker and from a defender other than its own', () => {
      // More attackers than defenders, and two of the defenders close together, is exactly the shape
      // that used to overlap: several extras fanned around one point at less than 0.8" apart, and a
      // fan around one defender landing on top of a neighbouring one.
      const setup = setupWith([
        {
          id: 'n1',
          side: 'north',
          figures: [
            { id: 'n1-f1', at: { x: 10, y: 4 }, leader: true },
            { id: 'n1-f2', at: { x: 11, y: 4 } },
            { id: 'n1-f3', at: { x: 12, y: 4 } },
            { id: 'n1-f4', at: { x: 9, y: 4 } },
            { id: 'n1-f5', at: { x: 13, y: 4 } },
            { id: 'n1-f6', at: { x: 8, y: 4 } },
            { id: 'n1-f7', at: { x: 14, y: 4 } },
          ],
        },
        {
          id: 's1',
          side: 'south',
          figures: [
            { id: 's1-f1', at: { x: 10, y: 10 }, leader: true },
            { id: 's1-f2', at: { x: 11.5, y: 10 } },
          ],
        },
      ])
      const state = createGame(setup)
      const moves = assaultMoves(state, 'n1', 's1')
      expect(moves.length).toBe(7)
      const ends = moves.map((m) => m.path[0]!)
      for (let i = 0; i < ends.length; i++) {
        for (let j = i + 1; j < ends.length; j++) expect(dist(ends[i]!, ends[j]!)).toBeGreaterThanOrEqual(0.8 - 1e-6)
      }
      // A figure's own defender is allowed to be close (that's the point of a contact move); only a
      // *different* defender's figure must stay clear.
      const defenderPos = (id: string) => state.figures[id]!.position
      const nearestDefender = (p: Point) => (dist(p, defenderPos('s1-f1')) <= dist(p, defenderPos('s1-f2')) ? 's1-f1' : 's1-f2')
      for (const m of moves) {
        const end = m.path[0]!
        const own = nearestDefender(end)
        const foreign = own === 's1-f1' ? 's1-f2' : 's1-f1'
        expect(dist(end, defenderPos(foreign))).toBeGreaterThanOrEqual(0.8 - 1e-6)
      }
      // Every path still ends in base contact with a fit defender (planAssault's own reach check).
      for (const m of moves) {
        const end = m.path[0]!
        expect(Math.min(dist(end, defenderPos('s1-f1')), dist(end, defenderPos('s1-f2')))).toBeLessThanOrEqual(1.25 + 1e-6)
      }
    })
  })
})

// ---------------------------------------------------------------------------
// Objectives and the end of the battle (pp. 14, 17)
// ---------------------------------------------------------------------------

describe('objectives (p. 17)', () => {
  it('is held by the side nearest it, within 1", once no enemy stands nearer', () => {
    const objectives = [{ id: 'o1', position: { x: 10, y: 10 }, value: 1, drawnBy: null }]
    let state = battle(
      setupWith(
        [
          { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 5, y: 10 }, leader: true }] },
          { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 20, y: 10 }, leader: true }] },
        ],
        { objectives },
      ),
      'north',
    )
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    const took = must(applyAction(state, { kind: 'move', side: 'north', mode: 'normal', moves: [{ figureId: 'n1-f1', path: [{ x: 9.5, y: 10 }] }] }))
    expect(took.objectives['o1']!.heldBy).toBe('north')
    expect(objectiveValues(took).north).toBe(1)
  })
})

describe('the end of the battle (p. 15)', () => {
  it('ends on the turn limit, deciding by objective value', () => {
    const objectives = [{ id: 'o1', position: { x: 10, y: 10 }, value: 1, drawnBy: null }]
    let state = battle(
      setupWith(
        [
          { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 9.5, y: 10 }, leader: true }] },
          { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 30, y: 30 }, leader: true }] },
        ],
        { objectives, turnLimit: 1 },
      ),
      'north',
    )
    state = must(applyAction(state, { kind: 'done', side: 'north' }))
    state = must(applyAction(state, { kind: 'done', side: 'south' }))
    expect(state.result).not.toBeNull()
    expect(state.phase).toBe('ended')
  })

  it('a side whose every unit is broken, routed or gone loses at once, not only at the turn end', () => {
    let state = battle(
      setupWith([
        { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] },
        { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 30 }, leader: true }] },
      ]),
      'north',
    )
    state.units['n1']!.confidence = 'RO'
    expect(state.result).toBeNull()
    // A mere 'done' (not a turn end, and not even north's own confidence test) is enough to notice.
    const after = must(applyAction(state, { kind: 'done', side: 'north' }))
    expect(after.phase).toBe('ended')
    expect(after.result).toEqual({ winner: 'south', reason: 'the other side is broken, routed or gone', values: { north: 0, south: 0 } })
  })
})

// ---------------------------------------------------------------------------
// A small battle, scripted by hand, and replay
// ---------------------------------------------------------------------------

describe('a small battle, scripted by hand', () => {
  it('plays out over two turns to a specific, reproducible state, and replays exactly', () => {
    const setup = setupWith(
      [
        {
          id: 'n1',
          side: 'north',
          figures: [
            { id: 'n1-f1', at: { x: 10, y: 5 }, leader: true },
            { id: 'n1-f2', at: { x: 11, y: 5 } },
          ],
        },
        { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 20 }, leader: true }] },
      ],
      { seed: 7, turnLimit: 2 },
    )
    let state = battle(setup, 'north')
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    state = must(applyAction(state, { kind: 'move', side: 'north', mode: 'normal', moves: [{ figureId: 'n1-f1', path: [{ x: 10, y: 8 }] }, { figureId: 'n1-f2', path: [{ x: 11, y: 8 }] }] }))
    state = must(applyAction(state, { kind: 'fire', side: 'north', targetUnitId: 's1', with: { kind: 'small-arms' } }))
    expect(state.activation).toBeNull() // two actions spent: move, fire
    state = must(applyAction(state, { kind: 'activate', side: 'south', unitId: 's1' }))
    state = must(applyAction(state, { kind: 'reorganise', side: 'south' }))
    state = must(applyAction(state, { kind: 'end-activation', side: 'south' }))
    expect(state.turn).toBe(2)

    const again = replay(setup, state.journal)
    expect(again).toEqual(state)
  })
})

// ---------------------------------------------------------------------------
// The advisory API
// ---------------------------------------------------------------------------

describe('the advisory API', () => {
  it('actionsLeft and allowedActions reflect the unit now activated', () => {
    let state = battle(
      setupWith([
        { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] },
        { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 30 }, leader: true }] },
      ]),
      'north',
    )
    expect(actionsLeft(state)).toBe(0)
    state = must(applyAction(state, { kind: 'activate', side: 'north', unitId: 'n1' }))
    expect(actionsLeft(state)).toBe(2)
    expect(allowedActions(state)['move'].ok).toBe(true)
    state = must(applyAction(state, { kind: 'reorganise', side: 'north' }))
    expect(actionsLeft(state)).toBe(1)
  })

  it('threatNow describes a unit in words', () => {
    let state = battle(
      setupWith([
        { id: 'n1', side: 'north', figures: [{ id: 'n1-f1', at: { x: 10, y: 10 }, leader: true }] },
        { id: 's1', side: 'south', figures: [{ id: 's1-f1', at: { x: 10, y: 30 }, leader: true }] },
      ]),
      'north',
    )
    expect(threatNow(state, 'n1')).toMatch(/no restrictions/)
    state.units['n1']!.confidence = 'RO'
    expect(threatNow(state, 'n1')).toMatch(/Routed/)
    state.units['n1']!.suppression = 2
    expect(threatNow(state, 'n1')).toMatch(/Suppressed/)
  })
})

