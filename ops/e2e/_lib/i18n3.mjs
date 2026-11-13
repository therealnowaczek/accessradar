import fs from 'node:fs';
import { open, openApp, dismissCookies, step, writeReport } from './lib.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-i18n-pass3';
const T = process.argv[2] || 'light';
const L = (process.argv[3] ? process.argv[3].split(',') : ['de-DE','ja-JP','fr-FR','es-ES','pt-BR','pl-PL','ko-KR','it-IT','nl-NL','zh-CN','zh-TW']);
const NAMES = {'de-DE':'Deutsch','ja-JP':'日本語','fr-FR':'Français','es-ES':'Español','pt-BR':'Português (Brasil)','pl-PL':'Polski','ko-KR':'한국어','it-IT':'Italiano','nl-NL':'Nederlands','zh-CN':'中文 (简体)','zh-TW':'中文 (繁體)','en-US':'English (US)'};
const { browser, page } = await open();
async function setLang(name) {
  for (let i = 0; i < 4; i++) { try { await page.goto('https://id.atlassian.com/manage-profile/account-preferences', { waitUntil: 'domcontentloaded', timeout: 60000 }); break; } catch (e) { if (i === 3) throw e; await page.waitForTimeout(4000); } }
  await page.waitForTimeout(5000);
  await page.locator('[role="combobox"]').first().click(); await page.waitForTimeout(500);
  await page.getByRole('option', { name, exact: true }).first().click(); await page.waitForTimeout(4000);
}
const LEAK = /\{\s*\w+\s*(,\s*plural|\})|plural,|\bundefined\b|\[object|NaN|\bt\('|�/;
for (const tag of L) {
  await step(`${T} ${tag}`, `Language ${NAMES[tag]}: all pages, no raw ICU/placeholder leaks`, async () => {
    await setLang(NAMES[tag]);
    const fr = await openApp(page); await dismissCookies(page);
    await page.waitForTimeout(3000);
    const navBtns = fr.locator('nav button, nav a, [aria-label="AccessRadar"] button');
    let n = await navBtns.count();
    const labels = (await navBtns.allInnerTexts()).map((s) => s.trim()).filter(Boolean).slice(0, 13);
    if (labels.length < 13) throw new Error('nav items found: ' + labels.length);
    const leaks = [];
    for (let i = 0; i < 13; i++) {
      await navBtns.nth(i).click({ timeout: 15000 }); await page.waitForTimeout(i === 4 ? 14000 : 4500);
      const b = await fr.locator('body').innerText();
      const m = b.match(LEAK); if (m) leaks.push(`${labels[i]}: ${m[0]} ... ${b.slice(Math.max(0, b.indexOf(m[0]) - 40), b.indexOf(m[0]) + 60).replace(/\n/g, ' ')}`);
      if (i === 1 || i === 4 || i === 6 || i === 10) await page.screenshot({ path: `${DIR}/${T}-${tag}-${i}.png` });
    }
    if (leaks.length) throw new Error(leaks.join(' || '));
    return 'ok';
  });
}
await setLang('English (US)');
writeReport(DIR, `AccessRadar i18n pass 3 (${T}) per-locale smoke, dev`, '');
fs.renameSync(DIR + '/report.md', `${DIR}/report-${T}-locales.md`);
await browser.close();
