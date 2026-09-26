/**
 * STARGRUNT'S OWN FILE — every living figure as a small 25mm soldier (a base,
 * a body, a head and helmet, a personal weapon), a fallen mark for the
 * wounded, the stabilised and the dead, and every squad's own pennant (code,
 * quality, confidence and suppression pips) flown above it — BRIEF-GROUND-3D's
 * list for this file, replacing the block-per-figure placeholder.
 *
 * Kept to the shape `StargruntView3D.tsx` (also mine) and `GroundScene`
 * (GROUND's, not mine) both call:
 *
 *   - `new StargruntUnitsLayer()` — no arguments.
 *   - `.group: THREE.Group` — added to the scene once, forever.
 *   - `.update(state, opts)` — called on every render; a figure's own model
 *     is built once at `spawn` (its kit never changes in a battle) and only
 *     ever repositioned, retinted or hidden after that, never rebuilt.
 *   - `.pickables(): Object3D[]` — every *live* figure's clickable root
 *     (a dead figure has none, exactly as the 2D map's own `FigureMark`
 *     drops `data-figure` once dead), tagged with `tagPickable`. Deployment
 *     (p. 14) tags a figure with its own id so `onSelectFigure` sees it;
 *     every other phase tags it with its *unit* id, since only a squad is
 *     picked once the battle is under way (fixes GROUND's own placeholder
 *     note: "no figure-level pick").
 *   - `.drawnPosition(id): Vector3 | null` — takes either a figure id (during
 *     deployment, so the double-click-to-focus that reads back whatever
 *     `pickables()` was just tagged with still resolves) or a unit id
 *     (everywhere else): a unit's own drawn position is its first live
 *     figure's.
 *   - `.dispose()`.
 *
 * `update`'s own signature grew from the placeholder's `(figures, opts)` to
 * `(state, opts)`: a pennant needs its whole squad (quality, confidence,
 * suppression, integrity), not one figure at a time, and only `GameState`
 * has that. `StargruntView3D.tsx` and this file are the only two callers of
 * either shape, so the change is safe (GROUND's own note: "extend the opts
 * object... beyond the heightAt it already carries" — here the whole first
 * argument is extended instead, for the same reason).
 */
