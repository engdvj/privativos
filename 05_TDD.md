# TDD — V2 — Appscript Reunir

> Versão: 1.0 | Data base: 2026-02-11
> Referências: 01_AS-IS.md · 02_GAP.md · 03_PRD_TO-BE.md · 04_TECH_EVALUATION_STACK_RECOMMENDATION.md

---

## 1. Visão Técnica Geral

### Resumo

Sistema de controle de empréstimo e devolução de kits, reescrito como API REST + frontend servido estaticamente, em execução on-premises via Docker Compose. Substitui completamente o Google Apps Script — sem nenhuma dependência de runtime GAS.

### Stack Definitiva

| Camada | Tecnologia | Decisão de Origem |
|---|---|---|
| Runtime | Node.js 20 LTS (Alpine) | 04 § 6 — score 539 |
| Linguagem | TypeScript 5.x (strict) | 04 § 6 — elimina GAP-TECH-05/06/07 por construção |
| Framework HTTP | Fastify 4 | ADR-01 |
| ORM | Prisma 5 | ADR-02 |
| Banco de dados | PostgreSQL 16 | 03 § 7; 04 PENDENTE-DB |
| Cache / filas | Redis 7 (via ioredis) | ADR-03 |
| Autenticação | Sessão server-side (UUID → Redis) | ADR-04 |
| Hash de senha | bcrypt (rounds: 12) | 04 § 6 |
| Tokens | UUID v4 (crypto nativo) | — |
| Exportação | exceljs (in-memory) | PRD FMD-05; 04 P-04 |
| Frontend | HTML/CSS/JS vanilla (servido pelo Fastify como static) | AS-IS — sem alteração de UI além do necessário |
| Notificação em tempo real | SSE (Server-Sent Events) | ADR-05 |
| Containerização | Docker + Docker Compose | 04 PENDENTE-C |
| Deploy | Manual (on-prem); sem CI/CD externo | 04 PENDENTE-C |

### Principais Decisões Arquiteturais

- **Sessão server-side com Redis** (não JWT stateless): revogação imediata de credencial requerida por FN-03.
- **SSE substitui polling de 500ms** no Solicitante: reduz dezenas de chamadas/minuto para uma conexão mantida.
- **`SELECT FOR UPDATE` em transação PostgreSQL** substitui `LockService` do GAS: cobre empréstimo e devolução (FMD-06, RNF-07).
- **Fila de validação isolada por matrícula no Redis**: elimina colisão de operações simultâneas do mesmo tipo (FMD-02).
- **QR Code removido**: fluxo exclusivo por código de 6 dígitos (PRD § 5.4, RNF-04).
- **V2 parte de banco limpo**: sem migração de dados das Sheets (PRD § 8, 04 § 8).

---

## 2. Arquitetura Geral do Sistema

### Diagrama de Camadas

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENTES (browser)                                              │
│  Solicitante          Setor                  Admin               │
│  (HTML estático)      (HTML estático)        (HTML estático)     │
└──────────────────────────────────┬───────────────────────────────┘
                          HTTP/REST + SSE
