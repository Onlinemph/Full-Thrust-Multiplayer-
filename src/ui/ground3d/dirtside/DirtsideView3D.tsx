/**
 * The optional 3D view for the Dirtside table: a drop-in for `TableMap`,
 * taking the very same `TableMapProps` (plus `onExit`, offered the same way
 * `src/ui/three/BattleView3D.tsx` offers a way back to Full Thrust's own flat
 * map). Reads the same `GameState` the 2D map reads; does everything a
 * player can do through the very same `onSelectElement`/`onClickTable` the
 * 2D map already calls, so `TableScreen.tsx` cannot tell which view is on
 * screen. GROUND's own `GroundScene` is the only thing that touches
 * three.js here; this file is the glue between it and Dirtside's own props.
 *
 * DIRTSIDE'S OWN FILE, along with `units.ts` and `overlays.ts` beside it —
 * extend all three freely (BRIEF-GROUND-3D's build order, stage 2).
 *
 * `aimPreview`/`landingPreview` (and the move/deploy ghosts' own reach to
 * the pointer) are now wired for real (K1): `GroundScene.onPointerBoard`
 * hands this shell the board point under the pointer once a frame, kept in
 * `pointerAt` and passed straight through to `overlays.ts`, which does the
 * actual drawing with the same engine functions the 2D map's own preview
 * components call.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { distance } from '../../../dirtside/table/terrain'
import type { GameState, Point, SideId } from '../../../dirtside/table/types'
import { Legend } from '../../dirtside/map/Legend'
import { MapDefs } from '../../dirtside/map/defs'
import type { MoveBudget, RecentMark, TableMapProps, TargetingOverlay } from '../../dirtside/TableMap'
import { unitCodes } from '../../dirtside/unitCodes'
import { GroundScene, type CameraPreset } from '../GroundScene'
import '../ground3d.css'
import './dirtside3d.css'
import { DirtsideOverlaysLayer } from './overlays'
import { DirtsideUnitsLayer } from './units'
import { DIRTSIDE_SCALE, webglAvailable } from '../space'

const inches = (n: number) => `${n.toFixed(1)}″`

export interface DirtsideView3DProps extends TableMapProps {
  /** Asked to go back to the flat map (WebGL missing, or the player's choice). */
  onExit?: () => void
}

/**
 * Everything besides `state` itself that a render hands the scene — kept so
 * the per-render effect below can shallow-compare against what it last sent
 * and skip `units`/`overlays`' own (expensive: a full diff over every
 * element and overlay) `update()` when nothing here actually changed (R4).
 */
interface DirtsideView {
  selectedId: string | null
  hoverElementId: string | null
  codes: Record<string, string>
  targets: string[]
  targeting: TargetingOverlay | null
  highlight: string | null
  plot: Point[]
  plotFrom: Point | null
  reach: number | null
  moveBudget: MoveBudget | null
  recent: RecentMark[] | undefined
  pendingLandings: Array<{ at: Point; label: string }> | undefined
  viewer: SideId | null
  pointerAt: Point | null
  aimPreview: { radius: number } | null
  landingPreview: { label: string } | null
  /** R12: the ruler's own planted end and (once set) its finished end — `null`/`null` when Measure is off or nothing is planted yet. */
  measureFrom: Point | null
  measureTo: Point | null
}

function sameView(a: DirtsideView, b: DirtsideView): boolean {
  return (
    a.selectedId === b.selectedId &&
    a.hoverElementId === b.hoverElementId &&
    a.codes === b.codes &&
    a.targets === b.targets &&
    a.targeting === b.targeting &&
    a.highlight === b.highlight &&
    a.plot === b.plot &&
    a.plotFrom === b.plotFrom &&
    a.reach === b.reach &&
    a.moveBudget === b.moveBudget &&
    a.recent === b.recent &&
    a.pendingLandings === b.pendingLandings &&
    a.viewer === b.viewer &&
    a.pointerAt === b.pointerAt &&
    a.aimPreview === b.aimPreview &&
    a.landingPreview === b.landingPreview &&
    a.measureFrom === b.measureFrom &&
    a.measureTo === b.measureTo
  )
}

const CAMERA_PRESETS: ReadonlyArray<readonly [CameraPreset, string, string]> = [
  ['tilt', 'Tilt', 'The whole table from above and behind (double-click empty ground)'],
  ['top', 'Top', 'Straight down, like the 2D map'],
  ['low', 'Low', 'Down among the models'],
]

