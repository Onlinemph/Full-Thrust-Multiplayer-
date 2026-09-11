# Factions

Sources: *Factions of the Continuum: A Campaign Supplement* (thirteen factions) and *Faction
Sourcebook: The Askvarian Hegemony* (a fourteenth, with four sub-factions). Both are the user's
own campaign material and both are written against *Project Continuum*'s construction and combat
rules, so every trait below maps onto something the engine already models.

A faction trait is one of four kinds, and `src/data/factions.ts` types them that way:

- **design** — changes what may be built, or what it costs in mass or points.
- **tactical** — changes a roll or a rule during a battle.
- **campaign** — changes RU income, repair cost or research.
- **prohibition** — forbids a system outright.

Prohibitions and design traits are enforced by `shipBuilder.validate()`. Tactical traits are read
by the engine at the point of the roll they modify.

---

## Goliath Corporate Hegemony — attrition brawler

Flying bricks: shell armour and kinetic guns, no finesse.

| Kind | Rule |
| --- | --- |
| design | **Industrial Durability** — +10% of total mass in extra hull boxes (round up), added to the final row of the damage track |
| tactical | **Close-Quarters Dominance** — once a turn, nominate one K-Gun system; firing it at 12 MU or less, re-roll any or all missed dice |
| campaign | **Masters of the Forge** — armour, shell armour and regenerative armour cost 40% less RU to build and to repair |
| prohibition | Advanced Fire Control |
| prohibition | Stealth hull, stealth fields, holofields, cloaking devices |

Starting tech: K-Guns (AP), shell armour, standard FireCon, standard FTL.

## Aethelgard Ascendancy — glass cannon

Spinal mounts and the single perfect strike.

| Kind | Rule |
| --- | --- |
| design | **Spinal Weapon Virtuosos** — spinal mounts cost 10% fewer points; exempt from the no-manoeuvre-after-firing restriction |
| tactical | **Superior Targeting Solutions** — +1 DRM on direct-fire hit rolls beyond 24 MU |
| campaign | **Monumental Construction** — capital ships (mass 91+) cost 10% less RU |
| design | **Glory is Fleeting** — every ship has Flawed Design, with no points discount; a threshold hit on that icon causes a reactor breach without destroying the ship |
| prohibition | Any Class-1 weapon except PDS |

Starting tech: beam spinal mount, class-3 beams, standard screens, Advanced Fire Control.

## Chytrid Mycelium — carrier swarm

Grown, not built. Fighters without end.

| Kind | Rule |
| --- | --- |
| tactical | **Living Carriers** — hangar bays re-arm two groups a turn; a 1 on re-arming costs one extra turn rather than failing; launch one extra group a turn beyond the launch facilities |
| tactical | **Symbiotic Swarms** — standard fighters get +1 DRM in dogfights against other fighters |
| campaign | **Rapid Gestation** — after each battle roll D3; that many wholly destroyed friendly fighter groups return at full strength, free |
| design | **Hive Ship Vulnerability** — hull boxes must be in five rows, with no points reduction for the weaker layout |
| prohibition | Direct-fire weapons of class 3 or higher; any spinal mount |

Starting tech: regenerative armour, hangar bays, standard fighters, interceptors.

## Silent Sisterhood of Veil — surgical strike

Small, fast, cloaked, and aimed at one system at a time.

| Kind | Rule |
| --- | --- |
| tactical | **Ghost in the Machine** — needle beams destroy the targeted system on 5 or 6; any hit (4+) also does 1 hull damage bypassing armour and screens |
| tactical | **Phase-Shift Disengagement** — once a battle, leave the table at the end of the damage control phase and re-enter from any table edge at the start of a later movement phase. Not available with enemy boarders aboard |
| campaign | **Veil of Secrets** — 1 Intelligence Point a turn: auto-succeed one espionage roll, or force an opponent to reveal one ship's full current SSD at the start of a battle |
| design | **Fragile Vessels** — no ship above mass 110; hulls must be Fragile (10%) or Weak (20%) |
| tactical | **Power Hungry Systems** — activating a cloaking device drops thrust by 2 (minimum 1) for the duration |

Starting tech: Tuffley cloak, needle beams, ECM, advanced FTL.

## Durani Star-Khanate — raider

Salvaged, stolen, jury-rigged, and faster than it has any right to be.

