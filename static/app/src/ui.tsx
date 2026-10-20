import { useId, type ReactNode } from 'react';
import LinkStyleButton from '@atlaskit/button/standard-button';
import EmptyState from '@atlaskit/empty-state';
import { HelperMessage, Label } from '@atlaskit/form';
import Heading from '@atlaskit/heading';
import LockIcon from '@atlaskit/icon/core/lock-locked';
import Lozenge from '@atlaskit/lozenge';
import AtlaskitPageHeader from '@atlaskit/page-header';
import { Box, Grid, Inline, Stack, Text, xcss } from '@atlaskit/primitives';
import SectionMessage, { SectionMessageAction } from '@atlaskit/section-message';
import Select from '@atlaskit/select';
import Skeleton from '@atlaskit/skeleton';
import Spinner from '@atlaskit/spinner';
import Toggle from '@atlaskit/toggle';
import { DatePicker } from '@atlaskit/datetime-picker';
import { token } from '@atlaskit/tokens';
import { DATE_PICKER_FORMAT, parseDateInput } from './format';
import { t } from './i18n';

export { BrandHeader, BrandMark } from './brand';

// Every widget here is an Atlassian Design System component or primitive (Box, Stack, Inline,
// Grid, Text) styled with ADS tokens. styles.css only holds layout glue for the Forge iframe
// (pinned header, scroll areas, the ≤768px single-scroll layout).

/**
 * App shell. Wide screens: fixed-width sidebar + content pane. Narrow screens (≤768px, CSS):
 * the sidebar is replaced by `mobileNav` at the top and the whole page scrolls as one.
 */
export function SplitLayout({
  sidebar,
  mobileNav,
  children,
}: {
  sidebar: ReactNode;
  mobileNav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="split-layout">
      <aside className="split-sidebar">{sidebar}</aside>
      {mobileNav ? (
        <nav className="split-mobile-nav" aria-label="AccessRadar">
          <Stack space="space.100">{mobileNav}</Stack>
        </nav>
      ) : null}
      <div className="split-main">{children}</div>
    </div>
  );
}

/**
 * Header stays pinned at the top; only the content below it scrolls.
 * `fixed` is for pages with tabs: the page does not scroll, the content owns its scroll areas
 * (see PageTabs) so the tab bar stays pinned.
 */
export function PageFrame({
  header,
  children,
  fixed = false,
}: {
  header: ReactNode;
  children: ReactNode;
  fixed?: boolean;
}) {
  return (
    <div className="page-frame">
      {header}
      <main className={fixed ? 'page-fixed' : 'page-scroll'}>{children}</main>
    </div>
  );
}

/** Scrolling area for one tab panel. Always wrap panel content in this (ADS TabPanel is a flex row). */
export function PageScroll({ children }: { children: ReactNode }) {
  return (
    <div className="page-scroll">
      <Stack space="space.300">{children}</Stack>
    </div>
  );
}

/**
 * Page with tabs (use inside `PageFrame fixed` with `PageHeader flush`):
 * `<PageTabs><Tabs><PageTabBar><TabList>…</TabList></PageTabBar><TabPanel><PageScroll>…</PageScroll></TabPanel></Tabs></PageTabs>`.
 */
export function PageTabs({ children }: { children: ReactNode }) {
  return <div className="page-tabs">{children}</div>;
}

/** Pinned tab bar. It replaces the header separator and fades the content out underneath. */
export function PageTabBar({ children }: { children: ReactNode }) {
  return <div className="page-tabs-bar">{children}</div>;
}

/** Content pinned between the page header and the tab bar (pickers, a summary line). */
export function PagePinned({ children }: { children: ReactNode }) {
  return (
    <div className="page-pinned">
      <Stack space="space.150">{children}</Stack>
    </div>
  );
}

/**
 * ADS PageHeader. Put the primary action FIRST in `actions`: ADS PageHeader always places its
 * actions slot at the end of the title row (right-aligned on wide screens), so "primary first"
 * is the reading order inside that group. Description and status sit under the title.
 */
export function PageHeader({
  title,
  description,
  status,
  actions,
  flush = false,
}: {
  title: string;
  description?: string;
  status?: ReactNode;
  actions?: ReactNode;
  /** Pages with tabs: the tab bar replaces the separator under the header. */
  flush?: boolean;
}) {
  return (
    <header className={flush ? 'page-header is-flush' : 'page-header'}>
      <AtlaskitPageHeader
        actions={
          actions ? (
            <Inline space="space.100" alignBlock="center" shouldWrap>
              {actions}
            </Inline>
          ) : undefined
        }
        bottomBar={
          description || status ? (
            <Inline space="space.100" alignBlock="center" shouldWrap>
              {status}
              {description ? <Text color="color.text.subtle">{description}</Text> : null}
            </Inline>
          ) : undefined
        }
      >
        {title}
      </AtlaskitPageHeader>
    </header>
  );
}

