import { describe, expect, it } from 'vitest'
import { SHIP_DESIGNS } from '../../data/ships'
import type { Arc, ShipDesign } from '../../engine/types'
import {
  boxInsideOutline,
  halfBeamAt,
  hullShape,
  insideOutline,
  normalisePlan,
  outlinePolyline,
} from './geometry'
import { CORE_SYSTEM_IDS } from '../../engine/threshold'
import { SSD_ICON_IDS } from './icons.generated'
import { SSD_SPRITE } from './sprite.generated'
import { arcBearing } from './bearing'
import { COUNTER_EXTENT, counterSilhouette, planShip } from './layout'

/**
 * The sheet has to draw every ship in the game and every ship the shipyard can
 * build, and it has to draw the same one the same way twice. Those are the two
 * things a generated diagram can quietly stop doing, and neither shows up in a
 * screenshot of whichever hull happened to be on screen.
 */

const heavyCruiser = SHIP_DESIGNS.find((d) => d.name === 'Heavy Cruiser')
if (heavyCruiser === undefined) throw new Error('the roster has lost its Heavy Cruiser')

describe('where a mounting points', () => {
  it('reads a bearing off the arcs it bears into', () => {
    const cases: Array<[Arc[], number, string]> = [
      [['F'], 0, 'dead ahead'],
      [['FS'], 60, 'forward starboard'],
      [['AS'], 120, 'aft starboard'],
      [['A'], 180, 'dead astern'],
      [['AP'], 240, 'aft port'],
      [['FP'], 300, 'forward port'],
      // The three-arc blocks a roster hull is actually built with.
      [['F', 'FP', 'FS'], 0, 'the forward battery'],
      [['A', 'AP', 'AS'], 180, 'the stern battery'],
      [['A', 'AP', 'FP'], 240, 'the port broadside'],
      [['A', 'AS', 'FS'], 120, 'the starboard broadside'],
    ]
    for (const [arcs, degrees, what] of cases) {
      expect(Math.round(arcBearing(arcs).degrees), what).toBe(degrees)
    }
  })

  it('says an all-round mount has no bearing at all', () => {
    // Six arcs cancel exactly, which is how a turret identifies itself as
    // belonging on the keel rather than on any one side.
    const all = arcBearing(['F', 'FS', 'AS', 'A', 'AP', 'FP'])
    expect(all.spread).toBeLessThan(1e-9)
    expect(arcBearing([]).spread).toBe(0)
  })

  it('loosens its grip one arc at a time', () => {
    // Adjacent arcs concentrate as 2·sin(30n°)/n. The layout's line between a
    // mount with a side and a mount without sits in the gap between four arcs
    // and five, so that gap has to be a real one.
    const spread = (arcs: Arc[]) => arcBearing(arcs).spread
    expect(spread(['F'])).toBeCloseTo(1, 6)
    expect(spread(['F', 'FS'])).toBeCloseTo(0.866, 3)
    expect(spread(['F', 'FP', 'FS'])).toBeCloseTo(0.667, 3)
    expect(spread(['F', 'FS', 'AS', 'A'])).toBeCloseTo(0.433, 3)
    expect(spread(['F', 'FS', 'AS', 'A', 'AP'])).toBeCloseTo(0.2, 3)
  })

  it('keeps a four-arc mount on its own side and sends a five-arc one to the keel', () => {
    const four = { ...heavyCruiser.weapons[0], id: 'four', arcs: ['FS', 'AS', 'A', 'AP'] as Arc[] }
    const five = {
      ...heavyCruiser.weapons[0],
      id: 'five',
      arcs: ['F', 'FS', 'AS', 'A', 'AP'] as Arc[],
    }
    const plan = planShip({ ...heavyCruiser, weapons: [four, five] })
    expect(plan.glyphs.find((g) => g.key === 'four')?.x).not.toBe(0)
    expect(plan.glyphs.find((g) => g.key === 'five')?.x).toBe(0)
  })
})

