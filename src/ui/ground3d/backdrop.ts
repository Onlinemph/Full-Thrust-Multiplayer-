/**
 * A wargames table under a sky, not space (BRIEF-GROUND-3D): the play
 * surface itself — grass, the same 1"/6" grid the 2D board rules off —
 * the room's floor around it so the camera never sees past the table's
 * edge into nothing, a low wooden frame at that edge exactly where the 2D
 * map draws its own `dst-frame`, and a plain lit sky with a little fog so
 * the far ground fades rather than stopping dead.
 *
 * The one thing every other layer is drawn standing on: `GroundScene`
 * raycasts this layer's ground plane for a click anywhere the terrain
 * layer's own raised features do not already answer for.
 */
import { Color, DoubleSide, Fog, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Scene } from 'three'
import { flatSlab, prism } from './geometry'
import { disposeTree, tagGround, type GroundContext, type Layer } from './layer'
import { DST } from './palette'
import { toWorld } from './space'
import { speckleTexture } from './textures'

const FRAME_HEIGHT = 0.16
const FRAME_WIDTH = 0.5
const GRID_Y = 0.006
const FLOOR_SCALE = 6

export class BackdropLayer implements Layer {
  readonly group = new Group()
  private built: { width: number; depth: number } | null = null

  constructor(private scene: Scene) {
    this.group.name = 'ground-backdrop'
    this.scene.background = new Color(DST.sky)
    // R10: fog only ever tints geometry, never the flat background colour —
    // a different fog tone (`skyHorizon`) made the surround floor fade to a
    // shade the sky itself never was, leaving a hard seam at the true
    // horizon, worst at the Tilt/Low presets where that band fills much of
    // the screen. Fogging to the same colour the empty sky already is closes
    // that seam.
    this.scene.fog = new Fog(DST.sky, 40, 260)
  }

  update({ table }: GroundContext): void {
    if (this.built && this.built.width === table.width && this.built.depth === table.depth) return
    this.built = { width: table.width, depth: table.depth }
    this.rebuild(table.width, table.depth)
  }

  private rebuild(width: number, depth: number): void {
    disposeTree(this.group)
    this.group.clear()
    this.group.add(this.buildFloor(width, depth), this.buildGround(width, depth), this.buildGrid(width, depth), this.buildFrame(width, depth))
  }

  /** The room around the table, so the horizon is never a hard edge into the void. */
  private buildFloor(width: number, depth: number): Mesh {
    const span = Math.max(width, depth) * FLOOR_SCALE
    const mesh = new Mesh(new PlaneGeometry(span, span), new MeshStandardMaterial({ color: DST.surround, roughness: 1 }))
    mesh.rotation.x = -Math.PI / 2
    mesh.position.copy(toWorld({ x: width / 2, y: depth / 2 }, -0.03))
    return mesh
  }

  /** The play surface itself: grass, the same speckle the 2D board's own pattern fill draws. */
  private buildGround(width: number, depth: number): Mesh {
    const texture = speckleTexture('g3d-grass', DST.ground, DST.groundFleck1, DST.groundFleck2, 320)
    texture.repeat.set(Math.max(1, width / 5), Math.max(1, depth / 5))
    const material = new MeshStandardMaterial({ color: 0xffffff, map: texture, roughness: 0.96, side: DoubleSide })
    const points = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: depth },
      { x: 0, y: depth },
    ]
    const mesh = new Mesh(flatSlab(points, 0), material)
    tagGround(mesh)
    return mesh
  }

  /** Ticks every inch, a brighter line every 6" — the 2D board's own ruler, drawn on the ground instead of beside it. */
  private buildGrid(width: number, depth: number): Group {
    const group = new Group()
    const minor = new MeshStandardMaterial({ color: DST.grid, roughness: 1, transparent: true, opacity: 0.16, side: DoubleSide })
    const major = new MeshStandardMaterial({ color: DST.grid, roughness: 1, transparent: true, opacity: 0.3, side: DoubleSide })
    const lineWidth = 0.02
    for (let x = 0; x <= width + 1e-6; x += 1) {
      const big = x % 6 === 0
      const w = big ? lineWidth * 1.6 : lineWidth
      const points = [
        { x: x - w / 2, y: 0 },
        { x: x + w / 2, y: 0 },
        { x: x + w / 2, y: depth },
        { x: x - w / 2, y: depth },
      ]
      group.add(new Mesh(flatSlab(points, GRID_Y), big ? major : minor))
    }
    for (let y = 0; y <= depth + 1e-6; y += 1) {
      const big = y % 6 === 0
      const w = big ? lineWidth * 1.6 : lineWidth
      const points = [
        { x: 0, y: y - w / 2 },
        { x: width, y: y - w / 2 },
        { x: width, y: y + w / 2 },
        { x: 0, y: y + w / 2 },
      ]
      group.add(new Mesh(flatSlab(points, GRID_Y), big ? major : minor))
    }
    return group
  }

  /** A low wooden lip right at the table's edge — `dst-frame`'s own idea, standing up instead of drawn flat. */
  private buildFrame(width: number, depth: number): Group {
    const group = new Group()
    const material = new MeshStandardMaterial({ color: DST.frame, roughness: 0.8, side: DoubleSide })
    const bars: Array<[number, number, number, number]> = [
      [-FRAME_WIDTH, -FRAME_WIDTH, width + FRAME_WIDTH * 2, FRAME_WIDTH],
      [-FRAME_WIDTH, depth, width + FRAME_WIDTH * 2, FRAME_WIDTH],
      [-FRAME_WIDTH, 0, FRAME_WIDTH, depth],
      [width, 0, FRAME_WIDTH, depth],
    ]
    for (const [x, y, w, h] of bars) {
      const points = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ]
      group.add(new Mesh(prism(points, 0, FRAME_HEIGHT), material))
    }
    return group
  }

  dispose(): void {
    disposeTree(this.group)
    this.built = null
  }
}
