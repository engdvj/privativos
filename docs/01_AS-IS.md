# AS-IS ANALYSIS — Appscript Reunir

## 1. Contexto do Sistema

- **Finalidade:** Sistema de controle de empréstimo e devolução de kits de uniforme/equipamento para funcionários
- **Tipo:** Aplicação web interna (automação de processo operacional)
- **Ambiente de execução:** Google Apps Script (GAS), publicado como Web App
- **Runtime:** V8
- **Fuso horário:** America/Sao_Paulo
- **Acesso:** `ANYONE_ANONYMOUS` — qualquer pessoa com o link pode acessar a tela de login
- **Execução:** `USER_DEPLOYING` — executa sob as permissões do usuário que fez o deploy

---

## 2. Objetivo Operacional Atual

- Registrar solicitações de empréstimo e devoluções de kits por funcionários
- Controlar quantos kits cada funcionário possui em uso (máximo: 2)
- Auditar o histórico de movimentações por funcionário, setor e período
- Fornecer painel de visualização de dados agregados para administradores
- Coordenar em tempo real a validação entre a tela do solicitante e a tela do setor

---

## 3. Usuários Reais

| Perfil | Acesso | Interação |
|---|---|---|
| Solicitante (funcionário) | Chave: `123` | Tela web — visualiza código gerado, aguarda confirmação |
| Responsável de Setor | Chave: `321` | Tela web — busca funcionário, gera código, confirma operação |
| Administrador | Chave: `hotelaria2025@` | Tela web — visualiza dashboard, aplica filtros, exporta dados |

- Solicitante **não possui sessão persistente** — sem token de autenticação armazenado
- Setor e Admin possuem sessão via token armazenado em `localStorage` com TTL de 12h no cache do GAS

---

## 4. Funcionalidades Existentes

### 4.1 Autenticação por Perfil
- **Descrição:** Valida chave de acesso por perfil, gera token de sessão
- **Arquivo:** `AuthService.js`
- **Dependências:** `CacheService` (GAS), constante `ACCESS_KEYS` hardcoded
- **Funções:** `login`, `validateSession`, `logout`, `checkSession`

### 4.2 Geração de Código de Validação
- **Descrição:** Gera código numérico de 6 dígitos para uma operação (solicitação ou devolução), associado a um funcionário e quantidade
- **Arquivo:** `ValidationService.js`
- **Dependências:** `CacheService`, `DataServiceClean.js`, `ConfigClean.js`
- **TTL do código:** 1 hora
- **Funções:** `generateValidationCode`, `fetchPendingValidation`, `processValidationCode`, `fetchLastResultSince`, `getSolicitanteStatus`

### 4.3 Geração de QR Code
- **Descrição:** Gera token único com imagem QR e código manual de fallback (6 dígitos), com TTL de 30 minutos
- **Arquivo:** `QrServiceClean.js`
- **Dependências:** `Utils.js` (`generateQrBase64`), `CacheService`, `DataServiceClean.js`
- **API externa:** `api.qrserver.com` com timeout de 5s e fallback
- **Funções:** `queueQr`, `fetchPendingQr`, `consumeQrToken`, `getQrCodes`, `processManualCode`, `getSolicitanteStatus`

### 4.4 Solicitação de Empréstimo de Kit
- **Descrição:** Registra empréstimo de 1 ou 2 kits para um funcionário ativo, atualizando status dos itens na planilha
- **Arquivo:** `DataServiceClean.js`
- **Dependências:** `ConfigClean.js`, `LockService` (GAS), sheets `FUNCIONARIOS`, `ITENS`, `SOLICITACOES`, `RESULTADOS`
- **Regra:** Máximo 2 kits por funcionário; valida disponibilidade e status do funcionário
- **Função:** `addRequest`

### 4.5 Devolução de Kit
- **Descrição:** Registra devolução de 1, 2 ou todos os kits emprestados, atualizando status dos itens para disponível
- **Arquivo:** `DataServiceClean.js`
- **Dependências:** mesmas de 4.4 + sheet `DEVOLUCOES`
- **Função:** `recordReturn`

### 4.6 Dashboard Administrativo
- **Descrição:** Agrega dados de todas as sheets, suporta filtros (data, setor, funcionário), exibe KPIs e tabela paginada
- **Arquivo:** `DashboardServiceClean.js`
- **Dependências:** todas as sheets, `CacheService` (TTL 300s para dados, 600s para filtros)
- **Views:** global, por setor, por funcionário
- **Funções:** `getDashboardData`, `getFilterOptions`, `ds_readAndAggregate`, `buildDataGlobal`, `buildDataSetor`, `buildDataFuncionario`

