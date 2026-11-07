FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY checklist-shared/package.json checklist-shared/package.json
COPY checklist-api/package.json checklist-api/package.json
COPY checklist-web/package.json checklist-web/package.json
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY checklist-shared checklist-shared
COPY checklist-api checklist-api
ENV HOST=0.0.0.0 PORT=3001 NODE_ENV=production
USER node
EXPOSE 3001
CMD ["npm","run","start","-w","checklist-api"]
