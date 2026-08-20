import { useEffect, useState } from "react";

import { Badge, Button, Card } from "@/components/ui";
import type { ManagerOneTimeSecret } from "@/lib/manager/staff-types";

/**
 * The one-time credential display (Track B3).
 *
 * `POST /hr/frontline-staff/onboard` and `POST /:id/quick-pin/reset` each return
 * a **plaintext** Quick PIN exactly once (MP0-14 / MANAGER-GAP-005). The backend
 * cannot show it again — there is only a hash — so this component is the single
 * moment the value exists in a human-readable form.
 *
 * The rules it enforces, all of them checked by `manager-b3-assertions.ts`:
 *
 * - **Masked by default.** The value renders as dots until the manager reveals
 *   it deliberately, so it is not sitting on screen behind someone's shoulder or
 *   in a screen-share while the form is filled in.
 * - **Copy once, then say so.** Copying is offered because writing an 8-digit
 *   PIN by hand invites transcription errors; after a copy the button reports
 *   that it was copied rather than silently allowing repeat copies to feel free.
 * - **Never persisted.** No `localStorage`, no `sessionStorage`, no cookie, no
 *   query key, no URL parameter, no `console.*`. The value lives in this
 *   component's props for the life of one panel and is dropped on dismiss.
 * - **Cleared on unmount.** The reveal state resets whenever the secret changes,
 *   so a second reset never opens already-revealed.
 */
type ManagerOneTimeSecretPanelProps = {
  secret: ManagerOneTimeSecret;
  title: string;
  subject: string;
  onDismiss: () => void;
  dismissLabel?: string;
};

export function ManagerOneTimeSecretPanel({
  dismissLabel = "I have shared it",
  onDismiss,
  secret,
  subject,
  title,
}: ManagerOneTimeSecretPanelProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRevealed(false);
    setCopied(false);
  }, [secret.value]);

  return (
    <Card className="min-w-0 bg-status-warning-surface" data-manager-one-time-secret>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        <Badge variant="warning">Shown once</Badge>
      </div>

      <p className="mt-2 text-sm leading-6 text-text-secondary">
        This is the only time {subject}&apos;s PIN can be read. It is stored as a hash, so it cannot be
        looked up later — if it is lost, issue a new one, which invalidates this one immediately.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p
          data-manager-secret-value={revealed ? "revealed" : "masked"}
          aria-live="polite"
          className="rounded-md bg-surface px-4 py-3 font-mono text-2xl font-bold tracking-[0.35em] text-text-primary shadow-subtle"
        >
          {revealed ? secret.value : "•".repeat(secret.length || secret.value.length)}
        </p>
        <Button variant="secondary" onClick={() => setRevealed((current) => !current)}>
          {revealed ? "Hide" : "Reveal"}
        </Button>
        <Button
          variant="tertiary"
          disabled={copied}
          onClick={() => {
            // Clipboard only — the value is never written to any storage API.
            void navigator.clipboard?.writeText(secret.value).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <p className="mt-3 text-xs leading-5 text-text-muted">
        {secret.length ? `${secret.length}-digit PIN` : "PIN"}
        {secret.tier ? ` · ${secret.tier.replace(/_/g, " ").toLowerCase()} tier` : ""} · {secret.note}
      </p>

      <div className="mt-5">
        <Button variant="primary" onClick={onDismiss}>
          {dismissLabel}
        </Button>
      </div>
    </Card>
  );
}
