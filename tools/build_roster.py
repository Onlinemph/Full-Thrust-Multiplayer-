"""Generate src/data/ships.ts from the Continuum construction tables.

The tables are section 14 of the rulebook, transcribed from the Full Thrust
Continuum Ultimate Ship Builder spreadsheet. Designs are declared below as a
list of components; this script prices them and emits the TypeScript, so no
mass or points figure in the roster is ever typed by hand.
"""
import json, math

# --- Construction tables (section 14) --------------------------------------
# Weapon cost by (class key, number of arcs) -> (mass, points)
WEAPONS = {
    'beam': {1: {6: (1, 3)},
             2: {3: (2, 6), 6: (3, 9)},
             3: {1: (4, 12), 2: (5, 15), 3: (6, 18), 4: (7, 21), 5: (8, 24), 6: (9, 27)},
             4: {1: (8, 24), 2: (10, 30), 3: (12, 36), 4: (14, 42), 5: (16, 48), 6: (18, 54)},
             5: {1: (16, 48), 2: (20, 60), 3: (24, 72), 4: (28, 84), 5: (32, 96), 6: (36, 108)}},
    'pulse-torpedo': {1: {1: (4, 12), 2: (5, 15), 3: (6, 18)}},
    'pulse-torpedo-short': {1: {1: (2, 6), 3: (3, 9)}},
    'pulse-torpedo-long': {1: {1: (8, 24), 2: (10, 30), 3: (12, 36)}},
    'k-gun': {1: {6: (2, 8)}, 2: {1: (3, 12), 2: (4, 16)}, 3: {1: (5, 20)}, 4: {1: (8, 32)}},
    'heavy-missile': {1: {3: (2, 6)}},
    'heavy-missile-extended': {1: {3: (3, 9)}},
    'salvo-missile-rack': {1: {3: (4, 12)}},
    'salvo-missile-launcher': {1: {3: (3, 9)}},
    'submunition-pack': {1: {3: (1, 3)}},
    'gatling': {1: {1: (2, 8), 3: (3, 12), 6: (4, 16)}},
    'needle-beam': {1: {2: (2, 6), 3: (3, 9)}},
    'plasma-cannon': {1: {3: (1, 3), 6: (2, 6)}, 2: {3: (4, 12), 6: (6, 18)}},
    'graser': {1: {3: (1, 3), 6: (2, 6)}, 2: {3: (4, 12), 6: (6, 18)}},
    'fusion-array': {1: {1: (3, 9), 2: (4, 12), 3: (5, 15)}},
    'pulser': {1: {1: (2, 10), 3: (3, 15), 6: (4, 20)}},
}
VARIANT = {'pulse-torpedo-short': ('pulse-torpedo', 'short'),
           'pulse-torpedo-long': ('pulse-torpedo', 'long'),
           'heavy-missile-extended': ('heavy-missile', 'extended')}

