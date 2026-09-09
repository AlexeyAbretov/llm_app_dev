# Сборка из корня monorepo (workspaces: frontend, shared)
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY shared/package.json shared/
COPY backend/package.json backend/

RUN npm ci

COPY shared/ shared/
COPY frontend/ frontend/

RUN npm run build -w @llm-app/frontend

FROM nginx:alpine AS production

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
