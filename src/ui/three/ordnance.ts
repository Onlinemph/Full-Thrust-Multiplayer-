/**
 * PLACEHOLDER (stage 2, WORLD) — every ordnance marker (6), flak burst
 * (5.16) and Nova Cannon sweep (7.23) on the table, in 3D.
 *
 * Today every `OrdnanceMarkerState` is the same small dart, tinted by kind
 * and oriented along `marker.facing` when it has one (a mine has none — 6.3
 * — so it stays a plain marker with no heading); flak is a translucent red
 * disc at its true `FLAK_BLAST_RADIUS_MU`; a Nova sweep is a thin lit band
 * from the firing ship out to the generation's own reach (`NOVA_SWEEPS`). No
 * wave-gun marker yet — add it the same way once its own state exists.
 * WORLD's real job: a salvo of six little missile bodies rather than one dart
 * standing in for the whole `missiles` count, a plasma bolt's actual glow, a
 * proper minefield, and flak/nova as a burst rather than a static disc.
 *
 * Ordnance takes no clicks on the 2D map either — only hover, through
 * `BattleScene`'s own raycast against this layer's group — so nothing here
 * needs to be `Pickable`.
 */
import { Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three'
import { flakMarkers, novaBursts } from '../../engine/actions'
import { courseToDegrees, courseVector } from '../../engine/geometry'
import type { GameState, OrdnanceKind, OrdnanceMarkerState } from '../../engine/game'
import { NOVA_SWEEPS } from '../../engine/ew'
import { FLAK_BLAST_RADIUS_MU } from '../../engine/weapons/kinetics'
import { disposeTree, setTooltip, type FrameContext, type Layer, type LayerContext } from './layer'
import { headingToYaw, HULL_ALTITUDE, toWorld } from './space'

const KIND_COLOR: Record<OrdnanceKind, number> = {
  salvo: 0xdfe6ff,
  heavy: 0xffb070,
  antimatter: 0xff6bd8,
  'plasma-bolt': 0x7fe095,
  rocket: 0xffe08a,
  mine: 0xff8a70,
}

interface Entry {
  mesh: Mesh
  kind: OrdnanceKind
}

export class OrdnanceLayer implements Layer {
  readonly group = new Group()
  private markers = new Map<string, Entry>()
  private ephemeral = new Group()

  constructor() {
    this.group.name = 'ordnance'
    this.group.add(this.ephemeral)
  }

  update({ game }: LayerContext): void {
    this.updateMarkers(game.ordnance)
    this.updateEphemeral(game)
  }

  private updateMarkers(markers: readonly OrdnanceMarkerState[]): void {
    const seen = new Set<string>()
    for (const marker of markers) {
      seen.add(marker.id)
      let entry = this.markers.get(marker.id)
      if (!entry || entry.kind !== marker.kind) {
        if (entry) this.group.remove(entry.mesh)
        const mesh = markerMesh(marker.kind)
        this.group.add(mesh)
        entry = { mesh, kind: marker.kind }
        this.markers.set(marker.id, entry)
      }
      entry.mesh.position.copy(toWorld(marker.position, HULL_ALTITUDE * 0.6))
      if (marker.facing !== undefined) entry.mesh.rotation.y = headingToYaw(courseToDegrees(marker.facing))
      setTooltip(
        entry.mesh,
        `${ordnanceKindLabel(marker.kind)}${marker.missiles > 1 ? ` ×${marker.missiles}` : ''} (side ${marker.side})`,
      )
    }
    for (const [id, entry] of this.markers) {
      if (seen.has(id)) continue
      disposeTree(entry.mesh)
      this.group.remove(entry.mesh)
      this.markers.delete(id)
    }
  }

  /** Flak bursts and Nova sweeps are read fresh from the battle every update — few, and gone within a phase. */
  private updateEphemeral(game: GameState): void {
    disposeTree(this.ephemeral)
    this.ephemeral.clear()
    for (const marker of flakMarkers(game)) {
      const disc = new Mesh(
        new CylinderGeometry(FLAK_BLAST_RADIUS_MU, FLAK_BLAST_RADIUS_MU, 0.05, 24),
        new MeshStandardMaterial({ color: 0xff5c4a, transparent: true, opacity: 0.28, emissive: 0xff5c4a, emissiveIntensity: 0.5 }),
      )
      disc.position.copy(toWorld(marker.position, HULL_ALTITUDE * 0.4))
      setTooltip(disc, `Flak burst (side ${marker.side})`)
      this.ephemeral.add(disc)
    }
    for (const burst of novaBursts(game)) {
      const sweep = NOVA_SWEEPS[burst.stage]
      const unit = courseVector(burst.course)
      const mid = {
        x: burst.origin.x + unit.x * ((sweep.fromMu + sweep.toMu) / 2),
        y: burst.origin.y + unit.y * ((sweep.fromMu + sweep.toMu) / 2),
      }
      const length = sweep.toMu - sweep.fromMu
      const band = new Mesh(
        new CylinderGeometry(sweep.diameter / 2, sweep.diameter / 2, length, 16, 1, true),
        new MeshStandardMaterial({ color: 0xffcc66, transparent: true, opacity: 0.22, emissive: 0xffcc66, emissiveIntensity: 0.6 }),
      )
      band.rotation.x = Math.PI / 2
      band.rotation.z = -headingToYaw(courseToDegrees(burst.course)) + Math.PI / 2
      band.position.copy(toWorld(mid, HULL_ALTITUDE))
      setTooltip(band, `Nova Cannon sweep, generation ${burst.stage}`)
      this.ephemeral.add(band)
    }
  }

  tick(_frame: FrameContext): void {
    // PLACEHOLDER: WORLD's plasma pulse / missile drift, if any, goes here.
  }

  dispose(): void {
    disposeTree(this.group)
    this.markers.clear()
  }
}

function markerMesh(kind: OrdnanceKind): Mesh {
  const color = KIND_COLOR[kind]
  const material = new MeshStandardMaterial({ color, emissive: new Color(color).multiplyScalar(0.3), roughness: 0.4 })
  if (kind === 'mine') return new Mesh(new SphereGeometry(0.25, 10, 8), material)
  if (kind === 'plasma-bolt') return new Mesh(new SphereGeometry(0.4, 10, 8), material)
  const size = kind === 'antimatter' ? 0.5 : kind === 'heavy' ? 0.4 : kind === 'rocket' ? 0.3 : 0.22
  const dart = new Mesh(new ConeGeometry(size * 0.5, size * 2, 8), material)
  dart.rotation.x = -Math.PI / 2
  return dart
}

function ordnanceKindLabel(kind: OrdnanceKind): string {
  return kind.replace(/-/g, ' ')
}
