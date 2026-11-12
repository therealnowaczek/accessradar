import type { Changes, Coverage, Limitations, ReviewDetail, Snapshot } from '../api';
import { timeZone } from '../format';
import { changesRows, APP_VERSION, MATRIX_COLUMNS, type ExportContext } from './evidence';
import type { EvidencePackPayload } from './evidencePack';

/** Bump when a field is removed or changes meaning. Adding fields keeps the version. */
export const JSON_SCHEMA_VERSION = 1;
export const JSON_SCHEMA_ID = 'accessradar-export';

export type JsonKind = 'access-matrix' | 'changes' | 'review' | 'evidence-pack';

const iso = (ms: number | null | undefined): string | null =>
  ms ? new Date(ms).toISOString() : null;

function envelope(kind: JsonKind, ctx: ExportContext) {
  return {
    schema: JSON_SCHEMA_ID,
    schemaVersion: JSON_SCHEMA_VERSION,
    kind,
    generatedBy: { app: 'AccessRadar', version: APP_VERSION, readOnly: true },
    site: ctx.siteUrl ?? null,
    exportedAt: new Date(ctx.now ?? Date.now()).toISOString(),
    timeZone: ctx.tz ?? timeZone(),
  };
}

function snapshotRef(s: Snapshot | null | undefined) {
  if (!s) return null;
  return {
    seq: s.seq,
    status: s.status,
    capturedAt: iso(s.startedAt),
    engineVersion: s.engineVersion,
    contentHash: s.contentHash ?? null,
  };
}

function limitationsBlock(coverage: Coverage[], limitations?: Limitations | null) {
  return {
    limitations: limitations
      ? {
          version: limitations.version,
          completeness: limitations.completeness,
          label: limitations.label,
          statements: limitations.statements,
        }
      : null,
    coverage: coverage.map((c) => ({
      status: c.status,
      area: c.area,
      target: c.target,
      reason: c.reason,
    })),
  };
}

export const jsonFileName = (base: string) => base.replace(/\.[a-z]+$/, '') + '.json';

export function serializeJson(doc: unknown): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

// ---------- access matrix ----------
export function matrixJson(
  snapshot: Snapshot,
  rows: Array<Record<string, string>>,
  ctx: ExportContext = {},
  risks: Array<{
    id: string;
    severity: string;
    title: string;
    count: number;
    partial?: boolean;
  }> = [],
  coverage: Coverage[] = [],
  limitations?: Limitations | null,
) {
  return {
    ...envelope('access-matrix', ctx),
    snapshot: snapshotRef(snapshot),
    ...limitationsBlock(coverage, limitations),
    columns: MATRIX_COLUMNS,
    rows: rows.map((r) => {
      const out: Record<string, string | number | boolean | null> = {};
      for (const c of MATRIX_COLUMNS) out[c] = r[c] ?? null;
      out.snapshot_id = snapshot.seq;
      out.captured_at_utc = iso(snapshot.startedAt);
      out.active = r.active === 'yes' ? true : r.active === 'no' ? false : null;
      return out;
    }),
    risks: risks.map((r) => ({
      id: r.id,
      severity: r.severity,
      title: r.title,
      count: r.count,
      partial: Boolean(r.partial),
    })),
  };
}

// ---------- changes ----------
export function changesJson(c: Changes, ctx: ExportContext = {}) {
  return {
    ...envelope('changes', ctx),
    snapshotA: snapshotRef(c.a),
    snapshotB: snapshotRef(c.b),
    keyPermissions: c.keyPermissions,
    rows: changesRows(c),
  };
}

// ---------- review ----------
export function reviewJson(d: ReviewDetail, ctx: ExportContext = {}) {
  const r = d.review;
  return {
    ...envelope('review', ctx),
    review: {
      id: r.id,
      name: r.name,
      status: r.status,
      scope: { type: r.scope.type, ids: r.scope.ids, labels: r.scopeLabels },
      keyPermissions: r.keyPermissions,
      engineVersion: r.engineVersion,
      createdAt: iso(r.createdAt),
      dueAt: iso(r.dueAt),
      itemCount: r.itemCount,
      signature:
        r.status === 'signed'
          ? {
              signedBy: r.signedBy,
              signedByName: r.signedByName,
              signedAt: iso(r.signedAt),
              signerTz: r.signerTz,
              evidenceHash: r.evidenceHash ?? null,
              signatureVersion: r.signatureVersion ?? 1,
              chainSeq: r.chainSeq ?? null,
              prevReviewHash: r.prevReviewHash ?? null,
            }
          : null,
    },
    baseSnapshot: snapshotRef(d.base),
    compareSnapshot: snapshotRef(d.compare),
    ...limitationsBlock(d.coverage, d.limitations),
    items: d.items.map((i) => ({
      itemKey: i.itemKey,
      subjectType: i.subjectType,
      subjectId: i.subjectId,
      displayName: i.subject.name,
      projectKey: i.project?.key ?? null,
      groupName: i.groupName,
      permissions: i.permissions,
      path: i.reasons,
      pathCodes: i.pathCodes,
      change: i.change,
      decision: i.decision,
      note: i.note,
      expiresAt: iso(i.expiresAt ?? null),
      decidedBy: i.decidedBy,
      decidedAt: iso(i.decidedAt),
    })),
  };
}

// ---------- evidence pack (Advanced) ----------
export function evidencePackJson(
  pack: EvidencePackPayload,
  allItems: EvidencePackPayload['items'],
  ctx: ExportContext = {},
) {
  const h = pack.header;
  const s = pack.sections;
  return {
    ...envelope('evidence-pack', ctx),
    header: {
      reviewId: h.reviewId,
      name: h.name,
      scope: h.scope,
      baseSnapshot: h.base
        ? {
            seq: h.base.seq,
            contentHash: h.base.contentHash,
            capturedAt: iso(h.base.startedAt),
          }
        : null,
      compareSnapshot: h.compare
        ? {
            seq: h.compare.seq,
            contentHash: h.compare.contentHash,
            capturedAt: iso(h.compare.startedAt),
          }
        : null,
      signedBy: h.signedBy,
      signedAt: iso(h.signedAt),
      signerTz: h.signerTz,
      evidenceHash: h.evidenceHash,
      signatureVersion: h.signatureVersion,
      coverageHash: h.coverageHash,
      chainSeq: h.chainSeq ?? null,
      prevReviewHash: h.prevReviewHash ?? null,
      engineVersion: h.engineVersion,
      attestation: h.attestation,
      itemCount: h.itemCount,
    },
    sections: s
      ? {
          methodology: s.methodology,
          limitations: s.limitations,
          coverage: s.coverage,
          summary: s.summary,
          controls: s.controls,
          exceptions: s.exceptions.map((e) => ({ ...e, expiresAt: iso(e.expiresAt) })),
          remediation: s.remediation,
          audit: s.audit.map((a) => ({ ...a, at: iso(a.at) })),
        }
      : null,
    items: allItems.map((i) => ({
      itemKey: i.itemKey,
      subjectType: i.subjectType,
      subjectId: i.subjectId,
      projectId: i.projectId,
      groupId: i.groupId,
      permissions: i.permissions,
      change: i.change,
      decision: i.decision,
      note: i.note,
      expiresAt: iso(i.expiresAt ?? null),
    })),
  };
}
