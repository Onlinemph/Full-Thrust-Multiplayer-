/**
 * Terrain (17) and Jump Gates (11.9), in 3D.
 *
 * Every `TerrainKind` gets its own real geometry rather than one shared disc:
 * worlds (`planet`, `planetoid`) as lit, textured spheres with an atmosphere
 * on a planet and a footprint ring at the true rules radius (2.1); asteroid
 * fields and debris as instanced rock fields that slowly tumble; dust clouds
 * and nebulae as soft additive volumes rather than solid balls; minefields as
 * a scatter of blinking motes inside a dashed hazard ring; a solar-flare body
 * as a small sun that visibly brightens on the turn it actually flares
 * (17.3). Any feature that carries `gravity` (17.9) or `orbit` (17.8) gets
 * those drawn too, whatever its kind.
 *
 * Terrain and gates are read fresh from `game.terrain`/`game.gates` every
 * `update` and diffed by id — a scenario is normally fixed for the length of
 * a battle, but OVERLAYS' `placingTerrain` (`place-terrain`) can add a
 * feature mid-game, so this can't build once and stop looking.
 *
 * Nothing here is `Pickable`: terrain and gates take no clicks on the 2D map
 * either — `BattleScene` only raycasts this layer's group for hover text.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Rng } from '../../engine/dice'
import { advance } from '../../engine/geometry'
import { isGateActive } from '../../engine/ftl'
import type { GameState, LogEntry, TerrainFeature } from '../../engine/game'
import { createGravityWell, type GravityWell } from '../../engine/terrain'
import type { Course } from '../../engine/types'
import { makeLabel, type CSS2DObject } from './labels'
import { disposeTree, setTooltip, type FrameContext, type Layer, type LayerContext } from './layer'
import { headingToYaw, toWorld } from './space'
import { cloudTexture, glowTexture, worldTexture } from './textures'

/** Just above the board, so footprint rings and hazard rings never z-fight the grid (backdrop.ts uses the same idea). */
const FLOOR = 0.04

const CLOCK_POINTS: readonly Course[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

// ── Pure helpers (tested in terrain.test.ts) ────────────────────────────────

/** A stable, cheap hash from a feature's id to a numeric seed. */
export function hashId(id: string): number {
  let n = 0
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) | 0
  return n ^ 0x1d3f
}

/** How many rocks a field's InstancedMesh gets, bounded so a huge field never tanks the frame rate. */
export function rockCountFor(radius: number, factor: number): number {
  const area = Math.PI * radius * radius
  return Math.max(12, Math.min(220, Math.round(area * factor)))
}

/** The label text every terrain feature shows: its kind, or a scenario-given name over it. */
export function terrainLabelText(feature: Pick<TerrainFeature, 'kind' | 'label'>): string {
  return feature.label ?? feature.kind.replace(/-/g, ' ')
}

/** Whether a `solar-flare` feature actually flared this turn (17.3) — read off the battle log `rollSolarFlares` writes, not re-diced here. */
export function flaredThisTurn(
  game: { turn: number; log: readonly Pick<LogEntry, 'turn' | 'text'>[] },
  feature: Pick<TerrainFeature, 'label'>,
): boolean {
  const text = `${feature.label ?? 'The star'} flares (17.3)`
  return game.log.some((entry) => entry.turn === game.turn && entry.text === text)
}

// ── Shared rock geometry (asteroid fields and debris) ───────────────────────

