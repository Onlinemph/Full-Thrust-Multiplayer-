import { SsdGlyph } from './Glyph'
import { ArcRose } from './ArcRose'
import type { PlacedGlyph, SsdPlan } from './layout'

/**
 * The ship, drawn.
 *
 * One SVG: the hull outline, the frames between its bands, the spinal mount if
 * it has one, and every weapon and fitting sitting where it is bolted. The
 * hull was drawn around the contents rather than the other way about, so
 * nothing here has to decide what to do when a symbol will not fit — by this
 * point they all do.
 *
 * Under the sensor rules an enemy sheet is the outline and nothing inside it,
 * spinal mount included (12.1): the one weapon that most changes how you
 * fight a ship is not given away by the sheet whose job is to hide its
 * weapons.
 */

export interface HullPlanProps {
  plan: SsdPlan
  /** An enemy hull under the sensor rules: the shape, and nothing inside it. */
  redacted?: boolean
  title: string
}

function describe(glyph: PlacedGlyph): string {
  const state =
    glyph.state === 'destroyed'
      ? ', destroyed'
      : glyph.state === 'fired'
        ? ', fired this turn'
        : glyph.state === 'degraded'
          ? ', degraded'
          : ''
  const arcs = glyph.arcs !== undefined && glyph.arcs.length > 0 ? `, arcs ${glyph.arcs.join(' ')}` : ''
  const value = glyph.value !== undefined ? ` ${glyph.value}` : ''
  return `${glyph.label}${value}${arcs}${state}`
}

export function HullPlan({ plan, redacted = false, title }: HullPlanProps) {
  const clipId = `hull-clip-${Math.abs(hashOf(plan.path))}`
  return (
    <svg
      className="ssd-plan"
      viewBox={plan.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={title}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={plan.path} />
        </clipPath>
      </defs>
      <path className="ssd-hull" d={plan.path} />

      {/* The frames: a line where one band hands over to the next, kept
          inside the plating. They are what make a column of symbols read as
          decks of a ship rather than a list. */}
      <g clipPath={`url(#${clipId})`}>
        {plan.frames.map((y) => (
          <line
            key={y}
            className="ssd-frame"
            x1={-plan.hull.beam * 1.2}
            y1={y}
            x2={plan.hull.beam * 1.2}
            y2={y}
          />
        ))}
      </g>

      {plan.spine !== null && !redacted ? (
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
            <g
              key={glyph.key}
              className={`ssd-mount is-${glyph.kind} is-${glyph.state}`}
              role="img"
              aria-label={describe(glyph)}
            >
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
              {glyph.cells !== undefined
                ? /* 10.3: three systems in one symbol, each crossed off on its
                     own. A cell the design left out is dimmed, not struck —
                     it was never there to lose. */
                  glyph.cells.map((cell) => {
                    const cx = glyph.x - glyph.width / 2 + glyph.width * cell.fx
                    const half = glyph.width * 0.085
                    return (
                      <g key={cell.key} className={`ssd-cell is-${cell.state}`}>
                        <title>{cell.label}</title>
                        {cell.state === 'absent' ? (
                          <rect
                            className="ssd-cell-absent"
                            x={cx - half}
                            y={glyph.y - glyph.height * 0.32}
                            width={half * 2}
                            height={glyph.height * 0.64}
                          />
                        ) : null}
                        {cell.state === 'destroyed' ? (
                          <line
                            className="ssd-strike"
                            x1={cx - half}
                            y1={glyph.y - glyph.height * 0.34}
                            x2={cx + half}
                            y2={glyph.y + glyph.height * 0.34}
                          />
                        ) : null}
                      </g>
                    )
                  })
                : glyph.state === 'destroyed' ? (
                    /* Crossed off, the way it would be on paper — the box stays
                       where it was, because what the ship used to have is part
                       of reading what is left (4.11). */
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

/** A stable id for the clip path, so two sheets on one page do not share one. */
function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0
  return h
}
