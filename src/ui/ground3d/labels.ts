/**
 * Text in the ground 3D view: HTML labels pinned to points in the scene by
 * three's CSS2DRenderer — `src/ui/three/labels.ts`'s own idea, copied here
 * so this folder never imports from `src/ui/three/`. They stay upright and
 * crisp at any camera angle and cost nothing to change, which is why
 * terrain names and unit codes are labels rather than textures.
 */
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

export function makeLabel(text: string, className: string): CSS2DObject {
  const el = document.createElement('div')
  el.className = `g3d-l ${className}`
  el.textContent = text
  const label = new CSS2DObject(el)
  label.center.set(0.5, 0.5)
  return label
}

/** Change a label's text and classes only when they actually differ. */
export function setLabel(label: CSS2DObject, text: string, className?: string): void {
  if (label.element.textContent !== text) label.element.textContent = text
  if (className !== undefined) {
    const full = `g3d-l ${className}`
    if (label.element.className !== full) label.element.className = full
  }
}

/** A label offered up to `declutterLabels` (K2). */
export interface DeclutterCandidate {
  element: HTMLElement
  /**
   * 0 keeps the hovered target's own label, 1 the selected unit's own —
   * neither ever fades for crowding, only for straying over the HUD.
   * Anything else (2+) is "the rest", sorted nearest-camera-first by
   * `distance` and faded first when it clashes with one already kept.
   */
  priority: number
  distance: number
}

const DECLUTTER_PAD = 3

/**
 * Screen-space label declutter (K2): odds/verdict chips on a fire line,
 * pennants, unit labels — every one of them measured where `CSS2DRenderer`
 * last drew it (one frame stale, same as any post-render DOM read here
 * would be) and kept by priority, fading (never `display`, which
 * `CSS2DRenderer.render()` overwrites every frame after a layer's own
 * `tick()` runs) whichever clashes with one already kept or strays above
 * the HUD's own safe top margin. `src/ui/three/ships.ts`'s own
 * `declutterLabels`, generalised over any layer's own labels rather than
 * one ships layer's.
 */
export function declutterLabels(candidates: readonly DeclutterCandidate[], hostTop: number, toolbarClearance = 60): void {
  const safeTop = hostTop + toolbarClearance
  const rects: { c: DeclutterCandidate; rect: DOMRect }[] = []
  for (const c of candidates) {
    const rect = c.element.getBoundingClientRect()
    // Zero-sized: `CSS2DRenderer` already set `display: none` (behind the camera or outside the near/far planes) — nothing to declutter.
    if (rect.width === 0 && rect.height === 0) continue
    rects.push({ c, rect })
  }
  rects.sort((a, b) => (a.c.priority === b.c.priority ? a.c.distance - b.c.distance : a.c.priority - b.c.priority))
  const kept: DOMRect[] = []
  for (const { c, rect } of rects) {
    const aboveToolbar = rect.top < safeTop
    const neverFade = c.priority <= 1
    const overlapsKept = kept.some(
      (k) => rect.left < k.right + DECLUTTER_PAD && rect.right > k.left - DECLUTTER_PAD && rect.top < k.bottom + DECLUTTER_PAD && rect.bottom > k.top - DECLUTTER_PAD,
    )
    const hide = aboveToolbar || (!neverFade && overlapsKept)
    c.element.style.opacity = hide ? '0' : '1'
    if (!hide) kept.push(rect)
  }
}

export type { CSS2DObject }
