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
        "flex min-h-[220px] w-full flex-col items-center rounded-lg border border-border/70 bg-card px-4 py-5 text-center shadow-sm sm:min-h-[240px] sm:py-6",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-linear-to-r from-[#22d3ee] to-[#34d399] text-primary-foreground sm:mb-4 sm:size-14">
          <Icon className={cn("size-6", iconClassName)} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-foreground/90 sm:text-xl">{title}</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:min-h-14">{description}</p>
      <div className="mt-4 w-full sm:mt-5">
        <Button asChild className="w-full sm:w-auto">
          <Link href={href}>{buttonLabel}</Link>
        </Button>
      </div>
    </article>
  );
}
