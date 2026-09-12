# Boarding, morale, surrender and civil wars (12.7 – 12.10)

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, sections 12.7, 12.8, 12.9 and 12.10,
quoted from `continuum-rulebook-part2.txt` lines 521–595 (pages 96–99), plus the boarding combat
box and the turn sequence on the Quick Reference Sheet, lines 2451–2455 and 2583–2591 (pages
152–154). Cross-references to 5.9 (Transporter Beams and the Commando Raid), 5.18 (Boarding
Torpedoes), 8.15 (assault shuttles), 4.11 (threshold points), 10.4 (damage control) and 13.13
(what a Marine costs and how it sits on the SSD) are named where these four sections delegate to
them.

Implementation: `src/engine/boarding.ts`. Tests: `src/engine/boarding.test.ts`.

Rules marked **[reading]** are places where the text admits more than one reading and the engine
has had to choose. Each says which way it went, why, and what the alternative was.

---

## What this module is, and is not

The engine already **lands** boarding parties. Transporter Beams (5.9), Boarding Torpedoes (5.18)
and assault shuttles (8.15) put entries into a ship's `boarders` list; everything below is what
happens to them afterwards, in phase 12.

The exclusion in 12.7's second paragraph is load-bearing:

> "Marines delivered to a ship via Transporter Beams that are attacking a system icon on the
> ship's SSD do not use the combat procedure in this section; they use the Commando Raid
> procedure in section 5.9 instead."

A Commando Raid is a single 1D6 on the Transporter Raid table — nothing happens on a 1, the
Marines die on a 2–3, and so on — and it is resolved in `weapons/beams.ts` where the transporter
lives. It never reaches this module. What reaches this module is a boarding party that is trying
to take the ship rather than to kill one system icon on it.

---

## 12.7 Boarding enemy ships

### The pieces

> "It is possible to deliver Boarding Parties or Marines onto enemy ships, either by use of
> Boarding Torpedoes, moving along side, by using Transporter Beams (pg 39), or with Assault
> Shuttles (chapter8)."

> "A ship's Damage Control Parties may be used in a Boarding Party role. Marines (troops with
> special shipboard combat training) may be purchased separately. In the following rules the term
> DCPs and Boarding Parties are used interchangeably."

That last sentence is why this module has one attacker type and not two. A DCP shipped over as a
boarder and a Marine shipped over as a boarder are the same counter once they are on the enemy's
deck; the difference between them shows up only on the *defending* side, where a Marine kills on a
4+ and a DCP has to pool up to three parties to get there.

Both attacker and defender units are single, indivisible counters. Nothing in 12.7 gives a party a
strength, a hit total, or a state between alive and dead.

### Who may shoot at what

| | may be shot at by | may shoot at |
| --- | --- | --- |
| Attacking Boarding Party or Marine | defending DCPs (step 1), defending Marines (step 2) | the defending Marines (step 2), **or** the hull (step 3) — chosen in step 1 |
| Defending DCP | nothing at all | one attacking unit (step 1) |
| Defending Marine | the attacking units that engaged them (step 2) | one attacking unit (step 2) |
| Hull boxes | attacking units that did *not* engage the Marines (step 3) | — |

The asymmetry in row two is explicit, and it is the rule most likely to be implemented backwards:

> "Attacking Boarding Parties or Marines cannot target and kill the ship's DCPs; they can only
> kill the crew by destroying hull boxes."

A boarding party cannot fight the damage control parties that are fighting it. The only way to
kill a DCP is to destroy the hull boxes it lives in — which is what step 3 does, and which is why
a boarding action that is going badly can still be won by grinding the hull down.

### The defenders' two tables

**Damage Control Parties.** The crew's counter-attack is a damage control action, resolved like a
repair:

> "A ship's crew may attempt to destroy invading Boarding Parties and Marines as a damage control
> action. Each enemy Boarding Party or Marine must be targeted separately. As with repairing
> systems, the chance of killing an enemy Boarding Party or Marine depends on how many DCP units
> are assigned to the action. One DCP will kill an enemy Boarding Party or Marine on a die roll of
> '6', two DCPs will kill it on a 5 or 6, and three DCPs will kill it on a 4+."

| DCPs assigned to one attacking unit | Kills it on |
| --- | --- |
| 1 | 6 |
| 2 | 5 or 6 |
| 3 | 4, 5 or 6 |

One die per *target*, not per party: the parties pool onto a target the way they pool onto a
system in 10.4, and "Each enemy Boarding Party or Marine must be targeted separately" is the rule
that stops one roll covering two invaders.

**Marines.**

> "A ship with embarked Marines may use them to destroy attacking enemy Boarding Parties or
> Marines. They are much more effective at this role than the ship's own crew … One Marine will
> kill another Boarding Party or Marine unit on a 4+."

One Marine on its own does what three DCPs do. That ratio — 5 points for a Marine, 5 points for a
DCP (13.13) — is the whole argument for carrying Marines on a warship that never intends to board
anybody.

**Attackers.**

> "Attacking Marines may target defending Marines or attempt to do damage to the ship's hull
> boxes. They hit and kill defending Marines on a die roll of 4+. Combat between defending Marine
> units and attacking Marine/Boarding Parties is simultaneous."

### The procedure

> "Resolve Boarding Combat during phase 12. Use the following procedure to resolve Boarding
> Combat:"

**Step 1 — allocation, then the crew's counter-attack.**

> "Step 1: First allocate attacking Boarding Parties and Marines to attack defending Marines or
> attempt to damage the ship's hull boxes. Secondly allocate defending DCP and Marines to a
> particular enemy Boarding Party or Marine."

> "Defending DCPs now attempt to kill enemy Boarding Parties or Marines as a Damage Control roll.
> Remove any enemy Boarding Party or Marine casualties. Enemy Boarding Parties or Marines may NOT
> attack defending crew (DCP) units in this phase."

Both allocations are made before any die is rolled, and they are made once. The attacker commits
each unit to *the Marines* or to *the hull*; the defender commits each DCP and each Marine to a
named enemy unit.

**Step 2 — the Marines fight, simultaneously.**

> "Step 2: Defending Marines (not DCPs) may fire on enemy Boarding Parties and Marines, inflicting
> kills on a die roll of 4+. Attacking Boarding Parties and Marines engage defending Marines.
> Combat and kills inflicted are simultaneous."

**Step 3 — whoever is left wrecks the ship.**

> "Step 3: Any remaining enemy Boarding Parties that did not attack the defending Marines do one
> point of damage per DCP or Marine to the ship's hull boxes. This damage may require the ship to
> take threshold tests if a row of hull boxes is destroyed."

### The simultaneity rule, exactly

Only step 2 is simultaneous, and this is the single most important sequencing fact in the section:

- **Step 1 is not simultaneous.** "Remove any enemy Boarding Party or Marine casualties" comes
  before step 2, so an attacker the DCPs kill never rolls a step-2 die and never damages the hull.
  The crew's counter-attack genuinely goes first.
- **Step 2 is simultaneous both ways.** A defending Marine shot dead by an attacker still fires,
  and an attacker shot dead by a defending Marine still fires. Both sides' dice are counted
  against the strengths they had *entering* step 2, and casualties are removed afterwards.
- **Step 3 depends on the step 1 allocation, not on the step 2 outcome.** An attacker that chose
  the Marines does no hull damage even if it survives and even if every defending Marine is
  already dead. The worked example says so in as many words.

### The worked example, as the book plays it

