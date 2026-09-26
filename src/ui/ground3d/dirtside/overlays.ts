/**
 * DIRTSIDE'S OWN FILE — what the player is about to do or has just done,
 * draped on the ground instead of drawn flat: `ui/dirtside/map/overlays.tsx`
 * and `map/marks.tsx`'s own list, minus the pieces that only ever followed
 * the 2D map's own mouse pointer continuously (the rubber-band move ghost,
 * the orbital-aim/landing previews, the deploy ghost, the tape measure) —
 * `GroundScene` has no callback that hands a shell the raycasted board point
 * on every pointer move, only on release (`onClickBoard`) and while hovering
 * a tooltip-tagged mesh (`onHoverText`); adding one is GROUND's file to
 * change, not this one's (say so in the report, don't touch `GroundScene.ts`).
 * Everything state already knows once a click has committed it — the
 * plotted path, a fired volley's verdicts, a strike called, a craft placed —
 * still lights up here exactly as the 2D map shows it.
 *
 * Same shape as `units.ts`'s own contract: `new`, `.group`, `.update(state,
 * opts)`, `.dispose()`. Nothing here is `Pickable`, same as the 2D map's own
 * overlays.
 */
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { BoxGeometry, BufferGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Line, LineBasicMaterial, LineLoop, Mesh, MeshStandardMaterial, RingGeometry, Vector3 } from 'three'
import type { Going } from '../../../dirtside/data/mobility'
import { INTEGRITY, LANDING_CLEARANCE, functional, inDeploymentZone, isOrganised } from '../../../dirtside/table/game'
import { unitKind } from '../../../dirtside/table/tableFire'
import { NUKE_EXCLUSION, STRIKE_RADIUS } from '../../../dirtside/table/orbital'
import { bearing, distance, lineOfSight, onTable, pathCost, terrainAt } from '../../../dirtside/table/terrain'
import type { ElementState, GameState, Point, SideId } from '../../../dirtside/table/types'
import type { MoveBudget, RecentMark, TargetingOverlay } from '../../dirtside/TableMap'
import { TERRAIN_NAMES } from '../terrain'
import { deploymentBand, reachPolygon, splitByLegs } from './geometry'
import { disposeTree, setTooltip, type FrameContext, type Layer } from '../layer'
import { declutterLabels, makeLabel, setLabel, type DeclutterCandidate } from '../labels'
import { sideColorOf } from '../palette'
import { headingToYaw } from '../space'

export interface DirtsideOverlaysOptions {
  heightAt: (point: Point) => number
  selectedId: string | null
  plot: Point[]
  plotFrom: Point | null
  reach: number | null
  moveBudget: MoveBudget | null
  targeting: TargetingOverlay | null
  /** The pointer is over this element (`units.ts`'s own hover pick) — drives the fire-line-on-hover. */
  hoverElementId: string | null
  recent: RecentMark[]
  pendingLandings: Array<{ at: Point; label: string }>
  viewer: SideId | null
  /**
   * K1: the board point under the pointer (`GroundScene`'s own
   * `onPointerBoard`, read once a frame), for every preview below that
   * follows it in the 2D map — null once it is off the board, exactly like
   * the 2D map's own `onBoard && pointer` gate (`TableMap.tsx`).
   */
  pointer: Point | null
  /** An orbital aim being chosen: the beaten zone follows the pointer — `TableMapProps.aimPreview`. */
  aimPreview: { radius: number } | null
  /** A craft being placed: its 12" clearance follows the pointer — `TableMapProps.landingPreview`. */
  landingPreview: { label: string } | null
  /** R12: the ruler, planted with two clicks (`DirtsideView3D.tsx`'s own Measure tool) — its live end follows the pointer until `to` is set. */
  measure: { from: Point; to: Point | null } | null
}

const GOING_COLOR: Record<Going, number> = { easy: 0x6fd1ff, normal: 0xf2f4f8, poor: 0xf3c34c, difficult: 0xef7d3a, impassable: 0xcc3b3b }
const NEUTRAL = 0xd8c98a
const inches = (n: number) => `${n.toFixed(1)}"`
const fmt = (n: number) => n.toFixed(1)
/** A model's own footprint, table inches — `map/counters.tsx`'s own `VEHICLE_BASE`/`INFANTRY_BASE`, read here for the pointer-following ghosts (K1). */
const GHOST_DIMS = { vehicle: { w: 0.9, h: 1.3 }, infantry: { w: 0.9, h: 0.6 } }

function drape(p: Point, heightAt: (p: Point) => number, lift = 0.02): Vector3 {
  return new Vector3(p.x, heightAt(p) + lift, p.y)
}

