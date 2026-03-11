# Responsividade: Baseline (Blocos 0 e 1)

Data: 2026-03-11

## Escopo do baseline

Páginas críticas avaliadas para execução por blocos:

- `/app` (home)
- `/app/posts`
- `/app/posts/new`
- `/app/calendar`
- `/app/media`
- `/app/settings`

Faixas-alvo:

- 320-389 (`mobile-sm`)
- 390-479 (`mobile-lg`, inclui iPhone 14 Pro Max em retrato)
- 480-1023 (`tablet`)
- 1024-1439 (`desktop-md`)
- 1440+ (`desktop-lg`)

Matriz de validação:

- 375x667
- 430x932
- 768x1024
- 1024x768
- 1366x768
- 1440x900
- 1920x1080

## Checklist de aceite por resolução

- Sem overflow horizontal na viewport.
- Título e ações de página sem sobreposição.
- Topbar sem quebra de ícones/botões.
- Conteúdo principal com respiro lateral consistente.
- Botões e campos clicáveis sem colisão.
- Estados de carregamento/empty/error sem clipping.

## Ajustes aplicados no Bloco 1

Objetivo: criar base responsiva sem alterar regras de negócio e sem regressão intencional em desktop >= 1440.

1. Estrutura base de páginas (`components/page/page.tsx`)
- `Page`: espaçamento vertical adaptado (`space-y-4 sm:space-y-6`).
- `PageHeader`: agora empilha em telas menores e volta para linha em `sm+`.
- `PageHeaderText`: `min-w-0` para evitar estouro.
- `PageTitle`: tipografia responsiva (`text-xl` em mobile, `sm:text-2xl`).
- `PageActions`: permite wrap e largura total em mobile.

2. Shell principal (`components/shell/app-shell-client.tsx`)
- Contêiner principal com `min-w-0`.
- `main` com padding responsivo (`p-3 sm:p-4 md:p-6`).

3. Topbar (`components/shell/topbar.tsx`)
- Header com `min-h-14` e `py-2` para acomodar variação de largura.
- Grupo esquerdo com `min-w-0` e truncamento do nome do workspace.
- Botão "Ver meus workspaces" com limite de largura em telas pequenas para evitar overflow.

## Riscos ainda abertos (próximos blocos)

- Fluxo de criação/edição de post com larguras fixas.
- Calendário com grade de 7 colunas sem estratégia mobile dedicada.
- Popovers/inputs com larguras mínimas rígidas em partes da listagem de posts.

## Bloco 2 (Topbar/Navegação) - status

Aplicado em `components/shell/topbar.tsx`:

- Em mobile, o botão "Ver meus workspaces" vira botão `icon` para reduzir congestionamento horizontal.
- Em `sm+`, mantém botão textual.
- Label "Workspace atual" agora aparece apenas em `sm+` para priorizar espaço em telas muito estreitas.
- Nome do workspace permanece com `truncate`.
- Grupo de ações da direita ficou `shrink-0` para evitar sobreposição com o bloco esquerdo.

## Bloco 2.1 (Sidebar mobile) - status

Aplicado em `components/shell/app-shell-client.tsx`:

- No cabeçalho da Sidebar mobile (sheet), removido o bloco textual:
  `Cadence` + nome do workspace.
- No lugar, exibido o logo do Cadence com suporte a tema claro/escuro, alinhado ao padrão visual desktop.

## Bloco 3 (Posts - início) - status parcial

Aplicado:

- `app/posts/new` com card principal fluido em mobile (`w-full` + `max-w-[732px]`).
- `components/posts/create/step-create-post.tsx` com layout em coluna em mobile/tablet e coluna lateral fixa apenas em `xl`.
- `components/posts/posts-filters-bar.tsx` com busca e botão de filtro fluidos em mobile e popover com largura responsiva (`min(92vw, 420px)`).
- `app/posts/[id]/post-edit-client.tsx` com espaçamento responsivo e ações de mídia (`Enviar imagem`/`Biblioteca`) em coluna no mobile.

## Bloco 4 (Calendário) - status

Aplicado:

- `app/calendar/week-view.tsx`
  - Grid semanal com largura mínima por coluna de dia.
  - Contêiner externo com `overflow-x-auto` para mobile/tablet sem comprimir eventos.
- `app/calendar/month-view.tsx`
  - Visão mensal com `overflow-x-auto` e largura mínima do grid para preservar legibilidade.
- `app/calendar/month-infinite-view.tsx`
  - Mesma estratégia do mensal: rolagem horizontal controlada + largura mínima.
- `app/calendar/CalendarClient.tsx`
  - Header do calendário com melhor quebra em telas estreitas (`PageTitle` com wrap, `ToggleGroup` fluido).

## Bloco 5 (Componentes transversais) - status parcial

Aplicado:

- `components/ui/date-picker.tsx`
  - Trigger com largura fluida (`w-full`) em mobile.
  - Popover com largura limitada à viewport (`min(92vw, 340px)`).
- `components/ui/emoji-picker.tsx`
  - Popover com largura fluida (`min(92vw, 360px)`).
  - Grid de emojis reduz para 7 colunas em mobile e 8 em `sm+`.
- `components/posts/schedule-post-dialog.tsx`
  - Dialog com padding responsivo (`p-4` em mobile, `sm:p-6`).
- `components/posts/media-library-dialog.tsx`
  - Dialog com largura/padding mais adequados em mobile.
  - Grade de miniaturas responsiva (`2 -> 3 -> 4` colunas por breakpoint).

Complemento global aplicado:

- `components/ui/popover.tsx`
  - Conteúdo com `max-w` relativo à viewport e contenção de overflow horizontal.
- `components/ui/select.tsx`
  - Conteúdo com `max-w` relativo à viewport.
  - Viewport interna em modo `popper` com largura mínima limitada à largura da tela.
- `components/ui/dropdown-menu.tsx`
  - `DropdownMenuContent` e `DropdownMenuSubContent` com `max-w` relativo à viewport.
- `components/ui/context-menu.tsx`
  - `ContextMenuContent` e `ContextMenuSubContent` com `max-w` relativo à viewport.

Status do bloco: concluído.

## Home (hardening dedicado)

Aplicado em:

- `app/app/page.tsx`
  - Reorganização do grid para tablet (`md:grid-cols-2`) e desktop largo (`xl:grid-cols-3`).
  - Cards de resumo (`Próximos posts` e `Posts realizados`) passam a ocupar largura total em tablet (`md:col-span-2`).
  - Ajuste de padding/offset superior para reduzir densidade em mobile.
- `app/app/_components/home-greeting.tsx`
  - Escala tipográfica mobile reduzida para evitar excesso de quebra.
- `app/app/_components/quick-access-card.tsx`
  - Altura mínima, ícone, espaçamento e CTA adaptados para mobile.
- `app/app/_components/upcoming-posts-card.tsx`
  - Header/card mais compactos em mobile e CTA com largura total em telas pequenas.
- `app/app/_components/posts-activity-card.tsx`
  - Tipografia dos números e card ajustados para mobile/tablet.
