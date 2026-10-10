import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, initialView, navItem, screenFor } from './routes';

describe('routes', () => {
  it('picks the screen by module key', () => {
    expect(screenFor('accessradar-admin')).toBe('app');
    expect(screenFor('accessradar-config')).toBe('app');
    expect(screenFor('accessradar-get-started')).toBe('get-started');
    expect(screenFor('accessradar-project-review')).toBe('project');
    expect(screenFor(undefined)).toBe('app');
  });
  it('opens settings from the configuration module', () => {
    expect(initialView('accessradar-config')).toBe('settings');
    expect(initialView('accessradar-admin')).toBe('overview');
  });
  it('has unique view ids and resolves them', () => {
    const ids = NAV_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(navItem('explore-groups').label).toBe('Groups');
  });
});
