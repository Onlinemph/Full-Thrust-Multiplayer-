/**
 * Every mutation the game accepts, as a named, serializable record.
 *
 * The UI never mutates the game directly — it dispatches one of these, and the
 * store journals what it dispatched. Because the engine is deterministic and
 * the RNG is seeded, (setup + journal) reconstructs the game exactly, which is
 * what save/resume, undo, replays and two browsers staying in step are made of.
 *
 * Two rules keep replay honest:
 *
 *  1. Payloads carry ids and player choices only — never derived state. Each
 *     handler re-derives its context (range, arc, screen level, ECM, cloak)
 *     from the game itself, so a stale or hand-edited payload cannot make a
 *     replay disagree with the original battle.
 *  2. A refused action mutates nothing and is refused identically on replay,
 *     so journalling refusals is harmless — and it has to be harmless, because
 *     the journal records everything the player tried.
 */

import {
  advancePhase,
  assignDamageControl,
  assignFireCon,
  availableDamageControlParties,
  availableFireCons,
  canWeaponFire,
  currentThrust,
  destroySystem,
  engagedTargets,
  hullRowsCompleted,
  markHullBoxes,
  markShipFired,
  markWeaponFired,
  pushLog,
  rollInitiative,
  setInitiativeOrder,
  shipById,
  shipsAwaitingDeployment,
  tableBounds,
  thresholdResolution,
  vectorStateOf,
  type FighterGroupState,
  type TerrainFeature,
  type TerrainKind,
  type GameState,
  type GunboatSquadronState,
  type OrdnanceKind,
  type ShipState,
  type SideId,
  type TableGate,
} from './game'
import {
  applyOrder,
  departureEdge,
  driveFromDef,
  formatOrder,
  isOffTable,
  rollEmergencyThrust,
  rollTableReentry,
  thrustBudget,
  validateOrder,
  type MovementState,
  type TableEdge,
} from './movement'
import { applyDamage, createTargetState, type DamageableTarget } from './combat'
import {
  attenuatedScreens,
  cloudSpeedDamage,
  closestApproach,
  cloudTargetLock,
  createDebrisCloud,
  createGravityWell,
  debrisCloudExpired,
  explosionCheck,
  flareSystemKind,
  hasLineOfFire,
  moveDebrisCloud,
  nearestOrbitMarker,
  orbitDecayCheck,
  orbitDepartureCourse,
  orbitFacing,
  orbitReentryPlacementLegal,
  orbitReentryTurn,
  orbitMarkerPosition,
  orbitTrackArrival,
  orbitVelocityChange,
  pathMeetsOrbitTrack,
  resolveAtmosphericEntry,
  resolveCollision,
  resolveGravityZone,
  resolveKnockedOffCourse,
  resolveMeteorField,
  resolveSolarFlare,
  satelliteFacing,
  simpleOrbitApproach,
  SIMPLE_ORBIT_BAND,
  advanceOrbit,
  canFireFromOrbit,
  deliberateLanding,
  ORBIT_SAME_POINT_RANGE,
  stationaryCollisionRisk,
  type DebrisCloud,
  type FlareSystem,
  type OrbitTrack,
  type TerrainBody,
} from './terrain'
import {
  arcsWhenInverted,
  canManoeuvre,
  crowdedEdge,
  dockingApproach,
  holdApproach,
  isDocked,
  leavingTableIsRetreat,
  orderCastOff,
  readyToDisengage,
  resolveDisengagement,
  resolveRam,
  rollShip,
  tableShift,
  type TableEdge as ShiftEdge,
} from './specialmoves'
import { defaultPlacements, validatePlacement } from './battles'
import {
  formatVectorOrders,
  moveVector,
  validateVectorOrders,
  VECTOR_ORDER_KINDS,
  type VectorOrder,
} from './vectormovement'
import {
  allocateBattleriderDamage,
  attachedBattleriderDefence,
  canDetachBattlerider,
  currentTransferMass,
  gateActivation,
  GATE_HULL_FRACTION,
  gateBearsOn,
  gateEntry,
  isDisoriented,
  isGateActive,
  jumpPointDisorientation,
  portalPairTransit,
  resolveGateTransfer,
  ftlExitMove,
  ftlExitRestrictions,
  ftlPermittedAt,
  isAdvancedFtl,
  resolveFtlEntry,
  type HyperLimitRules,
  ftlExitStage,
  resolveFtlExit,
  type FtlExitStage,
} from './ftl'
import {
  boardersAtRiskInThreshold,
  boardingContinues,
  boardingUnits,
  BOARDING_PHASE,
  civilWarDrm,
  fleetMorale,
  isCivilWar,
  nearestEnemyVessel,
  resolveBoardingCombat,
  strikeColorsCheck,
  MAX_DCPS_PER_TARGET,
  type BoardedShip,
  type BoardingForce,
  type BoardingPlan,
} from './boarding'
import {
  aceDuel,
  aceNeedleAttack,
  adfcLockedOut,
  applyFighterLosses,
  assignScreen,
  assignScreenEngagements,
  canDeclareAttack,
  combatLanding,
  declarePursuit,
  deployFtlFighters,
  fighterMoraleCheck,
  fighterProfile,
  launchFighterMissiles,
  launchFighterMkps,
  launchPulseTorpedoes,
  evadeShipFire,
  interceptMissiles,
  isEngaged,
  launchFighterGroup,
  moveFighterGroup,
  moveWithEscortedShip,
  pointDefenceAgainstFighters,
  reconfigureMultiRole,
  recoverFighterGroup,
  refuseDogfight,
  resolveAttackRun,
  resolveBoardingRun,
  resolveInterceptedAttackRun,
  resolveMultiGroupDogfight,
  resolveDogfight,
  scrambleFighters,
  screenHasBrokenOff,
  secondaryMoveFighterGroup,
  shipFireAtFighters,
  takesSecondaryMoveInPhaseFour,
  type AntiFighterMount,
  type CarrierFlightState,
  FIGHTER_ATTACK_RANGE,
  type FighterGroup,
  type RearmResult,
} from './fighters'
import { advance, arcTo, distance, isRearArcAttack } from './geometry'
import {
  combinedStealthLevel,
  effectiveScreenLevel as screenLevelOf,
  pointDefenceOptions,
  stealthHullLevel,
  STEALTH_BAND_SCALE,
  resolvePointDefence,
  PDS_RANGE,
  type PdAllocation,
  type PdDefender,
  type PdMount,
  type PdMountKind,
  type PdTargetKind,
  type PdThreat,
  type StealthLevel,
} from './defences'
import { d6, thresholdCheck, thresholdTarget, type ScreenLevel } from './dice'
import {
  fireWeapon,
  isAreaEffect,
  isOrdnance,
  maxRangeOf,
  needsFireCon,
  rollsBeamDice,
  type WeaponResult,
} from './weapons'
import {
  acquireMissileTargets,
  canEngagePlasmaBolt,
  layMines,
  minesTriggeredBy,
  resolveMineAttack,
  fireRocketPod,
  launchMissile,
  launchPlasmaBolt,
  moveOrdnanceMarkers,
  nearestCourse,
  plasmaBoltLauncherLimit,
  resolveAntimatterDetonation,
  rollSalvoLockOn,
  resolveOrdnanceAttack,
  resolvePlasmaBoltDefence,
  resolvePlasmaBoltDetonation,
  ANTIMATTER_BLAST_RADIUS,
  PLASMA_BOLT_BLAST_RADIUS,
  type BlastEffect,
  type BlastTarget,
  type MineMarker,
  type MissileMarker,
  type PlasmaBolt,
  type PlasmaBoltDefence,
} from './ordnance'
import {
  damageControlPhase,
  isOutOfControl,
  CORE_SYSTEM_IDS,
  DRIVE_SYSTEM_ID,
  reactorExplosionPhase,
  rollThresholdChecks,
  thresholdPhase,
} from './threshold'
import {
  launchGunboatSquadron,
  moveGunboatSquadron,
  recoverGunboatSquadron,
  resolveGunboatAttack,
  secondaryMoveGunboatSquadron,
  type GunboatCarrierState,
  type GunboatSquadron,
} from './gunboats'
import {
  cancelCloakOrder,
  cloakCapability,
  cloakEndOfMovement,
  cloakMode,
  cloakStartOfMovement,
  ewFireEffect,
  isEnergyWeapon,
  orderCloak,
  rollReflexField,
  AREA_ECM_RADIUS,
  type EwDefences,
} from './ew'
import type {
  Arc,
  Course,
  DamageMode,
  MovementOrder,
  Phase,
  Point,
  SystemKind,
  TurnDirection,
  WeaponDef,
} from './types'

// ---------------------------------------------------------------------------
// The action union
// ---------------------------------------------------------------------------

export type GameAction =
  // Sequence of play (2.6)
  | { type: 'advance-phase' }
  /** A side declares itself done with the phase. The last one closes it. */
  | { type: 'signal-ready'; side: SideId; ready: boolean }
  | { type: 'roll-initiative' }
  /** Ties in 2.6 phase 2 are re-rolled; a chosen order is journalled instead. */
  | { type: 'set-initiative-order'; order: SideId[] }
  /** Christen a hull — cosmetic, journalled so replays and saves keep the name. */
  | { type: 'rename-ship'; shipId: string; name: string }

  // Orders (3.5) — written before anything moves
  | { type: 'plot-turn'; shipId: string; direction: TurnDirection | null; points: number }
  | { type: 'plot-second-turn'; shipId: string; direction: TurnDirection | null; points: number }
  | { type: 'plot-accel'; shipId: string; accel: number }
  | { type: 'plot-emergency-thrust'; shipId: string; on: boolean }
  /**
   * 16.2: *"the player simply writes 'Roll' in the movement orders for that
   * turn"*. It rides in the order because that is where the rulebook puts it
   * and because it is charged against the same thrust; the attitude it
   * produces outlives the turn and lives on the ship.
   */
  | { type: 'plot-roll'; shipId: string; on: boolean }
  | { type: 'plot-mines'; shipId: string; on: boolean }
  /** 17.11 — this turn's deceleration in orbit is meant as a landing. */
  | { type: 'plot-landing'; shipId: string; on: boolean }
  /**
   * 3.9 and 17.7 — put a ship that left the table back on it. Where it may
   * go depends on which rule took it off.
   */
  | { type: 'return-to-table'; shipId: string; position: { x: number; y: number } }
  /**
   * 12.12's order sheet, replaced whole.
   *
   * A list, because the sheet is a sequence: *"Each effect is applied to the
   * ship strictly IN THE ORDER THEY ARE WRITTEN DOWN BY THE PLAYER."* The
   * payload is what the player wrote and nothing derived from it — the budget,
   * the legality and the flown path are all re-computed when the ship moves.
   */
  | { type: 'plot-vector-orders'; shipId: string; orders: VectorOrder[] }
  | { type: 'clear-order'; shipId: string }

  // Deployment (18.1) — before the first order of turn 1
  /** 4.12's die: the lower roll places first, and they alternate from there. */
  | { type: 'roll-deployment-order' }
  /**
   * 18.1: *"Players alternate in placing one ship at a time within 6 MU of
   * their table edge (or two to four ships at a time for large battles) with
   * any desired course and an initial velocity."*
   */
  | {
      type: 'deploy-ship'
      shipId: string
      position: { x: number; y: number }
      facing: Course
      velocity: number
    }
  /** 18.1: *"The defender can also place a planet or similar terrain feature."* */
  | {
      type: 'place-terrain'
      sideId: SideId
      kind: TerrainKind
      position: { x: number; y: number }
      radius: number
    }

  // Movement (3, phase 5)
  | { type: 'move-ship'; shipId: string }

  // Targeting (4.4) — one FireCon, one target
  | { type: 'assign-firecon'; shipId: string; targetId: string }
  | { type: 'clear-firecons'; shipId: string }

  // Fire (phase 11). The weapon and the target; everything else is re-derived.
  | {
      type: 'fire-weapon'
      shipId: string
      weaponId: string
      targetId: string
      /**
       * 5.13: the one system a needle beam is aimed at. A player's choice, so
       * it rides in the action; every other weapon ignores it.
       */
      systemId?: string
    }
  /** Fire at a fighter group, which costs a FireCon like a ship (4.4). */
  | { type: 'fire-at-flight'; shipId: string; weaponId: string; flightId: string }
  | { type: 'pass-fire'; shipId: string }

  // Ordnance (6) — launched in phase 3, flown and resolved later
  | { type: 'launch-ordnance'; shipId: string; weaponId: string; aimPoint: { x: number; y: number } }
  /** 6.7 — a rocket pod picks a ship, not a point, and rolls at launch. */
  | { type: 'fire-rocket-pod'; shipId: string; weaponId: string; targetId: string }
  /** 6.8 — a plasma bolt is a marker placed on the table, not a shot. */
  | { type: 'launch-plasma-bolt'; shipId: string; weaponId: string; aimPoint: { x: number; y: number } }
  | { type: 'move-ordnance' }
  | { type: 'resolve-ordnance-attacks' }

  // Point defence (phase 9)
  | { type: 'assign-point-defence'; shipId: string; systemId: string; targetId: string }
  | { type: 'resolve-point-defence' }

  // Flight operations (8)
  | { type: 'launch-flight'; carrierId: string; flightId: string }
  /**
   * A group flies where it likes: no course, no velocity, no written order
   * (8.5). `facing` is separate because a group's facing need not be its
   * direction of travel, and it decides which 180° it can shoot into (8.7).
   */
  | { type: 'move-flight'; flightId: string; to: { x: number; y: number }; facing?: Course }
  | {
      type: 'secondary-move-flight'
      flightId: string
      to: { x: number; y: number }
      facing?: Course
    }
  | { type: 'flight-strike'; flightId: string; targetId: string }
  | {
      type: 'flight-dogfight'
      flightId: string
      targetFlightId: string
      /**
       * 8.18: the Ace singles out the opposing Ace instead of adding his die
       * to the group's attack. The player's choice, so it rides in the action.
       */
      aceDuel?: boolean
    }
  | { type: 'flight-intercept'; flightId: string; ordnanceId: string }
  | { type: 'flight-evade'; flightId: string }
  | { type: 'recover-flight'; flightId: string; carrierId: string }
  /** 8.4 — everyone down at once, and the deck is fouled for the game. */
  | { type: 'combat-landing'; carrierId: string }
  /** 8.6 — a group takes station on a ship or another group instead of moving. */
  | { type: 'assign-screen'; flightId: string; escortId: string }
  /** 8.6 — a group that attacked something last turn goes after it. */
  | { type: 'declare-pursuit'; flightId: string; targetId: string }
  /** 8.6 — a group gives up its station and flies free again. */
  | { type: 'clear-mission'; flightId: string }
  /**
   * 8.3 — the one unplanned launch, when enemy fighters come for the carrier.
   * `flightIds` is the player's priority list of groups still in the bay.
   */
  | {
      type: 'scramble-fighters'
      carrierId: string
      attackerFlightId: string
      flightIds: string[]
    }
  /**
   * 8.11 — a furball: several groups on each side in one dogfight, every group
   * firing once and free to split its kills.
   */
  | {
      type: 'flight-furball'
      entries: Array<{ flightId: string; targetFlightIds: string[] }>
    }
  /**
   * 8.18 — the Ace picks out one system with a needle-beam shot while the rest
   * of the group attacks with one die fewer.
   */
  | { type: 'flight-ace-needle'; flightId: string; targetId: string; systemId: string }
  /** 8.9 — the run goes in anyway, through the group trying to stop it. */
  | {
      type: 'flight-press-attack'
      flightId: string
      interceptorFlightId: string
      targetId: string
    }
  /** 8.7 — a group names what it is going in on, in phase 7. */
  | { type: 'flight-declare-target'; flightId: string; targetId: string }
  /** 8.8 — every ship shoots at the groups coming at it. */
  | { type: 'resolve-point-defence-at-flights' }
  /** 8.15 — a Missile Fighter group looses its salvo, out to 12 MU. */
  | { type: 'launch-flight-missiles'; flightId: string; targetId: string }
  /** 8.15 — an Assault Shuttle group tries to put a party aboard. */
  | { type: 'flight-boarding-run'; flightId: string; targetId: string }
  /** 8.10 — a faster group declines the dogfight and runs for it. */
  | {
      type: 'refuse-dogfight'
      flightId: string
      attackerFlightId: string
      to: { x: number; y: number }
      facing?: Course
    }
  /** 8.15 — a Torpedo or MKP group throws its one-shot load at a ship. */
  | { type: 'flight-launch-payload'; flightId: string; targetId: string }
  /** 8.15 — FTL fighters start the battle already in the air, near the carrier. */
  | {
      type: 'deploy-ftl-flight'
      flightId: string
      position: { x: number; y: number }
      facing?: Course
    }
  /** 8.15 — a Multi-Role group re-arms for another mission in the bay. */
  | {
      type: 'reconfigure-flight'
      flightId: string
      loadout: 'standard' | 'interceptor' | 'attack'
      armament: 'beam' | 'cannon'
    }

  // Gunboats (9) — a squadron of six, flown like fighters, shot at like ships
  | { type: 'launch-gunboats'; carrierId: string; squadronId: string }
  | {
      type: 'move-gunboats'
      squadronId: string
      to: { x: number; y: number }
      facing?: Course
    }
  | { type: 'gunboat-attack'; squadronId: string; targetId: string }
  | { type: 'recover-gunboats'; squadronId: string; carrierId: string }

  // Boarding (phase 12)
  | { type: 'resolve-boarding' }

  // Threshold and repair (phases 13, 14)
  /** One ship's threshold point. Every ship that owes one, in one action. */
  | { type: 'threshold-check'; shipId: string }
  | { type: 'threshold-sweep' }
  | { type: 'assign-damage-control'; shipId: string; systemId: string; parties: number }
  /** Phase 14 sweep: every party that was assigned makes its roll. */
  | { type: 'resolve-damage-control' }
  | { type: 'resolve-reactor-explosions' }

  // Electronic warfare and cloaks (7.17 – 7.22)
  /**
   * 7.20: "the player must note this in orders for that turn, and the number
   * of turns the ship is to remain cloaked" — declared in advance, which is
   * what stops a ship decloaking "just because a juicy target has wandered
   * into range" (7.21). `turns` defaults to one.
   */
  | { type: 'set-cloak'; shipId: string; on: boolean; turns?: number }
  /**
   * 7.25: a Reflex Field is switched on in orders and costs the ship every
   * weapon it has for that turn. Its status is secret until someone shoots at
   * the ship, "by which time it may be too late".
   */
  | { type: 'set-reflex-field'; shipId: string; on: boolean }
  /**
   * 11.4: an exit is announced in orders and takes two turns — a warm-up turn
   * with no thrust and no offensive fire, then a half move on the present
   * course and the ship is gone for good.
   */
  | { type: 'plot-ftl-exit'; shipId: string; on: boolean }
  /**
   * 11.9 — "The player writes a 'Gate Activate' order at the beginning of the
   * turn". Written in phase 1; the roll comes when the order is announced in
   * phase 5, so nobody gets to see the initiative before deciding.
   */
  | { type: 'plot-gate-activation'; gateId: string; side: SideId; on: boolean }
  /** 11.9 — "and announces the activation when ships are moved". */
  | { type: 'announce-gate-activation'; gateId: string }
  /**
   * 11.9 — a ship comes onto the table through a gate, on the course opposite
   * the gate's facing and at a velocity up to its own drive rating.
   */
  | {
      type: 'gate-entry'
      shipId: string
      gateId: string
      velocity: number
      /** Required only for a gate usable from any angle, which has no facing. */
      course?: Course
    }
  /**
   * 11.9 — both ends of a Portal on the table: a ship goes in one and comes
   * out the other *"with the same velocity that it entered"*.
   */
  | { type: 'portal-hop'; shipId: string; gateId: string }
  /**
   * 11.9 — "At the end of the turn, the transfer takes place." The named ships
   * leave through the gate; whether they arrive is the gate's capacity's
   * business, and 1 is the good result.
   */
  | { type: 'gate-transfer'; gateId: string; shipIds: string[] }
  /**
   * 11.9 — an artificial gate has hull boxes and can be shot at. A natural one
   * *"cannot be destroyed by normal weapons fire"*.
   */
  | { type: 'fire-at-gate'; shipId: string; weaponId: string; gateId: string }
  /**
   * 11.7 — a battlerider lets go of its Mothership, or a tug drops its tow
   * (11.6). Written in orders, because the rider then flies its own move in
   * phase 5 and the enemy can shoot at it from that moment.
   */
  | { type: 'detach-hull'; shipId: string }
  /**
   * 11.7 — the defending player says which hull in an attached group the
   * damage goes on: *"Damage received can be applied to either the Mothership
   * or battleriders at the choice of the defending player."* `sinkId` is null
   * to put it back on the Mothership.
   */
  | { type: 'nominate-damage-sink'; shipId: string; sinkId: string | null }
  /**
   * 11.5 — a ship drops out of hyperspace onto the table. The entry point, the
   * course and the velocity are what the player wrote down; where the ship
   * actually appears is the scatter's business.
   */
  | {
      type: 'enter-from-ftl'
      shipId: string
      entryPoint: { x: number; y: number }
      course: Course
      velocity: number
    }
  /**
   * 16.7: a ram is declared in orders like any other move — *"Deliberate
   * attempts to ram another ship are possible"* but not as a reaction — and
   * resolved at the end of the movement phase, when both ships have arrived.
   */
  | { type: 'plot-ram'; shipId: string; targetId: string | null }
  /**
   * 17.9: *"a ship that has unused thrust points for changing course may use
   * them to change the gravity zone turn."* A magnitude; the direction is
   * never the player's, it is always towards the centre.
   */
  | { type: 'plot-gravity-turn'; shipId: string; points: number }
  /**
   * 16.6: *"the ship's movement orders must be plotted so that it ends up
   * within 3 MU of the target ship/starbase at the end of the turn"*. The
   * intent is written with the order; whether the approach worked is settled
   * when the ship has finished moving.
   */
  | { type: 'plot-dock'; shipId: string; targetId: string | null }
  /** 16.6: *"one full turn is also required to 'cast off' and undock again"*. */
  | { type: 'plot-cast-off'; shipId: string }
  /**
   * 16.4: *"move every ship and object in play a certain agreed distance back
   * towards the opposite table edge … effectively you can think of it as
   * extending the playing area under the ships."* The distance is the players',
   * because 16.4 names none.
   */
  | { type: 'shift-table'; crowding: 'top' | 'bottom' | 'left' | 'right'; distance: number }
  /**
   * 16.5: *"when all the ships are off the table edge, each player rolls a
   * D6"*. Declared by the side running away, once its last ship is clear and
   * they all went out by the same edge.
   */
  | { type: 'resolve-disengagement'; sideId: SideId }


/**
 * What an action did. `refused` means the action was illegal and nothing
 * changed — journalled all the same, and refused identically on replay.
 */
export interface ActionOutcome {
  refused?: string
  /** Log entries this action produced, for the effects layer to animate. */
  logged?: number
}

const OK: ActionOutcome = {}

function refuse(reason: string): ActionOutcome {
  return { refused: reason }
}

// ---------------------------------------------------------------------------
// Order plotting (3.5)
// ---------------------------------------------------------------------------

const BLANK_ORDER: MovementOrder = { turn: null, accel: 0 }

/**
 * 4.2's aft-arc ban: *"No ship may fire offensive weaponry through its aft arc
 * due to the interference of the ship's main drive."*
 *
 * This is a base rule, not an optional one — the optional rule is the
 * exception: *"Aft arc fire is permitted on any game turn in which the firing
 * ship did not use any thrust from its main drive to accelerate, decelerate,
 * or change course."* Point defence is exempt because PD is not offensive
 * weaponry and 4.2 gives systems with no directionality all-round fire.
 */
function aftArcBlocked(state: GameState, ship: ShipState, arc: Arc): boolean {
  if (arc !== 'A') return false
  if (!optional(state).aftArcFire) return true
  return ship.thrustUsed > 0
}

/**
 * A mounting's arcs as they actually bear (16.2, 4.2).
 *
 * *"Rolling has no effect on combat (except that the port batteries now bear
 * to starboard and vice versa)"* — so an inverted ship's guns are mirrored
 * through its long axis and nothing else about the shot changes. Every place
 * the engine asks whether a weapon covers an arc goes through here, because a
 * ship that rolls to bring its good broadside round and then finds the engine
 * still reading the printed arcs has been sold the manoeuvre and not given it.
 */
function bearingArcs(ship: ShipState, arcs: readonly Arc[]): readonly Arc[] {
  return ship.rollStatus.inverted ? arcsWhenInverted(arcs, true) : arcs
}

/** Orders are written in phase 1 and nowhere else (2.6). */
function orderable(state: GameState, ship: ShipState | undefined): ActionOutcome | ShipState {
  if (!ship) return refuse('No such ship')
  if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
  // 12.7: a prize "cannot be used in that combat", and that starts with the
  // order sheet.
  if (ship.captured) return refuse(`${ship.name} is a prize and takes no orders (12.7)`)
  if (state.phase !== 'orders') return refuse('Orders are written in phase 1')
  // 18.1 comes first, and a ship still in the wings has no station to plot a
  // course from. Gated on there being a deployment at all, so it is inert for
  // every scenario and every saved battle that has none.
  if (state.deployment && !state.deployment.placed.includes(ship.id)) {
    return refuse(`${ship.name} has not been deployed yet (18.1)`)
  }
  // 16.6: only a free ship writes an ordinary movement order. A held approach
  // is spent holding it, a docked ship is attached, and the cast-off turn is
  // spent casting off — *"after which the ship may maneuver as normal"*.
  if (!canManoeuvre(ship.dock)) {
    return refuse(`${ship.name} is ${ship.dock.phase.replace('-', ' ')} and cannot manoeuvre (16.6)`)
  }
  return ship
}

function movementStateOf(ship: ShipState): MovementState {
  return {
    placement: ship.placement,
    velocity: ship.velocity,
    drive: { ...driveFromDef(ship.design.drive), hits: ship.driveHits },
  }
}

