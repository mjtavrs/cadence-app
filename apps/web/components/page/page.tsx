import * as React from "react";

import { cn } from "@/lib/utils";

export function Page(props: React.ComponentProps<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("w-full space-y-4 sm:space-y-6", className)} {...rest} />;
}

export function PageHeader(props: React.ComponentProps<"div">) {
  const { className, ...rest } = props;
  return (
    <div
      className={cn("flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4", className)}
      {...rest}
    />
  );
}

export function PageHeaderText(props: React.ComponentProps<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("min-w-0 space-y-1", className)} {...rest} />;
}

export function PageTitle(props: React.ComponentProps<"h1">) {
  const { className, ...rest } = props;
  return <h1 className={cn("text-xl font-semibold tracking-tight sm:text-2xl", className)} {...rest} />;
}

export function PageDescription(props: React.ComponentProps<"p">) {
  const { className, ...rest } = props;
  return <p className={cn("text-muted-foreground text-sm", className)} {...rest} />;
}

export function PageActions(props: React.ComponentProps<"div">) {
  const { className, ...rest } = props;
  return (
    <div
      className={cn("flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end", className)}
      {...rest}
    />
  );
}

