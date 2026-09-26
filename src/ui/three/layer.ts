/**
 * The contract every part of the 3D scene keeps.
 *
 * The scene is built from layers — backdrop, terrain, ships, flights,
 * ordnance, overlays, effects — each owning one `THREE.Group` and nothing
 * else. The orchestrator (`BattleScene`) hands every layer the same view of
 * the battle whenever it changes, and a clock every frame. A layer diffs the
 * battle against what it has built (by id) rather than rebuilding, so a hull
 * that has not changed is not touched and an animation in flight is not
 * restarted.
 *
 * Layers never change the game. Like the 2D map, everything here is a pure
 * reading of `GameState` plus the view's own props — the same props
 * `MapView` takes (see `ViewProps` below), so a click routed by `BattleScene`
 * ends up at the very same `dispatch`/`refuseAtTable` call MapView would have
 * made.
 */
import type { Camera, Group, Object3D } from 'three'
import type { ShipState } from '../../engine/game'
import type { GameState, TerrainKind } from '../../engine/game'
import type { Arc, Course, Point } from '../../engine/types'
import type { BattleFx } from '../fx'

/** The ordnance mount in hand (6.3, 6.8) — `MapViewProps['aimWith']`. */
export interface AimWith {
  shipId: string
  weaponId: string
  kind: 'missile' | 'plasma-bolt' | 'spinal' | 'flak'
  onPlace?: (point: Point) => void
}

/**
 * What the 3D view is asked to show and to let the player do: the same
 * fields `MapViewProps` carries, minus `game`/`table` (given separately) and
 * minus the callbacks, which `BattleScene` calls directly through `dispatch`/
 * `refuseAtTable` — see `BattleView3D.tsx` for how the props map onto this.
 */
export interface ViewProps {
  selectedId: string | null
  viewingSide: string | null
  canCommand: ((ship: ShipState) => boolean) | null
  litArcs: readonly Arc[] | null
  fireRose: boolean
  selectedFlightId: string | null
  deployWith: { facing: Course; velocity: number } | null
  aimWith: AimWith | null
  placingTerrain: { sideId: string; kind: TerrainKind; radius: number } | null
  returnWith: string | null
  fx: BattleFx[]
}

export interface LayerContext {
  game: GameState
  view: ViewProps
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
  /**
   * Viewport-space Y of the canvas host's own top edge
   * (`host.getBoundingClientRect().top`) — what a layer measures a CSS2D
   * label's or overlay's own `getBoundingClientRect()` against to keep it
   * clear of the HUD toolbar drawn over the canvas (R8), without needing a
   * DOM reference of its own.
   */
  hostTop: number
}

export interface Layer {
  readonly group: Group
  update(ctx: LayerContext): void
  tick?(frame: FrameContext): void
  dispose(): void
}

/**
 * Tag an object so a click on any mesh inside it resolves to a game entity.
 * The picker walks up from the hit mesh to the first tagged ancestor.
 */
export interface Pickable {
  kind: 'ship' | 'flight' | 'squadron'
  id: string
}

export function tagPickable(object: Object3D, pick: Pickable): void {
  object.userData.pick = pick
}

export function pickableOf(object: Object3D | null): Pickable | null {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (o.userData.pick) return o.userData.pick as Pickable
  }
  return null
}

/**
 * Hover text for any tagged object, shown in the view's tooltip — the 3D
 * counterpart of the 2D map's `<title>`/`aria-label` text.
 */
export function setTooltip(object: Object3D, text: string): void {
  object.userData.tooltip = text
}

export function tooltipOf(object: Object3D | null): string | null {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (typeof o.userData.tooltip === 'string') return o.userData.tooltip
  }
  return null
}

/**
 * Dispose every geometry and material under an object (textures included),
 * and take its HTML labels out of the page. A CSS2D label only removes its
 * own element when it is itself the object detached from the scene; one
 * nested inside a removed group would otherwise stay on screen, frozen where
 * it was last drawn.
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
      const mat = m as {
        dispose(): void
        userData?: { shared?: boolean }
        map?: { dispose(): void; userData?: { shared?: boolean } } | null
      }
      if (mat.userData?.shared) continue
      // A per-instance material's own `.map` can still be one of
      // `textures.ts`'s cached, module-level Textures (every hull's plating,
      // every glow sprite, backdrop stars, terrain glows — `canvasTexture()`
      // and `worldTexture()` both stamp `userData.shared` on the texture
      // itself for exactly this check). Disposing that here frees the GPU
      // texture out from under every other live consumer still pointing at
      // the same JS object (R2) — checked independently of the material's
      // own flag, which only ever describes the material.
      if (!mat.map?.userData?.shared) mat.map?.dispose()
      mat.dispose()
    }
  })
}
