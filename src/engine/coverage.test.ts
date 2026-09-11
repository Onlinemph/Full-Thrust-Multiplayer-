import { describe, expect, it } from 'vitest'

import { WEAPON_SPECS } from './weapons'
import { SHIP_DESIGNS } from '../data/ships'

/**
 * Weapon coverage.
 *
 * Two different questions, and only the second one is a bug. It is fine for the
 * engine not to have every weapon in the book yet — the registry refuses an
 * unknown gun loudly rather than treating it as a beam. It is NOT fine for a
 * ship in the roster to carry a gun the engine cannot fire, because that ship
 * goes into battle with dead weight nobody told the player about.
 */
describe('weapons', () => {
  it('reports what is implemented', () => {
    const implemented = Object.keys(WEAPON_SPECS).sort()
    // eslint-disable-next-line no-console
    console.log(`${implemented.length} weapon classes resolvable: ${implemented.join(', ')}`)
    expect(implemented.length).toBeGreaterThan(0)
  })

  it('never puts a gun on a ship that the engine cannot fire', () => {
    const unresolvable = new Set<string>()
    for (const design of SHIP_DESIGNS) {
      for (const weapon of design.weapons) {
        if (!WEAPON_SPECS[weapon.weaponClass]) {
          unresolvable.add(`${design.id}: ${weapon.label} (${weapon.weaponClass})`)
        }
      }
    }
    expect(
      [...unresolvable],
      'A ship is carrying a weapon with no resolver registered in ' +
        'src/engine/weapons/index.ts — either register its family or take the ' +
        'gun off the design. A hull that goes into battle with dead weight ' +
        'nobody mentioned is worse than one that never had the gun.',
    ).toEqual([])
  })
})
