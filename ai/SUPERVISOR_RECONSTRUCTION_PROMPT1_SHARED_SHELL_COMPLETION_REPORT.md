> ⚠️ **SUPERSEDED IN PART (2026-08-20).** Historical record; the brand palette and favicon were rebranded Aug 2026 — see `docs/BRAND_IDENTITY.md`. Kept for history.

# Supervisor Reconstruction Prompt 1 — Shared Shell Completion Report

Date: 2026-07-18
Final status: Complete; Prompt 2 not started
Repository: `C:\Users\arman\Desktop\nimbus-pos`

## Repository and initial safety result

- Confirmed the exact requested repository path and did not use `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`.
- Initial branch: `main`, tracking `origin/main`.
- Initial status: substantially dirty before Prompt 1. Modified and untracked work covered API auth/performance, Prisma demo import/seed, Waiter floor/order/profile, Cashier queue/receipt/till/profile, Supervisor Prompt 0 documentation, shared profile/toast/UI, global styling, and milestone reports. These changes were treated as user-owned and preserved.
- Prompt 0 reconstruction documents were present and retained. The initial and final Postman diff was empty.
- No reset, restore, stash, clean, discard, commit, push, backend process kill, API contract edit, Prisma edit, seed edit, or Postman edit occurred.
- The only process restarted was the verified Nimbus web production listener on port 3000 after the final build. The API listener and unrelated processes remained untouched. Two timed-out, outside-repository Playwright diagnostic trees were stopped by their exact verified PIDs.

## Implementations inspected

- Waiter: `WaiterShell`, `WaiterHeader`, `WaiterBottomNav`, `WaiterShiftBanner`, `WaiterSessionGuard`, idle logout, route registry, former role-owned `CurrentTime`, page-container offsets, Floor/Reservations/Me pages, and order workspace routes.
- Cashier: shell, header, bottom nav, readiness strip, session guard, context/till presentation, route registry, Queue/Receipts/Till/Me pages, and page offsets.
- Supervisor: shell, header, bottom nav, readiness strip, session guard, route registry, all five original pages, Floor table detail, and order-resolution components.
- Shared: `AuthProvider`, Button, profile primitives, toast provider, global CSS, Tailwind tokens, auth role helpers, API client, query providers, and logout/token behavior.

## Differences found before migration

### Header and shell

| Concern | Waiter before | Cashier/Supervisor before | Prompt 1 result |
|---|---|---|---|
| Header/readiness height | 80 px + 40 px | 80 px + 44 px | 80 px + 44 px shared slots |
| Max content width | 1920 px | 1600 px | 1600 px shared |
| Content top offset | 144 px | 160 px | 160 px shared |
| Minimum canvas | None | Cashier guard/readiness could force 1280 px | No forced minimum canvas |
| Clock | Waiter-owned; hidden below `lg` | Separate copies; hidden below `xl` | One centered shared instance, compact at narrow widths |
| Identity | Text only | Initials avatar plus text | Shared initials, truncation, name, and role presentation |
| Logout | `Sign out`, role-owned placement | `Logout`, separate implementations | One visible shared Logout action and pending state |
| Context | Branch/service-area conventions differed | Branch/workstation conventions differed | Stable slot with truthful unavailable fallbacks |

### Navigation and icons

- Waiter, Cashier, and Supervisor each had separate bottom-nav markup, dimensions, icon sizes, active treatments, and focus behavior.
- Supervisor Floor used `GridFour` while Waiter Floor used `SquaresFour`.
- Route registries selected independent icon components and Supervisor exposed five destinations including Orders.
- The migration centralizes presentation, size/weight constants, and concept icons while keeping labels and routes role-owned.

## Shared architecture implemented

- `OperationalShell` owns the fixed header/readiness/nav layers, 1600 px content maximum, responsive padding, 160 px top offset, 112 px bottom clearance, safe-area padding, and stable z-index order.
- `OperationalHeader` owns Nimbus identity, branch/context, centered time, employee identity/role, and logout placement. It mounts once at every viewport.
- `OperationalBottomNav` renders role-provided destinations with equal-width columns, a shared 24 px icon size, explicit matching, `aria-current="page"`, and one semantic navigation landmark.
- `CurrentTime` is a memoized shared component with one 30-second timer per mounted header, tabular numerals, the established locale format, no API request, and `aria-live="off"`.
- `OperationalIdleLogoutHandler` contains the common Waiter/Cashier idle-session interaction without changing Supervisor idle semantics.
- Direct component imports and a memoized time leaf prevent shell/provider rerenders and duplicate timers.

Role wrappers remain thin adapters. Guards, readiness queries, shift/till state, permissions, React Query keys, API calls, mutations, and business logic remain outside the shared shell.

## Role adapters and navigation

