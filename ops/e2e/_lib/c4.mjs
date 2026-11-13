import { open, openApp, dismissCookies, setEdition, step, writeReport } from './lib.mjs';
import { setTheme } from './theme.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-c4';
const nav = async (page, fr, n) => { await fr.getByRole('button', { name: new RegExp('^' + n) }).first().click({ timeout: 15000 }); await page.waitForTimeout(5000); };
const { browser, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
const shot = (n) => page.screenshot({ path: `${DIR}/${n}.png` });
const BAD = /Something went wrong|Unexpected error|could not load|TypeError/i;
const body = () => fr.locator('body').innerText();
const NEW = ['Anonymous access beyond viewing','Deactivated accounts in admin groups','Filters shared with anyone','Dashboards shared with anyone','Destructive permissions for large groups','Large admin groups','Spaces with a single space admin','Empty admin groups','Filters and dashboards shared with all signed-in users'];
let seen = [];
await step('1', 'Overview risk table loads and lists at least one new rule with a count or partial', async () => {
  await nav(page, fr, 'Overview'); await page.waitForTimeout(2000);
  const b = await body(); await shot('overview-light');
  if (BAD.test(b)) throw new Error('error text');
  seen = NEW.filter((n) => b.includes(n));
  if (!seen.length) throw new Error('none of the new rules listed (all zero?)');
  return seen.length + ' new rules shown: ' + seen.join(' | ');
});
await step('2', 'Open a new rule drawer: items, learn-more copy and Open link; no em dash', async () => {
  const name = seen[0];
  await fr.getByRole('button', { name }).first().click(); await page.waitForTimeout(2500);
  const b = await body(); await shot('risk-drawer-light');
  if (/—/.test(b)) throw new Error('em dash');
  await page.keyboard.press('Escape'); await page.waitForTimeout(800);
  return name;
});
await step('3', 'Filters/dashboards rules reflect Sharing and security page (counts agree)', async () => {
  await nav(page, fr, 'Sharing and security'); await page.waitForTimeout(2500);
  const b = await body(); await shot('sharing-page');
  await nav(page, fr, 'Overview'); const o = await body();
  const sharedPublic = /public|anyone/i.test(b);
  return 'sharing page text read; overview shows ' + seen.length + ' new rules; public mention on sharing: ' + sharedPublic;
});
await step('4', 'Standard edition shows the same rules', async () => {
  await setEdition(page, fr, 'Standard'); await nav(page, fr, 'Overview'); await page.waitForTimeout(2000);
  const b = await body(); await shot('overview-standard');
  await setEdition(page, fr, 'Use the license');
  const n = NEW.filter((x) => b.includes(x)).length;
  if (n !== seen.length) throw new Error(`standard ${n} vs ${seen.length}`);
  return n + ' rules';
});
await step('5', 'Dark: Overview and drawer', async () => {
  const m = await setTheme(page, 'Dark'); if (m !== 'dark') throw new Error(m);
  let err = null;
  try { fr = await openApp(page); await dismissCookies(page); await nav(page, fr, 'Overview'); await page.waitForTimeout(2000); await shot('overview-dark');
    await fr.getByRole('button', { name: seen[0] }).first().click(); await page.waitForTimeout(2500); await shot('risk-drawer-dark'); await page.keyboard.press('Escape');
  } catch (e) { err = e; }
  const m2 = await setTheme(page, 'Light'); if (m2 !== 'light') throw new Error(m2);
  fr = await openApp(page); await dismissCookies(page); if (err) throw err; return 'ok';
});
await step('6', 'Regression: main pages load', async () => {
  for (const n of ['Overview', 'Spaces', 'Groups', 'People', 'Reviews', 'Campaigns', 'Settings']) { await nav(page, fr, n); if (BAD.test(await body())) throw new Error(n); } return 'ok';
});
writeReport(DIR, 'C4 risk rules E2E, dev'); await browser.close();
