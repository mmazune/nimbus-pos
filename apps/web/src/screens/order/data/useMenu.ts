/**
 * The menu for the order screen: one `GET /api/menu/workspace` call, then the changed-since
 * endpoint every few seconds, so a sold-out item turns grey on every open terminal within
 * ten seconds and a "3 left" counts down without reloading the menu.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { applyAvailability, loadAvailabilityChanges, loadMenu, type MenuWorkspace } from "./menu";

/** How often the terminal asks what changed. Two polls fit inside the 10-second promise. */
export const AVAILABILITY_POLL_MS = 4_000;

export const menuKey = (branchId: string | null | undefined) => ["order-screen", "menu", branchId] as const;

export function useMenu(ctx: { token: string; branchId: string } | null) {
  const qc = useQueryClient();
  const branchId = ctx?.branchId;
  // The server's cursor; until the first answer, a window back from now (re-applying a change is harmless).
  const cursorRef = useRef<string | null>(null);

  const menuQ = useQuery({
    queryKey: menuKey(branchId),
    enabled: Boolean(ctx),
    queryFn: async () => {
      const started = new Date(Date.now() - 60_000).toISOString();
      const menu = await loadMenu(ctx!.token, ctx!.branchId);
      cursorRef.current = cursorRef.current ?? started;
      return menu;
    },
    staleTime: 5 * 60_000,
  });

  useQuery({
    queryKey: ["order-screen", "menu-changes", branchId],
    enabled: Boolean(ctx && menuQ.data),
    refetchInterval: AVAILABILITY_POLL_MS,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const since = cursorRef.current ?? new Date(Date.now() - 60_000).toISOString();
      const res = await loadAvailabilityChanges(ctx!.token, ctx!.branchId, since);
      cursorRef.current = res.cursor;
      if (res.items.length) {
        qc.setQueryData<MenuWorkspace>(menuKey(branchId), (cur) => (cur ? applyAvailability(cur, res.items) : cur));
      }
      return res.items.length;
    },
  });

  return menuQ;
}

/** After a sold-out answer from the server, read what changed now instead of waiting for the next poll. */
export function refreshAvailabilityNow(qc: ReturnType<typeof useQueryClient>, branchId: string | null | undefined) {
  return qc.refetchQueries({ queryKey: ["order-screen", "menu-changes", branchId] });
}
