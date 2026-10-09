import { client, route } from '../lib/jira';
import { collectPages } from '../lib/paginate';

/** Project row shown in the admin UI. Only non-personal fields. */
export interface ProjectRow {
  id: string;
  key: string;
  name: string;
  typeKey: string;
  managed: 'company' | 'team';
  category?: string;
}

interface JiraProject {
  id?: unknown;
  key?: unknown;
  name?: unknown;
  projectTypeKey?: unknown;
  simplified?: unknown;
  style?: unknown;
  projectCategory?: { name?: unknown };
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Runtime-validates and maps a Jira project to a UI row; drops malformed entries. */
export function toProjectRow(p: JiraProject): ProjectRow | null {
  const id = str(p.id);
  const key = str(p.key);
  if (!id || !key) return null;
  const team = p.simplified === true || p.style === 'next-gen';
  const category = str(p.projectCategory?.name);
  return {
    id,
    key,
    name: str(p.name) || key,
    typeKey: str(p.projectTypeKey) || 'unknown',
    managed: team ? 'team' : 'company',
    ...(category ? { category } : {}),
  };
}

/** Lists projects visible to the interactive caller (asUser), so the list never exceeds what they can browse. */
export async function listProjectsAsUser(
  maxPages = 20,
): Promise<{ projects: ProjectRow[]; complete: boolean }> {
  const c = client({ kind: 'user' });
  const { items, complete } = await collectPages<JiraProject>(
    async (startAt) => {
      const res = await c.requestJira(
        route`/rest/api/3/project/search?startAt=${startAt}&maxResults=50&orderBy=key`,
        { headers: { Accept: 'application/json' } },
      );
      if (!res.ok) throw new Error(`Project list failed (${res.status})`);
      const body = (await res.json()) as { values?: JiraProject[]; isLast?: boolean };
      return { values: Array.isArray(body.values) ? body.values : [], isLast: body.isLast };
    },
    { maxPages },
  );
  const projects = items.map(toProjectRow).filter((p): p is ProjectRow => p !== null);
  return { projects, complete };
}
