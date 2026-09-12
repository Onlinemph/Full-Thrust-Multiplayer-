import { describe, expect, it } from 'vitest'

import { Rng } from './dice'
import {
  EXAMPLE_FACTIONS,
  FIGHTER_PACKAGE_COST,
  FIGHTER_PACKAGE_GRANT,
  RECOMMENDED_TECH_CHOICE_LIMIT,
  TECH_BY_CATEGORY,
  TECH_ENTRIES,
  TECH_IDS,
  UNIVERSAL_TECH,
  availableTech,
  emptyTechBase,
  isTechId,
  mayField,
  mayFieldSystem,
  mayFieldWeapon,
  missingPrerequisites,
  prerequisitesMet,
  techBaseCost,
  techBaseHeld,
  techChoiceCost,
  techEntry,
  usesFighters,
  usesGunboats,
  validateDesignAgainstTechBase,
  validateTechBase,
  type TechBase,
  type TechId,
} from './techbase'
import type { ShipDesign, SystemKind, WeaponClass } from './types'

/**
 * Section 15, checked against its own prose.
 *
 * There are no dice in section 15 — it is a design-time predicate, not a combat
 * rule — so the only use of `Rng` here is to prove that a tech base behaves as
 * the *set* it is: shuffling the order the choices were written down changes
 * nothing. Everything else guards a number a reader would assume they knew: the
 * four entries that cost more than one choice, the three prerequisites that run
 * backwards or sideways, and the one restriction the section actually enforces.
 */

function base(name: string, choices: TechId[], limit?: number): TechBase {
  return limit === undefined ? { name, choices } : { name, choices, limit }
}

const NOTHING = emptyTechBase('a fleet that has chosen nothing')

// ---------------------------------------------------------------------------

describe('the catalogue, as printed (15.1, 15.8)', () => {
  it('has the nine lists at the lengths the book prints', () => {
    expect(TECH_BY_CATEGORY.primary).toHaveLength(8)
    expect(TECH_BY_CATEGORY.defensive).toHaveLength(21)
    expect(TECH_BY_CATEGORY.targeting).toHaveLength(2)
    expect(TECH_BY_CATEGORY['direct-fire']).toHaveLength(25)
    expect(TECH_BY_CATEGORY.ordnance).toHaveLength(10)
    expect(TECH_BY_CATEGORY.spinal).toHaveLength(3)
    expect(TECH_BY_CATEGORY.fighters).toHaveLength(21)
    expect(TECH_BY_CATEGORY.gunboats).toHaveLength(22)
    expect(TECH_BY_CATEGORY.secondary).toHaveLength(11)
    expect(TECH_IDS).toHaveLength(123)
  })

  it('numbers each entry by its position in its own printed list', () => {
    for (const [, ids] of Object.entries(TECH_BY_CATEGORY)) {
      ids.forEach((id, i) => expect(techEntry(id).index).toBe(i + 1))
    }
  })

  it('names only real entries as prerequisites, and never itself', () => {
    for (const id of TECH_IDS) {
      for (const group of techEntry(id).prerequisites) {
        expect(group.length).toBeGreaterThan(0)
        for (const need of group) {
          expect(isTechId(need)).toBe(true)
          expect(need).not.toBe(id)
        }
      }
    }
  })

  it('charges nothing for a universal or bundled entry, and something for every other', () => {
    for (const id of TECH_IDS) {
      const entry = techEntry(id)
      if (entry.availability === 'choice') expect(entry.choices).toBeGreaterThan(0)
      else expect(entry.choices).toBe(0)
    }
  })

  /**
   * Four entries in the whole of section 15 cost more than one choice, and one
   * more costs three as a package. Getting any of them wrong is a silent
   * balance change, so they are pinned by name.
   */
  it('prices exactly five entries above one choice', () => {
    const dear = TECH_IDS.filter((id) => techChoiceCost(id) > 1)
    expect(dear.sort()).toEqual(
      [
        'advanced-screens',
        'area-screens',
        'armour-regenerative',
        'drive-advanced-gravity',
        'ecm',
        'fighter-multi-role',
        'fighter-package-deal',
        'pulser',
        'spinal-psp',
      ].sort(),
    )
    expect(techChoiceCost('drive-advanced-gravity')).toBe(3)
    expect(techChoiceCost('area-screens')).toBe(3)
    expect(techChoiceCost('fighter-multi-role')).toBe(3)
    expect(techChoiceCost('fighter-package-deal')).toBe(FIGHTER_PACKAGE_COST)
    expect(techChoiceCost('ecm')).toBe(2)
    expect(techChoiceCost('advanced-screens')).toBe(2)
    expect(techChoiceCost('armour-regenerative')).toBe(2)
    expect(techChoiceCost('pulser')).toBe(2)
    expect(techChoiceCost('spinal-psp')).toBe(2)
  })

  it('costs one choice for the other systems a reader might expect to be free', () => {
    // Turrets (5.22) are a technology; so is the launch tube catapult, while
    // the hangar bay and launch tube it sits on are not.
    expect(techChoiceCost('turrets')).toBe(1)
    expect(techChoiceCost('launch-tube-catapult')).toBe(1)
    expect(techChoiceCost('hangar-bay')).toBe(0)
    // ADFC is free; the PDS and ADS it directs are not.
    expect(techChoiceCost('adfc')).toBe(0)
    expect(techChoiceCost('advanced-adfc')).toBe(1)
    expect(techChoiceCost('pds')).toBe(1)
    expect(techChoiceCost('ads')).toBe(1)
    // Mines are free; the rack that lays them is not.
    expect(techChoiceCost('mines-standard')).toBe(0)
    expect(techChoiceCost('mine-rack')).toBe(1)
    // FTL is free; the advanced version is not.
    expect(techChoiceCost('ftl-drive')).toBe(0)
    expect(techChoiceCost('ftl-drive-advanced')).toBe(1)
  })
})

