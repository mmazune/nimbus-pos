import { BarSearch, type SearchSize } from "./TouchHeader";
import { KitIcon } from "./KitIcon";
import { FOCUS, MOTION, TAP } from "./states";

export type OrderHeaderProps = {
  /** Where back goes, e.g. "Floor". */
  backLabel: string;
  onBack?: () => void;
  title: string;
  /** e.g. "3 guests · open 1 h 05 · Amina K." */
  context?: string;
  searchLabel: string;
  searchSize?: SearchSize;
  onSearch?: () => void;
  initials: string;
  personName: string;
};

/** The 60 px header on an open table: back, the table, its facts, search the menu, who is signed in. */
export function OrderHeader({ backLabel, onBack, title, context, searchLabel, searchSize = "large", onSearch, initials, personName }: OrderHeaderProps) {
  return (
    <header className="flex h-kit-app-bar flex-none items-center gap-kit-20 bg-kit-primary px-kit-24 text-kit-on-primary font-kit">
      <button
        type="button"
        onClick={onBack}
        className={[
          "flex h-kit-target flex-none items-center gap-kit-6 rounded-kit-control bg-kit-primary-2 pl-kit-8 pr-kit-14 text-kit-button text-kit-on-primary",
          "active:bg-kit-primary",
          FOCUS,
          MOTION,
          TAP,
        ].join(" ")}
      >
        <KitIcon name="back" />
        {backLabel}
      </button>
      <h1 className="m-kit-0 whitespace-nowrap text-kit-h">{title}</h1>
      {context ? <span className="whitespace-nowrap text-kit-sup text-kit-on-primary-muted">{context}</span> : null}
      <span className="min-w-0 flex-1" />
      <BarSearch label={searchLabel} size={searchSize} onClick={onSearch} />
      <span
        title={personName}
        aria-label={`Signed in: ${personName}`}
        className="flex h-kit-target w-kit-target flex-none items-center justify-center rounded-kit-full bg-kit-on-primary text-kit-initials text-kit-primary"
      >
        {initials}
      </span>
    </header>
  );
}
