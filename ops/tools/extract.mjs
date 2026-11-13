// Codemod: wraps plain English JSX text / whitelisted attributes in t('key'). Run from repo root.
import ts from '/workspace/radrly/accessradar/work-roadmap/node_modules/typescript/lib/typescript.js';
import fs from 'node:fs';
import path from 'node:path';
const root = 'static/app/src';
const ATTRS = new Set(['title', 'label', 'description', 'placeholder', 'aria-label', 'heading', 'helperText', 'message', 'emptyMessage', 'primaryLabel', 'cancelLabel', 'confirmLabel', 'buttonLabel', 'text', 'tooltip', 'content']);
const SKIP_FILES = /(\.test\.|designSystem|i18n|api\.ts|routes\.ts|format\.ts|skeletons\.tsx|export\/|main\.tsx)/;
const gen = JSON.parse(fs.existsSync('/tmp/gen.json') ? fs.readFileSync('/tmp/gen.json', 'utf8') : '{}');
const textToKey = new Map(Object.entries(gen).map(([k, v]) => [v, k]));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 6).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('');
function keyFor(file, text) {
  if (textToKey.has(text)) return textToKey.get(text);
  const base = path.basename(file).replace(/\.tsx?$/, '').replace(/View$|Screen$/, '');
  let k = `${base[0].toLowerCase() + base.slice(1)}.${slug(text) || 'text'}`;
  let n = 1; while (gen[k] !== undefined && gen[k] !== text) k = k.replace(/\d*$/, '') + ++n;
  gen[k] = text; textToKey.set(text, k); return k;
}
const hasLetters = (s) => /[A-Za-z]{2,}/.test(s);
const inFunction = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return true; return false; };
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]); }
let total = 0;
for (const file of walk(root).filter((f) => f.endsWith('.tsx') && !SKIP_FILES.test(f))) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const visit = (n) => {
    if (ts.isJsxText(n) && inFunction(n)) {
      const parent = n.parent;
      const kids = ts.isJsxElement(parent) ? parent.children : [];
      const onlyText = kids.length === 1 || kids.every((c) => ts.isJsxText(c) || ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c)) && kids.filter((c) => ts.isJsxText(c) && c.getText().trim()).length === 1 && kids.length === 1;
      const raw = n.getText();
      const text = raw.replace(/\s+/g, ' ').trim();
      if (onlyText && hasLetters(text) && !/[{}<>]/.test(text) && !/[&]\w+;/.test(text) && parent.openingElement && !/^(code|pre|kbd)$/.test(parent.openingElement.tagName.getText())) {
        const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
        edits.push([n.getStart(), n.getEnd(), `${lead}{t('${keyFor(file, text)}')}${trail}`]);
      }
    } else if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && ATTRS.has(n.name.getText()) && inFunction(n)) {
      const text = n.initializer.text;
      if (hasLetters(text) && !text.includes("'") && text.trim() === text && /\s|^[A-Z]/.test(text)) edits.push([n.initializer.getStart(), n.initializer.getEnd(), `{t('${keyFor(file, text)}')}`]);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  let out = src; for (const [s, e, r] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + r + out.slice(e);
  if (!/from '(\.\.?\/)+i18n'/.test(out)) {
    const rel = path.relative(path.dirname(file), root + '/i18n').replace(/\\/g, '/');
    const imp = `import { t } from '${rel.startsWith('.') ? rel : './' + rel}';\n`;
    const idx = out.search(/^import /m); out = out.slice(0, idx) + imp + out.slice(idx);
  } else if (!/import \{[^}]*\bt\b[^}]*\} from '(\.\.?\/)+i18n'/.test(out)) {
    out = out.replace(/import \{([^}]*)\} from '((?:\.\.?\/)+i18n)'/, (m, a, p) => `import {${a.trimEnd()}, t } from '${p}'`);
  }
  fs.writeFileSync(file, out); total += edits.length; console.log(file, edits.length);
}
fs.writeFileSync('/tmp/gen.json', JSON.stringify(gen, null, 1));
console.log('edits', total, 'keys', Object.keys(gen).length);
