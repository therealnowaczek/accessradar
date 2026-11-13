import { open, SITE, dismissCookies } from './lib.mjs';
const { browser, page } = await open(); const e=[];
page.on('pageerror', x => e.push(String(x).slice(0,80)));
await page.goto(`${SITE}/jira/your-work`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(8000);
console.log('jira-only page errors:', e.length, e[0]); await browser.close();
