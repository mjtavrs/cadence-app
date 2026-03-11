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
