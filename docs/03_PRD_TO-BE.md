# PRD TO-BE — V2 — Appscript Reunir

---

## 1. Contexto e Motivação

- Sistema de controle de empréstimo e devolução de kits de uniforme/equipamento para funcionários, operando como web app GAS com 3 perfis: Solicitante, Setor e Administrador.
- A V2 é necessária porque o sistema atual produz comportamento indeterminado em operações simultâneas (GAP-TECH-05, GAP-TECH-06, GAP-TECH-07), não oferece rastreabilidade individual de operadores (GAP-FUNC-01, GAP-TECH-01) e não protege devoluções contra race condition (GAP-TECH-04) — riscos que comprometem a confiabilidade dos dados em produção.

---

## 2. Objetivos da V2

| # | Objetivo | GAPs Resolvidos |
|---|---|---|
| OBJ-01 | Garantir que operações simultâneas do mesmo tipo não se interfiram nem corrompam dados | GAP-FUNC-02, GAP-TECH-04, GAP-TECH-05, GAP-TECH-06, GAP-TECH-07 |
| OBJ-02 | Eliminar autenticação compartilhada — toda operação deve ser rastreável ao indivíduo que a executou | GAP-FUNC-01, GAP-TECH-01 |
| OBJ-03 | Permitir que operadores identifiquem e selecionem o item físico específico em devoluções | GAP-FUNC-04 |
| OBJ-04 | Habilitar gestão de inventário e de funcionários diretamente no sistema, sem acesso direto à planilha | GAP-FUNC-07, GAP-FUNC-08 |
| OBJ-05 | Estabilizar e tornar determinístico o comportamento da exportação de dados | GAP-FUNC-06, GAP-TECH-09 |

---

## 3. Não-Objetivos (Fora de Escopo da V2)

> **Decisão registrada:** A V2 inclui migração da plataforma de execução para fora do Google Apps Script. O item abaixo foi removido dos Não-Objetivos.

- Criação de novos perfis de acesso além dos 3 existentes (Solicitante, Setor, Administrador)
- Integração com sistemas externos de RH ou folha de pagamento
- Implementação de framework de testes automatizados
- Criação de ambiente de homologação separado
- Suporte a aplicativo móvel nativo
- Arquivamento automático de histórico de movimentações (SOLICITACOES/DEVOLUCOES)
- Relatórios além do dashboard atual e exportação pontual
- Alteração no modelo visual das telas (UI/UX) além do necessário para as novas funções

---

## 4. Usuários e Casos de Uso

### Usuários

| Perfil | Quem é | O que faz no sistema |
|---|---|---|
| Solicitante | Funcionário que retira ou devolve kit | Aguarda código de validação, visualiza resultado da operação |
| Responsável de Setor | Funcionário encarregado do controle do setor | Busca funcionário, gera código, seleciona item, confirma/cancela operação, monitora status |
| Administrador | Gestor operacional | Visualiza dashboard, exporta dados, gerencia kits e cadastro de funcionários |

### Casos de Uso

| UC | Ator | Objetivo | Resultado Esperado |
|---|---|---|---|
| UC-01 | Solicitante | Solicitar empréstimo de kit | Código exibido na tela, operação registrada quando confirmada pelo Setor |
| UC-02 | Solicitante | Devolver kit(s) | Código exibido na tela, devolução registrada quando confirmada pelo Setor |
| UC-03 | Responsável de Setor | Iniciar e confirmar operação de empréstimo | Kit associado ao funcionário, status atualizado |
| UC-04 | Responsável de Setor | Iniciar e confirmar devolução selecionando item físico | Item específico liberado, status atualizado |
| UC-05 | Administrador | Visualizar e filtrar dashboard | KPIs e tabela refletindo estado atual das operações |
| UC-06 | Administrador | Exportar dados filtrados | Arquivo de download gerado no formato definido |
| UC-07 | Administrador | Gerenciar inventário de kits | Adicionar, inativar ou corrigir registros de kits sem acesso direto à planilha |
| UC-08 | Administrador | Gerenciar cadastro de funcionários | Cadastrar, editar, inativar funcionários sem acesso direto à planilha |
| UC-09 | Administrador | Gerenciar credenciais de acesso | Criar, alterar ou revogar credenciais individuais sem alterar código nem fazer redeploy |

---

## 5. Escopo Funcional

### 5.1. Funcionalidades Mantidas (AS-IS → V2)

