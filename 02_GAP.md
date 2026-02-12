# GAP ANALYSIS — Appscript Reunir

## 1. Objetivo da Análise

Este documento identifica as lacunas funcionais, técnicas e arquiteturais do sistema atual de controle de empréstimo de kits, com base no código-fonte, comportamento observável e documento AS-IS.

A análise subsidia a decisão sobre a necessidade de uma nova versão do sistema — seja evolução controlada, migração parcial ou reescrita completa.

---

## 2. Gaps Funcionais

### GAP-FUNC-01 — Autenticação compartilhada sem identidade individual

- **Estado atual:**
  Três perfis de acesso usam chaves fixas (`123`, `321`, `hotelaria2025@`) definidas em `ACCESS_KEYS` em `AuthService.js`. A autenticação valida apenas se a chave bate com o perfil — não com um usuário específico.

- **Limitação observada:**
  Qualquer pessoa que possua a chave de um perfil opera com plenas permissões daquele perfil. Não há como identificar qual indivíduo realizou uma operação. Não há como revogar o acesso de uma pessoa sem trocar a chave de todos que a compartilham. A tela do Solicitante não exige nem valida nenhuma chave.

- **Impacto:**
  Segurança / Auditoria — impossível rastrear quem executou cada operação. Operacional — comprometimento de uma chave afeta todos os usuários do perfil.

- **Evidência:**
  `AuthService.js:12-16` — `ACCESS_KEYS` hardcoded. `AuthService.js:34` — Solicitante retorna `{ ok: true }` sem token.

---

### GAP-FUNC-02 — Fila de validação sem identificação do solicitante

- **Estado atual:**
  O cache armazena exatamente um código ativo por tipo de operação (`VALIDATION_QUEUE_KEY_REQUEST` e `VALIDATION_QUEUE_KEY_RETURN`). `TelaSolicitante.html` faz polling de `fetchPendingValidation` sem informar sua própria matrícula.

- **Limitação observada:**
  Dois funcionários aguardando operações do mesmo tipo simultaneamente compartilham a mesma chave de fila. O código do segundo gerado sobrescreve o primeiro. O solicitante que estava aguardando mais cedo perde seu código sem notificação.

- **Impacto:**
  Operacional — operações simultâneas do mesmo tipo produzem entrega de código incorreta. Usuário — funcionário pode receber código de outra pessoa, resultando em registro errado.

- **Evidência:**
  `ValidationService.js:66-96` — chaves fixas `VALIDATION_QUEUE_KEY_REQUEST`/`RETURN` sobrescrevem o anterior. `TelaSolicitante.html:727` — `fetchPendingValidation(true)` sem parâmetro de matrícula.

---

### GAP-FUNC-03 — Limite de kits fixo e não configurável

- **Estado atual:**
  O limite máximo de 2 kits por funcionário está hardcoded em `DataServiceClean.js:154` como `Math.max(1, Math.min(2, ...))`.

- **Limitação observada:**
  Não existe mecanismo para alterar o limite por setor, função ou funcionário. Qualquer mudança operacional na política de empréstimo exige edição de código e redeploy.

- **Impacto:**
  Manutenção — operação depende de desenvolvedor para ajuste de regra de negócio. Escala — não suporta variações de política por perfil.

- **Evidência:**
  `DataServiceClean.js:154` — `Math.min(2, ...)` hardcoded.

---

### GAP-FUNC-04 — Devolução sem seleção de item específico

- **Estado atual:**
  `recordReturn` em `DataServiceClean.js:261` seleciona os itens a devolver com `borrowedItems.slice(0, requestedQty)` — os primeiros N da lista retornada pela leitura da sheet.

- **Limitação observada:**
  Quando um funcionário possui 2 kits e devolve apenas 1, o sistema escolhe arbitrariamente o primeiro item encontrado. O responsável não consegue especificar qual item físico está sendo devolvido. A rastreabilidade de qual item físico específico foi devolvido em cada operação é inexistente.

