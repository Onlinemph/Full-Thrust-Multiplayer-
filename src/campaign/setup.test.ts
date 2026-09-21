import { describe, expect, it } from 'vitest'
import { hexDistance, hexKey } from './map'
import { layoutStars, parseSavedCampaign, pickerScenario, startingShipsFrom } from './setup'

describe('layoutStars', () => {
  it('spreads the homes round the map and scatters stars that never touch', () => {
    for (const players of [2, 3, 4]) {
      const { starHexes, homes } = layoutStars(7, 8, 24, players)
      expect(homes).toHaveLength(players)
      expect(new Set(starHexes.map(hexKey)).size).toBe(starHexes.length)
      for (const home of homes) expect(starHexes.map(hexKey)).toContain(hexKey(home))
      for (const hex of starHexes) expect(hexDistance({ q: 0, r: 0 }, hex)).toBeLessThanOrEqual(8)
      for (let i = 0; i < homes.length; i += 1) {
        for (let j = i + 1; j < homes.length; j += 1) expect(hexDistance(homes[i]!, homes[j]!)).toBeGreaterThanOrEqual(5)
      }
      for (let i = 0; i < starHexes.length; i += 1) {
        for (let j = i + 1; j < starHexes.length; j += 1) expect(hexDistance(starHexes[i]!, starHexes[j]!)).toBeGreaterThanOrEqual(2)
      }
      expect(starHexes.length).toBe(24)
    }
  })

  it('is the same map for the same seed and a different one for another', () => {
    expect(layoutStars(11, 6, 12, 2)).toEqual(layoutStars(11, 6, 12, 2))
    expect(layoutStars(11, 6, 12, 2).starHexes).not.toEqual(layoutStars(12, 6, 12, 2).starHexes)
  })

  it('gives as many stars as fit when asked for more than the map holds', () => {
    const { starHexes } = layoutStars(3, 2, 50, 2)
    expect(starHexes.length).toBeLessThan(50)
    expect(starHexes.length).toBeGreaterThanOrEqual(2)
  })
})

describe('the setup helpers', () => {
  it('shows the picker one side a player with the 2,000 RP budget', () => {
    const scenario = pickerScenario([{ id: 'p1', name: 'Terra' }, { id: 'p2', name: 'Eurasia' }])
    expect(scenario.budget).toBe(2000)
    expect(scenario.sides.map((s) => s.id)).toEqual(['p1', 'p2'])
  })

  it('names picked hulls by class and number', () => {
    expect(startingShipsFrom(['esu-frigate', 'esu-frigate', 'esu-corvette']).map((s) => s.name)).toEqual([
      'Storozhevoy 1',
      'Storozhevoy 2',
      expect.stringMatching(/ 1$/),
    ])
  })

  it('reads a campaign file and refuses what is not one', () => {
    expect(parseSavedCampaign('nope')).toMatch(/invalid JSON/)
    expect(parseSavedCampaign('{"version":2}')).toMatch(/version 2/)
    expect(parseSavedCampaign('{"version":1,"setup":{}}')).toMatch(/no usable setup/)
    const file = { version: 1, setup: { seed: 1, radius: 4, starHexes: [], players: [{ id: 'a' }], bannedSystems: [] }, moves: [] }
    expect(parseSavedCampaign(JSON.stringify(file))).toMatchObject({ version: 1 })
  })
})
