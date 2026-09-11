# Flight operations — fighters (section 8)

Source: *Full Thrust: Project Continuum* v1.1.4, April 2017, section 8 (pages 65–78), quoted from
`continuum-rulebook-extract.txt` lines 1909–2268. Cross-references to 1.7 (dice), 4.5–4.9 (the beam
table), 5.5 (Plasma Cannon), 5.13 (Needle Beams), 5.17 (MKP), 6.4 (point defence vs. missiles),
7.12–7.15 (PDS/ADS/Scattergun/Grapeshot) are quoted where a fighter rule delegates to them.

Implementation: `src/engine/fighters.ts`. Tests: `src/engine/fighters.test.ts`.

Where the text admits more than one reading, the reading taken is marked **[reading]** and the
reason given. Nothing below is invented: every number is quoted or derived from a quoted number.

---

## 0. The group

> "Fighters operate in groups of 1 to 6 craft, with each group moving and firing as a single unit."
> (8, intro)

> "The endurance limit is six Combat Endurance Factors (CEF) per standard fighter group." (8, intro)

| Property | Value | Rule |
| --- | --- | --- |
| Full strength | 6 fighters (8 for Light) | 8 intro, 8.15 Light |
| Combat Endurance Factors | 6 (9 Long Range, 4 Light) | 8 intro, 8.15 |
| Main move | 24 MU (36 Fast) | 8.5, 8.15 Fast |
| Secondary move | 12 MU (12 even for Fast) | 8.5, 8.15 Fast |
| Attack range | 6 MU, front 180° | 8.7 |
| Facing | tracked, need not match the direction of movement | 8.5 |

---

## 8.1 Launch and recovery

- Fighter groups may be launched in any turn.
- **The carrier may not use the main drive at all on a launch turn**: "A ship that is launching
  fighters cannot use the main drive to perform any velocity, course, or facing changes, so you
  need only write 'Launch' as the movement order for that turn."
- Recovery is the same: "The carrier must move at a constant course and velocity for that turn.
  The fighter group moves into contact with the carrier in the Fighter Movement Phase."
- "Launching fighters move before all others in that game turn." (Enforced by `game.ts`'s phase-4
  activation order, not here.)
- The launching group may immediately screen, attack fighters or ships, or take any normal action.
- **"Move distance on the launch turn is only half normal"** — 12 MU for a standard group, 18 MU
  for a Fast group. (Halving is of the group's own maximum, so a Fast group halves 36.)
- Capacity: "All carriers are allowed to launch (or recover) as many groups per turn as they have
  operational launch tube/flight decks."
- "Launching and recovery operations may both be performed by one ship in the same turn if desired,
  provided each hangar bay is only used by a single fighter group." **[reading]** One facility use
  = one group launched *or* one group recovered; launch and recovery draw on the same pool of
  operational tubes. The proviso is about *bays*, not tubes, so it is a data constraint on the SSD
  rather than a per-turn check, and is not modelled.

## 8.2 Launch tubes / flight decks

- "A single launch tube may serve multiple hangar bays."
- **"if the ship applied thrust that turn it may not launch any fighters unless the tube/flight deck
  has been upgraded with catapults"**.

So the launch gate is: `launchFacilities > facilitiesUsed` AND (`!carrierUsedThrust` OR `catapults`).

## 8.3 Scrambling

Permitted **only** when "the opponent has just moved one or more fighter groups into position to
attack the carrier itself", and "this is the only time that fighter launches may take place when
they have not been pre-planned". "Also the ship may not 'scramble' any fighters if it applied
thrust." Roll 1 D6:

| Roll | Outcome |
| --- | --- |
| 1 | "the hasty launch attempt causes a mishap in the launch tube – one complete fighter bay (and its occupying fighters) is out of action for the rest of the game, unless a Damage Control Party can repair the damage" |
| 2–3 | "no groups may be launched this turn" |
| 4 | "one group gets away but too late to intercept the attackers – the enemy group(s) may fire on the carrier BEFORE the scrambled group may attack them" |
| 5 | "one group scrambles in time to intercept – it may engage an attacking group in a dogfight to prevent them firing on the carrier" |
| 6 | "TWO groups manage to scramble in time to intercept the attackers" |

The 6 result is capped by the carrier's normal launch capacity: "this is only possible for ships
which have the ability to launch two or more groups in a turn – other ships that can launch only one
group per turn under the normal rules can only 'scramble' one group at a time."

On a 4, the sequencing is explicit: "the attackers may press home their assault on the carrier,
AFTER which the scrambled group may (in the same turn) immediately engage them in a dogfight, which
is resolved as per normal rules, despite the fact that the attacking fighters have already 'fired'
once that turn."

**Scrambling while re-arming:** "If the scrambling fighters are in the process of rearming they
launch with only half the fuel load and with none of their reloadable ordnance. For example a
standard fighter group would launch with 3 CEF and a Long Range Fighter group would launch with 4
CEF." 9 / 2 = 4.5 and the book says 4, so **half fuel rounds down**. A Light group (4 CEF) launches
with 2. "None of their reloadable ordnance" removes the one-shot payloads (Pulse Torpedoes, MKPs,
fighter missiles).

## 8.4 Combat landings

- Normal recovery is capped at "the number of launching and landing facilities".
- A combat landing recovers **all** of the carrier's fighters in one turn.
- Price: "The carrier may not launch any recovered fighters for the rest of the game."
- "Any critical hit on hangar bays adds +1 to the rolls for collateral damage … after the recovery."
  (Hangar-bay critical hits are 10.2, outside this module; the +1 is reported for the threshold
  module to consume.)
- "Ships that applied thrust may not conduct Combat Landings."
- "A ship that launches or recovers fighters cannot use an ADFC (section 7) in that turn." — applies
  to *any* launch or recovery, combat landing or not.

## 8.5 Movement

- Fighter movement happens "after both players have written their ship movement orders, but before
  the ships are actually moved" (phase 4).
- "a fighter group can move any distance up to the maximum allowed and in any direction, without
  needing to write orders or record course and velocity."
- "A fighter group does have a facing, which need not be the same as the course or direction of
  movement."
- Maximum move: **24 MU**, "but there are exceptions depending on the fighter type or
  modifications".
- Alternation: "Players alternate in moving one fighter group each until all have been moved (if
  desired), with the player who won initiative for this turn moving second."
