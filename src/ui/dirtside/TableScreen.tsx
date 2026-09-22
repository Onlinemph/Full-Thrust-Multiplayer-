import { useMemo, useState } from 'react'

import { mobilityFamily } from '../../dirtside/data/mobility'
import { weaponLabel } from '../../dirtside/design'
import { infantryHitOdds, vehicleHitOdds } from '../../dirtside/odds'
import { CONFIDENCE_LABELS, QUALITY_LABELS } from '../../dirtside/table/confidence'
import { canPass, commandUnitOf, elementsOf, functional, mobile, objectiveValues, unactivatedUnits } from '../../dirtside/table/game'
import { baseMovement, planTableShot, teamFiresRanged, type TableShotPlan } from '../../dirtside/table/tableFire'
import { pathCost } from '../../dirtside/table/terrain'
import type { Action, ElementState, Point, Refusal, ShotOrder, SideId, UnitState, WeaponChoice } from '../../dirtside/table/types'
import { TableMap } from './TableMap'
import { dirtsideBattleText, dirtsideDispatch, useDirtsideBattle } from './dirtsideStore'

/**
 * The Dirtside II table, played hot-seat from one console: both sides'
 * units down the right, the table in the middle, the log below. The
 * screen never decides a rule — every click is an action through the one
 * door, and a refusal comes back with its page.
 */
export interface TableScreenProps {
  onMenu: () => void
  onNewSkirmish: () => void
}

type Mode = 'idle' | 'move' | 'fire'

const pct = (x: number) => `${Math.round(x * 100)}%`

