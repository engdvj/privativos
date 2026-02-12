# 04_TECH_EVALUATION_STACK_RECOMMENDATION — Appscript Reunir

---

## 1. Resumo Executivo

**Stack Recomendada:** Node.js + TypeScript (Fastify ou Express)
**Alternativa (Fallback):** Python 3 + FastAPI

**Motivos centrais:**
- A V1 é inteiramente JavaScript (GAS); TypeScript é evolução direta — menor curva de aprendizado de qualquer opção avaliada (critério C-09, peso 9 na matriz).
- PostgreSQL + Prisma/Drizzle entregam tipagem end-to-end TypeScript↔DB, transações com `SELECT FOR UPDATE` (RNF-01, RNF-07) e migrations automatizadas — sem lacuna funcional em relação a EF Core ou Spring Data JPA para este escopo.
- Nenhuma evidência de volume alto ou escalabilidade agressiva (P-01) — Node.js é suficiente; elimina o overhead de JVM (Java) e de .NET runtime.
- TypeScript resolve estruturalmente os problemas de escopo global e redeclaração que causaram GAP-TECH-05, GAP-TECH-06, GAP-TECH-07 — a tipagem estática torna esses bugs impossíveis por construção.
- Container Node.js (~50MB Alpine) é o mais leve da matriz — adequado para on-prem (P-13 = servidor interno institucional).

**Principais riscos:**
- Ecosistema npm tem rotatividade de dependências — mitigado com TypeScript estrito e bibliotecas consolidadas.
- Auth sem primitivo nativo (diferente de .NET Identity) — mitigado com jose + bcrypt (consolidados).

**Decisões de infraestrutura já fechadas:**
- Banco: PostgreSQL | Ambiente: on-prem | Corte: big-bang | QR Code: removido

---

## 2. Premissas Derivadas do AS-IS/GAP/PRD

| # | Premissa | Fonte |
|---|---|---|
| P-01 | Sistema operacional interno com 3 perfis e volume não documentado — sem evidência de alta escala ou crescimento agressivo | AS-IS seção 3; PRD seção 4 |
| P-02 | Time atual domina JavaScript: toda a V1 é JS puro em GAS (V8) sem transpilador | AS-IS seção 7 |
| P-03 | Google Sheets **não** é mais persistência runtime — dados históricos migrados para banco relacional em corte único; Sheets API usada apenas na migração | PRD seção 7 — decisão registrada em 2026-02-11 |
| P-04 | Google Drive API **removida** — exportação implementada com biblioteca nativa (exceljs); nenhum arquivo criado no Drive; resolve FMD-05 integralmente | PRD seção 7 — decisão registrada em 2026-02-11 |
| P-16 | **DECIDIDO:** Persistência da V2 é banco relacional (PostgreSQL como opção preferida — a confirmar no TDD). Resolve GAP-TECH-03, GAP-ARCHI-02, GAP-TECH-04, RNF-07 com transações nativas. | Decisão registrada em 2026-02-11 |
| P-05 | Autenticação individual por usuário é P0: toda operação deve ser rastreável ao indivíduo que a executou | PRD FMD-01, FN-03, RNF-02 |
| P-06 | Auditoria formal de operações administrativas é requisito verificável: usuário + timestamp + dado alterado | PRD RNF-06 |
| P-07 | Concorrência de no mínimo 2 pares simultâneos (Setor + Solicitante) é requisito de confiabilidade | PRD RNF-01 |
| P-08 | Polling intenso atual (500ms Solicitante, 3s Setor) pode ser substituído por SSE ou WebSocket na V2; elimina carga repetitiva | AS-IS seção 10; PRD RNF-03 |
| P-09 | Nenhuma credencial de acesso pode estar no código-fonte ou repositório git | PRD RNF-05; GAP-TECH-01 |
| P-10 | Exportação deve ser determinística: formato fixo, sem arquivo temporário acumulado no Drive | PRD FMD-05; GAP-FUNC-06 |
| P-11 | Sem evidência de requisito de SSO, LDAP ou AD — autenticação própria com credenciais individuais gerenciadas pelo Admin via interface | PRD FN-03; FMD-01 — nenhuma menção a SSO nos três documentos |
| P-12 | QR Code: manter, substituir por geração interna ou remover é decisão pendente | PRD PENDENTE-02; GAP-TECH-08 |
| P-13 | Ambiente de execução (GCP Cloud Run, VPS, on-prem) não está definido em nenhum dos três documentos | Ausente em AS-IS, GAP e PRD |
| P-14 | Transações são necessárias para RNF-07 (consistência em falha parcial): sistema não pode deixar itens em estado intermediário | PRD RNF-07; GAP-ARCHI-02 |
| P-15 | **DECIDIDO:** A V2 inclui migração da plataforma de execução para fora do GAS. PRD seção 3 atualizado — Não-Objetivo de permanência no GAS removido. | PRD seção 3 — decisão registrada em 2026-02-11 |

