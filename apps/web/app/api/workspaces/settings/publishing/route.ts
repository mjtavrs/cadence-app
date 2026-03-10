import { NextResponse } from "next/server";

import { env } from "@/lib/env";

import { getWorkspaceAuth } from "../../_auth";

type Body = {
  requireApprovalForContributors?: boolean;
  defaultChannels?: Array<{ platform: string; placement: string }>;
};

export async function PATCH(req: Request) {
  const auth = await getWorkspaceAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Body inválido (JSON)." }, { status: 400 });
  }

  const payloadToApi: Record<string, unknown> = {
    workspaceId: auth.workspaceId,
  };

  if (Object.prototype.hasOwnProperty.call(body, "requireApprovalForContributors")) {
    payloadToApi.requireApprovalForContributors = body.requireApprovalForContributors;
  }
  if (Object.prototype.hasOwnProperty.call(body, "defaultChannels")) {
    payloadToApi.defaultChannels = body.defaultChannels;
  }

  const res = await fetch(new URL("workspaces/settings/publishing", env.apiBaseUrl), {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify(payloadToApi),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao atualizar configurações de publicação." }, { status: res.status });
}