| Kind | Rule |
| --- | --- |
| tactical | **Jury-Rigged Power** — emergency thrust twice per ship per battle with no damage roll; later uses roll as normal |
| tactical | **"Heavy" Salvo** — once a battle, a salvo missile launcher fires a heavy salvo: each hit does 1d6+1 instead of 1d6 |
| campaign | **Expert Scavengers** — after any battle, pick one destroyed enemy ship and gain 50% of its base RU cost |
| tactical | **Unreliable Systems** — +1 DRM on every system's roll at the second and every later threshold check of a battle. The first check is normal |
| prohibition | Advanced screens, advanced drives, any spinal mount |
| campaign | **Technological Patchwork** — Strong or Super hulls cost 10% more RU |

Starting tech: salvo missile launchers, pulse torpedoes, standard armour, standard FTL.

## Void-Corsairs of the Crimson Axis — boarding and capture

A destroyed ship is a wasted opportunity.

| Kind | Rule |
| --- | --- |
| tactical | **Terrifying Reputation** — attacking marines +1 DRM; defending damage control parties −1 DRM |
| tactical | **Crippling Strikes** — EMP projector hits may affect any core system (bridge, life support, power core), bypassing the normal targeting restrictions |
| campaign | **Prize Crews** — a ship captured by boarding joins the fleet for the next battle for 25% of its base RU cost, keeping its damage |
| campaign | **Poorly Maintained Ships** — repairs cost 25% more RU |
| design | **No Heavy Metal** — no ship above mass 110 |

Starting tech: transporter beams, boarding torpedoes, EMP projectors, assault shuttles.

## Cygnan Assembly — battlefield control

Gravity and fields, never projectiles.

| Kind | Rule |
| --- | --- |
| tactical | **Gravitic Mastery** — gravitic gun damage per hit +1 at every target speed band |
| design | gravitic gun mass cost −1 (minimum 1) |
| tactical | **Holographic Superiority** — attackers against a holofielded Cygnan ship suffer the range penalty even inside 6 MU, and −1 DRM on top |
| campaign | **Predictive Algorithms** — once a battle, roll D3; force the opponent to pre-plot and reveal that many ships' first turn of movement before writing your own |
| prohibition | Emergency thrust |
| prohibition | Any physical projectile: K-guns, pulse torpedoes, MKP, all missiles, rockets and mines |

Starting tech: gravitic guns, holofield, advanced screens, advanced drives.

## Sol-Federation Marine Corps — combined arms

Gunboats where other navies use fighters.

| Kind | Rule |
| --- | --- |
| design | **Combined Arms Doctrine** — gunboat squadrons get the Heavy/Screened modification free, and +1 CEF (7 total) |
| tactical | **Area Denial Specialists** — ADFC and Advanced ADFC support allied ships out to 12 MU instead of 6 |
| campaign | **Expeditionary Logistics** — battle damage repairs cost 50% fewer RU |
| prohibition | Hangar bays — gunboat racks only |
| prohibition | Reflex fields, cloaking devices, holofields, gravitic guns, spinal mount nova cannon |

Starting tech: gunboat racks, beam gunboats, ADFC, pulsers.

## South African Mercantile Confederation — militarised traders

Q-ships behind a networked escort screen.

| Kind | Rule |
| --- | --- |
| design | **Deceptive Hulls** — cruisers (40–90) and capitals (91+) mount one cargo hold free (0 mass, 0 points) |
| tactical | class-1 beams inflict 1 damage on 4, 5 *or* 6 inside 6 MU, ignoring the screen reduction |
| tactical | **Superior Convoy Defense** — ADS and ADFC support allies out to 9 MU instead of 6 |
| campaign | **Mercantile Network** — +20% RU on top of anything else earned, after every battle |
| design | **Specialized Hulls** — non-carrier cruisers and capitals may mount at most two PDS |
| design | **Freighter Hulls** — capitals (91+) have thrust permanently −1 (minimum 1) |

Starting tech: cargo hold, class-1 beams, salvo missile launchers, ADFC.

## Izotrope Technocracy — energy specialist

A mobile power plant wrapped around a weapon.

| Kind | Rule |
| --- | --- |
| tactical | **Plasma Overcharge** — once a turn, one plasma cannon or plasma bolt launcher fires as one class higher, with no burnout risk |
| design | **Efficient Power Distribution** — up to three screen levels with three or more generators. Level 3: a 6 does 1 damage and grants no re-roll. Screen generators cost 10% fewer points |
| campaign | **Energy Research Focus** — +2 tech tier points a turn, spendable only on direct-fire energy weapons or screens |
| tactical | **Volatile Cores** — every ship suffers a reactor breach when destroyed, whatever the cause |
| prohibition | K-guns, MKP, all missiles — any physical projectile |

Starting tech: plasma cannons, plasma bolt launchers, advanced screens, fusion arrays.

## Shard-Swarm — drone swarm

A rogue self-replicating AI. Escorts are ammunition.

