import { useRef, useState } from 'react'

import type { ShipDesign } from '../../engine/types'
import { SsdGlyph } from './Glyph'
import { ArcRose } from './ArcRose'
import { describeCoreCell, describeGlyph, type MountInfo } from './describe'
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
  /**
   * The design the plan was laid out from. With it, hovering a symbol says
   * what the symbol is and which rule it comes from; without it, the symbols
   * carry their names as native tooltips and nothing more.
   */
  design?: ShipDesign
  /** An enemy hull under the sensor rules: the shape, and nothing inside it. */
  redacted?: boolean
  title: string
}

/** What the pointer is over, and where, in the wrap's own pixels. */
interface Hover {
  key: string
  /** One of the three cells in the Core Systems block (10.3). */
  cell: string | null
  x: number
  y: number
}

/** The card's width in CSS pixels, for keeping it inside the sheet. */
const TIP_WIDTH = 256
const TIP_OFFSET = 14

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

export function HullPlan({ plan, design, redacted = false, title }: HullPlanProps) {
  const clipId = `hull-clip-${Math.abs(hashOf(plan.path))}`
  const wrap = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const explain = design !== undefined && !redacted

  /** Where the pointer is, relative to the wrap, from a pointer event. */
  const track = (key: string, cell: string | null) => (event: React.PointerEvent) => {
    if (!explain) return
    const box = wrap.current?.getBoundingClientRect()
    if (!box) return
    setHover({ key, cell, x: event.clientX - box.left, y: event.clientY - box.top })
  }
  const leave = () => setHover(null)

  const hovered: MountInfo | null =
    explain && hover !== null ? infoFor(design, plan, hover) : null

  // The card sits down and to the right of the pointer, and flips to the
  // other side of it where it would otherwise run off the sheet.
  const box = wrap.current?.getBoundingClientRect()
  const tipLeft =
    hover === null ? 0 : box && hover.x + TIP_OFFSET + TIP_WIDTH > box.width
      ? Math.max(0, hover.x - TIP_OFFSET - TIP_WIDTH)
      : hover.x + TIP_OFFSET
  const tipAbove = hover !== null && box !== undefined && hover.y > box.height * 0.6

  return (
    <div className="ssd-plan-wrap" ref={wrap}>
    <svg
      className="ssd-plan"
      viewBox={plan.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={title}
      onPointerLeave={leave}
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
              className={`ssd-mount is-${glyph.kind} is-${glyph.state}${
                hover?.key === glyph.key ? ' is-hovered' : ''
              }`}
              role="img"
              aria-label={describe(glyph)}
              onPointerMove={track(glyph.key, null)}
              onPointerEnter={track(glyph.key, null)}
              onPointerLeave={leave}
            >
              <SsdGlyph
                id={glyph.icon}
                x={glyph.x - glyph.width / 2}
                y={glyph.y - glyph.height / 2}
                size={glyph.width}
                height={glyph.height}
                value={glyph.value}
                title={explain ? '' : glyph.label}
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
                      <g
                        key={cell.key}
                        className={`ssd-cell is-${cell.state}`}
                        onPointerMove={(event) => {
                          if (!explain) return
                          event.stopPropagation()
                          track(glyph.key, cell.key)(event)
                        }}
                      >
                        {explain ? null : <title>{cell.label}</title>}
                        {explain ? (
                          <rect
                            className="ssd-cell-hit"
                            x={cx - half * 1.6}
                            y={glyph.y - glyph.height * 0.45}
                            width={half * 3.2}
                            height={glyph.height * 0.9}
                          />
                        ) : null}
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

      {hovered !== null && hover !== null ? (
        <div
          className={`ssd-tip${tipAbove ? ' is-above' : ''}`}
          role="tooltip"
          style={{ left: tipLeft, top: tipAbove ? hover.y - TIP_OFFSET : hover.y + TIP_OFFSET }}
        >
          <div className="ssd-tip-head">
            <span className="ssd-tip-title">{hovered.title}</span>
            <span className="ssd-tip-section">§{hovered.section}</span>
          </div>
          {hovered.state !== null ? <div className="ssd-tip-state">{hovered.state}</div> : null}
          {hovered.facts.length > 0 ? (
            <ul className="ssd-tip-facts">
              {hovered.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          ) : null}
          <p className="ssd-tip-rule">{hovered.rule}</p>
        </div>
      ) : null}
    </div>
  )
}

/** The card for whatever is under the pointer: a cell of the core block, or a mount. */
function infoFor(design: ShipDesign, plan: SsdPlan, hover: Hover): MountInfo | null {
  const glyph = plan.glyphs.find((g) => g.key === hover.key)
  if (glyph === undefined) return null
  if (hover.cell !== null) {
    const cell = glyph.cells?.find((c) => c.key === hover.cell)
    const info = describeCoreCell(hover.cell)
    if (info !== null && cell !== undefined) {
      return {
        ...info,
        state:
          cell.state === 'destroyed'
            ? 'Knocked out'
            : cell.state === 'absent'
              ? 'Not fitted'
              : null,
      }
    }
  }
  return describeGlyph(design, glyph)
}

/** A stable id for the clip path, so two sheets on one page do not share one. */
function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0
  return h
}
