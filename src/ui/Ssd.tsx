import { crewFactorBoxes, crewFactors } from '../engine/game'
import type { ShipDesign } from '../engine/types'
import { HullPlan } from './ssd/HullPlan'
import { Tracks, hullRows } from './ssd/Tracks'
import { planShip } from './ssd/layout'

/**
 * The Ship System Status Display.
 *
 * On the table this is a printed sheet you cross boxes off with a chinagraph
 * pencil, and it stays that on screen. Two halves, and they answer different
 * questions.
 *
 * The plan is the ship: the hull outline its build implies, with every weapon
 * and fitting drawn in the sheet's own symbol and sitting where it is bolted.
 * A bow battery is at the bow, a port broadside runs down the port side, an
 * all-round mount is on the keel, the drive is the stern. Where a symbol is
 * says what it can shoot at, which is the question a player actually has, and
 * the old list of text chips could not answer it at all.
 *
 * The tracks are the damage: armour above, hull below, kept in rows because
 * the row boundary IS the threshold point (4.11).
 *
 * Prop-driven rather than store-driven, so the same component renders a live
 * ship, an enemy's partial dossier, and a design in the shipyard.
 */
export interface SsdDamage {
  /** Hull boxes crossed off, from the top left (4.9). */
  hullMarked: number
  /** Armour boxes crossed off, per layer, inner layer first (4.8, 7.7). */
  armourMarked: number[]
  /**
   * 7.8: boxes of Regenerative Armour that rolled a 1 and *"cannot regenerate
   * further this battle"*. Marked apart from the rest, because the difference
   * between a box that will come back and one that will not is the whole
   * reason a player watches the armour row at all.
   */
  armourBurntOut?: number[]
  /**
   * Ids of weapons and systems knocked out by threshold checks (4.11) — the
   * one set the engine records losses in, screen generators and the core's
   * three included. Everything drawn crossed off is crossed off from here.
   */
  destroyed: ReadonlySet<string>
  /** Weapons already fired this turn — in Full Thrust, once is all (2.6). */
  fired?: ReadonlySet<string>
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
 * Row sizes for a hull track (2.4), re-exported from where the tracks are
 * drawn so the cross-module agreement test keeps pointing at the form.
 */
export { hullRows }

export function Ssd({ design, damage = PRISTINE, name, redacted = false }: SsdProps) {
  // The working screen level is what the generators still standing can hold up
  // (7.2), read from the same set of losses as everything else on the sheet.
  const generators = design.systems.filter((s) => s.kind === 'screen-generator')
  const standing = generators.filter((g) => !damage.destroyed.has(g.id)).length
  const screenLevel = Math.min(design.screens.level, standing)
  const thrust = damage.thrust ?? design.drive.thrust

  // Damage control parties are the crew still aboard plus what was bought
  // (10.4, 10.5): one party per crew dot that is not yet in a crossed-off box.
  // The same arithmetic as the engine's `survivingCrewFactors`, on the same
  // dots the track draws, so the number and the stars are one fact.
  const dots = crewFactorBoxes(
    design.hullBoxes,
    crewFactors(design.mass, design.group === 'civilian'),
  )
  const parties =
    dots.filter((box) => box > damage.hullMarked).length + design.additionalDamageControlParties

  // Cheap enough — a tenth of a millisecond on the heaviest hull in the game —
  // that memoising it is not worth a stale sheet: the sets it reads are
  // mutated in place by the engine, so nothing about their identity says
  // whether they changed.
  const plan = planShip(design, {
    destroyed: damage.destroyed,
    fired: damage.fired,
    thrust: damage.thrust,
  })

  const stealthHull = design.systems.some((s) => s.kind === 'stealth-hull')

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
        {design.screens.level > 0 ? (
          <span className="screen-level">
            SCR
            {generators.map((generator, i) => {
              const up = !damage.destroyed.has(generator.id)
              return (
                <span
                  key={generator.id}
                  className={`screen-pip${up ? (i < screenLevel ? ' is-up' : ' is-backup') : ' is-down'}`}
                  title={
                    !up
                      ? 'Generator knocked out'
                      : i < design.screens.level
                        ? 'Screen generator'
                        : 'Backup generator'
                  }
                />
              )
            })}
          </span>
        ) : null}
        {/* 7.4's stealth hull is the hull's own shaping, not a box on it, so
            it is stated here rather than drawn as a fitting. */}
        {stealthHull && !redacted ? <span className="ssd-badge">STEALTH HULL</span> : null}
        {design.flawed === true ? (
          <span className="ssd-badge is-warn" title="13.13: threshold checks fail a pip earlier">
            FLAWED
          </span>
        ) : null}
      </div>

      <HullPlan plan={plan} redacted={redacted} title={`${name ?? design.name}, plan view`} />

      <Tracks
        design={design}
        hullMarked={damage.hullMarked}
        armourMarked={damage.armourMarked}
        armourBurntOut={damage.armourBurntOut}
      />

      {/* Crew parties come from the hull's own crew (10.4), so the sheet shows
          what the ship actually musters, not what was bought. The stars on the
          hull track are where they are lost. Under the sensor rules the
          complement is fit-out and stays hidden with the rest of it. */}
      <div className="ssd-crew">
        {redacted ? (
          <span className="is-redacted">Fit-out not known</span>
        ) : (
          <>
            {parties > 0 ? <span>DCP ×{parties}</span> : null}
            {design.marineParties > 0 ? <span>MARINES ×{design.marineParties}</span> : null}
          </>
        )}
      </div>
    </div>
  )
}
