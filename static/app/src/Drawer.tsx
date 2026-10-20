import React, { useId, useState } from 'react';
import Button, { IconButton } from '@atlaskit/button/new';
import AtlaskitDrawer, { DrawerCloseButton, DrawerContent, DrawerSidebar } from '@atlaskit/drawer';
import Heading from '@atlaskit/heading';
import ArrowLeftIcon from '@atlaskit/icon/core/arrow-left';
import { Box, Inline, Stack, Text, xcss } from '@atlaskit/primitives';

export type DrawerLevel = {
  key: string;
  title: string;
  description?: string;
  content: React.ReactNode;
};

/** Test id of the pinned drawer header; styles.css adds the shared fade under its separator. */
export const DRAWER_HEADER_TEST_ID = 'ar-drawer-header';

/*
 * @atlaskit/drawer lays out DrawerSidebar (close button column) and DrawerContent (24px top
 * offset). The frame fills DrawerContent so the body scrolls between a pinned header and footer.
 */
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
  paddingInlineEnd: 'space.300',
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
  paddingInlineEnd: 'space.300',
  // 40px under the last line keeps it clear of Jira's floating Rovo button (bottom right).
  paddingBlockEnd: 'space.500',
});
const footerStyles = xcss({
  flexShrink: 0,
  paddingBlock: 'space.200',
  paddingInlineEnd: 'space.300',
  borderBlockStartWidth: 'border.width',
  borderBlockStartStyle: 'solid',
  borderBlockStartColor: 'color.border',
  backgroundColor: 'elevation.surface.overlay',
});

const footerRowStyles = xcss({ paddingInlineEnd: 'space.600' });

/**
 * @atlaskit/drawer (width "wide", 600px) whose content steps through levels: the last level is
 * shown, Back pops one level, and closing (close button, blanket, Escape) dismisses them all.
 * Nested flows swap content inside this one Drawer instead of stacking panels. ADS owns the
 * blanket, focus lock, Escape, scroll lock, focus return and the panel motion; the panel keeps
 * ADS's default placement.
 */
export function LevelDrawer({
  levels,
  onBack,
  onClose,
}: {
  levels: DrawerLevel[];
  onBack: () => void;
  onClose: () => void;
}) {
  const open = levels.length > 0;
  // Keep rendering the last levels while the ADS exit transition plays.
  const [shown, setShown] = useState<DrawerLevel[]>(levels);
  if (open && shown !== levels) setShown(levels);
  const titleId = useId();
  const level = shown[shown.length - 1];
  const nested = shown.length > 1;

  return (
    <AtlaskitDrawer
      isOpen={open}
      onClose={() => onClose()}
      onCloseComplete={() => setShown([])}
      width="wide"
      titleId={titleId}
    >
      <DrawerSidebar>
        <DrawerCloseButton label="Close" />
      </DrawerSidebar>
      <DrawerContent>
        {level ? (
          <Box xcss={frameStyles}>
            <Box xcss={headerStyles} testId={DRAWER_HEADER_TEST_ID}>
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
            </Box>
            {/* Key per level: a pushed/popped level starts with fresh state and scroll position. */}
            <Box key={level.key} xcss={levelStyles}>
              {level.content}
            </Box>
          </Box>
        ) : null}
      </DrawerContent>
    </AtlaskitDrawer>
  );
}

/** Scrolling body shared by every drawer level. */
export function DrawerBody({ children }: { children: React.ReactNode }) {
  return (
    <Box xcss={bodyStyles}>
      <Stack space="space.300">{children}</Stack>
    </Box>
  );
}

/**
 * Pinned footer shared by every drawer level (the one footer component): the primary action comes
 * FIRST on the left, Cancel (subtle) immediately to its right. Pass the primary button as children
 * and `onCancel` instead of rendering Cancel yourself. Left alignment also keeps the primary
 * action clear of Jira's floating Rovo button in the bottom-right corner.
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
      {/* 24px + 48px = 72px end padding: the buttons never sit under Jira's Rovo button. */}
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
