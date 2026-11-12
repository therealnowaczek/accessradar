import { describe, expect, it } from 'vitest';
import {
  MARKETPLACE_REVIEW_URL,
  parseReviewPromptChoice,
  reviewPromptDue,
} from '../src/domain/reviewPrompt';

const base = { signedReviews: 0, totalReviews: 0, hasPreviousSnapshot: false };

describe('reviewPromptDue', () => {
  it('waits for first value', () => {
    expect(reviewPromptDue(base, null)).toBe(false);
    expect(reviewPromptDue({ ...base, totalReviews: 1 }, null)).toBe(false);
    expect(reviewPromptDue({ ...base, totalReviews: 1, hasPreviousSnapshot: true }, null)).toBe(
      false,
    );
  });
  it('shows after the first signed review', () => {
    expect(reviewPromptDue({ ...base, signedReviews: 1, totalReviews: 1 }, null)).toBe(true);
  });
  it('without any review, shows once a snapshot can show changes', () => {
    expect(reviewPromptDue({ ...base, hasPreviousSnapshot: true }, null)).toBe(true);
  });
  it('never again after dismissed or done', () => {
    const v = { ...base, signedReviews: 3, totalReviews: 3 };
    expect(reviewPromptDue(v, { state: 'dismissed', at: 1 })).toBe(false);
    expect(reviewPromptDue(v, { state: 'done', at: 1 })).toBe(false);
  });
});

describe('review prompt basics', () => {
  it('links to the reviews tab of the AccessRadar listing only', () => {
    const u = new URL(MARKETPLACE_REVIEW_URL);
    expect(u.host).toBe('marketplace.atlassian.com');
    expect(u.pathname.startsWith('/apps/3691498947/')).toBe(true);
    expect(u.searchParams.get('tab')).toBe('reviews');
  });
  it('treats anything but done as dismissed', () => {
    expect(parseReviewPromptChoice('done')).toBe('done');
    expect(parseReviewPromptChoice('x')).toBe('dismissed');
    expect(parseReviewPromptChoice(undefined)).toBe('dismissed');
  });
});
