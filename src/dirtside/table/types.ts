/**
 * Dirtside II — the table: what a battle is set up from, what its state is,
 * and the actions that change it (Chapters 4–8).
 *
 * The same shape as the fleet game and the campaign: a battle is a `GameSetup`
 * plus a journal of `Action`s, and `applyAction` is the one door. Every roll
 * comes out of the state's own stream, so a saved battle replays exactly.
 * Rule references are printed page numbers of the 1993 rulebook, digested in
 * docs/rules/dirtside.md.
 */

import type { TerrainType } from '../data/mobility'
import type { DiceStream } from '../dice'
import type { InfantryElement, VehicleDesign } from '../types'

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Inches. x runs along the baselines, y from the north baseline towards the south. */
export interface Point {
  x: number
  y: number
}

export type SideId = 'north' | 'south'

export type Shape =
  | { kind: 'circle'; centre: Point; radius: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  /** A road or a river: a polyline with a width. */
  | { kind: 'path'; points: Point[]; width: number }

/** A piece of terrain (p. 25–26). Later features lie on top of earlier ones. */
export interface TerrainFeature {
  id: string
  terrain: TerrainType
  shape: Shape
  label?: string
  /** A road that is a major highway keeps road going through an urban area; an ordinary street does not (p. 26). */
  majorHighway?: boolean
}

/** An objective marker (p. 17): face down, taken by moving over it. */
export interface Objective {
  id: string
  position: Point
  value: number
  /** Who drew it and so knows its value; both, once it has been taken. */
  drawnBy: SideId | null
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export type Quality = 'green' | 'regular' | 'veteran'
export type Leadership = 1 | 2 | 3
export type Confidence = 'CO' | 'ST' | 'SH' | 'BR' | 'RO'
export const CONFIDENCE_LEVELS: readonly Confidence[] = ['CO', 'ST', 'SH', 'BR', 'RO']

export interface ElementSetup {
  id: string
  name?: string
  vehicle?: VehicleDesign
  infantry?: InfantryElement
  position?: Point
  /** Degrees clockwise from north (up the table); 180 faces the south baseline. */
  facing?: number
  /** The unit leader (p. 23); the first element if none is marked. */
  leader?: boolean
  /** Starts the game in a prepared position (p. 20). */
  dugIn?: boolean
}

export interface UnitSetup {
  id: string
  name: string
  quality: Quality
  leadership: Leadership
  /** Starting confidence; CO if omitted (p. 21). */
  confidence?: Confidence
  /** The force's overall command unit (p. 24). */
  commandUnit?: boolean
  elements: ElementSetup[]
}

export interface SideSetup {
  id: SideId
  name: string
  units: UnitSetup[]
}

export interface TableSetup {
  /** Along the baselines. */
  width: number
  /** Baseline to baseline. */
  depth: number
  terrain: TerrainFeature[]
  objectives: Objective[]
}

export interface GameSetup {
  name: string
  seed: number
  battle: 'encounter' | 'attack-defence'
  /** In an attack/defence battle, who attacks; the other side holds the objectives at the start (p. 17). */
  attacker?: SideId
  table: TableSetup
  sides: [SideSetup, SideSetup]
  /** The game ends after this many turns; null plays until someone declares it (p. 17). */
  turnLimit: number | null
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type Posture = 'none' | 'hull-down' | 'turret-down'

export interface ElementState {
  id: string
  unitId: string
  sideId: SideId
  name: string
  vehicle?: VehicleDesign
  infantry?: InfantryElement
  position: Point
  facing: number
  /** Knocked out (p. 30) or an infantry element removed (p. 33). */
  destroyed: boolean
  damaged: boolean
  immobilised: boolean
  systemsDown: boolean
  /** The activation count when the systems went down; repairs come in a later activation (p. 32). */
  systemsDownAt: number | null
  /** A prepared position; lost on moving (p. 20). */
  dugIn: boolean
  /** Declared at the end of a move: hull down or turret down (p. 20, p. 29). */
  posture: Posture
  /** In a wood: on its edge or within it (p. 20). Derived from the position, kept for the record. */
  wood: 'edge' | 'within' | null
  /** Where it entered the edge of a wood its mobility type cannot pass: it leaves by the same point (p. 25). */
  woodEntry: Point | null
}

export interface UnitState {
  id: string
  sideId: SideId
  name: string
  quality: Quality
  leadership: Leadership
  confidence: Confidence
  commandUnit: boolean
  leaderElementId: string | null
  elementIds: string[]
  /** Command marker inverted: the activation is spent this turn (p. 18). */
  activated: boolean
  underFire: boolean
  /** Frozen on first contact (p. 23); the next activation only removes the marker. */
  panic: boolean
  /** Has been fired on or assaulted at least once: no further panic risk. */
  contacted: boolean
  /** Has lost its first element: the +1 test has been taken. */
  firstLossTaken: boolean
  /** The evasive marker, until the unit's next activation (p. 27). */
  evasive: boolean
  /** Elements the unit started with, for the 25% and 50% tests (p. 23). */
  strength: number
  /** Elements damaged or destroyed so far, for the 50% test. */
  casualties: number
}

export interface SideState {
  id: SideId
  name: string
  /** Deployment finished (p. 17). */
  ready: boolean
  /** No more activations this turn (p. 18). */
  done: boolean
  /** The command unit is gone: no rallying (p. 24). */
  commandLost: boolean
  /** The turn it was lost: no new offensives for the rest of it (p. 24). */
  commandLostTurn: number | null
}

export type Phase = 'deployment' | 'turn-start' | 'activation' | 'ended'

export interface ActivationElement {
  startPosition: Point
  factorsUsed: number
  moved: boolean
  /** Fired a weapon system this activation: the one combat action (p. 18). */
  fired: boolean
  /** Fired first and so may move at most half its base movement afterwards (p. 28). */
  firedBeforeMoving: boolean
  /** Moved evasively (p. 27). */
  evasive: boolean
  /** Moved in travel mode: easy going counted double, no fire (p. 25). */
  travel: boolean
}

export interface FireEffectiveness {
  die: number
  roll: number
  result: 'ineffective' | 'partial' | 'full'
  /** Elements that may draw chits this activation under a partial result. */
  cap: number | null
  /** Elements that have drawn so far. */
  used: number
}

export interface OpportunityWindow {
  /** Who may fire. */
  sideId: SideId
  /** The element that just moved. */
  movedElementId: string
}

export interface ActivationState {
  unitId: string
  sideId: SideId
  elements: Record<string, ActivationElement>
  /** The under-fire reaction test, once attempted (p. 24). */
  moveTest: 'passed' | 'failed' | null
  /** Shaken infantry's reaction test to advance or leave cover (p. 22). */
  advanceTest: 'passed' | 'failed' | null
  effectiveness: FireEffectiveness | null
  window: OpportunityWindow | null
  /** The opponent has waived opportunity fire for the rest of this activation. */
  windowsWaived: boolean
  /** Elements that have tried a systems repair this activation (p. 32). */
  repairTried: string[]
}

export interface LogEntry {
  turn: number
  side: SideId | null
  text: string
  page?: string
}

export interface GameResult {
  winner: SideId | 'draw'
  reason: string
  values: Record<SideId, number>
}

export interface GameState {
  setup: GameSetup
  rng: DiceStream
  turn: number
  phase: Phase
  elements: Record<string, ElementState>
  units: Record<string, UnitState>
  sides: Record<SideId, SideState>
  /** Which side may act now: choose first, activate, or answer a window. */
  toAct: SideId | null
  /** Who chooses at the start of this turn (p. 18). */
  chooser: SideId | null
  activation: ActivationState | null
  /** Activations so far in the battle, for repair timing. */
  activationCount: number
  /** After a pass, the other side owes this many activations in succession (p. 18). */
  owed: number
  objectives: Record<string, { heldBy: SideId | null }>
  /** Prepared positions left on the table when a dug-in element moved off; either side may re-occupy them (p. 20). */
  prepared: Point[]
  journal: Action[]
  log: LogEntry[]
  result: GameResult | null
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type WeaponChoice =
  /** A direct-fire weapon by id (pp. 28–32). */
  | { kind: 'direct'; weaponId: string }
  /** A vehicle's APSW, or an infantry APSW team's (p. 35). */
  | { kind: 'apsw' }
  /** A rifle team's personal arms in a firefight (p. 33). */
  | { kind: 'rifles' }
  /** A rifle team's IAVR at a vehicle within 4" (p. 36). */
  | { kind: 'iavr' }

export interface ShotOrder {
  elementId: string
  weapon: WeaponChoice
  targetId: string
}

export type Action =
  | { kind: 'deploy'; side: SideId; elementId: string; position: Point; facing: number }
  | { kind: 'ready'; side: SideId }
  | { kind: 'choose-first'; side: SideId; first: SideId }
  | { kind: 'activate'; side: SideId; unitId: string }
  | {
      kind: 'move'
      side: SideId
      elementId: string
      /** Waypoints after the current position. */
      path: Point[]
      /** Final facing; the last leg's direction if omitted. */
      facing?: number
      evasive?: boolean
      travel?: boolean
    }
  | { kind: 'posture'; side: SideId; elementId: string; posture: Posture }
  /** A volley: every target named before a shot is resolved (p. 28). */
  | { kind: 'fire'; side: SideId; shots: ShotOrder[] }
  | { kind: 'repair'; side: SideId; elementId: string }
  | { kind: 'rally'; side: SideId; unitId: string }
  /** The activated unit joins another, unactivated one it has closed up with (p. 24). */
  | { kind: 'regroup'; side: SideId; intoUnitId: string }
  | { kind: 'end-activation'; side: SideId }
  | { kind: 'opportunity-fire'; side: SideId; unitId: string; shots: ShotOrder[] }
  | { kind: 'decline-opportunity'; side: SideId; forActivation?: boolean }
  | { kind: 'pass'; side: SideId }
  | { kind: 'done'; side: SideId }
  | { kind: 'declare-end'; side: SideId }

export interface Refusal {
  ok: false
  reason: string
  page: string
}

export const refuse = (reason: string, page: string): Refusal => ({ ok: false, reason, page })

export function otherSide(side: SideId): SideId {
  return side === 'north' ? 'south' : 'north'
}
