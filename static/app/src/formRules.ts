/**
 * R-9.3 (layout standard): a drawer's primary action stays disabled until the form holds a
 * valid change. Pure rules so they can be unit tested without rendering the views.
 */

export type CampaignDraftFields = {
  name: string;
  scopeType: 'site' | 'projects' | 'category';
  projectIds: string[];
  categoryIds: string[];
  startDate: string;
  windowDays: string;
};

/** New campaign drawer: name, a scope selection, a start date and a 1–90 day window. */
export function isCampaignDraftValid(d: CampaignDraftFields): boolean {
  if (!d.name.trim()) return false;
  if (d.scopeType === 'projects' && !d.projectIds.length) return false;
  if (d.scopeType === 'category' && !d.categoryIds.length) return false;
  if (!d.startDate) return false;
  const window = Number(d.windowDays);
  return Number.isInteger(window) && window >= 1 && window <= 90;
}

/** New review drawer: a name, and at least one space/group unless the scope is the whole site. */
export function canStartReview(f: {
  name: string;
  scope: 'site' | 'projects' | 'groups';
  selected: number;
}): boolean {
  return Boolean(f.name.trim()) && (f.scope === 'site' || f.selected > 0);
}

export type DecisionValue = 'keep' | 'revoke' | 'exception' | null;

/**
 * Decide drawer: something changed (decision, note, or an expiry for an exception) and the
 * change is valid (revoke/exception need a 10+ character justification, an exception needs an
 * expiry date).
 */
export function isDecisionChangeValid(
  item: { decision: DecisionValue; note?: string | null },
  draft: { value: DecisionValue; note: string; expiresOn: string },
): boolean {
  const note = draft.note.trim();
  const changed =
    draft.value !== item.decision ||
    note !== (item.note ?? '').trim() ||
    (draft.value === 'exception' && Boolean(draft.expiresOn));
  if (!changed) return false;
  if ((draft.value === 'revoke' || draft.value === 'exception') && note.length < 10) return false;
  if (draft.value === 'exception' && !draft.expiresOn) return false;
  return true;
}
