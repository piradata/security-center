# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

# Dev platform — compose bind-mounts the repo; deps install into a volume.
FROM base AS dev
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm exec prisma generate && pnpm exec prisma migrate deploy && pnpm exec prisma db seed && pnpm run dev --hostname 0.0.0.0 --port 3000"]

# Full production build — never copies host node_modules; installs from the lockfile.
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm exec prisma generate \
  && pnpm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=build /app/packages/worker/package.json ./packages/worker/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/next.config.ts ./
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec prisma db seed && pnpm run start"]

FROM base AS worker
ENV NODE_ENV=production
ENV STORAGE_PATH=/data/exports
COPY --from=build /app /app
CMD ["pnpm", "--filter", "@security-center/worker", "start"]
