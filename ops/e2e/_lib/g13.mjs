import fs from 'node:fs';
import { open, openApp, nav, dismissCookies, setEdition, step, results, exportJson, makeValidator } from './lib.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-11-phase-2';
const validate = makeValidator();
const { browser, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
await setEdition(page, fr, process.env.ED || 'Advanced');
await step('G.1', 'whole-site', async () => {
  await nav(page, fr, 'Spaces');
  const r = await exportJson(page, fr, /Export access matrix/, '^JSON', 'G1-matrix.json', DIR);
  const v = validate(r.doc); if (!v.ok) throw new Error(v.errors);
  return `${r.name} ${r.doc.rows.length} rows`;
});
await step('G.3', 'snapshot', async () => {
  await nav(page, fr, 'Snapshots');
  await page.screenshot({ path: DIR + '/G3-list.png' });
  console.log((await fr.locator('body').innerText()).slice(0, 600));
});
await browser.close();
