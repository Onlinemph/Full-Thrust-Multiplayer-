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

export type { CSS2DObject }
