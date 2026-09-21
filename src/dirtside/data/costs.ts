/**
 * The points value system (pp. 52–53) as data. Percentages are of the
 * figure the page names: armour of VSP, everything else of BVP.
 */

import type { ArtilleryClass, EcmLevel, PowerPlant, SystemLevel } from '../types'

/** Vehicle size points: size class × 5, "the same as the CAPACITY points" (p. 52). */
export const VSP_PER_CLASS = 5
/** Each level of armour: 20% of VSP; ablative or reactive: 10% of VSP more per level. */
export const ARMOUR_PERCENT_PER_LEVEL = 20
export const SPECIAL_ARMOUR_PERCENT_PER_LEVEL = 10

export const POWER_PLANT_PERCENT: Record<PowerPlant, number> = { cfe: 20, hmt: 40, fgp: 60 }
/** Amphibious capability, on top of the mobility type. */
export const AMPHIBIOUS_PERCENT = 20

/** Fire control: multiplier of the largest direct-fire weapon's class. */
export const FIRE_CONTROL_PER_CLASS: Record<SystemLevel, number> = { basic: 2, enhanced: 4, superior: 6 }
export const GMS_LIGHT_COST: Record<SystemLevel, number> = { basic: 20, enhanced: 30, superior: 40 }
export const GMS_HEAVY_COST: Record<SystemLevel, number> = { basic: 30, enhanced: 45, superior: 60 }
export const ADS_COST: Record<SystemLevel, number> = { basic: 200, enhanced: 300, superior: 400 }
export const LAD_COST = 75
export const PDS_COST: Record<SystemLevel, number> = { basic: 30, enhanced: 45, superior: 60 }
export const ECM_COST: Record<EcmLevel, number> = { none: 0, basic: 15, enhanced: 30, superior: 45 }
/** APFC belt: 5 × size class. */
export const APFC_PER_CLASS = 5
/** Stealth: 20 × size class per level. */
export const STEALTH_PER_CLASS_PER_LEVEL = 20
export const EXTRA_APSW_COST = 4
export const ARTILLERY_SYSTEM_COST: Record<ArtilleryClass, number> = { light: 50, medium: 100, heavy: 200 }
/** Ammunition markers, per marker, × the guns in the battery (p. 52). */
export const ARTILLERY_AMMO_PER_GUN: Record<ArtilleryClass, number> = { light: 20, medium: 30, heavy: 40 }
export const SMOKE_AMMO_PER_GUN = 10
export const MINE_ROUND_COST = 100
export const BIOCHEM_ROUND_COST = 200
export const NUCLEAR_ROUND_COST = 1000
export const COUNTER_BATTERY_RADAR_COST: Record<SystemLevel, number> = { basic: 150, enhanced: 200, superior: 250 }
/** Dead-fall ordnance pods, HEF or MAK: per load. */
export const DFO_LOAD_COST = 30
/** Backup systems: +30% of the cost of fire control, ECM, stealth and guidance. */
export const BACKUP_PERCENT = 30
export const INTERFACE_LANDING_PERCENT = 25
export const DROP_TROOP_PERCENT = 50
export const COMMAND_CENTRE_VEHICLE_COST = 100
export const COMMAND_CENTRE_EMPLACED_COST = 75
export const MEDICAL_POST_STATIC_COST = 100
export const MEDICAL_POST_MOBILE_COST = 150
export const REPAIR_PACKAGE_PER_CLASS = 75
export const BRIDGE_PER_CLASS = 50
export const GENERAL_ENGINEERING_COST = 100
export const CASEVAC_COST = { wheeledOrTracked: 50, gevOrGrav: 75, vtol: 100 } as const
export const PRE_LAID_MINEFIELD_COST = { conventional: 80, jumping: 150 } as const
export const MINELAYER_LOAD_COST = 100
export const MINELAYER_SYSTEM_COST = 100

/** Infantry element costs (p. 53). */
export const RIFLE_TEAM_COST = { militia: 15, line: 20, powered: 40 } as const
export const SPECIALIST_EQUIPMENT_COST = { apsw: 10, engineer: 50, 'air-defence': 75, observer: 50 } as const
export const CAVALRY_PERCENT = 50
