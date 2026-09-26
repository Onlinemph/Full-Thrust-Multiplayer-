/**
 * Everything drawn on the board rather than on a hull: range rings, the lit
 * fire arcs, the phase 11 fire rose, the plotted track and move ghost, the
 * reach of whatever is in hand (a launcher's fan, a fighter group's move
 * disc, a spinal mount's cone, a returning ship's edge band), and fog on all
 * of it — the same rule `MapView.tsx` applies (`shipVisible`, plus hiding the
 * other side's own plotted track).
 *
 * `setShipPositions` is `BattleScene`'s own feed of where `ships.ts` actually
 * drew each hull (so a track/ghost starts from a hull's true drawn position,
 * riders included, once `ships.ts` fans them out) and `setReach` is its
 * computed `Reach` (the same shape `ReachOverlay` in `../MapView.tsx`
 * switches on) — both are the contract to keep.
 *
 * The phase 11 rose's numbers live in two places on purpose: the wedges and
 * their labels are drawn right here, in the scene, so they turn and sit with
 * the ship like the 2D rose does; a second, small DOM legend lives in
 * `BattleView3D.tsx`'s HUD slot only because hovering it is how `onHoverArc`
 * gets wired without reaching into `BattleScene.ts`'s own raycaster, which is
 * not this file's to touch — see that component's own doc comment.
 */
import {
  BufferGeometry,
  CircleGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
} from 'three'
import { optional } from '../../engine/actions'
import type { GameState, ShipState } from '../../engine/game'
import { vectorStateOf } from '../../engine/game'
import { courseToDegrees, distance } from '../../engine/geometry'
import { applyOrder, driveFromDef, type MovementState } from '../../engine/movement'
import type { Arc } from '../../engine/types'
import { moveVector } from '../../engine/vectormovement'
import { describeReady, fireArcs } from '../fireArcs'
import type { Reach } from '../reach'
import { makeLabel } from './labels'
import { disposeTree, type FrameContext, type Layer, type LayerContext, type ViewProps } from './layer'
import { alongHeading, headingToYaw, HULL_ALTITUDE, toWorld } from './space'
import { shipVisible } from './visibility'

/** Each 60° arc's centre, clockwise from the ship's own facing (4.2). */
const ARC_CENTER_DEG: Record<Arc, number> = { F: 0, FS: 60, AS: 120, A: 180, AP: 240, FP: 300 }

/** Just above the grid, so nothing z-fights with it. */
const FLOOR = HULL_ALTITUDE * 0.15

type Locator = (id: string) => { x: number; z: number; heading: number } | null

/** The rose is for a ship of ours, on the table, in the phase it fires — `MapView.tsx`'s own `roseFor`. */
export function roseFor(game: GameState, ship: ShipState | undefined, viewingSide: string | null): boolean {
  if (!ship || game.phase !== 'ship-fire') return false
  if (ship.destroyed || ship.offTable || ship.captured) return false
  if (viewingSide !== null && ship.side !== viewingSide) return false
  return true
}

/**
 * The flat rect a reach `'edge'` band occupies, in board inches — the exact
 * rule `ReachOverlay`'s own `'edge'` case draws in `../MapView.tsx`, so a
 * click just off the table edge in 3D is judged by the same band a player
 * sees drawn.
 */
export function edgeBand(
  table: { width: number; height: number },
  edge: 'top' | 'bottom' | 'left' | 'right',
  band = 1,
): { x: number; y: number; width: number; height: number } {
  switch (edge) {
    case 'top':
      return { x: 0, y: -band / 2, width: table.width, height: band }
    case 'bottom':
      return { x: 0, y: table.height - band / 2, width: table.width, height: band }
    case 'left':
      return { x: -band / 2, y: 0, width: band, height: table.height }
    case 'right':
      return { x: table.width - band / 2, y: 0, width: band, height: table.height }
  }
}

