import { open, openApp, nav, dismissCookies } from './lib.mjs';
const { browser, page } = await open();
const fr = await openApp(page); await dismissCookies(page);
await nav(page, fr, 'Spaces'); await page.waitForTimeout(3000);
await fr.getByText('ARTEST · AccessRadar E2E').first().click(); await page.waitForTimeout(6000);
await page.screenshot({ path: '../2026-11-12-phase-3c/why1.png' });
console.log((await fr.getByRole('button').allInnerTexts()).slice(0,40).join(' | '));
await browser.close();
