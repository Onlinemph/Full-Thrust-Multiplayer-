/**
 * Stargrunt II — what a battle is set up from, what its state is, and the
 * actions that change it.
 *
 * The same shape as Dirtside's table (src/dirtside/table/types.ts): a battle
 * is a `GameSetup` plus a journal of `Action`s, `applyAction` is the one
 * door, every roll comes out of the state's own stream, so a saved battle
 * replays exactly. Where Dirtside moves elements, Stargrunt moves figures:
 * a unit is a squad of individual troopers, each with a weapon, a status
 * (fit, wounded, stabilised, dead) and a place on the table.
 *
 * Rule references are printed page numbers of the 1996 rulebook, digested in
 * docs/rules/stargrunt.md; the engine specs built from it are the source of
 * the readings marked [reading].
 */

import type { DiceStream, DieType } from './dice'
import type { Objective, Point, SideId, TerrainFeature } from '../dirtside/table/types'

export type { Objective, Point, SideId, TerrainFeature }
export { otherSide, refuse, type Refusal } from '../dirtside/table/types'

// ---------------------------------------------------------------------------
// Troop quality, leadership, morale (pp. 9, 19–21)
// ---------------------------------------------------------------------------

/** Five qualities, each a die (p. 9): Untrained D4, Green D6, Regular D8, Veteran D10, Elite D12. */
export type Quality = 'untrained' | 'green' | 'regular' | 'veteran' | 'elite'
export const QUALITY_DIE: Record<Quality, DieType> = { untrained: 4, green: 6, regular: 8, veteran: 10, elite: 12 }

/** The number on the activation marker (p. 9): the score a test must exceed, so 1 is the best leader. */
export type Leadership = 1 | 2 | 3

export type Confidence = 'CO' | 'ST' | 'SH' | 'BR' | 'RO'
export const CONFIDENCE_LEVELS: readonly Confidence[] = ['CO', 'ST', 'SH', 'BR', 'RO']

/** Mission motivation (p. 19): the column of the threat table a unit tests in. */
export type Motivation = 'low' | 'medium' | 'high'

/** Fatigue (p. 19). [reading] Carried on the unit for the campaign; the first playable game tests with it only where the spec says so. */
export type Fatigue = 'fresh' | 'tired' | 'exhausted'

/** The command ladder (pp. 8–9); communications shift down a die type for each rung bypassed. */
export type CommandLevel = 'squad' | 'platoon' | 'company' | 'battalion' | 'regiment'
export const COMMAND_LADDER: readonly CommandLevel[] = ['squad', 'platoon', 'company', 'battalion', 'regiment']

// ---------------------------------------------------------------------------
// Kit (Chapter 12, the generic weapons table)
// ---------------------------------------------------------------------------

/** Personal armour (p. 29, quick reference p. 1): battledress D4 up to heavy power armour D12. */
export type ArmourKind = 'battledress' | 'partial-light' | 'full-light' | 'light-power' | 'heavy-power'

/** How a trooper moves (p. 22): base inches per action, and the combat-move die. */
export type MobilityKind = 'foot' | 'very-light' | 'slow-power' | 'fast-power'

/** The small arms of the generic weapons table (p. 34). */
export type SmallArmKind =
  | 'improvised'
  | 'light-autopistol'
  | 'heavy-autopistol'
  | 'smg'
  | 'assault-shotgun'
  | 'hunting-rifle'
  | 'lowtech-rifle'
  | 'lowtech-rifle-gl'
  | 'advanced-rifle'
  | 'advanced-rifle-gl'
  | 'gauss-rifle'
  | 'gauss-rifle-gl'

/** The infantry support weapons of the generic weapons table (p. 34). */
export type SupportWeaponKind = 'saw' | 'rotary-saw' | 'gauss-saw' | 'plasma-gun' | 'agl' | 'mlp' | 'iavr'

