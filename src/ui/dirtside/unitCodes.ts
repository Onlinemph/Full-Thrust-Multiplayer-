import type { GameState, SideId } from '../../dirtside/table/types'

/**
 * A short code for every unit, shared by its tag on the table and its row
 * in the roster so the eye can go from one to the other: N1, N2… for the
 * north's units and S1, S2… for the south's, in the order the forces were
 * set up.
 */
export function unitCodes(state: GameState): Record<string, string> {
  const codes: Record<string, string> = {}
  for (const side of state.setup.sides) {
    const prefix = side.id === 'north' ? 'N' : 'S'
    side.units.forEach((u, i) => {
      codes[u.id] = `${prefix}${i + 1}`
    })
  }
  // Anything the table holds that the setup does not name still gets a code.
  const next: Record<SideId, number> = { north: 0, south: 0 }
  for (const side of state.setup.sides) next[side.id] = side.units.length
  for (const unit of Object.values(state.units)) {
    if (codes[unit.id]) continue
    next[unit.sideId] += 1
    codes[unit.id] = `${unit.sideId === 'north' ? 'N' : 'S'}${next[unit.sideId]}`
  }
  return codes
}
