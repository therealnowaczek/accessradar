import { useState, type ReactNode } from 'react';
import { Box, Inline, Stack, Text, xcss } from '@atlaskit/primitives';
import Button from '@atlaskit/button/new';
import { RadioGroup } from '@atlaskit/radio';
import SectionMessage from '@atlaskit/section-message';
import Select from '@atlaskit/select';
import Textfield from '@atlaskit/textfield';
import {
  call,
  errorText,
  type EditionView,
  type Settings,
  type SettingsView as SettingsDto,
} from '../api';
import { Section } from '../components';
import { useCall } from '../data';
import { DrawerBody, DrawerFooter, LevelDrawer, type DrawerLevel } from '../Drawer';
import {
  formatLocal,
  permissionLabel,
  SELECTABLE_PERMISSIONS,
  timeZone,
  WEEKDAYS,
} from '../format';
import { t } from '../i18n';
import { navItem } from '../routes';
import { useApp } from '../shared';
import { useToast } from '../Toast';
import {
  AdvancedBadge,
  Details,
  ErrorState,
  FormField,
  PageFrame,
  PageHeader,
  Pill,
  PlanNote,
  RadioField,
  ToggleField,
  DividedListItem,
  DividedList,
  staleNotice,
} from '../ui';
import { DetailsPhantom, Phantom, SkeletonRoot } from '../skeletons';
import { SpikePanel } from './SpikePanel';

type Opt<T = string> = { label: string; value: T };

/** Local wall-clock time of a UTC hour, for the schedule hint. */
function localHour(hourUtc: number): string {
  const d = new Date();
  d.setUTCHours(hourUtc, 0, 0, 0);
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timeZone(),
  }).format(d);
}

/**
 * The schedule as the scheduler applies it: an hourly tick starts the snapshot during the
 * configured UTC hour (so within that hour, not on the minute). Values are the effective ones
 * from the server (Standard runs a saved daily schedule weekly).
 */
function scheduleText(s: Settings): string {
  if (s.frequency === 'off') return 'Off (manual snapshots only)';
  const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  const at = `between ${hh(s.hourUtc)} and ${hh(s.hourUtc + 1)} UTC (from ${localHour(s.hourUtc)} ${timeZone()})`;
  return s.frequency === 'daily'
    ? `Daily, starting ${at}`
    : `Weekly on ${WEEKDAYS[s.weekday - 1]}, starting ${at}`;
}

type Saver = (patch: Partial<Settings>, fallback?: 'me' | 'off') => Promise<void>;

function EditForm({
  children,
  onSave,
  onCancel,
  dirty,
}: {
  children: ReactNode;
  onSave: () => Promise<void>;
  onCancel: () => void;
  /** Save stays disabled until something changed (R-9.3). */
  dirty: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <DrawerBody>
        <Stack space="space.150">
          {children}
          {error ? (
            <SectionMessage appearance="error">
              <Text as="p">{error}</Text>
            </SectionMessage>
          ) : null}
        </Stack>
      </DrawerBody>
      <DrawerFooter onCancel={onCancel}>
        <Button
          appearance="primary"
          isLoading={busy}
          isDisabled={!dirty}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await onSave();
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Save
        </Button>
      </DrawerFooter>
    </>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <FormField
      label={label}
      helper={hint ?? `Between ${min.toLocaleString()} and ${max.toLocaleString()}.`}
    >
      {(id) => (
        <Textfield
          id={id}
          type="number"
          min={min}
          max={max}
          value={String(value)}
          onChange={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        />
      )}
    </FormField>
  );
}

function ScheduleForm({
  s,
  save,
  cancel,
  advanced,
}: {
  s: Settings;
  save: Saver;
  cancel: () => void;
  advanced: boolean;
}) {
  const [frequency, setFrequency] = useState(s.frequency);
  const [hourUtc, setHour] = useState(s.hourUtc);
  const [weekday, setWeekday] = useState(s.weekday);
  const hours: Opt<number>[] = Array.from({ length: 24 }, (_, h) => ({
    value: h,
    label: `${String(h).padStart(2, '0')}:00 UTC · ${localHour(h)} local`,
  }));
  const days: Opt<number>[] = WEEKDAYS.map((label, i) => ({ label, value: i + 1 }));
  return (
    <EditForm
      dirty={frequency !== s.frequency || hourUtc !== s.hourUtc || weekday !== s.weekday}
      onCancel={cancel}
      onSave={() => save({ frequency, hourUtc, weekday })}
    >
      <RadioField label="Frequency">
        <RadioGroup
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Settings['frequency'])}
          options={[
            ...(advanced ? [{ name: 'frequency', value: 'daily', label: 'Daily' }] : []),
            { name: 'frequency', value: 'weekly', label: 'Weekly' },
            { name: 'frequency', value: 'off', label: 'Off (manual snapshots only)' },
          ]}
        />
      </RadioField>
      {!advanced ? <PlanNote benefit={t('planGate.schedules')} /> : null}
      {frequency !== 'off' ? (
        <>
          {frequency === 'weekly' ? (
            <FormField label="Day">
              {(id) => (
                <Select<Opt<number>>
                  menuPosition="fixed"
                  inputId={id}
                  options={days}
                  value={days.find((d) => d.value === weekday)}
                  onChange={(o) => o && setWeekday(o.value)}
                  isSearchable={false}
                />
              )}
            </FormField>
          ) : null}
          <FormField
            label="Start time"
            helper="Pick a quiet hour; collection shares the site’s API quota."
          >
            {(id) => (
              <Select<Opt<number>>
                menuPosition="fixed"
                inputId={id}
                options={hours}
                value={hours.find((h) => h.value === hourUtc)}
                onChange={(o) => o && setHour(o.value)}
                isSearchable={false}
              />
            )}
          </FormField>
        </>
      ) : null}
    </EditForm>
  );
}