describe('every hull in the game lays out', () => {
  it('draws every roster design with everything inside the plating', () => {
    const faults: string[] = []
    for (const design of SHIP_DESIGNS) {
      const plan = planShip(design)
      const outline = outlinePolyline(plan.hull, 24)
      if (!Number.isFinite(plan.hull.beam) || plan.hull.beam <= 0) {
        faults.push(`${design.name}: beam ${plan.hull.beam}`)
      }
      if (plan.hull.tailY <= plan.hull.noseY) faults.push(`${design.name}: inside out`)
      for (const glyph of plan.glyphs) {
        const bottom = glyph.rose === null ? glyph.y + glyph.height / 2 : glyph.rose.y + glyph.rose.radius
        const top = glyph.y - glyph.height / 2
        if (!boxInsideOutline(outline, glyph.x, (top + bottom) / 2, glyph.width, bottom - top)) {
          faults.push(`${design.name}: ${glyph.label} is through the hull`)
        }
      }
    }
    expect(faults).toEqual([])
  })

  it('gives every weapon and fitting a symbol the sprite defines', () => {
    const missing = new Set<string>()
    for (const design of SHIP_DESIGNS) {
      for (const glyph of planShip(design).glyphs) {
        if (!SSD_ICON_IDS.has(glyph.icon)) missing.add(`${glyph.icon} (${glyph.label})`)
        else if (!SSD_SPRITE.includes(`id="ssd-${glyph.icon}"`)) missing.add(glyph.icon)
      }
    }
    expect([...missing]).toEqual([])
  })

  it('draws something for every hull, however sparse', () => {
    const counts = SHIP_DESIGNS.map((d) => planShip(d).glyphs.length)
    expect(Math.min(...counts)).toBeGreaterThan(0)
    expect(SHIP_DESIGNS.length).toBeGreaterThan(50)
  })

  it('keeps every hull within a shape that reads as a ship', () => {
    // Not a cosmetic bound. A hull ten times as long as it is wide is a line on
    // the map and a column of symbols a screen and a half tall on the sheet.
    for (const design of SHIP_DESIGNS) {
      const plan = planShip(design)
      const aspect = (plan.hull.tailY - plan.hull.noseY) / (plan.hull.beam * 2)
      // A station is exactly as wide as it is long; nothing is wider than long.
      expect(aspect, design.name).toBeGreaterThanOrEqual(1 - 1e-9)
      expect(aspect, design.name).toBeLessThan(3.5)
    }
  })
})

describe('the same ship is drawn the same way twice', () => {
  it('is a pure function of the design and the damage', () => {
    for (const design of SHIP_DESIGNS.slice(0, 20)) {
      expect(JSON.stringify(planShip(design))).toBe(JSON.stringify(planShip(design)))
    }
  })

  it('does not depend on where the design sits in the roster', () => {
    const first = planShip(SHIP_DESIGNS[7])
    const shuffled = [...SHIP_DESIGNS].reverse()
    const again = planShip(shuffled[shuffled.length - 8])
    expect(JSON.stringify(again)).toBe(JSON.stringify(first))
  })
})

