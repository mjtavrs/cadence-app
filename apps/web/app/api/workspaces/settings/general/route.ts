import { NextResponse } from "next/server";

import { env } from "@/lib/env";

import { getWorkspaceAuth } from "../../_auth";

type Body = {
  workspaceName?: string | null;
  workspaceLogoKey?: string | null;
  timezone?: string;
  locale?: string;
};

export async function PATCH(req: Request) {
  const auth = await getWorkspaceAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Body inválido (JSON)." }, { status: 400 });
  }

  const res = await fetch(new URL("workspaces/settings/general", env.apiBaseUrl), {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify({
      workspaceId: auth.workspaceId,
      ...(Object.prototype.hasOwnProperty.call(body, "workspaceName") ? { workspaceName: body.workspaceName } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "workspaceLogoKey")
        ? { workspaceLogoKey: body.workspaceLogoKey }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "timezone") ? { timezone: body.timezone } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "locale") ? { locale: body.locale } : {}),
    }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao atualizar configurações gerais." }, { status: res.status });
}
