/**
 * DIRTSIDE'S OWN FILE — the real 6mm elements: a model by mobility and size
 * class (`models.ts`) standing on `heightAt`, its side shown the way the 2D
 * counter shows it (a side-coloured base pad under an ink-dark silhouette,
 * `ui/dirtside/map/counters.tsx`'s own idea), marked up with the same
 * earthworks, pips and command pennants `ui/dirtside/map/marks.tsx` draws
 * flat — raised here and draped on the ground instead. Kept to the shape
 * `DirtsideView3D.tsx` and `GroundScene` both call (see the file's own
 * header before this rewrite, still true): `new`, `.group`, `.update`,
 * `.pickables()`, `.drawnPosition(id)`, `.dispose()`.
 */
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { BoxGeometry, CircleGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, Object3D, RingGeometry, SphereGeometry, Vector3 } from 'three'
import { CONFIDENCE_LABELS } from '../../../dirtside/table/confidence'
import type { ActivationState, ElementState, Point, UnitState } from '../../../dirtside/table/types'
import { hashId } from '../geometry'
import { disposeTree, setTooltip, tagPickable, type FrameContext, type Layer } from '../layer'
import { declutterLabels, makeLabel, setLabel, type DeclutterCandidate } from '../labels'
import { sideColorOf } from '../palette'
import { headingToYaw } from '../space'
import { buildHoverGlow, buildInfantryModel, buildVehicleModel, sizeScaleOf } from './models'

export interface DirtsideUnitsOptions {
  heightAt: (point: Point) => number
  selectedId: string | null
  /** The unit currently activated, for the pips/pennant "spent" look. */
  activeUnitId: string | null
  /** An element hovered — in 3D, that means the pointer is over its own model. */
  hoverElementId: string | null
  /** Elements named in the volley being built (`targets`). */
  targetIds: ReadonlySet<string>
  /** The element that just moved, offered opportunity fire (`highlight`). */
  highlightId: string | null
  /** A targeting verdict per element id, when a shot is being planned. */
  verdicts: Record<string, boolean> | null
  units: Record<string, UnitState>
  /** Unit code by unit id (`unitCodes`). */
  codes: Record<string, string>
  activation: ActivationState | null
}

const QUALITY_LETTER = { green: 'G', regular: 'R', veteran: 'V' } as const

function pennantOffset(vehicle: boolean): Vector3 {
  return new Vector3(0, vehicle ? 0.62 : 0.42, vehicle ? -0.3 : -0.14)
}

interface Entry {
  root: Group
  vehicle: boolean
  hoverBase: number
  height: number
  rotor: Mesh | null
  basePad: Mesh
  hull: Group
  glow: Mesh | null
  status: Group
  tag: CSS2DObject
  pips: CSS2DObject
  wreckMade: boolean
  sideId: string
  unitId: string
  x: number
  z: number
  facing: number
  dugIn: boolean
  posture: string
  evasive: boolean
}

export class DirtsideUnitsLayer implements Layer {
  readonly group = new Group()
  private entries = new Map<string, Entry>()
  private pennants = new Map<string, CSS2DObject>()
  private clock = 0
  /** Latest values from `update()`'s own `opts`, read back by `tick()`'s declutter pass (K2) — a frame can land between two `update()` calls. */
  private selectedId: string | null = null
  private hoverElementId: string | null = null

  constructor() {
    this.group.name = 'dirtside-units'
  }

  update(elements: Record<string, ElementState>, opts: DirtsideUnitsOptions): void {
    this.selectedId = opts.selectedId
    this.hoverElementId = opts.hoverElementId
    const live = new Set<string>()
    for (const el of Object.values(elements)) {
      if (el.aboard) continue
      live.add(el.id)
      let entry = this.entries.get(el.id)
      if (!entry) entry = this.spawn(el)
      this.place(entry, el, opts)
      this.mark(entry, el, opts)
    }
    for (const [id, entry] of this.entries) {
      if (live.has(id)) continue
      this.teardown(entry)
      this.entries.delete(id)
    }
    this.updatePennants(elements, opts)
  }

