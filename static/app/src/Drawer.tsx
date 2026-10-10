import React, { useId, useState } from 'react';
import Button, { IconButton } from '@atlaskit/button/new';
import Drawer, { DrawerSidebar } from '@atlaskit/drawer';
import Heading from '@atlaskit/heading';
import ArrowLeftIcon from '@atlaskit/icon/core/arrow-left';

export type DrawerLevel = {
  key: string;
  title: string;
  description?: string;
  content: React.ReactNode;
};

/**
 * ADS Drawer with a navigation stack. The last level is shown; the sidebar arrow pops one level
 * (or closes at the first level). Escape and the blanket dismiss the whole stack.
 */
export function StackDrawer({
  levels,
  onBack,
  onClose,
}: {
  levels: DrawerLevel[];
  onBack: () => void;
  onClose: () => void;
}) {
  const open = levels.length > 0;
  const titleId = useId();
  // Keep rendering the last levels while the ADS exit transition plays.
  const [shown, setShown] = useState<DrawerLevel[]>(levels);
  if (open && shown !== levels) setShown(levels);
  const [nav, setNav] = useState<{ depth: number; direction: 'forward' | 'back' }>({
    depth: levels.length,
    direction: 'forward',
  });

  const depth = levels.length;
  if (nav.depth !== depth) {
    setNav({ depth, direction: depth === 0 || depth > nav.depth ? 'forward' : 'back' });
  }

  const level = shown[shown.length - 1];
  if (!level) return null;
  const nested = open && depth > 1;

  return (
    <Drawer isOpen={open} onClose={onClose} width="wide" titleId={titleId}>
      <DrawerSidebar>
        <IconButton
          icon={ArrowLeftIcon}
          label={nested ? 'Back' : 'Close drawer'}
          shape="circle"
          appearance="subtle"
          onClick={nested ? onBack : onClose}
        />
      </DrawerSidebar>
      <div className="drawer-main">
        <header className="drawer-header">
          <Heading size="medium" id={titleId}>
            {level.title}
          </Heading>
          {level.description ? <p className="subtle">{level.description}</p> : null}
        </header>
        <div key={level.key} className={`drawer-level slide-${nav.direction}`}>
          {level.content}
        </div>
      </div>
    </Drawer>
  );
}

/** Scrolling body + pinned footer shared by every drawer level. */
export function DrawerBody({ children }: { children: React.ReactNode }) {
  return <div className="drawer-body">{children}</div>;
}

/**
 * Pinned footer, right-aligned like the ADS modal footer: Cancel (subtle) comes first and the
 * primary action last. Pass `onCancel` instead of rendering Cancel yourself.
 */
export function DrawerFooter({
  children,
  onCancel,
  cancelLabel = 'Cancel',
}: {
  children: React.ReactNode;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  return (
    <div className="drawer-footer">
      {onCancel ? (
        <Button appearance="subtle" onClick={onCancel}>
          {cancelLabel}
        </Button>
      ) : null}
      {children}
    </div>
  );
}
