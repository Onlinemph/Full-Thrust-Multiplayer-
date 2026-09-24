/**
 * Stargrunt II — Chapter 25's sample forces (pp. 67–69), as unit templates,
 * and the helpers that turn one into a `UnitSetup`/`SideSetup` with ids,
 * names, quality and leadership. Chapter 25 is "data, not new rules" (spec
 * 02 §7): every mechanic it exercises is already the generic weapons table
 * (`./weapons`), so this file is just the book's four organisations typed
 * up as data.
 *
 * Round 1 has no vehicles and no guided-missile fire (`fire.ts`'s round-3
 * extension points), so this file keeps to each nation's line-infantry
 * Platoon Command Unit and Infantry Squads — the Power-Armour platoons,
 * Company-level units and vehicles chapter 25 also describes are left out
 * rather than half-modelled against kit this contract has no field for
 * (see the per-nation notes below and the report).
 */

import type { ArmourKind, CommandLevel, Confidence, FigureSetup, Leadership, MobilityKind, Motivation, Quality, SideId, SideSetup, SmallArmKind, SupportWeaponKind, UnitSetup } from '../types'

export interface FigureTemplate {
  name: string
  smallArm: SmallArmKind
  /** A support weapon this trooper crews, in addition to their small arm. */
  supportWeapon?: SupportWeaponKind
  leader?: boolean
}

export interface UnitTemplate {
  name: string
  commandLevel: CommandLevel
  figures: readonly FigureTemplate[]
}

export interface ForceTemplate {
  nation: string
  /** Where chapter 25 prints this force. */
  page: string
  armour: ArmourKind
  mobility: MobilityKind
  platoonCommand: UnitTemplate
  /** The standard infantry squad, repeated `squadCount` times per platoon. */
  squad: UnitTemplate
  squadCount: number
}

// ---------------------------------------------------------------------------
// New Anglian Confederation — Royal Marine Assault Force (p. 67)
// ---------------------------------------------------------------------------

/**
 * The Infantry Platoon (p. 67): Platoon Command Unit (Commander, Sergeant,
 * an L5 SAW gunner, five troopers) plus three 8-man Infantry Squads (Squad
 * Leader, SAW gunner, a special-weapon trooper, five line troopers).
 * L7A3/L41 are Advanced Assault Rifles with GL (FP3/D10, p. 67–68), L5 is a
 * Conventional MG (SAW) (D8/D10) — both exact matches to the generic table
 * (spec 02 §7.1). The squad's special weapon is "GMS/P or PPG(I) Plasma
 * Gun" (p. 67): this engine has no GMS/P support-weapon kind (guided
 * missiles are round 3), so it takes the book's own printed alternative,
 * the L20A1 Plasma Gun (D6/D12, an exact match too).
 */
