/**
 * `useFx`'s ephemeral battle effects (beam and gun fire, hits, explosions) in
 * 3D — the same `BattleFx` stream the 2D map draws (see `../fx.ts`: every
 * effect is a pure reading of an already-journaled action, so the same fire
 * renders for the local player, the AI, a remote opponent and a replay, all
 * from the one derivation).
 *
 * `ctx.view.fx` comes from `useFx()` inside `BattleView3D.tsx`, not a
 * `MapViewProps` field — Full Thrust's `MapView` takes no `fx` prop. Each
 * `BattleFx.delay` is milliseconds from when its batch was queued, the same
 * number the 2D map hands its CSS `animationDelay`; this layer reads the same
 * clock by stamping each id's own arrival the first time `update` sees it
 * (`ctx.now`) and starting that fx's animation `stampedNow + fx.delay` later,
 * entirely inside `tick`. A `beam` races out as a lit shaft with a bright
 * core (2D's own `shot`/`shot-core` pair); `kinetic` and `ordnance` fire read
 * the same but tinted by kind; a `hit` blooms into a fading spark burst with
 * a brief point light, and `destroyed` is the same burst at three times the
 * size with a shockwave ring — 2D's `hit-burst` scaled by
 * `fx.kind === 'destroyed'`.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import type { BattleFx, FxKind } from '../fx'
import { disposeTree, type FrameContext, type Layer, type LayerContext } from './layer'
import { HULL_ALTITUDE, toWorld } from './space'
import { beamTexture, glowTexture } from './textures'

/** How long a travelling shot takes to cross the board — long enough to read as motion, short enough that a barrage does not overlap itself. */
const SHOT_DURATION = 380
/** How long an impact's burst plays before it is gone. */
const IMPACT_DURATION = 620
/** A reduced-motion shot is a flash at the target rather than a race across the board. */
const REDUCED_SHOT_DURATION = 200
const REDUCED_IMPACT_DURATION = 260
/** At most this many impacts may be lighting the scene at once — the one part of this layer that is not free. */
const MAX_LIVE_LIGHTS = 4

const KIND_COLOR: Record<FxKind, number> = {
  beam: 0x64d2ff,
  kinetic: 0xdfe6ff,
  ordnance: 0xff8fc4,
  hit: 0xffb070,
  destroyed: 0xff5c4a,
}

const UP = new Vector3(0, 1, 0)
const scratchDir = new Vector3()
const scratchAt = new Vector3()

/** Point, position and stretch a unit cylinder so it spans `from`→`to`. */
function orientBetween(mesh: Mesh, from: Vector3, to: Vector3, radius: number): void {
  scratchDir.subVectors(to, from)
  const len = Math.max(0.001, scratchDir.length())
  mesh.position.copy(from).addScaledVector(scratchDir, 0.5)
  mesh.scale.set(radius, len, radius)
  scratchDir.normalize()
  mesh.quaternion.setFromUnitVectors(UP, scratchDir)
}

interface ShotEntry {
  kind: 'shot'
  fx: BattleFx
  start: number
  from: Vector3
  to: Vector3
  root: Group
  beam: Mesh
  core: Mesh
  glow: Sprite
}

interface SparkBurst {
  points: Points<BufferGeometry, PointsMaterial>
  positions: Float32Array
  velocities: Float32Array
}

interface ImpactEntry {
  kind: 'impact'
  fx: BattleFx
  start: number
  root: Group
  fireball: Sprite
  shock: Mesh
  sparks: SparkBurst
  light: PointLight | null
}

type FxEntry = ShotEntry | ImpactEntry

export class EffectsLayer implements Layer {
  readonly group = new Group()
  private stamped = new Map<string, number>()
  private live = new Map<string, FxEntry>()
  private liveLights = 0

  private beamGeo = new CylinderGeometry(1, 1, 1, 7, 1, true)
  private shockGeo = new RingGeometry(0.6, 1, 24)
  private beamTex = beamTexture()

  constructor() {
    this.group.name = 'effects'
    this.beamGeo.userData.shared = true
    this.shockGeo.userData.shared = true
  }

