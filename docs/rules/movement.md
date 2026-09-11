# Cinematic movement (section 3)

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, section 3 (`continuum-rulebook-extract.txt`
lines 329–528), plus the main-drive clause of 4.11 (line 711), which is what gives a drive a
*current* rating distinct from its printed one.

Implemented in `src/engine/movement.ts`. Tested in `src/engine/movement.test.ts`.
The two-leg course-change geometry itself lives in `src/engine/geometry.ts` (`moveShip`).

---

## 3.1 Ship movement

A turn's movement is defined by two numbers: **course** and **velocity**.

| Rule | Value |
| --- | --- |
| Courses | twelve, on a clock face. Course 12 is the agreed "up the table" reference. |
| Facing | *"In the cinematic movement system, the course and facing are always identical."* |
| Maximum velocity | none. *"there is effectively no maximum speed for any ship"* |
| Minimum velocity | 0. *"Ships may not have negative velocities, i.e., they may not move backwards."* |
| Distance moved | exactly the velocity. *"Ships must always move the full distance specified by their current velocity."* |
| When a velocity change bites | immediately. *"a ship ordered to change from 8 MU to 12 MU velocity moves the full 12 MU in that turn"* |

That last row is load-bearing: **the distance flown this turn is the velocity *after* the order's
acceleration**, not the velocity the ship started on. The worked example in 3.4 (below) depends
on it — a ship at velocity 6 accelerating by 5 moves 11 MU, not 6.

## 3.2 Thrust ratings

> *"The thrust rating of the ship is the combined acceleration, deceleration, and course changing
> that can be performed in one turn."*

So the rating is a **single budget** spent across two things:

| Spend | Limit |
| --- | --- |
| Acceleration or deceleration | up to the **full** rating; 1 thrust point = 1 MU of velocity |
| Course change | up to **half** the rating, **rounded down**; 1 thrust point = 1 course point |
| Both together | the sum may not exceed the rating |

> *"A ship with a thrust rating of 4 could accelerate or decelerate by up to 4 MU per game turn, or
> could apply up to 2 points of thrust to course changes and still be able to make a 2 MU change to
> velocity in the same turn. The ship cannot however, apply more than 2 of its available thrust
> points to changing course."*

**Worked example (3.2).** Thrust 6, applying 3 points (its maximum) to course, currently on course 10:
turning to port (anticlockwise) ends on **course 7**; to starboard (clockwise) on **course 1**.

**The thrust-1 exception.** *"A ship that has a thrust rating of 1 can change facing by 1 point, but
not on consecutive game turns. Such a ship can accelerate or decelerate by 1 MU each game turn, or
change facing by 1 provided it did not change facing on the previous turn."*

Half of 1 rounded down is 0, so without this clause a thrust-1 drive could never turn at all. The
engine therefore treats rating 1 as a special case: turn allowance 1 if the ship did **not** change
facing last turn, otherwise 0. The budget is still only 1 point total, so a thrust-1 ship turns *or*
changes velocity, never both.

**Thrust 0.** The typical-ratings list says thrust 0 *"doesn't mean it can't move or turn, but that
any change of course or speed takes planning and a few hours or days to take effect."* Section 16
(special moves), where that would be resolved, is not in the text extract (see `SOURCES.md`), so a
thrust-0 drive simply has a budget of 0 here: it coasts on its current course and velocity.

## 3.3 Advanced drives

> *"they are permitted to use up to all of their thrust rating to change course instead of half"*

One change only: the course-change allowance is the **full** current rating rather than half. The
total budget is unchanged, and *"it is still bound by the normal rules about splitting course changes
between the start and midpoint of the movement."* A thrust-6 advanced drive can therefore turn 6
points — a 180° about-face — flown as an L-shaped path, not a pivot.

## 3.4 Making course changes

> *"half of the course change is made at the start of the ship's movement, and the remaining half at
> the mid-point of the move. If the total course change is an odd number, then round down the initial
> part of the change and round up the mid-move part."*
>
> *"If the ship's velocity is an odd number, also round down the first half of the distance and round
> up the second half."*

This is `moveShip` in `geometry.ts`; `movement.ts` calls it rather than restating the rounding.

**Worked example A (3.4).** Course 3, velocity 10, turning 3 points to port.
Turn 1 point to port (half of 3, rounded down) → course 2; move 5 MU on course 2; turn 2 more points
→ **course 12**; move the remaining 5 MU on course 12.

**Worked example B (3.4).** Course 7, velocity 6, accelerating by 5 to velocity 11, 1 point to
starboard. Half of one rounds down to zero, so the ship does not turn at the start: it moves half its
distance — **5 MU after rounding down**, i.e. half of the *new* velocity 11 — on course 7, then turns
1 point to **course 8** and moves the remaining **6 MU**.

All measurements are taken from a point on the model (the centre — 4.2).

## 3.5 Orders

Written before anything moves. An order carries a course change with its direction, an acceleration
or deceleration, and the resulting velocity written after it for next turn's reference.

