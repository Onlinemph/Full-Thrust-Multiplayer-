/**
 * DIRTSIDE'S OWN FILE — the 6mm models: what a vehicle or an infantry stand
 * actually looks like, built from its own design (Chapter 3) exactly as
 * `ui/dirtside/map/geometry.ts`'s own `silhouetteOf`/`infantryLabel` read it
 * for the 2D counter, but standing up rather than a flat symbol. Copied
 * logic, not an import of that UI file, so `ground3d/` stays out of
 * `ui/dirtside/`'s own map code (the same reasoning GROUND's own
 * `ground3d/geometry.ts` gives for copying `insetShape`/`decorRandom`).
 *
 * Every model is built local, front along -Z (the same convention the 2D
 * counter draws with its front at -y — table -y is world -Z, `space.ts`),
 * so a plain `mesh.rotation.y = headingToYaw(facing)` turns it the right
 * way, unrotated at heading 0 (north). Nothing here reads `ElementState`;
 * `units.ts` positions, rotates, tags and marks whatever these return.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { mobilityFamily } from '../../../dirtside/data/mobility'
import type { InfantryElement, VehicleDesign } from '../../../dirtside/types'
import { glowTexture } from '../textures'

/** What carries the model — `ui/dirtside/map/geometry.ts`'s own `Gear`, re-derived here from the design alone. */
export type Gear = 'tracks' | 'wheels' | 'skirt' | 'grav' | 'legs' | 'rotor' | 'wings' | 'hull'
/** What sits on the hull — that file's own `Body`. */
export type Body = 'turret' | 'carrier' | 'ifv' | 'artillery' | 'air-defence' | 'plain'

export interface VehicleShape {
  gear: Gear
  body: Body
  /** How high the hull floats above `heightAt` — 0 for ground vehicles, more for a hovering grav tank or a low VTOL. */
  hover: number
  /** A short family name for the tooltip. */
  label: string
}

/** The same read `silhouetteOf` gives the 2D counter (gear from mobility, body from armament/transport/role). */
export function shapeOf(design: VehicleDesign): VehicleShape {
  const m = design.mobility
  let gear: Gear
  let hover = 0
  if (m === 'vtol') {
    gear = 'rotor'
    hover = 0.62
  } else if (m === 'aerospace') {
    gear = 'wings'
    hover = 0.9
  } else if (m === 'boat' || m === 'hydrofoil') gear = 'hull'
  else {
    const family = mobilityFamily(m)
    gear = family === 'tracked' ? 'tracks' : family === 'gev' ? 'skirt' : family === 'grav' ? 'grav' : family === 'walker' ? 'legs' : 'wheels'
    if (gear === 'skirt') hover = 0.05
    if (gear === 'grav') hover = 0.16
  }
  const armed = design.weapons.length > 0 || design.missiles.length > 0
  const carries = design.transport.lineTeams + design.transport.poweredTeams > 0
  let body: Body
  if (design.artillery) body = 'artillery'
  else if (!armed && (design.ads || design.lad > 0)) body = 'air-defence'
  else if (carries) body = design.weapons.length > 0 ? 'ifv' : 'carrier'
  else if (design.weapons.length > 0) body = 'turret'
  else if (design.ads || design.lad > 0) body = 'air-defence'
  else body = 'plain'
  const gearWord: Record<Gear, string> = { tracks: '', wheels: 'wheeled ', skirt: 'hover ', grav: 'grav ', legs: 'walker ', rotor: 'VTOL ', wings: 'aerospace ', hull: 'boat ' }
  const bodyWord: Record<Body, string> = { turret: 'tank', carrier: 'carrier', ifv: 'fighting carrier', artillery: 'artillery', 'air-defence': 'air defence', plain: 'vehicle' }
  const label = gear === 'legs' ? (body === 'carrier' ? 'transport walker' : 'combat walker') : gear === 'rotor' || gear === 'wings' ? `${gearWord[gear]}${body === 'turret' ? 'gunship' : bodyWord[body]}`.trim() : `${gearWord[gear]}${bodyWord[body]}`
  return { gear, body, hover, label }
}

/** Class 1 (very small) to 7 (oversize) scaled to a gentle size spread around the 2D counter's own fixed footprint. */
export function sizeScaleOf(size: number): number {
  return Math.min(1.55, Math.max(0.72, 0.66 + size * 0.11))
}

