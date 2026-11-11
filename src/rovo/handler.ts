import { __getRuntime, getAppContext } from '@forge/api';
import { decideForInvocation, rememberInactiveLicense } from '../api/edition';
import { BadRequest } from '../api/service';
import { ensureMigrated } from '../db/migrations';
import type { EditionLicense } from '../domain/edition';
import { overridesAllowed } from '../domain/edition';
import { isLicensed, UNLICENSED_MESSAGE } from '../domain/license';
import { assertJiraAdmin, ForbiddenError } from '../lib/auth';
import { errInfo } from '../lib/errors';
import { runRovoAction } from './actions';
import { contextShape, detectSurface } from './invocation';

type RovoContext = {
  principal?: { accountId?: string };
  [key: string]: unknown;
  accountId?: string;
  license?: EditionLicense | null;
  environmentType?: string;
};

/** Message for Standard sites: the Rovo agent is an Advanced feature. */
export const ROVO_REQUIRES_ADVANCED =
  'The AccessRadar Rovo agent requires the Advanced edition of AccessRadar. A Jira admin can upgrade the app in Manage apps; everything else in AccessRadar keeps working on Standard.';

/**
 * No licence object outside development/staging (for example an MCP invocation that carries no
 * licence and no runtime licence): treated as Standard, never as the development default.
 */
export const ROVO_NO_LICENSE_STANDARD = `No Marketplace license found: Standard. ${ROVO_REQUIRES_ADVANCED}`;

function appContextSafe(): { license?: EditionLicense | null; environmentType?: string } {
  try {
    const ctx = getAppContext();
    return { license: ctx?.license ?? null, environmentType: ctx?.environmentType };
  } catch {
    return {};
  }
}

/**
 * Single Forge function for all AccessRadar Rovo GET actions, used by the Rovo agent, Rovo tools
 * and external MCP clients (`rovo:mcp`). Authorization uses context.principal.accountId (never
 * payload inputs) and runs as the user first; MCP calls never use asApp().
 */
export async function rovoHandler(
  payload: Record<string, unknown> = {},
  context: RovoContext = {},
) {
  const started = Date.now();
  try {
    // Action payloads may not carry the license; the Forge runtime app context does.
    const app = appContextSafe();
    const license = context.license ?? app.license ?? null;
    const environmentType = context.environmentType ?? app.environmentType;
    if (!isLicensed({ license })) {
      await rememberInactiveLicense(license);
      return { error: UNLICENSED_MESSAGE };
    }
    const surface = detectSurface(payload, context);
    // Outside development/staging a missing licence is Standard (Rovo is Advanced). Checked
    // before any Jira call or SQL, and nothing is stored, so background jobs keep the last
    // real licence.
    if (!license && !overridesAllowed(environmentType)) {
      console.warn('[rovo] no license on invocation', { surface, environmentType });
      return { error: ROVO_NO_LICENSE_STANDARD };
    }
    const accountId = context.principal?.accountId ?? context.accountId ?? '';
    await assertJiraAdmin(accountId, { prefer: 'user', allowApp: surface !== 'mcp' });
    await ensureMigrated();
    // Same server-side edition gate as the resolvers (license capabilitySet; dev/staging
    // honour the edition override). Standard sites get a clear message and no data.
    const edition = await decideForInvocation(license, environmentType);
    if (!edition.features.rovo) return { error: ROVO_REQUIRES_ADVANCED };

    const runtimeKey = (() => {
      try {
        return __getRuntime()?.appContext?.moduleKey;
      } catch {
        return undefined;
      }
    })();
    const actionKey = String(
      (payload.context as { moduleKey?: string } | undefined)?.moduleKey ?? runtimeKey ?? '',
    );
    if (!actionKey.startsWith('ar-')) {
      return { error: 'Unknown AccessRadar Rovo action' };
    }

    const result = await runRovoAction(actionKey, payload, accountId);
    console.log('[rovo] ok', {
      action: actionKey,
      surface,
      ctx: contextShape(payload),
      rows: result.rows.length,
      ms: Date.now() - started,
    });
    return result;
  } catch (e) {
    const message = String((e as Error)?.message ?? e).slice(0, 300);
    const known = e instanceof ForbiddenError || e instanceof BadRequest;
    if (!known) console.error('[rovo] failed', errInfo(e));
    return {
      error: known ? message : `Something went wrong: ${message}`,
    };
  }
}
