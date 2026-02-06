import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export function getTableName() {
  const name = process.env.APP_TABLE_NAME;
  if (!name) throw new Error("Missing env: APP_TABLE_NAME");
  return name;
}

export function getDocClient() {
  const client = new DynamoDBClient({ region: process.env.AWS_REGION });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

