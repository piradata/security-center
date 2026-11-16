# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.4.2

# Dev platform — compose.dev.yaml bind-mounts the repo; deps install into a volume.
FROM base AS dev
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm exec prisma generate && pnpm exec prisma migrate deploy && pnpm exec prisma db seed && pnpm run dev --hostname 0.0.0.0 --port 3000"]

# Full production build — never copies host node_modules; installs from the lockfile.
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Prisma's config evaluates this during `prisma generate`; no connection is made.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm exec prisma generate \
  && pnpm run build

# One image for both roles: the app starts Next, the worker overrides the
# command with `pnpm run worker`.
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV STORAGE_PATH=/data/exports
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/tsconfig.json ./
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["pnpm", "run", "start"]
