import { invoke, view } from '@forge/bridge';
import { token } from '@atlaskit/tokens';
import { useEffect, useState, type CSSProperties } from 'react';

type Status = { engineVersion: string; spike: boolean };
type Probe = { name: string; status: number; count?: number; error?: string; data?: Record<string, unknown> };
type SpikeResult = { asUser: Probe[]; asApp: Probe[]; impersonationQueued: boolean };

const PAGES: Record<string, { title: string; body: string }> = {
  overview: { title: 'Overview', body: 'Last snapshot, completeness and risk tiles will appear here.' },
  'explore-projects': { title: 'Explore – Projects', body: 'Who has access to a project, and why.' },
  'explore-groups': { title: 'Explore – Groups', body: 'Where a group reaches across projects.' },
  'explore-people': { title: 'Explore – People', body: 'What a person can do, and through which path.' },
  changes: { title: 'Changes', body: 'Diff between two snapshots: access granted and revoked.' },
  reviews: { title: 'Reviews', body: 'Access reviews with sign-off and evidence export.' },
  snapshots: { title: 'Snapshots', body: 'Snapshot history, status and completeness.' },
  settings: { title: 'Settings', body: 'Schedule, key permissions, retention, Security & data.' },
  'get-started': { title: 'Get started', body: '1. What we collect  2. Schedule  3. Take the first snapshot.' },
};

const card: CSSProperties = {
  padding: token('space.200'),
  border: `1px solid ${token('color.border')}`,
  borderRadius: '6px',
  background: token('elevation.surface.raised'),
  color: token('color.text'),
};

/** invoke() may wrap the body with metadata; normalise to the body. */
async function call<T>(key: string): Promise<T> {
  const r = (await invoke<T>(key)) as unknown;
  if (r && typeof r === 'object' && 'body' in (r as object) && Object.keys(r as object).every((k) => k === 'body' || k === 'metadata')) {
    return (r as { body: T }).body;
  }
  return r as T;
}

function routeFrom(pathname: string, moduleKey?: string): string {
  if (moduleKey === 'accessradar-get-started') return 'get-started';
  const last = pathname.split('/').filter(Boolean).pop() ?? '';
  return PAGES[last] ? last : 'overview';
}

export function App() {
  const [route, setRoute] = useState('overview');
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spike, setSpike] = useState<SpikeResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      const ctx = await view.getContext();
      const history = await view.createHistory();
      setRoute(routeFrom(history.location.pathname, ctx.moduleKey));
      unlisten = history.listen((loc) => setRoute(routeFrom(loc.pathname, ctx.moduleKey)));
    })().catch((e) => setError(String(e)));
    call<Status>('getStatus').then(setStatus).catch((e) => setError(String(e?.message ?? e)));
    return () => unlisten?.();
  }, []);

  const page = PAGES[route];
  const runSpike = async () => {
    setBusy(true);
    try {
      setSpike(await call<SpikeResult>('runSpike'));
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ padding: token('space.300'), color: token('color.text'), font: token('font.body') }}>
      <h2 style={{ marginBottom: token('space.200') }}>{page.title}</h2>
      <div style={card}>
        <p>{page.body}</p>
        <p style={{ color: token('color.text.subtle') }}>Placeholder – AccessRadar week 1 skeleton.</p>
      </div>
      {error && (
        <p role="alert" style={{ color: token('color.text.danger'), marginTop: token('space.200') }}>
          {error}
        </p>
      )}
      {status && (
        <p style={{ color: token('color.text.subtlest'), marginTop: token('space.200') }}>Engine {status.engineVersion}</p>
      )}
      {status?.spike && route === 'settings' && (
        <section style={{ ...card, marginTop: token('space.200') }}>
          <h3>Developer spike: API access by identity</h3>
          <button type="button" onClick={runSpike} disabled={busy}>
            {busy ? 'Running…' : 'Run probes'}
          </button>
          {spike && (
            <table style={{ marginTop: token('space.200') }}>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>asUser</th>
                  <th>asApp</th>
                </tr>
              </thead>
              <tbody>
                {spike.asUser.map((p, i) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.status}{p.error ? ` – ${p.error}` : ''}</td>
                    <td>{spike.asApp[i]?.status}{spike.asApp[i]?.error ? ` – ${spike.asApp[i]?.error}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  );
}