---

## 3. Critérios de Decisão

| # | Critério | Peso (0–10) | Justificativa |
|---|---|---|---|
| C-01 | Velocidade de entrega | 7 | Projeto interno — entrega importa, mas sem urgência crítica documentada |
| C-02 | Manutenibilidade | 8 | Sistema operacional de longo prazo; time pequeno; GAPs de manutenção são recorrentes no AS-IS |
| C-03 | Facilidade de contratação / mercado | 6 | Ambiente institucional com pool de devs limitado; peso menor pois não há contratação imediata documentada |
| C-04 | Integrações (HTTP + ORM + APIs externas) | 5 | P-16: Sheets e Drive removidos do runtime; fator diferenciador passa a ser qualidade do ORM para banco relacional e suporte HTTP |
| C-05 | Segurança / controle de acesso / auditoria | 8 | RNF-05 e RNF-06 são P0; GAP-FUNC-01 e GAP-TECH-01 são os gaps mais críticos do sistema |
| C-06 | Observabilidade (logs, rastreio) | 7 | RNF-02 exige rastreabilidade individual; RNF-06 exige auditoria de operações admin |
| C-07 | Escalabilidade | 2 | Sem evidência de crescimento agressivo (P-01); peso mínimo deliberado |
| C-08 | Custo operacional (infra + complexidade) | 7 | Ambiente institucional: orçamento restrito presumido, equipe pequena |
| C-09 | Curva de aprendizado (time atual) | 9 | P-02: time já domina JS — maior peso porque é o fator com maior assimetria entre as opções |
| C-10 | Adequação ao ambiente de execução | 7 | P-13: ambiente não definido; peso moderado para flexibilidade de deploy |

**Peso total:** 66

---

## 4. Opções de Stack a Avaliar

### A) Node.js + TypeScript (Fastify ou Express)

**Descrição:** Runtime JavaScript no servidor com tipagem estática via TypeScript. Fastify (~3× mais rápido que Express em benchmarks) ou Express (mais familiar). Ecosistema npm.

**Pontos fortes:**
- Time domina JS (P-02) → TypeScript é evolução direta, não nova linguagem; reduz risco de adoção
- Prisma e Drizzle são ORMs TypeScript-first de primeira classe para PostgreSQL — tipagem end-to-end, migrations automatizadas (C-04)
- TypeScript elimina por construção os erros de escopo global e redeclaração que causaram GAP-TECH-05, GAP-TECH-06, GAP-TECH-07
- Ecosistema maduro para os requisitos do projeto: jose/bcrypt (auth), winston/pino (logs), exceljs (export .xlsx nativo sem Drive), ioredis (cache), zod (validação)
- Container leve (~50MB Alpine) — adequado para Cloud Run, VPS modesta ou on-prem com recursos limitados
- SSE nativo com Express/Fastify — substitui polling de 500ms (P-08) sem custo extra de infraestrutura

**Pontos fracos:**
- Ecosistema npm tem rotatividade de dependências — risco de breaking changes em dependências menores
- Sem framework "opinionated" padrão — decisões de arquitetura ficam com o time (pode ser fraqueza se o time for inexperiente em design de APIs)
- TypeScript adiciona etapa de compilação (tsc) → necessário configurar toolchain

**Riscos para este projeto:**
- Escolha de ORM (Prisma vs Drizzle) é decisão do TDD — ambos são válidos, diferença está em DX vs controle de query
- Auth sem primitivo nativo (diferente de .NET Identity) exige escolha cuidadosa de biblioteca (jose + bcrypt são consolidados)

**Melhor escolha quando:** time atual domina JS/TS, infra é limitada, entrega rápida é necessária, banco relacional é a persistência.

---

### B) Python 3.12 + FastAPI

**Descrição:** Framework Python assíncrono com validação nativa via Pydantic v2, geração automática de OpenAPI, e suporte a async/await por design.

