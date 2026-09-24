import { useEffect, useMemo, useRef, useState } from 'react'

import { newStream } from '../../stargrunt/dice'
import { aiAction } from '../../stargrunt/table/ai'
import { unitCentre } from '../../stargrunt/table/cover'
import {
  actionsLeft,
  alive,
  allowedActions,
  canBeHit,
  canPass,
  figuresOf,
  fit,
  liveUnits,
  objectiveValues,
  planAssault,
  planFire,
  threatNow,
  unactivatedUnits,
  type AllowedActionKind,
  type AssaultPlan,
} from '../../stargrunt/table/game'
import { combatMoveDie } from '../../stargrunt/table/movement'
import { smallArmProfile, supportWeaponProfile } from '../../stargrunt/data/weapons'
import type { Action, Confidence, FigureState, FireWith, GameState, Quality, Refusal, SideId, UnitState } from '../../stargrunt/types'
import { QUALITY_DIE } from '../../stargrunt/types'
import { HowToPlay } from './play/HowToPlay'
import { groupLog as sgGroupLog, maskObjectiveIds, objectiveLabels, QUIET as SG_LOG_QUIET } from './play/journal'
import { adviceFor as sgAdviceFor } from './play/words'
import { LogDock } from '../dirtside/play/LogDock'
import { RefusalToast } from '../dirtside/play/RefusalToast'
import { StatusStrip, type StripAction, type StripModel } from '../dirtside/play/StatusStrip'
import { useTableKeys } from '../dirtside/play/useTableKeys'
import { unitCodes } from '../dirtside/unitCodes'
import { TableMap, type TargetVerdict } from './TableMap'
import {
  canTakeBackStargrunt,
  currentStargruntBattle,
  stargruntBattleText,
  stargruntDispatch,
  takeBackStargrunt,
  useStargruntBattle,
} from './stargruntStore'

/**
 * The Stargrunt table, on the pattern of Dirtside's own `TableScreen.tsx`: a
 * strip above the table saying whose turn it is and what to press, the
 * table itself, and down the right the active squad's two actions, the
 * roster in plain words, and a readable log. The screen never decides a
 * rule: every click is one of the twelve actions through `applyAction`, a
 * refused one is greyed out with its reason from `allowedActions`.
 */
export interface TableScreenProps {
  onMenu: () => void
  onNewSkirmish: () => void
}

type Mode = 'idle' | 'move' | 'fire' | 'assault' | 'transfer' | 'rally'

const AI_DELAY_MS = 420
const AI_PACE: Partial<Record<Action['kind'], number>> = { activate: 520, move: 650, fire: 1100, 'close-assault': 1600, reorganise: 700, rally: 700, transfer: 700 }
const SIDES: SideId[] = ['north', 'south']
const CONFIDENCE_LABELS: Record<Confidence, string> = { CO: 'Confident', ST: 'Steady', SH: 'Shaken', BR: 'Broken', RO: 'Routed' }
const QUALITY_LABELS: Record<Quality, string> = { untrained: 'Untrained', green: 'Green', regular: 'Regular', veteran: 'Veteran', elite: 'Elite' }

