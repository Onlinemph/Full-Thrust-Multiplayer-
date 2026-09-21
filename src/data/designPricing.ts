/**
 * Pricing and validating a ship design (13, 14).
 *
 * The one place the construction arithmetic lives on the TypeScript side. It
 * matters that there is only one: the same sums are done by `ships.test.ts`
 * when it checks the roster, by the designer as a player builds, and by the
 * campaign when it charges Resource Points — and three implementations of a
 * points model is three chances for a fleet to be quietly unfair.
 *
 * The rule that shapes everything here: **hull boxes, the main drive, FTL,
 * streamlining and screens are fractions of TOTAL SHIP MASS**, not flat costs
 * (13.7 – 13.11). A thrust-6 drive is 30% of the ship whatever the ship. So
 * fitting a design is a fixed point rather than a sum, and `solveMass` is the
 * function that resolves it. Every one of those shares is then **rounded to
 * whole mass** (13.5: nearest, never below 1) — see `roundMassShare` — which
 * is why the book's 86-mass cruiser is 86 mass exactly and 294 points, and
 * why this file prices it the same.
 *
 * `costLines` is the sum written out a row at a time, the way 13.14's worked
 * example tabulates it; `priceDesign` is nothing but the total of those rows,
 * so the working the shipyard shows can never disagree with its own header.
 *
 * `tools/build_roster.py` does the same arithmetic in Python to generate the
 * shipped roster offline; `ships.test.ts` asserts the two agree on every hull,
 * which is what stops them drifting.
 */

import {
  fighterMods,
  gunboatMods,
} from './smallCraftMods'
import {
  fighterProfile,
  validateFighterBuild,
  FIGHTER_TYPES,
  type FighterTypeId,
} from '../engine/fighters'
import {
  squadronPoints,
  validateGunboatBuild,
  GUNBOAT_SQUADRON_SIZE,
  GUNBOAT_TYPES,
  type GunboatTypeId,
} from '../engine/gunboats'
import { cpvAdjustment, cpvHullCost, CPV_MASS_DIVISOR } from '../engine/battles'
import {
  canMountFlak,
  FLAK_UPGRADE_POINTS,
  kGunMass,
  maxSpinalMountMass,
  pulseTorpedoMass,
  pulserMass,
} from '../engine/weapons/kinetics'
import {
  checkMagazine,
  magazineCapacity,
  multiStageMass,
  multiStagePoints,
  plasmaBoltLauncherLimit,
  plasmaBoltMass,
  ORDNANCE_MOUNTS,
} from '../engine/ordnance'
import {
  tenderBayMassFor,
  tenderBayPoints,
  tenderCapacityFor,
  tugDriveMass,
  tugOwnDriveMass,
  tugSpareDriveMassFor,
  validateBattleriderDesign,
} from '../engine/ftl'
import {
  factionById,
  traitsFor,
  BATTERY_CLASSES,
  PROJECTILE_CLASSES,
  SPINAL_CLASSES,
} from './factions'
import {
  roundMassShare,
  HULL_FRACTION,
  HULL_POINTS_PER_BOX,
  type ArmourDef,
  type HullClass,
  type MagazineDef,
  type ScreenDef,
  type HullRows,
  type ShipDesign,
  type SystemDef,
  type SystemKind,
  type WeaponClass,
} from '../engine/types'
import { crewFactors } from '../engine/game'

// ---------------------------------------------------------------------------
// The proportional systems (13.5, 13.7 – 13.11)
// ---------------------------------------------------------------------------

export { roundMassShare }

/**
 * Mass of the main drive: 5% of the ship per point of thrust (13.9), rounded
 * once at the full rating — *"Add the percentages together and then determine
 * the mass required"*. Thrust-6 on a mass-64 hull is *"30% of 64 = 19.2,
 * rounded down to 19"*, not six lots of 3.2 rounded up to 24.
 */
export function driveMass(mass: number, thrust: number): number {
  return roundMassShare(0.05 * thrust * mass)
}

/** An advanced drive weighs the same and costs more (13.10). */
/** 14.1: the basic hull costs one point a mass — the "mass cost" of the ship. */
export function basicHullPoints(mass: number): number {
  return mass
}

export function drivePoints(mass: number, thrust: number, advanced: boolean): number {
  return driveMass(mass, thrust) * (advanced ? 3 : 2)
}

/** FTL is a tenth of the hull, whatever the hull (13.9): *"6.4, which will round down to 6"*. */
export function ftlMass(mass: number): number {
  return roundMassShare(0.1 * mass)
}

/**
 * Atmospheric streamlining: 5% partial, 10% full (13.11), rounded like any
 * other share of the hull.
 *
 * **[reading]** No points. 14.1 prints both rows at 0 and the roster has
 * always been priced so; 13.11's prose says *"2 points per mass used for the
 * aerodynamics"*, and the two cannot both be right. The table is followed
 * because it is the summary a designer is told to price from, and the
 * shipyard's working names the rule on the row so a table can decide
 * otherwise with its eyes open.
 */
export function streamliningMass(mass: number, kind: ShipDesign['streamlining']): number {
  if (kind === 'none') return 0
  return roundMassShare((kind === 'partial' ? 0.05 : 0.1) * mass)
}

/**
 * One screen generator is 5% of the hull, or 7.5% advanced (7.2, 7.3).
 *
 * **[reading]** Rounded per generator rather than on the level's total. 7.2
 * prices screens *"5% of the total ship mass per level"* and 4.7 puts one
 * generator symbol on the sheet per level, so each generator is a system of
 * its own and 13.5 rounds it on its own: two generators on an 86-mass hull
 * are 4 mass each, not 8.6 rounded to 9 between them. The main drive goes
 * the other way only because 13.9 says so in terms; 7.2 does not.
 */
export function screenGeneratorMass(mass: number, advanced: boolean): number {
  return roundMassShare((advanced ? 0.075 : 0.05) * mass)
}

/** The generators a ship at this level carries, priced one by one. */
export function screenMass(mass: number, level: number, advanced: boolean): number {
  return level * screenGeneratorMass(mass, advanced)
}

export function screenPoints(mass: number, level: number, advanced: boolean): number {
  return screenMass(mass, level, advanced) * (advanced ? 4 : 3)
}

/**
 * An area screen projector's mass (7.16).
 *
 * *"20% of the generating ship's mass per level (minimum 15) for a standard
 * area screen, 30% per level (minimum 20) for an advanced one, max level 2."*
 * The minimum is what stops a frigate throwing an umbrella over a battle line.
 */
export function areaScreenMass(mass: number, area: ScreenDef['area']): number {
  if (!area) return 0
  const level = area.level ?? 1
  const share = roundMassShare((area.advanced ? 0.3 : 0.2) * mass * level)
  return Math.max(area.advanced ? 20 : 15, share)
}

/** 7.16: 3.5 points per mass, whichever kind. */
export function areaScreenPoints(mass: number, area: ScreenDef['area']): number {
  return areaScreenMass(mass, area) * 3.5
}

/**
 * The fewest boxes a hull may have (13.7): *"a lower limit of a minimum of 10%
 * of the total ship mass"* — the fragile hull, which is the floor rather than
 * one option among five, and rounded as 13.5 rounds every share of the hull.
 */
export function minimumHullBoxes(mass: number): number {
  return hullBoxesFor(mass, 'fragile')
}

/**
 * Hull boxes at an integrity class (13.7). One box costs one mass.
 *
 * The classes are *descriptions* — "the following terms may be used to
 * describe the kind of structure a ship has" — so this is what a designer gets
 * by picking a round number, not what the rules require of them. Validation
 * enforces `minimumHullBoxes` and nothing more. The number is 13.5's rounding
 * of the share — *"26 mass (actually 25.8, rounded up)"* — where it used to
 * be the floor, which gave that cruiser 25.
 */
