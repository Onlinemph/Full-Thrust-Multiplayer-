/**
 * Vehicle design (Chapter 3): what a hull can hold, what the rules refuse,
 * and the figures a record card reads off a design.
 */

import { baseMovementOf, mobilityKind } from './data/mobility'
import { GMS_RANGE, rangeBandsOf, targetDie, weaponKind, type DieType } from './data/weapons'
import type { DirectFireWeapon, MissileSystem, SizeClass, VehicleDesign, WeaponClass } from './types'

/** Capacity points: size class × 5; oversize classes 6 and 7 have 30 and 35 (p. 8, p. 15). */
export function capacityOf(size: SizeClass): number {
  return size * 5
}

/** Whether the mobility is a walker's, whose mounts all cost as fixed (p. 14). */
export function isWalker(design: Pick<VehicleDesign, 'mobility'>): boolean {
  return mobilityKind(design.mobility).walker
}

export function isAir(design: Pick<VehicleDesign, 'mobility'>): boolean {
  return mobilityKind(design.mobility).air
}

export function isWater(design: Pick<VehicleDesign, 'mobility'>): boolean {
  return mobilityKind(design.mobility).water
}

/**
 * The primary weapon: the largest direct-fire weapon, and among equals the
 * first listed (p. 11: "select the LARGEST (or 'Primary') weapon to be
 * fitted first").
 */
export function primaryWeapon(design: Pick<VehicleDesign, 'weapons'>): DirectFireWeapon | undefined {
  let best: DirectFireWeapon | undefined
  for (const weapon of design.weapons) if (!best || weapon.class > best.class) best = weapon
  return best
}

/** Capacity a direct-fire weapon takes (p. 11, p. 14). */
export function weaponCapacity(design: Pick<VehicleDesign, 'weapons' | 'mobility'>, weapon: DirectFireWeapon): number {
  const primary = primaryWeapon(design)
  const barrels = Math.max(1, weapon.barrels)
  if (weapon === primary && weapon.mount === 'turret' && !isWalker(design)) {
    // The turret is paid for once, on the primary; every barrel after the first is 2 × class.
    return weapon.class * 3 + (barrels - 1) * weapon.class * 2
  }
  return barrels * weapon.class * 2
}

export function missileCapacity(missile: MissileSystem): number {
  return missile.size === 'light' ? 2 : 4
}

export const ARTILLERY_CLASS: Record<'light' | 'medium' | 'heavy', number> = { light: 2, medium: 4, heavy: 6 }

export interface CapacityLine {
  label: string
  capacity: number
}

/** Every capacity item on the design, as the card lists them (p. 16). */
export function capacityLines(design: VehicleDesign): CapacityLine[] {
  const lines: CapacityLine[] = []
  for (const weapon of design.weapons) {
    lines.push({ label: `${weaponLabel(weapon)}${weapon.barrels > 1 ? ` ×${weapon.barrels}` : ''} (${weapon.mount})`, capacity: weaponCapacity(design, weapon) })
  }
  for (const missile of design.missiles) lines.push({ label: missileLabel(missile), capacity: missileCapacity(missile) })
  if (design.pds) lines.push({ label: `PDS (${design.pds})`, capacity: { basic: 2, enhanced: 3, superior: 4 }[design.pds] })
  if (design.ads) lines.push({ label: `ADS (${design.ads})`, capacity: { basic: 10, enhanced: 15, superior: 20 }[design.ads] })
  if (design.lad > 0) lines.push({ label: `LAD ×${design.lad}`, capacity: 2 * design.lad })
  if (design.extraApsw > 0) lines.push({ label: `extra APSW ×${design.extraApsw}`, capacity: design.extraApsw })
  if (design.apfc) lines.push({ label: 'APFC', capacity: 1 })
  if (design.transport.lineTeams > 0) lines.push({ label: `line/militia teams ×${design.transport.lineTeams}`, capacity: 4 * design.transport.lineTeams })
  if (design.transport.poweredTeams > 0) lines.push({ label: `powered teams ×${design.transport.poweredTeams}`, capacity: 8 * design.transport.poweredTeams })
  if (design.transport.cargoLoads > 0) lines.push({ label: `cargo loads ×${design.transport.cargoLoads}`, capacity: 4 * design.transport.cargoLoads })
  for (const size of design.transport.vehicleSizes) lines.push({ label: `carried vehicle, size ${size}`, capacity: 8 * size })
  if (design.transport.commandCentre) lines.push({ label: 'command/communications centre', capacity: 8 })
  if (design.artillery) lines.push({ label: `${design.artillery} artillery`, capacity: 3 * ARTILLERY_CLASS[design.artillery] })
  if (design.counterBatteryRadar) lines.push({ label: 'counter-battery radar', capacity: 14 })
  if (design.ordnanceLoads > 0) lines.push({ label: `ordnance loads ×${design.ordnanceLoads}`, capacity: 4 * design.ordnanceLoads })
  return lines
}

