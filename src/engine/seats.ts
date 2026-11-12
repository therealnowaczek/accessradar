import type { EffectiveAccess } from './resolve';
import type { AccessState } from './state';

/**
 * Seat view (C2): which groups grant product access, who is in them, and which seat holders are worth
 * a second look. Built only from application roles, groups, memberships and effective space access.
 * It makes no claim about activity: Jira does not tell apps when someone last signed in. "Deactivated"
 * is the account flag and nothing more.
 */
export interface SeatGroup {
  id: string;
  name: string;
  membersStatus: string;
  /** Members read for this group, or null when they were not collected. */
  members: number | null;
  deactivated: number;
}

export interface SeatProduct {
  key: string;
  name: string;
  groups: SeatGroup[];
  /** Distinct active Atlassian accounts in the product's groups (customers and apps excluded). */
  seats: number;
  deactivated: number;
  /** Groups that grant this product but have no members (members were read). */
  emptyGroups: number;
  /** True when at least one group's members were not read, so `seats` may be too low. */
  partial: boolean;
}

export type SeatFlag = 'no-space-access' | 'multiple-products';

export interface SeatPerson {
  accountId: string;
  name: string;
  products: string[];
  spaces: number;
  flags: SeatFlag[];
}

export interface SeatReport {
  products: SeatProduct[];
  /** Seat holders with a flag, noSpaceAccess first. Capped at SEAT_PEOPLE_CAP. */
  people: SeatPerson[];
  totals: {
    seatHolders: number;
    noSpaceAccess: number;
    multipleProducts: number;
    deactivated: number;
  };
  /** True when some access could not be resolved, so "no space access" may be incomplete. */
  accessPartial: boolean;
  /** True when the site has no application roles in this snapshot. */
  noProducts: boolean;
}

export const SEAT_PEOPLE_CAP = 500;

export function seatReport(state: AccessState, entries: EffectiveAccess[]): SeatReport {
  const spacesOf = new Map<string, Set<string>>();
  let accessPartial = false;
  for (const e of entries) {
    if (e.partial) accessPartial = true;
    if (e.subject.type !== 'user') continue;
    const set = spacesOf.get(e.subject.accountId) ?? new Set<string>();
    set.add(e.projectId);
    spacesOf.set(e.subject.accountId, set);
  }

  const isHuman = (id: string) => state.persons.get(id)?.accountType === 'atlassian';
  const isActive = (id: string) => state.persons.get(id)?.active !== false;
  const productsOf = new Map<string, Set<string>>();
  const deactivatedAll = new Set<string>();

  const products: SeatProduct[] = [...state.appRoles]
    .map(([key, role]) => {
      const groups: SeatGroup[] = [];
      const seatIds = new Set<string>();
      const deactivated = new Set<string>();
      let partial = false;
      let emptyGroups = 0;
      for (const groupId of state.appRoleGroups.get(key) ?? []) {
        const g = state.groups.get(groupId);
        const read = g?.members === 'collected' && state.groupMembers.has(groupId);
        const members = read ? (state.groupMembers.get(groupId) ?? []) : null;
        if (!read) partial = true;
        if (members && members.length === 0) emptyGroups += 1;
        let groupDeactivated = 0;
        for (const id of members ?? []) {
          if (!isHuman(id)) continue;
          if (isActive(id)) {
            seatIds.add(id);
            const set = productsOf.get(id) ?? new Set<string>();
            set.add(role.name);
            productsOf.set(id, set);
          } else {
            deactivated.add(id);
            deactivatedAll.add(id);
            groupDeactivated += 1;
          }
        }
        groups.push({
          id: groupId,
          name: g?.name ?? groupId,
          membersStatus: g?.members ?? 'not-collected',
          members: members ? members.length : null,
          deactivated: groupDeactivated,
        });
      }
      groups.sort((a, b) => a.name.localeCompare(b.name));
      return {
        key,
        name: role.name,
        groups,
        seats: seatIds.size,
        deactivated: deactivated.size,
        emptyGroups,
        partial,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const people: SeatPerson[] = [];
  for (const [accountId, names] of productsOf) {
    const spaces = spacesOf.get(accountId)?.size ?? 0;
    const flags: SeatFlag[] = [];
    if (spaces === 0) flags.push('no-space-access');
    if (names.size > 1) flags.push('multiple-products');
    if (!flags.length) continue;
    people.push({
      accountId,
      name: state.persons.get(accountId)?.displayName ?? accountId,
      products: [...names].sort(),
      spaces,
      flags,
    });
  }
  people.sort(
    (a, b) =>
      Number(b.flags.includes('no-space-access')) - Number(a.flags.includes('no-space-access')) ||
      a.name.localeCompare(b.name),
  );

  return {
    products,
    people: people.slice(0, SEAT_PEOPLE_CAP),
    totals: {
      seatHolders: productsOf.size,
      noSpaceAccess: people.filter((p) => p.flags.includes('no-space-access')).length,
      multipleProducts: people.filter((p) => p.flags.includes('multiple-products')).length,
      deactivated: deactivatedAll.size,
    },
    accessPartial,
    noProducts: products.length === 0,
  };
}