import {
  CapsuleGeometry,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { unitCodes } from '../../dirtside/unitCodes'
import { isInIntegrity } from '../../../stargrunt/table/cover'
import { alive } from '../../../stargrunt/table/game'
import { QUALITY_DIE, type Confidence, type FigureState, type GameState, type UnitState } from '../../../stargrunt/types'
import { disposeTree, setTooltip, tagPickable, type FrameContext, type Layer, type Point } from '../layer'
import { declutterLabels, type DeclutterCandidate } from '../labels'
import { sideColorOf } from '../palette'

export interface StargruntUnitsOptions {
  heightAt: (point: Point) => number
  selectedUnitId: string | null
  /** Deployment only (p. 14): a figure clicked selects itself, not its squad — see this file's own header. */
  selectedFigureId?: string | null
  hoverUnitId?: string | null
  /** Enemy units under consideration as a fire target (`targeting.verdicts`'s own keys) — `map/figures.tsx`'s own `target` ring. */
  targetUnitIds?: ReadonlySet<string>
  /**
   * A pennant clicked (R11): the 2D map's own `SquadPennant` is a first-class
   * click target (`data-unit`, `TableMap.tsx`'s own `hitOf`); a `CSS2DObject`
   * label is inert by default (`pointer-events: none`, `ground3d.css`), so
   * without this a click on exactly where a squad's flag is drawn does
   * nothing. The same `onSelectUnit` `StargruntView3D.tsx` already hands
   * `GroundScene` for its own unit pickables, so a pennant click resolves
   * through the very same deployment/figure branching.
   */
  onSelectUnit?: (id: string) => void
}

const BASE_R = 0.185
const BASE_H = 0.03
const TORSO_R = 0.078
const TORSO_LEN = 0.22
const HEAD_R = 0.074
const STAND_HEIGHT = BASE_H + TORSO_LEN + TORSO_R * 2 + HEAD_R * 1.6
const HELMET_COLOR = 0x4b4f3f
const WEAPON_COLOR = 0x272521
const PACK_COLOR = 0xd9d2bd
const CROSS_COLOR = 0xc23b3b
const LEADER_COLOR = 0xf0d98a
const DEAD_COLOR = 0x23211c
const STAB_COLOR = 0x8a92a0
const WOUND_RING_COLOR = 0xff5555
const STAB_RING_COLOR = 0x9fb0c9
const ACTIVE_RING_COLOR = 0xff7a3d
const SELECT_RING_COLOR = 0xefe6c8
const TARGET_RING_COLOR = 0xff7a3d

// ── Shared geometry/material — one instance for every figure, never disposed per entry (`disposeTree` skips
// anything marked `userData.shared`), exactly `textures.ts`'s and `three/ships.ts`'s own SCREEN_GEOMETRY pattern.
function shared<T extends { userData: Record<string, unknown> }>(obj: T): T {
  obj.userData.shared = true
  return obj
}
const BASE_GEO = shared(new CylinderGeometry(BASE_R, BASE_R * 1.05, BASE_H, 14))
const TORSO_GEO = shared(new CapsuleGeometry(TORSO_R, TORSO_LEN, 4, 8))
const HEAD_GEO = shared(new SphereGeometry(HEAD_R, 12, 8))
const RIFLE_GEO = shared(new BoxGeometry(0.018, 0.02, 0.34))
const SUPPORT_GEO = shared(new BoxGeometry(0.032, 0.034, 0.46))
const PACK_GEO = shared(new BoxGeometry(0.12, 0.15, 0.06))
const CROSS_H_GEO = shared(new BoxGeometry(0.08, 0.018, 0.012))
const CROSS_V_GEO = shared(new BoxGeometry(0.018, 0.08, 0.012))
const LEADER_GEO = shared(new OctahedronGeometry(0.05))
const PRONE_GEO = shared(new CapsuleGeometry(TORSO_R * 0.95, TORSO_LEN + HEAD_R, 4, 8))
const RING_GEO = shared(new RingGeometry(0.16, 0.2, 20))
const SHADOW_GEO = shared(new CircleGeometry(BASE_R * 1.15, 16))
const HELMET_MAT = shared(new MeshStandardMaterial({ color: HELMET_COLOR, roughness: 0.75 }))
const WEAPON_MAT = shared(new MeshStandardMaterial({ color: WEAPON_COLOR, roughness: 0.5, metalness: 0.4 }))
const PACK_MAT = shared(new MeshStandardMaterial({ color: PACK_COLOR, roughness: 0.8 }))
const CROSS_MAT = shared(new MeshStandardMaterial({ color: CROSS_COLOR, roughness: 0.6 }))
const LEADER_MAT = shared(new MeshStandardMaterial({ color: LEADER_COLOR, roughness: 0.3, metalness: 0.5 }))
const SHADOW_MAT = shared(new MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.16, roughness: 1 }))

interface Entry {
  group: Group
  standing: Group
  prone: Mesh
  proneMaterial: MeshStandardMaterial
  torso: Mesh
  torsoMaterial: MeshStandardMaterial
  leaderPip: Mesh
  woundRing: Mesh
  stabRing: Mesh
  activeRing: Mesh
  selectRing: Mesh
  targetRing: Mesh
  unitId: string
  dead: boolean
}

/** Least confident first, matching `map/figures.tsx`'s own `CHIP_LABEL`. */
const CHIP_LABEL: Record<Confidence, string> = { CO: 'CO', ST: 'ST', SH: 'SH', BR: 'BR', RO: 'RO' }

