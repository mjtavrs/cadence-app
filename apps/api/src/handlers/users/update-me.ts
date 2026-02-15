import type { APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";

type UserProfileItem = {
  PK: string;
  SK: "PROFILE";
  activeWorkspaceId?: string;
  name?: string;
  avatar?: string;
  updatedAt?: string;
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  let body: { name?: string; avatar?: string } = {};
  try {
    body = event.body ? (JSON.parse(event.body) as { name?: string; avatar?: string }) : {};
  } catch {
    return badRequest("Body inválido (JSON).");
  }

  const hasName = body.name !== undefined;
  const hasAvatar = body.avatar !== undefined;
  if (!hasName && !hasAvatar) {
    return badRequest("Informe name e/ou avatar para atualizar.");
  }
  const name = hasName ? (typeof body.name === "string" ? body.name.trim() : undefined) : undefined;
  const avatar = hasAvatar ? (typeof body.avatar === "string" ? body.avatar.trim() : undefined) : undefined;

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;
    const pk = `USER#${userId}`;

    const ddb = getDocClient();
    const tableName = getTableName();

    const existing = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: pk, SK: "PROFILE" },
      }),
    );
    const profile = existing.Item as UserProfileItem | undefined;

    const updatedAt = new Date().toISOString();
    const nextProfile: UserProfileItem = {
      PK: pk,
      SK: "PROFILE",
      ...(profile?.activeWorkspaceId !== undefined && { activeWorkspaceId: profile.activeWorkspaceId }),
      name: name !== undefined ? name : profile?.name,
      avatar: avatar !== undefined ? avatar : profile?.avatar,
      updatedAt,
    };

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: nextProfile,
      }),
    );

    return json(200, {
      ok: true,
      name: nextProfile.name ?? null,
      avatar: nextProfile.avatar ?? null,
    });
  } catch (err: any) {
    const errName = err?.name as string | undefined;
    if (errName === "NotAuthorizedException") {
      return unauthorized("Sessão expirada. Faça login novamente.");
    }
    return serverError("Não foi possível atualizar o perfil agora.");
  }
};
