FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY checklist-shared/package.json checklist-shared/package.json
COPY checklist-api/package.json checklist-api/package.json
COPY checklist-web/package.json checklist-web/package.json
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY checklist-shared checklist-shared
COPY checklist-web checklist-web
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w checklist-web
FROM caddy:2-alpine
COPY --from=build /app/checklist-web/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
