/**
 * Ship designs.
 *
 * The two hulls below are the introductory scenario's (4.12). The rulebook
 * prints them as SSD images, but 4.11's worked example states them in prose —
 * "two cruisers, each with a thrust rating of 4, armed with three class-2
 * beams, one class-1 beams and two class-3 beams, two FireCon, defended with
 * level-1 screen and grade 5 armor... Each cruiser has 26 damage points" — and
 * that is what is built here.
 *
 * Mass and points on each component come from the construction tables
 * (`src/data/buildCatalog.ts`, sections 13 and 14). `designPricing.priceDesign()` is
 * the authority; `ships.test.ts` asserts the figures below agree with it, so a
 * hand-authored design that drifts from the tables fails the build rather than
 * quietly mispricing a fleet.
 */

import type { ShipDesign, WeaponDef } from '../engine/types'
import { savedDesigns } from './shipyard'
import { GENERATED_DESIGNS } from './generatedShips'

/**
 * A beam mount, priced off the construction table.
 *
 * Beams are the one weapon common to every fleet and the only one the
 * introductory scenario uses, so the table is inlined here rather than reached
 * for through the catalogue — it keeps these two designs readable as designs.
 * Everything else goes through the builder.
 */
const BEAM_COST: Record<number, Record<number, [mass: number, points: number]>> = {
  // class: { arcs: [mass, points] }
  1: { 6: [1, 3] },
  2: { 3: [2, 6], 6: [3, 9] },
  3: { 1: [4, 12], 2: [5, 15], 3: [6, 18], 4: [7, 21], 5: [8, 24], 6: [9, 27] },
  4: { 1: [8, 24], 2: [10, 30], 3: [12, 36], 4: [14, 42], 5: [16, 48], 6: [18, 54] },
  5: { 1: [16, 48], 2: [20, 60], 3: [24, 72], 4: [28, 84], 5: [32, 96], 6: [36, 108] },
}

function beam(id: string, rating: number, arcs: ShipDesign['weapons'][number]['arcs']): WeaponDef {
  const [mass, points] = BEAM_COST[rating][arcs.length]
  return {
    id,
    label: `Beam-${rating}`,
    weaponClass: 'beam',
    rating,
    variant: 'standard',
    arcs,
    mass,
    points,
  }
}

/** The forward three arcs — the commonest mounting on a line ship (4.2). */
const FORWARD_3 = ['FP', 'F', 'FS'] as const
const ALL_6 = ['F', 'FS', 'AS', 'A', 'AP', 'FP'] as const

/**
 * Heavy cruiser — the introductory scenario's line ship (4.12).
 *
 * Mass 88 carries 26 hull boxes at Average integrity (30% of mass, 13.7), which
 * is the 26 damage points 4.11's example states.
 */
