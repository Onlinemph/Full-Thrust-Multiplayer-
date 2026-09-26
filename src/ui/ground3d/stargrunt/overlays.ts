/**
 * STARGRUNT'S OWN FILE — the presentation-only marks BRIEF-GROUND-3D lists
 * for this file: the objectives (kept from the placeholder), deployment
 * zones, the selected squad's own integrity circle or chain (p. 11), the
 * move ghost's reach ring, the close-assault plan's paths to contact
 * coloured by roll (K1), the fire line with its odds, and in-position marks
 * (p. 13) — everything `ui/stargrunt/map/overlays.tsx` draws flat, raised
 * here and draped on `heightAt` instead.
 *
 * `moveGhost` in `TableMapProps` carries no destination of its own — the 2D
 * map reads the mouse's own table point, tracked as local state inside
 * `TableMap.tsx`, never passed down as a prop. `GroundScene` (GROUND's, not
 * mine) has no equivalent: its own pointer handling resolves a board point
 * only on click (`onClickBoard`), which is enough to *commit* a move the
 * same way the 2D map's own click does, but there is no live board-point
 * callback to preview one being dragged, and the camera/raycaster that could
 * build one are private to `GroundScene`. So the move ghost here shows what
 * it can without one: the reach ring around the squad's own current
 * position and a label naming the move, not a ghost base following the
 * cursor. Noted for GROUND/the integrator: a `onHoverBoard(point)` callback
 * on `GroundCallbacks` would close this gap for a later pass.
 *
 * Same shape as `units.ts`'s own contract:
 *
 *   - `new StargruntOverlaysLayer()` — no arguments.
 *   - `.group: THREE.Group`.
 *   - `.update(state, opts)` — called on every render.
 *   - `.dispose()`.
 */
import { BufferGeometry, CylinderGeometry, DoubleSide, Group, Line, LineBasicMaterial, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three'
import { figuresOf } from '../../../stargrunt/table/game'
import { isInIntegrity, minEnclosingCircle, unitCentre } from '../../../stargrunt/table/cover'
import type { FigureMove, FigureState, GameState, MobilityKind, SideId } from '../../../stargrunt/types'
import { deploymentBand, hash, reachPolygon } from '../../stargrunt/map/geometry'
import type { TargetVerdict } from '../../stargrunt/map/overlays'
import { disposeTree, setTooltip, type Layer, type Point } from '../layer'
import { makeLabel, setLabel, type CSS2DObject } from '../labels'
import { sideColorOf } from '../palette'
import { STARGRUNT_SCALE } from '../space'

export interface StargruntOverlaysOptions {
  heightAt: (point: Point) => number
  selectedUnitId?: string | null
  moveGhost?: { mobility: MobilityKind; figureIds: string[]; mode: 'normal' | 'combat' | 'travel'; inches: number | null } | null
  assaultPreview?: { moves: readonly FigureMove[]; costs: readonly number[]; maxOneRoll: number } | null
  targeting?: { firingUnitId: string; verdicts: Record<string, TargetVerdict> } | null
}

const OBJECTIVE_RADIUS = 0.7
const OBJECTIVE_HEIGHT = 0.05
const NEUTRAL = 0xd8c98a
const LIFT = STARGRUNT_SCALE.roadLift * 2
const OK_COLOR = 0x6fe3c4
const BROKEN_COLOR = 0xff5555
const THRUST_COLOR = 0xff7a3d
const IP_COLOR = 0x6fe3c4
const REACH1_COLOR = 0x6fe3c4
const REACH2_COLOR = 0xffb020
const FAR_COLOR = 0x5d6a86

function fit(f: FigureState): boolean {
  return f.status !== 'dead'
}

/** A straight leg draped on the ground, sampled so a slope reads instead of cutting through it. */
function drapedSegment(a: Point, b: Point, heightAt: (p: Point) => number, lift: number, steps = 10): Vector3[] {
  const pts: Vector3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    pts.push(new Vector3(p.x, heightAt(p) + lift, p.y))
  }
  return pts
}

/** A closed ring of table points draped on the ground — the reach ring, the integrity circle. */
function drapedRing(points: readonly Point[], heightAt: (p: Point) => number, lift: number): Vector3[] {
  if (points.length === 0) return []
  return [...points, points[0]!].map((p) => new Vector3(p.x, heightAt(p) + lift, p.y))
}

export class StargruntOverlaysLayer implements Layer {
  readonly group = new Group()
  private objectivesGroup = new Group()
  private zonesGroup = new Group()
  private ipGroup = new Group()
  private integrityGroup = new Group()
  private moveGroup = new Group()
  private assaultGroup = new Group()
  private fireGroup = new Group()