**Pontos fortes:**
- FastAPI + Pydantic oferecem validação de request/response e geração automática de OpenAPI com menos boilerplate
- SQLAlchemy 2.x + asyncpg é uma stack madura para PostgreSQL com suporte completo a transações (RNF-07)
- Ecosistema Python para logging estruturado, testes (pytest) e exportação (openpyxl) é sólido
- Fácil de contratar no mercado geral — Python é a linguagem mais popular globalmente (C-03)

**Pontos fracos:**
- Time atual conhece JS, não Python — curva de aprendizado real (P-02 → impacto direto em C-09)
- Deploy levemente mais complexo que Node para ambientes simples (virtualenv, requirements.txt)
- GIL limita concorrência CPU-bound — irrelevante para este sistema, mas é limitação arquitetural conhecida
- Com banco relacional, perde a vantagem que tinha quando Sheets era o diferenciador de integração — cai para 4º no ranking

**Riscos para este projeto:**
- Curva de aprendizado do time é o maior risco operacional: toda a V1 é JavaScript
- Passou de 2º para 4º no ranking com a decisão de banco relacional (score 461 vs .NET 477)

**Melhor escolha quando:** time tem ou contratará dev Python; há necessidade de integração futura com ferramentas de análise de dados.

---

### C) .NET 8 (ASP.NET Core)

**Descrição:** Framework Microsoft, fortemente tipado, maduro, com ASP.NET Identity para autenticação, Entity Framework Core para ORM, e suporte enterprise completo.

**Pontos fortes:**
- ASP.NET Identity + claims/roles endereça GAP-FUNC-01, GAP-TECH-01, RNF-02 e RNF-06 com primitivos nativos — menor esforço de implementação de auth individual
- Entity Framework Core com transações declarativas resolve GAP-ARCHI-02 e GAP-TECH-04 (RNF-07) de forma nativa
- Fortemente tipado por design — elimina os problemas de `var` e escopo global do GAS (GAP-TECH-07)
- Performance de Kestrel é superior a Node e Python em cenários de alta carga (irrelevante aqui, mas é vantagem futura)

**Pontos fracos:**
- Pool de contratação menor no mercado institucional brasileiro para C# / .NET
- Linguagem completamente diferente de JS → curva de aprendizado alta para time atual (C-09) — empatado com Python (ambos pontuam 5)
- Runtime .NET (~200MB) mais pesado que Node (~50MB) — impacta custo de infra (C-08)
- Maior boilerplate de configuração para um sistema de escala pequena

**Riscos para este projeto:**
- Sem dev C# disponível, a vantagem de EF Core + Identity fica inacessível ao time atual
- Escolha incorreta de Identity scheme (cookies vs JWT) pode complicar revogação de sessão (FN-03)

**Melhor escolha quando:** persistência é banco SQL relacional (já decidido — P-16) **e** há dev C# disponível ou contratação prevista. Sobe para 2º no ranking com banco relacional (477 vs Python 461).

---

### D) Java 21 + Spring Boot 3

**Descrição:** Framework JVM maduro, opinionated, com Spring Security, Spring Data JPA, Micrometer para observabilidade e ecossistema enterprise completo.

**Pontos fortes:**
- Spring Security é a implementação de segurança enterprise mais testada em produção — endereça RNF-02, RNF-05, RNF-06
- Spring Data JPA com transações declarativas via `@Transactional` resolve GAP-ARCHI-02 e GAP-TECH-04 (RNF-07)
- Micrometer + Spring Actuator oferecem observabilidade de produção imediata (C-06)
- Longa vida útil: Spring Boot mantém compatibilidade por ciclos longos — bom para manutenção de longo prazo

**Pontos fracos:**
- Mais verboso e com maior boilerplate: adicionar uma entidade requer mais arquivos do que qualquer outra opção
- JVM: startup lento (~3-5s) + memória mínima ~300-500MB — incompatível com serverless (Cloud Run cold start) e overkill para este volume
- `google-api-services-sheets` é o SDK menos ativo das 4 opções avaliadas (C-04)
- Curva de aprendizado mais alta da matriz para time JavaScript (C-09)

**Riscos para este projeto:**
- Startup lento incompatível com deploy serverless (PENDENTE-C define o ambiente de hospedagem)
- Overhead de configuração (beans, application.yml, injeção de dependência) supera o necessário para o escopo atual
- Se persistência permanecer em Sheets, vantagens JPA/Hibernate são inúteis