// Dark enough to read as "a silhouette in ink" over the side-coloured base pad (the 2D counter's own idea), but
// light enough that the scene's own sun/fill lights actually model it — a near-black tone just goes flat.
const INK = 0x6b7066
const INK_LIGHT = 0x9aa093

function ink(opts: { roughness?: number; metalness?: number } = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: INK, roughness: opts.roughness ?? 0.55, metalness: opts.metalness ?? 0.1 })
}
function inkLight(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: INK_LIGHT, roughness: 0.5, metalness: 0.1 })
}

/** The hull's own footprint, in local inches — `ui/dirtside/map/counters.tsx`'s own `VEHICLE_BASE`, before size scaling. */
export const VEHICLE_FOOTPRINT = { w: 0.5, d: 0.82, wallH: 0.16 }

function box(w: number, h: number, d: number, mat: MeshStandardMaterial): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), mat)
  return m
}

// ── Undercarriage ────────────────────────────────────────────────────────

function buildGear(gear: Gear, fp: typeof VEHICLE_FOOTPRINT): Group {
  const root = new Group()
  root.name = 'gear'
  switch (gear) {
    case 'tracks': {
      const trackW = fp.w * 0.22
      const trackH = fp.wallH * 0.9
      for (const side of [-1, 1]) {
        const t = box(trackW, trackH, fp.d * 1.04, ink({ roughness: 0.85 }))
        t.position.set((side * (fp.w / 2 + trackW / 2 - 0.01)), trackH / 2, 0)
        root.add(t)
      }
      break
    }
    case 'wheels': {
      const r = fp.wallH * 0.42
      const positions = [-fp.d * 0.32, 0, fp.d * 0.32]
      for (const side of [-1, 1]) {
        for (const z of positions) {
          const wheel = new Mesh(new CylinderGeometry(r, r, fp.w * 0.16, 10), ink({ roughness: 0.8 }))
          wheel.rotation.z = Math.PI / 2
          wheel.position.set(side * (fp.w / 2 + 0.01), r, z)
          root.add(wheel)
        }
      }
      break
    }
    case 'skirt': {
      const skirt = new Mesh(new CylinderGeometry(fp.w * 0.56, fp.w * 0.62, fp.wallH * 0.7, 16), inkLight())
      skirt.position.y = fp.wallH * 0.35
      skirt.scale.set(1, 1, fp.d / fp.w)
      root.add(skirt)
      break
    }
    case 'grav': {
      const ring = new Mesh(new TorusGeometry(fp.w * 0.5, fp.wallH * 0.22, 8, 16), inkLight())
      ring.rotation.x = Math.PI / 2
      ring.scale.set(1, fp.d / fp.w, 1)
      root.add(ring)
      break
    }
    case 'legs': {
      const legR = fp.wallH * 0.22
      const legH = fp.wallH * 2.4
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const leg = new Mesh(new CylinderGeometry(legR * 0.8, legR, legH, 6), ink())
          leg.position.set(sx * fp.w * 0.32, legH / 2, sz * fp.d * 0.3)
          leg.rotation.z = sx * 0.12
          root.add(leg)
          const foot = new Mesh(new BoxGeometry(legR * 2.4, legR * 0.8, legR * 3), inkLight())
          foot.position.set(sx * fp.w * 0.34, legR * 0.4, sz * fp.d * 0.32)
          root.add(foot)
        }
      }
      break
    }
    case 'hull': {
      const hull = new Mesh(new CapsuleGeometry(fp.w * 0.42, fp.d * 0.5, 4, 8), ink({ roughness: 0.7 }))
      hull.rotation.x = Math.PI / 2
      hull.scale.set(1, 1, 1.15)
      hull.position.y = fp.wallH * 0.3
      root.add(hull)
      break
    }
    case 'rotor':
    case 'wings':
      // Airframes stand on nothing: `units.ts` hovers them instead.
      break
  }
  return root
}

// ── Body ─────────────────────────────────────────────────────────────────