- **Impacto:**
  Operacional — divergência entre item físico em mãos e item registrado. Auditoria — impossível identificar a trajetória de um item físico específico.

- **Evidência:**
  `DataServiceClean.js:261` — `borrowedItems.slice(0, requestedQty)` sem critério de seleção.

---

### GAP-FUNC-05 — Dashboard com dados defasados sem invalidação por operação

- **Estado atual:**
  `getDashboardData` em `DashboardServiceClean.js:264-289` armazena o resultado em cache com TTL de 300 segundos. `getFilterOptions` usa TTL de 600 segundos. Não há invalidação de cache quando uma operação de empréstimo ou devolução ocorre.

- **Limitação observada:**
  Após uma operação, os dados exibidos no dashboard ficam desatualizados por até 5 minutos. O administrador pode tomar decisões baseadas em contagens de kits em uso incorretas.

- **Impacto:**
  Usuário — visualização de dados stale. Operacional — decisões administrativas baseadas em estado desatualizado.

- **Evidência:**
  `DashboardServiceClean.js:284` — `cache.put(cacheKey, serialized, 300)`. Nenhum trecho do `DataServiceClean.js` invalida o cache do dashboard após operações.

---

### GAP-FUNC-06 — Exportação com comportamento instável e formato inconsistente

- **Estado atual:**
  `exportData` em `DashboardServiceClean.js:471-648` cria uma planilha temporária no Drive, exporta via URL não documentada da API do Google Sheets e retorna o arquivo em base64. Em caso de falha, retorna CSV.

- **Limitação observada:**
  O usuário não tem garantia de receber `.xlsx` — pode receber `.csv` sem controle. Se a deleção do arquivo temporário falhar (linha 645 sem tratamento de erro), arquivos acumulam no Drive do deployer indefinidamente. A URL de exportação (`feeds/download/spreadsheets/Export`) não é uma API oficial com SLA.

- **Impacto:**
  Usuário — formato de saída inconsistente entre execuções. Manutenção — arquivos órfãos acumulam no Drive sem mecanismo de limpeza.

- **Evidência:**
  `DashboardServiceClean.js:629-639` — bloco `catch` com fallback para CSV. `DashboardServiceClean.js:645` — `setTrashed(true)` sem `try/catch`.

---

### GAP-FUNC-07 — Ausência de gestão de inventário via interface

- **Estado atual:**
  Kits são controlados na sheet `ITENS` com status `Disponível`/`Emprestado`. Não há nenhuma rota, tela ou função no sistema para adicionar, remover, inativar ou corrigir registros de kits.

- **Limitação observada:**
  Toda manutenção de inventário requer acesso direto ao Google Sheets. Não há validação, histórico de alterações ou controle de quem editou o cadastro de itens.

- **Impacto:**
  Operacional — dependência de acesso direto à planilha para toda gestão de inventário. Risco — erros manuais sem auditoria.

- **Evidência:**
  `App.js:23-30` — apenas rotas `solicitante`, `setor`, `admin`. Nenhuma função de CRUD para `ITENS` exposta.

---

### GAP-FUNC-08 — Ausência de gestão de funcionários via interface

- **Estado atual:**
  A sheet `FUNCIONARIOS` é editada diretamente no Google Sheets. Não há tela ou função para cadastrar, editar ou inativar funcionários pelo sistema.

- **Limitação observada:**
  Cadastro de novos funcionários, transferência de setor e inativação dependem de edição manual na planilha. Não há validação de formato, duplicidade de matrícula ou registro de quem realizou a alteração.

- **Impacto:**
  Operacional — manutenção de cadastro fora do sistema. Risco — dados inconsistentes por edição direta na planilha sem validação.

- **Evidência:**
  `App.js:23-30` — nenhuma rota para gestão de usuários. Ausência de qualquer função de escrita em `FUNCIONARIOS` além de leitura.

---

## 3. Gaps Técnicos

### GAP-TECH-01 — Credenciais hardcoded no código-fonte

