import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useMemo, useState, type ReactNode } from "react";

import {
  Banner,
  Button,
  Card,
  Field,
  OptionTile,
  Pill,
  Row,
  RowGroup,
  Segmented,
  Sheet,
  Switcher,
  Text,
} from "@/components/kit";
import { useTouchHeader } from "@/components/pos-shell/TouchShell";
import { ApiError, apiRequest, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  assignSupervisorReservationTable,
  cancelSupervisorReservation,
  completeSupervisorReservation,
  confirmSupervisorReservation,
  createSupervisorReservation,
  fetchSupervisorActiveReservations,
  fetchSupervisorReservationHistory,
  markSupervisorReservationNoShow,
  seatSupervisorReservation,
  type SupervisorReservation,
} from "@/lib/supervisor/reservations";

import { buildFloorTiles, groupCents, toCents, type FloorTableApi, type FloorTile } from "../floor/floor-model";
import { loadAllActiveOrders } from "../floor/floor-data";
import { useWide } from "../floor/useWide";
import { errorWords } from "../shared/words";
import {
  actionsFor,
  dayLabel,
  guestName,
  hhmm,
  isoDay,
  needsAttention,
  panelLine,
  rowLine,
  rowPill,
  seatOptions,
  summaryLine,
  tableName,
  tileName,
  toInstant,
  viewOf,
  type ResView,
} from "./reservations-model";

type Role = "waiter" | "supervisor";
const KEY = ["t1", "reservations"] as const;
const VIEWS: Record<Role, readonly ResView[]> = {
  waiter: ["arriving", "seated"],
  supervisor: ["arriving", "seated", "attention", "history"],
};
const VIEW_WORD: Record<ResView, string> = { arriving: "Arriving", seated: "Seated", attention: "Attention", history: "History" };
const HISTORY_PAGE = 25;

/** Every page of a paged list (100 a page, at most 10 pages), so counts are never cut at one page. */
async function allPages(load: (page: number) => Promise<{ data: SupervisorReservation[]; total: number }>) {
  const first = await load(1);
  const rows = [...(first.data ?? [])];
  for (let page = 2; rows.length < (first.total ?? 0) && page <= 10; page += 1) {
    const next = await load(page);
    if (!next.data?.length) break;
    rows.push(...next.data);
  }
  return { ...first, data: rows };
}

function errorText(e: unknown): string {
  return errorWords(e);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-kit-target items-center justify-between gap-kit-12">
      <Text variant="sup" tone="muted">
        {label}
      </Text>
      <Text variant="body" strong align="end">
        {value}
      </Text>
    </div>
  );
}

/** Deposits held now: only RECEIVED ones can be given back or kept (the service acts on RECEIVED only). */
function heldDeposit(r: SupervisorReservation): bigint {
  return (r.deposits ?? [])
    .filter((d) => String(d.status ?? "").toUpperCase() === "RECEIVED")
    .reduce((acc, d) => acc + toCents(d.amount), 0n);
}

function depositWords(r: SupervisorReservation): string | undefined {
  const received = (r.deposits ?? [])
    .filter((d) => ["RECEIVED", "APPLIED"].includes(String(d.status ?? "").toUpperCase()))
    .reduce((acc, d) => acc + toCents(d.amount), 0n);
  if (received > 0n) return `UGX ${groupCents(received)} received`;
  const asked = toCents(r.depositRequired);
  if (asked > 0n) return `UGX ${groupCents(asked)} asked, not received`;
  return undefined;
}

