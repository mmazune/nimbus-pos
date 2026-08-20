import type {
  OperationalFloorPlanOption,
  OperationalTableFilter,
  OperationalTableViewModel,
} from "./types";

export const operationalTableStatusLabels = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  blocked: "Blocked",
} as const;

export function normalizeOperationalText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/**
 * ── Table display labels (owner-approved 2026-08-20) ───────────────────────────
 *
 * Operational/demo table labels can be long ("QA-P4-PASS2-1440"), which wrapped
 * Floor card titles onto three lines. This is a **display-side** abbreviation
 * only — the persisted label is never mutated, and the full label always stays
 * available through `title` / `aria-label`.
 *
 * Rule (deterministic):
 *   1. Labels of `OPERATIONAL_TABLE_LABEL_MAX_CHARS` (7) characters or fewer are
 *      returned unchanged ("TD-01", "T-12", "BAR-3").
 *   2. Longer labels are split on `-`, `_`, `/`, `.` and whitespace.
 *   3. If the LAST segment starts with a digit it is kept whole as the trailing
 *      number ("…-1440" stays "1440"); otherwise there is no trailing number.
 *   4. Every remaining (leading) segment collapses to its first character plus
 *      any digits it contains, in order: "QA"→"Q", "P4"→"P4", "PASS2"→"P2".
 *   5. The collapsed head is concatenated, then joined to the tail with "-".
 *
 *   QA-OPEN-01       → QO-01
 *   QA-P4-CLEAN-02   → QP4C-02
 *   QA-P4-PASS2-1440 → QP4P2-1440
 *   QA-PRE-BILL-01   → QPB-01
 *
 * A single long segment with no separator keeps its first three letters plus its
 * trailing digits ("TERRACELARGE12" → "TER12").
 *
 * `buildOperationalTableLabelMap` adds collision safety **within one fetched
 * set**: colliding labels are retried at a wider abbreviation depth (2, then 3
 * characters per segment) and, if they still collide, the originals are sorted
 * ascending and the 2nd..nth get a `~n` suffix. Both steps are order-independent
 * and therefore stable across re-renders.
 */
export const OPERATIONAL_TABLE_LABEL_MAX_CHARS = 7;

const OPERATIONAL_TABLE_LABEL_SEPARATORS = /[\s\-_/.]+/;

function abbreviateOperationalSegment(segment: string, depth: number) {
  const digits = segment.replace(/\D/g, "");
  const head = segment.slice(0, Math.max(1, depth));
  // A segment that already starts with a digit is a number — keep it whole.
  if (/^\d/.test(segment)) return segment;
  if (!digits) return head;
  // Avoid duplicating digits that the head already captured (e.g. depth 3 "P4X").
  return `${head.replace(/\d/g, "")}${digits}`;
}

export function formatOperationalTableLabel(
  value: string | null | undefined,
  depth = 1,
): string {
  const label = normalizeOperationalText(value);
  if (!label) return "";
  if (label.length <= OPERATIONAL_TABLE_LABEL_MAX_CHARS) return label;

  const segments = label.split(OPERATIONAL_TABLE_LABEL_SEPARATORS).filter(Boolean);
  if (segments.length === 0) return label;

  if (segments.length === 1) {
    const single = segments[0];
    const letters = single.replace(/\d/g, "").slice(0, Math.max(3, depth + 2));
    const digits = single.replace(/\D/g, "");
    const compact = `${letters}${digits}`;
    return compact.length < single.length ? compact : single;
  }

  const last = segments[segments.length - 1];
  const hasNumericTail = /^\d/.test(last);
  const headSegments = hasNumericTail ? segments.slice(0, -1) : segments;
  const head = headSegments
    .map((segment) => abbreviateOperationalSegment(segment, depth))
    .join("");

  const compact = hasNumericTail ? `${head}-${last}` : head;
  return compact.length < label.length ? compact : label;
}

/**
 * Collision-safe display labels for one fetched set of table labels.
 * Returns a Map keyed by the ORIGINAL label.
 */
