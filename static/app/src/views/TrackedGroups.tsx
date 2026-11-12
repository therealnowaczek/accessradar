import { Stack, Text } from '@atlaskit/primitives';
import type { TrackedGroupChange, TrackedGroupsSummary } from '../api';
import { permissionLabel } from '../format';
import { t } from '../i18n';
import { DividedList, DividedListItem, Pill } from '../ui';

/** One line per change of a tracked group (reach and membership); members are counted, never named. */
export function trackedChangeLines(c: TrackedGroupChange): string[] {
  const lines: string[] = [];
  if (c.status === 'gone') return [t('groups.trackedGone')];
  for (const s of c.spacesAdded)
    lines.push(
      t('groups.reachAdded', {
        space: s.key,
        permissions: s.permissions.map(permissionLabel).join(', '),
      }),
    );
  for (const s of c.spacesRemoved) lines.push(t('groups.reachRemoved', { space: s.key }));
  for (const p of c.permissionsChanged) {
    if (p.added.length)
      lines.push(
        t('groups.reachPermsAdded', {
          space: p.key,
          permissions: p.added.map(permissionLabel).join(', '),
        }),
      );
    if (p.removed.length)
      lines.push(
        t('groups.reachPermsRemoved', {
          space: p.key,
          permissions: p.removed.map(permissionLabel).join(', '),
        }),
      );
  }
  if (c.membersJoined) lines.push(t('groups.membersJoined', { count: c.membersJoined }));
  if (c.membersLeft) lines.push(t('groups.membersLeft', { count: c.membersLeft }));
  return lines;
}

/** Weekly changes of the groups the admin tracks (from the weekly digest). */
export function TrackedGroupChanges({ summary }: { summary: TrackedGroupsSummary }) {
  return (
    <Stack space="space.150">
      <Text as="p" color="color.text.subtle">
        {t('groups.trackedSummary', { changed: summary.changed, tracked: summary.tracked })}
      </Text>
      {summary.changes.length ? (
        <DividedList>
          {summary.changes.map((c) => (
            <DividedListItem key={c.groupId} loose>
              <Stack space="space.050">
                <Text weight="bold">
                  {c.name} <Pill tone="info">{t('groups.tracked')}</Pill>
                </Text>
                {trackedChangeLines(c).map((l, i) => (
                  <Text key={i} color="color.text.subtle">
                    {l}
                  </Text>
                ))}
              </Stack>
            </DividedListItem>
          ))}
        </DividedList>
      ) : (
        <Text as="p" color="color.text.subtle">
          {t('groups.trackedNone')}
        </Text>
      )}
    </Stack>
  );
}
