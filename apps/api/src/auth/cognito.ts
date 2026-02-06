import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

export function getCognitoClient() {
  return new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
  });
}

export function getUserPoolClientId() {
  const clientId = process.env.COGNITO_USER_POOL_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing env: COGNITO_USER_POOL_CLIENT_ID");
  }
  return clientId;
}

