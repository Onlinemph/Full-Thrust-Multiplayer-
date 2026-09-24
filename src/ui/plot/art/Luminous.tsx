import { hashSeed, seededSequence } from '../seeded'
import { BAR_WIDTH, DOT_RADIUS, DOTS_FROM_PX, enginePodCount, enginePods } from './geometry'
import type { ArtProps } from './types'
import { wreckCracks, wreckLayout } from './wreck'

/**
 * Luminous line art: how a counter reads at the zoom a battle opens at and
 * anything smaller (`ART-luminous.md`). A dark, glass-tinted hull with a
 * glowing rim, frame ribs off the ship's own battery rows, turret barbettes
 * and engine-pod rings — chrome on top of `counterSilhouette`'s outline, none
 * of it a filter: every glow is a gradient fill or a wide, faint duplicate
 * stroke of the same shape.
 *
 * `Counter.tsx` wraps this in the crossfade `<g>` and the `scale(shrink)`
 * group is drawn here, matching `Miniature.tsx`'s own.
 */

/**
 * The hull-glass gradient's stops are `currentColor`, not a hardcoded side
 * value, and carry no other per-instance data — so one fixed id, reused by
 * every luminous counter regardless of side or design, does the same job as
 * a `useId()`-unique one without a fresh gradient resource per ship (ships-
 * map's "shared gradients by id per side and style, not per instance").
 * Every counter still draws its own `<defs>` (cheap, and needed since defs
 * aren't otherwise shared across sibling `<g>`s in the same SVG), but they
 * all point at the one logical id.
 */
const HULL_GRAD_ID = 'ft-hull-luminous'

export function LuminousArt(props: ArtProps) {
  return props.destroyed ? <LuminousWreck {...props} /> : <LuminousHull {...props} />
}

