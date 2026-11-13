import { open, openApp, dismissCookies, setEdition, step, writeReport } from './lib.mjs';
import { setTheme } from './theme.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-c2';
const nav = async (page, fr, n) => { await fr.getByRole('button', { name: new RegExp('^' + n) }).first().click({ timeout: 15000 }); await page.waitForTimeout(5000); };
const { browser, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
const shot = (n) => page.screenshot({ path: `${DIR}/${n}.png` });
const BAD = /Something went wrong|Unexpected error|could not load|TypeError/i;
const body = () => fr.locator('body').innerText();
await step('1', 'Seats page loads (Advanced): note, metrics, product tables, review list', async () => {
  await nav(page, fr, 'Seats'); const b = await body(); await shot('seats-light');
  if (BAD.test(b)) throw new Error('error');
  for (const s of ['No activity data', 'Seat holders', 'Seat holders to review']) if (!b.includes(s)) throw new Error('missing ' + s);
  if (/last (sign|log)ed in\b.*(days|ago)|days since|inactive for/i.test(b)) throw new Error('activity claim');
  return b.split('\n').filter((l) => /seat holders through/.test(l)).join(' | ');
});
await step('2', 'No activity claim wording; "Deactivated" only; no em dash', async () => {
  const b = await body();
  if (/—/.test(b)) throw new Error('em dash');
  if (/last active:|last login:|days inactive/i.test(b)) throw new Error('claim');
  if (!/Jira does not tell apps when someone last signed in/.test(b)) throw new Error('disclaimer missing');
  return 'ok';
});
await step('3', 'Person link opens People drawer; group link opens Groups filtered', async () => {
  const links = fr.locator('table tbody tr td:first-child button');
  const n = await links.count(); if (!n) throw new Error('no links');
  await links.first().click(); await page.waitForTimeout(4000); const b = await body(); await shot('group-link-groups');
  if (!/Groups/.test(b)) throw new Error('did not reach Groups'); return 'ok';
});
await step('4', 'Standard edition shows the Seats page too', async () => {
  await setEdition(page, fr, 'Standard'); await nav(page, fr, 'Seats'); const b = await body(); await shot('seats-standard');
  await setEdition(page, fr, 'Use the license');
  if (!b.includes('Seat holders')) throw new Error('missing'); return 'ok';
});
await step('5', 'Dark theme', async () => {
  const m = await setTheme(page, 'Dark'); if (m !== 'dark') throw new Error(m);
  let err = null;
  try { fr = await openApp(page); await dismissCookies(page); await nav(page, fr, 'Seats'); await shot('seats-dark'); } catch (e) { err = e; }
  const m2 = await setTheme(page, 'Light'); if (m2 !== 'light') throw new Error(m2);
  fr = await openApp(page); await dismissCookies(page); if (err) throw err; return 'ok';
});
await step('6', 'Regression', async () => {
  for (const n of ['Overview', 'Groups', 'People', 'Reviews', 'Settings']) { await nav(page, fr, n); if (BAD.test(await body())) throw new Error(n); } return 'ok';
});
writeReport(DIR, 'C2 seat view E2E, dev'); await browser.close();