/** A ship's track this turn, drawn as the path the cinematic or vector rules actually move it through. */
interface TrackPlan {
  /** Board points after the start, in order — the last is where the hull ends up. */
  path: Array<{ x: number; y: number }>
  /** 12.12's bookkeeping sequence, drawn faint; null under cinematic movement. */
  steps: Array<{ x: number; y: number }> | null
  /** Degrees clockwise from up the table, at the end of the plotted move. */
  heading: number
  /** The speed the order sheet ends the turn at. */
  speed: number
  /** An impossible order flies straight ahead instead (3.5); the vector sheet coasts (12.12). */
  illegal: boolean
}

function planCinematic(ship: ShipState): TrackPlan | null {
  if (!ship.order) return null
  const movement: MovementState = {
    placement: ship.placement,
    velocity: ship.velocity,
    drive: { ...driveFromDef(ship.design.drive), hits: ship.driveHits },
  }
  const result = applyOrder(movement, ship.order)
  return {
    path: result.legs.map((leg) => leg.to),
    steps: null,
    heading: courseToDegrees(result.placement.facing),
    speed: result.velocity,
    illegal: !result.legal,
  }
}

function planVector(ship: ShipState): TrackPlan | null {
  if (!ship.vectorOrders) return null
  const flown = moveVector(vectorStateOf(ship), ship.vectorOrders, {
    rating: ship.design.drive.thrust,
    hits: ship.driveHits,
  })
  return {
    // 12.12: the flown sequence is bookkeeping only — the model "does NOT
    // indicate that the ship actually occupies that point at any time" — so
    // the chord, which is what a collision is tested against, is the track.
    path: [flown.chord.to],
    steps: flown.steps.map((step) => step.position),
    heading: courseToDegrees(flown.end.facing),
    speed: flown.end.velocity,
    illegal: !flown.legal,
  }
}

function polyline(points: Array<{ x: number; z: number }>, altitude = FLOOR): BufferGeometry {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(points.flatMap((p) => [p.x, altitude, p.z]), 3))
  return geo
}

function toXZ(p: { x: number; y: number }): { x: number; z: number } {
  return { x: p.x, z: p.y }
}

function rectOutline(rect: { x: number; y: number; width: number; height: number }): BufferGeometry {
  const corners = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y + rect.height],
    [rect.x, rect.y + rect.height],
  ]
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(corners.flatMap(([x, y]) => [x, 0, y]), 3))
  return geo
}

/** A filled wedge (or, with `spanDeg` 360, a disc) `radius` MU out from the origin, centred on `centerDeg`. */
function wedgeFill(radius: number, centerDeg: number, spanDeg: number, color: number, opacity: number): Mesh {
  const segments = Math.max(6, Math.round(spanDeg / 10))
  const positions: number[] = [0, 0, 0]
  for (let i = 0; i <= segments; i++) {
    const deg = centerDeg - spanDeg / 2 + (spanDeg * i) / segments
    const p = alongHeading({ x: 0, z: 0 }, deg, radius)
    positions.push(p.x, 0, p.z)
  }
  const index: number[] = []
  for (let i = 1; i < segments + 1; i++) index.push(0, i, i + 1)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(index)
  const material = new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false })
  return new Mesh(geometry, material)
}

/** The outline of a wedge (or, with `spanDeg` 360, a ring) — a line loop rather than a filled shape. */
function wedgeOutline(radius: number, centerDeg: number, spanDeg: number, color = 0x64d2ff): Line {
  const segments = Math.max(12, Math.round(spanDeg / 6))
  const positions: number[] = []
  for (let i = 0; i <= segments; i++) {
    const deg = centerDeg - spanDeg / 2 + (spanDeg * i) / segments
    const p = alongHeading({ x: 0, z: 0 }, deg, radius)
    positions.push(p.x, 0, p.z)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return new Line(geometry, new LineBasicMaterial({ color, transparent: true, opacity: 0.5, toneMapped: false }))
}

/**
 * An annulus wedge between `inner` and `outer` MU, spanning `spanDeg` centred
 * on `centerDeg` — the fire rose's own wedges, which (unlike a reach fan)
 * stand clear of the ship rather than reaching back to its centre.
 */
function wedgeRing(inner: number, outer: number, centerDeg: number, spanDeg: number, color: number, opacity: number): Mesh {
  const segments = Math.max(4, Math.round(spanDeg / 12))
  const positions: number[] = []
  for (let i = 0; i <= segments; i++) {
    const deg = centerDeg - spanDeg / 2 + (spanDeg * i) / segments
    const o = alongHeading({ x: 0, z: 0 }, deg, outer)
    const p = alongHeading({ x: 0, z: 0 }, deg, inner)
    positions.push(o.x, 0, o.z, p.x, 0, p.z)
  }
  const index: number[] = []
  for (let i = 0; i < segments; i++) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(index)
  const material = new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: DoubleSide })
  return new Mesh(geometry, material)
}

