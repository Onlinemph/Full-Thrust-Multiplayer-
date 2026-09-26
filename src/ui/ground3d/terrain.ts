/**
 * The ground: every `TerrainFeature` (Dirtside p. 25–26, Stargrunt pp. 11–13)
 * raised or sunk to the height its own kind reads as, at the table's own
 * figure scale (`GroundScale`) — BRIEF-GROUND-3D's whole point, that
 * elevation is part of both games. The rules stay exactly what they are
 * (`dirtside/table/terrain.ts`'s `lineOfSight`/`onHighGround`: a whole hill
 * or mountain feature is high ground or it is not); this only ever makes
 * that visible.
 *
 * `heightAt(point)` is what every other ground layer (the base plane in
 * `backdrop.ts`, a game's own units and overlays) stands things on: 0
 * everywhere except inside a hill or mountain, where it is that terrace's
 * own top — "the whole feature counts as high ground" read as "a unit on
 * any part of the hill stands at the hill's own height", terraced rather
 * than sloped so the top is unambiguous. Buildings, woods and rubble raise
 * nothing for `heightAt`: a unit stands beside or among them, never on
 * their roof, in either book's own rules.
 *
 * Every mesh here is added to `this.group`, which `GroundScene` also
 * raycasts (alongside the flat ground plane in `backdrop.ts`) to turn a
 * click anywhere on the table — a hillside, a roof, bare ground — into the
 * table point under it.
 */
import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'
import type { TerrainType } from '../../dirtside/data/mobility'
import { WOOD_EDGE, depthInside, insideShape } from '../../dirtside/table/terrain'
import type { Point, Shape, TerrainFeature } from '../../dirtside/table/types'
import { boundsOf, decorRandom, flatSlab, footprintPoints, gableRoof, hashId, insetShape, prism, ribbonPolygon } from './geometry'
import { disposeTree, setTooltip, tagGround, type FrameContext, type GroundContext, type Layer } from './layer'
import { DST } from './palette'
import type { GroundScale } from './space'
import { furrowTexture, speckleTexture } from './textures'

export const TERRAIN_NAMES: Record<TerrainType, string> = {
  road: 'Road',
  open: 'Open ground',
  'light-scrub': 'Light scrub',
  rough: 'Rough ground',
  cultivated: 'Fields',
  urban: 'Built-up area',
  hills: 'Hill',
  mountains: 'Mountain',
  swamp: 'Swamp',
  'open-water': 'Open water',
  river: 'River',
  'light-woods': 'Light woods',
  'dense-woods': 'Dense woods',
  ford: 'Ford',
  building: 'Building',
  rubble: 'Rubble',
  wall: 'Wall',
  hedge: 'Hedge',
}

function labelOf(feature: Pick<TerrainFeature, 'terrain' | 'label'>): string {
  return feature.label ?? TERRAIN_NAMES[feature.terrain]
}

const HILL_STEP_COLORS = [DST.hillStep1, DST.hillStep2, DST.hillStep3, DST.hillStep4]

/** A shared, double-sided standard material — every terrain surface's own default (see `geometry.ts`'s note on winding). */
function groundMaterial(color: number, opts: { roughness?: number; metalness?: number; map?: MeshStandardMaterial['map']; transparent?: boolean; opacity?: number } = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.92,
    metalness: opts.metalness ?? 0,
    side: DoubleSide,
    map: opts.map ?? null,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  })
}

// ── Shared tree geometry (light and dense woods alike) ──────────────────────

const TRUNK_GEOMETRY = new CylinderGeometry(0.045, 0.07, 1, 6)
TRUNK_GEOMETRY.translate(0, 0.5, 0)
TRUNK_GEOMETRY.userData.shared = true
const TRUNK_MATERIAL = groundMaterial(0x4a3b28, { roughness: 1 })
TRUNK_MATERIAL.userData.shared = true

const CANOPY_ROUND = new IcosahedronGeometry(1, 1)
CANOPY_ROUND.translate(0, 1, 0)
CANOPY_ROUND.userData.shared = true
const CANOPY_CONE = new ConeGeometry(1, 1.7, 7)
CANOPY_CONE.translate(0, 1.2, 0)
CANOPY_CONE.userData.shared = true

interface HillLevel {
  shape: Shape
  top: number
}

interface TreeEntry {
  root: Group
  trunks: InstancedMesh
  canopies: InstancedMesh
  sway: number
}

