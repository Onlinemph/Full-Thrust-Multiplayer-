import { useMemo, useRef, useState } from 'react'

import { HIT_CATEGORIES, type Chit, chitLabel, validityLabel } from '../../dirtside/chits'
import { rangeBandsOf, singleBand } from '../../dirtside/data/weapons'
import { effectiveSignature, weaponLabel } from '../../dirtside/design'
import { type DiceStream, dieLabel, newStream } from '../../dirtside/dice'
import {
  type Firer,
  type InfantryValidityRule,
  POSITION_LABELS,
  POSTURE_LABELS,
  type Shot,
  type ShotResult,
  TROOP_LABELS,
  type Target,
  fireShot,
  narrateShot,
  planShot,
} from '../../dirtside/fire'
import type { InfantryPosition, InfantryTroops, TargetPosture, VehicleDesign } from '../../dirtside/types'

/**
 * The Firing Range: any gun on the shelf against any target at any range,
 * with the whole of pp. 28–32 and p. 36 laid out before the dice are
 * rolled — the band, the two sides' dice, the chits a hit draws and which
 * colours count — and the exact odds beside them. "Fire" rolls it on a
 * seeded stream and writes the dice and the chits to the log, so a player
 * learning the system can see every step the book describes, and a
 * designer can find out what a HEL/2 is actually worth against armour 4.
 */
export interface FiringRangeProps {
  /** The design on the Motor Pool's bench, saved or not: the first firer. */
  bench: VehicleDesign
  shelf: readonly VehicleDesign[]
  onClose: () => void
}

const ALL_POSTURES: TargetPosture[] = ['none', 'turret-down', 'hull-down', 'dug-in', 'evading', 'soft-cover', 'pop-up']
const POSITIONS: InfantryPosition[] = ['open', 'soft-cover', 'dug-in', 'urban']
const TROOPS: InfantryTroops[] = ['militia', 'line', 'powered']

const pct = (x: number) => {
  const v = x * 100
  if (v === 0) return '0%'
  if (v >= 99.95) return '100%'
  return `${v < 10 ? v.toFixed(1) : v.toFixed(0)}%`
}

interface LogEntry {
  id: number
  title: string
  lines: string[]
  draws: Chit[][]
  verdict: string
}

let entryId = 0

