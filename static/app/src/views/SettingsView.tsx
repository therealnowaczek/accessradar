import { useState, type ReactNode } from 'react';
import Button from '@atlaskit/button/new';
import Lozenge from '@atlaskit/lozenge';
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
import { DrawerBody, DrawerFooter, StackDrawer, type DrawerLevel } from '../Drawer';
import {
  formatLocal,
  permissionLabel,
  SELECTABLE_PERMISSIONS,
  timeZone,
  WEEKDAYS,
} from '../format';
import { navItem } from '../routes';
import { useApp } from '../shared';
import { useToast } from '../Toast';
import {
  Details,
  ErrorState,
  FormField,
  Loading,
  PageFrame,
  PageHeader,
  Pill,
  PlanGate,
  RadioField,
  ToggleField,
} from '../ui';
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

function scheduleText(s: Settings): string {
  if (s.frequency === 'off') return 'Off (manual snapshots only)';
  const at = `${String(s.hourUtc).padStart(2, '0')}:00 UTC (${localHour(s.hourUtc)} ${timeZone()})`;
  return s.frequency === 'daily'
    ? `Daily at ${at}`
    : `Weekly on ${WEEKDAYS[s.weekday - 1]} at ${at}`;
}

type Saver = (patch: Partial<Settings>, fallback?: 'me' | 'off') => Promise<void>;

