# Cadence — MVP (Plano de Implementação + Stack + Especificações)

> Objetivo: construir um MVP **enxuto** (nada agressivo) que ajude microempresas (ex: Maribe) a **voltar a postar com constância** no Instagram, reduzindo atrito e dependência de “lembrar de postar”.
>
> Este documento serve como “north star” para desenvolvimento em **pair programming** (ex: Cursor), com escopo, arquitetura, fluxos e contratos iniciais.

---

## 0) Addendum de escopo fechado (21/02/2026)

Este addendum prevalece sobre pontos antigos deste documento quando houver conflito.

### Decisoes de produto fechadas
1. MVP fase 1 sera entregue sem integracao Instagram.
2. MVP fase 1 suporta somente imagem unica por post.
3. Video e carrossel ficam para fase 2 (pos-MVP).
4. Regras de permissao no MVP:
   - `OWNER/ADMIN`: podem aprovar e agendar diretamente.
   - `EDITOR`: cria/edita e envia para aprovacao.
   - `VIEWER`: somente leitura.

### Regra de UX fechada para evitar falsa expectativa
1. Para `EDITOR`, o CTA principal deve ser `Enviar para aprovacao` (nao `Agendar post`).
2. Para `OWNER/ADMIN`, o CTA principal permanece `Agendar post`.
3. Sempre mostrar feedback explicito de resultado:
   - `Aguardando aprovacao` para itens que nao estao realmente agendados.
   - Mensagem de `Post agendado` somente quando status efetivo for `SCHEDULED`.

### Escopo congelado da fase 1 (nao entra)
1. Integracao Instagram (OAuth, tokens, publish real).
2. Publicacao automatica em producao via dispatcher real.
3. Video e carrossel no fluxo de postagem.
4. Refactors estruturais amplos sem impacto direto no fluxo principal.

### Definition of Done da fase 1
1. Fluxo por papel sem ambiguidade de UX:
   - `EDITOR`: envia para aprovacao.
   - `OWNER/ADMIN`: aprova/agendam.
2. Fluxo de posts funcional de ponta a ponta:
   - criar -> revisar -> aprovar -> agendar -> cancelar/reverter.
3. Retry manual para `FAILED` implementado e acessivel na UI.
4. Documentacao alinhada ao comportamento implementado.

## 1) Escopo do MVP (features)

### ✅ Incluído no MVP
1. **Auth + sessão**
   - Login (email + senha)
   - Rotas protegidas (Next middleware)
2. **Workspaces (multi-empresa)**
   - Usuário pode pertencer a 1+ workspaces
   - Seleção de workspace ativo
3. **Usuários e permissões (RBAC mínimo)**
   - Roles: `OWNER | ADMIN | EDITOR | VIEWER`
4. **Biblioteca de mídia**
   - Upload de imagens via **S3 presigned URL**
   - Listagem (grid) por workspace
5. **Posts + workflow**
   - Criar/editar post (imagem + legenda)
   - Workflow: `DRAFT → IN_REVIEW → APPROVED → SCHEDULED → PUBLISHED/FAILED`
   - Regras:
     - não agenda sem aprovação
     - se editar após aprovação, volta para revisão
     - se editar estando `SCHEDULED`, cancela agendamento e volta para revisão
6. **Calendário semanal**
   - Visualização de posts por semana (agendados / publicados / falhos)
7. **Publicação automática**
   - Dispatcher (EventBridge + Lambda) publica na hora via API oficial
   - `FAILED` com erro + **Retry**

### ❌ Fora do MVP (de propósito)
- Comentários e DMs
- Métricas/insights
- IA de legendas
- Multi-rede (TikTok/LinkedIn etc.)
- Editor de imagem interno
- CRM/funil de leads

---

## 2) Stack fechada (frontend)

### Frontend
- **Next.js** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui (React)**
- **TanStack Query** (server-state/cache)
- **React Hook Form + Zod** (forms/validação)
- **TanStack Table** (tabelas)
- **date-fns** (datas)

> Padrão recomendado: **Next como BFF** (Backend For Frontend). O browser chama `/api/*` do Next e o Next chama o backend AWS (API Gateway). Isso evita CORS e protege melhor sessão/token.

---

## 3) Infra AWS (Free Tier-friendly)

- **S3** (mídia e/ou assets estáticos)
- **CloudFront** (CDN, HTTPS) *(opcional se usar Amplify Hosting)*
- **Amplify Hosting** (deploy do Next / previews por branch) *(recomendado para testes)*
- **API Gateway + Lambda** (backend)
- **DynamoDB** (dados do app, multi-tenant)
- **EventBridge** (dispatcher periódico)
- **CloudWatch Logs** (logs)

> Observação: crie **Budget** com alertas (ex: US$ 1, US$ 5) para evitar surpresas.

---

## 4) Arquitetura (visão geral)

### Componentes
- **Frontend (Next)**
  - UI (dashboard)
  - Rotas protegidas
  - Rotas `/api/*` (BFF/proxy)