- **Secondary move (phase 6):** "up to 12 MU … in any direction up to the maximum 12 MU, even if the
  group moved its full distance in the first Fighter Movement Phase. Any fighter group that makes
  this secondary move immediately expends 1 CEF."
- "it may not be taken if the group has already been engaged in a dogfight by another group."
- "Whoever moved first in the main Fighter Movement Phase must also move first in the Secondary Move
  Phase."

**Worked example (figure 18):** a standard group moves 20 MU in phase 4, ships then move, the
intended target has changed course, and the group may spend 1 CEF on a secondary move to follow the
original target or attack a different one — "if A chooses to move the fighter group then 1 turns
worth of combat endurance for the group must be marked off."

## 8.6 Screens and pursuits

### Screening

- "the fighter group must remain adjacent to the ship it is escorting at all times. If it is moved
  further away, then it has broken off from its escorting duties".
- "A fighter screen … always moves at the same time as the ship it is screening, rather than being
  moved in the first Fighter Movement Phase. Screening fighters can exceed the normal fighter
  movement allowance if the ship they are screening is moving faster than the fighters could
  normally move."
- Fighters may screen other fighter groups. "Fighter cannot screen fighters which are they
  themselves screening." (no mutual screening).
- "Whenever a ship or group that is being escorted by a fighter screen comes under attack from enemy
  fighters, the attacking group(s) must engage the screening fighters using the dogfighting rules
  instead of attacking the ship … Each group of screening fighters must be engaged by at least one
  attacking fighter group, but once this condition has been satisfied any further uncommitted
  attacking groups may fire on the escorted ship."

**Worked example:** 3 screening groups, 4 attacking groups → three must pair off against the three
screens, the fourth is free to attack the ship. (Or all four may be thrown at the screens.)

### Pursuit

"A fighter group that attacked an enemy ship or an enemy screening fighter group last turn can
declare it is pursuing the ship. Like a screening group, the pursuing fighters move with the ship
being pursued in the Ship Movement Phase even if the distance is greater than the fighter group
normal move."

### Ship fire against fighter groups

- Only groups "that are not engaged (dog fighting other fighters or attacking a ship for example)"
  may be fired at.
- "the fighter group must be in range and firing arc and each fighter group targeted requires a
  separate FireCon."
- **"Ship to ship weapons roll 1D6 only against fighter groups, regardless of range band or normal
  damage inflicted. A roll of 6 kills one fighter, no re-roll."**

**Worked example:** a destroyer 9 MU away fires two Beam-2s at a group. Each Beam-2 would normally
roll 2D6 at that range, but against fighters it is always 1D6. Rolls 4 and 6 → one fighter killed.

### Evading

