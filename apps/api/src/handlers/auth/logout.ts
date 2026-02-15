import type { APIGatewayProxyHandler } from "aws-lambda";
import { GlobalSignOutCommand } from "@aws-sdk/client-cognito-identity-provider";
import { getBearerToken } from "../../auth/access-token";
import { getCognitoClient } from "../../auth/cognito";
import { json, serverError, unauthorized } from "../../http/responses";

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  try {
    const cognito = getCognitoClient();
    await cognito.send(new GlobalSignOutCommand({ AccessToken: token }));
    return json(200, { ok: true });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") {
      return unauthorized("Sessão expirada ou já encerrada.");
    }
    return serverError("Não foi possível encerrar a sessão no servidor.");
  }
};
