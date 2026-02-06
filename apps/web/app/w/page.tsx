"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

type Workspace = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

type WorkspacesResponse = {
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
};

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

export default function WorkspaceSelectorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/app", [searchParams]);
  const auto = useMemo(() => searchParams.get("auto") === "1", [searchParams]);

  const [data, setData] = useState<WorkspacesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/workspaces");
      const payload = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        if (!cancelled) setError(getErrorMessage(payload) ?? "Falha ao carregar workspaces.");
        if (!cancelled) setLoading(false);
        return;
      }

      const value = payload as WorkspacesResponse;
      if (!cancelled) setData(value);
      if (!cancelled) setLoading(false);

      if (auto && value.activeWorkspaceId) {
        // Se já existe preferência (sincronizada), seleciona e segue.
        await fetch("/api/workspaces/select", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workspaceId: value.activeWorkspaceId }),
        });
        if (!cancelled) router.replace(next);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [auto, next, router]);

  async function select(workspaceId: string) {
    setSelecting(workspaceId);
    setError(null);

    const res = await fetch("/api/workspaces/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as unknown;
      setError(getErrorMessage(payload) ?? "Falha ao selecionar workspace.");
      setSelecting(null);
      return;
    }

    router.replace(next);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <Card className="w-full max-w-lg p-6">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Selecione um workspace</h1>
          <p className="text-muted-foreground text-sm">
            Escolha a empresa em que você vai trabalhar agora.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : data?.workspaces?.length ? (
          <div className="space-y-3">
            {data.workspaces.map((w) => (
              <Button
                key={w.id}
                variant="secondary"
                className="w-full justify-between"
                disabled={!!selecting}
                onClick={() => select(w.id)}
              >
                <span className="truncate">{w.name}</span>
                <span className="text-muted-foreground text-xs">
                  {selecting === w.id ? "Selecionando..." : w.role}
                </span>
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Você ainda não possui acesso a nenhum workspace.
          </p>
        )}

        {error && !loading && <p className="text-destructive mt-4 text-sm">{error}</p>}
      </Card>
    </div>
  );
}

