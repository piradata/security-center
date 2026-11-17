# Security Center — Architecture & How It Works

This document describes the **V1** product as built: an **ASPM-lite** security catalog and quality gate. It is not a SonarQube replacement. Scanners are **inputs**; Security Center owns the catalog, Issues, ownership, scores, and the CI gate.

For a short quickstart, see [README.md](README.md). Deferred work lives in [TODO.md](TODO.md).

---

## 1. Positioning

| Security Center owns | Scanners / external tools own |
|----------------------|-------------------------------|
| Software catalog (applications → services) | Finding detection (secrets, SCA, SAST, …) |
| Normalized **Issues** + assignment | Tool-specific output formats |
| Dedup / reconciliation across scans | Running binaries on the CI runner |
| Quality score + quality gate | — |
| Export of issue reports | — |

**Product name:** Security Center.

---

## 2. High-level architecture

Three processes; no Redis, no host agent, no server-side clone/scan in V1.

```mermaid
flowchart LR
  UI[Nextjs_App] -->|enqueue export Job| DB[(Postgres)]
  CI[CI_curl_bash] -->|scan.sh ingest gate| UI
  Worker[Worker] -->|claim export Job| DB
  Worker -->|write Export file| Storage[Local_volume]
  UI -->|download| Storage
  UI -->|serve scan.sh| CI
```

| Process | Runs where | Responsibility |
|---------|------------|----------------|
| **App** | Security Center host | UI, API, plan/normalize/score, serve `scan.sh`, enqueue exports |
| **Worker** | Same Compose stack (`src/worker`) | `export_issues` jobs only (CSV/JSON) |
| **CI** | Customer pipeline | One `curl \| bash`; tools run **on the runner**, then results are uploaded |

**Ingest-first:** analysis always executes on the CI runner. The Security Center host does not clone repos or run scanners in V1.

---

## 3. Domain model

```mermaid
erDiagram
  Application ||--o{ Service : groups
  Application ||--o{ QualityGate : has
  Application ||--o{ AppToolConfig : toolDefaults
  Service ||--o{ ServiceToolConfig : toolOverrides
  Service ||--o{ Scan : has
  Scan ||--o{ Issue : reconciles
  Issue }o--|| Tool : from
  Issue }o--o| User : assigneeUser
  Tool ||--o{ AppToolConfig : configured
  Tool ||--o{ ServiceToolConfig : configured
  Job ||--o| Export : produces
```

### Core entities

| Entity | Role |
|--------|------|
| **Application** | Product / system grouping one or more services |
| **Service** | Deployable unit with a CI token and optional repo URL |
| **Tool** | Seeded scanner adapter (gitleaks, npm-audit, …) |
| **AppToolConfig** | Per-application default: tool enabled/disabled for pipeline |
| **ServiceToolConfig** | Per-service override of app defaults |
| **Scan** | One CI scan run for a service |
| **Issue** | Normalized finding (what the UI calls an issue) |
| **QualityGate** | Score threshold + “fail on new High/Critical” |
| **Job / Export** | Background export of issues to a downloadable file |
| **User** | Local account (email + password); Issues assign to a **user** only in V1 |

### Issue vs repo ticket

| Term | Meaning |
|------|---------|
| **Issue** | Finding stored in Security Center |
| **Repo ticket** | GitHub/GitLab/etc. issue opened *from* an Issue — **V2** |

---

## 4. Per-app / per-service tool configuration

1. V1 tools are seeded in the DB.
2. **Application** sets default enable/disable per tool (“run in pipeline”).
3. **Service** may override those defaults.
4. **Effective config** = app defaults ⊕ service overrides.
5. `scan.sh` asks the API for the effective set for that service token and only installs/runs those tools (plus adapter `detect`, so e.g. pip-audit skips if there is no Python project even when enabled).

There is no generic “paste any command” tool configurator in V1.

---

## 5. CI handshake (one curl)

Pipeline authors paste a single command. `SC_TOKEN` identifies the service.

```bash
curl -fsSL -H "Authorization: Bearer $SC_TOKEN" \
  "$SC_URL/api/v1/ci/scan.sh" | bash
```

Exit code of that step **is** the quality gate (0 = pass, non-zero = fail).

### Code coverage upload

Code coverage is **display-only** in V1 and does not affect the gate. After tests, a pipeline can upload a summary:

