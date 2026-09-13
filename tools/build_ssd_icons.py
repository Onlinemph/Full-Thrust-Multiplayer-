#!/usr/bin/env python3
"""Turn the hand-made SSD symbol sheet into something the app can draw.

The sheet (`docs/ssd-icon-sheet.svg`) is a printed-SSD vocabulary: 176 labelled
`<symbol>` definitions covering every hull box, system, weapon and bay the rules
have a symbol for. It is drawn for paper — black line art on white, ~20 units of
stroke on a ~600-unit viewBox — and the app is dark, so nothing can be used as
it stands.

This emits two files:

  src/ui/ssd/sprite.generated.ts     every symbol, recoloured to CSS variables
                                     and trimmed, as one inline sprite
  src/ui/ssd/icons.generated.ts      the catalogue: semantic id -> label,
                                     section and natural aspect ratio

Both are generated. Edit the sheet and re-run; do not hand-edit the output.

Why inline rather than a `<use href="sprite.svg#id">` against a file: a
cross-document reference does not inherit `currentColor`, which is the whole
mechanism the recolouring below relies on. Inlined once at the root of the app
it costs 13 kB gzipped, because line art with repeated attributes is close to
the best case a compressor ever sees.
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

NS = '{http://www.w3.org/2000/svg}'
XLINK = '{http://www.w3.org/1999/xlink}'

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / 'docs' / 'ssd-icon-sheet.svg'
SPRITE_OUT = ROOT / 'src' / 'ui' / 'ssd' / 'sprite.generated.ts'
ICONS_OUT = ROOT / 'src' / 'ui' / 'ssd' / 'icons.generated.ts'

# ---------------------------------------------------------------------------
# Recolouring
# ---------------------------------------------------------------------------

# The sheet paints on paper: a white fill is the *hole* in a symbol, not white
# ink, so on a dark sheet it has to become the panel colour rather than
# disappear. Black is ink and becomes `currentColor`, which is what lets one
# symbol be drawn live, greyed out or struck through by CSS alone.
FILL = {
    'white': 'var(--ssd-paper)',
    '#FFFFFF': 'var(--ssd-paper)',
    '#ffffff': 'var(--ssd-paper)',
    'black': 'currentColor',
    '#000000': 'currentColor',
    '#808080': 'var(--ssd-dim)',
    # The one red fill in the sheet is Armour(regenerative, damaged) — a box
    # that will knit back. That is a meaning, not a decoration, so it keeps a
    # colour of its own.
    'red': 'var(--ssd-regen)',
}
STROKE = {
    'black': 'currentColor',
    '#000000': 'currentColor',
    '#303030': 'currentColor',
    'white': 'var(--ssd-paper)',
    '#FFFFFF': 'var(--ssd-paper)',
    '#ffffff': 'var(--ssd-paper)',
}


# Shapes whose default fill is black. SVG fills every one of these with black
# unless told otherwise, which on paper is ink and on a dark sheet is a black
# hole — and a surprising amount of the sheet relies on that default: the star
# in a crew box, the two lobes of a Point Defence System, the dot under a
# defensive screen.
INK_BY_DEFAULT = {'path', 'circle', 'rect', 'polygon', 'ellipse'}
# A polyline is a stroked squiggle. Filling one closes it across the ends,
# which is never what the drawing meant.
NEVER_FILLED = {'polyline', 'line'}


def recolour(el, inherited_fill=None):
    """Map the sheet's print palette onto the app's theme, in place."""
    f = el.get('fill')
    if f is not None and f in FILL:
        f = FILL[f]
        el.set('fill', f)
    s = el.get('stroke')
    if s is not None and s in STROKE:
        el.set('stroke', STROKE[s])

    tag = el.tag.replace(NS, '')
    effective = f if f is not None else inherited_fill
    if effective is None:
        if tag in INK_BY_DEFAULT:
            el.set('fill', 'currentColor')
            effective = 'currentColor'
        elif tag in NEVER_FILLED:
            el.set('fill', 'none')
            effective = 'none'
        # SVG's default fill is black. A <text> with no fill is invisible ink on
        # paper and invisible full stop on a dark panel, so it is made explicit.
        elif tag == 'text':
            el.set('fill', 'currentColor')
            effective = 'currentColor'

    for child in el:
        recolour(child, effective)


# ---------------------------------------------------------------------------
# Semantic ids
# ---------------------------------------------------------------------------

# The sheet numbers its symbols `icon_0` … `icon_175`, which says nothing at the
# call site. Every one carries a printed label, so the label becomes the id.
# Three labels on the sheet are typed as one word where they are two. The rules
# below reopen a seam between a lower-case and an upper-case letter, which
# cannot see these, so they are named rather than guessed at.
RUN_TOGETHER = {
    'Boardingtorpedo': 'Boarding torpedo',
    'Salvomissile': 'Salvo missile',
    'occupiedsample': 'occupied sample',
}


# Seven symbols print a number that is a *sample*, not part of the symbol: the
# sheet's Main Drive says 6 and its Cargo Hold says 1 because it had to say
# something. Every other number on the sheet — the 3 in a Class-3 Beam — is the
# symbol's own identity and must not be touched, which is why these are named
# rather than found by looking for digits.
VARIABLE_NUMBER = {
    'main-drive': 'thrust rating',
    'main-drive-advanced': 'thrust rating',
    'boat-bay': 'craft carried',
    'tender-bay': 'craft carried',
    'cargo-hold': 'mass carried',
    'passenger-berth': 'passengers carried',
    'troop-berth': 'troops carried',
}


# The sheet's Mine Layer references an id that nothing defines — four
# `<use href="#6e223869de347">` next to an unreferenced `_mineIndividual`
# symbol that is plainly what they meant. Repaired here rather than in the
# sheet so the sheet stays the artist's file; anything else dangling is a
# hard error, because a dangling reference draws nothing and says nothing.
REPAIRED_REFERENCES = {
    '6e223869de347': '_mineIndividual',
}


def repair_references(el):
    for node in el.iter():
        for attr in (XLINK + 'href', 'href'):
            ref = node.get(attr)
            if ref is not None and ref.startswith('#') and ref[1:] in REPAIRED_REFERENCES:
                node.set(attr, '#' + REPAIRED_REFERENCES[ref[1:]])


# Symbols whose printed digit is the weapon's class. The digit stays — it is
# the symbol's own identity — but its position is recorded so a rating the
# sheet does not print (a Beam-5, a PBL-6) can be drawn over it rather than
# drawn as the nearest class the sheet has, which would state a number of
# dice the gun does not roll.
CLASS_LABEL = re.compile(r'^Class (\d)')


def number_slot(sym, semantic_id, label):
    """Where a symbol's sample number sits, so the app can print the real one.

    The sample itself is marked `ssd-sample` and hidden by CSS. Coordinates are
    in the symbol's own viewBox, so drawing over it means nesting an <svg> with
    the same viewBox rather than working out the scale by hand.
    """
    klass = CLASS_LABEL.match(label)
    if semantic_id not in VARIABLE_NUMBER and klass is None:
        return None
    for el in sym.iter(NS + 'text'):
        text = ''.join(el.itertext()).strip()
        if not text.isdigit():
            continue
        if klass is not None and text != klass.group(1):
            continue
        slot = {
            'x': float(el.get('x', 0)),
            'y': float(el.get('y', 0)),
            'size': float(el.get('font-size', 100)),
            # A digit drawn as a hole in a filled disc (the grasers, the
            # phasers) has to be replaced by a hole, not by ink.
            'ink': el.get('fill') != 'var(--ssd-paper)',
        }
        if klass is not None:
            el.set('class', 'ssd-digit')
            slot['means'] = 'class'
        else:
            el.set('class', 'ssd-sample')
            slot['means'] = VARIABLE_NUMBER[semantic_id]
            if semantic_id in CENTRE_ON_OUTLINE:
                centre = polygon_centroid(sym)
                if centre is not None:
                    slot['x'], slot['y'] = centre
        return slot
    return None


# The sheet prints the drive's thrust a little low in the pentagon. Asked for
# in the centre, so it is put at the outline's own centroid, which is where the
# eye reads the middle of a house-shaped box to be.
CENTRE_ON_OUTLINE = {'main-drive', 'main-drive-advanced'}


def polygon_centroid(sym):
    """Area centroid of the symbol's first polygon, or None."""
    poly = sym.find(NS + 'polygon')
    if poly is None:
        return None
    pts = [float(v) for v in re.split(r'[\s,]+', poly.get('points', '').strip()) if v]
    xy = list(zip(pts[0::2], pts[1::2]))
    if len(xy) < 3:
        return None
    area = 0.0
    cx = 0.0
    cy = 0.0
    for (x0, y0), (x1, y1) in zip(xy, xy[1:] + xy[:1]):
        cross = x0 * y1 - x1 * y0
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(area) < 1e-9:
        return None
    area *= 0.5
    return (round(cx / (6 * area), 2), round(cy / (6 * area), 2))