export const HEAVY_CRUISER: ShipDesign = {
  id: 'intro-heavy-cruiser',
  name: 'Heavy Cruiser',
  faction: 'Introductory',
  group: 'cruiser',
  mass: 88,
  hullClass: 'average',
  hullRows: 4,
  hullBoxes: 26,
  drive: { thrust: 4, advanced: false },
  ftl: 'standard',
  streamlining: 'none',
  armour: { layers: [5], regenerative: false },
  screens: { level: 1, generators: 1, advanced: false },
  weapons: [
    beam('b3-fwd', 3, [...FORWARD_3]),
    beam('b3-aft', 3, ['AP', 'A', 'AS']),
    beam('b2-p', 2, ['FP', 'AP', 'A']),
    beam('b2-s', 2, ['FS', 'AS', 'A']),
    beam('b2-f', 2, [...FORWARD_3]),
    beam('b1', 1, [...ALL_6]),
  ],
  turrets: [],
  systems: [
    { id: 'fc-1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
    { id: 'fc-2', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
    { id: 'pds-1', kind: 'pds', label: 'PDS', mass: 1, points: 3 },
    { id: 'pds-2', kind: 'pds', label: 'PDS', mass: 1, points: 3 },
    { id: 'pds-3', kind: 'pds', label: 'PDS', mass: 1, points: 3 },
    { id: 'pds-4', kind: 'pds', label: 'PDS', mass: 1, points: 3 },
    // A screen generator is a symbol on the SSD and takes threshold checks
    // like any other (2.4, 4.11); its mass and points are already paid as a
    // fraction of hull mass (7.2), so the entry itself is free.
    { id: 'screen-gen-1', kind: 'screen-generator', label: 'Screen Gen', mass: 0, points: 0 },
  ],
  fighterBays: [],
  gunboats: [],
  additionalDamageControlParties: 0,
  marineParties: 2,
  points: 303,
  provisional: true,
  notes:
    'Built from the prose statement of the introductory cruiser in 4.11. The printed SSD is an ' +
    'image in the rulebook and is not in the text extract, so arc allocation is a reconstruction.',
}

/**
 * Frigate — the introductory scenario's escort (4.12): "fewer thrust, number of
 * Fire-Con and weapons, lack of defenses, and fewer hull boxes".
 *
 * Mass 20 at Strong integrity (40%) gives 8 hull boxes in four rows of two.
 */
export const FRIGATE: ShipDesign = {
  id: 'intro-frigate',
  name: 'Frigate',
  faction: 'Introductory',
  group: 'escort',
  mass: 20,
  hullClass: 'strong',
  hullRows: 4,
  hullBoxes: 8,
  drive: { thrust: 4, advanced: false },
  ftl: 'standard',
  streamlining: 'none',
  armour: { layers: [], regenerative: false },
  screens: { level: 0, generators: 0, advanced: false },
  weapons: [beam('b2-f', 2, [...FORWARD_3]), beam('b1-a', 1, [...ALL_6])],
  turrets: [],
  systems: [
    { id: 'fc-1', kind: 'firecon', label: 'FireCon', mass: 1, points: 4 },
    { id: 'pds-1', kind: 'pds', label: 'PDS', mass: 1, points: 3 },
  ],
  fighterBays: [],
  gunboats: [],
  additionalDamageControlParties: 0,
  marineParties: 1,
  points: 69,
  provisional: true,
  notes: 'Reconstructed from the introductory scenario description in 4.12.',
}

/**
 * Every design the app ships with: the two introductory reconstructions above,
 * and the two fleets generated from the construction tables by
 * `tools/build_roster.py`.
 */
export const SHIP_DESIGNS: ShipDesign[] = [HEAVY_CRUISER, FRIGATE, ...GENERATED_DESIGNS]

/**
 * Designs embedded in the battle being replayed, if any. A save carries every
 * non-canon design it references, so a battle file opens on a browser that has
 * never seen the design (see docs/architecture.md).
 */
let embedded: ShipDesign[] = []

export function setEmbeddedDesigns(designs: ShipDesign[]): void {
  embedded = designs
}

/**
 * The player's own designs, minus any that collide with the shipped roster.
 *
 * The roster is shared vocabulary: `esu-frigate` has to mean the same hull in
 * every player's copy, or two people reading the same battle file are reading
 * different battles. A local design that reuses a canon id is ignored rather
 * than allowed to shadow it. An *embedded* design still wins, because an
 * imported battle's hull may exist nowhere else on this machine.
 */
function yardDesigns(): ShipDesign[] {
  return savedDesigns().filter((d) => !SHIP_DESIGNS.some((canon) => canon.id === d.id))
}

export function designById(id: string): ShipDesign | undefined {
  return (
    embedded.find((d) => d.id === id) ??
    yardDesigns().find((d) => d.id === id) ??
    SHIP_DESIGNS.find((d) => d.id === id)
  )
}

export function allDesigns(): ShipDesign[] {
  const seen = new Set(embedded.map((d) => d.id))
  const yard = yardDesigns().filter((d) => !seen.has(d.id))
  for (const design of yard) seen.add(design.id)
  return [...embedded, ...yard, ...SHIP_DESIGNS.filter((d) => !seen.has(d.id))]
}