/** Where a squad's pennant flies: above its leader if fit, else the highest figure still standing — `map/figures.tsx`'s own `pennantAt`. */
function pennantAt(unit: UnitState, figures: readonly FigureState[]): Point | null {
  const leader = figures.find((f) => f.id === unit.leaderId && f.status !== 'dead')
  const anchor = leader ?? figures.find((f) => f.status !== 'dead') ?? null
  return anchor ? anchor.position : null
}

interface PennantEntry {
  pole: Line
  label: CSS2DObject
}

const POLE_LEN = 0.55

export class StargruntUnitsLayer implements Layer {
  readonly group = new Group()
  private figuresGroup = new Group()
  private pennantsGroup = new Group()
  private entries = new Map<string, Entry>()
  private pennants = new Map<string, PennantEntry>()
  private deployPhase = false
  /** Latest values from `update()`'s own `opts`, read back by `tick()`'s declutter pass (K2) — a frame can land between two `update()` calls. */
  private selectedUnitId: string | null = null
  private hoverUnitId: string | null = null

  constructor() {
    this.group.name = 'stargrunt-units'
    this.group.add(this.figuresGroup, this.pennantsGroup)
  }

  update(state: GameState, opts: StargruntUnitsOptions): void {
    this.deployPhase = state.phase === 'deployment'
    this.selectedUnitId = opts.selectedUnitId
    this.hoverUnitId = this.deployPhase ? null : (opts.hoverUnitId ?? null)
    const codes = unitCodes(state)
    const activeUnitId = state.activation?.unitId ?? null

    for (const f of Object.values(state.figures)) {
      let entry = this.entries.get(f.id)
      if (!entry) {
        entry = this.spawn(f)
        this.entries.set(f.id, entry)
      }
      this.updateFigure(entry, f, state, opts, codes[f.unitId] ?? '', activeUnitId)
    }
    for (const [id, entry] of this.entries) {
      if (state.figures[id]) continue
      this.figuresGroup.remove(entry.group)
      disposeTree(entry.group)
      this.entries.delete(id)
    }

    const liveUnitIds = new Set<string>()
    for (const unit of Object.values(state.units)) {
      const figs = Object.values(state.figures).filter((f) => f.unitId === unit.id)
      const anchor = pennantAt(unit, figs)
      if (!anchor) continue
      liveUnitIds.add(unit.id)
      this.updatePennant(unit, anchor, figs, codes[unit.id] ?? '', opts, activeUnitId)
    }
    for (const [id, entry] of this.pennants) {
      if (liveUnitIds.has(id)) continue
      this.pennantsGroup.remove(entry.pole)
      entry.pole.geometry.dispose()
      ;(entry.pole.material as LineBasicMaterial).dispose()
      entry.label.element.remove()
      this.pennantsGroup.remove(entry.label)
      this.pennants.delete(id)
    }
  }