export interface SmallArmProfile {
  kind: SmallArmKind
  name: string
  /** Firepower value per trooper (p. 34): 0.5, 1, 2 or 3. */
  firepower: number
  impact: DieType
  /** Effective only up to one range band (p. 34). */
  closeOnly: boolean
}

export interface SupportWeaponProfile {
  kind: SupportWeaponKind
  name: string
  /** The support firepower die added to squad fire, or rolled with the quality die when it fires alone (p. 35, p. 37). */
  firepowerDie: DieType
  impact: DieType
  /** Impact doubled for a major hit on a point target (p. 34, the asterisked weapons). */
  doubleVsPoint: boolean
}

/** A trooper's job beyond carrying a rifle. */
export type FigureRole = 'trooper' | 'medic' | 'observer' | 'comms' | 'sniper'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export interface FigureSetup {
  id: string
  name?: string
  smallArm: SmallArmKind
  /** A support weapon this trooper crews (a SAW gunner, a plasma gunner). */
  supportWeapon?: SupportWeaponKind
  /** Overrides the unit's armour for this figure. */
  armour?: ArmourKind
  role?: FigureRole
  /** The unit leader (p. 8); the first figure if none is marked. */
  leader?: boolean
  position?: Point
}

export interface UnitSetup {
  id: string
  name: string
  quality: Quality
  leadership: Leadership
  /** CO if omitted (p. 20). */
  confidence?: Confidence
  /** The side's motivation if omitted (p. 19). */
  motivation?: Motivation
  armour: ArmourKind
  mobility: MobilityKind
  commandLevel: CommandLevel
  /** The unit that commands this one (a platoon HQ for a squad), for communications and transfers (p. 16). */
  commanderId?: string
  figures: FigureSetup[]
}

export interface SideSetup {
  id: SideId
  name: string
  motivation: Motivation
  units: UnitSetup[]
}

export interface TableSetup {
  width: number
  depth: number
  terrain: TerrainFeature[]
  objectives: Objective[]
}

