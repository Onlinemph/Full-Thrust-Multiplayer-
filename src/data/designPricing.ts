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
 * function that resolves it.
 *
 * `tools/build_roster.py` does the same arithmetic in Python to generate the
 * shipped roster offline; `ships.test.ts` asserts the two agree on every hull,
 * which is what stops them drifting.
 */

import {
  HULL_FRACTION,
  HULL_POINTS_PER_BOX,
  type ArmourDef,
  type HullClass,
  type HullRows,
  type ShipDesign,
  type SystemKind,
} from '../engine/types'

// ---------------------------------------------------------------------------
// The proportional systems (13.7 – 13.11)
// ---------------------------------------------------------------------------

/** Mass of the main drive: 5% of the ship per point of thrust (13.9). */
export function driveMass(mass: number, thrust: number): number {
  return 0.05 * thrust * mass
}

/** An advanced drive weighs the same and costs more (13.10). */
export function drivePoints(mass: number, thrust: number, advanced: boolean): number {
  return driveMass(mass, thrust) * (advanced ? 3 : 2)
}

/** FTL is a tenth of the hull, whatever the hull (13.10). */
export function ftlMass(mass: number): number {
  return 0.1 * mass
}

export function ftlPoints(mass: number, advanced: boolean): number {
  return ftlMass(mass) * (advanced ? 3 : 2)
}

/** Atmospheric streamlining: 5% partial, 10% full, and free in points (13.11). */
export function streamliningMass(mass: number, kind: ShipDesign['streamlining']): number {
  if (kind === 'none') return 0
  return (kind === 'partial' ? 0.05 : 0.1) * mass
}

/** One level of screens is 5% of the hull, or 7.5% advanced (7.2, 7.3). */
export function screenMass(mass: number, level: number, advanced: boolean): number {
  return (advanced ? 0.075 : 0.05) * mass * level
}

export function screenPoints(mass: number, level: number, advanced: boolean): number {
  return screenMass(mass, level, advanced) * (advanced ? 4 : 3)
}

/** Hull boxes from mass and integrity class (13.7). One box costs one mass. */
export function hullBoxesFor(mass: number, hullClass: HullClass): number {
  return Math.floor(mass * HULL_FRACTION[hullClass])
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

/** A damage control party and a marine party: 5 points, no mass (13.13). */
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

export function priceDesign(design: ShipDesign): DesignCost {
  const m = design.mass
  const massUsed =
    design.hullBoxes +
    driveMass(m, design.drive.thrust) +
    (design.ftl === 'none' ? 0 : ftlMass(m)) +
    streamliningMass(m, design.streamlining) +
    armourMass(design.armour) +
    screenMass(m, design.screens.level, design.screens.advanced) +
    design.weapons.reduce((sum, w) => sum + w.mass, 0) +
    design.turrets.reduce((sum, t) => sum + t.mass, 0) +
    design.systems.reduce((sum, s) => sum + s.mass, 0)

  const points =
    design.hullBoxes * HULL_POINTS_PER_BOX[design.hullRows] +
    drivePoints(m, design.drive.thrust, design.drive.advanced) +
    (design.ftl === 'none' ? 0 : ftlPoints(m, design.ftl === 'advanced')) +
    armourPoints(design.armour) +
    screenPoints(m, design.screens.level, design.screens.advanced) +
    design.weapons.reduce((sum, w) => sum + w.points, 0) +
    design.turrets.reduce((sum, t) => sum + t.points, 0) +
    design.systems.reduce((sum, s) => sum + s.points, 0) +
    (design.damageControlParties + design.marineParties) * CREW_PARTY_POINTS

  // Flawed Design: 10% more mass to fill, 20% off the points, and a standing
  // penalty on every threshold check (13.13).
  const massAvailable = design.flawed ? m * 1.1 : m
  const finalPoints = design.flawed ? points * 0.8 : points

  return {
    massUsed: round2(massUsed),
    massAvailable: round2(massAvailable),
    // floor(x + 0.5), not Math.round's banker's cousin in other languages: a
    // screen level is 5% of mass, so exact halves are common and the Python
    // generator has to agree with this to the point.
    points: Math.floor(finalPoints + 0.5),
    spare: round2(massAvailable - massUsed),
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
  | { kind: 'hull-boxes'; expected: number; found: number }
  | { kind: 'no-firecon' }
  | { kind: 'hangar-without-tube' }
  | { kind: 'turret-overloaded'; turretId: string; capacity: number; fitted: number }
  | { kind: 'bad-arcs'; weaponId: string; arcs: number }
  | { kind: 'screens-without-generators'; level: number; generators: number }
  | { kind: 'banned'; system: string }

export function describeFault(fault: DesignFault): string {
  switch (fault.kind) {
    case 'overweight':
      return `${fault.by.toFixed(2)} mass over the hull's rating`
    case 'hull-boxes':
      return `hull should have ${fault.expected} boxes for this mass and integrity, not ${fault.found}`
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
  }
}

export function validateDesign(
  design: ShipDesign,
  opts: { bannedSystems?: readonly string[] } = {},
): DesignFault[] {
  const faults: DesignFault[] = []
  const cost = priceDesign(design)

  if (cost.spare < -1e-6) faults.push({ kind: 'overweight', by: -cost.spare })

  const expected = hullBoxesFor(design.mass, design.hullClass)
  if (design.hullBoxes !== expected) {
    faults.push({ kind: 'hull-boxes', expected, found: design.hullBoxes })
  }

  const fireCons = design.systems.filter(
    (s) => s.kind === 'firecon' || s.kind === 'advanced-firecon',
  ).length
  if (design.weapons.length > 0 && fireCons === 0) faults.push({ kind: 'no-firecon' })

  const hangars = countKind(design, 'hangar-bay')
  const tubes = countKind(design, 'launch-tube')
  if (hangars > 0 && tubes === 0) faults.push({ kind: 'hangar-without-tube' })

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