  private updateFigure(entry: Entry, f: FigureState, state: GameState, opts: StargruntUnitsOptions, code: string, activeUnitId: string | null): void {
    const ground = opts.heightAt(f.position)
    entry.group.position.set(f.position.x, ground, f.position.y)

    const dead = f.status === 'dead'
    entry.dead = dead
    const stabilised = f.status === 'stabilised'
    const wounded = f.status === 'wounded'
    const lying = dead || stabilised
    entry.standing.visible = !lying
    entry.prone.visible = lying
    if (lying) {
      entry.prone.position.y = dead ? 0.012 : TORSO_R
      entry.prone.rotation.z = f.id.length % 2 === 0 ? 0.35 : -0.35
      entry.proneMaterial.color.setHex(dead ? DEAD_COLOR : STAB_COLOR)
      entry.proneMaterial.opacity = dead ? 0.9 : 0.75
    }

    entry.woundRing.visible = wounded
    entry.stabRing.visible = stabilised
    if (wounded || stabilised) {
      const ring = wounded ? entry.woundRing : entry.stabRing
      ring.position.y = wounded ? STAND_HEIGHT + 0.05 : TORSO_R + 0.05
    }

    if (!lying) {
      entry.torsoMaterial.opacity = wounded ? 0.85 : 1
      entry.torsoMaterial.transparent = wounded
    }

    const isLeader = state.units[f.unitId]?.leaderId === f.id
    entry.leaderPip.visible = isLeader && !dead

    const isSelected = this.deployPhase ? opts.selectedFigureId === f.id : opts.selectedUnitId === f.unitId
    const isHovered = opts.hoverUnitId !== undefined && opts.hoverUnitId !== null && (this.deployPhase ? opts.hoverUnitId === f.id : opts.hoverUnitId === f.unitId)
    const isActive = f.unitId === activeUnitId
    const isTargeted = !!opts.targetUnitIds?.has(f.unitId)
    entry.selectRing.visible = (isSelected || isHovered) && !dead
    ;(entry.selectRing.material as MeshStandardMaterial).emissive.setHex(isSelected ? 0xefe6c8 : 0x8a95ad)
    entry.activeRing.visible = isActive && !dead
    entry.targetRing.visible = isTargeted && !dead

    const root = entry.standing.visible ? entry.standing : entry.prone
    if (!dead) tagPickable(root, this.deployPhase ? f.id : f.unitId)
    setTooltip(entry.group, `${f.name}${isLeader ? ' (leader)' : ''} — ${code} — ${dead ? 'dead' : wounded ? 'wounded' : stabilised ? 'stabilised, out of the fight' : 'fit'}${f.supportWeapon ? `, ${f.supportWeapon}` : ''}`)
  }

  private updatePennant(unit: UnitState, anchor: Point, figs: readonly FigureState[], code: string, opts: StargruntUnitsOptions, activeUnitId: string | null): void {
    let entry = this.pennants.get(unit.id)
    if (!entry) {
      const pole = new Line(new BufferGeometry(), new LineBasicMaterial({ color: sideColorOf(unit.sideId), toneMapped: false }))
      this.pennantsGroup.add(pole)
      const el = document.createElement('div')
      const label = new CSS2DObject(el)
      label.center.set(0, 0.5)
      this.pennantsGroup.add(label)
      entry = { pole, label }
      this.pennants.set(unit.id, entry)
    }
    // R11: `ground3d.css` makes every label `pointer-events: none` by
    // default; `stargrunt3d.css` opts this one back in so a real click can
    // land on it, forwarded here (never `addEventListener`, so re-pointing
    // it at this update's own `opts.onSelectUnit` on every call never piles
    // up stale listeners from an earlier one).
    entry.label.element.onclick = (e) => {
      e.stopPropagation()
      opts.onSelectUnit?.(unit.id)
    }
    const ground = opts.heightAt(anchor)
    const base = new Vector3(anchor.x, ground + STAND_HEIGHT, anchor.y)
    const top = new Vector3(anchor.x, ground + STAND_HEIGHT + POLE_LEN, anchor.y)
    entry.pole.geometry.setFromPoints([base, top])
    entry.label.position.copy(top)

    const organised = isInIntegrity(figs.filter(alive).map((f) => f.position))
    const chips: string[] = [`<span class="sg3d-chip is-${unit.confidence}">${CHIP_LABEL[unit.confidence]}</span>`]
    if (unit.suppression > 0) chips.push(`<span class="sg3d-chip is-suppress">${'&#9679;'.repeat(unit.suppression)}</span>`)
    if (unit.inPosition) chips.push('<span class="sg3d-chip is-ip">IP</span>')
    if (!organised) chips.push('<span class="sg3d-chip is-dis">DIS</span>')
    if (unit.panic) chips.push('<span class="sg3d-chip is-ro">PANIC</span>')
    const html = `<span class="sg3d-code">${code}</span><span class="sg3d-lead">D${QUALITY_DIE[unit.quality]}·${unit.leadership}</span>${chips.join('')}`
    const active = unit.id === activeUnitId
    const selected = unit.id === opts.selectedUnitId
    const hovered = !this.deployPhase && opts.hoverUnitId === unit.id
    const cls = `g3d-l sg3d-pennant is-${unit.sideId}${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}${hovered ? ' is-hovered' : ''}`
    if (entry.label.element.className !== cls) entry.label.element.className = cls
    if (entry.label.element.innerHTML !== html) entry.label.element.innerHTML = html
  }

