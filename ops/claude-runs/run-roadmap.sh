#!/usr/bin/env bash
set -u
LOG=/workspace/radrly/accessradar/claude-runs/roadmap-$(date +%Y%m%d-%H%M).log
[ -d /workspace/radrly/accessradar/work-roadmap ] || git clone https://github.com/therealnowaczek/accessradar.git /workspace/radrly/accessradar/work-roadmap
cd /workspace/radrly/accessradar/work-roadmap || exit 1
(cd /workspace/radrly/accessradar/work-phase1-fixes && ls -a | grep -q "^.env" ) && cp -n /workspace/radrly/accessradar/work-phase1-fixes/.env* . 2>/dev/null
[ -d node_modules ] || npm ci >/dev/null 2>&1
# wait for the phase 0/1 prod release (PR #60 merged), max 90 min
for i in $(seq 1 90); do
  st=$(gh pr view 60 --repo therealnowaczek/accessradar --json state -q .state 2>/dev/null)
  [ "$st" = "MERGED" ] && break
  sleep 60
done
git fetch origin && git checkout main && git reset --hard origin/main
echo "start $(date) pr60=$st" >> "$LOG"
claude -p "$(cat /workspace/radrly/accessradar/claude-prompts/roadmap-rest.md)" --model claude-sonnet-5-5 --dangerously-skip-permissions >> "$LOG" 2>&1
echo "end $(date) rc=$?" >> "$LOG"
