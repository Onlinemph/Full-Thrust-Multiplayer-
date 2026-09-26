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
 * `moveBudget`/`targeting`/`plot`/`plotFrom`/`reach`/`recent`/
 * `pendingLandings`/`targets`/`highlight` are wired into `units.ts`/
 * `overlays.ts` for real. `aimPreview`/`landingPreview` are not: both only
 * ever followed the 2D map's own mouse pointer continuously, and
 * `GroundScene` has no callback that hands a shell the raycasted board
 * point on every pointer move (only on release, `onClickBoard`) — adding
 * one is a change to `GroundScene.ts`, GROUND's file, not this one's. Noted
 * in the report rather than worked around here.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TableMapProps } from '../../dirtside/TableMap'
import { unitCodes } from '../../dirtside/unitCodes'
import { GroundScene, type CameraPreset } from '../GroundScene'
import '../ground3d.css'
import './dirtside3d.css'
import { DirtsideOverlaysLayer } from './overlays'
import { DirtsideUnitsLayer } from './units'
import { DIRTSIDE_SCALE, webglAvailable } from '../space'

export interface DirtsideView3DProps extends TableMapProps {
  /** Asked to go back to the flat map (WebGL missing, or the player's choice). */
  onExit?: () => void
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

  const propsRef = useRef(props)
  propsRef.current = props

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
        onClickBoard: (point) => propsRef.current.onClickTable(point),
        onHoverUnit: (id) => {
          setHoverElementId(id)
          propsRef.current.onHoverUnit?.(id ? (propsRef.current.state.elements[id]?.unitId ?? null) : null)
        },
        onHoverText: (text, at) => setHover(text && at ? { text, at } : null),
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

  useEffect(() => {
    const s = scene.current
    if (!s) return
    s.update(state.setup.table, state.setup.table.terrain)
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
      plot: props.plot,
      plotFrom: props.plotFrom,
      reach: props.reach,
      moveBudget: props.moveBudget ?? null,
      targeting: props.targeting ?? null,
      hoverElementId,
      recent: props.recent ?? [],
      pendingLandings: props.pendingLandings ?? [],
      viewer: props.viewer,
    })
  })

  useEffect(() => {
    scene.current?.setFollow(follow ? selectedId : null)
  }, [follow, selectedId])

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
        <p className="ground3d-help">Drag to orbit · right-drag to pan · wheel to zoom · click an element to select · double-click to fly to it</p>
      </div>
      {hover && (
        <div className="ground3d-tip" style={{ left: hover.at.x + 14, top: hover.at.y + 14 }}>
          {hover.text}
        </div>
      )}
    </div>
  )
}
