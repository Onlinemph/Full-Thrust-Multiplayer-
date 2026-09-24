import { useId } from 'react'

import type { OrdnanceMarkerState } from '../engine/game'
import { courseToDegrees } from '../engine/geometry'

/**
 * A marker on the table, drawn as what it is (6.3, 6.6, 6.7, 6.8, 6.9).
 *
 * A missile marker is a dart pointing the way it flew — one per missile left
 * on a salvo, so a salvo that point defence has thinned reads as thinner; one
 * for a Heavy Missile; one inside the blast ring for an antimatter warhead;
 * one per rocket that hit. The tail flare carries the owning side's colour.
 * A mine is laid and left and a plasma bolt is a place rather than a thing on
 * its way somewhere, so neither is a dart.
 */

/** A dart pointing up the page: nose at −7, fins at +4, a notch at the tail. */
const DART = 'M0,-7 L3.2,4 L0,2.2 L-3.2,4 Z'
/** The exhaust behind it. */
const FLARE = 'M0,2.6 L1.5,6.8 L-1.5,6.8 Z'

/**
 * Where each dart of a cluster sits: two columns, the odd one out on the
 * centre line, nose first.
 */
function cluster(count: number): Array<{ x: number; y: number }> {
  const n = Math.max(1, Math.min(6, count))
  const rows = Math.ceil(n / 2)
  const out: Array<{ x: number; y: number }> = []
  for (let i = 0; i < n; i += 1) {
    const row = Math.floor(i / 2)
    const alone = i === n - 1 && n % 2 === 1
    out.push({ x: alone ? 0 : i % 2 === 0 ? -4 : 4, y: (row - (rows - 1) / 2) * 7.5 })
  }
  return out
}

export function OrdnanceGlyph({ marker, scale }: { marker: OrdnanceMarkerState; scale: number }) {
  const uid = useId()
  const x = marker.position.x * scale
  const y = marker.position.y * scale
  const className = `missile-marker is-${marker.kind} side-${marker.side}`
  if (marker.kind === 'mine') return <circle className={className} cx={x} cy={y} r={3} />
  if (marker.kind === 'plasma-bolt') return <circle className={className} cx={x} cy={y} r={5} />

  const heading = courseToDegrees(marker.facing ?? 12)
  const darts =
    marker.kind === 'salvo'
      ? cluster(marker.missiles)
      : marker.kind === 'rocket'
        ? cluster(Math.min(2, marker.missiles))
        : [{ x: 0, y: 0 }]
  // Pixel-sized, not MU: a marker this small is otherwise a handful of pixels
  // lost against the starfield at any zoom (screens #3), which is a real
  // gameplay problem — point defence and dogfights both depend on spotting it.
  const size =
    marker.kind === 'salvo' ? 1.1 : marker.kind === 'rocket' ? 1.25 : marker.kind === 'heavy' ? 2.1 : 1.7
  const haloId = `ordnance-halo-${uid}`
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${heading})`}>
      <defs>
        <radialGradient id={haloId}>
          <stop offset="0" stopColor="var(--ordnance)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--ordnance)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* A soft halo behind the dart rather than a drop-shadow filter — cheap
          to redraw every time the plot pans, unlike a blurred filter would be. */}
      {darts.map((dart, index) => (
        <circle
          key={`halo-${index}`}
          className="missile-halo"
          cx={dart.x}
          cy={dart.y + 2}
          r={7 * size}
          fill={`url(#${haloId})`}
        />
      ))}
      {marker.kind === 'antimatter' ? <circle className="missile-warhead" r={10} /> : null}
      {darts.map((dart, index) => (
        <g key={index} transform={`translate(${dart.x} ${dart.y}) scale(${size})`}>
          <path className="missile-flare" d={FLARE} />
          <path className="missile-dart" d={DART} />
        </g>
      ))}
    </g>
  )
}
