import { describe, expect, it } from 'vitest'
import type { ScreenDef, ShipDesign, WeaponVariant } from '../../engine/types'
import { SHIP_DESIGNS } from '../../data/ships'
import { SSD_ICONS, SSD_ICON_IDS } from './icons.generated'
import { SSD_SPRITE } from './sprite.generated'
import {
  ALL_SYSTEM_KINDS,
  ALL_WEAPON_CLASSES,
  SYMBOL_LESS_KINDS,
  iconForArmourBox,
  iconForDrive,
  iconForFtl,
  iconForHullBox,
  iconForScreen,
  iconForSystem,
  iconForWeapon,
} from './iconFor'

/**
 * The point of this file: a ship must never be drawn with a hole in it.
 *
 * `iconFor.ts` maps the engine's own vocabulary onto the 176 symbols on the
 * sheet, and the two grow independently — a new weapon is added to the rules
 * engine, a symbol is redrawn on the sheet — so nothing but a test that walks
 * both sides can keep them in step. Every case below fails loudly at build
 * time rather than shipping a blank box on someone's dreadnought.
 */

const VARIANTS: WeaponVariant[] = ['standard', 'short', 'long', 'extended', 'two-stage', 'variable']

describe('every symbol the resolver names exists on the sheet', () => {
  it('resolves every weapon class at every rating and variant', () => {
    const missing: string[] = []
    for (const weaponClass of ALL_WEAPON_CLASSES) {
      for (const rating of [0, 1, 2, 3, 4, 5, 6, 9]) {
        for (const variant of VARIANTS) {
          const id = iconForWeapon({ weaponClass, rating, variant })
          if (id === null) missing.push(`${weaponClass} class ${rating} ${variant}`)
          else if (!SSD_ICON_IDS.has(id)) missing.push(`${weaponClass} -> unknown symbol "${id}"`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('resolves every system kind but the three that have no symbol', () => {
    const missing: string[] = []
    for (const kind of ALL_SYSTEM_KINDS) {
      const id = iconForSystem(kind)
      if (SYMBOL_LESS_KINDS.has(kind)) {
        // Deliberate: the sheet has nothing for these and the SSD draws them
        // from somewhere else. Silence here would let a real gap hide.
        if (id !== null) missing.push(`${kind} claims to be symbol-less but resolved to "${id}"`)
        continue
      }
      if (id === null) missing.push(`${kind} has no symbol`)
      else if (!SSD_ICON_IDS.has(id)) missing.push(`${kind} -> unknown symbol "${id}"`)
    }
    expect(missing).toEqual([])
  })

  it('resolves every screen a hull can be built with (7.2, 7.3, 7.16)', () => {
    const missing: string[] = []
    for (const level of [0, 1, 2] as const) {
      for (const advanced of [false, true]) {
        for (const area of [undefined, { advanced: false }, { advanced: true, level: 2 as const }]) {
          const screens: ScreenDef = { level, generators: 1, advanced, area }
          for (const wantArea of [false, true]) {
            const id = iconForScreen(screens, { area: wantArea })
            if (id === null) {
              // A ship with no area projector legitimately has no area symbol,
              // and level 0 means no screens at all.
              if (wantArea && area === undefined) continue
              if (!wantArea && level === 0) continue
              missing.push(`level ${level} advanced=${advanced} area=${wantArea}`)
            } else if (!SSD_ICON_IDS.has(id)) {
              missing.push(`level ${level} -> unknown symbol "${id}"`)
            }
          }
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('resolves drives, FTL grades, hull boxes and armour boxes', () => {
    const ids = [
      iconForDrive(false),
      iconForDrive(true),
      iconForFtl('standard'),
      iconForFtl('advanced'),
      // 11.6's tug carries an oversized FTL drive; it is still an FTL drive.
      iconForFtl('tug'),
      iconForHullBox({ marked: false, crew: false }),
      iconForHullBox({ marked: false, crew: true }),
      iconForHullBox({ marked: true, crew: false }),
      iconForArmourBox({ marked: false, regenerative: false, burntOut: false }),
      iconForArmourBox({ marked: true, regenerative: false, burntOut: false }),
      iconForArmourBox({ marked: false, regenerative: true, burntOut: false }),
      iconForArmourBox({ marked: true, regenerative: true, burntOut: false }),
      iconForArmourBox({ marked: true, regenerative: true, burntOut: true }),
    ]
    expect(ids.filter((id) => id === null || !SSD_ICON_IDS.has(id))).toEqual([])
    // A hull with no FTL drive has no symbol, and that is the answer, not a gap.
    expect(iconForFtl('none')).toBeNull()
  })
})

describe('the whole roster draws', () => {
  it('finds a symbol for every weapon and every system on every design', () => {
    const missing: string[] = []
    for (const design of SHIP_DESIGNS) {
      for (const weapon of design.weapons) {
        const id = iconForWeapon(weapon)
        if (id === null || !SSD_ICON_IDS.has(id)) {
          missing.push(`${design.name}: ${weapon.label} (${weapon.weaponClass} ${weapon.rating})`)
        }
      }
      for (const system of design.systems) {
        if (SYMBOL_LESS_KINDS.has(system.kind)) continue
        const id = iconForSystem(system.kind)
        if (id === null || !SSD_ICON_IDS.has(id)) missing.push(`${design.name}: ${system.kind}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('covers the roster with enough hulls to be worth calling coverage', () => {
    // A guard on the guard: if the roster ever loads empty the loop above
    // passes without looking at anything.
    expect(SHIP_DESIGNS.length).toBeGreaterThan(50)
    expect(SHIP_DESIGNS.flatMap((d) => d.weapons).length).toBeGreaterThan(200)
  })
})

describe('the generated sprite and catalogue agree', () => {
  it('carries a definition for every catalogued symbol', () => {
    const absent = SSD_ICONS.filter((icon) => !SSD_SPRITE.includes(`id="ssd-${icon.id}"`))
    expect(absent.map((i) => i.id)).toEqual([])
  })

  it('has no duplicate ids', () => {
    expect(SSD_ICON_IDS.size).toBe(SSD_ICONS.length)
  })

  it('recolours the print palette away entirely', () => {
    // The sheet is black ink on white paper and the app is dark. A stray
    // `fill="white"` is a symbol drawn as a solid block; a stray `fill="black"`
    // is one drawn in the void. Neither shows up in a screenshot of the ships
    // that happen to be on screen, so it is asserted instead.
    expect(SSD_SPRITE).not.toMatch(/(fill|stroke)="(white|black|#000000|#FFFFFF)"/i)
  })

  it('states a usable aspect ratio for every symbol', () => {
    const bad = SSD_ICONS.filter((i) => !(i.aspect > 0.05 && i.aspect < 20))
    expect(bad.map((i) => `${i.id} ${i.aspect}`)).toEqual([])
  })
})

describe('a design the engine can build is a design the sheet can draw', () => {
  it('draws a hull whose weapons are all one-offs the roster never uses', () => {
    // Not every legal design is on the roster. This is the synthetic worst
    // case: one mounting of every class the engine has, at the highest rating
    // and the oddest variant each.
    const weapons = ALL_WEAPON_CLASSES.map((weaponClass, i) => ({
      id: `w${i}`,
      label: weaponClass,
      weaponClass,
      rating: 6,
      variant: 'extended' as WeaponVariant,
      arcs: [],
      mass: 1,
      points: 1,
    }))
    const drawn = weapons.map((w) => iconForWeapon(w))
    expect(drawn.filter((id) => id === null)).toEqual([])
  })

  it('never invents an id the sprite does not define', () => {
    const everyId = [
      ...ALL_WEAPON_CLASSES.flatMap((weaponClass) =>
        VARIANTS.flatMap((variant) =>
          [1, 3, 6].map((rating) => iconForWeapon({ weaponClass, rating, variant })),
        ),
      ),
      ...ALL_SYSTEM_KINDS.map((k) => iconForSystem(k)),
    ].filter((id): id is string => id !== null)
    const undefinedInSprite = [...new Set(everyId)].filter(
      (id) => !SSD_SPRITE.includes(`id="ssd-${id}"`),
    )
    expect(undefinedInSprite).toEqual([])
  })
})

// The roster is loaded rather than mocked on purpose: the thing most likely to
// break this is a new ship, not a new symbol.
const _rosterIsReal: ShipDesign[] = SHIP_DESIGNS
void _rosterIsReal
