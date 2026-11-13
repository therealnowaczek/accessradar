#!/usr/bin/env bash
set -u
cd /workspace/radrly/accessradar/work-roadmap || exit 1
for attempt in 1 2 3 4 5 6; do
  LOG=/workspace/radrly/accessradar/claude-runs/roadmap-$(date +%Y%m%d-%H%M).log
  echo "resume start $(date) attempt=$attempt" >> "$LOG"
  claude -p "RESUME: you were interrupted by a usage limit. Do NOT reset the clone; continue from the current branch/working tree and from /workspace/radrly/accessradar/claude-runs/STATUS.md (keep it updated). Original instructions follow.

$(cat /workspace/radrly/accessradar/claude-prompts/roadmap-rest.md)" --model claude-sonnet-5-5 --dangerously-skip-permissions >> "$LOG" 2>&1
  echo "end $(date) rc=$?" >> "$LOG"
  if grep -q "hit your .*limit" "$LOG"; then sleep 3600; continue; fi
  break
done
