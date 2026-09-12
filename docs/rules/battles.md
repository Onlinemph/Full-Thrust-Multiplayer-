# Battles, scenarios and CPV — section 18, and section 22

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, section 18 in full (18.1 – 18.3,
`continuum-rulebook-part2.txt` lines 2043–2125, pages 139–140) and section 22 (lines 2421–2435,
pages 149–151). Rules section 18 leans on and that are quoted here where they bite: 13.4 ship
classification by mass (lines 783–815, pages 106–107), 14.7 fighter costs (line 1617), 12.9
Striking the Colors, 10 repairs, 11.5 FTL entry.

Implementation: `src/engine/battles.ts`. Tests: `src/engine/battles.test.ts`.

Readings taken where the text genuinely admits more than one are marked **[reading]** with the
alternative that was rejected and why. There are fourteen, and two of them — the CPV formula and the
meaning of *"initial course limited to 11, 12, or 1"* — carry real weight, because in both cases
what the book printed did not survive into the text this repository can read.

---

## A note on the source text

Section 18 is set in two columns and, like section 17, the PDF extractor walked them
**interleaved**. Worse, on page 139 it merged the two columns word-run by word-run onto single
lines. The raw file reads, in order:

```
For a battle between offensive and defensive fleets,
Fleet composition the defending fleet deploys all its ships first anywhere
Battles can be made more interesting by restricting within their own half of the table. The defender can
the proportions of different ship classes as well as the also place a planet or similar terrain feature anywhere
overall point total. they desire.
For 'patrol' battles, restrict fleets to having no capital The attacking ships can either enter under main drive
ships at all and no more than 50% of the points spent at the opposite table edge, or (if permitted) some or
on cruisers. all may make an FTL entry.
```

Every quotation below is the **reconstructed** column, not the raw file order. Two columns
recovered from page 139:

**Left column:** 18.2 Tournament fleets → 18.1 Deployment → the deployment paragraphs → the
unnumbered *Fleet composition* subheading and its restrictions.

**Right column:** the "use terrain and scenarios" advice → the fleet-size paragraph and *"To
finish games faster"* → the offensive/defensive deployment → the scenarios URL.

The reconstruction is checkable: every merged line splits at exactly one point, and each half
completes a sentence in its own column and nowhere else. *"Forces of over 3000 points will
probably be too large unless plenty of time is"* + *"available."* is the clearest — the
continuation is stranded two chunks away in the other column.

**[reading] — *Fleet composition* is treated as part of 18.2, not 18.1.** In the printed column
order it follows 18.1's deployment paragraphs, because the two headings are laid out *out of
numeric order* (18.2 sits above 18.1 in the same column). The alternative was to file it under
18.1. It is filed under 18.2 because 18.2 is the section about what a fleet may contain and 18.1 is
the section about where it starts, and because 18.2's own subject — *"Ship designs for competitive
tournaments need to be controlled"* — is the same subject the composition restrictions serve.
Nothing mechanical turns on the choice; the rule numbers in the code cite `18.2 Fleet composition`
so a reader can find it either way.

---

## 18.1 Deployment

> "A conventional if uninspiring way to begin the battle is with fleets at opposite short ends of
> the table in a 'meeting engagement'."

> "Players alternate in placing one ship at a time within 6 MU of their table edge (or two to four
> ships at a time for large battles) with any desired course and an initial velocity."

> "Space does provide much more freedom of movement than a planetary surface, so there is no reason
> not to use other deployments. One likely scenario is two fleets heading for the same objective on
> converging courses."

> "Players deploy their ships along the opposing long edges of the table up to the half way mark,
> within 6 MU of the edge and initial course limited to 11, 12, or 1."

> "For a battle between offensive and defensive fleets, the defending fleet deploys all its ships
> first anywhere within their own half of the table. The defender can also place a planet or
> similar terrain feature anywhere they desire."

> "The attacking ships can either enter under main drive at the opposite table edge, or (if
> permitted) some or all may make an FTL entry."

