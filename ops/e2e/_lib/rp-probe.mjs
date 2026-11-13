import { open, openApp } from './lib.mjs';
const { browser, page } = await open();
await openApp(page);
console.log(page.url());
await page.screenshot({ path: '/tmp/rp-probe.png' });
console.log((await page.locator('body').innerText()).slice(0,300));
await browser.close();