  private spawn(el: ElementState): Entry {
    const root = new Group()
    root.name = `element:${el.id}`
    const vehicle = !!el.vehicle
    const base = vehicle ? Math.max(0.34, 0.28 * sizeScaleOf(el.vehicle!.size)) : 0.24
    const basePad = new Mesh(new CircleGeometry(base, 16), new MeshStandardMaterial({ color: sideColorOf(el.sideId), roughness: 0.85 }))
    basePad.rotation.x = -Math.PI / 2
    basePad.position.y = 0.004
    root.add(basePad)

    const hull = new Group()
    let rotor: Mesh | null = null
    let hoverBase = 0
    let height = 0.3
    let glow: Mesh | null = null
    if (vehicle) {
      const built = buildVehicleModel(el.vehicle!)
      hull.add(built.root)
      rotor = built.rotor
      hoverBase = built.shape.hover
      height = built.height + hoverBase
      if (built.shape.gear === 'grav') {
        glow = buildHoverGlow(base * 1.3)
        root.add(glow)
      }
      setTooltip(root, built.shape.label)
    } else if (el.infantry) {
      const built = buildInfantryModel(el.infantry)
      hull.add(built.root)
      height = built.height
      setTooltip(root, `${el.infantry.cavalry ? 'mounted ' : ''}${el.infantry.troops} ${el.infantry.team} team`)
    }
    root.add(hull)
    tagPickable(root, el.id)

    const status = new Group()
    root.add(status)

    const tag = makeLabel('', 'dst3d-tag')
    tag.visible = false
    root.add(tag)
    const pips = makeLabel('', 'dst3d-pips')
    pips.visible = false
    root.add(pips)

    this.group.add(root)
    const entry: Entry = { root, vehicle, hoverBase, height, rotor, basePad, hull, glow, status, tag, pips, wreckMade: false, sideId: el.sideId, unitId: el.unitId, x: el.position.x, z: el.position.y, facing: el.facing, dugIn: false, posture: 'none', evasive: false }
    this.entries.set(el.id, entry)
    return entry
  }

  private place(entry: Entry, el: ElementState, opts: DirtsideUnitsOptions): void {
    const ground = opts.heightAt(el.position)
    entry.root.position.set(el.position.x, ground, el.position.y)
    entry.root.rotation.y = headingToYaw(el.facing)
    entry.x = el.position.x
    entry.z = el.position.y
    entry.facing = el.facing
    entry.hull.position.y = el.destroyed ? 0 : entry.hoverBase
    if (entry.glow) entry.glow.visible = !el.destroyed
  }

  private mark(entry: Entry, el: ElementState, opts: DirtsideUnitsOptions): void {
    if (el.destroyed) {
      if (!entry.wreckMade) this.wreck(entry, el)
      entry.tag.visible = false
      entry.pips.visible = false
      entry.status.visible = false
      return
    }
    entry.hull.rotation.set(0, 0, 0)
    const selected = opts.selectedId === el.id
    const active = opts.activeUnitId === el.unitId
    const hovered = opts.hoverElementId === el.id
    const targeted = opts.targetIds.has(el.id)
    const highlighted = opts.highlightId === el.id
    const verdict = opts.verdicts?.[el.id]

    this.ring(entry, 'select', selected, sideColorOf(el.sideId), 1.15)
    this.ring(entry, 'active', active && !selected, 0xffffff, 1.05)
    this.ring(entry, 'hover', hovered && !selected && !active, 0xd8dce4, 1.0)
    this.ring(entry, 'target', targeted, 0xe8543a, 1.3)
    this.ring(entry, 'highlight', highlighted, 0xf0a53a, 1.5)
    if (verdict !== undefined) this.ring(entry, 'verdict', true, verdict ? 0x3fae6a : 0x8a4a4a, 1.22)
    else this.ring(entry, 'verdict', false, 0, 1)
    ;(entry.basePad.material as MeshStandardMaterial).opacity = 1
    ;(entry.basePad.material as MeshStandardMaterial).transparent = false

    this.earthworks(entry, el, opts)

    const unit = opts.units[el.unitId]
    const code = opts.codes[el.unitId] ?? ''
    const index = unit ? unit.elementIds.indexOf(el.id) + 1 : 0
    const named = selected || active || hovered || (opts.activation?.unitId === el.unitId)
    entry.tag.visible = named
    if (named) {
      setLabel(entry.tag, `${code}·${index}`)
      entry.tag.position.set(0, entry.height + 0.16, 0)
    }

    const pipParts: string[] = []
    const record = opts.activation && el.unitId === opts.activation.unitId ? opts.activation.elements[el.id] : undefined
    if (record) {
      pipParts.push(`<span class="is-move${record.moved ? ' is-spent' : ''}">M</span>`)
      pipParts.push(`<span class="is-fire${record.fired ? ' is-spent' : ''}">F</span>`)
    }
    if (el.damaged) pipParts.push('<span class="is-damaged">D</span>')
    if (el.immobilised) pipParts.push('<span class="is-immobilised">I</span>')
    if (el.systemsDown) pipParts.push('<span class="is-systems">S</span>')
    entry.pips.visible = pipParts.length > 0
    if (pipParts.length > 0) {
      if (entry.pips.element.innerHTML !== pipParts.join('')) entry.pips.element.innerHTML = pipParts.join('')
      entry.pips.position.set(0, entry.height + (named ? 0.32 : 0.16), 0)
    }
  }

