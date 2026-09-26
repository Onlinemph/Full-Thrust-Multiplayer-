/**
 * The 3D battle view's engine room: renderer, camera, controls, bloom, the
 * layers, and the pointer.
 *
 * `BattleScene` is plain TypeScript around three.js — no React inside — so
 * the React wrapper (`BattleView3D.tsx`) only creates one, feeds it the game
 * and props on every render, and disposes of it. The scene redraws every
 * animation frame (hulls bob, plasma pulses) and diffs the battle only when
 * it changes.
 *
 * Every click on the board is routed here exactly as `MapView.tsx` routes it
 * on bare table: the reach of whatever is in hand is checked with the same
 * `outsideReach` the 2D map calls, and the same `dispatch`/`refuseAtTable`
 * are called on the same actions — so the rules cannot tell which view sent
 * the order.
 */
import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  MOUSE,
  PMREMGenerator,
  Plane,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { engagedTargets } from '../../engine/game'
import type { FighterGroupState, GameState, GunboatSquadronState } from '../../engine/game'
import type { Arc, MovementOrder, Point } from '../../engine/types'
import { counterRadius } from '../Counter'
import { outsideReach, reachOfAim, reachOfGroup, reachOfReturn, type Reach } from '../reach'
import { dispatch, refuseAtTable } from '../store'
import { BackdropLayer } from './backdrop'
import { EffectsLayer } from './effects'
import { FlightsLayer } from './flights'
import { pickableOf, tooltipOf, type Layer, type Pickable, type ViewProps } from './layer'
import { OrdnanceLayer } from './ordnance'
import { OverlaysLayer } from './overlays'
import { ShipsLayer } from './ships'
import { framingDistance, HULL_ALTITUDE } from './space'
import { TerrainLayer } from './terrain'

export type CameraPreset = 'tilt' | 'top' | 'low'

export interface SceneCallbacks {
  /** `MapViewProps.onSelect` — a ship clicked twice deselects it (`null`). */
  onSelect: (id: string | null) => void
  /** `MapViewProps.onSelectFlight`. */
  onSelectFlight: (id: string | null) => void
  /** Hover text changed (null = nothing under the pointer). */
  onHover: (text: string | null, at: { x: number; y: number } | null) => void
  /**
   * HUD SLOT (stage 2, OVERLAYS): phase 11's rose lights the arc the pointer
   * rests on (`MapView`'s own `litArcUnderPointer`). Wire it once the rose
   * ring exists in `overlays.ts` to hit-test against — there is nothing to
   * hover yet, so this scene never calls it.
   */
  onHoverArc?: (arc: Arc | null) => void
  onAimed?: () => void
  onTerrainPlaced?: () => void
  onReturned?: () => void
}

const FOV = 42

