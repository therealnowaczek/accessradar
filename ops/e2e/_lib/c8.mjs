import { open, openApp, dismissCookies, setEdition, step, writeReport, SITE, APP, DEV } from './lib.mjs';
import { setTheme } from './theme.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-c8';
const nav = async (page, fr, n) => { await fr.getByRole('button', { name: new RegExp('^' + n) }).first().click({ timeout: 15000 }); await page.waitForTimeout(4000); };
const { browser, page } = await open();
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
const submitSelf = async (tag) => {
  await fr.getByRole('button', { name: 'Start a review of this space' }).click({ timeout: 15000 }); await page.waitForTimeout(6000);
  let b = await body(); await shot(`started-${tag}`);
  if (!/Self review ARTEST/.test(b)) throw new Error('no review banner: ' + b.slice(0, 200));
  const items = (b.match(/Items\s*\n?\s*(\d+)/) ?? [])[1];
  await fr.getByRole('button', { name: /Keep remaining/ }).first().click(); await page.waitForTimeout(5000);
  const submit = fr.getByRole('button', { name: 'Submit review' });
  if (await submit.isDisabled()) throw new Error('submit still disabled after keep remaining');
  await submit.click(); await page.waitForTimeout(5000);
  b = await body(); await shot(`submitted-${tag}`);
  return items;
};
await step('1', 'Advanced: project page offers "Start a review of this space" (no campaign)', async () => {
  await projectPage(); const b = await body(); await shot('project-empty-light');
  if (!/Start a review of this space/.test(b)) throw new Error('no start button: ' + b.slice(0, 200));
  if (/—/.test(b)) throw new Error('em dash');
  return 'ok';
});
await step('2', 'Advanced: start, keep remaining, submit a self review of ARTEST', async () => {
  const n = await submitSelf('advanced'); return 'items ' + n;
});
await step('3', 'Submitted self review is visible to the Jira admin in Reviews', async () => {
  await mainApp(); await nav(page, fr, 'Reviews'); const b = await body(); await shot('reviews-list');
  if (!/Self review ARTEST/.test(b)) throw new Error('not listed'); return 'ok';
});
await step('4', 'Standard edition: project page still offers self review; start and submit work', async () => {
  await mainApp(); await setEdition(page, fr, 'Standard');
  let err = null, items;
  try { await projectPage(); const b = await body(); await shot('project-empty-standard');
    if (!/Start a review of this space/.test(b)) throw new Error('no start on Standard: ' + b.slice(0, 200));
    items = await submitSelf('standard');
  } catch (e) { err = e; }
  await mainApp(); await setEdition(page, fr, 'Use the license');
  if (err) throw err; return 'items ' + items;
});
await step('5', 'Dark: project page empty state and open review', async () => {
  const m = await setTheme(page, 'Dark'); if (m !== 'dark') throw new Error(m);
  let err = null;
  try { await projectPage(); await shot('project-empty-dark');
    await fr.getByRole('button', { name: 'Start a review of this space' }).click(); await page.waitForTimeout(6000); await shot('project-review-dark');
  } catch (e) { err = e; }
  const m2 = await setTheme(page, 'Light'); if (m2 !== 'light') throw new Error(m2);
  if (err) throw err; return 'ok';
});
await step('6', 'Cleanup: delete the three test self reviews', async () => {
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
await step('7', 'Regression: main pages load', async () => {
  for (const n of ['Overview', 'Reviews', 'Campaigns', 'Settings']) { await nav(page, fr, n); if (BAD.test(await body())) throw new Error(n); } return 'ok';
});
writeReport(DIR, 'C8 project self review E2E, dev'); await browser.close();
