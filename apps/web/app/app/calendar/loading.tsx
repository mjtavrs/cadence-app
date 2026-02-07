import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Page, PageActions, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";

export default function Loading() {
  return (
    <Page>
      <PageHeader>
        <PageHeaderText>
          <PageTitle>
            <Skeleton className="h-7 w-44" />
          </PageTitle>
          <div className="text-muted-foreground text-sm">
            <Skeleton className="h-4 w-72" />
          </div>
        </PageHeaderText>
        <PageActions>
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </PageActions>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="mb-3 h-4 w-40" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}

