/** Site-wide signature chain: each signed review links to the previous evidence hash. */

export type ChainLink = {
  id: string;
  chainSeq: number;
  evidenceHash: string;
  prevReviewHash: string | null;
};

export type ChainLinkResult = {
  chainSeq: number;
  id: string;
  ok: boolean;
  reason?: string;
};

export type ChainVerifyResult = {
  ok: boolean;
  length: number;
  brokenAt?: number;
  reason?: string;
  links: ChainLinkResult[];
};

/** Walk links ordered by chain_seq. First may point at a pre-chain signed hash. */
export function walkChain(links: ChainLink[]): ChainVerifyResult {
  if (!links.length) return { ok: true, length: 0, links: [] };
  const results: ChainLinkResult[] = [];
  for (let i = 0; i < links.length; i++) {
    const cur = links[i];
    if (i === 0) {
      if (cur.chainSeq !== 1) {
        const reason = `expected chain #1, got #${cur.chainSeq}`;
        results.push({ chainSeq: cur.chainSeq, id: cur.id, ok: false, reason });
        return { ok: false, length: links.length, brokenAt: cur.chainSeq, reason, links: results };
      }
      results.push({ chainSeq: cur.chainSeq, id: cur.id, ok: true });
      continue;
    }
    const prev = links[i - 1];
    if (cur.chainSeq !== prev.chainSeq + 1) {
      const reason = `sequence gap: expected #${prev.chainSeq + 1}, got #${cur.chainSeq}`;
      results.push({ chainSeq: cur.chainSeq, id: cur.id, ok: false, reason });
      return { ok: false, length: links.length, brokenAt: cur.chainSeq, reason, links: results };
    }
    if (cur.prevReviewHash !== prev.evidenceHash) {
      const reason = 'previous hash does not match prior evidence hash';
      results.push({ chainSeq: cur.chainSeq, id: cur.id, ok: false, reason });
      return { ok: false, length: links.length, brokenAt: cur.chainSeq, reason, links: results };
    }
    results.push({ chainSeq: cur.chainSeq, id: cur.id, ok: true });
  }
  return { ok: true, length: links.length, links: results };
}

/** Detect MySQL / Forge duplicate-key errors for chain_seq unique index retries. */
export function isDuplicateKey(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e);
  const code = String((e as { code?: string })?.code ?? '');
  return (
    /duplicate/i.test(msg) ||
    code === 'ER_DUP_ENTRY' ||
    code === '1062' ||
    msg.includes('1062')
  );
}
