import fs from 'node:fs';
import { open, openApp, nav, dismissCookies, setEdition, step, writeReport } from './lib.mjs';
const DIR = '/workspace/radrly/accessradar/e2e/2026-11-12-phase-3b';
const { browser, page } = await open();
let fr = await openApp(page); await dismissCookies(page);
const shot = (n) => page.screenshot({ path: `${DIR}/${n}.png` });
for (const ed of ['Advanced', 'Standard']) {
  const E = ed.toLowerCase();
  await step(`3b.0 ${E}`, `Edition override ${ed}`, async () => { await setEdition(page, fr, ed); return 'ok'; });
  await step(`3b.1 ${E}`, 'Sharing and security page', async () => {
    await nav(page, fr, 'Sharing and security');
    await fr.getByText('Publicly shared filters and dashboards').first().waitFor({ timeout: 60000 });
    await fr.getByText('Issue security levels').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(12000);
    const body = await fr.locator('body').innerText();
    await shot(`3b1-exposure-${E}-light`);
    const out = [];
    if (/Approval needed/.test(body)) throw new Error('needs-consent shown after consent');
    out.push(/All signed-in users|Anyone \(public\)/.test(body) ? 'sharing rows' : /No filters or dashboards are shared publicly/.test(body) ? 'sharing empty' : 'sharing ?');
    if (/Sharing could not load|could not load/.test(body)) throw new Error('error state: ' + body.slice(0, 200));
    out.push(/Issue security levels/.test(body) ? 'security section' : 'no security');
    if (E === 'standard') { if (!/Advanced/.test(body) || /Permission changes in the Jira audit log\s*\n[^\n]*\n[^\n]*When/.test(body)) throw new Error('audit not gated'); out.push('audit gated'); }
    else out.push(/Audit logs aren't available|No permission changes|When/.test(body) ? 'audit handled' : 'audit ?');
    if (/sharing \?|audit \?/.test(out.join())) throw new Error(out.join(', '));
    return out.join(', ');
  });
}
await step('3b.2', 'Regression: Overview, Spaces, Settings load', async () => {
  await setEdition(page, fr, 'Use the license');
  for (const n of ['Overview', 'Spaces', 'Reviews', 'Settings']) {
    await nav(page, fr, n); await page.waitForTimeout(4000);
    const b = await fr.locator('body').innerText();
    if (/could not|unavailable|Something went wrong/i.test(b.replace(/Sharing could not.*/, ''))) throw new Error(`${n}: ${b.slice(0, 150)}`);
  }
  await shot('3b2-settings-light');
  return 'ok; edition back to "Use the license"';
});
writeReport(DIR, 'AccessRadar phase 3b E2E (light), dev 3.1.0', '');
await browser.close();
