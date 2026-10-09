import { useState } from 'react';
import Button from '@atlaskit/button/new';
import DynamicTable from '@atlaskit/dynamic-table';
import Lozenge from '@atlaskit/lozenge';
import SectionMessage from '@atlaskit/section-message';
import { call, errorText, type Probe, type SpikeResult } from '../api';
import { useToast } from '../Toast';
import { SectionHeader } from '../ui';

/** Shown only when the backend reports ACCESSRADAR_SPIKE=1 (development). */
function Code({ probe }: { probe?: Probe }) {
  if (!probe) return <span className="subtle">—</span>;
  const ok = probe.status >= 200 && probe.status < 300;
  return (
    <span className="status-row" title={probe.error}>
      <Lozenge appearance={ok ? 'success' : 'removed'}>
        {probe.status < 0 ? 'Error' : probe.status}
      </Lozenge>
      {probe.count !== undefined ? <span className="subtle">{probe.count}</span> : null}
    </span>
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
      { key: 'endpoint', content: <code>{probe.name}</code> },
      { key: 'user', content: <Code probe={probe} /> },
      { key: 'app', content: <Code probe={result?.asApp[i]} /> },
    ],
  }));
  return (
    <div className="section-stack">
      <SectionHeader
        title="Developer spike"
        description="Which Jira read endpoints work for each call identity. Development only."
        action={
          <Button appearance="primary" isLoading={busy} onClick={run}>
            Run probes
          </Button>
        }
      />
      <SectionMessage appearance="discovery">
        <p>
          Visible because <code>ACCESSRADAR_SPIKE=1</code>. Results contain status codes and counts
          only, no user data.
        </p>
      </SectionMessage>
      {error ? (
        <SectionMessage appearance="error" title="Probes failed">
          <div className="section-stack">
            <p>{error}</p>
            <Button onClick={run}>Try again</Button>
          </div>
        </SectionMessage>
      ) : null}
      {result ? <DynamicTable label="Probe results" head={head} rows={rows} /> : null}
    </div>
  );
}
