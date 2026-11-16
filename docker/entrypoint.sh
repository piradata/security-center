#!/bin/sh
set -eu

# Migrations and the idempotent tool seed run once, on the app container.
if [ "${MIGRATE_ON_START:-true}" = "true" ]; then
  attempt=1
  until pnpm exec prisma migrate deploy; do
    if [ "$attempt" -ge 30 ]; then
      echo "Database did not become ready for migrations." >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  pnpm exec prisma db seed
fi

# Local `docker compose up` works without an .env. Persist the generated
# secret so sessions survive container recreation. Production/Arcane should
# set AUTH_SECRET explicitly.
case "${AUTH_SECRET:-}" in
  "" | replace-with-a-long-random-string | generate-a-long-random-string)
    AUTH_SECRET=""
    ;;
esac

if [ "${ROLE:-app}" = "app" ] && [ -z "$AUTH_SECRET" ]; then
  secret_file="${AUTH_SECRET_FILE:-/data/.auth-secret}"
  mkdir -p "$(dirname "$secret_file")"
  if [ ! -s "$secret_file" ]; then
    openssl rand -base64 48 >"$secret_file"
    chmod 600 "$secret_file"
    echo "Generated AUTH_SECRET at $secret_file"
  fi
  AUTH_SECRET="$(cat "$secret_file")"
  export AUTH_SECRET
fi

exec "$@"