**Notation.** *"an order of `8P2+4: 12` would indicate a ship with an initial velocity of 8 making a
two point turn to port (P), plus acceleration of 4 MU, with a new final velocity of 12 (8+4)."*

| Piece | Meaning |
| --- | --- |
| leading number | velocity at the start of the turn |
| `P`*n* / `S`*n* | course change of *n* points to port / starboard |
| `P`*n* `S`*m* | a double course change (3.5), first leg then second |
| `+`*n* / `-`*n* | acceleration / deceleration in MU |
| `: `*v* | the new final velocity |

`ET` before the colon marks emergency thrust. That marker is **this engine's convention** — 3.6
prescribes no notation for it.

**No orders, and impossible orders.**

> *"Any ship with no orders will move straight ahead at an unchanged speed, as will any that are
> given impossible orders, such as one that would exceed the ship's thrust rating."*

An illegal plot is therefore not an error to reject; it is flown as `turn: null, accel: 0`.

**Halted ships.** *"A halted ship is still restricted to pivoting no more than half the drive
rating."* A velocity-0 ship may spend thrust on a course change, which changes its facing without
moving it (the two-leg path has zero length). The clause names "half the drive rating"; the engine
applies the ship's *normal* course-change allowance, which is half for a standard drive and — per
3.3, which states its exception without excluding halted ships — the full rating for an advanced
drive. Reading it the other way would only change the advanced-drive case.

**Double course change.**

> *"A ship with a sufficient thrust rating may make a double course change in one turn. A ship making
> a double course change always makes the first course change before moving and the second at the
> half way point, even if the first change is greater than the second."*

This *replaces* the 3.4 rounding for that move: the player declares the split, so the first leg is
applied in full before moving and the second in full at the halfway point. Distance is still split
half (rounded down) then the rest. Both legs' points count against the course-change allowance and
against the total budget.

**Worked example (3.5).** Orders `P1 S1`: turn to port, move, turn back to starboard, *"resuming the
original course but at some distance to port."*

## 3.6 Emergency thrust (optional)

> *"These rules allow ships to use up to 150% of their main drive's **current** rating, and/or use
> more thrust points for turning than would normally be allowed."*

"Current" is the word that matters: a drive halved by a threshold check (4.11) has a current rating
of half the printed one, and every ET number below is computed from the current rating.

**What ET buys**

1. *"Gaining additional thrust points equal to 50% of the drive's current rating, rounded down. Thus,
   a ship with a main drive of 4 could use up to 6, or a ship with a main drive of 3 could use up to 4."*
   → budget = rating + ⌊rating ÷ 2⌋.
2. *"Using thrust points over half the drive's current rating for turning. Thus, a ship with a main
   drive of 6, which would normally be allowed only 3 thrust points for turning, could then use 6."*
   → the half-rating cap on turning is lifted. The text names no replacement cap, so the engine caps
   turning at the whole available budget (rating, or 150% of it if (1) is also used). Turning more
   than 6 points in one direction is never useful anyway — the short way round is always cheaper.

**When the dice are rolled.** *"Immediately after Step 1 - Write Orders"* — phase 1 of 2.6, before
initiative.

**How many dice**

| Trigger | Dice |
| --- | --- |
| Thrust points over rating | +1 |
| Thrust points to turn over ½ rating | +1 |
| Each prior use of ET during the current scenario | +1 |

For an advanced drive the engine reads the second trigger as "over the ship's *normal* turning
allowance", which for an advanced drive is the full rating — ET is about exceeding what you are
normally allowed, and 3.3 allows an advanced drive the full rating for turning without any risk.
For a standard drive the two readings are identical.

**How the dice score.** *"These dice are scored as beam dice (i.e. 1-3 results in 0, 4-5 results in 1,
and 6 results in 2 but with NO re-roll)."* The no-re-roll clause is why the engine scores each face
with `beamDamage(face, 0)` rather than rolling a beam volley.

**The chart**, on the total of all dice:

| Total | Result |
| --- | --- |
| 0 | *"ET is completely successful with no damage to the main drive."* |
| 1 | *"ET is successful, but main drive takes damage as if it had failed a threshold roll."* |
| 2–3 | *"ET fails, and main drive takes damage as if it had failed a threshold roll."* |
| 4+ | *"ET fails, and main drive takes damage as if it had failed TWO threshold rolls."* |

> *"A ship that fails in its attempt to use ET must immediately re-plot its movement using standard
> thrust limitations. Damage to the main drive from ET may be repaired normally by Damage Control
> Parties."*

The re-plot is budgeted against the drive **as it now is** — i.e. after the ET damage — since the
damage and the failure are announced together.

**Drive damage, from 4.11.** *"When the drive first suffers a 'destroyed' roll on a threshold check it
is reduced to half the original thrust rating, provided it has a drive rating above 1. If it is then
hit a second time on a subsequent threshold check, it is disabled completely. A drive rated only 1 is
immediately disabled by the first threshold failure."* The rounding is not stated; **rounded down** is
the reading taken, because half of 1 rounded down is 0, which is exactly the "a drive rated only 1 is
immediately disabled" clause — the two rules agree only under round-down.

