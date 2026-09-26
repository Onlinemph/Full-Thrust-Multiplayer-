/**
 * The optional 3D battle view: a drop-in for `MapView`, taking the same
 * `MapViewProps` (plus `onExit`).
 *
 * It is loaded lazily (see the map switch in `App.tsx`), so a player who
 * never opens it never downloads three.js. Everything it shows is a reading
 * of the same `GameState` MapView reads; everything it can do — select a
 * hull, plot a fighter's move, aim a launcher — goes back through the same
 * callbacks and the same `dispatch`/`refuseAtTable` `BattleScene` calls
 * directly. The rules do not know or care which view is on screen.
 *
 * HUD SLOT (stage 2): `.battle3d-hud-extra` is empty here, reserved for
 * OVERLAYS's own controls — the phase 11 fire rose's numbers, a legend for
 * the reach shape currently drawn, whatever else needs a real DOM control
 * rather than a mesh. Add markup there; the camera chips and the exit/
 * hand-off banner above it are BASE's and should stay put.
 */
import { useEffect, useRef, useState } from 'react'
import { optional } from '../../engine/actions'
import type { ShipState } from '../../engine/game'
import { canManoeuvre } from '../../engine/specialmoves'
import type { MapViewProps } from '../MapView'
import { useFx } from '../useFx'
import { BattleScene, type CameraPreset, type SceneCallbacks } from './BattleScene'
import type { ViewProps } from './layer'
import './three.css'

export interface BattleView3DProps extends MapViewProps {
  /** Asked to go back to the flat map (WebGL missing, or the player's choice). */
  onExit?: () => void
}

/** Whether this browser can draw WebGL at all. */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * Whether the selected ship still wants a course written this turn — 3.5,
 * under cinematic movement only (12.12's vector sheet is written from its
 * own panel, not a click on the table, in 2D or 3D alike). Mirrors
 * `MapView.tsx`'s own `compassFor`, minus the "is it actually drawn" check
 * that only the 2D plot's layout can answer.
 */
function needsOrderHandoff(
  game: MapViewProps['game'],
  ship: ShipState | undefined,
  canCommand: MapViewProps['canCommand'],
): boolean {
  if (!ship || game.phase !== 'orders') return false
  if (optional(game).movementSystem === 'vector') return false
  if (ship.destroyed || ship.offTable || ship.captured) return false
  if (game.deployment && !game.deployment.placed.includes(ship.id)) return false
  if (!canManoeuvre(ship.dock)) return false
  return canCommand?.(ship) ?? true
}

