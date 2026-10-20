import EmptyState from '@atlaskit/empty-state';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import Button from '@atlaskit/button/new';
import { Box, Stack, Text, xcss } from '@atlaskit/primitives';
import ProgressBar from '@atlaskit/progress-bar';
import SectionMessage, { SectionMessageAction } from '@atlaskit/section-message';
import { call, errorText, type Snapshot, type Status } from './api';
import { useAction, useCall, usePoll, type Loadable } from './data';
import type { ExportContext } from './export/evidence';
import { relative, timeZone } from './format';
import type { ViewId } from './routes';
import { useToast } from './Toast';
import { FilterBar } from './ui';

const progressStyles = xcss({ maxWidth: '35rem' });

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
export const logExport = (kind: string, target?: string, limitationsVersion?: number) =>
  void call('logExport', { kind, target, limitationsVersion }).catch(() => undefined);

export const useSnapshots = () =>
  useCall<{ snapshots: Snapshot[]; active: Snapshot | null }>('listSnapshots');

/**
 * Page refresh (Radar family): ConfigRadar `useAction` busy flag + MarginRadar toast copy.
 * Pass a function that reloads one or more `useCall` sources and returns overall success.
 */
export function useRefresh(reload: () => Promise<boolean>) {
  const toast = useToast();
  const [refresh, refreshing] = useAction(async () => {
    if (await reload()) toast.success('Data refreshed');
    else toast.error('Could not refresh', 'Try again in a moment.');
  });
  return { refresh, refreshing };
}

/** "Take snapshot now": starts (or joins) a collection run and refreshes status. */
export function useTakeSnapshot(
  onStarted?: () => void,
  trigger: 'manual' | 'onboarding' = 'manual',
) {
  const toast = useToast();
  const { status } = useApp();
  const [run, busy] = useAction(async () => {
    try {
      const r = await call<{ created: boolean; seq: number }>('startSnapshot', { trigger });
      toast.success(
        r.created ? `Snapshot #${r.seq} started` : `Snapshot #${r.seq} is already running`,
        'You can keep working; progress updates here.',
      );
      void status.reload();
      onStarted?.();
    } catch (e) {
      toast.error('Snapshot could not start', errorText(e));
    }
  });
  return { run, busy };
}

const STEP_LABEL: Record<string, string> = {
  PLAN: 'Planning: spaces and permission schemes',
  PROJECTS: 'Reading space schemes and roles',
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
      <Box xcss={progressStyles}>
        <Stack space="space.075">
          <ProgressBar
            value={value}
            isIndeterminate={value === undefined}
            ariaLabel="Snapshot progress"
          />
          <Text as="p" color="color.text.subtle">
            {p ? (STEP_LABEL[p.step] ?? p.step) : 'Waiting for the collector'}
            {p?.batches ? ` · batch ${p.batch + 1} of ${p.batches}` : ''}
            {p?.message ? ` · ${p.message}` : ''} · started {relative(active.startedAt)}
          </Text>
          {counts.length ? (
            <Text as="p" color="color.text.subtle">
              {counts.map(([k, n]) => `${n} ${k}`).join(' · ')}
            </Text>
          ) : null}
        </Stack>
      </Box>
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
    <EmptyState
      header="No snapshot yet"
      description={`Take the first snapshot to see ${what}. It reads permission schemes, roles, groups and application access; nothing in Jira changes.`}
      primaryAction={
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
    <SectionMessage
      appearance="warning"
      title={`Snapshot #${snapshot.seq} is partial`}
      actions={
        onDetails ? (
          <SectionMessageAction onClick={onDetails}>What we could not see</SectionMessageAction>
        ) : undefined
      }
    >
      <Text as="p">
        {snapshot.gaps} area{snapshot.gaps === 1 ? '' : 's'} could not be read completely. Results
        below may miss access granted through those areas.
      </Text>
    </SectionMessage>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <FilterBar>{children}</FilterBar>;
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
