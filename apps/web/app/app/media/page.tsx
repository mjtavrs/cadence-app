import { cookies } from "next/headers";
import type { Metadata } from "next";

import { env } from "@/lib/env";
import { Page } from "@/components/page/page";

import { MediaClient } from "./MediaClient";

export const metadata: Metadata = {
  title: "Biblioteca de mídia",
};

type MediaItem = {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  fileName: string | null;
  createdAt: string;
};

async function loadMediaOnServer() {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;

  if (!accessToken || !workspaceId) return [];

  const url = new URL("media", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return [];

  const payload = (await res.json().catch(() => null)) as { items?: MediaItem[] } | null;
  return payload?.items ?? [];
}

export default async function MediaPage() {
  const initialItems = await loadMediaOnServer();

  return (
    <Page>
      <MediaClient initialItems={initialItems} />
    </Page>
  );
}
