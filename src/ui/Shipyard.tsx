import { useState } from 'react'

import {
  TECH_BASE_OPTIONS,
  designProblems,
  techBaseLabel,
  type TechBaseChoice,
} from '../data/techBaseCheck'
import {
  describeFault,
  hullBoxesFor,
  priceDesign,
  proportionalCost,
  repriceProportional,
  validateDesign,
  HULL_CLASS_OPTIONS,
  HULL_ROW_OPTIONS,
} from '../data/designPricing'
import { ALL_ARCS, CATALOGUE_SYSTEMS, CATALOGUE_WEAPONS } from '../data/buildCatalog'
import { allDesigns } from '../data/ships'
import { deleteDesign, saveDesign, savedDesigns } from '../data/shipyard'
import type { HullClass, HullRows, ShipDesign } from '../engine/types'
import { Ssd } from './Ssd'

/**
 * The shipyard.
 *
 * Designing ships is, as the rulebook puts it, "the heart and soul of the
 * game" (2.3), and the thing that makes it a game rather than a form is the
 * trade: mass is finite, and everything competes for it. So the mass bar is
 * the loudest thing on screen, the SSD redraws as you build, and the faults
 * list says what is wrong in the rulebook's own terms rather than refusing to
 * let you build it.
 *
 * The arithmetic underneath is the fixed point every Full Thrust designer
 * meets: hull boxes, the drive, FTL, streamlining and screens are all
 * fractions of *total mass*, so raising the hull rating raises the cost of the
 * hull. Changing the mass slider changes everything at once, which is exactly
 * what it does on paper.
 */
