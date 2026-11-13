import fs from 'node:fs';
import { open, openApp, dismissCookies, setEdition, step, writeReport } from './lib.mjs';
import { setTheme } from './theme.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-c11';
const nav = async (page, fr, n) => { await fr.getByRole('button', { name: new RegExp('^' + n) }).first().click({ timeout: 15000 }); await page.waitForTimeout(3500); };
const { browser, ctx, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
const BAD = /Something went wrong|Unexpected error|could not load|Cannot read|undefined is not|TypeError/i;
const shot = (n) => page.screenshot({ path: `${DIR}/${n}.png` });
await step('reset', 'Dev-only reset of stored answer (Settings, Developer spike)', async () => {
  await nav(page, fr, 'Settings');
  await fr.getByRole('button', { name: 'Reset review prompt' }).first().click({ timeout: 20000 });
  await page.waitForTimeout(2500); return 'reset';
});
const prompt = () => fr.getByText('Finding AccessRadar useful?');
for (const ed of ['Advanced', 'Standard']) {
  await step(`light.${ed}`, `Prompt visible on Overview (${ed}, light)`, async () => {
    await setEdition(page, fr, ed); await nav(page, fr, 'Overview');
    await prompt().first().waitFor({ timeout: 30000 });
    const b = await fr.locator('body').innerText();
    if (!/Write a review/.test(b) || !/I already did/.test(b) || !/Not now/.test(b)) throw new Error('actions missing');
    await shot(`light-${ed.toLowerCase()}`); return 'shown';
  });
}
await setEdition(page, fr, 'Use the license');
await step('block', 'Prompt never blocks: Reviews page loads and usable', async () => {
  await nav(page, fr, 'Reviews');
  const b = await fr.locator('body').innerText(); if (BAD.test(b)) throw new Error('error');
  await nav(page, fr, 'Overview'); await prompt().first().waitFor({ timeout: 30000 });
  await fr.getByRole('button', { name: /Take snapshot now/ }).first().waitFor({ timeout: 10000 });
  return 'ok';
});
await step('dark', 'Prompt visible in dark', async () => {
  const mode = await setTheme(page, 'Dark'); if (mode !== 'dark') throw new Error('mode ' + mode);
  fr = await openApp(page); await dismissCookies(page);
  await prompt().first().waitFor({ timeout: 30000 }); await shot('dark-overview');
  return 'shown';
});
await step('link', 'Write a review opens only the Marketplace reviews page; prompt then gone', async () => {
  const pop = ctx.waitForEvent('page', { timeout: 25000 }); pop.catch(() => {});
  await fr.getByText('Write a review').first().click();
  const np = await pop; await np.waitForURL(/marketplace\.atlassian\.com/, { timeout: 20000 }).catch(() => {});
  const url = np.url(); await np.close();
  if (!/marketplace\.atlassian\.com\/apps\/3691498947\//.test(url)) throw new Error('url ' + url);
  await page.waitForTimeout(2000);
  if (await prompt().count()) throw new Error('still visible');
  return url;
});
await step('persist', 'Reload: prompt stays gone (stored per site)', async () => {
  fr = await openApp(page); await fr.getByRole('button', { name: /Take snapshot now/ }).first().waitFor({ timeout: 30000 });
  if (await prompt().count()) throw new Error('prompt came back'); await shot('dark-after');
  return 'gone';
});
await step('restore', 'Theme back to Light', async () => { const m = await setTheme(page, 'Light'); if (m !== 'light') throw new Error(m); return m; });
writeReport(DIR, 'C11 review prompt E2E, dev');
await browser.close();
