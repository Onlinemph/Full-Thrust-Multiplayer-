/**
 * The fleets, in 3D: every hull on the table, drawn from the same silhouette
 * (`hulls.ts`) the 2D counter fills in — bevelled plating, a lit trim outline
 * in the side colour, drive glow scaled by thrust, a spinal mount's barrel,
 * screens as a faint shell (level 1 and 2 distinguishable), damage washing
 * the plating by the rules' own tier (`damageLevelOf`, not just boxes
 * marked), a dark drifting hulk once destroyed, cloaks ghosted, a selection
 * ring and a separate ring for whatever this ship has a FireCon locked onto
 * (4.4), squadron and tow marks, name labels and hover text.
 *
 * Kept exactly as `BattleScene` needs to find it: `drawnPosition`, `extent`,
 * `setHovered` and `pickables` are its own contract with this layer.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import { effectiveScreenLevel } from '../../engine/actions'
import type { GameState, ShipState } from '../../engine/game'
import { engagedTargets } from '../../engine/game'
import { courseToDegrees } from '../../engine/geometry'
import { arrangeTouchingShips } from '../../engine/movement'
import type { Point } from '../../engine/types'
import { damageLevelOf } from '../../engine/victory'
import { counterRadius } from '../Counter'
import { buildHull, type HullGeometry } from './hulls'
import { glowTexture } from './textures'
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

/** 3.8's "arranged as closely as possible" has no number of its own — the smallest counter's diameter, matching `MapView.tsx`'s own rule. */
const TOUCHING_SEPARATION = 1.6

/**
 * A wash for a ship the rules call crippled (4.12: two hull rows gone, no
 * offensive armament, no FireCon, or no thrust) even when its boxes marked
 * alone would read lighter — a ship crippled by its guns and drive going
 * quiet should not look barely scratched.
 */
const CRIPPLED_EMISSIVE = 0x5e1a14
const WRECK_COLOR = 0x2a2a30

interface Entry {
  group: Group
  hull: Mesh
  hullMaterial: MeshStandardMaterial
  trim: LineSegments
  trimMaterial: LineBasicMaterial
  spineBar: Mesh | null
  engines: Sprite[]
  ring: Mesh
  targetRing: Mesh
  screen: Mesh
  screenOuter: Mesh
  label: CSS2DObject
  radius: number
  destroyed: boolean
  bobPhase: number
  tumble: { x: number; z: number }
}

/** 11.7's battleriders: fanned off the Mothership's flanks rather than stacked on its station — `MapView.tsx`'s own `riderOffset`, ported. */
function riderOffset(game: GameState, ship: ShipState): Point {
  if (ship.carriedBy === null) return ship.placement.position
  const carrier = game.ships.find((other) => other.id === ship.carriedBy)
  if (!carrier) return ship.placement.position
  const siblings = game.ships.filter((other) => other.carriedBy === ship.carriedBy)
  const index = siblings.findIndex((other) => other.id === ship.id)
  const gap = counterRadius(carrier.design.mass) + counterRadius(ship.design.mass) + 0.6
  const beam = (Math.floor(index / 2) + 1) * gap * (index % 2 === 0 ? -1 : 1)
  const heading = ((carrier.placement.facing % 12) * Math.PI) / 6
  return {
    x: carrier.placement.position.x + beam * Math.cos(heading),
    y: carrier.placement.position.y + beam * Math.sin(heading),
  }
}

function damageEmissive(level: ReturnType<typeof damageLevelOf>, fraction: number): number {
  if (level === 'crippled') return CRIPPLED_EMISSIVE
  return damageTint(fraction)
}

export class ShipsLayer implements Layer {
  readonly group = new Group()
  private entries = new Map<string, Entry>()
  private hovered: string | null = null
  private squadronLines = new Map<string, Line>()
  private towLines = new Map<string, Line>()

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
    const visible = game.ships.filter((ship) => shipVisible(ship, view.viewingSide))
    // `arrangeTouchingShips` (`../../engine/movement`) is the same pass
    // `MapView.tsx` runs over its counters: two hulls parked on the same spot
    // — a Mothership's riders included — are nudged apart so neither is
    // hidden under the other.
    const drawnAt = new Map(
      arrangeTouchingShips(
        visible.map((ship) => ({ id: ship.id, placement: { ...ship.placement, position: riderOffset(game, ship) } })),
        TOUCHING_SEPARATION,
      ).map((placed) => [placed.id, placed.position] as const),
    )
    // Worked out once for the whole fleet rather than per hull — a big battle
    // is exactly where an O(n²) lookup here would show up as jank.
    const selected = view.selectedId ? game.ships.find((s) => s.id === view.selectedId) : undefined
    const targetedIds = new Set(selected ? engagedTargets(selected, game.phase) : [])