# Flat-cost systems -> (mass, points)
SYSTEMS = {
    'firecon': (1, 4), 'advanced-firecon': (1, 5), 'pds': (1, 3),
    'adfc': (2, 8), 'advanced-adfc': (2, 10), 'ads3': (2, 6), 'ads6': (3, 9),
    'scattergun': (1, 5), 'grapeshot': (1, 4), 'ecm': (1, 3), 'area-ecm': (2, 6),
    'enhanced-sensors': (2, 8), 'superior-sensors': (4, 16),
    'hangar-bay': (6, 18), 'launch-tube': (3, 9), 'boat-bay': (1.5, 0),
    'cargo': (1, 0), 'troop-berthing': (1, 0), 'minesweeper': (5, 15),
    'ortillery': (3, 9), 'shipyard': (1, 2), 'antimatter-charge': (1, 5),
    'stealth-hull': (0, 2),
}
LABELS = {
    'firecon': 'FireCon', 'advanced-firecon': 'Adv FireCon', 'pds': 'PDS',
    'adfc': 'ADFC', 'advanced-adfc': 'Adv ADFC', 'ads3': 'ADS', 'ads6': 'ADS',
    'scattergun': 'Scattergun', 'grapeshot': 'Grapeshot', 'ecm': 'ECM',
    'area-ecm': 'Area ECM', 'enhanced-sensors': 'Enh Sensors',
    'superior-sensors': 'Sup Sensors', 'hangar-bay': 'Hangar', 'launch-tube': 'Launch Tube',
    'boat-bay': 'Boat Bay', 'cargo': 'Cargo', 'troop-berthing': 'Troops',
    'minesweeper': 'Minesweeper', 'ortillery': 'Ortillery', 'shipyard': 'Shipyard',
    'antimatter-charge': 'AM Charge', 'stealth-hull': 'Stealth Hull',
}
KIND = {'ads3': 'ads', 'ads6': 'ads'}
HULL_FRACTION = {'fragile': .1, 'weak': .2, 'average': .3, 'strong': .4, 'super': .5}
HULL_PTS = {3: 3, 4: 2, 5: 1.5, 6: 1}
ARMOUR_PTS = [2, 4, 6, 8, 10]           # inner layer, then each shell (7.7)
WEAPON_LABEL = {
    'beam': 'Beam-{r}', 'pulse-torpedo': 'Pulse Torp', 'pulse-torpedo-short': 'SR Pulse Torp',
    'pulse-torpedo-long': 'LR Pulse Torp', 'k-gun': 'K-{r}', 'heavy-missile': 'Heavy Missile',
    'heavy-missile-extended': 'ER Missile', 'salvo-missile-rack': 'SM Rack',
    'salvo-missile-launcher': 'SML', 'submunition-pack': 'Submunition', 'gatling': 'Gatling',
    'needle-beam': 'Needle-{r}', 'plasma-cannon': 'Plasma-{r}', 'graser': 'Graser-{r}',
    'fusion-array': 'Fusion Array', 'pulser': 'Pulser',
}
F3, A3, ALL6, P3, S3 = ['FP','F','FS'], ['AP','A','AS'], ['F','FS','AS','A','AP','FP'], ['FP','AP','A'], ['FS','AS','A']

def solve_mass(d):
    """Smallest hull that carries the design.

    Hull boxes, the drive, FTL, streamlining and screens are all fractions of
    total mass (13.7 – 13.11), so the fit is a fixed point rather than a sum:
    mass >= flat / (1 - fractions). Weapons, armour and the flat systems are
    the numerator. Rounded up to an even number, the way a designer would.
    """
    frac = HULL_FRACTION[d['hull']] + 0.05 * d['thrust']
    if d.get('ftl', True):
        frac += 0.1
    if d.get('stream'):
        frac += 0.05 if d['stream'] == 'partial' else 0.1
    if d.get('screens'):
        frac += (0.075 if d.get('advScreens') else 0.05) * d['screens']
    flat = sum(d.get('armour', []))
    for wc, rating, arcs in [(w[0], w[1], w[2]) for w in d.get('weapons', [])]:
        flat += WEAPONS[wc][rating][len(arcs)][0]
    for key, count in d.get('systems', []):
        flat += SYSTEMS[key][0] * count
    need = flat / (1 - frac)
    return int(math.ceil(need / 2) * 2)


def price(d):
    mass = pts = 0.0
    boxes = math.floor(d['mass'] * HULL_FRACTION[d['hull']])
    mass += boxes; pts += boxes * HULL_PTS[d['rows']]
    dm = 0.05 * d['thrust'] * d['mass']; mass += dm; pts += dm * (3 if d.get('advDrive') else 2)
    if d.get('ftl', True):
        fm = 0.1 * d['mass']; mass += fm; pts += fm * (3 if d.get('advFtl') else 2)
    if d.get('stream'):
        mass += (0.05 if d['stream'] == 'partial' else 0.1) * d['mass']
    for i, layer in enumerate(d.get('armour', [])):
        mass += layer; pts += layer * ARMOUR_PTS[i]
    if d.get('screens'):
        adv = d.get('advScreens'); per = (0.075 if adv else 0.05) * d['mass']
        sm = per * d['screens']; mass += sm; pts += sm * (4 if adv else 3)
    weapons = []
    for n, (wc, rating, arcs, *rest) in enumerate(d.get('weapons', [])):
        wm, wp = WEAPONS[wc][rating][len(arcs)]
        base, variant = VARIANT.get(wc, (wc, 'standard'))
        weapons.append({'id': f'w{n+1}', 'label': WEAPON_LABEL[wc].format(r=rating),
                        'weaponClass': base, 'rating': rating, 'variant': variant,
                        'arcs': arcs, 'mass': wm, 'points': wp})
        mass += wm; pts += wp
    systems = []
    for n, (key, count) in enumerate(d.get('systems', [])):
        sm, sp = SYSTEMS[key]
        for i in range(count):
            systems.append({'id': f'{key}-{i+1}', 'kind': KIND.get(key, key),
                            'label': LABELS[key], 'mass': sm, 'points': sp})
            mass += sm; pts += sp
    pts += d.get('dcp', 0) * 5 + d.get('marines', 0) * 5
    # floor(x + 0.5), not Python's round(): round() is half-to-even, so a total
    # of 348.5 comes out 348 here and 349 in the TypeScript that checks it. A
    # screen level is 5% of mass, so halves are common.
    return boxes, round(mass, 2), int(math.floor(pts + 0.5)), weapons, systems

