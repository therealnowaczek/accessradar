import EmptyState from '@atlaskit/empty-state';
import { Stack, Text } from '@atlaskit/primitives';
import SectionMessage from '@atlaskit/section-message';
import DynamicTable from '../Table';
import { useCall } from '../data';
import { formatLocal } from '../format';
import { t } from '../i18n';
import { navItem } from '../routes';
import { useApp } from '../shared';
import { ErrorState, PageFrame, PageHeader, PlanNote, Pill, WrapAnywhere } from '../ui';
import { Section } from '../components';
import { SkeletonRoot } from '../skeletons';
import { SkeletonTable } from '../skeletonTable';

type Unavailable = { status: 'needs-consent' | 'unavailable'; reason: string };
type SharedItem = {
  kind: 'filter' | 'dashboard';
  id: string;
  name: string;
  owner: string;
  exposure: 'anyone' | 'loggedin' | 'restricted';
  shares: string[];
};
type Sharing =
  | {
      status: 'ok';
      items: SharedItem[];
      counts: { anyone: number; loggedin: number; total: number };
    }
  | Unavailable;
type Level = {
  schemeId: string;
  schemeName: string;
  levelId: string;
  name: string;
  isDefault: boolean;
  holders: Record<string, number>;
};
type Security =
  | {
      status: 'ok';
      schemes: Array<{ id: string; name: string; levels: number; projects: string[] }>;
      levels: Level[];
    }
  | Unavailable;
type AuditChange = {
  id: string;
  at: string;
  who: string;
  category: string;
  summary: string;
  object: string;
  changes: Array<{ field: string; from: string; to: string }>;
};
type Audit =
  { status: 'ok'; changes: AuditChange[]; since: string } | Unavailable | { denied: string };

/** Why a section has no data: consent not given yet, or a Jira plan/permission limit. Never an error. */
function Unavailable({ section }: { section: Unavailable }) {
  return (
    <SectionMessage
      headingLevel="h3"
      appearance={section.status === 'needs-consent' ? 'warning' : 'information'}
      title={
        section.status === 'needs-consent'
          ? t('exposure.needsConsentTitle')
          : t('exposure.unavailableTitle')
      }
    >
      <Text as="p">
        {section.status === 'needs-consent' ? t('exposure.needsConsentBody') : section.reason}
      </Text>
    </SectionMessage>
  );
}

const EXPOSURE_LABEL = {
  anyone: 'exposure.anyone',
  loggedin: 'exposure.loggedin',
  restricted: 'exposure.restricted',
} as const;

function SharingSection({ data }: { data: Sharing }) {
  if (data.status !== 'ok') return <Unavailable section={data} />;
  if (!data.items.length)
    return (
      <EmptyState header={t('exposure.noPublicHeader')} description={t('exposure.noPublicBody')} />
    );
  return (
    <Stack space="space.200">
      <Text color="color.text.subtle">
        {t('exposure.sharingCounts', {
          anyone: data.counts.anyone,
          loggedin: data.counts.loggedin,
          total: data.counts.total,
        })}
      </Text>
      <DynamicTable
        head={{
          cells: [
            { key: 'name', content: t('exposure.colName'), isSortable: true },
            { key: 'kind', content: t('exposure.colType'), isSortable: true },
            { key: 'owner', content: t('exposure.colOwner'), isSortable: true },
            { key: 'exposure', content: t('exposure.colSharedWith'), isSortable: true },
          ],
        }}
        rows={data.items.map((i) => ({
          key: `${i.kind}-${i.id}`,
          cells: [
            { key: i.name, content: <WrapAnywhere>{i.name}</WrapAnywhere> },
            {
              key: i.kind,
              content: i.kind === 'filter' ? t('exposure.filter') : t('exposure.dashboard'),
            },
            { key: i.owner, content: i.owner },
            {
              key: i.exposure,
              content: (
                <Pill tone={i.exposure === 'anyone' ? 'danger' : 'warning'}>
                  {t(EXPOSURE_LABEL[i.exposure])}
                </Pill>
              ),
            },
          ],
        }))}
        rowsPerPage={25}
        defaultPage={1}
        defaultSortKey="exposure"
        defaultSortOrder="ASC"
      />
    </Stack>
  );
}