function editOrder(
  state: GameState,
  shipId: string,
  edit: (order: MovementOrder) => MovementOrder,
): ActionOutcome {
  const found = orderable(state, shipById(state, shipId))
  if (!('id' in found)) return found
  const ship = found

  // 12.12 replaces 3.5's order entirely: a turn, an acceleration and emergency
  // thrust are all cinematic quantities, and a panel that still offered them
  // would be offering a manoeuvre the ship cannot make.
  if (optional(state).movementSystem === 'vector') {
    return refuse('This battle is fought under vector movement (12.12)')
  }
  const next = edit(ship.order ?? { ...BLANK_ORDER })
  const check = validateOrder(next, movementStateOf(ship))
  if (!check.legal) return refuse(check.violations[0] ?? 'Illegal order')

  ship.order = next
  return OK
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Apply one action. The single door every mutation goes through — the human,
 * the computer opponent and a remote peer all arrive here.
 */
export function applyAction(state: GameState, action: GameAction): ActionOutcome {
  switch (action.type) {
    // ── Sequence ──────────────────────────────────────────────────────────
    case 'advance-phase': {
      // 18.1 happens before the first order is written, so the turn cannot
      // start with ships still in the wings. The guard lives here rather than
      // in `advancePhase` because `advancePhase` is also the tests' and
      // `advanceToPhase`'s way round the sequence, and because `applyAction`
      // is the boundary — which is the whole point of it.
      const owed = shipsAwaitingDeployment(state)
      if (state.turn === 1 && owed.length > 0) {
        return refuse(`${owed.length} ships are still to be deployed (18.1)`)
      }
      // 16.6 tests where a ship "ends up … at the end of the turn", and against
      // a target that is itself under way that cannot be answered until both
      // have moved. So the approach is settled as the movement phase closes,
      // not as each ship arrives.
      if (state.phase === 'move-ships') {
        for (const ship of state.ships) resolveDockingApproach(state, ship)
        // 6.9: a mine fires on the move that passed it, and "after a mine has
        // detonated, remove its marker from the table at the end of the
        // movement phase" — which is here.
        resolveMines(state)
      }
      // 17.5: a hull that has just been overkilled may come apart. Swept at the
      // boundary so that every way of dying reaches it, rather than at the
      // seven separate places a ship can be destroyed.
      sweepDebris(state)
      const turnBefore = state.turn
      advancePhase(state)
      if (state.phase === 'move-ships') driftDebris(state)
      // 17.3 dices "for each turn", so the star gets its roll as the turn
      // opens — before anyone writes an order they might have written
      // differently with a FireCon still on the board.
      if (state.turn !== turnBefore) rollSolarFlares(state)
      return OK
    }

    // ── Deployment (18.1) ─────────────────────────────────────────────────
    case 'roll-deployment-order': {
      const deployment = state.deployment
      if (!deployment) return refuse('This battle has no deployment step')
      if (state.turn !== 1 || state.phase !== 'orders') {
        return refuse('Ships are deployed before the first orders are written (18.1)')
      }
      if (deployment.order.length > 0) return refuse('Deployment order has already been rolled')

      // 4.12: "Both players roll a die. The player with the lowest roll sets up
      // one heavy cruiser. The player with the higher roll then sets up one."
      // Section 18 rolls nothing at all, so this die is 4.12's.
      const rolls = state.sides.map((side) => ({ id: side.id, roll: d6(state.rng) }))
      // Ties are broken by re-rolling among the tied sides, the way initiative
      // is (2.6 phase 2), so the order is always total.
      let guard = 20
      while (guard-- > 0) {
        const clash = rolls.find((a, i) => rolls.some((b, j) => i !== j && b.roll === a.roll))
        if (!clash) break
        const lowest = Math.min(...rolls.map((r) => r.roll))
        for (const entry of rolls) {
          if (rolls.filter((r) => r.roll === entry.roll).length > 1) {
            entry.roll = lowest + d6(state.rng) / 10
          }
        }
      }
      deployment.order = [...rolls].sort((a, b) => a.roll - b.roll).map((r) => r.id)
      pushLog(state, {
        kind: 'orders',
        dice: rolls.map((r) => Math.round(r.roll)),
        text:
          `Deployment order (4.12): ` +
          deployment.order
            .map((id) => state.sides.find((s) => s.id === id)?.name ?? id)
            .join(', then '),
      })
      return OK
    }

    case 'deploy-ship': {
      const deployment = state.deployment
      if (!deployment) return refuse('This battle has no deployment step')
      if (state.turn !== 1 || state.phase !== 'orders') {
        return refuse('Ships are deployed before the first orders are written (18.1)')
      }
      if (deployment.order.length === 0) return refuse('Roll for who places first (4.12)')

      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (deployment.placed.includes(ship.id)) return refuse(`${ship.name} is already deployed`)

      const turnOf = deployingSide(state)
      if (turnOf !== null && turnOf !== ship.side) {
        const name = state.sides.find((s) => s.id === turnOf)?.name ?? turnOf
        return refuse(`It is ${name}'s turn to place (18.1)`)
      }

      const zone = deployment.zones[ship.side]
      if (!zone) return refuse('That side has no deployment zone')
      const check = validatePlacement(zone, {
        position: action.position,
        facing: action.facing,
        velocity: action.velocity,
      })
      if (!check.legal) return refuse(check.reasons[0] ?? 'Not a legal deployment')
      if (!Number.isInteger(action.velocity) || action.velocity < 0) {
        return refuse('Velocity is a whole number and 3.1 has no reverse')
      }

      ship.placement = { position: { ...action.position }, facing: action.facing }
      ship.velocity = action.velocity
      // A wing still in the bay goes where the ship goes — the same reason
      // `move-ship` drags it, and the same three lines.
      for (const group of state.fighterGroups) {
        if (group.carrierId === ship.id && group.status === 'aboard') {
          group.position = ship.placement.position
          group.facing = ship.placement.facing
        }
      }
      for (const squadron of state.gunboatSquadrons) {
        if (squadron.carrierId === ship.id && squadron.status === 'aboard') {
          squadron.position = ship.placement.position
          squadron.facing = ship.placement.facing
        }
      }
      deployment.placed.push(ship.id)
      pushLog(state, {
        kind: 'orders',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} deploys at velocity ${action.velocity}, course ${action.facing} (18.1)`,
      })
      return OK
    }

    case 'place-terrain': {
      const deployment = state.deployment
      if (!deployment) return refuse('This battle has no deployment step')
      if (deployment.battleType !== 'offensive-defensive') {
        return refuse('Only the defender in an offensive/defensive battle places terrain (18.1)')
      }
      if (state.turn !== 1 || state.phase !== 'orders') {
        return refuse('Terrain is placed at deployment (18.1)')
      }
      if (deployment.terrainPlaced) {
        return refuse('The defender has already placed a feature (18.1)')
      }
      const defender = defendingSide(state)
      if (defender === null || action.sideId !== defender) {
        return refuse('Only the defending fleet places terrain (18.1)')
      }
      if (!(action.radius > 0)) return refuse('A feature needs a radius')

      state.terrain.push({
        id: 'deployed-terrain',
        kind: action.kind,
        position: { ...action.position },
        radius: action.radius,
        label: `${action.kind.replace('-', ' ')} (18.1)`,
      })
      deployment.terrainPlaced = true
      pushLog(state, {
        kind: 'orders',
        side: action.sideId,
        text: `The defender places a ${action.kind.replace('-', ' ')} (18.1)`,
      })
      return OK
    }

    case 'signal-ready': {
      const side = state.sides.find((s) => s.id === action.side)
      if (!side) return refuse('No such side')
      readySides(state)[action.side] = action.ready
      return OK
    }

    case 'roll-initiative': {
      if (state.phase !== 'initiative') return refuse('Initiative is rolled in phase 2')
      rollInitiative(state)
      return OK
    }

    case 'set-initiative-order': {
      if (state.phase !== 'initiative') return refuse('Initiative is rolled in phase 2')
      return setInitiativeOrder(state, action.order) ? OK : refuse('Not a valid initiative order')
    }

    case 'rename-ship': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      // Trimmed and capped: a name rides in every save and every log line.
      const name = action.name.trim().slice(0, 40)
      if (!name) return refuse('A ship needs a name')
      ship.name = name
      return OK
    }

    // ── Orders (3.5) ──────────────────────────────────────────────────────
    case 'plot-turn':
      return editOrder(state, action.shipId, (order) => ({
        ...order,
        turn: action.direction ? { direction: action.direction, points: action.points } : null,
      }))

    case 'plot-second-turn':
      return editOrder(state, action.shipId, (order) => ({
        ...order,
        secondTurn: action.direction
          ? { direction: action.direction, points: action.points }
          : null,
      }))

    case 'plot-accel':
      return editOrder(state, action.shipId, (order) => ({ ...order, accel: action.accel }))

    case 'plot-emergency-thrust':
      return editOrder(state, action.shipId, (order) => ({
        ...order,
        emergencyThrust: action.on,
      }))

    case 'plot-roll':
      return editOrder(state, action.shipId, (order) => ({ ...order, roll: action.on }))

    case 'plot-mines': {
      const found = orderable(state, shipById(state, action.shipId))
      if (!('id' in found)) return found
      found.layingMines = action.on
      return OK
    }

    /**
     * 17.11: *"To make a deliberate safe atmospheric entry, a ship must first
     * enter orbit as described above and then decelerate to less than orbital
     * velocity."*
     *
     * Declared, because 17.8 makes exactly the same manoeuvre a disaster when
     * it was not meant: without this the deceleration is a decaying orbit and
     * the atmosphere rolls for the hull.
     */
    case 'plot-landing': {
      const found = orderable(state, shipById(state, action.shipId))
      if (!('id' in found)) return found
      if (action.on && !found.orbit) {
        return refuse(`${found.name} must be in orbit before it can land (17.11)`)
      }
      if (action.on) {
        const orbit = orbitOf(state, found)
        if (orbit && orbit.feature.orbit?.landable === false) {
          return refuse(`${orbit.feature.label ?? 'That world'} cannot be landed on (17.8)`)
        }
      }
      found.landing = action.on
      return OK
    }

    /**
     * Bringing a ship back (3.9, 17.7).
     *
     * Two rules answer this and they answer it differently. 3.9 is a patch of
     * open space: *"ships will always re-enter play from the same side of the
     * playing area as they left"*, after the turns its die bought. 17.7 is an
     * orbital table, where leaving is a lap of the planet: the ship comes back
     * *"on the opposite edge, at the same velocity and course, and within 6 MU
     * of the same distance from the diagonally opposite corner edge"*.
     *
     * Both are placements made *"before orders"*, which is phase 1.
     */
    case 'return-to-table': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (state.phase !== 'orders') return refuse('A ship is placed back before orders (3.9, 17.7)')
      if (ship.destroyed) return refuse('Ship is out of the battle')
      if (!ship.offTable) return refuse(`${ship.name} is already on the table`)
      if (ship.landed) return refuse(`${ship.name} is on the surface`)
      if (ship.reentryTurn === null) return refuse(`${ship.name} is not coming back`)
      if (state.turn < ship.reentryTurn) {
        return refuse(`${ship.name} may not return until turn ${ship.reentryTurn}`)
      }

      const bounds = tableBounds(state)
      const position = action.position
      if (isOffTable(position, bounds)) return refuse('That is off the table')

      const departure = ship.departure
      if (optional(state).orbitalTable && departure) {
        if (!ship.exitEdge) return refuse('No record of which edge it left by')
        const edge = oppositeEdge(ship.exitEdge)
        if (!onEdge(position, edge, bounds)) {
          return refuse(`${ship.name} comes back on the ${edge} edge (17.7)`)
        }
        const corner = oppositeCorner(departure.corner)
        const measured = distance(position, cornerPoint(corner, bounds))
        if (!orbitReentryPlacementLegal(departure.cornerDistance, measured)) {
          return refuse(
            `${measured.toFixed(1)} MU from the ${corner} corner, against ` +
              `${departure.cornerDistance.toFixed(1)} at exit — 17.7 allows 6`,
          )
        }
        // "At the same velocity and course": a lap of the planet is not a
        // chance to re-plot.
        ship.placement = { position, facing: departure.course }
        ship.velocity = departure.velocity
        ship.departure = null
      } else {
        if (!ship.exitEdge) return refuse('No record of which edge it left by')
        if (!onEdge(position, ship.exitEdge, bounds)) {
          return refuse(`${ship.name} re-enters by the ${ship.exitEdge} edge it left by (3.9)`)
        }
        ship.placement = { ...ship.placement, position }
      }

      ship.offTable = false
      ship.exitEdge = null
      ship.reentryTurn = null
      pushLog(state, {
        kind: 'move',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} comes back onto the table at velocity ${ship.velocity}`,
      })
      return OK
    }
    case 'plot-vector-orders': {
      if (optional(state).movementSystem !== 'vector') {
        return refuse('This battle is fought under cinematic movement (3.1)')
      }
      const found = orderable(state, shipById(state, action.shipId))
      if (!('id' in found)) return found
      const ship = found
      for (const order of action.orders) {
        if (!VECTOR_ORDER_KINDS.includes(order.kind)) return refuse(`${order.kind} is not an order`)
        if (!Number.isInteger(order.points) || order.points < 0) {
          return refuse('An order is written in whole points')
        }
      }
      // 12.12 has no penalty clause for an over-budget sheet — `moveVector`
      // flies it as an empty one — but a player writing the sheet should be
      // told at the moment they overspend, not next phase when the ship coasts.
      const drive = { rating: ship.design.drive.thrust, hits: ship.driveHits }
      const check = validateVectorOrders(action.orders, drive)
      if (!check.legal) return refuse(check.problems[0] ?? 'That sheet overruns the drive')
      ship.vectorOrders = action.orders.map((order) => ({ ...order }))
      return OK
    }

    case 'clear-order': {
      const found = orderable(state, shipById(state, action.shipId))
      if (!('id' in found)) return found
      found.order = null
      found.vectorOrders = null
      return OK
    }

    // ── Movement (phase 5) ────────────────────────────────────────────────
    case 'move-ship': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (state.phase !== 'move-ships') return refuse('Ships move in phase 5')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (ship.captured) return refuse(`${ship.name} is a prize and does not move (12.7)`)
      if (ship.carriedBy !== null) {
        const carrier = shipById(state, ship.carriedBy)
        return refuse(
          `${ship.name} is riding ${carrier?.name ?? 'another hull'} and does not fly its own move (11.7)`,
        )
      }
      // `lastKnown` is stamped with the turn as the ship moves, so it doubles
      // as the has-moved flag and survives replay without extra state.
      if (ship.lastKnown?.turn === state.turn) return refuse('Already moved this turn')

      // 11.4: a ship on its way into hyperspace holds course and velocity —
      // "The ship may not apply any thrust in that move" — and on the second
      // turn it half-moves and is gone. Both legs ignore whatever was plotted.
      const ftl = ftlStageOf(ship, state.turn)
      if (ftl === 'jumping') return jumpToFtl(state, ship)

      // 17.8: a ship in orbit is not flown. It goes round the track at the
      // orbit speed and the only order that reaches it is the throttle.
      if (ship.orbit) return moveInOrbit(state, ship)

      // 17.9: a change earned by ending last turn inside a zone lands "at the
      // start of the next turn movement", which is here, before anything else.
      applyPendingGravity(state, ship)

      if (optional(state).movementSystem === 'vector') {
        return moveUnderVector(state, ship, ftl === 'warming-up')
      }

      // A ship with no written order holds its course: velocity is conserved
      // and it must move its full velocity anyway (3.1).
      const order = ftl === 'warming-up' ? BLANK_ORDER : (ship.order ?? BLANK_ORDER)
      const before = movementStateOf(ship)

      // Emergency thrust is checked immediately after orders are written, and
      // a failure forces a re-plot under the standard limits (3.6). Rolling it
      // here — at the moment the ship moves — keeps the RNG draw in a fixed
      // place in the stream, which is what makes the replay exact.
      let effective = order
      if (order.emergencyThrust) {
        const et = rollEmergencyThrust(order, before.drive, state.rng)
        pushLog(state, {
          kind: 'move',
          text: `${ship.name} runs the drive hot: ${et.outcome}`,
          dice: et.rolls,
          shipId: ship.id,
        })
        if (et.driveHits > 0) ship.driveHits += et.driveHits
        if (et.mustReplot) effective = { ...order, emergencyThrust: false }
      }

      // 7.21, 7.22: a total cloak goes up before the ship moves — "At the
      // start of its movement for that turn, the ship model is removed from
      // the table" — and 7.20's Device goes up after. Both are handled by the
      // module; here they simply bracket the move.
      if (ship.cloak) {
        ship.cloak = cloakStartOfMovement(ship.cloak, ship.placement.position)
        ship.cloaked = cloakMode(ship.cloak) !== 'none'
      }

      const result = applyOrder(movementStateOf(ship), effective)

      // 16.2: "The roll then occurs at the start of the ship's movement." It
      // is read off `flown` rather than off the written order because 3.5
      // throws an illegal order away entirely — a ship that could not pay for
      // its plot does not get the free half of it.
      if (result.flown.roll === true) {
        ship.rollStatus = rollShip(ship.rollStatus, state.turn)
        pushLog(state, {
          kind: 'move',
          shipId: ship.id,
          side: ship.side,
          text: ship.rollStatus.inverted
            ? `${ship.name} rolls inverted — port and starboard batteries swap (16.2)`
            : `${ship.name} rolls upright (16.2)`,
        })
      }

      ship.lastKnown = {
        course: ship.placement.facing,
        velocity: ship.velocity,
        turn: state.turn,
        cloaked: ship.cloaked,
      }
      ship.placement = result.placement
      ship.velocity = result.velocity
      // 4.2's optional exception and 8.3's scramble both turn on whether the
      // ship touched its drive this turn, so the figure is recorded here — the
      // one place a ship's thrust is actually spent. An illegal plot is flown
      // as STRAIGHT_AHEAD (3.5), which spends nothing.
      ship.thrustUsed = result.legal ? result.budget.totalUsed : 0
      // A wing still in the bay goes where the ship goes. Nothing in section 8
      // says so because on a real table the counters are the same counter —
      // but here they are two, and a group left behind at last turn's station
      // would launch into empty space.
      for (const group of state.fighterGroups) {
        if (group.carrierId === ship.id && group.status === 'aboard') {
          group.position = ship.placement.position
          group.facing = ship.placement.facing
        }
      }
      if (ship.cloak) {
        const wasCloaked = ship.cloaked
        const after = cloakEndOfMovement(ship.cloak, { velocity: ship.velocity })
        ship.cloak = after
        ship.cloaked = cloakMode(after) !== 'none'
        if (ship.cloaked !== wasCloaked) {
          pushLog(state, {
            kind: 'note',
            shipId: ship.id,
            side: ship.side,
            text: ship.cloaked
              ? `${ship.name} cloaks (7.20)`
              : `${ship.name} decloaks` +
                (after.voidedBy === 'over-speed' ? ' — over 24 MU voids the cloak (7.20)' : ''),
          })
        }
      }
      pushLog(state, {
        kind: 'move',
        text: `${ship.name} ${formatOrder(effective, before.velocity)}`,
        side: ship.side,
      })
      // 17.6 tests "its path during the Ship Movement Phase", so the track is
      // the whole two-leg cinematic path (3.4), not the endpoints. Resolved
      // before the ram, because a ship that flew into a planetoid does not go
      // on to hit anything else — and after the gravity, because a pass that
      //17.9 turned is a partial orbit and cannot hit the planet it went round.
      const track = [before.placement.position, ...result.legs.map((leg) => leg.to)]
      const swung = resolveGravity(state, ship, track)
      // 17.8's track is the planet's own edge, so a ship that met it has
      // already had its answer — orbit, a decaying orbit or the atmosphere —
      // and there is nothing left for 17.6's collision to say about it.
      // 6.9 fires a mine on anything that "enter[ed] the radius … at any point
      // during movement", so the whole flown path is kept until every ship has
      // moved and the mines can be answered together.
      tracksOf(state).set(ship.id, track)
      dropMines(state, ship, track)
      const metTrack = resolveOrbitEntry(state, ship, track)
      if (!metTrack) {
        resolveTerrainHazards(state, ship, track, { shielded: swung })
        resolveDeclaredRam(state, ship)
        resolveLeavingTable(state, ship)
      }
      dragDockedShips(state, ship)
      dragCarriedHulls(state, ship)
      dragEscortingFlights(state, ship)
      return OK
    }

    // ── Targeting (4.4) ───────────────────────────────────────────────────
    case 'assign-firecon': {
      const ship = shipById(state, action.shipId)
      const target = shipById(state, action.targetId)
      if (!ship || !target) return refuse('No such ship')
      if (ship.destroyed || target.destroyed) return refuse('Ship is out of the battle')
      return assignFireCon(ship, action.targetId, state.phase)
        ? OK
        : refuse('No FireCon available')
    }

    case 'clear-firecons': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      ship.fireconAssignments = ship.fireconAssignments.filter((a) => a.phase !== state.phase)
      return OK
    }

    // ── Damage control (10.4, phase 14) ───────────────────────────────────
    case 'assign-damage-control': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (state.phase !== 'damage-control') return refuse('Repairs are made in phase 14')
      const assigned = assignDamageControl(ship, action.systemId, action.parties)
      return assigned === action.parties ? OK : refuse('Not enough damage control parties')
    }

    // ── Fire (4.4 – 4.9, phase 11) ────────────────────────────────────────
    case 'fire-weapon': {
      const ship = shipById(state, action.shipId)
      const target = shipById(state, action.targetId)
      if (!ship || !target) return refuse('No such ship')
      if (state.phase !== 'ship-fire') return refuse('Ships fire in phase 11')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (ship.side === target.side) return refuse('That is a friendly ship')
      // 2.6's one firing activation a turn, checked before any of it is spent.
      const spentAlready = openFiringActivation(state, ship)
      if (spentAlready) return spentAlready
      // 11.7: "Until they detach, only the Mothership can be fired at." Shoot
      // at the Mothership; where the damage lands is the defender's call.
      if (target.carriedBy !== null) {
        const carrier = shipById(state, target.carriedBy)
        return refuse(
          `${target.name} is attached to ${carrier?.name ?? 'another hull'}; only the Mothership can be fired at (11.7)`,
        )
      }
      // A rider fires its own guns while attached — 11.7 restricts what may be
      // fired AT the group, not what the group may fire.

      // 7.25: a ship running its Reflex Field "may not use any weaponry of its
      // own that turn", and 7.20 says the same of a cloaked one. 10.3 says it
      // of a ship whose bridge has gone: "While a ship is out of control it
      // will continue on its present course and velocity, and may not fire
      // weapons, launch fighters, or take any other offensive action."
      // 12.7: "While the ship is captured, the ship cannot be used in that
      // combat." Not its guns, not its drive, not its orders.
      if (ship.captured) return refuse(`${ship.name} is a prize and out of the fight (12.7)`)
      if (ship.reflexFieldActive) return refuse(`${ship.name} is running its Reflex Field (7.25)`)
      if (ship.cloaked) return refuse(`${ship.name} is cloaked and cannot fire (7.20)`)
      if (isOutOfControl(ship, state.turn)) {
        return refuse(`${ship.name} is out of control and cannot fire (10.3)`)
      }
      // 11.4: a ship on its way into hyperspace "may not... use any offensive
      // weaponry or ADFC" from the moment the drive starts spinning up.
      if (ftlStageOf(ship, state.turn) !== null) {
        return refuse(`${ship.name} is entering hyperspace and cannot fire (11.4)`)
      }

      const weapon = ship.design.weapons.find((w) => w.id === action.weaponId)
      if (!weapon) return refuse('No such weapon')
      if (ship.destroyedSystems.has(weapon.id)) return refuse('That weapon is knocked out')
      // 2.6: a weapon fires once a turn, and point defence in phase 9 spends it.
      if (!canWeaponFire(ship, weapon.id)) return refuse('That weapon has already fired')

      // Everything the resolver needs is re-derived here rather than carried in
      // the payload, so a stale or edited action cannot make a replay disagree.
      //
      // The geometry is checked BEFORE a FireCon is claimed, and the order is
      // the point: 4.4 spends a FireCon to engage a target, and a shot that
      // cannot be taken at all never engaged anything. Claiming it first meant
      // a mistaken click — wrong arc, or a rock in the way — quietly cost the
      // ship a target it could have held.
      const rules = optional(state)
      // 17.8: "Ships in orbit may fire at any ships outside the orbit track, or
      // at ships at the point immediately in front or behind." A ship on the
      // far side of the world is behind the world.
      if (
        ship.orbit &&
        !canFireFromOrbit(ship.orbit.marker, {
          inOrbit: target.orbit?.featureId === ship.orbit.featureId,
          marker: target.orbit?.marker,
        })
      ) {
        return refuse(`${target.name} is round the other side of the track (17.8)`)
      }
      // Two hulls sharing a marker fight at arm's length: "they may fire at
      // each other as if at 1 MU range, through any arc the firing ship
      // chooses" (17.8).
      // Both on the same track. 17.8 has already said which of these shots are
      // allowed, and the world they are both standing on is not cover between
      // them: a neighbour is a neighbour.
      const alongTrack = ship.orbit !== null && target.orbit?.featureId === ship.orbit.featureId
      const samePoint = alongTrack && target.orbit?.marker === ship.orbit?.marker
      const range = samePoint
        ? ORBIT_SAME_POINT_RANGE
        : distance(ship.placement.position, target.placement.position)
      const arc = samePoint
        ? (bearingArcs(ship, weapon.arcs)[0] ?? 'F')
        : arcTo(ship.placement.position, ship.placement.facing, target.placement.position)
      if (!bearingArcs(ship, weapon.arcs).includes(arc)) {
        return refuse('Target is not in that arc')
      }
      if (aftArcBlocked(state, ship, arc)) {
        return refuse(`${ship.name} cannot fire through its own drive plume (4.2)`)
      }
      // 17.1: a planet or planetoid across the line stops the shot. Measured
      // centre to centre, because that is how the models are measured.
      if (
        !alongTrack &&
        !hasLineOfFire(ship.placement.position, target.placement.position, blockingTerrain(state))
      ) {
        return refuse(`${target.name} is behind cover (17.1)`)
      }

      // 4.4: each FireCon engages one target. A weapon may join a target the
      // ship is already engaging for free; a new target costs a FireCon.
      if (needsFireCon(weapon) && !engagedTargets(ship, state.phase).includes(target.id)) {
        if (!assignFireCon(ship, target.id, state.phase)) return refuse('No FireCon available')
      }

      // 17.2 rules 2 and 3. The lock-on is one die per target nomination, not
      // per weapon, so the answer is remembered for the rest of the phase.
      const dust = cloudLockOn(state, ship, target, weapon)
      if (dust && !dust.locked) {
        markWeaponFired(ship, weapon.id, state.phase)
        pushLog(state, {
          kind: 'fire',
          shipId: ship.id,
          targetId: target.id,
          side: ship.side,
          dice: dust.roll === null ? undefined : [dust.roll],
          text: `${ship.name}: ${weapon.label} cannot see ${target.name} — ${dust.reason}`,
        })
        return OK
      }

      // 7.17 – 7.22: what the target's electronic warfare fit does to this
      // particular shot. It can change the range as well as the die roll — a
      // Holofield adds 12 MU against a to-hit table and a Cloaking Device
      // doubles it — so the effect is computed before the shot, not applied
      // to its result.
      const ew = ewFireEffect(
        {
          range,
          usesBeamDice: rollsBeamDice(weapon),
          areaEffect: isAreaEffect(weapon),
          gravitonBeam: weapon.weaponClass === 'gravitic-gun',
          needleBeam: weapon.weaponClass === 'needle-beam',
          maxRange: maxRangeOf(weapon),
        },
        ewDefencesOf(state, target),
      )
      if (ew.untargetable) {
        return refuse(`${target.name} is not on the table (7.21)`)
      }
      // 7.4, 7.5: stealth shrinks the attacker's range brackets, which is the
      // same arithmetic as stretching the range — a Stealth-1 target 12 MU
      // away is ranged as though it were at 14.4. Applied AFTER the electronic
      // warfare stack rather than before it, so the holofield's "ignored
      // inside 6 MU" test still measures the true distance (7.17).
      const stealth = stealthLevelOf(target)
      const rangeToUse = stealth > 0 ? ew.effectiveRange / STEALTH_BAND_SCALE[stealth] : ew.effectiveRange
      if (stealth > 0 && rangeToUse > maxRangeOf(weapon)) {
        markWeaponFired(ship, weapon.id, state.phase)
        pushLog(state, {
          kind: 'fire',
          shipId: ship.id,
          targetId: target.id,
          side: ship.side,
          text: `${ship.name}: ${weapon.label} cannot range ${target.name} — Stealth-${stealth} (7.4)`,
        })
        return OK
      }
      if (ew.autoMiss) {
        markWeaponFired(ship, weapon.id, state.phase)
        pushLog(state, {
          kind: 'fire',
          shipId: ship.id,
          targetId: target.id,
          side: ship.side,
          text: `${ship.name}: ${weapon.label} misses — ${ew.modifiers.map((m) => m.label).join('; ')}`,
        })
        return OK
      }

      const result = fireWeapon(weapon, {
        range: rangeToUse,
        arc,
        // 17.2 rule 3: a cloud is worth one screen level against a beam or a
        // graser, capped at 2 — which is why it is worth least to the ship
        // that needed it least.
        targetScreens: dust ? dust.screens : effectiveScreenLevel(target),
        rearArc: isRearArcAttack(
          target.placement.position,
          target.placement.facing,
          ship.placement.position,
        ),
        // 5.13: which system the needle is aimed at. Without one the resolver
        // scores damage and kills nothing, and 7.17 and 7.20 refuse the kill
        // anyway against a holofield or a cloak.
        needleTarget: action.systemId,
        // 12.10: "all ships and squadrons roll a +1 on their direct fire
        // weapons. The crews of these ships are well aware of the enemy ships
        // vulnerable areas." Direct fire only — not ordnance, not point
        // defence, not fighters, none of which is helped by knowing where the
        // hull is thin.
        drm: ew.drm + civilWarDrm(civilWarHere(state), isOrdnance(weapon) ? 'ordnance' : 'direct-fire'),
        // Everything `KineticContext` adds to a firing context, re-derived
        // from the game as rule 1 of the journal requires. None of it was ever
        // supplied, so 7.3's Advanced Screens protected nothing against a
        // pulse torpedo, a submunition pack or an MKP — a ship that paid half
        // again for the better screen got exactly the worse one — and a
        // Gravitic Gun read its target's velocity as zero.
        advancedScreens: target.design.screens.advanced,
        targetVelocity: target.velocity,
        // 5.23's PSP scales its damage dice on the target's mass, so this one
        // changes how many dice a shot throws and is stamped: an older battle
        // replays on the mass-50 default it was fought under.
        targetMass: rulesReading(state) >= 2 ? target.design.mass : undefined,
        rng: state.rng,
      })
      markWeaponFired(ship, weapon.id, state.phase)

      if ('refused' in result) {
        pushLog(state, {
          kind: 'fire',
          shipId: ship.id,
          targetId: target.id,
          side: ship.side,
          text: `${ship.name}: ${weapon.label} holds fire — ${result.refused}`,
        })
        return OK
      }

      // 7.25: the damage is rolled first, then the field's own die decides how
      // much of it lands and how much comes back.
      const reflected = reflexField(state, ship, target, weapon, result)
      const applied = applyDamage(targetStateOf(target), reflected.result, {
        rearArcRule: rules.rearArcAttacks,
        rearArc: isRearArcAttack(
          target.placement.position,
          target.placement.facing,
          ship.placement.position,
        ),
        source: 'direct-fire',
      })
      writeBackDamage(target, applied.target)
      // 5.13: "On a roll of a natural 6 they inflict a single point of damage,
      // and destroy the targeted system", and what a needle beam kills
      // "cannot be repaired by Damage Control Parties". The resolver has
      // already applied 7.17's and 7.20's blocks and the sensor proviso; what
      // arrives here is a system that is genuinely gone.
      for (const systemId of reflected.result.targetedSystems ?? []) {
        destroySystem(target, systemId)
        target.unrepairable.add(systemId)
        pushLog(state, {
          kind: 'damage',
          shipId: target.id,
          side: target.side,
          text: `${weapon.label} picks out ${target.name}'s ${systemId} — beyond repair (5.13)`,
        })
      }
      // markHullBoxes owns the row accounting and the pending threshold, so
      // the hull damage goes through it rather than being written directly.
      markHullBoxes(target, applied.hullDamage)
      // 5.9: "Every hit generated allows the player to send one unit of
      // Marines or a Damage Control Party over to the enemy ship"; 5.18: "two
      // 'Marine' markers are placed on the enemy ship". Landing them is where
      // the source stops — see the boarding phase.
      landBoarders(state, ship, target, applied.boarders ?? 0)

      pushLog(state, {
        kind: applied.hullDamage > 0 ? 'damage' : 'fire',
        shipId: ship.id,
        targetId: target.id,
        side: ship.side,
        dice: result.dice,
        text: `${ship.name} fires ${weapon.label} at ${target.name}: ${result.detail}`,
      })
      if (reflected.back > 0) {
        // The energy that came back is applied like any other direct fire, to
        // the ship that sent it (7.25).
        const onShooter = applyDamage(
          targetStateOf(ship),
          { ...reflected.result, normalDamage: reflected.back, penetratingDamage: 0 },
          { rearArcRule: false, rearArc: false, source: 'direct-fire' },
        )
        writeBackDamage(ship, onShooter.target)
        markHullBoxes(ship, onShooter.hullDamage)
        if (ship.destroyed) {
          pushLog(state, {
            kind: 'destroyed',
            shipId: ship.id,
            text: `${ship.name} is destroyed by its own fire`,
          })
        }
      }
      if (target.destroyed) {
        pushLog(state, { kind: 'destroyed', shipId: target.id, text: `${target.name} is destroyed` })
      }
      return OK
    }

    case 'pass-fire': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (state.phase !== 'ship-fire') return refuse('Ships fire in phase 11')
      // Holding fire spends the activation exactly as firing does: 2.6 gives a
      // ship one, and choosing not to use it is using it.
      markShipFired(ship)
      FIRING_ACTIVATION.delete(state)
      return OK
    }

    // ── Ordnance (6, phases 3, 5, 9 and 10) ───────────────────────────────
    case 'launch-ordnance': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (state.phase !== 'launch-missiles') return refuse('Missiles launch in phase 3')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')

      const weapon = ship.design.weapons.find((w) => w.id === action.weaponId)
      if (!weapon) return refuse('No such weapon')
      if (ship.destroyedSystems.has(weapon.id)) return refuse('That launcher is knocked out')
      if (!canWeaponFire(ship, weapon.id)) return refuse('That launcher has already fired')

      const kind = missileKindOf(weapon.weaponClass)
      if (!kind) return refuse(`${weapon.label} is not a missile launcher`)

      const markers = ordnanceOf(state)
      const result = launchMissile({
        id: `ord-${state.turn}-${markers.length + 1}-${ship.id}-${weapon.id}`,
        owner: ship.side,
        sourceShipId: ship.id,
        sourceWeaponId: weapon.id,
        kind,
        grade: weapon.variant === 'extended' ? 'extended' : 'standard',
        stages: weapon.variant === 'two-stage' ? 2 : 1,
        origin: { position: ship.placement.position, facing: ship.placement.facing },
        arcs: bearingArcs(ship, weapon.arcs),
        aim: action.aimPoint,
        turn: state.turn,
        fireConsAvailable: availableFireCons(ship, state.phase),
      })

      markWeaponFired(ship, weapon.id, state.phase)
      if (!result.marker) {
        pushLog(state, {
          kind: 'launch',
          shipId: ship.id,
          side: ship.side,
          text: `${ship.name}: ${weapon.label} does not launch — ${result.detail}`,
        })
        return OK
      }
      markers.push(result.marker)
      projectOrdnance(state)
      pushLog(state, {
        kind: 'launch',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} launches ${weapon.label}: ${result.detail}`,
      })
      return OK
    }

    /**
     * 6.7: *"Select an enemy ship within range and firing arc of the rocket
     * pod. The Rocket Pod fires TWO rockets at the target ship."*
     *
     * A separate action from `launch-ordnance` because a rocket pod is not a
     * seeker: it names a ship rather than an aim point, both dice are rolled
     * here in phase 3, and what flies on is the hits — a marker sitting on the
     * target that can be shot down in phase 9 like anything else.
     */
    case 'fire-rocket-pod': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (state.phase !== 'launch-missiles') return refuse('Rocket pods fire in phase 3')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')

      const weapon = ship.design.weapons.find((w) => w.id === action.weaponId)
      if (!weapon) return refuse('No such weapon')
      if (weapon.weaponClass !== 'rocket-pod') return refuse(`${weapon.label} is not a rocket pod`)
      if (ship.destroyedSystems.has(weapon.id)) return refuse('That pod is knocked out')
      if (!canWeaponFire(ship, weapon.id)) return refuse('That pod has already fired')

      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (target.side === ship.side) return refuse('That is a friendly ship')

      const markers = ordnanceOf(state)
      const result = fireRocketPod(
        {
          id: `rkt-${state.turn}-${markers.length + 1}-${ship.id}-${weapon.id}`,
          owner: ship.side,
          sourceShipId: ship.id,
          sourceWeaponId: weapon.id,
          origin: { position: ship.placement.position, facing: ship.placement.facing },
          arcs: bearingArcs(ship, weapon.arcs),
          target: {
            id: target.id,
            position: target.placement.position,
            facing: target.placement.facing,
            kind: 'ship',
          },
          turn: state.turn,
        },
        state.rng,
      )

      markWeaponFired(ship, weapon.id, state.phase)
      if (!result.marker) {
        pushLog(state, {
          kind: 'launch',
          shipId: ship.id,
          side: ship.side,
          dice: result.rolls,
          text: `${ship.name}: ${weapon.label} scores nothing on ${target.name} — ${result.detail}`,
        })
        return OK
      }
      markers.push(result.marker)
      projectOrdnance(state)
      pushLog(state, {
        kind: 'launch',
        shipId: ship.id,
        side: ship.side,
        dice: result.rolls,
        text: `${ship.name} fires ${weapon.label} at ${target.name}: ${result.detail}`,
      })
      return OK
    }

    /**
     * 6.8: *"The PBL is fired during the Ordnance Launch Phase. A marker
     * showing the detonation point is placed anywhere within arc and line of
     * sight of the launcher, out to a range of 30 MU."*
     *
     * Not aimed at a ship: the bolt goes where the player says and detonates
     * there in phase 10, on whatever is inside six MU of it by then — which is
     * why it is worth shooting at in phase 9 and worth standing away from.
     */
    case 'launch-plasma-bolt': {
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (state.phase !== 'launch-missiles') return refuse('Plasma bolts are fired in phase 3')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')

      const weapon = ship.design.weapons.find((w) => w.id === action.weaponId)
      if (!weapon) return refuse('No such weapon')
      if (weapon.weaponClass !== 'plasma-bolt-launcher') {
        return refuse(`${weapon.label} is not a plasma bolt launcher`)
      }
      if (ship.destroyedSystems.has(weapon.id)) return refuse('That launcher is knocked out')
      if (!canWeaponFire(ship, weapon.id)) return refuse('That launcher has already fired')
      // 6.8: "a ship can mount only one launcher per 50 mass of ship." A design
      // over the limit is a shipyard fault, but the table is the last place it
      // can be caught, and an imported SSD has never been near a shipyard.
      const fitted = ship.design.weapons.filter(
        (w) => w.weaponClass === 'plasma-bolt-launcher',
      ).length
      if (fitted > plasmaBoltLauncherLimit(ship.design.mass)) {
        return refuse(
          `${ship.name} mounts ${fitted} plasma bolt launchers; a ${ship.design.mass}-mass hull ` +
            `may carry ${plasmaBoltLauncherLimit(ship.design.mass)} (6.8)`,
        )
      }

      const bolts = boltsOf(state)
      const result = launchPlasmaBolt({
        id: `pbl-${state.turn}-${bolts.length + 1}-${ship.id}-${weapon.id}`,
        owner: ship.side,
        sourceShipId: ship.id,
        sourceWeaponId: weapon.id,
        boltClass: weapon.rating,
        origin: { position: ship.placement.position, facing: ship.placement.facing },
        arcs: bearingArcs(ship, weapon.arcs),
        aim: action.aimPoint,
        turn: state.turn,
        lastFiredTurn: ship.weaponLastFiredTurn.get(weapon.id) ?? null,
      })
      if (!result.bolt) {
        // A refusal, not a spent shot: a launcher that is still reloading has
        // not fired, and one that could not bear has not either.
        return refuse(`${weapon.label}: ${result.detail}`)
      }

      markWeaponFired(ship, weapon.id, state.phase)
      ship.weaponLastFiredTurn.set(weapon.id, state.turn)
      bolts.push(result.bolt)
      projectBolts(state)
      pushLog(state, {
        kind: 'launch',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} fires ${weapon.label}: ${result.detail}`,
      })
      return OK
    }

    case 'move-ordnance': {
      if (state.phase !== 'move-ships') return refuse('Ordnance flies in phase 5')
      const markers = ordnanceOf(state)
      setOrdnance(state, moveOrdnanceMarkers(markers))
      projectOrdnance(state)
      return OK
    }

    case 'resolve-ordnance-attacks': {
      if (state.phase !== 'ordnance-vs-ships') {
        return refuse('Ordnance attacks in phase 10')
      }
      // 11.7: a marker cannot acquire an attached rider any more than a gun
      // can be aimed at one — the Mothership is the only hull out there.
      const alive = state.ships.filter(
        (ship) => !ship.destroyed && !ship.offTable && ship.carriedBy === null,
      )
      const acquired = acquireMissileTargets(
        ordnanceOf(state),
        alive.map((ship) => ({ id: ship.id, owner: ship.side, position: ship.placement.position })),
      )
      setOrdnance(state, acquired.markers)

      for (const hit of acquired.acquisitions) {
        const marker = acquired.markers.find((m) => m.id === hit.markerId)
        const target = shipById(state, hit.targetShipId)
        if (!marker || !target) continue

        // 6.6: an antimatter warhead is a blast with a radius, so it cannot be
        // one target's damage roll — it is resolved against everything within
        // three MU of where the marker went off, the launcher's own fleet
        // included.
        if (marker.kind === 'antimatter') {
          const blast = resolveAntimatterDetonation(
            marker.position,
            marker.hits,
            blastTargetsNear(state, marker.position, ANTIMATTER_BLAST_RADIUS),
            state.rng,
          )
          pushLog(state, {
            kind: 'damage',
            side: marker.owner,
            text: `Antimatter warhead detonates on ${target.name}: ${blast.detail}`,
          })
          applyBlastEffects(state, blast.effects, {
            side: marker.owner,
            source: 'An antimatter blast',
            mode: 'standard',
          })
          continue
        }

        // 6.4: "The attacking player then rolls a D6 for each Salvo Missile
        // marker. The result is the number of missiles in the salvo that are
        // actually on target." Without it every missile that survived phase 9
        // hit automatically, which is roughly twice what the rule allows on an
        // average roll — the salvo's own accuracy was never tested at all.
        //
        // A new die in an existing path, so it is stamped: an older battle
        // replays on the every-survivor-hits reading it was fought under.
        let incoming = marker.missiles
        let lockOnDice: number[] = []
        if (marker.kind === 'salvo' && rulesReading(state) >= 3) {
          const lock = rollSalvoLockOn(marker, state.rng)
          incoming = lock.hits
          lockOnDice = [lock.roll]
          if (incoming <= 0) {
            pushLog(state, {
              kind: 'fire',
              targetId: target.id,
              side: marker.owner,
              dice: lockOnDice,
              text: `Salvo locks on ${lock.lockOn} against ${marker.hits} killed — nothing gets through ${target.name} (6.4)`,
            })
            continue
          }
        }

        const result = resolveOrdnanceAttack(marker, incoming, {
          level: effectiveScreenLevel(target),
          advanced: target.design.screens.advanced,
        }, state.rng)
        if (!result) continue

        const applied = applyDamage(targetStateOf(target), result, {
          // 4.10: "Missiles or fighters do not benefit from rear arc attacks."
          source: 'ordnance',
        })
        writeBackDamage(target, applied.target)
        markHullBoxes(target, applied.hullDamage)
        pushLog(state, {
          kind: applied.hullDamage > 0 ? 'damage' : 'fire',
          targetId: target.id,
          side: marker.owner,
          dice: [...lockOnDice, ...result.dice],
          text: `Ordnance strikes ${target.name}: ${result.detail}`,
        })
        if (target.destroyed) {
          pushLog(state, {
            kind: 'destroyed',
            shipId: target.id,
            text: `${target.name} is destroyed`,
          })
        }
      }

      // A marker that attacked is spent (6.3); one that found nothing flies on.
      const spent = new Set(acquired.acquisitions.map((a) => a.markerId))
      setOrdnance(
        state,
        acquired.markers.filter((marker) => !spent.has(marker.id)),
      )
      projectOrdnance(state)
      detonateBolts(state)
      return OK
    }

    // ── Point defence (7.12 – 7.15, phase 9) ──────────────────────────────
    /**
     * Which marker a mount engages (phase 9).
     *
     * Left to itself the engine puts every mount on the nearest thing it can
     * reach, which is what a player does most of the time. This is for the
     * times they would not: holding a scattergun for the salvo that is one
     * turn behind, or putting everything on the heavy missile rather than
     * splitting between two. An unassigned mount still follows the doctrine.
     */
    case 'assign-point-defence': {
      if (state.phase !== 'point-defence') return refuse('Point defence is phase 9')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      const mount = pdMountsOf(ship).find((candidate) => candidate.id === action.systemId)
      if (!mount) {
        return refuse(`${ship.name} has no point-defence mount that can fire this turn`)
      }
      const orders = pdOrders(state)
      if (action.targetId === '') {
        orders.delete(action.systemId)
        return OK
      }
      const marker = ordnanceOf(state).find((candidate) => candidate.id === action.targetId)
      if (!marker) return refuse('No such marker')
      if (marker.owner === ship.side) return refuse('That is your own ordnance')
      orders.set(action.systemId, action.targetId)
      return OK
    }

    case 'resolve-point-defence': {
      if (state.phase !== 'point-defence') return refuse('Point defence is phase 9')
      // 6.8's bolts are shot at in this phase too, and by mounts that may have
      // nothing else to fire at — so they are resolved whether or not there is
      // a missile marker on the table.
      resolveBoltDefence(state)
      const markers = ordnanceOf(state)
      if (markers.length === 0) return OK

      for (const ship of state.ships) {
        if (ship.destroyed || ship.offTable) continue
        // 10.3: "Passive defenses (screens, armor) are still operational,
        // though active defenses (PDS) are not." 11.4 lets a warming-up ship
        // keep its PDS but takes its ADFC, and a jumping one has already gone.
        if (isOutOfControl(ship, state.turn)) continue
        const ftlStage = ftlStageOf(ship, state.turn)
        if (ftlStage !== null && !ftlExitRestrictions(ftlStage).mayUsePds) continue
        const mounts = pdMountsOf(ship)
        if (mounts.length === 0) continue

        // A marker is a threat to this ship if it is close enough to be worth
        // shooting at; the options function applies the actual reach rules.
        const threats: PdThreat[] = markers
          .filter((marker) => marker.owner !== ship.side && marker.missiles > 0)
          .map((marker) => ({
            id: marker.id,
            // 6.4 and 6.6 give a heavy missile and an antimatter warhead the
            // harder table — 5 or 6 on a PDS rather than 4, no double kill on
            // a 6 — and `usesHeavyMissileTable` in defences.ts has always
            // known about 'antimatter-missile'. This mapping never sent one:
            // everything that was not 'heavy' arrived as a salvo, so an
            // antimatter warhead was shot down on the easy table and died
            // about twice as often as 6.6 allows. Another die count, so it is
            // stamped.
            kind: pdThreatKind(marker.kind, rulesReading(state)),
            position: marker.position,
            attacking: ship.id,
          }))
        if (threats.length === 0) continue

        const defender = pdDefenderOf(state, ship, mounts)
        const options = pointDefenceOptions(defender, threats)
        // A mount the player has aimed goes where they aimed it; the rest
        // follow doctrine — every mount at the nearest thing it can reach,
        // which is what a player does when missiles are inbound, because
        // splitting fire between two salvos usually stops neither.
        const ordered = pdOrders(state)
        const used = new Set<string>()
        const allocations: PdAllocation[] = []
        const take = (option: (typeof options)[number]): void => {
          if (used.has(option.mountId)) return
          used.add(option.mountId)
          allocations.push({
            mountId: option.mountId,
            threatId: option.threatId,
            reach: option.reach,
            coveringShipId: option.coveringShipId,
            dice: option.dice,
          })
        }
        for (const option of options) {
          if (ordered.get(option.mountId) === option.threatId) take(option)
        }
        for (const option of [...options].sort((a, b) => a.range - b.range)) take(option)
        if (allocations.length === 0) continue

        const outcome = resolvePointDefence(defender, threats, allocations, state.rng)

        for (const result of outcome.results) {
          if (result.kills <= 0) continue
          const marker = markers.find((m) => m.id === result.threatId)
          if (!marker) continue
          marker.missiles = Math.max(0, marker.missiles - result.kills)
          pushLog(state, {
            kind: 'point-defence',
            shipId: ship.id,
            side: ship.side,
            dice: result.rolls,
            text: `${ship.name} point defence: ${result.detail}`,
          })
        }
        // A mount that fires as point defence has fired for the turn (2.6).
        for (const allocation of allocations) markWeaponFired(ship, allocation.mountId, state.phase)
      }

      // The aim was for this resolution. Clearing it here rather than at the
      // turn boundary means a phase resolved twice does not fire yesterday's
      // orders at today's markers.
      pdOrders(state).clear()
      setOrdnance(state, markers.filter((marker) => marker.missiles > 0))
      projectOrdnance(state)
      return OK
    }

    // ── Threshold checks (4.11, phase 13) ─────────────────────────────────
    case 'threshold-check': {
      // 2.6 puts the checks in phase 13, with two exceptions 4.11 names — an
      // ordnance hit and a reactor breach are resolved where they happen.
      // `thresholdResolution` is what says which, and the sweep was gated on
      // the phase while this, its per-ship twin, was gated on nothing at all.
      if (state.phase !== 'threshold' && thresholdResolution(state.phase) !== 'immediate') {
        return refuse('Threshold checks are phase 13 (2.6, 4.11)')
      }
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      const result = rollThresholdChecks(ship, state.rng, {
        turn: state.turn,
        driveDamage: optional(state).driveDamage,
      })
      if (!result) return refuse('No threshold check owing')
      pushLog(state, {
        kind: 'threshold',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} crosses hull row ${result.rowsLost}: systems lost on ${result.target}+`,
        dice: result.checks.map((check) => check.roll),
      })
      knockOffCourse(state, ship, result.rowsLost, result.extraRows)
      partiesInThreshold(state, ship, result.rowsLost, result.extraRows)
      strikeTheColors(state, ship, result.rowsLost, result.extraRows)
      orbitAfterThreshold(
        state,
        ship,
        result.rowsLost,
        result.extraRows,
        result.checks.filter((check) => check.destroyed).map((check) => check.id),
      )
      return OK
    }

    case 'threshold-sweep': {
      if (state.phase !== 'threshold') return refuse('Threshold checks are phase 13')
      for (const result of thresholdPhase(state, { driveDamage: optional(state).driveDamage })) {
        const ship = shipById(state, result.shipId)
        if (!ship) continue
        knockOffCourse(state, ship, result.rowsLost, result.extraRows)
        partiesInThreshold(state, ship, result.rowsLost, result.extraRows)
        strikeTheColors(state, ship, result.rowsLost, result.extraRows)
        orbitAfterThreshold(
          state,
          ship,
          result.rowsLost,
          result.extraRows,
          result.checks.filter((check) => check.destroyed).map((check) => check.id),
        )
      }
      reportFleetMorale(state)
      return OK
    }

    case 'resolve-damage-control': {
      if (state.phase !== 'damage-control') return refuse('Repairs are made in phase 14')
      damageControlPhase(state)
      return OK
    }

    case 'resolve-reactor-explosions': {
      if (state.phase !== 'reactor-explosions') {
        return refuse('A breached core is rolled for in phase 15')
      }
      for (const result of reactorExplosionPhase(state)) {
        // 10.3's optional Reactor Breach: the blast is reported by the phase
        // and applied here, because how it meets armour and screens belongs to
        // the damage pipeline. Semi-armour-piercing, and standard screens are
        // no help — "Half of the damage would be applied to armor; the other
        // half to the hull ignoring screens if any."
        for (const hit of result.blast) {
          if (hit.kind !== 'ship') {
            // What a point of blast does to a fighter group or a missile
            // marker is not stated in section 10, so it is logged rather than
            // guessed at.
            pushLog(state, {
              kind: 'damage',
              text: `${hit.targetId} is caught in the blast: ${hit.damage} points (10.3)`,
              dice: hit.dice,
            })
            continue
          }
          const victim = shipById(state, hit.targetId)
          if (!victim) continue
          const applied = applyDamage(
            targetStateOf(victim),
            {
              normalDamage: hit.damage,
              penetratingDamage: 0,
              mode: 'SAP',
              dice: hit.dice,
              detail: `reactor breach, ${hit.damage} SAP`,
            },
            { rearArcRule: false, rearArc: false, source: 'direct-fire' },
          )
          writeBackDamage(victim, applied.target)
          markHullBoxes(victim, applied.hullDamage)
          pushLog(state, {
            kind: 'damage',
            shipId: victim.id,
            side: victim.side,
            dice: hit.dice,
            text: `${victim.name} is caught in the blast: ${hit.damage} semi-AP (10.3)`,
          })
          if (victim.destroyed) {
            pushLog(state, {
              kind: 'destroyed',
              shipId: victim.id,
              text: `${victim.name} is destroyed by the blast`,
            })
          }
        }
      }
      // "Apply damage if necessary and roll threshold checks again" — the
      // quick reference sheet's phase 15, and the reason the sweep runs after
      // the blast rather than before it.
      thresholdPhase(state, { driveDamage: optional(state).driveDamage })
      return OK
    }

    // ── Boarding (phase 12) ───────────────────────────────────────────────
    case 'resolve-boarding': {
      if (state.phase !== BOARDING_PHASE) return refuse('Boarding is resolved in phase 12')
      for (const ship of state.ships) {
        if (ship.destroyed) continue
        // 12.7: "If a ship jumps away into FTL with enemy boarders on board,
        // the battle for control of the ship continues. Resolve the boarding
        // action until either all the boarders are killed, or the ship has
        // been captured." So a hull that left the table is still fighting for
        // itself somewhere, and this loop is the only place that happens.
        if (!boardingContinues(ship.side, ship.boarders, ship.captured)) continue

        const boarded: BoardedShip = {
          side: ship.side,
          hullRemaining: ship.design.hullBoxes - ship.hullMarked,
          // 12.7's counter-attack is a damage control action, and the quick
          // reference sheet's phase 14 is "Damage Control assignments for DC
          // parties not used to repel boarders" — so what is spent here is
          // what phase 14 will not see.
          damageControlParties: availableDamageControlParties(ship),
          marines: ship.marinesAboard,
        }
        // Read before the survivors overwrite the list: whoever was aboard
        // fighting for the hull is whoever ends up owning it.
        const capturedBy = ship.boarders.find((force) => force.side !== ship.side)?.side ?? null
        const result = resolveBoardingCombat(
          boarded,
          ship.boarders,
          defaultBoardingPlan(boarded, ship.boarders),
          state.rng,
        )

        ship.boarders = result.survivors.map((force) => ({
          side: force.side,
          parties: force.parties,
          landedTurn: force.landedTurn,
        }))
        ship.marinesAboard = Math.max(0, ship.marinesAboard - result.defendingMarinesLost)
        if (result.dcpsCommitted > 0) {
          ship.damageControl.push({ systemId: 'repelling-boarders', parties: result.dcpsCommitted })
        }
        for (const line of result.log) {
          pushLog(state, { kind: 'boarding', shipId: ship.id, side: ship.side, text: line })
        }
        if (result.hullDamage > 0) {
          // Boarders wreck a ship from the inside, so their damage meets no
          // armour and no screens on the way to the hull (12.7).
          markHullBoxes(ship, result.hullDamage, 'boarding')
          pushLog(state, {
            kind: 'damage',
            shipId: ship.id,
            side: ship.side,
            text: `${ship.name} takes ${result.hullDamage} from boarders inside the hull (12.7)`,
          })
        }
        if (result.captured) {
          // 12.7: "If a ship is 'destroyed' by Boarding Parties or Marines it
          // is considered captured." The quotation marks are the rule: the
          // boarders filled her hull track, and what that produces is a prize
          // rather than a wreck. So the destruction `markHullBoxes` just
          // recorded is taken back, and the flag put on instead.
          ship.destroyed = false
          ship.excessDamage = null
          ship.pendingThresholdRows = 0
          ship.captured = true
          ship.capturedBy = capturedBy ?? ship.capturedBy
          pushLog(state, {
            kind: 'boarding',
            shipId: ship.id,
            text: `${ship.name} is carried by boarding action (12.7)`,
          })
        }
      }
      return OK
    }

    // ── Flight operations (8, phases 4, 6, 8 and 10) ──────────────────────
    case 'launch-flight': {
      if (state.phase !== 'move-fighters') return refuse('Fighters launch in phase 4')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      const carrier = shipById(state, action.carrierId)
      if (!carrier) return refuse('No such carrier')
      if (flight.carrierId !== carrier.id) {
        return refuse(`${flight.label} is not aboard ${carrier.name}`)
      }
      if (carrier.destroyed || carrier.offTable) return refuse('Carrier is out of the battle')
      // 10.3: an out-of-control ship "may not fire weapons, launch fighters,
      // or take any other offensive action".
      if (isOutOfControl(carrier, state.turn)) {
        return refuse(`${carrier.name} is out of control (10.3)`)
      }

      const result = launchFighterGroup(
        flight,
        carrierFlightState(state, carrier),
        state.turn,
        carrier.placement.position,
        carrier.placement.facing,
      )
      if (!result.launched) return refuse(`${flight.label}: ${result.reason}`)

      writeFlight(flight, result.group)
      pushLog(state, {
        kind: 'launch',
        side: flight.side,
        shipId: carrier.id,
        text: `${carrier.name} launches ${flight.label}`,
      })
      return OK
    }

    case 'move-flight': {
      if (state.phase !== 'move-fighters') return refuse('Fighter groups move in phase 4')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.movedThisTurn) return refuse(`${flight.label} has already moved this turn`)
      // 8.6: a screen or a pursuit moves with what it is tied to, in phase 5.
      if (flight.mission !== 'free') {
        return refuse(`${flight.label} is ${flight.mission === 'screen' ? 'screening' : 'pursuing'} and moves with its charge (8.6)`)
      }

      const result = moveFighterGroup(
        flight,
        action.to,
        state.turn,
        facingAfterMove(flight, action.to, action.facing),
      )
      if (!result.moved) return refuse(`${flight.label}: ${result.reason}`)
      writeFlight(flight, result.group)
      return OK
    }

    case 'secondary-move-flight': {
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      // 8.15's Robot option takes its second move "at the end of phase 4 after
      // all fighters and missiles have made their moves. This means that Robot
      // Fighters cannot react to ship movement" — the whole cost of being
      // unmanned, and the reason it is a different phase rather than a DRM.
      if (takesSecondaryMoveInPhaseFour(flight)) {
        if (state.phase !== 'move-fighters') {
          return refuse('A Robot group takes its second move at the end of phase 4 (8.15)')
        }
        if (!flight.movedThisTurn) {
          return refuse(`${flight.label} has not made its first move yet (8.15)`)
        }
      } else if (state.phase !== 'secondary-fighter-moves') {
        return refuse('Secondary fighter moves are phase 6')
      }
      if (flight.secondaryMovedThisTurn) return refuse(`${flight.label} has already moved again`)

      const result = secondaryMoveFighterGroup(
        flight,
        action.to,
        facingAfterMove(flight, action.to, action.facing),
      )
      if (!result.moved) return refuse(`${flight.label}: ${result.reason}`)
      writeFlight(flight, result.group)
      pushLog(state, {
        kind: 'move',
        side: flight.side,
        text: `${flight.label} moves again, ${flight.cef} CEF left`,
      })
      return OK
    }

    /**
     * 8.6: a group takes station on something instead of flying its own move.
     *
     * *"A fighter screen … always moves at the same time as the ship it is
     * screening, rather than being moved in the first Fighter Movement Phase.
     * Screening fighters can exceed the normal fighter movement allowance if
     * the ship they are screening is moving faster than the fighters could
     * normally move."* Fighters may screen other fighters, but not the
     * fighters screening them.
     */
    case 'assign-screen': {
      if (state.phase !== 'move-fighters') {
        return refuse('A group declares a screen on its fighter move, phase 4 (8.6)')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.status !== 'in-flight') return refuse(`${flight.label} is not in the air`)
      const escortShip = shipById(state, action.escortId)
      const escortFlight = flightById(state, action.escortId)
      if (!escortShip && !escortFlight) return refuse('Nothing there to screen')
      const escortSide = escortShip?.side ?? escortFlight?.side
      if (escortSide !== flight.side) return refuse('A group screens its own side')

      const result = assignScreen(flight, action.escortId, {
        // Re-derived, never carried: who is already screening this group.
        alreadyScreenedBy: state.fighterGroups
          .filter((other) => other.escorting === flight.id && other.mission === 'screen')
          .map((other) => other.id),
      })
      if (!result.assigned) return refuse(`${flight.label}: ${result.reason}`)
      writeFlight(flight, result.group)
      pushLog(state, {
        kind: 'move',
        side: flight.side,
        text: `${flight.label} takes station screening ${escortShip?.name ?? escortFlight?.label} (8.6)`,
      })
      return OK
    }

    /**
     * 8.6: *"A fighter group that attacked an enemy ship or an enemy screening
     * fighter group last turn can declare it is pursuing the ship."*
     */
    case 'declare-pursuit': {
      if (state.phase !== 'move-fighters') {
        return refuse('A pursuit is declared on the fighter move, phase 4 (8.6)')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.status !== 'in-flight') return refuse(`${flight.label} is not in the air`)
      const result = declarePursuit(flight, action.targetId, {
        // The one fact the rule turns on, read off what the group did last
        // turn rather than taken on the payload's word.
        attackedTargetLastTurn: flight.lastTargetId === action.targetId,
      })
      if (!result.assigned) return refuse(`${flight.label}: ${result.reason}`)
      writeFlight(flight, result.group)
      const quarry = shipById(state, action.targetId) ?? flightById(state, action.targetId)
      pushLog(state, {
        kind: 'move',
        side: flight.side,
        text: `${flight.label} goes after ${'name' in (quarry ?? {}) ? (quarry as ShipState).name : action.targetId} (8.6)`,
      })
      return OK
    }

    /** 8.6: a group gives up its station and flies its own move again. */
    case 'clear-mission': {
      if (state.phase !== 'move-fighters') {
        return refuse('A group changes its orders on the fighter move, phase 4 (8.6)')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      flight.mission = 'free'
      flight.escorting = null
      pushLog(state, {
        kind: 'move',
        side: flight.side,
        text: `${flight.label} breaks off and flies free (8.6)`,
      })
      return OK
    }

    /**
     * 8.3: *"the only time that fighter launches may take place when they have
     * not been pre-planned … when the opponent has just moved one or more
     * fighter groups into position to attack the carrier itself."*
     *
     * A 1 wrecks a bay for the game, 2 or 3 gets nobody off, 4 gets one group
     * away too late to intercept, 5 gets one up in time and 6 gets two — for a
     * carrier that could have launched two anyway. A group already re-arming
     * goes up on half fuel.
     */
    case 'scramble-fighters': {
      if (state.phase !== 'move-fighters') return refuse('Fighters scramble in phase 4 (8.3)')
      const carrier = shipById(state, action.carrierId)
      if (!carrier) return refuse('No such carrier')
      if (carrier.destroyed || carrier.offTable) return refuse('Carrier is out of the battle')
      if (isOutOfControl(carrier, state.turn)) {
        return refuse(`${carrier.name} is out of control (10.3)`)
      }

      // "when the opponent has just moved one or more fighter groups into
      // position to attack the carrier itself" — re-derived, never trusted
      // from the payload.
      const attacker = flightById(state, action.attackerFlightId)
      if (!attacker) return refuse('No such attacking group')
      if (attacker.side === carrier.side) return refuse('That group is on your own side')
      if (attacker.status !== 'in-flight' || !attacker.movedThisTurn) {
        return refuse(`${attacker.label} has not moved into position this turn (8.3)`)
      }
      if (distance(attacker.position, carrier.placement.position) > FIGHTER_ATTACK_RANGE) {
        return refuse(`${attacker.label} is not in position to attack ${carrier.name} (8.3)`)
      }

      const aboard = action.flightIds
        .map((id) => flightById(state, id))
        .filter(
          (group): group is FighterGroupState =>
            group !== undefined &&
            group.carrierId === carrier.id &&
            group.status === 'aboard' &&
            !group.grounded,
        )
      if (aboard.length === 0) return refuse(`${carrier.name} has nothing left in the bay`)

      const result = scrambleFighters(state.rng, {
        carrierUsedThrust: carrierUnderThrust(carrier),
        launchCapacity: operationalCount(carrier, 'launch-tube'),
        // 8.16: a group that came home this turn is still being re-armed.
        rearming: aboard.some((group) => group.recoveredTurn === state.turn),
        profile: fighterProfile(aboard[0].typeId, aboard[0].modifiers),
      })

      if (result.outcome === 'bay-wrecked') {
        // "one complete fighter bay … is out of action for the rest of the
        // game", which is a hangar bay crossed off exactly as 4.11 would.
        const bay = carrier.design.systems.find(
          (system) => system.kind === 'hangar-bay' && !carrier.destroyedSystems.has(system.id),
        )
        if (bay) destroySystem(carrier, bay.id)
      }

      for (const group of aboard.slice(0, result.groupsLaunched)) {
        group.status = 'in-flight'
        group.position = carrier.placement.position
        group.facing = carrier.placement.facing
        group.launchedTurn = state.turn
        group.cef = result.cefOnLaunch
        // A 4 gets the group up "too late to intercept the attackers", so it
        // is in the air but may not fight this turn.
        group.attackedThisTurn = !result.interceptsInTime
      }

      pushLog(state, {
        kind: 'note',
        shipId: carrier.id,
        side: carrier.side,
        dice: [result.roll],
        text:
          `${carrier.name} scrambles against ${attacker.label}: ` +
          (result.reason ||
            `${result.groupsLaunched} group(s) away` +
              (result.groupsLaunched > 0 && !result.interceptsInTime ? ', too late to intercept' : '')) +
          ' (8.3)',
      })
      return OK
    }

    /**
     * 8.11's furball: one dogfight with more than two groups in it.
     *
     * *"All groups engaged in the dogfight may fire only once per turn, but may
     * choose to attack just one enemy group or to split their kills between two
     * or more."* Every group rolls against the strengths everyone had entering
     * the fight — 8.10's simultaneity — so it has to be resolved as one action
     * rather than as a series of pairwise dogfights.
     */
    case 'flight-furball': {
      if (state.phase !== 'fighter-vs-fighter') return refuse('Dogfights are phase 8')
      if (action.entries.length < 2) return refuse('A furball needs at least two groups (8.11)')

      const entries: Array<{ group: FighterGroupState; targets: string[] }> = []
      for (const entry of action.entries) {
        const flight = flightById(state, entry.flightId)
        if (!flight) return refuse('No such flight')
        if (flight.status !== 'in-flight') return refuse(`${flight.label} is not in the air`)
        if (flight.attackedThisTurn) return refuse(`${flight.label} has already fought this turn`)
        if (entry.targetFlightIds.length === 0) {
          return refuse(`${flight.label} has to fire at something (8.11)`)
        }
        for (const targetId of entry.targetFlightIds) {
          const enemy = flightById(state, targetId)
          if (!enemy) return refuse('No such enemy group')
          if (enemy.side === flight.side) return refuse('A group does not dogfight its own side')
          const allowed = canDeclareAttack(flight, enemy.position, { kind: 'fighter' })
          if (!allowed.allowed) return refuse(`${flight.label}: ${allowed.reason}`)
        }
        entries.push({ group: flight, targets: [...entry.targetFlightIds] })
      }

      // Morale is asked of each group before the furball opens, and a group
      // that will not go in simply does not roll (8.17).
      const committed = entries.filter((entry) => fighterMoraleHolds(state, entry.group))
      if (committed.length === 0) return OK

      const result = resolveMultiGroupDogfight(committed, state.rng)
      for (const group of result.groups) {
        const live = flightById(state, group.id)
        if (live) writeFlight(live, group)
      }
      for (const side of result.sides) {
        const shooter = flightById(state, side.groupId)
        if (!shooter) continue
        pushLog(state, {
          kind: 'fire',
          side: shooter.side,
          dice: side.dice,
          text:
            `${shooter.label} in the furball: ${side.kills} killed` +
            (side.exhausted ? ' (out of endurance)' : ''),
        })
      }
      return OK
    }

    /**
     * 8.18: *"the Ace may choose to attack as a Needle Beam instead of his
     * normal attack – in this case he may choose to target ONE SPECIFIC SYSTEM
     * on the ship being attacked, rolling just ONE die and treating the attack
     * as a Needle Beam shot. Note that in this case the rest of the group does
     * NOT get the 'extra' die."*
     *
     * So the group attacks with `strength − 1` dice and the Ace throws one
     * needle die of his own — a natural 6 takes the named system out for good
     * (5.13).
     */
    case 'flight-ace-needle': {
      if (state.phase !== 'ordnance-vs-ships' && state.phase !== 'ship-fire') {
        return refuse('Fighter attacks are resolved after point defence (8.7)')
      }
      if (!optional(state).fighterQuality) {
        return refuse('Aces and Turkeys are not in play in this battle (8.18)')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.attackedThisTurn) return refuse(`${flight.label} has already attacked this turn`)
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (target.side === flight.side) return refuse('A group does not strafe its own fleet')
      if (!target.design.systems.some((system) => system.id === action.systemId)) {
        return refuse(`${target.name} has no system ${action.systemId}`)
      }

      const allowed = canDeclareAttack(flight, target.placement.position, { kind: 'ship' })
      if (!allowed.allowed) return refuse(`${flight.label}: ${allowed.reason}`)
      const blocking = screenInTheWay(state, flight, target.id)
      if (blocking) {
        return refuse(
          `${flight.label} must engage ${blocking.label}, which is screening ${target.name} (8.6)`,
        )
      }
      if (!fighterMoraleHolds(state, flight)) return OK

      // The rest of the group first, one die short, then the Ace's own.
      const run = resolveAttackRun(
        flight,
        {
          screens: effectiveScreenLevel(target),
          advancedScreens: target.design.screens.advanced,
          rearArc: isRearArcAttack(
            target.placement.position,
            target.placement.facing,
            flight.position,
          ),
        },
        state.rng,
        { aceSpecialAttack: true },
      )
      const needle = aceNeedleAttack(flight, state.rng)
      if (!needle.fired) return refuse(`${flight.label}: ${needle.reason}`)

      writeFlight(flight, run.fired ? run.group : flight)
      flight.attackedThisTurn = true
      flight.targetId = target.id
      if (run.fired) {
        pushLog(state, {
          kind: 'fire',
          side: flight.side,
          shipId: target.id,
          dice: run.dice,
          text: `${flight.label} strafes ${target.name} while its Ace lines up: ${run.detail}`,
        })
        applyFighterDamage(state, target, {
          normalDamage: run.normalDamage,
          penetratingDamage: run.penetratingDamage,
          mode: run.mode,
          dice: run.dice,
          detail: run.detail,
        })
      }
      if (needle.damage > 0) {
        // 5.13: a needle beam is "not affected by screens", so its point goes
        // straight in.
        applyFighterDamage(state, target, {
          normalDamage: 0,
          penetratingDamage: needle.damage,
          mode: 'P',
          dice: [needle.roll],
          detail: 'Ace needle shot',
        })
      }
      if (needle.systemDestroyed && !target.destroyed) {
        destroySystem(target, action.systemId)
        target.unrepairable.add(action.systemId)
      }
      pushLog(state, {
        kind: needle.systemDestroyed ? 'damage' : 'fire',
        side: flight.side,
        shipId: target.id,
        dice: [needle.roll],
        text: needle.systemDestroyed
          ? `${flight.label}'s Ace puts a needle shot through ${target.name}'s ${action.systemId} — beyond repair (8.18, 5.13)`
          : `${flight.label}'s Ace takes his needle shot at ${target.name} and scores ${needle.damage}`,
      })
      return OK
    }

    /**
     * 8.9: *"the fighters attacking the ship have the choice of either
     * breaking off the attack and engaging in a dogfight, or continuing the
     * attack. In the latter case, the 'intercepting' fighter group fires as if
     * in a dogfight, and the survivors carry out the attack against the
     * ship."*
     *
     * One-sided by design: the interceptor shoots and the attacker does not
     * shoot back, it just keeps going with whoever is left.
     */
    case 'flight-press-attack': {
      if (state.phase !== 'ordnance-vs-ships' && state.phase !== 'ship-fire') {
        return refuse('Fighter attacks are resolved after point defence (8.7)')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.attackedThisTurn) return refuse(`${flight.label} has already attacked this turn`)
      const interceptor = flightById(state, action.interceptorFlightId)
      if (!interceptor) return refuse('No such intercepting group')
      if (interceptor.side === flight.side) return refuse('That group is on your own side')
      if (interceptor.status !== 'in-flight' || interceptor.strength <= 0) {
        return refuse(`${interceptor.label} is not in the air`)
      }
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (target.side === flight.side) return refuse('A group does not strafe its own fleet')

      const allowed = canDeclareAttack(flight, target.placement.position, { kind: 'ship' })
      if (!allowed.allowed) return refuse(`${flight.label}: ${allowed.reason}`)
      // The interceptor has to be close enough to be doing the intercepting.
      const reach = canDeclareAttack(interceptor, flight.position, { kind: 'fighter' })
      if (!reach.allowed) return refuse(`${interceptor.label}: ${reach.reason}`)
      if (!fighterMoraleHolds(state, flight)) return OK

      const result = resolveInterceptedAttackRun(
        flight,
        interceptor,
        {
          screens: effectiveScreenLevel(target),
          advancedScreens: target.design.screens.advanced,
          rearArc: isRearArcAttack(
            target.placement.position,
            target.placement.facing,
            flight.position,
          ),
        },
        state.rng,
      )
      writeFlight(flight, result.attacker)
      flight.targetId = target.id
      pushLog(state, {
        kind: 'fire',
        side: interceptor.side,
        dice: result.interceptorDice,
        text: `${interceptor.label} cuts into ${flight.label} on the way in: ${result.interceptorKills} killed (8.9)`,
      })
      if (!result.run.fired) {
        pushLog(state, {
          kind: 'fire',
          side: flight.side,
          text: `${flight.label} does not reach ${target.name} — ${result.run.reason}`,
        })
        return OK
      }
      pushLog(state, {
        kind: 'fire',
        side: flight.side,
        shipId: target.id,
        dice: result.run.dice,
        text: `${flight.label} presses home on ${target.name}: ${result.run.detail}`,
      })
      applyFighterDamage(state, target, {
        normalDamage: result.run.normalDamage,
        penetratingDamage: result.run.penetratingDamage,
        mode: result.run.mode,
        dice: result.run.dice,
        detail: result.run.detail,
      })
      return OK
    }

    /**
     * 8.7: *"After fighter movement and secondary moves a fighter group may
     * declare an attack against any ship, missile marker, or other fighter
     * group within 6 MU and within its front 180° arc."*
     *
     * Phase 7 is where the declaration belongs and why the phase exists:
     * *"Attacks are not resolved until after point defense fire"*, so the
     * ship's gunners need to know who is coming before phase 9. A group may
     * still strike in phase 10 without having declared — the declaration is
     * what buys the defender a shot, not what permits the attack.
     */
    case 'flight-declare-target': {
      if (state.phase !== 'allocate-attacks') return refuse('Attacks are declared in phase 7 (8.7)')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.status !== 'in-flight') return refuse(`${flight.label} is not in the air`)
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (target.side === flight.side) return refuse('A group does not attack its own fleet')

      const allowed = canDeclareAttack(flight, target.placement.position, { kind: 'ship' })
      if (!allowed.allowed) return refuse(`${flight.label}: ${allowed.reason}`)
      flight.targetId = target.id
      pushLog(state, {
        kind: 'note',
        side: flight.side,
        text: `${flight.label} declares an attack run on ${target.name} (8.7)`,
      })
      return OK
    }

    /**
     * 8.8: the ships shoot back, in phase 9.
     *
     * Every ship fires whatever it has at the groups that declared against it
     * in phase 7 — *"'Wasted' shots when point defense fire kills more
     * fighters than are in the group may not be reallocated to other groups"*,
     * which the module's own cap enforces.
     *
     * A separate action from `resolve-point-defence` rather than an extension
     * of it: folding fighters into that sweep would draw new dice inside a
     * path every saved battle already runs.
     */
    case 'resolve-point-defence-at-flights': {
      if (state.phase !== 'point-defence') return refuse('Point defence is phase 9')
      for (const ship of state.ships) {
        if (ship.destroyed || ship.offTable || ship.captured) continue
        if (isOutOfControl(ship, state.turn)) continue
        const ftlStage = ftlStageOf(ship, state.turn)
        if (ftlStage !== null && !ftlExitRestrictions(ftlStage).mayUsePds) continue

        const incoming = state.fighterGroups.filter(
          (group) =>
            group.side !== ship.side &&
            group.status === 'in-flight' &&
            group.strength > 0 &&
            group.targetId === ship.id &&
            distance(group.position, ship.placement.position) <= PDS_RANGE,
        )
        if (incoming.length === 0) continue

        // Doctrine: everything at the first group in, then whatever is left at
        // the next. 8.8 lets a player split mounts between groups; the engine
        // takes them in the order they declared, which is the order a player
        // sees them arrive.
        const mounts = pdMountsOf(ship)
          .map((mount): AntiFighterMount | null => {
            if (mount.kind === 'pds' || mount.kind === 'ads') return 'pds'
            if (mount.kind === 'beam-1') return 'beam-1'
            if (mount.kind === 'grapeshot') return 'grapeshot'
            if (mount.kind === 'scattergun') return 'scattergun'
            return null
          })
          .filter((kind): kind is AntiFighterMount => kind !== null)
        if (mounts.length === 0) continue

        const share = Math.max(1, Math.floor(mounts.length / incoming.length))
        let taken = 0
        for (const group of incoming) {
          const mine = mounts.slice(taken, taken + share)
          taken += mine.length
          if (mine.length === 0) break
          const result = pointDefenceAgainstFighters(group, mine, state.rng)
          writeFlight(group, result.group)
          pushLog(state, {
            kind: 'point-defence',
            shipId: ship.id,
            side: ship.side,
            dice: result.results.flatMap((entry) => entry.rolls),
            text: `${ship.name} puts point defence into ${group.label}: ${result.kills} killed (8.8)`,
          })
        }
        // 2.6: a mount that fires as point defence has fired for the turn.
        for (const mount of pdMountsOf(ship).slice(0, taken)) {
          markWeaponFired(ship, mount.id, state.phase)
        }
      }
      return OK
    }

    /**
     * A Missile Fighter group looses its salvo (8.15).
     *
     * Launched in phase 3 like any other ordnance, and out to 12 MU rather
     * than 6: *"the fire control on these missiles is extended from 6 MU to 12
     * MU"*. The group *"must not be engaged by other fighters at time of
     * launch"*, and how many missiles find the target is a die less one for
     * each fighter already shot out of the group.
     */
    case 'launch-flight-missiles': {
      if (state.phase !== 'launch-missiles') return refuse('Missiles launch in phase 3')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.status !== 'in-flight') return refuse(`${flight.label} is not in the air`)
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (target.side === flight.side) return refuse('A group does not shoot at its own fleet')

      const range = distance(flight.position, target.placement.position)
      const result = launchFighterMissiles(flight, range, state.rng)
      if (!result.fired) return refuse(`${flight.label}: ${result.reason}`)
      writeFlight(flight, result.group)

      if (result.lockedOn <= 0) {
        pushLog(state, {
          kind: 'launch',
          side: flight.side,
          dice: [result.lockOnRoll],
          text: `${flight.label} looses ${result.salvoSize} missiles and none lock on (8.15)`,
        })
        return OK
      }
      const markers = ordnanceOf(state)
      markers.push({
        id: `fm-${state.turn}-${markers.length + 1}-${flight.id}`,
        owner: flight.side,
        sourceShipId: flight.carrierId ?? flight.id,
        kind: 'salvo',
        grade: 'standard',
        missiles: result.lockedOn,
        // 6.3 attacks whatever is within 6 MU of the marker after everything
        // moves; a fighter salvo is aimed at the hull it locked on to, so the
        // marker goes where that hull is standing now.
        position: { ...target.placement.position },
        facing: nearestCourse(flight.position, target.placement.position),
        launchedTurn: state.turn,
        rangeFlown: 0,
        // 6.3: a salvo "seeks once and, finding nothing, is removed from play".
        endurance: 1,
        stagesRemaining: 0,
        hits: 0,
        targetShipId: null,
        light: result.lightMissiles,
      })
      projectOrdnance(state)
      pushLog(state, {
        kind: 'launch',
        side: flight.side,
        dice: [result.lockOnRoll],
        text:
          `${flight.label} looses ${result.salvoSize} missiles at ${target.name}: ` +
          `${result.lockedOn} lock on (8.15)`,
      })
      return OK
    }

    /**
     * An Assault Shuttle group goes in (8.15).
     *
     * *"They may dock or breach enemy hulls in the same manner as fighters
     * attacking ships … Standard Screens will not stop this attack but
     * Advanced Screens will. The shuttles are fired upon by PDS as normal with
     * the survivors may attempt to 'land' one Boarding Party (DCP) or Marine
     * by rolling a 3+."* Resolved in phase 10, after point defence has taken
     * its cut, and what lands fights under 12.7 in phase 12.
     */
    case 'flight-boarding-run': {
      if (state.phase !== 'ordnance-vs-ships' && state.phase !== 'ship-fire') {
        return refuse('Fighter attacks are resolved after point defence (8.7)')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.attackedThisTurn) return refuse(`${flight.label} has already attacked this turn`)
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (target.side === flight.side) return refuse('A group does not board its own fleet')

      const allowed = canDeclareAttack(flight, target.placement.position, { kind: 'ship' })
      if (!allowed.allowed) return refuse(`${flight.label}: ${allowed.reason}`)

      const carrier = flight.carrierId ? shipById(state, flight.carrierId) : undefined
      // 8.15: "Marines or DCPs must be purchased separately", and only Marines
      // get the +1. A carrier that bought Marines sends Marines.
      const marines = (carrier?.design.marineParties ?? 0) > 0
      const result = resolveBoardingRun(flight, state.rng, {
        marines,
        advancedScreens: target.design.screens.advanced && effectiveScreenLevel(target) > 0,
      })
      if (!result.fired) return refuse(`${flight.label}: ${result.reason}`)

      writeFlight(flight, result.group)
      flight.attackedThisTurn = true
      if (result.landed > 0) {
        // 12.7 takes it from here, in phase 12.
        target.boarders.push({ side: flight.side, parties: result.landed, landedTurn: state.turn })
      }
      pushLog(state, {
        kind: 'boarding',
        side: flight.side,
        shipId: target.id,
        dice: result.rolls,
        text:
          `${flight.label} runs in on ${target.name}: ${result.landed} part${result.landed === 1 ? 'y' : 'ies'} ` +
          `aboard, ${result.lost} lost (8.15)`,
      })
      return OK
    }

    /**
     * 8.10: a group declines the dogfight and runs.
     *
     * *"A fighter group may refuse a dogfight, provided it has not already
     * moved that turn."* Getting away clean needs to be faster than the
     * attacker; anything slower takes a free round of fire on the way out.
     */
    case 'refuse-dogfight': {
      if (state.phase !== 'fighter-vs-fighter') return refuse('Dogfights are phase 8')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      const attacker = flightById(state, action.attackerFlightId)
      if (!attacker) return refuse('No such attacking group')
      if (attacker.side === flight.side) return refuse('That group is on your own side')

      const result = refuseDogfight(attacker, flight, state.rng, state.turn)
      if (!result.withdrew) return refuse(`${flight.label}: ${result.reason}`)

      // Where it runs to is the player's choice, held to the group's own move.
      const away = moveFighterGroup(result.defender, action.to, state.turn, action.facing)
      if (!away.moved) return refuse(`${flight.label}: ${away.reason}`)
      writeFlight(flight, away.group)
      writeFlight(attacker, result.attacker)
      pushLog(state, {
        kind: 'move',
        side: flight.side,
        dice: result.freeRound?.dice,
        text: result.freeRound
          ? `${flight.label} breaks off from ${attacker.label} and takes a parting round: ` +
            `${result.freeRound.kills} lost (8.10)`
          : `${flight.label} outruns ${attacker.label} and refuses the dogfight (8.10)`,
      })
      return OK
    }

    /**
     * A Torpedo or MKP group throws its one load (8.15).
     *
     * One action for both, because the module dispatches on the group's own
     * payload and a `kind` in the payload would be state the action re-derived
     * anyway. Both cost a point of endurance, both may be fired once, and
     * neither may be fired in the same turn the group uses its beams.
     */
    case 'flight-launch-payload': {
      if (state.phase !== 'ordnance-vs-ships' && state.phase !== 'ship-fire') {
        return refuse('Fighter attacks are resolved after point defence (8.7)')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.attackedThisTurn) return refuse(`${flight.label} has already attacked this turn`)
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (target.side === flight.side) return refuse('A group does not strafe its own fleet')

      const allowed = canDeclareAttack(flight, target.placement.position, { kind: 'ship' })
      if (!allowed.allowed) return refuse(`${flight.label}: ${allowed.reason}`)
      if (!fighterMoraleHolds(state, flight)) return OK

      // The group carries its own resolved modifiers (8.15), so the profile
      // comes off the counter rather than back off the design.
      const payload = fighterProfile(flight.typeId, flight.modifiers).payload
      const result =
        payload === 'pulse-torpedo'
          ? launchPulseTorpedoes(flight, state.rng)
          : payload === 'mkp'
            ? launchFighterMkps(flight, state.rng)
            : null
      if (!result) return refuse(`${flight.label} carries no one-shot load (8.15)`)
      if (!result.fired) return refuse(`${flight.label}: ${result.reason}`)

      writeFlight(flight, result.group)
      flight.targetId = target.id
      pushLog(state, {
        kind: 'fire',
        side: flight.side,
        shipId: target.id,
        dice: result.rolls,
        text:
          `${flight.label} looses its ${payload === 'mkp' ? 'MKPs' : 'Pulse Torpedoes'} at ` +
          `${target.name}: ${result.hits} hit for ${result.damage}`,
      })
      applyFighterDamage(state, target, {
        normalDamage: result.damage,
        penetratingDamage: 0,
        mode: result.mode,
        dice: result.rolls,
        detail: `${result.hits} hit`,
      })
      return OK
    }

    /**
     * 8.15's FTL fighters, which do not need launching.
     *
     * *"FTL Fighters may begin the game deployed within 6 MU of their carrier
     * instead of having to be launched if the player wishes. However, 1 point
     * of endurance will be checked off to represent the fuel used in getting
     * to the battle area."*
     */
    case 'deploy-ftl-flight': {
      if (state.turn !== 1 || state.phase !== 'orders') {
        return refuse('FTL fighters deploy before the first orders are written (8.15)')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.status !== 'aboard') return refuse(`${flight.label} is already in the air`)
      const carrier = flight.carrierId ? shipById(state, flight.carrierId) : undefined
      if (!carrier) return refuse('No such carrier')
      if (state.deployment && !state.deployment.placed.includes(carrier.id)) {
        return refuse(`${carrier.name} has not been deployed yet (18.1)`)
      }

      const result = deployFtlFighters(
        flight,
        carrier.placement.position,
        action.position,
        action.facing ?? carrier.placement.facing,
      )
      if (!result.launched) return refuse(`${flight.label}: ${result.reason}`)
      writeFlight(flight, result.group)
      pushLog(state, {
        kind: 'note',
        side: flight.side,
        text: `${flight.label} arrives under its own FTL, already in the air (8.15)`,
      })
      return OK
    }

    /**
     * 8.4: *"a carrier may simply recover all of its fighters in one turn.
     * However, these are not normal organized landings but a frantic recovery
     * that 'fouls' the deck. The carrier may not launch any recovered fighters
     * for the rest of the game."*
     *
     * No re-arm die anywhere: this is the one recovery that skips 8.16
     * entirely, because nothing that comes down this way is going up again.
     */
    case 'combat-landing': {
      const secondary = state.phase === 'secondary-fighter-moves'
      if (state.phase !== 'move-fighters' && !secondary) {
        return refuse('A combat landing is made on a fighter move, phase 4 or 6 (8.4)')
      }
      const carrier = shipById(state, action.carrierId)
      if (!carrier) return refuse('No such carrier')
      if (carrier.destroyed || carrier.offTable) return refuse('Carrier is out of the battle')

      const own = state.fighterGroups.filter((group) => group.carrierId === carrier.id)
      const result = combatLanding(own, {
        carrierUsedThrust: carrierUnderThrust(carrier),
        hangarCriticalHits: carrier.design.systems.filter(
          (system) => system.kind === 'hangar-bay' && carrier.destroyedSystems.has(system.id),
        ).length,
      })
      if (!result.allowed) return refuse(`${carrier.name}: ${result.reason}`)
      if (result.landed === 0) return refuse(`${carrier.name} has nothing in the air`)

      for (const group of result.groups) {
        const live = flightById(state, group.id)
        if (!live) continue
        writeFlight(live, group)
        // 8.1 puts a recovered group where its carrier is; nothing in 8.4
        // changes that, and a counter left at its last waypoint would launch
        // from empty space if the deck were ever cleared.
        live.position = carrier.placement.position
        live.facing = carrier.placement.facing
        live.recoveredTurn = state.turn
      }
      pushLog(state, {
        kind: 'note',
        shipId: carrier.id,
        side: carrier.side,
        text:
          `${carrier.name} takes ${result.landed} group(s) aboard in a combat landing — the deck ` +
          `is fouled and none of them fly again (8.4)`,
      })
      return OK
    }

    /**
     * 8.15: *"When Multi-Role Fighters are being refueled and rearmed in a
     * hangar bay, they may be reconfigured for another mission."*
     */
    case 'reconfigure-flight': {
      if (state.phase !== 'orders') return refuse('A group is re-configured in the bay, phase 1 (8.15)')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      const result = reconfigureMultiRole(flight, action.loadout, action.armament)
      if (!result.changed) return refuse(`${flight.label}: ${result.reason}`)
      writeFlight(flight, result.group)
      pushLog(state, {
        kind: 'note',
        side: flight.side,
        text: `${flight.label} re-arms as ${action.loadout} with ${action.armament}s (8.15)`,
      })
      return OK
    }
    case 'recover-flight': {
      // 8.1 lands a group on its fighter move; phase 6 works too and is where
      // a group that spent phase 4 elsewhere gets home, at the cost of the
      // secondary move's endurance.
      const secondary = state.phase === 'secondary-fighter-moves'
      if (state.phase !== 'move-fighters' && !secondary) {
        return refuse('A group lands on a fighter move, phase 4 or 6 (8.1)')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      const carrier = shipById(state, action.carrierId)
      if (!carrier) return refuse('No such carrier')
      if (carrier.destroyed || carrier.offTable) return refuse('Carrier is out of the battle')
      if (carrier.side !== flight.side) return refuse('A group lands on its own side’s ship')

      // "The fighter group moves into contact with the carrier in the Fighter
      // Movement Phase" (8.1) — so the flight home is part of the landing, and
      // it is flown under whichever phase's allowance applies.
      const home = carrier.placement.position
      const flown = secondary
        ? secondaryMoveFighterGroup(flight, home, carrier.placement.facing)
        : moveFighterGroup(flight, home, state.turn, carrier.placement.facing)
      if (!flown.moved) return refuse(`${flight.label}: ${flown.reason}`)

      const result = recoverFighterGroup(
        flown.group,
        carrierFlightState(state, carrier),
        state.turn,
        state.rng,
      )
      if (!result.recovered) return refuse(`${flight.label}: ${result.reason}`)

      writeFlight(flight, result.group)
      flight.carrierId = carrier.id
      flight.recoveredTurn = state.turn
      flight.targetId = null
      pushLog(state, {
        kind: 'launch',
        side: flight.side,
        shipId: carrier.id,
        text: `${carrier.name} recovers ${flight.label}${describeRearm(result.rearm)}`,
        dice: result.rearm ? [result.rearm.roll] : undefined,
      })
      return OK
    }

    case 'flight-strike': {
      if (state.phase !== 'ordnance-vs-ships' && state.phase !== 'ship-fire') {
        return refuse('Fighter attacks are resolved after point defence (8.7)')
      }
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.attackedThisTurn) return refuse(`${flight.label} has already attacked this turn`)
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (target.side === flight.side) return refuse('A group does not strafe its own fleet')

      const allowed = canDeclareAttack(flight, target.placement.position, { kind: 'ship' })
      if (!allowed.allowed) return refuse(`${flight.label}: ${allowed.reason}`)
      // 8.6: the screen has to be gone through first.
      const blocking = screenInTheWay(state, flight, target.id)
      if (blocking) {
        return refuse(
          `${flight.label} must engage ${blocking.label}, which is screening ${target.name} (8.6)`,
        )
      }
      // 8.17, if the table is playing it. An aborted attack is not a refused
      // action: the group flew the approach and lost its nerve, which is a
      // thing that happened and belongs in the journal.
      if (!fighterMoraleHolds(state, flight)) return OK

      const result = resolveAttackRun(
        flight,
        {
          screens: effectiveScreenLevel(target),
          advancedScreens: target.design.screens.advanced,
          rearArc: isRearArcAttack(
            target.placement.position,
            target.placement.facing,
            flight.position,
          ),
        },
        state.rng,
      )
      if (!result.fired) return refuse(`${flight.label}: ${result.reason}`)

      writeFlight(flight, result.group)
      flight.targetId = target.id
      pushLog(state, {
        kind: 'fire',
        side: flight.side,
        shipId: target.id,
        text: `${flight.label} strafes ${target.name}: ${result.detail}`,
        dice: result.dice,
      })
      applyFighterDamage(state, target, {
        normalDamage: result.normalDamage,
        penetratingDamage: result.penetratingDamage,
        mode: result.mode,
        dice: result.dice,
        detail: result.detail,
      })
      return OK
    }

    case 'flight-dogfight': {
      if (state.phase !== 'fighter-vs-fighter') return refuse('Dogfights are phase 8')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      const enemy = flightById(state, action.targetFlightId)
      if (!enemy) return refuse('No such enemy group')
      if (enemy.side === flight.side) return refuse('A group does not dogfight its own side')
      if (flight.attackedThisTurn) return refuse(`${flight.label} has already fought this turn`)

      const allowed = canDeclareAttack(flight, enemy.position, { kind: 'fighter' })
      if (!allowed.allowed) return refuse(`${flight.label}: ${allowed.reason}`)

      if (!fighterMoraleHolds(state, flight)) return OK

      // 8.18: "an Ace may either add an extra die to the group's overall
      // attack, OR may choose to specifically target an opposing Ace if there
      // is one present in the other group — in this case he rolls just one die
      // as normal." The only way an Ace dies before the rest of his group.
      if (action.aceDuel) {
        if (!optional(state).fighterQuality) {
          return refuse('Aces and Turkeys are not in play in this battle (8.18)')
        }
        const duel = aceDuel(flight, enemy, state.rng)
        if (!duel.fired) return refuse(`${flight.label}: ${duel.reason}`)
        writeFlight(enemy, duel.defender)
        flight.attackedThisTurn = true
        pushLog(state, {
          kind: 'fire',
          side: flight.side,
          dice: [duel.roll],
          text: duel.aceKilled
            ? `${flight.label}'s Ace picks out ${enemy.label}'s and shoots him down (8.18)`
            : `${flight.label}'s Ace duels ${enemy.label}'s and misses (8.18)`,
        })
        return OK
      }

      // 8.10: "All fire between fighter groups in a dogfight is considered
      // simultaneous", so both groups are written back from one resolution.
      const result = resolveDogfight(flight, enemy, state.rng)
      for (const group of result.groups) {
        const live = flightById(state, group.id)
        if (live) writeFlight(live, group)
      }
      for (const side of result.sides) {
        const shooter = flightById(state, side.groupId)
        if (!shooter) continue
        pushLog(state, {
          kind: 'fire',
          side: shooter.side,
          text: `${shooter.label} dogfights: ${side.kills} killed${side.exhausted ? ' (out of endurance)' : ''}`,
          dice: side.dice,
        })
      }
      return OK
    }

    case 'flight-intercept': {
      if (state.phase !== 'point-defence') return refuse('Fighters intercept missiles in phase 9')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      const markers = ordnanceOf(state)
      const marker = markers.find((m) => m.id === action.ordnanceId)
      if (!marker) return refuse('No such missile marker')
      if (marker.owner === flight.side) return refuse('A group does not shoot down its own missiles')
      if (marker.missiles <= 0) return refuse('That salvo is already gone')

      const allowed = canDeclareAttack(flight, marker.position, { kind: 'missile' })
      if (!allowed.allowed) return refuse(`${flight.label}: ${allowed.reason}`)

      if (!fighterMoraleHolds(state, flight)) return OK
      const result = interceptMissiles(
        flight,
        {
          kind: marker.kind === 'heavy' ? 'heavy' : 'salvo',
          count: marker.missiles,
          // 8.15: a light missile is "more easily destroyed", so every attack
          // against it is at +1. Only a Light Missile Fighter's salvo is.
          light: marker.light === true,
        },
        state.rng,
      )
      if (!result.intercepted) return refuse(`${flight.label}: ${result.reason}`)

      writeFlight(flight, result.group)
      marker.missiles = Math.max(0, marker.missiles - result.kills)
      setOrdnance(state, markers.filter((m) => m.missiles > 0))
      projectOrdnance(state)
      pushLog(state, {
        kind: 'point-defence',
        side: flight.side,
        text: `${flight.label} intercepts: ${result.kills} killed, ${result.losses} lost`,
        dice: [...result.rolls, ...result.casualtyRolls],
      })
      return OK
    }

    case 'flight-evade': {
      // 8.6: declared "After a player has announced fire against a fighter
      // group but before actually rolling the dice", which is the ship fire
      // phase — and there is no evading point defence.
      if (state.phase !== 'ship-fire') return refuse('Evasion answers ship fire, phase 11 (8.6)')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')

      const result = evadeShipFire(flight)
      if (!result.evaded) return refuse(`${flight.label}: ${result.reason}`)
      writeFlight(flight, result.group)
      pushLog(state, {
        kind: 'note',
        side: flight.side,
        text: `${flight.label} evades: ship weapons miss it for the rest of the turn (8.6)`,
      })
      return OK
    }

    case 'fire-at-flight': {
      if (state.phase !== 'ship-fire') return refuse('Ships fire in phase 11')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      const flight = flightById(state, action.flightId)
      if (!flight) return refuse('No such flight')
      if (flight.side === ship.side) return refuse('A ship does not shoot its own fighters')
      const flightActivation = openFiringActivation(state, ship)
      if (flightActivation) return flightActivation
      if (flight.status !== 'in-flight') return refuse(`${flight.label} is not on the table`)
      // 8.6: "Only groups that are not engaged … may be fired at."
      if (isEngaged(flight)) return refuse(`${flight.label} is engaged; ships may not fire into it (8.6, 8.10)`)

      if (isOutOfControl(ship, state.turn)) {
        return refuse(`${ship.name} is out of control and cannot fire (10.3)`)
      }
      if (ftlStageOf(ship, state.turn) !== null) {
        return refuse(`${ship.name} is entering hyperspace and cannot fire (11.4)`)
      }
      const weapon = ship.design.weapons.find((w) => w.id === action.weaponId)
      if (!weapon) return refuse('No such weapon')
      if (!canWeaponFire(ship, weapon.id)) return refuse(`${weapon.label} has already fired this turn`)
      const arc = arcTo(ship.placement.position, ship.placement.facing, flight.position)
      if (!bearingArcs(ship, weapon.arcs).includes(arc)) {
        return refuse(`${weapon.label} does not bear on ${flight.label}`)
      }
      if (aftArcBlocked(state, ship, arc)) {
        return refuse(`${ship.name} cannot fire through its own drive plume (4.2)`)
      }
      if (!hasLineOfFire(ship.placement.position, flight.position, blockingTerrain(state))) {
        return refuse(`${flight.label} is behind cover (17.1)`)
      }
      if (distance(ship.placement.position, flight.position) > maxRangeOf(weapon)) {
        return refuse(`${flight.label} is out of ${weapon.label}'s reach`)
      }
      // 8.6: "each fighter group targeted requires a separate FireCon." A
      // group already engaged this phase is free, exactly as a ship is (4.4).
      if (needsFireCon(weapon) && !assignFireCon(ship, flight.id, state.phase)) {
        return refuse(`No FireCon left to hold ${flight.label} (4.4, 8.6)`)
      }

      // "Ship to ship weapons roll 1D6 only against fighter groups, regardless
      // of range band or normal damage inflicted" (8.6) — so the mount's own
      // dice table does not come into it, and one mount is one die.
      const result = shipFireAtFighters(flight, 1, state.rng)
      markWeaponFired(ship, weapon.id, state.phase)
      writeFlight(flight, result.group)
      pushLog(state, {
        kind: 'fire',
        side: ship.side,
        shipId: ship.id,
        text: result.evaded
          ? `${ship.name}'s ${weapon.label} finds ${flight.label} evading: automatic miss (8.6)`
          : `${ship.name}'s ${weapon.label} at ${flight.label}: ${result.kills} killed`,
        dice: result.rolls,
      })
      return OK
    }

    // ── Cloaks (7.20 – 7.22) ──────────────────────────────────────────────
    case 'set-cloak': {
      // Written with the movement order, and nowhere else: the count is
      // declared in advance and cannot be revised once the turn is under way.
      if (state.phase !== 'orders') return refuse('A cloak is written in orders, phase 1 (7.20)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (!ship.cloak) return refuse(`${ship.name} has no cloak fitted`)

      if (!action.on) {
        ship.cloak = cancelCloakOrder(ship.cloak)
        return OK
      }
      if (cloakCapability(ship.cloak) === 'none') {
        return refuse(`${ship.name}'s cloak is knocked out (7.20)`)
      }
      const turns = Math.max(1, Math.floor(action.turns ?? 1))
      ship.cloak = orderCloak(ship.cloak, turns)
      pushLog(state, {
        kind: 'orders',
        shipId: ship.id,
        side: ship.side,
        // Written orders are the one secret in an open-book game (2.6).
        visibleTo: [ship.side],
        text: `${ship.name} will cloak for ${turns} turn${turns === 1 ? '' : 's'} (7.20)`,
      })
      return OK
    }

    case 'set-reflex-field': {
      if (state.phase !== 'orders') {
        return refuse('A Reflex Field is written in orders, phase 1 (7.25)')
      }
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (action.on && operationalCount(ship, 'reflex-field') === 0) {
        return refuse(`${ship.name} has no working Reflex Field`)
      }
      ship.reflexFieldActive = action.on
      if (action.on) {
        pushLog(state, {
          kind: 'orders',
          shipId: ship.id,
          side: ship.side,
          // Secret: "The opposing player is not told of the field's status
          // until the ship is fired upon" (7.25).
          visibleTo: [ship.side],
          text: `${ship.name} raises its Reflex Field — no weapons this turn (7.25)`,
        })
      }
      return OK
    }

    case 'plot-ram': {
      if (state.phase !== 'orders') return refuse('A ram is declared in orders (16.7)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (action.targetId === null) {
        ship.ramTargetId = null
        return OK
      }
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.side === ship.side) return refuse('A ship does not ram its own fleet')
      ship.ramTargetId = target.id
      pushLog(state, {
        kind: 'orders',
        shipId: ship.id,
        side: ship.side,
        visibleTo: [ship.side],
        text: `${ship.name} will attempt to ram ${target.name} (16.7)`,
      })
      return OK
    }

    case 'plot-gravity-turn': {
      const found = orderable(state, shipById(state, action.shipId))
      if (!('id' in found)) return found
      if (!Number.isInteger(action.points) || action.points < 0) {
        return refuse('A gravity turn is a magnitude; the direction is towards the centre (17.9)')
      }
      found.gravityTurn = action.points
      return OK
    }

    case 'plot-dock': {
      if (state.phase !== 'orders') return refuse('A docking approach is plotted in orders (16.6)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (ship.dock.phase !== 'free') return refuse(`${ship.name} is already docking (16.6)`)
      if (action.targetId === null) {
        ship.dockTargetId = null
        return OK
      }
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.id === ship.id) return refuse('A ship does not dock with itself')
      if (target.destroyed || target.offTable) return refuse('That target is out of the battle')
      ship.dockTargetId = target.id
      pushLog(state, {
        kind: 'orders',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} will attempt to dock with ${target.name} (16.6)`,
      })
      return OK
    }

    case 'plot-cast-off': {
      if (state.phase !== 'orders') return refuse('A cast-off is ordered in orders (16.6)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (!isDocked(ship.dock)) return refuse(`${ship.name} is not docked`)
      ship.dock = orderCastOff(ship.dock, state.turn)
      pushLog(state, {
        kind: 'orders',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} casts off — one full turn before it manoeuvres again (16.6)`,
      })
      return OK
    }

    case 'shift-table': {
      if (!optional(state).movingTable) {
        return refuse('The table only moves when the table agrees to it (16.4)')
      }
      if (!(action.distance > 0)) return refuse('A shift has to go somewhere')
      const offset = tableShift(action.crowding as ShiftEdge, action.distance)
      // Every object, or the rule is not a shift of the table: "because the
      // same offset is applied to every object, every range, bearing and arc
      // in the game is identical afterwards".
      const slide = (p: Point): Point => ({ x: p.x + offset.x, y: p.y + offset.y })
      for (const ship of state.ships) ship.placement = { ...ship.placement, position: slide(ship.placement.position) }
      for (const group of state.fighterGroups) group.position = slide(group.position)
      for (const squadron of state.gunboatSquadrons) squadron.position = slide(squadron.position)
      for (const marker of ordnanceOf(state)) marker.position = slide(marker.position)
      for (const feature of state.terrain) feature.position = slide(feature.position)
      projectOrdnance(state)
      pushLog(state, {
        kind: 'move',
        text:
          `The table slides ${action.distance} MU away from the ${action.crowding} edge ` +
          `— every range and bearing is unchanged (16.4)`,
      })
      return OK
    }

    case 'resolve-disengagement': {
      if (!optional(state).movingTable) {
        // 16.5's abstract roll is what you do *instead* of playing out the
        // stern chase, and 16.4's moving table is what makes a stern chase
        // possible at all. Without it, 3.9 has already settled the question.
        return refuse('A disengagement is rolled under the moving table rules (16.4, 16.5)')
      }
      const side = state.sides.find((s) => s.id === action.sideId)
      if (!side) return refuse('No such side')

      const mine = state.ships.filter((ship) => ship.side === side.id && !ship.destroyed)
      const check = readyToDisengage(
        mine.map((ship) => ({
          onTable: !ship.offTable,
          exitEdge: ship.exitEdge,
          thrust: currentThrust(ship),
        })),
      )
      if (!check.ready) return refuse(check.reason)

      const pursuing = state.ships.filter(
        (ship) =>
          ship.side !== side.id && !ship.destroyed && !ship.offTable && ship.carriedBy === null,
      )
      const result = resolveDisengagement(
        mine.map((ship) => currentThrust(ship)),
        pursuing.map((ship) => currentThrust(ship)),
        state.rng,
      )
      pushLog(state, {
        kind: 'note',
        side: side.id,
        dice: [result.disengagingRoll, result.pursuingRoll],
        text: `${side.name} tries to disengage by the ${check.edge} edge: ${result.detail} (16.5)`,
      })
      if (result.disengaged) return OK

      // "The fleeing player may then attempt the disengagement again by leaving
      // the opposite edge of the new playing area" — so the fleet comes back on
      // with the table slid under it, and the chase carries on.
      for (const ship of mine) {
        ship.offTable = false
        ship.exitEdge = null
      }
      pushLog(state, {
        kind: 'note',
        text: `The pursuit continues: ${side.name} is back on the new playing area (16.5)`,
      })
      return OK
    }

    /**
     * 11.5: a ship arrives out of hyperspace.
     *
     * *"The FTL entry is the ship's movement for that turn"*, so it happens in
     * phase 5 and the ship does not also fly. Scatter first — a D12 for the
     * direction on the course gauge and a D6 for the distance — and then the
     * danger roll, measured from where the ship actually turned up rather than
     * from where it meant to.
     *
     * The bystander clause is not conditional: anything within 6 MU takes 2D6
     * whatever the arriving ship rolled for itself, which is the opposite of
     * 11.4 and the easiest thing in section 11 to get backwards.
     */
    case 'enter-from-ftl': {
      if (state.phase !== 'move-ships') return refuse('An FTL entry is the ship\'s move, phase 5 (11.5)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed) return refuse('Ship is out of the battle')
      if (!ship.offTable) return refuse(`${ship.name} is already on the table`)
      if (ship.ftlArrival === null) return refuse(`${ship.name} is not inbound from hyperspace`)
      if (ship.lastKnown?.turn === state.turn) return refuse('Already moved this turn')
      if (ship.design.ftl === 'none') return refuse(`${ship.name} has no FTL drive`)

      const bounds = tableBounds(state)
      const result = resolveFtlEntry(
        {
          shipId: ship.id,
          turn: state.turn,
          entryPoint: action.entryPoint,
          course: action.course,
          velocity: action.velocity,
        },
        {
          advancedDrive: isAdvancedFtl(ship.design.ftl),
          bounds,
          hyperLimit: hyperLimitOf(state),
          nearby: state.ships
            .filter(
              (other) =>
                other.id !== ship.id &&
                !other.destroyed &&
                !other.offTable &&
                !other.captured &&
                // An attached rider is standing on its Mothership's counter;
                // counting it as a bystander would hurt the same group twice.
                other.carriedBy === null,
            )
            .map((other) => ({ id: other.id, position: other.placement.position })),
          // 11.5: "Ships carried by a tug or tender or battleriders carried by
          // a Mothership … move the same distance and direction as their
          // ship", so a formation arrives as a formation.
          carried: carriedHulls(state, ship.id).map((rider) => ({
            id: rider.id,
            position: rider.placement.position,
          })),
          lightCraft: [
            ...state.fighterGroups
              .filter((group) => group.status === 'in-flight')
              .map((group) => ({ id: group.id, position: group.position })),
            ...state.gunboatSquadrons
              .filter((group) => group.status === 'in-flight')
              .map((group) => ({ id: group.id, position: group.position })),
            ...state.ordnance.map((marker) => ({ id: marker.id, position: marker.position })),
          ],
        },
        state.rng,
      )

      if (result.refusal) return refuse(`${ship.name}: ${result.refusal}`)

      ship.lastKnown = {
        course: action.course,
        velocity: action.velocity,
        turn: state.turn,
        cloaked: false,
      }
      ship.ftlArrival = null
      ship.ftlTransit = 'none'

      if (result.barredFromBattle) {
        // "deemed unable to enter the table during the battle" — it is out
        // there somewhere and it is not coming.
        pushLog(state, {
          kind: 'move',
          shipId: ship.id,
          side: ship.side,
          dice: [result.scatter.directionRoll, result.scatter.distanceRoll].filter(
            (die): die is number => die !== null,
          ),
          text: `${ship.name} drops out too far off station and misses the battle (11.5)`,
        })
        return OK
      }
      if (!result.entered || !result.arrival) {
        pushLog(state, {
          kind: 'move',
          shipId: ship.id,
          side: ship.side,
          text: `${ship.name} does not arrive: ${result.scatter.note}`,
        })
        return OK
      }

      ship.offTable = false
      ship.exitEdge = null
      ship.reentryTurn = null
      ship.placement = { position: result.arrival, facing: action.course }
      // "its current velocity being applied from the start of the next" turn:
      // the entry IS the move, so nothing else happens to the ship now.
      ship.velocity = action.velocity
      // 11.7: "If the Mothership makes an FTL entry, the battleriders cannot
      // detach and move independently until the next turn."
      ship.ftlEntryTurn = state.turn
      // The load arrives with the hull that brought it, at the same
      // displacement rather than the same point (11.5).
      for (const moved of result.carried) {
        const rider = shipById(state, moved.id)
        if (!rider) continue
        rider.placement = { position: moved.to, facing: action.course }
        rider.velocity = action.velocity
        rider.offTable = false
      }
      pushLog(state, {
        kind: 'move',
        shipId: ship.id,
        side: ship.side,
        dice: [result.scatter.directionRoll, result.scatter.distanceRoll].filter(
          (die): die is number => die !== null,
        ),
        text: `${ship.name} drops out of hyperspace: ${result.scatter.note}`,
      })

      const danger = result.danger
      if (danger) {
        // 11.5: "Damage from FTL entry or exit cannot be absorbed by screens or
        // armor."
        const hurt = (target: ShipState, damage: number, dice: number[], why: string): void => {
          if (damage <= 0) return
          markHullBoxes(target, damage)
          pushLog(state, {
            kind: 'damage',
            shipId: target.id,
            side: target.side,
            dice,
            text: `${target.name}: ${damage} from ${why}, past screens and armour (11.5)`,
          })
          if (target.destroyed) {
            pushLog(state, {
              kind: 'destroyed',
              shipId: target.id,
              text: `${target.name} is destroyed`,
            })
          }
        }
        hurt(
          ship,
          danger.selfDamage,
          [danger.roll, danger.secondRoll].filter((die): die is number => die !== null),
          'its own arrival',
        )
        for (const hit of danger.bystanders) {
          const other = shipById(state, hit.id)
          if (other) hurt(other, hit.damage, hit.dice, `${ship.name} arriving on top of it`)
        }
        for (const id of danger.lightCraftDestroyed) {
          const group =
            state.fighterGroups.find((g) => g.id === id) ??
            state.gunboatSquadrons.find((g) => g.id === id)
          if (group) {
            group.status = 'destroyed'
            pushLog(state, {
              kind: 'destroyed',
              text: `${group.label} is caught in ${ship.name}'s arrival (11.5)`,
            })
          }
          setOrdnance(
            state,
            ordnanceOf(state).filter((marker) => marker.id !== id),
          )
        }
        projectOrdnance(state)
      }
      return OK
    }

    // ── Jump Gates and Portals (11.9, 11.10) ─────────────────────────────

    /**
     * 11.9: *"The player writes a 'Gate Activate' order at the beginning of
     * the turn and announces the activation when ships are moved."*
     *
     * The split matters. Writing in phase 1 and announcing in phase 5 means
     * the decision is taken before initiative is rolled, which is the whole
     * point of writing orders down; collapsing the two would let an attacker
     * wait to see who moves last before committing to the gate.
     */
    case 'plot-gate-activation': {
      if (state.phase !== 'orders') {
        return refuse('A Gate Activate order is written in orders, phase 1 (11.9)')
      }
      const gate = gateById(state, action.gateId)
      if (!gate) return refuse('No such gate')
      if (gate.def.natural) {
        return refuse(`${gateName(gate)} is a natural jump point and needs no activation (11.10)`)
      }
      if (!action.on) {
        gate.activationOrderedBy = null
        gate.activationOrderTurn = null
        return OK
      }
      const side = action.side
      if (!state.sides.some((candidate) => candidate.id === side)) return refuse('No such side')
      gate.activationOrderedBy = side
      gate.activationOrderTurn = state.turn
      pushLog(state, {
        kind: 'orders',
        side,
        text: `Gate Activate ordered for ${gateName(gate)} (11.9)`,
      })
      return OK
    }

    /**
     * The announcement, and the roll (11.9).
     *
     * Whose dice these are is the trap: *"the defender rolls a D6"* — the
     * player who does **not** control the gate — even though it is the
     * attacker who wants it switched on.
     */
    case 'announce-gate-activation': {
      if (state.phase !== 'move-ships') {
        return refuse('A gate activation is announced when ships are moved, phase 5 (11.9)')
      }
      const gate = gateById(state, action.gateId)
      if (!gate) return refuse('No such gate')
      if (gate.def.natural) {
        return refuse(`${gateName(gate)} is a natural jump point and needs no activation (11.10)`)
      }
      const side = gate.activationOrderedBy
      if (side === null || gate.activationOrderTurn !== state.turn) {
        return refuse(`No Gate Activate order was written for ${gateName(gate)} this turn (11.9)`)
      }
      const result = gateActivation(
        { ...gate.def, playerControlled: gate.controllingSide === side },
        state.turn,
        state.rng,
      )
      gate.state = { ...gate.state, activeFromTurn: result.activeFromTurn }
      gate.activationOrderedBy = null
      gate.activationOrderTurn = null
      pushLog(state, {
        kind: 'note',
        side,
        dice: result.roll === null ? undefined : [result.roll],
        text: `${gateName(gate)}: ${result.note} — usable from turn ${result.activeFromTurn}`,
      })
      return OK
    }

    /**
     * 11.9: a ship arrives through a gate — *"placed on the gate with an
     * initial course that is 180° opposite … and then moves the distance
     * specified by the velocity order."*
     *
     * No scatter and no danger roll: *"Ships that enter or exit normal space
     * through a Jump Gate or Portal never suffer from direction or distance
     * errors, unlike normal FTL Drives."* A natural jump point still
     * disorientates whoever comes through it (11.10).
     */
    case 'gate-entry': {
      if (state.phase !== 'move-ships') return refuse('A gate entry is the ship’s move, phase 5 (11.9)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed) return refuse('Ship is out of the battle')
      if (!ship.offTable) return refuse(`${ship.name} is already on the table`)
      if (ship.lastKnown?.turn === state.turn) return refuse('Already moved this turn')
      const gate = gateById(state, action.gateId)
      if (!gate) return refuse('No such gate')
      if (!isGateActive(gate.def, gate.state, state.turn)) {
        return refuse(`${gateName(gate)} is not active (11.9)`)
      }

      const result = gateEntry(gate.def, {
        velocity: action.velocity,
        driveRating: currentThrust(ship),
        course: action.course,
      })
      if (!result.placed) return refuse(`${ship.name}: ${result.reason}`)
      const course = result.course
      if (course === null) return refuse(`${ship.name}: the gate gave no course`)

      ship.offTable = false
      ship.exitEdge = null
      ship.reentryTurn = null
      ship.ftlArrival = null
      ship.awaitingGate = null
      ship.ftlTransit = 'none'
      ship.lastKnown = { course, velocity: action.velocity, turn: state.turn, cloaked: false }
      ship.placement = { position: result.position, facing: course }
      ship.velocity = action.velocity
      pushLog(state, {
        kind: 'move',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} comes through ${gateName(gate)} on course ${course} at velocity ${action.velocity} (11.9)`,
      })
      disorientIfJumpPoint(state, ship, gate)
      dragCarriedHulls(state, ship)
      return OK
    }

    /**
     * 11.9's linked pair: *"If for some reason both ends of the Portal are on
     * the playing area, a ship exiting through one and entering again through
     * the other does so with the same velocity that it entered."*
     *
     * The velocity crosses untouched — it is not re-ordered, so the drive
     * rating does not cap it — and two Jump Gates cannot do this at all,
     * because *"The two Jump Gates are not linked."*
     */
    case 'portal-hop': {
      if (state.phase !== 'move-ships') return refuse('A portal hop is the ship’s move, phase 5 (11.9)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (ship.carriedBy !== null) return refuse(`${ship.name} is not flying its own move (11.7)`)
      if (ship.lastKnown?.turn === state.turn) return refuse('Already moved this turn')
      const gate = gateById(state, action.gateId)
      if (!gate) return refuse('No such gate')
      const far = gate.pairedGateId === undefined ? undefined : gateById(state, gate.pairedGateId)
      if (!far) return refuse(`${gateName(gate)} has no far end on the table (11.9)`)
      if (!isGateActive(gate.def, gate.state, state.turn)) {
        return refuse(`${gateName(gate)} is not active (11.9)`)
      }
      if (distance(ship.placement.position, gate.def.position) > GATE_REACH) {
        return refuse(`${ship.name} is not at ${gateName(gate)}`)
      }
      if (!gateBearsOn(gate.def, ship.placement.position)) {
        return refuse(`${ship.name} is not on ${gateName(gate)}'s working side (11.9)`)
      }

      const result = portalPairTransit(
        gate.def,
        far.def,
        ship.velocity,
        far.def.facing === null ? ship.placement.facing : undefined,
      )
      if (!result.placed) return refuse(`${ship.name}: ${result.reason}`)
      const course = result.course
      if (course === null) return refuse(`${ship.name}: the far end gave no course`)

      ship.lastKnown = {
        course: ship.placement.facing,
        velocity: ship.velocity,
        turn: state.turn,
        cloaked: ship.cloaked,
      }
      ship.placement = { position: result.position, facing: course }
      pushLog(state, {
        kind: 'move',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} crosses from ${gateName(gate)} to ${gateName(far)}, still making ${ship.velocity} (11.9)`,
      })
      disorientIfJumpPoint(state, ship, far)
      dragCarriedHulls(state, ship)
      return OK
    }

    /**
     * 11.9's transfer out, and the most inverted table in section 11.
     *
     * *"roll 1D6 die for each ship. On a roll of 1 the ship transferred
     * successfully, on a roll of 2 it manages to back out in time … on a roll
     * of 3 or higher it is destroyed."* One is the good result and two thirds
     * of the die kills the ship — the opposite of 11.4, and a reader who
     * carries that habit across here will lose a fleet.
     */
    case 'gate-transfer': {
      if (state.phase !== lastPhaseOf(state)) {
        return refuse('A gate transfer happens at the end of the turn (11.9)')
      }
      const gate = gateById(state, action.gateId)
      if (!gate) return refuse('No such gate')
      const ships = action.shipIds.map((id) => shipById(state, id))
      if (ships.some((ship) => ship === undefined)) return refuse('No such ship')
      const going = ships.filter((ship): ship is ShipState => ship !== undefined)
      if (going.length === 0) return refuse('No ships named for the transfer')
      for (const ship of going) {
        if (ship.destroyed || ship.offTable) return refuse(`${ship.name} is out of the battle`)
        if (ship.captured) return refuse(`${ship.name} is a prize and does not transfer (12.7)`)
        if (distance(ship.placement.position, gate.def.position) > GATE_REACH) {
          return refuse(`${ship.name} is not at ${gateName(gate)}`)
        }
        if (!gateBearsOn(gate.def, ship.placement.position)) {
          return refuse(`${ship.name} is not on ${gateName(gate)}'s working side (11.9)`)
        }
      }

      const result = resolveGateTransfer(
        gate.def,
        gate.state,
        going.map((ship) => ({ id: ship.id, mass: ship.design.mass })),
        state.turn,
        state.rng,
      )
      if (result.refused) return refuse(`${gateName(gate)}: ${result.refused}`)

      pushLog(state, {
        kind: 'note',
        side: going[0]?.side,
        text: `${gateName(gate)}: ${result.note}`,
      })
      for (const outcome of result.ships) {
        const ship = shipById(state, outcome.id)
        if (!ship) continue
        const dice = outcome.roll === null ? undefined : [outcome.roll]
        if (outcome.outcome === 'transferred') {
          // Gone from the table the way an FTL exit goes: not destroyed, not
          // disengaged under fire, simply somewhere else.
          ship.offTable = true
          ship.reentryTurn = null
          ship.ftlTransit = 'none'
          pushLog(state, {
            kind: 'move',
            shipId: ship.id,
            side: ship.side,
            dice,
            text: `${ship.name} transfers out through ${gateName(gate)} (11.9)`,
          })
        } else if (outcome.outcome === 'backed-out' && outcome.position) {
          ship.placement = { position: outcome.position, facing: ship.placement.facing }
          ship.velocity = outcome.velocity ?? 0
          pushLog(state, {
            kind: 'move',
            shipId: ship.id,
            side: ship.side,
            dice,
            text: `${ship.name} backs out of ${gateName(gate)} in time and sits there dead in space (11.9)`,
          })
        } else {
          markHullBoxes(ship, ship.design.hullBoxes)
          pushLog(state, {
            kind: 'destroyed',
            shipId: ship.id,
            side: ship.side,
            dice,
            text: `${ship.name} is torn apart in ${gateName(gate)} (11.9)`,
          })
        }
        dragCarriedHulls(state, ship)
      }
      return OK
    }

    /**
     * Shooting a gate (11.9). An artificial one has hull boxes and its
     * capacity falls with them; a natural one *"cannot be destroyed by normal
     * weapons fire"* and the shot is refused rather than wasted.
     */
    case 'fire-at-gate': {
      if (state.phase !== 'ship-fire') return refuse('Ships fire in phase 11')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (ship.captured) return refuse(`${ship.name} is a prize and out of the fight (12.7)`)
      if (isOutOfControl(ship, state.turn)) {
        return refuse(`${ship.name} is out of control and cannot fire (10.3)`)
      }
      const gate = gateById(state, action.gateId)
      if (!gate) return refuse('No such gate')
      if (gate.def.natural) {
        return refuse(`${gateName(gate)} cannot be destroyed by normal weapons fire (11.9)`)
      }
      const gateActivationSpent = openFiringActivation(state, ship)
      if (gateActivationSpent) return gateActivationSpent
      const weapon = ship.design.weapons.find((w) => w.id === action.weaponId)
      if (!weapon) return refuse('No such weapon')
      if (!canWeaponFire(ship, weapon.id)) return refuse(`${weapon.label} has already fired this turn`)
      const arc = arcTo(ship.placement.position, ship.placement.facing, gate.def.position)
      if (!bearingArcs(ship, weapon.arcs).includes(arc)) {
        return refuse(`${weapon.label} does not bear on ${gateName(gate)}`)
      }
      if (aftArcBlocked(state, ship, arc)) {
        return refuse(`${ship.name} cannot fire through its own drive plume (4.2)`)
      }
      const range = distance(ship.placement.position, gate.def.position)
      if (range > maxRangeOf(weapon)) return refuse(`${gateName(gate)} is out of ${weapon.label}'s reach`)
      if (!hasLineOfFire(ship.placement.position, gate.def.position, blockingTerrain(state))) {
        return refuse(`${gateName(gate)} is behind cover (17.1)`)
      }
      if (needsFireCon(weapon) && !assignFireCon(ship, gate.def.id, state.phase)) {
        return refuse(`No FireCon left to hold ${gateName(gate)} (4.4)`)
      }

      // A gate is a structure: no screens, no armour, nothing but hull boxes,
      // so what the mount rolled is what comes off it, penetrating damage and
      // all — there is nothing for the split to mean.
      const shot = fireWeapon(weapon, {
        range,
        arc,
        targetScreens: 0,
        rearArc: false,
        drm: 0,
        rng: state.rng,
      })
      if ('refused' in shot) return refuse(shot.refused)
      const damage = shot.normalDamage + shot.penetratingDamage
      const before = currentTransferMass(gate.def, gate.state)
      gate.state = {
        ...gate.state,
        hullMarked: Math.min(gate.def.hullBoxes, gate.state.hullMarked + damage),
      }
      const after = currentTransferMass(gate.def, gate.state)
      markWeaponFired(ship, weapon.id, state.phase)
      pushLog(state, {
        kind: 'damage',
        shipId: ship.id,
        side: ship.side,
        dice: shot.dice,
        text:
          `${ship.name}'s ${weapon.label} into ${gateName(gate)}: ${damage} — ` +
          (after < before
            ? `transfer mass down from ${before} to ${after} (11.9)`
            : `${gate.def.hullBoxes - gate.state.hullMarked} hull boxes left`),
      })

      // 11.9 makes the transfer roll turn on damage *or* on the gate's FTL
      // having "failed a threshold check", so a gate must be able to fail one.
      //
      // **[reading]** The threshold points are the same 10% bands 11.9 already
      // uses to cut the transfer mass, and the check is 4.11's. A gate has hull
      // boxes but no printed rows, so the section gives no other place to put a
      // threshold point; taking the one it does state keeps the rule inside the
      // arithmetic the reader already has. The alternative — never rolling —
      // would leave half of 11.9's own transfer condition unreachable.
      const band = Math.max(1, Math.ceil(gate.def.hullBoxes * GATE_HULL_FRACTION))
      const bandsBefore = Math.floor((gate.state.hullMarked - damage) / band)
      const bandsAfter = Math.floor(gate.state.hullMarked / band)
      if (!gate.state.ftlFailed && bandsAfter > bandsBefore) {
        const check = thresholdCheck(bandsAfter, bandsAfter - bandsBefore - 1, state.rng)
        if (check.destroyed) gate.state = { ...gate.state, ftlFailed: true }
        pushLog(state, {
          kind: 'note',
          side: ship.side,
          dice: [check.roll],
          text: check.destroyed
            ? `${gateName(gate)}'s FTL fails its threshold check — every ship through it now rolls (11.9, 4.11)`
            : `${gateName(gate)}'s FTL holds its threshold check (11.9, 4.11)`,
        })
      }
      return OK
    }

    /**
     * 11.7: *"If the Mothership makes an FTL entry, the battleriders cannot
     * detach and move independently until the next turn."*
     *
     * A rider that lets go keeps the Mothership's course and velocity — it has
     * been flying them all along — and from this moment it is a ship like any
     * other: it flies its own move, and it can be shot at.
     */
    case 'detach-hull': {
      if (state.phase !== 'orders') return refuse('A rider detaches in orders (11.7)')
      const rider = shipById(state, action.shipId)
      if (!rider) return refuse('No such ship')
      if (rider.destroyed) return refuse('Ship is out of the battle')
      if (rider.carriedBy === null) return refuse(`${rider.name} is not attached to anything`)
      const carrier = shipById(state, rider.carriedBy)
      if (!carrier) return refuse(`${rider.name} has nothing to detach from`)
      if (!canDetachBattlerider(carrier.ftlEntryTurn, state.turn)) {
        return refuse(
          `${carrier.name} came out of hyperspace this turn; its riders cannot detach until the next (11.7)`,
        )
      }
      rider.carriedBy = null
      rider.placement = {
        position: { ...carrier.placement.position },
        facing: carrier.placement.facing,
      }
      rider.velocity = carrier.velocity
      if (carrier.damageSink === rider) carrier.damageSink = null
      pushLog(state, {
        kind: 'note',
        shipId: rider.id,
        side: rider.side,
        text: `${rider.name} detaches from ${carrier.name} at course ${carrier.placement.facing}, velocity ${carrier.velocity} (11.7)`,
      })
      return OK
    }

    /**
     * 11.7's defender's choice, validated by `allocateBattleriderDamage` rather
     * than made by it: which hull in the attached group the damage lands on.
     */
    case 'nominate-damage-sink': {
      const carrier = shipById(state, action.shipId)
      if (!carrier) return refuse('No such ship')
      if (carrier.destroyed) return refuse('Ship is out of the battle')
      const riders = carriedHulls(state, carrier.id)
      if (riders.length === 0) return refuse(`${carrier.name} is not carrying anything (11.7)`)
      if (action.sinkId === null) {
        carrier.damageSink = null
        pushLog(state, {
          kind: 'note',
          shipId: carrier.id,
          side: carrier.side,
          text: `${carrier.name} takes its own damage again (11.7)`,
        })
        return OK
      }
      const sink = riders.find((rider) => rider.id === action.sinkId)
      if (!sink) {
        const defence = attachedBattleriderDefence(
          carrier.id,
          riders.map((rider) => rider.id),
        )
        // The engine builds the split and this checks it, which is the same
        // check a hand-written allocation would get.
        const problems = allocateBattleriderDamage(1, [{ unitId: action.sinkId, damage: 1 }], defence)
        return refuse(problems[0] ?? `${action.sinkId} is not attached to ${carrier.name} (11.7)`)
      }
      carrier.damageSink = sink
      pushLog(state, {
        kind: 'note',
        shipId: carrier.id,
        side: carrier.side,
        text: `${carrier.name} puts the damage it takes on ${sink.name} (11.7)`,
      })
      return OK
    }

    case 'plot-ftl-exit': {
      if (state.phase !== 'orders') return refuse('An FTL exit is announced in orders (11.4)')
      const ship = shipById(state, action.shipId)
      if (!ship) return refuse('No such ship')
      if (ship.destroyed || ship.offTable) return refuse('Ship is out of the battle')
      if (!action.on) {
        ship.ftlTransit = 'none'
        ship.ftlWarmupTurn = null
        return OK
      }
      if (ship.design.ftl === 'none') return refuse(`${ship.name} has no FTL drive`)
      if (ship.cloaked) return refuse(`${ship.name} is cloaked and cannot enter hyperspace (7.20)`)
      if (ship.ftlWarmupTurn !== null) return refuse(`${ship.name} is already spinning up`)
      // 11.2: inside a hyper limit the jump is not attempted and fails, it is
      // simply not available — "FTL entry or exit is only permitted by player
      // agreement or scenario design". Refused in phase 1, before the drive
      // has spent a turn spinning up for nothing.
      const permission = ftlPermittedAt(ship.placement.position, hyperLimitOf(state))
      if (!permission.permitted) return refuse(`${ship.name} is ${permission.reason}`)
      ship.ftlTransit = 'exiting'
      ship.ftlWarmupTurn = state.turn
      pushLog(state, {
        kind: 'orders',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} spins up its FTL drive — no thrust and no guns until it is gone (11.4)`,
      })
      return OK
    }

    // ── Gunboats (9, phases 4, 6 and 10) ──────────────────────────────────
    case 'launch-gunboats': {
      if (state.phase !== 'move-fighters') {
        return refuse('Gunboats launch with the fighters, in phase 4 (9.1)')
      }
      const squadron = squadronById(state, action.squadronId)
      if (!squadron) return refuse('No such squadron')
      const carrier = shipById(state, action.carrierId)
      if (!carrier) return refuse('No such carrier')
      if (squadron.carrierId !== carrier.id) {
        return refuse(`${squadron.label} is not aboard ${carrier.name}`)
      }
      if (carrier.destroyed || carrier.offTable) return refuse('Carrier is out of the battle')
      if (isOutOfControl(carrier, state.turn)) {
        return refuse(`${carrier.name} is out of control (10.3)`)
      }

      const result = launchGunboatSquadron(
        squadron,
        gunboatCarrierState(state, carrier),
        state.turn,
        carrier.placement.position,
        carrier.placement.facing,
      )
      if (!result.launched) return refuse(`${squadron.label}: ${result.reason}`)
      writeSquadron(squadron, result.squadron)
      pushLog(state, {
        kind: 'launch',
        side: squadron.side,
        shipId: carrier.id,
        text: `${carrier.name} launches ${squadron.label}`,
      })
      return OK
    }

    case 'move-gunboats': {
      const secondary = state.phase === 'secondary-fighter-moves'
      if (state.phase !== 'move-fighters' && !secondary) {
        return refuse('Gunboats move with the fighters, phases 4 and 6 (9.1)')
      }
      const squadron = squadronById(state, action.squadronId)
      if (!squadron) return refuse('No such squadron')
      if (secondary ? squadron.secondaryMovedThisTurn : squadron.movedThisTurn) {
        return refuse(`${squadron.label} has already moved this phase`)
      }

      const facing = squadronFacingAfterMove(squadron, action.to, action.facing)
      const result = secondary
        ? secondaryMoveGunboatSquadron(squadron, action.to, facing)
        : moveGunboatSquadron(squadron, action.to, facing)
      if (!result.moved) return refuse(`${squadron.label}: ${result.reason}`)
      writeSquadron(squadron, result.squadron)
      if (secondary) {
        pushLog(state, {
          kind: 'move',
          side: squadron.side,
          text: `${squadron.label} moves again, ${squadron.cef} CEF left`,
        })
      }
      return OK
    }

    case 'gunboat-attack': {
      // 9.1: "Gunboats then make their attacks in the Fighter Attack Phase
      // (phase 10)" — the same phase a fighter's attack run is resolved in.
      if (state.phase !== 'ordnance-vs-ships' && state.phase !== 'ship-fire') {
        return refuse('Gunboats attack in phase 10 (9.1)')
      }
      const squadron = squadronById(state, action.squadronId)
      if (!squadron) return refuse('No such squadron')
      const target = shipById(state, action.targetId)
      if (!target) return refuse('No such target')
      if (target.destroyed || target.offTable) return refuse('Target is out of the battle')
      if (target.side === squadron.side) return refuse('A squadron does not shoot its own fleet')

      const range = distance(squadron.position, target.placement.position)
      const result = resolveGunboatAttack(
        squadron,
        {
          screens: effectiveScreenLevel(target),
          range,
          arc: arcTo(target.placement.position, target.placement.facing, squadron.position),
        },
        state.rng,
      )
      if (!result.fired) return refuse(`${squadron.label}: ${result.reason}`)

      writeSquadron(squadron, result.squadron)
      squadron.targetId = target.id
      pushLog(state, {
        kind: 'fire',
        side: squadron.side,
        shipId: target.id,
        text:
          `${squadron.label} attacks ${target.name}: ` +
          `${result.normalDamage} damage, ${result.penetratingDamage} penetrating`,
        dice: result.dice,
      })
      // Unlike a fighter, a gunboat's guns are ship guns (9.1), so the
      // optional rear-arc rule of 4.10 applies to them as it does to a
      // cruiser's — 8.9's "no advantage" is written about fighters only.
      applyFighterDamage(
        state,
        target,
        {
          normalDamage: result.normalDamage,
          penetratingDamage: result.penetratingDamage,
          mode: result.mode,
          dice: result.dice,
          detail: result.shots.map((shot) => shot.detail).join('; '),
        },
        {
          rearArcRule: optional(state).rearArcAttacks,
          rearArc: isRearArcAttack(
            target.placement.position,
            target.placement.facing,
            squadron.position,
          ),
        },
      )
      return OK
    }

    case 'recover-gunboats': {
      const secondary = state.phase === 'secondary-fighter-moves'
      if (state.phase !== 'move-fighters' && !secondary) {
        return refuse('A squadron lands on a fighter move, phase 4 or 6 (9.1)')
      }
      const squadron = squadronById(state, action.squadronId)
      if (!squadron) return refuse('No such squadron')
      const carrier = shipById(state, action.carrierId)
      if (!carrier) return refuse('No such carrier')
      if (carrier.destroyed || carrier.offTable) return refuse('Carrier is out of the battle')
      if (carrier.side !== squadron.side) return refuse('A squadron lands on its own side’s ship')

      // Fly it home first, under this phase's allowance, exactly as a wing.
      const home = carrier.placement.position
      const facing = carrier.placement.facing
      const flown = secondary
        ? secondaryMoveGunboatSquadron(squadron, home, facing)
        : moveGunboatSquadron(squadron, home, facing)
      if (!flown.moved) return refuse(`${squadron.label}: ${flown.reason}`)

      const result = recoverGunboatSquadron(
        flown.squadron,
        gunboatCarrierState(state, carrier),
        state.turn,
      )
      if (!result.recovered) return refuse(`${squadron.label}: ${result.reason}`)
      writeSquadron(squadron, result.squadron)
      squadron.carrierId = carrier.id
      pushLog(state, {
        kind: 'launch',
        side: squadron.side,
        shipId: carrier.id,
        text: `${carrier.name} recovers ${squadron.label}, refuelled and rearmed (9.1)`,
      })
      return OK
    }

    default:
      // Every action in the union has a handler above, and `action` is `never`
      // here, so declaring a new one without writing its case is a compile
      // error rather than a runtime refusal nobody reads. Two actions had sat
      // in the union with no case at all, answering "Not yet implemented" to
      // anything that sent them; this is what stops a third.
      return exhaustive(action)
  }
}

/** A branch the type system says cannot be reached. */
function exhaustive(action: never): ActionOutcome {
  return refuse(`Unhandled action: ${JSON.stringify(action)}`)
}

// ---------------------------------------------------------------------------
// Ordnance in flight
// ---------------------------------------------------------------------------

/**
 * Missile markers on the table.
 *
 * `ordnance.ts` has a richer marker than `GameState` does — it carries a facing
 * and the distance flown, which a seeker needs and a counter on a map does not
 * — so the authoritative list lives here and `GameState.ordnance` carries a
 * projection of it for drawing. The projection is derived and never read back,
 * and both are rebuilt identically by a replay, so nothing about this is a
 * second source of truth.
 */
/**
 * 17.5's battle debris, kept beside the state rather than in it.
 *
 * The same shape as the ordnance markers one screen down, and for the same
 * reasons: a `DebrisCloud` carries a diameter, a course, a velocity and the
 * turn it was made on, none of which a `TerrainFeature` has room for, and
 * widening `TerrainFeature` would widen a type that rides inside saved custom
 * scenarios for a value no scenario author will ever write. What the map and
 * 17.4 need — a disc of the right size in the right place — is projected into
 * `state.terrain`, where `FIELD_TERRAIN` already treats a `debris` feature as
 * a meteor field, which is exactly what 17.5 says it is: *"any ship
 * encountering the cloud treats it exactly as for the meteor and debris rules
 * given in the section above"*.
 */
const DEBRIS = new WeakMap<GameState, DebrisCloud[]>()

function debrisOf(state: GameState): DebrisCloud[] {
  let clouds = DEBRIS.get(state)
  if (!clouds) {
    clouds = []
    DEBRIS.set(state, clouds)
  }
  return clouds
}

/** Copy the clouds into `state.terrain`, for drawing and for 17.4. */
function projectDebris(state: GameState): void {
  state.terrain = state.terrain.filter((feature) => !feature.id.startsWith('debris-'))
  for (const cloud of debrisOf(state)) {
    state.terrain.push({
      id: cloud.id,
      kind: 'debris',
      position: { ...cloud.position },
      radius: cloud.diameter / 2,
      label: 'battle debris (17.5)',
    })
  }
}

/**
 * The explosion check on a ship that has just died (17.5).
 *
 * *"Note the amount of excess damage inflicted (over that required to reduce
 * the ship to zero points) and roll a D6. If the score is less than or equal to
 * the excess damage then the remains of the ship explode."* Run as a sweep at
 * every phase boundary rather than at each of the seven places a ship can die,
 * so that a beam kill and a missile kill are treated the same way — the excess
 * itself is recorded by `markHullBoxes`, which is the sole writer of hull
 * damage.
 */
function sweepDebris(state: GameState): void {
  if (!optional(state).terrainHazards) return
  const clouds = debrisOf(state)
  let made = false
  for (const ship of state.ships) {
    if (!ship.destroyed || ship.excessDamage === null) continue
    const excess = ship.excessDamage
    ship.excessDamage = null
    const check = explosionCheck(excess, 0, state.rng)
    if (!check.explodes) continue
    clouds.push(
      createDebrisCloud({
        id: `debris-${ship.id}`,
        position: ship.placement.position,
        course: ship.placement.facing,
        velocity: ship.velocity,
        turn: state.turn,
        group: ship.design.group,
      }),
    )
    made = true
    pushLog(state, {
      kind: 'destroyed',
      shipId: ship.id,
      side: ship.side,
      dice: check.roll === null ? undefined : [check.roll],
      text: `${ship.name} blows apart — ${excess} points of overkill leaves a debris cloud (17.5)`,
    })
  }
  if (made) projectDebris(state)
}

/**
 * Drift the clouds and retire the expired ones (17.5).
 *
 * *"The debris cloud exists for only 1 turn after the explosion"*, which is one
 * turn of danger straddling a turn boundary — so the sweep runs as the movement
 * phase opens, beside the ordnance, rather than in the per-turn reset, which
 * would kill the cloud before the turn it is supposed to be dangerous in.
 */
function driftDebris(state: GameState): void {
  const clouds = debrisOf(state)
  if (clouds.length === 0) return
  DEBRIS.set(
    state,
    clouds.map(moveDebrisCloud).filter((cloud) => !debrisCloudExpired(cloud, state.turn)),
  )
  projectDebris(state)
}

/**
 * 8.6's screen, standing between an attacking group and what it came for.
 *
 * *"Whenever a ship or group that is being escorted by a fighter screen comes
 * under attack from enemy fighters, the attacking group(s) must engage the
 * screening fighters using the dogfighting rules instead of attacking the ship
 * … Each group of screening fighters must be engaged by at least one attacking
 * fighter group, but once this condition has been satisfied any further
 * uncommitted attacking groups may fire on the escorted ship."*
 *
 * Returns the screen this group must take instead, or null when the run may go
 * in: either nothing is screening the target, or every screen already has an
 * attacker on it and this group is one of 8.6's *"further uncommitted"* ones.
 */
function screenInTheWay(
  state: GameState,
  flight: FighterGroupState,
  targetId: string,
): FighterGroupState | null {
  const screens = state.fighterGroups.filter(
    (group) =>
      group.mission === 'screen' &&
      group.escorting === targetId &&
      group.status === 'in-flight' &&
      group.strength > 0 &&
      group.side !== flight.side,
  )
  if (screens.length === 0) return null

  // Everyone on this side going for the same hull, in a fixed order so the
  // pairing is the same on every replay.
  const attackers = state.fighterGroups
    .filter(
      (group) =>
        group.side === flight.side &&
        group.status === 'in-flight' &&
        group.strength > 0 &&
        (group.targetId === targetId || group.id === flight.id),
    )
    .map((group) => group.id)
    .sort()

  const { pairings } = assignScreenEngagements(attackers, screens.map((screen) => screen.id))
  const mine = pairings.find((pair) => pair.attackerId === flight.id)
  if (!mine) return null
  return screens.find((screen) => screen.id === mine.screenId) ?? null
}

/**
 * 8.6's screens and pursuits, moved with the ship they are tied to.
 *
 * *"A fighter screen … always moves at the same time as the ship it is
 * screening, rather than being moved in the first Fighter Movement Phase.
 * Screening fighters can exceed the normal fighter movement allowance if the
 * ship they are screening is moving faster than the fighters could normally
 * move."* No allowance and no endurance: the group is station-keeping, not
 * flying a move of its own.
 *
 * A group tied to something that has been destroyed, has left, or has drifted
 * out of reach is on its own again — *"if it is moved further away, then it
 * has broken off from its escorting duties"*.
 */
function dragEscortingFlights(state: GameState, ship: ShipState): void {
  for (const group of state.fighterGroups) {
    if (group.status !== 'in-flight' || group.mission === 'free') continue
    if (group.escorting !== ship.id) continue
    if (ship.destroyed || ship.offTable) {
      group.mission = 'free'
      group.escorting = null
      continue
    }
    const result = moveWithEscortedShip(group, ship.placement.position, ship.placement.facing)
    if (!result.moved) continue
    writeFlight(group, result.group)
    // The station is kept, so this can only report a break for a group the
    // rule has already moved onto its ship. It is here rather than skipped
    // because 8.6 words the test as a check made after the move, and a future
    // change that moves a screen some other way should still be caught by it.
    if (screenHasBrokenOff(group, ship.placement.position)) {
      group.mission = 'free'
      group.escorting = null
      pushLog(state, {
        kind: 'move',
        side: group.side,
        text: `${group.label} has drifted off station and is no longer screening (8.6)`,
      })
    }
  }
}

/**
 * 4.4, phase 9: which marker each point-defence mount has been told to engage,
 * where the player has told it.
 *
 * Per-turn scratch keyed on the game, like every other marker in this file:
 * rebuilt by replay from the actions, never serialised. Keyed by mount id,
 * which is unique across the table because a system id is unique to a design
 * and a mount belongs to one ship.
 */
const PD_ORDERS = new WeakMap<GameState, Map<string, string>>()

function pdOrders(state: GameState): Map<string, string> {
  let orders = PD_ORDERS.get(state)
  if (!orders) {
    orders = new Map()
    PD_ORDERS.set(state, orders)
  }
  return orders
}

/**
 * Which point-defence table a marker is shot down on (6.4, 6.6).
 *
 * A rocket is 6.7's "as if they were conventional missiles", so it takes the
 * salvo table; a plasma bolt and a mine are not shot at here at all.
 */
function pdThreatKind(kind: OrdnanceKind, reading: number): PdTargetKind {
  if (kind === 'heavy') return 'heavy-missile'
  if (kind === 'antimatter' && reading >= 4) return 'antimatter-missile'
  return 'salvo-missile'
}

/**
 * 2.6's firing activation: whose it is, and when it closed.
 *
 * > *"After a ship has fired some or all of its weaponry and play has moved on
 * > to another ship that ship may not fire any other ship to ship weapons in
 * > that game turn."*
 *
 * So a ship's fire is one activation, not one shot: it may fire everything it
 * has, and the moment somebody else fires it is finished for the turn. That is
 * what stops a player dribbling one mount at a time across the phase to watch
 * each result before committing the next.
 *
 * `hasFiredThisTurn` and `canShipFire` have carried this rule since the state
 * was written; `markShipFired` was called on the *first* weapon of an
 * activation and `canShipFire` was read by nothing, so the flag went true
 * immediately and stopped nobody.
 *
 * Stamped with the turn and phase rather than cleared by a hook, so a stale
 * entry from an earlier phase cannot close an activation in this one.
 */
const FIRING_ACTIVATION = new WeakMap<GameState, { shipId: string; turn: number; phase: Phase }>()

/**
 * Open this ship's firing activation, closing whoever had it (2.6).
 *
 * Returns a refusal if the ship has already had its turn's fire, and null when
 * the activation is open and the shot may go ahead.
 */
function openFiringActivation(state: GameState, ship: ShipState): ActionOutcome | null {
  if (rulesReading(state) < 5) return null
  const open = FIRING_ACTIVATION.get(state)
  const live = open !== undefined && open.turn === state.turn && open.phase === state.phase
  if (live && open.shipId === ship.id) return ship.hasFiredThisTurn ? spent(ship) : null
  if (ship.hasFiredThisTurn) return spent(ship)
  if (live) {
    // Play has moved on. Whoever was firing is finished for the turn.
    const previous = shipById(state, open.shipId)
    if (previous) markShipFired(previous)
  }
  FIRING_ACTIVATION.set(state, { shipId: ship.id, turn: state.turn, phase: state.phase })
  return null
}

function spent(ship: ShipState): ActionOutcome {
  return refuse(
    `${ship.name} has had its fire this turn — play moved on to another ship (2.6)`,
  )
}

/** The point-defence mounts on this hull that could still fire (phase 9). */
export function pointDefenceMounts(ship: ShipState): Array<{ id: string; label: string }> {
  return pdMountsOf(ship).map((mount) => ({
    id: mount.id,
    label: ship.design.systems.find((system) => system.id === mount.id)?.label ?? mount.id,
  }))
}

/** The marker this mount has been aimed at, or null for doctrine (phase 9). */
export function pointDefenceOrder(state: GameState, mountId: string): string | null {
  return pdOrders(state).get(mountId) ?? null
}

/**
 * Groups that have already aborted this turn, so morale is rolled once.
 * Per-turn scratch, rebuilt by replay and never serialised.
 */
const MORALE_ABORTED = new WeakMap<GameState, Set<string>>()

/**
 * 8.17's morale check, made before the group attacks.
 *
 * *"Any fighter group that has lost one or more members must roll a D6 before
 * making an attack. If the roll is less than or equal to the number of
 * fighters remaining in the group, the attack is carried out; if greater than
 * the number of remaining fighters, they abort this attack and do not fire.
 * Any group that fails an attack roll is not considered to have expended
 * combat endurance for that turn."*
 *
 * **[reading]** *"an attack"* covers all three ways a group attacks: an attack
 * run on a ship, a dogfight, and an intercept. 8.17 names none of them
 * specifically and the reason it gives — a mauled group losing its nerve —
 * does not distinguish between them. Read the other way, a half-dead group
 * would press a dogfight it would refuse against a hull.
 *
 * Returns true when the attack goes in. A refusal spends no endurance, which
 * is why this reports rather than the caller assuming.
 */
function fighterMoraleHolds(state: GameState, flight: FighterGroupState): boolean {
  if (!optional(state).fighterMorale) return true
  // A group that has already lost its nerve this turn does not get asked
  // again: "they abort this attack and do not fire". Without this the player
  // could re-dispatch the same attack until the die went their way, which is
  // not a morale rule, it is a re-roll.
  let aborted = MORALE_ABORTED.get(state)
  if (!aborted) {
    aborted = new Set()
    MORALE_ABORTED.set(state, aborted)
  }
  const key = `${flight.id}:${state.turn}`
  if (aborted.has(key)) return false

  const result = fighterMoraleCheck(flight, state.rng)
  if (!result.applies || result.attacks) return true
  aborted.add(key)
  pushLog(state, {
    kind: 'fire',
    side: flight.side,
    dice: result.roll === null ? undefined : [result.roll],
    text: `${flight.label} will not press the attack — ${result.reason}`,
  })
  return false
}

// ---------------------------------------------------------------------------
// After the boarding action (12.7 - 12.10)
// ---------------------------------------------------------------------------

/**
 * A prize is out of the fight (12.7).
 *
 * *"If a ship is 'destroyed' by Boarding Parties or Marines it is considered
 * captured. While the ship is captured, the ship cannot be used in that
 * combat."* Not destroyed — an intact hull in somebody else's hands, which is
 * a different thing for the scoreboard, for 12.8's morale and for the enemy
 * commander deciding whether to shoot it.
 */
function isOutOfAction(ship: ShipState): boolean {
  return ship.destroyed || ship.captured
}

/**
 * 12.10's civil war, worked out from the two orders of battle.
 *
 * *"If both fleets are composed of ships built by the same navy"* — a property
 * of the pairing, so it is answered once for the battle rather than shot by
 * shot, and a single foreign hull anywhere takes the bonus away from everyone.
 */
function civilWarHere(state: GameState): boolean {
  if (!optional(state).civilWar) return false
  const bySide = new Map<SideId, string[]>()
  for (const ship of state.ships) {
    const list = bySide.get(ship.side) ?? []
    list.push(ship.design.faction)
    bySide.set(ship.side, list)
  }
  const fleets = [...bySide.values()]
  // 12.10 is written for two fleets. With three sides on the table the
  // condition is that every one of them is the same navy.
  if (fleets.length < 2) return false
  return fleets.every((fleet, index) => index === 0 || isCivilWar(fleets[0], fleet))
}

/**
 * Roll for the Marines and the boarders when a hull row goes (12.7, 13.13).
 *
 * 13.13 puts Marines on the SSD as systems, so 4.11's dice find them like
 * anything else — except that *"Marines and Boarding Parties cannot be killed
 * in a threshold test caused by boarding combat"*, and an attacking party
 * *"cannot be lost to threshold checks caused on the turn they boarded"*.
 *
 * No optional-rule flag: this is a base rule of 12.7, but it only draws dice
 * for a ship that has Marines aboard or boarders on it, and a boarding action
 * can only have started inside an action a journal written before any of this
 * existed never contained.
 */
function partiesInThreshold(state: GameState, ship: ShipState, rowsLost: number, extraRows: number): void {
  if (ship.destroyed || rowsLost <= 0) return
  // "caused by boarding combat": if nothing but the boarders put a row in
  // this turn, neither side's parties are at risk.
  if (!ship.hullHitByWeapons) return

  const target = thresholdTarget(rowsLost)
  const roll = () => d6(state.rng) + extraRows >= target

  let marinesLost = 0
  for (let i = 0; i < ship.marinesAboard; i++) if (roll()) marinesLost += 1
  if (marinesLost > 0) {
    ship.marinesAboard = Math.max(0, ship.marinesAboard - marinesLost)
    pushLog(state, {
      kind: 'threshold',
      shipId: ship.id,
      side: ship.side,
      text: `${ship.name} loses ${marinesLost} Marine part${marinesLost === 1 ? 'y' : 'ies'} to the damage (12.7)`,
    })
  }

  for (const force of ship.boarders) {
    if (!boardersAtRiskInThreshold(force, 'weapons', state.turn)) continue
    let lost = 0
    for (let i = 0; i < Math.floor(force.parties); i++) if (roll()) lost += 1
    if (lost === 0) continue
    force.parties = Math.max(0, force.parties - lost)
    pushLog(state, {
      kind: 'threshold',
      shipId: ship.id,
      side: force.side,
      text: `${lost} boarding part${lost === 1 ? 'y' : 'ies'} aboard ${ship.name} killed by the damage (12.7)`,
    })
  }
  ship.boarders = ship.boarders.filter((force) => Math.floor(force.parties) > 0)
}

/**
 * The surrender roll of 12.9, *"at the same time as any threshold check"*.
 *
 * A captain who strikes hands the ship to the nearest enemy vessel, which is
 * a capture by another road: the hull is intact and out of the fight.
 */
function strikeTheColors(state: GameState, ship: ShipState, rowsLost: number, extraRows: number): void {
  if (!optional(state).strikeColors) return
  if (isOutOfAction(ship) || ship.offTable || rowsLost <= 0) return

  const captor = nearestEnemyVessel(
    ship.placement.position,
    ship.side,
    state.ships
      .filter((other) => !isOutOfAction(other) && !other.offTable && other.side !== ship.side)
      .map((other) => ({ id: other.id, side: other.side, position: other.placement.position })),
  )
  // "surrender to the nearest enemy vessel": with nobody to surrender to, a
  // captain keeps fighting whatever they have decided.
  if (!captor) return

  const result = strikeColorsCheck(
    {
      rowsLost,
      extraRows,
      mode: optional(state).coreSystems ? 'core-system' : 'system',
      captorSide: captor.side,
    },
    state.rng,
  )
  if (!result.struck) return

  ship.captured = true
  ship.capturedBy = captor.side
  pushLog(state, {
    kind: 'boarding',
    shipId: ship.id,
    side: ship.side,
    dice: result.rolled === null ? undefined : [result.rolled],
    text: `${ship.name} strikes her colors and surrenders to ${captor.side} (12.9)`,
  })
}

/**
 * Report a fleet that has lost enough to break (12.8).
 *
 * There is no die and no compulsion: *"it would be quite likely that the
 * admirals on either side would consider the preservation of their own ships
 * and crew to be quite a high priority."* So it is said once, when the line is
 * crossed, and what the commander does about it is 3.9 and the player.
 */
const BROKEN = new WeakMap<GameState, Set<SideId>>()

function reportFleetMorale(state: GameState): void {
  let broken = BROKEN.get(state)
  if (!broken) {
    broken = new Set()
    BROKEN.set(state, broken)
  }
  for (const side of state.sides) {
    if (broken.has(side.id)) continue
    const report = fleetMorale(
      state.ships
        .filter((ship) => ship.side === side.id)
        .map((ship) => ({
          mass: ship.design.mass,
          destroyed: ship.destroyed,
          captured: ship.captured,
          offTable: ship.offTable,
        })),
    )
    if (!report.withdraw) continue
    broken.add(side.id)
    pushLog(state, {
      kind: 'note',
      side: side.id,
      text:
        `${side.name} has lost ${Math.round(report.fraction * 100)}% of its mass — enough for a ` +
        `commander to break off (12.8)`,
    })
  }
}

// ---------------------------------------------------------------------------
// FTL entry and the hyper limit (11.2, 11.5)
// ---------------------------------------------------------------------------

/**
 * The scenario's hyper limits, if it has any (11.2).
 *
 * Held on the scenario rather than in `GameState`, because it describes the
 * system the battle is fought in and not anything that changes during it —
 * and because a `GameState` field would have to be serialised into every
 * saved battle that has no hyper limit at all.
 */
const HYPER_LIMITS = new WeakMap<GameState, HyperLimitRules>()

export function setHyperLimit(state: GameState, rules: HyperLimitRules | undefined): void {
  if (rules) HYPER_LIMITS.set(state, rules)
}

function hyperLimitOf(state: GameState): HyperLimitRules | undefined {
  return HYPER_LIMITS.get(state)
}

// ---------------------------------------------------------------------------
// Jump Gates and Portals (11.9, 11.10)
// ---------------------------------------------------------------------------

/**
 * How close a ship has to be to use a gate.
 *
 * **[reading]** 11.9 says a transferring ship *"must be at the gate"* and puts
 * a backed-out one *"at the location of the gate"*, without a distance. One MU
 * is the table's own answer to "the same place" — it is what 17.8 uses for two
 * hulls sharing an orbit marker — and a measured tolerance is needed because
 * a ship's move lands it where the arithmetic puts it, not on a point.
 */
export const GATE_REACH = 1

export function gateById(state: GameState, id: string): TableGate | undefined {
  return state.gates.find((gate) => gate.def.id === id)
}

function gateName(gate: TableGate): string {
  return gate.def.label ?? (gate.def.kind === 'portal' ? 'the Portal' : 'the Jump Gate')
}

/** The last phase this battle plays, which is where 11.9 puts the transfer. */
function lastPhaseOf(state: GameState): Phase {
  return state.phases[state.phases.length - 1] as Phase
}

/**
 * 11.10: *"Ships exiting a jump point function as if they have taken a bridge
 * critical hit until the next turn."*
 *
 * Natural jump points only. An artificial gate is engineered arrival — 11.9
 * sells them on *"a more accurate arrival point"* — and says nothing about
 * disorientation; 11.10 is where the recommendation lives, and it is about
 * jump points.
 */
function disorientIfJumpPoint(state: GameState, ship: ShipState, gate: TableGate): void {
  if (!gate.def.natural) return
  const effect = jumpPointDisorientation(state.turn)
  ship.ongoing.push({
    id: `jump-point-${ship.id}-${state.turn}`,
    source: effect.source,
    appliedTurn: effect.appliedTurn,
    expiresAfterTurn: effect.expiresAfterTurn,
    note: effect.note,
  })
  pushLog(state, {
    kind: 'note',
    shipId: ship.id,
    side: ship.side,
    text: `${ship.name} comes out of ${gateName(gate)} disorientated — out of control until next turn (11.10)`,
  })
}

/**
 * Whether a ship is still shaking off a jump point (11.10).
 *
 * `isOutOfControl` already covers what the disorientation *does*; this says
 * where it came from, so the order panel can tell a player their ship is not
 * steering because of the jump point rather than because of a bridge hit.
 */
export function isJumpPointDisoriented(state: GameState, ship: ShipState): boolean {
  const held = ship.ongoing.find((effect) => effect.source === 'jump-point')
  if (!held) return false
  return isDisoriented(
    {
      ...jumpPointDisorientation(held.appliedTurn),
      expiresAfterTurn: held.expiresAfterTurn ?? held.appliedTurn,
    },
    state.turn,
  )
}

/** Ships waiting behind a gate to come onto the table (11.9). */
export function shipsAwaitingGateEntry(state: GameState): ShipState[] {
  return state.ships.filter((ship) => ship.awaitingGate !== null && !ship.destroyed)
}

/** Ships still in hyperspace, waiting to drop out (11.5). */
export function shipsAwaitingFtlEntry(state: GameState): ShipState[] {
  return state.ships.filter((ship) => ship.ftlArrival !== null && !ship.destroyed)
}

// ---------------------------------------------------------------------------
// Mines (6.9, 6.10)
// ---------------------------------------------------------------------------

// Markers on the table between turns, like the missiles, and rebuilt by replay
// rather than saved. The tracks are this turn's flown paths: 6.9 fires a mine
// on anything that entered its radius "at any point during movement, not just
// at the end of a move", and a minelayer moves before its victims do, so the
// question can only be answered once everyone has moved.
const MINES = new WeakMap<GameState, MineMarker[]>()
const TRACKS = new WeakMap<GameState, Map<string, Point[]>>()

function minesOf(state: GameState): MineMarker[] {
  let mines = MINES.get(state)
  if (!mines) {
    mines = []
    MINES.set(state, mines)
  }
  return mines
}

function tracksOf(state: GameState): Map<string, Point[]> {
  let tracks = TRACKS.get(state)
  if (!tracks) {
    tracks = new Map()
    TRACKS.set(state, tracks)
  }
  return tracks
}

/** Copy the mines into GameState for drawing, beside the other markers. */
function projectMines(state: GameState): void {
  const others = state.ordnance.filter((marker) => marker.kind !== 'mine')
  state.ordnance = [
    ...others,
    ...minesOf(state).map((mine) => ({
      id: mine.id,
      side: mine.owner,
      sourceShipId: mine.sourceShipId,
      kind: 'mine' as const,
      grade: 'standard' as const,
      missiles: 1,
      position: mine.position,
      launchedTurn: mine.laidTurn,
      stagesRemaining: 0,
      targetShipId: null,
    })),
  ]
}

/**
 * Drop this ship's mines as it goes — **phase 5** (6.10).
 *
 * *"Each minelayer system fitted may deploy one mine per turn, so a ship with
 * two mine systems may drop two markers during its movement."* They go along
 * the path the ship actually flew, spaced down it, because that is what
 * dropping something out of a moving ship looks like.
 */
function dropMines(state: GameState, ship: ShipState, path: readonly Point[]): void {
  if (!ship.layingMines || ship.destroyed || ship.offTable) return
  const racks = ship.design.weapons.filter(
    (weapon) => weapon.weaponClass === 'mine-rack' && !ship.destroyedSystems.has(weapon.id),
  )
  if (racks.length === 0) return

  const mines = minesOf(state)
  const requests = racks.map((rack, index) => ({
    id: `mine-${state.turn}-${mines.length + index + 1}-${ship.id}-${rack.id}`,
    owner: ship.side,
    sourceShipId: ship.id,
    // Spread down the flown path: the first goes where the ship started the
    // move, the last where it finished.
    position: pointAlong(path, racks.length === 1 ? 1 : index / (racks.length - 1)),
    turn: state.turn,
  }))
  // 6.10 counts loads off a magazine symbol no design in this roster buys, so
  // the cap is the racks themselves: one mine each, every turn.
  const result = layMines(requests, { layers: racks.length, loads: racks.length })
  mines.push(...result.mines)
  projectMines(state)
  pushLog(state, {
    kind: 'launch',
    shipId: ship.id,
    side: ship.side,
    text: `${ship.name} lays ${result.mines.length} mine(s) astern (6.10)`,
  })
}

/** A point a fraction of the way down a flown path. */
function pointAlong(path: readonly Point[], fraction: number): Point {
  if (path.length === 0) return { x: 0, y: 0 }
  if (path.length === 1) return path[0]
  const spans: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const span = distance(path[i - 1], path[i])
    spans.push(span)
    total += span
  }
  if (total === 0) return path[0]
  let want = Math.max(0, Math.min(1, fraction)) * total
  for (let i = 0; i < spans.length; i++) {
    if (want <= spans[i] || i === spans.length - 1) {
      const at = spans[i] === 0 ? 0 : want / spans[i]
      return {
        x: path[i].x + (path[i + 1].x - path[i].x) * at,
        y: path[i].y + (path[i + 1].y - path[i].y) * at,
      }
    }
    want -= spans[i]
  }
  return path[path.length - 1]
}

/**
 * Set off every mine that something flew past — the end of **phase 5** (6.9).
 *
 * *"All enemy vessels that enter the radius from the mine marker, at any point
 * during movement, not just at the end of a move, will be detected and fired
 * on by the mine."* A mine fires once: *"After a mine has detonated, remove its
 * marker from the table at the end of the movement phase."*
 */
function resolveMines(state: GameState): void {
  const mines = minesOf(state)
  const tracks = tracksOf(state)
  if (mines.length > 0 && tracks.size > 0) {
    const triggers = minesTriggeredBy(
      mines,
      [...tracks.entries()].flatMap(([shipId, path]) => {
        const ship = shipById(state, shipId)
        if (!ship || ship.destroyed || ship.offTable) return []
        return [{ shipId, owner: ship.side, path }]
      }),
      state.turn,
    )
    for (const trigger of triggers) {
      const target = shipById(state, trigger.shipId)
      if (!target || target.destroyed) continue
      const result = resolveMineAttack(effectiveScreenLevel(target), state.rng)
      const applied = applyDamage(targetStateOf(target), result, { source: 'ordnance' })
      writeBackDamage(target, applied.target)
      markHullBoxes(target, applied.hullDamage)
      pushLog(state, {
        kind: applied.hullDamage > 0 ? 'damage' : 'fire',
        targetId: target.id,
        dice: result.dice,
        text: `A mine goes off ${trigger.approach.toFixed(1)} MU from ${target.name}: ${result.detail}`,
      })
      if (target.destroyed) {
        pushLog(state, { kind: 'destroyed', shipId: target.id, text: `${target.name} is destroyed` })
      }
    }
    const spent = new Set(triggers.map((trigger) => trigger.mineId))
    MINES.set(state, mines.filter((mine) => !spent.has(mine.id)))
    projectMines(state)
  }
  tracks.clear()
}

// ---------------------------------------------------------------------------
// Leaving and re-entering the table (3.9, 17.7)
// ---------------------------------------------------------------------------

type TableCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

function cornerPoint(corner: TableCorner, bounds: Bounds): Point {
  const x = corner === 'top-left' || corner === 'bottom-left' ? bounds.minX : bounds.maxX
  const y = corner === 'top-left' || corner === 'top-right' ? bounds.minY : bounds.maxY
  return { x, y }
}

const CORNERS: readonly TableCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

/** 17.7 measures from *"the nearest table corner at the point of exit"*. */
function nearestCorner(position: Point, bounds: Bounds): TableCorner {
  let best: TableCorner = CORNERS[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const corner of CORNERS) {
    const d = distance(position, cornerPoint(corner, bounds))
    if (d < bestDistance - 1e-9) {
      bestDistance = d
      best = corner
    }
  }
  return best
}

/** The corner across the table's diagonal, which 17.7 re-enters relative to. */
function oppositeCorner(corner: TableCorner): TableCorner {
  switch (corner) {
    case 'top-left':
      return 'bottom-right'
    case 'top-right':
      return 'bottom-left'
    case 'bottom-left':
      return 'top-right'
    case 'bottom-right':
      return 'top-left'
  }
}

function oppositeEdge(edge: TableEdge): TableEdge {
  switch (edge) {
    case 'top':
      return 'bottom'
    case 'bottom':
      return 'top'
    case 'left':
      return 'right'
    case 'right':
      return 'left'
  }
}

/** Whether a point sits on the named edge of the table, within a hair. */
function onEdge(position: Point, edge: TableEdge, bounds: Bounds): boolean {
  const slack = 0.5
  switch (edge) {
    case 'left':
      return Math.abs(position.x - bounds.minX) <= slack
    case 'right':
      return Math.abs(position.x - bounds.maxX) <= slack
    case 'top':
      return Math.abs(position.y - bounds.minY) <= slack
    case 'bottom':
      return Math.abs(position.y - bounds.maxY) <= slack
  }
}

// ---------------------------------------------------------------------------
// Orbits and atmosphere (17.8, 17.11)
// ---------------------------------------------------------------------------

/** The orbit track a body carries, or null for a body that has none (17.8). */
function orbitTrackOf(feature: TerrainFeature): OrbitTrack | null {
  if (!feature.orbit) return null
  return {
    center: feature.position,
    radius: feature.radius,
    orbitalVelocity: feature.orbit.velocity,
    orbitSpeed: feature.orbit.speed,
  }
}

/** The body a ship is in orbit around, with its track. */
function orbitOf(
  state: GameState,
  ship: ShipState,
): { feature: TerrainFeature; track: OrbitTrack; marker: Course } | null {
  if (!ship.orbit) return null
  const feature = state.terrain.find((f) => f.id === ship.orbit?.featureId)
  if (!feature) return null
  const track = orbitTrackOf(feature)
  if (!track) return null
  return { feature, track, marker: ship.orbit.marker }
}

/** Put a ship on the track at a marker, facing the way 17.8 says it faces. */
function placeInOrbit(ship: ShipState, feature: TerrainFeature, track: OrbitTrack, marker: Course): void {
  ship.orbit = { featureId: feature.id, marker }
  // 17.8 gives satellites and starbases the opposite rule to ships: they
  // "always face 'away' from the center of the planet", so a station at marker
  // 4 points outward along course 4 whichever way the track runs.
  const satellite = isSatellite(ship)
  ship.placement = {
    position: orbitMarkerPosition(track, marker),
    // For a ship: "face forward in the closest course facing to the orbit path
    // at that point", which reading 13 makes the exact tangent.
    facing: satellite ? satelliteFacing(marker) : orbitFacing(marker, track.orbitSpeed),
  }
  // A satellite has no drive to hold a velocity with; 17.8 gives it an orbit
  // speed and nothing else, so it keeps whatever the scenario gave it.
  if (!satellite) ship.velocity = track.orbitalVelocity
}

/**
 * 17.8's other kind of thing in orbit: *"A planet may have satellites or
 * starbases in orbit."*
 *
 * They are given an orbit speed and no velocity rules at all, which is the
 * only reading that works: a station has no main drive, so under the ship
 * rules its velocity of zero would be below the orbital velocity and every
 * starbase in the game would fall out of the sky on turn one.
 */
function isSatellite(ship: ShipState): boolean {
  return ship.design.group === 'station'
}

/**
 * A ship falling into a world's atmosphere (17.11).
 *
 * Its three outcomes are a landing, a burn-up the small craft get out of, and
 * a burn-up nobody gets out of. The middle one is why aboard wings are put
 * into the air here rather than written off with the hull: *"there is enough
 * time for any interface craft (shuttles, drop ships, etc.), fighters, or life
 * pods on board to launch."*
 */
function enterAtmosphere(
  state: GameState,
  ship: ShipState,
  feature: TerrainFeature,
  velocity: number,
  why: string,
): void {
  const result = resolveAtmosphericEntry(
    {
      streamlining: ship.design.streamlining,
      velocity,
      orbitalVelocity: feature.orbit?.velocity ?? 0,
      drive: ship.driveHits >= 2 ? 'knocked-out' : ship.driveHits === 1 ? 'damaged' : 'intact',
    },
    state.rng,
  )
  ship.orbit = null
  const name = feature.label ?? 'the planet'

  if (result.outcome === 'crash-lands') {
    ship.landed = 'crash-landed'
    ship.offTable = true
    pushLog(state, {
      kind: 'note',
      shipId: ship.id,
      side: ship.side,
      dice: [result.roll],
      text:
        `${ship.name} ${why} and rides the entry down: a ballistic crash-landing on ${name} ` +
        `(17.11, ${result.modified})`,
    })
    return
  }

  const escaping =
    result.outcome === 'burns-up-crew-escape'
      ? state.fighterGroups.filter(
          (group) => group.carrierId === ship.id && group.status === 'aboard' && group.strength > 0,
        )
      : []
  for (const group of escaping) {
    group.status = 'in-flight'
    group.position = ship.placement.position
    group.facing = ship.placement.facing
    group.launchedTurn = state.turn
    group.carrierId = null
  }

  ship.destroyed = true
  pushLog(state, {
    kind: 'destroyed',
    shipId: ship.id,
    side: ship.side,
    dice: [result.roll],
    text:
      `${ship.name} ${why} and burns up over ${name} (17.11, ${result.modified})` +
      (escaping.length > 0
        ? ` — ${escaping.length} group(s) got clear`
        : result.outcome === 'burns-up'
          ? ' with all hands'
          : ''),
  })
}

/**
 * A move that meets an orbit track (17.8). True when the ship met one at all,
 * however that turned out.
 *
 * A ship that makes orbit has not flown into the planet, and one that goes
 * into the atmosphere has already had the worst of it, so either way the
 * collision rules downstream have nothing left to do.
 */
function resolveOrbitEntry(state: GameState, ship: ShipState, path: readonly Point[]): boolean {
  if (ship.destroyed || ship.offTable || ship.orbit) return false
  for (const feature of state.terrain) {
    const track = orbitTrackOf(feature)
    if (!track) {
      if (resolveSimpleApproach(state, ship, feature, path)) return true
      continue
    }
    if (!pathMeetsOrbitTrack(track, path)) continue

    const name = feature.label ?? 'the planet'
    switch (orbitTrackArrival(ship.velocity, track)) {
      case 'in-orbit': {
        const marker = nearestOrbitMarker(track, ship.placement.position)
        placeInOrbit(ship, feature, track, marker)
        pushLog(state, {
          kind: 'move',
          shipId: ship.id,
          side: ship.side,
          text: `${ship.name} makes orbit around ${name} at marker ${marker} (17.8)`,
        })
        return true
      }
      case 'decaying':
        // 17.8: below the orbital velocity the orbit decays on arrival, and
        // 17.11 is where that ends.
        enterAtmosphere(state, ship, feature, ship.velocity, `arrives at ${name} too slow to hold orbit`)
        return true
      case 'uncontrolled-entry':
        enterAtmosphere(state, ship, feature, ship.velocity, `hits ${name}'s atmosphere at speed`)
        return true
    }
  }
  return false
}

