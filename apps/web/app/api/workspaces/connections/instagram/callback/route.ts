import { NextResponse } from "next/server";

import { env } from "@/lib/env";

import { getWorkspaceAuth } from "../../../_auth";

type Body = {
  code?: string;
  state?: string;
  accountId?: string;
  accountUsername?: string;
  tokenExpiresAt?: string;
};

export async function POST(req: Request) {
  const auth = await getWorkspaceAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as Body | null;

  const payloadToApi: Record<string, unknown> = {
    workspaceId: auth.workspaceId,
  };

  if (body && typeof body === "object") {
    if (typeof body.code === "string") payloadToApi.code = body.code;
    if (typeof body.state === "string") payloadToApi.state = body.state;
    if (typeof body.accountId === "string") payloadToApi.accountId = body.accountId;
    if (typeof body.accountUsername === "string") payloadToApi.accountUsername = body.accountUsername;
    if (typeof body.tokenExpiresAt === "string") payloadToApi.tokenExpiresAt = body.tokenExpiresAt;
  }

  const res = await fetch(new URL("workspaces/connections/instagram/callback", env.apiBaseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify(payloadToApi),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao concluir conexão com Instagram." }, { status: res.status });
}