### The three deployments, as printed

| | Meeting engagement | Converging approach | Offensive / defensive |
| --- | --- | --- | --- |
| Edges used | the two **short** ends | the two **long** edges | defender's own **half** |
| Zone depth | within 6 MU of the edge | within 6 MU of the edge | the whole half |
| Zone length | the whole edge | "up to the half way mark" | the whole half |
| Course | "any desired" | 11, 12 or 1 | any |
| Velocity | "an initial velocity" — no limit stated | not stated | not stated |
| Order | players alternate, 1 ship at a time (2–4 for large battles) | not stated | **defender places first, all of it** |
| Terrain | — | — | defender places a planet anywhere |
| Attacker | placed | placed | **enters** at the far edge under main drive, or by FTL if permitted |

The 6 MU is the only distance section 18 states, and it is stated once and reused: it is the depth
of the strip in both of the placed deployments.

### [reading] — "initial course limited to 11, 12, or 1" is measured from each fleet's own line of advance

Taken as absolute clock courses (12 = up the table, 3.1), the restriction is incoherent: the two
fleets are on *opposing* long edges, so a course of 12 carries one of them toward the enemy and
carries the other **straight off the table on turn one**. The rule cannot mean that, and the book
gives no per-side variation.

The engine therefore reads 11/12/1 as *straight ahead, plus or minus one clock point*, about an
axis each fleet's deployment fixes — for a long-edge deployment, the axis pointing across the table
at the opposing edge. The printed numbers come out unchanged for the fleet on the southern edge
(axis 12 → courses 11, 12, 1) and mirrored for the fleet on the northern edge (axis 6 → courses
5, 6, 7), which is what "opposing" has to mean.

The alternative rejected was literal absolute courses for both fleets. It was rejected because it
sends one fleet off-table before a shot is fired, and because 18.1's own framing of this
deployment — *"two fleets heading for the same objective on converging courses"* — requires both
fleets to be able to head somewhere.

### [reading] — "up to the half way mark" measures along the edge, not into the table

The same sentence already fixes the depth: *"within 6 MU of the edge"*. So the half-way mark is the
mid-point of the long **edge**, and the deployment strip runs half the edge's length. The
alternative — that ships may deploy up to the table's centre line, i.e. a strip half the table
deep — was rejected because it contradicts the 6 MU in the same clause.

Both fleets are placed in the **same** half of the table's length (the module's `half` option, and
both zones take the same value). Otherwise the strips are diagonally opposite and, on courses
within one point of straight across, the fleets pass behind one another rather than converge.

### [reading] — which edges are "long"

`width >= height` puts the long edges at the top and bottom of the map and the short ends at left
and right; otherwise the reverse. A square table falls into the first branch. The book does not
define the table at all, so this is a convention, and it is the one the rest of the repository
already uses when it writes a table as 72 × 48 for a 6′ × 4′ board.

### [reading] — the attacker's zone is the edge line, not a strip

*"Enter under main drive at the opposite table edge"* is an arrival, not a placement: the ship
crosses the edge during the Ship Movement Phase (phase 5). Its zone therefore has zero depth and is
marked `entry: 'table-edge'` rather than `'placed'`. FTL entry is *"(if permitted)"* — an explicit
permission, so it is a scenario switch, off by default, and when on the attacker's zone reports
`entry: 'ftl'` alongside. 11.5 owns what an FTL entry then does.

### What 18.1 does not say

**Who places first.** 18.1 says only that players alternate. The engine takes the sides in the order
the caller gives them and alternates from there; a scenario or an initiative roll can fix that order
outside this module. No die is rolled here, because section 18 does not roll one.

**Batch size.** *"Two to four ships at a time for large battles"* gives a range and no rule for
choosing within it, so the batch is a caller's parameter, clamped to 1–4.

---

## 18.2 Tournament fleets

