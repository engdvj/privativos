# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Reunir V2** — Backend API for managing equipment/uniform kit loans and returns for employees. Migration from Google Apps Script to a modern stack. Written in Portuguese (variable names, DB columns, docs).

## Commands

Backend commands (from `backend/`):

```bash
npm run dev              # Start dev server with hot reload (tsx watch)
npm run build            # Compile TypeScript → dist/
npm run start            # Run compiled JS (production)
npm run lint             # ESLint
npm run prisma:generate  # Generate Prisma Client after schema changes
npm run prisma:migrate   # Create new migration (dev)
npm run prisma:deploy    # Apply pending migrations
npm run prisma:seed      # Seed admin user + config (idempotent)
```

Frontend commands (from `frontend/`):

```bash
npm run dev              # Vite dev server (port 5173, proxy → backend:3000)
npm run build            # Build to frontend/dist/ (served by Fastify in production)
```

Docker (from repo root):
```bash
docker compose up -d --build   # Starts app (port 3000), PostgreSQL 16, Redis 7
```

No test framework is configured yet (`npm test` is a placeholder).

## Architecture

**Monorepo layout:**
- `backend/` — Fastify 4 API (TypeScript, ESM, strict mode)
- `frontend/` — React 19 SPA (Vite + TypeScript + shadcn/ui + Tailwind CSS + React Router)
- `docs/` — Project documentation (AS-IS analysis, GAP, PRD, tech eval, TDD)

**Tech stack:** Fastify 4 + TypeScript 5 + Prisma 5 (PostgreSQL 16) + ioredis (Redis 7) + Zod 4 + bcrypt

**Entry point:** `src/server.ts` → `src/app.ts` (Fastify factory, registers routes/plugins/error handler)

### Backend Structure (src/)

- `config/env.ts` — Zod-validated environment variables (fail-fast on startup)
- `lib/prisma.ts`, `lib/redis.ts` — Singleton clients
- `middleware/auth.ts` — `authenticate()` extracts Bearer token from Redis; `authorize(perfis)` checks role
- `routes/` — Fastify route plugins: `health.ts`, `auth.ts`, `ops.ts`
- `services/` — Business logic: `auth-service`, `loan-service`, `return-service`, `validation-queue-service`, `dashboard-service`
- `sse/sse-manager.ts` — Server-Sent Events for real-time notifications to solicitante clients
- `errors/app-error.ts` — Custom AppError(statusCode, code, message)

### Key Patterns

- **Auth:** UUID session tokens stored in Redis with TTL. Two session types: `sess:{token}` (admin/setor, 12h) and `sess:sol:{token}` (solicitante, 1h via matricula-only login)
- **Validation codes:** 6-digit codes stored in Redis queues (`vqueue:{matricula}:{tipo}`) with 1h TTL. Real-time delivery via SSE
- **Transactions:** Prisma `$transaction()` for all multi-write operations (loans, returns)
- **Soft deletes:** `statusAtivo` boolean flag, no hard deletes
- **Error handling:** AppError → structured JSON response; ZodError → 400; unhandled → 500 + logged

### Database (Prisma)

Schema in `prisma/schema.prisma` with 7 models: Funcionario, Item, Solicitacao, Devolucao, Credencial, Configuracao, Auditoria.

- Naming: snake_case columns via `@map`, camelCase in TypeScript
- Timestamps: `Timestamptz(6)` for timezone-aware precision
- Enums: `Perfil` (setor|admin), `StatusItem` (disponivel|emprestado|inativo)

## Conventions

- **Language:** All domain names, variables, DB columns, and API responses use Portuguese
- **Module system:** ESM (`"type": "module"` in package.json, `"module": "NodeNext"` in tsconfig)
- **Naming:** camelCase (TS), snake_case (DB/JSON responses), SCREAMING_SNAKE_CASE (config keys)
- **Validation:** Zod schemas inline in route handlers for request body/params
- **Logging:** Pino via Fastify (level from `LOG_LEVEL` env var)
- **Route registration:** `FastifyPluginAsync` with `preHandler` arrays for middleware chaining

## Environment

Required variables are defined in `backend/.env.example` and validated by `config/env.ts`. Key vars: `DATABASE_URL`, `REDIS_URL`, `SESSION_TTL_SECONDS`, `VALIDATION_TTL_SECONDS`, `BCRYPT_ROUNDS`, `ADMIN_SEED_PASSWORD`, `PORT`, `NODE_ENV`, `LOG_LEVEL`.
