// usage: node addkeys.mjs <repo> <keys.json>   keys.json: { "key": { "en-US": "...", "de-DE": "...", ... 12 locales } }
import fs from 'node:fs';
const [repo, file] = process.argv.slice(2);
const keys = JSON.parse(fs.readFileSync(file, 'utf8'));
const i18n = `${repo}/static/app/src/i18n`;
const LOC = ['de-DE','ja-JP','fr-FR','es-ES','pt-BR','pl-PL','ko-KR','it-IT','nl-NL','zh-CN','zh-TW'];
const ph = (s) => [...s.matchAll(/\{(\w+)(?=\s*[,}])/g)].map((m) => m[1]).sort().join();
let en = fs.readFileSync(`${i18n}/en.ts`, 'utf8');
const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
let add = '';
for (const [k, v] of Object.entries(keys)) {
  if (en.includes(`'${k}':`)) { console.log('exists, skipping en', k); continue; }
  if (/[—–]/.test(JSON.stringify(v))) throw new Error('dash in ' + k);
  for (const l of LOC) { if (!v[l]) throw new Error(`missing ${l} for ${k}`); if (ph(v[l]) !== ph(v['en-US'])) throw new Error(`placeholder mismatch ${l} ${k}`); }
  add += `  ${q(k)}: ${q(v['en-US'])},\n`;
}
en = en.replace(/\} as const;\s*$/, add + '} as const;\n');
fs.writeFileSync(`${i18n}/en.ts`, en);
for (const l of LOC) {
  const p = `${i18n}/locales/${l}.json`;
  const o = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(keys)) o[k] = v[l];
  fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n');
}
console.log('added', Object.keys(keys).length);