> "Ship designs for competitive tournaments need to be controlled, for instance by restricting
> players to only designs given in the Full Thrust Fleet Books, with no modifications, changes in
> weapons, etc. (Players can of course use their own ship models even if they don't resemble the
> 'official' designs.) This should give a game where the tactics of play decide the victor, rather
> than who can stretch the design rules to the furthest limit!"

> "An even more limiting but quite useful idea is to actually give each player a fixed, identical
> force – that way you are really finding out who is the better tactician (or just luckiest with the
> dice). This method can be effectively used for 'enter on the day' competitions where players do
> not have to bring their own fleets along, but use one provided by the organizers."

Two controls, and the engine implements both as checks on a list rather than as restrictions on the
designer:

1. **A permitted-designs list.** Every hull in the fleet must appear on it, and none may be
   modified. The parenthesis about models is about miniatures, not about statistics, so it changes
   nothing in the engine.
2. **Identical forces.** Every player's list is the same multiset of designs. Note this is stronger
   than equal points and is checked as such.

### Fleet size

> "Fleets should be kept fairly small to allow games to be played to completion in a reasonable
> time. The ideal size is probably between 1000 and 1500 points in total, though fleets as small as
> 500 points can still be interesting. Forces of over 3000 points will probably be too large unless
> plenty of time is available."

> "To finish games faster, use the optional Striking the Colors rules (section 12) and/or disallow
> repairs to systems (section 10)."

| Total points | Band | The book's words |
| --- | --- | --- |
| < 500 | `below-minimum` | below *"as small as 500 points can still be interesting"* |
| 500 – 999 | `small` | *"as small as 500 points can still be interesting"* |
| 1000 – 1500 | `ideal` | *"The ideal size is probably between 1000 and 1500 points"* |
| 1501 – 3000 | `large` | above ideal, not yet *"too large"* |
| > 3000 | `too-large` | *"Forces of over 3000 points will probably be too large"* |

**[reading] — the endpoints are inclusive, except 3000.** *"As small as 500"* makes 500 itself
playable; *"between 1000 and 1500"* reads inclusively in English; *"over 3000"* is explicitly
exclusive, so a 3000-point fleet is `large` and 3001 is `too-large`. The alternative — exclusive
endpoints throughout — would make an exactly-500-point fleet fall below the floor the sentence was
written to establish.

Every band is **advice**. None of them is a violation: the report carries the band, and only the
composition restrictions can make a list illegal.

### Fleet composition

> "Battles can be made more interesting by restricting the proportions of different ship classes as
> well as the overall point total."

> "For 'patrol' battles, restrict fleets to having no capital ships at all and no more than 50% of
> the points spent on cruisers."

> "Allowing small carriers is optional but not recommended."

> "For larger battles, you can restrict fleets to no more than 50% of points spent on capitals,
> including their fighters; or require that each capital class ship must have one or two
> corresponding cruisers and escorts. Or you could decide that large 'fleet actions' can be fought
> entirely by capital class ships with no requirement to have smaller ships present. Either can be
> argued based on historical precedent or different science fiction settings, so feel free to
> experiment."

These are four alternative formats, not four cumulative rules — the text offers them with "or"
between them and closes with *"feel free to experiment"*. The engine models them as a `format`
the organiser picks:

| Format | Rule, as printed | Check |
| --- | --- | --- |
| `patrol` | *"no capital ships at all and no more than 50% of the points spent on cruisers"* | every capital is a violation; `2 × cruiser points <= total` |
| `large-battle` | *"no more than 50% of points spent on capitals, including their fighters"* | `2 × capital points <= total`, embarked flights counted with the hull |
| `capital-escorted` | *"each capital class ship must have one or two corresponding cruisers and escorts"* | `cruisers >= n × capitals` and `escorts >= n × capitals`, n = 1 or 2 |
| `fleet-action` | *"fought entirely by capital class ships with no requirement to have smaller ships present"* | nothing is a violation |
| `open` | no restriction stated | nothing is a violation |

The 50% tests are done in integers — `2 × classPoints <= total` — so a fleet at exactly half is
legal ("no more than 50%") and a fleet one point over is not, with no floating-point slack.

