import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import Button from '@atlaskit/button/new';
import ProgressBar from '@atlaskit/progress-bar';
import SectionMessage from '@atlaskit/section-message';
import { call, errorText, type Snapshot, type Status } from './api';
import { useCall, usePoll, type Loadable } from './data';
import type { ExportContext } from './export/evidence';
import { relative, timeZone } from './format';
import type { ViewId } from './routes';
import { useToast } from './Toast';
import { Empty } from './ui';

export type Params = Record<string, string>;

export type AppCtx = {
  view: ViewId;
  params: Params;
  go: (view: ViewId, params?: Params) => void;
  status: Loadable<Status>;
  siteUrl?: string;
};

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext missing');
  return ctx;
}

export function exportContext(siteUrl?: string): ExportContext {
  return { siteUrl, tz: timeZone(), now: Date.now() };
}

/** Records an export in the audit log (best effort; exports themselves are client-side). */
export const logExport = (kind: string, target?: string) =>
  void call('logExport', { kind, target }).catch(() => undefined);

export const useSnapshots = () =>
  useCall<{ snapshots: Snapshot[]; active: Snapshot | null }>('listSnapshots');

/** "Take snapshot now": starts (or joins) a collection run and refreshes status. */
export function useTakeSnapshot(
  onStarted?: () => void,
  trigger: 'manual' | 'onboarding' = 'manual',
) {
  const toast = useToast();
  const { status } = useApp();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => {
    setBusy(true);
    try {
      const r = await call<{ created: boolean; seq: number }>('startSnapshot', { trigger });
      toast.success(
        r.created ? `Snapshot #${r.seq} started` : `Snapshot #${r.seq} is already running`,
        'You can keep working; progress updates here.',
      );
      status.reload();
      onStarted?.();
    } catch (e) {
      toast.error('Snapshot could not start', errorText(e));
    } finally {
      setBusy(false);
    }
  }, [toast, status, onStarted, trigger]);
  return { run, busy };
}

const STEP_LABEL: Record<string, string> = {
  PLAN: 'Planning: projects and permission schemes',
  PROJECTS: 'Reading project schemes and roles',
  DIRECTORY: 'Reading groups, application access and users',
  GROUPS: 'Reading group members',
  FINALIZE: 'Computing effective access',
};

/** Live progress of the running snapshot; polls status while active. */
export function SnapshotProgress({ active }: { active: Snapshot }) {
  const { status } = useApp();
  usePoll(true, () => {
    status.reload();
  });
  const p = active.progress;
  const value = p?.batches ? Math.min(1, (p.batch + 1) / Math.max(1, p.batches)) : undefined;
  const counts = p?.counts ? Object.entries(p.counts).filter(([, n]) => n) : [];
  return (
    <SectionMessage
      appearance="information"
      title={`Snapshot #${active.seq} is ${active.status === 'queued' ? 'queued' : 'running'}`}
    >
      <div className="progress-block">
        <ProgressBar
          value={value}
          isIndeterminate={value === undefined}
          ariaLabel="Snapshot progress"
        />
        <p className="subtle">
          {p ? (STEP_LABEL[p.step] ?? p.step) : 'Waiting for the collector'}
          {p?.batches ? ` · batch ${p.batch + 1} of ${p.batches}` : ''}
          {p?.message ? ` · ${p.message}` : ''} · started {relative(active.startedAt)}
        </p>
        {counts.length ? (
          <p className="subtle">{counts.map(([k, n]) => `${n} ${k}`).join(' · ')}</p>
        ) : null}
      </div>
    </SectionMessage>
  );
}

/** Shown wherever a view needs data and no snapshot exists yet. */
export function NoSnapshot({ what }: { what: string }) {
  const { status } = useApp();
  const take = useTakeSnapshot();
  const active = status.data?.active;
  if (active) return <SnapshotProgress active={active} />;
  return (
    <Empty
      title="No snapshot yet"
      description={`Take the first snapshot to see ${what}. It reads permission schemes, roles, groups and application access; nothing in Jira changes.`}
      action={
        <Button appearance="primary" isLoading={take.busy} onClick={() => void take.run()}>
          Take snapshot now
        </Button>
      }
    />
  );
}

/** Snapshot banner for partial data: incompleteness is always visible. */
export function PartialBanner({
  snapshot,
  onDetails,
}: {
  snapshot: Snapshot | null;
  onDetails?: () => void;
}) {
  if (!snapshot || snapshot.status !== 'partial') return null;
  return (
    <SectionMessage appearance="warning" title={`Snapshot #${snapshot.seq} is partial`}>
      <div className="section-stack">
        <p>
          {snapshot.gaps} area{snapshot.gaps === 1 ? '' : 's'} could not be read completely. Results
          below may miss access granted through those areas.
        </p>
        {onDetails ? (
          <div>
            <Button onClick={onDetails}>What we could not see</Button>
          </div>
        ) : null}
      </div>
    </SectionMessage>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="filter-bar">{children}</div>;
}

/** Runs an export with toasts; exports never leave the browser. */
export function useExporter() {
  const toast = useToast();
  return useCallback(
    async (label: string, fn: () => Promise<unknown> | unknown) => {
      try {
        await fn();
        toast.success(`${label} downloaded`);
      } catch (e) {
        toast.error(`${label} failed`, errorText(e));
      }
    },
    [toast],
  );
}
