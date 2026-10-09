#!/usr/bin/env bash
# usage: j.sh [-X METHOD] PATH [curl args]  -> prints status line + body (read-only use only)
CLOUD=${JIRA_CLOUD_ID:?set JIRA_CLOUD_ID}
M=GET; if [ "$1" = "-X" ]; then M=$2; shift 2; fi
P=$1; shift
curl -sS -X "$M" -u "${JIRA_EMAIL:?set JIRA_EMAIL}:${JIRA_API_TOKEN:?set JIRA_API_TOKEN}" -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -D /tmp/jhdr -o /tmp/jbody "https://api.atlassian.com/ex/jira/$CLOUD/rest/api/3/$P" "$@"
echo "HTTP $(head -1 /tmp/jhdr | awk '{print $2}')  $(grep -i -E '^(x-ratelimit|ratelimit|beta-ratelimit|retry-after)' /tmp/jhdr | tr -d '\r' | tr '\n' ' ')"
cat /tmp/jbody; echo
