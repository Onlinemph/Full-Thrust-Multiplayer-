/**
 * Tests for the sequence of play (2.5, 2.6) and the game state it drives.
 *
 * Where the rulebook works an example through — the threshold example in 4.11
 * is the one that touches this module — the example is the test.
 */

import { describe, expect, it } from 'vitest'

import { Rng, thresholdCheck, thresholdTarget } from './dice'
import {
  PHASE_ORDER,
  type Phase,
  type ShipDesign,
  type SystemDef,
  type SystemKind,
  type WeaponDef,
} from './types'
import {
  INTRODUCTORY_PHASES,
  PHASE_SEQUENCE,
  activationOrder,
  activeFighterGroups,
  activeShips,
  advancePhase,
  advanceToPhase,
  alternateActivations,
  assignDamageControl,
  assignFireCon,
  availableFireCons,
  availableWeapons,
  canShipFire,
  canWeaponFire,
  createGame,
  createShipState,
  crewFactorBoxes,
  crewFactors,
  currentThrust,
  damageControlParties,
  destroySystem,
  enemiesOf,
  engagedTargets,
  fighterActivationOrder,
  fighterGroupById,
  fireConCapacity,
  hullRemaining,
  hullRowBoundaries,
  hullRowsCompleted,
  isSystemDestroyed,
  lastKnownVector,
  logFor,
  markHullBoxes,
  markShipFired,
  markWeaponFired,
  operationalSystems,
  pendingThresholdCheck,
  phaseNumber,
  pushLog,
  resolvePendingThreshold,
  rollInitiative,
  setInitiativeOrder,
  shipActivationOrder,
  shipById,
  shipMovementOrder,
  shipsAwaitingThreshold,
  sideById,
  sides,
  thresholdResolution,
  weaponFiredIn,
  type FighterGroupState,
  type GameState,
  type ShipState,
} from './game'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** An Rng whose faces are written in advance, so a rule can be tested rather
 *  than the dice. `d6` reads `int(6)`, so each face maps to its own sixth. */
class ScriptedRng extends Rng {
  private faces: number[]

  constructor(faces: number[]) {
    super(1)
    this.faces = [...faces]
  }

  override next(): number {
    const face = this.faces.shift()
    return face === undefined ? super.next() : (face - 0.5) / 6
  }
}

/** Narrow away a nullable lookup in a test, failing loudly instead of with `!`. */
function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`expected ${what}`)
  return value
}

function weapon(id: string, overrides: Partial<WeaponDef> = {}): WeaponDef {
  return {
    id,
    label: 'Class-1 Beam',
    weaponClass: 'beam',
    rating: 1,
    variant: 'standard',
    arcs: ['F'],
    mass: 1,
    points: 3,
    ...overrides,
  }
}

function system(id: string, kind: SystemKind): SystemDef {
  return { id, kind, label: id, mass: 1, points: 4 }
}

function design(overrides: Partial<ShipDesign> = {}): ShipDesign {
  return {
    id: 'test-cruiser',
    name: 'Test Cruiser',
    faction: 'Test',
    group: 'cruiser',
    mass: 40,
    hullClass: 'average',
    hullRows: 4,
    hullBoxes: 12,
    drive: { thrust: 4, advanced: false },
    ftl: 'standard',
    streamlining: 'none',
    armour: { layers: [], regenerative: false },
    screens: { level: 0, generators: 0, advanced: false },
    weapons: [],
    turrets: [],
    systems: [],
    fighterBays: [],
    gunboats: [],
    additionalDamageControlParties: 0,
    marineParties: 0,
    points: 100,
    ...overrides,
  }
}

function ship(id: string, side: string, overrides: Partial<ShipDesign> = {}): ShipState {
  return createShipState({
    id,
    side,
    design: design(overrides),
    placement: { position: { x: 0, y: 0 }, facing: 12 },
    velocity: 6,
  })
}

function game(opts: { ships?: ShipState[]; phases?: readonly Phase[]; sideIds?: string[] } = {}): GameState {
  const sideIds = opts.sideIds ?? ['red', 'blue']
  return createGame({
    seed: 20170401,
    sides: sideIds.map((id) => ({ id })),
    ships: opts.ships ?? [ship('r1', 'red'), ship('b1', 'blue')],
    phases: opts.phases,
  })
}

