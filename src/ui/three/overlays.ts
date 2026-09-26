/**
 * PLACEHOLDER (stage 2, OVERLAYS) — everything drawn on the board rather than
 * on a hull: range rings, the lit fire arcs, and the reach of whatever is in
 * hand (a launcher's fan, a fighter group's move disc, a spinal mount's cone,
 * a returning ship's edge band) with `BattleScene`'s own refusal already
 * enforced at the click.
 *
 * Not yet here, and OVERLAYS's real job: the phase 11 fire rose itself (today
 * only the six lit arcs show, not the rose's per-arc numbers — that likely
 * wants a HUD control in `BattleView3D.tsx`'s slot, not just a 3D mesh), the
 * plotted track and move ghosts (needs `applyOrder`/`moveVector` the way
 * `MapView.tsx` calls them, vector movement's chord included), and fog on all
 * of it (hide another side's plotted track and orders exactly as `MapView`
 * hides them — `visibility.ts` already gives the per-ship rule to build on).
 *
 * `setShipPositions` is `BattleScene`'s own feed of where `ships.ts` actually
 * drew each hull (for a track/ghost that has to start from the true drawn
 * position, riders included, once one exists) and `setReach` is its computed
 * `Reach` (the same shape `ReachOverlay` in `../MapView.tsx` switches on) —
 * both are the contract to keep.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial } from 'three'
import type { Reach } from '../reach'
import { courseToDegrees } from '../../engine/geometry'
import type { Arc } from '../../engine/types'
import { disposeTree, type FrameContext, type Layer, type LayerContext, type ViewProps } from './layer'
import { alongHeading, HULL_ALTITUDE, toWorld } from './space'
import type { GameState } from '../../engine/game'

/** Each 60° arc's centre, clockwise from the ship's own facing (4.2). */
const ARC_CENTER_DEG: Record<Arc, number> = { F: 0, FS: 60, AS: 120, A: 180, AP: 240, FP: 300 }

type Locator = (id: string) => { x: number; z: number; heading: number } | null

export class OverlaysLayer implements Layer {
  readonly group = new Group()
  private rings = new Group()
  private arcs = new Group()
  private reachGroup = new Group()
  private locate: Locator | null = null
  private reach: Reach | null = null

  constructor() {
    this.group.name = 'overlays'
    this.group.add(this.rings, this.arcs, this.reachGroup)
  }

  /** Where `ships.ts` actually drew each hull, for a future track/ghost that must start from the true position. */
  setShipPositions(locate: Locator): void {
    this.locate = locate
  }

  setReach(reach: Reach | null): void {
    this.reach = reach
  }

  update({ game, view }: LayerContext): void {
    this.updateRangeRings(game, view)
    this.updateLitArcs(game, view)
    this.updateReach()
    this.updateTracks()
  }

  /**
   * PLACEHOLDER (stage 2, OVERLAYS): nothing reads `this.locate` yet — a
   * track/move ghost is what needs it, to start from where `ships.ts`
   * actually drew a hull rather than from `game`'s own position.
   */
  private updateTracks(): void {
    void this.locate
  }

  private updateRangeRings(game: GameState, view: ViewProps): void {
    disposeTree(this.rings)
    this.rings.clear()
    const selected = view.selectedId ? game.ships.find((s) => s.id === view.selectedId) : undefined
    if (!selected || selected.offTable) return
    const centre = toWorld(selected.placement.position, HULL_ALTITUDE * 0.1)
    // 4.3's beam range bands.
    const BEAM_RANGE_BAND = 12
    for (let band = 1; band <= 3; band++) {
      const radius = BEAM_RANGE_BAND * band
      const ring = wedgeOutline(radius, 0, 360)
      ring.position.copy(centre)
      this.rings.add(ring)
    }
  }

  private updateLitArcs(game: GameState, view: ViewProps): void {
    disposeTree(this.arcs)
    this.arcs.clear()
    const selected = view.selectedId ? game.ships.find((s) => s.id === view.selectedId) : undefined
    if (!selected || !view.litArcs || view.litArcs.length === 0) return
    const facing = courseToDegrees(selected.placement.facing)
    const radius = 12 * 3
    const group = new Group()
    for (const arc of view.litArcs) {
      const wedge = wedgeFill(radius, facing + ARC_CENTER_DEG[arc], 60, 0xffcc66, 0.16)
      group.add(wedge)
    }
    group.position.copy(toWorld(selected.placement.position, HULL_ALTITUDE * 0.08))
    this.arcs.add(group)
  }

  private updateReach(): void {
    disposeTree(this.reachGroup)
    this.reachGroup.clear()
    const reach = this.reach
    if (!reach) return
    if (reach.kind === 'disc') {
      const disc = wedgeFill(reach.radius, 0, 360, 0x64d2ff, 0.12)
      disc.position.copy(toWorld(reach.centre, HULL_ALTITUDE * 0.05))
      this.reachGroup.add(disc, ringFor(disc, reach.radius))
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
      // 'edge': BattleScene passes the table through `game`, not `reach`, so
      // the band itself is OVERLAYS's to add — a thin lit strip along
      // `reach.edge` of `game.table` mirrors the 2D `<rect>` closely.
    }
  }

  tick(_frame: FrameContext): void {
    // PLACEHOLDER: OVERLAYS's rose sweep / track pulse, if any, goes here.
  }

  dispose(): void {
    disposeTree(this.group)
  }
}

function ringFor(disc: Mesh, radius: number): Line {
  const ring = wedgeOutline(radius, 0, 360)
  ring.position.copy(disc.position)
  return ring
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
function wedgeOutline(radius: number, centerDeg: number, spanDeg: number): Line {
  const segments = Math.max(12, Math.round(spanDeg / 6))
  const positions: number[] = []
  for (let i = 0; i <= segments; i++) {
    const deg = centerDeg - spanDeg / 2 + (spanDeg * i) / segments
    const p = alongHeading({ x: 0, z: 0 }, deg, radius)
    positions.push(p.x, 0, p.z)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return new Line(geometry, new LineBasicMaterial({ color: 0x64d2ff, transparent: true, opacity: 0.5, toneMapped: false }))
}
