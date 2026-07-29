import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";

import { PageShell, Skeleton } from "@/components/ui";
import { WaiterLegacyOrderRedirect } from "@/components/waiter/orders";
import { WaiterShell } from "@/components/waiter/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function WaiterOrderDetailPage() {
  const router = useRouter();
  const orderId = typeof router.query.orderId === "string" ? router.query.orderId : "";

  return (
    <WaiterShell>
      {orderId ? (
        <WaiterLegacyOrderRedirect orderId={orderId} />
      ) : (
        <PageShell title="Order" subtitle="Preparing order builder">
          <Skeleton className="h-[520px] w-full" />
        </PageShell>
      )}
    </WaiterShell>
  );
}
