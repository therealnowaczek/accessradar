#!/usr/bin/env node
/**
 * Cursor project hook: lint one edited source file and report findings.
 *
 * Schema: https://cursor.com/docs/hooks (version 1). Project hooks run from
 * the repo root. Stdin is a JSON object. Every event also includes
 * conversation_id, generation_id, hook_event_name, cursor_version,
 * workspace_roots, and optional user_email / transcript_path.
 *
 * afterFileEdit input (hook-specific): { file_path, edits: [{ old_string, new_string }] }
 * The official reference does not define an afterFileEdit output schema (the
 * edit has already happened). This script still prints JSON. `additional_context`
 * is the field postToolUse and sessionStart use to inject text the agent sees.
 *
 * stop input: { status: "completed" | "aborted" | "error", loop_count }
 * stop output: { followup_message?: string } and only when a prior afterFileEdit
 * left a failure. loop_limit on the hook caps how often Cursor will auto-send it.
 *
 * Non-source files return immediately. Missing node_modules exits 0 with `{}`.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';

const LINT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const CLIP = 3500;

function projectRoot() {
  const fromEnv = process.env.CURSOR_PROJECT_DIR;
  if (fromEnv) return resolve(fromEnv);
  return resolve(import.meta.dirname, '..');
}

function cachePath(root) {
  const id = createHash('sha1').update(root).digest('hex').slice(0, 12);
  return join(tmpdir(), `accessradar-cursor-lint-${id}.json`);
}

function readStdin() {
  return new Promise((resolveText) => {
    if (process.stdin.isTTY) {
      resolveText('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolveText(data));
    process.stdin.on('error', () => resolveText(''));
  });
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function clip(text) {
  const value = (text || '').trim();
  if (value.length <= CLIP) return value;
  return `${value.slice(0, CLIP)}\n… (truncated)`;
}

function readCache(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && parsed.conversations) return parsed;
  } catch {
    // Missing or unreadable cache: start over.
  }
  return { conversations: {} };
}

function writeCache(file, store) {
  try {
    mkdirSync(tmpdir(), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(store));
    renameSync(tmp, file);
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error ? error.message : '';
    console.error(`[cursor-lint] could not write cache${message ? `: ${message}` : ''}`);
  }
}

function conversation(store, id) {
  const key = id || 'default';
  if (!store.conversations[key]) store.conversations[key] = { reminded: false, files: {} };
  const keys = Object.keys(store.conversations);
  if (keys.length > 10) {
    for (const old of keys.slice(0, keys.length - 10)) delete store.conversations[old];
  }
  return store.conversations[key];
}

function relativeFile(root, filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  const abs = resolve(filePath);
  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;
  const normalized = rel.split('\\').join('/');
  if (normalized.includes('node_modules/')) return null;
  return normalized;
}

function depsReady(root) {
  return (
    existsSync(join(root, 'node_modules', 'eslint', 'bin', 'eslint.js')) &&
    existsSync(join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs'))
  );
}

function run(root, bin, args) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 25_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (result.error) {
    const message =
      result.error && typeof result.error === 'object' && 'message' in result.error
        ? result.error.message
        : 'lint process failed';
    return { ok: false, output: message };
  }
  return { ok: result.status === 0, output };
}

function lintFile(root, rel) {
  const eslintBin = join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
  const prettierBin = join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  const eslint = run(root, eslintBin, [
    '--max-warnings=0',
    '--no-warn-ignored',
    '--no-error-on-unmatched-pattern',
    rel,
  ]);
  const prettier = run(root, prettierBin, ['--check', rel]);
  const parts = [];
  if (!eslint.ok) parts.push(`ESLint (${rel}):\n${clip(eslint.output) || 'eslint failed'}`);
  if (!prettier.ok) parts.push(`Prettier (${rel}):\n${clip(prettier.output) || 'prettier failed'}`);
  if (parts.length === 0) return '';
  return `Lint failed for ${rel}. Fix these findings before the next edit.\n\n${parts.join('\n\n')}`;
}

function handleStop(payload, file) {
  if (payload.status && payload.status !== 'completed') {
    emit({});
    return;
  }
  const store = readCache(file);
  const entry = store.conversations[payload.conversation_id || 'default'];
  const files = entry && entry.files ? Object.entries(entry.files) : [];
  if (!entry || files.length === 0 || entry.reminded) {
    emit({});
    return;
  }
  entry.reminded = true;
  writeCache(file, store);
  const lines = files.slice(0, 8).map(([name, detail]) => {
    const preview = String(detail || '')
      .split('\n')
      .slice(0, 12)
      .join('\n');
    return `${name}\n${preview}`;
  });
  emit({
    followup_message: [
      'ESLint or Prettier is still failing on files edited in this session. Fix every finding, then finish.',
      '',
      lines.join('\n\n'),
      '',
      'Run `npx eslint <file>` and `npx prettier --check <file>` on each file, then `npm run check`.',
    ].join('\n'),
  });
}

async function main() {
  const raw = await readStdin();
  let payload = {};
  if (raw.trim()) {
    try {
      payload = JSON.parse(raw);
    } catch {
      emit({});
      return;
    }
  }
  const root = projectRoot();
  const cache = cachePath(root);
  const stop = process.argv.includes('--stop') || payload.hook_event_name === 'stop';
  if (stop) {
    handleStop(payload, cache);
    return;
  }

  const rel = relativeFile(root, payload.file_path);
  if (!rel || !LINT_EXT.has(extname(rel).toLowerCase()) || !existsSync(join(root, rel))) {
    emit({});
    return;
  }
  if (!depsReady(root)) {
    console.error('[cursor-lint] skipped (eslint or prettier is not installed)');
    emit({});
    return;
  }

  const finding = lintFile(root, rel);
  const store = readCache(cache);
  const entry = conversation(store, payload.conversation_id);
  if (finding) {
    entry.files[rel] = clip(finding);
    entry.reminded = false;
    const names = Object.keys(entry.files);
    if (names.length > 20) {
      for (const old of names.slice(0, names.length - 20)) delete entry.files[old];
    }
    writeCache(cache, store);
    console.error(`[cursor-lint] ${rel} failed`);
    emit({ additional_context: finding });
    return;
  }
  if (entry.files[rel]) {
    delete entry.files[rel];
    if (Object.keys(entry.files).length === 0) entry.reminded = false;
    writeCache(cache, store);
  }
  emit({});
}

main().catch((error) => {
  const message = error && typeof error === 'object' && 'message' in error ? error.message : '';
  console.error(`[cursor-lint] ${message || 'failed'}`);
  emit({});
  process.exit(0);
});
