import { RoundAction } from "./Button";
import type { OperationalIconName } from "@/components/pos-shell/role-icons";

export type HeaderAction = { icon: OperationalIconName; label: string; onClick?: () => void };

export type HeaderBandProps = {
  title: string;
  /** One line: a greeting, or a count with a clock. */
  summary?: string;
  /** At most two round 44 px buttons on the right. */
  actions?: readonly [HeaderAction] | readonly [HeaderAction, HeaderAction];
  /** A record screen: a round back button replaces the title row. */
  onBack?: () => void;
  backLabel?: string;
};

/** Phone header band in the brand navy, 20 px padding. */
export function HeaderBand({ title, summary, actions, onBack, backLabel = "Back" }: HeaderBandProps) {
  return (
    <header className="flex-none bg-kit-primary p-kit-20 text-kit-on-primary font-kit">
      <div className="flex items-center gap-kit-12">
        {onBack ? <RoundAction icon="back" label={backLabel} size="small" tone="onPrimary" onClick={onBack} /> : null}
        <div className="min-w-0 flex-1">
          <h1 className={onBack ? "m-kit-0 text-kit-h" : "m-kit-0 text-kit-title"}>{title}</h1>
          {onBack && summary ? <p className="m-kit-0 text-kit-sup text-kit-on-primary-muted">{summary}</p> : null}
        </div>
        {actions?.map((a) => (
          <RoundAction key={a.label} icon={a.icon} label={a.label} size="small" tone="onPrimary" onClick={a.onClick} />
        ))}
      </div>
      {!onBack && summary ? <p className="m-kit-0 text-kit-body text-kit-on-primary-muted">{summary}</p> : null}
    </header>
  );
}
