"""Minimal Jira REST helper (modelled on /workspace/mr-assets/jira.py). Token from JIRA_API_TOKEN or JIRA_WRITE_TOKEN (never printed)."""
import os, time
import requests

BASE = os.environ.get('JIRA_BASE', 'https://marginradar.atlassian.net')
EMAIL = os.environ.get('JIRA_EMAIL', 'marcin@radrly.com')
S = requests.Session()
S.headers.update({'Accept': 'application/json', 'Content-Type': 'application/json'})
_last = [0.0]


def connect():
    S.auth = (EMAIL, os.environ.get('JIRA_API_TOKEN') or os.environ['JIRA_WRITE_TOKEN'])


def req(method, path, **kw):
    for attempt in range(8):
        dt = time.time() - _last[0]
        if dt < 0.25: time.sleep(0.25 - dt)
        _last[0] = time.time()
        r = S.request(method, BASE + path, timeout=60, **kw)
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(min(float(r.headers.get('Retry-After', 2 ** attempt)), 60)); continue
        return r
    return r


def j(method, path, **kw):
    r = req(method, path, **kw)
    if r.status_code >= 400: raise Exception(f'{method} {path} -> {r.status_code}: {r.text[:300]}')
    return r.json() if r.text else None
