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
  Color,
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
  ShaderMaterial,
  SphereGeometry,
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
import { glowTexture, platingTexture } from './textures'
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

/** A name chip is full strength within this many MU of the camera, and fully faded by the far one — the Tilt preset's own usual working range. */
const LABEL_NEAR = 13
const LABEL_FAR = 50

/**
 * A hull's own gunmetal — the plating's base colour now that the side colour
 * has moved to trim, running lights and the bridge strip instead of painting
 * the whole hull (visual note: "flat pastel slabs in the side colour").
 */
const GUNMETAL = 0x878d98
/** Where a crippled hull's plating settles: charred, not just tinted. */
const CRIPPLED_COLOR = 0x2c2724
/**
 * A wash for a ship the rules call crippled (4.12: two hull rows gone, no
 * offensive armament, no FireCon, or no thrust) even when its boxes marked
 * alone would read lighter — a ship crippled by its guns and drive going
 * quiet should not look barely scratched. Kept apart from the heaviest
 * fraction-driven wash `damageTint` gives (visual note: the two used to
 * share a colour and read as the same hurt) — flickered in `tick`, not lit
 * steady, so it reads as live damage rather than a fixed paint job.
 */
const CRIPPLED_EMISSIVE = 0xb23a1e
const WRECK_COLOR = 0x121214
/** An ember's own colour, for the handful that flicker over a fresh wreck. */
const EMBER_COLOR = 0xff6a2e
/** Reused rather than allocated every frame: the shade ordinary damage lerps the gunmetal toward. */
const _soot = new Color(0x18140f)

/**
 * A fresnel rim: near-invisible face-on, brighter toward the silhouette's own
 * edge — a shell round the hull rather than a coin under it, so a screen
 * reads as a field the hull sits inside, not a hat brim (visual note: "a big
 * opaque gold donut"). Plain per-pixel three-term fresnel, no lighting model,
 * so it costs nothing next to twenty hulls' own PBR plating. `uMin` keeps a
 * whisper of colour even head-on — a screen never quite disappears, the way
 * armour glass never quite unions with the void behind it — and `uPower`
 * is the one knob that tells level 1 and level 2 apart.
 */
