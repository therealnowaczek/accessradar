import { useMemo, useState } from 'react';
import { SideNavBody, SideNavHeader } from '@atlaskit/navigation-system/layout/side-nav';
import { ButtonMenuItem, COLLAPSE_ELEM_BEFORE } from '@atlaskit/side-nav-items/button-menu-item';
import { MenuList } from '@atlaskit/side-nav-items/menu-list';
import { MenuSection, MenuSectionHeading } from '@atlaskit/side-nav-items/menu-section';
import { Stack } from '@atlaskit/primitives';
import Select from '@atlaskit/select';
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
  // Narrow screens: the same navigation as one ADS Select at the top of the page.
  const navOptions = NAV.map((group) => ({
    label: group.group,
    options: group.items.map((item) => ({ value: item.id, label: label(item.id, item.label) })),
  }));
  const current = navOptions.flatMap((g) => g.options).find((o) => o.value === route.view);
  return (
    <AppContext.Provider value={app}>
      <SplitLayout
        mobileNav={
          <>
            <BrandHeader subtitle="Jira access reviews" />
            <Select<{ value: ViewId; label: string }>
              inputId="ar-mobile-nav"
              aria-label="Go to page"
              options={navOptions}
              value={current ?? null}
              onChange={(o) => {
                if (o) app.go(o.value);
              }}
              isSearchable={false}
              spacing="compact"
              menuPortalTarget={document.body}
            />
          </>
        }
        sidebar={
          <nav aria-label="AccessRadar" className="side-nav">
            <SideNavHeader>
              <BrandHeader subtitle="Jira access reviews" />
            </SideNavHeader>
            <SideNavBody>
              <Stack space="space.150">
                {NAV.map((group) => (
                  <MenuSection key={group.group} ariaLabel={group.group}>
                    <MenuSectionHeading>{group.group}</MenuSectionHeading>
                    <MenuList>
                      {group.items.map((item) => (
                        <ButtonMenuItem
                          key={item.id}
                          elemBefore={COLLAPSE_ELEM_BEFORE}
                          isSelected={route.view === item.id}
                          aria-current={route.view === item.id ? 'page' : undefined}
                          onClick={() => app.go(item.id)}
                        >
                          {label(item.id, item.label)}
                        </ButtonMenuItem>
                      ))}
                    </MenuList>
                  </MenuSection>
                ))}
              </Stack>
            </SideNavBody>
          </nav>
        }
      >
        <View key={`${route.view}-${route.n}`} />
      </SplitLayout>
    </AppContext.Provider>
  );
}