DESIGNS = [
  # ── Eurasian Solar Union ─────────────────────────────────────────────────
  # Tough hulls, mass drivers and missiles. Slow, heavily armoured, and
  # content to trade fire: ESU doctrine is to close and stay closed.
  dict(id='esu-corvette', name='Nadezhda-class Corvette', faction='Eurasian Solar Union',
       group='escort', mass=20, hull='weak', rows=4, thrust=6, ftl=False,
       weapons=[('beam',1,ALL6), ('beam',1,ALL6)], systems=[('firecon',1),('pds',1)], dcp=1),
  dict(id='esu-frigate', name='Storozhevoy-class Frigate', faction='Eurasian Solar Union',
       group='escort', mass=28, hull='average', rows=4, thrust=4, armour=[2],
       weapons=[('beam',2,F3), ('k-gun',1,ALL6)], systems=[('firecon',1),('pds',1)], dcp=1),
  dict(id='esu-destroyer', name='Bystry-class Destroyer', faction='Eurasian Solar Union',
       group='escort', mass=40, hull='average', rows=4, thrust=4, armour=[2],
       weapons=[('beam',2,F3), ('beam',2,A3), ('heavy-missile',1,F3)],
       systems=[('firecon',2),('pds',2)], dcp=2, marines=1),
  dict(id='esu-light-cruiser', name='Suvorov-class Light Cruiser', faction='Eurasian Solar Union',
       group='cruiser', mass=60, hull='average', rows=4, thrust=4, armour=[3], screens=1,
       weapons=[('beam',3,F3), ('beam',2,P3), ('beam',2,S3)],
       systems=[('firecon',2),('pds',2)], dcp=2, marines=2),
  dict(id='esu-heavy-cruiser', name='Petrograd-class Heavy Cruiser', faction='Eurasian Solar Union',
       group='cruiser', mass=90, hull='average', rows=4, thrust=4, armour=[4], screens=1,
       weapons=[('beam',3,F3), ('beam',3,A3), ('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6),
                ('salvo-missile-rack',1,F3)],
       systems=[('firecon',2),('pds',3),('adfc',1)], dcp=3, marines=2),
  dict(id='esu-battlecruiser', name='Kirov-class Battlecruiser', faction='Eurasian Solar Union',
       group='capital', mass=124, hull='average', rows=4, thrust=4, armour=[5], screens=1,
       weapons=[('beam',4,F3), ('beam',3,A3), ('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6),
                ('k-gun',2,['F']), ('salvo-missile-rack',1,F3)],
       systems=[('firecon',3),('pds',4),('adfc',1),('ecm',1)], dcp=4, marines=3),
  dict(id='esu-battleship', name='Volga-class Battleship', faction='Eurasian Solar Union',
       group='capital', mass=170, hull='average', rows=4, thrust=3, armour=[6,3], screens=2,
       weapons=[('beam',4,F3), ('beam',4,A3), ('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6),
                ('k-gun',3,['F']), ('salvo-missile-rack',1,F3)],
       systems=[('firecon',3),('pds',5),('advanced-adfc',1),('ecm',1)], dcp=5, marines=4),
  dict(id='esu-carrier', name='Gagarin-class Fleet Carrier', faction='Eurasian Solar Union',
       group='capital', mass=160, hull='average', rows=4, thrust=4, armour=[4], screens=1,
       weapons=[('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6)],
       systems=[('firecon',2),('pds',5),('advanced-adfc',1),('hangar-bay',4),('launch-tube',3)],
       dcp=4, marines=2, bays=4),
  # ── New Anglian Confederation ────────────────────────────────────────────
  # Screens and beams, pulse torpedoes for the closing pass. Faster hulls that
  # expect to choose the range and hold it.
  dict(id='nac-corvette', name='Kestrel-class Corvette', faction='New Anglian Confederation',
       group='escort', mass=20, hull='weak', rows=4, thrust=6, ftl=False,
       weapons=[('beam',1,ALL6), ('pulse-torpedo-short',1,['F'])],
       systems=[('firecon',1),('pds',1)], dcp=1),
  dict(id='nac-frigate', name='Bellerophon-class Frigate', faction='New Anglian Confederation',
       group='escort', mass=28, hull='weak', rows=4, thrust=6, screens=1,
       weapons=[('beam',2,F3), ('beam',1,ALL6)], systems=[('firecon',1),('pds',1)], dcp=1),
  dict(id='nac-destroyer', name='Ranger-class Destroyer', faction='New Anglian Confederation',
       group='escort', mass=42, hull='average', rows=4, thrust=6, screens=1,
       weapons=[('beam',2,F3), ('beam',2,A3), ('pulse-torpedo-short',1,['F'])],
       systems=[('firecon',2),('pds',2)], dcp=2, marines=1),
  dict(id='nac-light-cruiser', name='Huron-class Light Cruiser', faction='New Anglian Confederation',
       group='cruiser', mass=62, hull='average', rows=4, thrust=4, armour=[2], screens=1,
       weapons=[('beam',3,F3), ('beam',2,P3), ('beam',2,S3), ('pulse-torpedo',1,F3)],
       systems=[('firecon',2),('pds',2),('adfc',1)], dcp=2, marines=2),
  dict(id='nac-heavy-cruiser', name='Victoria-class Heavy Cruiser', faction='New Anglian Confederation',
       group='cruiser', mass=92, hull='average', rows=4, thrust=4, armour=[3], screens=2,
       weapons=[('beam',3,F3), ('beam',3,A3), ('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6),
                ('pulse-torpedo',1,F3)],
       systems=[('firecon',2),('pds',3),('adfc',1)], dcp=3, marines=2),
  dict(id='nac-battlecruiser', name='Valley Forge-class Battlecruiser', faction='New Anglian Confederation',
       group='capital', mass=128, hull='average', rows=4, thrust=4, armour=[4], screens=2,
       weapons=[('beam',4,F3), ('beam',3,A3), ('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6),
                ('pulse-torpedo',1,F3)],
       systems=[('firecon',3),('pds',4),('adfc',1),('ecm',1)], dcp=4, marines=3),
  dict(id='nac-battleship', name='Excalibur-class Battleship', faction='New Anglian Confederation',
       group='capital', mass=176, hull='average', rows=4, thrust=3, armour=[6,2], screens=2,
       weapons=[('beam',4,F3), ('beam',4,A3), ('beam',3,P3), ('beam',3,S3), ('beam',1,ALL6),
                ('pulse-torpedo-long',1,F3)],
       systems=[('firecon',3),('pds',5),('advanced-adfc',1),('ecm',1)], dcp=5, marines=4),
  dict(id='nac-carrier', name='Ark Royal-class Fleet Carrier', faction='New Anglian Confederation',
       group='capital', mass=150, hull='average', rows=4, thrust=4, armour=[3], screens=2,
       weapons=[('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6)],
       systems=[('firecon',2),('pds',4),('advanced-adfc',1),('hangar-bay',3),('launch-tube',3)],
       dcp=4, marines=2, bays=3),
]

import sys
out, over = [], []
for d in DESIGNS:
    # The declared mass is the designer's intent; the solver is the arithmetic.
    d['mass'] = max(d['mass'], solve_mass(d))
    # Spend whatever mass is left over on armour, which is what a designer does
    # with a few spare tons: it is the only system that comes in units of one
    # mass and always has somewhere to go (7.6). A hull that carries 14 mass of
    # systems on a 20-mass frame is a design mistake, not a light ship.
    boxes, mass, pts, weapons, systems = price(d)
    slack = int(d['mass'] - mass)
    if slack > 0:
        # Armour first, but never more armour than hull — a hull carrying more
        # ablative plate than structure is a design nobody builds. Anything left
        # after that goes in the hold, which is free (13.13).
        layers = d.setdefault('armour', [])
        room = max(0, boxes - sum(layers))
        take = min(slack, room)
        if take:
            if layers:
                layers[0] += take
            else:
                d['armour'] = [take]
        hold = slack - take
        if hold:
            d.setdefault('systems', []).append(('cargo', hold))
        boxes, mass, pts, weapons, systems = price(d)
    if mass > d['mass'] + 1e-6:
        over.append(f"{d['id']}: {mass} on a {d['mass']} hull — over by {mass - d['mass']:.2f}")
    out.append(dict(design=d, boxes=boxes, used=mass, points=pts, weapons=weapons, systems=systems))
if over:
    print('\n'.join(over), file=sys.stderr)
    raise SystemExit(1)

# --- Emit TypeScript --------------------------------------------------------
def ts(value):
    return json.dumps(value)

lines = ['''/**
 * Ship designs.
 *
 * GENERATED by tools/build_roster.py from the section 14 construction tables —
 * do not hand-edit the numbers. Every mass and points figure below is computed,
 * so a design can never quietly drift from what the tables say it costs.
 *
 * Hull integrity, the drive, FTL and screens are all fractions of total mass
 * (13.7 – 13.10), so fitting a design is a fixed point rather than a sum: the
 * generator solves for the smallest hull that carries the loadout, then spends
 * the remainder on armour and cargo the way a designer would.
 *
 * The two introductory hulls are separate: the rulebook prints them as SSD
 * images and states them in prose at 4.11, so they are reconstructions and are
 * marked provisional.
 */

import type { ShipDesign } from '../engine/types'
''']

def design_ts(r):
    d = r['design']
    parts = [f"  id: {ts(d['id'])},", f"  name: {ts(d['name'])},",
             f"  faction: {ts(d['faction'])},", f"  group: {ts(d['group'])},",
             f"  mass: {d['mass']},", f"  hullClass: {ts(d['hull'])},",
             f"  hullRows: {d['rows']},", f"  hullBoxes: {r['boxes']},",
             f"  drive: {{ thrust: {d['thrust']}, advanced: {str(bool(d.get('advDrive'))).lower()} }},",
             f"  ftl: {ts('standard' if d.get('ftl', True) else 'none')},",
             f"  streamlining: {ts(d.get('stream') or 'none')},",
             f"  armour: {{ layers: {ts(d.get('armour', []))}, regenerative: false }},",
             f"  screens: {{ level: {d.get('screens', 0)}, generators: {d.get('screens', 0)}, advanced: {str(bool(d.get('advScreens'))).lower()} }},",
             "  weapons: [",
             *[f"    {ts(w)}," for w in r['weapons']],
             "  ],", "  turrets: [], ",
             "  systems: [",
             *[f"    {ts(s)}," for s in r['systems']],
             "  ],",
             f"  fighterBays: {ts([{'typeId': 'standard', 'label': f'Flight {i+1}'} for i in range(d.get('bays', 0))])},",
             "  gunboats: [],",
             f"  damageControlParties: {d.get('dcp', 0)},",
             f"  marineParties: {d.get('marines', 0)},",
             f"  points: {r['points']},"]
    return "{\n" + "\n".join(parts) + "\n}"

const_names = []
for r in out:
    name = r['design']['id'].upper().replace('-', '_')
    const_names.append(name)
    lines.append(f"export const {name}: ShipDesign = {design_ts(r)}\n")

lines.append("/** Every design the app ships with. */")
lines.append("export const GENERATED_DESIGNS: ShipDesign[] = [")
for name in const_names:
    lines.append(f"  {name},")
lines.append("]")
open('src/data/generatedShips.ts', 'w').write("\n".join(lines) + "\n")
print(f"wrote src/data/generatedShips.ts — {len(out)} designs")
