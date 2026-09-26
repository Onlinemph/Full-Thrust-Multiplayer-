import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { disposeTree } from './layer'

describe('disposeTree (R2: a shared texture must outlive the instance disposing it)', () => {
  it('disposes an ordinary, unshared material and its own unshared map', () => {
    const map = new Texture()
    const geometry = new PlaneGeometry(1, 1)
    const material = new MeshBasicMaterial({ map })
    const group = new Group()
    group.add(new Mesh(geometry, material))

    const disposeMap = vi.spyOn(map, 'dispose')
    const disposeMat = vi.spyOn(material, 'dispose')
    const disposeGeo = vi.spyOn(geometry, 'dispose')

    disposeTree(group)

    expect(disposeGeo).toHaveBeenCalledTimes(1)
    expect(disposeMat).toHaveBeenCalledTimes(1)
    expect(disposeMap).toHaveBeenCalledTimes(1)
  })

  it('never disposes a map stamped userData.shared, even off an unshared material (textures.ts cache)', () => {
    // Two hulls' own per-instance materials (colour/damage differ, so
    // neither material itself is `shared`), both pointing at one cached
    // `platingTexture()`-style Texture — exactly `ships.ts`'s real shape.
    const platingTexture = new Texture()
    platingTexture.userData.shared = true
    const shipA = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: platingTexture }))
    const shipB = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: platingTexture }))
    const groupA = new Group()
    groupA.add(shipA)

    const disposeMap = vi.spyOn(platingTexture, 'dispose')

    // Ship A leaves the table (fog, return-to-table, destruction) — the real
    // path `ShipsLayer.update()` takes for a hull no longer visible.
    disposeTree(groupA)

    expect(disposeMap).not.toHaveBeenCalled()
    // Ship B's own material still points at the same, still-live texture.
    expect((shipB.material as MeshBasicMaterial).map).toBe(platingTexture)
  })

  it('still skips both when the material itself is stamped shared', () => {
    const map = new Texture()
    const material = new MeshBasicMaterial({ map })
    material.userData.shared = true
    const group = new Group()
    group.add(new Mesh(new PlaneGeometry(1, 1), material))

    const disposeMap = vi.spyOn(map, 'dispose')
    const disposeMat = vi.spyOn(material, 'dispose')

    disposeTree(group)

    expect(disposeMat).not.toHaveBeenCalled()
    expect(disposeMap).not.toHaveBeenCalled()
  })

  it('disposes a per-instance map that is genuinely unshared, same as before this fix', () => {
    const ownMap = new Texture()
    const material = new MeshBasicMaterial({ map: ownMap })
    const group = new Group()
    group.add(new Mesh(new PlaneGeometry(1, 1), material))

    const disposeMap = vi.spyOn(ownMap, 'dispose')

    disposeTree(group)

    expect(disposeMap).toHaveBeenCalledTimes(1)
  })
})
