import { open } from './lib.mjs';
const { browser, page } = await open();
await page.goto('https://id.atlassian.com/manage-profile/account-preferences', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
const sel = page.locator('input[id*="react-select"], [role="combobox"]').first();
await sel.click(); await page.waitForTimeout(800);
await page.screenshot({ path: '../2026-11-12-i18n/02-lang-open.png' });
console.log((await page.locator('[role="option"]').allInnerTexts()).join(' | '));
await browser.close();