const FRESNEL_VERTEX = `
varying vec3 vNormal;
varying vec3 vViewPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`
const FRESNEL_FRAGMENT = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPower;
uniform float uMin;
varying vec3 vNormal;
varying vec3 vViewPosition;
void main() {
  float facing = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
  float rim = uMin + (1.0 - uMin) * pow(1.0 - facing, uPower);
  gl_FragColor = vec4(uColor, rim * uOpacity);
}
`

function screenMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(0xffffff) },
      uOpacity: { value: 0 },
      uPower: { value: 2.4 },
      uMin: { value: 0.015 },
    },
    vertexShader: FRESNEL_VERTEX,
    fragmentShader: FRESNEL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    // Tone-mapped once, in `OutputPass` — matched to the other translucent
    // overlays in this view (rings, trim), all `toneMapped: false` for the
    // same reason: a second, per-material tonemapping pass on top of that
    // would crush a fresnel rim's own highlight back toward grey.
    toneMapped: false,
    side: DoubleSide,
  })
}

/** Unit sphere, scaled per hull into the ellipsoid a screen shell actually wants — shared, never disposed per ship. */
const SCREEN_GEOMETRY = new SphereGeometry(1, 22, 14)
SCREEN_GEOMETRY.userData.shared = true

interface Entry {
  group: Group
  hull: Mesh
  hullMaterial: MeshStandardMaterial
  trim: LineSegments
  trimMaterial: LineBasicMaterial
  spineBar: Mesh | null
  superstructure: Mesh
  bridgeStrip: Mesh
  navLights: Sprite[]
  engines: Sprite[]
  ring: Mesh
  targetRing: Mesh
  screen: Mesh
  screenOuter: Mesh
  embers: Sprite[]
  label: CSS2DObject
  radius: number
  destroyed: boolean
  crippled: boolean
  bobPhase: number
  emberPhase: number[]
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
    entry.crippled = level === 'crippled' && !ship.destroyed
    // The plating stays a neutral gunmetal — the side colour lives in the
    // trim, the running lights and the bridge strip now, not the whole hull
    // (visual note: "flat pastel slabs in the side colour"). Damage darkens
    // it toward soot rather than recolouring it; crippled and a wreck each
    // settle on their own fixed charred shade instead of following the
    // fraction, so those two states never fade into "just a lot of boxes
    // marked" — a wreck's own darkest and least metallic of all.
    if (ship.destroyed) entry.hullMaterial.color.setHex(WRECK_COLOR)
    else if (entry.crippled) entry.hullMaterial.color.setHex(CRIPPLED_COLOR)
    else entry.hullMaterial.color.setHex(GUNMETAL).lerp(_soot, Math.min(0.55, fraction * 0.65))
    entry.hullMaterial.emissive.setHex(ship.destroyed ? 0x000000 : entry.crippled ? CRIPPLED_EMISSIVE : damageTint(fraction))
    entry.hullMaterial.emissiveIntensity = 1
    entry.hullMaterial.roughness = ship.destroyed ? 0.95 : 0.55
    entry.hullMaterial.metalness = ship.destroyed ? 0.12 : 0.6
    entry.hullMaterial.opacity = ship.cloaked ? 0.35 : ship.destroyed ? 0.75 : 1
    entry.hullMaterial.transparent = ship.cloaked || ship.destroyed
    // A wreck has no power left to run its own nav lights or lit trim — its
    // outline goes to a cold, dim grey instead of the side colour.
    entry.trimMaterial.color.setHex(ship.destroyed ? 0x51555e : sideColor)
    entry.trimMaterial.opacity = ship.destroyed ? 0.3 : ship.cloaked ? 0.45 : 0.85
    entry.bridgeStrip.visible = !ship.destroyed
    ;(entry.bridgeStrip.material as MeshBasicMaterial).color.setHex(sideColor)
    ;(entry.bridgeStrip.material as MeshBasicMaterial).opacity = ship.cloaked ? 0.3 : 0.9
    for (const nav of entry.navLights) {
      const mat = nav.material as SpriteMaterial
      mat.opacity = ship.destroyed ? 0 : ship.cloaked ? 0.25 : 0.8
      mat.color.setHex(sideColor)
    }
    for (const ember of entry.embers) ember.visible = ship.destroyed

    entry.ring.visible = ship.id === view.selectedId
    entry.targetRing.visible = targetedIds.has(ship.id) && !ship.destroyed

    const screenLevel = ship.destroyed ? 0 : effectiveScreenLevel(ship)
    entry.screen.visible = screenLevel >= 1
    entry.screenOuter.visible = screenLevel >= 2
    if (screenLevel >= 1) {
      const color = screenBandColor(screenLevel)
      const inner = (entry.screen.material as ShaderMaterial).uniforms
      inner.uColor.value.setHex(color)
      inner.uOpacity.value = screenLevel >= 2 ? 0.4 : 0.28
      inner.uPower.value = screenLevel >= 2 ? 2.4 : 3.4
      if (screenLevel >= 2) {
        const outer = (entry.screenOuter.material as ShaderMaterial).uniforms
        outer.uColor.value.setHex(color)
        outer.uOpacity.value = 0.22
        outer.uPower.value = 2.8
      }
    }

    // Drive glow: an idle flare whenever the drive is fit, brighter and wider
    // in proportion to how much of this segment's thrust is actually being
    // spent (`thrustUsed` against the drive's own rating) — graded rather
    // than a flat on/off, so a hard burn reads hotter than a trickle.
    const thrustFit = ship.design.drive.thrust > 0
    const burnFraction = thrustFit ? Math.min(1, ship.thrustUsed / ship.design.drive.thrust) : 0
    for (const engine of entry.engines) {
      const material = engine.material as SpriteMaterial
      material.opacity = ship.destroyed || !thrustFit ? 0 : 0.5 + burnFraction * 0.5
      const scale = entry.radius * (0.3 + burnFraction * 0.32) * (0.6 + Math.min(1, ship.design.drive.thrust / 6) * 0.5)
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

    // Gunmetal plating, not the side colour: metalness and roughness that
    // pick up the room environment `BattleScene` sets up, and a procedural
    // panel-line texture (`textures.ts`) so the surface itself has grain
    // rather than reading as one flat-shaded fill.
    const hullMaterial = new MeshStandardMaterial({
      color: GUNMETAL,
      map: platingTexture(),
      roughness: 0.55,
      metalness: 0.6,
    })
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

    // The little relief a flat slab does not give on its own: a raised
    // ridge/deckhouse, gunmetal like the rest of the plating (it is built
    // from the same hull, after all).
    const superstructure = new Mesh(hullGeo.superstructure, hullMaterial)
    superstructure.position.set(hullGeo.superstructureAt.x, hullGeo.top, hullGeo.superstructureAt.z)
    // Its own resting height, so `tick`'s idle bob can ride it the same way
    // the plating rides it, rather than leaving it hovering dead still while
    // the hull breathes underneath.
    superstructure.userData.baseY = hullGeo.top
    group.add(superstructure)

    // A bridge strip: a thin lit band across the superstructure's own top, in
    // the side colour — one of the "few emissive accents" next to the running
    // lights, rather than painting the hull in it.
    const bridgeStrip = new Mesh(
      new PlaneGeometry(Math.max(0.04, radius * 0.4), Math.max(0.03, radius * 0.1)).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ toneMapped: false, side: DoubleSide }),
    )
    bridgeStrip.position.set(hullGeo.superstructureAt.x, hullGeo.superstructureAt.top + 0.006, hullGeo.superstructureAt.z)
    group.add(bridgeStrip)

    // Running lights: small, steady, in the side colour — identification the
    // hull itself no longer carries now its plating is neutral gunmetal.
    const navLights = hullGeo.navLights.map(({ x, z }) => {
      const sprite = new Sprite(
        new SpriteMaterial({ map: glowTexture(), blending: AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }),
      )
      sprite.position.set(x, hullGeo.top * 0.7, z)
      sprite.scale.setScalar(Math.max(0.045, radius * 0.075))
      group.add(sprite)
      return sprite
    })

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

    // A handful of embers over a fresh wreck — invisible until `updateShip`
    // marks the hull destroyed — so "dark and broken" reads as still cooling,
    // not simply switched off.
    const embers = Array.from({ length: 3 }, (_, i) => {
      const sprite = new Sprite(
        new SpriteMaterial({ map: glowTexture(), color: EMBER_COLOR, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: false }),
      )
      const along = (i / 2 - 0.5) * hullGeo.halfLength
      sprite.position.set((i % 2 === 0 ? -1 : 1) * radius * 0.22, hullGeo.top * 0.5, along)
      sprite.scale.setScalar(radius * 0.16)
      sprite.visible = false
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

    // Screens: a fresnel shell round the hull rather than a coin under it —
    // barely there face-on, brighter toward its own silhouette, an ellipsoid
    // shaped off this hull's own reach rather than a fixed sphere. A second,
    // larger shell only shown at level 2 tells the two levels apart at a
    // glance, on top of the fresnel power difference `updateShip` sets.
    // Snug to the hull's own reach (a touch of clearance, not a fixed
    // multiple of `radius` — that inflated the beam axis of every hull whose
    // silhouette is narrower than it is long, since `radius` alone tracks the
    // longer axis, and made the whole shell read as an oversized blob rather
    // than a shell the hull sits inside).
    const shellBeam = hullGeo.halfBeam * 1.3 + 0.16
    const shellLength = hullGeo.halfLength * 1.18 + 0.16
    const shellHeight = Math.max(hullGeo.top * 2.1, radius * 0.24)
    const screen = new Mesh(SCREEN_GEOMETRY, screenMaterial())
    screen.scale.set(shellBeam, shellHeight, shellLength)
    screen.position.y = hullGeo.top * 0.5
    screen.visible = false
    group.add(screen)
    const screenOuter = new Mesh(SCREEN_GEOMETRY, screenMaterial())
    screenOuter.scale.set(shellBeam * 1.16, shellHeight * 1.12, shellLength * 1.14)
    screenOuter.position.y = hullGeo.top * 0.5
    screenOuter.visible = false
    group.add(screenOuter)

    // Raised above the hull and off to starboard, chip-styled and small
    // (`three.css`'s own `.l3d-name`) rather than sitting across the model —
    // it turns with the hull, so it stays clear of a neighbour's the same way
    // regardless of heading.
    const label = makeLabel(ship.name, `l3d-name l3d-${ship.side}`)
    label.position.set(radius * 0.85, radius * 0.8 + hullGeo.top + 0.45, 0)
    group.add(label)

    this.group.add(group)
    return {
      group,
      hull,
      hullMaterial,
      trim,
      trimMaterial,
      spineBar,
      superstructure,
      bridgeStrip,
      navLights,
      engines,
      ring,
      targetRing,
      screen,
      screenOuter,
      embers,
      label,
      radius,
      destroyed: ship.destroyed,
      crippled: false,
      bobPhase: Math.random() * Math.PI * 2,
      emberPhase: embers.map(() => Math.random() * Math.PI * 2),
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

  tick({ now, dt, reducedMotion, camera }: FrameContext): void {
    if (!reducedMotion) {
      for (const entry of this.entries.values()) {
        if (entry.destroyed) {
          // A wreck drifts rather than sitting dead level — a slow, gentle
          // tumble on its own axis (radians/second, so it turns the same
          // whatever the frame rate), clear of the heading rotation the
          // group still carries. The superstructure rides along with it —
          // otherwise a "broken hull" would leave its deckhouse hanging
          // perfectly level while the plate under it rolls.
          entry.hull.rotation.x += entry.tumble.x * dt
          entry.hull.rotation.z += entry.tumble.z * dt
          entry.trim.rotation.copy(entry.hull.rotation)
          entry.superstructure.rotation.copy(entry.hull.rotation)
          continue
        }
        const bob = Math.sin(now / 900 + entry.bobPhase) * 0.03
        entry.hull.position.y = bob
        entry.trim.position.y = bob
        entry.superstructure.position.y = (entry.superstructure.userData.baseY as number) + bob
      }
    }
    for (const [id, entry] of this.entries) {
      const highlighted = id === this.hovered
      let intensity = highlighted ? 1.4 : 1
      if (entry.crippled) {
        // Sparking, not a steady glow: three mismatched frequencies
        // multiplied together sit near zero almost all the time and only
        // rarely line up bright, the way arcing damage flashes rather than
        // burning steady — a flat wash here read as "the same colour as the
        // heaviest fraction-driven damage", the very thing this state is
        // meant to stand apart from.
        const t = now / 1000
        const n1 = Math.sin(t * 8.7 + entry.bobPhase)
        const n2 = Math.sin(t * 21.3 + entry.bobPhase * 2.6)
        const n3 = Math.sin(t * 5.1 + entry.bobPhase * 4.1)
        const spark = Math.max(0, n1 * n2 * n3)
        intensity *= 0.12 + spark * 2.1
      }
      entry.hullMaterial.emissiveIntensity = intensity

      if (entry.destroyed) {
        for (let i = 0; i < entry.embers.length; i++) {
          const t = now / 1000
          const glow = 0.35 + 0.65 * Math.max(0, Math.sin(t * 3.1 + entry.emberPhase[i]) * Math.sin(t * 5.3 + entry.emberPhase[i] * 2))
          ;(entry.embers[i].material as SpriteMaterial).opacity = glow
        }
      }

      if (entry.ring.visible) {
        const pulse = 0.6 + 0.25 * Math.sin(now / 260)
        ;(entry.ring.material as MeshStandardMaterial).opacity = pulse
      }
      if (entry.targetRing.visible) {
        const pulse = 0.5 + 0.3 * Math.sin(now / 200)
        ;(entry.targetRing.material as MeshBasicMaterial).opacity = pulse
      }

      // The name chip shrinks and fades with distance from the camera — the
      // Tilt preset framing a full fleet puts every hull far enough away that
      // a fixed-size chip would crowd its neighbours (visual note on ships-map
      // #3's 3D counterpart). `CSS2DRenderer` only ever writes `transform`,
      // `display` and `zIndex` on this element, so opacity and font size are
      // ours alone to set here without a fight over who wins.
      const distance = camera.position.distanceTo(entry.group.position)
      const far = Math.min(1, Math.max(0, (distance - LABEL_NEAR) / (LABEL_FAR - LABEL_NEAR)))
      entry.label.element.style.opacity = (1 - far * 0.72).toFixed(2)
      entry.label.element.style.fontSize = `${(9 - far * 2.4).toFixed(1)}px`
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
