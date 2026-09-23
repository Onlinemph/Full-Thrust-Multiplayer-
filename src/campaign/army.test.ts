/**
 * Ground units in the campaign: priced from Dirtside's points (pp. 52–53)
 * with interface landing at 25% (p. 43), a command marker drawn from the
 * counter sheet (p. 21), carried at More Thrust's cargo space (p. 15),
 * brought down in craft to fight landings, and carrying experience and
 * replacements between battles as Stargrunt's campaign chapter has it
 * (pp. 60–61).
 */

import { describe, expect, it } from 'vitest'
import { aiPlay } from '../dirtside/table/ai'
import { bookExample } from '../dirtside/data/examples'
import { validateSetup } from '../dirtside/table/setupCheck'
import { designById } from '../data/ships'
import type { VehicleDesign } from '../dirtside/types'
import { COMMAND_MARKERS, drawCommandMarker, earnQuality, elementCs, holdCs, orderElements, orderPrice, orderRefusal, replacementCheck, unitCs, type GroundUnit, type GroundUnitOrder } from './army'
import { applyMove, colonyById, createCampaign, holdSpaceLeft, journalEntry, lostWithShips, taskForceById } from './campaign'
import { generateStarMap, systemAt } from './map'
import { CAMPAIGN_BANNED_SYSTEMS } from './turn'
import type { CampaignJournalEntry, CampaignMove, CampaignSetup, CampaignState, Hex, StarMap } from './types'

const mbt = bookExample('book-mbt')!
const micv = bookExample('book-micv')!
const tanks = (patch: Partial<GroundUnitOrder> = {}): GroundUnitOrder => ({ name: 'A Company', vehicle: mbt, count: 3, interfaceLanding: false, ...patch })
const riflemen = (patch: Partial<GroundUnitOrder> = {}): GroundUnitOrder => ({ name: 'B Company', infantry: { troops: 'line', teams: ['rifle', 'rifle', 'rifle', 'apsw', 'anti-armour'] }, interfaceLanding: false, ...patch })

const unitOf = (order: GroundUnitOrder, patch: Partial<GroundUnit> = {}): GroundUnit => ({
  id: 'u1',
  owner: 'terra',
  name: order.name,
  quality: 'regular',
  leadership: 2,
  elements: orderElements(order),
  interfaceLanding: order.interfaceLanding,
  at: { colony: 'c1' },
  qualityPoints: 0,
  battles: 0,
  ...patch,
})

describe('raising a unit', () => {
  it('prices it at one RP a Dirtside point, a quarter more on each element for landing from orbit (pp. 43, 52)', () => {
    expect(orderPrice(tanks())).toBe(3 * 172)
    expect(orderPrice(tanks({ interfaceLanding: true }))).toBe(3 * 215)
    // Line: rifle 20, APSW 30, basic anti-armour 40.
    expect(orderPrice(riflemen())).toBe(130)
    expect(orderPrice(riflemen({ interfaceLanding: true }))).toBe(3 * 25 + 38 + 50)
  })

  it('refuses an unnamed unit, an empty one, one too big, a faulty design and aircraft, and takes the book’s designs as printed', () => {
    expect(orderRefusal(tanks({ name: ' ' }))).toMatch(/Name/)
    expect(orderRefusal(tanks({ count: 0 }))).toMatch(/at least one/)
    expect(orderRefusal(tanks({ count: 9 }))).toMatch(/at most 8/)
    const faulty: VehicleDesign = { ...mbt, id: 'custom-1', weapons: [{ id: 'w1', type: 'hkp', class: 5, mount: 'turret', barrels: 1 }] }
    expect(orderRefusal(tanks({ vehicle: faulty }))).toMatch(/Dirtside p\./)
    // The book's Light MICV breaks p. 10 as printed, and is kept as printed.
    expect(orderRefusal(tanks({ vehicle: micv }))).toBeNull()
    expect(orderRefusal(tanks({ vehicle: bookExample('book-fighter')! }))).toMatch(/Aircraft/)
    expect(orderRefusal(riflemen())).toBeNull()
  })

  it('draws its command marker from the counter sheet: blue 9-12-9, green and orange 5-8-5 (p. 21)', () => {
    const counts: Record<string, number> = {}
    const rng = { seed: 7, cursor: 0 }
    for (let i = 0; i < 6600; i++) {
      const m = drawCommandMarker(rng)
      counts[`${m.quality}${m.leadership}`] = (counts[`${m.quality}${m.leadership}`] ?? 0) + 1
    }
    const total = Object.values(COMMAND_MARKERS).flat().reduce((a, b) => a + b, 0)
    expect(total).toBe(66)
    for (const [quality, row] of Object.entries(COMMAND_MARKERS)) row.forEach((n, i) => expect(Math.abs((counts[`${quality}${i + 1}`] ?? 0) / 6600 - n / 66)).toBeLessThan(0.02))
  })
})

