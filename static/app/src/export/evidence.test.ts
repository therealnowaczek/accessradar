import { describe, expect, it } from 'vitest';
import type { Changes, ReviewDetail, Snapshot } from '../api';
import { parseCsv } from './csv';
import {
  changesCsv,
  matrixCsv,
  MATRIX_COLUMNS,
  REVIEW_COLUMNS,
  reviewCsv,
  reviewPdf,
} from './evidence';

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

describe('evidence exports', () => {
  it('matrix CSV carries snapshot metadata and fixed columns', () => {
    const rows = parseCsv(
      matrixCsv(
        snap,
        [
          {
            project_key: 'OPS',
            display_name: 'Ann',
            permission: 'BROWSE_PROJECTS',
            path: 'role “Users”',
          },
        ],
        ctx,
      ),
    );
    const meta = rows.filter((r) => r[0].startsWith('#')).map((r) => r[0]);
    expect(meta).toContain(`# Snapshot content hash (SHA-256): ${'c'.repeat(64)}`);
    expect(
      meta.some(
        (m) => m.includes('2026-10-09 12:00:00 UTC') && m.includes('14:00:00 (Europe/Warsaw)'),
      ),
    ).toBe(true);
    const header = rows.find((r) => r[0] === 'snapshot_id')!;
    expect(header).toEqual(MATRIX_COLUMNS);
    const data = rows[rows.indexOf(header) + 1];
    expect(data[0]).toBe('7');
    expect(data[1]).toBe('2026-10-09 10:00:00 UTC');
  });

  it('matrix CSV appends a Risks section when risks are provided', () => {
    const text = matrixCsv(
      snap,
      [{ project_key: 'OPS', display_name: 'Ann', permission: 'BROWSE_PROJECTS', path: 'x' }],
      ctx,
      [{ id: 'anonymous', severity: 'high', title: 'Anonymous access', count: 2, partial: false }],
    );
    expect(text).toContain('# Section: Risks');
    expect(text).toContain('anonymous');
    expect(text).toContain('Anonymous access');
  });

  it('changes CSV lists granted, revoked and configuration changes', () => {
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
    const rows = parseCsv(changesCsv(c, ctx)).filter((r) => !r[0].startsWith('#'));
    expect(rows.map((r) => r[0])).toEqual(['change', 'granted', 'added']);
  });

  it('review CSV/PDF include decisions, signer and evidence hash', async () => {
    const d: ReviewDetail = {
      review: {
        id: '0f6e3c2a-1111-4222-8333-444455556666',
        name: 'Q4 review',
        scope: { type: 'site', ids: [] },
        keyPermissions: ['BROWSE_PROJECTS'],
        baseSeq: 7,
        compareSeq: null,
        status: 'signed',
        createdBy: 'a1',
        createdAt: snap.startedAt,
        dueAt: null,
        itemCount: 1,
        signedBy: 'a1',
        signedAt: ctx.now,
        signerTz: 'Europe/Warsaw',
        attestation: 'I confirm.',
        evidenceHash: 'e'.repeat(64),
        engineVersion: '1.0.0',
        createdByName: 'Marcin',
        signedByName: 'Marcin',
        scopeLabels: [],
      },
      base: snap,
      compare: null,
      coverage: [
        {
          area: 'groups',
          target: 'g1',
          status: 'unreadable',
          reason: 'denied, see "policy"',
        },
      ],
      limitations: {
        version: 1,
        statements: ['Team-managed projects use a simplified permission model.'],
        completeness: 'partial',
        gapCount: 1,
        label: 'partial (1 gap)',
      },
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
          note: '=cmd()',
          decidedBy: 'a1',
          decidedAt: ctx.now,
          subject: { key: 'u:u1', type: 'user', id: 'u1', name: 'Józef' },
          project,
          groupName: null,
          decidedByName: 'Marcin',
        },
      ],
    };
    const rows = parseCsv(reviewCsv(d, ctx));
    expect(rows.some((r) => r[0] === `# Evidence hash (SHA-256): ${'e'.repeat(64)}`)).toBe(true);
    expect(rows.some((r) => r[0].includes('accountId a1'))).toBe(true);
    expect(rows.some((r) => r[0] === '# limitations_version: 1')).toBe(true);
    expect(rows.some((r) => r[0] === '# completeness: partial (1 gap)')).toBe(true);
    const coverageRow = rows.find((r) => r[0] === '# coverage');
    expect(coverageRow).toBeTruthy();
    expect(coverageRow).toContain('unreadable');
    expect(coverageRow?.some((c) => c.includes('denied, see "policy"'))).toBe(true);
    const header = rows.find((r) => r[0] === 'review_id')!;
    expect(header).toEqual(REVIEW_COLUMNS);
    const item = rows[rows.indexOf(header) + 1];
    expect(item[REVIEW_COLUMNS.indexOf('decision')]).toBe('revoke (to do in Jira)');
    expect(item[REVIEW_COLUMNS.indexOf('note')]).toBe("'=cmd()");
    expect(item[REVIEW_COLUMNS.indexOf('decided_at_local')]).toBe(
      '2026-10-09 14:00:00 (Europe/Warsaw)',
    );
    const { inflateSync } = await import('node:zlib');
    const bytes = await reviewPdf(d, ctx);
    const ascii = Buffer.from(bytes).toString('latin1');
    expect(ascii.startsWith('%PDF')).toBe(true);
    // Inflate streams: content uses glyph ids; ToUnicode carries real codepoints.
    let decoded = '';
    const raw = Buffer.from(bytes);
    let i = 0;
    while ((i = raw.indexOf(Buffer.from('stream'), i)) !== -1) {
      let s = i + 6;
      if (raw[s] === 0x0d) s++;
      if (raw[s] === 0x0a) s++;
      const end = raw.indexOf(Buffer.from('endstream'), s);
      if (end < 0) break;
      const chunk = raw.subarray(s, end);
      try {
        decoded += inflateSync(chunk).toString('binary');
      } catch {
        decoded += chunk.toString('binary');
      }
      i = end + 9;
    }
    expect(decoded).toContain('NotoSans');
    // Evidence hash is 64× 'e' → U+0065 appears in ToUnicode; Polish ó from Józef.
    expect(decoded.toLowerCase()).toContain('0065');
    expect(decoded.toLowerCase()).toContain('00f3');
    expect(decoded).toContain(' Tj');
  });
});
