import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AppHomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cadence</h1>
        <p className="text-muted-foreground text-sm">
          Base pronta. Próximo passo: workspaces, biblioteca de mídia e workflow de posts.
        </p>
      </div>

      <div className="flex gap-3">
        <Button asChild>
          <a href="/api/auth/me">Testar sessão (me)</a>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/w">Trocar workspace</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}

