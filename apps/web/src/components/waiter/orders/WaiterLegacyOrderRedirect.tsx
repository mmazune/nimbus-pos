import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect } from "react";

import { BlockedState, Button, ErrorState, LoadingState, PageShell } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getOrder } from "@/lib/waiter/order-api";

export function WaiterLegacyOrderRedirect({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { accessToken, branchId } = useAuth();
  const orderQuery = useQuery({
    queryKey: ["waiter", "legacy-order-redirect", branchId, orderId],
    enabled: Boolean(accessToken && branchId && orderId),
    queryFn: () => getOrder(accessToken as string, branchId as string, orderId),
    retry: false,
  });

  const tableId = orderQuery.data?.tableId || orderQuery.data?.table?.id;

  useEffect(() => {
    if (!tableId || !orderQuery.data) return;
    void router.replace({
      pathname: "/waiter/floor",
      query: { tableId, orderId: orderQuery.data.id },
    });
  }, [orderId, orderQuery.data, router, tableId]);

  if (orderQuery.isLoading || (orderQuery.data && tableId)) {
    return (
      <PageShell title="Returning to Floor" subtitle="Resolving this order's table context.">
        <LoadingState title="Opening table workspace" />
      </PageShell>
    );
  }

  if (orderQuery.isError) {
    if (orderQuery.error instanceof ApiError && orderQuery.error.code === "ORDER_NOT_OWNED_BY_WAITER") {
      return (
        <PageShell title="Order unavailable" subtitle="Waiter ownership is enforced.">
          <BlockedState
            title="This order belongs to another waiter"
            description="ORDER_NOT_OWNED_BY_WAITER: editable order access remains blocked."
            action={<Button onClick={() => void router.replace("/waiter/floor")}>Go to Floor</Button>}
          />
        </PageShell>
      );
    }

    return (
      <PageShell title="Order unavailable" subtitle="The legacy order link could not be resolved.">
        <ErrorState
          title="Could not resolve order table"
          description={orderQuery.error instanceof Error ? orderQuery.error.message : "Open the order from Floor."}
        />
        <Button className="w-fit" variant="secondary" onClick={() => void router.replace("/waiter/floor")}>
          Go to Floor
        </Button>
      </PageShell>
    );
  }

  if (orderQuery.data && !tableId) {
    return (
      <PageShell title="Order has no accessible table" subtitle="Orders are contextual from Floor.">
        <BlockedState
          title="No table context available"
          description="This order cannot open in the waiter Floor workflow because it has no accessible linked table."
          action={<Button onClick={() => void router.replace("/waiter/floor")}>Go to Floor</Button>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell title="Returning to Floor" subtitle="Resolving this order's table context.">
      <LoadingState title="Opening table workspace" />
    </PageShell>
  );
}
