import { useState, type ReactNode } from 'react'

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
import {
  ALL_ARCS,
  CATALOGUE_SYSTEMS,
  CATALOGUE_WEAPONS,
  type CatalogueSystem,
  type CatalogueWeapon,
} from '../data/buildCatalog'
import {
  maxTurrets,
  turretMass,
  turretPoints,
  TURRET_CAPACITY,
} from '../engine/weapons/kinetics'
import { allDesigns, SHIP_DESIGNS } from '../data/ships'
import { deleteDesign, saveDesign, savedDesigns } from '../data/shipyard'
import { hullRowBounds } from '../engine/combat'
import { thresholdTarget } from '../engine/dice'
import { FIGHTER_TYPES, type FighterTypeId } from '../engine/fighters'
import { GUNBOAT_TYPES, type GunboatTypeId } from '../engine/gunboats'
import { crewFactors } from '../engine/game'
import type { HullClass, HullRows, ShipDesign, SystemKind, WeaponClass } from '../engine/types'
import { MAGAZINE_LOAD_MASS, MAGAZINE_POINTS_PER_MASS } from '../engine/ordnance'
import { FittedWeapons } from './FittedWeapons'
import { Ssd } from './Ssd'
import { CounterPreview } from './CounterPreview'
import { isCounterArtUrl } from '../data/designFile'

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
 * The weapon catalogue, in the families a designer thinks in (5, 6).
 *
 * Seventy-odd entries with up to six mountings each is a wall if it is laid
 * out flat, which it was. A family at a time is a page of a catalogue.
 */
const FAMILIES: ReadonlyArray<{ id: string; label: string; classes: readonly WeaponClass[] }> = [
  {
    id: 'beams',
    label: 'Beams',
    classes: [
      'beam',
      'graser',
      'heavy-graser',
      'phaser',
      'emp',
      'needle-beam',
      'twin-particle-array',
      'meson-projector',
      'gravitic-gun',
      // 5.21: a beam-type weapon with a pulse mode, not a torpedo.
      'pulser',
    ],
  },
  { id: 'kinetic', label: 'Kinetic', classes: ['k-gun', 'mkp', 'gatling', 'submunition-pack'] },
  {
    id: 'torpedo',
    label: 'Torpedoes & plasma',
    classes: ['pulse-torpedo', 'plasma-cannon', 'plasma-bolt-launcher', 'fusion-array'],
  },
  {
    id: 'ordnance',
    label: 'Ordnance',
    classes: [
      'heavy-missile',
      'salvo-missile-rack',
      'salvo-missile-launcher',
      'antimatter-missile',
      'rocket-pod',
      'mine-rack',
      'boarding-torpedo',
    ],
  },
  {
    id: 'special',
    label: 'Special',
    classes: ['transporter', 'spinal-beam', 'spinal-plasma', 'spinal-psp', 'nova-cannon', 'wave-gun'],
  },
]

function familyOf(weaponClass: WeaponClass): string {
  return FAMILIES.find((f) => f.classes.includes(weaponClass))?.id ?? 'special'
}

/** The fittings catalogue, grouped by what a fitting is for (7, 8, 13.13). */
const SYSTEM_GROUPS: ReadonlyArray<{ label: string; kinds: readonly SystemKind[] }> = [
  {
    label: 'Targeting & sensors',
    kinds: ['firecon', 'advanced-firecon', 'adfc', 'advanced-adfc', 'enhanced-sensors', 'superior-sensors'],
  },
  { label: 'Point defence', kinds: ['pds', 'ads', 'scattergun', 'grapeshot', 'minesweeper'] },
  {
    label: 'Electronic warfare',
    kinds: [
      'ecm',
      'area-ecm',
      'stealth-hull',
      'stealth-field',
      'holofield',
      'cloaking-device',
      'cloaking-field',
      'tuffley-cloak',
      'reflex-field',
      'dummy-bogey',
      'weasel-emitter',
    ],
  },
  {
    label: 'Small craft',
    kinds: ['hangar-bay', 'launch-tube', 'catapult', 'fighter-rack', 'gunboat-rack', 'gunboat-bay', 'boat-bay', 'tender'],
  },
  {
    label: 'Crew, holds & the rest',
    kinds: [
      'damage-control-party',
      'marine-party',
      'cargo',
      'passenger-berthing',
      'troop-berthing',
      'shipyard',
      'ortillery',
      'antimatter-charge',
    ],
  },
]

