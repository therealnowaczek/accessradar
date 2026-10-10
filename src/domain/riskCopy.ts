/** Learn-more copy for Overview risk drawers (ids match `Risk['id']`). */
export const RISK_LEARN_MORE: Record<string, string> = {
  anonymous:
    '“Anyone” grants apply to unauthenticated users. Remove them unless the project is intentionally public.',
  inactive:
    'Deactivated means the Atlassian account is inactive, not “has not logged in recently”. Remove leftover access in Jira.',
  admins:
    'Global admin membership is inferred from admin/site-admin groups only; Jira has no full global-permission holder API.',
  'wide-admin':
    'People who can administer many projects concentrate privilege. Confirm each project still needs them.',
  'broad-app-role':
    'Application-role grants give the permission to everyone with that Jira product access — often broader than intended.',
  'large-groups':
    'Large groups that grant access amplify any membership change. Prefer smaller, purpose-built groups.',
  'project-no-admin':
    'Company-managed projects should have at least one active human project admin via the scheme (lead counts). Relying only on global Jira admins is flagged so you can confirm that is intentional.',
  'direct-user-grants':
    'Naming a single user in a permission scheme is hard to audit. Prefer groups or project roles.',
  'unused-schemes':
    'Unused schemes and orphan roles are hygiene findings — safe to clean up after you confirm nothing still references them.',
  'empty-groups-in-use':
    'An empty group that already grants access will silently give rights to anyone added later.',
  'app-accounts-admin':
    'App or customer accounts with admin rights are high risk. Review whether the integration still needs that privilege.',
};
