import { memo, useId } from 'react'

import { courseToDegrees } from '../engine/geometry'
import type { Course, Point, ShipDesign } from '../engine/types'
import { LuminousArt } from './plot/art/Luminous'
import { MiniatureArt } from './plot/art/Miniature'
import type { ArtProps } from './plot/art/types'
import { hullExtent } from './plot/hullExtent'
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
 * Two chrome styles are drawn over that outline and crossfaded by the
 * counter's own on-screen radius: luminous line art (`plot/art/Luminous.tsx`)
 * at the zoom a battle opens at and anything smaller, painted miniature
 * (`plot/art/Miniature.tsx`) once zoomed in past it, both drawn together with
 * complementary opacity through the band between so zooming never pops. What
 * they draw differs, but a player reads the same facts off either: the hull's
 * outline, a bow so which way is forward is never in doubt (3.1, 4.2, 4.10),
 * guns as a bar per battery or a dot per gun once the map is close enough for
 * one to mean anything, a class cue, damage, wreckage and a cloak's outline.
 * What stays common to both and is drawn once, outside either style: the
 * selection ring, the screens halo, the engine's idle glow, the health ring,
 * the rolled-ship bar and the name/speed labels — none of it a filter, every
 * glow here a gradient-filled circle or a wide, faint stroke, because the
 * plot pans and re-renders and a blur filter would be re-rasterised every
 * time it does.
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
  /**
   * True only while this ship's plotted order actually burns thrust this
   * segment — distinct from `design.drive.thrust > 0`, which only says the
   * ship has a drive and already drives the idle glow. Nothing supplies this
   * yet, so it defaults false and the painted style's thrust flare simply
   * never shows: a caller that finds where "burning thrust right now" lives
   * (a written order, the movement replay's current leg) can wire it in
   * later with no regression today.
   */
  thrusting?: boolean
  /**
   * Skip the minimum on-screen size floor (`counterScreenRadius`'s own
   * boost). Preview surfaces that already normalise every design to one
   * fixed radius (`CounterPreview`) need the true, unboosted proportional
   * size, or the boost — which depends on `scale` alone, and every design's
   * own per-mass `scale` cancels differently — breaks the uniform sizing
   * (review finding `code #1`). The live map leaves this on.
   */
  sizeFloor?: boolean
  /**
   * Force one art style instead of the zoom-based crossfade. A small fixed
   * preview box has no "zoom" to crossfade against, and a continuous blend
   * at a handful of pixels just looks muddy — `CounterPreview` picks one
   * style outright, luminous for a small chip and painted for a large one.
   */
  artStyle?: 'luminous' | 'miniature'
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

/** The idle exhaust glow's stops are all fixed tokens, not per-instance data
    — one shared id serves every counter, the same reasoning `plot/art`'s own
    gradients use. */
const GLOW_GRAD_ID = 'ft-counter-glow'

/**
 * The crossfade band, on the counter's own on-screen radius: fully luminous
 * at or below `LUMINOUS_FULL_R`, fully painted at or above `PAINTED_FULL_R`,
 * both styles drawn with complementary opacity between the two so zooming
 * from one to the other never pops.
 */
export const LUMINOUS_FULL_R = 30
export const PAINTED_FULL_R = 42

function styleOpacity(r: number, forced: 'luminous' | 'miniature' | undefined): { luminous: number; painted: number } {
  if (forced === 'luminous') return { luminous: 1, painted: 0 }
  if (forced === 'miniature') return { luminous: 0, painted: 1 }
  if (r <= LUMINOUS_FULL_R) return { luminous: 1, painted: 0 }
  if (r >= PAINTED_FULL_R) return { luminous: 0, painted: 1 }
  const t = (r - LUMINOUS_FULL_R) / (PAINTED_FULL_R - LUMINOUS_FULL_R)
  return { luminous: 1 - t, painted: t }
}

export const Counter = memo(function Counter({
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
  thrusting = false,
  sizeFloor = true,
  artStyle,
}: CounterProps) {
  const uid = useId()
  const r = sizeFloor ? counterScreenRadius(design.mass, scale) : counterRadius(design.mass) * scale
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

  const showGlow = !destroyed && !isStation && thrust > 0
  const glowRadius = r * (0.24 + Math.min(1, thrust / 6) * 0.3)

  const showHealthRing = !destroyed && (damageFraction ?? 0) > 0.02
  const healthRemain = Math.max(0, 1 - (damageFraction ?? 0))
  const healthRadius = r * 1.16
  const healthCircumference = 2 * Math.PI * healthRadius
  const healthDash = healthRemain * healthCircumference
  const healthColor =
    healthRemain > 0.5 ? 'var(--hull)' : healthRemain > 0.25 ? 'var(--warn)' : 'var(--damage)'

  const showScreens = !destroyed && screenLevel > 0

  const { luminous: luminousOpacity, painted: paintedOpacity } = styleOpacity(r, artStyle)
  const artProps: ArtProps = {
    design,
    silhouette,
    extent,
    length,
    isStation,
    isCarrier,
    r,
    shrink,
    destroyed,
    cloaked,
    damageFraction: damageFraction ?? 0,
    seedKey: label ?? design.id,
    thrust,
    thrusting,
    glowRadius,
    uid,
  }

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
      {showGlow ? (
        <defs>
          <radialGradient id={GLOW_GRAD_ID}>
            <stop offset="0" stopColor="var(--counter-glow)" stopOpacity="0.65" />
            <stop offset="0.55" stopColor="var(--counter-glow)" stopOpacity="0.2" />
            <stop offset="1" stopColor="var(--counter-glow)" stopOpacity="0" />
          </radialGradient>
        </defs>
      ) : null}

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
          circle behind the hull, shared by both art styles rather than drawn
          per style, since neither changes what it means. */}
      {showGlow ? (
        <circle className="counter-exhaust" cx={0} cy={r * 0.82} r={glowRadius} fill={`url(#${GLOW_GRAD_ID})`} />
      ) : null}

      {art ? (
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
          {!destroyed && (damageFraction ?? 0) > 0.12 ? (
            <ellipse
              className="counter-damage-wash"
              rx={r * 0.55}
              ry={r * 0.92}
              style={{ opacity: Math.min(0.3, (damageFraction ?? 0) * 0.36) }}
            />
          ) : null}
        </>
      ) : (
        <>
          {luminousOpacity > 0 ? (
            <g className="counter-art-luminous" style={{ opacity: luminousOpacity }}>
              <LuminousArt {...artProps} />
            </g>
          ) : null}
          {paintedOpacity > 0 ? (
            <g className="counter-art-miniature" style={{ opacity: paintedOpacity }}>
              <MiniatureArt {...artProps} />
            </g>
          ) : null}
        </>
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
})
