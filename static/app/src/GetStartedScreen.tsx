import { router } from '@forge/bridge';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import CheckCircleIcon from '@atlaskit/icon/core/check-circle';
import Lozenge from '@atlaskit/lozenge';
import ProgressBar from '@atlaskit/progress-bar';
import { useState } from 'react';
import SectionMessage from '@atlaskit/section-message';
import { call, errorText } from './api';
import { usePoll, useStatus } from './data';
import { MODULE_KEYS } from './routes';
import { ErrorState, Loading, PageFrame, PageHeader } from './ui';

const openApp = () => void router.navigate({ target: 'module', moduleKey: MODULE_KEYS.main });
const openConfig = () => void router.navigate({ target: 'module', moduleKey: MODULE_KEYS.config });

/** Separate screen without the sidebar, like MarginRadar's get-started module. */
export default function GetStartedScreen() {
  const status = useStatus();
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState('');
  const active = status.data?.active ?? null;
  usePoll(Boolean(active), status.reload);
  const takeFirst = async () => {
    setBusy(true);
    setStartError('');
    try {
      await call('startSnapshot', { trigger: 'onboarding' });
      status.reload();
    } catch (e) {
      setStartError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (status.error)
    return (
      <PageFrame header={<PageHeader title="Get started with AccessRadar" />}>
        <ErrorState title="Checklist unavailable" message={status.error} retry={status.reload} />
      </PageFrame>
    );
  if (!status.data) return <Loading />;
  const steps = [
    {
      id: 'install',
      title: 'Install and connect',
      detail: 'AccessRadar is installed and can read this site’s access configuration.',
      done: true,
    },
    {
      id: 'collect',
      title: 'Review what we collect and the schedule',
      detail:
        'Permission schemes, project roles, groups, application access and account status. Never issue content, and nothing leaves Atlassian. Confirm the snapshot schedule in Settings.',
      done: status.data.settingsSaved,
      action: { label: 'Open settings', run: openConfig, primary: false },
    },
    {
      id: 'snapshot',
      title: 'Take the first snapshot',
      detail: active
        ? `Snapshot #${active.seq} is running${active.progress?.message ? `: ${active.progress.message}` : ''}. You can leave this page.`
        : 'The first snapshot gives you the full access picture and the baseline for change reports.',
      done: Boolean(status.data.latest),
      action: active
        ? { label: 'Open AccessRadar', run: openApp, primary: false }
        : { label: 'Take the first snapshot', run: () => void takeFirst(), primary: true },
    },
  ];
  const done = steps.filter((s) => s.done).length;
  return (
    <PageFrame
      header={
        <PageHeader
          title="Get started with AccessRadar"
          description="Three steps to your first access review."
          actions={<Button onClick={status.reload}>Refresh</Button>}
        />
      }
    >
      <div className="page-stack settings-content">
        <div className="section-stack">
          <ProgressBar
            value={done / steps.length}
            ariaLabel={`${done} of ${steps.length} steps complete`}
          />
          <p className="subtle">
            {done} of {steps.length} steps complete
          </p>
        </div>
        {startError ? (
          <SectionMessage appearance="error" title="Snapshot could not start">
            <p>{startError}</p>
          </SectionMessage>
        ) : null}
        {done === steps.length ? (
          <SectionMessage appearance="success" title="You are set up">
            <div className="section-stack">
              <p>
                The first snapshot is ready. Explore who has access to what, or start your first
                review.
              </p>
              <div>
                <Button appearance="primary" onClick={openApp}>
                  Open AccessRadar
                </Button>
              </div>
            </div>
          </SectionMessage>
        ) : null}
        <ol className="steps">
          {steps.map((step, index) => (
            <li className="step" key={step.id}>
              <span className={`step-marker ${step.done ? 'is-done' : ''}`} aria-hidden="true">
                {step.done ? <CheckCircleIcon label="" /> : index + 1}
              </span>
              <div className="step-body">
                <div className="status-row">
                  <Heading size="small" as="h2">
                    {step.title}
                  </Heading>
                  {step.done ? <Lozenge appearance="success">Done</Lozenge> : null}
                </div>
                <p className="subtle">{step.detail}</p>
                {!step.done && step.action ? (
                  <Button
                    appearance={step.action.primary ? 'primary' : 'default'}
                    onClick={step.action.run}
                    isLoading={step.id === 'snapshot' && busy}
                  >
                    {step.action.label}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </PageFrame>
  );
}
