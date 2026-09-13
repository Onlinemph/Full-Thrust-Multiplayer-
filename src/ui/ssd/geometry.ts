import type { ShipDesign } from '../../engine/types'

/**
 * The shape of a hull, worked out from how the ship was built.
 *
 * No artwork and no per-faction table: every number below comes from a fact
 * the designer chose and paid for, so two ships that were built alike look
 * alike, and a ship that was built strangely looks strange. Streamlining makes
 * a hull slender and smooth because that is what streamlining is for (13.10);
 * a super-strong hull is a brick; a big drive needs a broad engine deck; a
 * spinal mount is a gun with a ship built around it (5.23) and shows.
 *
 * The same shape draws the sheet and the counter on the table, which is the
 * point: the thing on the map is the ship on the sheet, at 1/20th the size.
 */

export interface HullShape {
  /** Length over beam, before the contents of the ship have their say. */
  slenderness: number
  /** How far the bow tapers, as a fraction of the run of the ship's guts. */
  noseRun: number
  /** The stern overhang, likewise. */
  tailRun: number
  /** Half-beam at the waist, as a fraction of the full beam. */
  waist: number
  /** Half-beam across the engine deck, likewise. */
  stern: number
  /** How the outline is drawn between its control points. */
  edge: 'curved' | 'chamfered' | 'faceted'
  /** No bow at all: a station is built to sit still and shoot every way. */
  radial: boolean
  /** A spinal mount runs the length of the hull and is drawn doing it. */
  spine: boolean
}

const GROUP_SLENDERNESS: Record<ShipDesign['group'], number> = {
  escort: 2.3,
  cruiser: 2.05,
  capital: 1.85,
  civilian: 1.7,
  monster: 1.45,
  station: 1.0,
}

const STREAMLINING_SLENDERNESS: Record<ShipDesign['streamlining'], number> = {
  full: 1.2,
  partial: 1.08,
  none: 1.0,
}

const CLASS_SLENDERNESS: Record<ShipDesign['hullClass'], number> = {
  fragile: 1.1,
  weak: 1.05,
  average: 1.0,
  strong: 0.95,
  super: 0.9,
}

/** How far the bow runs out, as a fraction of the length of the ship's guts. */
const STREAMLINING_NOSE: Record<ShipDesign['streamlining'], number> = {
  full: 0.56,
  partial: 0.38,
  none: 0.26,
}

const STREAMLINING_WAIST: Record<ShipDesign['streamlining'], number> = {
  full: 0.84,
  partial: 0.91,
  none: 0.97,
}

const STREAMLINING_EDGE: Record<ShipDesign['streamlining'], HullShape['edge']> = {
  full: 'curved',
  partial: 'chamfered',
  none: 'faceted',
}

const SPINAL_CLASSES = new Set([
  'spinal-beam',
  'spinal-plasma',
  'spinal-psp',
  'nova-cannon',
  'wave-gun',
])

export function hasSpinalMount(design: ShipDesign): boolean {
  return design.weapons.some((w) => SPINAL_CLASSES.has(w.weaponClass))
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value
}

export function hullShape(design: ShipDesign): HullShape {
  const spine = hasSpinalMount(design)
  // A station and a ship with no drive are the same problem: nothing about
  // them points anywhere, so a bow would be a lie.
  const radial = design.group === 'station' || design.drive.thrust === 0

  const slenderness = clamp(
    GROUP_SLENDERNESS[design.group] *
      STREAMLINING_SLENDERNESS[design.streamlining] *
      CLASS_SLENDERNESS[design.hullClass] +
      (spine ? 0.35 : 0),
    1,
    2.6,
  )

  return {
    slenderness,
    noseRun: STREAMLINING_NOSE[design.streamlining] + (spine ? 0.08 : 0),
    tailRun: 0.11,
    waist: STREAMLINING_WAIST[design.streamlining],
    // A ship with thrust 8 is mostly engine; a thrust-2 freighter barely has
    // one. The stern is where that shows.
    stern: clamp(0.52 + 0.3 * Math.min(1, design.drive.thrust / 8), 0.45, 0.92),
    edge: STREAMLINING_EDGE[design.streamlining],
    radial,
    spine,
  }
}

