import { router } from '@forge/bridge';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import CheckCircleIcon from '@atlaskit/icon/core/check-circle';
import Lozenge from '@atlaskit/lozenge';
import ProgressBar from '@atlaskit/progress-bar';
import { useStatus } from './data';
import { MODULE_KEYS } from './routes';
import { ErrorState, Loading, PageFrame, PageHeader } from './ui';

const openApp = () => void router.navigate({ target: 'module', moduleKey: MODULE_KEYS.main });
const openConfig = () => void router.navigate({ target: 'module', moduleKey: MODULE_KEYS.config });

/** Separate screen without the sidebar, like MarginRadar's get-started module. */
export default function GetStartedScreen() {
  const status = useStatus();
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
      title: 'Review what we collect',
      detail:
        'Permission schemes, project roles, groups and application access. Never issue content, and nothing leaves Atlassian.',
      done: false,
      action: { label: 'Open settings', run: openConfig, primary: false },
    },
    {
      id: 'snapshot',
      title: 'Take the first snapshot',
      detail:
        'The first snapshot gives you the full access picture and the baseline for change reports.',
      done: false,
      action: { label: 'Open AccessRadar', run: openApp, primary: true },
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
