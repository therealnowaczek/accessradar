import type { ReactNode } from 'react';
import Avatar from '@atlaskit/avatar';
import Button from '@atlaskit/button/new';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';
import DownloadIcon from '@atlaskit/icon/core/download';
import SearchIcon from '@atlaskit/icon/core/search';
import Lozenge from '@atlaskit/lozenge';
import Select from '@atlaskit/select';
import Textfield from '@atlaskit/textfield';
import type { Coverage, Reason, Snapshot, SubjectView } from './api';
import { formatLocal, permissionLabel } from './format';
import { Pill, SectionHeader } from './ui';

export function SubjectCell({
  subject,
  compact = false,
}: {
  subject: SubjectView;
  compact?: boolean;
}) {
  const app = subject.type === 'user' && subject.accountType !== 'atlassian';
  return (
    <span className="person-cell">
      {subject.type === 'user' ? (
        <Avatar size="small" name={subject.name} />
      ) : (
        <span className={`subject-glyph subject-${subject.type}`} aria-hidden="true">
          {subject.type === 'group' ? 'G' : subject.type === 'anonymous' ? '!' : '?'}
        </span>
      )}
      <span className="person-name">
        <span className="status-row tight">
          <span>{subject.name}</span>
          {subject.type === 'user' && subject.active === false ? (
            <Lozenge appearance="removed">Inactive</Lozenge>
          ) : null}
          {app ? <Pill>App</Pill> : null}
          {subject.type === 'anonymous' ? <Lozenge appearance="removed">Anonymous</Lozenge> : null}
          {subject.type === 'group' ? <Pill tone="warning">Members unknown</Pill> : null}
          {subject.type === 'conditional' ? <Pill tone="discovery">Issue-dependent</Pill> : null}
        </span>
        {!compact && subject.type === 'group' ? (
          <span className="subtle person-id">Group members could not be read</span>
        ) : null}
      </span>
    </span>
  );
}

const VIA_TONE: Record<string, 'info' | 'discovery' | 'neutral' | 'warning' | 'success'> = {
  role: 'info',
  group: 'discovery',
  app: 'warning',
  direct: 'neutral',
  lead: 'success',
  scheme: 'neutral',
};

/** Path chips: how the access is granted (role, group, application, named user, lead). */
export function ViaChips({ reasons }: { reasons: Reason[] }) {
  const seen = new Map<string, Reason['via']>();
  for (const r of reasons) seen.set(`${r.via.kind}:${r.via.label}`, r.via);
  return (
    <span className="chip-row">
      {[...seen.values()].map((via) => (
        <Pill key={`${via.kind}:${via.label}`} tone={VIA_TONE[via.kind] ?? 'neutral'}>
          {via.label}
        </Pill>
      ))}
    </span>
  );
}