- Declared "After a player has announced fire against a fighter group but before actually rolling
  the dice", costs 1 CEF.
- "Choosing to evade automatically negates the attack against the fighter group **and any further
  ship weapon fire in that turn**. Evading does not cancel any casualties already inflicted."
- "If a player announces ship fire against an already evading fighter group and hence would
  automatically miss, the player must be told and can switch targets."
- **"Point defense fire cannot be evaded."**

**Worked example (continued):** later in the same phase the battleship announces ten beams at the
group; the group spends 1 CEF and evades; "The ship weapons automatically miss (and cannot be fired
against another target)". The earlier destroyer kill stands.

## 8.7 Target selection

> "After fighter movement and secondary moves a fighter group may declare an attack against any
> ship, missile marker, or other fighter group within **6 MU** and within its **front 180° arc**.
> All fighters in the group must engage the same target."

- "Fighters attacking other fighters are dogfighting; fighters declaring attacks against ships (or
  starbases, etc.) are making an attack run."
- "Any fighters attacking or being attacked are **engaged**."
- "Attacks are not resolved until after point defense fire."

The front 180° arc is the three forward 60° arcs of 4.2 taken from the group's facing: `FP`, `F`,
`FS`.

Exception: Missile Fighters launch their one-shot salvo at up to 12 MU (8.15).

## 8.8 Point defence against fighters

### Allocation

- "Each Point Defense System (PDS), ADS, Scattergun, Grapeshot, etc. on a ship may fire once per
  turn, either as an anti-fighter or antimissile defense weapon."
- "The defender allocates all point defense fire against missile and fighter attacks before
  resolving any."
- "Ships without ADFC systems may only target fighters (or missiles) attacking them directly."
- "Ships with ADFC or AADFC … may provide area defense in support of one other ship per ADFC
  carried, dividing their point defense among ships as desired."
- **"In either case, the fighter group targeted must not be engaged by other fighters."**
- "Ships with ADFC may also target unengaged fighter groups within 6 MU. Each group targeted
  requires one ADFC."
- "Class 1 Beams may be allocated for point defense of the ship itself however if they do so they
  may not fire in the Ship Fire Phase. Beam-1s may not be used for area defense."

