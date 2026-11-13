#!/usr/bin/env bash
set -u
export PATH="$HOME/.local/bin:$PATH"
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0

ROOT=/workspace/radrly/accessradar
CLONE="$ROOT/work-roadmap"
PROMPT="$ROOT/claude-prompts/citems.md"
RUNS="$ROOT/claude-runs"
DONE="$RUNS/C-ITEMS-DONE"

if [ -z "${CITEMS_LOG:-}" ]; then
  CITEMS_LOG="$RUNS/citems-$(date +%Y%m%d-%H%M).log"
fi
export CITEMS_LOG
ln -sfn "$(basename "$CITEMS_LOG")" "$RUNS/citems-latest.log"

log() { printf '%s\n' "$*" | tee -a "$CITEMS_LOG"; }

if [ ! -x "$(command -v claude)" ] || [ ! -x "$(command -v forge)" ]; then
  log "ERROR: claude or forge not on PATH at $(date). which: $(command -v claude) $(command -v forge)"
  exit 1
fi
if [ ! -d "$CLONE/.git" ]; then
  log "ERROR: work clone missing: $CLONE"
  exit 1
fi
if [ ! -f "$PROMPT" ]; then
  log "ERROR: prompt missing: $PROMPT"
  exit 1
fi
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  log "ERROR: CLAUDE_CODE_OAUTH_TOKEN is not set"
  exit 1
fi

# Forge auth for any wrapper-side checks; never print the file.
if [ -f /home/box/.config/radrly/atlassian.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /home/box/.config/radrly/atlassian.env
  set +a
fi

cd "$CLONE" || exit 1

if [ ! -d node_modules ]; then
  log "npm ci start $(date)"
  if ! npm ci >>"$CITEMS_LOG" 2>&1; then
    log "WARN: npm ci failed $(date); Claude will retry if needed"
  else
    log "npm ci done $(date)"
  fi
fi

MAX_TRIES=16
for attempt in $(seq 1 "$MAX_TRIES"); do
  if [ -f "$DONE" ]; then
    log "C-ITEMS-DONE present, stopping $(date)"
    break
  fi

  log "===== citems start $(date) attempt=$attempt pid=$$ ====="
  log "claude=$(command -v claude) forge=$(command -v forge) cwd=$CLONE"
  start_line=$(wc -l < "$CITEMS_LOG")

  if [ "$attempt" -eq 1 ] && [ ! -f "$RUNS/citems-resume.flag" ]; then
    PROMPT_TEXT="$(cat "$PROMPT")"
  else
    PROMPT_TEXT="RESUME: you were interrupted (usage limit or process stop). Do NOT reset the clone, do NOT checkout main, do NOT git reset --hard, do NOT discard uncommitted work. Continue from the current branch/working tree and from /workspace/radrly/accessradar/claude-runs/STATUS.md (keep it updated). Skip items already marked ready for prod, skipped, or needs Marcin tak. Original instructions follow.

$(cat "$PROMPT")"
  fi

  claude -p "$PROMPT_TEXT" --model claude-sonnet-5-5 --dangerously-skip-permissions >>"$CITEMS_LOG" 2>&1
  rc=$?
  log "===== citems end $(date) attempt=$attempt rc=$rc ====="

  if [ -f "$DONE" ]; then
    log "C-ITEMS-DONE written, finished $(date)"
    break
  fi

  # Only inspect this attempt's log slice, so an earlier usage-limit line is not reused.
  slice=$(tail -n +"$((start_line + 1))" "$CITEMS_LOG" 2>/dev/null || true)
  if printf '%s\n' "$slice" | grep -Eqi 'hit your .*limit|usage limit|limit reached'; then
    touch "$RUNS/citems-resume.flag"
    log "usage limit detected, sleeping 3600s then resume from STATUS.md"
    sleep 3600
    continue
  fi

  if [ "$rc" -eq 0 ]; then
    log "claude exited 0 without C-ITEMS-DONE; not looping automatically. Touch citems-resume.flag and rerun the wrapper to resume."
    break
  fi

  touch "$RUNS/citems-resume.flag"
  log "non-zero exit and no usage-limit match, sleeping 60s then resume (attempt $attempt/$MAX_TRIES)"
  sleep 60
done

log "wrapper exit $(date) done-file=$([ -f "$DONE" ] && echo yes || echo no)"