function KeyPermissionsForm({ s, save, cancel }: { s: Settings; save: Saver; cancel: () => void }) {
  const options: Opt[] = SELECTABLE_PERMISSIONS.map((value) => ({
    value,
    label: permissionLabel(value),
  }));
  const [value, setValue] = useState<Opt[]>(
    s.keyPermissions.map((k) => ({ value: k, label: permissionLabel(k) })),
  );
  return (
    <EditForm
      dirty={value.map((o) => o.value).join() !== s.keyPermissions.join()}
      onCancel={cancel}
      onSave={() =>
        value.length
          ? save({ keyPermissions: value.map((o) => o.value) })
          : Promise.reject(new Error('Pick at least one permission.'))
      }
    >
      <FormField
        label="Key permissions (up to 20)"
        helper="Used by reviews, change reports, the PDF matrix and space columns. Existing reviews keep the permissions they started with."
      >
        {(id) => (
          <Select<Opt, true>
            menuPosition="fixed"
            inputId={id}
            isMulti
            options={options}
            value={value}
            onChange={(v) => setValue([...v].slice(0, 20))}
          />
        )}
      </FormField>
    </EditForm>
  );
}

function RetentionForm({
  s,
  save,
  cancel,
  advanced,
}: {
  s: Settings;
  save: Saver;
  cancel: () => void;
  advanced: boolean;
}) {
  const [days, setDays] = useState(s.retentionDays);
  const max = advanced ? 3650 : 90;
  return (
    <EditForm
      dirty={days !== s.retentionDays}
      onCancel={cancel}
      onSave={() => save({ retentionDays: days })}
    >
      <NumberField
        label="Keep snapshots for (days)"
        value={days}
        onChange={setDays}
        min={30}
        max={max}
        hint={`30 to ${max} days. Snapshots used by a review are always kept with the review.`}
      />
      {!advanced ? <PlanNote benefit={t('planGate.history')} /> : null}
    </EditForm>
  );
}

function CollectionForm({ v, save, cancel }: { v: SettingsDto; save: Saver; cancel: () => void }) {
  const s = v.settings;
  const [groupMembers, setGroupMembers] = useState(s.groupMembers);
  const [budget, setBudget] = useState(s.hourlyPointBudget);
  const [fallback, setFallback] = useState(v.fallbackEnabled);
  return (
    <EditForm
      dirty={
        groupMembers !== s.groupMembers ||
        budget !== s.hourlyPointBudget ||
        fallback !== v.fallbackEnabled
      }
      onCancel={cancel}
      onSave={() =>
        save(
          { groupMembers, hourlyPointBudget: budget },
          fallback === v.fallbackEnabled ? undefined : fallback ? 'me' : 'off',
        )
      }
    >
      <RadioField label="Group members">
        <RadioGroup
          value={groupMembers}
          onChange={(e) => setGroupMembers(e.target.value as Settings['groupMembers'])}
          options={[
            {
              name: 'members',
              value: 'referenced',
              label: 'Groups that grant access (recommended, fewer API calls)',
            },
            { name: 'members', value: 'all', label: 'Every group' },
          ]}
        />
      </RadioField>
      <NumberField
        label="API budget per hour (rate points)"
        value={budget}
        onChange={setBudget}
        min={500}
        max={65000}
        hint="AccessRadar pauses and resumes the next hour when the budget is used. 500 to 65,000."
      />
      <ToggleField
        label="Use my account when the app is denied access"
        isChecked={fallback}
        onChange={setFallback}
        helper={`Some Jira endpoints only answer for administrators. With fallback on, AccessRadar retries those reads on your behalf (read-only).${
          v.fallbackEnabled && !v.fallbackIsMe
            ? ' Another administrator is currently set as fallback; saving with this on makes it you.'
            : ''
        }`}
      />
    </EditForm>
  );
}

