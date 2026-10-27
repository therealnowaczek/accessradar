import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button, { IconButton } from '@atlaskit/button/new';
import Blanket from '@atlaskit/blanket';
import Heading from '@atlaskit/heading';
import ArrowLeftIcon from '@atlaskit/icon/core/arrow-left';
import CrossIcon from '@atlaskit/icon/core/cross';
import { Box, Inline, Stack, Text, xcss } from '@atlaskit/primitives';

export type DrawerLevel = {
  key: string;
  title: string;
  description?: string;
  content: React.ReactNode;
};

/** @deprecated Prefer SidePanelLevel — same shape. */
export type SidePanelLevel = DrawerLevel;

/** Test id of the pinned panel header; styles.css adds the shared fade under its separator. */
export const DRAWER_HEADER_TEST_ID = 'ar-drawer-header';
export const SIDE_PANEL_HEADER_TEST_ID = DRAWER_HEADER_TEST_ID;

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

const frameStyles = xcss({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: '0',
  minWidth: '0',
});
const headerStyles = xcss({
  flexShrink: 0,
  paddingBlockEnd: 'space.200',
  paddingInline: 'space.300',
  paddingBlockStart: 'space.300',
  borderBlockEndWidth: 'border.width',
  borderBlockEndStyle: 'solid',
  borderBlockEndColor: 'color.border',
});
const headingStyles = xcss({ flexGrow: 1, minWidth: '0', paddingBlockStart: 'space.050' });
const levelStyles = xcss({
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
  minHeight: '0',
});
const bodyStyles = xcss({
  flexGrow: 1,
  minHeight: '0',
  overflowY: 'auto',
  paddingBlockStart: 'space.300',
  paddingInline: 'space.300',
  // 40px under the last line keeps it clear of Jira's floating Rovo button (bottom right).
  paddingBlockEnd: 'space.500',
});
const footerStyles = xcss({
  flexShrink: 0,
  paddingBlock: 'space.200',
  paddingInlineStart: 'space.300',
  paddingInlineEnd: 'space.300',
  borderBlockStartWidth: 'border.width',
  borderBlockStartStyle: 'solid',
  borderBlockStartColor: 'color.border',
  backgroundColor: 'elevation.surface.overlay',
});
const footerRowStyles = xcss({ paddingInlineEnd: 'space.600' });

function useSidePanelA11y(
  open: boolean,
  onClose: () => void,
  panelRef: React.RefObject<HTMLElement | null>,
) {
  const priorFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    priorFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const focusFirst = () => {
      const root = panelRef.current;
      if (!root) return;
      const nodes = root.querySelectorAll<HTMLElement>(FOCUSABLE);
      (nodes[0] ?? root).focus();
    };
    // After paint so the portal is in the DOM.
    const t = window.setTimeout(focusFirst, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.repeat && !e.isComposing) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (n) => !n.hasAttribute('disabled') && n.tabIndex !== -1,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      priorFocus.current?.focus?.();
      void panel;
    };
  }, [open, onClose, panelRef]);
}

/**
 * Right-edge entity/settings overlay (~600px). Levels stack in one panel: Back pops one level;
 * Close / blanket / Escape dismiss all. Not `@atlaskit/drawer` (left-only / deprecated for this
 * pattern). Narrow ADS Drawer remains only for app nav ≤1023px (R-2.5).
 */
export function LevelSidePanel({
  levels,
  onBack,
  onClose,
}: {
  levels: DrawerLevel[];
  onBack: () => void;
  onClose: () => void;
}) {
  const open = levels.length > 0;
  const [shown, setShown] = useState<DrawerLevel[]>(levels);
  const [visible, setVisible] = useState(open);
  if (open && shown !== levels) setShown(levels);
  if (open && !visible) setVisible(true);

  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const level = shown[shown.length - 1];
  const nested = shown.length > 1;

  useSidePanelA11y(open, onClose, panelRef);

  useEffect(() => {
    if (open) return;
    if (!visible) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce) {
      setVisible(false);
      setShown([]);
      return;
    }
    const t = window.setTimeout(() => {
      setVisible(false);
      setShown([]);
    }, 200);
    return () => window.clearTimeout(t);
  }, [open, visible]);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`side-panel-root${open ? ' is-open' : ' is-closing'}`}>
      <Blanket isTinted shouldAllowClickThrough={false} onBlanketClicked={() => onClose()} />
      <div
        ref={panelRef}
        className="side-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {level ? (
          <Box xcss={frameStyles}>
            <Box xcss={headerStyles} testId={SIDE_PANEL_HEADER_TEST_ID}>
              <Inline space="space.100" alignBlock="start" spread="space-between">
                <Inline space="space.100" alignBlock="start">
                  {nested ? (
                    <IconButton
                      icon={ArrowLeftIcon}
                      label="Back"
                      appearance="subtle"
                      onClick={onBack}
                    />
                  ) : null}
                  <Box xcss={headingStyles}>
                    <Stack space="space.050">
                      <Heading size="medium" id={titleId}>
                        {level.title}
                      </Heading>
                      {level.description ? (
                        <Text as="p" color="color.text.subtle">
                          {level.description}
                        </Text>
                      ) : null}
                    </Stack>
                  </Box>
                </Inline>
                <IconButton icon={CrossIcon} label="Close" appearance="subtle" onClick={onClose} />
              </Inline>
            </Box>
            <Box key={level.key} xcss={levelStyles}>
              {level.content}
            </Box>
          </Box>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** @deprecated Use LevelSidePanel — same API. */
export const LevelDrawer = LevelSidePanel;

/** Scrolling body shared by every panel level. */
export function DrawerBody({ children }: { children: React.ReactNode }) {
  return (
    <Box xcss={bodyStyles}>
      <Stack space="space.300">{children}</Stack>
    </Box>
  );
}
export const SidePanelBody = DrawerBody;

/**
 * Pinned footer: primary FIRST on the left, Cancel (subtle) immediately to its right.
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
    <Box xcss={footerStyles}>
      <Box xcss={footerRowStyles}>
        <Inline space="space.100" alignBlock="center" alignInline="start" shouldWrap>
          {children}
          {onCancel ? (
            <Button appearance="subtle" onClick={onCancel}>
              {cancelLabel}
            </Button>
          ) : null}
        </Inline>
      </Box>
    </Box>
  );
}
export const SidePanelFooter = DrawerFooter;
