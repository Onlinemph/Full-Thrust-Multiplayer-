import { SSD_ICONS, type SsdIcon } from './icons.generated'
import { SSD_SPRITE } from './sprite.generated'

/**
 * Drawing one symbol off the sheet.
 *
 * The 176 symbol definitions are mounted once by `SsdSprite`; everything that
 * draws a ship refers to them rather than carrying a copy. Because the sheet
 * was recoloured onto `currentColor`, one definition renders live, greyed out
 * or struck through purely from the colour of whatever is drawing it.
 */

const BY_ID: ReadonlyMap<string, SsdIcon> = new Map(SSD_ICONS.map((icon) => [icon.id, icon]))

export function ssdIcon(id: string): SsdIcon | undefined {
  return BY_ID.get(id)
}

/** A symbol's viewBox as four numbers. */
export function viewBoxOf(icon: SsdIcon): [number, number, number, number] {
  const [x, y, w, h] = icon.viewBox.split(/[\s,]+/).map(Number)
  return [x, y, w, h]
}

/**
 * The symbol definitions, mounted once near the root of the app.
 *
 * A zero-sized SVG rather than a hidden one: `display: none` on an SVG makes
 * Safari drop the definitions it contains, and a referenced symbol that has
 * been dropped draws nothing at all with no error anywhere.
 */
export function SsdSprite() {
  return (
    <svg
      className="ssd-sprite"
      aria-hidden="true"
      focusable="false"
      // The sprite is generated from the sheet at build time by
      // tools/build_ssd_icons.py and contains nothing but <symbol> definitions.
      // It is a build artifact in the repository, not anything a player types.
      dangerouslySetInnerHTML={{ __html: SSD_SPRITE }}
    />
  )
}

export interface SsdGlyphProps {
  /** A symbol id from the catalogue, without the `ssd-` prefix. */
  id: string
  x: number
  y: number
  /** The box the symbol is fitted into. The symbol keeps its own aspect. */
  size: number
  /** A taller or shorter box than it is wide, for the wide symbols. */
  height?: number
  className?: string
  /**
   * The number this ship's copy of the symbol carries: a drive's thrust, a
   * hold's mass, a bay's craft, or a weapon class the sheet does not print.
   * Only symbols with somewhere to put one take it; passing it to any other
   * is ignored rather than drawn somewhere wrong.
   */
  value?: number | string
  title?: string
}

/**
 * One symbol, fitted into a box in the parent SVG's coordinates.
 *
 * `x`/`y` are the box's top-left corner, and the symbol is centred inside it
 * at its own aspect ratio rather than stretched, which matters because the
 * sheet's symbols run from 1:1 hull boxes to a 3:1 Core Systems block.
 */
export function SsdGlyph({
  id,
  x,
  y,
  size,
  height = size,
  className,
  value,
  title,
}: SsdGlyphProps) {
  const icon = BY_ID.get(id)
  if (icon === undefined) return null

  const classes = className === undefined ? 'ssd-glyph' : `ssd-glyph ${className}`
  const label = title ?? icon.label

  // The common case: no number to add, so the symbol goes in as one node.
  if (value === undefined || icon.numberSlot === undefined) {
    return (
      <use href={`#ssd-${id}`} x={x} y={y} width={size} height={height} className={classes}>
        <title>{label}</title>
      </use>
    )
  }

  // A number of this ship's own. Nested in the symbol's coordinate system so
  // the replacement lands exactly where the sheet printed its digit, without
  // working out the scale by hand.
  //
  // The inner <use> is given the symbol's own viewBox rectangle explicitly. Left
  // to its defaults a <use> sits at 0,0 with a 100% width, and none of the
  // numbered symbols has a viewBox anchored at the origin — the drive's starts
  // at 164,−35 — so the symbol was drawn a fifth of a box to the left of its
  // number and the number a fifth to the right of its symbol.
  const slot = icon.numberSlot
  const [vx, vy, vw, vh] = viewBoxOf(icon)
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={height}
      viewBox={icon.viewBox}
      className={`${classes} has-value`}
      overflow="visible"
    >
      <title>{slot.means === 'class' ? label : `${label} — ${slot.means} ${value}`}</title>
      <use href={`#ssd-${id}`} x={vx} y={vy} width={vw} height={vh} />
      <text
        className={slot.ink ? 'ssd-value' : 'ssd-value is-hole'}
        x={slot.x}
        y={slot.y}
        fontSize={slot.size}
        dominantBaseline="middle"
        textAnchor="middle"
      >
        {value}
      </text>
    </svg>
  )
}
