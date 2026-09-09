# Сборка из корня monorepo: docker compose build frontend
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
COPY shared/package.json shared/

RUN npm ci --workspace=@llm-app/frontend --workspace=@llm-app/shared --include=dev

COPY shared/ shared/
COPY frontend/ frontend/

RUN npm run build -w @llm-app/frontend

FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