function fighterGroup(
  id: string,
  side: string,
  overrides: Partial<FighterGroupState> = {},
): FighterGroupState {
  return {
    id,
    side,
    carrierId: null,
    typeId: 'standard',
    label: id,
    position: { x: 0, y: 0 },
    facing: 12,
    strength: 6,
    cef: 6,
    status: 'in-flight',
    launchedTurn: null,
    recoveredTurn: null,
    mission: 'free',
    escorting: null,
    movedThisTurn: false,
    secondaryMovedThisTurn: false,
    attackedThisTurn: false,
    evading: false,
    engagedWith: [],
    modifiers: [],
    armament: 'beam',
    loadout: null,
    pilots: 'average',
    aceKilled: false,
    payloadSpent: false,
    readyTurn: null,
    grounded: false,
    targetId: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 2.6 The fifteen phases
// ---------------------------------------------------------------------------

describe('the sequence of play (2.6)', () => {
  it('numbers the fifteen phases the way the rulebook does', () => {
    expect(PHASE_ORDER).toHaveLength(15)
    PHASE_ORDER.forEach((phase, index) => {
      expect(phaseNumber(phase)).toBe(index + 1)
    })
    // Spot checks against the book's own numbering.
    expect(phaseNumber('point-defence')).toBe(9)
    expect(phaseNumber('ship-fire')).toBe(11)
    expect(phaseNumber('threshold')).toBe(13)
    expect(phaseNumber('reactor-explosions')).toBe(15)
  })

  it('walks every phase and wraps into the next turn', () => {
    const state = game()
    expect(state).toMatchObject({ turn: 1, phase: 'orders' })

    const visited: Phase[] = [state.phase]
    for (let i = 0; i < 14; i++) visited.push(advancePhase(state).phase)
    expect(visited).toEqual([...PHASE_ORDER])
    expect(state.turn).toBe(1)

    expect(advancePhase(state)).toEqual({ turn: 2, phase: 'orders' })
  })

  it('plays only phases 1, 2, 5, 11 and 13 in the introductory scenario', () => {
    expect(INTRODUCTORY_PHASES.map(phaseNumber)).toEqual([1, 2, 5, 11, 13])

    const state = game({ phases: INTRODUCTORY_PHASES })
    const visited: Phase[] = [state.phase]
    for (let i = 0; i < 4; i++) visited.push(advancePhase(state).phase)
    expect(visited).toEqual([...INTRODUCTORY_PHASES])
    expect(advancePhase(state)).toEqual({ turn: 2, phase: 'orders' })
  })

  it('advanceToPhase stops on the phase asked for', () => {
    const state = game()
    expect(advanceToPhase(state, 'ship-fire')).toEqual({ turn: 1, phase: 'ship-fire' })
    // Asking again goes round the turn rather than standing still.
    expect(advanceToPhase(state, 'ship-fire')).toEqual({ turn: 2, phase: 'ship-fire' })
  })
})

// ---------------------------------------------------------------------------
// 2.6 phase 2 — initiative
// ---------------------------------------------------------------------------

describe('initiative (2.6 phase 2)', () => {
  it('gives initiative to the highest D6', () => {
    const state = game()
    state.rng = new ScriptedRng([3, 5])
    const initiative = rollInitiative(state)

    expect(initiative.rounds[0]).toEqual([
      { side: 'red', roll: 3 },
      { side: 'blue', roll: 5 },
    ])
    expect(initiative.winner).toBe('blue')
    expect(initiative.order).toEqual(['blue', 'red'])
  })

  it('re-rolls a tie among the tied leaders only', () => {
    const state = game({ sideIds: ['red', 'blue', 'green'] })
    // red 6, blue 6, green 2 — then red 2, blue 5 between the two leaders.
    state.rng = new ScriptedRng([6, 6, 2, 2, 5])
    const initiative = rollInitiative(state)

    expect(initiative.rounds).toHaveLength(2)
    expect(initiative.rounds[1].map((r) => r.side)).toEqual(['red', 'blue'])
    expect(initiative.winner).toBe('blue')
    // Green was never in contention, so it stays behind red on the opening roll.
    expect(initiative.order).toEqual(['blue', 'red', 'green'])
  })

  it('lets the winner decide the order for the others', () => {
    const state = game({ sideIds: ['red', 'blue', 'green'] })
    state.rng = new ScriptedRng([2, 6, 4])
    rollInitiative(state)
    expect(state.initiative?.order).toEqual(['blue', 'green', 'red'])

    expect(setInitiativeOrder(state, ['blue', 'red', 'green'])).toBe(true)
    expect(state.initiative?.order).toEqual(['blue', 'red', 'green'])

    // The winner keeps initiative; they only order the others.
    expect(setInitiativeOrder(state, ['red', 'blue', 'green'])).toBe(false)
    expect(setInitiativeOrder(state, ['blue', 'green'])).toBe(false)
    expect(state.initiative?.order).toEqual(['blue', 'red', 'green'])
  })

  it('is rolled fresh every turn when the phase comes round', () => {
    const state = game()
    advanceToPhase(state, 'initiative')
    expect(state.initiative?.turn).toBe(1)
    const first = state.initiative?.rounds[0]

    advanceToPhase(state, 'initiative')
    expect(state.turn).toBe(2)
    expect(state.initiative?.turn).toBe(2)
    expect(state.initiative?.rounds[0]).not.toBe(first)
  })

  it('replays identically from the same seed', () => {
    const rolls = (): number[] => {
      const state = game()
      advanceToPhase(state, 'initiative')
      return state.initiative?.rounds[0].map((r) => r.roll) ?? []
    }
    expect(rolls()).toEqual(rolls())
  })
})

// ---------------------------------------------------------------------------
// 2.6 — who acts first, and in what units
// ---------------------------------------------------------------------------

describe('who acts first (2.6)', () => {
  function withInitiative(): GameState {
    const state = game()
    state.rng = new ScriptedRng([2, 5]) // blue wins
    rollInitiative(state)
    return state
  }

  it('has the initiative loser launch and move first, but fire second', () => {
    const state = withInitiative()
    expect(state.initiative?.winner).toBe('blue')

    // Phases 3, 4 and 6: the winner goes last.
    expect(activationOrder(state, 'launch-missiles')).toEqual(['red', 'blue'])
    expect(activationOrder(state, 'move-fighters')).toEqual(['red', 'blue'])
    expect(activationOrder(state, 'secondary-fighter-moves')).toEqual(['red', 'blue'])

    // Phase 11: the winner goes first.
    expect(activationOrder(state, 'ship-fire')).toEqual(['blue', 'red'])
  })

  it('classifies each phase the way the rulebook words it', () => {
    expect(PHASE_SEQUENCE['launch-missiles'].sequencing).toBe('initiative-last')
    expect(PHASE_SEQUENCE['move-fighters'].sequencing).toBe('initiative-last')
    expect(PHASE_SEQUENCE['secondary-fighter-moves'].sequencing).toBe('initiative-last')
    expect(PHASE_SEQUENCE['ship-fire'].sequencing).toBe('initiative-first')
    expect(PHASE_SEQUENCE['move-ships'].sequencing).toBe('simultaneous')
    expect(PHASE_SEQUENCE['orders'].sequencing).toBe('simultaneous')

    expect(PHASE_SEQUENCE['launch-missiles'].unit).toBe('ship')
    expect(PHASE_SEQUENCE['ship-fire'].unit).toBe('ship')
    expect(PHASE_SEQUENCE['move-fighters'].unit).toBe('fighter-group')
  })

  it('alternates one ship at a time, not by entire fleet (2.5)', () => {
    const units = new Map<string, string[]>([
      ['blue', ['b1', 'b2']],
      ['red', ['r1', 'r2', 'r3']],
    ])
    expect(alternateActivations(['blue', 'red'], units).map((a) => a.unit)).toEqual([
      'b1',
      'r1',
      'b2',
      'r2',
      // Blue has run out; red keeps going alone.
      'r3',
    ])
  })

  it('orders phase 11 by ship, starting with the initiative winner', () => {
    const ships = [ship('r1', 'red'), ship('r2', 'red'), ship('b1', 'blue')]
    const state = createGame({ seed: 7, sides: [{ id: 'red' }, { id: 'blue' }], ships })
    state.rng = new ScriptedRng([2, 5]) // blue wins
    rollInitiative(state)

    expect(shipActivationOrder(state, 'ship-fire').map((a) => a.unit.id)).toEqual([
      'b1',
      'r1',
      'r2',
    ])
    // Phase 3 reverses it, and a destroyed ship is no longer in the rotation.
    ships[0].destroyed = true
    expect(shipActivationOrder(state, 'launch-missiles').map((a) => a.unit.id)).toEqual([
      'r2',
      'b1',
    ])
  })

  it('moves fighter groups launched this turn before those already in flight', () => {
    const state = game()
    state.fighterGroups = [
      fighterGroup('veteran', 'red', { launchedTurn: 1 }),
      fighterGroup('fresh', 'red', { launchedTurn: 2 }),
    ]
    state.rng = new ScriptedRng([2, 5])
    rollInitiative(state)
    state.turn = 2

    expect(fighterActivationOrder(state, 'move-fighters').map((a) => a.unit.id)).toEqual([
      'fresh',
      'veteran',
    ])
  })

  it('moves fixed paths first and FTL transits last in phase 5', () => {
    const rock = ship('rock', 'red')
    rock.fixedPath = true
    const layer = ship('layer', 'red')
    layer.layingMines = true
    const jumper = ship('jumper', 'blue')
    jumper.ftlTransit = 'entering'
    const normal = ship('normal', 'blue')

    const state = createGame({
      seed: 1,
      sides: [{ id: 'red' }, { id: 'blue' }],
      ships: [jumper, normal, layer, rock],
    })
    expect(shipMovementOrder(state).map((s) => s.id)).toEqual([
      'rock',
      'layer',
      'normal',
      'jumper',
    ])
  })
})

// ---------------------------------------------------------------------------
// 2.6 — a weapon fires once a turn
// ---------------------------------------------------------------------------

describe('weapons fire once per turn (2.6)', () => {
  it('will not let a beam used for point defence in phase 9 fire in phase 11', () => {
    const pd = ship('r1', 'red', { weapons: [weapon('beam-1'), weapon('beam-2')] })
    const state = game({ ships: [pd, ship('b1', 'blue')] })

    advanceToPhase(state, 'point-defence')
    expect(canWeaponFire(pd, 'beam-1')).toBe(true)
    markWeaponFired(pd, 'beam-1', state.phase)

    advanceToPhase(state, 'ship-fire')
    expect(canWeaponFire(pd, 'beam-1')).toBe(false)
    expect(weaponFiredIn(pd, 'beam-1')).toBe('point-defence')
    // The mount that stayed quiet is still loaded.
    expect(availableWeapons(pd)).toEqual(['beam-2'])
  })

  it('gives every weapon its shot back at the start of the next turn', () => {
    const gunship = ship('r1', 'red', { weapons: [weapon('beam-1')] })
    const state = game({ ships: [gunship, ship('b1', 'blue')] })

    advanceToPhase(state, 'ship-fire')
    markWeaponFired(gunship, 'beam-1', state.phase)
    markShipFired(gunship)
    expect(canWeaponFire(gunship, 'beam-1')).toBe(false)
    expect(canShipFire(gunship)).toBe(false)

    advanceToPhase(state, 'orders')
    expect(state.turn).toBe(2)
    expect(canWeaponFire(gunship, 'beam-1')).toBe(true)
    expect(canShipFire(gunship)).toBe(true)
  })

  it('will not fire a mount that a threshold check crossed off', () => {
    const gunship = ship('r1', 'red', { weapons: [weapon('beam-1')] })
    destroySystem(gunship, 'beam-1')
    expect(canWeaponFire(gunship, 'beam-1')).toBe(false)
    expect(availableWeapons(gunship)).toEqual([])
  })

  it('will not fire a one-shot rack with no shots left (6.6)', () => {
    const launcher = ship('r1', 'red', {
      weapons: [weapon('smr', { weaponClass: 'salvo-missile-rack', ammo: 0 })],
    })
    expect(canWeaponFire(launcher, 'smr')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4.4, 5.2 — FireCon
// ---------------------------------------------------------------------------

describe('fire control (4.4, 5.2)', () => {
  it('counts an Advanced FireCon as two normal ones', () => {
    const cruiser = ship('r1', 'red', {
      systems: [system('fc1', 'firecon'), system('afc', 'advanced-firecon')],
    })
    expect(fireConCapacity(cruiser)).toBe(3)

    destroySystem(cruiser, 'afc')
    expect(fireConCapacity(cruiser)).toBe(1)
  })

  it('spends one FireCon per target, however many weapons bear on it', () => {
    const cruiser = ship('r1', 'red', {
      systems: [system('fc1', 'firecon'), system('fc2', 'firecon')],
    })
    expect(assignFireCon(cruiser, 'enemy-a', 'ship-fire')).toBe(true)
    // The second Beam-3 at the same target is free (4.4).
    expect(assignFireCon(cruiser, 'enemy-a', 'ship-fire')).toBe(true)
    expect(availableFireCons(cruiser, 'ship-fire')).toBe(1)

    expect(assignFireCon(cruiser, 'enemy-b', 'ship-fire')).toBe(true)
    expect(availableFireCons(cruiser, 'ship-fire')).toBe(0)
    expect(assignFireCon(cruiser, 'enemy-c', 'ship-fire')).toBe(false)
  })

  it('frees a FireCon used to launch missiles in phase 3 for phase 11 (5.2)', () => {
    const cruiser = ship('r1', 'red', { systems: [system('fc1', 'firecon')] })
    const state = game({ ships: [cruiser, ship('b1', 'blue')] })

    advanceToPhase(state, 'launch-missiles')
    expect(assignFireCon(cruiser, 'enemy-a', state.phase)).toBe(true)
    expect(availableFireCons(cruiser, state.phase)).toBe(0)

    advanceToPhase(state, 'ship-fire')
    expect(availableFireCons(cruiser, state.phase)).toBe(1)
    expect(assignFireCon(cruiser, 'enemy-b', state.phase)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2.4, 4.11 — the hull track and threshold points
// ---------------------------------------------------------------------------

describe('threshold points (4.11, phase 13)', () => {
  it('works the rulebook example: 12 boxes in four rows of three', () => {
    // "A ship with 12 hull boxes in four rows of three takes 7 damage points
    // from another ship in one attack, crossing off two complete rows."
    const target = ship('b1', 'blue')
    expect(hullRowBoundaries(target)).toEqual([3, 6, 9, 12])

    expect(markHullBoxes(target, 7)).toEqual({ marked: 7, rowsCrossed: 2, destroyed: false })
    const first = required(pendingThresholdCheck(target), 'a pending threshold check')
    expect(first).toEqual({ rowsLost: 2, extraRows: 1 })

    // "At the end of the second row systems are normally lost on a roll of 5 or
    // 6, but this time they will be lost on 4-6."
    expect(thresholdTarget(2)).toBe(5)
    const scripted = new ScriptedRng([4, 3])
    expect(thresholdCheck(first.rowsLost, first.extraRows, scripted).destroyed).toBe(true)
    expect(thresholdCheck(first.rowsLost, first.extraRows, scripted).destroyed).toBe(false)
    resolvePendingThreshold(target)
    expect(pendingThresholdCheck(target)).toBeNull()

    // "If the ship is fired on again and takes 3 more points of damage, the
    // third row will be crossed off, but since only one row was lost the
    // threshold check rolls will be as normal, 4+."
    expect(markHullBoxes(target, 3)).toEqual({ marked: 3, rowsCrossed: 1, destroyed: false })
    const second = pendingThresholdCheck(target)
    expect(second).toEqual({ rowsLost: 3, extraRows: 0 })
    expect(thresholdTarget(3)).toBe(4)
  })

  it('makes no check at the end of the last row, because the ship is gone', () => {
    const target = ship('b1', 'blue')
    markHullBoxes(target, 9)
    resolvePendingThreshold(target)

    expect(markHullBoxes(target, 5)).toEqual({ marked: 3, rowsCrossed: 1, destroyed: true })
    expect(target.destroyed).toBe(true)
    expect(pendingThresholdCheck(target)).toBeNull()
  })

  it('splits an uneven hull track with the longer rows first', () => {
    // The introductory cruiser has 26 damage points (4.12).
    const cruiser = ship('r1', 'red', { hullBoxes: 26, hullRows: 4 })
    expect(hullRowBoundaries(cruiser)).toEqual([7, 14, 20, 26])
  })

  it('resolves phase 10 damage at once but holds phase 11 and 12 for phase 13', () => {
    expect(thresholdResolution('ordnance-vs-ships')).toBe('immediate')
    expect(thresholdResolution('reactor-explosions')).toBe('immediate')
    expect(thresholdResolution('ship-fire')).toBe('deferred')
    expect(thresholdResolution('boarding')).toBe('deferred')

    const target = ship('b1', 'blue')
    const state = game({ ships: [ship('r1', 'red'), target] })

    advanceToPhase(state, 'ordnance-vs-ships')
    markHullBoxes(target, 3)
    expect(pendingThresholdCheck(target)).toEqual({ rowsLost: 1, extraRows: 0 })
    resolvePendingThreshold(target) // phase 10 rolls it there and then

    advanceToPhase(state, 'ship-fire')
    markHullBoxes(target, 3)
    advanceToPhase(state, 'boarding')
    expect(shipsAwaitingThreshold(state).map((s) => s.id)).toEqual(['b1'])

    advanceToPhase(state, 'threshold')
    expect(pendingThresholdCheck(target)).toEqual({ rowsLost: 2, extraRows: 0 })
    resolvePendingThreshold(target)
    expect(shipsAwaitingThreshold(state)).toEqual([])
  })

  it('halves the drive on the first threshold failure and disables it on the second', () => {
    const cruiser = ship('r1', 'red')
    expect(currentThrust(cruiser)).toBe(4)
    destroySystem(cruiser, 'drive')
    expect(currentThrust(cruiser)).toBe(2)
    destroySystem(cruiser, 'drive')
    expect(currentThrust(cruiser)).toBe(0)

    // "A drive rated only 1 is immediately disabled by the first threshold failure."
    const scout = ship('r2', 'red', { drive: { thrust: 1, advanced: false } })
    destroySystem(scout, 'drive')
    expect(currentThrust(scout)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Damage control (10.4)
// ---------------------------------------------------------------------------

describe('damage control and crew (10.4, 10.5)', () => {
  it('gives a warship a crew factor per 20 mass, and a civilian one per 50', () => {
    // "Military ships have one crew factor (CF) for every 20 mass or part
    // thereof... For merchant and civilian vessels... one CF per 50 mass (or
    // part thereof)" (10.4). "Part thereof" is the word that decides the
    // boundaries, so they are what is tested.
    expect(crewFactors(20)).toBe(1)
    expect(crewFactors(21)).toBe(2)
    expect(crewFactors(40)).toBe(2)
    expect(crewFactors(90)).toBe(5)
    expect(crewFactors(100)).toBe(5)
    expect(crewFactors(101)).toBe(6)
    expect(crewFactors(100, true)).toBe(2)
    expect(crewFactors(150, true)).toBe(3)
  })

  it('places the crew dots where the book\u2019s own example places them', () => {
    // 10.5 works it through: "The mass 90 ship above, with 5 CFs, has an
    // average hull integrity and thus has 27 hull boxes... Dividing 27 by 5
    // gives us 5.4, which is rounded up to 6. The first CF dot will be placed
    // in the sixth box... the fifth and final dot is placed in the last box on
    // the damage track (the 27th)."
    expect(crewFactorBoxes(27, 5)).toEqual([6, 12, 18, 24, 27])
  })

  it('loses a party for every crew dot the damage passes', () => {
    // This is what makes damage control a race: a ship that has been opened up
    // cannot repair as fast as one that has not.
    const cruiser = ship('r1', 'red') // mass 40, 12 boxes, 2 CF, dots at 6 and 12
    expect(damageControlParties(cruiser)).toBe(2)
    cruiser.hullMarked = 5
    expect(damageControlParties(cruiser), 'the sixth box is still there').toBe(2)
    cruiser.hullMarked = 6
    expect(damageControlParties(cruiser), 'first dot crossed off').toBe(1)
    cruiser.hullMarked = 12
    expect(damageControlParties(cruiser), 'the last crew go with the ship').toBe(0)
  })

  it('adds the parties a design actually bought on top of the crew', () => {
    // 13.13's "Additional Damage Control Parties" are the ones that cost 5
    // points; the rest come with the hull.
    const cruiser = ship('r1', 'red', { additionalDamageControlParties: 2 })
    expect(damageControlParties(cruiser)).toBe(4)
  })

  it('puts at most three parties on one system and never more than it has', () => {
    // "The maximum number of DCPs on a single job is three" (10.4). A mass-40
    // hull musters two of its own, so four bought makes six.
    const cruiser = ship('r1', 'red', { additionalDamageControlParties: 4 })
    expect(assignDamageControl(cruiser, 'fc1', 5)).toBe(3)
    expect(assignDamageControl(cruiser, 'pds1', 2)).toBe(2)
    expect(assignDamageControl(cruiser, 'beam-1', 3)).toBe(1)
    expect(assignDamageControl(cruiser, 'beam-2', 1)).toBe(0)
    expect(cruiser.damageControl).toEqual([
      { systemId: 'fc1', parties: 3 },
      { systemId: 'pds1', parties: 2 },
      { systemId: 'beam-1', parties: 1 },
    ])
  })

  it('loses a bought party when its SSD symbol is crossed off', () => {
    const cruiser = ship('r1', 'red', {
      systems: [system('dcp1', 'damage-control-party'), system('dcp2', 'damage-control-party')],
    })
    expect(damageControlParties(cruiser), 'two crew parties and two bought').toBe(4)
    destroySystem(cruiser, 'dcp1')
    expect(damageControlParties(cruiser)).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

describe('state helpers', () => {
  it('finds ships, sides and enemies', () => {
    const state = game()
    expect(shipById(state, 'r1')?.side).toBe('red')
    expect(shipById(state, 'nobody')).toBeUndefined()
    expect(sides(state).map((s) => s.id)).toEqual(['red', 'blue'])
    expect(enemiesOf(state, 'red').map((s) => s.id)).toEqual(['b1'])
    expect(enemiesOf(state, required(shipById(state, 'b1'), 'b1')).map((s) => s.id)).toEqual([
      'r1',
    ])
  })

  it('drops destroyed and departed ships out of play (2.4, 3.9)', () => {
    const state = game({ ships: [ship('r1', 'red'), ship('r2', 'red'), ship('b1', 'blue')] })
    required(shipById(state, 'r1'), 'r1').destroyed = true
    required(shipById(state, 'r2'), 'r2').offTable = true

    expect(activeShips(state).map((s) => s.id)).toEqual(['b1'])
    expect(enemiesOf(state, 'blue')).toEqual([])
  })

  it('treats sides on the same team as friends', () => {
    const state = createGame({
      seed: 3,
      sides: [
        { id: 'red', team: 'alliance' },
        { id: 'orange', team: 'alliance' },
        { id: 'blue', team: 'empire' },
      ],
      ships: [ship('r1', 'red'), ship('o1', 'orange'), ship('b1', 'blue')],
    })
    expect(enemiesOf(state, 'red').map((s) => s.id)).toEqual(['b1'])
    expect(enemiesOf(state, 'blue').map((s) => s.id)).toEqual(['r1', 'o1'])
  })

  it('expires an ongoing effect when its turn runs out', () => {
    const cruiser = ship('r1', 'red')
    const state = game({ ships: [cruiser, ship('b1', 'blue')] })
    cruiser.ongoing.push({
      id: 'emp-1',
      source: 'emp',
      appliedTurn: 1,
      expiresAfterTurn: 1,
      thrustPenalty: 2,
      note: 'EMP shutdown',
    })
    cruiser.ongoing.push({
      id: 'bridge',
      source: 'bridge',
      appliedTurn: 1,
      expiresAfterTurn: null,
      note: 'bridge wrecked',
    })
    expect(currentThrust(cruiser)).toBe(2)

    advanceToPhase(state, 'orders')
    expect(state.turn).toBe(2)
    expect(cruiser.ongoing.map((e) => e.id)).toEqual(['bridge'])
    expect(currentThrust(cruiser)).toBe(4)
  })
})

describe('the SSD as a mutable sheet (2.4)', () => {
  it('reports hull left, crossed-off systems and what is still working', () => {
    const cruiser = ship('r1', 'red', {
      systems: [system('pds1', 'pds'), system('pds2', 'pds'), system('fc1', 'firecon')],
    })
    expect(hullRemaining(cruiser)).toBe(12)
    expect(hullRowsCompleted(cruiser)).toBe(0)

    markHullBoxes(cruiser, 4)
    expect(hullRemaining(cruiser)).toBe(8)
    expect(hullRowsCompleted(cruiser)).toBe(1)

    destroySystem(cruiser, 'pds1')
    expect(isSystemDestroyed(cruiser, 'pds1')).toBe(true)
    expect(operationalSystems(cruiser, 'pds').map((s) => s.id)).toEqual(['pds2'])
  })

  it('keeps only groups that are in flight and still have fighters (8.13)', () => {
    const state = game()
    state.fighterGroups = [
      fighterGroup('alpha', 'red'),
      fighterGroup('beta', 'red', { status: 'aboard' }),
      fighterGroup('gamma', 'red', { strength: 0 }),
      fighterGroup('delta', 'blue'),
    ]
    expect(activeFighterGroups(state).map((g) => g.id)).toEqual(['alpha', 'delta'])
    expect(activeFighterGroups(state, 'red').map((g) => g.id)).toEqual(['alpha'])
    expect(fighterGroupById(state, 'delta')?.side).toBe('blue')
    expect(sideById(state, 'blue')?.team).toBe('blue')
  })

  it('lists the targets a ship is engaging this phase (5.2)', () => {
    const cruiser = ship('r1', 'red', {
      systems: [system('fc1', 'firecon'), system('fc2', 'firecon')],
    })
    assignFireCon(cruiser, 'enemy-a', 'launch-missiles')
    assignFireCon(cruiser, 'enemy-b', 'ship-fire')
    expect(engagedTargets(cruiser, 'ship-fire')).toEqual(['enemy-b'])
    expect(engagedTargets(cruiser, 'launch-missiles')).toEqual(['enemy-a'])
  })
})

// ---------------------------------------------------------------------------
// 2.6 — the log and what each side may read
// ---------------------------------------------------------------------------

describe('the battle log (2.6)', () => {
  it('stamps entries with the turn and phase and shows them to everyone by default', () => {
    const state = game()
    advanceToPhase(state, 'ship-fire')
    const entry = pushLog(state, { kind: 'fire', text: 'Beam-3 fires', shipId: 'r1' })

    expect(entry).toMatchObject({ turn: 1, phase: 'ship-fire', visibleTo: 'all' })
    expect(entry.seq).toBe(state.log.length)
    expect(logFor(state, 'blue')).toContain(entry)
  })

  it('keeps written orders to the side that wrote them (phase 1)', () => {
    const state = game()
    const secret = pushLog(state, {
      kind: 'orders',
      text: 'r1: 6S2+2: 8',
      side: 'red',
      visibleTo: ['red'],
    })
    expect(logFor(state, 'red')).toContain(secret)
    expect(logFor(state, 'blue')).not.toContain(secret)
  })
})

describe('information before orders (2.6)', () => {
  it('reports course and velocity as at the end of the last movement phase', () => {
    const scout = ship('r1', 'red')
    const state = game({ ships: [scout, ship('b1', 'blue')] })
    expect(lastKnownVector(scout)).toBeNull()

    advanceToPhase(state, 'move-ships')
    scout.placement.facing = 3
    scout.velocity = 10
    advancePhase(state)

    expect(lastKnownVector(scout)).toEqual({ course: 3, velocity: 10 })

    // A later move is not known until that movement phase ends.
    scout.velocity = 14
    expect(lastKnownVector(scout)).toEqual({ course: 3, velocity: 10 })
  })

  it('exempts a ship that was under cloak that turn', () => {
    const ghost = ship('r1', 'red')
    ghost.cloaked = true
    const state = game({ ships: [ghost, ship('b1', 'blue')] })

    advanceToPhase(state, 'move-ships')
    advancePhase(state)
    expect(lastKnownVector(ghost)).toBeNull()
  })
})
