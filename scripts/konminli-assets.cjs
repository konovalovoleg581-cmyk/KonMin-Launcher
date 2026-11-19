// Exports the KonMinli asset set (branding/konminli/) from the live mascot component
// (src/components/milli/Milli.tsx), so the files always match the app.
// Usage: `bun run dev` in one terminal, then `node scripts/konminli-assets.cjs [http://127.0.0.1:5173/]`.
// Needs Playwright with Chromium (`npm i -g playwright && npx playwright install chromium`).
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const OUT = path.join(__dirname, '..', 'branding', 'konminli') + path.sep
const URL = process.argv[2] || 'http://127.0.0.1:5173/'
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  await p.goto(URL); await p.waitForTimeout(4000)
  await p.evaluate(async () => {
    const R = await import('/node_modules/.vite/deps/react.js'); window.__R = R.default || R
    const RD = await import('/node_modules/.vite/deps/react-dom_client.js'); window.__RD = RD.createRoot || RD.default.createRoot
    window.__M = (await import('/src/components/milli/Milli.tsx')).Milli
    await import('/src/styles/pixel/milli-mascot.css')
    const host = document.createElement('div'); host.id = 'mx'
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:transparent'
    document.body.appendChild(host); window.__root = window.__RD(host)
    document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'
  })
  const show = async (mode, size) => {
    await p.evaluate(([mode, size]) => window.__root.render(window.__R.createElement(window.__M, { mode, size, poke: false, track: false })), [mode, size])
    await p.waitForTimeout(900)
  }
  // hide the app behind the host so screenshots are transparent
  await p.addStyleTag({ content: 'body > :not(#mx){visibility:hidden !important}' })
  for (const [name, mode] of [['neutral', 'idle'], ['happy', 'happy'], ['thinking', 'ponder'], ['surprised', 'surprise']]) {
    await show(mode, 512)
    await p.locator('#mx svg').screenshot({ path: OUT + 'konminli-' + name + '.png', omitBackground: true })
  }
  await show('wave', 512)
  await p.locator('#mx svg').screenshot({ path: OUT + 'konminli-mascot.png', omitBackground: true })
  // head-only SVG: the logo
  await show('idle', 400)
  const svg = await p.evaluate(() => {
    const svg = document.querySelector('#mx svg'); const clone = svg.cloneNode(true)
    const src = [...svg.querySelectorAll('*')], dst = [...clone.querySelectorAll('*')]
    src.forEach((el, i) => {
      const cs = getComputedStyle(el), d = dst[i]
      const hidden = cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0
      if (hidden) d.setAttribute('data-x', '1')
      if (['path', 'rect'].includes(el.tagName)) { d.setAttribute('fill', cs.fill); if (cs.opacity !== '1') d.setAttribute('fill-opacity', cs.opacity) }
      else if (el.tagName === 'g' && parseFloat(cs.opacity) !== 1 && !hidden) d.setAttribute('opacity', cs.opacity)
      const cls = el.getAttribute('class') || ''
      if (/\bmm-(legs|back|front|shadow|dots)\b/.test(cls)) d.setAttribute('data-x', '1')
    })
    clone.querySelectorAll('[data-x]').forEach((n) => n.remove())
    clone.querySelectorAll('*').forEach((n) => { for (const a of ['class', 'style', 'aria-hidden', 'focusable', 'role']) n.removeAttribute(a) })
    for (const a of ['class', 'style', 'width', 'height', 'aria-hidden', 'focusable', 'role']) clone.removeAttribute(a)
    clone.setAttribute('viewBox', '-48 -54 472 472'); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    return clone.outerHTML.replace(/url\(&quot;(#[^&]+)&quot;\)/g, 'url($1)')
  })
  fs.writeFileSync(OUT + 'konminli-logo.svg', '<!-- KonMinli, the KonMin Launcher mascot and logo. Exported from src/components/milli (see branding/README.md). -->\n' + svg + '\n')
  console.log('svg bytes', svg.length, 'gradient refs', (svg.match(/url\(#konminli-tile\)/g) || []).length)
  await b.close()
})()
