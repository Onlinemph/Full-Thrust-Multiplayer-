import type { ShipDesign, SystemKind, WeaponClass, WeaponDef, WeaponVariant } from '../../engine/types'
import { SSD_ICON_IDS } from './icons.generated'

/**
 * Which symbol on the sheet draws a given system or weapon.
 *
 * The sheet is a printed vocabulary and the engine is a set of types, and they
 * were written by different people for different purposes — so this is the seam
 * between them, and it is the only place that knows both. Everything else asks
 * for an icon by handing over the thing itself.
 *
 * Two rules keep it honest. Nothing here invents a symbol id: every string
 * returned is checked against `SSD_ICON_IDS`, which is generated from the sheet,
 * and `iconTest.ts` walks every `SystemKind`, every `WeaponClass` and every
 * weapon on all 91 roster hulls to prove each one lands on a symbol that exists.
 * And where the sheet has no symbol for something the engine can build, this
 * says so by returning null rather than by drawing the wrong thing.
 */

/** A symbol the sheet is known to carry. */
export type IconId = string

function known(id: string): IconId | null {
  return SSD_ICON_IDS.has(id) ? id : null
}

/**
 * The sheet draws weapons of class 1 to 6 as separate symbols with the class
 * number already inside them, so the class is part of the id rather than a
 * label drawn on top. Not every family runs to six: beams stop at 5 in the
 * rules but the sheet draws 1–4, and the K-Gun is the only one that goes to 6.
 * `clampToSheet` walks down to the nearest class the sheet actually has, which
 * is better than a blank where a class-5 beam should be.
 */
function clampToSheet(stem: (n: number) => string, rating: number): IconId | null {
  const start = Math.max(1, Math.min(6, Math.round(rating)))
  for (let n = start; n >= 1; n -= 1) {
    const hit = known(stem(n))
    if (hit) return hit
  }
  return null
}

/** The three range lines a K-Gun, a Pulse Torpedo or a Pulser is built in. */
function line(variant: WeaponVariant): 'short' | 'long' | 'standard' {
  if (variant === 'short') return 'short'
  if (variant === 'long' || variant === 'extended') return 'long'
  return 'standard'
}

/**
 * The symbol for one weapon as built (5, 6).
 *
 * Rating, range line and the multi-stage option all change which symbol the
 * sheet prints, so all three are read off the mounting rather than assumed.
 */
