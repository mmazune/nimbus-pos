/**
 * The menu, in the shape `GET /api/menu/workspace` will have (T2): sections, groups,
 * sub-groups, items with servings and choices, initials and availability.
 * Today it is filled from `/api/menu/navigation` and `/api/menu/catalog`; when the
 * workspace route lands, only `loadMenu` changes.
 */
import { apiRequest } from "@/lib/api/client";

import { toMinor, type Minor } from "./money";

export type MenuAvailability =
  | { state: "available" }
  /** A counted-down number set by the kitchen or bar: shown as "3 left". */
  | { state: "low"; left: number }
  /** `since`: when it was marked (ISO), shown as "since 19:40". */
  | { state: "soldOut"; since?: string | null };

export type MenuServing = { id: string; label: string; priceMinor: Minor; isDefault: boolean };

export type MenuChoiceOption = { id: string; name: string; priceDeltaMinor: Minor };

export type MenuChoiceGroup = {
  id: string;
  name: string;
  min: number;
  /** null: no upper limit. */
  max: number | null;
  required: boolean;
  options: MenuChoiceOption[];
};

export type MenuItem = {
  id: string;
  name: string;
  /** First letter of each word, lower case: "Blended Scotch" → "bs". */
  initials: string;
  priceMinor: Minor;
  /** On offer: the usual price, shown struck beside the offer price (the server prices the line). */
  normalPriceMinor?: Minor;
  station: string | null;
  sectionKey: string | null;
  groupId: string | null;
  subgroupId: string | null;
  /** Measures (tot, double, bottle). One or none means the item is sold as one thing. */
  servings: MenuServing[];
  /** null until loaded: the catalog does not say whether an item has choices. */
  choices: MenuChoiceGroup[] | null;
  availability: MenuAvailability;
};

export type MenuGroupKind = "popular" | "offers" | "plain";

export type MenuSubgroup = { id: string; name: string; itemIds: string[] };

export type MenuGroup = {
  id: string;
  name: string;
  kind: MenuGroupKind;
  subgroups: MenuSubgroup[];
  itemIds: string[];
};

export type MenuSection = { key: string; label: string; groups: MenuGroup[] };

export type MenuWorkspace = {
  sections: MenuSection[];
  items: Record<string, MenuItem>;
  /** The server's version of this answer (`GET /api/menu/workspace`, its ETag). */
  version?: string;
};

// ── API shapes (today's routes) ──

type ApiServing = {
  id: string;
  format?: string | null;
  label?: string | null;
  price?: string | number | null;
  isDefault?: boolean | null;
  isActive?: boolean | null;
  sortOrder?: number | null;
};

type ApiCatalogItem = {
  id: string;
  name?: string | null;
  price?: string | number | null;
  station?: string | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
  browseGroup?: { id: string; section?: string | null } | null;
  browseSubgroup?: { id: string } | null;
  servings?: ApiServing[] | null;
};

type ApiCatalog = { categories?: Array<{ items?: ApiCatalogItem[] | null }> | null };

type ApiNavSection = {
  section: string;
  groups?: Array<{
    id: string;
    name?: string | null;
    sortOrder?: number | null;
    isActive?: boolean | null;
    subgroups?: Array<{ id: string; name?: string | null; sortOrder?: number | null; isActive?: boolean | null }> | null;
  }> | null;
};

type ApiChoiceGroup = {
  id: string;
  name?: string | null;
  min?: number | null;
  max?: number | null;
  required?: boolean | null;
  isActive?: boolean | null;
  sortOrder?: number | null;
  options?: Array<{ id: string; name?: string | null; priceDelta?: string | number | null; isActive?: boolean | null; sortOrder?: number | null }> | null;
};

type ApiItemDetail = { id: string; modifierGroups?: ApiChoiceGroup[] | null };

// ── Pure helpers ──

const SECTION_LABEL: Record<string, string> = { FOOD: "Food", DRINKS: "Drinks" };