- **Backend (AWS)**
  - API Gateway -> Lambdas
  - DynamoDB (single-table)
  - S3 presigned upload
- **Scheduler**
  - EventBridge dispara Lambda dispatcher a cada 5 minutos
  - Dispatcher consulta fila “due” e publica no Instagram

---

## 5) Estrutura de rotas do app (Next)

### Públicas
- `/login`

### Protegidas
- `/w` — seletor de workspace (se user tiver mais de 1)
- `/app` — dashboard
- `/app/calendar` — calendário semanal
- `/app/posts` — lista/ações
- `/app/posts/new` — criar post
- `/app/media` — biblioteca de mídia
- `/app/users` — membros/roles
- `/app/settings/integrations/instagram` — conexão da conta (workspace)

---

## 6) Estrutura de pastas (sugestão)

```txt
src/
  app/
    (public)/
      login/page.tsx
    (protected)/
      layout.tsx
      w/page.tsx
      app/
        page.tsx
        calendar/page.tsx
        posts/page.tsx
        posts/new/page.tsx
        media/page.tsx
        users/page.tsx
        settings/integrations/instagram/page.tsx
    api/
      auth/
        login/route.ts
        logout/route.ts
        me/route.ts
      workspaces/route.ts
      posts/route.ts
      posts/[id]/route.ts
      media/
        presign/route.ts
        route.ts
      users/route.ts
  components/
    shell/
      sidebar.tsx
      topbar.tsx
    posts/
    media/
    calendar/
  lib/
    api/
      backend.ts
    auth/
      session.ts
    zod/
    utils.ts
  middleware.ts
```

---

## 7) Auth e sessão (proposta simples)

### JWT + cookies
- `/api/auth/login` (Next) chama backend e recebe `access_token`
- Next grava `access_token` em cookie **HttpOnly**
- `middleware.ts` protege rotas `(protected)` checando cookie
- Workspace ativo pode ser salvo em cookie (ex: `workspace_id`)

---

## 8) DynamoDB — Modelo (Single Table)

### Tabela: `AppTable`
- Chaves: `PK`, `SK`
- Itens por entidade: `WORKSPACE`, `USER`, `MEMBERSHIP`, `MEDIA`, `POST`, `INSTAGRAM_AUTH`

### 8.1 Workspace
- `PK = WORKSPACE#{workspace_id}`
- `SK = META`

Campos: `name`, `timezone`, `status`

### 8.2 User
- `PK = USER#{user_id}`
- `SK = META`

Campos: `email`, `name`, `password_hash`, `is_active`

#### GSI1 (login por email)
- `GSI1PK = EMAIL#{email_lower}`
- `GSI1SK = USER#{user_id}`

### 8.3 Membership (User ↔ Workspace)
Item 1 (listar membros do workspace):
- `PK = WORKSPACE#{workspace_id}`
- `SK = MEMBER#{user_id}`
Campos: `role`, `user_email`, `user_name`

Item espelho (listar workspaces do user):
- `PK = USER#{user_id}`
- `SK = WORKSPACE#{workspace_id}`
Campos: `role`, `workspace_name`

### 8.4 MediaAsset
- `PK = WORKSPACE#{workspace_id}`
- `SK = MEDIA#{media_id}`
Campos: `s3_bucket`, `s3_key`, `type=IMAGE`, `created_by_user_id`

### 8.5 Post (registro principal)
- `PK = WORKSPACE#{workspace_id}`
- `SK = POST#{post_id}`
Campos:
- `caption`, `media_ids[]`
- `status` (`DRAFT|IN_REVIEW|APPROVED|SCHEDULED|PUBLISHED|FAILED`)
- `scheduled_at`, `published_at`
- `created_by_user_id`, `approved_by_user_id`
- `error_message`, `instagram_media_id`

#### GSI2 (calendário por semana)
- `scheduled_bucket = YYYY-Www` (timezone do workspace)
- `GSI2PK = WS#{workspace_id}#WEEK#{scheduled_bucket}`
- `GSI2SK = scheduled_at#{scheduled_at}#POST#{post_id}`

#### GSI3 (fila do dispatcher)
Somente se `status = SCHEDULED`:
- `GSI3PK = DISPATCH#WS#{workspace_id}`
- `GSI3SK = scheduled_at#{scheduled_at}#POST#{post_id}`

### 8.6 InstagramAuth (por workspace)
- `PK = WORKSPACE#{workspace_id}`
- `SK = INSTAGRAM_AUTH`
Campos:
- `ig_user_id`, `page_id` (se necessário)
- `access_token_encrypted`, `token_expires_at`

---

## 9) Endpoints (backend) — contrato inicial

> No frontend (Next), preferir expor `/api/*` e fazer proxy para o backend AWS.

### Auth
- `POST /auth/login`
- `GET /auth/me`

### Workspaces
- `GET /workspaces` (lista workspaces do user)

### Media
- `POST /media/presign` (filename, contentType) -> `upload_url`, `s3_key`
- `POST /media` (s3_key, type) -> cria MediaAsset
- `GET /media` -> lista mídia do workspace

