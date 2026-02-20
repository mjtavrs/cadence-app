"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Page, PageDescription, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { WorkspaceSelectorContent } from "@/components/shell/workspace-selector-content";

export default function WorkspaceSelectorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/app", [searchParams]);
  const auto = useMemo(() => searchParams.get("auto") === "1", [searchParams]);

  const { data, error, loading, selecting, select } = useWorkspaces();

  useEffect(() => {
    if (!auto || !data?.activeWorkspaceId || loading) return;
    let cancelled = false;
    select(data.activeWorkspaceId).then((ok) => {
      if (!cancelled && ok) router.replace(next);
    });
    return () => {
      cancelled = true;
    };
  }, [auto, data?.activeWorkspaceId, loading, next, router, select]);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <Page>
          <Card className="p-6">
            <PageHeader className="mb-6">
              <PageHeaderText>
                <PageTitle>Selecione um workspace</PageTitle>
                <PageDescription>Escolha a empresa em que você vai trabalhar agora.</PageDescription>
              </PageHeaderText>
            </PageHeader>

            <WorkspaceSelectorContent
              data={data}
              error={error}
              loading={loading}
              selecting={selecting}
              onSelect={(workspaceId) => select(workspaceId).then((ok) => ok && router.replace(next))}
            />
          </Card>
        </Page>
      </div>
    </div>
  );
}
