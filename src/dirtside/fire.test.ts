/**
 * Direct fire (pp. 28–32) and vehicle weapons on infantry (p. 36): the
 * plan a shot gets, the refusals with their pages, and the roll.
 */

import { describe, expect, it } from 'vitest'
import { newVehicleDesign } from './design'
import { newStream } from './dice'
import { type Firer, type Shot, type Target, bandAt, fireShot, narrateShot, planShot } from './fire'
import type { DirectFireWeapon, VehicleDesign } from './types'

const gun = (type: DirectFireWeapon['type'], cls: DirectFireWeapon['class'], barrels = 1): DirectFireWeapon => ({ id: `${type}${cls}`, type, class: cls, mount: 'turret', barrels })

const tank = (patch: Partial<VehicleDesign> = {}): VehicleDesign => ({ ...newVehicleDesign('firer'), fireControl: 'basic', weapons: [gun('hkp', 3)], ...patch })

const firer = (design: VehicleDesign, patch: Partial<Firer> = {}): Firer => ({ design, weaponId: design.weapons[0]!.id, movingFast: false, damaged: false, systemsDown: false, ...patch })

const vehicle = (patch: Partial<Extract<Target, { kind: 'vehicle' }>> = {}, design: Partial<VehicleDesign> = {}): Target => ({
  kind: 'vehicle',
  design: { ...newVehicleDesign('target'), armour: 4, ...design },
  aspect: 'front',
  posture: 'none',
  ...patch,
})

const plan = (shot: Shot) => {
  const p = planShot(shot)
  if (!p.ok) throw new Error(`refused: ${p.reason} (${p.page})`)
  return p
}
const refusal = (shot: Shot) => {
  const p = planShot(shot)
  if (p.ok) throw new Error('not refused')
  return p
}
const vehiclePlan = (shot: Shot) => {
  const p = plan(shot)
  if (p.kind !== 'vehicle') throw new Error('not a vehicle shot')
  return p
}
const fired = (shot: Shot, seed: number) => {
  const r = fireShot(shot, newStream(seed))
  if ('ok' in r) throw new Error(`refused: ${r.reason}`)
  return r
}

describe('range bands (p. 28)', () => {
  it('reads an RFAC/2 as close to 12", medium to 18", long to 24" and nothing beyond', () => {
    const w = gun('rfac', 2)
    expect(bandAt(w, 10)).toBe('close')
    expect(bandAt(w, 12)).toBe('close')
    expect(bandAt(w, 15)).toBe('medium')
    expect(bandAt(w, 24)).toBe('long')
    expect(bandAt(w, 25)).toBeNull()
  })

  it('a HEL is one 60" band, rolled as medium', () => {
    expect(bandAt(gun('hel', 2), 55)).toBe('medium')
    expect(bandAt(gun('hel', 2), 61)).toBeNull()
  })

  it('a damaged firer treats each band as the next one out, and cannot fire at long range (p. 30)', () => {
    const w = gun('hkp', 3)
    expect(bandAt(w, 10, true)).toBe('medium')
    expect(bandAt(w, 25, true)).toBe('long')
    expect(bandAt(w, 35, true)).toBeNull()
    expect(refusal({ firer: firer(tank(), { damaged: true }), target: vehicle(), range: 35 }).page).toBe('p. 30')
  })
})