export function Shipyard({ onClose }: { onClose: () => void }) {
  const [design, setDesign] = useState<ShipDesign>(() => startingPoint())
  const [yard, setYard] = useState<ShipDesign[]>(() => [...savedDesigns()])
  const [saved, setSaved] = useState<string | null>(null)
  /* 15: which empire's technology this is being drawn up under. A designer
     answers this before the first component, and it is separate from the
     faults because it is a different kind of no: a fault means the hull cannot
     fly, a tech-base refusal means this empire cannot build it. */
  const [techBase, setTechBase] = useState<TechBaseChoice>('unrestricted')
  const cost = priceDesign(design)
  const faults = validateDesign(design)
  const offBase = designProblems(techBase, design)

  /** Any edit that changes mass has to re-derive the hull box count with it. */
  const edit = (patch: Partial<ShipDesign>) =>
    setDesign((d) => {
      // Order matters: hull boxes and the proportional systems both scale with
      // mass, and the points are the sum of what they become — not of what
      // they were before the slider moved.
      const next = repriceProportional({ ...d, ...patch })
      next.hullBoxes = hullBoxesFor(next.mass, next.hullClass)
      next.points = priceDesign(next).points
      return next
    })

  const overweight = cost.spare < 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal is-wide" onClick={(event) => event.stopPropagation()}>
        <h2>Shipyard</h2>

        {/* Mass is the whole game here, so it is the loudest thing on screen. */}
        <div className={`mass-bar${overweight ? ' is-over' : ''}`}>
          <div
            className="mass-fill"
            style={{ width: `${Math.min(100, (cost.massUsed / cost.massAvailable) * 100)}%` }}
          />
          <span className="mass-readout num">
            {cost.massUsed} / {cost.massAvailable} mass · {cost.points} CPV
          </span>
        </div>

        {faults.length > 0 ? (
          <ul className="faults">
            {faults.map((fault, i) => (
              <li key={i}>{describeFault(fault)}</li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--screens)' }}>A legal design.</p>
        )}

        <div className="panel-row">
          <label className="code-field" style={{ flexDirection: 'row', gap: '0.4rem' }}>
            Tech base
            <select
              aria-label="Tech base"
              value={techBase}
              onChange={(event) => setTechBase(event.target.value as TechBaseChoice)}
            >
              {TECH_BASE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span className="spacer" />
          {techBase !== 'unrestricted' && offBase.length === 0 ? (
            <span style={{ color: 'var(--screens)' }}>Buildable under section 15.</span>
          ) : null}
        </div>

        {offBase.length > 0 ? (
          <div className="tech-report">
            {techBaseLabel(techBase)} could not build this:
            <ul>
              {offBase.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="library">
          <div className="shipyard-controls">
            <label className="code-field">
              Class name
              <input
                type="text"
                value={design.name}
                onChange={(event) => edit({ name: event.target.value })}
              />
            </label>

            <label className="code-field">
              Hull mass <span className="num">{design.mass}</span>
              <input
                type="range"
                min={10}
                max={400}
                step={2}
                value={design.mass}
                onChange={(event) => edit({ mass: Number(event.target.value) })}
              />
            </label>

            <label className="code-field">
              Hull integrity
              <select
                value={design.hullClass}
                onChange={(event) => edit({ hullClass: event.target.value as HullClass })}
              >
                {HULL_CLASS_OPTIONS.map((option) => (
                  <option key={option.hullClass} value={option.hullClass}>
                    {option.hullClass} — {Math.round(option.fraction * 100)}% of mass
                  </option>
                ))}
              </select>
            </label>

            <label className="code-field">
              Hull rows
              <select
                value={design.hullRows}
                onChange={(event) => edit({ hullRows: Number(event.target.value) as HullRows })}
              >
                {HULL_ROW_OPTIONS.map((option) => (
                  <option key={option.rows} value={option.rows}>
                    {option.rows} rows — {option.pointsPerBox} pts a box · {option.note}
                  </option>
                ))}
              </select>
            </label>

            <label className="code-field">
              Thrust <span className="num">{design.drive.thrust}</span>{' '}
              <span className="rule-detail">
                ({Math.round(design.drive.thrust * 5)}% of mass)
              </span>
              <input
                type="range"
                min={0}
                max={10}
                value={design.drive.thrust}
                onChange={(event) =>
                  edit({ drive: { ...design.drive, thrust: Number(event.target.value) } })
                }
              />
            </label>

            <label className="rule-toggle">
              <input
                type="checkbox"
                checked={design.drive.advanced}
                onChange={(event) =>
                  edit({ drive: { ...design.drive, advanced: event.target.checked } })
                }
              />
              <span>
                <b>Advanced drive</b>{' '}
                <span className="rule-detail">turns at its full rating, not half (3.3)</span>
              </span>
            </label>

            <label className="rule-toggle">
              <input
                type="checkbox"
                checked={design.ftl !== 'none'}
                onChange={(event) => edit({ ftl: event.target.checked ? 'standard' : 'none' })}
              />
              <span>
                <b>FTL drive</b> <span className="rule-detail">10% of mass</span>
              </span>
            </label>

            <label className="code-field">
              Screens <span className="num">{design.screens.level}</span>
              <input
                type="range"
                min={0}
                max={2}
                value={design.screens.level}
                onChange={(event) => {
                  const level = Number(event.target.value) as 0 | 1 | 2
                  edit({
                    screens: { ...design.screens, level, generators: level },
                    // A generator is a symbol on the SSD, so the systems list
                    // has to follow the level or nothing can knock it down.
                    systems: [
                      ...design.systems.filter((s) => s.kind !== 'screen-generator'),
                      ...Array.from({ length: level }, (_, i) => ({
                        id: `screen-gen-${i + 1}`,
                        kind: 'screen-generator' as const,
                        label: 'Screen Gen',
                        mass: 0,
                        points: 0,
                      })),
                    ],
                  })
                }}
              />
            </label>

            <label className="code-field">
              Armour <span className="num">{design.armour.layers[0] ?? 0}</span>
              <input
                type="range"
                min={0}
                max={40}
                value={design.armour.layers[0] ?? 0}
                onChange={(event) =>
                  edit({
                    armour: { ...design.armour, layers: [Number(event.target.value)] },
                  })
                }
              />
            </label>

            <h4>Systems</h4>
            <div className="design-list">
              {CATALOGUE_SYSTEMS.map((entry) => (
                <button
                  key={entry.kind + entry.label}
                  className="design-chip"
                  title={`${entry.mass} mass, ${entry.points} points`}
                  onClick={() => {
                    // A share-of-hull system is priced against this hull, not
                    // off the catalogue's flat figures (7.17 – 7.25).
                    const scaled = proportionalCost(entry.kind, design)
                    edit({
                      systems: [
                        ...design.systems,
                        {
                          id: `${entry.kind}-${design.systems.length + 1}`,
                          kind: entry.kind,
                          label: entry.label,
                          mass: scaled ? scaled.mass : entry.mass,
                          points: scaled ? scaled.points : entry.points,
                        },
                      ],
                    })
                  }}
                >
                  {entry.label}
                  <span className="num">{entry.mass}m</span>
                </button>
              ))}
            </div>

            <h4>Weapons</h4>
            <div className="design-list">
              {CATALOGUE_WEAPONS.map((entry) =>
                entry.mountings.map((mounting) => (
                  <button
                    key={`${entry.weaponClass}-${entry.variant}-${entry.rating}-${mounting.arcs}`}
                    className="design-chip"
                    title={`${mounting.mass} mass, ${mounting.points} points, ${mounting.arcs} arcs`}
                    onClick={() =>
                      edit({
                        weapons: [
                          ...design.weapons,
                          {
                            id: `w${design.weapons.length + 1}`,
                            label: entry.label,
                            weaponClass: entry.weaponClass,
                            rating: entry.rating,
                            variant: entry.variant,
                            arcs: [...ALL_ARCS].slice(0, mounting.arcs),
                            mass: mounting.mass,
                            points: mounting.points,
                          },
                        ],
                      })
                    }
                  >
                    {entry.label}
                    <span className="num">
                      {mounting.arcs}a · {mounting.mass}m
                    </span>
                  </button>
                )),
              )}
            </div>
          </div>

          <div className="library-form">
            <Ssd design={design} />
            <div className="panel-row" style={{ marginTop: 'var(--gap)' }}>
              <button onClick={() => setDesign(startingPoint())}>Start over</button>
              <button
                className="primary"
                disabled={faults.length > 0}
                title={
                  faults.length > 0
                    ? 'Fix the faults above first — an illegal hull is not a design'
                    : 'Saved designs appear in the fleet picker beside the shipped roster'
                }
                onClick={() => {
                  // An id derived from the name, so building the same class
                  // twice replaces it rather than filling the yard with
                  // "new-design", "new-design-2", "new-design-3".
                  const id = slug(design.name) || 'new-design'
                  saveDesign({ ...design, id })
                  setYard([...savedDesigns()])
                  setSaved(id)
                }}
              >
                Save to the yard
              </button>
              <span className="spacer" />
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(design, null, 2)], {
                    type: 'application/json',
                  })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `${design.id}.json`
                  link.click()
                  URL.revokeObjectURL(url)
                }}
              >
                Download design
              </button>
            </div>
            {saved ? (
              <p className="rule-detail" style={{ color: 'var(--screens)' }}>
                Saved as <code>{saved}</code>. It is in the fleet picker now, and any battle that
                uses it carries its own copy — so the save file opens on a browser that has never
                seen the design.
              </p>
            ) : (
              <p className="rule-detail">
                A saved design joins the fleet picker beside the shipped roster. A downloaded one
                is a file you can keep or send.
              </p>
            )}

            {yard.length > 0 ? (
              <>
                <h4>The yard</h4>
                <div className="design-list">
                  {yard.map((entry) => (
                    <button
                      key={entry.id}
                      className="design-chip"
                      title={`${entry.points} points — click to open, shift-click to delete`}
                      onClick={(event) => {
                        if (event.shiftKey) {
                          deleteDesign(entry.id)
                          setYard([...savedDesigns()])
                          return
                        }
                        setDesign(structuredClone(entry))
                        setSaved(null)
                      }}
                    >
                      {entry.name}
                      <span className="num">{entry.points}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

/** A class name as an id: lower case, hyphens, nothing else (13). */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A bare hull to build on: the smallest thing that is not yet illegal. */
function startingPoint(): ShipDesign {
  const template = allDesigns().find((d) => d.id === 'esu-frigate')
  const base: ShipDesign = template
    ? structuredClone(template)
    : {
        id: 'new-design',
        name: 'New Design',
        faction: 'Custom',
        group: 'escort',
        mass: 30,
        hullClass: 'average',
        hullRows: 4,
        hullBoxes: 9,
        drive: { thrust: 4, advanced: false },
        ftl: 'standard',
        streamlining: 'none',
        armour: { layers: [], regenerative: false },
        screens: { level: 0, generators: 0, advanced: false },
        weapons: [],
        turrets: [],
        systems: [],
        fighterBays: [],
        gunboats: [],
        additionalDamageControlParties: 1,
        marineParties: 0,
        points: 0,
      }
  return { ...base, id: 'new-design', name: 'New Design', faction: 'Custom' }
}