interface TrackEntry {
  group: Group
  key: string
}

export class OverlaysLayer implements Layer {
  readonly group = new Group()
  private rings = new Group()
  private arcs = new Group()
  private rose = new Group()
  private reachGroup = new Group()
  private tracks = new Group()
  private locate: Locator | null = null
  private reach: Reach | null = null
  private trackEntries = new Map<string, TrackEntry>()

  constructor() {
    this.group.name = 'overlays'
    this.group.add(this.rings, this.arcs, this.rose, this.reachGroup, this.tracks)
  }

  /** Where `ships.ts` actually drew each hull, so a track/ghost starts from a hull's true drawn position. */
  setShipPositions(locate: Locator): void {
    this.locate = locate
  }

  setReach(reach: Reach | null): void {
    this.reach = reach
  }

  update({ game, view }: LayerContext): void {
    this.updateRangeRings(game, view)
    this.updateLitArcs(game, view)
    this.updateRose(game, view)
    this.updateReach(game)
    this.updateTracks(game, view)
  }

  private updateRangeRings(game: GameState, view: ViewProps): void {
    disposeTree(this.rings)
    this.rings.clear()
    const selected = view.selectedId ? game.ships.find((s) => s.id === view.selectedId) : undefined
    if (!selected || selected.offTable || !shipVisible(selected, view.viewingSide)) return
    const centre = toWorld(selected.placement.position, HULL_ALTITUDE * 0.1)
    // 4.3's beam range bands: green out to one band, amber for the next two.
    const BEAM_RANGE_BAND = 12
    for (let band = 1; band <= 3; band++) {
      const radius = BEAM_RANGE_BAND * band
      const color = band === 1 ? 0x57c46f : 0xff9a3c
      const ring = wedgeOutline(radius, 0, 360, color)
      ring.position.copy(centre)
      this.rings.add(ring)
      const label = makeLabel(`${radius}"`, 'l3d-ring')
      label.position.set(centre.x, centre.y, centre.z - radius)
      this.rings.add(label)
    }
  }

  private updateLitArcs(game: GameState, view: ViewProps): void {
    disposeTree(this.arcs)
    this.arcs.clear()
    const selected = view.selectedId ? game.ships.find((s) => s.id === view.selectedId) : undefined
    if (!selected || !shipVisible(selected, view.viewingSide) || !view.litArcs || view.litArcs.length === 0) return
    const facing = courseToDegrees(selected.placement.facing)
    const radius = 12 * 3
    const group = new Group()
    for (const arc of view.litArcs) {
      const wedge = wedgeFill(radius, facing + ARC_CENTER_DEG[arc], 60, 0xffcc66, 0.14)
      group.add(wedge)
    }
    group.position.copy(toWorld(selected.placement.position, HULL_ALTITUDE * 0.08))
    this.arcs.add(group)
  }