function EditForm({
  children,
  onSave,
  onCancel,
}: {
  children: ReactNode;
  onSave: () => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <DrawerBody>
        <div className="form-stack">
          {children}
          {error ? (
            <SectionMessage appearance="error">
              <p>{error}</p>
            </SectionMessage>
          ) : null}
        </div>
      </DrawerBody>
      <DrawerFooter onCancel={onCancel}>
        <Button
          appearance="primary"
          isLoading={busy}
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
    <EditForm onCancel={cancel} onSave={() => save({ frequency, hourUtc, weekday })}>
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
      <PlanGate
        locked={!advanced}
        title="Daily and custom schedules need Advanced"
        description="Standard takes weekly and manual snapshots."
      >
        {null}
      </PlanGate>
      {frequency !== 'off' ? (
        <>
          {frequency === 'weekly' ? (
            <FormField label="Day">
              {(id) => (
                <Select<Opt<number>>
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
      onCancel={cancel}
      onSave={() =>
        value.length
          ? save({ keyPermissions: value.map((o) => o.value) })
          : Promise.reject(new Error('Pick at least one permission.'))
      }
    >
      <FormField
        label="Key permissions (up to 20)"
        helper="Used by reviews, change reports, the PDF matrix and project columns. Existing reviews keep the permissions they started with."
      >
        {(id) => (
          <Select<Opt, true>
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
    <EditForm onCancel={cancel} onSave={() => save({ retentionDays: days })}>
      <NumberField
        label="Keep snapshots for (days)"
        value={days}
        onChange={setDays}
        min={30}
        max={max}
        hint={`30 to ${max} days. Snapshots used by a review are always kept with the review.`}
      />
      <PlanGate
        locked={!advanced}
        title="Unlimited history needs Advanced"
        description="Standard keeps 90 days of snapshot history."
      >
        {null}
      </PlanGate>
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
        onChange={() => setFallback((x) => !x)}
      />
      <p className="subtle">
        Some Jira endpoints only answer for administrators. With fallback on, AccessRadar retries
        those reads on your behalf (read-only).{' '}
        {v.fallbackEnabled && !v.fallbackIsMe
          ? 'Another administrator is currently set as fallback; saving with this on makes it you.'
          : ''}
      </p>
    </EditForm>
  );
}

function RiskForm({ s, save, cancel }: { s: Settings; save: Saver; cancel: () => void }) {
  const [large, setLarge] = useState(s.largeGroupThreshold);
  const [wide, setWide] = useState(s.wideAdminProjects);
  const [apps, setApps] = useState(s.showAppAccounts);
  return (
    <EditForm
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
        label="Admin of many projects"
        value={wide}
        onChange={setWide}
        min={1}
        max={10000}
        hint="People who administer at least this many projects are flagged."
      />
      <ToggleField
        label="Include app accounts in risk indicators"
        isChecked={apps}
        onChange={() => setApps((x) => !x)}
      />
    </EditForm>
  );
}

function ReviewsForm({ s, save, cancel }: { s: Settings; save: Saver; cancel: () => void }) {
  const [requireKeepNote, setRequireKeepNote] = useState(s.requireKeepNote);
  return (
    <EditForm onCancel={cancel} onSave={() => save({ requireKeepNote })}>
      <ToggleField
        label="Require justification when keeping access"
        isChecked={requireKeepNote}
        onChange={() => setRequireKeepNote((x) => !x)}
      />
      <p className="subtle">
        Revoke and exception already require a justification of at least 10 characters. Turn this on
        to require the same for Keep.
      </p>
    </EditForm>
  );
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
    <PageFrame header={<PageHeader title={meta.title} description={meta.description} />}>
      <div className="page-stack settings-content">
        {r.error && !v ? (
          <ErrorState title="Settings unavailable" message={r.error} retry={r.reload} />
        ) : !v || !s ? (
          <Loading />
        ) : (
          <>
            {!s.saved ? (
              <SectionMessage appearance="information">
                <p>These are the defaults. Saving any section confirms the schedule.</p>
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
              <span className="chip-row">
                {s.keyPermissions.map((k) => (
                  <Lozenge key={k}>{permissionLabel(k)}</Lozenge>
                ))}
              </span>
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
                  ['Admin of many projects', `${s.wideAdminProjects}+ projects`],
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
                  ['Issue content', 'Never read'],
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
              <section className="section-stack form-section-top">
                <SpikePanel />
              </section>
            ) : null}
          </>
        )}
      </div>
      <StackDrawer
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
  soon: boolean;
}> = [
  { key: 'customSchedules', label: 'Daily and custom snapshot schedules', soon: false },
  { key: 'unlimitedHistory', label: 'Unlimited history (Standard keeps 90 days)', soon: false },
  {
    key: 'delegatedReviews',
    label: 'Reviews delegated to project owners, with reminders',
    soon: true,
  },
  { key: 'reviewCampaigns', label: 'Recurring review campaigns', soon: true },
  {
    key: 'changeAlerts',
    label: 'Change alerts: new admin, public grant, inactive user with access',
    soon: true,
  },
  {
    key: 'evidencePack',
    label: 'Audit evidence pack PDF (methodology and decision trail)',
    soon: true,
  },
  { key: 'rovo', label: 'Rovo agent', soon: true },
];

const SOURCE_TEXT: Record<EditionView['source'], string> = {
  env: 'Set by the AR_EDITION_OVERRIDE variable',
  stored: 'Set in AccessRadar (override)',
  license: 'From your Marketplace license',
  development: 'Development site (no license): Advanced',
};

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
  return (
    <Section title="Edition" description="Which AccessRadar features this site can use.">
      <Details
        rows={[
          [
            'Edition',
            <span key="e" className="chip-row">
              <Pill tone={edition.edition === 'advanced' ? 'discovery' : 'neutral'}>
                {edition.edition === 'advanced' ? 'Advanced' : 'Standard'}
              </Pill>
              <span className="subtle">{SOURCE_TEXT[edition.source]}</span>
            </span>,
          ],
          [
            'Override',
            <Select
              key="o"
              inputId="edition-override"
              isDisabled={busy || edition.envOverride}
              options={options}
              value={options.find((o) => o.value === (edition.override ?? '')) ?? options[0]}
              onChange={(o) => void change((o as Opt<string> | null)?.value ?? '')}
            />,
          ],
          [
            'Advanced',
            <ul key="a" className="plain-list">
              {ADVANCED_FEATURES.map((f) => (
                <li key={f.key}>
                  {f.label}{' '}
                  {f.soon ? (
                    <Pill tone="info">Coming soon</Pill>
                  ) : edition.features[f.key] ? (
                    <Pill tone="success">Included</Pill>
                  ) : (
                    <Pill tone="discovery">Advanced</Pill>
                  )}
                </li>
              ))}
            </ul>,
          ],
        ]}
      />
    </Section>
  );
}
