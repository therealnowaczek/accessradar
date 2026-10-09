import { useState, type ReactNode } from 'react';
import Button from '@atlaskit/button/new';
import Lozenge from '@atlaskit/lozenge';
import { RadioGroup } from '@atlaskit/radio';
import SectionMessage from '@atlaskit/section-message';
import Select from '@atlaskit/select';
import Textfield from '@atlaskit/textfield';
import Toggle from '@atlaskit/toggle';
import { call, errorText, type Settings, type SettingsView as SettingsDto } from '../api';
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
import { Details, ErrorState, Loading, PageFrame, PageHeader } from '../ui';
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
      <DrawerFooter>
        <Button onClick={onCancel}>Cancel</Button>
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
    <label className="field">
      <span className="field-label">{label}</span>
      <Textfield
        type="number"
        min={min}
        max={max}
        value={String(value)}
        onChange={(e) => onChange(Number((e.target as HTMLInputElement).value))}
      />
      <span className="subtle">
        {hint ?? `Between ${min.toLocaleString()} and ${max.toLocaleString()}.`}
      </span>
    </label>
  );
}

function ScheduleForm({ s, save, cancel }: { s: Settings; save: Saver; cancel: () => void }) {
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
      <fieldset className="choice-group">
        <legend>Frequency</legend>
        <RadioGroup
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Settings['frequency'])}
          options={[
            { name: 'frequency', value: 'daily', label: 'Daily' },
            { name: 'frequency', value: 'weekly', label: 'Weekly' },
            { name: 'frequency', value: 'off', label: 'Off (manual snapshots only)' },
          ]}
        />
      </fieldset>
      {frequency !== 'off' ? (
        <>
          {frequency === 'weekly' ? (
            <label className="field">
              <span className="field-label">Day</span>
              <Select<Opt<number>>
                options={days}
                value={days.find((d) => d.value === weekday)}
                onChange={(o) => o && setWeekday(o.value)}
                isSearchable={false}
              />
            </label>
          ) : null}
          <label className="field">
            <span className="field-label">Start time</span>
            <Select<Opt<number>>
              options={hours}
              value={hours.find((h) => h.value === hourUtc)}
              onChange={(o) => o && setHour(o.value)}
              isSearchable={false}
            />
            <span className="subtle">
              Pick a quiet hour; collection shares the site’s API quota.
            </span>
          </label>
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
      <label className="field">
        <span className="field-label">Key permissions (up to 20)</span>
        <Select<Opt, true>
          isMulti
          options={options}
          value={value}
          onChange={(v) => setValue([...v].slice(0, 20))}
        />
        <span className="subtle">
          Used by reviews, change reports, the PDF matrix and project columns. Existing reviews keep
          the permissions they started with.
        </span>
      </label>
    </EditForm>
  );
}

function RetentionForm({ s, save, cancel }: { s: Settings; save: Saver; cancel: () => void }) {
  const [days, setDays] = useState(s.retentionDays);
  return (
    <EditForm onCancel={cancel} onSave={() => save({ retentionDays: days })}>
      <NumberField
        label="Keep snapshots for (days)"
        value={days}
        onChange={setDays}
        min={30}
        max={3650}
        hint="30 to 3650 days. Snapshots used by a review are always kept with the review."
      />
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
      <fieldset className="choice-group">
        <legend>Group members</legend>
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
      </fieldset>
      <NumberField
        label="API budget per hour (rate points)"
        value={budget}
        onChange={setBudget}
        min={500}
        max={65000}
        hint="AccessRadar pauses and resumes the next hour when the budget is used. 500 to 65,000."
      />
      <label className="choice-label">
        <Toggle
          isChecked={fallback}
          onChange={() => setFallback((x) => !x)}
          label="Admin fallback"
        />
        Use my account when the app is denied access
      </label>
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
      <label className="choice-label">
        <Toggle
          isChecked={apps}
          onChange={() => setApps((x) => !x)}
          label="Include app accounts in risks"
        />
        Include app accounts in risk indicators
      </label>
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
            <Section
              title="Snapshot schedule"
              description="How often AccessRadar records the access picture of this site."
              action={
                <Button
                  onClick={() =>
                    edit(
                      'Snapshot schedule',
                      'Scheduled snapshots run in the background.',
                      <ScheduleForm s={s} save={save} cancel={close} />,
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
                      <RetentionForm s={s} save={save} cancel={close} />,
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
                      ? `Checked ${formatLocal(v.privacy.at)}: ${v.privacy.reported} accounts, ${v.privacy.closed} closed, ${v.privacy.updated} updated`
                      : 'Daily check with Atlassian for closed accounts (not run yet)',
                  ],
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