export default function BattleView3D({
  game,
  selectedId,
  onSelect,
  viewingSide,
  canCommand,
  litArcs,
  fireRose = false,
  onHoverArc,
  placingTerrain = null,
  onTerrainPlaced,
  selectedFlightId = null,
  onSelectFlight,
  deployWith = null,
  aimWith = null,
  onAimed,
  returnWith = null,
  onReturned,
  onExit,
}: BattleView3DProps) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<BattleScene | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [hover, setHover] = useState<{ text: string; at: { x: number; y: number } } | null>(null)
  const [preset, setPreset] = useState<CameraPreset>('tilt')
  const [follow, setFollow] = useState(false)
  const fx = useFx()

  const callbacks: SceneCallbacks = {
    onSelect,
    onSelectFlight: (id) => onSelectFlight?.(id),
    onHover: (text, at) => setHover(text && at ? { text, at } : null),
    onHoverArc,
    onAimed,
    onTerrainPlaced,
    onReturned,
  }
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  useEffect(() => {
    if (!host.current) return
    if (!webglAvailable()) {
      setFailed('This browser cannot draw WebGL, which the 3D view needs.')
      return
    }
    try {
      scene.current = new BattleScene(host.current, {
        onSelect: (id) => callbacksRef.current.onSelect(id),
        onSelectFlight: (id) => callbacksRef.current.onSelectFlight(id),
        onHover: (text, at) => callbacksRef.current.onHover(text, at),
        onHoverArc: (arc) => callbacksRef.current.onHoverArc?.(arc),
        onAimed: () => callbacksRef.current.onAimed?.(),
        onTerrainPlaced: () => callbacksRef.current.onTerrainPlaced?.(),
        onReturned: () => callbacksRef.current.onReturned?.(),
      })
      // A handle for the screenshot harness and for poking at the scene from
      // the console while developing. Never in a production build.
      if (import.meta.env.DEV) (window as unknown as { __battle3d?: BattleScene }).__battle3d = scene.current
    } catch (e) {
      setFailed(`The 3D view could not start: ${(e as Error).message}`)
    }
    return () => {
      scene.current?.dispose()
      scene.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Every render hands the scene the current battle and props; the layers diff it.
  useEffect(() => {
    if (!scene.current) return
    const view: ViewProps = {
      selectedId,
      viewingSide,
      canCommand: canCommand ?? null,
      litArcs: litArcs ?? null,
      fireRose,
      selectedFlightId,
      deployWith,
      aimWith,
      placingTerrain,
      returnWith,
      fx,
    }
    scene.current.update(game, view, callbacksRef.current)
  })

  useEffect(() => {
    scene.current?.setFollow(follow)
  }, [follow])

  const choose = (p: CameraPreset) => {
    setPreset(p)
    setFollow(false)
    scene.current?.setPreset(p)
  }

  if (failed) {
    return (
      <div className="battle3d battle3d-failed" role="alert">
        <p>{failed}</p>
        {onExit && (
          <button type="button" className="primary" onClick={onExit}>
            Back to the 2D map
          </button>
        )}
      </div>
    )
  }

  const selected = selectedId ? game.ships.find((s) => s.id === selectedId) : undefined
  const handoff = needsOrderHandoff(game, selected, canCommand)

  return (
    <div className="battle3d" ref={host} role="img" aria-label="Play surface, 3D view">
      <div className="battle3d-hud" onPointerDown={(e) => e.stopPropagation()}>
        <div className="battle3d-cams" role="group" aria-label="Camera">
          {(
            [
              ['tilt', 'Tilt', 'The whole board from above and behind (double-click empty space)'],
              ['top', 'Top', 'Straight down, like the 2D map'],
              ['low', 'Low', 'Down among the hulls'],
            ] as const
          ).map(([p, label, title]) => (
            <button
              key={p}
              type="button"
              className={`chip${preset === p && !follow ? ' is-on' : ''}`}
              title={title}
              onClick={() => choose(p)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className={`chip${follow ? ' is-on' : ''}`}
            disabled={!selectedId}
            title="Keep the selected ship in the middle of the view as it moves"
            onClick={() => setFollow((f) => !f)}
          >
            Follow
          </button>
        </div>
        <p className="battle3d-help">
          Drag to orbit · right-drag to pan · wheel to zoom · click a hull to select · double-click to fly to it
        </p>
        {/* HUD SLOT (stage 2, OVERLAYS): render fire-rose/reach controls here. */}
        <div className="battle3d-hud-extra" />
      </div>

      {/*
       * 3.5's compass is a 2D-only control (it edits the plotted course by
       * dragging round a ring on the flat map); rather than leave a selected
       * ship silently un-orderable in 3D, this is the hand-off the brief
       * asks for: never a dead end.
       */}
      {handoff && onExit ? (
        <div className="battle3d-handoff">
          <p>{selected?.name} still needs this turn's course.</p>
          <button type="button" className="primary" onClick={onExit}>
            Plot it on the flat map
          </button>
        </div>
      ) : null}

      {hover && (
        <div className="battle3d-tip" style={{ left: hover.at.x + 14, top: hover.at.y + 14 }}>
          {hover.text}
        </div>
      )}
    </div>
  )
}
