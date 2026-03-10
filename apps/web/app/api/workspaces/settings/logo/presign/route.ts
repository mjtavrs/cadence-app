import { NextResponse } from "next/server";

import { env } from "@/lib/env";

import { getWorkspaceAuth } from "../../../_auth";

type Body = {
  contentType?: string;
  fileName?: string;
  sizeBytes?: number;
};

export async function POST(req: Request) {
  const auth = await getWorkspaceAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Body inválido (JSON)." }, { status: 400 });
  }

  const res = await fetch(new URL("workspaces/settings/logo/presign", env.apiBaseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify({
      workspaceId: auth.workspaceId,
      contentType: body.contentType,
      fileName: body.fileName,
      sizeBytes: body.sizeBytes,
    }),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao preparar upload do logo." }, { status: res.status });
}
