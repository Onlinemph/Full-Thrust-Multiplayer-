# Special moves — section 16

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, sections 16.1 – 16.7 and the
**Ramming ability** box that closes the section, quoted from `continuum-rulebook-part2.txt`
lines 1743–1823 (pages 128–131). Cross-references to 3.2 and 3.3 (the thrust budget and the
turning allowance), 3.7 (squadron movement), 3.9 (ships leaving the table), 4.2 (fire arcs),
4.11 (a damaged drive's current rating) and 13.15 (starbases) are named where section 16
delegates to them.

Implementation: `src/engine/specialmoves.ts`. Tests: `src/engine/specialmoves.test.ts`.

Readings taken where the text genuinely admits more than one meaning are marked **[reading]**,
each with the alternative it rejected and why.

> **A note on the extract.** Pages 128–129 are set in two columns and the text extractor
> interleaved them, so a single line of `continuum-rulebook-part2.txt` can carry the middle of
> 16.3 and the middle of 16.1 spliced together — line 1745 opens *"16.3 Towing ships In normal
> space ships can tow other ships. 16.1 Thrust 0 drives Ships with thrust 0 drives…"*. Every
> quotation below has been unspliced by following one column at a time down the page. Anyone
> checking a quote against a line number should expect the other column's words in between.

---

## What section 16 actually is

Seven rules that all end in the same place: something the ship does during, or instead of, its
ordinary move. They share nothing else — one is a die roll, one is arithmetic on mass, one is a
bookkeeping convention, one is moving the furniture. So this module is not a system; it is seven
small, independent answers, each of which hands a value back to whoever is flying the ship.

Movement itself stays in `movement.ts`. Nothing here computes a turn allowance, flies an order or
applies a point of damage: rolling *reduces* an allowance it is given, towing *derives* a thrust
rating to be fed to a drive, ramming *reports* what the dice did.

### Every die in the section

| Roll | When | Read as | Rule |
| --- | --- | --- | --- |
| 1 D6, the rammer's nerve | End of the Ship Movement Phase | 6 or better proceeds; the 6 is reducible by prior agreement | 16.7 |
| 1 D6 each, + thrust rating | After the nerve roll succeeds and the ships are inside 2 MU | Attacker **strictly** higher = contact; a tie is an evasion | 16.7 |
| 1 D6 each, × remaining hull boxes | On contact | The product is damage on the *other* ship | 16.7 |
| 1 D6 each, +2 to the faster fleet | When the last disengaging ship is off the edge | Disengager equal-or-higher gets away; a tie is a getaway | 16.5 |

**16.1, 16.2, 16.3, 16.4 and 16.6 roll no dice at all.** Docking in particular is often
misremembered as a check: it is not. 16.6 is a geometry test and a two-turn delay, and the only
dice anywhere near it are 13.15's, for the ship that *misses* — see the closing note to 16.6.

---

## 16.1 Thrust 0 drives

> "Ships with thrust 0 drives, and any asteroids or similar object that have significant movement
> relative to ships, never write orders. The controlling player, or scenario designer, determines
> the initial position, course, and velocity before the game begins. Each turn, the ship or
> asteroid moves along this predetermined course before all other ships."

Three separate things, and the third is the one that bites:

1. **No orders.** A thrust-0 object is outside the order-writing phase entirely (2.6 phase 1). It
   cannot accelerate, decelerate or turn, because 3.2 spends thrust on all three and it has none.
2. **The course is scenario data,** fixed before the game.
3. **It moves first,** before every ship. That matters because whether a hulk drifts into the 3 MU
   docking envelope, or a rock into a firing line, is settled before anyone else moves.

`driftForward` is therefore a straight advance along a fixed course, and `movementPriority` returns
0 for thrust 0 and 1 for everything else, so a stable sort by it puts the drifting objects first.

**[reading] — a predetermined course is one straight line.** The rule names *"position, course,
and velocity"*, singular, and then says the object *"moves along this predetermined course"*, so
the engine advances it in a straight line at constant speed for the whole battle. The alternative
is a scripted path — a list of per-turn courses the designer wrote out, which the phrase
"predetermined" could just as well cover. It was rejected because nothing in 16.1 provides for a
course *changing*, and because a designer who wants a curve can still have one: `driftForward`
takes the object's course as a parameter, so feeding it a different course each turn drives a
scripted path from the scenario file without the engine inventing a path format.

3.2's own note on thrust 0 is worth having alongside it, because it explains why the rule is a
restriction and not a claim about physics:

> "Thrust 0 doesn't mean it can't move or turn, but that any change of course or speed takes
> planning and a few hours or days to take effect. The captain doesn't just shout 'Helm, hard
> a-port!'"

A starbase is a thrust-0 object with velocity 0: 13.15 says *"A starbase is always thrust 0 for
movement"*.

### Low thrust

Section 16 has no low-thrust rule of its own. The rating-1 exception — *"can change facing by 1
point, but not on consecutive game turns"* — is 3.2's, and `movement.ts` already implements it in
`standardTurnAllowance`. The one place section 16 produces a thrust rating low enough to matter is
16.3's tow, which can round to zero; that case is handled there.

---

## 16.2 Rolling ships

> "Although Full Thrust makes no attempt to simulate 3-dimensional movement or combat, there is
> one simple rule addition that we are including here: the ability to roll a ship 180° on its
> central axis, thus effectively swapping the port and starboard sides (i.e. the ship is 'upside
> down' relative to the other ships on the table). This maneuver can be very useful when ships
> start to lose systems due to damage, as it can allow undamaged weaponry to bear on targets that
> would otherwise be on the wrong side of the ship."

> "To perform a roll, the player simply writes 'Roll' in the movement orders for that turn; the
> roll expends 1 thrust factor which comes off the turning allowance. For example, a thrust-4
> ship, normally capable of 2 points of turn, could only turn 1 point if it also rolled that move;
> but would still be able to use its other two thrust factors to accelerate or decelerate as
> normal. The roll then occurs at the start of the ship's movement, and a marker is placed by the
> model to indicate its inverted condition. Rolling has no effect on combat (except that the port
> batteries now bear to starboard and vice versa). An inverted ship may roll back 'upright' in any
> subsequent turn, or may remain inverted as long as the player wishes."

> "For simplicity of play, rolled ships still have their movement orders written in relation to
> the actual miniature rather than their theoretical inverted condition – thus an order written
> for a port turn will still turn the model to the left, even though to the inverted ship this
> would actually be a starboard turn. Keeping to this convention should avoid a lot of confusion
> and arguments."

### What the roll costs

The worked example settles the arithmetic, and it is worth writing out because the sentence alone
does not:

| Thrust-4 ship | Ordinary turn | Rolling turn |
| --- | --- | --- |
| Thrust points available | 4 | 4 |
| Spent on the roll | — | **1** |
| Turning allowance (3.2: half the rating) | 2 | **1** |
| Left for accelerate/decelerate after a 1-point turn | 3 | **2** |

1 (roll) + 1 (turn) + 2 (accel) = 4, which is exactly the book's *"its other two thrust factors"*.
So the roll is a single thrust point, and the pot it comes out of is the turning sub-allowance —
it is not a free attitude change, and it is not two points.

`rollBudget(thrust, turnAllowance)` returns the pair after the point is taken. It asks for the
allowance rather than deriving it, because deriving it means re-implementing 3.2's half-rounded-
down rule, 3.3's advanced-drive rule and the rating-1 exception, all of which already exist in
`movement.ts` and none of which should exist twice.

**[reading] — a ship with no turning allowance left may still roll.** A thrust-1 ship that turned
last turn has an allowance of 0 under 3.2; so does a thrust-2 drive halved to 1 by a threshold
check. The rule says the point *"comes off the turning allowance"*, which could be read as a
prerequisite: no allowance, nothing to come off, no roll. The engine reads it as an accounting
instruction instead — spend a thrust factor, and charge it to the turning column, which then floors
at zero — so the only requirement is one unspent thrust point. The alternative was rejected on the
rule's own stated purpose: 16.2 exists because the manoeuvre is *"very useful when ships start to
lose systems due to damage"*, and the reading that forbids it locks it out of precisely the
battered, half-thrust ship it was written for. A ship with **no** thrust at all — a thrust-0 hull,
or a drive shot out under 4.11 — cannot roll, because it has no factor to spend.

### What the roll does

- **Port and starboard swap.** `FP↔FS`, `AP↔AS`, and `F` and `A` map to themselves, which is a
  mirror through the ship's long axis. The engine can either mirror the weapon's printed arcs or
  mirror the arc the target is seen in; the mirror is its own inverse, so the two are the same
  test, and `weaponBears` does the second because it needs `arcTo`'s answer anyway.
- **Nothing else about combat changes.** Not the range, not the dice, not the target's own facing.
- **The state persists** until the ship rolls back. It is not a per-turn flag.
- **Orders are still written for the miniature.** A port turn turns to port whether the ship is
  inverted or not, which is why nothing in the movement path takes an `inverted` argument. The
  test suite asserts this the only way it can be asserted — that mirroring arcs does not mirror a
  course change.

---

## 16.3 Towing ships

> "In normal space ships can tow other ships."

> "First the towing ship must match courses. The two ships must be within 3 MU of each other and
> either both halted, or both moving at the same velocity and course facing."

> "At the start of a turn (before the Ship Movement Phase) where the two ships have matched
> courses, the towing ship can begin establishing a link."

> "• A ship equipped for towing as part of its normal duties requires one complete turn for each
> ship."
>
> "• Any other ship requires two complete turns and can only tow a single ship."

> "If either ship changes velocity or facing during this time without an exact match by the other
> ship, or if the target ship fires any weapon against the other and inflicts at least one hull
> box of damage, the link is broken and the procedure must be restarted from the beginning."

> "Once linked, the two ships move as if they were in a line-ahead squadron formation. Multiply
> the mass of the towing ship by its main drive rating: this is the available thrust."

> "Divide the available thrust by the combined mass of the linked ships and round down to the
> nearest whole number. This is the thrust rating of the linked ships. (If the thrust rating of
> the linked ships rounds down to zero, the tow can still succeed, but the time required will be
> many hours or days, outside the time frame of a Full Thrust battle.)"

> "Example: A salvage ship with mass 80 and thrust 4 attempts to tow a dreadnought of mass 160
> that has no operational main drive. It is currently drifting at velocity 3, course 9."
>
> "The salvage ship first matches velocity and course within 3 MU, then spends one turn
> establishing a link. The salvage ship has mass 80 × thrust 4 = 320 available thrust. Dividing
> this by the combined mass of 80 + 160 = 240 gives 320 ÷ 240 = 1.5, thrust rating 1 for the
> linked ships."

### The arithmetic

```
available thrust = tug mass × tug main drive rating
combined mass    = tug mass + every towed hull's mass
linked rating    = floor(available thrust ÷ combined mass)
```

The book's own numbers: 80 × 4 = 320; 80 + 160 = 240; 320 ÷ 240 = 1.5 → **1**. Two things a reader
gets wrong here and the tests guard:

- The tug's own mass is in the denominator. It is towing itself as well.
- It rounds **down**, so 1.5 is 1 and not 2. A tug barely out of its depth gets nothing.

Rating 0 is not a failure. *"The tow can still succeed, but the time required will be many hours
or days, outside the time frame of a Full Thrust battle"* — so `linkedDriveRating` reports
`thrust: 0` with `outsideBattleTimeframe: true`, and the pair simply coasts for the rest of the
game. The integrator should show that, not refuse the tow.

### Establishing the link

| Tug | Turns per ship | Ships it may tow |
| --- | --- | --- |
| "Equipped for towing as part of its normal duties" | 1 | not limited by the text |
| Anything else | 2 | 1 |

**[reading] — "one complete turn for each ship" is per ship, sequentially.** A purpose-built tug
taking three hulks under tow spends three turns, one per link. The alternative reading is one turn
covering the whole group at once, which the words could bear if "each ship" were merely
distributive. Rejected because the rule is drawing a contrast with the improvised tug's *"two
complete turns"* for a single hull: the unit being counted is the link, not the operation.

**[reading] — the break clause is one-directional.** *"If the target ship fires any weapon against
the other and inflicts at least one hull box of damage"* names the shooter as the **target ship**
— the prize — and the victim as *"the other"*, the tug. So `advanceTow` takes hull damage the tow
*inflicted on the tug*, and a tug shooting its own tow does not break its link. The symmetric
reading (any shot between the two) is defensible and tidier, but it was rejected because the rule
is plainly about a hulk resisting capture, and reading it symmetrically would invent a rule the
text does not contain.

**[reading] — the break clause covers the procedure, not the finished tow.** *"During this time"*
scopes both break conditions to the turns the link is being established, and *"the procedure must
be restarted from the beginning"* is a statement about the procedure too. So `advanceTowLink`
leaves a completed link alone. The alternative — the conditions run for the life of the tow, and a
hulk can shoot itself free after the link is made — is the more dramatic reading, and it was
rejected because 16.3 would then owe an answer it never gives: what happens to a *moving, linked*
pair the moment the link parts. Where a scenario wants a tow cut, the integrator can sever it.

Two further points on the break clause that the code takes literally:

- **Hull boxes, not damage.** A volley entirely soaked by screens or armour inflicts zero hull
  boxes and the link holds. One box breaks it. This is the boundary the tests pin.
- **"Restarted from the beginning."** A broken link is not a paused one: `turnsSpent` goes back to
  zero and the ships must match courses again.

Matching is checked every turn while the link is being established, not just on the turn it
begins: *"If either ship changes velocity or facing during this time without an exact match by the
other ship … the link is broken"*. Two ships with identical facing and identical velocity keep a
constant separation, so re-checking the 3 MU each turn costs nothing in exact play and catches the
case where they were never in range at all.

### After the link

*"The two ships move as if they were in a line-ahead squadron formation"* — that is 3.7, which
`movement.ts` owns:

> "For ships in line ahead, always move the lead ship according to orders with the others staying
> in formation behind it."

So this module's whole contribution to a linked tow's movement is the number: `linkedDriveRating`
gives a thrust rating, the integrator builds a `DriveState` from it, and the pair flies as a
squadron under section 3. In particular the linked rating is a *rating*, so 3.2's turning rules
apply to it unchanged — a linked rating of 1 gets 3.2's rating-1 exception, one point of facing
change and not on consecutive turns, which is a fairly brutal description of towing a dreadnought
and exactly right.

---

## 16.4 Moving table

> "Earlier we mentioned that ships that leave the edge of the table or playing area are leaving
> the battle. However, as space does not actually have edges, it really should be possible for the
> entire battle to 'move' off the edge of the playing area and still continue – this may happen if
> both sides are moving in the same general direction, e.g. in a pursuit scenario. If you find
> that all ships in the action are starting to get very close to one end or side of the table, it
> is a simple matter to move every ship and object in play a certain agreed distance back towards
> the opposite table edge; effectively you can think of it as extending the playing area under the
> ships. (All things are relative, as someone once said.)"

The rule is a coordinate translation applied to **everything in play at once**, which is why the
only property worth testing is the one that must not change: every pairwise distance, every
bearing, every range band is identical afterwards. `shiftTable` maps a list of positioned objects
to a new list, and the test asserts the invariant rather than the arithmetic.

**[reading] — the two numbers the rule leaves to the players stay with the players.** *"Very
close"* and *"a certain agreed distance"* are both undefined, and the engine does not pick values
for them: `crowdedEdge` takes the margin as an argument and reports which edge, if any, the whole
fleet is inside; `shiftTable` takes the distance. The alternative was to default them to something
plausible — a margin of one turn's movement, say — which would have been an invented number
dressed as a rule.

**[reading] — "all ships" means all of them.** One straggler at the far end of the table and
`crowdedEdge` reports nothing, because the shift is only free of consequences while nobody is
about to be pushed off the opposite side; a looser reading ("most of the action") would let the
table slide out from under a ship that was still fighting. Where a fleet has run into a corner and
two edges both qualify, the tighter one is reported.

It also changes what leaving the table means, which is 3.9's business:

> "This is usually considered a retreat from the battle unless using the moving table rules
> (section 16.4) or fighting an orbital scenario (section 17.8)."

`leavingTableIsRetreat(movingTable)` is that sentence, and it is the switch 16.5 hangs off.

---

## 16.5 Disengaging from battle

> "Particularly when playing campaign games, which for obvious reasons are very seldom fought 'to
> the death', it is advantageous to be able to disengage from battle if things are going badly for
> you – saving your remaining ships for the next engagement can be much more important than going
> out in a heroic blaze of glory."

> "If you use the moving table in a game, it will become possible to continue pursuit of a fleeing
> enemy. Under the normal rules a retreating force simply has to leave the table in order to break
> off combat, but with the moving table the pursuit may go on until one side either catches or
> outruns the other."

> "If one player decides to disengage, it is possible to actually play out the full pursuit stage
> as described above. If, however, this is felt to be too time consuming, there is an alternative
> abstract method that may be used."

> "The disengaging player's ships must all move off the table via the same table edge; until the
> last ship has left the table, the battle will continue as normal. When all the ships are off the
> table edge, each player rolls a D6. If one player has any ship that has a higher thrust than all
> opposing ships, then add 2 to the die roll."

> "Example: if the disengaging player has some thrust-8 escorts while the opposing fleet has
> nothing with a thrust above 6, the former adds 2 to the roll."

> "If the final total of the player who is trying to disengage is equal to or higher than their
> opponent's roll, they have successfully disengaged and are safe from pursuit. If, on the other
> hand, the opponent's roll is higher, then the pursuing player may elect to continue pursuit; in
> which case the game continues with a new set-up as a stern chase. The fleeing player may then
> attempt the disengagement again by leaving the opposite edge of the new playing area."

### The three numbers

**One edge, all ships.** *"Must all move off the table via the same table edge"*, and *"until the
last ship has left the table, the battle will continue as normal"* — so a straggler keeps the
whole fleet in the fight. `readyToDisengage` is that precondition, and it fails a fleet that split
across two edges even when every ship is clear.

**+2 to the faster fleet.** *"Any ship that has a higher thrust than all opposing ships"* is a
comparison of maxima: my best thrust rating strictly greater than yours. Because it is strict, at
most one side can ever hold it, which matches *"if one player has"*. The example is exactly this
— an 8 against a best of 6.

**Ties go to the runner.** *"Equal to or higher"* is a getaway. With no bonus in play that is 21
of 36 outcomes, 58%, and it is the number a reader reverses: the abstract disengagement favours
the fleeing player, deliberately, because the alternative on offer is playing out a stern chase
nobody wants to play. `disengagementSucceeds` is the bare comparison, so the tie can be enumerated
across all 36 die pairs rather than sampled.

**[reading] — "thrust" means ships' current ratings, and only ships'.** Fighters and gunboats have
speeds in MU, not thrust ratings, and 16.5 says *"ship"*; they are not counted. A crippled drive
counts at its current rating under 4.11 rather than the printed one, on the grounds that the
bonus is about who can actually outrun whom. The alternative — printed ratings, so a fleet keeps
its +2 after its fast escorts have had their drives shot out — was rejected because the whole
clause is a speed comparison at the moment of the chase. In practice the caller supplies the
numbers, so this is a documented expectation of the caller as much as a rule. An empty fleet on
either side scores no bonus rather than winning it by vacuous truth: with no opposing ships there
is nothing to be faster than, and no chase to be faster in.

**Repeat attempts carry nothing forward.** *"The fleeing player may then attempt the disengagement
again"* — a fresh pair of dice, the same bonus test, on the opposite edge of the new table. The
result reports `pursuitAvailable` so the integrator can offer the pursuing player the choice
(*"may elect to continue pursuit"* — it is a choice, not a consequence) and run the whole thing
again next time.

**Die order.** The disengaging player's die is drawn first, then the pursuer's. The book says
*"each player rolls a D6"* and does not order them; something must, or a replay would not be a
replay, so the module fixes the order and says so here.

---

## 16.6 Docking

> "Ships may attempt to dock with other ships or with starbases although this is unlikely during
> combat."

> "To accomplish a docking, the ship's movement orders must be plotted so that it ends up within
> 3 MU of the target ship/starbase at the end of the turn. If the target is stationary, the ship
> must also come to a dead stop, otherwise it must exactly match both course and velocity with the
> target ship or starbase at the end of the turn. On the following turn, the ship may be
> considered docked. One full turn is also required to 'cast off' and undock again, after which
> the ship may maneuver as normal."

### The approach

Two cases, and which one applies is decided by the *target*, not the docking ship:

| Target | What the docking ship must do at the end of the turn |
| --- | --- |
| Stationary (velocity 0 — a starbase, a hulk) | Be within 3 MU **and** at a dead stop |
| Moving | Be within 3 MU **and** exactly match its course and its velocity |

3 MU is measured between model centres, the same convention 4.2 and 17.1 use for everything else
(*"Between center points of models, remember"*). It is a "within", so exactly 3.0 MU docks.

**[reading] — against a stationary target, facing is free.** The text asks a ship docking with a
stationary target only to *"come to a dead stop"*, and asks for a course match only in the
"otherwise" branch. So a halted ship may dock nose-in, side-on or stern-first. The alternative is
to read *"exactly match both course and velocity"* as applying to both cases, with the dead stop
as an extra condition. Rejected on the sentence's own structure — the two branches are joined by
"otherwise", so they are alternatives, not a general rule with an addition — and because a halted
ship has no course in any meaningful sense: velocity 0 makes its facing an orientation, not a
heading, and 3.1 gives a stopped ship nothing to match.

### The clock

```
turn N      approach conditions met at end of movement   →  approach held
turn N+1    "the ship may be considered docked"          →  docked
   …        docked; the ship is attached and plots no movement of its own
turn M      cast-off ordered; "one full turn is required" →  casting off
turn M+1    "after which the ship may maneuver as normal" →  free
```

**[reading] — the match is spent once, not renewed.** *"On the following turn, the ship may be
considered docked"* is read as a status the successful approach earns, so the ship does not have
to satisfy the 3 MU and matched-velocity test a second time on turn N+1. The alternative — hold
the match for a second turn and dock at the end of it — would make docking a two-turn manoeuvre
under fire rather than a one-turn manoeuvre with a one-turn delay. Rejected because the sentence
is written as a statement about the ship's condition, not as a further requirement, and because
the parallel sentence about undocking (*"one full turn is also required"*) shows the author
naming a duration explicitly when he means one.

**[reading] — the cast-off turn is spent casting off.** *"After which the ship may maneuver as
normal"* puts free manoeuvre after the full turn, so the ship plots no move on the turn it is
undocking. The alternative reading is that the ship undocks and moves in the same turn, with
"one full turn" merely marking when it becomes eligible. Rejected because that makes the clause
say nothing at all — a ship that can move on the cast-off turn is not required to spend anything.

### What 16.6 does not cover, and where it lives

13.15 adds the consequences of being docked to a starbase, and they belong to whoever implements
starbases:

> "While a ship is docked to a starbase the ship may be fired on as normal unless it is actually
> docked internally. … An externally docked ship is, however, protected by any screen systems that
> the starbase has while docked. Whether a ship docked externally to a starbase can fire any of
> its own weaponry is up to the players or scenario designer."

And 13.15 is where the dice hide, for the ship that gets the approach wrong:

> "A starbase is the same collision risk as an asteroid. If a collision occurs the ship is
> destroyed and the nearest starbase section takes D6 × ship hull boxes damage as if it had been
> rammed."

That is 16.7's damage formula borrowed by section 13, and it is section 13's to implement.

---

## 16.7 Ramming

> "Deliberate attempts to ram another ship are possible in some circumstances, but such suicide
> attacks should be rarely attempted – crews would not be very keen on officers who ordered such
> tactics as a matter of routine! Ramming is therefore an optional rule. (Very small ships that
> ram, such as Autonomous Kill Vehicles with AI pilots, are represented in Full Thrust by missiles
> or torpedo fighter groups.)"

> "A player who wishes to attempt a ramming attack writes as part of movement orders that the ship
> is going to attempt to ram, and then rolls a D6 at the end of the Ship Movement Phase. Only on a
> roll of 6 may the ramming attempt proceed."

> "In order to attempt the ram, the ship must end the movement within 2 MU of the intended target
> ship (or models touching in the case of large ship models). Only if you succeed in anticipating
> the enemy move, and then succeed in rolling a 6 as explained above, may the actual ram be
> attempted."

> "Both players (attacker and target) roll a D6 each, and add the score to their respective ship's
> thrust ratings. If the attacker ends up with the highest total, the ram is successful."

> "If the target's total is equal or higher, it has evaded the ramming attempt."

> "When a ram succeeds in making contact, each player rolls another D6 and multiplies the result
> by the current (remaining) hull boxes that the ship has. The final result of this is the number
> of damage points inflicted on the other ship as a result of ramming."

> "Example: A corvette with 2 of its original 3 damage points left actually succeeds in ramming an
> undamaged heavy cruiser with all 16 of its damage points. The corvette player rolls a 4, which
> inflicts 8 points of damage on the cruiser."
>
> "The cruiser owner rolls a 3, thus doing 48 points to the corvette. The result is one vaporized
> corvette, and a badly damaged cruiser."

> "It will be clear from this example that ramming can be very deadly when it succeeds, small
> ships are almost certain to be destroyed, and even the largest can be crippled. Players who
> insist on using this tactic in unrealistic circumstances should be penalized in the most
> effective way possible: don't let them play again."

### The four gates

A ram has to pass all four, in this order:

1. **Declared** in the movement orders, before anything moves. Not a reaction.
2. **Within 2 MU** at the end of movement — *"or models touching in the case of large ship
   models"*, which is the physical-model version of the same test and is exposed as an override.
3. **The nerve roll:** one D6, 6 or better. One chance in six.
4. **The evasion contest:** both players roll a D6 and add their ship's thrust rating. The attacker
   needs to *"end up with the highest total"*; *"if the target's total is equal or higher, it has
   evaded"*. **A tie is an evasion.** Between equal-thrust ships that is 15 of 36, 41.7% — so the
   whole manoeuvre lands 1/6 × 15/36 = 5/72, under 7%, before anyone has taken a point of damage.
   `ramSucceeds` is the bare comparison so the tie can be enumerated over all 36 pairs.

Note which way the thrust bonus runs: it is *both* ships' thrust, so a nimble ship is both a better
rammer and a better dodger, and a crippled drive makes a ship easy to hit. Under 4.11 the rating to
pass in is the current one, not the printed one.

### The damage

```
damage on the target   = attacker's D6 × attacker's remaining hull boxes
damage on the attacker = target's   D6 × target's   remaining hull boxes
```

Read the example twice, because both halves are counter-intuitive:

- The multiplier is **the roller's own** remaining hull boxes, and the product lands on the *other*
  ship. Mass is not in it anywhere; a fat, healthy hull is a heavy hammer. The corvette's 2 boxes
  × 4 = 8 onto the cruiser; the cruiser's 16 boxes × 3 = 48 onto the corvette.
- The two hull-box counts are both **pre-ram**. If the attacker's 8 damage were applied before the
  cruiser rolled, the cruiser would be on 8 boxes and would inflict 3 × 8 = 24. The book says 48.
  So the exchange is simultaneous, and this is not a reading — it is the example's arithmetic.

`ramDamage` therefore takes both hull totals as they stood before contact and returns both numbers
at once.

**[reading] — ramming damage is reported as ordinary damage.** 16.7 says only *"the number of
damage points inflicted"* and never mentions screens, armour or the 4.9 damage modes, so the
result carries `mode: 'standard'` and `combat.applyDamage` will meet it with armour in the normal
way. Screens do not enter into it either way: 4.7's screens modify beam *dice*, and a ram produces
a damage total with no dice for them to modify. The alternative was `'AP'` — a physical collision
arguably shears through plate — which is the more evocative reading and the one a player might
expect. It was rejected because 4.9's modes are properties a weapon *declares*, ramming declares
none, and inventing armour-piercing for it would silently double the deadliest attack in the book
against precisely the ships built to survive it.

**[reading] — a die is only rolled when it can change something.** If the ships are not within
2 MU, the nerve roll is skipped rather than rolled and discarded; if the required roll has been
agreed down to 1 or less (see below), it is skipped as automatic. The book's order of presentation
puts the D6 first and the range requirement second, so a literal reading rolls the die either way.
The outcome is identical — an out-of-range ram fails whatever the die says — but the *replay* is
not: every die drawn advances the seeded RNG, so a discarded roll shifts every later roll in the
battle. Rolling only for decisions keeps the journal readable and the stream tied to events that
happened. The alternative, rolling unconditionally, is equally correct as rules and was rejected
only on those grounds.

**Die order within a ram:** nerve, then attacker's evasion, then target's evasion, then both
damage dice together (attacker's first). As with 16.5, the book does not order them and something
must.

### Ramming ability

> "Players may agree that certain game scenarios and/or certain races tactics may make ramming
> attacks more likely, and hence reduce this required die roll for them."

> "Any ship that can automatically attempt to ram should have an extra cost of at least +1 per
> mass of the ship, which represents the difficulty of indoctrinating crews willing to sacrifice
> their own lives, the cost of a fully automated ship with remote controls or AI pilot, or the
> remote hive mind/queen intelligence controlling expendable beings."

So the 6 is a default, not a constant: `resolveRam` takes `nerveTarget`, defaulting to
`RAM_NERVE_TARGET = 6`, and a target of 1 or less is a ship that rams automatically. The surcharge
is *"at least +1 per mass"* — a floor, not a price — so `automaticRamSurcharge(mass)` returns the
mass and is documented as the minimum a fleet builder should charge.

Note the scope of the surcharge: it is for a ship that can *automatically attempt* to ram, i.e. one
whose nerve roll is waived entirely. A scenario that merely softens the roll to 5+ for a fanatical
race is a scenario agreement and carries no cost in the text.

---

## The seams

Three things this module deliberately does not do, because something else already does them:

| Not here | Where | Why |
| --- | --- | --- |
| The turning allowance a roll is charged against | `movement.ts` `standardTurnAllowance` (3.2, 3.3, 4.11) | Half-rounded-down, the advanced-drive exception and the rating-1 exception are one rule each and belong in one place. `rollBudget` takes the allowance as a number. |
| Flying a linked tow | `movement.ts` (3.7 squadron movement) | 16.3 says *"as if they were in a line-ahead squadron formation"* and stops. This module returns the linked thrust rating; the integrator builds a drive from it. |
| Applying ramming damage to screens, armour and hull | `combat.applyDamage` (4.8, 4.9) | Damage is reported here, exactly as `gunboats.ts` reports it. |

---

## Not implemented, and why

| Rule | Why |
| --- | --- |
| The played-out pursuit — 16.5's *"it is possible to actually play out the full pursuit stage"* | That is not a mechanic, it is carrying on playing on a moving table. 16.4 provides the table shift and the ordinary rules do the rest; the abstract method is the one with rules to implement. |
| "A ship equipped for towing as part of its normal duties" as a ship property | `ShipDesign` has no towing rig and `SystemKind` has no entry for one, so `TowRig` is passed in per tow rather than read off the hull. Adding the flag is a spine change and is listed as such. |
| The tow's line-ahead formation geometry | 3.7's, and `movement.ts`'s. 16.3 delegates outright. |
| Docking bay capacity, internal versus external docking, and a docked ship's screen protection | 13.15, which is the starbase section. It states them; section 16 does not. |
| A starbase or asteroid collision — *"D6 × ship hull boxes damage as if it had been rammed"* | 13.15 and 17.6. It borrows 16.7's formula, but the collision rules that trigger it (avoidance rolls, automatic destruction of the ship) are terrain rules, and implementing half of them here would strand the other half. |
| 3.9's optional re-entry roll for a ship that leaves the table | Section 3, `movement.ts`. 16.4 and 16.5 only change *whether* leaving the table ends the battle. |
| Ramming a fighter group, a gunboat squadron or ordnance | 16.7 is written about *"another ship"*, and it says outright that small suicide craft *"are represented in Full Thrust by missiles or torpedo fighter groups"* — i.e. by their own rules in sections 6 and 8, not by this one. |
| The automatic-ram surcharge in a fleet list | `automaticRamSurcharge` returns the number, but rosters are built in `src/data` and `tools/`, which this module does not touch. |
| Emergency thrust (3.6) combined with a roll | 16.2 and 3.6 never mention each other. `rollBudget` takes whatever total and allowance it is given, so an integrator that wants to allow it can, but the engine does not decide the question. |
| The inverted-ship marker, the "Roll" written in the order, and the docking/ramming declarations as UI | `src/ui`, out of bounds. `SpecialMoveOrder` is provided as the shape those declarations should take. |
