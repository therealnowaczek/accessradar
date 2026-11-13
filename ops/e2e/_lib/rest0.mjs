import { open, SITE } from '/workspace/radrly/accessradar/e2e/_lib/lib.mjs';
const { browser, page } = await open();
await page.goto(`${SITE}/jira/your-work`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(5000);
const get = (u) => page.evaluate(async (u) => { const r = await fetch(u, { headers: { Accept: 'application/json' } }); return { s: r.status, b: (await r.text()).slice(0, 3000) }; }, u);
console.log(JSON.stringify(await get('/rest/api/3/myself')).slice(0,400));
console.log(JSON.stringify(await get('/rest/api/3/project/ARTEST/role')));
const roles = JSON.parse((await get('/rest/api/3/project/ARTEST/role')).b);
for (const [n,u] of Object.entries(roles)) { const r = await get(u.replace(SITE,'')); console.log(n, r.s, r.b.replace(/\s+/g,' ').slice(0,500)); }
await browser.close();
