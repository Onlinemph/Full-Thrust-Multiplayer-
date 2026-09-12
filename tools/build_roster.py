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

    # --- 14.4, the families the engine could resolve but nobody could buy ---
    # Every figure below is table 14.4 or 14.6, mass first and the section's
    # own points multiplier applied. Where the table gives "N/1 arc, +M mass
    # per additional arc" the arc counts are expanded here so the catalogue
    # stays a plain lookup.
    'emp': {1: {6: (1, 3)},
            2: {3: (2, 6), 6: (3, 9)},
            3: {1: (4, 12), 2: (5, 15), 3: (6, 18), 4: (7, 21), 5: (8, 24), 6: (9, 27)},
            4: {1: (8, 24), 2: (10, 30), 3: (12, 36), 4: (14, 42), 5: (16, 48), 6: (18, 54)}},
    # Heavy Grasers: "x3 OR x4 for High Intensity Grasers" — the standard rate.
    'heavy-graser': {1: {1: (2, 6), 3: (3, 9), 6: (4, 12)},
                     2: {1: (9, 27), 2: (12, 36), 3: (15, 45), 6: (24, 72)},
                     3: {1: (24, 72), 2: (30, 90), 3: (36, 108), 6: (54, 162)}},
    # Phasers: "x3+2 OR x6 if ship also mounts Advanced fire control".
    # [reading] the +2 is read as a flat surcharge on the mount, so a mount of
    # mass m costs 3m + 2. The alternative is that it means five per mass,
    # which for a 16-mass Phaser-4 is 80 rather than 50 — a real difference,
    # and the text will not settle it. The lower reading is taken because the
    # printed alternative (x6) is meant to be the expensive option.
    'phaser': {1: {3: (1, 5), 6: (2, 8)},
               2: {3: (4, 14), 6: (6, 20)},
               3: {1: (8, 26), 2: (10, 32), 3: (12, 38)},
               4: {1: (16, 50), 2: (20, 62), 3: (24, 74)}},
    'transporter': {1: {6: (1, 3)},
                    2: {3: (2, 6), 6: (3, 9)},
                    3: {1: (4, 12), 2: (5, 15), 3: (6, 18), 4: (7, 21), 5: (8, 24), 6: (9, 27)},
                    4: {1: (8, 24), 2: (10, 30), 3: (12, 36), 4: (14, 42), 5: (16, 48), 6: (18, 54)}},
    'twin-particle-array': {1: {1: (2, 8), 3: (3, 12), 6: (4, 16)}},
    'meson-projector': {1: {1: (2, 8), 3: (3, 12), 6: (4, 16)}},
    'gravitic-gun': {1: {6: (1, 3)},
                     2: {3: (2, 6), 6: (3, 9)},
                     3: {1: (4, 12), 2: (5, 15), 3: (6, 18), 4: (7, 21), 5: (8, 24), 6: (9, 27)}},
    # 14.4 lists K5 and K6, and the short and long ranged guns of every class.
    'k-gun-5': {5: {1: (11, 44)}},
    'k-gun-6': {6: {1: (14, 56)}},
    'k-gun-short': {1: {6: (1, 4)}, 2: {2: (2, 8)}, 3: {1: (3, 12)},
                    4: {1: (4, 16)}, 5: {1: (6, 24)}, 6: {1: (7, 28)}},
    'k-gun-long': {1: {6: (4, 16)}, 2: {1: (6, 24), 2: (8, 32)}, 3: {1: (10, 40)},
                   4: {1: (16, 64)}, 5: {1: (22, 88)}, 6: {1: (28, 112)}},
    'needle-beam-2': {2: {1: (4, 12), 2: (6, 18), 3: (8, 24)}},
    'needle-beam-3': {3: {1: (8, 24), 2: (12, 36), 3: (16, 48)}},
    'needle-beam-4': {4: {1: (16, 48), 2: (24, 72), 3: (32, 96)}},
    'graser-3': {3: {1: (8, 24), 2: (10, 30), 3: (12, 36)}},
    'graser-4': {4: {1: (16, 48), 2: (20, 60), 3: (24, 72)}},
    'plasma-cannon-3': {3: {1: (8, 24), 2: (10, 30), 3: (12, 36)}},
    'plasma-cannon-4': {4: {1: (16, 48), 2: (20, 60), 3: (24, 72)}},
    'boarding-torpedo': {1: {3: (2, 6)}},
    'mkp': {1: {3: (1, 4)}},
    'antimatter-missile': {1: {3: (2, 10)}},
    'rocket-pod': {1: {3: (1, 3)}},
    'mine-rack': {1: {3: (2, 6)}},
    # 6.8: a Plasma Bolt Launcher is mass 3 per class for one arc, +class per
    # additional arc, three arcs at most (14.4).
    'plasma-bolt-launcher': {1: {1: (3, 9), 2: (4, 12), 3: (5, 15)},
                             2: {1: (6, 18), 2: (8, 24), 3: (10, 30)},
                             3: {1: (9, 27), 2: (12, 36), 3: (15, 45)},
                             4: {1: (12, 36), 2: (16, 48), 3: (20, 60)},
                             5: {1: (15, 45), 2: (20, 60), 3: (25, 75)},
                             6: {1: (18, 54), 2: (24, 72), 3: (30, 90)}},
    # 14.5 spinal mounts: 8, 16 or 32 mass reaching 24, 32 or 48 MU. Beam and
    # plasma at x4, the Point Singularity Projector at x5. A spinal mount fires
    # on the centre line, so it is a one-arc fit.
    'spinal-beam': {1: {1: (8, 32)}, 2: {1: (16, 64)}, 3: {1: (32, 128)}},
    'spinal-plasma': {1: {1: (8, 32)}, 2: {1: (16, 64)}, 3: {1: (32, 128)}},
    'spinal-psp': {1: {1: (8, 40)}, 2: {1: (16, 80)}, 3: {1: (32, 160)}},
    # 7.23, 7.24: the two superweapons are flat, and fire on the centre line.
    'nova-cannon': {1: {1: (20, 60)}},
    'wave-gun': {1: {1: (12, 36)}},
}
VARIANT = {'pulse-torpedo-short': ('pulse-torpedo', 'short'),
           'pulse-torpedo-long': ('pulse-torpedo', 'long'),
           'heavy-missile-extended': ('heavy-missile', 'extended'),
           'k-gun-short': ('k-gun', 'short'),
           'k-gun-long': ('k-gun', 'long'),
           'k-gun-5': ('k-gun', 'standard'),
           'k-gun-6': ('k-gun', 'standard'),
           'needle-beam-2': ('needle-beam', 'standard'),
           'needle-beam-3': ('needle-beam', 'standard'),
           'needle-beam-4': ('needle-beam', 'standard'),
           'graser-3': ('graser', 'standard'),
           'graser-4': ('graser', 'standard'),
           'plasma-cannon-3': ('plasma-cannon', 'standard'),
           'plasma-cannon-4': ('plasma-cannon', 'standard')}

