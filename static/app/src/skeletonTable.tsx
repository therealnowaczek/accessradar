import type { ReactNode } from 'react';
import VisuallyHidden from '@atlaskit/visually-hidden';
import { Phantom } from './skeletons';
import DynamicTable from './Table';

/** Hidden header for an action column (R-8.4). */
export function ActionsHeader({ label = 'Actions' }: { label?: string }) {
  return <VisuallyHidden>{label}</VisuallyHidden>;
}

const CELL_WIDTHS = ['80%', '60%', '45%', '70%', '35%', '55%'];

/** The real ADS table with its real column headers; only the cells are placeholders (R-10.8). */
export function SkeletonTable({ columns, rows = 6 }: { columns: ReactNode[]; rows?: number }) {
  return (
    <DynamicTable
      head={{ cells: columns.map((content, i) => ({ key: `c${i}`, content })) }}
      rows={Array.from({ length: rows }, (_, r) => ({
        key: `r${r}`,
        cells: columns.map((_, c) => ({
          key: `c${c}`,
          content: <Phantom width={CELL_WIDTHS[(r + c) % CELL_WIDTHS.length]} />,
        })),
      }))}
    />
  );
}