export function hullBoxesFor(mass: number, hullClass: HullClass): number {
  return roundMassShare(mass * HULL_FRACTION[hullClass])
}

/**
 * Armour points per box, by layer: 2 for the inner layer, then 4, 6, 8, 10 for
 * each shell outwards (7.6, 7.7). Regenerative armour costs 2 more a layer
 * (7.8).
 */
export const ARMOUR_POINTS_PER_BOX = [2, 4, 6, 8, 10] as const
export const REGENERATIVE_SURCHARGE = 2

export function armourMass(armour: ArmourDef): number {
  return armour.layers.reduce((sum, boxes) => sum + boxes, 0)
}

export function armourPoints(armour: ArmourDef): number {
  return armour.layers.reduce(
    (sum, boxes, layer) =>
      sum + boxes * (ARMOUR_POINTS_PER_BOX[layer] + (armour.regenerative ? REGENERATIVE_SURCHARGE : 0)),
    0,
  )
}

/**
 * Systems priced as a share of the hull rather than as a flat fit (7.17 –
 * 7.25).
 *
 * Every one of these is stated in the rulebook as a percentage: a Holofield is
 * *"10% of ships mass"*, a Cloaking Device costs *"50% of the ships mass"* in
 * points while weighing one. They are stored on the design with their computed
 * mass and points like any other system, so there is still one pricing path —
 * `repriceProportional` is what keeps them honest when the hull changes size
 * under them, and `validateDesign` reports it when they have not been.
 */
export const PROPORTIONAL_SYSTEMS: Partial<
  Record<
    SystemKind,
    {
      mass: number | 'fraction'
      massFraction?: number
      pointsPerMass?: number
      pointsFraction?: number
      /** 14.1: priced *per hull and armour box* rather than off mass. */
      pointsPerProtectionBox?: number
    }
  >
> = {
  holofield: { mass: 'fraction', massFraction: 0.1, pointsPerMass: 5 },
  'tuffley-cloak': { mass: 'fraction', massFraction: 0.1, pointsPerMass: 10 },
  'reflex-field': { mass: 'fraction', massFraction: 0.1, pointsPerMass: 6 },
  'cloaking-device': { mass: 1, pointsFraction: 0.5 },
  'cloaking-field': { mass: 1, pointsFraction: 1 },
  // 14.1: "Stealth Hull -Level 1: None, 2 per Hull/Armour Box. Stealth Hull
  // -Level 2: None, 4 per Hull/Armour Box." Fitting two entries is what makes
  // a hull Stealth-2, and two at 2 a box is the printed 4 a box.
  'stealth-hull': { mass: 0, pointsPerProtectionBox: 2 },
  // 14.2: "Stealth Fields 5% total mass per level (max 2), x6".
  'stealth-field': { mass: 'fraction', massFraction: 0.05, pointsPerMass: 6 },
}

/** Hull boxes plus every armour box: what 14.1 prices a stealth hull against. */
export function protectionBoxes(design: ShipDesign): number {
  return design.hullBoxes + design.armour.layers.reduce((a, b) => a + b, 0)
}

/**
 * What one proportional system weighs and costs on this hull.
 *
 * It takes the design rather than the mass because not all of them scale with
 * mass: 14.1 prices a stealth hull off the boxes it has to hide, which is the
 * hull track plus the armour wrapped round it.
 */
export function proportionalCost(
  kind: SystemKind,
  design: ShipDesign,
): { mass: number; points: number } | null {
  const spec = PROPORTIONAL_SYSTEMS[kind]
  if (!spec) return null
  const shipMass = design.mass
  const mass =
    spec.mass === 'fraction' ? roundMassShare((spec.massFraction ?? 0) * shipMass) : spec.mass
  const points =
    spec.pointsPerProtectionBox !== undefined
      ? spec.pointsPerProtectionBox * protectionBoxes(design)
      : spec.pointsFraction !== undefined
        ? spec.pointsFraction * shipMass
        : mass * (spec.pointsPerMass ?? 0)
  return { mass: round2(mass), points: Math.floor(points + 0.5) }
}

/**
 * Re-price every proportional system against the design's current mass.
 *
 * The shipyard calls this on every edit, because raising the hull raises the
 * cloak with it and a player dragging the mass slider should watch that
 * happen rather than discover it when the design fails validation.
 */
export function repriceProportional(design: ShipDesign): ShipDesign {
  return {
    ...design,
    systems: design.systems.map((system) => {
      const cost = proportionalCost(system.kind, design)
      return cost ? { ...system, ...cost } : system
    }),
  }
}

/**
 * An *additional* damage control party, and a marine party: 5 points, no mass
 * (13.13, 14.3).
 *
 * The parties a warship already has are free — 10.4 gives it one per crew
 * factor and one crew factor per 20 mass — so what is charged for here is only
 * what is bought on top, which 13.13 caps at the number the hull started with.
 */
export const CREW_PARTY_POINTS = 5

// ---------------------------------------------------------------------------
// Pricing a whole design
// ---------------------------------------------------------------------------

export interface DesignCost {
  /** Mass of everything fitted. Must not exceed the hull's rating (13.14). */
  massUsed: number
  massAvailable: number
  /** Combat Points Value (18.3). */
  points: number
  /** Mass left unspent. Negative means the design does not fit. */
  spare: number
}

/**
 * The mass of a design's FTL package (13.10, 11.6).
 *
 * An ordinary drive is 10% of the hull. A tug's is that plus what it hauls:
 * *"for every 1 additional FTL Drive mass they can tow an additional 5
 * transfer mass"*, which `tugDriveMass` inverts.
 */
export function ftlPackageMass(design: ShipDesign): number {
  if (design.ftl === 'none') return 0
  if (design.ftl === 'tug') return tugDriveMass(design.mass, design.ftlTransferMass ?? 0)
  return ftlMass(design.mass)
}

/**
 * The points of that package.
 *
 * 13.10 prices an FTL drive by its own mass, so a tug's bigger drive costs
 * proportionally more — charging it 13.10's rate on the hull's 10% instead
 * would give away the tow capacity for nothing.
 */
export function ftlPackagePoints(design: ShipDesign): number {
  if (design.ftl === 'none') return 0
  const advanced = design.ftl === 'advanced'
  return ftlPackageMass(design) * (advanced ? 3 : 2)
}

export function priceDesign(design: ShipDesign): DesignCost {
  // 14.1's first line: "Basic hull — total mass of ship — ×1". The worked
  // example prices its 86-mass cruiser as "Basic hull 86 mass 86 points"
  // before the hull integrity, the drives and the fit-out are added, and the
  // ship's cost "is the total of the mass cost, the hull cost, the drives
  // cost, and the individual costs of all the systems". `costLines` is that
  // list, one row a decision; this is its total and nothing more.
  const lines = costLines(design)
  const massUsed = lines.reduce((sum, line) => sum + line.mass, 0)
  const points = lines.reduce((sum, line) => sum + line.points, 0)

  // Flawed Design: 10% more mass to fill, 20% off the points, and a standing
  // penalty on every threshold check (13.13).
  const massAvailable = design.flawed ? design.mass * 1.1 : design.mass
  const finalPoints = design.flawed ? points * 0.8 : points

  return {
    massUsed: round2(massUsed),
    massAvailable: round2(massAvailable),
    // floor(x + 0.5), not Math.round's banker's cousin in other languages: a
    // five-row hull is a point and a half a box, so exact halves are common
    // and the Python generator has to agree with this to the point.
    points: Math.floor(round6(finalPoints) + 0.5),
    spare: round2(massAvailable - massUsed),
  }
}

