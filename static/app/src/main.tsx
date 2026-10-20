import '@atlaskit/css-reset';
import { view } from '@forge/bridge';
import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SectionMessage from '@atlaskit/section-message';
import { Text } from '@atlaskit/primitives';
import { errorText } from './api';
import { setContextTimeZone } from './format';
import { initialView, navItem, screenFor } from './routes';
import { AdminPhantom, AppPhantom, PagePhantom } from './skeletons';
import { ErrorState } from './ui';
import './styles.css';

// Each Forge module needs one screen, so the other is not downloaded or parsed.
const AdminScreen = lazy(() => import('./AdminScreen'));
const GetStartedScreen = lazy(() => import('./GetStartedScreen'));
const ProjectReviewScreen = lazy(() => import('./ProjectReviewScreen'));

export type ForgeContext = {
  moduleKey?: string;
  localId?: string;
  siteUrl?: string;
  /** Time zone from the user's Jira profile; every displayed date uses it. */
  timezone?: string;
  /** Present on licensed (production) installs; absent on development and staging. */
  license?: { active?: boolean } | null;
};

/**
 * AccessRadar is English-only for now (translations on hold). The language always follows the
 * user's Jira settings (`context.locale`) with English as the fallback; there is no in-app
 * language picker anywhere.
 */

function App() {
  const [context, setContext] = useState<ForgeContext | null>(null);
  const [error, setError] = useState('');
  const load = () => {
    setError('');
    view
      .getContext()
      .then((c) => {
        const next = c as ForgeContext;
        setContextTimeZone(next.timezone);
        setContext(next);
      })
      .catch((e) => setError(errorText(e)));
  };
  useEffect(() => {
    // Sync Atlassian design tokens (light/dark) with the host product theme.
    void view.theme.enable();
    load();
  }, []);
  if (error) return <ErrorState title="AccessRadar could not start" message={error} retry={load} />;
  // Full-screen-shaped skeleton until the context arrives (never a full-page spinner).
  if (!context) return <AppPhantom />;
  if (context.license && context.license.active !== true) {
    return (
      <SectionMessage appearance="warning" title="AccessRadar needs an active license">
        <Text as="p">
          The license for AccessRadar on this site is not active. Ask your Jira administrator to
          renew or start a trial in Manage apps.
        </Text>
      </SectionMessage>
    );
  }
  const kind = screenFor(context.moduleKey);
  const screen =
    kind === 'get-started' ? (
      <GetStartedScreen />
    ) : kind === 'project' ? (
      <ProjectReviewScreen />
    ) : (
      <AdminScreen context={context} />
    );
  const first = navItem(initialView(context.moduleKey));
  const fallback =
    kind === 'get-started' ? (
      <PagePhantom
        title="Get started with AccessRadar"
        description="Three steps to your first access review."
      />
    ) : kind === 'project' ? (
      <PagePhantom
        title="Access review"
        description="Review who has key permissions in this space. Decisions stay in AccessRadar until a Jira admin signs."
      />
    ) : (
      <AdminPhantom title={first.title} description={first.description} />
    );
  return <Suspense fallback={fallback}>{screen}</Suspense>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
