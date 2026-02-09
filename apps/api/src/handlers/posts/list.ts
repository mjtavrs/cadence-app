import type { APIGatewayProxyHandler } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getBearerToken, getUserFromAccessToken } from "../../auth/access-token";
import { assertWorkspaceMembership } from "../../auth/workspace";
import { getDocClient, getTableName } from "../../db/dynamo";
import { badRequest, json, serverError, unauthorized } from "../../http/responses";
import { computeMonthBucketRecife } from "../../posts/schedule";

function prevMonth(month: string) {
  const [y, m] = month.split("-");
  let year = Number(y);
  let mon = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(mon)) return null;
  mon -= 1;
  if (mon <= 0) {
    mon = 12;
    year -= 1;
  }
  return `${year}-${String(mon).padStart(2, "0")}`;
}

function nextMonth(month: string) {
  const [y, m] = month.split("-");
  let year = Number(y);
  let mon = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(mon)) return null;
  mon += 1;
  if (mon >= 13) {
    mon = 1;
    year += 1;
  }
  return `${year}-${String(mon).padStart(2, "0")}`;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const token = getBearerToken(event.headers?.authorization ?? event.headers?.Authorization);
  if (!token) return unauthorized("Token ausente.");

  const workspaceId = event.queryStringParameters?.workspaceId?.trim();
  const week = event.queryStringParameters?.week?.trim();
  const status = event.queryStringParameters?.status?.trim();
  const month = event.queryStringParameters?.month?.trim();

  if (!workspaceId) return badRequest("workspaceId é obrigatório.");
  const filters = [week ? "week" : null, status ? "status" : null, month ? "month" : null].filter(Boolean);
  if (filters.length > 1) return badRequest("Use week, status ou month (apenas um).");

  try {
    const authed = await getUserFromAccessToken(token);
    const userId = authed.sub ?? authed.username;

    const membership = await assertWorkspaceMembership({ userId, workspaceId });
    if (!membership) return unauthorized("Sem acesso ao workspace.");

    const ddb = getDocClient();
    const tableName = getTableName();

    if (week) {
      const res = await ddb.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "GSI2",
          KeyConditionExpression: "GSI2PK = :pk",
          ExpressionAttributeValues: {
            ":pk": `WORKSPACE#${workspaceId}#WEEK#${week}`,
          },
          ScanIndexForward: true,
          Limit: 200,
        }),
      );

      return json(200, { items: res.Items ?? [] });
    }

    if (month) {
      const m = month;
      if (!/^\d{4}-\d{2}$/.test(m)) return badRequest("month inválido. Use YYYY-MM.");

      const monthsToQuery = [prevMonth(m), m, nextMonth(m)].filter(Boolean) as string[];
      const out: Array<Record<string, unknown>> = [];

      for (const mm of monthsToQuery) {
        const res = await ddb.send(
          new QueryCommand({
            TableName: tableName,
            IndexName: "GSI4",
            KeyConditionExpression: "GSI4PK = :pk",
            ExpressionAttributeValues: {
              ":pk": `WORKSPACE#${workspaceId}#MONTH#${mm}`,
            },
            ScanIndexForward: true,
            Limit: 500,
          }),
        );
        for (const it of res.Items ?? []) {
          out.push(it as Record<string, unknown>);
        }
      }

      const filtered = out
        .filter((it) => {
          const scheduledAtUtc = typeof it.scheduledAtUtc === "string" ? it.scheduledAtUtc : null;
          if (!scheduledAtUtc) return false;
          return computeMonthBucketRecife(scheduledAtUtc) === m;
        })
        .sort((a, b) => {
          const aa = typeof a.scheduledAtUtc === "string" ? a.scheduledAtUtc : "";
          const bb = typeof b.scheduledAtUtc === "string" ? b.scheduledAtUtc : "";
          return aa.localeCompare(bb);
        });

      return json(200, { items: filtered });
    }

    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `WORKSPACE#${workspaceId}`,
          ":skPrefix": "POST#",
          ...(status ? { ":status": status } : {}),
        },
        ...(status
          ? {
              FilterExpression: "#status = :status",
              ExpressionAttributeNames: { "#status": "status" },
            }
          : {}),
        ScanIndexForward: false,
        Limit: 50,
      }),
    );

    return json(200, { items: res.Items ?? [] });
  } catch (err: any) {
    const name = err?.name as string | undefined;
    if (name === "NotAuthorizedException") return unauthorized("Sessão expirada. Faça login novamente.");
    return serverError("Não foi possível listar posts agora.");
  }
};

