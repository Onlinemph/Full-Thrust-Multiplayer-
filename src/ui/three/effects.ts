/**
 * PLACEHOLDER (stage 2, WORLD) — `useFx`'s ephemeral battle effects (beam and
 * gun fire, hits, explosions) in 3D.
 *
 * `BattleFx.delay` is milliseconds from when the batch was queued (`fx.ts`),
 * the same number the 2D map hands its CSS `animationDelay`; this layer reads
 * the same clock by stamping each id's own arrival (`ctx.now`, the moment
 * `update` saw it for the first time) and starting its little animation
 * `delay` milliseconds after that. `DURATION` is this placeholder's own
 * guess at how long a flash should live — WORLD may want a different one per
 * `FxKind`, and a beam that actually looks like a beam (`effects.ts`'s
 * `beamTexture` slot in `textures.ts`) rather than a stretched box.
 */
import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three'
import type { BattleFx, FxKind } from '../fx'
import { disposeTree, type FrameContext, type Layer, type LayerContext } from './layer'
import { HULL_ALTITUDE, toWorld } from './space'

const DURATION = 650

const KIND_COLOR: Record<FxKind, number> = {
  beam: 0xff9548,
  kinetic: 0xdfe6ff,
  ordnance: 0xffd27a,
  hit: 0xffb070,
  destroyed: 0xff5c4a,
}

interface Entry {
  mesh: Mesh
  fx: BattleFx
  start: number
}

export class EffectsLayer implements Layer {
  readonly group = new Group()
  private entries = new Map<string, Entry>()

  constructor() {
    this.group.name = 'effects'
  }

  update({ view, now }: LayerContext): void {
    const seen = new Set<string>()
    for (const fx of view.fx) {
      seen.add(fx.id)
      if (this.entries.has(fx.id)) continue
      const mesh = fx.from ? beamMesh(fx) : burstMesh(fx)
      this.group.add(mesh)
      this.entries.set(fx.id, { mesh, fx, start: now })
    }
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue
      disposeTree(entry.mesh)
      this.group.remove(entry.mesh)
      this.entries.delete(id)
    }
  }

  tick({ now }: FrameContext): void {
    for (const [id, entry] of this.entries) {
      const t = now - (entry.start + entry.fx.delay)
      const material = entry.mesh.material as MeshBasicMaterial
      if (t < 0) {
        material.opacity = 0
        continue
      }
      const k = Math.min(1, t / DURATION)
      material.opacity = 1 - k
      if (entry.fx.kind === 'destroyed' || entry.fx.kind === 'hit') {
        const scale = 1 + k * (entry.fx.kind === 'destroyed' ? 3 : 1.6)
        entry.mesh.scale.setScalar(scale)
      }
      if (t > DURATION) {
        disposeTree(entry.mesh)
        this.group.remove(entry.mesh)
        this.entries.delete(id)
      }
    }
  }

  dispose(): void {
    disposeTree(this.group)
    this.entries.clear()
  }
}

/** A shot from a shooter to a target: a thin cylinder, laid along the line between them. */
function beamMesh(fx: BattleFx): Mesh {
  const from = toWorld(fx.from!, HULL_ALTITUDE)
  const to = toWorld(fx.to, HULL_ALTITUDE)
  const length = from.distanceTo(to)
  const material = new MeshBasicMaterial({ color: KIND_COLOR[fx.kind], transparent: true, opacity: 0, toneMapped: false })
  const mesh = new Mesh(new CylinderGeometry(0.05, 0.05, Math.max(0.01, length), 6), material)
  mesh.position.copy(from).add(to).multiplyScalar(0.5)
  mesh.lookAt(to)
  mesh.rotateX(Math.PI / 2)
  return mesh
}

/** A hit or a kill: an expanding, fading sphere at the point struck. */
function burstMesh(fx: BattleFx): Mesh {
  const at = toWorld(fx.to, HULL_ALTITUDE)
  const material = new MeshBasicMaterial({ color: KIND_COLOR[fx.kind], transparent: true, opacity: 0, toneMapped: false })
  const mesh = new Mesh(new SphereGeometry(fx.kind === 'destroyed' ? 0.5 : 0.25, 10, 8), material)
  mesh.position.copy(at)
  return mesh
}