function RiskForm({ s, save, cancel }: { s: Settings; save: Saver; cancel: () => void }) {
  const [large, setLarge] = useState(s.largeGroupThreshold);
  const [wide, setWide] = useState(s.wideAdminProjects);
  const [apps, setApps] = useState(s.showAppAccounts);
  return (
    <EditForm
      dirty={
        large !== s.largeGroupThreshold ||
        wide !== s.wideAdminProjects ||
        apps !== s.showAppAccounts
      }
      onCancel={cancel}
      onSave={() =>
        save({ largeGroupThreshold: large, wideAdminProjects: wide, showAppAccounts: apps })
      }
    >
      <NumberField
        label="Large group (members)"
        value={large}
        onChange={setLarge}
        min={2}
        max={100000}
        hint="Groups this size or bigger that grant access are flagged."
      />
      <NumberField
        label="Admin of many spaces"
        value={wide}
        onChange={setWide}
        min={1}
        max={10000}
        hint="People who administer at least this many spaces are flagged."
      />
      <ToggleField
        label="Include app accounts in risk indicators"
        isChecked={apps}
        onChange={setApps}
      />
    </EditForm>
  );
}

function ReviewsForm({ s, save, cancel }: { s: Settings; save: Saver; cancel: () => void }) {
  const [requireKeepNote, setRequireKeepNote] = useState(s.requireKeepNote);
  return (
    <EditForm
      dirty={requireKeepNote !== s.requireKeepNote}
      onCancel={cancel}
      onSave={() => save({ requireKeepNote })}
    >
      <ToggleField
        label="Require justification when keeping access"
        isChecked={requireKeepNote}
        onChange={setRequireKeepNote}
        helper="Revoke and exception already require a justification of at least 10 characters. Turn this on to require the same for Keep."
      />
    </EditForm>
  );
}

const ALERT_RULE_LABELS: Array<{ key: keyof NonNullable<Settings['alerts']>; label: string }> = [
  { key: 'new-admin', label: 'New Jira admin' },
  { key: 'new-anonymous-grant', label: 'New anonymous (Anyone) grant' },
  { key: 'inactive-with-access', label: 'Inactive account with access' },
  { key: 'new-project-admin', label: 'New space admin' },
  { key: 'new-app-account-admin', label: 'New app account admin' },
];

function AlertsForm({ s, save, cancel }: { s: Settings; save: Saver; cancel: () => void }) {
  const base = s.alerts ?? {
    'new-admin': true,
    'new-anonymous-grant': true,
    'inactive-with-access': true,
    'new-project-admin': true,
    'new-app-account-admin': true,
  };
  const [alerts, setAlerts] = useState(base);
  return (
    <EditForm
      dirty={JSON.stringify(alerts) !== JSON.stringify(base)}
      onCancel={cancel}
      onSave={() => save({ alerts })}
    >
      <Text as="p" color="color.text.subtle">
        Alerts are evaluated when a snapshot commits (Advanced). Delivery is in-app only — no email.
      </Text>
      {ALERT_RULE_LABELS.map((r) => (
        <ToggleField
          key={r.key}
          label={`Alert on ${r.label.charAt(0).toLowerCase()}${r.label.slice(1)}`}
          isChecked={alerts[r.key]}
          onChange={(value) => setAlerts((a) => ({ ...a, [r.key]: value }))}
        />
      ))}
    </EditForm>
  );
}

