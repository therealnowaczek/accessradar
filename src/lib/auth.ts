import api, { route } from '@forge/api';

/** Authorize: the interactive caller must have Administer Jira. Checked as the user (asUser), server-side. */
export async function assertJiraAdmin(): Promise<void> {
  const res = await api.asUser().requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Authorization check failed (${res.status})`);
  const body = (await res.json()) as { permissions?: { ADMINISTER?: { havePermission?: boolean } } };
  if (!body.permissions?.ADMINISTER?.havePermission) throw new Error('AccessRadar is available to Jira administrators only');
}
