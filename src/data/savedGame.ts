/**
 * A battle is (setup + actions), nothing more.
 *
 * The engine is deterministic and the RNG is seeded, so replaying the same
 * actions over the same setup reconstructs the same game exactly. That single
 * fact is what powers save/resume, undo, replays, and two browsers exchanging
 * actions without a server. See docs/architecture.md.
 */

import {
  applyAction,
  setOptionalRules,
  setRulesReading,
  type GameAction,
} from '../engine/actions'
import {
  tugTowCheck,
  tugTransferMass,
  tugDriveMass,
  validateFleetFtl,
  type FleetFtlEntry,
} from '../engine/ftl'
import { pushLog, type GameState } from '../engine/game'
import type { ShipDesign } from '../engine/types'
import { validateDesign } from './designPricing'
import { checkFleetTechBase, type TechBaseChoice } from './techBaseCheck'
import type { TechBase } from '../engine/techbase'
import type { BattleType } from '../engine/battles'
import { designById, setEmbeddedDesigns, SHIP_DESIGNS } from './ships'
import { SCENARIOS, scenarioById, setEmbeddedScenario, startScenario, type Scenario } from './scenarios'

/**
 * The engine's rules reading, stamped on a battle at creation.
 *
 * A battle file is a journal, and the journal records refused actions too — so
 * a fix that turns yesterday's refusal into today's success would rewrite every
 * old battle it replays. Files without a stamp replay under reading 1, exactly
 * as they were fought.
 *
 * The ladder so far:
 *
 *   2  5.23 — the Point Singularity Projector reads the target's mass.
 *   3  6.4  — a salvo rolls its lock-on when it arrives.
 *   4  6.4  — an antimatter warhead is answered on the heavy-missile table.
 *   5  2.6  — a ship's fire is one activation, not one shot per mount.
 *   6  5.23 — a Spinal Mount is laid on a point and has its own action.
 *   7  7.23 — the Nova Cannon is armed and fired by its own actions, and no
 *             longer resolves as an ordinary shot at a named ship.
 *   8  7.10 — phase 9 reads which hull a marker is actually coming for, so a
 *             ship covering its neighbour needs an ADFC to do it.
 *   9  7.4, 7.8, 7.9 — three rules that were wired without a gate and should
 *             have had one: the passive targeting cap refuses a shot an older
 *             journal already rolled for, and regeneration and the
 *             unrepaired-charge roll each throw dice at the turn boundary in
 *             a path every battle walks.
 *  10  7.12 — the dual-purpose mounts join phase 9. "Beam-1 systems, K-1 guns
 *             and other small weapons are dual purpose", and the mount list
 *             asked for a Beam-1 and nothing else, so a Gatling, a Twin
 *             Particle Array, a Meson Projector, a Phaser, an EMP-1, a Pulser
 *             and a K-1 all sat out the phase.
 *  11  7.4, 7.16, 7.18 – 7.22 — screens and electronic warfare reach the
 *             table. An area screen's umbrella now covers its neighbours,
 *             stealth and ECM shorten missile and fighter lock-on as well as
 *             sensor range, an Area ECM emitter's own FireCons go quiet while
 *             it jams, and a cloak crossed off the SSD stops being a cloak.
 *             Every one of them deletes or adds dice: a marker that no longer
 *             acquires never rolls in phase 10, and a shot refused for range
 *             takes its whole volley out of the stream.
 *  12  5.14, 5.19 — the three settings a gun crew writes in phase 1 reach the
 *             resolvers that have always read them: the Pulse Torpedo
 *             overload (a different table line, a confirmation die, and a
 *             tube that can blow itself off the SSD), the Variable Strength
 *             tube's line, and the Fusion Array's mode.
 *  13  5.9, 9.1 — a transporter with nobody left to send is refused, phase 9
 *             puts point defence on a gunboat squadron, and 9.1's own
 *             anti-ship table takes one boat a hit.
 *  14  10.3 — the Core Systems block is on every hull, as the book says it
 *             is: "assumed to be part of the essential structure of all
 *             ships". Three more dice at every threshold point on a table
 *             that plays with them, which only a design that named its own
 *             block ever rolled before.
 *  15  2.6  — the sequence refuses to move on past a phase whose work is not
 *             done: unwritten orders, unmoved ships, unrolled threshold
 *             checks, unresolved point defence, ordnance, boarding, repairs
 *             and breached cores. A refusal changes what the next action sees,
 *             so an older journal that skipped a phase keeps skipping it.
 *  16  2.6  — phase 11 is fired in turns, the side with initiative first and
 *             one ship's whole declared fire at a time; initiative is rolled
 *             once; a phase with nothing in it is passed over; and under the
 *             ready gate a phase ends when every console has said it may.
 *             Each of these refuses or advances where an older journal did
 *             not, so each moves the dice for everything after it.
 */
