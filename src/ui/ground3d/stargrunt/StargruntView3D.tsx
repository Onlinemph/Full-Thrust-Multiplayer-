/**
 * The optional 3D view for the Stargrunt table: a drop-in for `TableMap`,
 * taking the very same `TableMapProps` (plus `onExit`). See
 * `../dirtside/DirtsideView3D.tsx`'s own header for the whole idea — this is
 * its Stargrunt twin, reading Stargrunt's own `GameState` and calling back
 * through the very same `onSelectUnit`/`onSelectFigure`/`onClickTable` the
 * 2D map already calls.
 *
 * STARGRUNT'S OWN FILE, along with `units.ts` and `overlays.ts` beside it
 * (BRIEF-GROUND-3D's build order, stage 2/STARGRUNT). `moveGhost`,
 * `assaultPreview` and `targeting` are now drawn (`overlays.ts`); deployment's
 * own figure-level pick (p. 14) is wired below — a click tags a *figure* id
 * during deployment (`units.ts`'s own `pickables()`) and this shell routes it
 * to `onSelectFigure` instead of `onSelectUnit`, exactly the 2D map's own
 * `hitOf`/`deployPhase` branch in `TableMap.tsx`. The move ghost now follows
 * the pointer for real (K1): `GroundScene.onPointerBoard` hands this shell
 * the board point under it once a frame, kept in `pointerAt`.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { TableMapProps } from '../../stargrunt/TableMap'
import type { GameState, Point } from '../../../stargrunt/types'
import { MapDefs } from '../../dirtside/map/defs'
import { Legend } from '../../stargrunt/map/Legend'
import { GroundScene, type CameraPreset } from '../GroundScene'
import '../ground3d.css'
import './stargrunt3d.css'
import { STARGRUNT_SCALE, webglAvailable } from '../space'
import { StargruntOverlaysLayer } from './overlays'
import { StargruntUnitsLayer } from './units'

export interface StargruntView3DProps extends TableMapProps {
  /** Asked to go back to the flat map (WebGL missing, or the player's choice). */
  onExit?: () => void
}

/**
 * Everything besides `state` itself that a render hands the scene — kept so
 * the per-render effect below can shallow-compare against what it last sent
 * and skip `units`/`overlays`' own (expensive: a full diff pass over every
 * figure, pennant and overlay) `update()` when nothing here actually changed
 * (R4, `src/ui/three/BattleView3D.tsx`'s own pattern).
 */
interface StargruntView {
  selectedUnitId: string | null
  selectedFigureId: string | null | undefined
  hoverUnitId: string | null
  targeting: TableMapProps['targeting']
  moveGhost: TableMapProps['moveGhost']
  assaultPreview: TableMapProps['assaultPreview']
  pointerAt: Point | null
}

function sameView(a: StargruntView, b: StargruntView): boolean {
  return (
    a.selectedUnitId === b.selectedUnitId &&
    a.selectedFigureId === b.selectedFigureId &&
    a.hoverUnitId === b.hoverUnitId &&
    a.targeting === b.targeting &&
    a.moveGhost === b.moveGhost &&
    a.assaultPreview === b.assaultPreview &&
    a.pointerAt === b.pointerAt
  )
}

const CAMERA_PRESETS: ReadonlyArray<readonly [CameraPreset, string, string]> = [
  ['tilt', 'Tilt', 'The whole table from above and behind (double-click empty ground)'],
  ['top', 'Top', 'Straight down, like the 2D map'],
  ['low', 'Low', 'Down among the figures'],
]

