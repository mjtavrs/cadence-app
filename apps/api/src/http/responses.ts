import type { APIGatewayProxyResult } from "aws-lambda";

const defaultHeaders = {
  "content-type": "application/json; charset=utf-8",
};

export function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(body),
  };
}

export function badRequest(message: string): APIGatewayProxyResult {
  return json(400, { message });
}

export function unauthorized(message = "Não autorizado."): APIGatewayProxyResult {
  return json(401, { message });
}

export function serverError(message = "Erro interno."): APIGatewayProxyResult {
  return json(500, { message });
}

