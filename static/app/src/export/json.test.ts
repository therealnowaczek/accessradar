import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import type { Changes, ReviewDetail, Snapshot } from '../api';
import {
  changesJson,
  evidencePackJson,
  JSON_SCHEMA_VERSION,
  matrixJson,
  reviewJson,
  serializeJson,
} from './json';
import type { EvidencePackPayload } from './evidencePack';

const schema = JSON.parse(
  readFileSync(
    new URL('../../../../docs/schemas/accessradar-export-v1.schema.json', import.meta.url),
    'utf8',
  ),
);
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function expectValid(doc: unknown) {
  const ok = validate(JSON.parse(JSON.stringify(doc)));
  expect(validate.errors ?? []).toEqual([]);
  expect(ok).toBe(true);
}

const snap: Snapshot = {
  seq: 7,
  status: 'complete',
  trigger: 'manual',
  collectorMode: 'app',
  engineVersion: '1.0.0',
  startedAt: Date.UTC(2026, 9, 9, 10, 0, 0),
  finishedAt: Date.UTC(2026, 9, 9, 10, 2, 0),
  updatedAt: 0,
  progress: null,
  stats: null,
  points: 10,
  calls: 5,
  contentHash: 'c'.repeat(64),
  error: null,
  gaps: 0,
};
const ctx = {
  tz: 'Europe/Warsaw',
  now: Date.UTC(2026, 9, 9, 12, 0, 0),
  siteUrl: 'https://example.atlassian.net',
};
const project = {
  id: '1',
  key: 'OPS',
  name: 'Ops',
  style: 'company' as const,
  schemeId: 's',
  schemeName: 'Default',
};
const coverage = [{ area: 'groups', target: 'g1', status: 'unreadable', reason: 'denied' }];
const limitations = {
  version: 1,
  statements: ['Team-managed projects use a simplified permission model.'],
  completeness: 'partial' as const,
  gapCount: 1,
  label: 'partial (1 gap)',
};

const reviewDetail = (status: 'signed' | 'draft'): ReviewDetail => ({
  review: {
    id: '0f6e3c2a-1111-4222-8333-444455556666',
    name: 'Q4 review',
    scope: { type: 'site', ids: [] },
    keyPermissions: ['BROWSE_PROJECTS'],
    baseSeq: 7,
    compareSeq: null,
    status,
    createdBy: 'a1',
    createdAt: snap.startedAt,
    dueAt: null,
    itemCount: 1,
    signedBy: status === 'signed' ? 'a1' : null,
    signedAt: status === 'signed' ? ctx.now : null,
    signerTz: 'Europe/Warsaw',
    attestation: null,
    evidenceHash: status === 'signed' ? 'e'.repeat(64) : null,
    engineVersion: '1.0.0',
    createdByName: 'Marcin',
    signedByName: status === 'signed' ? 'Marcin' : null,
    scopeLabels: [],
  },
  base: snap,
  compare: null,
  coverage,
  limitations,
  items: [
    {
      idx: 0,
      itemKey: 'p:1|u:1',
      subjectType: 'user',
      subjectId: 'u1',
      projectId: '1',
      groupId: null,
      permissions: ['BROWSE_PROJECTS'],
      reasons: ['group “devs” → role “Developers” → scheme “Default”'],
      pathCodes: ['group:g>role:1>scheme:s#2'],
      change: null,
      risk: 0,
      decision: 'revoke',
      note: 'Left the team',
      decidedBy: 'a1',
      decidedAt: ctx.now,
      subject: { key: 'u:u1', type: 'user', id: 'u1', name: 'Józef' },
      project,
      groupName: null,
      decidedByName: 'Marcin',
    },
  ],
});

const matrixRows = [
  {
    project_key: 'OPS',
    project_name: 'Ops',
    project_style: 'company',
    subject_type: 'user',
    subject_id: 'u1',
    display_name: 'Ann',
    account_type: 'atlassian',
    active: 'yes',
    permission: 'BROWSE_PROJECTS',
    path: 'role “Users”',
    path_codes: 'role:1',
    completeness_flag: '',
  },
];

