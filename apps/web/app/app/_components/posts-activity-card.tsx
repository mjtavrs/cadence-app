import { cn } from "@/lib/utils";

type PostsActivityCardProps = {
  counts: {
    days7: number;
    days15: number;
    days30: number;
  };
  className?: string;
};

function ActivityRow(props: { label: string; value: number; withDivider?: boolean }) {
  return (
    <div className={cn("py-3", props.withDivider && "border-b border-border/70")}>
      <div className="text-sm font-medium text-foreground sm:text-base">{props.label}</div>
      <div className="mt-1 text-3xl font-semibold leading-none text-foreground/75 sm:text-4xl">{props.value}</div>
    </div>
  );
}

export function PostsActivityCard({ counts, className }: PostsActivityCardProps) {
  return (
    <article
      className={cn(
        "flex h-full min-h-[240px] w-full flex-col rounded-lg border border-border/70 bg-card p-3 shadow-sm sm:min-h-[260px] sm:p-4",
        className,
      )}
    >
      <header className="pb-3">
        <h2 className="text-lg font-semibold text-foreground/90 sm:text-xl">Posts realizados</h2>
      </header>

      <div className="flex flex-1 flex-col">
        <ActivityRow label="Últimos 7 dias" value={counts.days7} withDivider />
        <ActivityRow label="Últimos 15 dias" value={counts.days15} withDivider />
        <ActivityRow label="Últimos 30 dias" value={counts.days30} />
      </div>
    </article>
  );
}