- Waiter supplies branch plus service-area context, Waiter identity, shift banner, and exactly Floor/Reservations/Me.
- Cashier supplies branch plus workstation context, Cashier identity, shift/till readiness, and its unchanged approved Queue/Receipts/Till/Me navigation.
- Supervisor supplies branch plus workstation context, Supervisor identity, Supervisor readiness, and exactly Floor/Reservations/Approvals/Me.
- Explicit match functions keep Waiter table/order workspace routes associated with Floor, while `/supervisor/orders` activates no visible tab.
- Existing role session guards remain authoritative; the shell adds no auth check or `/api/auth/me` query.

## Canonical icon registry

The shared registry defines Floor (`SquaresFour`), Reservations (`CalendarCheck`), Approvals (`ShieldCheck`), Me (`UserCircle`), Back, Search, Close, Refresh, Logout, Branch/location, Workstation, Service area, Time, Warning, Success, and Table. Cashier-specific navigation concepts also resolve through the same registry extension. Equivalent Waiter/Supervisor Floor and Reservations destinations now consume the same icon name, component, shared navigation size, and weight.

## Supervisor Orders removal and legacy compatibility

- Orders was removed from the Supervisor route registry and bottom navigation. There is no empty slot, hidden link, or Orders active state.
- The Approvals related-order action now links directly to `/supervisor/floor?orderId=...`; no normal UI control targets the legacy route.
- `/supervisor/orders` uses `router.replace` to `/supervisor/floor` without mutation.
- `tableId` is preserved.
- `orderId` is read once through the existing order-detail endpoint. If the order has a table, Floor receives both `tableId` and `orderId`. If table resolution is unavailable, `orderId` remains truthful Floor lookup context; no table is fabricated and the reference is not discarded.
- Refresh after redirect was stable. Browser Back returned to the prior `/supervisor/me` page rather than looping through the compatibility route.
- Existing Supervisor order resolution components are retained for later Floor-workspace migration in Prompts 2-3.

## Responsive and accessibility results

- Authenticated checks passed at 1024×768, 1366×768, 1440×900, and 1920×1080 for all three roles.
- Every role/viewport had exactly one operational shell, header, and bottom nav; zero horizontal overflow; fixed 80 px header; bottom nav at the viewport edge; and page content clearing both fixed regions.
- Clock and logout positions matched across roles at every viewport. Branch/context and identity areas use `min-width: 0` plus truncation; secondary avatar/name detail reduces before critical role/logout controls.
- Header, nav, and time use semantic elements. Active destinations expose `aria-current="page"`; visible-text icons are `aria-hidden`; Logout has an accessible name and at least a 44 px target; the time is not continuously announced.
- Keyboard-origin focus uses the global `:focus-visible` shadow token. The first QA harness used programmatic `.focus()`, which correctly did not activate keyboard-only `:focus-visible`; source inspection confirmed the common Button and nav controls inherit the visible keyboard focus rule.
- No second desktop/mobile header or shell is mounted. Existing reduced-motion global behavior is preserved.

## Performance and request-count result

Representative login request counts were unchanged before versus after:

| Role | Baseline login/landing | After migration | Navigation result |
|---|---:|---:|---|
| Waiter | 9 total; 2 existing `/api/auth/me` | 9 total; same 2 `/api/auth/me` | Floor → Reservations added 0; no shell/auth remount |
| Cashier | 6 total; 2 existing `/api/auth/me` | 6 total; same 2 `/api/auth/me` | Queue → Receipts → Me added 0 |
| Supervisor | 7 total; 2 existing `/api/auth/me` | 7 total; same 2 `/api/auth/me` | Floor → Reservations → Approvals added 0; no shell/auth remount |

The existing two-login-restore `/api/auth/me` reads were not introduced or increased by Prompt 1. Delayed page-owned reservation/profile reads sometimes completed after the harness moved to the next route; no new shell query exists. Hard navigation through legacy Orders remounts the existing page guard once, and order-based compatibility resolution called its detail endpoint exactly once. All captured API responses were successful. `net::ERR_ABORTED` entries were in-flight page reads cancelled by deliberately immediate harness navigation, not HTTP failures or retry storms.

## Authenticated QA

### Waiter

- Demo login landed on Floor; shared header, clock, identity, role, logout, Floor/Reservations/Me icons, exact three-tab nav, active states, Floor → Reservations → Me, and existing workflow rendering passed.
- Logout immediately rendered `Logging out`, issued one `POST /api/auth/logout` (201), ignored duplicate activation, cleared both tokens, and protected navigation returned to login.
- Waiter access to Supervisor remained denied by the authoritative Supervisor guard.

### Cashier

- Demo login landed on Queue; shared header, clock, branch/workstation fallback, identity, unchanged Queue/Receipts/Till/Me navigation, Queue → Receipts → Me, and existing cashier surfaces passed.
- Logout pending/deduplication/token-clear/protected redirect passed.
- Cashier access to Supervisor remained denied.

### Supervisor