describe('the plan against a vehicle (pp. 28–30)', () => {
  it('HKP/3 at medium on armour 4: D6, three chits, red and yellow, against the signature die', () => {
    const p = plan({ firer: firer(tank()), target: vehicle(), range: 25 })
    if (p.kind !== 'vehicle') throw new Error('kind')
    expect(p.band).toBe('medium')
    expect(p.firerDie).toBe(6)
    expect(p.chitsPerHit).toBe(3)
    expect(p.validity).toBe('R/Y')
    expect(p.armour).toBe(4)
    expect(p.targetPrimary).toBe(8) // a medium (size 3) vehicle, signature 3
    expect(p.targetSecondary).toBeNull()
    expect(p.odds.hit).toBeCloseTo((0 + 1 + 2 + 3 + 4 + 5) / 8 / 6, 12)
  })

  it('steps the die by band and fire control: superior at close range rolls a D12', () => {
    const p = plan({ firer: firer(tank({ fireControl: 'superior' })), target: vehicle(), range: 10 })
    expect(p.kind === 'vehicle' && p.firerDie).toBe(12)
    const q = plan({ firer: firer(tank({ fireControl: 'enhanced' })), target: vehicle(), range: 40 })
    expect(q.kind === 'vehicle' && q.firerDie).toBe(6)
  })

  it('moving over half its base movement steps the die down, and off the end is a refusal (p. 28)', () => {
    const p = plan({ firer: firer(tank(), { movingFast: true }), target: vehicle(), range: 25 })
    expect(p.kind === 'vehicle' && p.firerDie).toBe(4)
    const r = refusal({ firer: firer(tank(), { movingFast: true }), target: vehicle(), range: 40 })
    expect(r.page).toBe('p. 28')
    expect(r.reason).toMatch(/off the end/)
  })

  it('a hull-down target rolls a second D10; only the highest secondary applies (p. 29)', () => {
    const p = plan({ firer: firer(tank()), target: vehicle({ posture: 'hull-down' }), range: 25 })
    expect(p.kind === 'vehicle' && p.targetSecondary).toBe(10)
    const covered = vehiclePlan({ firer: firer(tank()), target: vehicle({ posture: 'soft-cover' }), range: 25 })
    const open = vehiclePlan({ firer: firer(tank()), target: vehicle(), range: 25 })
    expect(covered.odds.hit).toBeLessThan(open.odds.hit)
    expect(covered.notes.join(' ')).toMatch(/second D6/)
  })

  it('a side shot faces one less armour (p. 10)', () => {
    const p = plan({ firer: firer(tank()), target: vehicle({ aspect: 'side' }), range: 25 })
    expect(p.kind === 'vehicle' && p.armour).toBe(3)
  })

  it('ablative armour turns a HEL green; reactive turns a SLAM red (p. 29)', () => {
    const hel = plan({ firer: firer(tank({ weapons: [gun('hel', 2)] })), target: vehicle({}, { armourSpecial: 'ablative' }), range: 30 })
    expect(hel.validity).toBe('GREEN')
    const slam = plan({ firer: firer(tank({ weapons: [gun('slam', 3)] })), target: vehicle({}, { armourSpecial: 'reactive' }), range: 10 })
    expect(slam.validity).toBe('RED')
  })

  it('refuses out of range, systems down and no fire control, naming the page', () => {
    expect(refusal({ firer: firer(tank()), target: vehicle(), range: 43 }).page).toBe('p. 28')
    expect(refusal({ firer: firer(tank(), { systemsDown: true }), target: vehicle(), range: 10 }).page).toBe('p. 30')
    expect(refusal({ firer: firer(tank({ fireControl: null })), target: vehicle(), range: 10 }).page).toBe('p. 28')
  })

  it('a twin mount rolls two dice (p. 32)', () => {
    const p = plan({ firer: firer(tank({ weapons: [gun('hkp', 3, 2)] })), target: vehicle(), range: 25 })
    expect(p.kind === 'vehicle' && p.dice).toBe(2)
  })
})

