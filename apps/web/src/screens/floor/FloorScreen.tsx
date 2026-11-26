import { useEffect, useMemo, useRef, useState } from "react";

import {
  Button,
  Card,
  Chip,
  Field,
  Row,
  RowGroup,
  Segmented,
  Sheet,
  Switcher,
  TableTile,
  Text,
} from "@/components/kit";
import { splitTableName } from "@/components/kit/TableTile";
import type { OperationalIconName } from "@/components/pos-shell/role-icons";
import { useTouchHeader } from "@/components/pos-shell/TouchShell";

import {
  buildFloorTiles,
  chooseLayout,
  COMPACT,
  findTables,
  floorAreas,
  ROOMY,
  tileWords,
  type FloorLayout,
  type FloorSource,
  type FloorTile,
  type FloorViewer,
} from "./floor-model";
import { useWide } from "./useWide";

/** Static so Tailwind keeps every one; the grid never needs an arbitrary value. */
const COLS = [
  "grid-cols-1",
  "grid-cols-1",
  "grid-cols-2",
  "grid-cols-3",
  "grid-cols-4",
  "grid-cols-5",
  "grid-cols-6",
  "grid-cols-7",
  "grid-cols-8",
  "grid-cols-9",
  "grid-cols-10",
  "grid-cols-11",
  "grid-cols-12",
] as const;

const ALL_AREAS = "__all";
const OPEN_STATES = new Set(["open", "notSent"]);

export type FloorScreenProps = {
  role: "waiter" | "cashier" | "supervisor";
  source: FloorSource | undefined;
  /** When `source` was read (ms), for "as at HH:MM". */
  readAt?: number;
  viewer: FloorViewer;
  isLoading: boolean;
  error?: { title: string; description: string } | null;
  onRetry: () => void;
  /** Exactly what tapping a table opened before the Floor was rebuilt. */
  onOpenTable: (tableId: string) => void;
  /** Cashier "Find bill", supervisor "Find order": one tonal button in the top row. */
  extraAction?: { label: string; icon: OperationalIconName; onClick: () => void };
};

function openCount(tiles: readonly FloorTile[]) {
  return tiles.filter((t) => OPEN_STATES.has(t.state)).length;
}

function Tile({ tile, density, onOpen }: { tile: FloorTile; density: "roomy" | "compact" | "phone"; onOpen: (id: string) => void }) {
  const words = tileWords(tile);
  return (
    <TableTile
      name={tile.label}
      state={tile.state}
      others={tile.others}
      density={density}
      detail={words.detail}
      short={words.short}
      who={tile.who}
      amount={density === "roomy" ? tile.amount : undefined}
      onClick={() => onOpen(tile.id)}
    />
  );
}

