import { Button } from "./Button";

export type BannerProps = {
  tone: "amber" | "red";
  /** One line, bold. */
  title: string;
  /** What has been done or what to do, after it. */
  detail?: string;
  /** The one button. */
  action?: { label: string; onClick?: () => void };
};

/** A one-line warning on a tint, with one button (Kitchen-Store). */
export function Banner({ tone, title, detail, action }: BannerProps) {
  const ink = tone === "amber" ? "text-kit-amber" : "text-kit-red";
  return (
    <div
      role="status"
      className={[
        "flex items-center gap-kit-12 rounded-kit-control px-kit-16 py-kit-12 font-kit",
        tone === "amber" ? "bg-kit-amber-t" : "bg-kit-red-t",
      ].join(" ")}
    >
      <p className={["m-kit-0 min-w-0 flex-1", ink].join(" ")}>
        <span className="text-kit-body font-kit-bold">{title}</span>
        {detail ? <span className="text-kit-sup"> {detail}</span> : null}
      </p>
      {action ? (
        <Button tone="tonal" size="laptop" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