describe('the shape comes from the build', () => {
  it('draws a station as a thing with no bow', () => {
    const station = SHIP_DESIGNS.find((d) => d.group === 'station')
    expect(station).toBeDefined()
    expect(hullShape(station as ShipDesign).radial).toBe(true)
    expect(counterSilhouette(station as ShipDesign).bow).toBe('')
  })

  it('draws a ship with a spinal mount around its barrel', () => {
    const spinal = SHIP_DESIGNS.find((d) =>
      d.weapons.some((w) => w.weaponClass.startsWith('spinal')),
    )
    expect(spinal).toBeDefined()
    const plan = planShip(spinal as ShipDesign)
    expect(plan.spine).not.toBeNull()
    expect(plan.spine?.y1).toBeLessThan(plan.spine?.y2 ?? 0)
    expect(planShip(heavyCruiser).spine).toBeNull()
  })

  it('makes a streamlined hull slenderer than the same hull unstreamlined', () => {
    const bare = hullShape({ ...heavyCruiser, streamlining: 'none' })
    const sleek = hullShape({ ...heavyCruiser, streamlining: 'full' })
    expect(sleek.slenderness).toBeGreaterThan(bare.slenderness)
    expect(sleek.edge).toBe('curved')
    expect(bare.edge).toBe('faceted')
  })

  it('gives a hard-driven hull a broader engine deck', () => {
    const slow = hullShape({ ...heavyCruiser, drive: { thrust: 2, advanced: false } })
    const fast = hullShape({ ...heavyCruiser, drive: { thrust: 8, advanced: false } })
    expect(fast.stern).toBeGreaterThan(slow.stern)
  })
})

describe('the counter is the same ship', () => {
  it('is the sheet outline scaled, not a second drawing', () => {
    for (const design of SHIP_DESIGNS.slice(0, 25)) {
      const plan = planShip(design)
      expect(counterSilhouette(design).path).toBe(plan.counterPath)
    }
  })

  it('keeps the ship in proportion when it shrinks', () => {
    for (const design of SHIP_DESIGNS.slice(0, 25)) {
      const plan = planShip(design)
      const sheet = (plan.hull.tailY - plan.hull.noseY) / plan.hull.beam
      const small = normalisePlan(plan.hull)
      const counter = (small.tailY - small.noseY) / small.beam
      expect(counter).toBeCloseTo(sheet, 6)
    }
  })

  it('fits inside the box the map scales it by', () => {
    for (const design of SHIP_DESIGNS.slice(0, 25)) {
      for (const [x, y] of outlinePolyline(normalisePlan(planShip(design).hull), 8)) {
        expect(Math.abs(x)).toBeLessThanOrEqual(COUNTER_EXTENT + 1)
        expect(Math.abs(y)).toBeLessThanOrEqual(COUNTER_EXTENT + 1)
      }
    }
  })
})

describe('damage is drawn on the ship, not beside it', () => {
  const [first, second] = heavyCruiser.weapons

  it('crosses off what a threshold check took, where it sat', () => {
    const hurt = planShip(heavyCruiser, { destroyed: new Set([second.id]) })
    const pristine = planShip(heavyCruiser)
    const before = pristine.glyphs.find((g) => g.key === second.id)
    const after = hurt.glyphs.find((g) => g.key === second.id)
    expect(after?.state).toBe('destroyed')
    // Crossed off, not erased: what the ship used to have is part of reading
    // what is left, and a mount that moved when it died would be unreadable.
    expect(after?.x).toBe(before?.x)
    expect(after?.y).toBe(before?.y)
  })

  it('marks a weapon that has already fired this turn (2.6)', () => {
    const plan = planShip(heavyCruiser, { destroyed: new Set<string>(), fired: new Set([first.id]) })
    expect(plan.glyphs.find((g) => g.key === first.id)?.state).toBe('fired')
  })

  it('prints the thrust the ship has now, not the one it was built with', () => {
    const half = Math.floor(heavyCruiser.drive.thrust / 2)
    const plan = planShip(heavyCruiser, { destroyed: new Set<string>(), thrust: half })
    const drive = plan.glyphs.find((g) => g.key === 'drive')
    expect(drive?.value).toBe(half)
    expect(drive?.state).toBe('degraded')
  })
})

