/**
 * STARGRUNT'S OWN FILE — a placeholder overlays layer. Today it only marks
 * the objectives (p. 17, reused), so the table is not bare; BRIEF-GROUND-3D's
 * real list for this file is the integrity circle or chain for the selected
 * squad, the move ghost, the charge plan's paths to contact coloured by
 * roll, the fire line with the odds, in-position marks, and the deployment
 * zones — everything `ui/stargrunt/map/overlays.tsx` already draws flat,
 * raised here and draped on `heightAt` instead.
 *
 * Same shape as `units.ts`'s own contract, because `StargruntView3D.tsx`
 * calls both the same way:
 *
 *   - `new StargruntOverlaysLayer()` — no arguments.
 *   - `.group: THREE.Group`.
 *   - `.update(state, opts)` — called on every render.
 *   - `.dispose()`.
 */
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import type { GameState, Point } from '../../../stargrunt/types'
import { disposeTree, setTooltip, type Layer } from '../layer'
import { sideColorOf } from '../palette'

export interface StargruntOverlaysOptions {
  heightAt: (point: Point) => number
}

const OBJECTIVE_RADIUS = 0.7
const OBJECTIVE_HEIGHT = 0.05
const NEUTRAL = 0xd8c98a

export class StargruntOverlaysLayer implements Layer {
  readonly group = new Group()
  private markers = new Map<string, Mesh>()

  constructor() {
    this.group.name = 'stargrunt-overlays'
  }

  update(state: GameState, opts: StargruntOverlaysOptions): void {
    const live = new Set<string>()
    for (const objective of state.setup.table.objectives) {
      live.add(objective.id)
      let mesh = this.markers.get(objective.id)
      if (!mesh) {
        mesh = new Mesh(new CylinderGeometry(OBJECTIVE_RADIUS, OBJECTIVE_RADIUS, OBJECTIVE_HEIGHT, 24), new MeshStandardMaterial({ color: NEUTRAL, roughness: 0.7 }))
        this.group.add(mesh)
        this.markers.set(objective.id, mesh)
      }
      const held = state.objectives[objective.id]?.heldBy ?? null
      const y = opts.heightAt(objective.position) + OBJECTIVE_HEIGHT / 2
      mesh.position.set(objective.position.x, y, objective.position.y)
      ;(mesh.material as MeshStandardMaterial).color.setHex(held ? sideColorOf(held) : NEUTRAL)
      setTooltip(mesh, `Objective, value ${objective.value}${held ? `, held by ${state.sides[held].name}` : ''}`)
    }
    for (const [id, mesh] of this.markers) {
      if (live.has(id)) continue
      this.group.remove(mesh)
      disposeTree(mesh)
      this.markers.delete(id)
    }
  }

  dispose(): void {
    disposeTree(this.group)
    this.markers.clear()
  }
}
