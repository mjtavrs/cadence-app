import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient, getTableName } from "../db/dynamo";

type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

type WorkspaceMembershipItem = {
  PK: string;
  SK: string;
  workspaceId: string;
  workspaceName: string;
  role: Role;
};

export async function assertWorkspaceMembership(params: { userId: string; workspaceId: string }) {
  const ddb = getDocClient();
  const tableName = getTableName();

  const res = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: `USER#${params.userId}`,
        SK: `WORKSPACE#${params.workspaceId}`,
      },
    }),
  );

  const item = res.Item as WorkspaceMembershipItem | undefined;
  if (!item) return null;
  return item;
}

