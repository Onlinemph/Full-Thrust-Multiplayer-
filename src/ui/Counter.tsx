import { useId } from 'react'

import { courseToDegrees } from '../engine/geometry'
import type { Course, Point, ShipDesign } from '../engine/types'
import { hullExtent } from './plot/hullExtent'
import { hashSeed, seededSequence } from './plot/seeded'
import { COUNTER_EXTENT, counterSilhouette } from './ssd/layout'

/**
 * A ship counter on the plotting surface.
 *
 * The same hull as the ship's own sheet, at a twentieth of the size. Not a
 * likeness of it and not a second drawing of the same idea: `counterSilhouette`
 * runs the same layout the sheet does and hands back the same outline, so a
 * ship that reads as a long streamlined needle on paper reads as one on the
 * table, a broadside ship carries its sponsons, a carrier its flight deck, and
 * a starbase reads as the octagon it is drawn as.
 *
 * The guns come with it. At the size a counter usually is, each battery is a
 * bar across the hull where the sheet drew its row — a bow battery a bar at
 * the bow, a broadside a bar down each flank — and once the map is zoomed in
 * far enough for a dot per gun to mean something, it is dots per gun. The bow
 * is filled in whatever the size, because which way it points is the one thing
 * a player must never have to guess (3.1, 4.2, 4.10).
 *
 * On top of the outline: a bow-to-stern shade, a rim in the side's own colour,
 * a stern band and deckplating, a class cue (a carrier's flight deck, an
 * engine-pod count, a station's dashed rim), an engine glow scaled by thrust,
 * damage as scorch marks and a health ring, a screens halo, wreckage once
 * destroyed, and a selection ring — none of it a filter: every glow here is a
 * gradient-filled circle or a wide, faint stroke, because the plot pans and
 * re-renders and a blur filter would be re-rasterised every time it does.
 *
 * Presentational and prop-driven: it knows nothing about game state, so the
 * map, the fleet picker and the designer can all draw the same counter.
 */
export interface CounterProps {
  position: Point
  facing: Course
  side: 'a' | 'b' | 'c'
  /** The hull. Its mass sets the counter's size (2.3), its build the shape. */
  design: ShipDesign
  label?: string
  /** A second line under the name — the speed of a ship whose orders are hidden. */
  note?: string
  selected?: boolean
  destroyed?: boolean
  /** Drawn as an outline: visible to its own side, not to the enemy (7.20). */
  cloaked?: boolean
  /**
   * Rolled 180° on its long axis (16.2): *"a marker is placed by the model to
   * indicate its inverted condition"*. Here the marker is a bar across the
   * hull, because the one thing it has to say is that this ship's port guns
   * are firing to starboard.
   */
  inverted?: boolean
  /** Pixels per MU, from the map's zoom. */
  scale: number
  /** Custom counter art, drawn nose-up and fitted to the counter. */
  art?: string
  onClick?: () => void
  /** Hull boxes marked of the total (0–1): the scorch marks and the health ring. */
  damageFraction?: number
  /** 7.20's screens, already worked out by the caller (effectiveScreenLevel). */
  screenLevel?: 0 | 1 | 2
}

/**
 * Counter size in MU from hull mass.
 *
 * Two constraints fix this. It must be compressed — mass runs from about 10 to
 * 300 in play and a counter thirty times another's size would be unusable — and
 * it must stay small against the ranges, because a counter that reads as
 * several MU across makes a 12 MU range band look like nothing. The cube root
 * handles the first; the coefficient handles the second, putting a mass-20
 * frigate at about 1.2 MU and a mass-300 dreadnought at about 3, which is
 * roughly what the miniatures look like on a real table.
 */
export function counterRadius(mass: number): number {
  return 0.45 * Math.cbrt(Math.max(1, mass))
}

/**
 * Below this many screen pixels of half-length, a hull stops reading as a
 * miniature and starts reading as a fleck — so the smallest hull in play is
 * never drawn smaller than this, the way the Dirtside map keeps its lettering
 * a fixed pixel size instead of letting it shrink to nothing. Bigger hulls are
 * boosted by the same factor, so a cruiser still reads bigger than a frigate;
 * the boost falls away to nothing once the player has zoomed in past it, and
 * the drawn counter stays a marker throughout — nothing in FT's movement or
 * fire measures its size, only the ship's own position.
 */
export const MIN_COUNTER_PIXEL_RADIUS = 11
/** `counterRadius`'s own documented floor: "mass runs from about 10 ... ". */
const REFERENCE_MIN_MASS = 10

/** The radius a hull is actually drawn at, in screen pixels, floor included. */
export function counterScreenRadius(mass: number, scale: number): number {
  const trueMinRadius = counterRadius(REFERENCE_MIN_MASS) * scale
  const boost = trueMinRadius > 0 ? Math.max(1, MIN_COUNTER_PIXEL_RADIUS / trueMinRadius) : 1
  return counterRadius(mass) * scale * boost
}

