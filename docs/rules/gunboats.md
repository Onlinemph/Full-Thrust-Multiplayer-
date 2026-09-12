# Gunboats — section 9

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, sections 9.1 and 9.2, quoted from
`continuum-rulebook-extract.txt` lines 2271–2340. Cross-references to section 8 (fighters), 4.5–4.7
(the beam table), 5.5 (Plasma Cannon), 5.6 (Grasers), 5.13 (Needle Beams) and 7.12–7.15 (point
defence) are named where section 9 delegates to them.

Implementation: `src/engine/gunboats.ts`. Tests: `src/engine/gunboats.test.ts`.

Readings taken where the text is silent are marked **[reading]** with the reason.

---

## What a gunboat is

> "In design and tactical use, they straddle the line between a very small ship, and a very large
> fighter."

That sentence is the whole design problem, and it is why gunboats are their own module rather than
a fighter type. They fly like fighters and they are shot at like ships, and the two halves pull in
opposite directions:

| | Fighter (8) | Gunboat (9) |
| --- | --- | --- |
| Group | 6 | 6 |
| Main move | 24 MU | **18 MU** |
| Secondary move | 12 MU | **9 MU** |
| Combat endurance | 6 | 6 |
| Attack range | 6 MU | **12 MU** |
| Anti-ship fire against it | 1D6 per weapon, a 6 kills one | **each HIT kills one, no damage roll** |
| A PDS against it | kills on 4–5, two on a 6 | **kills only on a 6** |

The two defensive rows invert: anti-ship guns are *better* against gunboats than against fighters
and point defence is *worse*. A rule copied from the wrong section is the likeliest way to get this
wrong, which is why the tests assert both directions.

---

## 9.1 The rules

**Carriage.** "Gunboats are carried on hull mounted racks, and are launched at the same time as
other ordnance/fighters." A rack is 18 mass and holds one squadron of six; "the cost of the rack is
included in the gunboat cost". A gunboat bay is 24 mass and costs 0 points.

**[reading]** The engine prices a rack at the squadron's points rather than at zero. 9.1's sentence
reads from the rack's side — buy gunboats, get the rack free — and if the rack were also free of
the squadron's cost a tender would field 162 points of gunboats for nothing. `tools/build_roster.py`
puts the six boats' points on the rack system, so a hull's CPV includes what it carries.

**Movement.** "Gunboats have a speed of 18 MU, and move like fighters. They can fly in escort of a
ship like fighters."

**[reading]** There is no half-move on the launch turn. 8.1 gives fighters one "representing time
lost for successive launches and/or to form up"; 9.1 says only that gunboats launch with the
fighters, and a hull-mounted rack has no tube to queue for.

**Endurance.** Six points. "This endurance is used to make attacks on enemy ships, fighters or
ordnance. It can also be used to make a secondary move of 9 MU." One point for the squadron's
attack — "All gunboats expend 1 combat endurance point to fire their main weapon" — and one for
a secondary move.

**Fire control.** "Gunboats mount slightly larger and more powerful fire control systems than those
on fighters, allowing them to engage targets up to 12 MU away. The entire gunboat squadron must all
target the same enemy ship. If the gunboat squadron is engaging enemy fighters or ordnance, it may
split its fire among eligible targets within range, just like fighters."

**When they attack.** "Gunboats then make their attacks in the Fighter Attack Phase (phase 10)" —
after point defence, with the fighters' attack runs.

**Being attacked.**

- Ship fire: "They may be engaged in the Point Defense Phase by any ship weapons or PDS in range.
  Direct Fire Anti-ship weapons may fire at gunboats normally, with each HIT destroying ONE gunboat.
  In the case of weapons that do multiple points of damage (Grasers or Pulse Torps for example) do
  not roll damage." So the caller counts *hits*, and `directFireKills` turns hits into dead boats.
- Point defence: "Gunboats are well armored against lighter PDS type weapons. PDS weapons engage
  gunboats like Plasma Bolts only scoring one hit on a 6."
- Scatterguns: "Scatterguns/Interceptor Pods cause 1 BD\* of hits" — one beam die read as kills,
  with the natural 6 re-rolling.
- Casualties: "To determine which gunboat(s) in a squadron are destroyed the owning player should
  roll randomly." This matters because a squadron may be mixed, and letting the owner choose would
  mean the cheap boats always died first.
- "Gunboats may also be attacked in The Ship's Fire Phase using the same rules as for fighters."

**Recovery.** "Gunboats cannot be refueled or rearmed in combat using their carrying rack. Gunboat-
carrying ships with a boat bay of sufficient size to recover the whole squadron may use that boat
bay to retrieve and rearm gunboats during combat." A tender with racks alone launches its squadrons
once and that is their war.

**Armament restrictions.** "Gunboats may only be armed with weapons and other technology your fleet
uses… a UNSC Gunboat could not mount a K-Gun." Enforced by whoever builds the fleet, not by the
engine, which has no tech-base model (section 15 is not in the extract).

