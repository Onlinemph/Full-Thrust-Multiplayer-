import { describe, expect, it } from 'vitest'

import { buildGame, type GameSetup } from './savedGame'
import { describeFault, validateDesign } from './designPricing'
import { designById } from './ships'
import type { ShipDesign } from '../engine/types'

/**
 * Systems the table has barred.
 *
 * `GameSetup.bannedSystems` was a panel of checkboxes in the setup screen that
 * wrote a list nothing read: not the fleet picker, not the shipyard, not the
 * battle. `validateDesign` had taken the option since it was written and
 * nobody had ever passed it one.
 */

const carrier = designById('esu-carrier') as ShipDesign

function notesFor(setup: GameSetup, sideId: string): string {
  return buildGame(setup)
    .log.filter((entry) => entry.kind === 'note' && entry.side === sideId)
    .map((entry) => entry.text)
    .join(' | ')
}

describe('the ban list', () => {
  it('bars a hull that carries a barred system', () => {
    const faults = validateDesign(carrier, { bannedSystems: ['hangar-bay'] })
    const banned = faults.filter((fault) => fault.kind === 'banned')
    expect(banned.length).toBeGreaterThan(0)
    expect(describeFault(banned[0]!)).toContain('barred')
  })

  it('leaves a hull that carries none of them alone', () => {
    expect(
      validateDesign(carrier, { bannedSystems: ['reflex-field'] }).filter(
        (fault) => fault.kind === 'banned',
      ),
    ).toEqual([])
  })

  it('names the hulls at the start of a battle', () => {
    const note = notesFor(
      { scenarioId: 'line-of-battle', seed: 3, bannedSystems: ['hangar-bay'] },
      'a',
    )
    expect(note).toContain('barred')
    expect(note).toContain('Carrier')
  })

  it('says nothing when the list is empty', () => {
    expect(notesFor({ scenarioId: 'line-of-battle', seed: 3 }, 'a')).not.toContain('barred')
  })
})
