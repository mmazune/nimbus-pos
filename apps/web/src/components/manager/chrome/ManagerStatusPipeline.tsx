import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

/**
 * The Odoo **C14 statusbar pipeline** (Track B3, reference screenshots `06`/`09`:
 * `Draft ▸ Posted` with the reached stage highlighted).
 *
 * Two honesty rules the reference does not impose on itself:
 *
 * - The stages are the **real backend lifecycle**, never a borrowed one. Odoo's
 *   employee statusbar reads `Invited ▸ Confirmed`; Nimbus has no invite-by-email
 *   flow at all (NG-08), so Staff renders its own real states instead.
 * - A record that is **off the pipeline** — a voided order, an archived employee —
 *   renders as an explicit exit chip rather than being forced onto a stage it
 *   never reached. `currentIndex: -1` is what asks for that.
 *
 * This is **presentation only**: unlike Odoo's, no stage here is clickable,
 * because Operations is read-only oversight and clicking a stage in Odoo performs
 * a state write.
 */
type ManagerStatusPipelineProps = {
  stages: readonly string[];
  /** Index into `stages`, or -1 when the record left the pipeline. */
  currentIndex: number;
  /** Rendered instead of the stages when `currentIndex` is -1. */
  exitLabel?: string;
  exitTone?: "danger" | "warning" | "neutral";
  ariaLabel: string;
};

export function ManagerStatusPipeline({
  ariaLabel,
  currentIndex,
  exitLabel,
  exitTone = "danger",
  stages,
}: ManagerStatusPipelineProps) {
  if (currentIndex < 0) {
    return (
      <div className="flex items-center gap-2" data-manager-status-pipeline="exit" aria-label={ariaLabel}>
        <Badge variant={exitTone}>{exitLabel || "Off pipeline"}</Badge>
      </div>
    );
  }

  return (
    <ol
      className="flex flex-wrap items-center gap-1"
      data-manager-status-pipeline="pipeline"
      aria-label={ariaLabel}
    >
      {stages.map((stage, index) => {
        const reached = index <= currentIndex;
        const current = index === currentIndex;
        return (
          <li
            key={stage}
            aria-current={current ? "step" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-[0.06em]",
              current
                ? "bg-brand-navy-900 text-text-inverse"
                : reached
                  ? "bg-surface-muted text-text-primary"
                  : "text-text-muted",
            )}
          >
            {stage}
          </li>
        );
      })}
    </ol>
  );
}
