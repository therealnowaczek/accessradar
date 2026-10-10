/**
 * Pure change-alert rules evaluated between two committed snapshots (Advanced).
 * Delivery is in-app only via the notice table — no email / egress.
 */
import { adminAccounts, isAppAccount } from './risk';
import { resolveAll, type EffectiveAccess } from './resolve';
import type { AccessState } from './state';

export const ALERT_RULES = [
  'new-admin',
  'new-anonymous-grant',
  'inactive-with-access',
  'new-project-admin',
  'new-app-account-admin',
] as const;

export type AlertRule = (typeof ALERT_RULES)[number];

export type AlertRulesConfig = Record<AlertRule, boolean>;

export const DEFAULT_ALERT_RULES: AlertRulesConfig = {
  'new-admin': true,
  'new-anonymous-grant': true,
  'inactive-with-access': true,
  'new-project-admin': true,
  'new-app-account-admin': true,
};

export const ALERT_CAP = 500;

export interface Alert {
  rule: AlertRule;
  severity: 'high' | 'medium';
  title: string;
  body: string;
  /** Stable id for dedupe within a snapshot (not the notice PK). */
  key: string;
}

export function sanitizeAlertRules(input: unknown): AlertRulesConfig {
  const base = { ...DEFAULT_ALERT_RULES };
  if (!input || typeof input !== 'object') return base;
  const o = input as Record<string, unknown>;
  for (const rule of ALERT_RULES) {
    if (typeof o[rule] === 'boolean') base[rule] = o[rule];
  }
  return base;
}

function personLabel(state: AccessState, accountId: string): string {
  return state.persons.get(accountId)?.displayName ?? 'Unknown user';
}

function usedSchemeIds(state: AccessState): Set<string> {
  return new Set(
    [...state.projects.values()].map((p) => p.schemeId).filter((id): id is string => Boolean(id)),
  );
}

function projectAdminUsers(entries: EffectiveAccess[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const e of entries) {
    if (e.permission !== 'ADMINISTER_PROJECTS' || e.subject.type !== 'user') continue;
    const id = e.subject.accountId;
    if (!out.has(id)) out.set(id, new Set());
    out.get(id)!.add(e.projectId);
  }
  return out;
}

function usersWithProjectAccess(entries: EffectiveAccess[]): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    if (e.subject.type === 'user') out.add(e.subject.accountId);
  }
  return out;
}

function anonymousKeys(state: AccessState): Set<string> {
  const used = usedSchemeIds(state);
  const keys = new Set<string>();
  for (const g of state.grants) {
    if (g.holderType !== 'anyone') continue;
    if (!used.has(g.schemeId)) continue;
    keys.add(`${g.schemeId}:${g.permission}`);
  }
  // Scheme newly assigned to a project also surfaces as new anyone coverage on that project.
  for (const [pid, p] of state.projects) {
    if (!p.schemeId) continue;
    for (const g of state.grantsByScheme.get(p.schemeId) ?? []) {
      if (g.holderType === 'anyone') keys.add(`project:${pid}:${g.permission}`);
    }
  }
  return keys;
}

