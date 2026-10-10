import type { AccessState } from './state';
import { buildReviewItems, type ReviewScope } from './review';

export type RemediationPresence = 'absent' | 'present' | 'inconclusive';

/** Whether `itemKey` still appears in the access picture for the given key permissions. */
export function itemPresent(
  state: AccessState,
  itemKey: string,
  keyPermissions: string[],
  scope: ReviewScope,
): RemediationPresence {
  const parts = itemKey.split('|');
  if (parts.length < 3) return 'inconclusive';
  const [kind, id, subject] = parts;

  if (kind === 'g') {
    if (!state.groups.has(id)) return 'inconclusive';
    const g = state.groups.get(id)!;
    if (g.members === 'unreadable' || g.members === 'not-collected') return 'inconclusive';
    const members = state.groupMembers.get(id);
    if (!members) return 'inconclusive';
    if (subject.startsWith('user:')) {
      const accountId = subject.slice('user:'.length);
      return members.includes(accountId) ? 'present' : 'absent';
    }
    // Synthetic “group as subject” when members were unreadable at review time.
    return 'absent';
  }

  if (kind === 'p') {
    if (!state.projects.has(id)) return 'inconclusive';
    const items = buildReviewItems(state, scope, keyPermissions);
    return items.some((i) => i.itemKey === itemKey) ? 'present' : 'absent';
  }

  return 'inconclusive';
}
