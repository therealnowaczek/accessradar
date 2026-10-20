import type { ComponentProps } from 'react';
import DynamicTable from '@atlaskit/dynamic-table';

/**
 * The app's table: ADS DynamicTable inside a full-width container that owns horizontal scrolling,
 * so on narrow screens a wide table scrolls sideways on its own instead of squeezing its columns
 * or pushing the whole page sideways.
 */
export default function Table(props: ComponentProps<typeof DynamicTable>) {
  return (
    <div className="table-wrap">
      <DynamicTable {...props} />
    </div>
  );
}
