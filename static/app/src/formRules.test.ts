import { describe, expect, it } from 'vitest';
import {
  NAME_MAX_LENGTH,
  NOTE_MAX_LENGTH,
  canStartReview,
  isCampaignDraftValid,
  isDecisionChangeValid,
} from './formRules';

const draft = {
  name: 'Quarterly admins',
  scopeType: 'site' as const,
  projectIds: [] as string[],
  categoryIds: [] as string[],
  startDate: '2026-11-01',
  windowDays: '14',
};

describe('R-9.3 campaign drawer', () => {
  it('needs a name, a scope selection, a start date and a 1-90 day window', () => {
    expect(isCampaignDraftValid(draft)).toBe(true);
    expect(isCampaignDraftValid({ ...draft, name: '  ' })).toBe(false);
    expect(isCampaignDraftValid({ ...draft, scopeType: 'projects' })).toBe(false);
    expect(isCampaignDraftValid({ ...draft, scopeType: 'projects', projectIds: ['1'] })).toBe(true);
    expect(isCampaignDraftValid({ ...draft, scopeType: 'category' })).toBe(false);
    expect(isCampaignDraftValid({ ...draft, startDate: '' })).toBe(false);
    expect(isCampaignDraftValid({ ...draft, windowDays: '0' })).toBe(false);
    expect(isCampaignDraftValid({ ...draft, windowDays: '91' })).toBe(false);
    expect(isCampaignDraftValid({ ...draft, windowDays: '2.5' })).toBe(false);
  });
});

describe('R-9.3 review drawer', () => {
  it('needs a name and a selection unless the scope is the site', () => {
    expect(canStartReview({ name: 'Review', scope: 'site', selected: 0 })).toBe(true);
    expect(canStartReview({ name: ' ', scope: 'site', selected: 0 })).toBe(false);
    expect(canStartReview({ name: 'Review', scope: 'projects', selected: 0 })).toBe(false);
    expect(canStartReview({ name: 'Review', scope: 'groups', selected: 2 })).toBe(true);
  });
});

describe('R-9.3 decide drawer', () => {
  const undecided = { decision: null, note: null };
  it('is disabled without a change', () => {
    expect(isDecisionChangeValid(undecided, { value: null, note: '', expiresOn: '' })).toBe(false);
    expect(
      isDecisionChangeValid(
        { decision: 'keep', note: 'ok' },
        { value: 'keep', note: ' ok ', expiresOn: '' },
      ),
    ).toBe(false);
  });
  it('accepts Keep and note-only edits', () => {
    expect(isDecisionChangeValid(undecided, { value: 'keep', note: '', expiresOn: '' })).toBe(true);
    expect(
      isDecisionChangeValid(
        { decision: 'keep', note: null },
        { value: 'keep', note: 'still needed', expiresOn: '' },
      ),
    ).toBe(true);
  });
  it('requires a justification for revoke and an expiry for an exception', () => {
    expect(
      isDecisionChangeValid(undecided, { value: 'revoke', note: 'short', expiresOn: '' }),
    ).toBe(false);
    expect(
      isDecisionChangeValid(undecided, { value: 'revoke', note: 'left the team', expiresOn: '' }),
    ).toBe(true);
    expect(
      isDecisionChangeValid(undecided, {
        value: 'exception',
        note: 'vendor contract',
        expiresOn: '',
      }),
    ).toBe(false);
    expect(
      isDecisionChangeValid(undecided, {
        value: 'exception',
        note: 'vendor contract',
        expiresOn: '2026-12-31',
      }),
    ).toBe(true);
  });
});

describe('character limits (shown by the ADS CharacterCounter)', () => {
  it('caps campaign and review names at the column width', () => {
    const atLimit = 'a'.repeat(NAME_MAX_LENGTH);
    const over = 'a'.repeat(NAME_MAX_LENGTH + 1);
    expect(isCampaignDraftValid({ ...draft, name: atLimit })).toBe(true);
    expect(isCampaignDraftValid({ ...draft, name: over })).toBe(false);
    expect(canStartReview({ name: atLimit, scope: 'site', selected: 0 })).toBe(true);
    expect(canStartReview({ name: over, scope: 'site', selected: 0 })).toBe(false);
  });
  it('caps the decision justification', () => {
    const undecided = { decision: null, note: null };
    expect(
      isDecisionChangeValid(undecided, {
        value: 'revoke',
        note: 'a'.repeat(NOTE_MAX_LENGTH),
        expiresOn: '',
      }),
    ).toBe(true);
    expect(
      isDecisionChangeValid(undecided, {
        value: 'revoke',
        note: 'a'.repeat(NOTE_MAX_LENGTH + 1),
        expiresOn: '',
      }),
    ).toBe(false);
  });
});
