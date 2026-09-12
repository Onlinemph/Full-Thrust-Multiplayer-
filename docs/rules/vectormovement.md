# The Vector Movement System — section 12.12

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, section 12.12, quoted from
`continuum-rulebook-part2.txt` lines 601–712 (pages 99–103). 12.12 is itself an *"Excerpt from
Fleet Book 1"*. Cross-references to 3.2–3.6 (the cinematic thrust budget), 4.2 (fire arcs), 4.11
and 10.1 (drive damage), 12.11 (knocked off course), 16.2 (rolling) and 17.6 (collisions) are named
where 12.12 leans on them or overrides them.

Implementation: `src/engine/vectormovement.ts`. Tests: `src/engine/vectormovement.test.ts`.

Readings taken where the text admits more than one are marked **[reading]** and numbered; each says
what was rejected and why.

---

## What this is, and what it is not

> "This is a completely OPTIONAL alternative movement system, which players may use instead of the
> standard FT movement rules described in the basic rulebook."

It is an *alternative*, not a modifier. Nothing in `movement.ts` changes; a scenario picks one
model or the other, and 12.12 explicitly allows both at once:

> "It is perfectly possible to mix both vector and cinematic movement in the same game, to
> represent ships with different drive systems or technology levels - each ship simply follows the
> relevant rules according to its own drive system."

The one thing that does *not* change is the ship:

> "Because the Thrust Ratings of ships are used in similar ways in both systems, any given ship
> design may be used with either movement system without modification - the only thing to be aware
> of is that ships with low thrust ratings may prove VERY unmanoeuvrable under the vector system."

That last clause is a rule in disguise, and rule 1 below turns on it.

The system's own summary of its feel is worth keeping in view while reading the arithmetic:

> "Radical course changes become much more difficult to do under the vector rules, especially at
> high velocities – remember that the faster you are moving, the less manoeuvrable your ship will
> be under the vector system."

Nothing in 12.12 imposes that; it falls out. A ship at velocity 20 that burns its whole thrust
sideways has bent its course by a few degrees. A ship at velocity 2 has reversed it.

---

## Course and Facing

The whole system is one distinction:

> "Under the standard Cinematic FT movement, a ship will always be facing in the same direction
> that it is moving; under the VECTOR system the ship may be moving one way and facing another. The
> direction in which the ship is actually MOVING is termed its COURSE, while the direction in which
> the ship model is actually pointing is called its FACING."

And the two are stored differently, which is the part that catches implementations out:

> "the FACING of a model should always be one of the 12 'clockface' points, though the mechanics of
> the vector movement mean that the COURSE will usually NOT correspond exactly to a clockface
> direction."

So FACING is `Course` from `types.ts` — the 1–12 clock point the rest of the engine already
speaks. COURSE is a free direction, held in degrees, and it is **not** a `Course`. The two names
collide unhelpfully; `VectorState` calls them `facing` and `course` and the doc comments say which
is which every time.

Velocity is separate again: a scalar, in the "V" box on the order sheet, always a whole number of
MU (see "Measuring the new vector", below).

Fire arcs follow FACING, not COURSE. 4.2 measures arcs off the model's bow and 12.12 moves the bow
independently of the track, so a vector ship can be running away from a target and still have it in
the forward arc. `arcFromVectorShip` exists to make that one line hard to get wrong.

---

## Main Drive Thrust

> "The THRUST RATING of any ship is the amount of thrust that can be produced by its MAIN DRIVE -
> the 'big engine' at the back. Each point of thrust applied in a turn will accelerate the ship by
> 1 inch (or other movement unit) ALONG THE AXIS OF THE SHIP"

> "If the ship's facing and course are NOT the same (i.e.: the model is pointing one way and moving
> another) then the application of thrust from the main drive will alter the ship's course AND
> velocity."

There is no reverse gear:

> "To DECELERATE using the main drive (as opposed to using the forward 'retro' thrusters), the ship
> must be turned so that it is pointing 'backwards' relative to its current course."

Notation and quantity:

> "Main Drive thrust is written as MD followed by the number of thrust points being applied - so MD4
> will move the ship 4" in the direction of its present facing. If using existing ship designs
> (whether from this book, from FT2 or elsewhere) then the thrust level shown in the ship's drive
> icon is the rating used for the main drive."

One thrust point is one MU, along the facing, always forward. A negative MD is not an order.

---

