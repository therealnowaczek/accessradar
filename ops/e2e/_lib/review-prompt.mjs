import fs from 'node:fs';
import { open, openApp, dismissCookies, setEdition, step, writeReport, results } from './lib.mjs';
import { setTheme } from './theme.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-review-prompt';
const PART = process.argv[2] || 'a';
const URL_ = 'https://marketplace.atlassian.com/apps/3691498947/accessradar-access-review-permission-audit-for-jira?tab=reviews&hosting=cloud';
const TITLE = 'Enjoying AccessRadar?';
const BODY = 'A short review on the Atlassian Marketplace helps other teams find it. It takes about a minute, and nothing in AccessRadar depends on it.';
const { browser, ctx, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
const shot = (n, loc) => (loc ?? page).screenshot({ path: `${DIR}/${n}.png` });
const nav = async (n) => { await fr.getByRole('button', { name: new RegExp('^' + n) }).first().click({ timeout: 15000 }); await page.waitForTimeout(3500); };
const msg = () => fr.locator(`section:has(h2:text-is("${TITLE}"))`).first();
const prompt = () => fr.getByText(TITLE, { exact: true });
const ready = () => fr.getByRole('button', { name: /Take snapshot now/ }).first().waitFor({ timeout: 40000 });
const reload = async () => { fr = await openApp(page); await dismissCookies(page); await ready(); };
const reset = async () => { await nav('Settings'); await fr.getByRole('button', { name: 'Reset review prompt' }).first().click({ timeout: 20000 }); await page.waitForTimeout(2500); await nav('Overview'); };
const exact = async () => {
  await prompt().first().waitFor({ timeout: 30000 });
  const m = msg();
  const txt = await m.innerText();
  if (!txt.includes(TITLE) || !txt.includes(BODY)) throw new Error('copy mismatch: ' + txt.slice(0, 300));
  const btns = (await m.getByRole('button').allInnerTexts()).map((s) => s.trim());
  const links = (await m.getByRole('link').allInnerTexts()).map((s) => s.trim());
  const actions = [...btns, ...links].sort();
  if (JSON.stringify(actions) !== JSON.stringify(['I already reviewed', 'Not now', 'Write a review'].sort())) throw new Error('actions: ' + actions);
  if (await m.getByRole('button', { name: /dismiss|close/i }).count()) throw new Error('has X');
  if (await m.locator('p a, p button').count()) throw new Error('link in body');
  const top = await fr.locator('h1,h2,h3').evaluateAll((els) => els.map((e) => e.tagName + ':' + e.textContent.trim().slice(0, 40)));
  const iH2 = top.findIndex((s) => s === 'H2:' + TITLE);
  const firstH2 = top.findIndex((s) => s.startsWith('H2:'));
  if (iH2 !== firstH2) throw new Error('not first h2 in body: ' + top.join(' | '));
  return 'copy, 3 actions, no X, no body link, first section after header';
};

if (PART === 'a') {
  await step('0.reset', 'Dev-only reset of review-prompt kv (Settings > Developer spike)', async () => { await reset(); return 'reset; prompt hidden before reset = answered earlier (C11 left it done)'; });
  await step('1', 'Advanced, EN, light: prompt top of Overview, exact copy', async () => {
    await setEdition(page, fr, 'Advanced'); await nav('Overview'); await ready();
    const r = await exact();
    await page.screenshot({ path: '/workspace/radrly/accessradar/review-prompt-dev-en-light.png' });
    await shot('1-advanced-light-full'); return r;
  });
  await step('2', 'Standard, EN, light: prompt shown', async () => {
    await setEdition(page, fr, 'Standard'); await nav('Overview'); await ready();
    const r = await exact(); await shot('2-standard-light'); return r;
  });
  await setEdition(page, fr, 'Use the license');
  await step('3', 'Dark theme renders correctly', async () => {
    const mode = await setTheme(page, 'Dark'); if (mode !== 'dark') throw new Error('mode ' + mode);
    await reload(); await exact(); await shot('3-dark'); return 'dark ok';
  });
  await step('3b', 'Theme back to Light', async () => { const m = await setTheme(page, 'Light'); if (m !== 'light') throw new Error(m); return m; });
  await step('4', 'pl-PL shows translated text, then back to English', async () => {
    const setLang = async (name) => {
      await page.goto('https://id.atlassian.com/manage-profile/account-preferences', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000);
      await page.locator('[role="combobox"]').first().click(); await page.waitForTimeout(500);
      await page.getByRole('option', { name, exact: true }).first().click(); await page.waitForTimeout(4000);
    };
    try {
      await setLang('Polski');
      fr = await openApp(page); await dismissCookies(page);
      await fr.getByText('Podoba Ci się AccessRadar?', { exact: true }).first().waitFor({ timeout: 40000 });
      const t = await fr.locator('section:has(h2)').first().innerText();
      for (const s of ['Krótka opinia w Atlassian Marketplace', 'nic w AccessRadar od niej nie zależy', 'Napisz opinię', 'Już napisałem(-am) opinię', 'Nie teraz']) if (!t.includes(s)) throw new Error('missing ' + s);
      await shot('4-pl-PL');
    } finally { await setLang('English (US)'); }
    await reload(); await exact(); return 'pl-PL ok, English restored';
  });
}
if (PART === 'b') {
  await step('5', 'Write a review calls router.open with exact URL, hides prompt', async () => {
    await reset();
    const seen = [];
    await ctx.route(/marketplace\.atlassian\.com/, (route) => { seen.push(route.request().url()); route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }); });
    const pop = ctx.waitForEvent('page', { timeout: 25000 }); pop.catch(() => {});
    await fr.getByText('Write a review', { exact: true }).first().click();
    const np = await pop; await np.waitForLoadState('domcontentloaded').catch(() => {}); await page.waitForTimeout(2500);
    const main = seen.find((u) => u.includes('/apps/')) ?? np.url();
    await np.close(); await ctx.unroute(/marketplace\.atlassian\.com/);
    if (main !== URL_) throw new Error('opened ' + main);
    await page.waitForTimeout(1500);
    if (await prompt().count()) throw new Error('still visible');
    return 'opened ' + main + '; no review posted (request stubbed)';
  });
  await step('6a', 'Not now persists: reload, away and back', async () => {
    await reset(); await prompt().first().waitFor({ timeout: 30000 });
    await fr.getByText('Not now', { exact: true }).first().click(); await page.waitForTimeout(1500);
    if (await prompt().count()) throw new Error('not hidden immediately');
    await reload(); if (await prompt().count()) throw new Error('back after reload');
    await nav('Reviews'); await nav('Overview'); await ready(); if (await prompt().count()) throw new Error('back after nav');
    await shot('6a-after-not-now'); return 'hidden after answer, reload, nav away/back';
  });
  await step('6b', 'I already reviewed hides, persists after reload', async () => {
    await reset(); await prompt().first().waitFor({ timeout: 30000 });
    await fr.getByText('I already reviewed', { exact: true }).first().click(); await page.waitForTimeout(1500);
    if (await prompt().count()) throw new Error('not hidden immediately');
    await reload(); if (await prompt().count()) throw new Error('back after reload'); return 'hidden';
  });
}
if (PART === 'c' || PART === 'd') {
  const BADP = async () => { const b = await fr.locator('body').innerText(); return b.includes(TITLE); };
  await step('7.0', 'Reset so the prompt is due (visible on Overview)', async () => { await reset(); await exact(); return 'visible on Overview'; });
  await step('7.list', 'Absent on Reviews list', async () => { await nav('Reviews'); await shot('7-reviews-list'); if (await BADP()) throw new Error('prompt present'); return 'absent'; });
  await step('7.detail', 'Absent on review detail (own ARTEST test review, in progress)', async () => {
    await fr.getByText('E2E C5 view 1702').first().click(); await page.waitForTimeout(5000);
    await fr.getByRole('button', { name: 'Sign off' }).first().waitFor({ timeout: 20000 });
    if (await BADP()) throw new Error('prompt present'); await shot('7-review-detail'); return 'absent';
  });
  const dlg = async (id, desc, btn, shotName) => step(id, desc, async () => {
    await fr.getByRole('button', { name: btn }).first().click(); await page.waitForTimeout(2500);
    const d = page.frameLocator('iframe').first().getByRole('dialog'); await d.first().waitFor({ timeout: 10000 });
    if (await BADP()) throw new Error('prompt present'); await shot(shotName);
    await fr.getByRole('button', { name: /^Cancel/ }).first().click(); await page.waitForTimeout(1500);
    return 'absent in dialog, cancelled (nothing signed or deleted)';
  });
  await dlg('7.del', 'Absent in the delete dialog', 'Delete', '7-delete-dialog');
  await step('7.revoke', 'Absent in the Revoke flow (opened, not confirmed)', async () => {
    await fr.getByRole('button', { name: /^Revoke…/ }).first().click(); await page.waitForTimeout(2500);
    if (await BADP()) throw new Error('prompt present'); await shot('7-revoke-dialog');
    await fr.getByRole('button', { name: /^Cancel/ }).first().click(); await page.waitForTimeout(1500); return 'absent, cancelled';
  });
  await nav('Reviews');
  await step('7.exc', 'Absent on Exceptions', async () => { await nav('Exceptions'); if (await BADP()) throw new Error('prompt present'); return 'absent'; });
  await step('7.set', 'Absent on Settings', async () => { await nav('Settings'); if (await BADP()) throw new Error('prompt present'); return 'absent'; });
}
if (PART === 'e') {
  const BADP = async () => (await fr.locator('body').innerText()).includes(TITLE);
  const NAME = 'E2E review-prompt ' + Date.now().toString().slice(-6);
  await step('7e.0', 'Reset so the prompt is due', async () => { await reset(); await exact(); return 'visible on Overview'; });
  await step('7e.create', 'Start-review drawer has no prompt; create own ARTEST test review', async () => {
    await nav('Reviews'); await fr.getByRole('button', { name: 'Start a review' }).first().click(); await page.waitForTimeout(2500);
    if (await BADP()) throw new Error('prompt present in drawer'); await shot('7-start-review-drawer');
    await fr.getByLabel('Name').first().fill(NAME);
    await fr.getByText('Selected spaces', { exact: true }).first().click(); await page.waitForTimeout(1500);
    await page.mouse.click(900, 413); await page.keyboard.type('ARTEST'); await page.waitForTimeout(1500);
    await fr.getByRole('option').first().click(); await page.waitForTimeout(800); await page.waitForTimeout(1500);
    await shot('7-start-review-filled');
    await fr.getByRole('button', { name: 'Start review' }).first().click({ force: true, timeout: 10000 }).catch(async () => { await page.mouse.click(770, 767); }); await page.waitForTimeout(6000);
    await fr.getByText(NAME).first().waitFor({ timeout: 30000 }); return 'created ' + NAME;
  });
  await step('7e.signoff', 'Absent on own review detail, Keep all, sign-off dialog (cancelled, not signed)', async () => {
    if (!(await fr.getByRole('button', { name: 'Sign off' }).count())) { await fr.getByText(NAME).first().click(); await page.waitForTimeout(4000); }
    if (await BADP()) throw new Error('prompt on detail');
    await fr.getByRole('button', { name: 'Keep all' }).first().click(); await page.waitForTimeout(2500);
    const c = fr.getByRole('dialog').getByRole('button', { name: /^Keep/ }); if (await c.count()) { await c.last().click(); await page.waitForTimeout(3500); }
    await page.waitForTimeout(2500);
    if (!(await fr.getByRole('button', { name: 'Sign off' }).first().isEnabled())) { await shot('7e-signoff-disabled'); throw new Error('Sign off disabled'); }
    await fr.getByRole('button', { name: 'Sign off' }).first().click(); await page.waitForTimeout(2500);
    await fr.getByRole('dialog').first().waitFor({ timeout: 10000 });
    if (await BADP()) throw new Error('prompt in sign-off dialog'); await shot('7-signoff-dialog');
    await fr.getByRole('button', { name: /^Cancel/ }).first().click(); await page.waitForTimeout(1500);
    return 'absent in detail and sign-off dialog; cancelled';
  });
  await step('7e.delete', 'Delete own test review (confirm dialog has no prompt)', async () => {
    await fr.getByRole('button', { name: 'Delete' }).first().click(); await page.waitForTimeout(2000);
    if (await BADP()) throw new Error('prompt in delete dialog');
    const d = fr.getByRole('dialog').first(); await d.getByRole('button', { name: /Delete/ }).last().click(); await page.waitForTimeout(5000);
    await nav('Reviews'); if (await fr.getByText(NAME).count()) throw new Error('still listed'); return 'deleted ' + NAME;
  });
  await step('7e.end', 'Final state: answer the prompt (I already reviewed), edition Use the license', async () => {
    await nav('Overview'); await prompt().first().waitFor({ timeout: 30000 });
    await fr.getByText('I already reviewed', { exact: true }).first().click(); await page.waitForTimeout(1500);
    await reload(); if (await prompt().count()) throw new Error('not hidden'); await setEdition(page, fr, 'Use the license'); return 'review-prompt left done';
  });
}
if (PART === 'c') await step('7.end', 'Final state: answer the prompt (I already reviewed), edition Use the license', async () => {
  await nav('Overview'); await prompt().first().waitFor({ timeout: 30000 });
  await fr.getByText('I already reviewed', { exact: true }).first().click(); await page.waitForTimeout(1500);
  await reload(); if (await prompt().count()) throw new Error('not hidden'); await setEdition(page, fr, 'Use the license'); return 'review-prompt left done';
});
fs.writeFileSync(`${DIR}/results-${PART}.json`, JSON.stringify(results, null, 1));
writeReport(DIR, 'Review prompt E2E part ' + PART); fs.renameSync(DIR + '/report.md', `${DIR}/report-${PART}.md`);
await browser.close();
