import { describe, expect, it } from 'vitest'

import { optional } from '../engine/actions'
import { buildGame, type GameSetup } from './savedGame'
import { OPTIONAL_RULES } from '../ui/SetupPanel'

/**
 * Every switch on the setup screen reaches the engine.
 *
 * Three of them did not. `fighterMorale`, `fighterQuality` and
 * `multiStageMissiles` were declared on `GameSetup`, drawn as checkboxes and
 * never passed to `setOptionalRules` — a player could turn 8.17 on, fight a
 * battle believing their pilots might break, and the engine would never have
 * heard of it. They are marked `notYet` in the panel now, and this test is why
 * the next one cannot go the same way quietly.
 */
describe('the setup screen', () => {
  const live = OPTIONAL_RULES.filter((option) => option.notYet === undefined)

  it('has switches to check', () => {
    expect(live.length).toBeGreaterThan(8)
  })

  it('passes every live switch through to the engine', () => {
    const missed: string[] = []
    for (const option of live) {
      const setup = { scenarioId: 'line-of-battle', seed: 1, [option.key]: true } as GameSetup
      const rules = optional(buildGame(setup)) as Record<string, unknown>
      if (rules[option.key] !== true) missed.push(`${option.label} (${option.rule})`)
    }
    expect(missed, 'a switch the player can set that the engine never sees').toEqual([])
  })

  it('says why, for every switch it disables', () => {
    for (const option of OPTIONAL_RULES) {
      if (option.notYet === undefined) continue
      expect(option.notYet.length, option.label).toBeGreaterThan(10)
    }
  })
})