**FM-01 — Fluxo de Empréstimo via Código de Validação**
- Descrição: Setor gera código, Solicitante visualiza código em polling, Setor confirma a operação.
- Critério de aceite: Operação de empréstimo registrada nas sheets SOLICITACOES e ITENS com dados corretos em 100% das execuções isoladas.
- Prioridade: P0

**FM-02 — Fluxo de Devolução via Código de Validação**
- Descrição: Setor gera código de devolução, Solicitante visualiza, Setor confirma.
- Critério de aceite: Operação de devolução registrada em DEVOLUCOES e status do item atualizado para disponível em 100% das execuções isoladas.
- Prioridade: P0

**FM-03 — Dashboard Administrativo com Filtros**
- Descrição: Visualização de KPIs e tabela paginada, com filtros por data, setor e funcionário. Views: global, por setor, por funcionário.
- Critério de aceite: Filtros retornam resultados consistentes com os registros nas sheets. Drill-down de KPI e linha funcionando.
- Prioridade: P1

**FM-04 — Exportação de Dados Filtrados**
- Descrição: Gera arquivo para download a partir dos filtros ativos no dashboard.
- Critério de aceite: Ver FM-04 modificado (seção 5.2).
- Prioridade: P1

**FM-05 — Roteamento por Perfil (page parameter)**
- Descrição: URL com parâmetro `page` redireciona para a tela correspondente ao perfil autenticado.
- Critério de aceite: Acesso à tela correta para cada perfil; tentativa de acesso a tela de outro perfil sem sessão válida é bloqueada.
- Prioridade: P0

**FM-06 — Monitoramento de Status na Tela do Setor**
- Descrição: Display de monitoramento exibe se há solicitante aguardando e o tipo de operação pendente.
- Critério de aceite: Status exibido reflete o estado real da fila ativa do Solicitante identificado. Sem estados fantasma de outros solicitantes.
- Prioridade: P0

---

### 5.2. Funcionalidades Modificadas (Mudam na V2)

**FMD-01 — Autenticação e Controle de Sessão**
- Estado atual: Três chaves fixas, compartilhadas por perfil; Solicitante sem autenticação; credenciais hardcoded em `AuthService.js`.
- Comportamento esperado na V2: Cada usuário dos perfis Setor e Administrador possui credencial individual. A tela do Solicitante associa o acesso à matrícula informada no início da operação, sem exigir senha, mas registrando a matrícula como identificador da sessão. Credenciais gerenciadas pelo Administrador sem alterar código nem redeploy.
- Critério de aceite: (1) Dois usuários do perfil Setor operam simultaneamente com sessões distintas, identificadas individualmente nos logs. (2) Revogação de credencial de um usuário não afeta os demais do mesmo perfil. (3) Nenhuma credencial de acesso presente no código-fonte ou no repositório.
- GAP relacionado: GAP-FUNC-01, GAP-TECH-01
- Prioridade: P0

**FMD-02 — Fila de Validação com Isolamento por Solicitante**
- Estado atual: Uma única chave de cache por tipo de operação; segundo código gerado sobrescreve o primeiro sem notificação.
- Comportamento esperado na V2: Cada operação gerada é associada à matrícula do funcionário. Dois funcionários aguardando operações do mesmo tipo simultaneamente recebem seus próprios códigos sem interferência. O código exibido ao Solicitante é sempre o código gerado para a sua matrícula específica.
- Critério de aceite: (1) Teste com dois funcionários A e B solicitando empréstimo simultaneamente: A recebe o código de A, B recebe o código de B — em 100% das execuções. (2) Confirmação de operação de A não altera o estado da operação de B.
- GAP relacionado: GAP-FUNC-02, GAP-TECH-05, GAP-TECH-06
- Prioridade: P0

**FMD-03 — Devolução com Seleção de Item Físico**
- Estado atual: Sistema seleciona automaticamente os primeiros N itens da lista sem critério explícito.
- Comportamento esperado na V2: Ao iniciar uma devolução, o Responsável de Setor visualiza a lista de itens atualmente emprestados ao funcionário e seleciona qual(is) está(ão) sendo fisicamente devolvido(s). O sistema registra o item específico selecionado.
- Critério de aceite: (1) Para funcionário com 2 kits, a tela do Setor exibe os IDs dos 2 itens antes de confirmar. (2) O registro em DEVOLUCOES contém o ID do item exatamente como selecionado pelo operador. (3) Apenas o item selecionado tem status alterado para disponível.
- GAP relacionado: GAP-FUNC-04
- Prioridade: P1