**Worked example:** ship A is attacked by group X at 2 MU. Group Y could have attacked ship B but
did not; Z is far away. B has PDS + ADFC, A has PDS only. A engages X with its own PDS. B may engage
X (X is >6 MU from B but is attacking a ship inside B's 6 MU ADFC umbrella) *or* Y (within 6 MU). Z
is safe.

### Dice

| Weapon | Roll | Rule |
| --- | --- | --- |
| PDS | "rolls a D6 and kills one fighter on 4 or 5. A 6 kills two fighters and re-roll the die." | 8.8 |
| Beam-1 | "rolls a D6 and kills one fighter on 5 or 6, with a re-roll on 6." | 8.8 |
| Grapeshot | "rolls four D6 with results as for PDS." | 8.8, 7.15 |
| ADS | "fires like a PDS. It can fire once to a range of 12 MU, or twice to a range of 6 MU." | 7.13 |
| Scattergun | "1d6 hits on fighters …, 1d3 hits on Heavy Fighters"; d6+1 on Light Fighters | 7.14, 8.15 |

"'Wasted' shots when point defense fire kills more fighters than are in the group may not be
reallocated to other groups." → kills are capped at the group's remaining strength.

## 8.9 Fighter combat — attack runs

> "For each group attacking a ship, roll 1D6 per remaining fighter in the group. Hits and damage are
> scored per die using the same procedure as Beam-1 weapon fire (section 4): Fighters that use beams
> are affected by screens, and re-roll for penetrating damage on a 6. Fighters that use cannon
> ignore Standard Screens, and do not re-roll on a die roll of 6."

So the per-die table is the beam table of 4.5/4.7, one die per surviving fighter:

| Screens | 1–3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- |
| none | 0 | 1 | 1 | 2 + re-roll |
| level 1 | 0 | 0 | 1 | 2 + re-roll |
| level 2 | 0 | 0 | 1 | 1 + re-roll |

Re-roll damage is penetrating: it ignores screens and armour (4.6, 4.9). The re-roll test is on the
**natural** face (4.6), and per 1.7 "In situations where a re-roll is allowed … the DRM will not
normally be applied to the re-roll as well."

- Rear arc: "fighters can attack ships from the rear arc, but like missiles gain no advantage from
  doing so as it is assumed that they must avoid being melted by the drive."
- Interception mid-run: "If a fighter group making an attack run is engaged by other fighters, the
  fighters attacking the ship have the choice of either breaking off the attack and engaging in a
  dogfight, or continuing the attack. In the latter case, the 'intercepting' fighter group fires as
  if in a dogfight, and the survivors carry out the attack against the ship." — note this is
  *one-sided*: the group pressing on does not return fire.
- **[reading]** "Fighters that use cannon ignore Standard Screens". Against *Advanced* screens (7.3)
  the screen level is applied, because 8.9 names Standard screens specifically and 8.15's looser
  "ignore the effects of screens" is the summary of the same sentence.
- **[reading]** The cannon's loss of the re-roll follows the fighter's dice wherever they are BD*,
  **dogfights included**, because 8.15 states it as a property of the armament ("Cannon lose the
  reroll of beams, but ignore screens") and not of the target. 8.10 states the dogfight table in its
  default beam form. The trade is coherent: cannon buy screen-blindness against ships and pay for it
  against fighters.
- **[reading]** The beam/cannon choice is the *purchase option* 8.15 offers the types listed with
  both armaments — Standard, Interceptor, Attack, Torpedo, MKP, Missile, Multi-Role. It is not every
  weapon the book calls a cannon: 8.15 says a Graser Fighter's "secondary cannon … inflict only BD*
  hits with a -2 DRM", re-roll included, so Graser, Plasma and Assault Shuttle secondaries keep the
  star.
- **[reading]** A group that already attacked this turn pays no further endurance for a second
  attack in the same turn — 8.13 charges "1 CEF each turn it engages in combat", not one per shot.
  This is what makes 8.9's "survivors carry out the attack against the ship" after being intercepted
  cost one factor rather than two.
- **[reading]** Graser and Plasma fighters, which "drain 2 points of combat endurance", must have
  the full two available; a group on one factor cannot fire.

## 8.10 Dogfights

> "All fire between fighter groups in a dogfight is considered simultaneous. Roll 1D6 per fighter
> and inflict casualties as for Beam-1 fire against an unscreened target: 4 or 5 kills one fighter,
> 6 kills two fighters and re-roll."

This is `beamDamage(face, 0)` read as kills, which is why the engine rolls dogfights with
`rollBeamVolley(strength, 0, …)` and adds the normal and penetrating halves together.

- Refusing a dogfight: "If one player moves a group into base contact with an enemy group, and the
  opponent does not wish to engage in the dogfight, the enemy group may move away **provided it has
  not already moved that turn**. If it does not have a higher speed (maximum move) the attacking
  group gets a free round of attack rolls before contact is broken."
- "Ships may not fire into a dogfight: The fast action and sensor interference risks too many
  'friendly fire' casualties."

**Worked example:** A moves 5 fighters into contact with an enemy group of 4 that has already moved,
so B cannot evade. A rolls 5 dice: **2, 2, 6, 4, 1** and a re-roll of **3** → **three kills** (one
with the 4, two with the 6). B rolls 4 dice — "combat in dogfights is simultaneous, so all four
fighters get to engage even though three have been hit" — scoring **3, 1, 5, 5** → **two kills**.
A is left with 3, B with 1.

## 8.11 Multiple-group dogfights ("furballs")

> "all groups engaged in the dogfight may fire only once per turn, but may choose to attack just one
> enemy group or to split their kills between two or more. If the player chooses to split fire, the
> dice are rolled as normal and the casualties then divided as equally as possible between the
> relevant groups."

Note the split is of **kills**, not of dice: roll the whole group's dice once, then divide the
resulting casualties. "As equally as possible" leaves the remainder's destination to the player; the
engine gives remainders to the earlier-listed targets so the result is deterministic.

**[reading]** A single roll can carry only one defensive modifier, and a split may aim at groups
with different ones (a Heavy group at −1 beside a plain one at 0). The rule offers no tie-break, so
the engine takes the *most protective* of the declared targets — the lowest DRM — since the dice are
one burst fired into a mixed formation.

## 8.12 Interception of missiles

> "A fighter group may attempt to intercept and engage any missile or salvo that is within 6 MU and
> front 180° arc of it at the end of either the fighter's main or secondary movement. Simply move
> the group up to the missile marker."

- "Attack or Torpedo Fighters cannot intercept missiles; neither can any fighter group that has
  exhausted its combat endurance."
- Dice are 6.4's: **against a Salvo Missile**, "Each Beam-1 or fighter rolls a D6, killing one
  missile on a roll of 5 or 6, with a re-roll on 6." **Against a Heavy Missile**, "Each Beam-1 or
  fighter rolls a D6 and kills the missile on a roll of 6."
- "Note that fighters get one roll each in screening groups, so a full strength group will roll 6
  dice."
- **Casualties from interception:** "For each Salvo Missile or Heavy Missile killed by a fighter
  roll an additional D6: on a roll of 6 the fighter is destroyed as well."
- Overkill: "If defensive fire killed more missiles than were in the salvo then the extras are
  'overkill'; they cannot be allocated to other salvos or Heavy Missiles." (6.4)

## 8.13 Combat Endurance Factor

> "A group will use up 1 CEF each turn it engages in combat, whether attacking a ship, another
> fighter group, or missiles. A fighter group also uses 1 CEF every time it makes a secondary move
> or evade. Normal movement during the first Fighter Movement Phase does not consume combat
> endurance factors."

| Action | CEF | Rule |
| --- | --- | --- |
| Attack a ship / fighter group / missiles | 1 per turn | 8.13 |
| Secondary move | 1 | 8.5, 8.13 |
| Evade ship fire | 1 | 8.6, 8.13 |
| Fire a fighter Graser | 2 | 8.15 Graser |
| Fire a fighter Plasma Cannon | 2 | 8.15 Plasma |
| Launch Pulse Torpedoes | 1 | 8.15 Torpedo |
| Launch fighter missiles | 1 | 8.15 Missile |
| FTL Fighters deploying instead of launching | 1 | 8.15 FTL |
| Main (phase 4) move | 0 | 8.13 |

Exhausted:

> "When all combat endurance is exhausted, the group may still move normally (though it may make no
> secondary moves) but may not make any attacks. There is no time limit on a group returning to its
> carrier after exhausting its CEF. A group that is engaged in a dogfight by an enemy group after
> exhausting its CEF may return fire, but only scores one kill on rolls of 6."

The exhausted return-fire table is therefore its own table — 6 → 1 kill, no re-roll — not a DRM on
the normal one.

## 8.14 Specialized types

- "All fighter groups, regardless of type, have the same mass and hangar space requirements in the
  carrier or mother ship, and operate under all the normal rules for launching, recovery, and turn
  sequence."
- "Fighter types must be specified before the battle begins in one-off games."
- "Some fighter 'systems' here are actually modifications applied to any fighter type. These will be
  listed as (+Mod)."

## 8.15 Fighter types

`BD*` = beam die with penetrating re-roll on a natural 6 (4.6). `BD` = the same table without the
re-roll. Points are per fighter / per wing of six unless noted.

### Base types

| Type | Anti-ship | Anti-fighter / ordnance | CEF to fire | Points | Notes |
| --- | --- | --- | --- | --- | --- |
| **Standard** | BD\* (beams) or BD ignoring screens (cannon) | BD\*, "equivalent of … a PDS against fighters/ordnance" | 1 | 3 / 18 | "the most balanced option" |
| **Interceptor** | BD\* at **−2 DRM** | BD\* at **+1 DRM** | 1 | 3 / 18 | beams or cannon |
| **Attack** | BD\* at **+1 DRM** | BD\* at **−2 DRM** | 1 | 4 / 24 | beams or cannon; cannot intercept missiles (8.12) |
| **Torpedo** | secondary beams BD\* at **−2 DRM** | BD\* at **−2 DRM** | 1 | 6 / 36 | 1-shot Pulse Torpedo below; cannot intercept missiles (8.12) |
| **Graser** | 6 BD\* hits, each hit **1d3 damage, SAP** | secondary cannon BD\* at **−2 DRM** | **2** (Graser) | 7 / 42 | |
| **Plasma** | **1d6−2 − screens/DRM hits**, re-roll on a 6 | BD\* at **−2 DRM** | **2** (Plasma) | 7 / 42 | see the plasma reading below |
| **MKP** | secondary BD\* at **−2 DRM** | BD\* at **−2 DRM** | 1 | 6 / 36 | 1-shot MKPs below |
| **Missile** | secondary BD\* at **−2 DRM**, 6 MU | BD\* at **−2 DRM** | 1 | 4 / 24 | 1-shot salvo at 12 MU below |
| **Multi-Role** | as Standard, Interceptor or Attack, chosen at re-arm | ditto | 1 | 5 / 30 | beams or cannon at re-arm |
| **Light** | as its role type, but **8 per group** | ditto | 1 | same per wing as the role (18 standard, 24 attack …) | 4 CEF; +1 DRM to every attack against them |
| **Assault Shuttle** | boarding run (below) | secondary weapons at **−2 DRM** | 1 | **6 per wing** | one-use |

Standard fighter firepower, quoted: "Against ships a full strength fighter wing (6 fighters)
inflicts 6 BD\* hits. Against other fighters or missiles, they inflict 6 BD\* hits (equivalent of a
Beam-1 against ships, and a PDS against fighters/ordnance)."

Attack Fighter, quoted worked case: "If firing on an unscreened target ship they would inflict one
damage point with rolls of 3 or 4, and two damage points with 5 or 6." — which is the beam table
under +1, confirming that the DRM shifts the face read on the table, and that the re-roll still
keys on the natural 6.

**Plasma Fighter dice**, and the one place 8.15 and 5.5 do not quite say the same thing. 5.5 reads
"on a roll of 3 it inflicts 1 hit, on a 4 it inflicts 2 hits, on a 5 it inflicts 3 hits, and on a 6
it inflicts 4 hits, penetrates, and gets a reroll!", while 8.15 describes the fighter weapon as
"1d6-2 - screens/DRM hits with rerolls on a 6" and never mentions penetration. **[reading]** The
fighter version follows 8.15 — its own section wins — so hits are `max(0, die − 2 − screens)`, the
die's own hits are ordinary damage, and only the re-roll penetrates, exactly as a beam's does (4.6).
The re-roll is scored unscreened and unmodified (1.7).

| Die | Hits, unscreened |
| --- | --- |
| 1–2 | 0 |
| 3 | 1 |
| 4 | 2 |
| 5 | 3 |
| 6 | 4, plus a penetrating re-roll |

### One-shot payloads

**Pulse Torpedoes (Torpedo Fighter).** "The Pulse Torpedoes may also be launched for 1 point of
endurance. These have a range 6 MU, like other fighter weapons. The Pulse Torpedoes hit on a 4+, and
do damage equal to their die roll. So a roll of a '5' would both hit and inflict 5 points of damage.
As these are Pulse Torpedoes, they ignore screens and inflict Semi-Armor Piercing damage." One
torpedo per surviving fighter. "The Pulse Torpedoes may only be fired once, and they must all be
fired on the same turn, and at the same target. The Torpedo Fighters secondary beam weapons cannot
be fired the same turn as the Pulse Torpedoes are launched."

**MKPs (MKP Fighter).** "They have a range of 6 MU, and inflict damage just like a ship-mounted MKP
(1 hit on 4+, 2 hits on a 6, and each hit inflicts 4 points of AP damage)." One MKP per surviving
fighter, one turn, one target; "These fighters cannon fire their secondary weapons and the MKPs in
the same turn."

**Fighter missiles (Missile Fighter).** Fire control extended "from 6 MU to 12 MU"; the group "must
approach within 12 MU of an enemy ship before it can provide enough tracking data to safely launch
its missiles. It also must not be engaged by other fighters at time of launch." Launched in phase 3.
"Launching the missiles consumes one Combat Endurance Factor (CEF)." The group carries one Salvo
Missile salvo of one missile per fighter. **Lock-on: "To determine how many missiles lock on to the
target ship roll a D6 and subtract 1 for each fighter that was destroyed prior to launch."**
**[reading]** "destroyed prior to launch" is read as the fighters missing from the group (full
strength minus current strength), because that is the number a player can read straight off the
counter; the result is also capped at the salvo size, since a salvo cannot land more missiles than
it fired.
Light Missile Fighters "must mount a light missile instead. The light missile is more easily
destroyed, and so all PDS or fighter attacks against light missiles are at +1 to the die roll."

**Assault Shuttle boarding run.** "They may dock or breach enemy hulls in the same manner as fighters
attacking ships … Standard Screens will not stop this attack but Advanced Screens will. The shuttles
are fired upon by PDS as normal with the survivors may attempt to 'land' one Boarding Party (DCP) or
Marine by rolling a 3+. (Marines get a +1 DRM). Failed rolls results in a casualty either from
automated defenses, bad timing or some other mishap." Boarding itself resolves under 12.7.
"Assault Shuttles cost 6 points per wing. Marines or DCPs must be purchased separately."

### Modifiers (+Mod) — these stack onto a base type, they are not types in their own right

| Modifier | Effect | Cost |
| --- | --- | --- |
| **Heavy** | "Point defense weapons, including other fighters, suffer a −1 DRM when engaging Heavy Fighters. Scatterpacks and Interceptor Pods do 1d3 hits, not 1d6." | +3 / +18 |
| **Fast** | "The base move of a Fast Fighter is increased from 24 MU to 36 MU. Fast Fighters may also may a secondary endurance move, but like normal fighters the range of this move is limited to 12 MU." | +1 / +6 |
| **Long Range** | "The fighter has 9 points of combat endurance, not the normal 6. This modification can only be applied once." | +1 / +6 |
| **FTL** | "FTL Fighters may begin the game deployed within 6 MU of their carrier instead of having to be launched … However, 1 point of endurance will be checked off". | +1 per fighter |
| **Robot** | secondary move taken "at the end of the end of phase 4 after all fighters and missiles have made their moves … Robot Fighters cannot react to ship movement"; immune to fighter morale (8.17); will blindly follow an escorted ship into a planet or hyper wall. | **−1** / **−6** |
| **Light** | 8 fighters per group, 4 CEF, +1 DRM to every attack against them; "Scatterguns and Interceptor Pods kill d6+1 Light Fighters". Compatible with Fast, Interceptor, Attack and Missile only: "Heavy, Torpedo, and Long Range options are not available for Light Fighters." | group costs the same per wing as the role type |

The Heavy modification's −1 does **not** apply to full-strength anti-ship weapons used defensively:
"Heavy anti-ship weapons used in defensive fire (beams, K-1) have only their normal −1 DRM, as while
the minor strengthening of the heavy fighter might protect against the light fire of a PDS mount, it
does little against a full strength anti-ship weapon." **[reading]** Taken to mean: the Heavy −1
applies to PDS, ADS, Scatterguns, Grapeshot and other fighters, but not to Beam-1/K-Gun-1 in point
defence mode (already on the harsher 5–6 table) nor to Ship Fire Phase fire under 8.6. The same
sentence is why a Heavy group is not immune to the 8.6 "6 kills one fighter" ship-fire roll.

Pre-built combinations the book prices directly, and the arithmetic they confirm:

| Named type | = base + modifier | Book price | Check |
| --- | --- | --- | --- |
| Fast standard | Standard + Fast | 4 / 24 | 3 + 1 = 4 ✔ |
| Long Range standard | Standard + Long Range | 4 / 24 | 3 + 1 = 4 ✔ |
| Standard Robot | Standard + Robot | 2 / 12 | 3 − 1 = 2 ✔ |

Light Fighter defensive table, quoted in full because it pins down how the +1 interacts with the
re-roll: "normal fighters attack Light Fighters like Interceptors attack normal fighters (1-2, no
kills; 3-4, 1 kill; 5, 2 kills; 6, 2 kills and a re-roll)". A natural 5 becomes a modified 6 and
scores 2 kills but **no** re-roll — confirming 4.6's rule that the re-roll keys on the natural face.

