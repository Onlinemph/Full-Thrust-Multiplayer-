/**
 * DIRTSIDE'S OWN FILE — a placeholder units layer, good enough to see the
 * battle: one side-coloured block per element still on the table, at its
 * own position and facing, standing on the terrain's own `heightAt` (on a
 * hill's terrace when it is on one). Replace the inside of this file
 * freely; keep the outside the same shape, because `DirtsideView3D.tsx`
 * (also yours) and `GroundScene` (GROUND's, not yours) both call it:
 *
 *   - `new DirtsideUnitsLayer()` — no arguments.
 *   - `.group: THREE.Group` — added to the scene once, forever.
 *   - `.update(elements, opts)` — called on every render; diff by element
 *     id rather than rebuilding, the way `src/ui/three/ships.ts` does, so a
 *     hull that has not changed is not rebuilt and an animation in flight
 *     is not restarted.
 *   - `.pickables(): Object3D[]` — every clickable mesh, tagged with
 *     `tagPickable(mesh, elementId)` (`../layer.ts`). `GroundScene` raycasts
 *     these for `onSelectUnit`/hover; nothing here decides what a click
 *     means, same as the 2D map's own counters.
 *   - `.drawnPosition(id): Vector3 | null` — where an element is actually
 *     drawn, for camera focus and Follow; null once it is not drawn.
 *   - `.dispose()` — dispose every geometry/material (`disposeTree`).
 *
 * BRIEF-GROUND-3D's actual list for this file: elements as 6mm models by
 * mobility and size class (tracked, wheeled, GEV hover skirts, grav
 * floating, walkers, VTOL if any) with turrets, infantry stands, command
 * marks, damage and systems-down marks, suppression and hull-down/dug-in
 * marks, the unit pennants (`../../dirtside/unitCodes.ts`, side colours as
 * the 2D map uses them). None of that is built yet — this is only a block.
 */
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { ElementState, Point } from '../../../dirtside/table/types'
import { disposeTree, setTooltip, tagPickable, type Layer } from '../layer'
import { sideColorOf } from '../palette'
import { headingToYaw } from '../space'

export interface DirtsideUnitsOptions {
  heightAt: (point: Point) => number
  selectedId: string | null
}

interface Entry {
  mesh: Mesh
  height: number
}

const VEHICLE_SIZE = { w: 0.55, h: 0.32, d: 0.85 }
const INFANTRY_SIZE = { w: 0.26, h: 0.42, d: 0.26 }

export class DirtsideUnitsLayer implements Layer {
  readonly group = new Group()
  private entries = new Map<string, Entry>()

  constructor() {
    this.group.name = 'dirtside-units'
  }

  update(elements: Record<string, ElementState>, opts: DirtsideUnitsOptions): void {
    const live = new Set<string>()
    for (const el of Object.values(elements)) {
      if (el.destroyed || el.aboard) continue
      live.add(el.id)
      let entry = this.entries.get(el.id)
      if (!entry) entry = this.spawn(el)
      const ground = opts.heightAt(el.position)
      entry.mesh.position.set(el.position.x, ground + entry.height / 2, el.position.y)
      entry.mesh.rotation.y = headingToYaw(el.facing)
      const material = entry.mesh.material as MeshStandardMaterial
      material.emissive = new Color(opts.selectedId === el.id ? 0x2c2c2c : 0x000000)
      setTooltip(entry.mesh, el.name)
    }
    for (const [id, entry] of this.entries) {
      if (live.has(id)) continue
      this.group.remove(entry.mesh)
      disposeTree(entry.mesh)
      this.entries.delete(id)
    }
  }

  private spawn(el: ElementState): Entry {
    const isVehicle = !!el.vehicle
    const size = isVehicle ? VEHICLE_SIZE : INFANTRY_SIZE
    const mesh = new Mesh(new BoxGeometry(size.w, size.h, size.d), new MeshStandardMaterial({ color: sideColorOf(el.sideId), roughness: 0.6 }))
    tagPickable(mesh, el.id)
    this.group.add(mesh)
    const entry: Entry = { mesh, height: size.h }
    this.entries.set(el.id, entry)
    return entry
  }

  pickables(): Mesh[] {
    return [...this.entries.values()].map((e) => e.mesh)
  }

  drawnPosition(id: string): Vector3 | null {
    return this.entries.get(id)?.mesh.position.clone() ?? null
  }

  dispose(): void {
    disposeTree(this.group)
    this.entries.clear()
  }
}