export function iconForWeapon(weapon: Pick<WeaponDef, 'weaponClass' | 'rating' | 'variant'>): IconId | null {
  const { weaponClass, rating, variant } = weapon
  const l = line(variant)

  switch (weaponClass) {
    // --- 5.3 – 5.13, the classed beam families -----------------------------
    case 'beam':
      return clampToSheet((n) => `class-${n}-beam`, rating)
    case 'emp':
      return clampToSheet((n) => `class-${n}-emp-projector`, rating)
    case 'graser':
      return clampToSheet((n) => `class-${n}-graser`, rating)
    case 'heavy-graser':
      return clampToSheet((n) => `class-${n}-heavy-graser`, rating)
    case 'phaser':
      return clampToSheet((n) => `class-${n}-phaser`, rating)
    case 'needle-beam':
      return clampToSheet((n) => `class-${n}-needle-beam`, rating)
    case 'plasma-cannon':
      return clampToSheet((n) => `class-${n}-plasma-cannon`, rating)
    case 'gravitic-gun':
      return clampToSheet((n) => `class-${n}-gravitic-gun`, rating)
    case 'transporter':
      return clampToSheet((n) => `class-${n}-transporter-beam`, rating)
    case 'plasma-bolt-launcher':
      return clampToSheet((n) => `class-${n}-plasma-bolt-launcher`, rating)

    // --- 5.16, the one family the sheet draws all six classes of ------------
    case 'k-gun':
      return clampToSheet(
        (n) =>
          l === 'short'
            ? `class-${n}-short-range-k-gun`
            : l === 'long'
              ? `class-${n}-long-range-k-gun`
              : `class-${n}-k-gun`,
        rating,
      )

    // --- 5.14, 5.21: a range line rather than a class -----------------------
    case 'pulse-torpedo':
      // 5.14's Variable Strength tube picks its line in orders, so on the sheet
      // it is the plain tube: what it is set to is a per-turn thing and belongs
      // on the order panel, not printed on the hull.
      return known(
        l === 'short'
          ? 'short-range-pulse-torpedos'
          : l === 'long'
            ? 'long-range-pulse-torpedos'
            : 'pulse-torpedos',
      )
    case 'pulser':
      return known(
        l === 'short'
          ? 'pulser-short-range'
          : l === 'long'
            ? 'pulser-long-range'
            : 'pulser-medium-range',
      )

    // --- 5.10 – 5.20, the unclassed mounts ----------------------------------
    case 'gatling':
      return known('gatling-battery')
    case 'twin-particle-array':
      return known('twin-particle-array')
    case 'meson-projector':
      return known('meson-projector')
    case 'mkp':
      return known('multiple-kinetic-penetrator')
    case 'fusion-array':
      return known('fusion-array')
    case 'submunition-pack':
      return known('turreted-submunitions-pack')
    case 'boarding-torpedo':
      return known('boarding-torpedo-launcher')

    // --- 5.23, 7.23, 7.24: the spinal mounts --------------------------------
    // The sheet draws a spinal beam in three lengths and marks the Nova Cannon
    // and Wave Gun deprecated. They are in the rules and on the roster, so they
    // get their symbols; "deprecated" is the sheet's opinion of the weapon, not
    // a statement that it cannot be drawn.
    case 'spinal-beam':
    case 'spinal-plasma':
    case 'spinal-psp':
      return known(
        rating >= 3
          ? 'spinal-mount-beam-long-range'
          : rating === 2
            ? 'spinal-mount-beam-medium-range'
            : 'spinal-mount-beam-short-range',
      )
    case 'nova-cannon':
      return known('spinal-mount-nova-cannon-deprecated')
    case 'wave-gun':
      return known('spinal-mount-wave-gun-deprecated')

    // --- 6, the ordnance mountings ------------------------------------------
    case 'heavy-missile':
      return known(
        variant === 'two-stage'
          ? 'heavy-missile-multistage'
          : l === 'long'
            ? 'heavy-missile-long-range'
            : 'heavy-missile',
      )
    case 'salvo-missile-launcher':
      return known('salvo-missile-launcher')
    case 'salvo-missile-rack':
      return known(
        variant === 'two-stage'
          ? 'salvo-missile-rack-single-use-multistage'
          : l === 'long'
            ? 'salvo-missile-rack-single-use-long-range'
            : 'salvo-missile-rack-single-use',
      )
    case 'antimatter-missile':
      return known('antimatter-missile')
    case 'rocket-pod':
      return known('rocket-pod')
    case 'mine-rack':
      return known('mine-layer')
  }
  // Adding a weapon class to the engine breaks this line rather than shipping a
  // hull with a blank where the gun should be.
  const unhandled: never = weaponClass
  return unhandled
}

/**
 * The symbol for one fitted system (7, 13.12, 13.13).
 *
 * A few kinds map onto a symbol whose printed name is not the engine's name —
 * the engine's `marine-party` is the sheet's "Extra Marines", its `pds` is the
 * sheet's "Point Defense System" — so the correspondence is written out rather
 * than derived from the string, which would silently miss.
 */
