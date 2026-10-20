import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Button, { IconButton } from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import ArrowLeftIcon from '@atlaskit/icon/core/arrow-left';
import CrossIcon from '@atlaskit/icon/core/cross';

export type DrawerLevel = {
  key: string;
  title: string;
  description?: string;
  content: React.ReactNode;
};

const EXIT_MS = 160;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Right-hand drawer with a navigation stack. The last level is shown; "back"
 * pops one level, "close" (button, scrim, Escape) dismisses the whole stack.
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
  const [leaving, setLeaving] = useState(false);
  // Keep rendering the last levels while the exit transition plays.
  const [shown, setShown] = useState<DrawerLevel[]>(levels);
  if (open && shown !== levels) setShown(levels);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [nav, setNav] = useState<{ depth: number; direction: 'forward' | 'back' }>({
    depth: levels.length,
    direction: 'forward',
  });
  const titleId = useId();

  const depth = levels.length;
  if (nav.depth !== depth) {
    setNav({ depth, direction: depth === 0 || depth > nav.depth ? 'forward' : 'back' });
  }

  const requestClose = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      onClose();
    }, EXIT_MS);
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    returnFocus.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => returnFocus.current?.focus?.();
  }, [open]);

  const level = shown[shown.length - 1];
  if (!open || !level) return null;
  const nested = depth > 1;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.stopPropagation();
      requestClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (item) => item.offsetParent !== null,
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === panelRef.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={`drawer-root ${leaving ? 'is-leaving' : ''}`}>
      <div className="drawer-scrim" onClick={requestClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="drawer-header">
          {nested ? (
            <IconButton icon={ArrowLeftIcon} label="Back" appearance="subtle" onClick={onBack} />
          ) : null}
          <div className="drawer-heading">
            <Heading size="medium" id={titleId}>
              {level.title}
            </Heading>
            {level.description ? <p className="subtle">{level.description}</p> : null}
          </div>
          <IconButton icon={CrossIcon} label="Close" appearance="subtle" onClick={requestClose} />
        </header>
        <div key={level.key} className={`drawer-level slide-${nav.direction}`}>
          {level.content}
        </div>
      </div>
    </div>
  );
}

/** Scrolling body + pinned footer shared by every drawer level. */
export function DrawerBody({ children }: { children: React.ReactNode }) {
  return <div className="drawer-body">{children}</div>;
}

/**
 * Pinned footer shared by every drawer level (the one footer component): the primary action comes
 * FIRST on the left, Cancel (subtle) immediately to its right. Pass the primary button as children
 * and `onCancel` instead of rendering Cancel yourself. Left alignment also keeps the primary
 * action clear of Jira's floating assistant button in the bottom-right corner.
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
      {children}
      {onCancel ? (
        <Button appearance="subtle" onClick={onCancel}>
          {cancelLabel}
        </Button>
      ) : null}
    </div>
  );
}