## Manoeuvring Thrusters

> "In addition to the main drive, all ships have THRUSTERS - small drives positioned in clusters
> around the ship, pointing forward, port, starboard etc. (in reality ships would also of course
> have 'up' and 'down' orientated thrusters, but as we are not concerned with 3D movement in FT we
> can ignore these except for their use in rolling the ship)."

> "The power available to the ship's thrusters is equal to half the thrust rating of the main drive
> - so a ship with a main drive TR of 6 would have 3 manoeuvre points available from its thrusters;
> unlike the Cinematic movement rules, thruster use is allowed in addition to applying full
> available thrust with the main drive - so that a ship with a Thrust Rating of 4 could apply 2
> points of thruster use and still use all 4 thrust points from its main drive."

Two pools, not one. This is the sharpest break from section 3, where accelerating and turning come
out of the same rating. A thrust-6 vector ship spends up to 6 on the main drive **and** up to 3 on
thrusters in the same turn — nine points of effect where the cinematic ship has six.

And the drive damage clause:

> "For the purposes of damage, assume that the thrusters are driven by the same power systems as
> the main drives - when the main drive takes damage, thruster power is halved or lost accordingly."

So thruster power is computed off the *current* rating, after 4.11/10.1 have had their way with it:
one 'destroyed' result halves the rating (a rating-1 drive is disabled outright), two disable it.
Halving twice — once for the hit, once for the thrusters — is the intended reading of "halved or
lost accordingly", and it is why a thrust-4 ship that takes one drive hit drops from 2 manoeuvre
points to 1, and a thrust-2 ship drops from 1 to none.

| Current thrust rating | Main drive points | Thruster points |
| --- | --- | --- |
| 0 | 0 | 0 |
| 1 | 1 | **0** |
| 2 | 2 | 1 |
| 3 | 3 | 1 |
| 4 | 4 | 2 |
| 5 | 5 | 2 |
| 6 | 6 | 3 |
| 8 | 8 | 4 |
| 10 | 10 | 5 |

The thrust-1 row is the one to look at twice. Half of 1 rounded down is 0, so a thrust-1 ship under
the vector system **cannot rotate and cannot push at all** — it may only burn 1 MU a turn along a
facing it can never change. That is **[reading] 1**, and 12.12's own warning that "ships with low
thrust ratings may prove VERY unmanoeuvrable under the vector system" is what makes it the right
one.

### [reading] 1 — half the thrust rating rounds down

12.12 gives only even examples (TR 6 → 3, TR 4 → 2) and never says which way an odd rating halves.
Down is chosen. The alternative, rounding up, would give a thrust-3 ship 2 manoeuvre points and a
thrust-1 ship 1 — and a thrust-1 ship that can rotate freely for a point it does not have is not
the ship 12.12 warns about. Down also matches every other halving in the book and the engine: 3.6's
emergency thrust is "50% of the drive's current rating, rounded down", and 4.11's drive halving has
to round down or its own "a drive rated only 1 is immediately disabled" clause would contradict it
(`movement.currentThrust` says the same thing at greater length).

---

## Thruster Pushes

> "A thruster 'push' is firing a combination of maneuver thrusters to alter the course and/or
> velocity of the ship, WITHOUT affecting its actual facing (i.e.: the ship ends the turn with its
> model pointing the same way it started, although its course may have changed). Pushes may be made
> to PORT, STARBOARD or REVERSE (using the forward 'retro' thrusters to slow the ship down without
> having to spin it round and use the main drive). It requires ONE maneuver point of thrust applied
> to displace the ship by one movement unit; a push of 3 with the port-side thrusters will shift the
> ship 3" to starboard (for simplicity of play, this is referred to as a STARBOARD PUSH - to avoid
> confusing of orders we always use the direction of the EFFECT rather than the location of the
> thrusters being used)."

> "Note that a PUSH changes the ship's COURSE (and/or VELOCITY) only, and never its FACING. PUSH
> orders should be written as PP (Push to Port), PS (Push to Starboard) or PR (Push in Reverse),
> again followed by the number of thrust points applied - so PR3 would be using 3 maneuver points
> from the retros to push the ship 3 units 'backwards' relative to its current heading. Pushes may
> only be applied directly to port, starboard or rearward relative to the ship's facing at that
> moment."

Three things a reader gets wrong here:

1. **There is no forward push.** Port, starboard and reverse only. Going faster along the bow is
   the main drive's job, and it is the one direction the thrusters may not send you.
