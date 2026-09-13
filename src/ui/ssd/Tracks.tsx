import { hullRowBounds } from '../../engine/combat'
import { thresholdTarget } from '../../engine/dice'
import { crewFactorBoxes, crewFactors } from '../../engine/game'
import { FLAWED_DESIGN_DRM } from '../../engine/threshold'
import type { ShipDesign } from '../../engine/types'
import { SsdGlyph } from './Glyph'
import { iconForArmourBox, iconForHullBox } from './iconFor'

/**
 * The damage tracks, in the sheet's own boxes.
 *
 * Armour above, hull below, and the hull kept in rows — because the row
 * boundary IS the threshold point (4.11), and how close the next one is is the
 * single most important thing a captain reads off their own sheet. A crossed
 * box is drawn crossed rather than removed, exactly as a chinagraph pencil
 * leaves it.
 *
 * The crew dots are the sheet's own symbol (10.5): a hull box with a star in
 * it, at the boxes `crewFactorBoxes` puts them in — the same function the
 * engine counts surviving damage control parties with, so what the player sees
 * and what the rules do cannot drift apart.
 */

export interface TracksProps {
  design: ShipDesign
  hullMarked: number
  armourMarked: readonly number[]
  armourBurntOut?: readonly number[]
}

/** Side of a box, in track units. */
const BOX = 24
const GAP = 4
const PITCH = BOX + GAP
const LABEL = 40
/**
 * Room to the right of the longest row for the threshold tab.
 *
 * The tab says both halves of the question a captain is actually asking: what
 * the next check needs, and how many boxes away it is. Knowing it is a 5+ is
 * no use without knowing whether it is one hit away or nine.
 */
const TRAIL = 118
/**
 * The narrowest track the sheet will draw.
 *
 * An escort has four hull boxes, and four boxes stretched across the width of
 * a panel would be four dinner plates. Below this the track is drawn at its
 * natural size and left-aligned instead.
 */
const MIN_COLUMNS = 13

export function hullRows(boxes: number, rows: number): number[] {
  const bounds = hullRowBounds(boxes, rows)
  return bounds.map((end, i) => end - (i === 0 ? 0 : bounds[i - 1]))
}

export function Tracks({ design, hullMarked, armourMarked, armourBurntOut }: TracksProps) {
  const rows = hullRows(design.hullBoxes, design.hullRows)
  const armour = design.armour.layers.map((boxes, layer) => ({ boxes, layer })).reverse()
  const lines = armour.length + rows.length
  const widest = Math.max(MIN_COLUMNS, ...rows, ...design.armour.layers)

  const stars = new Set(
    crewFactorBoxes(
      design.hullBoxes,
      crewFactors(design.mass, design.group === 'civilian'),
    ),
  )

  // Which row the next point of damage lands in, so that row can show what the
  // threshold check will need (4.11). 13.13's Flawed Design fails a pip
  // earlier, and the tab says so, because the number on the tab is the one the
  // dice are actually rolled against.
  let consumed = 0
  let liveRow = -1
  for (let i = 0; i < rows.length; i += 1) {
    if (hullMarked < consumed + rows[i]) {
      liveRow = i
      break
    }
    consumed += rows[i]
  }
  const flawedDrm = design.flawed === true ? FLAWED_DESIGN_DRM : 0

  const width = LABEL + widest * PITCH + TRAIL
  const height = lines * PITCH + GAP

  let boxNumber = 0
  const armourTotal = design.armour.layers.reduce((a, b) => a + b, 0)

  return (
    <svg
      className="ssd-tracks"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={
        `${armourTotal > 0 ? `${armourTotal} armour boxes, ` : ''}` +
        `${design.hullBoxes} hull boxes in ${rows.length} rows, ${hullMarked} marked`
      }
    >
      {armour.map(({ boxes, layer }, line) => (
        <g key={`armour-${layer}`}>
          <text className="ssd-track-label" x={LABEL - 8} y={line * PITCH + GAP + BOX / 2}>
            {layer === 0 ? 'ARM' : `L${layer + 1}`}
          </text>
          {Array.from({ length: boxes }, (_, i) => {
            const marked = i < (armourMarked[layer] ?? 0)
            // The burnt-out ones are counted from the outside of the damaged
            // run inwards, so the boxes that will knit back are the ones
            // nearest the undamaged armour (7.8).
            const burntOut = marked && i < (armourBurntOut?.[layer] ?? 0)
            return (
              <SsdGlyph
                key={i}
                id={iconForArmourBox({
                  marked,
                  regenerative: design.armour.regenerative,
                  burntOut,
                })}
                x={LABEL + i * PITCH}
                y={line * PITCH + GAP}
                size={BOX}
                className={marked ? 'is-marked' : undefined}
              />
            )
          })}
        </g>
      ))}

      {rows.map((boxes, row) => {
        const line = armour.length + row
        const before = boxNumber
        boxNumber += boxes
        return (
          <g key={`hull-${row}`}>
            <text className="ssd-track-label" x={LABEL - 8} y={line * PITCH + GAP + BOX / 2}>
              {row + 1}
            </text>
            {Array.from({ length: boxes }, (_, i) => {
              const marked = hullMarked > before + i
              return (
                <SsdGlyph
                  key={i}
                  id={iconForHullBox({ marked, crew: stars.has(before + i + 1) })}
                  x={LABEL + i * PITCH}
                  y={line * PITCH + GAP}
                  size={BOX}
                  className={marked ? 'is-marked' : undefined}
                />
              )
            })}
            {/* No check is made at the end of the last row — the ship is
                already destroyed (4.11). */}
            {row === liveRow && row < rows.length - 1 ? (
              <text
                className="ssd-threshold"
                x={LABEL + boxes * PITCH + 4}
                y={line * PITCH + GAP + BOX / 2}
              >
                {thresholdTarget(row + 1) - flawedDrm}+
                <tspan className="ssd-threshold-in" dx={7}>
                  in {before + boxes - hullMarked}
                </tspan>
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
