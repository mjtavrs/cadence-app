import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { env } from "@/lib/env";
import { EditPostClient, type EditablePost, type MediaItem } from "./post-edit-client";

async function loadPostOnServer(postId: string) {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;
  if (!accessToken || !workspaceId) return null;

  const url = new URL(`posts/${encodeURIComponent(postId)}`, env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as EditablePost | null;
}

async function loadMediaOnServer() {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;
  if (!accessToken || !workspaceId) return [] as MediaItem[];

  const url = new URL("media", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) return [] as MediaItem[];
  const payload = (await res.json().catch(() => null)) as { items?: MediaItem[] } | null;
  return payload?.items ?? [];
}

export async function generateMetadata(ctx: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await ctx.params;
  const post = await loadPostOnServer(id);
  return {
    title: post?.title || "Editar post",
  };
}

export default async function PostEditPage(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [post, media] = await Promise.all([loadPostOnServer(id), loadMediaOnServer()]);
  if (!post) notFound();
  return <EditPostClient initialPost={post} initialMedia={media} />;
}

