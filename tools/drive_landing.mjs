import { chromium } from 'playwright'

/**
 * A campaign landing through the real console (More Thrust pp. 15–18): a
 * fleet reaches an undefended enemy home, lands its Marines, the landing is
 * opened on the Dirtside table from the campaign, the computer plays the
 * garrison, fire is called down from orbit and brought down, and the battle
 * goes back to the campaign; then a second campaign lets the computers fight
 * its landing outright.
 *
 *   npx vite --port 5199 --strictPort &
 *   node tools/drive_landing.mjs
 *
 * Uses the development handles `window.__fullThrustCampaign` and
 * `window.__fullThrustDirtside`. Screenshots go to DRIVE_SHOT_DIR if set.
 */
const URL = process.env.DRIVE_URL ?? 'http://localhost:5199/'
const SHOTS = process.env.DRIVE_SHOT_DIR ?? null
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('dialog', (d) => d.accept())
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }) }
const fail = (why) => { console.error('FAIL:', why); process.exitCode = 1 }
const banner = async () => (await page.locator('.dst-banner').textContent()) ?? ''

/** A campaign with Eurasia's home undefended by ships, Terra's fleet at it in turn 4's planetary phase, and the Marines landed. */
async function landedCampaign(seed) {
  return page.evaluate((seed) => {
    const c = window.__fullThrustCampaign
    const hex = (q, r) => ({ q, r })
    c.newCampaign({
      seed,
      rulesVersion: 2,
      starHexes: [hex(0, 0), hex(2, 0), hex(0, 2), hex(-2, 1), hex(3, -2)],
      radius: 4,
      players: [
        { id: 'terra', name: 'Terra', faction: 'New Anglian Confederation', home: hex(0, 0), startingShips: [{ designId: 'intro-heavy-cruiser', name: 'Endeavour' }, { designId: 'intro-frigate', name: 'Dart' }], startingTransports: 0 },
        { id: 'esu', name: 'Eurasia', faction: 'Eurasian Solar Union', home: hex(2, 0), startingShips: [], startingTransports: 0, computer: true },
      ],
      bannedSystems: [],
    })
    const plot = c.campaignDispatch({ kind: 'plot-move', player: 'terra', taskForce: 'terra-tf-1', legs: [{ turn: 4, from: hex(0, 0), to: hex(2, 0) }] })
    if (plot.refused) return { refused: `plot: ${plot.refused}` }
    for (let i = 0; i < 60; i++) {
      const s = c.currentCampaign()
      if (s.turn === 4 && s.phase === 'planetary') break
      const r = c.campaignDispatch({ kind: 'end-phase', player: null })
      if (r.refused) return { refused: `end-phase: ${r.refused}` }
    }
    const r = c.campaignDispatch({ kind: 'assault', player: 'terra', colony: 'esu-home', taskForce: 'terra-tf-1' })
    const s = c.currentCampaign()
    return { refused: r.refused ?? null, turn: s.turn, phase: s.phase, landings: s.landings.map((l) => ({ id: l.id, teams: Object.keys(l.landed).length, window: l.setup.orbital?.[0]?.window ?? null })), last: s.log.slice(-2).map((l) => l.text) }
  }, seed)
}

/** A point on the table, in the page's pixels. */
async function pixelAt(x, y) {
  return page.evaluate(({ x, y }) => {
    const svg = document.querySelector('.dst-map')
    const pt = svg.createSVGPoint()
    pt.x = x
    pt.y = y
    const p = pt.matrixTransform(svg.getScreenCTM())
    return { x: p.x, y: p.y }
  }, { x, y })
}

const battle = () =>
  page.evaluate(() => {
    const b = window.__fullThrustDirtside.currentDirtsideBattle()
    if (!b) return null
    return { turn: b.turn, phase: b.phase, toAct: b.toAct, activation: b.activation?.unitId ?? null, offered: !!b.activation?.window, window: b.orbit?.windows.north ?? null, strikes: b.orbit?.strikes.length ?? 0, nukes: b.orbit?.nukes.length ?? 0, result: b.result, log: b.log.length }
  })