┌──────────────────────────────────▼───────────────────────────────┐
│  API LAYER  (Fastify 4 + TypeScript)                             │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ /auth      │  │ /ops         │  │ /admin                   │ │
│  │ login      │  │ gerar-codigo │  │ dashboard, export        │ │
│  │ logout     │  │ confirmar    │  │ itens, funcionarios       │ │
│  │ session    │  │ cancelar     │  │ credenciais, config      │ │
│  │ solicitante│  │ /stream SSE  │  └──────────────────────────┘ │
│  └────────────┘  └──────────────┘                               │
│  Middleware: authn, authz, validação (Zod), error handler        │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────┐
│  APPLICATION / SERVICE LAYER                                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐ │
│  │ AuthService  │  │ ValidationQueue  │  │ AdminService       │ │
│  │              │  │ Service          │  │                    │ │
│  └──────────────┘  └──────────────────┘  └────────────────────┘ │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐ │
│  │ LoanService  │  │ DashboardService │  │ ExportService      │ │
│  │ ReturnService│  │                  │  │                    │ │
│  └──────────────┘  └──────────────────┘  └────────────────────┘ │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────┐
│  DOMAIN LAYER  (tipos, interfaces, regras de negócio puras)      │
│  Entidades: Funcionario, Item, Solicitacao, Devolucao,           │
│  Credencial, Configuracao, Auditoria                             │
│  Tipos: PerfilAcesso, StatusItem, TipoOperacao                   │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────┐
│  INFRASTRUCTURE LAYER                                            │
│  ┌────────────────────────┐  ┌───────────────────────────────┐  │
│  │ PostgreSQL 16 (Prisma) │  │ Redis 7 (ioredis)             │  │
│  │ - funcionarios         │  │ - sess:{token}       (12h)    │  │
│  │ - itens                │  │ - vqueue:{mat}:{tipo}(1h)     │  │
│  │ - solicitacoes         │  │ - vresult:{mat}      (60s)    │  │
│  │ - devolucoes           │  │ - dashboard:data:{h} (event)  │  │
│  │ - credenciais          │  │ - dashboard:filters  (600s)   │  │
│  │ - configuracoes        │  └───────────────────────────────┘  │
│  │ - auditoria            │                                      │
│  └────────────────────────┘                                      │
└──────────────────────────────────────────────────────────────────┘
```

### Responsabilidade de Cada Camada

| Camada | Responsabilidade |
|---|---|
| API Layer | Receber HTTP, validar entrada (Zod), autenticar/autorizar (middleware), chamar serviços, formatar resposta |
| Service Layer | Orquestrar regras de negócio, coordenar DB + Redis, lançar erros de domínio |
| Domain Layer | Definir interfaces TypeScript, tipos de domínio, constantes e enums |
| Infrastructure Layer | Executar queries SQL (Prisma), operações Redis (ioredis), geração de arquivo Excel (exceljs) |

---

## 3. Componentes do Sistema

### 3.1 AuthService

| Campo | Detalhe |
|---|---|
| **Responsabilidade** | Login/logout por perfil (Setor, Admin); sessão do Solicitante por matrícula; validação de sessão; revogação |
| **Entradas** | `{usuario, senha, perfil}` · `{matricula}` (Solicitante) · `{token}` (validação) |
| **Saídas** | `{token, perfil, nome}` · `{ok: false, erro}` |
| **Dependências** | Redis (sessões), tabela `credenciais` (Prisma), bcrypt |
| **Fluxo crítico** | Login: busca credencial por usuário → bcrypt.compare → cria sessão UUID → armazena `sess:{token}` no Redis TTL 12h |
| **Revogação** | `DEL sess:{token}` no Redis → acesso negado imediatamente no próximo request |

### 3.2 ValidationQueueService

| Campo | Detalhe |
|---|---|
| **Responsabilidade** | Gerenciar fila de validação isolada por matrícula; gerar e consumir códigos de 6 dígitos; notificar via SSE |
| **Entradas** | `{matricula, tipo: 'emprestimo'|'devolucao', quantidade, item_codigos?}` (gerar) · `{codigo, matricula}` (consumir) |
| **Saídas** | `{codigo}` · `{pendente: boolean, tipo, codigo, quantidade}` |
| **Dependências** | Redis, SSEManager |
| **Chaves Redis** | `vqueue:{matricula}:{tipo}` → `{codigo, operador_nome, quantidade, item_codigos, criado_em}` TTL 3600s · `vresult:{matricula}` → `{sucesso, mensagem}` TTL 60s |
| **Isolamento** | Uma chave por matrícula+tipo → dois funcionários aguardando o mesmo tipo de operação não interferem (resolve GAP-FUNC-02) |
| **TTL único** | 3600s — definido em variável de ambiente `VALIDATION_TTL_SECONDS`; sem redeclaração conflitante (resolve GAP-TECH-07) |

### 3.3 LoanService

| Campo | Detalhe |
|---|---|
| **Responsabilidade** | Registrar empréstimo de kit: validar funcionário ativo, verificar limite de kits, atualizar status do item, gravar `solicitacoes` |
| **Entradas** | `{matricula, item_codigos: string[], operador_nome: string}` |
| **Saídas** | `{sucesso: true, itens_emprestados: string[]}` · erro de domínio |
| **Dependências** | Prisma (transação `SELECT FOR UPDATE`), tabelas `itens`, `solicitacoes`, `configuracoes`, `funcionarios` |
| **Concorrência** | `SELECT FOR UPDATE` nas linhas dos itens dentro de transação — serializa operações concorrentes no mesmo item |
| **Regra** | `max_kits = configuracoes['MAX_KITS_POR_FUNCIONARIO']` — lido do banco, não hardcoded |
| **Pós-operação** | Invalida `dashboard:data:*` no Redis (implementado via `DashboardService.invalidateCache()`) |

### 3.4 ReturnService

| Campo | Detalhe |
|---|---|
| **Responsabilidade** | Registrar devolução de item físico selecionado explicitamente pelo Setor |
| **Entradas** | `{matricula, item_codigos: string[], operador_nome: string}` |
| **Saídas** | `{sucesso: true, itens_devolvidos: string[]}` · erro de domínio |
| **Dependências** | Prisma (transação `SELECT FOR UPDATE`), tabelas `itens`, `devolucoes` |
| **Concorrência** | Mesmo mecanismo do LoanService — resolve GAP-TECH-04 |
| **Rastreabilidade** | `item_codigos` selecionados explicitamente pelo Setor — resolve GAP-FUNC-04 |
| **Pós-operação** | Invalida `dashboard:data:*` no Redis |

### 3.5 SSEManager

| Campo | Detalhe |
|---|---|
| **Responsabilidade** | Gerenciar conexões SSE ativas; emitir eventos por matrícula |
| **Entradas** | `{matricula}` (registrar conexão) · `{matricula, evento, payload}` (emitir) |
| **Saídas** | Stream SSE (`text/event-stream`) |
| **Dependências** | Fastify (response stream) |
| **Implementação** | Map em memória: `Map<string, ServerResponse[]>` — sem Redis (não precisa persistir conexões) |
| **Eventos emitidos** | `code_generated`, `operation_confirmed`, `operation_cancelled`, `heartbeat` (a cada 30s para manter conexão) |
| **Reconexão** | Cliente reenvia `Last-Event-ID`; se código ainda ativo no Redis, re-emite imediatamente |

### 3.6 DashboardService

| Campo | Detalhe |
|---|---|
| **Responsabilidade** | Agregar dados de todas as tabelas operacionais; aplicar filtros; calcular KPIs |
| **Entradas** | `{filtros: {data_inicio?, data_fim?, setor?, matricula?}}` |
| **Saídas** | `{kpis, rows, total}` |
| **Dependências** | Prisma, Redis (cache) |
| **Cache** | `dashboard:data:{sha256(filtros)}` — sem TTL fixo; invalidado por evento pós-operação (resolve GAP-FUNC-05) |
| **Invalidação** | `DEL dashboard:data:*` executado por LoanService/ReturnService após cada operação concluída |

### 3.7 ExportService

| Campo | Detalhe |
|---|---|
| **Responsabilidade** | Gerar arquivo `.xlsx` em memória a partir dos dados filtrados |
| **Entradas** | `{filtros}` |
| **Saídas** | `Buffer` (xlsx) — sem criar arquivo em disco ou Drive |
| **Dependências** | exceljs, DashboardService |
| **Formato** | Sempre `.xlsx` — sem fallback para `.csv` (resolve FMD-05); em falha retorna erro HTTP 500 explícito |

### 3.8 AdminService

| Campo | Detalhe |
|---|---|
| **Responsabilidade** | CRUD de funcionários, itens, credenciais; gestão de configurações; registro de auditoria |
| **Entradas** | DTOs de criação/atualização para cada entidade |
| **Saídas** | Entidade criada/modificada ou erro de domínio |
| **Dependências** | Prisma, bcrypt (para credenciais), tabela `auditoria` |
| **Regra de inativação de kit** | Se `itens.status = 'emprestado'`, retorna erro com `{matricula, nome}` do detentor — resolve FN-01 critério (4) |
| **Auditoria** | Toda operação de escrita grava registro em `auditoria` com `{operador, entidade, operacao, registro_id, dados_antes, dados_depois}` |

---

## 4. Modelo de Dados

### 4.1 Tabelas PostgreSQL

#### `funcionarios`

| Coluna | Tipo | Restrições | Notas |
|---|---|---|---|
| id | serial | PK | — |
| matricula | varchar(20) | UNIQUE NOT NULL | Identificador de negócio |
| nome | varchar(150) | NOT NULL | — |
| setor | varchar(100) | NOT NULL | — |
| funcao | varchar(100) | NOT NULL | — |
| status_ativo | boolean | NOT NULL DEFAULT true | Soft-delete |
| criado_em | timestamptz | NOT NULL DEFAULT now() | — |
| atualizado_por | varchar(150) | | Nome do Admin que alterou |
| atualizado_em | timestamptz | | — |

#### `itens`

| Coluna | Tipo | Restrições | Notas |
|---|---|---|---|
| id | serial | PK | — |
| codigo | varchar(50) | UNIQUE NOT NULL | ID do kit físico |
| descricao | varchar(200) | NOT NULL | — |
| status | varchar(20) | NOT NULL CHECK IN ('disponivel','emprestado','inativo') | — |
| solicitante_matricula | varchar(20) | FK → funcionarios(matricula) NULL | Nulo quando disponível |
| data_emprestimo | timestamptz | | — |
| status_ativo | boolean | NOT NULL DEFAULT true | Inativação administrativa |
| criado_em | timestamptz | NOT NULL DEFAULT now() | — |
| atualizado_por | varchar(150) | | — |
| atualizado_em | timestamptz | | — |

**Regra:** `status_ativo = false` implica `status = 'inativo'`. Item inativo não aparece em listagens de disponíveis.

#### `solicitacoes`

| Coluna | Tipo | Restrições | Notas |
|---|---|---|---|
| id | serial | PK | — |
| timestamp | timestamptz | NOT NULL DEFAULT now() | — |
| matricula | varchar(20) | NOT NULL | Matrícula do Solicitante |
| nome_funcionario | varchar(150) | NOT NULL | Denormalizado para histórico |
| item_codigo | varchar(50) | NOT NULL | Código do kit emprestado |
| operador_nome | varchar(150) | NOT NULL | Nome completo do Setor (RNF-02) |

#### `devolucoes`

| Coluna | Tipo | Restrições | Notas |
|---|---|---|---|
| id | serial | PK | — |
| timestamp | timestamptz | NOT NULL DEFAULT now() | — |
| matricula | varchar(20) | NOT NULL | — |
| nome_funcionario | varchar(150) | NOT NULL | — |
| item_codigo | varchar(50) | NOT NULL | Item específico selecionado (FMD-03) |
| operador_nome | varchar(150) | NOT NULL | — |

#### `credenciais`

| Coluna | Tipo | Restrições | Notas |
|---|---|---|---|
| id | serial | PK | — |
| usuario | varchar(100) | UNIQUE NOT NULL | Login único por pessoa |
| senha_hash | varchar(255) | NOT NULL | bcrypt, rounds=12 |
| perfil | varchar(20) | NOT NULL CHECK IN ('setor','admin') | — |
| nome_completo | varchar(150) | NOT NULL | Usado em `operador_nome` |
| ativo | boolean | NOT NULL DEFAULT true | Revogação imediata |
| criado_em | timestamptz | NOT NULL DEFAULT now() | — |
| criado_por | varchar(150) | NOT NULL | — |
| atualizado_por | varchar(150) | | — |
| atualizado_em | timestamptz | | — |

**Seed:** Inserida via migration/seed script: `{usuario: 'admin', senha_hash: bcrypt('ReunirAdmin@2026'), perfil: 'admin', nome_completo: 'Administrador Padrão', criado_por: 'sistema'}`. Admin deve alterar no primeiro acesso.

#### `configuracoes`

| Coluna | Tipo | Restrições | Notas |
|---|---|---|---|
| chave | varchar(100) | PK | — |
| valor | varchar(255) | NOT NULL | — |
| atualizado_por | varchar(150) | | — |
| atualizado_em | timestamptz | | — |

**Seed:** `('MAX_KITS_POR_FUNCIONARIO', '2', 'sistema', now())`

#### `auditoria`

| Coluna | Tipo | Restrições | Notas |
|---|---|---|---|
| id | serial | PK | — |
| timestamp | timestamptz | NOT NULL DEFAULT now() | — |
| operador | varchar(150) | NOT NULL | Nome completo do Admin |
| entidade | varchar(50) | NOT NULL | Ex.: 'funcionarios', 'itens', 'credenciais' |
| operacao | varchar(20) | NOT NULL | Ex.: 'INSERT', 'UPDATE', 'DEACTIVATE', 'REVOKE' |
| registro_id | varchar(100) | NOT NULL | Chave primária ou negócio do registro afetado |
| dados_antes | jsonb | | Estado anterior (null em INSERT) |
| dados_depois | jsonb | | Estado posterior (null em DELETE físico) |

### 4.2 Estrutura Redis

| Chave | Valor | TTL | Usado por |
|---|---|---|---|
| `sess:{uuidv4}` | JSON `{usuario, perfil, nome_completo, ativo}` | 43200s (12h) | AuthService |
| `sess:sol:{uuidv4}` | JSON `{matricula, nome_funcionario}` | 3600s (1h) | AuthService (Solicitante) |
| `vqueue:{matricula}:{tipo}` | JSON `{codigo, operador_nome, quantidade, item_codigos, criado_em}` | `VALIDATION_TTL_SECONDS` (default 3600) | ValidationQueueService |
| `vresult:{matricula}` | JSON `{sucesso, mensagem, timestamp}` | 60s | ValidationQueueService |
| `dashboard:data:{hash}` | JSON `{kpis, rows, gerado_em}` | Sem TTL — invalidado por evento | DashboardService |
| `dashboard:filters` | JSON `{setores[], funcionarios[]}` | 600s | DashboardService |

### 4.3 Relacionamentos Principais

- `itens.solicitante_matricula` → `funcionarios.matricula` (nullable, null = disponível)
- `solicitacoes.matricula` → denormalizado (não FK — histórico imutável)
- `devolucoes.matricula` → denormalizado
- `auditoria` — append-only, sem FK (imutável por design)

### 4.4 Índices Recomendados

```
CREATE INDEX idx_itens_status ON itens(status) WHERE status_ativo = true;
CREATE INDEX idx_itens_solicitante ON itens(solicitante_matricula) WHERE solicitante_matricula IS NOT NULL;
CREATE INDEX idx_solicitacoes_matricula ON solicitacoes(matricula);
CREATE INDEX idx_solicitacoes_timestamp ON solicitacoes(timestamp);
CREATE INDEX idx_devolucoes_matricula ON devolucoes(matricula);
CREATE INDEX idx_devolucoes_timestamp ON devolucoes(timestamp);
CREATE INDEX idx_funcionarios_matricula ON funcionarios(matricula) WHERE status_ativo = true;
```

---

## 5. Fluxos Técnicos Principais

### 5.1 Login (Setor ou Admin)

```
[Cliente] POST /auth/login {usuario, senha, perfil}
  → AuthRoute: validação Zod
  → AuthService.login(usuario, senha, perfil)
      → Prisma: SELECT FROM credenciais WHERE usuario = ? AND ativo = true
      → bcrypt.compare(senha, senha_hash)
      → Se falha: throw UnauthorizedException
      → Se ok: uuid = randomUUID()
      → Redis: SET sess:{uuid} JSON(credencial) EX 43200
      → return {token: uuid, perfil, nome_completo}
