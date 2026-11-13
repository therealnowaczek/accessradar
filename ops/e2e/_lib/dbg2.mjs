import { open, openApp, nav, dismissCookies } from './lib.mjs';
const { browser, page } = await open();
const t=Date.now(); const L=(m)=>console.log(Math.round((Date.now()-t)/1000),m);
let fr = await openApp(page); L('opened'); await dismissCookies(page);
await nav(page, fr, 'Settings'); L('nav settings');
await page.screenshot({path:'/tmp/dbg2.png'});
L((await fr.locator('body').innerText()).slice(0,200).replace(/\n/g,'|'));
await browser.close();
