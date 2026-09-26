/**
 * Fighter groups (8) and gunboat squadrons (9) in flight, in 3D.
 *
 * Every group is flown as an actual formation — a handful of small craft
 * fanned round the marker point rather than one glyph standing in for the
 * whole group — capped at a few drawn hulls so a fifty-strong wing costs the
 * same as a wingman pair; the 2D marker's own number (strength or boats
 * left) still carries the true count. Gunboats fly a bulkier, squatter
 * shape than fighters (9.1's boats read closer to a small ship), both cut
 * with the same heading notch the 2D marker uses, and both dim to a grey
 * husk once spent (`cef === 0`).
 *
 * Both families share one file because they share one shape of state
 * (`position`, `facing`, `status`, `label`, `side`) and one interaction: a
 * click either selects the group (`onSelectFlight`) or, with an enemy group
 * already in hand, declares the dogfight/attack `BattleScene`'s pointer
 * handler already routes — this layer only has to draw and tag them.
 */
import { ConeGeometry, Group, Mesh, MeshStandardMaterial, type BufferGeometry } from 'three'
import { courseToDegrees } from '../../engine/geometry'
import type { FighterGroupState, GunboatSquadronState } from '../../engine/game'
import { makeLabel, setLabel, type CSS2DObject } from './labels'
import { disposeTree, setTooltip, tagPickable, type FrameContext, type Layer, type LayerContext } from './layer'
import { headingToYaw, HULL_ALTITUDE, sideColorOf, toWorld } from './space'

interface Entry {
  group: Group
  /** Rides the idle bob, under `group` — `group`'s own position is `update`'s alone to set. */
  hover: Group
  craft: Mesh[]
  material: MeshStandardMaterial
  label: CSS2DObject
  phase: number
}

type Group2 = (FighterGroupState & { squadron?: false }) | (GunboatSquadronState & { squadron: true })

/**
 * Where each craft sits in the formation, local to the group's own facing
 * (−z forward), scaled by craft size. A lead craft out front, the rest
 * fanned behind it — a "finger four" cut down or stretched to however many
 * of the six slots this group's own count fills.
 */
const FORMATION_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [0, -1.1],
  [-0.95, 0.15],
  [0.95, 0.15],
  [-1.7, 1.35],
  [1.7, 1.35],
  [0, 1.5],
]

/** A slender dart, apex forward (−Z) — geometry shared by every fighter wing. */
function fighterGeometry(): BufferGeometry {
  return new ConeGeometry(0.16, 0.46, 5).rotateX(-Math.PI / 2)
}

/** Squatter and broader than a fighter — 9.1's boats read closer to a small ship. */
function gunboatGeometry(): BufferGeometry {
  return new ConeGeometry(0.26, 0.5, 7).rotateX(-Math.PI / 2)
}

const SHARED_GEOMETRY = { fighter: fighterGeometry(), gunboat: gunboatGeometry() }
SHARED_GEOMETRY.fighter.userData.shared = true
SHARED_GEOMETRY.gunboat.userData.shared = true

export class FlightsLayer implements Layer {
  readonly group = new Group()
  private entries = new Map<string, Entry>()

  constructor() {
    this.group.name = 'flights'
  }

