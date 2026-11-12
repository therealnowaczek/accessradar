import { useState, type ReactNode } from 'react';
import { Box, Inline, Stack, Text, xcss } from '@atlaskit/primitives';
import Button from '@atlaskit/button/new';
import { ErrorMessage } from '@atlaskit/form';
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
  formatLocalTime,
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
import { DetailsPhantom, LinesPhantom, Phantom, SkeletonRoot } from '../skeletons';
import { SpikePanel } from './SpikePanel';

type Opt<T = string> = { label: string; value: T };

/** Local wall-clock time of a UTC hour, for the schedule hint. */
function localHour(hourUtc: number): string {
  const d = new Date();
  d.setUTCHours(hourUtc, 0, 0, 0);
  return formatLocalTime(d.getTime());
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
          {t('settings.save')}
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
  // R-9.2: an out-of-range value is flagged inline under the field (the server still validates).
  const invalid = !Number.isFinite(value) || value < min || value > max;
  return (
    <FormField
      label={label}
      helper={hint ?? `Between ${min.toLocaleString()} and ${max.toLocaleString()}.`}
    >
      {(id) => (
        <>
          <Textfield
            id={id}
            type="number"
            min={min}
            max={max}
            value={String(value)}
            isInvalid={invalid}
            onChange={(e) => onChange(Number((e.target as HTMLInputElement).value))}
          />
          {invalid ? (
            <ErrorMessage>
              Enter a number between {min.toLocaleString()} and {max.toLocaleString()}.
            </ErrorMessage>
          ) : null}
        </>
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
      <RadioField label={t('campaigns.frequency')}>
        <RadioGroup
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Settings['frequency'])}
          options={[
            ...(advanced
              ? [{ name: 'frequency', value: 'daily', label: t('settings.daily') }]
              : []),
            { name: 'frequency', value: 'weekly', label: t('settings.weekly') },
            { name: 'frequency', value: 'off', label: t('settings.offManualSnapshotsOnly') },
          ]}
        />
      </RadioField>
      {!advanced ? <PlanNote benefit={t('planGate.schedules')} /> : null}
      {frequency !== 'off' ? (
        <>
          {frequency === 'weekly' ? (
            <FormField label={t('settings.day')}>
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
            label={t('settings.startTime')}
            helper={t('settings.pickAQuietHourCollectionShares')}
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
        label={t('settings.keyPermissionsUpTo20')}
        helper={t('settings.usedByReviewsChangeReportsThe')}
      >
        {(id) => (
          <>
            <Select<Opt, true>
              menuPosition="fixed"
              inputId={id}
              isMulti
              options={options}
              value={value}
              isInvalid={!value.length}
              onChange={(v) => setValue([...v].slice(0, 20))}
            />
            {/* R-9.2: the field's own error sits under the field. */}
            {!value.length ? (
              <ErrorMessage>{t('settings.pickAtLeastOnePermission')}</ErrorMessage>
            ) : null}
          </>
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
        label={t('settings.keepSnapshotsForDays')}
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
      <RadioField label={t('settings.groupMembers')}>
        <RadioGroup
          value={groupMembers}
          onChange={(e) => setGroupMembers(e.target.value as Settings['groupMembers'])}
          options={[
            {
              name: 'members',
              value: 'referenced',
              label: t('settings.groupsThatGrantAccessRecommendedFewer'),
            },
            { name: 'members', value: 'all', label: t('settings.everyGroup') },
          ]}
        />
      </RadioField>
      <NumberField
        label={t('settings.apiBudgetPerHourRatePoints')}
        value={budget}
        onChange={setBudget}
        min={500}
        max={65000}
        hint={t('settings.accessradarPausesAndResumesTheNext')}
      />
      <ToggleField
        label={t('settings.useMyAccountWhenTheApp')}
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
        label={t('settings.largeGroupMembers')}
        value={large}
        onChange={setLarge}
        min={2}
        max={100000}
        hint={t('settings.groupsThisSizeOrBiggerThat')}
      />
      <NumberField
        label={t('settings.adminOfManySpaces')}
        value={wide}
        onChange={setWide}
        min={1}
        max={10000}
        hint={t('settings.peopleWhoAdministerAtLeastThis')}
      />
      <ToggleField
        label={t('settings.includeAppAccountsInRiskIndicators')}
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
        label={t('settings.requireJustificationWhenKeepingAccess')}
        isChecked={requireKeepNote}
        onChange={setRequireKeepNote}
        helper={t('settings.revokeAndExceptionAlreadyRequireA')}
      />
    </EditForm>
  );
}

const ALERT_RULE_LABELS: Array<{ key: keyof NonNullable<Settings['alerts']>; label: string }> = [
  {
    key: 'new-admin',
    get label() {
      return t('settings.newJiraAdmin');
    },
  },
  {
    key: 'new-anonymous-grant',
    get label() {
      return t('settings.newAnonymousAnyoneGrant');
    },
  },
  {
    key: 'inactive-with-access',
    get label() {
      return t('settings.inactiveAccountWithAccess');
    },
  },
  {
    key: 'new-project-admin',
    get label() {
      return t('settings.newSpaceAdmin');
    },
  },
  {
    key: 'new-app-account-admin',
    get label() {
      return t('settings.newAppAccountAdmin');
    },
  },
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
        {t('settings.alertsAreEvaluatedWhenASnapshot')}
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

/** Terms of the "Security & data" section, shared by the page and its skeleton. */
const SECURITY_TERMS = [
  'Jira access',
  'Work item content',
  'Where data lives',
  'Who can use it',
  'Exports',
  'Personal data',
  'Closed accounts',
  'Audit log',
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
    toast.success(t('settings.settingsSaved'));
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
          <ErrorState
            title={t('settings.settingsUnavailable')}
            message={r.error}
            retry={r.reload}
          />
        ) : !v || !s ? (
          <SkeletonRoot>
            <Section
              title={t('settings.edition')}
              description={t('settings.whichAccessradarFeaturesThisSiteCan')}
            >
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
            {/* Same conditional sections as the loaded page (R-10.1). */}
            {status.data?.edition?.features?.changeAlerts ? (
              <Section
                title={t('settings.changeAlerts')}
                description={t('settings.inAppAlertsWhenAccessChanges')}
                action={<Phantom width={48} height={32} />}
              >
                <LinesPhantom lines={3} />
              </Section>
            ) : null}
            <Section
              title={t('settings.securityData')}
              description={t('settings.accessradarRunsOnAtlassianAndOnly')}
            >
              <DetailsPhantom terms={SECURITY_TERMS} />
            </Section>
          </SkeletonRoot>
        ) : (
          <>
            {!s.saved ? (
              <SectionMessage appearance="information">
                <Text as="p">{t('settings.youHaveNotChangedAnySettings')}</Text>
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
              title={t('settings.snapshotSchedule')}
              description={t('settings.howOftenAccessradarRecordsTheAccess')}
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
                  {t('settings.edit')}
                </Button>
              }
            >
              <Details rows={[['Schedule', scheduleText(s)]]} />
            </Section>
            <Section
              title={t('settings.keyPermissions')}
              description={t('settings.permissionsHighlightedInReviewsChangeReports')}
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
                  {t('settings.edit')}
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
              title={t('settings.retention')}
              description={t('settings.howLongSnapshotsAreKept')}
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
                  {t('settings.edit')}
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
              title={t('settings.collection')}
              description={t('settings.whatTheCollectorReadsAndHow')}
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
                  {t('settings.edit')}
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
              title={t('overview.riskIndicators')}
              description={t('settings.thresholdsForTheOverviewSignals')}
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
                  {t('settings.edit')}
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
              title={t('settings.reviews')}
              description={t('settings.justificationRulesForAccessDecisions')}
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
                  {t('settings.edit')}
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
                title={t('settings.changeAlerts')}
                description={t('settings.inAppAlertsWhenAccessChanges')}
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
                    {t('settings.edit')}
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
              title={t('settings.securityData')}
              description={t('settings.accessradarRunsOnAtlassianAndOnly')}
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
  {
    key: 'customSchedules',
    get label() {
      return t('settings.dailyAndCustomSnapshotSchedules');
    },
  },
  {
    key: 'unlimitedHistory',
    get label() {
      return t('settings.unlimitedHistoryStandardKeeps90Days');
    },
  },
  {
    key: 'remediationVerification',
    get label() {
      return t('settings.remediationVerificationConfirmRevokesInThe');
    },
  },
  {
    key: 'delegatedReviews',
    get label() {
      return t('settings.reviewsDelegatedToSpaceOwnersSpace');
    },
  },
  {
    key: 'reviewCampaigns',
    get label() {
      return t('settings.recurringReviewCampaigns');
    },
  },
  {
    key: 'changeAlerts',
    get label() {
      return t('settings.changeAlertsNewAdminPublicGrant');
    },
  },
  {
    key: 'evidencePack',
    get label() {
      return t('settings.auditEvidencePackPdfAndJson');
    },
  },
  {
    key: 'signatureChain',
    get label() {
      return t('settings.signedReviewsSha256HashChain');
    },
  },
  {
    key: 'rovo',
    get label() {
      return t('settings.rovoAgentReadOnlyAnswersFrom');
    },
  },
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
    { label: t('settings.useTheLicense'), value: '' },
    { label: t('settings.standard'), value: 'standard' },
    { label: t('settings.advanced'), value: 'advanced' },
  ];
  const change = async (value: string) => {
    setBusy(true);
    try {
      await call<EditionView>('setEditionOverride', { edition: value || null });
      toast.success(t('settings.editionOverrideSaved'));
      onChanged();
    } catch (e) {
      toast.error(t('settings.couldNotSaveTheOverride'), errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const rows: Array<[string, ReactNode]> = [
    [
      'Edition',
      <Inline as="span" space="space.050" shouldWrap key="e">
        <Pill tone={edition.edition === 'advanced' ? 'discovery' : 'neutral'}>
          {edition.edition === 'advanced' ? t('settings.advanced') : t('settings.standard')}
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
          aria-label={t('settings.editionOverride')}
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
              <Pill tone="info">{t('settings.comingSoon')}</Pill>
            ) : edition.features[f.key] ? (
              <Pill tone="success">{t('settings.included')}</Pill>
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
      title={t('settings.edition')}
      description={
        edition.canOverride
          ? t('settings.whichAccessradarFeaturesThisSiteCan2')
          : t('settings.whichAccessradarFeaturesThisSiteCan')
      }
    >
      <Details rows={rows} />
    </Section>
  );
}
