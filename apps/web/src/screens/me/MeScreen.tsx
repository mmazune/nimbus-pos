import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import { Banner, Button, Card, Field, OptionTile, Pill, Row, RowGroup, Sheet, Text, type PillTone } from "@/components/kit";
import { useStationTerminalLabel } from "@/components/pos-shell/station";
import { useTouchHeader } from "@/components/pos-shell/TouchShell";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { getActiveShiftRequest } from "@/lib/auth/auth-api";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  clockAttendance,
  createLeaveRequest,
  endShift,
  listMyAttendance,
  listMyLeaveRequests,
  listMyShiftSwaps,
  startShift,
  type CreateLeaveRequestPayload,
} from "@/lib/waiter/me-api";
import { normalizeShift } from "@/lib/waiter/me-model";

import { loadOrders } from "../floor/floor-data";
import { formatMinutes, groupCents, shortName, toCents } from "../floor/floor-model";
import { useWide } from "../floor/useWide";
import { errorWords } from "../shared/words";

/**
 * Me, for waiter, cashier and supervisor (T1 phase 3, drawing Waiter-Me).
 *   My shift     /api/shifts/active, open and close; today's attendance, clock in or out
 *   My day       only numbers the orders endpoint gives for this person today
 *   My requests  /api/hr/leave and /api/hr/shift-swaps (mine), ask for leave
 *   Log out
 * Left out, with the reason in the T1 report: "Items voided" (no per-person
 * void count), "Ask to swap" (a swap needs a colleague the person cannot list),
 * "Change my PIN" (no endpoint lets a person set their own PIN).
 */
type Role = "waiter" | "cashier" | "supervisor";
const ROLE_WORD: Record<Role, string> = { waiter: "Waiter", cashier: "Cashier", supervisor: "Supervisor" };
const KEY = ["t1", "me"] as const;
const ACTIVE = new Set(["NEW", "SENT", "IN_KITCHEN", "READY", "SERVED"]);

type Order = { id: string; tableId?: string | null; status?: string | null; total?: string | number | null; createdAt?: string | null };
type Shift = { id: string; openedAt?: string | null; status?: string | null } | null;

function errorText(e: unknown): string {
  return errorWords(e);
}

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hhmm(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** This person's orders since midnight (the list has no date filter: read theirs, keep today's). */
async function loadMyOrdersToday(token: string, branchId: string, userId: string): Promise<Order[]> {
  const since = startOfToday().getTime();
  const rows = await loadOrders<Order>(token, branchId, `userId=${encodeURIComponent(userId)}`);
  return rows.filter((o) => (o.createdAt ? new Date(o.createdAt).getTime() : 0) >= since);
}

/** "12 to 14 Dec" (the month once), "30 Nov to 2 Dec", or one day. */
function dayRange(from?: string | null, to?: string | null) {
  const a = dayShort(from);
  const b = dayShort(to);
  if (!a || !b || a === b) return a;
  const [da, ...ma] = a.split(" ");
  return ma.join(" ") === b.split(" ").slice(1).join(" ") ? `${da} to ${b}` : `${a} to ${b}`;
}

/** "Sat 28 Nov". */
function dayWeek(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(d);
}

function dayShort(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
}

function requestPill(status?: string | null): { tone: PillTone; word: string } {
  switch (String(status ?? "").toUpperCase()) {
    case "APPROVED":
      return { tone: "green", word: "Approved" };
    case "REJECTED":
      return { tone: "red", word: "Declined" };
    case "CANCELLED":
      return { tone: "neutral", word: "Cancelled" };
    default:
      return { tone: "amber", word: "Waiting" };
  }
}

const LEAVE_TYPES: Array<{ key: CreateLeaveRequestPayload["leaveType"]; label: string }> = [
  { key: "ANNUAL", label: "Annual" },
  { key: "SICK", label: "Sick" },
  { key: "EMERGENCY", label: "Emergency" },
  { key: "UNPAID", label: "Unpaid" },
];

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex py-kit-9 items-center justify-between gap-kit-12">
      <Text variant="sup" tone="muted">
        {label}
      </Text>
      <Text variant="body" strong>
        {value}
      </Text>
    </div>
  );
}

