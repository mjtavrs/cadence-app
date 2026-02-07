import * as React from "react";

import { cn } from "@/lib/utils";

export function Page(props: React.ComponentProps<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("w-full space-y-6", className)} {...rest} />;
}

export function PageHeader(props: React.ComponentProps<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("flex items-start justify-between gap-4", className)} {...rest} />;
}

export function PageHeaderText(props: React.ComponentProps<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("space-y-1", className)} {...rest} />;
}

export function PageTitle(props: React.ComponentProps<"h1">) {
  const { className, ...rest } = props;
  return <h1 className={cn("text-2xl font-semibold tracking-tight", className)} {...rest} />;
}

export function PageDescription(props: React.ComponentProps<"p">) {
  const { className, ...rest } = props;
  return <p className={cn("text-muted-foreground text-sm", className)} {...rest} />;
}

export function PageActions(props: React.ComponentProps<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("flex items-center gap-2", className)} {...rest} />;
}

