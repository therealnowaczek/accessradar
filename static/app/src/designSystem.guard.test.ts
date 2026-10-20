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
 *  9. a full-page spinner (<Loading /> without compact, Spinner size="large" outside ui.tsx,
 *     `100vh - 160px`) or a Spinner without a label; first loads are skeletons.
 * AccessRadar extras for the v1.1 layout rules:
 * 10. z-index other than 1 or the ADS "card" layer (100) in CSS / xcss (table 1.8);
 * 11. media-query breakpoints other than 1023 / 900 / 860 / 768 / 600 / 520 (table 1.7);
 * 12. own empty-state components or drawer panels (only @atlaskit/empty-state and
 *     @atlaskit/drawer, width "wide"; "narrow" only for the navigation overlay).
 * Rules 7-9 have exported detectors and a self-test, so the guard cannot pass by mistake.
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
  /\b(?:Language|Locale)(?:Picker|Select|Switcher|Menu)\b/,
  /\b(?:language|locale)[-_ ]?(?:picker|switch(?:er)?|select(?:or)?|menu|dropdown)\b/i,
  /\b(?:aria-)?label=["'{`]\s*['"`]?(?:language|locale)\b/i,
  /\{\s*(?:label|value):\s*['"`](?:en|pl|de|fr|es|it|pt|ja)(?:[-_][A-Za-z]{2})?['"`]/,
  /['"`](?:[\w-]+\.)*(?:language|languagePicker|localePicker)['"`]/,
  /\bsetLocale\s*\(|\bchangeLanguage\s*\(/,
];
const SUPPORTED_LOCALES = /\bSUPPORTED_LOCALES\b/;
const FULL_PAGE_LOADING = /<Loading\b(?![^>]*\bcompact\b)[^>]*>/g;
const SPINNER = /<Spinner\b[^>]*>/g;
const FULL_PAGE_HEIGHT = /100vh\s*-\s*160px/;

type Source = { path: string; text: string };
const lines = (s: Source, pattern: RegExp) =>
  s.text
    .split('\n')
    .filter((line) => pattern.test(line))
    .map((line) => `${s.path}: ${line.trim()}`);

/** Rule 7: imports of the deprecated @atlaskit/side-navigation (including subpaths). */
export function findSideNavigationImports(list: Source[]): string[] {
  return list
    .filter((s) => /\.tsx?$/.test(s.path))
    .flatMap((s) => lines(s, SIDE_NAVIGATION_IMPORT));
}

/** Rule 8: anything that lets the user pick a language (it follows the Jira settings). */
export function findLanguagePicker(list: Source[]): string[] {
  return list
    .filter((s) => /\.tsx?$/.test(s.path))
    .flatMap((s) => [
      ...LANGUAGE_PICKER.flatMap((pattern) => lines(s, pattern)),
      ...(s.path.startsWith('i18n/') ? [] : lines(s, SUPPORTED_LOCALES)),
    ]);
}

/** Rule 9: full-page spinners and unlabelled spinners. */
export function findFullPageSpinners(list: Source[]): string[] {
  return list.flatMap((s) => {
    const found = lines(s, FULL_PAGE_HEIGHT);
    if (!s.path.endsWith('.tsx')) return found;
    found.push(...(s.text.match(FULL_PAGE_LOADING) ?? []).map((m) => `${s.path}: ${m}`));
    found.push(
      ...(s.text.match(SPINNER) ?? [])
        .filter((m) => !/\blabel=/.test(m) || (/size=["']large["']/.test(m) && s.path !== 'ui.tsx'))
        .map((m) => `${s.path}: ${m}`),
    );
    return found;
  });
}

const CSS_Z_INDEX = /z-index:\s*([^;]+);/g;
const XCSS_Z_INDEX = /zIndex:\s*['"]?([^'",}\s]+)/g;
const ALLOWED_Z = new Set(['1', '100', 'card']);
const MEDIA_WIDTH = /@media[^{]*\((?:max|min)-width:\s*(\d+)px\)/g;
const ALLOWED_BREAKPOINTS = new Set(['1023', '900', '860', '768', '600', '520']);
const OWN_EMPTY = /\bfunction\s+Empty\b|className=["'][^"']*\bempty-state\b|\.empty-state\b/;
const OWN_DRAWER =
  /role=["']dialog["']|aria-modal=|className=["'][^"']*\bdrawer-(?:panel|scrim|root)\b/;
const DRAWER_WIDTH = /<(?:Atlaskit)?Drawer\b[^>]*\bwidth=["']([^"']+)["']/g;

/** Rule 10: z-index values outside table 1.8 (1 and the ADS "card" layer). */
export function findZIndex(list: Source[]): string[] {
  return list.flatMap((s) =>
    [...s.text.matchAll(s.path.endsWith('.css') ? CSS_Z_INDEX : XCSS_Z_INDEX)]
      .map((m) => m[1].replace(/\/\*.*$/, '').trim())
      .filter((v) => !ALLOWED_Z.has(v))
      .map((v) => `${s.path}: z-index ${v}`),
  );
}

/** Rule 11: breakpoints outside table 1.7. */
export function findBreakpoints(list: Source[]): string[] {
  return list.flatMap((s) =>
    [...s.text.matchAll(MEDIA_WIDTH)]
      .filter((m) => !ALLOWED_BREAKPOINTS.has(m[1]))
      .map((m) => `${s.path}: ${m[0]}`),
  );
}

/** Rule 12: own empty states / drawer panels, or an ADS Drawer width other than the shared ones. */
export function findOwnSurfaces(list: Source[]): string[] {
  return list.flatMap((s) => [
    ...lines(s, OWN_EMPTY),
    ...lines(s, OWN_DRAWER),
    ...[...s.text.matchAll(DRAWER_WIDTH)]
      .filter((m) => m[1] !== 'wide' && !(m[1] === 'narrow' && s.path === 'AdminNav.tsx'))
      .map((m) => `${s.path}: Drawer width="${m[1]}"`),
  ]);
}

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
    expect(findSideNavigationImports(sources)).toEqual([]);
    expect(PACKAGE_JSON).not.toMatch(/"@atlaskit\/side-navigation"\s*:/);
  });

  it('8. has no language picker (language follows the Jira user settings, English fallback)', () => {
    expect(findLanguagePicker(sources)).toEqual([]);
  });

  it('9. never shows a full-page spinner; every Spinner has a label', () => {
    expect(findFullPageSpinners(sources)).toEqual([]);
  });

  it('10. uses only z-index 1 and the ADS card layer (100)', () => {
    expect(findZIndex(sources)).toEqual([]);
  });

  it('11. uses only the shared breakpoints 1023/900/860/768/600/520', () => {
    expect(findBreakpoints(sources)).toEqual([]);
  });

  it('12. has no own empty states or drawer panels; drawers are ADS "wide"', () => {
    expect(findOwnSurfaces(sources)).toEqual([]);
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

  it('detects the patterns it guards against (rules 7-12)', () => {
    const src = (path: string, text: string) => [{ path, text }];
    expect(
      findSideNavigationImports(src('a.tsx', "import x from '@atlaskit/side-navigation/section';")),
    ).toHaveLength(1);
    expect(findLanguagePicker(src('a.tsx', '<LanguageSelect />'))).not.toHaveLength(0);
    expect(findLanguagePicker(src('a.tsx', "t('settings.languagePicker')"))).not.toHaveLength(0);
    expect(findLanguagePicker(src('a.tsx', 'SUPPORTED_LOCALES.map(x)'))).not.toHaveLength(0);
    expect(findLanguagePicker(src('i18n/x.ts', 'SUPPORTED_LOCALES.map(x)'))).toHaveLength(0);
    expect(findFullPageSpinners(src('a.tsx', '<Loading />'))).not.toHaveLength(0);
    expect(findFullPageSpinners(src('a.tsx', '<Spinner size="large" label="x" />'))).toHaveLength(
      1,
    );
    expect(findFullPageSpinners(src('a.css', 'min-height: calc(100vh - 160px);'))).not.toHaveLength(
      0,
    );
    expect(
      findFullPageSpinners(src('a.tsx', '<Spinner size="small" label="Saving" />')),
    ).toHaveLength(0);
    expect(findZIndex(src('a.css', 'z-index: 3;'))).not.toHaveLength(0);
    expect(findZIndex(src('a.css', 'z-index: 100; /* layer card */'))).toHaveLength(0);
    expect(findZIndex(src('a.tsx', "xcss({ zIndex: '200' })"))).not.toHaveLength(0);
    expect(findBreakpoints(src('a.css', '@media (max-width: 700px) {'))).not.toHaveLength(0);
    expect(findBreakpoints(src('a.css', '@media (max-width: 1023px) {'))).toHaveLength(0);
    expect(findOwnSurfaces(src('a.tsx', 'export function Empty() {'))).not.toHaveLength(0);
    expect(findOwnSurfaces(src('a.tsx', '<div role="dialog">'))).not.toHaveLength(0);
    expect(findOwnSurfaces(src('a.tsx', '<Drawer isOpen width="medium">'))).not.toHaveLength(0);
    expect(findOwnSurfaces(src('a.tsx', '<AtlaskitDrawer isOpen width="wide">'))).toHaveLength(0);
  });
});

function isTsxSource(s: { path: string }) {
  return isTsx(s.path);
}
