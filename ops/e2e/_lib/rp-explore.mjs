import { open, openApp, dismissCookies } from './lib.mjs';
const { browser, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
await fr.getByRole('button', { name: /^Reviews/ }).first().waitFor({ timeout: 90000 });
await fr.getByRole('button', { name: /^Reviews/ }).first().click(); await page.waitForTimeout(4000);
await fr.getByRole('button', { name: 'Start a review' }).first().click(); await page.waitForTimeout(3000);
try { await fr.getByLabel('Name').first().fill('x'); console.log('name ok'); } catch(e){ console.log('name fail'); }
await fr.getByText('Selected spaces', { exact: true }).first().click(); await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/rp-start2.png' });
console.log((await fr.getByRole('dialog').first().innerText().catch(()=> '')).slice(0,600));
await browser.close();
