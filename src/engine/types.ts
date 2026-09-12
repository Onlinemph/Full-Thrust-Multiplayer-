/**
 * Full Thrust: Project Continuum — core type definitions.
 *
 * Rule references in comments point at *Full Thrust: Project Continuum*
 * version 1.1.4, April 2017 (e.g. `4.11` = section 4, rule 11). A verbatim
 * text extract of the rulebook lives in `docs/rules/`.
 *
 * The ship schema below is designed to be authored as data. Everything a
 * player can read off a printed Ship System Status Display (SSD) has a home
 * here, so importing a fleet book should never require an engine change.
 */

// ---------------------------------------------------------------------------
// Geometry (2.1, 4.2)
// ---------------------------------------------------------------------------

/**
 * Course and facing run on a twelve-point clock face (3.1). Course 12 is
 * "up" the table, 3 is to the right, and so on. Headings are stored as this
 * clock number rather than degrees so orders round-trip exactly as written.
 */
export type Course = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/**
 * The six 60-degree fire arcs (4.2). `F` is the forward arc centred on the
 * ship's facing; the rest run clockwise. Broadside mountings are modelled as
 * the pair of arcs they cover, not as a seventh arc.
 */
export type Arc = 'F' | 'FS' | 'AS' | 'A' | 'AP' | 'FP'

/** Arcs in clockwise order, starting at the bow. Index is the arc's offset. */
export const ARC_ORDER: readonly Arc[] = ['F', 'FS', 'AS', 'A', 'AP', 'FP']

/** Position on the play surface, in Measurement Units (2.1). */
export interface Point {
  x: number
  y: number
}

/** A ship's position and the direction its bow points. */
export interface Placement {
  position: Point
  /** Clock-face facing (3.1). */
  facing: Course
}

// ---------------------------------------------------------------------------
// Hull and armour (2.4, 4.8, 7.6, 7.7)
// ---------------------------------------------------------------------------

/**
 * Hull integrity class (13.7). The fraction is of the ship's total mass, and
 * one hull box costs one mass, so a 100-mass Average hull is 30 boxes.
 */
export type HullClass = 'fragile' | 'weak' | 'average' | 'strong' | 'super'

export const HULL_FRACTION: Record<HullClass, number> = {
  fragile: 0.1,
  weak: 0.2,
  average: 0.3,
  strong: 0.4,
  super: 0.5,
}

/**
 * How many rows the hull track is split into (13.7). Fewer rows means fewer
 * threshold checks over the ship's life, and the points cost per box rises to
 * match: 3 rows costs 3 points a box, 6 rows costs 1.
 */
export type HullRows = 3 | 4 | 5 | 6

export const HULL_POINTS_PER_BOX: Record<HullRows, number> = {
  3: 3,
  4: 2,
  5: 1.5,
  6: 1,
}

/**
 * Armour (4.8, 7.6). `layers[0]` is the inner layer; further entries are
 * shell/layered armour (7.7), outermost last. Up to half the damage in a
 * volley may be taken on the outermost intact layer, then half of what remains
 * on the next, and so on (7.7).
 */
export interface ArmourDef {
  /** Boxes per layer, inner first. One box costs one mass. */
  layers: number[]
  /** Regenerative armour repairs itself between turns (7.8). */
  regenerative: boolean
}

// ---------------------------------------------------------------------------
// Screens (4.7, 7.2, 7.3, 7.16)
// ---------------------------------------------------------------------------

/**
 * Defensive screens (7.2). Level is capped at 2; generators beyond that are
 * backups that keep the level up as they are knocked out.
 */
export interface ScreenDef {
  level: 0 | 1 | 2
  /** Generators fitted, including backups beyond the screen level. */
  generators: number
  /** Advanced screens also blunt ordnance damage (7.3). */
  advanced: boolean
  /** Area screens protect nearby friendly ships (7.16). */
  area?: { advanced: boolean }
}

// ---------------------------------------------------------------------------
// Weapons (4.1, 5, 6)
// ---------------------------------------------------------------------------

/**
 * How a weapon's damage interacts with screens and armour (4.9).
 *
 * - `P` penetrating: sixes re-roll, and re-roll damage ignores screens and
 *   armour entirely.
 * - `AP` armour piercing: all damage bypasses armour.
 * - `SAP` semi-armour piercing: damage is halved against armour, or as the
 *   individual weapon states.
 * - `standard`: fully absorbed by screens and armour.
 */