    const seen = new Set<string>()
    for (const ship of visible) {
      seen.add(ship.id)
      this.updateShip(ship, view, drawnAt.get(ship.id) ?? ship.placement.position, targetedIds)
    }
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue
      disposeTree(entry.group)
      this.group.remove(entry.group)
      this.entries.delete(id)
    }

    this.updateSquadronMarks(visible)
    this.updateTowMarks(visible)
  }

  private updateShip(ship: ShipState, view: ViewProps, at: Point, targetedIds: ReadonlySet<string>): void {
    let entry = this.entries.get(ship.id)
    if (!entry) {
      entry = this.buildEntry(ship)
      this.entries.set(ship.id, entry)
    }

    entry.destroyed = ship.destroyed
    entry.group.position.copy(toWorld(at, HULL_ALTITUDE))
    entry.group.rotation.y = headingToYaw(courseToDegrees(ship.placement.facing))

    const level = damageLevelOf(ship)
    const fraction = ship.design.hullBoxes > 0 ? ship.hullMarked / ship.design.hullBoxes : 0
    const sideColor = sideColorOf(ship.side)
    entry.hullMaterial.color.setHex(ship.destroyed ? WRECK_COLOR : sideColor)
    entry.hullMaterial.emissive.setHex(ship.destroyed ? 0x000000 : damageEmissive(level, fraction))
    entry.hullMaterial.opacity = ship.cloaked ? 0.35 : ship.destroyed ? 0.65 : 1
    entry.hullMaterial.transparent = ship.cloaked || ship.destroyed
    entry.trimMaterial.color.setHex(sideColor)
    entry.trimMaterial.opacity = ship.destroyed ? 0.25 : ship.cloaked ? 0.45 : 0.85

    entry.ring.visible = ship.id === view.selectedId
    entry.targetRing.visible = targetedIds.has(ship.id) && !ship.destroyed

    const screenLevel = ship.destroyed ? 0 : effectiveScreenLevel(ship)
    entry.screen.visible = screenLevel > 0
    entry.screenOuter.visible = screenLevel >= 2
    if (screenLevel > 0) {
      const color = screenBandColor(screenLevel)
      const mat = entry.screen.material as MeshBasicMaterial
      mat.color.setHex(color)
      mat.opacity = screenLevel >= 2 ? 0.38 : 0.26
      if (screenLevel >= 2) {
        const outer = entry.screenOuter.material as MeshBasicMaterial
        outer.color.setHex(color)
        outer.opacity = 0.16
      }
    }

    // Drive glow: an idle flare whenever the drive is fit, brighter and wider
    // while thrust is actually spent this segment (`thrustUsed`) — real state
    // the 2D counter's own glow has no field yet to read (`Counter.tsx`'s
    // `thrusting` prop comment).
    const thrustFit = ship.design.drive.thrust > 0
    const burning = ship.thrustUsed > 0
    for (const engine of entry.engines) {
      const material = engine.material as SpriteMaterial
      material.opacity = ship.destroyed || !thrustFit ? 0 : burning ? 0.95 : 0.55
      const scale = entry.radius * (burning ? 0.55 : 0.34) * (0.6 + Math.min(1, ship.design.drive.thrust / 6) * 0.5)
      engine.scale.setScalar(scale)
    }

    const note =
      view.viewingSide !== null && ship.side !== view.viewingSide && !ship.destroyed ? ` · ${ship.velocity} MU` : ''
    setLabel(
      entry.label,
      `${ship.name}${note}`,
      `l3d-name l3d-${ship.side}${ship.cloaked ? ' is-ghost' : ''}${ship.destroyed ? ' is-wreck' : ''}`,
    )

    const tags: string[] = []
    if (ship.squadronId !== null) tags.push(`squadron ${ship.squadronId}`)
    if (ship.tow !== null) tags.push(ship.tow.linked ? 'under tow, linked (16.3)' : 'under tow')
    setTooltip(
      entry.group,
      `${ship.name}\n${ship.destroyed ? 'destroyed' : `${ship.design.hullBoxes - ship.hullMarked}/${ship.design.hullBoxes} hull · ${level}`}` +
        (tags.length > 0 ? `\n${tags.join(' · ')}` : ''),
    )
  }

  private buildEntry(ship: ShipState): Entry {
    const radius = Math.max(0.5, counterRadius(ship.design.mass))
    const hullGeo: HullGeometry = buildHull(ship.design, radius)

    const group = new Group()
    tagPickable(group, { kind: 'ship', id: ship.id })

    const hullMaterial = new MeshStandardMaterial({ roughness: 0.75, metalness: 0.25 })
    const hull = new Mesh(hullGeo.plating, hullMaterial)
    group.add(hull)

    const trimMaterial = new LineBasicMaterial({ transparent: true, toneMapped: false })
    const trim = new LineSegments(hullGeo.trim, trimMaterial)
    group.add(trim)

    let spineBar: Mesh | null = null
    if (hullGeo.spine) {
      const length = Math.max(0.05, hullGeo.spine.z2 - hullGeo.spine.z1)
      const mid = (hullGeo.spine.z1 + hullGeo.spine.z2) / 2
      const barGeometry = new PlaneGeometry(Math.max(0.05, radius * 0.07), 1).rotateX(-Math.PI / 2)
      spineBar = new Mesh(barGeometry, new MeshBasicMaterial({ color: 0xffe9b0, toneMapped: false, side: DoubleSide }))
      spineBar.scale.z = length
      spineBar.position.set(0, hullGeo.top + 0.01, mid)
      group.add(spineBar)
    }

    const engines = hullGeo.engineMounts.map(({ x, z }) => {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: glowTexture(),
          color: 0x8fd0ff,
          blending: AdditiveBlending,
          depthWrite: false,
          transparent: true,
          toneMapped: false,
        }),
      )
      sprite.position.set(x, hullGeo.top * 0.4, z + radius * 0.05)
      group.add(sprite)
      return sprite
    })

    const ring = new Mesh(
      new RingGeometry(radius * 1.25, radius * 1.4, 32).rotateX(-Math.PI / 2),
      new MeshStandardMaterial({ color: 0xffd766, emissive: 0xffd766, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }),
    )
    ring.visible = false
    group.add(ring)

    // A ring for whatever this ship's FireCon is locked onto (4.4) — separate
    // from the gold selection ring so "selected" and "targeted by it" never
    // read as the same fact.
    const targetRing = new Mesh(
      new RingGeometry(radius * 1.5, radius * 1.62, 32).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.8, toneMapped: false, side: DoubleSide }),
    )
    targetRing.visible = false
    group.add(targetRing)

    // Screens: a faint unlit shell round the hull, not a coin under it — kept
    // to MeshBasicMaterial on purpose (a MeshStandardMaterial coin bloomed
    // into a huge halo under direct sun). A second, larger and fainter shell
    // only shown at level 2 tells the levels apart at a glance.
    const screen = new Mesh(
      new RingGeometry(radius * 0.75, radius * 1.15, 28).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, side: DoubleSide }),
    )
    screen.visible = false
    group.add(screen)
    const screenOuter = new Mesh(
      new RingGeometry(radius * 1.22, radius * 1.46, 28).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, side: DoubleSide }),
    )
    screenOuter.visible = false
    group.add(screenOuter)

    const label = makeLabel(ship.name, `l3d-name l3d-${ship.side}`)
    label.position.set(0, radius * 0.9 + 0.5, 0)
    group.add(label)

    this.group.add(group)
    return {
      group,
      hull,
      hullMaterial,
      trim,
      trimMaterial,
      spineBar,
      engines,
      ring,
      targetRing,
      screen,
      screenOuter,
      label,
      radius,
      destroyed: ship.destroyed,
      bobPhase: Math.random() * Math.PI * 2,
      tumble: { x: (Math.random() - 0.5) * 0.15, z: (Math.random() - 0.5) * 0.15 },
    }
  }

  /** 3.7's squadrons: a faint line through every member still on the table, so a formation reads as one even before a player opens the panel. */
  private updateSquadronMarks(visible: readonly ShipState[]): void {
    const bySquadron = new Map<string, ShipState[]>()
    for (const ship of visible) {
      if (ship.squadronId === null || ship.destroyed) continue
      const list = bySquadron.get(ship.squadronId) ?? []
      list.push(ship)
      bySquadron.set(ship.squadronId, list)
    }
    for (const [squadronId, ships] of bySquadron) {
      if (ships.length < 2) continue
      ships.sort((a, b) => a.id.localeCompare(b.id))
      const points = ships
        .map((ship) => this.entries.get(ship.id)?.group.position)
        .filter((p): p is Vector3 => p !== undefined)
      if (points.length < 2) continue
      let line = this.squadronLines.get(squadronId)
      if (!line) {
        line = new Line(new BufferGeometry(), new LineBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.5, depthTest: false, toneMapped: false }))
        line.renderOrder = 1
        this.squadronLines.set(squadronId, line)
        this.group.add(line)
      }
      line.geometry.setFromPoints(points.map((p) => new Vector3(p.x, p.y, p.z)))
    }
    for (const [id, line] of this.squadronLines) {
      if (bySquadron.has(id) && (bySquadron.get(id)?.length ?? 0) >= 2) continue
      this.group.remove(line)
      line.geometry.dispose()
      ;(line.material as LineBasicMaterial).dispose()
      this.squadronLines.delete(id)
    }
  }

  /** 16.3's tow: a tether from a hulk under tow to the tug hauling it. */
  private updateTowMarks(visible: readonly ShipState[]): void {
    const live = new Set<string>()
    for (const ship of visible) {
      if (ship.tow === null || ship.destroyed) continue
      const loadPos = this.entries.get(ship.id)?.group.position
      const tugPos = this.entries.get(ship.tow.tugId)?.group.position
      if (!loadPos || !tugPos) continue
      live.add(ship.id)
      let line = this.towLines.get(ship.id)
      if (!line) {
        line = new Line(
          new BufferGeometry(),
          new LineBasicMaterial({ color: ship.tow.linked ? 0xd8b26b : 0x8b97b0, transparent: true, opacity: 0.75, depthTest: false, toneMapped: false }),
        )
        line.renderOrder = 1
        this.towLines.set(ship.id, line)
        this.group.add(line)
      }
      ;(line.material as LineBasicMaterial).color.setHex(ship.tow.linked ? 0xd8b26b : 0x8b97b0)
      line.geometry.setFromPoints([loadPos.clone(), tugPos.clone()])
    }
    for (const [id, line] of this.towLines) {
      if (live.has(id)) continue
      this.group.remove(line)
      line.geometry.dispose()
      ;(line.material as LineBasicMaterial).dispose()
      this.towLines.delete(id)
    }
  }

  tick({ now, dt, reducedMotion }: FrameContext): void {
    if (!reducedMotion) {
      for (const entry of this.entries.values()) {
        if (entry.destroyed) {
          // A wreck drifts rather than sitting dead level — a slow, gentle
          // tumble on its own axis (radians/second, so it turns the same
          // whatever the frame rate), clear of the heading rotation the
          // group still carries.
          entry.hull.rotation.x += entry.tumble.x * dt
          entry.hull.rotation.z += entry.tumble.z * dt
          entry.trim.rotation.copy(entry.hull.rotation)
          continue
        }
        const bob = Math.sin(now / 900 + entry.bobPhase) * 0.03
        entry.hull.position.y = bob
        entry.trim.position.y = bob
      }
    }
    for (const [id, entry] of this.entries) {
      const highlighted = id === this.hovered
      entry.hullMaterial.emissiveIntensity = highlighted ? 1.4 : 1
      if (entry.ring.visible) {
        const pulse = 0.6 + 0.25 * Math.sin(now / 260)
        ;(entry.ring.material as MeshStandardMaterial).opacity = pulse
      }
      if (entry.targetRing.visible) {
        const pulse = 0.5 + 0.3 * Math.sin(now / 200)
        ;(entry.targetRing.material as MeshBasicMaterial).opacity = pulse
      }
    }
  }

  /** Every hull's clickable root, for `BattleScene`'s raycaster — the whole model, not just its plating. */
  pickables(): Group[] {
    return Array.from(this.entries.values()).map((entry) => entry.group)
  }

  dispose(): void {
    // `disposeTree` walks every child of `this.group`, squadron and tow
    // lines included, and disposes each one's own geometry and material.
    disposeTree(this.group)
    this.entries.clear()
    this.squadronLines.clear()
    this.towLines.clear()
  }
}
