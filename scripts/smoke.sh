#!/usr/bin/env bash
set -euo pipefail
export BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
python3 - <<'PY'
import json
import os
from urllib.request import urlopen

base = os.environ['BASE_URL'].rstrip('/')
def get(path):
    with urlopen(base + path, timeout=60) as response:
        return json.load(response)
health = get('/api/health')
assert health['data_ready'], health
meta = get('/api/meta')
assert meta['gate_closure']['local_time'] == '09:50', meta
assert meta['purchase_period'] == {'from': '2026-01-01', 'to': '2026-01-31'}, meta
for delivery, buying in [('2026-01-02', '2026-01-01'), ('2026-02-01', '2026-01-31')]:
    view = get('/api/decision?date=' + delivery)
    assert view['purchase_date'] == buying, view
    assert view['forecast_summary']['hours'] == 24, view
    assert all(p['forecast_publish_time'] <= view['gate_closure'] for p in view['periods'])
accuracy = get('/api/accuracy?from=2026-01-02&to=2026-02-01')
assert accuracy['summary']['n'] == 744, accuracy['summary']
for path in ['/', '/accuracy', '/methodology']:
    with urlopen(base + path, timeout=60) as response:
        assert b'<div id="root">' in response.read(), path
print('Smoke passed: January boundaries, forecast timing, 744 hourly pairs, all SPA routes.')
print('MAE:', accuracy['summary']['mae_mw'], 'MW; bias:', accuracy['summary']['bias_mw'], 'MW')
PY
