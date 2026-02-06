"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export function Providers(props: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {props.children}
        <Toaster richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