export function capacityUsed(design: VehicleDesign): number {
  return capacityLines(design).reduce((sum, line) => sum + line.capacity, 0)
}

/** Weapon systems against the "no more than its size class" limit (p. 11): every barrel, every launcher, the PDS, extra APSWs. */
export function weaponSystemsCount(design: VehicleDesign): number {
  return (
    design.weapons.reduce((sum, w) => sum + Math.max(1, w.barrels), 0) +
    design.missiles.length +
    (design.pds ? 1 : 0) +
    (design.ads ? 1 : 0) +
    design.lad +
    design.extraApsw +
    (design.artillery ? 1 : 0)
  )
}

export function weaponLabel(weapon: Pick<DirectFireWeapon, 'type' | 'class'>): string {
  return `${weaponKind(weapon.type).short}/${weapon.class}`
}

export function missileLabel(missile: MissileSystem): string {
  return `GMS/${missile.size === 'light' ? 'L' : 'H'} (${missile.guidance.slice(0, 3).toUpperCase()})`
}

/** Basic signature: size class, one more for a walker (p. 11, p. 14). */
export function basicSignature(design: Pick<VehicleDesign, 'size' | 'mobility'>): number {
  return design.size + (isWalker(design) ? 1 : 0)
}

/** Effective signature: basic less the stealth levels, never below 1 (p. 11). */
export function effectiveSignature(design: Pick<VehicleDesign, 'size' | 'mobility' | 'stealth'>): number {
  return Math.max(1, basicSignature(design) - design.stealth)
}

export function targetDieOf(design: Pick<VehicleDesign, 'size' | 'mobility' | 'stealth'>): DieType {
  return targetDie(effectiveSignature(design))
}

/** Side, top and rear armour: one less than the front, never below 0 (p. 10). */
export function sideArmour(design: Pick<VehicleDesign, 'armour'>): number {
  return Math.max(0, design.armour - 1)
}

export interface DesignFault {
  /** The printed page the rule is on. */
  page: string
  detail: string
  /** Advisory: the book recommends rather than forbids. */
  advisory?: boolean
}