### Which class a hull is (13.4)

18.2 names three classes and defines none of them. 13.4 does:

> "Escorts have a maximum mass of 44; cruisers have a maximum mass of 90. Anything over mass 90 is
> a capital ship."

| Mass | Class |
| --- | --- |
| ≤ 44 | escort |
| 45 – 90 | cruiser |
| > 90 | capital |

The boundary a reader gets wrong is 90: a mass-90 heavy cruiser is a cruiser, and mass 91 is a
capital ship. 13.4's own class table has the CA running 60–90 and the BC 80–110, so the two overlap
across the cut and the *name* does not settle it — the mass does.

**[reading] — mass decides the class for composition limits, not the declared group.** 13.4 also
says *"most navies tend to classify ships by function rather than by tonnage"* and asks players, as
a courtesy, to say whether a ship is an escort, cruiser or capital. A tournament check cannot rest
on a label its subject supplies, and the mass sentence is unconditional, so mass wins. Where a
design's declared `group` disagrees with its mass, the report raises an **advisory** naming both —
the disagreement is worth seeing, and 13.4 permits it, so it is not a violation. The alternative,
trusting the declared group, was rejected because it lets a 120-mass hull enter a patrol battle by
calling itself a cruiser.

`ShipGroup` in the engine also carries `station`, `civilian` and `monster`, for which 18.2 has no
bucket at all. They are classified by mass like everything else, and the advisory fires.

**[reading] — a "small carrier" is a carrier that is not a capital ship.** The sentence sits inside
the patrol paragraph, and in a patrol battle capitals are already banned outright, so the carriers
the sentence can be about are exactly the ones the capital ban does not already exclude: mass 90 or
less. The alternative — reading "small" as escort-sized, mass 44 or less — was rejected because
13.4's smallest printed carrier class, the CVE, runs 60–140 mass, so an escort-sized carrier is not
a thing the book's own tables produce.

**[reading] — "optional but not recommended" is a switch, defaulted to the recommendation.** With
`allowSmallCarriers: false` (the default) a small carrier in a patrol battle is a violation; with
it true, it is an advisory that repeats the book's misgiving. Modelling it as advice only would let
a patrol list be declared legal while ignoring the one sentence written to discourage it;
modelling it as a flat ban would ignore *"optional"*. The switch is the only reading that keeps
both words.

**[reading] — what makes a hull a carrier: fighter groups, not gunboat racks.** 13.4's carrier
classes are fighter carriers (CVE, CVL, CVH, CVA), and 9.1 makes a gunboat rack an 18-mass
hull-mounted fitting that any warship can bolt on. So a destroyer with a rack is a destroyer. The
alternative — counting any embarked small craft — was rejected on that asymmetry.

**[reading] — the cruiser share counts embarked flights with the hull too.** *"Including their
fighters"* is printed only on the capital limit, but the two limits are the same sentence structure
one paragraph apart, and there is no reading on which a cruiser's fighters belong to nobody. The
alternative — counting fighters only against capitals — would make the patrol limit depend on where
a wing happens to be based.

**[reading] — "one or two corresponding cruisers and escorts" means n of each, n chosen by the
organiser.** The clause names both classes, so requiring one of *each* is the reading that gives
both nouns work, and "one or two" is the dial the organiser sets — which is why `consortsPerCapital`
is a parameter and not a constant. The alternative — n consorts drawn from either class — was
rejected because it makes "cruisers and escorts" mean "cruisers or escorts".

---

## 18.3 Combat Points Value (CPV)

> "Experience has shown that the Full Thrust points system does not fully reflect the advantages of
> increasing ship size: One larger ship will usually defeat two ships each costing half as much,
> even though the combined points of the two sides are equal. The Combat Points Value, CPV, is a
> more complex method of calculating the point value for each ship that gives more equally matched
> battles when ships of different classes are mixed together."

