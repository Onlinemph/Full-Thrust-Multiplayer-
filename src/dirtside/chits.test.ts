/**
 * The damage-chit pot (p. 5) and the reading of a draw (p. 30, p. 33),
 * checked against the book's own worked examples.
 */

import { describe, expect, it } from 'vitest'
import {
  type Chit,
  INFANTRY_KILL_TOTAL,
  POT,
  POT_LINES,
  POT_SIZE,
  chitLabel,
  chitPoints,
  closeAssaultValidity,
  drawChits,
  firefightValidity,
  resolveInfantryHit,
  resolveVehicleHit,
} from './chits'
import { newStream } from './dice'

const n = (colour: 'red' | 'yellow' | 'green', value: 0 | 1 | 2 | 3): Chit => ({ kind: 'number', colour, value })
const M: Chit = { kind: 'mobility' }
const T: Chit = { kind: 'systems-target' }
const F: Chit = { kind: 'systems-firer' }
const BOOM: Chit = { kind: 'boom' }

describe('the pot (p. 5)', () => {
  it('holds 119 chits: 50 red, 25 yellow, 25 green and 19 specials', () => {
    expect(POT_SIZE).toBe(119)
    const count = (test: (c: Chit) => boolean) => POT.filter(test).length
    expect(count((c) => c.kind === 'number' && c.colour === 'red')).toBe(50)
    expect(count((c) => c.kind === 'number' && c.colour === 'yellow')).toBe(25)
    expect(count((c) => c.kind === 'number' && c.colour === 'green')).toBe(25)
    expect(count((c) => c.kind === 'boom')).toBe(5)
    expect(count((c) => c.kind === 'mobility')).toBe(7)
    expect(count((c) => c.kind === 'systems-target')).toBe(5)
    expect(count((c) => c.kind === 'systems-firer')).toBe(2)
    expect(POT_LINES.reduce((s, l) => s + l.count, 0)).toBe(119)
  })

  it('draws without replacement and the same chits for the same seed', () => {
    const a = drawChits(5, newStream(7))
    const b = drawChits(5, newStream(7))
    expect(a).toEqual(b)
    expect(drawChits(200, newStream(1))).toHaveLength(119)
    // Two F chits in the pot: a draw of the whole pot has exactly two.
    expect(drawChits(119, newStream(3)).filter((c) => c.kind === 'systems-firer')).toHaveLength(2)
  })

  it('prints chits as the counters read', () => {
    expect(chitLabel(n('red', 2))).toBe('RED 2')
    expect([BOOM, M, T, F].map(chitLabel)).toEqual(['BOOM', 'M', 'T', 'F'])
  })
})

describe('validity (p. 29)', () => {
  it('counts only the valid colours, doubled or halved for a DFFG', () => {
    expect(chitPoints(n('red', 3), 'RED')).toBe(3)
    expect(chitPoints(n('green', 3), 'RED')).toBe(0)
    expect(chitPoints(n('yellow', 2), 'R/Y')).toBe(2)
    expect(chitPoints(n('green', 2), 'ALL×2')).toBe(4)
    expect(chitPoints(n('red', 3), 'ALL÷2')).toBe(1.5)
    expect(chitPoints(BOOM, 'ALL')).toBe(0)
  })
})