- **Estado técnico atual:**
  `ACCESS_KEYS` com as três senhas (`123`, `321`, `hotelaria2025@`) está diretamente no arquivo `AuthService.js`.

- **Limitação técnica:**
  Troca de senha exige edição do código e redeploy. As credenciais ficam visíveis no repositório git (`.clasp.json` também expõe o `scriptId`). Não há separação entre configuração e código.

- **Impacto:**
  Segurança — credenciais expostas em histórico de versionamento. Manutenção — fluxo de rotação de senha incompatível com operação sem desenvolvedor.

- **Evidência:**
  `AuthService.js:12-16`. `.clasp.json` — `scriptId` exposto.

---

### GAP-TECH-02 — Sessões e estados operacionais em CacheService volátil

- **Estado técnico atual:**
  Tokens de sessão, códigos de validação, resultados de operação e filas de validação são armazenados exclusivamente no `CacheService.getScriptCache()` — cache de escopo de script, não persistente.

- **Limitação técnica:**
  O `CacheService` pode ser purgado pelo Google sem aviso. Não há garantia de que um código de validação gerado ainda estará disponível quando o solicitante fizer o polling. Não há fallback quando o cache é invalidado inesperadamente.

- **Impacto:**
  Confiabilidade — estados de operação podem desaparecer silenciosamente. Usuário — operação aparentemente iniciada pode ser perdida sem feedback.

- **Evidência:**
  `AuthService.js:44`, `ValidationService.js:73-96`, `QrServiceClean.js:70-109` — todos dependem exclusivamente de `CacheService`.

---

### GAP-TECH-03 — Leitura full-scan de sheets em todas as operações

- **Estado técnico atual:**
  `getUsers()` e `getItems()` em `DataServiceClean.js` leem toda a sheet com `getDataRange().getValues()` em toda chamada. `getUser(matricula)` chama `getUsers()` e faz `find()` no array resultante. `updateItemStatus` percorre linha a linha para localizar um item.

- **Limitação técnica:**
  Não há indexação, cache de leitura de registros individuais nem busca por intervalo específico. O tempo de resposta cresce linearmente com o tamanho das sheets. Operações que chamam `getUsers()` e `getItems()` múltiplas vezes na mesma transação (como `addRequest`) realizam leituras redundantes da mesma sheet.

- **Impacto:**
  Performance — latência crescente com volume. `addRequest` em `DataServiceClean.js:157` e `167` chama `getUsers()` e `getItems()` separadamente, realizando duas leituras completas de sheets diferentes.

- **Evidência:**
  `DataServiceClean.js:75-78` — `getUser` faz full scan. `DataServiceClean.js:104-127` — `updateItemStatus` percorre linha a linha com `sheet.getRange(row, col).getValue()` dentro de loop (N chamadas individuais à API do Sheets).

---

### GAP-TECH-04 — `recordReturn` sem LockService — race condition em devoluções

- **Estado técnico atual:**
  `addRequest` em `DataServiceClean.js:148` usa `LockService.getScriptLock()`. `recordReturn` em `DataServiceClean.js:243` não usa nenhum mecanismo de exclusão mútua.

- **Limitação técnica:**
  Duas devoluções concorrentes do mesmo funcionário podem ler o mesmo estado de itens emprestados e tentar devolver os mesmos itens, resultando em registros duplicados de devolução e possível inconsistência no status dos itens.

- **Impacto:**
  Confiabilidade — dados inconsistentes em cenário de concorrência. Segurança de dados — estado dos itens pode ser corrompido.

- **Evidência:**
  `DataServiceClean.js:243` — ausência de `LockService` em `recordReturn`. `DataServiceClean.js:148` — presente apenas em `addRequest`.

---

### GAP-TECH-05 — `fetchLastResultSince` declarada em dois arquivos com implementações conflitantes

- **Estado técnico atual:**
  `ValidationService.js:27` e `QrServiceClean.js:27` declaram `fetchLastResultSince` com a mesma assinatura. No GAS, todos os arquivos compartilham o mesmo escopo global. A segunda declaração sobrescreve a primeira.

