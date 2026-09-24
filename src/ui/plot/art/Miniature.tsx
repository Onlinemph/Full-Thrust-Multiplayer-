import { hashSeed, seededSequence } from '../seeded'
import {
  BAR_WIDTH,
  DOT_RADIUS,
  DOTS_FROM_PX,
  chooseBridgeY,
  clamp,
  enginePodCount,
  enginePods,
  gunBearingDegrees,
} from './geometry'
import type { ArtProps } from './types'
import { wreckLayout } from './wreck'

/**
 * Painted miniature: how a counter reads zoomed in (`ART-miniature.md`). A
 * gunmetal hull shaded from the bow, the side colour as rim and markings
 * (bow chevron, engine band, flank pinstripes) bright enough that the side
 * reads at once, turrets at the battery positions with barrels, a bridge
 * tower with a shadow, nacelles, panel lines — none of it a filter, flat
 * fills and two-stop gradients only.
 *
 * Three LOD tiers, driven by the same `r` the app already switches gun dots
 * on at (`DOTS_FROM_PX`): mini (r<15, bars only), mid (bars plus the bridge
 * and nacelles), full (per-gun turrets, panel lines).
 */
export function MiniatureArt(props: ArtProps) {
  return props.destroyed ? <MiniatureWreck {...props} /> : <MiniatureHull {...props} />
}

/**
 * None of these four gradients' stops depend on side, mass or damage — the
 * hull tone is gunmetal regardless of who flies the ship, and the flare is
 * always `--thrust`. So each gets one fixed id, shared by every painted
 * counter in the document rather than a fresh one per instance (ships-map's
 * "shared gradients by id per side and style, not per instance"); only the
 * clip path, which follows the hull's own outline, still needs one per
 * instance below.
 */
const HULL_GRAD_ID = 'ft-hull-miniature'
const CROSS_GRAD_ID = 'ft-cross-miniature'
const FLARE_GRAD_ID = 'ft-flare-miniature'
const TOWER_GRAD_ID = 'ft-tower-miniature'

type Lod = 'mini' | 'mid' | 'full'

function lodOf(r: number): Lod {
  if (r < 15) return 'mini'
  if (r < DOTS_FROM_PX) return 'mid'
  return 'full'
}

