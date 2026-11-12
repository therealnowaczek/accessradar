import { t } from './i18n';
import { router } from '@forge/bridge';
import Button, { IconButton } from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import CheckCircleIcon from '@atlaskit/icon/core/check-circle';
import RefreshIcon from '@atlaskit/icon/core/refresh';
import { Box, Inline, Stack, Text, xcss } from '@atlaskit/primitives';
import ProgressBar from '@atlaskit/progress-bar';
import { useState } from 'react';
import SectionMessage from '@atlaskit/section-message';
import { token } from '@atlaskit/tokens';
import { call, errorText } from './api';
import { usePoll, useStatus } from './data';
import { MODULE_KEYS } from './routes';
import { useRefresh } from './shared';
import { ToastProvider, useToast } from './Toast';
import { BrandMark, ErrorState, PageFrame, PageHeader, Pill, staleNotice } from './ui';
import { LinesPhantom, Phantom, SkeletonRoot } from './skeletons';

const contentStyles = xcss({ maxWidth: '35rem' });
const stepListStyles = xcss({ listStyle: 'none', margin: 'space.0', padding: 'space.0' });
const stepStyles = xcss({
  paddingBlock: 'space.200',
  borderBlockEndWidth: 'border.width',
  borderBlockEndStyle: 'solid',
  borderBlockEndColor: 'color.border',
});
const stepMarkerStyles = xcss({
  display: 'flex',
  flexShrink: 0,
  justifyContent: 'center',
  width: '1.75rem',
  paddingBlockStart: 'space.025',
});

const stepTextStyles = xcss({ flexGrow: 1 });

const openApp = () => void router.navigate({ target: 'module', moduleKey: MODULE_KEYS.main });
const openConfig = () => void router.navigate({ target: 'module', moduleKey: MODULE_KEYS.config });

/** Separate screen without the sidebar, like MarginRadar's get-started module. */
export default function GetStartedScreen() {
  return (
    <ToastProvider>
      <GetStartedBody />
    </ToastProvider>
  );
}

