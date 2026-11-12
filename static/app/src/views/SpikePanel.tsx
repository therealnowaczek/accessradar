import { t } from '../i18n';
import { useState } from 'react';
import Button from '@atlaskit/button/new';
import { Code } from '@atlaskit/code';
import { Inline, Stack, Text } from '@atlaskit/primitives';
import SectionMessage from '@atlaskit/section-message';
import Tooltip from '@atlaskit/tooltip';
import { call, errorText, type Probe, type SpikeResult } from '../api';
import DynamicTable from '../Table';
import { useToast } from '../Toast';
import { ErrorState, Pill, SectionHeader } from '../ui';

/** Shown only when the backend reports ACCESSRADAR_SPIKE=1 (development). */
function ProbeCell({ probe }: { probe?: Probe }) {
  if (!probe) return <Text color="color.text.subtle">—</Text>;
  const ok = probe.status >= 200 && probe.status < 300;
  const cell = (
    <Inline as="span" space="space.100" alignBlock="center">
      <Pill tone={ok ? 'success' : 'danger'}>{probe.status < 0 ? 'Error' : probe.status}</Pill>
      {probe.count !== undefined ? <Text color="color.text.subtle">{probe.count}</Text> : null}
    </Inline>
  );
  return probe.error ? (
    <Tooltip content={probe.error}>
      {(tooltipProps) => <span {...tooltipProps}>{cell}</span>}
    </Tooltip>
  ) : (
    cell
  );
}

const head = {
  cells: [
    { key: 'endpoint', content: 'Endpoint' },
    { key: 'user', content: 'asUser', width: 18 },
    { key: 'app', content: 'asApp', width: 18 },
  ],
};

export function SpikePanel() {
  const toast = useToast();
  const [result, setResult] = useState<SpikeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await call<SpikeResult>('runSpike');
      setResult(r);
      toast.success(
        'Probes finished',
        r.impersonationQueued ? 'Offline impersonation probe queued; see forge logs.' : undefined,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const rows = (result?.asUser ?? []).map((probe, i) => ({
    key: `${i}-${probe.name}`,
    cells: [
      { key: 'endpoint', content: <Code>{probe.name}</Code> },
      { key: 'user', content: <ProbeCell probe={probe} /> },
      { key: 'app', content: <ProbeCell probe={result?.asApp[i]} /> },
    ],
  }));
  return (
    <Stack space="space.200">
      <SectionHeader
        title={t('spikePanel.developerSpike')}
        description={t('spikePanel.whichJiraReadEndpointsWorkFor')}
        action={
          <Button appearance="primary" isLoading={busy} onClick={run}>
            {t('spikePanel.runProbes')}
          </Button>
        }
      />
      <SectionMessage appearance="discovery">
        <Text as="p">
          Visible because <Code>{t('spikePanel.accessradarSpike1')}</Code>. Results contain status
          codes and counts only, no user data.
        </Text>
      </SectionMessage>
      {error ? (
        <ErrorState title={t('spikePanel.probesFailed')} message={error} retry={() => void run()} />
      ) : null}
      {result ? (
        <DynamicTable label={t('spikePanel.probeResults')} head={head} rows={rows} />
      ) : null}
    </Stack>
  );
}
