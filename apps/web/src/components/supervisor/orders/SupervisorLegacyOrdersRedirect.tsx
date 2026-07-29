import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect } from "react";

import { LoadingState } from "@/components/ui";
import { SupervisorSessionGuard } from "@/components/supervisor/shell";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  buildSupervisorFloorContextQuery,
  firstLegacyQueryValue,
} from "@/lib/supervisor/legacy-orders-route";
import { fetchSupervisorOrderDetail } from "@/lib/supervisor/orders";

export function SupervisorLegacyOrdersRedirect() {
  const router = useRouter();
  const { accessToken, branchId, clearSession, isAuthenticated, isSupervisor } = useAuth();
  const orderId = firstLegacyQueryValue(router.query.orderId);
  const suppliedTableId = firstLegacyQueryValue(router.query.tableId);
  const canResolveOrder = Boolean(
    router.isReady
      && orderId
      && !suppliedTableId
      && accessToken
      && branchId
      && isAuthenticated
      && isSupervisor,
  );

  const orderQuery = useQuery({
    queryKey: ["supervisor", "order-detail", branchId, orderId],
    enabled: canResolveOrder,
    queryFn: () => fetchSupervisorOrderDetail(accessToken as string, branchId as string, orderId as string),
    retry: 1,
    staleTime: 8_000,
  });

  useEffect(() => {
    if (orderQuery.error instanceof ApiError && orderQuery.error.isAuthError) {
      clearSession();
    }
  }, [clearSession, orderQuery.error]);

  useEffect(() => {
    if (!router.isReady) return;
    if (orderId && !suppliedTableId && !orderQuery.isError && !orderQuery.isSuccess) return;

    const resolvedTableId = orderQuery.data?.table?.id || orderQuery.data?.tableId || null;
    const query = buildSupervisorFloorContextQuery(router.query, resolvedTableId);
    void router.replace({ pathname: "/supervisor/floor", query });
  }, [
    orderId,
    orderQuery.data?.table?.id,
    orderQuery.data?.tableId,
    orderQuery.isError,
    orderQuery.isSuccess,
    router,
    router.isReady,
    router.query,
    suppliedTableId,
  ]);

  return (
    <SupervisorSessionGuard>
      <main className="flex min-h-screen items-center justify-center bg-page p-4 sm:p-8">
        <LoadingState title={canResolveOrder ? "Opening order context on Floor" : "Returning to Supervisor Floor"} />
      </main>
    </SupervisorSessionGuard>
  );
}
