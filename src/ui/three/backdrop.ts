/**
 * PLACEHOLDER (stage 2, WORLD) — deep space and the table itself.
 *
 * `update` only reads `game.table` (never the battle), so the backdrop is
 * rebuilt once per board size and left alone after that; `tick` is where
 * whatever life WORLD gives it (twinkle, drift) runs, skipped under
 * `reducedMotion`.
 *
 * Today: a starfield sprayed on a big sphere, and the board as a plane with a
 * grid every `BEAM_RANGE_BAND` MU and a dashed edge — enough to tell "up" from
 * "down" and read scale by eye. WORLD's own doc in backdrop.ts's history (see
 * the StarForce reference) goes further: bright twinkling stars, distant
 * nebula banks for depth. None of that is required for the placeholder to do
 * its job, which is only "the board reads as a surface with stars behind it".
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
} from 'three'
import { Rng } from '../../engine/dice'
import { BEAM_RANGE_BAND } from '../../engine/geometry'
import { disposeTree, type FrameContext, type Layer, type LayerContext } from './layer'
import { glowTexture } from './textures'
import { toWorld } from './space'

const STARFIELD_SEED = 0x5f0cd1
const GRID_Y = 0.012
const EDGE_Y = 0.02

function spherePoint(rng: Rng, radius: number): { x: number; y: number; z: number } {
  const u = rng.next()
  const v = rng.next()
  const theta = 2 * Math.PI * u
  const phi = Math.acos(2 * v - 1)
  const s = radius * Math.sin(phi)
  return { x: s * Math.cos(theta), y: radius * Math.cos(phi), z: s * Math.sin(theta) }
}

export class BackdropLayer implements Layer {
  readonly group = new Group()
  private stars = new Group()
  private board = new Group()
  private boardSize = { width: 0, height: 0 }
  private starMaterial: PointsMaterial | null = null

  constructor() {
    this.group.name = 'backdrop'
    this.group.add(this.stars, this.board)
  }

  update({ game }: LayerContext): void {
    const { width, height } = game.table
    if (width === this.boardSize.width && height === this.boardSize.height) return
    this.boardSize = { width, height }
    this.rebuild(width, height)
  }

  private rebuild(width: number, height: number): void {
    disposeTree(this.stars)
    this.stars.clear()
    disposeTree(this.board)
    this.board.clear()
    this.buildStarfield(width, height)
    this.buildBoard(width, height)
  }

  private buildStarfield(width: number, height: number): void {
    const rng = new Rng((STARFIELD_SEED ^ (width * 73856093) ^ (height * 19349663)) >>> 0)
    const radius = Math.max(240, Math.hypot(width, height) * 5)
    const count = 3000
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const p = spherePoint(rng, radius)
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
      const b = 0.2 + Math.pow(rng.next(), 3) * 0.8
      colors[i * 3] = b
      colors[i * 3 + 1] = b
      colors[i * 3 + 2] = b
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    this.starMaterial = new PointsMaterial({
      size: 2.2,
      sizeAttenuation: false,
      vertexColors: true,
      map: glowTexture(),
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      toneMapped: false,
    })
    this.stars.add(new Points(geometry, this.starMaterial))
  }

  private buildBoard(width: number, height: number): void {
    const plane = new Mesh(new PlaneGeometry(width, height), new MeshLambertMaterial({ color: 0x0b1224 }))
    plane.rotation.x = -Math.PI / 2
    plane.position.copy(toWorld({ x: width / 2, y: height / 2 }))
    this.board.add(plane, this.buildGrid(width, height), this.buildEdge(width, height))
  }

  /** Grid lines every beam range band (4.3), so a scale reads off the table by eye, as the 2D grid does. */
  private buildGrid(width: number, height: number): LineSegments {
    const positions: number[] = []
    const step = BEAM_RANGE_BAND
    for (let i = step; i < width; i += step) positions.push(i, GRID_Y, 0, i, GRID_Y, height)
    for (let i = step; i < height; i += step) positions.push(0, GRID_Y, i, width, GRID_Y, i)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return new LineSegments(
      geometry,
      new LineBasicMaterial({ color: 0x2a3a5e, transparent: true, opacity: 0.6, toneMapped: false }),
    )
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

  tick({ now, reducedMotion }: FrameContext): void {
    if (reducedMotion || !this.starMaterial) return
    this.starMaterial.opacity = 0.72 + Math.sin(now / 4000) * 0.08
  }

  dispose(): void {
    disposeTree(this.group)
    this.starMaterial = null
  }
}