/** A closed or open outline through table points, draped point by point (flat within one terrace, stepped between). */
function drapedLine(points: readonly Point[], heightAt: (p: Point) => number, color: number, opts: { closed?: boolean; dashed?: boolean; lift?: number } = {}): Line {
  const vs = points.map((p) => drape(p, heightAt, opts.lift))
  if (opts.closed && vs.length > 0) vs.push(vs[0]!.clone())
  const geo = new BufferGeometry().setFromPoints(vs)
  const mat = new LineBasicMaterial({ color })
  return new Line(geo, mat)
}

/** A flat translucent fill for a polygon already draped (assumes it is roughly planar — a reach ring, a deployment band). */
function fillPolygon(points: readonly Vector3[], color: number, opacity: number): Mesh {
  const geo = new BufferGeometry()
  const pos: number[] = []
  for (let i = 1; i < points.length - 1; i++) {
    pos.push(points[0]!.x, points[0]!.y, points[0]!.z, points[i]!.x, points[i]!.y, points[i]!.z, points[i + 1]!.x, points[i + 1]!.y, points[i + 1]!.z)
  }
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  return new Mesh(geo, new MeshStandardMaterial({ color, transparent: true, opacity, side: DoubleSide, depthWrite: false, roughness: 1 }))
}

function ringOutline(radius: number, color: number, segments = 48): LineLoop {
  const pts: Vector3[] = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push(new Vector3(Math.sin(a) * radius, 0, -Math.cos(a) * radius))
  }
  return new LineLoop(new BufferGeometry().setFromPoints(pts), new LineBasicMaterial({ color }))
}

const CRAFT_SHAPE: Record<'dropship' | 'lander', { len: number; wid: number }> = { dropship: { len: 1.5, wid: 1.0 }, lander: { len: 1.0, wid: 0.9 } }

function craftMesh(kind: 'dropship' | 'lander', side: SideId | null): Group {
  const g = new Group()
  const dims = CRAFT_SHAPE[kind]
  const hull = new Mesh(new ConeGeometry(dims.wid * 0.5, dims.len, 4), new MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.55, metalness: 0.2 }))
  hull.rotation.x = Math.PI / 2
  hull.rotation.z = Math.PI / 4
  hull.position.y = dims.len * 0.28
  g.add(hull)
  if (side) {
    const band = new Mesh(new CylinderGeometry(dims.wid * 0.36, dims.wid * 0.36, 0.06, 4), new MeshStandardMaterial({ color: sideColorOf(side), roughness: 0.6 }))
    band.rotation.x = Math.PI / 2
    band.rotation.z = Math.PI / 4
    band.position.y = dims.len * 0.18
    g.add(band)
  }
  return g
}

interface OrbitalMark {
  group: Group
  label: CSS2DObject
}

export class DirtsideOverlaysLayer implements Layer {
  readonly group = new Group()
  private objectives = new Map<string, { mesh: Mesh; label: CSS2DObject; flag: Group | null }>()
  private craft = new Map<string, Group>()
  private nukes = new Map<number, OrbitalMark>()
  private strikes = new Map<string, OrbitalMark>()
  private ephemeral = new Group()
  /** K2: every odds/verdict chip built this `update()`, re-measured and decluttered every frame in `tick()` — rebuilt from scratch each `update()` alongside `this.ephemeral` itself. */
  private declutterEntries: { element: HTMLElement; worldPos: Vector3; priority: number }[] = []

  constructor() {
    this.group.name = 'dirtside-overlays'
    this.group.add(this.ephemeral)
  }

  update(state: GameState, opts: DirtsideOverlaysOptions): void {
    this.updateObjectives(state, opts)
    this.updateCraft(state)
    this.updateOrbital(state, opts)
    disposeTree(this.ephemeral)
    this.ephemeral.clear()
    this.declutterEntries = []
    this.buildDeployment(state, opts)
    this.buildMovePlot(state, opts)
    this.buildTargeting(state, opts)
    this.buildRecent(state, opts)
    this.buildPendingLandings(state, opts)
    this.buildPointerPreviews(state, opts)
    this.buildMeasure(opts)
  }

  // ── Objectives (p. 17) ───────────────────────────────────────────────────

