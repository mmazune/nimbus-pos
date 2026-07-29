import { useQuery } from "@tanstack/react-query";

import { shouldRetryApiRequest } from "@/lib/api/client";
import { getActiveShiftRequest } from "@/lib/auth/auth-api";
import { useAuth } from "@/lib/auth/AuthProvider";

export function useActiveShift() {
  const { accessToken, branchId, isWaiter } = useAuth();

  return useQuery({
    queryKey: ["waiter", "active-shift", branchId],
    enabled: Boolean(accessToken && branchId && isWaiter),
    queryFn: () => getActiveShiftRequest(accessToken as string, branchId as string),
    retry: shouldRetryApiRequest,
    staleTime: 30_000,
  });
}
