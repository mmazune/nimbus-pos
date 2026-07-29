import type {
  AddOrderItemPayload,
  UpdateOrderItemPayload,
  WaiterMenuCatalogApi,
  WaiterMenuItemApi,
  WaiterMenuNavigationSectionApi,
  WaiterMenuServingApi,
  WaiterModifierGroupApi,
  WaiterModifierOptionApi,
  WaiterOrderApi,
  WaiterOrderItemApi,
  WaiterOrderItemMetadata,
} from "./order-api";
import { formatWaiterDisplayName, formatWaiterMoney } from "./formatters";

export type WaiterOrderLineViewModel = {
  id: string;
  menuItemId?: string;
  menuItemServingId?: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  note?: string;
  servingLabel?: string;
  modifierSummary?: string;
  metadata?: WaiterOrderItemMetadata;
  locked: boolean;
  lockedReason?: string;
};

export type WaiterOrderViewModel = {
  id: string;
  orderNumber: string;
  tableId?: string;
  tableName?: string;
  status: string;
  serviceType?: string;
  createdAt?: string;
  elapsedLabel?: string;
  subtotal?: number;
  tax?: number;
  discount?: number;
  total?: number;
  billState?: string;
  waiterId?: string;
  waiterName?: string;
  guestName?: string;
  items: WaiterOrderLineViewModel[];
  canEditItems: boolean;
  canSend: boolean;
};

export type WaiterOrderQueueFilter = "active" | "sent" | "ready" | "served" | "closed-today";

export type WaiterOrderQueueItemViewModel = {
  id: string;
  orderNumber: string;
  tableId?: string;
  tableName: string;
  guestName: string;
  status: string;
  statusLabel: string;
  serviceType?: string;
  createdAt?: string;
  updatedAt?: string;
  elapsedLabel?: string;
  total?: number;
  formattedTotal: string;
  billState?: string;
  itemCount?: number;
  waiterId?: string;
  waiterName?: string;
  isMine: boolean;
  canOpen: boolean;
  blockedReason?: string;
};

export type WaiterMenuCategoryViewModel = {
  id: string;
  name: string;
  sortOrder: number;
  items: WaiterMenuItemViewModel[];
};

export type WaiterMenuItemViewModel = {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  browseGroupId?: string;
  browseSubgroupId?: string;
  section?: string;
  sortOrder: number;
  price?: number;
  station?: string;
  available: boolean;
  servings: WaiterMenuServingViewModel[];
  hasServingOptions: boolean;
};

export type WaiterMenuServingViewModel = {
  id: string;
  label: string;
  price?: number;
  isDefault: boolean;
  sortOrder: number;
};

export type WaiterModifierGroupViewModel = {
  id: string;
  name: string;
  min: number;
  max: number;
  required: boolean;
  sortOrder: number;
  options: WaiterModifierOptionViewModel[];
};

export type WaiterModifierOptionViewModel = {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
};

export type WaiterMenuSubgroupViewModel = {
  id: string;
  name: string;
  sortOrder: number;
};

export type WaiterMenuGroupViewModel = {
  id: string;
  name: string;
  sortOrder: number;
  subgroups: WaiterMenuSubgroupViewModel[];
};

export type WaiterMenuSectionViewModel = {
  id: string;
  name: string;
  groups: WaiterMenuGroupViewModel[];
};

export type WaiterMenuItemConfigurationViewModel = WaiterMenuItemViewModel & {
  modifierGroups: WaiterModifierGroupViewModel[];
};

export type WaiterOrderErrorCopy = {
  title: string;
  description: string;
};

const TERMINAL_ORDER_STATUSES = new Set(["CLOSED", "VOIDED"]);

function asNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function titleFromStatus(status: string | null | undefined) {
  if (!status) return "Unknown";
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatPerson(user: WaiterOrderApi["user"]) {
  if (!user) return undefined;
  if (user.displayName) return formatWaiterDisplayName(user.displayName);
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return formatWaiterDisplayName(fullName) || user.email || undefined;
}

function readMetadataString(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!metadata) return undefined;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return undefined;
}

export function formatMoney(value: number | null | undefined, currency = "UGX") {
  return formatWaiterMoney(value, currency, "Pending");
}

