import { describe, expect, it } from 'vitest'

import { buildGame, withEmbedded } from './savedGame'
import {
  isCustomScenarioId,
  newCustomScenario,
  picksOf,
  scenarioFor,
  scenarioProblem,
  stationsFor,
  withForces,
} from './customScenario'
import { CURRENT_RULES_VERSION } from './savedGame'

/**
 * A scenario of the players' own (18): drawn up on the form, carried in the
 * setup, and started like any shipped one.
 */
describe('a custom scenario', () => {
  it('starts blank, with two empty sides and a budget', () => {
    const scenario = newCustomScenario(1)
    expect(isCustomScenarioId(scenario.id)).toBe(true)
    expect(scenario.sides.map((s) => s.force.length)).toEqual([0, 0])
    expect(scenario.budget).toBe(1000)
    expect(scenarioProblem(scenario)).toMatch(/no ships/)
  })

  it('lines the picked fleets up facing each other across the table', () => {
    const scenario = withForces(newCustomScenario(2), {
      a: ['esu-heavy-cruiser', 'esu-destroyer', 'esu-destroyer'],
      b: ['nac-heavy-cruiser'],
    })
    expect(scenarioProblem(scenario)).toBeNull()
    const [a, b] = scenario.sides
    expect(a?.force.map((e) => e.designId)).toEqual(['esu-heavy-cruiser', 'esu-destroyer', 'esu-destroyer'])
    // The first side has the top of the table and heads down it; the second
    // the bottom, heading up. Both spread across the middle half.
    expect(a?.force.every((e) => e.facing === 6 && e.position.y < 24)).toBe(true)
    expect(b?.force.every((e) => e.facing === 12 && e.position.y > 24)).toBe(true)
    expect(a?.force.map((e) => e.position.x)).toEqual([18, 36, 54])
    expect(b?.force[0]?.position).toEqual({ x: 36, y: 40.8 })
    expect(picksOf(scenario)).toEqual({ a: ['esu-heavy-cruiser', 'esu-destroyer', 'esu-destroyer'], b: ['nac-heavy-cruiser'] })
    expect(stationsFor({ width: 100, height: 60 }, 0, 1)[0]).toEqual({ position: { x: 50, y: 9 }, facing: 6 })
  })

  it('is the scenario its setup names, and starts with its fleets and its terrain', () => {
    const scenario = withForces(
      {
        ...newCustomScenario(3),
        name: 'Rocks',
        terrain: [{ id: 't1', kind: 'planetoid', position: { x: 36, y: 24 }, radius: 5, label: 'The Rock' }],
      },
      { a: ['esu-frigate', 'esu-frigate'], b: ['nac-frigate', 'nac-frigate'] },
    )
    const setup = {
      scenarioId: scenario.id,
      seed: 7,
      rulesVersion: CURRENT_RULES_VERSION,
      customScenario: scenario,
      forces: picksOf(scenario),
    }
    expect(scenarioFor(setup)).toBe(scenario)
    expect(scenarioFor({ scenarioId: 'border-skirmish', customScenario: scenario })?.id).toBe('border-skirmish')
    // Embedding keeps a scenario that is not on the shipped list, and only that.
    expect(withEmbedded(setup).customScenario?.name).toBe('Rocks')
    expect(withEmbedded({ ...setup, scenarioId: 'border-skirmish' }).customScenario).toBeUndefined()

    const game = buildGame(setup)
    expect(game.scenario).toBe(scenario.id)
    expect(game.ships.map((ship) => `${ship.side}:${ship.design.id}`).sort()).toEqual([
      'a:esu-frigate',
      'a:esu-frigate',
      'b:nac-frigate',
      'b:nac-frigate',
    ])
    expect(game.terrain.map((f) => f.label)).toEqual(['The Rock'])
    expect(game.table).toEqual({ width: 72, height: 48 })
  })
})
