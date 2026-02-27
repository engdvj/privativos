# Mapeamento Completo de Animacoes (Frontend)

## Objetivo
Definir um plano completo de motion para todo o site (login, logout, sidebar, navbar, menus, modais, tabelas e feedbacks), com padrao unico, performance e acessibilidade.

## Escopo coberto
- Rotas: `frontend/src/App.tsx` (`/`, `/setor`, `/admin`)
- Paginas: `LoginPage`, `SetorPage`, `AdminPage`
- Shell: `Header`, `Footer`, `ProtectedRoute`
- Overlays: `Modal`, `ConfirmDialog`, `DropdownMenu`, `Select`, modais de `GlobalDetailProvider`
- CRUD/Admin: todas as tabs em `frontend/src/pages/admin/tabs/*`
- Feedback: `ToastProvider`, estados de loading, empty state

## Diagnostico atual (gaps)
- Ja existem microanimacoes pontuais (`animate-fade-up`, `transition-*`, `hover:*`, `animate-spin`), mas sem padrao global.
- As duracoes/easing variam por componente e por tela, sem tokens unificados de motion.
- Existem varias classes utilitarias do tipo `animate-in`, `fade-in-50`, `zoom-in-95`, `slide-in-from-*` em arquivos como `SetorPage`, `DropdownMenu` e `Select`.
- Nao foi encontrada configuracao/plugin para essas utilities no frontend (`frontend/package.json` e `frontend/src/globals.css`), entao parte dessas animacoes pode estar sem efeito.

## Sistema de motion proposto (padrao)
Criar tokens globais no `frontend/src/globals.css`:

- Duracao:
  - `--motion-duration-fast: 120ms`
  - `--motion-duration-base: 180ms`
  - `--motion-duration-slow: 280ms`
  - `--motion-duration-xl: 420ms`
- Curvas:
  - `--motion-ease-standard: cubic-bezier(0.2, 0, 0, 1)`
  - `--motion-ease-emphasized: cubic-bezier(0.2, 0.8, 0.2, 1)`
  - `--motion-ease-exit: cubic-bezier(0.4, 0, 1, 1)`
- Distancias:
  - `--motion-distance-sm: 6px`
  - `--motion-distance-md: 12px`
  - `--motion-distance-lg: 20px`

Regras:
- Entradas: fade + translateY pequeno.
- Saidas: fade + scale leve (sem deslocamento grande).
- Hover/focus: maximo 120-180ms.
- Nada de animar propriedades caras (preferir `opacity` e `transform`).
- `prefers-reduced-motion`: reduzir para fade curto ou desabilitar transicoes nao essenciais.

## Mapeamento por superficie (completo)

### 1) Autenticacao (`LoginPage`, `ProtectedRoute`, logout em `Header`)
- Entrada da pagina de login:
  - Hero/background blobs: fade progressivo (sem loop agressivo).
  - Card de login: slide-up + fade (`280ms`).
  - Campos/botao: stagger curto (`40ms` entre elementos).
- Submit login:
  - Botao faz transicao para loading sem salto de layout.
  - Em sucesso: transicao de pagina com fade/slide horizontal curto.
  - Em erro: shake sutil no card (apenas se `prefers-reduced-motion` permitir).
- Validacao silenciosa (`ProtectedRoute`):
  - Trocar tela vazia por skeleton fade-in.
- Logout (`Header`):
  - Ao clicar em sair: estado de saida global (overlay leve + fade da view) antes de navegar para `/`.

Prioridade: Alta

### 2) Shell global (`Header`, `AdminPage`, `Footer`)
- Header:
  - Entrada inicial: slide-down + fade (`180ms`).
  - Busca global: dropdown com fade/scale e highlight animado por item.
  - Avatar/menu usuario: trigger com press animation, menu com spring leve.
  - Toggle tema: cross-fade icone Sol/Lua + rotacao curta.
- Sidebar (`AdminPage`):
  - Colapsar/expandir largura com transicao suave (`240ms`).
  - Itens: indicador ativo com motion de posicao (layout transition).
  - Labels no modo expandido: fade/clip em vez de aparecer seco.
  - Resize drag: manter sem animacao durante drag e animar apenas no release.
- Footer:
  - Botao suporte: hover com elevacao pequena.
  - Modal de suporte: padrao unico de overlay + panel.

Prioridade: Alta

### 3) Navegacao entre telas/areas
- Transicao entre rotas (`/`, `/setor`, `/admin`):
  - Container com page transition unica.
  - Entrada: `opacity 0 -> 1` + `translateY(8px -> 0)`.
  - Saida: `opacity 1 -> 0` + `translateY(0 -> 6px)`.
- Transicao entre tabs de `SetorPage` e tabs do Admin:
  - `TabsContent` com fade + slide lateral curto.
  - Preservar altura para evitar jump de layout em troca de aba.

Prioridade: Alta