  private spawn(f: FigureState): Entry {
    const group = new Group()
    const standing = new Group()

    const shadow = new Mesh(SHADOW_GEO, SHADOW_MAT)
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.002
    standing.add(shadow)

    const base = new Mesh(BASE_GEO, new MeshStandardMaterial({ color: sideColorOf(f.sideId), roughness: 0.65 }))
    base.position.y = BASE_H / 2
    standing.add(base)

    const torsoMaterial = new MeshStandardMaterial({ color: sideColorOf(f.sideId), roughness: 0.55 })
    const torso = new Mesh(TORSO_GEO, torsoMaterial)
    torso.position.y = BASE_H + TORSO_LEN / 2 + TORSO_R
    standing.add(torso)

    const head = new Mesh(HEAD_GEO, HELMET_MAT)
    head.position.y = BASE_H + TORSO_LEN + TORSO_R * 2 + HEAD_R * 0.7
    standing.add(head)

    // The weapon by kit (BRIEF-GROUND-3D): a support weapon's own longer, thicker baton when this figure
    // crews one, a personal rifle otherwise — kit never changes for a figure's life, so this is built once.
    const weaponGeo = f.supportWeapon ? SUPPORT_GEO : RIFLE_GEO
    const weapon = new Mesh(weaponGeo, WEAPON_MAT)
    weapon.position.set(TORSO_R * 0.9, torso.position.y + TORSO_R * 0.2, TORSO_R * 0.3)
    weapon.rotation.set(0.5, 0.5, 0.3)
    standing.add(weapon)

    // A medic's pack (p. 34's role, not a weapon): a small case on the back with a red cross.
    if (f.role === 'medic') {
      const pack = new Mesh(PACK_GEO, PACK_MAT)
      pack.position.set(0, torso.position.y, -TORSO_R * 1.3)
      standing.add(pack)
      const crossH = new Mesh(CROSS_H_GEO, CROSS_MAT)
      const crossV = new Mesh(CROSS_V_GEO, CROSS_MAT)
      crossH.position.set(0, torso.position.y, -TORSO_R * 1.63)
      crossV.position.copy(crossH.position)
      standing.add(crossH, crossV)
    }

    const leaderPip = new Mesh(LEADER_GEO, LEADER_MAT)
    leaderPip.position.y = head.position.y + HEAD_R + 0.1
    leaderPip.visible = false
    standing.add(leaderPip)

    const woundRing = new Mesh(RING_GEO, new MeshStandardMaterial({ color: WOUND_RING_COLOR, emissive: WOUND_RING_COLOR, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, side: DoubleSide }))
    woundRing.rotation.x = -Math.PI / 2
    woundRing.visible = false
    standing.add(woundRing)

    const activeRing = new Mesh(new RingGeometry(BASE_R + 0.05, BASE_R + 0.1, 24), new MeshStandardMaterial({ color: ACTIVE_RING_COLOR, emissive: ACTIVE_RING_COLOR, emissiveIntensity: 0.8, transparent: true, opacity: 0.85, side: DoubleSide }))
    activeRing.rotation.x = -Math.PI / 2
    activeRing.position.y = 0.006
    activeRing.visible = false
    standing.add(activeRing)

    const selectRing = new Mesh(new RingGeometry(BASE_R + 0.14, BASE_R + 0.19, 24), new MeshStandardMaterial({ color: SELECT_RING_COLOR, emissive: 0x8a95ad, emissiveIntensity: 0.5, transparent: true, opacity: 0.8, side: DoubleSide }))
    selectRing.rotation.x = -Math.PI / 2
    selectRing.position.y = 0.004
    selectRing.visible = false
    standing.add(selectRing)

    const targetRing = new Mesh(new RingGeometry(BASE_R + 0.24, BASE_R + 0.29, 24), new MeshStandardMaterial({ color: TARGET_RING_COLOR, emissive: TARGET_RING_COLOR, emissiveIntensity: 0.7, transparent: true, opacity: 0.85, side: DoubleSide }))
    targetRing.rotation.x = -Math.PI / 2
    targetRing.position.y = 0.008
    targetRing.visible = false
    standing.add(targetRing)

    group.add(standing)

    const proneMaterial = new MeshStandardMaterial({ color: STAB_COLOR, roughness: 0.7, transparent: true })
    const prone = new Mesh(PRONE_GEO, proneMaterial)
    prone.rotation.z = Math.PI / 2
    prone.visible = false
    group.add(prone)

    const stabRing = new Mesh(RING_GEO, new MeshStandardMaterial({ color: STAB_RING_COLOR, emissive: STAB_RING_COLOR, emissiveIntensity: 0.4, transparent: true, opacity: 0.8, side: DoubleSide }))
    stabRing.rotation.x = -Math.PI / 2
    stabRing.visible = false
    group.add(stabRing)

    this.figuresGroup.add(group)
    return { group, standing, prone, proneMaterial, torso, torsoMaterial, leaderPip, woundRing, stabRing, activeRing, selectRing, targetRing, unitId: f.unitId, dead: false }
  }

