import type { ReactNode } from 'react';
import Avatar from '@atlaskit/avatar';
import Button, { IconButton } from '@atlaskit/button/new';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';
import { Code } from '@atlaskit/code';
import { IconTile } from '@atlaskit/icon';
import DownloadIcon from '@atlaskit/icon/core/download';
import GlobeIcon from '@atlaskit/icon/core/globe';
import PeopleGroupIcon from '@atlaskit/icon/core/people-group';
import QuestionCircleIcon from '@atlaskit/icon/core/question-circle';
import SearchIcon from '@atlaskit/icon/core/search';
import ShowMoreIcon from '@atlaskit/icon/core/show-more-horizontal';
import DocumentIcon from '@atlaskit/icon-file-type/glyph/document/16';
import PdfDocumentIcon from '@atlaskit/icon-file-type/glyph/pdf-document/16';
import SpreadsheetIcon from '@atlaskit/icon-file-type/glyph/spreadsheet/16';
import { Box, Inline, Stack, Text, xcss } from '@atlaskit/primitives';
import SectionMessage from '@atlaskit/section-message';
import Textfield from '@atlaskit/textfield';
import Tooltip from '@atlaskit/tooltip';
import type { Coverage, Limitations, Reason, Snapshot, SubjectView } from './api';
import { formatLocal, permissionLabel } from './format';
import {
  DividedList,
  DividedListItem,
  FilterControl,
  FilterSelect,
  LinkButton,
  PathList,
  Pill,
  SectionHeader,
  Subtle,
} from './ui';

const personNameStyles = xcss({ minWidth: '0' });
const searchIconStyles = xcss({ display: 'flex', paddingInline: 'space.100' });
const sectionStyles = xcss({
  paddingBlockStart: 'space.300',
  borderBlockStartWidth: 'border.width',
  borderBlockStartStyle: 'solid',
  borderBlockStartColor: 'color.border',
  // The page/drawer header already draws a separator; the first section must not stack a second one.
  ':first-child': { paddingBlockStart: 'space.0', borderBlockStartStyle: 'none' },
});
const hashStyles = xcss({ wordBreak: 'break-all' });

export function SubjectCell({
  subject,
  compact = false,
  onSelect,
}: {
  subject: SubjectView;
  compact?: boolean;
  /** Makes the name an ADS link button (e.g. open the person or group). */
  onSelect?: () => void;
}) {
  const app = subject.type === 'user' && subject.accountType !== 'atlassian';
  return (
    <Inline as="span" space="space.100" alignBlock="center">
      {subject.type === 'user' ? (
        <Avatar size="small" name={subject.name} />
      ) : (
        <IconTile
          icon={
            subject.type === 'group'
              ? PeopleGroupIcon
              : subject.type === 'anonymous'
                ? GlobeIcon
                : QuestionCircleIcon
          }
          label=""
          size="small"
          appearance={
            subject.type === 'group' ? 'gray' : subject.type === 'anonymous' ? 'red' : 'purple'
          }
        />
      )}
      <Box as="span" xcss={personNameStyles}>
        <Inline as="span" space="space.075" alignBlock="center" shouldWrap>
          {onSelect ? (
            <LinkButton onClick={onSelect}>{subject.name}</LinkButton>
          ) : (
            <Text>{subject.name}</Text>
          )}
          {subject.type === 'user' && subject.active === false ? (
            <Pill tone="danger">Inactive</Pill>
          ) : null}
          {app ? <Pill>App</Pill> : null}
          {subject.type === 'anonymous' ? <Pill tone="danger">Anonymous</Pill> : null}
          {subject.type === 'group' ? <Pill tone="warning">Members unknown</Pill> : null}
          {subject.type === 'conditional' ? (
            <Pill tone="discovery">Work item-dependent</Pill>
          ) : null}
        </Inline>
        {!compact && subject.type === 'group' ? (
          <Text as="p" size="small" color="color.text.subtle">
            Group members could not be read
          </Text>
        ) : null}
      </Box>
    </Inline>
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
    <Inline as="span" space="space.050" shouldWrap>
      {[...seen.values()].map((via) => (
        <Pill key={`${via.kind}:${via.label}`} tone={VIA_TONE[via.kind] ?? 'neutral'}>
          {via.label}
        </Pill>
      ))}
    </Inline>
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
    <DividedList>
      {keys.map((perm) => (
        <DividedListItem key={perm} loose>
          <Inline space="space.075" alignBlock="center" shouldWrap>
            <Text weight="bold">{permissionLabel(perm)}</Text>
            {keyPermissions?.includes(perm) ? <Pill tone="info">Key</Pill> : null}
          </Inline>
          <PathList paths={perms[perm].map((r) => (typeof r === 'string' ? r : r.text))} />
        </DividedListItem>
      ))}
    </DividedList>
  );
}

const SNAPSHOT_STATUS: Record<
  Snapshot['status'],
  [string, 'success' | 'warning' | 'info' | 'neutral' | 'danger']
> = {
  complete: ['Complete', 'success'],
  partial: ['Partial', 'warning'],
  running: ['Running', 'info'],
  queued: ['Queued', 'neutral'],
  failed: ['Failed', 'danger'],
};

