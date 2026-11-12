import { describe, expect, it } from 'vitest';
import { en } from './en';
import { loadLocale, setCatalog, t, UI_LOCALES, resolveUiLocale, type MessageKey } from './index';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

describe('resolveUiLocale', () => {
  it.each([
    ['en_US', 'en-US'],
    ['en_GB', 'en-US'],
    ['pt_BR', 'pt-BR'],
    ['pt_PT', 'pt-BR'],
    ['de_DE', 'de-DE'],
    ['zh', 'zh-CN'],
    ['zh_CN', 'zh-CN'],
    ['zh_SG', 'zh-CN'],
    ['zh_MY', 'zh-CN'],
    ['zh-Hans', 'zh-CN'],
    ['zh_TW', 'zh-TW'],
    ['zh_HK', 'zh-TW'],
    ['zh_MO', 'zh-TW'],
    ['zh-Hant', 'zh-TW'],
    ['ru_RU', 'en-US'],
    ['', 'en-US'],
    [undefined, 'en-US'],
  ])('%s -> %s', (raw, want) => {
    expect(resolveUiLocale(raw)).toBe(want);
  });
});

describe('catalogs', () => {
  it('has exactly the twelve UI locales', () => {
    expect(UI_LOCALES).toHaveLength(12);
  });

  for (const locale of UI_LOCALES.filter((l) => l !== 'en-US')) {
    it(`${locale}: known keys, same placeholders, no em dash`, async () => {
      const mod = (await import(`./locales/${locale}.json`)) as { default: Record<string, string> };
      for (const [key, value] of Object.entries(mod.default)) {
        expect(key in en, `${locale}: unknown key ${key}`).toBe(true);
        expect(placeholders(value), `${locale}: placeholders of ${key}`).toEqual(
          placeholders(en[key as MessageKey]),
        );
        expect(value, `${locale}: em dash in ${key}`).not.toContain('—');
      }
    });
  }
});

describe('t', () => {
  it('falls back per key to English, never to the key', () => {
    setCatalog({}, 'pl-PL');
    expect(t('settings.save')).toBe(en['settings.save']);
    setCatalog(en);
  });

  it('resolves ICU plurals with the locale rules', () => {
    const catalog = {
      'exceptions.registered':
        '{count, plural, one {# wyjątek} few {# wyjątki} many {# wyjątków} other {# wyjątku}}',
    };
    setCatalog(catalog, 'pl-PL');
    expect(t('exceptions.registered', { count: 1 })).toBe('1 wyjątek');
    expect(t('exceptions.registered', { count: 3 })).toBe('3 wyjątki');
    expect(t('exceptions.registered', { count: 5 })).toBe('5 wyjątków');
    setCatalog(en);
  });

  it('loadLocale keeps English for an unknown locale', async () => {
    expect(await loadLocale('ru_RU')).toBe('en-US');
    expect(t('settings.save')).toBe(en['settings.save']);
  });
});