/** Section titles and terms of the Settings page, shared by the page and its skeleton. */
const SETTINGS_SECTIONS: Array<[string, string, string[]]> = [
  [
    'Snapshot schedule',
    'How often AccessRadar records the access picture of this site.',
    ['Schedule'],
  ],
  ['Key permissions', 'Permissions highlighted in reviews, change reports and exports.', []],
  ['Retention', 'How long snapshots are kept.', ['Snapshots', 'Signed reviews']],
  [
    'Collection',
    'What the collector reads and how much API quota it may use.',
    ['Group members', 'API budget', 'Admin fallback'],
  ],
  [
    'Risk indicators',
    'Thresholds for the Overview signals.',
    ['Large group', 'Admin of many spaces', 'App accounts'],
  ],
  [
    'Reviews',
    'Justification rules for access decisions.',
    ['Keep justification', 'Revoke / exception'],
  ],
];

export function SettingsView() {
  const { status } = useApp();
  const toast = useToast();
  const meta = navItem('settings');
  const r = useCall<SettingsDto>('getSettings');
  const [drawer, setDrawer] = useState<DrawerLevel[]>([]);
  const close = () => setDrawer([]);
  const save: Saver = async (patch, fallback) => {
    await call<SettingsDto>('saveSettings', {
      settings: { ...r.data!.settings, ...patch },
      ...(fallback ? { fallback } : {}),
    });
    toast.success('Settings saved');
    close();
    r.reload();
    status.reload();
  };
  const edit = (title: string, description: string, content: ReactNode) =>
    setDrawer([{ key: title, title, description, content }]);
  const v = r.data;
  const s = v?.settings;

  return (
    <PageFrame
      header={<PageHeader title={meta.title} description={meta.description} />}
      notice={staleNotice(r, 'Settings could not refresh')}
    >
      <Stack space="space.300">
        {r.error && !v ? (
          <ErrorState title="Settings unavailable" message={r.error} retry={r.reload} />
        ) : !v || !s ? (
          <SkeletonRoot>
            <Section title="Edition" description="Which AccessRadar features this site can use.">
              <DetailsPhantom terms={['Edition', 'Advanced']} />
            </Section>
            {SETTINGS_SECTIONS.map(([title, description, terms]) => (
              <Section
                key={title}
                title={title}
                description={description}
                action={<Phantom width={48} height={32} />}
              >
                {terms.length ? (
                  <DetailsPhantom terms={terms} />
                ) : (
                  <Inline space="space.050" shouldWrap>
                    {[96, 120, 88, 140].map((w) => (
                      <Phantom key={w} width={w} height={16} />
                    ))}
                  </Inline>
                )}
              </Section>
            ))}
          </SkeletonRoot>
        ) : (
          <>
            {!s.saved ? (
              <SectionMessage appearance="information">
                <Text as="p">
                  You have not changed any settings yet, so AccessRadar uses the defaults shown
                  below. They are already in effect, including the snapshot schedule. Use Edit on a
                  section to change it.
                </Text>
              </SectionMessage>
            ) : null}
            <EditionSection
              edition={v.edition}
              onChanged={() => {
                r.reload();
                status.reload();
              }}
            />
            <Section
              title="Snapshot schedule"
              description="How often AccessRadar records the access picture of this site."
              action={
                <Button
                  onClick={() =>
                    edit(
                      'Snapshot schedule',
                      'Scheduled snapshots run in the background.',
                      <ScheduleForm
                        s={s}
                        save={save}
                        cancel={close}
                        advanced={v.edition.features.customSchedules}
                      />,
                    )
                  }
                >
                  Edit
                </Button>
              }
            >
              <Details rows={[['Schedule', scheduleText(s)]]} />
            </Section>
            <Section
              title="Key permissions"
              description="Permissions highlighted in reviews, change reports and exports."
              action={
                <Button
                  onClick={() =>
                    edit(
                      'Key permissions',
                      'What reviewers see and sign off.',
                      <KeyPermissionsForm s={s} save={save} cancel={close} />,
                    )
                  }
                >
                  Edit
                </Button>
              }
            >
              <Inline as="span" space="space.050" shouldWrap>
                {s.keyPermissions.map((k) => (
                  <Pill key={k}>{permissionLabel(k)}</Pill>
                ))}
              </Inline>
            </Section>
            <Section
              title="Retention"
              description="How long snapshots are kept."
              action={
                <Button
                  onClick={() =>
                    edit(
                      'Retention',
                      'Older snapshots are deleted automatically.',
                      <RetentionForm
                        s={s}
                        save={save}
                        cancel={close}
                        advanced={v.edition.features.unlimitedHistory}
                      />,
                    )
                  }
                >
                  Edit
                </Button>
              }
            >
              <Details
                rows={[
                  ['Snapshots', `${s.retentionDays} days`],
                  ['Signed reviews', 'Kept until deleted with the app'],
                ]}
              />
            </Section>
            <Section
              title="Collection"
              description="What the collector reads and how much API quota it may use."
              action={
                <Button
                  onClick={() =>
                    edit(
                      'Collection',
                      'Read-only; nothing in Jira changes.',
                      <CollectionForm v={v} save={save} cancel={close} />,
                    )
                  }
                >
                  Edit
                </Button>
              }
            >
              <Details
                rows={[
                  [
                    'Group members',
                    s.groupMembers === 'all' ? 'Every group' : 'Groups that grant access',
                  ],
                  [
                    'API budget',
                    `${s.hourlyPointBudget.toLocaleString()} rate points per hour · ${v.usage.points.toLocaleString()} used this hour`,
                  ],
                  [
                    'Admin fallback',
                    v.fallbackEnabled
                      ? v.fallbackIsMe
                        ? 'On (your account)'
                        : 'On (another administrator)'
                      : 'Off',
                  ],
                ]}
              />
            </Section>
            <Section
              title="Risk indicators"
              description="Thresholds for the Overview signals."
              action={
                <Button
                  onClick={() =>
                    edit(
                      'Risk indicators',
                      'Tune what counts as a signal.',
                      <RiskForm s={s} save={save} cancel={close} />,
                    )
                  }
                >
                  Edit
                </Button>
              }
            >
              <Details
                rows={[
                  ['Large group', `${s.largeGroupThreshold}+ members`],
                  ['Admin of many spaces', `${s.wideAdminProjects}+ spaces`],
                  ['App accounts', s.showAppAccounts ? 'Included' : 'Excluded'],
                ]}
              />
            </Section>
            <Section
              title="Reviews"
              description="Justification rules for access decisions."
              action={
                <Button
                  onClick={() =>
                    edit(
                      'Reviews',
                      'When reviewers must explain a decision.',
                      <ReviewsForm s={s} save={save} cancel={close} />,
                    )
                  }
                >
                  Edit
                </Button>
              }
            >
              <Details
                rows={[
                  [
                    'Keep justification',
                    s.requireKeepNote ? 'Required (≥10 characters)' : 'Optional',
                  ],
                  ['Revoke / exception', 'Always required (≥10 characters)'],
                ]}
              />
            </Section>
            {v.edition.features.changeAlerts ? (
              <Section
                title="Change alerts"
                description="In-app alerts when access changes between snapshots (Advanced)."
                action={
                  <Button
                    onClick={() =>
                      edit(
                        'Change alerts',
                        'Which rules raise an in-app alert after a snapshot.',
                        <AlertsForm s={s} save={save} cancel={close} />,
                      )
                    }
                  >
                    Edit
                  </Button>
                }
              >
                <Details
                  rows={ALERT_RULE_LABELS.map((r) => [
                    r.label,
                    (s.alerts ?? {})[r.key] === false ? 'Off' : 'On',
                  ])}
                />
              </Section>
            ) : null}
            <Section
              title="Security & data"
              description="AccessRadar runs on Atlassian and only reads configuration."
            >
              <Details
                rows={[
                  [
                    'Jira access',
                    'Read-only (granular read scopes); AccessRadar never changes Jira',
                  ],
                  ['Work item content', 'Never read'],
                  [
                    'Where data lives',
                    'Forge SQL in this site’s Atlassian environment; no external egress',
                  ],
                  ['Who can use it', 'Jira administrators only (checked on every request)'],
                  ['Exports', 'Generated in your browser'],
                  [
                    'Personal data',
                    v.privacy
                      ? `Last run ${formatLocal(v.privacy.at)}: ${v.privacy.reported} of ${v.privacy.stored ?? v.privacy.reported} accounts reported (each at most once per 7 days), ${v.privacy.closedTotal ?? v.privacy.closed} closed`
                      : 'Reported to Atlassian at most once per 7 days per account (not run yet)',
                  ],
                  [
                    'Closed accounts',
                    'Pseudonymised: the name is replaced by “Closed account <code>”; the account ID is kept in snapshots, reviews and the audit log as evidence',
                  ],
                  ['Audit log', `Kept for ${s.retentionDays} days (same as snapshot retention)`],
                ]}
              />
            </Section>
            {status.data?.spike ? (
              <Section>
                <SpikePanel />
              </Section>
            ) : null}
          </>
        )}
      </Stack>
      <LevelDrawer
        levels={drawer}
        onBack={() => setDrawer((l) => l.slice(0, -1))}
        onClose={close}
      />
    </PageFrame>
  );
}