function MiniatureHull({
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
  thrusting,
  glowRadius,
  uid,
}: ArtProps) {
  const { noseY, tailY, halfBeam } = extent

  // Unchanged: a cloaked ship is a dashed side-colour outline and nothing
  // else — no fill, no guns, no battery (ART-miniature.md, "Cloaked").
  if (cloaked) {
    return (
      <g transform={`scale(${shrink.toFixed(5)})`}>
        <path className="hull" d={silhouette.path} />
      </g>
    )
  }

  const lod = lodOf(r)
  const clipId = `ft-hull-clip-${uid}`
  const showFlare = thrusting && !isStation
  const showTower = lod !== 'mini' && !isStation
  const showNacelles = lod !== 'mini' && !isStation && !isCarrier
  const showPanels = lod === 'full' && !isStation
  const tenderCount = Math.min(3, design.gunboats.length)

  const showDamage = damageFraction > 0.12
  const damageSeed = hashSeed(`${seedKey}-scar`)
  const scarCount = showDamage ? Math.min(3, Math.max(1, Math.round(damageFraction * 4))) : 0
  const scarRolls = showDamage ? seededSequence(damageSeed, scarCount * 3) : []

  const guns = renderGuns(silhouette, lod)

  return (
    <>
      {showFlare ? (
        <>
          <defs>
            <radialGradient id={FLARE_GRAD_ID}>
              <stop offset="0" stopColor="var(--thrust)" stopOpacity="0.85" />
              <stop offset="0.55" stopColor="var(--thrust)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--thrust)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Placed further aft than the idle glow so it clears the now-opaque
              hull fill instead of hiding under it. */}
          <ellipse
            className="counter-thrust-flare"
            cx={0}
            cy={r * 1.08}
            rx={glowRadius * 0.62}
            ry={glowRadius * 1.35}
            fill={`url(#${FLARE_GRAD_ID})`}
          />
        </>
      ) : null}

      <g transform={`scale(${shrink.toFixed(5)})`}>
        <defs>
          <clipPath id={clipId}>
            <path d={silhouette.path} />
          </clipPath>
          <linearGradient id={HULL_GRAD_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gunmetal-light)" />
            <stop offset="0.45" stopColor="var(--gunmetal-mid)" />
            <stop offset="1" stopColor="var(--gunmetal-dark)" />
          </linearGradient>
          <linearGradient id={CROSS_GRAD_ID} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000000" stopOpacity="0.28" />
            <stop offset="0.5" stopColor="#000000" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.12" />
          </linearGradient>
          {showTower ? (
            <linearGradient id={TOWER_GRAD_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--gunmetal-light)" />
              <stop offset="1" stopColor="var(--gunmetal-panel)" />
            </linearGradient>
          ) : null}
        </defs>

        <path className="hull" d={silhouette.path} style={{ fill: `url(#${HULL_GRAD_ID})` }} />
        <path className="counter-hull-shade" d={silhouette.path} fill={`url(#${CROSS_GRAD_ID})`} />

        {showDamage ? (
          <>
            <path
              className="counter-damage-wash"
              d={silhouette.path}
              style={{ opacity: Math.min(0.32, damageFraction * 0.4) }}
            />
            {Array.from({ length: scarCount }, (_, i) => {
              const rx = scarRolls[i * 3] ?? 0.5
              const ry = scarRolls[i * 3 + 1] ?? 0.5
              const rr = scarRolls[i * 3 + 2] ?? 0.5
              const cx = (rx - 0.5) * halfBeam * 1.5
              const cy = noseY + ry * length
              const rad = halfBeam * (0.08 + rr * 0.14)
              return (
                <g key={i}>
                  <circle className="counter-scorch" cx={cx} cy={cy} r={rad} />
                  <line
                    className="counter-scorch-crack"
                    x1={cx - rad * 0.8}
                    y1={cy - rad * 0.5}
                    x2={cx + rad * 0.8}
                    y2={cy + rad * 0.5}
                  />
                </g>
              )
            })}
          </>
        ) : null}

        {silhouette.bow !== '' ? (
          <polyline
            className="counter-bow-chevron"
            clipPath={`url(#${clipId})`}
            points={`${-halfBeam * 0.3},${noseY + length * 0.03} 0,${noseY + length * 0.1} ${halfBeam * 0.3},${noseY + length * 0.03}`}
            style={{ strokeWidth: length * 0.03 }}
          />
        ) : null}

        {!isStation ? (
          <>
            <rect
              className="counter-stern-band"
              x={-halfBeam * 0.42}
              y={tailY - length * 0.12}
              width={halfBeam * 0.84}
              height={length * 0.055}
            />
            {[-1, 1].map((sign) => (
              <line
                key={sign}
                className="counter-pinstripe"
                clipPath={`url(#${clipId})`}
                x1={sign * halfBeam * 0.78}
                y1={noseY + length * 0.22}
                x2={sign * halfBeam * 0.6}
                y2={tailY - length * 0.18}
                style={{ strokeWidth: length * 0.018 }}
              />
            ))}
          </>
        ) : null}

        {showPanels ? (
          <>
            {[0.28, 0.42, 0.58, 0.74].map((f, i) => {
              const y = noseY + f * length
              return (
                <line
                  key={i}
                  className="counter-panel-line"
                  clipPath={`url(#${clipId})`}
                  x1={-halfBeam * 0.7}
                  x2={halfBeam * 0.7}
                  y1={y}
                  y2={y}
                  style={{ strokeWidth: length * 0.01 }}
                />
              )
            })}
            <line
              className="counter-panel-line is-long"
              clipPath={`url(#${clipId})`}
              x1={-halfBeam * 0.3}
              x2={-halfBeam * 0.3}
              y1={noseY + length * 0.2}
              y2={tailY - length * 0.1}
              style={{ strokeWidth: length * 0.008 }}
            />
            <line
              className="counter-panel-line is-long is-bright"
              clipPath={`url(#${clipId})`}
              x1={halfBeam * 0.3}
              x2={halfBeam * 0.3}
              y1={noseY + length * 0.2}
              y2={tailY - length * 0.1}
              style={{ strokeWidth: length * 0.008 }}
            />
          </>
        ) : null}

        {isCarrier ? (
          <rect
            className="counter-flightdeck"
            x={-halfBeam * 0.09}
            y={noseY + length * 0.22}
            width={halfBeam * 0.18}
            height={Math.max(0, length * 0.58)}
            rx={halfBeam * 0.06}
          />
        ) : isStation ? (
          <circle className="counter-station-facet" r={halfBeam * 0.42} />
        ) : null}

        {tenderCount > 0
          ? Array.from({ length: tenderCount }, (_, i) => {
              const t = tenderCount === 1 ? 0 : (i / (tenderCount - 1)) * 2 - 1
              const x = t * halfBeam * 0.4
              const y = tailY - length * 0.22
              const s = halfBeam * 0.05
              return (
                <polyline
                  key={i}
                  className="counter-tender-tick"
                  points={`${x - s},${y - s} ${x},${y} ${x + s},${y - s}`}
                />
              )
            })
          : null}

        {showTower ? (
          <BridgeTower silhouette={silhouette} extent={extent} length={length} isCarrier={isCarrier} />
        ) : null}

        {showNacelles
          ? enginePods(enginePodCount(design), extent, length).map((pod, i) => {
              const rx = halfBeam * 0.11
              const ry = halfBeam * 0.154
              return (
                <g key={i}>
                  <ellipse
                    className="counter-nacelle-shadow"
                    cx={pod.x}
                    cy={pod.y + ry * 0.3}
                    rx={rx * 0.9}
                    ry={ry * 1.4}
                  />
                  <ellipse className="counter-nacelle" cx={pod.x} cy={pod.y} rx={rx} ry={ry} />
                </g>
              )
            })
          : null}

        {silhouette.spine !== null ? (
          <line
            className="counter-spinal-miniature"
            x1={0}
            y1={silhouette.spine.y1}
            x2={0}
            y2={silhouette.spine.y2}
            style={{ strokeWidth: length * 0.03 }}
          />
        ) : null}

        {silhouette.bow !== '' ? <path className="counter-bow" d={silhouette.bow} /> : null}

        {guns}
      </g>
    </>
  )
}