/**
 * The hull as drawn: where its outline is, and where its contents may sit.
 *
 * `plan` runs from `noseY` to `tailY` with the ship's guts between `deckTop`
 * and `deckBottom`. Nothing is ever laid out in the bow taper, which is what
 * makes the fit provable rather than hopeful — the outline can only pinch in
 * where there is nothing to pinch.
 */
export interface HullPlan {
  shape: HullShape
  /** Half the widest part of the hull. */
  beam: number
  noseY: number
  deckTop: number
  deckBottom: number
  tailY: number
}

/** The gap kept between a symbol and the hull plating beside it. */
export const HULL_MARGIN = 9

/**
 * How much longer than its build says a hull may end up before it is widened
 * instead. Some slack, because the contents have a say and a ship carrying an
 * unusual amount of one thing should look unusual.
 */
const SLENDERNESS_TOLERANCE = 1.2

export function hullPlan(shape: HullShape, deckHeight: number, deckHalfWidth: number): HullPlan {
  let deck = Math.max(deckHeight, 40)
  let beam = Math.max(deckHalfWidth, 36)
  const nose = shape.radial ? deck * 0.22 : clamp(deck * shape.noseRun, 46, 320)
  const tail = shape.radial ? deck * 0.22 : clamp(deck * shape.tailRun, 30, 110)
  let noseY = -deck / 2 - nose
  let tailY = deck / 2 + tail

  // A hull rounder than its build says it should be gets the difference as
  // length. Most of it goes into the middle body rather than the ends, which
  // is where a real hull puts it: a long ship is a long parallel body with the
  // same bow on the front, not a ship-sized bow with a ship behind it. Nose
  // taper first, engine deck last, and the ends kept to a fraction that still
  // reads as a bow and a stern rather than as a spindle.
  if (!shape.radial) {
    const wanted = shape.slenderness * 2 * beam
    const extra = wanted - (tailY - noseY)
    if (extra > 0) {
      deck += extra * 0.45
      noseY -= extra * (0.45 / 2 + 0.35)
      tailY += extra * (0.45 / 2 + 0.2)
    } else {
      // The other way round: a hull with little in it but a long streamlined
      // bow would come out a spindle. Widened rather than shortened, because
      // shortening it would put the plating back through the contents.
      beam = Math.max(beam, (tailY - noseY) / (2 * shape.slenderness * SLENDERNESS_TOLERANCE))
    }
  }

  return {
    shape,
    beam,
    noseY,
    deckTop: -deck / 2,
    deckBottom: deck / 2,
    tailY,
  }
}

/**
 * Half the hull's width at a given y — how much room a row of symbols has.
 *
 * Only ever asked about the deck, where the answer is between `waist` and 1,
 * because that is the only place anything is drawn.
 */
export function halfBeamAt(plan: HullPlan, y: number): number {
  const { shape, beam, deckTop, deckBottom } = plan
  if (y <= deckTop) {
    if (shape.radial) return beam
    const t = (y - plan.noseY) / (deckTop - plan.noseY)
    return beam * Math.max(0, t)
  }
  if (y >= deckBottom) {
    if (shape.radial) return beam
    const t = (y - deckBottom) / (plan.tailY - deckBottom)
    return beam * (shape.stern + (shape.stern * 0.84 - shape.stern) * t)
  }
  return beam * deckBeamFraction(shape, deckBottom - deckTop, y - (deckTop + deckBottom) / 2)
}

/**
 * The half-beam profile down the deck, as fractions of the full beam.
 *
 * One table, read by two things that must not disagree: the fit calculation,
 * which asks how much room a row of symbols has before the hull is drawn, and
 * the drawing itself. The shape is a hull's: already broad where the bow taper
 * hands over, widest a third of the way back, easing in past midships, and
 * closing on the engine deck.
 */
