import type { APIGatewayProxyHandler } from "aws-lambda";
import { ChangePasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import { getBearerToken } from "../../auth/access-token";
import { getCognitoClient } from "../../auth/cognito";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let body: ChangePasswordBody = {};
  try {
    body = event.body ? (JSON.parse(event.body) as ChangePasswordBody) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;

  if (!currentPassword || !newPassword || typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return badRequest("Informe a senha atual e a nova senha.");
  }

  try {
    const cognito = getCognitoClient();
    await cognito.send(
      new ChangePasswordCommand({
        AccessToken: token,
        PreviousPassword: currentPassword,
        ProposedPassword: newPassword,
      }),
    );
    return json(200, { ok: true });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") {
      return unauthorized("Senha atual incorreta.");
    }
    if (name === "InvalidPasswordException") {
      return badRequest("A nova senha não atende aos requisitos.");
    }
    if (name === "LimitExceededException") {
      return badRequest("Muitas tentativas. Tente novamente mais tarde.");
    }
    return serverError("Não foi possível alterar a senha agora.");
  }
};
