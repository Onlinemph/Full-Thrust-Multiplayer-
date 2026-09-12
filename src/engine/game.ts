/**
 * Full Thrust: Project Continuum — game state and the sequence of play (2.5, 2.6).
 *
 * This module owns the board: every ship, fighter group, missile marker and
 * piece of terrain in play, where the turn has got to, who has initiative, and
 * the battle log. Every other engine module mutates the state defined here.
 *
 * Two rules from elsewhere in the book decide what a phase is allowed to
 * spend, so they live here with the clock rather than with the guns:
 *
 *  - a weapon fires once a turn, so a beam spent on point defence in phase 9
 *    is not available in phase 11 (2.6);
 *  - a FireCon is spent *per phase*, so one used to launch missiles in phase 3
 *    is free again in phase 11 (5.2).
 *
 * The full written-out rules are in `docs/rules/sequence-of-play.md`.
 */

import { d6, Rng } from './dice'
import type { GateDef, GateState } from './ftl'
import { capturedShipDestroyed } from './boarding'
import {
  beginFighterTurn,
  type FighterGroup,
  type FighterGroupStatus,
  type FighterMission,
} from './fighters'
import { beginGunboatTurn, type GunboatSquadron } from './gunboats'
import { cloakEndOfTurn, cloakMode, createCloakState, type CloakKind, type CloakState } from './ew'
import {
  completeCastOff,
  completeDocking,
  movementPriority,
  UNDOCKED,
  UPRIGHT,
  type DockStatus,
  type RollStatus,
} from './specialmoves'
import type { BattleType, DeploymentZone } from './battles'
import { vectorStateFromCinematic, type VectorOrder, type VectorState } from './vectormovement'
import {
  PHASE_LABELS,
  PHASE_ORDER,
  type Arc,
  type Course,
  type MovementOrder,
  type Phase,
  type Placement,
  type Point,
  type SequencePosition,
  type ShipDesign,
} from './types'

// ---------------------------------------------------------------------------
// Sides
// ---------------------------------------------------------------------------

export type SideId = string

/**
 * One player's side (2.6). The rulebook is written for two opposed sides but
 * phase 2 explicitly allows more — "(If there are more than two players, the
 * winner decides the order for the others.)" — so sides carry a `team` to say
 * who is allied with whom. A side on its own team fights everybody.
 */
export interface SideState {
  id: SideId
  name: string
  team: string
}

// ---------------------------------------------------------------------------
// Ongoing effects (10.3)
// ---------------------------------------------------------------------------

/**
 * An effect that outlives the hit that caused it — a wrecked bridge, an EMP
 * shutdown (5.4), a power core running at half output (10.3).
 *
 * Section 10 is not in the text extract (see SOURCES.md), so this is a
 * container, not a rule: the module that inflicts the effect states its
 * duration and what it takes away, and `advancePhase` retires it when its turn
 * comes round. `expiresAfterTurn: null` means "for the rest of the battle".
 */
export interface OngoingEffect {
  id: string
  /** What caused it, for the log: 'bridge', 'life-support', 'emp', … */
  source: string
  appliedTurn: number
  expiresAfterTurn: number | null
  /** Thrust the ship may not use while this lasts (3.2). */
  thrustPenalty?: number
  /** FireCon knocked offline without being destroyed (4.4). */
  fireConOffline?: number
  /** Weapon ids that may not fire while this lasts. */
  weaponsOffline?: string[]
  note: string
}

// ---------------------------------------------------------------------------
// Per-ship battle state (2.4)
// ---------------------------------------------------------------------------

/** How a ship is using its FTL drive this turn (2.6 phases 1 and 5). */
export type FtlTransit = 'none' | 'entering' | 'exiting'

/**
 * A FireCon allocation (4.4, 5.2). No `fireConId`: 4.4 says "Individual
 * FireCon systems are not specifically linked to individual weapon systems",
 * so all that matters is how many targets the ship is engaging in this phase.
 * The `phase` is recorded because the allocation limit is per phase (5.2).
 */
export interface FireConAssignment {
  /** Ship id or fighter group id — 4.4 counts a fighter group as a target. */
  targetId: string
  phase: Phase
}

/** A damage control party working one system (10.4). */
export interface DamageControlAssignment {
  /** System or weapon id being repaired. */
  systemId: string
  /** Parties on the job; at most three may work one system (10.4). */
  parties: number
}

/** Enemy marines aboard a ship (5.9, 5.18, 12.7). */
export interface BoardingParty {
  side: SideId
  parties: number
  /**
   * The turn they landed. Phase 13 says "do not roll for enemy boarders that
   * 'landed' on the current turn", so the boarding module needs to know.
   */
  landedTurn: number
}

/** The Core Systems block (10.3), tracked as flags; effects live in `ongoing`. */
export interface CoreSystemsState {
  bridgeDestroyed: boolean
  lifeSupportDestroyed: boolean
  powerCoreDestroyed: boolean
  /** Set when a destroyed power core has still to be rolled for in phase 15. */
  reactorExplosionPending: boolean
}

/**
 * The mutable SSD (2.4): everything a player would mark on a dry-erase sheet.
 * The immutable printed design stays in `design`.
 */
export interface ShipState {
  id: string
  /** The individual ship's name; the class name is `design.name`. */
  name: string
  side: SideId
  design: ShipDesign
  /** Squadron membership (3.7); may only change in phase 1 (2.6). */
  squadronId: string | null

  // --- movement (3.1, 3.5) ------------------------------------------------
  /**
   * Position and facing. Under cinematic movement a ship always travels along
   * its facing, so this doubles as its course (3.1); vector movement (3.10),
   * which separates the two, is not implemented.
   */
  placement: Placement
  velocity: number
  /** This turn's written order (3.5), set in phase 1. */
  order: MovementOrder | null
  /**
   * COURSE, in degrees clockwise from up the table, when the battle is fought
   * under 12.12's vector system — the course-marker arrow that sits beside the
   * model. Null under cinematic movement, where *"the course and facing are
   * always identical"* (3.1) and `placement.facing` is both.
   *
   * It survives the per-turn reset, because it is a marker on the table rather
   * than an order: 12.12 says a ship *"ALWAYS starts by moving according to its
   * starting vector"*, and a course cleared each turn would stop the fleet dead.
   */
  courseDegrees: number | null
  /**
   * This turn's vector order sheet (12.12), in the order it was written.
   *
   * A separate field from `order` and not a union with it, because 12.12's
   * sheet is a *sequence* — *"Each effect is applied to the ship strictly IN
   * THE ORDER THEY ARE WRITTEN DOWN BY THE PLAYER … If the player writes TP2,
   * MD6 … If, on the other hand, the order is written MD6, TP2 … the result
   * will be VERY different"* — and `MovementOrder` holds one turn, one second
   * turn and an acceleration, which cannot express that at all.
   */
  vectorOrders: VectorOrder[] | null
  /** Thrust actually spent this turn — the optional aft-arc rule (4.2) and
   *  fighter scrambles (8.3) both ask whether the ship used any. */
  thrustUsed: number
  layingMines: boolean
  /**
   * Declared with the orders: this turn's deceleration is meant as a landing
   * (17.11), not as a mistake. Without it, dropping below orbital velocity is
   * 17.8's decaying orbit and the atmosphere takes what it likes.
   */
  landing: boolean
  ftlTransit: FtlTransit
  /**
   * The turn the FTL drive was first ordered to spin up (11.4), or null when
   * it is not. An exit takes two turns — warm up, then jump — and the phase
   * the ship is on is a function of how long ago it was declared, so the stamp
   * has to survive the per-turn reset that clears `ftlTransit`.
   */
  ftlWarmupTurn: number | null
  /** A ram declared in orders (16.7), resolved when this ship finishes moving. */
  ramTargetId: string | null
  /**
   * 17.9: *"a ship that has unused thrust points for changing course may use
   * them to change the gravity zone turn."* The magnitude the player wants,
   * written in orders; the legal range is clamped when the zone is resolved,
   * because it depends on the strength of the zone the ship actually reaches.
   */
  gravityTurn: number | null
  /**
   * 17.9: *"if the ship ends the Ship Movement Phase in a gravity zone, apply
   * the changes in velocity and course to the start of the next turn movement
   * instead."* Held here until that next move begins.
   */
  pendingGravity: { velocity: number; facing: Course } | null
  /**
   * Upside down, and when it turned over (16.2). *"An inverted ship may roll
   * back 'upright' in any subsequent turn, or may remain inverted as long as
   * the player wishes"* — so this is a standing condition and the per-turn
   * reset deliberately leaves it alone. What it changes is which side the
   * batteries bear to, and nothing else about the ship.
   */
  rollStatus: RollStatus
  /**
   * Where the ship is in 16.6's docking clock, and what it is docking with.
   *
   * A standing condition like the roll, not a per-turn order: an approach flown
   * on one turn earns docked status on the next, undocking costs *"one full
   * turn"*, and a docked ship writes no movement order of its own.
   */
  dock: DockStatus
  /**
   * The ship this one is trying to dock with, written in orders (16.6). Cleared
   * by the per-turn reset, like the ram it sits beside: an approach is flown
   * afresh every turn and a missed one is not a standing intention.
   */
  dockTargetId: string | null
  /** Asteroids, starbases and anything else on a fixed path (2.6 phase 5). */
  fixedPath: boolean
  /** Under a cloak this turn (7.20 – 7.22); 2.6 exempts it from the course
   *  and velocity question asked before orders are written. Derived from
   *  `cloak` and kept in step with it, because the map, the last-known table
   *  and the AI all want the one-bit answer. */
  cloaked: boolean
  /**
   * The cloak's own state machine (7.20 – 7.22), or null on a ship with no
   * cloak fitted. It is `ew.ts`'s value type rather than a few booleans here
   * because the transitions are the rule: a Field goes up at the *start* of
   * the movement phase and a Device at the end, a Device over 24 MU voids
   * itself, and a cloak killed by a threshold check keeps the ship hidden
   * until the end of the turn it died in.
   */
  cloak: CloakState | null
  /**
   * A Reflex Field switched on for this turn (7.25). Written in orders and
   * secret until the ship is fired on — "The opposing player is not told of
   * the field's status until the ship is fired upon, by which time it may be
   * too late" — and it costs the ship its own weapons for the turn.
   */
  reflexFieldActive: boolean
  /**
   * Course and velocity as at the end of a previous phase 5 (2.6).
   *
   * `course` is the clock point a cinematic ship both faces and travels on;
   * `courseDegrees` is the vector answer, present only under 12.12, because
   * there the honest answer to the question 2.6 lets an opponent ask is not a
   * clock point at all.
   */
  lastKnown: {
    course: Course
    courseDegrees?: number
    velocity: number
    turn: number
    cloaked: boolean
  } | null