// ---------------------------------------------------------------------------

describe('a cost of zero means two different things (15, preamble) [reading]', () => {
  it('gives every empire the universal entries before it spends anything', () => {
    const held = techBaseHeld(NOTHING)
    for (const id of UNIVERSAL_TECH) expect(held.has(id)).toBe(true)
    // A representative spread across the lists.
    expect(held.has('firecon')).toBe(true)
    expect(held.has('adfc')).toBe(true)
    expect(held.has('hull-standard')).toBe(true)
    expect(held.has('drive-standard')).toBe(true)
    expect(held.has('ftl-drive')).toBe(true)
    expect(held.has('mines-standard')).toBe(true)
    expect(held.has('boat-bay')).toBe(true)
    expect(held.has('ortillery')).toBe(true)
    expect(held.has('weasel-emitter')).toBe(true)
  })

  it('gives it none of the bundled ones, which cost nothing but are not free', () => {
    const held = techBaseHeld(NOTHING)
    expect(held.has('area-ecm')).toBe(false)
    expect(held.has('salvo-missile-rack')).toBe(false)
    expect(held.has('meson-projector')).toBe(false)
    expect(held.has('fighter-interceptor')).toBe(false)
    expect(held.has('fighter-rack')).toBe(false)
    expect(held.has('gunboat-rack')).toBe(false)
    // Every one of them still costs nothing when it does arrive.
    for (const id of TECH_IDS) {
      if (techEntry(id).availability === 'bundled') expect(techChoiceCost(id)).toBe(0)
    }
  })

  it('hands a bundled entry over the moment its parent arrives, free', () => {
    const held = techBaseHeld(base('ew ship', ['ecm']))
    expect(held.has('area-ecm')).toBe(true)
    expect(techBaseCost(base('ew ship', ['ecm'])).gross).toBe(2)
  })

  it('resolves a bundled entry that gates on another bundled entry', () => {
    // 15.8's gunboat ECM "comes with ECM or Area ECM technology", and Area ECM
    // is itself bundled off ECM — so expansion has to be a fixpoint, not a pass.
    const held = techBaseHeld(base('ew gunboats', ['gunboat', 'ecm']))
    expect(held.has('area-ecm')).toBe(true)
    expect(held.has('gunboat-ecm')).toBe(true)
  })

  it('counts nine of the eleven secondary systems as free', () => {
    const free = TECH_BY_CATEGORY.secondary.filter((id) => techChoiceCost(id) === 0)
    expect(free).toHaveLength(9)
    expect(techChoiceCost('superior-sensors')).toBe(1)
    expect(techChoiceCost('minesweeper')).toBe(1)
  })
})

// ---------------------------------------------------------------------------

describe('prerequisites a reader gets backwards (15.1)', () => {
  it('gates the Scattergun on Grapeshot, though it is printed first', () => {
    expect(techEntry('scattergun').index).toBe(9)
    expect(techEntry('grapeshot').index).toBe(10)
    expect(prerequisitesMet('scattergun', techBaseHeld(base('x', ['grapeshot'])))).toBe(true)
    expect(prerequisitesMet('grapeshot', techBaseHeld(NOTHING))).toBe(true)
    expect(prerequisitesMet('scattergun', techBaseHeld(NOTHING))).toBe(false)
  })

  it('gates MKP on K-Guns, reaching from the Ordnance list into Direct fire', () => {
    expect(techEntry('mkp').category).toBe('ordnance')
    expect(techEntry('k-gun').category).toBe('direct-fire')
    expect(prerequisitesMet('mkp', techBaseHeld(NOTHING))).toBe(false)
    expect(prerequisitesMet('mkp', techBaseHeld(base('x', ['k-gun'])))).toBe(true)
  })

  it('needs both Beams and Grasers for a Phaser, not either', () => {
    expect(prerequisitesMet('phaser', techBaseHeld(base('x', ['beams-1-3'])))).toBe(false)
    expect(prerequisitesMet('phaser', techBaseHeld(base('x', ['beams-1-3', 'graser'])))).toBe(true)
    expect(missingPrerequisites('phaser', techBaseHeld(base('x', ['beams-1-3'])))).toEqual([
      ['graser'],
    ])
  })

  it('gives the Meson Projector away for either a Twin Particle Array or a Gatling', () => {
    expect(techBaseHeld(base('x', ['beams-1-3', 'gatling'])).has('meson-projector')).toBe(true)
    expect(
      techBaseHeld(base('x', ['beams-1-3', 'twin-particle-array'])).has('meson-projector'),
    ).toBe(true)
    expect(techBaseHeld(base('x', ['beams-1-3'])).has('meson-projector')).toBe(false)
  })

  it('lets an empire build regenerative armour without ever buying armour', () => {
    // As printed: Layered armour at 1 choice requires Armor; Regenerative at 2
    // requires nothing. Odd, but the text is not ambiguous, so it is not fixed.
    expect(techEntry('armour-regenerative').prerequisites).toEqual([])
    expect(techEntry('armour-layered').prerequisites).toEqual([['armour']])
    const regen = base('grown hulls', ['armour-regenerative'])
    expect(validateTechBase(regen).errors).toEqual([])
    expect(mayField(regen, { kind: 'armour', feature: 'regenerative' }).allowed).toBe(true)
    expect(mayField(regen, { kind: 'armour', feature: 'basic' }).allowed).toBe(false)
  })

  it('leaves Flak Ammo and Extended Range Salvo Missiles with no printed prerequisite', () => {
    // 5.16 gives flak only to "K-Guns of class 2 or larger" and ER missiles are
    // by name a salvo variant, but 15.1 prints no prerequisite for either.
    // Inventing one would be inventing a rule, so both stand as printed.
    expect(techEntry('flak-ammo').prerequisites).toEqual([])
    expect(techEntry('salvo-missile-extended').prerequisites).toEqual([])
    expect(validateTechBase(base('odd', ['flak-ammo', 'salvo-missile-extended'])).errors).toEqual([])
  })

  it('gates all three cloaks on Stealth Fields', () => {
    for (const cloak of ['cloaking-device', 'cloaking-field', 'tuffley-cloak'] as TechId[]) {
      expect(prerequisitesMet(cloak, techBaseHeld(NOTHING))).toBe(false)
      expect(prerequisitesMet(cloak, techBaseHeld(base('x', ['stealth-field'])))).toBe(true)
    }
  })

  it('gates ADS on PDS and Area Screens two deep on Advanced Screens', () => {
    expect(prerequisitesMet('ads', techBaseHeld(NOTHING))).toBe(false)
    expect(prerequisitesMet('ads', techBaseHeld(base('x', ['pds'])))).toBe(true)
    const full = base('fortress', ['screens', 'advanced-screens', 'area-screens'])
    expect(validateTechBase(full).errors).toEqual([])
    expect(techBaseCost(full).gross).toBe(6)
    expect(
      validateTechBase(base('gap', ['screens', 'area-screens'])).errors,
    ).toEqual(['Area Screens requires Advanced Screens (15.1)'])
  })
})

