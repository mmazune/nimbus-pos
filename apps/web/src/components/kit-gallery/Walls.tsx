import { BottomBar, Button, Chip, Segmented, TableTile, TouchHeader, terminalSections } from "@/components/kit";

import { Frame } from "./Frame";
import { areas, compactHall, mainHall, type SampleTile } from "./samples";

function Wall({ tiles, density, columns, compactScreen }: { tiles: readonly SampleTile[]; density: "roomy" | "compact"; columns: number; compactScreen: boolean }) {
  return (
    <>
      <TouchHeader
        title="Floor"
        context={compactScreen ? "Main hall · 17 of 32 open · as at 19:42" : "Main hall · 17 of 32 tables open · as at 19:42"}
        searchLabel="Find a table or a tab"
        searchSize={compactScreen ? "small" : "regular"}
        person={{ name: "Amina K.", role: "Waiter", station: "Terminal 01" }}
        homeHref="#"
      />
      <main data-kit-wall={density} className={["flex min-h-0 flex-1 flex-col gap-kit-16 py-kit-16", compactScreen ? "px-kit-24" : "px-kit-32"].join(" ")}>
        <div className="flex items-center justify-between gap-kit-12">
          <div className="flex items-center gap-kit-8" aria-label="Areas">
            {areas.map((a, i) => (
              <Chip key={a.key} label={a.label} count={a.count} current={i === 0} />
            ))}
          </div>
          <div className="flex items-center gap-kit-12">
            <Segmented
              label="Whose tables"
              value="all"
              options={[
                { key: "mine", label: "My tables · 6" },
                { key: "all", label: "All tables" },
              ]}
            />
            <Button tone="tonal" icon="plus">
              New tab
            </Button>
          </div>
        </div>
        <div
          data-kit-wall-grid={density}
          className={["grid content-start", density === "roomy" ? "gap-kit-12" : "gap-kit-10"].join(" ")}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {tiles.map((t) => (
            <TableTile key={t.name} density={density} {...t} />
          ))}
        </div>
      </main>
      <BottomBar sections={terminalSections.waiter} currentKey="floor" counts={{ ready: 2 }} />
    </>
  );
}

/** 32 roomy tiles (8 × 4) in a 1280 × 800 terminal, as Main.png. */
export function RoomyWall() {
  return (
    <Frame id="wall-roomy" label="Tile wall · 32 roomy tiles, 8 × 4 · terminal" width={1280} height={800}>
      <Wall tiles={mainHall} density="roomy" columns={8} compactScreen={false} />
    </Frame>
  );
}

/** 35 compact tiles (7 × 5) on a 1024 × 768 monitor, as Floor-1024.png. */
export function CompactWall() {
  return (
    <Frame id="wall-compact" label="Tile wall · 35 compact tiles, 7 × 5 · small monitor" width={1024} height={768}>
      <Wall tiles={compactHall} density="compact" columns={7} compactScreen />
    </Frame>
  );
}
