/**
 * PLACEHOLDER (stage 2, SHIPS) — every hull on the table, in 3D.
 *
 * Today each ship is `hulls.ts`'s plain wedge, sized by `counterRadius(mass)`
 * (the same reach the 2D counter draws at), side-coloured, tinted a little
 * darker per box of hull damage marked, dimmed to a grey hulk once destroyed,
 * ghosted (transparent) once cloaked, ringed gold when selected — enough to
 * fight a battle by. SHIPS's real job is `hulls.ts`'s extrusion (see its own
 * doc) plus everything this file only stubs: bevelled plating and lit trim,
 * drive glow scaled by thrust (`ship.thrustUsed`/`design.drive`), crippled and
 * screen-level visuals (`effectiveScreenLevel`, done as a flat tint here —
 * make it a faint shell instead, level 1 and 2 distinguishable), squadron and
 * tow marks (`ship.squadronId`, `ship.tow`), a target ring separate from the
 * selection ring, and battlerider offset (`ship.carriedBy` — today riders sit
 * exactly on their carrier's station; MapView's own `riderOffset` in
 * `../MapView.tsx` is the rule to port so a Mothership's riders fan out
 * instead of stacking).
 *
 * Kept exactly as SHIPS needs to find it: `drawnPosition`, `extent`,
 * `setHovered` and `pickables` are `BattleScene`'s own contract with this
 * layer — replace what is inside them, not their signatures.
 */
import { DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry } from 'three'
import { effectiveScreenLevel } from '../../engine/actions'
import { courseToDegrees } from '../../engine/geometry'
import type { ShipState } from '../../engine/game'
import { counterRadius } from '../Counter'
import { hullGeometry } from './hulls'
import { makeLabel, setLabel, type CSS2DObject } from './labels'
import {
  disposeTree,
  setTooltip,
  tagPickable,
  type FrameContext,
  type Layer,
  type LayerContext,
  type ViewProps,
} from './layer'
import { damageTint, headingToYaw, HULL_ALTITUDE, screenBandColor, sideColorOf, toWorld } from './space'
import { shipVisible } from './visibility'

interface Entry {
  group: Group
  hull: Mesh
  hullMaterial: MeshStandardMaterial
  ring: Mesh
  screen: Mesh
  label: CSS2DObject
  radius: number
  destroyed: boolean
  bobPhase: number
}

export class ShipsLayer implements Layer {
  readonly group = new Group()
  private entries = new Map<string, Entry>()
  private hovered: string | null = null

  constructor() {
    this.group.name = 'ships'
  }

  /** World position and facing (degrees) of a hull still on the table, for the camera and for `overlays.ts`'s tracks. */
  drawnPosition(id: string): { x: number; z: number; heading: number } | null {
    const entry = this.entries.get(id)
    if (!entry) return null
    return { x: entry.group.position.x, z: entry.group.position.z, heading: entry.group.rotation.y }
  }