// ---------------------------------------------------------------------------
// The working (13.14, 18.3)
// ---------------------------------------------------------------------------

/** The decisions a design's cost is grouped under, in the order 13.14 makes them. */
export type CostGroup = 'hull' | 'defences' | 'weapons' | 'systems' | 'crew'

export const COST_GROUPS: ReadonlyArray<{ id: CostGroup; label: string; rule: string }> = [
  { id: 'hull', label: 'Hull and drives', rule: '13.5, 13.7 – 13.11' },
  { id: 'defences', label: 'Defences', rule: '7.2 – 7.16, 14.2' },
  { id: 'weapons', label: 'Weapons', rule: '14.4 – 14.6' },
  { id: 'systems', label: 'Systems', rule: '14.1 – 14.3' },
  { id: 'crew', label: 'Crew', rule: '13.13, 14.3' },
]

/**
 * One row of a design's working. The book's worked example (13.14) ends in a
 * table with a row for each decision, its mass and its points; this is that
 * row with the arithmetic written beside it, so a total can be checked
 * against a printed fleet list a line at a time.
 */
export interface CostLine {
  group: CostGroup
  label: string
  /** The section the row answers to. */
  rule: string
  /** The sum in the book's terms: "10% of 86 = 8.6 → 9 × 2". */
  working: string
  /** Mass the row uses of the hull's rating. The basic hull uses none. */
  mass: number
  points: number
  /** Identical fittings tallied into one row. */
  count?: number
}

const ORDINAL = ['first', 'second', 'third', 'fourth'] as const

