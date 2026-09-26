/**
 * Text in the 3D view: HTML labels pinned to points in the scene by three's
 * CSS2DRenderer. They stay upright and crisp at any camera angle, use the
 * app's own fonts and colours (styled in three.css), and cost nothing to
 * change — which is why names, shield figures and ranges are labels rather
 * than textures.
 */
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

export function makeLabel(text: string, className: string): CSS2DObject {
  const el = document.createElement('div')
  el.className = `l3d ${className}`
  el.textContent = text
  const label = new CSS2DObject(el)
  label.center.set(0.5, 0.5)
  return label
}

/** Change a label's text and classes only when they actually differ. */
export function setLabel(label: CSS2DObject, text: string, className?: string): void {
  if (label.element.textContent !== text) label.element.textContent = text
  if (className !== undefined) {
    const full = `l3d ${className}`
    if (label.element.className !== full) label.element.className = full
  }
}

export type { CSS2DObject }
