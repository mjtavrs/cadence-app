import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyHandler } from "aws-lambda";
import { getCognitoClient, getUserPoolClientId } from "../../auth/cognito";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type LoginRequestBody = {
  email?: string;
  password?: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  let body: LoginRequestBody = {};
  try {
    body = event.body ? (JSON.parse(event.body) as LoginRequestBody) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return badRequest("Informe email e senha.");
  }

  const cognito = getCognitoClient();
  const clientId = getUserPoolClientId();

  try {
    const res = await cognito.send(
      new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }),
    );

    if (res.ChallengeName === "NEW_PASSWORD_REQUIRED" && res.Session) {
      return json(409, {
        challenge: "NEW_PASSWORD_REQUIRED",
        session: res.Session,
        username: email,
      });
    }

    const result = res.AuthenticationResult;
    if (!result?.AccessToken || !result?.IdToken || !result?.RefreshToken || !result.ExpiresIn) {
      return serverError("Falha ao autenticar.");
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
    if (name === "NotAuthorizedException" || name === "UserNotFoundException") {
      return unauthorized("Email ou senha inválidos.");
    }

    if (name === "UserNotConfirmedException") {
      return unauthorized("Usuário não confirmado.");
    }

    return serverError("Não foi possível autenticar agora. Tente novamente.");
  }
};

