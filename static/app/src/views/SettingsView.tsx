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

/** "09:00" for a UTC hour (wraps at 24). */
const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

/** Weekday name for 1 (Monday) to 7 (Sunday). */
function weekdayName(day: number): string {
  const keys = [
    'settings.weekdayMonday',
    'settings.weekdayTuesday',
    'settings.weekdayWednesday',
    'settings.weekdayThursday',
    'settings.weekdayFriday',
    'settings.weekdaySaturday',
    'settings.weekdaySunday',
  ] as const;
  return t(keys[day - 1] ?? keys[0]);
}

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
  if (s.frequency === 'off') return t('settings.offManualSnapshotsOnly');
  const vars = {
    from: hh(s.hourUtc),
    to: hh(s.hourUtc + 1),
    local: localHour(s.hourUtc),
    zone: timeZone(),
  };
  return s.frequency === 'daily'
    ? t('settings.scheduleDaily', vars)
    : t('settings.scheduleWeekly', { ...vars, day: weekdayName(s.weekday) });
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
      helper={
        hint ??
        t('settings.betweenMinAndMax', {
          min: min.toLocaleString(),
          max: max.toLocaleString(),
        })
      }
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
              {t('settings.enterANumberBetween', {
                min: min.toLocaleString(),
                max: max.toLocaleString(),
              })}
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
    label: t('settings.hourUtcLocal', { hour: hh(h), local: localHour(h) }),
  }));
  const days: Opt<number>[] = Array.from({ length: 7 }, (_, i) => ({
    label: weekdayName(i + 1),
    value: i + 1,
  }));
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
          : Promise.reject(new Error(t('settings.pickAtLeastOnePermission')))
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
        hint={t('settings.retentionHint', { min: 30, max })}
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
        helper={
          v.fallbackEnabled && !v.fallbackIsMe
            ? t('settings.fallbackHelperAnotherAdmin')
            : t('settings.fallbackHelper')
        }
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

const ALERT_RULE_LABELS: Array<{
  key: keyof NonNullable<Settings['alerts']>;
  label: string;
  toggle: string;
}> = [
  {
    key: 'new-admin',
    get label() {
      return t('settings.newJiraAdmin');
    },
    get toggle() {
      return t('settings.alertOnNewJiraAdmin');
    },
  },
  {
    key: 'new-anonymous-grant',
    get label() {
      return t('settings.newAnonymousAnyoneGrant');
    },
    get toggle() {
      return t('settings.alertOnNewAnonymousGrant');
    },
  },
  {
    key: 'inactive-with-access',
    get label() {
      return t('settings.inactiveAccountWithAccess');
    },
    get toggle() {
      return t('settings.alertOnInactiveAccountWithAccess');
    },
  },
  {
    key: 'new-project-admin',
    get label() {
      return t('settings.newSpaceAdmin');
    },
    get toggle() {
      return t('settings.alertOnNewSpaceAdmin');
    },
  },
  {
    key: 'new-app-account-admin',
    get label() {
      return t('settings.newAppAccountAdmin');
    },
    get toggle() {
      return t('settings.alertOnNewAppAccountAdmin');
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
          label={r.toggle}
          isChecked={alerts[r.key]}
          onChange={(value) => setAlerts((a) => ({ ...a, [r.key]: value }))}
        />
      ))}
    </EditForm>
  );
}

/** Section titles and terms of the Settings page, shared by the page and its skeleton. */
function settingsSections(): Array<[string, string, string[]]> {
  return [
    [
      t('settings.snapshotSchedule'),
      t('settings.howOftenAccessradarRecordsTheAccess'),
      [t('settings.schedule')],
    ],
    [t('settings.keyPermissions'), t('settings.permissionsHighlightedInReviewsChangeReports'), []],
    [
      t('settings.retention'),
      t('settings.howLongSnapshotsAreKept'),
      [t('nav.snapshots.label'), t('settings.signedReviews')],
    ],
    [
      t('settings.collection'),
      t('settings.whatTheCollectorReadsAndHow'),
      [t('settings.groupMembers'), t('settings.apiBudget'), t('settings.adminFallback')],
    ],
    [
      t('overview.riskIndicators'),
      t('settings.thresholdsForTheOverviewSignals'),
      [t('settings.largeGroup'), t('settings.adminOfManySpaces'), t('settings.appAccounts')],
    ],
    [
      t('settings.reviews'),
      t('settings.justificationRulesForAccessDecisions'),
      [t('settings.keepJustification'), t('settings.revokeException')],
    ],
  ];
}