[Cliente] Armazena token em localStorage → envia em Authorization: Bearer {token}
```

**Ponto de falha:** Redis indisponível → login bem-sucedido mas sessão não criada → retry na camada de serviço.

**Log esperado:** `{evento: 'login', usuario, perfil, timestamp, ip, resultado: 'ok'|'falha'}`

---

### 5.2 Sessão do Solicitante

```
[Solicitante] POST /auth/solicitante {matricula}
  → Prisma: SELECT FROM funcionarios WHERE matricula = ? AND status_ativo = true
  → Se não encontrado: HTTP 404
  → uuid = randomUUID()
  → Redis: SET sess:sol:{uuid} {matricula, nome_funcionario} EX 3600
  → return {token: uuid, nome_funcionario}
[Solicitante] Conecta SSE: GET /ops/stream
  → Authorization: Bearer sess:sol:{uuid}
  → SSEManager registra conexão para a matrícula
  → heartbeat a cada 30s
```

---

### 5.3 Fluxo Completo de Empréstimo

```
PASSO 1 — Setor busca funcionário
  [TelaSetor] GET /ops/funcionario/:matricula
    → Prisma: SELECT funcionario + itens_emprestados + contagem atual
    → return {nome, setor, kits_em_uso, max_kits}

PASSO 2 — Setor gera código
  [TelaSetor] POST /ops/gerar-codigo
    {matricula, tipo: 'emprestimo', quantidade}
    → Autenticação: validar sess:{token} no Redis, perfil == 'setor'
    → ValidationQueueService.gerarCodigo(matricula, 'emprestimo', quantidade, operador_nome)
        → codigo = gerar6Digitos()  (crypto.randomInt(100000, 999999).toString())
        → Redis: SET vqueue:{matricula}:emprestimo {codigo, operador_nome, quantidade, criado_em} EX VALIDATION_TTL_SECONDS
        → SSEManager.emit(matricula, 'code_generated', {codigo, tipo, quantidade})
    → return {codigo}