| Kind | Rule |
| --- | --- |
| tactical | **Expendable Drones** — escorts (mass ≤ 44) are robot-crewed and auto-pass morale. On destruction roll D6; a 6 causes a reactor breach |
| tactical | **Networked Targeting** — for every two friendly ships firing at the same target this phase, both gain +1 DRM |
| campaign | **Automated Foundries** — escorts (mass ≤ 44) cost 40% less RU |
| tactical | **Centralized Command** — once every Nexus ship (mass ≥ 60) is destroyed, all remaining escorts take a permanent −1 DRM for the rest of the battle |
| prohibition | Manned fighters and gunboats — robot fighters only |
| design | 0 damage control parties, no in-combat repair. Robot fighter groups may defend against boarders as one marine unit each |

Starting tech: robot fighters, fighter racks, gatling batteries, standard beams.

## Tyrant Star Hegemony — missile artillery

Win before the fleets meet.

| Kind | Rule |
| --- | --- |
| tactical | **Advanced Targeting Protocols** — one AFC launches missiles from two launchers in the same phase; salvo and heavy missile maximum range +6 MU |
| tactical | **Overwhelming Salvos** — +1 to the D6 that decides how many missiles of a salvo are on target |
| campaign | **Ordnance-Focused Industry** — SMLs, SMRs and magazine reloads cost 40% less RU |
| prohibition | Direct-fire weapons of class 3 or higher |
| prohibition | Area Defense Systems |

Starting tech: salvo missile launchers, ER missiles, Advanced Fire Control, standard FTL.

## Xxcha Archonate — defensive fortress

The shell endures.

| Kind | Rule |
| --- | --- |
| tactical | **Fortress Doctrine** — capitals (91+) with ADS fire it to 24 MU instead of 12 |
| tactical | **Resilient Carapace** — regenerative armour repairs on 4, 5 or 6 instead of 5 or 6 |
| design | regenerative armour mass cost −10% |
| campaign | **Patient Diplomacy** — +10% RU each turn, and one free re-roll on any campaign die roll |
| design | **Deliberate Movement** — thrust permanently −1 (minimum 1) |
| prohibition | Advanced drives; any spinal mount |

Starting tech: regenerative armour, ADS, standard beams, standard FTL.

---

## Askvarian Hegemony — the rust cannon

A flotilla society of freed slaves, fast and unreliable. Alone among these factions it has
sub-factions: a ship is assigned to one Clan and takes exactly one Clan trait.

| Kind | Rule |
| --- | --- |
| tactical | **Trust in Rust** — roll one fewer die when checking for emergency-thrust drive damage. A check that would be 1 die becomes automatic |
| design | **Jury-Rigged Ingenuity** — may always take Flawed Design (+10% mass), carrying its −1 DRM on all threshold checks |
| tactical | **Fractured Doctrine** — Advanced Fire Control takes a permanent −1 DRM on targeting; every FireCon, standard or advanced, is knocked out on a threshold roll of 4, 5 or 6 regardless of which threshold it is |
| campaign | **The Vherokior Principle** — reverse engineering and stolen tech cost 75% less; scrapping returns 50% of a ship's RU cost |
| campaign | **The Scattered Peoples** — each capital or carrier not in a system with a friendly unsieged colony generates 100 RP a turn |
| campaign | **Clannish Politics** — enemy counter-espionage +10% success; Specific Targeting research +20% RP |

### Clans

**Brutor — by axe and by breach.** One free marine boarding party per 50 mass (round up), outside
the crew complement limit; assault shuttles and transporter beams at 25% off both mass and points.
May not install salvo missiles or ADS.

**Sebiestor — field-rigged and fleet-footed.** Main drive mass is calculated as though the thrust
rating were one lower (points are paid in full for the real rating); +1 on damage control repair
rolls for regenerative armour and defensive screens. Must install at least one level of screens.

**Vherokior — there's always a price.** ECM and Area ECM at half mass (points unchanged); −2 points
per 10 mass of cargo, capped at 10% of the ship's total cost. Must use Fragile or Weak hulls.

**Krusual — shrapnel and shadows.** K-guns (all classes) and SMLs at −1 mass each (minimum 1);
salvo missile loads cost 1.5 mass instead of 2; flak ammunition free on class-2 and larger K-guns.
May not mount beam, graser or phaser weapons.

---

## A note on balance

These are the user's own campaign documents rather than published Continuum material, and several
traits are strong — the Goliath hull bonus and the Izotrope level-3 screen both change the maths
the points model is calibrated against. They are implemented as written and every one of them is a
toggle, so a game can be played with faction traits off entirely.