**Melhor escolha quando:** time já tem expertise Java/Spring; há integração com sistemas enterprise legados em Java; SLA de alta disponibilidade e escala real são exigidos.

---

## 5. Matriz de Decisão

| Critério | Peso | A: Node.js+TS | B: Python+FastAPI | C: .NET 8 | D: Java+Spring |
|---|:---:|:---:|:---:|:---:|:---:|
| C-01 Velocidade de entrega | 7 | 8 | 8 | 6 | 5 |
| C-02 Manutenibilidade | 8 | 7 | 6 | 9 | 9 |
| C-03 Contratação / mercado | 6 | 9 | 8 | 6 | 7 |
| C-04 Integrações (HTTP+ORM) | 5 | 9 | 8 | 9 | 9 |
| C-05 Segurança / auditoria | 8 | 7 | 7 | 9 | 9 |
| C-06 Observabilidade | 7 | 8 | 7 | 8 | 9 |
| C-07 Escalabilidade | 2 | 8 | 7 | 9 | 9 |
| C-08 Custo operacional | 7 | 9 | 8 | 6 | 5 |
| C-09 Curva de aprendizado | 9 | 9 | 5 | 5 | 4 |
| C-10 Adequação ao ambiente | 7 | 8 | 7 | 7 | 7 |
| **Score ponderado** | **66** | **539** | **461** | **477** | **467** |

> **Cálculos C-04 (ORM com banco relacional):**
> Node: 5×9=45 (Prisma/Drizzle) · Python: 5×8=40 (SQLAlchemy) · .NET: 5×9=45 (EF Core) · Java: 5×9=45 (Spring Data JPA)
>
> **Cálculos C-09 (curva de aprendizado):**
> Node: 9×9=81 · Python: 9×5=45 · .NET: 9×5=45 · Java: 9×4=36

**Pontos que decidiram o ranking:**

1. **C-09 (Curva de aprendizado, peso 9) é o critério dominante e inalterado:** Node.js+TS pontuou 9 (time já sabe JS) vs Python 5, .NET 5, Java 4. Vantagem de 36–45 pontos ponderados sobre todos os concorrentes — critério único que mais separa Node.js do restante.

2. **C-08 (Custo operacional, peso 7):** Container Node.js (~50MB) vs JVM Java (~300–500MB) → 28 pontos de diferença. Node.js vs .NET (~200MB) → 21 pontos. Relevante para ambiente institucional com infra limitada (P-13).

3. **C-04 (ORM + HTTP, peso 5 — reduzido):** Com banco relacional decidido, .NET (EF Core) e Java (Spring Data JPA) pontuam 9 — empatados com Node.js (Prisma/Drizzle). Python (SQLAlchemy) pontua 8. Critério não diferencia mais Node.js; era o maior diferenciador quando Sheets estava no caminho crítico.

4. **C-05 (Segurança/auditoria, peso 8):** .NET e Java pontuam 9 (Identity/Spring Security). Node.js pontua 7. Diferença de 16 pontos não inverte o resultado, mas é o argumento mais forte para considerar .NET como fallback — suas primitivas de auth/auditoria (Identity + EF Core + roles) endereçam RNF-05, RNF-06 e RNF-07 nativamente.

5. **Reordenação do ranking com banco relacional:** Python cai de 2º para 4º (493 → 461) porque perdia menos pontos quando Sheets e Drive eram críticos. .NET sobe de 3º para 2º (486 → 477) pela combinação EF Core + Identity agora plenamente aproveitável. Java mantém 3º (467). Node.js mantém 1º e abre vantagem sobre o 2º colocado: 539 − 477 = 62 pontos.

6. **C-02 (Manutenibilidade, peso 8):** .NET e Java pontuam 9; Node.js TS pontuou 7. A diferença (16 pontos) é real mas coberta pelos ganhos em C-08 e C-09. TypeScript endereça o problema de manutenibilidade da V1 (escopo global sem tipagem — GAP-TECH-05/06/07) de forma suficiente para o escopo.

---

## 6. Recomendação Final

### Stack Recomendada (Principal): Node.js + TypeScript

