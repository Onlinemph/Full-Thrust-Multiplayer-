/**
 * Every ordnance marker (6), flak burst (5.16) and Nova Cannon sweep (7.23)
 * on the table, in 3D.
 *
 * A salvo or a rocket marker is a small cluster of missile bodies — one per
 * missile actually left, in the same two-column layout `OrdnanceGlyph.tsx`
 * lays its darts out in — rather than one dart standing in for the whole
 * `missiles` count, so a salvo point defence has thinned reads as visibly
 * thinner. A Heavy Missile and an antimatter warhead are the one big body
 * that kind has always been; an antimatter marker also carries the true
 * `ANTIMATTER_BLAST_RADIUS` ring it is about to become (6.6). A plasma bolt
 * (6.8) is a glowing detonation point at its real `PLASMA_BOLT_BLAST_RADIUS`,
 * not a place-holder dot, and a mine (6.9) is laid and left with no heading.
 * Flak is a translucent disc at its true `FLAK_BLAST_RADIUS_MU`, and a Nova
 * sweep is a lit band from the firing ship out to the generation's own reach
 * (`NOVA_SWEEPS`) — both markers a tripwire or a template rather than a
 * thing with an id, so both are read fresh from the battle and rebuilt every
 * `update` rather than diffed, exactly as `flakMarkers`/`novaBursts`
 * themselves are recomputed every call (see the doc comments there).
 *
 * Ordnance takes no clicks on the 2D map either — only hover, through
 * `BattleScene`'s own raycast against this layer's group — so nothing here
 * needs to be `Pickable`.
 */
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
} from 'three'
import { flakMarkers, novaBursts } from '../../engine/actions'
import { courseToDegrees, courseVector } from '../../engine/geometry'
import type { GameState, OrdnanceKind, OrdnanceMarkerState } from '../../engine/game'
import { NOVA_SWEEPS } from '../../engine/ew'
import { ANTIMATTER_BLAST_RADIUS, PLASMA_BOLT_BLAST_RADIUS } from '../../engine/ordnance'
import { FLAK_BLAST_RADIUS_MU } from '../../engine/weapons/kinetics'
import { disposeTree, setTooltip, type FrameContext, type Layer, type LayerContext } from './layer'
import { headingToYaw, HULL_ALTITUDE, sideColorOf, toWorld } from './space'

/** Ordnance pink (`--ordnance`), the same dart colour the 2D map uses for every kind that flies. */
const DART_COLOR = 0xff8fc4
/** `--warn`, for a plasma bolt's detonation and an antimatter warhead's blast ring. */
const WARN_COLOR = 0xffb020

/** Where each dart of a cluster sits, local MU — the same two-column, nose-first layout `OrdnanceGlyph.tsx` draws in 2D pixels. */
export function missileCluster(count: number): Array<{ x: number; z: number }> {
  const n = Math.max(1, Math.min(6, count))
  const rows = Math.ceil(n / 2)
  const out: Array<{ x: number; z: number }> = []
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 2)
    const alone = i === n - 1 && n % 2 === 1
    out.push({ x: alone ? 0 : i % 2 === 0 ? -0.18 : 0.18, z: (row - (rows - 1) / 2) * 0.3 })
  }
  return out
}

interface MarkerEntry {
  root: Group
  kind: OrdnanceKind
  darts: number
}

export class OrdnanceLayer implements Layer {
  readonly group = new Group()
  private markers = new Map<string, MarkerEntry>()
  private ephemeral = new Group()

  private dartGeo = new ConeGeometry(0.05, 0.22, 8)
  private heavyGeo = new ConeGeometry(0.09, 0.36, 8)
  private mineGeo = new SphereGeometry(0.16, 10, 8)
  private plasmaGeo = new SphereGeometry(0.34, 14, 10)

  constructor() {
    this.group.name = 'ordnance'
    this.group.add(this.ephemeral)
    for (const g of [this.dartGeo, this.heavyGeo, this.mineGeo, this.plasmaGeo]) g.userData.shared = true
    this.dartGeo.rotateX(-Math.PI / 2)
    this.heavyGeo.rotateX(-Math.PI / 2)
  }

  update({ game }: LayerContext): void {
    this.updateMarkers(game.ordnance)
    this.updateEphemeral(game)
  }