const ADVANCED_FEATURES: Array<{
  key: keyof EditionView['features'];
  label: string;
}> = [
  { key: 'customSchedules', label: 'Daily and custom snapshot schedules' },
  { key: 'unlimitedHistory', label: 'Unlimited history (Standard keeps 90 days)' },
  {
    key: 'remediationVerification',
    label: 'Remediation verification (confirm Revokes in the next snapshot)',
  },
  {
    key: 'delegatedReviews',
    label: 'Reviews delegated to space owners (space settings + in-app reminders)',
  },
  { key: 'reviewCampaigns', label: 'Recurring review campaigns' },
  {
    key: 'changeAlerts',
    label: 'Change alerts: new admin, public grant, inactive user with access',
  },
  {
    key: 'evidencePack',
    label: 'Audit evidence pack PDF (methodology and decision trail)',
  },
  { key: 'rovo', label: 'Rovo agent (read-only answers from your snapshots)' },
];

const SOURCE_TEXT: Record<EditionView['source'], string> = {
  env: 'Set by the AR_EDITION_OVERRIDE variable',
  stored: 'Set in AccessRadar (override)',
  license: 'From your Marketplace license',
  development: 'Development site (no license): Advanced',
};

/** Control inside a Details row (R-9.6): at most 280px wide. */
const detailsControlStyles = xcss({ maxWidth: '17.5rem' });

