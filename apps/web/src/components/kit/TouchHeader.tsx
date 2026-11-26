import { RoundAction } from "./Button";
import { KitIcon } from "./KitIcon";
import { FOCUS, MOTION, TAP } from "./states";

export type SearchSize = "small" | "regular" | "large";
const SEARCH_W: Record<SearchSize, string> = {
  small: "w-kit-search-w-sm",
  regular: "w-kit-search-w",
  large: "w-kit-search-w-lg",
};

/** The search box in a navy bar. 44 px tall so it is a real target (the drawing's 40 is a picture). */
export function BarSearch({ label, size = "regular", onClick }: { label: string; size?: SearchSize; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-kit-target flex-none items-center gap-kit-8 rounded-kit-seg bg-kit-primary-2 px-kit-12 text-left text-kit-sup text-kit-on-primary-muted",
        SEARCH_W[size],
        "active:bg-kit-primary",
        FOCUS,
        MOTION,
        TAP,
      ].join(" ")}
    >
      <KitIcon name="search" size="inButton" />
      {label}
    </button>
  );
}

export type TouchHeaderProps = {
  title: string;
  /** e.g. "Main hall · 17 of 32 tables open · as at 19:42" */
  context?: string;
  searchLabel: string;
  searchSize?: SearchSize;
  onSearch?: () => void;
  person: { name: string; role: string; station?: string };
  onLock?: () => void;
  /** Where the mark goes: the role's home. */
  homeHref: string;
};

/** The 64 px header on touch terminals: mark, title, context, search, who is signed in, lock. */
export function TouchHeader({ title, context, searchLabel, searchSize = "regular", onSearch, person, onLock, homeHref }: TouchHeaderProps) {
  return (
    <header className="flex h-kit-touch-header flex-none items-center gap-kit-20 bg-kit-primary px-kit-24 text-kit-on-primary font-kit">
      <a
        href={homeHref}
        aria-label="Nimbus POS, home"
        className={["flex h-kit-target w-kit-target flex-none items-center justify-center rounded-kit-control", FOCUS].join(" ")}
      >
        <span className="block h-kit-mark w-kit-mark rounded-kit-qty bg-kit-on-primary" aria-hidden="true" />
      </a>
      <h1 className="m-kit-0 whitespace-nowrap text-kit-h">{title}</h1>
      {context ? <span className="whitespace-nowrap text-kit-sup text-kit-on-primary-muted">{context}</span> : null}
      <span className="min-w-0 flex-1" />
      <BarSearch label={searchLabel} size={searchSize} onClick={onSearch} />
      <span className="whitespace-nowrap text-kit-sup text-kit-on-primary-muted">
        <b className="font-kit-bold text-kit-on-primary">{person.name}</b> · {person.role}
        {person.station ? ` · ${person.station}` : ""}
      </span>
      <RoundAction icon="lock" label="Lock the screen" size="small" tone="bar" onClick={onLock} />
    </header>
  );
}
