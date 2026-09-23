import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { newStream } from '../../dirtside/dice'
import { aiAction } from '../../dirtside/table/ai'
import { QUALITY_DIE, restrictionsOf } from '../../dirtside/table/confidence'
import { INTEGRITY, applyAction, canPass, commandUnitOf, craftToLand, elementsOf, functional, mobile, objectiveValues, strikesDue, unactivatedUnits } from '../../dirtside/table/game'
import { STRIKE_RADIUS, orbitalShips, overhead } from '../../dirtside/table/orbital'
import { baseMovement, planTableShot, unitKind, type TableShotPlan } from '../../dirtside/table/tableFire'
import { distance, lineOfSight, pathCost } from '../../dirtside/table/terrain'
import type { Action, ElementState, GameState, OrbitalAttack, Point, Posture, ShotOrder, SideId, UnitState, WeaponChoice } from '../../dirtside/table/types'
import { ElementCard } from './play/ElementCard'
import { FirstGameTip, HowToPlay } from './play/HowToPlay'
import { describeAction, marksOf, recapGroups, type PlayEvent } from './play/journal'
import { LogDock } from './play/LogDock'
import { OutcomeCard } from './play/OutcomeCard'
import { RefusalToast } from './play/RefusalToast'
import { ResultPanel } from './play/ResultPanel'
import { ForcePanel, type RosterAction } from './play/Roster'
import { StatusStrip, type StripAction, type StripModel } from './play/StatusStrip'
import { CraftPanel, OrbitPanel } from './play/SupportPanels'
import { useTableKeys } from './play/useTableKeys'
import { VolleyPanel } from './play/VolleyPanel'
import { familyOf, oddsOf, pct, sameWeapon, shortReason, wades, weaponsOf } from './play/words'
import { TableMap, type RecentMark, type TargetingOverlay } from './TableMap'
import { canTakeBackDirtside, currentDirtsideBattle, dirtsideBattleText, dirtsideDispatch, dirtsideTransitions, takeBackDirtside, useDirtsideBattle, type DirtsideTransition } from './dirtsideStore'
import { unitCodes } from './unitCodes'

/**
 * The Dirtside II table, played from one console: a strip above the table
 * saying whose turn it is and what to press, the table in the middle, and
 * down the right what is happening now, the forces, help from orbit and the
 * log. The screen never decides a rule — every click is an action through
 * the one door, every button the rules would refuse is asked first, and a
 * refusal comes back in plain words with its page.
 */
export interface TableScreenProps {
  onMenu: () => void
  onNewSkirmish: () => void
  /** A campaign landing on the table: where it came from, and the way back with its result. */
  campaign?: { label: string; onReturn: () => void } | null
}

type Mode = 'idle' | 'move' | 'fire' | 'orbital' | 'land'

/** How long the computer waits before its next action, by what it just did, so a player can follow it. */
const AI_DELAY_MS = 380
const AI_PACE: Partial<Record<Action['kind'], number>> = { activate: 520, move: 600, fire: 1100, 'opportunity-fire': 1100, 'call-orbital': 800, 'orbital-strike': 1100, 'land-craft': 900, unload: 700 }

const SIDES: SideId[] = ['north', 'south']

export function TableScreen(props: TableScreenProps) {
  const state = useDirtsideBattle()
  if (!state) {
    return (
      <div className="app dirtside-screen">
        <header className="app-bar">
          <h1>Dirtside II</h1>
          <span className="spacer" />
          <button onClick={props.onNewSkirmish}>New skirmish</button>
          <button onClick={props.onMenu}>Menu</button>
        </header>
        <main className="app-body">
          <p className="campaign-dim">No battle is under way.</p>
        </main>
      </div>
    )
  }
  return <Table {...props} state={state} />
}

interface Shown {
  reason: string
  page: string
  /** Where on the table the refused click was, or null for a button. */
  at: Point | null
}