**FMD-04 — Dados do Dashboard Atualizados por Evento**
- Estado atual: Cache de 300s sem invalidação após operações; dados podem estar desatualizados por até 5 minutos.
- Comportamento esperado na V2: A conclusão de qualquer operação de empréstimo ou devolução invalida o snapshot do dashboard. A próxima consulta ao dashboard retorna dados que incluem a operação recém-concluída.
- Critério de aceite: Após conclusão de uma operação, a próxima carga do dashboard (sem filtro de tempo) reflete a operação em menos de 5 segundos. Invalidação é por evento — sem TTL fixo de cache para dados de operações ativas.
- GAP relacionado: GAP-FUNC-05
- Prioridade: P1

**FMD-05 — Exportação Estável e Determinística**
- Estado atual: Tenta gerar `.xlsx` via endpoint não oficial; em falha retorna `.csv` silenciosamente; arquivo temporário no Drive pode não ser deletado.
- Comportamento esperado na V2: O formato de saída da exportação é fixo e definido (não alterna entre formatos sem aviso). O usuário sabe antes de acionar qual formato receberá. Nenhum arquivo temporário permanece no Drive após o download, independentemente do resultado da operação.
- Critério de aceite: (1) 10 exportações consecutivas com os mesmos filtros produzem o mesmo formato de saída. (2) Após cada exportação (com sucesso ou com erro), nenhum arquivo temporário remanescente é criado no Drive do deployer. (3) Em caso de falha, o usuário recebe mensagem de erro explícita — não recebe um arquivo em formato alternativo silenciosamente.
- GAP relacionado: GAP-FUNC-06, GAP-TECH-09
- Prioridade: P1

**FMD-06 — Concorrência em Devoluções (Proteção contra Race Condition)**
- Estado atual: `recordReturn` não utiliza exclusão mútua; duas devoluções simultâneas do mesmo funcionário podem corromper dados.
- Comportamento esperado na V2: Operações de devolução possuem a mesma proteção de exclusão mútua já presente nas operações de empréstimo. Devoluções concorrentes do mesmo funcionário são serializadas.
- Critério de aceite: Duas devoluções do mesmo funcionário iniciadas simultaneamente resultam em exatamente N itens devolvidos, sem registros duplicados e sem inconsistência no status dos itens.
- GAP relacionado: GAP-TECH-04
- Prioridade: P0

**FMD-07 — TTL de Código Manual Único e Definido**
- Estado atual: `MANUAL_CODE_TTL` declarado com valor 3600s em `ConfigClean.js` e redeclarado com 300s em `QrServiceClean.js`; valor efetivo indeterminado.
- Comportamento esperado na V2: Um único valor de TTL para código manual, definido em um único local, com comportamento determinístico e documentado.
- Critério de aceite: Código manual gerado expira no intervalo exato definido na configuração — verificável em teste: código válido em t=TTL-1s, inválido em t=TTL+1s.
- GAP relacionado: GAP-TECH-07
- Prioridade: P0

---

### 5.3. Funcionalidades Novas (V2)

**FN-01 — Gestão de Inventário de Kits via Interface**
- Descrição: Administrador pode adicionar novos kits, inativar kits existentes (sem deletar histórico) e corrigir dados de kits (descrição, ID) diretamente na interface do sistema, sem acesso direto ao banco.
- Critério de aceite: (1) Kit adicionado via interface aparece disponível para empréstimo imediatamente. (2) Kit inativado não aparece como disponível para novas operações. (3) Operação de adição/inativação registra o usuário Administrador que a executou e o timestamp. (4) **Inativação de kit com empréstimo ativo é bloqueada** — sistema retorna erro com matrícula e nome do funcionário que detém o kit; Admin deve aguardar a devolução ou registrá-la primeiro.
- GAP relacionado: GAP-FUNC-07
- Prioridade: P1

**FN-04 — Configuração Global do Limite de Kits por Funcionário**
- Descrição: Administrador pode alterar o limite máximo de kits simultâneos por funcionário via interface, sem redeploy. Valor único global aplicado a todos os funcionários.
- Critério de aceite: (1) Alteração do limite pelo Admin entra em vigor imediatamente para novas solicitações. (2) Funcionários com empréstimos existentes acima do novo limite não são afetados retroativamente. (3) Valor configurável armazenado no banco (tabela de configuração), não no código-fonte.
- GAP relacionado: GAP-FUNC-03
- Prioridade: P1