export function TableScreen(props: TableScreenProps) {
  const state = useStargruntBattle()
  if (!state) {
    return (
      <div className="app dirtside-screen">
        <header className="app-bar">
          <h1>Stargrunt II</h1>
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
}

function weaponLabel(f: FigureState): string {
  return f.supportWeapon ? supportWeaponProfile(f.supportWeapon).name : smallArmProfile(f.smallArm).name
}

function figureStatusWord(f: FigureState): string {
  return f.status === 'ok' ? 'fit' : f.status === 'wounded' ? 'wounded' : f.status === 'stabilised' ? 'stabilised' : 'dead'
}

function Table({ state, onMenu, onNewSkirmish }: TableScreenProps & { state: GameState }) {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [selectedFigureId, setSelectedFigureId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('idle')
  const [moveMode, setMoveMode] = useState<'normal' | 'combat' | 'travel' | null>(null)
  const [fireWith, setFireWith] = useState<FireWith | null>(null)
  const [joinSupport, setJoinSupport] = useState<string[]>([])
  // K1: the charge flow's own two steps — pick the target (null until clicked), then review planAssault's
  // default paths/odds/threat and the ifShort choice before committing.
  const [assaultTargetUnitId, setAssaultTargetUnitId] = useState<string | null>(null)
  const [assaultIfShort, setAssaultIfShort] = useState<'stay' | 'withdraw'>('stay')
  const [refusal, setRefusal] = useState<Shown | null>(null)
  const [guide, setGuide] = useState(false)
  const [resultHidden, setResultHidden] = useState(false)
  const [folds, setFolds] = useState<Partial<Record<SideId, boolean>>>({})
  const pane = useRef<HTMLDivElement>(null)

  // The computer's seats: whenever one of them is to act, it acts a beat later, through the same door.
  useEffect(() => {
    if (state.result) return
    const seats = state.setup.aiSides ?? []
    if (seats.length === 0) return
    const side = state.phase === 'deployment' ? (seats.find((s) => !state.sides[s].ready) ?? null) : state.toAct && seats.includes(state.toAct) ? state.toAct : null
    if (!side) return
    const last = state.journal[state.journal.length - 1]
    const timer = setTimeout(
      () => {
        const live = currentStargruntBattle()
        if (!live || live !== state) return
        const action = aiAction(live, side, newStream((live.setup.seed ^ Math.imul(live.journal.length + 1, 2654435761)) >>> 0))
        if (!action) return
        stargruntDispatch(action)
      },
      (last && AI_PACE[last.kind]) ?? AI_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [state])

  const seats = useMemo(() => state.setup.aiSides ?? [], [state.setup.aiSides])
  const human = (side: SideId) => !seats.includes(side)
  const humans = SIDES.filter(human)
  const sideName = (s: SideId) => state.sides[s].name
  const codes = useMemo(() => unitCodes(state), [state.setup, state.units]) // eslint-disable-line react-hooks/exhaustive-deps
  const objLabels = useMemo(() => objectiveLabels(state), [state.setup.table.objectives])
  const activation = state.activation
  const activeUnit = activation ? (state.units[activation.unitId] ?? null) : null
  const toAct = state.toAct
  const computerToAct = !state.result && !!toAct && seats.includes(toAct) && state.phase !== 'deployment'
  const canControl = !!activeUnit && human(activeUnit.sideId)
  const allowed = activation && canControl ? allowedActions(state) : null
  const left = actionsLeft(state)
  const selectedUnit = selectedUnitId ? (state.units[selectedUnitId] ?? null) : null

  // ---- When the activation changes, the screen starts clean.
  const activeKey = `${state.phase}|${activation?.unitId ?? ''}`
  const lastActiveKey = useRef(activeKey)
  useEffect(() => {
    if (lastActiveKey.current === activeKey) return
    lastActiveKey.current = activeKey
    setMode('idle')
    setMoveMode(null)
    setFireWith(null)
    setJoinSupport([])
    const live = currentStargruntBattle()
    const act = live?.activation
    if (live && act && !seats.includes(act.sideId)) setSelectedUnitId(act.unitId)
    else if (live?.phase !== 'deployment') setSelectedUnitId((id) => (id && live && live.units[id]?.sideId === live.toAct && !live.activation ? id : null))
  }, [activeKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!state.result) setResultHidden(false)
  }, [state.result])

  const act = (action: Action): boolean => {
    const r = stargruntDispatch(action)
    setRefusal(r ? { reason: r.reason, page: r.page } : null)
    return !r
  }
  const resetMode = () => {
    setMode('idle')
    setMoveMode(null)
    setFireWith(null)
    setJoinSupport([])
    setAssaultTargetUnitId(null)
    setAssaultIfShort('stay')
  }

  // ---- Deployment.
  const deployFigure = selectedFigureId ? (state.figures[selectedFigureId] ?? null) : null
  const onClickTable = (point: { x: number; y: number }) => {
    if (state.phase === 'deployment') {
      if (!deployFigure || state.sides[deployFigure.sideId].ready || !human(deployFigure.sideId)) return
      act({ kind: 'deploy', side: deployFigure.sideId, figureId: deployFigure.id, position: point })
      return
    }
    if (mode === 'move' && moveMode && activeUnit && canControl) {
      const figs = figuresOf(state, activeUnit).filter(fit)
      if (figs.length === 0) return
      const origin = unitCentre(figs.map((f) => f.position))
      const dx = point.x - origin.x
      const dy = point.y - origin.y
      const moves = figs.map((f) => ({ figureId: f.id, path: [{ x: f.position.x + dx, y: f.position.y + dy }] }))
      if (act({ kind: 'move', side: activeUnit.sideId, mode: moveMode, moves })) resetMode()
      return
    }
  }

  // ---- Fire and close assault: planning against every live enemy unit.
  const enemySideOf = (u: UnitState): SideId => (u.sideId === 'north' ? 'south' : 'north')
  const targeting = useMemo(() => {
    if (mode !== 'fire' || !fireWith || !activeUnit) return null
    const verdicts: Record<string, TargetVerdict> = {}
    for (const u of liveUnits(state, enemySideOf(activeUnit))) {
      if (!figuresOf(state, u).some(canBeHit)) continue
      const plan = planFire(state, activeUnit.id, u.id, fireWith)
      if ('ok' in plan) verdicts[u.id] = { ok: false, reason: plan.reason }
      else if ('impossible' in plan.rangeDie) verdicts[u.id] = { ok: false, reason: plan.rangeDie.reason === 'over-d12' ? 'beyond effective range' : 'beyond close range' }
      else verdicts[u.id] = { ok: true, odds: `${Math.round(plan.pMajor * 100)}% major · ${Math.round((plan.pMinor + plan.pMajor) * 100)}% any effect`, range: plan.range }
    }
    return { firingUnitId: activeUnit.id, verdicts }
  }, [mode, fireWith, activeUnit, state])

  const attemptFire = (targetUnitId: string) => {
    if (!activeUnit || !fireWith) return
    if (act({ kind: 'fire', side: activeUnit.sideId, targetUnitId, with: fireWith })) resetMode()
  }

  // K1: the charge flow's planning step — `planAssault`'s default contact paths for the picked target,
  // its odds, its chance of contact by each roll and the defender's stand-test threat (p. 41), read
  // fresh off the target whenever the pick or the table state changes. A refusal (not an enemy, nobody
  // to fight, beyond two combat moves' reach…) greys the Charge button below with its own reason.
  const assaultPlan: AssaultPlan | Refusal | null = useMemo(() => {
    if (mode !== 'assault' || !activeUnit || !assaultTargetUnitId) return null
    return planAssault(state, activeUnit.id, assaultTargetUnitId)
  }, [mode, activeUnit, assaultTargetUnitId, state])
  const assaultPreview = assaultPlan && !('ok' in assaultPlan) ? { moves: assaultPlan.moves, costs: assaultPlan.costs, maxOneRoll: assaultPlan.maxOneRoll } : null

  const commitAssault = () => {
    if (!activeUnit || !assaultTargetUnitId || !assaultPlan || 'ok' in assaultPlan) return
    if (act({ kind: 'close-assault', side: activeUnit.sideId, targetUnitId: assaultTargetUnitId, moves: assaultPlan.moves, ifShort: assaultIfShort })) resetMode()
  }
  const attemptTransfer = (receiverUnitId: string) => {
    if (!activeUnit) return
    if (act({ kind: 'transfer', side: activeUnit.sideId, receiverUnitId })) resetMode()
  }
  const attemptRally = (targetUnitId: string) => {
    if (!activeUnit) return
    if (act({ kind: 'rally', side: activeUnit.sideId, targetUnitId })) resetMode()
  }

  const selectUnit = (id: string) => {
    const unit = state.units[id]
    if (!unit) return
    if (mode === 'fire' && fireWith && activeUnit) {
      if (unit.sideId !== activeUnit.sideId) return attemptFire(id)
    }
    if (mode === 'assault' && activeUnit) {
      if (unit.sideId !== activeUnit.sideId) {
        setAssaultTargetUnitId(id)
        setRefusal(null)
        return
      }
    }
    if (mode === 'transfer' && activeUnit) {
      if (unit.sideId === activeUnit.sideId && unit.id !== activeUnit.id) return attemptTransfer(id)
    }
    if (mode === 'rally' && activeUnit) {
      if (unit.sideId === activeUnit.sideId && unit.id !== activeUnit.id) return attemptRally(id)
    }
    if (mode === 'move') return
    setSelectedUnitId(id)
    setSelectedFigureId(null)
    setRefusal(null)
    if (mode === 'fire' || mode === 'assault' || mode === 'transfer' || mode === 'rally') resetMode()
  }

  const selectFigure = (id: string) => {
    const f = state.figures[id]
    if (!f) return
    setSelectedFigureId(id)
    setSelectedUnitId(f.unitId)
  }

  // ---- Move ghost for the map: the allowance (or, for a combat move, the roll's maximum) to draw as a
  // reach ring — `combatMoveDie` is the base-mobility number itself (movement.ts), so it also gives the
  // normal-move allowance directly; travel and a combat move's ceiling are twice that.
  const moveGhostInches = (() => {
    if (!moveMode || !activeUnit) return null
    const base = combatMoveDie(activeUnit.mobility)
    return moveMode === 'normal' ? base : base * 2
  })()
  const moveGhost = mode === 'move' && moveMode && activeUnit ? { mobility: activeUnit.mobility, figureIds: figuresOf(state, activeUnit).filter(fit).map((f) => f.id), mode: moveMode, inches: moveGhostInches } : null

  // ---- Roster helpers: transfer/rally candidate lists.
  const transferTargets = activeUnit ? Object.values(state.units).filter((u) => u.commanderId === activeUnit.id && figuresOf(state, u).some(alive)) : []
  const rallyTargets = activeUnit ? Object.values(state.units).filter((u) => u.commanderId === activeUnit.id && u.confidence !== 'CO' && figuresOf(state, u).some(alive)) : []

  // ---- The strip.
  const values = objectiveValues(state)
  const strip = ((): StripModel => {
    const base = {
      turn: state.turn,
      turnLimit: state.setup.turnLimit,
      objectives: { north: String(values.north), south: String(values.south), names: { north: sideName('north'), south: sideName('south') }, markers: state.setup.table.objectives.length, hidden: false },
    }
    const secondary: StripAction[] = []
    const takeBack: StripAction | null = canTakeBackStargrunt() ? { key: 'take-back', label: 'Take back', onClick: doTakeBack, title: 'Undo the last move or deployment: it rolled no dice, so nothing is lost', kbd: 'Ctrl+Z' } : null
    if (state.result) {
      const r = state.result
      return {
        ...base,
        step: null,
        side: r.winner === 'draw' ? null : r.winner,
        sideText: 'Battle over',
        banner: r.winner === 'draw' ? `A draw: ${r.reason}.` : `${sideName(r.winner)} wins: ${r.reason}.`,
        hint: `Objectives: ${sideName('north')} ${r.values.north}, ${sideName('south')} ${r.values.south}. The log tells the whole story.`,
        tone: 'result',
        primary: resultHidden ? { key: 'result', label: 'Show the result', onClick: () => setResultHidden(false), kbd: 'Enter' } : null,
        secondary,
      }
    }
    if (computerToAct) {
      return { ...base, step: activation ? 3 : state.phase === 'turn-start' ? 1 : 2, side: toAct, sideText: `${sideName(toAct!)} · computer`, banner: `The computer is playing ${sideName(toAct!)}…`, hint: 'Watch the table: its moves and shots are drawn as they happen.', tone: 'computer', primary: null, secondary }
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
        banner: 'Deployment: figures already stand in their zone.',
        hint: deployFigure && human(deployFigure.sideId) && !state.sides[deployFigure.sideId].ready ? `${deployFigure.name} is picked: click inside ${sideName(deployFigure.sideId)}'s shaded strip to put it there.` : 'Click a figure on the map or in the roster, then click inside your shaded strip to move it — or press Ready if you are happy as you stand.',
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
        hint: `${sideName(c)} ${fewer ? 'has fewer units' : 'won the roll'}, so it picks.`,
        tone: 'normal',
        primary: { key: 'first-me', label: `${sideName(c)} activates first`, onClick: () => act({ kind: 'choose-first', side: c, first: c }), kbd: 'Enter' },
        secondary: [{ key: 'first-them', label: `${sideName(other)} activates first`, onClick: () => act({ kind: 'choose-first', side: c, first: other }) }],
      }
    }
    if (activation && activeUnit && canControl) {
      const end: StripAction = { key: 'end', label: `End ${activeUnit.name}'s activation`, short: 'End activation', onClick: () => act({ kind: 'end-activation', side: activeUnit.sideId }), kbd: 'E' }
      let hint = `${activeUnit.name} has ${left} action${left === 1 ? '' : 's'} left. ${threatNow(state, activeUnit.id)}`
      if (mode === 'move' && moveMode) hint = `Click the table for ${activeUnit.name}'s new position (${moveMode} move). Esc cancels.`
      else if (mode === 'fire' && fireWith) hint = `Click a lit enemy squad to fire on it. Esc cancels.`
      else if (mode === 'assault' && !assaultTargetUnitId) hint = `Click an enemy squad to charge it. Esc cancels.`
      else if (mode === 'assault' && assaultTargetUnitId) hint = `Review the charge below, then Charge or pick another target. Esc cancels.`
      else if (mode === 'transfer') hint = `Click one of ${activeUnit.name}'s subordinates to hand it this activation.`
      else if (mode === 'rally') hint = `Click one of ${activeUnit.name}'s subordinates to rally it.`
      if (takeBack) secondary.push(takeBack)
      return {
        ...base,
        step: 3,
        side: activation.sideId,
        sideText: `${sideName(activation.sideId)} acting`,
        banner: `${sideName(activeUnit.sideId)}: ${activeUnit.name} is activated.`,
        hint,
        tone: 'normal',
        primary: left === 0 ? end : null,
        secondary: left === 0 ? secondary : [end, ...secondary],
      }
    }
    if (toAct) {
      const mine = unactivatedUnits(state, toAct)
      const theirs = unactivatedUnits(state, toAct === 'north' ? 'south' : 'north')
      const pick = selectedUnit && selectedUnit.sideId === toAct && !selectedUnit.activated && figuresOf(state, selectedUnit).some(fit) ? selectedUnit : null
      secondary.push({ key: 'pass', label: 'Pass', onClick: () => act({ kind: 'pass', side: toAct }), refused: canPass(state, toAct) ? null : 'A side may pass only with fewer units left to act than the enemy.', title: 'The enemy then activates two units in a row' })
      secondary.push({ key: 'done', label: `${sideName(toAct)}: no more activations${mine.length ? ` (skips ${mine.length})` : ''}`, short: `No more (skips ${mine.length})`, onClick: () => act({ kind: 'done', side: toAct }), title: `Ends ${sideName(toAct)}'s turn` })
      return {
        ...base,
        step: 2,
        side: toAct,
        sideText: `${sideName(toAct)} to act`,
        banner: `Turn ${state.turn}: ${sideName(toAct)} to activate a unit${state.owed > 1 ? ` (${state.owed} in succession)` : ''}.`,
        hint: pick ? `${pick.name} is picked. Activate it, or pick another unit.` : `Click one of your units on the map or in the roster, then Activate. ${sideName(toAct)} has ${mine.length} still to act; ${sideName(toAct === 'north' ? 'south' : 'north')} has ${theirs.length}.`,
        tone: 'normal',
        primary: pick ? { key: 'activate', label: `Activate ${codes[pick.id] ?? ''} ${pick.name}`.replace('  ', ' '), short: `Activate ${codes[pick.id] ?? pick.name}`, onClick: () => act({ kind: 'activate', side: toAct, unitId: pick.id }), kbd: 'Enter' } : null,
        secondary,
      }
    }
    return { ...base, step: null, side: null, sideText: '', banner: 'The table is waiting.', hint: '', tone: 'normal', primary: null, secondary }
  })()

  function doTakeBack() {
    if (takeBackStargrunt()) {
      setRefusal(null)
      resetMode()
    }
  }

  const primaryNow = () => {
    if (strip.primary) strip.primary.onClick()
  }
  useTableKeys(
    computerToAct || state.result
      ? { guide: () => setGuide((g) => !g), primary: strip.primary ? primaryNow : undefined }
      : {
          cancel: () => {
            if (guide) return setGuide(false)
            if (mode !== 'idle') return resetMode()
            if (refusal) return setRefusal(null)
            setSelectedUnitId(null)
          },
          primary: primaryNow,
          end: activation && canControl ? () => act({ kind: 'end-activation', side: activation.sideId }) : undefined,
          activate: toAct && selectedUnit && selectedUnit.sideId === toAct && !selectedUnit.activated ? () => act({ kind: 'activate', side: toAct, unitId: selectedUnit.id }) : undefined,
          guide: () => setGuide((g) => !g),
          takeBack: canTakeBackStargrunt() ? doTakeBack : undefined,
        },
    guide,
  )

  const resultOpen = !!state.result && !resultHidden
  const mapCursor = mode === 'fire' || mode === 'assault' || mode === 'transfer' || mode === 'rally' ? 'crosshair' : mode === 'move' ? 'move' : state.phase === 'deployment' && deployFigure ? 'crosshair' : 'default'

  const forceOrder: SideId[] = toAct === 'south' || (activation?.sideId === 'south') ? ['south', 'north'] : ['north', 'south']
  const forceFolded = (s: SideId) => {
    const must = (toAct === s && human(s)) || state.phase === 'deployment' || activation?.sideId === s
    if (must) return false
    if (humans.length === 1) return folds[s] ?? !humans.includes(s)
    return folds[s] ?? (toAct !== null && toAct !== s)
  }

  return (
    <div className="app dirtside-screen sg-screen">
      <header className="app-bar dst-bar">
        <h1>{state.setup.name}</h1>
        <span className="campaign-kicker">Stargrunt II</span>
        <span className="spacer" />
        <button className={guide ? 'is-on' : undefined} onClick={() => setGuide((g) => !g)} aria-keyshortcuts="?">
          How to play
        </button>
        <button
          onClick={() => {
            const text = stargruntBattleText()
            if (!text) return
            const blob = new Blob([text], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `${state.setup.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.stargrunt.json`
            a.click()
            URL.revokeObjectURL(a.href)
          }}
        >
          Save
        </button>
        <button onClick={onNewSkirmish}>New skirmish</button>
        <button onClick={onMenu}>Menu</button>
      </header>

      <main className="app-body dst-play sg-play">
        <div className="dst-main">
          <StatusStrip model={strip} />
          <div className={`dst-table${toAct ? ` acts-${toAct}` : ''}`} ref={pane}>
            <TableMap
              state={state}
              selectedUnitId={selectedUnitId}
              onSelectUnit={selectUnit}
              onClickTable={onClickTable}
              selectedFigureId={state.phase === 'deployment' ? selectedFigureId : undefined}
              onSelectFigure={state.phase === 'deployment' ? selectFigure : undefined}
              toAct={toAct}
              hoverUnitId={selectedUnitId}
              moveGhost={moveGhost}
              assaultPreview={assaultPreview}
              targeting={targeting}
              cursor={mapCursor}
            />
            {refusal ? <RefusalToast reason={refusal.reason} page={refusal.page} at={null} pane={pane} onClose={() => setRefusal(null)} adviceFor={sgAdviceFor} /> : null}
            {resultOpen ? (
              <div className="modal-backdrop" onClick={() => setResultHidden(true)}>
                <div className="modal sg-result" onClick={(e) => e.stopPropagation()}>
                  <h2>{state.result!.winner === 'draw' ? 'A draw' : `${sideName(state.result!.winner as SideId)} wins`}</h2>
                  <p>{state.result!.reason}.</p>
                  <p className="campaign-dim">
                    Objectives: {sideName('north')} {state.result!.values.north} · {sideName('south')} {state.result!.values.south}
                  </p>
                  <div className="sg-result-acts">
                    <button className="primary" onClick={onNewSkirmish}>
                      New skirmish
                    </button>
                    <button onClick={() => setResultHidden(true)}>Keep looking</button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="app-side dst-side">
          <div className="side-scroll dst-scroll">
            {activation && activeUnit && canControl ? (
              <ActiveSquadPanel
                state={state}
                unit={activeUnit}
                code={codes[activeUnit.id] ?? ''}
                allowed={allowed}
                left={left}
                mode={mode}
                moveMode={moveMode}
                fireWith={fireWith}
                joinSupport={joinSupport}
                setJoinSupport={setJoinSupport}
                transferTargets={transferTargets}
                rallyTargets={rallyTargets}
                codes={codes}
                assaultTargetUnitId={assaultTargetUnitId}
                assaultPlan={assaultPlan}
                assaultIfShort={assaultIfShort}
                onSetAssaultIfShort={setAssaultIfShort}
                onConfirmAssault={commitAssault}
                onPickAnotherAssaultTarget={() => {
                  setAssaultTargetUnitId(null)
                  setRefusal(null)
                }}
                onStartMove={(m) => {
                  setMode('move')
                  setMoveMode(m)
                  setFireWith(null)
                }}
                onArmSmallArms={() => {
                  setFireWith({ kind: 'small-arms', supportFigureIds: joinSupport })
                  setMode('fire')
                }}
                onArmSupport={(figureId) => {
                  setFireWith({ kind: 'support', figureId })
                  setMode('fire')
                }}
                onStartAssault={() => {
                  setMode('assault')
                  setFireWith(null)
                  setAssaultTargetUnitId(null)
                }}
                onStartTransfer={() => setMode('transfer')}
                onStartRally={() => setMode('rally')}
                onCancel={resetMode}
                onSimple={(kind) => act({ kind, side: activeUnit.sideId } as Action)}
                onEnd={() => act({ kind: 'end-activation', side: activeUnit.sideId })}
              />
            ) : (
              <div className="dst-tip sg-tip">
                <p>
                  <b>New to Stargrunt?</b> Each squad's activation is two actions: move, fire, close assault, reorganise, rally and the rest are one action each. The strip above the map always says what to do next.
                </p>
              </div>
            )}

            {forceOrder.map((s) => (
              <RosterPanel
                key={s}
                state={state}
                side={s}
                codes={codes}
                collapsed={forceFolded(s)}
                onToggle={() => setFolds((f) => ({ ...f, [s]: !forceFolded(s) }))}
                activeUnitId={activeUnit?.id ?? null}
                selectedUnitId={selectedUnitId}
                onPick={(id) => {
                  if (state.phase === 'deployment') {
                    const u = state.units[id]
                    const f = u ? figuresOf(state, u).find(fit) : null
                    if (f) selectFigure(f.id)
                    return
                  }
                  selectUnit(id)
                }}
                onDoublePick={(id) => {
                  const u = state.units[id]
                  if (u && toAct === u.sideId && !u.activated && human(u.sideId) && !activation) act({ kind: 'activate', side: u.sideId, unitId: id })
                }}
              />
            ))}
          </div>
          <LogDock log={state.log} northName={sideName('north')} southName={sideName('south')} groupLog={sgGroupLog} quiet={SG_LOG_QUIET} transform={(text) => maskObjectiveIds(text, objLabels)} />
        </aside>
        {guide ? <HowToPlay onClose={() => setGuide(false)} /> : null}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The active squad: its figures and its two actions.
// ---------------------------------------------------------------------------

function ActionButton({ label, onClick, refusal, active }: { label: string; onClick: () => void; refusal?: Refusal | { ok: true } | null; active?: boolean }) {
  const refused = refusal && !('ok' in refusal && refusal.ok) ? (refusal as Refusal).reason : null
  return (
    <span className={refused ? 'sg-refused' : undefined} title={refused ?? undefined}>
      <button className={active ? 'is-on' : undefined} disabled={!!refused} onClick={onClick} aria-pressed={active}>
        {label}
      </button>
    </span>
  )
}

interface ActiveSquadPanelProps {
  state: GameState
  unit: UnitState
  code: string
  allowed: Record<AllowedActionKind, { ok: true } | Refusal> | null
  left: 0 | 1 | 2
  mode: Mode
  moveMode: 'normal' | 'combat' | 'travel' | null
  fireWith: FireWith | null
  joinSupport: string[]
  setJoinSupport: (ids: string[]) => void
  transferTargets: UnitState[]
  rallyTargets: UnitState[]
  codes: Record<string, string>
  /** K1: the charge flow's own state — see `Table`'s `assaultTargetUnitId`/`assaultPlan`. */
  assaultTargetUnitId: string | null
  assaultPlan: AssaultPlan | Refusal | null
  assaultIfShort: 'stay' | 'withdraw'
  onSetAssaultIfShort: (v: 'stay' | 'withdraw') => void
  onConfirmAssault: () => void
  onPickAnotherAssaultTarget: () => void
  onStartMove: (mode: 'normal' | 'combat' | 'travel') => void
  onArmSmallArms: () => void
  onArmSupport: (figureId: string) => void
  onStartAssault: () => void
  onStartTransfer: () => void
  onStartRally: () => void
  onCancel: () => void
  onSimple: (kind: 'reorganise' | 'remove-suppression' | 'go-in-position' | 'leave-position' | 'recover-panic') => void
  onEnd: () => void
}

function ActiveSquadPanel(p: ActiveSquadPanelProps) {
  const {
    state,
    unit,
    code,
    allowed,
    left,
    mode,
    moveMode,
    fireWith,
    joinSupport,
    setJoinSupport,
    transferTargets,
    rallyTargets,
    codes,
    assaultTargetUnitId,
    assaultPlan,
    assaultIfShort,
    onSetAssaultIfShort,
    onConfirmAssault,
    onPickAnotherAssaultTarget,
    onStartMove,
    onArmSmallArms,
    onArmSupport,
    onStartAssault,
    onStartTransfer,
    onStartRally,
    onCancel,
    onSimple,
    onEnd,
  } = p
  const figures = figuresOf(state, unit)
  const supportCandidates = figures.filter((f) => fit(f) && f.supportWeapon && !unit.firedThisTurn.includes(f.id))
  const canSmallArms = allowed?.fire.ok && !unit.firedThisTurn.includes('small-arms') && figures.some(fit)
  // K2: the figure list starts folded to a one-line count — a full squad's rows are the single biggest
  // item in this panel, and the actions and the primary End button below need the room far more often
  // than the roster of names does.
  const [figuresOpen, setFiguresOpen] = useState(false)
  const fitCount = figures.filter(fit).length
  const woundedCount = figures.filter((f) => f.status === 'wounded').length
  const deadCount = figures.filter((f) => f.status === 'dead').length
  const showActions = mode === 'idle' || mode === 'move' || mode === 'fire' || mode === 'assault' || mode === 'transfer' || mode === 'rally'
  return (
    <div className={`panel dst-active sg-active is-${unit.sideId}`}>
      <div className="dst-active-head">
        <span className="dst-code">{code}</span>
        <b>{unit.name}</b>
        <span className="campaign-dim">
          {QUALITY_LABELS[unit.quality]} (D{QUALITY_DIE[unit.quality]}) · leader {unit.leadership} · {CONFIDENCE_LABELS[unit.confidence]}
        </span>
        <span className="spacer" />
        <span className="dst-active-tag">{left} action{left === 1 ? '' : 's'} left</span>
      </div>
      <p className="sg-threat">{threatNow(state, unit.id)}</p>

      {/* K2: everything but the primary End button scrolls inside its own bounded area, so a busy
          panel (a full figure list, several fire weapons, a Command section) never pushes the End
          button — or the log docked below this whole panel — out of sight (compare Dirtside's own
          `.dst-active`, whose single-element content never grows this tall). */}
      <div className="sg-active-scroll">
        <div className="sg-figures-head">
          <button className="dst-quiet sg-figures-toggle" onClick={() => setFiguresOpen((o) => !o)} aria-expanded={figuresOpen}>
            {figuresOpen ? 'Figures ▴' : 'Figures ▾'}
          </button>
          <span className="campaign-dim">
            {fitCount} fit{woundedCount ? `, ${woundedCount} wounded` : ''}{deadCount ? `, ${deadCount} dead` : ''}
          </span>
        </div>
        {figuresOpen ? (
          <ul className="sg-figures-list">
            {figures.map((f) => (
              <li key={f.id} className={`sg-figure-row is-${f.status}`}>
                <span className="sg-figure-name">
                  {f.name}
                  {unit.leaderId === f.id ? ' ★' : ''}
                </span>
                <span className="campaign-dim">{weaponLabel(f)}</span>
                <span className={`sg-figure-status is-${f.status}`}>{figureStatusWord(f)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {showActions ? (
          <div className="sg-actions">
            <div className="sg-action-group">
              <span className="sg-action-label">Move</span>
              <ActionButton label="Normal" active={mode === 'move' && moveMode === 'normal'} onClick={() => onStartMove('normal')} refusal={allowed?.move} />
              <ActionButton label="Combat" active={mode === 'move' && moveMode === 'combat'} onClick={() => onStartMove('combat')} refusal={allowed?.move} />
              <ActionButton label="Travel" active={mode === 'move' && moveMode === 'travel'} onClick={() => onStartMove('travel')} refusal={allowed?.move} />
              {mode === 'move' ? (
                <button className="dst-quiet" onClick={onCancel}>
                  Cancel
                </button>
              ) : null}
            </div>

            <div className="sg-action-group">
              <span className="sg-action-label">Fire</span>
              <ActionButton label="Small arms" active={mode === 'fire' && fireWith?.kind === 'small-arms'} onClick={onArmSmallArms} refusal={canSmallArms ? { ok: true } : allowed?.fire} />
              {supportCandidates.length > 0 ? (
                <span className="sg-join">
                  join:
                  {supportCandidates.map((f) => (
                    <label key={f.id}>
                      <input type="checkbox" checked={joinSupport.includes(f.id)} onChange={(e) => setJoinSupport(e.target.checked ? [...joinSupport, f.id] : joinSupport.filter((id) => id !== f.id))} />
                      {f.name}
                    </label>
                  ))}
                </span>
              ) : null}
              {mode === 'fire' ? (
                <button className="dst-quiet" onClick={onCancel}>
                  Cancel
                </button>
              ) : null}
            </div>
            {supportCandidates.map((f) => (
              <div className="sg-action-group" key={f.id}>
                <span className="sg-action-label">Alone</span>
                <ActionButton label={`${f.name} — ${weaponLabel(f)}`} active={mode === 'fire' && fireWith?.kind === 'support' && fireWith.figureId === f.id} onClick={() => onArmSupport(f.id)} refusal={allowed?.fire} />
              </div>
            ))}

            <div className="sg-action-group">
              <span className="sg-action-label">Close assault</span>
              <ActionButton label="Charge" active={mode === 'assault'} onClick={onStartAssault} refusal={allowed?.['close-assault']} />
              {mode === 'assault' ? (
                <button className="dst-quiet" onClick={onCancel}>
                  Cancel
                </button>
              ) : null}
            </div>
            {mode === 'assault' && assaultTargetUnitId ? (
              <AssaultPreview
                state={state}
                codes={codes}
                targetId={assaultTargetUnitId}
                plan={assaultPlan}
                ifShort={assaultIfShort}
                onSetIfShort={onSetAssaultIfShort}
                onConfirm={onConfirmAssault}
                onPickAnother={onPickAnotherAssaultTarget}
              />
            ) : null}

            <div className="sg-action-group">
              <span className="sg-action-label">Squad</span>
              <ActionButton label="Reorganise" onClick={() => onSimple('reorganise')} refusal={allowed?.reorganise} />
              <ActionButton label="Remove suppression" onClick={() => onSimple('remove-suppression')} refusal={allowed?.['remove-suppression']} />
              <ActionButton label="Go in position" onClick={() => onSimple('go-in-position')} refusal={allowed?.['go-in-position']} />
              <ActionButton label="Leave position" onClick={() => onSimple('leave-position')} refusal={allowed?.['leave-position']} />
              {unit.panic ? <ActionButton label="Recover from panic" onClick={() => onSimple('recover-panic')} refusal={allowed?.['recover-panic']} /> : null}
            </div>

            {transferTargets.length > 0 ? (
              <div className="sg-action-group">
                <span className="sg-action-label">Command</span>
                <ActionButton label="Transfer activation to…" active={mode === 'transfer'} onClick={onStartTransfer} refusal={allowed?.transfer} />
                {rallyTargets.length > 0 ? <ActionButton label="Rally…" active={mode === 'rally'} onClick={onStartRally} refusal={allowed?.rally} /> : null}
                {mode === 'transfer' || mode === 'rally' ? (
                  <span className="campaign-dim">
                    {(mode === 'transfer' ? transferTargets : rallyTargets).map((u) => `${codes[u.id] ?? ''} ${u.name}`).join(', ')} — click one on the map or roster.
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showActions ? (
        <button className="primary sg-end" onClick={onEnd}>
          End {unit.name}'s activation
        </button>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// K1: the charge under review — planAssault's odds, reach and threat, and the ifShort choice.
// ---------------------------------------------------------------------------

const pct = (x: number) => `${Math.round(x * 100)}%`

function AssaultPreview({
  state,
  codes,
  targetId,
  plan,
  ifShort,
  onSetIfShort,
  onConfirm,
  onPickAnother,
}: {
  state: GameState
  codes: Record<string, string>
  targetId: string
  plan: AssaultPlan | Refusal | null
  ifShort: 'stay' | 'withdraw'
  onSetIfShort: (v: 'stay' | 'withdraw') => void
  onConfirm: () => void
  onPickAnother: () => void
}) {
  const target = state.units[targetId]
  if (!target || !plan) return null
  const isRefusal = 'ok' in plan
  return (
    <div className={`sg-assault-preview${isRefusal ? ' is-refused' : ''}`}>
      <p className="sg-assault-preview-head">
        <b>
          {codes[targetId] ?? ''} {target.name}
        </b>
      </p>
      {isRefusal ? (
        <p className="campaign-dim">
          {plan.reason} <span className="sg-assault-page">{plan.page}</span>
        </p>
      ) : (
        <>
          <p className="campaign-dim">
            Odds {plan.odds}:1 · stands the charge at +{plan.standThreat}
          </p>
          <p className="campaign-dim">
            Contact: {pct(plan.pContactFirst)} on the first roll, {pct(plan.pContactSecond)} by the second
          </p>
          <div className="sg-assault-ifshort">
            <span className="sg-action-label">If short</span>
            <button type="button" className={ifShort === 'stay' ? 'is-on' : undefined} aria-pressed={ifShort === 'stay'} onClick={() => onSetIfShort('stay')} title="Stay where the second roll left them (p. 43)">
              Stay in the open
            </button>
            <button type="button" className={ifShort === 'withdraw' ? 'is-on' : undefined} aria-pressed={ifShort === 'withdraw'} onClick={() => onSetIfShort('withdraw')} title="Fall back to where the charge started, as if the reaction test had failed (p. 43)">
              Fall back
            </button>
          </div>
        </>
      )}
      <div className="sg-assault-preview-acts">
        <ActionButton label="Charge" onClick={onConfirm} refusal={isRefusal ? plan : { ok: true }} />
        <button className="dst-quiet" onClick={onPickAnother}>
          Pick another target
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The roster: both sides, in plain words.
// ---------------------------------------------------------------------------

function RosterPanel({
  state,
  side,
  codes,
  collapsed,
  onToggle,
  activeUnitId,
  selectedUnitId,
  onPick,
  onDoublePick,
}: {
  state: GameState
  side: SideId
  codes: Record<string, string>
  collapsed: boolean
  onToggle: () => void
  activeUnitId: string | null
  selectedUnitId: string | null
  onPick: (id: string) => void
  onDoublePick: (id: string) => void
}) {
  const units = Object.values(state.units).filter((u) => u.sideId === side)
  return (
    <div className={`side-dock sg-roster${collapsed ? ' is-folded' : ''}`}>
      <div className="side-dock-head">
        <b>{state.sides[side].name}</b>
        <button className="side-dock-toggle" onClick={onToggle} aria-expanded={!collapsed}>
          {collapsed ? 'Show ▴' : 'Fold ▾'}
        </button>
      </div>
      {collapsed ? null : (
        <ul className="sg-roster-list">
          {units.map((u) => {
            const figures = figuresOf(state, u)
            const fitCount = figures.filter(fit).length
            const woundedCount = figures.filter((f) => f.status === 'wounded').length
            const deadCount = figures.filter((f) => f.status === 'dead').length
            return (
              <li
                key={u.id}
                className={`sg-roster-row${u.id === activeUnitId ? ' is-active' : ''}${u.id === selectedUnitId ? ' is-selected' : ''}${u.activated ? ' is-spent' : ''}`}
                onClick={() => onPick(u.id)}
                onDoubleClick={() => onDoublePick(u.id)}
              >
                <span className="dst-code">{codes[u.id] ?? ''}</span>
                <span className="sg-roster-name">{u.name}</span>
                <span className="campaign-dim">
                  {QUALITY_LABELS[u.quality]} L{u.leadership} · {CONFIDENCE_LABELS[u.confidence]}
                  {u.suppression > 0 ? ` · suppressed x${u.suppression}` : ''}
                  {u.inPosition ? ' · in position' : ''}
                  {u.panic ? ' · panicked' : ''}
                </span>
                <span className="num sg-roster-count">
                  {fitCount} fit{woundedCount ? `, ${woundedCount} wounded` : ''}{deadCount ? `, ${deadCount} dead` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