describe('a hold is one symbol with a number in it', () => {
  const liner = SHIP_DESIGNS.find((d) => d.systems.filter((s) => s.kind === 'cargo').length > 4)

  it('does not draw a merchantman as a wall of identical boxes', () => {
    expect(liner).toBeDefined()
    const holds = (liner as ShipDesign).systems.filter((s) => s.kind === 'cargo')
    const plan = planShip(liner as ShipDesign)
    const drawn = plan.glyphs.filter((g) => g.icon === 'cargo-hold')
    expect(drawn).toHaveLength(1)
    expect(drawn[0].value).toBe(holds.length)
  })

  it('counts down as holds are shot away, and only strikes it when they all are', () => {
    const holds = (liner as ShipDesign).systems.filter((s) => s.kind === 'cargo')
    const some = planShip(liner as ShipDesign, {
      destroyed: new Set(holds.slice(0, 2).map((s) => s.id)),
    })
    const dented = some.glyphs.find((g) => g.icon === 'cargo-hold')
    expect(dented?.value).toBe(holds.length - 2)
    expect(dented?.state).toBe('degraded')

    const gone = planShip(liner as ShipDesign, { destroyed: new Set(holds.map((s) => s.id)) })
    expect(gone.glyphs.find((g) => g.icon === 'cargo-hold')?.state).toBe('destroyed')
  })
})

describe('a mount is drawn where it can shoot', () => {
  it('puts the bow battery forward of the stern battery', () => {
    const bow = { ...heavyCruiser.weapons[0], id: 'bow', arcs: ['F', 'FP', 'FS'] as Arc[] }
    const stern = { ...heavyCruiser.weapons[0], id: 'stern', arcs: ['A', 'AP', 'AS'] as Arc[] }
    const plan = planShip({ ...heavyCruiser, weapons: [stern, bow] })
    const at = (id: string) => plan.glyphs.find((g) => g.key === id)
    expect(at('bow')?.y).toBeLessThan(at('stern')?.y ?? 0)
  })

  it('puts the port broadside to port and the starboard broadside to starboard', () => {
    const port = { ...heavyCruiser.weapons[0], id: 'port', arcs: ['A', 'AP', 'FP'] as Arc[] }
    const stbd = { ...heavyCruiser.weapons[0], id: 'stbd', arcs: ['A', 'AS', 'FS'] as Arc[] }
    const plan = planShip({ ...heavyCruiser, weapons: [port, stbd] })
    const at = (id: string) => plan.glyphs.find((g) => g.key === id)
    expect(at('port')?.x).toBeLessThan(0)
    expect(at('stbd')?.x).toBeGreaterThan(0)
  })

  it('puts an all-round mount on the keel', () => {
    const turret = {
      ...heavyCruiser.weapons[0],
      id: 'turret',
      arcs: ['F', 'FS', 'AS', 'A', 'AP', 'FP'] as Arc[],
    }
    const plan = planShip({ ...heavyCruiser, weapons: [turret] })
    expect(plan.glyphs.find((g) => g.key === 'turret')?.x).toBe(0)
  })

  it('puts the drive at the stern, behind everything that shoots', () => {
    const plan = planShip(heavyCruiser)
    const drive = plan.glyphs.find((g) => g.key === 'drive')
    const guns = plan.glyphs.filter((g) => g.arcs !== undefined)
    expect(guns.length).toBeGreaterThan(0)
    for (const gun of guns) expect(gun.y, gun.label).toBeLessThanOrEqual(drive?.y ?? 0)
  })
})

