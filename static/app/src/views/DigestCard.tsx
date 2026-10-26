import { useState } from 'react';
import Button from '@atlaskit/button/new';
import SectionMessage from '@atlaskit/section-message';
import { Stack, Text } from '@atlaskit/primitives';
import DynamicTable from '../Table';
import { call, errorText, type DigestRule, type WeeklyDigest } from '../api';
import { Section } from '../components';
import { useCall } from '../data';
import { formatLocal } from '../format';
import { t, type MessageKey } from '../i18n';
import { MetricGridPhantom } from '../skeletons';
import { useApp } from '../shared';
import { useToast } from '../Toast';
import { Metric, MetricGrid, Pill, PlanNote } from '../ui';

const RULES: DigestRule[] = [
  'new-admin',
  'new-anonymous-grant',
  'inactive-with-access',
  'new-project-admin',
  'new-app-account-admin',
];

const ruleLabel = (rule: DigestRule) => t(`digest.rule.${rule}` as MessageKey);

/**
 * Weekly digest (Standard and Advanced): one in-app summary of the access changes over the last
 * 7 days, built by the weekly scheduled trigger. Real-time alerts stay Advanced; on Standard the
 * card ends with the Advanced note for them (`planNote={false}` where the page shows its own).
 */
export function DigestCard({ planNote = true }: { planNote?: boolean }) {
  const { status } = useApp();
  const toast = useToast();
  const res = useCall<{ digest: WeeklyDigest | null }>('getWeeklyDigest');
  const [busy, setBusy] = useState(false);
  const realtimeLocked =
    Boolean(status.data) && status.data?.edition?.features?.changeAlerts === false;

  const refresh = async () => {
    setBusy(true);
    try {
      await call('refreshWeeklyDigest');
      toast.success(t('digest.refreshQueued'), t('digest.refreshQueuedHint'));
      window.setTimeout(() => void res.reload(), 20_000);
    } catch (e) {
      toast.error(t('digest.refreshFailed'), errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const d = res.data?.digest ?? null;
  let body;
  if (res.error && !res.data) {
    body = (
      <SectionMessage appearance="warning" title={t('digest.unavailable')} headingLevel="h3">
        <Text as="p">{res.error}</Text>
      </SectionMessage>
    );
  } else if (!res.data) {
    body = <MetricGridPhantom count={3} />;
  } else if (!d) {
    body = (
      <Text as="p" color="color.text.subtle">
        {t('digest.none')}
      </Text>
    );
  } else if (d.status === 'no-snapshot') {
    body = (
      <Text as="p" color="color.text.subtle">
        {t('digest.noSnapshot')}
      </Text>
    );
  } else if (d.status === 'no-baseline') {
    body = (
      <Text as="p" color="color.text.subtle">
        {t('digest.noBaseline', { seq: d.head?.seq ?? '' })}
      </Text>
    );
  } else {
    body = (
      <Stack space="space.200">
        <Text as="p" color="color.text.subtle">
          {t('digest.period', {
            base: d.base?.seq ?? '',
            baseAt: d.base ? formatLocal(d.base.startedAt) : '',
            head: d.head?.seq ?? '',
            headAt: d.head ? formatLocal(d.head.startedAt) : '',
            builtAt: formatLocal(d.generatedAt),
          })}
        </Text>
        {d.partialWeek ? (
          <Text as="p" color="color.text.subtle">
            {t('digest.partialWeek')}
          </Text>
        ) : null}
        <MetricGrid>
          {RULES.map((r) => (
            <Metric key={r} label={ruleLabel(r)} value={d.counts[r] ?? 0} />
          ))}
        </MetricGrid>
        {d.items.length ? (
          <DynamicTable
            head={{
              cells: [
                { key: 'sev', content: t('digest.colSeverity'), width: 12 },
                { key: 'type', content: t('digest.colType'), width: 20 },
                { key: 'change', content: t('digest.colChange') },
              ],
            }}
            rows={d.items.map((i, idx) => ({
              key: `${idx}`,
              cells: [
                {
                  key: 'sev',
                  content: (
                    <Pill tone={i.severity === 'high' ? 'danger' : 'warning'}>
                      {t(i.severity === 'high' ? 'digest.high' : 'digest.medium')}
                    </Pill>
                  ),
                },
                { key: 'type', content: ruleLabel(i.rule) },
                {
                  key: 'change',
                  content: (
                    <>
                      <Text weight="bold">{i.title}</Text>
                      <Text as="p" color="color.text.subtle">
                        {i.body}
                      </Text>
                    </>
                  ),
                },
              ],
            }))}
          />
        ) : (
          <Text as="p" color="color.text.subtle">
            {t('digest.empty')}
          </Text>
        )}
        {d.omitted > 0 ? (
          <Text as="p" color="color.text.subtle">
            {t('digest.omitted', { count: d.omitted })}
          </Text>
        ) : null}
      </Stack>
    );
  }

  return (
    <Section
      title={t('digest.title')}
      description={t('digest.description')}
      action={
        <Button onClick={refresh} isDisabled={busy}>
          {t('digest.refresh')}
        </Button>
      }
    >
      {body}
      {planNote && realtimeLocked ? <PlanNote benefit={t('planGate.realtimeAlerts')} /> : null}
    </Section>
  );
}
