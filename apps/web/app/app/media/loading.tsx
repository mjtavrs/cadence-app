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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="flex items-center justify-between gap-2 p-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-8 w-16" />
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}

