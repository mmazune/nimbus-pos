import { apiRequest } from "@/lib/api/client";

export type WaiterOrderServiceType = "DINE_IN" | "TAKEAWAY";

export type WaiterOrderApi = {
  id: string;
  orgId?: string;
  branchId?: string;
  userId?: string | null;
  tableId?: string | null;
  orderNumber?: string | null;
  status?: string | null;
  serviceType?: WaiterOrderServiceType | string | null;
  notes?: string | null;
  subtotal?: string | number | null;
  tax?: string | number | null;
  discount?: string | number | null;
  total?: string | number | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  table?: {
    id: string;
    label?: string | null;
  } | null;
  user?: {
    id?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    email?: string | null;
  } | null;
  items?: WaiterOrderItemApi[] | null;
};

export type WaiterOrdersListQuery = {
  userId?: "me" | string;
  status?: string;
  excludeStatus?: string | string[];
  serviceType?: WaiterOrderServiceType | string;
  tableId?: string;
  page?: number;
  pageSize?: number;
};

export type PaginatedWaiterOrdersResponse = {
  data: WaiterOrderApi[];
  total?: number;
  page?: number;
  pageSize?: number;
};

export type WaiterOrderItemApi = {
  id: string;
  orderId?: string;
  menuItemId?: string | null;
  menuItemServingId?: string | null;
  quantity?: number | null;
  price?: string | number | null;
  subtotal?: string | number | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  menuItem?: {
    id: string;
    name?: string | null;
    station?: string | null;
  } | null;
  menuItemServing?: {
    id: string;
    format?: string | null;
    label?: string | null;
  } | null;
};

export type WaiterMenuServingApi = {
  id: string;
  format?: string | null;
  label?: string | null;
  price?: string | number | null;
  volumeText?: string | null;
  isDefault?: boolean | null;
  isActive?: boolean | null;
  sortOrder?: number | null;
};

export type WaiterModifierOptionApi = {
  id: string;
  name?: string | null;
  priceDelta?: string | number | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

export type WaiterModifierGroupApi = {
  id: string;
  name?: string | null;
  min?: number | null;
  max?: number | null;
  required?: boolean | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
  options?: WaiterModifierOptionApi[] | null;
};

export type WaiterMenuItemApi = {
  id: string;
  name?: string | null;
  sku?: string | null;
  description?: string | null;
  price?: string | number | null;
  itemType?: string | null;
  station?: string | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
  categoryId?: string | null;
  category?: {
    id: string;
    name?: string | null;
  } | null;
  taxCategory?: {
    id: string;
    name?: string | null;
    rate?: string | number | null;
  } | null;
  browseGroup?: {
    id: string;
    name?: string | null;
    section?: string | null;
  } | null;
  browseSubgroup?: {
    id: string;
    name?: string | null;
  } | null;
  servings?: WaiterMenuServingApi[] | null;
  modifierGroups?: WaiterModifierGroupApi[] | null;
};

export type WaiterMenuNavigationSubgroupApi = {
  id: string;
  name?: string | null;
  internalKey?: string | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
};

export type WaiterMenuNavigationGroupApi = {
  id: string;
  name?: string | null;
  internalKey?: string | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
  subgroups?: WaiterMenuNavigationSubgroupApi[] | null;
};

export type WaiterMenuNavigationSectionApi = {
  section: string;
  groups?: WaiterMenuNavigationGroupApi[] | null;
};

export type WaiterMenuCategoryApi = {
  id: string;
  name?: string | null;
  sortOrder?: number | null;
  items?: WaiterMenuItemApi[] | null;
};

export type WaiterMenuCatalogApi = {
  categories?: WaiterMenuCategoryApi[] | null;
  taxCategories?: Array<{ id: string; name?: string | null; rate?: string | number | null }> | null;
};

export type WaiterMenuWorkspaceApi = {
  navigation: WaiterMenuNavigationSectionApi[];
  catalog: WaiterMenuCatalogApi;
};

export type WaiterSelectedModifierPayload = {
  modifierGroupId: string;
  modifierGroupName?: string;
  modifierOptionId: string;
  modifierOptionName?: string;
  priceDelta?: string | number | null;
};

export type WaiterOrderItemMetadata = {
  selectedModifiers?: WaiterSelectedModifierPayload[];
  servingLabel?: string;
};

export type AddOrderItemPayload = {
  menuItemId: string;
  menuItemServingId?: string;
  quantity?: number;
  notes?: string;
  metadata?: WaiterOrderItemMetadata;
};

export type UpdateOrderItemPayload = {
  quantity?: number;
  notes?: string;
  metadata?: WaiterOrderItemMetadata;
};

export type SendOrderPayload = {
  reason?: string;
};

export function createDineInOrder(token: string, branchId: string, tableId: string) {
  return apiRequest<WaiterOrderApi>("/api/pos/orders", {
    method: "POST",
    token,
    branchId,
    body: { serviceType: "DINE_IN", tableId },
  });
}

function buildOrdersQueryString(query: WaiterOrdersListQuery = {}) {
  const params = new URLSearchParams();

  if (query.userId) params.set("userId", query.userId);
  if (query.status) params.set("status", query.status);
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.tableId) params.set("tableId", query.tableId);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));

  if (query.excludeStatus) {
    const value = Array.isArray(query.excludeStatus)
      ? query.excludeStatus.join(",")
      : query.excludeStatus;
    if (value) params.set("excludeStatus", value);
  }

  const raw = params.toString();
  return raw ? `?${raw}` : "";
}