### 4) Menus, dropdowns e selects (`DropdownMenu`, `Select`)
- Padronizar abertura/fechamento:
  - Open: fade + zoom-in 96->100 + deslocamento da origem.
  - Close: fade-out + zoom-out 100->98.
- Itens:
  - Hover/focus com transicao curta (120-150ms).
  - Estado ativo selecionado com transicao de background.
- Mobile:
  - Limitar overshoot e manter transicao curta para responsividade.

Prioridade: Alta

### 5) Modais e dialogs (`Modal`, `ConfirmDialog`, `EditarPerfilModal`, `GlobalDetailProvider`, modais CRUD)
- Overlay:
  - Fade de opacidade (`120-180ms`), sem blur pesado em dispositivos fracos.
- Panel:
  - Entrada com fade + y/scale leve (`220-280ms`).
  - Saida com fade + scale-down curto (`150-200ms`).
- Conteudo interno:
  - Secoes com stagger leve quando modal abre.
  - Transicao entre modo visualizacao/edicao no modal global.
- ConfirmDialog:
  - Icone de alerta com pop-in suave (sem bounce exagerado).

Prioridade: Alta

### 6) Pagina Setor (`SetorPage`)
- Etapas (`busca`, `resumo`, `resultado`) de Emprestimo e Devolucao:
  - Tratar como stepper animado com `AnimatePresence`/equivalente.
  - Direcao da animacao baseada no fluxo (avancar/voltar).
- Cards de resultado:
  - Entrada com fade/slide vertical.
  - Badges de status com transicao de cor.
- Lista de itens (devolucao):
  - Stagger por linha com limite de 6 itens animados por vez (performance).
- Barra de progresso:
  - Interpolar largura com easing padrao.

Prioridade: Alta

### 7) Admin CRUD e tabelas (`DataTable`, tabs admin)
- Filtros (`FilterBar`):
  - Ao alterar filtro, animar estado loading -> dados (cross-fade).
- Tabelas:
  - Skeleton/placeholder ao carregar (evitar flicker de texto).
  - Entrada de linhas: fade-up curto.
  - Remocao de linha: fade-out + collapse de altura.
  - Paginacao (Dashboard): transicao lateral curta entre paginas.
- Acoes de linha (`TableActions`):
  - Hover e press consistentes em todos botoes de editar/apagar.
- KPIs (Dashboard):
  - Contadores com number tween curto em atualizacao de filtro.

Prioridade: Media-Alta

### 8) Feedback global (`toast`, loading, empty states)
- Toast (`ToastProvider`):
  - Entrada pela direita + fade.
  - Saida com fade + leve deslocamento vertical.
  - Stack com layout animation para reordenacao suave.
- Spinners:
  - Normalizar tamanho/velocidade e evitar spin em excesso simultaneo.
- Empty states:
  - Entrada fade-up unica por estado.

Prioridade: Media

### 9) Componentes base (primitives)
- `Button`: manter microinteracoes e padronizar curvas/duracao por variante.
- `Input`/`SelectTrigger`: focus ring com transicao curta consistente.
- `Card`/`SectionCard`: hover e entrada com mesma assinatura visual.
- `Badge`/`StatusPill`: transicao de cor/opacidade em mudanca de status.

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

## Fases de implementacao recomendadas

### Fase 0 - Fundacao (1 PR)
- Corrigir base de utilitarios de animacao (`animate-in` etc.) com uma abordagem unica:
  - Opcao A: adotar plugin/css utilitario equivalente.
  - Opcao B: remover classes dependentes e usar keyframes proprios padronizados.
- Criar tokens de motion no `globals.css`.
- Criar utilitarios comuns (`motion-enter`, `motion-exit`, `motion-stagger-*`).

### Fase 1 - Shell e autenticacao (1 PR)
- Login, logout, transicao de rotas, header e sidebar.

### Fase 2 - Overlays e menus (1 PR)
- Modal, confirm dialog, dropdown, select, modal global de detalhes.

### Fase 3 - Fluxos funcionais (1 PR)
- Setor (etapas emprestimo/devolucao), tabs, feedbacks de operacao.

### Fase 4 - Admin dados (1 PR)
- Tabelas, filtros, paginacao, KPIs e toasts.

## Criterios de pronto (motion)
- Todas as superficies principais possuem transicoes consistentes e previsiveis.
- `prefers-reduced-motion` respeitado em 100% das animacoes nao essenciais.
- Nenhuma animacao bloqueia acao do usuario ou gera atraso perceptivel.
- Sem flicker em trocas de rota/tab/modal.
- Performance estavel em desktop e mobile (sem jank perceptivel).

## Observacao final
Este mapeamento ja cobre o frontend inteiro do repositorio atual. O proximo passo natural e executar a Fase 0 para consolidar a base tecnica de animacao e evitar retrabalho nas fases seguintes.