/** Compare prev → next AccessState; returns alerts (uncapped). */
export function evaluateAlerts(
  prev: AccessState,
  next: AccessState,
  rules: AlertRulesConfig = DEFAULT_ALERT_RULES,
  nextEntries: EffectiveAccess[] = resolveAll(next),
  prevEntries: EffectiveAccess[] = resolveAll(prev),
): Alert[] {
  const out: Alert[] = [];
  const prevAdmins = adminAccounts(prev);
  const nextAdmins = adminAccounts(next);

  if (rules['new-admin']) {
    for (const [accountId, groups] of nextAdmins) {
      if (prevAdmins.has(accountId)) continue;
      if (isAppAccount(next, accountId)) continue; // covered by new-app-account-admin
      const groupNames = groups.map((g) => next.groups.get(g)?.name ?? g).join(', ');
      out.push({
        rule: 'new-admin',
        severity: 'high',
        title: `New Jira admin: ${personLabel(next, accountId)}`,
        body: groupNames ? `Via group(s): ${groupNames}` : 'Gained site/admin group membership',
        key: `new-admin:${accountId}`,
      });
    }
  }

  if (rules['new-app-account-admin']) {
    for (const [accountId, groups] of nextAdmins) {
      if (prevAdmins.has(accountId)) continue;
      if (!isAppAccount(next, accountId)) continue;
      const groupNames = groups.map((g) => next.groups.get(g)?.name ?? g).join(', ');
      out.push({
        rule: 'new-app-account-admin',
        severity: 'high',
        title: `New app account admin: ${personLabel(next, accountId)}`,
        body: groupNames ? `Via group(s): ${groupNames}` : 'App account gained admin access',
        key: `new-app-account-admin:${accountId}`,
      });
    }
  }

  if (rules['new-anonymous-grant']) {
    const prevKeys = anonymousKeys(prev);
    for (const key of anonymousKeys(next)) {
      if (prevKeys.has(key)) continue;
      const [a, b, c] = key.split(':');
      let title: string;
      let body: string;
      if (a === 'project') {
        const p = next.projects.get(b);
        title = `Anyone access on ${p?.key ?? b}`;
        body = `Permission ${c} via scheme on project ${p?.key ?? b}`;
      } else {
        const scheme = next.schemes.get(a)?.name ?? a;
        title = `Anyone grant: ${b}`;
        body = `Scheme ${scheme}`;
      }
      out.push({
        rule: 'new-anonymous-grant',
        severity: 'high',
        title,
        body,
        key: `new-anonymous-grant:${key}`,
      });
    }
  }

  if (rules['inactive-with-access']) {
    const nextAccess = usersWithProjectAccess(nextEntries);
    const newlyInactive: string[] = [];
    const stillInactive: string[] = [];
    for (const accountId of nextAccess) {
      const person = next.persons.get(accountId);
      if (!person || person.active !== false) continue;
      const wasActive = prev.persons.get(accountId)?.active !== false;
      if (wasActive) newlyInactive.push(accountId);
      else stillInactive.push(accountId);
    }
    for (const accountId of newlyInactive) {
      out.push({
        rule: 'inactive-with-access',
        severity: 'high',
        title: `Deactivated account still has access: ${personLabel(next, accountId)}`,
        body: 'Account became inactive since the previous snapshot and still has project access',
        key: `inactive-with-access:${accountId}`,
      });
    }
    if (stillInactive.length) {
      out.push({
        rule: 'inactive-with-access',
        severity: 'medium',
        title: `${stillInactive.length} inactive account(s) still have access`,
        body: 'Digest of deactivated accounts that retain project access',
        key: `inactive-with-access:digest:${stillInactive.length}`,
      });
    }
  }

  if (rules['new-project-admin']) {
    const prevAdminsByUser = projectAdminUsers(prevEntries);
    const nextAdminsByUser = projectAdminUsers(nextEntries);
    for (const [accountId, projects] of nextAdminsByUser) {
      const before = prevAdminsByUser.get(accountId) ?? new Set();
      for (const projectId of projects) {
        if (before.has(projectId)) continue;
        const p = next.projects.get(projectId);
        out.push({
          rule: 'new-project-admin',
          severity: 'medium',
          title: `New project admin: ${personLabel(next, accountId)} on ${p?.key ?? projectId}`,
          body: 'Gained ADMINISTER_PROJECTS',
          key: `new-project-admin:${accountId}:${projectId}`,
        });
      }
    }
  }

  return out;
}

/** Apply the 500-alert cap; overflow becomes one summary alert. */
export function capAlerts(alerts: Alert[], cap = ALERT_CAP): Alert[] {
  if (alerts.length <= cap) return alerts;
  const kept = alerts.slice(0, cap);
  const overflow = alerts.length - cap;
  kept.push({
    rule: 'new-admin',
    severity: 'medium',
    title: `${overflow} more alert(s) omitted`,
    body: `Alert cap of ${cap} reached for this snapshot`,
    key: `overflow:${overflow}`,
  });
  return kept;
}
