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


def recolour(el):
    """Map the sheet's print palette onto the app's theme, in place."""
    f = el.get('fill')
    if f is not None and f in FILL:
        el.set('fill', FILL[f])
    s = el.get('stroke')
    if s is not None and s in STROKE:
        el.set('stroke', STROKE[s])
    # SVG's default fill is black. A <text> with no fill is invisible ink on
    # paper and invisible full stop on a dark panel, so it is made explicit.
    if el.tag == NS + 'text' and el.get('fill') is None:
        el.set('fill', 'currentColor')
    for child in el:
        recolour(child)


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
        markup = ET.tostring(sym, encoding='unicode')
        out_parts.append(markup)

        entry = by_icon.get(sid)
        if entry is not None:
            vb = [float(v) for v in re.split(r'[,\s]+', sym.get('viewBox').strip())]
            icons.append(
                {
                    'id': new_id,
                    'label': tidy_label(entry['label']),
                    'section': entry['section'],
                    # Natural aspect, so a layout can give a wide symbol like
                    # "Core systems" (3:1) a wide box instead of squashing it.
                    'aspect': round(vb[2] / vb[3], 4) if vb[3] else 1.0,
                }
            )

    sprite = ''.join(out_parts)

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
