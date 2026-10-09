/** Quoted literals in driver errors (e.g. "Duplicate entry '<accountId>'") may hold personal data. */
export const redact = (text: string) =>
  text
    .replace(/'[^']*'/g, "'?'")
    .replace(/"[^"]*"/g, '"?"')
    .replace(/“[^”]*”/g, '“?”');

/**
 * Loggable error summary (Forge SQL errors carry code/suggestion). Never includes payloads,
 * tokens, Jira error bodies or quoted values.
 */
export function errInfo(e: unknown): { message: string; code?: string; suggestion?: string } {
  const err = e as { message?: string; code?: string; suggestion?: string };
  return {
    message: redact(String(err?.message ?? e)).slice(0, 300),
    ...(err?.code ? { code: String(err.code) } : {}),
    ...(err?.suggestion ? { suggestion: redact(String(err.suggestion)).slice(0, 300) } : {}),
  };
}