function buildBody(body: Body, fp: typeof VEHICLE_FOOTPRINT, gear: Gear, weaponClass: number): { group: Group; topY: number } {
  const root = new Group()
  root.name = 'body'
  const deckY = gear === 'legs' ? fp.wallH * 2.4 : gear === 'skirt' ? fp.wallH * 0.7 : gear === 'grav' ? fp.wallH * 0.5 : gear === 'hull' ? fp.wallH * 0.6 : fp.wallH
  const hullH = fp.wallH * 1.3
  const hull = box(fp.w * 0.96, hullH, fp.d * 0.92, ink())
  hull.position.y = deckY + hullH / 2
  root.add(hull)
  let topY = deckY + hullH

  const barrel = (len: number, r: number, z: number, y: number, tilt = 0) => {
    const g = new Mesh(new CylinderGeometry(r, r * 1.05, len, 6), inkLight())
    g.rotation.x = Math.PI / 2 + tilt
    g.position.set(0, y, z - (len / 2) * Math.cos(tilt))
    return g
  }

  switch (body) {
    case 'turret': {
      const tr = fp.w * 0.26
      const th = fp.wallH * 0.85
      const turret = new Mesh(new CylinderGeometry(tr, tr * 1.08, th, 10), inkLight())
      turret.position.y = topY + th / 2
      root.add(turret)
      const barLen = fp.d * (0.55 + Math.min(3, weaponClass) * 0.08)
      root.add(barrel(barLen, tr * 0.14, -tr * 0.7, topY + th / 2))
      topY += th
      break
    }
    case 'ifv': {
      const cab = box(fp.w * 0.7, fp.wallH * 0.5, fp.d * 0.36, ink())
      cab.position.set(0, topY + fp.wallH * 0.25, fp.d * 0.16)
      root.add(cab)
      const tr = fp.w * 0.22
      const th = fp.wallH * 0.55
      const turret = new Mesh(new CylinderGeometry(tr, tr * 1.1, th, 8), inkLight())
      turret.position.set(0, topY + fp.wallH * 0.5 + th / 2, -fp.d * 0.12)
      root.add(turret)
      root.add(barrel(fp.d * 0.45, tr * 0.16, -fp.d * 0.12 - tr * 0.6, topY + fp.wallH * 0.5 + th / 2))
      topY += fp.wallH * 0.5 + th
      break
    }
    case 'carrier': {
      const cab = box(fp.w * 0.86, fp.wallH * 0.62, fp.d * 0.7, ink())
      cab.position.set(0, topY + fp.wallH * 0.31, fp.d * 0.05)
      root.add(cab)
      topY += fp.wallH * 0.62
      break
    }
    case 'artillery': {
      const bed = box(fp.w * 0.6, fp.wallH * 0.5, fp.d * 0.5, ink())
      bed.position.set(0, topY + fp.wallH * 0.25, fp.d * 0.1)
      root.add(bed)
      const g = barrel(fp.d * (0.9 + Math.min(3, weaponClass) * 0.12), fp.wallH * 0.16, fp.d * 0.05, topY + fp.wallH * 0.5, -0.42)
      root.add(g)
      const shield = box(fp.w * 0.5, fp.wallH * 0.6, 0.02, inkLight())
      shield.position.set(0, topY + fp.wallH * 0.6, -fp.d * 0.28)
      root.add(shield)
      topY += fp.wallH * 0.9
      break
    }
    case 'air-defence': {
      const dish = new Mesh(new ConeGeometry(fp.w * 0.34, fp.wallH * 0.14, 12, 1, true), inkLight())
      dish.position.set(0, topY + fp.wallH * 0.35, 0)
      dish.rotation.x = Math.PI * 0.62
      root.add(dish)
      for (const side of [-1, 1]) {
        const rack = box(fp.w * 0.1, fp.wallH * 0.5, fp.d * 0.2, inkLight())
        rack.position.set(side * fp.w * 0.3, topY + fp.wallH * 0.25, -fp.d * 0.2)
        rack.rotation.x = -0.3
        root.add(rack)
      }
      topY += fp.wallH * 0.6
      break
    }
    case 'plain': {
      const deck = box(fp.w * 0.6, fp.wallH * 0.2, fp.d * 0.4, inkLight())
      deck.position.set(0, topY + fp.wallH * 0.1, 0)
      root.add(deck)
      topY += fp.wallH * 0.2
      break
    }
  }
  return { group: root, topY }
}

