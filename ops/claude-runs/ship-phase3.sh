#!/usr/bin/env bash
cd /workspace/radrly/accessradar/work-roadmap || exit 1
for attempt in 1 2 3 4 5 6; do
  LOG=/workspace/radrly/accessradar/claude-runs/ship3-$(date +%Y%m%d-%H%M).log
  echo "start $(date) attempt=$attempt" >> "$LOG"
  P="$(cat /workspace/radrly/accessradar/claude-prompts/ship-phase3.md)"
  [ $attempt -gt 1 ] && P="RESUME after a usage limit: continue from the current state and STATUS.md, do not redo finished steps.

$P"
  claude -p "$P" --model claude-sonnet-5-5 --dangerously-skip-permissions >> "$LOG" 2>&1
  echo "end $(date) rc=$?" >> "$LOG"
  grep -q "hit your .*limit" "$LOG" && { sleep 1800; continue; }
  break
done
