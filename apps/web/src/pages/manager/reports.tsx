import type { GetServerSideProps } from "next";

import { ManagerFoundationScreen } from "@/components/manager/foundation/ManagerFoundationScreen";
import { ManagerShell } from "@/components/manager/shell";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

export default function ManagerReportsPage() {
  return (
    <ManagerShell>
      <ManagerFoundationScreen
        surface="reports"
        title="Reports"
        subtitle="Report catalog, generation, run history, and export."
        scope={[
          "The report catalog with each generator's real availability status.",
          "Report generation, run history, and run detail.",
          "Export and download, with an explicit unavailable state when a generator is not implemented.",
        ]}
        boundaries={[
          "Exports are CSV only: the backend's PDF export returns a plain-text file, so no PDF download will be offered.",
          "A run's detail returns a summary and a row count but no rows, so no row table can be shown.",
          "Fake downloads are forbidden — an unavailable generator must read as unavailable.",
        ]}
      />
    </ManagerShell>
  );
}