2. **The name is the effect, not the thruster.** PS fires the port-side cluster and moves the ship
   to starboard. The book says so twice because it expects the mistake.
3. **A push is measured off the facing at the moment it is applied** — so a rotation written before
   a push changes where the push goes, and a rotation written after it does not. That is the order
   sequence rule earning its keep.

### [reading] 2 — a reverse push is 180° from the FACING, not from the COURSE

The sentence that introduces PR says "backwards relative to its current heading", and "heading"
appears nowhere else in 12.12 as a defined term. Two paragraphs use "facing" and "course" with
care; this one word is loose. The paragraph's own closing sentence settles it: "Pushes may only be
applied directly to port, starboard or rearward relative to the ship's **facing** at that moment."
Rejected alternative: PR reverses along the course, making it a true brake in every situation. It
is tempting — the gloss "to slow the ship down" reads that way — but the retro thrusters are bolted
to the hull, pointing along its axis, and the whole point of the vector system is that the hull's
axis and the track are different things. When facing and course *are* the same, which is the case
the gloss describes, the two readings agree exactly.

---

## Rotation

> "Rotation of a ship around its axis requires much less power than actually changing its vector.
> When the thrusters are used to rotate a ship onto a new heading, ONE maneuver point from the
> thrusters allows the ship to be rotated by any desired number of facing points. Thus, for the
> expenditure of one point of thruster power a ship can be rotated to face in any of the 12 possible
> facing directions, regardless of the thrust rating of its drives (the only difference between
> rotating 30 degrees and rotating 180 degrees is simply that, once the thrusters have started the
> ship spinning, the ship is allowed to rotate for longer before the thrusters burn again to cancel
> the spin). Note that a ROTATION changes the ship's FACING only, and never its COURSE."

> "ROTATION orders should be written down as TP (Turn Port) or TS (Turn Starboard), followed by the
> number of points of heading change - thus TP2 indicates a rotation to port of 2 clock face points
> (ie: 60 degrees)."

**One point. Any angle.** A 30° turn and a 180° turn cost the same, and cost the same on a thrust-2
ship as on a thrust-10 one. This is the single largest difference from cinematic movement, where a
course change is metered by the drive rating — and it is why a vector ship can spin to fire a
broadside or to put its bow "backwards relative to its current course" and brake with the main
drive, all for one point.

Because the cost is flat, TP7 is legal and identical in price to TP1; it simply lands on the same
facing TS5 would. The engine normalises rotations onto the twelve-point clock and charges one point
either way.

The book's own note on what the point buys:

> "when thrusters are used to rotate the ship onto a new facing, it is assumed that several of the
> ship's thrusters are fired in unison … It is assumed that, in the same turn, a compensating burst
> is applied as the desired new facing is reached in order to stop the ship's rotation - the
> combined effect of these operations constitutes one 'rotation' action."

### [reading] 8 — a zero-point order is not an order

`TP0`, `PS0` and `MD0` cost nothing and do nothing. The alternative — charging the manoeuvre point
because the thrusters fired — reads the rotation as an event rather than a result, but a player who
writes TP0 has written nothing at all, and 12.12 prices the *rotation*, of which there is none.

---

## Combining Manoeuvres

> "If desired, a ship may combine both ROTATION and PUSH uses of its maneuvering thrusters in a
> single game turn, but no more than ONE of each, provided the TOTAL of maneuver points expended
> does not exceed the total available. It is quite acceptable for a ship with (say) 3 maneuver
> points of thruster power available to make a rotation (using up 1 thruster point), then apply a
> main drive burn, then use the remaining 2 maneuver points for a 2" thruster push to port,
> starboard or aft as desired. The final position, course and velocity would be measured after ALL
> maneuvers are completed."

So the legality test on a turn's orders is three separate checks:

| Limit | Value |
| --- | --- |
| Rotations | at most **1** |
| Pushes | at most **1** (a PP and a PS in the same turn is two pushes, not one) |
| Rotation + push points spent | ≤ thruster points available (half the current rating, rounded down) |
| Main drive points spent | ≤ current thrust rating |

The worked example in the quotation is exactly the thrust-6 ship's 3 points: TS1 (1) + PS2 (2) = 3.
A PS3 in its place would be 4 and illegal.

### [reading] 3 — the number of main-drive burns is not capped, only their total