  private objectiveMarkers = new Map<string, Mesh>()
  private zoneMeshes = new Map<SideId, Mesh>()
  private ipMarks = new Map<string, Mesh>()
  private integrityLine: Line | null = null
  private moveRing: Line | null = null
  private moveLabel: CSS2DObject | null = null
  private assaultPaths = new Map<string, { line: Line; dot: Mesh }>()
  private firePaths = new Map<string, { line: Line; label: CSS2DObject }>()

  constructor() {
    this.group.name = 'stargrunt-overlays'
    this.group.add(this.zonesGroup, this.objectivesGroup, this.ipGroup, this.integrityGroup, this.moveGroup, this.assaultGroup, this.fireGroup)
  }

  update(state: GameState, opts: StargruntOverlaysOptions): void {
    this.updateObjectives(state, opts)
    this.updateDeploymentZones(state, opts)
    this.updateInPosition(state, opts)
    this.updateIntegrity(state, opts)
    this.updateMoveGhost(state, opts)
    this.updateAssault(opts)
    this.updateFire(state, opts)
  }

  private updateObjectives(state: GameState, opts: StargruntOverlaysOptions): void {
    const live = new Set<string>()
    for (const objective of state.setup.table.objectives) {
      live.add(objective.id)
      let mesh = this.objectiveMarkers.get(objective.id)
      if (!mesh) {
        mesh = new Mesh(new CylinderGeometry(OBJECTIVE_RADIUS, OBJECTIVE_RADIUS, OBJECTIVE_HEIGHT, 24), new MeshStandardMaterial({ color: NEUTRAL, roughness: 0.7 }))
        this.objectivesGroup.add(mesh)
        this.objectiveMarkers.set(objective.id, mesh)
      }
      const held = state.objectives[objective.id]?.heldBy ?? null
      const y = opts.heightAt(objective.position) + OBJECTIVE_HEIGHT / 2
      mesh.position.set(objective.position.x, y, objective.position.y)
      ;(mesh.material as MeshStandardMaterial).color.setHex(held ? sideColorOf(held) : NEUTRAL)
      setTooltip(mesh, `Objective, value ${objective.value}${held ? `, held by ${state.sides[held].name}` : ''}`)
    }
    for (const [id, mesh] of this.objectiveMarkers) {
      if (live.has(id)) continue
      this.objectivesGroup.remove(mesh)
      disposeTree(mesh)
      this.objectiveMarkers.delete(id)
    }
  }

