# The campaign layer — Stellar Imperium

The strategic game that sits above the tactical one. Source: the *Stellar Imperium* campaign
document, a hybrid of *Stellar Conquest*'s movement and exploration and *Full Thrust*'s resource
and espionage systems. Battles it generates are fought under the Continuum rules in `src/engine/`.

There are no victory points and no end date. A campaign is a story about a civilisation, refereed
by a GM who plays the non-player factions and arbitrates.

## Scale

| | |
| --- | --- |
| Tactical map | 1 MU = 1 cm = 10,000 km |
| Tactical time | 1 combat turn = 1 minute |
| Strategic map | 1 hex = 1 parsec |
| Strategic time | 1 turn ≈ 1 year |
| Production | every 4th turn |

## Economy

1 million population = 20 RP. Resource Points buy ships, facilities and research. One Full Thrust
point costs 1 RP, so the tactical points model *is* the strategic price list — which is why
`designPricing.priceDesign()` is the single source of truth for both.

Each player starts with a home system holding at least one habitable planet, 2,000 RP of naval
ships and 20 colony transports of a million colonists each.

### Price schedule

| Item | RP | Requires |
| --- | --- | --- |
| Starships | 1 per Full Thrust point | — |
| Colony transport | 50 | — |
| Scout drone | 150 | — |
| Factory | 2,000 | Industrial Technology |
| Planetary Defence Unit | 200 | PDU Tech |
| Advanced PDU | 500 | Adv. PDU Tech |
| Planet shield | 1,500 | Planet Shield Tech |

## Banned systems

The campaign bars three systems from ship design outright: **Reflex Shield**, **Cloaking Field**
and **Wave Gun**. `src/engine/ew.ts` exports these as individually toggleable so a campaign game
can switch them off without touching a design.

## Turn sequence

1. **FTL movement** — ships and task forces move, pre-plotted.
2. **Exploration** — explore new systems.
3. **Exploration risk** — resolve hazards.
4. **Discovery** — find planets, colonies, ships.
5. **Combat** — fight the tactical battles.
6. **Planetary** — assaults, sieges, landings.
7. **Admin** — record the turn.
8. **Production** — every 4th turn: growth, output, research.

### FTL movement (6.1)

Base FTL rate is 2 hexes a turn, raised by research to a maximum of 8. Movement is plotted from a
departure hex to a destination hex, and how many turns ahead you must plot depends on the
admiral's command level. Gas and dust clouds may only be entered from an adjacent hex and cost a
full turn per hex inside; exit is at normal speed.

Ships other than scouts may not move further than **8 hexes from a friendly command post**. Command
posts are free and may be established on any controlled colony; the home system has one from the
start.

Task forces carry one of three orders — **Engage**, **Stand Off** or **FTL Move** — and the pair of
orders decides what happens when hostile fleets meet:

| | Defender: Engage | Defender: Stand Off | Defender: FTL Move |
| --- | --- | --- | --- |
| **Intruder: Engage** | Even battle | Even battle | Pursuit battle |
| **Intruder: Stand Off** | Even battle | No battle | No battle |
| **Intruder: FTL Move** | Pursuit battle | No battle | No battle |

### System generation (6.2.1)

Roll d100 for a system feature, 1d6 for the number of planetary bodies (1–4 → 1 body, 5 → 2,
6 → 3), d100 per body for its type, and d100 per non-gas-giant for a trait.

**System features (d100)**

| Roll | Feature | Effect |
| --- | --- | --- |
| 01–60 | Standard | — |
| 61–75 | Gas/dust cloud (nebula) | FTL within the hex is 1 hex/turn; external discovery checks at −2 |
| 76–90 | Dense asteroid field | Exploration hazard rolls at −1; planet trait rolls at +20 |
| 91–00 | Binary/trinary star | Roll an additional 1d6 planetary bodies |

**Planet types (d100)**

| Roll | Type | Growth | Notes |
| --- | --- | --- | --- |
| 01–20, 92–100 | Terran | +1M per 5M | Roll a trait |
| 21–31 | Sub-Terran | +1M per 10M | Roll a trait |
| 32–42 | Minimal-Terran | none | Roll a trait |
| 43–56 | Barren | none | Needs C.E.T. to colonise; roll a trait |
| 57–89 | Gas giant | — | Cannot be colonised. 1d6−3 moons (min 0), each a new body |
| 90–91 | Special anomaly | — | GM narrates |

**Planet traits (d100, +20 in a dense asteroid field)**

| Roll | Trait | Effect |
| --- | --- | --- |
| 01–70 | None | — |
| 71–82 | Mineral rich | Doubles the colony's industrial output |
| 83–88 | Biologically rich | +1 research point per production phase |
| 89–94 | Hazardous | 500 RP stabilisation to colonise; then 1d20 each production phase, on a 1 a disaster destroys a factory |
| 95–98 | Ancient ruins | +1 tech point per production phase |
| 99–00 | Unique | GM narrates |

