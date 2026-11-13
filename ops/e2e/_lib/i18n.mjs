import fs from 'node:fs';
import { open, openApp, nav, dismissCookies, step, results, writeReport } from './lib.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-i18n';
const LOC = '/workspace/radrly/accessradar/work-roadmap/static/app/src/i18n/locales';
const en = JSON.parse(fs.readFileSync('/tmp/ar-i18n/en.json', 'utf8'));
const L = [['ja-JP','日本語'],['fr-FR','Français'],['es-ES','Español'],['pt-BR','Português (Brasil)'],['pl-PL','Polski'],['ko-KR','한국어'],['it-IT','Italiano'],['nl-NL','Nederlands'],['zh-CN','中文 (简体)'],['zh-TW','中文 (繁體)'],['en-GB','English (UK)'],['en-US','English (US)']];
const { browser, page } = await open();
async function setLang(name) {
  for (let i = 0; i < 4; i++) {
    try { await page.goto('https://id.atlassian.com/manage-profile/account-preferences', { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (i === 3) throw e; await page.waitForTimeout(4000); }
  }
  await page.waitForTimeout(5000);
  await page.locator('[role="combobox"]').first().click();
  await page.waitForTimeout(500);
  await page.getByRole('option', { name, exact: true }).first().click();
  await page.waitForTimeout(4000);
}
for (const [tag, name] of L) {
  const cat = tag.startsWith('en') ? en : JSON.parse(fs.readFileSync(`${LOC}/${tag}.json`, 'utf8'));
  await step(`i18n ${tag}`, `Account language ${name}: nav, Overview, Spaces, Settings`, async () => {
    await setLang(name);
    const fr = await openApp(page); await dismissCookies(page);
    const first = cat['nav.overview.label'] ?? en['nav.overview.label'];
    await fr.getByText(first, { exact: true }).first().waitFor({ timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const body = await fr.locator('body').innerText();
    const want = [cat['nav.overview.label'] ?? en['nav.overview.label'], cat['nav.settings.label'] ?? en['nav.settings.label'], cat['nav.group.Explore'] ?? en['nav.group.Explore']];
    const miss = want.filter((w) => !body.includes(w));
    await page.screenshot({ path: `${DIR}/${tag}-overview-light.png` });
    await fr.getByText(cat['nav.settings.label'] ?? en['nav.settings.label'], { exact: true }).first().click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${DIR}/${tag}-settings-light.png` });
    const sbody = await fr.locator('body').innerText();
    if (/�/.test(body + sbody)) throw new Error('replacement characters in text');
    if (miss.length) throw new Error('missing translated nav text: ' + miss.join(', '));
    return `nav + settings in ${tag} OK`;
  });
}
writeReport(DIR, 'AccessRadar i18n E2E (light), dev', '');
await browser.close();
