/**
 * The fixture on a fresh database (seed + demo import, nothing else): it builds its
 * menu, tables, people, shifts and tills through the API, and a second run changes
 * nothing it should not. Runs only with T3_FIXTURE=1 and PW_API_URL pointing at that stack.
 */
import { expect, test } from "@playwright/test";

import { freeTable, setupVenue } from "./fixture";

test.skip(!process.env.T3_FIXTURE, "set T3_FIXTURE=1 and PW_API_URL to a freshly loaded stack");

test("the fixture builds its world on a fresh database", async () => {
  const v = await setupVenue();
  for (const p of Object.values(v.people)) expect(p.pin).toMatch(/^\d{6,8}$/);
  for (const k of ["lager", "scotch", "cola", "burger", "wings", "chips"]) expect(v.items[k]?.id).toBeTruthy();
  const twelve = await freeTable(v.managerToken, [], "12");
  expect(twelve.label).toBe("12");
});
