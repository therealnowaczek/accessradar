import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { open, openApp, dismissCookies, setEdition, step, writeReport } from './lib.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-c1'; fs.mkdirSync(DIR, { recursive: true });
const nav = async (page, fr, n) => { await fr.getByRole('button', { name: new RegExp('^' + n) }).first().click({ timeout: 15000 }); await page.waitForTimeout(3500); };
const { browser, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
await step('1', 'Advanced: evidence pack PDF of a signed review has the mapping (SOC 2, ISO, NIS2)', async () => {
  await setEdition(page, fr, 'Advanced'); await nav(page, fr, 'Reviews');
  await fr.getByText(/E2E C5 sign/).first().click({ timeout: 20000 }); await page.waitForTimeout(6000);
  const dl = page.waitForEvent('download', { timeout: 120000 });
  await fr.getByRole('button', { name: 'Download evidence pack' }).first().click();
  const d = await dl; const f = DIR + '/evidence-pack.pdf'; await d.saveAs(f);
  const txt = execSync(`pdftotext -layout ${f} -`).toString(); fs.writeFileSync(DIR + '/evidence-pack.txt', txt);
  const need = ['Control mapping', 'Mapping version 2', 'CC6.1', 'CC6.2', 'CC6.3', 'A.5.15', 'A.5.18', 'A.8.2', 'NIS2', 'Art. 21(2)(i)', 'Art. 21(2)(f)', 'supports evidence collection', 'not a statement of compliance'];
  const miss = need.filter((n) => !txt.replace(/\s+/g, ' ').includes(n)); if (miss.length) throw new Error('missing: ' + miss.join(', '));
  if (/makes you compliant|is compliant|certified/i.test(txt)) throw new Error('compliance claim in pack');
  if (txt.includes('—')) throw new Error('em dash in pack');
  return `${txt.length} chars`;
});
await step('2', 'Standard: pack still gated (no download button)', async () => {
  await setEdition(page, fr, 'Standard'); await nav(page, fr, 'Reviews');
  await fr.getByText(/E2E C5 sign/).first().click({ timeout: 20000 }); await page.waitForTimeout(5000);
  const n = await fr.getByRole('button', { name: 'Download evidence pack' }).count();
  await page.screenshot({ path: DIR + '/standard.png' });
  await setEdition(page, fr, 'Use the license');
  return n ? 'button present on Standard' : 'gated';
});
await step('3', 'Regression: Reviews and Overview load', async () => {
  for (const n of ['Overview', 'Reviews']) { await nav(page, fr, n); const b = await fr.locator('body').innerText(); if (/Something went wrong|TypeError/.test(b)) throw new Error(n); } return 'ok';
});
writeReport(DIR, 'C1 control mapping E2E, dev'); await browser.close();
