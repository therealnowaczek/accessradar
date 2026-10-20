import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the "everything is Atlassian Design System" rule for the Custom UI:
 * colours come from ADS tokens (token() / primitives props / var(--ds-*)), and native controls are
 * never hand-rolled. brand.tsx is the one exception: the AccessRadar logo is a fixed brand asset.
 */
const ROOT = __dirname;
const ALLOW_COLOUR_LITERALS = new Set(['brand.tsx']);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx|css)$/.test(name) ? [path] : [];
  });
}

const sources = files(ROOT).map((path) => ({
  path: relative(ROOT, path),
  text: readFileSync(path, 'utf8')
    // Comments may mention literals (e.g. this rule); only code counts.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1'),
}));

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/;
const RAW_CONTROL = /<(?:button|input|select|textarea|table|dialog)[\s>/]/;
const RAW_TOKEN_VAR = /var\(--ds-/;
const COMPILED_CSS_IMPORT = /from ['"]@atlaskit\/css['"]/;
const HIDDEN_CLASS = /\b(?:sr-only|visually-hidden)\b/;

const lines = (filter: (path: string) => boolean, pattern: RegExp) =>
  sources
    .filter((s) => filter(s.path))
    .flatMap((s) =>
      s.text
        .split('\n')
        .filter((line) => pattern.test(line))
        .map((line) => `${s.path}: ${line.trim()}`),
    );

describe('design tokens and ADS components', () => {
  it('scans the UI sources', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it('has no hex, rgb() or hsl() colour literals outside brand.tsx', () => {
    const hits = sources
      .filter((s) => !ALLOW_COLOUR_LITERALS.has(s.path))
      .flatMap((s) =>
        s.text
          .split('\n')
          .filter((line) => COLOUR_LITERAL.test(line))
          .map((line) => `${s.path}: ${line.trim()}`),
      );
    expect(hits).toEqual([]);
  });

  it('renders no native form controls or tables (use ADS components)', () => {
    const hits = sources
      .filter((s) => s.path.endsWith('.tsx'))
      .flatMap((s) =>
        s.text
          .split('\n')
          .filter((line) => RAW_CONTROL.test(line))
          .map((line) => `${s.path}: ${line.trim()}`),
      );
    expect(hits).toEqual([]);
  });

  it('uses token() instead of raw var(--ds-*) in TSX (CSS glue may use the variables)', () => {
    expect(lines((p) => p.endsWith('.tsx'), RAW_TOKEN_VAR)).toEqual([]);
  });

  it('never imports @atlaskit/css (cssMap needs the Compiled plugin; use xcss from primitives)', () => {
    expect(lines(() => true, COMPILED_CSS_IMPORT)).toEqual([]);
  });

  it('has no hand-rolled screen-reader classes (use @atlaskit/visually-hidden)', () => {
    expect(lines(() => true, HIDDEN_CLASS)).toEqual([]);
  });

  it('detects literals (self-check)', () => {
    expect(COLOUR_LITERAL.test('color: #172b4d;')).toBe(true);
    expect(COLOUR_LITERAL.test('background: rgba(9, 30, 66, 0.35)')).toBe(true);
    expect(COLOUR_LITERAL.test("color={token('color.text')}")).toBe(false);
    expect(RAW_CONTROL.test('<button onClick')).toBe(true);
    expect(COMPILED_CSS_IMPORT.test("import { cssMap } from '@atlaskit/css';")).toBe(true);
    expect(COMPILED_CSS_IMPORT.test("import '@atlaskit/css-reset';")).toBe(false);
  });
});
