import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyHandler } from "aws-lambda";
import { getCognitoClient, getUserPoolClientId } from "../../auth/cognito";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type RefreshRequestBody = {
  refreshToken?: string;
  username?: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  let body: RefreshRequestBody = {};
  try {
    body = event.body ? (JSON.parse(event.body) as RefreshRequestBody) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const refreshToken = body.refreshToken;
  const username = body.username?.trim();

  if (!refreshToken || !username) {
    return badRequest("Refresh token inválido.");
  }

  const cognito = getCognitoClient();
  const clientId = getUserPoolClientId();

  try {
    const res = await cognito.send(
      new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: "REFRESH_TOKEN_AUTH",
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
          USERNAME: username,
        },
      }),
    );

    const result = res.AuthenticationResult;
    if (!result?.AccessToken || !result?.IdToken || !result.ExpiresIn) {
      return serverError("Falha ao atualizar sessão.");
    }

    return json(200, {
      accessToken: result.AccessToken,
      idToken: result.IdToken,
      expiresIn: result.ExpiresIn,
      tokenType: result.TokenType ?? "Bearer",
    });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") {
      return unauthorized("Sessão expirada. Faça login novamente.");
    }
    return serverError("Não foi possível atualizar a sessão agora.");
  }
};