**Justificativa objetiva:**
- O time atual conhece JavaScript — base da V1. TypeScript é evolução direta; elimina os bugs de escopo global (GAP-TECH-05/06/07) que são impossíveis em JS puro sem custo de aprendizado de nova linguagem (C-09 = 9; maior assimetria da matriz).
- Com banco relacional decidido (P-16), Prisma ou Drizzle entregam tipagem end-to-end PostgreSQL ↔ TypeScript — sem lacuna funcional em relação a EF Core ou Spring Data JPA para o escopo deste sistema.
- Exportação via `exceljs` em memória — sem Google Drive, sem arquivo temporário, resolve FMD-05 integralmente com uma biblioteca npm.
- O sistema tem escala pequena (P-01). As vantagens de Spring Boot (.NET, Java) em escalabilidade e enterprise-features são irrelevantes — overhead (JVM, runtime, boilerplate) é custo sem benefício para este escopo.
- Container ~50MB, custo operacional mais baixo da matriz (C-08 = 9) — adequado ao ambiente institucional (P-13).

**Framework:** Fastify (se performance é prioritária) ou Express (se familiaridade é prioritária). Decisão fica para o TDD.

---

### Stack Alternativa (Fallback): .NET 8 (ASP.NET Core)

> **Nota:** Com banco relacional decidido (P-16), .NET sobe para 2º no ranking (477 vs Python 461). Passa a ser o fallback principal.

**Em quais condições .NET vence:**
- Se o time contratar dev C# ou aceitar a curva de aprendizado de C#/ASP.NET.
- Se houver requisito futuro de compliance corporativo ou auditoria formal além de RNF-06 (ex: integração com AD/LDAP, certificações de segurança).
- Se a organização já opera .NET em outros sistemas (infra e expertise reutilizáveis).

**Fallback secundário: Python 3 + FastAPI**
- Se não houver dev C# disponível e o time preferir aprender Python a C# (Python é considerado mais acessível para devs JS).
- Se houver necessidade futura de integração com ferramentas de análise de dados.
- Score: 461 — 4º no ranking com banco relacional, mas 16 pontos abaixo de .NET por ter perdido a vantagem de integração Google.

---

### O que não escolher e por quê

**Java + Spring Boot:** Score 467 (3º). JVM startup lento (~3-5s) incompatível com Cloud Run cold start; memória mínima ~300-500MB é overkill; curva de aprendizado mais alta do grupo; peso de desenvolvimento (boilerplate, XML, beans) supera o necessário para este escopo. Spring Data JPA é excelente, mas os mesmos ganhos de transação estão disponíveis em .NET e Node.js com menos overhead.

**Python (como opção principal):** Não recomendado como opção principal porque caiu para 4º com banco relacional (461 vs Node 539). A vantagem que tinha quando Sheets era persistência não existe mais. A curva de aprendizado para JS devs é real (C-09 = 5). Válido apenas como fallback secundário se não houver dev C# disponível.

---

## 7. Arquitetura-alvo em nível de blocos