export default function StargruntView3D(props: StargruntView3DProps) {
  const { state, selectedUnitId, selectedFigureId, onExit } = props
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<GroundScene | null>(null)
  const units = useRef(new StargruntUnitsLayer())
  const overlays = useRef(new StargruntOverlaysLayer())
  const [failed, setFailed] = useState<string | null>(null)
  const [hover, setHover] = useState<{ text: string; at: { x: number; y: number } } | null>(null)
  const [hoverUnitId, setHoverUnitId] = useState<string | null>(null)
  const [preset, setPreset] = useState<CameraPreset>('tilt')
  const [follow, setFollow] = useState(false)
  // K1: the board point under the pointer, read once a frame off `GroundScene.onPointerBoard` — the move
  // ghost's own line and figure bases (`overlays.ts`) follow this, exactly the 2D map's own local `pointer` state.
  const [pointerAt, setPointerAt] = useState<Point | null>(null)
  const [showLegend, setShowLegend] = useState(false)
  const [showSymbols, setShowSymbols] = useState(false)
  const pid = `g3dsg${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  const propsRef = useRef(props)
  propsRef.current = props

  // Deployment (p. 14) tags a pick with the *figure*'s own id (`units.ts`'s own contract); every other phase
  // tags it with the unit's, exactly `TableMap.tsx`'s own `hitOf`/`deployPhase` branch — shared by every way of
  // picking a unit in 3D, `GroundScene`'s own model pickables and a pennant's own click alike (R11).
  const selectUnitRef = useRef((id: string) => {
    const deploying = propsRef.current.state.phase === 'deployment' && !!propsRef.current.onSelectFigure
    if (deploying) propsRef.current.onSelectFigure!(id)
    else propsRef.current.onSelectUnit(id)
  })

  useEffect(() => {
    if (!host.current) return
    if (!webglAvailable()) {
      setFailed('This browser cannot draw WebGL, which the 3D view needs.')
      return
    }
    const s = new GroundScene(
      host.current,
      {
        scale: STARGRUNT_SCALE,
        getUnitPickables: () => units.current.pickables(),
        getUnitPosition: (id) => units.current.drawnPosition(id),
      },
      {
        onSelectUnit: (id) => selectUnitRef.current(id),
        onClickBoard: (point) => propsRef.current.onClickTable(point),
        onHoverUnit: (id) => {
          setHoverUnitId(id)
          propsRef.current.onHoverUnit?.(id)
        },
        // Coarsely deduped: `GroundScene.onPointerMove` fires this on
        // essentially every native pointermove over a tooltip-bearing
        // terrain feature, and a fresh object literal every pixel of jitter
        // used to re-render this component — and, before R4's own gate
        // below, re-run every layer's full `update()` — on every one of
        // them (matches `src/ui/three/BattleView3D.tsx`'s own `onHover`).
        onHoverText: (text, at) =>
          setHover((prev) => {
            if (!text || !at) return prev === null ? prev : null
            const x = Math.round(at.x / 4) * 4
            const y = Math.round(at.y / 4) * 4
            if (prev && prev.text === text && prev.at.x === x && prev.at.y === y) return prev
            return { text, at: { x, y } }
          }),
        onPointerBoard: (point) => setPointerAt(point),
      },
    )
    s.addLayer(units.current)
    s.addLayer(overlays.current)
    scene.current = s
    // A handle for the screenshot harness (`tools/visual_ground3d.mjs`) and for poking at the scene from the
    // console while developing — `getState()` reads live rather than closing over one render. Never in a
    // production build.
    if (import.meta.env.DEV) (window as unknown as { __ground3d?: { scene: GroundScene; getState: () => TableMapProps['state'] } }).__ground3d = { scene: s, getState: () => propsRef.current.state }
    return () => {
      s.dispose()
      scene.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Every render hands the scene the current state and props; `units.ts`/
  // `overlays.ts` diff it by id. This effect itself has no dependency list —
  // the move ghost's own pointer tracking and, before this gate, a
  // hover-only pointer move over any tooltip-bearing terrain feature also
  // land here — so it shallow-compares against what it last actually sent
  // and skips the (expensive: a full diff pass over every figure, pennant
  // and overlay) calls to `units`/`overlays`' own `update()` when nothing on
  // the battle or these props changed (R4, `BattleView3D.tsx`'s own
  // pattern). Keyed by the `GroundScene` instance itself, not only
  // `state`/the view: StrictMode's dev-only double-invoke disposes and
  // recreates that instance once on mount without this component
  // unmounting, and a fresh scene has nothing drawn yet.
  const lastSent = useRef<{ scene: GroundScene; state: GameState; view: StargruntView } | null>(null)
  useEffect(() => {
    const s = scene.current
    if (!s) return
    s.update(state.setup.table, state.setup.table.terrain)
    const view: StargruntView = {
      selectedUnitId,
      selectedFigureId,
      hoverUnitId,
      targeting: props.targeting,
      moveGhost: props.moveGhost,
      assaultPreview: props.assaultPreview,
      pointerAt,
    }
    const prev = lastSent.current
    lastSent.current = { scene: s, state, view }
    if (prev && prev.scene === s && prev.state === state && sameView(prev.view, view)) return

    const heightAt = (p: { x: number; y: number }) => s.heightAt(p)
    const targetUnitIds = props.targeting ? new Set(Object.keys(props.targeting.verdicts)) : undefined
    units.current.update(state, { heightAt, selectedUnitId, selectedFigureId, hoverUnitId, targetUnitIds, onSelectUnit: selectUnitRef.current })
    overlays.current.update(state, { heightAt, selectedUnitId, moveGhost: props.moveGhost, assaultPreview: props.assaultPreview, targeting: props.targeting, pointer: pointerAt, hoverUnitId })
  })

  useEffect(() => {
    scene.current?.setFollow(follow ? selectedUnitId : null)
  }, [follow, selectedUnitId])

  const choose = (p: CameraPreset) => {
    setPreset(p)
    setFollow(false)
    scene.current?.setPreset(p)
  }

  if (failed) {
    return (
      <div className="ground3d ground3d-failed" role="alert">
        <p>{failed}</p>
        {onExit && (
          <button type="button" className="primary" onClick={onExit}>
            Back to the 2D map
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="ground3d" ref={host} role="img" aria-label="The table, 3D view">
      {/* R12: off-screen — only here so `Legend`'s swatches (`url(#...)`, resolved document-wide) have a
          pattern to point to; the 2D map's own `<svg>` with the same defs is not in this DOM tree at all. */}
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden="true">
        <MapDefs pid={pid} />
      </svg>
      <div className="ground3d-hud" onPointerDown={(e) => e.stopPropagation()}>
        <div className="ground3d-cams" role="group" aria-label="Camera">
          {CAMERA_PRESETS.map(([p, label, title]) => (
            <button key={p} type="button" className={preset === p && !follow ? 'is-on' : undefined} title={title} onClick={() => choose(p)}>
              {label}
            </button>
          ))}
          <button type="button" className={follow ? 'is-on' : undefined} disabled={!selectedUnitId} title="Keep the selected squad in the middle of the view as it moves" onClick={() => setFollow((f) => !f)}>
            Follow
          </button>
        </div>
        <div className="ground3d-tools" role="group" aria-label="Tools">
          <button type="button" className={showLegend ? 'is-on' : undefined} title="What the ground looks like" onClick={() => setShowLegend((v) => !v)}>
            Legend
          </button>
        </div>
        <p className="ground3d-help">Drag to orbit · right-drag to pan · wheel to zoom · click a squad to select · double-click to fly to it</p>
      </div>
      {showLegend && (
        <div className="ground3d-legend" onPointerDown={(e) => e.stopPropagation()}>
          <Legend features={state.setup.table.terrain} pid={pid} showSymbols={showSymbols} onToggleSymbols={() => setShowSymbols((v) => !v)} onHoverType={() => {}} />
        </div>
      )}
      {hover && (
        <div className="ground3d-tip" style={{ left: hover.at.x + 14, top: hover.at.y + 14 }}>
          {hover.text}
        </div>
      )}
    </div>
  )
}
