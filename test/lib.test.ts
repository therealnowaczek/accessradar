import { describe, expect, it } from 'vitest';
import { collectPages } from '../src/lib/paginate';
import { retryAfterSeconds } from '../src/lib/jira';
import { MIGRATIONS } from '../src/db/migrations';

describe('collectPages', () => {
  it('follows startAt until isLast', async () => {
    const data = Array.from({ length: 12 }, (_, i) => i);
    const r = await collectPages(async (startAt) => {
      const values = data.slice(startAt, startAt + 5);
      return { startAt, maxResults: 5, total: 12, isLast: startAt + 5 >= 12, values };
    });
    expect(r).toEqual({ items: data, complete: true, pages: 3 });
  });
  it('reports incomplete when maxPages is hit', async () => {
    const r = await collectPages(async () => ({ isLast: false, values: [1] }), { maxPages: 2 });
    expect(r.complete).toBe(false);
  });
});

describe('retryAfterSeconds', () => {
  it('parses seconds and clamps to 900', () => {
    expect(retryAfterSeconds('5')).toBe(5);
    expect(retryAfterSeconds('5000')).toBe(900);
    expect(retryAfterSeconds(null)).toBe(60);
  });
});

describe('migrations', () => {
  it('follow Forge SQL rules: one statement, no trailing semicolon, no FK', () => {
    for (const [name, ddl] of MIGRATIONS) {
      expect(name).toMatch(/^v\d{3}_/);
      expect(ddl.trim().endsWith(';')).toBe(false);
      expect(ddl.includes(';')).toBe(false);
      expect(/FOREIGN\s+KEY|REFERENCES/i.test(ddl)).toBe(false);
    }
  });
});