def slug(label: str) -> str:
    # The labels arrive with the sheet's own line breaks stripped out, so
    # "Class 1Graser" and "Hangar Bay —Interceptor" need the seams reopened
    # before they can be read as words.
    s = label
    for wrong, right in RUN_TOGETHER.items():
        s = s.replace(wrong, right)
    s = s.replace('—', ' ').replace('–', ' ').replace('-', ' ')
    # An acronym running into a word: "EMPProjector" is EMP + Projector, and
    # the lower-to-upper rule below cannot see the seam because both sides of
    # it are capitals.
    s = re.sub(r'(?<=[A-Z])(?=[A-Z][a-z])', ' ', s)
    s = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', s)
    s = re.sub(r'(?<=[A-Za-z])(?=\d)', ' ', s)
    s = re.sub(r'(?<=\d)(?=[A-Za-z])', ' ', s)
    s = s.replace('(', ' ').replace(')', ' ').replace(',', ' ').replace('/', ' ')
    s = re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-').lower()
    return s


def tidy_label(label: str) -> str:
    """The printed label with the sheet's line-break seams reopened."""
    s = label
    for wrong, right in RUN_TOGETHER.items():
        s = s.replace(wrong, right)
    s = re.sub(r'(?<=[A-Z])(?=[A-Z][a-z])', ' ', s)
    s = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', s)
    s = s.replace('(', ' (').replace(',', ', ').replace(' -', ' \u2014 ')
    return re.sub(r'\s+', ' ', s).replace('( ', '(').strip()


