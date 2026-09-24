/**
 * Chapter 25's sample forces (pp. 67–69): headcounts and weapon fits
 * against the book's own printed organisation tables, and the
 * template-to-`UnitSetup` builders.
 */

import { describe, expect, it } from 'vitest'
import { SMALL_ARMS, SUPPORT_WEAPONS } from './weapons'
import { ESU, FSE, NAC, NSL, sideFromForce, standardPlatoon } from './forces'

describe('New Anglian Confederation (p. 67)', () => {
  it('gives the Platoon Command Unit and Infantry Squad the book’s own headcounts', () => {
    expect(NAC.platoonCommand.figures).toHaveLength(8)
    expect(NAC.squad.figures).toHaveLength(8)
    expect(NAC.squadCount).toBe(3)
  })

  it('arms the L7A3 as an exact match to the generic Advanced Assault Rifle (GL)', () => {
    const profile = SMALL_ARMS[NAC.squad.figures[0]!.smallArm]
    expect(profile).toMatchObject({ firepower: 3, impact: 10 })
  })

  it('gives the L5 SAW gunner and the Plasma Gun trooper their book’s own support weapons', () => {
    const saw = NAC.squad.figures.find((f) => f.name.includes('SAW'))!
    const plasma = NAC.squad.figures.find((f) => f.name.includes('Plasma'))!
    expect(SUPPORT_WEAPONS[saw.supportWeapon!]).toMatchObject({ firepowerDie: 8, impact: 10 })
    expect(SUPPORT_WEAPONS[plasma.supportWeapon!]).toMatchObject({ firepowerDie: 6, impact: 12, doubleVsPoint: true })
  })
})

describe('Neu Swabian League (p. 68)', () => {
  it('gives the Platoon Command Unit and Infantry Squad the book’s own headcounts', () => {
    expect(NSL.platoonCommand.figures).toHaveLength(6)
    expect(NSL.squad.figures).toHaveLength(6)
    expect(NSL.squadCount).toBe(3)
  })

  it('exactly one figure per unit is marked leader', () => {
    for (const template of [NSL.platoonCommand, NSL.squad]) {
      expect(template.figures.filter((f) => f.leader).length).toBe(1)
    }
  })
})

describe('Eurasian Solar Union (p. 69)', () => {
  it('gives the Platoon Command Unit and Infantry Squad the book’s own headcounts', () => {
    expect(ESU.platoonCommand.figures).toHaveLength(8)
    expect(ESU.squad.figures).toHaveLength(8)
    expect(ESU.squadCount).toBe(3)
  })

  it('arms KI-72 as an exact match to the generic Advanced Assault Rifle (no GL)', () => {
    const profile = SMALL_ARMS[ESU.squad.figures[0]!.smallArm]
    expect(profile).toMatchObject({ firepower: 2, impact: 10 })
  })
})

describe('Federal Stats Europa (p. 69, printed exactly this way)', () => {
  it('gives the Platoon Command Unit and Infantry Squad the book’s own headcounts, and four squads (one more than the other nations)', () => {
    expect(FSE.platoonCommand.figures).toHaveLength(8)
    expect(FSE.squad.figures).toHaveLength(8)
    expect(FSE.squadCount).toBe(4)
  })

  it('arms FA-75 as an exact match to the generic Gauss Rifle (no GL)', () => {
    const profile = SMALL_ARMS[FSE.squad.figures[0]!.smallArm]
    expect(profile).toMatchObject({ firepower: 2, impact: 12 })
  })
})

describe('building a UnitSetup/SideSetup from a template', () => {
  it('builds a standard platoon of the HQ plus its squads, with unique ids and the HQ as commander', () => {
    const units = standardPlatoon(NAC, 'north', { quality: 'regular', hqLeadership: 1, squadLeadership: 2 })
    expect(units).toHaveLength(1 + NAC.squadCount)
    const [hq, ...squads] = units
    expect(hq!.id).toBe('north-hq')
    expect(hq!.commandLevel).toBe('platoon')
    expect(hq!.commanderId).toBeUndefined()
    for (const squad of squads) {
      expect(squad.commandLevel).toBe('squad')
      expect(squad.commanderId).toBe('north-hq')
    }
    const ids = units.flatMap((u) => u.figures.map((f) => f.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('carries the force’s armour and mobility onto every unit', () => {
    const units = standardPlatoon(NSL, 'south', { quality: 'regular', hqLeadership: 1, squadLeadership: 2 })
    for (const unit of units) {
      expect(unit.armour).toBe(NSL.armour)
      expect(unit.mobility).toBe(NSL.mobility)
    }
  })

  it('marks exactly one figure per built unit as leader', () => {
    const units = standardPlatoon(ESU, 'north', { quality: 'veteran', hqLeadership: 1, squadLeadership: 2 })
    for (const unit of units) {
      expect(unit.figures.filter((f) => f.leader).length).toBe(1)
    }
  })

  it('builds a full SideSetup with a name and the platoon’s units', () => {
    const side = sideFromForce(NAC, 'north', { quality: 'regular', hqLeadership: 1, squadLeadership: 2, motivation: 'medium' })
    expect(side.id).toBe('north')
    expect(side.motivation).toBe('medium')
    expect(side.units).toHaveLength(1 + NAC.squadCount)
  })
})