  /**
   * Phase 11's rose (4.2): a ring of six wedges round the selected ship, each
   * saying what bears into that arc and how many enemy hulls stand in it —
   * `fireArcs` is the same read the 2D `FireRose` draws from, so the numbers
   * cannot disagree. Rebuilt every update (six wedges and six labels is
   * cheap) so a target moving into an arc updates the ring immediately.
   */
  private updateRose(game: GameState, view: ViewProps): void {
    disposeTree(this.rose)
    this.rose.clear()
    const selected = view.selectedId ? game.ships.find((s) => s.id === view.selectedId) : undefined
    if (!view.fireRose || !roseFor(game, selected, view.viewingSide) || !selected) return
    const summaries = fireArcs(game, selected)
    const facing = courseToDegrees(selected.placement.facing)
    const inner = 6
    const outer = 9.5
    const lit = view.litArcs?.length === 1 ? view.litArcs[0] : null
    for (const summary of summaries) {
      const centerDeg = facing + ARC_CENTER_DEG[summary.arc]
      const armed = summary.ready.length > 0
      const hasTarget = summary.targets.length > 0
      const color = hasTarget ? 0xff6a4d : armed ? 0xffcc66 : 0x4a5570
      const opacity = summary.arc === lit ? 0.6 : hasTarget ? 0.42 : armed ? 0.28 : 0.14
      this.rose.add(wedgeRing(inner, outer, centerDeg, 60, color, opacity))
      const names = describeReady(summary.ready)
      const text = `${summary.arc}\n${armed ? names : '—'}${hasTarget ? ` ◆${summary.targets.length}` : ''}`
      const classes = `l3d-rose${summary.arc === lit ? ' is-lit' : ''}${hasTarget ? ' has-target' : armed ? ' is-armed' : ''}`
      const label = makeLabel(text, classes)
      const mid = alongHeading({ x: 0, z: 0 }, centerDeg, (inner + outer) / 2)
      label.position.set(mid.x, 0, mid.z)
      this.rose.add(label)
    }
    this.rose.add(wedgeOutline(inner, 0, 360, 0x8b97b0), wedgeOutline(outer, 0, 360, 0x8b97b0))
    this.rose.position.copy(toWorld(selected.placement.position, FLOOR))
  }

  private updateReach(game: GameState): void {
    disposeTree(this.reachGroup)
    this.reachGroup.clear()
    const reach = this.reach
    if (!reach) return
    if (reach.kind === 'disc') {
      const disc = wedgeFill(reach.radius, 0, 360, 0x64d2ff, 0.12)
      disc.position.copy(toWorld(reach.centre, HULL_ALTITUDE * 0.05))
      const ring = wedgeOutline(reach.radius, 0, 360)
      ring.position.copy(disc.position)
      this.reachGroup.add(disc, ring)
    } else if (reach.kind === 'fan') {
      const group = new Group()
      for (const arc of reach.arcs) group.add(wedgeFill(reach.radius, courseToDegrees(reach.facing) + ARC_CENTER_DEG[arc], 60, 0x64d2ff, 0.12))
      group.position.copy(toWorld(reach.centre, HULL_ALTITUDE * 0.05))
      this.reachGroup.add(group)
    } else if (reach.kind === 'cone') {
      const cone = wedgeFill(reach.radius, courseToDegrees(reach.facing), reach.halfAngle * 2, 0x64d2ff, 0.14)
      cone.position.copy(toWorld(reach.centre, HULL_ALTITUDE * 0.05))
      this.reachGroup.add(cone)
    } else {
      // 'edge': a returning ship's table-edge band (3.9, 17.7) — the same
      // 1 MU strip `ReachOverlay`'s own 'edge' case draws in `../MapView.tsx`,
      // laid flat on the board rather than as a wall, since nothing here has
      // height to speak of.
      const rect = edgeBand(game.table, reach.edge)
      const plane = new Mesh(
        new PlaneGeometry(rect.width, rect.height),
        new MeshBasicMaterial({ color: 0x64d2ff, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false, side: DoubleSide }),
      )
      plane.rotation.x = -Math.PI / 2
      plane.position.set(rect.x + rect.width / 2, HULL_ALTITUDE * 0.06, rect.y + rect.height / 2)
      const outline = new LineLoop(rectOutline(rect), new LineBasicMaterial({ color: 0x64d2ff, transparent: true, opacity: 0.6, toneMapped: false }))
      outline.position.y = HULL_ALTITUDE * 0.07
      this.reachGroup.add(plane, outline)
    }
  }

