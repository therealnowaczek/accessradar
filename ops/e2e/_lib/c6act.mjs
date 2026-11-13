import { open, openApp, dismissCookies } from './lib.mjs';
const { browser, page } = await open(); let fr = await openApp(page); await dismissCookies(page);
await fr.getByRole('button', { name: /^Activity/ }).first().click(); await page.waitForTimeout(5000);
const t = await fr.locator('body').innerText();
const lines = t.split('\n').filter(l => /presort|pre-sort|AI|suggest/i.test(l));
console.log(lines.slice(0, 10).join('\n'));
await page.screenshot({ path: '/workspace/radrly/accessradar/e2e/2026-11-12-c6/activity.png' });
await browser.close();
