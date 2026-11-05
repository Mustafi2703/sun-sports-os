# Learn more about this file at: https://docs.railway.com/guides/dockerfiles
FROM node:22-bookworm-slim

WORKDIR /app

# Prefer IPv4 and retry: Railway builds sometimes fail reaching deb.debian.org over IPv6
RUN printf 'Acquire::ForceIPv4 "true";\n' > /etc/apt/apt.conf.d/99force-ipv4 \
  && apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
COPY prisma/seed.ts ./prisma/seed.ts

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && (npx tsx prisma/seed.ts || true) && npx tsx src/index.ts"]