  private updateObjectives(state: GameState, opts: DirtsideOverlaysOptions): void {
    const live = new Set<string>()
    for (const objective of state.setup.table.objectives) {
      live.add(objective.id)
      let entry = this.objectives.get(objective.id)
      if (!entry) {
        const mesh = new Mesh(new CircleGeometry(0.5, 24), new MeshStandardMaterial({ color: NEUTRAL, roughness: 0.7 }))
        mesh.rotation.x = -Math.PI / 2
        const label = makeLabel('', 'dst3d-objective')
        this.group.add(mesh, label)
        entry = { mesh, label, flag: null }
        this.objectives.set(objective.id, entry)
      }
      const held = state.objectives[objective.id]?.heldBy ?? null
      const y = opts.heightAt(objective.position)
      entry.mesh.position.set(objective.position.x, y + 0.01, objective.position.y)
      ;(entry.mesh.material as MeshStandardMaterial).color.setHex(held ? sideColorOf(held) : NEUTRAL)
      const known = opts.viewer !== null && (objective.drawnBy === opts.viewer || held === opts.viewer)
      setLabel(entry.label, known ? String(objective.value) : '?', `dst3d-objective${held ? ` is-${held}` : ''}`)
      entry.label.position.set(objective.position.x, y + 0.3, objective.position.y)
      setTooltip(entry.mesh, `Objective${held ? `, held by ${state.sides[held].name}` : ''}${known ? `, worth ${objective.value}` : ''}`)
      if (held && !entry.flag) {
        const flag = new Group()
        const pole = new Mesh(new CylinderGeometry(0.015, 0.015, 0.5, 6), new MeshStandardMaterial({ color: 0x2c2819 }))
        pole.position.y = 0.25
        const banner = new Mesh(new ConeGeometry(0.16, 0.28, 3), new MeshStandardMaterial({ color: sideColorOf(held), roughness: 0.6 }))
        banner.rotation.z = Math.PI / 2
        banner.position.set(0.12, 0.42, 0)
        flag.add(pole, banner)
        this.group.add(flag)
        entry.flag = flag
      }
      if (!held && entry.flag) {
        this.group.remove(entry.flag)
        disposeTree(entry.flag)
        entry.flag = null
      }
      if (entry.flag) entry.flag.position.set(objective.position.x, y, objective.position.y)
    }
    for (const [id, entry] of this.objectives) {
      if (live.has(id)) continue
      this.group.remove(entry.mesh, entry.label)
      if (entry.flag) this.group.remove(entry.flag)
      disposeTree(entry.mesh)
      if (entry.flag) disposeTree(entry.flag)
      entry.label.element.remove()
      this.objectives.delete(id)
    }
  }

  // ── Interface craft on the ground (p. 43) ────────────────────────────────

  private updateCraft(state: GameState): void {
    const live = new Set<string>()
    for (const c of state.setup.craft ?? []) {
      const record = state.craft[c.id]
      if (!record?.position || record.status === 'lost') continue
      live.add(c.id)
      let mesh = this.craft.get(c.id)
      if (!mesh) {
        mesh = craftMesh(c.kind, c.side)
        this.group.add(mesh)
        this.craft.set(c.id, mesh)
      }
      mesh.position.set(record.position.x, 0, record.position.y)
      mesh.visible = true
      setTooltip(mesh, `${c.name}: ${c.kind === 'dropship' ? 'dropship' : 'assault lander'}, ${record.status === 'empty' ? 'unloaded' : 'loaded'}`)
    }
    for (const [id, mesh] of this.craft) {
      if (live.has(id)) continue
      this.group.remove(mesh)
      disposeTree(mesh)
      this.craft.delete(id)
    }
  }

  // ── Fire from orbit (pp. 38–40, More Thrust p. 17) ───────────────────────

