import { CORE_SYSTEM_IDS } from '../../engine/threshold'
import type { Arc, ShipDesign, SystemDef, WeaponDef } from '../../engine/types'
import { turretMountedArcs } from '../../engine/weapons/kinetics'
import { arcBearing, bearsSomewhere } from './bearing'
import {
  CARRIER_KINDS,
  COUNTER_EXTENT,
  HULL_MARGIN,
  boxInsideOutline,
  deckBeamFraction,
  halfBeamAt,
  hullPath,
  hullPlan,
  hullShape,
  normalisation,
  normalisePlan,
  outlinePolyline,
  type HullPlan,
} from './geometry'
import {
  iconForDrive,
  iconForFighterBay,
  iconForFtl,
  iconForScreen,
  iconForSystem,
  iconForWeapon,
} from './iconFor'
import { weaponWeight } from './weight'

/**
 * Laying a ship out the way it was built.
 *
 * The old sheet listed a ship's weapons as text and left the player to work
 * out where they pointed. This puts every mounting where it can actually shoot:
 * a bow battery draws at the bow, a port broadside runs down the port side, an
 * all-round mount sits on the keel. Nothing here is decoration — the position
 * of a symbol on this sheet is a fact about the ship, and it is the same fact
 * the firing rules read.
 *
 * The order of work matters and is the reason this fits on every hull in the
 * game. The ship's guts are laid out first, in bands down the keel; only then
 * is a hull drawn around them, wide enough at every point that the plating
 * clears the widest row. So there is no collision to resolve and no design
 * that fails to lay out — the hull yields to the contents rather than the
 * contents being squeezed into a hull.
 *
 * Reading down the keel, the bands are the ones the book's own sheets have:
 * the bow, the forward flanks, the all-round mounts, the guts, the aft flanks,
 * the hangars, the stern battery, then the bottom row — *"the symbols for the
 * FTL and main drive, and the … Core Systems"* (2.4).
 */

export type GlyphState = 'live' | 'fired' | 'destroyed' | 'degraded' | 'absent'

/** One symbol's box in a laid-out ship, in the plan's own coordinates. */
export interface PlacedGlyph {
  key: string
  icon: string
  label: string
  kind: 'weapon' | 'system' | 'bay' | 'screen' | 'drive' | 'ftl' | 'core' | 'flaw'
  /** Centre of the box. */
  x: number
  y: number
  width: number
  height: number
  /** The number this ship's copy carries — a drive's thrust, a hold's mass. */
  value?: number
  /** A weapon's size relative to a class-3 mount; the counter draws it so too. */
  weight?: number
  /** Which way it bears, for the arc rosette. Absent on anything unarmed. */
  arcs?: readonly Arc[]
  /** Where the rosette goes, when there is one: under the symbol. */
  rose: { x: number; y: number; radius: number } | null
  state: GlyphState
  /**
   * The Core Systems block is one symbol with three systems in it (10.3), and
   * each is crossed off on its own. `fx` is how far across the box each sits.
   */
  cells?: ReadonlyArray<{ key: string; label: string; fx: number; state: GlyphState }>
}

export interface SsdPlan {
  hull: HullPlan
  /** The outline, drawn nose-up about the origin. */
  path: string
  /** The same outline in a ±1000 box, for the counter. */
  counterPath: string
  /** 5.23: the spinal mount's run, from the breech to the muzzle. */
  spine: { x: number; y1: number; y2: number } | null
  glyphs: PlacedGlyph[]
  /** Where one band ends and the next begins: the ship's frames. */
  frames: number[]
  viewBox: string
}

/** What the sheet knows about a ship's damage when it draws it. */
export interface PlanDamage {
  /** Ids crossed off the SSD — weapons, systems, the core's three (4.11, 10.3). */
  destroyed: ReadonlySet<string>
  fired?: ReadonlySet<string>
  /** Current thrust, which halves on the drive's first threshold loss (4.11). */
  thrust?: number
}

// ---------------------------------------------------------------------------
// Bands
// ---------------------------------------------------------------------------

type BandId =
  | 'bow'
  | 'forward'
  | 'midships'
  | 'core'
  | 'aft'
  | 'bays'
  | 'stern'
  | 'keel'
  | 'drives'
type Side = 'port' | 'centre' | 'starboard'

const BAND_ORDER: readonly BandId[] = [
  'bow',
  'forward',
  'midships',
  'core',
  'aft',
  'bays',
  'stern',
  'keel',
  'drives',
]

/** Bands whose contents run down the sides of the hull rather than across it. */
const FLANK_BANDS: ReadonlySet<BandId> = new Set<BandId>(['forward', 'aft'])

