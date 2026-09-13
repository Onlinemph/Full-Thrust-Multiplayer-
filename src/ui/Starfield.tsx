import { useMemo } from 'react'

/**
 * The sky behind the table.
 *
 * Decoration, and it knows it: nothing here is read by a rule, which is why it
 * is allowed to be pretty. Two fields of stars at different depths, so panning
 * the table has parallax and the void reads as deep rather than painted; a few
 * faint nebulae in the plot's own colours; and every one of them seeded from
 * the battle's seed, so the same battle has the same sky on both consoles and
 * in every replay. Stars are sized in pixels, not MU, so zooming in on a
 * dogfight does not zoom in on a star.
 */

export interface StarfieldProps {
  seed: number
  table: { width: number; height: number }
  /** Pixels per MU. */
  scale: number
  originX: number
  originY: number
}

interface Star {
  x: number
  y: number
  r: number
  /** 0–1: how bright. */
  glow: number
  twinkle: number
  /** Most stars are white; a few run warm or cool, which is what a real sky does. */
  tint: '' | ' is-warm' | ' is-cool'
}

interface Nebula {
  x: number
  y: number
  rx: number
  ry: number
  /** Degrees; a nebula is a smear, not a disc. */
  tilt: number
  hue: string
  opacity: number
}

interface Band {
  /** Degrees. */
  tilt: number
  /** Where along the table's height its centre line crosses, 0–1. */
  at: number
  /** Half-thickness, as a fraction of the table's height. */
  half: number
}

