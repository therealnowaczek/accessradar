/**
 * UI language from the Jira user locale (`context.locale`, e.g. "pt_BR"). Twelve UI locales; anything
 * else falls back to en-US. No in-app language switcher (owner decision 2026-11-11).
 */
export const UI_LOCALES = [
  'en-US',
  'de-DE',
  'ja-JP',
  'fr-FR',
  'es-ES',
  'pt-BR',
  'pl-PL',
  'ko-KR',
  'it-IT',
  'nl-NL',
  'zh-CN',
  'zh-TW',
] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

const BY_LANGUAGE: Record<string, UiLocale> = {
  en: 'en-US',
  de: 'de-DE',
  ja: 'ja-JP',
  fr: 'fr-FR',
  es: 'es-ES',
  pt: 'pt-BR',
  pl: 'pl-PL',
  ko: 'ko-KR',
  it: 'it-IT',
  nl: 'nl-NL',
  zh: 'zh-CN',
};
const ZH_TRADITIONAL = new Set(['TW', 'HK', 'MO']);

export function resolveUiLocale(raw: string | null | undefined): UiLocale {
  if (!raw) return 'en-US';
  const parts = raw.replace(/_/g, '-').split('-');
  const language = (parts[0] ?? '').toLowerCase();
  const rest = parts.slice(1).map((p) => p.toUpperCase());
  if (language === 'zh') {
    // zh-Hant and zh-TW/HK/MO are Traditional; zh, zh-CN, zh-SG, zh-MY and zh-Hans are Simplified.
    return rest.includes('HANT') || rest.some((p) => ZH_TRADITIONAL.has(p)) ? 'zh-TW' : 'zh-CN';
  }
  return BY_LANGUAGE[language] ?? 'en-US';
}
