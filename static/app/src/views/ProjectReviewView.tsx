import { useMemo, useState } from 'react';
import Button from '@atlaskit/button/new';
import DynamicTable from '@atlaskit/dynamic-table';
import SectionMessage, { SectionMessageAction } from '@atlaskit/section-message';
import { call, errorText, type ReviewItem, type ReviewSummary } from '../api';
import { SubjectCell } from '../components';
import { useCall } from '../data';
import { formatLocal, permissionLabel, plural } from '../format';
import { useToast } from '../Toast';
import { Empty, ErrorState, Loading, Metric, PageFrame, PageHeader, Pill } from '../ui';

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
      description="Review who has key permissions in this project. Decisions stay in AccessRadar until a Jira admin signs."
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

  if (mine.error && !d)
    return (
      <PageFrame header={header}>
        <ErrorState title="Access review unavailable" message={mine.error} retry={mine.reload} />
      </PageFrame>
    );
  if (!d)
    return (
      <PageFrame header={header}>
        <Loading />
      </PageFrame>
    );

  return (
    <PageFrame header={header}>
      <div className="page-stack">
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
            {n.body ? <p>{n.body}</p> : null}
          </SectionMessage>
        ))}

        {d.limitation || !d.assignment || !d.review ? (
          <Empty
            title="No assigned review"
            description={
              d.limitation ??
              'When a Jira admin runs a campaign, the assigned project admin reviews access here. Reminders stay in the app — AccessRadar does not send email.'
            }
            action={null}
          />
        ) : (
          <>
            <SectionMessage appearance="information" title={d.review.name}>
              <p>
                Due {formatLocal(d.assignment.dueAt)} · snapshot #{d.review.baseSeq} ·{' '}
                {d.access === 'site-admin' ? (
                  <Pill tone="info">Viewing as Jira admin</Pill>
                ) : (
                  <Pill tone="info">Assigned to you</Pill>
                )}
              </p>
              <p className="subtle">
                Submit when every item has a decision. A Jira admin signs the evidence pack.
                Delegates are not notified outside Jira.
              </p>
            </SectionMessage>
            <div className="metric-grid">
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
            </div>
            <div className="status-row tight">
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
            </div>
            <DynamicTable
              head={{
                cells: [
                  { key: 'who', content: 'Who' },
                  { key: 'perm', content: 'Permissions' },
                  { key: 'decision', content: 'Decision' },
                  { key: 'actions', content: '' },
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
                      <span className="subtle">—</span>
                    ),
                  },
                  {
                    key: 'a',
                    content: (
                      <span className="status-row tight">
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
                      </span>
                    ),
                  },
                ],
              }))}
              rowsPerPage={50}
              defaultPage={1}
            />
          </>
        )}
      </div>
    </PageFrame>
  );
}
