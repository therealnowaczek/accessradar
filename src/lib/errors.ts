/** Loggable error summary (Forge SQL errors carry code/suggestion). Never includes payloads or tokens. */
export function errInfo(e: unknown): { message: string; code?: string; suggestion?: string } {
  const err = e as { message?: string; code?: string; suggestion?: string };
  return {
    message: String(err?.message ?? e).slice(0, 300),
    ...(err?.code ? { code: String(err.code) } : {}),
    ...(err?.suggestion ? { suggestion: String(err.suggestion).slice(0, 300) } : {}),
  };
}
