# Contrato: Troca de senha (change-password)

Endpoint para usuário autenticado alterar a própria senha, informando a senha atual e a nova senha. Usa o Access Token (Bearer) para identificar o usuário e o Cognito `ChangePassword` para validar a senha atual e aplicar a nova.

---

## Request

- **Método:** `POST`
- **Path:** `auth/change-password`
- **Headers obrigatórios:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <accessToken>`

### Body (JSON)

| Campo            | Tipo   | Obrigatório | Descrição                          |
|------------------|--------|-------------|------------------------------------|
| `currentPassword`| string | sim         | Senha atual do usuário.            |
| `newPassword`    | string | sim         | Nova senha desejada.               |

Não incluir confirmação de senha no contrato da API: a validação "nova senha = confirmação" fica no frontend. A API só exige `currentPassword` e `newPassword`.

---

## Response

### Sucesso

- **Status:** `200`
- **Body:** `{ "ok": true }`

### Erros

| Status | Situação | Body (exemplo) |
|--------|----------|----------------|
| `400` | Body inválido (não JSON ou campos faltando) | `{ "message": "Informe a senha atual e a nova senha." }` |
| `400` | Nova senha não atende à política do User Pool | `{ "message": "A nova senha não atende aos requisitos." }` |
| `401` | Token ausente ou inválido | `{ "message": "Token ausente." }` ou `{ "message": "Sessão expirada. Faça login novamente." }` |
| `401` | Senha atual incorreta (Cognito `NotAuthorizedException`) | `{ "message": "Senha atual incorreta." }` |
| `500` | Erro interno / Cognito indisponível | `{ "message": "Não foi possível alterar a senha agora." }` |

---

## Regras de negócio

1. **Autenticação:** o usuário é identificado pelo `AccessToken` no header. Não se envia `username` no body.
2. **Política de senha (Cognito):** igual à do User Pool do Cadence:
   - Mínimo 8 caracteres
   - Pelo menos 1 dígito
   - Pelo menos 1 letra minúscula
   - Pelo menos 1 letra maiúscula
   - Símbolos não obrigatórios
3. **Cognito:** usar `ChangePasswordCommand` com `PreviousPassword`, `ProposedPassword` e `AccessToken`. Em caso de senha atual errada, o Cognito retorna `NotAuthorizedException`.

---

## Exemplo de request (curl)

```bash
curl -X POST "https://<api>/auth/change-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"currentPassword":"SenhaAtual123","newPassword":"NovaSenha456"}'
```

---

## Frontend (responsabilidade)

- Formulário com: senha atual, nova senha, confirmar nova senha.
- Validação local: nova senha = confirmar; nova senha atende requisitos (8+ chars, dígito, maiúscula, minúscula).
- Envio apenas de `currentPassword` e `newPassword` para a API.