function GetStartedBody() {
  const status = useStatus();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const active = status.data?.active ?? null;
  usePoll(Boolean(active), status.reload);
  const { refresh, refreshing } = useRefresh(() => status.reload());
  // R-8.7: an action without a form reports success and failure as toasts.
  const takeFirst = async () => {
    setBusy(true);
    try {
      const r = await call<{ created: boolean; seq: number }>('startSnapshot', {
        trigger: 'onboarding',
      });
      toast.success(
        r.created
          ? t('shared.snapshotStarted', { seq: r.seq })
          : t('shared.snapshotAlreadyRunning', { seq: r.seq }),
        t('getStarted.leavePageProgressUpdates'),
      );
      void status.reload();
    } catch (e) {
      toast.error(t('getStarted.snapshotCouldNotStart'), errorText(e));
    } finally {
      setBusy(false);
    }
  };
  // R-10.13: only a first-load error replaces the page; a refresh error keeps the data.
  if (status.error && !status.data)
    return (
      <PageFrame
        header={
          <PageHeader
            title={t('getStarted.getStartedWithAccessradar')}
            description={t('getStarted.threeStepsToYourFirstAccess')}
          />
        }
      >
        <ErrorState
          title={t('getStarted.checklistUnavailable')}
          message={status.error}
          retry={status.reload}
        />
      </PageFrame>
    );
  if (!status.data)
    return (
      <PageFrame
        header={
          <PageHeader
            title={t('getStarted.getStartedWithAccessradar')}
            description={t('getStarted.threeStepsToYourFirstAccess')}
          />
        }
      >
        <Box xcss={contentStyles}>
          <SkeletonRoot>
            <Inline space="space.200" alignBlock="center">
              <BrandMark size={56} />
              <Stack space="space.050">
                <Heading size="medium" as="h2">
                  {t('getStarted.accessradar')}
                </Heading>
                <Text as="p" color="color.text.subtle">
                  {t('getStarted.whoHasAccessToWhatIn')}
                </Text>
              </Stack>
            </Inline>
            <Stack space="space.200">
              <Phantom height={6} radius="full" />
              <Phantom width={160} />
            </Stack>
            <Stack space="space.300">
              {[1, 2, 3].map((n) => (
                <Inline key={n} space="space.200" alignBlock="start">
                  <Phantom width={24} height={24} radius="full" />
                  <Box xcss={stepTextStyles}>
                    <Stack space="space.100">
                      <Phantom width="45%" height={16} />
                      <LinesPhantom lines={2} />
                    </Stack>
                  </Box>
                </Inline>
              ))}
            </Stack>
          </SkeletonRoot>
        </Box>
      </PageFrame>
    );
  const steps = [
    {
      id: 'install',
      title: t('getStarted.installAndConnect'),
      detail: t('getStarted.accessradarIsInstalledAndCanRead'),
      done: true,
    },
    {
      id: 'collect',
      title: t('getStarted.reviewWhatWeCollectAndThe'),
      detail: t('getStarted.permissionSchemesSpaceRolesGroupsApplication'),
      done: status.data.settingsSaved,
      action: { label: t('getStarted.openSettings'), run: openConfig, primary: false },
    },
    {
      id: 'snapshot',
      title: t('getStarted.takeTheFirstSnapshot'),
      detail: active
        ? active.progress?.message
          ? t('getStarted.snapshotRunningWithMessage', {
              seq: active.seq,
              message: active.progress.message,
            })
          : t('getStarted.snapshotRunningLeavePage', { seq: active.seq })
        : t('getStarted.theFirstSnapshotGivesYouThe'),
      done: Boolean(status.data.latest),
      action: active
        ? { label: t('getStarted.openAccessradar'), run: openApp, primary: false }
        : {
            label: t('getStarted.takeTheFirstSnapshot'),
            run: () => void takeFirst(),
            primary: true,
          },
    },
  ];
  const done = steps.filter((s) => s.done).length;
  return (
    <PageFrame
      header={
        <PageHeader
          title={t('getStarted.getStartedWithAccessradar')}
          description={t('getStarted.threeStepsToYourFirstAccess')}
          actions={
            <IconButton
              icon={RefreshIcon}
              label={t('getStarted.refresh')}
              isLoading={refreshing}
              onClick={() => void refresh()}
            />
          }
        />
      }
      notice={staleNotice(status)}
    >
      <Box xcss={contentStyles}>
        <Stack space="space.300">
          <Inline space="space.200" alignBlock="center">
            <BrandMark size={56} />
            <Stack space="space.050">
              <Heading size="medium" as="h2">
                {t('getStarted.accessradar')}
              </Heading>
              <Text as="p" color="color.text.subtle">
                {t('getStarted.whoHasAccessToWhatIn')}
              </Text>
            </Stack>
          </Inline>
          <Stack space="space.200">
            <ProgressBar
              value={done / steps.length}
              ariaLabel={t('getStarted.stepsComplete', { done, total: steps.length })}
            />
            <Text as="p" color="color.text.subtle">
              {t('getStarted.stepsComplete', { done, total: steps.length })}
            </Text>
          </Stack>
          {done === steps.length ? (
            <SectionMessage
              appearance="success"
              title={t('getStarted.youAreSetUp')}
              headingLevel="h2"
            >
              <Stack space="space.200" alignInline="start">
                <Text as="p">{t('getStarted.theFirstSnapshotIsReadyExplore')}</Text>
                <Button appearance="primary" onClick={openApp}>
                  {t('getStarted.openAccessradar')}
                </Button>
              </Stack>
            </SectionMessage>
          ) : null}
          <Stack as="ol" xcss={stepListStyles}>
            {steps.map((step, index) => (
              <Box as="li" xcss={stepStyles} key={step.id}>
                <Inline space="space.200" alignBlock="start">
                  <Box xcss={stepMarkerStyles} aria-hidden="true">
                    {step.done ? (
                      <CheckCircleIcon label="" color={token('color.icon.success')} />
                    ) : (
                      // R-8.10: an ordinal, not a counter, so plain text instead of Badge.
                      <Text weight="bold" color="color.text.subtle">
                        {index + 1}
                      </Text>
                    )}
                  </Box>
                  <Stack space="space.100" alignInline="start">
                    <Inline space="space.100" alignBlock="center" shouldWrap>
                      <Heading size="small" as="h2">
                        {step.title}
                      </Heading>
                      {step.done ? <Pill tone="success">{t('getStarted.done')}</Pill> : null}
                    </Inline>
                    <Text as="p" color="color.text.subtle">
                      {step.detail}
                    </Text>
                    {!step.done && step.action ? (
                      <Button
                        appearance={step.action.primary ? 'primary' : 'default'}
                        onClick={step.action.run}
                        isLoading={step.id === 'snapshot' && busy}
                      >
                        {step.action.label}
                      </Button>
                    ) : null}
                  </Stack>
                </Inline>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Box>
    </PageFrame>
  );
}
