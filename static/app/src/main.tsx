import '@atlaskit/css-reset';
import { view } from '@forge/bridge';
import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { errorText } from './api';
import { screenFor } from './routes';
import { ErrorState, Loading } from './ui';
import './styles.css';

// Each Forge module needs one screen, so the other is not downloaded or parsed.
const AdminScreen = lazy(() => import('./AdminScreen'));
const GetStartedScreen = lazy(() => import('./GetStartedScreen'));
const ProjectReviewScreen = lazy(() => import('./ProjectReviewScreen'));

export type ForgeContext = { moduleKey?: string; localId?: string; siteUrl?: string };

function App() {
  const [context, setContext] = useState<ForgeContext | null>(null);
  const [error, setError] = useState('');
  const load = () => {
    setError('');
    view
      .getContext()
      .then((c) => setContext(c as ForgeContext))
      .catch((e) => setError(errorText(e)));
  };
  useEffect(() => {
    // Sync Atlassian design tokens (light/dark) with the host product theme.
    void view.theme.enable();
    load();
  }, []);
  if (error) return <ErrorState title="AccessRadar could not start" message={error} retry={load} />;
  if (!context) return <Loading />;
  const kind = screenFor(context.moduleKey);
  const screen =
    kind === 'get-started' ? (
      <GetStartedScreen />
    ) : kind === 'project' ? (
      <ProjectReviewScreen />
    ) : (
      <AdminScreen context={context} />
    );
  return <Suspense fallback={<Loading />}>{screen}</Suspense>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