  update({ view, now }: LayerContext): void {
    const seen = new Set<string>()
    for (const fx of view.fx) {
      seen.add(fx.id)
      if (this.live.has(fx.id)) continue
      let stamp = this.stamped.get(fx.id)
      if (stamp === undefined) {
        stamp = now
        this.stamped.set(fx.id, stamp)
      }
      const entry = fx.from ? this.spawnShot(fx, stamp) : this.spawnImpact(fx, stamp)
      this.group.add(entry.root)
      this.live.set(fx.id, entry)
    }
    for (const [id, entry] of this.live) {
      if (seen.has(id)) continue
      this.retire(entry)
      this.live.delete(id)
      this.stamped.delete(id)
    }
  }

  tick(frame: FrameContext): void {
    for (const [id, entry] of this.live) {
      const start = entry.start + entry.fx.delay
      const duration = frame.reducedMotion
        ? entry.kind === 'shot'
          ? REDUCED_SHOT_DURATION
          : REDUCED_IMPACT_DURATION
        : entry.kind === 'shot'
          ? SHOT_DURATION
          : IMPACT_DURATION
      const t = frame.now - start
      if (t < 0) {
        entry.root.visible = false
        continue
      }
      entry.root.visible = true
      const k = Math.min(1, t / duration)
      if (entry.kind === 'shot') this.animateShot(entry, k, frame)
      else this.animateImpact(entry, k, frame)
      if (t >= duration) {
        this.retire(entry)
        this.live.delete(id)
        this.stamped.delete(id)
      }
    }
  }

  // ── Shots ────────────────────────────────────────────────────────────────

