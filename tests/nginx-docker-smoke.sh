#!/usr/bin/env bash
# tests/nginx-docker-smoke.sh
#
# Smoke tests for nginx.conf and the docker-compose files. Safe to run
# locally, in CI, or on the NAS as a pre-deploy sanity check. Never mutates
# production data and never deploys anything -- it only validates config
# syntax and, if a Docker daemon is actually reachable, spins up a
# throwaway container on a scratch port to curl-check it, then tears it
# down again.
#
# Usage: bash tests/nginx-docker-smoke.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0
FAIL=0

check() {
  local description="$1"
  shift
  if "$@" > /tmp/smoke-test-output.$$ 2>&1; then
    echo "PASS: $description"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $description"
    sed 's/^/    /' /tmp/smoke-test-output.$$
    FAIL=$((FAIL + 1))
  fi
  rm -f /tmp/smoke-test-output.$$
}

echo "== nginx config syntax =="
if command -v nginx > /dev/null 2>&1; then
  WORKDIR=$(mktemp -d)
  mkdir -p "$WORKDIR/conf.d" "$WORKDIR/snippets" "$WORKDIR/logs"
  cp nginx-security-headers.conf "$WORKDIR/snippets/security-headers.conf"
  sed "s#/etc/nginx/snippets/security-headers.conf#$WORKDIR/snippets/security-headers.conf#g; s#root /usr/share/nginx/html;#root $PWD;#; s#listen 80;#listen 18888;#" nginx.conf > "$WORKDIR/conf.d/app.conf"
  cat > "$WORKDIR/main.conf" <<EOF
worker_processes 1;
error_log $WORKDIR/logs/error.log;
pid $WORKDIR/nginx.pid;
events { worker_connections 32; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log $WORKDIR/logs/access.log;
  include $WORKDIR/conf.d/*.conf;
}
EOF
  check "nginx -t against nginx.conf + nginx-security-headers.conf" nginx -t -c "$WORKDIR/main.conf"
  rm -rf "$WORKDIR"
else
  echo "SKIP: nginx binary not found on PATH (install nginx or nginx-light to run this check)"
fi

echo ""
echo "== docker compose config validation =="
if command -v docker > /dev/null 2>&1 && docker compose version > /dev/null 2>&1; then
  check "docker compose config (base only)" docker compose -f docker-compose.yml config
  check "docker compose config (base + nas override merged)" docker compose -f docker-compose.yml -f docker-compose.nas.yml config
else
  echo "SKIP: docker compose CLI not available"
fi

echo ""
echo "== live container smoke test (only if a Docker daemon is reachable) =="
if command -v docker > /dev/null 2>&1 && docker info > /dev/null 2>&1; then
  SCRATCH_PORT=18099
  CONTAINER_NAME="ihavemoney-smoke-test-$$"
  cleanup() { docker rm -f "$CONTAINER_NAME" > /dev/null 2>&1 || true; }
  trap cleanup EXIT

  docker run -d --name "$CONTAINER_NAME" \
    -p "${SCRATCH_PORT}:80" \
    -v "$PWD:/usr/share/nginx/html:ro" \
    -v "$PWD/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
    -v "$PWD/nginx-security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro" \
    nginx:alpine > /dev/null

  sleep 2

  check "container serves index.html (200)" bash -c "[ \"\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:${SCRATCH_PORT}/index.html)\" = '200' ]"
  check "container blocks .git access (404)" bash -c "[ \"\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:${SCRATCH_PORT}/.git/config)\" = '404' ]"
  check "container blocks README.md (404)" bash -c "[ \"\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:${SCRATCH_PORT}/README.md)\" = '404' ]"
  check "index.html has no-cache header" bash -c "curl -s -D - -o /dev/null http://localhost:${SCRATCH_PORT}/index.html | grep -qi 'cache-control: no-cache'"
  check "security headers present" bash -c "curl -s -D - -o /dev/null http://localhost:${SCRATCH_PORT}/index.html | grep -qi 'x-content-type-options: nosniff'"

  cleanup
  trap - EXIT
else
  echo "SKIP: no reachable Docker daemon -- config-only validation above still applies. Run this script on a host with Docker (CI runner or the NAS itself, against a throwaway port) to exercise the live-container checks."
fi

echo ""
echo "== Summary: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
