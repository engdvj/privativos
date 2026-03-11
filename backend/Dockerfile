FROM node:20-alpine AS base
RUN apk add --no-cache openssl

FROM base AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

FROM base AS backend-builder
WORKDIR /app/backend
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend ./
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM base AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