/**
 * Below this many pixels of half-length, a dot per gun is a smear and the
 * batteries are drawn as bars instead.
 */
const DOTS_FROM_PX = 34
/** A gun's dot and a battery's bar, in the counter's ±1000 box. */
const DOT_RADIUS = 58
const BAR_WIDTH = 95

/** 1/2/3 engine pods for escort/cruiser/capital-and-up (ships-map #4). */
function enginePodCount(design: ShipDesign): number {
  if (design.group === 'escort') return 1
  if (design.group === 'cruiser') return 2
  return 3
}

export function Counter({
  position,
  facing,
  side,
  design,
  label,
  note,
  selected = false,
  destroyed = false,
  cloaked = false,
  inverted = false,
  scale,
  art,
  onClick,
  damageFraction,
  screenLevel = 0,
}: CounterProps) {
  const uid = useId()
  const r = counterScreenRadius(design.mass, scale)
  const x = position.x * scale
  const y = position.y * scale
  const silhouette = counterSilhouette(design)
  const shrink = r / COUNTER_EXTENT
  const extent = hullExtent(silhouette)
  const length = Math.max(1, extent.tailY - extent.noseY)
  const isStation = silhouette.radial
  const isCarrier = design.fighterBays.length > 0
  const thrust = design.drive.thrust

  const classes = ['counter', `side-${side}`]
  if (selected) classes.push('is-selected')
  if (destroyed) classes.push('is-destroyed')
  if (cloaked) classes.push('is-cloaked')
  if (inverted) classes.push('is-inverted')
  if (isStation) classes.push('is-radial')

  const hullGrad = `counter-hull-${uid}`
  const glowGrad = `counter-glow-${uid}`

  const showGlow = !destroyed && !isStation && thrust > 0
  const glowRadius = r * (0.24 + Math.min(1, thrust / 6) * 0.3)

  const showDamage = !destroyed && (damageFraction ?? 0) > 0.12
  const damageSeed = hashSeed(`${label ?? design.id}-scar`)
  const scarCount = showDamage ? Math.min(3, Math.max(1, Math.round((damageFraction ?? 0) * 4))) : 0
  const scarRolls = showDamage ? seededSequence(damageSeed, scarCount * 3) : []

  const showHealthRing = !destroyed && (damageFraction ?? 0) > 0.02
  const healthRemain = Math.max(0, 1 - (damageFraction ?? 0))
  const healthRadius = r * 1.16
  const healthCircumference = 2 * Math.PI * healthRadius
  const healthDash = healthRemain * healthCircumference
  const healthColor =
    healthRemain > 0.5 ? 'var(--hull)' : healthRemain > 0.25 ? 'var(--warn)' : 'var(--damage)'

  const showScreens = !destroyed && screenLevel > 0

  return (
    <g
      className={classes.join(' ')}
      transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${courseToDegrees(facing)})`}
      onClick={onClick}
      role={onClick ? 'button' : 'img'}
      aria-label={
        label
          ? `${label}, facing ${facing} o'clock${inverted ? ', inverted' : ''}`
          : undefined
      }
      tabIndex={onClick ? 0 : undefined}
    >
      <defs>
        {/* Bow-bright, stern-dim: objectBoundingBox maps to whatever the hull
            path's own box is, so this needs no hull geometry of its own — it
            fades along whichever axis is "down" in the path's own box, which
            `hullPath` always draws nose-up. The dark table underneath does
            the rest of the shading once the fill thins out near the stern. */}
        <linearGradient id={hullGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`var(--side-${side})`} stopOpacity="1" />
          <stop offset="1" stopColor={`var(--side-${side})`} stopOpacity="0.42" />
        </linearGradient>
        {showGlow ? (
          <radialGradient id={glowGrad}>
            <stop offset="0" stopColor="var(--counter-glow)" stopOpacity="0.65" />
            <stop offset="0.55" stopColor="var(--counter-glow)" stopOpacity="0.2" />
            <stop offset="1" stopColor="var(--counter-glow)" stopOpacity="0" />
          </radialGradient>
        ) : null}
      </defs>

      {/* The selection ring: drawn first, so it sits behind the hull. Two
          circles rather than a blur filter — a crisp one in the side's own
          colour and a wider, fainter duplicate underneath for the glow. */}
      {selected ? (
        <>
          <circle className="counter-select-ring is-soft" r={r + 10} />
          <circle className="counter-select-ring is-crisp" r={r + 6} />
        </>
      ) : null}

      {/* 7.20's screens: a dashed ring just outside the hull, in the one
          colour that already means exactly this everywhere else on the sheet. */}
      {showScreens ? (
        <circle
          className={`counter-screens-halo is-level-${screenLevel}`}
          r={r * 1.34 + screenLevel * 4}
        />
      ) : null}

      {/* Engine glow, sized by thrust rating (ships-map #2): a gradient-filled
          circle behind the hull, not a blurred filter — it costs nothing more
          to re-render than any other shape on the plot. */}
      {showGlow ? (
        <circle className="counter-exhaust" cx={0} cy={r * 0.82} r={glowRadius} fill={`url(#${glowGrad})`} />
      ) : null}

      {destroyed ? (
        <WreckGeometry silhouette={silhouette} seedKey={label ?? design.id} shrink={shrink} extent={extent} />
      ) : art ? (
        <>
          <image
            href={art}
            x={-r}
            y={-r}
            width={r * 2}
            height={r * 2}
            preserveAspectRatio="xMidYMid meet"
          />
          {/* Custom art has no path of its own to tint, so damage here is a
              soft, low-opacity wash rather than the hull-fitted one below. */}
          {showDamage ? (
            <ellipse
              className="counter-damage-wash"
              rx={r * 0.55}
              ry={r * 0.92}
              style={{ opacity: Math.min(0.3, (damageFraction ?? 0) * 0.36) }}
            />
          ) : null}
        </>
      ) : (
        <g transform={`scale(${shrink.toFixed(5)})`}>
          <path className="hull" d={silhouette.path} style={{ fill: `url(#${hullGrad})` }} />

          {/* Damage as scorch marks and a dimmed hull (ships-map #5): a wash
              fitted to the hull's own path, plus a scatter of blotches within
              its own length and beam — both the frozen --damage token, used
              for exactly its documented meaning. Low-key on purpose: a ship
              that has taken real damage should still read as a ship. */}
          {showDamage ? (
            <>
              <path
                className="counter-damage-wash"
                d={silhouette.path}
                style={{ opacity: Math.min(0.32, (damageFraction ?? 0) * 0.4) }}
              />
              {Array.from({ length: scarCount }, (_, i) => {
                const rx = scarRolls[i * 3] ?? 0.5
                const ry = scarRolls[i * 3 + 1] ?? 0.5
                const rr = scarRolls[i * 3 + 2] ?? 0.5
                return (
                  <circle
                    key={i}
                    className="counter-scorch"
                    cx={(rx - 0.5) * extent.halfBeam * 1.5}
                    cy={extent.noseY + ry * length}
                    r={extent.halfBeam * (0.08 + rr * 0.14)}
                  />
                )
              })}
            </>
          ) : null}

          {!isStation ? (
            <>
              {/* The hull marking a real ship would carry: the strongest, purest
                  hit of side colour, exactly at the stern (ships-map #1). */}
              <rect
                className="counter-stern-band"
                x={-extent.halfBeam * 0.42}
                y={extent.tailY - length * 0.12}
                width={extent.halfBeam * 0.84}
                height={length * 0.055}
              />
              {/* Two faint deckplating seams, so the fill reads as plating
                  rather than a flat tint. */}
              <line
                className="counter-deckline"
                x1={-extent.halfBeam * 0.72}
                x2={extent.halfBeam * 0.72}
                y1={extent.noseY + length * 0.4}
                y2={extent.noseY + length * 0.4}
              />
              <line
                className="counter-deckline"
                x1={-extent.halfBeam * 0.6}
                x2={extent.halfBeam * 0.6}
                y1={extent.noseY + length * 0.66}
                y2={extent.noseY + length * 0.66}
              />
            </>
          ) : null}

          {/* Class cues (ships-map #4): a carrier's flight deck, or an
              engine-pod count for everyone else — a station has neither, its
              dashed rim (in CSS, `.is-radial .hull`) is cue enough. */}
          {isCarrier ? (
            <rect
              className="counter-flightdeck"
              x={-extent.halfBeam * 0.09}
              y={extent.noseY + length * 0.22}
              width={extent.halfBeam * 0.18}
              height={Math.max(0, length * 0.58)}
              rx={extent.halfBeam * 0.06}
            />
          ) : !isStation ? (
            enginePods(enginePodCount(design), extent, length).map((pod, i) => (
              <circle key={i} className="counter-engine-pod" cx={pod.x} cy={pod.y} r={34} />
            ))
          ) : null}

          {silhouette.bow !== '' ? <path className="counter-bow" d={silhouette.bow} /> : null}
          {silhouette.spine !== null ? (
            <line
              className="counter-spinal"
              x1={0}
              y1={silhouette.spine.y1}
              x2={0}
              y2={silhouette.spine.y2}
            />
          ) : null}
          {/* A gun is drawn the size the sheet drew it: a Beam-4 is a dot
              twice the area of a Beam-1, and a battery of big guns is a
              heavier bar than a battery of small ones. */}
          {r >= DOTS_FROM_PX
            ? silhouette.guns.map((gun, i) => (
                <circle
                  key={i}
                  className="counter-gun"
                  cx={gun.x}
                  cy={gun.y}
                  r={(DOT_RADIUS * gun.weight).toFixed(0)}
                />
              ))
            : silhouette.bars.map((bar, i) => (
                <line
                  key={i}
                  className={`counter-battery is-${bar.kind}`}
                  x1={bar.x0}
                  y1={bar.y}
                  x2={bar.x1}
                  y2={bar.y}
                  strokeWidth={(BAR_WIDTH * bar.weight).toFixed(0)}
                />
              ))}
          {r >= DOTS_FROM_PX
            ? silhouette.bars
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
                ))
            : null}
        </g>
      )}

      {/* The health ring (battle-ui #3): a sweep proportional to hull boxes
          remaining, three tiers of the sheet's own damage-state colours. */}
      {showHealthRing ? (
        <circle
          className="counter-health-ring"
          r={healthRadius}
          transform="rotate(-90)"
          style={{
            stroke: healthColor,
            strokeDasharray: `${healthDash.toFixed(1)} ${healthCircumference.toFixed(1)}`,
          }}
        />
      ) : null}

      {!destroyed && inverted ? (
        /* A bar across the beam. It rotates with the hull on purpose: the bar
           lies along the axis the ship has turned over about, which is the
           thing being marked (16.2). */
        <line
          className="counter-inverted"
          x1={(-r * 0.95).toFixed(2)}
          y1={(r * 0.15).toFixed(2)}
          x2={(r * 0.95).toFixed(2)}
          y2={(r * 0.15).toFixed(2)}
        />
      ) : null}
      {!destroyed && label ? (
        /* Counter-rotated, so the name stays horizontal however the ship is
           heading — a label that turns with the hull is unreadable. */
        <text
          className="counter-label"
          transform={`rotate(${-courseToDegrees(facing)})`}
          y={r + 11}
          textAnchor="middle"
        >
          {label}
        </text>
      ) : null}
      {!destroyed && note ? (
        <text
          className="counter-note"
          transform={`rotate(${-courseToDegrees(facing)})`}
          y={r + 22}
          textAnchor="middle"
        >
          {note}
        </text>
      ) : null}
    </g>
  )
}