"no more than ONE of each" is scoped by its own sentence to "both ROTATION and PUSH uses of **its
maneuvering thrusters**". The main drive is not a manoeuvring thruster and has no count limit
written anywhere; what it has is a rating, and 12.12 spends the rating a point at a time. So
`MD3, TS3, MD3` is legal on a thrust-6 ship and `MD4, MD3` is not.

Rejected alternative: exactly one MD order per turn, which is what both worked examples happen to
show. It was rejected because the order-sequence rule is emphatic that where a burn falls in the
sequence changes the answer — "plot each one out and you'll see what we mean" — and forbidding a
burn either side of a rotation would remove the most interesting thing that rule can express, on
the strength of two examples that were only ever illustrating something else. The ship gains no
extra thrust either way: the rating is still the ceiling.

---

## Order Sequence

> "The actual sequence in which thruster and main drive burns are applied in a single turn will make
> a difference to the final course and velocity of the ship, so it is necessary to rule on what
> order things are done in. Each effect is applied to the ship strictly IN THE ORDER THEY ARE
> WRITTEN DOWN BY THE PLAYER. If the player writes TP2, MD6 then the ship will first be moved
> according to its starting vector (as always), then turned 2 points to port (TP2) and then moved 6"
> along its new facing (MD6). If, on the other hand, the order is written MD6, TP2 (thus applying
> the main drive burn BEFORE rotating the ship to its new facing) then the result will be VERY
> different in terms of the ship's final vector and position - plot each one out and you'll see what
> we mean!"

Orders are therefore a **list**, not a record. `MovementOrder` in `types.ts` holds a turn, an
acceleration and a flag, which is enough for section 3 because a cinematic turn has a fixed
internal geometry (3.4 splits it half-and-half). It cannot express `MD3, TS3, MD3`. `VectorOrder[]`
is the shape the rule requires, and it is declared in this module because the spine has no home
for it.

**Written notation.** The book writes orders as text — `TP3, MD6` — so `parseVectorOrders` and
`formatVectorOrders` round-trip that notation, case-insensitively, in the order written.

### [reading] 4 — orders that break the budget are flown as no orders at all

12.12 has no penalty clause and no "what if" for an order sheet that spends thrust the ship has
not got. 3.5 does, for the other movement system: *"Any ship with no orders will move straight
ahead at an unchanged speed, as will any that are given impossible orders."* Under the vector
system "straight ahead at an unchanged speed" has an exact meaning — the starting vector applied
with no thrust — so an illegal order list is flown as an empty one, and `moveVector` reports
`legal: false` with the problems alongside the move it actually made.

Rejected alternative: refuse the move and hand the state back untouched, which is what most
functions in this engine do with an impossible request. It is wrong here for one reason: a ship
under vector movement cannot decline to move. Momentum is not an order, and leaving a ship parked
because its order sheet was over budget would put it somewhere the physics does not allow.

---

## Moving Ships Under The Vector System

> "Once the orders are written by all players, all ships are moved simultaneously in accordance with
> their starting vectors and any relevant manoeuvre orders. When moving a particular ship, ALWAYS
> start by moving it according to its starting vector - i.e. move the model in the direction of its
> present COURSE (as indicated by its course marker arrow) a distance equal to its current VELOCITY,
> being very careful to keep the FACING of the model exactly the same as at the start of the turn;
> at this stage, LEAVE THE COURSE MARKER IN ITS STARTING POSITION. Now apply any thrust (main drive
> and/or thrusters) indicated in the ship's orders, making sure to apply each effect in the sequence
> it is written down. Where the model ends up after all thrust has been applied is its finishing
> position for that turn; now place the tape measure or rule between the course marker and the
> ship's final position, and read off the distance - this (rounded to the nearest whole inch or
> other movement unit) is the ship's final VELOCITY for the turn"

> "Finally, move the course marker up to the stand of the model again, with its arrow pointing in
> the direction of the ship's new COURSE - i.e.: parallel to the tape-measure. The ship's VECTOR at
> the start of the next turn will now be in the direction of the course marker arrow, at the new
> velocity written down."

The procedure, as the engine runs it:

1. Move from the start position along the **current course** by the **current velocity**. Facing
   unchanged. This leg always happens, orders or none — momentum is not optional.
