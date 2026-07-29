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
