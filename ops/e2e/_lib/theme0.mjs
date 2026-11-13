import { open, openApp, dismissCookies } from './lib.mjs';
const { browser, page } = await open({ colorScheme: 'dark' });
const fr = await openApp(page); await dismissCookies(page);
console.log(await page.evaluate(() => document.documentElement.getAttribute('data-color-mode') + ' / ' + document.documentElement.getAttribute('data-theme')));
console.log(await fr.locator('html').evaluate(e => e.getAttribute('data-color-mode') + ' ' + getComputedStyle(document.body).backgroundColor).catch(e=>e.message));
await page.screenshot({ path: '../2026-11-12-phase-3c/theme0.png' });
await browser.close();
