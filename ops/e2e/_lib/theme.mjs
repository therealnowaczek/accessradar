import { SITE, dismissCookies } from './lib.mjs';
export async function setTheme(page, name) {
  await page.goto(`${SITE}/jira/your-work`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(6000);
  await dismissCookies(page);
  await page.mouse.click(1251, 23); await page.waitForTimeout(1500);
  await page.getByText('Theme', { exact: true }).first().click(); await page.waitForTimeout(1500);
  await page.screenshot({ path: `/workspace/radrly/accessradar/e2e/2026-11-12-phase-3c/theme-menu.png` });
  await page.getByText(name, { exact: true }).first().click(); await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  return page.evaluate(() => document.documentElement.getAttribute('data-color-mode'));
}
