import { open, openApp, dismissCookies, SITE, APP, DEV } from './lib.mjs';
const { browser, page } = await open();
await page.goto(`${SITE}/jira/software/projects/ARTEST/settings/apps/${APP}/${DEV}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(10000); await dismissCookies(page);
const fr = page.frameLocator('iframe').first();
console.log((await fr.locator('body').innerText()).slice(0,800));
await page.screenshot({ path: '/tmp/c6dbg.png' });
await browser.close();
