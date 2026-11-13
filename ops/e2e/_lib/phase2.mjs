import fs from 'node:fs';
import { open, openApp, nav, dismissCookies, setEdition, step, results, writeReport, exportJson, makeValidator } from './lib.mjs';
const DIR = process.env.OUT || '/workspace/radrly/accessradar/e2e/2026-11-11-phase-2';
const theme = process.env.THEME || 'unknown';
const validate = makeValidator();
const { browser, page } = await open();
page.on('crash', () => console.log('PAGE CRASH')); browser.on('disconnected', () => console.log('BROWSER DISCONNECTED'));
const fr0 = await openApp(page);
await dismissCookies(page);
const shot = (n) => page.screenshot({ path: `${DIR}/${n}.png` });
const check = (name, res, kind) => {
  const v = validate(res.doc);
  if (!v.ok) throw new Error(`schema invalid ${name}: ${v.errors}`);
  if (res.doc.kind !== kind) throw new Error(`kind ${res.doc.kind} != ${kind}`);
  return `${res.name} valid (${kind})`;
};
let fr = fr0;
const reopen = async () => { fr = await openApp(page); };

for (const ed of ['Advanced', 'Standard']) {
  const E = ed.toLowerCase();
  await reopen();
  await step(`2.0 ${E}`, `Set edition override ${ed}`, async () => { await setEdition(page, fr, ed); return 'override saved'; });

  await step(`F.1 ${E}`, `Settings: snapshot schedule options (${ed})`, async () => {
    await nav(page, fr, 'Settings');
    const body = await fr.locator('body').innerText();
    if (/Free plan|every two weeks/i.test(body)) throw new Error('free-tier biweekly copy still shown');
    await fr.getByRole('button', { name: 'Edit' }).first().click();
    await page.waitForTimeout(1200);
    const drawer = await fr.locator('body').innerText();
    const hasDaily = /\nDaily\n/.test(drawer);
    await shot(`F1-schedule-${E}-${theme}`);
    await fr.getByRole('button', { name: 'Cancel' }).first().click();
    if (E === 'standard' && hasDaily) throw new Error('Daily offered on Standard');
    if (E === 'advanced' && !hasDaily) throw new Error('Daily missing on Advanced');
    return E === 'standard' ? 'Weekly and Off only, no free-plan copy' : 'Daily, Weekly, Off';
  });

  await step(`G.1 ${E}`, 'Spaces: whole-site access matrix JSON', async () => {
    await nav(page, fr, 'Spaces');
    await fr.getByRole('button', { name: /Export access matrix/ }).first().click();
    await page.waitForTimeout(500);
    await shot(`G1-spaces-menu-${E}-${theme}`);
    await page.keyboard.press('Escape');
    const r = await exportJson(page, fr, /Export access matrix/, '^JSON', `G1-matrix-${E}.json`, DIR);
    if (!r.doc.rows.length) throw new Error('no rows');
    return check('matrix', r, 'access-matrix') + `, ${r.doc.rows.length} rows`;
  });

  await step(`G.2 ${E}`, 'ARTEST space access JSON', async () => {
    await nav(page, fr, 'Spaces');
    await fr.getByText('AccessRadar E2E', { exact: false }).first().click();
    await page.waitForTimeout(3500);
    const r = await exportJson(page, fr, /^Export$/, '^JSON', `G2-artest-${E}.json`, DIR);
    await shot(`G2-artest-${E}-${theme}`);
    const bad = r.doc.rows.filter((x) => x.project_key !== 'ARTEST');
    if (bad.length) throw new Error('rows outside ARTEST');
    return check('space', r, 'access-matrix') + `, ${r.doc.rows.length} rows, only ARTEST`;
  });

  await step(`G.3 ${E}`, 'Snapshots drawer: access matrix JSON', async () => {
    await nav(page, fr, 'Snapshots');
    await fr.getByRole('button', { name: /#3\d ·/ }).first().click();
    await page.waitForTimeout(2500);
    const r = await exportJson(page, fr, /Export access matrix/, '^JSON', `G3-snapshot-${E}.json`, DIR);
    await shot(`G3-snapshot-${E}-${theme}`);
    return check('snap', r, 'access-matrix');
  });

  await step(`G.4 ${E}`, 'Changes JSON', async () => {
    await reopen();
    await nav(page, fr, 'Changes');
    await page.waitForTimeout(3000);
    const r = await exportJson(page, fr, /^Export$/, '^JSON', `G4-changes-${E}.json`, DIR);
    await shot(`G4-changes-${E}-${theme}`);
    return check('changes', r, 'changes') + `, ${r.doc.rows.length} rows`;
  });

  await step(`G.5 ${E}`, 'Review JSON (signed ARTEST review)', async () => {
    await nav(page, fr, 'Reviews');
    await fr.getByText('E2E phase 1 review', { exact: true }).first().click();
    await page.waitForTimeout(4000);
    const r = await exportJson(page, fr, /^Export$/, '^JSON', `G5-review-${E}.json`, DIR);
    await shot(`G5-review-${E}-${theme}`);
    if (r.doc.review.status !== 'signed' || !r.doc.review.signature?.evidenceHash) throw new Error('signature missing');
    return check('review', r, 'review') + `, ${r.doc.items.length} items`;
  });

  await step(`G.6 ${E}`, E === 'advanced' ? 'Evidence pack JSON downloads and validates' : 'Evidence pack JSON refused on Standard', async () => {
    await fr.getByRole('button', { name: /^Export$/ }).first().click();
    await page.waitForTimeout(500);
    await shot(`G6-menu-${E}-${theme}`);
    if (E === 'advanced') {
      const dl = page.waitForEvent('download', { timeout: 60000 });
      await fr.getByRole('menuitem', { name: /Evidence pack JSON/ }).first().click();
      const d = await dl; const p = `${DIR}/G6-pack-${E}.json`; await d.saveAs(p);
      const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
      return check('pack', { name: d.suggestedFilename(), doc }, 'evidence-pack') + `, ${doc.items.length} items, chain ${doc.header.chainSeq}`;
    }
    await fr.getByRole('menuitem', { name: /Evidence pack JSON/ }).first().click();
    await page.waitForTimeout(2500);
    const t = await fr.locator('body').innerText();
    await shot(`G6-refused-${E}-${theme}`);
    if (!/Advanced/.test(t) || !/failed/i.test(t)) throw new Error('no refusal toast: ' + t.slice(0, 100));
    return 'server refused, toast shows Advanced requirement';
  });
}

await reopen();
await step('9.9', 'Restore edition: Use the license', async () => { await setEdition(page, fr, 'Use the license'); return 'restored'; });
writeReport(DIR, `AccessRadar phase 2 E2E (${theme}), dev`, '');
fs.writeFileSync(`${DIR}/results-${theme}.json`, JSON.stringify(results, null, 1));
await browser.close();
