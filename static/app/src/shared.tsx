import { t } from './i18n';
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
    if (await reload()) toast.success(t('shared.dataRefreshed'));
    else toast.error(t('shared.couldNotRefresh'), t('shared.tryAgainInAMoment'));
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
        r.created
          ? t('shared.snapshotStarted', { seq: r.seq })
          : t('shared.snapshotAlreadyRunning', { seq: r.seq }),
        t('shared.keepWorkingProgressUpdates'),
      );
      void status.reload();
      onStarted?.();
    } catch (e) {
      toast.error(t('getStarted.snapshotCouldNotStart'), errorText(e));
    }
  });
  return { run, busy };
}

const stepLabel = (step: string): string => {
  switch (step) {
    case 'PLAN':
      return t('shared.stepPlan');
    case 'PROJECTS':
      return t('shared.stepProjects');
    case 'DIRECTORY':
      return t('shared.stepDirectory');
    case 'GROUPS':
      return t('shared.stepGroups');
    case 'FINALIZE':
      return t('shared.stepFinalize');
    default:
      return step;
  }
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
      title={t(active.status === 'queued' ? 'shared.snapshotQueued' : 'shared.snapshotRunning', {
        seq: active.seq,
      })}
      headingLevel="h2"
    >
      <Box xcss={progressStyles}>
        <Stack space="space.075">
          <ProgressBar
            value={value}
            isIndeterminate={value === undefined}
            ariaLabel={t('shared.snapshotProgress')}
          />
          <Text as="p" color="color.text.subtle">
            {[
              p ? stepLabel(p.step) : t('shared.waitingForTheCollector'),
              p?.batches
                ? t('shared.progressBatch', { batch: p.batch + 1, batches: p.batches })
                : '',
              p?.message ?? '',
              t('shared.progressStarted', { when: relative(active.startedAt) }),
            ]
              .filter(Boolean)
              .join(' · ')}
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

/**
 * Shown wherever a view needs data and no snapshot exists yet. Pass `headingSize="xsmall"` when it
 * sits among other sections or under pickers (R-8.6); alone on a page it keeps the default size.
 */
export function NoSnapshot({ what, headingSize }: { what: string; headingSize?: 'xsmall' }) {
  const { status } = useApp();
  const take = useTakeSnapshot();
  const active = status.data?.active;
  if (active) return <SnapshotProgress active={active} />;
  return (
    <EmptyState
      headingSize={headingSize}
      header={t('shared.noSnapshotYet')}
      description={t('shared.takeFirstSnapshotToSee', { what })}
      primaryAction={
        <Button appearance="primary" isLoading={take.busy} onClick={() => void take.run()}>
          {t('shared.takeSnapshotNow')}
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
      title={t('shared.snapshotPartial', { seq: snapshot.seq })}
      headingLevel="h2"
      actions={
        onDetails ? (
          <SectionMessageAction onClick={onDetails}>
            {t('shared.whatWeCouldNotSee')}
          </SectionMessageAction>
        ) : undefined
      }
    >
      <Text as="p">{t('shared.areasCouldNotBeRead', { count: snapshot.gaps })}</Text>
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
        toast.success(t('shared.exportDownloaded', { label }));
      } catch (e) {
        toast.error(t('shared.exportFailed', { label }), errorText(e));
      }
    },
    [toast],
  );
}
