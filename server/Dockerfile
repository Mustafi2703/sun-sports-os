# Learn more about this file at: https://docs.railway.com/guides/dockerfiles
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
COPY prisma/seed.ts ./prisma/seed.ts

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push && (npx tsx prisma/seed.ts || true) && npx tsx src/index.ts"]