function station(arcs: readonly Arc[]): { band: BandId; side: Side } {
  if (!bearsSomewhere(arcs)) return { band: 'midships', side: 'centre' }
  switch (arcBearing(arcs).sector) {
    case 0:
      return { band: 'bow', side: 'centre' }
    case 1:
      return { band: 'forward', side: 'starboard' }
    case 2:
      return { band: 'aft', side: 'starboard' }
    case 3:
      return { band: 'stern', side: 'centre' }
    case 4:
      return { band: 'aft', side: 'port' }
    default:
      return { band: 'forward', side: 'port' }
  }
}

// ---------------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------------

/**
 * Box sides, in plan units.
 *
 * Not one size. A weapon is what a player is looking for, so it is the
 * biggest thing on the deck — and a big weapon is bigger than a small one,
 * `weapon` being the side of a class-3 mount and `weaponWeight` scaling it
 * either way; the drive is bigger still because its number is the ship's
 * speed; a fitting is a fitting. The Core Systems block is the sheet's 3:1
 * symbol at the width of three fittings.
 */
const SIZE = {
  weapon: 42,
  system: 32,
  bay: 36,
  screen: 32,
  drive: 46,
  ftl: 36,
  flaw: 32,
} as const
const CORE_WIDTH = 116
const CORE_HEIGHT = 39
/** Space between two symbols in a row. */
const GAP = 8
/** Space either side of the keel, so a broadside battery is visibly abeam. */
const SPINE_HALF = 22
/**
 * Room under a weapon for its arc rosette.
 *
 * Under and not over the top of it: the sheet already draws a number inside
 * most weapon symbols, and a rosette laid over that hides the one thing the
 * symbol was drawn to say. Length is the cheap direction on a ship anyway.
 */
const ROSE_BAND = 21
const ROSE_RADIUS = 10
/** Space between two bands, which is where the ship's frames are drawn. */
const BAND_GAP = 18
/**
 * Clear deck kept fore and aft of the contents.
 *
 * The hull is at its widest at the shoulder and the quarter, and those are
 * exactly the two places a curved outline pulls in most as it rounds the
 * corner. Keeping the contents off both ends means the fore and aft rows never
 * have to argue with the corner they are sitting in.
 */
const DECK_INSET = 15
/**
 * Symbols across before a band wraps.
 *
 * The hull has to be wide enough for its widest band, so this is what decides
 * how fat every ship looks. Four keeps a cruiser reading as a cruiser; six had
 * them all coming out as coffins. A station is not a ship and is not laid out
 * like one — it has no bow and is drawn as an octagon — so it is allowed to be
 * the squat thing it is.
 */
const SHIP_ACROSS = 4
const STATION_ACROSS = 7

// ---------------------------------------------------------------------------
// Gathering what is on the ship
// ---------------------------------------------------------------------------

interface Item {
  key: string
  icon: string
  label: string
  kind: PlacedGlyph['kind']
  value?: number
  arcs?: readonly Arc[]
  state: GlyphState
  width: number
  height: number
  band: BandId
  side: Side
  /** Where it sorts among the guts, so like sits with like. */
  order: number
  /** A weapon's size relative to a class-3 mount; 1 for everything else. */
  weight: number
  cells?: PlacedGlyph['cells']
}

/**
 * How the guts are ordered amidships.
 *
 * Targeting first, then what the ship sees and hides with, then screens, then
 * point defence, then the crew and the holds. The same order on every sheet,
 * so a player who has read one ship has read them all — and identical
 * fittings sit together, which is what makes a row of four PDS read as "four
 * PDS" instead of four things to count.
 */
const GUTS_ORDER: readonly string[] = [
  'firecon',
  'advanced-firecon',
  'adfc',
  'advanced-adfc',
  'enhanced-sensors',
  'superior-sensors',
  'ecm',
  'area-ecm',
  'holofield',
  'stealth-field',
  'cloaking-device',
  'cloaking-field',
  'tuffley-cloak',
  'reflex-field',
  'screen',
  'area-screen',
  'pds',
  'ads',
  'scattergun',
  'grapeshot',
  'minesweeper',
  'ortillery',
  'damage-control-party',
  'marine-party',
  'antimatter-charge',
  'dummy-bogey',
  'weasel-emitter',
  'cargo',
  'passenger-berthing',
  'troop-berthing',
  'shipyard',
  'flaw',
]

function orderOf(kind: string): number {
  const index = GUTS_ORDER.indexOf(kind)
  return index < 0 ? GUTS_ORDER.length : index
}

/**
 * Systems the sheet draws once with a number in them rather than once each.
 *
 * The sheet's Cargo Hold has a number printed inside it, and it means the mass
 * held — so a liner with twenty mass of cargo is one hold that says 20, not
 * twenty holds. Drawing it the other way is what turns a merchantman's sheet
 * into a wall of identical boxes.
 */
const COUNTED_KINDS = new Set(['cargo', 'passenger-berthing', 'troop-berthing', 'boat-bay', 'tender'])