  private updateMarkers(markers: readonly OrdnanceMarkerState[]): void {
    const seen = new Set<string>()
    for (const marker of markers) {
      seen.add(marker.id)
      const darts = marker.kind === 'salvo' ? marker.missiles : marker.kind === 'rocket' ? Math.min(2, marker.missiles) : 1
      let entry = this.markers.get(marker.id)
      if (!entry || entry.kind !== marker.kind || entry.darts !== darts) {
        if (entry) {
          disposeTree(entry.root)
          this.group.remove(entry.root)
        }
        entry = { root: this.buildMarker(marker, darts), kind: marker.kind, darts }
        this.group.add(entry.root)
        this.markers.set(marker.id, entry)
      }
      entry.root.position.copy(toWorld(marker.position, HULL_ALTITUDE * 0.6))
      if (marker.facing !== undefined) entry.root.rotation.y = headingToYaw(courseToDegrees(marker.facing))
      setTooltip(
        entry.root,
        `${ordnanceKindLabel(marker.kind)}${marker.missiles > 1 ? ` ×${marker.missiles}` : ''} (side ${marker.side})` +
          (marker.grade === 'extended' ? '\nextended range (6.2)' : ''),
      )
    }
    for (const [id, entry] of this.markers) {
      if (seen.has(id)) continue
      disposeTree(entry.root)
      this.group.remove(entry.root)
      this.markers.delete(id)
    }
  }

  /** A mine has no heading (6.3) and sits alone; a plasma bolt is a detonation point; everything else is one or more darts fanned in `missileCluster`. */
  private buildMarker(marker: OrdnanceMarkerState, darts: number): Group {
    const root = new Group()
    const tail = new Color(sideColorOf(marker.side)).multiplyScalar(1.3)

    if (marker.kind === 'mine') {
      const material = new MeshStandardMaterial({ color: 0x2a1a22, emissive: DART_COLOR, emissiveIntensity: 0.5, roughness: 0.5 })
      root.add(new Mesh(this.mineGeo, material))
      return root
    }

    if (marker.kind === 'plasma-bolt') {
      const glow = new MeshStandardMaterial({ color: 0x1a2a1a, emissive: WARN_COLOR, emissiveIntensity: 1.3, roughness: 0.3 })
      root.add(new Mesh(this.plasmaGeo, glow))
      root.add(blastRing(PLASMA_BOLT_BLAST_RADIUS, WARN_COLOR, 0.22))
      return root
    }

    const heavy = marker.kind === 'heavy' || marker.kind === 'antimatter'
    const geo = heavy ? this.heavyGeo : this.dartGeo
    const positions = heavy ? [{ x: 0, z: 0 }] : missileCluster(darts)
    for (const at of positions) {
      const body = new Mesh(geo, new MeshStandardMaterial({ color: 0x2a1a22, emissive: DART_COLOR, emissiveIntensity: 0.6, roughness: 0.4 }))
      body.position.set(at.x, 0, at.z)
      const flare = new Mesh(
        new ConeGeometry(0.035, 0.1, 6).rotateX(Math.PI / 2),
        new MeshStandardMaterial({ color: tail, emissive: tail, emissiveIntensity: 0.8 }),
      )
      flare.position.set(at.x, 0, at.z + (heavy ? 0.24 : 0.14))
      root.add(body, flare)
    }
    if (marker.kind === 'antimatter') root.add(blastRing(ANTIMATTER_BLAST_RADIUS, WARN_COLOR, 0.16))
    return root
  }

  /** Flak bursts and Nova sweeps are read fresh from the battle every update — few, and gone within a phase. */
  private updateEphemeral(game: GameState): void {
    disposeTree(this.ephemeral)
    this.ephemeral.clear()
    for (const marker of flakMarkers(game)) {
      const disc = blastRing(FLAK_BLAST_RADIUS_MU, 0xff5c4a, 0.24)
      disc.position.copy(toWorld(marker.position, HULL_ALTITUDE * 0.4))
      setTooltip(disc, `Flak burst, rated ${marker.rating} (side ${marker.side})`)
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
        new MeshStandardMaterial({ color: WARN_COLOR, transparent: true, opacity: 0.22, emissive: WARN_COLOR, emissiveIntensity: 0.6, side: DoubleSide }),
      )
      band.rotation.x = Math.PI / 2
      band.rotation.z = -headingToYaw(courseToDegrees(burst.course)) + Math.PI / 2
      band.position.copy(toWorld(mid, HULL_ALTITUDE))
      setTooltip(band, `Nova Cannon sweep, generation ${burst.stage} (${sweep.damageDice}D6)`)
      this.ephemeral.add(band)
    }
  }

  tick(_frame: FrameContext): void {
    // Ordnance markers hold still between phases (6.3) — nothing here animates on its own frame clock.
  }

  dispose(): void {
    disposeTree(this.group)
    this.markers.clear()
    for (const g of [this.dartGeo, this.heavyGeo, this.mineGeo, this.plasmaGeo]) g.dispose()
  }
}

/** A flat, translucent disc at a blast's true radius (5.16, 6.6, 6.8) — the shape a player actually has to read off the table. */
function blastRing(radius: number, color: number, opacity: number): Mesh {
  const material = new MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    emissive: color,
    emissiveIntensity: 0.4,
    side: DoubleSide,
    depthWrite: false,
  })
  const mesh = new Mesh(new RingGeometry(0.02, radius, 32), material)
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

function ordnanceKindLabel(kind: OrdnanceKind): string {
  return kind.replace(/-/g, ' ')
}