**FN-02 — Gestão de Cadastro de Funcionários via Interface**
- Descrição: Administrador pode cadastrar novos funcionários, editar dados (nome, setor, função) e inativar funcionários diretamente na interface, sem acesso direto à planilha.
- Critério de aceite: (1) Funcionário cadastrado via interface está disponível para busca pelo Setor imediatamente. (2) Funcionário inativado não pode receber novos empréstimos. (3) Matrícula duplicada é rejeitada com mensagem de erro. (4) Toda alteração registra o usuário Administrador e o timestamp.
- GAP relacionado: GAP-FUNC-08
- Prioridade: P1

**FN-03 — Gestão de Credenciais Individuais via Interface**
- Descrição: Administrador pode criar, alterar e revogar credenciais individuais para usuários dos perfis Setor e Administrador, sem editar código e sem redeploy.
- Critério de aceite: (1) Credencial criada pelo Admin funciona imediatamente. (2) Credencial revogada impede login imediatamente, sem afetar outros usuários do mesmo perfil. (3) Nenhuma credencial está presente no código-fonte do sistema.
- GAP relacionado: GAP-FUNC-01, GAP-TECH-01
- Prioridade: P0

---

### 5.4. Funcionalidades Removidas (AS-IS → Sai)

| Funcionalidade | Motivo |
|---|---|
| Geração de QR Code via `api.qrserver.com` | **Removido** — dependência de API externa sem SLA; fallback bloqueante (GAP-TECH-08). V2 opera exclusivamente com código de 6 dígitos. `QrServiceClean.js` não tem equivalente na V2. |
| Chaves de acesso compartilhadas por perfil (`123`, `321`, `hotelaria2025@`) | Substituídas por credenciais individuais (FMD-01 / FN-03). Não coexistem com o novo modelo. |
| Endpoint não oficial de export do Google Sheets (`feeds/download/spreadsheets/Export`) | Substituído por mecanismo de exportação estável (FMD-05). |

---

## 6. Requisitos Não Funcionais

**RNF-01 — Isolamento de Operações Simultâneas**
- Requisito: O sistema suporta no mínimo 2 pares Setor+Solicitante operando simultaneamente (empréstimo ou devolução) sem interferência entre operações. Implementado via `SELECT FOR UPDATE` em transação PostgreSQL.
- Como verificar: Teste de concorrência com 2 pares simultâneos do mesmo tipo de operação; verificar que cada Solicitante recebe o código correto e que os registros no banco são independentes e corretos.

**RNF-02 — Rastreabilidade de Operações**
- Requisito: Toda operação de empréstimo e devolução registrada no banco deve conter o nome completo (`operador_nome`) do usuário Setor que a confirmou (não apenas a matrícula do Solicitante).
- Como verificar: Após operação, verificar nas tabelas SOLICITACOES e DEVOLUCOES a presença do campo `operador_nome` preenchido com o nome do usuário Setor autenticado.

**RNF-03 — Tempo de Resposta das Operações Principais**
- Requisito: As operações `gerarCódigo`, `confirmarOperação` e `consultarStatus` devem retornar em até 5 segundos em condição normal de uso.
- Como verificar: Medir tempo de resposta de cada operação em 20 execuções consecutivas com banco no volume inicial; nenhuma deve exceder 5s.

**RNF-04 — Sem Dependências Externas no Caminho Crítico**
- Requisito: Nenhuma dependência de rede externa (API de terceiros) está no caminho crítico das operações de empréstimo ou devolução. QR Code removido — sem API externa. Exportação via exceljs (local, sem Drive).
- Como verificar: Auditoria das dependências do fluxo principal; confirmar que `gerarCódigo` e `confirmarOperação` não fazem chamadas HTTP externas.

**RNF-05 — Credenciais Fora do Código-Fonte**
- Requisito: Nenhuma credencial de acesso (chave, senha, token) pode estar presente no código-fonte ou no repositório git.
- Como verificar: Auditoria estática do repositório; nenhum resultado para os padrões das chaves atuais (`123`, `321`, `hotelaria2025@`) nem para novas credenciais.

**RNF-06 — Auditoria de Alterações Administrativas**
- Requisito: Toda operação administrativa (adicionar/inativar kit, cadastrar/inativar funcionário, criar/revogar credencial) registra: usuário, timestamp e dados alterados.
- Como verificar: Após cada operação administrativa, verificar existência do registro de auditoria com os 3 campos.