/** The arcs a mounting actually bears through, turret and all (4.2, 5.22). */
function arcsOf(design: ShipDesign, weapon: WeaponDef): readonly Arc[] {
  if (weapon.turretId === undefined) return weapon.arcs
  const turret = design.turrets.find((t) => t.id === weapon.turretId)
  // 5.22: "Weapons with more than 1 arc that are mounted in a turret lose
  // their additional arcs" — the turret's traverse is what the gun has.
  return turret === undefined ? weapon.arcs : turretMountedArcs(weapon, turret)
}

/** The class a symbol prints, where it prints one. */
const PRINTED_CLASS = /^class-(\d)-/

function weaponItems(design: ShipDesign, damage: PlanDamage): Item[] {
  const items: Item[] = []
  for (const weapon of design.weapons) {
    const icon = iconForWeapon(weapon)
    if (icon === null) continue
    const arcs = arcsOf(design, weapon)
    const where = station(arcs)
    // The sheet prints the class inside the symbol. Where the gun's rating is
    // one the sheet does not carry — a Beam-5 on a sheet that stops at 4 —
    // the true rating is drawn over the digit rather than a lower one shown,
    // because that digit is the number of dice the gun rolls.
    const printed = PRINTED_CLASS.exec(icon)
    const value =
      printed !== null && Number(printed[1]) !== Math.round(weapon.rating)
        ? Math.round(weapon.rating)
        : undefined
    const weight = weaponWeight(weapon)
    const side = round(SIZE.weapon * weight)
    items.push({
      key: weapon.id,
      icon,
      label: weapon.turretId === undefined ? weapon.label : `${weapon.label} (turret ${weapon.turretId})`,
      kind: 'weapon',
      value,
      arcs,
      state: damage.destroyed.has(weapon.id)
        ? 'destroyed'
        : damage.fired?.has(weapon.id)
          ? 'fired'
          : 'live',
      width: side,
      height: side,
      band: where.band,
      side: where.side,
      order: 0,
      weight,
    })
  }
  return items
}

function systemItems(design: ShipDesign, damage: PlanDamage): Item[] {
  const items: Item[] = []
  const counted = new Map<string, { live: number; total: number; system: SystemDef }>()
  // A wing rides in a bay: the i-th fighter group is in the i-th hangar, the
  // i-th gunboat squadron on the i-th rack (8.2, 9.1). Drawn once, as the bay,
  // with what is in it choosing the symbol — not as a bay and then a wing.
  let hangars = 0
  let racks = 0

  for (const system of design.systems) {
    if (system.kind === 'screen-generator' || system.kind === 'ftl-drive') continue
    if (system.kind === 'stealth-hull') continue
    let icon = iconForSystem(system.kind)
    if (icon === null) continue
    const dead = damage.destroyed.has(system.id)

    if (COUNTED_KINDS.has(system.kind)) {
      const seen = counted.get(system.kind) ?? { live: 0, total: 0, system }
      seen.total += 1
      if (!dead) seen.live += 1
      counted.set(system.kind, seen)
      continue
    }

    let label = system.label
    if (system.kind === 'hangar-bay') {
      const wing = design.fighterBays[hangars]
      hangars += 1
      if (wing !== undefined) {
        icon = iconForFighterBay(wing.typeId, wing.modifiers ?? [])
        label = wing.label
      }
    } else if (system.kind === 'gunboat-rack' || system.kind === 'gunboat-bay') {
      const squadron = design.gunboats[racks]
      racks += 1
      if (squadron !== undefined) {
        icon = system.kind === 'gunboat-rack' ? 'gunboat-rack-occupied-sample' : icon
        label = squadron.label
      }
    }

    const bay = CARRIER_KINDS.has(system.kind)
    const where =
      system.arcs !== undefined && system.arcs.length > 0
        ? station(system.arcs)
        : { band: 'core' as BandId, side: 'centre' as Side }
    items.push({
      key: system.id,
      icon,
      label,
      kind: bay ? 'bay' : 'system',
      arcs: system.arcs,
      state: dead ? 'destroyed' : 'live',
      width: bay ? SIZE.bay : SIZE.system,
      height: bay ? SIZE.bay : SIZE.system,
      band: bay ? 'bays' : where.band,
      side: bay ? 'centre' : where.side,
      order: orderOf(system.kind),
      weight: 1,
    })
  }

  // A wing with no hangar to ride in is a design fault the yard reports, but
  // it is still aboard, so it is still drawn rather than lost.
  design.fighterBays.slice(hangars).forEach((wing, i) => {
    items.push({
      key: `wing-${hangars + i}`,
      icon: iconForFighterBay(wing.typeId, wing.modifiers ?? []),
      label: `${wing.label} (no hangar)`,
      kind: 'bay',
      state: 'live',
      width: SIZE.bay,
      height: SIZE.bay,
      band: 'bays',
      side: 'centre',
      order: 0,
      weight: 1,
    })
  })
  design.gunboats.slice(racks).forEach((squadron, i) => {
    items.push({
      key: `squadron-${racks + i}`,
      icon: 'gunboat-rack-occupied-sample',
      label: `${squadron.label} (no rack)`,
      kind: 'bay',
      state: 'live',
      width: SIZE.bay,
      height: SIZE.bay,
      band: 'bays',
      side: 'centre',
      order: 0,
      weight: 1,
    })
  })

  for (const [kind, tally] of counted) {
    const icon = iconForSystem(tally.system.kind)
    if (icon === null) continue
    const bay = CARRIER_KINDS.has(kind)
    items.push({
      key: `count-${kind}`,
      icon,
      label: `${tally.system.label} ×${tally.total}`,
      kind: bay ? 'bay' : 'system',
      value: tally.live,
      // All of them gone is a destroyed system; some of them gone is a ship
      // still carrying cargo, and saying otherwise would be a lie about a
      // number the player is reading off the box.
      state: tally.live === 0 ? 'destroyed' : tally.live < tally.total ? 'degraded' : 'live',
      width: bay ? SIZE.bay : SIZE.system,
      height: bay ? SIZE.bay : SIZE.system,
      band: bay ? 'bays' : 'core',
      side: 'centre',
      order: orderOf(kind),
      weight: 1,
    })
  }

  return items
}