export function MeScreen({ role }: { role: Role }) {
  const qc = useQueryClient();
  const wide = useWide();
  const station = useStationTerminalLabel();
  const { accessToken, branchId, branchName, displayName, logout, user } = useAuth();
  const token = accessToken as string;
  const branch = branchId as string;
  const ready = Boolean(accessToken && branchId && user?.id);
  const employeeId = user?.employee?.id ?? null;
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [ending, setEnding] = useState(false);
  const [leavingOut, setLeavingOut] = useState(false);

  const name = shortName({ displayName }) ?? displayName ?? "";
  useTouchHeader({ title: "Me", summary: [name, ROLE_WORD[role], branchName].filter(Boolean).join(" · ") });

  const shiftQ = useQuery({
    queryKey: [...KEY, "shift", branch, user?.id],
    enabled: ready,
    queryFn: () => getActiveShiftRequest(token, branch) as Promise<Shift>,
    retry: shouldRetryApiRequest,
    staleTime: 30_000,
  });
  const dayQ = useQuery({
    queryKey: [...KEY, "day", branch, user?.id],
    enabled: ready,
    queryFn: () => loadMyOrdersToday(token, branch, user?.id as string),
    retry: shouldRetryApiRequest,
    staleTime: 30_000,
  });
  const attendanceQ = useQuery({
    queryKey: [...KEY, "attendance", branch],
    enabled: ready && Boolean(employeeId),
    queryFn: () => listMyAttendance(token, branch, { mine: true, take: 1, dateFrom: isoToday() }),
    retry: shouldRetryApiRequest,
  });
  const leaveQ = useQuery({
    queryKey: [...KEY, "leave", branch],
    enabled: ready,
    queryFn: () => listMyLeaveRequests(token, branch, { mine: true, take: 4 }),
    retry: shouldRetryApiRequest,
  });
  const swapQ = useQuery({
    queryKey: [...KEY, "swaps", branch],
    enabled: ready,
    queryFn: () => listMyShiftSwaps(token, branch, { mine: true, take: 4 }),
    retry: shouldRetryApiRequest,
  });

  const day = useMemo(() => {
    const orders = dayQ.data ?? [];
    const closed = orders.filter((o) => String(o.status).toUpperCase() === "CLOSED");
    const sales = closed.reduce((acc, o) => acc + toCents(o.total), 0n);
    const served = new Set(orders.filter((o) => o.tableId && String(o.status).toUpperCase() !== "VOIDED").map((o) => o.tableId));
    const open = new Set(orders.filter((o) => o.tableId && ACTIVE.has(String(o.status).toUpperCase())).map((o) => o.tableId));
    return { sales: `UGX ${groupCents(sales)}`, served: String(served.size), open: `${open.size} ${open.size === 1 ? "table" : "tables"}` };
  }, [dayQ.data]);

  const shift = shiftQ.data ?? null;
  const openedAt = shift?.openedAt ? new Date(shift.openedAt) : null;
  const minutesOn = openedAt ? Math.max(0, Math.floor((Date.now() - openedAt.getTime()) / 60000)) : null;
  // The same reading as the Floor's shift line, so the two never disagree.
  const longShift = shift ? normalizeShift(shift as Parameters<typeof normalizeShift>[0], user?.permissions || []).statusLabel === "Shift issue" : false;
  const todayAttendance = attendanceQ.data?.data?.[0];
  const clockedIn = Boolean(todayAttendance?.clockInAt);
  const clockedOut = Boolean(todayAttendance?.clockOutAt);
  const clock = useMutation({
    mutationFn: () => clockAttendance(token, branch, { employeeId: employeeId as string }),
    onMutate: () => {
      setFailure(null);
      setNotice(null);
    },
    onSuccess: () => setNotice(clockedIn ? "Clocked out." : "Clocked in."),
    onError: (e) => setFailure(errorText(e)),
    onSettled: () => void qc.invalidateQueries({ queryKey: [...KEY, "attendance"] }),
  });

  const shiftMutation = useMutation({
    mutationFn: () => (shift ? endShift(token, branch, shift.id) : startShift(token, branch)),
    onMutate: () => {
      setFailure(null);
      setNotice(null);
    },
    onSuccess: () => {
      setEnding(false);
      setNotice(shift ? "Your shift has ended." : "Your shift has started.");
    },
    onError: (e) => setFailure(errorText(e)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [...KEY, "shift"] });
      void qc.invalidateQueries({ queryKey: ["waiter", "active-shift"] });
    },
  });

  async function doLogout() {
    if (leavingOut) return;
    setLeavingOut(true);
    await logout();
    window.location.replace("/login?reason=logged_out");
  }

  const requests: ReactNode[] = [];
  for (const l of leaveQ.data?.data ?? []) {
    const pill = requestPill(l.status);
    const span = dayRange(l.startsAt, l.endsAt);
    requests.push(
      <Row key={`l-${l.id}`} size="settings" title={`Leave${span ? `, ${span}` : ""}`} line={`Asked ${dayShort((l as { createdAt?: string | null }).createdAt) || dayShort(l.startsAt)}`} trailing={<Pill tone={pill.tone}>{pill.word}</Pill>} />,
    );
  }
  for (const s of swapQ.data?.data ?? []) {
    const pill = requestPill(s.status);
    const who = s.target ? shortName({ firstName: s.target.firstName, lastName: s.target.lastName }) : undefined;
    requests.push(
      <Row key={`s-${s.id}`} size="settings" title={who ? `Swap with ${who}` : "Shift swap"} line={s.shiftDate ? dayWeek(s.shiftDate) : undefined} trailing={<Pill tone={pill.tone}>{pill.word}</Pill>} />,
    );
  }

  const shiftCard = (
    <Card padding="roomy" label="My shift">
      <div className={["flex flex-col gap-kit-12", wide.phone ? "" : "min-h-full"].join(" ")}>
        <div className="flex items-start justify-between gap-kit-12">
          <Text variant="h">My shift</Text>
          {shiftQ.isLoading ? null : shift ? (
            <Pill tone={longShift ? "amber" : "green"}>{longShift ? "Needs a review" : "On shift"}</Pill>
          ) : (
            <Pill tone="neutral">Off shift</Pill>
          )}
        </div>
        {shiftQ.isLoading ? (
          <Text variant="body" tone="muted">
            Reading your shift…
          </Text>
        ) : shift && minutesOn !== null && openedAt ? (
          <>
            <Text variant="big">{formatMinutes(minutesOn)}</Text>
            <Text variant="sup" tone="muted">
              {`Started ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(openedAt)}${minutesOn >= 24 * 60 ? `, ${dayShort(shift.openedAt)}` : ""} at ${station}${branchName ? ` · ${branchName}` : ""}`}
            </Text>
          </>
        ) : (
          <Text variant="body" tone="muted">
            You are not on shift.
          </Text>
        )}
        {employeeId ? (
          <div className="flex min-h-kit-target items-center justify-between gap-kit-12">
            <Text variant="sup" tone="muted">
              {attendanceQ.isLoading
                ? "Reading your attendance…"
                : clockedOut
                  ? `Clocked out at ${hhmm(todayAttendance?.clockOutAt)}`
                  : clockedIn
                    ? `Clocked in at ${hhmm(todayAttendance?.clockInAt)}`
                    : "Attendance · not clocked in yet"}
            </Text>
            {attendanceQ.isLoading || clockedOut ? null : (
              <Button tone="text" size="laptop" disabled={clock.isPending} onClick={() => clock.mutate()}>
                {clockedIn ? "Clock out" : "Clock in"}
              </Button>
            )}
          </div>
        ) : null}
        <span className="flex-1" />
        {notice ? (
          <Text variant="body" tone="green" strong>
            {notice}
          </Text>
        ) : null}
        {failure ? <Banner tone="red" title={failure} /> : null}
        {shiftQ.isLoading ? null : (
          <Button tone="tonal" disabled={shiftMutation.isPending} onClick={() => (shift ? setEnding(true) : shiftMutation.mutate())}>
            {shift ? "End my shift" : "Start my shift"}
          </Button>
        )}
      </div>
    </Card>
  );

  const dayCard = (
    <Card padding="roomy" label="My day">
      <div className={["flex flex-col gap-kit-12", wide.phone ? "" : "min-h-full"].join(" ")}>
        <Text variant="h">My day</Text>
        {dayQ.isLoading ? (
          <Text variant="body" tone="muted">
            Reading your day…
          </Text>
        ) : dayQ.isError ? (
          <Text variant="body" tone="muted">
            Your numbers could not be read.
          </Text>
        ) : (
          <>
            {role === "waiter" ? <Fact label="Sales so far" value={day.sales} /> : null}
            <Fact label="Tables served" value={day.served} />
            <Fact label="Open now" value={day.open} />
          </>
        )}
        <span className="flex-1" />
        <Text variant="small" tone="muted">
          Only your own numbers show here.
        </Text>
      </div>
    </Card>
  );

  const requestsCard = (
    <Card label="My requests">
      <div className="flex flex-col pt-kit-16">
        <div className="px-kit-16 pb-kit-8">
          <Text variant="cap" tone="muted">
            My requests
          </Text>
        </div>
        {requests.length ? (
          <RowGroup>{requests}</RowGroup>
        ) : (
          <div className="px-kit-16 py-kit-8">
            <Text variant="body" tone="muted">
              {leaveQ.isLoading || swapQ.isLoading ? "Reading your requests…" : "No requests yet."}
            </Text>
          </div>
        )}
        <div className="flex gap-kit-8 px-kit-16 pb-kit-16 pt-kit-12">
          <Button tone="tonal" size="laptop" fill disabled={!employeeId} onClick={() => setAsking(true)}>
            Ask for leave
          </Button>
        </div>
      </div>
    </Card>
  );

  const actions = (
    <div className="flex flex-col gap-kit-16">
      <Button tone="filled" disabled={leavingOut} onClick={() => void doLogout()}>
        Log out
      </Button>
    </div>
  );

  const endSheet = ending ? (
    <Sheet
      placement={wide.phone ? "bottom" : "middle"}
      title="End your shift?"
      summary={day.open.startsWith("0 ") ? "You have no tables open." : `You still have ${day.open} open.`}
      onClose={() => setEnding(false)}
      footer={
        <>
          <Button tone="text" onClick={() => setEnding(false)}>
            Keep working
          </Button>
          <Button tone="filled" fill disabled={shiftMutation.isPending} onClick={() => shiftMutation.mutate()}>
            End my shift
          </Button>
        </>
      }
    >
      {failure ? <Banner tone="red" title={failure} /> : null}
    </Sheet>
  ) : null;

  const sheet = asking && employeeId ? (
    <LeaveSheet
      place={wide.phone ? "bottom" : "middle"}
      onClose={() => setAsking(false)}
      onAsk={async (payload) => {
        await createLeaveRequest(token, branch, { ...payload, employeeId });
        setAsking(false);
        void qc.invalidateQueries({ queryKey: [...KEY, "leave"] });
      }}
    />
  ) : null;

  if (wide.phone) {
    return (
      <div className="flex flex-col gap-kit-14 px-kit-16 pb-kit-16 pt-kit-14" data-me-role={role}>
        {shiftCard}
        {dayCard}
        {requestsCard}
        {actions}
        {sheet}
        {endSheet}
      </div>
    );
  }
  return (
    <div className="grid min-h-0 flex-1 grid-cols-3 gap-kit-20 px-kit-24 py-kit-16" data-me-role={role}>
      {shiftCard}
      {dayCard}
      <div className="flex min-h-0 flex-col justify-between gap-kit-16">
        {requestsCard}
        {actions}
      </div>
      {sheet}
      {endSheet}
    </div>
  );
}