describe('JSON exports (schema v1)', () => {
  it('access matrix validates and matches the golden file', async () => {
    const doc = matrixJson(
      snap,
      matrixRows,
      ctx,
      [{ id: 'anonymous', severity: 'high', title: 'Anonymous access', count: 2 }],
      coverage,
      limitations,
    );
    expectValid(doc);
    expect(doc.schemaVersion).toBe(JSON_SCHEMA_VERSION);
    expect(doc.rows[0].active).toBe(true);
    expect(doc.rows[0].captured_at_utc).toBe('2026-10-09T10:00:00.000Z');
    await expect(serializeJson(doc)).toMatchFileSnapshot('./__golden__/access-matrix.json');
  });

  it('changes validates and matches the golden file', async () => {
    const c: Changes = {
      a: { ...snap, seq: 6 },
      b: snap,
      keyPermissions: ['BROWSE_PROJECTS'],
      granted: [
        {
          subject: { key: 'u:1', type: 'user', id: '1', name: 'Ann' },
          project,
          permission: 'BROWSE_PROJECTS',
          reasons: ['direct'],
          codes: ['user:1'],
        },
      ],
      revoked: [],
      facts: [
        {
          category: 'groups',
          change: 'added',
          kind: 'group_member',
          label: 'Ann joined “devs”',
          detail: '',
          projectIds: [],
          groupId: 'g',
          permission: null,
        },
      ],
    };
    const doc = changesJson(c, ctx);
    expectValid(doc);
    expect(doc.rows.map((r) => r.change)).toEqual(['granted', 'added']);
    await expect(serializeJson(doc)).toMatchFileSnapshot('./__golden__/changes.json');
  });

  it('review validates for signed and unsigned reviews, and keeps non-ASCII text', async () => {
    const signed = reviewJson(reviewDetail('signed'), ctx);
    expectValid(signed);
    expect(signed.review.signature?.evidenceHash).toBe('e'.repeat(64));
    expect(signed.items[0].displayName).toBe('Józef');
    await expect(serializeJson(signed)).toMatchFileSnapshot('./__golden__/review-signed.json');
    const draft = reviewJson(reviewDetail('draft'), ctx);
    expectValid(draft);
    expect(draft.review.signature).toBeNull();
  });

  it('evidence pack validates and matches the golden file', async () => {
    const items: EvidencePackPayload['items'] = [
      {
        itemKey: 'p:1|u:1',
        subjectType: 'user',
        subjectId: 'u1',
        permissions: ['BROWSE_PROJECTS'],
        decision: 'keep',
        note: null,
        expiresAt: null,
        change: null,
        projectId: '1',
        groupId: null,
      },
    ];
    const pack: EvidencePackPayload = {
      header: {
        reviewId: '0f6e3c2a-1111-4222-8333-444455556666',
        name: 'Q4 review',
        scope: { type: 'site', ids: [] },
        base: { seq: 7, contentHash: 'c'.repeat(64), startedAt: snap.startedAt },
        compare: null,
        signedBy: 'a1',
        signedAt: ctx.now,
        signerTz: 'Europe/Warsaw',
        evidenceHash: 'e'.repeat(64),
        signatureVersion: 2,
        coverageHash: 'f'.repeat(64),
        chainSeq: 1,
        prevReviewHash: null,
        engineVersion: '1.0.0',
        attestation: 'I confirm.',
        itemCount: 1,
      },
      sections: {
        methodology: { engineVersion: '1.0.0', dataSources: ['/rest/api/3/project'], note: 'n' },
        limitations,
        coverage,
        summary: { keep: 1 },
        controls: { version: 1, mappings: [], disclaimer: 'd' },
        exceptions: [{ itemKey: 'x', justification: 'j', expiresAt: ctx.now, status: 'active' }],
        remediation: [],
        audit: [{ at: ctx.now, actor: 'a1', action: 'review.signed' }],
      },
      items,
    };
    const doc = evidencePackJson(pack, items, ctx);
    expectValid(doc);
    expect(doc.sections?.audit[0].at).toBe('2026-10-09T12:00:00.000Z');
    await expect(serializeJson(doc)).toMatchFileSnapshot('./__golden__/evidence-pack.json');
  });

  it('the schema rejects a wrong version, a wrong kind and a bad decision', () => {
    const good = JSON.parse(
      serializeJson(
        changesJson(
          { a: snap, b: snap, keyPermissions: [], granted: [], revoked: [], facts: [] },
          ctx,
        ),
      ),
    );
    expect(validate(good)).toBe(true);
    expect(validate({ ...good, schemaVersion: 2 })).toBe(false);
    expect(validate({ ...good, kind: 'nope' })).toBe(false);
    const rv = JSON.parse(serializeJson(reviewJson(reviewDetail('draft'), ctx)));
    rv.items[0].decision = 'maybe';
    expect(validate(rv)).toBe(false);
  });
});