describe('vehicle weapons on infantry (p. 36)', () => {
  const troops = (patch: Partial<Extract<Target, { kind: 'infantry' }>> = {}): Target => ({ kind: 'infantry', troops: 'line', position: 'open', ...patch })

  it('an HKP has no effect; a HEL reaches 36" for two chits; an RFAC two chits within its medium band', () => {
    expect(refusal({ firer: firer(tank()), target: troops(), range: 10 }).page).toBe('p. 36')
    const hel = plan({ firer: firer(tank({ weapons: [gun('hel', 3)] })), target: troops(), range: 36 })
    expect(hel.kind === 'infantry' && hel.chitsPerDraw).toBe(2)
    expect(refusal({ firer: firer(tank({ weapons: [gun('hel', 3)] })), target: troops(), range: 37 }).page).toBe('p. 36')
    const rfac = plan({ firer: firer(tank({ weapons: [gun('rfac', 1)] })), target: troops(), range: 12 })
    expect(rfac.kind === 'infantry' && rfac.chitsPerDraw).toBe(2)
    expect(refusal({ firer: firer(tank({ weapons: [gun('rfac', 1)] })), target: troops(), range: 13 }).page).toBe('p. 36')
  })

  it('a DFFG draws three; a SLAM draws its class at close range only', () => {
    const dffg = plan({ firer: firer(tank({ weapons: [gun('dffg', 2)] })), target: troops(), range: 12 })
    expect(dffg.kind === 'infantry' && dffg.chitsPerDraw).toBe(3)
    const slam = plan({ firer: firer(tank({ weapons: [gun('slam', 4)] })), target: troops(), range: 12 })
    expect(slam.kind === 'infantry' && slam.chitsPerDraw).toBe(4)
    expect(refusal({ firer: firer(tank({ weapons: [gun('slam', 4)] })), target: troops(), range: 13 }).reason).toMatch(/secondary/)
  })

  it('validity by weapon (p. 29) unless the firefight reading (p. 33, p. 36) is asked for', () => {
    const shot: Shot = { firer: firer(tank({ weapons: [gun('hel', 3)] })), target: troops({ position: 'soft-cover' }), range: 20 }
    expect(plan(shot).validity).toBe('YELLOW')
    expect(plan({ ...shot, infantryValidity: 'position' }).validity).toBe('RED')
    const dffg = plan({ firer: firer(tank({ weapons: [gun('dffg', 2)] })), target: troops(), range: 12 })
    expect(dffg.validity).toBe('RED')
  })

  it('needs no roll and kills when a draw reaches the total; a twin mount draws twice', () => {
    const shot: Shot = { firer: firer(tank({ weapons: [gun('rfac', 2, 2)] })), target: troops({ troops: 'militia' }), range: 10 }
    const p = plan(shot)
    expect(p.kind === 'infantry' && p.draws).toBe(2)
    expect(p.kind === 'infantry' && p.killTotal).toBe(3)
    const result = fired(shot, 11)
    if (result.kind !== 'infantry') throw new Error('kind')
    expect(result.results).toHaveLength(2)
    expect(result.killed).toBe(result.results.some((r) => r.killed))
  })
})

describe('the roll', () => {
  it('is the same for the same seed, and every hit draws its own chits', () => {
    const shot: Shot = { firer: firer(tank({ fireControl: 'superior', weapons: [gun('mdc', 4, 3)] })), target: vehicle({}, { armour: 2 }), range: 10 }
    const a = fired(shot, 2024)
    const b = fired(shot, 2024)
    expect(a).toEqual(b)
    if (a.kind !== 'vehicle') throw new Error('kind')
    expect(a.firerRolls).toHaveLength(3)
    expect(a.hits).toBe(a.firerRolls.filter((r) => r > a.targetRolls.best).length)
    expect(a.results).toHaveLength(a.hits)
    for (const r of a.results) expect(r.chits).toHaveLength(4)
    expect(a.outcome.knockedOut).toBe(a.results.some((r) => r.knockedOut))
  })

  it('over many seeds, hits land at the planned rate', () => {
    const shot: Shot = { firer: firer(tank({ fireControl: 'enhanced' })), target: vehicle({ posture: 'hull-down' }), range: 25 }
    const p = vehiclePlan(shot)
    let hits = 0
    const trials = 4000
    for (let seed = 0; seed < trials; seed++) {
      const r = fired(shot, seed)
      if (r.kind === 'vehicle' && r.hits > 0) hits += 1
    }
    expect(Math.abs(hits / trials - p.odds.hit)).toBeLessThan(0.03)
  })

  it('narrates the shot with the dice and the chits', () => {
    const r = fired({ firer: firer(tank()), target: vehicle(), range: 25 }, 5)
    const lines = narrateShot(r)
    expect(lines[0]).toMatch(/HKP\/3 at medium range: D6 against D8\./)
    expect(lines[1]).toMatch(/Firer rolled \d; target rolled \d — (miss|hit)\./)
    if (r.kind === 'vehicle' && r.hits > 0) expect(lines[2]).toMatch(/^Drew /)
  })
})
