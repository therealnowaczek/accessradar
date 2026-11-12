import { en } from './en';
import { resolveUiLocale, type UiLocale } from './locale';

export { resolveUiLocale, UI_LOCALES, type UiLocale } from './locale';

export type MessageKey = keyof typeof en;
type Catalog = Partial<Record<MessageKey, string>>;

/** Active catalog; English until a locale is loaded. */
let catalog: Catalog = en;
let plurals = new Intl.PluralRules('en-US');

/** Swaps the active catalog (used by tests; a locale may omit keys). */
export function setCatalog(next: Catalog, locale = 'en-US'): void {
  catalog = next;
  plurals = new Intl.PluralRules(locale);
}

const loaders: Record<Exclude<UiLocale, 'en-US'>, () => Promise<{ default: Catalog }>> = {
  'de-DE': () => import('./locales/de-DE.json'),
  'ja-JP': () => import('./locales/ja-JP.json'),
  'fr-FR': () => import('./locales/fr-FR.json'),
  'es-ES': () => import('./locales/es-ES.json'),
  'pt-BR': () => import('./locales/pt-BR.json'),
  'pl-PL': () => import('./locales/pl-PL.json'),
  'ko-KR': () => import('./locales/ko-KR.json'),
  'it-IT': () => import('./locales/it-IT.json'),
  'nl-NL': () => import('./locales/nl-NL.json'),
  'zh-CN': () => import('./locales/zh-CN.json'),
  'zh-TW': () => import('./locales/zh-TW.json'),
};

/**
 * Loads the catalog for the Jira user locale (`context.locale`). Missing or unknown locales, and a
 * failed load, keep English. Call once before the first render.
 */
export async function loadLocale(raw: string | null | undefined): Promise<UiLocale> {
  const locale = resolveUiLocale(raw);
  if (locale === 'en-US') {
    setCatalog(en);
    return locale;
  }
  try {
    const mod = await loaders[locale]();
    setCatalog(mod.default, locale);
    return locale;
  } catch {
    setCatalog(en);
    return 'en-US';
  }
}

/** Picks the branch of `{name, plural, one {...} other {...}}` (also `=0`) and resolves `#`. */
function plural(text: string, vars: Record<string, string | number>): string {
  const re = /\{(\w+),\s*plural,\s*((?:[^{}]|\{[^{}]*\})*)\}/g;
  return text.replace(re, (_m, name: string, body: string) => {
    const n = Number(vars[name] ?? 0);
    const branches = new Map<string, string>();
    for (const b of body.matchAll(/(=?\w+)\s*\{([^{}]*)\}/g)) branches.set(b[1]!, b[2]!);
    const chosen =
      branches.get(`=${n}`) ?? branches.get(plurals.select(n)) ?? branches.get('other') ?? '';
    return chosen.replace(/#/g, String(n));
  });
}

/**
 * Looks up a message; `{name}` placeholders are replaced from `vars`, and ICU plurals
 * (`{count, plural, one {...} other {...}}`) follow the active locale. A key missing from the active
 * catalog falls back to the English text, never to the key itself (Radrly standard R-6.4).
 */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const text = catalog[key] ?? en[key] ?? key;
  if (!vars) return text;
  return plural(text, vars).replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** English source text, for tests and the translation step. */
export const sourceCatalog = en;