  /**
   * The track each ship has plotted for this turn (3.4), and the ghost hull
   * it lands on — drawn from the same `applyOrder`/`moveVector` calls
   * `MapView.tsx` uses, so the line on the table cannot disagree with where
   * the move will actually take the ship. Diffed by id: a ship whose plotted
   * order has not changed keeps its group untouched.
   *
   * Fog: orders are written in secret, so through one side's eyes only that
   * side's tracks are drawn (the same filter `MapView.tsx` applies); the open
   * table (`viewingSide === null`) shows everyone's, same as it shows every
   * hull.
   */
  private updateTracks(game: GameState, view: ViewProps): void {
    const vector = optional(game).movementSystem === 'vector'
    const seen = new Set<string>()
    for (const ship of game.ships) {
      if (ship.destroyed || ship.offTable) continue
      if (!shipVisible(ship, view.viewingSide)) continue
      if (view.viewingSide !== null && ship.side !== view.viewingSide) continue
      const plan = vector ? planVector(ship) : planCinematic(ship)
      if (!plan) continue
      seen.add(ship.id)
      this.updateTrack(ship, plan)
    }
    for (const [id, entry] of this.trackEntries) {
      if (seen.has(id)) continue
      disposeTree(entry.group)
      this.tracks.remove(entry.group)
      this.trackEntries.delete(id)
    }
  }

  private updateTrack(ship: ShipState, plan: TrackPlan): void {
    const key = JSON.stringify([plan.path, plan.steps, plan.heading, plan.speed, plan.illegal])
    const existing = this.trackEntries.get(ship.id)
    if (existing?.key === key) return
    if (existing) {
      disposeTree(existing.group)
      this.tracks.remove(existing.group)
    }
    const group = this.buildTrack(ship, plan)
    this.tracks.add(group)
    this.trackEntries.set(ship.id, { group, key })
  }

  private buildTrack(ship: ShipState, plan: TrackPlan): Group {
    const group = new Group()
    const at = this.locate?.(ship.id)
    const start = at ? { x: at.x, z: at.z } : toXZ(ship.placement.position)
    const rest = plan.path.map(toXZ)
    const end = rest[rest.length - 1] ?? start
    const unmoved = rest.length === 0 || (distance(ship.placement.position, plan.path[plan.path.length - 1]!) < 1e-6 && !plan.illegal)
    if (unmoved) return group

    const color = plan.illegal ? 0xff6a5a : 0x9fd0ff
    if (plan.steps) {
      const seq = new Line(
        polyline([start, ...plan.steps.map(toXZ)]),
        new LineBasicMaterial({ color, transparent: true, opacity: 0.22, toneMapped: false }),
      )
      group.add(seq)
    }
    const points = [start, ...rest]
    const glow = new Line(polyline(points), new LineBasicMaterial({ color, transparent: true, opacity: 0.25, toneMapped: false }))
    const core = new Line(polyline(points, FLOOR + 0.01), new LineDashedMaterial({ color, dashSize: 0.5, gapSize: 0.3, transparent: true, opacity: 0.85, toneMapped: false }))
    core.computeLineDistances()
    group.add(glow, core)

    const ghost = new Group()
    ghost.position.set(end.x, FLOOR + 0.01, end.z)
    ghost.rotation.y = headingToYaw(plan.heading)
    const ring = new Mesh(
      new RingGeometry(0.5, 0.62, 24),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.75, toneMapped: false, side: DoubleSide }),
    )
    ring.rotation.x = -Math.PI / 2
    const bow = new Mesh(new CircleGeometry(0.16, 3), new MeshBasicMaterial({ color, toneMapped: false, side: DoubleSide }))
    bow.rotation.x = -Math.PI / 2
    bow.position.z = -0.72
    ghost.add(ring, bow)
    const label = makeLabel(plan.illegal ? 'illegal — flies straight' : `${plan.speed} MU`, `l3d-plot${plan.illegal ? ' is-illegal' : ''}`)
    label.position.set(0, 0.55, 0.85)
    ghost.add(label)
    group.add(ghost)
    return group
  }

  tick(_frame: FrameContext): void {
    // Nothing here animates on its own; the rose and track are rebuilt from
    // fresh state on every `update()` instead.
  }

  dispose(): void {
    disposeTree(this.group)
    this.trackEntries.clear()
  }
}
