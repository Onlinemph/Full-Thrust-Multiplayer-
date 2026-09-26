/**
 * The optional 3D view for the Stargrunt table: a drop-in for `TableMap`,
 * taking the very same `TableMapProps` (plus `onExit`). See
 * `../dirtside/DirtsideView3D.tsx`'s own header for the whole idea — this is
 * its Stargrunt twin, reading Stargrunt's own `GameState` and calling back
 * through the very same `onSelectUnit`/`onClickTable` the 2D map already
 * calls.
 *
 * STARGRUNT'S OWN FILE, along with `units.ts` and `overlays.ts` beside it —
 * extend all three freely (BRIEF-GROUND-3D's build order, stage 2).
 * `selectedFigureId`/`onSelectFigure` (deployment's own figure-level pick),
 * `moveGhost`, `assaultPreview` and `targeting` are accepted (`TableMapProps`
 * says so) but not yet drawn or wired into `units.ts`'s per-figure picking.
 */
import { useEffect, useRef, useState } from 'react'
import type { TableMapProps } from '../../stargrunt/TableMap'
import { GroundScene, type CameraPreset } from '../GroundScene'
import '../ground3d.css'
import { STARGRUNT_SCALE, webglAvailable } from '../space'
import { StargruntOverlaysLayer } from './overlays'
import { StargruntUnitsLayer } from './units'

export interface StargruntView3DProps extends TableMapProps {
  /** Asked to go back to the flat map (WebGL missing, or the player's choice). */
  onExit?: () => void
}

const CAMERA_PRESETS: ReadonlyArray<readonly [CameraPreset, string, string]> = [
  ['tilt', 'Tilt', 'The whole table from above and behind (double-click empty ground)'],
  ['top', 'Top', 'Straight down, like the 2D map'],
  ['low', 'Low', 'Down among the figures'],
]

export default function StargruntView3D(props: StargruntView3DProps) {
  const { state, selectedUnitId, onExit } = props
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<GroundScene | null>(null)
  const units = useRef(new StargruntUnitsLayer())
  const overlays = useRef(new StargruntOverlaysLayer())
  const [failed, setFailed] = useState<string | null>(null)
  const [hover, setHover] = useState<{ text: string; at: { x: number; y: number } } | null>(null)
  const [preset, setPreset] = useState<CameraPreset>('tilt')
  const [follow, setFollow] = useState(false)

  const propsRef = useRef(props)
  propsRef.current = props

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
        onSelectUnit: (id) => propsRef.current.onSelectUnit(id),
        onClickBoard: (point) => propsRef.current.onClickTable(point),
        onHoverUnit: (id) => propsRef.current.onHoverUnit?.(id),
        onHoverText: (text, at) => setHover(text && at ? { text, at } : null),
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

  useEffect(() => {
    const s = scene.current
    if (!s) return
    s.update(state.setup.table, state.setup.table.terrain)
    const heightAt = (p: { x: number; y: number }) => s.heightAt(p)
    units.current.update(state.figures, { heightAt, selectedUnitId })
    overlays.current.update(state, { heightAt })
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
        <p className="ground3d-help">Drag to orbit · right-drag to pan · wheel to zoom · click a squad to select · double-click to fly to it</p>
      </div>
      {hover && (
        <div className="ground3d-tip" style={{ left: hover.at.x + 14, top: hover.at.y + 14 }}>
          {hover.text}
        </div>
      )}
    </div>
  )
}
