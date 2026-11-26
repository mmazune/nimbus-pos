/*
 * Sample tiles for the gallery's two walls, copied from the approved drawings
 * Main.png and Floor-1024.png. Every name, table and amount is made up
 * (design/screens/README.md rule 6) — never seed or test data.
 */
import type { TableState } from "@/components/kit";

export type SampleTile = {
  name: string;
  state: TableState;
  others?: boolean;
  detail: string;
  who?: string;
  amount?: string;
  short: string;
};

const F = (name: string, seats: string): SampleTile => ({ name, state: "free", detail: seats, short: seats });

export const mainHall: readonly SampleTile[] = [
  F("1", "4 seats"),
  { name: "2", state: "open", detail: "4 guests · 42 min", who: "You", amount: "86,000", short: "42 min" },
  { name: "3", state: "open", others: true, detail: "2 guests · 18 min", who: "Brian O.", amount: "54,000", short: "18 min" },
  F("4", "2 seats"),
  { name: "5", state: "bill", others: true, detail: "6 guests · 1 h 20", who: "Grace N.", amount: "132,000", short: "1 h 20" },
  { name: "6", state: "late", detail: "Food 26 min late", who: "You", amount: "61,000", short: "26 min" },
  { name: "7", state: "reserved", detail: "20:00 · 6 guests", short: "20:00 · 6 guests" },
  F("8", "4 seats"),
  { name: "9", state: "open", detail: "2 guests · 9 min", who: "You", amount: "24,000", short: "9 min" },
  { name: "10", state: "open", others: true, detail: "5 guests · 51 min", who: "David S.", amount: "118,500", short: "51 min" },
  F("11", "4 seats"),
  { name: "12", state: "bill", detail: "3 guests · 1 h 05", who: "You", amount: "98,000", short: "1 h 05" },
  { name: "13", state: "open", others: true, detail: "4 guests · 33 min", who: "Grace N.", amount: "72,000", short: "33 min" },
  F("14", "6 seats"),
  { name: "15", state: "cleaning", detail: "4 seats", short: "4 seats" },
  { name: "16", state: "open", others: true, detail: "2 guests · 27 min", who: "Brian O.", amount: "38,000", short: "27 min" },
  { name: "17", state: "open", detail: "4 guests · 14 min", who: "You", amount: "45,000", short: "14 min" },
  F("18", "4 seats"),
  { name: "19", state: "late", others: true, detail: "Food 31 min late", who: "David S.", amount: "66,000", short: "31 min" },
  { name: "20", state: "open", others: true, detail: "3 guests · 40 min", who: "Grace N.", amount: "59,000", short: "40 min" },
  { name: "21", state: "reserved", detail: "20:30 · 4 guests", short: "20:30 · 4 guests" },
  F("22", "2 seats"),
  { name: "23", state: "notSent", detail: "3 items not sent", who: "You", amount: "19,000", short: "3 items" },
  { name: "24", state: "open", others: true, detail: "4 guests · 22 min", who: "Brian O.", amount: "81,000", short: "22 min" },
  F("25", "4 seats"),
  { name: "26", state: "open", others: true, detail: "2 guests · 12 min", who: "David S.", amount: "27,000", short: "12 min" },
  F("27", "8 seats"),
  { name: "28", state: "bill", others: true, detail: "4 guests · 1 h 34", who: "Grace N.", amount: "164,000", short: "1 h 34" },
  F("29", "4 seats"),
  { name: "30", state: "open", others: true, detail: "6 guests · 48 min", who: "Brian O.", amount: "143,500", short: "48 min" },
  F("31", "2 seats"),
  F("32", "4 seats"),
];

/** The 7 × 5 compact wall: the 32 drawn tiles plus three more free tables. */
export const compactHall: readonly SampleTile[] = [...mainHall, F("33", "4 seats"), F("34", "2 seats"), F("35", "6 seats")];

export const areas = [
  { key: "main", label: "Main hall", count: 32 },
  { key: "terrace", label: "Terrace", count: 16 },
  { key: "bar", label: "Bar", count: 10 },
  { key: "vip", label: "VIP", count: 6 },
  { key: "tabs", label: "Tabs", count: 6 },
] as const;
