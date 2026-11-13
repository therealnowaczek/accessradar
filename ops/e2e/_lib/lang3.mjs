import { open, openApp } from './lib.mjs';
const { browser, page } = await open(); const fr = await openApp(page);
console.log((await fr.locator('body').innerText()).slice(0, 120).replace(/\n/g, ' | '));
await browser.close();
