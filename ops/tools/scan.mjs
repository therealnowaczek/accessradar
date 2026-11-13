import ts from '/workspace/radrly/accessradar/work-roadmap/node_modules/typescript/lib/typescript.js';
import fs from 'node:fs'; import path from 'node:path';
const root = 'static/app/src';
const SKIP = /(\.test\.|designSystem|i18n|export\/|main\.tsx|skeletons)/;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const L = (s) => /[A-Za-z]{3,}/.test(s) && /\s|^[A-Z]/.test(s);
let n = 0; const out = [];
for (const f of walk(root).filter((f) => /\.tsx?$/.test(f) && !SKIP.test(f))) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const inT = (x) => { for (let p = x.parent; p; p = p.parent) if (ts.isCallExpression(p) && p.expression.getText() === 't') return true; return false; };
  const visit = (x) => {
    let txt = null, kind = '';
    if (ts.isJsxText(x)) { txt = x.getText().replace(/\s+/g, ' ').trim(); kind = 'jsx'; }
    else if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) {
      const p = x.parent;
      if (!ts.isImportDeclaration(p) && !ts.isLiteralTypeNode(p) && !ts.isPropertyAssignment(p) || (ts.isPropertyAssignment(p) && p.initializer === x)) { txt = x.text; kind = 'str'; }
    } else if (ts.isTemplateExpression(x)) { txt = x.getText(); kind = 'tpl'; }
    if (txt && L(txt) && !inT(x) && !/^(use |import|@|#|\/|http|[a-z]+[-_:.][a-z-_:.]+$)/.test(txt) && txt.length < 300) {
      const { line } = sf.getLineAndCharacterOfPosition(x.getStart());
      out.push(`${f.replace(root + '/', '')}:${line + 1} [${kind}] ${txt.slice(0, 110)}`); n++;
    }
    ts.forEachChild(x, visit);
  }; visit(sf);
}
console.log(out.join('\n')); console.error('total', n);
