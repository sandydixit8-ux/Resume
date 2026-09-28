FROM node:24-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG AUTH_SECRET
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV AUTH_SECRET=$AUTH_SECRET

RUN npm run build

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/creatoros.db
ENV PORT=3000
EXPOSE 3000

RUN mkdir -p /data

CMD ["sh", "./docker-entrypoint.sh"]