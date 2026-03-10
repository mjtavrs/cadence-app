import Image from "next/image";
import Link from "next/link";
import { FaInstagram } from "react-icons/fa";
import { FaSquareFacebook, FaSquareXTwitter } from "react-icons/fa6";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UpcomingPostItem = {
  postId: string;
  title: string;
  scheduledAtUtc: string;
  thumbnailUrl: string | null;
  platform: string;
};

type UpcomingPostsCardProps = {
  posts: UpcomingPostItem[];
  className?: string;
};

function recifeDateParts(isoUtc: string) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(isoUtc));
  const map = new Map(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
  };
}

function formatUpcomingSchedule(isoUtc: string) {
  const target = new Date(isoUtc);
  const now = new Date();

  const today = recifeDateParts(now.toISOString());
  const scheduled = recifeDateParts(isoUtc);

  const todayUtcDay = Date.UTC(today.year, today.month - 1, today.day);
  const scheduledUtcDay = Date.UTC(scheduled.year, scheduled.month - 1, scheduled.day);
  const dayDiff = Math.round((scheduledUtcDay - todayUtcDay) / 86_400_000);

  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(target);

  if (dayDiff === 0) return `Hoje, às ${time}`;
  if (dayDiff === 1) return `Amanhã, às ${time}`;

  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    day: "2-digit",
    month: "2-digit",
  }).format(target);

  return `${date}, às ${time}`;
}

function SocialIcon(props: { platform: string }) {
  const platform = props.platform.toUpperCase();
  const className = "size-5 text-muted-foreground";

  if (platform === "FACEBOOK") return <FaSquareFacebook className={className} aria-hidden="true" />;
  if (platform === "TWITTER" || platform === "X") return <FaSquareXTwitter className={className} aria-hidden="true" />;
  return <FaInstagram className={className} aria-hidden="true" />;
}

export function UpcomingPostsCard({ posts, className }: UpcomingPostsCardProps) {
  const hasPosts = posts.length > 0;

  return (
    <article
      className={cn(
        "flex h-full min-h-[260px] w-full flex-col rounded-lg border border-border/70 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <header className="pb-3">
        <h2 className="text-xl font-semibold text-foreground/90">Próximos posts</h2>
      </header>

      {!hasPosts ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <Image
            src="/empty_state_illustration.webp"
            alt="Nenhum post agendado"
            width={136}
            height={136}
            className="h-auto w-[136px] grayscale"
          />
          <p className="mt-3 text-sm text-muted-foreground">Nada agendado ainda...</p>
          <p className="mt-1 text-base text-muted-foreground">Que tal criarmos algo novo?</p>
          <div className="mt-4">
            <Button asChild>
              <Link href="/app/posts/new">Criar post</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-border/70">
          {posts.map((post) => (
            <li key={post.postId} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted">
                  {post.thumbnailUrl ? (
                    <img src={post.thumbnailUrl} alt={post.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-muted" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{post.title}</p>
                  <p className="text-sm text-muted-foreground">{formatUpcomingSchedule(post.scheduledAtUtc)}</p>
                </div>
              </div>
              <SocialIcon platform={post.platform} />
            </li>
          ))}
        </ul>
      )}

      {hasPosts ? (
        <div className="mt-auto pt-5 flex justify-end">
          <Button asChild>
            <Link href="/app/posts">Ver lista de posts</Link>
          </Button>
        </div>
      ) : null}
    </article>
  );
}
