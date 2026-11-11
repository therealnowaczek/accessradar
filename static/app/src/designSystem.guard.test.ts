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
 * 10. z-index other than 1, the ADS "card" layer (100), or SidePanel blanket/modal (500/510);
 * 11. media-query breakpoints other than 1023 / 900 / 860 / 768 / 600 / 520 (table 1.7);
 * 12. own empty-state components or ad-hoc panels (only @atlaskit/empty-state and the shared
 *     LevelSidePanel in Drawer.tsx). `@atlaskit/drawer` width "wide" is forbidden; "narrow" only
 *     for the navigation overlay (AdminNav).
 * Layout-conformance additions (docs/layout-conformance.md):
 * 13. button order: ModalFooter = Cancel (subtle) then the primary/danger LAST (R-7.1);
 *     DrawerFooter = the primary FIRST and Cancel only through `onCancel` (R-7.4), and
 *     Drawer.tsx renders the children before the Cancel button;
 * 14. JS breakpoints (useMaxWidth / matchMedia) use the shared widths too (R-1.16);
 * 15. tables only through Table.tsx (DynamicTable in the horizontal-scroll wrapper; R-8.3, R-1.18);
 * 16. every EmptyState has a header and a description (R-8.5);
 * 17. no positive tabIndex (R-11.2); every <form> has noValidate (R-9.1);
 * 18. @atlaskit/badge only for counters (allowlist, none today) and Heading size="large" only
 *     for the page title in ui.tsx (R-8.10, R-3.3);
 * 19. date formatting only in format.ts (no Intl.DateTimeFormat / toLocaleDateString /
 *     toLocaleTimeString in views, no slicing formatted dates; R-6.1, R-6.3).
 * Rules 7-19 have exported detectors and a self-test, so the guard cannot pass by mistake.
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
const ALLOWED_Z = new Set(['1', '100', 'card', '500', '510', 'blanket', 'modal']);
const MEDIA_WIDTH = /@media[^{]*\((?:max|min)-width:\s*(\d+)px\)/g;
const ALLOWED_BREAKPOINTS = new Set(['1023', '900', '860', '768', '600', '520']);
const OWN_EMPTY = /\bfunction\s+Empty\b|className=["'][^"']*\bempty-state\b|\.empty-state\b/;
/** Ad-hoc panels outside the shared SidePanel wrapper (Drawer.tsx). */
const OWN_DRAWER = /className=["'][^"']*\bdrawer-(?:panel|scrim)\b/;
const OWN_DIALOG = /role=["']dialog["']|aria-modal=/;
const SIDE_PANEL_FILE = 'Drawer.tsx';
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

/**
 * Rule 12: own empty states / ad-hoc panels, or ADS Drawer that is not narrow nav (R-7.5).
 * SidePanel (Drawer.tsx) may use role=dialog; wide Drawer is always forbidden.
 */
export function findOwnSurfaces(list: Source[]): string[] {
  return list.flatMap((s) => [
    ...lines(s, OWN_EMPTY),
    ...lines(s, OWN_DRAWER),
    ...(s.path === SIDE_PANEL_FILE ? [] : lines(s, OWN_DIALOG)),
    ...[...s.text.matchAll(DRAWER_WIDTH)]
      .filter((m) => !(m[1] === 'narrow' && s.path === 'AdminNav.tsx'))
      .map((m) => `${s.path}: Drawer width="${m[1]}"`),
  ]);
}

const APPEARANCE = /appearance=["'](\w+)["']/g;
const PRIMARY_LIKE = new Set(['primary', 'danger', 'warning']);
const MODAL_FOOTER = /<ModalFooter\b[^>]*>([\s\S]*?)<\/ModalFooter>/g;
const DRAWER_FOOTER = /<DrawerFooter\b([\s\S]*?)<\/DrawerFooter>/g;
const CANCEL_CHILD = />\s*Cancel\s*</;
const appearances = (block: string) => [...block.matchAll(APPEARANCE)].map((m) => m[1]);

/** Rule 13: footer button order (modal: primary last; drawer: primary first, Cancel via onCancel). */
export function findFooterOrder(list: Source[]): string[] {
  return list
    .filter((s) => s.path.endsWith('.tsx'))
    .flatMap((s) => {
      const found: string[] = [];
      for (const m of s.text.matchAll(MODAL_FOOTER)) {
        const order = appearances(m[1]);
        const last = order[order.length - 1];
        if (order.some((a) => PRIMARY_LIKE.has(a)) && !PRIMARY_LIKE.has(last ?? ''))
          found.push(`${s.path}: ModalFooter primary is not last (${order.join(', ')})`);
      }
      for (const m of s.text.matchAll(DRAWER_FOOTER)) {
        const order = appearances(m[1]);
        if (order.some((a) => PRIMARY_LIKE.has(a)) && !PRIMARY_LIKE.has(order[0]))
          found.push(`${s.path}: DrawerFooter primary is not first (${order.join(', ')})`);
        if (CANCEL_CHILD.test(m[1]))
          found.push(`${s.path}: DrawerFooter Cancel passed as a child (use onCancel)`);
      }
      if (s.path === SIDE_PANEL_FILE) {
        const footer = s.text.slice(s.text.indexOf('export function DrawerFooter'));
        const children = footer.indexOf('{children}');
        const cancel = footer.indexOf('{onCancel ?');
        if (children < 0 || cancel < 0 || children > cancel)
          found.push(`${s.path}: DrawerFooter must render children before Cancel`);
      }
      return found;
    });
}

const JS_BREAKPOINT =
  /useMaxWidth\(\s*(\d+)\s*\)|matchMedia\??\.?\(\s*['"`]\((?:max|min)-width:\s*(\d+)px\)/g;

/** Rule 14: breakpoints in TS/TSX (useMaxWidth, matchMedia) outside table 1.7. */
export function findJsBreakpoints(list: Source[]): string[] {
  return list
    .filter((s) => /\.tsx?$/.test(s.path))
    .flatMap((s) =>
      [...s.text.matchAll(JS_BREAKPOINT)]
        .filter((m) => !ALLOWED_BREAKPOINTS.has(m[1] ?? m[2]))
        .map((m) => `${s.path}: ${m[0]}`),
    );
}

const DYNAMIC_TABLE_IMPORT = /from ['"]@atlaskit\/dynamic-table['"]/;

/** Rule 15: DynamicTable is imported only by Table.tsx (the horizontal-scroll wrapper). */
export function findDirectTables(list: Source[]): string[] {
  return list
    .filter((s) => /\.tsx?$/.test(s.path) && s.path !== 'Table.tsx')
    .flatMap((s) => lines(s, DYNAMIC_TABLE_IMPORT));
}

const EMPTY_STATE = /<EmptyState\b([\s\S]*?)\/>/g;

/** Rule 16: every EmptyState has a header and a description (R-8.5). */
export function findIncompleteEmptyStates(list: Source[]): string[] {
  return list
    .filter((s) => s.path.endsWith('.tsx'))
    .flatMap((s) =>
      [...s.text.matchAll(EMPTY_STATE)]
        .filter((m) => !/\bheader=/.test(m[1]) || !/\bdescription=/.test(m[1]))
        .map(() => `${s.path}: EmptyState without header or description`),
    );
}

const POSITIVE_TAB_INDEX = /tabIndex=\{?\s*["']?[1-9]/;
const FORM_TAG = /<form\b[^>]*>/g;

/** Rule 17: no positive tabIndex; every <form> has noValidate. */
export function findFocusAndFormIssues(list: Source[]): string[] {
  return list
    .filter((s) => s.path.endsWith('.tsx'))
    .flatMap((s) => [
      ...lines(s, POSITIVE_TAB_INDEX),
      ...(s.text.match(FORM_TAG) ?? [])
        .filter((tag) => !/\bnoValidate\b/.test(tag))
        .map((tag) => `${s.path}: ${tag} without noValidate`),
    ]);
}

/** Badge is for counters only (R-8.10). Per-file allowlist; none today. */
const BADGE_ALLOWLIST: Record<string, Allow> = {};
const BADGE_IMPORT = /from ['"]@atlaskit\/badge['"]/;
const LARGE_HEADING = /<Heading\b[^>]*\bsize=["'](?:large|xlarge|xxlarge)["']/;

/** Rule 18: Badge only from the allowlist; large headings only for the page title (ui.tsx). */
export function findBadgeAndHeadingIssues(list: Source[]): string[] {
  return list
    .filter((s) => s.path.endsWith('.tsx'))
    .flatMap((s) => [
      ...(BADGE_ALLOWLIST[s.path] ? [] : lines(s, BADGE_IMPORT)),
      ...(s.path === 'ui.tsx' ? [] : lines(s, LARGE_HEADING)),
    ]);
}

const AD_HOC_DATE =
  /\bIntl\.DateTimeFormat\s*\(|\.toLocale(?:Date|Time)String\s*\(|formatLocal\([^)]*\)\s*\.\s*(?:split|slice|substring)\b/;

/** Rule 19: dates are formatted only by the helpers in format.ts (Jira locale and time zone). */
export function findAdHocDates(list: Source[]): string[] {
  return list
    .filter((s) => /\.tsx?$/.test(s.path) && s.path !== 'format.ts')
    .flatMap((s) => lines(s, AD_HOC_DATE));
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

  it('10. uses only z-index 1, card (100), or SidePanel blanket/modal (500/510)', () => {
    expect(findZIndex(sources)).toEqual([]);
  });

  it('11. uses only the shared breakpoints 1023/900/860/768/600/520', () => {
    expect(findBreakpoints(sources)).toEqual([]);
  });

  it('12. has no own empty states or ad-hoc panels; SidePanel only; Drawer narrow for nav', () => {
    expect(findOwnSurfaces(sources)).toEqual([]);
  });

  it('13. orders footer buttons: modal primary last, drawer primary first + Cancel via onCancel', () => {
    expect(findFooterOrder(sources)).toEqual([]);
  });

  it('14. uses only the shared breakpoints in JS media queries too', () => {
    expect(findJsBreakpoints(sources)).toEqual([]);
  });

  it('15. renders tables only through Table.tsx (horizontal-scroll wrapper)', () => {
    expect(findDirectTables(sources)).toEqual([]);
  });

  it('16. gives every EmptyState a header and a description', () => {
    expect(findIncompleteEmptyStates(sources)).toEqual([]);
  });

  it('17. has no positive tabIndex and every form has noValidate', () => {
    expect(findFocusAndFormIssues(sources)).toEqual([]);
  });

  it('18. uses Badge only for counters and Heading large only for the page title', () => {
    expect(findBadgeAndHeadingIssues(sources)).toEqual([]);
    for (const [path, allow] of Object.entries(BADGE_ALLOWLIST)) {
      const s = sources.find((x) => x.path === path);
      expect(s && BADGE_IMPORT.test(s.text) && allow.why ? path : `stale ${path}`).toBe(path);
    }
  });

  it('19. formats dates only through format.ts (Jira locale and time zone)', () => {
    expect(findAdHocDates(sources)).toEqual([]);
  });

  it('detects the patterns it guards against (rules 13-19)', () => {
    const src = (path: string, text: string) => [{ path, text }];
    const modal = (body: string) => src('a.tsx', `<ModalFooter>${body}</ModalFooter>`);
    expect(
      findFooterOrder(
        modal(
          '<Button appearance="subtle">Cancel</Button><Button appearance="primary">Save</Button>',
        ),
      ),
    ).toHaveLength(0);
    expect(
      findFooterOrder(
        modal(
          '<Button appearance="primary">Save</Button><Button appearance="subtle">Cancel</Button>',
        ),
      ),
    ).toHaveLength(1);
    const drawer = (attrs: string, body: string) =>
      src('a.tsx', `<DrawerFooter${attrs}>${body}</DrawerFooter>`);
    expect(
      findFooterOrder(
        drawer(' onCancel={() => close()}', '<Button appearance="primary">Save</Button>'),
      ),
    ).toHaveLength(0);
    expect(
      findFooterOrder(
        drawer(
          '',
          '<Button appearance="subtle">Back</Button><Button appearance="primary">Save</Button>',
        ),
      ),
    ).toHaveLength(1);
    expect(
      findFooterOrder(
        drawer('', '<Button appearance="primary">Save</Button><Button onClick={x}>Cancel</Button>'),
      ),
    ).toHaveLength(1);
    expect(
      findFooterOrder(
        src(
          'Drawer.tsx',
          'export function DrawerFooter() { {onCancel ? (<B/>) : null} {children} }',
        ),
      ),
    ).toHaveLength(1);
    expect(findJsBreakpoints(src('a.tsx', 'useMaxWidth(899)'))).toHaveLength(1);
    expect(findJsBreakpoints(src('a.tsx', 'useMaxWidth(900)'))).toHaveLength(0);
    expect(findJsBreakpoints(src('a.ts', "window.matchMedia('(max-width: 700px)')"))).toHaveLength(
      1,
    );
    expect(
      findJsBreakpoints(src('a.ts', "matchMedia?.('(prefers-reduced-motion: reduce)')")),
    ).toHaveLength(0);
    expect(findDirectTables(src('a.tsx', "import T from '@atlaskit/dynamic-table';"))).toHaveLength(
      1,
    );
    expect(
      findDirectTables(src('Table.tsx', "import T from '@atlaskit/dynamic-table';")),
    ).toHaveLength(0);
    expect(findIncompleteEmptyStates(src('a.tsx', '<EmptyState header="x" />'))).toHaveLength(1);
    expect(
      findIncompleteEmptyStates(src('a.tsx', '<EmptyState header="x" description="y." />')),
    ).toHaveLength(0);
    expect(findFocusAndFormIssues(src('a.tsx', '<Box tabIndex={2}>'))).toHaveLength(1);
    expect(findFocusAndFormIssues(src('a.tsx', '<div tabIndex={-1}>'))).toHaveLength(0);
    expect(findFocusAndFormIssues(src('a.tsx', '<form onSubmit={x}>'))).toHaveLength(1);
    expect(findFocusAndFormIssues(src('a.tsx', '<form {...p} noValidate>'))).toHaveLength(0);
    expect(
      findBadgeAndHeadingIssues(src('a.tsx', "import Badge from '@atlaskit/badge';")),
    ).toHaveLength(1);
    expect(findBadgeAndHeadingIssues(src('a.tsx', '<Heading size="large">'))).toHaveLength(1);
    expect(findBadgeAndHeadingIssues(src('ui.tsx', '<Heading size="large" as="h1">'))).toHaveLength(
      0,
    );
    expect(findAdHocDates(src('a.tsx', "new Intl.DateTimeFormat('en-GB')"))).toHaveLength(1);
    expect(findAdHocDates(src('a.tsx', "formatLocal(x).split(',')[0]"))).toHaveLength(1);
    expect(findAdHocDates(src('a.tsx', 'd.toLocaleDateString()'))).toHaveLength(1);
    expect(findAdHocDates(src('a.tsx', 'n.toLocaleString()'))).toHaveLength(0);
    expect(findAdHocDates(src('format.ts', "new Intl.DateTimeFormat('en-GB')"))).toHaveLength(0);
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
    expect(findOwnSurfaces(src('Drawer.tsx', '<div role="dialog">'))).toHaveLength(0);
    expect(findOwnSurfaces(src('a.tsx', '<Drawer isOpen width="medium">'))).not.toHaveLength(0);
    expect(findOwnSurfaces(src('a.tsx', '<AtlaskitDrawer isOpen width="wide">'))).not.toHaveLength(
      0,
    );
    expect(
      findOwnSurfaces(src('AdminNav.tsx', '<Drawer isOpen width="narrow" label="Nav">')),
    ).toHaveLength(0);
  });
});

function isTsxSource(s: { path: string }) {
  return isTsx(s.path);
}
