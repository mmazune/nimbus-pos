import { useRouter } from "next/router";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { BottomBar, HeaderBand, TabBar, TouchHeader, type HeaderAction } from "@/components/kit";
import { formatOperationalStaffIdentity } from "@/components/floor/formatters";
import { useAuth } from "@/lib/auth/AuthProvider";

import { useStationTerminalLabel } from "./station";
import { touchSectionKey, touchSections, type TouchRole } from "./touch-sections";

/**
 * The touch shell for waiter, cashier and supervisor (T1 / U1 part a, R8, R13).
 *
 *   ≥ 640 px  kit TouchHeader (64) + kit BottomBar (76)
 *   < 640 px  kit HeaderBand + kit TabBar (84)
 *
 * The screen inside sets its own title, one summary line, search and phone
 * actions with `useTouchHeader`; the shell adds "as at HH:MM" to the summary.
 * The manager keeps `OperationalShell` (top bar) and is not touched.
 */

export type TouchHeaderConfig = {
  title: string;
  /** "Main hall · 17 of 32 tables open". The shell adds " · as at 19:42". */
  summary?: string;
  /** When the data on screen was read (ms). "as at HH:MM" shows this, not the wall clock. */
  asAt?: number;
  /** The same line for terminals under 1280 px wide (Floor-1024: "17 of 32 open"). */
  summaryShort?: string;
  /** The header search box, where the drawing has one. */
  search?: { label: string; onOpen: () => void };
  /** Phone only: at most two round buttons in the header band. */
  phoneActions?: readonly [HeaderAction] | readonly [HeaderAction, HeaderAction];
};

type Slot = { set: (config: TouchHeaderConfig | null) => void };
const TouchHeaderSlot = createContext<Slot | null>(null);

/** A screen calls this to fill the header. Handlers are read from a ref, so they may change every render. */
export function useTouchHeader(config: TouchHeaderConfig) {
  const slot = useContext(TouchHeaderSlot);
  const latest = useRef(config);
  latest.current = config;
  const key = [config.title, config.summary ?? "", config.summaryShort ?? "", config.asAt ?? "", config.search?.label ?? "", config.phoneActions?.map((a) => a.label).join("|") ?? ""].join("¦");
  useEffect(() => {
    if (!slot) return;
    const c = latest.current;
    slot.set({
      title: c.title,
      summary: c.summary,
      summaryShort: c.summaryShort,
      asAt: c.asAt,
      search: c.search ? { label: c.search.label, onOpen: () => latest.current.search?.onOpen() } : undefined,
      phoneActions: c.phoneActions?.map((a, i) => ({
        ...a,
        onClick: () => latest.current.phoneActions?.[i]?.onClick?.(),
      })) as TouchHeaderConfig["phoneActions"],
    });
  }, [slot, key]);
  useEffect(() => () => slot?.set(null), [slot]);
}

function hhmmOf(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
}

/** True from `px` wide; false on the server and before mount. */
export function useMinWidth(px: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(`(min-width: ${px}px)`);
    const read = () => setOn(q.matches);
    read();
    q.addEventListener("change", read);
    return () => q.removeEventListener("change", read);
  }, [px]);
  return on;
}

export function withClock(summary: string | undefined, clock: string): string | undefined {
  const asAt = clock ? `as at ${clock}` : "";
  if (summary && asAt) return `${summary} · ${asAt}`;
  return summary || asAt || undefined;
}

const ROLE_WORD: Record<TouchRole, string> = { waiter: "Waiter", cashier: "Cashier", supervisor: "Supervisor" };

export type TouchShellProps = {
  role: TouchRole;
  children: ReactNode;
  /** One line under the header (a shift that is not open). Wrap it in `TouchNotice`. */
  notice?: ReactNode;
  idleHandler?: ReactNode;
};

export function TouchShell({ role, children, notice, idleHandler }: TouchShellProps) {
  const router = useRouter();
  const { displayName, logout } = useAuth();
  const station = useStationTerminalLabel();
  const [config, setConfig] = useState<TouchHeaderConfig | null>(null);
  const slot = useMemo<Slot>(() => ({ set: setConfig }), []);
  const [locking, setLocking] = useState(false);

  const sections = touchSections(role);
  const current = touchSectionKey(role, router.pathname);
  const fallbackTitle = sections.find((s) => s.key === current)?.label ?? "";
  const title = config?.title ?? fallbackTitle;
  const roomyHeader = useMinWidth(1280);
  // "as at" is when the screen's data was read; a screen with no read time gets no clock.
  const asAt = config?.asAt ? hhmmOf(config.asAt) : "";
  const summary = withClock(config?.summary, asAt);
  const terminalSummary = withClock(roomyHeader ? config?.summary : (config?.summaryShort ?? config?.summary), asAt);
  const person = {
    name: formatOperationalStaffIdentity({ displayName }) ?? displayName ?? "",
    role: ROLE_WORD[role],
    station,
  };

  async function lock() {
    if (locking) return;
    setLocking(true);
    await logout();
    window.location.replace("/login?reason=logged_out");
  }

  return (
    <TouchHeaderSlot.Provider value={slot}>
      {/* isolate + bars at -z-10: a sheet a screen opens covers the bars, never slips under them. */}
      <div className="relative isolate flex h-dvh flex-col bg-kit-canvas font-kit" data-touch-shell={role}>
        {idleHandler}
        <div className="hidden flex-none sm:block" data-touch-header="terminal">
          <TouchHeader
            title={title}
            context={terminalSummary}
            searchLabel={config?.search?.label}
            searchSize={roomyHeader ? "regular" : "small"}
            onSearch={config?.search?.onOpen}
            person={person}
            onLock={() => void lock()}
            homeHref={sections[0]?.href ?? "/"}
          />
        </div>
        <div className="flex-none sm:hidden" data-touch-header="phone">
          <HeaderBand title={title} summary={summary} actions={config?.phoneActions} />
        </div>
        {notice}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-touch-body>
          {children}
        </main>
        <div className="relative -z-10 hidden flex-none sm:block" data-touch-bar="terminal">
          <BottomBar sections={sections} currentKey={current} />
        </div>
        <div className="relative -z-10 flex-none sm:hidden" data-touch-bar="phone">
          <TabBar sections={sections} currentKey={current} />
        </div>
      </div>
    </TouchHeaderSlot.Provider>
  );
}

/** The one line under the header, with the page's gutters. */
export function TouchNotice({ children }: { children: ReactNode }) {
  return <div className="flex-none px-kit-16 pt-kit-12 sm:px-kit-32">{children}</div>;
}

/** For screens not rebuilt yet: the old page body, scrolling inside the shell with the old gutters. */
export function TouchLegacyBody({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-screen-2xl px-kit-12 py-kit-16 sm:px-kit-16 lg:px-kit-24">{children}</div>;
}