function EditionSection({ edition, onChanged }: { edition: EditionView; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const options: Opt<string>[] = [
    { label: 'Use the license', value: '' },
    { label: 'Standard', value: 'standard' },
    { label: 'Advanced', value: 'advanced' },
  ];
  const change = async (value: string) => {
    setBusy(true);
    try {
      await call<EditionView>('setEditionOverride', { edition: value || null });
      toast.success('Edition override saved');
      onChanged();
    } catch (e) {
      toast.error('Could not save the override', errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const rows: Array<[string, ReactNode]> = [
    [
      'Edition',
      <Inline as="span" space="space.050" shouldWrap key="e">
        <Pill tone={edition.edition === 'advanced' ? 'discovery' : 'neutral'}>
          {edition.edition === 'advanced' ? 'Advanced' : 'Standard'}
        </Pill>
        <Text color="color.text.subtle">{SOURCE_TEXT[edition.source]}</Text>
      </Inline>,
    ],
  ];
  if (edition.canOverride === true) {
    rows.push([
      'Override',
      // Development and staging only (canOverride); stored in KVS by setEditionOverride.
      <Box key="o" xcss={detailsControlStyles}>
        <Select
          menuPosition="fixed"
          inputId="edition-override"
          aria-label="Edition override"
          isSearchable={false}
          isDisabled={busy || edition.envOverride}
          options={options}
          value={options.find((o) => o.value === (edition.override ?? '')) ?? options[0]}
          onChange={(o) => void change((o as Opt<string> | null)?.value ?? '')}
        />
      </Box>,
    ]);
  }
  rows.push([
    'Advanced',
    <DividedList key="a">
      {ADVANCED_FEATURES.map((f) => {
        const soon = (edition.comingSoon ?? []).includes(f.key);
        return (
          <DividedListItem key={f.key}>
            {f.label}{' '}
            {soon ? (
              <Pill tone="info">Coming soon</Pill>
            ) : edition.features[f.key] ? (
              <Pill tone="success">Included</Pill>
            ) : (
              <AdvancedBadge />
            )}
          </DividedListItem>
        );
      })}
    </DividedList>,
  ]);
  return (
    <Section
      title="Edition"
      description={
        edition.canOverride
          ? 'Which AccessRadar features this site can use. On development and staging you can override the edition to test Standard vs Advanced.'
          : 'Which AccessRadar features this site can use.'
      }
    >
      <Details rows={rows} />
    </Section>
  );
}