```bash
curl -fsSL -X POST \
  -H "Authorization: Bearer $SC_TOKEN" \
  -H 'Content-Type: application/json' \
  "$SC_URL/api/v1/ci/coverage" \
  -d '{"line":85.4,"branch":72.1,"function":90.0,"source":"vitest"}'
```

The endpoint is authenticated with the same service bearer token. Coverage attaches to the latest scan for the service and is shown on the dashboard and in the catalog.

### What `scan.sh` does internally

```mermaid
sequenceDiagram
  participant CI as CI_Runner
  participant API as SecurityCenter_API
  participant Tools as Local_Tools

  CI->>API: GET /api/v1/ci/scan.sh with SC_TOKEN
  API-->>CI: orchestrator shell script
  CI->>CI: probe env stack and tool versions
  CI->>API: POST /api/v1/ci/plan
  API-->>CI: enabled tools install and run steps
  CI->>Tools: install if needed and run
  CI->>API: POST /api/v1/ci/ingest per tool result
  CI->>API: GET /api/v1/ci/gate
  API-->>CI: pass or fail
  CI->>CI: exit accordingly
```

Internal endpoints (used by the script / not meant for hand-written pipelines):

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/ci/scan.sh` | Authenticated orchestrator script |
| `POST /api/v1/ci/plan` | Probe → enabled tools + commands |
| `POST /api/v1/ci/ingest` | Upload tool output → reconcile Issues |
| `GET /api/v1/ci/gate` | Evaluate gate for the scan |

Service tokens are shown **once** at create/rotate; only a hash is stored.

---

## 6. Issue reconciliation

Findings are matched by **fingerprint** per service (stable id from tool + rule + package/CVE/path/etc.).

| Situation | Action |
|-----------|--------|
| Fingerprint still present | Update same Issue (`lastSeenAt`, location/severity); **no duplicate** |
| Fingerprint new | Create Issue `open` |
| Fingerprint gone (was open / in_progress) | Status → `absent` (history kept) |
| Returns after `resolved` or `absent` | **Regression**: reopen `open`, record regression |
| `suppressed` | Stays suppressed until cleared manually (no auto-reopen in V1) |

Reconciliation is **tool-scoped** within a scan: ingesting gitleaks results must not mark npm-audit Issues `absent`.

### Statuses (V1)

`open` · `triaged` · `in_progress` · `resolved` · `suppressed` · `absent`

### Assignment

`assigneeUserId` only. Teams are V2.

---

## 7. Scoring and quality gate

- **Service score:** start at 100; subtract fixed weights for open / in_progress Issues by severity (floor 0).
- **Application score:** **minimum** of its service scores (one bad service fails the group).
- **Gate** fails if:
  - score &lt; configured threshold, and/or
  - any **new** High/Critical since the last **passing** scan (includes true news and regressions from resolved/absent).

Old open High findings that already existed do not count as “new”.

---

## 8. Tools (V1 adapters)

Each adapter implements detect / install / run / normalize / fingerprint. Commands are structured argv with safe shell quoting. Secrets from gitleaks are redacted and not stored in Issue payloads.

| Key | Category |
|-----|----------|
| `gitleaks` | Secrets |
| `npm-audit` | SCA (Node) |
| `pip-audit` | SCA (Python) |
| `trivy` | SCA / misconfig / secrets (fs) |
| `semgrep` | SAST |

Registry code: `src/lib/tools/`. New tools in V2 should plug into the same interface.

---

## 9. Worker and exports

```mermaid
sequenceDiagram
  participant UI as App
  participant DB as Postgres
  participant W as Worker

  UI->>DB: INSERT Job type export_issues pending
  loop poll
    W->>DB: SELECT FOR UPDATE SKIP LOCKED
    W->>W: query Issues write CSV or JSON
    W->>DB: Export row Job succeeded
  end
  UI->>UI: download Export file
