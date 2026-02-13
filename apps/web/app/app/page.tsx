import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Page, PageActions, PageDescription, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";

export const metadata: Metadata = {
  title: "Cadence",
};

export default async function AppHomePage() {
  return (
    <Page>
      <PageHeader>
        <PageHeaderText>
          <PageTitle>Cadence</PageTitle>
          <PageDescription>
            Base pronta. Próximo passo: workspaces, biblioteca de mídia e workflow de posts.
          </PageDescription>
        </PageHeaderText>
      </PageHeader>

      <PageActions className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/api/auth/me">Testar sessão (me)</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/app/posts">Posts</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/app/calendar">Calendário</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/app/media">Mídia</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/w">Trocar workspace</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/">Home</Link>
        </Button>
      </PageActions>
    </Page>
  );
}