PASSO 3 — Solicitante recebe código via SSE
  [TelaSolicitante] Evento SSE 'code_generated' recebido
  → exibe código na tela
  → (se reconectou): GET /ops/pending/:matricula
      → Redis: GET vqueue:{matricula}:emprestimo
      → se existente: re-emite via SSE

PASSO 4 — Setor monitora status
  [TelaSetor] GET /ops/status-setor/:matricula (polling a cada 3s)
    → Redis: GET vqueue:{matricula}:emprestimo → retorna estado atual
    → return {status: 'aguardando_confirmacao'|'sem_pendencia', codigo_ativo: boolean}

PASSO 5 — Setor confirma operação
  [TelaSetor] POST /ops/confirmar
    {matricula, codigo, tipo: 'emprestimo'}
    → ValidationQueueService.consumirCodigo(matricula, codigo, 'emprestimo')
        → Redis: GET vqueue:{matricula}:emprestimo → valida código
        → Se inválido/expirado: throw ValidationException
        → LoanService.registrarEmprestimo(matricula, operador_nome, quantidade)
            → BEGIN TRANSACTION
            → SELECT id, codigo, status FROM itens
                WHERE status = 'disponivel' AND status_ativo = true
                LIMIT quantidade
                FOR UPDATE
            → Se insuficientes: ROLLBACK → throw InsufficientItemsException
            → UPDATE itens SET status='emprestado', solicitante_matricula=?, data_emprestimo=now()
            → INSERT INTO solicitacoes (matricula, nome_funcionario, item_codigo, operador_nome) × N
            → COMMIT
        → DashboardService.invalidateCache()  (DEL dashboard:data:*)
        → Redis: DEL vqueue:{matricula}:emprestimo
        → Redis: SET vresult:{matricula} {sucesso:true, mensagem:'Empréstimo registrado'} EX 60
        → SSEManager.emit(matricula, 'operation_confirmed', {sucesso:true, mensagem})
    → return {sucesso: true}