- **Limitação técnica:**
  O comportamento efetivo de `fetchLastResultSince` no frontend depende da ordem de carregamento dos arquivos pelo GAS, que não é garantida. As duas implementações usam prefixos de cache diferentes (`VALIDATION_RESULT_PREFIX` vs `QR_RESULT_PREFIX`) e TTLs diferentes (300s vs 60s). O frontend não tem controle sobre qual implementação está ativa.

- **Impacto:**
  Confiabilidade — resultado de operação pode não ser encontrado dependendo de qual implementação sobreviveu. Manutenibilidade — bug silencioso, difícil de reproduzir.

- **Evidência:**
  `ValidationService.js:27` e `QrServiceClean.js:27` — mesma assinatura. `ValidationService.js:17` — TTL 300s. `QrServiceClean.js:21` — TTL 60s.

---

### GAP-TECH-06 — `getSolicitanteStatus` declarada em dois arquivos

- **Estado técnico atual:**
  `ValidationService.js:189` e `QrServiceClean.js:232` declaram `getSolicitanteStatus`. Mesmo problema de sobrescrita de escopo global que o GAP-TECH-05.

- **Limitação técnica:**
  As duas implementações consultam chaves de cache diferentes (`VALIDATION_QUEUE_KEY_*` vs `QR_QUEUE_KEY_*`). A que for carregada por último pelo GAS determina o comportamento real. Se a implementação de QR sobrescrever a de Validação, o setor verá sempre "Aguardando gerar QR Code..." mesmo quando há um código de validação ativo.

- **Impacto:**
  Confiabilidade — display de monitoramento do setor pode exibir estado incorreto. Manutenibilidade — comportamento depende de ordem de arquivos não controlável.

- **Evidência:**
  `ValidationService.js:189-220` e `QrServiceClean.js:232-264` — mesma assinatura, chaves de cache diferentes.

---

### GAP-TECH-07 — Variáveis redeclaradas com `var` para contornar conflito de escopo

- **Estado técnico atual:**
  `ConfigClean.js:13` documenta explicitamente: `// (Using var to avoid redeclaration conflicts)` para `SHEET_USERS`, `SHEET_ITEMS`, `COL_USERS`, `COL_ITEMS`, etc. `QrServiceClean.js:269` redeclara `MANUAL_CODE_PREFIX` e `MANUAL_CODE_TTL` que já existem em `ConfigClean.js:64-71`.

- **Limitação técnica:**
  O uso de `var` para mascarar redeclaração indica que o escopo global já está poluído. A redeclaração de `MANUAL_CODE_TTL` em `QrServiceClean.js:270` com valor `300` (5 minutos) conflita com `ConfigClean.js:71` que define `3600` (1 hora). O valor efetivo depende da ordem de carregamento.

- **Impacto:**
  Confiabilidade — TTL de código manual pode ser 5 minutos ou 1 hora dependendo da ordem de arquivos. Manutenibilidade — impossível rastrear valor efetivo de configuração sem conhecer a ordem de carregamento do GAS.

- **Evidência:**
  `ConfigClean.js:64-71` — `MANUAL_CODE_PREFIX`/`MANUAL_CODE_TTL` com valor 3600. `QrServiceClean.js:269-270` — mesmas variáveis redeclaradas com `MANUAL_CODE_TTL = 300`.

---

### GAP-TECH-08 — Dependência de API externa sem SLA para QR Code

- **Estado técnico atual:**
  `Utils.js:62` chama `https://api.qrserver.com/v1/create-qr-code/` com timeout de 5s. O bloco `catch` em `Utils.js:83-86` chama o mesmo endpoint novamente sem timeout nem `muteHttpExceptions`.

- **Limitação técnica:**
  O fallback do QR Code não é um fallback real — é uma segunda tentativa ao mesmo endpoint sem proteção de timeout. Se a API estiver indisponível, a segunda chamada pode travar por tempo indeterminado até o timeout do GAS (6 minutos). A API `api.qrserver.com` é um serviço gratuito sem SLA documentado.

