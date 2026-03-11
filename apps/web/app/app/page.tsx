import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CalendarDaysIcon } from "lucide-react";
import { GrGallery } from "react-icons/gr";
import { TbPencilPlus } from "react-icons/tb";

import { Page } from "@/components/page/page";
import { env } from "@/lib/env";
import { loadUserOnServer } from "@/lib/server-session";
import { HomeGreeting } from "./_components/home-greeting";
import { PostsActivityCard } from "./_components/posts-activity-card";
import { QuickAccessCard } from "./_components/quick-access-card";
import { UpcomingPostsCard } from "./_components/upcoming-posts-card";

type PostChannel = {
  platform?: string;
  placement?: string;
};

type HomePostItem = {
  postId: string;
  status?: string;
  title?: string;
  scheduledAtUtc?: string;
  publishedAt?: string;
  updatedAt?: string;
  mediaIds?: string[];
  channels?: PostChannel[];
};

type HomeMediaItem = {
  id: string;
  url: string;
};

const quickAccessCards = [
  {
    href: "/app/posts/new",
    title: "Criar post",
    description: "Crie e agende um post para sua rede social.",
    buttonLabel: "Ir para criação",
    icon: TbPencilPlus,
  },
  {
    href: "/app/calendar",
    title: "Ver calendário",
    description: "Visualize seu calendário e organize sua agenda de posts.",
    buttonLabel: "Ir para calendário",
    icon: CalendarDaysIcon,
  },
  {
    href: "/app/media",
    title: "Ver galeria",
    description: "Visualize sua galeria e veja itens que podem ser usados nos posts.",
    buttonLabel: "Ir para galeria",
    icon: GrGallery,
  },
] as const;

export const metadata: Metadata = {
  title: "Início",
};

function getFirstName(name: string | null) {
  if (!name) return null;
  const normalized = name.trim();
  if (!normalized) return null;
  return normalized.split(/\s+/)[0] ?? null;
}

function getGreeting(firstName: string | null) {
  const hour = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  const currentHour = Number(hour);

  const baseGreeting =
    currentHour < 12 ? "Bom dia" : currentHour < 18 ? "Boa tarde" : "Boa noite";

  return { baseGreeting, firstName };
}

async function loadUpcomingPostsOnServer() {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;
  if (!accessToken || !workspaceId) return [] as HomePostItem[];

  const url = new URL("posts", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);
  url.searchParams.set("status", "SCHEDULED");

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) return [] as HomePostItem[];

  const payload = (await res.json().catch(() => null)) as { items?: HomePostItem[] } | null;
  const items = payload?.items ?? [];
  const nowMs = Date.now();

  return items
    .filter((post) => typeof post.scheduledAtUtc === "string" && new Date(post.scheduledAtUtc).getTime() > nowMs)
    .sort((a, b) => (a.scheduledAtUtc ?? "").localeCompare(b.scheduledAtUtc ?? ""))
    .slice(0, 3);
}

async function loadMediaOnServer() {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;
  if (!accessToken || !workspaceId) return [] as HomeMediaItem[];

  const url = new URL("media", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) return [] as HomeMediaItem[];

  const payload = (await res.json().catch(() => null)) as { items?: HomeMediaItem[] } | null;
  return payload?.items ?? [];
}

async function loadPublishedPostsOnServer() {
  const store = await cookies();
  const accessToken = store.get("cadence_access")?.value;
  const workspaceId = store.get("cadence_workspace")?.value;
  if (!accessToken || !workspaceId) return [] as HomePostItem[];

  const url = new URL("posts", env.apiBaseUrl);
  url.searchParams.set("workspaceId", workspaceId);
  url.searchParams.set("status", "PUBLISHED");

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) return [] as HomePostItem[];

  const payload = (await res.json().catch(() => null)) as { items?: HomePostItem[] } | null;
  return payload?.items ?? [];
}

function computePublishedCounts(posts: HomePostItem[]) {
  const nowMs = Date.now();
  const msInDay = 86_400_000;

  const counts = { days7: 0, days15: 0, days30: 0 };

  for (const post of posts) {
    const publishedAt = typeof post.publishedAt === "string" && post.publishedAt
      ? post.publishedAt
      : typeof post.updatedAt === "string" && post.updatedAt
        ? post.updatedAt
        : null;

    if (!publishedAt) continue;
    const publishedMs = new Date(publishedAt).getTime();
    if (!Number.isFinite(publishedMs)) continue;

    const diff = nowMs - publishedMs;
    if (diff < 0) continue;

    if (diff <= 7 * msInDay) counts.days7 += 1;
    if (diff <= 15 * msInDay) counts.days15 += 1;
    if (diff <= 30 * msInDay) counts.days30 += 1;
  }

  return counts;
}

export default async function AppHomePage() {
  const user = await loadUserOnServer();
  const firstName = getFirstName(user?.name ?? null);
  const { baseGreeting } = getGreeting(firstName);

  const [upcomingPosts, mediaItems, publishedPosts] = await Promise.all([
    loadUpcomingPostsOnServer(),
    loadMediaOnServer(),
    loadPublishedPostsOnServer(),
  ]);
  const mediaById = new Map(mediaItems.map((item) => [item.id, item.url]));
  const publishedCounts = computePublishedCounts(publishedPosts);

  const upcomingPostsUi = upcomingPosts.map((post) => {
    const firstMediaId = Array.isArray(post.mediaIds) ? post.mediaIds[0] : null;
    const firstChannel = Array.isArray(post.channels) ? post.channels[0] : null;
    return {
      postId: post.postId,
      title: (post.title ?? "").trim() || "Sem título",
      scheduledAtUtc: post.scheduledAtUtc ?? new Date().toISOString(),
      thumbnailUrl: firstMediaId ? (mediaById.get(firstMediaId) ?? null) : null,
      platform: firstChannel?.platform ?? "INSTAGRAM",
    };
  });

  return (
    <Page className="min-h-[calc(100vh-8rem)]">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-5xl flex-col px-1 pt-8 sm:px-4 sm:pt-12 md:pt-14">
        <div className="flex w-full flex-col items-center">
          <HomeGreeting
            baseGreeting={baseGreeting}
            firstName={firstName}
            className="w-full self-start px-3 pb-3 text-left sm:px-0 sm:pb-5"
          />

          <div className="grid w-full grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            {quickAccessCards.map((card) => (
              <QuickAccessCard key={card.href} {...card} />
            ))}
            <UpcomingPostsCard posts={upcomingPostsUi} className="md:col-span-2 xl:col-span-2" />
            <PostsActivityCard counts={publishedCounts} className="md:col-span-2 xl:col-span-1" />
          </div>
        </div>
      </section>
    </Page>
  );
}