### 4.7 Exportação de Dados
- **Descrição:** Gera planilha temporária com sumário e detalhes filtrados, exporta como `.xlsx` (fallback: `.csv`), retorna base64 para download no cliente
- **Arquivo:** `DashboardServiceClean.js`
- **Dependências:** `Drive`, `Sheets` (GAS APIs), `SpreadsheetApp`
- **Função:** `exportData`

### 4.8 Roteamento de Páginas
- **Descrição:** `doGet(e)` roteia o parâmetro `page` da URL para o template HTML correspondente
- **Arquivo:** `App.js`
- **Rotas:** `solicitante` → `TelaSolicitante.html`, `setor` → `TelaSetor.html`, `admin` → `TelaAdmin.html`, default → `Index.html`
- **Funções:** `doGet`, `handlePageRequest`, `renderPage`, `include`

---

## 5. Fluxos Reais de Funcionamento

### Fluxo de Solicitação/Devolução via Código de Validação

```
[TelaSetor] Responsável busca matrícula
      → checkStatus() → DataService.getUser()
[TelaSetor] Seleciona quantidade e operação
      → gerar('request'|'return') → ValidationService.generateValidationCode()
[TelaSolicitante] Polling a cada 500ms
      → procurarValidacao() → ValidationService.fetchPendingValidation()
      → exibe código de 6 dígitos + info do funcionário
[TelaSetor] Responsável vê status no display de monitoramento (polling 3s)
      → getSolicitanteStatus()
[TelaSetor] Confirma ou cancela via overlay
      → processValidationCode(code) → DataService.addRequest() ou recordReturn()
      → resultado gravado no cache
[TelaSolicitante] Polling a cada 1s
      → verificarResultado() → ValidationService.fetchLastResultSince()
      → exibe sucesso ou erro → auto-reset em 2s
```

### Fluxo de Login

```
[Index.html] Usuário seleciona perfil e informa chave
      → google.script.run.login(perfil, chave)
      → AuthService.validateAccess() → AuthService.login()
      → token armazenado em localStorage: scp_session_[perfil]
      → redirect para ?page=[perfil]
```

### Fluxo do Dashboard

```
[TelaAdmin] Carrega filtros disponíveis
      → DashboardService.getFilterOptions()
[TelaAdmin] Aplica filtros e solicita dados
      → DashboardService.getDashboardData(filters)
      → ds_readAndAggregate() lê todas as sheets uma vez
      → buildDataGlobal/Setor/Funcionario()
      → retorna KPIs + linhas de tabela
[TelaAdmin] Clique em KPI ou linha → drill-down de filtro
[TelaAdmin] Exportar → exportData() → download base64 .xlsx
```

---

## 6. Arquitetura Atual (Lógica)

```
App.js                  ← Entry point HTTP (doGet)
├── AuthService.js      ← Autenticação e sessão
├── ConfigClean.js      ← Constantes globais (colunas, sheets, prefixos)
├── DataServiceClean.js ← CRUD nas sheets (leitura, escrita, lock)
├── ValidationService.js← Códigos de validação + polling de resultado
├── QrServiceClean.js   ← Tokens QR + código manual + polling
├── DashboardServiceClean.js ← Agregação, filtros, exportação
└── Utils.js            ← Funções auxiliares (token, QR, data, string)

Templates HTML:
├── Index.html          ← Login (CSS inline + JS inline)
├── TelaSolicitante.html← Tela do funcionário (CSS inline + JS inline)
├── TelaSetor.html      ← Tela do responsável
│   ├── TelaSetorCss.html  (include separado)
│   └── TelaSetorJs.html   (include separado)
└── TelaAdmin.html      ← Dashboard admin
    ├── TelaAdminCss.html  (include separado)
    └── TelaAdminJs.html   (include separado)

components.html         ← Design system (tokens CSS + classes reutilizáveis)
```

- Não há framework de backend — toda a lógica é GAS puro
- Não há transpilação nem bundler — arquivos `.js` são enviados diretamente pelo clasp
- CSS e JS do frontend são servidos como includes de template HTML pelo GAS
- `google.script.run` é o único canal de comunicação frontend → backend

---

## 7. Stack Tecnológica Atual

| Camada | Tecnologia |
|---|---|
| Runtime | Google Apps Script V8 |
| Linguagem backend | JavaScript (GAS) |
| Linguagem frontend | Vanilla JavaScript |
| Estilização | CSS puro (variáveis CSS, `backdrop-filter`) |
| Persistência | Google Sheets |
| Cache | `CacheService` (GAS) |
| Concorrência | `LockService` (GAS), timeout 30s |
| Logging | Stackdriver (configurado em `appsscript.json`) |
| Deploy | Google Clasp (`.clasp.json`) |
| QR Code | API externa: `api.qrserver.com` |
| Exportação | `SpreadsheetApp` + `DriveApp` (GAS) |

---

## 8. Dados e Persistência