function enginePods(
  count: number,
  extent: { tailY: number; halfBeam: number },
  length: number,
): Array<{ x: number; y: number }> {
  const podY = extent.tailY - length * 0.05
  const spread = extent.halfBeam * 0.5
  return Array.from({ length: count }, (_, i) => ({
    x: count === 1 ? 0 : (i / (count - 1)) * 2 * spread - spread,
    y: podY,
  }))
}

/**
 * Destroyed reads as wreckage, not a faded copy of the living ship
 * (ships-map #6): the same outline, dashed and rotated a little, no bow, no
 * guns, no battery — a wreck has no facing that matters — and a handful of
 * debris flecks at fixed offsets, so it doesn't jitter on re-render. The drift
 * is CSS, gated by tokens.css's own reduced-motion rule.
 */
function WreckGeometry({
  silhouette,
  seedKey,
  shrink,
  extent,
}: {
  silhouette: { path: string }
  seedKey: string
  shrink: number
  extent: { noseY: number; tailY: number; halfBeam: number }
}) {
  const seed = hashSeed(`${seedKey}-wreck`)
  const rolls = seededSequence(seed, 1 + 4 * 3)
  const tilt = (rolls[0]! - 0.5) * 12
  const debrisCount = 3 + Math.floor((rolls[1] ?? 0) * 2)
  const span = Math.max(1, extent.tailY - extent.noseY)
  const debris = Array.from({ length: debrisCount }, (_, i) => {
    const base = 1 + i * 3
    const rx = rolls[base] ?? 0.5
    const ry = rolls[base + 1] ?? 0.5
    const rr = rolls[base + 2] ?? 0.5
    return {
      x: (rx - 0.5) * extent.halfBeam * 2.6,
      y: extent.noseY + ry * span,
      r: extent.halfBeam * (0.05 + rr * 0.11),
    }
  })

  return (
    <g transform={`rotate(${tilt.toFixed(1)})`}>
      <g className="counter-wreck-drift">
        <g transform={`scale(${shrink.toFixed(5)})`}>
          <path className="hull is-wreck" d={silhouette.path} />
          {debris.map((d, i) => (
            <circle key={i} className="counter-debris" cx={d.x} cy={d.y} r={d.r} />
          ))}
        </g>
      </g>
    </g>
  )
}