export class TerrainLayer implements Layer {
  readonly group = new Group()
  private scale: GroundScale | null = null
  private builtFrom: readonly TerrainFeature[] | null = null
  private hillLevels: HillLevel[] = []
  private trees: TreeEntry[] = []
  private clock = 0

  constructor() {
    this.group.name = 'ground-terrain'
  }

  update(ctx: GroundContext, scale: GroundScale): void {
    if (this.builtFrom === ctx.features && this.scale === scale) return
    this.scale = scale
    this.builtFrom = ctx.features
    this.rebuild(ctx.features, scale)
  }

  /** The table height at a point: 0 everywhere but a hill/mountain, where it is that terrace's own top. */
  heightAt(point: Point): number {
    let h = 0
    for (const level of this.hillLevels) {
      if (level.top > h && insideShape(point, level.shape)) h = level.top
    }
    return h
  }

  private rebuild(features: readonly TerrainFeature[], scale: GroundScale): void {
    disposeTree(this.group)
    this.group.clear()
    this.hillLevels = []
    this.trees = []
    for (const feature of features) {
      const built = this.buildFeature(feature, scale)
      if (!built) continue
      built.name = `terrain:${feature.id}`
      setTooltip(built, labelOf(feature))
      this.group.add(built)
    }
  }

  private buildFeature(feature: TerrainFeature, scale: GroundScale): Group | null {
    switch (feature.terrain) {
      case 'hills':
      case 'mountains':
        return this.buildHill(feature, scale)
      case 'building':
        return this.buildBuilding(feature, scale)
      case 'rubble':
        return this.buildRubble(feature, scale)
      case 'light-woods':
      case 'dense-woods':
        return this.buildWoods(feature, scale)
      case 'wall':
        return this.buildRibbon(feature, DST.wallStone, scale.wallHeight, feature.shape.kind === 'path' ? feature.shape.width : 0.2)
      case 'hedge':
        return this.buildRibbon(feature, DST.hedge, scale.hedgeHeight, feature.shape.kind === 'path' ? feature.shape.width : 0.35)
      case 'river':
      case 'open-water':
        return this.buildWater(feature, scale)
      case 'road':
      case 'ford':
        return this.buildRoad(feature, scale)
      case 'swamp':
        return this.buildPatch(feature, speckleTexture('g3d-swamp', DST.swamp, DST.swampWater, DST.swampReed), -scale.waterSink * 0.35)
      case 'rough':
        return this.buildPatch(feature, speckleTexture('g3d-rough', DST.rough, DST.roughRock1, DST.roughRock2), 0.006)
      case 'light-scrub':
        return this.buildPatch(feature, speckleTexture('g3d-scrub', DST.scrub, DST.scrubTuft, DST.scrub), 0.006)
      case 'cultivated':
        return this.buildPatch(feature, furrowTexture('g3d-field', DST.field, DST.fieldFurrow), 0.006)
      case 'urban':
        return this.buildPatch(feature, speckleTexture('g3d-urban', DST.urbanLot, DST.urban, DST.paving, 90), 0.004)
      default:
        return null
    }
  }

  // ── Hills and mountains: terraces from inset outlines, exactly the 2D map's own contour rings ──

  private buildHill(feature: TerrainFeature, scale: GroundScale): Group {
    const root = new Group()
    const rock = feature.terrain === 'mountains'
    const baseColor = rock ? DST.mountain : DST.hill
    let shape: Shape | null = feature.shape
    let level = 0
    let baseY = 0
    const maxLevels = rock ? scale.hillMaxTerraces + 1 : scale.hillMaxTerraces
    while (shape && level <= maxLevels) {
      const top = baseY + scale.hillStep
      const color = level === 0 ? baseColor : HILL_STEP_COLORS[Math.min(level - 1, HILL_STEP_COLORS.length - 1)]!
      const points = footprintPoints(shape)
      const mesh = new Mesh(prism(points, baseY, top), groundMaterial(color, { roughness: rock ? 0.98 : 0.9 }))
      tagGround(mesh)
      root.add(mesh)
      this.hillLevels.push({ shape, top })
      baseY = top
      shape = insetShape(shape, scale.hillTerraceWidth)
      level++
    }
    return root
  }

  // ── Buildings: walls, and a gabled or a flat roof, warm on their own and cool as part of a town (2D's own rule) ──

