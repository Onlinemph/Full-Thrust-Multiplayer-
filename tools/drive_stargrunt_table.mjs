import { chromium } from 'playwright'

/**
 * The Stargrunt table through the real console: set up a skirmish from the
 * menu, deploy, choose who goes first, activate a squad, move it, fire on
 * an enemy squad, reorganise, end the activation, work through a few more
 * activations (taking a close assault if one comes up), then save and
 * reload and find the battle still on the table. On the pattern of
 * `tools/drive_dirtside_table.mjs`.
 *
 *   npx vite --port 5231 --strictPort &
 *   node tools/drive_stargrunt_table.mjs
 */
const URL = process.env.DRIVE_URL ?? 'http://localhost:5231/'
const SHOTS = process.env.DRIVE_SHOT_DIR ?? null
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
const fail = (why) => { console.error('FAIL:', why); process.exitCode = 1 }
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }) }
const banner = async () => (await page.locator('.dst-banner').textContent()) ?? ''
const logText = async () => (await page.locator('.dst-log').textContent()) ?? ''

await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.removeItem('ftpc.stargrunt.battle.v1'))
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Stargrunt table/ }).click()
await page.waitForSelector('.dst-setup')
await page.locator('.dst-setup input[aria-label="Seed"]').fill('4242')
const rows = await page.locator('.sg-side').count()
console.log('sides in setup:', rows)
if (rows !== 2) fail(`expected 2 side columns, got ${rows}`)
await shot('stargrunt-skirmish')
await page.getByRole('button', { name: 'To the table' }).click()
await page.waitForSelector('.dst-mapsvg')
console.log('banner:', await banner())
if (!/Deployment/.test(await banner())) fail('the table did not open in deployment')
const figures = await page.locator('.sg-figure').count()
console.log('figures:', figures)
if (figures < 20) fail(`expected both platoons on the table, got ${figures} figures`)
await shot('stargrunt-deploy')

// Deploy: pick a northern figure and put it inside the deployment strip.
await page.locator('.sg-figure.is-north').first().click()
if (!(await page.locator('.sg-figure.is-selected').count())) fail('clicking a figure did not select it')
const svg = page.locator('.dst-mapsvg')
const box = await svg.boundingBox()
const pxPerInch = await svg.evaluate((el) => el.getScreenCTM().a)
await page.mouse.click(box.x + 4 * pxPerInch, box.y + 3 * pxPerInch)
await shot('stargrunt-deploy-moved')
await page.getByRole('button', { name: /force: ready|squad: ready/ }).first().click()
await page.getByRole('button', { name: /force: ready|squad: ready/ }).first().click()
console.log('banner:', await banner())
if (!/chooses who activates first/.test(await banner())) fail('turn 1 did not start')
await page.locator('.dst-actions button').first().click()
console.log('banner:', await banner())
if (!/to activate a unit/.test(await banner())) fail('no side is to activate')

// Activate whoever is up, plot a normal move toward the middle of the table.
await page.locator('.sg-roster-row').first().click()
await page.getByRole('button', { name: /^Activate / }).click()
console.log('banner:', await banner())
if (!/is activated/.test(await banner())) fail('the squad did not activate')
await shot('stargrunt-activated')
const north = (await page.locator('.dst-active.is-north').count()) > 0
await page.getByRole('button', { name: 'Normal', exact: true }).click()
const table = await svg.boundingBox()
const midX = table.width / 2 / pxPerInch
const towardY = north ? 20 : 16
await page.mouse.click(table.x + midX * pxPerInch, table.y + towardY * pxPerInch)
let text = await logText()
if (!/makes a normal move/.test(text)) fail('the move is not in the log')
await shot('stargrunt-moved')

// Fire small arms at the nearest enemy squad if one is lit; otherwise reorganise.
await page.getByRole('button', { name: 'Small arms' }).click()
const enemyPennant = page.locator(north ? '.sg-pennant.is-south' : '.sg-pennant.is-north').first()
if (await enemyPennant.count()) {
  await enemyPennant.click()
}
await page.waitForTimeout(150)
if (await page.locator('.dst-refusal').count()) {
  console.log('fire refusal:', (await page.locator('.dst-refusal').textContent())?.trim())
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Reorganise' }).click()
} else {
  text = await logText()
  if (!/fires small arms|fires .*support weapon/.test(text)) fail('no fire action reached the log')
}
await shot('stargrunt-fire')
// Firing may have been the activation's second action, ending it by itself; end it if not.
if (await page.locator('.sg-end').count()) await page.locator('.sg-end').click()
console.log('banner:', await banner())
if (!/to activate a unit|chooses who activates first/.test(await banner())) fail('the activation did not end')

// Play several more activations through the buttons, watching for a close-assault opportunity.
let assaulted = false
for (let i = 0; i < 14; i++) {
  const b = await banner()
  if (/wins:|A draw:/.test(b)) break
  if (/chooses who activates first/.test(b)) {
    await page.locator('.dst-actions button').first().click()
    continue
  }
  if (/to activate a unit/.test(b)) {
    const row = page.locator('.sg-roster-row:not(.is-spent)').first()
    if (!(await row.count())) {
      // Nobody of ours is left to activate: pass if we may, else give up the rest of the turn.
      const pass = page.getByRole('button', { name: 'Pass', exact: true })
      if ((await pass.count()) && (await pass.isEnabled())) await pass.click()
      else await page.getByRole('button', { name: /no more activations/ }).click().catch(() => {})
      continue
    }
    await row.click()
    const activate = page.getByRole('button', { name: /^Activate / })
    if (await activate.count()) await activate.click()
    else continue
  }
  if (/is activated/.test(await banner())) {
    const activeIsNorth = (await page.locator('.dst-active.is-north').count()) > 0
    let acted = false
    if (!assaulted) {
      const charge = page.getByRole('button', { name: 'Charge' })
      if ((await charge.count()) && (await charge.isEnabled())) {
        await charge.click()
        const enemy = page.locator(activeIsNorth ? '.sg-pennant.is-south' : '.sg-pennant.is-north').first()
        if (await enemy.count()) {
          await enemy.click()
          assaulted = true
          acted = true
          await shot('stargrunt-assault')
        }
      }
    }
    // Otherwise close the distance: a normal move toward the enemy's side of the table.
    if (!acted) {
      const normal = page.getByRole('button', { name: 'Normal', exact: true })
      if ((await normal.count()) && (await normal.isEnabled())) {
        await normal.click()
        const t = await svg.boundingBox()
        const y = activeIsNorth ? 30 : 6
        await page.mouse.click(t.x + midX * pxPerInch, t.y + y * pxPerInch)
      }
    }
    const end = page.locator('.sg-end')
    if (await end.count()) await end.click()
  }
}
console.log('close assault reached:', assaulted)
await shot('stargrunt-table')

// The battle survives a reload and the menu offers to continue it.
await page.reload({ waitUntil: 'networkidle' })
const cont = page.getByRole('button', { name: /Continue the squad battle/ })
if (!(await cont.count())) fail('the menu does not offer to continue the squad battle')
await cont.click()
await page.waitForSelector('.dst-mapsvg')
const after = await logText()
if (!/makes a normal move/.test(after)) fail('the reloaded battle lost its log')
await page.getByRole('button', { name: 'Menu' }).click()

if (errors.length) fail(`console errors: ${errors.join(' | ')}`)
await browser.close()
console.log(process.exitCode ? 'DRIVE FAILED' : 'DRIVE OK')
