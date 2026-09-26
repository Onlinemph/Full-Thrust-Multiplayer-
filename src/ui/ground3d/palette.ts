/**
 * The 3D ground view's colours, lifted straight from `dirtsideTokens.css`'s
 * `--dst-*` custom properties so a hill, a roof or a river reads the same
 * whether the table is drawn flat or raised. A `<canvas>` material cannot
 * read a CSS variable, so every value here is that token's own hex, copied
 * by hand; if `dirtsideTokens.css` ever moves a colour, this is the file to
 * follow it into.
 */

export const DST = {
  north: 0x64d2ff, // --side-a, Dirtside/Stargrunt's --dst-north
  south: 0xffc24a, // --side-b, --dst-south
  neutral: 0x8b97b0,

  ground: 0x6b7650,
  groundFleck1: 0x78855a,
  groundFleck2: 0x5e6946,
  grid: 0x12160a,

  road: 0xbca77a,
  verge: 0x515e3b,
  tarmac: 0x8f8d86,
  water: 0x3b6a86,
  bank: 0xcbbf92,

  woodsLight: 0x46643a,
  woodsLightTree: 0x58793f,
  woodsLightRim: 0x2b3f23,
  woodsDense: 0x2c4527,
  woodsDenseTree: 0x36552f,
  woodsDenseRim: 0x162413,

  hill: 0x977f52,
  hillStep1: 0xa38c5d,
  hillStep2: 0xae9868,
  hillStep3: 0xb9a474,
  hillStep4: 0xc4b07f,
  hillLine: 0x6f5e38,
  mountain: 0x857765,

  rough: 0x7b7862,
  roughRock1: 0xa39f89,
  roughRock2: 0x55523f,
  scrub: 0x76824e,
  scrubTuft: 0x4c572f,
  field: 0xb3a256,
  fieldFurrow: 0x978842,
  hedge: 0x3e5a31,

  urban: 0x77736a,
  urbanRoof: 0xa39c8e,
  urbanEdge: 0x34322d,
  urbanLot: 0x857f70,
  paving: 0xa89d84,

  swamp: 0x4d6650,
  swampWater: 0x8fb0a6,
  swampReed: 0x2f4331,

  surround: 0x11140d,
  frame: 0x2c2819,

  buildingWall: 0x5c5748,
  roofWarm: [0x8a5a3e, 0x976a45, 0x7c6a4c],
  roofRidgeWarm: 0x4a3222,
  roofCool: [0xa39c8e, 0x7c7768, 0x8f8a7c],
  roofRidgeCool: 0x454136,

  rubble: 0x6a6656,
  rubbleDark: 0x332f24,
  rubbleStub: 0x948d78,
  wallStone: 0x726c5c,

  earth: 0x7d6a45,
  sky: 0x9fc4e8,
  skyHorizon: 0xdce8ef,
} as const

export function sideColorOf(side: string): number {
  if (side === 'north') return DST.north
  if (side === 'south') return DST.south
  return DST.neutral
}