> "During the turn the IKV Kiang managed to get 4 Marines aboard the United Do Gooder starship
> Wulkan. The Wulkan has 6 DCPs and 2 Marines. With no damage to repair, the Wulkan player decides
> to use all of his DCP and the 2 Marines, to repel the IKV troops. The IKV player decides to
> assign two of his Marines to attacking the defending Marines. The other two will 'destroy' two
> hull boxes if they survive. The Wulkan player decides to assign his 6 DCP to attack (repel) the
> Marines assigned to damaging hull boxes (three for each Marine) and his 2 Marines to engage the
> other two enemy Marines. The DCPs need a 4+ to destroy a Marine. The player rolls a 2 and a 5,
> killing one Marine. The IKV Marines and the Wulkan Marines each need a 4+ to kill one another.
> The IKV Marines wipe out the Wulkans with only one loss."

> "Combat is now over for the turn. The IKV Marine assigned to attacking hull boxes has survived,
> and now destroys one hull box. The other surviving Marine does not eliminate a box since it was
> engaged against the ships defending Marines."

Six DCPs produce **two** dice, not six: three parties on each of two targets, each pool rolling
once at 4+. Four attackers produce **one** point of hull damage, because two were killed or
committed elsewhere and one of the two survivors had spent its turn fighting Marines. The test
suite replays this example die for die.

### DCPs spent here cannot repair anything

The Quick Reference Sheet's turn sequence closes the loop:

> "14. Damage Control assignments for DC parties not used to repel boarders."

