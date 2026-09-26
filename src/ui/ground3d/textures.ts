/**
 * Small procedural textures shared across the ground layers, drawn once on a
 * canvas and cached — `src/ui/three/textures.ts`'s own idea (no image
 * assets, so the lazy 3D chunk carries none), copied here so this folder
 * never imports from `src/ui/three/`.
 *
 * `speckleTexture` is every textured ground kind's own surface (grass, rough,
 * scrub, swamp, fields — BRIEF-GROUND-3D's "rough and scrub and swamp
 * textured"): a base tint with two fleck colours scattered over it, tileable,
 * so one draw serves any patch at any size. `glowTexture` is a soft dot, for
 * the mine-like glints water gets from the sun.
 */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

const cache = new Map<string, Texture>()

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}

function canvasTexture(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): Texture {
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  draw(canvas.getContext('2d')!, size)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.userData.shared = true
  cache.set(key, tex)
  return tex
}

/** A seeded, tileable speckle: `base`, flecked with `a` and `b` — grass, scrub, rough ground, a field, a swamp. */
export function speckleTexture(key: string, base: number, a: number, b: number, density = 260): Texture {
  return canvasTexture(key, 128, (ctx, s) => {
    ctx.fillStyle = hex(base)
    ctx.fillRect(0, 0, s, s)
    let seed = hashSeed(key)
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    for (let i = 0; i < density; i++) {
      const x = rand() * s
      const y = rand() * s
      const r = 0.6 + rand() * 1.6
      ctx.fillStyle = hex(rand() < 0.5 ? a : b)
      ctx.globalAlpha = 0.35 + rand() * 0.35
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  })
}

/** Furrows for a cultivated field: evenly spaced lines over the base tone. */
export function furrowTexture(key: string, base: number, furrow: number): Texture {
  return canvasTexture(key, 128, (ctx, s) => {
    ctx.fillStyle = hex(base)
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = hex(furrow)
    ctx.globalAlpha = 0.55
    ctx.lineWidth = 2.4
    for (let y = 6; y < s; y += 12) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(s, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  })
}

/** A soft round glow, white at the centre and gone at the rim — a glint on water, a mote of dust. */
export function glowTexture(): Texture {
  return canvasTexture('g3d-glow', 64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  })
}

function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) || 1
}
