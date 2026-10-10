/** Versioned control-mapping copy for the Advanced evidence pack. Bump when text changes. */
export const CONTROLS_VERSION = 1;

export type ControlMapping = {
  framework: 'SOC 2' | 'ISO/IEC 27001:2022';
  id: string;
  title: string;
  accessRadar: string;
};

export const CONTROL_MAPPINGS: readonly ControlMapping[] = [
  {
    framework: 'SOC 2',
    id: 'CC6.1',
    title: 'Logical access security — restricted access',
    accessRadar:
      'Effective access inventory with why-path resolution; risk rules for anonymous grants, broad application roles, and app-account admins.',
  },
  {
    framework: 'SOC 2',
    id: 'CC6.2',
    title: 'Registration and authorization; removal when no longer needed',
    accessRadar:
      'Revoke decisions with mandatory justification; remediation verification against later snapshots; inactive-user risk rule.',
  },
  {
    framework: 'SOC 2',
    id: 'CC6.3',
    title: 'Role-based access, periodic review, least privilege',
    accessRadar:
      'Signed periodic access reviews; exceptions with expiry and re-review; wide-admin risk rule.',
  },
  {
    framework: 'ISO/IEC 27001:2022',
    id: 'A.5.15',
    title: 'Access control',
    accessRadar:
      'Site access picture, key-permission reviews, and coverage/limitations disclosure.',
  },
  {
    framework: 'ISO/IEC 27001:2022',
    id: 'A.5.18',
    title: 'Access rights (provision, review, removal)',
    accessRadar:
      'Keep / revoke / exception decisions with sign-off, evidence hash, and remediation status.',
  },
  {
    framework: 'ISO/IEC 27001:2022',
    id: 'A.8.2',
    title: 'Privileged access rights',
    accessRadar: 'Admin, wide-admin, and app-accounts-admin risk indicators from snapshot data.',
  },
];

export const CONTROLS_DISCLAIMER =
  'Mapping supports, but does not by itself demonstrate, control operating effectiveness.';

export const EVIDENCE_DATA_SOURCES = [
  'GET /rest/api/3/project/search',
  'GET /rest/api/3/permissionscheme',
  'GET /rest/api/3/project/{id}/role',
  'GET /rest/api/3/group/bulk',
  'GET /rest/api/3/group/member',
  'GET /rest/api/3/users/search',
  'POST /rest/api/3/permissions/check',
] as const;