export function SnapshotLozenge({ status }: { status: Snapshot['status'] }) {
  const [label, tone] = SNAPSHOT_STATUS[status] ?? [status, 'neutral'];
  return <Pill tone={tone}>{label}</Pill>;
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
  size = 'wide',
  inputId,
}: {
  snapshots: Snapshot[];
  value: number | null;
  onChange: (seq: number | null) => void;
  label?: string;
  allowLatest?: boolean;
  size?: 'medium' | 'wide' | 'fill';
  inputId?: string;
}) {
  const committed = snapshots.filter((s) => s.status === 'complete' || s.status === 'partial');
  const options: Option[] = [
    ...(allowLatest ? [{ label: 'Latest snapshot', value: 0 }] : []),
    ...committed.map((s) => ({ label: snapshotLabel(s), value: s.seq })),
  ];
  const selected = options.find((o) => o.value === (value ?? 0)) ?? null;
  return (
    <FilterSelect<Option>
      label={label}
      inputId={inputId ?? `snapshot-${label}`}
      options={options}
      value={selected}
      onChange={(o) => onChange(o && o.value ? o.value : null)}
      placeholder={allowLatest ? undefined : 'Previous snapshot'}
      size={size}
    />
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
    <FilterControl>
      <Textfield
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        isCompact
        elemBeforeInput={
          <Box xcss={searchIconStyles}>
            <SearchIcon label="" size="small" color="currentColor" />
          </Box>
        }
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
      />
    </FilterControl>
  );
}

export function ExportMenu({
  onCsv,
  onPdf,
  onMarkdown,
  isDisabled,
  label = 'Export',
}: {
  onCsv: () => void;
  onPdf?: () => void;
  onMarkdown?: () => void;
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
        <DropdownItem
          elemBefore={<SpreadsheetIcon label="" />}
          description="Spreadsheet, UTF-8"
          onClick={onCsv}
        >
          CSV
        </DropdownItem>
        {onPdf ? (
          <DropdownItem
            elemBefore={<PdfDocumentIcon label="" />}
            description="Evidence pack for auditors"
            onClick={onPdf}
          >
            PDF
          </DropdownItem>
        ) : null}
        {onMarkdown ? (
          <DropdownItem
            elemBefore={<DocumentIcon label="" />}
            description="Markdown table for docs and chat"
            onClick={onMarkdown}
          >
            Markdown
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
  if (!coverage.length) return <Subtle block>Everything AccessRadar reads was readable.</Subtle>;
  return (
    <DividedList>
      {coverage.map((c, i) => (
        <DividedListItem key={`${c.area}-${c.target}-${i}`}>
          <Pill tone={COVERAGE_TONE[c.status] ?? 'neutral'}>{c.status}</Pill>
          <Text>
            <Text weight="bold">{c.area.replace(/-/g, ' ')}</Text>
            {c.target !== 'all' ? ` · ${c.target}` : ''}
            <Text color="color.text.subtle"> — {c.reason}</Text>
          </Text>
        </DividedListItem>
      ))}
    </DividedList>
  );
}

/** Coverage gaps plus fixed method limitations (single source from the resolver). */
export function CoverageLimitations({
  coverage,
  limitations,
}: {
  coverage: Coverage[];
  limitations?: Limitations | null;
}) {
  if (!limitations && !coverage.length) return null;
  const partial = limitations?.completeness === 'partial' || limitations?.completeness === 'failed';
  return (
    <SectionMessage appearance={partial ? 'warning' : 'information'} title="Coverage & limitations">
      <Stack space="space.200">
        {limitations ? (
          <Text as="p">
            Completeness: <Text weight="bold">{limitations.label}</Text> (limitations v
            {limitations.version})
          </Text>
        ) : null}
        <CoverageList coverage={coverage} />
        {limitations?.statements?.length ? (
          <DividedList>
            {limitations.statements.map((s) => (
              <DividedListItem key={s}>
                <Text>{s}</Text>
              </DividedListItem>
            ))}
          </DividedList>
        ) : null}
      </Stack>
    </SectionMessage>
  );
}

export function Hash({ value }: { value: string | null | undefined }) {
  if (!value) return <Subtle>—</Subtle>;
  return (
    <Tooltip content={value}>
      <Box as="span" xcss={hashStyles}>
        <Code>{value}</Code>
      </Box>
    </Tooltip>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  /** Omit only when the content brings its own header. */
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box as="section" xcss={sectionStyles}>
      <Stack space="space.200">
        {title ? <SectionHeader title={title} description={description} action={action} /> : null}
        {children}
      </Stack>
    </Box>
  );
}

/** Kebab menu for row actions in tables (`DropdownItem`s go inside). */
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu
      placement="bottom-end"
      trigger={({ triggerRef, ...props }) => (
        <IconButton
          {...props}
          ref={triggerRef}
          icon={ShowMoreIcon}
          label={label}
          appearance="subtle"
        />
      )}
    >
      <DropdownItemGroup>{children}</DropdownItemGroup>
    </DropdownMenu>
  );
}
