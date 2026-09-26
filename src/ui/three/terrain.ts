/**
 * PLACEHOLDER (stage 2, WORLD) — every `TerrainFeature` (17) and 11.9's Jump
 * Gates, in 3D.
 *
 * Today every terrain kind is the same lit sphere, tinted a little by kind
 * and sized to its true `radius` (2.1), with hover text carrying the kind and
 * radius — the 2D map's own `terrain-body`/`terrain-cloud` circle, given a
 * third dimension. WORLD's real job: asteroid fields as real rock fields,
 * planets with atmospheres (and, on a body big enough, 17.8's orbit track —
 * the twelve clock-face points the 2D map marks around its edge), dust
 * clouds and nebulae as translucent volumes rather than solid balls, gravity
 * zones as faint rings at `gravity.zoneWidth` steps outward, a `solar-flare`
 * body flagged somehow when it is due to flare. Diff by `feature.id` and
 * `gate.def.id` — nothing here needs to be pickable (17's features and the
 * gates take no clicks on the 2D map either), only hoverable.
 *
 * Gates are placeholders here too: a ring with a nose tick on the entry
 * facing (mirroring the 2D `<circle>`+`<line>`), tinted by whether
 * `isGateActive` says this side may use it this turn.
 */
import { Color, ConeGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, RingGeometry, TorusGeometry } from 'three'
import { isGateActive } from '../../engine/ftl'
import type { GameState, TerrainFeature, TerrainKind } from '../../engine/game'
import { disposeTree, setTooltip, type FrameContext, type Layer, type LayerContext } from './layer'
import { headingToYaw, toWorld } from './space'

const KIND_COLOR: Record<TerrainKind, number> = {
  planet: 0x8a6a4a,
  planetoid: 0x9a8a78,
  'asteroid-field': 0x7a7a82,
  'dust-cloud': 0x6a7a9a,
  nebula: 0x8a5fd6,
  debris: 0x666a72,
  minefield: 0xaa5a4a,
  'solar-flare': 0xffaa40,
}

interface Entry {
  group: Group
  radius: number
  kind: TerrainKind
}

interface GateEntry {
  group: Group
  ring: Mesh
  nose: Mesh | null
}

export class TerrainLayer implements Layer {
  readonly group = new Group()
  private features = new Map<string, Entry>()
  private gates = new Map<string, GateEntry>()

  constructor() {
    this.group.name = 'terrain'
  }

  update({ game }: LayerContext): void {
    this.updateFeatures(game.terrain)
    this.updateGates(game)
  }

  private updateFeatures(features: readonly TerrainFeature[]): void {
    const seen = new Set<string>()
    for (const feature of features) {
      seen.add(feature.id)
      let entry = this.features.get(feature.id)
      if (!entry || entry.radius !== feature.radius || entry.kind !== feature.kind) {
        if (entry) {
          disposeTree(entry.group)
          this.group.remove(entry.group)
        }
        const group = new Group()
        const body = discLike(feature.radius, KIND_COLOR[feature.kind])
        group.add(body)
        this.group.add(group)
        entry = { group, radius: feature.radius, kind: feature.kind }
        this.features.set(feature.id, entry)
      }
      setTooltip(entry.group, `${terrainLabel(feature.kind)} · ${feature.radius} MU${feature.label ? ` · ${feature.label}` : ''}`)
      entry.group.position.copy(toWorld(feature.position, feature.radius * 0.02))
    }
    for (const [id, entry] of this.features) {
      if (seen.has(id)) continue
      disposeTree(entry.group)
      this.group.remove(entry.group)
      this.features.delete(id)
    }
  }

  private updateGates(game: GameState): void {
    const seen = new Set<string>()
    for (const gate of game.gates) {
      seen.add(gate.def.id)
      let entry = this.gates.get(gate.def.id)
      if (!entry) {
        const group = new Group()
        const ring = new Mesh(
          new TorusGeometry(2.4, 0.12, 8, 24),
          new MeshStandardMaterial({ emissiveIntensity: 1 }),
        )
        ring.rotation.x = Math.PI / 2
        group.add(ring)
        let nose: Mesh | null = null
        if (gate.def.facing !== null) {
          nose = new Mesh(new ConeGeometry(0.3, 1.2, 8), new MeshStandardMaterial())
          nose.rotation.x = Math.PI / 2
          nose.position.z = -3
          group.add(nose)
        }
        this.group.add(group)
        entry = { group, ring, nose }
        this.gates.set(gate.def.id, entry)
      }
      const active = isGateActive(gate.def, gate.state, game.turn)
      const color = new Color(active ? 0x64d2ff : 0x555f78)
      ;(entry.ring.material as MeshStandardMaterial).color = color
      ;(entry.ring.material as MeshStandardMaterial).emissive = color
      entry.group.position.copy(toWorld(gate.def.position, 0.6))
      if (gate.def.facing !== null) entry.group.rotation.y = headingToYaw(courseDeg(gate.def.facing))
      setTooltip(entry.ring, `${gate.def.label ?? gate.def.id} gate${active ? '' : ' (inactive)'}`)
    }
    for (const [id, entry] of this.gates) {
      if (seen.has(id)) continue
      disposeTree(entry.group)
      this.group.remove(entry.group)
      this.gates.delete(id)
    }
  }

  tick(_frame: FrameContext): void {
    // PLACEHOLDER: WORLD's drifting dust/orbit motion, if any, goes here.
  }

  dispose(): void {
    disposeTree(this.group)
    this.features.clear()
    this.gates.clear()
  }
}

/**
 * A flat disc, not a real sphere: it reads as "a body this big, here" from
 * any angle a top/tilt camera actually uses, at a fraction of the geometry a
 * real one needs. Real geometry per kind is WORLD's job.
 */
function discLike(radius: number, color: number): Mesh {
  return new Mesh(
    new RingGeometry(0.01, radius, 24).rotateX(-Math.PI / 2),
    new MeshStandardMaterial({ color, roughness: 0.9, side: DoubleSide, transparent: true, opacity: 0.85 }),
  )
}

function terrainLabel(kind: TerrainKind): string {
  return kind.replace(/-/g, ' ')
}

function courseDeg(course: number): number {
  return (course % 12) * 30
}
