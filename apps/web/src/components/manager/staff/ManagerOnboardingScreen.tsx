import Link from "next/link";
import { useMemo, useState } from "react";

import { ManagerContentShell, ManagerControlPanel, ManagerStatusPipeline } from "@/components/manager/chrome";
import { ManagerOneTimeSecretPanel } from "@/components/manager/staff/ManagerOneTimeSecretPanel";
import { ActionConfirmDialog } from "@/components/pos-shell/ActionConfirmDialog";
import { Badge, Button, Card } from "@/components/ui";
import { useManagerBranch } from "@/lib/manager/branch-context";
import { useManagerOnboarding, useManagerStaffErrorMessage } from "@/lib/manager/staff-context";
import {
  MANAGER_EMPLOYMENT_TYPES,
  MANAGER_FRONTLINE_ROLES,
  MANAGER_ONBOARDING_STEPS,
  buildManagerOnboardPayload,
  emptyManagerOnboardingDraft,
  titleCaseManagerStatus,
  validateManagerOnboardingStep,
  type ManagerOnboardingDraft,
  type ManagerOnboardingStepKey,
} from "@/lib/manager/staff-model";
import { MANAGER_STAFF_ROUTES } from "@/lib/manager/staff-route";
import { cn } from "@/lib/utils/cn";

/**
 * Staff → Onboard frontline staff (Track B3), over the verified BG1 endpoint
 * `POST /api/hr/frontline-staff/onboard` (`hr:frontline-staff:create`, 201).
 *
 * ## The three hard rules this form encodes
 *
 * 1. **MP0-15 — never `contractId`, never `compensationProfileId`.** The DTO's
 *    nested `employee` object accepts both. This form has no field for either,
 *    and `buildManagerOnboardPayload` cannot construct one, so the exclusion is
 *    structural rather than a matter of remembering.
 * 2. **MP0-14 — the PIN is shown once, masked, copy-once, never stored.** It
 *    comes back from a mutation, lives in that hook's own state, and is rendered
 *    by `ManagerOneTimeSecretPanel`. It never reaches a query cache, a URL, a
 *    log or any storage API.
 * 3. **Creating a person is confirmed.** The last step is a review of exactly
 *    what will be sent, and the create itself goes through the shared
 *    `ActionConfirmDialog` with an in-flight lock — the same pattern the Overview
 *    KPI refresh and every Cashier settlement action use.
 *
 * `issueQuickPin` is sent explicitly as `true` rather than inherited from the
 * DTO default, so what the form promises and what the request says cannot drift.
 */
