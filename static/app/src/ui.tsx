import { useId, type ReactNode } from 'react';
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

/**
 * AccessRadar logo (brand/accessradar-logo.svg): white padlock on the brand gradient
 * #236BB4 → #6C70CD (65%) → #A96BCE. Brand colours appear only here; the rest of the UI uses ADS tokens.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  const bg = `ar-bg-${id}`;
  const shine = `ar-shine-${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1043 1043"
      fill="none"
      role="img"
      aria-label="AccessRadar"
    >
      <title>AccessRadar</title>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1043" y2="1043" gradientUnits="userSpaceOnUse">
          <stop stopColor="#236BB4" />
          <stop offset="0.65" stopColor="#6C70CD" />
          <stop offset="1" stopColor="#A96BCE" />
        </linearGradient>
        <linearGradient
          id={shine}
          x1="521.5"
          y1="616"
          x2="672.109"
          y2="357.876"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="white" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <rect width="1043" height="1043" rx="230" fill={`url(#${bg})`} />
      <path
        d="M330 443V348C330 242 415 164 521.5 164C628 164 713 242 713 348V443"
        strokeWidth="47"
        strokeLinecap="round"
        stroke="white"
      />
      <path d="M521.5 616V443H818V616H521.5Z" fill={`url(#${shine})`} />
      <path
        d="M292 443H751C788.003 443 818 472.997 818 510V806C818 843.003 788.003 873 751 873H292C254.997 873 225 843.003 225 806V510C225 472.997 254.997 443 292 443Z"
        strokeWidth="47"
        stroke="white"
      />
      <circle cx="521.5" cy="616" r="46.125" fill="white" />
      <path d="M521.5 648V725" strokeWidth="38" strokeLinecap="round" stroke="white" />
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
