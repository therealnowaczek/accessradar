import { t, type MessageKey } from './i18n';
/** In-app navigation. Jira's admin menu shows one entry per Forge module; everything else is client-side. */
export type ViewId =
  | 'overview'
  | 'explore-projects'
  | 'explore-groups'
  | 'explore-people'
  | 'seats'
  | 'exposure'
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
        label: 'Spaces',
        title: 'Spaces',
        description: 'Who has access to a space, and through which scheme, role or group.',
      },
      {
        id: 'explore-groups',
        label: 'Groups',
        title: 'Groups',
        description: 'Where a group reaches across spaces, schemes and application access.',
      },
      {
        id: 'explore-people',
        label: 'People',
        title: 'People',
        description: 'What a person can do, and through which path.',
      },
      {
        id: 'seats',
        label: 'Seats',
        title: 'Seats',
        description: 'Which groups grant product access, who is in them, and seats worth a review.',
      },
      {
        id: 'exposure',
        label: 'Sharing and security',
        title: 'Sharing and security',
        description:
          'Publicly shared filters and dashboards, issue security levels and recent permission changes in the Jira audit log.',
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
        description: 'Recurring access reviews delegated to space owners, with in-app reminders.',
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

/** Navigation entry with its copy in the user's language (English when a key is missing). */
export const navItem = (id: ViewId): NavItem => {
  const item = NAV_ITEMS.find((x) => x.id === id) ?? NAV_ITEMS[0]!;
  return {
    id: item.id,
    label: t(`nav.${item.id}.label` as MessageKey),
    title: t(`nav.${item.id}.title` as MessageKey),
    description: t(`nav.${item.id}.description` as MessageKey),
  };
};

export const navGroupLabel = (group: string): string => t(`nav.group.${group}` as MessageKey);

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