export interface GameSetup {
  name: string
  seed: number
  battle: 'encounter' | 'attack-defence'
  attacker?: SideId
  table: TableSetup
  sides: [SideSetup, SideSetup]
  /** The battle ends after this many turns; null plays until one side breaks or declares (p. 14). */
  turnLimit: number | null
  /** Sides the computer plays. The engine never reads it; the screen does. */
  aiSides?: SideId[]
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** A trooper's condition (pp. 36, 39): wounded figures need a medic's or a comrade's attention; stabilised ones are out of the fight but safe. */
export type FigureStatus = 'ok' | 'wounded' | 'stabilised' | 'dead'

export interface FigureState {
  id: string
  unitId: string
  sideId: SideId
  name: string
  position: Point
  smallArm: SmallArmKind
  supportWeapon: SupportWeaponKind | null
  armour: ArmourKind
  role: FigureRole
  status: FigureStatus
}

export interface UnitState {
  id: string
  sideId: SideId
  name: string
  quality: Quality
  leadership: Leadership
  confidence: Confidence
  motivation: Motivation
  armour: ArmourKind
  mobility: MobilityKind
  commandLevel: CommandLevel
  commanderId: string | null
  figureIds: string[]
  /** The unit leader; null only between a leader falling and the replacement roll (p. 10). */
  leaderId: string | null
  /** Activation marker face down this turn (p. 9). */
  activated: boolean
  /** Suppression markers, up to three (p. 18). */
  suppression: 0 | 1 | 2 | 3
  /** Has been suppressed before, for the threat table's "first time" row (p. 20). */
  everSuppressed: boolean
  /** Has taken casualties from fire before, for the threat table (p. 20). */
  everHit: boolean
  inPosition: boolean
  /** In a travel move's column: no other actions until it reorganises (p. 22). */
  travelling: boolean
  /** Frozen by panic: no actions until it recovers (p. 21). */
  panic: boolean
  /** Has already faced the panic test it was due (p. 21). */
  panicTested: boolean
  /** Weapons fired this turn: 'small-arms' for the squad's rifles, or a figure id for a support weapon (p. 16: each weapon once a turn). */
  firedThisTurn: string[]
  /** Transfers this unit, as a commander, has attempted this turn (p. 16: two a turn). */
  transfersThisTurn: number
  /** Enemy units that have fired on this one, each with the last turn it did (p. 21: a broken unit fires only if fired upon). */
  firedOnBy: Record<string, number>
}

export type Phase = 'deployment' | 'turn-start' | 'activation' | 'ended'

export interface ActivationState {
  unitId: string
  sideId: SideId
  actionsTaken: 0 | 1 | 2
  /** Came from a commander's transfer (p. 16): it returns to that commander's side of the flow when it ends. */
  transferredBy: string | null
}

export interface LogEntry {
  turn: number
  side: SideId | null
  text: string
  page?: string
  /** Dice rolled for this line, for the log's detail. */
  dice?: number[]
}

export interface GameResult {
  winner: SideId | 'draw'
  reason: string
  values: Record<SideId, number>
}

export interface SideState {
  name: string
  ready: boolean
  done: boolean
}

export interface GameState {
  setup: GameSetup
  rng: DiceStream
  turn: number
  phase: Phase
  figures: Record<string, FigureState>
  units: Record<string, UnitState>
  sides: Record<SideId, SideState>
  toAct: SideId | null
  chooser: SideId | null
  activation: ActivationState | null
  /** After a pass, the other side owes this many activations in succession (p. 15). */
  owed: number
  objectives: Record<string, { heldBy: SideId | null; takenBy?: string }>
  journal: Action[]
  log: LogEntry[]
  result: GameResult | null
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** One figure's move: waypoints after its current position. */
export interface FigureMove {
  figureId: string
  path: Point[]
}

/** What a fire action shoots with (p. 35, p. 37). */
export type FireWith =
  /** The squad's small arms, with any of its support weapons joining in (p. 35). */
  | { kind: 'small-arms'; supportFigureIds?: string[] }
  /** One support weapon firing on its own (p. 37). */
  | { kind: 'support'; figureId: string }

export type Action =
  | { kind: 'ready'; side: SideId }
  | { kind: 'deploy'; side: SideId; figureId: string; position: Point }
  | { kind: 'choose-first'; side: SideId; first: SideId }
  | { kind: 'activate'; side: SideId; unitId: string }
  | { kind: 'end-activation'; side: SideId }
  | { kind: 'pass'; side: SideId }
  | { kind: 'done'; side: SideId }
  /** Normal (up to base mobility), combat (the rolled distance toward each destination) or travel (twice normal, in column) (p. 22). */
  | { kind: 'move'; side: SideId; mode: 'normal' | 'combat' | 'travel'; moves: FigureMove[] }
  | { kind: 'fire'; side: SideId; targetUnitId: string; with: FireWith }
  /**
   * Close assault (p. 41): both actions; each named figure's combat move ends in base contact with a
   * defender. `ifShort` is the player's choice when the second roll still falls short (p. 43): stay
   * where the dash ended (the default) or give up and go back.
   */
  | { kind: 'close-assault'; side: SideId; targetUnitId: string; moves: FigureMove[]; ifShort?: 'stay' | 'withdraw' }
  /** Reposition figures, restore integrity, treat the wounded (p. 17). */
  | { kind: 'reorganise'; side: SideId; moves?: FigureMove[] }
  | { kind: 'remove-suppression'; side: SideId }
  | { kind: 'go-in-position'; side: SideId }
  | { kind: 'leave-position'; side: SideId }
  /** A commander hands a subordinate a full activation (p. 16). */
  | { kind: 'transfer'; side: SideId; receiverUnitId: string }
  /** A commander rallies a unit: confidence up a level on success (p. 17). */
  | { kind: 'rally'; side: SideId; targetUnitId: string }
  /** Spend a panicked unit's action trying to recover (p. 21). */
  | { kind: 'recover-panic'; side: SideId }
