"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkspacesResponse } from "@/hooks/use-workspaces";

export type WorkspaceSelectorContentProps = {
  data: WorkspacesResponse | null;
  error: string | null;
  loading: boolean;
  selecting: string | null;
  onSelect: (workspaceId: string) => void;
};

export function WorkspaceSelectorContent(props: WorkspaceSelectorContentProps) {
  const { data, error, loading, selecting, onSelect } = props;

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  if (data?.workspaces?.length) {
    return (
      <div className="flex flex-col items-stretch gap-3">
        {data.workspaces.map((w) => (
          <Button
            key={w.id}
            variant="secondary"
            className="w-full justify-between"
            disabled={!!selecting}
            onClick={() => onSelect(w.id)}
          >
            <span className="truncate">{w.name}</span>
            <span className="text-muted-foreground text-xs">
              {selecting === w.id ? "Selecionando..." : w.role}
            </span>
          </Button>
        ))}
      </div>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      Você ainda não possui acesso a nenhum workspace.
    </p>
  );
}
