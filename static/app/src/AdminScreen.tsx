import { useMemo, useState } from 'react';
import { useStatus } from './data';
import type { ForgeContext } from './main';
import { AdminNav } from './AdminNav';
import { initialView, type ViewId } from './routes';
import { AppContext, type AppCtx, type Params } from './shared';
import { ToastProvider } from './Toast';
import { SplitLayout } from './ui';
import { ActivityView } from './views/ActivityView';
import { ChangesView } from './views/ChangesView';
import { GroupsView } from './views/GroupsView';
import { OverviewView } from './views/OverviewView';
import { PeopleView } from './views/PeopleView';
import { ProjectsView } from './views/ProjectsView';
import { AlertsView } from './views/AlertsView';
import { CampaignsView } from './views/CampaignsView';
import { ExceptionsView } from './views/ExceptionsView';
import { ReviewsView } from './views/ReviewsView';
import { SettingsView } from './views/SettingsView';
import { SnapshotsView } from './views/SnapshotsView';

export default function AdminScreen({ context }: { context: ForgeContext }) {
  return (
    <ToastProvider>
      <Shell context={context} />
    </ToastProvider>
  );
}

const VIEWS: Record<ViewId, () => JSX.Element> = {
  overview: OverviewView,
  'explore-projects': ProjectsView,
  'explore-groups': GroupsView,
  'explore-people': PeopleView,
  changes: ChangesView,
  reviews: ReviewsView,
  exceptions: ExceptionsView,
  alerts: AlertsView,
  campaigns: CampaignsView,
  snapshots: SnapshotsView,
  settings: SettingsView,
  activity: ActivityView,
};

function Shell({ context }: { context: ForgeContext }) {
  const [route, setRoute] = useState<{ view: ViewId; params: Params; n: number }>(() => ({
    view: initialView(context.moduleKey),
    params: {},
    n: 0,
  }));
  const status = useStatus();
  const app = useMemo<AppCtx>(
    () => ({
      view: route.view,
      params: route.params,
      go: (view, params = {}) => setRoute((r) => ({ view, params, n: r.n + 1 })),
      status,
      siteUrl: context.siteUrl,
    }),
    [route, status, context.siteUrl],
  );
  const View = VIEWS[route.view];
  const label = (id: ViewId, text: string) =>
    id === 'alerts' && (status.data?.alertCount ?? 0) > 0
      ? `${text} (${status.data!.alertCount})`
      : text;
  return (
    <AppContext.Provider value={app}>
      <SplitLayout
        sidebar={<AdminNav view={route.view} onChange={(id) => app.go(id)} label={label} />}
      >
        <View key={`${route.view}-${route.n}`} />
      </SplitLayout>
    </AppContext.Provider>
  );
}
