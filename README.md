# Security Center

**ASPM-lite** catalog + quality gate. Catalog applications and services, reconcile scanner Issues with ownership, and enforce a CI quality gate — without replacing SonarQube. Scanners are inputs; Security Center owns catalog, Issues, scores, and the gate.

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js (App Router) + TypeScript |
| UI | Tailwind + shadcn/ui |
| DB | PostgreSQL + Prisma |
| Auth | Auth.js OIDC + bootstrap admin |
| Worker | `packages/worker` — export jobs only |
| Jobs | Postgres `FOR UPDATE SKIP LOCKED` (no Redis in V1) |
| CI | One `curl \| bash` → `GET /api/v1/ci/scan.sh` with `SC_TOKEN` |

**V1 tools** (run on the CI runner, enabled per app/service in the UI): gitleaks, npm audit, pip-audit, Trivy (fs), semgrep.

No host agent. No server-side clone/scan. Teams replace prior scanner steps with the curl; which tools run is configured in the UI.

## Quickstart

### 1. Start with Docker Compose

```bash
cp .env.example .env   # when present; otherwise set the vars below
docker compose up -d
```

Typical services: app, Postgres, and the export worker.

### 2. Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_*` / OIDC | Auth.js OIDC provider settings |
| `BOOTSTRAP_ADMIN_EMAIL` | First admin (matched on OIDC login) |
| `SC_URL` | Base URL of Security Center (used by CI) |
| `SC_TOKEN` | Service token for CI (`Authorization: Bearer …`) |

Exact names may match Auth.js conventions in the app config once scaffolded.

### 3. One-curl CI snippet

In your pipeline (after checkout), set `SC_URL` and `SC_TOKEN`, then:

```bash
curl -fsSL -H "Authorization: Bearer $SC_TOKEN" \
  "$SC_URL/api/v1/ci/scan.sh" | bash
```

Internally: probe → fetch enabled tools → install/run on the CI runner → ingest → quality gate (exit 0/1). Execution stays on the runner, never on the Security Center host.

## Roles (V1)

| Process | Responsibility |
|---------|----------------|
| **App** | Catalog, tool toggles, Issues, score/gate, `scan.sh`, reconcile ingest, enqueue exports |
| **Worker** | `export.issues` (CSV/JSON) |
| **CI** | `scan.sh`: probe → run **enabled** tools → ingest → gate |

## License

See [LICENSE](LICENSE).