/** Why a design is not legal, each with the page that refuses it; empty for a legal design. */
export function validateDesign(design: VehicleDesign): DesignFault[] {
  const faults: DesignFault[] = []
  const size = design.size
  const air = isAir(design)
  const water = isWater(design)
  const walker = isWalker(design)
  const kind = mobilityKind(design.mobility)

  if (size < 1 || size > 7) faults.push({ page: 'p. 8', detail: 'Size classes run from 1 to 5, with 6 and 7 as oversize vehicles' })
  if (design.weapons.length === 0 && design.fireControl) faults.push({ page: 'p. 11', detail: 'A fire control system needs a direct-fire weapon to control', advisory: true })

  // Capacity (p. 8): size class × 5.
  const used = capacityUsed(design)
  const capacity = capacityOf(size)
  if (used > capacity) faults.push({ page: 'p. 8', detail: `Capacity ${used} used of ${capacity}` })

  // Count of weapon systems (p. 11).
  const systems = weaponSystemsCount(design)
  if (systems > size) faults.push({ page: 'p. 11', detail: `${systems} weapon systems fitted; a class ${size} vehicle may carry no more than ${size}` })

  // Weapon classes made (pp. 8–9) and the recommended limit (p. 12).
  for (const weapon of design.weapons) {
    const made = weaponKind(weapon.type).classes
    if (!made.includes(weapon.class)) faults.push({ page: 'pp. 8–9', detail: `${weaponKind(weapon.type).short} is made in classes ${made.join(', ')}, not ${weapon.class}` })
    if (weapon.class > size + 1 && size <= 5) faults.push({ page: 'p. 12', detail: `${weaponLabel(weapon)} is more than one class larger than the vehicle; the book recommends against it`, advisory: true })
    if (size >= 6 && weapon.class > 5) faults.push({ page: 'p. 15', detail: 'There are no weapons larger than class 5' })
    if (weapon.barrels < 1) faults.push({ page: 'p. 11', detail: 'A weapon needs at least one barrel' })
  }

  // Power plant against mobility (p. 10) and energy weapons (p. 10).
  const gevLimit = { cfe: { slow: 3, fast: 2 }, hmt: { slow: 4, fast: 3 }, fgp: { slow: 7, fast: 7 } }[design.power]
  if (design.mobility === 'slow-gev' || design.mobility === 'air-cushion') {
    if (size > gevLimit.slow) faults.push({ page: 'p. 10', detail: `A ${design.power.toUpperCase()} drives a slow GEV only up to size ${gevLimit.slow}` })
  }
  if (design.mobility === 'fast-gev' && size > gevLimit.fast) faults.push({ page: 'p. 10', detail: `A ${design.power.toUpperCase()} drives a fast GEV only up to size ${gevLimit.fast}` })
  if ((design.mobility === 'grav' || walker || size >= 6) && design.power !== 'fgp') {
    faults.push({ page: 'p. 10', detail: 'Grav, walker and oversize vehicles must use a fusion plant' })
  }
  if (air && design.power !== 'fgp') faults.push({ page: 'p. 14', detail: 'All air vehicles must pay for a fusion plant' })
  for (const weapon of design.weapons) {
    if (!weaponKind(weapon.type).needsPower) continue
    const limit = design.power === 'cfe' ? size - 2 : design.power === 'hmt' ? size - 1 : 99
    if (weapon.class > limit) {
      faults.push({ page: 'p. 10', detail: `A ${design.power.toUpperCase()} powers a ${weaponKind(weapon.type).short} only up to class ${Math.max(0, limit)} on a size ${size} vehicle` })
    }
  }

  // Armour (p. 10; riverine p. 13; air p. 14; oversize p. 15).
  if (design.armour < 0) faults.push({ page: 'p. 10', detail: 'There is no armour value below 0' })
  const armourCap = water ? size - 2 : air ? Math.min(design.mobility === 'vtol' ? 2 : 3, size - 1) : size <= 5 ? Math.min(size, 5) : 7
  if (design.armour > Math.max(0, armourCap)) {
    faults.push({ page: water ? 'p. 13' : air ? 'p. 14' : size <= 5 ? 'p. 10' : 'p. 15', detail: `Armour ${design.armour} is over the limit of ${Math.max(0, armourCap)} for this vehicle` })
  }

  // Riverine weapons (p. 13).
  if (water) {
    for (const weapon of design.weapons) {
      if (weapon.class > Math.max(1, size - 1)) faults.push({ page: 'p. 13', detail: `A size ${size} vessel may mount no weapon larger than class ${Math.max(1, size - 1)}` })
    }
  }

  // Air vehicles (p. 14): fixed mounts, nothing over class 3, small turrets for class 1 on a VTOL only.
  if (air) {
    for (const weapon of design.weapons) {
      if (weapon.class > 3) faults.push({ page: 'p. 14', detail: 'No weapon over class 3 may be fitted to an air vehicle' })
      if (weapon.mount === 'turret' && !(design.mobility === 'vtol' && weapon.class === 1)) {
        faults.push({ page: 'p. 14', detail: 'Air vehicles carry their weapons in fixed mounts; a VTOL may turret a class 1 weapon only' })
      }
    }
  } else if (design.ordnanceLoads > 0) {
    faults.push({ page: 'p. 14', detail: 'Only aerospace craft carry dead-fall ordnance' })
  }
  if (design.ordnanceLoads > 0 && design.mobility !== 'aerospace') faults.push({ page: 'p. 14', detail: 'Only aerospace craft carry dead-fall ordnance' })

  // Walkers (p. 14): classes 4 and 5 (6–7 oversize).
  if (walker && size < 4) faults.push({ page: 'p. 14', detail: 'Combat and transport walkers are class 4 or 5' })

  // Oversize (p. 15): no stealth for modular giants is a modular rule; plain oversize may buy it.
  if (kind.air && design.amphibious) faults.push({ page: 'p. 52', detail: 'Amphibious capability is a ground vehicle’s' })
  if (design.stealth < 0) faults.push({ page: 'p. 11', detail: 'Stealth levels cannot be negative' })
  if (design.artillery && design.artillery === 'heavy' && size < 6 && design.weapons.length > 0) {
    faults.push({ page: 'p. 12', detail: 'A heavy artillery mount takes 18 capacity; check what is left for direct-fire weapons', advisory: true })
  }
  return faults
}

