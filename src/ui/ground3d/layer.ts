/**
 * The contract every part of the ground 3D scene keeps — Dirtside's and
 * Stargrunt's own copy of `src/ui/three/layer.ts`'s idea, for a table
 * instead of open space.
 *
 * A layer owns one `THREE.Group` and nothing else. It is never generic over
 * what it reads: the terrain and backdrop layers here take the small,
 * table-shaped context every table understands (`GroundContext`, below);
 * a game's own units/overlays layers (Dirtside's, Stargrunt's) take
 * whatever their own `update` wants — their real `GameState`, their own
 * view props — typed however that game likes, because `GroundScene` never
 * calls `update` through this shared interface. It only ever calls `tick`
 * and `dispose` on every layer alike (see `GroundScene.ts`), and only the
 * shell that owns a layer calls its own `update` with its own types. Only
 * `tick`/`dispose`/`group` need one shape everyone shares, so only they are
 * in `Layer`.
 */
import type { Camera, Group, Object3D } from 'three'
import type { Point, TerrainFeature } from '../../dirtside/table/types'

/** What every table-shaped view can read: its size and its ground, nothing about who is playing. */
export interface GroundContext {
  table: { width: number; depth: number }
  features: readonly TerrainFeature[]
  /** `performance.now()` when this update was issued. */
  now: number
}

export interface FrameContext {
  /** Milliseconds, `performance.now()` clock. */
  now: number
  /** Seconds since the previous frame, clamped so a background tab does not jump. */
  dt: number
  camera: Camera
  /** Honour prefers-reduced-motion: no bobbing, no flight playback. */
  reducedMotion: boolean
}

export interface Layer {
  readonly group: Group
  tick?(frame: FrameContext): void
  dispose(): void
}

/**
 * Tag an object so a click on any mesh inside it resolves to a game entity.
 * The picker walks up from the hit mesh to the first tagged ancestor. One
 * kind only: a table has nothing like Full Thrust's flights/squadrons, just
 * units (Dirtside's elements, Stargrunt's figures or squads — each game's
 * own units layer decides what `id` names).
 */
export interface Pickable {
  kind: 'unit'
  id: string
}

export function tagPickable(object: Object3D, id: string): void {
  object.userData.pick = { kind: 'unit', id } satisfies Pickable
}

export function pickableOf(object: Object3D | null): Pickable | null {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (o.userData.pick) return o.userData.pick as Pickable
  }
  return null
}

/** Hover text for any tagged object — the 3D counterpart of the 2D map's `<title>`. */
export function setTooltip(object: Object3D, text: string): void {
  object.userData.tooltip = text
}

export function tooltipOf(object: Object3D | null): string | null {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (typeof o.userData.tooltip === 'string') return o.userData.tooltip
  }
  return null
}

/** Marks a point the terrain raycast should still resolve to a table point (`heightAt`'s own y is not read back). */
export function tagGround(object: Object3D): void {
  object.userData.ground = true
}

export function isGround(object: Object3D | null): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (o.userData.ground) return true
  }
  return false
}

/**
 * Dispose every geometry and material under an object (textures included),
 * and take its HTML labels out of the page. Exactly `three/layer.ts`'s own
 * `disposeTree`: never dispose a geometry or a material's map marked
 * `userData.shared` — the palette's shared textures and the woods'/rubble's
 * shared instanced geometries live past any one feature's rebuild.
 */
export function disposeTree(root: Object3D): void {
  root.traverse((o) => {
    const label = o as Object3D & { isCSS2DObject?: boolean; element?: HTMLElement }
    if (label.isCSS2DObject) label.element?.remove()
    const mesh = o as Object3D & {
      geometry?: { dispose(): void; userData?: { shared?: boolean } }
      material?: { dispose(): void; userData?: { shared?: boolean }; map?: { dispose(): void } | null } | Array<{ dispose(): void }>
    }
    if (mesh.geometry && !mesh.geometry.userData?.shared) mesh.geometry.dispose()
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const m of mats) {
      const mat = m as { dispose(): void; userData?: { shared?: boolean }; map?: { dispose(): void } | null }
      if (mat.userData?.shared) continue
      mat.map?.dispose()
      mat.dispose()
    }
  })
}

export type { Point }
