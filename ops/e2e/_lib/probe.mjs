import { open, openApp } from './lib.mjs';
const { browser, page } = await open();
const fr = await openApp(page);
await page.screenshot({ path: '/workspace/radrly/accessradar/e2e/2026-11-11-phase-2/00-probe.png' });
console.log(page.url().replace(/\?.*/, ''), await fr.locator('body').innerText().then(t => t.slice(0, 300)).catch(e => 'ERR ' + e.message.slice(0, 100)));
await browser.close();
