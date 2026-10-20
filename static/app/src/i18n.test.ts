import { afterEach, describe, expect, it } from 'vitest';
import { setCatalog, t } from './i18n';

describe('t()', () => {
  afterEach(() => setCatalog({}));

  it('returns the English text and fills placeholders', () => {
    expect(t('planGate.badge')).toBe('Advanced');
    expect(t('planGate.sample.closedOf', { closed: 2, total: 5 })).toBe('2 of 5 closed');
  });

  it('falls back to English, never the key, when the active catalog misses a key', () => {
    setCatalog({ 'planGate.badge': 'Zaawansowany' });
    expect(t('planGate.badge')).toBe('Zaawansowany');
    expect(t('planGate.sample')).toBe('Sample data');
  });
});