**RNF-07 — Consistência de Dados em Falha Parcial**
- Requisito: Em caso de falha durante uma operação multi-escrita (empréstimo ou devolução), o sistema não deve deixar dados em estado inconsistente — o item deve estar `Disponível` ou `Emprestado`, nunca em estado intermediário indeterminado.
- Como verificar: Forçar falha simulada durante escrita em ITENS após escrita em SOLICITACOES; verificar que o estado final é consistente (operação totalmente aplicada ou totalmente revertida).

---

## 7. Dados e Integrações

### Entidades (tabelas no banco relacional PostgreSQL)

> V2 parte de banco limpo. Entidades abaixo são tabelas novas — não são migrações das sheets. Schema detalhado no TDD.

| Entidade | Propósito | Campos novos na V2 (além dos existentes na V1) |
|---|---|---|
| `funcionarios` | Cadastro de funcionários ativos e inativos | `status_ativo` (boolean), `atualizado_por` (nome), `atualizado_em` (timestamp) |
| `itens` | Inventário de kits físicos | `status_ativo` (boolean), `atualizado_por` (nome), `atualizado_em` (timestamp) |
| `solicitacoes` | Log de empréstimos | `operador_nome` (nome completo do usuário Setor que confirmou) |
| `devolucoes` | Log de devoluções | `operador_nome` (nome completo do usuário Setor que confirmou); `item_id` explícito (selecionado pelo operador) |
| `resultados` | Log de resultados de operação | Sem alteração |
| `configuracoes` | Parâmetros do sistema editáveis pelo Admin | `max_kits_por_funcionario` (int, padrão 2) |

### Entidade Nova

| Entidade | Propósito |
|---|---|
| Credenciais de Usuário | Armazena credenciais individuais dos perfis Setor e Administrador. Gerenciada pelo Administrador via interface. Nenhuma credencial no código-fonte. |

### Integrações

| Integração | Necessidade | Observação |
|---|---|---|
| Banco Relacional (PostgreSQL) | Persistência de todas as entidades operacionais da V2 | Nova — substitui Google Sheets como backend de dados; schema definido no TDD |
| Google Sheets | Migração pontual de dados históricos | Script run-once: exporta dados das 5 sheets para o banco relacional no corte; Sheets API não usada em runtime |
| Google Drive | Exportação de dados | **Removida** — exportação implementada com biblioteca nativa (exceljs) em memória; nenhum arquivo criado no Drive; resolve FMD-05 integralmente |
| CacheService (GAS) | Estados transientes: sessões, filas de validação, resultados | **Substituída** — primitivo GAS; V2 usa solução de cache independente (Redis ou in-memory) com isolamento por matrícula (FMD-02) |
| LockService (GAS) | Exclusão mútua em escrita | **Substituída** — primitivo GAS; V2 usa `SELECT FOR UPDATE` em transação PostgreSQL, cobrindo empréstimo e devolução (FMD-06) |
| API de QR Code (`api.qrserver.com`) | Geração de imagem QR | **Removida** — V2 opera exclusivamente com código de 6 dígitos; elimina GAP-TECH-08 |

### Campos Críticos

- Matrícula: string numérica — chave de identificação do funcionário em todas as tabelas
- ID do item: string — chave de identificação do kit físico; preservado em todas as movimentações
- Timestamp: formato a definir no TDD (ISO 8601 recomendado para banco relacional)
- `operador_nome`: varchar — nome completo do usuário Setor; campo obrigatório em `solicitacoes` e `devolucoes`

---

## 8. Migração e Compatibilidade

**Decisão registrada: V2 recomeça do zero — sem migração de dados das Sheets.**

**O que acontece com os dados existentes:**
- Sheets da V1 (FUNCIONARIOS, ITENS, SOLICITACOES, DEVOLUCOES, RESULTADOS) são preservadas como arquivo histórico somente-leitura no Google Sheets
- V2 parte de banco PostgreSQL limpo — sem importação de registros históricos
- Cadastro inicial de funcionários e kits é realizado pelo Admin via interface (FN-01, FN-02) após o deploy

**Estratégia de corte:**
- Corte direto (big-bang): V1 é pausada; V2 entra em produção no mesmo dia
- Credencial admin padrão (seed) inserida no deploy; Admin altera no primeiro acesso e cadastra os usuários Setor via FN-03

**Restrições de rollout:**
- Transição do modelo de autenticação não pode ser gradual — todos os usuários Setor e Administrador migram para credenciais individuais no corte
- Não há coexistência: V1 (Sheets) e V2 (PostgreSQL) são sistemas independentes; V1 fica desativada após o corte

---

## 9. Métricas de Sucesso

