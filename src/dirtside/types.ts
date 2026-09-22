/**
 * Dirtside II — the element as it is designed (Chapter 3) and priced
 * (Appendix, "Points Value System"). Rule references are to the printed
 * pages of the 1993 rulebook, digested in docs/rules/dirtside.md.
 *
 * The same rule the Full Thrust engine lives by: a design is a
 * *capability*, shared by every model of that type; what happens to one
 * vehicle on the table is state, kept elsewhere.
 */

/** Class 1 (very small) to 5 (very large); 6 and 7 are the "oversize" option (p. 8, p. 15). */
export type SizeClass = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type MobilityType =
  | 'low-wheeled'
  | 'high-wheeled'
  | 'slow-tracked'
  | 'fast-tracked'
  | 'slow-gev'
  | 'fast-gev'
  | 'grav'
  | 'boat'
  | 'hydrofoil'
  | 'air-cushion'
  | 'vtol'
  | 'aerospace'
  | 'combat-walker'
  | 'transport-walker'

/** Chemical-fuelled engine, hydromagnetic turbine, fusion generation plant (p. 10). */
export type PowerPlant = 'cfe' | 'hmt' | 'fgp'

/** Ablative and reactive armour cannot both be fitted (p. 10). */
export type ArmourSpecial = 'none' | 'ablative' | 'reactive'

export type WeaponType = 'rfac' | 'hvc' | 'hkp' | 'mdc' | 'hel' | 'dffg' | 'slam'
export type WeaponClass = 1 | 2 | 3 | 4 | 5
export type Mount = 'fixed' | 'turret'
export type SystemLevel = 'basic' | 'enhanced' | 'superior'
export type EcmLevel = 'none' | SystemLevel
export type ArtilleryClass = 'light' | 'medium' | 'heavy'

/** A direct-fire weapon; `barrels` above one makes it a multiple mount (p. 11, p. 32). */
export interface DirectFireWeapon {
  id: string
  type: WeaponType
  class: WeaponClass
  mount: Mount
  barrels: number
}

/** A guided missile system: GMS/L is class 1, GMS/H class 2 (p. 9). */
export interface MissileSystem {
  id: string
  size: 'light' | 'heavy'
  guidance: SystemLevel
}

export interface TransportFit {
  /** Line or militia infantry teams carried, 4 capacity each (p. 12). */
  lineTeams: number
  /** Powered infantry teams, 8 capacity each. */
  poweredTeams: number
  /** Cargo loads (artillery ammunition and the like), 4 each. */
  cargoLoads: number
  /** Size classes of smaller vehicles carried, 8 × size each. */
  vehicleSizes: number[]
  /** A command/communications centre, 8 capacity, 100 points in a vehicle. */
  commandCentre: boolean
}

export interface EngineeringFit {
  /** Repair/recovery package for an AEV: 75 × class (p. 53). */
  repair: boolean
  /** Bridge system: 50 × class of bridge, or null. */
  bridgeClass: number | null
  /** General engineering package (digging, demolitions, firefighting): 100. */
  general: boolean
}

export interface VehicleDesign {
  id: string
  name: string
  /** What the model is, in the designer's words: "Heavy GEV Tank". */
  role: string
  size: SizeClass
  mobility: MobilityType
  /**
   * For mobility types whose base movement depends on what the vehicle is
   * (p. 27): a VTOL is 'transport' (24) or 'attack' (30); a boat is
   * 'gunboat' (12), 'monitor' (8) or 'assault-boat' (15).
   */
  variant?: 'transport' | 'attack' | 'gunboat' | 'monitor' | 'assault-boat'
  amphibious: boolean
  power: PowerPlant
  /** Front armour, 0 to 7; sides, top and rear are one less (p. 10). */
  armour: number
  armourSpecial: ArmourSpecial
  weapons: DirectFireWeapon[]
  missiles: MissileSystem[]
  /** Fire control for the direct-fire weapons; null when there are none. */
  fireControl: SystemLevel | null
  ecm: EcmLevel
  pds: SystemLevel | null
  ads: SystemLevel | null
  /** Local air-defence weapons fitted. */
  lad: number
  /** APSWs beyond the one every military vehicle has free (p. 11). */
  extraApsw: number
  apfc: boolean
  /** Stealth levels; each takes one off the signature (p. 11). */
  stealth: number
  backupSystems: boolean
  artillery: ArtilleryClass | null
  counterBatteryRadar: SystemLevel | null
  transport: TransportFit
  /** Dead-fall ordnance loads an air vehicle can carry, 4 capacity each (p. 14). */
  ordnanceLoads: number
  engineering: EngineeringFit
  /** A mobile medical post aboard (150 points). */
  medicalPost: boolean
  notes?: string
}

/** The infantry element types (p. 13), priced on p. 53. */
export type InfantryTroops = 'militia' | 'line' | 'powered'
export type InfantryTeam =
  | 'rifle'
  | 'apsw'
  | 'assault'
  | 'observer'
  | 'anti-armour'
  | 'air-defence'
  | 'engineer'

export interface InfantryElement {
  troops: InfantryTroops
  team: InfantryTeam
  /** Guidance level of an anti-armour team's GMS/L (p. 53). */
  guidance?: SystemLevel
  /** Riding animals: +50% (p. 53). */
  cavalry?: boolean
}

/**
 * How a vehicle is sitting when it is shot at (p. 29): the one secondary die
 * it rolls beside its signature die. Only the highest applies.
 */
export type TargetPosture = 'none' | 'turret-down' | 'hull-down' | 'dug-in' | 'evading' | 'soft-cover' | 'pop-up'

/** Where an infantry element is when it is shot at (p. 33). */
export type InfantryPosition = 'open' | 'soft-cover' | 'dug-in' | 'urban'
