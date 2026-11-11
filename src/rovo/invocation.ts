/**
 * How a Rovo action was invoked. The same `action` modules serve the AccessRadar Rovo agent,
 * Rovo tools (`rovo:mcp`) and external MCP clients on mcp.atlassian.com. Forge does not document
 * a stable "invoked via MCP" flag yet (Preview), so this looks for the hints Forge may pass and
 * treats everything else as an ordinary Rovo call. The answer only changes logging and the
 * admin check order: both paths run the admin check as the user first, and an MCP call never
 * calls asApp() (Forge blocks asApp for MCP-invoked actions, RFC-134).
 */
export type InvocationSurface = 'mcp' | 'rovo';

const HINT_FIELDS = [
  'source',
  'invocationSource',
  'invocationType',
  'surface',
  'channel',
  'client',
  'clientType',
  'origin',
  'protocol',
];

function hasMcpHint(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if ('mcp' in o && o.mcp) return true;
  for (const f of HINT_FIELDS) {
    const v = o[f];
    if (typeof v === 'string' && /mcp/i.test(v)) return true;
    if (v && typeof v === 'object' && hasMcpHint(v)) return true;
  }
  return false;
}

export function detectSurface(
  payload: Record<string, unknown> | undefined,
  context: Record<string, unknown> | undefined,
): InvocationSurface {
  const pc = payload?.context;
  if (hasMcpHint(pc) || hasMcpHint(context) || hasMcpHint(payload)) return 'mcp';
  return 'rovo';
}

/** Top-level key names of the payload context, for one diagnostic log line (no values, no PII). */
export function contextShape(payload: Record<string, unknown> | undefined): string[] {
  const pc = payload?.context;
  return pc && typeof pc === 'object' ? Object.keys(pc as object).sort() : [];
}
