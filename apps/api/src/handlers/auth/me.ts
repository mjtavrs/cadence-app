import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { getDocClient, getTableName } from "../../db/dynamo";
import { json, serverError, unauthorized } from "../../http/responses";

type UserProfileItem = {
  PK: string;
  SK: "PROFILE";
  name?: string;
  avatar?: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  try {
    const cognitoUser = await getUserFromAccessToken(token);
    const userId = cognitoUser.sub ?? cognitoUser.username;
    const pk = `USER#${userId}`;

    const ddb = getDocClient();
    const tableName = getTableName();
    const profileRes = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: pk, SK: "PROFILE" },
      }),
    );
    const profile = profileRes.Item as UserProfileItem | undefined;

    return json(200, {
      ...cognitoUser,
      name: profile?.name ?? null,
      avatar: profile?.avatar ?? null,
    });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") {
      return unauthorized("Sessão expirada. Faça login novamente.");
    }
    return serverError("Não foi possível carregar o usuário agora.");
  }
};