/**
 * 17.10, the whole of it: *"the super simple and totally unrealistic way"*.
 *
 * No track and no markers. Pass the objective between 2 and 3 MU at velocity 6
 * to 8 and the ship is in orbit; go wider and it flies past; go closer and the
 * gravity well has it. A body opts into this instead of 17.8's track, because
 * 17.7 offers the two as alternatives and means it.
 *
 * A ship "in orbit" here is simply parked: 17.10 gives no orbit speed, no
 * markers and no way round, so the ship holds its station at the point of
 * closest approach until its owner accelerates away.
 */
function resolveSimpleApproach(
  state: GameState,
  ship: ShipState,
  feature: TerrainFeature,
  path: readonly Point[],
): boolean {
  if (!feature.simpleOrbit) return false
  const closest = closestApproach(path, feature.position)
  // Only an approach counts. A ship that stayed well clear has not approached.
  if (closest > SIMPLE_ORBIT_BAND.outer + EPSILON_MU) return false

  const name = feature.label ?? 'the objective'
  switch (simpleOrbitApproach(ship.velocity, closest)) {
    case 'orbit':
      ship.velocity = 0
      pushLog(state, {
        kind: 'move',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} settles into orbit over ${name} at ${closest.toFixed(1)} MU (17.10)`,
      })
      return true
    case 'destroyed':
      ship.destroyed = true
      pushLog(state, {
        kind: 'destroyed',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} passes inside ${name}'s gravity well and crashes (17.10)`,
      })
      return true
    case 'flies-past':
      // Not a failure worth a log line of its own every turn: the ship simply
      // carried on, which is what the plot already shows.
      return false
  }
}

