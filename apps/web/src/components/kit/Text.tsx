import type { ElementType, ReactNode } from "react";

/** The seven styles, the laptop title and caps label from kit.css, and the three extras. */
export type TextVariant =
  | "title"
  | "titleLg"
  | "h"
  | "row"
  | "body"
  | "sup"
  | "small"
  | "bar"
  | "cap"
  | "ticket"
  | "key"
  | "big";

export type TextTone =
  | "text"
  | "muted"
  | "primary"
  | "onPrimary"
  | "onPrimaryMuted"
  | "link"
  | "red"
  | "amber"
  | "green";

const VARIANT: Record<TextVariant, string> = {
  title: "text-kit-title",
  titleLg: "text-kit-title-lg",
  h: "text-kit-h",
  row: "text-kit-row",
  body: "text-kit-body",
  sup: "text-kit-sup",
  small: "text-kit-small",
  bar: "text-kit-bar",
  cap: "text-kit-cap uppercase",
  ticket: "text-kit-ticket",
  key: "text-kit-key",
  big: "text-kit-big",
};

const TONE: Record<TextTone, string> = {
  text: "text-kit-text",
  muted: "text-kit-muted",
  primary: "text-kit-primary",
  onPrimary: "text-kit-on-primary",
  onPrimaryMuted: "text-kit-on-primary-muted",
  link: "text-kit-link",
  red: "text-kit-red",
  amber: "text-kit-amber",
  green: "text-kit-green",
};

export type TextProps = {
  variant: TextVariant;
  tone?: TextTone;
  /** Bold inside body text (kit.css `.b`). */
  strong?: boolean;
  align?: "start" | "end" | "center";
  as?: ElementType;
  id?: string;
  /** Keep on one line. A money figure ("− UGX 151,000") always does. */
  nowrap?: boolean;
  children: ReactNode;
};

/** "UGX 18,500", "− 151,000", "+ UGX 2,000": a sign or currency must never sit alone on a line. */
const MONEY = /^[−+-]?\s*(UGX\s*)?[−+-]?\s*\d[\d,]*(\.\d+)?$/;

export function Text({ variant, tone, strong = false, align = "start", as, id, nowrap = false, children }: TextProps) {
  const oneLine = nowrap || (typeof children === "string" && MONEY.test(children.trim()));
  const Tag = as ?? (variant === "title" || variant === "titleLg" ? "h1" : variant === "h" ? "h2" : "p");
  return (
    <Tag
      id={id}
      className={[
        "m-kit-0 font-kit tabular-nums",
        VARIANT[variant],
        tone ? TONE[tone] : "",
        strong ? "font-kit-bold" : "",
        align === "end" ? "text-right" : align === "center" ? "text-center" : "text-left",
        oneLine ? "whitespace-nowrap flex-none" : "",
      ].join(" ")}
    >
      {children}
    </Tag>
  );
}