### Posts
- `POST /posts` -> cria `DRAFT`
- `GET /posts` -> lista (filtros: `status`, `week`, `from/to`)
- `GET /posts/{id}`
- `PUT /posts/{id}` (edita legenda/mídia; aplica regras de workflow)
- `POST /posts/{id}/submit` -> `DRAFT → IN_REVIEW`
- `POST /posts/{id}/approve` -> `IN_REVIEW → APPROVED`
- `POST /posts/{id}/schedule` -> `APPROVED → SCHEDULED` (scheduled_at)
- `POST /posts/{id}/cancel` -> `SCHEDULED → APPROVED`
- `POST /posts/{id}/retry` -> `FAILED → SCHEDULED` (scheduled_at = now+2min)

### Integração Instagram (mínimo)
- `GET /integrations/instagram/status`
- `POST /integrations/instagram/connect` (inicia OAuth Meta)
- `GET /integrations/instagram/callback` (finaliza OAuth)

---

## 10) Fluxos esperados (ponta a ponta)

### 10.1 Login + seleção de workspace
1. `POST /auth/login` -> token
2. `GET /workspaces` -> lista
3. usuário escolhe workspace -> app salva `workspace_id`

### 10.2 Upload de mídia
1. `POST /media/presign`
2. upload direto pro S3 via `upload_url`
3. `POST /media` registra asset
4. `GET /media` lista no grid

### 10.3 Criar post (rascunho)
1. `POST /posts` (caption + media_ids) -> `DRAFT`
2. `POST /posts/{id}/submit` -> `IN_REVIEW`
3. `POST /posts/{id}/approve` -> `APPROVED`
4. `POST /posts/{id}/schedule` -> `SCHEDULED`

### 10.4 Dispatcher (publicação automática)
1. EventBridge dispara a cada 5 min
2. Dispatcher consulta GSI3: `scheduled_at <= now`
3. Publica via API Instagram (create container -> publish)
4. Sucesso -> `PUBLISHED`, remove GSI3
5. Falha -> `FAILED`, `error_message`, remove GSI3
6. Usuário pode `retry`

---

## 11) Regras de permissão (RBAC mínimo)

- `OWNER/ADMIN`: aprovar, agendar, cancelar, integrar Instagram, gerenciar membros
- `EDITOR`: criar/editar post, enviar para revisão, upload mídia
- `VIEWER`: somente leitura

---

## 12) Integração Instagram (notas técnicas)

- Deve usar **API oficial (Meta Graph API)**
- Tokens por **workspace** (empresa), não por usuário
- Publicação costuma ser 2 etapas:
  1. criar container de mídia
  2. publicar container
- Token deve ser armazenado **criptografado** (KMS recomendado)

---

## 13) UX (mínimo de telas)

- Login
- Seletor de workspace (`/w`)
- Dashboard (cards: próximos posts, pendentes de aprovação)
- Posts (lista + filtros + ações)
- Novo post (form)
- Calendário semanal (listagem agrupada por dia)
- Media (upload + grid)
- Users (membros + role)
- Integração Instagram (status + conectar)

---

## 14) Milestones (ordem recomendada)

1. Setup do Next + Tailwind + shadcn + layout shell (sidebar/topbar)
2. Auth (login, cookie HttpOnly, middleware)
3. Workspaces (listagem + seleção)
4. Media (presign + upload + list)
5. Posts (CRUD + workflow + list)
6. Calendário (week)
7. Dispatcher (EventBridge + Lambda)
8. Integração Instagram (OAuth + publicação)

---

## 15) Convenções (repo)

### Nome do projeto
- Repo/pasta: **cadence**

### Branches (sugestão)
- `main` (prod)
- `dev` (staging)

### Commits (sugestão)
- `feat: ...`
- `fix: ...`
- `chore: ...`

---

## 16) Checklist rápido (para iniciar repo)

1. `create-next-app` + deps
2. `shadcn init`
3. Criar layout do app
4. Criar `/login` e middleware
5. Criar rotas `/api/auth/login`, `/api/auth/me` (BFF)
6. Preparar `.env.local`:
   - `BACKEND_API_BASE_URL=...` (API Gateway)
   - `APP_ENV=local`

---

## 17) Perguntas abertas (deixar anotado)
- Publicação no MVP: **somente imagem single** ou já preparar para carrossel (`media_ids[]`)?  
  ✅ Recomendação: armazenar como lista desde o começo, mas liberar no UI só 1 imagem.
- Rate limits e retries: quantas tentativas automáticas antes de marcar `FAILED`?  
  ✅ Recomendação: 1 tentativa + retry manual no MVP.
- Frequência do dispatcher: 5 min está ok para microempresas.  
  ✅ Recomendação: 5 min.

---

## 18) Próximo passo sugerido (para pair programming)
- Implementar base do Next (shell + login + middleware + BFF)
- Criar os contratos TypeScript (DTOs) e mocks do backend
- Montar telas: Posts + Media + Calendar com dados mockados, depois plugar API real
