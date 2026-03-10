import Link from "next/link";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QuickAccessCardProps = {
  href: string;
  title: string;
  description: string;
  buttonLabel: string;
  icon: ComponentType<{ className?: string }>;
  className?: string;
  iconClassName?: string;
};

export function QuickAccessCard(props: QuickAccessCardProps) {
  const { href, title, description, buttonLabel, icon: Icon, className, iconClassName } = props;

  return (
    <article
      className={cn(
        "flex min-h-[260px] w-full flex-col items-center rounded-lg border border-border/70 bg-card px-4 py-6 text-center shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-linear-to-r from-[#22d3ee] to-[#34d399] text-primary-foreground">
          <Icon className={cn("size-6", iconClassName)} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-foreground/90">{title}</h2>
      </div>
      <p className="mt-3 min-h-14 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-5">
        <Button asChild>
          <Link href={href}>{buttonLabel}</Link>
        </Button>
      </div>
    </article>
  );
}
