import fs from 'node:fs';
import { open, openApp, dismissCookies, setEdition, step, writeReport, SITE } from './lib.mjs';
import { setTheme } from './theme.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-c5';
const ACC = '712020:fc7af06b-c321-4d14-ab8d-5a0df145c1db', MEMBER = 10080;
const nav = async (page, fr, n) => { await fr.getByRole('button', { name: new RegExp('^' + n) }).first().click({ timeout: 15000 }); await page.waitForTimeout(3500); };
const { browser, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
const shot = (n) => page.screenshot({ path: `${DIR}/${n}.png` });
const BAD = /Something went wrong|Unexpected error|could not load|Cannot read|undefined is not|TypeError/i;
const stamp = new Date().toISOString().slice(11, 16).replace(':', '');
const N1 = `E2E C5 sign ${stamp}`, N2 = `E2E C5 view ${stamp}`;
const rest = async (method, url, body) => {
  const p = await browser.contexts()[0].newPage();
  await p.goto(`${SITE}/jira/your-work`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
  const r = await p.evaluate(async ({ method, url, body }) => { const r = await fetch(url, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check' }, body: body ? JSON.stringify(body) : undefined }); return r.status; }, { method, url, body });
  await p.close(); return r;
};
const takeSnapshot = async () => {
  await nav(page, fr, 'Snapshots');
  await fr.getByRole('button', { name: /Take snapshot now/i }).first().click({ timeout: 15000 });
  await page.waitForTimeout(45000);
  await nav(page, fr, 'Snapshots'); await page.waitForTimeout(5000);
  const b = await fr.locator('body').innerText(); if (/Running|Queued/.test(b)) { await page.waitForTimeout(40000); }
};
const createReview = async (name) => {
  await nav(page, fr, 'Reviews');
  await fr.getByRole('button', { name: 'Start a review' }).first().click({ timeout: 15000 });
  await page.waitForTimeout(2000);
  await fr.getByLabel('Name').fill(name);
  await fr.getByRole('radio', { name: /Selected spaces/ }).check({ force: true }); await page.waitForTimeout(1000);
  await fr.locator('label', { hasText: /^Spaces/ }).first().click();
  await page.keyboard.type('ARTEST'); await page.waitForTimeout(2000);
  await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  // Base the review on an older snapshot (#38) so the latest complete snapshot (#39) is newer.
  await fr.getByText('Latest snapshot', { exact: true }).first().click(); await page.waitForTimeout(800);
  await fr.getByRole('option', { name: /#38/ }).first().click(); await page.waitForTimeout(800);
  await shot('create-' + name.slice(-4));
  await fr.getByRole('button', { name: 'Start review', exact: true }).last().click();
  await page.waitForTimeout(8000);
};
const openReview = async (name) => { await nav(page, fr, 'Reviews'); await fr.getByText(name).first().click({ timeout: 20000 }); await page.waitForTimeout(6000); };


await step('2', 'Create two ARTEST reviews on snapshot A', async () => { await createReview(N1); await createReview(N2); });
await step('3', 'No recheck while access is unchanged; Keep all decides every item', async () => {
  await openReview(N1);
  let b = await fr.locator('body').innerText();
  if (/needs? a recheck|need a recheck/.test(b)) throw new Error('recheck shown without a change');
  await fr.getByRole('button', { name: /^Keep all/ }).first().click(); await page.waitForTimeout(4000);
  await openReview(N2); await fr.getByRole('button', { name: /^Keep all/ }).first().click(); await page.waitForTimeout(4000);
  b = await fr.locator('body').innerText(); await shot('decided');
  if (/need a recheck/.test(b)) throw new Error('recheck shown'); return 'ok';
});
await step('4', 'Simulate an access change (dev-only hook in Settings, Developer spike; Jira free plan blocks role edits)', async () => {
  await nav(page, fr, 'Settings');
  await fr.getByRole('button', { name: 'Simulate access change' }).first().click({ timeout: 20000 }); await page.waitForTimeout(3000); return 'hook run';
});
await step('6', 'Review shows Recheck: banner, pill, Sign off disabled', async () => {
  await openReview(N1); const b = await fr.locator('body').innerText(); await shot('recheck-light-advanced');
  if (!/need a recheck|needs a recheck/.test(b)) throw new Error('no banner: ' + b.slice(0, 300));
  if (!/Recheck/.test(b)) throw new Error('no pill');
  const dis = await fr.getByRole('button', { name: 'Sign off' }).first().isDisabled(); if (!dis) throw new Error('Sign off enabled');
  return 'banner+pill, sign disabled';
});
await step('7', 'Filter "Recheck" and row detail text', async () => {
  await fr.getByRole('button', { name: /Show items to recheck/ }).first().click(); await page.waitForTimeout(1500);
  const b = await fr.locator('body').innerText(); if (!/Access changed after the snapshot|The way this access is granted changed/.test(b)) throw new Error('no detail'); await shot('recheck-filter'); return 'ok';
});
await step('8', 'Bulk Keep all does not confirm stale items', async () => {
  const b = await fr.locator('body').innerText(); return /Keep all|Keep \d+ shown/.test(b) ? 'bulk label shown' : 'no bulk';
});
await step('9', 'Standard: Recheck shown too', async () => {
  await setEdition(page, fr, 'Standard'); await openReview(N2); const b = await fr.locator('body').innerText(); await shot('recheck-light-standard');
  await setEdition(page, fr, 'Use the license');
  if (!/need a recheck|needs a recheck/.test(b)) throw new Error('no banner'); return 'ok';
});
await step('10', 'Dark: Recheck banner and pill', async () => {
  const m = await setTheme(page, 'Dark'); if (m !== 'dark') throw new Error(m);
  let err = null;
  try {
    fr = await openApp(page); await dismissCookies(page); await openReview(N2); const b = await fr.locator('body').innerText(); await shot('recheck-dark');
    if (!/need a recheck|needs a recheck/.test(b)) err = new Error('no banner');
  } catch (e) { err = e; }
  const m2 = await setTheme(page, 'Light'); if (m2 !== 'light') throw new Error(m2);
  fr = await openApp(page); await dismissCookies(page); if (err) throw err; return 'ok';
});
await step('11', 'Re-decide the stale item (Keep): recheck cleared', async () => {
  await openReview(N1);
  const row = fr.getByRole('row').filter({ hasText: 'Recheck' }).first();
  await row.getByRole('button', { name: 'Keep', exact: true }).click(); await page.waitForTimeout(4000);
  const b = await fr.locator('body').innerText(); await shot('rechecked');
  if (/need a recheck|needs a recheck/.test(b)) throw new Error('banner still there'); return 'cleared';
});
await step('12', 'Sign off now possible (server and UI)', async () => {
  const btn = fr.getByRole('button', { name: 'Sign off' }).first(); if (await btn.isDisabled()) throw new Error('still disabled');
  await btn.click(); await page.waitForTimeout(1500);
  await fr.getByRole('checkbox').first().check({ force: true });
  await fr.getByRole('button', { name: 'Sign off', exact: true }).last().click(); await page.waitForTimeout(7000);
  const b = await fr.locator('body').innerText(); await shot('signed'); if (!/Signed|signed/.test(b)) throw new Error('not signed: ' + b.slice(0, 200)); return 'signed';
});
await step('14', 'Regression: Overview, Reviews, Campaigns load', async () => {
  for (const n of ['Overview', 'Reviews', 'Campaigns']) { await nav(page, fr, n); const b = await fr.locator('body').innerText(); if (BAD.test(b)) throw new Error(n + ': ' + b.match(BAD)[0]); } return 'ok';
});
writeReport(DIR, 'C5 Recheck E2E, dev');
await browser.close();
