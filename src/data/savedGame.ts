/**
 * A battle is (setup + actions), nothing more.
 *
 * The engine is deterministic and the RNG is seeded, so replaying the same
 * actions over the same setup reconstructs the same game exactly. That single
 * fact is what powers save/resume, undo, replays, and two browsers exchanging
 * actions without a server. See docs/architecture.md.
 */

import { applyAction, setOptionalRules, type GameAction } from '../engine/actions'
import { pushLog, type GameState } from '../engine/game'
import type { ShipDesign } from '../engine/types'
import { checkFleetTechBase, type TechBaseChoice } from './techBaseCheck'
import type { BattleType } from '../engine/battles'
import { allDesigns, designById, setEmbeddedDesigns, SHIP_DESIGNS } from './ships'
import { SCENARIOS, scenarioById, setEmbeddedScenario, startScenario, type Scenario } from './scenarios'

/**
 * The engine's rules reading, stamped on a battle at creation.
 *
 * A battle file is a journal, and the journal records refused actions too — so
 * a fix that turns yesterday's refusal into today's success would rewrite every
 * old battle it replays. Files without a stamp replay under reading 1, exactly
 * as they were fought.
 */
export const CURRENT_RULES_VERSION = 1

export interface GameSetup {
  scenarioId: string
  seed: number
  /** Engine rules reading (see CURRENT_RULES_VERSION). Absent = 1. */
  rulesVersion?: number

  // ── Optional rules, each off unless the table agrees to it ──────────────
  /** 3.6 — emergency thrust, up to 150% of the drive rating at risk. */
  emergencyThrust?: boolean
  /** 4.10 — fire from inside a target's rear arc ignores its armour. */
  rearArcAttacks?: boolean
  /** 4.2 — a ship that spent no thrust this turn may fire through its aft arc. */
  aftArcFire?: boolean
  /** The Drive Damage variant in the box after 4.11: two drive rolls. */
  driveDamage?: boolean
  /** 10.3 — the Core Systems block: bridge, life support, power core. */
  coreSystems?: boolean
  /** 10.3 — a gutted reactor may take the ship and its neighbours with it. */
  reactorBreaches?: boolean
  /** 8.17, 8.18 — fighter morale, and ace/turkey pilot quality. */
  fighterMorale?: boolean
  fighterQuality?: boolean
  /** 6.6 — multi-stage missiles. */
  multiStageMissiles?: boolean
  /** 12.1, 12.2 — sensors and ECM, which also close the SSDs (2.6). */
  sensorRules?: boolean
  /** 17 — rock, dust and meteor fields do something when you fly into them. */
  terrainHazards?: boolean
  /** 18.3 — price and score the battle in Combat Points Value, not printed points. */
  cpv?: boolean
  /**
   * 12.12 — *"a completely OPTIONAL alternative movement system, which players
   * may use instead of the standard FT movement rules"*. Absent is cinematic.
   */
  movementSystem?: 'cinematic' | 'vector'
  /** 16.4 — the playing area slides under the ships instead of running out. */
  movingTable?: boolean
  /** 3.9 — a ship that left the table rolls for whether it can come back. */
  tableReentry?: boolean
  /** 12.11 — a threshold point may also knock the ship a point off course. */
  knockedOffCourse?: boolean
  /** 17.3 — a bad-tempered star burns FireCons out of every ship in reach. */
  solarFlares?: boolean
  /**
   * 17.7 — the table is an orbit radius above a planet, so a ship that runs
   * off the edge is going round the world and comes back on the far side.
   */
  orbitalTable?: boolean

  /**
   * Systems barred from play. The campaign rules ban the Reflex Shield, the
   * Cloaking Field and the Wave Gun; a tournament may ban others.
   */
  bannedSystems?: string[]

  /**
   * The campaign faction each side flies under (`docs/rules/factions.md`), by
   * side id. Absent means plain Continuum, which is what every battle fought
   * before this field was read plays as.
   */
  factions?: Partial<Record<string, string>>
  /** The Askvarian clan a side's ships belong to, where its faction has clans. */
  clans?: Partial<Record<string, string>>

  /**
   * The Imperial Tech Base each side plays under (15), by side id. A side with
   * no entry plays unrestricted, which is every battle fought before this
   * field existed and how Full Thrust plays when nobody is counting choices.
   */
  techBases?: Partial<Record<string, TechBaseChoice>>

  /**
   * A force chosen for a side, replacing the scenario's own (18.2). Stored as
   * design ids in deployment order; `startScenario` places them on the
   * scenario's own stations, so a picked fleet deploys where the scenario says
   * the fleet deploys.
   */
  forces?: Partial<Record<string, string[]>>

  /**
   * Which of 18.1's three battles this is, overriding the scenario's own.
   * `'none'` turns a scenario's deployment off; absent leaves it as written.
   */
  battleType?: BattleType | 'none'

  /** Sides the computer commands. */
  aiSides?: string[]

  /** Online matches: a phase closes only when every side says so. */
  readyGate?: boolean
  /**
   * Online matches: the optional rules are settled and the engine refuses to
   * change them mid-battle. Recorded here so a joiner's copy, a resumed save
   * and a replay all arrive already locked.
   */
  rulesLocked?: boolean

  /**
   * A designed scenario, embedded whole when `scenarioId` names one, so the
   * battle replays on a machine that has never seen the design.
   */
  customScenario?: Scenario
  /**
   * Every non-canon design the forces reference, embedded whole, for the same
   * reason.
   */
  customDesigns?: ShipDesign[]
}