const SYSTEM_ICONS: Record<SystemKind, string | null> = {
  // Targeting (4.4, 5.2)
  firecon: 'fire-control',
  'advanced-firecon': 'advanced-fire-control',
  // Point and area defence (7.10 – 7.15)
  pds: 'point-defense-system',
  ads: 'area-defense-system',
  adfc: 'area-defense-fire-control',
  'advanced-adfc': 'advanced-area-defense-fire-control',
  scattergun: 'scatter-gun',
  grapeshot: 'grapeshot-launcher',
  // Electronic warfare and stealth (7.4, 7.5, 7.17 – 7.19)
  ecm: 'ecm-device',
  'area-ecm': 'area-ecm-device',
  'stealth-field': 'stealth-field-generator',
  holofield: 'holofield-generator',
  // Cloaks (7.20 – 7.22)
  'cloaking-device': 'cloaking-device',
  'cloaking-field': 'cloaking-field',
  // 7.22's Tuffley Cloak has no symbol of its own; it behaves as a total cloak
  // and the sheet's Cloaking Field is the total-cloak symbol.
  'tuffley-cloak': 'cloaking-field',
  'reflex-field': 'reflex-field-deprecated',
  // Sensors (12.1, 12.2, 13.13)
  'enhanced-sensors': 'advanced-sensors',
  'superior-sensors': 'superior-sensors',
  'dummy-bogey': 'cruiser-decoy',
  'weasel-emitter': 'vapour-shroud',
  // Carrier and small-craft plant (13.12)
  'hangar-bay': 'hangar-bay',
  'launch-tube': 'launch-tube',
  catapult: 'launch-tubew-catapult',
  'fighter-rack': 'fighter-rack',
  'gunboat-rack': 'gunboat-rack',
  'gunboat-bay': 'boat-bay',
  'boat-bay': 'boat-bay',
  tender: 'tender-bay',
  // Secondary systems (13.13)
  cargo: 'cargo-hold',
  'passenger-berthing': 'passenger-berth',
  'troop-berthing': 'troop-berth',
  minesweeper: 'mine-sweeper',
  ortillery: 'ortillery-system',
  // 13.13's Shipyard has no symbol on the sheet; a cargo hold is the nearest
  // honest thing and is what a yard mostly is.
  shipyard: 'cargo-hold',
  'damage-control-party': 'extra-damage-control',
  'marine-party': 'extra-marines',
  'antimatter-charge': 'antimatter-suicide-charge',
  // 7.4's stealth hull is the hull itself rather than a box on it, so it has no
  // symbol; the SSD says so in the stats line instead.
  'stealth-hull': null,
  // Screens and the FTL drive are drawn from the design rather than from a
  // system entry, because their symbol depends on level and grade.
  'screen-generator': null,
  'ftl-drive': null,
}

export function iconForSystem(kind: SystemKind): IconId | null {
  const id = SYSTEM_ICONS[kind]
  return id === null ? null : known(id)
}

/**
 * The symbol for a hangar bay, told apart by what is in it (8.15, 13.12).
 *
 * The sheet draws fourteen bays because a carrier's punch is the wing rather
 * than the bay, and a player looking at a hull wants to know whether the thing
 * launching at them is an interceptor screen or a torpedo strike. 8.15's Light
 * modification has its own three symbols; the rest of the modifications change
 * the fighter and not the bay.
 */
export function iconForFighterBay(typeId: string, modifiers: readonly string[] = []): IconId {
  const light = modifiers.includes('light')
  if (light) {
    const lit = known(
      typeId === 'attack'
        ? 'hangar-bay-light-attack-fighter'
        : typeId === 'interceptor'
          ? 'hangar-bay-light-interceptor'
          : 'hangar-bay-light-fighter',
    )
    if (lit !== null) return lit
  }
  const named = known(
    typeId === 'assault-shuttle'
      ? 'hangar-bay-assault-shuttles'
      : typeId === 'interceptor'
        ? 'hangar-bay-interceptor'
        : `hangar-bay-${typeId}-fighter`,
  )
  // An unknown fighter type is still carried in a bay, and a plain bay is the
  // true thing to draw rather than a guess at which one.
  return named ?? 'hangar-bay'
}

