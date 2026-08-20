import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/manager/overview",
    permanent: false,
  },
});

export default function ManagerIndexPage() {
  return null;
}