**Mixed squadrons.** "You are not required to make all the gunboats in a squadron the same." Which
is why `GunboatSquadron.boats` is a list of types rather than a count.

**FTL gunboats.** They enter and leave under their own drive. "Like a ship the FTL Gunboat enters
with a speed between 1 and 10, and makes a half-move straight ahead. The FTL Gunboat can then use a
point of endurance to make a second move of 9 MU in any direction." And the price of the
miniaturised drive: "if they jump or arrive within 6 MU of a 'massive object', they are
automatically destroyed."

---

## 9.2 The types, as printed

| Type | Armament | Range | Points each |
| --- | --- | --- | --- |
| Beam | 2 class-1 beams, both at the same target | 12 MU | 9 |
| Plasma Gun | 1 Plasma-1 | 12 MU | 9 |
| Graser | 1 Graser-1 | 12 MU | 9 |
| Gatling | 6 BD\* to 6 MU, or 2 BD\* to 12 MU; or once as a PDS to 6 MU. Forward 30° only | 12 MU | 15 |
| Needle | 1 Needle Beam | 12 MU | 9 |
| Pulse Torpedo | one short-range launcher: 2+ to 4 MU, 3+ to 8 MU, 4+ to 12 MU | 12 MU | 12 |
| Submunition | two one-shot submunitions, 3 BD\* to 6 MU or 2 BD\* to 12 MU, ignoring screens | 12 MU | 12 |
| MKP | two one-shot MKP packs: one hit on 4+, two on a 6, 4 points AP each | 12 MU | 15 |
| K-Gun | one short-range K-2: 2+/3+/4+ by band, doubling on a following 1 or 2, AP | 12 MU | 12 |
| Missile | a salvo of **four** missiles, launched inside 12 MU in the Ordnance Launch Phase | 12 MU | 12 |
| Rocket | four rockets, 2+ to 6 MU and 3+ to 12 MU, all at one target | 12 MU | 12 |
| Point Defence | two PDS to 6 MU on separate targets; counts as carrying an ADFC | 6 MU | 9 |
| Area Defence System | one array: a die to 12 MU or two to 6 MU; counts as carrying an ADFC | 12 MU | 12 |
| Scatterpack | two one-shot Scatterpacks, separately targetable; in-built ADFC | 12 MU | 15 |
| Plasma Bomber | two one-shot class-1 Plasma Bombs, *dropped* where it stands | — | 15 |

The Plasma Bomber is the odd one: 9.2 says the bombs "are not launched, they are dropped in the
current location of the gunboat, which then must move away to escape destruction when they
explode", so it is the only gunboat whose weapon threatens the gunboat.

| Modification | Effect | Points per squadron |
| --- | --- | --- |
| FTL (+mod) | Enters and leaves under its own FTL; cannot be carried in racks | +6 |
| Heavy or Screened (+mod) | "All weapons fire against the gunboat has a -1 DRM" | +12 |
| Electronic Warfare (+mod) | Each level of ECM takes 1 MU off missile and fighter lock-on, three levels at most | +3 a boat a level (+18 a squadron) |

Every cost is printed twice — "3 per mass (9 points each)" — which fixes a gunboat at mass 3, and
the arithmetic holds for all five entries.

A gunboat's guns are ship guns: 9.1 says "the weapons in use on ships by the building empire may be
modified to fit onto gunboat hulls", so a Graser Gunboat's shot goes through the same Graser-1
resolver a cruiser's does, via the weapon registry. Only the Gatling Gunboat has a profile of its
own, because 9.2 gives it two range bands where 5.10 gives the ship battery one.

---

## Not implemented, and why

| Rule | Why |
| --- | --- |
| Firing the one-shot loads | The submunition, MKP, scatterpack, rocket, plasma-bomb and four-missile payloads are catalogued and priced, and their shot counts are modelled, but each is fired in a phase of its own (the Ordnance Launch Phase for four of them) and none is wired into that phase yet. The squadron's guns resolve; its stores do not. |
| The Plasma Bomber's own danger | 9.2 has it drop bombs where it stands "which then must move away to escape destruction". Nothing models a gunboat being caught by its own bomb. |
| Escorting a ship ("They can fly in escort of a ship like fighters") | The squadron carries no mission field: 8.6's screening and pursuit rules are implemented for fighters, and extending them to gunboats needs the same escort plumbing on this side. |
| Splitting fire between several fighter or ordnance targets | 9.1 allows it "just like fighters"; the engine resolves a squadron's attack against one target at a time. Against ships — the common case — the book forbids splitting anyway. |
| The Gatling Gunboat's forward 30° arc | 4.2's arcs are 60° wide, so a 30° arc has no representation in the geometry. The engine treats it as the forward arc, which is the narrowest it can express, and this is recorded here rather than silently widened. |
| Tech-base restrictions on armament | Section 15, which is not in the extract. |
| FTL arrival and departure as a game action | Section 11 (FTL) is not implemented for ships either; `ftlTransitDestroys` implements the distortion rule so it is ready when FTL is. |
