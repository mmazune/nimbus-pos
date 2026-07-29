import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

import { ToastProvider } from "@/components/providers/ToastProvider";
import { shouldRetryApiRequest } from "@/lib/api/client";
import { AuthProvider } from "@/lib/auth/AuthProvider";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: typeof window === "undefined" ? Infinity : 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: shouldRetryApiRequest,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
