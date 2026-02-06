import { RespondToAuthChallengeCommand } from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyHandler } from "aws-lambda";
import { getCognitoClient, getUserPoolClientId } from "../../auth/cognito";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type NewPasswordRequestBody = {
  username?: string;
  session?: string;
  newPassword?: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  let body: NewPasswordRequestBody = {};
  try {
    body = event.body ? (JSON.parse(event.body) as NewPasswordRequestBody) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const username = body.username?.trim();
  const session = body.session;
  const newPassword = body.newPassword;

  if (!username || !session || !newPassword) {
    return badRequest("Dados inválidos.");
  }

  const cognito = getCognitoClient();
  const clientId = getUserPoolClientId();

  try {
    const res = await cognito.send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: newPassword,
        },
      }),
    );

    const result = res.AuthenticationResult;
    if (!result?.AccessToken || !result?.IdToken || !result?.RefreshToken || !result.ExpiresIn) {
      return serverError("Falha ao finalizar login.");
    }

    return json(200, {
      accessToken: result.AccessToken,
      idToken: result.IdToken,
      refreshToken: result.RefreshToken,
      expiresIn: result.ExpiresIn,
      tokenType: result.TokenType ?? "Bearer",
    });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (
      name === "NotAuthorizedException" ||
      name === "ExpiredCodeException" ||
      name === "InvalidParameterException"
    ) {
      return unauthorized("Sessão expirada. Faça login novamente.");
    }
    if (name === "InvalidPasswordException") {
      return badRequest("A senha não atende aos requisitos.");
    }
    return serverError("Não foi possível definir a nova senha agora.");
  }
};