  private updateOrbital(state: GameState, opts: DirtsideOverlaysOptions): void {
    const orbit = state.orbit
    const liveN = new Set<number>()
    const liveS = new Set<string>()
    if (orbit) {
      orbit.nukes.forEach((n, i) => {
        liveN.add(i)
        let mark = this.nukes.get(i)
        if (!mark) {
          const group = new Group()
          const crater = new Mesh(new CircleGeometry(0.6, 20), new MeshStandardMaterial({ color: 0x1c1a16, roughness: 1 }))
          crater.rotation.x = -Math.PI / 2
          group.add(crater)
          group.add(ringOutline(NUKE_EXCLUSION, 0xcc5a2a))
          const label = makeLabel(`FALLOUT · KEEP ${NUKE_EXCLUSION}" AWAY`, 'dst3d-chip is-warn')
          this.group.add(group, label)
          mark = { group, label }
          this.nukes.set(i, mark)
        }
        const y = opts.heightAt(n)
        mark.group.position.set(n.x, y + 0.01, n.y)
        mark.label.position.set(n.x, y + 0.35, n.y)
      })
      for (const st of orbit.strikes) {
        liveS.add(st.id)
        let mark = this.strikes.get(st.id)
        const r = STRIKE_RADIUS[st.attack]
        if (!mark) {
          const group = new Group()
          const zone = new Mesh(new CircleGeometry(r, 24), new MeshStandardMaterial({ color: 0x9b2f2f, transparent: true, opacity: 0.35, roughness: 1 }))
          zone.rotation.x = -Math.PI / 2
          group.add(zone)
          group.add(ringOutline(r, 0xcc3b3b))
          group.add(ringOutline(7, 0xcc3b3b))
          const label = makeLabel('', 'dst3d-chip is-ordnance')
          this.group.add(group, label)
          mark = { group, label }
          this.strikes.set(st.id, mark)
        }
        const y = opts.heightAt(st.aim)
        mark.group.position.set(st.aim.x, y + 0.012, st.aim.y)
        setLabel(mark.label, `${st.attack === 'pbm' ? 'ORTILLERY' : 'SHEAF'} · ${st.opponentActed ? 'DUE NOW' : 'INBOUND'}`)
        mark.label.position.set(st.aim.x, y + r * 0.4 + 0.2, st.aim.y)
      }
    }
    for (const [i, mark] of this.nukes) {
      if (liveN.has(i)) continue
      this.group.remove(mark.group, mark.label)
      disposeTree(mark.group)
      mark.label.element.remove()
      this.nukes.delete(i)
    }
    for (const [id, mark] of this.strikes) {
      if (liveS.has(id)) continue
      this.group.remove(mark.group, mark.label)
      disposeTree(mark.group)
      mark.label.element.remove()
      this.strikes.delete(id)
    }
  }

  // ── Deployment zones (p. 17) ─────────────────────────────────────────────

  private buildDeployment(state: GameState, opts: DirtsideOverlaysOptions): void {
    if (state.phase !== 'deployment') return
    const { width: W } = state.setup.table
    for (const side of ['north', 'south'] as SideId[]) {
      if (state.sides[side].ready) continue
      const band = deploymentBand((p) => inDeploymentZone(state.setup, side, p), state.setup.table.depth, W)
      if (!band) continue
      const corners: Point[] = [
        { x: 0, y: band.y0 },
        { x: W, y: band.y0 },
        { x: W, y: band.y1 },
        { x: 0, y: band.y1 },
      ]
      const draped = corners.map((p) => drape(p, opts.heightAt, 0.006))
      this.ephemeral.add(fillPolygon(draped, sideColorOf(side), 0.14))
      const inner = side === 'north' ? band.y1 : band.y0
      this.ephemeral.add(drapedLine([{ x: 0, y: inner }, { x: W, y: inner }], opts.heightAt, sideColorOf(side), { lift: 0.01 }))
    }
  }

  // ── The plotted move: waypoints, the path coloured by going, the reach ──