/** Wait until the computer has handed the table back to north, or the battle is over; opportunity fire offered to north is declined. */
async function northToAct() {
  for (let i = 0; i < 600; i++) {
    const b = await battle()
    if (!b.result && b.toAct === 'north' && b.offered) {
      await page.getByRole('button', { name: 'Decline for this activation' }).click()
      continue
    }
    if (b.result || (b.phase !== 'deployment' && b.toAct === 'north')) return b
    await page.waitForTimeout(150)
  }
  throw new Error('the computer never handed the table back')
}

await page.goto(URL, { waitUntil: 'networkidle' })

// ── The landing, from the campaign ────────────────────────────────────────
let landed = await landedCampaign(20260923)
console.log('landed:', JSON.stringify(landed))
if (landed.refused || landed.landings.length !== 1) fail(`no landing: ${landed.refused}`)
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Continue campaign/ }).click()
await page.waitForSelector('.campaign-screen')
const fightButton = page.getByRole('button', { name: 'Fight on the Dirtside table' })
if (!(await fightButton.isVisible())) fail('the planetary phase does not list the landing')
const endButton = page.locator('button.end-phase')
if (!(await endButton.isDisabled())) fail('the phase can end with a landing unfought')
await shot('landing-campaign')
await fightButton.click()
await page.waitForSelector('.dst-map')
const kicker = await page.locator('.app-bar .campaign-kicker').allTextContents()
console.log('header:', kicker.join(' | '))
if (!kicker.some((k) => /Campaign landing/.test(k))) fail('the table does not say it is a campaign landing')
if (!(await page.locator('.dst-orbit').isVisible())) fail('no orbit panel')
console.log('orbit:', (await page.locator('.dst-orbit').textContent())?.replace(/\s+/g, ' '))
// The colony's town is a real generated settlement now (BRIEF-TERRAIN), not one labeled rectangle: streets
// and buildings of its own, not just the one urban-area feature the old landingTable hand-built.
const townBuildings = await page.locator('.dst-map .dst-feature.is-building').count()
console.log('town buildings:', townBuildings)
if (townBuildings < 2) fail(`expected the colony's town to have real building features, got ${townBuildings}`)
await shot('landing-table')

// ── Deploy, and play north until the ships come over ──────────────────────
await page.getByRole('button', { name: /Terra landing force: ready/ }).click()
let b = await northToAct()
console.log('turn', b.turn, b.phase, 'ships overhead on turn', b.window)
for (let guard = 0; guard < 40 && !b.result; guard++) {
  if (b.phase === 'turn-start') {
    await page.locator('.dst-actions button').first().click()
  } else if (b.turn === b.window && !b.activation) {
    break
  } else {
    await page.getByRole('button', { name: /no more activations/ }).click()
  }
  b = await northToAct()
}
console.log('overhead now:', JSON.stringify(b))
if (b.result) fail('the battle ended before the ships came over')

