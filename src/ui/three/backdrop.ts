/**
 * Deep space and the table itself: the starfield, a few distant nebula banks
 * for depth, and the play surface with its beam-band grid and edge (3.9).
 *
 * `update` only reads `game.table` (never the battle), so the backdrop is
 * rebuilt once per board size and left alone after that; `tick` is where its
 * small amount of life runs — a slow twinkle on the dust, a phase-shifted
 * flare on the brightest stars — none of it under `reducedMotion`, matching
 * the 2D map's own `Starfield`, which turns its twinkle off the same way.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
} from 'three'
import { Rng } from '../../engine/dice'
import { BEAM_RANGE_BAND } from '../../engine/geometry'
import { disposeTree, type FrameContext, type Layer, type LayerContext } from './layer'
import { cloudTexture, flareTexture, glowTexture } from './textures'
import { toWorld } from './space'

/** Pins the sky to the board's own size, the same reasoning as MapView's `useStarfield`. */
const STARFIELD_SEED = 0x5f0cd1
/** Just above the board plane, so the grid and edge never z-fight with it. */
const GRID_Y = 0.012
const EDGE_Y = 0.02

/** A uniformly random point on a sphere of the given radius. */
function spherePoint(rng: Rng, radius: number): { x: number; y: number; z: number } {
  const u = rng.next()
  const v = rng.next()
  const theta = 2 * Math.PI * u
  const phi = Math.acos(2 * v - 1)
  const s = radius * Math.sin(phi)
  return { x: s * Math.cos(theta), y: radius * Math.cos(phi), z: s * Math.sin(theta) }
}

interface BrightStar {
  sprite: Sprite
  phase: number
}

export class BackdropLayer implements Layer {
  readonly group = new Group()
  private stars = new Group()
  private nebulaBanks = new Group()
  private board = new Group()
  private boardSize = { width: 0, height: 0 }

  private dustMaterial: PointsMaterial | null = null
  private midMaterial: PointsMaterial | null = null
  private brightStars: BrightStar[] = []

  constructor() {
    this.group.name = 'backdrop'
    this.group.add(this.stars, this.nebulaBanks, this.board)
  }

  update({ game }: LayerContext): void {
    const { width, height } = game.table
    if (width === this.boardSize.width && height === this.boardSize.height) return
    this.boardSize = { width, height }
    this.rebuild(width, height)
  }

  private rebuild(width: number, height: number): void {
    for (const g of [this.stars, this.nebulaBanks, this.board]) {
      disposeTree(g)
      g.clear()
    }
    this.brightStars = []
    this.buildStarfield(width, height)
    this.buildNebulaBanks(width, height)
    this.buildBoard(width, height)
  }

  // ── Starfield ────────────────────────────────────────────────────────────

  private buildStarfield(width: number, height: number): void {
    const rng = new Rng((STARFIELD_SEED ^ (width * 73856093) ^ (height * 19349663)) >>> 0)
    // Well outside anywhere the camera can dolly to, whatever the board's size.
    const radius = Math.max(240, Math.hypot(width, height) * 5)

    this.dustMaterial = this.buildStarTier(rng, radius, 3000, 2.2, 0.72)
    this.midMaterial = this.buildStarTier(rng, radius, 480, 3.4, 0.88)

    // A handful of bright ones, each a four-point flare with its own material
    // so it can twinkle on its own phase — cheap at this count.
    for (let i = 0; i < 8; i++) {
      const p = spherePoint(rng, radius * 0.98)
      const material = new SpriteMaterial({
        map: flareTexture(),
        color: new Color(0xcfe0ff).multiplyScalar(2.2),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      })
      const sprite = new Sprite(material)
      const size = 3 + rng.next() * 2.6
      sprite.scale.set(size, size, size)
      sprite.position.set(p.x, p.y, p.z)
      this.stars.add(sprite)
      this.brightStars.push({ sprite, phase: rng.next() * Math.PI * 2 })
    }
  }

  /** One tier of the dust: many points, sizes fixed within the tier, brightness varied per star. */
  private buildStarTier(rng: Rng, radius: number, count: number, size: number, baseOpacity: number): PointsMaterial {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const p = spherePoint(rng, radius)
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
      // Cubed so most stars are dim and only a few in this tier stand out.
      const b = 0.2 + Math.pow(rng.next(), 3) * 0.8
      const warmth = 0.9 + rng.next() * 0.1
      colors[i * 3] = b * warmth
      colors[i * 3 + 1] = b * warmth
      colors[i * 3 + 2] = b
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    const material = new PointsMaterial({
      size,
      sizeAttenuation: false,
      vertexColors: true,
      map: glowTexture(),
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
      toneMapped: false,
    })
    this.stars.add(new Points(geometry, material))
    return material
  }