export type DamageMode = 'standard' | 'P' | 'AP' | 'SAP'

/**
 * Every direct-fire and ordnance system the rulebook defines. The engine
 * dispatches firing behaviour on this, so adding a weapon means adding a case
 * here and a resolver — never touching the ship schema.
 */
export type WeaponClass =
  // Direct fire (5)
  | 'beam' // 5.3
  | 'emp' // 5.4 EMP projector / ion cannon
  | 'plasma-cannon' // 5.5
  | 'graser' // 5.6
  | 'heavy-graser' // 5.7
  | 'phaser' // 5.8
  | 'transporter' // 5.9
  | 'gatling' // 5.10
  | 'twin-particle-array' // 5.11
  | 'meson-projector' // 5.12
  | 'needle-beam' // 5.13
  | 'pulse-torpedo' // 5.14
  | 'submunition-pack' // 5.15
  | 'k-gun' // 5.16
  | 'mkp' // 5.17 multiple kinetic penetrators
  | 'boarding-torpedo' // 5.18
  | 'fusion-array' // 5.19
  | 'gravitic-gun' // 5.20
  | 'pulser' // 5.21
  // Spinal mounts (5.23, 7.23, 7.24)
  | 'spinal-beam'
  | 'spinal-plasma'
  | 'spinal-psp' // point singularity projector
  | 'nova-cannon'
  | 'wave-gun'
  // Ordnance (6)
  | 'heavy-missile' // 6.2
  | 'salvo-missile-rack' // 6.6
  | 'salvo-missile-launcher' // 6.6
  | 'antimatter-missile'
  | 'rocket-pod' // 6.7
  | 'plasma-bolt-launcher' // 6.8
  | 'mine-rack' // 6.9

/** Range/endurance variants a weapon may be built in (5.14, 5.16, 6.2). */
export type WeaponVariant = 'standard' | 'short' | 'long' | 'extended' | 'two-stage' | 'variable'

/**
 * One weapon system as fitted to a hull. `weaponClass` plus `weaponClassNumber`
 * (the "class-3" in a class-3 beam) and `arcs` are enough to price it off the
 * construction table and to resolve its fire.
 */
export interface WeaponDef {
  id: string
  /** Display label, e.g. "Class-3 Beam". */
  label: string
  weaponClass: WeaponClass
  /** The numeric class, where the weapon has one (a class-3 beam is 3). */
  rating: number
  variant: WeaponVariant
  arcs: Arc[]
  /** Broadside mountings fire into a fixed pair of arcs (4.2). */
  broadside?: boolean
  /** Mounted in a turret, which widens the arcs it can bear on (5.22). */
  turretId?: string
  /** Shots remaining, for one-shot and magazine-fed systems (6.6, 7.14). */
  ammo?: number
  /** Mass and points as built, taken from the construction table (14). */
  mass: number
  points: number
}

/**
 * A turret (5.22): a mounting that trades capacity for arc coverage. A 2-arc
 * turret holds 6 mass of weapons, a 6-arc turret only 2.
 */
export interface TurretDef {
  id: string
  arcs: Arc[]
  /** Mass of weapons the turret can carry. */
  capacity: number
  mass: number
  points: number
}

// ---------------------------------------------------------------------------
// Non-weapon systems
// ---------------------------------------------------------------------------

/**
 * Every system that occupies a box on the SSD and takes a threshold check
 * (4.11). Weapons are tracked separately because they also need arcs and
 * firing charts; everything else lives here.
 */
export type SystemKind =
  // Targeting (4.4, 5.2)
  | 'firecon'
  | 'advanced-firecon'
  // Point defence and area defence (7.10 – 7.15)
  | 'pds'
  | 'ads'
  | 'adfc'
  | 'advanced-adfc'
  | 'scattergun'
  | 'grapeshot'
  // Electronic warfare and stealth (7.4, 7.5, 7.17 – 7.19)
  | 'ecm'
  | 'area-ecm'
  /** 7.4 — a hull shaped and coated to be hard to see. No mass, 2 points. */
  | 'stealth-hull'
  | 'stealth-field'
  | 'holofield'
  // Cloaks (7.20 – 7.22)
  | 'cloaking-device'
  | 'cloaking-field'
  | 'tuffley-cloak'
  | 'reflex-field'
  // Sensors (12.1, 12.2, 13.13)
  | 'enhanced-sensors'
  | 'superior-sensors'
  | 'dummy-bogey'
  | 'weasel-emitter'
  // Carrier and small-craft plant (13.12)
  | 'hangar-bay'
  | 'launch-tube'
  | 'catapult'
  | 'fighter-rack'
  | 'gunboat-rack'
  /** 9.1: "Bays are 24 mass" — big enough to take a whole squadron back. */
  | 'gunboat-bay'
  | 'boat-bay'
  | 'tender'
  // Secondary systems (13.13)
  | 'cargo'
  | 'passenger-berthing'
  | 'troop-berthing'
  | 'minesweeper'
  | 'ortillery'
  | 'shipyard'
  | 'damage-control-party'
  | 'marine-party'
  | 'antimatter-charge'
  // Screens and drives appear on the SSD too, and take threshold checks
  | 'screen-generator'
  | 'ftl-drive'

