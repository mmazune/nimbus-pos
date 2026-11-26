import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { ReactNode, useEffect } from "react";

import { Button, Card, Text } from "@/components/kit";
import { TouchShell } from "@/components/pos-shell/TouchShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isBartender } from "@/lib/auth/role";
import { BAR_STATIONS, CHEF_STATIONS, loadTickets } from "@/screens/kitchen/kitchen-data";

/** The stations this person works: a bartender the bar, a chef the kitchen side; a lead sees all. */
export function useStations(): readonly string[] {
  const { user, isKitchen } = useAuth();
  if (!isKitchen) return [...CHEF_STATIONS, ...BAR_STATIONS];
  return isBartender(user) ? BAR_STATIONS : CHEF_STATIONS;
}

export const ticketsKey = (branchId: string | null | undefined, stations: readonly string[]) => ["kitchen", "tickets", branchId, stations.join(",")] as const;

/** The chef's and bartender's screen (T5): Tickets · Done · Sold out. Store waits for its engine. */
export function KitchenShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { accessToken, branchId, isAuthenticated, isLoading, isKitchen, isSupervisor, isManager, user, clearSession } = useAuth();
  const stations = useStations();
  useEffect(() => {
    if (!isLoading && (!accessToken || !isAuthenticated)) void router.replace("/login?reason=session_required");
  }, [accessToken, isAuthenticated, isLoading, router]);
  const open = useQuery({
    queryKey: ticketsKey(branchId, stations),
    enabled: Boolean(accessToken && branchId && (isKitchen || isSupervisor || isManager)),
    queryFn: () => loadTickets({ token: accessToken as string, branchId: branchId as string }, stations),
    refetchInterval: 5_000,
    staleTime: 2_000,
  });
  if (isLoading || !accessToken || !isAuthenticated) return null;
  if (!isKitchen && !isSupervisor && !isManager) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-kit-canvas p-kit-32 font-kit">
        <Card padding="roomy" label="Kitchen screen only">
          <div className="flex flex-col items-start gap-kit-12">
            <Text variant="h">Kitchen and bar screen only</Text>
            <Text variant="body" tone="muted">Sign in with a chef or bartender PIN to use it.</Text>
            <Button tone="tonal" onClick={() => { clearSession(); void router.replace("/login"); }}>Back to sign in</Button>
          </div>
        </Card>
      </main>
    );
  }
  const waiting = (open.data ?? []).filter((t) => t.status !== "READY").length;
  return (
    <TouchShell role="kitchen" roleWord={isBartender(user) ? "Bartender" : isKitchen ? "Chef" : undefined} counts={waiting ? { tickets: waiting } : undefined}>
      {children}
    </TouchShell>
  );
}
