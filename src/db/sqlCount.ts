/**
 * Forge SQL is billed per request. Every `prepare().execute()` and every migration runner
 * statement goes through `noteSqlRequest`, so handlers can log real counts per invocation.
 * Kept in its own module (not `./sql`) so tests that mock the query helpers still count.
 */
let requests = 0;
let millis = 0;

export function noteSqlRequest(count = 1, elapsedMs = 0): void {
  requests += count;
  if (elapsedMs > 0) millis += elapsedMs;
}

export function resetSqlRequestCount(): void {
  requests = 0;
  millis = 0;
}

export function sqlRequestCount(): number {
  return requests;
}

/** Summed wall time of counted requests (parallel requests overlap, so it can exceed real time). */
export function sqlRequestMillis(): number {
  return millis;
}