export function ReservationsScreen({ role }: { role: Role }) {
  const router = useRouter();
  const qc = useQueryClient();
  const wide = useWide();
  const { accessToken, branchId } = useAuth();
  const ready = Boolean(accessToken && branchId);
  const token = accessToken as string;
  const branch = branchId as string;
  const today = isoDay();
  const now = new Date();
  const dateParam = typeof router.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(router.query.date) ? router.query.date : today;
  const day = role === "supervisor" ? dateParam : today;

  const viewParam = typeof router.query.view === "string" ? (router.query.view as ResView) : "arriving";
  const view: ResView = VIEWS[role].includes(viewParam) ? viewParam : "arriving";
  const selectedId = typeof router.query.id === "string" ? router.query.id : undefined;
  const [historyPage, setHistoryPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "create" | "cancel" | "noShow" | "changeTable" | "detail">(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [noShowOutcome, setNoShowOutcome] = useState<"FORFEIT" | "REFUND">("FORFEIT");

  const todayQ = useQuery({
    queryKey: [...KEY, "today", branch, day],
    enabled: ready,
    queryFn: () => allPages((page) => fetchSupervisorActiveReservations(token, branch, { date: day, page, pageSize: 100 })),
    retry: shouldRetryApiRequest,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const activeQ = useQuery({
    queryKey: [...KEY, "active", branch],
    enabled: ready && role === "supervisor",
    queryFn: () => allPages((page) => fetchSupervisorActiveReservations(token, branch, { page, pageSize: 100 })),
    retry: shouldRetryApiRequest,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const historyQ = useQuery({
    queryKey: [...KEY, "history", branch, historyPage],
    enabled: ready && role === "supervisor" && view === "history",
    queryFn: () => fetchSupervisorReservationHistory(token, branch, { page: historyPage, pageSize: HISTORY_PAGE }),
    retry: shouldRetryApiRequest,
    staleTime: 15_000,
  });
  const floorQ = useQuery({
    queryKey: [...KEY, "floor", branch],
    enabled: ready,
    queryFn: async () => {
      const [tables, activeOrders] = await Promise.all([
        apiRequest<FloorTableApi[]>("/api/tables", { token, branchId: branch }),
        loadAllActiveOrders<Record<string, unknown> & { id: string }>(token, branch),
      ]);
      return buildFloorTiles({ tables, activeOrders, reservations: [] }, { ownership: "names" });
    },
    retry: shouldRetryApiRequest,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const tiles: FloorTile[] = useMemo(() => floorQ.data ?? [], [floorQ.data]);

  const todayRows = useMemo(() => todayQ.data?.data ?? [], [todayQ.data]);
  const activeRows = useMemo(() => activeQ.data?.data ?? [], [activeQ.data]);
  const byTime = (a: SupervisorReservation, b: SupervisorReservation) =>
    String(a.reservationAt ?? "").localeCompare(String(b.reservationAt ?? ""));
  const lists: Record<ResView, SupervisorReservation[]> = {
    arriving: todayRows.filter((r) => viewOf(r) === "arriving").sort(byTime),
    seated: (role === "supervisor" ? activeRows : todayRows).filter((r) => viewOf(r) === "seated").sort(byTime),
    attention: activeRows.filter(needsAttention).sort(byTime),
    history: historyQ.data?.data ?? [],
  };
  const rows = lists[view];
  const all = [...todayRows, ...activeRows, ...lists.history];
  // A booking that just left its list (cancelled, completed) stays in the panel, as the API last returned it.
  const [lastSeen, setLastSeen] = useState<SupervisorReservation | undefined>();
  const selected = all.find((r) => r.id === selectedId) ?? (lastSeen?.id === selectedId ? lastSeen : undefined);

  useTouchHeader({
    title: "Reservations",
    summary: todayQ.data ? (day === today ? summaryLine(todayRows) : `${dayLabel(`${day}T12:00:00`)} · ${lists.arriving.length} booked`) : undefined,
    asAt: todayQ.data ? todayQ.dataUpdatedAt : undefined,
    // On a phone four choices do not fit the width; History moves to the header.
    phoneActions:
      role === "supervisor"
        ? [view === "history"
            ? { icon: "today", label: "Back to today", onClick: () => go({ view: "arriving", id: null }) }
            : { icon: "time", label: "History", onClick: () => go({ view: "history", id: null }) }]
        : undefined,
  });

  function go(next: { view?: ResView; id?: string | null; date?: string | null }) {
    const q: Record<string, string> = {};
    const v = next.view ?? view;
    if (v !== "arriving") q.view = v;
    const d = next.date === undefined ? (day !== today ? day : null) : next.date;
    if (d && d !== today) q.date = d;
    const id = next.id === undefined ? selectedId : next.id;
    if (id) q.id = id;
    void router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true, scroll: false });
  }

  function select(r: SupervisorReservation) {
    setNotice(null);
    setFailure(null);
    setChoice(null);
    go({ id: r.id });
    if (wide.phone) setSheet("detail");
  }

  function refresh() {
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: [role, "floor", branchId] });
    void qc.invalidateQueries({ queryKey: [role, "reservations"] });
  }

  const act = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onMutate: () => {
      setNotice(null);
      setFailure(null);
    },
    onError: (e) => setFailure(errorText(e)),
    onSettled: refresh,
  });
  function run(fn: () => Promise<unknown>, done: string, after?: () => void) {
    act.mutate(fn, {
      onSuccess: (data) => {
        const row = data as SupervisorReservation | undefined;
        if (row && typeof row === "object" && "id" in row && row.id === selectedId) {
          setLastSeen({ ...(selected ?? {}), ...row } as SupervisorReservation);
        }
        setNotice(done);
        // On a phone the booking sheet stays open to show what happened; on a terminal the side panel does.
        setSheet(wide.phone ? "detail" : null);
        after?.();
      },
    });
  }

  // ── the side panel (terminal) or the detail sheet (phone) ──
  function panel(r: SupervisorReservation): ReactNode {
    const pill = rowPill(r, tiles.find((t) => t.id === r.tableId), now);
    const actions = actionsFor(r, role);
    const booked = tiles.find((t) => t.id === r.tableId);
    const bookedBusy = booked && (booked.state === "open" || booked.state === "notSent");
    const options = actions.has("seat") ? seatOptions(r, tiles) : [];
    const picked = options.find((t) => t.id === choice) ?? options[0];
    const note = [r.notes, r.specialRequests].filter(Boolean).join(" ");
    const deposit = role === "supervisor" ? depositWords(r) : undefined;
    let primary: ReactNode = null;
    if (actions.has("seat") && picked) {
      primary = (
        <Button tone="filled" disabled={act.isPending} onClick={() => run(() => seatSupervisorReservation(token, branch, r.id, role === "waiter" ? { tableId: picked.id, createOrder: true } : { tableId: picked.id }), `Seated at ${tileName(picked)}.`)}>
          {`Seat at ${tileName(picked).replace(/^Table /, "table ")}`}
        </Button>
      );
    } else if (actions.has("confirm")) {
      primary = (
        <Button tone="filled" disabled={act.isPending} onClick={() => run(() => confirmSupervisorReservation(token, branch, r.id), "Booking confirmed.")}>
          Confirm booking
        </Button>
      );
    } else if (actions.has("complete")) {
      primary = (
        <Button tone="filled" disabled={act.isPending} onClick={() => run(() => completeSupervisorReservation(token, branch, r.id), "Booking completed.")}>
          Complete booking
        </Button>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-kit-12" data-res-panel={r.id}>
        <div className="flex items-start gap-kit-12">
          <div className="min-w-0 flex-1">
            <Text variant="h" as="h2">
              {guestName(r)}
            </Text>
            <Text variant="sup" tone="muted">
              {[viewOf(r) === "history" ? dayLabel(r.reservationAt) : "", panelLine(r)].filter(Boolean).join(" · ")}
            </Text>
          </div>
          <Pill tone={pill.tone}>{pill.word}</Pill>
        </div>
        {bookedBusy && viewOf(r) === "arriving" ? (
          <Banner tone="amber" title={`${tableName(r)} is not free.`} detail={[booked.minutes ? `Open ${booked.minutes}` : "", booked.who ?? ""].filter(Boolean).join(" · ")} />
        ) : null}
        {notice ? (
          <Text variant="body" tone="green" strong>
            {notice}
          </Text>
        ) : null}
        {failure ? <Banner tone="red" title={failure} /> : null}
        {actions.has("seat") ? (
          options.length ? (
            <div className="flex flex-col gap-kit-8">
              <Text variant="sup" strong>
                {`Free now, seats ${r.partySize ?? 1} or more`}
              </Text>
              <div className="grid grid-cols-2 gap-kit-8">
                {options.map((t) => (
                  <OptionTile key={t.id} label={tileName(t)} second={[t.seats ? `${t.seats} seats` : "", t.areaName].filter(Boolean).join(" · ")} current={picked?.id === t.id} onClick={() => setChoice(t.id)} />
                ))}
              </div>
            </div>
          ) : (
            <Text variant="body" tone="muted">
              {`No free table seats ${r.partySize ?? 1} right now.`}
            </Text>
          )
        ) : null}
        {role === "waiter" && String(r.status).toUpperCase() === "PENDING" ? (
          <Text variant="body" tone="muted">
            A supervisor confirms this booking before it can be seated.
          </Text>
        ) : null}
        <div className="flex flex-col">
          {note ? <Fact label="Note" value={note} /> : null}
          {role === "supervisor" && r.customerPhone ? <Fact label="Phone" value={r.customerPhone} /> : null}
          {deposit ? <Fact label="Deposit" value={deposit} /> : null}
          {r.table && viewOf(r) !== "arriving" ? <Fact label="Table" value={tableName(r) ?? ""} /> : null}
        </div>
        <span className="flex-1" />
        {role === "waiter" ? (
          <Text variant="small" tone="muted">
            To change or cancel a booking, ask a supervisor.
          </Text>
        ) : null}
        {actions.has("changeTable") || actions.has("cancel") || actions.has("noShow") ? (
          <div className="flex flex-wrap items-center gap-kit-8">
            {actions.has("changeTable") ? (
              <Button tone="tonal" size="laptop" fill onClick={() => { setChoice(null); setSheet("changeTable"); }}>
                Change table
              </Button>
            ) : null}
            {actions.has("noShow") ? (
              <Button tone="text" size="laptop" onClick={() => setSheet("noShow")}>
                No-show
              </Button>
            ) : null}
            {actions.has("cancel") ? (
              <Button tone="danger" size="laptop" onClick={() => setSheet("cancel")}>
                Cancel booking
              </Button>
            ) : null}
          </div>
        ) : null}
        {primary}
      </div>
    );
  }

  // ── list ──
  const loading = todayQ.isLoading || (view === "history" && historyQ.isLoading) || (role === "supervisor" && activeQ.isLoading && view !== "arriving");
  const loadError = todayQ.error ?? (role === "supervisor" ? activeQ.error : null) ?? (view === "history" ? historyQ.error : null);
  const list = (
    <Card label={VIEW_WORD[view]}>
      {loading ? (
        <div className="p-kit-16">
          <Text variant="body" tone="muted">
            Reading the bookings…
          </Text>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-kit-12 p-kit-16">
          <Text variant="body">{errorText(loadError)}</Text>
          <Button tone="tonal" onClick={() => void qc.invalidateQueries({ queryKey: KEY })}>
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="p-kit-16">
          <Text variant="body" tone="muted">
            {view === "arriving"
              ? day === today
                ? "No more bookings today."
                : "No bookings that day."
              : view === "seated"
                ? "Nobody from a booking is seated now."
                : view === "attention"
                  ? "Nothing needs a look."
                  : "No past bookings yet."}
          </Text>
        </div>
      ) : (
        <RowGroup>
          {rows.map((r) => {
            const pill = rowPill(r, tiles.find((t) => t.id === r.tableId), now);
            return (
              <Row
                key={r.id}
                size="tall"
                leading={hhmm(r.reservationAt)}
                title={guestName(r)}
                line={view === "history" ? `${dayLabel(r.reservationAt)} · ${rowLine(r)}` : rowLine(r)}
                trailing={<Pill tone={pill.tone}>{pill.word}</Pill>}
                chevron
                current={r.id === selectedId}
                onClick={() => select(r)}
              />
            );
          })}
        </RowGroup>
      )}
    </Card>
  );

  const counts: Record<ResView, string> = {
    arriving: `Arriving · ${lists.arriving.length}`,
    seated: `Seated · ${lists.seated.length}`,
    attention: `Attention · ${lists.attention.length}`,
    history: "History",
  };
  const segmented = (
    <Segmented
      label="Bookings"
      fill={wide.phone}
      value={view}
      onChange={(k) => {
        setNotice(null);
        go({ view: k as ResView, id: null });
      }}
      options={VIEWS[role].filter((v) => !(wide.phone && v === "history")).map((v) => ({ key: v, label: wide.phone && v !== "history" ? `${VIEW_WORD[v]} ${lists[v].length}` : counts[v] }))}
    />
  );
  function stepDay(delta: number) {
    const [y, m, d] = day.split("-").map(Number);
    const next = isoDay(new Date(y, m - 1, d + delta));
    go({ date: next, id: null });
  }
  const dayStep =
    role === "supervisor" && view === "arriving" ? (
      <Switcher
        label={day === today ? "Today" : dayLabel(`${day}T12:00:00`)}
        detail={`· ${lists.arriving.length} booked`}
        previousLabel="Previous day"
        nextLabel="Next day"
        onPrevious={() => stepDay(-1)}
        onNext={() => stepDay(1)}
        onOpen={() => go({ date: null, id: null })}
      />
    ) : null;
  const historyPager =
    view === "history" && historyQ.data && historyQ.data.total > HISTORY_PAGE ? (
      <div className="flex items-center justify-between gap-kit-12">
        <Button tone="tonal" size="laptop" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => p - 1)}>
          Newer
        </Button>
        <Text variant="sup" tone="muted">
          {`Page ${historyPage} of ${Math.ceil(historyQ.data.total / HISTORY_PAGE)}`}
        </Text>
        <Button tone="tonal" size="laptop" disabled={historyPage * HISTORY_PAGE >= historyQ.data.total} onClick={() => setHistoryPage((p) => p + 1)}>
          Older
        </Button>
      </div>
    ) : null;

  // ── sheets ──
  const sheetPlace = wide.phone ? "bottom" : "middle";
  let sheetNode: ReactNode = null;
  if (sheet === "detail" && selected && wide.phone) {
    sheetNode = (
      <Sheet placement="bottom" title={guestName(selected)} onClose={() => setSheet(null)}>
        {panel(selected)}
      </Sheet>
    );
  } else if (sheet === "changeTable" && selected) {
    const options = seatOptions(selected, tiles, 8);
    const picked = options.find((t) => t.id === choice) ?? options.find((t) => t.id !== selected.tableId);
    sheetNode = (
      <Sheet
        placement={sheetPlace}
        title="Change table"
        summary={`${guestName(selected)} · ${selected.partySize ?? 1} guests · now ${tableName(selected) ?? "no table"}`}
        onClose={() => setSheet(null)}
        footer={
          <>
            <Button tone="text" onClick={() => setSheet(null)}>
              Keep it
            </Button>
            <Button tone="filled" fill disabled={!picked || act.isPending} onClick={() => picked && run(() => assignSupervisorReservationTable(token, branch, selected.id, picked.id), `Moved to ${tileName(picked)}.`)}>
              {picked ? `Move to ${tileName(picked)}` : "No free table fits"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-kit-8">
          {options.filter((t) => t.id !== selected.tableId).map((t) => (
            <OptionTile key={t.id} label={tileName(t)} second={[t.seats ? `${t.seats} seats` : "", t.areaName].filter(Boolean).join(" · ")} current={picked?.id === t.id} onClick={() => setChoice(t.id)} />
          ))}
        </div>
        {failure ? <Banner tone="red" title={failure} /> : null}
      </Sheet>
    );
  } else if (sheet === "cancel" && selected) {
    sheetNode = <CancelSheet key={selected.id} r={selected} place={sheetPlace} busy={act.isPending} failure={failure} onClose={() => setSheet(null)} onCancel={(reason, outcome) => run(() => cancelSupervisorReservation(token, branch, selected.id, reason, outcome), "Booking cancelled.")} />;
  } else if (sheet === "noShow" && selected) {
    sheetNode = (
      <Sheet
        placement={sheetPlace}
        title="Mark as no-show"
        summary={`${guestName(selected)} was due at ${hhmm(selected.reservationAt)}.`}
        onClose={() => setSheet(null)}
        footer={
          <>
            <Button tone="text" onClick={() => setSheet(null)}>
              Keep waiting
            </Button>
            <Button tone="filled" fill disabled={act.isPending} onClick={() => run(() => markSupervisorReservationNoShow(token, branch, selected.id, { depositOutcome: heldDeposit(selected) > 0n ? noShowOutcome : "NO_DEPOSIT" }), "Marked as no-show.")}>
              Mark as no-show
            </Button>
          </>
        }
      >
        {heldDeposit(selected) > 0n ? (
          <div className="grid grid-cols-2 gap-kit-8">
            <OptionTile label="Keep the deposit" second={`UGX ${groupCents(heldDeposit(selected))}`} current={noShowOutcome === "FORFEIT"} onClick={() => setNoShowOutcome("FORFEIT")} />
            <OptionTile label="Give it back" second={`UGX ${groupCents(heldDeposit(selected))}`} current={noShowOutcome === "REFUND"} onClick={() => setNoShowOutcome("REFUND")} />
          </div>
        ) : (
          <Text variant="body" tone="muted">
            No deposit was received. The table is freed for walk-ins.
          </Text>
        )}
        {failure ? <Banner tone="red" title={failure} /> : null}
      </Sheet>
    );
  } else if (sheet === "create") {
    sheetNode = (
      <CreateSheet
        place={sheetPlace}
        today={today}
        busy={act.isPending}
        failure={failure}
        onClose={() => setSheet(null)}
        onCreate={(input) =>
          act.mutate(() => createSupervisorReservation(token, branch, input), {
            onSuccess: (made) => {
              setSheet(null);
              setNotice("Booking made.");
              const r = made as SupervisorReservation;
              if (r?.id) go({ view: "arriving", id: r.id, date: r.reservationAt ? isoDay(new Date(r.reservationAt)) : null });
            },
          })
        }
      />
    );
  }

  const top = (
    <div className="flex flex-wrap items-center justify-between gap-kit-12">
      {segmented}
      {role === "supervisor" ? (
        <Button tone="tonal" icon="plus" onClick={() => { setFailure(null); setSheet("create"); }}>
          New reservation
        </Button>
      ) : null}
    </div>
  );

  if (wide.phone) {
    return (
      <div className="flex flex-col gap-kit-14 px-kit-16 pb-kit-16 pt-kit-14" data-res-role={role}>
        {top}
        {dayStep}
        {list}
        {historyPager}
        {notice && !sheet ? (
          <Text variant="body" tone="green" strong>
            {notice}
          </Text>
        ) : null}
        {sheetNode}
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 gap-kit-20 px-kit-24 py-kit-16" data-res-role={role}>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-kit-16">
        {top}
        {dayStep}
        <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
        {historyPager}
      </section>
      <aside className="flex w-kit-sheet-side flex-none flex-col rounded-kit-card bg-kit-card p-kit-20 shadow-kit-raised" aria-label="Booking">
        {selected ? (
          panel(selected)
        ) : (
          <Text variant="body" tone="muted">
            Choose a booking to see it here.
          </Text>
        )}
      </aside>
      {sheetNode}
    </div>
  );
}

function CancelSheet({
  r,
  place,
  busy,
  failure,
  onClose,
  onCancel,
}: {
  r: SupervisorReservation;
  place: "bottom" | "middle";
  busy: boolean;
  failure: string | null;
  onClose: () => void;
  onCancel: (reason: string, outcome?: "REFUND" | "FORFEIT" | "NO_DEPOSIT") => void;
}) {
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const held = heldDeposit(r);
  const hasDeposit = held > 0n;
  const [outcome, setOutcome] = useState<"REFUND" | "FORFEIT">("REFUND");
  const missing = tried && !reason.trim();
  return (
    <Sheet
      placement={place}
      title="Cancel booking"
      summary={`${guestName(r)} · ${hhmm(r.reservationAt)} · ${r.partySize ?? 1} guests`}
      onClose={onClose}
      footer={
        <>
          <Button tone="text" onClick={onClose}>
            Keep booking
          </Button>
          <Button
            tone="filled"
            fill
            disabled={busy}
            onClick={() => {
              setTried(true);
              if (reason.trim()) onCancel(reason.trim(), hasDeposit ? outcome : "NO_DEPOSIT");
            }}
          >
            Cancel booking
          </Button>
        </>
      }
    >
      <Field label="Why is it cancelled?" value={reason} onChange={setReason} required error={missing ? "Write the reason." : undefined} placeholder="The guest called to cancel" />
      {hasDeposit ? (
        <div className="grid grid-cols-2 gap-kit-8">
          <OptionTile label="Give the deposit back" second={`UGX ${groupCents(held)}`} current={outcome === "REFUND"} onClick={() => setOutcome("REFUND")} />
          <OptionTile label="Keep the deposit" second={`UGX ${groupCents(held)}`} current={outcome === "FORFEIT"} onClick={() => setOutcome("FORFEIT")} />
        </div>
      ) : null}
      {failure ? <Banner tone="red" title={failure} /> : null}
    </Sheet>
  );
}

function CreateSheet({
  place,
  today,
  busy,
  failure,
  onClose,
  onCreate,
}: {
  place: "bottom" | "middle";
  today: string;
  busy: boolean;
  failure: string | null;
  onClose: () => void;
  onCreate: (input: Parameters<typeof createSupervisorReservation>[2]) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState("2");
  const [day, setDay] = useState(today);
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const party = Number(guests);
  const at = toInstant(day.trim(), time.trim());
  const errors = {
    name: !name.trim() ? "Write the guest's name." : undefined,
    guests: !Number.isInteger(party) || party < 1 ? "Write how many guests." : undefined,
    day: !/^\d{4}-\d{2}-\d{2}$/.test(day.trim()) ? "Write the day as 2026-11-26." : undefined,
    time: !at ? "Write the time as 20:30." : at && new Date(at).getTime() < Date.now() ? "That time has passed." : undefined,
  };
  const ok = !Object.values(errors).some(Boolean);
  return (
    <Sheet
      placement={place}
      title="New reservation"
      onClose={onClose}
      footer={
        <>
          <Button tone="text" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="filled"
            fill
            disabled={busy}
            onClick={() => {
              setTried(true);
              if (!ok || !at) return;
              onCreate({
                customerName: name.trim(),
                customerPhone: phone.trim() || undefined,
                partySize: party,
                reservationAt: at,
                source: "MANUAL",
                notes: note.trim() || undefined,
              });
            }}
          >
            Create booking
          </Button>
        </>
      }
    >
      <div className={["grid gap-kit-12", place === "bottom" ? "grid-cols-1" : "grid-cols-2"].join(" ")}>
        <Field label="Guest's name" value={name} onChange={setName} required error={tried ? errors.name : undefined} />
        <Field label="Phone" value={phone} onChange={setPhone} inputMode="tel" placeholder="+256 700 000 000" />
        <Field label="Guests" value={guests} onChange={setGuests} inputMode="numeric" required error={tried ? errors.guests : undefined} />
        <Field label="Day" value={day} onChange={setDay} inputMode="numeric" required error={tried ? errors.day : undefined} />
        <Field label="Time" value={time} onChange={setTime} inputMode="numeric" placeholder="20:30" required error={tried ? errors.time : undefined} />
        <Field label="Note" value={note} onChange={setNote} placeholder="Birthday, quiet corner" />
      </div>
      {failure ? <Banner tone="red" title={failure} /> : null}
    </Sheet>
  );
}