export function sectionLabel(key: string): string {
  if (SECTION_LABEL[key]) return SECTION_LABEL[key];
  const words = key.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function initialsOf(name: string): string {
  return name
    .split(/[\s\-&/]+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean)
    .map((w) => w.charAt(0).toLowerCase())
    .join("");
}

export function groupKind(name: string): MenuGroupKind {
  // Group names are unique per branch across Food and Drinks, so a venue writes "Popular food" or "Popular drinks".
  const n = name.trim().toLowerCase();
  if (/^popular\b/.test(n)) return "popular";
  if (/^offers?\b/.test(n)) return "offers";
  return "plain";
}

function servingLabel(s: ApiServing): string {
  if (s.label && s.label.trim()) return s.label.trim();
  const f = (s.format ?? "").toLowerCase().replace(/_/g, " ");
  return f ? f.charAt(0).toUpperCase() + f.slice(1) : "Standard";
}

const bySort = <T extends { sortOrder?: number | null }>(a: T, b: T) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

/** Builds the workspace shape from today's two responses. Exported for tests. */
export function buildMenuWorkspace(navigation: ApiNavSection[], catalog: ApiCatalog): MenuWorkspace {
  const items: Record<string, MenuItem> = {};
  const catalogItems = (catalog.categories ?? []).flatMap((c) => c.items ?? []).sort(bySort);
  for (const raw of catalogItems) {
    if (raw.isActive === false) continue;
    const servings = (raw.servings ?? [])
      .filter((s) => s.isActive !== false)
      .sort(bySort)
      .map((s) => ({ id: s.id, label: servingLabel(s), priceMinor: toMinor(s.price) ?? 0, isDefault: Boolean(s.isDefault) }));
    const name = (raw.name ?? "").trim() || "Unnamed item";
    items[raw.id] = {
      id: raw.id,
      name,
      initials: initialsOf(name),
      priceMinor: toMinor(raw.price) ?? 0,
      station: raw.station ?? null,
      sectionKey: raw.browseGroup?.section ?? null,
      groupId: raw.browseGroup?.id ?? null,
      subgroupId: raw.browseSubgroup?.id ?? null,
      servings,
      choices: null,
      availability: { state: "available" },
    };
  }

  const all = Object.values(items);
  const sections: MenuSection[] = navigation.map((nav) => {
    const groups: MenuGroup[] = (nav.groups ?? [])
      .filter((g) => g.isActive !== false)
      .sort(bySort)
      .map((g) => {
        const name = (g.name ?? "").trim() || "Group";
        const groupItems = all.filter((i) => i.groupId === g.id);
        return {
          id: g.id,
          name,
          kind: groupKind(name),
          itemIds: groupItems.map((i) => i.id),
          subgroups: (g.subgroups ?? [])
            .filter((s) => s.isActive !== false)
            .sort(bySort)
            .map((s) => ({
              id: s.id,
              name: (s.name ?? "").trim() || "More",
              itemIds: groupItems.filter((i) => i.subgroupId === s.id).map((i) => i.id),
            }))
            .filter((s) => s.itemIds.length > 0),
        };
      })
      .filter((g) => g.itemIds.length > 0);
    // R3: "Popular" and "Offers" are the first two groups when the data has them.
    const rank = (k: MenuGroupKind) => (k === "popular" ? 0 : k === "offers" ? 1 : 2);
    groups.sort((a, b) => rank(a.kind) - rank(b.kind));
    return { key: nav.section, label: sectionLabel(nav.section), groups };
  });

  // Food first, then Drinks, then anything else (R3: two levels above the item).
  const order = (k: string) => (k === "FOOD" ? 0 : k === "DRINKS" ? 1 : 2);
  sections.sort((a, b) => order(a.key) - order(b.key));
  return { sections: sections.filter((s) => s.groups.length > 0), items };
}

export function buildChoices(detail: ApiItemDetail): MenuChoiceGroup[] {
  return (detail.modifierGroups ?? [])
    .filter((g) => g.isActive !== false)
    .sort(bySort)
    .map((g) => ({
      id: g.id,
      name: (g.name ?? "").trim() || "Choice",
      min: g.min ?? 0,
      max: g.max ?? null,
      required: Boolean(g.required) || (g.min ?? 0) > 0,
      options: (g.options ?? [])
        .filter((o) => o.isActive !== false)
        .sort(bySort)
        .map((o) => ({ id: o.id, name: (o.name ?? "").trim() || "Option", priceDeltaMinor: toMinor(o.priceDelta) ?? 0 })),
    }))
    .filter((g) => g.options.length > 0);
}

// ── Search over the whole menu: by name and by initials ──

export type SearchHit = { item: MenuItem; rank: number };

export function searchMenu(menu: MenuWorkspace, query: string, limit = 24): MenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const letters = q.replace(/[^a-z0-9]/g, "");
  const hits: SearchHit[] = [];
  for (const item of Object.values(menu.items)) {
    const name = item.name.toLowerCase();
    let rank = -1;
    if (name.startsWith(q)) rank = 0;
    else if (name.split(/\s+/).some((w) => w.startsWith(q))) rank = 1;
    else if (letters.length >= 2 && item.initials.startsWith(letters)) rank = 2;
    else if (name.includes(q)) rank = 3;
    if (rank >= 0) hits.push({ item, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name));
  return hits.slice(0, limit).map((h) => h.item);
}

// ── The workspace (T2 `GET /api/menu/workspace`): the whole menu in one call ──

export type ApiAvailability = {
  state?: "AVAILABLE" | "LOW" | "SOLD_OUT" | string | null;
  left?: number | null;
  since?: string | null;
};

type ApiWorkspaceItem = {
  id: string;
  name?: string | null;
  initials?: string | null;
  section?: string | null;
  groupId?: string | null;
  subgroupId?: string | null;
  station?: string | null;
  price?: string | number | null;
  offer?: { price?: string | number | null; note?: string | null } | null;
  servings?: ApiServing[] | null;
  choiceGroups?: ApiChoiceGroup[] | null;
  availability?: ApiAvailability | null;
};

export type ApiWorkspace = {
  version?: string;
  sections?: Array<{
    section: string;
    popular?: string[] | null;
    offers?: string[] | null;
    groups?: Array<{
      id: string;
      name?: string | null;
      sortOrder?: number | null;
      itemIds?: string[] | null;
      subgroups?: Array<{ id: string; name?: string | null; sortOrder?: number | null; itemIds?: string[] | null }> | null;
    }> | null;
    ungroupedItemIds?: string[] | null;
  }> | null;
  items?: ApiWorkspaceItem[] | null;
};

/** The server's availability, as the tile shows it: any number left reads "N left"; sold out says since when. */
export function toAvailability(a: ApiAvailability | null | undefined): MenuAvailability {
  if (!a) return { state: "available" };
  if (a.state === "SOLD_OUT") return { state: "soldOut", since: a.since ?? null };
  if (typeof a.left === "number") return { state: "low", left: a.left };
  return { state: "available" };
}

const uniq = (ids: string[]) => [...new Set(ids)];

/**
 * Builds the screen's menu from the workspace answer. Popular and Offers come from the server:
 * a group a manager named "Popular…" or "Offers…" is pinned first (R3), then the server's own list
 * (sales over 14 days, or menu order when there are none; items on offer).
 */
export function buildFromWorkspace(api: ApiWorkspace): MenuWorkspace {
  const items: Record<string, MenuItem> = {};
  for (const raw of api.items ?? []) {
    const name = (raw.name ?? "").trim() || "Unnamed item";
    const normal = toMinor(raw.price) ?? 0;
    const offer = raw.offer?.price !== undefined && raw.offer?.price !== null ? toMinor(raw.offer.price) : null;
    items[raw.id] = {
      id: raw.id,
      name,
      initials: (raw.initials ?? "").trim() || initialsOf(name),
      priceMinor: offer ?? normal,
      ...(offer !== null && offer !== normal ? { normalPriceMinor: normal } : {}),
      station: raw.station ?? null,
      sectionKey: raw.section ?? null,
      groupId: raw.groupId ?? null,
      subgroupId: raw.subgroupId ?? null,
      servings: (raw.servings ?? [])
        .filter((v) => v.isActive !== false)
        .sort(bySort)
        .map((v) => ({ id: v.id, label: servingLabel(v), priceMinor: toMinor(v.price) ?? 0, isDefault: Boolean(v.isDefault) })),
      choices: buildChoices({ id: raw.id, modifierGroups: raw.choiceGroups ?? [] }),
      availability: toAvailability(raw.availability),
    };
  }
  const known = (ids: readonly string[] | null | undefined) => (ids ?? []).filter((id) => items[id]);
  const sections: MenuSection[] = (api.sections ?? []).map((sec) => {
    const named = (sec.groups ?? []).map((g) => ({ ...g, name: (g.name ?? "").trim() || "Group" }));
    const pinned = (kind: MenuGroupKind) => named.filter((g) => groupKind(g.name) === kind).flatMap((g) => known(g.itemIds));
    const groups: MenuGroup[] = [];
    const popular = uniq([...pinned("popular"), ...known(sec.popular)]);
    if (popular.length) groups.push({ id: `popular:${sec.section}`, name: "Popular", kind: "popular", itemIds: popular, subgroups: [] });
    const offers = uniq([...pinned("offers"), ...known(sec.offers)]);
    if (offers.length) groups.push({ id: `offers:${sec.section}`, name: "Offers", kind: "offers", itemIds: offers, subgroups: [] });
    for (const g of named.filter((x) => groupKind(x.name) === "plain").sort(bySort)) {
      const itemIds = known(g.itemIds);
      if (!itemIds.length) continue;
      groups.push({
        id: g.id,
        name: g.name,
        kind: "plain",
        itemIds,
        subgroups: (g.subgroups ?? [])
          .slice()
          .sort(bySort)
          .map((sg) => ({ id: sg.id, name: (sg.name ?? "").trim() || "More", itemIds: known(sg.itemIds) }))
          .filter((sg) => sg.itemIds.length > 0),
      });
    }
    const loose = known(sec.ungroupedItemIds);
    if (loose.length) groups.push({ id: `more:${sec.section}`, name: "More", kind: "plain", itemIds: loose, subgroups: [] });
    return { key: sec.section, label: sectionLabel(sec.section), groups };
  });
  const order = (k: string) => (k === "FOOD" ? 0 : k === "DRINKS" ? 1 : 2);
  sections.sort((a, b) => order(a.key) - order(b.key));
  return { sections: sections.filter((x) => x.groups.length > 0), items, version: api.version };
}

// ── Loading ──

/** The whole menu in one call (T2 `GET /api/menu/workspace`). */
export async function loadMenu(token: string, branchId: string): Promise<MenuWorkspace> {
  return buildFromWorkspace(await apiRequest<ApiWorkspace>("/api/menu/workspace", { token, branchId }));
}

/** Items whose availability changed after `since` (T2 `GET /api/menu/availability?since=`). */
export async function loadAvailabilityChanges(
  token: string,
  branchId: string,
  since: string,
): Promise<{ cursor: string; items: Array<{ menuItemId: string; availability: ApiAvailability }> }> {
  const res = await apiRequest<{ cursor?: string; items?: Array<{ menuItemId: string; availability: ApiAvailability }> }>(
    `/api/menu/availability?since=${encodeURIComponent(since)}`,
    { token, branchId },
  );
  return { cursor: res.cursor ?? since, items: res.items ?? [] };
}

/** A copy of the menu with changed availability applied (the same object when nothing changed). */
export function applyAvailability(menu: MenuWorkspace, changes: ReadonlyArray<{ menuItemId: string; availability: ApiAvailability }>): MenuWorkspace {
  let next: Record<string, MenuItem> | null = null;
  for (const c of changes) {
    const item = (next ?? menu.items)[c.menuItemId];
    if (!item) continue;
    const availability = toAvailability(c.availability);
    if (JSON.stringify(availability) === JSON.stringify(item.availability)) continue;
    next = next ?? { ...menu.items };
    next[c.menuItemId] = { ...item, availability };
  }
  return next ? { ...menu, items: next } : menu;
}

/** One request per item, on first tap, then cached by the caller. */
export async function loadItemChoices(token: string, branchId: string, itemId: string): Promise<MenuChoiceGroup[]> {
  const detail = await apiRequest<ApiItemDetail>(`/api/menu/items/${itemId}`, { token, branchId });
  return buildChoices(detail);
}

/** "19:40" (Kampala time) for a sold-out item that says when, else undefined. */
export function soldSince(item: MenuItem): string | undefined {
  if (item.availability.state !== "soldOut" || !item.availability.since) return undefined;
  const d = new Date(item.availability.since);
  if (Number.isNaN(d.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Kampala" }).format(d);
}