# Flat-cost systems -> (mass, points)
SYSTEMS = {
    'firecon': (1, 4), 'advanced-firecon': (1, 5), 'pds': (1, 3),
    'adfc': (2, 8), 'advanced-adfc': (2, 10), 'ads3': (2, 6), 'ads6': (3, 9),
    'scattergun': (1, 5), 'grapeshot': (1, 4), 'ecm': (1, 3), 'area-ecm': (2, 6),
    'enhanced-sensors': (2, 8), 'superior-sensors': (4, 16),
    'hangar-bay': (6, 18), 'launch-tube': (3, 9), 'boat-bay': (1.5, 0),
    # 9.1: "Gunboat Racks are 18 mass for a squadron of 6 gunboats. The cost of
    # the rack is included in the gunboat cost", and "Bays are 24 mass and cost
    # 0 points". A rack launches a squadron and cannot take it back.
    'gunboat-rack': (18, 0), 'gunboat-bay': (24, 0),
    'cargo': (1, 0), 'troop-berthing': (1, 0), 'minesweeper': (5, 15),
    'ortillery': (3, 9), 'shipyard': (1, 2), 'antimatter-charge': (1, 5),
    # 14.1 prices a stealth hull per hull/armour box, not flat; the catalogue
    # carries a placeholder that designPricing.proportionalCost replaces.
    'stealth-hull': (0, 0),
    'stealth-field': (0, 0),
    'catapult': (1, 0),
    'weasel-emitter': (2, 8),
    # The optional systems of 7.17 - 7.25 are shares of the hull, not flat
    # fits, so the catalogue carries a placeholder and `proportionalCost` in
    # designPricing.ts prices one the moment it is fitted to a design.
    'holofield': (0, 0), 'cloaking-device': (1, 0), 'cloaking-field': (1, 0),
    'tuffley-cloak': (0, 0), 'reflex-field': (0, 0),
}

# 7.17 - 7.25 and 14.1 - 14.2: systems priced as a share of the hull rather than
# as a flat fit. The same table as designPricing.PROPORTIONAL_SYSTEMS, and it has
# to stay the same table: ships.test.ts prices every generated design again in
# TypeScript and fails the build if the two disagree.
#
#   massFraction   share of TOTAL ship mass the fitting weighs
#   pointsPerMass  points per point of that mass
#   pointsFraction points as a share of total ship mass, for a flat-mass fitting
#   pointsPerBox   points per hull-and-armour box, which is how 14.1 prices a
#                  stealth hull: it charges for what there is to hide
PROPORTIONAL = {
    'holofield':       {'massFraction': 0.1,  'pointsPerMass': 5},
    'tuffley-cloak':   {'massFraction': 0.1,  'pointsPerMass': 10},
    'reflex-field':    {'massFraction': 0.1,  'pointsPerMass': 6},
    'cloaking-device': {'mass': 1, 'pointsFraction': 0.5},
    'cloaking-field':  {'mass': 1, 'pointsFraction': 1.0},
    'stealth-hull':    {'mass': 0, 'pointsPerBox': 2},
    'stealth-field':   {'massFraction': 0.05, 'pointsPerMass': 6},
}


def proportional_cost(key, ship_mass, boxes):
    """Mass and points of one proportional fitting on a hull of this size."""
    spec = PROPORTIONAL[key]
    mass = spec['massFraction'] * ship_mass if 'massFraction' in spec else spec['mass']
    if 'pointsPerBox' in spec:
        pts = spec['pointsPerBox'] * boxes
    elif 'pointsFraction' in spec:
        pts = spec['pointsFraction'] * ship_mass
    else:
        pts = mass * spec['pointsPerMass']
    return round(mass, 2), int(math.floor(pts + 0.5))