export function ManagerOnboardingScreen() {
  const branch = useManagerBranch();
  const onboarding = useManagerOnboarding();
  const errorMessage = useManagerStaffErrorMessage(onboarding.error);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [draft, setDraft] = useState<ManagerOnboardingDraft>(() => emptyManagerOnboardingDraft(today));
  const [stepIndex, setStepIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const step = MANAGER_ONBOARDING_STEPS[stepIndex].key;
  const errors = useMemo(() => validateManagerOnboardingStep(step, draft), [draft, step]);
  const stepValid = Object.keys(errors).length === 0;

  const update = (patch: Partial<ManagerOnboardingDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const goNext = () => {
    setTouched(true);
    if (!stepValid) return;
    setTouched(false);
    setStepIndex((current) => Math.min(current + 1, MANAGER_ONBOARDING_STEPS.length - 1));
  };

  const restart = () => {
    onboarding.reset();
    setDraft(emptyManagerOnboardingDraft(today));
    setStepIndex(0);
    setTouched(false);
  };

  const result = onboarding.result;

  // ── Result state ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <ManagerContentShell>
        <ManagerControlPanel
          title="Staff member created"
          badge={<Badge variant="success">Created in {branch.branchName}</Badge>}
        />

        {result.quickPin ? (
          <ManagerOneTimeSecretPanel
            secret={result.quickPin}
            title={`Quick PIN for ${result.displayName}`}
            subject={result.displayName}
            onDismiss={restart}
            dismissLabel="I have shared it — onboard someone else"
          />
        ) : (
          <Card className="min-w-0 bg-status-warning-surface">
            <h2 className="text-lg font-bold text-text-primary">No PIN was issued</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {result.displayName} was created but has no Quick PIN, so they cannot sign in yet. Issue
              one from Quick PIN administration before their first shift.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={MANAGER_STAFF_ROUTES.quickPin}>
                <Button variant="primary">Open Quick PIN administration</Button>
              </Link>
              <Button variant="tertiary" onClick={restart}>
                Onboard someone else
              </Button>
            </div>
          </Card>
        )}

        <Card className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Next steps</h3>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
            {result.instructions.map((entry) => (
              <li key={entry} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden />
                <span className="min-w-0">{entry}</span>
              </li>
            ))}
          </ol>
          <dl className="mt-5 grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Employee code</dt>
              <dd className="font-semibold text-text-primary">{result.employeeCode || "Generated"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Role</dt>
              <dd className="font-semibold text-text-primary">{result.roleName || "—"}</dd>
            </div>
          </dl>
          <Link
            href={MANAGER_STAFF_ROUTES.directory}
            className="mt-5 inline-flex rounded-md px-2 py-1 text-sm font-semibold text-brand-navy-900 underline outline-none hover:bg-surface-muted focus-visible:shadow-focus"
          >
            Back to the directory
          </Link>
        </Card>
      </ManagerContentShell>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  const roleDescription = MANAGER_FRONTLINE_ROLES.find((role) => role.name === draft.roleName);

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Onboard frontline staff"
        badge={<Badge variant="info">Creates a real account in {branch.branchName}</Badge>}
      />

      <ManagerStatusPipeline
        ariaLabel="Onboarding progress"
        stages={MANAGER_ONBOARDING_STEPS.map((entry) => entry.label)}
        currentIndex={stepIndex}
      />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
        <Card className="min-w-0">
          {step === "identity" ? (
            <IdentityStep draft={draft} errors={touched ? errors : {}} onChange={update} />
          ) : step === "employment" ? (
            <EmploymentStep draft={draft} errors={touched ? errors : {}} onChange={update} />
          ) : (
            <ReviewStep draft={draft} branchName={branch.branchName} />
          )}

          {errorMessage ? (
            <p role="alert" className="mt-5 rounded-md bg-status-danger-surface px-3 py-2 text-sm font-semibold text-status-danger">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <Button
              variant="tertiary"
              disabled={stepIndex === 0 || onboarding.isPending}
              onClick={() => {
                setTouched(false);
                setStepIndex((current) => Math.max(0, current - 1));
              }}
            >
              Back
            </Button>
            {step === "review" ? (
              <Button
                variant="primary"
                disabled={!onboarding.isEnabled || onboarding.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                Create staff member
              </Button>
            ) : (
              <Button variant="primary" onClick={goNext}>
                Continue
              </Button>
            )}
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <Card className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
              What this creates
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
              <li>A login account and a branch membership in {branch.branchName}.</li>
              <li>An employee record with a start date and employment type.</li>
              <li>
                A Quick PIN, shown to you <strong>once</strong> and never retrievable again.
              </li>
            </ul>
            {roleDescription ? (
              <p className="mt-4 rounded-md bg-surface-muted px-3 py-2 text-sm text-text-secondary">
                {roleDescription.description}
              </p>
            ) : null}
          </Card>

          <Card className="min-w-0 bg-status-warning-surface">
            <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-status-warning">
              Not collected here
            </h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              No pay, contract, compensation profile, bank detail, tax identifier, date of birth,
              address or emergency contact is asked for or sent. No password is set — frontline staff
              sign in with the PIN.
            </p>
          </Card>
        </div>
      </div>

      <ActionConfirmDialog
        open={confirmOpen}
        title="Create this staff member?"
        tone="warning"
        confirmLabel="Create and issue PIN"
        pending={onboarding.isPending}
        consequence={`This creates a real login account and employee record for ${draft.firstName} ${draft.lastName} in ${branch.branchName}, and issues a Quick PIN that is displayed once. There is no undo from this workspace.`}
        context={
          <dl className="grid gap-1">
            <div className="flex justify-between gap-3">
              <dt>Role</dt>
              <dd className="font-semibold text-text-primary">{draft.roleName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Phone</dt>
              <dd className="font-semibold text-text-primary">{draft.phone}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Starts</dt>
              <dd className="font-semibold text-text-primary">{draft.hireDate}</dd>
            </div>
          </dl>
        }
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onboarding.submit(buildManagerOnboardPayload(draft));
        }}
      />
    </ManagerContentShell>
  );
}

// ── Steps ───────────────────────────────────────────────────────────────────

type StepProps = {
  draft: ManagerOnboardingDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<ManagerOnboardingDraft>) => void;
};

function FieldLabel({
  children,
  error,
  hint,
  label,
  required,
}: {
  children: React.ReactNode;
  error?: string;
  hint?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-text-secondary">
      <span>
        {label}
        {required ? <span className="text-status-danger"> *</span> : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="text-xs font-semibold text-status-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs font-medium text-text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

const inputClass =
  "min-h-11 rounded-md bg-surface-muted px-3 text-base font-medium text-text-primary shadow-subtle outline-none focus-visible:shadow-focus";

function IdentityStep({ draft, errors, onChange }: StepProps) {
  return (
    <>
      <h2 className="text-xl font-bold tracking-tight text-text-primary">Who they are</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Name and phone identify a frontline staff member. Email is optional — leave it blank for a
        PIN-only account.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <FieldLabel label="First name" required error={errors.firstName}>
          <input
            name="firstName"
            className={inputClass}
            value={draft.firstName}
            onChange={(event) => onChange({ firstName: event.target.value })}
          />
        </FieldLabel>
        <FieldLabel label="Last name" required error={errors.lastName}>
          <input
            name="lastName"
            className={inputClass}
            value={draft.lastName}
            onChange={(event) => onChange({ lastName: event.target.value })}
          />
        </FieldLabel>
        <FieldLabel
          label="Phone"
          required
          error={errors.phone}
          hint="Digits, spaces and + ( ) - only, 6-30 characters."
        >
          <input
            name="phone"
            inputMode="tel"
            className={inputClass}
            value={draft.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
          />
        </FieldLabel>
        <FieldLabel
          label="Work email"
          error={errors.email}
          hint="Optional. Without it, this person signs in with the PIN only."
        >
          <input
            name="email"
            type="email"
            className={inputClass}
            value={draft.email}
            onChange={(event) => onChange({ email: event.target.value })}
          />
        </FieldLabel>
      </div>
    </>
  );
}

function EmploymentStep({ draft, errors, onChange }: StepProps) {
  return (
    <>
      <h2 className="text-xl font-bold tracking-tight text-text-primary">Role and start</h2>
      <p className="mt-1 text-sm text-text-secondary">
        The role decides what they can do on the POS and how long their PIN is.
      </p>
      <div className="mt-5 grid gap-4">
        <fieldset>
          <legend className="text-sm font-semibold text-text-secondary">
            Role<span className="text-status-danger"> *</span>
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {MANAGER_FRONTLINE_ROLES.map((role) => (
              <label
                key={role.name}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md bg-surface-muted p-3 shadow-subtle",
                  draft.roleName === role.name && "ring-2 ring-brand-navy-900",
                )}
              >
                <input
                  type="radio"
                  name="roleName"
                  className="mt-1"
                  value={role.name}
                  checked={draft.roleName === role.name}
                  onChange={() => onChange({ roleName: role.name })}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-text-primary">{role.name}</span>
                  <span className="block text-xs leading-5 text-text-muted">{role.description}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.roleName ? (
            <p role="alert" className="mt-2 text-xs font-semibold text-status-danger">
              {errors.roleName}
            </p>
          ) : null}
          <p className="mt-2 text-xs leading-5 text-text-muted">
            Supervisor and Manager accounts are not created here — this flow onboards frontline floor
            staff only.
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldLabel label="Start date" required error={errors.hireDate}>
            <input
              name="hireDate"
              type="date"
              className={inputClass}
              value={draft.hireDate}
              onChange={(event) => onChange({ hireDate: event.target.value })}
            />
          </FieldLabel>
          <FieldLabel label="Employment type" required error={errors.employmentType}>
            <select
              name="employmentType"
              className={inputClass}
              value={draft.employmentType}
              onChange={(event) => onChange({ employmentType: event.target.value })}
            >
              {MANAGER_EMPLOYMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {titleCaseManagerStatus(value)}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel
            label="Employee code"
            error={errors.employeeCode}
            hint="Optional — one is generated if you leave this blank."
          >
            <input
              name="employeeCode"
              className={inputClass}
              value={draft.employeeCode}
              onChange={(event) => onChange({ employeeCode: event.target.value })}
            />
          </FieldLabel>
        </div>
      </div>
    </>
  );
}

function ReviewStep({ branchName, draft }: { branchName: string; draft: ManagerOnboardingDraft }) {
  const payload = buildManagerOnboardPayload(draft);
  return (
    <>
      <h2 className="text-xl font-bold tracking-tight text-text-primary">Review and create</h2>
      <p className="mt-1 text-sm text-text-secondary">
        This is exactly what will be sent. Nothing else is included.
      </p>
      <dl className="mt-5">
        {(
          [
            ["Name", `${payload.firstName} ${payload.lastName}`],
            ["Phone", payload.phone],
            ["Work email", payload.email || "None — PIN-only account"],
            ["Role", payload.roleName],
            ["Branch", branchName],
            ["Employment", titleCaseManagerStatus(payload.employee.employmentType)],
            ["Start date", draft.hireDate],
            ["Employee code", payload.employee.employeeCode || "Generated by the system"],
            ["Quick PIN", "Issued now and shown once"],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle/60 py-2 last:border-b-0"
          >
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">{label}</dt>
            <dd className="min-w-0 text-sm font-semibold text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export type { ManagerOnboardingStepKey };