  // --- damage (2.4, 4.8, 4.11) -------------------------------------------
  /** Hull boxes crossed off, from the top left (2.4). */
  hullMarked: number
  /** Armour boxes crossed off, inner layer first, parallel to `design.armour.layers`. */
  armourMarked: number[]
  /** Row lengths of the hull track, if the SSD does not split them evenly. */
  hullRowSizes: number[] | null
  /** System and weapon ids crossed off by threshold checks (4.11). */
  destroyedSystems: Set<string>
  /**
   * 5.13: *"Systems destroyed by Needle Beam fire cannot be repaired by Damage
   * Control Parties."* A subset of `destroyedSystems`, kept apart because
   * `repairSystem` already takes an `unrepairable` set and had nothing to put
   * in it.
   */
  unrepairable: Set<string>
  /** Threshold hits on the main drive: 1 halves thrust, 2 disables it (4.11). */
  driveHits: number
  /** Hull rows crossed but not yet checked — drained in phase 13 (2.6, 4.11). */
  pendingThresholdRows: number
  /** Hull rows already checked, so the next check knows which row it is for. */
  hullRowsChecked: number
  destroyed: boolean
  /**
   * Overkill on the blow that destroyed this ship (17.5): *"the amount of
   * excess damage inflicted (over that required to reduce the ship to zero
   * points)"*. Recorded by `markHullBoxes`, which is the sole writer of hull
   * damage and therefore the only place that knows both numbers; null on a
   * ship that is still alive, and on one brought to exactly zero, which 17.5
   * cannot explode.
   */
  excessDamage: number | null
  /** Left the table (3.9) — off the board but not dead. */
  offTable: boolean
  /**
   * The edge it went out by (3.9): *"ships will always re-enter play from the
   * same side of the playing area as they left."* Also 16.5's second condition,
   * which is that a disengaging fleet must all leave by the *same* edge.
   */
  exitEdge: 'top' | 'bottom' | 'left' | 'right' | null
  /**
   * The first turn it may come back on, under 3.9's optional re-entry rule.
   * Null when it is gone for good, and null when the rule is not in play.
   */
  reentryTurn: number | null
  /**
   * What 17.7 asks a player to write down when a ship leaves the table to go
   * round the planet: *"record the ship velocity, course, and distance from the
   * nearest table corner at the point of exit."*
   *
   * Null on a ship that left under 3.9 instead, and on every ship that has not
   * left at all.
   */
  departure: {
    turn: number
    velocity: number
    course: Course
    /** Distance from `corner` at the moment of exit. */
    cornerDistance: number
    corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  } | null
  /**
   * 11.5: still in hyperspace, due to drop out at the point and heading
   * written here. `offTable` is true while it is; the ship is not on the table
   * and has no station until it arrives.
   *
   * Null for every ship that started the battle on the table, which is nearly
   * all of them.
   */
  ftlArrival: { entryPoint: Point; course: Course; velocity: number } | null
  /**
   * 11.6, 11.7: the hull carrying this one — a tug, a tender, or a Mothership
   * with a battlerider attached.
   *
   * A carried hull is on the table and can be seen, but it does not fly, it
   * cannot be fired at, and it goes wherever the carrier goes. Null for
   * everything that flies itself, which is nearly everything.
   */
  carriedBy: string | null
  /**
   * 11.9: the gate this hull is waiting behind, if it is coming onto the
   * table through one rather than starting on it or dropping out of
   * hyperspace. `offTable` is true until it comes through.
   */
  awaitingGate: string | null
  /**
   * 11.7: the hull in an attached group that damage is being put on, at the
   * defending player's choice — *"Damage received can be applied to either the
   * Mothership or battleriders at the choice of the defending player."*
   *
   * A direct reference rather than an id because `markHullBoxes` is the one
   * place every damage path in the game passes through, and it does not have
   * the game to look an id up in. Set by `nominate-damage-sink`, cleared when
   * the rider detaches, dies, or the Mothership does.
   *
   * **[reading]** The nomination stands until the defender changes it, rather
   * than being made afresh for each hit. 11.7 gives the choice to the defender
   * without saying when it is made, and a per-hit prompt would stop the fire
   * phase dead between every shot. A player who wants to spread damage moves
   * the nomination, which is one action rather than one per hit.
   */
  damageSink: ShipState | null
  /**
   * 11.7: the turn this hull made an FTL entry, if it has — *"If the Mothership
   * makes an FTL entry, the battleriders cannot detach and move independently
   * until the next turn."*
   */
  ftlEntryTurn: number | null
  /**
   * 17.8's orbit: the body being orbited and the clock marker the ship sits on.
   *
   * A ship in orbit is not flying: *"the ship does not have to have any course
   * change orders written for it. The player simply notes that it is in orbit
   * and moves the ship by a number of points equal to the orbit speed."* Null
   * for every ship that is not on a track, which is almost all of them.
   */
  orbit: { featureId: string; marker: Course } | null
  /**
   * Down on the surface (17.11), by a landing or a crash. Out of the battle
   * like `offTable` is, and for the same reason: still a hull, no longer in it.
   */
  landed: 'landed' | 'crash-landed' | null

  // --- what this turn has spent (2.6, 5.2) --------------------------------
  /** Weapon id → the phase it fired in. Cleared at the start of each turn. */
  /**
   * Shots left on each one-shot or magazine-fed mount, by weapon id (6.6).
   *
   * Absent means the mount has not fired yet; `shotsLeft` falls back to what
   * the design was built with. A Map rather than a design field because a
   * design is shared by every hull of the class.
   */
  ammo: Map<string, number>
  /**
   * 5.22: *"During the Write Orders Phase the facing of each turret must be
   * recorded."* Turret id to the one arc it will fire into this turn; a turret
   * with no entry is free to take any arc it covers.
   *
   * A knocked-out turret *"remains stuck in its current facing until
   * repaired"*, which is why this survives the turn rather than being cleared
   * with the orders: the last facing written is the facing it is stuck in.
   */
  turretFacings: Map<string, Arc>
  weaponsFired: Map<string, Phase>
  /**
   * The turn a weapon last fired, kept across turns.
   *
   * `weaponsFired` is cleared at the top of each turn, which is right for the
   * once-a-turn rule and useless for 6.8's *"a PBL may only fire every other
   * turn"*. This is the reload clock, and nothing clears it.
   */
  weaponLastFiredTurn: Map<string, number>
  /** Phase 11: a ship gets one firing activation per turn. */
  hasFiredThisTurn: boolean
  /** Cleared at every phase boundary, because FireCon limits are per phase (5.2). */
  fireconAssignments: FireConAssignment[]
  /**
   * 17.2 rule 2: whether the dust let this ship get a lock on that target.
   *
   * *"Roll a D6 after nominating the target"* — one die per nomination, not one
   * per weapon, so a ship with six mounts does not get six chances at the same
   * hull through the same cloud. Cleared at every phase boundary beside the
   * FireCons and for the same reason: point defence in phase 9, ordnance in 10
   * and ship fire in 11 are three separate nominations.
   */
  cloudLocks: Map<string, boolean>
  /** Phase 14 assignments (10.4). */
  damageControl: DamageControlAssignment[]

  core: CoreSystemsState
  ongoing: OngoingEffect[]
  boarders: BoardingParty[]
  /**
   * Marines still alive aboard (13.13, 12.7). Starts at the design's count and
   * falls as they are spent repelling boarders, which is why it is state and
   * not read off the SSD.
   */
  marinesAboard: number
  /**
   * Carried by a boarding action (12.7): *"it is considered captured"*. An
   * intact hull under someone else's flag, which is not the same as a
   * destroyed one — 18.3 scores it differently and it can be sailed away.
   */
  captured: boolean
  /**
   * Whose prize it is (12.7). Null until a boarding action carries the hull.
   *
   * The side matters as much as the flag: a captured ship is out of its own
   * fleet's order of battle and counts against its morale (12.8), and 12.7's
   * *"a single point of damage is sufficient to destroy the captured ship"*
   * needs to know who would be denying whom.
   */
  capturedBy: SideId | null
  /**
   * Whether any of this turn's hull damage came from something other than
   * boarding combat.
   *
   * 12.7: *"Marines and Boarding Parties cannot be killed in a threshold test
   * caused by boarding combat. Both Marines and Boarding Parties are
   * vulnerable to being killed in threshold tests caused by weapons fire."*
   * A ship can take both in one turn, so the flag records whether anything
   * but the boarders put a row in — cleared with the rest of the turn.
   */
  hullHitByWeapons: boolean
}