# 9.2, per gunboat. A rack always carries six, so a rack costs six of these.
GUNBOAT_POINTS = {
    'beam': 9, 'plasma': 9, 'graser': 9, 'gatling': 15, 'needle': 9,
}
LABELS = {
    'firecon': 'FireCon', 'advanced-firecon': 'Adv FireCon', 'pds': 'PDS',
    'adfc': 'ADFC', 'advanced-adfc': 'Adv ADFC', 'ads3': 'ADS', 'ads6': 'ADS',
    'scattergun': 'Scattergun', 'grapeshot': 'Grapeshot', 'ecm': 'ECM',
    'area-ecm': 'Area ECM', 'enhanced-sensors': 'Enh Sensors',
    'superior-sensors': 'Sup Sensors', 'hangar-bay': 'Hangar', 'launch-tube': 'Launch Tube',
    'gunboat-rack': 'Gunboat Rack', 'gunboat-bay': 'Gunboat Bay',
    'holofield': 'Holofield', 'cloaking-device': 'Cloaking Device',
    'stealth-field': 'Stealth Field', 'catapult': 'Catapult',
    'weasel-emitter': 'Weasel Emitter',
    'cloaking-field': 'Cloaking Field', 'tuffley-cloak': 'Tuffley Cloak',
    'reflex-field': 'Reflex Field',
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
    'emp': 'EMP-{r}', 'heavy-graser': 'Hvy Graser-{r}', 'phaser': 'Phaser-{r}',
    'transporter': 'Transporter-{r}', 'twin-particle-array': 'Twin Particle Array',
    'meson-projector': 'Meson Projector', 'gravitic-gun': 'Grav-{r}',
    'k-gun-5': 'K-{r}', 'k-gun-6': 'K-{r}', 'k-gun-short': 'SRK-{r}', 'k-gun-long': 'LRK-{r}',
    'needle-beam-2': 'Needle-{r}', 'needle-beam-3': 'Needle-{r}', 'needle-beam-4': 'Needle-{r}',
    'graser-3': 'Graser-{r}', 'graser-4': 'Graser-{r}',
    'plasma-cannon-3': 'Plasma-{r}', 'plasma-cannon-4': 'Plasma-{r}',
    'boarding-torpedo': 'Boarding Torp', 'mkp': 'MKP', 'antimatter-missile': 'AM Missile',
    'rocket-pod': 'Rocket Pod', 'mine-rack': 'Mine Rack',
    'plasma-bolt-launcher': 'PBL-{r}',
    'spinal-beam': 'Spinal Beam-{r}', 'spinal-plasma': 'Spinal Plasma-{r}',
    'spinal-psp': 'Spinal PSP-{r}', 'nova-cannon': 'Nova Cannon', 'wave-gun': 'Wave Gun',
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
        if key in PROPORTIONAL:
            spec = PROPORTIONAL[key]
            # A share of total mass belongs in the fraction, not the flat sum:
            # it grows with the hull it is fitted to, which is the whole point
            # of the fixed point this function solves.
            if 'massFraction' in spec:
                frac += spec['massFraction'] * count
            else:
                flat += spec['mass'] * count
            continue
        flat += SYSTEMS[key][0] * count
    need = flat / (1 - frac)
    return int(math.ceil(need / 2) * 2)


# 7.2: "Screens may be of level 1 or 2" — the engine's ScreenLevel is 0 | 1 | 2,
# so a level-3 design does not fail a test, it fails to compile, in a generated
# file, a long way from the dict that asked for it.
MAX_SCREEN_LEVEL = 2


def price(d):
    if d.get('screens', 0) > MAX_SCREEN_LEVEL:
        raise SystemExit(
            f"{d['id']}: level-{d['screens']} screens; 7.2 stops at {MAX_SCREEN_LEVEL}"
        )
    if d.get('rows', 4) not in HULL_PTS:
        raise SystemExit(f"{d['id']}: {d['rows']} hull rows; 13.7 prices 3 to 6")
    mass = pts = 0.0
    boxes = math.floor(d['mass'] * HULL_FRACTION[d['hull']])
    mass += boxes; pts += boxes * HULL_PTS[d['rows']]
    dm = 0.05 * d['thrust'] * d['mass']; mass += dm; pts += dm * (3 if d.get('advDrive') else 2)
    if d.get('ftl', True):
        fm = 0.1 * d['mass']; mass += fm; pts += fm * (3 if d.get('advFtl') else 2)
    if d.get('stream'):
        mass += (0.05 if d['stream'] == 'partial' else 0.1) * d['mass']
    # 7.8: regenerative armour is the same mass and 2 points more a box, which
    # is what designPricing.armourPoints charges. The two must agree or
    # ships.test.ts fails, which is the point of it.
    regen = 2 if d.get('regen') else 0
    for i, layer in enumerate(d.get('armour', [])):
        mass += layer; pts += layer * (ARMOUR_PTS[i] + regen)
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
        if key in PROPORTIONAL:
            sm, sp = proportional_cost(key, d['mass'], boxes + sum(d.get('armour', [])))
        # 9.1: "The cost of the rack is included in the gunboat cost." Read the
        # other way round, which is the way that makes a tender cost what it is
        # worth: you buy six gunboats and the rack comes with them. So a rack
        # carries the squadron's points, or a tender fields 162 points of
        # gunboats for nothing.
        if key == 'gunboat-rack':
            sp = GUNBOAT_POINTS[d.get('gunboatType', 'beam')] * 6
        for i in range(count):
            systems.append({'id': f'{key}-{i+1}', 'kind': KIND.get(key, key),
                            'label': LABELS[key], 'mass': sm, 'points': sp})
            mass += sm; pts += sp
    # Screen generators are symbols on the SSD and take threshold checks like any
    # other (2.4, 4.11), so each needs an entry in `systems` — but their mass and
    # points are already paid as a fraction of hull mass above (7.2), so the
    # entries themselves are free. Losing one drops the working screen level.
    for i in range(d.get('screens', 0)):
        systems.append({'id': f'screen-gen-{i+1}', 'kind': 'screen-generator',
                        'label': 'Screen Gen', 'mass': 0, 'points': 0})
    # 10.4 gives a military hull one crew factor per 20 mass and one damage
    # control party per factor, free. Only 13.13's *additional* parties and the
    # marines are bought, at 5 points each (14.3). The `dcp=` on a design is
    # therefore extras, and no hull in this roster buys any.
    pts += d.get('dcp', 0) * 5 + d.get('marines', 0) * 5
    # floor(x + 0.5), not Python's round(): round() is half-to-even, so a total
    # of 348.5 comes out 348 here and 349 in the TypeScript that checks it. A
    # screen level is 5% of mass, so halves are common.
    # An overweight hull is a design mistake, and designPricing reports it a long
    # way from here — in a TypeScript test, about a file this script generated.
    # Fail at the point the mistake was made instead. `solve_mass` is not the
    # test: it over-reserves, because it works off the unfloored hull fraction,
    # so a design two mass under what it suggests can still fit.
    if round(mass, 2) > d['mass'] + 1e-6:
        raise SystemExit(
            f"{d['id']}: declared mass {d['mass']} but the loadout weighs {round(mass, 2)}; "
            f"solve_mass suggests {solve_mass(d)}"
        )
    return boxes, round(mass, 2), int(math.floor(pts + 0.5)), weapons, systems

DESIGNS = [
  # ── Eurasian Solar Union ─────────────────────────────────────────────────
  # Tough hulls, mass drivers and missiles. Slow, heavily armoured, and
  # content to trade fire: ESU doctrine is to close and stay closed.
  dict(id='esu-corvette', name='Nadezhda-class Corvette', faction='Eurasian Solar Union',
       group='escort', mass=20, hull='weak', rows=4, thrust=6, ftl=False,
       weapons=[('beam',1,ALL6), ('beam',1,ALL6)], systems=[('firecon',1),('pds',1)]),
  dict(id='esu-frigate', name='Storozhevoy-class Frigate', faction='Eurasian Solar Union',
       group='escort', mass=28, hull='average', rows=4, thrust=4, armour=[2],
       weapons=[('beam',2,F3), ('k-gun',1,ALL6)], systems=[('firecon',1),('pds',1)]),
  dict(id='esu-destroyer', name='Bystry-class Destroyer', faction='Eurasian Solar Union',
       group='escort', mass=40, hull='average', rows=4, thrust=4, armour=[2],
       weapons=[('beam',2,F3), ('beam',2,A3), ('heavy-missile',1,F3)],
       systems=[('firecon',2),('pds',2)], marines=1),
  dict(id='esu-light-cruiser', name='Suvorov-class Light Cruiser', faction='Eurasian Solar Union',
       group='cruiser', mass=60, hull='average', rows=4, thrust=4, armour=[3], screens=1,
       weapons=[('beam',3,F3), ('beam',2,P3), ('beam',2,S3)],
       systems=[('firecon',2),('pds',2)], marines=2),
  dict(id='esu-heavy-cruiser', name='Petrograd-class Heavy Cruiser', faction='Eurasian Solar Union',
       group='cruiser', mass=90, hull='average', rows=4, thrust=4, armour=[4], screens=1,
       weapons=[('beam',3,F3), ('beam',3,A3), ('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6),
                ('salvo-missile-rack',1,F3)],
       systems=[('firecon',2),('pds',3),('adfc',1)], marines=2),
  dict(id='esu-battlecruiser', name='Kirov-class Battlecruiser', faction='Eurasian Solar Union',
       group='capital', mass=124, hull='average', rows=4, thrust=4, armour=[5], screens=1,
       weapons=[('beam',4,F3), ('beam',3,A3), ('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6),
                ('k-gun',2,['F']), ('salvo-missile-rack',1,F3)],
       systems=[('firecon',3),('pds',4),('adfc',1),('ecm',1)], marines=3),
  dict(id='esu-battleship', name='Volga-class Battleship', faction='Eurasian Solar Union',
       group='capital', mass=170, hull='average', rows=4, thrust=3, armour=[6,3], screens=2,
       weapons=[('beam',4,F3), ('beam',4,A3), ('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6),
                ('k-gun',3,['F']), ('salvo-missile-rack',1,F3)],
       systems=[('firecon',3),('pds',5),('advanced-adfc',1),('ecm',1)], marines=4),
  dict(id='esu-carrier', name='Gagarin-class Fleet Carrier', faction='Eurasian Solar Union',
       group='capital', mass=160, hull='average', rows=4, thrust=4, armour=[4], screens=1,
       weapons=[('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6)],
       systems=[('firecon',2),('pds',5),('advanced-adfc',1),('hangar-bay',4),('launch-tube',3)],
       marines=2, bays=4),
  # A gunboat tender: racks on the hull, a bay to take the squadrons back, and
  # only enough of its own armament to defend itself. Gunboats reach 12 MU and
  # move 18, so a tender fights at a range its own guns cannot (9.1).
  dict(id='esu-tender', name='Sevastopol-class Gunboat Tender', faction='Eurasian Solar Union',
       group='capital', mass=140, hull='average', rows=4, thrust=4, armour=[3], screens=1,
       weapons=[('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6)],
       systems=[('firecon',2),('pds',4),('adfc',1),('gunboat-rack',3),('gunboat-bay',1)],
       marines=2, racks=3, gunboatType='beam'),
  # ── New Anglian Confederation ────────────────────────────────────────────
  # Screens and beams, pulse torpedoes for the closing pass. Faster hulls that
  # expect to choose the range and hold it.
  dict(id='nac-corvette', name='Kestrel-class Corvette', faction='New Anglian Confederation',
       group='escort', mass=20, hull='weak', rows=4, thrust=6, ftl=False,
       weapons=[('beam',1,ALL6), ('pulse-torpedo-short',1,['F'])],
       systems=[('firecon',1),('pds',1)]),
  dict(id='nac-frigate', name='Bellerophon-class Frigate', faction='New Anglian Confederation',
       group='escort', mass=28, hull='weak', rows=4, thrust=6, screens=1,
       weapons=[('beam',2,F3), ('beam',1,ALL6)], systems=[('firecon',1),('pds',1)]),
  dict(id='nac-destroyer', name='Ranger-class Destroyer', faction='New Anglian Confederation',
       group='escort', mass=42, hull='average', rows=4, thrust=6, screens=1,
       weapons=[('beam',2,F3), ('beam',2,A3), ('pulse-torpedo-short',1,['F'])],
       systems=[('firecon',2),('pds',2)], marines=1),
  dict(id='nac-light-cruiser', name='Huron-class Light Cruiser', faction='New Anglian Confederation',
       group='cruiser', mass=62, hull='average', rows=4, thrust=4, armour=[2], screens=1,
       weapons=[('beam',3,F3), ('beam',2,P3), ('beam',2,S3), ('pulse-torpedo',1,F3)],
       systems=[('firecon',2),('pds',2),('adfc',1)], marines=2),
  dict(id='nac-heavy-cruiser', name='Victoria-class Heavy Cruiser', faction='New Anglian Confederation',
       group='cruiser', mass=92, hull='average', rows=4, thrust=4, armour=[3], screens=2,
       weapons=[('beam',3,F3), ('beam',3,A3), ('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6),
                ('pulse-torpedo',1,F3)],
       systems=[('firecon',2),('pds',3),('adfc',1)], marines=2),
  dict(id='nac-battlecruiser', name='Valley Forge-class Battlecruiser', faction='New Anglian Confederation',
       group='capital', mass=128, hull='average', rows=4, thrust=4, armour=[4], screens=2,
       weapons=[('beam',4,F3), ('beam',3,A3), ('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6),
                ('pulse-torpedo',1,F3)],
       systems=[('firecon',3),('pds',4),('adfc',1),('ecm',1)], marines=3),
  dict(id='nac-battleship', name='Excalibur-class Battleship', faction='New Anglian Confederation',
       group='capital', mass=176, hull='average', rows=4, thrust=3, armour=[6,2], screens=2,
       weapons=[('beam',4,F3), ('beam',4,A3), ('beam',3,P3), ('beam',3,S3), ('beam',1,ALL6),
                ('pulse-torpedo-long',1,F3)],
       systems=[('firecon',3),('pds',5),('advanced-adfc',1),('ecm',1)], marines=4),
  dict(id='nac-carrier', name='Ark Royal-class Fleet Carrier', faction='New Anglian Confederation',
       group='capital', mass=150, hull='average', rows=4, thrust=4, armour=[3], screens=2,
       weapons=[('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6)],
       systems=[('firecon',2),('pds',4),('advanced-adfc',1),('hangar-bay',3),('launch-tube',3)],
       marines=2, bays=3),
  dict(id='nac-tender', name='Cook-class Gunboat Tender', faction='New Anglian Confederation',
       group='capital', mass=132, hull='average', rows=4, thrust=4, armour=[3], screens=2,
       weapons=[('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6)],
       systems=[('firecon',2),('pds',4),('adfc',1),('gunboat-rack',2),('gunboat-bay',1)],
       marines=2, racks=2, gunboatType='graser'),

  # ── Cygnan Assembly ──────────────────────────────────────────────────────
  # Gravity and fields, never projectiles: nothing that leaves a Cygnan hull
  # has mass, and the gravitic table stops at class 3, so weight of fire is
  # made of arcs rather than of calibre. Advanced drives and advanced screens
  # on thin hulls, and no emergency thrust to fall back on (their own
  # prohibition), so the printed thrust rating is the whole of the manoeuvre.
  # The holofield is 10% of the hull it hides, which is why only the two ships
  # big enough to carry one do.
  dict(id='cygnan-picket', name='Parallax-class Picket', faction='Cygnan Assembly',
       group='escort', mass=22, hull='weak', rows=4, thrust=8, advDrive=True, ftl=False,
       screens=1, advScreens=True,
       weapons=[('gravitic-gun',2,F3), ('gravitic-gun',1,ALL6)],
       systems=[('firecon',1),('pds',2),('ecm',1)]),
  dict(id='cygnan-destroyer', name='Penumbra-class Destroyer', faction='Cygnan Assembly',
       group='escort', mass=32, hull='weak', rows=4, thrust=6, advDrive=True,
       screens=1, advScreens=True,
       weapons=[('gravitic-gun',2,F3), ('gravitic-gun',2,A3), ('gravitic-gun',1,ALL6)],
       systems=[('firecon',2),('pds',2),('ecm',1)], marines=1),
  dict(id='cygnan-cruiser', name='Libration-class Cruiser', faction='Cygnan Assembly',
       group='cruiser', mass=76, hull='weak', rows=4, thrust=6, advDrive=True,
       screens=2, advScreens=True,
       weapons=[('gravitic-gun',3,F3), ('gravitic-gun',2,P3), ('gravitic-gun',2,S3),
                ('gravitic-gun',1,ALL6)],
       systems=[('firecon',2),('pds',3),('ecm',1),('adfc',1)], marines=2),
  # The first hull with a holofield: 7.19 puts 12 MU on every range measured
  # against it, which is what "Holographic Superiority" is written around.
  dict(id='cygnan-command-cruiser', name='Analemma-class Command Cruiser',
       faction='Cygnan Assembly',
       group='cruiser', mass=86, hull='weak', rows=4, thrust=6, advDrive=True,
       screens=1, advScreens=True,
       weapons=[('gravitic-gun',3,F3), ('gravitic-gun',2,P3), ('gravitic-gun',2,S3)],
       systems=[('advanced-firecon',2),('pds',3),('area-ecm',1),('advanced-adfc',1),
                ('holofield',1)], marines=2),
  dict(id='cygnan-battleship', name='Syzygy-class Battleship', faction='Cygnan Assembly',
       group='capital', mass=188, hull='weak', rows=4, thrust=6, advDrive=True,
       screens=2, advScreens=True,
       weapons=[('gravitic-gun',3,F3), ('gravitic-gun',3,A3), ('gravitic-gun',2,P3),
                ('gravitic-gun',2,S3), ('gravitic-gun',1,ALL6)],
       systems=[('advanced-firecon',3),('pds',4),('area-ecm',1),('advanced-adfc',1),
                ('holofield',1)], marines=3),

  # ── Silent Sisterhood of Veil ────────────────────────────────────────────
  # Thin, fast hulls carrying needle beams and a Tuffley cloak, and nothing
  # else. The fleet shoots at FireCons, drives and sensors rather than at hull
  # boxes, and buys a FireCon for every mount it wants pointed at a different
  # ship (5.13). No screens anywhere, which is not doctrine but 7.20: a cloak
  # may not be combined with any fields or screens. Nothing over mass 110 and
  # nothing but weak hulls, because their own traits forbid both.
  dict(id='sisterhood-picket', name='Anchorite-class Picket',
       faction='Silent Sisterhood of Veil',
       group='escort', mass=26, hull='weak', rows=4, thrust=8, advFtl=True,
       weapons=[('needle-beam',1,F3)],
       systems=[('firecon',1),('pds',1),('tuffley-cloak',1)]),
  dict(id='sisterhood-frigate', name='Novice-class Frigate',
       faction='Silent Sisterhood of Veil',
       group='escort', mass=42, hull='weak', rows=4, thrust=8, advFtl=True,
       weapons=[('needle-beam',1,F3), ('needle-beam',1,A3)],
       systems=[('firecon',1),('pds',1),('tuffley-cloak',1)]),
  # Two FireCons, two mounts, two victims: a needle beam takes one system off
  # a ship and 5.13 makes each mount nominate its own, so the interesting
  # number on this hull is the FireCon count and not the gun count.
  dict(id='sisterhood-cruiser', name='Vespers-class Strike Cruiser',
       faction='Silent Sisterhood of Veil',
       group='cruiser', mass=60, hull='weak', rows=4, thrust=6, advFtl=True,
       weapons=[('needle-beam-2',2,F3), ('needle-beam',1,A3)],
       systems=[('firecon',2),('pds',2),('ecm',1),('enhanced-sensors',1),
                ('tuffley-cloak',1)], marines=1),
  dict(id='sisterhood-sensor-cruiser', name='Matins-class Sensor Cruiser',
       faction='Silent Sisterhood of Veil',
       group='cruiser', mass=58, hull='weak', rows=4, thrust=6, advFtl=True,
       weapons=[('needle-beam-2',2,F3)],
       systems=[('firecon',2),('pds',2),('ecm',1),('superior-sensors',1),
                ('tuffley-cloak',1)]),
  # Mass 110 is the ceiling the faction is allowed to build to; this stops
  # short of it so the cloak fits inside the limit rather than over it.
  dict(id='sisterhood-flagship', name='Abbess-class Command Ship',
       faction='Silent Sisterhood of Veil',
       group='capital', mass=100, hull='weak', rows=4, thrust=6, advFtl=True,
       weapons=[('needle-beam-3',3,F3), ('needle-beam',1,A3)],
       systems=[('firecon',3),('pds',3),('ecm',1),('superior-sensors',1),
                ('tuffley-cloak',1)], marines=2),

  # ── Izotrope Technocracy ─────────────────────────────────────────────────
  # A mobile power plant wrapped around a weapon: no projectile of any kind,
  # plasma and fusion out to knife range, and advanced screens where another
  # navy puts armour. Slow hulls, big for their guns, content to stand in the
  # fire while the batteries work.
  # System defence, so no FTL: thrust 6 and a level-1 advanced screen on a
  # 26-mass frame. The bow fusion array hits on 1+ inside 6 MU and ignores
  # standard screens (5.19); the six-arc Plasma-1 is for whatever gets behind
  # it. It has to close to do anything, and it is cheap enough to lose doing it.
  dict(id='izotrope-picket', name='Debye-class Picket', faction='Izotrope Technocracy',
       group='escort', mass=26, hull='average', rows=4, thrust=6, ftl=False,
       screens=1, advScreens=True,
       weapons=[('plasma-cannon',1,ALL6), ('fusion-array',1,['F'])],
       systems=[('firecon',1),('pds',2)]),
  # The screen the line hides behind on the approach. Plasma-2 forward reaches
  # 24 MU and doubles its dice inside 12; the fusion array is the pass itself.
  # Two PDS per escort is the fleet's whole answer to fighters and to bolts.
  dict(id='izotrope-escort', name='Larmor-class Escort', faction='Izotrope Technocracy',
       group='escort', mass=44, hull='average', rows=4, thrust=4, armour=[1],
       screens=1, advScreens=True,
       weapons=[('plasma-cannon',2,F3), ('plasma-cannon',1,ALL6), ('fusion-array',1,['F'])],
       systems=[('firecon',2),('pds',2)], marines=1),
  # The bolt cruiser. One PBL-2 fires every other turn, placing a 6 MU blast
  # anywhere within 30 MU and forward arc (6.8), which is the only reach the
  # fleet has; the plasma broadside is what it does on the turns the launcher
  # is down. Two screen levels, and no armour worth the name.
  dict(id='izotrope-cruiser', name='Corona-class Cruiser', faction='Izotrope Technocracy',
       group='cruiser', mass=68, hull='average', rows=4, thrust=4,
       screens=2, advScreens=True,
       weapons=[('plasma-cannon',2,F3), ('plasma-cannon',1,P3), ('plasma-cannon',1,S3),
                ('plasma-bolt-launcher',2,['F'])],
       systems=[('firecon',2),('pds',3)], marines=2),
  # Thrust 3 and a Plasma-3 in the bow: this one picks a heading and holds it.
  # Three dice at 12 MU, falling a die a band out to 36, with Plasma-2 on each
  # beam for whatever is abreast. The ADFC is for the squadron, not the ship —
  # it is what lets the cruisers cover each other's bolts and fighters.
  dict(id='izotrope-heavy-cruiser', name='Solenoid-class Heavy Cruiser', faction='Izotrope Technocracy',
       group='cruiser', mass=90, hull='average', rows=4, thrust=3, armour=[1],
       screens=2, advScreens=True,
       weapons=[('plasma-cannon-3',3,['F']), ('plasma-cannon',2,P3), ('plasma-cannon',2,S3),
                ('plasma-cannon',1,ALL6)],
       systems=[('firecon',2),('pds',3),('adfc',1)], marines=2),
  # Two levels of advanced screen and every arc covered. The Technocracy's own
  # "Efficient Power Distribution" trait would buy a third level, but 7.2 caps
  # screens at 2 and that trait is not one of the ones this engine reads yet —
  # so the ship is built to the rules in force rather than to the ones it
  # would like. Plasma-3 forward, Plasma-2 on the other faces, one PBL-3 for
  # the turn before contact.
  dict(id='izotrope-battleship', name='Tokamak-class Battleship', faction='Izotrope Technocracy',
       group='capital', mass=202, hull='average', rows=4, thrust=3,
       screens=2, advScreens=True,
       weapons=[('plasma-cannon-3',3,F3), ('plasma-cannon',2,A3), ('plasma-cannon',2,P3),
                ('plasma-cannon',2,S3), ('plasma-cannon',1,ALL6),
                ('plasma-bolt-launcher',3,['F'])],
       systems=[('firecon',3),('pds',5),('advanced-adfc',1)], marines=4),

  # ── Void-Corsairs of the Crimson Axis ────────────────────────────────────
  # EMP to knock the target's systems down, transporters and boarding torpedoes
  # to put marines aboard it, and nothing heavier than mass 110. No screens on
  # any hull: the mass goes into grapples and parties, and a prize burned is a
  # prize lost.
  # Thrust 6, one FireCon, everything forward: it fires all of it at one
  # target and then puts a torpedo into the same face.
  dict(id='void-corsairs-cutter', name='Marlinspike-class Boarding Cutter', faction='Void-Corsairs of the Crimson Axis',
       group='escort', mass=26, hull='weak', rows=4, thrust=6,
       weapons=[('emp',2,F3), ('beam',2,F3), ('boarding-torpedo',1,F3), ('transporter',1,ALL6)],
       systems=[('firecon',1),('pds',2)], marines=2),
  # EMP-3 forward is the hull's reason to exist; the second FireCon lets the
  # transporters work a different target from the one the EMP is blinding.
  dict(id='void-corsairs-raider', name='Gibbet-class Raider', faction='Void-Corsairs of the Crimson Axis',
       group='escort', mass=40, hull='weak', rows=4, thrust=6,
       weapons=[('emp',3,F3), ('boarding-torpedo',1,F3), ('transporter',2,F3), ('beam',1,ALL6)],
       systems=[('firecon',2),('pds',2),('scattergun',1)], marines=2),
  # Transporter-3 forward and boarding torpedoes fore and aft: it grapples
  # whichever way the prize turns, with a full five parties to spend. The
  # P3/S3 beams cover all six arcs between them and are for the escorts, not
  # for the prize. The boat bay carries the crew that sails the capture home.
  dict(id='void-corsairs-grapple-cruiser', name='Cutlass-class Grapple Cruiser', faction='Void-Corsairs of the Crimson Axis',
       group='cruiser', mass=82, hull='average', rows=4, thrust=5,
       weapons=[('emp',3,F3), ('transporter',3,F3), ('boarding-torpedo',1,F3), ('boarding-torpedo',1,A3),
                ('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6)],
       systems=[('firecon',2),('pds',3),('scattergun',1),('boat-bay',1)], marines=5),
  # The fleet's EMP battery: EMP-4 forward, EMP-2 astern for the pass after it
  # has gone through, and three FireCons so the two mounts and the transporter
  # can work different hulls. It softens prizes for the Cutlasses rather than
  # boarding much itself, and trades the fifth party for a repair crew.
  dict(id='void-corsairs-crippler', name='Hangman-class Crippler', faction='Void-Corsairs of the Crimson Axis',
       group='cruiser', mass=90, hull='average', rows=4, thrust=5,
       weapons=[('emp',4,F3), ('emp',2,A3), ('transporter',2,F3), ('boarding-torpedo',1,F3),
                ('beam',2,P3), ('beam',2,S3), ('beam',1,ALL6)],
       systems=[('firecon',3),('pds',3),('scattergun',1),('boat-bay',1)], marines=4, dcp=1),
  # The flagship, sitting exactly on the faction's mass 110 ceiling. Two bays
  # and two tubes so both shuttle wings go out in the same turn instead of one
  # a turn — twelve shuttles of parties, which standard screens do not stop.
  # Transporter-3 forward and Transporter-1 all round hold the prize while
  # they cross; the four PDS are for the enemy's shuttles doing the same.
  dict(id='void-corsairs-prize-taker', name='Red Ledger-class Prize-Taker', faction='Void-Corsairs of the Crimson Axis',
       group='capital', mass=110, hull='average', rows=4, thrust=4,
       weapons=[('emp',3,F3), ('transporter',3,F3), ('transporter',1,ALL6), ('boarding-torpedo',1,F3),
                ('beam',2,P3), ('beam',2,S3)],
       systems=[('firecon',3),('pds',4),('hangar-bay',2),('launch-tube',2)],
       marines=5, dcp=1, bays=2, fighterType='assault-shuttle'),
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
             f"  ftl: {ts(('advanced' if d.get('advFtl') else 'standard') if d.get('ftl', True) else 'none')},",
             f"  streamlining: {ts(d.get('stream') or 'none')},",
             f"  armour: {{ layers: {ts(d.get('armour', []))}, regenerative: {str(bool(d.get('regen'))).lower()} }},",
             f"  screens: {{ level: {d.get('screens', 0)}, generators: {d.get('screens', 0)}, advanced: {str(bool(d.get('advScreens'))).lower()} }},",
             "  weapons: [",
             *[f"    {ts(w)}," for w in r['weapons']],
             "  ],", "  turrets: [], ",
             "  systems: [",
             *[f"    {ts(s)}," for s in r['systems']],
             "  ],",
             f"  fighterBays: {ts([{'typeId': d.get('fighterType', 'standard'), 'label': f'Flight {i+1}'} for i in range(d.get('bays', 0))])},",
             f"  gunboats: {ts([{'typeId': d.get('gunboatType', 'beam'), 'label': f'Squadron {i+1}'} for i in range(d.get('racks', 0))])},",
             f"  additionalDamageControlParties: {d.get('dcp', 0)},",
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

# --- Emit the buyable catalogue --------------------------------------------
# The same tables the roster is priced from, as data the designer can offer.
cat = ["""/**
 * What a designer may buy (14).
 *
 * GENERATED by tools/build_roster.py from the same section 14 tables the
 * roster is priced from — do not hand-edit. Emitting both from one source is
 * the point: a designer offering a cost the roster does not charge is how a
 * fleet quietly becomes unfair.
 *
 * Only flat-cost entries are here. Hulls, drives, FTL, streamlining and
 * screens are fractions of total ship mass and belong to designPricing.ts,
 * which computes them (13.7 - 13.11).
 */

import type { Arc, SystemKind, WeaponClass, WeaponVariant } from '../engine/types'

export interface CatalogueWeapon {
  weaponClass: WeaponClass
  variant: WeaponVariant
  rating: number
  label: string
  /** Arc counts this mounting is sold in, and what each costs (14.4). */
  mountings: ReadonlyArray<{ arcs: number; mass: number; points: number }>
}

export interface CatalogueSystem {
  kind: SystemKind
  label: string
  mass: number
  points: number
}

/** Every arc, for a mounting sold at six. */
export const ALL_ARCS: readonly Arc[] = ['F', 'FS', 'AS', 'A', 'AP', 'FP']

export const CATALOGUE_WEAPONS: readonly CatalogueWeapon[] = ["""]

for wc, byrating in WEAPONS.items():
    base, variant = VARIANT.get(wc, (wc, 'standard'))
    for rating, byarcs in sorted(byrating.items()):
        mounts = ", ".join(
            "{ arcs: %d, mass: %s, points: %s }" % (a, m, pts)
            for a, (m, pts) in sorted(byarcs.items()))
        label = WEAPON_LABEL[wc].format(r=rating)
        cat.append(f"  {{ weaponClass: '{base}', variant: '{variant}', rating: {rating}, "
                   f"label: {json.dumps(label)}, mountings: [{mounts}] }},")
cat.append("]")
cat.append("")
cat.append("export const CATALOGUE_SYSTEMS: readonly CatalogueSystem[] = [")
for key, (m, pts) in sorted(SYSTEMS.items()):
    kind = KIND.get(key, key)
    cat.append(f"  {{ kind: '{kind}', label: {json.dumps(LABELS[key])}, mass: {m}, points: {pts} }},")
cat.append("]")
open('src/data/buildCatalog.ts', 'w').write("\n".join(cat) + "\n")
print(f"wrote src/data/buildCatalog.ts — {sum(len(v) for v in WEAPONS.values())} weapon families, {len(SYSTEMS)} systems")
