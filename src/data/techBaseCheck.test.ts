import { describe, expect, it } from 'vitest'

import {
  canField,
  checkFleetTechBase,
  designProblems,
  techBaseFor,
  TECH_BASE_OPTIONS,
} from './techBaseCheck'
import { allDesigns, designById } from './ships'
import { EXAMPLE_FACTIONS } from '../engine/techbase'

/**
 * Section 15 where a player meets it.
 *
 * `techbase.test.ts` checks the section; this checks the fold a fleet picker
 * needs, and it pins the awkward truth about the roster: neither of the
 * rulebook's two example tech bases buys armour, and every generated design
 * carries some. That is why the tech base is advisory and why it is a choice
 * per side rather than a property of a faction name.
 */

describe('a side with no tech base', () => {
  it('may field anything', () => {
    for (const design of allDesigns()) {
      expect(designProblems('unrestricted', design), design.id).toEqual([])
      expect(designProblems(undefined, design), design.id).toEqual([])
    }
  })

  it('is the default, and it is the first option offered', () => {
    expect(TECH_BASE_OPTIONS[0]?.id).toBe('unrestricted')
    expect(techBaseFor(undefined)).toBeNull()
    expect(checkFleetTechBase(undefined, allDesigns()).legal).toBe(true)
  })
})

describe('the two example tech bases (15.2)', () => {
  it('are legal tech bases in their own right', () => {
    for (const id of ['new-anglian-confederation', 'eurasian-solar-union'] as const) {
      const report = checkFleetTechBase(id, [])
      expect(report.baseErrors, id).toEqual([])
      expect(report.baseName).toBe(EXAMPLE_FACTIONS[id].name)
    }
  })

  it('cannot build a single ship in this roster, and the reason is armour', () => {
    // Neither faction's eleven or twelve choices includes armour, and every
    // generated design carries a layer of it. This is a fact about the roster,
    // not a bug in the check — and it is the whole reason enforcement is
    // advisory. If this test ever goes green, the roster has been rebuilt to
    // 15.2 and the fleet picker can start refusing things.
    const report = checkFleetTechBase('new-anglian-confederation', allDesigns())
    expect(report.legal).toBe(false)
    expect(report.designs.length).toBeGreaterThan(0)
    const armour = report.designs.filter((d) => d.problems.some((p) => p.includes('armour')))
    expect(armour.length, 'armour is the common cause').toBeGreaterThan(0)
  })

  it('refuses what the other one bought', () => {
    // The Eurasians bought a beam spinal mount and no grasers; the New Anglians
    // bought grasers and no spinal mount. A cross-check proves the fold is
    // reading the base rather than passing everything.
    const esuOnly = designProblems('new-anglian-confederation', {
      ...(designById('esu-frigate') as NonNullable<ReturnType<typeof designById>>),
      armour: { layers: [], regenerative: false },
      screens: { level: 0, generators: 0, advanced: false },
    })
    expect(esuOnly.some((p) => p.toLowerCase().includes('k-gun'))).toBe(true)
  })

  it('reports one line per ship however many copies the fleet holds', () => {
    const one = designById('nac-heavy-cruiser')
    expect(one).toBeDefined()
    const report = checkFleetTechBase('eurasian-solar-union', [one!, one!, one!])
    expect(report.designs.length).toBe(1)
  })
})

describe('what no tech base can ever buy', () => {
  it('is reported as a fact about section 15, not about the player', () => {
    // 15.1 lists no nova cannon, no wave gun and no reflex field, so
    // `mayField` refuses them to every base that could ever exist. A player who
    // reads "you did not buy this" will go looking for the choice that unlocks
    // it and never find one.
    const base = techBaseFor('new-anglian-confederation')
    expect(base).not.toBeNull()
    const design = designById('nac-heavy-cruiser')
    expect(design).toBeDefined()
    const impossible = {
      ...design!,
      weapons: [
        {
          id: 'nova',
          label: 'Nova Cannon',
          weaponClass: 'nova-cannon' as const,
          rating: 1,
          variant: 'standard' as const,
          arcs: ['F' as const],
          mass: 20,
          points: 60,
        },
      ],
    }
    const problems = designProblems('new-anglian-confederation', impossible)
    expect(problems.some((p) => p.includes('no tech base can'))).toBe(true)
  })
})

describe('canField', () => {
  it('agrees with the problem list', () => {
    for (const design of allDesigns().slice(0, 6)) {
      expect(canField('eurasian-solar-union', design)).toBe(
        designProblems('eurasian-solar-union', design).length === 0,
      )
    }
  })
})