> "CPV will tend to shift the 'balance of power' to small ships however and make big capital ships
> even rarer on the field. The classic 'Corvette Swarm' becomes even more dangerous when using CPV."

> "The simple CPV calculation changes only the basic hull cost calculation (section 11.2). Instead
> of being equal to mass, the points cost for the hull becomes ⟨formula⟩. Round off to the nearest
> integer."

> "(If the ship has mass 7 or less the CPV calculation would give zero as the hull cost, but in Full
> Thrust everything must cost at least 1 point.)"

> "The effect of the simple CPV is that ships with mass below 100 become cheaper, over 100 more
> expensive."

> "The change to the point value can be calculated by subtracting the actual ship mass from the CPV
> hull value."

> "For example, the Suffren class light cruiser from Fleet Book 1 has mass 54 and a points cost of
> 181. Using the CPV calculation, the hull cost is ⟨formula⟩, a reduction of 25 points for a new
> total points cost of 156. On the other hand, an Excalibur class dreadnought has a mass of 140 and
> points cost of 472. Using the CPV, the hull cost is ⟨formula⟩, an increase of 56 for a new total
> points cost of 528."

> "The simple CPV given here is still unbalanced for some cases. A more elaborate method of CPV
> calculation is online at http://fullthrust.star-ranger.com"

### [reading] — the formula, which the text does not contain

Both ⟨formula⟩ marks above are set as images in the PDF, and images do not survive text extraction.
The formula is therefore *reconstructed*, and it is reconstructed rather than guessed because the
surrounding prose over-determines it. Four independent constraints:

| Constraint, as printed | Requires |
| --- | --- |
| Suffren: mass 54, *"a reduction of 25"* | hull cost 54 − 25 = **29** |
| Excalibur: mass 140, *"an increase of 56"* | hull cost 140 + 56 = **196** |
| *"below 100 become cheaper, over 100 more expensive"* | the curve crosses `cost = mass` at **100** |
| *"mass 7 or less … would give zero as the hull cost"* | rounds to 0 at 7 and to ≥ 1 at 8 |

```
CPV hull cost = round(mass² / 100)
```

satisfies all four, and exactly: 54²/100 = 29.16 → 29; 140²/100 = 196; 100²/100 = 100; 7²/100 =
0.49 → 0 while 8²/100 = 0.64 → 1. The third constraint is the strong one — it fixes the divisor at
100 given a square, and 7/8 fixes the rounding as nearest rather than floor or ceiling. The
alternative was to leave 18.3 unimplemented on the grounds that the equation is missing; that was
rejected because four printed facts agreeing to the digit is better evidence than most rules in
this book get.

*"Round off to the nearest integer"* is implemented as `floor(x + 0.5)`, matching
`designPricing.priceDesign`. The tie-break never actually bites: `mass²/100` lands on an exact half
only when `mass²` ends in 50, and no integer square does (squares ending in 5 end in 25).

Two consequences worth knowing before using CPV to balance a game:

- **The curve is nearly flat where most fleets meet.** A mass-99 hull is one point cheaper and a
  mass-101 hull one point dearer. CPV only bites at the ends of the mass range — a mass-50 cruiser
  loses 25 points, a mass-200 superdreadnought gains 200 — which is exactly what *"the classic
  'Corvette Swarm' becomes even more dangerous"* is warning about.
- **Mass 1 is unchanged**, not cheaper, because `round(0.01)` is 0 and the 1-point floor puts it
  back to 1 — which is what it cost anyway. Every other mass below 100 is cheaper, as printed.
  Nothing in 13.5 builds a mass-1 ship (*"the smallest possible FTL-capable ship"* is mass 3), so
  this is a boundary rather than a case.

### The worked examples

| Ship | Mass | Printed points | CPV hull cost | Change | CPV total |
| --- | --- | --- | --- | --- | --- |
| Suffren class light cruiser (Fleet Book 1) | 54 | 181 | 29 | −25 | **156** |
| Excalibur class dreadnought | 140 | 472 | 196 | +56 | **528** |

