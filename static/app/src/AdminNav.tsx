import { useState } from 'react';
import { IconButton } from '@atlaskit/button/new';
import Drawer, { DrawerCloseButton, DrawerContent, DrawerSidebar } from '@atlaskit/drawer';
import MenuIcon from '@atlaskit/icon/core/menu';
import { SideNavBody, SideNavHeader } from '@atlaskit/navigation-system/layout/side-nav';
import { Box, Stack } from '@atlaskit/primitives';
import { ButtonMenuItem, COLLAPSE_ELEM_BEFORE } from '@atlaskit/side-nav-items/button-menu-item';
import { MenuList } from '@atlaskit/side-nav-items/menu-list';
import { MenuSection, MenuSectionHeading } from '@atlaskit/side-nav-items/menu-section';
import { BrandHeader } from './brand';
import { NAV, type ViewId } from './routes';

/** Accessible name of the admin navigation (side panel, overlay and its menu button). */
export const NAV_LABEL = 'AccessRadar';
const BRAND_SUBTITLE = 'Admin settings';

type NavProps = {
  view: ViewId;
  onChange: (view: ViewId) => void;
  /** Item label decorator (for example the open alert count); defaults to the plain label. */
  label?: (id: ViewId, text: string) => string;
};

/**
 * Admin side navigation from @atlaskit/navigation-system (SideNavHeader, SideNavBody) and
 * @atlaskit/side-nav-items inside our own <nav>, not the SideNav slot: without the page Root the
 * slot renders display:none in a Forge iframe. The loading skeleton renders this same component,
 * so the sidebar never shifts on load. Below 64rem it leaves the layout (AdminNavOverlay).
 */
export function AdminNavFull({ view, onChange, label = (_id, text) => text }: NavProps) {
  return (
    <div className="admin-nav-full">
      <Box as="nav" aria-label={NAV_LABEL}>
        <SideNavHeader>
          <BrandHeader subtitle={BRAND_SUBTITLE} />
        </SideNavHeader>
        <SideNavBody>
          <Stack space="space.200">
            {NAV.map((group) => (
              <MenuSection key={group.group} ariaLabel={group.group}>
                <MenuSectionHeading>{group.group}</MenuSectionHeading>
                <MenuList>
                  {group.items.map((item) => (
                    <ButtonMenuItem
                      key={item.id}
                      elemBefore={COLLAPSE_ELEM_BEFORE}
                      isSelected={view === item.id}
                      onClick={() => onChange(item.id)}
                    >
                      {label(item.id, item.label)}
                    </ButtonMenuItem>
                  ))}
                </MenuList>
              </MenuSection>
            ))}
          </Stack>
        </SideNavBody>
      </Box>
    </div>
  );
}

/**
 * Below 64rem (navigation-system's own breakpoint): a top bar with a menu button and the brand that
 * opens the same navigation as an overlay (@atlaskit/drawer, narrow). Choosing a page closes it;
 * ADS handles Escape, the blanket, focus lock and focus return.
 */
export function AdminNavOverlay({ view, onChange, label }: NavProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="admin-nav-compact">
      <IconButton
        icon={MenuIcon}
        label={NAV_LABEL}
        appearance="subtle"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      />
      <BrandHeader subtitle={BRAND_SUBTITLE} />
      <Drawer isOpen={open} onClose={() => setOpen(false)} width="narrow" label={NAV_LABEL}>
        <DrawerSidebar>
          <DrawerCloseButton label="Close" />
        </DrawerSidebar>
        <DrawerContent>
          <div className="admin-nav-overlay">
            <AdminNavFull
              view={view}
              label={label}
              onChange={(next) => {
                onChange(next);
                setOpen(false);
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/** Sidebar content: the full side panel (≥1024px) and the overlay top bar (≤1023px). */
export function AdminNav(props: NavProps) {
  return (
    <>
      <AdminNavFull {...props} />
      <AdminNavOverlay {...props} />
    </>
  );
}