export function formatOrderStatus(status: string | null | undefined) {
  return titleFromStatus(status);
}

export function formatElapsed(value: string | null | undefined) {
  if (!value) return undefined;
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return undefined;

  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function getModifierSummary(metadata: Record<string, unknown> | null | undefined) {
  const selected = metadata?.selectedModifiers;
  if (!Array.isArray(selected) || selected.length === 0) return undefined;

  const names = selected
    .map((entry) => {
      if (!entry || typeof entry !== "object") return undefined;
      const option = entry as { modifierOptionName?: unknown; modifierOptionId?: unknown };
      return typeof option.modifierOptionName === "string"
        ? option.modifierOptionName
        : typeof option.modifierOptionId === "string"
          ? option.modifierOptionId
          : undefined;
    })
    .filter(Boolean);

  return names.length ? names.join(", ") : undefined;
}

function normalizeOrderLine(item: WaiterOrderItemApi, orderStatus: string): WaiterOrderLineViewModel {
  const metadata = (item.metadata || undefined) as WaiterOrderItemMetadata | undefined;
  const terminal = TERMINAL_ORDER_STATUSES.has(orderStatus);
  const servingLabel =
    metadata?.servingLabel ||
    item.menuItemServing?.label ||
    item.menuItemServing?.format ||
    undefined;

  return {
    id: item.id,
    menuItemId: item.menuItemId || item.menuItem?.id || undefined,
    menuItemServingId: item.menuItemServingId || item.menuItemServing?.id || undefined,
    name: item.menuItem?.name || "Menu item",
    quantity: item.quantity || 1,
    unitPrice: asNumber(item.price),
    lineTotal: asNumber(item.subtotal),
    note: item.notes || undefined,
    servingLabel,
    modifierSummary: getModifierSummary(item.metadata),
    metadata,
    locked: terminal,
    lockedReason: terminal ? "This item can no longer be edited." : undefined,
  };
}

export function normalizeWaiterOrder(order: WaiterOrderApi): WaiterOrderViewModel {
  const status = String(order.status || "NEW").toUpperCase();
  const billState = readMetadataString(order.metadata, ["billState", "billStatus", "bill_state"]);

  return {
    id: order.id,
    orderNumber: order.orderNumber || order.id,
    tableId: order.tableId || order.table?.id || undefined,
    tableName: order.table?.label || undefined,
    status,
    serviceType: order.serviceType || undefined,
    createdAt: order.createdAt || undefined,
    elapsedLabel: formatElapsed(order.createdAt),
    subtotal: asNumber(order.subtotal),
    tax: asNumber(order.tax),
    discount: asNumber(order.discount),
    total: asNumber(order.total),
    billState,
    waiterId: order.userId || order.user?.id || undefined,
    waiterName: formatPerson(order.user),
    guestName: readMetadataString(order.metadata, [
      "guestName",
      "customerName",
      "guest_name",
      "customer_name",
    ]),
    items: (order.items || []).map((item) => normalizeOrderLine(item, status)),
    canEditItems: !TERMINAL_ORDER_STATUSES.has(status) && status === "NEW",
    canSend: status === "NEW",
  };
}

function normalizeQueueGuestName(order: WaiterOrderApi) {
  return (
    readMetadataString(order.metadata, ["guestName", "customerName", "guest_name", "customer_name"]) ||
    "Guest not added"
  );
}

function isSameLocalDay(value: string | null | undefined, today = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function normalizeWaiterOrderQueueItem({
  order,
  currentUserId,
}: {
  order: WaiterOrderApi;
  currentUserId?: string | null;
}): WaiterOrderQueueItemViewModel {
  const status = String(order.status || "NEW").toUpperCase();
  const waiterId = order.userId || order.user?.id || undefined;
  const ownerKnown = Boolean(waiterId);
  const isMine = Boolean(currentUserId && waiterId === currentUserId);
  const canOpen = !ownerKnown || isMine;
  const total = asNumber(order.total);
  const billState = readMetadataString(order.metadata, ["billState", "billStatus", "bill_state"]);

  return {
    id: order.id,
    orderNumber: order.orderNumber || order.id,
    tableId: order.tableId || order.table?.id || undefined,
    tableName:
      order.table?.label ||
      (order.serviceType === "TAKEAWAY" ? "Takeaway" : "Table unavailable"),
    guestName: normalizeQueueGuestName(order),
    status,
    statusLabel: titleFromStatus(status),
    serviceType: order.serviceType || undefined,
    createdAt: order.createdAt || undefined,
    updatedAt: order.updatedAt || undefined,
    elapsedLabel: formatElapsed(order.createdAt) || undefined,
    total,
    formattedTotal: total === undefined ? "Total unavailable" : formatMoney(total),
    billState,
    itemCount: order.items?.length,
    waiterId,
    waiterName: formatPerson(order.user),
    isMine,
    canOpen,
    blockedReason: canOpen ? undefined : "This order belongs to another waiter.",
  };
}

export function normalizeWaiterOrderQueue(
  orders: WaiterOrderApi[],
  currentUserId?: string | null,
) {
  return orders.map((order) => normalizeWaiterOrderQueueItem({ order, currentUserId }));
}

export function filterWaiterOrderQueue(
  orders: WaiterOrderQueueItemViewModel[],
  filter: WaiterOrderQueueFilter,
  query: string,
) {
  const q = query.trim().toLowerCase();

  return orders.filter((order) => {
    const matchesFilter =
      filter !== "closed-today" || (order.status === "CLOSED" && isSameLocalDay(order.updatedAt || order.createdAt));

    if (!matchesFilter) return false;
    if (!q) return true;

    return [
      order.orderNumber,
      order.tableName,
      order.guestName,
      order.statusLabel,
      order.status,
      order.billState,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase())
      .some((value) => value.includes(q));
  });
}

function normalizeServing(serving: WaiterMenuServingApi): WaiterMenuServingViewModel {
  return {
    id: serving.id,
    label: serving.label || serving.format || "Serving",
    price: asNumber(serving.price),
    isDefault: Boolean(serving.isDefault),
    sortOrder: serving.sortOrder || 0,
  };
}

function normalizeMenuItem(
  item: WaiterMenuItemApi,
  category?: { id?: string; name?: string | null },
): WaiterMenuItemViewModel {
  const servings = (item.servings || []).map(normalizeServing);
  const activeServings = servings
    .filter((serving) => {
      const source = (item.servings || []).find((entry) => entry.id === serving.id);
      return source?.isActive !== false;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  return {
    id: item.id,
    name: item.name || "Menu item",
    description: item.description || undefined,
    categoryId: item.categoryId || item.category?.id || category?.id,
    categoryName: item.category?.name || category?.name || undefined,
    browseGroupId: item.browseGroup?.id || undefined,
    browseSubgroupId: item.browseSubgroup?.id || undefined,
    section: item.browseGroup?.section || undefined,
    sortOrder: item.sortOrder || 0,
    price: asNumber(item.price),
    station: item.station || undefined,
    available: item.isActive !== false,
    servings: activeServings,
    hasServingOptions: activeServings.length > 1,
  };
}

export function normalizeMenuCatalog(catalog: WaiterMenuCatalogApi): WaiterMenuCategoryViewModel[] {
  return (catalog.categories || [])
    .map((category) => ({
      id: category.id,
      name: category.name || "Menu",
      sortOrder: category.sortOrder || 0,
      items: (category.items || [])
        .filter((item) => item.isActive !== false)
        .map((item) => normalizeMenuItem(item, { id: category.id, name: category.name })),
    }))
    .filter((category) => category.items.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function flattenMenuCatalog(catalog: WaiterMenuCatalogApi): WaiterMenuItemViewModel[] {
  return normalizeMenuCatalog(catalog)
    .flatMap((category) => category.items)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function formatSectionName(section: string) {
  return section.replace(/_/g, " ");
}

export function normalizeMenuNavigation(
  navigation: WaiterMenuNavigationSectionApi[],
): WaiterMenuSectionViewModel[] {
  return navigation
    .map((section) => ({
      id: section.section,
      name: formatSectionName(section.section),
      groups: (section.groups || [])
        .filter((group) => group.isActive !== false)
        .map((group) => ({
          id: group.id,
          name: group.name || "Menu group",
          sortOrder: group.sortOrder || 0,
          subgroups: (group.subgroups || [])
            .filter((subgroup) => subgroup.isActive !== false)
            .map((subgroup) => ({
              id: subgroup.id,
              name: subgroup.name || "Menu subgroup",
              sortOrder: subgroup.sortOrder || 0,
            }))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    }))
    .filter((section) => section.groups.length > 0);
}

function normalizeModifierOption(option: WaiterModifierOptionApi): WaiterModifierOptionViewModel {
  return {
    id: option.id,
    name: option.name || "Option",
    priceDelta: asNumber(option.priceDelta) || 0,
    sortOrder: option.sortOrder || 0,
  };
}

function normalizeModifierGroup(group: WaiterModifierGroupApi): WaiterModifierGroupViewModel {
  return {
    id: group.id,
    name: group.name || "Options",
    min: group.min || 0,
    max: group.max || 0,
    required: Boolean(group.required || (group.min || 0) > 0),
    sortOrder: group.sortOrder || 0,
    options: (group.options || [])
      .filter((option) => option.isActive !== false)
      .map(normalizeModifierOption)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
  };
}

export function normalizeMenuItemConfiguration(
  item: WaiterMenuItemApi,
): WaiterMenuItemConfigurationViewModel {
  return {
    ...normalizeMenuItem(item),
    modifierGroups: (item.modifierGroups || [])
      .filter((group) => group.isActive !== false)
      .map(normalizeModifierGroup)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
  };
}

export function buildOrderItemMetadata({
  serving,
  groups,
  selectedOptionIds,
}: {
  serving?: WaiterMenuServingViewModel;
  groups: WaiterModifierGroupViewModel[];
  selectedOptionIds: string[];
}): WaiterOrderItemMetadata | undefined {
  const selectedModifiers = groups.flatMap((group) =>
    group.options
      .filter((option) => selectedOptionIds.includes(option.id))
      .map((option) => ({
        modifierGroupId: group.id,
        modifierGroupName: group.name,
        modifierOptionId: option.id,
        modifierOptionName: option.name,
        priceDelta: option.priceDelta.toFixed(2),
      })),
  );

  if (!selectedModifiers.length && !serving?.label) return undefined;

  return {
    ...(selectedModifiers.length ? { selectedModifiers } : {}),
    ...(serving?.label ? { servingLabel: serving.label } : {}),
  };
}

export function buildAddItemPayload({
  item,
  serving,
  quantity,
  note,
  selectedOptionIds,
}: {
  item: WaiterMenuItemConfigurationViewModel | WaiterMenuItemViewModel;
  serving?: WaiterMenuServingViewModel;
  quantity: number;
  note: string;
  selectedOptionIds: string[];
}): AddOrderItemPayload {
  const groups = "modifierGroups" in item ? item.modifierGroups : [];

  return {
    menuItemId: item.id,
    ...(serving?.id ? { menuItemServingId: serving.id } : {}),
    quantity,
    ...(note.trim() ? { notes: note.trim() } : {}),
    metadata: buildOrderItemMetadata({ serving, groups, selectedOptionIds }),
  };
}

export function buildUpdateItemPayload({
  item,
  serving,
  quantity,
  note,
  selectedOptionIds,
}: {
  item: WaiterMenuItemConfigurationViewModel;
  serving?: WaiterMenuServingViewModel;
  quantity: number;
  note: string;
  selectedOptionIds: string[];
}): UpdateOrderItemPayload {
  return {
    quantity,
    notes: note.trim(),
    metadata: buildOrderItemMetadata({
      serving,
      groups: item.modifierGroups,
      selectedOptionIds,
    }),
  };
}

export function selectedOptionIdsFromMetadata(metadata?: WaiterOrderItemMetadata) {
  return (metadata?.selectedModifiers || [])
    .map((modifier) => modifier.modifierOptionId)
    .filter(Boolean);
}

export function modifierSelectionIsValid(
  groups: WaiterModifierGroupViewModel[],
  selectedOptionIds: string[],
) {
  return groups.every((group) => {
    const count = group.options.filter((option) => selectedOptionIds.includes(option.id)).length;
    if (group.required && count < Math.max(group.min, 1)) return false;
    if (group.max > 0 && count > group.max) return false;
    return true;
  });
}
