import { validateDesign, proportionalCost, priceDesign } from './src/data/designPricing'
import type { ShipDesign } from './src/engine/types'

const d: ShipDesign = {
  id: 'x', name: 'X', faction: 'Cygnan Assembly', group: 'cruiser',
  mass: 60, hullClass: 'average', hullRows: 4, hullBoxes: 18,
  drive: { thrust: 6, advanced: true }, ftl: 'standard', streamlining: 'none',
  armour: { layers: [], regenerative: false },
  screens: { level: 0, generators: 0, advanced: false },
  weapons: [], turrets: [],
  systems: [{ id: 'holofield-1', kind: 'holofield', label: 'Holofield', mass: 0, points: 0 }],
  fighterBays: [], gunboats: [],
  additionalDamageControlParties: 0, marineParties: 0, points: 1,
} as any
console.log('proportionalCost', proportionalCost('holofield', d))
console.log('faults', JSON.stringify(validateDesign(d)))
console.log('price', priceDesign(d))
