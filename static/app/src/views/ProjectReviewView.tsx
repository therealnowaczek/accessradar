import EmptyState from '@atlaskit/empty-state';
import { useMemo, useState } from 'react';
import { Inline, Stack, Text } from '@atlaskit/primitives';
import Button from '@atlaskit/button/new';
import DynamicTable from '../Table';
import SectionMessage, { SectionMessageAction } from '@atlaskit/section-message';
import { REQUIRES_ADVANCED } from '../../../../src/domain/edition';
import { call, errorText, type ReviewItem, type ReviewSummary } from '../api';
import { SubjectCell } from '../components';
import { useCall } from '../data';
import { formatLocal, permissionLabel, plural } from '../format';
import { t } from '../i18n';
import { useToast } from '../Toast';
import {
  ErrorState,
  Metric,
  PageFrame,
  PageHeader,
  Pill,
  PlanNote,
  MetricGrid,
  staleNotice,
} from '../ui';
import { MetricGridPhantom, Phantom, SkeletonRoot } from '../skeletons';
import { ActionsHeader, SkeletonTable } from '../skeletonTable';

type Notice = {
  id: number;
  title: string;
  body: string | null;
  severity: string;
  kind: string;
  createdAt: number;
};

type MyAssignment = {
  access: 'assignee' | 'site-admin' | 'not-assigned';
  assignment: {
    reviewId: string;
    projectId: string;
    assignee: string | null;
    status: string;
    dueAt: number;
  } | null;
  review: ReviewSummary | null;
  items: ReviewItem[];
  notices: Notice[];
  limitation: string | null;
};

