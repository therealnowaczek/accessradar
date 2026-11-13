import { open, openApp, dismissCookies } from './lib.mjs';
const { browser, page } = await open();
const fr = await openApp(page); await dismissCookies(page);
await page.waitForTimeout(3000);
await page.screenshot({ path: '../2026-11-12-i18n/01-app-initial.png' });
console.log((await fr.locator('body').innerText()).slice(0,300).replace(/\n/g,'|'));
await browser.close();