  private ring(entry: Entry, key: string, on: boolean, color: number, scale: number): void {
    const name = `ring-${key}`
    let mesh = entry.status.children.find((c) => c.name === name) as Mesh | undefined
    if (!on) {
      if (mesh) mesh.visible = false
      return
    }
    const radius = (entry.vehicle ? 0.62 : 0.32) * scale
    if (!mesh) {
      mesh = new Mesh(new RingGeometry(radius * 0.86, radius, 24), new MeshStandardMaterial({ color, transparent: true, opacity: 0.85, side: DoubleSide, depthWrite: false }))
      mesh.name = name
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = 0.01
      entry.status.add(mesh)
    }
    mesh.visible = true
    ;(mesh.material as MeshStandardMaterial).color.setHex(color)
  }

  private earthworks(entry: Entry, el: ElementState, opts: DirtsideUnitsOptions): void {
    const unit = opts.units[el.unitId]
    const evasive = !!unit?.evasive
    const changed = entry.dugIn !== el.dugIn || entry.posture !== el.posture || entry.evasive !== evasive
    if (!changed && entry.status.getObjectByName('earth')) return
    entry.dugIn = el.dugIn
    entry.posture = el.posture
    entry.evasive = evasive
    let group = entry.status.getObjectByName('earth') as Group | undefined
    if (group) {
      disposeTree(group)
      entry.status.remove(group)
    }
    group = new Group()
    group.name = 'earth'
    const r = entry.vehicle ? 0.58 : 0.34
    if (el.dugIn) {
      const berm = new Mesh(new RingGeometry(r * 0.72, r * 0.98, 16, 1, 0, Math.PI), new MeshStandardMaterial({ color: 0x7a6a45, roughness: 1 }))
      berm.rotation.x = -Math.PI / 2
      berm.position.y = 0.02
      group.add(berm)
    }
    if (el.posture !== 'none') {
      const berm = new Mesh(new RingGeometry(r * 0.55, r * 0.78, 16, 1, -Math.PI * 0.15, Math.PI * 1.3), new MeshStandardMaterial({ color: 0x6a5c3c, roughness: 1, opacity: el.posture === 'turret-down' ? 0.6 : 1, transparent: el.posture === 'turret-down' }))
      berm.rotation.x = -Math.PI / 2
      berm.position.y = 0.018
      group.add(berm)
    }
    if (evasive) {
      for (const dx of [-0.16, 0, 0.16]) {
        const streak = new Mesh(new BoxGeometry(0.03, 0.03, 0.3), new MeshStandardMaterial({ color: sideColorOf(el.sideId), roughness: 0.6 }))
        streak.position.set(dx, 0.03, r + 0.2)
        group.add(streak)
      }
    }
    entry.status.add(group)
  }