// ── Call fire from orbit: platoon leaders in turn until one gets an answer ──
const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th']
let answered = false
for (const nth of ordinals) {
  b = await battle()
  if (b.result || b.toAct !== 'north' || b.activation) break
  const platoon = page.locator('.dst-force.is-north .dst-unit').filter({ hasText: `${nth} Marine Platoon` })
  if ((await platoon.getByRole('button', { name: 'Activate' }).count()) === 0) continue
  await platoon.getByRole('button', { name: 'Activate' }).click()
  await platoon.locator('.dst-unit-name').click()
  const call = page.locator('.dst-orbit button', { hasText: /Call/ }).first()
  if (!(await call.isVisible())) {
    fail(`no call button for the ${nth} platoon's leader`)
    break
  }
  await call.click()
  const aims = await page.evaluate(() => {
    const b = window.__fullThrustDirtside.currentDirtsideBattle()
    const caller = b.elements[b.units[b.activation.unitId].leaderElementId]
    const south = Object.values(b.elements).filter((e) => e.sideId === 'south' && !e.destroyed)
    // Defenders more than 10" from any Marine, clear of the worst deviation, nearest the caller first.
    const marines = Object.values(b.elements).filter((e) => e.sideId === 'north' && !e.destroyed)
    const safe = south.filter((e) => marines.every((m) => Math.hypot(m.position.x - e.position.x, m.position.y - e.position.y) > 10))
    safe.sort((a, c) => Math.hypot(a.position.x - caller.position.x, a.position.y - caller.position.y) - Math.hypot(c.position.x - caller.position.x, c.position.y - caller.position.y))
    return safe.map((e) => e.position)
  })
  // A click on a defender's counter aims at where it stands; one out of the caller's sight is refused, and the next is tried.
  for (const aim of aims) {
    const px = await pixelAt(aim.x, aim.y)
    await page.mouse.click(px.x, px.y)
    const refusal = (await page.locator('.dst-refusal').textContent().catch(() => '')) ?? ''
    if (!/cannot see/.test(refusal)) break
  }
  const last = await page.evaluate(() => window.__fullThrustDirtside.currentDirtsideBattle().log.slice(-1)[0].text)
  console.log(`${nth} platoon calls:`, last)
  answered = /the impact marker goes down/.test(last)
  if (!answered && !/no answer/.test(last)) fail('the call went nowhere')
  if (answered) await shot('landing-called')
  await page.getByRole('button', { name: /End .* activation/ }).click()
  b = await northToAct()
  if (answered) break
}
if (!answered) console.log('no call was answered this turn; the strike is not driven')
if (answered) {
  console.log('banner:', await banner())
  if (!/arrives/.test(await banner())) fail('the fire is not due after the garrison moved')
  await page.getByRole('button', { name: 'Bring down the orbital fire' }).click()
  await page.waitForTimeout(200)
  b = await battle()
  console.log('after the strike:', JSON.stringify({ strikes: b.strikes, nukes: b.nukes }))
  if (b.nukes !== 1) fail('no ground zero after the strike')
  if ((await page.locator('.dst-nuke').count()) !== 1) fail('no NUKE marker on the map')
  await shot('landing-strike')
}

// ── Back to the campaign as it stands ─────────────────────────────────────
await page.getByRole('button', { name: 'Return to campaign' }).click()
await page.waitForSelector('.campaign-screen')
const after = await page.evaluate(() => {
  const s = window.__fullThrustCampaign.currentCampaign()
  return { landing: s.landings[0], owner: s.colonies.find((c) => c.id === 'esu-home').owner, last: s.log.slice(-1)[0].text }
})
console.log('folded back:', after.landing.resolved, after.landing.winner, after.owner, '—', after.last)
if (!after.landing.resolved) fail('the landing did not fold back')
if (await endButton.isDisabled()) fail('the phase is still blocked after the landing was fought')
await page.getByRole('button', { name: 'Review' }).first().click()
await page.waitForSelector('.dst-map')
if ((await page.locator('.dst-nuke').count()) !== (answered ? 1 : 0)) fail('the review does not show the battle as fought')
await page.getByRole('button', { name: 'Menu' }).click()

// ── A second campaign: the computers fight the landing ────────────────────
landed = await landedCampaign(99)
console.log('second landing:', JSON.stringify(landed.landings))
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Continue campaign/ }).click()
await page.waitForSelector('.campaign-screen')
await page.getByRole('button', { name: 'Let the computers fight it' }).click()
await page.waitForTimeout(300)
const auto = await page.evaluate(() => {
  const s = window.__fullThrustCampaign.currentCampaign()
  return { resolved: s.landings[0].resolved, winner: s.landings[0].winner, last: s.log.slice(-1)[0].text }
})
console.log('auto:', JSON.stringify(auto))
if (!auto.resolved) fail('the computers did not fight the landing')
await shot('landing-auto')
// And the campaign replays after a reload with the landing fought.
await page.reload({ waitUntil: 'networkidle' })
const replayed = await page.evaluate(() => window.__fullThrustCampaign.currentCampaign().landings[0].resolved)
if (!replayed) fail('the fought landing did not survive a reload')

if (errors.length) fail(`page errors: ${errors.join(' | ')}`)
await browser.close()
console.log(process.exitCode ? 'drive FAILED' : 'drive ok')
