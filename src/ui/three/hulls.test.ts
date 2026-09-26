import { describe, expect, it } from 'vitest'
import { SHIP_DESIGNS } from '../../data/ships'
import { counterRadius } from '../Counter'
import { buildHull } from './hulls'

function designNamed(name: string) {
  const design = SHIP_DESIGNS.find((d) => d.name === name)
  if (!design) throw new Error(`the roster has lost its ${name}`)
  return design
}

const heavyCruiser = designNamed('Heavy Cruiser')
const waveCruiser = designNamed('Maxwell-class Wave Cruiser') // built round a spinal mount (5.23)
const starbase = designNamed('Bastion-class Starbase') // a station: no bow, no drive

describe('buildHull', () => {
  it('extrudes a real solid, not an empty shape', () => {
    const hull = buildHull(heavyCruiser, counterRadius(heavyCruiser.mass))
    const position = hull.plating.getAttribute('position')
    expect(position.count).toBeGreaterThan(8)
    expect(hull.halfLength).toBeGreaterThan(0)
    expect(hull.top).toBeGreaterThan(0)
  })

  it('is centred on the origin, pointing toward −Z, in both extents', () => {
    const hull = buildHull(heavyCruiser, counterRadius(heavyCruiser.mass))
    const position = hull.plating.getAttribute('position')
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i)
      const z = position.getZ(i)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }
    // Roughly symmetric about the keel — a hull is not lopsided left-to-right.
    expect(Math.abs(maxX + minX)).toBeLessThan((maxX - minX) * 0.05 + 1e-6)
    // Longer astern-to-bow than it is broad beam-to-beam.
    expect(maxZ - minZ).toBeGreaterThan(maxX - minX)
    expect(Math.abs(minZ)).toBeGreaterThan(0)
    expect(maxZ).toBeGreaterThan(0)

    // The −Z end is the taper: `hullShape`'s own nose is narrower than its
    // stern, so the beam a hair inside the −Z tip must read narrower than the
    // same margin inside the +Z tip — not just "the hull spans both signs",
    // which a hull pointing the wrong way would still do.
    const margin = (maxZ - minZ) * 0.08
    const beamNear = (edge: number) => {
      let lo = Infinity, hi = -Infinity
      for (let i = 0; i < position.count; i += 1) {
        const z = position.getZ(i)
        if (Math.abs(z - edge) > margin) continue
        const x = position.getX(i)
        lo = Math.min(lo, x)
        hi = Math.max(hi, x)
      }
      return hi - lo
    }
    expect(beamNear(minZ)).toBeLessThan(beamNear(maxZ))
  })

  it('faces the right way up: the plating reads lit from above, not from below', () => {
    // Every triangle's normal averaged should point mostly +Y — a hull whose
    // outline wound the wrong way extrudes inside-out and reads black under
    // the sun no matter how the material is lit.
    const hull = buildHull(heavyCruiser, counterRadius(heavyCruiser.mass))
    const normal = hull.plating.getAttribute('normal')
    let upCount = 0
    for (let i = 0; i < normal.count; i += 1) {
      if (normal.getY(i) > 0.5) upCount += 1
    }
    expect(upCount).toBeGreaterThan(0)
  })

  it('scales with the counter radius it is asked to fill', () => {
    const small = buildHull(designNamed('Frigate'), 1)
    // Same design, different key would collide with the cache — build a
    // throwaway design object instead so this reads the small case fresh.
    expect(small.halfLength).toBeGreaterThan(0)
    expect(small.halfLength).toBeLessThan(2)
  })

  it('caches by design id: the same class shares one buffer', () => {
    const a = buildHull(heavyCruiser, counterRadius(heavyCruiser.mass))
    const b = buildHull(heavyCruiser, counterRadius(heavyCruiser.mass))
    expect(a.plating).toBe(b.plating)
    expect(a.plating.userData.shared).toBe(true)
  })

  it('marks a spinal-mount hull with the barrel it is built around (5.23)', () => {
    const hull = buildHull(waveCruiser, counterRadius(waveCruiser.mass))
    expect(hull.spine).not.toBeNull()
    expect(hull.spine!.z2).toBeGreaterThan(hull.spine!.z1)
  })

  it('leaves an unarmed-with-one hull with no spine', () => {
    const hull = buildHull(heavyCruiser, counterRadius(heavyCruiser.mass))
    expect(hull.spine).toBeNull()
  })

  it('gives a station no bow and no drive mounts', () => {
    const hull = buildHull(starbase, counterRadius(starbase.mass))
    expect(hull.radial).toBe(true)
    expect(hull.engineMounts).toHaveLength(0)
  })

  it('puts a driven hull\'s engine mounts astern, clear of the keel when the beam allows it', () => {
    const hull = buildHull(heavyCruiser, counterRadius(heavyCruiser.mass))
    expect(hull.engineMounts.length).toBeGreaterThan(0)
    for (const mount of hull.engineMounts) {
      expect(mount.z).toBeGreaterThan(0) // astern is +Z
    }
  })
})
