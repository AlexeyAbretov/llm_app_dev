# Сборка из корня monorepo: docker compose build backend
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY shared/package.json shared/

RUN npm ci --workspace=@llm-app/backend --workspace=@llm-app/shared --include=dev

COPY shared/ shared/
COPY backend/ backend/

RUN npm run build -w @llm-app/backend

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY shared/package.json shared/

RUN npm ci --workspace=@llm-app/backend --workspace=@llm-app/shared --omit=dev

COPY --from=build /app/backend/dist backend/dist

EXPOSE 3001

CMD ["node", "backend/dist/index.js"]
