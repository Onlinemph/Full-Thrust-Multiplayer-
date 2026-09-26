/**
 * PLACEHOLDER (stage 2, SHIPS) — fighter groups (8) and gunboat squadrons (9)
 * in flight, in 3D.
 *
 * Today every group is the same small cone, side-coloured, pointed along its
 * facing, sized a little bigger for a gunboat squadron than a fighter wing
 * (9.1's boats read closer to a small ship than to a fighter) — a formation
 * marker, not a craft. SHIPS's real job: small craft flown in an actual
 * formation (a handful of hull-like shapes fanned around the marker point
 * rather than one glyph standing in for the whole group), the same heading
 * notch the 2D marker cuts (`courseToDegrees(group.facing)`), and a spent
 * (`cef === 0`) dimming.
 *
 * Both families share one file because they share one shape of state
 * (`position`, `facing`, `status`, `label`, `side`) and one interaction: a
 * click either selects the group (`onSelectFlight`) or, with an enemy group
 * already in hand, declares the dogfight/attack `BattleScene`'s pointer
 * handler already routes — this layer only has to draw and tag them.
 */
import { ConeGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { courseToDegrees } from '../../engine/geometry'
import type { FighterGroupState, GunboatSquadronState } from '../../engine/game'
import { makeLabel, setLabel, type CSS2DObject } from './labels'
import { disposeTree, setTooltip, tagPickable, type FrameContext, type Layer, type LayerContext } from './layer'
import { headingToYaw, HULL_ALTITUDE, sideColorOf, toWorld } from './space'

interface Entry {
  group: Group
  mesh: Mesh
  material: MeshStandardMaterial
  label: CSS2DObject
}

type Group2 = (FighterGroupState & { squadron?: false }) | (GunboatSquadronState & { squadron: true })

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
    if (!entry) {
      entry = this.buildEntry(group)
      this.entries.set(group.id, entry)
    }
    const nudge =
      stackIndex === 0 ? { x: 0, z: 0 } : { x: Math.cos(stackIndex) * 0.9, z: Math.sin(stackIndex) * 0.9 }
    entry.group.position.copy(toWorld({ x: group.position.x + nudge.x, y: group.position.y + nudge.z }, HULL_ALTITUDE))
    entry.group.rotation.y = headingToYaw(courseToDegrees(group.facing))
    entry.material.color.setHex(sideColorOf(group.side))
    entry.material.opacity = group.cef <= 0 ? 0.45 : 1

    const count = group.squadron ? group.boats.length : group.strength
    const cefText = group.cef > 0 ? `CEF ${group.cef}` : 'spent'
    setLabel(entry.label, `${count} · ${cefText}`, `l3d-craft l3d-${group.side}`)
    setTooltip(entry.group, `${group.label}, ${count} ${group.squadron ? 'gunboats' : 'fighters'}, ${cefText}`)
  }

  private buildEntry(group: Group2): Entry {
    const size = group.squadron ? 0.55 : 0.4
    const material = new MeshStandardMaterial({ transparent: true, roughness: 0.5, metalness: 0.2 })
    const mesh = new Mesh(new ConeGeometry(size, size * 2, 6), material)
    mesh.rotation.x = Math.PI / 2
    tagPickable(mesh, { kind: group.squadron ? 'squadron' : 'flight', id: group.id })
    const label = makeLabel('', `l3d-craft l3d-${group.side}`)
    label.position.set(0, size + 0.35, 0)
    const wrap = new Group()
    wrap.add(mesh, label)
    this.group.add(wrap)
    return { group: wrap, mesh, material, label }
  }

  tick(_frame: FrameContext): void {
    // PLACEHOLDER: SHIPS's formation jitter/engine glow, if any, goes here.
  }

  pickables(): Mesh[] {
    return Array.from(this.entries.values()).map((entry) => entry.mesh)
  }

  dispose(): void {
    disposeTree(this.group)
    this.entries.clear()
  }
}
