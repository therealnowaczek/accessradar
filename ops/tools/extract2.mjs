// Pass 2 codemod: string literals that flow into UI sinks (conditionals, ?? fallbacks, content/label/... props,
// toast calls, SkeletonTable columns). Module-level label/title/description props become getters.
import ts from '/workspace/radrly/accessradar/work-roadmap/node_modules/typescript/lib/typescript.js';
import fs from 'node:fs'; import path from 'node:path';
const root = 'static/app/src';
const DRY = process.argv.includes('--dry');
const SKIP = /(\.test\.|designSystem|i18n|export\/|main\.tsx|skeletons|SpikePanel|api\.ts|routes\.ts)/;
const PROP = new Set(['content','label','title','description','header','detail','text','confirmLabel','helper','hint','empty','what','message','heading','placeholder','emptyMessage','ariaLabel','cancelLabel']);
const ATTR = new Set([...PROP, 'aria-label','primaryLabel','buttonLabel','tooltip','helperText','columns']);
const ATTR_DENY = new Set(['key','value','id','name','type','appearance','defaultSortOrder','as','testId','data-testid','href','space','alignItems','justifyContent','variant','size','width','spacing','color','weight','className','icon','role','mode','direction','status','kind','tone','sortKey','field','accessor']);
const CALLS = /^(toast\.(success|error|info|warning)|setError|showToast|setNotice|staleNotice)$/;
const gen = JSON.parse(fs.readFileSync('/tmp/gen.json', 'utf8'));
const textToKey = new Map(Object.entries(gen).map(([k, v]) => [v, k]));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 6).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('');
function keyFor(file, text) {
  if (textToKey.has(text)) return textToKey.get(text);
  const base = path.basename(file).replace(/\.tsx?$/, '').replace(/View$|Screen$/, '');
  let k = `${base[0].toLowerCase() + base.slice(1)}.${slug(text) || 'text'}`;
  let n = 1; while (gen[k] !== undefined && gen[k] !== text) k = k.replace(/\d*$/, '') + ++n;
  gen[k] = text; textToKey.set(text, k); return k;
}
const L = (s) => /[A-Za-z]{2,}/.test(s) && (/\s/.test(s) || /^[A-Z]/.test(s)) && !/^[a-z]+([A-Z][a-z]*)+$/.test(s);
const inFn = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return true; return false; };
const inT = (x) => { for (let p = x.parent; p; p = p.parent) if (ts.isCallExpression(p) && p.expression.getText() === 't') return true; return false; };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
function sink(x) {
  let cur = x;
  for (;;) {
    const p = cur.parent;
    if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p)) { cur = p; continue; }
    if (ts.isConditionalExpression(p) && p.condition !== cur) { cur = p; continue; }
    if (ts.isBinaryExpression(p) && ['??', '||'].includes(p.operatorToken.getText()) && p.right === cur) { cur = p; continue; }
    if (ts.isBinaryExpression(p) && p.operatorToken.getText() === '&&' && p.right === cur) { cur = p; continue; }
    break;
  }
  const p = cur.parent;
  if (ts.isJsxExpression(p)) {
    if (ts.isJsxAttribute(p.parent)) return ATTR.has(p.parent.name.getText()) && !ATTR_DENY.has(p.parent.name.getText()) ? 'attr' : null;
    return 'child';
  }
  if (ts.isJsxAttribute(p)) return ATTR.has(p.name.getText()) ? 'attr' : null;
  if (ts.isPropertyAssignment(p) && p.initializer === cur && PROP.has(p.name.getText().replace(/['"]/g, ''))) return 'prop';
  if (ts.isCallExpression(p) && p.arguments[0] === cur && CALLS.test(p.expression.getText())) return 'call';
  if (ts.isArrayLiteralExpression(p) && ts.isJsxExpression(p.parent) && ts.isJsxAttribute(p.parent.parent) && p.parent.parent.name.getText() === 'columns') return 'columns';
  return null;
}
let total = 0; const manual = [];
for (const file of walk(root).filter((f) => /\.tsx?$/.test(f) && !SKIP.test(f))) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const visit = (x) => {
    if ((ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) && L(x.text) && !inT(x) && !ts.isImportDeclaration(x.parent) && !ts.isLiteralTypeNode(x.parent) && !x.text.includes("'") && !x.text.includes('\n')) {
      const kind = sink(x);
      if (kind) {
        const prop = ts.isPropertyAssignment(x.parent) && x.parent.initializer === x ? x.parent : null;
        if (!inFn(x)) {
          if (prop && kind === 'prop' && /^(label|title|description|content|header|text|detail)$/.test(prop.name.getText())) edits.push([prop.getStart(), prop.getEnd(), `get ${prop.name.getText()}() { return t('${keyFor(file, x.text)}'); }`]);
          else manual.push(`${file}:${sf.getLineAndCharacterOfPosition(x.getStart()).line + 1} module ${kind} ${x.text.slice(0, 60)}`);
        } else if (ts.isJsxAttribute(x.parent)) edits.push([x.getStart(), x.getEnd(), `{t('${keyFor(file, x.text)}')}`]);
        else edits.push([x.getStart(), x.getEnd(), `t('${keyFor(file, x.text)}')`]);
      }
    }
    ts.forEachChild(x, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  console.log(file, edits.length); total += edits.length;
  if (DRY) continue;
  let out = src; for (const [s, e, r] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + r + out.slice(e);
  if (!/import \{[^}]*\bt\b[^}]*\} from '(\.\.?\/)+i18n'/.test(out) && !/import \{[^}]*\bt\b[^}]*\} from '\.\/i18n'/.test(out)) {
    if (/import \{([^}]*)\} from '((?:\.\.?\/)+i18n)'/.test(out)) out = out.replace(/import \{([^}]*)\} from '((?:\.\.?\/)+i18n)'/, (m, a, p) => `import {${a.trimEnd()}, t } from '${p}'`);
    else { const rel = path.relative(path.dirname(file), root + '/i18n').replace(/\\/g, '/'); const idx = out.search(/^import /m); out = out.slice(0, idx) + `import { t } from '${rel.startsWith('.') ? rel : './' + rel}';\n` + out.slice(idx); }
  }
  fs.writeFileSync(file, out);
}
if (!DRY) fs.writeFileSync('/tmp/gen.json', JSON.stringify(gen, null, 1));
console.log('edits', total); console.log('MANUAL (module level)\n' + manual.join('\n'));
