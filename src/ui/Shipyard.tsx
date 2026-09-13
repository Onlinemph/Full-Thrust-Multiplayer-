import { useState } from 'react'

import {
  TECH_BASE_OPTIONS,
  designProblems,
  techBaseLabel,
  type TechBaseChoice,
} from '../data/techBaseCheck'
import { emptyTechBase, type TechBase } from '../engine/techbase'
import { TechBasePanel } from './TechBasePanel'
import { FACTIONS, factionById } from '../data/factions'
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
import {
  maxTurrets,
  turretMass,
  turretPoints,
  TURRET_CAPACITY,
} from '../engine/weapons/kinetics'
import { allDesigns } from '../data/ships'
import { deleteDesign, saveDesign, savedDesigns } from '../data/shipyard'
import type { HullClass, HullRows, ShipDesign } from '../engine/types'
import { MAGAZINE_LOAD_MASS, MAGAZINE_POINTS_PER_MASS } from '../engine/ordnance'
import { FittedWeapons } from './FittedWeapons'
import { Ssd } from './Ssd'

/**
 * Add or drop a magazine load, repricing the magazine around it (6.6).
 *
 * The magazine's mass *is* its loads: 6.6 sizes it by what it carries, and
 * leftover mass is wasted rather than free, so a magazine sized to its loads
 * is the one a designer would draw.
 */
