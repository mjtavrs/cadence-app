import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

const ACCESS_COOKIE = "cadence_access";
const WORKSPACE_COOKIE = "cadence_workspace";

export async function GET(req: Request) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const url = new URL("posts", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const reqUrl = new URL(req.url);
  const week = reqUrl.searchParams.get("week");
  const status = reqUrl.searchParams.get("status");
  const month = reqUrl.searchParams.get("month");
  if (week) url.searchParams.set("week", week);
  if (status) url.searchParams.set("status", status);
  if (month) url.searchParams.set("month", month);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload ?? { message: "Falha ao listar posts." }, { status: res.status });
}

type CreateBody = {
  title?: string;
  caption?: string;
  mediaIds?: string[];
  tags?: string[];
  scheduledAtUtc?: string;
  aspectRatio?: string;
  cropX?: number;
  cropY?: number;
  saveAsDraft?: boolean;
  directSchedule?: boolean;
};

export async function POST(req: Request) {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const workspaceId = store.get(WORKSPACE_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!workspaceId) return NextResponse.json({ message: "Workspace não selecionado." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body) {
    return NextResponse.json({ message: "Body inválido." }, { status: 400 });
  }

  const saveAsDraft = body.saveAsDraft === true;
  
  if (!saveAsDraft) {
    if (!body.title || !body.caption || !body.mediaIds) {
      return NextResponse.json({ message: "Parâmetros inválidos." }, { status: 400 });
    }
  } else {
    if (!body.mediaIds) {
      return NextResponse.json({ message: "mediaIds é obrigatório." }, { status: 400 });
    }
  }

  const payload: Record<string, unknown> = {
    workspaceId,
    title: body.title || "",
    caption: body.caption || "",
    mediaIds: body.mediaIds,
    tags: body.tags ?? [],
  };
  
  if (saveAsDraft) {
    payload.saveAsDraft = true;
  }
  
  if (typeof body.scheduledAtUtc === "string" && body.scheduledAtUtc.trim()) {
    payload.scheduledAtUtc = body.scheduledAtUtc.trim();
  }
  
  if (typeof body.directSchedule === "boolean" && body.directSchedule) {
    payload.directSchedule = true;
  }
  
  if (typeof body.aspectRatio === "string" && body.aspectRatio.trim()) {
    payload.aspectRatio = body.aspectRatio.trim();
  }
  if (typeof body.cropX === "number" && !Number.isNaN(body.cropX)) {
    payload.cropX = body.cropX;
  }
  if (typeof body.cropY === "number" && !Number.isNaN(body.cropY)) {
    payload.cropY = body.cropY;
  }

  const res = await fetch(new URL("posts", env.apiBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });

  const result = await res.json().catch(() => null);
  return NextResponse.json(result ?? { message: "Falha ao criar post." }, { status: res.status });
}

