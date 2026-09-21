/**
 * The eight vehicles the book designs on p. 53, with the points it prints
 * for each, and the DEIMOS from p. 16. They are the pricing engine's
 * acceptance test and the Motor Pool's starting shelf.
 */

import type { VehicleDesign } from '../types'
import { newVehicleDesign } from '../design'

function vehicle(id: string, patch: Partial<VehicleDesign>): VehicleDesign {
  return { ...newVehicleDesign(id), ...patch, transport: { ...newVehicleDesign(id).transport, ...patch.transport }, engineering: { ...newVehicleDesign(id).engineering, ...patch.engineering } }
}

export interface BookExample {
  design: VehicleDesign
  /** The points value the book prints. */
  points: number
  page: string
}

export const BOOK_EXAMPLES: readonly BookExample[] = [
  {
    page: 'p. 53 (1)',
    points: 172,
    design: vehicle('book-mbt', {
      name: 'Medium Battle Tank',
      role: 'Medium battle tank (tracked)',
      size: 3,
      mobility: 'fast-tracked',
      power: 'hmt',
      armour: 3,
      weapons: [
        { id: 'w1', type: 'hkp', class: 3, mount: 'turret', barrels: 1 },
        { id: 'w2', type: 'rfac', class: 1, mount: 'turret', barrels: 1 },
      ],
      fireControl: 'superior',
      pds: 'enhanced',
      ecm: 'enhanced',
    }),
  },
  // [reading] The book's own MICV breaks p. 10: an HMT "may support HEL or
  // MDC weapons of up to ONE SIZE CLASS LOWER than the vehicle size", and
  // this is an MDC/2 on a class 2 hull. It is kept as printed (its 71 points
  // depend on it) and the Motor Pool shows the fault.
  {
    page: 'p. 53 (2)',
    points: 71,
    design: vehicle('book-micv', {
      name: 'Light MICV',
      role: 'Light MICV (GEV)',
      size: 2,
      mobility: 'fast-gev',
      power: 'hmt',
      armour: 2,
      weapons: [{ id: 'w1', type: 'mdc', class: 2, mount: 'turret', barrels: 1 }],
      fireControl: 'enhanced',
      ecm: 'basic',
      transport: { lineTeams: 1, poweredTeams: 0, cargoLoads: 0, vehicleSizes: [], commandCentre: false },
    }),
  },
  {
    page: 'p. 53 (3), p. 16',
    points: 356,
    design: vehicle('book-deimos', {
      name: 'DEIMOS/SO',
      role: 'Heavy GEV tank',
      size: 4,
      mobility: 'slow-gev',
      power: 'fgp',
      armour: 4,
      weapons: [{ id: 'w1', type: 'mdc', class: 4, mount: 'turret', barrels: 1 }],
      missiles: [{ id: 'm1', size: 'heavy', guidance: 'enhanced' }],
      fireControl: 'superior',
      pds: 'enhanced',
      ecm: 'enhanced',
      apfc: true,
      stealth: 1,
    }),
  },
  {
    page: 'p. 53 (4)',
    points: 178,
    design: vehicle('book-assault-vtol', {
      name: 'Assault Transport VTOL',
      role: 'Assault transport VTOL',
      size: 3,
      mobility: 'vtol',
      variant: 'transport',
      power: 'fgp',
      armour: 2,
      weapons: [{ id: 'w1', type: 'rfac', class: 1, mount: 'turret', barrels: 1 }],
      fireControl: 'enhanced',
      ecm: 'enhanced',
      transport: { lineTeams: 2, poweredTeams: 0, cargoLoads: 0, vehicleSizes: [], commandCentre: false },
    }),
  },
  {
    page: 'p. 53 (5)',
    points: 70,
    design: vehicle('book-wheeled-apc', {
      name: 'Medium Wheeled APC',
      role: 'Medium wheeled APC',
      size: 3,
      mobility: 'high-wheeled',
      amphibious: true,
      power: 'cfe',
      armour: 3,
      weapons: [{ id: 'w1', type: 'mdc', class: 1, mount: 'turret', barrels: 1 }],
      fireControl: 'enhanced',
      ecm: 'basic',
      transport: { lineTeams: 2, poweredTeams: 0, cargoLoads: 0, vehicleSizes: [], commandCentre: false },
    }),
  },
  {
    page: 'p. 53 (6)',
    points: 209,
    design: vehicle('book-sp-artillery', {
      name: 'Medium Artillery Vehicle',
      role: 'Medium artillery vehicle (tracked)',
      size: 3,
      mobility: 'slow-tracked',
      power: 'cfe',
      armour: 3,
      artillery: 'medium',
      pds: 'basic',
      apfc: true,
      ecm: 'enhanced',
    }),
  },
  {
    page: 'p. 53 (7)',
    points: 393,
    design: vehicle('book-ads', {
      name: 'Area-Defence Vehicle',
      role: 'Area-defence vehicle (tracked)',
      size: 3,
      mobility: 'slow-tracked',
      power: 'cfe',
      armour: 3,
      ads: 'enhanced',
      ecm: 'superior',
      backupSystems: true,
    }),
  },
  {
    page: 'p. 53 (8)',
    points: 274,
    design: vehicle('book-fighter', {
      name: 'Ground-Attack Fighter',
      role: 'Ground-attack aerospace fighter',
      size: 3,
      mobility: 'aerospace',
      power: 'fgp',
      armour: 2,
      ecm: 'enhanced',
      ordnanceLoads: 3,
    }),
  },
]

export function bookExample(id: string): VehicleDesign | undefined {
  return BOOK_EXAMPLES.find((e) => e.design.id === id)?.design
}
