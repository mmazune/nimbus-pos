import { Backspace } from "@phosphor-icons/react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button, Input, StatusMessage } from "@/components/ui";
import { NimbusLogomark } from "@/components/pos-shell/NimbusLogomark";
import { CurrentTime } from "@/components/pos-shell/CurrentTime";
import { operationalIcons, operationalIconSizes, operationalIconWeights } from "@/components/pos-shell/role-icons";
import { useStationTerminalLabel } from "@/components/pos-shell/station";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  getCashierLandingPath,
  getManagerLandingPath,
  getSupervisorLandingPath,
  isCashierCompatible,
  isManagerCompatible,
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
    case "manager_only":
      return "This route is available to manager accounts only.";
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
    isManager,
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

  const terminalLabel = useStationTerminalLabel();
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
    if (!isLoading && isAuthenticated && isManager) {
      void router.replace(getManagerLandingPath());
    }
  }, [isAuthenticated, isCashier, isLoading, isManager, isSupervisor, isWaiter, router]);

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
      const isManagerUser = isManagerCompatible(me);

      if (!isWaiterUser && !isCashierUser && !isSupervisorUser && !isManagerUser) {
        clearSession();
        setBlockedMessage(
          "This frontend currently supports waiter, cashier, supervisor, and manager workspaces only.",
        );
        return;
      }

      if (typeof window !== "undefined" && branchId) {
        window.localStorage.setItem(STATION_BRANCH_KEY, branchId);
      }

      const landingPath = isManagerUser
        ? getManagerLandingPath()
        : isSupervisorUser
          ? getSupervisorLandingPath()
          : isCashierUser
            ? getCashierLandingPath()
            : "/waiter/floor";

      if (typeof window !== "undefined") {
        window.location.replace(landingPath);
        return;
      }

      await router.replace(landingPath);
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

  const WorkstationIcon = operationalIcons.workstation;
  const TimeIcon = operationalIcons.time;
  const BranchIcon = operationalIcons.branch;

  const statusChips = (
    <dl className="grid grid-cols-3 gap-2" aria-label="Terminal status">
      {[
        { icon: WorkstationIcon, term: "Workstation", value: terminalLabel },
        { icon: TimeIcon, term: "Time", value: <CurrentTime /> },
        { icon: BranchIcon, term: "API", value: "Local dev" },
      ].map((chip) => {
        const ChipIcon = chip.icon;
        return (
          <div key={chip.term} className="min-w-0 rounded-md bg-brand-navy-800 px-3 py-2 shadow-subtle">
            <dt className="flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-brand-silver">
              <ChipIcon
                size={operationalIconSizes.compactAction}
                weight={operationalIconWeights.default}
                aria-hidden
              />
              <span className="truncate">{chip.term}</span>
            </dt>
            <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-text-inverse">
              {chip.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );

  return (
    /*
     * Fullscreen lock screen (owner-approved redesign 2026-08-20).
     *
     * The page is a TRUE h-screen layout with `overflow-hidden`: there is never a
     * page-level scrollbar at any supported terminal viewport (verified at
     * 1280x680 / 1366x768 / 1440x900 / 1920x1080). If the sign-in card ever
     * exceeds the available height, IT scrolls internally (`overflow-y-auto`),
     * not the document.
     */
    <main className="flex h-screen max-h-screen w-full items-center justify-center overflow-hidden bg-brand-navy-950 px-4 py-4 text-text-inverse sm:px-6 lg:px-10">
      <section className="grid h-full min-h-0 w-full max-w-[1160px] items-center gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-12">
        <div className="flex min-h-0 flex-col justify-center gap-5">
          {/* Brand combination mark: logomark tile + one-line "Nimbus POS" wordmark
              set in Inter ExtraBold (crisper than an <img> at terminal sizes). */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-white text-brand-navy-900 shadow-panel">
              <NimbusLogomark size={26} aria-hidden />
            </div>
            <p className="flex items-baseline gap-1.5 leading-none">
              <span className="text-2xl font-extrabold tracking-tight text-text-inverse" aria-hidden>
                Nimbus
              </span>
              <span
                className="text-sm font-extrabold uppercase tracking-widest text-brand-silver"
                aria-hidden
              >
                POS
              </span>
              <span className="sr-only">Nimbus POS</span>
            </p>
          </div>

          <h1 className="text-balance text-3xl font-bold tracking-normal lg:text-4xl">
            Service terminal
          </h1>

          <div className="max-w-md">{statusChips}</div>
        </div>

        <div className="flex max-h-full min-h-0 flex-col overflow-y-auto rounded-xl bg-surface-raised p-5 text-text-primary shadow-overlay">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Sign in
              </p>
              <h2 className="mt-0.5 text-xl font-bold tracking-normal text-text-primary">
                Start service
              </h2>
            </div>
            <div className="min-w-0 rounded-md bg-surface-muted px-2.5 py-1.5 text-right text-[0.625rem] font-semibold uppercase tracking-wide text-text-secondary">
              <p>Branch</p>
              <p
                className="mt-0.5 max-w-36 truncate text-xs normal-case tracking-normal text-text-primary"
                title={branchContextLabel || undefined}
              >
                {branchContextLabel || "Unavailable"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-surface-muted p-1">
            <button
              type="button"
              className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96] ${
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
              className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96] ${
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

          {reasonMessage || (authError && !formError) || blockedMessage || formError ? (
            <div className="mt-4 space-y-2">
              {reasonMessage ? <StatusMessage tone="info" title={reasonMessage} /> : null}
              {authError && !formError ? <StatusMessage tone="warning" title={authError} /> : null}
              {blockedMessage ? <StatusMessage tone="warning" title={blockedMessage} /> : null}
              {formError ? <StatusMessage tone="danger" title={formError} /> : null}
            </div>
          ) : null}

          {mode === "pin" ? (
            <form className="mt-4" onSubmit={handlePinSubmit}>
              <label className="block">
                <span className="text-xs font-semibold text-text-secondary">Branch</span>
                <Input
                  name="branchId"
                  className="mt-1 min-h-10 text-sm"
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  placeholder={DEMO_BRANCH_ID}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={submitting}
                />
                <span className="mt-1 block text-xs font-medium text-text-muted">
                  Local demo branch: {DEMO_BRANCH_NAME}
                </span>
              </label>

              <div className="mt-3 rounded-lg bg-surface-muted p-3">
                <div className="flex h-11 items-center justify-center rounded-md bg-surface text-2xl font-bold tabular-nums shadow-subtle">
                  {pin ? "\u2022".repeat(pin.length) : <span className="text-base text-text-muted">PIN</span>}
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  {PIN_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="flex h-11 items-center justify-center rounded-md bg-surface text-lg font-bold text-text-primary shadow-subtle transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-brand-white active:scale-[0.96] disabled:pointer-events-none disabled:text-text-muted"
                      onClick={() => handlePinKey(key)}
                      disabled={submitting}
                      aria-label={key === "back" ? "Backspace" : key === "clear" ? "Clear PIN" : key}
                    >
                      {key === "back" ? <Backspace size={operationalIconSizes.bottomNavigation} weight="bold" /> : null}
                      {key === "clear" ? <span className="text-xs uppercase">Clear</span> : null}
                      {key !== "back" && key !== "clear" ? key : null}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="mt-3 w-full"
                size="standard"
                type="submit"
                disabled={submitting || !branchId.trim() || !pinIsValid}
              >
                Enter
              </Button>
            </form>
          ) : (
            <form className="mt-4 flex flex-col gap-3" onSubmit={handlePasswordSubmit}>
              <label>
                <span className="text-xs font-semibold text-text-secondary">Email</span>
                <Input
                  name="email"
                  className="mt-1 min-h-10 text-sm"
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
                <span className="text-xs font-semibold text-text-secondary">Password</span>
                <Input
                  name="password"
                  className="mt-1 min-h-10 text-sm"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  disabled={submitting}
                />
              </label>
              <Button
                size="standard"
                type="submit"
                disabled={submitting || !email.trim() || !password}
              >
                Sign in
              </Button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