Repelling boarders *is* the damage control action for those parties this turn (12.7: "as a damage
control action"), so `resolveBoardingCombat` reports `dcpsCommitted` and the caller must withhold
that many parties from phase 14. The same pool, spent once.

### Threshold checks and boarding

> "Marines and Boarding Parties cannot be killed in a threshold test caused by boarding combat.
> Both Marines and Boarding Parties are vulnerable to being killed in threshold tests caused by
> weapons fire against the ship. In the case of attacking Boarding Parties and Marines, they
> cannot be lost to threshold checks caused on the turn they boarded the ship."

Three separate rules, and the engine needs all three because 13.13 puts Marines on the SSD as
systems that threshold checks roll for:

| Threshold check caused by | Ship's own Marines / DCPs | Attacking boarders |
| --- | --- | --- |
| Boarding combat damage (step 3) | never rolled for | never rolled for |
| Weapons fire | rolled for | rolled for, **unless** they landed this turn |

`boardersAtRiskInThreshold` answers that table for one party. Note that `game.ts` already records
`landedTurn` on every `BoardingParty` for exactly this purpose.

### Capture

> "If a ship is 'destroyed' by Boarding Parties or Marines it is considered captured. While the
> ship cannot be used in that combat (it is too badly shot-up to be of much use), if the boarder's
> side wins and holds the field they can take the ship home for study, or as a trophy."

> "Captured ships can still be targeted by ships and ordnance, so an empire may fire upon and
> destroy their own captured ships to prevent them from falling into enemy hands. A single point
> of damage is sufficient to destroy the captured ship."

A hull emptied by step 3 is a prize, not a wreck — and a fragile one: one point of damage from any
source finishes it. `resolveBoardingCombat` reports `captured` when the step-3 damage reaches the
last hull box; `capturedShipDestroyed` is the one-point rule.

### Boarding continues into FTL

> "If a ship jumps away into FTL with enemy boarders on board, the battle for control of the ship
> continues. Resolve the boarding action until either all the boarders are killed, or the ship has
> been captured. If it is captured the player receives the full victory points for it if the
> scenario being played is using victory points."

So phase 12 keeps running for a ship that is no longer on the table. `boardingContinues` is that
termination test — boarders still alive and the ship not yet taken — and it is deliberately
independent of position, `offTable` and `ftlTransit`.

---

## 12.8 Fleet morale

> "If playing a simple engagement (or a competitive game), we suggest that the loss of 50% of a
> player's overall force (calculated in mass of ships destroyed) would be enough to cause the
> commander to withdraw from battle."

> "For other games we recommend that the level of losses to force a withdrawal should be written
> into the scenario when it is designed, bearing in mind the story-line being used."

Two things a reader gets wrong from memory. It is **mass**, not points and not hull count — a
50-mass escort screen dying is worth as much to morale as one 50-mass cruiser, whatever they cost.
And the 50% is a *default*, explicitly overridable per scenario, so `fleetMorale` takes the
fraction as an option.

The section is advice about a commander's decision, not a die roll: there is no morale check to
fail. `fleetMorale` therefore reports a threshold crossing and nothing else — the withdrawal
itself is 3.9's business.

---

## 12.9 Striking the colors

> "One possibility is to make an extra roll at the same time as any threshold check, using the
> normal scores for losing systems at threshold points, i.e. 6 the first time, 5 or 6 the second,
> etc. If the ship fails this roll then its captain decides to 'strike the colors' and surrender
> to the nearest enemy vessel."

| Hull rows lost | Strikes on |
| --- | --- |
| 1 | 6 |
| 2 | 5 or 6 |
| 3 | 4, 5 or 6 |
| 4 | 3+ |
| 5 | 2+ |

This is 4.11's own ladder, restated by 12.9 itself, so the module derives the target from the
quoted sentence rather than borrowing it: `strikeColorsTarget(rows) = 7 − rows`, floored at 2.

> "Using this rule can result in the surrender of a vessel that has taken relatively little damage
> – however naval history is rife with precedents for this where colors were prematurely struck
> due to damage suffered being grossly overestimated."

> "Players may prefer to roll as if for a Core System threshold check, in which case ships will
> never surrender on the first row of damage."

> "One point must be made here – the use of this rule is strongly dependent on exactly who the two
> fleets are; for example, if using the GZG background then it is very unlikely that any human
> ship would even attempt to surrender to a Kra'Vak or vice-versa, simply because they would not
> expect to survive capture."

The last paragraph is a rule, not colour: a crew that expects to be eaten does not strike. It is
modelled as `noQuarterWith`, a list of sides this crew will not surrender to, and a ship that will
not surrender **rolls no die at all** — which keeps the dice stream honest, because a roll that
can have no effect must not consume one.

---

## 12.10 Civil wars

> "There may be some situations where 'blue on blue' battles take place such as civil wars,
> rebellions etc. If both fleets are composed of ships built by the same navy then all ships and
> squadrons roll a +1 on their direct fire weapons. The crews of these ships are well aware of the
> enemy ships vulnerable areas."

A single +1, on direct fire only, for **both** sides at once. It is symmetric by construction: the
condition is a property of the pairing of fleets, not of a shooter, so there is no version of this
rule where one side gets it and the other does not.

---

## Readings

### [reading] An attacking Boarding Party kills a defending Marine on a 4+, exactly as an attacking Marine does

The 4+ is printed in the *Marines* paragraph ("Attacking Marines … hit and kill defending Marines
on a die roll of 4+"), but step 2 puts both attacker types into the exchange as one body:
"Attacking Boarding Parties and Marines engage defending Marines."

Taken: one number for every attacking unit, 4+. The alternative was to give an attacking DCP the
defenders' pooled ladder — 6 for one unit, 5+ for two, 4+ for three — and it was rejected because
that ladder is written for *defenders assigned in pools of up to three against one target*, and
the attacker side has no pooling rule at all: attackers are allocated one at a time to "the
Marines" or "the hull". Applying it would mean inventing an attacker-side pooling mechanic that
12.7 never mentions. The section's own opening sentence settles the tie — "the term DCPs and
Boarding Parties are used interchangeably".

Where it shows: an assault mounted with cheap DCPs is exactly as dangerous per counter as one
mounted with Marines. The difference between the two troop types in this engine is purely
defensive, which is a real consequence and is stated here rather than buried.

### [reading] Defending DCPs pool at most three to a target, and a fourth is a plan error rather than a wasted party

12.7 lists one, two and three DCPs and stops. 10.4 caps a repair at three parties on one system,
and the Quick Reference Sheet caps this action too — "+1 to the roll for each DC party assigned,
max of three."

Taken: `MAX_DCPS_PER_TARGET = 3`; `validateBoardingPlan` reports a fourth party on a target as a
problem, and `resolveBoardingCombat` caps the die at 4+ if one is passed anyway. The alternative —
silently accepting the extra parties and consuming them — was rejected because those parties are
then lost to phase 14 for nothing, and a plan that quietly costs the player a repair is worse than
one that is refused.

Also worth recording: the Quick Reference Sheet's wording, read literally ("a roll of 6 … +1 to
the roll for each DC party assigned"), makes a single DCP kill on a 5+, one step better than
12.7's table. It reconciles if "each" means each party *beyond the first*. 12.7's explicit
three-line table governs; the sheet is a summary of it.

### [reading] A defender allocated to an attacker who dies in step 1 has wasted its shot

Allocation happens once, in step 1, before any dice; then step 1 removes casualties; then step 2
resolves. If a defending Marine is allocated to an invader the DCPs then kill, there is nobody left
to shoot at.

Taken: the shot is wasted, and the result reports it as `wasted: true` so a UI can say why a
Marine did nothing. The alternative — letting defenders re-target after step 1 — was rejected
because it makes the ordering of the two sentences in step 1 meaningless, and because it would
hand the defender a free lookahead that the attacker (who allocated first) never gets. The
practical advice, which the book's own example follows, is to keep DCP and Marine allocations on
disjoint targets.

### [reading] All boarders from every hostile side are resolved together, and hostile boarders never fight each other

12.7 is written for one attacker and one defender. Nothing says what happens when two mutually
hostile sides have parties on the same deck.

Taken: every party whose `side` differs from the ship's is an attacker in the same resolution, in
list order, and they ignore each other. The alternative — a three-cornered fight — was rejected
because the section supplies no procedure, no priority and no numbers for it, and inventing one
would decide a scenario the book leaves to the players. Parties whose side matches the ship's own
are not attackers and are passed through untouched.

### [reading] "Fails this roll" means rolling *at or above* the threshold number

12.9's "if the ship fails this roll" reads either way in isolation, but the sentence fixes it:
"using the normal scores for losing systems at threshold points, i.e. 6 the first time." The score
for losing a system is the score that destroys it, and 4.11 destroys a system on a 6 at the first
threshold point. So the ship strikes on a 6 the first time.

Taken: `struck = modified >= target`. The alternative — surrender on anything *but* the threshold
score — was rejected on arithmetic alone: it would strike five ships in six at the first threshold
point, and 12.9's caveat about surrendering "with relatively little damage" is written as a
surprising edge case, not as the norm.

### [reading] The Core System variant of 12.9 is the −1 DRM, applied to the die

12.9 offers "roll as if for a Core System threshold check, in which case ships will never
surrender on the first row of damage" without saying what that roll is.

Taken: −1 on the die, which is the engine's Core Systems modifier (7.9 is the only statement of it
in the whole text: an Antimatter Suicide Charge gets "a -1 DRM whenever they take threshold tests
(like Core Systems)"). This reproduces 12.9's stated consequence *exactly* and by arithmetic
rather than by fiat: against a target of 6, a die of at most 6 − 1 = 5 can never strike on the
first row. The alternative — a rule that simply skips the first row's check — produces the same
first-row behaviour but nothing else, and would leave the second and third rows rolling at the
plain rate, which is not what "roll as if for a Core System threshold check" says.

### [reading] Civil war is a property of the pairing of fleets, not of a shot

"If both fleets are composed of ships built by the same navy then all ships and squadrons roll a
+1" is a condition on the fleets as wholes, granting a blanket bonus to everyone.

Taken: `isCivilWar` asks whether every ship in both fleets is from a single navy, and the +1 then
applies to every direct-fire roll on both sides. The alternative — comparing the shooter's navy
with the target's on each shot, which is what the rationale sentence ("the crews of these ships
are well aware of the enemy ships vulnerable areas") would suggest — was rejected because it turns
a scenario-level switch into a per-shot lookup, and because it would hand the bonus to a fleet
that is *not* fighting a civil war at all, merely one that happens to face a few hulls of its own
build among mercenaries.

### [reading] The +1 is on direct-fire weapon rolls only, and not on point defence made with those weapons

The text says "direct fire weapons", which excludes ordnance (section 6) plainly enough. The
awkward case is a Beam-1 firing as point defence (7.12), which is a direct-fire weapon making a
non-direct-fire roll.

Taken: point defence does not get it, nor do fighter attacks (8.7, which is its own procedure and
rolls no direct-fire weapon). The alternative — every die the weapon ever throws — was rejected
because point defence is resolved on its own table against ordnance and fighters, where "the enemy
ships vulnerable areas" has no meaning. `civilWarDrm` takes the kind of shot explicitly so the
decision is visible at the call site rather than assumed.

### [reading] Fleet morale counts captured hulls as lost, and off-table ships as still in the force

12.8 says "mass of ships destroyed" and 12.7 says a captured ship is one "destroyed" by boarders —
in scare quotes, because it is not a wreck.

Taken: captured hulls count towards the 50%. They are lost to their owner for the rest of the
battle by 12.7's own words ("the ship cannot be used in that combat"), and a commander who has had
half his tonnage taken as prizes has the same reason to withdraw as one who has had it shot away.
Ships that have left the table under 3.9 are *not* counted: they are undestroyed, and counting a
successful withdrawal as a morale loss would make withdrawal self-reinforcing. Both are options on
`fleetMorale` for a scenario that wants it the other way.

Related and smaller: the comparison is `>=`, because 12.8 says the loss of 50% "would be enough".

---

## Not implemented, and why

| Rule | Why |
| --- | --- |
| Delivering boarders — Boarding Torpedoes (5.18), Transporter Beams (5.9), assault shuttles (8.15, "Assault shuttles may land boarding parties on a 3+") | Already in the engine. This module reads the `boarders` list those systems populate and never writes to it except to report survivors. |
| The Commando Raid table (5.9) | Excluded by 12.7 by name, and implemented in `weapons/beams.ts` where the transporter lives. |
| "Moving along side" as a way to board | 12.7 lists it as a delivery method and then gives it no range, no roll and no procedure anywhere. There is nothing to implement; a scenario that wants it can add a party to `boarders` directly. |
| Rolling for Marines and boarders during a threshold check | The predicate that says *whether* a party is at risk is exported here; the check itself belongs to `threshold.ts`, which today builds its checkable list from `design.systems` and does not yet roll for either 13.13's Marine systems or the `boarders` list. |
| Marking a ship captured | Reported as `captured` on the result. `ShipState` has no `captured` flag and this module may not add one, so a captured hull is still `destroyed: false` with zero hull left until the integrator wires it up. |
| "A single point of damage is sufficient to destroy the captured ship" | `capturedShipDestroyed` is the test; applying it needs the captured flag above and a hook in `combat.ts`'s damage application. |
| Full victory points for a captured prize (12.7, with 18.3) | `victory.ts`'s business. |
| Whether a prize goes home — "in a campaign the ship may or may not be returned to the capturing player" | Explicitly left to the campaign by the text. |
| Actually withdrawing a broken fleet (12.8) | `fleetMorale` reports the crossing; leaving the table is 3.9, and whether the commander obeys is the player's call — 12.8 is written as advice to players, with no check to fail. |
| Applying the +1 of 12.10 to weapon rolls | Reported as a DRM for `combat.ts` to add, in keeping with this module reporting rather than applying. There is also no exported predicate anywhere in the engine for "is this weapon class direct fire", so `civilWarDrm` is told the kind of shot rather than guessing it from a `WeaponClass`. |
| 12.11 Knocked off course, 12.12 Vector movement | Outside 12.7 – 12.10. |
