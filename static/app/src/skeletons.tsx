import type { ReactNode } from 'react';
import { Box, Grid, Inline, Stack, xcss } from '@atlaskit/primitives';
import Skeleton from '@atlaskit/skeleton';
import { token } from '@atlaskit/tokens';
import {
  BrandHeader,
  Details,
  FilterBar,
  MetricGrid,
  MetricTile,
  PageFrame,
  PageHeader,
  SplitLayout,
} from './ui';

/*
 * First-load skeletons (Radrly layout standard, chapter 10). A skeleton renders the real frame
 * (PageFrame, PageHeader with the real title, real section titles and table headers) and only
 * swaps the data for ADS Skeleton blocks, so nothing moves when the data arrives. Never a
 * full-page spinner.
 */

const RADIUS = { small: token('radius.small'), full: token('radius.full') } as const;

/** One placeholder block: ADS Skeleton (token colour and shimmer), hidden from screen readers. */
export function Phantom({
  width = '100%',
  height = 12,
  radius = 'small',
}: {
  width?: number | string;
  height?: number;
  radius?: keyof typeof RADIUS;
}) {
  return (
    <Box aria-hidden="true">
      <Skeleton width={width} height={height} borderRadius={RADIUS[radius]} isShimmering />
    </Box>
  );
}

/** Root of every skeleton: announced once as loading; the blocks inside are aria-hidden. */
export function SkeletonRoot({ children }: { children: ReactNode }) {
  return (
    <Box aria-busy="true" aria-label="Loading">
      <Stack space="space.300">{children}</Stack>
    </Box>
  );
}

/** Text lines of a paragraph or list. */
export function LinesPhantom({ lines = 3 }: { lines?: number }) {
  return (
    <Stack space="space.100">
      {Array.from({ length: lines }, (_, i) => (
        <Phantom key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </Stack>
  );
}

/** KPI tiles: the same ADS Box as Metric, with label, value and hint blocks. */
export function MetricGridPhantom({
  count = 4,
  hints = true,
}: {
  count?: number;
  hints?: boolean;
}) {
  return (
    <MetricGrid>
      {Array.from({ length: count }, (_, i) => (
        <MetricTile key={i}>
          <Stack space="space.100">
            <Phantom width="50%" />
            <Phantom width={48} height={24} />
            {hints ? <Phantom width="70%" height={10} /> : null}
          </Stack>
        </MetricTile>
      ))}
    </MetricGrid>
  );
}

const controlStyles = xcss({ width: '15rem', maxWidth: '100%' });

/** Filter bar with placeholder controls (ADS Select / Textfield height). */
export function FilterBarPhantom({ controls = 2 }: { controls?: number }) {
  return (
    <FilterBar>
      {Array.from({ length: controls }, (_, i) => (
        <Box key={i} xcss={controlStyles}>
          <Phantom height={32} />
        </Box>
      ))}
    </FilterBar>
  );
}

/** Definition list with the real terms and placeholder values. */
export function DetailsPhantom({ terms }: { terms: string[] }) {
  return <Details rows={terms.map((term, i) => [term, <Phantom key={i} width="60%" />])} />;
}

/** Heading-sized placeholder (dynamic section titles such as "Snapshot #12"). */
export function HeadingPhantom({ description = true }: { description?: boolean }) {
  return (
    <Stack space="space.100">
      <Phantom width={180} height={24} />
      {description ? <Phantom width={280} /> : null}
    </Stack>
  );
}

const growStyles = xcss({ flexGrow: 1 });
const appHeaderStyles = xcss({ paddingBlock: 'space.300' });

/** Drawer level loading: header and footer stay real, only the body is a skeleton (R-10.7). */
export function DrawerPhantom() {
  return (
    <SkeletonRoot>
      <Inline space="space.150" alignBlock="center">
        <Phantom width={32} height={32} radius="full" />
        <Box xcss={growStyles}>
          <Phantom width="40%" />
        </Box>
      </Inline>
      <LinesPhantom lines={4} />
      <LinesPhantom lines={3} />
    </SkeletonRoot>
  );
}

const sidebarPhantomStyles = xcss({ paddingInline: 'space.100' });

/** Admin navigation placeholder: real brand header, item-shaped blocks (no chunk download). */
function SidebarPhantom() {
  return (
    <Stack space="space.200">
      <BrandHeader subtitle="Jira access reviews" />
      <Box xcss={sidebarPhantomStyles}>
        <Stack space="space.300">
          {[1, 3, 6, 2].map((items, g) => (
            <Stack key={g} space="space.150">
              <Phantom width="40%" height={10} />
              {Array.from({ length: items }, (_, i) => (
                <Phantom key={i} width={`${60 + ((i * 13) % 30)}%`} height={16} />
              ))}
            </Stack>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

/** Generic page content: a section header, KPI tiles and a table-shaped block. */
function ContentPhantom() {
  return (
    <SkeletonRoot>
      <HeadingPhantom />
      <MetricGridPhantom />
      <Grid gap="space.150">
        {Array.from({ length: 6 }, (_, i) => (
          <Phantom key={i} width={i % 2 ? '100%' : '92%'} height={16} />
        ))}
      </Grid>
    </SkeletonRoot>
  );
}

/**
 * Full-screen-shaped first load before the Forge context is known (which module rendered the
 * iframe): the page frame with a placeholder title. Replaces the old full-page spinner.
 */
export function AppPhantom() {
  return (
    <PageFrame
      header={
        <header className="page-header">
          <Box xcss={appHeaderStyles} aria-hidden="true">
            <Stack space="space.150">
              <Phantom width={220} height={28} />
              <Phantom width={360} />
            </Stack>
          </Box>
        </header>
      }
    >
      <ContentPhantom />
    </PageFrame>
  );
}

/** Admin page while its screen chunk loads: the real split layout, title and description. */
export function AdminPhantom({ title, description }: { title: string; description: string }) {
  return (
    <SplitLayout sidebar={<SidebarPhantom />}>
      <PageFrame header={<PageHeader title={title} description={description} />}>
        <ContentPhantom />
      </PageFrame>
    </SplitLayout>
  );
}

/** Page (Get started, space review) while its screen chunk loads. */
export function PagePhantom({ title, description }: { title: string; description?: string }) {
  return (
    <PageFrame header={<PageHeader title={title} description={description} />}>
      <ContentPhantom />
    </PageFrame>
  );
}
