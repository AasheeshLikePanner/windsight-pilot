#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"

echo "Checking ${BASE_URL}/api/health"
curl --fail --silent --show-error "${BASE_URL}/api/health" | python3 -m json.tool

echo "Checking ${BASE_URL}/api/meta"
curl --fail --silent --show-error "${BASE_URL}/api/meta" | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print('period', d['period'], 'counts', d['counts'])"

echo "Checking ${BASE_URL}/api/decision?date=2026-01-15"
curl --fail --silent --show-error "${BASE_URL}/api/decision?date=2026-01-15" | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print('decision', d['date'], 'n', d['summary']['n'], 'vintage', d['vintage']['publish_time'])"

echo "Checking ${BASE_URL}/api/accuracy?from=2026-01-01&to=2026-01-31"
curl --fail --silent --show-error "${BASE_URL}/api/accuracy?from=2026-01-01&to=2026-01-31" | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print('accuracy n', d['summary']['n'], 'mae', d['summary']['mae_mw'], 'bias', d['summary']['bias_mw'])"

echo "Checking SPA route"
curl --fail --silent --show-error -o /dev/null "${BASE_URL}/accuracy"

echo "Smoke test passed."