```

- Jobs use Postgres (`FOR UPDATE SKIP LOCKED`); no Redis.
- Worker entrypoint: `src/worker/index.ts` (`pnpm worker`).
- Files under `STORAGE_PATH` (Compose: `/data/exports`).
- UI: **Exports** — enqueue, status, download.

---

## 10. Auth

- **Credentials** via Auth.js (NextAuth v5): email + password.
- Passwords are hashed with Node `scrypt` (`src/lib/password.ts`); only a hash is stored.
- **First-run admin:** when the `User` table is empty, `/setup` creates the first account with role `admin`. Once any user exists, `/setup` redirects to `/login`.
- Admins create members and reset passwords in **Settings**; members can change their own password.
- Roles: `admin`, `member`.
- UI: JWT session cookies (30 days). CI: service bearer tokens.
- Failure throttle: 5 failed logins per client IP per 15 minutes (in-memory, per process).
- Edge auth gate: `src/proxy.ts` (Next.js “proxy” convention; formerly middleware). `/login`, `/setup`, `/api/*`, and static assets are public; route handlers enforce their own auth.
- Lockout recovery: `pnpm auth:password <email> [--admin]` inside the app container.

---

## 11. UI surfaces (V1)

| Route | Purpose |
|-------|---------|
| `/dashboard` | Severity counts, scores, recent regressions / new Issues |
| `/catalog` | Applications, services, tokens, tool toggles |
| `/issues` | Filter, assign user, status |
| `/gates` | Quality gate configuration |
| `/exports` | Export jobs + download |
| `/settings` | Account password, admin user management |
| `/login` | Email + password sign-in |
| `/setup` | First-run admin (only while no user exists) |

---

## 12. Repository layout (mental model)

```
/
  README.md                 # Quickstart
  documentation.md          # This file
  TODO.md                   # V2 backlog
  compose.yaml              # Production-style one-command stack
  compose.dev.yaml          # Dev: hot reload, bind mount
  arcane/compose.yaml       # Homelab/Arcane stack (GHCR image, port 5377)
  Dockerfile                # Stages: dev | build | runner
  docker/entrypoint.sh      # Migrations, seed, AUTH_SECRET
  scripts/set-password.ts   # Lockout recovery
  prisma/                   # Schema + migrations + seed
  src/
    app/                    # Next.js App Router (UI + API routes)
    lib/                    # Auth, DB, reconcile, scoring, CI, tools, jobs
    worker/                 # Export job loop
    proxy.ts                # Auth gate
  biome.json                # Lint / format
```

Package manager: **pnpm** (pinned in `package.json`). Lint: **Biome**.

---

## 13. Dev vs production containers

| Mode | How |
|------|-----|
| **Local, one command** | `docker compose up`; builds `runner`, starts Postgres 18 + app + worker |
| **Dev (hot reload)** | `docker compose -f compose.dev.yaml up --build`; `dev` target, bind mount, shared `node_modules` |
| **Production** | One `runner` image for both roles; worker overrides the command |
| **Homelab** | `arcane/compose.yaml` pulls `ghcr.io/piradata/security-center:latest` |

PostgreSQL 18 stores data in `/var/lib/postgresql/18/docker`, so every stack mounts the volume at `/var/lib/postgresql` (not the pre-18 `/var/lib/postgresql/data`).

The app entrypoint (`docker/entrypoint.sh`) applies migrations and runs the idempotent tool seed. The worker runs with `MIGRATE_ON_START=false` and waits for the app healthcheck. Locally, an empty `AUTH_SECRET` is generated into `/data/.auth-secret`; set it explicitly in Arcane. Compose overrides `DATABASE_URL` (hostname `postgres`) and `STORAGE_PATH`.

### Deployment

1. Push to `main` → GitHub Actions runs lint/typecheck/tests, then publishes `ghcr.io/piradata/security-center:latest` and `:<sha>`.
2. Arcane project `security-center` runs `arcane/compose.yaml` with `com.getarcaneapp.arcane.updater=true`.
3. Nginx Proxy Manager: `sechub.cloud.piradata.dev` → `http://192.168.1.77:5377`, using the existing `*.cloud.piradata.dev` wildcard (also covers the local alias) certificate. The WAN exposes NPM on **8443** because the modem uses 443 for its admin screen.
4. Set `AUTH_URL=https://sechub.cloud.piradata.dev:8443` before the first login so cookies are secure.

---

## 14. Deliberate V1 simplifications

- Configure tools in the UI; one curl replaces ad-hoc scanner CI steps.
- Worker = exports only (no analysis on the Security Center host).
- No agent, no Redis, no external ticket create.
- User assign only; single org per deployment.
- Fixed score weights; configurable gate threshold.
- No multi-tenant SaaS.

---

## 15. What is intentionally later (V2)

See [TODO.md](TODO.md): Teams, Sonar, ZAP, CycloneDX, generic tools, server-side scan, host scan, ticketing backends, richer exports, schedules/Redis, suppress policy knobs, KMS.