/** A hair, for a measurement the rule states in whole MU. */
const EPSILON_MU = 1e-6

/**
 * One turn for a ship already in orbit (17.8).
 *
 * *"The player simply notes that it is in orbit and moves the ship by a number
 * of points equal to the orbit speed around the track. Any velocity change will
 * cause the ship to leave orbit, either down or up."* So the only order that
 * means anything up here is the throttle.
 */
function moveInOrbit(state: GameState, ship: ShipState): ActionOutcome {
  const orbit = orbitOf(state, ship)
  if (!orbit) {
    ship.orbit = null
    return refuse('The body this ship was orbiting is gone')
  }
  // A tug or Mothership going round the track takes its load round with it,
  // the same as it would flying (11.6, 11.7). Deferred so it reads off wherever
  // the orbit leaves the carrier, whichever branch below that turns out to be.
  const dragged = (outcome: ActionOutcome): ActionOutcome => {
    dragCarriedHulls(state, ship)
    return outcome
  }
  const { feature, track } = orbit
  const name = feature.label ?? 'the planet'

  // A satellite simply goes round: no throttle, so no way down and no way off.
  if (isSatellite(ship)) {
    const marker = advanceOrbit(orbit.marker, track.orbitSpeed)
    placeInOrbit(ship, feature, track, marker)
    ship.lastKnown = {
      course: ship.placement.facing,
      velocity: ship.velocity,
      turn: state.turn,
      cloaked: ship.cloaked,
    }
    return dragged(OK)
  }

  const order = ship.order ?? BLANK_ORDER
  const velocity = Math.max(0, ship.velocity + (order.accel ?? 0))
  ship.lastKnown = {
    course: ship.placement.facing,
    velocity: ship.velocity,
    turn: state.turn,
    cloaked: ship.cloaked,
  }
  ship.thrustUsed = Math.abs(order.accel ?? 0)

  switch (orbitVelocityChange(velocity, track)) {
    case 'in-orbit': {
      const marker = advanceOrbit(orbit.marker, track.orbitSpeed)
      placeInOrbit(ship, feature, track, marker)
      pushLog(state, {
        kind: 'move',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} holds orbit round ${name}, marker ${marker} (17.8)`,
      })
      break
    }
    case 'leaves-orbit': {
      // 17.8: "it will leave orbit and move normally, in a straight line at the
      // clock face heading that is the closest tangent to its orbital path."
      const course = orbitDepartureCourse(orbit.marker, track.orbitSpeed)
      ship.orbit = null
      ship.velocity = velocity
      ship.placement = {
        position: advance(orbitMarkerPosition(track, orbit.marker), course, velocity),
        facing: course,
      }
      pushLog(state, {
        kind: 'move',
        shipId: ship.id,
        side: ship.side,
        text: `${ship.name} accelerates out of orbit on the tangent, course ${course} (17.8)`,
      })
      break
    }
    case 'decaying': {
      // 17.11's deliberate landing is exactly this manoeuvre done on purpose:
      // "a ship must first enter orbit as described above and then decelerate
      // to less than orbital velocity."
      if (ship.landing) {
        const landing = deliberateLanding({
          streamlining: ship.design.streamlining,
          thrust: currentThrust(ship),
          gravityG: feature.orbit?.gravityG,
          belowOrbitalVelocity: true,
        })
        if (landing.outcome !== 'uncontrolled-entry') {
          ship.orbit = null
          ship.velocity = velocity
          ship.landed = landing.outcome === 'lands' ? 'landed' : 'crash-landed'
          ship.offTable = true
          pushLog(state, {
            kind: 'note',
            shipId: ship.id,
            side: ship.side,
            text:
              landing.outcome === 'lands'
                ? `${ship.name} lands on ${name} (17.11)`
                : `${ship.name} makes a crash landing on ${name} — ${landing.reason}`,
          })
          break
        }
      }
      enterAtmosphere(state, ship, feature, velocity, `slows below orbital velocity over ${name}`)
      break
    }
  }

  for (const group of state.fighterGroups) {
    if (group.carrierId === ship.id && group.status === 'aboard') {
      group.position = ship.placement.position
      group.facing = ship.placement.facing
    }
  }
  return dragged(OK)
}

// ---------------------------------------------------------------------------
// Solar flares (17.3)
// ---------------------------------------------------------------------------

/** 17.3's default frequency: one turn in six, when the feature does not say. */
const SOLAR_FLARE_DEFAULT_ROLL = 6

/**
 * Roll each star for a flare, and burn out what it catches (17.3).
 *
 * *"Flares may occur at random, perhaps diced for each turn"* — that is all the
 * rule says about frequency, so the die is here and the target number is the
 * feature's, defaulting to a six. A flare takes eyes, not guns: one die per
 * FireCon and, under 12.2's advanced sensors, one per sensor box, plus one per
 * active screen level, knocked out below a four.
 */
function rollSolarFlares(state: GameState): void {
  if (!optional(state).solarFlares) return
  for (const feature of state.terrain) {
    if (feature.kind !== 'solar-flare') continue
    const onRoll = feature.flare?.onRoll ?? SOLAR_FLARE_DEFAULT_ROLL
    const roll = d6(state.rng)
    if (roll < onRoll) continue

    const name = feature.label ?? 'The star'
    pushLog(state, {
      kind: 'note',
      dice: [roll],
      text: `${name} flares (17.3)`,
    })

    for (const ship of state.ships) {
      if (ship.destroyed || ship.offTable) continue
      if (distance(ship.placement.position, feature.position) > feature.radius) continue
      const systems: FlareSystem[] = []
      for (const system of ship.design.systems) {
        if (ship.destroyedSystems.has(system.id)) continue
        const kind = flareSystemKind(system.kind)
        if (kind) systems.push({ id: system.id, kind })
      }
      if (systems.length === 0) continue

      const result = resolveSolarFlare(systems, effectiveScreenLevel(ship), state.rng, {
        advancedSensorRules: optional(state).sensorRules === true,
      })
      // 4.11's outcome, not 4.11's dice: the box is simply crossed off.
      for (const id of result.knockedOut) destroySystem(ship, id)
      pushLog(state, {
        kind: result.knockedOut.length > 0 ? 'damage' : 'note',
        shipId: ship.id,
        side: ship.side,
        dice: result.checks.map((check) => check.roll),
        text:
          result.knockedOut.length > 0
            ? `${ship.name} loses ${result.knockedOut.length} of ${systems.length} to the flare`
            : `${ship.name} rides out the flare with all ${systems.length} still lit`,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Blasts (6.6, 6.8)
// ---------------------------------------------------------------------------

/**
 * Everything a blast can catch, at a point.
 *
 * 6.6 and 6.8 both say *"any ship or unit"* and neither says "enemy": an
 * antimatter warhead going off among a fleet's own escorts is the risk of
 * carrying one, and a plasma bolt is placed on the table rather than aimed at
 * a hull. So this gathers both sides, plus the fighters, gunboats and other
 * ordnance markers that a blast also removes.
 */
function blastTargetsNear(state: GameState, centre: Point, radius: number): BlastTarget[] {
  const targets: BlastTarget[] = []
  for (const ship of state.ships) {
    if (ship.destroyed || ship.offTable) continue
    if (distance(centre, ship.placement.position) > radius) continue
    targets.push({
      id: ship.id,
      position: ship.placement.position,
      kind: 'ship',
      screens: { level: effectiveScreenLevel(ship), advanced: ship.design.screens.advanced },
    })
  }
  for (const flight of state.fighterGroups) {
    if (flight.status !== 'in-flight' || flight.strength <= 0) continue
    if (distance(centre, flight.position) > radius) continue
    targets.push({ id: flight.id, position: flight.position, kind: 'fighter-group', screens: { level: 0, advanced: false } })
  }
  for (const squadron of state.gunboatSquadrons) {
    if (squadron.status !== 'in-flight' || squadron.boats.length === 0) continue
    if (distance(centre, squadron.position) > radius) continue
    targets.push({ id: squadron.id, position: squadron.position, kind: 'gunboat', screens: { level: 0, advanced: false } })
  }
  for (const marker of ordnanceOf(state)) {
    if (distance(centre, marker.position) > radius) continue
    targets.push({ id: marker.id, position: marker.position, kind: 'ordnance', screens: { level: 0, advanced: false } })
  }
  return targets
}

/**
 * Put a blast's effects into the game.
 *
 * The dice are already rolled and the screens already counted by the resolver
 * that produced them (6.6, 6.8), so what is left is bookkeeping: hull damage
 * through the ordinary pipeline, fighter casualties through the fighter
 * module, and gunboats and ordnance simply gone — *"Missiles and gunboats are
 * destroyed."*
 */
function applyBlastEffects(
  state: GameState,
  effects: readonly BlastEffect[],
  opts: { side: SideId; source: string; mode: WeaponResult['mode'] },
): void {
  for (const effect of effects) {
    const ship = shipById(state, effect.targetId)
    if (ship) {
      if (effect.damage <= 0) continue
      const result: WeaponResult = {
        normalDamage: effect.damage,
        penetratingDamage: 0,
        mode: opts.mode,
        dice: effect.dice,
        detail: `${opts.source} at ${effect.range.toFixed(1)} MU`,
      }
      const applied = applyDamage(targetStateOf(ship), result, { source: 'ordnance' })
      writeBackDamage(ship, applied.target)
      markHullBoxes(ship, applied.hullDamage)
      pushLog(state, {
        kind: applied.hullDamage > 0 ? 'damage' : 'fire',
        targetId: ship.id,
        side: opts.side,
        dice: effect.dice,
        text: `${opts.source} catches ${ship.name} at ${effect.range.toFixed(1)} MU: ${effect.damage} damage`,
      })
      if (ship.destroyed) {
        pushLog(state, { kind: 'destroyed', shipId: ship.id, text: `${ship.name} is destroyed` })
      }
      continue
    }

    const flight = flightById(state, effect.targetId)
    if (flight) {
      const losses = Math.min(flight.strength, effect.damage)
      if (losses <= 0) continue
      writeFlight(flight, applyFighterLosses(flight, losses))
      pushLog(state, {
        kind: 'damage',
        side: opts.side,
        dice: effect.dice,
        text: `${opts.source} catches ${flight.label}: ${losses} lost`,
      })
      continue
    }

    const squadron = squadronById(state, effect.targetId)
    if (squadron) {
      squadron.boats = []
      squadron.status = 'destroyed'
      pushLog(state, {
        kind: 'destroyed',
        side: opts.side,
        text: `${opts.source} destroys ${squadron.label}`,
      })
      continue
    }

    const markers = ordnanceOf(state)
    if (markers.some((marker) => marker.id === effect.targetId)) {
      setOrdnance(state, markers.filter((marker) => marker.id !== effect.targetId))
      projectOrdnance(state)
    }
  }
}

// ---------------------------------------------------------------------------
// Plasma bolts (6.8)
// ---------------------------------------------------------------------------

// Bolts sit on the table between phase 3 and phase 10, like missile markers,
// and like them they are rebuilt by replaying the journal rather than saved.
const PLASMA_BOLTS = new WeakMap<GameState, PlasmaBolt[]>()

/**
 * Shoot at the plasma bolts on the table — **phase 9** (6.8).
 *
 * *"Class 1 beams and class 1 K-guns may NOT be used in their secondary PDS
 * role against Plasma Bolts"*, so a beam-1 mount sits this out; a PDS fires at
 * −2 and therefore only on a six, a fighter group within 6 MU rolls a die per
 * fighter, and a scattergun reads the beam table. Each hit takes a strength
 * class off the bolt, and a bolt at zero never goes off.
 */
function resolveBoltDefence(state: GameState): void {
  const bolts = boltsOf(state)
  if (bolts.length === 0) return

  const surviving: PlasmaBolt[] = []
  for (const bolt of bolts) {
    const defences: PlasmaBoltDefence[] = []
    for (const ship of state.ships) {
      if (ship.destroyed || ship.offTable || ship.side === bolt.owner) continue
      if (isOutOfControl(ship, state.turn)) continue
      const ftlStage = ftlStageOf(ship, state.turn)
      if (ftlStage !== null && !ftlExitRestrictions(ftlStage).mayUsePds) continue
      if (distance(ship.placement.position, bolt.position) > PDS_RANGE) continue
      for (const mount of pdMountsOf(ship)) {
        if (!canEngagePlasmaBolt(mount.mode)) continue
        if (mount.kind !== 'pds' && mount.kind !== 'ads' && mount.kind !== 'scattergun') continue
        defences.push({
          sourceId: mount.id,
          kind: mount.kind === 'scattergun' ? 'scattergun' : 'pds',
          dice: 1,
        })
        markWeaponFired(ship, mount.id, state.phase)
      }
    }
    for (const flight of state.fighterGroups) {
      if (flight.status !== 'in-flight' || flight.strength <= 0) continue
      if (flight.side === bolt.owner) continue
      if (distance(flight.position, bolt.position) > PLASMA_BOLT_BLAST_RADIUS) continue
      defences.push({ sourceId: flight.id, kind: 'fighter', dice: flight.strength })
    }

    if (defences.length === 0) {
      surviving.push(bolt)
      continue
    }
    const outcome = resolvePlasmaBoltDefence(bolt, defences, state.rng)
    pushLog(state, {
      kind: 'point-defence',
      side: bolt.owner,
      dice: outcome.rolls,
      text: `Plasma bolt under fire: ${outcome.detail}`,
    })
    if (!outcome.destroyed) surviving.push(outcome.bolt)
  }
  setBolts(state, surviving)
  projectBolts(state)
}

/**
 * Set off every plasma bolt still standing — **phase 10** (6.8).
 *
 * A bolt does not chase anything: it goes off where it was placed, on whatever
 * is inside six MU of it once the ships have finished moving, which is as
 * likely to be the launcher's own escorts as the enemy's.
 */
function detonateBolts(state: GameState): void {
  const bolts = boltsOf(state)
  if (bolts.length === 0) return
  for (const bolt of bolts) {
    const blast = resolvePlasmaBoltDetonation(
      bolt,
      blastTargetsNear(state, bolt.position, PLASMA_BOLT_BLAST_RADIUS),
      state.rng,
    )
    pushLog(state, { kind: 'damage', side: bolt.owner, text: `Plasma bolt: ${blast.detail}` })
    applyBlastEffects(state, blast.effects, {
      side: bolt.owner,
      source: 'A plasma bolt',
      mode: 'standard',
    })
  }
  setBolts(state, [])
  projectBolts(state)
}


function boltsOf(state: GameState): PlasmaBolt[] {
  let bolts = PLASMA_BOLTS.get(state)
  if (!bolts) {
    bolts = []
    PLASMA_BOLTS.set(state, bolts)
  }
  return bolts
}

function setBolts(state: GameState, bolts: PlasmaBolt[]): void {
  PLASMA_BOLTS.set(state, bolts)
}

/** Copy the bolts into GameState for drawing, beside the missile markers. */
function projectBolts(state: GameState): void {
  const missiles = state.ordnance.filter((marker) => marker.kind !== 'plasma-bolt')
  state.ordnance = [
    ...missiles,
    ...boltsOf(state).map((bolt) => ({
      id: bolt.id,
      side: bolt.owner,
      sourceShipId: bolt.sourceShipId,
      kind: 'plasma-bolt' as const,
      grade: 'standard' as const,
      missiles: bolt.strength,
      position: bolt.position,
      launchedTurn: bolt.launchedTurn,
      stagesRemaining: 0,
      targetShipId: null,
    })),
  ]
}

const ORDNANCE = new WeakMap<GameState, MissileMarker[]>()

function ordnanceOf(state: GameState): MissileMarker[] {
  let markers = ORDNANCE.get(state)
  if (!markers) {
    markers = []
    ORDNANCE.set(state, markers)
  }
  return markers
}

function setOrdnance(state: GameState, markers: MissileMarker[]): void {
  ORDNANCE.set(state, markers)
}

/** Copy what the map needs into GameState, for drawing only. */
function projectOrdnance(state: GameState): void {
  state.ordnance = ordnanceOf(state).map((marker) => ({
    id: marker.id,
    side: marker.owner,
    sourceShipId: marker.sourceShipId,
    kind: marker.kind === 'rocket' ? 'rocket' : marker.kind,
    grade: marker.grade === 'extended' ? 'extended' : 'standard',
    missiles: marker.missiles,
    position: marker.position,
    launchedTurn: marker.launchedTurn,
    stagesRemaining: 0,
    targetShipId: null,
  }))
}

/**
 * A ship's point-defence mounts (7.12 – 7.15).
 *
 * Two sources: the dedicated systems — PDS, ADS, scattergun, grapeshot — and
 * any class-1 beam, which 8.8 lets a ship fire as point defence at a worse
 * table. Both spend the mount for the turn, which is why the ids stay the ids
 * the rest of the engine knows them by.
 */
function pdMountsOf(ship: ShipState): PdMount[] {
  const kinds: Partial<Record<string, PdMountKind>> = {
    pds: 'pds',
    ads: 'ads',
    scattergun: 'scattergun',
    grapeshot: 'grapeshot',
  }
  const mounts: PdMount[] = []
  for (const system of ship.design.systems) {
    const kind = kinds[system.kind]
    if (!kind) continue
    if (ship.destroyedSystems.has(system.id)) continue
    if (!canWeaponFire(ship, system.id)) continue
    mounts.push({
      id: system.id,
      kind,
      arcs: bearingArcs(ship, system.arcs ?? ALL_ARCS),
      // The roll table this mount uses (8.8): a scattergun rolls four dice but
      // reads each on the PDS table, and a beam-1 reads a worse one.
      mode: 'pds',
    })
  }
  for (const weapon of ship.design.weapons) {
    if (weapon.weaponClass !== 'beam' || weapon.rating !== 1) continue
    if (ship.destroyedSystems.has(weapon.id)) continue
    if (!canWeaponFire(ship, weapon.id)) continue
    mounts.push({
      id: weapon.id,
      kind: 'beam-1',
      arcs: bearingArcs(ship, weapon.arcs),
      mode: 'beam-1',
    })
  }
  return mounts
}

const ALL_ARCS = ['F', 'FS', 'AS', 'A', 'AP', 'FP'] as const

function adfcCount(ship: ShipState, kind: 'adfc' | 'advanced-adfc'): number {
  return ship.design.systems.filter(
    (system) => system.kind === kind && !ship.destroyedSystems.has(system.id),
  ).length
}

/** Which launcher classes put a marker on the table (6.2, 6.6). */
function missileKindOf(weaponClass: string): 'salvo' | 'heavy' | 'antimatter' | null {
  switch (weaponClass) {
    case 'heavy-missile':
      return 'heavy'
    case 'salvo-missile-rack':
    case 'salvo-missile-launcher':
      return 'salvo'
    case 'antimatter-missile':
      return 'antimatter'
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Flight operations (8)
// ---------------------------------------------------------------------------

/**
 * The boundary between the game's fighter groups and `fighters.ts`.
 *
 * The module works in values: every one of its functions takes a group and
 * returns a new one, which is what makes a dogfight between two groups one
 * call instead of two half-applied mutations. `GameState` works in place,
 * because the engine marks a ship's SSD the way a player marks a dry-erase
 * sheet. `writeFlight` is where the two meet, and the only reason it is not a
 * plain `Object.assign` is that the table's own columns — the group's name,
 * whether it is gunboats, the landing stamp, what it declared an attack on —
 * are not the module's to overwrite.
 */
function writeFlight(live: FighterGroupState, next: FighterGroup): void {
  const { label, recoveredTurn, targetId, side } = live
  Object.assign(live, next, { label, recoveredTurn, targetId, side })
}

function flightById(state: GameState, id: string): FighterGroupState | undefined {
  return state.fighterGroups.find((group) => group.id === id)
}

/**
 * What the carrier's flight deck can do this turn (8.1, 8.2).
 *
 * `usedThrust` is read off the written order rather than off the ship's
 * position, because flight operations are phase 4 and ships do not move until
 * phase 5: at the moment a group launches, the only evidence of what the
 * carrier is about to do is what its captain wrote down.
 */
function carrierFlightState(state: GameState, carrier: ShipState): CarrierFlightState {
  return {
    launchFacilities: operationalCount(carrier, 'launch-tube'),
    facilitiesUsed: facilitiesUsed(state, carrier),
    usedThrust: carrierUnderThrust(carrier),
    catapults: operationalCount(carrier, 'catapult') > 0,
  }
}

/**
 * Where the group is pointing after it moves.
 *
 * The default is the way it flew, because that is what a player who does not
 * say otherwise means; 8.5 lets them say otherwise, and 8.7's front 180° makes
 * it worth saying. A group that did not actually go anywhere keeps its facing.
 */
function facingAfterMove(
  flight: FighterGroupState,
  to: Point,
  chosen: Course | undefined,
): Course {
  if (chosen !== undefined) return chosen
  if (distance(flight.position, to) <= 1e-9) return flight.facing
  return nearestCourse(flight.position, to)
}

/** The re-arm die a landing group rolls, in words for the log (8.16). */
function describeRearm(rearm: RearmResult | null): string {
  if (!rearm) return ''
  if (rearm.outcome === 'lost') return ' — the group is written off (8.16)'
  if (rearm.outcome === 'crash-turnaround') return ` — turned around for turn ${rearm.readyTurn}`
  return ` — re-arming until turn ${rearm.readyTurn}`
}

function operationalCount(ship: ShipState, kind: SystemKind): number {
  return ship.design.systems.filter(
    (system) => system.kind === kind && !ship.destroyedSystems.has(system.id),
  ).length
}

/**
 * Launch tubes spent this turn.
 *
 * 8.1: "All carriers are allowed to launch (or recover) as many groups per
 * turn as they have operational launch tube/flight decks" — one pool, drawn on
 * by both operations, which is why both stamps are counted here.
 */
function facilitiesUsed(state: GameState, carrier: ShipState): number {
  return state.fighterGroups.filter(
    (group) =>
      group.carrierId === carrier.id &&
      (group.launchedTurn === state.turn || group.recoveredTurn === state.turn),
  ).length
}

function carrierUnderThrust(carrier: ShipState): boolean {
  if (!carrier.order) return false
  return thrustBudget(carrier.order, movementStateOf(carrier).drive).totalUsed > 0
}

/**
 * A fighter group's hits going onto a hull.
 *
 * The rear arc is denied on purpose: 8.9 says fighters "can attack ships from
 * the rear arc, but like missiles gain no advantage from doing so as it is
 * assumed that they must avoid being melted by the drive", so the optional rule
 * of 4.10 does not apply however the game is configured.
 */
function applyFighterDamage(
  state: GameState,
  target: ShipState,
  result: WeaponResult,
  opts: { rearArcRule?: boolean; rearArc?: boolean } = {},
): void {
  const applied = applyDamage(targetStateOf(target), result, {
    rearArcRule: opts.rearArcRule ?? false,
    rearArc: opts.rearArc ?? false,
    source: 'direct-fire',
  })
  writeBackDamage(target, applied.target)
  markHullBoxes(target, applied.hullDamage)
  if (target.destroyed) {
    pushLog(state, { kind: 'destroyed', shipId: target.id, text: `${target.name} is destroyed` })
  }
}

/**
 * The gunboat half of the same boundary.
 *
 * A squadron carries the same per-turn flags a wing does and is written back
 * the same way; the columns the table owns are fewer, because a squadron has
 * no mission and no dogfight — 9.1 gives it a rack, a target and endurance.
 */
function writeSquadron(live: GunboatSquadronState, next: GunboatSquadron): void {
  const { label, targetId, side } = live
  Object.assign(live, next, { label, targetId, side })
}

function squadronById(state: GameState, id: string): GunboatSquadronState | undefined {
  return state.gunboatSquadrons.find((squadron) => squadron.id === id)
}

/**
 * What the carrying ship's racks and bays can do this turn (9.1).
 *
 * `gunboat-bay` is its own fit rather than a large `boat-bay` because 9.1
 * gives it its own mass and its own job: a bay recovers gunboats only when it
 * is *"of sufficient size to recover the whole squadron"*, and a ship's
 * general-purpose boat cradle is not that.
 */
function gunboatCarrierState(state: GameState, carrier: ShipState): GunboatCarrierState {
  return {
    racks: operationalCount(carrier, 'gunboat-rack'),
    bays: operationalCount(carrier, 'gunboat-bay'),
    used: state.gunboatSquadrons.filter(
      (squadron) =>
        squadron.carrierId === carrier.id &&
        (squadron.launchedTurn === state.turn || squadron.recoveredTurn === state.turn),
    ).length,
  }
}

/** The same default as a wing's: the way it flew, unless the player says (9.1). */
function squadronFacingAfterMove(
  squadron: GunboatSquadronState,
  to: Point,
  chosen: Course | undefined,
): Course {
  if (chosen !== undefined) return chosen
  if (distance(squadron.position, to) <= 1e-9) return squadron.facing
  return nearestCourse(squadron.position, to)
}

/**
 * Put boarding parties on the target's SSD (5.9, 5.18).
 *
 * They are stamped with the turn they landed because phase 13 says not to roll
 * for boarders that arrived this turn, and the boarding rules of 12.7 — when
 * they can be read — will want the same stamp.
 */
function landBoarders(
  state: GameState,
  from: ShipState,
  target: ShipState,
  parties: number,
): void {
  if (parties <= 0) return
  const existing = target.boarders.find(
    (party) => party.side === from.side && party.landedTurn === state.turn,
  )
  if (existing) existing.parties += parties
  else target.boarders.push({ side: from.side, parties, landedTurn: state.turn })
  pushLog(state, {
    kind: 'boarding',
    shipId: target.id,
    side: from.side,
    text: `${parties} boarding part${parties === 1 ? 'y' : 'ies'} from ${from.name} board ${target.name}`,
  })
}

/**
 * The Reflex Field's die, and what it does to a volley (7.25).
 *
 * "Energy weapon" is 7.25's own list, which `ew.ts` reads off each weapon's
 * section — the same set 7.2 says screens protect against. Anything else goes
 * straight through: a Reflex Field does nothing to a pulse torpedo.
 *
 * **[reading]** The table talks about "the damage" as one number, and a volley
 * arrives here as two — the part screens and armour may answer, and the part
 * that goes straight to the hull (4.6). So the die is rolled once against the
 * total, as the rule says, and the surviving damage is split back in the same
 * proportion, with the odd point going to the normal pile so armour still gets
 * its chance at it. Halving the two piles separately would round up twice and
 * quietly favour the attacker.
 */
function reflexField(
  state: GameState,
  shooter: ShipState,
  target: ShipState,
  weapon: WeaponDef,
  result: WeaponResult,
): { result: WeaponResult; back: number } {
  if (!target.reflexFieldActive) return { result, back: 0 }
  if (operationalCount(target, 'reflex-field') === 0) return { result, back: 0 }
  if (!isEnergyWeapon(weapon.weaponClass)) return { result, back: 0 }

  const total = result.normalDamage + result.penetratingDamage
  if (total <= 0) return { result, back: 0 }

  const roll = rollReflexField(total, state.rng)
  const penetrating = Math.min(result.penetratingDamage, Math.floor(roll.toTarget / 2))
  const normal = roll.toTarget - penetrating
  pushLog(state, {
    kind: 'note',
    shipId: target.id,
    side: target.side,
    dice: [roll.roll],
    text:
      `${target.name}'s Reflex Field: ${roll.outcome} — ${roll.toTarget} of ${total} lands` +
      (roll.toAttacker > 0 ? `, ${roll.toAttacker} reflected at ${shooter.name}` : ''),
  })
  return {
    result: { ...result, normalDamage: normal, penetratingDamage: penetrating },
    back: roll.toAttacker,
  }
}

/**
 * Which turn of an FTL exit this ship is on, or null if it is not leaving.
 *
 * The stage is a function of how long ago the drive was ordered up, because
 * `ftlTransit` is cleared every turn and the order is not re-made (11.4).
 */
function ftlStageOf(ship: ShipState, turn: number): FtlExitStage | null {
  if (ship.ftlTransit !== 'exiting' || ship.ftlWarmupTurn === null) return null
  const stage = ftlExitStage(ship.ftlWarmupTurn, turn)
  return stage === 'gone' ? null : stage
}

/**
 * The jump itself (11.4): a half move on the present course, and then the roll
 * for whatever the ship materialised through on the way out.
 *
 * *"Once a ship has left the table under FTL Drive, it may not return"*, so
 * the ship goes off-table rather than being destroyed — unless the roll says
 * otherwise, in which case it is destroyed where it stood and takes its
 * neighbours with it.
 */
function jumpToFtl(state: GameState, ship: ShipState): ActionOutcome {
  ship.lastKnown = {
    course: ship.placement.facing,
    velocity: ship.velocity,
    turn: state.turn,
    cloaked: ship.cloaked,
  }
  // 11.4: "the ship moves half its current velocity on its present course,
  // then disappears from the playing area." The module owns the arithmetic,
  // including the floor.
  ship.placement = {
    ...ship.placement,
    position: ftlExitMove(ship.placement.position, ship.placement.facing, ship.velocity).position,
  }

  const report = resolveFtlExit(
    {
      exitPoint: ship.placement.position,
      advancedDrive: isAdvancedFtl(ship.design.ftl),
      nearby: state.ships
        .filter(
          (other) =>
            other.id !== ship.id &&
            !other.destroyed &&
            !other.offTable &&
            other.carriedBy === null,
        )
        .map((other) => ({ id: other.id, position: other.placement.position })),
      lightCraft: [
        ...state.fighterGroups
          .filter((g) => g.status === 'in-flight')
          .map((g) => ({ id: g.id, position: g.position })),
        ...state.gunboatSquadrons
          .filter((g) => g.status === 'in-flight')
          .map((g) => ({ id: g.id, position: g.position })),
        ...state.ordnance.map((m) => ({ id: m.id, position: m.position })),
      ],
    },
    state.rng,
  )

  pushLog(state, {
    kind: 'move',
    shipId: ship.id,
    side: ship.side,
    dice: report.roll === null ? undefined : [report.roll],
    text: `${ship.name}: ${report.note}`,
  })

  // 11.5: "Damage from FTL entry or exit cannot be absorbed by screens or
  // armor", which is what penetrating damage means to the pipeline.
  const hurt = (target: ShipState, damage: number, dice: number[], why: string): void => {
    if (damage <= 0) return
    markHullBoxes(target, damage)
    pushLog(state, {
      kind: 'damage',
      shipId: target.id,
      side: target.side,
      dice,
      text: `${target.name}: ${damage} from ${why}, past screens and armour (11.5)`,
    })
    if (target.destroyed) {
      pushLog(state, { kind: 'destroyed', shipId: target.id, text: `${target.name} is destroyed` })
    }
  }

  hurt(ship, report.selfDamage, report.selfDice, 'its own FTL transit')
  for (const hit of report.bystanders) {
    const other = shipById(state, hit.id)
    if (other) hurt(other, hit.damage, hit.dice, `${ship.name}'s FTL transit`)
  }
  for (const id of report.lightCraftDestroyed) {
    const group =
      state.fighterGroups.find((g) => g.id === id) ?? state.gunboatSquadrons.find((g) => g.id === id)
    if (group) {
      group.status = 'destroyed'
      pushLog(state, {
        kind: 'destroyed',
        text: `${group.label} is caught in ${ship.name}'s FTL transit (11.4)`,
      })
    }
    setOrdnance(
      state,
      ordnanceOf(state).filter((marker) => marker.id !== id),
    )
  }
  projectOrdnance(state)

  if (report.selfDestroyed) {
    ship.destroyed = true
  } else if (report.jumped) {
    ship.offTable = true
    ship.ftlTransit = 'none'
    pushLog(state, {
      kind: 'note',
      shipId: ship.id,
      side: ship.side,
      text: `${ship.name} is gone into hyperspace and will not return (11.4)`,
    })
  } else {
    // A 1: "The ship remains in normal space at its present course and
    // velocity" — and has to start the whole thing again if it still wants to
    // leave.
    ship.ftlTransit = 'none'
    ship.ftlWarmupTurn = null
  }
  return OK
}

/**
 * Who fights whom when nobody has said (12.7 step 1).
 *
 * Phase 12 asks both players to allocate before any die is rolled, and there
 * is no interface for either choice yet, so the engine plays both sides the
 * obvious way: the attackers put just enough counters against the defending
 * Marines to match them and send the rest at the hull, and the defenders pile
 * their parties onto the attackers three at a time — the most 10.4 allows on
 * one job — with the Marines taking one each. It is the allocation the book's
 * own worked example makes, and it is replaced the moment there is a panel to
 * make the choice in.
 */
function defaultBoardingPlan(ship: BoardedShip, boarders: readonly BoardingForce[]): BoardingPlan {
  const units = boardingUnits(boarders, { ownerSide: ship.side })
  const marineCount = Math.max(0, Math.floor(ship.marines))
  const engaged = units.slice(0, marineCount)

  const dcps: Array<{ targetId: string; parties: number }> = []
  let left = Math.max(0, Math.floor(ship.damageControlParties))
  for (const unit of units) {
    if (left <= 0) break
    const parties = Math.min(MAX_DCPS_PER_TARGET, left)
    dcps.push({ targetId: unit.id, parties })
    left -= parties
  }

  return {
    engageMarines: engaged.map((unit) => unit.id),
    dcps,
    marines: engaged.map((unit) => ({ targetId: unit.id, marines: 1 })),
  }
}

/**
 * A ram declared in orders, resolved the moment the rammer arrives (16.7).
 *
 * Both ships' damage comes off the hull boxes they had *before* contact, and
 * both are inflicted at once — "simultaneous" is the whole character of the
 * move, and it is why the two numbers are computed before either is applied.
 * A rammer is as likely to die as its victim, which is what makes it a threat
 * rather than a trick.
 */
function resolveDeclaredRam(state: GameState, ship: ShipState): void {
  if (!ship.ramTargetId) return
  const target = shipById(state, ship.ramTargetId)
  ship.ramTargetId = null
  if (!target || target.destroyed || target.offTable || ship.destroyed) return

  const result = resolveRam(
    {
      position: ship.placement.position,
      // 4.11: a shot-out drive makes a worse rammer, so the current rating is
      // the one that counts, not what the SSD was printed with.
      thrust: currentThrust(ship),
      hullBoxes: ship.design.hullBoxes - ship.hullMarked,
    },
    {
      position: target.placement.position,
      thrust: currentThrust(target),
      hullBoxes: target.design.hullBoxes - target.hullMarked,
    },
    state.rng,
  )

  pushLog(state, {
    kind: 'move',
    shipId: ship.id,
    targetId: target.id,
    side: ship.side,
    dice: [result.nerveRoll, result.attackerEvasionRoll, result.targetEvasionRoll].filter(
      (roll): roll is number => roll !== null,
    ),
    text: `${ship.name} rams ${target.name}: ${result.detail}`,
  })
  if (!result.damage) return

  // Both totals were computed above off pre-contact hulls; applying them in
  // either order now cannot change the other.
  const smash = (victim: ShipState, damage: number, dice: number[]): void => {
    if (damage <= 0) return
    const applied = applyDamage(
      targetStateOf(victim),
      {
        normalDamage: damage,
        penetratingDamage: 0,
        mode: result.damage?.mode ?? 'standard',
        dice,
        detail: 'ramming',
      },
      { rearArcRule: false, rearArc: false, source: 'direct-fire' },
    )
    writeBackDamage(victim, applied.target)
    markHullBoxes(victim, applied.hullDamage)
    pushLog(state, {
      kind: 'damage',
      shipId: victim.id,
      side: victim.side,
      text: `${victim.name} takes ${damage} from the collision (16.7)`,
    })
    if (victim.destroyed) {
      pushLog(state, { kind: 'destroyed', shipId: victim.id, text: `${victim.name} is destroyed` })
    }
  }
  smash(target, result.damage.damageToTarget, [result.damage.attackerRoll])
  smash(ship, result.damage.damageToAttacker, [result.damage.targetRoll])
}

/**
 * Solid bodies that a shot cannot pass through (17.1).
 *
 * *"Any line between two ships that crosses any part of the asteroid is
 * blocked. (Between center points of models, remember.)"* Planets and
 * planetoids are solid; a dust cloud, a nebula or an asteroid field is not
 * something a shot stops at, and each of those has its own rule instead.
 */
/** Dust and gas: 17.2 charges for speed through it and blinds shots across it. */
function cloudsOver(state: GameState, ...points: Point[]): boolean {
  if (!optional(state).terrainHazards) return false
  return state.terrain.some(
    (feature) =>
      CLOUD_TERRAIN.has(feature.kind) &&
      points.some((p) => distance(p, feature.position) <= feature.radius),
  )
}

/** Every body on the table that has a gravity well (17.9). */
function gravityWells(state: GameState) {
  return state.terrain
    .filter((feature) => feature.gravity !== undefined)
    .map((feature) => ({
      feature,
      well: createGravityWell(feature.position, feature.radius, feature.gravity),
    }))
}

/** Whether the ship finished inside any of the well's zones (17.9). */
function insideWell(well: ReturnType<typeof createGravityWell>, position: Point): boolean {
  const range = distance(well.center, position)
  return well.zones.some((zone) => range <= zone.radius)
}

/**
 * What the well did to a ship that flew through it (17.9).
 *
 * *"Pause the ship in the innermost zone contacted"* — the deepest zone the
 * whole path reached, not the one it happened to finish in — and then add to,
 * subtract from or bend its course, according to the arc the centre lies in.
 * A pass that actually changes course is a partial orbit and can neither hit
 * the planet nor fall into the next zone in; a dive straight at the middle is
 * not a partial orbit and gets neither protection.
 *
 * The thrust a player may spend arguing with the turn is whatever the order
 * sheet left unspent, which is why this runs after the move rather than during
 * it.
 */
function resolveGravity(state: GameState, ship: ShipState, path: readonly Point[]): boolean {
  if (!optional(state).terrainHazards) return false
  if (ship.destroyed || ship.offTable) return false

  let shielded = false
  for (const { feature, well } of gravityWells(state)) {
    const unusedThrust = Math.max(0, currentThrust(ship) - ship.thrustUsed)
    const effect = resolveGravityZone(
      { position: ship.placement.position, facing: ship.placement.facing, velocity: ship.velocity },
      well,
      {
        path,
        endsInZone: insideWell(well, ship.placement.position),
        turnPoints: ship.gravityTurn ?? undefined,
        unusedThrust,
      },
    )
    if (!effect.zone) continue

    ship.thrustUsed += effect.thrustSpent
    shielded = shielded || effect.shielded
    const name = feature.label ?? 'the well'
    if (effect.timing === 'next-turn') {
      ship.pendingGravity = { velocity: effect.velocity, facing: effect.facing }
      pushLog(state, {
        kind: 'move',
        shipId: ship.id,
        side: ship.side,
        text:
          `${ship.name} is still inside ${name} — strength ${effect.zone.strength} applies at the ` +
          `start of its next move (17.9)`,
      })
      return shielded
    }
    ship.velocity = effect.velocity
    ship.placement = { ...ship.placement, facing: effect.facing }
    pushLog(state, {
      kind: 'move',
      shipId: ship.id,
      side: ship.side,
      text:
        `${ship.name} swings past ${name} — ${effect.arc} arc, strength ${effect.zone.strength}: ` +
        `velocity ${effect.velocityChange >= 0 ? '+' : ''}${effect.velocityChange}` +
        (effect.turnPoints === 0
          ? ''
          : `, ${Math.abs(effect.turnPoints)} points to ${effect.turnPoints > 0 ? 'starboard' : 'port'}`) +
        (effect.shielded ? ', a partial orbit (17.9)' : ' (17.9)'),
    })
    // The immunity is to the planet and to the next zone in, so a shielded pass
    // stops here rather than falling on through to a second well.
    if (effect.shielded) return true
  }
  return shielded
}

/**
 * Getting a lock through dust (17.2 rules 2 and 3), or null when no cloud is
 * involved and the ordinary screen level stands.
 *
 * *"When attempting to fire at a ship in a dust cloud, **or if the firing ship
 * is itself in a cloud**, roll a D6 after nominating the target"* — either end
 * is enough, which is the clause that catches people out: sitting in a nebula
 * blinds you as much as it hides you.
 *
 * One die per nomination, not per weapon, so the answer is cached on the
 * firing ship and cleared at every phase boundary along with the FireCons —
 * phases 9, 10 and 11 are three separate nominations of the same target.
 */
function cloudLockOn(
  state: GameState,
  ship: ShipState,
  target: ShipState,
  weapon: WeaponDef,
): { locked: boolean; screens: ScreenLevel; roll: number | null; reason: string } | null {
  if (!cloudsOver(state, ship.placement.position, target.placement.position)) return null
  const beamOrGraser =
    weapon.weaponClass === 'beam' ||
    weapon.weaponClass === 'graser' ||
    weapon.weaponClass === 'heavy-graser'

  const remembered = ship.cloudLocks.get(target.id)
  if (remembered !== undefined) {
    return {
      locked: remembered,
      screens: beamOrGraser
        ? attenuatedScreens(effectiveScreenLevel(target))
        : effectiveScreenLevel(target),
      roll: null,
      reason: remembered ? '' : 'the dust already beat this nomination (17.2)',
    }
  }
  const result = cloudTargetLock(state.rng, {
    screens: effectiveScreenLevel(target),
    beamOrGraser,
  })
  ship.cloudLocks.set(target.id, result.locked)
  return result
}

/**
 * Staying in orbit after a hit (17.8).
 *
 * *"Any ship that suffers a drive or bridge threshold failure while in orbit
 * must make a second threshold check to stay in orbit. If this too fails, the
 * ship orbit has decayed and it enters the atmosphere."*
 *
 * Only the drive and the bridge shake a ship loose. A FireCon lost to the same
 * threshold row does not: the rule names two systems and means two.
 */
function orbitAfterThreshold(
  state: GameState,
  ship: ShipState,
  rowsLost: number,
  extraRows: number,
  lost: readonly string[],
): void {
  if (!ship.orbit || ship.destroyed || ship.offTable) return
  const shaken = lost.some((id) => id === DRIVE_SYSTEM_ID || id === CORE_SYSTEM_IDS.bridge)
  if (!shaken) return
  const orbit = orbitOf(state, ship)
  if (!orbit) return
  const check = orbitDecayCheck(rowsLost, state.rng, { extraRows })
  if (!check.decayed) {
    pushLog(state, {
      kind: 'threshold',
      shipId: ship.id,
      side: ship.side,
      dice: [check.roll],
      text: `${ship.name} holds its orbit through the damage (17.8, ${check.target}+ to fail)`,
    })
    return
  }
  enterAtmosphere(state, ship, orbit.feature, ship.velocity, 'is shaken out of orbit')
}

/**
 * 12.11's further roll, after the systems have been checked.
 *
 * *"After checking for systems failures make one further roll at the same odds
 * … to determine if the ship has been knocked off course."* Optional, because
 * section 12 is the optional rules and because it draws two more dice per
 * threshold point, which would move the stream under every battle file written
 * before it existed.
 *
 * It runs after `thresholdPhase` rather than instead of it, and it is handed
 * the same `rowsLost` and `extraRows` the systems check used, which is what
 * *"at the same odds"* means.
 */
function knockOffCourse(
  state: GameState,
  ship: ShipState,
  rowsLost: number,
  extraRows: number,
): void {
  if (!optional(state).knockedOffCourse) return
  if (ship.destroyed || ship.offTable) return
  const result = resolveKnockedOffCourse(ship.placement.facing, rowsLost, state.rng, { extraRows })
  if (!result.facing.knocked) return
  ship.placement = { ...ship.placement, facing: result.facing.course }
  pushLog(state, {
    kind: 'threshold',
    shipId: ship.id,
    side: ship.side,
    dice: [result.facing.roll, result.facing.directionRoll ?? 0],
    text: `${ship.name} is knocked ${result.facing.direction} onto course ${result.facing.course} (12.11)`,
  })
}

/**
 * Whether the approach flown this turn earns a docking (16.6).
 *
 * Called at the end of the ship's movement, because the rule is a test on
 * where the ship *ended up*: *"the ship's movement orders must be plotted so
 * that it ends up within 3 MU of the target ship/starbase at the end of the
 * turn."*
 */
function resolveDockingApproach(state: GameState, ship: ShipState): void {
  if (!ship.dockTargetId || ship.destroyed || ship.offTable) return
  const target = shipById(state, ship.dockTargetId)
  if (!target || target.destroyed || target.offTable) {
    ship.dockTargetId = null
    return
  }
  const vector = (s: ShipState) => ({
    position: s.placement.position,
    facing: s.placement.facing,
    velocity: s.velocity,
  })
  const approach = dockingApproach(vector(ship), vector(target))
  if (!approach.met) {
    pushLog(state, {
      kind: 'move',
      shipId: ship.id,
      side: ship.side,
      text: `${ship.name} misses the docking: ${approach.reason}`,
    })
    return
  }
  ship.dock = holdApproach(ship.dock, target.id, state.turn)
  ship.dockTargetId = null
  pushLog(state, {
    kind: 'move',
    shipId: ship.id,
    side: ship.side,
    text: `${ship.name} holds station on ${target.name} — docked next turn (16.6)`,
  })
}

/**
 * Anything docked to this ship goes where it goes (16.6).
 *
 * 16.6 never says so because on a table the models are physically attached.
 * The precedent is the wing still in the bay, dragged for the same reason and
 * with the same three lines.
 */
/** Hulls this one is carrying (11.6, 11.7). */
export function carriedHulls(state: GameState, carrierId: string): ShipState[] {
  return state.ships.filter((ship) => ship.carriedBy === carrierId && !ship.destroyed)
}

/**
 * A carried hull goes where its carrier goes (11.6, 11.7).
 *
 * *"The battleriders start with the velocity and course of the Mothership"* —
 * so they hold the carrier's station and heading exactly, and take its
 * velocity with them when they detach. On a real table this is one model with
 * riders clipped to it; here they are separate counters, and a rider left
 * behind at last turn's station would detach into empty space.
 */
function dragCarriedHulls(state: GameState, carrier: ShipState): void {
  for (const rider of carriedHulls(state, carrier.id)) {
    rider.placement = {
      position: { ...carrier.placement.position },
      facing: carrier.placement.facing,
    }
    rider.velocity = carrier.velocity
    rider.offTable = carrier.offTable
  }
}

function dragDockedShips(state: GameState, host: ShipState): void {
  for (const other of state.ships) {
    if (other.id === host.id) continue
    if (other.dock.targetId !== host.id) continue
    if (other.dock.phase === 'free') continue
    other.placement = {
      position: { ...host.placement.position },
      facing: other.placement.facing,
    }
    other.velocity = host.velocity
  }
}

/**
 * A ship that has flown off the playing area (3.9).
 *
 * *"This is usually considered a retreat from the battle unless using the
 * moving table rules (section 16.4) or fighting an orbital scenario (section
 * 17.8)."* Either way the model is not on the table any more; what 16.4
 * changes is whether that means the ship has left the battle, and 4.12 scores
 * a disengaged hull at full value to the enemy.
 *
 * The optional re-entry roll is 3.9's own and is off unless the table asks for
 * it — it draws a die, and a die drawn where an old battle file drew none
 * moves the stream for everything after it.
 */
function resolveLeavingTable(state: GameState, ship: ShipState): void {
  if (ship.destroyed || ship.offTable) return
  const bounds = tableBounds(state)
  if (!isOffTable(ship.placement.position, bounds)) return

  const edge = departureEdge(ship.placement.position, bounds)
  const rules = optional(state)
  const retreat = leavingTableIsRetreat(rules.movingTable === true)
  ship.offTable = true
  ship.exitEdge = edge

  // 17.7: on an orbital table the edge is not the end of anything. "A ship can
  // leave the table at any time to make an orbit around the planet", and the
  // note the rule asks a player to write is kept here.
  if (rules.orbitalTable) {
    const corner = nearestCorner(ship.placement.position, bounds)
    ship.departure = {
      turn: state.turn,
      velocity: ship.velocity,
      course: ship.placement.facing,
      cornerDistance: distance(ship.placement.position, cornerPoint(corner, bounds)),
      corner,
    }
    ship.reentryTurn = orbitReentryTurn(state.turn, currentThrust(ship))
    pushLog(state, {
      kind: 'move',
      shipId: ship.id,
      side: ship.side,
      text:
        `${ship.name} goes round the planet by the ${edge ?? 'edge'} and may come back on ` +
        `turn ${ship.reentryTurn} (17.7)`,
    })
    return
  }

  if (!rules.tableReentry) {
    pushLog(state, {
      kind: 'move',
      shipId: ship.id,
      side: ship.side,
      text: retreat
        ? `${ship.name} leaves the table by the ${edge ?? 'edge'} — a retreat from the battle (3.9)`
        : `${ship.name} runs off the ${edge ?? 'edge'} of the drawn area (3.9, 16.4)`,
    })
    return
  }

  const reentry = rollTableReentry(state.rng, state.turn, edge)
  ship.reentryTurn = reentry.reentryTurn
  pushLog(state, {
    kind: 'move',
    shipId: ship.id,
    side: ship.side,
    dice: [reentry.roll],
    text: reentry.returns
      ? `${ship.name} leaves by the ${edge ?? 'edge'} and may return on turn ${reentry.reentryTurn} (3.9)`
      : `${ship.name} leaves by the ${edge ?? 'edge'} and does not return (3.9)`,
  })
}

/**
 * Fly one ship for one turn under 12.12.
 *
 * The cinematic path is not reused and cannot be: `applyOrder` writes
 * `facing: path.course` because 3.1 says *"the course and facing are always
 * identical"*, and 12.12 exists precisely to separate them. What is shared is
 * everything around the move — the cloak brackets, the wing that rides in the
 * bay, the terrain the track crossed, the ram — so those are duplicated here
 * deliberately rather than factored out, because a shared helper would have to
 * take both movement systems' results and the two have different shapes.
 */
function moveUnderVector(state: GameState, ship: ShipState, warmingUp: boolean): ActionOutcome {
  const before = vectorStateOf(ship)
  // 11.4 again: a ship spinning up its FTL drive "may not apply any thrust in
  // that move", which under 12.12 is an empty order sheet.
  const orders = warmingUp ? [] : (ship.vectorOrders ?? [])
  const drive = { rating: ship.design.drive.thrust, hits: ship.driveHits }

  if (ship.cloak) {
    ship.cloak = cloakStartOfMovement(ship.cloak, ship.placement.position)
    ship.cloaked = cloakMode(ship.cloak) !== 'none'
  }

  const result = moveVector(before, orders, drive)

  ship.lastKnown = {
    course: ship.placement.facing,
    courseDegrees: before.course,
    velocity: ship.velocity,
    turn: state.turn,
    cloaked: ship.cloaked,
  }
  ship.placement = { position: result.end.position, facing: result.end.facing }
  ship.velocity = result.end.velocity
  ship.courseDegrees = result.end.course
  // 4.2's optional aft-arc exception asks whether the ship touched its drive,
  // and under vector that is the whole sheet: burns and thruster points alike.
  ship.thrustUsed = result.budget.mainDriveUsed + result.budget.thrusterUsed

  for (const group of state.fighterGroups) {
    if (group.carrierId === ship.id && group.status === 'aboard') {
      group.position = ship.placement.position
      group.facing = ship.placement.facing
    }
  }
  if (ship.cloak) {
    const wasCloaked = ship.cloaked
    const after = cloakEndOfMovement(ship.cloak, { velocity: ship.velocity })
    ship.cloak = after
    ship.cloaked = cloakMode(after) !== 'none'
    if (ship.cloaked !== wasCloaked) {
      pushLog(state, {
        kind: 'note',
        shipId: ship.id,
        side: ship.side,
        text: ship.cloaked ? `${ship.name} cloaks (7.20)` : `${ship.name} decloaks`,
      })
    }
  }

  pushLog(state, {
    kind: 'move',
    shipId: ship.id,
    side: ship.side,
    text:
      `${ship.name} ${result.legal && orders.length > 0 ? formatVectorOrders(orders) : 'coasts'}` +
      ` — ${result.end.velocity} MU on ${result.end.course.toFixed(0)}°` +
      (result.legal ? '' : ', the sheet overran the drive (12.12)'),
  })

  // 12.12: "the tape-measure line, start position to finishing position" is
  // what a collision is tested against, and it is not the flown sequence.
  const track = [result.chord.from, result.chord.to]
  tracksOf(state).set(ship.id, track)
  dropMines(state, ship, track)
  const swung = resolveGravity(state, ship, track)
  const metTrack = resolveOrbitEntry(state, ship, track)
  if (!metTrack) {
    resolveTerrainHazards(state, ship, track, { shielded: swung })
    resolveDeclaredRam(state, ship)
    resolveLeavingTable(state, ship)
  }
  dragDockedShips(state, ship)
  dragCarriedHulls(state, ship)
  dragEscortingFlights(state, ship)
  return OK
}

/** 17.9's deferred change, landing at the start of the move it was deferred to. */
function applyPendingGravity(state: GameState, ship: ShipState): void {
  const pending = ship.pendingGravity
  if (!pending) return
  ship.pendingGravity = null
  ship.velocity = pending.velocity
  ship.placement = { ...ship.placement, facing: pending.facing }
  pushLog(state, {
    kind: 'move',
    shipId: ship.id,
    side: ship.side,
    text: `${ship.name} is carried round: velocity ${pending.velocity}, course ${pending.facing} (17.9)`,
  })
}

/**
 * Whose turn it is to place (18.1), or null when nobody owes a placement.
 *
 * *"Players alternate in placing one ship at a time … (or two to four ships at
 * a time for large battles)"*, and a side that runs out drops out of the
 * rotation rather than holding it up: alternation is a way of taking turns,
 * not a claim that the fleets are the same size. Recomputed from the order,
 * the batch and what has been placed, so nothing has to be kept in step.
 */
export function deployingSide(state: GameState): SideId | null {
  const deployment = state.deployment
  if (!deployment || deployment.order.length === 0) return null

  const owed = new Map<SideId, number>()
  for (const ship of shipsAwaitingDeployment(state)) {
    owed.set(ship.side, (owed.get(ship.side) ?? 0) + 1)
  }
  if (owed.size === 0) return null

  // How far into the rotation we are: each completed batch is one step, and a
  // side with nothing left is skipped over.
  const live = deployment.order.filter((id) => (owed.get(id) ?? 0) > 0)
  if (live.length === 0) return null
  const step = Math.floor(deployment.placed.length / deployment.batch)
  return live[step % live.length]
}

/** The side that owns a table half in an offensive/defensive battle (18.1). */
export function defendingSide(state: GameState): SideId | null {
  const deployment = state.deployment
  if (!deployment || deployment.battleType !== 'offensive-defensive') return null
  for (const [sideId, zone] of Object.entries(deployment.zones)) {
    if (zone.entry.includes('placed') && !zone.entry.includes('table-edge')) return sideId
  }
  return null
}

/**
 * The edge the whole action has drifted into, if any (16.4).
 *
 * *"Very close"* is the players' call, so the margin is the caller's; a beam
 * range band is the natural unit on a Full Thrust table and is what the UI
 * offers.
 */
export function tableIsCrowded(state: GameState, margin: number): ShiftEdge | null {
  if (!optional(state).movingTable) return null
  const positions = state.ships
    .filter((ship) => !ship.destroyed && !ship.offTable)
    .map((ship) => ship.placement.position)
  return crowdedEdge(positions, state.table, margin)
}

/** Where the computer would put a side's remaining ships (18.1). */
export function proposeDeployment(
  state: GameState,
  sideId: SideId,
): Array<{ shipId: string; position: Point; facing: Course; velocity: number }> {
  const deployment = state.deployment
  if (!deployment) return []
  const zone = deployment.zones[sideId]
  if (!zone) return []
  const ships = shipsAwaitingDeployment(state).filter((ship) => ship.side === sideId)
  const spots = defaultPlacements(zone, ships.length)
  return ships.map((ship, i) => ({
    shipId: ship.id,
    position: spots[i]?.position ?? ship.placement.position,
    facing: spots[i]?.facing ?? ship.placement.facing,
    velocity: spots[i]?.velocity ?? 6,
  }))
}

const SOLID_TERRAIN: ReadonlySet<TerrainKind> = new Set<TerrainKind>(['planet', 'planetoid'])

/** Dust and gas: 17.2 charges for speed through it and nothing for being in it. */
const CLOUD_TERRAIN: ReadonlySet<TerrainKind> = new Set<TerrainKind>(['dust-cloud', 'nebula'])

/** Rock and wreckage: 17.4's die per full 6 MU, straight through screens and armour. */
const FIELD_TERRAIN: ReadonlySet<TerrainKind> = new Set<TerrainKind>(['asteroid-field', 'debris'])

function terrainOfKinds(state: GameState, kinds: ReadonlySet<TerrainKind>): TerrainBody[] {
  return state.terrain
    .filter((feature) => kinds.has(feature.kind))
    .map((feature) => ({ id: feature.id, position: feature.position, radius: feature.radius }))
}

/**
 * What the ship flew through (17.2, 17.4, 17.6).
 *
 * Section 17 opens by calling itself *"mostly pure space opera"*, so it is an
 * optional rule — and it has to be one for a second reason: every hazard draws
 * from `state.rng`, and a die drawn in a path an old battle file did not draw
 * it in shifts the stream for everything after it. Off, no dice, old files
 * replay exactly as they were fought.
 *
 * The order below is fixed and is part of the rules reading, because the order
 * is the RNG stream: solid bodies first (a ship killed by a rock throws nothing
 * else), then clouds, then fields, each in the order the scenario placed them.
 */
function resolveTerrainHazards(
  state: GameState,
  ship: ShipState,
  path: readonly Point[],
  opts: { shielded?: boolean } = {},
): void {
  if (!optional(state).terrainHazards) return
  if (ship.destroyed || ship.offTable) return

  // 17.6: "When any ship, regardless of its class, hits an asteroid, the ship
  // is completely destroyed. Ramming a billion tons of rock at any speed is not
  // recommended, even in a superdreadnought!"
  //
  // Unless 17.9's partial orbit got there first: a pass that the gravity zone
  // actually turned "cannot collide with the planet or enter another zone even
  // if the straight line path would indicate otherwise", and the straight line
  // is exactly what this test measures.
  for (const body of opts.shielded ? [] : terrainOfKinds(state, SOLID_TERRAIN)) {
    if (!stationaryCollisionRisk(path, body)) continue
    const miss = resolveCollision(ship.velocity, currentThrust(ship), state.rng, {
      advancedDrive: ship.design.drive.advanced,
    })
    if (miss.avoided) {
      pushLog(state, {
        kind: 'move',
        shipId: ship.id,
        side: ship.side,
        dice: miss.roll === null ? undefined : [miss.roll],
        text: `${ship.name} threads the rock — ${miss.reason || `needed ${miss.target}`} (17.6)`,
      })
      continue
    }
    ship.destroyed = true
    ship.pendingThresholdRows = 0
    pushLog(state, {
      kind: 'destroyed',
      shipId: ship.id,
      side: ship.side,
      dice: miss.roll === null ? undefined : [miss.roll],
      text: `${ship.name} flies into the rock and is gone — ${miss.reason} (17.6)`,
    })
    return
  }

  // 17.2 rule 1: over 12 MU through a cloud costs a die, read on the beam
  // table, with standard screens offering nothing.
  for (const body of terrainOfKinds(state, CLOUD_TERRAIN)) {
    if (!stationaryCollisionRisk(path, body)) continue
    const dust = cloudSpeedDamage(ship.velocity, state.rng, {
      screens: effectiveScreenLevel(ship),
      advancedScreens: ship.design.screens.advanced,
    })
    if (!dust.rolled) continue
    hurtByTerrain(state, ship, {
      normalDamage: dust.damage,
      penetratingDamage: 0,
      mode: dust.mode,
      dice: dust.roll === null ? [] : [dust.roll],
      detail: `dust at velocity ${ship.velocity} (17.2)`,
    })
    if (ship.destroyed) return
  }

  // 17.4: one die per full 6 MU, and the face is the damage, penetrating.
  for (const body of terrainOfKinds(state, FIELD_TERRAIN)) {
    if (!stationaryCollisionRisk(path, body)) continue
    const hits = resolveMeteorField(ship.velocity, state.rng)
    if (hits.dice.length === 0) continue
    hurtByTerrain(state, ship, {
      normalDamage: 0,
      penetratingDamage: hits.penetratingDamage,
      mode: hits.mode,
      dice: hits.dice,
      detail: `rock at velocity ${ship.velocity} (17.4)`,
    })
    if (ship.destroyed) return
  }
}

/** Apply what a piece of terrain did, the same way a shot is applied (4.8). */
function hurtByTerrain(
  state: GameState,
  ship: ShipState,
  hit: { normalDamage: number; penetratingDamage: number; mode: DamageMode; dice: number[]; detail: string },
): void {
  const total = hit.normalDamage + hit.penetratingDamage
  if (total <= 0) return
  const applied = applyDamage(targetStateOf(ship), hit, {
    rearArcRule: false,
    rearArc: false,
    source: 'direct-fire',
  })
  writeBackDamage(ship, applied.target)
  markHullBoxes(ship, applied.hullDamage)
  pushLog(state, {
    kind: 'damage',
    shipId: ship.id,
    side: ship.side,
    dice: hit.dice,
    text: `${ship.name} takes ${applied.hullDamage} from ${hit.detail}`,
  })
  if (ship.destroyed) {
    pushLog(state, { kind: 'destroyed', shipId: ship.id, text: `${ship.name} is destroyed` })
  }
}

function blockingTerrain(state: GameState): TerrainBody[] {
  return state.terrain
    .filter((feature) => SOLID_TERRAIN.has(feature.kind))
    .map((feature) => ({ id: feature.id, position: feature.position, radius: feature.radius }))
}

/**
 * How stealthy the target is right now (7.4, 7.5).
 *
 * Stealth is not electronic warfare and does not stack with it: it is a hull
 * shape and a coating, and 7.4 wears it away as the hull is opened up — a
 * Stealth-1 hull is bare once two rows are gone, a Stealth-2 hull drops a
 * level per row after the first. A stealth *field* adds to it, and 7.5 caps
 * the total at 2.
 *
 * 7.20 switches it off entirely under a cloak: *"The ship does not gain any
 * bonuses for stealth while the cloak is active."*
 */
function stealthLevelOf(ship: ShipState): StealthLevel {
  if (ship.cloaked) return 0
  const built = Math.min(2, operationalCount(ship, 'stealth-hull')) as StealthLevel
  const field = Math.min(2, operationalCount(ship, 'stealth-field')) as StealthLevel
  return combinedStealthLevel(stealthHullLevel(built, hullRowsCompleted(ship)), field, true)
}

/**
 * The target's electronic warfare fit, as one shot sees it (7.17 – 7.22).
 *
 * Levels are what is *operational*, not what is fitted: ECM is one SSD box per
 * level and is lost progressively to damage (7.18), so a knocked-out box stops
 * counting the moment it is crossed off. Area ECM is read off the neighbours,
 * since 7.19 covers a *friend* within 6 MU rather than the ship carrying it —
 * and 7.20 switches a cloaked ship's area cover off, which is why the emitter
 * has to be checked as well as the range.
 */
function ewDefencesOf(state: GameState, target: ShipState): EwDefences {
  const areaEcm = state.ships
    .filter(
      (ship) =>
        ship.side === target.side &&
        !ship.destroyed &&
        !ship.offTable &&
        !ship.cloaked &&
        distance(ship.placement.position, target.placement.position) <= AREA_ECM_RADIUS,
    )
    .reduce((best, ship) => Math.max(best, operationalCount(ship, 'area-ecm')), 0)

  return {
    holofield: operationalCount(target, 'holofield') > 0,
    ecmLevel: operationalCount(target, 'ecm'),
    areaEcmLevel: areaEcm,
    cloak: target.cloak ? cloakMode(target.cloak) : 'none',
  }
}

/**
 * A ship as its point defence sees it.
 *
 * The one rule that lives here rather than in `defences.ts` is 8.4's: "A ship
 * that launches or recovers fighters cannot use an ADFC in that turn." It is a
 * flight-operations rule that happens to be paid for in point defence, so the
 * ADFC count is zeroed at the boundary and `defences.ts` never has to know
 * that carriers exist. The ship's own mounts still fire — only the umbrella it
 * holds over its neighbours goes down.
 */
function pdDefenderOf(state: GameState, ship: ShipState, mounts: PdMount[]): PdDefender {
  const busy = adfcLockedOut({
    launchedThisTurn: launchedThisTurn(state, ship),
    recoveredThisTurn: recoveredThisTurn(state, ship),
  })
  return {
    id: ship.id,
    placement: ship.placement,
    mounts,
    adfc: busy ? 0 : adfcCount(ship, 'adfc'),
    advancedAdfc: busy ? 0 : adfcCount(ship, 'advanced-adfc'),
  }
}

function launchedThisTurn(state: GameState, ship: ShipState): boolean {
  return state.fighterGroups.some(
    (group) => group.carrierId === ship.id && group.launchedTurn === state.turn,
  )
}

function recoveredThisTurn(state: GameState, ship: ShipState): boolean {
  return state.fighterGroups.some(
    (group) => group.carrierId === ship.id && group.recoveredTurn === state.turn,
  )
}

// ---------------------------------------------------------------------------
// Damage plumbing
// ---------------------------------------------------------------------------

/**
 * The working screen level (7.2).
 *
 * A screen generator is a symbol on the SSD and takes threshold checks like any
 * other, so losing one drops the level — which is why designs carry a
 * `screen-generator` entry per level plus any backups. The arithmetic and the
 * cap belong to `defences.ts`, which owns 7.2; counting the surviving
 * generators off a ShipState is the part that belongs here.
 */
export function effectiveScreenLevel(ship: ShipState): ScreenLevel {
  const working = ship.design.systems.filter(
    (system) => system.kind === 'screen-generator' && !ship.destroyedSystems.has(system.id),
  ).length
  return screenLevelOf(ship.design.screens, working)
}

/**
 * Which hull actually takes the damage a hit on this one produced (11.7).
 *
 * *"Damage received can be applied to either the Mothership or battleriders at
 * the choice of the defending player"* — and *"battleriders are protected by
 * the Mothership's screens (but not armor)"*. Both halves fall out of putting
 * the redirect here rather than at the shot: screens are spent when the weapon
 * is resolved, against the Mothership, before this is reached; armour is read
 * out of `targetStateOf`, which now reads the rider's.
 */
function damageBearer(ship: ShipState): ShipState {
  const sink = ship.damageSink
  return sink && !sink.destroyed && sink.carriedBy === ship.id ? sink : ship
}

/** The damage pipeline's view of a ship. */
function targetStateOf(target: ShipState): DamageableTarget {
  const ship = damageBearer(target)
  const fresh = createTargetState(ship.design)
  return {
    ...fresh,
    hullDamage: ship.hullMarked,
    armourRemaining: ship.design.armour.layers.map(
      (boxes, layer) => boxes - (ship.armourMarked[layer] ?? 0),
    ),
  }
}

/** Write armour back; hull goes through markHullBoxes, which owns the rows. */
function writeBackDamage(target: ShipState, after: DamageableTarget): void {
  const ship = damageBearer(target)
  ship.armourMarked = ship.design.armour.layers.map(
    (boxes, layer) => boxes - (after.armourRemaining[layer] ?? boxes),
  )
}

// ---------------------------------------------------------------------------
// The ready gate (online play)
// ---------------------------------------------------------------------------

/**
 * Which sides have declared themselves finished with the current phase.
 *
 * Hot-seat does not need this — one player advances the phase by hand. Online,
 * a phase closes only when every side says so, because neither console may
 * speak for the other.
 *
 * Stored off the GameState so it never rides in a save: readiness is about the
 * two people at the table, not about the battle.
 */
/**
 * Optional rules in force for this battle.
 *
 * They live in the setup rather than in GameState, which the engine cannot
 * reach — so the store stamps them here when it builds the game. Held off the
 * state so they never ride in a save twice and can never drift from the setup
 * that is the authority.
 */
export interface OptionalRules {
  driveDamage?: boolean
  rearArcAttacks?: boolean
  coreSystems?: boolean
  reactorBreaches?: boolean
  emergencyThrust?: boolean
  sensorRules?: boolean
  /**
   * 4.2's exception to the aft-arc ban: *"Aft arc fire is permitted on any game
   * turn in which the firing ship did not use any thrust from its main drive."*
   * Off by default, which leaves the ban absolute as the base rule states it.
   */
  aftArcFire?: boolean
  /**
   * Section 17's hazards: collisions with rock, dust at speed, meteor fields.
   * *"The following suggestions are mostly pure space opera"* — the section
   * says so itself — and every one of them draws dice, so it is off unless the
   * table asks for it.
   */
  terrainHazards?: boolean
  /**
   * 18.3: *"Combat Points Value"* reprices every hull by mass. A different
   * currency rather than a discount, so the fleet picker and the scoreboard
   * both have to be told which one the table is playing in.
   */
  cpv?: boolean
  /**
   * 12.12: *"a completely OPTIONAL alternative movement system, which players
   * may use instead of the standard FT movement rules"*. Settled before play,
   * like every other option, and absent means 3.1's cinematic movement.
   */
  movementSystem?: 'cinematic' | 'vector'
  /**
   * 16.4: the playing area slides under the ships instead of the action
   * running out of room, which is also what makes 3.9's departure something
   * other than a retreat and what 16.5's pursuit hangs off.
   */
  movingTable?: boolean
  /** 3.9's optional re-entry roll for a ship that flew off the edge. */
  tableReentry?: boolean
  /**
   * 12.11: *"after checking for systems failures make one further roll at the
   * same odds … to determine if the ship has been knocked off course."*
   */
  knockedOffCourse?: boolean
  /**
   * 17.3: *"Flares may occur at random, perhaps diced for each turn, if the
   * battle is happening fairly close to a very active star."*
   *
   * Its own flag rather than part of `terrainHazards`, because a flare is not
   * something a captain flies into: it happens to a whole area whatever anyone
   * plots, and a table that wants rocks does not necessarily want that.
   */
  solarFlares?: boolean
  /**
   * 17.7: the table is *"an area at a given orbit radius above a planet"*, so
   * running off the edge is a lap round the world rather than a retreat, and
   * the ship comes back on the far side.
   *
   * Beats 3.9's `tableReentry`, which answers the same question for a table
   * that is a patch of open space.
   */
  orbitalTable?: boolean
  /**
   * 12.9: a captain whose ship is coming apart may *"strike the colors"* and
   * surrender to the nearest enemy vessel, rolled at the same time as the
   * threshold check.
   *
   * A die in a path that already existed, so it is off unless the table asks:
   * switching it on shifts the RNG stream and every battle saved before it
   * would replay differently.
   */
  strikeColors?: boolean
  /**
   * 12.10: *"If both fleets are composed of ships built by the same navy … all
   * ships and squadrons roll a +1 on their direct fire weapons."*
   *
   * No extra dice, but it changes what the same dice mean, which is the same
   * problem for a saved battle. Off unless the table says the war is a civil
   * one — and the engine still checks that both fleets really are one navy.
   */
  civilWar?: boolean
  /**
   * 8.17: *"Any fighter group that has lost one or more members must roll a D6
   * before making an attack."* The section opens by saying the rule is not
   * used, so it is off unless the table asks for it.
   */
  fighterMorale?: boolean
  /**
   * 8.18: Aces and Turkeys. The roll happens at the start of the game in
   * `startScenario`, off its own generator; this is here so the rest of the
   * engine can say whether the rule is in play.
   */
  fighterQuality?: boolean
}

const OPTIONS = new WeakMap<GameState, OptionalRules>()

export function setOptionalRules(state: GameState, rules: OptionalRules): void {
  OPTIONS.set(state, rules)
}

export function optional(state: GameState): OptionalRules {
  return OPTIONS.get(state) ?? {}
}

/**
 * The engine's rules reading, as the battle was stamped with it.
 *
 * A battle file is a journal, so a fix that changes how many dice a shot
 * throws rewrites every old battle that threw them. `CURRENT_RULES_VERSION`
 * in `savedGame.ts` is what a fight is stamped with, and this is where the
 * engine reads it back: a change that shifts the RNG stream is written as
 * `rulesReading(state) >= n`, and an unstamped file replays as reading 1,
 * exactly as it was fought.
 *
 * This is the mechanism the architecture doc describes. It was stamped onto
 * every setup from the start and never read by anything, so the first fix
 * that needed it is also the one that makes it work.
 */
const RULES_READING = new WeakMap<GameState, number>()

export function setRulesReading(state: GameState, version: number | undefined): void {
  RULES_READING.set(state, Math.max(1, Math.floor(version ?? 1)))
}

export function rulesReading(state: GameState): number {
  return RULES_READING.get(state) ?? 1
}

const READY = new WeakMap<GameState, Record<SideId, boolean>>()

function readySides(state: GameState): Record<SideId, boolean> {
  let map = READY.get(state)
  if (!map) {
    map = {}
    READY.set(state, map)
  }
  return map
}

export function sidesAwaited(state: GameState): SideId[] {
  const ready = readySides(state)
  return state.sides.filter((side) => !ready[side.id]).map((side) => side.id)
}

export function everyoneReady(state: GameState): boolean {
  return sidesAwaited(state).length === 0
}

export function clearReady(state: GameState): void {
  READY.set(state, {})
}

/**
 * Which side an action speaks for, or null if it speaks for the table. Online
 * play uses this to refuse a console giving orders to the other fleet.
 */
export function actionSide(state: GameState, action: GameAction): SideId | null {
  if ('side' in action) return action.side
  const shipId =
    'shipId' in action ? action.shipId : 'carrierId' in action ? action.carrierId : undefined
  if (shipId) return shipById(state, shipId)?.side ?? null
  if ('flightId' in action) {
    return state.fighterGroups.find((g) => g.id === action.flightId)?.side ?? null
  }
  if ('squadronId' in action) {
    return state.gunboatSquadrons.find((s) => s.id === action.squadronId)?.side ?? null
  }
  return null
}

/**
 * Whether an action may be taken back in an online match. Actions that close a
 * phase or roll shared dice are not undoable, because the other console has
 * already seen the result.
 */
export function undoableInMatch(action: GameAction): boolean {
  switch (action.type) {
    case 'advance-phase':
    case 'signal-ready':
    case 'roll-initiative':
    case 'set-initiative-order':
    case 'move-ship':
    case 'fire-weapon':
    case 'fire-at-flight':
    // Every one of these rolls dice the other console has already read: a
    // gate's activation delay, its transfer table, and the shot that took its
    // hull boxes off (11.9).
    case 'fire-at-gate':
    case 'announce-gate-activation':
    case 'gate-transfer':
    case 'threshold-check':
    case 'resolve-damage-control':
    case 'resolve-point-defence':
    case 'resolve-ordnance-attacks':
    case 'resolve-boarding':
    case 'resolve-reactor-explosions':
      return false
    default:
      return true
  }
}