export interface SavedGame {
  /** Bumped only when a change breaks replay of older saves. */
  version: 1
  setup: GameSetup
  actions: GameAction[]
}

/** Build the turn-one game a setup describes. */
export function buildGame(setup: GameSetup): GameState {
  setEmbeddedDesigns(setup.customDesigns ?? [])
  setEmbeddedScenario(setup.customScenario ?? null)
  const game = startScenario(setup.scenarioId, {
    seed: setup.seed,
    forceIds: setup.forces,
    battleType: setup.battleType,
  })
  // The optional rules are part of the setup, and the setup is what a battle
  // file carries — so stamping them onto the game here is what makes a replay
  // fight under the rules the battle was actually fought under.
  // 15: what each side could have built. Recorded in the log rather than
  // enforced, because the roster predates the tech base and refusing to start
  // a battle over it would be refusing to start most battles.
  for (const side of game.sides) {
    const choice = setup.techBases?.[side.id]
    if (!choice || choice === 'unrestricted') continue
    const report = checkFleetTechBase(
      choice,
      game.ships.filter((ship) => ship.side === side.id).map((ship) => ship.design),
    )
    pushLog(game, {
      kind: 'note',
      side: side.id,
      text: report.legal
        ? `${side.name} fields a fleet the ${report.baseName} tech base could build (15)`
        : `${side.name} plays the ${report.baseName} tech base, which could not have built ` +
          `${report.designs.length} of its ships (15)`,
    })
  }

  setOptionalRules(game, {
    driveDamage: setup.driveDamage,
    rearArcAttacks: setup.rearArcAttacks,
    aftArcFire: setup.aftArcFire,
    coreSystems: setup.coreSystems,
    reactorBreaches: setup.reactorBreaches,
    emergencyThrust: setup.emergencyThrust,
    sensorRules: setup.sensorRules,
    terrainHazards: setup.terrainHazards,
    cpv: setup.cpv,
    movementSystem: setup.movementSystem,
    movingTable: setup.movingTable,
    tableReentry: setup.tableReentry,
    knockedOffCourse: setup.knockedOffCourse,
    solarFlares: setup.solarFlares,
    orbitalTable: setup.orbitalTable,
  })
  return game
}

/**
 * Reconstruct a battle from its record. Action outcomes are discarded — every
 * handler re-derives its context from game state, so the mutations land exactly
 * as they did the first time.
 */
export function replayGame(saved: SavedGame): GameState {
  const game = buildGame(saved.setup)
  for (const action of saved.actions) applyAction(game, action)
  return game
}

/**
 * Replay only the first `count` actions. Undo is this: drop the last action and
 * rebuild, which is why a rewound volley re-rolls to the same faces.
 */
export function replayPartial(saved: SavedGame, count: number): GameState {
  const game = buildGame(saved.setup)
  for (const action of saved.actions.slice(0, count)) applyAction(game, action)
  return game
}

/**
 * Fill in everything a save must carry to replay elsewhere: every non-canon
 * design the forces reference, and the designed scenario itself when the setup
 * names one.
 */
export function withEmbedded(setup: GameSetup): GameSetup {
  const scenario =
    setup.customScenario?.id === setup.scenarioId ? setup.customScenario : scenarioById(setup.scenarioId)

  const ids = new Set<string>()
  for (const side of scenario?.sides ?? []) for (const entry of side.force) ids.add(entry.designId)
  for (const list of Object.values(setup.forces ?? {})) for (const id of list ?? []) ids.add(id)

  const custom: ShipDesign[] = []
  for (const id of ids) {
    if (SHIP_DESIGNS.some((d) => d.id === id)) continue
    // A design already riding in the setup may exist nowhere else on this
    // machine — an imported battle is exactly that — so it wins the lookup.
    const design = setup.customDesigns?.find((d) => d.id === id) ?? designById(id)
    if (design) custom.push(structuredClone(design))
  }

  const builtIn = SCENARIOS.some((s) => s.id === setup.scenarioId)
  return {
    ...setup,
    customDesigns: custom.length > 0 ? custom : undefined,
    customScenario: !builtIn && scenario ? structuredClone(scenario) : undefined,
  }
}

/** Parse a battle file, or say what is wrong with it. */
export function parseSavedGame(text: string): SavedGame | string {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return 'Not a Full Thrust battle file (invalid JSON).'
  }
  if (typeof raw !== 'object' || raw === null) return 'Not a Full Thrust battle file.'

  const candidate = raw as Partial<SavedGame>
  if (candidate.version !== 1) {
    return `Battle file version ${String(candidate.version)} is not supported.`
  }
  if (!candidate.setup || typeof candidate.setup.scenarioId !== 'string') {
    return 'Battle file has no scenario.'
  }
  if (!Number.isFinite(candidate.setup.seed)) return 'Battle file has no dice seed.'
  if (!Array.isArray(candidate.actions)) return 'Battle file has no action journal.'

  // Replaying is the real validation: a file that cannot be replayed is not a
  // battle, whatever its shape. Doing it here means a bad file is refused at
  // the door rather than half-loaded over a game in progress.
  const saved = candidate as SavedGame
  try {
    replayGame(saved)
  } catch (error) {
    return `Battle file will not replay: ${error instanceof Error ? error.message : String(error)}`
  }
  return saved
}

/** Every design available to a force picker, canon and embedded alike. */
export function availableDesigns(): ShipDesign[] {
  return allDesigns()
}
