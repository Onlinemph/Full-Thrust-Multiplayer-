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
 * `.battle3d-hud-extra` holds the phase 11 fire rose's numbers —
 * `FireRoseHud` below. The rose's wedges are drawn in the scene by
 * `overlays.ts`; this DOM copy exists because hovering (or focusing) it is
 * one way `onHoverArc` gets wired — `BattleScene`'s own pointer handling
 * raycasts the ring itself for the same callback (SCENE, stage 3), so either
 * one lights the arc.
 *
 * SCENE (stage 3): phase 1's `OrderCompass` — the same component `MapView`
 * mounts — is planted over the canvas at the selected ship's own projected
 * screen position (`BattleScene.projectToScreen`), tracked every animation
 * frame so it rides along as the camera orbits, follows or flies. It hides
 * itself mid-drag or once the hull is off screen (the `compassAt` effect
 * below) rather than float over nothing. The old blocking "plot it on the
 * flat map" banner is gone; a small link in the HUD (`.battle3d-flatmap`) is
 * kept for anyone who would rather use the 2D panel.
 */
import { useEffect, useRef, useState } from 'react'
import { optional, shipsAwaitingOrders } from '../../engine/actions'
import type { ShipState } from '../../engine/game'
import { canManoeuvre } from '../../engine/specialmoves'
import type { MovementOrder } from '../../engine/types'
import { describeReady, fireArcs } from '../fireArcs'
import type { MapViewProps } from '../MapView'
import { OrderCompass } from '../OrderCompass'
import { useFx } from '../useFx'
import { BattleScene, type CameraPreset, type SceneCallbacks } from './BattleScene'
import { fitCompass } from './compassBounds'
import './hud.css'
import type { ViewProps } from './layer'
import { roseFor } from './overlays'
import './three.css'

/** Roughly `.battle3d-hud`'s own worst-case height (camera-preset row, help text, the flat-map link) — the compass's safe top margin folds this in so it never renders under it (R6, R8's own toolbar-clearance concern for the compass). */
const HUD_CLEARANCE = 96

/**
 * The phase 11 rose, as a row of real buttons rather than a mesh: what bears
 * into each arc (`fireArcs`, the same read the 2D `FireRose` draws from) and
 * how many enemies stand in it. Resting the pointer (or focus, for a keyboard
 * user) on a wedge lights that arc across the view, mirroring the 2D rose's
 * own `litArcUnderPointer` — the question a gunner is asking is "what can I
 * hit them with?", answered without a click.
 */