### Repair and replacement (6.3)

Expendables — missiles, fighters — are not replaced free; buy them again in a production phase.
System damage (weapons, drives) repairs itself between strategic turns if the ship fights no other
battle. **Hull, armour and core damage** needs the ship to end its move at a friendly colony with a
shipyard. Replacement fighters reach carriers by tender or freighter.

### Planetary phase (6.4)

A colony with an enemy warship in-system is **under siege**: it cannot build starships or act as a
command post, but still generates RP and can build defences. A captured colony produces nothing for
its new owner for one production phase, and its people become **Subject Population** — which costs
the owner 75% of the colony's industrial output and risks unrest (1d6 per 5M subject population
each admin phase; a 1 costs 1d6 × 100 RP and blocks building next phase). Converting them runs
100 RP per million through an Integration Program.

Ortillery in orbit removes 1 million population per battery per turn.

### Production phase (6.5)

Population grows (Terran +1M per 5M, Sub-Terran +1M per 10M, others not at all), then output is
50 RP per million population plus 50 RP per active factory, doubled on a mineral-rich world.
Research is the only expenditure that may be pooled across colonies.

## Admirals (7)

No captains — task forces are commanded by admirals, recruited for 100 RP with a command level
rolled on 1d6: a 1 gives Level 3 (inept), 2–5 Level 2 (average), 6 Level 1 (excellent).

| Level | In battle | Plotting |
| --- | --- | --- |
| 1 | +1 fleet initiative | plot 1 turn ahead |
| 2 | — | plot 2 turns ahead |
| 3 | −1 fleet initiative | plot 3 turns ahead |

Scouts always plot 1 turn ahead; anything without a named admiral plots as Level 3. If a flagship
dies or takes a bridge hit, roll 1d6 for the admiral: 1 dead, 2–3 injured for 1d6 turns, 4–6
unharmed.

## Research (8)

Paid in full in a single production phase from pooled RP. Technologies with a predecessor are
cheaper if you have it.

**Ship speed** — 3 hex 15 RP; 4 hex 40 (30 with 3); 5 hex 55 (40 with 4); 6 hex 65 (50 with 5);
7 hex 75 (60 with 6); 8 hex 80 (70 with 7).

**Weapons** — PDU 25 RP; Advanced PDU 55 (40 with PDU); Planet Shield 130.

**Technology** — Controlled Environment Technology 25 RP; Industrial Technology 25; Improved
Industrial 55 (40 with Industrial); Robotic Industry 100 (85 with Industrial).

Trading a technology costs the receiver 25% of its normal cost. Successful salvage halves it.

## Detection (8, end)

A voluntary 2d6 check against a task force within 4 hexes; 8+ succeeds and reveals what an 8 on the
spying roll would. A successful check against a cloaked ship uncloaks it for good.

| Modifier | Source |
| --- | --- |
| −1 per hex beyond the first | Distance |
| +1 / −1 | Level 1 / Level 3 admiral |
| +1 | Advanced sensors aboard |
| +2 | Superior sensors aboard |
| −2 | Every target ship has a stealth hull |
| −2 | Target is a cloaked ship staying cloaked |
| −2 | Target system is a nebula |

## Espionage (9)

Five ways in: a **drop pod** (50 RP, launched on 7+ on 2d6), a **cloaked ship** on station, an
**observation pass** (+3 plus the best sensor bonus), a **sleeper spy** (100 RP, +1), and taking
risks — each 1 on the discovery check gives +1 to the roll it supports.

**Counter-espionage** costs 200 RP a level and gives −1 to every discovery check in that system
that turn.

**Discovery check (2d6)** — 3 or less: observed, may be doubled. 4: observed, may be captured.
5: observed but escapes. 6+: not observed, the mission proceeds.

**Spying roll (2d6 + bonuses)** — 7 or less: nothing. 8: ship counts. 9: + hull categories and
station classes. 10: + hull masses and station damage. 11: + ship class designations. 12+: + ship
IDs and damage status.

**Sabotage** — after a clean discovery check, roll d6: 1–4 fails, 5 partly sabotages one random
system so it fails under combat stress, 6 destroys the ship (and the spy takes −3 thereafter).

## Shipyards

| First rating | Cost | Mass | | Second rating | Cost | Mass |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | 250 | 25 | | 25 | 250 | 50 |
| 30 | 500 | 150 | | 50 | 500 | 100 |
| 50 | 1,000 | 250 | | 100 | 1,000 | 200 |
| 70 | 2,000 | 350 | | 200 | 2,000 | 400 |
| 100 | 3,000 | 400 | | 300 | 3,000 | 500 |
| 125 | 3,750 | 500 | | 400 | 4,000 | 600 |

A yard processes its first rating in RP per turn, and its second rating is the largest hull it can
build. Yards are planetary or orbital; planetary yards may only build ships that can leave the
atmosphere, and a planetary base on a breathable world pays half the hull cost.
