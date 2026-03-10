import type { ReactNode } from "react";

export function SettingsSection(props: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <section className="space-y-6 border-b pb-10 last:border-b-0">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-[1.35rem] font-semibold tracking-tight">{props.title}</h2>
        {props.meta ? <div className="pt-1">{props.meta}</div> : null}
      </header>
      <div className="space-y-4">{props.children}</div>
      {props.footer ? <div>{props.footer}</div> : null}
    </section>
  );
}
