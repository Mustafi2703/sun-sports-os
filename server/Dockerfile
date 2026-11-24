# Learn more about this file at: https://docs.railway.com/guides/dockerfiles
FROM node:22-bookworm-slim

WORKDIR /app

# Prefer IPv4 and retry: Railway builds sometimes fail reaching deb.debian.org over IPv6
RUN printf 'Acquire::ForceIPv4 "true";\n' > /etc/apt/apt.conf.d/99force-ipv4 \
  && apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install devDependencies as well. Start runs the Prisma CLI and tsx.
# Do not set NODE_ENV=production before this install or those tools will be omitted.
COPY package.json package-lock.json* ./
RUN npm install

COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN chmod +x scripts/start-prod.sh scripts/baseline-existing.sh scripts/reset-local.sh

ENV NODE_ENV=production
EXPOSE 4000

# migrate deploy applies committed migrations only. It does not db push and it does not seed.
CMD ["./scripts/start-prod.sh"]
