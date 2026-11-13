import { open, openApp, nav, dismissCookies, OUT } from './lib.mjs';
const { browser, page } = await open();
const fr = await openApp(page);
await dismissCookies(page);
await nav(page, fr, 'Settings');
await page.waitForTimeout(2000);
console.log((await fr.locator('body').innerText()).slice(0, 1800));
await page.screenshot({ path: OUT + '/00-settings.png' });
await browser.close();
