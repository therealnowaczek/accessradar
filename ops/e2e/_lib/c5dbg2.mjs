import { open, openApp, dismissCookies } from './lib.mjs';
const { browser, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
await fr.getByRole('button', { name: /^Overview/ }).first().click(); await page.waitForTimeout(8000);
await fr.getByRole('button', { name: 'Refresh now' }).click(); await page.waitForTimeout(6000); console.log((await page.locator('body').innerText()).match(/Digest refresh queued|Could not queue[^\n]*/g) ?? (await fr.locator('body').innerText()).match(/Digest refresh queued|Could not queue[^\n]*/g));
await browser.close();