/**
 * The shipyard.
 *
 * Designing ships is, as the rulebook puts it, "the heart and soul of the
 * game" (2.3), and the thing that makes it a game rather than a form is the
 * trade: mass is finite, and everything competes for it. So the mass bar is
 * the loudest thing on screen, the SSD redraws as you build and never
 * scrolls away, and the faults list says what is wrong in the rulebook's own
 * terms rather than refusing to let you build it.
 *
 * The controls run down the left in the order a designer decides things:
 * the hull, what drives it, what protects it, what is fitted to it, what it
 * shoots with. The sheet on the right is the answer to all of it at once.
 *
 * The arithmetic underneath is the fixed point every Full Thrust designer
 * meets: hull boxes, the drive, FTL, streamlining and screens are all
 * fractions of *total mass*, so raising the hull rating raises the cost of the
 * hull. Changing the mass slider changes everything at once, which is exactly
 * what it does on paper.
 */
export function Shipyard({
  onClose,
  initial = null,
}: {
  onClose: () => void
  /** A design to open on — from the library — rather than a bare hull. */
  initial?: ShipDesign | null
}) {
  const [design, setDesign] = useState<ShipDesign>(() =>
    initial ? structuredClone(initial) : startingPoint(),
  )
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
  const [family, setFamily] = useState('beams')
  /* The designer's hand on the sheet: while this is on, symbols drag. */
  const [arranging, setArranging] = useState(false)
  const [artInput, setArtInput] = useState(design.art ?? '')
  const artOk = artInput.trim() === '' || isCounterArtUrl(artInput.trim())
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

  const addSystem = (entry: CatalogueSystem) => {
    // A share-of-hull system is priced against this hull, not off the
    // catalogue's flat figures (7.17 – 7.25).
    const scaled = proportionalCost(entry.kind, design)
    edit({
      systems: [
        ...design.systems,
        {
          id: `${entry.kind}-${nextIndex(design.systems.map((s) => s.id), entry.kind)}`,
          kind: entry.kind,
          label: entry.label,
          mass: scaled ? scaled.mass : entry.mass,
          points: scaled ? scaled.points : entry.points,
        },
      ],
    })
  }

  const addWeapon = (entry: CatalogueWeapon, mounting: CatalogueWeapon['mountings'][number]) =>
    edit({
      weapons: [
        ...design.weapons,
        {
          id: `w${nextIndex(design.weapons.map((w) => w.id), 'w')}`,
          label: entry.label,
          weaponClass: entry.weaponClass,
          rating: entry.rating,
          variant: entry.variant,
          arcs: [...ALL_ARCS].slice(0, mounting.arcs),
          mass: mounting.mass,
          points: mounting.points,
          // 6.6's crossed-off mountings. Without this a shipyard-built SM Rack
          // fired for ever while the roster's identical rack fired once.
          ...(entry.ammo === undefined ? {} : { ammo: entry.ammo }),
        },
      ],
    })

  const overweight = cost.spare < 0
  const hangars = design.systems.filter((s) => s.kind === 'hangar-bay').length
  const racks = design.systems.filter((s) => s.kind === 'gunboat-rack' || s.kind === 'gunboat-bay').length
  const rows = hullRowBounds(design.hullBoxes, design.hullRows)
  const parties = crewFactors(design.mass, design.group === 'civilian') + design.additionalDamageControlParties

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal is-wide yard-modal" onClick={(event) => event.stopPropagation()}>
        <div className="yard-head">
          <h2>Shipyard</h2>
          <span className="spacer" />
          <button onClick={onClose}>Close</button>
        </div>

        {/* Mass is the whole game here, so it is the loudest thing on screen. */}
        <div className={`mass-bar${overweight ? ' is-over' : ''}`}>
          <div
            className="mass-fill"
            style={{ width: `${Math.min(100, (cost.massUsed / cost.massAvailable) * 100)}%` }}
          />
          <span className="mass-readout num">
            {cost.massUsed} / {cost.massAvailable} mass · {cost.points} CPV
            {cost.spare >= 0 ? ` · ${cost.spare} spare` : ` · ${-cost.spare} over`}
          </span>
        </div>

        {faults.length > 0 ? (
          <ul className="faults">
            {faults.map((fault, i) => (
              <li key={i}>{describeFault(fault)}</li>
            ))}
          </ul>
        ) : (
          <p className="yard-legal">A legal design.</p>
        )}

        <div className="yard">
          <div className="yard-controls">
            <Section title="Hull" rule="13.7 – 13.11">
              <label className="code-field">
                Class name
                <input
                  type="text"
                  value={design.name}
                  onChange={(event) => edit({ name: event.target.value })}
                />
              </label>

              <div className="yard-pair">
                <label className="code-field">
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
                  <label className="code-field">
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
                <label className="code-field">
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
              </div>
              {faction ? <p className="rule-detail">{faction.doctrine}</p> : null}
              {techBase !== 'unrestricted' && offBase.length === 0 ? (
                <p className="yard-legal">Buildable under section 15.</p>
              ) : null}

              {/* 15: "a number of choices as determined by their player group,
                  which they can spend on technologies from the lists below".
                  Spending them here rather than only in the setup panel is the
                  point — this is where a designer finds out that the hull they
                  just drew needs one more choice than the empire bought. */}
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

              <Slider
                label="Hull mass"
                value={design.mass}
                detail={`${design.hullBoxes} hull boxes in ${design.hullRows} rows`}
                min={10}
                max={400}
                step={2}
                onChange={(mass) => edit({ mass })}
              />

              <div className="yard-pair">
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
                        {option.rows} rows — {option.pointsPerBox} pts a box
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="rule-detail">
                {HULL_ROW_OPTIONS.find((o) => o.rows === design.hullRows)?.note}
              </p>

              {/* 13.11: streamlining is what lets a hull enter an atmosphere,
                  and it costs 5% or 10% of the hull to have. It is also what
                  decides whether the hull is drawn as a needle or a box. */}
              <label className="code-field">
                Streamlining
                <select
                  value={design.streamlining}
                  onChange={(event) =>
                    edit({ streamlining: event.target.value as ShipDesign['streamlining'] })
                  }
                >
                  <option value="none">None — never enters an atmosphere</option>
                  <option value="partial">Partial — 5% of mass (13.11)</option>
                  <option value="full">Full — 10% of mass (13.11)</option>
                </select>
              </label>
            </Section>

            <Section title="Drives" rule="3.2, 3.3, 11.1 – 11.7">
              <Slider
                label="Thrust"
                value={design.drive.thrust}
                detail={`${Math.round(design.drive.thrust * 5)}% of mass`}
                min={0}
                max={10}
                onChange={(thrust) => edit({ drive: { ...design.drive, thrust } })}
              />
              <Toggle
                checked={design.drive.advanced}
                onChange={(advanced) => edit({ drive: { ...design.drive, advanced } })}
                title="Advanced drive"
                detail="turns at its full rating, not half (3.3)"
              />
              <Toggle
                checked={design.ftl !== 'none'}
                onChange={(on) =>
                  edit(on ? { ftl: 'standard' } : { ftl: 'none', ftlTransferMass: undefined })
                }
                title="FTL drive"
                detail="10% of mass (11.1)"
              />
              {/* 11.6: a tug's drive is its own 10% plus 1 mass for every 5 of
                  tow, which is what a Mothership pays instead of bays. */}
              {design.ftl !== 'none' ? (
                <Toggle
                  checked={design.ftl === 'tug'}
                  onChange={(on) =>
                    edit(
                      on
                        ? { ftl: 'tug', ftlTransferMass: design.ftlTransferMass ?? 0 }
                        : { ftl: 'standard', ftlTransferMass: undefined },
                    )
                  }
                  title="Tug or Mothership"
                  detail="oversized drive, 1 mass per 5 towed (11.6)"
                />
              ) : null}
              {design.ftl === 'tug' ? (
                <Slider
                  label="Tow"
                  value={design.ftlTransferMass ?? 0}
                  detail="mass it can carry through FTL"
                  min={0}
                  max={400}
                  step={10}
                  onChange={(ftlTransferMass) => edit({ ftlTransferMass })}
                />
              ) : null}
              {/* 11.7: a rider pays nothing for a drive and is 60 mass at most.
                  Whether its Mothership actually turns up is 11.8's business. */}
              {design.ftl === 'none' ? (
                <Toggle
                  checked={design.battlerider === true}
                  onChange={(on) => edit({ battlerider: on ? true : undefined })}
                  title="Battlerider"
                  detail="60 mass at most, and it needs a Mothership (11.7)"
                />
              ) : null}
            </Section>

            <Section title="Defences" rule="4.8, 7.2, 7.8, 7.16">
              <Slider
                label="Screens"
                value={design.screens.level}
                detail={
                  design.screens.level === 0
                    ? 'none'
                    : `level ${design.screens.level}, ${design.screens.level} generator${design.screens.level > 1 ? 's' : ''} on the sheet`
                }
                min={0}
                max={2}
                onChange={(value) => {
                  const level = value as 0 | 1 | 2
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
              {/* 7.16: "An area screen counts as one additional level of screen
                  for the generating ship and any ship inside it's 6mu
                  'bubble'." 20% of the hull per level, minimum 15, and 30%/20
                  advanced — which is why only a big ship can throw one. */}
              <Slider
                label="Area screen"
                value={design.screens.area ? (design.screens.area.level ?? 1) : 0}
                detail={
                  design.screens.area
                    ? 'a 6 MU umbrella over the squadron, stacking to 3 (7.16)'
                    : 'none'
                }
                min={0}
                max={2}
                onChange={(value) => {
                  const level = value as 0 | 1 | 2
                  edit({
                    screens: {
                      ...design.screens,
                      area: level === 0 ? undefined : { advanced: design.screens.advanced, level },
                    },
                  })
                }}
              />
              <Slider
                label="Armour"
                value={design.armour.layers[0] ?? 0}
                detail="one mass a box, taken before the hull (4.8)"
                min={0}
                max={40}
                onChange={(boxes) =>
                  edit({ armour: { ...design.armour, layers: boxes === 0 ? [] : [boxes] } })
                }
              />
              <Toggle
                checked={design.armour.regenerative}
                onChange={(regenerative) => edit({ armour: { ...design.armour, regenerative } })}
                title="Regenerative armour"
                detail="knits back between turns, at a surcharge a box (7.8)"
              />
            </Section>

            <Section title="Fittings" rule="7, 13.12, 13.13">
              <FittedSystems design={design} edit={edit} />
              {SYSTEM_GROUPS.map((group) => {
                const entries = CATALOGUE_SYSTEMS.filter((e) => group.kinds.includes(e.kind))
                if (entries.length === 0) return null
                return (
                  <div key={group.label} className="catalogue-group">
                    <h4>{group.label}</h4>
                    <div className="design-list">
                      {entries.map((entry) => (
                        <button
                          // 7.13's ADS is "mass 2 with 3 arcs; +1 mass for all
                          // 6", so the catalogue lists it twice under one name
                          // and the kind and the label together do not
                          // identify a button. The mass is what tells them
                          // apart, on screen and here.
                          key={`${entry.kind}-${entry.label}-${entry.mass}`}
                          className="design-chip"
                          title={`${entry.mass} mass, ${entry.points} points`}
                          onClick={() => addSystem(entry)}
                        >
                          {entry.label}
                          <span className="num">{entry.mass}m</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </Section>

            {hangars > 0 || racks > 0 ? (
              <Section title="Small craft" rule="8.2, 8.15, 9.1">
                <SmallCraft design={design} edit={edit} hangars={hangars} racks={racks} />
              </Section>
            ) : null}

            <Section title="Weapons" rule="4.2, 5, 6">
              <div className="family-tabs" role="tablist">
                {FAMILIES.map((f) => (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={family === f.id}
                    className={`family-tab${family === f.id ? ' is-on' : ''}`}
                    onClick={() => setFamily(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="catalogue">
                {CATALOGUE_WEAPONS.filter((e) => familyOf(e.weaponClass) === family).map((entry) => (
                  <div
                    className="catalogue-row"
                    key={`${entry.weaponClass}-${entry.variant}-${entry.rating}`}
                  >
                    <span className="catalogue-name">{entry.label}</span>
                    <span className="catalogue-mounts">
                      {entry.mountings.map((mounting) => (
                        <button
                          key={mounting.arcs}
                          className="mount-btn"
                          title={`${mounting.arcs} arc${mounting.arcs > 1 ? 's' : ''}: ${mounting.mass} mass, ${mounting.points} points`}
                          onClick={() => addWeapon(entry, mounting)}
                        >
                          <b>{mounting.arcs}</b>
                          <span className="num">{mounting.mass}m</span>
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <p className="rule-detail">
                A mounting is bought by how many arcs it covers; which arcs is yours to choose once
                it is fitted (4.2).
              </p>
            </Section>

            <Section title="Fitted weapons" rule="4.2, 5.16, 5.22, 6.6">
              <FittedWeapons design={design} edit={edit} />
            </Section>

            {/* 5.22: "Turrets are sized to fit the weapons they carry" — a
                2-arc turret carries 6 mass of guns per mass of turret, a
                6-arc one only 2, and a ship gets one turret per 50 mass. */}
            <Section title="Turrets" rule="5.22">
              <div className="panel-row">
                <span className="rule-detail">
                  {design.turrets.length} of {maxTurrets(design.mass)} — one per 50 mass
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
                    {arcs}-arc
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
            </Section>

            {/* 6.6: "Each magazine has a mass rating, which determines the
                number of Salvo Missile loads carried: mass 2 for a standard
                salvo, mass 3 for ER." A launcher draws from one magazine; a
                magazine may feed several launchers. */}
            {design.weapons.some((w) => w.weaponClass === 'salvo-missile-launcher') ? (
              <Section title="Magazines" rule="6.6">
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
              </Section>
            ) : null}
          </div>

          <aside className="yard-side">
            <div className={`yard-sheet${arranging ? ' is-arranging' : ''}`}>
              <Ssd
                design={design}
                onMoveGlyph={
                  arranging
                    ? (key, x, y) => edit({ layout: { ...(design.layout ?? {}), [key]: { x, y } } })
                    : undefined
                }
              />
            </div>

            {/* The sheet's own look: where the symbols sit, and what the
                counter shows on the table. Neither changes a point of the
                design; both travel with it. */}
            <div className="panel-row yard-arrange">
              <button
                className={arranging ? 'primary' : undefined}
                aria-pressed={arranging}
                title="Drag the symbols about the sheet; the hull is drawn round wherever they end up"
                onClick={() => setArranging((on) => !on)}
              >
                {arranging ? 'Done arranging' : 'Arrange the sheet'}
              </button>
              <button
                disabled={design.layout === undefined}
                title="Put every symbol back where the sheet lays it out"
                onClick={() => edit({ layout: undefined })}
              >
                Reset layout
              </button>
              <span className="spacer" />
              <span className="rule-detail">
                {arranging
                  ? 'Drag a symbol to move it.'
                  : design.layout
                    ? `${Object.keys(design.layout).length} placed by hand`
                    : ''}
              </span>
            </div>
            <div className="yard-art">
              <label className="code-field">
                Counter image URL
                <input
                  type="text"
                  value={artInput}
                  placeholder="https://… or data:image/png;base64,…"
                  spellCheck={false}
                  onChange={(event) => {
                    const value = event.target.value
                    setArtInput(value)
                    const trimmed = value.trim()
                    if (trimmed === '') edit({ art: undefined })
                    else if (isCounterArtUrl(trimmed)) edit({ art: trimmed })
                  }}
                />
              </label>
              <CounterPreview design={design} size={80} />
            </div>
            <p className="rule-detail">
              {!artOk
                ? 'Not a picture the map can load: an https:// address or a pasted data:image URL.'
                : design.art
                  ? 'Drawn nose-up in place of the silhouette, on every table this design reaches.'
                  : 'Leave it blank and the counter is the hull outline with its guns.'}
            </p>

            {/* The numbers a captain will read off this hull in a fight, so the
                designer sees them while there is still time to change them. */}
            <dl className="summary-strip">
              <div>
                <dt>Hull</dt>
                <dd>
                  {design.hullBoxes} boxes · {rows.length} rows
                </dd>
              </div>
              <div>
                <dt>Thresholds</dt>
                <dd>
                  {rows
                    .slice(0, -1)
                    .map((_, i) => `${thresholdTarget(i + 1)}+`)
                    .join(' · ') || 'none'}
                </dd>
              </div>
              <div>
                <dt>Armour</dt>
                <dd>
                  {design.armour.layers.reduce((a, b) => a + b, 0) || 'none'}
                  {design.armour.regenerative ? ' regen' : ''}
                </dd>
              </div>
              <div>
                <dt>Screens</dt>
                <dd>
                  {design.screens.level === 0 ? 'none' : `level ${design.screens.level}`}
                  {design.screens.area ? ` + area ${design.screens.area.level ?? 1}` : ''}
                </dd>
              </div>
              <div>
                <dt>Crew</dt>
                <dd>
                  {parties} DCP · {design.marineParties} marines
                </dd>
              </div>
              <div>
                <dt>Mounts</dt>
                <dd>
                  {design.weapons.length} weapons · {design.systems.length} fittings
                </dd>
              </div>
            </dl>

            <div className="yard-actions">
              <button
                onClick={() => {
                  setDesign(startingPoint())
                  setArtInput('')
                  setArranging(false)
                }}
              >
                Start over
              </button>
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
                  const id = yardId(slug(design.name) || 'new-design')
                  saveDesign({ ...design, id })
                  setYard([...savedDesigns()])
                  setSaved(id)
                }}
              >
                Save to the yard
              </button>
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
                Download
              </button>
            </div>
            {saved ? (
              <p className="rule-detail yard-legal">
                Saved as <code>{saved}</code>. It is in the fleet picker now, and any battle that
                uses it carries its own copy.
              </p>
            ) : (
              <p className="rule-detail">
                A saved design joins the fleet picker beside the shipped roster. A downloaded one
                is a file you can keep or send.
              </p>
            )}

            {yard.length > 0 ? (
              <div className="catalogue-group">
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
                        setArtInput(entry.art ?? '')
                        setSaved(null)
                      }}
                    >
                      {entry.name}
                      <span className="num">{entry.points}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Section({ title, rule, children }: { title: string; rule: string; children: ReactNode }) {
  return (
    <section className="yard-section">
      <h3>
        {title} <span className="rule-ref">{rule}</span>
      </h3>
      {children}
    </section>
  )
}

function Slider({
  label,
  value,
  detail,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  detail?: string
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="code-field yard-slider">
      <span className="yard-slider-head">
        {label} <b className="num">{value}</b>
        {detail ? <span className="rule-detail">{detail}</span> : null}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function Toggle({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  title: string
  detail: string
}) {
  return (
    <label className="rule-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <b>{title}</b> <span className="rule-detail">{detail}</span>
      </span>
    </label>
  )
}

/**
 * What is already fitted, tallied by kind, with a way to take it off again.
 *
 * The old yard could add a fitting and never remove one: a mis-click was a
 * new design. Tallied because a ship with four PDS is a ship with "PDS ×4",
 * not four things to read.
 */
function FittedSystems({
  design,
  edit,
}: {
  design: ShipDesign
  edit: (patch: Partial<ShipDesign>) => void
}) {
  const fitted = design.systems.filter((s) => s.kind !== 'screen-generator' && s.kind !== 'ftl-drive')
  if (fitted.length === 0) return <p className="rule-detail">Nothing fitted yet.</p>

  const tallies = new Map<string, { label: string; count: number; last: ShipDesign['systems'][number] }>()
  for (const system of fitted) {
    const key = `${system.kind}|${system.label}|${system.mass}`
    const seen = tallies.get(key)
    if (seen) {
      seen.count += 1
      seen.last = system
    } else {
      tallies.set(key, { label: system.label, count: 1, last: system })
    }
  }

  return (
    <div className="fitted-systems">
      {[...tallies.entries()].map(([key, tally]) => (
        <span className="tally-chip" key={key}>
          {tally.label}
          <span className="num">×{tally.count}</span>
          <button
            title="Take one off"
            aria-label={`Remove one ${tally.label}`}
            onClick={() => edit({ systems: design.systems.filter((s) => s.id !== tally.last.id) })}
          >
            −
          </button>
          <button
            title="Fit another"
            aria-label={`Add another ${tally.label}`}
            onClick={() =>
              edit({
                systems: [
                  ...design.systems,
                  {
                    ...tally.last,
                    id: `${tally.last.kind}-${nextIndex(design.systems.map((s) => s.id), tally.last.kind)}`,
                  },
                ],
              })
            }
          >
            +
          </button>
        </span>
      ))}
    </div>
  )
}

/**
 * What rides in the hangars and on the racks (8.2, 8.15, 9.1).
 *
 * A bay is a fitting; a wing is what makes it a carrier, and a hull with
 * hangars and nothing in them launched nothing. One wing per hangar, one
 * squadron per rack, chosen by type — the modifications of 8.15 are a design
 * of their own and stay in the roster's hands for now.
 */
function SmallCraft({
  design,
  edit,
  hangars,
  racks,
}: {
  design: ShipDesign
  edit: (patch: Partial<ShipDesign>) => void
  hangars: number
  racks: number
}) {
  const fighterTypes = Object.values(FIGHTER_TYPES)
  const gunboatTypes = Object.values(GUNBOAT_TYPES)
  return (
    <>
      {hangars > 0 ? (
        <div className="catalogue-group">
          <h4>
            Wings <span className="rule-detail">{design.fighterBays.length} of {hangars} hangars filled</span>
          </h4>
          {design.fighterBays.map((wing, i) => (
            <div className="panel-row" key={i}>
              <select
                aria-label={`Wing ${i + 1} type`}
                value={wing.typeId}
                onChange={(event) => {
                  const typeId = event.target.value as FighterTypeId
                  const bays = design.fighterBays.map((w, j) =>
                    j === i ? { ...w, typeId, label: `${FIGHTER_TYPES[typeId].label} wing` } : w,
                  )
                  edit({ fighterBays: bays })
                }}
              >
                {fighterTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label} — {type.pointsPerWing} pts a wing
                  </option>
                ))}
              </select>
              <span className="spacer" />
              <button onClick={() => edit({ fighterBays: design.fighterBays.filter((_, j) => j !== i) })}>
                Remove
              </button>
            </div>
          ))}
          <button
            disabled={design.fighterBays.length >= hangars}
            onClick={() =>
              edit({
                fighterBays: [
                  ...design.fighterBays,
                  { typeId: 'standard', label: `${FIGHTER_TYPES.standard.label} wing` },
                ],
              })
            }
          >
            Embark a wing
          </button>
        </div>
      ) : null}
      {racks > 0 ? (
        <div className="catalogue-group">
          <h4>
            Gunboat squadrons{' '}
            <span className="rule-detail">{design.gunboats.length} of {racks} racks filled</span>
          </h4>
          {design.gunboats.map((squadron, i) => (
            <div className="panel-row" key={i}>
              <select
                aria-label={`Squadron ${i + 1} type`}
                value={squadron.typeId}
                onChange={(event) => {
                  const typeId = event.target.value as GunboatTypeId
                  const list = design.gunboats.map((s, j) =>
                    j === i ? { ...s, typeId, label: `${GUNBOAT_TYPES[typeId].label} squadron` } : s,
                  )
                  edit({ gunboats: list })
                }}
              >
                {gunboatTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
              <span className="spacer" />
              <button onClick={() => edit({ gunboats: design.gunboats.filter((_, j) => j !== i) })}>
                Remove
              </button>
            </div>
          ))}
          <button
            disabled={design.gunboats.length >= racks}
            onClick={() =>
              edit({
                gunboats: [
                  ...design.gunboats,
                  { typeId: 'beam', label: `${GUNBOAT_TYPES.beam.label} squadron` },
                ],
              })
            }
          >
            Embark a squadron
          </button>
        </div>
      ) : null}
    </>
  )
}

/** The next free numeric suffix for an id with this stem, so ids never collide. */
function nextIndex(ids: string[], stem: string): number {
  let highest = 0
  for (const id of ids) {
    const match = new RegExp(`^${stem}-?(\\d+)$`).exec(id)
    if (match) highest = Math.max(highest, Number(match[1]))
  }
  return highest + 1
}

/** A class name as an id: lower case, hyphens, nothing else (13). */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * An id the yard may keep a design under. A roster id is shared vocabulary —
 * `esu-frigate` means the roster's frigate on every table — so a design that
 * would take one is stored beside it instead of shadowing it.
 */
function yardId(id: string): string {
  return SHIP_DESIGNS.some((d) => d.id === id) ? `${id}-custom` : id
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