export interface ShipStateOptions {
  id: string
  side: SideId
  design: ShipDesign
  placement: Placement
  name?: string
  velocity?: number
  squadronId?: string | null
  fixedPath?: boolean
  /** Override the derived hull row lengths for a hand-entered SSD (2.4). */
  hullRowSizes?: number[]
}

/**
 * The cloak an SSD carries, if any (7.20 – 7.22).
 *
 * A ship may only have one — 7.20 forbids a cloak *"combined with any fields
 * or screens"* — so the first one found is the one it flies with, and
 * `validateEwFit` is where a design carrying two is reported.
 */
const CLOAK_KINDS: readonly CloakKind[] = ['cloaking-device', 'cloaking-field', 'tuffley-cloak']

function cloakFitOf(design: ShipDesign): CloakState | null {
  const fitted = design.systems.find((system) =>
    (CLOAK_KINDS as readonly string[]).includes(system.kind),
  )
  return fitted ? createCloakState(fitted.kind as CloakKind) : null
}

/** Put a design on the table as an undamaged ship (2.4). */
export function createShipState(opts: ShipStateOptions): ShipState {
  return {
    id: opts.id,
    name: opts.name ?? opts.design.name,
    side: opts.side,
    design: opts.design,
    squadronId: opts.squadronId ?? null,
    placement: { position: { ...opts.placement.position }, facing: opts.placement.facing },
    velocity: opts.velocity ?? 0,
    order: null,
    courseDegrees: null,
    vectorOrders: null,
    thrustUsed: 0,
    layingMines: false,
    landing: false,
    ftlTransit: 'none',
    ftlWarmupTurn: null,
    ramTargetId: null,
    gravityTurn: null,
    pendingGravity: null,
    rollStatus: { ...UPRIGHT },
    dock: { ...UNDOCKED },
    dockTargetId: null,
    fixedPath: opts.fixedPath ?? false,
    cloaked: false,
    cloak: cloakFitOf(opts.design),
    reflexFieldActive: false,
    lastKnown: null,
    hullMarked: 0,
    armourMarked: opts.design.armour.layers.map(() => 0),
    hullRowSizes: opts.hullRowSizes ?? null,
    destroyedSystems: new Set<string>(),
    unrepairable: new Set<string>(),
    driveHits: 0,
    pendingThresholdRows: 0,
    hullRowsChecked: 0,
    destroyed: false,
    excessDamage: null,
    offTable: false,
    exitEdge: null,
    reentryTurn: null,
    departure: null,
    orbit: null,
    landed: null,
    ftlArrival: null,
    carriedBy: null,
    awaitingGate: null,
    damageSink: null,
    ftlEntryTurn: null,
    ammo: new Map<string, number>(),
    turretFacings: new Map<string, Arc>(),
    weaponsFired: new Map<string, Phase>(),
    weaponLastFiredTurn: new Map<string, number>(),
    hasFiredThisTurn: false,
    fireconAssignments: [],
    cloudLocks: new Map<string, boolean>(),
    damageControl: [],
    core: {
      bridgeDestroyed: false,
      lifeSupportDestroyed: false,
      powerCoreDestroyed: false,
      reactorExplosionPending: false,
    },
    ongoing: [],
    boarders: [],
    marinesAboard: opts.design.marineParties,
    captured: false,
    capturedBy: null,
    hullHitByWeapons: false,
  }
}

// ---------------------------------------------------------------------------
// Fighter groups, ordnance markers and terrain
// ---------------------------------------------------------------------------

/** Where a fighter or gunboat group is in its life cycle (8.2, 8.13). */
export type FighterStatus = FighterGroupStatus

/** A group's standing orders for the turn (8.6). */
export type FighterRole = FighterMission

/**
 * A fighter or gunboat group in play (8, 9).
 *
 * The group is the unit of alternation in phases 4 and 6 (2.6), which is why
 * `GameState` knows about it at all; how it fights is `fighters.ts`'s business.
 * The state carried here is `fighters.ts`'s own `FighterGroup` rather than a
 * copy of it, because a copy would have to be converted at every call and
 * every conversion is a chance for a group's fuel or its dogfight to be
 * quietly dropped on the way through.
 *
 * What is added is what only a table needs: a name, whether the squadron is
 * gunboats (9.1), the landing stamp that completes the tube-capacity sum, and
 * what the group has declared an attack on.
 */
export interface FighterGroupState extends FighterGroup {
  /** What it attacked last turn, which is what 8.6 lets it pursue. */
  lastTargetId?: string | null
  side: SideId
  label: string
  /**
   * Turn the group last landed. Launching and recovering draw on the same pool
   * of tubes (8.1), so both stamps have to be readable to know how much of a
   * carrier's capacity this turn has gone.
   */
  recoveredTurn: number | null
  /** What it has declared an attack on this turn (8.7), for the map. */
  targetId: string | null
}

/**
 * A gunboat squadron in play (9).
 *
 * Its own list rather than a fighter group with a flag, because every number
 * in section 9 differs from section 8's — 18 MU instead of 24, 12 MU of fire
 * control instead of 6 — and the two defensive rules invert: anti-ship fire is
 * better against a gunboat and point defence is worse. A shared type would be
 * a type with two of everything.
 */
export interface GunboatSquadronState extends GunboatSquadron {
  side: SideId
}

/** Ordnance marker families that sit on the table between phases (6). */
export type OrdnanceKind = 'salvo' | 'heavy' | 'antimatter' | 'plasma-bolt' | 'rocket' | 'mine'

/**
 * A missile or other ordnance marker (6.3). Placed at its point of aim in
 * phase 3, left in place while ships move, then moved next to its target in
 * phase 7 — so the marker outlives the phase that made it and belongs to the
 * game state rather than to a weapon resolver.
 */
export interface OrdnanceMarkerState {
  id: string
  side: SideId
  sourceShipId: string
  kind: OrdnanceKind
  /** Standard or extended range (6.2). */
  grade: 'standard' | 'extended'
  /** Missiles left in the salvo; a full salvo is six (6.2). */
  missiles: number
  position: Point
  launchedTurn: number
  /** Stages left, for the optional multi-stage missile (6.6). */
  stagesRemaining: number
  /** Set in phase 7 once the marker has found something to attack (6.3). */
  targetShipId: string | null
}

export type TerrainKind =
  | 'planet'
  | 'planetoid'
  | 'asteroid-field'
  | 'dust-cloud'
  | 'nebula'
  | 'debris'
  | 'minefield'
  | 'solar-flare'

/**
 * A piece of terrain (17). Section 17 is not in the text extract, so this
 * carries only what the sequence of play needs — something to place on the
 * table and, when `fixedPath` ships move first in phase 5, something to move.
 * No terrain effect is applied anywhere in the engine.
 */
export interface TerrainFeature {
  id: string
  kind: TerrainKind
  position: Point
  /** Radius in MU (2.1). */
  radius: number
  label?: string
  /**
   * 17.9's gravity zones, on a body that has them: *"a planet is surrounded by
   * three concentric gravity zones, each extending the radius by at least 1 MU
   * … treat a sun as a large planet with an extra inner zone of strength 8."*
   *
   * Optional, and it has to be: a `TerrainFeature` rides inside a saved custom
   * scenario, so a battle file written before this existed must still parse.
   * Absent means a body with no well, which is every rock the game has shipped.
   */
  gravity?: { sun?: boolean; zoneWidth?: number }
  /**
   * 17.3's star, on a `solar-flare` feature: the die score at or above which it
   * flares this turn.
   *
   * 17.3 says only *"perhaps diced for each turn"* and names no frequency, no
   * target and no area, so the number is the table's to set rather than the
   * engine's to invent; absent means 6, one turn in six. `radius` is the area
   * caught, and a radius that covers the table is 17.3's *"the entire table"*.
   */
  flare?: { onRoll?: number }
  /**
   * 17.8's orbit track, on a body big enough to have one: *"The edge of the
   * planet is the orbit track and should be marked with 12 clock face points.
   * The orbit track has an entry velocity and an orbital speed in clock faces
   * per turn."*
   *
   * `radius` is the track. `velocity` is the one number 17.8 calls both the
   * entry velocity and the orbital velocity (reading 12); `speed` is clock
   * points per turn, negative for anticlockwise. `gravityG` is what 17.11 asks
   * a partially streamlined hull to out-push on the way down, and `landable`
   * is 17.8's *"Decide whether the planet can be landed on or that contact
   * with the planet will be a fatal collision."*
   */
  orbit?: { velocity: number; speed: number; gravityG?: number; landable?: boolean }
  /**
   * 17.10's *"super simple and totally unrealistic way"*, on a body that uses
   * it instead of a track: pass within 2 to 3 MU at velocity 6 to 8 and the
   * ship is in orbit, closer and it crashes, wider and it flies past.
   *
   * Mutually exclusive with `orbit` in practice — they are two of the three
   * systems 17.7 offers and it says to *"pick the one that best suits your
   * scale or scenario"* — and the track wins if a body somehow has both.
   */
  simpleOrbit?: boolean
}

