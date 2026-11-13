import { open, SITE, APP, DEV, dismissCookies } from './lib.mjs';
const { browser, page } = await open();
await page.goto(`${SITE}/jira/software/projects/ARTEST/settings/apps/${APP}/${DEV}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000); await dismissCookies(page);
console.log(page.url());
await page.screenshot({ path: '/workspace/radrly/accessradar/e2e/2026-11-12-c8-probe.png' });
const fr = page.frameLocator('iframe').first();
console.log((await fr.locator('body').innerText().catch(() => 'no frame')).slice(0, 300));
await browser.close();
