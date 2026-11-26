/**
 * T5 — the demo venue's people, as `e2e/t5/stack.sh` hands them over.
 *
 * T5_SIGNIN is `key=email|password|pin,…`, read by stack.sh from the loader's stderr into this
 * process's environment. Nothing here writes, logs or prints a password or a PIN.
 */
export type VenueKey =
  | "owner1" | "manager1" | "manager2" | "supervisor1" | "supervisor2" | "cashier1" | "cashier2"
  | "waiter1" | "waiter2" | "waiter3" | "waiter4" | "bartender1" | "bartender2" | "chef1" | "chef2" | "chef3";

export type VenuePerson = { key: string; email: string; password: string; pin: string };

let cache: Map<string, VenuePerson> | null = null;

export function venuePeople(): Map<string, VenuePerson> {
  if (cache) return cache;
  const raw = process.env.T5_SIGNIN;
  if (!raw) throw new Error("T5_SIGNIN is not set: run the suite through e2e/t5/stack.sh");
  cache = new Map(
    raw.split(",").filter(Boolean).map((entry) => {
      const eq = entry.indexOf("=");
      const key = entry.slice(0, eq);
      const [email, password, pin] = entry.slice(eq + 1).split("|");
      return [key, { key, email, password, pin }];
    }),
  );
  return cache;
}

export function venuePerson(key: VenueKey | string): VenuePerson {
  const p = venuePeople().get(key);
  if (!p) throw new Error(`no demo-venue person "${key}"`);
  return p;
}

export const onVenue = () => Boolean(process.env.T5_SIGNIN);
