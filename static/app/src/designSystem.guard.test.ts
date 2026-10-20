import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Design-system guard (Radrly layout standard, chapter 12.1). Everything in the Custom UI is an
 * Atlassian Design System component or primitive styled with design tokens. The test fails on:
 *  1. raw <button|input|select|textarea|table|dialog> in TSX;
 *  2. hex / rgb() / rgba() / hsl() colour literals (TS, TSX, CSS);
 *  3. raw var(--ds-*) in TS/TSX (use token());
 *  4. @atlaskit/css (code or package.json);
 *  5. hand-rolled visually-hidden / sr-only classes (use @atlaskit/visually-hidden);
 *  6. stale allowlist entries (the lists may only shrink);
 *  7. @atlaskit/side-navigation (deprecated; use @atlaskit/navigation-system + side-nav-items);
 *  8. a language picker anywhere (the language follows the user's Jira settings);
 *  9. a full-page spinner (<Loading /> without compact, Spinner size="large") or a Spinner
 *     without a label; first loads are skeletons.
 * Allowlists are counted per file and every entry says why.
 */
const ROOT = __dirname;
const PACKAGE_JSON = readFileSync(join(ROOT, '../../../package.json'), 'utf8');

type Allow = { count: number; why: string };
/** Raw elements, per file and tag. None today. */
const ELEMENT_ALLOWLIST: Record<string, Record<string, Allow>> = {};
/** Colour literals per file. */
const COLOR_ALLOWLIST: Record<string, Allow> = {
  'brand.tsx': { count: 3, why: 'AccessRadar logo SVG: fixed brand gradient and white glyph.' },
  'export/pdf.ts': {
    count: 3,
    why: 'PDF export (pdf-lib rgb()): print colours of the downloaded file, not the Jira UI.',
  },
};
/** Raw var(--ds-*) in TS/TSX per file. None today (Skeleton radii go through token()). */
const RAW_TOKEN_ALLOWLIST: Record<string, Allow> = {};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

const sources = files(ROOT).map((path) => ({
  path: relative(ROOT, path),
  text: readFileSync(path, 'utf8')
    // Comments may mention literals (e.g. this rule); only code counts.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ''),
}));

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/g;
const RAW_CONTROL = /<(button|input|select|textarea|table|dialog)[\s>/]/g;
const RAW_TOKEN_VAR = /var\(--ds-/g;
const COMPILED_CSS_IMPORT = /from ['"]@atlaskit\/css['"]|import ['"]@atlaskit\/css['"]/;
const HIDDEN_CLASS =
  /className=["'{`][^"'}`]*\b(?:sr-only|visually-hidden)\b|\.(?:sr-only|visually-hidden)\b/;
const SIDE_NAVIGATION_IMPORT = /['"]@atlaskit\/side-navigation(?:\/[^'"]*)?['"]/;
const LANGUAGE_PICKER = [
  /\b(?:language|locale)[-_ ]?(?:picker|switch(?:er)?|select(?:or)?|menu|dropdown)\b/i,
  /\b(?:aria-)?label=["'{`]\s*['"`]?(?:language|locale)\b/i,
  /\{\s*(?:label|value):\s*['"`](?:en|pl|de|fr|es|it|pt|ja)(?:[-_][A-Za-z]{2})?['"`]/,
  /\bsetLocale\s*\(|\bchangeLanguage\s*\(/,
];
const FULL_PAGE_LOADING = /<Loading\b(?![^>]*\bcompact\b)[^>]*>/g;
const SPINNER = /<Spinner\b[^>]*>/g;

const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

const hits = (filter: (path: string) => boolean, pattern: RegExp) =>
  sources
    .filter((s) => filter(s.path))
    .flatMap((s) =>
      s.text
        .split('\n')
        .filter((line) => pattern.test(line))
        .map((line) => `${s.path}: ${line.trim()}`),
    );

const isTsx = (p: string) => p.endsWith('.tsx');
const isScript = (p: string) => /\.tsx?$/.test(p);

describe('design system guard (Radrly layout standard)', () => {
  it('scans the UI sources', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it('1. renders no raw button/input/select/textarea/table/dialog (use ADS components)', () => {
    const over = sources.filter(isTsxSource).flatMap((s) => {
      const counts: Record<string, number> = {};
      for (const m of s.text.matchAll(RAW_CONTROL)) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
      return Object.entries(counts)
        .filter(([tag, n]) => n > (ELEMENT_ALLOWLIST[s.path]?.[tag]?.count ?? 0))
        .map(([tag, n]) => `${s.path}: ${n} <${tag}>`);
    });
    expect(over).toEqual([]);
  });

  it('2. has no hex, rgb() or hsl() colour literals outside the allowlist', () => {
    const over = sources
      .map((s) => ({ path: s.path, n: count(s.text, COLOUR_LITERAL) }))
      .filter(({ path, n }) => n > (COLOR_ALLOWLIST[path]?.count ?? 0))
      .map(({ path, n }) => `${path}: ${n} colour literal(s)`);
    expect(over).toEqual([]);
  });

  it('3. uses token() instead of raw var(--ds-*) in TS/TSX (CSS glue may use the variables)', () => {
    const over = sources
      .filter((s) => isScript(s.path))
      .map((s) => ({ path: s.path, n: count(s.text, RAW_TOKEN_VAR) }))
      .filter(({ path, n }) => n > (RAW_TOKEN_ALLOWLIST[path]?.count ?? 0))
      .map(({ path, n }) => `${path}: ${n} raw var(--ds-*)`);
    expect(over).toEqual([]);
  });

  it('4. never uses @atlaskit/css (cssMap needs the Compiled plugin; use xcss)', () => {
    expect(hits(() => true, COMPILED_CSS_IMPORT)).toEqual([]);
    expect(PACKAGE_JSON).not.toMatch(/"@atlaskit\/css"\s*:/);
  });

  it('5. has no hand-rolled screen-reader classes (use @atlaskit/visually-hidden)', () => {
    expect(hits(() => true, HIDDEN_CLASS)).toEqual([]);
  });

  it('6. has no stale allowlist entries and every entry says why', () => {
    const stale: string[] = [];
    for (const [path, tags] of Object.entries(ELEMENT_ALLOWLIST)) {
      const s = sources.find((x) => x.path === path);
      for (const [tag, allow] of Object.entries(tags)) {
        const n = s ? [...s.text.matchAll(RAW_CONTROL)].filter((m) => m[1] === tag).length : 0;
        if (n !== allow.count || !allow.why) stale.push(`${path} <${tag}>: ${n} vs ${allow.count}`);
      }
    }
    const checkCounts = (list: Record<string, Allow>, pattern: RegExp, label: string) => {
      for (const [path, allow] of Object.entries(list)) {
        const s = sources.find((x) => x.path === path);
        const n = s ? count(s.text, pattern) : 0;
        if (n !== allow.count || !allow.why) stale.push(`${label} ${path}: ${n} vs ${allow.count}`);
      }
    };
    checkCounts(COLOR_ALLOWLIST, COLOUR_LITERAL, 'colour');
    checkCounts(RAW_TOKEN_ALLOWLIST, RAW_TOKEN_VAR, 'raw token');
    expect(stale).toEqual([]);
  });

  it('7. never imports the deprecated @atlaskit/side-navigation', () => {
    expect(hits(isScript, SIDE_NAVIGATION_IMPORT)).toEqual([]);
    expect(PACKAGE_JSON).not.toMatch(/"@atlaskit\/side-navigation"\s*:/);
  });

  it('8. has no language picker (language follows the Jira user settings, English fallback)', () => {
    expect(LANGUAGE_PICKER.flatMap((pattern) => hits(isScript, pattern))).toEqual([]);
  });

  it('9. never shows a full-page spinner; every Spinner has a label', () => {
    const fullPage = sources
      .filter(isTsxSource)
      .flatMap((s) => (s.text.match(FULL_PAGE_LOADING) ?? []).map((m) => `${s.path}: ${m}`));
    const spinners = sources
      .filter(isTsxSource)
      .flatMap((s) =>
        (s.text.match(SPINNER) ?? [])
          .filter((m) => !/\blabel=/.test(m) || /size=["']large["']/.test(m))
          .map((m) => `${s.path}: ${m}`),
      );
    expect([...fullPage, ...spinners]).toEqual([]);
  });

  it('detects violations (self-check)', () => {
    const one = (pattern: RegExp, text: string) =>
      new RegExp(pattern.source, pattern.flags.replace('g', '')).test(text);
    expect(one(COLOUR_LITERAL, 'color: #172b4d;')).toBe(true);
    expect(one(COLOUR_LITERAL, 'background: rgba(9, 30, 66, 0.35)')).toBe(true);
    expect(one(COLOUR_LITERAL, "color={token('color.text')}")).toBe(false);
    expect(one(RAW_CONTROL, '<button onClick')).toBe(true);
    expect(COMPILED_CSS_IMPORT.test("import { cssMap } from '@atlaskit/css';")).toBe(true);
    expect(COMPILED_CSS_IMPORT.test("import '@atlaskit/css-reset';")).toBe(false);
    expect(SIDE_NAVIGATION_IMPORT.test("from '@atlaskit/side-navigation';")).toBe(true);
    expect(SIDE_NAVIGATION_IMPORT.test("from '@atlaskit/side-nav-items/menu-list';")).toBe(false);
    expect(LANGUAGE_PICKER.some((p) => p.test('<LanguagePicker />'))).toBe(true);
    expect(LANGUAGE_PICKER.some((p) => p.test('<Select aria-label="Language"'))).toBe(true);
    expect(LANGUAGE_PICKER.some((p) => p.test("{ label: 'pl', value: 'pl' }"))).toBe(true);
    expect(LANGUAGE_PICKER.some((p) => p.test('locale="en-GB"'))).toBe(false);
    expect(one(FULL_PAGE_LOADING, '<Loading />')).toBe(true);
    expect(one(FULL_PAGE_LOADING, '<Loading compact />')).toBe(false);
  });
});

function isTsxSource(s: { path: string }) {
  return isTsx(s.path);
}