function BridgeTower({
  silhouette,
  extent,
  length,
  isCarrier,
}: {
  silhouette: ArtProps['silhouette']
  extent: ArtProps['extent']
  length: number
  isCarrier: boolean
}) {
  const { noseY, tailY, halfBeam } = extent
  const candidates = isCarrier
    ? [0.1, 0.14, 0.18, 0.22].map((f) => noseY + f * length)
    : [0.3, 0.24, 0.36, 0.18, 0.42].map((f) => tailY - f * length)
  const { y, clearance } = chooseBridgeY(candidates, silhouette)
  const fit = clamp(clearance / (length * 0.11), 0.55, 1)
  const halfW = halfBeam * 0.3 * fit
  const h = length * 0.16 * fit
  const shadowW = halfW * 2 * 1.8
  const shadowH = h * 0.22
  return (
    <g>
      <rect
        className="counter-bridge-shadow"
        x={-shadowW / 2}
        y={y + h / 2 - shadowH * 0.3}
        width={shadowW}
        height={shadowH}
        rx={halfW * 0.15}
      />
      <rect
        className="counter-bridge-tower"
        x={-halfW}
        y={y - h / 2}
        width={halfW * 2}
        height={h}
        rx={halfW * 0.22}
        style={{ fill: `url(#${TOWER_GRAD_ID})` }}
      />
      <line className="counter-bridge-window" x1={-halfW * 0.7} x2={halfW * 0.7} y1={y - h / 2 + h * 0.33} y2={y - h / 2 + h * 0.33} />
    </g>
  )
}

/** Per-gun turrets with barrels at full LOD, bars everywhere else — the same
    battery bars the app has always drawn, just recoloured gunmetal by CSS. */
function renderGuns(silhouette: ArtProps['silhouette'], lod: Lod) {
  if (lod !== 'full') {
    return (
      <>
        {silhouette.bars.map((bar, i) => (
          <line
            key={i}
            className={`counter-battery is-${bar.kind}`}
            x1={bar.x0}
            y1={bar.y}
            x2={bar.x1}
            y2={bar.y}
            strokeWidth={BAR_WIDTH * bar.weight}
          />
        ))}
      </>
    )
  }
  return (
    <>
      {silhouette.guns.map((gun, i) => {
        const angle = gunBearingDegrees(gun.x, gun.y)
        const gr = DOT_RADIUS * gun.weight * 1.05
        const barrelLen = gr * 1.15
        return (
          <g key={i} transform={`translate(${gun.x} ${gun.y}) rotate(${angle.toFixed(1)})`}>
            <circle className="counter-turret-shadow" cx={gr * 0.15} cy={gr * 0.15} r={gr * 0.9} />
            <rect className="counter-turret-barrel" x={-gr * 0.2} y={-barrelLen} width={gr * 0.4} height={barrelLen} />
            <circle className="counter-turret-ring" r={gr} style={{ strokeWidth: gr * 0.22 }} />
          </g>
        )
      })}
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

function MiniatureWreck({ silhouette, extent, length, shrink, seedKey }: ArtProps) {
  const { tilt, debris } = wreckLayout(seedKey, extent)
  const { noseY, halfBeam } = extent
  return (
    <g transform={`rotate(${tilt.toFixed(1)})`}>
      <g className="counter-wreck-drift">
        <g transform={`scale(${shrink.toFixed(5)})`}>
          <path className="hull is-wreck" d={silhouette.path} />
          <path className="counter-wreck-wash" d={silhouette.path} />
          {debris.map((d, i) => (
            <circle key={i} className="counter-debris" cx={d.x} cy={d.y} r={d.r} />
          ))}
          <circle className="counter-ember is-outer" cx={0} cy={noseY + length * 0.5} r={halfBeam * 0.22} />
          <circle className="counter-ember is-inner" cx={0} cy={noseY + length * 0.5} r={halfBeam * 0.09} />
        </g>
      </g>
    </g>
  )
}
