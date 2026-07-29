import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/waiter/floor",
    permanent: false,
  },
});

export default function WaiterOrdersPage() {
  return null;
}