/** The section a fitting is priced under, for the rows that have one. */
const SYSTEM_RULES: Partial<Record<SystemKind, string>> = {
  firecon: '4.4, 14.1',
  'advanced-firecon': '5.2, 14.1',
  pds: '7.12, 14.2',
  adfc: '7.10, 14.2',
  'advanced-adfc': '7.11, 14.2',
  ads: '7.13, 14.2',
  scattergun: '7.14, 14.2',
  grapeshot: '7.15, 14.2',
  ecm: '7.18, 14.2',
  'area-ecm': '7.19, 14.2',
  holofield: '7.17, 14.2',
  'cloaking-device': '7.20, 14.2',
  'cloaking-field': '7.21, 14.2',
  'tuffley-cloak': '7.22',
  'reflex-field': '7.25',
  'stealth-hull': '7.4, 14.1',
  'stealth-field': '7.5, 14.2',
  'hangar-bay': '8.1, 14.1',
  'launch-tube': '8.2, 14.1',
  catapult: '8.2, 14.1',
  'gunboat-rack': '9.1, 14.1',
  'gunboat-bay': '9.1, 14.1',
  tender: '11.6',
  cargo: '14.1',
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`
}

/** "8.6 → 9", or just "9" when the share was whole already. */
function rounded(raw: number, to: number): string {
  const r = round2(raw)
  return r === to ? `${to}` : `${r} → ${to}`
}

function loadsDescribed(loads: MagazineDef['loads']): string {
  const parts: string[] = []
  const standard = loads.filter((l) => l.grade === 'standard' && !l.multiStage).length
  const extended = loads.filter((l) => l.grade === 'extended' && !l.multiStage).length
  const staged = loads.filter((l) => l.multiStage).length
  if (standard) parts.push(`${standard} standard`)
  if (extended) parts.push(`${extended} ER`)
  if (staged) parts.push(`${staged} multi-stage`)
  return parts.join(', ') || 'empty'
}

function weaponRule(weaponClass: WeaponClass): string {
  if ((SPINAL_CLASSES as readonly string[]).includes(weaponClass)) return '14.5'
  if (ORDNANCE_MOUNTS.some((mount) => mount.weaponClass === weaponClass)) return '14.6'
  return '14.4'
}

/** The arithmetic behind a fitting's row, where there is any to show. */
function systemWorking(system: SystemDef, count: number, design: ShipDesign): string {
  const m = design.mass
  const spec = PROPORTIONAL_SYSTEMS[system.kind]
  if (spec) {
    if (spec.pointsPerProtectionBox !== undefined) {
      return `${spec.pointsPerProtectionBox} × ${protectionBoxes(design)} hull and armour boxes`
    }
    if (spec.pointsFraction !== undefined) {
      return spec.pointsFraction === 1
        ? `mass ${system.mass}; the ship’s mass, ${m}, in points`
        : `mass ${system.mass}; ${spec.pointsFraction} × the ship’s mass ${m} = ${round2(spec.pointsFraction * m)}`
    }
    const share = spec.massFraction ?? 0
    return `${pct(share)} of ${m} = ${rounded(share * m, system.mass)} × ${spec.pointsPerMass ?? 0}`
  }
  if (system.kind === 'gunboat-rack' || system.kind === 'gunboat-bay') {
    return 'the squadron it carries is priced with the craft (9.1)'
  }
  if (system.kind === 'tender') {
    return `bay for ${round2(tenderCapacityFor(system.mass))} mass of ship at 1.5 a mass, × 3`
  }
  const each = `${system.mass} mass, ${system.points} points`
  if (count > 1) return `${count} × (${each})`
  return system.points === 0 ? 'no points' : ''
}

/**
 * Every row of a design's cost, in the order the book's worked example lists
 * them (13.14). `priceDesign` is the sum of these and nothing else.
 */
export function costLines(design: ShipDesign): CostLine[] {
  const m = design.mass
  const lines: CostLine[] = []
  const add = (
    group: CostGroup,
    label: string,
    rule: string,
    working: string,
    mass: number,
    points: number,
    count?: number,
  ) => {
    lines.push(
      count === undefined
        ? { group, label, rule, working, mass, points }
        : { group, label, rule, working, mass, points, count },
    )
  }

  // 14.1's first row: "Basic hull — total mass of ship — ×1".
  add('hull', 'Basic hull', '14.1', `mass ${m} × 1`, 0, basicHullPoints(m))

  // 13.7: the hull boxes, at what a box costs in this many rows.
  const perBox = HULL_POINTS_PER_BOX[design.hullRows]
  const fraction = HULL_FRACTION[design.hullClass]
  const byClass = hullBoxesFor(m, design.hullClass)
  const boxes = design.hullBoxes
  add(
    'hull',
    'Hull integrity',
    '13.7',
    boxes === byClass
      ? `${design.hullClass}: ${pct(fraction)} of ${m} = ${rounded(m * fraction, byClass)} boxes × ${perBox} (${design.hullRows} rows)`
      : `${boxes} boxes as built (${design.hullClass} would be ${byClass}) × ${perBox} (${design.hullRows} rows)`,
    boxes,
    boxes * perBox,
  )

  // 13.9: the main drive, rounded once at its full rating.
  const thrust = design.drive.thrust
  if (thrust > 0) {
    const dm = driveMass(m, thrust)
    const rate = design.drive.advanced ? 3 : 2
    add(
      'hull',
      design.drive.advanced ? 'Advanced main drive' : 'Main drive',
      design.drive.advanced ? '13.9, 13.10' : '13.9',
      `thrust ${thrust}: ${pct(0.05 * thrust)} of ${m} = ${rounded(0.05 * thrust * m, dm)} × ${rate}`,
      dm,
      dm * rate,
    )
  } else {
    add('hull', 'Main drive', '16.1', 'thrust 0: nothing to fit', 0, 0)
  }

  // 13.9, 11.6: the FTL package.
  if (design.ftl !== 'none') {
    const rate = design.ftl === 'advanced' ? 3 : 2
    const fm = ftlPackageMass(design)
    if (design.ftl === 'tug') {
      const own = tugOwnDriveMass(m)
      const tow = design.ftlTransferMass ?? 0
      add(
        'hull',
        'Tug FTL drive',
        '11.6',
        `10% of ${m} = ${rounded(0.1 * m, own)}, + ${tugSpareDriveMassFor(tow)} to tow ${tow} (1 per 5) = ${fm} × ${rate}`,
        fm,
        fm * rate,
      )
    } else {
      add(
        'hull',
        design.ftl === 'advanced' ? 'Advanced FTL drive' : 'FTL drive',
        design.ftl === 'advanced' ? '13.9, 13.10' : '13.9',
        `10% of ${m} = ${rounded(0.1 * m, fm)} × ${rate}`,
        fm,
        fm * rate,
      )
    }
  } else if (design.battlerider === true) {
    add('hull', 'FTL drive', '11.7', 'battlerider: carried by its Mothership, no drive to pay for', 0, 0)
  }

  // 13.11, 14.1: streamlining.
  if (design.streamlining !== 'none') {
    const share = design.streamlining === 'partial' ? 0.05 : 0.1
    const sm = streamliningMass(m, design.streamlining)
    add(
      'hull',
      design.streamlining === 'partial' ? 'Partial streamlining' : 'Full streamlining',
      '13.11, 14.1',
      `${pct(share)} of ${m} = ${rounded(share * m, sm)} mass; 14.1 prices it at 0`,
      sm,
      0,
    )
  }

  // 7.6 – 7.8: armour, a row a layer.
  design.armour.layers.forEach((layer, i) => {
    if (layer <= 0) return
    const surcharge = design.armour.regenerative ? REGENERATIVE_SURCHARGE : 0
    const per = ARMOUR_POINTS_PER_BOX[i] + surcharge
    add(
      'defences',
      i === 0 ? 'Hull armour' : `${ORDINAL[i - 1] ?? `${i}th`} shell of armour`,
      i === 0 ? (surcharge ? '7.6, 7.8' : '7.6') : surcharge ? '7.7, 7.8' : '7.7',
      `${layer} boxes × ${per}${surcharge ? ` (${ARMOUR_POINTS_PER_BOX[i]} + ${surcharge} regenerative)` : ''}`,
      layer,
      layer * per,
    )
  })

  // 7.2, 7.3: screens, a generator at a time. Backups beyond the level are
  // generators too, and cost what a generator costs.
  const generators = Math.max(design.screens.level, design.screens.generators)
  if (generators > 0) {
    const advanced = design.screens.advanced
    const each = screenGeneratorMass(m, advanced)
    const share = advanced ? 0.075 : 0.05
    const rate = advanced ? 4 : 3
    const one = `${pct(share)} of ${m} = ${rounded(share * m, each)}`
    add(
      'defences',
      advanced ? 'Advanced screens' : 'Screens',
      advanced ? '7.3, 14.2' : '7.2, 14.2',
      generators === 1 ? `${one} × ${rate}` : `${generators} generators × (${one}) × ${rate}`,
      generators * each,
      generators * each * rate,
      generators,
    )
  }

  // 7.16: an area screen projector, with its floor.
  if (design.screens.area) {
    const area = design.screens.area
    const level = area.level ?? 1
    const share = area.advanced ? 0.3 : 0.2
    const raw = share * m * level
    const am = areaScreenMass(m, area)
    const floor = area.advanced ? 20 : 15
    add(
      'defences',
      area.advanced ? 'Advanced area screen' : 'Area screen',
      '7.16, 14.2',
      `${pct(share)} of ${m}${level > 1 ? ` × level ${level}` : ''} = ${rounded(raw, roundMassShare(raw))}${am > roundMassShare(raw) ? `, minimum ${floor}` : ''} × 3.5`,
      am,
      am * 3.5,
    )
  }

  // 14.4 – 14.6: every mounting, one row each.
  for (const weapon of design.weapons) {
    const printed = weapon.turretId ? null : printedWeaponCost(weapon)
    const notes = [
      weapon.turretId
        ? `bare, in turret ${weapon.turretId}`
        : weapon.broadside
          ? 'broadside'
          : `${weapon.arcs.length}-arc mounting`,
    ]
    if (weapon.flak === true) notes.push(`flak shells +${FLAK_UPGRADE_POINTS}`)
    if (weapon.ammo !== undefined) notes.push(weapon.ammo === 1 ? 'one shot' : `${weapon.ammo} shots`)
    add(
      'weapons',
      weapon.label,
      printed?.rule ?? weaponRule(weapon.weaponClass),
      notes.join(', '),
      weapon.mass,
      weapon.points,
    )
  }
  for (const turret of design.turrets) {
    add(
      'weapons',
      'Turret',
      '5.22',
      `${turret.arcs.length} arcs, room for ${turret.capacity} mass of guns`,
      turret.mass,
      turret.points,
    )
  }
  for (const magazine of design.magazines ?? []) {
    add(
      'weapons',
      'Magazine',
      '6.6',
      `${magazine.loads.length} loads (${loadsDescribed(magazine.loads)}) × 3 a mass`,
      magazine.mass,
      magazine.points,
    )
  }

  // 14.1 – 14.3: the fittings, identical ones tallied. A screen generator
  // symbol stands for what the Screens row already paid (7.2), so a free one
  // is not a row of its own.
  const tally = new Map<string, { system: SystemDef; count: number }>()
  for (const system of design.systems) {
    if (system.kind === 'screen-generator' && system.mass === 0 && system.points === 0) continue
    const key = `${system.kind}|${system.label}|${system.mass}|${system.points}`
    const entry = tally.get(key)
    if (entry) entry.count += 1
    else tally.set(key, { system, count: 1 })
  }
  for (const { system, count } of tally.values()) {
    add(
      'systems',
      system.label,
      SYSTEM_RULES[system.kind] ?? '14',
      systemWorking(system, count, design),
      system.mass * count,
      system.points * count,
      count,
    )
  }

  // 13.13, 14.3: parties bought on top of the crew.
  const crew = crewFactors(m, design.group === 'civilian')
  if (design.additionalDamageControlParties > 0) {
    const n = design.additionalDamageControlParties
    add(
      'crew',
      'Extra damage control parties',
      '13.13, 14.3',
      `${n} × ${CREW_PARTY_POINTS}, on top of the ${crew} the crew gives (10.4)`,
      0,
      n * CREW_PARTY_POINTS,
      n,
    )
  }
  if (design.marineParties > 0) {
    const n = design.marineParties
    add('crew', 'Marine parties', '12.7, 14.3', `${n} × ${CREW_PARTY_POINTS}`, 0, n * CREW_PARTY_POINTS, n)
  }
  return lines
}

export interface CostGroupSummary {
  id: CostGroup
  label: string
  rule: string
  lines: CostLine[]
  mass: number
  points: number
}

export interface CpvWorking {
  hullCost: number
  adjustment: number
  points: number
  /** 18.3's three steps, in the book's terms. */
  steps: string[]
}

/**
 * 18.3 written out: the hull cost from mass, the adjustment that is its
 * difference from the mass, and the printed total moved by it. The book's own
 * examples: the Suffren (mass 54, 181 points) is 29, −25, 156; the Excalibur
 * (mass 140, 472 points) is 196, +56, 528.
 */
export function cpvWorking(points: number, mass: number): CpvWorking {
  const hullCost = cpvHullCost(mass)
  const adjustment = cpvAdjustment(mass)
  const raw = round2((mass * mass) / CPV_MASS_DIVISOR)
  const sign = adjustment >= 0 ? '+' : '−'
  return {
    hullCost,
    adjustment,
    points: points + adjustment,
    steps: [
      `hull under CPV: ${mass}² ÷ ${CPV_MASS_DIVISOR} = ${rounded(raw, hullCost)}${raw < 0.5 ? ' (never below 1)' : ''}`,
      `change: ${hullCost} − ${mass} = ${sign}${Math.abs(adjustment)}`,
      `${points} ${sign} ${Math.abs(adjustment)} = ${points + adjustment} CPV`,
    ],
  }
}

export interface DesignBreakdown {
  groups: CostGroupSummary[]
  cost: DesignCost
  /** The rows' sum before 13.13's flawed-design discount, as the book totals it. */
  subtotal: number
  /** The discount written out, when the design is flawed (13.13). */
  flawed: { points: string; mass: string } | null
  cpv: CpvWorking
  /**
   * Fighter wings and gunboat squadrons: bought with the hull and priced apart
   * from it (14.7, 9.2), the way the Fleet Books print a carrier.
   */
  embarked: { lines: CostLine[]; points: number }
  /** Hull and craft together, which is what 18.2 counts against a fleet's total. */
  listed: number
}

/** The whole of a design's working: the rows, their totals, and 18.3 on the result. */
export function breakdownDesign(design: ShipDesign): DesignBreakdown {
  const lines = costLines(design)
  const cost = priceDesign(design)
  const groups = COST_GROUPS.map((group) => {
    const rows = lines.filter((line) => line.group === group.id)
    return {
      ...group,
      lines: rows,
      mass: round2(rows.reduce((sum, line) => sum + line.mass, 0)),
      points: round2(rows.reduce((sum, line) => sum + line.points, 0)),
    }
  }).filter((group) => group.lines.length > 0)
  const subtotal = round2(lines.reduce((sum, line) => sum + line.points, 0))
  const flawed = design.flawed
    ? {
        points: `20% off: ${subtotal} × 0.8 = ${round2(subtotal * 0.8)} → ${cost.points}`,
        mass: `10% more to fill: ${design.mass} × 1.1 = ${cost.massAvailable}`,
      }
    : null

  const embarkedLines: CostLine[] = []
  for (const bay of design.fighterBays) {
    const typeId = bay.typeId as FighterTypeId
    if (!(typeId in FIGHTER_TYPES)) continue
    const profile = fighterProfile(typeId, fighterMods(bay.modifiers))
    embarkedLines.push({
      group: 'systems',
      label: bay.label,
      rule: '8.15, 14.7',
      working: `a wing of ${profile.groupSize}`,
      mass: 0,
      points: profile.points,
    })
  }
  for (const rack of design.gunboats) {
    const typeId = rack.typeId as GunboatTypeId
    if (!(typeId in GUNBOAT_TYPES)) continue
    const points = squadronPoints(
      Array<GunboatTypeId>(GUNBOAT_SQUADRON_SIZE).fill(typeId),
      gunboatMods(rack.modifiers),
    )
    embarkedLines.push({
      group: 'systems',
      label: rack.label,
      rule: '9.2, 14.8',
      working: `a squadron of ${GUNBOAT_SQUADRON_SIZE}`,
      mass: 0,
      points,
    })
  }
  const embarkedPoints = embarkedLines.reduce((sum, line) => sum + line.points, 0)

  return {
    groups,
    cost,
    subtotal,
    flawed,
    cpv: cpvWorking(cost.points, design.mass),
    embarked: { lines: embarkedLines, points: embarkedPoints },
    listed: cost.points + embarkedPoints,
  }
}

/**
 * The smallest hull that carries a loadout.
 *
 * `mass >= flat / (1 - fractions)`, because hull boxes, drive, FTL,
 * streamlining and screens all scale with the answer. Rounded up to an even
 * number, the way a designer would.
 */
export function solveMass(spec: {
  hullClass: HullClass
  thrust: number
  ftl: boolean
  streamlining: ShipDesign['streamlining']
  screenLevel: number
  advancedScreens: boolean
  /** Mass of everything that does not scale: weapons, armour, flat systems. */
  flatMass: number
}): number {
  const fraction =
    HULL_FRACTION[spec.hullClass] +
    0.05 * spec.thrust +
    (spec.ftl ? 0.1 : 0) +
    (spec.streamlining === 'none' ? 0 : spec.streamlining === 'partial' ? 0.05 : 0.1) +
    (spec.advancedScreens ? 0.075 : 0.05) * spec.screenLevel
  if (fraction >= 1) return Number.POSITIVE_INFINITY
  return Math.ceil(spec.flatMass / (1 - fraction) / 2) * 2
}

// ---------------------------------------------------------------------------
// Validation (13.14)
// ---------------------------------------------------------------------------

export type DesignFault =
  | { kind: 'overweight'; by: number }
  | { kind: 'hull-too-light'; minimum: number; found: number }
  | { kind: 'no-firecon' }
  | { kind: 'hangar-without-tube' }
  | { kind: 'turret-overloaded'; turretId: string; capacity: number; fitted: number }
  | { kind: 'bad-arcs'; weaponId: string; arcs: number }
  | { kind: 'screens-without-generators'; level: number; generators: number }
  | { kind: 'banned'; system: string }
  | { kind: 'mispriced-proportional'; system: string; mass: number; points: number }
  | { kind: 'two-cloaks' }
  /** A cloak or a holofield on a hull that also carries screens (7.17, 7.20). */
  | { kind: 'field-with-screens'; field: string }
  | { kind: 'too-many-parties'; bought: number; crew: number }
  /** A faction trait forbids this outright (`docs/rules/factions.md`). */
  | { kind: 'faction-prohibition'; faction: string; what: string; rule: string }
  /** A faction design trait this hull does not satisfy. */
  | { kind: 'faction-design'; faction: string; trait: string; rule: string }
  /** An 8.15 fighter build or a 9.2 squadron build the rules do not allow. */
  | { kind: 'bad-small-craft'; label: string; problem: string }
  /** 11.7: a battlerider that is too big, or that paid for a drive it may not have. */
  | { kind: 'bad-battlerider'; problem: string }
  /** 11.6: hangar space for ships, priced at something other than the rule's rate. */
  | { kind: 'mispriced-ship-bay'; carried: number; mass: number; points: number }
  /** 5.23: more Spinal Mount than 16 mass per 50 of hull. */
  | { kind: 'spinal-overmounted'; fitted: number; allowed: number }
  /** 5.16: some but not all of a ship's K-Guns carry Flak ammunition. */
  | { kind: 'partial-flak'; equipped: number; eligible: number }
  /** 6.6: a Salvo Missile Launcher with no magazine behind it. */
  | { kind: 'launcher-unfed'; weaponId: string }
  /** 6.6: a launcher drawing from more than one magazine, or a magazine overpacked. */
  | { kind: 'bad-magazine'; magazineId: string; problem: string }
  /**
   * A mounting whose entry disagrees with the printed table (5.14, 5.16, 5.21,
   * 6.6, 6.8). Every one of these families prices by arc count, class or
   * range line, and a catalogue typed by hand drifts.
   */
  | { kind: 'mispriced-weapon'; weaponId: string; label: string; mass: number; points: number; rule: string }
  /** 6.8: more Plasma Bolt Launchers than one per 50 mass of hull. */
  | { kind: 'too-many-plasma-bolts'; fitted: number; allowed: number }

export function describeFault(fault: DesignFault): string {
  switch (fault.kind) {
    case 'overweight':
      return `${fault.by.toFixed(2)} mass over the hull's rating`
    case 'hull-too-light':
      return `${fault.found} hull boxes on a hull that must have at least ${fault.minimum} — 10% of its mass (13.7)`
    case 'no-firecon':
      return 'armed, but no FireCon — the guns cannot be aimed at anything (4.4)'
    case 'hangar-without-tube':
      return 'hangar bays but no launch tube: the wing can never fly (8.2)'
    case 'turret-overloaded':
      return `turret ${fault.turretId} holds ${fault.capacity} mass and is carrying ${fault.fitted} (5.22)`
    case 'bad-arcs':
      return `weapon ${fault.weaponId} covers ${fault.arcs} arcs; a mounting covers one to six (4.2)`
    case 'screens-without-generators':
      return `level-${fault.level} screens with ${fault.generators} generators (7.2)`
    case 'banned':
      return `${fault.system} is barred in this game`
    case 'mispriced-proportional':
      return `${fault.system} is a share of hull mass: it should be ${fault.mass} mass and ${fault.points} points on this hull (7.17 – 7.25)`
    case 'two-cloaks':
      return 'two cloaks on one hull: a cloak may not be combined with any other field (7.20)'
    case 'field-with-screens':
      return `${fault.field} on a screened hull: "Holofields cannot be combined with other screen or field technology" (7.17), and a cloak "may not be combined with any fields or screens" (7.20)`
    case 'too-many-parties':
      return `${fault.bought} extra crew parties on a hull crewed for ${fault.crew}: a ship "may not mount more Damage Control Parties (and or additional Marines) than the number of crew it was initially designed with" (13.13)`
    case 'faction-prohibition':
      return `${fault.what}: the ${fault.faction} does not build it — ${fault.rule}`
    case 'faction-design':
      return `${fault.faction} ${fault.trait}: ${fault.rule}`
    case 'bad-small-craft':
      return `${fault.label}: ${fault.problem}`
    case 'bad-battlerider':
      return fault.problem
    case 'mispriced-ship-bay':
      return `ship bay for ${fault.carried} mass of carried hull: 11.6 charges ${fault.mass} mass and ${fault.points} points`
    case 'partial-flak':
      return `${fault.equipped} of ${fault.eligible} K-Guns carry Flak ammunition: 5.16 says "all the K-Guns on a ship (except K-1s) must be so equipped"`
    case 'launcher-unfed':
      return `${fault.weaponId} is a Salvo Missile Launcher with no magazine: 6.6 lets it "fire one salvo per turn provided ammunition is left in the magazine", and there is none`
    case 'bad-magazine':
      return `magazine ${fault.magazineId}: ${fault.problem}`
    case 'mispriced-weapon':
      return `${fault.label} should be ${fault.mass} mass and ${fault.points} points (${fault.rule})`
    case 'too-many-plasma-bolts':
      return fault.allowed === 0
        ? '6.8 allows one Plasma Bolt Launcher per 50 mass of ship, and this hull is under 50'
        : `${fault.fitted} Plasma Bolt Launchers where 6.8 allows ${fault.allowed} — one per 50 mass`
    case 'spinal-overmounted':
      return fault.allowed === 0
        ? `${fault.fitted} mass of Spinal Mount on a hull too small to carry one: 5.23 allows 16 mass per 50 of ship, so nothing under mass 50 may mount any`
        : `${fault.fitted} mass of Spinal Mount where 5.23 allows ${fault.allowed} — 16 mass per 50 of ship`
  }
}