function Grid({ tiles, layout, phone, onOpen }: { tiles: readonly FloorTile[]; layout: FloorLayout; phone?: boolean; onOpen: (id: string) => void }) {
  const density = phone ? "phone" : layout.density;
  return (
    <div
      className={["grid", COLS[phone ? 3 : layout.columns], layout.density === "roomy" && !phone ? "gap-kit-12" : "gap-kit-10"].join(" ")}
      data-floor-grid
      data-floor-density={density}
      data-floor-columns={phone ? 3 : layout.columns}
    >
      {tiles.map((t) => (
        <div key={t.id} data-floor-tile={t.state} data-floor-table-id={t.id} data-operational-table-id={t.id}>
          <Tile tile={t} density={density} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}

export function FloorScreen({ role, source, readAt, viewer, isLoading, error, onRetry, onOpenTable, extraAction }: FloorScreenProps) {
  const wide = useWide();
  const tiles = useMemo(() => (source ? buildFloorTiles(source, viewer) : []), [source, viewer]);
  const areas = useMemo(() => floorAreas(tiles), [tiles]);
  const mineCount = useMemo(() => tiles.filter((t) => t.mine).length, [tiles]);
  const allAreasOffered = role === "supervisor" && wide.allAreas && areas.length > 1;

  const [areaPick, setAreaPick] = useState<string | null>(null);
  const area = areaPick && (areaPick === ALL_AREAS ? allAreasOffered : areas.some((a) => a.key === areaPick))
    ? areaPick
    : allAreasOffered
      ? ALL_AREAS
      : (areas[0]?.key ?? ALL_AREAS);
  const [whosePick, setWhosePick] = useState<"mine" | "all" | null>(null);
  const whose = role !== "waiter" ? "all" : (whosePick ?? (mineCount > 0 ? "mine" : "all"));
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [listingAreas, setListingAreas] = useState(false);

  const areaTiles = area === ALL_AREAS ? tiles : tiles.filter((t) => t.areaKey === area);
  const mineTiles = tiles.filter((t) => t.mine);
  const shown = whose === "mine" ? mineTiles : areaTiles;
  const areaName = area === ALL_AREAS ? "All areas" : (areas.find((a) => a.key === area)?.name ?? "");

  // an area of bar tabs ("Tab 1"…) counts tabs, not tables
  const noun = areaTiles.length && areaTiles.every((t) => splitTableName(t.label).prefix?.toLowerCase() === "tab") ? "tabs" : "tables";
  const summary = isLoading || !source
    ? undefined
    : whose === "mine"
      ? `${mineCount} ${mineCount === 1 ? "table is" : "tables are"} yours`
      : `${areaName} · ${openCount(areaTiles)} of ${areaTiles.length} ${noun} open`;

  const summaryShort = isLoading || !source || whose === "mine"
    ? summary
    : `${areaName} · ${openCount(areaTiles)} of ${areaTiles.length} open`;

  useTouchHeader({
    title: "Floor",
    summary,
    summaryShort,
    asAt: source ? readAt : undefined,
    search: { label: "Find a table", onOpen: () => setSearching(true) },
    phoneActions: [{ icon: "search", label: "Find a table", onClick: () => setSearching(true) }],
  });

  const measureRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wide.phone, isLoading]);
  const layout = chooseLayout(shown.length, box.w, box.h);

  function open(id: string) {
    setSearching(false);
    setQuery("");
    onOpenTable(id);
  }

  function stepArea(delta: number) {
    const keys = areas.map((a) => a.key);
    const i = keys.indexOf(area);
    const next = keys[(i + delta + keys.length) % keys.length];
    if (next) setAreaPick(next);
  }

  const found = findTables(tiles, query);
  const searchSheet = searching ? (
    <Sheet placement={wide.phone ? "bottom" : "middle"} title="Find a table" onClose={() => setSearching(false)}>
      <Field label="Table number" value={query} inputMode="numeric" onChange={setQuery} placeholder="For example 12" />
      {query.trim() ? (
        found.length ? (
          <div className="grid grid-cols-3 gap-kit-10">
            {found.slice(0, 9).map((t) => (
              <Tile key={t.id} tile={t} density="compact" onOpen={open} />
            ))}
          </div>
        ) : (
          <Text variant="body" tone="muted">
            No table is called {query.trim()}.
          </Text>
        )
      ) : null}
    </Sheet>
  ) : null;

  const areaSheet = listingAreas ? (
    <Sheet placement="bottom" title="Areas" onClose={() => setListingAreas(false)}>
      <RowGroup>
        {areas.map((a) => (
          <Row
            key={a.key}
            title={a.name}
            line={`${a.count} tables · ${openCount(tiles.filter((t) => t.areaKey === a.key))} open`}
            onClick={() => {
              setAreaPick(a.key);
              setListingAreas(false);
            }}
          />
        ))}
      </RowGroup>
    </Sheet>
  ) : null;

  let body: JSX.Element;
  if (error) {
    body = (
      <Card padding="roomy" label={error.title}>
        <div className="flex flex-col items-start gap-kit-12">
          <Text variant="h">{error.title}</Text>
          <Text variant="body" tone="muted">
            {error.description}
          </Text>
          <Button tone="tonal" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </Card>
    );
  } else if (isLoading || !source) {
    body = (
      <Text variant="body" tone="muted">
        Reading the floor…
      </Text>
    );
  } else if (!tiles.length) {
    body = (
      <Card padding="roomy" label="No tables">
        <div className="flex flex-col gap-kit-8">
          <Text variant="h">No tables in this branch yet</Text>
          <Text variant="body" tone="muted">
            A manager adds the branch&apos;s tables. They appear here as soon as they exist.
          </Text>
        </div>
      </Card>
    );
  } else if (wide.phone) {
    const areaFree = areaTiles.filter((t) => t.state === "free");
    const rest = whose === "mine" ? areaFree : areaTiles;
    body = (
      <div className="flex flex-col gap-kit-14">
        {role === "waiter" ? (
          <Segmented
            label="Whose tables"
            fill
            value={whose}
            onChange={(k) => setWhosePick(k as "mine" | "all")}
            options={[
              { key: "mine", label: `My tables · ${mineCount}` },
              { key: "all", label: "All tables" },
            ]}
          />
        ) : null}
        {extraAction ? (
          <Button tone="tonal" icon={extraAction.icon} onClick={extraAction.onClick}>
            {extraAction.label}
          </Button>
        ) : null}
        {whose === "mine" && mineTiles.length ? (
          <>
            <Text variant="cap" tone="muted">
              Yours
            </Text>
            <Grid tiles={mineTiles} layout={layout} phone onOpen={open} />
          </>
        ) : null}
        {areas.length ? (
          <Switcher
            label={areas.find((a) => a.key === area)?.name ?? areaName}
            detail={`· ${areaFree.length} free`}
            previousLabel="Previous area"
            nextLabel="Next area"
            onPrevious={areas.length > 1 ? () => stepArea(-1) : undefined}
            onNext={areas.length > 1 ? () => stepArea(1) : undefined}
            onOpen={() => setListingAreas(true)}
          />
        ) : null}
        <Grid tiles={rest} layout={layout} phone onOpen={open} />
      </div>
    );
  } else {
    body = (
      <div ref={measureRef} className="min-h-0 flex-1 overflow-y-auto" data-floor-space>
        <Grid tiles={shown} layout={layout} onOpen={open} />
      </div>
    );
  }

  const terminal = !wide.phone;
  return (
    <div
      className={[
        "flex min-h-0 flex-1 flex-col gap-kit-16",
        terminal ? "px-kit-32 pb-kit-16 pt-kit-16" : "px-kit-16 pb-kit-16 pt-kit-14",
      ].join(" ")}
      data-floor-role={role}
      data-floor-layout={terminal ? layout.density : "phone"}
      data-floor-fits={terminal ? String(layout.fits) : undefined}
    >
      {terminal && source && tiles.length ? (
        <div className="flex flex-wrap items-center justify-between gap-kit-12">
          <div className="flex flex-wrap items-center gap-kit-8" role="group" aria-label="Areas">
            {allAreasOffered ? (
              <Chip label="All areas" count={tiles.length} current={whose === "all" && area === ALL_AREAS} onClick={() => { setAreaPick(ALL_AREAS); setWhosePick("all"); }} />
            ) : null}
            {areas.map((a) => (
              <Chip
                key={a.key}
                label={a.name}
                count={a.count}
                current={whose === "all" && area === a.key}
                onClick={() => {
                  setAreaPick(a.key);
                  setWhosePick("all");
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-kit-12">
            {role === "waiter" ? (
              <Segmented
                label="Whose tables"
                value={whose}
                onChange={(k) => setWhosePick(k as "mine" | "all")}
                options={[
                  { key: "mine", label: `My tables · ${mineCount}` },
                  { key: "all", label: "All tables" },
                ]}
              />
            ) : null}
            {extraAction ? (
              <Button tone="tonal" icon={extraAction.icon} onClick={extraAction.onClick}>
                {extraAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {body}
      {searchSheet}
      {areaSheet}
    </div>
  );
}

export { ROOMY, COMPACT };
