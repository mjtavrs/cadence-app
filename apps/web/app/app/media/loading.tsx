import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Page, PageActions, PageDescription, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";

export default function Loading() {
  return (
    <Page>
      <PageHeader>
        <PageHeaderText>
          <PageTitle>
            <Skeleton className="h-7 w-56" />
          </PageTitle>
          <PageDescription>
            <Skeleton className="h-4 w-80" />
          </PageDescription>
        </PageHeaderText>
        <PageActions>
          <Skeleton className="h-10 w-36" />
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="overflow-hidden gap-0 p-0">
            <Skeleton className="aspect-4/3 w-full rounded-none" />
            <div className="flex items-center justify-between gap-2 p-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Skeleton className="size-4 shrink-0 rounded" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="size-8 shrink-0 rounded" />
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}

