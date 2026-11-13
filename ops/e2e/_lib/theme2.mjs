import { open } from './lib.mjs';
import { setTheme } from './theme.mjs';
const { browser, page } = await open();
console.log(await setTheme(page, process.argv[2] || 'Dark'));
await browser.close();