export const CURRENT_RULES_VERSION = 16

export interface GameSetup {
  scenarioId: string
  seed: number
  /** Engine rules reading (see CURRENT_RULES_VERSION). Absent = 1. */
  rulesVersion?: number
  /**
   * How much bigger than the scenario wrote it the table is played at, with
   * every written position scaled to match. 1 is the scenario's own table;
   * absent, which is every battle saved before this existed, reads as 1. A
   * new battle opens at 1.5 — a 6' × 4' board is a knife fight at Full
   * Thrust's ranges, and the extra sea room is what makes manoeuvre matter.
   */
  tableScale?: number

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
  /** 6.8 — a Plasma Bolt Launcher may fire a shaped charge at a named ship. */
  shapedCharges?: boolean
  /** 12.11 — a threshold point may also knock the ship a point off course. */
  knockedOffCourse?: boolean
  /** 17.3 — a bad-tempered star burns FireCons out of every ship in reach. */
  solarFlares?: boolean
  /**
   * 17.7 — the table is an orbit radius above a planet, so a ship that runs
   * off the edge is going round the world and comes back on the far side.
   */
  orbitalTable?: boolean
  /** 12.9 — a beaten captain may strike the colors and surrender the ship. */
  strikeColors?: boolean
  /** 12.10 — both fleets built by the same navy: +1 on direct fire. */
  civilWar?: boolean

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
   * The base a side that picked `custom` actually built (15.1, 15.8), by side
   * id. Plain data — a name, a list of entry ids and a limit — so it saves and
   * loads with everything else, and a side whose choice is not `custom`
   * ignores whatever is here.
   */
  customTechBases?: Partial<Record<string, TechBase>>

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