def main() -> int:
    if not SHEET.exists():
        print(f'missing {SHEET}', file=sys.stderr)
        return 1

    tree = ET.parse(SHEET)
    root = tree.getroot()

    # --- the catalogue: the sheet lays itself out as section header, then
    # --- alternating icon and label, so it reads straight off in order.
    def text_of(e):
        return ' '.join(''.join(e.itertext()).split())

    catalogue = []
    section = None
    pending = None
    for child in root:
        tag = child.tag.replace(NS, '')
        if tag == 'text' and (child.get('class') or '') == 'futureFont':
            section = text_of(child)
        elif tag == 'use':
            pending = (child.get(XLINK + 'href') or child.get('href') or '').lstrip('#')
        elif tag == 'text' and pending is not None:
            catalogue.append({'icon': pending, 'label': text_of(child), 'section': section})
            pending = None

    by_icon = {c['icon']: c for c in catalogue}

    # --- the symbols themselves, including the internal ones the labelled
    # --- symbols reference through nested <use>.
    symbols = [s for s in root.iter(NS + 'symbol')]

    # A semantic id per labelled symbol; the internal helpers keep their own
    # names, since nothing outside the sprite refers to them.
    rename = {}
    used_slugs = {}
    for sym in symbols:
        sid = sym.get('id')
        entry = by_icon.get(sid)
        if entry is None:
            continue
        base = slug(entry['label'])
        n = used_slugs.get(base, 0)
        used_slugs[base] = n + 1
        rename[sid] = base if n == 0 else f'{base}-{n + 1}'

    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')

    out_parts = []
    icons = []
    seen_ids = set()
    for sym in symbols:
        sid = sym.get('id')
        if sid in seen_ids:
            # The sheet repeats a few internal helpers verbatim; one copy is
            # enough and a duplicate id would make the reference ambiguous.
            continue
        seen_ids.add(sid)
        new_id = rename.get(sid, sid)
        sym.set('id', f'ssd-{new_id}' if sid in rename else sid)
        recolour(sym)
        repair_references(sym)
        entry_for_slot = by_icon.get(sid)
        slot = number_slot(sym, new_id, entry_for_slot['label'] if entry_for_slot else '')
        markup = ET.tostring(sym, encoding='unicode')
        out_parts.append(markup)

        entry = by_icon.get(sid)
        if entry is not None:
            raw_vb = sym.get('viewBox').strip()
            vb = [float(v) for v in re.split(r'[,\s]+', raw_vb)]
            icon = {
                'id': new_id,
                'label': tidy_label(entry['label']),
                'section': entry['section'],
                # Natural aspect, so a layout can give a wide symbol like
                # "Core systems" (3:1) a wide box instead of squashing it.
                'aspect': round(vb[2] / vb[3], 4) if vb[3] else 1.0,
                # Carried through so the app can nest an <svg> in the symbol's
                # own coordinates and draw on top of it.
                'viewBox': ' '.join(str(round(v, 2)) for v in vb),
            }
            if slot is not None:
                icon['numberSlot'] = slot
            icons.append(icon)

    sprite = ''.join(out_parts)

    defined = set(re.findall(r'id="([^"]+)"', sprite))
    dangling = sorted(set(re.findall(r'href="#([^"]+)"', sprite)) - defined)
    if dangling:
        print(f'dangling references in the sprite: {dangling}', file=sys.stderr)
        return 1

    # Print-shop noise the browser does not need: a miter limit that is already
    # the default, and coordinates carried to twelve decimal places.
    sprite = sprite.replace(' stroke-miterlimit="10"', '')
    sprite = re.sub(r'(\d+\.\d{2})\d+', r'\1', sprite)
    sprite = re.sub(r'\s+', ' ', sprite)
    sprite = sprite.replace('> <', '><')

    banner = (
        '/* GENERATED by tools/build_ssd_icons.py from docs/ssd-icon-sheet.svg.\n'
        ' * Do not hand-edit: edit the sheet and re-run the tool. */\n\n'
    )

    SPRITE_OUT.parent.mkdir(parents=True, exist_ok=True)
    SPRITE_OUT.write_text(
        banner
        + '/**\n'
        + ' * Every symbol on the sheet, recoloured for a dark sheet.\n'
        + ' *\n'
        + ' * Inlined once at the root of the app so that `currentColor` resolves against\n'
        + ' * whatever is drawing the symbol — which is how one definition renders live,\n'
        + ' * greyed out or struck through without a second copy.\n'
        + ' */\n'
        + 'export const SSD_SPRITE = '
        + json.dumps(sprite)
        + '\n'
    )

    ICONS_OUT.write_text(
        banner
        + 'export interface SsdIcon {\n'
        + '  /** Symbol id in the sprite, without the `ssd-` prefix. */\n'
        + '  id: string\n'
        + "  /** The sheet's own printed label. */\n"
        + '  label: string\n'
        + '  section: string\n'
        + '  /** Width over height of the symbol as drawn. */\n'
        + '  aspect: number\n'
        + "  /** The symbol's own coordinate system, for drawing on top of it. */\n"
        + '  viewBox: string\n'
        + '  /**\n'
        + '   * Where a number sits inside the symbol. For the seven symbols whose\n'
        + '   * number is the ship\'s rather than the symbol\'s (`means` names it) the\n'
        + '   * sample is marked `ssd-sample` and always hidden. For the classed\n'
        + '   * weapons (`means: "class"`) the printed digit is marked `ssd-digit` and\n'
        + '   * stays unless a value is drawn over it. `ink` says whether the digit is\n'
        + '   * ink on paper or a hole in a filled disc.\n'
        + '   */\n'
        + '  numberSlot?: { x: number; y: number; size: number; means: string; ink: boolean }\n'
        + '}\n\n'
        + 'export const SSD_ICONS: readonly SsdIcon[] = '
        + json.dumps(icons, indent=1, ensure_ascii=False)
        + '\n\n'
        + 'export const SSD_ICON_IDS: ReadonlySet<string> = new Set(SSD_ICONS.map((i) => i.id))\n'
    )

    print(f'wrote {SPRITE_OUT.relative_to(ROOT)} — {len(sprite)} bytes of sprite')
    print(f'wrote {ICONS_OUT.relative_to(ROOT)} — {len(icons)} icons')
    sections = {}
    for i in icons:
        sections[i['section']] = sections.get(i['section'], 0) + 1
    for k, v in sections.items():
        print(f'  {v:4}  {k}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
