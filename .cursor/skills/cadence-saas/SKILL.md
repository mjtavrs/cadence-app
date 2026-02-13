---
name: cadence-saas
description: Orienta o agente a trabalhar no codebase do Cadence SaaS (monorepo Next.js + API + infra). Use ao editar, debugar ou adicionar features em apps/web, apps/api ou infra, ou quando o usuário mencionar o projeto Cadence, biblioteca de mídia, posts, calendário ou workspace.
---

# Cadence SaaS – Codebase

## Escopo do repositório

- **apps/web**: frontend Next.js (App Router), React 19, TypeScript, Tailwind 4, Radix UI, TanStack Query.
- **apps/api**: backend em Node (handlers estilo Lambda), DynamoDB, S3, Cognito.
- **infra**: CDK (AWS). Comandos: `npm run infra:cdk`.

Path alias no web: `@/*` → raiz de `apps/web` (ex.: `@/components/ui/button`).

## Convenções gerais

- **Idioma**: strings de UI e mensagens ao usuário em **pt-BR**. Código (nomes, tipos, comentários técnicos) em inglês. Commits em inglês, formato Conventional Commits: `feat(scope): message` / `fix(scope): message` / `chore(scope): message`.
- **Componentes UI**: `apps/web/components/ui/` — padrão Shadcn (Radix). Novos componentes seguem o mesmo padrão (composição, `cn()`, data-slots quando existir).
- **Rotas**: páginas em `app/app/` (área logada), API routes em `app/api/`. Autenticação via cookies `cadence_access` e `cadence_workspace`; chamadas à API usam `env.apiBaseUrl` e repassam o token.

## Onde as coisas ficam

| O quê | Onde |
|-------|------|
| Páginas (app logado) | `apps/web/app/app/**/page.tsx` |
| API routes (Next) | `apps/web/app/api/**/route.ts` |
| Componentes reutilizáveis | `apps/web/components/` |
| Hooks | `apps/web/hooks/` |
| Utilitários e env | `apps/web/lib/` |
| Handlers da API externa | `apps/api/src/handlers/` |
| Modelos e regras (posts, mídia) | `apps/api/src/posts/`, `apps/api/src/media/` |

## Fluxo de dados (web → API)

- **Auth**: cookies definidos em `/api/auth/login` e usados em `app/api/*` e em chamadas fetch do cliente para `/api/*`.
- **Mídia**: listagem/upload/delete via `/api/media`, `/api/media/presign`, `/api/media/[id]`. Hook: `use-media-library.ts`.
- **Posts**: CRUD e ações (submit, schedule, approve, etc.) via `/api/posts` e `/api/posts/[id]/*`. Estados: rascunho, submetido, agendado, aprovado, etc.
- **Workspace**: workspace ativo em cookie; troca em `/api/workspaces/select`.

## Padrões de código

- **Client components**: `"use client"` no topo quando usar estado, hooks ou event handlers.
- **Server components**: padrão; usar para fetch inicial quando fizer sentido (ex.: carregar lista de mídia na página da biblioteca).
- **Estilo**: Tailwind; preferir classes utilitárias e `cn()` para condicionais. Cores e temas alinhados ao design system (variáveis CSS / tema claro/escuro).
- **Formulários**: React Hook Form + Zod quando houver validação; resolvers em `@hookform/resolvers`.
- **Erros e loading**: tratar erros com mensagens em pt-BR; toasts com `sonner`; estados de carregamento explícitos (Spinner/skeleton) onde fizer sentido.

## Regras de produto (resumo)

- **Mídia**: até 30 imagens por workspace; 10MB por arquivo; formatos JPEG, PNG, WEBP, HEIC/HEIF. Upload via presign S3.
- **Posts**: fluxo com estados e ações (submit, schedule, approve, cancel, revert). Calendário em `app/app/calendar/`.
- Não presumir regras de negócio não documentadas; em dúvida, perguntar ou checar handlers e tipos em `apps/api/src/`.

## Build e execução

- Desenvolvimento: `npm run dev` (sobe o web).
- Build: `npm run build` (build do web).
- Lint: `npm run lint` (web).
- Infra: `npm run infra:cdk` com os argumentos do CDK.

Ao alterar código, manter comportamento existente quando não for o foco da mudança; rodar build após mudanças relevantes para validar.