  private buildBuilding(feature: TerrainFeature, scale: GroundScale): Group {
    const root = new Group()
    const footprint = footprintPoints(feature.shape)
    const rnd = decorRandom(hashId(feature.id))
    const storeys = 1 + Math.floor(rnd() * (feature.terrain === 'building' && feature.partOf ? 3 : 2))
    const wallTop = scale.buildingStorey * storeys
    const walls = new Mesh(prism(footprint, 0, wallTop), groundMaterial(DST.buildingWall, { roughness: 0.85 }))
    tagGround(walls)
    root.add(walls)

    const cool = !!feature.partOf
    const tones = cool ? [DST.roofCool[0]!, DST.roofCool[1]!, DST.roofCool[2]!] : [DST.roofWarm[0]!, DST.roofWarm[1]!, DST.roofWarm[2]!]
    const roofColor = tones[Math.floor(rnd() * tones.length) % tones.length]!

    if (footprint.length === 4) {
      const corners = footprint as [Point, Point, Point, Point]
      const roof = new Mesh(gableRoof(corners, wallTop, wallTop + scale.roofRise), groundMaterial(roofColor, { roughness: 0.75 }))
      tagGround(roof)
      root.add(roof)
    } else {
      const capPoints = insetShape(feature.shape, 0.05)
      const roof = new Mesh(flatSlab(capPoints ? footprintPoints(capPoints) : footprint, wallTop + 0.01), groundMaterial(roofColor, { roughness: 0.8 }))
      tagGround(roof)
      root.add(roof)
    }
    return root
  }

  // ── Rubble: a destroyed building's low, broken heap, in its own footprint ──

  private buildRubble(feature: TerrainFeature, scale: GroundScale): Group {
    const root = new Group()
    const footprint = footprintPoints(feature.shape)
    const base = new Mesh(prism(footprint, 0, scale.rubbleHeight * 0.5), groundMaterial(DST.rubble, { roughness: 1 }))
    tagGround(base)
    root.add(base)
    const box = boundsOf(footprint)
    const rnd = decorRandom(hashId(feature.id) ^ 0x527562)
    const count = Math.max(4, Math.min(24, Math.round(((box.x1 - box.x0) * (box.y1 - box.y0)) / 1.4)))
    const heap = new InstancedMesh(new IcosahedronGeometry(1, 0), groundMaterial(DST.rubbleDark, { roughness: 1 }), count)
    const m = new Matrix4()
    let placed = 0
    let guard = 0
    while (placed < count && guard++ < count * 8) {
      const x = box.x0 + rnd() * (box.x1 - box.x0)
      const y = box.y0 + rnd() * (box.y1 - box.y0)
      if (!insideShape({ x, y }, feature.shape)) continue
      const s = scale.rubbleHeight * (0.5 + rnd() * 0.7)
      m.compose(new Vector3(x, scale.rubbleHeight * 0.5 + s * 0.3, y), new Quaternion().random(), new Vector3(s, s * 0.6, s))
      heap.setMatrixAt(placed, m)
      placed++
    }
    heap.count = placed
    heap.instanceMatrix.needsUpdate = true
    tagGround(heap)
    root.add(heap)
    // A stub of standing wall along part of the outline, low and broken.
    const n = footprint.length
    if (n >= 2) {
      const e = Math.floor(rnd() * n)
      const a = footprint[e]!
      const b = footprint[(e + 1) % n]!
      const stub = new Mesh(ribbonPolygonPrism([a, b], 0.12, 0, scale.rubbleHeight * 1.6), groundMaterial(DST.rubbleStub, { roughness: 1 }))
      root.add(stub)
    }
    return root
  }

  // ── Woods: a canopy of instanced trees filling the outline (BRIEF-GROUND-3D: "the 1\" edge readable") ──

