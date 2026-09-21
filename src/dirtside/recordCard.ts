/**
 * The record card (p. 55): everything a player needs about a vehicle type
 * during play, read off the design once so the rulebook stays shut.
 */

import { baseMovementOf, mobilityKind } from './data/mobility'
import {
  APSW_RANGE,
  DEFENCE_DIE,
  GUIDANCE_DIE,
  RANGE_BANDS,
  firerDie,
  missileValidity,
  singleBand,
  validityAgainstInfantry,
  validityOf,
  type ChitValidity,
  type DieType,
  type RangeBand,
} from './data/weapons'
import { ARTILLERY_CLASS, effectiveSignature, basicSignature, missileLabel, missileRange, sideArmour, targetDieOf, weaponLabel, weaponRanges } from './design'
import { priceDesign } from './pricing'
import type { VehicleDesign } from './types'

export interface CardBand {
  band: RangeBand
  upTo: number
  die: DieType
  valid: ChitValidity
}

export interface CardWeaponRow {
  label: string
  mount: 'TU' | 'FX'
  barrels: number
  /** Three bands, or one for a HEL. */
  bands: CardBand[]
  /** Chit validity against infantry, or null when the weapon has no effect on them. */
  againstInfantry: ChitValidity | null
  /** Chits drawn per hit: the weapon's class (p. 29). */
  chits: number
}

export interface CardMissileRow {
  label: string
  maxRange: number
  die: DieType
  valid: ChitValidity
  chits: number
}

export interface RecordCard {
  name: string
  type: string
  size: number
  basicSignature: number
  stealth: number
  effectiveSignature: number
  targetDie: DieType
  mobility: string
  baseMove: number | null
  points: number
  fireControl: string
  ecm: string
  armourFront: number
  armourSide: number
  weapons: CardWeaponRow[]
  missiles: CardMissileRow[]
  pds: { label: string; die: DieType } | null
  /** The "other equipment and notes" box. */
  notes: string[]
}

export function recordCardOf(design: VehicleDesign): RecordCard {
  const cost = priceDesign(design)
  const weapons: CardWeaponRow[] = design.weapons.map((weapon) => {
    const ranges = weaponRanges(weapon)
    const bands: CardBand[] = (singleBand(weapon.type) ? (['close'] as RangeBand[]) : RANGE_BANDS).map((band) => ({
      band,
      upTo: ranges ? ranges[band] : 0,
      die: firerDie(design.fireControl ?? 'basic', band),
      valid: validityOf(weapon.type, band),
    }))
    return {
      label: weaponLabel(weapon),
      mount: weapon.mount === 'turret' ? 'TU' : 'FX',
      barrels: Math.max(1, weapon.barrels),
      bands,
      againstInfantry: validityAgainstInfantry(weapon.type),
      chits: weapon.class,
    }
  })
  const missiles: CardMissileRow[] = design.missiles.map((missile) => ({
    label: missileLabel(missile),
    maxRange: missileRange(missile),
    die: GUIDANCE_DIE[missile.guidance],
    valid: missileValidity(),
    chits: missile.size === 'light' ? 3 : 5,
  }))
  const notes: string[] = []
  notes.push(`${1 + design.extraApsw} APSW (${APSW_RANGE}", yellow chits vs infantry)`)
  if (design.apfc) notes.push('APFC')
  if (design.ads) notes.push(`${design.ads.toUpperCase()} ADS (D${DEFENCE_DIE[design.ads]}, 12" cover, 36" vs air)`)
  if (design.lad > 0) notes.push(`${design.lad} × LAD`)
  if (design.backupSystems) notes.push('Backup systems')
  if (design.armourSpecial !== 'none') notes.push(`${design.armourSpecial} armour`)
  if (design.amphibious) notes.push('Amphibious')
  if (design.transport.lineTeams > 0) notes.push(`Carries ${design.transport.lineTeams} line/militia team${design.transport.lineTeams === 1 ? '' : 's'}`)
  if (design.transport.poweredTeams > 0) notes.push(`Carries ${design.transport.poweredTeams} powered team${design.transport.poweredTeams === 1 ? '' : 's'}`)
  if (design.transport.cargoLoads > 0) notes.push(`${design.transport.cargoLoads} cargo load${design.transport.cargoLoads === 1 ? '' : 's'}`)
  for (const size of design.transport.vehicleSizes) notes.push(`Carries a size ${size} vehicle`)
  if (design.transport.commandCentre) notes.push('Command/communications centre')
  if (design.artillery) notes.push(`${design.artillery} artillery (class ${ARTILLERY_CLASS[design.artillery]}), front 180°`)
  if (design.counterBatteryRadar) notes.push(`${design.counterBatteryRadar} counter-battery radar`)
  if (design.ordnanceLoads > 0) notes.push(`${design.ordnanceLoads} ordnance load${design.ordnanceLoads === 1 ? '' : 's'} (DFO)`)
  if (design.engineering.repair) notes.push('Repair/recovery package')
  if (design.engineering.bridgeClass !== null) notes.push(`Bridge system, class ${design.engineering.bridgeClass}`)
  if (design.engineering.general) notes.push('Engineering package')
  if (design.medicalPost) notes.push('Mobile medical post')
  if (design.notes) notes.push(design.notes)

  return {
    name: design.name,
    type: design.role,
    size: design.size,
    basicSignature: basicSignature(design),
    stealth: design.stealth,
    effectiveSignature: effectiveSignature(design),
    targetDie: targetDieOf(design),
    mobility: mobilityKind(design.mobility).label + (design.variant ? ` (${design.variant})` : ''),
    baseMove: baseMovementOf(design),
    points: cost.total,
    fireControl: design.fireControl ? design.fireControl.slice(0, 3).toUpperCase() : '—',
    ecm: design.ecm === 'none' ? '—' : design.ecm.slice(0, 3).toUpperCase(),
    armourFront: design.armour,
    armourSide: sideArmour(design),
    weapons,
    missiles,
    pds: design.pds ? { label: `PDS (${design.pds.slice(0, 3).toUpperCase()})`, die: DEFENCE_DIE[design.pds] } : null,
    notes,
  }
}
