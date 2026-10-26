/**
 * Personal data that can appear unquoted in error text: e-mail addresses and Atlassian accountIds
 * ("557058:<uuid>"-style prefixed IDs and legacy 24-hex IDs). Word boundaries keep longer hex
 * strings (SHA-256 hashes) and plain UUIDs (jobId/runId) intact.
 */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const PREFIXED_ACCOUNT_ID = /\b\d+:[0-9a-f-]{36}\b/gi;
const HEX24_ACCOUNT_ID = /\b[0-9a-f]{24}\b/gi;

/**
 * Redacts message text before logging: quoted literals in driver errors (e.g. "Duplicate entry
 * '<accountId>'") and unquoted e-mails / accountIds. Structured log context (seq, jobId, runId)
 * is never passed through here, so deliberate identifiers stay readable.
 */
export const redact = (text: string) =>
  text
    .replace(/'[^']*'/g, "'?'")
    .replace(/"[^"]*"/g, '"?"')
    .replace(/“[^”]*”/g, '“?”')
    .replace(EMAIL, '<email>')
    .replace(PREFIXED_ACCOUNT_ID, '<id>')
    .replace(HEX24_ACCOUNT_ID, '<id>');

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
