/**
 * The points value system (pp. 52–53), line by line, rounded the way the
 * book's own example rounds: each line to the nearest point ("9.6, rounded
 * to 10"), before it is added to the total.
 */

import {
  ADS_COST,
  AMPHIBIOUS_PERCENT,
  APFC_PER_CLASS,
  ARMOUR_PERCENT_PER_LEVEL,
  ARTILLERY_SYSTEM_COST,
  BACKUP_PERCENT,
  BRIDGE_PER_CLASS,
  CAVALRY_PERCENT,
  COMMAND_CENTRE_VEHICLE_COST,
  COUNTER_BATTERY_RADAR_COST,
  DFO_LOAD_COST,
  ECM_COST,
  EXTRA_APSW_COST,
  FIRE_CONTROL_PER_CLASS,
  GENERAL_ENGINEERING_COST,
  GMS_HEAVY_COST,
  GMS_LIGHT_COST,
  LAD_COST,
  MEDICAL_POST_MOBILE_COST,
  PDS_COST,
  POWER_PLANT_PERCENT,
  REPAIR_PACKAGE_PER_CLASS,
  RIFLE_TEAM_COST,
  SPECIALIST_EQUIPMENT_COST,
  SPECIAL_ARMOUR_PERCENT_PER_LEVEL,
  STEALTH_PER_CLASS_PER_LEVEL,
  VSP_PER_CLASS,
} from './data/costs'
import { mobilityKind } from './data/mobility'
import { weaponKind } from './data/weapons'
import { missileLabel, primaryWeapon, weaponLabel } from './design'
import type { InfantryElement, VehicleDesign } from './types'

export interface CostLine {
  label: string
  /** The arithmetic, as the book writes it: "40% of BVP 24". */
  working: string
  points: number
  /** 'hull' lines make up the BVP and the mobile hull; 'system' lines count for backup systems. */
  group: 'hull' | 'weapon' | 'system' | 'defence' | 'other'
}

export interface DesignCost {
  lines: CostLine[]
  vsp: number
  bvp: number
  total: number
}

/** Round to the nearest point, halves up, as the worked example does (p. 52). */
export function roundPoints(value: number): number {
  return Math.round(value + 1e-9)
}

function percentOf(percent: number, base: number): number {
  return roundPoints((percent / 100) * base)
}

