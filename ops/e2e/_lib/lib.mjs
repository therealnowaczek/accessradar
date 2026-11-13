import { chromium } from '/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
export const SITE = 'https://marginradar.atlassian.net';
export const APP = '026c4f6a-266d-4c42-aec5-7394371ad05d';
export const DEV = 'b98d505b-afb5-4c8d-a8f9-5306b85e352d';
export async function open(opts = {}) {
  const exe = fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined;
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    storageState: '/home/box/.config/radrly/lr-e2e-state.json',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    ...opts,
  });
  const page = await ctx.newPage();
  return { browser, ctx, page };
}
export async function openApp(page, route = '') {
  await page.goto(`${SITE}/jira/settings/apps/${APP}/${DEV}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  return page.frameLocator('iframe').first();
}
export const OUT = process.env.OUT || '/workspace/radrly/accessradar/e2e/2026-11-11-phase-2';
export async function dismissCookies(page) {
  const b = page.getByRole('button', { name: 'Only necessary' });
  if (await b.count()) await b.first().click().catch(() => {});
}
export async function nav(page, fr, name) {
  await fr.getByRole('link', { name, exact: false }).first().click({ timeout: 4000 }).catch(async () => { await fr.getByText(name, { exact: true }).first().click(); });
  await page.waitForTimeout(3500);
}
export async function setEdition(page, fr, label) {
  await nav(page, fr, 'Settings');
  const inp = fr.locator('#edition-override');
  await inp.focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(500);
  await fr.getByRole('option', { name: label, exact: true }).first().click();
  await page.waitForTimeout(2500);
}
import { createRequire } from 'node:module';
const req = createRequire('/workspace/radrly/accessradar/work-roadmap/package.json');
export function makeValidator() {
  const Ajv = req('ajv'); const addFormats = req('ajv-formats');
  const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv);
  const schema = JSON.parse(fs.readFileSync('/workspace/radrly/accessradar/work-roadmap/docs/schemas/accessradar-export-v1.schema.json', 'utf8'));
  const v = ajv.compile(schema);
  return (doc) => ({ ok: v(doc), errors: JSON.stringify(v.errors ?? []).slice(0, 300) });
}
export const results = [];
export async function step(id, desc, fn) {
  try { const note = await fn(); results.push({ id, desc, r: 'PASS', note: note ?? '' }); console.log('PASS', id, note ?? ''); }
  catch (e) { results.push({ id, desc, r: 'FAIL', note: e.message.split('\n')[0].slice(0, 250) }); console.log('FAIL', id, e.message.split('\n')[0].slice(0, 250)); }
}
export function writeReport(dir, title, extra = '') {
  const rows = results.map(x => `| ${x.id} | ${x.desc} | ${x.r} | ${x.note.replace(/\|/g, '/')} |`).join('\n');
  const pass = results.filter(x => x.r === 'PASS').length, fail = results.filter(x => x.r === 'FAIL').length;
  fs.writeFileSync(dir + '/report.md', `# ${title}\n\n${pass} PASS, ${fail} FAIL of ${results.length}\n\n${extra}\n| Step | What | Result | Note |\n|---|---|---|---|\n${rows}\n`);
}
export async function exportJson(page, fr, menuName, itemName, outName, dir) {
  await fr.getByRole('button', { name: menuName }).first().click();
  await page.waitForTimeout(500);
  const dl = page.waitForEvent('download', { timeout: 60000 });
  await fr.getByRole('menuitem', { name: new RegExp(itemName) }).first().click();
  const d = await dl;
  const path = dir + '/' + outName;
  await d.saveAs(path);
  return { name: d.suggestedFilename(), doc: JSON.parse(fs.readFileSync(path, 'utf8')) };
}