const sectionHeaderStyles = xcss({ minWidth: '0' });

export function SectionHeader({
  title,
  description,
  status,
  action,
  as = 'h2',
}: {
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  as?: 'h2' | 'h3';
}) {
  return (
    <Inline space="space.200" alignBlock="center" spread="space-between" shouldWrap>
      <Box xcss={sectionHeaderStyles}>
        <Stack space="space.050">
          <Inline space="space.100" alignBlock="center" shouldWrap>
            <Heading size="medium" as={as}>
              {title}
            </Heading>
            {status}
          </Inline>
          {description ? (
            <Text as="p" color="color.text.subtle">
              {description}
            </Text>
          ) : null}
        </Stack>
      </Box>
      {action}
    </Inline>
  );
}

/** KPI tiles: equal height, as many per row as fit (ADS Grid). */
export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <Grid gap="space.150" templateColumns="repeat(auto-fit, minmax(10rem, 1fr))">
      {children}
    </Grid>
  );
}

const metricStyles = xcss({
  minWidth: '0',
  padding: 'space.150',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderColor: 'color.border',
  borderRadius: 'radius.large',
  backgroundColor: 'elevation.surface.raised',
  overflowWrap: 'anywhere',
});

/** One KPI tile: ADS Box on the raised surface with label, value (Heading) and hint. */
export function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Box xcss={metricStyles}>
      <Stack space="space.050">
        <Text size="small" color="color.text.subtle">
          {label}
        </Text>
        <Heading size="medium" as="span">
          {value}
        </Heading>
        {hint ? (
          <Text size="small" color="color.text.subtlest">
            {hint}
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}

const loadingStyles = xcss({
  display: 'grid',
  placeItems: 'center',
  minHeight: '15rem',
});
const compactLoadingStyles = xcss({ minHeight: '10rem' });

export function Loading({ compact = false }: { compact?: boolean }) {
  return (
    <Box xcss={[loadingStyles, compact && compactLoadingStyles]}>
      <Spinner size="large" label="Loading" />
    </Box>
  );
}

/** Table-shaped loading placeholder (ADS Skeleton rows) for list pages whose data takes a few seconds. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Box role="status" aria-live="polite" aria-label="Loading">
      <Stack space="space.150">
        <Skeleton
          width="100%"
          height={token('space.300')}
          borderRadius={token('radius.small')}
          isShimmering
        />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton
            key={i}
            width={i % 2 ? '100%' : '92%'}
            height={token('space.200')}
            borderRadius={token('radius.small')}
            isShimmering
          />
        ))}
      </Stack>
    </Box>
  );
}

/**
 * The one date input: ADS DatePicker showing the app's date format ("27 Oct 2026") while the
 * value stays an ISO date (YYYY-MM-DD). Typed input accepts "27 Oct 2026", "27/10/2026" or ISO.
 */
export function DateField({
  id,
  value,
  onChange,
  placeholder = 'e.g. 27 Oct 2026',
}: {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
}) {
  return (
    <DatePicker
      id={id}
      value={value}
      onChange={onChange}
      locale="en-GB"
      dateFormat={DATE_PICKER_FORMAT}
      placeholder={placeholder}
      parseInputValue={(text) => parseDateInput(text) ?? new Date(NaN)}
    />
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
    <SectionMessage
      appearance="error"
      title={title}
      actions={<SectionMessageAction onClick={retry}>Try again</SectionMessageAction>}
    >
      <Text as="p">{message}</Text>
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
    <EmptyState header={title} headingLevel={2} description={description} primaryAction={action} />
  );
}

const PILL_APPEARANCE = {
  neutral: 'default',
  info: 'inprogress',
  success: 'success',
  warning: 'moved',
  danger: 'removed',
  discovery: 'discovery',
} as const;

const pillSlotStyles = xcss({ display: 'inline-flex', flexShrink: 0 });

/** Small status badge. Always an Atlaskit Lozenge; tone maps onto its appearance. */
export function Pill({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof PILL_APPEARANCE;
  children: ReactNode;
}) {
  return (
    <Box as="span" xcss={pillSlotStyles}>
      <Lozenge appearance={PILL_APPEARANCE[tone]}>{children}</Lozenge>
    </Box>
  );
}

/**
 * Inline text link that acts on the page (navigate, open a drawer). The new ADS Button has no
 * link appearance, so this uses the standard Button's `link` appearance.
 */
export function LinkButton({
  onClick,
  isDisabled = false,
  children,
}: {
  onClick: () => void;
  isDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <LinkStyleButton appearance="link" spacing="none" isDisabled={isDisabled} onClick={onClick}>
      {children}
    </LinkStyleButton>
  );
}

/** Secondary text (descriptions, hints, empty cells): ADS Text in the subtle colour. */
export function Subtle({
  children,
  block = false,
  size,
}: {
  children: ReactNode;
  /** Render as a paragraph (own line) instead of inline text. */
  block?: boolean;
  size?: 'small' | 'medium';
}) {
  return (
    <Text as={block ? 'p' : 'span'} color="color.text.subtle" size={size}>
      {children}
    </Text>
  );
}

const noWrapStyles = xcss({ whiteSpace: 'nowrap' });
const wrapAnywhereStyles = xcss({ overflowWrap: 'anywhere' });

/** Keeps dates and short identifiers on one line inside table cells. */
export function NoWrap({ children }: { children: ReactNode }) {
  return (
    <Box as="span" xcss={noWrapStyles}>
      {children}
    </Box>
  );
}

/** Lets long paths and hashes break anywhere instead of widening a table column. */
export function WrapAnywhere({ children }: { children: ReactNode }) {
  return (
    <Box as="span" xcss={wrapAnywhereStyles}>
      {children}
    </Box>
  );
}

const listStyles = xcss({ listStyle: 'none', margin: 'space.0', padding: 'space.0' });
const listItemStyles = xcss({
  paddingBlock: 'space.075',
  borderBlockEndWidth: 'border.width',
  borderBlockEndStyle: 'solid',
  borderBlockEndColor: 'color.border',
  ':last-child': { borderBlockEndStyle: 'none' },
});
const looseListItemStyles = xcss({ paddingBlock: 'space.150' });

/** Unstyled list on dividers (ADS Stack + Box). */
export function DividedList({ children }: { children: ReactNode }) {
  return (
    <Stack as="ul" xcss={listStyles}>
      {children}
    </Stack>
  );
}

/** One row of a DividedList: an inline row, or `loose` (stacked, more padding) for rows with a heading and nested paths. */
export function DividedListItem({
  children,
  loose = false,
}: {
  children: ReactNode;
  loose?: boolean;
}) {
  return (
    <Box as="li" xcss={[listItemStyles, loose && looseListItemStyles]}>
      {loose ? (
        <Stack space="space.050">{children}</Stack>
      ) : (
        <Inline space="space.100" alignBlock="baseline" shouldWrap>
          {children}
        </Inline>
      )}
    </Box>
  );
}

/** Indented "↳ path" lines explaining how access is granted. */
export function PathList({ paths }: { paths: string[] }) {
  return (
    <Stack as="ul" xcss={listStyles} space="space.025">
      {paths.map((path, i) => (
        <Box as="li" key={i}>
          <Text color="color.text.subtlest">↳ </Text>
          <Text color="color.text.subtle">{path}</Text>
        </Box>
      ))}
    </Stack>
  );
}

/** Labelled form control: ADS Label above the control, optional ADS HelperMessage below. */
export function FormField({
  label,
  helper,
  children,
}: {
  label: ReactNode;
  helper?: ReactNode;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <Stack space="space.050">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {helper ? <HelperMessage>{helper}</HelperMessage> : null}
    </Stack>
  );
}

const toggleRowStyles = xcss({
  whiteSpace: 'nowrap',
  // ADS Toggle insets its track; pull it back so it lines up with the fields.
  marginInlineStart: 'space.negative.075',
});

/**
 * The one on/off setting control: ADS Toggle with the setting name as regular body text beside it
 * and optional helper text below. The accessible name comes from the Toggle's `label`. (ADS Text
 * cannot render a <label>, so clicking the text does not flip the switch.)
 */
export function ToggleField({
  label,
  isChecked,
  onChange,
  helper,
  isDisabled,
}: {
  label: string;
  isChecked: boolean;
  onChange: (value: boolean) => void;
  helper?: ReactNode;
  isDisabled?: boolean;
}) {
  const id = useId();
  return (
    <Stack>
      <Box xcss={toggleRowStyles}>
        <Inline space="space.100" alignBlock="center">
          <Toggle
            id={id}
            label={label}
            isChecked={isChecked}
            isDisabled={isDisabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <Text>{label}</Text>
        </Inline>
      </Box>
      {helper ? <HelperMessage>{helper}</HelperMessage> : null}
    </Stack>
  );
}

/** Group heading for a RadioGroup: ADS Text styled like a field label, which names the group. */
export function RadioField({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <Box role="group" aria-labelledby={id}>
      <Stack space="space.050">
        <Text id={id} as="span" size="small" weight="bold" color="color.text.subtle">
          {label}
        </Text>
        {children}
      </Stack>
    </Box>
  );
}

const detailsStyles = xcss({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)',
  rowGap: 'space.100',
  columnGap: 'space.150',
  margin: 'space.0',
  padding: 'space.0',
  maxWidth: '35rem',
});
const detailTermStyles = xcss({ margin: 'space.0' });
const detailValueStyles = xcss({ margin: 'space.0', overflowWrap: 'anywhere', minWidth: '0' });

/** Definition list (ADS Grid of term / value pairs, no nested cards). */
export function Details({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <Box as="dl" xcss={detailsStyles}>
      {rows.map(([term, value]) => (
        <DetailsRow key={term} term={term} value={value} />
      ))}
    </Box>
  );
}

function DetailsRow({ term, value }: { term: string; value: ReactNode }) {
  return (
    <>
      <Box as="dt" xcss={detailTermStyles}>
        <Text color="color.text.subtle">{term}</Text>
      </Box>
      <Box as="dd" xcss={detailValueStyles}>
        {value}
      </Box>
    </>
  );
}

/** Toolbar row above tables: search, filters, actions. Wraps on narrow screens. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Inline space="space.150" alignBlock="center" shouldWrap>
      {children}
    </Inline>
  );
}

type FilterSize = 'narrow' | 'medium' | 'wide' | 'fill';
const FILTER_SIZE_CLASS: Record<FilterSize, string> = {
  narrow: 'filter-control is-narrow',
  medium: 'filter-control',
  wide: 'filter-control is-wide',
  fill: 'filter-control is-fill',
};

/** Width slot for a filter-bar control (layout glue: fixed widths, flexible below 768px). */
export function FilterControl({
  size = 'medium',
  children,
}: {
  size?: FilterSize;
  children: ReactNode;
}) {
  return <div className={FILTER_SIZE_CLASS[size]}>{children}</div>;
}

/**
 * The one Select for filter bars: compact, labelled for screen readers, and its menu is fixed so it
 * is never clipped by the scrolling page. `value: null` shows the placeholder.
 */
export function FilterSelect<T extends { label: string; value: string | number }>({
  label,
  options,
  value,
  onChange,
  size = 'medium',
  placeholder,
  isSearchable = false,
  inputId,
}: {
  label: string;
  options: T[];
  value: T | null | undefined;
  onChange: (option: T | null) => void;
  size?: FilterSize;
  placeholder?: string;
  isSearchable?: boolean;
  inputId?: string;
}) {
  return (
    <FilterControl size={size}>
      <Select<T>
        inputId={inputId}
        aria-label={label}
        options={options}
        value={value ?? null}
        onChange={(option) => onChange((option as T | null) ?? null)}
        placeholder={placeholder ?? label}
        spacing="compact"
        isSearchable={isSearchable}
        menuPosition="fixed"
      />
    </FilterControl>
  );
}

/** Discovery-colored lozenge marking a feature that needs the Advanced plan. */
export function AdvancedBadge() {
  return <Pill tone="discovery">{t('planGate.badge')}</Pill>;
}

const planNoteStyles = xcss({
  paddingBlock: 'space.100',
  paddingInline: 'space.150',
  borderWidth: 'border.width',
  borderStyle: 'dashed',
  borderColor: 'color.border',
  borderRadius: 'radius.large',
});

/**
 * One quiet line for a locked feature: lock icon, Advanced badge, the benefit and the admin hint.
 * Use alone when there is nothing meaningful to preview.
 */
export function PlanNote({ benefit }: { benefit: string }) {
  return (
    <Box xcss={planNoteStyles} role="note">
      <Inline space="space.100" alignBlock="center" shouldWrap>
        <LockIcon label="" size="small" color="currentColor" />
        <AdvancedBadge />
        <Text color="color.text.subtle">
          {benefit} {t('planGate.advancedHint')}
        </Text>
      </Inline>
    </Box>
  );
}

const planSampleStyles = xcss({ position: 'relative' });
const planCaptionStyles = xcss({
  position: 'absolute',
  insetBlockStart: 'space.0',
  insetInlineEnd: 'space.0',
});

/**
 * Locked panel with a section header: a faded, non-interactive sample of the real panel (made-up
 * data) above a PlanNote. Unlocked it renders its children untouched; without children it renders
 * only the PlanNote.
 */
export function PlanGate({
  locked,
  benefit,
  children,
}: {
  locked: boolean;
  benefit: string;
  children?: ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <Stack space="space.100">
      {children ? (
        <Box xcss={planSampleStyles}>
          {/* Layout glue (styles.css): fixed-height, faded, non-interactive preview. */}
          <div className="plan-gate-preview" aria-hidden="true">
            {children}
          </div>
          <Box as="span" xcss={planCaptionStyles} aria-hidden="true">
            <Text size="small" color="color.text.subtlest">
              {t('planGate.sample')}
            </Text>
          </Box>
        </Box>
      ) : null}
      <PlanNote benefit={benefit} />
    </Stack>
  );
}