function deckProfile(shape: HullShape): Array<[number, number]> {
  if (shape.radial) return [[0, 1], [1, 1]]
  return [
    [0, 0.8],
    [0.35, 1],
    [0.72, shape.waist],
    [1, shape.stern],
  ]
}

function interpolate(points: Array<[number, number]>, t: number): number {
  if (t <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i += 1) {
    const [t1, v1] = points[i]
    if (t <= t1) {
      const [t0, v0] = points[i - 1]
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
    }
  }
  return points[points.length - 1][1]
}

/**
 * How much of the full beam the hull has at a point on the deck, from 0 to 1.
 *
 * Separated from `halfBeamAt` because the layout needs it before the beam is
 * known: it lays the ship's guts out first, asks how pinched the hull is where
 * each row sits, and only then works out how wide the hull has to be for
 * everything to fit inside the plating. The answer never depends on the beam,
 * which is what stops that from being circular.
 *
 * `y` is measured from the middle of the deck.
 */
export function deckBeamFraction(shape: HullShape, deckHeight: number, y: number): number {
  const t = deckHeight <= 0 ? 0.5 : clamp((y + deckHeight / 2) / deckHeight, 0, 1)
  return interpolate(deckProfile(shape), t)
}

function round(value: number): string {
  return (Math.round(value * 100) / 100).toString()
}

/** The starboard half of the outline, bow to stern. Port is its mirror. */
function controlPoints(plan: HullPlan): Array<[number, number]> {
  const { shape, beam, noseY, deckTop, deckBottom, tailY } = plan
  if (shape.radial) {
    // An octagon: a station has no bow, so it is drawn as a thing that faces
    // every way at once. The corner cut is the "nose" and "tail" run.
    const cut = Math.min(beam, (deckBottom - deckTop) / 2) * 0.42
    return [
      [0, noseY],
      [beam - cut, noseY],
      [beam, noseY + cut],
      [beam, tailY - cut],
      [beam - cut, tailY],
      [0, tailY],
    ]
  }
  const noseLength = deckTop - noseY
  const deckLength = deckBottom - deckTop
  // A partially streamlined hull has a nose cone rather than a needle, so its
  // stem is a short flat rather than a point. Done here rather than while
  // drawing, so the outline and the fit check see the same hull.
  const stem = shape.edge === 'chamfered' ? beam * 0.12 : 0
  return [
    [stem, noseY],
    [beam * 0.34, noseY + noseLength * 0.3],
    [beam * 0.62, noseY + noseLength * 0.68],
    ...deckProfile(shape).map(([t, f]): [number, number] => [beam * f, deckTop + t * deckLength]),
    [beam * shape.stern * 0.82, tailY],
  ]
}

/**
 * The starboard half turned into a closed loop by mirroring it.
 *
 * A point already on the centreline is not repeated; everything else is,
 * transom included — leaving the transom out is what makes a hull come out
 * with one quarter longer than the other.
 */
function closedLoop(starboard: Array<[number, number]>): Array<[number, number]> {
  const onKeel = (point: [number, number]): boolean => Math.abs(point[0]) < 1e-9
  const back = starboard
    .slice(onKeel(starboard[0]) ? 1 : 0)
    .reverse()
    .filter((point, index) => !(index === 0 && onKeel(point)))
    .map(([x, y]): [number, number] => [-x, y])
  return [...starboard, ...back]
}

/**
 * The hull outline as one closed path, drawn nose-up about the origin.
 *
 * Three edge treatments, and they are not decoration: a fully streamlined hull
 * is a smooth curve because it has to enter an atmosphere, an unstreamlined one
 * is a faceted box because it never will, and a partially streamlined one is
 * the box with its corners taken off.
 */