- **Impacto:**
  Disponibilidade — indisponibilidade da API externa bloqueia a geração de QR por até 6 minutos. Performance — latência mínima de 5s por geração de QR em condição normal.

- **Evidência:**
  `Utils.js:71` — `timeout: 5`. `Utils.js:83` — `UrlFetchApp.fetch(apiUrl)` sem timeout no catch.

---

### GAP-TECH-09 — Exportação usando endpoint não oficial do Google Sheets

- **Estado técnico atual:**
  `DashboardServiceClean.js:621` usa a URL `https://docs.google.com/feeds/download/spreadsheets/Export?key=...&exportFormat=xlsx` para exportar o arquivo temporário.

- **Limitação técnica:**
  Esta URL é um endpoint não documentado oficialmente pela Google. Não há garantia de estabilidade, não está coberta pelo SLA do Google Workspace, e pode ser descontinuada sem aviso. O token OAuth é gerado com `ScriptApp.getOAuthToken()` e incluído no header — compatível apenas com contexto GAS.

- **Impacto:**
  Disponibilidade — exportação pode quebrar sem aviso por mudança no endpoint. Manutenção — impossível testar fora do ambiente GAS.

- **Evidência:**
  `DashboardServiceClean.js:621` — URL hardcoded com `feeds/download/spreadsheets/Export`.

---

## 4. Gaps de Arquitetura e Evolução

### Crescimento do sistema

**Fila de validação com capacidade 1 por tipo**
- Situação atual: O cache armazena um único código ativo por tipo de operação (`VALIDATION_QUEUE_KEY_REQUEST`, `VALIDATION_QUEUE_KEY_RETURN`). Não há estrutura de fila real.
- Consequência direta: O sistema é estruturalmente incompatível com múltiplas operações simultâneas. Qualquer tentativa de aumentar a capacidade operacional exige redesenho completo do mecanismo de validação.

**Quota diária do GAS como teto de operação**
- Situação atual: Leituras de sheet, escritas, chamadas de cache e exportações consomem cota diária do GAS. O polling de 500ms na TelaSolicitante e 2s no TelaSetor gera dezenas de chamadas por minuto por sessão ativa. Não há monitoramento de consumo de cota.
- Consequência direta: Em dias de alto volume ou múltiplos usuários simultâneos, a cota pode ser esgotada. Quando isso ocorre, todas as operações falham com erro genérico sem distinção para o usuário.

---

### Mudança de tecnologia

**Google Sheets como único backend de persistência**
- Situação atual: Toda a lógica de dados depende de `SpreadsheetApp`, `getValues()`, `setValues()` e `appendRow()`. Não há camada de abstração entre a lógica de negócio e a persistência.
- Consequência direta: Qualquer migração de persistência (para banco relacional, Firestore, etc.) exige reescrita total da camada de dados. Não é possível trocar o backend de dados sem reescrever `DataServiceClean.js`, `DashboardServiceClean.js` e `DashboardServiceClean.js`.

**Ausência de testes automatizados**
- Situação atual: O projeto não contém arquivos de teste. O GAS não possui suporte nativo a frameworks de teste. Toda validação é manual.
- Consequência direta: Qualquer alteração de código — mesmo pequena — requer validação manual end-to-end. Mudança de tecnologia sem cobertura de teste é um risco não quantificável.

---

### Modularização

**Escopo global de funções sem namespace**
- Situação atual: Todos os arquivos `.js` do projeto são carregados no mesmo escopo global do GAS. Não há módulos, namespaces ou encapsulamento. Conflitos de nome são resolvidos com `var` (GAP-TECH-07) ou sobrescrita silenciosa (GAP-TECH-05, GAP-TECH-06).
- Consequência direta: Adicionar novos serviços aumenta a probabilidade de colisão de nomes. Não é possível isolar responsabilidades. A presença simultânea de `ValidationService.js` e `QrServiceClean.js` com funções de mesmo nome é um efeito direto dessa limitação.

