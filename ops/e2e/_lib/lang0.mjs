import { open } from './lib.mjs';
const { browser, page } = await open();
await page.goto('https://id.atlassian.com/manage-profile/account-preferences', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
await page.screenshot({ path: '../2026-11-12-i18n/00-account-prefs.png' });
console.log(page.url()); console.log((await page.locator('body').innerText()).slice(0,500));
await browser.close();