export function hullPath(plan: HullPlan): string {
  const starboard = controlPoints(plan)
  const loop = closedLoop(starboard)

  if (plan.shape.edge === 'curved') {
    // A quadratic through the midpoints of each edge, with the control points
    // at the corners: the standard way to round a polygon without solving
    // anything, and it keeps the outline inside the polygon, which is what
    // makes the fit still hold after smoothing.
    const mid = (a: [number, number], b: [number, number]): [number, number] => [
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
    ]
    const start = mid(loop[loop.length - 1], loop[0])
    let d = `M ${round(start[0])} ${round(start[1])}`
    for (let i = 0; i < loop.length; i += 1) {
      const corner = loop[i]
      const next = mid(loop[i], loop[(i + 1) % loop.length])
      d += ` Q ${round(corner[0])} ${round(corner[1])} ${round(next[0])} ${round(next[1])}`
    }
    return `${d} Z`
  }

  return `${loop.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${round(x)} ${round(y)}`).join(' ')} Z`
}

/**
 * The extent of a normalised outline, either way from the origin.
 *
 * Not 1: the path is written to two decimal places, and on a unit box that is
 * a hundredth of the ship — visible as a kink once a counter is zoomed in on.
 * A thousand keeps the rounding below a tenth of a pixel at any zoom the map
 * offers. Callers scale by `radius / COUNTER_EXTENT`.
 */
export const COUNTER_EXTENT = 1000

/**
 * The same outline scaled to fit a square box, for the counter.
 *
 * The counter is the sheet at a twentieth of the size, so it must be the same
 * path and not a second drawing of the same idea. Scaled by the longer axis
 * and centred on the hull's own middle, so a long ship reads long on the table.
 */
export function normalisePlan(plan: HullPlan): HullPlan {
  const halfLength = (plan.tailY - plan.noseY) / 2
  const midY = (plan.tailY + plan.noseY) / 2
  const scale = COUNTER_EXTENT / Math.max(halfLength, plan.beam)
  return {
    ...plan,
    beam: plan.beam * scale,
    noseY: (plan.noseY - midY) * scale,
    deckTop: (plan.deckTop - midY) * scale,
    deckBottom: (plan.deckBottom - midY) * scale,
    tailY: (plan.tailY - midY) * scale,
  }
}

export function normalisedHullPath(plan: HullPlan): string {
  return hullPath(normalisePlan(plan))
}

/**
 * The drawn outline as a closed polyline.
 *
 * `hullPath` is the same walk with the curves written out as path commands, so
 * this is what the plating actually is — including the way a curved hull pulls
 * in at the corners, which is exactly the pinch a fit check has to know about
 * and the one a straight profile calculation would miss.
 */
export function outlinePolyline(plan: HullPlan, perSegment = 12): Array<[number, number]> {
  const starboard = controlPoints(plan)
  const loop = closedLoop(starboard)

  if (plan.shape.edge !== 'curved') return loop

  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ]
  const points: Array<[number, number]> = []
  let from = mid(loop[loop.length - 1], loop[0])
  for (let i = 0; i < loop.length; i += 1) {
    const control = loop[i]
    const to = mid(loop[i], loop[(i + 1) % loop.length])
    for (let step = 1; step <= perSegment; step += 1) {
      const t = step / perSegment
      const u = 1 - t
      points.push([
        u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
        u * u * from[1] + 2 * u * t * control[1] + t * t * to[1],
      ])
    }
    from = to
  }
  return points
}

/** Whether a point is inside a closed polyline. The usual ray cast. */
export function insideOutline(outline: ReadonlyArray<[number, number]>, x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
    const [xi, yi] = outline[i]
    const [xj, yj] = outline[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Whether a symbol's box sits wholly inside the plating. */
export function boxInsideOutline(
  outline: ReadonlyArray<[number, number]>,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const hx = width / 2
  const hy = height / 2
  return (
    insideOutline(outline, x - hx, y - hy) &&
    insideOutline(outline, x + hx, y - hy) &&
    insideOutline(outline, x - hx, y + hy) &&
    insideOutline(outline, x + hx, y + hy)
  )
}