### Sheets do Google Sheets (banco de dados)

| Sheet | Dado armazenado | Colunas principais |
|---|---|---|
| `FUNCIONARIOS` | Cadastro de funcionários | MATRICULA, NOME, SETOR, FUNCAO, STATUS |
| `ITENS` | Kits físicos disponíveis | ID, DESCRICAO, STATUS, SOLICITANTE_ATUAL, DATA_EMPRESTIMO |
| `SOLICITACOES` | Log de solicitações de empréstimo | TIMESTAMP, MATRICULA, NOME, ITEM_ID, STATUS |
| `DEVOLUCOES` | Log de devoluções | TIMESTAMP, MATRICULA, NOME, ITEM_ID |
| `RESULTADOS` | Log de resultados de operação | TIMESTAMP, MATRICULA, SUCESSO, MENSAGEM |

### Cache (`CacheService`)

| Dado | TTL | Chave |
|---|---|---|
| Sessão de usuário | 12h | `SESS_[token]` |
| Código de validação | 1h | prefixo definido em `ConfigClean.js` |
| Token QR | 30min | prefixo definido em `ConfigClean.js` |
| Resultado de operação | não especificado | por matrícula + timestamp |
| Dados de dashboard | 300s | snapshot dos filtros |
| Opções de filtro | 600s | chave fixa |

### Formatos
- Datas: `dd/MM/yyyy HH:mm:ss` (string)
- IDs de item: string
- Matrícula: string numérica
- QR Code: `data:image/png;base64,...` (URI inline)
- Export: `.xlsx` (base64) ou fallback `.csv`

---

## 9. Dependências Externas

| Dependência | Uso | Autenticação |
|---|---|---|
| Google Sheets API | Armazenamento de todos os dados | OAuth do GAS (implícito) |
| Google Drive API | Criação de arquivo temporário para export | OAuth do GAS (implícito) |
| `CacheService` (GAS) | Sessões, tokens, resultados | Interno GAS |
| `LockService` (GAS) | Exclusão mútua em escrita | Interno GAS |
| `DriveApp` (GAS) | Criação e deleção de arquivos de export | Interno GAS |
| `api.qrserver.com` | Geração de imagem QR | Nenhuma (API pública) |
| Google Clasp | Deploy do código para GAS | Credenciais locais do desenvolvedor |

**Credenciais hardcoded em código:**
- Chaves de acesso dos 3 perfis estão em `AuthService.js` na constante `ACCESS_KEYS`
- `scriptId` está em `.clasp.json`

---

## 10. Restrições Técnicas Atuais

- **Máximo de kits por funcionário:** 2 (hardcoded em `DataServiceClean.js`)
- **Concorrência:** `LockService` com timeout de 30s — requisições concorrentes falham se o lock não for adquirido
- **QR Code:** depende de API externa (`api.qrserver.com`) — timeout de 5s; falha silenciosa retorna `null`
- **Sessão do Solicitante:** sem autenticação — tela acessível sem token
- **Polling no frontend:** `TelaSolicitante` verifica estado a cada 500ms; `TelaSetor` a cada 3s — ambos via `google.script.run` (chamadas HTTP síncronas do GAS)
- **GAS quota:** todas as operações de leitura/escrita consomem cota diária de execução do Google Apps Script
- **Execução:** `USER_DEPLOYING` — todas as operações executam sob as permissões do usuário que fez o deploy, não do usuário autenticado
- **Sem versionamento de dados:** não há soft-delete nem histórico de alterações nas sheets `ITENS` e `FUNCIONARIOS`
- **Indexação:** leitura de dados via `getValues()` percorre todas as linhas da sheet — sem índice

---

## 11. Problemas Conhecidos (Somente Explícitos)

- **Fallback de export:** código em `DashboardServiceClean.js` contém bloco `try/catch` explícito que captura falha na geração `.xlsx` e tenta exportar como `.csv` — indica instabilidade conhecida nessa operação
- **Fallback de QR:** `Utils.js` — `generateQrBase64` captura falha da API externa e retorna `null`; o chamador (`QrServiceClean.js`) não trata `null` de forma diferenciada do sucesso além do fallback para código manual
- **Sanitização de nome de arquivo:** `DashboardServiceClean.js` aplica regex `[^a-zA-Z0-9_\-.]` no nome do funcionário para gerar nome de arquivo de export — comportamento explicitamente documentado no código
- **Timeout de polling:** `TelaSolicitante.html` implementa timeout de 30 minutos para exibição do código; após esse tempo, exibe botão de atualização manual — comportamento limitante documentado no frontend
- **Arquivo temporário no Drive:** export cria arquivo no Drive e o deleta após leitura — se a deleção falhar (erro não tratado), o arquivo permanece no Drive do usuário deployer