  // ── Distant nebula banks (decoration, for depth) ─────────────────────────

  /** Far below the board and barely visible, echoing the 2D map's own nebula palette (screens #3 / ftMap.css tokens). */
  private buildNebulaBanks(width: number, height: number): void {
    const rng = new Rng(((STARFIELD_SEED ^ 0x51a1) + width * 131 + height * 977) >>> 0)
    const diag = Math.hypot(width, height)
    const center = toWorld({ x: width / 2, y: height / 2 })
    const tints = [0x64d2ff, 0xb79cff, 0x6fe3c4, 0xff8fc4]
    tints.forEach((tint, i) => {
      const material = new SpriteMaterial({
        map: cloudTexture(1 + i),
        color: new Color(tint),
        transparent: true,
        opacity: 0.05 + rng.next() * 0.03,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      })
      const sprite = new Sprite(material)
      const size = diag * (1.6 + rng.next() * 1.3)
      sprite.scale.set(size, size, 1)
      const angle = rng.next() * Math.PI * 2
      const spread = diag * (0.4 + rng.next() * 0.6)
      sprite.position.set(
        center.x + Math.cos(angle) * spread,
        -diag * (0.4 + rng.next() * 0.5),
        center.z + Math.sin(angle) * spread,
      )
      this.nebulaBanks.add(sprite)
    })
  }

  // ── The board ────────────────────────────────────────────────────────────

  private buildBoard(width: number, height: number): void {
    const plane = new Mesh(
      new PlaneGeometry(width, height),
      // Lambert, not Standard: a physically based surface always keeps a few
      // percent of specular, and the sun would spread that across the whole
      // table as a sheen. Deep space stays deep space.
      new MeshLambertMaterial({ color: 0x0b1224 }),
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.copy(toWorld({ x: width / 2, y: height / 2 }))
    this.board.add(plane, this.buildGrid(width, height), this.buildEdge(width, height))
  }

  /** Grid lines every beam range band (4.3), brighter near the board's centre and fading toward the edge. */
  private buildGrid(width: number, height: number): LineSegments {
    const positions: number[] = []
    const colors: number[] = []
    const base = new Color(0x2a3a5e)
    const cx = width / 2
    const cy = height / 2
    const maxDist = Math.max(1, Math.hypot(cx, cy))
    const step = BEAM_RANGE_BAND
    const pushLine = (x1: number, y1: number, x2: number, y2: number) => {
      positions.push(x1, GRID_Y, y1, x2, GRID_Y, y2)
      const fa = 1 - Math.min(1, Math.hypot(x1 - cx, y1 - cy) / maxDist) * 0.78
      const fb = 1 - Math.min(1, Math.hypot(x2 - cx, y2 - cy) / maxDist) * 0.78
      colors.push(base.r * fa, base.g * fa, base.b * fa, base.r * fb, base.g * fb, base.b * fb)
    }
    for (let i = step; i < width; i += step) pushLine(i, 0, i, height)
    for (let i = step; i < height; i += step) pushLine(0, i, width, i)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    return new LineSegments(geometry, new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, toneMapped: false }))
  }

  /** The play area's edge (3.9): leaving it takes a ship out of the battle, so it has to read from across the table. */
  private buildEdge(width: number, height: number): Group {
    const group = new Group()
    const corners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
      { x: 0, y: 0 },
    ]
    const positions: number[] = []
    for (const c of corners) positions.push(c.x, EDGE_Y, c.y)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    const plum = new Color(0x7d5ba6).multiplyScalar(1.25)
    const dashed = new Line(
      geometry,
      new LineDashedMaterial({ color: plum, dashSize: 1.1, gapSize: 0.75, transparent: true, opacity: 0.9, toneMapped: false }),
    )
    dashed.computeLineDistances()
    const glow = new Line(
      geometry.clone(),
      new LineBasicMaterial({ color: plum, transparent: true, opacity: 0.28, toneMapped: false, blending: AdditiveBlending }),
    )
    group.add(dashed, glow)
    return group
  }

  // ── Life ─────────────────────────────────────────────────────────────────

  tick({ now, reducedMotion }: FrameContext): void {
    if (reducedMotion) return
    const t = now / 1000
    if (this.dustMaterial) this.dustMaterial.opacity = 0.68 + Math.sin(t * 0.15) * 0.08
    if (this.midMaterial) this.midMaterial.opacity = 0.84 + Math.sin(t * 0.12 + 1.4) * 0.08
    for (const star of this.brightStars) {
      ;(star.sprite.material as SpriteMaterial).opacity = 0.7 + Math.sin(t * 0.5 + star.phase) * 0.28
    }
  }

  dispose(): void {
    disposeTree(this.group)
    this.dustMaterial = null
    this.midMaterial = null
    this.brightStars = []
  }
}
