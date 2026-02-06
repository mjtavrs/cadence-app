import { GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { getCognitoClient } from "./cognito";

export type AuthedUser = {
  username: string;
  sub?: string;
  email?: string;
};

export function getBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  if (!token) return null;
  return token;
}

export async function getUserFromAccessToken(accessToken: string): Promise<AuthedUser> {
  const cognito = getCognitoClient();
  const res = await cognito.send(new GetUserCommand({ AccessToken: accessToken }));
  const attributes = Object.fromEntries((res.UserAttributes ?? []).map((a) => [a.Name, a.Value]));

  return {
    username: res.Username,
    sub: attributes.sub,
    email: attributes.email,
  };
}

