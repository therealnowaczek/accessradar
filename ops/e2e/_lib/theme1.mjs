import { open, SITE, dismissCookies } from './lib.mjs';
const { browser, page } = await open();
await page.goto(`${SITE}/jira/your-work`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(7000);
await dismissCookies(page);
await page.mouse.click(1251, 23); await page.waitForTimeout(2000);
await page.screenshot({ path: '../2026-11-12-phase-3c/theme1.png' });
await browser.close();