function LeaveSheet({ place, onClose, onAsk }: { place: "bottom" | "middle"; onClose: () => void; onAsk: (p: Omit<CreateLeaveRequestPayload, "employeeId">) => Promise<void> }) {
  const [type, setType] = useState<CreateLeaveRequestPayload["leaveType"]>("ANNUAL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const okDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) && !Number.isNaN(new Date(`${v.trim()}T00:00:00`).getTime());
  const errFrom = !okDay(from) ? "Write the first day as 2026-12-12." : undefined;
  const errTo = !okDay(to) ? "Write the last day as 2026-12-14." : okDay(from) && to.trim() < from.trim() ? "The last day is before the first." : undefined;
  return (
    <Sheet
      placement={place}
      title="Ask for leave"
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
            onClick={async () => {
              setTried(true);
              if (errFrom || errTo) return;
              setBusy(true);
              setFailure(null);
              try {
                await onAsk({
                  leaveType: type,
                  startsAt: new Date(`${from.trim()}T00:00:00`).toISOString(),
                  endsAt: new Date(`${to.trim()}T23:59:00`).toISOString(),
                  reason: reason.trim() || undefined,
                });
              } catch (e) {
                setFailure(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Send the request
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-kit-8 sm:grid-cols-4">
        {LEAVE_TYPES.map((t) => (
          <OptionTile key={t.key} label={t.label} current={type === t.key} onClick={() => setType(t.key)} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-kit-12">
        <Field label="First day" value={from} onChange={setFrom} inputMode="numeric" placeholder="2026-12-12" required error={tried ? errFrom : undefined} />
        <Field label="Last day" value={to} onChange={setTo} inputMode="numeric" placeholder="2026-12-14" required error={tried ? errTo : undefined} />
      </div>
      <Field label="Why" value={reason} onChange={setReason} placeholder="Family wedding" />
      {failure ? <Banner tone="red" title={failure} /> : null}
    </Sheet>
  );
}
