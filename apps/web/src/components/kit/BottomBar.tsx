import { KitIcon } from "./KitIcon";
import type { KitSection } from "./sections";
import { FOCUS, MOTION, TAP, focusLook, type KitDemo } from "./states";

export type BarProps = {
  /** From `kit/sections.ts`. */
  sections: readonly KitSection[];
  currentKey: string;
  /** A count badge per section key, e.g. { ready: 2 }. */
  counts?: Readonly<Record<string, number>>;
  /** Accessible name of the bar. */
  label?: string;
  /** Gallery only: force a look on one section. */
  demo?: { key: string; look: KitDemo };
};

function accessibleName(s: KitSection, count: number | undefined): string {
  return count ? `${s.label}, ${count}` : s.label;
}

/**
 * The terminal bottom bar (R8): 76 px navy, equal sections 56 px high, a 28 px
 * icon beside a 17 px label, the current one a white block, a count in a badge.
 */
export function BottomBar({ sections, currentKey, counts, label = "Main", demo }: BarProps) {
  return (
    <nav
      aria-label={label}
      className="grid h-kit-bottom-bar flex-none auto-cols-fr grid-flow-col gap-kit-8 bg-kit-primary px-kit-24 py-kit-10 font-kit"
    >
      {sections.map((s) => {
        const on = s.key === currentKey;
        const count = counts?.[s.key];
        const look = demo?.key === s.key ? demo.look : undefined;
        return (
          <a
            key={s.key}
            href={s.href}
            aria-current={on ? "page" : undefined}
            aria-label={accessibleName(s, count)}
            data-kit-section={s.key}
            className={[
              "flex h-kit-section min-w-0 items-center justify-center gap-kit-10 rounded-kit-control text-kit-nav",
              on
                ? "bg-kit-card text-kit-primary font-kit-extrabold"
                : look === "pressed"
                  ? "bg-kit-primary-2 text-kit-on-primary"
                  : "text-kit-on-primary-muted active:bg-kit-primary-2",
              FOCUS,
              focusLook(look),
              MOTION,
              TAP,
            ].join(" ")}
          >
            <KitIcon name={s.icon} size="bar" current={on} />
            <span className="whitespace-nowrap">{s.label}</span>
            {count ? (
              <span
                aria-hidden="true"
                className={[
                  "inline-flex h-kit-badge min-w-kit-badge flex-none items-center justify-center rounded-kit-badge px-kit-7 text-kit-badge",
                  on ? "bg-kit-primary text-kit-on-primary" : "bg-kit-card text-kit-primary",
                ].join(" ")}
              >
                {count}
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}

/**
 * The phone tab bar: 84 px navy, 56 px sections, a 24 px icon over a 12 px
 * label, the current one a white block, a count in a small badge.
 */
export function TabBar({ sections, currentKey, counts, label = "Main", demo }: BarProps) {
  return (
    <nav aria-label={label} className="flex h-kit-tab-bar flex-none gap-kit-4 bg-kit-primary px-kit-8 pb-kit-20 pt-kit-8 font-kit">
      {sections.map((s) => {
        const on = s.key === currentKey;
        const count = counts?.[s.key];
        const look = demo?.key === s.key ? demo.look : undefined;
        return (
          <a
            key={s.key}
            href={s.href}
            aria-current={on ? "page" : undefined}
            aria-label={accessibleName(s, count)}
            data-kit-section={s.key}
            className={[
              "relative flex h-kit-section min-w-0 flex-1 flex-col items-center justify-center gap-kit-2 rounded-kit-control text-center text-kit-bar",
              on
                ? "bg-kit-card text-kit-primary font-kit-extrabold"
                : look === "pressed"
                  ? "bg-kit-primary-2 text-kit-on-primary"
                  : "text-kit-on-primary-muted active:bg-kit-primary-2",
              FOCUS,
              focusLook(look),
              MOTION,
              TAP,
            ].join(" ")}
          >
            <KitIcon name={s.icon} current={on} />
            {s.label}
            {count ? (
              <span
                aria-hidden="true"
                className={[
                  "absolute right-kit-5 top-kit-1 inline-flex h-kit-badge-phone min-w-kit-badge-phone items-center justify-center rounded-kit-badge px-kit-4 text-kit-badge-phone",
                  on ? "bg-kit-primary text-kit-on-primary" : "bg-kit-card text-kit-primary",
                ].join(" ")}
              >
                {count}
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}