describe('what the first review found', () => {
  const weapon = (id: string, arcs: Arc[]) => ({ ...heavyCruiser.weapons[0], id, arcs })
  const at = (design: ShipDesign, id: string) => planShip(design).glyphs.find((g) => g.key === id)

  it('mirrors a port broadside and its starboard twin', () => {
    // Four adjacent arcs point exactly between two sectors, and a tie broken
    // by floating-point noise put the two sides of one ship in different
    // bands. Whatever the tie-break, it has to be the same on both sides.
    const stbd = weapon('stbd', ['FS', 'AS', 'A', 'AP'])
    const port = weapon('port', ['AS', 'A', 'AP', 'FP'])
    const plan = { ...heavyCruiser, weapons: [stbd, port] }
    expect(at(plan, 'stbd')?.y).toBe(at(plan, 'port')?.y)
    expect(at(plan, 'stbd')?.x).toBe(-(at(plan, 'port')?.x ?? 0))
    const two = { ...heavyCruiser, weapons: [weapon('s', ['AS', 'A']), weapon('p', ['A', 'AP'])] }
    expect(at(two, 's')?.y).toBe(at(two, 'p')?.y)
  })

  it('does not care what order the arcs were written in', () => {
    const a = { ...heavyCruiser, weapons: [weapon('w', ['F', 'FS', 'AS', 'A'])] }
    const b = { ...heavyCruiser, weapons: [weapon('w', ['FS', 'AS', 'F', 'A'])] }
    expect(at(a, 'w')?.y).toBe(at(b, 'w')?.y)
    expect(at(a, 'w')?.x).toBe(at(b, 'w')?.x)
  })

  it("draws a carrier's bays once each, as what rides in them (8.2)", () => {
    const carrier = SHIP_DESIGNS.find((d) => d.fighterBays.length > 2)
    expect(carrier).toBeDefined()
    const design = carrier as ShipDesign
    const hangars = design.systems.filter((s) => s.kind === 'hangar-bay')
    const drawn = planShip(design).glyphs.filter((g) => g.icon.startsWith('hangar-bay'))
    expect(drawn).toHaveLength(hangars.length)
    // Keyed by the bay the wing rides in, so a threshold check can cross it off.
    for (const hangar of hangars) expect(drawn.map((g) => g.key)).toContain(hangar.id)
    expect(drawn.some((g) => g.icon !== 'hangar-bay')).toBe(true)
  })

  it('strikes a screen generator the engine crossed off', () => {
    const screened = SHIP_DESIGNS.find((d) => d.screens.level > 0)
    expect(screened).toBeDefined()
    const design = screened as ShipDesign
    const generator = design.systems.find((s) => s.kind === 'screen-generator')
    expect(generator).toBeDefined()
    const plan = planShip(design, { destroyed: new Set([generator?.id ?? '']) })
    expect(plan.glyphs.find((g) => g.key === generator?.id)?.state).toBe('destroyed')
  })

  it('draws the Core Systems block on every hull and crosses its cells off one at a time', () => {
    for (const design of SHIP_DESIGNS) {
      const core = planShip(design).glyphs.find((g) => g.kind === 'core')
      expect(core, design.name).toBeDefined()
      expect(core?.cells?.map((c) => c.state)).toEqual(['live', 'live', 'live'])
    }
    const hit = planShip(heavyCruiser, { destroyed: new Set([CORE_SYSTEM_IDS.lifeSupport]) })
    const core = hit.glyphs.find((g) => g.kind === 'core')
    expect(core?.cells?.map((c) => c.state)).toEqual(['live', 'destroyed', 'live'])
    expect(core?.state).toBe('live')
  })

  it('puts the core block and the drives in the bottom rows, as 2.4 has them', () => {
    const plan = planShip(heavyCruiser)
    const core = plan.glyphs.find((g) => g.kind === 'core')
    const drive = plan.glyphs.find((g) => g.kind === 'drive')
    const rest = plan.glyphs.filter((g) => g.kind !== 'core' && g.kind !== 'drive' && g.kind !== 'ftl')
    for (const g of rest) expect(g.y).toBeLessThan(core?.y ?? 0)
    expect(core?.y).toBeLessThan(drive?.y ?? 0)
  })

  it('draws a Beam-5 with a 5 in it, not as the class-4 symbol it borrows', () => {
    const five = { ...heavyCruiser.weapons[0], id: 'b5', rating: 5, label: 'Beam-5' }
    const glyph = at({ ...heavyCruiser, weapons: [five] }, 'b5')
    expect(glyph?.icon).toBe('class-4-beam')
    expect(glyph?.value).toBe(5)
    const four = { ...five, id: 'b4', rating: 4 }
    expect(at({ ...heavyCruiser, weapons: [four] }, 'b4')?.value).toBeUndefined()
  })

  it('bears a turreted gun through its turret, not its printed arcs (5.22)', () => {
    const turret = { id: 't1', arcs: ['F', 'FS', 'AS'] as Arc[], capacity: 6, mass: 2, points: 6 }
    const gun = { ...weapon('g', ['F', 'FS', 'AS', 'A', 'AP', 'FP']), turretId: 't1' }
    const glyph = at({ ...heavyCruiser, turrets: [turret], weapons: [gun] }, 'g')
    expect(glyph?.arcs).toEqual(['F', 'FS', 'AS'])
    expect(glyph?.x).not.toBe(0)
  })

  it('gives a station with a forward battery something to point with', () => {
    const station = SHIP_DESIGNS.find((d) => d.group === 'station' && d.weapons.some((w) => w.arcs.length < 6))
    expect(station).toBeDefined()
    expect(counterSilhouette(station as ShipDesign).bow).not.toBe('')
  })

  it("keeps the counter's filled bow inside the hull it is drawn on", () => {
    for (const design of SHIP_DESIGNS) {
      const { bow } = counterSilhouette(design)
      if (bow === '') continue
      const numbers = bow.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
      const outline = outlinePolyline(normalisePlan(planShip(design).hull), 48)
      // Every vertex of the bow, nudged a hair inward, is inside the plating.
      for (let i = 0; i < numbers.length; i += 2) {
        const [x, y] = [numbers[i] * 0.995, numbers[i + 1] * 0.995]
        expect(insideOutline(outline, x, y), `${design.name} bow vertex ${i / 2}`).toBe(true)
      }
    }
  })

  it('draws a mine rack with mines in it', () => {
    // The sheet's Mine Layer referred to a symbol nothing defined, so the one
    // weapon a minelayer is named for drew as an empty box.
    const layer = SHIP_DESIGNS.find((d) => d.weapons.some((w) => w.weaponClass === 'mine-rack'))
    expect(layer).toBeDefined()
    const glyph = planShip(layer as ShipDesign).glyphs.find((g) => g.icon === 'mine-layer')
    expect(glyph).toBeDefined()
    expect(SSD_SPRITE).toContain('href="#_mineIndividual"')
    expect(SSD_SPRITE).not.toContain('6e223869de347')
  })
})

