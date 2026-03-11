# Checklist de Repaginação do Design System

Objetivo: transformar a interface para um padrão mais fluido, atraente, consistente e reutilizável, com componentização e boas práticas de UX.

## 1) Direção visual e princípios
- [x] Definir direção visual oficial (estilo, nível de contraste, densidade, tom da marca).
- [ ] Definir princípios de UX que vão guiar todas as telas (clareza, consistência, feedback, acessibilidade).
- [ ] Definir guideline de uso de cor para status (sucesso, alerta, erro, info) sem ambiguidades.
- [ ] Definir guideline de uso de ícones (quando usar, tamanho padrão, alinhamento).
- [ ] Definir padrão de espaçamento e ritmo visual para toda a aplicação.

## 2) Fundação do design system (tokens)
- [x] Revisar e reorganizar tokens globais em `frontend/src/globals.css`.
- [x] Criar escala tipográfica semântica (display, heading, body, caption).
- [ ] Criar escala de espaçamento consistente (4/8 ou equivalente) e mapear para utilitários.
- [x] Definir escala de raios, sombras, bordas e opacidades por nível de elevação.
- [x] Definir durações e curvas de animação padrão (entrada, saída, hover, focus).
- [x] Padronizar tokens para tema claro/escuro com contraste AA mínimo.
- [ ] Eliminar cores hardcoded fora dos tokens (migrar para variáveis semânticas).

## 3) Componentes base (UI primitives)
- [x] Padronizar API e variantes de `Button` (`variant`, `size`, `loading`, `iconOnly`).
- [x] Padronizar `Input` e derivados (estado de erro, helper text, disabled, readonly).
- [x] Padronizar `Select` (estados, altura, foco, comportamento mobile).
- [x] Padronizar `Badge` para status e categorias com semântica clara.
- [x] Padronizar `Card` (header/content/footer, densidade e elevação por contexto).
- [x] Refatorar `Modal` para acessibilidade completa (focus trap, aria, scroll lock robusto).
- [x] Padronizar `Tabs` com comportamento consistente e responsivo.
- [x] Revisar `Toast` para fila, duração configurável, acessibilidade e variações visuais.
- [x] Garantir que todos os componentes base tenham contrato de props consistente.

## 4) Componentes compostos reutilizáveis
- [x] Criar componente de `PageHeader` (título, subtítulo, ações, filtros).
- [x] Criar componente de `FilterBar` reutilizável para abas administrativas.
- [x] Criar componente de `DataTable` padrão com estados de loading/empty/error.
- [x] Criar componente de `TableActions` para botões de linha (editar/apagar/detalhar).
- [x] Criar componente de `FormField` (Label + controle + mensagem + erro).
- [x] Criar componente de `ConfirmDialog` para ações destrutivas.
- [x] Criar componente de `StatusPill` para padronizar status em todas as telas.
- [x] Criar componente de `EmptyState` para listas e tabelas vazias.

## 5) Shell e navegação da aplicação
- [x] Refatorar shell principal (`Header`, `Sidebar`, `Footer`, área de conteúdo) para layout único e reutilizável.
- [x] Padronizar comportamento da sidebar (colapsada/expandida) e estados visuais.
- [x] Melhorar hierarquia visual da navegação (seções, item ativo, hover, foco).
- [x] Revisar busca global para consistência visual e de interação.
- [x] Definir breakpoints claros e comportamento mobile-first para shell.

## 6) Padronização das telas administrativas
- [x] Migrar todas as abas para usar os novos componentes compostos (sem duplicação).
- [x] Remover estruturas de tabela repetidas e concentrar em componente único.
- [x] Padronizar botões de ação (posição, hierarquia, textos, ícones).
- [x] Padronizar modais de criação/edição (estrutura, validações, feedback).
- [x] Padronizar filtros, busca e ordenação entre abas.
- [x] Padronizar mensagens de sucesso/erro e feedback de operações.

## 7) UX, acessibilidade e microinterações
- [x] Garantir navegação completa por teclado em componentes interativos.
- [x] Garantir foco visível consistente em toda a interface.
- [x] Revisar roles ARIA, labels, títulos e descrição em componentes.
- [ ] Revisar contraste de texto, bordas e elementos interativos.
- [x] Definir estados claros: loading, sucesso, vazio, erro, sem permissão.
- [x] Adicionar microinterações leves e consistentes (sem excesso de animação).
- [x] Respeitar `prefers-reduced-motion` quando aplicável.

## 8) Qualidade de código e manutenção
- [x] Remover duplicação de classes utilitárias com helpers/variantes reutilizáveis.
- [ ] Centralizar constantes de UI (labels recorrentes, tamanhos, iconografia).
- [x] Garantir padrão único de nomenclatura para componentes e props.
- [ ] Revisar composição para evitar prop-drilling desnecessário.
- [x] Corrigir warnings e erros atuais de lint no frontend.
- [x] Garantir tipagem forte em todo o design system (TypeScript).

## 9) Performance e robustez
- [x] Revisar renderizações desnecessárias em componentes de layout.
- [x] Aplicar memoização onde houver ganho real (sem overengineering).
- [ ] Otimizar interações de lista/tabela para grandes volumes.
- [x] Garantir transições leves sem impacto perceptível de performance.

## 10) Testes e documentação
- [ ] Criar documentação de uso dos componentes base (props, exemplos, do/dont).
- [ ] Documentar tokens e regras de estilo (cor, tipografia, espaçamento).
- [ ] Criar checklist de QA visual para telas principais.
- [ ] Criar testes de comportamento para componentes críticos.
- [ ] Validar fluxos principais em desktop e mobile.

## 11) Estratégia de rollout (execução)
- [x] Executar por fases: Fundação -> Primitives -> Compostos -> Shell -> Telas.
- [ ] Abrir PRs pequenos por bloco para facilitar revisão e rollback.
- [ ] Definir critério de pronto por fase antes de avançar.
- [ ] Registrar mudanças relevantes no `README.md`/`docs`.

## Critérios de pronto (Definition of Done)
- [x] Todas as telas usam os mesmos componentes e padrões de interação.
- [x] Não há duplicação relevante de UI entre abas e páginas.
- [ ] A experiência está consistente em desktop e mobile.
- [ ] Acessibilidade básica validada (teclado, foco, contraste, ARIA).
- [x] Lint sem erros no frontend.
- [ ] Documentação mínima do design system disponível para evolução futura.
