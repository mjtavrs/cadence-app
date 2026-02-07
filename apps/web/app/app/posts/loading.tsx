import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Page, PageActions, PageDescription, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";

export default function Loading() {
  return (
    <Page>
      <PageHeader>
        <PageHeaderText>
          <PageTitle>
            <Skeleton className="h-7 w-32" />
          </PageTitle>
          <PageDescription>
            <Skeleton className="h-4 w-80" />
          </PageDescription>
        </PageHeaderText>
        <PageActions>
          <Skeleton className="h-10 w-28" />
        </PageActions>
      </PageHeader>

      <div className="grid gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}