| Hits taken | Current rating |
| --- | --- |
| 0 | printed rating |
| 1 | ⌊printed ÷ 2⌋ |
| 2+ | 0 |

**The five worked examples (3.6).** An undamaged heavy cruiser, main drive 4, cinematic movement.

| # | Plot | Thrust used | Dice | Rolls | Scores | Total | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `P3+3` | 6 (3 turn + 3 accel) | 2 (over rating, over ½ for turning) | 2, 3 | 0, 0 | 0 | moves as plotted, no damage |
| 2 | `P3+3` | 6 | 2 | 1, 5 | 0, 1 | 1 | moves as plotted, drive halved (4 → 2) |
| 3 | `P3+3` | 6 | 2 | 4, 5 | 1, 1 | 2 | must re-plot; drive halved |
| 4 | `P3+3` | 6 | 2 | 6, 6 | 2, 2 | 4 | must re-plot; two threshold failures — *"essentially destroying the main drive"* |
| 5 | `S3+1` next turn | 4 (3 turn + 1 accel) | 2 (over ½ for turning; one prior ET use) | — | — | — | note: 4 ≤ rating, so no "over rating" die |

## 3.7 Squadron operations

| Rule | Value |
| --- | --- |
| Size | *"two to four ships in line ahead, line abreast, wedge, or diamond formation; but it could also be one large ship surrounded by a ring of up to six escorts"* |
| Orders | one order for the whole squadron |
| Movement | *"The lead ship moves as normal, while the others maintain the same relative position to it throughout the maneuver."* |
| Lead, line ahead | the ship at the front |
| Lead, other formations | *"the ship that has to move furthest, which is the leftmost for starboard turns, the rightmost for port"* |
| Thrust | *"restricted to that of the ship with the lowest drive rating in the squadron"* |
| Drive types | *"Squadrons cannot mix ships with standard and Advanced Drives."* |
| Forming / breaking | *"at the start of the game turn, before writing movement orders"* |
| Common base | a single order, *"may not split the group"* |
| Stragglers | *"If any single ship cannot keep up with the rest of group due to engine damage or some other issue it is considered destroyed."* |

"Leftmost" and "rightmost" are read from the squadron's own point of view, looking along its course:
in a starboard turn the ships on the port flank sweep the wider arc, so the leftmost ship leads.
"Maintain the same relative position" is read as a rigid-body move — each follower keeps its offset
in the lead's frame, so the formation rotates with the lead rather than sliding sideways.

Two points the text does not settle, resolved here: the lowest rating is the lowest **current**
rating (drive damage is exactly the "engine damage" the straggler clause anticipates), and a
squadron using emergency thrust rolls once, on the squadron's effective drive, with prior uses taken
as the highest count among its members.

## 3.8 Collisions

> *"the risk of an accidental collision between two ships is incalculably small, and is therefore
> ignored for all game purposes"*
>
> *"Ships can freely move 'through' both friendly and enemy ships and fighter groups. If two ship
> models would actually be touching at the end of all movement, they should simply be arranged as
> closely as possible, to the agreement of both players."*

Nothing happens on contact. Ships are points in the engine, so two of them may share a position with
no consequence; the tidy-up is a model-handling convention, and is offered as a display-only helper
that leaves the authoritative positions alone (ranges are measured centre to centre — 4.2).

Asteroid and terrain collisions are section 17, which is not in the extract.

## 3.9 Ships leaving the table

> *"This is usually considered a retreat from the battle unless using the moving table rules (section
> 16.4) or fighting an orbital scenario (section 17.8)."*

**Optional re-entry rule.** *"roll 1 die: on a roll of 1, 2, or 3; the ship may not return to play
during the game. A roll of 4, 5, or 6 indicates the ship may re-enter the table after the equivalent
number of turns have elapsed (e.g. 5 turns if a 5 is rolled). Ships will always re-enter play from
the same side of the playing area as they left, though the actual point of entry is up to the player."*

| Roll | Effect |
| --- | --- |
| 1–3 | gone for the rest of the game |
| 4–6 | absent for that many complete game turns, then may re-enter from the same side |

"After the equivalent number of turns have elapsed" is read as *missing exactly that many turns*: a
ship that leaves during turn 3 and rolls a 5 is absent for turns 4–8 and may re-enter on turn 9.

## 3.10 Vector movement

Out of scope — 3.10 points at section 12, which `SOURCES.md` records as not implemented.

---

## What this module does not implement

| Rule | Why |
| --- | --- |
| Thrust-0 manoeuvring (3.2) | resolved in section 16, which is not in the text extract |
| Moving table (16.4), orbital scenarios (17.8) | sections 16 and 17 are not in the text extract |
| FTL exit from the table (3.9 → section 11) | section 11 is not in the text extract |
| Vector movement (3.10 → 12.12) | not in the text extract |
| Terrain and asteroid collisions (3.8 → section 17) | not in the text extract |
