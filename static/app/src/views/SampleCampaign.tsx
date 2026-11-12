import { useState } from 'react';
import { Inline, Stack, Text } from '@atlaskit/primitives';
import Button from '@atlaskit/button/new';
import ProgressBar from '@atlaskit/progress-bar';
import SectionMessage from '@atlaskit/section-message';
import { call, errorText } from '../api';
import { Section } from '../components';
import { useCall } from '../data';
import { useConfirm } from '../Confirm';
import { t, type MessageKey } from '../i18n';
import DynamicTable from '../Table';
import { useToast } from '../Toast';
import { Pill } from '../ui';

type Decision = 'keep' | 'revoke' | 'exception';
type Flag = 'contractor' | 'deactivated' | 'public' | 'admin';
type Item = {
  id: string;
  space: string;
  person: string;
  via: { kind: 'group' | 'role'; name: string } | { kind: 'direct' };
  permissions: string[];
  flags: Flag[];
  decision: Decision | null;
};
type Sample = {
  createdAt: number;
  finishedAt: number | null;
  total: number;
  decided: number;
  counts: Record<Decision, number>;
  items: Item[];
};

const DECISIONS: Decision[] = ['keep', 'revoke', 'exception'];

function viaLabel(via: Item['via']) {
  if (via.kind === 'group') return t('sample.viaGroup', { name: via.name });
  if (via.kind === 'role') return t('sample.viaRole', { name: via.name });
  return t('sample.viaDirect');
}

/**
 * Sample review campaign: invented people, groups and spaces kept only in the app. It never reads or
 * changes Jira, is not part of any export or evidence, and can be deleted at any time.
 */
export function SampleCampaign({ advanced }: { advanced: boolean }) {
  const toast = useToast();
  const r = useCall<{ sample: Sample | null }>('getSample');
  const [busy, setBusy] = useState(false);
  const [confirmDialog, confirm] = useConfirm();
  const [local, setLocal] = useState<{ sample: Sample | null } | null>(null);
  const sample = (local ?? r.data)?.sample ?? null;

  const act = async (name: string, payload: Record<string, unknown> = {}, okMessage?: string) => {
    setBusy(true);
    try {
      setLocal(await call<{ sample: Sample | null }>(name, payload));
      if (okMessage) toast.success(okMessage);
    } catch (e) {
      toast.error(t('sample.notSaved'), errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!r.data && !local) return null;

  if (!sample)
    return (
      <Section title={t('sample.title')} description={t('sample.description')}>
        <Inline>
          <Button
            isDisabled={busy}
            onClick={() => void act('startSample', {}, t('sample.started'))}
          >
            {t('sample.try')}
          </Button>
        </Inline>
      </Section>
    );

  const done = sample.finishedAt !== null;
  return (
    <Section
      title={t('sample.title')}
      description={t('sample.description')}
      action={
        <Button
          isDisabled={busy}
          onClick={() =>
            confirm({
              title: t('sample.deleteTitle'),
              confirmLabel: t('sample.delete'),
              onConfirm: () => act('deleteSample', {}, t('sample.deleted')),
              body: <Text as="p">{t('sample.deleteBody')}</Text>,
            })
          }
        >
          {t('sample.delete')}
        </Button>
      }
    >
      <Stack space="space.200">
        <SectionMessage appearance="discovery" title={t('sample.badge')} headingLevel="h3">
          <Text as="p">{t('sample.banner')}</Text>
          {!advanced ? <Text as="p">{t('sample.editionNote')}</Text> : null}
        </SectionMessage>
        <Stack space="space.050">
          <Text>{t('sample.progress', { decided: sample.decided, total: sample.total })}</Text>
          <ProgressBar
            ariaLabel={t('sample.progress', { decided: sample.decided, total: sample.total })}
            value={sample.total ? sample.decided / sample.total : 0}
          />
        </Stack>
        <DynamicTable
          head={{
            cells: [
              { key: 'person', content: t('sample.colPerson') },
              { key: 'space', content: t('sample.colSpace') },
              { key: 'via', content: t('sample.colVia') },
              { key: 'why', content: t('sample.colWhy') },
              { key: 'decision', content: t('sample.colDecision') },
            ],
          }}
          rows={sample.items.map((i) => ({
            key: i.id,
            cells: [
              {
                key: i.person,
                content: (
                  <Inline as="span" space="space.100" alignBlock="center" shouldWrap>
                    <Text weight="bold">{i.person}</Text>
                    <Pill tone="discovery">{t('sample.badge')}</Pill>
                  </Inline>
                ),
              },
              { key: i.space, content: i.space },
              {
                key: viaLabel(i.via),
                content: (
                  <Stack space="space.025">
                    <Text>{viaLabel(i.via)}</Text>
                    <Text color="color.text.subtle">{i.permissions.join(', ')}</Text>
                  </Stack>
                ),
              },
              {
                key: i.flags.length,
                content: i.flags.length ? (
                  <Inline as="span" space="space.050" shouldWrap>
                    {i.flags.map((f) => (
                      <Pill key={f} tone="warning">
                        {t(`sample.flag.${f}` as MessageKey)}
                      </Pill>
                    ))}
                  </Inline>
                ) : (
                  '-'
                ),
              },
              {
                key: i.decision ?? '',
                content: (
                  <Inline as="span" space="space.050" shouldWrap>
                    {DECISIONS.map((d) => (
                      <Button
                        key={d}
                        spacing="compact"
                        isSelected={i.decision === d}
                        isDisabled={busy || done}
                        onClick={() =>
                          void act('decideSample', {
                            id: i.id,
                            decision: i.decision === d ? null : d,
                          })
                        }
                      >
                        {t(`sample.${d}` as MessageKey)}
                      </Button>
                    ))}
                  </Inline>
                ),
              },
            ],
          }))}
          rowsPerPage={50}
          defaultPage={1}
        />
        {done ? (
          <SectionMessage appearance="success" headingLevel="h3" title={t('sample.finishedTitle')}>
            <Text as="p">
              {t('sample.finished', {
                keep: sample.counts.keep,
                revoke: sample.counts.revoke,
                exception: sample.counts.exception,
              })}
            </Text>
          </SectionMessage>
        ) : (
          <Inline>
            <Button
              appearance="primary"
              isDisabled={busy || sample.decided < sample.total}
              onClick={() => void act('finishSample')}
            >
              {t('sample.finish')}
            </Button>
          </Inline>
        )}
      </Stack>
      {confirmDialog}
    </Section>
  );
}