/** A small seeded generator: enough for a sky, and the same sky every time. */
function lcg(seed: number): () => number {
  let state = (seed >>> 0) || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

/** How far past the table's edge the sky is painted, as a fraction of it. */
const OVERHANG = 0.9

function sky(seed: number, table: { width: number; height: number }) {
  const rand = lcg(seed ^ 0x5741_5253)
  const w = table.width * (1 + OVERHANG * 2)
  const h = table.height * (1 + OVERHANG * 2)
  const x0 = -table.width * OVERHANG
  const y0 = -table.height * OVERHANG
  const area = w * h

  // A galactic band: the stars thicken along it, which is what makes a sky
  // read as a sky rather than as noise.
  const band: Band = { tilt: -35 + rand() * 70, at: 0.25 + rand() * 0.5, half: 0.16 + rand() * 0.1 }
  const bandRad = (band.tilt * Math.PI) / 180
  const bandDistance = (x: number, y: number) => {
    const cx = table.width / 2
    const cy = table.height * band.at
    // Signed distance from the band's centre line, in table heights.
    return Math.abs(-(x - cx) * Math.sin(bandRad) + (y - cy) * Math.cos(bandRad)) / table.height
  }
  const place = (): { x: number; y: number } => {
    // Rejection-sample toward the band: a star off it has a fair chance of
    // being thrown back and drawn again, so the band ends up two to three
    // times as dense as the open sky without a hard edge anywhere.
    for (let tries = 0; tries < 3; tries += 1) {
      const x = x0 + rand() * w
      const y = y0 + rand() * h
      const d = bandDistance(x, y)
      if (d < band.half || rand() < 0.45) return { x, y }
    }
    return { x: x0 + rand() * w, y: y0 + rand() * h }
  }

  const near: Star[] = []
  const far: Star[] = []
  const nearCount = Math.min(900, Math.max(260, Math.round(area * 0.04)))
  const farCount = Math.min(1500, Math.max(400, Math.round(area * 0.07)))
  for (let i = 0; i < nearCount; i += 1) {
    const glow = rand() ** 1.8
    const roll = rand()
    near.push({
      ...place(),
      r: 0.7 + glow * 1.7,
      glow,
      twinkle: rand() < 0.12 ? 1.6 + rand() * 4 : 0,
      tint: roll < 0.12 ? ' is-warm' : roll < 0.26 ? ' is-cool' : '',
    })
  }
  for (let i = 0; i < farCount; i += 1) {
    far.push({ ...place(), r: 0.45 + rand() * 0.65, glow: rand() * 0.6, twinkle: 0, tint: '' })
  }

  // Nebulae are placed on or just off the table — the sky beyond it is only
  // seen by a player who pans away from the battle — and no two share a hue.
  const hues = ['var(--side-a)', 'var(--side-c)', 'var(--screens)', 'var(--ordnance)', '#ffb877']
  const nebulae: Nebula[] = Array.from({ length: 3 + Math.floor(rand() * 2) }, (_, i) => ({
    x: table.width * (-0.25 + rand() * 1.5),
    y: table.height * (-0.25 + rand() * 1.5),
    rx: table.width * (0.22 + rand() * 0.3),
    ry: table.height * (0.16 + rand() * 0.26),
    tilt: -60 + rand() * 120,
    hue: hues[(i + Math.floor(rand() * 2)) % hues.length],
    opacity: 0.26 + rand() * 0.14,
  }))

  return { near, far, nebulae, band }
}

/** The far field pans at this fraction of the table: it is further away. */
const FAR_PARALLAX = 0.55

export function Starfield({ seed, table, scale, originX, originY }: StarfieldProps) {
  const { near, far, nebulae, band } = useMemo(() => sky(seed, table), [seed, table.width, table.height])
  const id = `sky-${(seed >>> 0).toString(36)}`
  const bandLength = Math.hypot(table.width, table.height) * (1 + OVERHANG * 2) * scale

  return (
    <g className="starfield" aria-hidden="true">
      <defs>
        {nebulae.map((nebula, i) => (
          <radialGradient key={i} id={`${id}-n${i}`}>
            <stop offset="0" stopColor={nebula.hue} stopOpacity={nebula.opacity} />
            <stop offset="0.3" stopColor={nebula.hue} stopOpacity={nebula.opacity * 0.6} />
            <stop offset="0.65" stopColor={nebula.hue} stopOpacity={nebula.opacity * 0.18} />
            <stop offset="1" stopColor={nebula.hue} stopOpacity={0} />
          </radialGradient>
        ))}
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9d6ff" stopOpacity={0} />
          <stop offset="0.35" stopColor="#c9d6ff" stopOpacity={0.09} />
          <stop offset="0.5" stopColor="#c9d6ff" stopOpacity={0.15} />
          <stop offset="0.65" stopColor="#c9d6ff" stopOpacity={0.09} />
          <stop offset="1" stopColor="#c9d6ff" stopOpacity={0} />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.55} />
          <stop offset="0.35" stopColor="#dfe8ff" stopOpacity={0.18} />
          <stop offset="1" stopColor="#dfe8ff" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* The far field, panned less than the table so it sits behind it. */}
      <g transform={`translate(${(originX * FAR_PARALLAX).toFixed(1)} ${(originY * FAR_PARALLAX).toFixed(1)})`}>
        {far.map((star, i) => (
          <circle
            key={i}
            className="star is-far"
            cx={(star.x * scale * FAR_PARALLAX).toFixed(1)}
            cy={(star.y * scale * FAR_PARALLAX).toFixed(1)}
            r={star.r}
            style={{ opacity: 0.3 + star.glow * 0.6 }}
          />
        ))}
      </g>

      <g transform={`translate(${originX.toFixed(1)} ${originY.toFixed(1)})`}>
        {/* The galactic band and the nebulae: one soft wash, drawn with
            gradients rather than a blur filter, because a filter is
            re-rasterised on every pan and this has to stay cheap. They go
            under the near stars and over the far ones, so the far field reads
            as dust behind the glow. */}
        <g className="sky-wash">
          <rect
            className="sky-band"
            x={((table.width / 2) * scale - bandLength / 2).toFixed(1)}
            y={(table.height * (band.at - band.half * 1.6) * scale).toFixed(1)}
            width={bandLength.toFixed(1)}
            height={(table.height * band.half * 3.2 * scale).toFixed(1)}
            fill={`url(#${id}-band)`}
            transform={`rotate(${band.tilt.toFixed(1)} ${((table.width / 2) * scale).toFixed(1)} ${(table.height * band.at * scale).toFixed(1)})`}
          />
          {nebulae.map((nebula, i) => (
            <ellipse
              key={i}
              className="nebula"
              cx={(nebula.x * scale).toFixed(1)}
              cy={(nebula.y * scale).toFixed(1)}
              rx={(nebula.rx * scale).toFixed(1)}
              ry={(nebula.ry * scale).toFixed(1)}
              transform={`rotate(${nebula.tilt.toFixed(1)} ${(nebula.x * scale).toFixed(1)} ${(nebula.y * scale).toFixed(1)})`}
              fill={`url(#${id}-n${i})`}
            />
          ))}
        </g>
        {/* Bright stars get a halo: a soft disc a few pixels wide under the
            point, which is what a bright star looks like to an eye. */}
        {near
          .filter((star) => star.glow > 0.62)
          .map((star, i) => (
            <circle
              key={`h${i}`}
              className="star-halo"
              cx={(star.x * scale).toFixed(1)}
              cy={(star.y * scale).toFixed(1)}
              r={(4 + star.glow * 7).toFixed(1)}
              fill={`url(#${id}-halo)`}
            />
          ))}
        {near.map((star, i) => (
          <circle
            key={i}
            className={`star${star.tint}${star.glow > 0.7 ? ' is-bright' : ''}${star.twinkle > 0 ? ' is-twinkling' : ''}`}
            cx={(star.x * scale).toFixed(1)}
            cy={(star.y * scale).toFixed(1)}
            r={star.r}
            style={{
              opacity: 0.5 + star.glow * 0.5,
              animationDuration: star.twinkle > 0 ? `${star.twinkle.toFixed(2)}s` : undefined,
              animationDelay: star.twinkle > 0 ? `${(-star.x % 3).toFixed(2)}s` : undefined,
            }}
          />
        ))}
      </g>
    </g>
  )
}
