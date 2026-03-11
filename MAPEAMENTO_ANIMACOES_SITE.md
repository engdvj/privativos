# Mapeamento Completo de Animações (Frontend)

## Objetivo
Definir um plano completo de motion para todo o site (login, logout, sidebar, navbar, menus, modais, tabelas e feedbacks), com padrão único, performance e acessibilidade.

## Escopo coberto
- Rotas: `frontend/src/App.tsx` (`/`, `/setor`, `/admin`)
- Páginas: `LoginPage`, `SetorPage`, `AdminPage`
- Shell: `Header`, `Footer`, `ProtectedRoute`
- Overlays: `Modal`, `ConfirmDialog`, `DropdownMenu`, `Select`, modais de `GlobalDetailProvider`
- CRUD/Admin: todas as tabs em `frontend/src/pages/admin/tabs/*`
- Feedback: `ToastProvider`, estados de loading, empty state

## Diagnóstico atual (gaps)
- Já existem microanimações pontuais (`animate-fade-up`, `transition-*`, `hover:*`, `animate-spin`), mas sem padrão global.
- As durações/easing variam por componente e por tela, sem tokens unificados de motion.
- Existem várias classes utilitárias do tipo `animate-in`, `fade-in-50`, `zoom-in-95`, `slide-in-from-*` em arquivos como `SetorPage`, `DropdownMenu` e `Select`.
- Não foi encontrada configuração/plugin para essas utilities no frontend (`frontend/package.json` e `frontend/src/globals.css`), então parte dessas animações pode estar sem efeito.

## Sistema de motion proposto (padrão)
Criar tokens globais no `frontend/src/globals.css`:

- Duração:
  - `--motion-duration-fast: 120ms`
  - `--motion-duration-base: 180ms`
  - `--motion-duration-slow: 280ms`
  - `--motion-duration-xl: 420ms`
- Curvas:
  - `--motion-ease-standard: cubic-bezier(0.2, 0, 0, 1)`
  - `--motion-ease-emphasized: cubic-bezier(0.2, 0.8, 0.2, 1)`
  - `--motion-ease-exit: cubic-bezier(0.4, 0, 1, 1)`
- Distâncias:
  - `--motion-distance-sm: 6px`
  - `--motion-distance-md: 12px`
  - `--motion-distance-lg: 20px`

Regras:
- Entradas: fade + translateY pequeno.
- Saídas: fade + scale leve (sem deslocamento grande).
- Hover/focus: máximo 120-180ms.
- Nada de animar propriedades caras (preferir `opacity` e `transform`).
- `prefers-reduced-motion`: reduzir para fade curto ou desabilitar transições não essenciais.

## Mapeamento por superfície (completo)

### 1) Autenticação (`LoginPage`, `ProtectedRoute`, logout em `Header`)
- Entrada da página de login:
  - Hero/background blobs: fade progressivo (sem loop agressivo).
  - Card de login: slide-up + fade (`280ms`).
  - Campos/botão: stagger curto (`40ms` entre elementos).
- Submit login:
  - Botão faz transição para loading sem salto de layout.
  - Em sucesso: transição de página com fade/slide horizontal curto.
  - Em erro: shake sutil no card (apenas se `prefers-reduced-motion` permitir).
- Validação silenciosa (`ProtectedRoute`):
  - Trocar tela vazia por skeleton fade-in.
- Logout (`Header`):
  - Ao clicar em sair: estado de saída global (overlay leve + fade da view) antes de navegar para `/`.

Prioridade: Alta

### 2) Shell global (`Header`, `AdminPage`, `Footer`)
- Header:
  - Entrada inicial: slide-down + fade (`180ms`).
  - Busca global: dropdown com fade/scale e highlight animado por item.
  - Avatar/menu usuário: trigger com press animation, menu com spring leve.
  - Toggle tema: cross-fade ícone Sol/Lua + rotação curta.
- Sidebar (`AdminPage`):
  - Colapsar/expandir largura com transição suave (`240ms`).
  - Itens: indicador ativo com motion de posição (layout transition).
  - Labels no modo expandido: fade/clip em vez de aparecer seco.
  - Resize drag: manter sem animação durante drag e animar apenas no release.
- Footer:
  - Botão suporte: hover com elevação pequena.
  - Modal de suporte: padrão único de overlay + panel.

Prioridade: Alta

### 3) Navegação entre telas/áreas
- Transição entre rotas (`/`, `/setor`, `/admin`):
  - Container com page transition única.
  - Entrada: `opacity 0 -> 1` + `translateY(8px -> 0)`.
  - Saída: `opacity 1 -> 0` + `translateY(0 -> 6px)`.
- Transição entre tabs de `SetorPage` e tabs do Admin:
  - `TabsContent` com fade + slide lateral curto.
  - Preservar altura para evitar jump de layout em troca de aba.

Prioridade: Alta

### 4) Menus, dropdowns e selects (`DropdownMenu`, `Select`)
- Padronizar abertura/fechamento:
  - Open: fade + zoom-in 96->100 + deslocamento da origem.
  - Close: fade-out + zoom-out 100->98.
