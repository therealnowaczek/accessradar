import { open } from './lib.mjs';
import { setTheme } from './theme.mjs';
const { browser, page } = await open();
console.log(await setTheme(page, 'Light'));
await browser.close();
