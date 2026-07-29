// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers for Supervisor Prompt 3B2 table transfer.
//
// The transfer-table backend (POST /pos/orders/:id/transfer-table) only moves
// order.tableId. It does NOT validate target occupancy / reservation / capacity
// and does NOT change table status. So the UI cannot promise a conflict-free
// transfer — it surfaces honest, non-blocking warnings for occupied/reserved
// targets and only hard-excludes the current table. No React / runtime imports so
// this stays unit/assertion testable.
// ─────────────────────────────────────────────────────────────────────────────

export type TransferTableTargetStatus = "available" | "occupied" | "reserved";

/** Minimal shape derived from the shared Floor table view-model. */
export type TransferTableCandidate = {
  id: string;
  label: string;
  status: TransferTableTargetStatus;
  capacity?: number | null;
  reservationTime?: string | null;
  activeOrderId?: string | null;
};

export type TransferTableTarget = TransferTableCandidate & {
  /** Concise, honest warning for a non-empty target. Never blocks selection. */
  warning: string | null;
};

/** Human-readable warning for a candidate the backend still permits. */
export function transferTargetWarning(candidate: TransferTableCandidate): string | null {
  if (candidate.status === "occupied" || candidate.activeOrderId) {
    return "Occupied — this order will be moved onto a table that already has an active order.";
  }
  if (candidate.status === "reserved") {
    return candidate.reservationTime
      ? `Reserved for ${candidate.reservationTime} — check the reservation before transferring.`
      : "Reserved — check the reservation before transferring.";
  }
  return null;
}

/**
 * Build the bounded, branch-scoped target list: exclude the current table, keep
 * label order, and annotate occupied/reserved warnings. Candidates are already
 * branch-scoped + active because they come from the normalized Floor view-model.
 */
export function buildTransferTableTargets(
  candidates: TransferTableCandidate[],
  sourceTableId: string | null | undefined,
): TransferTableTarget[] {
  return candidates
    .filter((candidate) => candidate.id !== sourceTableId)
    .map((candidate) => ({ ...candidate, warning: transferTargetWarning(candidate) }));
}

export type TransferTableValidity = { valid: boolean; reason?: string };

/** Guard at submission: a distinct target table must be chosen. */
export function validateTransferTableSelection(
  sourceTableId: string | null | undefined,
  targetTableId: string | null | undefined,
): TransferTableValidity {
  if (!targetTableId) return { valid: false, reason: "Choose a target table." };
  if (targetTableId === sourceTableId) {
    return { valid: false, reason: "The order is already at this table." };
  }
  return { valid: true };
}

/** Map a backend transfer-table failure to concise operational copy. */
export function transferTableErrorCopy(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/already at the target table/i.test(message)) {
    return "The order is already at that table. Choose a different table.";
  }
  if (/not found in this branch/i.test(message)) {
    return "That table is no longer available in this branch. Refresh the Floor and try again.";
  }
  if (/ORDER_NOT_OPEN_FOR_HANDOFF|handoff requires/i.test(message)) {
    return "This order can no longer be transferred — its status changed. Refresh and retry.";
  }
  return message || "Could not transfer the table. Retry when the connection is stable.";
}
