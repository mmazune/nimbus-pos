export type LegacySupervisorOrdersQuery = {
  orderId?: string | string[];
  tableId?: string | string[];
};

export function firstLegacyQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

export function buildSupervisorFloorContextQuery(
  query: LegacySupervisorOrdersQuery,
  resolvedTableId?: string | null,
) {
  const orderId = firstLegacyQueryValue(query.orderId);
  const tableId = firstLegacyQueryValue(query.tableId) || resolvedTableId?.trim() || null;
  const floorQuery: Record<string, string> = {};

  if (tableId) floorQuery.tableId = tableId;
  if (orderId) floorQuery.orderId = orderId;

  return floorQuery;
}