  /** Where each side may set up (p. 14): a translucent band across the table's own width, read off `inDeploymentZone` itself. */
  private updateDeploymentZones(state: GameState, opts: StargruntOverlaysOptions): void {
    this.zonesGroup.visible = state.phase === 'deployment'
    if (state.phase !== 'deployment') return
    for (const side of state.setup.sides) {
      const band = deploymentBand(state.setup, side.id)
      let mesh = this.zoneMeshes.get(side.id)
      if (!band) {
        if (mesh) mesh.visible = false
        continue
      }
      if (!mesh) {
        mesh = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial({ color: sideColorOf(side.id), transparent: true, opacity: 0.12, roughness: 1, side: DoubleSide, depthWrite: false }))
        mesh.rotation.x = -Math.PI / 2
        this.zonesGroup.add(mesh)
        this.zoneMeshes.set(side.id, mesh)
      }
      mesh.visible = true
      const width = state.setup.table.width
      const depth = band.y1 - band.y0
      const centre = { x: width / 2, y: (band.y0 + band.y1) / 2 }
      mesh.scale.set(width, depth, 1)
      mesh.position.set(centre.x, opts.heightAt(centre) + LIFT, centre.y)
      setTooltip(mesh, `${side.name}'s deployment zone`)
    }
  }

  /** p. 13: a unit that spent an action going into position gets a small ground mark at its squad centre, alongside its pennant's own "IP" chip. */
  private updateInPosition(state: GameState, opts: StargruntOverlaysOptions): void {
    const live = new Set<string>()
    for (const unit of Object.values(state.units)) {
      if (!unit.inPosition) continue
      const figs = figuresOf(state, unit).filter(fit)
      if (figs.length === 0) continue
      live.add(unit.id)
      let mesh = this.ipMarks.get(unit.id)
      if (!mesh) {
        mesh = new Mesh(new CylinderGeometry(0, 0.16, 0.22, 4), new MeshStandardMaterial({ color: IP_COLOR, emissive: IP_COLOR, emissiveIntensity: 0.5, roughness: 0.5 }))
        this.ipGroup.add(mesh)
        this.ipMarks.set(unit.id, mesh)
      }
      const centre = unitCentre(figs.map((f) => f.position))
      mesh.position.set(centre.x, opts.heightAt(centre) + 0.11, centre.y)
      setTooltip(mesh, `${unit.name} — in position (p. 13)`)
    }
    for (const [id, mesh] of this.ipMarks) {
      if (live.has(id)) continue
      this.ipGroup.remove(mesh)
      disposeTree(mesh)
      this.ipMarks.delete(id)
    }
  }

  /** p. 11: the selected squad's own dashed circle when its figures fit inside one 6" span, else the 2" chain linking them — `map/figures.tsx`'s own `IntegrityMarks`. */
  private updateIntegrity(state: GameState, opts: StargruntOverlaysOptions): void {
    const unit = opts.selectedUnitId ? state.units[opts.selectedUnitId] : null
    const positions = unit ? figuresOf(state, unit).filter(fit).map((f) => f.position) : []
    if (!unit || positions.length < 2) {
      if (this.integrityLine) this.integrityLine.visible = false
      return
    }
    const ok = isInIntegrity(positions)
    const circle = minEnclosingCircle(positions)
    const fits = circle.radius * 2 <= 6 + 1e-6
    const ring: Point[] = fits
      ? Array.from({ length: 40 }, (_, i) => {
          const a = (i / 40) * Math.PI * 2
          return { x: circle.centre.x + Math.cos(a) * 3, y: circle.centre.y + Math.sin(a) * 3 }
        })
      : []
    const points = fits
      ? drapedRing(ring, opts.heightAt, LIFT)
      : (() => {
          const segs: Vector3[] = []
          for (let i = 0; i < positions.length; i++)
            for (let j = i + 1; j < positions.length; j++) {
              const dx = positions[i]!.x - positions[j]!.x
              const dy = positions[i]!.y - positions[j]!.y
              if (Math.hypot(dx, dy) <= 2 + 1e-6) segs.push(...drapedSegment(positions[i]!, positions[j]!, opts.heightAt, LIFT, 2))
            }
          return segs
        })()
    if (!this.integrityLine) {
      this.integrityLine = new Line(new BufferGeometry(), new LineBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.85 }))
      this.integrityGroup.add(this.integrityLine)
    }
    this.integrityLine.visible = points.length > 0
    if (points.length > 0) {
      this.integrityLine.geometry.setFromPoints(points)
      ;(this.integrityLine.material as LineBasicMaterial).color.setHex(ok ? OK_COLOR : BROKEN_COLOR)
    }
  }

  /** No live destination to draw to (see this file's own header) — just the squad's own reach for the move under way, draped on the ground around its current position. */
  private updateMoveGhost(state: GameState, opts: StargruntOverlaysOptions): void {
    const ghost = opts.moveGhost
    const figs = ghost ? ghost.figureIds.map((id) => state.figures[id]).filter((f): f is FigureState => !!f) : []
    if (!ghost || figs.length === 0 || ghost.inches === null) {
      if (this.moveRing) this.moveRing.visible = false
      if (this.moveLabel) this.moveLabel.visible = false
      return
    }
    const origin = unitCentre(figs.map((f) => f.position))
    const ring = reachPolygon(origin, ghost.inches, ghost.mobility, state.setup.table.terrain)
    if (!this.moveRing) {
      this.moveRing = new Line(new BufferGeometry(), new LineBasicMaterial({ color: THRUST_COLOR, transparent: true, opacity: 0.75, toneMapped: false }))
      this.moveGroup.add(this.moveRing)
    }
    this.moveRing.visible = ring.length > 0
    if (ring.length > 0) this.moveRing.geometry.setFromPoints(drapedRing(ring, opts.heightAt, LIFT))
    if (!this.moveLabel) {
      this.moveLabel = makeLabel('', 'sg3d-move-label')
      this.moveGroup.add(this.moveLabel)
    }
    this.moveLabel.visible = true
    this.moveLabel.position.set(origin.x, opts.heightAt(origin) + 0.6, origin.y)
    const text = ghost.mode === 'combat' ? `combat move — up to ${ghost.inches.toFixed(1)}″ (rolled, doubled)` : `${ghost.inches.toFixed(1)}″ ${ghost.mode}`
    setLabel(this.moveLabel, text)
  }

  /** K1: each charging figure's own default contact path (`planAssault`'s), coloured by how much of a combat-move roll it needs to reach base contact. */
  private updateAssault(opts: StargruntOverlaysOptions): void {
    const preview = opts.assaultPreview
    const live = new Set<string>()
    if (preview) {
      preview.moves.forEach((m, i) => {
        const to = m.path[m.path.length - 1]
        const from = m.path[0]
        if (!from || !to) return
        live.add(m.figureId)
        const cost = preview.costs[i] ?? Number.POSITIVE_INFINITY
        const color = cost <= preview.maxOneRoll + 1e-6 ? REACH1_COLOR : cost <= 2 * preview.maxOneRoll + 1e-6 ? REACH2_COLOR : FAR_COLOR
        let entry = this.assaultPaths.get(m.figureId)
        if (!entry) {
          const line = new Line(new BufferGeometry(), new LineBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.85 }))
          const dot = new Mesh(new CylinderGeometry(0.14, 0.14, 0.03, 16), new MeshStandardMaterial({ roughness: 0.5 }))
          this.assaultGroup.add(line, dot)
          entry = { line, dot }
          this.assaultPaths.set(m.figureId, entry)
        }
        let points: Vector3[] = []
        for (let k = 0; k < m.path.length - 1; k++) points = points.concat(drapedSegment(m.path[k]!, m.path[k + 1]!, opts.heightAt, LIFT, 6))
        entry.line.geometry.setFromPoints(points.length > 0 ? points : drapedSegment(from, to, opts.heightAt, LIFT))
        ;(entry.line.material as LineBasicMaterial).color.setHex(color)
        entry.dot.position.set(to.x, opts.heightAt(to) + 0.02, to.y)
        ;(entry.dot.material as MeshStandardMaterial).color.setHex(color)
      })
    }
    for (const [id, entry] of this.assaultPaths) {
      if (live.has(id)) continue
      this.assaultGroup.remove(entry.line, entry.dot)
      disposeTree(entry.line)
      disposeTree(entry.dot)
      this.assaultPaths.delete(id)
    }
  }

  /** The fire line to each enemy unit under consideration, coloured by whether the shot can be made, with the odds along it — the engine's own verdict, never one of this view's making. */
  private updateFire(state: GameState, opts: StargruntOverlaysOptions): void {
    const targeting = opts.targeting
    const live = new Set<string>()
    if (targeting) {
      const firer = state.units[targeting.firingUnitId]
      const from = firer ? unitCentre(figuresOf(state, firer).filter(fit).map((f) => f.position)) : null
      if (from) {
        for (const [unitId, verdict] of Object.entries(targeting.verdicts)) {
          const target = state.units[unitId]
          if (!target) continue
          const figs = figuresOf(state, target).filter(fit)
          if (figs.length === 0) continue
          live.add(unitId)
          const to = unitCentre(figs.map((f) => f.position))
          let entry = this.firePaths.get(unitId)
          if (!entry) {
            const line = new Line(new BufferGeometry(), new LineBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.85 }))
            const label = makeLabel('', 'sg3d-fire-label')
            this.fireGroup.add(line, label)
            entry = { line, label }
            this.firePaths.set(unitId, entry)
          }
          entry.line.geometry.setFromPoints(drapedSegment(from, to, opts.heightAt, LIFT))
          ;(entry.line.material as LineBasicMaterial).color.setHex(verdict.ok ? THRUST_COLOR : 0x5d6a86)
          // Several targets fanned from one firer can put two lines' own midpoints close together on screen
          // even though the lines themselves diverge — a per-target fraction along the line and a small
          // height stagger (both stable on the unit's own id) pull their labels apart without needing
          // `three/ships.ts`'s own full label-declutter pass for what is at most a handful of fire lines.
          const t = 0.4 + (hash(unitId) % 100) / 100 / 2.5
          const mid = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
          const lift = 0.4 + (hash(unitId) % 5) * 0.16
          entry.label.position.set(mid.x, opts.heightAt(mid) + lift, mid.y)
          setLabel(entry.label, verdict.ok ? (verdict.odds ?? '') : (verdict.reason ?? 'no shot'), `sg3d-fire-label${verdict.ok ? '' : ' is-refused'}`)
        }
      }
    }
    for (const [id, entry] of this.firePaths) {
      if (live.has(id)) continue
      this.fireGroup.remove(entry.line, entry.label)
      disposeTree(entry.line)
      entry.label.element.remove()
      this.firePaths.delete(id)
    }
  }

  dispose(): void {
    disposeTree(this.group)
    this.objectiveMarkers.clear()
    this.zoneMeshes.clear()
    this.ipMarks.clear()
    this.integrityLine = null
    this.moveRing = null
    this.moveLabel = null
    this.assaultPaths.clear()
    this.firePaths.clear()
  }
}
