# Privativos

Estrutura do repositorio:
- `backend/`: API Fastify, Prisma, migracoes e seed.
- `frontend/`: aplicacao React (Vite).
- `docs/`: documentacao tecnica e funcional.

## Rodar com Docker

No diretorio raiz do projeto:

```bash
docker compose up -d --build
```

Servicos que sobem:
- `app`: backend + build do frontend (porta `3000`).
- `postgres`: banco PostgreSQL 16 (porta `5432`).
- `redis`: cache Redis 7 (porta `6379`).

Comandos uteis:

```bash
docker compose logs -f app
docker compose ps
docker compose down
```

No primeiro startup, o `app` roda `prisma migrate deploy` automaticamente antes de iniciar a API.

Healthcheck:
- `http://localhost:3000/health`

## Variaveis de ambiente (Docker)

O `docker-compose.yml` ja injeta os hosts internos corretos para container:
- `DATABASE_URL=postgresql://reunir:reunir@postgres:5432/reunir`
- `REDIS_URL=redis://redis:6379`

Voce pode sobrescrever valores via shell/arquivo `.env` (ex.: `ADMIN_SEED_PASSWORD`, `LOG_LEVEL`).

## Rodar sem Docker (dev local)

1. Entre no backend:

```bash
cd backend
```

2. Instale dependencias:

```bash
npm install
```

3. Crie `.env` no backend:

```bash
cp .env.example .env
```

4. Gere Prisma Client:

```bash
npm run prisma:generate
```

5. Com PostgreSQL e Redis ativos, aplique migration e seed:

```bash
npm run prisma:deploy
npm run prisma:seed
```

6. Rode a API:

```bash
npm run dev
```