2. Apply each order in the written sequence. `MD`*n* displaces *n* MU along the current facing;
   `PP`/`PS`/`PR`*n* displaces *n* MU 90° to port, 90° to starboard or 180° from the current facing;
   `TP`/`TS`*n* changes the facing and moves nothing.
3. The finishing position is where the model ended.
4. New velocity = the straight-line distance from the **start** position to the finishing position,
   rounded to the nearest whole MU.
5. New course = the direction of that same straight line.

Steps 4 and 5 are where the system does its quiet work: the velocity is *re-measured*, not
accumulated, and the intermediate positions are thrown away.

**Simultaneity.** "all ships are moved simultaneously" — there is no initiative ordering inside the
vector move, unlike the cinematic phase 5. `moveVectorFleet` maps every ship independently off its
own starting state for exactly that reason: no ship can see where another one ended up.

### Measuring the new vector

### [reading] 5 — velocity rounds half away from zero

"rounded to the nearest whole inch" leaves 6.5 undecided. Half-up is chosen, being the ordinary
reading of "nearest" at a table and what a player with a tape measure does. The alternative,
banker's rounding to even, is more even-handed over a long game but is not what anyone does with a
ruler. It matters more than it looks: the rounding is applied every turn to the *whole* velocity,
so a ship can gain or shed up to half an MU a turn for free. That is the system's own approximation
and 12.12 accepts it — "even doing it this way is an oversimplification of the true mechanics - but
we feel it is close enough for game purposes!"

### [reading] 7 — a ship that ends where it began keeps its old course

If the finishing position is the starting position, the velocity is 0 and the tape measure has no
direction to be parallel to. The course marker stays pointing where it was. The alternative — a
null course — would have to be re-invented the instant the ship burns again, and on the table the
arrow does not vanish. The stored course is inert while velocity is 0, so nothing depends on the
choice until the ship moves.

Note the near case, which is not a reading: a displacement of 0.4 MU rounds to velocity 0 but *does*
have a direction, so the course marker turns to it. The ship then sits still on a course it is not
travelling — correct, and harmless, since velocity 0 moves nothing.

---

## Worked examples

Both are the book's own figures, with the table put on screen coordinates: the ship starts at the
origin, course 12 is "up" (−y) and course 3 is to the right (+x), which is `geometry.ts`'s
convention.

**Figure 1** — "facing in the same direction it is moving … its current velocity is 10 … The player
writes movement orders of TP3, MD6."

| Step | Facing | Position |
| --- | --- | --- |
| A (start) | 12 | (0, 0) |
| B — starting vector, 10 MU on course 12 | 12 | (0, −10) |
| C — TP3, rotate 3 points (90°) to port | **9** | (0, −10) |
| D — MD6, 6 MU along the new facing | 9 | (−6, −10) |

> "Finally, the distance between starting and finishing positions (A and D) is measured - rounded to
> the nearest whole number it will be 12"

√(6² + 10²) = 11.66 → **velocity 12**, and the new course is 329.0°, which is not a clock point —
the book's "the COURSE will usually NOT correspond exactly to a clockface direction", demonstrated
by its own first example.

**Figure 2** — "facing in the same direction it is moving, and its current velocity is 6 … The
player writes movement orders of PS2."

| Step | Facing | Position |
| --- | --- | --- |
| A (start) | 12 | (0, 0) |
| B — starting vector, 6 MU on course 12 | 12 | (0, −6) |
| C — PS2, 2 MU to starboard of the facing, facing unchanged | 12 | (2, −6) |

> "rounded to the nearest whole number it will be 6"

√(2² + 6²) = 6.32 → **velocity 6**. Two manoeuvre points bought a 18.4° change of course and no
change of speed at all. Both figures are asserted in the tests, because they are the only two
numbers in the section the book computes for us.

**The order-sequence contrast**, from the same starting state as Figure 1 with TP2 instead of TP3:

| Orders | Final position | Final facing | New velocity |
| --- | --- | --- | --- |
| `TP2, MD6` | (−5.20, −13.00) | 10 | 14 |
| `MD6, TP2` | (0, −16) | 10 | 16 |

Same orders, same points, same final facing — and the two finishing positions are exactly 6 MU
apart, which is the length of the burn itself, since the two order sheets differ only in whether
that 6 MU leg is rotated 60° before or after it is flown. "plot each one out and you'll see what
we mean."

---

## Collisions

