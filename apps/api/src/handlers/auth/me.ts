import { GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyHandler } from "aws-lambda";
import { getCognitoClient } from "../../auth/cognito";
import { json, serverError, unauthorized } from "../../http/responses";

function getBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  if (!token) return null;
  return token;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const cognito = getCognitoClient();

  try {
    const res = await cognito.send(new GetUserCommand({ AccessToken: token }));
    const attributes = Object.fromEntries((res.UserAttributes ?? []).map((a) => [a.Name, a.Value]));

    return json(200, {
      username: res.Username,
      attributes,
    });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") {
      return unauthorized("Sessão expirada. Faça login novamente.");
    }
    return serverError("Não foi possível carregar o usuário agora.");
  }
};