/** The stats a record card reads straight off the design. */
export interface DesignSummary {
  capacity: number
  capacityUsed: number
  basicSignature: number
  effectiveSignature: number
  targetDie: DieType
  baseMovement: number | null
  sideArmour: number
  weaponSystems: number
  primary: DirectFireWeapon | undefined
}

export function summariseDesign(design: VehicleDesign): DesignSummary {
  return {
    capacity: capacityOf(design.size),
    capacityUsed: capacityUsed(design),
    basicSignature: basicSignature(design),
    effectiveSignature: effectiveSignature(design),
    targetDie: targetDieOf(design),
    baseMovement: baseMovementOf(design),
    sideArmour: sideArmour(design),
    weaponSystems: weaponSystemsCount(design),
    primary: primaryWeapon(design),
  }
}

/** Range bands of a fitted weapon, for the card (p. 28). */
export function weaponRanges(weapon: Pick<DirectFireWeapon, 'type' | 'class'>) {
  return rangeBandsOf(weapon.type, weapon.class as WeaponClass)
}

export function missileRange(missile: Pick<MissileSystem, 'size'>): number {
  return GMS_RANGE[missile.size]
}

/** A blank hull to start designing from: a medium tracked vehicle with nothing on it. */
export function newVehicleDesign(id: string): VehicleDesign {
  return {
    id,
    name: 'New vehicle',
    role: 'Medium tank',
    size: 3,
    mobility: 'fast-tracked',
    amphibious: false,
    power: 'hmt',
    armour: 3,
    armourSpecial: 'none',
    weapons: [],
    missiles: [],
    fireControl: null,
    ecm: 'none',
    pds: null,
    ads: null,
    lad: 0,
    extraApsw: 0,
    apfc: false,
    stealth: 0,
    backupSystems: false,
    artillery: null,
    counterBatteryRadar: null,
    transport: { lineTeams: 0, poweredTeams: 0, cargoLoads: 0, vehicleSizes: [], commandCentre: false },
    ordnanceLoads: 0,
    engineering: { repair: false, bridgeClass: null, general: false },
    medicalPost: false,
  }
}