/** The screen symbol for a hull's screens as built (7.2, 7.3, 7.16). */
export function iconForScreen(
  screens: ShipDesign['screens'],
  opts: { area?: boolean } = {},
): IconId | null {
  const area = opts.area === true
  if (area && !screens.area) return null
  const advanced = area ? screens.area?.advanced === true : screens.advanced
  const level = area ? (screens.area?.level ?? 1) : screens.level
  const stem = `${advanced ? 'advanced-' : ''}${area ? 'area-' : ''}defensive-screen`
  return known(level === 1 || level === 2 ? `${stem}-level-${level}` : `${stem}-unleveled`)
}

/** The main drive symbol; the sheet prints the thrust rating inside it (3.2). */
export function iconForDrive(advanced: boolean): IconId | null {
  return known(advanced ? 'main-drive-advanced' : 'main-drive')
}

/** The FTL drive symbol, or null on a ship that has none (11.1). */
export function iconForFtl(ftl: ShipDesign['ftl']): IconId | null {
  if (ftl === 'none') return null
  return known(ftl === 'advanced' ? 'faster-than-light-drive-advanced' : 'faster-than-light-drive')
}

/**
 * The hull and armour box symbols (2.4, 4.8, 4.9, 7.7, 7.8).
 *
 * A crew star is a hull box that also carries a crew factor (10.4), and the
 * sheet draws it as its own symbol rather than as a box with something on top.
 */
export function iconForHullBox(opts: { marked: boolean; crew: boolean }): IconId {
  if (opts.marked) return 'hull-box-damaged'
  return opts.crew ? 'hull-box-crew-star' : 'hull-box'
}

export function iconForArmourBox(opts: {
  marked: boolean
  regenerative: boolean
  burntOut: boolean
}): IconId {
  if (!opts.regenerative) return opts.marked ? 'armour-damaged' : 'armour'
  // 7.8: a regenerative box that rolled a 1 "cannot regenerate further this
  // battle", and the sheet gives that its own symbol — which is the whole
  // reason a player watches the armour row.
  if (opts.burntOut) return 'armour-regenerative-lost'
  return opts.marked ? 'armour-regenerative-damaged' : 'armour-regenerative'
}

/**
 * Every weapon class the engine can build.
 *
 * Written as a record rather than an array so the compiler, not a reviewer,
 * notices when the engine grows a weapon this file has not been told about.
 */
const WEAPON_CLASSES: Record<WeaponClass, true> = {
  beam: true, emp: true, 'plasma-cannon': true, graser: true, 'heavy-graser': true,
  phaser: true, transporter: true, gatling: true, 'twin-particle-array': true,
  'meson-projector': true, 'needle-beam': true, 'pulse-torpedo': true,
  'submunition-pack': true, 'k-gun': true, mkp: true, 'boarding-torpedo': true,
  'fusion-array': true, 'gravitic-gun': true, pulser: true, 'spinal-beam': true,
  'spinal-plasma': true, 'spinal-psp': true, 'nova-cannon': true, 'wave-gun': true,
  'heavy-missile': true, 'salvo-missile-rack': true, 'salvo-missile-launcher': true,
  'antimatter-missile': true, 'rocket-pod': true, 'plasma-bolt-launcher': true,
  'mine-rack': true,
}

export const ALL_WEAPON_CLASSES: readonly WeaponClass[] = Object.keys(
  WEAPON_CLASSES,
) as WeaponClass[]

/** Every system kind the engine can fit — the keys of the table above. */
export const ALL_SYSTEM_KINDS: readonly SystemKind[] = Object.keys(
  SYSTEM_ICONS,
) as SystemKind[]

/**
 * The kinds that deliberately have no symbol.
 *
 * Read off the table rather than listed again, so the two cannot disagree:
 * 7.4's stealth hull is the hull's own shaping, and the screen generator and
 * FTL drive are drawn from `design.screens` and `design.ftl`, whose level and
 * grade pick which symbol they get.
 */
export const SYMBOL_LESS_KINDS: ReadonlySet<SystemKind> = new Set<SystemKind>(
  (Object.keys(SYSTEM_ICONS) as SystemKind[]).filter((k) => SYSTEM_ICONS[k] === null),
)
