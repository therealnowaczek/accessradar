import { __getRuntime } from '@forge/api';
import { decideForInvocation } from '../api/edition';
import { BadRequest } from '../api/service';
import { ensureMigrated } from '../db/migrations';
import { REQUIRES_ADVANCED, type EditionLicense } from '../domain/edition';
import { isLicensed, UNLICENSED_MESSAGE } from '../domain/license';
import { assertJiraAdmin, ForbiddenError } from '../lib/auth';
import { errInfo } from '../lib/errors';
import { runRovoAction } from './actions';

type RovoContext = {
  principal?: { accountId?: string };
  accountId?: string;
  license?: EditionLicense | null;
};

/**
 * Single Forge function for all AccessRadar Rovo GET actions.
 * Authorization uses context.principal.accountId (never payload inputs).
 */
export async function rovoHandler(
  payload: Record<string, unknown> = {},
  context: RovoContext = {},
) {
  const started = Date.now();
  try {
    const license = context.license ?? null;
    if (!isLicensed({ license })) return { error: UNLICENSED_MESSAGE };
    const accountId = context.principal?.accountId ?? context.accountId ?? '';
    await assertJiraAdmin(accountId);
    await ensureMigrated();
    const edition = await decideForInvocation(license);
    if (!edition.features.rovo) return { error: REQUIRES_ADVANCED };

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