/** A rotor for a VTOL: two thin blades that spin (`tick`, respecting reduced motion — `units.ts` owns the clock). */
function buildRotor(fp: typeof VEHICLE_FOOTPRINT): { hub: Group; blades: Mesh } {
  const hub = new Group()
  const fuselage = box(fp.w * 0.5, fp.wallH * 0.9, fp.d * 1.0, ink())
  hub.add(fuselage)
  const mast = new Mesh(new CylinderGeometry(0.02, 0.02, fp.wallH * 0.6, 6), inkLight())
  mast.position.y = fp.wallH * 0.75
  hub.add(mast)
  const tailBoom = box(fp.w * 0.14, fp.wallH * 0.28, fp.d * 0.7, ink())
  tailBoom.position.set(0, fp.wallH * 0.1, fp.d * 0.75)
  hub.add(tailBoom)
  const blades = new Mesh(new BoxGeometry(fp.d * 1.7, 0.02, fp.w * 0.14), inkLight())
  blades.position.y = fp.wallH * 1.05
  hub.add(blades)
  return { hub, blades }
}

/** Fixed wings for the rare aerospace design that shows up on a Dirtside table (a pass marker more than a model). */
function buildWings(fp: typeof VEHICLE_FOOTPRINT): Group {
  const g = new Group()
  const fuselage = box(fp.w * 0.4, fp.wallH * 0.6, fp.d * 1.2, ink())
  g.add(fuselage)
  const wing = box(fp.w * 1.9, fp.wallH * 0.12, fp.d * 0.32, inkLight())
  wing.position.y = fp.wallH * 0.05
  g.add(wing)
  const tail = box(fp.w * 0.7, fp.wallH * 0.5, fp.d * 0.16, inkLight())
  tail.position.set(0, fp.wallH * 0.3, fp.d * 0.55)
  g.add(tail)
  return g
}

export interface VehicleModel {
  root: Group
  /** The whole model's own local height, hull to the tallest point — for camera/label placement. */
  height: number
  /** The rotor disc, when this is a VTOL, for `units.ts` to spin. */
  rotor: Mesh | null
  shape: VehicleShape
}

/** The vehicle model, local-origin at ground (before `hover`/`heightAt`), front at -Z, side-neutral (ink, not painted). */
export function buildVehicleModel(design: VehicleDesign): VehicleModel {
  const s = sizeScaleOf(design.size)
  const fp = { w: VEHICLE_FOOTPRINT.w * s, d: VEHICLE_FOOTPRINT.d * s, wallH: VEHICLE_FOOTPRINT.wallH * s }
  const shape = shapeOf(design)
  const root = new Group()
  let rotor: Mesh | null = null
  let height = fp.wallH
  if (shape.gear === 'rotor') {
    const { hub, blades } = buildRotor(fp)
    root.add(hub)
    rotor = blades
    height = fp.wallH * 1.2
  } else if (shape.gear === 'wings') {
    root.add(buildWings(fp))
    height = fp.wallH * 0.8
  } else {
    root.add(buildGear(shape.gear, fp))
    const weaponClass = design.weapons[0]?.class ?? 2
    const { group: bodyGroup, topY } = buildBody(shape.body, fp, shape.gear, weaponClass)
    root.add(bodyGroup)
    height = topY
  }
  return { root, height, rotor, shape }
}

// ── Infantry ────────────────────────────────────────────────────────────

const FIGURE_H = 0.22
const HEAD_R = 0.045

function buildFigure(powered: boolean): Group {
  const g = new Group()
  const bodyR = powered ? 0.06 : 0.045
  const bodyH = powered ? FIGURE_H * 1.05 : FIGURE_H
  const body = new Mesh(new CapsuleGeometry(bodyR, bodyH * 0.55, 3, 6), ink({ roughness: 0.75 }))
  body.position.y = bodyH * 0.5 + bodyR
  g.add(body)
  const head = new Mesh(new SphereGeometry(HEAD_R, 8, 6), inkLight())
  head.position.y = bodyH + bodyR * 1.2
  g.add(head)
  if (powered) {
    const pack = box(bodyR * 1.5, bodyH * 0.5, bodyR * 1.2, inkLight())
    pack.position.set(0, bodyH * 0.55, -bodyR * 1.3)
    g.add(pack)
  }
  return g
}