function Table({ state, onMenu, onNewSkirmish, campaign }: TableScreenProps & { state: GameState }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('idle')
  const [plot, setPlot] = useState<Point[]>([])
  const [evasive, setEvasive] = useState(false)
  const [travel, setTravel] = useState(false)
  const [weapon, setWeapon] = useState<WeaponChoice | null>(null)
  const [volley, setVolley] = useState<ShotOrder[]>([])
  const [firingUnitId, setFiringUnitId] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<Shown | null>(null)
  const [orbitalChoice, setOrbitalChoice] = useState<{ shipId: string; attack: OrbitalAttack } | null>(null)
  /* Craft being brought down this activation: each placed with a click (p. 43). */
  const [landings, setLandings] = useState<Array<{ craftId: string; at: Point }>>([])
  const [placing, setPlacing] = useState<string | null>(null)
  const [hoverUnitId, setHoverUnitId] = useState<string | null>(null)
  const [guide, setGuide] = useState(false)
  const [resultHidden, setResultHidden] = useState(false)
  /* The player's own folding of the force lists; unset follows who is acting. */
  const [folds, setFolds] = useState<Partial<Record<SideId, boolean>>>({})
  const [outcomeHiddenAt, setOutcomeHiddenAt] = useState(-1)
  const pane = useRef<HTMLDivElement>(null)

  /* The computer's seats: whenever one of them is to act, it acts, a beat
     later, through the same door as everyone else. It lingers after a shot. */
  useEffect(() => {
    if (state.result) return
    const seats = state.setup.aiSides ?? []
    if (seats.length === 0) return
    const side = state.phase === 'deployment' ? (seats.find((s) => !state.sides[s].ready) ?? null) : state.toAct && seats.includes(state.toAct) ? state.toAct : null
    if (!side) return
    const last = state.journal[state.journal.length - 1]
    const timer = setTimeout(
      () => {
        const live = currentDirtsideBattle()
        if (!live || live !== state) return
        const action = aiAction(live, side, newStream((live.setup.seed ^ Math.imul(live.journal.length + 1, 2654435761)) >>> 0))
        if (!action) return
        if (!dirtsideDispatch(action)) return
        const fallback: Action = live.activation?.window ? { kind: 'decline-opportunity', side, forActivation: true } : live.activation ? { kind: 'end-activation', side } : strikesDue(live, side).length > 0 ? { kind: 'orbital-strike', side } : { kind: 'done', side }
        dirtsideDispatch(fallback)
      },
      (last && AI_PACE[last.kind]) ?? AI_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [state])

  const seats = useMemo(() => state.setup.aiSides ?? [], [state.setup.aiSides])
  const human = useCallback((side: SideId) => !seats.includes(side), [seats])
  const humans = SIDES.filter(human)
  const activation = state.activation
  const offer = activation?.window ?? null
  const activeUnit = activation ? (state.units[activation.unitId] ?? null) : null
  const toAct = state.toAct
  const codes = useMemo(() => unitCodes(state), [state.setup]) // eslint-disable-line react-hooks/exhaustive-deps
  const selected = selectedId ? (state.elements[selectedId] ?? null) : null
  const selectedUnit = selected ? (state.units[selected.unitId] ?? null) : null
  /** The unit whose shots are being built: the activated unit, or the one answering a window. */
  const firingUnit = offer ? (firingUnitId ? (state.units[firingUnitId] ?? null) : null) : activeUnit
  const opportunity = !!offer
  const computerToAct = !state.result && !!toAct && seats.includes(toAct) && state.phase !== 'deployment'
  const due = toAct && !activation && !state.result ? strikesDue(state, toAct).length > 0 : false
  const sideName = useCallback((s: SideId) => state.sides[s].name, [state.sides])
  const canControl = (unit: UnitState | null) => !!unit && !!activation && unit.id === activation.unitId && !offer && human(activation.sideId)
  const record = selected && activation && canControl(selectedUnit) ? (activation.elements[selected.id] ?? null) : null
  const allowance = selected ? (selected.damaged ? baseMovement(selected) / 2 : baseMovement(selected)) : 0
  const cap = record?.firedBeforeMoving ? Math.min(allowance, baseMovement(selected!) / 2) : allowance
  const left = record ? Math.max(0, cap - record.factorsUsed) : 0
  const family = selected ? familyOf(selected) : 'infantry'
  const plotted = useMemo(() => (selected && plot.length > 0 ? pathCost([selected.position, ...plot], family, state.setup.table.terrain, { amphibious: wades(selected), travel }) : null), [selected, plot, family, state.setup.table.terrain, travel])
  const picking = state.phase === 'activation' && !activation && !!toAct && human(toAct) && !due && !state.result
  const moveBlocked = !record || !selected ? 'Not in this activation' : !mobile(selected) ? `${selected.name} cannot move` : activation?.moveTest === 'failed' ? `${activeUnit?.name} failed its test to move under fire` : left <= 0.05 ? 'No movement left' : null
  const ghostReady = mode === 'idle' && !moveBlocked && !!record
  const moving = mode === 'move' && !!record

  // ---- When the activation passes on, the screen starts clean: the new unit's leader selected if it is ours.
  const activeKey = `${state.phase}|${activation?.unitId ?? ''}`
  const lastActiveKey = useRef(activeKey)
  useEffect(() => {
    if (lastActiveKey.current === activeKey) return
    lastActiveKey.current = activeKey
    setMode('idle')
    setPlot([])
    setVolley([])
    setWeapon(null)
    setOrbitalChoice(null)
    setFiringUnitId(null)
    setEvasive(false)
    setTravel(false)
    const live = currentDirtsideBattle()
    const act = live?.activation
    if (live && act && !seats.includes(act.sideId)) {
      const unit = live.units[act.unitId]
      const leader = unit ? (elementsOf(live, unit).find((e) => e.id === unit.leaderElementId && functional(e)) ?? elementsOf(live, unit).find(functional)) : null
      setSelectedId(leader?.id ?? null)
    } else if (live?.phase !== 'deployment') setSelectedId((id) => (id && live && live.elements[id]?.sideId === live.toAct && !live.activation && human(live.toAct!) ? id : null))
  }, [activeKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // A window opening or closing drops a half-built volley.
  const offerKey = offer ? `${offer.sideId}:${offer.movedElementId}` : ''
  const lastOfferKey = useRef(offerKey)
  useEffect(() => {
    if (lastOfferKey.current === offerKey) return
    const closed = lastOfferKey.current !== '' && offerKey === ''
    lastOfferKey.current = offerKey
    setVolley([])
    setFiringUnitId(null)
    setWeapon(null)
    setMode((m) => (m === 'fire' ? 'idle' : m))
    // The window answered, the table goes back to the unit whose move opened it: pick up where it left off.
    const live = currentDirtsideBattle()
    const a = live?.activation
    if (!closed || !live || !a || a.window || seats.includes(a.sideId)) return
    const unit = live.units[a.unitId]
    if (!unit) return
    const els = elementsOf(live, unit).filter(functional)
    const next = els.find((e) => !a.elements[e.id]?.moved && !a.elements[e.id]?.fired) ?? els.find((e) => !a.elements[e.id]?.fired) ?? els[0]
    setSelectedId(next?.id ?? null)
  }, [offerKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!state.result) setResultHidden(false)
  }, [state.result])
  // Evasive and travel mode belong to one element's move; a new selection starts without them.
  useEffect(() => {
    setEvasive(false)
    setTravel(false)
  }, [selectedId])

  const reset = () => {
    setMode('idle')
    setPlot([])
    setVolley([])
    setWeapon(null)
    setOrbitalChoice(null)
    setLandings([])
    setPlacing(null)
  }
  const act = (action: Action, at: Point | null = null): boolean => {
    const r = dirtsideDispatch(action)
    setRefusal(r ? { reason: r.reason, page: r.page, at } : null)
    return !r
  }

  const planFor = useCallback(
    (order: ShotOrder): TableShotPlan | { ok: false; reason: string; page: string } => planTableShot(state, order, { activation: opportunity ? null : (activation?.elements[order.elementId] ?? null), opportunity }),
    [state, opportunity, activation],
  )

  // ---- What just happened, from the store's recent transitions.
  const transitions = dirtsideTransitions()
  const described = useRef(new WeakMap<DirtsideTransition, { event: PlayEvent; marks: RecentMark[] }>())
  const { events, recent, lastId } = useMemo(() => {
    const events: PlayEvent[] = []
    let marks: Array<RecentMark & { by: SideId }> = []
    for (const t of transitions.list) {
      let d = described.current.get(t)
      if (!d) {
        d = { event: describeAction(t.before, t.action, t.after, codes), marks: marksOf(t.before, t.action, t.after) }
        described.current.set(t, d)
      }
      events.push(d.event)
      const k = t.action.kind
      // A side's old trails go when it starts its next go; the other side's stay for it to see.
      if ('side' in t.action && (k === 'activate' || k === 'land-craft' || k === 'unload' || k === 'rally')) {
        const s = t.action.side
        marks = marks.filter((m) => m.by !== s)
      }
      for (const m of d.marks) marks.push({ ...m, by: 'side' in t.action ? t.action.side : m.side })
    }
    return { events, recent: marks.slice(-30).map(({ by: _by, ...m }) => m as RecentMark), lastId: transitions.list[transitions.list.length - 1]?.id ?? 0 }
  }, [transitions.list, codes])
  // A go still under way with nothing done yet has nothing to tell; once over, it "held its ground".
  const lastTransition = transitions.list[transitions.list.length - 1]
  const outcomeRef = useRef<HTMLDivElement>(null)
  // Anything that happens on the table, the computer's go included, answers an old refusal.
  useEffect(() => setRefusal(null), [lastId])
  useEffect(() => {
    const k = lastTransition?.action.kind
    if (k === 'fire' || k === 'opportunity-fire' || k === 'orbital-strike') outcomeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [lastId]) // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => recapGroups(events).filter((g, i, all) => g.lines.length > 0 || i < all.length - 1).slice(-3), [events])
  const takeBackOk = !!lastTransition && 'side' in lastTransition.action && human(lastTransition.action.side) && canTakeBackDirtside() && !computerToAct

  // ---- Fire: every enemy's verdict for the armed weapon, for the map to light.
  const targeting = useMemo<TargetingOverlay | null>(() => {
    if (mode !== 'fire' || !selected || !weapon) return null
    const verdicts: TargetingOverlay['verdicts'] = {}
    for (const e of Object.values(state.elements)) {
      if (e.sideId === selected.sideId || e.destroyed || e.aboard) continue
      const plan = planFor({ elementId: selected.id, weapon, targetId: e.id })
      verdicts[e.id] = plan.ok ? { ok: true, odds: oddsOf(plan).short, range: plan.range } : { ok: false, reason: shortReason(plan.reason), range: distance(selected.position, e.position) }
    }
    const row = weaponsOf(selected).find((w) => sameWeapon(w.choice, weapon))
    return { firerId: selected.id, verdicts, bands: row?.bands.map((b) => b.upTo) }
  }, [mode, selected, weapon, state.elements, planFor])

  /** The next element of the firing unit that can still take a shot, with its first weapon that has a target. */
  const nextShooter = (queued: ShotOrder[], after: string): { id: string; weapon: WeaponChoice } | null => {
    if (!firingUnit) return null
    const els = elementsOf(state, firingUnit)
    const start = els.findIndex((e) => e.id === after)
    const order = [...els.slice(start + 1), ...els.slice(0, Math.max(0, start))]
    const enemies = Object.values(state.elements).filter((e) => e.sideId !== firingUnit.sideId && functional(e))
    for (const e of order) {
      if (!functional(e) || e.systemsDown || queued.some((s) => s.elementId === e.id)) continue
      if (!opportunity && activation?.elements[e.id]?.fired) continue
      for (const w of weaponsOf(e)) if (enemies.some((t) => planFor({ elementId: e.id, weapon: w.choice, targetId: t.id }).ok)) return { id: e.id, weapon: w.choice }
    }
    return null
  }

  // ---- Clicks on the table.
  const onSelectElement = (id: string) => {
    const el = state.elements[id]!
    // Calling fire from orbit, a click on a counter aims at where it stands.
    if (mode === 'orbital' && orbitalChoice && selected) {
      if (act({ kind: 'call-orbital', side: selected.sideId, elementId: selected.id, shipId: orbitalChoice.shipId, attack: orbitalChoice.attack, aim: { ...el.position } }, el.position)) reset()
      return
    }
    if (mode === 'fire' && selected && weapon && el.sideId !== selected.sideId) {
      const order: ShotOrder = { elementId: selected.id, weapon, targetId: id }
      const plan = planFor(order)
      if (!plan.ok) {
        setRefusal({ reason: plan.reason, page: plan.page, at: el.position })
        return
      }
      setRefusal(null)
      const queued = [...volley.filter((s) => s.elementId !== order.elementId), order]
      setVolley(queued)
      const next = nextShooter(queued, selected.id)
      if (next) {
        setSelectedId(next.id)
        setWeapon(next.weapon)
      } else setWeapon(null)
      return
    }
    if (mode === 'move' || mode === 'land') return
    setSelectedId(id)
    setRefusal(null)
    if (mode === 'fire') {
      const own = firingUnit && el.unitId === firingUnit.id
      setWeapon(null)
      if (!own && volley.length === 0) setMode('idle')
    }
  }

  const onClickTable = (point: Point) => {
    if (mode === 'land' && placing) {
      // A placement left over from a turn that has passed places nothing.
      if (!toAct || !human(toAct) || state.phase !== 'activation' || activation || state.craft[placing]?.status !== 'aloft') {
        setMode('idle')
        setPlacing(null)
        return
      }
      const planned = [...landings.filter((l) => l.craftId !== placing), { craftId: placing, at: point }]
      setLandings(planned)
      const next = craftToLand(state, toAct).find((c) => !planned.some((l) => l.craftId === c.id))
      setPlacing(next?.id ?? null)
      if (!next) setMode('idle')
      return
    }
    if (mode === 'orbital' && orbitalChoice && selected) {
      if (act({ kind: 'call-orbital', side: selected.sideId, elementId: selected.id, shipId: orbitalChoice.shipId, attack: orbitalChoice.attack, aim: point }, point)) reset()
      return
    }
    if (state.phase === 'deployment') {
      if (!selected || state.sides[selected.sideId].ready || !human(selected.sideId)) return
      act({ kind: 'deploy', side: selected.sideId, elementId: selected.id, position: point, facing: selected.sideId === 'north' ? 180 : 0 }, point)
      return
    }
    if (mode === 'move') {
      setPlot((p) => [...p, point])
      return
    }
    // With an element of the unit selected, a click on the ground starts its move there.
    if (ghostReady) {
      setMode('move')
      setPlot([point])
      setVolley([])
      setWeapon(null)
      setRefusal(null)
      return
    }
    if (mode === 'fire') return
    if (selected && !record) setSelectedId(null)
  }

  const confirmMove = () => {
    if (!selected || plot.length === 0) return
    const mover = selected.id
    const ok = act({ kind: 'move', side: selected.sideId, elementId: selected.id, path: plot, evasive: evasive || undefined, travel: travel || undefined }, plot[plot.length - 1] ?? null)
    if (!ok) return
    setPlot([])
    setMode('idle')
    setEvasive(false)
    setTravel(false)
    // On to the next element that has not moved, unless the move handed the table to the enemy.
    const live = currentDirtsideBattle()
    const a = live?.activation
    if (!live || !a || a.window) return
    const unit = live.units[a.unitId]
    if (!unit) return
    const els = elementsOf(live, unit)
    const at = els.findIndex((e) => e.id === mover)
    const next = [...els.slice(at + 1), ...els.slice(0, Math.max(0, at))].find((e) => mobile(e) && !a.elements[e.id]?.moved && !a.elements[e.id]?.fired)
    if (next) setSelectedId(next.id)
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

  const armWeapon = (w: WeaponChoice) => {
    if (mode === 'fire' && sameWeapon(weapon, w)) {
      setWeapon(null)
      if (volley.length === 0) setMode('idle')
      return
    }
    setWeapon(w)
    setMode('fire')
    setPlot([])
  }

  const startPlot = () => {
    if (moveBlocked) return
    setMode('move')
    setPlot([])
    setVolley([])
    setWeapon(null)
  }

  const endActivation = () => {
    if (!activation) return
    if (act({ kind: 'end-activation', side: activation.sideId })) reset()
  }

  const activateUnit = (u: UnitState) => {
    if (act({ kind: 'activate', side: u.sideId, unitId: u.id })) reset()
  }

  const leaderOf = (u: UnitState): ElementState | null => elementsOf(state, u).find((e) => e.id === u.leaderElementId && functional(e)) ?? elementsOf(state, u).find(functional) ?? elementsOf(state, u)[0] ?? null

  // ---- Asking the rules before the click: what each quiet button would get.
  const probe = useCallback((a: Action): string | null => {
    const r = applyAction(state, a)
    return 'ok' in r ? r.reason : null
  }, [state])
  const probes = useMemo(() => {
    if (!picking || !toAct) return null
    const held = state.setup.table.objectives.filter((o) => state.objectives[o.id]?.heldBy === toAct).length
    const declare = probe({ kind: 'declare-end', side: toAct })
    return {
      pass: canPass(state, toAct) ? probe({ kind: 'pass', side: toAct }) : 'You may pass only with fewer units left to act than the enemy.',
      done: probe({ kind: 'done', side: toAct }),
      declare: declare ? `${declare} You hold ${held} of ${state.setup.table.objectives.length}.` : null,
    }
  }, [picking, toAct, state, probe])
  const rallies = useMemo(() => {
    const out: Record<string, number> = {}
    if (!picking || !toAct) return out
    const command = commandUnitOf(state, toAct)
    if (!command || state.sides[toAct].commandLost) return out
    for (const u of Object.values(state.units)) {
      if (u.sideId !== toAct || u.activated || u.confidence === 'CO' || u.id === command.id || !elementsOf(state, u).some(functional)) continue
      if (probe({ kind: 'rally', side: toAct, unitId: u.id })) continue
      const die = QUALITY_DIE[u.quality]
      out[u.id] = Math.max(0, die - (u.leadership + command.leadership)) / die
    }
    return out
  }, [picking, toAct, state, probe])
  const regroups = useMemo(() => {
    const out = new Set<string>()
    if (!activation || offer || !human(activation.sideId) || Object.values(activation.elements).some((r) => r.fired)) return out
    const unit = state.units[activation.unitId]
    if (!unit) return out
    const mine = elementsOf(state, unit).filter(functional)
    for (const u of Object.values(state.units)) {
      if (u.sideId !== unit.sideId || u.id === unit.id || u.activated) continue
      const theirs = elementsOf(state, u).filter(functional)
      if (theirs.length === 0) continue
      const limit = INTEGRITY[unitKind(state, u)]
      if (mine.every((e) => theirs.some((o) => distance(e.position, o.position) <= limit + 1e-9)) && !probe({ kind: 'regroup', side: unit.sideId, intoUnitId: u.id })) out.add(u.id)
    }
    return out
  }, [activation, offer, human, state, probe])
  const stanceRefusals = useMemo(() => {
    if (!record || !selected?.vehicle) return null
    const out = {} as Record<Posture, string | null>
    for (const p of ['none', 'hull-down', 'turret-down'] as Posture[]) out[p] = p === selected.posture ? null : probe({ kind: 'posture', side: selected.sideId, elementId: selected.id, posture: p })
    return out
  }, [record, selected, probe])

  // ---- An opportunity window offered to a human: who can answer, and their best shot.
  const answers = useMemo(() => {
    if (!offer || !human(offer.sideId)) return null
    const moved = state.elements[offer.movedElementId]
    if (!moved) return null
    return unactivatedUnits(state, offer.sideId)
      .filter((u) => !u.panic && !u.evasive && restrictionsOf(u.confidence, unitKind(state, u)).returnFire)
      .map((u) => {
        let best: { id: string; weapon: WeaponChoice; kill: number } | null = null
        let seeing = 0
        for (const e of elementsOf(state, u)) {
          if (!functional(e) || e.systemsDown || !lineOfSight(e.position, moved.position, state.setup.table.terrain).clear) continue
          seeing += 1
          for (const w of weaponsOf(e)) {
            const plan = planTableShot(state, { elementId: e.id, weapon: w.choice, targetId: moved.id }, { activation: null, opportunity: true })
            if (plan.ok && (!best || oddsOf(plan).kill > best.kill)) best = { id: e.id, weapon: w.choice, kill: oddsOf(plan).kill }
          }
        }
        return { unit: u, seeing, best }
      })
      .filter((a) => a.seeing > 0)
  }, [offer, human, state])

  const answerWith = (u: UnitState, best: { id: string; weapon: WeaponChoice } | null) => {
    setFiringUnitId(u.id)
    setVolley([])
    setSelectedId(best?.id ?? leaderOf(u)?.id ?? null)
    setWeapon(best?.weapon ?? null)
    setMode('fire')
  }

  // ---- The strip: what the table is waiting for, and the one button.
  const values = objectiveValues(state)
  const strip = ((): StripModel => {
    const base = {
      turn: state.turn,
      turnLimit: state.setup.turnLimit,
      objectives: { north: values.north, south: values.south, names: { north: sideName('north'), south: sideName('south') }, markers: state.setup.table.objectives.length },
    }
    const secondary: StripAction[] = []
    const takeBack: StripAction | null = takeBackOk ? { key: 'take-back', label: 'Take back', onClick: () => doTakeBack(), title: 'Undo the last move or stance: it rolled no dice, so nothing is lost', kbd: 'Ctrl+Z' } : null
    if (state.result) {
      const r = state.result
      return {
        ...base,
        step: null,
        side: r.winner === 'draw' ? null : r.winner,
        sideText: 'Battle over',
        banner: r.winner === 'draw' ? `A draw: ${r.reason}.` : `${sideName(r.winner)} wins: ${r.reason}.`,
        hint: `Objectives: ${sideName('north')} ${r.values.north}, ${sideName('south')} ${r.values.south}. The table stays as it ended; the log tells the whole story.`,
        tone: 'result',
        primary: resultHidden ? { key: 'result', label: 'Show the result', onClick: () => setResultHidden(false) } : null,
        secondary,
      }
    }
    if (computerToAct) {
      const g = groups[groups.length - 1]
      return {
        ...base,
        step: offer ? 3 : state.phase === 'turn-start' ? 1 : activation ? 3 : 2,
        side: toAct,
        sideText: `${sideName(toAct!)} · computer`,
        banner: `The computer is playing ${sideName(toAct!)}…`,
        hint: g ? g.headline : 'Watch the table: its moves and shots are drawn as they happen.',
        tone: 'computer',
        primary: null,
        secondary,
      }
    }
    if (due) {
      return {
        ...base,
        step: 2,
        side: toAct,
        sideText: `${sideName(toAct!)} to act`,
        banner: `${sideName(toAct!)}: the fire called down from orbit arrives. Bring it down before anything else.`,
        hint: 'It lands where the impact marker is, give or take a stray of up to 7″, and hits everything in the zone, friend or foe.',
        tone: 'warn',
        primary: { key: 'strike', label: 'Bring down the orbital fire', onClick: () => act({ kind: 'orbital-strike', side: toAct! }), kbd: 'Enter' },
        secondary,
      }
    }
    if (state.phase === 'deployment') {
      const waiting = SIDES.filter((s) => !state.sides[s].ready && human(s))
      const readies = waiting.map((s): StripAction => ({ key: `ready-${s}`, label: `${sideName(s)}: ready`, onClick: () => act({ kind: 'ready', side: s }), kbd: 'Enter' }))
      if (takeBack) secondary.push(takeBack)
      return {
        ...base,
        step: 0,
        side: waiting.length === 1 ? waiting[0]! : null,
        sideText: waiting.length === 1 ? `${sideName(waiting[0]!)} deploys` : waiting.length === 0 ? 'Waiting' : 'Both sides deploy',
        banner: 'Deployment: pick an element, click where it stands, then Ready.',
        hint:
          selected && human(selected.sideId) && !state.sides[selected.sideId].ready
            ? `${selected.name} is picked: click inside ${sideName(selected.sideId)}'s shaded strip to put it there, or pick another.`
            : 'Everything already stands in its zone: press Ready when happy. To move a counter, click it, then click inside your shaded strip along your edge.',
        tone: 'normal',
        primary: readies[0] ?? null,
        secondary: [...readies.slice(1), ...secondary],
      }
    }
    if (state.phase === 'turn-start' && state.chooser) {
      const c = state.chooser
      const other: SideId = c === 'north' ? 'south' : 'north'
      const fewer = unactivatedUnits(state, c).length < unactivatedUnits(state, other).length
      return {
        ...base,
        step: 1,
        side: c,
        sideText: `${sideName(c)} chooses`,
        banner: `Turn ${state.turn}: ${sideName(c)} chooses who activates first.`,
        hint: `${sideName(c)} ${fewer ? 'has fewer units' : 'won the roll'}, so it picks. Going second lets you answer what the enemy does.`,
        tone: 'normal',
        primary: { key: 'first-me', label: `${sideName(c)} activates first`, onClick: () => act({ kind: 'choose-first', side: c, first: c }), kbd: 'Enter' },
        secondary: [{ key: 'first-them', label: `${sideName(other)} activates first`, onClick: () => act({ kind: 'choose-first', side: c, first: other }) }],
      }
    }
    if (offer) {
      const moved = state.elements[offer.movedElementId]!
      const n = answers?.length ?? 0
      return {
        ...base,
        step: 3,
        side: offer.sideId,
        sideText: `${sideName(offer.sideId)} may fire`,
        banner: `${sideName(offer.sideId)}: opportunity fire on ${moved.name}? Pick one of your unactivated units below.`,
        hint: firingUnit
          ? volley.length > 0
            ? `${volley.length} shot${volley.length === 1 ? '' : 's'} ready: press Fire! in the side column. Firing uses up ${firingUnit.name}'s activation for this turn.`
            : `Pick a weapon on one of ${firingUnit.name}'s elements and click ${moved.name}. Firing uses up its activation for this turn.`
          : `The enemy's ${moved.name} moved into view. ${n > 0 ? `${n} of your unit${n === 1 ? '' : 's'} can see it` : 'Your units that have not acted can shoot'}: firing now uses up that unit's activation for this turn. Or let it go.`,
        tone: 'warn',
        primary: null,
        secondary: [
          { key: 'decline', label: 'Decline', title: 'Let this move go', onClick: () => { act({ kind: 'decline-opportunity', side: offer.sideId }); reset(); setFiringUnitId(null) } },
          { key: 'decline-all', label: 'Decline for this activation', title: `Don't ask again until ${activeUnit?.name}'s activation ends`, onClick: () => { act({ kind: 'decline-opportunity', side: offer.sideId, forActivation: true }); reset(); setFiringUnitId(null) } },
        ],
      }
    }
    if (activation && activeUnit) {
      const els = elementsOf(state, activeUnit).filter(functional)
      const doneEls = els.filter((e) => activation.elements[e.id]?.moved || activation.elements[e.id]?.fired || !mobile(e))
      // Every element has moved or fired, or has nothing left it could do: the activation is finished.
      const finished = doneEls.length === els.length && mode === 'idle' && volley.length === 0
      const end: StripAction = { key: 'end', label: `End ${activeUnit.name}'s activation`, onClick: endActivation, kbd: 'E' }
      let hint: string
      if (mode === 'move' && selected) hint = plot.length === 0 ? `Click the table for ${selected.name}'s waypoints (${left.toFixed(1)} factors left). Enter moves, Backspace takes off the last point, Esc cancels.` : `${plotted?.blockedAt ? `Blocked by ${plotted.blockedBy?.replace('-', ' ')}: take off the last point.` : `${plotted?.length.toFixed(1)}″ for ${plotted?.factors.toFixed(1)} factors.`} Press Move (Enter) to go there, or click to add waypoints.`
      else if (mode === 'fire' && volley.length > 0 && !weapon) hint = `${volley.length} shot${volley.length === 1 ? '' : 's'} queued. Press Fire the volley (F), or pick another element's weapon to add more.`
      else if (mode === 'fire' && selected && weapon) hint = `Click a lit enemy to add ${selected.name}'s shot to the volley; the odds show on each target.${volley.length ? ` ${volley.length} queued.` : ''}`
      else if (mode === 'orbital') hint = 'Click the aim point: the caller must see it. The fire lands after the enemy\'s next activation and may stray up to 7″.'
      else if (finished) hint = `Every element of ${activeUnit.name} has acted. End the activation (E).`
      else if (selected && record) hint = `${selected.name}: click the ground to move it, or pick a weapon and click an enemy.${!record.moved && !record.fired ? ' Firing first limits it to half its move.' : ''} ${doneEls.length} of ${els.length} elements have acted.`
      else hint = `Pick one of ${activeUnit.name}'s ${els.length} elements (Tab), then move and fire. ${doneEls.length} of ${els.length} have acted.`
      if (takeBack) secondary.push(takeBack)
      return {
        ...base,
        step: 3,
        side: activation.sideId,
        sideText: `${sideName(activation.sideId)} acting`,
        banner: `${sideName(activeUnit.sideId)}: ${activeUnit.name} is activated. Move and fire its elements, then end the activation.`,
        hint,
        tone: 'normal',
        primary: finished ? end : null,
        secondary: finished ? secondary : [end, ...secondary],
      }
    }
    if (toAct) {
      const mine = unactivatedUnits(state, toAct)
      const theirs = unactivatedUnits(state, toAct === 'north' ? 'south' : 'north')
      const pick = selectedUnit && selectedUnit.sideId === toAct && !selectedUnit.activated && elementsOf(state, selectedUnit).some(functional) ? selectedUnit : null
      const craft = craftToLand(state, toAct).length
      const hint = pick
        ? `${pick.name} is picked. Activate it to move and fire its elements, or pick another unit.`
        : `Click one of your units on the map or in the list, then Activate. ${sideName(toAct)} has ${mine.length} still to act; ${sideName(toAct === 'north' ? 'south' : 'north')} has ${theirs.length}.${craft ? ` Or bring craft down from orbit: Place each on the map.` : ''}`
      if (probes) {
        secondary.push({ key: 'pass', label: 'Pass', onClick: () => { if (act({ kind: 'pass', side: toAct })) reset() }, refused: probes.pass, title: 'The enemy then activates two units in a row' })
        secondary.push({ key: 'done', label: `${sideName(toAct)}: no more activations${mine.length ? ` (skips ${mine.length} unit${mine.length === 1 ? '' : 's'})` : ''}`, onClick: () => { if (act({ kind: 'done', side: toAct })) reset() }, refused: probes.done, title: `Ends ${sideName(toAct)}'s turn: its units not yet activated sit it out (p. 18)` })
        secondary.push({ key: 'declare', label: 'Declare game end', onClick: () => { if (act({ kind: 'declare-end', side: toAct })) reset() }, refused: probes.declare, title: 'Ends the battle now, holding more than half the objectives (p. 17)' })
      }
      return {
        ...base,
        step: 2,
        side: toAct,
        sideText: `${sideName(toAct)} to act`,
        banner: `Turn ${state.turn}: ${sideName(toAct)} to activate a unit${state.owed > 1 ? ` (${state.owed} in succession)` : ''}.`,
        hint,
        tone: 'normal',
        primary: pick ? { key: 'activate', label: `Activate ${codes[pick.id] ?? ''} ${pick.name}`.replace('  ', ' '), onClick: () => activateUnit(pick), kbd: 'Enter' } : null,
        secondary,
      }
    }
    return { ...base, step: null, side: null, sideText: '', banner: 'The table is waiting.', hint: '', tone: 'normal', primary: null, secondary }
  })()

  function doTakeBack() {
    if (takeBackDirtside()) {
      setRefusal(null)
      setPlot([])
      setMode('idle')
    }
  }

  // ---- The keyboard.
  const cycle = (back: boolean) => {
    let pool: ElementState[] = []
    if (activation && activeUnit && canControl(activeUnit)) {
      const els = elementsOf(state, activeUnit).filter(functional)
      const fresh = els.filter((e) => !activation.elements[e.id]?.moved && !activation.elements[e.id]?.fired)
      pool = fresh.length > 0 ? fresh : els
    } else if (offer && firingUnit) pool = elementsOf(state, firingUnit).filter(functional)
    else if (picking && toAct) pool = unactivatedUnits(state, toAct).map(leaderOf).filter((e): e is ElementState => !!e)
    if (pool.length === 0) return
    const at = pool.findIndex((e) => (picking ? e.unitId === selected?.unitId : e.id === selectedId))
    const next = pool[(at + (back ? -1 : 1) + pool.length) % pool.length] ?? pool[0]!
    setSelectedId(next.id)
    if (mode !== 'fire') {
      setMode('idle')
      setPlot([])
    } else setWeapon(null)
  }
  const primaryNow = () => {
    if (mode === 'move' && plot.length > 0) return confirmMove()
    if (volley.length > 0) return fireVolley()
    if (landings.length > 0 && toAct) return act({ kind: 'land-craft', side: toAct, landings }) && reset()
    strip.primary?.onClick()
  }
  const controlling = !!record && !state.result
  useTableKeys(
    {
      next: activation || picking || offer ? cycle : undefined,
      cancel: () => {
        if (guide) return setGuide(false)
        if (mode !== 'idle') {
          reset()
          setPlacing(null)
          return
        }
        if (refusal) return setRefusal(null)
        setSelectedId(null)
      },
      plot: controlling && !moveBlocked ? startPlot : undefined,
      undoPoint: mode === 'move' ? () => setPlot((p) => p.slice(0, -1)) : undefined,
      primary: computerToAct ? undefined : primaryNow,
      arm: selected && firingUnit && selected.unitId === firingUnit.id && (controlling || opportunity) ? (i) => { const w = weaponsOf(selected)[i]; if (w) armWeapon(w.choice) } : undefined,
      fire: volley.length > 0 ? fireVolley : undefined,
      stance: controlling && selected?.vehicle ? (p) => act({ kind: 'posture', side: selected.sideId, elementId: selected.id, posture: p }) : undefined,
      end: activation && canControl(activeUnit) ? endActivation : undefined,
      activate: picking && selectedUnit && selectedUnit.sideId === toAct && !selectedUnit.activated ? () => activateUnit(selectedUnit) : undefined,
      guide: () => setGuide((g) => !g),
      takeBack: takeBackOk ? doTakeBack : undefined,
    },
    false,
  )

  // ---- The side column's pieces.
  const orbitCaller =
    selected && activation && !offer && human(activation.sideId) && canControl(selectedUnit) && record && !record.fired && !selected.destroyed && (selectedUnit?.leaderElementId === selected.id || selected.infantry?.team === 'observer') ? selected : null
  const orbitActing = activation && !offer && human(activation.sideId) ? activation.sideId : null
  const cannotCall = orbitActing
    ? record?.fired && canControl(selectedUnit)
      ? `${selected?.name} has already made its attack this activation.`
      : `Select ${activeUnit?.name}'s leader (the tag with the pennant) or an observer team to call fire. Calling is its attack for this activation.`
    : picking && toAct && orbitalShips(state, toAct).length > 0 && overhead(state, toAct)
      ? 'Activate a unit first: its leader calls the fire, as its attack.'
      : null
  const craftActing = toAct && human(toAct) && state.phase === 'activation' && !activation && !due && !state.result ? toAct : null

  const rosterActions = (u: UnitState): RosterAction[] => {
    const out: RosterAction[] = []
    const alive = elementsOf(state, u).some(functional)
    if (picking && u.sideId === toAct && !u.activated && alive) out.push({ label: 'Activate', onClick: () => activateUnit(u), title: 'Its elements move and fire now; then the other side picks' })
    if (rallies[u.id] !== undefined) out.push({ label: 'Rally', onClick: () => act({ kind: 'rally', side: u.sideId, unitId: u.id }), title: `The HQ tries to steady it: ${pct(rallies[u.id]!)} to go up a level. Uses its activation (p. 24)` })
    if (regroups.has(u.id)) out.push({ label: 'Regroup into', onClick: () => { if (activation && act({ kind: 'regroup', side: activation.sideId, intoUnitId: u.id })) reset() }, title: `${activeUnit?.name} joins this unit; both activations are spent (p. 24)` })
    return out
  }
  const answering = answers ? new Set(answers.map((a) => a.unit.id)) : null
  const forceFolded = (s: SideId) => {
    const must = (toAct === s && human(s)) || state.phase === 'deployment' || (offer?.sideId === s && human(s)) || activation?.sideId === s
    if (must) return false
    // Against the computer your own force stays open and the computer's folds; hot-seat, the side not acting folds.
    if (humans.length === 1) return folds[s] ?? !humans.includes(s)
    return folds[s] ?? (toAct !== null && toAct !== s)
  }
  const forceOrder: SideId[] = toAct === 'south' || (activation?.sideId === 'south' && !offer) ? ['south', 'north'] : ['north', 'south']
  const showOutcome = groups.length > 0 && lastId > outcomeHiddenAt && state.phase !== 'deployment'

  // Which element's card the Now column shows, and what it can do.
  const card = selected && selectedUnit ? (
    <ElementCard
      element={selected}
      unit={selectedUnit}
      code={codes[selectedUnit.id] ?? ''}
      record={record}
      cap={cap}
      left={left}
      leader={selectedUnit.leaderElementId === selected.id}
      move={
        record
          ? {
              plotting: mode === 'move',
              plot: plot.length,
              plotted,
              evasive,
              travel,
              canEvade: !!selected.vehicle && ['fast-gev', 'grav'].includes(selected.vehicle.mobility),
              onEvasive: setEvasive,
              onTravel: setTravel,
              onPlot: startPlot,
              onConfirm: confirmMove,
              onUndo: () => setPlot((p) => p.slice(0, -1)),
              onCancel: () => {
                setMode('idle')
                setPlot([])
              },
              cannotMove: moveBlocked,
            }
          : null
      }
      stance={record && stanceRefusals ? { refusals: stanceRefusals, onStance: (p) => act({ kind: 'posture', side: selected.sideId, elementId: selected.id, posture: p }), onRepair: selected.systemsDown ? () => act({ kind: 'repair', side: selected.sideId, elementId: selected.id }) : null } : null}
      fire={
        firingUnit && selected.unitId === firingUnit.id && !selected.destroyed && (canControl(selectedUnit) || opportunity)
          ? {
              weapons: weaponsOf(selected),
              armed: mode === 'fire' ? weapon : null,
              onArm: armWeapon,
              locked: record?.fired ? 'fired this activation' : record?.travel ? 'moved in travel mode: no fire' : selected.systemsDown ? 'systems down: no fire' : null,
              note: opportunity ? 'Opportunity fire: this uses up the unit\'s activation for the turn.' : record && !record.moved && !record.fired ? `Firing first limits it to half its move (${baseMovement(selected) / 2}″).` : record && record.moved && record.factorsUsed > baseMovement(selected) / 2 ? 'Moved more than half: its shots are harder.' : null,
            }
          : null
      }
    />
  ) : null

  const pendingShots = firingUnit
    ? elementsOf(state, firingUnit)
        .filter((e) => functional(e) && !volley.some((s) => s.elementId === e.id))
        .map((e) => ({ id: e.id, name: e.name, why: !opportunity && activation?.elements[e.id]?.fired ? 'fired' : e.systemsDown ? 'systems down' : 'no shot yet' }))
    : []

  const resultOpen = !!state.result && !resultHidden
  const mapCursor = (mode === 'fire' && weapon) || mode === 'orbital' ? 'crosshair' : (mode === 'land' && placing) || (state.phase === 'deployment' && selected && human(selected.sideId) && !state.sides[selected.sideId].ready) ? 'place' : moving || ghostReady ? 'move' : 'default'
  const viewer: SideId | null = humans.length === 1 ? humans[0]! : (toAct ?? (state.phase === 'deployment' ? null : 'north'))

  return (
    <div className="app dirtside-screen">
      <header className="app-bar dst-bar">
        <h1>{state.setup.name}</h1>
        <span className="campaign-kicker">Dirtside II</span>
        {campaign ? <span className="campaign-kicker">{campaign.label}</span> : null}
        <span className="spacer" />
        <button className={guide ? 'is-on' : undefined} onClick={() => setGuide((g) => !g)} aria-keyshortcuts="?">
          How to play
        </button>
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
        {resultOpen ? null : campaign ? (
          <button className={state.result ? 'primary' : undefined} onClick={campaign.onReturn}>
            Return to campaign
          </button>
        ) : (
          <button onClick={onNewSkirmish}>New skirmish</button>
        )}
        <button onClick={onMenu}>{campaign ? 'Campaign' : 'Menu'}</button>
      </header>

      <main className="app-body dst-play">
        <div className="dst-main">
          <StatusStrip model={strip} />
          <div className={`dst-table${toAct ? ` acts-${toAct}` : ''}`} ref={pane}>
            <TableMap
              state={state}
              selectedId={selectedId}
              onSelectElement={onSelectElement}
              onClickTable={onClickTable}
              plot={moving ? plot : []}
              plotFrom={(moving || ghostReady) && selected ? selected.position : null}
              reach={moving || ghostReady ? left - (moving ? (plotted?.factors ?? 0) : 0) : null}
              targets={volley.map((s) => s.targetId)}
              highlight={offer?.movedElementId ?? null}
              pendingLandings={landings.map((l) => ({ at: l.at, label: state.setup.craft?.find((c) => c.id === l.craftId)?.name ?? '' }))}
              viewer={viewer}
              toAct={toAct}
              hoverUnitId={hoverUnitId}
              onHoverUnit={setHoverUnitId}
              targeting={targeting}
              moveBudget={(moving || ghostReady) && selected ? { family, amphibious: wades(selected), travel, left } : null}
              recent={recent}
              aimPreview={mode === 'orbital' && orbitalChoice ? { radius: STRIKE_RADIUS[orbitalChoice.attack] } : null}
              landingPreview={mode === 'land' && placing ? { label: state.setup.craft?.find((c) => c.id === placing)?.name ?? '' } : null}
              cursor={mapCursor}
            />
            {refusal ? <RefusalToast reason={refusal.reason} page={refusal.page} at={refusal.at} pane={pane} onClose={() => setRefusal(null)} /> : null}
            {resultOpen ? (
              <ResultPanel
                state={state}
                onDismiss={() => setResultHidden(true)}
                next={campaign ? { label: 'Return to campaign', onClick: campaign.onReturn } : { label: 'New skirmish', onClick: onNewSkirmish }}
              />
            ) : null}
          </div>
        </div>

        <aside className="app-side dst-side">
          <div className="side-scroll dst-scroll">
            <FirstGameTip onGuide={() => setGuide(true)} />
            <div ref={outcomeRef} className="dst-outcome-slot">{showOutcome ? <OutcomeCard groups={groups} sideName={sideName} onDismiss={() => setOutcomeHiddenAt(lastId)} /> : null}</div>

            {activation && activeUnit && canControl(activeUnit) ? (
              <div className={`panel dst-active is-${activeUnit.sideId}`}>
                <div className="dst-active-head">
                  <span className="dst-code">{codes[activeUnit.id]}</span>
                  <b>{activeUnit.name}</b>
                  <span className="dst-active-tag">Activated</span>
                </div>
                <div className="dst-elchips" role="group" aria-label="Its elements">
                  {elementsOf(state, activeUnit)
                    .filter((e) => !e.aboard)
                    .map((e) => {
                      const r = activation.elements[e.id]
                      return (
                        <button key={e.id} className={`dst-elchip${e.id === selectedId ? ' is-on' : ''}${e.destroyed ? ' is-out' : ''}`} disabled={e.destroyed} onClick={() => onSelectElement(e.id)} title={e.destroyed ? 'Knocked out' : undefined}>
                          <span className="dst-elchip-name">{e.name}</span>
                          <span className={`dst-tick${r?.moved ? ' is-done' : ''}`}>{r?.moved ? '✓' : '·'} moved</span>
                          <span className={`dst-tick${r?.fired ? ' is-done' : ''}`}>{r?.fired ? '✓' : '·'} fired</span>
                        </button>
                      )
                    })}
                </div>
              </div>
            ) : null}

            {answers && offer ? (
              <div className="panel dst-window">
                <h3 className="dst-card-title">Fire back?</h3>
                <p>
                  The enemy's <b>{state.elements[offer.movedElementId]?.name}</b> moved into view. A unit that shoots now uses up its activation for this turn.
                </p>
                {answers.length === 0 ? <p className="dst-card-note">None of your units that have yet to act can see it.</p> : null}
                <ul className="dst-answers">
                  {answers.map((a) => (
                    <li key={a.unit.id} className={firingUnit?.id === a.unit.id ? 'is-on' : undefined}>
                      <span className="dst-code">{codes[a.unit.id]}</span>
                      <span className="dst-answer-name">{a.unit.name}</span>
                      <span className="campaign-dim">
                        {a.seeing} see{a.seeing === 1 ? 's' : ''} it{a.best ? ` · best ${pct(a.best.kill)} to kill` : ' · no shot in range'}
                      </span>
                      <button className={firingUnit?.id === a.unit.id ? 'is-on' : undefined} onClick={() => answerWith(a.unit, a.best)} disabled={!a.best}>
                        Fire with
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {firingUnit && (volley.length > 0 || (mode === 'fire' && weapon)) ? (
              <VolleyPanel
                state={state}
                unit={firingUnit}
                code={codes[firingUnit.id] ?? ''}
                opportunity={opportunity}
                volley={volley}
                planFor={planFor}
                pending={pendingShots}
                onRemove={(id) => setVolley((v) => v.filter((x) => x.elementId !== id))}
                onFire={fireVolley}
                onClear={() => {
                  setVolley([])
                  setMode('idle')
                  setWeapon(null)
                }}
              />
            ) : null}

            {card}


            {state.setup.craft && state.setup.craft.length > 0 ? (
              <CraftPanel
                state={state}
                acting={craftActing}
                landings={landings}
                placing={placing}
                onPlace={(id) => {
                  setMode('land')
                  setPlacing(id)
                  setRefusal(null)
                }}
                onCancelPlace={() => {
                  setPlacing(null)
                  setMode('idle')
                }}
                onUnplace={(id) => setLandings((list) => list.filter((l) => l.craftId !== id))}
                onBringDown={() => {
                  if (toAct && act({ kind: 'land-craft', side: toAct, landings })) reset()
                }}
                onUnload={(id) => {
                  const c = state.setup.craft?.find((k) => k.id === id)
                  if (c && act({ kind: 'unload', side: c.side, craftId: c.id })) reset()
                }}
              />
            ) : null}

            {state.orbit ? (
              <OrbitPanel
                state={state}
                acting={orbitActing}
                caller={orbitCaller}
                callerUnit={orbitCaller ? selectedUnit : null}
                cannotCall={cannotCall}
                armed={mode === 'orbital' ? orbitalChoice : null}
                onCall={(shipId, attack) => {
                  setOrbitalChoice({ shipId, attack })
                  setMode('orbital')
                  setPlot([])
                  setVolley([])
                  setRefusal(null)
                }}
                onCancel={() => {
                  setOrbitalChoice(null)
                  setMode('idle')
                }}
              />
            ) : null}

            {forceOrder.map((s) => (
              <ForcePanel
                key={s}
                state={state}
                side={s}
                codes={codes}
                collapsed={forceFolded(s)}
                onToggle={() => setFolds((f) => ({ ...f, [s]: !forceFolded(s) }))}
                activeUnitId={activeUnit?.id ?? null}
                firingUnitId={opportunity ? (firingUnit?.id ?? null) : null}
                answering={offer?.sideId === s ? answering : null}
                selectedUnitId={selectedUnit?.id ?? null}
                hoverUnitId={hoverUnitId}
                onHoverUnit={setHoverUnitId}
                onPick={(u) => {
                  const leader = leaderOf(u)
                  if (!leader) return
                  // Aiming, a row names its unit's leader as the target; otherwise a row picks its unit.
                  if (mode === 'fire' && weapon && selected && leader.sideId !== selected.sideId) return onSelectElement(leader.id)
                  if (mode === 'move' || mode === 'land') return
                  setSelectedId(leader.id)
                  setRefusal(null)
                  if (mode === 'orbital') {
                    setMode('idle')
                    setOrbitalChoice(null)
                  }
                }}
                onDoublePick={(u) => {
                  if (picking && u.sideId === toAct && !u.activated) activateUnit(u)
                }}
                actionsFor={rosterActions}
                holds={values[s]}
              />
            ))}
          </div>
          <LogDock log={state.log} northName={state.sides.north.name} southName={state.sides.south.name} />
        </aside>
        {guide ? <HowToPlay onClose={() => setGuide(false)} /> : null}
      </main>
    </div>
  )
}