function positionHash(x: number, y: number, z: number): number {
  const kx = Math.round(x * 1000)
  const ky = Math.round(y * 1000)
  const kz = Math.round(z * 1000)
  let h = (kx * 374761393 + ky * 668265263 + kz * 69069) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Smooth lumpy noise over a unit direction: low-frequency waves plus fine per-vertex jitter, so a rock has a shape rather than being a jittered ball. */
function lumps(x: number, y: number, z: number, seed: number): number {
  const a = Math.sin(x * 2.1 + seed) * Math.cos(y * 1.7 - seed * 0.7)
  const b = Math.sin(z * 2.9 + seed * 1.3) * Math.sin(x * 1.3 + y * 2.2)
  const c = Math.cos(y * 4.3 + z * 3.1 + seed * 2.1)
  return a * 0.22 + b * 0.16 + c * 0.07
}

/** A handful of shared rock shapes: subdivided icosahedra pushed out by lumpy noise and squashed, seams welded so they shade as stone rather than cut gems. */
function buildRockGeometries(): BufferGeometry[] {
  const variants: BufferGeometry[] = []
  for (let v = 0; v < 4; v++) {
    const base = mergeVertices(new IcosahedronGeometry(1, v % 2 === 0 ? 2 : 1).deleteAttribute('normal').deleteAttribute('uv'))
    const pos = base.attributes.position
    const squash = [0.62, 0.8, 0.7, 0.9][v]
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const r = 1 + lumps(x, y, z, v * 1.9) + (positionHash(x, y, z) - 0.5) * 0.14
      pos.setXYZ(i, x * r, y * r * squash, z * r)
    }
    base.computeVertexNormals()
    base.userData.shared = true
    variants.push(base)
  }
  return variants
}
const ROCK_GEOMETRIES = buildRockGeometries()
const ROCK_MATERIAL = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.02, envMapIntensity: 0.08 })
ROCK_MATERIAL.userData.shared = true
/** Slate, basalt, rust and a rare pale silicate — an asteroid field's rock tones. */
const FIELD_TONES: ReadonlyArray<readonly [number, number, number]> = [
  [0.2, 0.2, 0.21],
  [0.14, 0.135, 0.14],
  [0.25, 0.18, 0.13],
  [0.33, 0.3, 0.26],
]
/** Scorched, twisted metal, greys through a rare rust-orange — debris' own palette (17). */
const DEBRIS_TONES: ReadonlyArray<readonly [number, number, number]> = [
  [0.16, 0.16, 0.17],
  [0.1, 0.1, 0.11],
  [0.3, 0.16, 0.08],
  [0.22, 0.22, 0.24],
]
const DUST_MATERIAL = new PointsMaterial({ color: 0x8f877c, size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false })
DUST_MATERIAL.userData.shared = true

/** A flat ring lying on the board, for a footprint or a hazard boundary. */
function flatRing(radius: number, color: number, opacity: number, dashed = false, segments = 96): LineLoop {
  const points: number[] = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    points.push(Math.cos(a) * radius, FLOOR, Math.sin(a) * radius)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(points, 3))
  const line = new LineLoop(
    geo,
    dashed
      ? new LineDashedMaterial({ color, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity, toneMapped: false })
      : new LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false }),
  )
  if (dashed) line.computeLineDistances()
  return line
}

// ── Gravity zones (17.9) and orbit tracks (17.8) — drawn for any kind ───────

/** 17.9's concentric rings, at the well's own zone radii, strength-tinted from faint (outer) to hot (a sun's own inner ring). */
function buildGravityRings(feature: TerrainFeature): Group | null {
  if (!feature.gravity) return null
  const well: GravityWell = createGravityWell({ x: 0, y: 0 }, feature.radius, feature.gravity)
  const group = new Group()
  for (const zone of well.zones) {
    const color = zone.strength >= 8 ? 0xff8a3c : zone.strength >= 4 ? 0xffc24a : zone.strength >= 2 ? 0xb79cff : 0x6a7a9a
    group.add(flatRing(zone.radius, color, 0.22 + zone.strength * 0.03))
  }
  return group
}

/** 17.8's orbit track: the body's own edge, marked with the twelve clock-face points a ship in orbit is placed on. */
function buildOrbitMarkers(feature: TerrainFeature): Group | null {
  if (!feature.orbit) return null
  const group = new Group()
  const dotGeo = new SphereGeometry(Math.max(0.08, feature.radius * 0.02), 8, 6)
  const dotMat = new MeshBasicMaterial({ color: 0xc9d4f0, transparent: true, opacity: 0.85, toneMapped: false })
  for (const point of CLOCK_POINTS) {
    const at = advance({ x: 0, y: 0 }, point, feature.radius)
    const dot = new Mesh(dotGeo, dotMat)
    dot.position.copy(toWorld(at, FLOOR))
    group.add(dot)
  }
  return group
}

