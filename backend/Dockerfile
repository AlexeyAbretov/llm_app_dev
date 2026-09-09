# Сборка из корня monorepo (workspaces: backend, shared)
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY shared/package.json shared/
COPY frontend/package.json frontend/

RUN npm ci

COPY shared/ shared/
COPY backend/ backend/

RUN npm run build -w @llm-app/backend

FROM node:20-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY shared/package.json shared/
COPY frontend/package.json frontend/

RUN npm ci --omit=dev

COPY --from=build /app/backend/dist backend/dist

EXPOSE 3001

CMD ["node", "backend/dist/index.js"]