// ---------------------------------------------------------------------------
// Battle log (2.6 "Information")
// ---------------------------------------------------------------------------

/** Broad classification of a log line, for filtering and icons. */
export type LogKind =
  | 'phase'
  | 'initiative'
  | 'orders'
  | 'launch'
  | 'move'
  | 'fire'
  | 'point-defence'
  | 'damage'
  | 'threshold'
  | 'damage-control'
  | 'boarding'
  | 'destroyed'
  | 'note'

/**
 * One line of the battle log.
 *
 * 2.6 says most games are played "open book", so entries default to being
 * visible to everyone; the exceptions are the genuinely secret ones — written
 * orders, and anything hidden by the optional sensors rules (12) — which name
 * the sides that may read them.
 */
export interface LogEntry {
  seq: number
  turn: number
  phase: Phase
  kind: LogKind
  text: string
  visibleTo: 'all' | SideId[]
  side?: SideId
  shipId?: string
  targetId?: string
  dice?: number[]
}

/** The caller-supplied half of a log entry; the clock fields are filled in. */
export interface LogInput {
  text: string
  kind?: LogKind
  visibleTo?: 'all' | SideId[]
  side?: SideId
  shipId?: string
  targetId?: string
  dice?: number[]
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export interface InitiativeRoll {
  side: SideId
  roll: number
}

/**
 * This turn's initiative (2.6 phase 2). `rounds[0]` is the opening roll; any
 * further rounds are tie-breaks among the tied leaders.
 */
export interface InitiativeState {
  turn: number
  rounds: InitiativeRoll[][]
  winner: SideId
  /** Activation order, winner first. Phases that go loser-first reverse it. */
  order: SideId[]
}

/**
 * The deployment step, before the first order is written (18.1).
 *
 * Section 18 sits outside the turn sequence — *"players alternate in placing
 * one ship at a time"* happens before phase 1 exists — so it cannot be a
 * `Phase` and it is not per-ship state. It is one field on the battle, written
 * once by `startScenario` and null for every scenario that does not ask for a
 * deployment, which is all three of the ones shipped before it existed.
 *
 * The zones are rectangles of `GameState.table`, which is where the playing
 * area lives now that three separate rules need to measure against its edges.
 */
export interface DeploymentState {
  battleType: BattleType
  /** One zone per side, by side id. */
  zones: Record<SideId, DeploymentZone>
  /** Ships placed per step (18.1: one, "or two to four for large battles"). */
  batch: number
  /** Sides in the order they place, lowest die first (4.12). Empty until rolled. */
  order: SideId[]
  /** Ship ids placed so far, in the order they were placed. */
  placed: string[]
  /** 18.1: the defender in an offensive/defensive battle places one feature. */
  terrainPlaced: boolean
}

/**
 * A gate on the table (11.9, 11.10).
 *
 * `def` is the gate as built and `state` is what the battle has done to it;
 * both are the pure module's own types, so every rule about gates is answered
 * by `ftl.ts` and this is only where the answer is kept.
 */
export interface TableGate {
  def: GateDef
  state: GateState
  /**
   * *"If the gate is under control of the player … activation is automatic"*
   * (11.9). Control is a fact about the battle, not about the gate, so it is
   * held here and folded into `GateDef.playerControlled` per activating side.
   */
  controllingSide: SideId | null
  /** The side that wrote a "Gate Activate" order, and the turn it wrote it. */
  activationOrderedBy: SideId | null
  activationOrderTurn: number | null
  /**
   * The far end of a Portal, when both ends are on the table (11.9). Jump
   * Gates are never paired: *"The two Jump Gates are not linked."*
   */
  pairedGateId?: string
}

export interface GameState {
  /** Scenario or battle identifier, for the journal. */
  scenario: string
  /**
   * The playing area, in MU (2.1).
   *
   * The table is a property of the scenario rather than of the rules, which is
   * why the engine went without one for so long — but three rules need edges
   * to measure from: 3.9's ships leaving the table, 16.4's moving table and
   * 18.1's deployment zones. It defaults to the 72 × 48 of a 6' × 4' board.
   */
  table: { width: number; height: number }
  seed: number
  /** The only source of randomness in the engine (1.7). */
  rng: Rng
  turn: number
  phase: Phase
  /** Phases actually played; INTRODUCTORY_PHASES for the intro scenario (2.6). */
  phases: readonly Phase[]
  sides: SideState[]
  ships: ShipState[]
  fighterGroups: FighterGroupState[]
  gunboatSquadrons: GunboatSquadronState[]
  ordnance: OrdnanceMarkerState[]
  terrain: TerrainFeature[]
  /** 11.9's Jump Gates and Portals, and 11.10's natural jump points. */
  gates: TableGate[]
  initiative: InitiativeState | null
  /** 18.1's deployment, or null for a scenario that writes its own positions. */
  deployment: DeploymentState | null
  log: LogEntry[]
}

export interface GameOptions {
  seed: number
  sides: Array<{ id: SideId; name?: string; team?: string }>
  ships?: ShipState[]
  fighterGroups?: FighterGroupState[]
  gunboatSquadrons?: GunboatSquadronState[]
  ordnance?: OrdnanceMarkerState[]
  terrain?: TerrainFeature[]
  gates?: TableGate[]
  phases?: readonly Phase[]
  scenario?: string
  table?: { width: number; height: number }
  deployment?: DeploymentState | null
}

/**
 * The five phases the introductory scenario needs (2.6): "For the Introductory
 * Scenario you will need only phases 1, 2, 5, 11, and 13."
 */
export const INTRODUCTORY_PHASES: readonly Phase[] = [
  'orders',
  'initiative',
  'move-ships',
  'ship-fire',
  'threshold',
]

/** A 6' × 4' board in MU (2.1), which is what a scenario means by "the table". */
export const DEFAULT_TABLE = { width: 72, height: 48 } as const

/** The playing area as `movement.isOffTable` measures it (3.9). */
export function tableBounds(state: GameState): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  return { minX: 0, minY: 0, maxX: state.table.width, maxY: state.table.height }
}

/** Start a battle at turn 1, phase 1 (2.6). */
export function createGame(opts: GameOptions): GameState {
  const state: GameState = {
    scenario: opts.scenario ?? 'battle',
    table: { ...(opts.table ?? DEFAULT_TABLE) },
    seed: opts.seed,
    rng: new Rng(opts.seed),
    turn: 1,
    phase: (opts.phases ?? PHASE_ORDER)[0],
    phases: opts.phases ?? PHASE_ORDER,
    sides: opts.sides.map((side) => ({
      id: side.id,
      name: side.name ?? side.id,
      // A side with no stated team fights on its own (2.6 phase 2 allows more
      // than two players; the book never assumes more than two teams).
      team: side.team ?? side.id,
    })),
    ships: opts.ships ?? [],
    fighterGroups: opts.fighterGroups ?? [],
    gunboatSquadrons: opts.gunboatSquadrons ?? [],
    ordnance: opts.ordnance ?? [],
    terrain: opts.terrain ?? [],
    gates: opts.gates ?? [],
    initiative: null,
    deployment: opts.deployment ?? null,
    log: [],
  }
  pushLog(state, { kind: 'phase', text: `Turn 1 — ${PHASE_LABELS[state.phase]}` })
  return state
}

// ---------------------------------------------------------------------------
// Log helpers
// ---------------------------------------------------------------------------

/** Append one line to the battle log, stamped with the current turn and phase. */
export function pushLog(state: GameState, input: LogInput): LogEntry {
  const entry: LogEntry = {
    seq: state.log.length + 1,
    turn: state.turn,
    phase: state.phase,
    kind: input.kind ?? 'note',
    text: input.text,
    visibleTo: input.visibleTo ?? 'all',
    side: input.side,
    shipId: input.shipId,
    targetId: input.targetId,
    dice: input.dice,
  }
  state.log.push(entry)
  return entry
}

