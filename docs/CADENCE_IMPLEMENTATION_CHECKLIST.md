# Cadence — Checklist de Implementacao (MVP)

Este documento transforma o `CADENCE_MVP.md` em um checklist executavel (ordem sugerida) para implementar o MVP.

## Addendum de escopo fechado (21/02/2026)

Este addendum prevalece sobre itens antigos deste documento quando houver conflito.

### Escopo da fase 1 (agora)
1. Sem integracao Instagram.
2. Sem video e sem carrossel.
3. Somente imagem unica por post.
4. Prioridade: fluxo principal de posts com UX clara por papel.

### Regras de permissao e UX (fase 1)
1. `OWNER/ADMIN`: aprovar e agendar diretamente.
2. `EDITOR`: enviar para aprovacao (nao agendar direto).
3. `VIEWER`: somente leitura.
4. CTA por papel:
   - `EDITOR`: `Enviar para aprovacao`.
   - `OWNER/ADMIN`: `Agendar post`.
5. Nunca comunicar "agendado" para status que ainda depende de aprovacao.

### Escopo congelado (nao entra na fase 1)
1. Integracao Instagram (status/connect/callback e publish real).
2. Publicacao automatica real via dispatcher em producao.
3. Video unico e carrossel misto.
4. Melhorias arquiteturais amplas fora do fluxo principal.

### Definition of Done da fase 1
1. Fluxo por papel sem ambiguidade:
   - `EDITOR`: envia para aprovacao.
   - `OWNER/ADMIN`: aprova/agendam.
2. Fluxo de posts funcional:
   - criar -> revisar -> aprovar -> agendar -> cancelar/reverter.
3. `POST /posts/{id}/retry` implementado (backend + BFF + UI).
4. Mensagens e badges coerentes com estado real (`Aguardando aprovacao` vs `Agendado`).
5. Documentacao e checklist atualizados.

## Decisoes Fechadas

- Armazenar `scheduled_at` em UTC e exibir/editar no fuso do workspace (`workspace.timezone`).
- `caption`: validar e limitar tamanho (ex.: 2200 chars).
- `media_ids` (ou `media[]`): lista desde o inicio.
- Sem `status_history` no MVP; manter timestamps principais.
- Auth com Cognito via pagina de login (form).
- Sessao com refresh token.
- Multi-tenant via `Membership { user_id, workspace_id, role }`.
- Selecao de workspace enviada ao backend via header `x-workspace-id`.
- Publicacao real via Instagram Graph API no MVP.
- Suporte no MVP: imagem unica, video unico e carrossel misto.
- Conexao Instagram via OAuth (Meta).
- Midia servida por `S3 + CloudFront` via URL publica (key aleatoria).
- Dispatcher com idempotencia/lock no MVP para evitar posts duplos.

## Checklist (Ordem Sugerida)

1. Base do repo (Next App Router)
1. Criar estrutura de rotas publicas e protegidas conforme `CADENCE_MVP.md`.
1. Criar shell do app (sidebar/topbar) e navegacao.
1. Implementar `middleware.ts` protegendo o grupo `(protected)`.

1. Auth (Cognito via form) + sessao com refresh
1. Criar Cognito User Pool (email/senha) e App Client com `USER_PASSWORD_AUTH` e refresh habilitado.
1. Implementar BFF no Next:
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/refresh/route.ts`
- `src/app/api/auth/me/route.ts`
1. Definir cookies HttpOnly (refresh + marcadores de sessao) e estrategia de validacao no middleware.

1. Workspaces (selecao) + RBAC (Membership)
1. Implementar fluxo `/w` para listar workspaces e selecionar ativo.
1. Persistir `workspace_id` (cookie) e injetar `x-workspace-id` nas chamadas do BFF para o backend.
1. Backend valida membership/role em toda request (o header so seleciona, nao autoriza).

1. Modelo DynamoDB (Single Table) + indices
1. Fechar schema minimo:
- `WORKSPACE` (inclui `timezone` IANA, ex.: `America/Sao_Paulo`)
- `USER`
- `MEMBERSHIP` (role)
- `MEDIA`
- `POST`
- `INSTAGRAM_AUTH`
1. Criar GSIs para:
- listar posts por workspace e filtros (status/intervalo)
- fila do dispatcher por `scheduled_at_utc`

1. Biblioteca de midia (S3 presign + CloudFront URL)
1. `POST /media/presign` gera presigned PUT e `s3_key`.
1. Upload direto do browser para S3.
1. `POST /media` registra asset com `cloudfront_url`.
1. `GET /media` lista assets por workspace.
1. UI em `/app/media` (upload + grid).

1. Posts + workflow
1. Endpoints:
- `POST /posts` cria `DRAFT`
- `GET /posts` lista com filtros (status e janela de datas)
- `GET /posts/{id}`
- `PUT /posts/{id}` aplica regras de workflow
- `POST /posts/{id}/submit`
- `POST /posts/{id}/approve`
- `POST /posts/{id}/schedule`
- `POST /posts/{id}/cancel`
- `POST /posts/{id}/retry`
1. Regras (MVP):
- nao agenda sem `APPROVED`
- editar apos aprovado volta para revisao
- editar estando `SCHEDULED` cancela agendamento e volta para revisao
1. Timestamps principais:
- `created_at`, `updated_at`, `submitted_at`, `approved_at`, `scheduled_at_utc`, `published_at`, `failed_at`

1. Calendario semanal
1. Implementar consulta por janela (from/to) coerente com `workspace.timezone`.
1. UI em `/app/calendar` agrupando por dia no fuso do workspace.

1. Integracao Instagram (OAuth Meta) + armazenamento de token
1. Endpoints:
- `GET /integrations/instagram/status`
- `POST /integrations/instagram/connect`
- `GET /integrations/instagram/callback`
1. Persistir `INSTAGRAM_AUTH` por workspace com token criptografado e `token_expires_at`.
1. UI em `/app/settings/integrations/instagram`.

1. Dispatcher (EventBridge + Lambda) com idempotencia
1. EventBridge aciona a cada 5 min.
1. Dispatcher busca posts due via GSI (`scheduled_at_utc <= now`).
1. Claim atomico (lock/lease) no DynamoDB antes de publicar e marcar `PUBLISHING`.
1. Publicacao via Graph API:
- imagem unica
- video unico (inclui polling/espera do container)
- carrossel misto (containers filhos + container pai + publish)
1. Sucesso marca `PUBLISHED` e limpa fila.
1. Falha marca `FAILED` com `error_message`.
1. Politica MVP: 1 tentativa automatica + retry manual.

1. Observabilidade e seguranca minima
1. Logs com `workspace_id`, `post_id` e correlacao.
1. Budget/alertas na AWS.
1. Garantir que URLs de midia nao exponham dados sensiveis e usem keys aleatorias.