**Deploy único sem separação de ambientes**
- Situação atual: Um único `scriptId` em `.clasp.json` representa o ambiente em produção. Não há configuração para ambiente de homologação.
- Consequência direta: Não é possível testar alterações em ambiente isolado. Qualquer push via clasp vai diretamente para produção. Rollback depende do histórico de versões interno do GAS.

---

### Reuso

**Frontend sem componentes reutilizáveis reais**
- Situação atual: `components.html` define tokens CSS e classes. CSS e JS das telas `TelaSetor` e `TelaAdmin` são separados em includes (`TelaSetorCss.html`, `TelaSetorJs.html`, etc.). `TelaSolicitante.html` e `Index.html` têm CSS e JS completamente inline.
- Consequência direta: Alterações de design global exigem edição em múltiplos arquivos. A mesma lógica de polling é reimplementada em cada tela de forma independente. Não há reuso real de componentes entre telas.

**Modelo de dados sem versionamento histórico**
- Situação atual: `ITENS` armazena apenas estado atual (status, solicitante atual, data do empréstimo). `FUNCIONARIOS` armazena apenas cadastro atual. Não há soft-delete nem tabela de histórico de alterações.
- Consequência direta: Não é possível responder a perguntas como "quem tinha este kit em janeiro?" ou "este funcionário já esteve em outro setor?". O histórico de movimentação existe apenas nas sheets `SOLICITACOES` e `DEVOLUCOES`, que crescem indefinidamente sem estratégia de arquivamento.

---

## 5. Síntese dos Gaps Críticos

Ordenados por impacto (alto → baixo):

1. **GAP-TECH-05 + GAP-TECH-06** — Funções `fetchLastResultSince` e `getSolicitanteStatus` duplicadas com implementações conflitantes em escopo global. O comportamento efetivo depende da ordem de carregamento dos arquivos. Risco de operação silenciosamente incorreta em produção.

2. **GAP-FUNC-02** — Fila de validação sem isolamento por solicitante. Duas operações simultâneas do mesmo tipo resultam em entrega de código errada, com risco de registro de operação para funcionário incorreto.

3. **GAP-TECH-07** — `MANUAL_CODE_TTL` redeclarado com valores conflitantes (3600s vs 300s). O TTL efetivo do código manual é indeterminado sem conhecer a ordem de carregamento do GAS.

4. **GAP-TECH-04** — `recordReturn` sem LockService. Devoluções concorrentes podem resultar em inconsistência de dados sem mecanismo de proteção.

5. **GAP-TECH-01** — Credenciais hardcoded no código-fonte com acesso compartilhado por perfil. Impossível revogar acesso individual ou rotacionar senhas sem redeploy.

6. **GAP-ARCHI-01** (derivado de GAP-FUNC-02) — Capacidade estrutural de 1 operação simultânea por tipo. Crescimento de usuários simultâneos é bloqueado pela arquitetura da fila.

7. **GAP-FUNC-04** — Devolução sem identificação do item físico. Impossível rastrear a trajetória de um kit específico ao longo do tempo.

8. **GAP-TECH-03** — Full-scan de sheets em toda operação com chamadas individuais por célula em `updateItemStatus`. Degradação de performance diretamente proporcional ao volume de dados.

9. **GAP-FUNC-05** — Dashboard desatualizado por até 5 minutos sem invalidação por evento. Decisões administrativas baseadas em estado stale.

10. **GAP-FUNC-06** — Exportação com formato inconsistente e risco de acúmulo de arquivos temporários no Drive.

11. **GAP-ARCHI-02** — Ausência de transações na persistência. Falha parcial em operações multi-escrita não tem rollback.

12. **GAP-FUNC-07 + GAP-FUNC-08** — Gestão de inventário e cadastro de funcionários dependem de edição direta na planilha, fora do controle do sistema.
