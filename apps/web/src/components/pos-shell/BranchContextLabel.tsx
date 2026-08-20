import { operationalIcons, operationalIconSizes, operationalIconWeights } from "./role-icons";
import { NimbusLogomark } from "./NimbusLogomark";

type BranchContextLabelProps = {
  branchLabel: string;
  contextKind: "service-area" | "workstation";
  contextLabel: string;
};

export function BranchContextLabel({
  branchLabel,
  contextKind,
  contextLabel,
}: BranchContextLabelProps) {
  const ContextIcon = operationalIcons[contextKind === "service-area" ? "serviceArea" : "workstation"];

  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      {/* Density pass 2026-08-20: brand tile 2.75rem -> 2.25rem. */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-white text-brand-navy-900 shadow-subtle">
        <NimbusLogomark size={operationalIconSizes.bottomNavigation} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[0.625rem] font-semibold uppercase tracking-wide text-brand-silver sm:text-xs">
          Nimbus POS
        </p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-semibold sm:gap-2 sm:text-sm">
          <span className="max-w-[11rem] truncate lg:max-w-[14rem] xl:max-w-[18rem]" title={branchLabel}>
            {branchLabel}
          </span>
          <span className="shrink-0 text-brand-silver" aria-hidden>/</span>
          <ContextIcon
            className="hidden shrink-0 text-brand-silver sm:block"
            size={operationalIconSizes.compactAction}
            weight={operationalIconWeights.default}
            aria-hidden
          />
          <span className="hidden max-w-[9rem] truncate text-brand-silver sm:block lg:max-w-[12rem] xl:max-w-[16rem]" title={contextLabel}>
            {contextLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
