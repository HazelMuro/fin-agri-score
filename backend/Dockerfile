# Fin-Agri Score API — production image
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY src ./src
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh \
  && npx --yes prisma@5.22.0 generate

ENV NODE_ENV=production
EXPOSE 4000

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
