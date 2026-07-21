# syntax=docker/dockerfile:1
# Worker image — shares root deps + generated Prisma client

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY packages/worker ./packages/worker
COPY tsconfig.json ./
# Generate client into src/generated/prisma (schema output path)
COPY src ./src
RUN npx prisma generate

ENV STORAGE_PATH=/data/exports
CMD ["npx", "tsx", "packages/worker/src/index.ts"]