  private buildWoods(feature: TerrainFeature, scale: GroundScale): Group {
    const root = new Group()
    const light = feature.terrain === 'light-woods'
    const footprint = footprintPoints(feature.shape)
    const box = boundsOf(footprint)
    const area = Math.max(0.5, (box.x1 - box.x0) * (box.y1 - box.y0))
    const density = light ? 1.1 : 2.2
    const count = Math.max(6, Math.min(420, Math.round(area * density)))
    const floor = new Mesh(prism(footprint, 0, 0.02), groundMaterial(light ? DST.woodsLight : DST.woodsDense, { roughness: 1 }))
    tagGround(floor)
    root.add(floor)

    const canopyGeo = light ? CANOPY_ROUND : CANOPY_CONE
    const canopyColor = light ? DST.woodsLightTree : DST.woodsDenseTree
    const trunks = new InstancedMesh(TRUNK_GEOMETRY, TRUNK_MATERIAL, count)
    const canopies = new InstancedMesh(canopyGeo, groundMaterial(canopyColor, { roughness: 1 }), count)
    const rnd = decorRandom(hashId(feature.id))
    const m = new Matrix4()
    let placed = 0
    let guard = 0
    while (placed < count && guard++ < count * 6) {
      const x = box.x0 + rnd() * (box.x1 - box.x0)
      const y = box.y0 + rnd() * (box.y1 - box.y0)
      const p = { x, y }
      if (!insideShape(p, feature.shape)) continue
      const edge = light && depthInside(p, feature.shape) <= WOOD_EDGE ? 0.85 : 1
      const h = scale.treeHeight * (0.75 + rnd() * 0.5) * edge
      const r = scale.treeRadius * (0.7 + rnd() * 0.5) * edge
      const trunkH = scale.trunkHeight * (0.8 + rnd() * 0.4)
      m.compose(new Vector3(x, 0, y), new Quaternion(), new Vector3(r * 0.4, trunkH, r * 0.4))
      trunks.setMatrixAt(placed, m)
      m.compose(new Vector3(x, trunkH, y), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rnd() * Math.PI * 2), new Vector3(r, h, r))
      canopies.setMatrixAt(placed, m)
      placed++
    }
    trunks.count = placed
    canopies.count = placed
    trunks.instanceMatrix.needsUpdate = true
    canopies.instanceMatrix.needsUpdate = true
    tagGround(trunks)
    tagGround(canopies)
    root.add(trunks, canopies)
    this.trees.push({ root, trunks, canopies, sway: hashId(feature.id) % 100 })
    return root
  }

  // ── Walls and hedges: low lines along their path ──────────────────────────

  private buildRibbon(feature: TerrainFeature, color: number, height: number, width: number): Group {
    const root = new Group()
    const points = feature.shape.kind === 'path' ? feature.shape.points : footprintPoints(feature.shape)
    const mesh = new Mesh(ribbonPolygonPrism(points, width, 0, height), groundMaterial(color, { roughness: 0.95 }))
    tagGround(mesh)
    root.add(mesh)
    return root
  }

  // ── Rivers and open water: a sunken, gently tinted surface with a pale bank ──

  private buildWater(feature: TerrainFeature, scale: GroundScale): Group {
    const root = new Group()
    const footprint = footprintPoints(feature.shape)
    const surface = new Mesh(flatSlab(footprint, -scale.waterSink), groundMaterial(DST.water, { roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.92 }))
    tagGround(surface)
    root.add(surface)
    const bed = new Mesh(prism(footprint, -scale.waterSink * 1.6, -scale.waterSink), groundMaterial(new Color(DST.water).multiplyScalar(0.55).getHex(), { roughness: 1 }))
    root.add(bed)
    return root
  }

  // ── Roads and fords: a flat, draped surface, lifted a hair off bare ground ──

  private buildRoad(feature: TerrainFeature, scale: GroundScale): Group {
    const root = new Group()
    const footprint = footprintPoints(feature.shape)
    const tone = feature.terrain === 'ford' ? DST.tarmac : DST.road
    const mesh = new Mesh(flatSlab(footprint, scale.roadLift), groundMaterial(tone, { roughness: 0.95 }))
    tagGround(mesh)
    root.add(mesh)
    return root
  }

  // ── Rough, scrub, fields, urban lots: a textured patch draped flat ─────────

  private buildPatch(feature: TerrainFeature, map: MeshStandardMaterial['map'], y: number): Group {
    const root = new Group()
    const footprint = footprintPoints(feature.shape)
    const mesh = new Mesh(flatSlab(footprint, y), groundMaterial(0xffffff, { map, roughness: 0.95 }))
    tagGround(mesh)
    root.add(mesh)
    return root
  }

  // ── Life: a light sway on the canopies, honouring prefers-reduced-motion ──

  tick({ dt, reducedMotion }: FrameContext): void {
    if (reducedMotion || this.trees.length === 0) return
    this.clock += dt
  }

  dispose(): void {
    disposeTree(this.group)
    this.hillLevels = []
    this.trees = []
    this.builtFrom = null
  }
}

/** A prism standing over a polyline's own ribbon footprint — the shared shape behind walls, hedges and a rubbled stub of wall. */
function ribbonPolygonPrism(points: readonly Point[], width: number, baseY: number, topY: number): BufferGeometry {
  return prism(ribbonPolygon(points, width), baseY, topY)
}
