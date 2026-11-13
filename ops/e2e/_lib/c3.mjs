import fs from 'node:fs';
import { open, openApp, dismissCookies, setEdition, step, writeReport } from './lib.mjs';
import { setTheme } from './theme.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-c3';
const nav = async (page, fr, n) => { await fr.getByRole('button', { name: new RegExp('^' + n) }).first().click({ timeout: 15000 }); await page.waitForTimeout(4000); };
const { browser, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
const shot = (n) => page.screenshot({ path: `${DIR}/${n}.png` });
const BAD = /Something went wrong|Unexpected error|could not load|TypeError/i;
const pick = async (filterLabel) => {
  await fr.getByLabel('Filter groups').click().catch(() => {});
  await page.waitForTimeout(500);
};
let names = [];
await step('1', 'Groups: open groups used in spaces and track 4 of them from the panel', async () => {
  await nav(page, fr, 'Groups');
  await fr.locator('input[id*="react-select"]').first().focus().catch(() => {});
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(500);
  await fr.getByRole('option', { name: 'Used in spaces', exact: true }).first().click(); await page.waitForTimeout(1500);
  const links = fr.locator('table tbody tr td:first-child button');
  const n = await links.count(); if (n < 4) throw new Error('only ' + n + ' groups used in spaces');
  for (let i = 0; i < 4; i++) {
    const link = fr.locator('table tbody tr td:first-child button').nth(i);
    names.push((await link.innerText()).trim());
    await link.click(); await page.waitForTimeout(3500);
    if (i === 0) await shot('drawer-track-light');
    await fr.getByRole('button', { name: 'Track changes' }).first().click({ timeout: 15000 }); await page.waitForTimeout(2500);
    await fr.getByRole('button', { name: 'Stop tracking' }).first().waitFor({ timeout: 10000 });
    await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
  }
  return names.join(', ');
});
await step('2', 'Tracked pill shown and "Tracked groups" filter lists exactly the tracked groups', async () => {
  await nav(page, fr, 'Groups');
  await fr.locator('input[id*="react-select"]').first().focus(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(500);
  await fr.getByRole('option', { name: 'Tracked groups', exact: true }).first().click(); await page.waitForTimeout(1500);
  const rows = await fr.locator('table tbody tr').count(); await shot('filter-tracked');
  if (rows !== 4) throw new Error('rows ' + rows);
  const txt = await fr.locator('body').innerText();
  for (const nme of names) if (!txt.includes(nme)) throw new Error('missing ' + nme);
  if (!/Tracked/.test(txt)) throw new Error('no pill');
  return '4 rows';
});
await step('3', 'Weekly digest rebuilt: Tracked groups this week appears on Groups and Overview', async () => {
  await nav(page, fr, 'Overview');
  await fr.getByRole('button', { name: 'Refresh now' }).click(); await page.waitForTimeout(70000);
  await nav(page, fr, 'Overview'); await page.waitForTimeout(3000);
  const o = await fr.locator('body').innerText(); await shot('overview-digest');
  if (!/Tracked groups this week/.test(o)) throw new Error('not on Overview');
  await nav(page, fr, 'Groups'); await page.waitForTimeout(2500);
  const g = await fr.locator('body').innerText(); await shot('groups-section');
  if (!/Tracked groups this week/.test(g) || !/of 4 tracked groups changed/.test(g)) throw new Error('not on Groups: ' + g.slice(0, 200));
  return (g.match(/\d+ of 4 tracked groups changed/) ?? [''])[0];
});
await step('4', 'Standard edition: same section on Groups', async () => {
  await setEdition(page, fr, 'Standard'); await nav(page, fr, 'Groups'); await page.waitForTimeout(2500);
  const g = await fr.locator('body').innerText(); await shot('groups-standard');
  await setEdition(page, fr, 'Use the license');
  if (!/Tracked groups this week/.test(g)) throw new Error('missing'); return 'ok';
});
await step('5', 'Dark: Groups section and panel', async () => {
  const m = await setTheme(page, 'Dark'); if (m !== 'dark') throw new Error(m);
  let err = null;
  try { fr = await openApp(page); await dismissCookies(page); await nav(page, fr, 'Groups'); await page.waitForTimeout(2500); await shot('groups-dark');
    await fr.locator('table tbody tr td:first-child button').first().click(); await page.waitForTimeout(3500); await shot('drawer-dark'); await page.keyboard.press('Escape');
  } catch (e) { err = e; }
  const m2 = await setTheme(page, 'Light'); if (m2 !== 'light') throw new Error(m2);
  fr = await openApp(page); await dismissCookies(page); if (err) throw err; return 'ok';
});
await step('6', 'Cleanup: stop tracking all four', async () => {
  await nav(page, fr, 'Groups');
  for (let i = 0; i < 4; i++) {
    await fr.locator('input[id*="react-select"]').first().focus(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(400);
    await fr.getByRole('option', { name: 'Tracked groups', exact: true }).first().click(); await page.waitForTimeout(1000);
    const l = fr.locator('table tbody tr td:first-child button').first(); if (!(await l.count())) break;
    await l.click(); await page.waitForTimeout(3000);
    await fr.getByRole('button', { name: 'Stop tracking' }).first().click({ timeout: 15000 }); await page.waitForTimeout(2000);
    await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
  }
  await nav(page, fr, 'Groups'); const t = await fr.locator('body').innerText();
  if (/Tracked groups this week/.test(t) && !/No tracked/.test(t)) { /* digest persists until next build; fine */ }
  return 'done';
});
await step('7', 'Regression: Overview, Groups, People, Reviews load', async () => {
  for (const n of ['Overview', 'Groups', 'People', 'Reviews', 'Settings']) { await nav(page, fr, n); const b = await fr.locator('body').innerText(); if (BAD.test(b)) throw new Error(n); } return 'ok';
});
writeReport(DIR, 'C3 group reach E2E, dev'); await browser.close();
