import { chromium } from 'playwright'

/**
 * Ground units through the real console: a tank platoon and a rifle platoon
 * raised at the home colony from the purchase form, both able to land from
 * orbit; embarked on a liner's holds; carried to an undefended enemy home;
 * landed; their craft placed and brought down on the Dirtside table, the
 * dropship unloaded in a later activation; the battle returned to the
 * campaign and the units' experience read back.
 *
 *   npx vite --port 5199 --strictPort &
 *   node tools/drive_ground.mjs
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
const campaign = () => page.evaluate(() => {
  const s = window.__fullThrustCampaign.currentCampaign()
  return { turn: s.turn, phase: s.phase, units: s.groundUnits.map((u) => ({ name: u.name, at: u.at, present: u.elements.filter((e) => !e.lost).length, of: u.elements.length, battles: u.battles, points: u.qualityPoints, quality: u.quality })), rp: s.colonies.find((c) => c.id === 'terra-home').stockpileRp, landings: s.landings.length, last: s.log.slice(-2).map((l) => l.text) }
})
const runTo = (turn, phase) => page.evaluate(({ turn, phase }) => {
  const c = window.__fullThrustCampaign
  for (let i = 0; i < 80; i++) {
    const s = c.currentCampaign()
    if (s.turn === turn && s.phase === phase) return null
    const r = c.campaignDispatch({ kind: 'end-phase', player: null })
    if (r.refused) return r.refused
  }
  return 'never arrived'
}, { turn, phase })
const battle = () => page.evaluate(() => {
  const b = window.__fullThrustDirtside.currentDirtsideBattle()
  return b ? { turn: b.turn, phase: b.phase, toAct: b.toAct, activation: b.activation?.unitId ?? null, offered: !!b.activation?.window, craft: b.craft, result: b.result, count: b.activationCount } : null
})
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

await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(() => {
  const hex = (q, r) => ({ q, r })
  window.__fullThrustCampaign.newCampaign({
    seed: 4711,
    rulesVersion: 2,
    starHexes: [hex(0, 0), hex(2, 0), hex(0, 2), hex(-2, 1), hex(3, -2)],
    radius: 4,
    players: [
      { id: 'terra', name: 'Terra', faction: 'New Anglian Confederation', home: hex(0, 0), startingShips: [{ designId: 'intro-heavy-cruiser', name: 'Endeavour' }, { designId: 'samc-liner', name: 'Cape Town' }], startingTransports: 0 },
      { id: 'esu', name: 'Eurasia', faction: 'Eurasian Solar Union', home: hex(2, 0), startingShips: [], startingTransports: 0, computer: true },
    ],
    bannedSystems: [],
  })
})
const reached = await runTo(4, 'production')
if (reached) fail(`could not reach turn 4's production: ${reached}`)
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Continue campaign/ }).click()
await page.waitForSelector('.campaign-screen')

// ── Raise two units from the purchase form ─────────────────────────────────
await page.getByLabel('Item').selectOption('ground-unit')
await page.getByLabel('Unit type').selectOption('v:book-mbt')
await page.getByLabel('Vehicles').fill('3')
await page.getByLabel('Unit name').fill('1st Armoured')
await page.getByLabel('lands from orbit').check()
const buyTanks = page.getByRole('button', { name: /^Buy ·/ })
console.log('tank platoon:', await buyTanks.textContent())
if (!/645 RP/.test((await buyTanks.textContent()) ?? '')) fail('three landing-capable Medium Battle Tanks should cost 645 RP')
await shot('ground-buy')
await buyTanks.click()
await page.getByLabel('Unit type').selectOption('i:powered')
await page.getByLabel('Unit name').fill('Drop Company')
await page.getByRole('button', { name: /^Buy ·/ }).click()
let c = await campaign()
console.log('raised:', JSON.stringify(c.units), 'RP left', c.rp)
if (c.units.length !== 2) fail(`expected two units, got ${c.units.length}`)
if (!(await page.locator('.campaign-garrison').isVisible())) fail('no garrison list on the colony')

// ── Embark them on the liner ───────────────────────────────────────────────
for (const name of ['1st Armoured', 'Drop Company']) {
  const select = page.getByLabel(`Embark ${name}`)
  const liner = await select.locator('option', { hasText: 'Cape Town' }).getAttribute('value')
  await select.selectOption(liner)
}
c = await campaign()
if (!c.units.every((u) => 'ship' in u.at)) fail('the units did not embark')
if (!(await page.locator('.campaign-embarked').first().isVisible())) fail('the embarked units are not listed under the ship')
console.log('holds:', (await page.locator('.campaign-ships').first().textContent())?.match(/holds [0-9/]+ CS/)?.[0])
await shot('ground-embarked')

// ── Sail to Eurasia and land ───────────────────────────────────────────────
const plotted = await page.evaluate(() => window.__fullThrustCampaign.campaignDispatch({ kind: 'plot-move', player: 'terra', taskForce: 'terra-tf-1', legs: [{ turn: 7, from: { q: 0, r: 0 }, to: { q: 2, r: 0 } }] }))
if (plotted.refused) fail(`plot refused: ${plotted.refused}`)
const there = await runTo(7, 'planetary')
if (there) fail(`could not reach turn 7's planetary phase: ${there}`)
const landed = await page.evaluate(() => window.__fullThrustCampaign.campaignDispatch({ kind: 'assault', player: 'terra', colony: 'esu-home', taskForce: 'terra-tf-1' }))
if (landed.refused) fail(`landing refused: ${landed.refused}`)
c = await campaign()
console.log('landing:', c.last.join(' | '))
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Continue campaign/ }).click()
await page.getByRole('button', { name: 'Fight on the Dirtside table' }).click()
await page.waitForSelector('.dst-craft')
const craftText = (await page.locator('.dst-craft').textContent())?.replace(/\s+/g, ' ')
console.log('craft:', craftText)
if (!/dropship/.test(craftText ?? '') || !/assault lander/.test(craftText ?? '')) fail('the craft panel does not list a dropship and a lander')

// ── Bring the craft down, then unload the dropship ─────────────────────────
await page.getByRole('button', { name: /ready/ }).first().click()
let b = await northToAct()
if (b.phase === 'turn-start') {
  await page.locator('.dst-actions button').first().click()
  b = await northToAct()
}
const places = page.locator('.dst-craft button', { hasText: 'Place' })
const spots = [{ x: 14, y: 4 }, { x: 34, y: 4 }]
for (let i = 0; i < spots.length; i++) {
  if ((await places.count()) === 0) break
  await places.first().click()
  const px = await pixelAt(spots[i].x, spots[i].y)
  await page.mouse.click(px.x, px.y)
}
await shot('ground-placed')
await page.getByRole('button', { name: /Bring .* down/ }).click()
b = await battle()
const statuses = Object.values(b.craft).map((k) => k.status)
console.log('after landing:', statuses.join(', '), (await page.locator('.dst-refusal').textContent().catch(() => '')) ?? '')
if (!statuses.every((s) => s !== 'aloft')) fail('the craft did not come down')
if ((await page.locator('.dst-craft-mark').count()) === 0) fail('no craft on the map')
b = await northToAct()
const unload = page.getByRole('button', { name: 'Unload' })
if ((await unload.count()) > 0) {
  await unload.first().click()
  b = await battle()
  console.log('unloaded:', Object.values(b.craft).map((k) => k.status).join(', '))
  if (Object.values(b.craft).some((k) => k.status === 'landed')) fail('the dropship did not unload')
} else if (!Object.values(b.craft).some((k) => k.status === 'lost')) fail('no Unload button for the dropship')
await shot('ground-unloaded')

// ── Back to the campaign ───────────────────────────────────────────────────
await page.getByRole('button', { name: 'Return to campaign' }).click()
await page.waitForSelector('.campaign-screen')
c = await campaign()
console.log('after:', JSON.stringify(c.units), '|', c.last.join(' | '))
if (!c.units.some((u) => u.battles === 1)) fail('no unit came out of the landing with a battle to its name')

if (errors.length) fail(`page errors: ${errors.join(' | ')}`)
await browser.close()
console.log(process.exitCode ? 'drive FAILED' : 'drive ok')
