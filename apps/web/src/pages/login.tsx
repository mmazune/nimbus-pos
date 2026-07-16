import {
  Backspace,
  Clock,
  DesktopTower,
  LockKey,
  WifiHigh,
} from "@phosphor-icons/react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button, Input, StatusMessage } from "@/components/ui";
import { CurrentTime } from "@/components/waiter/shell/CurrentTime";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  getCashierLandingPath,
  getSupervisorLandingPath,
  isCashierCompatible,
  isSupervisorCompatible,
  isWaiterCompatible,
} from "@/lib/auth/role";
import type { AuthMeResponse } from "@/lib/auth/types";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

type LoginMode = "pin" | "password";

const PIN_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];
const STATION_BRANCH_KEY = "nimbus.stationBranchId";
const DEMO_BRANCH_ID = "cb27be401a2c35dfc0d4e610";
const DEMO_BRANCH_NAME = "Tapas Downtown";

function getQueryReason(reason: string | string[] | undefined) {
  const value = Array.isArray(reason) ? reason[0] : reason;
  switch (value) {
    case "idle_timeout":
      return "Idle timeout ended the previous session.";
    case "logged_out":
      return "Session ended.";
    case "session_required":
      return "Please log in to continue.";
    case "waiter_only":
      return "This route is available to waiter accounts only.";
    case "cashier_only":
      return "This route is available to cashier accounts only.";
    case "supervisor_only":
      return "This route is available to supervisor accounts only.";
    default:
      return null;
  }
}

function toFriendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK_ERROR") return error.message;
    if (error.status === 400 && /branch/i.test(error.message)) {
      return "Branch context is missing or invalid. Enter the seeded branch ID for this terminal.";
    }
    if (error.code === "UNAUTHORIZED") return "Login failed. Check the credentials or PIN and try again.";
    if (error.code === "FORBIDDEN") return "This account or branch cannot access this service terminal.";
    return error.message;
  }

  return error instanceof Error ? error.message : "Login failed. Try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const {
    authError,
    clearSession,
    isAuthenticated,
    isCashier,
    isLoading,
    isSupervisor,
    isWaiter,
    loginWithPassword,
    loginWithPin,
  } = useAuth();

  const [mode, setMode] = useState<LoginMode>("pin");
  const [branchId, setBranchId] = useState("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reasonMessage = useMemo(() => getQueryReason(router.query.reason), [router.query.reason]);
  const pinIsValid = pin.length === 6 || pin.length === 8;
  const branchContextLabel = branchId.trim() === DEMO_BRANCH_ID ? DEMO_BRANCH_NAME : branchId.trim();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedBranchId =
      window.localStorage.getItem(STATION_BRANCH_KEY) ||
      process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID ||
      DEMO_BRANCH_ID;
    setBranchId(storedBranchId);
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated && isWaiter) {
      void router.replace("/waiter/floor");
    }
    if (!isLoading && isAuthenticated && isCashier) {
      void router.replace(getCashierLandingPath());
    }
    if (!isLoading && isAuthenticated && isSupervisor) {
      void router.replace(getSupervisorLandingPath());
    }
  }, [isAuthenticated, isCashier, isLoading, isSupervisor, isWaiter, router]);

  function handlePinKey(key: string) {
    setFormError(null);
    setBlockedMessage(null);

    if (key === "clear") {
      setPin("");
      return;
    }

    if (key === "back") {
      setPin((value) => value.slice(0, -1));
      return;
    }

    setPin((value) => (value.length >= 8 ? value : `${value}${key}`));
  }

  async function completeLogin(resolveLogin: () => Promise<AuthMeResponse>) {
    setSubmitting(true);
    setFormError(null);
    setBlockedMessage(null);

    try {
      const me = await resolveLogin();
      const isWaiterUser = isWaiterCompatible(me);
      const isCashierUser = isCashierCompatible(me);
      const isSupervisorUser = isSupervisorCompatible(me);

      if (!isWaiterUser && !isCashierUser && !isSupervisorUser) {
        clearSession();
        setBlockedMessage("This frontend currently supports waiter, cashier, and supervisor workspaces only.");
        return;
      }

      if (typeof window !== "undefined" && branchId) {
        window.localStorage.setItem(STATION_BRANCH_KEY, branchId);
      }

      if (typeof window !== "undefined") {
        window.location.replace(
          isSupervisorUser
            ? getSupervisorLandingPath()
            : isCashierUser
              ? getCashierLandingPath()
              : "/waiter/floor",
        );
        return;
      }

      await router.replace(
        isSupervisorUser
          ? getSupervisorLandingPath()
          : isCashierUser
            ? getCashierLandingPath()
            : "/waiter/floor",
      );
    } catch (error) {
      setFormError(toFriendlyError(error));
      setPin("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!branchId.trim()) {
      setFormError("Branch context is required for Quick PIN login.");
      return;
    }

    if (!pinIsValid) {
      setFormError("PIN must be 6 or 8 digits.");
      return;
    }

    await completeLogin(() => loginWithPin(branchId.trim(), pin));
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setFormError("Email and password are required.");
      return;
    }

    await completeLogin(() => loginWithPassword(email.trim(), password));
  }

  return (
    <main className="flex min-h-screen min-w-[1280px] items-center justify-center bg-brand-navy-950 px-10 py-12 text-text-inverse">
      <section className="grid w-full max-w-[1240px] grid-cols-[1fr_500px] gap-12">
        <div className="flex flex-col justify-between py-4">
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-brand-white text-brand-navy-900 shadow-panel">
              <LockKey size={28} weight="duotone" />
            </div>
            <p className="mt-10 text-sm font-semibold uppercase tracking-normal text-brand-silver">
              Nimbus POS
            </p>
            <h1 className="mt-3 max-w-2xl text-balance text-5xl font-bold tracking-normal">
              Service terminal
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-brand-silver">
              Shared desktop access for waiter service, cashier settlement, and supervisor floor control. Quick PIN is primary for frontline staff.
            </p>
          </div>

          <div className="grid max-w-xl grid-cols-3 gap-3 text-sm font-semibold">
            <div className="rounded-lg bg-brand-navy-800 p-4 shadow-subtle">
              <div className="flex items-center gap-2 text-brand-silver">
                <DesktopTower size={18} weight="bold" />
                <span>Workstation</span>
              </div>
              <p className="mt-2 text-text-inverse">POS Desktop</p>
            </div>
            <div className="rounded-lg bg-brand-navy-800 p-4 shadow-subtle">
              <div className="flex items-center gap-2 text-brand-silver">
                <Clock size={18} weight="bold" />
                <span>Time</span>
              </div>
              <p className="mt-2 tabular-nums text-text-inverse">
                <CurrentTime />
              </p>
            </div>
            <div className="rounded-lg bg-brand-navy-800 p-4 shadow-subtle">
              <div className="flex items-center gap-2 text-brand-silver">
                <WifiHigh size={18} weight="bold" />
                <span>API</span>
              </div>
              <p className="mt-2 text-text-inverse">Local dev</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-surface-raised p-6 text-text-primary shadow-overlay">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">
                Sign in
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-normal text-text-primary">
                Start service
              </h2>
            </div>
            <div className="rounded-md bg-surface-muted px-3 py-2 text-right text-xs font-semibold text-text-secondary">
              <p>Branch context</p>
              <p className="mt-1 max-w-40 truncate text-text-primary" title={branchContextLabel || undefined}>
                {branchContextLabel || "Unavailable"}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-lg bg-surface-muted p-1">
            <button
              type="button"
              className={`flex min-h-12 items-center justify-center gap-2 rounded-md px-4 text-base font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96] ${
                mode === "pin"
                  ? "bg-brand-navy-900 text-text-inverse shadow-subtle"
                  : "text-text-secondary hover:bg-surface"
              }`}
              onClick={() => {
                setMode("pin");
                setFormError(null);
                setBlockedMessage(null);
              }}
            >
              <span>Quick PIN</span>
            </button>
            <button
              type="button"
              className={`flex min-h-12 items-center justify-center gap-2 rounded-md px-4 text-base font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96] ${
                mode === "password"
                  ? "bg-brand-navy-900 text-text-inverse shadow-subtle"
                  : "text-text-secondary hover:bg-surface"
              }`}
              onClick={() => {
                setMode("password");
                setFormError(null);
                setBlockedMessage(null);
              }}
            >
              <span>Email</span>
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {reasonMessage ? (
              <StatusMessage tone="info" title={reasonMessage} />
            ) : null}
            {authError && !formError ? (
              <StatusMessage tone="warning" title={authError} />
            ) : null}
            {blockedMessage ? (
              <StatusMessage tone="warning" title={blockedMessage} />
            ) : null}
            {formError ? (
              <StatusMessage tone="danger" title={formError} />
            ) : null}
          </div>

          {mode === "pin" ? (
            <form className="mt-6" onSubmit={handlePinSubmit}>
              <label className="block">
                <span className="text-sm font-semibold text-text-secondary">Branch</span>
                <Input
                  name="branchId"
                  className="mt-2"
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  placeholder={DEMO_BRANCH_ID}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={submitting}
                />
                <span className="mt-2 block text-sm font-semibold text-text-muted">
                  Local demo branch: {DEMO_BRANCH_NAME}
                </span>
              </label>

              <div className="mt-5 rounded-lg bg-surface-muted p-4">
                <div className="flex h-14 items-center justify-center rounded-md bg-surface text-3xl font-bold tabular-nums shadow-subtle">
                  {pin ? "•".repeat(pin.length) : <span className="text-text-muted">PIN</span>}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {PIN_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="flex h-16 items-center justify-center rounded-md bg-surface text-xl font-bold text-text-primary shadow-subtle transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-brand-white active:scale-[0.96] disabled:pointer-events-none disabled:text-text-muted"
                      onClick={() => handlePinKey(key)}
                      disabled={submitting}
                      aria-label={key === "back" ? "Backspace" : key === "clear" ? "Clear PIN" : key}
                    >
                      {key === "back" ? <Backspace size={24} weight="bold" /> : null}
                      {key === "clear" ? <span className="text-sm uppercase">Clear</span> : null}
                      {key !== "back" && key !== "clear" ? key : null}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="mt-5 w-full"
                size="pos"
                type="submit"
                disabled={submitting || !branchId.trim() || !pinIsValid}
              >
                Enter
              </Button>
            </form>
          ) : (
            <form className="mt-6 flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
              <label>
                <span className="text-sm font-semibold text-text-secondary">Email</span>
                <Input
                  name="email"
                  className="mt-2"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  spellCheck={false}
                  disabled={submitting}
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-text-secondary">Password</span>
                <Input
                  name="password"
                  className="mt-2"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  disabled={submitting}
                />
              </label>
              <Button
                size="pos"
                type="submit"
                disabled={submitting || !email.trim() || !password}
              >
                Sign in
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm leading-6 text-text-muted">
            Owner, manager, and accountant accounts can authenticate here, but this frontend opens only supported frontline and supervisor workspaces.
          </p>
        </div>
      </section>
    </main>
  );
}
