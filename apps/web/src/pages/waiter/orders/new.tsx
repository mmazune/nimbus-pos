import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const tableId = typeof query.tableId === "string" ? query.tableId : "";
  return {
    redirect: {
      destination: tableId
        ? `/waiter/floor?tableId=${encodeURIComponent(tableId)}`
        : "/waiter/floor",
      permanent: false,
    },
  };
};

export default function WaiterNewOrderPage() {
  return null;
}
