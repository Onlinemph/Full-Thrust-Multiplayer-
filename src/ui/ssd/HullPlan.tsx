import { SsdGlyph } from './Glyph'
import { ArcRose } from './ArcRose'
import type { SsdPlan } from './layout'

/**
 * The ship, drawn.
 *
 * One SVG: the hull outline, the spinal mount if it has one, and every weapon
 * and fitting sitting where it is bolted. The hull was drawn around the
 * contents rather than the other way about, so nothing here has to decide what
 * to do when a symbol will not fit — by this point they all do.
 */

export interface HullPlanProps {
  plan: SsdPlan
  /** An enemy hull under the sensor rules: the shape, and nothing inside it. */
  redacted?: boolean
  title: string
}

export function HullPlan({ plan, redacted = false, title }: HullPlanProps) {
  return (
    <svg
      className="ssd-plan"
      viewBox={plan.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title}
    >
      <path className="ssd-hull" d={plan.path} />
      {plan.spine !== null ? (
        <line
          className="ssd-spinal"
          x1={plan.spine.x}
          y1={plan.spine.y1}
          x2={plan.spine.x}
          y2={plan.spine.y2}
        />
      ) : null}

      {redacted
        ? null
        : plan.glyphs.map((glyph) => (
            <g key={glyph.key} className={`ssd-mount is-${glyph.state}`}>
              <SsdGlyph
                id={glyph.icon}
                x={glyph.x - glyph.width / 2}
                y={glyph.y - glyph.height / 2}
                size={glyph.width}
                height={glyph.height}
                value={glyph.value}
                title={glyph.label}
              />
              {glyph.rose !== null && glyph.arcs !== undefined ? (
                <ArcRose
                  arcs={glyph.arcs}
                  x={glyph.rose.x}
                  y={glyph.rose.y}
                  radius={glyph.rose.radius}
                />
              ) : null}
              {glyph.state === 'destroyed' ? (
                /* Crossed off, the way it would be on paper — the box stays
                   where it was, because what the ship used to have is part of
                   reading what is left (4.11). */
                <line
                  className="ssd-strike"
                  x1={glyph.x - glyph.width / 2}
                  y1={glyph.y - glyph.height / 2}
                  x2={glyph.x + glyph.width / 2}
                  y2={glyph.y + glyph.height / 2}
                />
              ) : null}
            </g>
          ))}
    </svg>
  )
}