/** The team's own weapon or role, held or mounted beside the middle figure — `InfantrySilhouette`'s own glyph, in the round. */
function buildGlyph(inf: InfantryElement): Group | null {
  const g = new Group()
  switch (inf.team) {
    case 'apsw': {
      const gun = box(0.03, 0.03, 0.26, inkLight())
      gun.position.set(0.07, FIGURE_H * 0.6, 0)
      g.add(gun)
      const bipod = new Mesh(new CylinderGeometry(0.012, 0.012, 0.1, 4), inkLight())
      bipod.position.set(0.07, FIGURE_H * 0.55 - 0.05, 0.1)
      g.add(bipod)
      break
    }
    case 'anti-armour': {
      const tube = new Mesh(new CylinderGeometry(0.025, 0.03, 0.28, 8), inkLight())
      tube.rotation.z = Math.PI / 2
      tube.rotation.x = -0.35
      tube.position.set(0.1, FIGURE_H * 0.85, -0.08)
      g.add(tube)
      break
    }
    case 'observer': {
      const mast = new Mesh(new CylinderGeometry(0.008, 0.008, 0.22, 4), inkLight())
      mast.position.set(0.08, FIGURE_H * 0.9, 0)
      g.add(mast)
      const dish = new Mesh(new ConeGeometry(0.05, 0.02, 8), inkLight())
      dish.position.set(0.08, FIGURE_H + 0.11, 0)
      dish.rotation.x = Math.PI / 2
      g.add(dish)
      break
    }
    case 'air-defence': {
      const tube = new Mesh(new CylinderGeometry(0.02, 0.028, 0.3, 8), inkLight())
      tube.rotation.z = Math.PI / 2 - 0.6
      tube.position.set(0.1, FIGURE_H * 0.95, 0.02)
      g.add(tube)
      break
    }
    case 'engineer': {
      const box1 = box(0.1, 0.06, 0.06, inkLight())
      box1.position.set(0.1, FIGURE_H * 0.28, 0)
      g.add(box1)
      break
    }
    case 'assault': {
      for (const side of [-1, 1]) {
        const blade = box(0.02, 0.16, 0.02, inkLight())
        blade.position.set(0.09 + side * 0.05, FIGURE_H * 0.7, 0)
        blade.rotation.z = side * 0.5
        g.add(blade)
      }
      break
    }
    default:
      return null
  }
  return g
}

export interface InfantryModel {
  root: Group
  height: number
}

/** The infantry stand: 2–3 small figures on a base, front at -Z — `InfantrySilhouette`'s own dot layout, stood up. */
export function buildInfantryModel(inf: InfantryElement): InfantryModel {
  const root = new Group()
  const powered = inf.troops === 'powered'
  const dots = inf.team === 'rifle' ? [-0.14, 0, 0.14] : [-0.16, -0.02]
  dots.forEach((z, i) => {
    const figure = buildFigure(powered)
    figure.position.set(0, 0, z + (inf.team === 'rifle' && i === 1 ? -0.05 : 0.03))
    root.add(figure)
  })
  const glyph = buildGlyph(inf)
  if (glyph) {
    glyph.position.z = dots[0]! + 0.03
    root.add(glyph)
  }
  if (powered) {
    const ring = new Mesh(new RingGeometry(0.22, 0.24, 16), new MeshStandardMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.35, side: DoubleSide }))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.003
    root.add(ring)
  }
  if (inf.cavalry) {
    for (const child of root.children) child.scale.y *= 1.35
  }
  return { root, height: powered ? FIGURE_H * 1.35 : FIGURE_H * 1.15 }
}

/** A soft glow disc under a hovering grav tank — the anti-grav shimmer the 2D counter only hints at with an outline. */
export function buildHoverGlow(radius: number): Mesh {
  const mat = new MeshStandardMaterial({ map: glowTexture(), color: 0xbfe7ff, transparent: true, opacity: 0.55, emissive: new Color(0x3a6a86), emissiveIntensity: 0.4, depthWrite: false })
  const mesh = new Mesh(new CylinderGeometry(radius, radius * 0.2, 0.02, 20), mat)
  return mesh
}