Both are reproduced exactly by the tests, which is the check on the reconstruction above.

### [reading] — how the change is applied to a Continuum design

18.3 says the substitution replaces a hull cost that is *"equal to mass"*, citing "section 11.2".
No section 11.2 of *Project Continuum* prices a hull — 11 is Faster Than Light — so the citation is
inherited from *Full Thrust* 2nd edition, where the hull did cost its mass in points. Continuum
prices a hull differently: 13.7 charges per **hull box**, at 3, 2, 1.5 or 1 points a box depending
on how many rows the track is split into. There is no quantity in a Continuum design equal to the
ship's mass to substitute for.

So the engine applies 18.3's own arithmetic instead of its substitution:

```
CPV total = printed points + (CPV hull cost − mass)
```

which is precisely *"the change to the point value can be calculated by subtracting the actual ship
mass from the CPV hull value"*, and precisely what both worked examples do — they start from the
Fleet Book's printed total and add the delta. The alternative was to substitute `round(mass²/100)`
for `hullBoxes × pointsPerBox`. It was rejected because it silently swallows 13.7's row-count
pricing (a 3-row hull costs three times a 6-row hull per box, and the substitution would erase that
difference), and because it does not reproduce the printed examples, which never mention hull boxes.

### CPV and the rest of a fleet

*"Changes only the basic hull cost calculation"* — so the adjustment is once per hull, and nothing
else in a fleet moves. Fighters, gunboat squadrons and other embarked craft have no hull cost to
substitute, so `cpvFleetPoints` adjusts each hull and leaves the flights at their printed price.

### Which points the 18.2 bands and shares are measured in

18.2 was written before 18.3 and says only *"points"*. The engine keeps them orthogonal: pass a
list priced however the game is priced. If CPV is in use, run `applyCpv` first and hand the result
to `checkFleetComposition` — that is a two-line pipeline in the caller and keeps this module from
deciding a question the book does not ask.

---

## 22 Introductory Scenario player fleet

Section 22 is three pages and, in the text this repository can read, it is **entirely images**:

```
2421: 22 Introductory Scenario player fleet
2423: 149
2427: Introductory Scenario counters for Eurasian Solar Union
2429: 150
2433: Introductory Scenario counters New Anglian Confederation
2435: 151
```

The page numbers are the printed footers, which fall after the heading of the page they belong to,
so the section heading is on 149 and each counter sheet on the page whose footer follows it.

What section 22 therefore states, and all it states, is that the Introductory Scenario's player
fleet is supplied as two counter sheets, one per side, and which two navies those sides are: the
**Eurasian Solar Union** and the **New Anglian Confederation**, in that order. That is exported as
`INTRODUCTORY_FLEET_COUNTER_SHEETS`.

The ships on those counters are **not** in section 22 and are not in this source half at all. The
force list — two heavy cruisers and three frigates a side, with alternating deployment and the
victory ladder — is stated in 4.12, on page 33, which lives in `continuum-rulebook-extract.txt`.
It is already encoded, from that source, as `INTRODUCTORY_SCENARIO` in `src/data/scenarios.ts` and
`INTRODUCTORY_VICTORY` beside it. This module does not restate it: one force list in two places is
one force list too many, and 4.12 is not this module's section.

The one thing 18.1 adds to it is that 4.12's alternating set-up is the same procedure 18.1
generalises — *"Players alternate in placing one ship at a time"* — so `placementOrder` serves
both.

---

## Not implemented, and why

