#!/usr/bin/env bash
# Runs the k6 load test against a production API image, pinned to the size of
# the Fly.io machine it runs on (1 shared vCPU, 512 MB).
#
#   bench/run.sh <label> <api-image>      e.g. bench/run.sh before questlog-api:main
#
# Needs: the dev Postgres (docker compose -f docker-compose.dev.yml up -d db)
# seeded with bench/seed.sql into the questlog_bench database, and
# bench/out/tokens.json from bench/mint-tokens.cjs.
set -euo pipefail
cd "$(dirname "$0")"

LABEL=${1:?label}
IMAGE=${2:?api image}
NET=questlog_bench
SECRET=${BENCH_JWT_SECRET:?set BENCH_JWT_SECRET}
VUS=${VUS:-20}
DURATION=${DURATION:-60s}

docker network create "$NET" >/dev/null 2>&1 || true
docker rm -f ql-bench-api >/dev/null 2>&1 || true
docker run -d --name ql-bench-api --network "$NET" --cpus=1 --memory=512m \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://questlog:questlog@host.docker.internal:5432/questlog_bench \
  -e JWT_SECRET="$SECRET" \
  "$IMAGE" >/dev/null

until docker run --rm --network "$NET" curlimages/curl:8.10.1 -sf http://ql-bench-api:3001/health >/dev/null 2>&1; do
  sleep 1
done

k6() {
  docker run --rm --network "$NET" -v "$PWD:/bench" \
    -e BASE_URL=http://ql-bench-api:3001 -e VUS="$VUS" "$@" \
    grafana/k6:0.54.0 run --quiet /bench/load.js
}

echo "warm-up…"
k6 -e USERS=mixed -e DURATION=15s -e RESULT_NAME="warmup" >/dev/null
for pool in power mixed; do
  echo "$LABEL / $pool: $VUS VUs for $DURATION"
  k6 -e USERS="$pool" -e DURATION="$DURATION" -e RESULT_NAME="$LABEL-$pool"
done

docker stats --no-stream --format '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}}' ql-bench-api
docker rm -f ql-bench-api >/dev/null
