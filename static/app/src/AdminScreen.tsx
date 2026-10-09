import { useMemo, useState } from 'react';
import {
  ButtonItem,
  NavigationContent,
  NavigationHeader,
  Section,
  SideNavigation,
} from '@atlaskit/side-navigation';
import { useStatus } from './data';
import type { ForgeContext } from './main';
import { NAV, initialView, type ViewId } from './routes';
import { AppContext, type AppCtx, type Params } from './shared';
import { ToastProvider } from './Toast';
import { BrandHeader, SplitLayout } from './ui';
import { ActivityView } from './views/ActivityView';
import { ChangesView } from './views/ChangesView';
import { GroupsView } from './views/GroupsView';
import { OverviewView } from './views/OverviewView';
import { PeopleView } from './views/PeopleView';
import { ProjectsView } from './views/ProjectsView';
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
  return (
    <AppContext.Provider value={app}>
      <SplitLayout
        sidebar={
          <SideNavigation label="AccessRadar">
            <NavigationHeader>
              <BrandHeader subtitle="Jira access reviews" />
            </NavigationHeader>
            <NavigationContent>
              {NAV.map((group) => (
                <Section key={group.group} title={group.group}>
                  {group.items.map((item) => (
                    <ButtonItem
                      key={item.id}
                      isSelected={route.view === item.id}
                      onClick={() => app.go(item.id)}
                    >
                      {item.label}
                    </ButtonItem>
                  ))}
                </Section>
              ))}
            </NavigationContent>
          </SideNavigation>
        }
      >
        <View key={`${route.view}-${route.n}`} />
      </SplitLayout>
    </AppContext.Provider>
  );
}
