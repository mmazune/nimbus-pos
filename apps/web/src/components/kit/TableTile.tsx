import { KitIcon } from "./KitIcon";
import { Pill, type PillTone } from "./Pill";
import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type TableState = "free" | "open" | "notSent" | "ready" | "late" | "bill" | "joined" | "reserved" | "cleaning";

const STATE: Record<TableState, { word: string; tone: PillTone }> = {
  free: { word: "Free", tone: "green" },
  open: { word: "Open", tone: "brand" },
  notSent: { word: "Not sent", tone: "amber" },
  ready: { word: "Ready", tone: "green" },
  late: { word: "Late", tone: "red" },
  bill: { word: "Bill", tone: "amber" },
  reserved: { word: "Reserved", tone: "neutral" },
  cleaning: { word: "Cleaning", tone: "neutral" },
  joined: { word: "Joined", tone: "neutral" },
};

/** States with nobody on them: a white tile with the small shadow. */
const IDLE: readonly TableState[] = ["free", "reserved", "cleaning", "joined"];

export type TableTileProps = {
  /** "4", "23", "Tab 3". Never a guest's name, an order number or a code. */
  name: string;
  state: TableState;
  /** Open on someone else's name: flat, tinted, their name in regular weight. */
  others?: boolean;
  /**
   * Roomy 108 px when the area fits; compact 84 px when it does not; phone is
   * the 84 px tile as Floor-Phone draws it (time top right, the state below).
   */
  density: "roomy" | "compact" | "phone";
  /** Roomy middle line: "4 guests · 42 min", "20:00 · 6 guests", "2 seats". */
  detail?: string;
  /** "You" or "Brian O." */
  who?: string;
  /** Total in shillings, grouped: "86,000". */
  amount?: string;
  /** Compact right-hand fact: "42 min", "2 seats". */
  short?: string;
  /** A tab for standing guests: the name is set smaller. */
  tab?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  demo?: KitDemo;
};

/**
 * "Tab 3" → { prefix: "Tab", number: "3" }; "TD-01" → { prefix: "TD", number: "01" };
 * "12" → { number: "12" }. A name with a prefix shows the prefix small above the
 * number, so a three-across phone tile never cuts it (U0 carry-over).
 */
export function splitTableName(name: string): { prefix?: string; number: string } {
  const m = /^(.*\D)(\d+)$/.exec(name.trim());
  if (!m) return { number: name };
  const prefix = m[1].replace(/[\s\-·.#]+$/, "").trim();
  return prefix ? { prefix, number: m[2] } : { number: name };
}

/** The table tile — one tile for every role (Table-Tile drawing). */
export function TableTile({ name, state, others = false, density, detail, who, amount, short, tab = false, onClick, disabled, demo }: TableTileProps) {
  const s = STATE[state];
  const tone: PillTone = state === "open" && others ? "neutral" : s.tone;
  const idle = IDLE.includes(state);
  const roomy = density === "roomy";
  const phone = density === "phone";
  const ground = others
    ? demo === "pressed"
      ? "bg-kit-tonal-2"
      : "bg-kit-tile-other active:bg-kit-tonal-2"
    : demo === "pressed"
      ? `bg-kit-canvas ${idle ? "shadow-kit-small" : "shadow-kit-raised"}`
      : `bg-kit-card active:bg-kit-canvas ${idle ? "shadow-kit-small" : "shadow-kit-raised"}`;
  const parts = splitTableName(name);
  const label = [tab || parts.prefix ? name : `Table ${name}`, s.word, detail, who, amount].filter(Boolean).join(", ");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        "flex w-full min-w-0 flex-col justify-between text-left text-kit-text font-kit",
        roomy ? "h-kit-tile rounded-kit-tile px-kit-14 py-kit-12" : "h-kit-tile-compact rounded-kit-tile-compact px-kit-12 py-kit-10",
        disabled ? "cursor-not-allowed bg-kit-neutral-t text-kit-muted" : ground,
        FOCUS,
        focusLook(demo),
        MOTION,
        TAP,
      ].join(" ")}
    >
      <span className="flex items-start justify-between gap-kit-6">
        {parts.prefix ? (
          // roomy: prefix small above the number; compact and phone (84 px tall): on one line,
          // or the number, the prefix and the pill do not fit
          <span className={roomy ? "flex min-w-0 flex-col" : "flex min-w-0 items-baseline gap-kit-4"}>
            <span className="whitespace-nowrap text-kit-bar text-kit-muted">{parts.prefix}</span>
            <span className={["whitespace-nowrap", roomy ? "text-kit-tile-no" : "text-kit-tile-no-c"].join(" ")}>{parts.number}</span>
          </span>
        ) : (
          <span className={["min-w-0 whitespace-nowrap", tab ? "text-kit-tab-no" : roomy ? "text-kit-tile-no" : "text-kit-tile-no-c"].join(" ")}>{name}</span>
        )}
        {phone ? (
          <span className="whitespace-nowrap text-kit-bar text-kit-muted">{short ?? ""}</span>
        ) : (
          <Pill tone={tone}>{s.word}</Pill>
        )}
      </span>
      {roomy ? <span className="whitespace-nowrap text-kit-small text-kit-muted">{detail ?? ""}</span> : null}
      <span
        className={[
          "flex items-baseline justify-between gap-kit-6 whitespace-nowrap",
          roomy ? "text-kit-small" : "text-kit-bar",
        ].join(" ")}
      >
        {phone ? (
          <Pill tone={tone}>{s.word}</Pill>
        ) : roomy ? (
          <>
            <span className={others ? "font-kit-regular text-kit-muted" : "font-kit-bold"}>{who ?? ""}</span>
            <span className="font-kit-semibold">{amount ?? ""}</span>
          </>
        ) : (
          <>
            {who ? (
              <span className={others ? "font-kit-regular text-kit-muted" : "font-kit-bold"}>{who}</span>
            ) : (
              <span className="font-kit-regular text-kit-muted">{short ?? ""}</span>
            )}
            {who && short ? <span className="font-kit-regular text-kit-muted">{short}</span> : null}
          </>
        )}
      </span>
    </button>
  );
}

/** "New tab": the last tile in the Tabs area. */
export function NewTabTile({ density, onClick, demo }: { density: "roomy" | "compact" | "phone"; onClick?: () => void; demo?: KitDemo }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full min-w-0 flex-col items-center justify-center gap-kit-4 text-kit-chip font-kit-bold text-kit-primary font-kit",
        density === "roomy" ? "h-kit-tile rounded-kit-tile" : "h-kit-tile-compact rounded-kit-tile-compact",
        demo === "pressed" ? "bg-kit-tonal-2" : "bg-kit-tonal active:bg-kit-tonal-2",
        FOCUS,
        focusLook(demo),
        MOTION,
        TAP,
      ].join(" ")}
    >
      <KitIcon name="plus" />
      New tab
    </button>
  );
}