export function TableScreen({ onMenu, onNewSkirmish }: TableScreenProps) {
  const state = useDirtsideBattle()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('idle')
  const [plot, setPlot] = useState<Point[]>([])
  const [evasive, setEvasive] = useState(false)
  const [travel, setTravel] = useState(false)
  const [weapon, setWeapon] = useState<WeaponChoice | null>(null)
  const [volley, setVolley] = useState<ShotOrder[]>([])
  const [firingUnitId, setFiringUnitId] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<Refusal | null>(null)
  const [note, setNote] = useState<string | null>(null)

  if (!state) {
    return (
      <div className="app dirtside-screen">
        <header className="app-bar">
          <h1>Dirtside II</h1>
          <span className="spacer" />
          <button onClick={onNewSkirmish}>New skirmish</button>
          <button onClick={onMenu}>Menu</button>
        </header>
        <main className="app-body">
          <p className="campaign-dim">No battle is under way.</p>
        </main>
      </div>
    )
  }

  const activation = state.activation
  const window = activation?.window ?? null
  const activeUnit = activation ? state.units[activation.unitId]! : null
  const toAct = state.toAct
  const selected = selectedId ? state.elements[selectedId] ?? null : null
  const selectedUnit = selected ? state.units[selected.unitId]! : null
  /** The unit whose shots are being built: the activated unit, or the one answering a window. */
  const firingUnit = window ? (firingUnitId ? state.units[firingUnitId] ?? null : null) : activeUnit
  const opportunity = !!window

  const reset = () => {
    setMode('idle')
    setPlot([])
    setVolley([])
    setWeapon(null)
  }
  const act = (action: Action): boolean => {
    const r = dirtsideDispatch(action)
    setRefusal(r)
    if (!r) setNote(null)
    return !r
  }

  const canControl = (unit: UnitState | null) => !!unit && !!activation && unit.id === activation.unitId && !window
  const record = selected && activation && canControl(selectedUnit) ? activation.elements[selected.id] ?? null : null
  const family = selected?.vehicle ? mobilityFamily(selected.vehicle.mobility) : 'infantry'
  const allowance = selected ? (selected.damaged ? baseMovement(selected) / 2 : baseMovement(selected)) : 0
  const cap = record?.firedBeforeMoving ? Math.min(allowance, baseMovement(selected!) / 2) : allowance
  const left = record ? Math.max(0, cap - record.factorsUsed) : 0
  const plotted = useMemo(() => (selected && plot.length > 0 ? pathCost([selected.position, ...plot], family, state.setup.table.terrain, { amphibious: !!selected.vehicle?.amphibious, travel }) : null), [selected, plot, family, state.setup.table.terrain, travel])

  const planFor = (order: ShotOrder): TableShotPlan | Refusal => planTableShot(state, order, { activation: opportunity ? null : activation?.elements[order.elementId] ?? null, opportunity })

  const onSelectElement = (id: string) => {
    const el = state.elements[id]!
    if (mode === 'fire' && selected && weapon && el.sideId !== selected.sideId) {
      const order: ShotOrder = { elementId: selected.id, weapon, targetId: id }
      const plan = planFor(order)
      if (!plan.ok) {
        setRefusal(plan)
        return
      }
      setRefusal(null)
      setVolley((v) => [...v.filter((s) => s.elementId !== order.elementId), order])
      return
    }
    if (mode === 'move') return
    setSelectedId(id)
    setRefusal(null)
    if (mode === 'fire') setWeapon(null)
  }

  const onClickTable = (point: Point) => {
    if (!selected) return
    if (state.phase === 'deployment') {
      if (state.sides[selected.sideId].ready) return
      act({ kind: 'deploy', side: selected.sideId, elementId: selected.id, position: point, facing: selected.sideId === 'north' ? 180 : 0 })
      return
    }
    if (mode === 'move') setPlot((p) => [...p, point])
  }

  const confirmMove = () => {
    if (!selected || plot.length === 0) return
    const ok = act({ kind: 'move', side: selected.sideId, elementId: selected.id, path: plot, evasive: evasive || undefined, travel: travel || undefined })
    if (ok) {
      setPlot([])
      setMode('idle')
    }
  }

  const fireVolley = () => {
    if (!firingUnit || volley.length === 0) return
    const ok = opportunity ? act({ kind: 'opportunity-fire', side: firingUnit.sideId, unitId: firingUnit.id, shots: volley }) : act({ kind: 'fire', side: firingUnit.sideId, shots: volley })
    if (ok) {
      setVolley([])
      setMode('idle')
      setWeapon(null)
      setFiringUnitId(null)
    }
  }

  const weaponsOf = (el: ElementState): { choice: WeaponChoice; label: string }[] => {
    const out: { choice: WeaponChoice; label: string }[] = []
    if (el.vehicle) {
      for (const w of el.vehicle.weapons) out.push({ choice: { kind: 'direct', weaponId: w.id }, label: `${weaponLabel(w)}${w.barrels > 1 ? ` ×${w.barrels}` : ''} (${w.mount})` })
      out.push({ choice: { kind: 'apsw' }, label: 'APSW (12", 3 chits)' })
    }
    if (el.infantry && teamFiresRanged(el)) {
      if (el.infantry.team === 'apsw') out.push({ choice: { kind: 'apsw' }, label: 'APSW (12", 3 chits)' })
      else {
        out.push({ choice: { kind: 'rifles' }, label: `Rifles (${{ militia: 4, line: 6, powered: 8 }[el.infantry.troops]}")` })
        out.push({ choice: { kind: 'iavr' }, label: 'IAVR (4", at a vehicle)' })
      }
    }
    return out
  }

  const oddsOf = (plan: TableShotPlan): string => {
    if (plan.kind === 'direct') {
      if (plan.plan.kind === 'vehicle') return `hit ${pct(plan.plan.odds.hit)} · knocked out ${pct(plan.plan.odds.knockedOut)} · damaged ${pct(plan.plan.odds.damaged)}`
      return `automatic · killed ${pct(plan.plan.killed)}`
    }
    if (plan.against === 'infantry') return `${plan.chits} chits · killed ${pct(infantryHitOdds(plan.chits, plan.validity, plan.killTotal!).killed)}`
    const odds = vehicleHitOdds(plan.chits, plan.validity, plan.armour!)
    const dam = (['Dam', 'Dam&SD:T', 'Dam&MOB', 'Dam&SD:T&MOB'] as const).reduce((s, c) => s + odds[c], 0)
    return `${plan.chits} chits · knocked out ${pct(odds.Kill)} · damaged ${pct(dam)}`
  }

  const values = objectiveValues(state)
  const sideName = (s: SideId) => state.sides[s].name

  // ---- The banner: what the table is waiting for.
  let banner: string
  if (state.result) banner = state.result.winner === 'draw' ? `A draw: ${state.result.reason}.` : `${sideName(state.result.winner)} wins: ${state.result.reason}.`
  else if (state.phase === 'deployment') banner = 'Deployment: pick an element, click where it stands, then Ready.'
  else if (state.phase === 'turn-start') banner = `Turn ${state.turn}: ${sideName(state.chooser!)} chooses who activates first.`
  else if (window) banner = `${sideName(window.sideId)}: opportunity fire on ${state.elements[window.movedElementId]!.name}? Pick one of your unactivated units below.`
  else if (activeUnit) banner = `${sideName(activeUnit.sideId)}: ${activeUnit.name} is activated. Move and fire its elements, then end the activation.`
  else banner = `Turn ${state.turn}: ${sideName(toAct!)} to activate a unit${state.owed > 1 ? ` (${state.owed} in succession)` : ''}.`

  return (
    <div className="app dirtside-screen">
      <header className="app-bar">
        <h1>{state.setup.name}</h1>
        <span className="campaign-kicker">Dirtside II</span>
        <span className="dst-banner">{banner}</span>
        <span className="spacer" />
        <span className="campaign-dim num">
          objectives {values.north}–{values.south}
        </span>
        <button
          onClick={() => {
            const text = dirtsideBattleText()
            if (!text) return
            const blob = new Blob([text], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `${state.setup.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.dirtside.json`
            a.click()
            URL.revokeObjectURL(a.href)
          }}
        >
          Save
        </button>
        <button onClick={onNewSkirmish}>New skirmish</button>
        <button onClick={onMenu}>Menu</button>
      </header>

      <main className="app-body dst-body">
        <div className="dst-table">
          <TableMap
            state={state}
            selectedId={selectedId}
            onSelectElement={onSelectElement}
            onClickTable={onClickTable}
            plot={mode === 'move' ? plot : []}
            plotFrom={mode === 'move' && selected ? selected.position : null}
            reach={mode === 'move' && record ? left - (plotted?.factors ?? 0) : null}
            targets={volley.map((s) => s.targetId)}
            highlight={window?.movedElementId ?? null}
            viewer={toAct ?? (state.phase === 'deployment' ? null : 'north')}
          />
          {refusal ? (
            <div className="dst-refusal" role="alert">
              <span className="rule-ref">{refusal.page}</span> {refusal.reason}
            </div>
          ) : note ? (
            <div className="dst-refusal is-note">{note}</div>
          ) : null}
        </div>

        <aside className="app-side dst-side">
          <div className="panel dst-actions">
            {state.phase === 'deployment' ? (
              <>
                {(['north', 'south'] as SideId[]).map((s) => (
                  <button key={s} className={state.sides[s].ready ? undefined : 'primary'} disabled={state.sides[s].ready} onClick={() => act({ kind: 'ready', side: s })}>
                    {state.sides[s].ready ? `${sideName(s)} ready` : `${sideName(s)}: ready`}
                  </button>
                ))}
              </>
            ) : null}
            {state.phase === 'turn-start' ? (
              <>
                <button className="primary" onClick={() => act({ kind: 'choose-first', side: state.chooser!, first: state.chooser! })}>
                  {sideName(state.chooser!)} activates first
                </button>
                <button onClick={() => act({ kind: 'choose-first', side: state.chooser!, first: state.chooser === 'north' ? 'south' : 'north' })}>
                  {sideName(state.chooser === 'north' ? 'south' : 'north')} activates first
                </button>
              </>
            ) : null}
            {state.phase === 'activation' && window ? (
              <>
                <button onClick={() => { act({ kind: 'decline-opportunity', side: window.sideId }); reset(); setFiringUnitId(null) }}>Decline</button>
                <button onClick={() => { act({ kind: 'decline-opportunity', side: window.sideId, forActivation: true }); reset(); setFiringUnitId(null) }}>Decline for this activation</button>
              </>
            ) : null}
            {state.phase === 'activation' && !window && activation ? (
              <button className="primary" onClick={() => { if (act({ kind: 'end-activation', side: activation.sideId })) reset() }}>
                End {activeUnit?.name}'s activation
              </button>
            ) : null}
            {state.phase === 'activation' && !activation && toAct ? (
              <>
                {canPass(state, toAct) ? <button onClick={() => act({ kind: 'pass', side: toAct })}>Pass</button> : null}
                <button onClick={() => act({ kind: 'done', side: toAct })}>{sideName(toAct)}: no more activations</button>
                <button onClick={() => act({ kind: 'declare-end', side: toAct })} title="Only while holding more than half the objectives (p. 17)">
                  Declare game end
                </button>
              </>
            ) : null}
          </div>

          {(['north', 'south'] as SideId[]).map((s) => (
            <div key={s} className={`panel dst-force is-${s}`}>
              <h3>
                {sideName(s)}
                <span className="campaign-dim"> · {unactivatedUnits(state, s).length} to activate{state.sides[s].done ? ', done' : ''}{state.sides[s].commandLost ? ', command lost' : ''}</span>
              </h3>
              <ul className="dst-units">
                {Object.values(state.units)
                  .filter((u) => u.sideId === s)
                  .map((u) => {
                    const alive = elementsOf(state, u).filter(functional).length
                    const mine = toAct === s
                    const canActivate = mine && state.phase === 'activation' && !activation && !u.activated && alive > 0
                    const command = commandUnitOf(state, s)
                    const canRally = canActivate && u.confidence !== 'CO' && !!command && command.id !== u.id && !state.sides[s].commandLost
                    const canAnswer = !!window && window.sideId === s && !u.activated && alive > 0 && !u.panic && !u.evasive
                    const canJoin = !!activation && !window && activation.sideId === s && activation.unitId !== u.id && !u.activated && alive > 0
                    return (
                      <li key={u.id} className={`dst-unit${activeUnit?.id === u.id ? ' is-active' : ''}${firingUnit?.id === u.id && opportunity ? ' is-firing' : ''}${alive === 0 ? ' is-gone' : ''}`}>
                        <button className="dst-unit-name" onClick={() => setSelectedId(elementsOf(state, u).find(functional)?.id ?? null)}>
                          <span className={`dst-marker is-${u.quality}${u.activated ? ' is-spent' : ''}`} title={`${QUALITY_LABELS[u.quality]} ${u.leadership}${u.activated ? ', activated' : ''}`}>
                            {u.leadership}
                          </span>
                          <span className={`dst-confidence is-${u.confidence}`} title={CONFIDENCE_LABELS[u.confidence]}>
                            {u.confidence}
                          </span>
                          {u.name}
                          {u.commandUnit ? ' ★' : ''}
                          <span className="campaign-dim"> {alive}/{u.strength}</span>
                          {u.underFire ? <span className="dst-flag">under fire</span> : null}
                          {u.panic ? <span className="dst-flag">panic</span> : null}
                          {u.evasive ? <span className="dst-flag">evading</span> : null}
                        </button>
                        {canActivate ? <button onClick={() => { if (act({ kind: 'activate', side: s, unitId: u.id })) reset() }}>Activate</button> : null}
                        {canRally ? <button onClick={() => act({ kind: 'rally', side: s, unitId: u.id })}>Rally</button> : null}
                        {canJoin ? (
                          <button onClick={() => { if (act({ kind: 'regroup', side: s, intoUnitId: u.id })) reset() }} title="The activated unit joins this one (p. 24)">
                            Regroup into
                          </button>
                        ) : null}
                        {canAnswer ? (
                          <button className={firingUnit?.id === u.id ? 'primary' : undefined} onClick={() => { setFiringUnitId(u.id); setVolley([]); setSelectedId(elementsOf(state, u).find(functional)?.id ?? null); setMode('fire') }}>
                            Fire with
                          </button>
                        ) : null}
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))}

          {selected ? (
            <div className="panel dst-element">
              <h3>
                {selected.name} <span className="campaign-dim">{selectedUnit?.name}</span>
              </h3>
              <p className="campaign-dim">
                {selected.vehicle
                  ? `${selected.vehicle.role} · armour ${selected.vehicle.armour}/${Math.max(0, selected.vehicle.armour - 1)} · ${baseMovement(selected)}" ${selected.vehicle.mobility.replace('-', ' ')} · fire control ${selected.vehicle.fireControl ?? 'none'}`
                  : `${selected.infantry?.troops} ${selected.infantry?.team} team · ${baseMovement(selected)}"`}
                {selected.destroyed ? ' · knocked out' : ''}
                {selected.damaged ? ' · damaged' : ''}
                {selected.immobilised ? ' · immobilised' : ''}
                {selected.systemsDown ? ' · systems down' : ''}
                {selected.dugIn ? ' · dug in' : ''}
                {selected.wood ? ` · wood ${selected.wood}` : ''}
                {selected.posture !== 'none' ? ` · ${selected.posture.replace('-', ' ')}` : ''}
              </p>

              {record && !selected.destroyed ? (
                <>
                  <p className="campaign-dim num">
                    factors {record.factorsUsed.toFixed(1)} of {cap}
                    {record.moved ? ' · moved' : ''}
                    {record.fired ? ' · fired' : ''}
                  </p>
                  {mode !== 'move' ? (
                    <div className="dst-row">
                      <button onClick={() => { setMode('move'); setPlot([]); setVolley([]); setWeapon(null) }} disabled={!mobile(selected)}>Plot a move</button>
                      <label><input type="checkbox" checked={evasive} onChange={(e) => setEvasive(e.target.checked)} /> evasive</label>
                      <label><input type="checkbox" checked={travel} onChange={(e) => setTravel(e.target.checked)} /> travel mode</label>
                    </div>
                  ) : (
                    <div className="dst-row">
                      <span className="campaign-dim num">
                        {plot.length === 0 ? 'Click the table for each waypoint.' : plotted?.blockedAt ? `blocked by ${plotted.blockedBy}` : `${plotted?.length.toFixed(1)}" for ${plotted?.factors.toFixed(1)} factors (${left.toFixed(1)} left)`}
                      </span>
                      <button className="primary" onClick={confirmMove} disabled={plot.length === 0}>Move</button>
                      <button onClick={() => setPlot((p) => p.slice(0, -1))} disabled={plot.length === 0}>Undo</button>
                      <button onClick={() => { setMode('idle'); setPlot([]) }}>Cancel</button>
                    </div>
                  )}
                  {selected.vehicle ? (
                    <div className="dst-row">
                      <span className="campaign-dim">Posture</span>
                      {(['none', 'hull-down', 'turret-down'] as const).map((p) => (
                        <button key={p} className={selected.posture === p ? 'primary' : undefined} onClick={() => act({ kind: 'posture', side: selected.sideId, elementId: selected.id, posture: p })}>
                          {p === 'none' ? 'up' : p.replace('-', ' ')}
                        </button>
                      ))}
                      {selected.systemsDown ? <button onClick={() => act({ kind: 'repair', side: selected.sideId, elementId: selected.id })}>Try a repair</button> : null}
                    </div>
                  ) : null}
                </>
              ) : null}

              {firingUnit && selected.unitId === firingUnit.id && !selected.destroyed && (canControl(selectedUnit) || opportunity) ? (
                <div className="dst-fire">
                  <div className="dst-row">
                    <span className="campaign-dim">Fire</span>
                    {weaponsOf(selected).map((w) => (
                      <button key={w.label} className={mode === 'fire' && JSON.stringify(weapon) === JSON.stringify(w.choice) ? 'primary' : undefined} onClick={() => { setWeapon(w.choice); setMode('fire'); setPlot([]) }} disabled={!!record?.fired}>
                        {w.label}
                      </button>
                    ))}
                  </div>
                  {mode === 'fire' && weapon ? <p className="campaign-dim">Click an enemy element to add it to the volley.</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {firingUnit && (volley.length > 0 || (mode === 'fire' && weapon)) ? (
            <div className="panel dst-volley">
              <h3>
                {opportunity ? 'Opportunity fire' : 'Volley'} <span className="campaign-dim">{firingUnit.name}</span>
              </h3>
              {volley.length === 0 ? <p className="campaign-dim">No shots yet.</p> : null}
              <ul className="dst-shots">
                {volley.map((s) => {
                  const plan = planFor(s)
                  const firer = state.elements[s.elementId]!
                  const target = state.elements[s.targetId]!
                  return (
                    <li key={s.elementId}>
                      <b>{firer.name}</b> → {target.name}
                      <span className="campaign-dim"> {plan.ok ? oddsOf(plan) : `${plan.reason} (${plan.page})`}</span>
                      <button onClick={() => setVolley((v) => v.filter((x) => x.elementId !== s.elementId))}>×</button>
                    </li>
                  )
                })}
              </ul>
              <div className="dst-row">
                <button className="primary" onClick={fireVolley} disabled={volley.length === 0}>
                  {opportunity ? 'Fire!' : 'Fire the volley'}
                </button>
                <button onClick={() => { setVolley([]); setMode('idle'); setWeapon(null) }}>Clear</button>
              </div>
            </div>
          ) : null}

          <div className="side-dock dst-log-dock">
            <h3>
              Log <span className="campaign-dim num">{state.log.length}</span>
            </h3>
            <div className="log dst-log">
              {state.log
                .slice(-80)
                .reverse()
                .map((entry, i) => (
                  <p key={`${state.log.length - i}`} className={entry.side ? `is-${entry.side}` : undefined}>
                    <span className="campaign-dim num">T{entry.turn} </span>
                    {entry.text}
                    {entry.page ? <span className="rule-ref"> {entry.page}</span> : null}
                  </p>
                ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
