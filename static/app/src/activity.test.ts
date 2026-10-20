import { describe, expect, it } from 'vitest';
import { activityDetail, activityLabel, activityTarget, ACTIVITY_LABELS } from './activity';

describe('activity labels', () => {
  it('maps raw event keys to readable names', () => {
    expect(activityLabel('alert.raised')).toBe('Raised change alerts');
    expect(activityLabel('snapshot.completed')).toBe('Snapshot completed');
    expect(activityLabel('some.new_event')).toBe('Some new event');
  });

  it('has no raw keys among the labels', () => {
    for (const label of Object.values(ACTIVITY_LABELS)) expect(label).not.toMatch(/[._]/);
  });

  it('shows the review name instead of a truncated id', () => {
    expect(
      activityTarget({
        action: 'review.signed',
        target: '11ca14f8-0000-4000-8000-000000000000',
        targetLabel: 'Q4 2026 access review',
      }),
    ).toBe('“Q4 2026 access review”');
    expect(
      activityTarget({ action: 'review.deleted', target: '11ca14f8-0000-4000-8000-000000000000' }),
    ).toBe('review 11ca14f8…');
  });

  it('formats snapshot targets', () => {
    expect(activityTarget({ action: 'alert.raised', target: '#10' })).toBe('snapshot #10');
    expect(activityTarget({ action: 'snapshot.completed', target: '#10' })).toBe('#10');
    expect(activityTarget({ action: 'export', target: '#3-#5' })).toBe('snapshots #3 → #5');
    expect(activityTarget({ action: 'edition.override', target: 'edition' })).toBe('');
  });

  it('summarises details', () => {
    expect(activityDetail({ action: 'alert.raised', detail: { total: 3 } })).toBe('3 alerts');
    expect(activityDetail({ action: 'export', detail: { kind: 'evidence-pack' } })).toBe(
      'Evidence pack PDF',
    );
  });
});