function plantItems(design: ShipDesign, damage: PlanDamage): Item[] {
  const items: Item[] = []

  // Screens are drawn from the design rather than from the system list, because
  // which of the six screen symbols is right depends on level and grade (7.2,
  // 7.3, 7.16) rather than on the entry that pays for it. Which generators are
  // still up is read from the same set as everything else on the sheet.
  const generators = design.systems.filter((s) => s.kind === 'screen-generator')
  const screenIcon = iconForScreen(design.screens)
  if (screenIcon !== null && design.screens.level > 0) {
    generators.forEach((generator, index) => {
      items.push({
        key: generator.id,
        icon: screenIcon,
        label: index < design.screens.level ? generator.label : `${generator.label} (backup)`,
        kind: 'screen',
        state: damage.destroyed.has(generator.id) ? 'destroyed' : 'live',
        width: SIZE.screen,
        height: SIZE.screen,
        band: 'core',
        side: 'centre',
        order: orderOf('screen'),
        weight: 1,
      })
    })
  }
  const areaIcon = iconForScreen(design.screens, { area: true })
  if (areaIcon !== null) {
    items.push({
      key: 'area-screen',
      icon: areaIcon,
      label: 'Area defensive screen',
      kind: 'screen',
      state: 'live',
      width: SIZE.screen,
      height: SIZE.screen,
      band: 'core',
      side: 'centre',
      order: orderOf('area-screen'),
      weight: 1,
    })
  }

  // 13.13's Flawed Design is on the sheet as the sheet's own symbol, because a
  // player reading the threshold tab needs to know why it is a pip lower.
  if (design.flawed === true) {
    items.push({
      key: 'flawed-design',
      icon: 'flawed-design',
      label: 'Flawed design (13.13)',
      kind: 'flaw',
      state: 'live',
      width: SIZE.flaw,
      height: SIZE.flaw,
      band: 'core',
      side: 'centre',
      order: orderOf('flaw'),
      weight: 1,
    })
  }

  // 10.3: every hull has the block — "assumed to be part of the essential
  // structure of all ships" — so every sheet draws it, in the bottom row where
  // 2.4 puts it. A design that names its own block and leaves one out gets
  // that cell dimmed rather than the block redrawn: the symbol is the book's.
  const core = design.coreSystems
  const cellState = (fitted: boolean, id: string): GlyphState =>
    !fitted ? 'absent' : damage.destroyed.has(id) ? 'destroyed' : 'live'
  const cells = [
    { key: CORE_SYSTEM_IDS.bridge, label: 'Bridge', fx: 0.258, state: cellState(core?.bridge ?? true, CORE_SYSTEM_IDS.bridge) },
    { key: CORE_SYSTEM_IDS.lifeSupport, label: 'Life support', fx: 0.5, state: cellState(core?.lifeSupport ?? true, CORE_SYSTEM_IDS.lifeSupport) },
    { key: CORE_SYSTEM_IDS.powerCore, label: 'Power core', fx: 0.742, state: cellState(core?.powerCore ?? true, CORE_SYSTEM_IDS.powerCore) },
  ]
  items.push({
    key: 'core-systems',
    icon: 'core-systems',
    label: 'Core systems: bridge, life support, power core',
    kind: 'core',
    state: cells.every((c) => c.state === 'destroyed') ? 'destroyed' : 'live',
    width: CORE_WIDTH,
    height: CORE_HEIGHT,
    band: 'keel',
    side: 'centre',
    order: 0,
    weight: 1,
    cells,
  })

  // The bottom row: FTL and the main drive, and the number inside the drive is
  // what the ship can actually manage now rather than what it was built with.
  const ftlIcon = iconForFtl(design.ftl)
  if (ftlIcon !== null) {
    const ftlSystem = design.systems.find((s) => s.kind === 'ftl-drive')
    items.push({
      key: ftlSystem?.id ?? 'ftl',
      icon: ftlIcon,
      label: design.ftl === 'tug' ? 'FTL drive (tug)' : 'FTL drive',
      kind: 'ftl',
      state:
        ftlSystem !== undefined && damage.destroyed.has(ftlSystem.id) ? 'destroyed' : 'live',
      width: SIZE.ftl,
      height: SIZE.ftl,
      band: 'drives',
      side: 'centre',
      order: 0,
      weight: 1,
    })
  }
  const driveIcon = iconForDrive(design.drive.advanced)
  if (driveIcon !== null) {
    const thrust = damage.thrust ?? design.drive.thrust
    items.push({
      key: 'drive',
      icon: driveIcon,
      label: design.drive.advanced ? 'Main drive (advanced)' : 'Main drive',
      kind: 'drive',
      value: thrust,
      state: thrust < design.drive.thrust ? 'degraded' : 'live',
      width: SIZE.drive,
      height: SIZE.drive,
      band: 'drives',
      side: 'centre',
      order: 1,
      weight: 1,
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// The flow
// ---------------------------------------------------------------------------

interface Row {
  items: Item[]
  /** Half the width the row needs. */
  halfWidth: number
  /** How tall the row is: taller when something in it carries a rosette. */
  height: number
  flank: boolean
}

function armed(item: Item): boolean {
  return item.arcs !== undefined && item.arcs.length > 0
}

/** The tallest symbol in a row: what the row's symbols are centred on. */
function symbolHeight(items: Item[]): number {
  return Math.max(...items.map((item) => item.height))
}

function rowWidth(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.width, 0) + (items.length - 1) * GAP
}

function rowOf(items: Item[], halfWidth: number, flank: boolean): Row {
  // The symbols sit centred on the tallest of them, and the rosettes go in a
  // band under all of them — on one line, whatever the guns above them weigh.
  return {
    items,
    halfWidth,
    height: symbolHeight(items) + (items.some(armed) ? ROSE_BAND : 0),
    flank,
  }
}

/** Heaviest first; among equals, like beside like; among those, as built. */
function byWeight(a: Item, b: Item): number {
  return b.weight - a.weight || a.icon.localeCompare(b.icon)
}

/**
 * A row arranged the way a battery is built: the heaviest gun on the centre
 * line, the next pair either side of it, and so on outward — so a pair reads
 * as a pair, a triple as a big gun flanked by two smaller ones, and a mixed
 * row is symmetric about the keel in weight. A row whose weights are all the
 * same is left in the order it was built, which for the guts amidships is the
 * one order every sheet shares.
 */
function symmetric(items: Item[]): Item[] {
  if (items.length < 2 || items.every((item) => item.weight === items[0].weight)) return items
  const sorted = [...items].sort(byWeight)
  const left: Item[] = []
  const right: Item[] = []
  sorted.forEach((item, index) => {
    if (index === 0) return
    if (index % 2 === 1) left.push(item)
    else right.push(item)
  })
  return [...left.reverse(), sorted[0], ...right]
}

/**
 * Split a band's contents into rows of nearly equal length.
 *
 * Filling rows greedily gave a band of ten fittings as four, four and two,
 * which reads as three rows and a mistake. Ten is four, three and three: the
 * rows differ by one at most, the longer ones forward, and the whole band is
 * as close to a rectangle as the count allows. Symmetry is not decoration on a
 * sheet — a ragged block is one the eye has to count.
 */
function balancedRows(items: Item[], across: number): Item[][] {
  if (items.length === 0) return []
  const rows = Math.ceil(items.length / across)
  const base = Math.floor(items.length / rows)
  const extra = items.length % rows
  const out: Item[][] = []
  let at = 0
  for (let row = 0; row < rows; row += 1) {
    const size = base + (row < extra ? 1 : 0)
    out.push(items.slice(at, at + size))
    at += size
  }
  return out
}

/** Break a band's contents into rows, keeping port to port and starboard to starboard. */
function bandRows(band: BandId, items: Item[], across: number): Row[] {
  if (items.length === 0) return []

  if (FLANK_BANDS.has(band)) {
    // A broadside runs fore-and-aft along the side it fires from, which is
    // where it would actually be bolted — heaviest gun forward on each side,
    // so two matching broadsides come out as mirror images.
    const port = items.filter((i) => i.side === 'port').sort(byWeight)
    const starboard = items.filter((i) => i.side !== 'port').sort(byWeight)
    const rows: Row[] = []
    for (let i = 0; i < Math.max(port.length, starboard.length); i += 1) {
      const pair = [port[i], starboard[i]].filter((x): x is Item => x !== undefined)
      rows.push(rowOf(pair, SPINE_HALF + Math.max(...pair.map((x) => x.width)), true))
    }
    return rows
  }

  // Like with like down the keel, and within a kind the heaviest forward: a
  // band of five guns is a row of three big ones over a row of two.
  const ordered = [
    ...items.filter((i) => i.side === 'port'),
    ...items.filter((i) => i.side === 'centre').sort((a, b) => a.order - b.order || byWeight(a, b)),
    ...items.filter((i) => i.side === 'starboard'),
  ]
  return balancedRows(ordered, across).map((row) => {
    const arranged = symmetric(row)
    return rowOf(arranged, rowWidth(arranged) / 2, false)
  })
}

/**
 * Lay a design out as a ship.
 *
 * Pure and total: the same design gives the same picture on every machine, and
 * there is no hull in the game — nor one the shipyard can build — that fails to
 * lay out, because the hull is drawn last and drawn to fit.
 */
export function planShip(design: ShipDesign, damage: PlanDamage = NO_DAMAGE): SsdPlan {
  const items = [
    ...weaponItems(design, damage),
    ...systemItems(design, damage),
    ...plantItems(design, damage),
  ]

  const shape = hullShape(design)
  const across = shape.radial ? STATION_ACROSS : SHIP_ACROSS

  const rows: Array<Row & { band: BandId }> = []
  for (const band of BAND_ORDER) {
    const inBand = items.filter((item) => item.band === band)
    for (const row of bandRows(band, inBand, across)) rows.push({ ...row, band })
  }

  // An empty ship still needs a hull to be nothing inside of.
  const contentHeight = Math.max(
    rows.reduce((sum, row) => sum + row.height + GAP, -GAP) +
      Math.max(0, countBands(rows) - 1) * BAND_GAP,
    SIZE.system,
  )
  const deckHeight = contentHeight + DECK_INSET * 2

  // Where each row sits, and therefore how pinched the hull is beside it. The
  // frames go between bands, halfway across the wider gap that marks one.
  let y = -contentHeight / 2
  let lastBand: BandId | null = null
  const frames: number[] = []
  const placedRows = rows.map((row) => {
    if (lastBand !== null && row.band !== lastBand) {
      frames.push(round(y - GAP / 2 + BAND_GAP / 2))
      y += BAND_GAP
    }
    lastBand = row.band
    const top = y
    y += row.height + GAP
    return { ...row, top }
  })

  const glyphs: PlacedGlyph[] = []
  for (const row of placedRows) {
    const tallest = symbolHeight(row.items)
    if (row.flank) {
      // Port to port, starboard to starboard, and the keel left clear between
      // them — which is where the spinal mount runs, when there is one.
      for (const item of row.items) {
        const sign = item.side === 'port' ? -1 : 1
        glyphs.push(place(item, sign * (SPINE_HALF + item.width / 2), row.top, tallest))
      }
      continue
    }
    let x = -rowWidth(row.items) / 2
    for (const item of row.items) {
      glyphs.push(place(item, x + item.width / 2, row.top, tallest))
      x += item.width + GAP
    }
  }

  // A broadside is a sponson: the plating bulges where the flank rows sit.
  const sponsons = mergeRuns(
    placedRows.filter((row) => row.flank).map((row) => [row.top, row.top + row.height] as const),
  )

  // The designer's own arrangement, where there is one: a symbol goes where
  // it was put, rosette and all, kept within the deck the rows laid out so
  // the hull drawn round it still has a nose and a tail. Sideways it may go
  // as far as it likes; the plating is let out to clear it below.
  const moved = applyLayout(design, glyphs, contentHeight)

  // The hull has to clear the widest row where that row actually sits — a row
  // over the pinched waist needs more beam than the same row at the shoulder.
  let beam = 40
  for (const row of placedRows) {
    const narrowest = Math.min(
      deckBeamFraction(shape, deckHeight, row.top),
      deckBeamFraction(shape, deckHeight, row.top + row.height),
    )
    beam = Math.max(beam, (row.halfWidth + HULL_MARGIN) / Math.max(narrowest, 0.2))
  }
  for (const g of moved) {
    const top = g.y - g.height / 2
    const bottom = g.rose === null ? g.y + g.height / 2 : g.rose.y + g.rose.radius
    const narrowest = Math.min(
      deckBeamFraction(shape, deckHeight, top),
      deckBeamFraction(shape, deckHeight, bottom),
    )
    beam = Math.max(beam, (Math.abs(g.x) + g.width / 2 + HULL_MARGIN) / Math.max(narrowest, 0.2))
  }

  // That beam is worked out from the hull's *profile*, which is a straight
  // reading of how pinched the hull is at a given point. A curved hull is
  // narrower than its profile wherever it rounds a corner, so the answer is
  // then checked against the outline as it will actually be drawn, and the
  // hull let out until every symbol clears the plating. Two passes are enough
  // for every design in the game; the loop is bounded so that a hull nobody
  // has built yet cannot hang the sheet.
  let hull = hullPlan(shape, deckHeight, beam, sponsons)
  for (let pass = 0; pass < (moved.length > 0 ? 14 : 6); pass += 1) {
    const outline = outlinePolyline(hull)
    const clear = glyphs.every((g) => {
      const top = g.y - g.height / 2
      const bottom = g.rose === null ? g.y + g.height / 2 : g.rose.y + g.rose.radius
      return boxInsideOutline(
        outline,
        g.x,
        (top + bottom) / 2,
        g.width + HULL_MARGIN * 2,
        bottom - top + 2,
      )
    })
    if (clear) break
    beam *= 1.06
    hull = hullPlan(shape, deckHeight, beam, sponsons)
  }

  // 5.23: the barrel runs from the breech to the muzzle, and on a real ship
  // that is most of its length. Drawn along the keel because that is where the
  // rules put it — a spinal mount fires dead ahead and nowhere else.
  const spine = shape.spine
    ? { x: 0, y1: hull.noseY + (hull.deckTop - hull.noseY) * 0.28, y2: hull.deckBottom * 0.35 }
    : null

  const pad = 6
  const width = hull.beam * 2 + pad * 2
  const height = hull.tailY - hull.noseY + pad * 2

  return {
    hull,
    path: hullPath(hull),
    counterPath: hullPath(normalisePlan(hull)),
    spine,
    glyphs,
    frames,
    viewBox: `${round(-hull.beam - pad)} ${round(hull.noseY - pad)} ${round(width)} ${round(height)}`,
  }
}

const NO_DAMAGE: PlanDamage = { destroyed: new Set<string>() }

/**
 * Put every symbol the designer moved where they put it (`ShipDesign.layout`).
 *
 * Returns the symbols that were moved. A position is clamped to the deck the
 * rows laid out — above the first row and below the last there is only the
 * nose and the tail — and a key the hull no longer carries is ignored.
 */
function applyLayout(design: ShipDesign, glyphs: PlacedGlyph[], contentHeight: number): PlacedGlyph[] {
  const layout = design.layout
  if (layout === undefined) return []
  const moved: PlacedGlyph[] = []
  for (const g of glyphs) {
    const at = layout[g.key]
    if (at === undefined || !Number.isFinite(at.x) || !Number.isFinite(at.y)) continue
    const roseBelow = g.rose === null ? 0 : g.rose.y + g.rose.radius - (g.y + g.height / 2)
    const y = Math.min(
      contentHeight / 2 - g.height / 2 - roseBelow,
      Math.max(-contentHeight / 2 + g.height / 2, at.y),
    )
    const dx = round(at.x) - g.x
    const dy = round(y) - g.y
    if (dx === 0 && dy === 0) continue
    g.x = round(g.x + dx)
    g.y = round(g.y + dy)
    if (g.rose !== null) g.rose = { ...g.rose, x: round(g.rose.x + dx), y: round(g.rose.y + dy) }
    moved.push(g)
  }
  return moved
}

function countBands(rows: Array<{ band: BandId }>): number {
  return new Set(rows.map((r) => r.band)).size
}

/** Adjacent or overlapping y ranges joined into one. */
function mergeRuns(runs: ReadonlyArray<readonly [number, number]>): Array<readonly [number, number]> {
  const sorted = [...runs].sort((a, b) => a[0] - b[0])
  const out: Array<readonly [number, number]> = []
  for (const run of sorted) {
    const last = out[out.length - 1]
    if (last !== undefined && run[0] <= last[1] + GAP + 1) {
      out[out.length - 1] = [last[0], Math.max(last[1], run[1])]
    } else {
      out.push(run)
    }
  }
  return out
}

/**
 * One symbol, centred on `x` and on the row's symbol line — a small gun in a
 * row of big ones sits level with them, not hung from the top — with its
 * rosette in the band under the tallest symbol in the row.
 */
function place(item: Item, x: number, top: number, tallest: number): PlacedGlyph {
  return {
    key: item.key,
    icon: item.icon,
    label: item.label,
    kind: item.kind,
    x: round(x),
    y: round(top + tallest / 2),
    width: item.width,
    height: item.height,
    value: item.value,
    weight: item.kind === 'weapon' ? item.weight : undefined,
    arcs: item.arcs,
    rose: armed(item)
      ? { x: round(x), y: round(top + tallest + ROSE_BAND / 2), radius: ROSE_RADIUS }
      : null,
    state: item.state,
    cells: item.cells,
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export { COUNTER_EXTENT }

// ---------------------------------------------------------------------------
// The counter
// ---------------------------------------------------------------------------

/**
 * The same ship at the size it appears on the table.
 *
 * Not a second drawing of the ship: the same outline, from the same layout,
 * scaled down — so a hull that reads as a long streamlined needle on its sheet
 * reads as one on the map, and a station reads as the octagon it is. What
 * survives the shrink is chosen for what reads at forty pixels: the outline
 * with its sponsons and gun deck, a filled bow so that facing is never in
 * doubt, a spinal mount's barrel, and the ship's guns — as dots where the
 * counter is big enough, as a bar across each battery where it is not.
 *
 * Coordinates are in a ±`COUNTER_EXTENT` box about the hull's own middle; the
 * caller scales by `radius / COUNTER_EXTENT`.
 */
export interface CounterSilhouette {
  path: string
  /** The forward part of the hull, filled: which way the bow points. */
  bow: string
  /** 5.23's barrel, when the ship is built around one. */
  spine: { y1: number; y2: number } | null
  /** True for a hull with no bow to point — a station, or a ship with no drive. */
  radial: boolean
  /** Every weapon, where the sheet drew it, and how big it drew it. */
  guns: ReadonlyArray<{ x: number; y: number; weight: number }>
  /**
   * Every row of weapons or bays, as a bar: what a battery looks like from
   * far off. `weight` is the battery's mean gun, so a heavy battery is a
   * heavier bar.
   */
  bars: ReadonlyArray<{ x0: number; x1: number; y: number; kind: 'gun' | 'bay'; weight: number }>
}

const SILHOUETTES = new WeakMap<ShipDesign, CounterSilhouette>()

export function counterSilhouette(design: ShipDesign): CounterSilhouette {
  const cached = SILHOUETTES.get(design)
  if (cached !== undefined) return cached

  const plan = planShip(design)
  const hull = normalisePlan(plan.hull)
  const { scale, midY } = normalisation(plan.hull)
  const nx = (x: number) => round(x * scale)
  const ny = (y: number) => round((y - midY) * scale)

  // The whole prow, filled: at forty pixels a tapered outline reads as a
  // rounded end, and half a prow reads as a smudge. A station gets a mark too
  // if anything aboard it bears one way and not another — its arcs are
  // measured off its facing like everyone else's (4.2), and an octagon with
  // no mark is the same octagon at every facing.
  let bow = ''
  if (!hull.shape.radial) {
    const chin = hull.deckTop
    const halfChin = halfBeamAt(hull, chin) * 0.86
    bow =
      `M 0 ${round(hull.noseY)} L ${round(halfChin)} ${round(chin)} ` +
      `L ${round(-halfChin)} ${round(chin)} Z`
  } else if (design.weapons.some((w) => bearsSomewhere(w.arcs))) {
    const cut = (hull.deckTop - hull.noseY) * 0.9
    const half = hull.beam * 0.42
    bow =
      `M ${round(-half)} ${round(hull.noseY)} L ${round(half)} ${round(hull.noseY)} ` +
      `L 0 ${round(hull.noseY + cut * 1.4)} Z`
  }

  const armed = plan.glyphs.filter((g) => g.kind === 'weapon' || g.kind === 'bay')
  const byRow = new Map<number, PlacedGlyph[]>()
  for (const g of armed) {
    const list = byRow.get(g.y) ?? []
    list.push(g)
    byRow.set(g.y, list)
  }
  const bars = [...byRow.entries()].flatMap(([y, list]) => {
    // A flank row is two batteries, port and starboard, with the keel between.
    const port = list.filter((g) => g.x < -1)
    const starboard = list.filter((g) => g.x > 1)
    const centre = list.filter((g) => Math.abs(g.x) <= 1 || (port.length === 0 && starboard.length === 0))
    const groups = port.length > 0 || starboard.length > 0 ? [port, starboard] : [centre]
    return groups
      .filter((group) => group.length > 0)
      .map((group) => ({
        x0: nx(Math.min(...group.map((g) => g.x - g.width / 2))),
        x1: nx(Math.max(...group.map((g) => g.x + g.width / 2))),
        y: ny(y),
        kind: group.every((g) => g.kind === 'bay') ? ('bay' as const) : ('gun' as const),
        weight: group.reduce((sum, g) => sum + (g.weight ?? 1), 0) / group.length,
      }))
  })

  const silhouette: CounterSilhouette = {
    path: hullPath(hull),
    bow,
    spine: hull.shape.spine
      ? {
          y1: round(hull.noseY + (hull.deckTop - hull.noseY) * 0.2),
          y2: round(hull.deckBottom * 0.4),
        }
      : null,
    radial: hull.shape.radial,
    guns: armed
      .filter((g) => g.kind === 'weapon')
      .map((g) => ({ x: nx(g.x), y: ny(g.y), weight: g.weight ?? 1 })),
    bars,
  }
  SILHOUETTES.set(design, silhouette)
  return silhouette
}