function attachExtras(root: Group, feature: TerrainFeature): void {
  const gravity = buildGravityRings(feature)
  if (gravity) root.add(gravity)
  const orbit = buildOrbitMarkers(feature)
  if (orbit) root.add(orbit)
}

function damageNote(feature: TerrainFeature): string {
  return feature.damagePoints !== undefined ? ` · ${feature.damageTaken ?? 0}/${feature.damagePoints} damage` : ''
}

// ── Entries ──────────────────────────────────────────────────────────────

interface WorldEntry {
  root: Group
  sphere: Mesh
  spin: number
}

interface RockInstance {
  mesh: InstancedMesh
  index: number
  position: Vector3
  scale: Vector3
  axis: Vector3
  rate: number
  quat: Quaternion
}

interface FieldEntry {
  root: Group
  meshes: InstancedMesh[]
  rocks: RockInstance[]
}

interface CloudPuff {
  sprite: Sprite
  baseY: number
  phase: number
  spin: number
}

interface CloudEntry {
  root: Group
  puffs: CloudPuff[]
}

interface MineEntry {
  root: Group
  motes: Sprite[]
  phase: number
}

interface FlareEntry {
  root: Group
  sun: Mesh
  corona: Sprite
  flared: boolean
}

interface GateEntry {
  group: Group
  ring: Mesh
  nose: Mesh | null
  label: CSS2DObject
}

export class TerrainLayer implements Layer {
  readonly group = new Group()
  private features = new Group()
  private gatesGroup = new Group()

  private worlds = new Map<string, WorldEntry>()
  private fields = new Map<string, FieldEntry>()
  private clouds = new Map<string, CloudEntry>()
  private mines = new Map<string, MineEntry>()
  private flares = new Map<string, FlareEntry>()
  private gates = new Map<string, GateEntry>()

  // Reused every frame so tumbling asteroids allocate nothing.
  private tmpDelta = new Quaternion()
  private tmpMatrix = new Matrix4()

  constructor() {
    this.group.name = 'terrain'
    this.group.add(this.features, this.gatesGroup)
  }

  update({ game }: LayerContext): void {
    this.updateFeatures(game)
    this.updateGates(game)
  }

  // ── Terrain ──────────────────────────────────────────────────────────────

  private updateFeatures(game: GameState): void {
    const liveWorlds = new Set<string>()
    const liveFields = new Set<string>()
    const liveClouds = new Set<string>()
    const liveMines = new Set<string>()
    const liveFlares = new Set<string>()
    for (const feature of game.terrain) {
      switch (feature.kind) {
        case 'planet':
        case 'planetoid': {
          liveWorlds.add(feature.id)
          let entry = this.worlds.get(feature.id)
          if (!entry) {
            entry = this.buildWorld(feature)
            this.worlds.set(feature.id, entry)
          }
          setTooltip(entry.root, `${terrainLabelText(feature)} · ${feature.radius} MU${damageNote(feature)}`)
          break
        }
        case 'asteroid-field':
        case 'debris': {
          liveFields.add(feature.id)
          if (!this.fields.has(feature.id)) this.fields.set(feature.id, this.buildField(feature))
          const entry = this.fields.get(feature.id)!
          setTooltip(entry.root, `${terrainLabelText(feature)} · ${feature.radius} MU${damageNote(feature)}`)
          break
        }
        case 'dust-cloud':
        case 'nebula': {
          liveClouds.add(feature.id)
          if (!this.clouds.has(feature.id)) this.clouds.set(feature.id, this.buildCloud(feature))
          const entry = this.clouds.get(feature.id)!
          setTooltip(entry.root, `${terrainLabelText(feature)} · ${feature.radius} MU${damageNote(feature)}`)
          break
        }
        case 'minefield': {
          liveMines.add(feature.id)
          if (!this.mines.has(feature.id)) this.mines.set(feature.id, this.buildMine(feature))
          const entry = this.mines.get(feature.id)!
          setTooltip(entry.root, `${terrainLabelText(feature)} · ${feature.radius} MU${damageNote(feature)}`)
          break
        }
        case 'solar-flare': {
          liveFlares.add(feature.id)
          if (!this.flares.has(feature.id)) this.flares.set(feature.id, this.buildFlare(feature))
          this.restyleFlare(this.flares.get(feature.id)!, feature, game)
          break
        }
      }
    }
    this.prune(this.worlds, liveWorlds)
    this.prune(this.fields, liveFields)
    this.prune(this.clouds, liveClouds)
    this.prune(this.mines, liveMines)
    this.prune(this.flares, liveFlares)
  }

