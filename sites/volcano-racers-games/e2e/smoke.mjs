// Browser smoke test: loads every page, plays a little of each game, and fails on any
// console error. Run: npm run e2e   (uses the Playwright + Chromium already on the machine)
// Screenshots go to e2e/screenshots/ (git-ignored).
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const SHOTS = fileURLToPath(new URL('./screenshots/', import.meta.url));
await mkdir(SHOTS, { recursive: true });

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let failures = 0;

async function run(name, viewport, fn) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await fn(page);
    if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`);
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${name}: ${e.message}`);
    await page.screenshot({ path: `${SHOTS}${name}-FAIL.png` }).catch(() => {});
  }
  await page.close();
}

const shot = (page, n) => page.screenshot({ path: `${SHOTS}${n}.png` });
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

await run('hub', DESKTOP, async (page) => {
  await page.goto(`${base}/`);
  const cards = await page.locator('.hub-game').count();
  expect(cards === 5, `expected 5 game cards, got ${cards}`);
  await page.fill('#player-name', 'Test Racer');
  await page.click('#name-form button[type=submit]');
  await page.waitForSelector('text=Saved. Hi, Test Racer.');
  await shot(page, 'hub');
});

await run('hub-phone', PHONE, async (page) => {
  await page.goto(`${base}/`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(!overflow, 'hub scrolls sideways on a phone');
  await shot(page, 'hub-phone');
});

await run('circuit-rush', DESKTOP, async (page) => {
  await page.goto(`${base}/games/circuit-rush/`);
  await shot(page, 'circuit-rush-select');
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__circuitRush.race?.time > 0.2);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2500);
  const s = await page.evaluate(() => { const r = window.__circuitRush.race; const p = r.cars.find((c) => c.isPlayer); return { prog: p.progress }; });
  expect(s.prog > 200, `player car barely moved (${s.prog})`);
  await shot(page, 'circuit-rush-race');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#panel-pause:not([hidden])');
  // Finish the race instantly through the test hook and check results + garage.
  await page.click('#btn-resume');
  await page.evaluate(() => {
    const r = window.__circuitRush.race;
    for (const c of r.cars) c.progress = r.track.laps * r.track.length + (c.isPlayer ? 1 : 0);
    r.cars.find((c) => c.isPlayer).damage = 34;
  });
  await page.waitForSelector('#panel-results:not([hidden])');
  await shot(page, 'circuit-rush-results');
  await page.click('#btn-to-garage');
  await page.waitForSelector('#panel-garage:not([hidden])');
  await shot(page, 'circuit-rush-garage');
  const dmg = await page.evaluate(() => JSON.parse(localStorage.getItem('vr.player')).garage['02'].damage);
  expect(dmg === 34, `damage not saved to the shared profile (${dmg})`);
});

await run('pit-crew', DESKTOP, async (page) => {
  await page.goto(`${base}/`);
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('vr.player') || '{}');
    p.garage = { ...(p.garage || {}), '11': { damage: 30, scars: [{ label: 'Lava scorch', at: 1 }] } };
    localStorage.setItem('vr.player', JSON.stringify(p));
  });
  await page.goto(`${base}/games/pit-crew/?car=11`);
  await shot(page, 'pit-crew-select');
  await page.click('#btn-start');
  const jobs = await page.locator('.pc-job').count();
  expect(jobs === 3, `expected 3 jobs for 30% damage, got ${jobs}`);
  await shot(page, 'pit-crew-shift');
  // Do the first job (scorch): hold the sponge.
  await page.locator('.pc-job').first().click();
  await page.waitForSelector('#sheet:not([hidden])');
  await shot(page, 'pit-crew-tool');
  const btn = page.locator('#sheet-body button').first();
  await btn.focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(1700);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => window.__pitCrew.shift.jobs.filter((j) => j.done).length === 1);
  // Run out the clock.
  await page.evaluate(() => { window.__pitCrew.shift.timeLeft = 0.01; });
  await page.waitForSelector('#panel-results:not([hidden])');
  await shot(page, 'pit-crew-results');
  const dmg = await page.evaluate(() => JSON.parse(localStorage.getItem('vr.player')).garage['11'].damage);
  expect(dmg === 20, `repair not saved (damage ${dmg}, expected 20)`);
});

await run('circuit-rush-phone', PHONE, async (page) => {
  await page.goto(`${base}/games/circuit-rush/`);
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__circuitRush.race?.time > 0.5);
  await shot(page, 'circuit-rush-phone');
});

for (const g of ['blazes-run', 'embers-flight']) {
  const exists = await fetch(`${base}/games/${g}/`).then((r) => r.ok);
  if (!exists) { console.log(`skip ${g} (not built yet)`); continue; }
  await run(g, DESKTOP, async (page) => {
    await page.goto(`${base}/games/${g}/`);
    await shot(page, `${g}-start`);
    await page.click('#btn-start');
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    await page.waitForTimeout(2500);
    await shot(page, `${g}-play`);
  });
}

await browser.close();
server.close();
if (failures) { console.log(`${failures} failed`); process.exit(1); }
console.log('all browser checks passed');
