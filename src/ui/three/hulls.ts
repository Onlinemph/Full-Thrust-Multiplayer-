/**
 * PLACEHOLDER (stage 2, SHIPS) — a hull's geometry.
 *
 * `ships.ts` asks this module for one mesh per hull; today it hands back a
 * simple wedge sized by mass, just enough to read as "a ship, this big,
 * facing this way" from across the table. The real job — extruding the
 * hull's own silhouette so a carrier reads as a carrier and a freighter as a
 * freighter — belongs here, replacing `hullGeometry` (and whatever this file
 * grows: bevelled plating, drive nozzles, trim) without `ships.ts` having to
 * change its own diffing or its calls into this module.
 *
 * The silhouette to extrude is the same one the 2D counter draws:
 * `counterSilhouette` in `../ssd/layout` (`design.hullClass`/`design.group`
 * pick which one), read back to a bounding box by `hullExtent` in
 * `../plot/hullExtent.ts`. `counterRadius(mass)` from `../Counter.tsx` is the
 * 2D counter's own radius in MU — extrude to roughly that reach fore-and-aft
 * so a hull's footprint agrees with its 2D counter, then let `hullExtent`'s
 * beam/nose/tail proportions shape it rather than a plain wedge.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three'

/**
 * A short, wide wedge pointing toward −Z (the model's "forward", matched to
 * `headingToYaw` in `space.ts`): a flat diamond in X/Z, given a little depth
 * in Y so it catches the sun. Replace with a real extrusion; keep returning
 * geometry centred on the origin, forward along −Z, so `ships.ts` need not
 * change how it places or rotates the result.
 */
export function hullGeometry(radius: number, depth: number): BufferGeometry {
  const nose = radius * 1.15
  const tail = radius * 0.85
  const beam = radius * 0.62
  const halfDepth = depth / 2
  const top = [
    0, halfDepth, -nose,
    beam, halfDepth, 0,
    0, halfDepth, tail,
    -beam, halfDepth, 0,
  ]
  const bottom = top.map((v, i) => (i % 3 === 1 ? -halfDepth : v))
  const positions: number[] = []
  const pushQuad = (a: number[], b: number[], c: number[], d: number[]) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d)
  }
  const at = (arr: number[], i: number) => arr.slice(i * 3, i * 3 + 3)
  // Top and bottom faces.
  pushQuad(at(top, 0), at(top, 1), at(top, 2), at(top, 3))
  pushQuad(at(bottom, 3), at(bottom, 2), at(bottom, 1), at(bottom, 0))
  // Four side faces, top edge to bottom edge.
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    pushQuad(at(top, i), at(top, j), at(bottom, j), at(bottom, i))
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}
