import { useId } from "react";

import { operationalIcons, operationalIconSizes, operationalIconWeights } from "@/components/pos-shell/role-icons";
import { useManagerBranch } from "@/lib/manager/branch-context";

/**
 * Manager branch switcher (M-P1, MANAGER-GAP-001) — the one genuinely new header
 * affordance in the shared operational shell.
 *
 * Implementation notes:
 * - A **native `<select>`**: keyboard operable, screen-reader labelled, and correct
 *   on touch — no custom listbox to re-implement roving focus and typeahead for.
 * - Options come from `me.memberships` (already fetched by `AuthProvider`), so the
 *   switcher costs **zero extra requests** — M-P0 explicitly preferred this over a
 *   `GET /api/branches` call.
 * - Selecting a branch updates the Manager branch context, which persists the choice
 *   and invalidates only the Manager query namespace. The new branch flows into
 *   `X-Branch-Id` on every subsequent Manager read.
 * - Presentation uses header tokens only (`bg-brand-navy-800`, `text-text-inverse`,
 *   `shadow-focus-inverse`) so it matches the premium header; no hex, no new palette.
 */
export function ManagerBranchSwitcher() {
  const { branchId, isReady, options, selectBranch } = useManagerBranch();
  const selectId = useId();
  const BranchIcon = operationalIcons.branch;
  const CaretIcon = operationalIcons.caretDown;

  if (!options.length) {
    return (
      <div
        className="flex h-10 min-w-0 items-center gap-2 rounded-md bg-brand-navy-800 px-2.5 text-sm font-semibold text-brand-silver sm:px-3"
        data-manager-branch-switcher="unavailable"
      >
        <BranchIcon
          size={operationalIconSizes.compactAction}
          weight={operationalIconWeights.default}
          aria-hidden
        />
        <span className="truncate">No branch membership</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center" data-manager-branch-switcher="ready">
      <label className="sr-only" htmlFor={selectId}>
        Active branch
      </label>
      <div className="relative flex h-10 min-w-0 items-center rounded-md bg-brand-navy-800 text-sm font-semibold text-text-inverse focus-within:shadow-focus-inverse">
        <BranchIcon
          className="pointer-events-none absolute left-2.5 hidden sm:block"
          size={operationalIconSizes.compactAction}
          weight={operationalIconWeights.default}
          aria-hidden
        />
        <select
          id={selectId}
          name="managerBranchId"
          className="h-10 min-w-0 max-w-[11rem] cursor-pointer appearance-none truncate rounded-md bg-transparent pl-2.5 pr-8 text-sm font-semibold text-text-inverse outline-none focus-visible:outline-none sm:max-w-[15rem] sm:pl-8 sm:text-base"
          value={branchId || ""}
          aria-invalid={isReady ? undefined : true}
          onChange={(event) => selectBranch(event.target.value)}
        >
          {options.map((option) => (
            // Branch name only: the closed control shows the selected option's text, and a
            // "(default)" suffix truncated the branch name in the header. The default branch
            // is marked with a badge on Manager Me instead.
            <option key={option.branchId} value={option.branchId} className="text-text-primary">
              {option.branchName}
            </option>
          ))}
        </select>
        <CaretIcon
          className="pointer-events-none absolute right-2.5 text-brand-silver"
          size={operationalIconSizes.compactAction}
          weight={operationalIconWeights.default}
          aria-hidden
        />
      </div>
    </div>
  );
}
