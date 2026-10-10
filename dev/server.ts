import * as svc from '../src/api/service';
import { ENGINE_VERSION } from '../src/engine/resolve';

const ADMIN = 'acc-admin';

type Handler = (payload: any) => Promise<unknown>;
const HANDLERS: Record<string, Handler> = {
  getStatus: () => svc.status(false),
  getOverview: (p) => svc.overview(p),
  listSnapshots: () => svc.snapshots(),
  getSnapshot: (p) => svc.snapshotDetail(p),
  startSnapshot: (p) =>
    svc.takeSnapshot(ADMIN, p.trigger === 'onboarding' ? 'onboarding' : 'manual'),
  listProjects: async () => ({ projects: [], complete: true }),
  exploreProjects: (p) => svc.exploreProjects(p),
  projectAccess: (p) => svc.projectDetail(p),
  exploreGroups: (p) => svc.exploreGroups(p),
  groupDetail: (p) => svc.groupInfo(p),
  explorePeople: (p) => svc.explorePeople(p),
  personAccess: (p) => svc.personInfo(p),
  globalPermissions: async (p) => ({
    checked: ['ADMINISTER', 'SYSTEM_ADMIN', 'USER_PICKER'],
    granted: ['USER_PICKER'],
    at: Date.now(),
    accountId: p.accountId,
  }),
  getChanges: (p) => svc.changes(p),
  accessMatrix: (p) => svc.matrix(p),
  listReviews: () => svc.reviews(),
  createReview: (p) => svc.createReview(p, ADMIN),
  getReview: (p) => svc.reviewDetail(p),
  decideItems: (p) => svc.decideItems(p, ADMIN),
  signReview: (p) => svc.signReview(p, ADMIN),
  verifyReview: (p) => svc.verifyReview(p),
  deleteReview: (p) => svc.removeReview(p, ADMIN),
  getSettings: () => svc.settingsView(ADMIN),
  saveSettings: (p) => svc.updateSettings(p, ADMIN),
  getActivity: () => svc.activity(),
  logExport: (p) => svc.logExport(p, ADMIN),
  runSpike: async () => {
    throw new svc.BadRequest(`Spike disabled (engine ${ENGINE_VERSION})`);
  },
};

/** Same envelope as the real resolvers: { ok, data } | { ok: false, error }. */
export async function handle(key: string, payload: unknown) {
  const fn = HANDLERS[key];
  if (!fn) return { ok: false, error: `Unknown resolver ${key}` };
  try {
    return { ok: true, data: await fn(payload ?? {}) };
  } catch (e) {
    const known = e instanceof svc.BadRequest;
    if (!known) console.error(`[dev] ${key} failed`, e);
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 300) };
  }
}
