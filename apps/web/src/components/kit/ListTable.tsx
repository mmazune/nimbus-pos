import type { ReactNode } from "react";

import { FOCUS, MOTION, TAP } from "./states";

/**
 * A laptop/terminal table inside one card (standards §5A.5; drawing
 * Cashier-Receipts): a 44 px header of small muted labels, 56 px rows, the
 * first column bold, numbers right-aligned with even-width figures, no zebra.
 * Each row is one button that opens the record beside the list. Columns share a
 * 12-part grid, so no width is ever an arbitrary value.
 */
export type ListTableColumn = {
  key: string;
  label: string;
  /** Parts of 12. The spans of all columns add up to 12. */
  span: 1 | 2 | 3 | 4 | 5 | 6;
  align?: "start" | "end";
};

export type ListTableRow = {
  id: string;
  /** One cell per column key: text only, never a control. */
  cells: Record<string, string>;
  /** Read aloud for the row button. */
  label: string;
};

const SPAN: Record<ListTableColumn["span"], string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
};

export type ListTableProps = {
  label: string;
  columns: readonly ListTableColumn[];
  rows: readonly ListTableRow[];
  currentId?: string;
  onOpen?: (id: string) => void;
  /** Shown in place of rows when there are none (a sentence and who fixes it). */
  empty?: ReactNode;
};

export function ListTable({ label, columns, rows, currentId, onOpen, empty }: ListTableProps) {
  const cell = (c: ListTableColumn, i: number) =>
    [SPAN[c.span], "min-w-0 break-words", c.align === "end" ? "text-right tabular-nums" : "text-left", i === 0 ? "font-kit-bold" : ""].join(" ");
  return (
    <section aria-label={label} className="overflow-hidden rounded-kit-card bg-kit-card shadow-kit-raised font-kit">
      <div className="grid h-kit-target grid-cols-12 items-center gap-kit-12 border-b border-kit-line px-kit-16 text-kit-small font-kit-semibold text-kit-muted" aria-hidden="true">
        {columns.map((c, i) => (
          <span key={c.key} className={cell(c, i).replace("font-kit-bold", "")}>
            {c.label}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="px-kit-16 py-kit-20">{empty}</div>
      ) : (
        <div className="flex flex-col divide-y divide-kit-line">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-label={r.label}
              aria-current={r.id === currentId ? "true" : undefined}
              onClick={() => onOpen?.(r.id)}
              className={[
                "grid min-h-kit-cell w-full grid-cols-12 items-center gap-kit-12 px-kit-16 py-kit-8 text-left text-kit-body text-kit-text",
                r.id === currentId ? "bg-kit-canvas" : "active:bg-kit-canvas",
                FOCUS,
                MOTION,
                TAP,
              ].join(" ")}
            >
              {columns.map((c, i) => (
                <span key={c.key} className={cell(c, i)}>
                  {r.cells[c.key] ?? ""}
                </span>
              ))}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