  /** Every live figure's clickable root — a dead figure has none, `map/figures.tsx`'s own rule. */
  pickables(): Object3D[] {
    const out: Object3D[] = []
    for (const entry of this.entries.values()) {
      if (entry.dead) continue
      out.push(entry.standing.visible ? entry.standing : entry.prone)
    }
    return out
  }

  /** A figure id (deployment) or a unit id (everywhere else): a unit's own drawn position is its first live figure's. */
  drawnPosition(id: string): Vector3 | null {
    const direct = this.entries.get(id)
    if (direct) return direct.group.position.clone()
    for (const [, entry] of this.entries) {
      if (entry.unitId === id && (entry.standing.visible || entry.prone.visible)) return entry.group.position.clone()
    }
    return null
  }

  tick(frame: FrameContext): void {
    const { now, reducedMotion } = frame
    if (!reducedMotion) {
      const spin = (now / 4000) % (Math.PI * 2)
      for (const entry of this.entries.values()) {
        if (entry.activeRing.visible) entry.activeRing.rotation.z = spin
      }
    }
    this.declutter(frame)
  }

  /** K2: every squad pennant, kept by priority (the hovered unit, the selected unit, nearest first) and faded the rest. */
  private declutter(frame: FrameContext): void {
    const candidates: DeclutterCandidate[] = []
    for (const [unitId, entry] of this.pennants) {
      const distance = frame.camera.position.distanceTo(entry.label.position)
      const priority = unitId === this.hoverUnitId ? 0 : unitId === this.selectedUnitId ? 1 : 2
      candidates.push({ element: entry.label.element, priority, distance })
    }
    declutterLabels(candidates, frame.hostTop)
  }

  dispose(): void {
    disposeTree(this.group)
    // Detach every figure/pennant from their own persistent sub-group — left
    // attached, React StrictMode's dev-only double mount (a fresh
    // `GroundScene` built right after this layer's own `dispose()`, reusing
    // this same persisted layer instance) would see empty `entries`/
    // `pennants` maps and spawn a fresh figure/pennant for every live one
    // right alongside these stale, already-disposed ones — the doubled
    // pennant this review found (R13).
    this.figuresGroup.clear()
    this.pennantsGroup.clear()
    this.entries.clear()
    this.pennants.clear()
  }
}