export function listWaiterOrders(
  token: string,
  branchId: string,
  query: WaiterOrdersListQuery = {},
) {
  return apiRequest<PaginatedWaiterOrdersResponse>(
    `/api/pos/orders${buildOrdersQueryString(query)}`,
    { token, branchId },
  );
}

export function getOrder(token: string, branchId: string, orderId: string) {
  return apiRequest<WaiterOrderApi>(`/api/pos/orders/${orderId}`, { token, branchId });
}

export function addOrderItem(
  token: string,
  branchId: string,
  orderId: string,
  payload: AddOrderItemPayload,
) {
  return apiRequest<WaiterOrderItemApi>(`/api/pos/orders/${orderId}/items`, {
    method: "POST",
    token,
    branchId,
    body: payload,
  });
}

export function updateOrderItem(
  token: string,
  branchId: string,
  orderId: string,
  itemId: string,
  payload: UpdateOrderItemPayload,
) {
  return apiRequest<WaiterOrderItemApi>(`/api/pos/orders/${orderId}/items/${itemId}`, {
    method: "PATCH",
    token,
    branchId,
    body: payload,
  });
}

export function deleteOrderItem(token: string, branchId: string, orderId: string, itemId: string) {
  return apiRequest<{ deleted: boolean }>(`/api/pos/orders/${orderId}/items/${itemId}`, {
    method: "DELETE",
    token,
    branchId,
  });
}

export function sendOrder(
  token: string,
  branchId: string,
  orderId: string,
  payload: SendOrderPayload = {},
) {
  return apiRequest<WaiterOrderApi>(`/api/pos/orders/${orderId}/send`, {
    method: "POST",
    token,
    branchId,
    body: payload,
  });
}

export function getMenuCatalog(token: string, branchId: string) {
  return apiRequest<WaiterMenuCatalogApi>("/api/menu/catalog", { token, branchId });
}

export function getMenuNavigation(token: string, branchId: string) {
  return apiRequest<WaiterMenuNavigationSectionApi[]>("/api/menu/navigation?activeOnly=true", {
    token,
    branchId,
  });
}

export async function loadWaiterMenuWorkspace(
  token: string,
  branchId: string,
): Promise<WaiterMenuWorkspaceApi> {
  const [navigation, catalog] = await Promise.all([
    getMenuNavigation(token, branchId),
    getMenuCatalog(token, branchId),
  ]);

  return { navigation, catalog };
}

export function getMenuItem(token: string, branchId: string, itemId: string) {
  return apiRequest<WaiterMenuItemApi>(`/api/menu/items/${itemId}`, { token, branchId });
}

export function getMenuItemServings(token: string, branchId: string, itemId: string) {
  return apiRequest<WaiterMenuServingApi[]>(`/api/menu/items/${itemId}/servings`, {
    token,
    branchId,
  });
}

export function getMenuItemModifierGroups(token: string, branchId: string, itemId: string) {
  return apiRequest<WaiterModifierGroupApi[]>(`/api/menu/items/${itemId}/modifier-groups`, {
    token,
    branchId,
  });
}

export function getModifierGroupOptions(token: string, branchId: string, groupId: string) {
  return apiRequest<WaiterModifierOptionApi[]>(`/api/menu/modifier-groups/${groupId}/options`, {
    token,
    branchId,
  });
}

export async function getMenuItemConfiguration(token: string, branchId: string, itemId: string) {
  const [item, servings, groups] = await Promise.all([
    getMenuItem(token, branchId, itemId),
    getMenuItemServings(token, branchId, itemId),
    getMenuItemModifierGroups(token, branchId, itemId),
  ]);

  const groupsWithOptions = await Promise.all(
    groups.map(async (group) => ({
      ...group,
      options: group.options?.length
        ? group.options
        : await getModifierGroupOptions(token, branchId, group.id),
    })),
  );

  return {
    ...item,
    servings: servings.length ? servings : item.servings,
    modifierGroups: groupsWithOptions.length ? groupsWithOptions : item.modifierGroups,
  };
}