  private prune<T extends { root: Group }>(map: Map<string, T>, live: Set<string>): void {
    for (const [id, entry] of map) {
      if (live.has(id)) continue
      this.features.remove(entry.root)
      disposeTree(entry.root)
      map.delete(id)
    }
  }

  /** A lit, procedurally-textured sphere: an atmosphere shell on a planet, and a footprint ring at the true rules radius (2.1). */
  private buildWorld(feature: TerrainFeature): WorldEntry {
    const root = new Group()
    root.name = `terrain:${feature.id}`
    root.position.copy(toWorld(feature.position))

    const seed = hashId(feature.id)
    const isPlanet = feature.kind === 'planet'
    const sphere = new Mesh(
      new SphereGeometry(feature.radius, 40, 26),
      new MeshStandardMaterial({
        map: worldTexture(seed, isPlanet ? 'planet' : 'planetoid'),
        color: 0xb4b4b4,
        roughness: isPlanet ? 0.8 : 0.96,
        metalness: 0,
        envMapIntensity: 0.05,
      }),
    )
    sphere.name = 'body'
    root.add(sphere)

    if (isPlanet) {
      const rng = new Rng((seed ^ 0x9a3) >>> 0)
      const tint = new Color().setHSL((rng.next() + 0.55) % 1, 0.55, 0.62)
      const shell = new Mesh(
        new SphereGeometry(feature.radius * 1.05, 32, 22),
        new MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.14, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      )
      shell.name = 'atmosphere'
      root.add(shell)
    }

    const rim = new Mesh(
      new RingGeometry(feature.radius, feature.radius + 0.12, 96),
      new MeshBasicMaterial({
        color: isPlanet ? 0x9adcff : 0x9aa3b5,
        transparent: true,
        opacity: isPlanet ? 0.7 : 0.45,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: DoubleSide,
      }),
    )
    rim.rotation.x = -Math.PI / 2
    rim.position.y = FLOOR
    root.add(rim)

    const label = makeLabel(terrainLabelText(feature), 'l3d-terrain')
    label.position.set(0, feature.radius + 0.6, 0)
    root.add(label)

    attachExtras(root, feature)
    this.features.add(root)
    const spin = 0.015 + ((hashId(feature.id + 'spin') >>> 0) % 100) * 0.0005
    return { root, sphere, spin }
  }