describe('cargo space (More Thrust p. 15)', () => {
  it('takes a vehicle at its size × 4 and its crew, a team at four men', () => {
    // The book's Medium Battle Tank: 12 and four crew at 4 = 28; its size-2 command vehicle, two crew: 16.
    expect(elementCs({ vehicle: mbt })).toBe(28)
    expect(elementCs({ vehicle: { ...mbt, size: 2 } })).toBe(16)
    expect(elementCs({ infantry: { troops: 'powered', team: 'rifle' } })).toBe(16)
    expect(unitCs(unitOf(tanks()))).toBe(84)
    const hurt = unitOf(tanks())
    hurt.elements[0]!.lost = true
    expect(unitCs(hurt)).toBe(56)
  })

  it('gives a ship 50 CS a mass of cargo or troop berthing', () => {
    expect(holdCs(designById('samc-liner')!)).toBe(1000)
    expect(holdCs(designById('nac-corvette')!)).toBe(50)
    expect(holdCs(designById('intro-heavy-cruiser')!)).toBe(0)
  })
})

describe('experience and replacements (Stargrunt pp. 60–61)', () => {
  it('rises a level at 5 points from green and at 8 from regular, counted from the start', () => {
    const green = unitOf(tanks(), { quality: 'green' })
    expect(earnQuality(green, 3)).toBe('green')
    expect(earnQuality(green, 3)).toBe('regular')
    expect(earnQuality(green, 3)).toBe('veteran')
    expect(green.battles).toBe(3)
    const regular = unitOf(tanks())
    expect(earnQuality(regular, 4)).toBe('regular')
    expect(earnQuality(regular, 4)).toBe('veteran')
  })

  it('rolls the die nearest the unit’s strength, dropping a level on a roll no higher than the replacements', () => {
    let dropped = 0
    let kept = 0
    for (let seed = 1; seed <= 400; seed++) {
      const unit = unitOf(riflemen(), { quality: 'veteran', qualityPoints: 9 })
      unit.elements[0]!.lost = true
      unit.elements[1]!.lost = true
      const check = replacementCheck(unit, { seed, cursor: 0 })!
      // Three left: a D4, and two replacements drop it on a 1 or 2.
      expect(check.die).toBe(4)
      expect(check.dropped).toBe(check.roll <= 2)
      expect(unit.elements.every((e) => !e.lost)).toBe(true)
      if (check.dropped) {
        dropped += 1
        expect(unit.quality).toBe('regular')
        expect(unit.qualityPoints).toBe(0)
      } else kept += 1
    }
    expect(dropped / 400).toBeGreaterThan(0.4)
    expect(kept / 400).toBeGreaterThan(0.4)
    const green = unitOf(riflemen(), { quality: 'green' })
    for (const el of green.elements) el.lost = true
    green.elements[0]!.lost = false
    expect(replacementCheck(green, { seed: 1, cursor: 0 })!.dropped).toBe(false)
    expect(green.quality).toBe('green')
  })
})

// ---------------------------------------------------------------------------
// In a campaign
// ---------------------------------------------------------------------------

const hex = (q: number, r: number): Hex => ({ q, r })
const STARS = [hex(0, 0), hex(2, 0), hex(0, 2), hex(-2, 1), hex(3, -2)]

function plainHome(map: StarMap, at: Hex): boolean {
  const system = systemAt(map, at)
  const home = system?.bodies.find((b) => b.type === 'terran')
  return !!system && system.feature === 'standard' && home !== undefined && home.trait === 'none'
}

const SEED = (() => {
  for (let seed = 1; seed < 200_000; seed++) {
    const map = generateStarMap({ seed, cursor: 0 }, { starHexes: [...STARS], radius: 4 })
    if (plainHome(map, hex(0, 0)) && plainHome(map, hex(2, 0))) return seed
  }
  throw new Error('no seed')
})()

function campaign(rulesVersion = 2): CampaignSetup {
  return {
    seed: SEED,
    rulesVersion,
    starHexes: STARS,
    radius: 4,
    players: [
      { id: 'terra', name: 'Terra', faction: 'New Anglian Confederation', home: hex(0, 0), startingShips: [{ designId: 'intro-heavy-cruiser', name: 'Endeavour' }, { designId: 'samc-liner', name: 'Cape Town' }, { designId: 'nac-corvette', name: 'Kestrel' }], startingTransports: 0 },
      { id: 'esu', name: 'Eurasia', faction: 'Eurasian Solar Union', home: hex(2, 0), startingShips: [{ designId: 'intro-frigate', name: 'Storozhevoy' }], startingTransports: 0 },
    ],
    bannedSystems: [...CAMPAIGN_BANNED_SYSTEMS],
  }
}