/**
 * A design against its faction's traits (`docs/rules/factions.md`).
 *
 * Prohibitions and design traits are the two kinds a shipyard can check — the
 * other two change a roll in a battle or a number in a campaign turn — so this
 * is where the supplement meets a player, and it is where the supplement's own
 * documentation says it belongs.
 */
function factionFaults(design: ShipDesign, factionId: string, clanId?: string): DesignFault[] {
  const faction = factionById(factionId)
  if (!faction) return []
  const faults: DesignFault[] = []
  const armourBoxes = design.armour.layers.reduce((sum, n) => sum + n, 0)

  const bar = (what: string, rule: string) =>
    faults.push({ kind: 'faction-prohibition', faction: faction.name, what, rule })

  for (const trait of traitsFor(factionId, clanId)) {
    for (const banned of trait.bans ?? []) {
      switch (banned.kind) {
        case 'weapon':
          for (const weapon of design.weapons) {
            if (weapon.weaponClass === banned.weaponClass) bar(weapon.label, trait.rule)
          }
          break
        case 'system':
          for (const system of design.systems) {
            if (system.kind === banned.system) bar(system.label, trait.rule)
          }
          break
        case 'weapon-class-above':
          for (const weapon of design.weapons) {
            if (weapon.rating > banned.rating) bar(weapon.label, trait.rule)
          }
          break
        case 'class-one-batteries':
          for (const weapon of design.weapons) {
            if (weapon.rating === 1 && (BATTERY_CLASSES as readonly string[]).includes(weapon.weaponClass)) {
              bar(weapon.label, trait.rule)
            }
          }
          break
        case 'spinal-mounts':
          for (const weapon of design.weapons) {
            if ((SPINAL_CLASSES as readonly string[]).includes(weapon.weaponClass)) {
              bar(weapon.label, trait.rule)
            }
          }
          break
        case 'projectiles':
          for (const weapon of design.weapons) {
            if ((PROJECTILE_CLASSES as readonly string[]).includes(weapon.weaponClass)) {
              bar(weapon.label, trait.rule)
            }
          }
          break
        case 'advanced-drives':
          if (design.drive.advanced) bar('an advanced gravity drive', trait.rule)
          break
        case 'advanced-screens':
          if (design.screens.advanced) bar('advanced screens', trait.rule)
          break
        case 'manned-small-craft':
          // *"robot fighters only"*, not "no fighters": 8.15's Robot option is
          // what makes a wing unmanned, so a bay declaring it is the one kind
          // of bay this faction may fit. No gunboat has the option (9.2), so
          // every squadron is still a crew the Shard-Swarm does not have.
          for (const bay of design.fighterBays) {
            if (!(bay.modifiers ?? []).includes('robot')) bar(`${bay.label} (manned)`, trait.rule)
          }
          if (design.gunboats.length > 0) bar('gunboat squadrons', trait.rule)
          break
        case 'emergency-thrust':
          // An order rather than a fitting, so nothing on the hull to refuse.
          break
      }
    }

    const rule = trait.design
    if (!rule) continue
    const fail = (detail: string) =>
      faults.push({
        kind: 'faction-design',
        faction: faction.name,
        trait: trait.name ?? 'design trait',
        rule: detail,
      })
    switch (rule.kind) {
      case 'max-mass':
        if (design.mass > rule.mass) fail(`mass ${design.mass} is over the ${rule.mass} limit`)
        break
      case 'hull-classes':
        if (!rule.allowed.includes(design.hullClass)) {
          fail(`a ${design.hullClass} hull, where only ${rule.allowed.join(' or ')} is built`)
        }
        break
      case 'hull-rows':
        if (design.hullRows !== rule.rows) {
          fail(`${design.hullRows} hull rows, where the damage track must be in ${rule.rows}`)
        }
        break
      case 'max-systems': {
        if (!rule.groups.includes(design.group)) break
        if (design.fighterBays.length > 0) break
        const fitted = design.systems.filter((system) => system.kind === rule.system).length
        if (fitted > rule.count) {
          fail(`${fitted} ${rule.system}, where a hull of this class may mount ${rule.count}`)
        }
        break
      }
      case 'no-damage-control':
        if (design.additionalDamageControlParties > 0) {
          fail('damage control parties on an unmanned hull')
        }
        break
      case 'thrust-modifier':
      case 'prose':
        // A cost or a rating change rather than something to refuse; the
        // generator applies it, and a hull that already has it looks legal.
        break
    }
    if (armourBoxes < 0) fail('negative armour')
  }
  return faults
}