| Rule | Why |
| --- | --- |
| **Placing the defender's planet** (18.1) | *"The defender can also place a planet or similar terrain feature anywhere they desire."* The zone this module returns says the whole defender's half is available; the planet itself is `terrain.ts`'s object and a scenario's decision, and nothing here should be inventing a radius for it. |
| **The attacker's FTL entry** (18.1) | Reported as `entry: 'ftl'` on the zone when the scenario permits it. What an FTL entry *does* — the turn it is declared for, the entry point, the course and velocity out of hyperspace — is 11.5, and `ftl.ts` owns it. |
| **"To finish games faster"** (18.2) | Striking the Colors is 12.9 and already implemented; *"disallow repairs to systems"* is a switch on 10.4's damage control. Both are settings on other modules, not rules of section 18, so this module names them and sets nothing. |
| **Turn limits** | Section 18 states none. 4.12's introductory scenario does, and `Scenario.turnLimit` carries it. |
| **"Use terrain and planets… and scenarios with objectives"** (18) | Advice. The objectives it recommends are the scenarios behind the Emerald Coast Skunkworks URL, which is not part of the rulebook. |
| **The elaborate CPV** (18.3) | *"A more elaborate method of CPV calculation is online at http://fullthrust.star-ranger.com"* — off-book, and not quoted anywhere in the source. Only the simple CPV is implemented, which is the one the section prints. |
| **Applying CPV to the roster** (18.3) | `cpvPoints` reports the adjusted value; nothing rewrites `ShipDesign.points`, because the design's printed cost is what the shipyard, the campaign economy and `victory.ts` all price against, and switching pricing systems under them is an integration decision, not a rule. |
| **The section 22 force list** | Not in this source half. See above. |
| **Modelling a ship as "modified"** (18.2) | `checkTournamentList` takes a `modified` flag per entry and a list of permitted design ids; it cannot *detect* a modification, because the engine has no notion of a design's provenance beyond `ShipDesign.provisional`. Whoever imports a fleet book knows which hulls came out of it. |

---

## Integration notes

- **Nothing here mutates and nothing here rolls a die.** Section 18 contains no dice at all: every
  function takes values and returns new values, in the shape `gunboats.ts` established. The tests
  still use `new Rng(seed)`, to shuffle fleet lists and prove the reports do not depend on the order
  ships arrive in.
- **Where each function belongs:**

  | When | Function |
  | --- | --- |
  | Fleet building, before a battle exists | `classifyByMass`, `breakdownFleet`, `fleetSizeBand`, `checkFleetComposition`, `checkTournamentList`, `identicalForces` |
  | Fleet building, if the game is priced in CPV | `cpvHullCost`, `cpvAdjustment`, `cpvPoints`, `applyCpv`, `cpvFleetPoints` — run before the composition check |
  | Set-up, before turn 1 | `meetingEngagementZones`, `convergingApproachZones`, `offensiveDefensiveZones`, `placementOrder`, `validatePlacement` |
  | Nowhere in the turn sequence | everything: section 18 happens before phase 1 and after the last phase |
- **The zones are advisory geometry, not enforcement.** `validatePlacement` reports; it does not
  refuse. `scenarios.ts` already writes final positions directly, which is a legal outcome of any of
  these deployments, so a scenario that hard-codes a line of ships is not in conflict with this
  module — it has simply already run the deployment.
- **`FleetShip` is deliberately not `ShipDesign`.** It carries the five things section 18 asks about
  — mass, points, embarked points, a declared group and whether the hull is a carrier — so that a
  campaign roster, a saved game's chosen force and a fleet-book import can all be checked without
  each one first building a full design. `fleetShipFromDesign` adapts a `ShipDesign` for the common
  case.
- **A carrier's wings have to be passed in.** `ShipDesign.points` does not include them. 13.12
  prices a hangar bay at *"3 per mass, and … six mass each"* — the 18 points on a bay is the empty
  hold and its re-arming gear — while 14.7 charges for the flight separately, 18 points for a
  standard wing and up to 42 for a graser wing. `fleetShipFromDesign` cannot compute it: the design
  names the fighter type in each bay, the price of that type lives in `fighters.ts`, and this
  module may not import it. So `embarkedPoints` defaults to 0 and the caller supplies it. Left at 0,
  a six-bay fleet carrier hides up to 252 points on the wrong side of 18.2's 50% line — which is
  precisely the accounting *"including their fighters"* was written to prevent.
