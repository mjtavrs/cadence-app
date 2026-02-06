import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { PostsClient, type Post } from "./PostsClient";

async function loadPostsOnServer() {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;
  if (!accessToken || !workspaceId) return [] as Post[];

  const url = new URL("posts", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) return [] as Post[];
  const payload = (await res.json().catch(() => null)) as { items?: Post[] } | null;
  return payload?.items ?? [];
}

export default async function PostsPage() {
  const initialItems = await loadPostsOnServer();
  return <PostsClient initialItems={initialItems} />;
}