/**
 * What the printed table charges for one mounting, where a section gives a
 * formula rather than a row (5.14, 5.16, 5.21, 6.6, 6.8).
 *
 * The families here all price by something a catalogue entry cannot carry —
 * the arc count, the class, the range line — so the numbers were typed out by
 * hand into `buildCatalog.ts` and the Shipyard, and a typo there is a fleet
 * quietly getting a cheap gun. `null` means section 14 prints a plain row for
 * this family and there is nothing to re-derive.
 *
 * Points are the section's own multiplier on mass: 3 for a Pulse Torpedo and a
 * Plasma Bolt Launcher, 4 for a K-Gun (*"K-Guns cost 4 per mass"*), 5 for a
 * Pulser, and whatever `ORDNANCE_MOUNTS` carries for section 6.
 */
export function printedWeaponCost(
  weapon: ShipDesign['weapons'][number],
): { mass: number; points: number; rule: string } | null {
  const arcs = weapon.arcs.length
  switch (weapon.weaponClass) {
    case 'pulse-torpedo': {
      const mass = pulseTorpedoMass(weapon.variant, arcs)
      return { mass, points: mass * 3, rule: '5.14' }
    }
    case 'k-gun': {
      const mass = kGunMass(weapon.rating, weapon.variant, arcs)
      // "For an additional 2 points a K-Gun may be equipped with Flak
      // ammunition" — no extra mass, so the shells ride in the same magazine.
      const flak = weapon.flak === true ? FLAK_UPGRADE_POINTS : 0
      return { mass, points: mass * 4 + flak, rule: '5.16' }
    }
    case 'pulser': {
      const mass = pulserMass(arcs)
      return { mass, points: mass * 5, rule: '5.21' }
    }
    case 'plasma-bolt-launcher': {
      const mass = plasmaBoltMass(weapon.rating, arcs)
      return { mass, points: mass * 3, rule: '6.8' }
    }
    default:
      break
  }
  // Section 6's mountings are a flat table, but the two-stage option is a
  // formula on top of it: "an extra stage … increases the mass by 2 and
  // doubles the points cost" (6.6).
  const mount = ORDNANCE_MOUNTS.find(
    (entry) => entry.weaponClass === weapon.weaponClass && entry.arcs === arcs,
  )
  if (!mount || mount.mass === null) return null
  const base = {
    mass: mount.mass,
    points: mount.points ?? (mount.pointsPerMass === null ? null : mount.mass * mount.pointsPerMass),
  }
  if (base.points === null) return null
  if (weapon.variant !== 'two-stage') {
    return { mass: base.mass, points: base.points, rule: '6.6' }
  }
  return {
    mass: multiStageMass(base.mass),
    points: multiStagePoints(base.points),
    rule: '6.6 multi-stage',
  }
}

