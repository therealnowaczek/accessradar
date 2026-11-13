import { open, openApp, nav, dismissCookies, OUT } from './lib.mjs';
import fs from 'node:fs';
const { browser, page } = await open();
const fr = await openApp(page);
await dismissCookies(page);
await nav(page, fr, 'Spaces');
for (const fmt of ['CSV', 'JSON']) {
  await fr.getByRole('button', { name: /Export access matrix/ }).first().click();
  await page.waitForTimeout(400);
  const t0 = Date.now();
  const dl = page.waitForEvent('download', { timeout: 280000 }).then(d => 'download ' + d.suggestedFilename(), e => 'timeout');
  await fr.getByRole('menuitem', { name: new RegExp('^' + fmt) }).first().click();
  const r = await dl;
  console.log(fmt, r, Math.round((Date.now() - t0) / 1000) + 's');
  console.log((await fr.locator('body').innerText()).match(/(downloaded|failed)[^\n]*/g));
}
await browser.close();
