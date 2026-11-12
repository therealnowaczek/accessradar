/**
 * In-app request for a Marketplace review (C11). Shown once to a site admin after first value, as a
 * plain link: no tracking, no Marketplace API, no incentive. Dismissal is remembered per site.
 */
export const REVIEW_PROMPT_KV = 'review-prompt';

export const MARKETPLACE_REVIEW_URL =
  'https://marketplace.atlassian.com/apps/3691498947/accessradar-access-review-permission-audit-for-jira?tab=reviews';

export type ReviewPromptChoice = 'dismissed' | 'done';

export interface ReviewPromptStored {
  state: ReviewPromptChoice;
  at: number;
}

/**
 * First value: a signed review, or, when the site never started a review, a second complete snapshot
 * (the first one that can show what changed). Once dismissed or marked done, never again.
 */
export function reviewPromptDue(
  input: { signedReviews: number; totalReviews: number; hasPreviousSnapshot: boolean },
  stored: ReviewPromptStored | null,
): boolean {
  if (stored) return false;
  if (input.signedReviews > 0) return true;
  return input.totalReviews === 0 && input.hasPreviousSnapshot;
}

export function parseReviewPromptChoice(raw: unknown): ReviewPromptChoice {
  return raw === 'done' ? 'done' : 'dismissed';
}