function LuminousHull({
  design,
  silhouette,
  extent,
  length,
  isStation,
  isCarrier,
  r,
  shrink,
  damageFraction,
  seedKey,
  cloaked,
}: ArtProps) {
  const { noseY, tailY, halfBeam } = extent

  const guns = renderGuns(silhouette, r)

  if (cloaked) {
    // 7.20: visible to its own side as an outline. None of the new chrome
    // below is drawn — only the dashed hull (plot.css's own `.is-cloaked
    // .hull`), a stroked-only bow chevron (the filled one reads as too much
    // hull for an outline), a dimmed spinal line and the guns/bars plot.css
    // already dims. Same skeleton `Miniature.tsx` short-circuits to.
    return (
      <g transform={`scale(${shrink.toFixed(5)})`}>
        <path className="hull" d={silhouette.path} />
        {silhouette.bow !== '' ? <path className="counter-bow-cloak" d={silhouette.bow} /> : null}
        {silhouette.spine !== null ? (
          <line className="counter-spinal" x1={0} y1={silhouette.spine.y1} x2={0} y2={silhouette.spine.y2} />
        ) : null}
        {guns}
      </g>
    )
  }

  const showDamage = damageFraction > 0.12
  const damageSeed = hashSeed(`${seedKey}-scar`)
  const scarCount = showDamage ? Math.min(3, Math.max(1, Math.round(damageFraction * 4))) : 0
  const scarRolls = showDamage ? seededSequence(damageSeed, scarCount * 3) : []

  const ribs = frameRibs(silhouette, extent, length)

  return (
    <g transform={`scale(${shrink.toFixed(5)})`}>
      <defs>
        {/* Bow-to-stern "glass": a dark tinted volume with a glowing rim,
            not a filled silhouette — the single biggest visual change from
            the plain shaded hull the counter used to draw. */}
        <linearGradient id={HULL_GRAD_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.34" />
          <stop offset="0.55" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.07" />
        </linearGradient>
      </defs>

      {/* The soft luminous halo around the outline: a wide, low-opacity
          duplicate of the hull's own path, not a blur filter. */}
      <path className="counter-hull-glow counter-chrome" d={silhouette.path} />

      <path className="hull" d={silhouette.path} style={{ fill: `url(#${HULL_GRAD_ID})` }} />

      {showDamage ? (
        <>
          <path className="counter-damage-wash" d={silhouette.path} style={{ opacity: Math.min(0.16, damageFraction * 0.2) }} />
          {Array.from({ length: scarCount }, (_, i) => {
            const rx = scarRolls[i * 3] ?? 0.5
            const ry = scarRolls[i * 3 + 1] ?? 0.5
            const rr = scarRolls[i * 3 + 2] ?? 0.5
            const cx = (rx - 0.5) * halfBeam * 1.5
            const cy = noseY + ry * length
            const size = halfBeam * (0.09 + rr * 0.09)
            return (
              <g key={i} className="counter-scar">
                <line x1={cx - size} y1={cy - size} x2={cx + size} y2={cy + size} />
                <line x1={cx - size} y1={cy + size} x2={cx + size} y2={cy - size} />
              </g>
            )
          })}
        </>
      ) : null}

      {/* Frame ribs off the ship's own battery rows (real data), plus two
          cosmetic fore/aft ribs where no row anchors them. */}
      {ribs.map((rib, i) => (
        <line key={i} className="counter-rib counter-chrome" x1={-rib.half} x2={rib.half} y1={rib.y} y2={rib.y} />
      ))}

      {!isStation ? (
        <line
          className="counter-keel counter-chrome"
          x1={0}
          x2={0}
          y1={noseY + length * 0.05}
          y2={tailY - length * 0.04}
        />
      ) : null}

      {silhouette.spine !== null ? (
        <line className="counter-spinal" x1={0} y1={silhouette.spine.y1} x2={0} y2={silhouette.spine.y2} />
      ) : null}

      {!isStation ? (
        <rect
          className="counter-stern-band"
          x={-halfBeam * 0.42}
          y={tailY - length * 0.12}
          width={halfBeam * 0.84}
          height={length * 0.055}
        />
      ) : null}

      {isCarrier ? (
        <>
          <rect
            className="counter-flightdeck"
            x={-halfBeam * 0.09}
            y={noseY + length * 0.22}
            width={halfBeam * 0.18}
            height={Math.max(0, length * 0.58)}
            rx={halfBeam * 0.06}
          />
          {[0.15, 0.38, 0.62, 0.85].map((f, i) => {
            const y = noseY + length * 0.22 + Math.max(0, length * 0.58) * f
            return (
              <line
                key={i}
                className="counter-deck-rung counter-chrome"
                x1={-halfBeam * 0.09}
                x2={halfBeam * 0.09}
                y1={y}
                y2={y}
              />
            )
          })}
        </>
      ) : isStation ? (
        <>
          <circle className="counter-station-ring is-outer counter-chrome" r={halfBeam * 0.78} />
          <circle className="counter-station-ring is-inner counter-chrome" r={halfBeam * 0.52} />
          <rect
            className="counter-bridge counter-chrome"
            x={-halfBeam * 0.11}
            y={-length * 0.0225}
            width={halfBeam * 0.22}
            height={length * 0.045}
          />
        </>
      ) : (
        enginePods(enginePodCount(design), extent, length).map((pod, i) => {
          const ringR = Math.max(20, halfBeam * 0.14)
          return (
            <g key={i} className="counter-chrome">
              <circle className="counter-engine-ring" cx={pod.x} cy={pod.y} r={ringR} />
              <circle className="counter-engine-core" cx={pod.x} cy={pod.y} r={ringR * 0.5} />
            </g>
          )
        })
      )}

      {!isStation && !isCarrier ? (
        <rect
          className="counter-bridge counter-chrome"
          x={-halfBeam * 0.23}
          y={noseY + length * 0.16}
          width={halfBeam * 0.46}
          height={length * 0.045}
        />
      ) : null}
      {isCarrier ? (
        <rect
          className="counter-bridge counter-chrome"
          x={halfBeam * 0.36 - halfBeam * 0.13}
          y={noseY + length * 0.16}
          width={halfBeam * 0.26}
          height={length * 0.045}
        />
      ) : null}

      {silhouette.bow !== '' ? <path className="counter-bow" d={silhouette.bow} /> : null}

      {guns}
    </g>
  )
}

function frameRibs(
  silhouette: ArtProps['silhouette'],
  extent: ArtProps['extent'],
  length: number,
): Array<{ y: number; half: number }> {
  const { noseY, tailY, halfBeam } = extent
  const rows = new Map<number, number>()
  for (const bar of silhouette.bars) {
    const key = Math.round(bar.y)
    const maxAbsX = Math.max(Math.abs(bar.x0), Math.abs(bar.x1))
    const prev = rows.get(key)
    if (prev === undefined || maxAbsX > prev) rows.set(key, maxAbsX)
  }
  const ribs = [...rows.entries()].map(([y, maxAbsX]) => ({
    y,
    half: Math.min(halfBeam * 0.98, maxAbsX * 1.3),
  }))
  const realYs = [...rows.keys()]
  const nearReal = (y: number) => realYs.some((ry) => Math.abs(ry - y) <= length * 0.06)
  const foreY = noseY + length * 0.09
  const aftY = tailY - length * 0.07
  if (!nearReal(foreY)) ribs.push({ y: foreY, half: halfBeam * 0.42 })
  if (!nearReal(aftY)) ribs.push({ y: aftY, half: halfBeam * 0.6 })
  return ribs
}

/** Gun dots (with turret rings) or battery bars (with a glow duplicate), the
    same threshold the app already draws its guns at. Shared between the
    cloaked and lit branches so cloaking never has to re-derive them. */
function renderGuns(silhouette: ArtProps['silhouette'], r: number) {
  if (r >= DOTS_FROM_PX) {
    return (
      <>
        {silhouette.guns.map((gun, i) => (
          <g key={i} className="counter-turret">
            <circle className="counter-turret-ring counter-chrome" cx={gun.x} cy={gun.y} r={DOT_RADIUS * gun.weight * 1.55} />
            <circle className="counter-gun" cx={gun.x} cy={gun.y} r={DOT_RADIUS * gun.weight} />
          </g>
        ))}
        {silhouette.bars
          .filter((bar) => bar.kind === 'bay')
          .map((bar, i) => (
            <line
              key={`bay-${i}`}
              className="counter-battery is-bay"
              x1={bar.x0}
              y1={bar.y}
              x2={bar.x1}
              y2={bar.y}
              strokeWidth={BAR_WIDTH}
            />
          ))}
      </>
    )
  }
  return (
    <>
      {silhouette.bars.map((bar, i) => (
        <g key={i}>
          <line
            className="counter-battery-glow counter-chrome"
            x1={bar.x0}
            y1={bar.y}
            x2={bar.x1}
            y2={bar.y}
            strokeWidth={BAR_WIDTH * bar.weight * 2.1}
          />
          <line
            className={`counter-battery is-${bar.kind}`}
            x1={bar.x0}
            y1={bar.y}
            x2={bar.x1}
            y2={bar.y}
            strokeWidth={BAR_WIDTH * bar.weight}
          />
        </g>
      ))}
    </>
  )
}

function LuminousWreck({ silhouette, extent, shrink, seedKey }: ArtProps) {
  const { tilt, debris } = wreckLayout(seedKey, extent)
  const cracks = wreckCracks(seedKey, extent)
  return (
    <g transform={`rotate(${tilt.toFixed(1)})`}>
      <g className="counter-wreck-drift">
        <g transform={`scale(${shrink.toFixed(5)})`}>
          <path className="hull is-wreck" d={silhouette.path} />
          {cracks.map((c, i) => (
            <line key={i} className="counter-wreck-crack" x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} />
          ))}
          {debris.map((d, i) => (
            <circle key={i} className="counter-debris" cx={d.x} cy={d.y} r={d.r} />
          ))}
        </g>
      </g>
    </g>
  )
}
