# Security Center

**ASPM-lite** catalog + quality gate. Catalog applications and services, reconcile scanner Issues with ownership, and enforce a CI quality gate — without replacing SonarQube. Scanners are inputs; Security Center owns catalog, Issues, scores, and the gate.

For architecture and how CI, Issues, and the worker fit together, see [documentation.md](documentation.md). Deferred work: [TODO.md](TODO.md).

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js (App Router) + TypeScript |
| Package manager | pnpm (pinned in `package.json`) |
| UI | Tailwind |
| DB | PostgreSQL 18 + Prisma |
| Auth | Auth.js credentials (email + password), first-run admin |
| Worker | `src/worker` — export jobs only |
| Jobs | Postgres `FOR UPDATE SKIP LOCKED` (no Redis in V1) |
| CI | One `curl \| bash` → `GET /api/v1/ci/scan.sh` with `SC_TOKEN` |

**V1 tools** (run on the CI runner, enabled per app/service in the UI): gitleaks, npm audit, pip-audit, Trivy (fs), semgrep.

No host agent. No server-side clone/scan. Teams replace prior scanner steps with the curl; which tools run is configured in the UI.

## Quickstart — one command

```bash
docker compose up
```

That builds the production image, starts Postgres 18, the app, and the export worker, applies migrations, and seeds the tool catalog. No `.env` is required: `AUTH_SECRET` is generated on first start and persisted in the `app_data` volume.

Open <http://localhost:3000>. The first visit goes to **`/setup`**; the account you create there becomes the admin. After that, `/setup` is closed and everyone signs in at `/login`.

To use another port or a LAN hostname:

```bash
APP_PORT=8080 AUTH_URL=http://192.168.1.77:8080 docker compose up
```

### Development (hot reload)

```bash
cp .env.example .env   # then replace AUTH_SECRET
docker compose -f compose.dev.yaml up --build
```

This bind-mounts the repo and uses the Dockerfile `dev` stage. Dependencies install into a shared `node_modules` volume.

**Dev Container (VS Code / Cursor):** open the repo → “Reopen in Container”. That uses `compose.dev.yaml`, copies `.env` from `.env.example` if missing, installs deps, migrates, and seeds. Then in the container terminal:

```bash
pnpm run dev --hostname 0.0.0.0 --port 3000
```

### Accounts

- First `/setup` = admin.
- Admins add members and reset passwords in **Settings**.
- Members can change their own password there.
- Locked out of the only admin account? Run the recovery script inside the app container:

```bash
# local compose
docker compose exec app pnpm auth:password admin@example.com --admin
# Arcane deployment
docker exec security-center pnpm auth:password admin@example.com --admin
```

It reads `NEW_PASSWORD` from the environment; pass it as an env var to avoid shell history.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js signing secret; generated locally if empty |
| `AUTH_URL` | Public base URL (set to the HTTPS hostname behind a proxy) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Compose database defaults |
| `APP_PORT` | Host port for the app (local `3000`, Arcane `5377`) |
| `SC_URL` | Base URL of Security Center (used by CI) |
| `SC_TOKEN` | Service token for CI (`Authorization: Bearer …`), created in the UI |

### One-curl CI snippet

In your pipeline (after checkout), set `SC_URL` and `SC_TOKEN`, then:

```bash
curl -fsSL -H "Authorization: Bearer $SC_TOKEN" \
  "$SC_URL/api/v1/ci/scan.sh" | bash
```

Internally: probe → fetch enabled tools → install/run on the CI runner → ingest → quality gate (exit 0/1). Execution stays on the runner, never on the Security Center host.

## Deploy (GitHub → GHCR → Arcane → NPM)

Pushes to `main` run lint/typecheck/tests and publish one image:

```
ghcr.io/piradata/security-center:latest
ghcr.io/piradata/security-center:<commit-sha>
```

The `runner` image serves the app by default and runs the worker with `command: pnpm run worker`.

1. Push to `main` and confirm the GHCR package exists.
2. If the package is private, add `ghcr.io` registry credentials in Arcane.
3. Create Arcane project **`security-center`** from [`arcane/compose.yaml`](arcane/compose.yaml).
4. Add the project `.env` from [`arcane/.env.example`](arcane/.env.example), including `AUTH_URL=https://sechub.cloud.piradata.dev` and `APP_PORT=5377`.
5. Deploy, then claim the admin at `/setup` immediately.
6. Arcane auto-updates when `:latest` changes (`com.getarcaneapp.arcane.updater=true`). Pin a `:<sha>` tag to roll back.

Nginx Proxy Manager host:

| Field | Value |
|-------|-------|
| Domain | `sechub.cloud.piradata.dev` |
| Forward | `http://192.168.1.77:5377` |
| SSL | existing `*.cloud.piradata.dev` wildcard (also covers the local alias) |
| Extras | websockets on, block common exploits, force SSL |

Add `client_max_body_size 50m;` in the Advanced tab for CI ingest payloads.

## Roles (V1)

| Process | Responsibility |
|---------|----------------|
| **App** | Catalog, tool toggles, Issues, score/gate, `scan.sh`, reconcile ingest, enqueue exports |
| **Worker** | `export.issues` (CSV/JSON) |
| **CI** | `scan.sh`: probe → run **enabled** tools → ingest → gate |

## License

See [LICENSE](LICENSE).
