/** Learn-more copy for Overview risk drawers (ids match `Risk['id']`). */
export const RISK_LEARN_MORE: Record<string, string> = {
  anonymous:
    '“Anyone” grants apply to unauthenticated users. Remove them unless the space is intentionally public.',
  inactive:
    'Deactivated means the Atlassian account is inactive, not “has not logged in recently”. Remove leftover access in Jira.',
  admins:
    'Global admin membership is inferred from admin/site-admin groups only; Jira has no full global-permission holder API.',
  'wide-admin':
    'People who can administer many spaces concentrate privilege. Confirm each space still needs them.',
  'broad-app-role':
    'Application-role grants give the permission to everyone with that Jira product access, often broader than intended.',
  'large-groups':
    'Large groups that grant access amplify any membership change. Prefer smaller, purpose-built groups.',
  'project-no-admin':
    'Company-managed spaces should have at least one active human space admin via the scheme (lead counts). Relying only on global Jira admins is flagged so you can confirm that is intentional.',
  'direct-user-grants':
    'Naming a single user in a permission scheme is hard to audit. Prefer groups or space roles.',
  'unused-schemes':
    'Unused schemes and orphan roles are hygiene findings, safe to clean up after you confirm nothing still references them.',
  'empty-groups-in-use':
    'An empty group that already grants access will silently give rights to anyone added later.',
  'app-accounts-admin':
    'App or customer accounts with admin rights are high risk. Review whether the integration still needs that privilege.',
  'anonymous-write':
    'Besides viewing, “Anyone” can do more than read here. Remove these grants unless the space is deliberately open for public input.',
  'inactive-admin':
    'Deactivated means the Atlassian account is inactive, not “has not logged in recently”. A deactivated account in an admin group should be removed from it.',
  'destructive-large-group':
    'Delete and administer rights held by a large group mean many people can destroy data or change access. Prefer a smaller group or a space role for these permissions.',
  'admin-group-large':
    'Large admin groups widen who can change access. Count only active Atlassian accounts; confirm each member still needs admin rights.',
  'empty-admin-groups':
    'An empty admin group grants nothing today but silently gives admin rights to whoever is added later. Remove it or document its purpose.',
  'project-single-admin':
    'One space admin is a single point of failure for access changes. This is a hygiene finding, not a vulnerability.',
  'filters-public':
    'Public filters expose their results where public access is allowed. Check that the filter query shows nothing sensitive, or restrict the sharing.',
  'dashboards-public':
    'Public dashboards expose their gadgets where public access is allowed. Check what each gadget shows, or restrict the sharing.',
  'shared-loggedin':
    'Sharing with all signed-in users reaches everyone with a Jira login, which can include accounts with limited access. Usually fine; review the ones with sensitive content.',
};