  /** Only ever called with an `fx.from` already known truthy — see `update`. */
  private spawnShot(fx: BattleFx, start: number): ShotEntry {
    const from = toWorld(fx.from!, HULL_ALTITUDE)
    const to = toWorld(fx.to, HULL_ALTITUDE)
    const color = KIND_COLOR[fx.kind]
    const root = new Group()

    const beamMat = new MeshBasicMaterial({
      color,
      map: this.beamTex,
      transparent: true,
      opacity: 0,
      toneMapped: false,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const beam = new Mesh(this.beamGeo, beamMat)
    const coreMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false, depthWrite: false })
    const core = new Mesh(this.beamGeo, coreMat)
    const glowMat = new SpriteMaterial({
      map: glowTexture(),
      color: new Color(color).multiplyScalar(1.4),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
    const glow = new Sprite(glowMat)
    glow.scale.setScalar(0.3)
    root.add(beam, core, glow)
    return { kind: 'shot', fx, start, from, to, root, beam, core, glow }
  }

  private animateShot(s: ShotEntry, t: number, frame: FrameContext): void {
    const reduced = frame.reducedMotion
    const RACE = reduced ? 0 : 0.3
    const FADE_FROM = reduced ? 0.35 : 0.6
    const raceT = RACE > 0 ? Math.min(1, t / RACE) : 1
    scratchAt.lerpVectors(s.from, s.to, raceT)
    orientBetween(s.beam, s.from, scratchAt, 0.045)
    orientBetween(s.core, s.from, scratchAt, 0.016)
    const fade = t <= FADE_FROM ? 1 : Math.max(0, 1 - (t - FADE_FROM) / (1 - FADE_FROM))
    ;(s.beam.material as MeshBasicMaterial).opacity = 0.65 * fade
    ;(s.core.material as MeshBasicMaterial).opacity = 0.9 * fade
    s.glow.position.copy(scratchAt)
    s.glow.material.opacity = 0.7 * fade
    s.glow.scale.setScalar(0.3 * (1 + (1 - fade) * 0.6))
  }

  // ── Impacts ──────────────────────────────────────────────────────────────

  private spawnImpact(fx: BattleFx, start: number): ImpactEntry {
    const at = toWorld(fx.to, HULL_ALTITUDE)
    const root = new Group()
    root.position.copy(at)
    const color = KIND_COLOR[fx.kind]

    const fireball = new Sprite(
      new SpriteMaterial({ map: glowTexture(), color: new Color(color).multiplyScalar(1.5), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    )
    const shock = new Mesh(
      this.shockGeo,
      new MeshBasicMaterial({ color, transparent: true, opacity: 0, side: DoubleSide, toneMapped: false, depthWrite: false }),
    )
    shock.rotation.x = -Math.PI / 2
    const sparks = this.buildSparks(fx.kind === 'destroyed' ? 20 : 10, color)
    root.add(fireball, shock, sparks.points)

    let light: PointLight | null = null
    if (this.liveLights < MAX_LIVE_LIGHTS) {
      light = new PointLight(color, 0, 7, 2)
      root.add(light)
      this.liveLights++
    }
    return { kind: 'impact', fx, start, root, fireball, shock, sparks, light }
  }

  private buildSparks(count: number, color: number): SparkBurst {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const speed = 0.8 + Math.random() * 1.6
      velocities[i * 3] = Math.cos(a) * speed
      velocities[i * 3 + 1] = (Math.random() - 0.3) * speed * 0.6
      velocities[i * 3 + 2] = Math.sin(a) * speed
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
    const material = new PointsMaterial({
      size: 0.05,
      color: new Color(color).multiplyScalar(1.3),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      blending: AdditiveBlending,
      sizeAttenuation: true,
    })
    return { points: new Points(geo, material), positions, velocities }
  }

  private animateImpact(e: ImpactEntry, t: number, frame: FrameContext): void {
    const reduced = frame.reducedMotion
    const big = e.fx.kind === 'destroyed'
    const bloom = reduced ? 1 : Math.min(1, t / 0.14)
    const decay = Math.max(0, 1 - Math.max(0, t - 0.14) / 0.86)
    const size = (big ? 0.5 : 0.22) * (1 + bloom * 1.4 - t * 0.3)
    e.fireball.scale.setScalar(size)
    e.fireball.material.opacity = bloom * decay

    const grow = reduced ? 1 : 0.2 + Math.min(1, t / 0.5) * (big ? 3 : 1.6)
    e.shock.scale.setScalar((big ? 0.6 : 0.3) * grow)
    ;(e.shock.material as MeshBasicMaterial).opacity = reduced ? 0.4 * (1 - t) : 0.5 * Math.max(0, 1 - t * 1.2)

    if (!reduced) {
      const dt = frame.dt
      const pos = e.sparks.positions
      const vel = e.sparks.velocities
      for (let i = 0; i < vel.length; i += 3) {
        pos[i] += vel[i] * dt
        pos[i + 1] += vel[i + 1] * dt
        pos[i + 2] += vel[i + 2] * dt
        vel[i + 1] -= dt * 1.4
      }
      e.sparks.points.geometry.attributes.position.needsUpdate = true
    }
    e.sparks.points.material.opacity = reduced ? 0 : Math.max(0, 1 - t * 1.2)

    if (e.light) e.light.intensity = reduced ? 0 : Math.max(0, (big ? 4.5 : 3) * (1 - t * 1.5))
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  /**
   * `beamTexture()`/`glowTexture()` are cached forever at module scope
   * (`textures.ts`) and never disposed by a consumer, but each shot or
   * impact's own material is per-instance so `disposeTree` *would* dispose
   * whatever it points to as its `map` — so the shared texture is unhooked
   * first, and only the per-instance material itself is freed.
   */
  private retire(entry: FxEntry): void {
    this.group.remove(entry.root)
    if (entry.kind === 'shot') {
      ;(entry.beam.material as MeshBasicMaterial).map = null
      ;(entry.glow.material as SpriteMaterial).map = null
    } else {
      ;(entry.fireball.material as SpriteMaterial).map = null
      if (entry.light) this.liveLights--
    }
    disposeTree(entry.root)
  }

  dispose(): void {
    for (const entry of this.live.values()) this.retire(entry)
    this.live.clear()
    this.stamped.clear()
    this.liveLights = 0
    disposeTree(this.group)
    this.beamGeo.dispose()
    this.shockGeo.dispose()
  }
}
