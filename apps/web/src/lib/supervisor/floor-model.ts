import type {
  SupervisorAvailabilitySummary,
  SupervisorFloorAvailability,
  SupervisorFloorPlan,
  SupervisorTable,
  SupervisorTableStatus,
} from "@/lib/supervisor/floor";

export type SupervisorFloorFilter = "all" | "available" | "occupied" | "reserved" | "blocked" | "other";

export type SupervisorFloorCounts = Record<SupervisorFloorFilter, number> & {
  total: number;
};

export type SupervisorTableViewModel = {
  id: string;
  name: string;
  status: SupervisorFloorFilter;
  backendStatus: string;
  capacityLabel: string;
  capacityValue: number | null;
  floorPlanId: string | null;
  floorPlanName: string;
  zoneLabel: string;
  assignedServer: string;
  activeOrderSummary: string;
  currentOrderCount: number | null;
  reservedIndicator: string;
  lastUpdatedLabel: string;
  metadata: Record<string, unknown> | null;
  raw: SupervisorTable;
};

const STATUS_LABELS: Record<SupervisorFloorFilter, string> = {
  all: "All",
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  blocked: "Blocked",
  other: "Other",
};

export const supervisorFloorFilters: Array<{ value: SupervisorFloorFilter; label: string }> = [
  { value: "all", label: STATUS_LABELS.all },
  { value: "available", label: STATUS_LABELS.available },
  { value: "occupied", label: STATUS_LABELS.occupied },
  { value: "reserved", label: STATUS_LABELS.reserved },
  { value: "blocked", label: STATUS_LABELS.blocked },
  { value: "other", label: STATUS_LABELS.other },
];

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function displayText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readString(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function readNumber(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function normalizeStatus(status: string | null | undefined): SupervisorFloorFilter {
  const value = String(status || "").toUpperCase();
  if (value === "AVAILABLE") return "available";
  if (value === "OCCUPIED") return "occupied";
  if (value === "RESERVED") return "reserved";
  if (value === "CLEANING" || value === "BLOCKED" || value === "OUT_OF_SERVICE") return "blocked";
  return "other";
}

function formatStatus(status: string | null | undefined) {
  const value = String(status || "").trim();
  if (!value) return "Status unknown";
  if (value === "CLEANING") return "Cleaning / reset";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLastUpdated(value: string | null | undefined) {
  if (!value) return "Last updated unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Last updated unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sortTables(a: SupervisorTableViewModel, b: SupervisorTableViewModel) {
  const rank: Record<SupervisorFloorFilter, number> = {
    occupied: 0,
    reserved: 1,
    blocked: 2,
    available: 3,
    other: 4,
    all: 5,
  };

  if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

export function normalizeSupervisorTables(tables: SupervisorTable[]): SupervisorTableViewModel[] {
  return tables
    .filter((table) => table.isActive !== false)
    .map((table) => {
      const metadata = table.metadata || null;
      const capacity = typeof table.capacity === "number" ? table.capacity : null;
      const orderCount = readNumber(metadata, ["activeOrderCount", "orderCount", "currentOrderCount"]);
      const backendStatus = String(table.status || "");
      const normalizedStatus = normalizeStatus(table.status);

      return {
        id: table.id,
        name: displayText(table.label, "Unnamed table"),
        status: normalizedStatus,
        backendStatus: formatStatus(backendStatus),
        capacityLabel: capacity ? `${capacity} seats` : "Capacity unavailable",
        capacityValue: capacity,
        floorPlanId: table.floorPlanId || table.floorPlan?.id || null,
        floorPlanName: table.floorPlan?.name || "No floor plan",
        zoneLabel:
          readString(metadata, ["zone", "section", "area", "room"]) ||
          table.floorPlan?.name ||
          "Zone unavailable",
        assignedServer:
          readString(metadata, ["assignedServer", "serverName", "waiterName", "assignedWaiter"]) ||
          "Unassigned",
        activeOrderSummary:
          orderCount && orderCount > 0 ? `${orderCount} active order${orderCount === 1 ? "" : "s"}` : "No active order summary",
        currentOrderCount: orderCount ?? null,
        reservedIndicator:
          normalizedStatus === "reserved" ? "Reserved by table status" : "No reservation indicator",
        lastUpdatedLabel: formatLastUpdated(table.updatedAt),
        metadata,
        raw: table,
      };
    })
    .sort(sortTables);
}

export function countSupervisorTables(
  tables: SupervisorTableViewModel[],
  availability?: SupervisorFloorAvailability,
): SupervisorFloorCounts {
  const counts: SupervisorFloorCounts = {
    all: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    blocked: 0,
    other: 0,
    total: 0,
  };

  for (const table of tables) {
    counts.all += 1;
    counts.total += 1;
    counts[table.status] += 1;
  }

  const summary: SupervisorAvailabilitySummary | undefined = availability?.summary;
  if (summary && typeof summary.total === "number") {
    return {
      all: summary.total,
      total: summary.total,
      available: summary.available ?? counts.available,
      occupied: summary.occupied ?? counts.occupied,
      reserved: summary.reserved ?? counts.reserved,
      blocked: summary.cleaning ?? counts.blocked,
      other: Math.max(
        0,
        summary.total -
          (summary.available ?? 0) -
          (summary.occupied ?? 0) -
          (summary.reserved ?? 0) -
          (summary.cleaning ?? 0),
      ),
    };
  }

  return counts;
}

export function filterSupervisorTables({
  floorPlanId,
  filter,
  query,
  tables,
}: {
  floorPlanId: string | null;
  filter: SupervisorFloorFilter;
  query: string;
  tables: SupervisorTableViewModel[];
}) {
  const q = normalizeText(query);

  return tables.filter((table) => {
    if (floorPlanId && table.floorPlanId !== floorPlanId) return false;
    if (filter !== "all" && table.status !== filter) return false;
    if (!q) return true;

    const searchable = [
      table.name,
      table.backendStatus,
      table.capacityValue === null ? "" : String(table.capacityValue),
      table.floorPlanName,
      table.zoneLabel,
      table.assignedServer,
    ];

    return searchable.map(normalizeText).some((value) => value.includes(q));
  });
}

export function getFloorPlanDataSummary(plan: SupervisorFloorPlan | null | undefined) {
  if (!plan?.data) return "No coordinate metadata returned";

  const keys = Object.keys(plan.data);
  if (keys.length === 0) return "No coordinate metadata returned";
  return `${keys.length} metadata field${keys.length === 1 ? "" : "s"} returned`;
}

export function toBackendTableStatus(status: string | null | undefined): SupervisorTableStatus | null {
  const upper = String(status || "").toUpperCase();
  if (upper === "AVAILABLE" || upper === "OCCUPIED" || upper === "RESERVED" || upper === "CLEANING") {
    return upper;
  }
  return null;
}