```
┌─────────────────────────────────────────────────────────────┐
│  ENTRADAS                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Solicitante │  │    Setor     │  │    Admin         │ │
│  │  (browser)   │  │  (browser)   │  │  (browser)       │ │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘ │
│         └────────── HTTP/REST + SSE ───────────┘           │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│  API LAYER (REST)                                           │
│  ┌─────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │ /auth       │  │ /ops          │  │ /admin          │  │
│  │ login,      │  │ gerar-código, │  │ kits, funcio-   │  │
│  │ sessão,     │  │ confirmar,    │  │ nários, creden- │  │
│  │ logout      │  │ status, SSE   │  │ ciais, export   │  │
│  └─────────────┘  └───────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│  DOMAIN / SERVICE LAYER                                     │
│  ┌──────────────┐  ┌────────────────────┐  ┌────────────┐ │
│  │ AuthService  │  │ ValidationQueue    │  │ AdminSvc   │ │
│  │ Credenciais  │  │ Service            │  │ Inventário │ │
│  │ individuais  │  │ Isolada por        │  │ Cadastro   │ │
│  │ Sessões      │  │ matrícula (FMD-02) │  │ Creden-    │ │
│  └──────────────┘  └────────────────────┘  │ ciais      │ │
│  ┌──────────────┐  ┌────────────────────┐  └────────────┘ │
│  │ LoanService  │  │ DashboardService   │                  │
│  │ Empréstimo   │  │ Agregação + filtros│                  │
│  │ Devolução    │  │ KPIs + export      │                  │
│  │ Lock / mutex │  └────────────────────┘                  │
│  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│  PERSISTÊNCIA                                               │
│  ┌────────────────────────┐  ┌───────────────────────────┐ │
│  │  Banco Relacional      │  │  Cache (Redis / in-memory)│ │
│  │  (PostgreSQL — TDD)    │  │  - Sessões (TTL config.)  │ │
│  │  FUNCIONARIOS, ITENS,  │  │  - Filas de validação     │ │
│  │  SOLICITACOES,         │  │    isoladas por matrícula │ │
│  │  DEVOLUCOES, RESULT.,  │  │  - Resultados de operação │ │
│  │  CREDENCIAIS           │  │                           │ │
│  │  Transações nativas    │  └───────────────────────────┘ │
│  │  (RNF-07, FMD-06)      │                               │
│  └────────────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│  INTEGRAÇÕES EXTERNAS                                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  exceljs (export nativo)                             │  │
│  │  .xlsx gerado em memória — Google Drive removido     │  │
│  │  (resolve FMD-05 integralmente)                      │  │
│  └───────────────────────────────────────────────────────┘  │
│  QR Code: REMOVIDO da V2 (elimina GAP-TECH-08)             │
│  [Sem migração de dados: V2 parte de banco limpo]          │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│  OBSERVABILIDADE                                            │
│  - Logs estruturados JSON: usuário, operação, timestamp,   │
│    resultado, duração de cada request                       │
│  - Registro de auditoria para operações admin (RNF-06):    │
│    usuário + timestamp + dado antes/depois                  │
│  - Health check endpoint                                    │
│  - [PENDENTE: destino dos logs — stdout, arquivo, SIEM]    │
└─────────────────────────────────────────────────────────────┘
```

**Notas de design (sem implementação):**
- SSE no endpoint `/ops/status/:matricula` substitui polling 500ms (P-08) — conexão mantida pelo servidor enquanto o Solicitante aguarda.
- Lock via `SELECT FOR UPDATE` em transação PostgreSQL no LoanService e ReturnService — sem Redis necessário para locks de operação.
- Cache (Redis ou in-memory) usado apenas para: sessões (TTL configurável), filas de validação isoladas por matrícula, resultados transientes. Locks de escrita ficam no DB.
- Credenciais na tabela CREDENCIAIS do banco — seed com admin padrão no deploy, alterado pelo Admin no primeiro acesso (RNF-05).
- Dashboard invalidado por evento a cada operação concluída — latência < 5s (PENDENTE-01 fechado).
- QR Code removido — fluxo exclusivo por código de 6 dígitos (elimina GAP-TECH-08).
- Ambiente: on-prem — container Docker + PostgreSQL na infraestrutura institucional.

---

## 8. Implicações de Migração

### O que precisa migrar

> **Decisão registrada (PENDENTE-04):** V2 parte de banco limpo — recomeço do zero. Sem migração de dados das Sheets para o banco relacional. Dados históricos das Sheets permanecem acessíveis diretamente no Google Sheets como arquivo de referência.

| Item | Complexidade | Observação |
|---|---|---|
| Schema do banco relacional | Alta | Definido no TDD: tabelas novas (funcionarios, itens, solicitacoes, devolucoes, resultados, credenciais) com todas as colunas da V2 |
| Cadastro inicial de funcionários e kits | Média | Re-cadastro via interface Admin (FN-01, FN-02) após deploy — sem script de importação |
| Credencial admin padrão (seed) | Baixa | Script de seed insere 1 credencial admin padrão no deploy; Admin altera no primeiro acesso e cadastra os demais usuários Setor via FN-03 |
| Lógica de negócio (V1 JS → V2 TS) | Alta | Reescrita completa — nenhuma reutilização direta de código GAS |
| Configurações (TTLs, limite de kits) | Baixa | Externalizadas para variáveis de ambiente (TTL) e tabela de configuração no DB (limite de kits configurável — PENDENTE-05 fechado) |

### Coexistência V1 / V2

- **Decisão (PENDENTE-03):** Corte direto (big-bang).
- V1 (GAS + Sheets) e V2 (on-prem + PostgreSQL) usam persistências completamente separadas — não há conflito de lock ou sobreposição de dados.
- V1 mantida inativa (não deletada) após o corte — Sheets continuam acessíveis como arquivo histórico de referência.

### Estratégia de corte: Big-bang

