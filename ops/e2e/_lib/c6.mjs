import { open, openApp, dismissCookies, setEdition, step, writeReport, SITE, APP, DEV } from './lib.mjs';
import { setTheme } from './theme.mjs';
import fs from 'node:fs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-c6';
const nav = async (page, fr, n) => { await fr.getByRole('button', { name: new RegExp('^' + n) }).first().click({ timeout: 15000 }); await page.waitForTimeout(4000); };
const { browser, page } = await open();
const errors = [];
page.on('pageerror', (e) => { if (!/import.meta/.test(String(e))) errors.push(String(e).slice(0, 200)); });
let fr = await openApp(page); await dismissCookies(page);
const shot = (n) => page.screenshot({ path: `${DIR}/${n}.png` });
const BAD = /Something went wrong|Unexpected error|could not load|TypeError/i;
const body = () => fr.locator('body').innerText();
const projectPage = async () => {
  await page.goto(`${SITE}/jira/software/projects/ARTEST/settings/apps/${APP}/${DEV}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000); await dismissCookies(page);
  fr = page.frameLocator('iframe').first();
};
const mainApp = async () => { fr = await openApp(page); await dismissCookies(page); };
const openReview = async () => { await nav(page, fr, 'Reviews'); await fr.getByRole('button', { name: /Self review ARTEST/ }).first().click(); await page.waitForTimeout(4000); };
let before, after;
const stateOf = async () => { const b = await body(); return { status: (b.match(/\b(Draft|Open|Signed|Submitted|In progress)\b/) ?? [])[0], pendingTxt: (b.match(/Pending\s*\n?\s*\d+/) ?? [])[0], decided: (b.match(/Decided\s*\n?\s*\d+/) ?? [])[0] }; };
try {
await step('0', 'Setup: Advanced edition, start self review of ARTEST (own test data)', async () => {
  await setEdition(page, fr, 'Advanced');
  await projectPage();
  const btn = fr.getByRole('button', { name: 'Start a review of this space' });
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(6000); }
  const b = await body(); if (!/Self review ARTEST/.test(b)) throw new Error('no review: ' + b.slice(0, 200)); return 'ok';
});
await step('1', 'Advanced light: Suggest review order (AI): pills + reasons, nothing decided', async () => {
  await mainApp(); await openReview();
  await shot('before-light'); before = await body();
  const s0 = await stateOf();
  const btn = fr.getByRole('button', { name: /Suggest review order/ });
  await btn.click({ timeout: 15000 });
  await fr.getByText(/AI: look/).first().waitFor({ timeout: 90000 }).catch(async () => { await shot('fail-1'); throw new Error('no pills: ' + (await body()).slice(0, 300)); });
  await page.waitForTimeout(1500); after = await body(); await fr.getByText(/AI: look/).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await shot('suggest-light');
  const pills = (after.match(/AI: (look first|look next|lower priority)/g) ?? []).length;
  const s1 = await stateOf();
  if (JSON.stringify(s0) !== JSON.stringify(s1)) throw new Error('state changed ' + JSON.stringify([s0, s1]));
  if (!/AI suggestions/.test(after)) throw new Error('no suggestion banner');
  fs.writeFileSync(DIR + '/after-text.txt', after);
  return `pills ${pills}; state ${JSON.stringify(s1)}`;
});
await step('2', 'Reasons: no names, emails, account ids, activity claims', async () => {
  const lines = after.split('\n');
  const reasons = lines.filter((l, i) => /^AI: /.test(lines[i - 1] ?? '') ).map(l => l.trim());
  const txt = reasons.join('\n');
  if (!reasons.length) throw new Error('no reasons parsed');
  if (/@|[0-9a-f]{24}|\d{6}:[0-9a-f-]{20,}/i.test(txt)) throw new Error('email/id: ' + txt.slice(0, 200));
  if (/last (login|sign|active|seen)|inactive|hasn.t (logged|signed)|not used|unused|dormant|stale/i.test(txt)) throw new Error('activity claim: ' + txt.slice(0, 300));
  fs.writeFileSync(DIR + '/reasons.txt', txt);
  return `${reasons.length} reasons checked`;
});
await step('3', 'Advanced dark: view renders, pills readable', async () => {
  const m = await setTheme(page, 'Dark'); if (m !== 'dark') throw new Error(m);
  let err = null;
  try { await mainApp(); await openReview(); await shot('before-dark');
    await fr.getByRole('button', { name: /Suggest review order/ }).click();
    await fr.getByText(/AI: look/).first().waitFor({ timeout: 90000 }); await page.waitForTimeout(1500); await fr.getByText(/AI: look/).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await shot('suggest-dark');
  } catch (e) { err = e; }
  const m2 = await setTheme(page, 'Light'); if (m2 !== 'light') throw new Error(m2);
  if (err) throw err; return 'ok';
});
await step('4', 'Standard light: no Suggest button; resolver refused', async () => {
  await mainApp(); await setEdition(page, fr, 'Standard'); let err = null, note = '';
  try {
    await openReview(); await fr.getByRole('button', { name: /Keep all|Keep/ }).first().scrollIntoViewIfNeeded().catch(() => {}); await shot('standard-light');
    const n = await fr.getByRole('button', { name: /Suggest review order/ }).count();
    if (n) throw new Error('button present on Standard');
    // try the resolver via bridge from the iframe is not available from here; server gate covered by unit test
    note = 'no button; server refusal via test/presort.test.ts (Advanced-only gate)';
  } catch (e) { err = e; }
  if (err) throw err; return note;
});
await step('5', 'Standard dark: renders without button', async () => {
  const m = await setTheme(page, 'Dark'); if (m !== 'dark') throw new Error(m);
  let err = null;
  try { await mainApp(); await openReview(); await fr.getByRole('button', { name: /Keep all|Keep/ }).first().scrollIntoViewIfNeeded().catch(() => {}); await shot('standard-dark');
    if (await fr.getByRole('button', { name: /Suggest review order/ }).count()) throw new Error('button on Standard');
    if (BAD.test(await body())) throw new Error('error text');
  } catch (e) { err = e; }
  const m2 = await setTheme(page, 'Light'); if (m2 !== 'light') throw new Error(m2);
  await mainApp(); await setEdition(page, fr, 'Use the license');
  if (err) throw err; return 'ok';
});
} finally {
await step('c', 'Cleanup: delete test self reviews', async () => {
  await mainApp(); let n = 0;
  for (let i = 0; i < 5; i++) {
    await nav(page, fr, 'Reviews');
    const link = fr.getByRole('button', { name: /Self review ARTEST/ }).first();
    if (!(await link.count())) break;
    await link.click(); await page.waitForTimeout(3500);
    await fr.getByRole('button', { name: 'Delete', exact: true }).first().click({ timeout: 10000 }); await page.waitForTimeout(1200);
    await fr.getByRole('button', { name: 'Delete review' }).last().click(); await page.waitForTimeout(3500); n++;
  }
  await nav(page, fr, 'Reviews'); if (/Self review ARTEST/.test(await body())) throw new Error('left over');
  return 'deleted ' + n;
});
}
await step('7', 'Regression: Reviews, Seats, Overview, Settings load without page errors', async () => {
  await mainApp();
  for (const n of ['Reviews', 'Seats', 'Overview', 'Settings']) { await nav(page, fr, n); await shot('reg-' + n.toLowerCase()); if (BAD.test(await body())) throw new Error(n); }
  if (errors.length) throw new Error('pageerrors: ' + errors.join(' | '));
  return 'ok';
});
writeReport(DIR, 'C6 AI pre-sort E2E, dev', 'Note: Jira itself emits "Cannot use import.meta outside a module" page errors on every page, also with no app loaded (verified on /jira/your-work); excluded from step 7.\n'); await browser.close();