export function ProjectReviewView() {
  const toast = useToast();
  const mine = useCall<MyAssignment>('getMyAssignment');
  const [busy, setBusy] = useState(false);
  const d = mine.data;
  const decidable = useMemo(
    () => (d?.items ?? []).filter((i) => i.change !== 'removed'),
    [d?.items],
  );
  const pending = decidable.filter((i) => !i.decision).length;
  const decided = decidable.length - pending;

  const decide = async (idxs: number[], decision: 'keep' | 'revoke') => {
    if (!d?.assignment) return;
    setBusy(true);
    try {
      await call('decideAssignedItems', {
        reviewId: d.assignment.reviewId,
        idxs,
        decision,
      });
      toast.success(decision === 'keep' ? 'Kept' : 'Marked revoke', plural(idxs.length, 'item'));
      mine.reload();
    } catch (e) {
      toast.error('Could not save decision', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!d?.assignment) return;
    setBusy(true);
    try {
      await call('submitAssignment', { reviewId: d.assignment.reviewId });
      toast.success('Submitted', 'A Jira admin will sign the review.');
      mine.reload();
    } catch (e) {
      toast.error('Could not submit', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (id: number) => {
    try {
      await call('dismissNotice', { id });
      mine.reload();
    } catch (e) {
      toast.error('Could not dismiss', errorText(e));
    }
  };

  const header = (
    <PageHeader
      title="Access review"
      description="Review who has key permissions in this space. Decisions stay in AccessRadar until a Jira admin signs."
      actions={
        d?.assignment && d.access !== 'not-assigned' ? (
          <Button
            appearance="primary"
            isLoading={busy}
            isDisabled={pending > 0 || d.assignment.status !== 'open'}
            onClick={() => void submit()}
          >
            Submit review
          </Button>
        ) : null
      }
    />
  );

  if (mine.error === REQUIRES_ADVANCED && !d)
    return (
      <PageFrame header={header}>
        <PlanNote benefit={t('planGate.projectReview')} />
      </PageFrame>
    );
  if (mine.error && !d)
    return (
      <PageFrame header={header}>
        <ErrorState title="Access review unavailable" message={mine.error} retry={mine.reload} />
      </PageFrame>
    );
  if (!d)
    return (
      <PageFrame header={header}>
        <SkeletonRoot>
          <Phantom height={72} />
          <MetricGridPhantom count={4} hints={false} />
          <SkeletonTable columns={['Who', 'Permissions', 'Decision', <ActionsHeader key="a" />]} />
        </SkeletonRoot>
      </PageFrame>
    );

  return (
    <PageFrame notice={staleNotice(mine)} header={header}>
      <Stack space="space.300">
        {(d.notices ?? []).map((n) => (
          <SectionMessage
            key={n.id}
            appearance={n.severity === 'high' ? 'warning' : 'information'}
            title={n.title}
            actions={
              <SectionMessageAction onClick={() => void dismiss(n.id)}>
                Dismiss
              </SectionMessageAction>
            }
          >
            {n.body ? <Text as="p">{n.body}</Text> : null}
          </SectionMessage>
        ))}

        {d.limitation || !d.assignment || !d.review ? (
          <EmptyState
            header="No assigned review"
            description={
              d.limitation ??
              'When a Jira admin runs a campaign, the assigned space admin reviews access here. Reminders stay in the app — AccessRadar does not send email.'
            }
          />
        ) : (
          <>
            <SectionMessage appearance="information" title={d.review.name}>
              <Text as="p">
                Due {formatLocal(d.assignment.dueAt)} · snapshot #{d.review.baseSeq} ·{' '}
                {d.access === 'site-admin' ? (
                  <Pill tone="info">Viewing as Jira admin</Pill>
                ) : (
                  <Pill tone="info">Assigned to you</Pill>
                )}
              </Text>
              <Text as="p" color="color.text.subtle">
                Submit when every item has a decision. A Jira admin signs the evidence pack.
                Delegates are not notified outside Jira.
              </Text>
            </SectionMessage>
            <MetricGrid>
              <Metric label="Items" value={decidable.length} />
              <Metric
                label="Decided"
                value={decided}
                hint={pending ? `${pending} to go` : 'All decided'}
              />
              <Metric label="Keep" value={decidable.filter((i) => i.decision === 'keep').length} />
              <Metric
                label="Revoke"
                value={decidable.filter((i) => i.decision === 'revoke').length}
              />
            </MetricGrid>
            <Inline space="space.075" alignBlock="center" shouldWrap>
              <Button
                isDisabled={busy || !pending}
                onClick={() =>
                  void decide(
                    decidable.filter((i) => !i.decision).map((i) => i.idx),
                    'keep',
                  )
                }
              >
                Keep remaining
              </Button>
              <Button
                isDisabled={busy || !pending}
                onClick={() =>
                  void decide(
                    decidable.filter((i) => !i.decision).map((i) => i.idx),
                    'revoke',
                  )
                }
              >
                Revoke remaining
              </Button>
            </Inline>
            <DynamicTable
              head={{
                cells: [
                  { key: 'who', content: 'Who' },
                  { key: 'perm', content: 'Permissions' },
                  { key: 'decision', content: 'Decision' },
                  { key: 'actions', content: <ActionsHeader /> },
                ],
              }}
              rows={decidable.map((i) => ({
                key: String(i.idx),
                cells: [
                  {
                    key: i.subject.name,
                    content: <SubjectCell subject={i.subject} />,
                  },
                  {
                    key: 'p',
                    content: i.permissions.map(permissionLabel).join(', '),
                  },
                  {
                    key: i.decision ?? '',
                    content: i.decision ? (
                      <Pill
                        tone={
                          i.decision === 'revoke'
                            ? 'danger'
                            : i.decision === 'exception'
                              ? 'warning'
                              : 'success'
                        }
                      >
                        {i.decision}
                      </Pill>
                    ) : (
                      <Text color="color.text.subtle">—</Text>
                    ),
                  },
                  {
                    key: 'a',
                    content: (
                      <Inline as="span" space="space.075" alignBlock="center" shouldWrap>
                        <Button
                          appearance="subtle"
                          isDisabled={busy}
                          onClick={() => void decide([i.idx], 'keep')}
                        >
                          Keep
                        </Button>
                        <Button
                          appearance="subtle"
                          isDisabled={busy}
                          onClick={() => void decide([i.idx], 'revoke')}
                        >
                          Revoke
                        </Button>
                      </Inline>
                    ),
                  },
                ],
              }))}
              rowsPerPage={50}
              defaultPage={1}
            />
          </>
        )}
      </Stack>
    </PageFrame>
  );
}
