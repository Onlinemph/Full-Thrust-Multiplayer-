/**
 * The ground 3D view's engine room: renderer, camera, presets, controls and
 * the pointer — `src/ui/three/BattleScene.ts`'s own idea for a table
 * instead of open space, copied here (not imported) so this folder never
 * depends on `src/ui/three/`.
 *
 * Plain TypeScript around three.js, no React and no game inside it: a
 * game's own view shell (`dirtside/DirtsideView3D.tsx`,
 * `stargrunt/StargruntView3D.tsx`) creates one, feeds it the table's size
 * and terrain and its own units layer's pickables, and turns the three
 * callbacks below back into the very same `onSelectElement`/`onClickTable`
 * (or Stargrunt's `onSelectUnit`) calls its 2D `TableMap` already makes —
 * `GroundScene` itself knows nothing about either game's rules, dispatch or
 * refusals.
 *
 * Only `terrain` and `backdrop` are built in here; a shell adds its own
 * units and overlays layers with `addLayer` — attached to the scene graph
 * and ticked/disposed alongside everything else, but updated with the
 * game's own types directly by the shell, never through this file (see
 * `layer.ts`'s own note on why `Layer` carries no generic `update`).
 */
import {
  DirectionalLight,
  HemisphereLight,
  MOUSE,
  type Object3D,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { Point, TerrainFeature } from '../../dirtside/table/types'
import { BackdropLayer } from './backdrop'
import { pickableOf, tooltipOf, type FrameContext, type Layer } from './layer'
import { elevatedFramingDistance, framingDistance, fromWorldXZ, snapToGrid, type GroundScale } from './space'
import { TerrainLayer } from './terrain'

export type CameraPreset = 'tilt' | 'top' | 'low'

export interface GroundCallbacks {
  onSelectUnit: (id: string) => void
  onClickBoard: (point: Point) => void
  /** `null` when nothing is hovered. */
  onHoverUnit: (id: string | null) => void
  onHoverText: (text: string | null, at: { x: number; y: number } | null) => void
  /**
   * The table point under the pointer, read once per animation frame (K1) —
   * the same point the 2D `TableMap`s track continuously into their own
   * local `pointer` state (`onPointerMove`/`trackPointer`) so a move ghost,
   * an orbital aim ring, a landing clearance ring or a deploy ghost can
   * follow it. `null` once the pointer has left the canvas or sits off the
   * board entirely — every rule decision about what the point under it means
   * still lives in the screen/engine; this only ever reports where it is.
   */
  onPointerBoard?: (point: Point | null) => void
}

export interface GroundSceneOptions {
  scale: GroundScale
  /** The units layer's own pickable meshes (tagged with `tagPickable`) — read fresh on every pointer event. */
  getUnitPickables: () => Object3D[]
  /** A unit's current world position, for double-click-to-focus and Follow; null once it is off the table. */
  getUnitPosition: (id: string) => Vector3 | null
}

const FOV = 42
/** Comfortably above the double-click interval any common browser/OS uses (R8) — see `onPointerUp`'s own note. */
const DBLCLICK_MS = 400

export class GroundScene {
  readonly renderer: WebGLRenderer
  readonly terrain = new TerrainLayer()
  private backdrop: BackdropLayer
  private labels = new CSS2DRenderer()
  private scene = new Scene()
  private camera = new PerspectiveCamera(FOV, 1, 0.05, 800)
  private controls: OrbitControls
  private layers: Layer[]
  private raycaster = new Raycaster()
  private ground = new Plane(new Vector3(0, 1, 0), 0)
  private boardSize = { width: 0, depth: 0 }
  private follow: string | null = null
  /** The pointer's last known client position, read once per frame for `onPointerBoard` (K1); null off the canvas. */
  private pointerClient: { clientX: number; clientY: number } | null = null
  private lastPointerBoard: Point | null = null
  private down: { x: number; y: number } | null = null
  /** A click's own dispatch, held back in case a `dblclick` cancels it (R8) — see `onPointerUp`. */
  private pendingClick: ReturnType<typeof setTimeout> | null = null
  private dragging = false
  private frame = 0
  private last = performance.now()
  private resizeObserver: ResizeObserver
  /** Live-updated by this query's own `change` listener (R7), not read only once at construction. */
  private reducedMotionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
  private reducedMotion = this.reducedMotionQuery?.matches ?? false
  private onReducedMotionChange = (e: MediaQueryListEvent): void => {
    this.reducedMotion = e.matches
  }
  private flight: { from: Vector3; to: Vector3; fromT: Vector3; toT: Vector3; start: number } | null = null

  constructor(
    private host: HTMLElement,
    private opts: GroundSceneOptions,
    private callbacks: GroundCallbacks,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.domElement.className = 'ground3d-canvas'
    host.appendChild(this.renderer.domElement)

    this.labels.domElement.className = 'ground3d-labels'
    host.appendChild(this.labels.domElement)

    this.scene.add(new HemisphereLight(0xdce8ef, 0x6b7650, 0.75))
    const sun = new DirectionalLight(0xfff3de, 1.25)
    sun.position.set(-30, 46, 22)
    this.scene.add(sun)
    const fill = new DirectionalLight(0xcfe0ff, 0.35)
    fill.position.set(24, 18, -20)
    this.scene.add(fill)

    this.backdrop = new BackdropLayer(this.scene)
    this.layers = [this.backdrop, this.terrain]
    for (const layer of this.layers) this.scene.add(layer.group)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.09
    this.controls.screenSpacePanning = false
    this.controls.maxPolarAngle = 87 * (Math.PI / 180)
    this.controls.minDistance = 1.5
    this.controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }
    this.controls.addEventListener('start', () => (this.dragging = true))
    this.controls.addEventListener('end', () => (this.dragging = false))

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
    // R7: a live OS/browser toggle while this scene is already open, not only
    // whatever the preference read at construction.
    this.reducedMotionQuery?.addEventListener('change', this.onReducedMotionChange)
    this.loop()
  }

  /** A game's own units/overlays layer: attached to the scene graph, ticked and disposed alongside terrain/backdrop. */
  addLayer(layer: Layer): void {
    this.layers.push(layer)
    this.scene.add(layer.group)
  }

  /** Feed the scene the table's size and terrain; `heightAt` is `this.terrain.heightAt` from here on. */
  update(table: { width: number; depth: number }, features: readonly TerrainFeature[]): void {
    const first = this.boardSize.width === 0 && this.boardSize.depth === 0
    const resized = table.width !== this.boardSize.width || table.depth !== this.boardSize.depth
    this.boardSize = { width: table.width, depth: table.depth }
    const ctx = { table, features, now: performance.now() }
    this.backdrop.update(ctx)
    this.terrain.update(ctx, this.opts.scale)
    if (first || resized) this.setPreset('tilt', true)
  }

  heightAt(point: Point): number {
    return this.terrain.heightAt(point)
  }

  isDragging(): boolean {
    return this.dragging
  }

  setFollow(id: string | null): void {
    this.follow = id
  }

  /** Point the camera at the board from one of the stock angles. */
  setPreset(preset: CameraPreset, instant = false): void {
    const aspect = this.camera.aspect || 1.5
    const { width, depth } = this.boardSize
    const center = new Vector3(width / 2, 0, depth / 2)
    const elevation = preset === 'top' ? 89 : preset === 'low' ? 13 : 42
    const topDistance = framingDistance(width, depth, FOV, aspect)
    // R9: Tilt and Low look across the board rather than straight down, so
    // `topDistance`'s flat top-down trig understates the near corner's real
    // angular extent — computed properly instead, or a unit near the
    // table's own edge can fall outside the frame entirely.
    const distance = preset === 'top' ? topDistance : elevatedFramingDistance(width, depth, FOV, aspect, elevation)
    const e = elevation * (Math.PI / 180)
    const position = new Vector3(center.x, Math.sin(e) * distance, center.z + Math.cos(e) * distance)
    this.follow = null
    this.controls.maxDistance = Math.max(distance, topDistance) * 2.4
    if (instant || this.reducedMotion) {
      this.camera.position.copy(position)
      this.controls.target.copy(center)
      this.controls.update()
      return
    }
    this.flyTo(position, center)
  }

  /** Swing the camera onto a unit, keeping the current viewing angle. Returns false when it is off the table. */
  focusUnit(id: string, distance = 5, instant = false): boolean {
    const at = this.opts.getUnitPosition(id)
    if (!at) return false
    const target = new Vector3(at.x, 0, at.z)
    const offset = this.camera.position.clone().sub(this.controls.target).setLength(distance)
    if (instant || this.reducedMotion) {
      this.camera.position.copy(target.clone().add(offset))
      this.controls.target.copy(target)
      this.controls.update()
    } else {
      this.flyTo(target.clone().add(offset), target)
    }
    return true
  }

  private flyTo(position: Vector3, target: Vector3): void {
    this.flight = { from: this.camera.position.clone(), to: position, fromT: this.controls.target.clone(), toT: target, start: performance.now() }
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.labels.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.1)
    this.last = now

    if (this.flight) {
      const t = Math.min(1, (now - this.flight.start) / 850)
      const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
      this.camera.position.lerpVectors(this.flight.from, this.flight.to, k)
      this.controls.target.lerpVectors(this.flight.fromT, this.flight.toT, k)
      if (t >= 1) this.flight = null
    } else if (this.follow) {
      const at = this.opts.getUnitPosition(this.follow)
      if (at) {
        const goal = new Vector3(at.x, 0, at.z)
        const shift = goal.sub(this.controls.target).multiplyScalar(1 - Math.exp(-dt * 4))
        this.controls.target.add(shift)
        this.camera.position.add(shift)
      }
    }
    this.controls.update()

    const frame: FrameContext = { now, dt, camera: this.camera, reducedMotion: this.reducedMotion, hostTop: this.host.getBoundingClientRect().top }
    for (const layer of this.layers) layer.tick?.(frame)
    this.renderer.render(this.scene, this.camera)
    this.labels.render(this.scene, this.camera)
    this.reportPointerBoard()
  }

  // ── Pointer ────────────────────────────────────────────────────────────

  private ndc(e: { clientX: number; clientY: number }): Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect()
    return new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
  }

  private pickUnit(e: { clientX: number; clientY: number }): Object3D | null {
    this.raycaster.setFromCamera(this.ndc(e), this.camera)
    const hits = this.raycaster.intersectObjects(this.opts.getUnitPickables(), true)
    return hits.length > 0 ? hits[0]!.object : null
  }

  /** The table point under the pointer: the terrain's own raised features first, bare ground otherwise. Never bounds-checked against the board — `reportPointerBoard` is that check, for the continuous K1 preview point. */
  private boardPoint(e: { clientX: number; clientY: number }): Point | null {
    this.raycaster.setFromCamera(this.ndc(e), this.camera)
    const hits = this.raycaster.intersectObjects([this.terrain.group, this.backdrop.group], true)
    if (hits.length > 0) {
      const p = hits[0]!.point
      return snapToGrid(fromWorldXZ(p.x, p.z))
    }
    const hit = this.raycaster.ray.intersectPlane(this.ground, new Vector3())
    return hit ? snapToGrid(fromWorldXZ(hit.x, hit.z)) : null
  }

  private hoverTarget(e: { clientX: number; clientY: number }): Object3D | null {
    this.raycaster.setFromCamera(this.ndc(e), this.camera)
    const hits = this.raycaster.intersectObjects([this.terrain.group, this.backdrop.group], true)
    return hits.find((h) => tooltipOf(h.object) !== null)?.object ?? null
  }

  /**
   * K1: the point every pointer-following preview draws from, read once a
   * frame off `this.pointerClient` — `boardPoint` alone hits the backdrop's
   * own room floor well past the board's own edge, so this also drops
   * anything outside the table's own bounds (`onPointerBoard`'s own "null
   * off the board").
   */
  private reportPointerBoard(): void {
    if (!this.callbacks.onPointerBoard) return
    const { width, depth } = this.boardSize
    const raw = this.pointerClient ? this.boardPoint(this.pointerClient) : null
    const onTable = !!raw && raw.x >= 0 && raw.x <= width && raw.y >= 0 && raw.y <= depth
    const point = onTable ? raw : null
    const same = point === this.lastPointerBoard || (!!point && !!this.lastPointerBoard && point.x === this.lastPointerBoard.x && point.y === this.lastPointerBoard.y)
    if (same) return
    this.lastPointerBoard = point
    this.callbacks.onPointerBoard(point)
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerClient = { clientX: e.clientX, clientY: e.clientY }
    this.down = { x: e.clientX, y: e.clientY }
    // Orbiting by hand takes the camera back from Follow; panning or dollying does not.
    if (e.button === 0) this.follow = null
    this.flight = null
  }

  private onPointerMove = (e: PointerEvent): void => {
    this.pointerClient = { clientX: e.clientX, clientY: e.clientY }
    if (e.buttons !== 0) return
    const unitHit = this.pickUnit(e)
    const pick = pickableOf(unitHit)
    const hoverObject = unitHit ?? this.hoverTarget(e)
    this.callbacks.onHoverUnit(pick?.id ?? null)
    this.renderer.domElement.style.cursor = pick ? 'pointer' : 'grab'
    const rect = this.host.getBoundingClientRect()
    const text = tooltipOf(hoverObject)
    this.callbacks.onHoverText(text, text ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : null)
  }

  private onPointerUp = (e: PointerEvent): void => {
    const moved = this.down ? Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 4 : true
    this.down = null
    if (moved || e.button !== 0) return
    const pick = pickableOf(this.pickUnit(e))
    const point = pick ? null : this.boardPoint(e)
    // R8: a browser double-click dispatches two whole pointerdown/pointerup
    // pairs before its own `dblclick` event ever fires, so committing a
    // click's own board action (a waypoint, a shot, a deploy point) right
    // here would silently spend two of them before `onDoubleClick`'s
    // fly-to-it ever runs. Held behind a short timer keyed to the browser's
    // own double-click window instead, so a resolved double click can cancel
    // both halves' pending dispatch before either one fires.
    this.cancelPendingClick()
    this.pendingClick = window.setTimeout(() => {
      this.pendingClick = null
      if (pick) this.callbacks.onSelectUnit(pick.id)
      else if (point) this.callbacks.onClickBoard(point)
    }, DBLCLICK_MS)
  }

  private cancelPendingClick(): void {
    if (this.pendingClick === null) return
    clearTimeout(this.pendingClick)
    this.pendingClick = null
  }

  private onPointerLeave = (): void => {
    this.pointerClient = null
    this.callbacks.onHoverUnit(null)
    this.callbacks.onHoverText(null, null)
  }

  private onDoubleClick = (e: MouseEvent): void => {
    this.cancelPendingClick()
    const pick = pickableOf(this.pickUnit(e))
    if (!pick || !this.focusUnit(pick.id)) this.setPreset('tilt')
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    this.cancelPendingClick()
    this.resizeObserver.disconnect()
    this.reducedMotionQuery?.removeEventListener('change', this.onReducedMotionChange)
    this.controls.dispose()
    for (const layer of this.layers) layer.dispose()
    this.renderer.dispose()
    // `dispose()` alone only frees three's own JS-side caches — the real
    // WebGL context (and the GPU resources behind it) is only released by
    // this separate, documented call. Left uncalled, every 2D<->3D toggle
    // leaves one more live context behind for the browser's GC to reclaim on
    // its own schedule, and browsers cap how many a page may hold at once
    // (R3, matching `src/ui/three/BattleScene.ts`'s own fix for the same gap).
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
    this.labels.domElement.remove()
  }
}