export interface SystemDef {
  id: string
  kind: SystemKind
  label: string
  /** Arcs, for the systems that have them (ADS, transporters, ortillery). */
  arcs?: Arc[]
  /** The numeric rating, where one applies (ADS arcs, sensor grade). */
  rating?: number
  mass: number
  points: number
}

// ---------------------------------------------------------------------------
// Drives (3.2, 3.3, 13.9)
// ---------------------------------------------------------------------------

export interface DriveDef {
  /** Thrust rating: acceleration, deceleration and course change (3.2). */
  thrust: number
  /** Advanced drives turn up to their full rating, not half (3.3). */
  advanced: boolean
}

/** Atmospheric streamlining (13.11). */
export type Streamlining = 'none' | 'partial' | 'full'

/** FTL fit (11.1, 11.3). */
export type FtlKind = 'none' | 'standard' | 'advanced' | 'tug'

// ---------------------------------------------------------------------------
// Core systems (10.3)
// ---------------------------------------------------------------------------

/**
 * The optional Core Systems block (10.3): a bridge, life support and power
 * core that damage can single out, with effects that outlive the hit.
 */
export interface CoreSystemsDef {
  bridge: boolean
  lifeSupport: boolean
  powerCore: boolean
}

// ---------------------------------------------------------------------------
// The ship (2.4)
// ---------------------------------------------------------------------------

/** Broad hull groupings used for fleet composition and scenario rules (2.3). */
export type ShipGroup = 'escort' | 'cruiser' | 'capital' | 'station' | 'civilian' | 'monster'

export interface ShipDesign {
  id: string
  /** Class name, e.g. "Victoria-class Heavy Cruiser". */
  name: string
  faction: string
  group: ShipGroup
  /** Total mass the hull can carry (2.3). */
  mass: number

  hullClass: HullClass
  hullRows: HullRows
  /** Total hull boxes. Derived from mass and hull class, but stored so that
   *  hand-authored and imported designs round-trip exactly as printed. */
  hullBoxes: number

  drive: DriveDef
  ftl: FtlKind
  /**
   * 11.6: what a tug's drive can haul besides itself, in mass.
   *
   * *"Tugs need a FTL Drive equal to 10% of their mass just to provide their
   * own FTL capability, plus for every 1 additional FTL Drive mass they can
   * tow an additional 5 transfer mass."* Only an `ftl: 'tug'` design has one;
   * optional, so every design and every saved custom design parses unchanged.
   */
  ftlTransferMass?: number
  streamlining: Streamlining

  armour: ArmourDef
  screens: ScreenDef
  weapons: WeaponDef[]
  turrets: TurretDef[]
  systems: SystemDef[]
  coreSystems?: CoreSystemsDef

  /**
   * Fighter groups carried, by fighter-type id (8.15).
   *
   * `modifiers` are 8.15's "(+Mod)" options — Heavy, Fast, Long Range, FTL,
   * Robot, Light — which stack onto the type rather than replacing it. Held as
   * plain strings for the same reason `typeId` is: this file is the schema
   * every module reads and may not depend on `fighters.ts`.
   */
  fighterBays: Array<{ typeId: string; label: string; modifiers?: string[] }>
  /** Gunboat squadrons carried (9). */
  gunboats: Array<{ typeId: string; label: string; modifiers?: string[] }>