export function validateDesign(
  design: ShipDesign,
  opts: {
    bannedSystems?: readonly string[]
    /** Check against a campaign faction's traits too (`docs/rules/factions.md`). */
    factionId?: string
    clanId?: string
  } = {},
): DesignFault[] {
  const faults: DesignFault[] = []
  if (opts.factionId) faults.push(...factionFaults(design, opts.factionId, opts.clanId))
  const cost = priceDesign(design)

  if (cost.spare < -1e-6) faults.push({ kind: 'overweight', by: -cost.spare })

  // 13.7: "There are no fixed percentage limits on hull integrity. Ship
  // designs may have as many or as few hull boxes as the designer wishes,
  // subject only to a lower limit of a minimum of 10% of the total ship mass.
  // The actual number of hull boxes chosen does not have to exactly equal any
  // given percentage of the ship's total mass" — the integrity classes are
  // names for round numbers, not a menu, so the only hard rule is the floor.
  const minimumBoxes = minimumHullBoxes(design.mass)
  if (design.hullBoxes < minimumBoxes) {
    faults.push({ kind: 'hull-too-light', minimum: minimumBoxes, found: design.hullBoxes })
  }

  const fireCons = design.systems.filter(
    (s) => s.kind === 'firecon' || s.kind === 'advanced-firecon',
  ).length
  if (design.weapons.length > 0 && fireCons === 0) faults.push({ kind: 'no-firecon' })

  // 11.7's two design clauses. The third — "a fleet with battleriders must
  // deploy the Motherships as well" — is about the fleet, so `validateFleetFtl`
  // has it and the shipyard does not.
  if (design.battlerider === true) {
    for (const problem of validateBattleriderDesign({
      id: design.id,
      mass: design.mass,
      ftl: design.ftl,
    })) {
      faults.push({ kind: 'bad-battlerider', problem })
    }
  }

  // 11.6: "every 1.5 mass used for hangar bay space provides capacity for 1
  // mass of carried ship(s) … The points cost of such space is … 3 x the total
  // mass used." A catalogue entry that drifts from that is a fleet quietly
  // getting cheap capacity, and 11.7 lets a Mothership buy its lift this way.
  for (const system of design.systems) {
    if (system.kind !== 'tender') continue
    const carried = tenderCapacityFor(system.mass)
    const mass = tenderBayMassFor(carried)
    const points = tenderBayPoints(mass)
    if (Math.abs(system.mass - mass) > 1e-6 || Math.abs(system.points - points) > 1e-6) {
      faults.push({ kind: 'mispriced-ship-bay', carried, mass, points })
    }
  }

  // 5.16: "All the K-Guns on a ship (except K-1s) must be so equipped." Flak
  // is a magazine decision for the whole battery, not a per-gun option — a
  // ship either loads shrapnel or it does not.
  const flakEligible = design.weapons.filter((weapon) => canMountFlak(weapon))
  const flakFitted = flakEligible.filter((weapon) => weapon.flak === true)
  if (flakFitted.length > 0 && flakFitted.length < flakEligible.length) {
    faults.push({
      kind: 'partial-flak',
      equipped: flakFitted.length,
      eligible: flakEligible.length,
    })
  }

  // 6.6: a launcher is not a missile. A Salvo Missile Rack is crossed off when
  // it fires because the rack *is* the salvo; an SML is a tube, and a tube
  // with no magazine behind it fires nothing at all.
  const magazines = design.magazines ?? []
  for (const weapon of design.weapons) {
    if (weapon.weaponClass !== 'salvo-missile-launcher') continue
    const feeding = magazines.filter((magazine) => magazine.launcherIds.includes(weapon.id))
    if (feeding.length === 0) faults.push({ kind: 'launcher-unfed', weaponId: weapon.id })
  }
  for (const magazine of magazines) {
    const check = checkMagazine(magazine.mass, magazine.loads)
    for (const problem of check.faults) {
      faults.push({
        kind: 'bad-magazine',
        magazineId: magazine.id,
        problem:
          problem === 'over-capacity'
            ? `${check.massUsed} mass of loads in ${magazine.mass} mass of magazine, which holds ` +
              `${magazineCapacity(magazine.mass)} standard salvoes (6.6)`
            : problem === 'mixed-stages'
              ? 'a magazine carries regular missiles or multi-stage, not a mixture (6.6)'
              : 'only standard missiles may be multi-stage, not ER (6.6)',
      })
    }
    // "Any one launcher system may only be fed from one magazine."
    for (const launcherId of magazine.launcherIds) {
      const feeders = magazines.filter((other) => other.launcherIds.includes(launcherId))
      if (feeders.length > 1) {
        faults.push({
          kind: 'bad-magazine',
          magazineId: magazine.id,
          problem: `${launcherId} draws from ${feeders.length} magazines; 6.6 allows one`,
        })
      }
    }
  }

  // 5.14, 5.16, 5.21, 6.6, 6.8: the families that price by arc count, class or
  // range line, checked against the section rather than against whatever the
  // catalogue entry says. A turreted mounting is left alone: 5.22 sells the
  // turret the arcs and the gun inside it is bought bare.
  for (const weapon of design.weapons) {
    if (weapon.turretId) continue
    const printed = printedWeaponCost(weapon)
    if (!printed) continue
    if (
      Math.abs(weapon.mass - printed.mass) > 1e-6 ||
      Math.abs(weapon.points - printed.points) > 1e-6
    ) {
      faults.push({
        kind: 'mispriced-weapon',
        weaponId: weapon.id,
        label: weapon.label,
        mass: printed.mass,
        points: printed.points,
        rule: printed.rule,
      })
    }
  }

  // 6.8: "a ship can mount only one launcher per 50 mass of ship". The firing
  // handler has always refused the extras; a design that carries them is
  // paying mass for a gun it can never fire.
  const bolts = design.weapons.filter(
    (weapon) => weapon.weaponClass === 'plasma-bolt-launcher',
  ).length
  if (bolts > 0) {
    const allowed = plasmaBoltLauncherLimit(design.mass)
    if (bolts > allowed) {
      faults.push({ kind: 'too-many-plasma-bolts', fitted: bolts, allowed })
    }
  }

  // 5.23: "A ship may only mount up to 16 mass of Spinal Mount weapon per 50
  // mass of ship." Read with 13.4's 44-mass ceiling on escorts it also means
  // no escort may carry one at all — which is how a mass-32 escort with a
  // mass-8 Spinal Beam sat in the roster until something checked.
  const spinalMass = design.weapons
    .filter((weapon) => weapon.weaponClass.startsWith('spinal-'))
    .reduce((sum, weapon) => sum + weapon.mass, 0)
  if (spinalMass > 0) {
    const allowed = maxSpinalMountMass(design.mass)
    if (spinalMass > allowed) {
      faults.push({ kind: 'spinal-overmounted', fitted: spinalMass, allowed })
    }
  }

  const hangars = countKind(design, 'hangar-bay')
  const tubes = countKind(design, 'launch-tube')
  if (hangars > 0 && tubes === 0) faults.push({ kind: 'hangar-without-tube' })

  // 8.15 and 9.2 both have builds that are illegal rather than merely bad —
  // a Light Torpedo wing, a Long Range option twice, FTL gunboats in a rack.
  // The engine has said so since the modules were written; nothing asked it
  // until a design could name a modification.
  for (const bay of design.fighterBays) {
    const typeId = bay.typeId as FighterTypeId
    if (!(typeId in FIGHTER_TYPES)) continue
    for (const problem of validateFighterBuild(typeId, fighterMods(bay.modifiers))) {
      faults.push({ kind: 'bad-small-craft', label: bay.label, problem })
    }
  }
  for (const rack of design.gunboats) {
    const typeId = rack.typeId as GunboatTypeId
    if (!(typeId in GUNBOAT_TYPES)) continue
    const problems = validateGunboatBuild(
      Array<GunboatTypeId>(GUNBOAT_SQUADRON_SIZE).fill(typeId),
      gunboatMods(rack.modifiers),
      // A design's squadrons ride the racks it bought (9.1), so an FTL
      // squadron on this hull is an FTL squadron in a rack.
      { carriedOnRack: countKind(design, 'gunboat-rack') > 0 },
    )
    for (const problem of problems) {
      faults.push({ kind: 'bad-small-craft', label: rack.label, problem })
    }
  }

  for (const turret of design.turrets) {
    const fitted = design.weapons
      .filter((w) => w.turretId === turret.id)
      .reduce((sum, w) => sum + w.mass, 0)
    if (fitted > turret.capacity) {
      faults.push({
        kind: 'turret-overloaded',
        turretId: turret.id,
        capacity: turret.capacity,
        fitted,
      })
    }
  }

  for (const weapon of design.weapons) {
    if (weapon.arcs.length < 1 || weapon.arcs.length > 6) {
      faults.push({ kind: 'bad-arcs', weaponId: weapon.id, arcs: weapon.arcs.length })
    }
  }

  const generators = countKind(design, 'screen-generator')
  if (design.screens.level > generators) {
    faults.push({
      kind: 'screens-without-generators',
      level: design.screens.level,
      generators,
    })
  }

  for (const system of design.systems) {
    const cost = proportionalCost(system.kind, design)
    if (!cost) continue
    if (Math.abs(system.mass - cost.mass) > 1e-6 || system.points !== cost.points) {
      faults.push({
        kind: 'mispriced-proportional',
        system: system.label,
        mass: cost.mass,
        points: cost.points,
      })
    }
  }

  // 13.13: extra parties and marines together may not outnumber the crew the
  // hull was designed with, which 10.4 makes a function of its mass.
  const crew = crewFactors(design.mass, design.group === 'civilian')
  const bought = design.additionalDamageControlParties + design.marineParties
  if (bought > crew) faults.push({ kind: 'too-many-parties', bought, crew })

  // 7.20: a cloak may not be "combined with any fields or screens", and 7.17
  // says the same of a Holofield, so one hull carries at most one of them.
  const fields = design.systems.filter((system) =>
    ['cloaking-device', 'cloaking-field', 'tuffley-cloak', 'holofield'].includes(system.kind),
  )
  if (fields.length > 1) faults.push({ kind: 'two-cloaks' })
  // The other half of the same two sentences, and the half nobody was checking:
  // it is not only that the fields exclude each other, it is that either of
  // them excludes screens. A hull turns shots aside or it hides from them.
  if (fields.length > 0 && (design.screens.level > 0 || design.screens.generators > 0)) {
    faults.push({ kind: 'field-with-screens', field: fields[0].label })
  }

  for (const banned of opts.bannedSystems ?? []) {
    if (design.systems.some((s) => s.kind === banned) ||
        design.weapons.some((w) => w.weaponClass === banned)) {
      faults.push({ kind: 'banned', system: banned })
    }
  }

  return faults
}

function countKind(design: ShipDesign, kind: SystemKind): number {
  return design.systems.filter((s) => s.kind === kind).length
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

/** Hull row options and what a box costs in each (13.7). */
export const HULL_ROW_OPTIONS: ReadonlyArray<{ rows: HullRows; pointsPerBox: number; note: string }> = [
  { rows: 3, pointsPerBox: 3, note: 'Three threshold points in a ship’s life. Expensive.' },
  { rows: 4, pointsPerBox: 2, note: 'The standard layout.' },
  { rows: 5, pointsPerBox: 1.5, note: 'Cheaper, and checked more often.' },
  { rows: 6, pointsPerBox: 1, note: 'Cheapest, and falls apart under fire.' },
]

/** Integrity classes and the share of hull mass each gives (13.7). */
export const HULL_CLASS_OPTIONS: ReadonlyArray<{ hullClass: HullClass; fraction: number }> = (
  ['fragile', 'weak', 'average', 'strong', 'super'] as HullClass[]
).map((hullClass) => ({ hullClass, fraction: HULL_FRACTION[hullClass] }))
