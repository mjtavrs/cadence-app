import { NextResponse } from "next/server";

import { env } from "@/lib/env";

import { getWorkspaceAuth } from "../../_auth";

type Body = {
  emailOnPendingApproval?: boolean;
  emailOnScheduled?: boolean;
  emailOnPublished?: boolean;
  emailOnFailed?: boolean;
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

  if (Object.prototype.hasOwnProperty.call(body, "emailOnPendingApproval")) {
    payloadToApi.emailOnPendingApproval = body.emailOnPendingApproval;
  }
  if (Object.prototype.hasOwnProperty.call(body, "emailOnScheduled")) {
    payloadToApi.emailOnScheduled = body.emailOnScheduled;
  }
  if (Object.prototype.hasOwnProperty.call(body, "emailOnPublished")) {
    payloadToApi.emailOnPublished = body.emailOnPublished;
  }
  if (Object.prototype.hasOwnProperty.call(body, "emailOnFailed")) {
    payloadToApi.emailOnFailed = body.emailOnFailed;
  }

  const res = await fetch(new URL("workspaces/settings/notifications", env.apiBaseUrl), {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify(payloadToApi),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao atualizar configurações de notificação." }, { status: res.status });
}