  private buildMovePlot(state: GameState, opts: DirtsideOverlaysOptions): void {
    const { plotFrom, plot, moveBudget, reach, heightAt } = opts
    if (!plotFrom) return
    const features = state.setup.table.terrain
    const path = [plotFrom, ...plot]
    if (plot.length > 0) {
      if (moveBudget) {
        const cost = pathCost(path, moveBudget.family, features, { amphibious: moveBudget.amphibious, travel: moveBudget.travel })
        const runs = splitByLegs(path, cost.legs)
        for (const run of runs) this.ephemeral.add(drapedLine(run.points, heightAt, GOING_COLOR[run.going], { lift: 0.03 }))
        if (cost.blockedAt) this.ephemeral.add(drapedLine([cost.blockedAt, path[path.length - 1]!], heightAt, GOING_COLOR.impassable, { lift: 0.03 }))
      } else {
        this.ephemeral.add(drapedLine(path, heightAt, GOING_COLOR.normal, { lift: 0.03 }))
      }
      for (const p of plot) {
        const dot = new Mesh(new CircleGeometry(0.09, 12), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }))
        dot.rotation.x = -Math.PI / 2
        dot.position.set(p.x, heightAt(p) + 0.03, p.y)
        this.ephemeral.add(dot)
      }
    }
    const last = path[path.length - 1]!
    if (moveBudget) {
      const cost = plot.length > 0 ? pathCost(path, moveBudget.family, features, { amphibious: moveBudget.amphibious, travel: moveBudget.travel }) : { factors: 0 }
      const left = moveBudget.left - cost.factors
      if (left > 0.05) {
        const polygon = reachPolygon(last, left, moveBudget.family, features, { amphibious: moveBudget.amphibious, travel: moveBudget.travel })
        if (polygon.length > 2) {
          const draped = polygon.map((p) => drape(p, heightAt, 0.015))
          this.ephemeral.add(fillPolygon(draped, 0x9fd1ff, 0.16))
          this.ephemeral.add(drapedLine(polygon, heightAt, 0x9fd1ff, { closed: true, lift: 0.02 }))
        }
      }
    } else if (reach !== null && reach > 0) {
      const ring = ringOutline(reach, 0x9fd1ff)
      ring.position.set(last.x, heightAt(last) + 0.02, last.y)
      this.ephemeral.add(ring)
    }
  }

  // ── Targeting: range bands, verdict rings, the hovered shot's fire line ──

  private buildTargeting(state: GameState, opts: DirtsideOverlaysOptions): void {
    const { targeting, heightAt, hoverElementId } = opts
    if (!targeting) return
    const firer = state.elements[targeting.firerId]
    if (!firer) return
    const fy = heightAt(firer.position) + 0.35
    const bands = (targeting.bands ?? []).filter((r, i, all) => r > 0 && all.indexOf(r) === i)
    bands.forEach((r, i) => {
      const ring = ringOutline(r, i === 0 ? 0xf2f4f8 : i === 1 ? 0xf3c34c : 0xef7d3a)
      ring.position.set(firer.position.x, heightAt(firer.position) + 0.02, firer.position.y)
      this.ephemeral.add(ring)
    })
    // Nearby elements (the same unit, parked close together) would stack their odds label on the very same
    // spot — bump each later one a little higher, the 3D counterpart of the 2D map's own `clearestSpot`.
    const oddsPlaced: Point[] = []
    for (const [id, v] of Object.entries(targeting.verdicts)) {
      const target = state.elements[id]
      if (!target || target.destroyed || target.aboard) continue
      const ring = ringOutline(target.vehicle ? 0.85 : 0.5, v.ok ? 0x3fae6a : 0x8a4a4a)
      ring.position.set(target.position.x, heightAt(target.position) + 0.03, target.position.y)
      this.ephemeral.add(ring)
      if (v.ok && v.odds) {
        const stack = oddsPlaced.filter((p) => distance(p, target.position) < 1.4).length
        oddsPlaced.push(target.position)
        const label = makeLabel(v.odds.split(' · ').pop() ?? v.odds, 'dst3d-chip is-ok')
        label.position.set(target.position.x, heightAt(target.position) + (target.vehicle ? 0.85 : 0.55) + stack * 0.24, target.position.y)
        this.ephemeral.add(label)
        // K2: kept over any other odds chip crowding the same spot when this is the hovered target, nearest-first otherwise.
        this.declutterEntries.push({ element: label.element, worldPos: label.position.clone(), priority: id === hoverElementId ? 0 : 2 })
      }
    }
    const hovered = hoverElementId ? state.elements[hoverElementId] : null
    const verdict = hovered ? targeting.verdicts[hovered.id] : undefined
    if (hovered && verdict) {
      const ty = heightAt(hovered.position) + 0.35
      const from = new Vector3(firer.position.x, fy, firer.position.y)
      const to = new Vector3(hovered.position.x, ty, hovered.position.y)
      const geo = new BufferGeometry().setFromPoints([from, to])
      this.ephemeral.add(new Line(geo, new LineBasicMaterial({ color: verdict.ok ? 0x3fae6a : 0xb5342a })))
      const mid = from.clone().lerp(to, 0.5)
      const text = verdict.ok ? `${inches(verdict.range ?? distance(firer.position, hovered.position))}${verdict.odds ? ` · ${verdict.odds}` : ''}` : `${inches(distance(firer.position, hovered.position))} · ${verdict.reason ?? 'no shot'}`
      const label = makeLabel(text, `dst3d-chip${verdict.ok ? ' is-ok' : ' is-warn'}`)
      label.position.copy(mid)
      this.ephemeral.add(label)
      // K2: the hovered target's own verdict chip never fades for crowding.
      this.declutterEntries.push({ element: label.element, worldPos: mid.clone(), priority: 0 })
    }
  }

  // ── What just happened: fading move trails and fire tracers ──────────────

  private buildRecent(_state: GameState, opts: DirtsideOverlaysOptions): void {
    const n = opts.recent.length
    opts.recent.forEach((m, i) => {
      const opacity = Math.max(0.25, 1 - (n - 1 - i) * 0.22)
      if (m.kind === 'move') {
        if (m.path.length < 2) return
        const line = drapedLine(m.path, opts.heightAt, sideColorOf(m.side), { lift: 0.02 })
        ;(line.material as LineBasicMaterial).transparent = true
        ;(line.material as LineBasicMaterial).opacity = opacity
        this.ephemeral.add(line)
      } else {
        const color = m.result === 'miss' ? 0x9aa0ac : m.result === 'kill' ? 0xcc3b3b : 0xe8a23a
        const from = drape(m.from, opts.heightAt, 0.35)
        const to = drape(m.to, opts.heightAt, 0.35)
        const geo = new BufferGeometry().setFromPoints([from, to])
        const mat = new LineBasicMaterial({ color, transparent: true, opacity })
        this.ephemeral.add(new Line(geo, mat))
        const burst = new Mesh(new RingGeometry(0.08, 0.18, 10), new MeshStandardMaterial({ color, transparent: true, opacity }))
        burst.position.copy(to)
        burst.rotation.x = -Math.PI / 2
        this.ephemeral.add(burst)
      }
    })
  }

  // ── Craft placed to come down this activation (p. 43) ────────────────────

  private buildPendingLandings(_state: GameState, opts: DirtsideOverlaysOptions): void {
    for (const l of opts.pendingLandings) {
      const y = opts.heightAt(l.at)
      const ring = ringOutline(12, 0xd8c98a)
      ring.position.set(l.at.x, y + 0.01, l.at.y)
      this.ephemeral.add(ring)
      const ghost = craftMesh('dropship', null)
      ghost.position.set(l.at.x, y, l.at.y)
      ghost.traverse((o) => {
        const mesh = o as Mesh
        if (!('material' in mesh) || !mesh.material) return
        const mat = mesh.material as MeshStandardMaterial
        mat.transparent = true
        mat.opacity = 0.5
      })
      this.ephemeral.add(ghost)
      const label = makeLabel(`${l.label} lands here`, 'dst3d-chip')
      label.position.set(l.at.x, y + 1.3, l.at.y)
      this.ephemeral.add(label)
    }
  }

  // ── Pointer-following previews (K1): everything the 2D map draws chasing
  // the mouse instead of a click — read from `GroundScene`'s own
  // `onPointerBoard`, drawn with the very same engine functions the 2D
  // map's `MoveGhost`/`AimPreview`/`LandingPreview`/`DeployGhost` call
  // (`pathCost`, `isOrganised`, `inDeploymentZone`, `terrainAt`,
  // `lineOfSight`, `onTable`) so every rule decision still lives there. ──

  private buildPointerPreviews(state: GameState, opts: DirtsideOverlaysOptions): void {
    const { pointer } = opts
    if (!pointer) return
    this.buildMoveGhost(state, opts, pointer)
    if (opts.aimPreview) this.buildAimPreview(opts, pointer, opts.aimPreview.radius)
    if (opts.landingPreview) this.buildLandingPreview(state, opts, pointer, opts.landingPreview.label)
    this.buildDeployGhost(state, opts, pointer)
  }

  /** R12: the ruler — a line with its length, exactly the 2D map's own `Tape`, except its live end is the pointer until a second click plants it. */
  private buildMeasure(opts: DirtsideOverlaysOptions): void {
    const { measure, heightAt } = opts
    if (!measure) return
    const to = measure.to ?? opts.pointer
    if (!to) return
    this.ephemeral.add(drapedLine([measure.from, to], heightAt, 0xefe6c8, { lift: 0.02 }))
    for (const p of [measure.from, to]) {
      const dot = new Mesh(new CircleGeometry(0.15, 16), new MeshStandardMaterial({ color: 0xefe6c8, roughness: 0.5 }))
      dot.rotation.x = -Math.PI / 2
      dot.position.set(p.x, heightAt(p) + 0.03, p.y)
      this.ephemeral.add(dot)
    }
    const mid = { x: (measure.from.x + to.x) / 2, y: (measure.from.y + to.y) / 2 }
    const label = makeLabel(inches(distance(measure.from, to)), 'dst3d-chip')
    label.position.set(mid.x, heightAt(mid) + 0.3, mid.y)
    this.ephemeral.add(label)
  }

  /** The move ghost's own last leg, from the last waypoint to the pointer, costed exactly `MoveGhost` costs it. */
  private buildMoveGhost(state: GameState, opts: DirtsideOverlaysOptions, pointer: Point): void {
    const { moveBudget, plotFrom, plot, heightAt, hoverElementId, selectedId } = opts
    if (!moveBudget || !plotFrom || hoverElementId) return
    const selected = selectedId ? state.elements[selectedId] : null
    if (!selected) return
    const features = state.setup.table.terrain
    const path = [plotFrom, ...plot]
    const last = path[path.length - 1]!
    if (distance(last, pointer) < 0.3) return
    const cost = pathCost([...path, pointer], moveBudget.family, features, { amphibious: moveBudget.amphibious, travel: moveBudget.travel })
    const left = moveBudget.left - cost.factors
    const blocked = !!cost.blockedAt
    const ok = !blocked && left >= -1e-6
    const legEnd = blocked ? cost.blockedAt! : pointer
    this.ephemeral.add(drapedLine([last, legEnd], heightAt, ok ? 0x3fae6a : 0xcc3b3b, { lift: 0.03 }))
    if (blocked) this.ephemeral.add(drapedLine([cost.blockedAt!, pointer], heightAt, GOING_COLOR.impassable, { lift: 0.03 }))

    const y = heightAt(pointer)
    const dims = selected.vehicle ? GHOST_DIMS.vehicle : GHOST_DIMS.infantry
    const ghost = new Mesh(new BoxGeometry(dims.w, 0.05, dims.h), new MeshStandardMaterial({ color: sideColorOf(selected.sideId), transparent: true, opacity: ok ? 0.6 : 0.4, roughness: 0.6 }))
    ghost.position.set(pointer.x, y + 0.05, pointer.y)
    ghost.rotation.y = headingToYaw(bearing(last, pointer))
    this.ephemeral.add(ghost)

    const unit = state.units[selected.unitId]
    const organised = unit ? isOrganised(state, unit, { [selected.id]: pointer }) : true
    const leg = distance(last, pointer)
    const text = blocked
      ? `${inches(leg)} · ${TERRAIN_NAMES[cost.blockedBy ?? 'open'].toLowerCase()}: no way through`
      : left < -1e-6
        ? `${inches(leg)} · ${fmt(-left)} over`
        : `${inches(leg)} · ${fmt(left)} left`
    const below = y + (selected.vehicle ? 0.9 : 0.6)
    const label = makeLabel(text, `dst3d-chip ${ok ? 'is-ok' : 'is-warn'}`)
    label.position.set(pointer.x, below, pointer.y)
    this.ephemeral.add(label)
    if (!organised && ok && unit) {
      const warn = makeLabel(`leaves the unit scattered: keep within ${INTEGRITY[unitKind(state, unit)]}" of a unit-mate (p. 23)`, 'dst3d-chip is-warn')
      warn.position.set(pointer.x, below + 0.3, pointer.y)
      this.ephemeral.add(warn)
    }
  }

  /** An orbital aim being chosen (pp. 38–40): the beaten zone and the 7" it may stray, following the pointer. */
  private buildAimPreview(opts: DirtsideOverlaysOptions, pointer: Point, radius: number): void {
    const y = opts.heightAt(pointer)
    const zone = new Mesh(new CircleGeometry(radius, 24), new MeshStandardMaterial({ color: 0x9b2f2f, transparent: true, opacity: 0.3, roughness: 1 }))
    zone.rotation.x = -Math.PI / 2
    zone.position.set(pointer.x, y + 0.015, pointer.y)
    this.ephemeral.add(zone)
    const rim = ringOutline(radius, 0xcc3b3b)
    rim.position.set(pointer.x, y + 0.02, pointer.y)
    this.ephemeral.add(rim)
    const stray = ringOutline(7, 0xcc5a2a)
    stray.position.set(pointer.x, y + 0.012, pointer.y)
    this.ephemeral.add(stray)
    const label = makeLabel(`${inches(radius * 2)} BEATEN ZONE · MAY STRAY 7"`, 'dst3d-chip is-ordnance')
    label.position.set(pointer.x, y + radius * 0.4 + 0.3, pointer.y)
    this.ephemeral.add(label)
  }

  /** A craft being placed (p. 43): its 12" clearance following the pointer, amber with the reason where it may not come down — the engine still judges the landing. */
  private buildLandingPreview(state: GameState, opts: DirtsideOverlaysOptions, pointer: Point, label: string): void {
    const features = state.setup.table.terrain
    let problem: string | null = null
    let culprit: ElementState | null = null
    if (!onTable(pointer, state.setup.table)) problem = 'off the table'
    else {
      const ground = terrainAt(pointer, features)
      if (ground === 'open-water' || ground === 'river') problem = `cannot set down in ${TERRAIN_NAMES[ground].toLowerCase()}`
      else {
        culprit =
          Object.values(state.elements).find(
            (e) => e.sideId !== state.toAct && functional(e) && distance(e.position, pointer) < LANDING_CLEARANCE - 1e-9 && lineOfSight(e.position, pointer, features).clear,
          ) ?? null
        if (culprit) problem = `${culprit.name} is ${inches(distance(culprit.position, pointer))} away and can see it`
      }
    }
    const y = opts.heightAt(pointer)
    const ring = ringOutline(LANDING_CLEARANCE, problem ? 0xcc5a2a : 0xd8c98a)
    ring.position.set(pointer.x, y + 0.01, pointer.y)
    this.ephemeral.add(ring)
    if (culprit) this.ephemeral.add(drapedLine([pointer, culprit.position], opts.heightAt, 0xcc5a2a, { lift: 0.35 }))
    const craft = state.setup.craft?.find((c) => c.name === label)
    const ghost = craftMesh(craft?.kind ?? 'dropship', null)
    ghost.position.set(pointer.x, y, pointer.y)
    ghost.traverse((o) => {
      const mesh = o as Mesh
      if (!('material' in mesh) || !mesh.material) return
      const mat = mesh.material as MeshStandardMaterial
      mat.transparent = true
      mat.opacity = 0.5
    })
    this.ephemeral.add(ghost)
    const chip = makeLabel(problem ? `${label}: ${problem}` : `${label} lands here`, `dst3d-chip${problem ? ' is-warn' : ''}`)
    chip.position.set(pointer.x, y + 1.3, pointer.y)
    this.ephemeral.add(chip)
  }

  /** The selected element's deploy ghost (p. 17): inside its own zone or not, following the pointer. */
  private buildDeployGhost(state: GameState, opts: DirtsideOverlaysOptions, pointer: Point): void {
    const selected = opts.selectedId ? state.elements[opts.selectedId] : null
    if (!selected || opts.hoverElementId || opts.plotFrom) return
    const deploying = state.phase === 'deployment' && !selected.destroyed && !state.sides[selected.sideId].ready && !(state.setup.aiSides ?? []).includes(selected.sideId)
    if (!deploying) return
    const ok = inDeploymentZone(state.setup, selected.sideId, pointer)
    const unit = state.units[selected.unitId]
    const organised = !unit || isOrganised(state, unit, { [selected.id]: pointer })
    const y = opts.heightAt(pointer)
    const dims = selected.vehicle ? GHOST_DIMS.vehicle : GHOST_DIMS.infantry
    const mesh = new Mesh(new BoxGeometry(dims.w, 0.05, dims.h), new MeshStandardMaterial({ color: sideColorOf(selected.sideId), transparent: true, opacity: ok ? 0.6 : 0.35, roughness: 0.6 }))
    mesh.position.set(pointer.x, y + 0.05, pointer.y)
    mesh.rotation.y = headingToYaw(selected.sideId === 'north' ? 180 : 0)
    this.ephemeral.add(mesh)
    const below = y + (selected.vehicle ? 0.9 : 0.6)
    if (!ok) {
      const chip = makeLabel('outside the deployment zone', 'dst3d-chip is-warn')
      chip.position.set(pointer.x, below, pointer.y)
      this.ephemeral.add(chip)
    } else if (!organised && unit) {
      const chip = makeLabel(`too far from its unit: keep within ${INTEGRITY[unitKind(state, unit)]}" of a unit-mate (p. 23)`, 'dst3d-chip is-warn')
      chip.position.set(pointer.x, below, pointer.y)
      this.ephemeral.add(chip)
    }
  }

  /** K2: the odds/verdict chips built this `update()`, kept by priority (the hovered target, nearest first) and faded the rest. */
  tick(frame: FrameContext): void {
    const candidates: DeclutterCandidate[] = this.declutterEntries.map((e) => ({ element: e.element, priority: e.priority, distance: frame.camera.position.distanceTo(e.worldPos) }))
    declutterLabels(candidates, frame.hostTop)
  }

  dispose(): void {
    disposeTree(this.group)
    this.declutterEntries = []
    // Detach every child, then put the one persistent sub-group back — left
    // attached, React StrictMode's dev-only double mount (a fresh
    // `GroundScene` built right after this layer's own `dispose()`, reusing
    // this same persisted layer instance) would see empty maps and add a
    // fresh mesh/label for every live objective/craft/strike right alongside
    // these stale, already-disposed ones (R13).
    this.group.clear()
    this.group.add(this.ephemeral)
    for (const e of this.objectives.values()) {
      e.label.element.remove()
    }
    for (const m of this.nukes.values()) m.label.element.remove()
    for (const m of this.strikes.values()) m.label.element.remove()
    this.objectives.clear()
    this.craft.clear()
    this.nukes.clear()
    this.strikes.clear()
  }
}