  /** An InstancedMesh field of jittered rocks: an asteroid field's stone, or debris' twisted wreckage. */
  private buildField(feature: TerrainFeature): FieldEntry {
    const root = new Group()
    root.name = `terrain:${feature.id}`
    root.position.copy(toWorld(feature.position))

    const debris = feature.kind === 'debris'
    const rng = new Rng(hashId(feature.id) >>> 0)
    const total = rockCountFor(feature.radius, debris ? 0.55 : 1.15)
    const tones = debris ? DEBRIS_TONES : FIELD_TONES
    const meshes: InstancedMesh[] = []
    const rocks: RockInstance[] = []

    const perVariant = ROCK_GEOMETRIES.map((_, i) => Math.floor(total / ROCK_GEOMETRIES.length) + (i < total % ROCK_GEOMETRIES.length ? 1 : 0))
    ROCK_GEOMETRIES.forEach((geo, vi) => {
      const count = perVariant[vi]
      if (count === 0) return
      const mesh = new InstancedMesh(geo, ROCK_MATERIAL, count)
      for (let i = 0; i < count; i++) {
        const d = Math.sqrt(rng.next()) * feature.radius * 0.94
        const a = rng.next() * Math.PI * 2
        const k = rng.next()
        const maxSize = debris ? feature.radius * 0.08 : feature.radius * 0.12
        const size = Math.min(maxSize, 0.04 + k * k * k * k * 0.42 + k * 0.08)
        const lift = 0.06 + size * 0.6 + rng.next() * Math.min(1.1, feature.radius * 0.14)
        const position = new Vector3(Math.cos(a) * d, lift, Math.sin(a) * d)
        const scale = debris
          ? new Vector3(size * (0.7 + rng.next() * 0.4), size * (0.3 + rng.next() * 0.35), size * (0.7 + rng.next() * 0.4))
          : new Vector3(size * (0.8 + rng.next() * 0.45), size * (0.8 + rng.next() * 0.45), size * (0.8 + rng.next() * 0.45))
        const quat = new Quaternion().random()
        this.tmpMatrix.compose(position, quat, scale)
        mesh.setMatrixAt(i, this.tmpMatrix)
        const tone = tones[rng.next() < 0.1 ? 3 : Math.floor(rng.next() * 3)]
        const shade = 0.8 + rng.next() * 0.4
        mesh.setColorAt(i, new Color(tone[0] * shade, tone[1] * shade, tone[2] * shade))
        rocks.push({
          mesh,
          index: i,
          position,
          scale,
          axis: new Vector3(rng.next() - 0.5, rng.next() - 0.5, rng.next() - 0.5).normalize(),
          rate: (0.08 + rng.next() * 0.22) / Math.max(0.35, size * 2),
          quat,
        })
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      root.add(mesh)
      meshes.push(mesh)
    })

    if (!debris) {
      const dustCount = Math.min(700, Math.round(total * 4))
      const dust: number[] = []
      for (let i = 0; i < dustCount; i++) {
        const d = Math.sqrt(rng.next()) * feature.radius
        const a = rng.next() * Math.PI * 2
        dust.push(Math.cos(a) * d, 0.04 + rng.next() * Math.min(1.4, feature.radius * 0.18), Math.sin(a) * d)
      }
      const dustGeo = new BufferGeometry()
      dustGeo.setAttribute('position', new Float32BufferAttribute(dust, 3))
      root.add(new Points(dustGeo, DUST_MATERIAL))
    }

    root.add(flatRing(feature.radius, debris ? 0x666a72 : 0x7a7a82, 0.35))

    const label = makeLabel(terrainLabelText(feature), 'l3d-terrain')
    label.position.set(0, feature.radius * 0.4 + 1, 0)
    root.add(label)

    attachExtras(root, feature)
    this.features.add(root)
    return { root, meshes, rocks }
  }

  /**
   * A gas cloud (dust-cloud or nebula): a volume of soft additive puffs, over
   * a faint boundary ring. The puffs skip the depth test — the board would
   * otherwise slice each billboard off in a hard line where it dips below the
   * table — so a ship inside the cloud is veiled by it, which is the point.
   */
  private buildCloud(feature: TerrainFeature): CloudEntry {
    const root = new Group()
    root.name = `terrain:${feature.id}`
    root.position.copy(toWorld(feature.position))

    const nebula = feature.kind === 'nebula'
    const rng = new Rng(hashId(feature.id) >>> 0)
    const tints = nebula ? [0x8a5fd6, 0xb79cff, 0xff8fc4, 0x6a5fd6] : [0x6a7a9a, 0x6fe3c4, 0x8b97b0, 0x5a7a9a]
    const puffCount = Math.max(10, Math.min(30, Math.round(feature.radius * (nebula ? 5 : 3.6))))
    const puffs: CloudPuff[] = []
    for (let i = 0; i < puffCount; i++) {
      const material = new SpriteMaterial({
        map: cloudTexture(1 + ((hashId(feature.id) + i) % 5)),
        color: new Color(tints[i % tints.length]),
        transparent: true,
        opacity: (nebula ? 0.08 : 0.1) + rng.next() * 0.07,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
        toneMapped: false,
        rotation: rng.next() * Math.PI * 2,
      })
      const sprite = new Sprite(material)
      const d = Math.pow(rng.next(), 0.8) * feature.radius * 0.85
      const a = rng.next() * Math.PI * 2
      const size = feature.radius * (0.45 + rng.next() * 0.55) * (1 - (d / feature.radius) * 0.35)
      sprite.scale.set(size, size, 1)
      const baseY = 0.4 + rng.next() * Math.min(2.6, feature.radius * 0.5)
      sprite.position.set(Math.cos(a) * d, baseY, Math.sin(a) * d)
      sprite.renderOrder = 2
      root.add(sprite)
      puffs.push({ sprite, baseY, phase: rng.next() * Math.PI * 2, spin: (rng.next() - 0.5) * 0.05 })
    }

    root.add(flatRing(feature.radius, nebula ? 0xb79cff : 0x6fe3c4, 0.35))

    const label = makeLabel(terrainLabelText(feature), 'l3d-terrain')
    label.position.set(0, feature.radius * 0.35 + 1, 0)
    root.add(label)

    attachExtras(root, feature)
    this.features.add(root)
    return { root, puffs }
  }

  /** A minefield (17): a scatter of small, slowly blinking mines inside a dashed hazard boundary. */
  private buildMine(feature: TerrainFeature): MineEntry {
    const root = new Group()
    root.name = `terrain:${feature.id}`
    root.position.copy(toWorld(feature.position))

    const rng = new Rng(hashId(feature.id) >>> 0)
    const count = Math.max(6, Math.min(60, Math.round(feature.radius * feature.radius * 0.35)))
    const motes: Sprite[] = []
    for (let i = 0; i < count; i++) {
      const material = new SpriteMaterial({
        map: glowTexture(),
        color: new Color(0xff5c4a),
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      })
      const sprite = new Sprite(material)
      sprite.scale.setScalar(0.16 + rng.next() * 0.1)
      const d = Math.sqrt(rng.next()) * feature.radius * 0.96
      const a = rng.next() * Math.PI * 2
      sprite.position.set(Math.cos(a) * d, 0.05 + rng.next() * 0.3, Math.sin(a) * d)
      root.add(sprite)
      motes.push(sprite)
    }

    root.add(flatRing(feature.radius, 0xff5c4a, 0.5, true))

    const label = makeLabel(terrainLabelText(feature), 'l3d-terrain')
    label.position.set(0, 1, 0)
    root.add(label)

    attachExtras(root, feature)
    this.features.add(root)
    return { root, motes, phase: rng.next() * Math.PI * 2 }
  }

  /** A solar-flare body (17.3): a small emissive sun with a soft corona that flares — for real — on the turn `flaredThisTurn` says it did. */
  private buildFlare(feature: TerrainFeature): FlareEntry {
    const root = new Group()
    root.name = `terrain:${feature.id}`
    root.position.copy(toWorld(feature.position))

    const sun = new Mesh(
      new SphereGeometry(feature.radius, 24, 16),
      new MeshStandardMaterial({ color: 0x2a1400, emissive: 0xffaa40, emissiveIntensity: 1.4, roughness: 1 }),
    )
    const corona = new Sprite(
      new SpriteMaterial({
        map: glowTexture(),
        color: new Color(0xffaa40).multiplyScalar(1.4),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    )
    corona.scale.setScalar(feature.radius * 3.2)
    root.add(sun, corona)

    const label = makeLabel(terrainLabelText(feature), 'l3d-terrain')
    label.position.set(0, feature.radius + 0.6, 0)
    root.add(label)

    attachExtras(root, feature)
    this.features.add(root)
    return { root, sun, corona, flared: false }
  }

  private restyleFlare(entry: FlareEntry, feature: TerrainFeature, game: GameState): void {
    entry.flared = flaredThisTurn(game, feature)
    const onRoll = feature.flare?.onRoll ?? 6
    setTooltip(
      entry.root,
      `${terrainLabelText(feature)} · flares on ${onRoll}+ (17.3)${entry.flared ? ' — flaring now' : ''}${damageNote(feature)}`,
    )
  }

  // ── Jump Gates (11.9) ────────────────────────────────────────────────────

  private updateGates(game: GameState): void {
    const seen = new Set<string>()
    for (const gate of game.gates) {
      seen.add(gate.def.id)
      let entry = this.gates.get(gate.def.id)
      if (!entry) {
        const group = new Group()
        const ring = new Mesh(new TorusGeometry(2.4, 0.12, 8, 24), new MeshStandardMaterial({ emissiveIntensity: 1 }))
        ring.rotation.x = Math.PI / 2
        group.add(ring)
        let nose: Mesh | null = null
        if (gate.def.facing !== null) {
          nose = new Mesh(new ConeGeometry(0.3, 1.2, 8), new MeshStandardMaterial())
          nose.rotation.x = Math.PI / 2
          nose.position.z = -3
          group.add(nose)
        }
        const label = makeLabel(gate.def.label ?? gate.def.id, 'l3d-terrain')
        label.position.set(0, 0, 3.4)
        group.add(label)
        this.gatesGroup.add(group)
        entry = { group, ring, nose, label }
        this.gates.set(gate.def.id, entry)
      }
      const active = isGateActive(gate.def, gate.state, game.turn)
      const base = gate.def.kind === 'portal' ? 0x6fe3c4 : 0xb79cff
      const color = new Color(active ? base : 0x555f78)
      const mat = entry.ring.material as MeshStandardMaterial
      mat.color = color
      mat.emissive = color
      if (entry.nose) {
        const noseMat = entry.nose.material as MeshStandardMaterial
        noseMat.color = color
        noseMat.emissive = color
      }
      entry.group.position.copy(toWorld(gate.def.position, 0.6))
      if (gate.def.facing !== null) entry.group.rotation.y = headingToYaw((gate.def.facing % 12) * 30)
      setTooltip(
        entry.ring,
        `${gate.def.label ?? gate.def.id} (${gate.def.kind === 'portal' ? 'portal' : 'jump gate'})${active ? '' : ' — inactive'}\n` +
          `${gate.state.hullMarked}/${gate.def.hullBoxes} hull boxes marked`,
      )
    }
    for (const [id, entry] of this.gates) {
      if (seen.has(id)) continue
      disposeTree(entry.group)
      this.gatesGroup.remove(entry.group)
      this.gates.delete(id)
    }
  }

  // ── Life ─────────────────────────────────────────────────────────────────

  tick({ now, dt, reducedMotion }: FrameContext): void {
    if (reducedMotion) return
    for (const world of this.worlds.values()) world.sphere.rotation.y += dt * world.spin
    for (const field of this.fields.values()) this.tumbleField(field, dt)
    for (const cloud of this.clouds.values()) {
      for (const puff of cloud.puffs) {
        ;(puff.sprite.material as SpriteMaterial).rotation += puff.spin * dt
        puff.sprite.position.y = puff.baseY + Math.sin(now / 4000 + puff.phase) * 0.15
      }
    }
    for (const mine of this.mines.values()) {
      const blink = 0.4 + 0.6 * Math.max(0, Math.sin(now / 900 + mine.phase))
      for (const mote of mine.motes) mote.material.opacity = 0.4 + blink * 0.4
    }
    for (const flare of this.flares.values()) {
      const pulse = flare.flared
        ? 0.85 + 0.15 * Math.sin(now / 90)
        : 0.55 + 0.15 * Math.sin(now / 1400)
      const coronaMat = flare.corona.material as SpriteMaterial
      coronaMat.opacity = flare.flared ? 0.95 : 0.5
      flare.sun.scale.setScalar(pulse)
      flare.corona.scale.setScalar((flare.flared ? 1.7 : 1) * pulse)
      const material = flare.sun.material as MeshStandardMaterial
      material.emissiveIntensity = flare.flared ? 2.6 : 1.4
    }
  }

  private tumbleField(field: FieldEntry, dt: number): void {
    for (const rock of field.rocks) {
      this.tmpDelta.setFromAxisAngle(rock.axis, rock.rate * dt)
      rock.quat.premultiply(this.tmpDelta)
      this.tmpMatrix.compose(rock.position, rock.quat, rock.scale)
      rock.mesh.setMatrixAt(rock.index, this.tmpMatrix)
    }
    for (const mesh of field.meshes) mesh.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    disposeTree(this.group)
    this.worlds.clear()
    this.fields.clear()
    this.clouds.clear()
    this.mines.clear()
    this.flares.clear()
    this.gates.clear()
  }
}
