import { sql } from '@forge/sql';

/** Parameterised query helpers. SQL is only ever built with bound parameters. */
export async function q<T = Record<string, any>>(
  query: string,
  ...params: unknown[]
): Promise<T[]> {
  const res = await sql
    .prepare<T>(query)
    .bindParams(...params)
    .execute();
  return (res.rows as T[]) ?? [];
}

export async function exec(query: string, ...params: unknown[]): Promise<number> {
  const res = await sql
    .prepare<any>(query)
    .bindParams(...params)
    .execute();
  return Number((res.rows as { affectedRows?: number })?.affectedRows ?? 0);
}

/** "(?, ?, ?), (?, ?, ?)" for multi-row inserts. */
export function placeholders(rows: number, cols: number): string {
  const one = `(${new Array(cols).fill('?').join(', ')})`;
  return new Array(rows).fill(one).join(', ');
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

/** LIMIT cannot be a bound parameter in Forge SQL prepared statements; clamp to a safe integer literal. */
export function limitClause(limit: number, max = 1000): string {
  const n = Math.max(1, Math.min(max, Math.floor(Number(limit)) || 1));
  return `LIMIT ${n}`;
}