- Itens:
  - Hover/focus com transição curta (120-150ms).
  - Estado ativo selecionado com transição de background.
- Mobile:
  - Limitar overshoot e manter transição curta para responsividade.

Prioridade: Alta

### 5) Modais e dialogs (`Modal`, `ConfirmDialog`, `EditarPerfilModal`, `GlobalDetailProvider`, modais CRUD)
- Overlay:
  - Fade de opacidade (`120-180ms`), sem blur pesado em dispositivos fracos.
- Panel:
  - Entrada com fade + y/scale leve (`220-280ms`).
  - Saída com fade + scale-down curto (`150-200ms`).
- Conteúdo interno:
  - Seções com stagger leve quando modal abre.
  - Transição entre modo visualização/edição no modal global.
- ConfirmDialog:
  - Ícone de alerta com pop-in suave (sem bounce exagerado).

Prioridade: Alta

### 6) Página Setor (`SetorPage`)
- Etapas (`busca`, `resumo`, `resultado`) de Empréstimo e Devolução:
  - Tratar como stepper animado com `AnimatePresence`/equivalente.
  - Direção da animação baseada no fluxo (avançar/voltar).
- Cards de resultado:
  - Entrada com fade/slide vertical.
  - Badges de status com transição de cor.
- Lista de itens (devolução):
  - Stagger por linha com limite de 6 itens animados por vez (performance).
- Barra de progresso:
  - Interpolar largura com easing padrão.

Prioridade: Alta

### 7) Admin CRUD e tabelas (`DataTable`, tabs admin)
- Filtros (`FilterBar`):
  - Ao alterar filtro, animar estado loading -> dados (cross-fade).
- Tabelas:
  - Skeleton/placeholder ao carregar (evitar flicker de texto).
  - Entrada de linhas: fade-up curto.
  - Remoção de linha: fade-out + collapse de altura.
  - Paginação (Dashboard): transição lateral curta entre páginas.
- Ações de linha (`TableActions`):
  - Hover e press consistentes em todos botões de editar/apagar.
- KPIs (Dashboard):
  - Contadores com number tween curto em atualização de filtro.

Prioridade: Media-Alta

### 8) Feedback global (`toast`, loading, empty states)
- Toast (`ToastProvider`):
  - Entrada pela direita + fade.
  - Saida com fade + leve deslocamento vertical.
  - Stack com layout animation para reordenação suave.
- Spinners:
  - Normalizar tamanho/velocidade e evitar spin em excesso simultâneo.
- Empty states:
  - Entrada fade-up unica por estado.

Prioridade: Media

### 9) Componentes base (primitives)
- `Button`: manter microinterações e padronizar curvas/duração por variante.
- `Input`/`SelectTrigger`: focus ring com transição curta consistente.
- `Card`/`SectionCard`: hover e entrada com mesma assinatura visual.
- `Badge`/`StatusPill`: transição de cor/opacidade em mudança de status.

Prioridade: Media

## Arquivos com maior impacto (foco inicial)
- `frontend/src/globals.css`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/components/Header.tsx`
- `frontend/src/pages/AdminPage.tsx`
- `frontend/src/pages/SetorPage.tsx`
- `frontend/src/components/ui/modal.tsx`
- `frontend/src/components/ui/dropdown-menu.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/ui/tabs.tsx`
- `frontend/src/components/ui/toast.tsx`
- `frontend/src/components/ui/data-table.tsx`
- `frontend/src/components/global-detail/GlobalDetailProvider.tsx`

## Fases de implementação recomendadas

### Fase 0 - Fundação (1 PR)
- Corrigir base de utilitários de animação (`animate-in` etc.) com uma abordagem única:
  - Opção A: adotar plugin/css utilitário equivalente.
  - Opção B: remover classes dependentes e usar keyframes próprios padronizados.
- Criar tokens de motion no `globals.css`.
- Criar utilitários comuns (`motion-enter`, `motion-exit`, `motion-stagger-*`).

### Fase 1 - Shell e autenticação (1 PR)
- Login, logout, transição de rotas, header e sidebar.

### Fase 2 - Overlays e menus (1 PR)
- Modal, confirm dialog, dropdown, select, modal global de detalhes.

### Fase 3 - Fluxos funcionais (1 PR)
- Setor (etapas empréstimo/devolução), tabs, feedbacks de operação.

### Fase 4 - Admin dados (1 PR)
- Tabelas, filtros, paginação, KPIs e toasts.

## Critérios de pronto (motion)
- Todas as superfícies principais possuem transições consistentes e previsíveis.
- `prefers-reduced-motion` respeitado em 100% das animações não essenciais.
- Nenhuma animação bloqueia ação do usuário ou gera atraso perceptível.
- Sem flicker em trocas de rota/tab/modal.
- Performance estável em desktop e mobile (sem jank perceptível).

## Observação final
Este mapeamento já cobre o frontend inteiro do repositório atual. O próximo passo natural é executar a Fase 0 para consolidar a base técnica de animação e evitar retrabalho nas fases seguintes.

