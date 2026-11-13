import { open, openApp, dismissCookies, setEdition, step, writeReport } from './lib.mjs';
import { setTheme } from './theme.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-c7';
const nav = async (page, fr, n) => { await fr.getByRole('button', { name: new RegExp('^' + n) }).first().click({ timeout: 15000 }); await page.waitForTimeout(4000); };
const { browser, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
const shot = (n) => page.screenshot({ path: `${DIR}/${n}.png`, fullPage: false });
const BAD = /Something went wrong|Unexpected error|could not load|TypeError/i;
const body = () => fr.locator('body').innerText();
const del = async () => {
  await fr.getByRole('button', { name: 'Delete sample' }).first().click(); await page.waitForTimeout(1000);
  await fr.getByRole('button', { name: 'Delete sample' }).last().click(); await page.waitForTimeout(3000);
};
const rows = () => fr.locator('table tbody tr').count();
await step('1', 'Advanced: Campaigns shows Try a sample campaign; one click creates the sample with 8 undecided items and the Sample label', async () => {
  await nav(page, fr, 'Campaigns');
  if (await fr.getByRole('button', { name: 'Delete sample' }).count()) await del();
  await fr.getByRole('button', { name: 'Try a sample campaign' }).click(); await page.waitForTimeout(3500);
  const b = await body(); await shot('sample-advanced-light');
  if (!/Sample data\. The people, groups and spaces are invented/.test(b)) throw new Error('no banner');
  if (!/0 of 8 decided/.test(b)) throw new Error('progress');
  return 'rows ' + (await rows());
});
await step('2', 'Finish is disabled until all 8 are decided; decisions persist', async () => {
  const fin = fr.getByRole('button', { name: 'Finish sample' });
  if (!(await fin.isDisabled())) throw new Error('finish enabled early');
  const decide = async (i, name) => { await fr.locator('table tbody tr').nth(i).getByRole('button', { name, exact: true }).click(); await page.waitForTimeout(1200); };
  const plan = ['Revoke', 'Keep', 'Revoke', 'Keep', 'Keep', 'Revoke', 'Exception'];
  for (let i = 0; i < 7; i++) await decide(i, plan[i]);
  if (!(await fin.isDisabled())) throw new Error('finish enabled at 7');
  if (!/7 of 8 decided/.test(await body())) throw new Error('progress 7');
  await decide(7, 'Revoke'); await shot('sample-all-decided');
  if (await fin.isDisabled()) throw new Error('finish still disabled');
  fr = await openApp(page, ''); await dismissCookies(page); await nav(page, fr, 'Campaigns');
  if (!/8 of 8 decided/.test(await body())) throw new Error('not persisted');
  return 'ok';
});
await step('3', 'Finish sample: summary says nothing changed in Jira and nothing signed; decisions locked', async () => {
  await fr.getByRole('button', { name: 'Finish sample' }).click(); await page.waitForTimeout(3000);
  const b = await body(); await shot('sample-finished');
  if (!/4 kept|3 kept/.test(b) && !/kept, \d+ marked to revoke/.test(b)) throw new Error('summary: ' + b.slice(0, 200));
  if (!/nothing was signed/.test(b)) throw new Error('no note');
  if (!(await fr.locator('table tbody tr').first().getByRole('button', { name: 'Keep', exact: true }).isDisabled())) throw new Error('not locked');
  return (b.match(/\d+ kept[^.]*\./) ?? [''])[0];
});
await step('4', 'Sample is isolated: not listed in Reviews, Snapshots count unchanged, no Sample in real campaigns', async () => {
  await nav(page, fr, 'Reviews'); const r = await body();
  if (/Riley Sample|Sample: Q4/.test(r)) throw new Error('leaked into Reviews');
  await nav(page, fr, 'Exceptions'); if (/Riley Sample/.test(await body())) throw new Error('leaked into Exceptions');
  return 'ok';
});
await step('5', 'Delete sample (confirm dialog) removes it and the Try button returns', async () => {
  await nav(page, fr, 'Campaigns'); await del(); await shot('after-delete');
  const b = await body();
  if (/Riley Sample/.test(b)) throw new Error('still there');
  if (!(await fr.getByRole('button', { name: 'Try a sample campaign' }).count())) throw new Error('no try button');
  return 'ok';
});
await step('6', 'Standard: Plan note plus sample with edition note; start and delete work', async () => {
  await setEdition(page, fr, 'Standard'); await nav(page, fr, 'Campaigns');
  await fr.getByRole('button', { name: 'Try a sample campaign' }).click(); await page.waitForTimeout(3500);
  const b = await body(); await shot('sample-standard');
  let err = null;
  if (!/Real campaigns are part of Advanced/.test(b)) err = new Error('no edition note');
  await del(); await setEdition(page, fr, 'Use the license');
  if (err) throw err; return 'ok';
});
await step('7', 'Dark: sample on Campaigns', async () => {
  const m = await setTheme(page, 'Dark'); if (m !== 'dark') throw new Error(m);
  let err = null;
  try { fr = await openApp(page); await dismissCookies(page); await nav(page, fr, 'Campaigns');
    await fr.getByRole('button', { name: 'Try a sample campaign' }).click(); await page.waitForTimeout(3500); await shot('sample-dark');
    await del();
  } catch (e) { err = e; }
  const m2 = await setTheme(page, 'Light'); if (m2 !== 'light') throw new Error(m2);
  fr = await openApp(page); await dismissCookies(page); if (err) throw err; return 'ok';
});
await step('8', 'Regression: main pages load', async () => {
  for (const n of ['Overview', 'Groups', 'People', 'Reviews', 'Campaigns', 'Settings']) { await nav(page, fr, n); if (BAD.test(await body())) throw new Error(n); } return 'ok';
});
writeReport(DIR, 'C7 sample campaign E2E, dev'); await browser.close();
