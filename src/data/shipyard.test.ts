import { beforeEach, describe, expect, it } from 'vitest'

import { deleteDesign, reloadShipyard, saveDesign, savedDesigns } from './shipyard'
import { allDesigns, designById, SHIP_DESIGNS } from './ships'
import { withEmbedded } from './savedGame'
import type { ShipDesign } from '../engine/types'

/**
 * The player's own yard.
 *
 * The thing worth testing is not storage — it is that a home-built hull is a
 * real ship: it reaches the fleet picker, it resolves by id, and a battle that
 * uses it carries its own copy so the save opens on a machine that has never
 * seen the design. A shipyard that fails any of those is a calculator with a
 * download button.
 */

function hull(id: string, name = 'Home Build'): ShipDesign {
  return {
    id,
    name,
    faction: 'Custom',
    group: 'cruiser',
    mass: 60,
    hullClass: 'average',
    hullRows: 4,
    hullBoxes: 18,
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
    damageControlParties: 1,
    marineParties: 0,
    points: 120,
  }
}

/**
 * The tests run under Vitest's `node` environment, which has no localStorage.
 * A stub rather than jsdom: the yard's whole contract with storage is
 * get/set/clear, and the module already treats a throwing store as an empty
 * yard, which the last two cases here exercise.
 */
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size
      },
    },
  })
  reloadShipyard()
})

describe('the shipyard', () => {
  it('keeps a design and hands it back', () => {
    saveDesign(hull('home-1'))
    expect(savedDesigns().map((d) => d.id)).toEqual(['home-1'])
  })

  it('replaces a design of the same id rather than piling up copies', () => {
    saveDesign(hull('home-1', 'First'))
    saveDesign(hull('home-1', 'Second'))
    expect(savedDesigns()).toHaveLength(1)
    expect(savedDesigns()[0].name).toBe('Second')
  })

  it('stores a copy, so editing the design afterwards does not edit the yard', () => {
    const design = hull('home-1')
    saveDesign(design)
    design.name = 'Renamed after saving'
    expect(savedDesigns()[0].name).toBe('Home Build')
  })

  it('puts the design in the fleet picker and resolves it by id', () => {
    saveDesign(hull('home-1'))
    expect(allDesigns().map((d) => d.id)).toContain('home-1')
    expect(designById('home-1')?.name).toBe('Home Build')
  })

  it('never shadows a shipped design', () => {
    // The roster is shared vocabulary: `esu-frigate` has to mean the same hull
    // in every copy of the game, or two people reading one battle file are
    // reading different battles.
    const canon = SHIP_DESIGNS[0]
    saveDesign({ ...hull(canon.id), name: 'Impostor' })
    const listed = allDesigns().filter((d) => d.id === canon.id)
    expect(listed).toHaveLength(1)
    expect(listed[0].name).toBe(canon.name)
    expect(designById(canon.id)?.name).toBe(canon.name)
  })

  it('rides inside the battle that uses it', () => {
    saveDesign(hull('home-1'))
    const setup = withEmbedded({
      scenarioId: 'border-skirmish',
      seed: 1,
      forces: { a: ['home-1'] },
    })
    expect(setup.customDesigns?.map((d) => d.id)).toContain('home-1')
    // And the copy is a copy: deleting it from the yard leaves the battle able
    // to replay.
    deleteDesign('home-1')
    expect(savedDesigns()).toHaveLength(0)
    expect(setup.customDesigns?.[0].name).toBe('Home Build')
  })

  it('survives storage it cannot read', () => {
    localStorage.setItem('full-thrust.shipyard.v1', 'not json at all')
    reloadShipyard()
    expect(savedDesigns()).toEqual([])
  })

  it('drops entries that are not designs rather than crashing the yard', () => {
    localStorage.setItem('full-thrust.shipyard.v1', JSON.stringify([{ nope: true }, hull('ok')]))
    reloadShipyard()
    expect(savedDesigns().map((d) => d.id)).toEqual(['ok'])
  })
})
