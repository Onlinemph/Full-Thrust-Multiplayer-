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
  factionById,
  traitsFor,
  PROJECTILE_CLASSES,
  SPINAL_CLASSES,
} from './factions'
import {
  HULL_FRACTION,
  HULL_POINTS_PER_BOX,
  type ArmourDef,
  type HullClass,
  type HullRows,
  type ShipDesign,
  type SystemKind,
} from '../engine/types'
import { crewFactors } from '../engine/game'

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

/**
 * The fewest boxes a hull may have (13.7): *"a lower limit of a minimum of 10%
 * of the total ship mass"* — the fragile hull, which is the floor rather than
 * one option among five.
 */
export function minimumHullBoxes(mass: number): number {
  return Math.floor(mass * HULL_FRACTION.fragile)
}

/**
 * Hull boxes at an integrity class (13.7). One box costs one mass.
 *
 * The classes are *descriptions* — "the following terms may be used to
 * describe the kind of structure a ship has" — so this is what a designer gets
 * by picking a round number, not what the rules require of them. Validation
 * enforces `minimumHullBoxes` and nothing more.
 */
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
  const mass = spec.mass === 'fraction' ? (spec.massFraction ?? 0) * shipMass : spec.mass
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
    (design.additionalDamageControlParties + design.marineParties) * CREW_PARTY_POINTS

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
  | { kind: 'hull-too-light'; minimum: number; found: number }
  | { kind: 'no-firecon' }
  | { kind: 'hangar-without-tube' }
  | { kind: 'turret-overloaded'; turretId: string; capacity: number; fitted: number }
  | { kind: 'bad-arcs'; weaponId: string; arcs: number }
  | { kind: 'screens-without-generators'; level: number; generators: number }
  | { kind: 'banned'; system: string }
  | { kind: 'mispriced-proportional'; system: string; mass: number; points: number }
  | { kind: 'two-cloaks' }
  | { kind: 'too-many-parties'; bought: number; crew: number }
  /** A faction trait forbids this outright (`docs/rules/factions.md`). */
  | { kind: 'faction-prohibition'; faction: string; what: string; rule: string }
  /** A faction design trait this hull does not satisfy. */
  | { kind: 'faction-design'; faction: string; trait: string; rule: string }

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
    case 'too-many-parties':
      return `${fault.bought} extra crew parties on a hull crewed for ${fault.crew}: a ship "may not mount more Damage Control Parties (and or additional Marines) than the number of crew it was initially designed with" (13.13)`
    case 'faction-prohibition':
      return `${fault.what}: the ${fault.faction} does not build it — ${fault.rule}`
    case 'faction-design':
      return `${fault.faction} ${fault.trait}: ${fault.rule}`
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
          if (design.fighterBays.length > 0) bar('manned fighter bays', trait.rule)
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
  ).length
  if (fields > 1) faults.push({ kind: 'two-cloaks' })

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