  /**
   * 11.8: *"Non-FTL ships – other than battleriders with a Mothership – cannot
   * be part of fleets for one-off battles unless specifically permitted by
   * player agreement or scenario design."* This is that permission.
   *
   * Recorded rather than enforced either way: with it off the engine says
   * which hulls 11.8 would exclude, and starts the battle anyway.
   */
  allowNonFtl?: boolean

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

/**
 * One side's part of a match lobby: the force its console picked, whether
 * that console has said it is ready, and any design the pick names that is
 * not in the shipped roster — carried whole, so the host can embed it in the
 * battle the way `withEmbedded` embeds a home-built hull in a save.
 */
export interface LobbyPick {
  /** Design ids in deployment order; null is the scenario's own force. */
  forceIds: string[] | null
  ready: boolean
  designs?: ShipDesign[]
}

/**
 * A match before its battle: the host has the setup in hand and each console
 * picks its own side's fleet. While this is on the record, `setup` is the
 * host's draft and `actions` is empty; the host starting the battle takes it
 * off and the record becomes a battle like any other.
 */
export interface Lobby {
  picks: Partial<Record<string, LobbyPick>>
}

export interface SavedGame {
  /** Bumped only when a change breaks replay of older saves. */
  version: 1
  setup: GameSetup
  actions: GameAction[]
  /** Present while the match is still in its lobby (online). */
  lobby?: Lobby
}

/** Build the turn-one game a setup describes. */
export function buildGame(setup: GameSetup): GameState {
  setEmbeddedDesigns(setup.customDesigns ?? [])
  setEmbeddedScenario(setup.customScenario ?? null)
  const game = startScenario(setup.scenarioId, {
    seed: setup.seed,
    forceIds: setup.forces,
    battleType: setup.battleType,
    fighterQuality: setup.fighterQuality,
    tableScale: setup.tableScale,
    rulesVersion: setup.rulesVersion,
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
      setup.customTechBases?.[side.id],
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

  // The systems this table barred. Reported rather than refused, like the tech
  // base and 11.8 above, because a scenario writes its own forces and a table
  // that bars a system after the scenario was written should not be unable to
  // play it — but it should be told.
  if ((setup.bannedSystems?.length ?? 0) > 0) {
    for (const side of game.sides) {
      const carrying = game.ships.filter(
        (ship) =>
          ship.side === side.id &&
          validateDesign(ship.design, { bannedSystems: setup.bannedSystems }).some(
            (fault) => fault.kind === 'banned',
          ),
      )
      if (carrying.length === 0) continue
      pushLog(game, {
        kind: 'note',
        side: side.id,
        text:
          `${side.name} fields ${carrying.length} ` +
          `${carrying.length === 1 ? 'hull' : 'hulls'} carrying a system this table barred: ` +
          carrying.map((ship) => ship.name).join(', '),
      })
    }
  }

  // 11.8, reported the same way and for the same reason: a scenario that puts
  // a picket screen on the table is not a fleet list, and refusing to start
  // over it would refuse most scenarios. Stations are furniture — 11.8 is
  // about what a fleet brings to a one-off battle, and nobody hauls a starbase
  // there.
  for (const side of game.sides) {
    const hulls = game.ships.filter(
      (ship) => ship.side === side.id && ship.design.group !== 'station',
    )
    const fleet: FleetFtlEntry[] = hulls.map((ship) => ({
      id: ship.name,
      ftl: ship.design.ftl,
      battlerider: ship.design.battlerider === true,
      mothershipId:
        hulls.find((other) => other.design.id === ship.design.mothershipId)?.name ?? null,
    }))
    const problems = validateFleetFtl(fleet, { allowNonFtl: setup.allowNonFtl })

    // 11.6: if the fleet is bringing non-FTL hulls it needs tugs enough for
    // them, and the surprise is that capacity adds up across tugs only where
    // the tugs are Advanced — "two tugs with Advanced FTL Drives of transfer
    // mass 60 each" can move a 120-mass battleship where two standard ones
    // cannot. Battleriders are out of it: 11.7 gives them their own carriage,
    // and so is a fleet the scenario has already excused from 11.8 — a table
    // that agreed the monitors are here did not also agree to tow them.
    const load = hulls.filter(
      (ship) => ship.design.ftl === 'none' && ship.design.battlerider !== true,
    )
    if (load.length > 0 && setup.allowNonFtl !== true) {
      const tow = tugTowCheck(
        hulls
          .filter((ship) => ship.design.ftl === 'tug')
          .map((ship) => ({
            id: ship.name,
            transferMass: tugTransferMass(
              ship.design.mass,
              tugDriveMass(ship.design.mass, ship.design.ftlTransferMass ?? 0),
            ),
            advanced: false,
          })),
        load.map((ship) => ({ id: ship.name, mass: ship.design.mass })),
      )
      problems.push(...tow.problems)
    }

    if (problems.length === 0) continue
    pushLog(game, {
      kind: 'note',
      side: side.id,
      text:
        `${side.name}: ${problems.length} ` +
        `${problems.length === 1 ? 'problem' : 'problems'} getting this fleet to the battle ` +
        `(11.6, 11.8) — ${problems.join('; ')}`,
    })
  }

  // The reading this battle is fought under, so a fix that changes the dice
  // does not rewrite a fight that was already had.
  setRulesReading(game, setup.rulesVersion)

  setOptionalRules(game, {
    readyGate: setup.readyGate,
    // The computer has no console to press Ready on.
    readyExempt: setup.aiSides,
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
    shapedCharges: setup.shapedCharges,
    knockedOffCourse: setup.knockedOffCourse,
    solarFlares: setup.solarFlares,
    orbitalTable: setup.orbitalTable,
    strikeColors: setup.strikeColors,
    civilWar: setup.civilWar,
    fighterMorale: setup.fighterMorale,
    fighterQuality: setup.fighterQuality,
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

