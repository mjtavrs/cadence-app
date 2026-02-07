import { MediaClient } from "./MediaClient";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { Page, PageActions, PageDescription, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";
import { MediaUploadAction } from "./MediaClient";

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
      <PageHeader>
        <PageHeaderText>
          <PageTitle>Biblioteca de mídia</PageTitle>
          <PageDescription>Até 30 imagens por workspace. Máximo de 10MB por arquivo.</PageDescription>
        </PageHeaderText>
        <PageActions>
          <MediaUploadAction initialItems={initialItems} />
        </PageActions>
      </PageHeader>

      <MediaClient initialItems={initialItems} />
    </Page>
  );
}

