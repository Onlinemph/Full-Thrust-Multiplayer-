/**
 * The optional rules a table settles before the first order (2.6 and the
 * sections named), as the setup form and the rules presets both list them.
 * Each key is a `GameSetup` field the engine reads; `setupPassthrough.test.ts`
 * holds every live one to that.
 */

import type { GameSetup } from './savedGame'

export interface OptionalRule {
  key: keyof GameSetup
  label: string
  rule: string
  detail: string
  /**
   * Why this one is not in force yet.
   *
   * A switch that does nothing is worse than a switch that is not there: the
   * player sets it, plays a battle under a rule they think they chose, and the
   * engine never hears about it. `setupPassthrough.test.ts` holds the rest of
   * this list to the opposite standard.
   */
  notYet?: string
}

export const OPTIONAL_RULES: OptionalRule[] = [
  {
    key: 'emergencyThrust',
    label: 'Emergency thrust',
    rule: '3.6',
    detail: 'Up to 150% of the drive rating, at the risk of damaging it.',
  },
  {
    key: 'knockedOffCourse',
    label: 'Knocked off course',
    rule: '12.11',
    detail:
      'A threshold point rolls once more, at the same odds, to see whether the hit slewed the ' +
      'ship a clock point off its heading.',
  },
  {
    key: 'tableReentry',
    label: 'Return to the table',
    rule: '3.9',
    detail:
      'A ship that flies off the edge rolls a die: 4 or better and it may come back after that ' +
      'many turns, 3 or less and it has left the battle for good.',
  },
  {
    key: 'shapedCharges',
    label: 'Shaped charges',
    rule: '6.8',
    detail:
      'A Plasma Bolt Launcher may be fired straight at a ship in phase 11 instead of placing a ' +
      'marker: 1D3 a class, Semi-Armour Piercing, and Standard Screens do nothing to it.',
  },
  {
    key: 'movingTable',
    label: 'Moving table',
    rule: '16.4',
    detail:
      'Slide the playing area under the ships when the action drifts into a corner. Leaving the ' +
      'edge then stops being a retreat, and a fleet that runs can be pursued (16.5).',
  },
  {
    key: 'aftArcFire',
    label: 'Aft arc fire',
    rule: '4.2',
    detail:
      'A ship that spent no thrust at all this turn may shoot through its own drive plume. ' +
      'Without this the aft arc is closed to offensive fire, always.',
  },
  {
    key: 'rearArcAttacks',
    label: 'Rear arc attacks',
    rule: '4.10',
    detail: 'Fire from inside a target’s rear arc ignores its armour entirely.',
  },
  {
    key: 'driveDamage',
    label: 'Drive damage',
    rule: '4.11',
    detail: 'A ship that lost two or more hull rows rolls twice for its drive.',
  },
  {
    key: 'coreSystems',
    label: 'Core systems',
    rule: '10.3',
    detail: 'A bridge, life support and a power core that damage can single out.',
  },
  {
    key: 'reactorBreaches',
    label: 'Reactor breaches',
    rule: '10.3',
    detail: 'A gutted reactor may take the ship, and its neighbours, with it.',
  },
  {
    key: 'fighterMorale',
    label: 'Fighter morale',
    rule: '8.17',
    detail:
      'A group that has lost anyone rolls before it attacks, and aborts if the die beats the ' +
      'number of fighters left. An aborted attack spends no endurance. Robot fighters are immune.',
  },
  {
    key: 'fighterQuality',
    label: 'Aces and turkeys',
    rule: '8.18',
    detail:
      'Every group rolls at the start of the game: a 6 puts an Ace in it, a 1 makes it a Turkey. ' +
      'An Ace is an extra attack die and the last pilot to die; a Turkey is −1 in dogfights and ' +
      'on intercepts.',
  },
  {
    key: 'multiStageMissiles',
    label: 'Multi-stage missiles',
    rule: '6.6',
    detail: 'Missiles that fly on after a first stage burns out.',
    notYet: 'a two-stage mount flies its two stages already; the magazine rules are not in',
  },
  {
    key: 'terrainHazards',
    rule: '17',
    label: 'Terrain hazards',
    detail:
      'A planetoid you fly into destroys you outright, a cloud crossed above 12 MU costs a die, ' +
      'and an asteroid field costs one per 6 MU straight through screens and armour. Without ' +
      'this the rock on the table is only cover.',
  },
  {
    key: 'orbitalTable',
    rule: '17.7',
    label: 'Orbital table',
    detail:
      'The table is a slice of orbit above a planet, so running off the edge is a lap round the ' +
      'world rather than a retreat: the ship comes back on the opposite edge at the same course ' +
      'and speed, three to five turns later depending on its thrust.',
  },
  {
    key: 'strikeColors',
    rule: '12.9',
    label: 'Striking the colors',
    detail:
      'A ship crossing a hull row rolls against the same ladder as its threshold check, and on a ' +
      'failure her captain surrenders to the nearest enemy vessel. The hull is a prize, intact ' +
      'and out of the fight.',
  },
  {
    key: 'civilWar',
    rule: '12.10',
    label: 'Civil war',
    detail:
      'Both fleets built by the same navy know where each other are thin: +1 on every direct-fire ' +
      'die. Nothing for ordnance, point defence or fighters, and the engine checks the fleets ' +
      'really are one navy before granting it.',
  },
  {
    key: 'solarFlares',
    rule: '17.3',
    label: 'Solar flares',
    detail:
      'A star on the table flares now and then and every ship in reach rolls for each FireCon, ' +
      'plus one per active screen level: below a 4 the box is knocked out. Nothing to fly round ' +
      'and nothing to plot against — screens are the only answer.',
  },
  {
    key: 'cpv',
    label: 'Combat Points Value',
    rule: '18.3',
    detail:
      'Reprice every hull by its mass rather than by the printed figure. Small ships get cheaper, ' +
      'big ones dearer, and the scoreboard counts in the same currency. On for a new battle; off ' +
      'prices and scores in the printed points instead.',
  },
  {
    key: 'sensorRules',
    label: 'Sensors and ECM',
    rule: '12.1',
    detail: 'Enemy SSDs are closed: you see what your sensors tell you and no more.',
  },
]