/** Terms of the "Security & data" section, shared by the page and its skeleton. */
function securityTerms(): string[] {
  return [
    t('settings.jiraAccess'),
    t('settings.workItemContent'),
    t('settings.whereDataLives'),
    t('settings.whoCanUseIt'),
    t('settings.exports'),
    t('settings.personalData'),
    t('settings.closedAccounts'),
    t('settings.auditLog'),
  ];
}

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
      notice={staleNotice(r, t('settings.settingsCouldNotRefresh'))}
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
              <DetailsPhantom terms={[t('settings.edition'), t('settings.advanced')]} />
            </Section>
            {settingsSections().map(([title, description, terms]) => (
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
              <DetailsPhantom terms={securityTerms()} />
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
                      t('settings.snapshotSchedule'),
                      t('settings.scheduledSnapshotsRunInTheBackground'),
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
              <Details rows={[[t('settings.schedule'), scheduleText(s)]]} />
            </Section>
            <Section
              title={t('settings.keyPermissions')}
              description={t('settings.permissionsHighlightedInReviewsChangeReports')}
              action={
                <Button
                  onClick={() =>
                    edit(
                      t('settings.keyPermissions'),
                      t('settings.whatReviewersSeeAndSignOff'),
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
                      t('settings.retention'),
                      t('settings.olderSnapshotsAreDeletedAutomatically'),
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
                  [
                    t('nav.snapshots.label'),
                    t('settings.retentionDaysValue', { count: s.retentionDays }),
                  ],
                  [t('settings.signedReviews'), t('settings.keptUntilDeletedWithTheApp')],
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
                      t('settings.collection'),
                      t('settings.readOnlyNothingInJiraChanges'),
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
                    t('settings.groupMembers'),
                    s.groupMembers === 'all'
                      ? t('settings.everyGroup')
                      : t('settings.groupsThatGrantAccess'),
                  ],
                  [
                    t('settings.apiBudget'),
                    t('settings.apiBudgetValue', {
                      budget: s.hourlyPointBudget.toLocaleString(),
                      used: v.usage.points.toLocaleString(),
                    }),
                  ],
                  [
                    t('settings.adminFallback'),
                    v.fallbackEnabled
                      ? v.fallbackIsMe
                        ? t('settings.fallbackOnYourAccount')
                        : t('settings.fallbackOnAnotherAdmin')
                      : t('settings.off'),
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
                      t('overview.riskIndicators'),
                      t('settings.tuneWhatCountsAsASignal'),
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
                  [
                    t('settings.largeGroup'),
                    t('settings.membersThreshold', { count: s.largeGroupThreshold }),
                  ],
                  [
                    t('settings.adminOfManySpaces'),
                    t('settings.spacesThreshold', { count: s.wideAdminProjects }),
                  ],
                  [
                    t('settings.appAccounts'),
                    s.showAppAccounts ? t('settings.included') : t('settings.excluded'),
                  ],
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
                      t('settings.reviews'),
                      t('settings.whenReviewersMustExplainADecision'),
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
                    t('settings.keepJustification'),
                    s.requireKeepNote
                      ? t('settings.requiredMin10Characters')
                      : t('settings.optional'),
                  ],
                  [t('settings.revokeException'), t('settings.alwaysRequiredMin10Characters')],
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
                        t('settings.changeAlerts'),
                        t('settings.whichRulesRaiseAnInAppAlert'),
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
                    (s.alerts ?? {})[r.key] === false ? t('settings.off') : t('settings.on'),
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
                  [t('settings.jiraAccess'), t('settings.jiraAccessValue')],
                  [t('settings.workItemContent'), t('settings.neverRead')],
                  [t('settings.whereDataLives'), t('settings.whereDataLivesValue')],
                  [t('settings.whoCanUseIt'), t('settings.whoCanUseItValue')],
                  [t('settings.exports'), t('settings.exportsValue')],
                  [
                    t('settings.personalData'),
                    v.privacy
                      ? t('settings.personalDataLastRun', {
                          at: formatLocal(v.privacy.at),
                          reported: v.privacy.reported,
                          stored: v.privacy.stored ?? v.privacy.reported,
                          closed: v.privacy.closedTotal ?? v.privacy.closed,
                        })
                      : t('settings.personalDataNotRun'),
                  ],
                  [t('settings.closedAccounts'), t('settings.closedAccountsValue')],
                  [t('settings.auditLog'), t('settings.auditLogValue', { count: s.retentionDays })],
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
  get env() {
    return t('settings.sourceEnv');
  },
  get stored() {
    return t('settings.sourceStored');
  },
  get license() {
    return t('settings.sourceLicense');
  },
  get development() {
    return t('settings.sourceDevelopment');
  },
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
      t('settings.edition'),
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
      t('settings.override'),
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
    t('settings.advanced'),
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
