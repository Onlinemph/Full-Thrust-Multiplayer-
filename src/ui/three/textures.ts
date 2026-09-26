/**
 * Small procedural textures shared across the 3D layers, drawn once on a
 * canvas and cached. No image files: everything here is a gradient the view
 * can make for itself, so the lazy 3D chunk carries no assets.
 *
 * STAGE 2 (WORLD): `glowTexture`/`flareTexture` are done — every layer wants
 * the same soft dot and four-point flare. `cloudTexture` is a placeholder
 * blob good enough for a dust cloud or nebula billboard to read as haze; add
 * whatever `worldTexture`/`beamTexture` (planet bands, gas-giant storms, a
 * bolt's core) `terrain.ts`/`ordnance.ts`/`effects.ts` end up wanting, cached
 * by `canvasTexture` the same way.
 */
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

const cache = new Map<string, Texture>()

export function canvasTexture(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): Texture {
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  draw(canvas.getContext('2d')!, size)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.userData.shared = true
  cache.set(key, tex)
  return tex
}

/** A soft round glow, white at the centre and gone at the rim. For sprites and point sprites alike. */
export function glowTexture(): Texture {
  return canvasTexture('glow', 128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.18, 'rgba(255,255,255,0.85)')
    g.addColorStop(0.45, 'rgba(255,255,255,0.25)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  })
}

/** A four-point star flare, for the brightest stars and for muzzle flashes. */
export function flareTexture(): Texture {
  return canvasTexture('flare', 128, (ctx, s) => {
    const c = s / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.5)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    ctx.globalCompositeOperation = 'lighter'
    for (const [w, h] of [
      [s, 3],
      [3, s],
    ]) {
      const lg = ctx.createLinearGradient(c - w / 2, c - h / 2, c + w / 2, c + h / 2)
      lg.addColorStop(0, 'rgba(255,255,255,0)')
      lg.addColorStop(0.5, 'rgba(255,255,255,0.9)')
      lg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = lg
      ctx.fillRect(c - w / 2, c - h / 2, w, h)
    }
  })
}

/**
 * PLACEHOLDER (stage 2, WORLD): soft cloudy noise for a dust cloud or nebula
 * billboard — layered blurred blobs, not true noise, seeded so the same
 * `seed` always draws the same puff.
 */
export function cloudTexture(seed = 1): Texture {
  return canvasTexture(`cloud${seed}`, 256, (ctx, s) => {
    let x = seed * 9301 + 49297
    const rand = () => {
      x = (x * 9301 + 49297) % 233280
      return x / 233280
    }
    ctx.clearRect(0, 0, s, s)
    for (let i = 0; i < 10; i++) {
      const cx = s * (0.2 + rand() * 0.6)
      const cy = s * (0.2 + rand() * 0.6)
      const r = s * (0.14 + rand() * 0.22)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      const a = 0.25 + rand() * 0.35
      g.addColorStop(0, `rgba(255,255,255,${a})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}
