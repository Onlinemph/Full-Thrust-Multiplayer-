import { chromium } from 'playwright'

/**
 * Screenshots of every terrain style's live setup preview, both games (so
 * both scales), plus a zoomed table view of a squad town and a platoon
 * city — for a visual look at BRIEF-SETTLE's second pass on settlements.
 * Not a check: prints nothing but where it wrote each file.
 *
 *   DRIVE_URL=http://localhost:5234/ DRIVE_SHOT_DIR=<dir> node tools/shot_settlements.mjs
 */
const URL = process.env.DRIVE_URL ?? 'http://localhost:5199/'
const SHOTS = process.env.DRIVE_SHOT_DIR ?? '.'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
page.on('pageerror', (e) => console.error('pageerror', String(e)))
page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()) })
const shot = async (name) => {
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
  console.log('wrote', name)
}

async function clearSaves() {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.removeItem('ftpc.stargrunt.battle.v1')
    localStorage.removeItem('ftpc.dirtside.battle.v1')
  })
  await page.reload({ waitUntil: 'networkidle' })
}

async function previewShots(gameButton, prefix, seed) {
  await clearSaves()
  await page.getByRole('button', { name: gameButton }).click()
  await page.waitForSelector('.dst-setup')
  await page.locator('.dst-setup input[aria-label="Seed"]').fill(String(seed))
  for (const style of ['village', 'town', 'city']) {
    await page.locator('.dst-setup select[aria-label="Terrain"]').selectOption(style)
    await page.waitForTimeout(200)
    await shot(`${prefix}-${style}`)
  }
}

async function zoomedTableShot(gameButton, style, seed, name) {
  await clearSaves()
  await page.getByRole('button', { name: gameButton }).click()
  await page.waitForSelector('.dst-setup')
  await page.locator('.dst-setup input[aria-label="Seed"]').fill(String(seed))
  await page.locator('.dst-setup select[aria-label="Terrain"]').selectOption(style)
  await page.getByRole('button', { name: 'To the table' }).click()
  await page.waitForSelector('.dst-mapsvg')
  await page.waitForTimeout(300)
  const zoomIn = page.getByRole('button', { name: 'Zoom in' })
  for (let i = 0; i < 6; i++) await zoomIn.click()
  await page.waitForTimeout(200)
  await shot(name)
}

await previewShots('Dirtside table', 'dirtside2', 4242)
await previewShots('Stargrunt table', 'stargrunt2', 4242)
await zoomedTableShot('Stargrunt table', 'town', 4242, 'stargrunt2-town-zoom')
await zoomedTableShot('Stargrunt table', 'city', 4242, 'stargrunt2-city-zoom')
await zoomedTableShot('Dirtside table', 'city', 4242, 'dirtside2-city-zoom')
await zoomedTableShot('Dirtside table', 'town', 4242, 'dirtside2-town-zoom')

await browser.close()
