# Reunir V2

Estrutura do repositorio:
- `backend/`: API Fastify, Prisma, migracoes e seed
- `frontend/`: fora de escopo no momento (replanejamento em andamento)
- `docs/`: AS-IS, GAP, PRD, avaliacao tecnica e TDD

## Como rodar (dev)

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

7. Execute a suite de testes:

```bash
npm test
```

## Observacao

Deploy e Docker ficam para a etapa final, apos estabilidade completa em modo dev.

## Docker Compose (postergado)

No diretorio raiz:

```bash
docker compose up -d --build
```

Compose usa `backend/Dockerfile` e inclui `frontend/` na imagem da API.