// ---------------------------------------------------------------------------

describe('"Beams is prerequisite" means Class 1-3 (15.1) [reading]', () => {
  it('satisfies every bare-Beams prerequisite with the class 1-3 entry alone', () => {
    const light = techBaseHeld(base('x', ['beams-1-3']))
    for (const id of ['graser', 'gatling', 'twin-particle-array', 'pulser', 'spinal-beam'] as TechId[]) {
      expect(prerequisitesMet(id, light)).toBe(true)
    }
  })

  it('will not sell class 4-6 without class 1-3', () => {
    expect(prerequisitesMet('beams-4-6', techBaseHeld(NOTHING))).toBe(false)
    expect(validateTechBase(base('heavy only', ['beams-4-6'])).errors).toEqual([
      'Beams, Class 4, 5 and 6 requires Beams, Class 1, 2 and 3 (15.1)',
    ])
  })

  it('routes a beam by its class to the entry that sells it', () => {
    const light = base('light beams', ['beams-1-3'])
    const heavy = base('all beams', ['beams-1-3', 'beams-4-6'])
    for (const rating of [1, 2, 3]) {
      expect(mayFieldWeapon(light, { weaponClass: 'beam', rating, variant: 'standard' }).allowed)
        .toBe(true)
    }
    for (const rating of [4, 5, 6]) {
      expect(mayFieldWeapon(light, { weaponClass: 'beam', rating, variant: 'standard' }).allowed)
        .toBe(false)
      expect(mayFieldWeapon(heavy, { weaponClass: 'beam', rating, variant: 'standard' }).allowed)
        .toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------

describe('weapon variants ride on their base entry (15.1)', () => {
  it('includes the short-range mountings in the pulse torpedo and K-Gun entries', () => {
    const pt = base('torpedoes', ['pulse-torpedo'])
    expect(mayFieldWeapon(pt, { weaponClass: 'pulse-torpedo', rating: 1, variant: 'standard' }).allowed).toBe(true)
    expect(mayFieldWeapon(pt, { weaponClass: 'pulse-torpedo', rating: 1, variant: 'short' }).allowed).toBe(true)
    expect(mayFieldWeapon(pt, { weaponClass: 'pulse-torpedo', rating: 1, variant: 'long' }).allowed).toBe(false)
    expect(mayFieldWeapon(pt, { weaponClass: 'pulse-torpedo', rating: 1, variant: 'variable' }).allowed).toBe(false)

    const kg = base('guns', ['k-gun'])
    expect(mayFieldWeapon(kg, { weaponClass: 'k-gun', rating: 2, variant: 'short' }).allowed).toBe(true)
    expect(mayFieldWeapon(kg, { weaponClass: 'k-gun', rating: 2, variant: 'long' }).allowed).toBe(false)
    expect(
      mayFieldWeapon(base('guns', ['k-gun', 'k-gun-long']), {
        weaponClass: 'k-gun',
        rating: 2,
        variant: 'long',
      }).allowed,
    ).toBe(true)
  })

  it('sells the extended-range round for both salvo mountings at once', () => {
    const sml = base('missiles', ['salvo-missile-launcher'])
    const er = base('missiles', ['salvo-missile-launcher', 'salvo-missile-extended'])
    // The rack comes bundled with the launcher.
    expect(techBaseHeld(sml).has('salvo-missile-rack')).toBe(true)
    for (const cls of ['salvo-missile-launcher', 'salvo-missile-rack'] as WeaponClass[]) {
      expect(mayFieldWeapon(sml, { weaponClass: cls, rating: 1, variant: 'extended' }).allowed).toBe(false)
      expect(mayFieldWeapon(er, { weaponClass: cls, rating: 1, variant: 'extended' }).allowed).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------

describe('15.8 Gunboats', () => {
  it('requires Gunboats for every armament and modification in the list', () => {
    for (const id of TECH_BY_CATEGORY.gunboats) {
      if (id === 'gunboat') continue
      const groups = techEntry(id).prerequisites
      expect(groups.some((g) => g.length === 1 && g[0] === 'gunboat')).toBe(true)
    }
  })

  it('will not hand a Beam Gunboat to an empire with beams but no gunboats', () => {
    expect(techBaseHeld(base('x', ['beams-1-3'])).has('gunboat-beam')).toBe(false)
    expect(techBaseHeld(base('x', ['beams-1-3', 'gunboat'])).has('gunboat-beam')).toBe(true)
  })

  it('gives the rack away with the gunboats and sells no bay at all', () => {
    const gb = base('boat navy', ['gunboat'])
    expect(mayFieldSystem(gb, 'gunboat-rack').allowed).toBe(true)
    const bay = mayFieldSystem(gb, 'gunboat-bay')
    expect(bay.allowed).toBe(false)
    expect(bay.wouldNeed).toEqual([])
    expect(bay.reason).toContain('no technology that grants this')
  })

  it('makes the Scatterpack Gunboat the dearest armament, through the Scattergun', () => {
    // 7.14: "Scatterguns (also known as Scatterpacks)" — and the Scattergun's
    // own prerequisite is Grapeshot, so the chain is three choices deep.
    expect(techEntry('gunboat-scatterpack').prerequisites).toEqual([['gunboat'], ['scattergun']])
    const short = base('half a chain', ['gunboat', 'scattergun'])
    expect(validateTechBase(short).errors).toEqual(['Scattergun requires Grapeshot (15.1)'])
    const full = base('scatter navy', ['gunboat', 'grapeshot', 'scattergun'])
    expect(validateTechBase(full).errors).toEqual([])
    expect(techBaseCost(full).gross).toBe(3)
    expect(mayField(full, { kind: 'gunboat', typeId: 'scatterpack' }).allowed).toBe(true)
  })

  it('takes either a Gatling or a Pulser for the Gatling/Pulser gunboat', () => {
    expect(
      techBaseHeld(base('x', ['gunboat', 'beams-1-3', 'gatling'])).has('gunboat-gatling'),
    ).toBe(true)
    expect(
      techBaseHeld(base('x', ['gunboat', 'beams-1-3', 'pulser'])).has('gunboat-gatling'),
    ).toBe(true)
    expect(techBaseHeld(base('x', ['gunboat', 'beams-1-3'])).has('gunboat-gatling')).toBe(false)
  })

  it('has no entry for the Point Defence Gunboat that 9.2 prices', () => {
    const gb = base('boat navy', ['gunboat', 'pds'])
    const verdict = mayField(gb, { kind: 'gunboat', typeId: 'point-defence' })
    expect(verdict.allowed).toBe(false)
    expect(verdict.wouldNeed).toEqual([])
  })

  it('catalogues the three armaments 15.8 names and nothing else does, with nothing to unlock', () => {
    for (const id of ['gunboat-emp', 'gunboat-gravitic', 'gunboat-boarding-torpedo'] as TechId[]) {
      expect(techEntry(id).unlocks).toEqual([])
      expect(techEntry(id).availability).toBe('bundled')
    }
  })
})

// ---------------------------------------------------------------------------

describe('"Gunboats may not be purchased if the Empire is using fighters" (15.8) [reading]', () => {
  const carrier = base('carrier fleet', ['beams-1-3', 'fighter-standard-beam'])
  const boats = base('boat fleet', ['beams-1-3', 'gunboat'])

  it('reads the exclusion off the whole tech base, both ways', () => {
    expect(usesFighters(carrier)).toBe(true)
    expect(usesGunboats(carrier)).toBe(false)
    expect(usesGunboats(boats)).toBe(true)
    expect(usesFighters(boats)).toBe(false)
  })

  it('quotes the heading when a fighter empire asks after a gunboat', () => {
    const verdict = mayField(carrier, { kind: 'gunboat', typeId: 'beam' })
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toContain('may not be purchased if the Empire is using fighters')
    expect(verdict.reason).toContain('15.8')
  })

  it('quotes it the other way round too', () => {
    const verdict = mayField(boats, { kind: 'fighter', typeId: 'standard' })
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toContain('may not be purchased if the Empire is using fighters')
  })

  it('errors on a tech base that holds both', () => {
    const both = base('greedy', ['beams-1-3', 'fighter-standard-beam', 'gunboat'])
    const report = validateTechBase(both)
    expect(report.legal).toBe(false)
    expect(report.errors.some((e) => e.includes('using fighters'))).toBe(true)
  })

  it('counts Assault Shuttles as fighters, because 15.1 files them there', () => {
    const shuttles = base('marines', ['assault-shuttle'])
    expect(usesFighters(shuttles)).toBe(true)
    expect(availableTech(shuttles)).not.toContain('gunboat')
  })

  it('hides the other list from availableTech', () => {
    expect(availableTech(carrier).some((id) => techEntry(id).category === 'gunboats')).toBe(false)
    expect(availableTech(boats).some((id) => techEntry(id).category === 'fighters')).toBe(false)
    // And offers the entries whose prerequisites are now met.
    expect(availableTech(base('x', ['beams-1-3']))).toContain('graser')
    expect(availableTech(base('x', ['beams-1-3']))).not.toContain('heavy-graser')
  })
})

// ---------------------------------------------------------------------------

describe('the budget (15, preamble)', () => {
  it('recommends ten and treats going over as a warning, never an error', () => {
    expect(RECOMMENDED_TECH_CHOICE_LIMIT).toBe(10)
    const greedy = base('twelve', [
      'beams-1-3',
      'beams-4-6',
      'graser',
      'heavy-graser',
      'pds',
      'ads',
      'screens',
      'advanced-screens',
      'ecm',
      'needle-beam',
      'turrets',
    ])
    const report = validateTechBase(greedy)
    expect(report.budget.spent).toBe(13)
    expect(report.budget.overBudget).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.legal).toBe(true)
    expect(report.warnings.some((w) => w.includes('no more than ten'))).toBe(true)
  })

  it('takes the limit from the tech base when the player group set one', () => {
    const fifteen = base('generous', ['ecm', 'area-screens', 'screens', 'advanced-screens'], 15)
    expect(techBaseCost(fifteen).limit).toBe(15)
    expect(techBaseCost(fifteen).overBudget).toBe(false)
  })

  it('warns rather than charges when a free entry is written down as a choice', () => {
    const report = validateTechBase(base('pedant', ['firecon', 'ecm', 'area-ecm']))
    expect(report.budget.gross).toBe(2)
    expect(report.errors).toEqual([])
    expect(report.warnings.some((w) => w.includes('Fire Control costs no choice'))).toBe(true)
    expect(report.warnings.some((w) => w.includes('Area ECM costs no choice'))).toBe(true)
  })

  it('does not charge twice for an entry listed twice', () => {
    expect(techBaseCost(base('x', ['ecm', 'ecm'])).gross).toBe(2)
    expect(validateTechBase(base('x', ['ecm', 'ecm'])).warnings.some((w) => w.includes('twice')))
      .toBe(true)
  })
})

// ---------------------------------------------------------------------------

describe('the Fighter Package Deal (15.1 Fighters #21) [reading]', () => {
  it('costs three and grants six', () => {
    expect(FIGHTER_PACKAGE_COST).toBe(3)
    expect(FIGHTER_PACKAGE_GRANT).toBe(6)
  })

  it('absorbs six choices of fighter technology and charges its own three', () => {
    const specialists = base('fighter specialists', [
      'beams-1-3',
      'fighter-package-deal',
      'fighter-standard-beam',
      'fighter-attack',
      'fighter-heavy',
      'fighter-fast',
      'fighter-long-range',
      'fighter-ftl',
    ])
    const budget = techBaseCost(specialists)
    // 1 beam + 3 package + 6 fighters = 10 gross; the package eats all six.
    expect(budget.gross).toBe(10)
    expect(budget.packageAllowance).toBe(6)
    expect(budget.packageUsed).toBe(6)
    expect(budget.spent).toBe(4)
    expect(budget.overBudget).toBe(false)
  })

  it('part-pays an entry too dear for what is left of the pool', () => {
    // Five 1-choice fighters plus Multi-Role at 3 is 8 of fighter tech: the
    // pool covers 6 and the main allowance picks up the other 2, whichever
    // entry the 2 is thought of as belonging to.
    const overflow = base('too many wings', [
      'beams-1-3',
      'fighter-package-deal',
      'fighter-standard-beam',
      'fighter-attack',
      'fighter-multi-role',
      'fighter-heavy',
      'fighter-fast',
      'fighter-long-range',
    ])
    const budget = techBaseCost(overflow)
    expect(budget.gross).toBe(12)
    expect(budget.packageUsed).toBe(6)
    expect(budget.spent).toBe(6)
  })

  it('does not let the pool pay for a prerequisite outside the Fighters list', () => {
    // A Torpedo Fighter needs Pulse Torpedoes, which is a Direct fire entry and
    // so is charged to the main allowance whatever the package covers.
    const budget = techBaseCost(
      base('torpedo wing', ['fighter-package-deal', 'pulse-torpedo', 'fighter-torpedo']),
    )
    expect(budget.gross).toBe(5)
    expect(budget.packageUsed).toBe(1)
    expect(budget.spent).toBe(4)
  })

  it('never absorbs its own three choices', () => {
    const budget = techBaseCost(base('package only', ['fighter-package-deal']))
    expect(budget.gross).toBe(FIGHTER_PACKAGE_COST)
    expect(budget.packageUsed).toBe(0)
    expect(budget.spent).toBe(FIGHTER_PACKAGE_COST)
  })
})

// ---------------------------------------------------------------------------

describe('15.2 Example Factions', () => {
  const nac = EXAMPLE_FACTIONS['new-anglian-confederation']
  const esu = EXAMPLE_FACTIONS['eurasian-solar-union']

  it('reproduces both printed tables, rows and TOTAL', () => {
    expect(nac.rows).toHaveLength(11)
    expect(nac.printedTotal).toBe(12)
    expect(nac.rows.reduce((n, r) => n + r.printedChoices, 0)).toBe(12)
    expect(esu.rows).toHaveLength(11)
    expect(esu.printedTotal).toBe(11)
    expect(esu.rows.reduce((n, r) => n + r.printedChoices, 0)).toBe(11)
    expect(esu.rows[1].printed).toBe('BEAM WEAPONS CLASS 4 AND 5')
  })

  it('recomputes the New Anglian Confederation at its printed 12', () => {
    const report = validateTechBase(nac.base)
    expect(report.budget.gross).toBe(12)
    expect(report.legal).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.warnings.some((w) => w.includes('printed TOTAL'))).toBe(false)
    expect(report.budget.overBudget).toBe(true)
  })

  it('recomputes the Eurasian Solar Union at 10, not its printed 11', () => {
    // The whole difference is the Interceptor, which 15.1 gives away with
    // either standard fighter and the faction table charges a choice for.
    const report = validateTechBase(esu.base)
    expect(report.budget.gross).toBe(10)
    expect(report.warnings.some((w) => w.includes('printed TOTAL is 11'))).toBe(true)
    expect(techEntry('fighter-interceptor').availability).toBe('bundled')
    expect(techChoiceCost('fighter-interceptor')).toBe(0)
    // Recomputed, it lands exactly on the recommended ten and does not warn.
    expect(report.budget.overBudget).toBe(false)
    expect(report.legal).toBe(true)
  })

  it('meets every prerequisite in both tables', () => {
    expect(validateTechBase(nac.base).errors).toEqual([])
    expect(validateTechBase(esu.base).errors).toEqual([])
    // The Interceptor still arrives, bundled off the Standard Beam fighter.
    expect(techBaseHeld(esu.base).has('fighter-interceptor')).toBe(true)
  })

  it('bars both factions from gunboats', () => {
    for (const f of [nac, esu]) {
      expect(usesFighters(f.base)).toBe(true)
      expect(mayField(f.base, { kind: 'gunboat' }).allowed).toBe(false)
      expect(availableTech(f.base)).not.toContain('gunboat')
    }
  })

  it('gives the New Anglian Confederation grasers and screens but no armour and no ECM', () => {
    expect(mayFieldWeapon(nac.base, { weaponClass: 'graser', rating: 2, variant: 'standard' }).allowed).toBe(true)
    expect(mayField(nac.base, { kind: 'screens', feature: 'advanced' }).allowed).toBe(true)
    expect(mayField(nac.base, { kind: 'armour', feature: 'basic' }).allowed).toBe(false)
    expect(mayFieldSystem(nac.base, 'ecm').allowed).toBe(false)
  })

  it('gives the Eurasian Solar Union a beam spinal mount and nothing else spinal', () => {
    expect(mayFieldWeapon(esu.base, { weaponClass: 'spinal-beam', rating: 3, variant: 'standard' }).allowed).toBe(true)
    expect(mayFieldWeapon(esu.base, { weaponClass: 'spinal-plasma', rating: 3, variant: 'standard' }).allowed).toBe(false)
    expect(mayFieldWeapon(esu.base, { weaponClass: 'spinal-psp', rating: 3, variant: 'standard' }).allowed).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('what section 15 does not sell, nobody can field', () => {
  /**
   * Each of these is modelled by the engine and named by no line of section 15,
   * so the honest answer is a flat refusal with an empty `wouldNeed` — not a
   * silent pass, and not a malformed-query error.
   */
  const everything: TechBase = base('an empire that bought the lot', [...TECH_IDS])

  it('refuses the two spinal mounts 15.1 omits, to every tech base', () => {
    for (const cls of ['nova-cannon', 'wave-gun'] as WeaponClass[]) {
      for (const b of [NOTHING, everything]) {
        const verdict = mayFieldWeapon(b, { weaponClass: cls, rating: 1, variant: 'standard' })
        expect(verdict.allowed).toBe(false)
        expect(verdict.wouldNeed).toEqual([])
        expect(verdict.reason).toContain('section 15 lists no technology')
      }
    }
  })

  it('refuses the systems 15.1 omits', () => {
    for (const system of ['reflex-field', 'dummy-bogey', 'tender', 'gunboat-bay'] as SystemKind[]) {
      expect(mayFieldSystem(everything, system).allowed).toBe(false)
      expect(mayFieldSystem(everything, system).wouldNeed).toEqual([])
    }
  })

  it('refuses the FTL tug and the two-stage missile', () => {
    expect(mayField(everything, { kind: 'ftl', ftl: 'tug' }).wouldNeed).toEqual([])
    expect(
      mayFieldWeapon(everything, {
        weaponClass: 'salvo-missile-launcher',
        rating: 1,
        variant: 'two-stage',
      }).allowed,
    ).toBe(false)
  })

  it('refuses the Light Fighter that 14.7 prices and 15.1 never lists', () => {
    const verdict = mayField(everything, { kind: 'fighter', modifier: 'light' })
    expect(verdict.allowed).toBe(false)
    expect(verdict.wouldNeed).toEqual([])
  })

  it('carries no unlock for the tech entries the engine has no home for', () => {
    for (const id of [
      'flak-ammo',
      'pulse-torpedo-overloaded',
      'fighter-emp',
      'fighter-needle',
      'fighter-rocket',
      'mines-standard',
      'fighter-package-deal',
    ] as TechId[]) {
      expect(techEntry(id).unlocks).toEqual([])
    }
  })

  it('still sells everything else in the engine that 15.1 does name', () => {
    // A sanity sweep: every entry with an unlock is grantable by the empire
    // that bought the lot.
    for (const id of TECH_IDS) {
      for (const unlock of techEntry(id).unlocks) {
        if (unlock.kind !== 'system') continue
        expect(mayFieldSystem(everything, unlock.system).allowed).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------

describe('mayField across the kinds of thing an SSD carries', () => {
  it('sells the standard hull rows to everyone and the three-row hull to nobody free', () => {
    for (const rows of [4, 5, 6] as const) {
      expect(mayField(NOTHING, { kind: 'hull-rows', rows }).allowed).toBe(true)
    }
    expect(mayField(NOTHING, { kind: 'hull-rows', rows: 3 }).allowed).toBe(false)
    expect(mayField(base('x', ['hull-advanced-3-row']), { kind: 'hull-rows', rows: 3 }).allowed)
      .toBe(true)
  })

  it('sells the standard drive and standard FTL to everyone', () => {
    expect(mayField(NOTHING, { kind: 'drive', advanced: false }).allowed).toBe(true)
    expect(mayField(NOTHING, { kind: 'drive', advanced: true }).allowed).toBe(false)
    expect(mayField(NOTHING, { kind: 'ftl', ftl: 'standard' }).allowed).toBe(true)
    expect(mayField(NOTHING, { kind: 'ftl', ftl: 'advanced' }).allowed).toBe(false)
  })

  it('answers a direct question about a tech id', () => {
    expect(mayField(base('x', ['ecm']), { kind: 'tech', tech: 'area-ecm' }).allowed).toBe(true)
    expect(mayField(NOTHING, { kind: 'tech', tech: 'area-ecm' }).allowed).toBe(false)
    expect(mayField(NOTHING, { kind: 'tech', tech: 'firecon' }).allowed).toBe(true)
  })

  it('needs both halves of a fighter query granted', () => {
    const beamsOnly = base('x', ['beams-1-3', 'fighter-standard-beam'])
    const withFast = base('x', ['beams-1-3', 'fighter-standard-beam', 'fighter-fast'])
    expect(mayField(beamsOnly, { kind: 'fighter', typeId: 'standard' }).allowed).toBe(true)
    expect(mayField(beamsOnly, { kind: 'fighter', typeId: 'standard', modifier: 'fast' }).allowed)
      .toBe(false)
    expect(mayField(withFast, { kind: 'fighter', typeId: 'standard', modifier: 'fast' }).allowed)
      .toBe(true)
  })

  it('answers the bare question — may this empire field gunboats at all?', () => {
    expect(mayField(NOTHING, { kind: 'gunboat' }).allowed).toBe(false)
    expect(mayField(base('x', ['gunboat']), { kind: 'gunboat' }).allowed).toBe(true)
    expect(mayField(NOTHING, { kind: 'fighter' }).allowed).toBe(false)
  })

  it('names what would be needed when the answer is no but the thing exists', () => {
    const verdict = mayFieldSystem(NOTHING, 'holofield')
    expect(verdict.allowed).toBe(false)
    expect(verdict.wouldNeed).toEqual(['holofield'])
    expect(verdict.reason).toContain('15.1 grants it with holofield')
  })

  it('reports both standard fighter entries as ways to the same type', () => {
    const verdict = mayField(NOTHING, { kind: 'fighter', typeId: 'standard' })
    expect(verdict.wouldNeed).toEqual(['fighter-standard-beam', 'fighter-standard-gun'])
  })
})

// ---------------------------------------------------------------------------

describe('checking a built ship against a tech base (15)', () => {
  function design(over: Partial<ShipDesign> = {}): ShipDesign {
    return {
      id: 'test',
      name: 'Test-class',
      faction: 'test',
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
      additionalDamageControlParties: 0,
      marineParties: 0,
      points: 100,
      ...over,
    }
  }

  it('passes a ship built from nothing but universal technology', () => {
    const ship = design({
      systems: [
        { id: 'fc1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
        { id: 'c1', kind: 'cargo', label: 'Cargo hold', mass: 4, points: 0 },
      ],
    })
    expect(validateDesignAgainstTechBase(NOTHING, ship)).toEqual([])
  })

  it('catches every system the tech base does not sell, and names the ship', () => {
    const ship = design({
      hullRows: 3,
      drive: { thrust: 6, advanced: true },
      ftl: 'advanced',
      armour: { layers: [4, 2], regenerative: true },
      screens: { level: 2, generators: 2, advanced: true },
      turrets: [{ id: 't1', arcs: ['F', 'FS'], capacity: 6, mass: 1, points: 3 }],
      weapons: [
        {
          id: 'w1',
          label: 'Class-4 Beam',
          weaponClass: 'beam',
          rating: 4,
          variant: 'standard',
          arcs: ['F'],
          mass: 4,
          points: 12,
        },
      ],
      systems: [{ id: 'p1', kind: 'pds', label: 'PDS', mass: 1, points: 3 }],
    })
    const problems = validateDesignAgainstTechBase(NOTHING, ship)
    expect(problems).toHaveLength(11)
    expect(problems.every((p) => p.startsWith('Test-class: '))).toBe(true)
    expect(problems.some((p) => p.includes('a 3-row hull'))).toBe(true)
    expect(problems.some((p) => p.includes('advanced gravity drive'))).toBe(true)
    expect(problems.some((p) => p.includes('advanced FTL drive'))).toBe(true)
    // Layered armour is a separate charge from the armour it is layered on.
    expect(problems.some((p) => p.startsWith('Test-class: armour —'))).toBe(true)
    expect(problems.some((p) => p.includes('layered or shell armour'))).toBe(true)
    expect(problems.some((p) => p.includes('defensive screens'))).toBe(true)
    expect(problems.some((p) => p.includes('regenerative armour'))).toBe(true)
    expect(problems.some((p) => p.includes('advanced screens'))).toBe(true)
    expect(problems.some((p) => p.includes('a turret'))).toBe(true)
    expect(problems.some((p) => p.includes('Class-4 Beam'))).toBe(true)
    expect(problems.some((p) => p.includes('PDS'))).toBe(true)
  })

  it('passes the same ship once the tech base has been paid for', () => {
    const rich = base('a very rich empire', [
      'hull-advanced-3-row',
      'drive-advanced-gravity',
      'ftl-drive-advanced',
      'armour',
      'armour-layered',
      'armour-regenerative',
      'screens',
      'advanced-screens',
      'turrets',
      'beams-1-3',
      'beams-4-6',
      'pds',
    ])
    const ship = design({
      hullRows: 3,
      drive: { thrust: 6, advanced: true },
      ftl: 'advanced',
      armour: { layers: [4, 2], regenerative: true },
      screens: { level: 2, generators: 2, advanced: true },
      turrets: [{ id: 't1', arcs: ['F', 'FS'], capacity: 6, mass: 1, points: 3 }],
      weapons: [
        {
          id: 'w1',
          label: 'Class-4 Beam',
          weaponClass: 'beam',
          rating: 4,
          variant: 'standard',
          arcs: ['F'],
          mass: 4,
          points: 12,
        },
      ],
      systems: [{ id: 'p1', kind: 'pds', label: 'PDS', mass: 1, points: 3 }],
    })
    expect(validateDesignAgainstTechBase(rich, ship)).toEqual([])
  })

  it('checks the small craft a hull carries against the same base', () => {
    const carrier = design({
      fighterBays: [{ typeId: 'graser', label: 'Graser fighter group' }],
      gunboats: [{ typeId: 'beam', label: 'Beam gunboat squadron' }],
    })
    const anglian = EXAMPLE_FACTIONS['new-anglian-confederation'].base
    const problems = validateDesignAgainstTechBase(anglian, carrier)
    // The Confederation has grasers and standard fighters but no Graser
    // Fighter, and 15.8 bars it from gunboats entirely.
    expect(problems).toHaveLength(2)
    expect(problems[1]).toContain('using fighters')
  })

  it('says nothing about hull class, core systems or streamlining, which 15 does not govern', () => {
    const exotic = design({
      hullClass: 'super',
      streamlining: 'full',
      coreSystems: { bridge: true, lifeSupport: true, powerCore: true },
      flawed: true,
    })
    expect(validateDesignAgainstTechBase(NOTHING, exotic)).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('purity', () => {
  it('never mutates the tech base it is handed', () => {
    const original = base('untouched', ['beams-1-3', 'graser', 'ecm'])
    const snapshot = JSON.stringify(original)
    techBaseHeld(original)
    techBaseCost(original)
    validateTechBase(original)
    availableTech(original)
    mayFieldSystem(original, 'ecm')
    expect(JSON.stringify(original)).toBe(snapshot)
  })

  it('never mutates the design it is handed', () => {
    const ship: ShipDesign = {
      id: 't',
      name: 'T',
      faction: 'f',
      group: 'escort',
      mass: 20,
      hullClass: 'weak',
      hullRows: 4,
      hullBoxes: 4,
      drive: { thrust: 6, advanced: true },
      ftl: 'none',
      streamlining: 'none',
      armour: { layers: [1], regenerative: false },
      screens: { level: 1, generators: 1, advanced: false },
      weapons: [],
      turrets: [],
      systems: [],
      fighterBays: [],
      gunboats: [],
      additionalDamageControlParties: 0,
      marineParties: 0,
      points: 30,
    }
    const snapshot = JSON.stringify(ship)
    validateDesignAgainstTechBase(NOTHING, ship)
    expect(JSON.stringify(ship)).toBe(snapshot)
  })

  it('treats a tech base as a set: the order the choices were written is nothing', () => {
    // The only place a die belongs in section 15 — shuffling the written order
    // with a seeded Rng so the property is checked against real permutations
    // rather than one hand-picked reordering.
    const choices: TechId[] = [
      'beams-1-3',
      'beams-4-6',
      'graser',
      'phaser',
      'screens',
      'advanced-screens',
      'grapeshot',
      'scattergun',
      'pds',
      'ads',
    ]
    const straight = validateTechBase(base('in order', choices))
    for (let seed = 1; seed <= 8; seed++) {
      const rng = new Rng(seed)
      const shuffled = rng.shuffle([...choices])
      const report = validateTechBase(base('in order', shuffled))
      expect(report.budget).toEqual(straight.budget)
      expect(report.held).toEqual(straight.held)
      expect(report.errors).toEqual(straight.errors)
      expect(report.legal).toBe(true)
    }
  })

  it('reports held technology in the book\'s printed order, not the order written', () => {
    const held = validateTechBase(base('x', ['graser', 'beams-1-3'])).held
    const printedOrder = TECH_IDS.filter((id) => held.includes(id))
    expect(held).toEqual(printedOrder)
    expect(held.indexOf('beams-1-3')).toBeLessThan(held.indexOf('graser'))
  })
})

// ---------------------------------------------------------------------------

describe('guards on data crossing a wire', () => {
  it('recognises every printed id and nothing else', () => {
    expect(isTechId('beams-1-3')).toBe(true)
    expect(isTechId('gunboat-scatterpack')).toBe(true)
    expect(isTechId('beams-4-5')).toBe(false)
    expect(isTechId('toString')).toBe(false)
  })

  it('errors on an id that is not in 15.1 or 15.8', () => {
    const report = validateTechBase({
      name: 'typo',
      choices: ['beams-1-3', 'beams-4-5' as TechId],
    })
    expect(report.legal).toBe(false)
    expect(report.errors[0]).toContain('"beams-4-5" is not an entry')
  })

  it('accepts a bare list of ids wherever a tech base is taken', () => {
    expect(usesGunboats(['gunboat'])).toBe(true)
    expect(mayFieldSystem(['pds'], 'pds').allowed).toBe(true)
    expect(techBaseHeld(['ecm']).has('area-ecm')).toBe(true)
  })

  it('keeps TECH_ENTRIES and TECH_IDS in step', () => {
    expect(new Set(TECH_IDS).size).toBe(TECH_IDS.length)
    for (const id of TECH_IDS) expect(TECH_ENTRIES[id].id).toBe(id)
  })
})
