"use client";

import { useCallback, useEffect, useState } from "react";

export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export type Workspace = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

export type WorkspacesResponse = {
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
};

function getErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message === "string") return v.message;
  return null;
}

export function useWorkspaces() {
  const [data, setData] = useState<WorkspacesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  const refetch = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/workspaces", { signal });
    const payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      setError(getErrorMessage(payload) ?? "Falha ao carregar workspaces.");
      setLoading(false);
      return;
    }
    setData(payload as WorkspacesResponse);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch("/api/workspaces", { signal: controller.signal })
      .then((res) => Promise.all([res.ok, res.json().catch(() => null)]))
      .then(([ok, payload]) => {
        if (cancelled) return;
        if (!ok) {
          setError(getErrorMessage(payload) ?? "Falha ao carregar workspaces.");
          setLoading(false);
          return;
        }
        const value = payload as WorkspacesResponse;
        setData(value);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if ((err as { name?: string })?.name === "AbortError") return;
        setError("Falha ao carregar workspaces.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const select = useCallback(async (workspaceId: string): Promise<boolean> => {
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
      return false;
    }
    setSelecting(null);
    return true;
  }, []);

  return { data, error, loading, selecting, select, refetch };
}