export default function DirtsideView3D(props: DirtsideView3DProps) {
  const { state, selectedId, onExit } = props
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<GroundScene | null>(null)
  const units = useRef(new DirtsideUnitsLayer())
  const overlays = useRef(new DirtsideOverlaysLayer())
  const [failed, setFailed] = useState<string | null>(null)
  const [hover, setHover] = useState<{ text: string; at: { x: number; y: number } } | null>(null)
  const [preset, setPreset] = useState<CameraPreset>('tilt')
  const [follow, setFollow] = useState(false)
  // The pointer is over this element's own model — `GroundScene`'s only continuous hover signal (`onHoverUnit`),
  // read here in its raw element-id form for the fire-line-on-hover and the target ring (`units.ts`/`overlays.ts`);
  // `onHoverUnit` on `TableMapProps` itself wants the *unit* id, same translation the placeholder already did.
  const [hoverElementId, setHoverElementId] = useState<string | null>(null)
  // K1: the board point under the pointer, read once a frame off `GroundScene.onPointerBoard` — every
  // pointer-following preview in `overlays.ts` (a move ghost, an orbital aim ring, a landing clearance ring, a
  // deploy ghost) draws from this, exactly the 2D map's own local `pointer` state.
  const [pointerAt, setPointerAt] = useState<Point | null>(null)
  // R12: the ruler. The 2D map plants and drags one end continuously (`onPointerDown`/`onPointerMove` on its own
  // SVG); `GroundScene`'s left-drag already orbits the camera, so this plants each end with its own click instead
  // — the first click sets `measureFrom`, the pointer's own live position (`pointerAt`) is the ghost end until a
  // second click freezes `measureTo`, and a further click starts over from that new point (Esc/toggling Measure
  // off clears it, `TableMap.tsx`'s own Esc-to-stop binding).
  const [measuring, setMeasuring] = useState(false)
  const [measureFrom, setMeasureFrom] = useState<Point | null>(null)
  const [measureTo, setMeasureTo] = useState<Point | null>(null)
  const [showLegend, setShowLegend] = useState(false)
  const pid = `g3ddst${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  const propsRef = useRef(props)
  propsRef.current = props
  const measuringRef = useRef(measuring)
  measuringRef.current = measuring
  const measureFromRef = useRef(measureFrom)
  measureFromRef.current = measureFrom
  const measureToRef = useRef(measureTo)
  measureToRef.current = measureTo

  const stopMeasuring = () => {
    setMeasuring(false)
    setMeasureFrom(null)
    setMeasureTo(null)
  }

  const codes = useMemo(() => unitCodes(state), [state.setup, state.units])

  useEffect(() => {
    if (!host.current) return
    if (!webglAvailable()) {
      setFailed('This browser cannot draw WebGL, which the 3D view needs.')
      return
    }
    const s = new GroundScene(
      host.current,
      {
        scale: DIRTSIDE_SCALE,
        getUnitPickables: () => units.current.pickables(),
        getUnitPosition: (id) => units.current.drawnPosition(id),
      },
      {
        onSelectUnit: (id) => propsRef.current.onSelectElement(id),
        onClickBoard: (point) => {
          // R12: while measuring, a board click plants the ruler instead of doing whatever the current mode
          // would (a waypoint, a deploy point, an aim point) — never reaching `onClickTable` at all.
          if (measuringRef.current) {
            if (!measureFromRef.current) setMeasureFrom(point)
            else if (!measureToRef.current) setMeasureTo(point)
            else {
              setMeasureFrom(point)
              setMeasureTo(null)
            }
            return
          }
          propsRef.current.onClickTable(point)
        },
        onHoverUnit: (id) => {
          setHoverElementId(id)
          propsRef.current.onHoverUnit?.(id ? (propsRef.current.state.elements[id]?.unitId ?? null) : null)
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
    // console while developing — `getState()` reads live rather than closing over one render, exactly like
    // `scene` itself. Never in a production build.
    if (import.meta.env.DEV) (window as unknown as { __ground3d?: { scene: GroundScene; getState: () => TableMapProps['state'] } }).__ground3d = { scene: s, getState: () => propsRef.current.state }
    return () => {
      s.dispose()
      scene.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Every render hands the scene the current state and props; `units.ts`/
  // `overlays.ts` diff it by id. This effect itself has no dependency list —
  // the pointer-following previews' own tracking and, before this gate, a
  // hover-only pointer move over any tooltip-bearing terrain feature also
  // land here — so it shallow-compares against what it last actually sent
  // and skips the (expensive: a full diff pass over every element and
  // overlay) calls to `units`/`overlays`' own `update()` when nothing on the
  // battle or these props changed (R4, `BattleView3D.tsx`'s own pattern).
  // Keyed by the `GroundScene` instance itself, not only `state`/the view:
  // StrictMode's dev-only double-invoke disposes and recreates that instance
  // once on mount without this component unmounting, and a fresh scene has
  // nothing drawn yet — comparing only `state`/the view would see the same
  // pair it already "sent" to the old, now-discarded instance and skip the
  // new one's very first `update()`, leaving it permanently empty.
  const lastSent = useRef<{ scene: GroundScene; state: GameState; view: DirtsideView } | null>(null)
  useEffect(() => {
    const s = scene.current
    if (!s) return
    s.update(state.setup.table, state.setup.table.terrain)
    const view: DirtsideView = {
      selectedId,
      hoverElementId,
      codes,
      targets: props.targets,
      targeting: props.targeting ?? null,
      highlight: props.highlight,
      plot: props.plot,
      plotFrom: props.plotFrom,
      reach: props.reach,
      moveBudget: props.moveBudget ?? null,
      recent: props.recent,
      pendingLandings: props.pendingLandings,
      viewer: props.viewer,
      pointerAt,
      aimPreview: props.aimPreview ?? null,
      landingPreview: props.landingPreview ?? null,
      measureFrom,
      measureTo,
    }
    const prev = lastSent.current
    lastSent.current = { scene: s, state, view }
    if (prev && prev.scene === s && prev.state === state && sameView(prev.view, view)) return

    const heightAt = (p: { x: number; y: number }) => s.heightAt(p)
    const targetIds = new Set(props.targets)
    const verdicts = props.targeting ? Object.fromEntries(Object.entries(props.targeting.verdicts).map(([id, v]) => [id, v.ok])) : null
    units.current.update(state.elements, {
      heightAt,
      selectedId,
      activeUnitId: state.activation?.unitId ?? null,
      hoverElementId,
      targetIds,
      highlightId: props.highlight,
      verdicts,
      units: state.units,
      codes,
      activation: state.activation,
    })
    overlays.current.update(state, {
      heightAt,
      selectedId,
      plot: props.plot,
      plotFrom: props.plotFrom,
      reach: props.reach,
      moveBudget: props.moveBudget ?? null,
      targeting: props.targeting ?? null,
      hoverElementId,
      recent: props.recent ?? [],
      pendingLandings: props.pendingLandings ?? [],
      viewer: props.viewer,
      pointer: pointerAt,
      aimPreview: props.aimPreview ?? null,
      landingPreview: props.landingPreview ?? null,
      measure: measureFrom ? { from: measureFrom, to: measureTo } : null,
    })
  })

  useEffect(() => {
    scene.current?.setFollow(follow ? selectedId : null)
  }, [follow, selectedId])

  // R12: Esc stops measuring, matching the 2D map's own Measure tool.
  useEffect(() => {
    if (!measuring) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stopMeasuring()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measuring])

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

  const selectedElement = selectedId ? (state.elements[selectedId] ?? null) : null
  const measureReading = measureFrom ? (measureTo ?? pointerAt) : null

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
          <button type="button" className={follow ? 'is-on' : undefined} disabled={!selectedId} title="Keep the selected element in the middle of the view as it moves" onClick={() => setFollow((f) => !f)}>
            Follow
          </button>
        </div>
        <div className="ground3d-tools" role="group" aria-label="Tools">
          <button
            type="button"
            className={measuring ? 'is-on' : undefined}
            title="Measure a distance: click one end, click the other; Esc to stop"
            onClick={() => {
              if (measuring) stopMeasuring()
              else {
                setShowLegend(false)
                setMeasuring(true)
              }
            }}
          >
            Measure{measureReading ? ` · ${inches(distance(measureFrom!, measureReading))}` : ''}
          </button>
          <button
            type="button"
            className={showLegend ? 'is-on' : undefined}
            title="What the ground looks like"
            onClick={() => {
              setShowLegend((v) => !v)
              stopMeasuring()
            }}
          >
            Legend
          </button>
        </div>
        <p className="ground3d-help">Drag to orbit · right-drag to pan · wheel to zoom · click an element to select · double-click to fly to it</p>
      </div>
      {showLegend && (
        <div className="ground3d-legend" onPointerDown={(e) => e.stopPropagation()}>
          <Legend features={state.setup.table.terrain} pid={pid} selected={selectedElement} showMarkers={false} onToggleMarkers={() => {}} onHoverType={() => {}} />
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
