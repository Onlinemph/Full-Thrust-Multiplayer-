import { useEffect, useMemo, useState } from 'react'

import { MOBILITY_KINDS, mobilityKind } from '../../dirtside/data/mobility'
import { WEAPON_KINDS, weaponKind } from '../../dirtside/data/weapons'
import { capacityLines, capacityOf, isAir, isWater, newVehicleDesign, summariseDesign, validateDesign } from '../../dirtside/design'
import { deleteVehicleDesign, isBookDesign, motorPoolDesigns, saveVehicleDesign } from '../../dirtside/library'
import { ordnanceLoadsCost, priceDesign } from '../../dirtside/pricing'
import { recordCardOf } from '../../dirtside/recordCard'
import type { ArtilleryClass, DirectFireWeapon, EcmLevel, MissileSystem, MobilityType, PowerPlant, SizeClass, SystemLevel, VehicleDesign, WeaponClass, WeaponType } from '../../dirtside/types'
import { FiringRange } from './FiringRange'
import { PrintCards } from './PrintCards'
import { RecordCard } from './RecordCard'

/**
 * The Motor Pool: Dirtside II's vehicle designer (Chapter 3) and its
 * costing (Appendix), with the record card the book asks you to keep for
 * every vehicle type (p. 55) filled in as you go.
 *
 * The decisions run down the left in the order the book takes them —
 * size and mobility, the power plant, armour, then the guns, the systems
 * and what it carries — and the card, the capacity and the points sit on
 * the right, changing with every click. A fault names the page that
 * refuses it and does not stop you building: half a design is a
 * legitimate thing to have on the bench.
 */
export interface MotorPoolProps {
  onClose: () => void
}

const LEVELS: SystemLevel[] = ['basic', 'enhanced', 'superior']
const ECM_LEVELS: EcmLevel[] = ['none', 'basic', 'enhanced', 'superior']
const SIZES: SizeClass[] = [1, 2, 3, 4, 5, 6, 7]
const SIZE_NAMES: Record<SizeClass, string> = { 1: 'very small', 2: 'small', 3: 'medium', 4: 'large', 5: 'very large', 6: 'oversize', 7: 'oversize' }

let counter = 0
const nextId = (stem: string) => `${stem}-${Date.now().toString(36)}-${(counter += 1)}`