/** The "why" for each permission: one line per path, innermost first. */
export function ReasonList({
  perms,
  keyPermissions,
}: {
  perms: Record<string, Reason[] | string[]>;
  keyPermissions?: string[];
}) {
  const keys = Object.keys(perms).sort((a, b) => {
    const ka = keyPermissions?.includes(a) ? 0 : 1;
    const kb = keyPermissions?.includes(b) ? 0 : 1;
    return ka - kb || permissionLabel(a).localeCompare(permissionLabel(b));
  });
  return (
    <ul className="reason-list">
      {keys.map((perm) => (
        <li key={perm}>
          <div className="status-row tight">
            <strong>{permissionLabel(perm)}</strong>
            {keyPermissions?.includes(perm) ? <Pill tone="info">Key</Pill> : null}
          </div>
          <ul className="reason-paths">
            {perms[perm].map((r, i) => {
              const text = typeof r === 'string' ? r : r.text;
              return (
                <li key={i} className="subtle">
                  {text}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function SnapshotLozenge({ status }: { status: Snapshot['status'] }) {
  const map: Record<string, [string, 'success' | 'moved' | 'inprogress' | 'removed' | 'default']> =
    {
      complete: ['Complete', 'success'],
      partial: ['Partial', 'moved'],
      running: ['Running', 'inprogress'],
      queued: ['Queued', 'default'],
      failed: ['Failed', 'removed'],
    };
  const [label, appearance] = map[status] ?? [status, 'default'];
  return <Lozenge appearance={appearance}>{label}</Lozenge>;
}

type Option = { label: string; value: number };

export function snapshotLabel(s: Pick<Snapshot, 'seq' | 'startedAt' | 'status'>) {
  return `#${s.seq} · ${formatLocal(s.startedAt)}${s.status === 'partial' ? ' · partial' : ''}`;
}

/** Picks one committed snapshot; null = latest. */
export function SnapshotPicker({
  snapshots,
  value,
  onChange,
  label = 'Snapshot',
  allowLatest = true,
  width = 280,
}: {
  snapshots: Snapshot[];
  value: number | null;
  onChange: (seq: number | null) => void;
  label?: string;
  allowLatest?: boolean;
  width?: number;
}) {
  const committed = snapshots.filter((s) => s.status === 'complete' || s.status === 'partial');
  const options: Option[] = [
    ...(allowLatest ? [{ label: 'Latest snapshot', value: 0 }] : []),
    ...committed.map((s) => ({ label: snapshotLabel(s), value: s.seq })),
  ];
  const selected = options.find((o) => o.value === (value ?? 0)) ?? null;
  return (
    <div style={{ width }}>
      <Select<Option>
        inputId={`snapshot-${label}`}
        aria-label={label}
        options={options}
        value={selected}
        onChange={(o) => onChange(o && o.value ? o.value : null)}
        spacing="compact"
        isSearchable={false}
      />
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="filter-control">
      <Textfield
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        isCompact
        elemBeforeInput={
          <span className="input-affix">
            <SearchIcon label="" size="small" />
          </span>
        }
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
      />
    </div>
  );
}

export function ExportMenu({
  onCsv,
  onPdf,
  isDisabled,
  label = 'Export',
}: {
  onCsv: () => void;
  onPdf?: () => void;
  isDisabled?: boolean;
  label?: string;
}) {
  return (
    <DropdownMenu
      placement="bottom-end"
      trigger={({ triggerRef, ...props }) => (
        <Button {...props} ref={triggerRef} iconBefore={DownloadIcon} isDisabled={isDisabled}>
          {label}
        </Button>
      )}
    >
      <DropdownItemGroup>
        <DropdownItem description="Spreadsheet, UTF-8" onClick={onCsv}>
          CSV
        </DropdownItem>
        {onPdf ? (
          <DropdownItem description="Evidence pack for auditors" onClick={onPdf}>
            PDF
          </DropdownItem>
        ) : null}
      </DropdownItemGroup>
    </DropdownMenu>
  );
}

const COVERAGE_TONE: Record<string, 'warning' | 'neutral' | 'info' | 'danger'> = {
  unreadable: 'danger',
  partial: 'warning',
  impersonated: 'info',
  carried: 'warning',
  info: 'neutral',
};

/** "What we could not see" – shown wherever data is used, never hidden. */
export function CoverageList({ coverage }: { coverage: Coverage[] }) {
  if (!coverage.length) return <p className="subtle">Everything AccessRadar reads was readable.</p>;
  return (
    <ul className="coverage-list">
      {coverage.map((c, i) => (
        <li key={`${c.area}-${c.target}-${i}`}>
          <Pill tone={COVERAGE_TONE[c.status] ?? 'neutral'}>{c.status}</Pill>
          <span>
            <strong>{c.area.replace(/-/g, ' ')}</strong>
            {c.target !== 'all' ? ` · ${c.target}` : ''}
            <span className="subtle"> — {c.reason}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Hash({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="subtle">—</span>;
  return (
    <code className="hash" title={value}>
      {value}
    </code>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section-stack form-section-top">
      <SectionHeader title={title} description={description} action={action} />
      {children}
    </section>
  );
}
