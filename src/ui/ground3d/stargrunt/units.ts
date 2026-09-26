/**
 * STARGRUNT'S OWN FILE — a placeholder units layer, good enough to see the
 * battle: one side-coloured block per living figure, at its own position,
 * standing on the terrain's own `heightAt`. Replace the inside of this file
 * freely; keep the outside the same shape, because `StargruntView3D.tsx`
 * (also yours) and `GroundScene` (GROUND's, not yours) both call it:
 *
 *   - `new StargruntUnitsLayer()` — no arguments.
 *   - `.group: THREE.Group` — added to the scene once, forever.
 *   - `.update(figures, opts)` — called on every render; diff by figure id
 *     rather than rebuilding (`src/ui/three/ships.ts`'s own pattern).
 *   - `.pickables(): Object3D[]` — every clickable mesh, tagged with
 *     `tagPickable(mesh, id)` (`../layer.ts`). Today every figure is tagged
 *     with its own *unit*'s id — `TableMap.tsx`'s own `onSelectUnit` reads a
 *     squad, and only deployment (`onSelectFigure`) ever wants one figure
 *     picked out alone; wire that distinction in when you replace this.
 *   - `.drawnPosition(id): Vector3 | null` — a *unit*'s own drawn position
 *     (its first live figure's, today), for camera focus and Follow.
 *   - `.dispose()`.
 *
 * BRIEF-GROUND-3D's actual list for this file: every figure as a small
 * 25mm soldier (body, head and helmet, the weapon by kit), wounded and dead
 * figures marked, squad pennants with code, quality, confidence and
 * suppression pips. None of that is built yet — this is only a block.
 */
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { FigureState, Point } from '../../../stargrunt/types'
import { disposeTree, setTooltip, tagPickable, type Layer } from '../layer'
import { sideColorOf } from '../palette'

export interface StargruntUnitsOptions {
  heightAt: (point: Point) => number
  selectedUnitId: string | null
}

interface Entry {
  mesh: Mesh
  height: number
}

const FIGURE_SIZE = { w: 0.22, h: 0.55, d: 0.22 }

export class StargruntUnitsLayer implements Layer {
  readonly group = new Group()
  private entries = new Map<string, Entry>()
  private unitOf = new Map<string, string>()

  constructor() {
    this.group.name = 'stargrunt-units'
  }

  update(figures: Record<string, FigureState>, opts: StargruntUnitsOptions): void {
    const live = new Set<string>()
    this.unitOf.clear()
    for (const f of Object.values(figures)) {
      if (f.status === 'dead') continue
      live.add(f.id)
      this.unitOf.set(f.id, f.unitId)
      let entry = this.entries.get(f.id)
      if (!entry) entry = this.spawn(f)
      const ground = opts.heightAt(f.position)
      entry.mesh.position.set(f.position.x, ground + entry.height / 2, f.position.y)
      const material = entry.mesh.material as MeshStandardMaterial
      material.emissive = new Color(opts.selectedUnitId === f.unitId ? 0x2c2c2c : 0x000000)
      material.opacity = f.status === 'wounded' || f.status === 'stabilised' ? 0.6 : 1
      material.transparent = material.opacity < 1
      setTooltip(entry.mesh, `${f.name}${f.status !== 'ok' ? ` (${f.status})` : ''}`)
    }
    for (const [id, entry] of this.entries) {
      if (live.has(id)) continue
      this.group.remove(entry.mesh)
      disposeTree(entry.mesh)
      this.entries.delete(id)
    }
  }

  private spawn(f: FigureState): Entry {
    const mesh = new Mesh(new BoxGeometry(FIGURE_SIZE.w, FIGURE_SIZE.h, FIGURE_SIZE.d), new MeshStandardMaterial({ color: sideColorOf(f.sideId), roughness: 0.6 }))
    tagPickable(mesh, f.unitId)
    this.group.add(mesh)
    const entry: Entry = { mesh, height: FIGURE_SIZE.h }
    this.entries.set(f.id, entry)
    return entry
  }

  pickables(): Mesh[] {
    return [...this.entries.values()].map((e) => e.mesh)
  }

  /** A unit's own drawn position: its first live figure's, since a squad has no single point of its own here yet. */
  drawnPosition(unitId: string): Vector3 | null {
    for (const [figureId, entry] of this.entries) {
      if (this.unitOf.get(figureId) === unitId) return entry.mesh.position.clone()
    }
    return null
  }

  dispose(): void {
    disposeTree(this.group)
    this.entries.clear()
    this.unitOf.clear()
  }
}