  private wreck(entry: Entry, el: ElementState): void {
    entry.wreckMade = true
    const seed = hashId(el.id)
    entry.hull.rotation.set(((seed % 100) / 100 - 0.5) * 0.5, 0, (((seed >> 8) % 100) / 100 - 0.5) * 0.45)
    entry.hull.traverse((o) => {
      const mesh = o as Mesh
      if (!('material' in mesh) || !mesh.material) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        const std = m as MeshStandardMaterial
        if (std.color) std.color.multiplyScalar(0.4)
      }
    })
    const cross = new Group()
    const armLen = entry.vehicle ? 0.7 : 0.4
    for (const rot of [0.78, -0.78]) {
      const arm = new Mesh(new BoxGeometry(0.05, 0.02, armLen), new MeshStandardMaterial({ color: 0xb5342a, roughness: 0.5 }))
      arm.position.y = entry.height * 0.5 + 0.05
      arm.rotation.y = rot
      cross.add(arm)
    }
    entry.hull.add(cross)
    if (entry.vehicle) {
      for (const [dx, dz, r] of [
        [0.15, 0, 0.09],
        [0.3, -0.05, 0.06],
      ] as const) {
        const puff = new Mesh(new SphereGeometry(r, 8, 6), new MeshStandardMaterial({ color: 0x555555, transparent: true, opacity: 0.5 }))
        puff.position.set(dx, entry.height + 0.2 + r, dz)
        entry.hull.add(puff)
      }
    }
    entry.tag.visible = false
    entry.pips.visible = false
    ;(entry.basePad.material as MeshStandardMaterial).opacity = 0.6
    ;(entry.basePad.material as MeshStandardMaterial).transparent = true
    setTooltip(entry.root, `${el.name} — knocked out`)
  }

  private updatePennants(elements: Record<string, ElementState>, opts: DirtsideUnitsOptions): void {
    const seen = new Set<string>()
    for (const [unitId, unit] of Object.entries(opts.units)) {
      const leaderId = unit.leaderElementId
      const leader = leaderId ? elements[leaderId] : undefined
      if (!leader || leader.destroyed || leader.aboard) continue
      seen.add(unitId)
      let pennant = this.pennants.get(unitId)
      if (!pennant) {
        pennant = makeLabel('', 'dst3d-pennant')
        this.pennants.set(unitId, pennant)
        this.group.add(pennant)
      }
      const active = opts.activeUnitId === unitId
      const code = opts.codes[unitId] ?? ''
      const lead = `${QUALITY_LETTER[unit.quality]}${unit.leadership}`
      const parts: string[] = [`<span class="flag${active ? ' is-active' : unit.activated ? ' is-spent' : ''}"><span class="lead">${lead}</span>${code}${unit.commandUnit ? '★' : ''}${unit.activated && !active ? ' ✓' : ''}</span>`]
      const confWord = unit.confidence === 'CO' || unit.confidence === 'ST' ? null : unit.confidence
      if (confWord) parts.push(`<span class="chip is-${confWord}">${CONFIDENCE_LABELS[unit.confidence].toUpperCase()}</span>`)
      if (unit.panic) parts.push('<span class="chip is-panic">PANIC</span>')
      if (unit.evasive) parts.push('<span class="chip is-evading">EVADING</span>')
      if (unit.underFire) parts.push('<span class="chip is-fire">UNDER FIRE</span>')
      const html = parts.join('')
      if (pennant.element.innerHTML !== html) pennant.element.innerHTML = html
      const pennantClass = `dst3d-pennant is-${unit.sideId}`
      if (pennant.element.className !== pennantClass) pennant.element.className = pennantClass
      const entry = this.entries.get(leaderId!)
      const off = pennantOffset(!!leader.vehicle)
      const ground = opts.heightAt(leader.position)
      pennant.position.set(leader.position.x + off.x, ground + (entry ? entry.height : 0.3) + off.y, leader.position.y + off.z)
    }
    for (const [unitId, pennant] of this.pennants) {
      if (seen.has(unitId)) continue
      pennant.element.remove()
      this.group.remove(pennant)
      this.pennants.delete(unitId)
    }
  }

  private teardown(entry: Entry): void {
    this.group.remove(entry.root)
    disposeTree(entry.root)
  }

  tick(frame: FrameContext): void {
    this.clock += frame.dt
    if (!frame.reducedMotion) {
      for (const entry of this.entries.values()) {
        if (entry.rotor) entry.rotor.rotation.y = this.clock * 22
      }
    }
    this.declutter(frame)
  }

  /** K2: every unit tag, its pips and every squad/unit pennant, kept by priority (the hovered element, the selected unit, nearest first) and faded the rest. */
  private declutter(frame: FrameContext): void {
    const candidates: DeclutterCandidate[] = []
    for (const [id, entry] of this.entries) {
      const distance = frame.camera.position.distanceTo(entry.root.position)
      const priority = id === this.hoverElementId ? 0 : id === this.selectedId ? 1 : 2
      if (entry.tag.visible) candidates.push({ element: entry.tag.element, priority, distance })
      if (entry.pips.visible) candidates.push({ element: entry.pips.element, priority, distance })
    }
    for (const [unitId, pennant] of this.pennants) {
      const distance = frame.camera.position.distanceTo(pennant.position)
      const hovered = !!this.hoverElementId && this.entries.get(this.hoverElementId)?.unitId === unitId
      const selected = !!this.selectedId && this.entries.get(this.selectedId)?.unitId === unitId
      const priority = hovered ? 0 : selected ? 1 : 2
      candidates.push({ element: pennant.element, priority, distance })
    }
    declutterLabels(candidates, frame.hostTop)
  }

  pickables(): Object3D[] {
    return [...this.entries.values()].map((e) => e.root)
  }

  drawnPosition(id: string): Vector3 | null {
    const e = this.entries.get(id)
    return e ? e.root.position.clone() : null
  }

  dispose(): void {
    disposeTree(this.group)
    // Detach every entry root and pennant, not just forget them — left
    // attached, React StrictMode's dev-only double mount (a fresh
    // `GroundScene` built right after this layer's own `dispose()`, reusing
    // this same persisted layer instance) would see empty `entries`/
    // `pennants` maps and spawn a fresh model/pennant for every live element
    // right alongside these stale, already-disposed ones (R13).
    this.group.clear()
    for (const p of this.pennants.values()) p.element.remove()
    this.entries.clear()
    this.pennants.clear()
  }
}
