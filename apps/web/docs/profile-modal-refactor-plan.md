# Plano de implementação: Refatoração visual do Dialog de dados do usuário (Profile Modal)

Documento para alinhamento e aprovação antes da codificação.

---

## O que foi entendido

Refatorar o **ProfileModal** (`apps/web/components/shell/profile-modal.tsx`) com as alterações abaixo. O comportamento de negócio (carregar /api/auth/me, salvar perfil via PATCH /api/users/me, troca de senha via POST /api/auth/change-password, validação Zod) permanece; mudam apenas estrutura visual, textos e alguns controles de UI.

---

## 1. Cabeçalho do Dialog

| Atual | Novo |
|-------|------|
| Título "Seus dados" | **Manter** "Seus dados" |
| Separator logo abaixo do título | Incluir **sub-título** "Perfil" entre o título e o separator; o **separator** passa a ficar **abaixo** do sub-título |

Ordem final: **Seus dados** → **Perfil** → **Separator**.

---

## 2. Seção Perfil: avatar + nome/email lado a lado

- **Layout:** uma única seção com dois blocos no mesmo nível, alinhados ao **topo** (eixo vertical):
  - **Esquerda:** avatar + botão "Alterar imagem"
  - **Direita:** label + input Nome (em cima) e label + input Email (embaixo), na mesma disposição de hoje

- **Avatar:**
  - Diâmetro **um pouco menor** que o atual (hoje `size-28` / `sm:size-32`); reduzir levemente (ex.: `size-24` / `sm:size-28` ou equivalente).
  - **Clique no avatar** abre o seletor de arquivo de imagem (mesmo comportamento do botão "Alterar imagem").
  - **Tipos aceitos no input file:** mesmos da biblioteca de mídia: **PNG, JPEG, WEBP, HEIC** (ex.: `accept="image/png,image/jpeg,image/webp,image/heic,image/heif"`).

- **Botão "Alterar imagem":**
  - Posicionado **abaixo do avatar**, centralizado no eixo horizontal em relação ao avatar.
  - Estilo **link** (não botão sólido), cor **sky-500** (Tailwind: `text-sky-500` ou variante hover adequada).
  - Ao clicar: mesma ação do clique no avatar (abre o `<input type="file">`).

- **Nome:** label e input permanecem iguais (sem mudança de copy ou comportamento).

- **Email:**
  - **Remover** o texto auxiliar "O email não pode ser alterado aqui.".
  - **Incluir ícone** **IoIosLock** no **lado direito dentro do input** (input continua disabled, apenas visual muda).
  - **Opcional mas desejável:** envolver o input (ou o ícone) com **Tooltip** explicando que o email não pode ser alterado ali (ex.: "O email não pode ser alterado aqui." ou texto similar).

Implementação do input de email com ícone: usar um wrapper (ex.: `div` com `relative`), input com `padding-right` suficiente para o ícone, e ícone posicionado à direita (absolute). Se usar Tooltip, envolver o ícone com `Tooltip` + `TooltipTrigger` + `TooltipContent`.

---

## 3. Seção Senha dentro de Collapsible

- **Título da seção:** trocar de "Senha" para **"Segurança"**.
  - Essa seção inteira (título + os três campos de senha) fica dentro de um **Collapsible** (`@/components/ui/collapsible`).
  - **CollapsibleTrigger:** exibir o título "Segurança" (e o ícone de abrir/fechar do Radix, se houver).
  - **CollapsibleContent:** quando aberto, exibe os três blocos: Senha atual, Nova senha, Confirmar nova senha.

- **Inputs de senha (atual, nova, confirmação):**
  - Em cada um, adicionar um **botão customizado** à **direita dentro do input** para **mostrar/ocultar** a senha (toggle de tipo `password` ↔ `text`).
  - **Ícones:** **LuEye** (mostrar senha) e **LuEyeClosed** (ocultar senha) — usar `Eye` e `EyeOff` do `lucide-react` (convenção Lu*).
  - **Remover** o comportamento padrão de "mostrar senha" do HTML se houver (não depender do controle nativo do browser); o único controle será esse botão customizado.
  - Implementação: wrapper `relative` no input, input com `padding-right` para o botão, botão com ícone que alterna entre `Eye` e `EyeOff` e altera o `type` do input entre `password` e `text`.

