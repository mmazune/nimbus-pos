import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/cashier/floor",
    permanent: false,
  },
});

export default function CashierIndexPage() {
  return null;
}
