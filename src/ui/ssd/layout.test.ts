import { describe, expect, it } from 'vitest'
import { SHIP_DESIGNS } from '../../data/ships'
import type { Arc, ShipDesign } from '../../engine/types'
import {
  boxInsideOutline,
  hullShape,
  normalisePlan,
  outlinePolyline,
} from './geometry'
import { SSD_ICON_IDS } from './icons.generated'
import { SSD_SPRITE } from './sprite.generated'
import { COUNTER_EXTENT, arcBearing, counterSilhouette, planShip } from './layout'

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
      expect(aspect, design.name).toBeGreaterThan(1)
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