  /** The bounding box (world X/Z) of every hull currently drawn, for framing a preset camera on the action. */
  extent(): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
    if (this.entries.size === 0) return null
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const entry of this.entries.values()) {
      const { x, z } = entry.group.position
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
    return { minX, maxX, minZ, maxZ }
  }

  setHovered(id: string | null): void {
    this.hovered = id
  }

  update({ game, view }: LayerContext): void {
    const seen = new Set<string>()
    for (const ship of game.ships) {
      if (!shipVisible(ship, view.viewingSide)) continue
      seen.add(ship.id)
      this.updateShip(ship, view)
    }
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue
      disposeTree(entry.group)
      this.group.remove(entry.group)
      this.entries.delete(id)
    }
  }

  private updateShip(ship: ShipState, view: ViewProps): void {
    const radius = Math.max(0.5, counterRadius(ship.design.mass))
    let entry = this.entries.get(ship.id)
    if (!entry || Math.abs(entry.radius - radius) > 1e-6) {
      if (entry) {
        disposeTree(entry.group)
        this.group.remove(entry.group)
      }
      entry = this.buildEntry(ship, radius)
      this.entries.set(ship.id, entry)
    }

    entry.destroyed = ship.destroyed
    entry.group.position.copy(toWorld(ship.placement.position, HULL_ALTITUDE))
    entry.group.rotation.y = headingToYaw(courseToDegrees(ship.placement.facing))

    const fraction = ship.design.hullBoxes > 0 ? ship.hullMarked / ship.design.hullBoxes : 0
    entry.hullMaterial.color.setHex(ship.destroyed ? 0x2a2a30 : sideColorOf(ship.side))
    entry.hullMaterial.emissive.setHex(ship.destroyed ? 0x000000 : damageTint(fraction))
    entry.hullMaterial.opacity = ship.cloaked ? 0.35 : 1
    entry.hullMaterial.transparent = ship.cloaked || ship.destroyed
    if (ship.destroyed) entry.hullMaterial.opacity = 0.6

    entry.ring.visible = ship.id === view.selectedId
    const screenLevel = ship.destroyed ? 0 : effectiveScreenLevel(ship)
    entry.screen.visible = screenLevel > 0
    if (screenLevel > 0) {
      const mat = entry.screen.material as MeshBasicMaterial
      mat.color.setHex(screenBandColor(screenLevel))
      mat.opacity = screenLevel >= 2 ? 0.4 : 0.28
    }

    const note =
      view.viewingSide !== null && ship.side !== view.viewingSide && !ship.destroyed ? ` · ${ship.velocity} MU` : ''
    setLabel(entry.label, `${ship.name}${note}`, `l3d-name l3d-${ship.side}${ship.cloaked ? ' is-ghost' : ''}`)
    setTooltip(
      entry.group,
      `${ship.name}\n${ship.destroyed ? 'destroyed' : `${ship.design.hullBoxes - ship.hullMarked}/${ship.design.hullBoxes} hull`}`,
    )
  }

  private buildEntry(ship: ShipState, radius: number): Entry {
    const group = new Group()
    const depth = 0.12 + Math.min(radius, 3) * 0.05
    const hullMaterial = new MeshStandardMaterial({ roughness: 0.8, metalness: 0.15 })
    const hull = new Mesh(hullGeometry(radius, depth), hullMaterial)
    tagPickable(hull, { kind: 'ship', id: ship.id })
    group.add(hull)

    const ring = new Mesh(
      new RingGeometry(radius * 1.25, radius * 1.4, 32).rotateX(-Math.PI / 2),
      new MeshStandardMaterial({ color: 0xffd766, emissive: 0xffd766, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }),
    )
    ring.visible = false
    group.add(ring)

    // A screen reads as a faint shell round the hull, not a coin under it —
    // MeshBasicMaterial so its brightness is the band colour itself, never
    // the sun's specular hitting a flat disc square-on.
    const screen = new Mesh(
      new RingGeometry(radius * 0.75, radius * 1.15, 28).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, side: DoubleSide }),
    )
    screen.visible = false
    group.add(screen)

    const label = makeLabel(ship.name, `l3d-name l3d-${ship.side}`)
    label.position.set(0, radius * 0.9 + 0.5, 0)
    group.add(label)

    this.group.add(group)
    return { group, hull, hullMaterial, ring, screen, label, radius, destroyed: ship.destroyed, bobPhase: Math.random() * Math.PI * 2 }
  }

  tick({ now, reducedMotion }: FrameContext): void {
    if (reducedMotion) return
    for (const entry of this.entries.values()) {
      if (entry.destroyed) continue
      const bob = Math.sin(now / 900 + entry.bobPhase) * 0.03
      entry.hull.position.y = bob
    }
    for (const [id, entry] of this.entries) {
      const highlighted = id === this.hovered
      entry.hullMaterial.emissiveIntensity = highlighted ? 1.4 : 1
    }
  }

  /** Every hull's clickable mesh, for `BattleScene`'s raycaster. */
  pickables(): Mesh[] {
    return Array.from(this.entries.values()).map((entry) => entry.hull)
  }

  dispose(): void {
    disposeTree(this.group)
    this.entries.clear()
  }
}
