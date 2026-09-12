import { hullRowBounds } from '../engine/combat'
import { thresholdTarget } from '../engine/dice'
import { crewFactors } from '../engine/game'
import type { ShipDesign } from '../engine/types'

/**
 * The Ship System Status Display.
 *
 * On the table this is a printed sheet you cross boxes off with a chinagraph
 * pencil, and it stays that on screen: boxes stay boxes, a marked box gets a
 * line through it, and the hull stays in rows — because the row boundary IS
 * the threshold point (4.11), and how close the next one is is the single most
 * important thing a captain reads off their own sheet.
 *
 * Prop-driven rather than store-driven, so the same component renders a live
 * ship, an enemy's partial dossier, and a design in the shipyard.
 */
export interface SsdDamage {
  /** Hull boxes crossed off, from the top left (4.9). */
  hullMarked: number
  /** Armour boxes crossed off, per layer, inner layer first (4.8, 7.7). */
  armourMarked: number[]
  /** Ids of weapons and systems knocked out by threshold checks (4.11). */
  destroyed: ReadonlySet<string>
  /** Weapons already fired this turn — in Full Thrust, once is all (2.6). */
  fired?: ReadonlySet<string>
  /** Surviving screen generators, which set the working screen level (7.2). */
  screenGenerators?: number
  /** Current thrust, which halves on the drive's first threshold loss (4.11). */
  thrust?: number
}

export interface SsdProps {
  design: ShipDesign
  /** Omit for a pristine sheet — the designer's view. */
  damage?: SsdDamage
  /** The ship's name in this battle, if it has been christened. */
  name?: string
  /** Hide weapon and system detail: an enemy sheet under the sensors rules. */
  redacted?: boolean
}

const PRISTINE: SsdDamage = {
  hullMarked: 0,
  armourMarked: [],
  destroyed: new Set<string>(),
}

/**
 * Row sizes for a hull track (2.4).
 *
 * Derived from `hullRowBounds` rather than computed here, and that matters more
 * than it looks: the row boundary IS the threshold point (4.11), so a form that
 * drew the rows one way while the engine checked them another would show the
 * player the wrong number for the next check — the single number they plan
 * around. One implementation, two consumers, and a cross-module test that says
 * so.
 */
export function hullRows(boxes: number, rows: number): number[] {
  const bounds = hullRowBounds(boxes, rows as 3 | 4 | 5 | 6)
  return bounds.map((end, i) => end - (i === 0 ? 0 : bounds[i - 1]))
}

export function Ssd({ design, damage = PRISTINE, name, redacted = false }: SsdProps) {
  const rows = hullRows(design.hullBoxes, design.hullRows)
  const generators = damage.screenGenerators ?? design.screens.generators
  const screenLevel = Math.min(design.screens.level, generators)
  const thrust = damage.thrust ?? design.drive.thrust

  // Which row the next damage point lands in, so that row can show what the
  // threshold check will need (4.11).
  let consumed = 0
  let liveRow = -1
  for (let i = 0; i < rows.length; i++) {
    if (damage.hullMarked < consumed + rows[i]) {
      liveRow = i
      break
    }
    consumed += rows[i]
  }

  return (
    <div className="ssd">
      <div className="ssd-head">
        <span className="ssd-name">{name ?? design.name}</span>
        {name ? <span className="ssd-class">{design.name}</span> : null}
      </div>

      <div className="ssd-stats">
        <span>
          MASS <b className="num">{design.mass}</b>
        </span>
        <span>
          THRUST{' '}
          <b className={`num${thrust < design.drive.thrust ? ' is-degraded' : ''}`}>{thrust}</b>
          {design.drive.advanced ? <span className="arcs"> ADV</span> : null}
        </span>
        <span>
          CPV <b className="num">{design.points}</b>
        </span>
        {screenLevel > 0 ? (
          <span className="screen-level">
            SCR
            {Array.from({ length: generators }, (_, i) => (
              <span
                key={i}
                className={`screen-pip${i < screenLevel ? ' is-up' : ' is-backup'}`}
                title={i < screenLevel ? 'Screen generator' : 'Backup generator'}
              />
            ))}
          </span>
        ) : null}
      </div>

      {/* Armour, drawn as circles above the hull — the rulebook draws them as
          circles and calls them boxes anyway (4.8). Outermost layer first,
          because that is the one damage reaches first (7.7). */}
      {design.armour.layers.length > 0 ? (
        <div className="hull-track" aria-label="Armour">
          {design.armour.layers
            .map((boxes, layer) => ({ boxes, layer }))
            .reverse()
            .map(({ boxes, layer }) => (
              <div className="hull-row" key={layer}>
                <span className="row-label">{layer === 0 ? 'ARM' : `L${layer + 1}`}</span>
                {Array.from({ length: boxes }, (_, i) => (
                  <span
                    key={i}
                    className={`box is-armour${design.armour.regenerative ? ' is-regen' : ''}${
                      i < (damage.armourMarked[layer] ?? 0) ? ' is-marked' : ''
                    }`}
                  />
                ))}
              </div>
            ))}
        </div>
      ) : null}

      <div className="hull-track" aria-label="Hull">
        {rows.map((boxes, row) => {
          const before = rows.slice(0, row).reduce((a, b) => a + b, 0)
          return (
            <div className="hull-row" key={row}>
              <span className="row-label">{row + 1}</span>
              {Array.from({ length: boxes }, (_, i) => (
                <span
                  key={i}
                  className={`box is-hull${damage.hullMarked > before + i ? ' is-marked' : ''}`}
                />
              ))}
              {/* No check is made at the end of the last row — the ship is
                  already destroyed (4.11). */}
              {row === liveRow && row < rows.length - 1 ? (
                <span className="row-threshold" title="Threshold check when this row is crossed">
                  {thresholdTarget(row + 1)}+
                </span>
              ) : null}
            </div>
          )
        })}
      </div>

      {redacted ? (
        <div className="ssd-systems">
          <span className="system-chip">Systems not known</span>
        </div>
      ) : (
        <>
          <div className="ssd-systems" aria-label="Weapons">
            {design.weapons.map((weapon) => (
              <span
                key={weapon.id}
                className={`system-chip${damage.destroyed.has(weapon.id) ? ' is-destroyed' : ''}${
                  damage.fired?.has(weapon.id) ? ' is-fired' : ''
                }`}
                title={damage.fired?.has(weapon.id) ? 'Already fired this turn' : undefined}
              >
                {weapon.label}
                <span className="arcs">{weapon.broadside ? 'BR' : weapon.arcs.join('')}</span>
              </span>
            ))}
          </div>
          <div className="ssd-systems" aria-label="Systems">
            {design.systems.map((system) => (
              <span
                key={system.id}
                className={`system-chip${damage.destroyed.has(system.id) ? ' is-destroyed' : ''}`}
              >
                {system.label}
              </span>
            ))}
            {/* Crew parties come from the hull's own crew (10.4), so the SSD
                shows what the ship actually musters, not what was bought. */}
            {crewFactors(design.mass, design.group === 'civilian') +
              design.additionalDamageControlParties >
            0 ? (
              <span className="system-chip">
                DCP ×
                {crewFactors(design.mass, design.group === 'civilian') +
                  design.additionalDamageControlParties}
              </span>
            ) : null}
            {design.marineParties > 0 ? (
              <span className="system-chip">MARINES ×{design.marineParties}</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