- Demo login landed on Floor with exactly four visible entries: Floor, Reservations, Approvals, Me. No Orders label/link was present.
- Floor → Reservations → Approvals → Me, all shared icons, active states, legacy root/table/order URLs, table resolution, refresh stability, browser Back, and logout passed.
- Supervisor access to Cashier was denied. Direct Waiter navigation rendered the authoritative `Waiter workspace only` blocked state; the URL remains stable by existing guard design.

The initial browser pass recorded one non-API console 404. Direct diagnosis identified the missing `/favicon.ico`; Prompt 1 added and declared `/favicon.svg`, and the final production server returned 200 for the asset and Supervisor Floor. No application API response failed.

## Viewport screenshots

- `prompt1-waiter-floor-1440x900.png`
- `prompt1-cashier-queue-1440x900.png`
- `prompt1-supervisor-floor-1440x900.png`
- `prompt1-supervisor-reservations-1440x900.png`
- `prompt1-supervisor-approvals-1440x900.png`
- `prompt1-supervisor-me-1440x900.png`

Screenshots and machine-readable baseline/after request reports are stored outside the repository under `C:\Users\arman\.codex\visualizations\2026\07\18\019f74e3-0533-74d0-b056-236a3efdb8fb`.

## Files created

- `apps/web/src/components/pos-shell/`: `OperationalShell.tsx`, `OperationalHeader.tsx`, `OperationalBottomNav.tsx`, `CurrentTime.tsx`, `OperationalIdleLogoutHandler.tsx`, `RoleIdentity.tsx`, `BranchContextLabel.tsx`, `role-icons.ts`, `role-icon-config.ts`, `role-navigation.ts`, `layout.ts`, `types.ts`, and `index.ts`.
- `apps/web/src/components/supervisor/orders/SupervisorLegacyOrdersRedirect.tsx`.
- `apps/web/src/lib/supervisor/legacy-orders-route.ts`.
- `apps/web/scripts/shell-assertions.ts` and `tsconfig.shell-assertions.json`.
- `apps/web/public/favicon.svg`.
- This completion report.

## Files modified for Prompt 1

- Waiter shell adapters/readiness/idle/index, Waiter route registry, login shared-time import, and Waiter lifecycle documentation.
- Cashier shell/header/nav/readiness/guard adapter, Cashier context/routes, and Cashier lifecycle documentation.
- Supervisor shell/header/nav/readiness adapters, context/routes, Floor/table-detail/approval-detail compatibility context, Orders page/index, current reconstruction docs, roadmap, and status.
- `apps/web/src/pages/_app.tsx`, `repo file tree.txt`, and `ai/AI_STATUS.md`.
- A trailing-space-only cleanup was made to Prompt 0 `SUPERVISOR_API_MATRIX.md` so repository diff hygiene could pass without altering content.

## Files retained temporarily

- Role-specific Waiter, Cashier, and Supervisor shell/header/bottom-nav files remain as thin adapters.
- `WaiterPageContainer` remains as a compatibility fragment adapter.
- Existing Supervisor order queue/detail/resolution components remain for Prompts 2-3.
- The old role-owned `waiter/shell/CurrentTime.tsx` was removed only after all imports migrated and typecheck/build/assertions passed.

## Validation results

| Check | Result |
|---|---|
| `corepack pnpm@8.15.0 --version` | Pass — `8.15.0` |
| Web typecheck | Pass |
| Web lint | Pass — no warnings/errors |
| Web production build | Pass — compiled and optimized successfully |
| Focused shell assertions | Pass — icons, route counts/labels, uniqueness, explicit matching, legacy context, and offsets |
| `GET http://localhost:3001/api/health` | Pass — `status: ok`, `db: ok` |
| Final Supervisor Floor HTTP | Pass — 200 |
| Final favicon HTTP | Pass — 200 |
| `git diff --check` | Pass after whitespace-only Prompt 0 cleanup |
| Postman diff/status | Empty |

## Remaining limitations

- Prompt 2 has not begun: Supervisor Floor still uses its current presentation rather than extracted Waiter floor primitives.
- The final Supervisor Floor order workspace and exception lookup UI remain for Prompts 2-3. Prompt 1 only preserves routing context.
- Reservation creation/completion, approval decisions, split/merge/move/void/discount/anomaly actions remain intentionally unimplemented.
- Service area/workstation API values are not available in current role context, so the shared header truthfully displays `Service area unavailable` or `Workstation unavailable`.
- The pre-existing login/session architecture performs two `/api/auth/me` reads; Prompt 1 neither added nor increased them.

## Final statement

Prompt 1 satisfies the shared shell, uniform header, shared time/logout, canonical icon registry, shared bottom navigation, exact Supervisor four-tab navigation, safe legacy Orders compatibility, responsive/accessibility, guard-preservation, performance-preservation, documentation, and validation gates. Cashier navigation and operational behavior remain intact; Waiter navigation and order-entry behavior remain intact; no backend/Postman contract changed; no commit or push occurred. Prompt 2 was not started.