PASSO 6 — Solicitante recebe resultado via SSE
  [TelaSolicitante] Evento SSE 'operation_confirmed' → exibe resultado → auto-reset
```

**Pontos de falha:**
- Redis indisponível em PASSO 2: código não gerado → Setor vê erro 503
- PostgreSQL timeout em PASSO 5 (lock contention): transação faz retry 1x com backoff 200ms
- SSE desconectado: resultado lido em próxima requisição a `/ops/pending/:matricula`

**Logs esperados:** `{evento:'gerar_codigo', matricula, tipo, operador, timestamp}` | `{evento:'confirmar_operacao', matricula, tipo, operador, itens, timestamp, duracao_ms}`

---

### 5.4 Fluxo de Devolução com Seleção de Item

```
PASSO 1 — Setor lista itens do funcionário
  [TelaSetor] GET /ops/itens-emprestados/:matricula
    → Prisma: SELECT itens WHERE solicitante_matricula = ? AND status = 'emprestado'
    → return [{codigo, descricao}]  ← Setor vê e seleciona os que estão sendo devolvidos

PASSO 2 — Setor gera código de devolução
  POST /ops/gerar-codigo
    {matricula, tipo: 'devolucao', quantidade, item_codigos: ['KIT-001']}
    → armazena item_codigos no Redis com o código

PASSO 5 — Setor confirma
  POST /ops/confirmar {matricula, codigo, tipo: 'devolucao'}
    → ReturnService.registrarDevolucao(matricula, item_codigos, operador_nome)
        → BEGIN TRANSACTION
        → SELECT id, codigo, status, solicitante_matricula FROM itens
            WHERE codigo IN (item_codigos) AND status = 'emprestado' AND solicitante_matricula = ?
            FOR UPDATE
        → Valida que todos os itens selecionados pertencem ao funcionário
        → UPDATE itens SET status='disponivel', solicitante_matricula=NULL, data_emprestimo=NULL
        → INSERT INTO devolucoes (matricula, nome_funcionario, item_codigo, operador_nome) × N
        → COMMIT
        → DashboardService.invalidateCache()
```

---

### 5.5 Fluxo de Exportação

```
[TelaAdmin] POST /admin/export {filtros}
  → ExportService.gerarXlsx(filtros)
      → DashboardService.getData(filtros)  (lê do cache ou banco)
      → exceljs: cria Workbook em memória
          → Sheet 1: Resumo (KPIs)
          → Sheet 2: Solicitações (linhas filtradas)
          → Sheet 3: Devoluções (linhas filtradas)
      → workbook.xlsx.writeBuffer()  → Buffer
  → Response: Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
              Content-Disposition: attachment; filename="reunir_export_{timestamp}.xlsx"
              Body: Buffer
