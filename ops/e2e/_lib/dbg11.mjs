import { open, openApp, dismissCookies } from '/workspace/radrly/accessradar/e2e/_lib/lib.mjs';
const { browser, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
await fr.getByRole('button', { name: /^Settings/ }).first().click(); await page.waitForTimeout(5000);
const t = await fr.locator('body').innerText();
console.log(t.length, /spike|Spike/.test(t), t.slice(0,300));
await page.screenshot({ path: '/tmp/s.png' });
for (let i=0;i<6;i++){ await fr.locator('body').evaluate(()=>{document.querySelectorAll('*').forEach(e=>{if(e.scrollHeight>e.clientHeight+50)e.scrollTop=1e6})}); }
await page.waitForTimeout(1500);
console.log(await fr.getByText('Reset review prompt').count(), await fr.getByText('Developer spike').count());
await page.screenshot({ path: '/tmp/s2.png' });
await browser.close();
