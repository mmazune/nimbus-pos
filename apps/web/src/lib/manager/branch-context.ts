import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  createElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import {
  MANAGER_BRANCH_STORAGE_KEY,
  resolveManagerBranchId,
  toManagerBranchOptions,
  type ManagerBranchOption,
} from "@/lib/manager/branch-model";
import { MANAGER_QUERY_NAMESPACE } from "@/lib/manager/state";

/**
 * Manager branch context provider (M-P1, MANAGER-GAP-001).
 *
 * The pure resolution/model half lives in `branch-model.ts` (no React, no aliases) so
 * the assertion script can exercise it directly; this file is the React binding.
 *
 * The selected branch here is the ONLY branch id Manager queries may use. It is NOT
 * `useAuth().branchId` — that is the *default* branch from `/api/auth/me` and never
 * changes. Manager reads pass `branchId` to `apiRequest`, which sets `X-Branch-Id`
 * (`lib/api/client.ts`) — no client change was needed, and the three existing roles
 * keep passing `useAuth().branchId` exactly as before.
 */

export {
  MANAGER_BRANCH_STORAGE_KEY,
  resolveManagerBranchId,
  toManagerBranchOptions,
} from "@/lib/manager/branch-model";
export type { ManagerBranchOption } from "@/lib/manager/branch-model";

export type ManagerBranchContextValue = {
  branchId: string | null;
  branchName: string;
  organizationId: string | null;
  organizationName: string;
  options: ManagerBranchOption[];
  isMultiBranch: boolean;
  isReady: boolean;
  selectBranch: (branchId: string) => void;
};

const ManagerBranchContext = createContext<ManagerBranchContextValue | null>(null);

function readStoredBranchId() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MANAGER_BRANCH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredBranchId(branchId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MANAGER_BRANCH_STORAGE_KEY, branchId);
  } catch {
    // Persistence is best-effort; an unavailable localStorage must not break switching.
  }
}

export function ManagerBranchProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const options = useMemo(() => toManagerBranchOptions(user), [user]);
  const defaultBranchId = user?.context.defaultBranchId || null;

  useEffect(() => {
    if (!options.length) {
      setSelectedBranchId(null);
      return;
    }

    setSelectedBranchId((current) => {
      if (current && options.some((option) => option.branchId === current)) return current;
      return resolveManagerBranchId(options, readStoredBranchId(), defaultBranchId);
    });
  }, [defaultBranchId, options]);

  const selectBranch = useCallback(
    (branchId: string) => {
      if (!options.some((option) => option.branchId === branchId)) return;

      setSelectedBranchId((current) => {
        if (current === branchId) return current;
        writeStoredBranchId(branchId);
        // NARROW invalidation (MANAGER-GAP-016): only the Manager namespace. Auth,
        // profile, and every other role's cache are deliberately untouched, and this
        // is never `queryClient.clear()`.
        void queryClient.invalidateQueries({ queryKey: [MANAGER_QUERY_NAMESPACE] });
        return branchId;
      });
    },
    [options, queryClient],
  );

  const value = useMemo<ManagerBranchContextValue>(() => {
    const active = options.find((option) => option.branchId === selectedBranchId) || null;

    return {
      branchId: active?.branchId || null,
      branchName: active?.branchName || "Select branch",
      organizationId: active?.organizationId || user?.context.defaultOrganizationId || null,
      organizationName: active?.organizationName || "Organization unavailable",
      options,
      isMultiBranch: options.length > 1,
      isReady: Boolean(active),
      selectBranch,
    };
  }, [options, selectBranch, selectedBranchId, user]);

  return createElement(ManagerBranchContext.Provider, { value }, children);
}

export function useManagerBranch() {
  const context = useContext(ManagerBranchContext);
  if (!context) {
    throw new Error("useManagerBranch must be used inside ManagerBranchProvider");
  }
  return context;
}