class Console {
  readonly state: CampaignState
  readonly moves: CampaignJournalEntry[] = []
  constructor(readonly setup: CampaignSetup) {
    this.state = createCampaign(setup)
  }
  play(move: CampaignMove): string | undefined {
    this.moves.push(journalEntry(this.state, this.moves.length + 1, move))
    return applyMove(this.state, move).refused
  }
  must(move: CampaignMove): void {
    const refused = this.play(move)
    if (refused) throw new Error(`${move.kind} refused: ${refused}`)
  }
  log(): string {
    return this.state.log.map((l) => l.text).join('\n')
  }
}

const buy = (order: GroundUnitOrder, quantity = 1, colony = 'terra-home'): CampaignMove => ({ kind: 'purchase', player: 'terra', colony, item: { kind: 'ground-unit', unit: order }, quantity })
const ship = (c: Console, name: string) => taskForceById(c.state, 'terra-tf-1')!.ships.find((s) => s.name === name)!

/** Terra's home in the production phase with money to spend. */
function atHome(rulesVersion = 2): Console {
  const c = new Console(campaign(rulesVersion))
  c.state.phase = 'production'
  colonyById(c.state, 'terra-home')!.stockpileRp = 5000
  return c
}

describe('ground units in a campaign', () => {
  it('raises units at a colony for their price, each with its own marker, and refuses them under rules reading 1', () => {
    const c = atHome()
    c.must(buy(tanks(), 2))
    expect(colonyById(c.state, 'terra-home')!.stockpileRp).toBe(5000 - 2 * 516)
    expect(c.state.groundUnits.map((u) => u.name)).toEqual(['A Company 1', 'A Company 2'])
    expect(c.state.groundUnits.every((u) => 'colony' in u.at && u.at.colony === 'terra-home' && u.elements.length === 3)).toBe(true)
    expect(c.log()).toMatch(/raises A Company 1: 3 elements for 516 RP, (green|regular|veteran) with leadership [123] \(Dirtside p\. 21\)/)
    expect(c.play(buy(tanks({ count: 12 })))).toMatch(/at most 8/)
    expect(atHome(1).play(buy(tanks()))).toMatch(/rules reading 1/)
  })

  it('embarks into a ship’s holds while they have the space, and disembarks at a friendly colony', () => {
    const c = atHome()
    c.must(buy(tanks()))
    c.must(buy(riflemen()))
    const [a, b] = c.state.groundUnits
    // The corvette's single ton of cargo holds 50 CS; the tank platoon needs 84.
    expect(c.play({ kind: 'embark', player: 'terra', unit: a!.id, ship: ship(c, 'Kestrel').id })).toMatch(/needs 84 CS .* 50 left/)
    c.must({ kind: 'embark', player: 'terra', unit: a!.id, ship: ship(c, 'Cape Town').id })
    c.must({ kind: 'embark', player: 'terra', unit: b!.id, ship: ship(c, 'Cape Town').id })
    expect(holdSpaceLeft(c.state, ship(c, 'Cape Town'))).toBe(1000 - 84 - 80)
    expect(c.play({ kind: 'embark', player: 'terra', unit: a!.id, ship: ship(c, 'Cape Town').id })).toMatch(/already aboard/)
    c.must({ kind: 'disembark', player: 'terra', unit: b!.id, colony: 'terra-home' })
    expect(b!.at).toEqual({ colony: 'terra-home' })
    expect(c.play({ kind: 'disembark', player: 'terra', unit: a!.id, colony: 'esu-home' })).toMatch(/not yours/)
  })

  it('loses the troops aboard with a ship', () => {
    const c = atHome()
    c.must(buy(tanks()))
    c.must({ kind: 'embark', player: 'terra', unit: c.state.groundUnits[0]!.id, ship: ship(c, 'Cape Town').id })
    const tf = taskForceById(c.state, 'terra-tf-1')!
    tf.ships = tf.ships.filter((s) => s.name !== 'Cape Town')
    expect(lostWithShips(c.state).map((u) => u.name)).toEqual(['A Company'])
    expect(c.state.groundUnits).toHaveLength(0)
  })

  it('brings a depleted unit back to strength for the lost elements’ price, with the replacements’ roll', () => {
    const c = atHome()
    c.must(buy(riflemen()))
    const unit = c.state.groundUnits[0]!
    unit.elements[0]!.lost = true
    unit.elements[3]!.lost = true
    const before = colonyById(c.state, 'terra-home')!.stockpileRp
    c.must({ kind: 'reinforce', player: 'terra', unit: unit.id })
    // A rifle team (20) and the APSW team (30).
    expect(colonyById(c.state, 'terra-home')!.stockpileRp).toBe(before - 50)
    expect(unit.elements.every((e) => !e.lost)).toBe(true)
    expect(c.log()).toMatch(/takes 2 replacements at .* for 50 RP: D4 rolls \d against 2/)
    expect(c.play({ kind: 'reinforce', player: 'terra', unit: unit.id })).toMatch(/full strength/)
  })

  it('brings units that can land from orbit down in craft to fight a landing, and folds the battle back onto them', () => {
    let fought = 0
    for (const seed of [1, 2, 3]) {
      const setup = { ...campaign(), seed: SEED }
      const c = new Console(setup)
      c.state.phase = 'production'
      colonyById(c.state, 'terra-home')!.stockpileRp = 5000
      c.must(buy(tanks({ interfaceLanding: true })))
      c.must(buy(riflemen({ interfaceLanding: true })))
      c.must(buy(tanks({ name: 'Heavy lift', interfaceLanding: false })))
      for (const u of c.state.groundUnits) c.must({ kind: 'embark', player: 'terra', unit: u.id, ship: ship(c, 'Cape Town').id })
      // Over Eurasia's home, its frigate gone, with a PDU and a garrison unit of its own.
      c.state.taskForces = c.state.taskForces.filter((tf) => tf.owner === 'terra')
      taskForceById(c.state, 'terra-tf-1')!.hex = hex(2, 0)
      const home = colonyById(c.state, 'esu-home')!
      home.defences.pdu = 1
      home.stockpileRp = 5000
      c.state.groundUnits.push({ ...structuredClone(c.state.groundUnits[1]!), id: 'esu-guard', owner: 'esu', name: 'Home Guard', at: { colony: 'esu-home' }, interfaceLanding: false })
      c.state.phase = 'planetary'
      c.state.rng.cursor += seed
      c.must({ kind: 'assault', player: 'terra', colony: 'esu-home', taskForce: 'terra-tf-1' })
      const landing = c.state.landings[0]!
      expect(validateSetup(landing.setup)).toEqual([])
      // A dropship for the tanks, a lander for the riflemen; the heavy-lift platoon cannot land from orbit and stays aboard.
      expect(landing.setup.craft!.map((k) => [k.kind, k.unitIds.length])).toEqual([
        ['dropship', 1],
        ['lander', 1],
      ])
      expect(landing.setup.landingDefence).toEqual([{ unitId: 'pdu-1', needs: 6 }])
      expect(landing.setup.sides[1].units.some((u) => u.id === 'esu-guard')).toBe(true)
      expect(c.log()).toMatch(/and 2 ground units on .* 2 interface craft coming down during the battle/)
      const game = aiPlay(landing.setup, { seed })
      c.must({ kind: 'resolve-landing', landing: landing.id, savedBattle: JSON.stringify({ version: 1, setup: landing.setup, journal: game.journal }) })
      const heavy = c.state.groundUnits.find((u) => u.name === 'Heavy lift')!
      expect('ship' in heavy.at).toBe(true)
      for (const [id, where] of Object.entries(landing.ground!)) {
        const unit = c.state.groundUnits.find((u) => u.id === where.unit)
        if (unit) expect(unit.elements[where.index]!.lost).toBe(!!game.elements[id]!.destroyed)
      }
      const attackers = c.state.groundUnits.filter((u) => u.owner === 'terra' && u.name !== 'Heavy lift')
      if (colonyById(c.state, 'esu-home')!.owner === 'terra') {
        // The colony fell: the units that got down are its garrison, the Home Guard surrendered.
        expect(attackers.every((u) => !('colony' in u.at) || u.at.colony === 'esu-home')).toBe(true)
        expect(c.state.groundUnits.some((u) => u.owner === 'esu')).toBe(false)
      } else {
        expect(attackers.every((u) => 'ship' in u.at)).toBe(true)
      }
      for (const u of attackers) if (Object.entries(landing.ground!).some(([id, w]) => w.unit === u.id && !game.elements[id]!.aboard)) {
        expect(u.battles).toBe(1)
        expect(u.qualityPoints).toBeGreaterThanOrEqual(1)
        fought += 1
      }
    }
    expect(fought).toBeGreaterThan(0)
  })
})
