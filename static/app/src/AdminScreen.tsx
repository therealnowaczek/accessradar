import { useState } from 'react';
import {
  ButtonItem,
  NavigationContent,
  NavigationHeader,
  Section,
  SideNavigation,
} from '@atlaskit/side-navigation';
import { useProjects, useStatus } from './data';
import type { ForgeContext } from './main';
import { NAV, initialView, type ViewId } from './routes';
import { ToastProvider } from './Toast';
import { BrandHeader, SplitLayout } from './ui';
import { OverviewView } from './views/OverviewView';
import { PlaceholderView } from './views/PlaceholderView';
import { ProjectsView } from './views/ProjectsView';
import { SettingsView } from './views/SettingsView';

export default function AdminScreen({ context }: { context: ForgeContext }) {
  return (
    <ToastProvider>
      <Shell context={context} />
    </ToastProvider>
  );
}

function Shell({ context }: { context: ForgeContext }) {
  const [view, setView] = useState<ViewId>(() => initialView(context.moduleKey));
  const status = useStatus();
  const projects = useProjects();
  return (
    <SplitLayout
      sidebar={
        <SideNavigation label="AccessRadar">
          <NavigationHeader>
            <BrandHeader subtitle="Site settings" />
          </NavigationHeader>
          <NavigationContent>
            {NAV.map((group) => (
              <Section key={group.group} title={group.group}>
                {group.items.map((item) => (
                  <ButtonItem
                    key={item.id}
                    isSelected={view === item.id}
                    onClick={() => setView(item.id)}
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
      {view === 'overview' ? (
        <OverviewView status={status} projects={projects} goTo={setView} />
      ) : view === 'explore-projects' ? (
        <ProjectsView projects={projects} />
      ) : view === 'settings' ? (
        <SettingsView status={status} />
      ) : (
        <PlaceholderView id={view} goTo={setView} />
      )}
    </SplitLayout>
  );
}
