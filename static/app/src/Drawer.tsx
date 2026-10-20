import React, { useId, useState } from 'react';
import Button, { IconButton } from '@atlaskit/button/new';
import AtlaskitDrawer, { DrawerCloseButton, DrawerContent } from '@atlaskit/drawer';
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

/** Test id of the ADS drawer panel; styles.css docks it on the right (layout glue). */
export const DRAWER_TEST_ID = 'ar-drawer';
/** Test id of the pinned drawer header; styles.css adds the shared fade under its separator. */
export const DRAWER_HEADER_TEST_ID = 'ar-drawer-header';

const panelStyles = xcss({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  minWidth: '0',
});
const headerStyles = xcss({
  flexShrink: 0,
  paddingBlock: 'space.200',
  paddingInlineStart: 'space.300',
  paddingInlineEnd: 'space.200',
  borderBlockEndWidth: 'border.width',
  borderBlockEndStyle: 'solid',
  borderBlockEndColor: 'color.border',
});
const headingStyles = xcss({ flexGrow: 1, minWidth: '0', paddingBlockStart: 'space.050' });
const bodyStyles = xcss({
  // ADS DrawerContent already adds space.300 above the body.
  paddingBlockStart: 'space.0',
  paddingInline: 'space.300',
  // Keeps the last line clear of Jira's floating Rovo button in the bottom-right corner.
  paddingBlockEnd: 'space.1000',
});
const footerStyles = xcss({
  flexShrink: 0,
  paddingBlockStart: 'space.200',
  paddingBlockEnd: 'space.300',
  paddingInlineStart: 'space.300',
  // Wide end padding: the buttons never sit under Jira's Rovo button (bottom right).
  paddingInlineEnd: 'space.1000',
  borderBlockStartWidth: 'border.width',
  borderBlockStartStyle: 'solid',
  borderBlockStartColor: 'color.border',
  backgroundColor: 'elevation.surface.overlay',
});

/**
 * ADS Drawer (@atlaskit/drawer) with a navigation stack. The last level is shown; "back" pops
 * one level, "close" (button, blanket, Escape) dismisses the whole stack. ADS handles focus
 * lock, focus return, Escape, the blanket and the enter/exit motion.
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
      enterFrom="right"
      width="wide"
      titleId={titleId}
      testId={DRAWER_TEST_ID}
    >
      {level ? (
        <Box xcss={panelStyles}>
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
              <DrawerCloseButton icon={CrossIcon} label="Close" />
            </Inline>
          </Box>
          {/* Key per level: a pushed/popped level starts with fresh state and scroll position. */}
          <React.Fragment key={level.key}>{level.content}</React.Fragment>
        </Box>
      ) : null}
    </AtlaskitDrawer>
  );
}

/** Scrolling body shared by every drawer level (ADS DrawerContent). */
export function DrawerBody({ children }: { children: React.ReactNode }) {
  return (
    <DrawerContent scrollContentLabel="Drawer content">
      <Box xcss={bodyStyles}>
        <Stack space="space.300">{children}</Stack>
      </Box>
    </DrawerContent>
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
      <Inline space="space.100" alignBlock="center" alignInline="start" shouldWrap>
        {children}
        {onCancel ? (
          <Button appearance="subtle" onClick={onCancel}>
            {cancelLabel}
          </Button>
        ) : null}
      </Inline>
    </Box>
  );
}
