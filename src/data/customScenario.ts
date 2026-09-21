import type { Course, Point } from '../engine/types'
import type { GameSetup } from './savedGame'
import {
  scenarioById,
  INTRODUCTORY_VICTORY,
  type ForceEntry,
  type Scenario,
  type TableSize,
} from './scenarios'

/**
 * A scenario of the players' own (18).
 *
 * The shipped scenarios are written in code; this is the same data drawn up
 * in the New battle modal — a table, a turn limit, two sides with a points
 * budget each, rocks and clouds where the designer put them, and the victory
 * ladder — and carried in the setup, so a battle file replays on a machine
 * that never saw the design. `withForces` writes the picked fleets into it
 * as two lines facing each other, which is what the scenario's own force
 * would be if it had one, and what 18.1's deployments replace when the setup
 * asks for one.
 */

export const CUSTOM_PREFIX = 'custom-'

export function isCustomScenarioId(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX)
}

/** The scenario a setup names: its own, when it carries one, else the shipped one. */
export function scenarioFor(
  setup: Pick<GameSetup, 'scenarioId' | 'customScenario'>,
): Scenario | undefined {
  return setup.customScenario?.id === setup.scenarioId
    ? setup.customScenario
    : scenarioById(setup.scenarioId)
}

/** A blank scenario to draw on: a 6′ × 4′ table, eight turns, two fleets of a thousand points. */
export function newCustomScenario(stamp: number): Scenario {
  return {
    id: `${CUSTOM_PREFIX}${stamp.toString(36)}`,
    name: 'Custom battle',
    briefing: 'A battle of your own making. Write the situation here.',
    objective: 'Inflict more losses on your opponent than they inflict on you.',
    table: { width: 72, height: 48 },
    turnLimit: 8,
    budget: 1000,
    victory: { ...INTRODUCTORY_VICTORY },
    sides: [
      { id: 'a', name: 'First Fleet', force: [] },
      { id: 'b', name: 'Second Fleet', force: [] },
    ],
  }
}

/**
 * Where a side's ships stand when nothing else is said: a line a quarter of
 * the way in from the near long edge, spread across the middle half of the
 * table, bows toward the enemy. The first side has the top of the table and
 * heads down it (course 6); the second has the bottom and heads up (12).
 */
export function stationsFor(
  table: TableSize,
  sideIndex: number,
  count: number,
): Array<{ position: Point; facing: Course }> {
  const top = sideIndex === 0
  const y = top ? table.height * 0.15 : table.height * 0.85
  const from = table.width * 0.25
  const to = table.width * 0.75
  const step = count > 1 ? (to - from) / (count - 1) : 0
  return Array.from({ length: count }, (_, i) => ({
    position: { x: round1(count > 1 ? from + step * i : table.width / 2), y: round1(y) },
    facing: top ? 6 : 12,
  }))
}

/** The scenario with the picked fleets written in as its own forces. */
export function withForces(
  scenario: Scenario,
  forces: Partial<Record<string, readonly string[]>>,
): Scenario {
  return {
    ...scenario,
    sides: scenario.sides.map((side, index) => {
      const picks = forces[side.id] ?? side.force.map((entry) => entry.designId)
      const stations = stationsFor(scenario.table, index, picks.length)
      const force: ForceEntry[] = picks.map((designId, i) => ({
        designId,
        position: stations[i]!.position,
        facing: stations[i]!.facing,
        velocity: 6,
      }))
      return { ...side, force }
    }),
  }
}

/** The fleets a scenario's forces name, by side, as the picker holds them. */
export function picksOf(scenario: Scenario): Partial<Record<string, string[]>> {
  const picks: Partial<Record<string, string[]>> = {}
  for (const side of scenario.sides) picks[side.id] = side.force.map((entry) => entry.designId)
  return picks
}

/** Why a scenario cannot start yet, or null. */
export function scenarioProblem(scenario: Scenario): string | null {
  const empty = scenario.sides.filter((side) => side.force.length === 0)
  if (empty.length > 0) {
    return `${empty.map((side) => side.name).join(' and ')} ${empty.length === 1 ? 'has' : 'have'} no ships: pick a fleet below`
  }
  if (scenario.table.width < 24 || scenario.table.height < 24) return 'The table is too small to fight on'
  return null
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