function SecuritySection({ data }: { data: Security }) {
  if (data.status !== 'ok') return <Unavailable section={data} />;
  if (!data.levels.length)
    return (
      <EmptyState header={t('exposure.noLevelsHeader')} description={t('exposure.noLevelsBody')} />
    );
  const usage = new Map(data.schemes.map((s) => [s.id, s.projects]));
  return (
    <DynamicTable
      head={{
        cells: [
          { key: 'scheme', content: t('exposure.colScheme'), isSortable: true },
          { key: 'level', content: t('exposure.colLevel'), isSortable: true },
          { key: 'holders', content: t('exposure.colHolders') },
          { key: 'spaces', content: t('exposure.colSpaces') },
        ],
      }}
      rows={data.levels.map((l) => ({
        key: `${l.schemeId}-${l.levelId}`,
        cells: [
          { key: l.schemeName, content: l.schemeName },
          {
            key: l.name,
            content: (
              <WrapAnywhere>
                {l.name}
                {l.isDefault ? (
                  <Text color="color.text.subtle"> · {t('exposure.default')}</Text>
                ) : null}
              </WrapAnywhere>
            ),
          },
          {
            key: 'h',
            content:
              Object.entries(l.holders)
                .map(([type, n]) => `${type} (${n})`)
                .join(', ') || t('exposure.noHolders'),
          },
          { key: 's', content: (usage.get(l.schemeId) ?? []).join(', ') || t('exposure.noSpaces') },
        ],
      }))}
      rowsPerPage={25}
      defaultPage={1}
    />
  );
}

function AuditSection({ data }: { data: Audit }) {
  if ('denied' in data) return <PlanNote benefit={t('exposure.auditPlanBenefit')} />;
  if (data.status !== 'ok') return <Unavailable section={data} />;
  if (!data.changes.length)
    return (
      <EmptyState header={t('exposure.noAuditHeader')} description={t('exposure.noAuditBody')} />
    );
  return (
    <DynamicTable
      head={{
        cells: [
          { key: 'at', content: t('exposure.colWhen'), isSortable: true },
          { key: 'who', content: t('exposure.colWho'), isSortable: true },
          { key: 'what', content: t('exposure.colWhat') },
          { key: 'diff', content: t('exposure.colChange') },
        ],
      }}
      rows={data.changes.map((c) => ({
        key: c.id,
        cells: [
          { key: c.at, content: formatLocal(Date.parse(c.at)) },
          { key: c.who, content: c.who },
          {
            key: c.summary,
            content: (
              <WrapAnywhere>
                {c.summary}
                {c.object ? <Text color="color.text.subtle"> · {c.object}</Text> : null}
              </WrapAnywhere>
            ),
          },
          {
            key: 'd',
            content: c.changes
              .map((x) => `${x.field}: ${x.from || '-'} → ${x.to || '-'}`)
              .join('; '),
          },
        ],
      }))}
      rowsPerPage={25}
      defaultPage={1}
      defaultSortKey="at"
      defaultSortOrder="DESC"
    />
  );
}

export function ExposureView() {
  const meta = navItem('exposure');
  const { status } = useApp();
  const exposure = useCall<{ sharing: Sharing; security: Security }>('getExposure');
  const audit = useCall<Audit>('getAuditChanges', { days: 7 });
  const advanced = status.data?.edition?.features?.changeAlerts;
  return (
    <PageFrame header={<PageHeader title={meta.title} description={meta.description} />}>
      <Stack space="space.400">
        <Section title={t('exposure.sharingTitle')} description={t('exposure.sharingDescription')}>
          {exposure.error && !exposure.data ? (
            <ErrorState
              title={t('exposure.sharingError')}
              message={exposure.error}
              retry={exposure.reload}
            />
          ) : !exposure.data ? (
            <SkeletonRoot>
              <SkeletonTable columns={['Name', 'Type', 'Owner', 'Shared with']} rows={4} />
            </SkeletonRoot>
          ) : (
            <SharingSection data={exposure.data.sharing} />
          )}
        </Section>
        <Section
          title={t('exposure.securityTitle')}
          description={t('exposure.securityDescription')}
        >
          {exposure.error && !exposure.data ? null : !exposure.data ? (
            <SkeletonRoot>
              <SkeletonTable columns={['Scheme', 'Level', 'Holders', 'Spaces']} rows={4} />
            </SkeletonRoot>
          ) : (
            <SecuritySection data={exposure.data.security} />
          )}
        </Section>
        <Section title={t('exposure.auditTitle')} description={t('exposure.auditDescription')}>
          {advanced === false ? (
            <PlanNote benefit={t('exposure.auditPlanBenefit')} />
          ) : audit.error && !audit.data ? (
            <ErrorState
              title={t('exposure.auditError')}
              message={audit.error}
              retry={audit.reload}
            />
          ) : !audit.data ? (
            <SkeletonRoot>
              <SkeletonTable columns={['When', 'Who', 'What', 'Change']} rows={4} />
            </SkeletonRoot>
          ) : (
            <AuditSection data={audit.data} />
          )}
        </Section>
      </Stack>
    </PageFrame>
  );
}