/** The log as one side may read it (2.6: open book, minus the secrets). */
export function logFor(state: GameState, side: SideId): LogEntry[] {
  return state.log.filter((e) => e.visibleTo === 'all' || e.visibleTo.includes(side))
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function shipById(state: GameState, id: string): ShipState | undefined {
  return state.ships.find((ship) => ship.id === id)
}

export function fighterGroupById(state: GameState, id: string): FighterGroupState | undefined {
  return state.fighterGroups.find((group) => group.id === id)
}

export function sideById(state: GameState, id: SideId): SideState | undefined {
  return state.sides.find((side) => side.id === id)
}

/** Every side in the battle, in declaration order. */
export function sides(state: GameState): SideState[] {
  return state.sides
}

/**
 * Ships still in play (2.4): a ship with every hull box crossed out is
 * "removed from play", and one that has left the table (3.9) is out too.
 */
export function activeShips(state: GameState, side?: SideId): ShipState[] {
  return state.ships.filter(
    (ship) => !ship.destroyed && !ship.offTable && (side === undefined || ship.side === side),
  )
}

/**
 * Fighter groups actually on the table (8.2).
 *
 * Fighter groups only: 9.1's gunboat squadrons are a separate list on the
 * state and a separate type, and they fly and are shot at by different rules.
 * The name and the old doc line both said "and gunboat groups", which was
 * never what the body did.
 */
export function activeFighterGroups(state: GameState, side?: SideId): FighterGroupState[] {
  return state.fighterGroups.filter(
    (group) =>
      group.status === 'in-flight' &&
      group.strength > 0 &&
      (side === undefined || group.side === side),
  )
}

/** Whether two sides are on opposite sides of the battle. */
export function areEnemies(state: GameState, a: SideId, b: SideId): boolean {
  const left = sideById(state, a)
  const right = sideById(state, b)
  if (!left || !right) return a !== b
  return left.team !== right.team
}

/** Every enemy ship still in play, seen from a side or from one of its ships. */
export function enemiesOf(state: GameState, who: SideId | ShipState): ShipState[] {
  const side = typeof who === 'string' ? who : who.side
  return activeShips(state).filter((ship) => areEnemies(state, ship.side, side))
}

// ---------------------------------------------------------------------------
// Initiative (2.6 phase 2)
// ---------------------------------------------------------------------------

/** Safety valve: a run of identical rolls cannot spin the loop for ever. */
const MAX_INITIATIVE_ROUNDS = 32

/**
 * Roll initiative for the turn (2.6 phase 2): "Players roll a D6 each; highest
 * roll has initiative for this turn."
 *
 * The book does not say what a tie does. The reading taken here is the one used
 * at the table: the tied leaders roll again *among themselves* until one is
 * highest, which settles the winner without disturbing the ranking of the
 * players who were never in contention.
 *
 * With more than two players "the winner decides the order for the others", so
 * the order returned is only a default — highest opening roll first, ties
 * broken by seating order — and `setInitiativeOrder` lets the winner rearrange
 * everyone behind them.
 */
export function rollInitiative(state: GameState): InitiativeState {
  const rounds: InitiativeRoll[][] = []
  let contenders = state.sides.map((side) => side.id)

  while (contenders.length > 1 && rounds.length < MAX_INITIATIVE_ROUNDS) {
    const round: InitiativeRoll[] = contenders.map((side) => ({ side, roll: d6(state.rng) }))
    rounds.push(round)
    const best = Math.max(...round.map((r) => r.roll))
    contenders = round.filter((r) => r.roll === best).map((r) => r.side)
  }
  if (rounds.length === 0) rounds.push(contenders.map((side) => ({ side, roll: d6(state.rng) })))

  const winner = contenders[0]
  const opening = rounds[0]
  const others = opening
    .filter((r) => r.side !== winner)
    .map((r, index) => ({ ...r, index }))
    .sort((a, b) => b.roll - a.roll || a.index - b.index)
    .map((r) => r.side)

  const initiative: InitiativeState = {
    turn: state.turn,
    rounds,
    winner,
    order: [winner, ...others],
  }
  state.initiative = initiative
  pushLog(state, {
    kind: 'initiative',
    text: `${sideById(state, winner)?.name ?? winner} wins initiative (${opening
      .map((r) => `${r.side} ${r.roll}`)
      .join(', ')})`,
    dice: opening.map((r) => r.roll),
  })
  return initiative
}

/**
 * Let the initiative winner set the order of everyone else (2.6 phase 2). The
 * winner stays first — they are the ones with initiative — and the order must
 * name every side exactly once.
 */
export function setInitiativeOrder(state: GameState, order: readonly SideId[]): boolean {
  const initiative = state.initiative
  if (!initiative) return false
  if (order.length !== state.sides.length) return false
  if (order[0] !== initiative.winner) return false
  if (new Set(order).size !== order.length) return false
  if (!order.every((id) => state.sides.some((side) => side.id === id))) return false
  initiative.order = [...order]
  return true
}

// ---------------------------------------------------------------------------
// Who acts first (2.6)
// ---------------------------------------------------------------------------

/**
 * Where initiative puts a side in a phase.
 *
 * `initiative-last` is the surprising one: the winner *launches and moves last*
 * (phases 3, 4 and 6) so they can react to what the loser commits to, and only
 * *fires first* (phase 11).
 */
export type PhaseSequencing = 'simultaneous' | 'initiative-first' | 'initiative-last'

/** What one activation consists of when players alternate (2.5). */
export type AlternationUnit = 'none' | 'ship' | 'fighter-group'

export interface PhaseSequenceRule {
  /** The rulebook's own phase number (2.6). */
  number: number
  sequencing: PhaseSequencing
  unit: AlternationUnit
  /** The words in the book that fix the order. */
  note: string
}

/**
 * Who goes first in each phase, and what one activation is (2.6, with 8.5 for
 * the fighter phases).
 */
export const PHASE_SEQUENCE: Record<Phase, PhaseSequenceRule> = {
  orders: {
    number: 1,
    sequencing: 'simultaneous',
    unit: 'none',
    note: 'both players simultaneously (and secretly) writing the movement orders',
  },
  initiative: {
    number: 2,
    sequencing: 'simultaneous',
    unit: 'none',
    note: 'Players roll a D6 each; highest roll has initiative for this turn',
  },
  'launch-missiles': {
    number: 3,
    sequencing: 'initiative-last',
    unit: 'ship',
    note: 'Players alternate by ships, not by missile salvo or squadron. The player who lost initiative launches first',
  },
  'move-fighters': {
    number: 4,
    sequencing: 'initiative-last',
    unit: 'fighter-group',
    note: 'The player who lost initiative moves first (8.5: the winner moves second)',
  },
  'move-ships': {
    number: 5,
    sequencing: 'simultaneous',
    unit: 'none',
    note: 'Both players simultaneously move their ships strictly in accordance with orders',
  },
  'secondary-fighter-moves': {
    number: 6,
    sequencing: 'initiative-last',
    unit: 'fighter-group',
    note: '8.5: whoever moved first in the main Fighter Movement Phase must also move first here',
  },
  'allocate-attacks': {
    number: 7,
    sequencing: 'simultaneous',
    unit: 'none',
    note: 'all missiles and fighter groups within attack range are moved into attack positions',
  },
  'fighter-vs-fighter': {
    number: 8,
    sequencing: 'simultaneous',
    unit: 'none',
    note: 'resolved before actual point defense fire is allocated to surviving ships',
  },
  'point-defence': {
    number: 9,
    sequencing: 'simultaneous',
    unit: 'none',
    note: 'announce all targets before rolling any dice',
  },
  'ordnance-vs-ships': {
    number: 10,
    sequencing: 'simultaneous',
    unit: 'none',
    note: 'damage is applied immediately, including threshold point checks if applicable',
  },
  'ship-fire': {
    number: 11,
    sequencing: 'initiative-first',
    unit: 'ship',
    note: 'starting with the player who won initiative, each player alternates in firing one ship',
  },
  boarding: {
    number: 12,
    sequencing: 'simultaneous',
    unit: 'none',
    note: 'all ships that have enemy boarders onboard roll for effects',
  },
  threshold: {
    number: 13,
    sequencing: 'simultaneous',
    unit: 'none',
    note: 'all ships roll threshold checks from damage incurred in phase 11 and 12',
  },
  'damage-control': {
    number: 14,
    sequencing: 'simultaneous',
    unit: 'none',
    note: 'make any Damage Control repair rolls',
  },
  'reactor-explosions': {
    number: 15,
    sequencing: 'simultaneous',
    unit: 'none',
    note: 'apply damage to adjacent ships and roll additional threshold checks for them',
  },
}

/** The rulebook's number for a phase (2.6), so a log line reads against the book. */
export function phaseNumber(phase: Phase): number {
  return PHASE_SEQUENCE[phase].number
}

/**
 * The order sides act in during a phase (2.6).
 *
 * For a `simultaneous` phase there is no alternation at all; the order returned
 * is simply a stable one to resolve in, so a replay is deterministic. Callers
 * that care should read `PHASE_SEQUENCE[phase].sequencing`.
 */
export function activationOrder(state: GameState, phase: Phase = state.phase): SideId[] {
  const order = state.initiative?.order ?? state.sides.map((side) => side.id)
  return PHASE_SEQUENCE[phase].sequencing === 'initiative-last' ? [...order].reverse() : [...order]
}

/**
 * Interleave each side's units into one activation list (2.5): "When the order
 * matters, players alternate one ship at a time, not by entire fleet." A side
 * that runs out of units simply drops out of the rotation.
 */
export function alternateActivations<T>(
  order: readonly SideId[],
  unitsBySide: ReadonlyMap<SideId, readonly T[]>,
): Array<{ side: SideId; unit: T }> {
  const out: Array<{ side: SideId; unit: T }> = []
  const longest = Math.max(0, ...order.map((side) => unitsBySide.get(side)?.length ?? 0))
  for (let i = 0; i < longest; i++) {
    for (const side of order) {
      const units = unitsBySide.get(side)
      if (units && i < units.length) out.push({ side, unit: units[i] })
    }
  }
  return out
}

/**
 * The ships of a ship-alternating phase (3 and 11) in the order they activate.
 * Within a side ships keep their declaration order; the player is of course
 * free to pick any of their unactivated ships at the table, so this is the
 * engine's default sequence rather than a constraint.
 */
export function shipActivationOrder(
  state: GameState,
  phase: Phase = state.phase,
): Array<{ side: SideId; unit: ShipState }> {
  const order = activationOrder(state, phase)
  const bySide = new Map<SideId, ShipState[]>()
  for (const side of order) bySide.set(side, activeShips(state, side))
  return alternateActivations(order, bySide)
}

/**
 * Fighter and gunboat groups in the order they activate in phase 4 (2.6):
 * "All fighter groups being launched this turn must be moved before those
 * already in flight", so a group launched this turn sorts ahead of the rest.
 */
export function fighterActivationOrder(
  state: GameState,
  phase: Phase = state.phase,
): Array<{ side: SideId; unit: FighterGroupState }> {
  const order = activationOrder(state, phase)
  const bySide = new Map<SideId, FighterGroupState[]>()
  for (const side of order) {
    const groups = activeFighterGroups(state, side)
    const launchedNow = groups.filter((g) => g.launchedTurn === state.turn)
    const alreadyFlying = groups.filter((g) => g.launchedTurn !== state.turn)
    bySide.set(side, [...launchedNow, ...alreadyFlying])
  }
  return alternateActivations(order, bySide)
}

/**
 * Sub-order within the simultaneous ship movement phase (2.6 phase 5): fixed
 * paths first, then mine layers, then everyone else, with FTL transits placed
 * last. Lower ranks move earlier.
 *
 * 16.1 is what puts the first group first, and it keys off thrust rather than
 * off a scenario flag: *"Ships with thrust 0 drives, and any asteroids or
 * similar object that have significant movement relative to ships, never write
 * orders… Each turn, the ship or asteroid moves along this predetermined
 * course before all other ships."* A drive shot out under 4.11 leaves a ship at
 * thrust 0 exactly as a thrust-0 hull is, so the wreck drifts with the rocks —
 * which is the difference between it fouling somebody's firing line before they
 * move and after.
 */
export function shipMovementRank(ship: ShipState): number {
  if (ship.fixedPath || movementPriority(currentThrust(ship)) === 0) return 0
  if (ship.layingMines) return 1
  if (ship.ftlTransit !== 'none') return 3
  return 2
}

/**
 * A ship as 12.12's vector state.
 *
 * A cinematic ship is the special case where course and facing agree, which is
 * how 12.12 opens, so this is total: a ship with no course marker reads as one
 * travelling along its bow.
 */
export function vectorStateOf(ship: ShipState): VectorState {
  return ship.courseDegrees === null
    ? vectorStateFromCinematic(ship.placement, ship.velocity)
    : {
        position: { ...ship.placement.position },
        facing: ship.placement.facing,
        course: ship.courseDegrees,
        velocity: ship.velocity,
      }
}

/**
 * Ships this battle's deployment still owes a placement (18.1).
 *
 * A ship that is out of the battle before it has been placed cannot be, so it
 * does not hold the deployment open — which matters because `advance-phase`
 * refuses while anything is owed.
 */
export function shipsAwaitingDeployment(state: GameState): ShipState[] {
  if (!state.deployment) return []
  const placed = new Set(state.deployment.placed)
  return state.ships.filter(
    (ship) => !placed.has(ship.id) && !ship.destroyed && !ship.offTable,
  )
}

/** Whether this ship has been put on the table by 18.1's procedure. */
export function isDeployed(state: GameState, shipId: string): boolean {
  return state.deployment?.placed.includes(shipId) ?? false
}

/** Ships in the order phase 5 moves them (2.6). */
export function shipMovementOrder(state: GameState): ShipState[] {
  return activeShips(state)
    .map((ship, index) => ({ ship, index }))
    .sort((a, b) => shipMovementRank(a.ship) - shipMovementRank(b.ship) || a.index - b.index)
    .map((entry) => entry.ship)
}

// ---------------------------------------------------------------------------
// Turn and phase advance (2.6)
// ---------------------------------------------------------------------------

/**
 * Step to the next phase, wrapping into the next turn after the last one.
 *
 * Entering the initiative phase rolls it if this turn has not been rolled yet:
 * phase 2 holds no decision beyond the dice — the one choice in it, the order
 * of the other players in a multi-player game, is made afterwards with
 * `setInitiativeOrder` — so an engine that could not step through phase 2 on
 * its own would be useless headless.
 */
export function advancePhase(state: GameState): SequencePosition {
  onLeavePhase(state)

  const index = state.phases.indexOf(state.phase)
  if (index < 0 || index === state.phases.length - 1) {
    state.turn += 1
    state.phase = state.phases[0]
    onBeginTurn(state)
  } else {
    state.phase = state.phases[index + 1]
  }

  onEnterPhase(state)
  return { turn: state.turn, phase: state.phase }
}

/** Step phases until the sequence reaches `phase` (2.6). */
export function advanceToPhase(state: GameState, phase: Phase): SequencePosition {
  if (!state.phases.includes(phase)) {
    throw new Error(`phase ${phase} is not played in this game`)
  }
  // One full lap of the sequence is the most it can take; standing in the
  // phase asked for means going round the turn to reach it again.
  for (let guard = 0; guard < state.phases.length; guard++) {
    advancePhase(state)
    if (state.phase === phase) break
  }
  return { turn: state.turn, phase: state.phase }
}

function onLeavePhase(state: GameState): void {
  // FireCon allocation is per phase, not per turn (5.2), so leaving a phase
  // hands every FireCon back.
  for (const ship of state.ships) {
    ship.fireconAssignments = []
    ship.cloudLocks.clear()
  }

  if (state.phase === 'move-ships') recordLastKnownVectors(state)
}

function onEnterPhase(state: GameState): void {
  pushLog(state, {
    kind: 'phase',
    text: `Turn ${state.turn}, phase ${phaseNumber(state.phase)} — ${PHASE_LABELS[state.phase]}`,
  })
  if (state.phase === 'initiative' && state.initiative?.turn !== state.turn) {
    rollInitiative(state)
  }
}

function onBeginTurn(state: GameState): void {
  // Initiative is rolled fresh each turn (2.6 phase 2).
  state.initiative = null

  for (const ship of state.ships) {
    ship.order = null
    // 2.6 phase 1 writes a fresh sheet every turn; one that survived would be
    // flown twice. The course marker is not an order and stays where it is.
    ship.vectorOrders = null
    ship.thrustUsed = 0
    ship.layingMines = false
    ship.landing = false
    ship.hullHitByWeapons = false
    // A transit already under way is not re-declared each turn: 11.4 gives the
    // drive a warm-up turn and a jump turn, and the order that started it
    // stands until the ship is gone.
    if (ship.ftlWarmupTurn === null) ship.ftlTransit = 'none'
    ship.ramTargetId = null
    ship.dockTargetId = null
    // 17.9's turn magnitude is written afresh each turn, like the ram beside
    // it. The pending effect is NOT cleared: it is the change the last move
    // earned, and it lands at the start of the next one.
    ship.gravityTurn = null
    // "In Full Thrust weapons can only be used once per turn" (2.6) — the
    // turn is the unit, so this is the one place the record is wiped.
    ship.weaponsFired.clear()
    ship.hasFiredThisTurn = false
    ship.damageControl = []
    // 7.25: the field is declared afresh every turn, along with the movement
    // order it is written beside.
    ship.reflexFieldActive = false
    // 16.6's clock turns here, because both of its steps are "the following
    // turn" and "one full turn" — durations measured in whole turns, which is
    // what a turn boundary is for.
    const docked = completeDocking(ship.dock, state.turn)
    ship.dock = completeCastOff(docked, state.turn)
    ship.ongoing = ship.ongoing.filter(
      (effect) => effect.expiresAfterTurn === null || effect.expiresAfterTurn >= state.turn,
    )
  }

  // The per-turn flags a group carries are `fighters.ts`'s to name, so they
  // are cleared by its own function rather than by a list here that would
  // silently fall behind it.
  for (const group of state.fighterGroups) {
    Object.assign(group, beginFighterTurn(group))
    // 8.6 pursuit is declared by "a fighter group that attacked an enemy ship
    // or an enemy screening fighter group LAST turn", so what the group went
    // in on has to survive the reset that clears what it is going in on now.
    group.lastTargetId = group.targetId
    group.targetId = null
  }

  for (const squadron of state.gunboatSquadrons) {
    Object.assign(squadron, beginGunboatTurn(squadron))
    squadron.targetId = null
  }

  // 7.20: a cloak knocked out by a threshold check keeps the ship hidden until
  // the end of the turn it died in, so the decloak lands here rather than at
  // the moment the box was checked.
  for (const ship of state.ships) {
    if (!ship.cloak) continue
    ship.cloak = cloakEndOfTurn(ship.cloak)
    ship.cloaked = cloakMode(ship.cloak) !== 'none'
  }
}

/**
 * Stamp each ship's course and velocity at the end of phase 5 (2.6): "players
 * can ask opponents for the last known velocity and course (i.e. at the end of
 * the previous turn's Ship Movement Phase) of any ships."
 */
function recordLastKnownVectors(state: GameState): void {
  for (const ship of state.ships) {
    ship.lastKnown = {
      course: ship.placement.facing,
      // Under 12.12 the course is not the facing, and telling an opponent the
      // bow line when they asked for the course would be a wrong answer to a
      // question the rules entitle them to ask.
      ...(ship.courseDegrees === null ? {} : { courseDegrees: ship.courseDegrees }),
      velocity: ship.velocity,
      turn: state.turn,
      cloaked: ship.cloaked,
    }
  }
}

/**
 * What an opponent may be told about a ship before writing orders (2.6):
 * course and velocity as at the end of the last movement phase — unless the
 * ship was under cloak then, which exempts it from the question.
 */
export function lastKnownVector(
  ship: ShipState,
): { course: Course; courseDegrees?: number; velocity: number } | null {
  if (!ship.lastKnown || ship.lastKnown.cloaked) return null
  return {
    course: ship.lastKnown.course,
    ...(ship.lastKnown.courseDegrees === undefined
      ? {}
      : { courseDegrees: ship.lastKnown.courseDegrees }),
    velocity: ship.lastKnown.velocity,
  }
}

// ---------------------------------------------------------------------------
// Weapons: once per turn (2.6)
// ---------------------------------------------------------------------------

/**
 * Whether a mount still has its shot (2.6): *"weapons can only be used once per
 * turn, so any system used for point defense … cannot be used again in that
 * turn against a ship."* A destroyed mount (4.11) and an empty one-shot rack
 * (6.6) are out too.
 *
 * The id may name a weapon or a system. That sentence of 2.6 is about systems
 * as much as weapons — a PDS is a mount that fires once a turn — and for a long
 * time this function answered `false` for every one of them, because it looked
 * the id up in `design.weapons` and gave up when it was not there. Point
 * defence went on working, quietly, with nothing but the class-1 beams.
 */
export function canWeaponFire(ship: ShipState, weaponId: string): boolean {
  if (ship.destroyed || ship.offTable) return false
  if (ship.destroyedSystems.has(weaponId)) return false
  if (ship.weaponsFired.has(weaponId)) return false
  if (ship.ongoing.some((effect) => effect.weaponsOffline?.includes(weaponId))) return false
  const weapon = ship.design.weapons.find((w) => w.id === weaponId)
  if (weapon) {
    if (weapon.ammo !== undefined && shotsLeft(ship, weaponId) <= 0) return false
    return true
  }
  return ship.design.systems.some((system) => system.id === weaponId)
}

/**
 * Shots this hull has left on a mount (6.6, 7.14).
 *
 * A design's `ammo` is what the mount was built with; this is what is left of
 * it. Ships of a class share their design, so the count cannot live there —
 * which is why `WeaponDef.ammo` was read in three places and written in none,
 * and why every single-shot Salvo Missile Rack in the game fired every turn
 * for ever.
 */
export function shotsLeft(ship: ShipState, weaponId: string): number {
  const weapon = ship.design.weapons.find((w) => w.id === weaponId)
  if (!weapon || weapon.ammo === undefined) return Number.POSITIVE_INFINITY
  return ship.ammo.get(weaponId) ?? weapon.ammo
}

/** Cross one shot off (6.6). A mount with no `ammo` rating has nothing to spend. */
export function spendShot(ship: ShipState, weaponId: string): void {
  const weapon = ship.design.weapons.find((w) => w.id === weaponId)
  if (!weapon || weapon.ammo === undefined) return
  ship.ammo.set(weaponId, Math.max(0, shotsLeft(ship, weaponId) - 1))
}

/**
 * Spend a weapon's fire for the turn (2.6). The phase is kept so the log can
 * say why a beam was unavailable later — "spent on point defence in phase 9"
 * is the common and otherwise baffling case.
 */
export function markWeaponFired(ship: ShipState, weaponId: string, phase: Phase): void {
  ship.weaponsFired.set(weaponId, phase)
  // 6.6: "Once fired, it is crossed off and cannot be used again." Spending
  // the shot here rather than at each of the eleven places a weapon fires
  // means a mount added later cannot forget to.
  spendShot(ship, weaponId)
}

/** The phase a weapon spent its fire in, if it has (2.6). */
export function weaponFiredIn(ship: ShipState, weaponId: string): Phase | undefined {
  return ship.weaponsFired.get(weaponId)
}

/** Weapon ids that can still fire this turn (2.6, 4.11). */
export function availableWeapons(ship: ShipState): string[] {
  return ship.design.weapons.filter((w) => canWeaponFire(ship, w.id)).map((w) => w.id)
}

/**
 * Whether a ship may still take its firing activation in phase 11 (2.6):
 * "After a ship has fired some or all of its weaponry and play has moved on to
 * another ship that ship may not fire any other ship to ship weapons in that
 * game turn."
 */
export function canShipFire(ship: ShipState): boolean {
  return !ship.destroyed && !ship.offTable && !ship.hasFiredThisTurn
}

/** Close a ship's phase 11 activation, spending its shot for the turn (2.6). */
export function markShipFired(ship: ShipState): void {
  ship.hasFiredThisTurn = true
}

// ---------------------------------------------------------------------------
// FireCon: per phase, not per turn (4.4, 5.2)
// ---------------------------------------------------------------------------

/**
 * Targets the ship can direct fire at in one phase (4.4, 5.2). An Advanced
 * FireCon counts double: "Advanced FireCon systems can track two separate
 * targets each, acting just like two normal FireCons" (5.2). Effects that put
 * a FireCon offline without destroying it subtract from the total.
 */
export function fireConCapacity(ship: ShipState): number {
  let capacity = 0
  for (const system of ship.design.systems) {
    if (ship.destroyedSystems.has(system.id)) continue
    if (system.kind === 'firecon') capacity += 1
    else if (system.kind === 'advanced-firecon') capacity += 2
  }
  for (const effect of ship.ongoing) capacity -= effect.fireConOffline ?? 0
  return Math.max(0, capacity)
}

/** Targets already being engaged in this phase (5.2). */
export function engagedTargets(ship: ShipState, phase: Phase): string[] {
  return ship.fireconAssignments.filter((a) => a.phase === phase).map((a) => a.targetId)
}

/** FireCon left for this phase — the limit is per phase, not per turn (5.2). */
export function availableFireCons(ship: ShipState, phase: Phase): number {
  return fireConCapacity(ship) - engagedTargets(ship, phase).length
}

/**
 * Claim a FireCon for a target in this phase (4.4, 5.2). Engaging a target the
 * ship is already engaging in this phase is free — one FireCon tracks one
 * target however many weapons are pointed down it (4.4) — so this returns true
 * without spending anything. Returns false when no FireCon is left.
 *
 * Point defence never calls this: "Point defense fire against fighters or
 * missiles does not require the use of the ship's main FireCon systems" (4.4).
 */
export function assignFireCon(ship: ShipState, targetId: string, phase: Phase): boolean {
  if (engagedTargets(ship, phase).includes(targetId)) return true
  if (availableFireCons(ship, phase) <= 0) return false
  ship.fireconAssignments.push({ targetId, phase })
  return true
}

// ---------------------------------------------------------------------------
// Damage control (10.4)
// ---------------------------------------------------------------------------

/**
 * Crew factors (10.4).
 *
 * *"Military ships have one crew factor (CF) for every 20 mass or part
 * thereof, and one DCP per crew factor... For merchant and civilian vessels,
 * which usually have much smaller crews than warships there will be one CF per
 * 50 mass (or part thereof)."*
 *
 * So a warship's damage control is a function of how big it is, not something
 * bought on the design sheet — which is the opposite of what this engine
 * assumed before the rule could be read.
 */
export const MASS_PER_CREW_FACTOR = 20
export const MASS_PER_CIVILIAN_CREW_FACTOR = 50

export function crewFactors(mass: number, civilian = false): number {
  const per = civilian ? MASS_PER_CIVILIAN_CREW_FACTOR : MASS_PER_CREW_FACTOR
  return Math.max(1, Math.ceil(mass / per))
}

/**
 * Where the crew factor dots fall on the damage track (10.5).
 *
 * *"divide the number of hull boxes the ship has by the number of crew
 * factors. Round the result up if it is not a whole number, then count along
 * the damage track until you reach the number and place the first dot there...
 * When you reach the end of the damage track, put the last dot in the last
 * box."* The book's own worked example is 27 boxes and 5 crew factors, giving
 * 6, 12, 18, 24 and 27 — the last dot pulled back onto the final box rather
 * than falling past the end of the track.
 *
 * Returned as one-based box numbers, so a dot at 6 is lost when the sixth box
 * is crossed off.
 */
export function crewFactorBoxes(hullBoxes: number, factors: number): number[] {
  if (hullBoxes <= 0 || factors <= 0) return []
  const step = Math.ceil(hullBoxes / factors)
  const dots: number[] = []
  for (let i = 1; i < factors; i++) {
    const at = i * step
    if (at >= hullBoxes) break
    dots.push(at)
  }
  dots.push(hullBoxes)
  return dots
}

/**
 * Crew factors still alive (10.5): *"a ship's current CF (and thus its current
 * number of DCPs) is the number of dots still remaining in non-destroyed boxes
 * on the damage track."*
 */
export function survivingCrewFactors(ship: ShipState): number {
  const dots = crewFactorBoxes(
    ship.design.hullBoxes,
    crewFactors(ship.design.mass, ship.design.group === 'civilian'),
  )
  return dots.filter((box) => box > ship.hullMarked).length
}

/**
 * Damage control parties aboard (10.4, 10.5, 13.13).
 *
 * Two sources, and the distinction is the whole point: the crew the ship was
 * built with provides one party per surviving crew factor for nothing, and
 * 13.13's *"Additional Damage Control Parties"* are the ones actually bought
 * at 5 points each. A ship that has been shot through half its hull has lost
 * half its repair capacity with it, which is what makes damage control a race
 * rather than a constant.
 *
 * Bought parties are listed on the SSD as systems where a design spells them
 * out, so those can be crossed off by a threshold check like anything else.
 */
export function damageControlParties(ship: ShipState): number {
  const listed = ship.design.systems.filter((s) => s.kind === 'damage-control-party')
  const bought =
    listed.length > 0
      ? listed.filter((s) => !ship.destroyedSystems.has(s.id)).length
      : ship.design.additionalDamageControlParties
  return survivingCrewFactors(ship) + bought
}

/** Parties not yet assigned to a repair this turn (10.4). */
export function availableDamageControlParties(ship: ShipState): number {
  const assigned = ship.damageControl.reduce((sum, a) => sum + a.parties, 0)
  return Math.max(0, damageControlParties(ship) - assigned)
}

/**
 * Put parties on a system in phase 14 (10.4). At most three parties may work
 * one system, and a ship cannot assign parties it does not have. Returns the
 * number actually assigned.
 */
export function assignDamageControl(ship: ShipState, systemId: string, parties: number): number {
  const existing = ship.damageControl.find((a) => a.systemId === systemId)
  const already = existing?.parties ?? 0
  const room = Math.min(3 - already, availableDamageControlParties(ship))
  const added = Math.max(0, Math.min(parties, room))
  if (added === 0) return 0
  if (existing) existing.parties += added
  else ship.damageControl.push({ systemId, parties: added })
  return added
}

// ---------------------------------------------------------------------------
// The hull track and threshold accounting (2.4, 4.11)
// ---------------------------------------------------------------------------

/**
 * Where each hull row ends, as a running total of boxes (2.4).
 *
 * The SSD prints rows of near-equal length; where the boxes do not divide
 * evenly the spare ones go in the earlier rows, which is how the printed
 * sheets read (26 boxes in four rows is 7, 7, 6, 6). A hand-entered SSD that
 * splits them some other way can say so with `hullRowSizes`.
 */
export function hullRowBoundaries(ship: ShipState): number[] {
  const sizes = ship.hullRowSizes ?? derivedRowSizes(ship.design)
  const boundaries: number[] = []
  let running = 0
  for (const size of sizes) {
    if (size <= 0) continue
    running += size
    boundaries.push(running)
  }
  return boundaries
}

function derivedRowSizes(design: ShipDesign): number[] {
  const base = Math.floor(design.hullBoxes / design.hullRows)
  const spare = design.hullBoxes % design.hullRows
  const sizes: number[] = []
  for (let row = 0; row < design.hullRows; row++) sizes.push(base + (row < spare ? 1 : 0))
  return sizes
}

/** Hull boxes left before the ship is destroyed (2.4). */
export function hullRemaining(ship: ShipState): number {
  return Math.max(0, ship.design.hullBoxes - ship.hullMarked)
}

/** Hull rows entirely crossed off (2.4, 4.11). */
export function hullRowsCompleted(ship: ShipState): number {
  return hullRowBoundaries(ship).filter((boundary) => ship.hullMarked >= boundary).length
}

/**
 * Cross hull boxes off the track (2.4), "starting at the top left and crossing
 * out one box per damage point", and record any threshold points passed.
 *
 * This only marks the hull: what screens and armour absorbed before the hull
 * saw anything is the combat module's business (4.8, 4.9). The ship is
 * destroyed when the last box goes, and 4.11 makes no check then — "No
 * threshold checks need to be made at the end of the last hull row, since the
 * ship is considered to be destroyed!".
 */
export function markHullBoxes(
  ship: ShipState,
  points: number,
  // 12.7 needs to know what put the row in: a threshold test caused by
  // boarding combat cannot kill Marines or boarders, and one caused by
  // weapons fire can. Everything except the boarding step is weapons fire.
  cause: 'weapons' | 'boarding' = 'weapons',
): { marked: number; rowsCrossed: number; destroyed: boolean } {
  if (points <= 0 || ship.destroyed) {
    return { marked: 0, rowsCrossed: 0, destroyed: ship.destroyed }
  }
  // 11.7: the defender has nominated a hull in the attached group to take the
  // damage. Resolved here because this is the one function every damage path
  // in the game ends at — the alternative is the same three lines in twelve
  // places, and the thirteenth would be the one that got it wrong.
  const sink = ship.damageSink
  if (sink && sink !== ship && !sink.destroyed && sink.carriedBy === ship.id) {
    return markHullBoxes(sink, points, cause)
  }
  if (cause === 'weapons') ship.hullHitByWeapons = true
  // 12.7: "A single point of damage is sufficient to destroy the captured
  // ship" — how a navy denies the enemy its own hull. A prize has no armour
  // and no screens worth the name any more; one hit and it is gone.
  if (ship.captured && capturedShipDestroyed(points)) {
    const standing = ship.design.hullBoxes - ship.hullMarked
    ship.hullMarked = ship.design.hullBoxes
    ship.destroyed = true
    ship.pendingThresholdRows = 0
    ship.excessDamage = 0
    return { marked: standing, rowsCrossed: 0, destroyed: true }
  }
  const rowsBefore = hullRowsCompleted(ship)
  const before = ship.hullMarked
  ship.hullMarked = Math.min(ship.design.hullBoxes, before + points)
  const rowsCrossed = hullRowsCompleted(ship) - rowsBefore

  if (ship.hullMarked >= ship.design.hullBoxes) {
    ship.destroyed = true
    ship.pendingThresholdRows = 0
    // 17.5 needs the overkill, and this is the only place both halves of it
    // are in scope: what the blow was worth and what was left to absorb it.
    ship.excessDamage = Math.max(0, points - (ship.design.hullBoxes - before))
    return { marked: ship.hullMarked - before, rowsCrossed, destroyed: true }
  }
  ship.pendingThresholdRows += rowsCrossed
  return { marked: ship.hullMarked - before, rowsCrossed, destroyed: false }
}

/**
 * The threshold check owed, if any (4.11): one check for the last row lost,
 * "but add 1 to each die roll for each extra threshold point passed in that
 * attack". Feed the result straight to `thresholdCheck` in `dice.ts`.
 *
 * A Flawed Design's standing −1 (13.13) is not added here — that is a modifier
 * on the roll, and `thresholdCheck` takes it as `drm`.
 */
export function pendingThresholdCheck(
  ship: ShipState,
): { rowsLost: number; extraRows: number } | null {
  if (ship.destroyed || ship.pendingThresholdRows <= 0) return null
  return {
    rowsLost: ship.hullRowsChecked + ship.pendingThresholdRows,
    extraRows: ship.pendingThresholdRows - 1,
  }
}

/** Mark the owed checks as made, so the next row is checked as the next row (4.11). */
export function resolvePendingThreshold(ship: ShipState): void {
  ship.hullRowsChecked += ship.pendingThresholdRows
  ship.pendingThresholdRows = 0
}

/**
 * When the checks for damage dealt in a phase are rolled (2.6).
 *
 * Phase 10 says so outright — "Damage resulting from these attacks is applied
 * immediately, including threshold point checks if applicable" — and phase 15
 * has to be immediate because phase 13 is already behind it. Everything else,
 * phases 11 and 12 above all, waits for phase 13: "All ships roll threshold
 * checks from damage incurred in phase 11 and 12 if required."
 *
 * Damage from a source the book does not place — a phase 5 collision (3.8) —
 * falls through to the default and is checked in phase 13, which is the
 * nearest reading of that sentence.
 */
export function thresholdResolution(phase: Phase): 'immediate' | 'deferred' {
  return phase === 'ordnance-vs-ships' || phase === 'reactor-explosions' ? 'immediate' : 'deferred'
}

/** Ships owing a threshold check in phase 13 (2.6, 4.11). */
export function shipsAwaitingThreshold(state: GameState): ShipState[] {
  return activeShips(state).filter((ship) => pendingThresholdCheck(ship) !== null)
}

// ---------------------------------------------------------------------------
// Systems
// ---------------------------------------------------------------------------

/** Whether a system or weapon has been crossed off the SSD (2.4, 4.11). */
export function isSystemDestroyed(ship: ShipState, systemId: string): boolean {
  return ship.destroyedSystems.has(systemId)
}

/**
 * Cross a system off the SSD (4.11). The main drive is the exception the rule
 * calls out: the first failure halves the thrust rating, the second disables
 * it, and a drive rated 1 is disabled by the first — so a drive is tracked as
 * `driveHits` instead of being crossed off. Pass the drive as `'drive'`.
 */
export function destroySystem(ship: ShipState, systemId: string): void {
  if (systemId === 'drive') {
    ship.driveHits = Math.min(2, ship.driveHits + 1)
    if (ship.design.drive.thrust <= 1) ship.driveHits = 2
    return
  }
  ship.destroyedSystems.add(systemId)
}

/** Thrust the drive can still deliver (3.2, 4.11 drive damage, plus effects). */
export function currentThrust(ship: ShipState): number {
  const base = ship.design.drive.thrust
  let thrust = ship.driveHits >= 2 ? 0 : ship.driveHits === 1 ? Math.floor(base / 2) : base
  for (const effect of ship.ongoing) thrust -= effect.thrustPenalty ?? 0
  return Math.max(0, thrust)
}

/** Operational systems of a kind, e.g. every live PDS (4.11, 7.12). */
export function operationalSystems(
  ship: ShipState,
  kind: ShipDesign['systems'][number]['kind'],
): ShipDesign['systems'] {
  return ship.design.systems.filter((s) => s.kind === kind && !ship.destroyedSystems.has(s.id))
}
