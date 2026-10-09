import type { ReactNode } from 'react';
import Button from '@atlaskit/button/new';
import EmptyState from '@atlaskit/empty-state';
import Heading from '@atlaskit/heading';
import SectionMessage from '@atlaskit/section-message';
import Spinner from '@atlaskit/spinner';

// Layout primitives mirror MarginRadar (static/app/src/ui.tsx): blank adminPage layout,
// sidebar + pinned page header + scrolling content, spacing on design tokens.

export function SplitLayout({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="split-layout">
      <aside className="split-sidebar">{sidebar}</aside>
      <div className="split-main">{children}</div>
    </div>
  );
}

/** AccessRadar mark: radar sweep on the brand colour. Colours come from design tokens (light/dark). */
export function BrandMark({ size = 32 }: { size?: number }) {
  const ink = { stroke: 'var(--ds-icon-inverse, #fff)' };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="AccessRadar"
    >
      <title>AccessRadar</title>
      <rect
        width="32"
        height="32"
        rx="8"
        style={{ fill: 'var(--ds-background-brand-bold, #0c66e4)' }}
      />
      <circle cx="16" cy="16" r="10" strokeWidth="1.5" style={{ ...ink, strokeOpacity: 0.45 }} />
      <circle cx="16" cy="16" r="5.5" strokeWidth="1.5" style={{ ...ink, strokeOpacity: 0.7 }} />
      <path d="M16 16 L23.5 9.5" strokeWidth="2.5" strokeLinecap="round" style={ink} />
      <circle cx="16" cy="16" r="2" style={{ fill: 'var(--ds-icon-inverse, #fff)' }} />
      <circle cx="21.5" cy="19.5" r="1.6" style={{ fill: 'var(--ds-icon-inverse, #fff)' }} />
    </svg>
  );
}

export function BrandHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="brand-header">
      <BrandMark />
      <div className="brand-header-text">
        <span className="brand-header-name">AccessRadar</span>
        <span className="brand-header-sub">{subtitle}</span>
      </div>
    </div>
  );
}

/** Header stays pinned at the top; only the content below it scrolls. */
export function PageFrame({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="page-frame">
      {header}
      <main className="page-scroll">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  status,
  actions,
}: {
  title: string;
  description?: string;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <div className="status-row">
          <Heading size="large" as="h1">
            {title}
          </Heading>
          {status}
        </div>
        {description ? <p className="subtle">{description}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <Heading size="medium" as="h2">
          {title}
        </Heading>
        {description ? <p className="subtle">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </div>
  );
}

export function Loading({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`loading ${compact ? 'compact-loading' : ''}`}>
      <Spinner size="large" label="Loading" />
    </div>
  );
}

export function ErrorState({
  title,
  message,
  retry,
}: {
  title: string;
  message: string;
  retry: () => void;
}) {
  return (
    <SectionMessage appearance="error" title={title}>
      <div className="section-stack">
        <p>{message}</p>
        <Button onClick={retry}>Try again</Button>
      </div>
    </SectionMessage>
  );
}

/** ADS empty state; always offers a next step. */
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="empty-state">
      <EmptyState
        header={title}
        headingLevel={2}
        description={description}
        primaryAction={action}
      />
    </div>
  );
}

/** Small rounded status badge (MarginRadar Pill). */
export function Pill({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'discovery';
  children: ReactNode;
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

/** Definition list on dividers (no nested cards). */
export function Details({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="details settings-form">
      {rows.map(([term, value]) => (
        <div className="details-row" key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Toolbar row above tables: search, filters, actions. Wraps on narrow screens. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="filter-bar">{children}</div>;
}
