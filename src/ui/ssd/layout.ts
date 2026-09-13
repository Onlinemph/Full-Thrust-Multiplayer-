import { ARC_ORDER } from '../../engine/types'
import type { Arc, ShipDesign, SystemDef } from '../../engine/types'
import {
  COUNTER_EXTENT,
  HULL_MARGIN,
  boxInsideOutline,
  deckBeamFraction,
  hullPath,
  hullPlan,
  hullShape,
  halfBeamAt,
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
import { ssdIcon } from './Glyph'

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
 */

/** One symbol's box in a laid-out ship, in the plan's own coordinates. */
export interface PlacedGlyph {
  key: string
  icon: string
  label: string
  /** Centre of the box. */
  x: number
  y: number
  width: number
  height: number
  /** The number this ship's copy carries — a drive's thrust, a hold's mass. */
  value?: number
  /** Which way it bears, for the arc rosette. Absent on anything unarmed. */
  arcs?: readonly Arc[]
  /** Where the rosette goes, when there is one: under the symbol. */
  rose: { x: number; y: number; radius: number } | null
  state: 'live' | 'fired' | 'destroyed' | 'degraded'
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
  viewBox: string
}

/** What the sheet knows about a ship's damage when it draws it. */
export interface PlanDamage {
  destroyed: ReadonlySet<string>
  fired?: ReadonlySet<string>
  /** Surviving screen generators, which set the working screen level (7.2). */
  screenGenerators?: number
  /** Current thrust, which halves on the drive's first threshold loss (4.11). */
  thrust?: number
}

// ---------------------------------------------------------------------------
// Bearing
// ---------------------------------------------------------------------------

/**
 * Where a mounting points, and how tightly.
 *
 * The six arcs are 60° wedges around the bow (4.2), so a set of them has a mean
 * direction and a concentration: a single arc is tight and points one way, the
 * four arcs of a broadside point broadly abeam, and all six cancel out exactly.
 * That cancelling is the useful part — it is how an all-round mount identifies
 * itself as belonging on the keel rather than on any one side.
 */
export function arcBearing(arcs: readonly Arc[]): { degrees: number; spread: number } {
  if (arcs.length === 0) return { degrees: 0, spread: 0 }
  let sx = 0
  let sy = 0
  for (const arc of arcs) {
    const index = ARC_ORDER.indexOf(arc)
    if (index < 0) continue
    const radians = (index * 60 * Math.PI) / 180
    sx += Math.sin(radians)
    sy += Math.cos(radians)
  }
  const spread = Math.hypot(sx, sy) / arcs.length
  if (spread < 1e-9) return { degrees: 0, spread: 0 }
  const degrees = (Math.atan2(sx, sy) * 180) / Math.PI
  return { degrees: degrees < 0 ? degrees + 360 : degrees, spread }
}

/**
 * The six bands a mounting can belong to, and the seventh for a mount that
 * bears every way.
 *
 * A mounting whose arcs nearly cancel belongs on the keel however its mean
 * happens to fall. Adjacent 60° arcs concentrate as 2·sin(30n°)/n, so the
 * ladder is 1 arc 1.00, two 0.87, three 0.67, four 0.43, five 0.20 and six
 * exactly nothing. 0.34 sits in the one wide gap on it: a mount covering four
 * arcs still has a side to be bolted to, and one covering five does not.
 */
const KEEL_SPREAD = 0.34

type BandId = 'bow' | 'forward' | 'midships' | 'core' | 'aft' | 'bays' | 'stern'
type Side = 'port' | 'centre' | 'starboard'

const BAND_ORDER: readonly BandId[] = [
  'bow',
  'forward',
  'midships',
  'core',
  'aft',
  'bays',
  'stern',
]

/** Bands whose contents run down the sides of the hull rather than across it. */
const FLANK_BANDS: ReadonlySet<BandId> = new Set<BandId>(['forward', 'aft'])

function station(arcs: readonly Arc[]): { band: BandId; side: Side } {
  const { degrees, spread } = arcBearing(arcs)
  if (spread < KEEL_SPREAD) return { band: 'midships', side: 'centre' }
  const sector = (Math.round(degrees / 60) % 6 + 6) % 6
  switch (sector) {
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
// Gathering what is on the ship
// ---------------------------------------------------------------------------

interface Item {
  key: string
  icon: string
  label: string
  value?: number
  arcs?: readonly Arc[]
  state: PlacedGlyph['state']
  /** Box width in glyph units; the wide symbols take more than one. */
  units: number
  band: BandId
  side: Side
}

/** Systems that are part of the ship's small-craft plant rather than its guts. */
const BAY_KINDS = new Set([
  'hangar-bay',
  'launch-tube',
  'catapult',
  'fighter-rack',
  'gunboat-rack',
  'gunboat-bay',
  'boat-bay',
  'tender',
])

/**
 * Systems the sheet draws once with a number in them rather than once each.
 *
 * The sheet's Cargo Hold has a number printed inside it, and it means the mass
 * held — so a liner with twenty mass of cargo is one hold that says 20, not
 * twenty holds. Drawing it the other way is what turns a merchantman's sheet
 * into a wall of identical boxes.
 */
const COUNTED_KINDS = new Set(['cargo', 'passenger-berthing', 'troop-berthing', 'boat-bay', 'tender'])

function weaponItems(design: ShipDesign, damage: PlanDamage): Item[] {
  const items: Item[] = []
  for (const weapon of design.weapons) {
    const icon = iconForWeapon(weapon)
    if (icon === null) continue
    const spec = ssdIcon(icon)
    const where = station(weapon.arcs)
    items.push({
      key: weapon.id,
      icon,
      label: weapon.label,
      arcs: weapon.arcs,
      state: damage.destroyed.has(weapon.id)
        ? 'destroyed'
        : damage.fired?.has(weapon.id)
          ? 'fired'
          : 'live',
      units: unitsFor(spec?.aspect ?? 1),
      band: where.band,
      side: where.side,
    })
  }
  return items
}

function systemItems(design: ShipDesign, damage: PlanDamage): Item[] {
  const items: Item[] = []
  const counted = new Map<string, { live: number; total: number; system: SystemDef }>()

  for (const system of design.systems) {
    if (system.kind === 'screen-generator' || system.kind === 'ftl-drive') continue
    const icon = iconForSystem(system.kind)
    if (icon === null) continue
    const dead = damage.destroyed.has(system.id)

    if (COUNTED_KINDS.has(system.kind)) {
      const seen = counted.get(system.kind) ?? { live: 0, total: 0, system }
      seen.total += 1
      if (!dead) seen.live += 1
      counted.set(system.kind, seen)
      continue
    }

    const spec = ssdIcon(icon)
    const where = system.arcs !== undefined && system.arcs.length > 0
      ? station(system.arcs)
      : { band: 'core' as BandId, side: 'centre' as Side }
    items.push({
      key: system.id,
      icon,
      label: system.label,
      arcs: system.arcs,
      state: dead ? 'destroyed' : 'live',
      units: unitsFor(spec?.aspect ?? 1),
      band: BAY_KINDS.has(system.kind) ? 'bays' : where.band,
      side: BAY_KINDS.has(system.kind) ? 'centre' : where.side,
    })
  }

  for (const [kind, tally] of counted) {
    const icon = iconForSystem(tally.system.kind)
    if (icon === null) continue
    items.push({
      key: `count-${kind}`,
      icon,
      label: `${tally.system.label} ×${tally.total}`,
      value: tally.live,
      // All of them gone is a destroyed system; some of them gone is a ship
      // still carrying cargo, and saying otherwise would be a lie about a
      // number the player is reading off the box.
      state: tally.live === 0 ? 'destroyed' : tally.live < tally.total ? 'degraded' : 'live',
      units: 1,
      band: BAY_KINDS.has(kind) ? 'bays' : 'core',
      side: 'centre',
    })
  }

  return items
}

function plantItems(design: ShipDesign, damage: PlanDamage): Item[] {
  const items: Item[] = []

  // Fighter bays are drawn by what is in them (8.15): a wing of interceptors
  // and a wing of torpedo bombers are the same 6 mass and completely different
  // news for whoever is being launched at.
  design.fighterBays.forEach((bay, index) => {
    items.push({
      key: `bay-${index}`,
      icon: iconForFighterBay(bay.typeId, bay.modifiers ?? []),
      label: bay.label,
      state: 'live',
      units: 1,
      band: 'bays',
      side: 'centre',
    })
  })

  design.gunboats.forEach((squadron, index) => {
    items.push({
      key: `gunboats-${index}`,
      icon: 'gunboat-rack',
      label: squadron.label,
      state: 'live',
      units: 1,
      band: 'bays',
      side: 'centre',
    })
  })

  // Screens are drawn from the design rather than from the system list, because
  // which of the six screen symbols is right depends on level and grade (7.2,
  // 7.3, 7.16) rather than on the entry that pays for it.
  const generators = design.systems.filter((s) => s.kind === 'screen-generator')
  const standing = damage.screenGenerators ?? generators.length
  const screenIcon = iconForScreen(design.screens)
  if (screenIcon !== null && design.screens.level > 0) {
    generators.forEach((generator, index) => {
      items.push({
        key: generator.id,
        icon: screenIcon,
        label: index < design.screens.level ? generator.label : `${generator.label} (backup)`,
        state: index < standing ? 'live' : 'destroyed',
        units: 1,
        band: 'core',
        side: 'centre',
      })
    })
  }
  const areaIcon = iconForScreen(design.screens, { area: true })
  if (areaIcon !== null) {
    items.push({
      key: 'area-screen',
      icon: areaIcon,
      label: 'Area defensive screen',
      state: 'live',
      units: 1,
      band: 'core',
      side: 'centre',
    })
  }

  // 10.3's Core Systems block is three cells wide on the sheet and sits where
  // the bridge sits: amidships, behind everything that shoots.
  if (design.coreSystems !== undefined) {
    items.push({
      key: 'core-systems',
      icon: 'core-systems',
      label: 'Core systems',
      state: 'live',
      units: unitsFor(ssdIcon('core-systems')?.aspect ?? 3),
      band: 'core',
      side: 'centre',
    })
  }

  // The drive is the stern, and the number inside it is what the ship can
  // actually manage now rather than what it was built with.
  const driveIcon = iconForDrive(design.drive.advanced)
  if (driveIcon !== null) {
    const thrust = damage.thrust ?? design.drive.thrust
    items.push({
      key: 'drive',
      icon: driveIcon,
      label: design.drive.advanced ? 'Main drive (advanced)' : 'Main drive',
      value: thrust,
      state: thrust < design.drive.thrust ? 'degraded' : 'live',
      units: 1.35,
      band: 'stern',
      side: 'centre',
    })
  }

  const ftlIcon = iconForFtl(design.ftl)
  if (ftlIcon !== null) {
    const ftlSystem = design.systems.find((s) => s.kind === 'ftl-drive')
    items.push({
      key: ftlSystem?.id ?? 'ftl',
      icon: ftlIcon,
      label: design.ftl === 'tug' ? 'FTL drive (tug)' : 'FTL drive',
      state:
        ftlSystem !== undefined && damage.destroyed.has(ftlSystem.id) ? 'destroyed' : 'live',
      units: 1,
      band: 'stern',
      side: 'centre',
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// The flow
// ---------------------------------------------------------------------------

/** Side of a symbol's box, in plan units. */
const GLYPH = 36
/** Space between two symbols in a row. */
const GLYPH_GAP = 8
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
/** Space between two bands, which is where the ship's frames would be. */
const BAND_GAP = 15
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
 * them all coming out as coffins.
 */
const SHIP_ACROSS = 4
/**
 * A station is not a ship and is not laid out like one: it has no bow, it is
 * drawn as an octagon, and stacking its fit-out four wide would make it a
 * tower. Wider rows keep it the squat thing it is.
 */
const STATION_ACROSS = 7

function unitsFor(aspect: number): number {
  // A symbol wider than it is tall gets a wider box rather than being squashed
  // into a square one: the sheet's Core Systems block is 3:1 and means it.
  return aspect > 1.35 ? Math.min(3, Math.round(aspect * 2) / 2) : 1
}

interface Row {
  items: Item[]
  /** Half the width the row needs. */
  halfWidth: number
  /** How tall the row is: taller when something in it carries a rosette. */
  height: number
  flank: boolean
}

function cellHeight(item: Item): number {
  return item.arcs !== undefined && item.arcs.length > 0 ? GLYPH + ROSE_BAND : GLYPH
}

function rowOf(items: Item[], halfWidth: number, flank: boolean): Row {
  return { items, halfWidth, height: Math.max(...items.map(cellHeight)), flank }
}

function rowWidth(items: Item[]): number {
  const units = items.reduce((sum, item) => sum + item.units, 0)
  return units * GLYPH + (items.length - 1) * GLYPH_GAP
}

/** Break a band's contents into rows, keeping port to port and starboard to starboard. */
function bandRows(band: BandId, items: Item[], across: number): Row[] {
  if (items.length === 0) return []

  if (FLANK_BANDS.has(band)) {
    // A broadside runs fore-and-aft along the side it fires from, which is
    // where it would actually be bolted.
    const port = items.filter((i) => i.side === 'port')
    const starboard = items.filter((i) => i.side !== 'port')
    const rows: Row[] = []
    for (let i = 0; i < Math.max(port.length, starboard.length); i += 1) {
      const pair = [port[i], starboard[i]].filter((x): x is Item => x !== undefined)
      rows.push(rowOf(pair, SPINE_HALF + Math.max(...pair.map((x) => x.units)) * GLYPH, true))
    }
    return rows
  }

  const ordered = [
    ...items.filter((i) => i.side === 'port'),
    ...items.filter((i) => i.side === 'centre'),
    ...items.filter((i) => i.side === 'starboard'),
  ]
  const rows: Row[] = []
  let current: Item[] = []
  let units = 0
  for (const item of ordered) {
    if (current.length > 0 && units + item.units > across) {
      rows.push(rowOf(current, rowWidth(current) / 2, false))
      current = []
      units = 0
    }
    current.push(item)
    units += item.units
  }
  if (current.length > 0) rows.push(rowOf(current, rowWidth(current) / 2, false))
  return rows
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
    rows.reduce((sum, row) => sum + row.height + GLYPH_GAP, -GLYPH_GAP) +
      Math.max(0, countBands(rows) - 1) * BAND_GAP,
    GLYPH,
  )
  const deckHeight = contentHeight + DECK_INSET * 2

  // Where each row sits, and therefore how pinched the hull is beside it.
  let y = -contentHeight / 2
  let lastBand: BandId | null = null
  const placedRows = rows.map((row) => {
    if (lastBand !== null && row.band !== lastBand) y += BAND_GAP
    lastBand = row.band
    const top = y
    y += row.height + GLYPH_GAP
    return { ...row, top }
  })

  const glyphs: PlacedGlyph[] = []
  for (const row of placedRows) {
    if (row.flank) {
      // Port to port, starboard to starboard, and the keel left clear between
      // them — which is where the spinal mount runs, when there is one.
      for (const item of row.items) {
        const sign = item.side === 'port' ? -1 : 1
        glyphs.push(place(item, sign * (SPINE_HALF + (item.units * GLYPH) / 2), row.top))
      }
      continue
    }
    let x = -rowWidth(row.items) / 2
    for (const item of row.items) {
      const width = item.units * GLYPH
      glyphs.push(place(item, x + width / 2, row.top))
      x += width + GLYPH_GAP
    }
  }

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

  // That beam is worked out from the hull's *profile*, which is a straight
  // reading of how pinched the hull is at a given point. A curved hull is
  // narrower than its profile wherever it rounds a corner, so the answer is
  // then checked against the outline as it will actually be drawn, and the
  // hull let out until every symbol clears the plating. Two passes are enough
  // for every design in the game; the loop is bounded so that a hull nobody
  // has built yet cannot hang the sheet.
  let hull = hullPlan(shape, deckHeight, beam)
  for (let pass = 0; pass < 6; pass += 1) {
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
    hull = hullPlan(shape, deckHeight, beam)
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
    viewBox: `${round(-hull.beam - pad)} ${round(hull.noseY - pad)} ${round(width)} ${round(height)}`,
  }
}

const NO_DAMAGE: PlanDamage = { destroyed: new Set<string>() }

function countBands(rows: Array<{ band: BandId }>): number {
  return new Set(rows.map((r) => r.band)).size
}

/** One symbol, centred on `x` and hung from the top edge of its row. */
function place(item: Item, x: number, top: number): PlacedGlyph {
  const armed = item.arcs !== undefined && item.arcs.length > 0
  return {
    key: item.key,
    icon: item.icon,
    label: item.label,
    x: round(x),
    y: round(top + GLYPH / 2),
    width: item.units * GLYPH,
    height: GLYPH,
    value: item.value,
    arcs: item.arcs,
    rose: armed
      ? { x: round(x), y: round(top + GLYPH + ROSE_BAND / 2), radius: ROSE_RADIUS }
      : null,
    state: item.state,
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
 * reads as one on the map, and a station reads as the octagon it is. Three
 * things survive the shrink, and nothing else could: the outline, a filled bow
 * so that facing is unmistakable at forty pixels, and a spinal mount, which is
 * the one fitting that changes the shape of the ship carrying it.
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
}

const SILHOUETTES = new WeakMap<ShipDesign, CounterSilhouette>()

export function counterSilhouette(design: ShipDesign): CounterSilhouette {
  const cached = SILHOUETTES.get(design)
  if (cached !== undefined) return cached

  const hull = normalisePlan(planShip(design).hull)
  // Far enough back that the bow mark is a bow and not a pinprick, and forward
  // of anything the sheet draws inside the hull.
  // The whole prow, filled: at forty pixels a tapered outline reads as a
  // rounded end, and half a prow reads as a smudge.
  const chin = hull.deckTop
  const halfChin = halfBeamAt(hull, chin) * 0.86

  const silhouette: CounterSilhouette = {
    path: hullPath(hull),
    bow: hull.shape.radial
      ? ''
      : `M 0 ${round(hull.noseY)} L ${round(halfChin)} ${round(chin)} ` +
        `L ${round(-halfChin)} ${round(chin)} Z`,
    spine: hull.shape.spine
      ? {
          y1: round(hull.noseY + (hull.deckTop - hull.noseY) * 0.2),
          y2: round(hull.deckBottom * 0.4),
        }
      : null,
    radial: hull.shape.radial,
  }
  SILHOUETTES.set(design, silhouette)
  return silhouette
}