export class BattleScene {
  readonly renderer: WebGLRenderer
  private labels = new CSS2DRenderer()
  private scene = new Scene()
  private camera = new PerspectiveCamera(FOV, 1, 0.1, 2000)
  private controls: OrbitControls
  private composer: EffectComposer
  private bloom: UnrealBloomPass
  private last = performance.now()
  private frame = 0
  private layers: Layer[]
  private ships = new ShipsLayer()
  private flights = new FlightsLayer()
  private overlays = new OverlaysLayer()
  private terrain = new TerrainLayer()
  private ordnance = new OrdnanceLayer()
  private raycaster = new Raycaster()
  private board = new Plane(new Vector3(0, 1, 0), 0)
  private game: GameState | null = null
  private view: ViewProps | null = null
  private callbacks: SceneCallbacks
  private boardSize = { width: 0, height: 0 }
  private follow = false
  private down: { x: number; y: number } | null = null
  /** OrbitControls' own 'start'/'end' — for hiding the 3D order compass mid-drag. */
  private dragging = false
  private resizeObserver: ResizeObserver
  private reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private host: HTMLElement, callbacks: SceneCallbacks) {
    this.callbacks = callbacks
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.85
    this.renderer.domElement.className = 'battle3d-canvas'
    host.appendChild(this.renderer.domElement)

    this.labels.domElement.className = 'battle3d-labels'
    host.appendChild(this.labels.domElement)

    // A soft studio environment for reflections only — what makes the hulls
    // read as metal rather than matte card — kept dim so space stays dark
    // and the sun does the modelling.
    const pmrem = new PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.1
    pmrem.dispose()
    this.scene.add(new HemisphereLight(0x8fa8ff, 0x0a0612, 0.55))
    this.scene.add(new AmbientLight(0x404a66, 0.35))
    const sun = new DirectionalLight(0xfff1dc, 1.15)
    sun.position.set(-40, 60, -30)
    this.scene.add(sun)
    const rim = new DirectionalLight(0x6f8cff, 0.6)
    rim.position.set(30, 20, 40)
    this.scene.add(rim)

    this.layers = [new BackdropLayer(), this.terrain, this.overlays, this.ships, this.flights, this.ordnance, new EffectsLayer()]
    for (const layer of this.layers) this.scene.add(layer.group)
    this.overlays.setShipPositions((id) => this.ships.drawnPosition(id))

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.09
    this.controls.screenSpacePanning = false
    this.controls.maxPolarAngle = 84 * (Math.PI / 180)
    this.controls.minDistance = 3
    this.controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }
    // SCENE (stage 3): the 3D order compass hides itself mid-drag (its own
    // projected position would otherwise swim under the pointer while the
    // camera is the thing actually moving) — OrbitControls' own start/end
    // events, not a guess from pointer state.
    this.controls.addEventListener('start', () => (this.dragging = true))
    this.controls.addEventListener('end', () => (this.dragging = false))

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), 0.4, 0.4, 0.88)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    const el = this.renderer.domElement
    el.addEventListener('pointerdown', this.onPointerDown)
    el.addEventListener('pointermove', this.onPointerMove)
    el.addEventListener('pointerup', this.onPointerUp)
    el.addEventListener('pointerleave', this.onPointerLeave)
    el.addEventListener('dblclick', this.onDoubleClick)
    el.addEventListener('contextmenu', (e) => e.preventDefault())

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)
    this.resize()
    this.loop()
  }

  /** Feed the scene the battle, the view's props and the latest callbacks; layers diff from here. */
  update(game: GameState, view: ViewProps, callbacks: SceneCallbacks): void {
    const first = this.game === null
    const resized = game.table.width !== this.boardSize.width || game.table.height !== this.boardSize.height
    this.game = game
    this.view = view
    this.callbacks = callbacks
    this.boardSize = { width: game.table.width, height: game.table.height }
    const ctx = { game, view, now: performance.now() }
    for (const layer of this.layers) layer.update(ctx)
    this.overlays.setReach(this.computeReach())
    if (first || resized) this.setPreset('tilt', true)
  }

  /** Whether the camera is mid-drag (OrbitControls' own 'start'/'end') — the 3D order compass hides while this is true. */
  isDragging(): boolean {
    return this.dragging
  }

  /**
   * Where `ships.ts` drew a hull on screen, in pixels relative to this
   * scene's own host element (the same origin `onHover`'s tooltip position
   * uses), and its on-screen clearance radius — what `BattleView3D.tsx`
   * plants its 3D `OrderCompass` overlay on. Null once the hull is not drawn
   * or sits behind the camera; a result outside the host's own width/height
   * is still returned — the off-screen check is the caller's, exactly as
   * `MapView.tsx`'s own `compassPoint` bounds-checks `drawnAt`.
   */
  projectToScreen(id: string): { x: number; y: number; clearance: number } | null {
    if (!this.game) return null
    const at = this.ships.drawnPosition(id)
    const ship = this.game.ships.find((s) => s.id === id)
    if (!at || !ship) return null
    const center = new Vector3(at.x, HULL_ALTITUDE, at.z)
    const toCamera = this.camera.position.clone().sub(center)
    const forward = new Vector3()
    this.camera.getWorldDirection(forward)
    if (toCamera.dot(forward) > 0) return null // behind the camera
    const rect = this.host.getBoundingClientRect()
    const p = this.toPixel(center, rect)
    const right = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
    const edge = center.clone().addScaledVector(right, Math.max(0.5, counterRadius(ship.design.mass)))
    const p2 = this.toPixel(edge, rect)
    return { x: p.x, y: p.y, clearance: Math.hypot(p2.x - p.x, p2.y - p.y) }
  }

  private toPixel(point: Vector3, rect: { width: number; height: number }): { x: number; y: number } {
    const v = point.clone().project(this.camera)
    return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height }
  }

  /**
   * The 3D compass's hovered candidate order, forwarded to the overlays
   * layer's own ghost track — see `OverlaysLayer.setPreviewOrder`. Applied
   * immediately rather than waiting for the next `update()` (a React render),
   * so the ghost tracks the pointer in real time.
   */
  setOrderPreview(shipId: string | null, order: MovementOrder | null): void {
    if (!this.game || !this.view) return
    this.overlays.setPreviewOrder(shipId, order, this.game, this.view)
  }

  /** Point the camera at the board from one of the stock angles. */
  setPreset(preset: CameraPreset, instant = false): void {
    const aspect = this.camera.aspect || 1.5
    const { width, height } = this.boardSize
    let frame = { x: width / 2, z: height / 2, w: width, h: height }
    const extent = preset === 'top' ? null : this.ships.extent()
    if (extent) {
      const pad = 7
      const w = Math.min(width, Math.max(18, extent.maxX - extent.minX + pad * 2))
      const h = Math.min(height, Math.max(12, extent.maxZ - extent.minZ + pad * 2))
      frame = { x: (extent.minX + extent.maxX) / 2, z: (extent.minZ + extent.maxZ) / 2, w, h }
    }
    const center = new Vector3(frame.x, 0, frame.z)
    const elevation = preset === 'top' ? 89.5 : preset === 'low' ? 16 : 48
    const distance =
      framingDistance(frame.w, frame.h, FOV, aspect) * (preset === 'top' ? 1 : preset === 'low' ? 0.75 : 1)
    const e = elevation * (Math.PI / 180)
    const position = new Vector3(center.x, Math.sin(e) * distance, center.z + Math.cos(e) * distance)
    this.follow = false
    this.controls.maxDistance = Math.max(distance, framingDistance(width, height, FOV, aspect)) * 2
    if (instant || this.reducedMotion) {
      this.camera.position.copy(position)
      this.controls.target.copy(center)
      this.controls.update()
      return
    }
    this.flyTo(position, center)
  }

  /** Keep the selected ship in the middle of the view as it moves. */
  setFollow(on: boolean): void {
    this.follow = on
  }

  private flight: { from: Vector3; to: Vector3; fromT: Vector3; toT: Vector3; start: number } | null = null
  private flyTo(position: Vector3, target: Vector3): void {
    this.flight = {
      from: this.camera.position.clone(),
      to: position,
      fromT: this.controls.target.clone(),
      toT: target,
      start: performance.now(),
    }
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.labels.setSize(w, h)
    this.composer.setSize(w, h)
    this.bloom.resolution.set(w / 2, h / 2)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.1)
    this.last = now

    if (this.flight) {
      const t = Math.min(1, (now - this.flight.start) / 900)
      const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
      this.camera.position.lerpVectors(this.flight.from, this.flight.to, k)
      this.controls.target.lerpVectors(this.flight.fromT, this.flight.toT, k)
      if (t >= 1) this.flight = null
    } else if (this.follow && this.view?.selectedId) {
      const at = this.ships.drawnPosition(this.view.selectedId)
      if (at) {
        const goal = new Vector3(at.x, 0, at.z)
        const shift = goal.sub(this.controls.target).multiplyScalar(1 - Math.exp(-dt * 4))
        this.controls.target.add(shift)
        this.camera.position.add(shift)
      }
    }
    this.controls.update()

    const frame = { now, dt, camera: this.camera, reducedMotion: this.reducedMotion }
    for (const layer of this.layers) layer.tick?.(frame)
    this.composer.render()
    this.labels.render(this.scene, this.camera)
  }

  // ── Pointer ────────────────────────────────────────────────────────────

  private ndc(e: PointerEvent | MouseEvent): Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect()
    return new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
  }

  /** The board point under the pointer, in MU. */
  private boardPoint(e: PointerEvent | MouseEvent): Point | null {
    this.raycaster.setFromCamera(this.ndc(e), this.camera)
    const hit = this.raycaster.ray.intersectPlane(this.board, new Vector3())
    return hit ? { x: hit.x, y: hit.z } : null
  }

  private pick(e: PointerEvent | MouseEvent) {
    this.raycaster.setFromCamera(this.ndc(e), this.camera)
    const hits = this.raycaster.intersectObjects([...this.ships.pickables(), ...this.flights.pickables()], true)
    return hits.length > 0 ? hits[0].object : null
  }

  /** The nearest terrain feature or ordnance marker under the pointer that carries hover text. */
  private hoverTarget(e: PointerEvent) {
    this.raycaster.setFromCamera(this.ndc(e), this.camera)
    const hits = this.raycaster.intersectObjects([this.ordnance.group, this.terrain.group], true)
    return hits.find((h) => tooltipOf(h.object) !== null)?.object ?? null
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.down = { x: e.clientX, y: e.clientY }
    // A camera move is not a follow: grabbing the view hands it back.
    this.follow = this.follow && e.button !== 2
    this.flight = null
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (e.buttons !== 0) return
    const hit = this.pick(e)
    const pick = pickableOf(hit)
    // Hover text reaches past the hulls to the terrain and ordnance, the way
    // every 2D counter carries a title; only ships and flights are clickable.
    const hover = hit ?? this.hoverTarget(e)
    this.ships.setHovered(pick?.kind === 'ship' ? pick.id : null)
    this.renderer.domElement.style.cursor = pick ? 'pointer' : 'grab'
    const rect = this.host.getBoundingClientRect()
    const text = tooltipOf(hover)
    this.callbacks.onHover(text, text ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : null)
    // Phase 11's rose: a wedge under the pointer lights that arc across the
    // view, the same as hovering the HUD legend's own DOM copy does — the
    // rose ring turns with the ship, so this is a fresh raycast every move
    // rather than a screen-space hit test.
    if (this.view?.fireRose) this.callbacks.onHoverArc?.(this.overlays.arcUnderPointer(this.raycaster))
  }

  private onPointerUp = (e: PointerEvent): void => {
    const moved = this.down ? Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 4 : true
    this.down = null
    if (moved || e.button !== 0 || !this.game || !this.view) return
    const pick = pickableOf(this.pick(e))
    if (pick) {
      this.handleEntityClick(pick)
      return
    }
    this.handleBareTableClick(e)
  }

  private onPointerLeave = (): void => {
    this.ships.setHovered(null)
    this.callbacks.onHover(null, null)
    if (this.view?.fireRose) this.callbacks.onHoverArc?.(null)
  }

  private onDoubleClick = (e: MouseEvent): void => {
    const pick = pickableOf(this.pick(e))
    if (!pick || pick.kind !== 'ship' || !this.focusShip(pick.id)) this.setPreset('tilt')
  }

  // ── Click routing — mirrors MapView.tsx's onPointerUp exactly ──────────

  private selectedFlight(): FighterGroupState | undefined {
    const { game, view } = this
    return game && view?.selectedFlightId ? game.fighterGroups.find((g) => g.id === view.selectedFlightId) : undefined
  }

  private selectedSquadron(): GunboatSquadronState | undefined {
    const { game, view } = this
    return game && view?.selectedFlightId ? game.gunboatSquadrons.find((g) => g.id === view.selectedFlightId) : undefined
  }

  private computeReach(): Reach | null {
    const { game, view } = this
    if (!game || !view) return null
    if (view.aimWith) return reachOfAim(game, view.aimWith)
    const returningShip = view.returnWith ? game.ships.find((s) => s.id === view.returnWith) : undefined
    if (returningShip) return reachOfReturn(game, returningShip)
    const squadron = this.selectedSquadron()
    if (squadron) return reachOfGroup(game, squadron, true)
    const flight = this.selectedFlight()
    if (flight) return reachOfGroup(game, flight, false)
    return null
  }

  /** A ship or a flight/squadron marker clicked — the counterpart of the 2D counter's own `onClick`. */
  private handleEntityClick(pick: Pickable): void {
    const { game, view, callbacks } = this
    if (!game || !view) return
    if (pick.kind === 'ship') {
      if (this.declareAgainstShip(pick.id)) return
      if (this.engageFromSelected(pick.id)) return
      callbacks.onSelect(pick.id === view.selectedId ? null : pick.id)
      return
    }
    // A fighter group already in hand, clicking another group, in the
    // dogfight phase: declares the dogfight (8.7) rather than reselecting.
    const attacker = this.selectedFlight()
    if (pick.kind === 'flight' && attacker && game.phase === 'fighter-vs-fighter') {
      const target = game.fighterGroups.find((g) => g.id === pick.id)
      if (target && target.side !== attacker.side) {
        dispatch({ type: 'flight-dogfight', flightId: attacker.id, targetFlightId: pick.id })
        return
      }
    }
    callbacks.onSelectFlight(pick.id === view.selectedFlightId ? null : pick.id)
  }

  /** 8.7: a flight/squadron in hand, clicking an enemy hull, declares the attack the phase allows. */
  private declareAgainstShip(shipId: string): boolean {
    const { game } = this
    if (!game) return false
    const attacker = this.selectedFlight() ?? this.selectedSquadron()
    if (!attacker) return false
    const target = game.ships.find((s) => s.id === shipId)
    if (!target || target.side === attacker.side) return false
    if (game.phase !== 'ordnance-vs-ships' && game.phase !== 'ship-fire') return false
    dispatch(
      this.selectedSquadron()
        ? { type: 'gunboat-attack', squadronId: attacker.id, targetId: shipId }
        : { type: 'flight-strike', flightId: attacker.id, targetId: shipId },
    )
    return true
  }

  /** Phase 11, with one of ours selected: clicking an enemy puts a FireCon on it (4.4). */
  private engageFromSelected(targetId: string): boolean {
    const { game, view } = this
    if (!game || !view || game.phase !== 'ship-fire' || !view.selectedId) return false
    const selected = game.ships.find((s) => s.id === view.selectedId)
    const target = game.ships.find((s) => s.id === targetId)
    if (!selected || !target) return false
    if (!(view.canCommand?.(selected) ?? true)) return false
    if (target.side === selected.side || target.destroyed || target.offTable) return false
    if (engagedTargets(selected, game.phase).includes(target.id)) return true
    dispatch({ type: 'assign-firecon', shipId: selected.id, targetId: target.id })
    return true
  }

  /** Everything a click on empty table can mean, in the same priority MapView uses. */
  private handleBareTableClick(e: PointerEvent): void {
    const { game, view, callbacks } = this
    if (!game || !view) return
    const flight = this.selectedFlight()
    const squadron = this.selectedSquadron()
    const placing = view.deployWith !== null && view.selectedId !== null
    if (!(flight || squadron) && !placing && view.aimWith === null && view.returnWith === null) return
    const to = this.boardPoint(e)
    if (!to) return
    const reach = this.computeReach()
    if (reach !== null) {
      const why = outsideReach(game, reach, to)
      if (why !== null) {
        refuseAtTable(why)
        return
      }
    }
    if (view.returnWith) {
      dispatch({ type: 'return-to-table', shipId: view.returnWith, position: to })
      callbacks.onReturned?.()
      return
    }
    if (view.aimWith) {
      const aim = view.aimWith
      if (aim.onPlace) {
        aim.onPlace(to)
        callbacks.onAimed?.()
        return
      }
      dispatch(
        aim.kind === 'plasma-bolt'
          ? { type: 'launch-plasma-bolt', shipId: aim.shipId, weaponId: aim.weaponId, aimPoint: to }
          : aim.kind === 'spinal'
            ? { type: 'fire-spinal-mount', shipId: aim.shipId, weaponId: aim.weaponId, aimPoint: to }
            : aim.kind === 'flak'
              ? { type: 'fire-flak-barrage', shipId: aim.shipId, weaponId: aim.weaponId, aimPoint: to }
              : { type: 'launch-ordnance', shipId: aim.shipId, weaponId: aim.weaponId, aimPoint: to },
      )
      callbacks.onAimed?.()
      return
    }
    if (view.placingTerrain) {
      dispatch({
        type: 'place-terrain',
        sideId: view.placingTerrain.sideId,
        kind: view.placingTerrain.kind,
        position: to,
        radius: view.placingTerrain.radius,
      })
      callbacks.onTerrainPlaced?.()
      return
    }
    if (placing && view.selectedId && view.deployWith) {
      dispatch({
        type: 'deploy-ship',
        shipId: view.selectedId,
        position: to,
        facing: view.deployWith.facing,
        velocity: view.deployWith.velocity,
      })
      return
    }
    this.flyToGroup(to, flight, squadron)
  }

  /** Where a click on bare table sends the group in hand (8.5, 9.1). */
  private flyToGroup(to: Point, flight: FighterGroupState | undefined, squadron: GunboatSquadronState | undefined): void {
    const { game } = this
    if (!game) return
    const moving = game.phase === 'move-fighters' || game.phase === 'secondary-fighter-moves'
    if (squadron) {
      if (squadron.status !== 'in-flight') refuseAtTable(`${squadron.label} is not in flight (9.1)`)
      else if (!moving) refuseAtTable('Gunboats move with the fighters, phases 4 and 6 (9.1)')
      else dispatch({ type: 'move-gunboats', squadronId: squadron.id, to })
      return
    }
    if (!flight) return
    if (flight.status !== 'in-flight') {
      refuseAtTable(`${flight.label} is ${flight.status === 'aboard' ? 'still in the bay' : 'not in flight'} (8.5)`)
      return
    }
    if (game.phase === 'move-fighters') dispatch({ type: 'move-flight', flightId: flight.id, to })
    else if (game.phase === 'secondary-fighter-moves') dispatch({ type: 'secondary-move-flight', flightId: flight.id, to })
    else refuseAtTable('Fighter groups move in phase 4, and again in phase 6 (8.5)')
  }

  /**
   * Swing the camera onto a ship, keeping the current viewing angle, from
   * `distance` MU away. Returns false when the ship is not drawn.
   */
  focusShip(id: string, distance = 9, instant = false): boolean {
    const at = this.ships.drawnPosition(id)
    if (!at) return false
    const target = new Vector3(at.x, 0, at.z)
    const offset = this.camera.position.clone().sub(this.controls.target).setLength(distance)
    if (instant) {
      this.camera.position.copy(target.clone().add(offset))
      this.controls.target.copy(target)
      this.controls.update()
    } else {
      this.flyTo(target.clone().add(offset), target)
    }
    return true
  }

  /** Orbit to a given elevation (degrees) and bearing about the current target. */
  orbitTo(elevation: number, bearing: number, distance?: number): void {
    const d = distance ?? this.camera.position.distanceTo(this.controls.target)
    const e = elevation * (Math.PI / 180)
    const b = bearing * (Math.PI / 180)
    const t = this.controls.target
    this.camera.position.set(t.x + Math.sin(b) * Math.cos(e) * d, Math.sin(e) * d, t.z + Math.cos(b) * Math.cos(e) * d)
    this.controls.update()
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    for (const layer of this.layers) layer.dispose()
    this.composer.dispose()
    this.scene.environment?.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.labels.domElement.remove()
  }
}