```

**Sem arquivo temporário. Sem Drive. Sem fallback CSV.** Em erro: HTTP 500 com `{erro: 'Falha ao gerar exportação'}`.

---

## 6. Integrações Externas

| Integração | Tipo | Autenticação | Dados | Tratamento de Falha |
|---|---|---|---|---|
| **PostgreSQL 16** | ORM (Prisma) | `DATABASE_URL` env var | Todas as entidades operacionais | Reconexão automática do Prisma; erro HTTP 503 em falha persistente |
| **Redis 7** | Driver (ioredis) | `REDIS_URL` env var | Sessões, filas, cache de dashboard | Operações não-críticas (cache) degradam gracefully; operações de sessão retornam 503 |
| **exceljs** | Biblioteca npm (in-process) | N/A — lib local | Geração de .xlsx em memória | Erro de geração → HTTP 500 |

**Nenhuma integração externa de rede no caminho crítico de empréstimo/devolução** (RNF-04). QR Code removido. Google Drive removido. Google Sheets API usada apenas no script de migração pontual (fora do runtime).

---

## 7. Segurança

### Autenticação

| Perfil | Mecanismo | Token | Armazenamento |
|---|---|---|---|
| Setor | Usuario+senha → bcrypt.compare | UUID v4 em Redis `sess:{token}` TTL 12h | Cliente: localStorage; servidor: Redis |
| Administrador | Idem | Idem | Idem |
| Solicitante | Matrícula apenas (sem senha) | UUID v4 em Redis `sess:sol:{token}` TTL 1h | Cliente: sessionStorage (limpo ao fechar tab) |

- Token enviado em `Authorization: Bearer {token}` em todos os requests.
- Middleware `authenticate` valida token no Redis antes de qualquer handler.

### Autorização (RBAC por rota)

| Rota | Perfil Permitido |
|---|---|
| `POST /auth/login`, `POST /auth/solicitante` | Público |
| `GET /ops/stream`, `GET /ops/pending/:mat` | `solicitante` |
| `POST /ops/gerar-codigo`, `POST /ops/confirmar`, `POST /ops/cancelar`, `GET /ops/status-setor/:mat`, `GET /ops/itens-emprestados/:mat`, `GET /ops/funcionario/:mat` | `setor` |
| `GET /admin/*`, `POST /admin/*`, `PUT /admin/*`, `DELETE /admin/*` | `admin` |

- Middleware `authorize(perfis[])` aplicado por grupo de rotas.
- Tentativa de acesso com perfil incorreto: HTTP 403.

### Proteção de Dados Sensíveis

- `senha_hash` nunca retornada em nenhum endpoint — Prisma select explícito sem o campo.
- `ADMIN_SEED_PASSWORD`, `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET` lidos exclusivamente de variáveis de ambiente — nunca no código-fonte (RNF-05).
- bcrypt rounds=12 para senhas de credenciais.
- Validação de entrada via Zod em todos os endpoints — previne injeção de parâmetros.
- Helmet middleware no Fastify: CSP, X-Frame-Options, HSTS.

### Auditoria e Rastreabilidade

- Toda requisição loga `{usuario, perfil, ip, metodo, rota, status, duracao_ms, timestamp}` (RNF-02).
- Toda operação administrativa grava registro em tabela `auditoria` com estado antes/depois (RNF-06).
- `operador_nome` obrigatório em `solicitacoes` e `devolucoes` — rastreabilidade individual (RNF-02).
- Logs estruturados JSON via Pino (integrado no Fastify) — campos consistentes por tipo de evento.

---

## 8. Observabilidade

### Logs

**Formato:** JSON estruturado via Pino. Destino: stdout (container) → redirecionado pelo sistema operacional host.

| Tipo de Evento | Campos obrigatórios |
|---|---|
| Request HTTP | `evento, metodo, rota, status, duracao_ms, usuario, perfil, ip, timestamp` |
| Login (sucesso/falha) | `evento:'auth.login', usuario, perfil, resultado, ip, timestamp` |
| Operação de empréstimo | `evento:'loan.created', matricula, itens[], operador_nome, timestamp, duracao_ms` |
| Operação de devolução | `evento:'return.created', matricula, itens[], operador_nome, timestamp, duracao_ms` |
| Ação administrativa | `evento:'admin.{entidade}.{acao}', registro_id, operador, timestamp` |
| Erro interno | `evento:'error', tipo, mensagem, stack (apenas dev), request_id, timestamp` |

### Métricas (mínimo v2)

- Contagem de operações por tipo (empréstimo, devolução) por dia — consultável via SQL em `solicitacoes`/`devolucoes`
- Contagem de logins por perfil — consultável via logs
- Tempo de resposta por endpoint — logado em cada request

### Alertas

**PENDENTE** — Sistema de alertas depende de infraestrutura de monitoramento disponível no ambiente on-prem (ex.: Uptime Kuma, Grafana+Loki, Zabbix). Não definido neste documento.

### Health Check

`GET /health` → HTTP 200 `{status:'ok', db:'ok'|'degraded', redis:'ok'|'degraded', timestamp}` — verifica conexão com PostgreSQL e Redis. Usado pelo Docker Compose healthcheck.

### Correlação de Requisições

- `requestId` UUID gerado por Fastify por request, incluído em todos os logs do ciclo de vida.
- Passado opcionalmente como header `X-Request-ID` na resposta.

---

## 9. Configuração e Ambiente

### Variáveis de Ambiente

| Variável | Obrigatória | Exemplo | Notas |
|---|---|---|---|
| `DATABASE_URL` | Sim | `postgresql://user:pass@postgres:5432/reunir` | Prisma connection string |
| `REDIS_URL` | Sim | `redis://redis:6379` | ioredis connection string |
| `SESSION_TTL_SECONDS` | Não | `43200` | Default: 43200 (12h) |
| `VALIDATION_TTL_SECONDS` | Não | `3600` | Default: 3600 (1h) |
| `BCRYPT_ROUNDS` | Não | `12` | Default: 12 |
| `ADMIN_SEED_PASSWORD` | Sim (deploy inicial) | `ReunirAdmin@2026` | Usado apenas no seed; alterar após primeiro acesso |
| `PORT` | Não | `3000` | Default: 3000 |
| `NODE_ENV` | Sim | `production` | `development`|`production` |
| `LOG_LEVEL` | Não | `info` | Pino level: `trace`|`debug`|`info`|`warn`|`error` |

### Secrets

- Nenhuma credencial de acesso no código-fonte ou repositório (RNF-05).
- Arquivo `.env` NÃO comitado — listado no `.gitignore`.
- Em produção: variáveis injetadas via `docker-compose.override.yml` ou `.env` local no host.

### Configurações por Ambiente

| Configuração | Dev | Produção |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `LOG_LEVEL` | `debug` | `info` |
| `BCRYPT_ROUNDS` | `4` (rápido em testes) | `12` |
| PostgreSQL | localhost:5432 | container interno `postgres:5432` |
| Redis | localhost:6379 | container interno `redis:6379` |

---

## 10. Estratégia de Deploy

### Tipo de Deploy

**Manual — on-premises via Docker Compose** (04 PENDENTE-C). Sem CI/CD externo na V2.

### Estrutura Docker Compose (produção)

```yaml
services:
  app:
    image: reunir-v2:latest        # built localmente
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on: {postgres: {condition: service_healthy}, redis: {condition: service_healthy}}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      retries: 3

  postgres:
    image: postgres:16-alpine
    volumes: ["postgres_data:/var/lib/postgresql/data"]
    environment: {POSTGRES_DB: reunir, POSTGRES_USER: ..., POSTGRES_PASSWORD: ...}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]

  redis:
    image: redis:7-alpine
    volumes: ["redis_data:/data"]
    command: redis-server --save 60 1 --appendonly yes

volumes:
  postgres_data:
  redis_data:
```

### Dockerfile (app)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build   # tsc → dist/

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
RUN npx prisma generate
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Ambientes

| Ambiente | Infraestrutura | Deploy |
|---|---|---|
| Dev | Docker Compose local ou Node.js + PostgreSQL/Redis locais | `npm run dev` (ts-node-dev) |
| Produção | Docker Compose no servidor on-prem | `docker compose up -d --build` |

**Nota:** Sem ambiente de homologação formal no escopo V2 (PRD § 3 Não-Objetivos).

### Migrations

- Executadas como parte do startup da aplicação via `prisma migrate deploy` no entrypoint.
- Migrations versionadas em `prisma/migrations/`.

### Rollback

- Docker Compose: `docker compose down && docker compose up -d` com imagem anterior (`reunir-v2:v1.0.x`).
- Banco: `prisma migrate resolve --rolled-back {migration_name}` + restore de backup (se necessário).
- Backup PostgreSQL: `pg_dump` agendado no host antes de cada deploy.

---

## 11. Estratégia de Migração (V1 → V2)

### Dados a Migrar

**Decisão registrada (PRD § 8, 04 § 8):** V2 parte de banco limpo. Sem migração de dados históricos das Sheets.

| Item | Estratégia |
|---|---|
| Dados históricos (SOLICITACOES, DEVOLUCOES, RESULTADOS) | Preservados nas Sheets originais como arquivo histórico somente-leitura; não importados para PostgreSQL |
| Cadastro de funcionários (FUNCIONARIOS) | Re-cadastro manual via interface Admin (FN-02) pós-deploy |
| Inventário de kits (ITENS) | Re-cadastro manual via interface Admin (FN-01) pós-deploy |
| Credenciais de acesso | Seed com credencial admin padrão; Admin cria credenciais de Setor via FN-03 |
| Configurações (limite de kits) | Seed com valor padrão = 2; Admin altera se necessário |

### Pré-Condições para o Corte

1. Schema PostgreSQL aplicado (`prisma migrate deploy` executado com sucesso).
2. Seed executado: credencial admin padrão ativa.
3. Cadastro inicial de funcionários e kits concluído pelo Admin via interface.
4. Credenciais de Setor criadas pelo Admin via FN-03.
5. Sistema V2 validado funcionalmente no ambiente de produção (fluxo completo de empréstimo + devolução + dashboard + exportação).
6. V1 (GAS) pausada: script GAS desativado (não deletado).
7. Backup manual das Sheets originais confirmado.

### Estratégia de Corte: Big-Bang

- Data/hora definida operacionalmente.
- V1 desativada e V2 ativada no mesmo evento.
- Sem período de coexistência: as persistências são completamente independentes.

### Riscos Técnicos de Migração

| Risco | Mitigação |
|---|---|
| Admin não conclui re-cadastro antes do corte | Validar pré-condição 3 explicitamente antes de prosseguir |
| Credenciais de Setor não criadas | Validar pré-condição 4; ter credencial admin como fallback operacional temporário |
| Falha no deploy Docker Compose | Restore imagem anterior + `docker compose up -d` |
| Seed aplicado com senha padrão exposta | Admin altera no primeiro acesso; `ADMIN_SEED_PASSWORD` removida do `.env` após seed |

### Plano de Fallback

- V1 (GAS) mantida inativa (não deletada) por 30 dias após o corte.
- Se V2 apresentar falha crítica: reativar V1 via painel GAS + retomar com Sheets.
- Dados gerados em V2 nesse período ficam em PostgreSQL — não retrocedem para Sheets.

---

## 12. Decisões Técnicas Importantes (ADR Resumido)

### ADR-01 — Fastify vs Express

| Campo | Detalhe |
|---|---|
| **Decisão** | Fastify 4 |
| **Alternativas** | Express 4/5 |
| **Motivo** | Fastify: ~3× mais rápido em benchmarks; validação de schema built-in (reduz boilerplate com Zod); suporte TypeScript first-class; logger Pino integrado. Express: mais familiar mas sem vantagem que justifique a diferença de performance e DX. |
| **Consequências** | Curva de aprendizado marginal para times com experiência apenas em Express; plugins Fastify têm sintaxe própria de registro. |

### ADR-02 — Prisma vs Drizzle ORM

| Campo | Detalhe |
|---|---|
| **Decisão** | Prisma 5 |
| **Alternativas** | Drizzle ORM |
| **Motivo** | Prisma: DX mais madura; migrations geradas automaticamente (`prisma migrate dev`); client TypeScript gerado elimina mismatch tipo/schema; ecossistema estável. Drizzle: mais performático, mais próximo de SQL raw, mas menos maduro em migrations e menor ecossistema. Para o volume e escopo deste sistema, DX e migrations pesam mais que throughput máximo. |
| **Consequências** | Prisma gera código; `prisma generate` deve ser executado após cada mudança de schema. |

### ADR-03 — Redis para Cache e Filas vs In-Memory

| Campo | Detalhe |
|---|---|
| **Decisão** | Redis 7 (ioredis) |
| **Alternativas** | Map/objeto in-memory (Node.js) |
| **Motivo** | Redis: persiste entre restarts do container; suporta TTL nativo; permite escalar para múltiplas instâncias no futuro sem refatoração. In-memory: mais simples, zero infra adicional, mas sessões perdem-se em restart e não escala horizontalmente. Dado que o deploy usa Docker Compose (Redis já é um container), o custo operacional é equivalente. |
| **Consequências** | Redis é ponto de falha adicional — mitigado com healthcheck e degradação graceful no cache de dashboard. |

### ADR-04 — Sessão Server-Side vs JWT Stateless

| Campo | Detalhe |
|---|---|
| **Decisão** | Sessão server-side com token UUID armazenado no Redis |
| **Alternativas** | JWT stateless (assinado com HS256, sem armazenamento servidor) |
| **Motivo** | FN-03 exige revogação imediata de credencial individual. Com JWT stateless, revogação requer blacklist (que é essencialmente uma sessão server-side) ou TTL curto que força re-login frequente. Sessão server-side: `DEL sess:{token}` é a revogação — imediata, sem overhead. Dado que o sistema é on-prem com Redis já presente (ADR-03), o custo é zero. |
| **Consequências** | Estado de sessão depende da disponibilidade do Redis; se Redis cair, todas as sessões são invalidadas (comportamento aceitável — usuários fazem login novamente). |

### ADR-05 — SSE vs WebSocket para Notificação em Tempo Real

| Campo | Detalhe |
|---|---|
| **Decisão** | SSE (Server-Sent Events) |
| **Alternativas** | WebSocket (ws/socket.io) |
| **Motivo** | Comunicação é unidirecional servidor→cliente (servidor emite código gerado e resultado; cliente não envia dados por esse canal). SSE: mais simples, nativo em browsers, reconexão automática, funciona sobre HTTP/1.1, sem biblioteca adicional no cliente. WebSocket: bidirecional, overhead de protocolo desnecessário para este caso, requer biblioteca ou polyfill. SSE atende P-08 (substituir polling 500ms) com menor complexidade. |
| **Consequências** | SSE tem limite de 6 conexões simultâneas por domínio no HTTP/1.1 — mitigado pelo HTTP/2 (suportado pelo Fastify) que multiplexe sobre uma única conexão TCP. |

---

## 13. Riscos Técnicos

| # | Risco | Impacto | Mitigação Técnica |
|---|---|---|---|
| RT-01 | Redis reiniciado/falhado → todas as sessões invalidadas | Todos os usuários perdem sessão simultaneamente | Redis com `appendonly yes` (persistência); healthcheck com restart automático no Docker Compose; usuários fazem login novamente (operação < 10s) |
| RT-02 | Lock contention no PostgreSQL em alta concorrência (> 5 operações simultâneas) | Operações enfileiradas; latência > RNF-03 | `SELECT FOR UPDATE NOWAIT` com retry 1× (200ms backoff); retornar 503 após segundo timeout; monitorar `pg_stat_activity` |
| RT-03 | Migration Prisma falha em produção durante startup | Container não sobe; downtime | `prisma migrate deploy` com output em log; script de rollback documentado; backup pré-deploy obrigatório |
| RT-04 | Re-cadastro incompleto de funcionários/kits no corte | Operações falham por matrícula não encontrada | Validar contagem pré-corte; checklist de pré-condições (seção 11) |
| RT-05 | SSE não reconecta após queda de rede curta | Solicitante fica sem notificação | Cliente implementa `EventSource` com `reconnectInterval`; ao reconectar, GET `/ops/pending/:matricula` verifica código ativo no Redis |
| RT-06 | Crescimento de tabelas `solicitacoes`/`devolucoes` sem estratégia de arquivamento | Degradação de performance do dashboard | Índices em `timestamp` (seção 4.4); PRD § 3 exclui arquivamento do escopo V2 — criar issue para V3 |
| RT-07 | Credencial admin padrão não alterada no primeiro acesso | Senha conhecida no repositório | Forçar troca de senha no primeiro login (flag `deve_alterar_senha` na tabela `credenciais`) — **PENDENTE de implementação** |

---

## 14. Pendências Técnicas (PENDENTE)

| # | Item | Bloqueia |
|---|---|---|
| P-TDD-01 | **Destino dos logs em produção**: stdout para arquivo de texto, Loki, Elastic, ou outro sistema de log do ambiente on-prem. Impacta configuração do Pino transport. | Seção 8 Alertas |
| P-TDD-02 | **Estratégia de alertas**: Uptime Kuma, Grafana, Zabbix ou monitoramento manual. Impacta observabilidade de falhas silenciosas (Redis down, PostgreSQL lento). | Seção 8 Alertas |
| P-TDD-03 | **Força de troca de senha no primeiro login**: tabela `credenciais` precisa de coluna `deve_alterar_senha boolean` e endpoint `POST /auth/alterar-senha`. Necessário para RT-07. | Segurança (RT-07) |
| P-TDD-04 | **Definição das credenciais iniciais de Setor** (nomes completos + usuários + senhas iniciais) que o Admin cadastrará via FN-03 no dia do corte. Depende de informação do cliente. | Deploy (pré-condição 4) |
| P-TDD-05 | **Backup agendado do PostgreSQL**: script de `pg_dump` + retenção no host. Formato e frequência dependem da política do TI institucional. | Deploy / Rollback |
| P-TDD-06 | **HTTP/2 no Fastify em produção**: se a rede interna não suportar TLS (necessário para HTTP/2), o limite de 6 conexões SSE simultâneas do HTTP/1.1 pode ser atingido com volume de usuários. Avaliar uso de proxy reverso (Nginx) com TLS terminado no proxy. | ADR-05 (SSE + HTTP/2) |
| P-TDD-07 | **Estrutura de diretórios e convenção de nomes de arquivos TypeScript** (ex: feature-based vs layer-based). Não bloqueia arquitetura mas deve ser definida antes do início da implementação. | Implementação |
