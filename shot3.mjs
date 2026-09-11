import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [w, h, tag] of [[430, 900, 'phone'], [1024, 768, 'tablet']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  await page.screenshot({ path: `/tmp/shot-${tag}.png`, fullPage: false })
  console.log(tag, 'horizontal overflow:', overflow)
  await page.close()
}
await browser.close()
