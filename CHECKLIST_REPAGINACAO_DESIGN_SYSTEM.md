# Checklist de Repaginacao do Design System

Objetivo: transformar a interface para um padrao mais fluido, atraente, consistente e reutilizavel, com componentizacao e boas praticas de UX.

## 1) Direcao visual e principios
- [x] Definir direcao visual oficial (estilo, nivel de contraste, densidade, tom da marca).
- [ ] Definir principios de UX que vao guiar todas as telas (clareza, consistencia, feedback, acessibilidade).
- [ ] Definir guideline de uso de cor para status (sucesso, alerta, erro, info) sem ambiguidades.
- [ ] Definir guideline de uso de icones (quando usar, tamanho padrao, alinhamento).
- [ ] Definir padrao de espacamento e ritmo visual para toda a aplicacao.

## 2) Fundacao do design system (tokens)
- [x] Revisar e reorganizar tokens globais em `frontend/src/globals.css`.
- [x] Criar escala tipografica semantica (display, heading, body, caption).
- [ ] Criar escala de espacamento consistente (4/8 ou equivalente) e mapear para utilitarios.
- [x] Definir escala de raios, sombras, bordas e opacidades por nivel de elevacao.
- [x] Definir duracoes e curvas de animacao padrao (entrada, saida, hover, focus).
- [x] Padronizar tokens para tema claro/escuro com contraste AA minimo.
- [ ] Eliminar cores hardcoded fora dos tokens (migrar para variaveis semanticas).

## 3) Componentes base (UI primitives)
- [x] Padronizar API e variantes de `Button` (`variant`, `size`, `loading`, `iconOnly`).
- [x] Padronizar `Input` e derivados (estado de erro, helper text, disabled, readonly).
- [x] Padronizar `Select` (estados, altura, foco, comportamento mobile).
- [x] Padronizar `Badge` para status e categorias com semantica clara.
- [x] Padronizar `Card` (header/content/footer, densidade e elevacao por contexto).
- [x] Refatorar `Modal` para acessibilidade completa (focus trap, aria, scroll lock robusto).
- [x] Padronizar `Tabs` com comportamento consistente e responsivo.
- [x] Revisar `Toast` para fila, duracao configuravel, acessibilidade e variacoes visuais.
- [x] Garantir que todos os componentes base tenham contrato de props consistente.

## 4) Componentes compostos reutilizaveis
- [x] Criar componente de `PageHeader` (titulo, subtitulo, acoes, filtros).
- [x] Criar componente de `FilterBar` reutilizavel para abas administrativas.
- [x] Criar componente de `DataTable` padrao com estados de loading/empty/error.
- [x] Criar componente de `TableActions` para botoes de linha (editar/apagar/detalhar).
- [x] Criar componente de `FormField` (Label + controle + mensagem + erro).
- [x] Criar componente de `ConfirmDialog` para acoes destrutivas.
- [x] Criar componente de `StatusPill` para padronizar status em todas as telas.
- [x] Criar componente de `EmptyState` para listas e tabelas vazias.

## 5) Shell e navegacao da aplicacao
- [x] Refatorar shell principal (`Header`, `Sidebar`, `Footer`, area de conteudo) para layout unico e reutilizavel.
- [x] Padronizar comportamento da sidebar (colapsada/expandida) e estados visuais.
- [x] Melhorar hierarquia visual da navegacao (secoes, item ativo, hover, foco).
- [x] Revisar busca global para consistencia visual e de interacao.
- [x] Definir breakpoints claros e comportamento mobile-first para shell.

## 6) Padronizacao das telas administrativas
- [x] Migrar todas as abas para usar os novos componentes compostos (sem duplicacao).
- [x] Remover estruturas de tabela repetidas e concentrar em componente unico.
- [x] Padronizar botoes de acao (posicao, hierarquia, textos, icones).
- [x] Padronizar modais de criacao/edicao (estrutura, validacoes, feedback).
- [x] Padronizar filtros, busca e ordenacao entre abas.
- [x] Padronizar mensagens de sucesso/erro e feedback de operacoes.

## 7) UX, acessibilidade e microinteracoes
- [x] Garantir navegacao completa por teclado em componentes interativos.
- [x] Garantir foco visivel consistente em toda a interface.
- [x] Revisar roles ARIA, labels, titulos e descricao em componentes.
- [ ] Revisar contraste de texto, bordas e elementos interativos.
- [x] Definir estados claros: loading, sucesso, vazio, erro, sem permissao.
- [x] Adicionar microinteracoes leves e consistentes (sem excesso de animacao).
- [x] Respeitar `prefers-reduced-motion` quando aplicavel.

## 8) Qualidade de codigo e manutencao
- [x] Remover duplicacao de classes utilitarias com helpers/variantes reutilizaveis.
- [ ] Centralizar constantes de UI (labels recorrentes, tamanhos, iconografia).
- [x] Garantir padrao unico de nomenclatura para componentes e props.
- [ ] Revisar composicao para evitar prop-drilling desnecessario.
- [x] Corrigir warnings e erros atuais de lint no frontend.
- [x] Garantir tipagem forte em todo o design system (TypeScript).

## 9) Performance e robustez
- [x] Revisar renderizacoes desnecessarias em componentes de layout.
- [x] Aplicar memoizacao onde houver ganho real (sem overengineering).
- [ ] Otimizar interacoes de lista/tabela para grandes volumes.
- [x] Garantir transicoes leves sem impacto perceptivel de performance.

## 10) Testes e documentacao
- [ ] Criar documentacao de uso dos componentes base (props, exemplos, do/dont).
- [ ] Documentar tokens e regras de estilo (cor, tipografia, espacamento).
- [ ] Criar checklist de QA visual para telas principais.
- [ ] Criar testes de comportamento para componentes criticos.
- [ ] Validar fluxos principais em desktop e mobile.

## 11) Estrategia de rollout (execucao)
- [x] Executar por fases: Fundacao -> Primitives -> Compostos -> Shell -> Telas.
- [ ] Abrir PRs pequenos por bloco para facilitar revisao e rollback.
- [ ] Definir criterio de pronto por fase antes de avancar.
- [ ] Registrar mudancas relevantes no `README.md`/`docs`.

## Criterios de pronto (Definition of Done)
- [x] Todas as telas usam os mesmos componentes e padroes de interacao.
- [x] Nao ha duplicacao relevante de UI entre abas e paginas.
- [ ] A experiencia esta consistente em desktop e mobile.
- [ ] Acessibilidade basica validada (teclado, foco, contraste, ARIA).
- [x] Lint sem erros no frontend.
- [ ] Documentacao minima do design system disponivel para evolucao futura.
