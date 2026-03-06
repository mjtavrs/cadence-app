import type { Metadata } from "next";
import Link from "next/link";
import { Charis_SIL } from "next/font/google";
import { BsImages } from "react-icons/bs";
import { CgNotes } from "react-icons/cg";
import { TbCalendarMonth } from "react-icons/tb";

import { Page } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { loadUserOnServer } from "@/lib/server-session";
import { cn } from "@/lib/utils";

const charisSil = Charis_SIL({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const navigationItems = [
  {
    href: "/app/posts",
    label: "Visualizar posts",
    icon: CgNotes,
  },
  {
    href: "/app/calendar",
    label: "Visualizar calendário",
    icon: TbCalendarMonth,
  },
  {
    href: "/app/media",
    label: "Visualizar biblioteca",
    icon: BsImages,
  },
] as const;

export const metadata: Metadata = {
  title: "Cadence",
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
    currentHour < 12
      ? "Bom dia"
      : currentHour < 18
        ? "Boa tarde"
        : "Boa noite";

  return firstName ? `${baseGreeting}, ${firstName}.` : `${baseGreeting}.`;
}

export default async function AppHomePage() {
  const user = await loadUserOnServer();
  const firstName = getFirstName(user?.name ?? null);
  const greeting = getGreeting(firstName);

  return (
    <Page className="min-h-[calc(100vh-8rem)]">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl flex-col items-center justify-center px-4 text-center">
        <div className="flex w-full flex-col items-center gap-8">
          <h1
            className={cn(
              charisSil.className,
              "max-w-4xl text-balance text-4xl leading-tight font-normal tracking-tight text-[#191919] sm:text-5xl lg:text-6xl",
            )}
          >
            {greeting}
          </h1>

          <div className="flex w-full flex-wrap justify-center gap-3">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button key={item.href} asChild className="h-11 min-w-[220px] px-5 text-sm font-medium">
                  <Link href={item.href}>
                    <span className="flex items-center gap-2">
                      <Icon className="size-[18px] text-current" />
                      <span>{item.label}</span>
                    </span>
                  </Link>
                </Button>
              );
            })}
          </div>
        </div>
      </section>
    </Page>
  );
}
