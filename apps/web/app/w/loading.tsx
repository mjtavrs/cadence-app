import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Page, PageActions, PageDescription, PageHeader, PageHeaderText, PageTitle } from "@/components/page/page";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <Page>
          <Card className="p-6">
            <PageHeader className="mb-6">
              <PageHeaderText>
                <PageTitle>
                  <Skeleton className="h-7 w-60" />
                </PageTitle>
                <PageDescription>
                  <Skeleton className="h-4 w-72" />
                </PageDescription>
              </PageHeaderText>
            </PageHeader>

            <PageActions className="flex flex-col items-stretch gap-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </PageActions>
          </Card>
        </Page>
      </div>
    </div>
  );
}

