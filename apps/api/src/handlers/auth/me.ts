import type { APIGatewayProxyHandler } from "aws-lambda";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { json, serverError, unauthorized } from "../../http/responses";

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  try {
    return json(200, {
      ...(await getUserFromAccessToken(token)),
    });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") {
      return unauthorized("Sessão expirada. Faça login novamente.");
    }
    return serverError("Não foi possível carregar o usuário agora.");
  }
};