/** The design's points value, and every line of the working (pp. 52–53). */
export function priceDesign(design: VehicleDesign): DesignCost {
  const lines: CostLine[] = []
  const vsp = design.size * VSP_PER_CLASS
  lines.push({ label: `Vehicle size points, class ${design.size}`, working: `${design.size} × ${VSP_PER_CLASS}`, points: vsp, group: 'hull' })

  const armourPercent = design.armour * (ARMOUR_PERCENT_PER_LEVEL + (design.armourSpecial === 'none' ? 0 : SPECIAL_ARMOUR_PERCENT_PER_LEVEL))
  const armourPoints = percentOf(armourPercent, vsp)
  if (design.armour > 0) {
    lines.push({
      label: `Armour ${design.armour}${design.armourSpecial === 'ablative' ? 'A' : design.armourSpecial === 'reactive' ? 'R' : ''}`,
      working: `${armourPercent}% of VSP ${vsp}`,
      points: armourPoints,
      group: 'hull',
    })
  }
  const bvp = vsp + armourPoints

  const plant = POWER_PLANT_PERCENT[design.power]
  lines.push({ label: `${design.power.toUpperCase()} power plant`, working: `${plant}% of BVP ${bvp}`, points: percentOf(plant, bvp), group: 'hull' })
  const mobility = mobilityKind(design.mobility)
  lines.push({ label: `${mobility.label} mobility`, working: `${mobility.costPercent}% of BVP ${bvp}`, points: percentOf(mobility.costPercent, bvp), group: 'hull' })
  if (design.amphibious) lines.push({ label: 'Amphibious', working: `${AMPHIBIOUS_PERCENT}% of BVP ${bvp}`, points: percentOf(AMPHIBIOUS_PERCENT, bvp), group: 'hull' })

  for (const weapon of design.weapons) {
    const kind = weaponKind(weapon.type)
    const barrels = Math.max(1, weapon.barrels)
    lines.push({
      label: `${weaponLabel(weapon)}${barrels > 1 ? ` ×${barrels}` : ''}`,
      working: `${kind.pointsPerClass} × ${weapon.class}${barrels > 1 ? ` × ${barrels}` : ''}`,
      points: kind.pointsPerClass * weapon.class * barrels,
      group: 'weapon',
    })
  }
  if (design.extraApsw > 0) lines.push({ label: `Extra APSW ×${design.extraApsw}`, working: `${EXTRA_APSW_COST} each`, points: EXTRA_APSW_COST * design.extraApsw, group: 'weapon' })

  const primary = primaryWeapon(design)
  if (design.fireControl && primary) {
    const per = FIRE_CONTROL_PER_CLASS[design.fireControl]
    lines.push({ label: `${design.fireControl} fire control`, working: `${per} × class ${primary.class}`, points: per * primary.class, group: 'system' })
  }
  for (const missile of design.missiles) {
    const cost = (missile.size === 'light' ? GMS_LIGHT_COST : GMS_HEAVY_COST)[missile.guidance]
    lines.push({ label: missileLabel(missile), working: `${missile.guidance} guidance`, points: cost, group: 'system' })
  }
  if (design.ads) lines.push({ label: `${design.ads} ADS`, working: '', points: ADS_COST[design.ads], group: 'defence' })
  if (design.lad > 0) lines.push({ label: `LAD ×${design.lad}`, working: `${LAD_COST} each`, points: LAD_COST * design.lad, group: 'defence' })
  if (design.pds) lines.push({ label: `${design.pds} PDS`, working: '', points: PDS_COST[design.pds], group: 'defence' })
  if (design.ecm !== 'none') lines.push({ label: `${design.ecm} ECM`, working: '', points: ECM_COST[design.ecm], group: 'system' })
  if (design.apfc) lines.push({ label: 'APFC belt', working: `${APFC_PER_CLASS} × class ${design.size}`, points: APFC_PER_CLASS * design.size, group: 'defence' })
  if (design.stealth > 0) {
    lines.push({
      label: `Stealth ×${design.stealth}`,
      working: `${STEALTH_PER_CLASS_PER_LEVEL} × class ${design.size} × ${design.stealth}`,
      points: STEALTH_PER_CLASS_PER_LEVEL * design.size * design.stealth,
      group: 'system',
    })
  }
  if (design.artillery) lines.push({ label: `${design.artillery} artillery`, working: 'system', points: ARTILLERY_SYSTEM_COST[design.artillery], group: 'weapon' })
  if (design.counterBatteryRadar) lines.push({ label: `${design.counterBatteryRadar} counter-battery radar`, working: '', points: COUNTER_BATTERY_RADAR_COST[design.counterBatteryRadar], group: 'other' })
  if (design.transport.commandCentre) lines.push({ label: 'Command/control centre', working: 'in vehicle', points: COMMAND_CENTRE_VEHICLE_COST, group: 'other' })
  if (design.medicalPost) lines.push({ label: 'Mobile medical post', working: '', points: MEDICAL_POST_MOBILE_COST, group: 'other' })
  if (design.engineering.repair) lines.push({ label: 'Repair/recovery package', working: `${REPAIR_PACKAGE_PER_CLASS} × class ${design.size}`, points: REPAIR_PACKAGE_PER_CLASS * design.size, group: 'other' })
  if (design.engineering.bridgeClass !== null) lines.push({ label: `Bridge system, class ${design.engineering.bridgeClass}`, working: `${BRIDGE_PER_CLASS} × ${design.engineering.bridgeClass}`, points: BRIDGE_PER_CLASS * design.engineering.bridgeClass, group: 'other' })
  if (design.engineering.general) lines.push({ label: 'General engineering package', working: '', points: GENERAL_ENGINEERING_COST, group: 'other' })

  if (design.backupSystems) {
    const systems = lines.filter((l) => l.group === 'system').reduce((sum, l) => sum + l.points, 0)
    lines.push({ label: 'Backup systems', working: `${BACKUP_PERCENT}% of systems ${systems}`, points: percentOf(BACKUP_PERCENT, systems), group: 'other' })
  }

  const total = lines.reduce((sum, l) => sum + l.points, 0)
  return { lines, vsp, bvp, total }
}

/** Points of an infantry element (p. 53). */
export function priceInfantry(element: InfantryElement): number {
  const base = RIFLE_TEAM_COST[element.troops]
  let extra = 0
  switch (element.team) {
    case 'anti-armour':
      extra = GMS_LIGHT_COST[element.guidance ?? 'basic']
      break
    case 'apsw':
    case 'engineer':
    case 'air-defence':
    case 'observer':
      extra = SPECIALIST_EQUIPMENT_COST[element.team]
      break
    default:
      extra = 0
  }
  const points = base + extra
  return element.cavalry ? roundPoints(points * (1 + CAVALRY_PERCENT / 100)) : points
}

/** Dead-fall ordnance, bought per load beside the aircraft's own value (p. 52). */
export function ordnanceLoadsCost(loads: number): number {
  return DFO_LOAD_COST * loads
}
