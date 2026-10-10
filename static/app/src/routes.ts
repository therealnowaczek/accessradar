/** In-app navigation. Jira's admin menu shows one entry per Forge module; everything else is client-side. */
export type ViewId =
  | 'overview'
  | 'explore-projects'
  | 'explore-groups'
  | 'explore-people'
  | 'changes'
  | 'reviews'
  | 'exceptions'
  | 'alerts'
  | 'campaigns'
  | 'snapshots'
  | 'settings'
  | 'activity';

export type NavItem = { id: ViewId; label: string; title: string; description: string };

export const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'Home',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        title: 'Overview',
        description:
          'Who has access to what in this site, why, and what changed since the last review.',
      },
    ],
  },
  {
    group: 'Explore',
    items: [
      {
        id: 'explore-projects',
        label: 'Projects',
        title: 'Projects',
        description: 'Who has access to a project, and through which scheme, role or group.',
      },
      {
        id: 'explore-groups',
        label: 'Groups',
        title: 'Groups',
        description: 'Where a group reaches across projects, schemes and application access.',
      },
      {
        id: 'explore-people',
        label: 'People',
        title: 'People',
        description: 'What a person can do, and through which path.',
      },
    ],
  },
  {
    group: 'Review',
    items: [
      {
        id: 'changes',
        label: 'Changes',
        title: 'Changes',
        description: 'Access granted and revoked between two snapshots.',
      },
      {
        id: 'reviews',
        label: 'Reviews',
        title: 'Access reviews',
        description: 'Periodic access reviews with sign-off and evidence export.',
      },
      {
        id: 'exceptions',
        label: 'Exceptions',
        title: 'Exceptions',
        description: 'Access exceptions granted during reviews, with expiry dates.',
      },
      {
        id: 'alerts',
        label: 'Alerts',
        title: 'Change alerts',
        description:
          'In-app alerts when admins, anonymous access, or inactive accounts change between snapshots.',
      },
      {
        id: 'campaigns',
        label: 'Campaigns',
        title: 'Review campaigns',
        description: 'Recurring access reviews delegated to project owners, with in-app reminders.',
      },
      {
        id: 'snapshots',
        label: 'Snapshots',
        title: 'Snapshots',
        description: 'Snapshot history, status and completeness.',
      },
    ],
  },
  {
    group: 'Configuration',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        title: 'Settings',
        description: 'Snapshot schedule, key permissions, retention, and security & data.',
      },
      {
        id: 'activity',
        label: 'Activity',
        title: 'Activity',
        description: 'Audit log of snapshots, reviews, sign-offs, exports and settings changes.',
      },
    ],
  },
];

export const NAV_ITEMS = NAV.flatMap((group) => group.items);

export const navItem = (id: ViewId): NavItem =>
  NAV_ITEMS.find((item) => item.id === id) ?? NAV_ITEMS[0];

export const MODULE_KEYS = {
  main: 'accessradar-admin',
  config: 'accessradar-config',
  getStarted: 'accessradar-get-started',
  projectReview: 'accessradar-project-review',
} as const;

export type Screen = 'app' | 'get-started' | 'project';

/** Picks the screen from the Forge module that rendered the iframe. */
export function screenFor(moduleKey: string | undefined): Screen {
  if (moduleKey === MODULE_KEYS.getStarted) return 'get-started';
  if (moduleKey === MODULE_KEYS.projectReview) return 'project';
  return 'app';
}

/** First view shown: the configuration module (useAsConfig) opens Settings, the main page Overview. */
export function initialView(moduleKey: string | undefined): ViewId {
  return moduleKey === MODULE_KEYS.config ? 'settings' : 'overview';
}