function withLoad(
  design: ShipDesign,
  magazineId: string,
  grade: 'standard' | 'extended',
  delta: 1 | -1,
): Partial<ShipDesign> {
  const magazines = (design.magazines ?? []).map((magazine) => {
    if (magazine.id !== magazineId) return magazine
    const loads =
      delta === 1 ? [...magazine.loads, { grade }] : magazine.loads.slice(0, -1)
    const mass = loads.reduce((sum, load) => sum + MAGAZINE_LOAD_MASS[load.grade], 0)
    return { ...magazine, loads, mass, points: mass * MAGAZINE_POINTS_PER_MASS }
  })
  return { magazines }
}

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
  const [customBase, setCustomBase] = useState<TechBase>(() => emptyTechBase('this table'))
  /* The campaign supplement's factions, which are a different question from
     section 15's tech base: a tech base is a list of technologies an empire
     bought, a faction is a set of traits it flies under. A hull can be legal
     under one and refused by the other. */
  const [factionId, setFactionId] = useState('')
  const [clanId, setClanId] = useState('')
  const cost = priceDesign(design)
  const faults = validateDesign(design, {
    factionId: factionId || undefined,
    clanId: clanId || undefined,
  })
  const faction = factionId ? factionById(factionId) : undefined
  const offBase = designProblems(techBase, design, customBase)

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
            Faction
            <select
              aria-label="Faction"
              value={factionId}
              onChange={(event) => {
                setFactionId(event.target.value)
                setClanId('')
              }}
            >
              <option value="">None</option>
              {FACTIONS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          {faction?.clans ? (
            <label className="code-field" style={{ flexDirection: 'row', gap: '0.4rem' }}>
              Clan
              <select
                aria-label="Clan"
                value={clanId}
                onChange={(event) => setClanId(event.target.value)}
              >
                <option value="">None</option>
                {faction.clans.map((clan) => (
                  <option key={clan.id} value={clan.id}>
                    {clan.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <span className="spacer" />
          {faction ? <span style={{ color: 'var(--ink-dim)' }}>{faction.doctrine}</span> : null}
        </div>

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

        {/* 15: "a number of choices as determined by their player group, which
            they can spend on technologies from the lists below". Spending them
            here rather than only in the setup panel is the point — this is
            where a designer finds out that the hull they just drew needs one
            more choice than the empire bought. */}
        {techBase === 'custom' ? (
          <TechBasePanel base={customBase} onChange={setCustomBase} />
        ) : null}

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
                onChange={(event) =>
                  edit(
                    event.target.checked
                      ? { ftl: 'standard' }
                      : { ftl: 'none', ftlTransferMass: undefined },
                  )
                }
              />
              <span>
                <b>FTL drive</b> <span className="rule-detail">10% of mass</span>
              </span>
            </label>

            {/* 11.6: a tug's drive is its own 10% plus 1 mass for every 5 of
                tow, which is what a Mothership pays instead of bays. */}
            {design.ftl !== 'none' ? (
              <label className="rule-toggle">
                <input
                  type="checkbox"
                  checked={design.ftl === 'tug'}
                  onChange={(event) =>
                    edit(
                      event.target.checked
                        ? { ftl: 'tug', ftlTransferMass: design.ftlTransferMass ?? 0 }
                        : { ftl: 'standard', ftlTransferMass: undefined },
                    )
                  }
                />
                <span>
                  <b>Tug or Mothership</b>{' '}
                  <span className="rule-detail">oversized drive, 1 mass per 5 towed (11.6)</span>
                </span>
              </label>
            ) : null}

            {design.ftl === 'tug' ? (
              <label className="code-field">
                Tow <span className="num">{design.ftlTransferMass ?? 0}</span>
                <input
                  type="range"
                  min={0}
                  max={400}
                  step={10}
                  value={design.ftlTransferMass ?? 0}
                  onChange={(event) => edit({ ftlTransferMass: Number(event.target.value) })}
                />
              </label>
            ) : null}

            {/* 11.7: a rider pays nothing for a drive and is 60 mass at most.
                Whether its Mothership actually turns up is 11.8's business. */}
            {design.ftl === 'none' ? (
              <label className="rule-toggle">
                <input
                  type="checkbox"
                  checked={design.battlerider === true}
                  onChange={(event) =>
                    edit({ battlerider: event.target.checked ? true : undefined })
                  }
                />
                <span>
                  <b>Battlerider</b>{' '}
                  <span className="rule-detail">60 mass at most, and it needs a Mothership (11.7)</span>
                </span>
              </label>
            ) : null}

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

            {/* 7.16: "An area screen counts as one additional level of screen
                for the generating ship and any ship inside it's 6mu 'bubble'."
                20% of the hull per level, minimum 15, and 30%/20 advanced —
                which is why only a big ship can throw one. */}
            <label className="code-field">
              Area screen{' '}
              <span className="num">{design.screens.area ? design.screens.area.level ?? 1 : 0}</span>
              <input
                type="range"
                min={0}
                max={2}
                value={design.screens.area ? design.screens.area.level ?? 1 : 0}
                onChange={(event) => {
                  const level = Number(event.target.value) as 0 | 1 | 2
                  edit({
                    screens: {
                      ...design.screens,
                      area:
                        level === 0
                          ? undefined
                          : { advanced: design.screens.advanced, level },
                    },
                  })
                }}
              />
              <span className="rule-detail">
                {design.screens.area
                  ? `a 6 MU umbrella over the squadron, stacking to 3 (7.16)`
                  : 'none'}
              </span>
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
                  // 7.13's ADS is "mass 2 with 3 arcs; +1 mass for all 6",
                  // so the catalogue lists it twice under one name and the
                  // kind and the label together do not identify a button. The
                  // mass is what tells them apart, on screen and here.
                  key={`${entry.kind}-${entry.label}-${entry.mass}`}
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

            {/* 5.22: "Turrets are sized to fit the weapons they carry" — a
                2-arc turret carries 6 mass of guns per mass of turret, a
                6-arc one only 2, and a ship gets one turret per 50 mass. */}
            <h4>Turrets</h4>
            <div className="panel-row">
              <span className="rule-detail">
                {design.turrets.length} of {maxTurrets(design.mass)} — one per 50 mass (5.22)
              </span>
              <span className="spacer" />
              {([2, 3, 4, 5, 6] as const).map((arcs) => (
                <button
                  key={arcs}
                  disabled={design.turrets.length >= maxTurrets(design.mass)}
                  title={`${TURRET_CAPACITY[arcs]} mass of guns per mass of turret`}
                  onClick={() => {
                    // Sized for what it is meant to carry: the designer picks
                    // the arc spread, and one mass of turret is the smallest
                    // that can hold anything at all.
                    const capacity = TURRET_CAPACITY[arcs]
                    const mass = turretMass(capacity, arcs)
                    edit({
                      turrets: [
                        ...design.turrets,
                        {
                          id: `t${design.turrets.length + 1}`,
                          arcs: [...ALL_ARCS].slice(0, arcs),
                          capacity,
                          mass,
                          points: turretPoints(mass),
                        },
                      ],
                    })
                  }}
                >
                  {arcs} arcs
                </button>
              ))}
            </div>
            {design.turrets.map((turret) => (
              <div className="panel-row" key={turret.id}>
                <span>
                  {turret.id} · {turret.arcs.join(' ')}
                </span>
                <span className="spacer" />
                <span className="num">{turret.capacity} cap</span>
                <span className="num">{turret.mass}m</span>
                <button
                  onClick={() =>
                    edit({
                      turrets: design.turrets.filter((t) => t.id !== turret.id),
                      // A weapon in a turret that is gone goes back to its own
                      // printed arcs rather than pointing nowhere.
                      weapons: design.weapons.map((w) =>
                        w.turretId === turret.id ? { ...w, turretId: undefined } : w,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}

            {/* 6.6: "Each magazine has a mass rating, which determines the
                number of Salvo Missile loads carried: mass 2 for a standard
                salvo, mass 3 for ER." A launcher draws from one magazine; a
                magazine may feed several launchers. */}
            {design.weapons.some((w) => w.weaponClass === 'salvo-missile-launcher') ? (
              <>
                <h4>Magazines</h4>
                <div className="panel-row">
                  <span className="rule-detail">
                    {(design.magazines ?? []).length} fitted — an SML with none fires nothing
                  </span>
                  <span className="spacer" />
                  <button
                    onClick={() =>
                      edit({
                        magazines: [
                          ...(design.magazines ?? []),
                          {
                            id: `m${(design.magazines ?? []).length + 1}`,
                            mass: 0,
                            points: 0,
                            loads: [],
                            // A new magazine feeds every launcher that is not
                            // already fed, which is the common case and the
                            // one 6.6's "one magazine may feed more than one
                            // launcher" is written for.
                            launcherIds: design.weapons
                              .filter(
                                (w) =>
                                  w.weaponClass === 'salvo-missile-launcher' &&
                                  !(design.magazines ?? []).some((m) =>
                                    m.launcherIds.includes(w.id),
                                  ),
                              )
                              .map((w) => w.id),
                          },
                        ],
                      })
                    }
                  >
                    Add magazine
                  </button>
                </div>
                {(design.magazines ?? []).map((magazine) => (
                  <div className="panel-row" key={magazine.id}>
                    <span>
                      {magazine.id} → {magazine.launcherIds.join(', ') || 'nothing'}
                    </span>
                    <span className="spacer" />
                    <span className="num">{magazine.loads.length} salvoes</span>
                    <span className="num">{magazine.mass}m</span>
                    {(['standard', 'extended'] as const).map((grade) => (
                      <button
                        key={grade}
                        title={`${MAGAZINE_LOAD_MASS[grade]} mass a salvo (6.6)`}
                        onClick={() => edit(withLoad(design, magazine.id, grade, 1))}
                      >
                        +{grade === 'standard' ? 'std' : 'ER'}
                      </button>
                    ))}
                    <button
                      disabled={magazine.loads.length === 0}
                      onClick={() => edit(withLoad(design, magazine.id, 'standard', -1))}
                    >
                      −
                    </button>
                    <button
                      onClick={() =>
                        edit({
                          magazines: (design.magazines ?? []).filter((m) => m.id !== magazine.id),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </>
            ) : null}

            <h4>Fitted</h4>
            <FittedWeapons design={design} edit={edit} />

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
                            // 6.6's crossed-off mountings. Without this a
                            // shipyard-built SM Rack fired for ever while the
                            // roster's identical rack fired once.
                            ...(entry.ammo === undefined ? {} : { ammo: entry.ammo }),
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