export function MotorPool({ onClose }: MotorPoolProps) {
  const [shelf, setShelf] = useState(() => motorPoolDesigns())
  const [design, setDesign] = useState<VehicleDesign>(() => structuredClone(shelf[2] ?? newVehicleDesign(nextId('vehicle'))))
  const [savedAs, setSavedAs] = useState<string | null>(null)
  const [printing, setPrinting] = useState<'one' | 'shelf' | null>(null)
  const [range, setRange] = useState(false)

  const set = (patch: Partial<VehicleDesign>) => {
    setDesign((d) => ({ ...d, ...patch }))
    setSavedAs(null)
  }
  const summary = useMemo(() => summariseDesign(design), [design])
  const faults = useMemo(() => validateDesign(design), [design])
  const cost = useMemo(() => priceDesign(design), [design])
  const card = useMemo(() => recordCardOf(design), [design])
  const capacity = capacityOf(design.size)
  const fromBook = isBookDesign(design.id)
  const onShelf = shelf.some((d) => d.id === design.id)

  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(null)
    window.addEventListener('afterprint', done)
    const id = window.setTimeout(() => window.print(), 60)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('afterprint', done)
    }
  }, [printing])

  const save = () => {
    const copy = fromBook ? { ...design, id: nextId('vehicle'), name: `${design.name} (copy)` } : design
    saveVehicleDesign(copy)
    setDesign(copy)
    setShelf(motorPoolDesigns())
    setSavedAs(copy.name)
  }
  const remove = () => {
    if (fromBook) return
    deleteVehicleDesign(design.id)
    setShelf(motorPoolDesigns())
    setDesign(structuredClone(motorPoolDesigns()[0]!))
  }
  const pick = (id: string) => {
    const found = shelf.find((d) => d.id === id)
    if (found) {
      setDesign(structuredClone(found))
      setSavedAs(null)
    }
  }

  const weaponsOf = (patch: (weapons: DirectFireWeapon[]) => DirectFireWeapon[]) => set({ weapons: patch(design.weapons) })
  const addWeapon = () => {
    const cls = (Math.min(5, design.size) || 1) as WeaponClass
    const type: WeaponType = cls >= 3 ? 'hkp' : 'rfac'
    weaponsOf((w) => [...w, { id: nextId('w'), type, class: cls, mount: design.weapons.length === 0 ? 'turret' : 'fixed', barrels: 1 }])
    if (!design.fireControl) set({ fireControl: 'basic' })
  }
  const setWeapon = (id: string, patch: Partial<DirectFireWeapon>) => weaponsOf((w) => w.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const missilesOf = (patch: (m: MissileSystem[]) => MissileSystem[]) => set({ missiles: patch(design.missiles) })

  const number = (value: string, fallback: number) => {
    const n = Math.floor(Number(value))
    return Number.isFinite(n) ? n : fallback
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal is-wide yard-modal ds-pool" onClick={(event) => event.stopPropagation()}>
        <div className="yard-head">
          <h2>Motor Pool</h2>
          <span className="campaign-kicker">Dirtside II</span>
          <label className="ds-shelf">
            Shelf{' '}
            <select value={onShelf ? design.id : ''} onChange={(e) => pick(e.target.value)}>
              {!onShelf ? <option value="">(unsaved design)</option> : null}
              <optgroup label="The book's vehicles (p. 53)">
                {shelf.filter((d) => isBookDesign(d.id)).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {priceDesign(d).total}
                  </option>
                ))}
              </optgroup>
              {shelf.some((d) => !isBookDesign(d.id)) ? (
                <optgroup label="Your designs">
                  {shelf.filter((d) => !isBookDesign(d.id)).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {priceDesign(d).total}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <button onClick={() => { setDesign(newVehicleDesign(nextId('vehicle'))); setSavedAs(null) }}>New hull</button>
          <button onClick={() => setRange(true)} disabled={design.weapons.length === 0} title={design.weapons.length === 0 ? 'Fit a direct-fire weapon first' : 'Try this design\'s guns against any target'}>
            Firing range
          </button>
          <span className="spacer" />
          {faults.filter((f) => !f.advisory).length === 0 ? <p className="yard-legal">A legal design.</p> : null}
          <button onClick={onClose}>Close</button>
        </div>

        <div className="yard">
          <div className="yard-controls">
            <section className="yard-section">
              <h3>
                Hull <span className="rule-ref">p. 8, p. 10, p. 25</span>
              </h3>
              <div className="yard-pair">
                <label className="code-field">
                  Name
                  <input value={design.name} onChange={(e) => set({ name: e.target.value })} />
                </label>
                <label className="code-field">
                  Type
                  <input value={design.role} onChange={(e) => set({ role: e.target.value })} placeholder="Heavy GEV tank" />
                </label>
              </div>
              <div className="yard-pair">
                <label className="code-field">
                  Size class
                  <select value={design.size} onChange={(e) => set({ size: Number(e.target.value) as SizeClass })}>
                    {SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s} · {SIZE_NAMES[s]} · capacity {capacityOf(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="code-field">
                  Mobility
                  <select value={design.mobility} onChange={(e) => set({ mobility: e.target.value as MobilityType, variant: undefined })}>
                    {MOBILITY_KINDS.map((m) => (
                      <option key={m.type} value={m.type}>
                        {m.label}
                        {m.bmf !== null ? ` · ${m.bmf}"` : ''} · {m.costPercent}% of BVP
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="yard-pair">
                {design.mobility === 'vtol' ? (
                  <label className="code-field">
                    VTOL kind
                    <select value={design.variant ?? 'transport'} onChange={(e) => set({ variant: e.target.value as VehicleDesign['variant'] })}>
                      <option value="transport">Transport or helicopter · 24"</option>
                      <option value="attack">Attack, gunship or scout · 30"</option>
                    </select>
                  </label>
                ) : null}
                {isWater(design) ? (
                  <label className="code-field">
                    Vessel kind
                    <select value={design.variant ?? 'gunboat'} onChange={(e) => set({ variant: e.target.value as VehicleDesign['variant'] })}>
                      <option value="gunboat">Gunboat or patrol boat · 12"</option>
                      <option value="monitor">Monitor, landing craft or civilian · 8"</option>
                      <option value="assault-boat">Small assault boat · 15"</option>
                    </select>
                  </label>
                ) : null}
                <label className="code-field">
                  Power plant
                  <select value={design.power} onChange={(e) => set({ power: e.target.value as PowerPlant })}>
                    <option value="cfe">CFE · chemical fuel · 20% of BVP</option>
                    <option value="hmt">HMT · hydromagnetic turbine · 40%</option>
                    <option value="fgp">FGP · fusion plant · 60%</option>
                  </select>
                </label>
                {!isAir(design) && !isWater(design) ? (
                  <label>
                    <input type="checkbox" checked={design.amphibious} onChange={(e) => set({ amphibious: e.target.checked })} /> Amphibious (+20% of BVP)
                  </label>
                ) : null}
              </div>
            </section>

            <section className="yard-section">
              <h3>
                Armour <span className="rule-ref">p. 10</span>
              </h3>
              <div className="yard-pair">
                <label className="code-field">
                  Front armour ({design.armour}; sides, top and rear {summary.sideArmour})
                  <input type="range" min={0} max={7} value={design.armour} onChange={(e) => set({ armour: Number(e.target.value) })} />
                </label>
                <label className="code-field">
                  Special
                  <select value={design.armourSpecial} onChange={(e) => set({ armourSpecial: e.target.value as VehicleDesign['armourSpecial'] })}>
                    <option value="none">None</option>
                    <option value="ablative">Ablative (green chits only from lasers)</option>
                    <option value="reactive">Reactive (red chits only from missiles)</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="yard-section">
              <h3>
                Direct-fire weapons <span className="rule-ref">pp. 8–9, p. 11, p. 28</span>
              </h3>
              {design.weapons.map((weapon, index) => {
                const kind = weaponKind(weapon.type)
                return (
                  <div className="panel-row ds-weapon" key={weapon.id}>
                    <select aria-label="Weapon type" value={weapon.type} onChange={(e) => {
                      const type = e.target.value as WeaponType
                      const classes = weaponKind(type).classes
                      setWeapon(weapon.id, { type, class: classes.includes(weapon.class) ? weapon.class : classes[0]! })
                    }}>
                      {WEAPON_KINDS.map((k) => (
                        <option key={k.type} value={k.type}>
                          {k.short} · {k.label}
                        </option>
                      ))}
                    </select>
                    <select aria-label="Weapon class" value={weapon.class} onChange={(e) => setWeapon(weapon.id, { class: Number(e.target.value) as WeaponClass })}>
                      {kind.classes.map((c) => (
                        <option key={c} value={c}>
                          class {c}
                        </option>
                      ))}
                    </select>
                    <select aria-label="Mount" value={weapon.mount} onChange={(e) => setWeapon(weapon.id, { mount: e.target.value as DirectFireWeapon['mount'] })}>
                      <option value="turret">Turret · 360°</option>
                      <option value="fixed">Fixed · 30°</option>
                    </select>
                    <label className="campaign-inline">
                      barrels
                      <input aria-label="Barrels" className="num" type="number" min={1} max={4} value={weapon.barrels} onChange={(e) => setWeapon(weapon.id, { barrels: Math.max(1, number(e.target.value, 1)) })} />
                    </label>
                    <span className="campaign-dim">
                      {index === design.weapons.findIndex((w) => w.class === Math.max(...design.weapons.map((x) => x.class))) ? 'primary · ' : ''}
                      {capacityLines(design).find((l) => l.label.startsWith(`${kind.short}/${weapon.class}`) && l.label.includes(weapon.mount))?.capacity ?? 0} capacity
                    </span>
                    <button aria-label={`Remove ${kind.short}/${weapon.class}`} onClick={() => weaponsOf((w) => w.filter((x) => x.id !== weapon.id))}>
                      ×
                    </button>
                  </div>
                )
              })}
              <div className="campaign-inline">
                <button onClick={addWeapon}>Add a weapon</button>
                <label className="campaign-inline">
                  Fire control
                  <select value={design.fireControl ?? ''} onChange={(e) => set({ fireControl: (e.target.value || null) as SystemLevel | null })}>
                    <option value="">none</option>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l} · D{{ basic: 6, enhanced: 8, superior: 10 }[l]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campaign-inline">
                  Extra APSWs
                  <input className="num" type="number" min={0} max={5} value={design.extraApsw} onChange={(e) => set({ extraApsw: Math.max(0, number(e.target.value, 0)) })} />
                </label>
              </div>
              <p className="campaign-dim">Every military vehicle has one APSW free (p. 11). The largest weapon is the primary: 3 × class in a turret, 2 × class fixed; every other barrel 2 × class.</p>
            </section>

            <section className="yard-section">
              <h3>
                Guided missiles and defences <span className="rule-ref">p. 9, p. 31</span>
              </h3>
              {design.missiles.map((missile) => (
                <div className="panel-row" key={missile.id}>
                  <select aria-label="Missile size" value={missile.size} onChange={(e) => missilesOf((m) => m.map((x) => (x.id === missile.id ? { ...x, size: e.target.value as MissileSystem['size'] } : x)))}>
                    <option value="light">GMS/L · 36" · 3 chits</option>
                    <option value="heavy">GMS/H · 48" · 5 chits</option>
                  </select>
                  <select aria-label="Guidance" value={missile.guidance} onChange={(e) => missilesOf((m) => m.map((x) => (x.id === missile.id ? { ...x, guidance: e.target.value as SystemLevel } : x)))}>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l} guidance
                      </option>
                    ))}
                  </select>
                  <button aria-label="Remove missile system" onClick={() => missilesOf((m) => m.filter((x) => x.id !== missile.id))}>
                    ×
                  </button>
                </div>
              ))}
              <div className="campaign-inline">
                <button onClick={() => missilesOf((m) => [...m, { id: nextId('m'), size: 'light', guidance: 'basic' }])}>Add a missile system</button>
                <label className="campaign-inline">
                  PDS
                  <select value={design.pds ?? ''} onChange={(e) => set({ pds: (e.target.value || null) as SystemLevel | null })}>
                    <option value="">none</option>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campaign-inline">
                  ADS
                  <select value={design.ads ?? ''} onChange={(e) => set({ ads: (e.target.value || null) as SystemLevel | null })}>
                    <option value="">none</option>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campaign-inline">
                  LAD
                  <input className="num" type="number" min={0} max={3} value={design.lad} onChange={(e) => set({ lad: Math.max(0, number(e.target.value, 0)) })} />
                </label>
                <label>
                  <input type="checkbox" checked={design.apfc} onChange={(e) => set({ apfc: e.target.checked })} /> APFC belt
                </label>
              </div>
            </section>

            <section className="yard-section">
              <h3>
                Electronics <span className="rule-ref">p. 11, p. 45</span>
              </h3>
              <div className="campaign-inline">
                <label className="campaign-inline">
                  ECM
                  <select value={design.ecm} onChange={(e) => set({ ecm: e.target.value as EcmLevel })}>
                    {ECM_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campaign-inline">
                  Stealth levels
                  <input className="num" type="number" min={0} max={4} value={design.stealth} onChange={(e) => set({ stealth: Math.max(0, number(e.target.value, 0)) })} />
                </label>
                <label>
                  <input type="checkbox" checked={design.backupSystems} onChange={(e) => set({ backupSystems: e.target.checked })} /> Backup systems (+30% of the systems)
                </label>
              </div>
              <p className="campaign-dim">
                Basic signature {summary.basicSignature}, effective {summary.effectiveSignature}: the enemy rolls a D{summary.targetDie} to defend against a shot at it (p. 29).
              </p>
            </section>

            <section className="yard-section">
              <h3>
                Carried <span className="rule-ref">p. 12, p. 16</span>
              </h3>
              <div className="campaign-inline">
                <label className="campaign-inline">
                  Line/militia teams
                  <input className="num" type="number" min={0} max={8} value={design.transport.lineTeams} onChange={(e) => set({ transport: { ...design.transport, lineTeams: Math.max(0, number(e.target.value, 0)) } })} />
                </label>
                <label className="campaign-inline">
                  Powered teams
                  <input className="num" type="number" min={0} max={4} value={design.transport.poweredTeams} onChange={(e) => set({ transport: { ...design.transport, poweredTeams: Math.max(0, number(e.target.value, 0)) } })} />
                </label>
                <label className="campaign-inline">
                  Cargo loads
                  <input className="num" type="number" min={0} max={8} value={design.transport.cargoLoads} onChange={(e) => set({ transport: { ...design.transport, cargoLoads: Math.max(0, number(e.target.value, 0)) } })} />
                </label>
                <label className="campaign-inline">
                  Carried vehicle sizes
                  <input aria-label="Carried vehicle sizes" placeholder="e.g. 1, 1" value={design.transport.vehicleSizes.join(', ')} onChange={(e) => set({ transport: { ...design.transport, vehicleSizes: e.target.value.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0) } })} />
                </label>
                <label>
                  <input type="checkbox" checked={design.transport.commandCentre} onChange={(e) => set({ transport: { ...design.transport, commandCentre: e.target.checked } })} /> Command/communications centre
                </label>
              </div>
            </section>

            <section className="yard-section">
              <h3>
                Artillery, air and engineering <span className="rule-ref">p. 12, p. 14, p. 53</span>
              </h3>
              <div className="campaign-inline">
                <label className="campaign-inline">
                  Artillery
                  <select value={design.artillery ?? ''} onChange={(e) => set({ artillery: (e.target.value || null) as ArtilleryClass | null })}>
                    <option value="">none</option>
                    <option value="light">Light (RAM mortar, class 2)</option>
                    <option value="medium">Medium (RAM guns, small MRLs, class 4)</option>
                    <option value="heavy">Heavy (MD guns, large MRLs, HARs, class 6)</option>
                  </select>
                </label>
                <label className="campaign-inline">
                  Counter-battery radar
                  <select value={design.counterBatteryRadar ?? ''} onChange={(e) => set({ counterBatteryRadar: (e.target.value || null) as SystemLevel | null })}>
                    <option value="">none</option>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                {design.mobility === 'aerospace' ? (
                  <label className="campaign-inline">
                    Ordnance loads
                    <input className="num" type="number" min={0} max={6} value={design.ordnanceLoads} onChange={(e) => set({ ordnanceLoads: Math.max(0, number(e.target.value, 0)) })} />
                  </label>
                ) : null}
              </div>
              <div className="campaign-inline">
                <label>
                  <input type="checkbox" checked={design.engineering.repair} onChange={(e) => set({ engineering: { ...design.engineering, repair: e.target.checked } })} /> Repair/recovery package
                </label>
                <label>
                  <input type="checkbox" checked={design.engineering.general} onChange={(e) => set({ engineering: { ...design.engineering, general: e.target.checked } })} /> Engineering package
                </label>
                <label className="campaign-inline">
                  Bridge class
                  <input className="num" type="number" min={0} max={7} value={design.engineering.bridgeClass ?? 0} onChange={(e) => set({ engineering: { ...design.engineering, bridgeClass: number(e.target.value, 0) > 0 ? number(e.target.value, 0) : null } })} />
                </label>
                <label>
                  <input type="checkbox" checked={design.medicalPost} onChange={(e) => set({ medicalPost: e.target.checked })} /> Mobile medical post
                </label>
              </div>
              <label className="code-field">
                Notes for the card
                <input value={design.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} />
              </label>
            </section>
          </div>

          <aside className="yard-side">
            <div className="mass-bar" title={`${summary.capacityUsed} of ${capacity} capacity`}>
              <div className={`mass-fill${summary.capacityUsed > capacity ? ' is-over' : ''}`} style={{ width: `${Math.min(100, (100 * summary.capacityUsed) / capacity)}%` }} />
              <span className="mass-readout num">
                capacity {summary.capacityUsed} / {capacity} · {summary.weaponSystems} of {design.size} weapon systems
              </span>
            </div>
            {faults.length > 0 ? (
              <ul className="faults">
                {faults.map((fault, i) => (
                  <li key={i} style={fault.advisory ? { color: 'var(--ink-dim)' } : undefined}>
                    <span className="rule-ref">{fault.page}</span> {fault.detail}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="yard-sheet ds-sheet">
              <RecordCard card={card} />
            </div>
            <details className="cost-sheet" open>
              <summary>
                Points value <b className="num">{cost.total}</b>
              </summary>
              <div className="cost-scroll">
                <table className="cost-table">
                  <tbody>
                    {cost.lines.map((line, i) => (
                      <tr key={i}>
                        <td>{line.label}</td>
                        <td className="campaign-dim">{line.working}</td>
                        <td className="num">{line.points}</td>
                      </tr>
                    ))}
                    {design.ordnanceLoads > 0 ? (
                      <tr>
                        <td>Ordnance loads ×{design.ordnanceLoads}</td>
                        <td className="campaign-dim">30 each, bought beside the aircraft</td>
                        <td className="num">+{ordnanceLoadsCost(design.ordnanceLoads)}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </details>
            <div className="yard-actions">
              <button className="primary" onClick={save}>
                {fromBook ? 'Save a copy' : onShelf ? 'Save' : 'Save to the shelf'}
              </button>
              {onShelf && !fromBook ? <button onClick={remove}>Delete</button> : null}
              <button onClick={() => setPrinting('one')}>Print card</button>
              <button onClick={() => setPrinting('shelf')} title="Every card on the shelf, on paper">
                Print the shelf
              </button>
              {savedAs ? <span className="campaign-dim">Saved as {savedAs}</span> : null}
            </div>
          </aside>
        </div>
        {range ? <FiringRange bench={design} shelf={shelf} onClose={() => setRange(false)} /> : null}
        {printing ? (
          <PrintCards
            title={printing === 'one' ? `Dirtside II record card — ${design.name}` : 'Dirtside II record cards'}
            cards={printing === 'one' ? [card] : shelf.map(recordCardOf)}
          />
        ) : null}
      </div>
    </div>
  )
}

export { mobilityKind }
