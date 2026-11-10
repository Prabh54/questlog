# Load test

Measures the API under concurrent page loads on a large, realistic dataset.
Results and method: [docs/performance.md](../docs/performance.md).

| File | What it does |
|---|---|
| `seed.sql` | 1.3M completions across 2,000 users (100 with 3 years of history), generated inside Postgres in ~1 min |
| `mint-tokens.cjs` | Signs an access token for every bench user, so the test doesn't measure login |
| `load.js` | k6 scenario: virtual users open random pages and fire each page's API calls in parallel |
| `run.sh` | Runs a production API image pinned to 1 vCPU / 512 MB, warms up, then tests power users and a mixed population |
| `report.py` | Prints p50/p95 per page and endpoint, and before/after comparisons |

Output goes to `bench/out/` (git-ignored). Steps are in docs/performance.md.
