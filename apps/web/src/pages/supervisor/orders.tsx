import type { GetServerSideProps } from "next";

import { SupervisorLegacyOrdersRedirect } from "@/components/supervisor/orders/SupervisorLegacyOrdersRedirect";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function SupervisorOrdersPage() {
  return <SupervisorLegacyOrdersRedirect />;
}