> "If there are any objects on the board that are deemed big enough to pose a collision risk, such
> as asteroids or very large space installations, such a risk will only occur if the line between
> the ship's STARTING and FINAL positions intersects with the object. In effect, it is this line (as
> shown by the tape or rule when measuring the final velocity of the ship) that most nearly
> approximates the 'true' path followed by the ship during the turn - the position of the ship model
> at any other time during the movement sequence is merely for calculation purposes and does NOT
> indicate that the ship actually occupies that point at any time. Of course, even doing it this way
> is an oversimplification of the true mechanics - but we feel it is close enough for game purposes!"

**The chord, not the track.** This is the one place where 12.12 overrides another section outright.
17.6 tests "its path during the Ship Movement Phase", and `terrain.ts` reads that as the whole
polyline including both legs of a 3.4 turn (its own [reading] 9). Under the vector system the
polyline is explicitly a calculation aid that the ship never occupied, so the test is the single
straight segment from the start position to the finishing position. The consequences run both ways
and the tests assert both:

- a rock sitting on the first leg of a dogleg, which the model visibly passed through, is **not** a
  collision if the chord misses it;
- a rock sitting in the open water inside the dogleg, which the model never went near, **is** a
  collision if the chord crosses it.

### [reading] 6 — a collision body is a disc

"intersects with the object" leaves the object's shape to whatever is on the table. A radius is
modelled, because a radius is the only shape section 17 ever measures against either — 17.1 puts an
asteroid's base at "1 to 6 MU across" and blocks a line that "crosses any part of the asteroid's
base". A disc keeps 12.12 and 17.6 measuring the same thing.

### [reading] 9 — the chord test reports risk; 17.6 resolves it

12.12 says when a collision risk *occurs* and stops. What happens next — the avoidance number off
velocity and thrust, the roll, the crash — is 17.6, which `terrain.ts` already implements as
`collisionAvoidanceTarget` and `resolveCollision`. So `vectorCollisions` returns the bodies at risk
and nothing else, in the same spirit as every damage-dealing function in this engine reporting what
the dice did rather than applying it. The alternative, resolving the collision here, would put a
second copy of 17.6's table in the repository. `resolveCollision` wants the ship's velocity and
thrust rating, both of which the caller has.

---

## Not implemented, and why

| Rule | Why |
| --- | --- |
| Emergency thrust (3.6) under vector | 12.12 never mentions it. The vector budget is already the rating *plus* half of it again in thrusters; bolting 3.6's further 50% and its exploding-drive dice onto that would be inventing a number, and 3.6 is written against a single combined thrust pot that the vector system does not have. |
| Rolling the ship (16.2) | 12.12 mentions the up/down thrusters only to say they exist "except for their use in rolling the ship", and then says nothing more — not whether a roll costs a manoeuvre point, not whether it competes with the one-rotation limit. The roll itself is 16.2 and lives in `specialmoves.ts`. |
| Knocked off course under vector (12.11) | Already implemented. 12.11's vector clause — two threshold checks, the first knocking the facing 30° and the second moving "the vector marker (but not the mini) 30 degrees" — is `terrain.resolveKnockedOffCourse`, which takes an optional `heading`. It is 12.11's rule, not 12.12's, and duplicating it here would give the engine two. |
| Squadron and formation movement (3.7) | 12.12 says nothing about squadrons. 3.7's line-ahead formation is built on a shared course and a shared turn allowance, neither of which survives the split between course and facing, and inventing a vector version is a design, not a reading. |
| Leaving the table (3.9) and the moving table (16.4) | Neither is restated in 12.12, and both are written in terms of a position and a heading that this module reports unchanged. The integrator can apply them to `VectorMoveResult.end`. |
| Fighters, gunboats, missiles and mines under vector | 12.12 is written about ships, and sections 6, 8 and 9 move small craft without reference to course or facing at all — a fighter group simply moves up to 24 MU in any direction. Nothing in 12.12 says a vector game changes that, so nothing here does. |
| Three dimensions | "as we are not concerned with 3D movement in FT we can ignore these". |
| Collision *resolution* | 17.6, and `terrain.ts` has it. See [reading] 9. |
| A flag saying which system a ship uses | "each ship simply follows the relevant rules according to its own drive system" — but there is no field on `ShipDesign` or `DriveDef` to hold that, and adding one is the integrator's call. Reported as a spine gap rather than invented here. |
| Writing orders face down and revealing them | Sequence-of-play plumbing (2.6 phase 1), the same for both movement systems. |
