import { describe, expect, it } from 'vitest'
import { missileCluster } from './ordnance'

describe('missileCluster', () => {
  it('returns exactly one seat per missile, up to six', () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(missileCluster(n)).toHaveLength(n)
    }
  })

  it('never returns fewer than one seat, and never more than six', () => {
    expect(missileCluster(0)).toHaveLength(1)
    expect(missileCluster(20)).toHaveLength(6)
  })

  it('centres a lone missile', () => {
    expect(missileCluster(1)).toEqual([{ x: 0, z: 0 }])
  })

  it('splits a pair across the centre line, side by side', () => {
    const [a, b] = missileCluster(2)
    expect(a.z).toBe(b.z)
    expect(a.x).toBe(-b.x)
    expect(a.x).not.toBe(0)
  })

  it('centres the odd one out on the last row of an odd cluster', () => {
    const three = missileCluster(3)
    expect(three[2].x).toBe(0)
  })

  it('never places two seats on top of each other', () => {
    const seats = missileCluster(6)
    const keys = new Set(seats.map((s) => `${s.x}:${s.z}`))
    expect(keys.size).toBe(seats.length)
  })
})