- **Requisitos mínimos da senha (abaixo do campo "Nova senha"):**
  - Incluir uma **indicação visual** dos requisitos que já existem no schema Zod:
    - Mínimo 8 caracteres
    - Pelo menos 1 letra minúscula
    - Pelo menos 1 letra maiúscula
    - Pelo menos 1 número
  - Formato sugerido: lista de itens (texto ou ícones de check/círculo) exibida **abaixo** do input "Nova senha", podendo ser estática (sempre visível quando o Collapsible está aberto) ou reativa (marcar como atendido conforme o usuário digita). O plano assume que a indicação seja **visível** quando a seção Segurança está aberta; se desejado, pode ser reativa (checkmarks verdes ao cumprir cada item).

---

## 4. O que não muda

- Lógica de abertura/fechamento do Dialog e props `open` / `onOpenChange`.
- Carregamento de dados via `/api/auth/me` ao abrir.
- Schema Zod e validação (incluindo regras de senha).
- Envio de perfil (nome) via PATCH `/api/users/me` e de troca de senha via POST `/api/auth/change-password`.
- Botões do footer (Cancelar e Salvar) e estado de loading/submit.
- Upload de avatar: continua apenas preview local (sem envio ao servidor) até que essa feature seja implementada; o botão "Alterar imagem" e o clique no avatar apenas atualizam o estado local e o preview, como hoje.

---

## 5. Ordem sugerida de implementação

1. **Cabeçalho:** adicionar sub-título "Perfil" e mover o Separator para baixo dele.
2. **Layout Perfil:** reorganizar em duas colunas (avatar + "Alterar imagem" à esquerda; nome e email à direita), reduzir tamanho do avatar, restringir `accept` do input file a PNG/JPEG/WEBP/HEIC.
3. **Botão "Alterar imagem":** adicionar abaixo do avatar (estilo link, sky-500), centralizado; mesmo handler do clique no avatar.
4. **Input email:** remover texto auxiliar, adicionar ícone IoIosLock à direita dentro do input; opcional: Tooltip no ícone ou no input.
5. **Collapsible "Segurança":** envolver a seção de senha com Collapsible (título "Segurança"), CollapsibleTrigger e CollapsibleContent.
6. **Botões mostrar/ocultar senha:** em cada um dos três inputs de senha, botão à direita com Eye/EyeOff (lucide-react), alternando type do input entre password e text.
7. **Requisitos da senha:** bloco visual abaixo do input "Nova senha" listando os quatro requisitos (8 caracteres, minúscula, maiúscula, número); decidir se estático ou com indicadores reativos (check ao cumprir).

---

## 6. Arquivos impactados

| Arquivo | Alterações |
|---------|------------|
| `apps/web/components/shell/profile-modal.tsx` | Todas as mudanças de layout, ícones, Collapsible, botões de senha e indicação de requisitos. |
| `apps/web/components/ui/input.tsx` | Sem alteração obrigatória; wrappers com ícone/botão podem ser feitos no próprio profile-modal (div + Input + ícone/botão). |

Nenhuma alteração em API routes ou hooks de auth.

---

## 7. Dúvidas / pontos para confirmar

1. **Collapsible "Segurança":** estado inicial aberto ou fechado na primeira vez que o usuário abre o modal? (Sugestão: fechado por padrão, para destacar que é uma seção separada.)
2. **Requisitos da senha:** prefere lista **estática** (sempre os 4 itens em texto) ou **reativa** (ícones de check que preenchem conforme o usuário atende cada requisito)?
3. **Ícone IoIosLock:** o projeto tem `react-icons`; usar `IoIosLock` de `react-icons/io` (Ionicons 4) ou equivalente em `react-icons/io5` (ex.: `IoLockClosed`)? Confirmar nome exato do ícone no pacote que você quer usar.

---

Se algo estiver diferente do que você imaginou, ajuste e aprove para seguirmos com a codificação.