describe('the sheet as a whole', () => {
  it('splits a band into rows that differ by one at most, the longer ones forward', () => {
    const guts = Array.from({ length: 10 }, (_, i) => ({
      id: `pds-${i}`,
      kind: 'pds' as const,
      label: 'PDS',
      mass: 1,
      points: 3,
    }))
    const plan = planShip({ ...heavyCruiser, weapons: [], systems: guts })
    const rows = new Map<number, number>()
    for (const g of plan.glyphs.filter((g) => g.icon === 'point-defense-system')) {
      rows.set(g.y, (rows.get(g.y) ?? 0) + 1)
    }
    const sizes = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n)
    expect(sizes).toEqual([4, 3, 3])
  })

  it('draws a frame between every pair of bands and none inside one', () => {
    const plan = planShip(heavyCruiser)
    // A frame sits in a gap, never on a symbol.
    for (const y of plan.frames) {
      for (const g of plan.glyphs) {
        const top = g.y - g.height / 2
        const bottom = g.rose === null ? g.y + g.height / 2 : g.rose.y + g.rose.radius
        expect(y < top || y > bottom, `frame ${y} crosses ${g.label}`).toBe(true)
      }
    }
    expect(plan.frames.length).toBeGreaterThan(2)
  })

  it('bulges the plating where a broadside sits, and nowhere else', () => {
    const port = weaponWith('p', ['A', 'AP', 'FP'])
    const broadside = planShip({ ...heavyCruiser, weapons: [port] })
    const bare = planShip({ ...heavyCruiser, weapons: [] })
    expect(broadside.hull.sponsons.length).toBe(1)
    expect(bare.hull.sponsons.length).toBe(0)
    const [y0, y1] = broadside.hull.sponsons[0]
    expect(halfBeamAt(broadside.hull, (y0 + y1) / 2)).toBeGreaterThan(
      halfBeamAt(broadside.hull, y1 + 40),
    )
  })

  it('puts a symbol where the designer put it, and lets the hull out round it', () => {
    const plain = planShip(heavyCruiser)
    const gun = plain.glyphs.find((g) => g.kind === 'weapon')
    expect(gun).toBeDefined()
    if (gun === undefined) return
    const custom: ShipDesign = {
      ...heavyCruiser,
      layout: { [gun.key]: { x: gun.x + 200, y: gun.y + 30 }, 'no-such-mount': { x: 0, y: 0 } },
    }
    const plan = planShip(custom)
    const moved = plan.glyphs.find((g) => g.key === gun.key)
    expect(moved?.x).toBe(gun.x + 200)
    expect(moved?.y).toBe(gun.y + 30)
    // The rosette went with it.
    expect(moved?.rose?.x).toBe(gun.rose!.x + 200)
    // Still inside the plating, which is wider than it was.
    const outline = outlinePolyline(plan.hull)
    expect(boxInsideOutline(outline, moved!.x, moved!.y, moved!.width, moved!.height)).toBe(true)
    expect(plan.hull.beam).toBeGreaterThan(plain.hull.beam)
    // Everything else is where it was.
    for (const g of plain.glyphs) {
      if (g.key === gun.key) continue
      const same = plan.glyphs.find((other) => other.key === g.key)
      expect(same?.x).toBe(g.x)
      expect(same?.y).toBe(g.y)
    }
    // And the counter's gun moved with the sheet's.
    const before = counterSilhouette(heavyCruiser).guns
    const after = counterSilhouette(custom).guns
    expect(after).toHaveLength(before.length)
    expect(after.some((g, i) => g.x !== before[i]!.x)).toBe(true)
  })

  it('keeps a symbol asked to sit a universe away within reach', () => {
    const plain = planShip(heavyCruiser)
    const gun = plain.glyphs.find((g) => g.kind === 'weapon')!
    const plan = planShip({ ...heavyCruiser, layout: { [gun.key]: { x: 1e308, y: gun.y } } })
    const moved = plan.glyphs.find((g) => g.key === gun.key)!
    expect(moved.x).toBeLessThanOrEqual(600)
    expect(Number.isFinite(plan.hull.beam)).toBe(true)
    expect(boxInsideOutline(outlinePolyline(plan.hull), moved.x, moved.y, moved.width, moved.height)).toBe(true)
  })

  it('keeps a symbol dragged off the ends of the deck on the deck', () => {
    const plain = planShip(heavyCruiser)
    const gun = plain.glyphs.find((g) => g.kind === 'weapon')!
    const plan = planShip({ ...heavyCruiser, layout: { [gun.key]: { x: gun.x, y: 9999 } } })
    const moved = plan.glyphs.find((g) => g.key === gun.key)!
    expect(moved.y).toBeLessThan(plan.hull.deckBottom)
    expect(moved.y).toBeGreaterThan(gun.y)
    const outline = outlinePolyline(plan.hull)
    expect(boxInsideOutline(outline, moved.x, moved.y, moved.width, moved.height)).toBe(true)
  })

  it('gives the counter a bar per battery and a dot per gun', () => {
    const { bars, guns } = counterSilhouette(heavyCruiser)
    expect(guns).toHaveLength(heavyCruiser.weapons.length)
    expect(bars.length).toBeGreaterThan(0)
    for (const bar of bars) expect(bar.x1).toBeGreaterThan(bar.x0)
  })

  function weaponWith(id: string, arcs: Arc[]) {
    return { ...(heavyCruiser as ShipDesign).weapons[0], id, arcs }
  }
})
