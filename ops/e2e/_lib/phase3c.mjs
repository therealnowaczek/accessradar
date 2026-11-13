import fs from 'node:fs';
import { open, openApp, nav as nav0, dismissCookies, setEdition, step, writeReport } from './lib.mjs';
const nav = async (page, fr, n) => { await fr.getByRole('button', { name: new RegExp('^' + n) }).first().click({ timeout: 15000 }); await page.waitForTimeout(3500); };
const T = process.argv[2] || 'dark';
const DIR = `/workspace/radrly/accessradar/e2e/2026-11-12-phase-3c`;
const { browser, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
const shot = (n) => page.screenshot({ path: `${DIR}/${T}-${n}.png` });
const BAD = /Something went wrong|Unexpected error|could not load|Cannot read|undefined is not|TypeError/i;
await step(`${T}.0`, 'Theme applied in Jira and app', async () => {
  const mode = await page.evaluate(() => document.documentElement.getAttribute('data-color-mode'));
  if (mode !== T) throw new Error('jira mode ' + mode);
  const bg = await fr.locator('body').evaluate(() => getComputedStyle(document.body).backgroundColor);
  const m = bg.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
  const lum = (m[0] + m[1] + m[2]) / 3;
  if (T === 'dark' && lum > 90) throw new Error('app bg not dark ' + bg);
  if (T === 'light' && lum < 200) throw new Error('app bg not light ' + bg);
  return `bg ${bg}`;
});
for (const ed of ['Advanced', 'Standard']) {
  const E = ed.toLowerCase();
  await step(`${T}.1 ${E}`, `Sharing and security (${ed})`, async () => {
    await setEdition(page, fr, ed);
    await nav(page, fr, 'Sharing and security');
    await fr.getByText('Publicly shared filters and dashboards').first().waitFor({ timeout: 60000 });
    await fr.getByText('Issue security levels').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(12000);
    const body = await fr.locator('body').innerText();
    await shot(`exposure-${E}`);
    if (/Approval needed/.test(body)) throw new Error('needs-consent shown after consent');
    if (BAD.test(body)) throw new Error('error: ' + body.slice(0, 200));
    if (E === 'standard' && !/Advanced/.test(body)) throw new Error('audit not gated');
    return /All signed-in users|Anyone/.test(body) ? 'sharing rows' : 'sharing empty';
  });
}
await setEdition(page, fr, 'Use the license');
for (const n of ['Overview', 'Spaces', 'Groups', 'People', 'Changes', 'Reviews', 'Exceptions', 'Alerts', 'Campaigns', 'Snapshots', 'Settings', 'Activity']) {
  await step(`${T}.2 ${n}`, `Regression: ${n} loads`, async () => {
    await nav(page, fr, n); await page.waitForTimeout(5000);
    const b = await fr.locator('body').innerText();
    await shot(`reg-${n.toLowerCase()}`);
    if (BAD.test(b)) throw new Error(b.match(BAD)[0] + ' :: ' + b.slice(0, 120));
    if (b.trim().length < 80) throw new Error('page nearly empty');
    return `${b.length} chars`;
  });
}
await step(`${T}.3`, 'Spaces: open Why panel', async () => {
  await nav(page, fr, 'Spaces'); await page.waitForTimeout(3000);
  await fr.getByText('ARTEST · AccessRadar E2E').first().click(); await page.waitForTimeout(6000);
  const why = fr.getByRole('button', { name: /^Why/ }).first();
  await why.click({ timeout: 15000 });
  await page.waitForTimeout(3000); await shot('why');
  const b = await fr.locator('body').innerText(); if (BAD.test(b)) throw new Error('why error');
  await page.keyboard.press('Escape'); return 'ok';
});
await step(`${T}.4`, 'Reviews: open a review, Verify', async () => {
  await nav(page, fr, 'Reviews'); await page.waitForTimeout(3000);
  await fr.getByText('E2E phase 1 review').first().click({ timeout: 15000 });
  await page.waitForTimeout(4000);
  const v = fr.getByRole('button', { name: /Verify/ }).first();
  await v.click({ timeout: 15000 }); await page.waitForTimeout(6000); await shot('review-verify');
  const b = await fr.locator('body').innerText(); if (BAD.test(b)) throw new Error('verify error');
  const ok = /Verified/.test(b) && !/Mismatch|Failed/i.test(b);
  await fr.getByRole('button', { name: 'Done' }).first().click(); await page.waitForTimeout(1500);
  if (!ok) throw new Error('signature not Verified');
  return 'signature Verified';
});
await step(`${T}.5`, 'Snapshots: take a snapshot', async () => {
  await nav(page, fr, 'Snapshots'); await page.waitForTimeout(3000);
  await fr.getByRole('button', { name: /(Take|Create).*snapshot|Snapshot now/i }).first().click({ timeout: 15000 });
  await page.waitForTimeout(15000); await shot('snapshot');
  const b = await fr.locator('body').innerText(); if (BAD.test(b)) throw new Error('snapshot error');
  return 'ok';
});
writeReport(DIR, `AccessRadar phase 3 E2E (${T}), dev`, '');
fs.renameSync(DIR + '/report.md', `${DIR}/report-${T}.md`);
await browser.close();
