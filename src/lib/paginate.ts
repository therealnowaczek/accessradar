/** Generic startAt/maxResults pagination that stops on `isLast` (Jira "PageBean" shape). */
export interface PageBean<T> {
  startAt?: number;
  maxResults?: number;
  total?: number;
  isLast?: boolean;
  values: T[];
}

export async function collectPages<T>(
  fetchPage: (startAt: number) => Promise<PageBean<T>>,
  opts: { maxPages?: number } = {},
): Promise<{ items: T[]; complete: boolean; pages: number }> {
  const maxPages = opts.maxPages ?? 1000;
  const items: T[] = [];
  let startAt = 0;
  let pages = 0;
  while (pages < maxPages) {
    const page = await fetchPage(startAt);
    pages += 1;
    items.push(...page.values);
    // Stop on isLast; guard against servers that omit isLast and return an empty page.
    if (page.isLast === true || page.values.length === 0) return { items, complete: true, pages };
    startAt += page.values.length;
  }
  return { items, complete: false, pages };
}