## 8.16 Re-arming

> "When a fighter group is recovered by its carrier, roll 1 D6."

| Roll | Result |
| --- | --- |
| 1 | "the group may not be re-launched in this game (severe damage to returning fighters, crew fatigue, etc.)" |
| 2–5 | "the group will be patched up, refueled, and rearmed after 1 full turn, so it may launch in the second turn after recovery" |
| 6 | "the group makes a crash turnaround and may launch on the turn immediately following that of recovery" |

Recovered in turn *T*: on 2–5 it may launch in turn *T+2*, on a 6 in turn *T+1*.

"If depleted groups are combined to make full strength groups, roll for each partial group and the
worst case result applies to the entire new group."

## 8.17 Fighter morale (optional, off by default)

> "The rules for fighter morale are not used."

If switched on: "Any fighter group that has lost one or more members must roll a D6 before making an
attack. If the roll is less than or equal to the number of fighters remaining in the group, the
attack is carried out; if greater than the number of remaining fighters, they abort this attack and
do not fire. Any group that fails an attack roll is not considered to have expended combat endurance
for that turn."

"Robot Fighters are always immune to the morale rules." (Kra'Vak fighters use Ro'Kah rules from
Fleet Book 2, which is not one of this project's sources.)

## 8.18 Fighter pilot quality — Aces and Turkeys (optional)

Assignment: "a random roll is made for each fighter group in a fleet at the start of the game or
campaign: if a 6 is rolled, the group contains an Ace; a roll of 1 indicates the group is a Turkey
group. Rolls of 2 – 5 give normal, average groups."

**Ace:**

- "the group gets ONE EXTRA DIE during all normal attacks – so a full strength group of six fighters
  including an Ace would roll SEVEN dice instead of the usual 6".
- Or, once per turn, a specific system attack: "the Ace may choose to attack as a Needle Beam instead
  of his normal attack – in this case he may choose to target ONE SPECIFIC SYSTEM on the ship being
  attacked, rolling just ONE die and treating the attack as a Needle Beam shot. Note that in this
  case the rest of the group does NOT get the 'extra' die". The quoted arithmetic: "a group with five
  fighters including an Ace could choose to either attack normally with SIX dice, or to have the four
  average pilots attack normally (4 dice) while the Ace attacks a specific system with just ONE die
  roll." So: normal = `strength + 1` dice; ace-special = `strength − 1` normal dice + 1 needle die.
- Needle Beam die (5.13): "On a roll of 4+ they inflict a single point of damage. On a roll of a
  natural 6 they inflict a single point of damage, and destroy the targeted system." Needle Beams
  are "not affected by screens", and "Systems destroyed by Needle Beam fired cannot be repaired by
  Damage Control Parties."
- In dogfights: "an Ace may either add an extra die to the group's overall attack, OR may choose to
  specifically target an opposing Ace if there is one present in the other group – in this case he
  rolls just one die as normal."
- Survivability: "in normal losses the ACE in a group will always be the LAST fighter left surviving
  … The only case in which an Ace may be killed before other members of the group is if he is
  specifically targeted by an opposing Ace in an enemy group."

**Turkey:** "Turkey groups attack target ships as normal (such attacks are largely computerized
anyway), but when they are engaged in a dogfight with other fighters or try to intercept missiles,
PPTs etc., they modify their attack rolls with a −1 DRM from every die roll they make."