**Pré-condições para a virada:**
1. Schema PostgreSQL aprovado no TDD e migrations aplicadas no ambiente de produção.
2. Credencial admin seed inserida e testada.
3. Cadastro inicial de kits e funcionários concluído via interface Admin (pode ser feito antes do corte em homologação e repetido em produção).
4. V2 validada com dados reais em ambiente de homologação.
5. V1 desativada (script GAS pausado, não deletado) na data do corte.
6. Sheets originais preservadas como backup somente-leitura.

---

## 9. Decisões Registradas

> Todos os pendentes foram fechados. Decisões abaixo são insumo direto para o TDD.

| # | Decisão | Impacto no TDD |
|---|---|---|
| PENDENTE-DB | **PostgreSQL** — `SELECT FOR UPDATE` para concorrência real (RNF-01) | ORM: Prisma ou Drizzle + driver pg; migrations obrigatórias |
| PENDENTE-C | **On-prem** — servidor institucional interno | Docker Compose (app + postgres); sem Cloud Run; infra gerenciada pelo TI local |
| PENDENTE-01 | **Dashboard imediato (< 5s)** — invalidação por evento a cada operação concluída | DashboardService invalida cache após LoanService/ReturnService; sem TTL fixo |
| PENDENTE-02 | **QR Code removido** — elimina GAP-TECH-08 completamente | Fluxo único: código de 6 dígitos; QrServiceClean.js não tem equivalente na V2 |
| PENDENTE-03 | **Corte direto (big-bang)** — V2 parte de banco limpo; Sheets preservadas como arquivo | Sem script de migração de dados; re-cadastro via Admin interface |
| PENDENTE-04 | **Seed com credencial admin padrão** no deploy; Admin altera no primeiro acesso; V2 recomeça do zero | Script de seed no TDD; FN-03 garante cadastro dos demais usuários pelo Admin |
| PENDENTE-05 | **Limite de kits configurável globalmente** pelo Admin via interface, sem redeploy | Tabela de configuração no DB: `config(chave, valor)` — chave `MAX_KITS_POR_FUNCIONARIO` |
| PENDENTE-06 | **Bloquear inativação** de kit com empréstimo ativo | AdminService valida antes de inativar: se `status = 'emprestado'`, retorna erro com matrícula do detentor |
| PENDENTE-07 | **Nome completo** do operador Setor nos logs de SOLICITACOES e DEVOLUCOES | Campo `operador_nome` (varchar) nas tabelas; DashboardService exibe e exporta o nome |

---

## 10. Próximo Documento: TDD (Technical Design Document)

Todas as decisões de pré-TDD estão fechadas. O TDD pode ser iniciado com o seguinte escopo mínimo:

**Decisões de arquitetura:**
- Escolha de framework dentro da stack (Fastify vs Express; ou FastAPI se fallback for adotado)
- Estratégia de sessão: JWT stateless vs sessão server-side (impacto em logout/revogação — RNF do FN-03)
- Mecanismo de lock/mutex para operações concorrentes (DB transaction vs Redis SETNX)
- Estratégia de invalidação de cache do dashboard por evento (FMD-04)
- SSE vs WebSocket para substituição do polling (P-08)

**Padrões de projeto:**
- Estrutura de diretórios e separação de camadas
- Convenção de nomes e tipagem (objetos de domínio vs DTOs de API)
- Tratamento de erros centralizado e formato de resposta de erro

**Escolhas de infraestrutura:**
- Ambiente de hospedagem (após PENDENTE-C)
- Estratégia de variáveis de ambiente / secrets (resolve RNF-05, GAP-TECH-01)
- Containerização (Dockerfile, docker-compose para desenvolvimento)

**Segurança, logs, deployment:**
- Algoritmo e TTL de tokens de sessão
- Formato de log estruturado (campos obrigatórios por tipo de evento)
- Esquema de auditoria (estrutura do registro para RNF-06)
- Pipeline de deploy (CI/CD básico vs deploy manual)
- Estratégia de rollback

**Modelos de dados:**
- Schema das entidades V2 (extensões nas sheets existentes + nova entidade CREDENCIAIS)
- Formato do identificador de operador Setor (após PENDENTE-07)
- Estrutura da fila de validação isolada por matrícula (substitui fila única de GAS — FMD-02)
- Modelo de sessão do Solicitante (matrícula como identificador sem senha — FMD-01)