  /** Damage control parties (10.4) and marine boarding parties (12.7). */
  /**
   * Parties bought on top of the crew the hull already carries (13.13).
   *
   * NOT the ship's total: 10.4 gives a military hull one crew factor per 20
   * mass and one party per factor for free, and 13.13's *"Additional Damage
   * Control Parties"* are what 14.3 charges 5 points for. A ship "may not
   * mount more Damage Control Parties (and/or additional Marines) than the
   * number of crew it was initially designed with", so this is capped at the
   * base crew factor count.
   */
  additionalDamageControlParties: number
  marineParties: number

  /** Combat Points Value as built (18.3). */
  points: number
  /** Flawed design: +10% mass, −20% points, −1 DRM on threshold checks (13.13). */
  flawed?: boolean

  /** Set when stats are a reconstruction rather than printed canon. */
  provisional?: boolean
  notes?: string
  /** Counter art: a `data:` or `https:` URL drawn nose-up on the map. */
  art?: string
}

// ---------------------------------------------------------------------------
// Orders (3.5)
// ---------------------------------------------------------------------------

export type TurnDirection = 'port' | 'starboard'

/**
 * One turn's movement order, written before anything moves (3.5). The written
 * notation `8P2+4: 12` is (velocity 8) (turn 2 points to port) (accelerate 4)
 * (new velocity 12); every field below is one piece of that.
 */
export interface MovementOrder {
  /** Course change in clock points, and which way. Null is straight ahead. */
  turn: { direction: TurnDirection; points: number } | null
  /**
   * A second course change in the same turn, for ships with thrust to spare
   * (3.5 "double course change").
   */
  secondTurn?: { direction: TurnDirection; points: number } | null
  /** Thrust spent on velocity; negative decelerates (3.2). */
  accel: number
  /** Emergency thrust: up to 150% of the drive rating, at risk (3.6). */
  emergencyThrust?: boolean
  /**
   * Roll the ship 180° on its long axis (16.2): *"the player simply writes
   * 'Roll' in the movement orders for that turn"*. It costs one thrust factor,
   * charged against the turning allowance, and swaps which side the port and
   * starboard batteries bear to. The attitude itself is not part of the order
   * — it persists on the ship until it rolls back.
   */
  roll?: boolean
}

// ---------------------------------------------------------------------------
// Sequence of play (2.6)
// ---------------------------------------------------------------------------

/**
 * The fifteen phases of a game turn (2.6). Phase numbers are the rulebook's
 * own, so a log entry can be read against the book.
 */
export type Phase =
  | 'orders' // 1. Write orders
  | 'initiative' // 2. Roll for initiative
  | 'launch-missiles' // 3. Launch missiles
  | 'move-fighters' // 4. Move fighter groups
  | 'move-ships' // 5. Move ships
  | 'secondary-fighter-moves' // 6. Secondary fighter moves
  | 'allocate-attacks' // 7. Allocate missile and fighter attacks
  | 'fighter-vs-fighter' // 8. Fighters against fighters or missiles
  | 'point-defence' // 9. Point defence fire
  | 'ordnance-vs-ships' // 10. Missiles and fighters against ships
  | 'ship-fire' // 11. Ships fire
  | 'boarding' // 12. Boarding actions
  | 'threshold' // 13. Threshold checks
  | 'damage-control' // 14. Damage control
  | 'reactor-explosions' // 15. Roll for reactor explosions

export const PHASE_ORDER: readonly Phase[] = [
  'orders',
  'initiative',
  'launch-missiles',
  'move-fighters',
  'move-ships',
  'secondary-fighter-moves',
  'allocate-attacks',
  'fighter-vs-fighter',
  'point-defence',
  'ordnance-vs-ships',
  'ship-fire',
  'boarding',
  'threshold',
  'damage-control',
  'reactor-explosions',
]

export const PHASE_LABELS: Record<Phase, string> = {
  orders: 'Write orders',
  initiative: 'Initiative',
  'launch-missiles': 'Launch missiles',
  'move-fighters': 'Move fighters',
  'move-ships': 'Move ships',
  'secondary-fighter-moves': 'Secondary fighter moves',
  'allocate-attacks': 'Allocate attacks',
  'fighter-vs-fighter': 'Fighters and missiles',
  'point-defence': 'Point defence',
  'ordnance-vs-ships': 'Ordnance against ships',
  'ship-fire': 'Ships fire',
  boarding: 'Boarding actions',
  threshold: 'Threshold checks',
  'damage-control': 'Damage control',
  'reactor-explosions': 'Reactor explosions',
}

export interface SequencePosition {
  turn: number
  phase: Phase
}