function FireRoseHud({
  game,
  ship,
  litArcs,
  onHoverArc,
}: {
  game: MapViewProps['game']
  ship: ShipState
  litArcs: MapViewProps['litArcs']
  onHoverArc: MapViewProps['onHoverArc']
}) {
  const summaries = fireArcs(game, ship)
  const lit = litArcs?.length === 1 ? (litArcs[0] ?? null) : null
  return (
    <div className="battle3d-rose" role="group" aria-label={`Fire arcs of ${ship.name}`}>
      {summaries.map((summary) => {
        const armed = summary.ready.length > 0
        const names = describeReady(summary.ready)
        const classes = ['battle3d-rose-arc']
        if (armed) classes.push('is-armed')
        if (summary.targets.length > 0) classes.push('has-target')
        if (summary.arc === lit) classes.push('is-lit')
        const title = `${summary.arc}: ${armed ? `${names}, out to ${summary.reach} MU` : 'nothing bears'}${
          summary.targets.length > 0
            ? ` — ${summary.targets.map((t) => `${t.name} at ${t.range.toFixed(1)} MU`).join(', ')}`
            : ''
        }`
        return (
          <button
            key={summary.arc}
            type="button"
            className={classes.join(' ')}
            title={title}
            onPointerEnter={() => onHoverArc?.(summary.arc)}
            onPointerLeave={() => onHoverArc?.(null)}
            onFocus={() => onHoverArc?.(summary.arc)}
            onBlur={() => onHoverArc?.(null)}
          >
            <span className="battle3d-rose-arc-name">{summary.arc}</span>
            <span className="battle3d-rose-arc-guns">
              {armed ? (names.length > 11 ? `${summary.ready.length} mounts` : names) : '—'}
            </span>
            {summary.targets.length > 0 ? (
              <span className="battle3d-rose-arc-targets">{'◆'.repeat(Math.min(summary.targets.length, 4))}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

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
 * Whether the selected ship gets the 3D compass this turn — 3.5, under
 * cinematic movement only (12.12's vector sheet is written from its own
 * panel, not a click on the table, in 2D or 3D alike, so a vector-order ship
 * gets no compass in either view). Exactly `MapView.tsx`'s own `compassFor`,
 * minus the "is it actually drawn" check, which here is `projectToScreen`
 * returning a point still inside the canvas.
 */
function wantsCompass(
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

/** Field-by-field, since a fresh `ViewProps` object literal is built every render regardless of whether anything it holds actually changed (R3). */
function sameView(a: ViewProps, b: ViewProps): boolean {
  return (
    a.selectedId === b.selectedId &&
    a.viewingSide === b.viewingSide &&
    a.canCommand === b.canCommand &&
    a.litArcs === b.litArcs &&
    a.fireRose === b.fireRose &&
    a.selectedFlightId === b.selectedFlightId &&
    a.deployWith === b.deployWith &&
    a.aimWith === b.aimWith &&
    a.placingTerrain === b.placingTerrain &&
    a.returnWith === b.returnWith &&
    a.fx === b.fx
  )
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
  onHoldCourse,
  onNextShip,
  onExit,
}: BattleView3DProps) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<BattleScene | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [hover, setHover] = useState<{ text: string; at: { x: number; y: number } } | null>(null)
  const [preset, setPreset] = useState<CameraPreset>('tilt')
  const [follow, setFollow] = useState(false)
  const [compassAt, setCompassAt] = useState<{ x: number; y: number; clearance: number } | null>(null)
  /** The ship needs orders and is on screen, but the canvas is too small to hold even a capped compass (R6) — a "zoom out" hint stands in for it rather than nothing at all. */
  const [compassBlocked, setCompassBlocked] = useState(false)
  const fx = useFx()

  const callbacks: SceneCallbacks = {
    onSelect,
    onSelectFlight: (id) => onSelectFlight?.(id),
    // Coarsely rounded, and a no-op (`prev` returned as-is) when nothing
    // meaningful moved: `BattleScene.onPointerMove` fires this on essentially
    // every native pointermove over a tooltip-bearing object, and a fresh
    // object literal every pixel of jitter used to re-render this component —
    // and, before the effect below was also fixed, re-run every layer's full
    // `update()` — on every one of them (R3).
    onHover: (text, at) =>
      setHover((prev) => {
        if (!text || !at) return prev === null ? prev : null
        const x = Math.round(at.x / 4) * 4
        const y = Math.round(at.y / 4) * 4
        if (prev && prev.text === text && prev.at.x === x && prev.at.y === y) return prev
        return { text, at: { x, y } }
      }),
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

  // Every render hands the scene the current battle and props; the layers
  // diff it by id. This effect itself has no dependency list — the compass's
  // own tracking loop and, before R3's fix, every mouse-move-driven hover
  // re-render also land here — so it shallow-compares against what it last
  // actually sent and skips the (expensive: every layer's full diff pass,
  // including the fire rose and reach overlay's own dispose+rebuild) call
  // to `scene.update()` when nothing on the battle or these props changed.
  // Keyed by the `BattleScene` instance itself, not only the battle and view:
  // StrictMode's dev-only double-invoke disposes and recreates that instance
  // once on mount without this component unmounting, and a fresh scene has
  // nothing drawn yet — comparing only `game`/`view` would see the same pair
  // it already "sent" to the old, now-discarded instance and skip the new
  // one's very first `update()`, leaving it permanently empty.
  const lastSent = useRef<{ scene: BattleScene; game: typeof game; view: ViewProps } | null>(null)
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
    const prev = lastSent.current
    lastSent.current = { scene: scene.current, game, view }
    if (prev && prev.scene === scene.current && prev.game === game && sameView(prev.view, view)) return
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

  const selected = selectedId ? game.ships.find((s) => s.id === selectedId) : undefined
  const compassOn = wantsCompass(game, selected, canCommand)
  const compassShipId = compassOn ? (selected?.id ?? null) : null

  // The compass rides the selected ship's own screen position, which changes
  // every frame the camera orbits, follows or flies — not only on a React
  // render — so it is tracked from its own small animation-frame loop rather
  // than the per-render `scene.current.update(...)` effect below.
  useEffect(() => {
    if (!compassShipId) {
      setCompassAt(null)
      setCompassBlocked(false)
      return
    }
    let raf = 0
    const tick = () => {
      const s = scene.current
      const h = host.current
      const raw = s && h && !s.isDragging() ? s.projectToScreen(compassShipId) : null
      const width = h?.clientWidth ?? 0
      const height = h?.clientHeight ?? 0
      // The ship's own anchor point on screen at all — off entirely (behind
      // the camera, panned or scrolled away) still just hides the compass, as
      // before; only once it is on screen does a too-small canvas count as
      // "blocked" rather than "not looking at it right now".
      const anchorOnScreen = raw !== null && raw.x >= 0 && raw.x <= width && raw.y >= 0 && raw.y <= height
      // Clamped fully inside the canvas and below the HUD, with a capped ring
      // size, rather than only checked against the anchor point (R6) — so the
      // compass is always entirely usable whenever it can fit at all.
      const fitted = anchorOnScreen && raw ? fitCompass(raw, width, height, HUD_CLEARANCE) : null
      setCompassAt((prev) =>
        prev && fitted && prev.x === fitted.x && prev.y === fitted.y && prev.clearance === fitted.clearance
          ? prev
          : fitted,
      )
      setCompassBlocked((prev) => (prev === (anchorOnScreen && !fitted) ? prev : anchorOnScreen && !fitted))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [compassShipId])

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
        <div className="battle3d-hud-extra">
          {fireRose && selected && roseFor(game, selected, viewingSide) ? (
            <FireRoseHud game={game} ship={selected} litArcs={litArcs} onHoverArc={onHoverArc} />
          ) : null}
          {/* R6: the ship needing orders is on screen, but this close there is
              nowhere left to draw a fully usable compass — a clear way out
              rather than a control that would only ever show part of itself. */}
          {compassOn && compassBlocked ? (
            <p className="battle3d-compass-hint" role="status">
              Zoom out to plot this ship’s orders
            </p>
          ) : null}
          {compassOn && onExit ? (
            <button type="button" className="battle3d-flatmap" onClick={onExit}>
              Flat map instead ↗
            </button>
          ) : null}
        </div>
      </div>

      {/*
       * Phase 1's compass, planted at the selected ship's own projected
       * screen point (tracked every frame above) — the same `OrderCompass`
       * `MapView.tsx` mounts, so an order written here is an order written,
       * full stop. It only ever shows once that point is actually on screen;
       * off screen, mid-drag, or under vector movement (no compass in either
       * view — the `.battle3d-flatmap` link above is the way to its own
       * panel), nothing is drawn here at all.
       */}
      {compassAt && selected ? (
        <OrderCompass
          key={selected.id}
          ship={selected}
          x={compassAt.x}
          y={compassAt.y}
          clearance={compassAt.clearance}
          onTrack={selected.orbit !== null}
          editable={canCommand?.(selected) ?? true}
          onHold={() => onHoldCourse?.(selected)}
          onNext={() => onNextShip?.(selected.id)}
          moreToWrite={shipsAwaitingOrders(game).some(
            (ship) => ship.id !== selected.id && (canCommand?.(ship) ?? true),
          )}
          onPreview={(order: MovementOrder | null) => scene.current?.setOrderPreview(selected.id, order)}
        />
      ) : null}

      {hover && (
        <div className="battle3d-tip" style={{ left: hover.at.x + 14, top: hover.at.y + 14 }}>
          {hover.text}
        </div>
      )}
    </div>
  )
}