---

## What `game.ts` calls, and in which phase

| Phase (2.6) | Function in `fighters.ts` |
| --- | --- |
| 3 Launch | `canLaunch`, `launchFighterGroup`, `deployFtlFighters` (8.15 FTL), `launchFighterMissiles` (8.15 Missile) |
| 3 Launch, out of sequence | `scrambleFighters` (8.3) |
| 4 Move fighters | `mainMoveAllowance`, `moveFighterGroup`, `assignScreen`, `declarePursuit`; `takesSecondaryMoveInPhaseFour` for Robot groups (8.15) |
| 5 Move ships | `moveWithEscortedShip`, `screenHasBrokenOff` (8.6) |
| 6 Secondary moves | `secondaryMoveAllowance`, `secondaryMoveFighterGroup` (8.5) |
| 7 Allocate attacks | `canDeclareAttack`, `assignScreenEngagements` (8.6, 8.7) |
| 8 Fighters vs fighters and missiles | `resolveDogfight`, `resolveMultiGroupDogfight`, `refuseDogfight`, `interceptMissiles`, `aceDuel` |
| 9 Point defence | `pointDefenceAgainstFighters` (8.8) |
| 10 Ordnance and fighters vs ships | `resolveAttackRun`, `resolveInterceptedAttackRun`, `launchPulseTorpedoes`, `launchFighterMkps`, `resolveBoardingRun`, `aceNeedleAttack` |
| 11 Ships fire | `shipFireAtFighters`, `evadeShipFire` (8.6) |
| any | `recoverFighterGroup`, `combatLanding`, `rollRearm`, `worstRearm`, `reconfigureMultiRole`, `adfcLockedOut` |
| turn boundary | `beginFighterTurn` |
| setup | `createFighterGroup`, `fighterProfile`, `validateFighterBuild`, `rollPilotQuality` |
| optional | `fighterMoraleCheck` (8.17), the Ace/Turkey functions (8.18) |

## Rules referenced but owned elsewhere

| Rule | Where it lives |
| --- | --- |
| Phase order and the alternation of fighter activations (2.6, 8.5) | `game.ts` |
| ADFC / AADFC area-defence umbrellas (7.10, 7.11) | `defences.ts` |
| Salvo and Heavy Missile flight, lock-on and damage (6) | `ordnance.ts` |
| Applying fighter damage to screens, armour and hull (4.8, 4.9) | `combat.ts` |
| Hangar-bay critical hits (10.2) and Damage Control repair (10.4) | `threshold.ts` |
| Boarding resolution once a shuttle lands its party (12.7) | `threshold.ts` / boarding |
| Gunboats (9) | out of this module's scope |

## Known divergence from the spine

`dice.ts`'s `rollBeamVolley` applies its `drm` to re-rolls as well. 1.7 says "In situations where a
re-roll is allowed (such as after a penetrating hit with a beam weapon), the DRM will not normally be
applied to the re-roll as well." `fighters.ts` therefore calls `rollBeamVolley` directly for the
unmodified case (where the two agree exactly, die for die on the same seed) and uses its own roller
when a fighter DRM is in play, so that Interceptor/Attack/Turkey/Heavy/Light modifiers follow 1.7.