export function buildOperationalTableLabelMap(
  labels: readonly (string | null | undefined)[],
): Map<string, string> {
  const originals = [...new Set(labels.map((value) => normalizeOperationalText(value)).filter(Boolean))];
  const result = new Map<string, string>();

  let pending = originals;
  for (let depth = 1; depth <= 3 && pending.length > 0; depth += 1) {
    const grouped = new Map<string, string[]>();
    pending.forEach((original) => {
      const abbreviated = formatOperationalTableLabel(original, depth);
      const bucket = grouped.get(abbreviated);
      if (bucket) bucket.push(original);
      else grouped.set(abbreviated, [original]);
    });

    const stillColliding: string[] = [];
    grouped.forEach((bucket, abbreviated) => {
      // A bucket collides only if several DIFFERENT originals share it, and it must
      // also not clash with an abbreviation already assigned at a shallower depth.
      const clashesWithAssigned = [...result.values()].includes(abbreviated);
      if (bucket.length === 1 && !clashesWithAssigned) {
        result.set(bucket[0], abbreviated);
        return;
      }
      stillColliding.push(...bucket);
    });

    pending = stillColliding;
  }

  // Deterministic last resort: sort the survivors and suffix the 2nd..nth.
  const leftovers = new Map<string, string[]>();
  [...pending].sort((a, b) => a.localeCompare(b)).forEach((original) => {
    const abbreviated = formatOperationalTableLabel(original);
    const bucket = leftovers.get(abbreviated);
    if (bucket) bucket.push(original);
    else leftovers.set(abbreviated, [original]);
  });
  leftovers.forEach((bucket, abbreviated) => {
    bucket.forEach((original, index) => {
      result.set(original, index === 0 ? abbreviated : `${abbreviated}~${index + 1}`);
    });
  });

  return result;
}

export function formatOperationalStaffName(value: string | null | undefined) {
  const parts = normalizeOperationalText(value).split(" ").filter(Boolean);
  if (parts.length <= 1) return parts[0] || "";

  const firstName = parts[0];
  const surname = parts[parts.length - 1];
  return `${firstName} ${surname.charAt(0).toUpperCase()}.`;
}

export function formatOperationalStaffIdentity({
  displayName,
  email,
  firstName,
  lastName,
}: {
  displayName?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const preferredName = normalizeOperationalText(displayName)
    || normalizeOperationalText([firstName, lastName].filter(Boolean).join(" "));
  if (preferredName) return formatOperationalStaffName(preferredName);

  const safeEmail = normalizeOperationalText(email);
  return safeEmail || null;
}

export function countOperationalTables<T extends OperationalTableViewModel>(tables: T[]) {
  return tables.reduce<Record<OperationalTableFilter, number>>(
    (counts, table) => {
      counts.all += 1;
      if (table.status !== "blocked") counts[table.status] += 1;
      if (table.isMine) counts.mine += 1;
      return counts;
    },
    { all: 0, available: 0, occupied: 0, reserved: 0, mine: 0 },
  );
}

export function getOperationalFloorPlans<T extends OperationalTableViewModel>(tables: T[]) {
  const plans = new Map<string, OperationalFloorPlanOption>();
  tables.forEach((table) => {
    if (!table.floorPlanId) return;
    plans.set(table.floorPlanId, {
      id: table.floorPlanId,
      name: normalizeOperationalText(table.floorPlanName) || "Floor plan",
    });
  });

  return [...plans.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterOperationalTables<T extends OperationalTableViewModel>({
  filter,
  floorPlanId,
  query,
  tables,
}: {
  filter: OperationalTableFilter;
  floorPlanId: string | null;
  query: string;
  tables: T[];
}) {
  const needle = normalizeOperationalText(query).toLowerCase();

  return tables.filter((table) => {
    if (floorPlanId && table.floorPlanId !== floorPlanId) return false;
    if (filter !== "all" && (filter === "mine" ? !table.isMine : table.status !== filter)) {
      return false;
    }
    if (!needle) return true;

    return [table.label, table.assignedStaffName, table.floorPlanName]
      .map((value) => normalizeOperationalText(value).toLowerCase())
      .some((value) => value.includes(needle));
  });
}

export function sortOperationalTables<T extends OperationalTableViewModel>(tables: T[]) {
  const rank = { occupied: 0, reserved: 1, blocked: 2, available: 3 } as const;
  return [...tables].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
  });
}