  update({ game }: LayerContext): void {
    const seen = new Set<string>()
    const groups: Group2[] = [
      ...game.fighterGroups.filter((g) => g.status === 'in-flight').map((g) => ({ ...g, squadron: false as const })),
      ...game.gunboatSquadrons.filter((g) => g.status === 'in-flight').map((g) => ({ ...g, squadron: true as const })),
    ]
    // Several groups launched from the same tube sit on the same point until
    // someone flies them; nudged apart here purely so more than one is
    // visible, the same reasoning as the 2D map's own `stackFlights`.
    const stackIndex = new Map<string, number>()
    for (const group of groups) {
      seen.add(group.id)
      const key = `${Math.round(group.position.x * 10)}:${Math.round(group.position.y * 10)}`
      const index = stackIndex.get(key) ?? 0
      stackIndex.set(key, index + 1)
      this.updateGroup(group, index)
    }
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue
      disposeTree(entry.group)
      this.group.remove(entry.group)
      this.entries.delete(id)
    }
  }

  private updateGroup(group: Group2, stackIndex: number): void {
    let entry = this.entries.get(group.id)
    const count = group.squadron ? group.boats.length : group.strength
    if (!entry) {
      entry = this.buildEntry(group, count)
      this.entries.set(group.id, entry)
    } else if (entry.craft.length !== Math.min(count, FORMATION_SLOTS.length)) {
      // Losses (8.13, 9.1) thin the formation without rebuilding the group.
      this.resizeFormation(entry, group, count)
    }

    const nudge =
      stackIndex === 0 ? { x: 0, z: 0 } : { x: Math.cos(stackIndex) * 0.9, z: Math.sin(stackIndex) * 0.9 }
    entry.group.position.copy(toWorld({ x: group.position.x + nudge.x, y: group.position.y + nudge.z }, HULL_ALTITUDE))
    entry.group.rotation.y = headingToYaw(courseToDegrees(group.facing))
    entry.material.color.setHex(sideColorOf(group.side))
    const spent = group.cef <= 0
    entry.material.opacity = spent ? 0.4 : 1
    entry.material.emissiveIntensity = spent ? 0 : 0.35

    const cefText = group.cef > 0 ? `CEF ${group.cef}` : 'spent'
    setLabel(entry.label, `${count} · ${cefText}`, `l3d-craft l3d-${group.side}`)
    setTooltip(entry.group, `${group.label}, ${count} ${group.squadron ? 'gunboats' : 'fighters'}, ${cefText}`)
  }

  private buildEntry(group: Group2, count: number): Entry {
    const size = group.squadron ? 0.62 : 0.42
    const material = new MeshStandardMaterial({
      transparent: true,
      roughness: 0.5,
      metalness: 0.2,
      emissive: sideColorOf(group.side),
    })
    const wrap = new Group()
    tagPickable(wrap, { kind: group.squadron ? 'squadron' : 'flight', id: group.id })
    const hover = new Group()
    wrap.add(hover)
    const geometry = group.squadron ? SHARED_GEOMETRY.gunboat : SHARED_GEOMETRY.fighter
    const craft = this.makeCraft(hover, geometry, material, size, Math.min(count, FORMATION_SLOTS.length))

    const label = makeLabel('', `l3d-craft l3d-${group.side}`)
    label.position.set(0, size + 0.4, 0)
    hover.add(label)
    this.group.add(wrap)
    return { group: wrap, hover, craft, material, label, phase: Math.random() * Math.PI * 2 }
  }

  private makeCraft(wrap: Group, geometry: BufferGeometry, material: MeshStandardMaterial, size: number, drawn: number): Mesh[] {
    const craft: Mesh[] = []
    // A lone craft flies dead centre, on the marker point exactly as the 2D
    // glyph sits; a formation of two or more fans out round it.
    const slots = drawn <= 1 ? [[0, 0] as const] : FORMATION_SLOTS.slice(0, drawn)
    for (const [x, z] of slots) {
      const mesh = new Mesh(geometry, material)
      mesh.position.set(x * size, 0, z * size)
      mesh.scale.setScalar(size)
      wrap.add(mesh)
      craft.push(mesh)
    }
    return craft
  }

  /** Rebuild just the formation's craft when the drawn count changes (losses, or a fresh launch topping it back up). */
  private resizeFormation(entry: Entry, group: Group2, count: number): void {
    for (const mesh of entry.craft) entry.hover.remove(mesh)
    const size = group.squadron ? 0.62 : 0.42
    const geometry = group.squadron ? SHARED_GEOMETRY.gunboat : SHARED_GEOMETRY.fighter
    entry.craft = this.makeCraft(entry.hover, geometry, entry.material, size, Math.min(count, FORMATION_SLOTS.length))
  }

  tick({ now, reducedMotion }: FrameContext): void {
    for (const entry of this.entries.values()) {
      entry.hover.position.y = reducedMotion ? 0 : Math.sin(now / 500 + entry.phase) * 0.05
    }
  }

  pickables(): Group[] {
    return Array.from(this.entries.values()).map((entry) => entry.group)
  }

  dispose(): void {
    disposeTree(this.group)
    this.entries.clear()
  }
}