export const NAC: ForceTemplate = {
  nation: 'New Anglian Confederation',
  page: 'p. 67',
  armour: 'partial-light',
  mobility: 'foot',
  platoonCommand: {
    name: 'Platoon Command Unit',
    commandLevel: 'platoon',
    figures: [
      { name: 'Platoon Commander', smallArm: 'advanced-rifle-gl', leader: true },
      { name: 'Platoon Sergeant', smallArm: 'advanced-rifle-gl' },
      { name: 'SAW gunner (L5)', smallArm: 'advanced-rifle-gl', supportWeapon: 'saw' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
    ],
  },
  squad: {
    name: 'Infantry Squad',
    commandLevel: 'squad',
    figures: [
      { name: 'Squad Leader', smallArm: 'advanced-rifle-gl', leader: true },
      { name: 'SAW gunner (L5)', smallArm: 'advanced-rifle-gl', supportWeapon: 'saw' },
      { name: 'Special Weapons trooper (L20A1 Plasma Gun)', smallArm: 'advanced-rifle-gl', supportWeapon: 'plasma-gun' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
    ],
  },
  squadCount: 3,
}

// ---------------------------------------------------------------------------
// Neu Swabian League — Panzergrenadier Platoon (p. 68)
// ---------------------------------------------------------------------------

/**
 * Platoon Command Unit (Commander, Sergeant, an MG66 SAW gunner, three
 * troopers) plus three 6-man Infantry Squads (Squad Leader, SAW gunner, a
 * special-weapon trooper, three line troopers). SG58 is an Advanced
 * Assault Rifle with GL (FP3/D10, exact match); the squad's special weapon
 * takes the book's own "SK51 Plasma Gun" alternative to its GMS/P, an exact
 * match to the generic Plasma Gun (D6/D12). MG66 is printed as a D8
 * firepower / D12 impact "Rotary Action Machine Gun" (p. 68) — none of the
 * three generic SAW kinds carry that exact pair (Conventional D8/D10,
 * Rotary D10/D10, Gauss D10/D12); this engine files it under the
 * Conventional SAW kind (matching its D8 firepower die exactly) rather
 * than invent a fourth SAW kind outside the read-only contract's
 * `SupportWeaponKind` union — its Impact is one step gentler here (D10)
 * than the book's own D12 line for this specific named weapon (flagged in
 * the report, spec 03's own test-case 18 makes the same kind of call for
 * ESU's VK20).
 */
export const NSL: ForceTemplate = {
  nation: 'Neu Swabian League',
  page: 'p. 68',
  armour: 'full-light',
  mobility: 'foot',
  platoonCommand: {
    name: 'Platoon Command Unit',
    commandLevel: 'platoon',
    figures: [
      { name: 'Platoon Commander', smallArm: 'advanced-rifle-gl', leader: true },
      { name: 'Platoon Sergeant', smallArm: 'advanced-rifle-gl' },
      { name: 'SAW gunner (MG66)', smallArm: 'advanced-rifle-gl', supportWeapon: 'saw' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
    ],
  },
  squad: {
    name: 'Infantry Squad',
    commandLevel: 'squad',
    figures: [
      { name: 'Squad Leader', smallArm: 'advanced-rifle-gl', leader: true },
      { name: 'SAW gunner (MG66)', smallArm: 'advanced-rifle-gl', supportWeapon: 'saw' },
      { name: 'Special Weapons trooper (SK51 Plasma Gun)', smallArm: 'advanced-rifle-gl', supportWeapon: 'plasma-gun' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
      { name: 'Trooper', smallArm: 'advanced-rifle-gl' },
    ],
  },
  squadCount: 3,
}

// ---------------------------------------------------------------------------
// Eurasian Solar Union — Naval Infantry Heavy Platoon (p. 69)
// ---------------------------------------------------------------------------

/**
 * Platoon Command Unit (Ensign, Senior NCO, an RK80 SAW gunner, five
 * troopers) plus three 8-man Infantry Squads (Squad Leader, SAW gunner,
 * five riflemen, one special-weapon trooper). KI-72 is an Advanced Assault
 * Rifle without a GL (FP2/D10, exact match); RK80 is a "Light Machine Gun
 * (Gyromount)" at D8/D10 (exact match to the generic Conventional MG SAW).
 * Two of the platoon's three squads carry an AT-17 "Sandbox" GMS/P as
 * their special weapon and the third fields a Sniper instead (p. 69);
 * neither a guided-missile support weapon nor a sniper's weapon profile
 * exists in this contract (both round-3/chapter-11 concerns), so this
 * template's squad folds that trooper back into an ordinary rifleman,
 * named for the record.
 */
export const ESU: ForceTemplate = {
  nation: 'Eurasian Solar Union',
  page: 'p. 69',
  armour: 'partial-light',
  mobility: 'foot',
  platoonCommand: {
    name: 'Platoon Command Unit',
    commandLevel: 'platoon',
    figures: [
      { name: 'Platoon Commander (Ensign)', smallArm: 'advanced-rifle', leader: true },
      { name: 'Platoon Senior NCO', smallArm: 'advanced-rifle' },
      { name: 'SAW gunner (RK80)', smallArm: 'advanced-rifle', supportWeapon: 'saw' },
      { name: 'Trooper', smallArm: 'advanced-rifle' },
      { name: 'Trooper', smallArm: 'advanced-rifle' },
      { name: 'Trooper', smallArm: 'advanced-rifle' },
      { name: 'Trooper', smallArm: 'advanced-rifle' },
      { name: 'Trooper', smallArm: 'advanced-rifle' },
    ],
  },
  squad: {
    name: 'Infantry Squad',
    commandLevel: 'squad',
    figures: [
      { name: 'Squad Leader', smallArm: 'advanced-rifle', leader: true },
      { name: 'SAW gunner (RK80)', smallArm: 'advanced-rifle', supportWeapon: 'saw' },
      { name: 'Special Weapons trooper (AT-17 "Sandbox" GMS/P — round 3, not modelled)', smallArm: 'advanced-rifle' },
      { name: 'Rifleman', smallArm: 'advanced-rifle' },
      { name: 'Rifleman', smallArm: 'advanced-rifle' },
      { name: 'Rifleman', smallArm: 'advanced-rifle' },
      { name: 'Rifleman', smallArm: 'advanced-rifle' },
      { name: 'Rifleman', smallArm: 'advanced-rifle' },
    ],
  },
  squadCount: 3,
}

// ---------------------------------------------------------------------------
// Federal Stats Europa — Colonial Legion Platoon (p. 69)
// ---------------------------------------------------------------------------

/**
 * "Federal Stats Europa" is the book's own printed name (p. 69), not a
 * transcription slip; kept as printed. Platoon Command Unit (Commander,
 * Senior Sergeant, an FM-77 SAW gunner, five legionnaires) plus FOUR
 * 8-man Infantry Squads (Squad Leader, SAW gunner, five line legionnaires,
 * one Mistral-5 GMS/P trooper) — one more squad than the other three
 * nations, per the book's own text. FA-75 is a Gauss Assault Rifle without
 * a GL (FP2/D12, exact match); FM-77 is a Gauss Machine Gun (D10/D12,
 * exact match to the generic Gauss SAW). Every squad's special weapon is a
 * Mistral-5 GMS/P with no printed alternative, so — as for ESU above — that
 * trooper is folded back into an ordinary legionnaire.
 */
export const FSE: ForceTemplate = {
  nation: 'Federal Stats Europa',
  page: 'p. 69',
  armour: 'partial-light',
  mobility: 'foot',
  platoonCommand: {
    name: 'Platoon Command Unit',
    commandLevel: 'platoon',
    figures: [
      { name: 'Platoon Commander', smallArm: 'gauss-rifle', leader: true },
      { name: 'Platoon Senior Sergeant', smallArm: 'gauss-rifle' },
      { name: 'SAW gunner (FM-77)', smallArm: 'gauss-rifle', supportWeapon: 'gauss-saw' },
      { name: 'Legionnaire', smallArm: 'gauss-rifle' },
      { name: 'Legionnaire', smallArm: 'gauss-rifle' },
      { name: 'Legionnaire', smallArm: 'gauss-rifle' },
      { name: 'Legionnaire', smallArm: 'gauss-rifle' },
      { name: 'Legionnaire', smallArm: 'gauss-rifle' },
    ],
  },
  squad: {
    name: 'Infantry Squad',
    commandLevel: 'squad',
    figures: [
      { name: 'Squad Leader', smallArm: 'gauss-rifle', leader: true },
      { name: 'SAW gunner (FM-77)', smallArm: 'gauss-rifle', supportWeapon: 'gauss-saw' },
      { name: 'Legionnaire', smallArm: 'gauss-rifle' },
      { name: 'Legionnaire', smallArm: 'gauss-rifle' },
      { name: 'Legionnaire', smallArm: 'gauss-rifle' },
      { name: 'Legionnaire', smallArm: 'gauss-rifle' },
      { name: 'Legionnaire', smallArm: 'gauss-rifle' },
      { name: 'Legionnaire (Mistral-5 GMS/P — round 3, not modelled)', smallArm: 'gauss-rifle' },
    ],
  },
  squadCount: 4,
}

export const FORCES: readonly ForceTemplate[] = [NAC, NSL, ESU, FSE]

// ---------------------------------------------------------------------------
// Building UnitSetup/SideSetup from a template
// ---------------------------------------------------------------------------

function unitFromTemplate(template: UnitTemplate, force: ForceTemplate, id: string, quality: Quality, leadership: Leadership, commanderId: string | null, confidence: Confidence | undefined): UnitSetup {
  const figures: FigureSetup[] = template.figures.map((figure, i) => ({
    id: `${id}-f${i + 1}`,
    name: figure.name,
    smallArm: figure.smallArm,
    supportWeapon: figure.supportWeapon,
    leader: figure.leader ?? false,
  }))
  return {
    id,
    name: template.name,
    quality,
    leadership,
    confidence,
    armour: force.armour,
    mobility: force.mobility,
    commandLevel: template.commandLevel,
    commanderId: commanderId ?? undefined,
    figures,
  }
}

export interface PlatoonOptions {
  quality: Quality
  hqLeadership: Leadership
  squadLeadership: Leadership
  confidence?: Confidence
}

/**
 * A standard platoon (Platoon Command Unit plus its infantry squads) built
 * from a chapter 25 template for one side, with fresh ids and the given
 * quality/leadership — chapter 3's own scenario-build tooling (spec 01
 * §2.4), not a combat rule.
 */
export function standardPlatoon(force: ForceTemplate, side: SideId, opts: PlatoonOptions): UnitSetup[] {
  const hqId = `${side}-hq`
  const hq = unitFromTemplate(force.platoonCommand, force, hqId, opts.quality, opts.hqLeadership, null, opts.confidence)
  const squads: UnitSetup[] = []
  for (let i = 0; i < force.squadCount; i++) {
    squads.push(unitFromTemplate(force.squad, force, `${side}-sq${i + 1}`, opts.quality, opts.squadLeadership, hqId, opts.confidence))
  }
  return [hq, ...squads]
}

export interface SideOptions extends PlatoonOptions {
  name?: string
  motivation: Motivation
}

/** A side built from a single standard platoon (p. 67–69's own scale of force, before any company-level attachments). */
export function sideFromForce(force: ForceTemplate, side: SideId, opts: SideOptions): SideSetup {
  return {
    id: side,
    name: opts.name ?? `${force.nation} platoon`,
    motivation: opts.motivation,
    units: standardPlatoon(force, side, opts),
  }
}