| Métrica | Como medir | Objetivo vinculado |
|---|---|---|
| M-01: Taxa de operações com código entregue ao funcionário correto | Comparar matrícula do solicitante com matrícula registrada na operação confirmada | OBJ-01 — meta: 100% |
| M-02: Ocorrências de inconsistência em dados de kits (item com status incorreto) | Auditoria periódica: contagem de itens com status ≠ do derivável pelo histórico de SOLICITACOES e DEVOLUCOES | OBJ-01 — meta: 0 ocorrências/mês |
| M-03: Operações rastreáveis ao indivíduo que as executou | % de registros em `solicitacoes` e `devolucoes` com campo `operador_nome` preenchido (pós-V2) | OBJ-02 — meta: 100% das operações pós-deploy |
| M-04: Tempo até dashboard refletir operação concluída | Medir intervalo entre timestamp da operação e timestamp da carga do dashboard que a inclui | OBJ-01 / FMD-04 — meta: < 5 segundos |
| M-05: Taxa de sucesso da exportação (formato esperado recebido) | % de exportações que entregam o formato definido sem fallback silencioso | OBJ-05 — meta: 100% |
| M-06: Rotações de credencial executadas sem redeploy | Contagem de alterações de credencial realizadas pelo Administrador via interface em produção | OBJ-02 — meta: 100% das rotações sem envolver desenvolvedor |

---

## 10. Riscos e Dependências

### Riscos

| Risco | Evidência | Impacto |
|---|---|---|
| R-01: Quota diária do GAS esgotada em dias de alto volume | Polling de 500ms (Solicitante) + 3s (Setor) gera dezenas de chamadas por minuto por sessão ativa; sem monitoramento atual de cota | Indisponibilidade total do sistema sem distinção de erro para o usuário |
| R-02: Leitura full-scan degrada com crescimento do volume | `getUsers()` e `getItems()` leem toda a sheet em toda operação (GAP-TECH-03) | Latência crescente acima do RNF-03 à medida que ITENS e FUNCIONARIOS crescem |
| R-03: Falha parcial sem rollback em operações multi-escrita | Ausência de transações na persistência (GAP-ARCHI-02) | Estado inconsistente de item ou solicitação em caso de erro intermediário |
| R-04: Exportação pode falhar com mudança unilateral do Google no endpoint atual | Endpoint `feeds/download/spreadsheets/Export` não documentado e sem SLA (GAP-TECH-09) | Exportação quebra em produção sem aviso prévio |

### Dependências

| Dependência | Tipo | Crítico para |
|---|---|---|
| Credenciais do deployer (conta Google com acesso ao script e às sheets) | Pessoa/conta | Deploy e execução de toda a V2 |
| Acesso de escrita às sheets (FUNCIONARIOS, ITENS, SOLICITACOES, DEVOLUCOES, RESULTADOS) | Permissão | Toda operação de empréstimo, devolução e gestão |
| Acesso ao Drive do deployer | Permissão | Exportação de dados |
| Definição dos usuários iniciais do perfil Setor e Administrador (nomes + credenciais) | Informação do cliente | FN-03, FMD-01 — necessário antes do deploy da V2 |
| PENDENTE-02: Decisão sobre QR Code | Decisão do cliente | Escopo de FN/remoção |

---

## 11. Decisões Registradas

> Todos os pendentes foram fechados. Nenhuma questão aberta bloqueia o início do TDD.

| # | Decisão | Onde impacta |
|---|---|---|
| PENDENTE-01 | **Dashboard imediato (< 5s)** — invalidação por evento após operação concluída | FMD-04 critério de aceite; M-04 meta |
| PENDENTE-02 | **QR Code removido** — V2 opera exclusivamente com código de 6 dígitos | Seção 5.4; RNF-04; GAP-TECH-08 eliminado |
| PENDENTE-03 | **Corte direto (big-bang)** — sem coexistência V1/V2 | Seção 8 migração |
| PENDENTE-04 | **Seed com credencial admin padrão** no deploy; V2 recomeça do zero; Admin cadastra demais usuários via FN-03 | Seção 8; FN-03 |
| PENDENTE-05 | **Configurável globalmente** pelo Admin via interface, sem redeploy | FN-04; tabela `configuracoes` |
| PENDENTE-06 | **Bloquear inativação** de kit com empréstimo ativo | FN-01 critério de aceite (4) |
| PENDENTE-07 | **Nome completo** (`operador_nome`) nos logs de `solicitacoes` e `devolucoes` | RNF-02; seção 7 campos críticos; M-03 |