export function FiringRange({ bench, shelf, onClose }: FiringRangeProps) {
  const designs = useMemo(() => [bench, ...shelf.filter((d) => d.id !== bench.id)], [bench, shelf])
  const [firerId, setFirerId] = useState(bench.id)
  const firerDesign = designs.find((d) => d.id === firerId) ?? bench
  const [weaponId, setWeaponId] = useState(firerDesign.weapons[0]?.id ?? '')
  const weapon = firerDesign.weapons.find((w) => w.id === weaponId) ?? firerDesign.weapons[0]
  const [movingFast, setMovingFast] = useState(false)
  const [damaged, setDamaged] = useState(false)
  const [systemsDown, setSystemsDown] = useState(false)

  const [targetKind, setTargetKind] = useState<'vehicle' | 'infantry'>('vehicle')
  const [targetId, setTargetId] = useState(designs.find((d) => d.id !== bench.id)?.id ?? bench.id)
  const targetDesign = designs.find((d) => d.id === targetId) ?? bench
  const [aspect, setAspect] = useState<'front' | 'side'>('front')
  const [posture, setPosture] = useState<TargetPosture>('none')
  const [troops, setTroops] = useState<InfantryTroops>('line')
  const [position, setPosition] = useState<InfantryPosition>('open')
  const [validityRule, setValidityRule] = useState<InfantryValidityRule>('weapon')
  const [range, setRange] = useState(24)

  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000))
  const stream = useRef<DiceStream>(newStream(seed))
  const [log, setLog] = useState<LogEntry[]>([])

  const firer: Firer | null = weapon ? { design: firerDesign, weaponId: weapon.id, movingFast, damaged, systemsDown } : null
  const target: Target = targetKind === 'vehicle' ? { kind: 'vehicle', design: targetDesign, aspect, posture } : { kind: 'infantry', troops, position }
  const shot: Shot | null = firer ? { firer, target, range, infantryValidity: validityRule } : null
  const plan = useMemo(() => (shot ? planShot(shot) : null), [shot])

  const bands = weapon ? rangeBandsOf(weapon.type, weapon.class) : undefined
  const bandRows = useMemo(() => {
    if (!shot || !weapon || !bands) return []
    const marks = singleBand(weapon.type) ? [['60"', bands.long]] : [['close', bands.close], ['medium', bands.medium], ['long', bands.long]]
    return marks.map(([label, upTo]) => {
      const p = planShot({ ...shot, range: upTo as number })
      return { label: label as string, upTo: upTo as number, plan: p }
    })
  }, [shot, weapon, bands])

  const pickFirer = (id: string) => {
    setFirerId(id)
    const d = designs.find((x) => x.id === id)
    setWeaponId(d?.weapons[0]?.id ?? '')
  }
  const resetStream = (next: number) => {
    setSeed(next)
    stream.current = newStream(next)
  }

  const fire = () => {
    if (!shot) return
    const result = fireShot(shot, stream.current)
    if ('ok' in result) return
    setLog((entries) => [entryOf(result, shot), ...entries].slice(0, 40))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal is-wide yard-modal ds-pool ds-range" onClick={(event) => event.stopPropagation()}>
        <div className="yard-head">
          <h2>Firing Range</h2>
          <span className="ds-kicker" title="Dirtside II, direct fire: pp. 28–32 and p. 36">
            Try a shot: how dice and chits decide a hit
          </span>
          <span className="spacer" />
          <label className="ds-seed">
            Seed{' '}
            <input type="number" value={seed} onChange={(e) => resetStream(Math.floor(Number(e.target.value)) || 0)} aria-label="Seed" />
          </label>
          <button onClick={() => resetStream(seed)} title="Start the same seed again from its first draw">
            Rewind
          </button>
          <button onClick={() => resetStream(Math.floor(Math.random() * 1_000_000))}>New seed</button>
          <button onClick={onClose}>Close</button>
        </div>

        <div className="yard">
          <div className="yard-controls">
            <section className="yard-section">
              <h3>
                Firer <span className="rule-ref">p. 28</span>
              </h3>
              <div className="yard-pair">
                <label className="code-field">
                  Vehicle
                  <select value={firerId} onChange={(e) => pickFirer(e.target.value)} aria-label="Firer">
                    {designs.map((d) => (
                      <option key={d.id} value={d.id} disabled={d.weapons.length === 0}>
                        {d.name}
                        {d.id === bench.id ? ' (on the bench)' : ''}
                        {d.weapons.length === 0 ? ' · no guns' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="code-field">
                  Weapon
                  <select value={weapon?.id ?? ''} onChange={(e) => setWeaponId(e.target.value)} aria-label="Weapon">
                    {firerDesign.weapons.map((w) => (
                      <option key={w.id} value={w.id}>
                        {weaponLabel(w)}
                        {w.barrels > 1 ? ` ×${w.barrels}` : ''} · {w.mount}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="campaign-dim">
                Fire control {firerDesign.fireControl ?? 'none'}
                {bands && weapon ? (singleBand(weapon.type) ? ` · one band to ${bands.long}"` : ` · close ${bands.close}", medium ${bands.medium}", long ${bands.long}"`) : ''}
              </p>
              <div className="panel-row ds-ticks">
                <label>
                  <input type="checkbox" checked={movingFast} onChange={(e) => setMovingFast(e.target.checked)} /> Moving over half its base movement
                </label>
                <label>
                  <input type="checkbox" checked={damaged} onChange={(e) => setDamaged(e.target.checked)} /> Damaged
                </label>
                <label>
                  <input type="checkbox" checked={systemsDown} onChange={(e) => setSystemsDown(e.target.checked)} /> Systems down
                </label>
              </div>
            </section>

            <section className="yard-section">
              <h3>
                Target <span className="rule-ref">p. 29, p. 33</span>
              </h3>
              <div className="panel-row ds-ticks">
                <label>
                  <input type="radio" name="ds-target-kind" checked={targetKind === 'vehicle'} onChange={() => setTargetKind('vehicle')} /> A vehicle
                </label>
                <label>
                  <input type="radio" name="ds-target-kind" checked={targetKind === 'infantry'} onChange={() => setTargetKind('infantry')} /> Infantry
                </label>
              </div>
              {targetKind === 'vehicle' ? (
                <>
                  <div className="yard-pair">
                    <label className="code-field">
                      Vehicle
                      <select value={targetId} onChange={(e) => setTargetId(e.target.value)} aria-label="Target">
                        {designs.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} · armour {d.armour}
                            {d.armourSpecial !== 'none' ? ` ${d.armourSpecial}` : ''} · signature {effectiveSignature(d)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="code-field">
                      Aspect
                      <select value={aspect} onChange={(e) => setAspect(e.target.value as 'front' | 'side')} aria-label="Aspect">
                        <option value="front">Front · armour {targetDesign.armour}</option>
                        <option value="side">Side, top or rear · armour {Math.max(0, targetDesign.armour - 1)}</option>
                      </select>
                    </label>
                  </div>
                  <label className="code-field">
                    Posture
                    <select value={posture} onChange={(e) => setPosture(e.target.value as TargetPosture)} aria-label="Posture">
                      {ALL_POSTURES.map((p) => (
                        <option key={p} value={p}>
                          {POSTURE_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <div className="yard-pair">
                    <label className="code-field">
                      Troops
                      <select value={troops} onChange={(e) => setTroops(e.target.value as InfantryTroops)} aria-label="Troops">
                        {TROOPS.map((t) => (
                          <option key={t} value={t}>
                            {TROOP_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="code-field">
                      Position
                      <select value={position} onChange={(e) => setPosition(e.target.value as InfantryPosition)} aria-label="Position">
                        {POSITIONS.map((p) => (
                          <option key={p} value={p}>
                            {POSITION_LABELS[p]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="code-field">
                    Valid chits against infantry
                    <select value={validityRule} onChange={(e) => setValidityRule(e.target.value as InfantryValidityRule)} aria-label="Infantry validity">
                      <option value="weapon">By the weapon, as the card prints it (p. 29)</option>
                      <option value="position">By the target's cover, as for a firefight (p. 33, p. 36)</option>
                    </select>
                  </label>
                </>
              )}
            </section>

            <section className="yard-section">
              <h3>
                Range <span className="rule-ref">p. 28</span>
              </h3>
              <div className="panel-row">
                <input type="range" min={1} max={60} value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Range slider" style={{ flex: 1 }} />
                <label className="code-field ds-inches">
                  <input type="number" min={1} max={120} value={range} onChange={(e) => setRange(Math.max(1, Math.floor(Number(e.target.value)) || 1))} aria-label="Range" />
                  inches
                </label>
              </div>
              {bandRows.length > 0 ? (
                <table className="ds-odds ds-bands">
                  <thead>
                    <tr>
                      <th>Band</th>
                      <th className="num">To</th>
                      <th>Dice</th>
                      <th>Chits</th>
                      <th className="num">Hit</th>
                      <th className="num">{targetKind === 'vehicle' ? 'Knocked out' : 'Killed'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bandRows.map((row) => (
                      <tr key={row.label} className={row.plan.ok && row.plan.band === (plan?.ok ? plan.band : '') ? 'is-current' : undefined}>
                        <td>{row.label}</td>
                        <td className="num">{row.upTo}"</td>
                        {row.plan.ok ? (
                          row.plan.kind === 'vehicle' ? (
                            <>
                              <td>
                                {row.plan.dice > 1 ? `${row.plan.dice} × ` : ''}
                                {dieLabel(row.plan.firerDie)} v {dieLabel(row.plan.targetPrimary)}
                                {row.plan.targetSecondary ? ` + ${dieLabel(row.plan.targetSecondary)}` : ''}
                              </td>
                              <td>
                                {row.plan.chitsPerHit}, {validityLabel(row.plan.validity)}
                              </td>
                              <td className="num">{pct(row.plan.odds.hit)}</td>
                              <td className="num">{pct(row.plan.odds.knockedOut)}</td>
                            </>
                          ) : (
                            <>
                              <td>no roll</td>
                              <td>
                                {row.plan.chitsPerDraw}, {validityLabel(row.plan.validity)}
                              </td>
                              <td className="num">100%</td>
                              <td className="num">{pct(row.plan.killed)}</td>
                            </>
                          )
                        ) : (
                          <td colSpan={4} className="campaign-dim">
                            {row.plan.reason} <span className="rule-ref">{row.plan.page}</span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </section>
          </div>

          <aside className="yard-side">
            {!plan ? (
              <p className="faults">This design carries no direct-fire weapon.</p>
            ) : !plan.ok ? (
              <ul className="faults">
                <li>
                  {plan.reason} <span className="rule-ref">{plan.page}</span>
                </li>
              </ul>
            ) : plan.kind === 'vehicle' ? (
              <div className="yard-sheet ds-plan">
                <h3>
                  {weaponLabel(plan.weapon)} at {range}" · {plan.band} range
                </h3>
                <dl>
                  <dt>Firer rolls</dt>
                  <dd>
                    {plan.dice > 1 ? `${plan.dice} × ` : ''}
                    {dieLabel(plan.firerDie)}
                  </dd>
                  <dt>Target rolls</dt>
                  <dd>
                    {dieLabel(plan.targetPrimary)}
                    {plan.targetSecondary ? ` and ${dieLabel(plan.targetSecondary)}, the higher` : ''}
                  </dd>
                  <dt>Each hit draws</dt>
                  <dd>
                    {plan.chitsPerHit} chit{plan.chitsPerHit > 1 ? 's' : ''}, {validityLabel(plan.validity)}
                  </dd>
                  <dt>Against armour</dt>
                  <dd>{plan.armour}</dd>
                </dl>
                <table className="ds-odds">
                  <tbody>
                    <tr>
                      <td>Hit</td>
                      <td className="num">{pct(plan.odds.hit)}</td>
                    </tr>
                    {plan.dice > 1 ? (
                      <tr>
                        <td>Hits expected</td>
                        <td className="num">{plan.odds.expectedHits.toFixed(2)}</td>
                      </tr>
                    ) : null}
                    <tr>
                      <td>Knocked out</td>
                      <td className="num">{pct(plan.odds.knockedOut)}</td>
                    </tr>
                    <tr>
                      <td>Damaged</td>
                      <td className="num">{pct(plan.odds.damaged)}</td>
                    </tr>
                    <tr>
                      <td>Immobilised</td>
                      <td className="num">{pct(plan.odds.immobilised)}</td>
                    </tr>
                    <tr>
                      <td>Target systems down</td>
                      <td className="num">{pct(plan.odds.systemsDown)}</td>
                    </tr>
                    <tr>
                      <td>Firer systems down</td>
                      <td className="num">{pct(plan.odds.firerSystemsDown)}</td>
                    </tr>
                  </tbody>
                </table>
                <details className="cost-sheet">
                  <summary>One hit's chits, by outcome</summary>
                  <table className="ds-odds">
                    <tbody>
                      {HIT_CATEGORIES.filter((c) => plan.hitOdds[c] > 0).map((c) => (
                        <tr key={c}>
                          <td>{CATEGORY_LABELS[c]}</td>
                          <td className="num">{pct(plan.hitOdds[c])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
                {plan.notes.length > 0 ? (
                  <ul className="ds-notes">
                    {plan.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <div className="yard-sheet ds-plan">
                <h3>
                  {weaponLabel(plan.weapon)} at {range}" on {TROOP_LABELS[plan.killTotal === 3 ? 'militia' : plan.killTotal === 4 ? 'line' : 'powered']} infantry
                </h3>
                <dl>
                  <dt>Roll</dt>
                  <dd>none: the hit is automatic</dd>
                  <dt>Draws</dt>
                  <dd>
                    {plan.draws > 1 ? `${plan.draws} × ` : ''}
                    {plan.chitsPerDraw} chits, {validityLabel(plan.validity)}
                  </dd>
                  <dt>To kill</dt>
                  <dd>{plan.killTotal} valid points</dd>
                </dl>
                <table className="ds-odds">
                  <tbody>
                    <tr>
                      <td>Element removed</td>
                      <td className="num">{pct(plan.killed)}</td>
                    </tr>
                  </tbody>
                </table>
                {plan.notes.length > 0 ? (
                  <ul className="ds-notes">
                    {plan.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
            <div className="yard-actions">
              <button className="primary" onClick={fire} disabled={!plan || !plan.ok}>
                Fire
              </button>
              <button onClick={() => setLog([])} disabled={log.length === 0}>
                Clear the log
              </button>
              <span className="campaign-dim">
                seed {seed} · draw {stream.current.cursor}
              </span>
            </div>
            <ol className="ds-log" aria-label="Firing log">
              {log.map((entry) => (
                <li key={entry.id} className="ds-log-entry">
                  <b>{entry.title}</b>
                  {entry.lines.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                  {entry.draws.map((chits, i) => (
                    <p key={`d${i}`} className="ds-chits">
                      {chits.map((chit, j) => (
                        <span key={j} className={`ds-chit is-${chit.kind === 'number' ? chit.colour : 'special'}`}>
                          {chitLabel(chit)}
                        </span>
                      ))}
                    </p>
                  ))}
                  <p className="ds-verdict">{entry.verdict}</p>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </div>
  )
}

const CATEGORY_LABELS: Record<(typeof HIT_CATEGORIES)[number], string> = {
  'SD:F': 'Firer systems down (shot void)',
  Miss: 'No effect',
  'SD:T': 'Target systems down',
  MOB: 'Immobilised',
  'SD:T&MOB': 'Systems down and immobilised',
  Dam: 'Damaged',
  'Dam&SD:T': 'Damaged, systems down',
  'Dam&MOB': 'Damaged, immobilised',
  'Dam&SD:T&MOB': 'Damaged, systems down, immobilised',
  Kill: 'Knocked out',
}

function entryOf(result: ShotResult, shot: Shot): LogEntry {
  const lines = narrateShot(result)
  const targetName = shot.target.kind === 'vehicle' ? `${shot.target.design.name} (${shot.target.aspect})` : `${TROOP_LABELS[shot.target.troops]} infantry ${POSITION_LABELS[shot.target.position]}`
  const title = `${shot.firer.design.name}, ${weaponLabel(result.plan.weapon)} → ${targetName} at ${shot.range}"`
  if (result.kind === 'infantry') {
    return { id: (entryId += 1), title, lines: lines.slice(0, 1), draws: result.results.map((r) => r.chits), verdict: result.killed ? 'Element removed.' : `No effect (${result.results.map((r) => r.points).join(' / ')} of ${result.plan.killTotal}).` }
  }
  const o = result.outcome
  const verdict = result.hits === 0
    ? 'Miss.'
    : o.knockedOut
      ? result.results.some((r) => r.boom) ? 'BOOM — catastrophic kill.' : 'Knocked out.'
      : [o.damaged ? 'damaged' : '', o.immobilised ? 'immobilised' : '', o.systemsDown ? 'target systems down' : '', o.firerSystemsDown ? 'firer systems down' : '']
          .filter(Boolean)
          .join(', ') || 'No effect.'
  return { id: (entryId += 1), title, lines: lines.slice(0, 2), draws: result.results.map((r) => r.chits), verdict: verdict.endsWith('.') ? verdict : `${verdict.charAt(0).toUpperCase()}${verdict.slice(1)}.` }
}