describe('a hit on a vehicle (p. 30)', () => {
  it('HKP/3 at medium range on armour 4: RED 3, GREEN 1, YELLOW 2 is 5 valid and a knock-out', () => {
    const hit = resolveVehicleHit([n('red', 3), n('green', 1), n('yellow', 2)], 'R/Y', 4)
    expect(hit.points).toBe(5)
    expect(hit.knockedOut).toBe(true)
    expect(hit.category).toBe('Kill')
  })

  it('YELLOW 3, RED 1, M on armour 4: damaged by the equal total and immobilised by the M', () => {
    const hit = resolveVehicleHit([n('yellow', 3), n('red', 1), M], 'R/Y', 4)
    expect(hit.points).toBe(4)
    expect(hit.damaged).toBe(true)
    expect(hit.immobilised).toBe(true)
    expect(hit.knockedOut).toBe(false)
    expect(hit.category).toBe('Dam&MOB')
  })

  it('a class 1 weapon drawing BOOM on armour 5 is a very lucky kill', () => {
    const hit = resolveVehicleHit([BOOM], 'RED', 5)
    expect(hit.boom).toBe(true)
    expect(hit.knockedOut).toBe(true)
    expect(hit.category).toBe('Kill')
  })

  it('an F chit voids the shot, BOOM or no BOOM, and puts the firer systems down', () => {
    const hit = resolveVehicleHit([BOOM, F, n('red', 3)], 'ALL', 1)
    expect(hit.firerSystemsDown).toBe(true)
    expect(hit.knockedOut).toBe(false)
    expect(hit.category).toBe('SD:F')
  })

  it('a knocked-out vehicle records no further special damage', () => {
    const hit = resolveVehicleHit([n('red', 3), M, T], 'RED', 2)
    expect(hit.knockedOut).toBe(true)
    expect(hit.immobilised).toBe(false)
    expect(hit.systemsDown).toBe(false)
  })

  it('specials apply whatever the total, and a total below the armour alone is no effect', () => {
    expect(resolveVehicleHit([n('red', 1), T], 'RED', 3).category).toBe('SD:T')
    expect(resolveVehicleHit([n('red', 1), T, M], 'RED', 3).category).toBe('SD:T&MOB')
    expect(resolveVehicleHit([n('red', 3), T, M], 'RED', 3).category).toBe('Dam&SD:T&MOB')
    expect(resolveVehicleHit([n('red', 1)], 'RED', 3).category).toBe('Miss')
  })

  it('a DFFG at long range keeps its halves: RED 3 is 1.5, which beats armour 1', () => {
    const hit = resolveVehicleHit([n('red', 3)], 'ALL÷2', 1)
    expect(hit.points).toBe(1.5)
    expect(hit.knockedOut).toBe(true)
    expect(resolveVehicleHit([n('red', 2)], 'ALL÷2', 1).damaged).toBe(true)
  })

  it('reads 0 against armour 0 as damaged, as DS.XLS does: a soft skin with no valid colour drawn', () => {
    expect(resolveVehicleHit([n('red', 2)], 'GREEN', 0).category).toBe('Dam')
    expect(resolveVehicleHit([n('green', 0)], 'GREEN', 0).category).toBe('Dam')
    expect(resolveVehicleHit([n('green', 1)], 'GREEN', 0).category).toBe('Kill')
  })
})

describe('a hit on infantry (p. 33)', () => {
  it('needs 3, 4 or 5 valid points by troop type, and ignores the specials', () => {
    expect(INFANTRY_KILL_TOTAL).toEqual({ militia: 3, line: 4, powered: 5 })
    // Team A1 on the powered B1: RED 2 and GREEN 1 in the open is 2 valid, not enough.
    expect(resolveInfantryHit([n('red', 2), n('green', 1)], 'R/Y', 5).killed).toBe(false)
    // A4's APSW: YELLOW 2, YELLOW 3, RED 1 is 6, ample.
    const apsw = resolveInfantryHit([n('yellow', 2), n('yellow', 3), n('red', 1)], 'R/Y', 5)
    expect(apsw.points).toBe(6)
    expect(apsw.killed).toBe(true)
    // Exactly the total kills; a BOOM is nothing to infantry.
    expect(resolveInfantryHit([n('red', 3)], 'R/Y', 3).killed).toBe(true)
    expect(resolveInfantryHit([BOOM, M], 'R/Y', 3).killed).toBe(false)
  })

  it('validity by cover: red and yellow in the open, red in soft cover, yellow dug in or urban', () => {
    expect(firefightValidity('open')).toBe('R/Y')
    expect(firefightValidity('soft-cover')).toBe('RED')
    expect(firefightValidity('dug-in')).toBe('YELLOW')
    expect(firefightValidity('urban')).toBe('YELLOW')
    expect(closeAssaultValidity('open')).toBe('ALL')
    expect(closeAssaultValidity('soft-cover')).toBe('R/Y')
    expect(closeAssaultValidity('dug-in')).toBe('RED')
  })
})
